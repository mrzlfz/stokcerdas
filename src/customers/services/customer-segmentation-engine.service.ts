import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Customer, CustomerSegmentType } from '../entities/customer.entity';
import { CustomerTransaction } from '../entities/customer-transaction.entity';

/**
 * ULTRATHINK SIMPLIFIED: Customer Segmentation Engine
 * Simplified Indonesian business context segmentation
 * Reduced from 2587 lines to ~300 lines (85% reduction)
 */

export interface SimpleSegmentationResult {
  customerId: string;
  segment: CustomerSegmentType;
  segmentName: string; // Added for compatibility with consumer code
  score: number; // 0-100
  indonesianContext: {
    isRamadanShopper: boolean;
    preferredPayment: string;
    region: string;
    digitalMaturity: 'basic' | 'intermediate' | 'advanced';
  };
  recommendations: string[];
  lastUpdated: Date;
}

@Injectable()
export class CustomerSegmentationEngineService {
  private readonly logger = new Logger(CustomerSegmentationEngineService.name);

  // Simplified Indonesian business scoring
  private readonly INDONESIAN_THRESHOLDS = {
    HIGH_VALUE: 100000000, // 100M IDR
    FREQUENT_BUYER: 20000000, // 20M IDR
    SEASONAL: 5000000, // 5M IDR
    // OCCASIONAL: below 5M IDR
  };

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerTransaction)
    private readonly customerTransactionRepository: Repository<CustomerTransaction>,
  ) {}

  /**
   * ULTRATHINK: Simplified Customer Segmentation
   * Core Indonesian business logic with 85% code reduction
   */
  async performAdvancedCustomerSegmentation(
    tenantId: string,
    customerId: string,
  ): Promise<SimpleSegmentationResult> {
    try {
      this.logger.debug(
        `Performing simplified segmentation for customer ${customerId}`,
      );

      // Get customer data
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new BadRequestException(`Customer ${customerId} not found`);
      }

      // Get transaction data
      const transactions = await this.customerTransactionRepository.find({
        where: { customerId, tenantId },
        order: { transactionDate: 'DESC' },
        take: 100, // Last 100 transactions for analysis
      });

      // Calculate simple metrics
      const totalSpent = transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0,
      );
      const totalOrders = transactions.length;
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      // Determine segment based on simple rules
      const segment = this.calculateSegment(
        totalSpent,
        totalOrders,
        avgOrderValue,
      );

      // Calculate Indonesian business context
      const indonesianContext = this.analyzeIndonesianContext(
        customer,
        transactions,
      );

      // Generate simple recommendations
      const recommendations = this.generateRecommendations(
        segment,
        indonesianContext,
      );

      // Calculate overall score
      const score = this.calculateSegmentScore(
        totalSpent,
        totalOrders,
        avgOrderValue,
      );

      return {
        customerId,
        segment,
        segmentName: segment, // Added for compatibility with consumer code
        score,
        indonesianContext,
        recommendations,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error in customer segmentation: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Segmentation failed: ${error.message}`);
    }
  }

  /**
   * ULTRATHINK: Simplified Segment Calculation
   * Indonesian market segmentation with clear business rules
   */
  private calculateSegment(
    totalSpent: number,
    totalOrders: number,
    avgOrderValue: number,
  ): CustomerSegmentType {
    // High-value customers (100M+ IDR)
    if (totalSpent >= this.INDONESIAN_THRESHOLDS.HIGH_VALUE) {
      return CustomerSegmentType.HIGH_VALUE;
    }

    // Frequent buyers (20M+ IDR, 10+ orders)
    if (
      totalSpent >= this.INDONESIAN_THRESHOLDS.FREQUENT_BUYER &&
      totalOrders >= 10
    ) {
      return CustomerSegmentType.FREQUENT_BUYER;
    }

    // Seasonal customers (5M+ IDR, moderate frequency)
    if (totalSpent >= this.INDONESIAN_THRESHOLDS.SEASONAL) {
      return CustomerSegmentType.SEASONAL;
    }

    // Occasional customers (everyone else)
    return CustomerSegmentType.OCCASIONAL;
  }

  /**
   * ULTRATHINK: Simplified Indonesian Business Context Analysis
   * Focus on key Indonesian market factors
   */
  private analyzeIndonesianContext(
    customer: Customer,
    transactions: CustomerTransaction[],
  ) {
    // Detect Ramadan shopping patterns (simple heuristic)
    const ramadanMonths = [3, 4, 5]; // Approximate Ramadan months
    const ramadanTransactions = transactions.filter(t =>
      ramadanMonths.includes(t.transactionDate.getMonth() + 1),
    );
    const isRamadanShopper =
      ramadanTransactions.length > transactions.length * 0.3;

    // Determine preferred payment (simplified)
    const preferredPayment = this.getPreferredPayment(customer);

    // Get region from customer data
    const region = customer.addresses?.[0]?.city || 'Jakarta';

    // Assess digital maturity (simplified)
    const digitalMaturity = this.assessDigitalMaturity(customer, transactions);

    return {
      isRamadanShopper,
      preferredPayment,
      region,
      digitalMaturity,
    };
  }

  /**
   * ULTRATHINK: Simplified Payment Preference Analysis
   * Indonesian payment method preferences
   */
  private getPreferredPayment(customer: Customer): string {
    // Simplified logic based on customer profile
    if (customer.lifetimeValue > 50000000) {
      return 'credit_card'; // High-value customers prefer credit cards
    } else if (customer.lifetimeValue > 10000000) {
      return 'qris'; // Mid-tier customers prefer QRIS
    } else {
      return 'cash_on_delivery'; // Lower-tier customers prefer COD
    }
  }

  /**
   * ULTRATHINK: Simplified Digital Maturity Assessment
   * Indonesian digital adoption patterns
   */
  private assessDigitalMaturity(
    customer: Customer,
    transactions: CustomerTransaction[],
  ): 'basic' | 'intermediate' | 'advanced' {
    const orderCount = transactions.length;
    const avgOrderValue =
      transactions.length > 0
        ? transactions.reduce((sum, t) => sum + Number(t.amount), 0) /
          transactions.length
        : 0;

    if (orderCount > 50 && avgOrderValue > 500000) {
      return 'advanced';
    } else if (orderCount > 10 && avgOrderValue > 200000) {
      return 'intermediate';
    } else {
      return 'basic';
    }
  }

  /**
   * ULTRATHINK: Simplified Recommendation Engine
   * Indonesian market-specific recommendations
   */
  private generateRecommendations(
    segment: CustomerSegmentType,
    context: any,
  ): string[] {
    const recommendations: string[] = [];

    // Segment-based recommendations
    switch (segment) {
      case CustomerSegmentType.HIGH_VALUE:
        recommendations.push('Offer premium services');
        recommendations.push('Provide dedicated account manager');
        break;
      case CustomerSegmentType.FREQUENT_BUYER:
        recommendations.push('Introduce loyalty program');
        recommendations.push('Offer bulk purchase discounts');
        break;
      case CustomerSegmentType.SEASONAL:
        recommendations.push('Send seasonal promotions');
        recommendations.push('Offer pre-order opportunities');
        break;
      case CustomerSegmentType.OCCASIONAL:
        recommendations.push('Send re-engagement campaigns');
        recommendations.push('Offer first-time buyer discounts');
        break;
    }

    // Indonesian context-based recommendations
    if (context.isRamadanShopper) {
      recommendations.push('Target with Ramadan/Lebaran promotions');
    }

    if (context.digitalMaturity === 'basic') {
      recommendations.push('Provide customer education content');
      recommendations.push('Offer phone-based support');
    }

    if (context.preferredPayment === 'cash_on_delivery') {
      recommendations.push('Promote QRIS payment incentives');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * ULTRATHINK: Simplified Score Calculation
   * Simple scoring based on Indonesian business metrics
   */
  private calculateSegmentScore(
    totalSpent: number,
    totalOrders: number,
    avgOrderValue: number,
  ): number {
    let score = 0;

    // Spending score (40 points max)
    if (totalSpent > 100000000) score += 40;
    else if (totalSpent > 50000000) score += 30;
    else if (totalSpent > 20000000) score += 20;
    else if (totalSpent > 5000000) score += 10;

    // Frequency score (30 points max)
    if (totalOrders > 50) score += 30;
    else if (totalOrders > 20) score += 20;
    else if (totalOrders > 10) score += 15;
    else if (totalOrders > 5) score += 10;

    // Order value score (30 points max)
    if (avgOrderValue > 5000000) score += 30;
    else if (avgOrderValue > 2000000) score += 20;
    else if (avgOrderValue > 1000000) score += 15;
    else if (avgOrderValue > 500000) score += 10;

    return Math.min(100, score);
  }

  /**
   * ULTRATHINK: Simplified Batch Processing
   * Process multiple customers efficiently
   */
  async performBatchSegmentation(
    tenantId: string,
  ): Promise<SimpleSegmentationResult[]> {
    try {
      this.logger.debug(`Performing batch segmentation for tenant ${tenantId}`);

      // Get all customers for tenant
      const customers = await this.customerRepository.find({
        where: { tenantId },
        take: 1000, // Process in batches of 1000
      });

      const results: SimpleSegmentationResult[] = [];

      // Process each customer
      for (const customer of customers) {
        try {
          const result = await this.performAdvancedCustomerSegmentation(
            tenantId,
            customer.id,
          );
          results.push(result);
        } catch (error) {
          this.logger.warn(
            `Failed to segment customer ${customer.id}: ${error.message}`,
          );
        }
      }

      this.logger.debug(
        `Completed batch segmentation: ${results.length} customers processed`,
      );
      return results;
    } catch (error) {
      this.logger.error(
        `Batch segmentation failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Batch segmentation failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Automated Daily Segmentation
   * Run segmentation updates automatically
   */
  @Cron('0 2 * * *') // Run at 2 AM daily
  async scheduledSegmentationUpdate() {
    try {
      this.logger.debug('Starting scheduled segmentation update');

      // Get all tenants (simplified - you might want to get this from a tenants table)
      const tenants = await this.customerRepository
        .createQueryBuilder('customer')
        .select('DISTINCT customer.tenantId', 'tenantId')
        .getRawMany();

      for (const tenant of tenants) {
        try {
          await this.performBatchSegmentation(tenant.tenantId);
          this.logger.debug(
            `Completed segmentation for tenant ${tenant.tenantId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed segmentation for tenant ${tenant.tenantId}: ${error.message}`,
          );
        }
      }

      this.logger.debug('Completed scheduled segmentation update');
    } catch (error) {
      this.logger.error(
        `Scheduled segmentation failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
