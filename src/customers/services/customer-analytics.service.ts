import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Customer } from '../entities/customer.entity';
import { CustomerTransaction } from '../entities/customer-transaction.entity';

export interface CustomerAnalyticsSummary {
  customerId: string;
  tenantId: string;
  customerNumber: string;
  fullName: string;
  email?: string;
  segment: string;
  loyaltyTier: string;
  status: string;
  customerSince: Date;

  // Transaction Analytics
  totalTransactions: number;
  totalSpent: number;
  averageOrderValue: number;
  lastTransactionDate?: Date;
  firstTransactionDate?: Date;

  // Time-based Analytics
  daysSinceLastTransaction: number;
  daysSinceFirstTransaction: number;
  monthlyTransactionFrequency: number;

  // Channel Analytics
  primaryChannel?: string;
  channelCount: number;

  // Product Analytics
  productCategories: string[];
  uniqueProductsPurchased: number;

  // Payment Analytics
  primaryPaymentMethod?: string;
  paymentMethodsUsed: number;

  // Behavioral Analytics
  peakShoppingHour: number;
  peakShoppingDay: string;
  weekendTransactionRatio: number;

  // Value Analytics
  valueSegment: 'high_value' | 'medium_value' | 'standard_value';
  churnRiskScore: number;

  lastUpdated: Date;
}

export interface CustomerCohortAnalysis {
  tenantId: string;
  cohortMonth: Date;
  cohortSize: number;

  // Retention rates
  month0Active: number;
  month1Active: number;
  month2Active: number;
  month3Active: number;
  month6Active: number;
  month12Active: number;

  // Revenue per cohort month
  month0Revenue: number;
  month1Revenue: number;
  month2Revenue: number;
  month3Revenue: number;
  month6Revenue: number;
  month12Revenue: number;

  // Calculated retention percentages
  month1RetentionRate: number;
  month3RetentionRate: number;
  month6RetentionRate: number;
  month12RetentionRate: number;

  lastUpdated: Date;
}

export interface CustomerProductAffinity {
  tenantId: string;
  customerId: string;
  category: string;
  purchaseCount: number;
  totalSpentCategory: number;
  avgOrderValueCategory: number;
  lastPurchaseDate: Date;
  firstPurchaseDate: Date;
  monthlyPurchaseFrequency: number;
  categoryShareOfWallet: number;
  lastUpdated: Date;
}

export interface DailyCustomerMetrics {
  tenantId: string;
  customerId: string;
  transactionDate: Date;
  transactionCount: number;
  dailyTotal: number;
  dailyAvgOrderValue: number;
  dailyMaxOrder: number;
  dailyMinOrder: number;
  totalQuantity: number;
  uniqueProducts: number;
  categoriesPurchased: string[];
  channelsUsed: number;
  channels: string[];
  paymentMethodsUsed: number;
  paymentMethods: string[];
  totalDiscounts: number;
  avgProfitMargin: number;
  totalCogs: number;
  shoppingHours: number[];
  includedWeekend: boolean;
  includedHoliday: boolean;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  lastUpdated: Date;
}

export interface CustomerInsightsQuery {
  customerId?: string;
  segment?: string[];
  valueSegment?: string[];
  churnRiskMin?: number;
  churnRiskMax?: number;
  transactionFrequencyMin?: number;
  daysSinceLastTransactionMax?: number;
  totalSpentMin?: number;
  totalSpentMax?: number;
  primaryChannel?: string[];
  lastTransactionAfter?: Date;
  lastTransactionBefore?: Date;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerTransaction)
    private readonly customerTransactionRepository: Repository<CustomerTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get customer analytics summary for a specific customer
   */
  async getCustomerAnalyticsSummary(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerAnalyticsSummary> {
    const query = `
      SELECT 
        customer_id as "customerId",
        tenant_id as "tenantId",
        customer_number as "customerNumber",
        full_name as "fullName",
        email,
        segment,
        loyalty_tier as "loyaltyTier",
        status,
        customer_since as "customerSince",
        total_transactions as "totalTransactions",
        total_spent as "totalSpent",
        average_order_value as "averageOrderValue",
        last_transaction_date as "lastTransactionDate",
        first_transaction_date as "firstTransactionDate",
        days_since_last_transaction as "daysSinceLastTransaction",
        days_since_first_transaction as "daysSinceFirstTransaction",
        monthly_transaction_frequency as "monthlyTransactionFrequency",
        primary_channel as "primaryChannel",
        channel_count as "channelCount",
        product_categories as "productCategories",
        unique_products_purchased as "uniqueProductsPurchased",
        primary_payment_method as "primaryPaymentMethod",
        payment_methods_used as "paymentMethodsUsed",
        peak_shopping_hour as "peakShoppingHour",
        peak_shopping_day as "peakShoppingDay",
        weekend_transaction_ratio as "weekendTransactionRatio",
        value_segment as "valueSegment",
        churn_risk_score as "churnRiskScore",
        last_updated as "lastUpdated"
      FROM customer_analytics_summary
      WHERE customer_id = $1 AND tenant_id = $2
    `;

    const result = await this.dataSource.query(query, [customerId, tenantId]);

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Customer analytics not found for customer ${customerId}`,
      );
    }

    return result[0];
  }

  /**
   * Get paginated customer analytics summaries with filtering
   */
  async getCustomerAnalyticsList(
    tenantId: string,
    query: CustomerInsightsQuery,
  ): Promise<{
    data: CustomerAnalyticsSummary[];
    total: number;
    summary: {
      totalCustomers: number;
      highValueCustomers: number;
      atRiskCustomers: number;
      avgLifetimeValue: number;
      avgMonthlyFrequency: number;
      topChannels: Array<{ channel: string; count: number }>;
      topSegments: Array<{ segment: string; count: number }>;
    };
  }> {
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const sortBy = query.sortBy || 'totalSpent';
    const sortOrder = query.sortOrder || 'DESC';

    // Build WHERE conditions
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (query.customerId) {
      conditions.push(`customer_id = $${paramIndex}`);
      params.push(query.customerId);
      paramIndex++;
    }

    if (query.segment?.length) {
      conditions.push(`segment = ANY($${paramIndex})`);
      params.push(query.segment);
      paramIndex++;
    }

    if (query.valueSegment?.length) {
      conditions.push(`value_segment = ANY($${paramIndex})`);
      params.push(query.valueSegment);
      paramIndex++;
    }

    if (query.churnRiskMin !== undefined) {
      conditions.push(`churn_risk_score >= $${paramIndex}`);
      params.push(query.churnRiskMin);
      paramIndex++;
    }

    if (query.churnRiskMax !== undefined) {
      conditions.push(`churn_risk_score <= $${paramIndex}`);
      params.push(query.churnRiskMax);
      paramIndex++;
    }

    if (query.transactionFrequencyMin !== undefined) {
      conditions.push(`monthly_transaction_frequency >= $${paramIndex}`);
      params.push(query.transactionFrequencyMin);
      paramIndex++;
    }

    if (query.daysSinceLastTransactionMax !== undefined) {
      conditions.push(`days_since_last_transaction <= $${paramIndex}`);
      params.push(query.daysSinceLastTransactionMax);
      paramIndex++;
    }

    if (query.totalSpentMin !== undefined) {
      conditions.push(`total_spent >= $${paramIndex}`);
      params.push(query.totalSpentMin);
      paramIndex++;
    }

    if (query.totalSpentMax !== undefined) {
      conditions.push(`total_spent <= $${paramIndex}`);
      params.push(query.totalSpentMax);
      paramIndex++;
    }

    if (query.primaryChannel?.length) {
      conditions.push(`primary_channel = ANY($${paramIndex})`);
      params.push(query.primaryChannel);
      paramIndex++;
    }

    if (query.lastTransactionAfter) {
      conditions.push(`last_transaction_date >= $${paramIndex}`);
      params.push(query.lastTransactionAfter);
      paramIndex++;
    }

    if (query.lastTransactionBefore) {
      conditions.push(`last_transaction_date <= $${paramIndex}`);
      params.push(query.lastTransactionBefore);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main data query
    const dataQuery = `
      SELECT 
        customer_id as "customerId",
        tenant_id as "tenantId",
        customer_number as "customerNumber",
        full_name as "fullName",
        email,
        segment,
        loyalty_tier as "loyaltyTier",
        status,
        customer_since as "customerSince",
        total_transactions as "totalTransactions",
        total_spent as "totalSpent",
        average_order_value as "averageOrderValue",
        last_transaction_date as "lastTransactionDate",
        first_transaction_date as "firstTransactionDate",
        days_since_last_transaction as "daysSinceLastTransaction",
        days_since_first_transaction as "daysSinceFirstTransaction",
        monthly_transaction_frequency as "monthlyTransactionFrequency",
        primary_channel as "primaryChannel",
        channel_count as "channelCount",
        product_categories as "productCategories",
        unique_products_purchased as "uniqueProductsPurchased",
        primary_payment_method as "primaryPaymentMethod",
        payment_methods_used as "paymentMethodsUsed",
        peak_shopping_hour as "peakShoppingHour",
        peak_shopping_day as "peakShoppingDay",
        weekend_transaction_ratio as "weekendTransactionRatio",
        value_segment as "valueSegment",
        churn_risk_score as "churnRiskScore",
        last_updated as "lastUpdated"
      FROM customer_analytics_summary
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_analytics_summary
      ${whereClause}
    `;

    // Summary query
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE value_segment = 'high_value') as high_value_customers,
        COUNT(*) FILTER (WHERE churn_risk_score >= 70) as at_risk_customers,
        AVG(total_spent) as avg_lifetime_value,
        AVG(monthly_transaction_frequency) as avg_monthly_frequency
      FROM customer_analytics_summary
      ${whereClause}
    `;

    // Top channels query
    const channelsQuery = `
      SELECT 
        primary_channel as channel,
        COUNT(*) as count
      FROM customer_analytics_summary
      ${whereClause}
      AND primary_channel IS NOT NULL
      GROUP BY primary_channel
      ORDER BY count DESC
      LIMIT 5
    `;

    // Top segments query
    const segmentsQuery = `
      SELECT 
        segment,
        COUNT(*) as count
      FROM customer_analytics_summary
      ${whereClause}
      GROUP BY segment
      ORDER BY count DESC
      LIMIT 5
    `;

    params.push(limit, offset);

    // Execute all queries in parallel
    const [data, countResult, summaryResult, channelsResult, segmentsResult] =
      await Promise.all([
        this.dataSource.query(dataQuery, params),
        this.dataSource.query(countQuery, params.slice(0, -2)), // Remove limit/offset
        this.dataSource.query(summaryQuery, params.slice(0, -2)),
        this.dataSource.query(channelsQuery, params.slice(0, -2)),
        this.dataSource.query(segmentsQuery, params.slice(0, -2)),
      ]);

    return {
      data,
      total: parseInt(countResult[0]?.total || '0'),
      summary: {
        totalCustomers: parseInt(summaryResult[0]?.total_customers || '0'),
        highValueCustomers: parseInt(
          summaryResult[0]?.high_value_customers || '0',
        ),
        atRiskCustomers: parseInt(summaryResult[0]?.at_risk_customers || '0'),
        avgLifetimeValue: parseFloat(
          summaryResult[0]?.avg_lifetime_value || '0',
        ),
        avgMonthlyFrequency: parseFloat(
          summaryResult[0]?.avg_monthly_frequency || '0',
        ),
        topChannels: channelsResult.map((r: any) => ({
          channel: r.channel,
          count: parseInt(r.count),
        })),
        topSegments: segmentsResult.map((r: any) => ({
          segment: r.segment,
          count: parseInt(r.count),
        })),
      },
    };
  }

  /**
   * Get customer cohort analysis
   */
  async getCustomerCohortAnalysis(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CustomerCohortAnalysis[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`cohort_month >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`cohort_month <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        tenant_id as "tenantId",
        cohort_month as "cohortMonth",
        cohort_size as "cohortSize",
        month_0_active as "month0Active",
        month_1_active as "month1Active",
        month_2_active as "month2Active",
        month_3_active as "month3Active",
        month_6_active as "month6Active",
        month_12_active as "month12Active",
        month_0_revenue as "month0Revenue",
        month_1_revenue as "month1Revenue",
        month_2_revenue as "month2Revenue",
        month_3_revenue as "month3Revenue",
        month_6_revenue as "month6Revenue",
        month_12_revenue as "month12Revenue",
        CASE WHEN month_0_active > 0 THEN (month_1_active::DECIMAL / month_0_active * 100) ELSE 0 END as "month1RetentionRate",
        CASE WHEN month_0_active > 0 THEN (month_3_active::DECIMAL / month_0_active * 100) ELSE 0 END as "month3RetentionRate",
        CASE WHEN month_0_active > 0 THEN (month_6_active::DECIMAL / month_0_active * 100) ELSE 0 END as "month6RetentionRate",
        CASE WHEN month_0_active > 0 THEN (month_12_active::DECIMAL / month_0_active * 100) ELSE 0 END as "month12RetentionRate",
        last_updated as "lastUpdated"
      FROM customer_cohort_analysis
      WHERE ${whereClause}
      ORDER BY cohort_month DESC
    `;

    return await this.dataSource.query(query, params);
  }

  /**
   * Get customer product affinity analysis
   */
  async getCustomerProductAffinity(
    tenantId: string,
    customerId?: string,
    topCategories?: number,
  ): Promise<CustomerProductAffinity[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (customerId) {
      conditions.push(`customer_id = $${paramIndex}`);
      params.push(customerId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limitClause = topCategories ? `LIMIT ${topCategories}` : '';

    const query = `
      SELECT 
        tenant_id as "tenantId",
        customer_id as "customerId",
        category,
        purchase_count as "purchaseCount",
        total_spent_category as "totalSpentCategory",
        avg_order_value_category as "avgOrderValueCategory",
        last_purchase_date as "lastPurchaseDate",
        first_purchase_date as "firstPurchaseDate",
        monthly_purchase_frequency as "monthlyPurchaseFrequency",
        category_share_of_wallet as "categoryShareOfWallet",
        last_updated as "lastUpdated"
      FROM customer_product_affinity
      WHERE ${whereClause}
      ORDER BY total_spent_category DESC
      ${limitClause}
    `;

    return await this.dataSource.query(query, params);
  }

  /**
   * Get daily customer metrics
   */
  async getDailyCustomerMetrics(
    tenantId: string,
    customerId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<DailyCustomerMetrics[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (customerId) {
      conditions.push(`customer_id = $${paramIndex}`);
      params.push(customerId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`transaction_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`transaction_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        tenant_id as "tenantId",
        customer_id as "customerId",
        transaction_date as "transactionDate",
        transaction_count as "transactionCount",
        daily_total as "dailyTotal",
        daily_avg_order_value as "dailyAvgOrderValue",
        daily_max_order as "dailyMaxOrder",
        daily_min_order as "dailyMinOrder",
        total_quantity as "totalQuantity",
        unique_products as "uniqueProducts",
        categories_purchased as "categoriesPurchased",
        channels_used as "channelsUsed",
        channels,
        payment_methods_used as "paymentMethodsUsed",
        payment_methods as "paymentMethods",
        total_discounts as "totalDiscounts",
        avg_profit_margin as "avgProfitMargin",
        total_cogs as "totalCogs",
        shopping_hours as "shoppingHours",
        included_weekend as "includedWeekend",
        included_holiday as "includedHoliday",
        loyalty_points_earned as "loyaltyPointsEarned",
        loyalty_points_redeemed as "loyaltyPointsRedeemed",
        last_updated as "lastUpdated"
      FROM customer_transaction_daily_summary
      WHERE ${whereClause}
      ORDER BY transaction_date DESC
    `;

    return await this.dataSource.query(query, params);
  }

  /**
   * Refresh customer analytics materialized views
   */
  async refreshAnalyticsViews(): Promise<{
    success: boolean;
    message: string;
    refreshedViews: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const refreshedViews: string[] = [];

    try {
      this.logger.log('Starting customer analytics views refresh');

      await this.dataSource.query('SELECT refresh_customer_analytics()');

      refreshedViews.push(
        'customer_analytics_summary',
        'customer_transaction_daily_summary',
        'customer_cohort_analysis',
        'customer_product_affinity',
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Customer analytics views refreshed successfully in ${duration}ms`,
      );

      return {
        success: true,
        message: 'Analytics views refreshed successfully',
        refreshedViews,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to refresh analytics views: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        message: `Refresh failed: ${error.message}`,
        refreshedViews,
        duration,
      };
    }
  }

  /**
   * Get analytics views health status
   */
  async getAnalyticsViewsHealth(tenantId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    views: Array<{
      name: string;
      recordCount: number;
      lastUpdated?: Date;
      healthScore: number;
      issues: string[];
    }>;
    recommendations: string[];
  }> {
    const views = [
      'customer_analytics_summary',
      'customer_transaction_daily_summary',
      'customer_cohort_analysis',
      'customer_product_affinity',
    ];

    const viewHealth = [];
    const recommendations = [];

    for (const viewName of views) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${viewName} WHERE tenant_id = $1`;
        const countResult = await this.dataSource.query(countQuery, [tenantId]);
        const recordCount = parseInt(countResult[0]?.count || '0');

        const lastUpdatedQuery = `SELECT MAX(last_updated) as last_updated FROM ${viewName} WHERE tenant_id = $1`;
        const lastUpdatedResult = await this.dataSource.query(
          lastUpdatedQuery,
          [tenantId],
        );
        const lastUpdated = lastUpdatedResult[0]?.last_updated;

        const issues = [];
        let healthScore = 100;

        // Check data freshness
        if (lastUpdated) {
          const hoursSinceUpdate =
            (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate > 24) {
            issues.push(`Data is ${Math.round(hoursSinceUpdate)} hours old`);
            healthScore -= 30;
          } else if (hoursSinceUpdate > 6) {
            issues.push(`Data is ${Math.round(hoursSinceUpdate)} hours old`);
            healthScore -= 15;
          }
        } else {
          issues.push('No last updated timestamp found');
          healthScore -= 50;
        }

        // Check record count
        if (recordCount === 0) {
          issues.push('No data found');
          healthScore -= 40;
        } else if (recordCount < 10) {
          issues.push('Very low record count');
          healthScore -= 20;
        }

        viewHealth.push({
          name: viewName,
          recordCount,
          lastUpdated,
          healthScore: Math.max(0, healthScore),
          issues,
        });
      } catch (error) {
        viewHealth.push({
          name: viewName,
          recordCount: 0,
          lastUpdated: undefined,
          healthScore: 0,
          issues: [`Query error: ${error.message}`],
        });
      }
    }

    // Generate recommendations
    const unhealthyViews = viewHealth.filter(v => v.healthScore < 70);
    if (unhealthyViews.length > 0) {
      recommendations.push('Refresh analytics views to improve data freshness');
    }

    const totalRecords = viewHealth.reduce((sum, v) => sum + v.recordCount, 0);
    if (totalRecords === 0) {
      recommendations.push(
        'Run customer data migration to populate analytics views',
      );
    }

    const averageHealth =
      viewHealth.reduce((sum, v) => sum + v.healthScore, 0) / viewHealth.length;
    const status =
      averageHealth >= 80
        ? 'healthy'
        : averageHealth >= 60
        ? 'degraded'
        : 'unhealthy';

    return {
      status,
      views: viewHealth,
      recommendations,
    };
  }

  /**
   * Scheduled job to refresh analytics views
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async scheduledAnalyticsRefresh(): Promise<void> {
    this.logger.log('Starting scheduled analytics views refresh');

    try {
      const result = await this.refreshAnalyticsViews();
      if (result.success) {
        this.logger.log(
          `Scheduled refresh completed successfully in ${result.duration}ms`,
        );
      } else {
        this.logger.error(`Scheduled refresh failed: ${result.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Scheduled refresh error: ${error.message}`,
        error.stack,
      );
    }
  }
}
