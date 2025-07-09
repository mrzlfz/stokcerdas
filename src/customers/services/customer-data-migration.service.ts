import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  Customer,
  CustomerStatus,
  CustomerSegmentType,
  LoyaltyTier,
  CustomerType,
} from '../entities/customer.entity';
import { CustomerTransaction } from '../entities/customer-transaction.entity';
import { Order, OrderStatus } from '../../orders/entities/order.entity';
import { CustomersService } from './customers.service';

export interface MigrationProgress {
  processed: number;
  created: number;
  updated: number;
  errors: number;
  skipped: number;
  total: number;
  currentPhase: string;
  startTime: Date;
  estimatedCompletion?: Date;
}

export interface MigrationResult {
  success: boolean;
  progress: MigrationProgress;
  errors: Array<{
    orderId: string;
    error: string;
    customerData?: any;
  }>;
  summary: {
    customersCreated: number;
    customersUpdated: number;
    transactionsCreated: number;
    duplicatesFound: number;
    processingTimeMs: number;
  };
}

@Injectable()
export class CustomerDataMigrationService {
  private readonly logger = new Logger(CustomerDataMigrationService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerTransaction)
    private readonly customerTransactionRepository: Repository<CustomerTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly customersService: CustomersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Migrate all customer data from orders to customer entities
   */
  async migrateAllCustomerData(
    tenantId: string,
    batchSize: number = 100,
  ): Promise<MigrationResult> {
    const startTime = new Date();
    this.logger.log(`Starting customer data migration for tenant ${tenantId}`);

    const progress: MigrationProgress = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
      total: 0,
      currentPhase: 'Initializing',
      startTime,
    };

    const errors: Array<{
      orderId: string;
      error: string;
      customerData?: any;
    }> = [];
    let customersCreated = 0;
    let customersUpdated = 0;
    let transactionsCreated = 0;
    let duplicatesFound = 0;

    try {
      // Get total count of orders for progress tracking
      progress.total = await this.orderRepository.count({
        where: { tenantId },
      });

      this.logger.log(
        `Found ${progress.total} orders to process for tenant ${tenantId}`,
      );

      // Phase 1: Extract unique customer data from orders
      progress.currentPhase = 'Extracting customer data';
      const customerMap = await this.extractUniqueCustomers(
        tenantId,
        progress,
        errors,
      );

      // Phase 2: Create/update customer entities
      progress.currentPhase = 'Creating customer entities';
      const customerCreationResults = await this.createCustomerEntities(
        tenantId,
        customerMap,
        progress,
        errors,
      );
      customersCreated = customerCreationResults.created;
      customersUpdated = customerCreationResults.updated;
      duplicatesFound = customerCreationResults.duplicates;

      // Phase 3: Create customer transactions from orders
      progress.currentPhase = 'Creating customer transactions';
      transactionsCreated = await this.createCustomerTransactions(
        tenantId,
        batchSize,
        progress,
        errors,
      );

      // Phase 4: Update order references to customers
      progress.currentPhase = 'Updating order-customer relationships';
      await this.updateOrderCustomerReferences(
        tenantId,
        batchSize,
        progress,
        errors,
      );

      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - startTime.getTime();

      this.logger.log(
        `Customer data migration completed for tenant ${tenantId}. ` +
          `Created: ${customersCreated}, Updated: ${customersUpdated}, ` +
          `Transactions: ${transactionsCreated}, Time: ${processingTimeMs}ms`,
      );

      // Emit migration completed event
      this.eventEmitter.emit('customer.migration.completed', {
        tenantId,
        customersCreated,
        customersUpdated,
        transactionsCreated,
        processingTimeMs,
      });

      return {
        success: true,
        progress,
        errors,
        summary: {
          customersCreated,
          customersUpdated,
          transactionsCreated,
          duplicatesFound,
          processingTimeMs,
        },
      };
    } catch (error) {
      this.logger.error(
        `Migration failed for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        progress,
        errors: [...errors, { orderId: 'SYSTEM', error: error.message }],
        summary: {
          customersCreated,
          customersUpdated,
          transactionsCreated,
          duplicatesFound,
          processingTimeMs: new Date().getTime() - startTime.getTime(),
        },
      };
    }
  }

  /**
   * Extract unique customer data from orders
   */
  private async extractUniqueCustomers(
    tenantId: string,
    progress: MigrationProgress,
    errors: Array<{ orderId: string; error: string; customerData?: any }>,
  ): Promise<Map<string, any>> {
    const customerMap = new Map<string, any>();
    let offset = 0;
    const batchSize = 500;

    while (true) {
      const orders = await this.orderRepository.find({
        where: { tenantId },
        order: { orderDate: 'ASC' },
        skip: offset,
        take: batchSize,
      });

      if (orders.length === 0) break;

      for (const order of orders) {
        try {
          const customerKey = this.generateCustomerKey(order);

          if (customerKey && !customerMap.has(customerKey)) {
            const customerData = this.extractCustomerFromOrder(order);
            if (customerData) {
              customerMap.set(customerKey, customerData);
            }
          }

          progress.processed++;
        } catch (error) {
          this.logger.error(
            `Error extracting customer from order ${order.id}: ${error.message}`,
          );
          errors.push({
            orderId: order.id,
            error: `Customer extraction failed: ${error.message}`,
            customerData: {
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerPhone: order.customerPhone,
            },
          });
          progress.errors++;
        }
      }

      offset += batchSize;

      // Update progress periodically
      if (offset % 1000 === 0) {
        this.logger.debug(
          `Processed ${offset} orders, found ${customerMap.size} unique customers`,
        );
      }
    }

    this.logger.log(
      `Extracted ${customerMap.size} unique customers from ${progress.processed} orders`,
    );
    return customerMap;
  }

  /**
   * Generate a unique key for customer identification
   */
  private generateCustomerKey(order: Order): string | null {
    // Priority: email > phone > name+shipping address combination
    if (order.customerEmail?.trim()) {
      return `email:${order.customerEmail.trim().toLowerCase()}`;
    }

    if (order.customerPhone?.trim()) {
      return `phone:${this.normalizePhoneNumber(order.customerPhone)}`;
    }

    // Fallback: use name + shipping address if available
    if (order.customerName?.trim() && order.shippingAddress?.address) {
      const normalizedName = order.customerName.trim().toLowerCase();
      const normalizedAddress = order.shippingAddress.address
        .trim()
        .toLowerCase();
      return `name_address:${normalizedName}:${normalizedAddress}`;
    }

    return null; // Cannot identify customer uniquely
  }

  /**
   * Extract customer data from order
   */
  private extractCustomerFromOrder(order: Order): any | null {
    if (!order.customerName?.trim()) {
      return null; // Must have at least a name
    }

    const fullName = order.customerName.trim();
    const nameParts = this.parseFullName(fullName);

    // Determine customer type based on available data
    const customerType =
      order.customerInfo?.id ||
      order.shippingAddress?.name !== order.customerName
        ? CustomerType.BUSINESS
        : CustomerType.INDIVIDUAL;

    // Build addresses array
    const addresses = [];

    if (order.shippingAddress) {
      addresses.push({
        id: 'shipping_default',
        type: 'shipping',
        isDefault: true,
        name: order.shippingAddress.name || order.customerName,
        address: order.shippingAddress.address || '',
        city: order.shippingAddress.city || '',
        state: order.shippingAddress.state || '',
        postalCode: order.shippingAddress.postalCode || '',
        country: order.shippingAddress.country || 'Indonesia',
        phone: order.shippingAddress.phone || order.customerPhone,
        notes: order.shippingAddress.notes,
      });
    }

    if (
      order.billingAddress &&
      JSON.stringify(order.billingAddress) !==
        JSON.stringify(order.shippingAddress)
    ) {
      addresses.push({
        id: 'billing_default',
        type: 'billing',
        isDefault: false,
        name: order.billingAddress.name || order.customerName,
        address: order.billingAddress.address || '',
        city: order.billingAddress.city || '',
        state: order.billingAddress.state || '',
        postalCode: order.billingAddress.postalCode || '',
        country: order.billingAddress.country || 'Indonesia',
        phone: order.billingAddress.phone || order.customerPhone,
      });
    }

    // Extract external IDs
    const externalIds: any = {};
    if (order.externalData?.platformCustomerId) {
      if (order.channelName?.toLowerCase().includes('shopee')) {
        externalIds.shopeeCustomerId = order.externalData.platformCustomerId;
      } else if (order.channelName?.toLowerCase().includes('tokopedia')) {
        externalIds.tokopediaCustomerId = order.externalData.platformCustomerId;
      } else if (order.channelName?.toLowerCase().includes('lazada')) {
        externalIds.lazadaCustomerId = order.externalData.platformCustomerId;
      }
    }

    return {
      tenantId: order.tenantId,
      fullName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      email: order.customerEmail?.trim() || null,
      phone: order.customerPhone
        ? this.normalizePhoneNumber(order.customerPhone)
        : null,
      customerType,
      status: CustomerStatus.ACTIVE,
      addresses: addresses.length > 0 ? addresses : null,
      segment: CustomerSegmentType.NEW_CUSTOMER,
      loyaltyTier: LoyaltyTier.BRONZE,
      externalIds: Object.keys(externalIds).length > 0 ? externalIds : null,

      // Initialize analytics from order data
      firstOrderDate: order.orderDate,
      lastOrderDate: order.orderDate,
      totalOrders: 1,
      totalSpent: order.totalAmount,
      lifetimeValue: order.totalAmount,
      averageOrderValue: order.totalAmount,

      // Metadata
      sourceOrderId: order.id,
      sourceChannelName: order.channelName,
      createdAt: order.orderDate,
      createdBy: 'migration_service',
      updatedBy: 'migration_service',
    };
  }

  /**
   * Create customer entities from extracted data
   */
  private async createCustomerEntities(
    tenantId: string,
    customerMap: Map<string, any>,
    progress: MigrationProgress,
    errors: Array<{ orderId: string; error: string; customerData?: any }>,
  ): Promise<{ created: number; updated: number; duplicates: number }> {
    let created = 0;
    let updated = 0;
    let duplicates = 0;

    for (const [customerKey, customerData] of customerMap) {
      try {
        // Check if customer already exists
        const existingCustomer = await this.findExistingCustomer(
          tenantId,
          customerData,
        );

        if (existingCustomer) {
          // Update existing customer with additional data
          await this.updateExistingCustomer(existingCustomer, customerData);
          updated++;
          duplicates++;
          this.logger.debug(
            `Updated existing customer: ${existingCustomer.customerNumber}`,
          );
        } else {
          // Create new customer
          const customer = await this.customersService.create(tenantId, {
            fullName: customerData.fullName,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            email: customerData.email,
            phone: customerData.phone,
            customerType: customerData.customerType,
            status: customerData.status,
            addresses: customerData.addresses,
            segment: customerData.segment,
            loyaltyTier: customerData.loyaltyTier,
            externalIds: customerData.externalIds,
          });

          created++;
          this.logger.debug(`Created new customer: ${customer.customerNumber}`);
        }

        progress.created = created;
        progress.updated = updated;
      } catch (error) {
        this.logger.error(
          `Error creating customer from key ${customerKey}: ${error.message}`,
        );
        errors.push({
          orderId: customerData.sourceOrderId || 'UNKNOWN',
          error: `Customer creation failed: ${error.message}`,
          customerData,
        });
        progress.errors++;
      }
    }

    return { created, updated, duplicates };
  }

  /**
   * Create customer transactions from orders
   */
  private async createCustomerTransactions(
    tenantId: string,
    batchSize: number,
    progress: MigrationProgress,
    errors: Array<{ orderId: string; error: string; customerData?: any }>,
  ): Promise<number> {
    let transactionsCreated = 0;
    let offset = 0;

    while (true) {
      const orders = await this.orderRepository.find({
        where: { tenantId },
        order: { orderDate: 'ASC' },
        skip: offset,
        take: batchSize,
      });

      if (orders.length === 0) break;

      for (const order of orders) {
        try {
          const customer = await this.findCustomerForOrder(tenantId, order);

          if (customer) {
            await this.createTransactionFromOrder(customer, order);
            transactionsCreated++;
          } else {
            this.logger.warn(
              `No customer found for order ${order.orderNumber}`,
            );
            progress.skipped++;
          }
        } catch (error) {
          this.logger.error(
            `Error creating transaction for order ${order.id}: ${error.message}`,
          );
          errors.push({
            orderId: order.id,
            error: `Transaction creation failed: ${error.message}`,
          });
          progress.errors++;
        }
      }

      offset += batchSize;

      if (offset % 1000 === 0) {
        this.logger.debug(
          `Created ${transactionsCreated} transactions from ${offset} orders`,
        );
      }
    }

    return transactionsCreated;
  }

  /**
   * Update order references to link with customers
   */
  private async updateOrderCustomerReferences(
    tenantId: string,
    batchSize: number,
    progress: MigrationProgress,
    errors: Array<{ orderId: string; error: string; customerData?: any }>,
  ): Promise<void> {
    let offset = 0;
    let updated = 0;

    while (true) {
      const orders = await this.orderRepository.find({
        where: { tenantId },
        skip: offset,
        take: batchSize,
      });

      if (orders.length === 0) break;

      for (const order of orders) {
        try {
          const customer = await this.findCustomerForOrder(tenantId, order);

          if (customer) {
            // Add customer reference to order's customerInfo
            const updatedCustomerInfo = {
              ...order.customerInfo,
              customerId: customer.id,
              customerNumber: customer.customerNumber,
              migrationDate: new Date().toISOString(),
            };

            await this.orderRepository.update(order.id, {
              customerInfo: updatedCustomerInfo,
              updatedBy: 'migration_service',
            });

            updated++;
          }
        } catch (error) {
          this.logger.error(
            `Error updating order ${order.id} customer reference: ${error.message}`,
          );
          errors.push({
            orderId: order.id,
            error: `Order update failed: ${error.message}`,
          });
          progress.errors++;
        }
      }

      offset += batchSize;
    }

    this.logger.log(`Updated customer references in ${updated} orders`);
  }

  // Helper methods

  private parseFullName(fullName: string): {
    firstName: string;
    lastName: string;
  } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Convert to Indonesian format (+62)
    if (digits.startsWith('62')) {
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      return `+62${digits.substring(1)}`;
    } else {
      return `+62${digits}`;
    }
  }

  private async findExistingCustomer(
    tenantId: string,
    customerData: any,
  ): Promise<Customer | null> {
    // Try to find by email first
    if (customerData.email) {
      const customer = await this.customerRepository.findOne({
        where: { tenantId, email: customerData.email },
      });
      if (customer) return customer;
    }

    // Try to find by phone
    if (customerData.phone) {
      const customer = await this.customerRepository.findOne({
        where: { tenantId, phone: customerData.phone },
      });
      if (customer) return customer;
    }

    return null;
  }

  private async updateExistingCustomer(
    customer: Customer,
    newData: any,
  ): Promise<void> {
    // Update analytics if new data shows more recent orders
    if (newData.lastOrderDate > customer.lastOrderDate) {
      customer.lastOrderDate = newData.lastOrderDate;
      customer.totalOrders += 1;
      customer.totalSpent += newData.totalSpent;
      customer.lifetimeValue += newData.totalSpent;
      customer.averageOrderValue = customer.totalSpent / customer.totalOrders;
    }

    // Merge external IDs
    if (newData.externalIds && customer.externalIds) {
      customer.externalIds = {
        ...customer.externalIds,
        ...newData.externalIds,
      };
    } else if (newData.externalIds) {
      customer.externalIds = newData.externalIds;
    }

    // Update segment if still new customer
    if (
      customer.segment === CustomerSegmentType.NEW_CUSTOMER &&
      customer.totalOrders > 1
    ) {
      customer.segment = CustomerSegmentType.FREQUENT_BUYER;
    }

    customer.updatedBy = 'migration_service';
    await this.customerRepository.save(customer);
  }

  private async findCustomerForOrder(
    tenantId: string,
    order: Order,
  ): Promise<Customer | null> {
    // Try to find by customer ID if already in customerInfo
    if (order.customerInfo?.customerId) {
      const customer = await this.customerRepository.findOne({
        where: { id: order.customerInfo.customerId, tenantId },
      });
      if (customer) return customer;
    }

    // Try to find by email
    if (order.customerEmail) {
      const customer = await this.customerRepository.findOne({
        where: { tenantId, email: order.customerEmail },
      });
      if (customer) return customer;
    }

    // Try to find by phone
    if (order.customerPhone) {
      const normalizedPhone = this.normalizePhoneNumber(order.customerPhone);
      const customer = await this.customerRepository.findOne({
        where: { tenantId, phone: normalizedPhone },
      });
      if (customer) return customer;
    }

    return null;
  }

  private async createTransactionFromOrder(
    customer: Customer,
    order: Order,
  ): Promise<void> {
    // Check if transaction already exists
    const existingTransaction =
      await this.customerTransactionRepository.findOne({
        where: {
          tenantId: order.tenantId,
          orderId: order.id,
        },
      });

    if (existingTransaction) {
      return; // Transaction already exists
    }

    // Generate transaction number
    const transactionNumber = `TXN-${order.orderNumber}`;

    // Determine transaction type and status based on order
    let transactionType = 'purchase';
    if (order.type === 'return') transactionType = 'return';
    else if (order.type === 'exchange') transactionType = 'exchange';

    let transactionStatus = 'completed';
    if (order.status === OrderStatus.PENDING) transactionStatus = 'pending';
    else if (order.status === OrderStatus.CANCELLED)
      transactionStatus = 'cancelled';
    else if (order.status === OrderStatus.REFUNDED)
      transactionStatus = 'refunded';

    const transaction = this.customerTransactionRepository.create({
      tenantId: order.tenantId,
      customerId: customer.id,
      orderId: order.id,
      transactionNumber,
      transactionType: transactionType as any,
      status: transactionStatus as any,
      transactionDate: order.orderDate,
      amount:
        order.totalAmount -
        (order.discountAmount || 0) -
        (order.taxAmount || 0) -
        (order.shippingAmount || 0),
      totalAmount: order.totalAmount,
      currency: order.currency,
      paymentMethod: order.paymentMethod as any,
      channel: order.channelName,
      channelId: order.processingLocationId,
      discountAmount: order.discountAmount || 0,
      taxAmount: order.taxAmount || 0,
      shippingAmount: order.shippingAmount || 0,
      items: [], // Will be populated if order has items
      itemCount: 0,
      uniqueItemCount: 0,
      externalTransactionId: order.externalOrderId,
      notes: order.notes,
      createdBy: 'migration_service',
      updatedBy: 'migration_service',
    });

    await this.customerTransactionRepository.save(transaction);
  }

  /**
   * Get migration progress for a tenant
   */
  async getMigrationProgress(tenantId: string): Promise<any> {
    const totalOrders = await this.orderRepository.count({
      where: { tenantId },
    });

    const totalCustomers = await this.customerRepository.count({
      where: { tenantId },
    });

    const totalTransactions = await this.customerTransactionRepository.count({
      where: { tenantId },
    });

    const ordersWithCustomerRef = await this.orderRepository.count({
      where: {
        tenantId,
        customerInfo: { customerId: { $ne: null } } as any,
      },
    });

    return {
      totalOrders,
      totalCustomers,
      totalTransactions,
      ordersWithCustomerRef,
      migrationCompleteness:
        totalOrders > 0 ? (ordersWithCustomerRef / totalOrders) * 100 : 0,
    };
  }

  /**
   * Rollback migration for a tenant (use with caution)
   */
  async rollbackMigration(
    tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.warn(`Rolling back customer migration for tenant ${tenantId}`);

    try {
      // Remove customer references from orders
      await this.orderRepository.update(
        { tenantId },
        {
          customerInfo: null,
          updatedBy: 'migration_rollback_service',
        },
      );

      // Delete customer transactions
      await this.customerTransactionRepository.delete({ tenantId });

      // Delete customers
      await this.customerRepository.delete({ tenantId });

      this.logger.log(`Migration rollback completed for tenant ${tenantId}`);
      return {
        success: true,
        message: 'Migration rollback completed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Migration rollback failed for tenant ${tenantId}: ${error.message}`,
      );
      return {
        success: false,
        message: `Rollback failed: ${error.message}`,
      };
    }
  }
}
