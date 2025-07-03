import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MokaApiService, MokaCredentials, MokaSale } from './moka-api.service';
import { MokaAuthService } from './moka-auth.service';
import { Order, OrderStatus, PaymentStatus } from '../../../orders/entities/order.entity';
import { OrderItem } from '../../../orders/entities/order.entity';
import { InventoryItem } from '../../../inventory/entities/inventory-item.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../entities/integration-log.entity';

export interface SalesSyncOptions {
  fromDate?: Date;
  toDate?: Date;
  status?: string[];
  batchSize?: number;
  syncInventoryDeduction?: boolean;
  includePayments?: boolean;
}

export interface MokaSalesImportResult {
  success: boolean;
  importedCount: number;
  errorCount: number;
  duplicateCount: number;
  errors: string[];
  inventoryUpdates: number;
}

@Injectable()
export class MokaSalesService {
  private readonly logger = new Logger(MokaSalesService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    private readonly mokaApiService: MokaApiService,
    private readonly authService: MokaAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Import sales data from Moka POS
   */
  async importSalesFromMoka(
    tenantId: string,
    channelId: string,
    options: SalesSyncOptions = {},
  ): Promise<MokaSalesImportResult> {
    const startTime = Date.now();
    let importedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let inventoryUpdates = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_sales_import',
        'started',
        'Starting sales data import from Moka',
        { options },
      );

      // Set default date range if not provided
      const fromDate = options.fromDate || this.getDefaultFromDate();
      const toDate = options.toDate || new Date();

      // Get sales data from Moka with pagination
      let page = 1;
      const limit = options.batchSize || 50;
      let hasMorePages = true;

      while (hasMorePages) {
        try {
          const salesResponse = await this.mokaApiService.getSales(
            credentials,
            tenantId,
            channelId,
            {
              page,
              limit,
              from_date: this.mokaApiService.formatDate(fromDate),
              to_date: this.mokaApiService.formatDate(toDate),
              status: options.status?.join(','),
            },
          );

          if (!salesResponse.success || !salesResponse.data) {
            throw new Error(`Failed to get sales data: ${salesResponse.error?.message}`);
          }

          const sales = salesResponse.data.data;
          
          // Process sales in this page
          for (const mokaSale of sales) {
            try {
              const result = await this.importSingleSale(
                tenantId,
                channelId,
                mokaSale,
                options,
              );

              if (result.imported) {
                importedCount++;
                if (result.inventoryUpdated) {
                  inventoryUpdates++;
                }
              } else if (result.duplicate) {
                duplicateCount++;
              }

            } catch (error) {
              this.logger.error(`Failed to import sale ${mokaSale.id}: ${error.message}`);
              errors.push(`Sale ${mokaSale.receipt_number} (${mokaSale.id}): ${error.message}`);
              errorCount++;
            }
          }

          // Check if there are more pages
          hasMorePages = page < salesResponse.data.pagination.total_pages;
          page++;

        } catch (error) {
          this.logger.error(`Sales batch import failed for page ${page}: ${error.message}`, error.stack);
          errorCount += limit; // Estimate failed items
          errors.push(`Page ${page} import failed: ${error.message}`);
          break;
        }
      }

      const duration = Date.now() - startTime;
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_sales_import',
        'completed',
        `Sales import completed: ${importedCount} imported, ${duplicateCount} duplicates, ${errorCount} errors`,
        { 
          importedCount, 
          duplicateCount, 
          errorCount, 
          inventoryUpdates,
          duration, 
          totalPages: page - 1,
          dateRange: { fromDate, toDate },
        },
      );

      return {
        success: true,
        importedCount,
        errorCount,
        duplicateCount,
        errors,
        inventoryUpdates,
      };

    } catch (error) {
      this.logger.error(`Sales import failed: ${error.message}`, error.stack);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_sales_import',
        'failed',
        error.message,
        { importedCount, duplicateCount, errorCount, inventoryUpdates },
      );

      return {
        success: false,
        importedCount,
        errorCount,
        duplicateCount,
        errors: [...errors, error.message],
        inventoryUpdates,
      };
    }
  }

  /**
   * Get sales report from Moka
   */
  async getSalesReport(
    tenantId: string,
    channelId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    success: boolean;
    data?: {
      totalSales: number;
      totalAmount: number;
      totalTax: number;
      totalDiscount: number;
      salesByPaymentMethod: Record<string, { count: number; amount: number }>;
      salesByHour: Record<string, { count: number; amount: number }>;
      topProducts: Array<{
        productId: string;
        productName: string;
        quantity: number;
        revenue: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      // Get sales data for the period
      const salesResponse = await this.mokaApiService.getSales(
        credentials,
        tenantId,
        channelId,
        {
          from_date: this.mokaApiService.formatDate(fromDate),
          to_date: this.mokaApiService.formatDate(toDate),
          limit: 1000, // Get more data for reporting
        },
      );

      if (!salesResponse.success || !salesResponse.data) {
        throw new Error(`Failed to get sales data: ${salesResponse.error?.message}`);
      }

      const sales = salesResponse.data.data;
      
      // Calculate report metrics
      const report = this.calculateSalesReport(sales);

      return {
        success: true,
        data: report,
      };

    } catch (error) {
      this.logger.error(`Failed to generate sales report: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sync inventory deductions based on sales
   */
  async syncInventoryDeductions(
    tenantId: string,
    channelId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errors: string[];
  }> {
    let updatedCount = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      // Get sales data
      const salesResponse = await this.mokaApiService.getSales(
        credentials,
        tenantId,
        channelId,
        {
          from_date: this.mokaApiService.formatDate(fromDate),
          to_date: this.mokaApiService.formatDate(toDate),
          status: 'completed',
        },
      );

      if (!salesResponse.success || !salesResponse.data) {
        throw new Error(`Failed to get sales data: ${salesResponse.error?.message}`);
      }

      // Process each sale for inventory deduction
      for (const sale of salesResponse.data.data) {
        try {
          const deducted = await this.processInventoryDeduction(tenantId, channelId, sale);
          if (deducted) {
            updatedCount++;
          }
        } catch (error) {
          errors.push(`Sale ${sale.receipt_number}: ${error.message}`);
        }
      }

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INVENTORY,
        level: IntegrationLogLevel.INFO,
        message: `Moka inventory sync completed: ${updatedCount} products updated`,
        metadata: {
          channelId,
          updatedCount,
          errorCount: errors.length,
          dateRange: { fromDate, toDate },
        },
      });

      return {
        success: true,
        updatedCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Inventory deduction sync failed: ${error.message}`, error.stack);
      return {
        success: false,
        updatedCount,
        errors: [...errors, error.message],
      };
    }
  }

  // Private helper methods

  private async importSingleSale(
    tenantId: string,
    channelId: string,
    mokaSale: MokaSale,
    options: SalesSyncOptions,
  ): Promise<{
    imported: boolean;
    duplicate: boolean;
    inventoryUpdated: boolean;
  }> {
    // Check if sale already exists
    const existingMapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'order',
        externalId: mokaSale.id,
      },
    });

    if (existingMapping) {
      return {
        imported: false,
        duplicate: true,
        inventoryUpdated: false,
      };
    }

    // Create order from Moka sale
    const order = await this.createOrderFromMokaSale(tenantId, channelId, mokaSale);
    await this.orderRepository.save(order);

    // Create order items
    const orderItems = await this.createOrderItemsFromMokaSale(tenantId, order.id, mokaSale);
    await this.orderItemRepository.save(orderItems);

    // Create mapping
    await this.saveSaleMapping(tenantId, channelId, order.id, mokaSale.id, mokaSale);

    // Process inventory deduction if enabled
    let inventoryUpdated = false;
    if (options.syncInventoryDeduction && mokaSale.status === 'completed') {
      inventoryUpdated = await this.processInventoryDeduction(tenantId, channelId, mokaSale);
    }

    // Emit event
    this.eventEmitter.emit('order.imported.moka', {
      tenantId,
      channelId,
      orderId: order.id,
      externalId: mokaSale.id,
      mokaSale,
    });

    return {
      imported: true,
      duplicate: false,
      inventoryUpdated,
    };
  }

  private async createOrderFromMokaSale(
    tenantId: string,
    channelId: string,
    mokaSale: MokaSale,
  ): Promise<Order> {
    const order = this.orderRepository.create({
      tenantId,
      channelId,
      orderNumber: mokaSale.receipt_number,
      externalOrderId: mokaSale.id,
      status: this.mapMokaSaleStatus(mokaSale.status),
      totalAmount: mokaSale.total_amount,
      subtotalAmount: mokaSale.total_amount - mokaSale.tax_amount,
      taxAmount: mokaSale.tax_amount,
      discountAmount: mokaSale.discount_amount,
      shippingAmount: 0, // POS sales don't have shipping
      currency: 'IDR',
      paymentMethod: mokaSale.payment_method,
      paymentStatus: PaymentStatus.PAID, // POS sales are always paid
      createdAt: this.mokaApiService.parseDateTime(mokaSale.sale_date),
      orderDate: this.mokaApiService.parseDateTime(mokaSale.sale_date),
      
      // Customer information
      customerName: mokaSale.customer_name,
      customerInfo: {
        id: mokaSale.customer_id,
      },
      
      // Staff information
      channelMetadata: {
        moka: {
          cashierId: mokaSale.cashier_id,
          cashierName: mokaSale.cashier_name,
          saleDate: mokaSale.sale_date,
          receiptNumber: mokaSale.receipt_number,
          payments: mokaSale.payments,
        },
      },
    });

    return order;
  }

  private async createOrderItemsFromMokaSale(
    tenantId: string,
    orderId: string,
    mokaSale: MokaSale,
  ): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = [];

    for (const item of mokaSale.items) {
      // Try to find matching product
      const productMapping = await this.mappingRepository.findOne({
        where: {
          tenantId,
          entityType: 'product',
          externalId: item.product_id,
        },
      });

      const orderItem = this.orderItemRepository.create({
        tenantId,
        orderId,
        productId: productMapping?.internalId,
        productName: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        discountAmount: item.discount_amount,
        taxAmount: item.tax_amount,
        
        // Store Moka-specific data
        externalProductId: item.product_id,
        externalVariantId: item.variant_id,
        externalData: {
          moka: {
            productId: item.product_id,
            variantId: item.variant_id,
            variantName: item.variant_name,
          },
        },
      });

      orderItems.push(orderItem);
    }

    return orderItems;
  }

  private async processInventoryDeduction(
    tenantId: string,
    channelId: string,
    mokaSale: MokaSale,
  ): Promise<boolean> {
    let hasUpdates = false;

    for (const item of mokaSale.items) {
      try {
        // Find product mapping
        const productMapping = await this.mappingRepository.findOne({
          where: {
            tenantId,
            entityType: 'product',
            externalId: item.product_id,
          },
        });

        if (!productMapping) {
          this.logger.warn(`Product mapping not found for Moka product ${item.product_id}`);
          continue;
        }

        // Find inventory item
        const inventoryItem = await this.inventoryRepository.findOne({
          where: {
            tenantId,
            productId: productMapping.internalId,
            // You might need to specify location based on your setup
          },
        });

        if (!inventoryItem) {
          this.logger.warn(`Inventory item not found for product ${productMapping.internalId}`);
          continue;
        }

        // Deduct quantity
        inventoryItem.quantityOnHand -= item.quantity;
        inventoryItem.lastMovementAt = this.mokaApiService.parseDateTime(mokaSale.sale_date);

        await this.inventoryRepository.save(inventoryItem);
        hasUpdates = true;

        // Emit inventory change event
        this.eventEmitter.emit('inventory.updated.moka_sale', {
          tenantId,
          inventoryItem,
          quantityChange: -item.quantity,
          reason: 'moka_sale',
          orderId: mokaSale.id,
          receiptNumber: mokaSale.receipt_number,
        });

      } catch (error) {
        this.logger.error(`Failed to deduct inventory for item ${item.product_id}: ${error.message}`);
      }
    }

    return hasUpdates;
  }

  private async saveSaleMapping(
    tenantId: string,
    channelId: string,
    internalId: string,
    externalId: string,
    externalData: any,
  ): Promise<ChannelMapping> {
    const mapping = this.mappingRepository.create({
      tenantId,
      channelId,
      entityType: 'order',
      internalId,
      externalId,
      externalData,
      lastSyncAt: new Date(),
    });

    return await this.mappingRepository.save(mapping);
  }

  private mapMokaSaleStatus(mokaStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'completed': OrderStatus.DELIVERED, // Sale is complete
      'cancelled': OrderStatus.CANCELLED,
      'pending': OrderStatus.PENDING,
    };

    return statusMap[mokaStatus] || OrderStatus.PENDING;
  }

  private calculateSalesReport(sales: MokaSale[]): any {
    const report = {
      totalSales: sales.length,
      totalAmount: 0,
      totalTax: 0,
      totalDiscount: 0,
      salesByPaymentMethod: {} as Record<string, { count: number; amount: number }>,
      salesByHour: {} as Record<string, { count: number; amount: number }>,
      topProducts: [] as Array<{
        productId: string;
        productName: string;
        quantity: number;
        revenue: number;
      }>,
    };

    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const sale of sales) {
      // Aggregate totals
      report.totalAmount += sale.total_amount;
      report.totalTax += sale.tax_amount;
      report.totalDiscount += sale.discount_amount;

      // Group by payment method
      if (!report.salesByPaymentMethod[sale.payment_method]) {
        report.salesByPaymentMethod[sale.payment_method] = { count: 0, amount: 0 };
      }
      report.salesByPaymentMethod[sale.payment_method].count++;
      report.salesByPaymentMethod[sale.payment_method].amount += sale.total_amount;

      // Group by hour
      const hour = new Date(sale.sale_date).getHours().toString().padStart(2, '0');
      if (!report.salesByHour[hour]) {
        report.salesByHour[hour] = { count: 0, amount: 0 };
      }
      report.salesByHour[hour].count++;
      report.salesByHour[hour].amount += sale.total_amount;

      // Aggregate product stats
      for (const item of sale.items) {
        if (!productStats[item.product_id]) {
          productStats[item.product_id] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }
        productStats[item.product_id].quantity += item.quantity;
        productStats[item.product_id].revenue += item.total_price;
      }
    }

    // Get top 10 products by revenue
    report.topProducts = Object.entries(productStats)
      .map(([productId, stats]) => ({
        productId,
        productName: stats.name,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return report;
  }

  private getDefaultFromDate(): Date {
    // Default to last 7 days
    const date = new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}