import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Like,
  In,
  Between,
  MoreThan,
  LessThan,
  Not,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  Customer,
  CustomerStatus,
  CustomerSegmentType,
  LoyaltyTier,
} from '../entities/customer.entity';
import { CustomerTransaction } from '../entities/customer-transaction.entity';
import { Order } from '../../orders/entities/order.entity';

import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  CustomerResponseDto,
  CustomerListResponseDto,
  CustomerDetailResponseDto,
} from '../dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerTransaction)
    private readonly customerTransactionRepository: Repository<CustomerTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new customer
   */
  async create(
    tenantId: string,
    createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      this.logger.debug(`Creating customer for tenant ${tenantId}`);

      // Check for existing customer with same email or phone
      await this.validateUniqueCustomer(
        tenantId,
        createCustomerDto.email,
        createCustomerDto.phone,
      );

      // Generate customer number
      const customerNumber = await this.generateCustomerNumber(tenantId);

      // Create customer entity
      const customer = this.customerRepository.create({
        ...createCustomerDto,
        tenantId,
        customerNumber,
        dateOfBirth: createCustomerDto.dateOfBirth
          ? new Date(createCustomerDto.dateOfBirth)
          : undefined,
        createdBy: 'system', // This should come from current user context
        updatedBy: 'system',
      });

      // Set initial analytics
      this.setInitialAnalytics(customer);

      const savedCustomer = await this.customerRepository.save(customer);

      // Emit customer created event
      this.eventEmitter.emit('customer.created', {
        tenantId,
        customerId: savedCustomer.id,
        customer: savedCustomer,
      });

      this.logger.log(
        `Customer created successfully: ${savedCustomer.customerNumber}`,
      );

      return this.mapToResponseDto(savedCustomer);
    } catch (error) {
      this.logger.error(
        `Failed to create customer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find customers with pagination and filtering
   */
  async findAll(
    tenantId: string,
    query: CustomerQueryDto,
  ): Promise<CustomerListResponseDto> {
    try {
      this.logger.debug(
        `Finding customers for tenant ${tenantId} with query:`,
        query,
      );

      const queryBuilder = this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.tenantId = :tenantId', { tenantId });

      // Apply filters
      this.applyFilters(queryBuilder, query);

      // Apply search
      if (query.search) {
        queryBuilder.andWhere(
          '(customer.fullName ILIKE :search OR customer.email ILIKE :search OR customer.phone ILIKE :search OR customer.customerNumber ILIKE :search)',
          { search: `%${query.search}%` },
        );
      }

      // Apply sorting
      const sortField = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'DESC';
      queryBuilder.orderBy(`customer.${sortField}`, sortOrder);

      // Apply pagination
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      // Execute query
      const [customers, total] = await queryBuilder.getManyAndCount();

      // Calculate summary statistics
      const summary = await this.calculateSummaryStatistics(tenantId, query);

      const response: CustomerListResponseDto = {
        data: customers.map(customer =>
          this.mapToResponseDto(customer, query.includeAnalytics),
        ),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        summary,
      };

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to find customers: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to find customers: ${error.message}`,
      );
    }
  }

  /**
   * Find a single customer by ID
   */
  async findOne(
    tenantId: string,
    id: string,
  ): Promise<CustomerDetailResponseDto> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer not found with ID: ${id}`);
      }

      return this.mapToDetailResponseDto(customer);
    } catch (error) {
      this.logger.error(
        `Failed to find customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find customer by customer number
   */
  async findByCustomerNumber(
    tenantId: string,
    customerNumber: string,
  ): Promise<CustomerResponseDto> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { customerNumber, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(
          `Customer not found with number: ${customerNumber}`,
        );
      }

      return this.mapToResponseDto(customer, true);
    } catch (error) {
      this.logger.error(
        `Failed to find customer by number ${customerNumber}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a customer
   */
  async update(
    tenantId: string,
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      this.logger.debug(`Updating customer ${id} for tenant ${tenantId}`);

      const customer = await this.customerRepository.findOne({
        where: { id, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer not found with ID: ${id}`);
      }

      // Check for unique constraints if email or phone is being updated
      if (
        updateCustomerDto.email &&
        updateCustomerDto.email !== customer.email
      ) {
        await this.validateUniqueEmail(tenantId, updateCustomerDto.email, id);
      }

      if (
        updateCustomerDto.phone &&
        updateCustomerDto.phone !== customer.phone
      ) {
        await this.validateUniquePhone(tenantId, updateCustomerDto.phone, id);
      }

      // Update customer properties
      Object.assign(customer, updateCustomerDto);

      // Update specific analytics if provided
      if (updateCustomerDto.analytics) {
        this.updateCustomerAnalytics(customer, updateCustomerDto.analytics);
      }

      // Update support data if provided
      if (updateCustomerDto.support) {
        Object.assign(customer, updateCustomerDto.support);
      }

      // Update loyalty data if provided
      if (updateCustomerDto.loyalty) {
        Object.assign(customer, updateCustomerDto.loyalty);
      }

      // Update purchase behavior if provided
      if (updateCustomerDto.purchaseBehavior) {
        customer.purchaseBehavior = {
          ...customer.purchaseBehavior,
          ...updateCustomerDto.purchaseBehavior,
        };
      }

      // Update date fields
      if (updateCustomerDto.dateOfBirth) {
        customer.dateOfBirth = new Date(updateCustomerDto.dateOfBirth);
      }

      if (updateCustomerDto.lastLoginAt) {
        customer.lastLoginAt = new Date(updateCustomerDto.lastLoginAt);
      }

      if (updateCustomerDto.emailVerifiedAt) {
        customer.emailVerifiedAt = new Date(updateCustomerDto.emailVerifiedAt);
      }

      if (updateCustomerDto.phoneVerifiedAt) {
        customer.phoneVerifiedAt = new Date(updateCustomerDto.phoneVerifiedAt);
      }

      customer.updatedBy = 'system'; // This should come from current user context

      // Recalculate derived fields
      customer.updateSegment();
      customer.updateLoyaltyTier();

      const updatedCustomer = await this.customerRepository.save(customer);

      // Emit customer updated event
      this.eventEmitter.emit('customer.updated', {
        tenantId,
        customerId: updatedCustomer.id,
        customer: updatedCustomer,
        changes: updateCustomerDto,
      });

      this.logger.log(
        `Customer updated successfully: ${updatedCustomer.customerNumber}`,
      );

      return this.mapToResponseDto(updatedCustomer, true);
    } catch (error) {
      this.logger.error(
        `Failed to update customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a customer (soft delete)
   */
  async remove(tenantId: string, id: string): Promise<void> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer not found with ID: ${id}`);
      }

      // Soft delete by updating status
      customer.status = CustomerStatus.INACTIVE;
      customer.updatedBy = 'system'; // This should come from current user context

      await this.customerRepository.save(customer);

      // Emit customer deleted event
      this.eventEmitter.emit('customer.deleted', {
        tenantId,
        customerId: id,
        customer,
      });

      this.logger.log(`Customer soft deleted: ${customer.customerNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete customer ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update customer analytics from order data
   */
  async updateCustomerAnalyticsFromOrder(
    tenantId: string,
    customerId: string,
    orderData: any,
  ): Promise<void> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        this.logger.warn(
          `Customer not found for analytics update: ${customerId}`,
        );
        return;
      }

      // Calculate analytics from order data
      customer.updateAnalytics(orderData);

      await this.customerRepository.save(customer);

      this.logger.debug(
        `Customer analytics updated for: ${customer.customerNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update customer analytics: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create customer from order data if not exists
   */
  async createCustomerFromOrder(
    tenantId: string,
    orderData: any,
  ): Promise<Customer> {
    try {
      // Check if customer already exists
      const customer = await this.findExistingCustomer(
        tenantId,
        orderData.customerEmail,
        orderData.customerPhone,
      );

      if (customer) {
        return customer;
      }

      // Create new customer from order data
      const createCustomerDto: CreateCustomerDto = {
        fullName: orderData.customerName,
        email: orderData.customerEmail,
        phone: orderData.customerPhone,
        segment: CustomerSegmentType.NEW_CUSTOMER,
        loyaltyTier: LoyaltyTier.BRONZE,
      };

      // Extract address from order if available
      if (orderData.shippingAddress) {
        createCustomerDto.addresses = [
          {
            id: 'default',
            type: 'shipping',
            isDefault: true,
            name: orderData.shippingAddress.name || orderData.customerName,
            address: orderData.shippingAddress.address || '',
            city: orderData.shippingAddress.city || '',
            state: orderData.shippingAddress.state || '',
            postalCode: orderData.shippingAddress.postalCode || '',
            country: orderData.shippingAddress.country || 'Indonesia',
            phone: orderData.shippingAddress.phone,
          },
        ];
      }

      const customerResponse = await this.create(tenantId, createCustomerDto);
      return await this.customerRepository.findOne({
        where: { id: customerResponse.id, tenantId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create customer from order: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get customer analytics summary
   */
  async getCustomerAnalytics(
    tenantId: string,
    customerId: string,
  ): Promise<any> {
    try {
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(
          `Customer not found with ID: ${customerId}`,
        );
      }

      // Get detailed analytics from transactions
      const transactions = await this.customerTransactionRepository.find({
        where: { customerId, tenantId },
        order: { transactionDate: 'DESC' },
        take: 100, // Last 100 transactions
      });

      return {
        customer: this.mapToDetailResponseDto(customer),
        recentTransactions: transactions,
        analytics: {
          totalTransactions: transactions.length,
          averageTransactionValue:
            transactions.reduce((sum, t) => sum + t.totalAmount, 0) /
              transactions.length || 0,
          mostFrequentChannel: this.getMostFrequentChannel(transactions),
          preferredPaymentMethod: this.getPreferredPaymentMethod(transactions),
          purchasePatterns: this.analyzePurchasePatterns(transactions),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer analytics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private async validateUniqueCustomer(
    tenantId: string,
    email?: string,
    phone?: string,
    excludeId?: string,
  ): Promise<void> {
    if (email) {
      await this.validateUniqueEmail(tenantId, email, excludeId);
    }
    if (phone) {
      await this.validateUniquePhone(tenantId, phone, excludeId);
    }
  }

  private async validateUniqueEmail(
    tenantId: string,
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Customer> = { tenantId, email };
    if (excludeId) {
      where.id = Not(excludeId) as any;
    }

    const existingCustomer = await this.customerRepository.findOne({ where });
    if (existingCustomer) {
      throw new ConflictException(
        `Customer with email ${email} already exists`,
      );
    }
  }

  private async validateUniquePhone(
    tenantId: string,
    phone: string,
    excludeId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Customer> = { tenantId, phone };
    if (excludeId) {
      where.id = Not(excludeId) as any;
    }

    const existingCustomer = await this.customerRepository.findOne({ where });
    if (existingCustomer) {
      throw new ConflictException(
        `Customer with phone ${phone} already exists`,
      );
    }
  }

  private async generateCustomerNumber(tenantId: string): Promise<string> {
    const count = await this.customerRepository.count({ where: { tenantId } });
    const prefix = 'CUST';
    const number = (count + 1).toString().padStart(6, '0');
    return `${prefix}${number}`;
  }

  private setInitialAnalytics(customer: Customer): void {
    customer.lifetimeValue = 0;
    customer.predictedLifetimeValue = 0;
    customer.averageOrderValue = 0;
    customer.totalOrders = 0;
    customer.totalSpent = 0;
    customer.averageOrderFrequency = 0;
    customer.daysSinceLastOrder = 0;
    customer.churnProbability = 0;
    customer.retentionScore = 100; // New customers start with high retention score
    customer.supportTicketsCount = 0;
    customer.averageSatisfactionRating = 0;
    customer.complaintsCount = 0;
    customer.returnsCount = 0;
    customer.totalReturnsValue = 0;
    customer.loyaltyPoints = 0;
    customer.referralsCount = 0;
    customer.referralValue = 0;
    customer.creditScore = 50; // Default credit score
    customer.isHighRisk = false;
  }

  private updateCustomerAnalytics(customer: Customer, analytics: any): void {
    if (analytics.lifetimeValue !== undefined)
      customer.lifetimeValue = analytics.lifetimeValue;
    if (analytics.predictedLifetimeValue !== undefined)
      customer.predictedLifetimeValue = analytics.predictedLifetimeValue;
    if (analytics.averageOrderValue !== undefined)
      customer.averageOrderValue = analytics.averageOrderValue;
    if (analytics.totalOrders !== undefined)
      customer.totalOrders = analytics.totalOrders;
    if (analytics.totalSpent !== undefined)
      customer.totalSpent = analytics.totalSpent;
    if (analytics.averageOrderFrequency !== undefined)
      customer.averageOrderFrequency = analytics.averageOrderFrequency;
    if (analytics.daysSinceLastOrder !== undefined)
      customer.daysSinceLastOrder = analytics.daysSinceLastOrder;
    if (analytics.churnProbability !== undefined)
      customer.churnProbability = analytics.churnProbability;
    if (analytics.retentionScore !== undefined)
      customer.retentionScore = analytics.retentionScore;

    if (analytics.firstOrderDate)
      customer.firstOrderDate = new Date(analytics.firstOrderDate);
    if (analytics.lastOrderDate)
      customer.lastOrderDate = new Date(analytics.lastOrderDate);
  }

  private applyFilters(queryBuilder: any, query: CustomerQueryDto): void {
    // Status filter
    if (query.status?.length) {
      queryBuilder.andWhere('customer.status IN (:...status)', {
        status: query.status,
      });
    }

    // Customer type filter
    if (query.customerType?.length) {
      queryBuilder.andWhere('customer.customerType IN (:...customerType)', {
        customerType: query.customerType,
      });
    }

    // Segment filter
    if (query.segment?.length) {
      queryBuilder.andWhere('customer.segment IN (:...segment)', {
        segment: query.segment,
      });
    }

    // Loyalty tier filter
    if (query.loyaltyTier?.length) {
      queryBuilder.andWhere('customer.loyaltyTier IN (:...loyaltyTier)', {
        loyaltyTier: query.loyaltyTier,
      });
    }

    // Date range filters
    if (query.createdAfter) {
      queryBuilder.andWhere('customer.createdAt >= :createdAfter', {
        createdAfter: query.createdAfter,
      });
    }

    if (query.createdBefore) {
      queryBuilder.andWhere('customer.createdAt <= :createdBefore', {
        createdBefore: query.createdBefore,
      });
    }

    // Numeric range filters
    if (query.minLifetimeValue !== undefined) {
      queryBuilder.andWhere('customer.lifetimeValue >= :minLifetimeValue', {
        minLifetimeValue: query.minLifetimeValue,
      });
    }

    if (query.maxLifetimeValue !== undefined) {
      queryBuilder.andWhere('customer.lifetimeValue <= :maxLifetimeValue', {
        maxLifetimeValue: query.maxLifetimeValue,
      });
    }

    // Boolean filters
    if (query.isHighValue !== undefined) {
      if (query.isHighValue) {
        queryBuilder.andWhere(
          '(customer.segment = :highValueSegment OR customer.lifetimeValue > :highValueThreshold)',
          {
            highValueSegment: CustomerSegmentType.HIGH_VALUE,
            highValueThreshold: 10000000, // 10M IDR
          },
        );
      }
    }

    if (query.isAtRisk !== undefined && query.isAtRisk) {
      queryBuilder.andWhere('customer.churnProbability > :atRiskThreshold', {
        atRiskThreshold: 70,
      });
    }

    // Tags filter
    if (query.tags?.length) {
      queryBuilder.andWhere('customer.tags && :tags', { tags: query.tags });
    }
  }

  private async calculateSummaryStatistics(
    tenantId: string,
    query: CustomerQueryDto,
  ): Promise<any> {
    const baseQuery = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.tenantId = :tenantId', { tenantId });

    // Apply same filters for summary calculation
    this.applyFilters(baseQuery, query);

    const [
      totalCustomers,
      activeCustomers,
      highValueCustomers,
      atRiskCustomers,
      avgLTV,
      avgAOV,
      avgRetention,
    ] = await Promise.all([
      baseQuery.getCount(),
      baseQuery
        .clone()
        .andWhere('customer.status = :status', {
          status: CustomerStatus.ACTIVE,
        })
        .getCount(),
      baseQuery
        .clone()
        .andWhere(
          '(customer.segment = :segment OR customer.lifetimeValue > :threshold)',
          {
            segment: CustomerSegmentType.HIGH_VALUE,
            threshold: 10000000,
          },
        )
        .getCount(),
      baseQuery
        .clone()
        .andWhere('customer.churnProbability > :threshold', { threshold: 70 })
        .getCount(),
      baseQuery
        .clone()
        .select('AVG(customer.lifetimeValue)', 'avg')
        .getRawOne(),
      baseQuery
        .clone()
        .select('AVG(customer.averageOrderValue)', 'avg')
        .getRawOne(),
      baseQuery
        .clone()
        .select('AVG(customer.retentionScore)', 'avg')
        .getRawOne(),
    ]);

    // Get segment distribution
    const segmentCounts = await baseQuery
      .clone()
      .select(['customer.segment', 'COUNT(*) as count'])
      .groupBy('customer.segment')
      .getRawMany();

    const topSegments = segmentCounts.map(item => ({
      segment: item.customer_segment,
      count: parseInt(item.count),
      percentage:
        totalCustomers > 0 ? (parseInt(item.count) / totalCustomers) * 100 : 0,
    }));

    // Get loyalty tier distribution
    const tierCounts = await baseQuery
      .clone()
      .select(['customer.loyaltyTier', 'COUNT(*) as count'])
      .groupBy('customer.loyaltyTier')
      .getRawMany();

    const topLoyaltyTiers = tierCounts.map(item => ({
      tier: item.customer_loyaltyTier,
      count: parseInt(item.count),
      percentage:
        totalCustomers > 0 ? (parseInt(item.count) / totalCustomers) * 100 : 0,
    }));

    return {
      totalCustomers,
      activeCustomers,
      highValueCustomers,
      atRiskCustomers,
      averageLifetimeValue: parseFloat(avgLTV?.avg || '0'),
      averageOrderValue: parseFloat(avgAOV?.avg || '0'),
      averageRetentionScore: parseFloat(avgRetention?.avg || '0'),
      topSegments,
      topLoyaltyTiers,
    };
  }

  private async findExistingCustomer(
    tenantId: string,
    email?: string,
    phone?: string,
  ): Promise<Customer | null> {
    if (!email && !phone) return null;

    const where: FindOptionsWhere<Customer>[] = [];

    if (email) {
      where.push({ tenantId, email });
    }

    if (phone) {
      where.push({ tenantId, phone });
    }

    return await this.customerRepository.findOne({ where });
  }

  private getMostFrequentChannel(transactions: CustomerTransaction[]): string {
    const channelCounts = transactions.reduce((acc, t) => {
      const channel = t.channel || 'unknown';
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      Object.entries(channelCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'unknown'
    );
  }

  private getPreferredPaymentMethod(
    transactions: CustomerTransaction[],
  ): string {
    const paymentCounts = transactions.reduce((acc, t) => {
      const method = t.paymentMethod || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      Object.entries(paymentCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'unknown'
    );
  }

  private analyzePurchasePatterns(transactions: CustomerTransaction[]): any {
    const patterns = {
      mostActiveHour: 0,
      mostActiveDay: 'monday',
      averageTimeBetweenPurchases: 0,
      seasonalTrends: {},
    };

    if (transactions.length === 0) return patterns;

    // Analyze hour patterns
    const hourCounts = transactions.reduce((acc, t) => {
      const hour = new Date(t.transactionDate).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    patterns.mostActiveHour = parseInt(
      Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '0',
    );

    // Analyze day patterns
    const dayCounts = transactions.reduce((acc, t) => {
      const day = t.dayOfWeek || 'unknown';
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    patterns.mostActiveDay =
      Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'unknown';

    return patterns;
  }

  private mapToResponseDto(
    customer: Customer,
    includeAnalytics = false,
  ): CustomerResponseDto {
    const dto: CustomerResponseDto = {
      id: customer.id,
      tenantId: customer.tenantId,
      customerNumber: customer.customerNumber,
      fullName: customer.fullName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      dateOfBirth: customer.dateOfBirth?.toISOString(),
      customerType: customer.customerType,
      status: customer.status,
      companyName: customer.companyName,
      taxId: customer.taxId,
      industry: customer.industry,
      businessSize: customer.businessSize,
      addresses: customer.addresses,
      segment: customer.segment,
      loyaltyTier: customer.loyaltyTier,
      preferences: customer.preferences,
      purchaseBehavior: customer.purchaseBehavior,
      socialProfiles: customer.socialProfiles,
      externalIds: customer.externalIds,
      riskAssessment: {
        creditScore: customer.creditScore,
        isHighRisk: customer.isHighRisk,
        riskFactors: customer.riskFactors,
      },
      tags: customer.tags,
      notes: customer.notes,
      assignedSalesRepId: customer.assignedSalesRepId,
      accountManagerId: customer.accountManagerId,
      isEmailVerified: customer.isEmailVerified,
      isPhoneVerified: customer.isPhoneVerified,
      lastLoginAt: customer.lastLoginAt?.toISOString(),
      emailVerifiedAt: customer.emailVerifiedAt?.toISOString(),
      phoneVerifiedAt: customer.phoneVerifiedAt?.toISOString(),
      fullAddress: customer.fullAddress,
      isActive: customer.isActive,
      isHighValue: customer.isHighValue,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };

    if (includeAnalytics) {
      dto.analytics = {
        lifetimeValue: customer.lifetimeValue,
        predictedLifetimeValue: customer.predictedLifetimeValue,
        averageOrderValue: customer.averageOrderValue,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        averageOrderFrequency: customer.averageOrderFrequency,
        firstOrderDate: customer.firstOrderDate?.toISOString(),
        lastOrderDate: customer.lastOrderDate?.toISOString(),
        daysSinceLastOrder: customer.daysSinceLastOrder,
        churnProbability: customer.churnProbability,
        retentionScore: customer.retentionScore,
        lifecycleStage: customer.customerLifecycleStage,
        daysSinceFirstOrder: customer.daysSinceFirstOrder,
        recentOrderFrequency: customer.recentOrderFrequency,
      };
    }

    return dto;
  }

  private mapToDetailResponseDto(
    customer: Customer,
  ): CustomerDetailResponseDto {
    const baseDto = this.mapToResponseDto(
      customer,
      true,
    ) as CustomerDetailResponseDto;

    // Add detailed information
    baseDto.support = {
      supportTicketsCount: customer.supportTicketsCount,
      averageSatisfactionRating: customer.averageSatisfactionRating,
      complaintsCount: customer.complaintsCount,
      returnsCount: customer.returnsCount,
      totalReturnsValue: customer.totalReturnsValue,
    };

    baseDto.loyalty = {
      loyaltyPoints: customer.loyaltyPoints,
      referralsCount: customer.referralsCount,
      referralValue: customer.referralValue,
      referredBy: customer.referredBy,
    };

    baseDto.communicationHistory = customer.communicationHistory || [];
    baseDto.marketingCampaigns = customer.marketingCampaigns || [];
    baseDto.customFields = customer.customFields;

    return baseDto;
  }
}
