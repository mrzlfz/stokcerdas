import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuickBooksApiService, QuickBooksCredentials, QuickBooksInvoice, QuickBooksCustomer } from './quickbooks-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { AccountingAccount } from '../../entities/accounting-account.entity';
import { Order } from '../../../orders/entities/order.entity';
import { OrderItem } from '../../../orders/entities/order-item.entity';
import { Customer } from '../../../customers/entities/customer.entity';
import { Product } from '../../../products/entities/product.entity';

export interface InvoiceGenerationOptions {
  includeShipping?: boolean;
  includeTax?: boolean;
  includeDiscounts?: boolean;
  autoSendEmail?: boolean;
  defaultPaymentTerms?: string;
  defaultTaxCode?: string;
  markAsPrinted?: boolean;
  customFields?: Record<string, any>;
  invoiceTemplate?: string;
  dueDate?: Date;
  invoiceNumber?: string;
}

export interface GeneratedInvoice {
  orderId: string;
  quickBooksInvoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  taxAmount: number;
  status: 'created' | 'sent' | 'paid' | 'overdue';
  pdfUrl?: string;
  errors?: string[];
}

export interface InvoiceBatch {
  batchId: string;
  totalOrders: number;
  processedOrders: number;
  successfulInvoices: number;
  failedInvoices: number;
  invoices: GeneratedInvoice[];
  errors: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface CustomerMapping {
  stokcerdasCustomerId: string;
  quickBooksCustomerId: string;
  customerName: string;
  email?: string;
  lastSyncAt: Date;
}

@Injectable()
export class QuickBooksInvoiceService {
  private readonly logger = new Logger(QuickBooksInvoiceService.name);

  constructor(
    private readonly quickBooksApiService: QuickBooksApiService,
    private readonly integrationLogService: IntegrationLogService,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Generate QuickBooks invoice from StokCerdas order
   */
  async generateInvoiceFromOrder(
    accountingAccountId: string,
    orderId: string,
    tenantId: string,
    options: InvoiceGenerationOptions = {},
  ): Promise<GeneratedInvoice> {
    try {
      this.logger.log(`Generating QuickBooks invoice for order ${orderId}`);

      // Get accounting account with credentials
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const credentials: QuickBooksCredentials = {
        clientId: accountingAccount.clientId!,
        clientSecret: accountingAccount.clientSecret!,
        accessToken: accountingAccount.accessToken!,
        refreshToken: accountingAccount.refreshToken!,
        realmId: accountingAccount.platformConfig?.realmId!,
        environment: accountingAccount.platformConfig?.environment || 'production',
        expiresAt: accountingAccount.tokenExpiresAt,
      };

      // Get order with related data
      const order = await this.orderRepository.findOne({
        where: { id: orderId, tenantId, isDeleted: false },
        relations: ['items', 'items.product', 'customer', 'shippingAddress', 'billingAddress'],
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'confirmed' && order.status !== 'processing' && order.status !== 'shipped') {
        throw new Error('Order status must be confirmed, processing, or shipped to generate invoice');
      }

      // Ensure customer exists in QuickBooks
      const quickBooksCustomerId = await this.ensureCustomerExists(
        credentials,
        order.customer!,
        tenantId,
        accountingAccount.channelId!,
      );

      // Create QuickBooks invoice
      const quickBooksInvoice = await this.createQuickBooksInvoice(
        order,
        quickBooksCustomerId,
        options,
      );

      // Submit to QuickBooks
      const response = await this.quickBooksApiService.createInvoice(
        credentials,
        quickBooksInvoice,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to create QuickBooks invoice: ${response.error?.message}`);
      }

      const createdInvoice = response.data?.Invoice!;

      // Generate PDF if needed
      let pdfUrl: string | undefined;
      if (options.markAsPrinted) {
        try {
          const pdfResponse = await this.quickBooksApiService.getInvoicePdf(
            credentials,
            createdInvoice.Id!,
            tenantId,
            accountingAccount.channelId!,
          );

          if (pdfResponse.success) {
            // In a real implementation, you'd save this to cloud storage
            pdfUrl = `https://storage.stokcerdas.com/invoices/${createdInvoice.Id}.pdf`;
          }
        } catch (error) {
          this.logger.warn(`Failed to generate PDF for invoice ${createdInvoice.Id}: ${error.message}`);
        }
      }

      // Update order with invoice reference
      await this.orderRepository.update(orderId, {
        externalInvoiceId: createdInvoice.Id,
        externalInvoiceNumber: createdInvoice.DocNumber,
        updatedBy: 'quickbooks_invoice_sync',
      });

      const generatedInvoice: GeneratedInvoice = {
        orderId,
        quickBooksInvoiceId: createdInvoice.Id!,
        invoiceNumber: createdInvoice.DocNumber!,
        customerId: order.customerId!,
        customerName: order.customer?.name || 'Unknown Customer',
        totalAmount: createdInvoice.TotalAmt || 0,
        taxAmount: this.calculateTaxAmount(createdInvoice),
        status: 'created',
        pdfUrl,
      };

      this.logger.log(`Successfully generated QuickBooks invoice ${createdInvoice.Id} for order ${orderId}`);

      return generatedInvoice;

    } catch (error) {
      this.logger.error(`Failed to generate QuickBooks invoice for order ${orderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate invoices for multiple orders in batch
   */
  async generateInvoiceBatch(
    accountingAccountId: string,
    orderIds: string[],
    tenantId: string,
    options: InvoiceGenerationOptions = {},
  ): Promise<InvoiceBatch> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    const batch: InvoiceBatch = {
      batchId,
      totalOrders: orderIds.length,
      processedOrders: 0,
      successfulInvoices: 0,
      failedInvoices: 0,
      invoices: [],
      errors: [],
      startTime,
    };

    this.logger.log(`Starting invoice batch generation for ${orderIds.length} orders`);

    for (const orderId of orderIds) {
      try {
        const invoice = await this.generateInvoiceFromOrder(
          accountingAccountId,
          orderId,
          tenantId,
          options,
        );

        batch.invoices.push(invoice);
        batch.successfulInvoices++;

      } catch (error) {
        batch.failedInvoices++;
        batch.errors.push(`Order ${orderId}: ${error.message}`);
        this.logger.error(`Failed to generate invoice for order ${orderId}: ${error.message}`);
      }

      batch.processedOrders++;

      // Add small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    batch.endTime = new Date();
    batch.duration = batch.endTime.getTime() - startTime.getTime();

    this.logger.log(`Invoice batch generation completed: ${batch.successfulInvoices}/${batch.totalOrders} successful`);

    return batch;
  }

  /**
   * Sync invoice status from QuickBooks
   */
  async syncInvoiceStatus(
    accountingAccountId: string,
    quickBooksInvoiceId: string,
    tenantId: string,
  ): Promise<{
    invoiceId: string;
    status: 'paid' | 'partial' | 'unpaid' | 'overdue';
    balance: number;
    totalAmount: number;
    lastPaymentDate?: Date;
  }> {
    const accountingAccount = await this.accountingAccountRepository.findOne({
      where: { id: accountingAccountId, tenantId },
    });

    if (!accountingAccount) {
      throw new Error('Accounting account not found');
    }

    const credentials: QuickBooksCredentials = {
      clientId: accountingAccount.clientId!,
      clientSecret: accountingAccount.clientSecret!,
      accessToken: accountingAccount.accessToken!,
      refreshToken: accountingAccount.refreshToken!,
      realmId: accountingAccount.platformConfig?.realmId!,
      environment: accountingAccount.platformConfig?.environment || 'production',
      expiresAt: accountingAccount.tokenExpiresAt,
    };

    const response = await this.quickBooksApiService.makeQuickBooksRequest(
      credentials,
      {
        method: 'GET',
        endpoint: `/invoices/${quickBooksInvoiceId}`,
        requiresAuth: true,
      },
      tenantId,
      accountingAccount.channelId!,
    );

    if (!response.success) {
      throw new Error(`Failed to fetch invoice status: ${response.error?.message}`);
    }

    const invoice = response.data?.Invoice;
    const balance = invoice?.Balance || 0;
    const totalAmount = invoice?.TotalAmt || 0;

    let status: 'paid' | 'partial' | 'unpaid' | 'overdue';
    if (balance === 0) {
      status = 'paid';
    } else if (balance < totalAmount) {
      status = 'partial';
    } else {
      const dueDate = new Date(invoice?.DueDate || Date.now());
      status = new Date() > dueDate ? 'overdue' : 'unpaid';
    }

    return {
      invoiceId: quickBooksInvoiceId,
      status,
      balance,
      totalAmount,
    };
  }

  /**
   * Ensure customer exists in QuickBooks, create if necessary
   */
  private async ensureCustomerExists(
    credentials: QuickBooksCredentials,
    customer: Customer,
    tenantId: string,
    channelId: string,
  ): Promise<string> {
    // Check if customer already mapped to QuickBooks
    const existingMapping = await this.getCustomerMapping(customer.id, tenantId);
    
    if (existingMapping) {
      return existingMapping.quickBooksCustomerId;
    }

    // Search for customer by email or name in QuickBooks
    const searchQuery = customer.email 
      ? `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${customer.email}'`
      : `SELECT * FROM Customer WHERE Name = '${customer.name.replace(/'/g, "\\'")}'`;

    const searchResponse = await this.quickBooksApiService.queryCustomers(
      credentials,
      searchQuery,
      tenantId,
      channelId,
    );

    if (searchResponse.success && searchResponse.data?.QueryResponse?.Customer?.length > 0) {
      const existingCustomer = searchResponse.data.QueryResponse.Customer[0];
      
      // Save mapping
      await this.saveCustomerMapping(customer.id, existingCustomer.Id!, customer.name, tenantId);
      
      return existingCustomer.Id!;
    }

    // Create new customer in QuickBooks
    const quickBooksCustomer: QuickBooksCustomer = {
      Name: customer.name,
      CompanyName: customer.company,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      BillAddr: customer.address ? {
        Line1: customer.address.street,
        City: customer.address.city,
        Country: customer.address.country || 'Indonesia',
        CountrySubDivisionCode: customer.address.province,
        PostalCode: customer.address.postalCode,
      } : undefined,
      Taxable: true,
      CurrencyRef: { value: 'IDR', name: 'Indonesian Rupiah' },
    };

    const createResponse = await this.quickBooksApiService.createCustomer(
      credentials,
      quickBooksCustomer,
      tenantId,
      channelId,
    );

    if (!createResponse.success) {
      throw new Error(`Failed to create QuickBooks customer: ${createResponse.error?.message}`);
    }

    const createdCustomer = createResponse.data?.Customer!;
    
    // Save mapping
    await this.saveCustomerMapping(customer.id, createdCustomer.Id!, customer.name, tenantId);

    return createdCustomer.Id!;
  }

  /**
   * Create QuickBooks invoice structure from order
   */
  private async createQuickBooksInvoice(
    order: Order,
    quickBooksCustomerId: string,
    options: InvoiceGenerationOptions,
  ): Promise<QuickBooksInvoice> {
    const invoice: QuickBooksInvoice = {
      CustomerRef: {
        value: quickBooksCustomerId,
        name: order.customer?.name,
      },
      TxnDate: order.orderDate.toISOString().split('T')[0],
      DueDate: options.dueDate?.toISOString().split('T')[0] || 
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      DocNumber: options.invoiceNumber || order.orderNumber,
      PrivateNote: `Generated from StokCerdas order ${order.orderNumber}`,
      Line: [],
    };

    // Add customer memo if available
    if (order.notes) {
      invoice.CustomerMemo = { value: order.notes };
    }

    // Add billing address
    if (order.billingAddress) {
      invoice.BillAddr = {
        Line1: order.billingAddress.street,
        Line2: order.billingAddress.street2,
        City: order.billingAddress.city,
        Country: order.billingAddress.country || 'Indonesia',
        CountrySubDivisionCode: order.billingAddress.province,
        PostalCode: order.billingAddress.postalCode,
      };
    }

    // Add shipping address
    if (order.shippingAddress) {
      invoice.ShipAddr = {
        Line1: order.shippingAddress.street,
        Line2: order.shippingAddress.street2,
        City: order.shippingAddress.city,
        Country: order.shippingAddress.country || 'Indonesia',
        CountrySubDivisionCode: order.shippingAddress.province,
        PostalCode: order.shippingAddress.postalCode,
      };
    }

    // Add line items
    let lineNum = 1;
    for (const item of order.items || []) {
      const lineItem = {
        Id: lineNum.toString(),
        LineNum: lineNum,
        Amount: item.quantity * item.unitPrice,
        DetailType: 'SalesItemLineDetail' as const,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
          TaxCodeRef: options.defaultTaxCode ? {
            value: options.defaultTaxCode,
          } : undefined,
        },
      };

      // Try to map to QuickBooks item
      const quickBooksItemId = await this.getQuickBooksItemId(item.productId, order.tenantId);
      if (quickBooksItemId) {
        lineItem.SalesItemLineDetail.ItemRef = {
          value: quickBooksItemId,
          name: item.product?.name,
        };
      }

      invoice.Line!.push(lineItem);
      lineNum++;
    }

    // Add shipping if enabled
    if (options.includeShipping && order.shippingCost && order.shippingCost > 0) {
      invoice.Line!.push({
        Id: lineNum.toString(),
        LineNum: lineNum,
        Amount: order.shippingCost,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: order.shippingCost,
          // You might want to create a shipping item in QuickBooks
        },
      });
      lineNum++;
    }

    // Add discount if enabled
    if (options.includeDiscounts && order.discountAmount && order.discountAmount > 0) {
      invoice.Line!.push({
        Id: lineNum.toString(),
        LineNum: lineNum,
        Amount: -order.discountAmount, // Negative amount for discount
        DetailType: 'DiscountLineDetail',
        DiscountLineDetail: {
          PercentBased: false,
        },
      });
    }

    // Set payment terms
    if (options.defaultPaymentTerms) {
      invoice.SalesTermRef = {
        value: options.defaultPaymentTerms,
      };
    }

    // Set print and email status
    invoice.PrintStatus = options.markAsPrinted ? 'PrintComplete' : 'NotSet';
    invoice.EmailStatus = options.autoSendEmail ? 'EmailSent' : 'NotSet';

    return invoice;
  }

  /**
   * Calculate tax amount from QuickBooks invoice
   */
  private calculateTaxAmount(invoice: QuickBooksInvoice): number {
    if (!invoice.Line) return 0;
    
    return invoice.Line
      .filter(line => line.DetailType === 'TaxLineDetail')
      .reduce((sum, line) => sum + (line.Amount || 0), 0);
  }

  // Helper methods for customer mapping
  private async getCustomerMapping(customerId: string, tenantId: string): Promise<CustomerMapping | null> {
    // This would typically be stored in a separate mapping table
    // For now, we'll use a simple implementation
    return null;
  }

  private async saveCustomerMapping(
    customerId: string,
    quickBooksCustomerId: string,
    customerName: string,
    tenantId: string,
  ): Promise<void> {
    // Save mapping to database
    // Implementation would depend on your mapping table structure
  }

  private async getQuickBooksItemId(productId: string, tenantId: string): Promise<string | null> {
    // Get QuickBooks item ID from sync status or mapping table
    // This would typically query the sync_status table
    return null;
  }
}