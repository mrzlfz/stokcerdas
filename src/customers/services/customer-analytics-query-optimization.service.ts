import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  Customer,
  CustomerSegmentType,
  LoyaltyTier,
} from '../entities/customer.entity';
import { CustomerTransaction } from '../entities/customer-transaction.entity';

// =============================================
// ULTRATHINK: COMPREHENSIVE CUSTOMER ANALYTICS QUERY OPTIMIZATION
// High-performance customer analytics queries dengan Indonesian business intelligence
// =============================================

export interface OptimizedCustomerQuery {
  tenantId: string;
  filters?: {
    segments?: CustomerSegmentType[];
    loyaltyTiers?: LoyaltyTier[];
    churnRiskMin?: number;
    churnRiskMax?: number;
    lifetimeValueMin?: number;
    lifetimeValueMax?: number;
    regions?: string[];
    paymentMethods?: string[];
    channels?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    lastOrderAfter?: Date;
    lastOrderBefore?: Date;
    indonesianContextFilters?: {
      culturalAlignment?: number;
      religiousObservance?: string[];
      seasonalPatterns?: string[];
      mobileUsage?: boolean;
      whatsappEngagement?: boolean;
    };
  };
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  pagination?: {
    limit: number;
    offset: number;
  };
  includeAnalytics?: boolean;
  includeIndonesianInsights?: boolean;
}

export interface CustomerAnalyticsPerformanceMetrics {
  queryExecutionTime: number;
  indexesUsed: string[];
  rowsExamined: number;
  rowsReturned: number;
  cacheHitRatio: number;
  optimizationRecommendations: string[];
}

export interface IndonesianMarketInsights {
  regionalDistribution: Array<{
    region: string;
    customerCount: number;
    revenueShare: number;
    averageLTV: number;
    topPaymentMethods: string[];
  }>;
  culturalSegmentation: Array<{
    culturalBackground: string;
    customerCount: number;
    averageEngagement: number;
    seasonalPreferences: string[];
  }>;
  paymentMethodAnalytics: Array<{
    paymentMethod: string;
    adoptionRate: number;
    averageTransactionValue: number;
    customerSegments: string[];
  }>;
  seasonalBehaviorPatterns: Array<{
    season: string;
    purchaseIncrease: number;
    topCategories: string[];
    avgSpendingIncrease: number;
  }>;
  mobileEngagementMetrics: {
    mobileUserPercentage: number;
    whatsappEngagementRate: number;
    appUsageFrequency: number;
    mobileTransactionShare: number;
  };
}

@Injectable()
export class CustomerAnalyticsQueryOptimizationService {
  private readonly logger = new Logger(
    CustomerAnalyticsQueryOptimizationService.name,
  );

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerTransaction)
    private readonly customerTransactionRepository: Repository<CustomerTransaction>,
  ) {}

  // =============================================
  // ULTRATHINK: OPTIMIZED CUSTOMER ANALYTICS QUERIES
  // High-performance queries menggunakan database indexes
  // =============================================

  async getOptimizedCustomerAnalytics(query: OptimizedCustomerQuery): Promise<{
    customers: Customer[];
    total: number;
    performance: CustomerAnalyticsPerformanceMetrics;
    indonesianInsights?: IndonesianMarketInsights;
  }> {
    const startTime = Date.now();
    this.logger.debug(
      `Executing optimized customer analytics query for tenant ${query.tenantId}`,
    );

    try {
      // Build optimized query using indexes
      const queryBuilder = this.buildOptimizedCustomerQuery(query);

      // Execute count query for pagination (using covering indexes)
      const totalQuery = queryBuilder
        .clone()
        .select('COUNT(DISTINCT c.id)', 'total');
      const [{ total }] = await totalQuery.getRawMany();

      // Execute main query with pagination
      if (query.pagination) {
        queryBuilder
          .limit(query.pagination.limit)
          .offset(query.pagination.offset);
      }

      const customers = await queryBuilder.getMany();

      // Calculate performance metrics
      const performance = await this.calculatePerformanceMetrics(
        queryBuilder,
        startTime,
      );

      // Generate Indonesian market insights if requested
      let indonesianInsights: IndonesianMarketInsights | undefined;
      if (query.includeIndonesianInsights) {
        indonesianInsights = await this.generateIndonesianMarketInsights(
          query.tenantId,
          query.filters,
        );
      }

      this.logger.debug(
        `Query executed in ${performance.queryExecutionTime}ms, returned ${customers.length} customers`,
      );

      return {
        customers,
        total: parseInt(total),
        performance,
        indonesianInsights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute optimized customer analytics query: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =============================================
  // ULTRATHINK: OPTIMIZED COHORT ANALYSIS QUERIES
  // High-performance cohort queries dengan retention analytics
  // =============================================

  async getOptimizedCohortAnalysis(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    Array<{
      cohortMonth: string;
      cohortSize: number;
      month1RetentionRate: number;
      month3RetentionRate: number;
      month6RetentionRate: number;
      month12RetentionRate: number;
      revenuePerCustomer: number;
      indonesianFactors: {
        averageCulturalAlignment: number;
        topRegions: string[];
        seasonalImpact: number;
      };
    }>
  > {
    this.logger.debug(
      `Executing optimized cohort analysis for tenant ${tenantId}`,
    );

    // Use idx_customers_cohort_base and idx_customers_retention_analytics indexes
    const cohortQuery = this.customerRepository
      .createQueryBuilder('customer')
      .select([
        `DATE_TRUNC('month', customer.first_order_date) as cohort_month`,
        'COUNT(DISTINCT customer.id) as cohort_size',
        'AVG(customer.retention_score) as avg_retention_score',
        'AVG(customer.lifetime_value) as avg_ltv',
        `AVG(CAST(customer.indonesian_market_context->>'culturalAlignmentScore' AS NUMERIC)) as avg_cultural_alignment`,
      ])
      .where('customer.tenant_id = :tenantId', { tenantId })
      .andWhere('customer.first_order_date IS NOT NULL')
      .groupBy(`DATE_TRUNC('month', customer.first_order_date)`)
      .orderBy('cohort_month', 'ASC');

    if (startDate) {
      cohortQuery.andWhere('customer.first_order_date >= :startDate', {
        startDate,
      });
    }
    if (endDate) {
      cohortQuery.andWhere('customer.first_order_date <= :endDate', {
        endDate,
      });
    }

    const cohorts = await cohortQuery.getRawMany();

    // Calculate retention rates using optimized queries
    const cohortAnalysis = await Promise.all(
      cohorts.map(async cohort => {
        const cohortDate = new Date(cohort.cohort_month);
        const retentionRates = await this.calculateCohortRetentionRates(
          tenantId,
          cohortDate,
        );
        const indonesianFactors = await this.calculateIndonesianCohortFactors(
          tenantId,
          cohortDate,
        );

        return {
          cohortMonth: cohort.cohort_month,
          cohortSize: parseInt(cohort.cohort_size),
          month1RetentionRate: retentionRates.month1,
          month3RetentionRate: retentionRates.month3,
          month6RetentionRate: retentionRates.month6,
          month12RetentionRate: retentionRates.month12,
          revenuePerCustomer: parseFloat(cohort.avg_ltv) || 0,
          indonesianFactors: {
            averageCulturalAlignment:
              parseFloat(cohort.avg_cultural_alignment) || 0,
            topRegions: indonesianFactors.topRegions,
            seasonalImpact: indonesianFactors.seasonalImpact,
          },
        };
      }),
    );

    return cohortAnalysis;
  }

  // =============================================
  // ULTRATHINK: OPTIMIZED PRODUCT AFFINITY ANALYSIS
  // High-performance product affinity queries
  // =============================================

  async getOptimizedProductAffinityAnalysis(
    tenantId: string,
    customerId?: string,
    topCategories: number = 20,
  ): Promise<
    Array<{
      customerId?: string;
      category: string;
      totalSpentCategory: number;
      transactionCount: number;
      monthlyPurchaseFrequency: number;
      categoryShareOfWallet: number;
      avgOrderValueCategory: number;
      lastPurchaseDate: Date;
      culturalRelevance: number;
    }>
  > {
    this.logger.debug(
      `Executing optimized product affinity analysis for tenant ${tenantId}`,
    );

    // Use idx_customer_product_affinity index for optimization
    const affinityQuery = this.customerTransactionRepository
      .createQueryBuilder('ct')
      .select([
        customerId ? 'ct.customer_id' : 'NULL as customer_id',
        'ct.product_category as category',
        'SUM(ct.total_amount) as total_spent_category',
        'COUNT(*) as transaction_count',
        'COUNT(*) / 12.0 as monthly_purchase_frequency', // Assuming 12 months data
        'SUM(ct.total_amount) / SUM(SUM(ct.total_amount)) OVER (PARTITION BY ct.customer_id) * 100 as category_share_of_wallet',
        'AVG(ct.total_amount) as avg_order_value_category',
        'MAX(ct.transaction_date) as last_purchase_date',
        `AVG(CASE 
          WHEN ct.product_category IN ('fashion', 'food', 'religious') THEN 95
          WHEN ct.product_category IN ('electronics', 'automotive') THEN 75
          ELSE 85
        END) as cultural_relevance`,
      ])
      .where('ct.tenant_id = :tenantId', { tenantId })
      .andWhere('ct.product_category IS NOT NULL')
      .groupBy(
        customerId
          ? 'ct.customer_id, ct.product_category'
          : 'ct.product_category',
      )
      .orderBy('total_spent_category', 'DESC')
      .limit(topCategories);

    if (customerId) {
      affinityQuery.andWhere('ct.customer_id = :customerId', { customerId });
    }

    const results = await affinityQuery.getRawMany();

    return results.map(result => ({
      customerId: result.customer_id,
      category: result.category,
      totalSpentCategory: parseFloat(result.total_spent_category),
      transactionCount: parseInt(result.transaction_count),
      monthlyPurchaseFrequency: parseFloat(result.monthly_purchase_frequency),
      categoryShareOfWallet: parseFloat(result.category_share_of_wallet),
      avgOrderValueCategory: parseFloat(result.avg_order_value_category),
      lastPurchaseDate: new Date(result.last_purchase_date),
      culturalRelevance: parseFloat(result.cultural_relevance),
    }));
  }

  // =============================================
  // ULTRATHINK: OPTIMIZED GEOGRAPHIC ANALYTICS
  // Indonesian regional customer analytics
  // =============================================

  async getOptimizedGeographicAnalytics(tenantId: string): Promise<
    Array<{
      region: string;
      customerCount: number;
      totalRevenue: number;
      averageLTV: number;
      topPaymentMethods: string[];
      culturalAdaptationScore: number;
      growthRate: number;
    }>
  > {
    this.logger.debug(
      `Executing optimized geographic analytics for tenant ${tenantId}`,
    );

    // Use idx_customer_geographic_analytics index
    const geographicQuery = this.customerRepository
      .createQueryBuilder('c')
      .select([
        `COALESCE(c.addresses->0->>'state', 'Unknown') as region`,
        'COUNT(*) as customer_count',
        'SUM(c.lifetime_value) as total_revenue',
        'AVG(c.lifetime_value) as average_ltv',
        `AVG(CAST(c.indonesian_market_context->>'culturalAlignmentScore' AS NUMERIC)) as cultural_adaptation_score`,
        `array_agg(DISTINCT preference.value) FILTER (WHERE preference.value IS NOT NULL) as payment_methods`,
      ])
      .leftJoin(
        "jsonb_array_elements_text(c.preferences->'preferredPaymentMethods')",
        'preference',
        '1=1',
      )
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.addresses IS NOT NULL')
      .andWhere('jsonb_array_length(c.addresses) > 0')
      .groupBy('region')
      .orderBy('total_revenue', 'DESC');

    const results = await geographicQuery.getRawMany();

    // Calculate growth rates using time-based analysis
    const analyticsWithGrowth = await Promise.all(
      results.map(async result => {
        const growthRate = await this.calculateRegionalGrowthRate(
          tenantId,
          result.region,
        );

        return {
          region: result.region,
          customerCount: parseInt(result.customer_count),
          totalRevenue: parseFloat(result.total_revenue) || 0,
          averageLTV: parseFloat(result.average_ltv) || 0,
          topPaymentMethods: result.payment_methods || [],
          culturalAdaptationScore:
            parseFloat(result.cultural_adaptation_score) || 0,
          growthRate,
        };
      }),
    );

    return analyticsWithGrowth;
  }

  // =============================================
  // ULTRATHINK: PRIVATE HELPER METHODS
  // Supporting methods untuk optimized queries
  // =============================================

  private buildOptimizedCustomerQuery(
    query: OptimizedCustomerQuery,
  ): SelectQueryBuilder<Customer> {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId: query.tenantId });

    // Apply filters using appropriate indexes
    if (query.filters) {
      if (query.filters.segments?.length) {
        queryBuilder.andWhere('c.segment IN (:...segments)', {
          segments: query.filters.segments,
        });
      }

      if (query.filters.loyaltyTiers?.length) {
        queryBuilder.andWhere('c.loyalty_tier IN (:...loyaltyTiers)', {
          loyaltyTiers: query.filters.loyaltyTiers,
        });
      }

      if (query.filters.churnRiskMin !== undefined) {
        queryBuilder.andWhere('c.churn_probability >= :churnRiskMin', {
          churnRiskMin: query.filters.churnRiskMin,
        });
      }

      if (query.filters.churnRiskMax !== undefined) {
        queryBuilder.andWhere('c.churn_probability <= :churnRiskMax', {
          churnRiskMax: query.filters.churnRiskMax,
        });
      }

      if (query.filters.lifetimeValueMin !== undefined) {
        queryBuilder.andWhere('c.lifetime_value >= :lifetimeValueMin', {
          lifetimeValueMin: query.filters.lifetimeValueMin,
        });
      }

      if (query.filters.lifetimeValueMax !== undefined) {
        queryBuilder.andWhere('c.lifetime_value <= :lifetimeValueMax', {
          lifetimeValueMax: query.filters.lifetimeValueMax,
        });
      }

      if (query.filters.regions?.length) {
        queryBuilder.andWhere(`c.addresses->0->>'state' IN (:...regions)`, {
          regions: query.filters.regions,
        });
      }

      if (query.filters.paymentMethods?.length) {
        queryBuilder.andWhere(
          `c.preferences->'preferredPaymentMethods' ?| array[:...paymentMethods]`,
          { paymentMethods: query.filters.paymentMethods },
        );
      }

      if (query.filters.createdAfter) {
        queryBuilder.andWhere('c.created_at >= :createdAfter', {
          createdAfter: query.filters.createdAfter,
        });
      }

      if (query.filters.createdBefore) {
        queryBuilder.andWhere('c.created_at <= :createdBefore', {
          createdBefore: query.filters.createdBefore,
        });
      }

      if (query.filters.lastOrderAfter) {
        queryBuilder.andWhere('c.last_order_date >= :lastOrderAfter', {
          lastOrderAfter: query.filters.lastOrderAfter,
        });
      }

      if (query.filters.lastOrderBefore) {
        queryBuilder.andWhere('c.last_order_date <= :lastOrderBefore', {
          lastOrderBefore: query.filters.lastOrderBefore,
        });
      }

      // Indonesian context filters
      if (query.filters.indonesianContextFilters) {
        const icf = query.filters.indonesianContextFilters;

        if (icf.culturalAlignment !== undefined) {
          queryBuilder.andWhere(
            `CAST(c.indonesian_market_context->>'culturalAlignmentScore' AS NUMERIC) >= :culturalAlignment`,
            { culturalAlignment: icf.culturalAlignment },
          );
        }

        if (icf.religiousObservance?.length) {
          queryBuilder.andWhere(
            `c.indonesian_market_context->>'religiousObservance' IN (:...religiousObservance)`,
            { religiousObservance: icf.religiousObservance },
          );
        }

        if (icf.mobileUsage !== undefined) {
          queryBuilder.andWhere(
            `CAST(c.indonesian_market_context->>'mobileUsageIndicator' AS BOOLEAN) = :mobileUsage`,
            { mobileUsage: icf.mobileUsage },
          );
        }

        if (icf.whatsappEngagement !== undefined) {
          queryBuilder.andWhere(
            `CAST(c.indonesian_market_context->>'whatsappEngagement' AS BOOLEAN) = :whatsappEngagement`,
            { whatsappEngagement: icf.whatsappEngagement },
          );
        }
      }
    }

    // Apply sorting
    if (query.sort) {
      queryBuilder.orderBy(`c.${query.sort.field}`, query.sort.direction);
    } else {
      queryBuilder.orderBy('c.lifetime_value', 'DESC');
    }

    return queryBuilder;
  }

  private async calculatePerformanceMetrics(
    queryBuilder: SelectQueryBuilder<Customer>,
    startTime: number,
  ): Promise<CustomerAnalyticsPerformanceMetrics> {
    const executionTime = Date.now() - startTime;

    // Simulate performance metrics (in real implementation, use EXPLAIN ANALYZE)
    return {
      queryExecutionTime: executionTime,
      indexesUsed: [
        'idx_customers_analytics_primary',
        'idx_customers_ltv_analytics',
        'idx_customers_segmentation',
        'idx_customers_location_analytics',
      ],
      rowsExamined: 1000, // Would come from EXPLAIN ANALYZE
      rowsReturned: 50, // Would come from actual query
      cacheHitRatio: 85, // Would come from cache metrics
      optimizationRecommendations:
        executionTime > 500
          ? [
              'Consider adding more specific filters',
              'Review index usage for this query pattern',
            ]
          : [],
    };
  }

  private async calculateCohortRetentionRates(
    tenantId: string,
    cohortDate: Date,
  ): Promise<{
    month1: number;
    month3: number;
    month6: number;
    month12: number;
  }> {
    const month1Date = new Date(cohortDate);
    month1Date.setMonth(month1Date.getMonth() + 1);

    const month3Date = new Date(cohortDate);
    month3Date.setMonth(month3Date.getMonth() + 3);

    const month6Date = new Date(cohortDate);
    month6Date.setMonth(month6Date.getMonth() + 6);

    const month12Date = new Date(cohortDate);
    month12Date.setMonth(month12Date.getMonth() + 12);

    // Use idx_customers_retention_analytics index
    const baseQuery = this.customerRepository
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere("DATE_TRUNC('month', c.first_order_date) = :cohortDate", {
        cohortDate,
      });

    const [
      totalCustomers,
      month1Retained,
      month3Retained,
      month6Retained,
      month12Retained,
    ] = await Promise.all([
      baseQuery.clone().getCount(),
      baseQuery
        .clone()
        .andWhere('c.last_order_date >= :month1Date', { month1Date })
        .getCount(),
      baseQuery
        .clone()
        .andWhere('c.last_order_date >= :month3Date', { month3Date })
        .getCount(),
      baseQuery
        .clone()
        .andWhere('c.last_order_date >= :month6Date', { month6Date })
        .getCount(),
      baseQuery
        .clone()
        .andWhere('c.last_order_date >= :month12Date', { month12Date })
        .getCount(),
    ]);

    return {
      month1: totalCustomers > 0 ? (month1Retained / totalCustomers) * 100 : 0,
      month3: totalCustomers > 0 ? (month3Retained / totalCustomers) * 100 : 0,
      month6: totalCustomers > 0 ? (month6Retained / totalCustomers) * 100 : 0,
      month12:
        totalCustomers > 0 ? (month12Retained / totalCustomers) * 100 : 0,
    };
  }

  private async calculateIndonesianCohortFactors(
    tenantId: string,
    cohortDate: Date,
  ): Promise<{ topRegions: string[]; seasonalImpact: number }> {
    // Use Indonesian context indexes
    const regionQuery = this.customerRepository
      .createQueryBuilder('c')
      .select(`c.addresses->0->>'state'`, 'region')
      .addSelect('COUNT(*)', 'count')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere("DATE_TRUNC('month', c.first_order_date) = :cohortDate", {
        cohortDate,
      })
      .groupBy('region')
      .orderBy('count', 'DESC')
      .limit(3);

    const regions = await regionQuery.getRawMany();
    const topRegions = regions.map(r => r.region).filter(Boolean);

    // Calculate seasonal impact based on cohort month
    const month = cohortDate.getMonth() + 1; // 1-12
    let seasonalImpact = 0;

    if ([6, 7].includes(month)) {
      // Ramadan/Lebaran months
      seasonalImpact = 25;
    } else if ([12, 1].includes(month)) {
      // Christmas/New Year
      seasonalImpact = 15;
    } else if ([8, 9].includes(month)) {
      // Independence Day
      seasonalImpact = 10;
    } else {
      seasonalImpact = 5;
    }

    return { topRegions, seasonalImpact };
  }

  private async calculateRegionalGrowthRate(
    tenantId: string,
    region: string,
  ): Promise<number> {
    const currentDate = new Date();
    const lastMonthDate = new Date(currentDate);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    const twoMonthsAgoDate = new Date(currentDate);
    twoMonthsAgoDate.setMonth(twoMonthsAgoDate.getMonth() - 2);

    const baseQuery = this.customerRepository
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere(`c.addresses->0->>'state' = :region`, { region });

    const [currentMonthCustomers, lastMonthCustomers] = await Promise.all([
      baseQuery
        .clone()
        .andWhere('c.created_at >= :lastMonthDate', { lastMonthDate })
        .getCount(),
      baseQuery
        .clone()
        .andWhere('c.created_at >= :twoMonthsAgoDate', { twoMonthsAgoDate })
        .andWhere('c.created_at < :lastMonthDate', { lastMonthDate })
        .getCount(),
    ]);

    if (lastMonthCustomers === 0) return 0;
    return (
      ((currentMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100
    );
  }

  private async generateIndonesianMarketInsights(
    tenantId: string,
    filters?: OptimizedCustomerQuery['filters'],
  ): Promise<IndonesianMarketInsights> {
    // Use Indonesian business context indexes for insights
    const [
      regionalDistribution,
      paymentMethodAnalytics,
      mobileEngagementMetrics,
    ] = await Promise.all([
      this.getRegionalDistributionInsights(tenantId, filters),
      this.getPaymentMethodInsights(tenantId, filters),
      this.getMobileEngagementInsights(tenantId, filters),
    ]);

    return {
      regionalDistribution,
      culturalSegmentation: await this.getCulturalSegmentationInsights(
        tenantId,
        filters,
      ),
      paymentMethodAnalytics,
      seasonalBehaviorPatterns: await this.getSeasonalBehaviorInsights(
        tenantId,
        filters,
      ),
      mobileEngagementMetrics,
    };
  }

  private async getRegionalDistributionInsights(
    tenantId: string,
    filters?: OptimizedCustomerQuery['filters'],
  ): Promise<IndonesianMarketInsights['regionalDistribution']> {
    const query = this.customerRepository
      .createQueryBuilder('c')
      .select([
        `COALESCE(c.addresses->0->>'state', 'Unknown') as region`,
        'COUNT(*) as customer_count',
        'SUM(c.lifetime_value) as total_revenue',
        'AVG(c.lifetime_value) as average_ltv',
        `array_agg(DISTINCT preference.value) FILTER (WHERE preference.value IS NOT NULL) as payment_methods`,
      ])
      .leftJoin(
        "jsonb_array_elements_text(c.preferences->'preferredPaymentMethods')",
        'preference',
        '1=1',
      )
      .where('c.tenant_id = :tenantId', { tenantId })
      .groupBy('region')
      .orderBy('total_revenue', 'DESC');

    const results = await query.getRawMany();
    const totalRevenue = results.reduce(
      (sum, r) => sum + (parseFloat(r.total_revenue) || 0),
      0,
    );

    return results.map(result => ({
      region: result.region,
      customerCount: parseInt(result.customer_count),
      revenueShare:
        totalRevenue > 0
          ? ((parseFloat(result.total_revenue) || 0) / totalRevenue) * 100
          : 0,
      averageLTV: parseFloat(result.average_ltv) || 0,
      topPaymentMethods: (result.payment_methods || []).slice(0, 3),
    }));
  }

  private async getPaymentMethodInsights(
    tenantId: string,
    filters?: OptimizedCustomerQuery['filters'],
  ): Promise<IndonesianMarketInsights['paymentMethodAnalytics']> {
    // Use idx_customers_indonesian_payments index
    const query = this.customerTransactionRepository
      .createQueryBuilder('ct')
      .select([
        'ct.payment_method',
        'COUNT(DISTINCT ct.customer_id) as customer_count',
        'AVG(ct.total_amount) as avg_transaction_value',
        'array_agg(DISTINCT c.segment) as customer_segments',
      ])
      .innerJoin('customers', 'c', 'c.id = ct.customer_id')
      .where('ct.tenant_id = :tenantId', { tenantId })
      .andWhere('ct.payment_method IS NOT NULL')
      .groupBy('ct.payment_method')
      .orderBy('customer_count', 'DESC');

    const results = await query.getRawMany();
    const totalCustomers = await this.customerRepository.count({
      where: { tenantId },
    });

    return results.map(result => ({
      paymentMethod: result.payment_method,
      adoptionRate:
        totalCustomers > 0
          ? (parseInt(result.customer_count) / totalCustomers) * 100
          : 0,
      averageTransactionValue: parseFloat(result.avg_transaction_value) || 0,
      customerSegments: result.customer_segments || [],
    }));
  }

  private async getMobileEngagementInsights(
    tenantId: string,
    filters?: OptimizedCustomerQuery['filters'],
  ): Promise<IndonesianMarketInsights['mobileEngagementMetrics']> {
    const query = this.customerRepository
      .createQueryBuilder('c')
      .select([
        `COUNT(CASE WHEN CAST(c.indonesian_market_context->>'mobileUsageIndicator' AS BOOLEAN) = true THEN 1 END) as mobile_users`,
        `COUNT(CASE WHEN CAST(c.indonesian_market_context->>'whatsappEngagement' AS BOOLEAN) = true THEN 1 END) as whatsapp_users`,
        'COUNT(*) as total_customers',
      ])
      .where('c.tenant_id = :tenantId', { tenantId });

    const result = await query.getRawOne();

    const totalCustomers = parseInt(result.total_customers) || 1;
    const mobileUsers = parseInt(result.mobile_users) || 0;
    const whatsappUsers = parseInt(result.whatsapp_users) || 0;

    return {
      mobileUserPercentage: (mobileUsers / totalCustomers) * 100,
      whatsappEngagementRate: (whatsappUsers / totalCustomers) * 100,
      appUsageFrequency: 4.2, // Mock value - would come from app analytics
      mobileTransactionShare: 85, // Mock value - would come from transaction channel data
    };
  }

  private async getCulturalSegmentationInsights(
    tenantId: string,
    filters?: OptimizedCustomerQuery['filters'],
  ): Promise<IndonesianMarketInsights['culturalSegmentation']> {
    // Use Indonesian cultural context indexes
    const query = this.customerRepository
      .createQueryBuilder('c')
      .select([
        `c.indonesian_market_context->>'culturalBackground' as cultural_background`,
        'COUNT(*) as customer_count',
        `AVG(CAST(c.indonesian_market_context->>'culturalAlignmentScore' AS NUMERIC)) as avg_engagement`,
        `array_agg(DISTINCT seasonal_pattern.key) as seasonal_preferences`,
      ])
      .leftJoin(
        "jsonb_object_keys(c.purchase_behavior->'seasonalPurchasePattern')",
        'seasonal_pattern',
        '1=1',
      )
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere(
        `c.indonesian_market_context->>'culturalBackground' IS NOT NULL`,
      )
      .groupBy('cultural_background')
      .orderBy('customer_count', 'DESC');

    const results = await query.getRawMany();

    return results.map(result => ({
      culturalBackground: result.cultural_background,
      customerCount: parseInt(result.customer_count),
      averageEngagement: parseFloat(result.avg_engagement) || 0,
      seasonalPreferences: result.seasonal_preferences || [],
    }));
  }

  private async getSeasonalBehaviorInsights(
    tenantId: string,
    filters?: OptimizedCustomerQuery['filters'],
  ): Promise<IndonesianMarketInsights['seasonalBehaviorPatterns']> {
    // Mock seasonal behavior data - would be calculated from transaction patterns
    return [
      {
        season: 'Ramadan',
        purchaseIncrease: 35,
        topCategories: ['food', 'religious', 'clothing'],
        avgSpendingIncrease: 45,
      },
      {
        season: 'Lebaran',
        purchaseIncrease: 55,
        topCategories: ['fashion', 'electronics', 'food'],
        avgSpendingIncrease: 65,
      },
      {
        season: 'Christmas',
        purchaseIncrease: 25,
        topCategories: ['electronics', 'toys', 'food'],
        avgSpendingIncrease: 30,
      },
      {
        season: 'Independence Day',
        purchaseIncrease: 15,
        topCategories: ['fashion', 'accessories', 'home'],
        avgSpendingIncrease: 20,
      },
    ];
  }
}
