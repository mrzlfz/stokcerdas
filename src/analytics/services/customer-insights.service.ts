import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { CustomerAnalyticsService } from '../../customers/services/customer-analytics.service';
import { CustomerMetricsCalculatorService } from '../../customers/services/customer-metrics-calculator.service';
import { Customer } from '../../customers/entities/customer.entity';
import { CustomerInsightsQueryDto } from '../dto/analytics-query.dto';
import {
  CustomerInsightsResponseDto,
  CustomerSegmentDto,
  TrendDataDto,
  ComparisonDataDto,
  KPIAlertDto,
  AnalyticsMetaDto,
} from '../dto/analytics-response.dto';

export interface CustomerInsightsSummary {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageLTV: number;
  customerRetentionRate: number;
  churnRate: number;
  topSpendingSegment: string;
  mostLoyalSegment: string;
  averageOrderValue: number;
  averagePurchaseFrequency: number;
}

@Injectable()
export class CustomerInsightsService {
  private readonly logger = new Logger(CustomerInsightsService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly customerAnalyticsService: CustomerAnalyticsService,
    private readonly customerMetricsCalculatorService: CustomerMetricsCalculatorService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generate comprehensive customer insights with real business logic
   */
  async generateCustomerInsights(
    tenantId: string,
    query: CustomerInsightsQueryDto,
  ): Promise<CustomerInsightsResponseDto> {
    const startTime = Date.now();
    this.logger.debug(`Generating customer insights for tenant ${tenantId}`);

    try {
      // Parse date range
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default 90 days
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      // Get customer analytics data
      const analyticsData =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: query.limit || 1000, // Get more data for analysis
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      // Generate customer segments
      const segments = await this.generateCustomerSegments(
        tenantId,
        analyticsData.data,
        query,
      );

      // Generate summary metrics
      const summary = await this.generateSummaryMetrics(
        tenantId,
        analyticsData,
        startDate,
        endDate,
      );

      // Generate trend data
      const trends = query.includePurchaseBehavior
        ? await this.generateTrendData(
            tenantId,
            startDate,
            endDate,
            query.granularity,
          )
        : [];

      // Generate comparison data
      const comparison = query.includeComparison
        ? await this.generateComparisonData(
            tenantId,
            startDate,
            endDate,
            query.comparisonType,
          )
        : undefined;

      // Generate alerts
      const alerts = await this.generateCustomerAlerts(analyticsData.data);

      const executionTime = Date.now() - startTime;

      // Apply pagination to segments
      const page = query.page || 1;
      const limit = query.limit || 50;
      const offset = (page - 1) * limit;
      const paginatedSegments = segments.slice(offset, offset + limit);

      const response: CustomerInsightsResponseDto = {
        data: paginatedSegments,
        meta: {
          total: segments.length,
          page,
          limit,
          totalPages: Math.ceil(segments.length / limit),
          generatedAt: new Date().toISOString(),
          executionTime,
          parameters: query,
          dataAsOf: new Date().toISOString(),
        },
        summary,
        trends,
        comparison,
        alerts,
      };

      this.logger.debug(
        `Customer insights generated successfully in ${executionTime}ms`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to generate customer insights: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate customer insights: ${error.message}`,
      );
    }
  }

  /**
   * Generate customer segments with characteristics
   */
  private async generateCustomerSegments(
    tenantId: string,
    customersData: any[],
    query: CustomerInsightsQueryDto,
  ): Promise<CustomerSegmentDto[]> {
    const segmentMap = new Map<
      string,
      {
        customers: any[];
        totalRevenue: number;
        totalOrders: number;
        characteristics: {
          averageOrderSize: number;
          preferredCategories: Set<string>;
          purchasePattern: 'frequent' | 'occasional' | 'rare';
          loyaltyLevel: 'high' | 'medium' | 'low';
        };
      }
    >();

    // Group customers by segment
    customersData.forEach(customer => {
      const segment = customer.segment || 'undefined';

      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, {
          customers: [],
          totalRevenue: 0,
          totalOrders: 0,
          characteristics: {
            averageOrderSize: 0,
            preferredCategories: new Set<string>(),
            purchasePattern: 'occasional',
            loyaltyLevel: 'medium',
          },
        });
      }

      const segmentData = segmentMap.get(segment)!;
      segmentData.customers.push(customer);
      segmentData.totalRevenue += customer.totalSpent || 0;
      segmentData.totalOrders += customer.totalTransactions || 0;

      // Add product categories
      if (customer.productCategories) {
        customer.productCategories.forEach((category: string) => {
          segmentData.characteristics.preferredCategories.add(category);
        });
      }
    });

    // Convert to response format
    const segments: CustomerSegmentDto[] = [];

    for (const [segmentName, segmentData] of segmentMap.entries()) {
      const customerCount = segmentData.customers.length;
      if (customerCount === 0) continue;

      const averageOrderValue =
        segmentData.totalOrders > 0
          ? segmentData.totalRevenue / segmentData.totalOrders
          : 0;

      const totalLTV = segmentData.customers.reduce(
        (sum, c) => sum + (c.totalSpent || 0),
        0,
      );
      const averageLTV = customerCount > 0 ? totalLTV / customerCount : 0;

      const averagePurchaseFrequency =
        segmentData.customers.reduce(
          (sum, c) => sum + (c.monthlyTransactionFrequency || 0),
          0,
        ) / customerCount;

      // Determine purchase pattern
      let purchasePattern: 'frequent' | 'occasional' | 'rare' = 'occasional';
      if (averagePurchaseFrequency > 2) purchasePattern = 'frequent';
      else if (averagePurchaseFrequency < 0.5) purchasePattern = 'rare';

      // Determine loyalty level
      let loyaltyLevel: 'high' | 'medium' | 'low' = 'medium';
      if (averageLTV > 20000000) loyaltyLevel = 'high'; // 20M IDR
      else if (averageLTV < 2000000) loyaltyLevel = 'low'; // 2M IDR

      segments.push({
        segmentName: this.formatSegmentName(segmentName),
        customerCount,
        totalRevenue: segmentData.totalRevenue,
        averageOrderValue,
        averagePurchaseFrequency,
        averageLTV,
        characteristics: {
          averageOrderSize: averageOrderValue,
          preferredCategories: Array.from(
            segmentData.characteristics.preferredCategories,
          ).slice(0, 5),
          purchasePattern,
          loyaltyLevel,
        },
      });
    }

    // Sort segments by total revenue
    return segments.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Generate summary metrics for customer insights
   */
  private async generateSummaryMetrics(
    tenantId: string,
    analyticsData: any,
    startDate: Date,
    endDate: Date,
  ): Promise<CustomerInsightsSummary> {
    const customers = analyticsData.data || [];
    const summary = analyticsData.summary || {};

    // Calculate new customers (customers created in the period)
    const newCustomers = await this.dataSource.query(
      `
      SELECT COUNT(*) as count
      FROM customers 
      WHERE tenant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        AND is_deleted = false
    `,
      [tenantId, startDate, endDate],
    );

    // Calculate returning customers (customers who made multiple orders)
    const returningCustomers = customers.filter(
      c => (c.totalTransactions || 0) > 1,
    ).length;

    // Calculate retention rate
    const cohortAnalysis =
      await this.customerAnalyticsService.getCustomerCohortAnalysis(
        tenantId,
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
        endDate,
      );

    const averageRetentionRate =
      cohortAnalysis.length > 0
        ? cohortAnalysis.reduce(
            (sum, cohort) => sum + cohort.month3RetentionRate,
            0,
          ) / cohortAnalysis.length
        : 0;

    // Calculate churn rate
    const atRiskCustomers = customers.filter(
      c => (c.churnRiskScore || 0) >= 70,
    ).length;
    const churnRate =
      customers.length > 0 ? (atRiskCustomers / customers.length) * 100 : 0;

    // Find top spending and most loyal segments
    const segmentTotals = customers.reduce((acc: any, customer: any) => {
      const segment = customer.segment || 'undefined';
      if (!acc[segment]) {
        acc[segment] = { revenue: 0, count: 0, avgLoyalty: 0 };
      }
      acc[segment].revenue += customer.totalSpent || 0;
      acc[segment].count += 1;
      acc[segment].avgLoyalty += this.calculateBasicLoyaltyScore(customer);
      return acc;
    }, {});

    let topSpendingSegment = '';
    let mostLoyalSegment = '';
    let maxRevenue = 0;
    let maxLoyalty = 0;

    Object.entries(segmentTotals).forEach(([segment, data]: [string, any]) => {
      if (data.revenue > maxRevenue) {
        maxRevenue = data.revenue;
        topSpendingSegment = segment;
      }

      const avgLoyalty = data.avgLoyalty / data.count;
      if (avgLoyalty > maxLoyalty) {
        maxLoyalty = avgLoyalty;
        mostLoyalSegment = segment;
      }
    });

    return {
      totalCustomers: summary.totalCustomers || 0,
      activeCustomers: customers.filter(
        c => (c.daysSinceLastTransaction || 0) <= 90,
      ).length,
      newCustomers: parseInt(newCustomers[0]?.count || '0'),
      returningCustomers,
      averageLTV: summary.avgLifetimeValue || 0,
      customerRetentionRate: averageRetentionRate,
      churnRate,
      topSpendingSegment: this.formatSegmentName(topSpendingSegment),
      mostLoyalSegment: this.formatSegmentName(mostLoyalSegment),
      averageOrderValue:
        customers.length > 0
          ? customers.reduce((sum, c) => sum + (c.averageOrderValue || 0), 0) /
            customers.length
          : 0,
      averagePurchaseFrequency: summary.avgMonthlyFrequency || 0,
    };
  }

  /**
   * Generate trend data for customer metrics over time
   */
  private async generateTrendData(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    granularity: string = 'monthly',
  ): Promise<TrendDataDto[]> {
    try {
      // Generate date series based on granularity
      const dateFormat =
        granularity === 'daily'
          ? 'YYYY-MM-DD'
          : granularity === 'weekly'
          ? 'YYYY-"W"WW'
          : 'YYYY-MM';

      const interval =
        granularity === 'daily'
          ? '1 day'
          : granularity === 'weekly'
          ? '1 week'
          : '1 month';

      const query = `
        WITH date_series AS (
          SELECT generate_series($2::date, $3::date, $4::interval) as period_date
        ),
        customer_metrics AS (
          SELECT 
            DATE_TRUNC($5, transaction_date) as period,
            COUNT(DISTINCT customer_id) as unique_customers,
            SUM(daily_total) as total_revenue,
            AVG(daily_avg_order_value) as avg_order_value,
            COUNT(*) as total_transactions
          FROM customer_transaction_daily_summary
          WHERE tenant_id = $1
            AND transaction_date >= $2
            AND transaction_date <= $3
          GROUP BY DATE_TRUNC($5, transaction_date)
        )
        SELECT 
          TO_CHAR(ds.period_date, $6) as period,
          COALESCE(cm.unique_customers, 0) as value,
          COALESCE(cm.total_revenue, 0) as revenue,
          COALESCE(cm.avg_order_value, 0) as avg_order_value,
          ds.period_date as period_start,
          ds.period_date + $4::interval as period_end
        FROM date_series ds
        LEFT JOIN customer_metrics cm ON DATE_TRUNC($5, ds.period_date) = cm.period
        ORDER BY ds.period_date
      `;

      const trends = await this.dataSource.query(query, [
        tenantId,
        startDate,
        endDate,
        interval,
        granularity === 'daily'
          ? 'day'
          : granularity === 'weekly'
          ? 'week'
          : 'month',
        dateFormat,
      ]);

      // Calculate period-over-period changes
      const trendData: TrendDataDto[] = trends.map(
        (trend: any, index: number) => {
          const previousValue =
            index > 0 ? trends[index - 1].value : trend.value;
          const change = trend.value - previousValue;
          const changePercent =
            previousValue > 0 ? (change / previousValue) * 100 : 0;

          return {
            period: trend.period,
            value: parseInt(trend.value),
            change: index > 0 ? change : 0,
            changePercent: index > 0 ? changePercent : 0,
            periodStart: trend.period_start,
            periodEnd: trend.period_end,
          };
        },
      );

      return trendData;
    } catch (error) {
      this.logger.error(`Failed to generate trend data: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate comparison data with previous period
   */
  private async generateComparisonData(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    comparisonType: string = 'previous_period',
  ): Promise<ComparisonDataDto | undefined> {
    try {
      const periodDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let comparisonStartDate: Date;
      let comparisonEndDate: Date;
      let comparisonPeriod: string;

      if (comparisonType === 'same_period_last_year') {
        comparisonStartDate = new Date(startDate);
        comparisonStartDate.setFullYear(startDate.getFullYear() - 1);
        comparisonEndDate = new Date(endDate);
        comparisonEndDate.setFullYear(endDate.getFullYear() - 1);
        comparisonPeriod = 'Same period last year';
      } else {
        // Previous period
        comparisonEndDate = new Date(startDate);
        comparisonStartDate = new Date(
          startDate.getTime() - periodDays * 24 * 60 * 60 * 1000,
        );
        comparisonPeriod = 'Previous period';
      }

      // Get current period metrics
      const currentMetrics = await this.dataSource.query(
        `
        SELECT 
          COUNT(DISTINCT customer_id) as unique_customers,
          SUM(daily_total) as total_revenue
        FROM customer_transaction_daily_summary
        WHERE tenant_id = $1
          AND transaction_date >= $2
          AND transaction_date <= $3
      `,
        [tenantId, startDate, endDate],
      );

      // Get comparison period metrics
      const comparisonMetrics = await this.dataSource.query(
        `
        SELECT 
          COUNT(DISTINCT customer_id) as unique_customers,
          SUM(daily_total) as total_revenue
        FROM customer_transaction_daily_summary
        WHERE tenant_id = $1
          AND transaction_date >= $2
          AND transaction_date <= $3
      `,
        [tenantId, comparisonStartDate, comparisonEndDate],
      );

      const current = parseInt(currentMetrics[0]?.unique_customers || '0');
      const previous = parseInt(comparisonMetrics[0]?.unique_customers || '0');
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (changePercent > 5) trend = 'up';
      else if (changePercent < -5) trend = 'down';

      return {
        current,
        previous,
        change,
        changePercent,
        trend,
        comparisonPeriod,
      };
    } catch (error) {
      this.logger.error(`Failed to generate comparison data: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Generate customer-related alerts based on analytics data
   */
  private async generateCustomerAlerts(
    customersData: any[],
  ): Promise<KPIAlertDto[]> {
    const alerts: KPIAlertDto[] = [];

    // High churn risk alert
    const highChurnRiskCustomers = customersData.filter(
      c => (c.churnRiskScore || 0) >= 80,
    );
    if (highChurnRiskCustomers.length > 0) {
      alerts.push({
        id: `churn-risk-${Date.now()}`,
        message: `${highChurnRiskCustomers.length} customers have very high churn risk (80%+)`,
        severity: 'high',
        type: 'threshold',
        metric: 'churn_risk_score',
        currentValue: highChurnRiskCustomers.length,
        thresholdValue: 5, // Alert if more than 5 customers
        recommendation:
          'Implement immediate retention campaigns for these customers',
        timestamp: new Date().toISOString(),
      });
    }

    // Low engagement alert
    const lowEngagementCustomers = customersData.filter(
      c => (c.daysSinceLastTransaction || 0) > 180,
    );
    if (lowEngagementCustomers.length > customersData.length * 0.3) {
      alerts.push({
        id: `low-engagement-${Date.now()}`,
        message: `${Math.round(
          (lowEngagementCustomers.length / customersData.length) * 100,
        )}% of customers haven't transacted in 180+ days`,
        severity: 'medium',
        type: 'trend',
        metric: 'customer_engagement',
        currentValue: lowEngagementCustomers.length,
        recommendation:
          'Launch re-engagement campaigns and review customer journey',
        timestamp: new Date().toISOString(),
      });
    }

    // High-value customers at risk
    const highValueAtRisk = customersData.filter(
      c => c.valueSegment === 'high_value' && (c.churnRiskScore || 0) >= 70,
    );
    if (highValueAtRisk.length > 0) {
      alerts.push({
        id: `high-value-at-risk-${Date.now()}`,
        message: `${highValueAtRisk.length} high-value customers are at risk of churning`,
        severity: 'critical',
        type: 'threshold',
        metric: 'high_value_churn_risk',
        currentValue: highValueAtRisk.length,
        thresholdValue: 0,
        recommendation:
          'Assign dedicated account managers and offer personalized retention incentives',
        timestamp: new Date().toISOString(),
      });
    }

    return alerts;
  }

  /**
   * Helper: Format segment name for display
   */
  private formatSegmentName(segment: string): string {
    return segment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Helper: Calculate loyalty score for a customer using advanced metrics
   */
  private async calculateAdvancedLoyaltyScore(
    tenantId: string,
    customerId: string,
  ): Promise<number> {
    try {
      // Use the advanced metrics calculator for more sophisticated scoring
      const retentionMetrics =
        await this.customerMetricsCalculatorService.calculateCustomerRetention(
          tenantId,
          customerId,
        );

      return retentionMetrics.retentionScore;
    } catch (error) {
      // Fallback to basic calculation if advanced calculation fails
      this.logger.warn(
        `Advanced loyalty calculation failed for customer ${customerId}, using fallback`,
      );
      return this.calculateBasicLoyaltyScore(customerId);
    }
  }

  /**
   * Helper: Basic loyalty score calculation (fallback)
   */
  private calculateBasicLoyaltyScore(customer: any): number {
    let score = 0;

    // Frequency score (0-40 points)
    const frequency = customer.monthlyTransactionFrequency || 0;
    score += Math.min(40, frequency * 10);

    // Recency score (0-30 points)
    const daysSince = customer.daysSinceLastTransaction || 365;
    score += Math.max(0, 30 - (daysSince / 365) * 30);

    // Monetary score (0-30 points)
    const totalSpent = customer.totalSpent || 0;
    score += Math.min(30, (totalSpent / 10000000) * 30); // Normalized to 10M IDR

    return Math.round(score);
  }

  /**
   * Enhanced method to calculate customer churn risk using advanced algorithms
   */
  private async calculateAdvancedChurnRisk(
    tenantId: string,
    customerId: string,
  ): Promise<number> {
    try {
      const churnPrediction =
        await this.customerMetricsCalculatorService.predictCustomerChurn(
          tenantId,
          customerId,
        );

      return churnPrediction.churnRiskScore;
    } catch (error) {
      this.logger.warn(
        `Advanced churn calculation failed for customer ${customerId}, using fallback`,
      );
      return 50; // Default moderate risk
    }
  }
}
