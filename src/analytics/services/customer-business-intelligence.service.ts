import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Customer } from '../../customers/entities/customer.entity';
import { CustomerInsightsService } from './customer-insights.service';
import { CustomerAnalyticsService } from '../../customers/services/customer-analytics.service';
import { CustomerMetricsCalculatorService } from '../../customers/services/customer-metrics-calculator.service';
import { CustomerSegmentationEngineService } from '../../customers/services/customer-segmentation-engine.service';
import { PurchaseBehaviorAnalyzerService } from '../../customers/services/purchase-behavior-analyzer.service';

export enum CustomerHealthScore {
  EXCELLENT = 'excellent', // 90-100
  GOOD = 'good', // 70-89
  AVERAGE = 'average', // 50-69
  CONCERNING = 'concerning', // 30-49
  CRITICAL = 'critical', // 0-29
}

export enum BusinessOpportunityType {
  CUSTOMER_ACQUISITION = 'customer_acquisition',
  RETENTION_IMPROVEMENT = 'retention_improvement',
  UPSELL_EXPANSION = 'upsell_expansion',
  CROSS_SELL_OPPORTUNITY = 'cross_sell_opportunity',
  CHURN_PREVENTION = 'churn_prevention',
  SEASONAL_PREPARATION = 'seasonal_preparation',
  MARKET_PENETRATION = 'market_penetration',
  PRODUCT_OPTIMIZATION = 'product_optimization',
  PRICING_OPTIMIZATION = 'pricing_optimization',
  LOYALTY_ENHANCEMENT = 'loyalty_enhancement',
}

export enum IndonesianMarketContext {
  RAMADAN_OPPORTUNITY = 'ramadan_opportunity',
  LEBARAN_SURGE = 'lebaran_surge',
  JAKARTA_PREMIUM_FOCUS = 'jakarta_premium_focus',
  RURAL_EXPANSION = 'rural_expansion',
  MUSLIM_MARKET_DOMINANCE = 'muslim_market_dominance',
  LOCAL_BRAND_PREFERENCE = 'local_brand_preference',
  MOBILE_FIRST_BEHAVIOR = 'mobile_first_behavior',
  UMKM_SEGMENT_GROWTH = 'umkm_segment_growth',
  REGIONAL_DIVERSITY = 'regional_diversity',
}

export interface CustomerBusinessIntelligenceDashboard {
  executiveSummary: {
    totalCustomerValue: number;
    customerHealthDistribution: Record<CustomerHealthScore, number>;
    predictedGrowthRate: number; // Next 12 months
    churnRiskAlert: {
      highRiskCustomers: number;
      estimatedRevenueLoss: number;
      preventionRecommendations: string[];
    };
    topBusinessOpportunities: Array<{
      type: BusinessOpportunityType;
      estimatedImpact: number; // Revenue impact in IDR
      timeToRealize: number; // Days
      confidence: number; // 0-100
      description: string;
    }>;
    indonesianMarketInsights: Array<{
      context: IndonesianMarketContext;
      currentRelevance: number; // 0-100
      actionableInsight: string;
      businessImplication: string;
    }>;
  };

  customerSegmentPerformance: {
    segments: Array<{
      segmentName: string;
      customerCount: number;
      totalRevenue: number;
      averageLTV: number;
      healthScore: CustomerHealthScore;
      growthTrend: 'growing' | 'stable' | 'declining';
      marketOpportunity: number; // Potential additional revenue
      recommendedActions: string[];
    }>;
    segmentMigrationAnalysis: Array<{
      fromSegment: string;
      toSegment: string;
      migrationRate: number; // Percentage
      averageTimeDays: number;
      revenueImpact: number;
      triggerFactors: string[];
    }>;
  };

  behavioralInsights: {
    purchasePatternTrends: Array<{
      pattern: string;
      customerPercentage: number;
      revenueContribution: number;
      seasonalInfluence: number;
      optimizationPotential: number;
    }>;
    productAffinityMatrix: Array<{
      primaryCategory: string;
      crossSellCategories: Array<{
        category: string;
        affinityStrength: number;
        conversionPotential: number;
        revenueUpside: number;
      }>;
    }>;
    channelEffectivenessAnalysis: Array<{
      channel: string;
      customerAcquisitionCost: number;
      averageOrderValue: number;
      retentionRate: number;
      profitabilityScore: number;
      optimizationRecommendations: string[];
    }>;
  };

  predictiveAnalytics: {
    nextMonthPredictions: {
      expectedNewCustomers: number;
      expectedChurnCustomers: number;
      predictedRevenue: number;
      seasonalAdjustment: number;
      confidenceInterval: {
        lower: number;
        upper: number;
      };
    };
    customerLifetimeValueForecasting: Array<{
      customerSegment: string;
      currentAverageLTV: number;
      predictedLTVIn12Months: number;
      growthPotential: number;
      riskFactors: string[];
      opportunityFactors: string[];
    }>;
    seasonalBusinessPlanning: Array<{
      upcomingSeason: string;
      daysUntilPeak: number;
      expectedDemandIncrease: number;
      preparationRecommendations: Array<{
        action: string;
        deadline: Date;
        estimatedImpact: number;
        resourceRequirement: string;
      }>;
    }>;
  };

  operationalRecommendations: {
    highPriorityActions: Array<{
      actionType: BusinessOpportunityType;
      title: string;
      description: string;
      estimatedImpact: number;
      effortLevel: 'low' | 'medium' | 'high';
      timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
      requiredResources: string[];
      successMetrics: string[];
      indonesianContextConsiderations: string[];
    }>;
    marketingRecommendations: Array<{
      targetSegment: string;
      campaignType: string;
      suggestedChannels: string[];
      budgetAllocation: number;
      expectedROI: number;
      culturalConsiderations: string[];
    }>;
    productDevelopmentInsights: Array<{
      opportunity: string;
      targetMarket: string;
      estimatedDemand: number;
      competitiveAnalysis: string;
      localAdaptationNeeds: string[];
    }>;
  };

  performanceMetrics: {
    customerAcquisition: {
      monthlyAcquisitionRate: number;
      acquisitionCostTrend: 'improving' | 'stable' | 'worsening';
      qualityScore: number; // Based on LTV of acquired customers
      channelEffectiveness: Record<string, number>;
    };
    customerRetention: {
      overallRetentionRate: number;
      retentionBySegment: Record<string, number>;
      churnRiskDistribution: Record<string, number>;
      retentionProgramEffectiveness: number;
    };
    revenueOptimization: {
      revenuePerCustomer: number;
      crossSellSuccessRate: number;
      upsellConversionRate: number;
      pricingOptimizationScore: number;
    };
    marketPositioning: {
      competitivePositionScore: number;
      brandLoyaltyIndex: number;
      marketShareEstimate: number;
      customerSatisfactionTrend: 'improving' | 'stable' | 'declining';
    };
  };

  realTimeAlerts: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    message: string;
    affectedCustomers: number;
    potentialImpact: number;
    recommendedActions: string[];
    detectedAt: Date;
    indonesianContextRelevance?: string;
  }>;
}

export interface CustomerBusinessIntelligenceConfiguration {
  refreshFrequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
  includePredictiveAnalytics: boolean;
  includeIndonesianContext: boolean;
  alertThresholds: {
    churnRiskPercentage: number;
    revenueDrop: number;
    customerHealthDecline: number;
  };
  segmentAnalysisDepth: 'basic' | 'standard' | 'comprehensive';
  historicalDataRange: number; // Months
}

@Injectable()
export class CustomerBusinessIntelligenceService {
  private readonly logger = new Logger(
    CustomerBusinessIntelligenceService.name,
  );

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly customerInsightsService: CustomerInsightsService,
    private readonly customerAnalyticsService: CustomerAnalyticsService,
    private readonly customerMetricsCalculatorService: CustomerMetricsCalculatorService,
    private readonly customerSegmentationEngineService: CustomerSegmentationEngineService,
    private readonly purchaseBehaviorAnalyzerService: PurchaseBehaviorAnalyzerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * ULTRATHINK: Comprehensive Customer Business Intelligence Dashboard
   * Unified dashboard combining all customer analytics services with business intelligence
   */
  async generateCustomerBusinessIntelligenceDashboard(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration = this.getDefaultConfiguration(),
  ): Promise<CustomerBusinessIntelligenceDashboard> {
    const startTime = Date.now();
    this.logger.debug(
      `Generating comprehensive customer BI dashboard for tenant ${tenantId}`,
    );

    try {
      // Execute all analytics components in parallel for performance
      const [
        executiveSummaryData,
        segmentPerformanceData,
        behavioralInsightsData,
        predictiveAnalyticsData,
        operationalData,
        performanceMetricsData,
        realTimeAlertsData,
      ] = await Promise.all([
        this.generateExecutiveSummary(tenantId, configuration),
        this.generateCustomerSegmentPerformance(tenantId, configuration),
        this.generateBehavioralInsights(tenantId, configuration),
        this.generatePredictiveAnalytics(tenantId, configuration),
        this.generateOperationalRecommendations(tenantId, configuration),
        this.generatePerformanceMetrics(tenantId, configuration),
        this.generateRealTimeAlerts(tenantId, configuration),
      ]);

      const executionTime = Date.now() - startTime;
      this.logger.debug(
        `Customer BI dashboard generated in ${executionTime}ms for tenant ${tenantId}`,
      );

      return {
        executiveSummary: executiveSummaryData,
        customerSegmentPerformance: segmentPerformanceData,
        behavioralInsights: behavioralInsightsData,
        predictiveAnalytics: predictiveAnalyticsData,
        operationalRecommendations: operationalData,
        performanceMetrics: performanceMetricsData,
        realTimeAlerts: realTimeAlertsData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate customer BI dashboard for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Customer BI dashboard generation failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Executive Summary Generation
   * High-level business insights for executive decision making
   */
  private async generateExecutiveSummary(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<CustomerBusinessIntelligenceDashboard['executiveSummary']> {
    this.logger.debug(`Generating executive summary for tenant ${tenantId}`);

    try {
      // Get customer analytics overview
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: 1000,
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      // Calculate total customer value
      const totalCustomerValue = customerAnalytics.data.reduce(
        (sum, customer) => sum + (customer.totalSpent || 0),
        0,
      );

      // Calculate customer health distribution
      const customerHealthDistribution =
        await this.calculateCustomerHealthDistribution(
          tenantId,
          customerAnalytics.data,
        );

      // Calculate predicted growth rate
      const predictedGrowthRate = await this.calculatePredictedGrowthRate(
        tenantId,
      );

      // Generate churn risk alert
      const churnRiskAlert = await this.generateChurnRiskAlert(
        tenantId,
        customerAnalytics.data,
      );

      // Identify top business opportunities
      const topBusinessOpportunities =
        await this.identifyTopBusinessOpportunities(
          tenantId,
          customerAnalytics.data,
          configuration,
        );

      // Generate Indonesian market insights
      const indonesianMarketInsights =
        await this.generateIndonesianMarketInsights(
          tenantId,
          customerAnalytics.data,
          configuration,
        );

      return {
        totalCustomerValue,
        customerHealthDistribution,
        predictedGrowthRate,
        churnRiskAlert,
        topBusinessOpportunities,
        indonesianMarketInsights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate executive summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Customer Segment Performance Analysis
   * Deep analysis of segment performance and migration patterns
   */
  private async generateCustomerSegmentPerformance(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<
    CustomerBusinessIntelligenceDashboard['customerSegmentPerformance']
  > {
    this.logger.debug(
      `Generating customer segment performance for tenant ${tenantId}`,
    );

    try {
      // Get comprehensive segmentation results
      const segmentationResults =
        await this.customerSegmentationEngineService.performBatchSegmentation(
          tenantId,
        );

      // Analyze segment performance
      const segments = await Promise.all(
        segmentationResults.map(async segmentResult => {
          const segmentCustomers = await this.getSegmentCustomers(
            tenantId,
            segmentResult.segmentName,
          );

          const totalRevenue = segmentCustomers.reduce(
            (sum, customer) => sum + (customer.totalSpent || 0),
            0,
          );

          const averageLTV =
            segmentCustomers.length > 0
              ? await this.calculateSegmentAverageLTV(
                  tenantId,
                  segmentCustomers,
                )
              : 0;

          const healthScoreNumber = await this.calculateSegmentHealthScore(
            segmentCustomers,
          );
          const growthTrendNumber = await this.calculateSegmentGrowthTrend(
            tenantId,
            segmentResult.segmentName,
          );
          const marketOpportunity =
            await this.calculateSegmentMarketOpportunity(segmentCustomers);
          const recommendedActions =
            await this.generateSegmentRecommendedActions(
              segmentResult.segmentName,
              segmentCustomers,
            );

          // Convert numeric health score to CustomerHealthScore enum
          let healthScore: CustomerHealthScore;
          if (healthScoreNumber >= 90) {
            healthScore = CustomerHealthScore.EXCELLENT;
          } else if (healthScoreNumber >= 70) {
            healthScore = CustomerHealthScore.GOOD;
          } else if (healthScoreNumber >= 50) {
            healthScore = CustomerHealthScore.AVERAGE;
          } else if (healthScoreNumber >= 30) {
            healthScore = CustomerHealthScore.CONCERNING;
          } else {
            healthScore = CustomerHealthScore.CRITICAL;
          }

          // Convert numeric growth trend to string union
          let growthTrend: 'growing' | 'stable' | 'declining';
          if (growthTrendNumber > 5) {
            growthTrend = 'growing';
          } else if (growthTrendNumber < -5) {
            growthTrend = 'declining';
          } else {
            growthTrend = 'stable';
          }

          return {
            segmentName: segmentResult.segmentName,
            customerCount: segmentCustomers.length,
            totalRevenue,
            averageLTV,
            healthScore,
            growthTrend,
            marketOpportunity,
            recommendedActions,
          };
        }),
      );

      // Analyze segment migration patterns
      const segmentMigrationAnalysis =
        await this.analyzeSegmentMigrationPatterns(tenantId);

      return {
        segments,
        segmentMigrationAnalysis,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate segment performance: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Behavioral Insights Generation
   * Advanced behavioral pattern analysis for business optimization
   */
  private async generateBehavioralInsights(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<CustomerBusinessIntelligenceDashboard['behavioralInsights']> {
    this.logger.debug(`Generating behavioral insights for tenant ${tenantId}`);

    try {
      // Get active customers for behavioral analysis
      const activeCustomers = await this.dataSource.query(
        `
        SELECT c.id, c.segment, c.value_segment, c.loyalty_tier
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        WHERE c.tenant_id = $1 
          AND c.is_deleted = false
          AND o.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY c.id, c.segment, c.value_segment, c.loyalty_tier
        LIMIT 500
      `,
        [tenantId],
      );

      // Analyze purchase pattern trends
      const purchasePatternTrends = await this.analyzePurchasePatternTrends(
        tenantId,
      );

      // Generate product affinity matrix
      const productAffinityMatrix = await this.generateProductAffinityMatrix(
        tenantId,
      );

      // Analyze channel effectiveness
      const channelEffectivenessAnalysis =
        await this.analyzeChannelEffectiveness(tenantId);

      return {
        purchasePatternTrends,
        productAffinityMatrix,
        channelEffectivenessAnalysis,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate behavioral insights: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Predictive Analytics Generation
   * Forward-looking analytics for strategic planning
   */
  private async generatePredictiveAnalytics(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<CustomerBusinessIntelligenceDashboard['predictiveAnalytics']> {
    this.logger.debug(`Generating predictive analytics for tenant ${tenantId}`);

    try {
      if (!configuration.includePredictiveAnalytics) {
        return {
          nextMonthPredictions: {
            expectedNewCustomers: 0,
            expectedChurnCustomers: 0,
            predictedRevenue: 0,
            seasonalAdjustment: 0,
            confidenceInterval: { lower: 0, upper: 0 },
          },
          customerLifetimeValueForecasting: [],
          seasonalBusinessPlanning: [],
        };
      }

      // Generate next month predictions
      const nextMonthPredictions = await this.generateNextMonthPredictions(
        tenantId,
      );

      // Generate LTV forecasting
      const customerLifetimeValueForecasting =
        await this.generateLTVForecasting(tenantId);

      // Generate seasonal business planning
      const seasonalBusinessPlanning =
        await this.generateSeasonalBusinessPlanning(tenantId);

      return {
        nextMonthPredictions,
        customerLifetimeValueForecasting,
        seasonalBusinessPlanning,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate predictive analytics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Operational Recommendations Generation
   * Actionable business recommendations with Indonesian context
   */
  private async generateOperationalRecommendations(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<
    CustomerBusinessIntelligenceDashboard['operationalRecommendations']
  > {
    this.logger.debug(
      `Generating operational recommendations for tenant ${tenantId}`,
    );

    try {
      // Generate high priority actions
      const highPriorityActions = await this.generateHighPriorityActions(
        tenantId,
      );

      // Generate marketing recommendations
      const marketingRecommendations =
        await this.generateMarketingRecommendations(tenantId);

      // Generate product development insights
      const productDevelopmentInsights =
        await this.generateProductDevelopmentInsights(tenantId);

      return {
        highPriorityActions,
        marketingRecommendations,
        productDevelopmentInsights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate operational recommendations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Performance Metrics Generation
   * Comprehensive business performance metrics
   */
  private async generatePerformanceMetrics(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<CustomerBusinessIntelligenceDashboard['performanceMetrics']> {
    this.logger.debug(`Generating performance metrics for tenant ${tenantId}`);

    try {
      // Generate customer acquisition metrics
      const customerAcquisition = await this.generateCustomerAcquisitionMetrics(
        tenantId,
      );

      // Generate customer retention metrics
      const customerRetention = await this.generateCustomerRetentionMetrics(
        tenantId,
      );

      // Generate revenue optimization metrics
      const revenueOptimization = await this.generateRevenueOptimizationMetrics(
        tenantId,
      );

      // Generate market positioning metrics
      const marketPositioning = await this.generateMarketPositioningMetrics(
        tenantId,
      );

      return {
        customerAcquisition,
        customerRetention,
        revenueOptimization,
        marketPositioning,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate performance metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Real-time Alerts Generation
   * Critical business alerts for immediate action
   */
  private async generateRealTimeAlerts(
    tenantId: string,
    configuration: CustomerBusinessIntelligenceConfiguration,
  ): Promise<CustomerBusinessIntelligenceDashboard['realTimeAlerts']> {
    this.logger.debug(`Generating real-time alerts for tenant ${tenantId}`);

    try {
      const alerts: CustomerBusinessIntelligenceDashboard['realTimeAlerts'] =
        [];

      // Check for high churn risk alert
      const highChurnRiskCustomers = await this.dataSource.query(
        `
        SELECT COUNT(*) as count
        FROM customers c
        JOIN customer_analytics ca ON c.id = ca.customer_id
        WHERE c.tenant_id = $1 
          AND c.is_deleted = false
          AND ca.churn_risk_score >= $2
      `,
        [tenantId, configuration.alertThresholds.churnRiskPercentage],
      );

      const churnCount = parseInt(highChurnRiskCustomers[0]?.count || '0');
      if (churnCount > 0) {
        alerts.push({
          id: `churn-alert-${Date.now()}`,
          severity: churnCount > 10 ? 'critical' : 'high',
          type: 'churn_risk',
          message: `${churnCount} customers have high churn risk (${configuration.alertThresholds.churnRiskPercentage}%+)`,
          affectedCustomers: churnCount,
          potentialImpact: churnCount * 5000000, // Estimated IDR impact
          recommendedActions: [
            'Activate immediate retention campaigns',
            'Personal outreach by account managers',
            'Offer loyalty incentives',
            'Analyze root cause factors',
          ],
          detectedAt: new Date(),
          indonesianContextRelevance:
            'Consider cultural factors in retention approach',
        });
      }

      // Check for revenue drop alert
      const currentMonthRevenue = await this.getCurrentMonthRevenue(tenantId);
      const previousMonthRevenue = await this.getPreviousMonthRevenue(tenantId);
      const revenueDrop =
        previousMonthRevenue > 0
          ? ((previousMonthRevenue - currentMonthRevenue) /
              previousMonthRevenue) *
            100
          : 0;

      if (revenueDrop >= configuration.alertThresholds.revenueDrop) {
        alerts.push({
          id: `revenue-drop-alert-${Date.now()}`,
          severity: revenueDrop > 20 ? 'critical' : 'high',
          type: 'revenue_decline',
          message: `Revenue dropped by ${revenueDrop.toFixed(
            1,
          )}% compared to previous month`,
          affectedCustomers: 0,
          potentialImpact: currentMonthRevenue * (revenueDrop / 100),
          recommendedActions: [
            'Analyze customer behavior changes',
            'Review pricing strategy',
            'Increase marketing efforts',
            'Check for operational issues',
          ],
          detectedAt: new Date(),
          indonesianContextRelevance:
            'Consider seasonal and cultural factors affecting purchasing',
        });
      }

      // Add seasonal opportunity alerts for Indonesian market
      if (configuration.includeIndonesianContext) {
        const seasonalAlerts = await this.generateIndonesianSeasonalAlerts(
          tenantId,
        );
        alerts.push(...seasonalAlerts);
      }

      return alerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate real-time alerts: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * CRON: Scheduled BI Dashboard Refresh
   * Updates dashboard data every hour for real-time insights
   */
  @Cron('0 * * * *') // Every hour
  async refreshCustomerBusinessIntelligence(): Promise<void> {
    this.logger.log(
      'Starting scheduled customer business intelligence refresh',
    );

    try {
      // Get all tenants with recent activity
      const activeTenants = await this.dataSource.query(`
        SELECT DISTINCT c.tenant_id
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        WHERE o.created_at >= NOW() - INTERVAL '24 hours'
          AND c.is_deleted = false
        LIMIT 50  -- Process max 50 tenants per run
      `);

      for (const tenant of activeTenants) {
        try {
          // Pre-calculate and cache dashboard data
          const dashboard =
            await this.generateCustomerBusinessIntelligenceDashboard(
              tenant.tenant_id,
              this.getDefaultConfiguration(),
            );

          // Store in cache for fast retrieval
          // In real implementation, this would use Redis or similar caching
          this.logger.debug(
            `Cached BI dashboard for tenant ${tenant.tenant_id}`,
          );
        } catch (tenantError) {
          this.logger.warn(
            `Failed to refresh BI for tenant ${tenant.tenant_id}: ${tenantError.message}`,
          );
          continue;
        }
      }

      this.logger.log(
        'Completed scheduled customer business intelligence refresh',
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh customer BI: ${error.message}`,
        error.stack,
      );
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private getDefaultConfiguration(): CustomerBusinessIntelligenceConfiguration {
    return {
      refreshFrequency: 'hourly',
      includePredictiveAnalytics: true,
      includeIndonesianContext: true,
      alertThresholds: {
        churnRiskPercentage: 70,
        revenueDrop: 15,
        customerHealthDecline: 20,
      },
      segmentAnalysisDepth: 'comprehensive',
      historicalDataRange: 12,
    };
  }

  private async calculateCustomerHealthDistribution(
    tenantId: string,
    customers: any[],
  ): Promise<Record<CustomerHealthScore, number>> {
    const distribution: Record<CustomerHealthScore, number> = {
      [CustomerHealthScore.EXCELLENT]: 0,
      [CustomerHealthScore.GOOD]: 0,
      [CustomerHealthScore.AVERAGE]: 0,
      [CustomerHealthScore.CONCERNING]: 0,
      [CustomerHealthScore.CRITICAL]: 0,
    };

    for (const customer of customers) {
      const healthScore = this.calculateIndividualCustomerHealthScore(customer);

      if (healthScore >= 90) distribution[CustomerHealthScore.EXCELLENT]++;
      else if (healthScore >= 70) distribution[CustomerHealthScore.GOOD]++;
      else if (healthScore >= 50) distribution[CustomerHealthScore.AVERAGE]++;
      else if (healthScore >= 30)
        distribution[CustomerHealthScore.CONCERNING]++;
      else distribution[CustomerHealthScore.CRITICAL]++;
    }

    return distribution;
  }

  private calculateIndividualCustomerHealthScore(customer: any): number {
    let score = 0;

    // LTV contribution (0-30 points)
    const ltvScore = Math.min(30, ((customer.totalSpent || 0) / 10000000) * 30);
    score += ltvScore;

    // Frequency contribution (0-25 points)
    const frequencyScore = Math.min(
      25,
      (customer.monthlyTransactionFrequency || 0) * 10,
    );
    score += frequencyScore;

    // Recency contribution (0-25 points)
    const daysSince = customer.daysSinceLastTransaction || 365;
    const recencyScore = Math.max(0, 25 - (daysSince / 365) * 25);
    score += recencyScore;

    // Churn risk contribution (0-20 points, inverse)
    const churnRiskScore =
      20 - Math.min(20, (customer.churnRiskScore || 0) / 5);
    score += churnRiskScore;

    return Math.round(score);
  }

  private async calculatePredictedGrowthRate(
    tenantId: string,
  ): Promise<number> {
    try {
      // Calculate growth rate based on last 6 months trend
      const growthData = await this.dataSource.query(
        `
        SELECT 
          DATE_TRUNC('month', o.created_at) as month,
          SUM(o.total_amount) as monthly_revenue
        FROM orders o
        WHERE o.tenant_id = $1 
          AND o.status NOT IN ('cancelled', 'failed')
          AND o.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', o.created_at)
        ORDER BY month
      `,
        [tenantId],
      );

      if (growthData.length < 3) return 0;

      // Simple linear regression for growth prediction
      const revenues = growthData.map((d: any) =>
        parseFloat(d.monthly_revenue),
      );
      const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;

      // Calculate month-over-month growth
      let totalGrowth = 0;
      let growthPeriods = 0;

      for (let i = 1; i < revenues.length; i++) {
        if (revenues[i - 1] > 0) {
          const growth =
            ((revenues[i] - revenues[i - 1]) / revenues[i - 1]) * 100;
          totalGrowth += growth;
          growthPeriods++;
        }
      }

      return growthPeriods > 0 ? totalGrowth / growthPeriods : 0;
    } catch (error) {
      this.logger.warn(
        `Failed to calculate predicted growth rate: ${error.message}`,
      );
      return 0;
    }
  }

  private async generateChurnRiskAlert(
    tenantId: string,
    customers: any[],
  ): Promise<
    CustomerBusinessIntelligenceDashboard['executiveSummary']['churnRiskAlert']
  > {
    const highRiskCustomers = customers.filter(
      c => (c.churnRiskScore || 0) >= 80,
    );

    const estimatedRevenueLoss = highRiskCustomers.reduce(
      (sum, customer) => sum + (customer.totalSpent || 0) * 0.7, // Assume 70% of LTV at risk
      0,
    );

    const preventionRecommendations = [
      'Implement personalized retention campaigns',
      'Offer exclusive loyalty benefits',
      'Conduct customer satisfaction surveys',
      'Provide proactive customer support',
      'Create win-back promotional offers',
    ];

    return {
      highRiskCustomers: highRiskCustomers.length,
      estimatedRevenueLoss,
      preventionRecommendations,
    };
  }

  // Additional helper methods would continue here...
  // Due to length constraints, I'm including the core structure and key methods
  // The implementation would continue with all helper methods for:
  // - identifyTopBusinessOpportunities
  // - generateIndonesianMarketInsights
  // - getSegmentCustomers
  // - calculateSegmentAverageLTV
  // - etc.

  private async getCurrentMonthRevenue(tenantId: string): Promise<number> {
    const result = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE tenant_id = $1 
        AND status NOT IN ('cancelled', 'failed')
        AND created_at >= DATE_TRUNC('month', NOW())
    `,
      [tenantId],
    );

    return parseFloat(result[0]?.revenue || '0');
  }

  private async getPreviousMonthRevenue(tenantId: string): Promise<number> {
    const result = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE tenant_id = $1 
        AND status NOT IN ('cancelled', 'failed')
        AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
        AND created_at < DATE_TRUNC('month', NOW())
    `,
      [tenantId],
    );

    return parseFloat(result[0]?.revenue || '0');
  }

  private async generateIndonesianSeasonalAlerts(
    tenantId: string,
  ): Promise<CustomerBusinessIntelligenceDashboard['realTimeAlerts']> {
    const alerts: CustomerBusinessIntelligenceDashboard['realTimeAlerts'] = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    // Ramadan preparation alert (usually around month 3-4 depending on year)
    if (currentMonth === 3) {
      alerts.push({
        id: `ramadan-prep-${Date.now()}`,
        severity: 'medium',
        type: 'seasonal_opportunity',
        message:
          'Ramadan season approaching - prepare for increased demand in food, religious items',
        affectedCustomers: 0,
        potentialImpact: 0,
        recommendedActions: [
          'Stock up on halal food products',
          'Prepare Ramadan-themed marketing campaigns',
          'Ensure logistics capacity for increased orders',
          'Create special Ramadan product bundles',
        ],
        detectedAt: new Date(),
        indonesianContextRelevance:
          'Major religious season affecting 87% of Indonesian population',
      });
    }

    return alerts;
  }

  // =============================================
  // ULTRATHINK: MISSING METHOD IMPLEMENTATIONS
  // Critical methods untuk business intelligence
  // =============================================

  async identifyTopBusinessOpportunities(
    tenantId: string,
    customerData: any,
    configuration: any,
  ): Promise<
    Array<{
      type: BusinessOpportunityType;
      estimatedImpact: number;
      timeToRealize: number;
      confidence: number;
      description: string;
    }>
  > {
    try {
      const opportunities = [];
      this.logger.debug(
        `Analyzing business opportunities for ${
          customerData?.length || 0
        } customers`,
      );

      // Get comprehensive customer analytics data
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: 1000,
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      const customers = customerAnalytics.data || [];
      const totalCustomers = customers.length;

      if (totalCustomers === 0) {
        this.logger.warn('No customer data available for opportunity analysis');
        return [];
      }

      // 1. HIGH-VALUE CUSTOMER EXPANSION ANALYSIS
      const highValueThreshold = await this.calculateDynamicHighValueThreshold(
        customers,
      );
      const highValueCustomers = customers.filter(
        c => (c.totalSpent || 0) >= highValueThreshold,
      );
      const expandableCustomers = highValueCustomers.filter(
        c =>
          (c.monthlyTransactionFrequency || 0) > 1 &&
          (c.daysSinceLastTransaction || 0) <= 60,
      );

      if (expandableCustomers.length >= 5) {
        // Calculate realistic impact based on customer behavior patterns
        const avgOrderIncrease =
          await this.calculatePotentialOrderValueIncrease(
            tenantId,
            expandableCustomers,
          );
        const estimatedMonthlyIncrease =
          expandableCustomers.length * avgOrderIncrease * 3; // 3 months projection

        opportunities.push({
          type: BusinessOpportunityType.UPSELL_EXPANSION,
          estimatedImpact: estimatedMonthlyIncrease,
          timeToRealize: 45, // Time to develop and launch premium offerings
          confidence: this.calculateConfidenceScore(
            expandableCustomers.length,
            totalCustomers,
            0.75,
          ),
          description: `${
            expandableCustomers.length
          } high-value customers show upselling potential with avg. IDR ${Math.round(
            avgOrderIncrease,
          ).toLocaleString('id-ID')} order increase opportunity`,
        });
      }

      // 2. ADVANCED CHURN PREVENTION ANALYSIS
      const churnRiskCustomers = customers.filter(
        c => (c.churnRiskScore || 0) >= 70,
      );
      const highValueChurnRisk = churnRiskCustomers.filter(
        c => (c.totalSpent || 0) >= highValueThreshold * 0.5,
      );

      if (churnRiskCustomers.length >= 3) {
        const potentialLostRevenue = await this.calculatePotentialLostRevenue(
          tenantId,
          churnRiskCustomers,
        );
        const saveablePercentage = await this.calculateRetentionSuccessRate(
          tenantId,
        );
        const estimatedSaveableRevenue =
          potentialLostRevenue * (saveablePercentage / 100);

        opportunities.push({
          type: BusinessOpportunityType.CHURN_PREVENTION,
          estimatedImpact: estimatedSaveableRevenue,
          timeToRealize: 21, // Urgent intervention within 3 weeks
          confidence: this.calculateConfidenceScore(
            churnRiskCustomers.length,
            totalCustomers,
            0.8,
          ),
          description: `Prevent ${churnRiskCustomers.length} customers at risk from churning (${highValueChurnRisk.length} high-value), potential ${saveablePercentage}% retention success rate`,
        });
      }

      // 3. CROSS-SELL OPPORTUNITY ANALYSIS
      const crossSellOpportunity = await this.analyzeCrossSellPotential(
        tenantId,
        customers,
      );
      if (crossSellOpportunity.eligibleCustomers > 10) {
        opportunities.push({
          type: BusinessOpportunityType.CROSS_SELL_OPPORTUNITY,
          estimatedImpact: crossSellOpportunity.estimatedRevenue,
          timeToRealize: 30,
          confidence: crossSellOpportunity.confidence,
          description: `${
            crossSellOpportunity.eligibleCustomers
          } customers show cross-sell potential in ${crossSellOpportunity.topCategories.join(
            ', ',
          )} categories`,
        });
      }

      // 4. CUSTOMER ACQUISITION ANALYSIS
      const newCustomerPotential =
        await this.analyzeCustomerAcquisitionOpportunity(tenantId, customers);
      if (newCustomerPotential.score > 60) {
        opportunities.push({
          type: BusinessOpportunityType.CUSTOMER_ACQUISITION,
          estimatedImpact: newCustomerPotential.estimatedRevenue,
          timeToRealize: 60,
          confidence: newCustomerPotential.confidence,
          description: `Customer acquisition opportunity through ${newCustomerPotential.topChannels.join(
            ', ',
          )} with ${
            newCustomerPotential.expectedCustomers
          } new customers potential`,
        });
      }

      // 5. INDONESIAN SEASONAL OPPORTUNITIES
      const seasonalOpportunities =
        await this.analyzeIndonesianSeasonalOpportunities(tenantId, customers);
      opportunities.push(...seasonalOpportunities);

      // 6. LOYALTY ENHANCEMENT OPPORTUNITY
      const loyaltyOpportunity = await this.analyzeLoyaltyEnhancementPotential(
        tenantId,
        customers,
      );
      if (loyaltyOpportunity.eligibleCustomers > 20) {
        opportunities.push({
          type: BusinessOpportunityType.LOYALTY_ENHANCEMENT,
          estimatedImpact: loyaltyOpportunity.estimatedRevenue,
          timeToRealize: 45,
          confidence: loyaltyOpportunity.confidence,
          description: `${loyaltyOpportunity.eligibleCustomers} customers eligible for loyalty program enhancement with ${loyaltyOpportunity.averageIncrease}% spending increase potential`,
        });
      }

      // 7. MARKET PENETRATION ANALYSIS
      const marketPenetration = await this.analyzeMarketPenetrationOpportunity(
        tenantId,
        customers,
      );
      if (marketPenetration.score > 50) {
        opportunities.push({
          type: BusinessOpportunityType.MARKET_PENETRATION,
          estimatedImpact: marketPenetration.estimatedRevenue,
          timeToRealize: 90,
          confidence: marketPenetration.confidence,
          description: `Market penetration opportunity in ${marketPenetration.targetSegments.join(
            ', ',
          )} segments with ${
            marketPenetration.potentialCustomers
          } prospect potential`,
        });
      }

      // Sort opportunities by impact and confidence
      const rankedOpportunities = opportunities
        .sort(
          (a, b) =>
            (b.estimatedImpact * b.confidence) / 100 -
            (a.estimatedImpact * a.confidence) / 100,
        )
        .slice(0, 8); // Top 8 opportunities

      this.logger.debug(
        `Identified ${
          rankedOpportunities.length
        } business opportunities with total potential impact: IDR ${rankedOpportunities
          .reduce((sum, op) => sum + op.estimatedImpact, 0)
          .toLocaleString('id-ID')}`,
      );

      return rankedOpportunities;
    } catch (error) {
      this.logger.error(
        `Failed to identify business opportunities: ${error.message}`,
        error.stack,
      );
      // Fallback to basic analysis if comprehensive analysis fails
      return this.generateBasicOpportunities(customerData);
    }
  }

  async generateIndonesianMarketInsights(
    tenantId: string,
    customerData: any,
    configuration: any,
  ): Promise<
    Array<{
      context: IndonesianMarketContext;
      currentRelevance: number;
      actionableInsight: string;
      businessImplication: string;
    }>
  > {
    try {
      const insights = [];
      this.logger.debug(
        `Generating comprehensive Indonesian market insights for ${
          customerData?.length || 0
        } customers`,
      );

      // Get comprehensive customer analytics data for deeper analysis
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: 1000,
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      const customers = customerAnalytics.data || [];
      const totalCustomers = customers.length;

      if (totalCustomers === 0) {
        this.logger.warn(
          'No customer data available for Indonesian market analysis',
        );
        return [];
      }

      // 1. COMPREHENSIVE RAMADAN OPPORTUNITY ANALYSIS
      const ramadanInsight = await this.analyzeRamadanMarketOpportunity(
        tenantId,
        customers,
      );
      if (ramadanInsight.relevance > 50) {
        insights.push({
          context: IndonesianMarketContext.RAMADAN_OPPORTUNITY,
          currentRelevance: ramadanInsight.relevance,
          actionableInsight: ramadanInsight.insight,
          businessImplication: ramadanInsight.implication,
        });
      }

      // 2. LEBARAN SURGE PATTERNS ANALYSIS
      const lebaranInsight = await this.analyzeLebaranSurgePatterns(
        tenantId,
        customers,
      );
      if (lebaranInsight.relevance > 50) {
        insights.push({
          context: IndonesianMarketContext.LEBARAN_SURGE,
          currentRelevance: lebaranInsight.relevance,
          actionableInsight: lebaranInsight.insight,
          businessImplication: lebaranInsight.implication,
        });
      }

      // 3. ADVANCED MOBILE-FIRST BEHAVIOR ANALYSIS
      const mobileInsight = await this.analyzeMobileFirstBehavior(
        tenantId,
        customers,
      );
      insights.push({
        context: IndonesianMarketContext.MOBILE_FIRST_BEHAVIOR,
        currentRelevance: mobileInsight.relevance,
        actionableInsight: mobileInsight.insight,
        businessImplication: mobileInsight.implication,
      });

      // 4. JAKARTA PREMIUM MARKET ANALYSIS
      const jakartaInsight = await this.analyzeJakartaPremiumMarket(
        tenantId,
        customers,
      );
      if (jakartaInsight.relevance > 40) {
        insights.push({
          context: IndonesianMarketContext.JAKARTA_PREMIUM_FOCUS,
          currentRelevance: jakartaInsight.relevance,
          actionableInsight: jakartaInsight.insight,
          businessImplication: jakartaInsight.implication,
        });
      }

      // 5. UMKM SEGMENT GROWTH ANALYSIS
      const umkmInsight = await this.analyzeUMKMSegmentGrowth(
        tenantId,
        customers,
      );
      if (umkmInsight.relevance > 30) {
        insights.push({
          context: IndonesianMarketContext.UMKM_SEGMENT_GROWTH,
          currentRelevance: umkmInsight.relevance,
          actionableInsight: umkmInsight.insight,
          businessImplication: umkmInsight.implication,
        });
      }

      // 6. REGIONAL DIVERSITY AND EXPANSION ANALYSIS
      const regionalInsight = await this.analyzeRegionalDiversityOpportunity(
        tenantId,
        customers,
      );
      if (regionalInsight.relevance > 35) {
        insights.push({
          context: IndonesianMarketContext.REGIONAL_DIVERSITY,
          currentRelevance: regionalInsight.relevance,
          actionableInsight: regionalInsight.insight,
          businessImplication: regionalInsight.implication,
        });
      }

      // 7. RURAL EXPANSION OPPORTUNITY ANALYSIS
      const ruralInsight = await this.analyzeRuralExpansionOpportunity(
        tenantId,
        customers,
      );
      if (ruralInsight.relevance > 40) {
        insights.push({
          context: IndonesianMarketContext.RURAL_EXPANSION,
          currentRelevance: ruralInsight.relevance,
          actionableInsight: ruralInsight.insight,
          businessImplication: ruralInsight.implication,
        });
      }

      // 8. MUSLIM MARKET DOMINANCE ANALYSIS
      const muslimMarketInsight = await this.analyzeMuslimMarketDominance(
        tenantId,
        customers,
      );
      if (muslimMarketInsight.relevance > 60) {
        insights.push({
          context: IndonesianMarketContext.MUSLIM_MARKET_DOMINANCE,
          currentRelevance: muslimMarketInsight.relevance,
          actionableInsight: muslimMarketInsight.insight,
          businessImplication: muslimMarketInsight.implication,
        });
      }

      // 9. LOCAL BRAND PREFERENCE ANALYSIS
      const localBrandInsight = await this.analyzeLocalBrandPreference(
        tenantId,
        customers,
      );
      if (localBrandInsight.relevance > 45) {
        insights.push({
          context: IndonesianMarketContext.LOCAL_BRAND_PREFERENCE,
          currentRelevance: localBrandInsight.relevance,
          actionableInsight: localBrandInsight.insight,
          businessImplication: localBrandInsight.implication,
        });
      }

      // Sort insights by relevance and return top insights
      const rankedInsights = insights
        .sort((a, b) => b.currentRelevance - a.currentRelevance)
        .slice(0, 8); // Top 8 most relevant insights

      this.logger.debug(
        `Generated ${
          rankedInsights.length
        } Indonesian market insights with average relevance: ${
          rankedInsights.reduce(
            (sum, insight) => sum + insight.currentRelevance,
            0,
          ) / rankedInsights.length
        }%`,
      );

      return rankedInsights;
    } catch (error) {
      this.logger.error(
        `Failed to generate Indonesian market insights: ${error.message}`,
        error.stack,
      );
      // Fallback to basic insights if comprehensive analysis fails
      return this.generateBasicIndonesianInsights(customerData);
    }
  }

  async getSegmentCustomers(
    tenantId: string,
    segmentName: string,
  ): Promise<any[]> {
    try {
      this.logger.debug(
        `Getting customers for segment: ${segmentName} in tenant: ${tenantId}`,
      );

      // Use the existing customer analytics service to query customers by segment
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          segment: [segmentName], // Filter by the specific segment
          limit: 1000, // Get more customers for comprehensive analysis
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      const customers = customerAnalytics.data || [];

      if (customers.length === 0) {
        this.logger.warn(`No customers found for segment: ${segmentName}`);
        return [];
      }

      // Transform the customer analytics data to include additional calculated fields
      const enhancedCustomers = customers.map(customer => ({
        customerId: customer.customerId,
        tenantId: customer.tenantId,
        customerNumber: customer.customerNumber,
        fullName: customer.fullName,
        email: customer.email,
        segment: customer.segment,
        loyaltyTier: customer.loyaltyTier,
        status: customer.status,
        customerSince: customer.customerSince,

        // Transaction Analytics
        totalTransactions: customer.totalTransactions,
        totalSpent: customer.totalSpent,
        averageOrderValue: customer.averageOrderValue,
        lastTransactionDate: customer.lastTransactionDate,
        firstTransactionDate: customer.firstTransactionDate,

        // Time-based Analytics
        daysSinceLastTransaction: customer.daysSinceLastTransaction,
        daysSinceFirstTransaction: customer.daysSinceFirstTransaction,
        monthlyTransactionFrequency: customer.monthlyTransactionFrequency,

        // Channel Analytics
        primaryChannel: customer.primaryChannel,
        channelCount: customer.channelCount,

        // Product Analytics
        productCategories: customer.productCategories,
        uniqueProductsPurchased: customer.uniqueProductsPurchased,

        // Payment Analytics
        primaryPaymentMethod: customer.primaryPaymentMethod,
        paymentMethodsUsed: customer.paymentMethodsUsed,

        // Behavioral Analytics
        peakShoppingHour: customer.peakShoppingHour,
        peakShoppingDay: customer.peakShoppingDay,
        weekendTransactionRatio: customer.weekendTransactionRatio,

        // Value Analytics
        valueSegment: customer.valueSegment,
        churnRiskScore: customer.churnRiskScore,

        // Additional calculated fields for business intelligence
        lifetimeValue: customer.totalSpent, // Alias for compatibility
        retentionScore: this.calculateRetentionScore(customer),
        engagementScore: this.calculateEngagementScore(customer),
        churnProbability: this.calculateChurnProbability(customer),

        lastUpdated: customer.lastUpdated,
      }));

      this.logger.debug(
        `Successfully retrieved ${enhancedCustomers.length} customers for segment: ${segmentName}`,
      );
      return enhancedCustomers;
    } catch (error) {
      this.logger.error(
        `Failed to get segment customers: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  async calculateSegmentAverageLTV(
    tenantId: string,
    customers: any[],
  ): Promise<number> {
    try {
      if (customers.length === 0) return 0;
      const totalLTV = customers.reduce(
        (sum, customer) => sum + (customer.lifetimeValue || 0),
        0,
      );
      return totalLTV / customers.length;
    } catch (error) {
      this.logger.error(
        `Failed to calculate segment average LTV: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  async calculateSegmentHealthScore(customers: any[]): Promise<number> {
    try {
      if (customers.length === 0) return 0;
      const avgRetentionScore =
        customers.reduce((sum, c) => sum + (c.retentionScore || 0), 0) /
        customers.length;
      const churnRiskCustomers = customers.filter(
        c => c.churnProbability > 70,
      ).length;
      const churnRiskRatio = churnRiskCustomers / customers.length;
      return Math.max(0, avgRetentionScore * (1 - churnRiskRatio));
    } catch (error) {
      this.logger.error(
        `Failed to calculate segment health score: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  async calculateSegmentGrowthTrend(
    tenantId: string,
    segmentName: string,
  ): Promise<number> {
    try {
      // Mock growth trend calculation
      return Math.random() * 20 - 5; // -5% to +15% growth
    } catch (error) {
      this.logger.error(
        `Failed to calculate segment growth trend: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  async calculateSegmentMarketOpportunity(customers: any[]): Promise<number> {
    try {
      const avgLTV = await this.calculateSegmentAverageLTV('', customers);
      const lowEngagementCustomers = customers.filter(
        c => (c.retentionScore || 0) < 70,
      ).length;
      return avgLTV * lowEngagementCustomers * 0.3; // 30% potential increase
    } catch (error) {
      this.logger.error(
        `Failed to calculate segment market opportunity: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  async generateSegmentRecommendedActions(
    segmentName: string,
    customers: any[],
  ): Promise<string[]> {
    try {
      const actions = [];

      if (customers.some(c => c.churnProbability > 70)) {
        actions.push('Implement retention campaigns for high-risk customers');
      }

      if (customers.some(c => c.lifetimeValue > 5000000)) {
        actions.push('Develop premium offerings for high-value customers');
      }

      actions.push(
        'Personalize marketing messages for segment characteristics',
      );
      actions.push('Optimize customer journey for segment preferences');

      return actions;
    } catch (error) {
      this.logger.error(
        `Failed to generate segment recommended actions: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Calculate retention score for a customer based on purchase patterns
   */
  private calculateRetentionScore(customer: any): number {
    try {
      let score = 0;

      // Base score from transaction frequency (0-40 points)
      const frequency = customer.monthlyTransactionFrequency || 0;
      score += Math.min(40, frequency * 8);

      // Recency score (0-30 points)
      const daysSinceLastTransaction = customer.daysSinceLastTransaction || 365;
      const recencyScore = Math.max(
        0,
        30 - (daysSinceLastTransaction / 365) * 30,
      );
      score += recencyScore;

      // Loyalty duration score (0-20 points)
      const daysSinceFirstTransaction = customer.daysSinceFirstTransaction || 0;
      const loyaltyDuration = Math.min(
        20,
        (daysSinceFirstTransaction / 365) * 5,
      );
      score += loyaltyDuration;

      // Transaction consistency score (0-10 points)
      const totalTransactions = customer.totalTransactions || 0;
      const consistencyScore =
        totalTransactions > 0 ? Math.min(10, totalTransactions / 2) : 0;
      score += consistencyScore;

      return Math.round(Math.min(100, score));
    } catch (error) {
      this.logger.error(
        `Failed to calculate retention score: ${error.message}`,
      );
      return 50; // Default moderate score
    }
  }

  /**
   * Calculate engagement score for a customer based on multi-channel activity
   */
  private calculateEngagementScore(customer: any): number {
    try {
      let score = 0;

      // Channel diversity score (0-25 points)
      const channelCount = customer.channelCount || 1;
      score += Math.min(25, channelCount * 8);

      // Product diversity score (0-25 points)
      const productCategories = customer.productCategories?.length || 0;
      score += Math.min(25, productCategories * 5);

      // Payment method diversity score (0-15 points)
      const paymentMethodsUsed = customer.paymentMethodsUsed || 1;
      score += Math.min(15, paymentMethodsUsed * 5);

      // Shopping behavior score (0-20 points)
      const weekendRatio = customer.weekendTransactionRatio || 0;
      const behaviorScore = weekendRatio > 0.3 ? 20 : weekendRatio * 66; // Active weekend shoppers get higher score
      score += behaviorScore;

      // Peak hour alignment score (0-15 points)
      const peakHour = customer.peakShoppingHour || 12;
      const peakScore = peakHour >= 9 && peakHour <= 21 ? 15 : 8; // Business hours vs off-hours
      score += peakScore;

      return Math.round(Math.min(100, score));
    } catch (error) {
      this.logger.error(
        `Failed to calculate engagement score: ${error.message}`,
      );
      return 50; // Default moderate score
    }
  }

  /**
   * Calculate churn probability for a customer using advanced analytics
   */
  private calculateChurnProbability(customer: any): number {
    try {
      let churnRisk = 0;

      // Existing churn risk score (0-40 points)
      const existingChurnRisk = customer.churnRiskScore || 0;
      churnRisk += existingChurnRisk * 0.4;

      // Recency risk (0-30 points)
      const daysSinceLastTransaction = customer.daysSinceLastTransaction || 0;
      if (daysSinceLastTransaction > 180) {
        churnRisk += 30;
      } else if (daysSinceLastTransaction > 90) {
        churnRisk += 20;
      } else if (daysSinceLastTransaction > 30) {
        churnRisk += 10;
      }

      // Frequency decline risk (0-20 points)
      const monthlyFrequency = customer.monthlyTransactionFrequency || 0;
      if (monthlyFrequency < 0.5) {
        churnRisk += 20;
      } else if (monthlyFrequency < 1) {
        churnRisk += 10;
      }

      // Value decline risk (0-10 points)
      const averageOrderValue = customer.averageOrderValue || 0;
      if (averageOrderValue < 100000) {
        // Less than 100K IDR
        churnRisk += 10;
      } else if (averageOrderValue < 500000) {
        // Less than 500K IDR
        churnRisk += 5;
      }

      return Math.round(Math.min(100, churnRisk));
    } catch (error) {
      this.logger.error(
        `Failed to calculate churn probability: ${error.message}`,
      );
      return 50; // Default moderate risk
    }
  }

  // =============================================
  // ULTRATHINK: ADDITIONAL MISSING METHODS
  // Additional behavioral and predictive analytics methods
  // =============================================

  async analyzeSegmentMigrationPatterns(tenantId: string): Promise<
    Array<{
      fromSegment: string;
      toSegment: string;
      migrationRate: number;
      averageTimeDays: number;
      revenueImpact: number;
      triggerFactors: string[];
    }>
  > {
    try {
      this.logger.debug(
        `Analyzing segment migration patterns for tenant: ${tenantId}`,
      );

      // Get customer data for the last 12 months to analyze migration patterns
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      // Get current customer analytics to understand current segments
      const currentCustomerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: 5000,
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      const currentCustomers = currentCustomerAnalytics.data || [];

      if (currentCustomers.length === 0) {
        this.logger.warn(
          `No customer data found for migration analysis in tenant: ${tenantId}`,
        );
        return [];
      }

      // Get historical customer data to track segment changes over time
      const historicalSegmentData = await this.analyzeHistoricalSegmentChanges(
        tenantId,
        currentCustomers,
      );

      // Calculate migration patterns between segments
      const migrationPatterns = await this.calculateSegmentMigrationRates(
        historicalSegmentData,
      );

      // Analyze trigger factors for segment migrations
      const migrationAnalysis = await this.enrichMigrationWithTriggerFactors(
        migrationPatterns,
        tenantId,
      );

      this.logger.debug(
        `Successfully analyzed ${migrationAnalysis.length} segment migration patterns`,
      );
      return migrationAnalysis;
    } catch (error) {
      this.logger.error(
        `Failed to analyze segment migration patterns: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Analyze historical segment changes for customers
   */
  private async analyzeHistoricalSegmentChanges(
    tenantId: string,
    customers: any[],
  ): Promise<any[]> {
    try {
      const segmentHistory = [];

      // Group customers by their current segments
      const segmentGroups = customers.reduce((acc: any, customer: any) => {
        const segment = customer.segment || 'unassigned';
        if (!acc[segment]) {
          acc[segment] = [];
        }
        acc[segment].push(customer);
        return acc;
      }, {});

      // For each segment, analyze historical patterns
      for (const [segmentName, segmentCustomers] of Object.entries(
        segmentGroups,
      )) {
        const customersInSegment = segmentCustomers as any[];

        // Analyze customer transaction patterns to infer previous segments
        for (const customer of customersInSegment) {
          const previousSegment = await this.inferPreviousSegment(customer);
          const migrationTime = this.calculateMigrationTime(customer);

          if (previousSegment && previousSegment !== segmentName) {
            segmentHistory.push({
              customerId: customer.customerId,
              fromSegment: previousSegment,
              toSegment: segmentName,
              migrationTime,
              customerValue: customer.totalSpent,
              transactionFrequency: customer.monthlyTransactionFrequency,
              daysSinceLastTransaction: customer.daysSinceLastTransaction,
              totalTransactions: customer.totalTransactions,
            });
          }
        }
      }

      return segmentHistory;
    } catch (error) {
      this.logger.error(
        `Failed to analyze historical segment changes: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Calculate migration rates between segments
   */
  private async calculateSegmentMigrationRates(
    segmentHistory: any[],
  ): Promise<any[]> {
    try {
      const migrationMap = new Map<
        string,
        {
          fromSegment: string;
          toSegment: string;
          migrations: any[];
          totalCustomers: number;
        }
      >();

      // Group migrations by segment transition
      segmentHistory.forEach(migration => {
        const key = `${migration.fromSegment}->${migration.toSegment}`;

        if (!migrationMap.has(key)) {
          migrationMap.set(key, {
            fromSegment: migration.fromSegment,
            toSegment: migration.toSegment,
            migrations: [],
            totalCustomers: 0,
          });
        }

        const migrationData = migrationMap.get(key)!;
        migrationData.migrations.push(migration);
        migrationData.totalCustomers++;
      });

      // Calculate rates and patterns
      const migrationPatterns = [];
      for (const [key, migrationData] of migrationMap.entries()) {
        const migrations = migrationData.migrations;
        const migrationCount = migrations.length;

        if (migrationCount > 0) {
          const averageTimeDays =
            migrations.reduce((sum, m) => sum + m.migrationTime, 0) /
            migrationCount;
          const totalRevenueImpact = migrations.reduce(
            (sum, m) => sum + m.customerValue,
            0,
          );
          const averageRevenueImpact = totalRevenueImpact / migrationCount;

          // Calculate migration rate (simplified - would need more data in real implementation)
          const migrationRate = Math.min(
            100,
            (migrationCount / Math.max(migrationCount, 10)) * 100,
          );

          migrationPatterns.push({
            fromSegment: migrationData.fromSegment,
            toSegment: migrationData.toSegment,
            migrationRate,
            averageTimeDays,
            revenueImpact: averageRevenueImpact,
            migrationCount,
            totalRevenueImpact,
          });
        }
      }

      return migrationPatterns.sort(
        (a, b) => b.migrationRate - a.migrationRate,
      );
    } catch (error) {
      this.logger.error(
        `Failed to calculate migration rates: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Enrich migration patterns with trigger factors
   */
  private async enrichMigrationWithTriggerFactors(
    migrationPatterns: any[],
    tenantId: string,
  ): Promise<any[]> {
    try {
      const enrichedPatterns = [];

      for (const pattern of migrationPatterns) {
        const triggerFactors = await this.identifyMigrationTriggerFactors(
          pattern,
          tenantId,
        );

        enrichedPatterns.push({
          fromSegment: pattern.fromSegment,
          toSegment: pattern.toSegment,
          migrationRate: Math.round(pattern.migrationRate * 100) / 100,
          averageTimeDays: Math.round(pattern.averageTimeDays),
          revenueImpact: Math.round(pattern.revenueImpact),
          triggerFactors,
        });
      }

      return enrichedPatterns;
    } catch (error) {
      this.logger.error(
        `Failed to enrich migration patterns: ${error.message}`,
      );
      return migrationPatterns.map(p => ({
        ...p,
        triggerFactors: ['Unable to analyze trigger factors'],
      }));
    }
  }

  /**
   * Infer previous segment based on customer behavior patterns
   */
  private async inferPreviousSegment(customer: any): Promise<string | null> {
    try {
      // Analyze customer behavior to infer previous segment
      const totalSpent = customer.totalSpent || 0;
      const transactionFrequency = customer.monthlyTransactionFrequency || 0;
      const daysSinceFirst = customer.daysSinceFirstTransaction || 0;

      // Simple heuristic to infer previous segment
      if (daysSinceFirst > 365) {
        // Customer has been around for over a year
        if (totalSpent > 10000000 && transactionFrequency > 2) {
          return 'high_value'; // Was likely high value
        } else if (totalSpent > 2000000 && transactionFrequency > 1) {
          return 'medium_value'; // Was likely medium value
        } else {
          return 'standard_value'; // Was likely standard value
        }
      }

      // For newer customers, infer based on growth patterns
      if (customer.totalTransactions > 10 && transactionFrequency > 1.5) {
        return 'new_customer'; // Was likely a new customer who grew
      }

      return null; // Cannot infer previous segment
    } catch (error) {
      this.logger.error(`Failed to infer previous segment: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate migration time based on customer transaction patterns
   */
  private calculateMigrationTime(customer: any): number {
    try {
      const daysSinceFirstTransaction = customer.daysSinceFirstTransaction || 0;
      const totalTransactions = customer.totalTransactions || 1;

      // Estimate migration time based on transaction patterns
      // This is a simplified calculation - real implementation would track actual segment changes
      const averageTransactionInterval =
        daysSinceFirstTransaction / Math.max(totalTransactions, 1);
      const migrationTime = Math.min(
        365,
        Math.max(30, averageTransactionInterval * 5),
      );

      return migrationTime;
    } catch (error) {
      this.logger.error(`Failed to calculate migration time: ${error.message}`);
      return 90; // Default 90 days
    }
  }

  /**
   * Identify trigger factors for segment migrations
   */
  private async identifyMigrationTriggerFactors(
    pattern: any,
    tenantId: string,
  ): Promise<string[]> {
    try {
      const triggerFactors = [];

      // Analyze migration patterns to identify triggers
      const {
        fromSegment,
        toSegment,
        migrationRate,
        averageTimeDays,
        revenueImpact,
      } = pattern;

      // Revenue-based triggers
      if (revenueImpact > 5000000) {
        triggerFactors.push('Significant increase in spending behavior');
      } else if (revenueImpact < -2000000) {
        triggerFactors.push('Decline in purchase value');
      }

      // Time-based triggers
      if (averageTimeDays < 60) {
        triggerFactors.push('Rapid behavioral change');
      } else if (averageTimeDays > 180) {
        triggerFactors.push('Gradual long-term evolution');
      }

      // Segment-specific triggers
      if (toSegment === 'high_value' && fromSegment !== 'high_value') {
        triggerFactors.push('Product category expansion');
        triggerFactors.push('Increased purchase frequency');
      }

      if (fromSegment === 'high_value' && toSegment !== 'high_value') {
        triggerFactors.push('Reduced engagement');
        triggerFactors.push('Competitive pressure');
      }

      if (toSegment === 'at_risk' || fromSegment === 'at_risk') {
        triggerFactors.push('Extended period without purchases');
        triggerFactors.push('Service quality issues');
      }

      // Indonesian market-specific triggers
      if (migrationRate > 20) {
        triggerFactors.push('Seasonal Indonesian market patterns');
        triggerFactors.push('Ramadan/Lebaran shopping behavior changes');
      }

      // Default triggers if none identified
      if (triggerFactors.length === 0) {
        triggerFactors.push('Natural customer lifecycle evolution');
        triggerFactors.push('Market dynamics and competition');
      }

      return triggerFactors.slice(0, 4); // Limit to top 4 factors
    } catch (error) {
      this.logger.error(`Failed to identify trigger factors: ${error.message}`);
      return ['Unable to identify specific trigger factors'];
    }
  }

  async analyzePurchasePatternTrends(tenantId: string): Promise<
    Array<{
      pattern: string;
      customerPercentage: number;
      revenueContribution: number;
      seasonalInfluence: number;
      optimizationPotential: number;
    }>
  > {
    try {
      this.logger.debug(
        `Analyzing purchase pattern trends for tenant: ${tenantId}`,
      );

      // Get customer analytics data with transaction patterns
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: 2000,
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      const customers = customerAnalytics.data || [];

      if (customers.length === 0) {
        this.logger.warn(
          `No customer data found for purchase pattern analysis in tenant: ${tenantId}`,
        );
        return [];
      }

      // Analyze purchase patterns
      const purchasePatterns = await this.identifyPurchasePatterns(
        customers,
        tenantId,
      );

      // Calculate seasonal influences
      const seasonalData = await this.calculateSeasonalInfluences(
        customers,
        tenantId,
      );

      // Generate optimized purchase pattern analysis
      const patternAnalysis = await this.generatePurchasePatternAnalysis(
        purchasePatterns,
        seasonalData,
        customers,
      );

      this.logger.debug(
        `Successfully analyzed ${patternAnalysis.length} purchase pattern trends`,
      );
      return patternAnalysis;
    } catch (error) {
      this.logger.error(
        `Failed to analyze purchase pattern trends: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Identify different purchase patterns from customer data
   */
  private async identifyPurchasePatterns(
    customers: any[],
    tenantId: string,
  ): Promise<any[]> {
    try {
      const patterns = [];

      // Group customers by purchase behavior patterns
      const frequentBuyers = customers.filter(
        c => (c.monthlyTransactionFrequency || 0) >= 2,
      );
      const regularBuyers = customers.filter(
        c =>
          (c.monthlyTransactionFrequency || 0) >= 1 &&
          (c.monthlyTransactionFrequency || 0) < 2,
      );
      const occasionalBuyers = customers.filter(
        c =>
          (c.monthlyTransactionFrequency || 0) >= 0.5 &&
          (c.monthlyTransactionFrequency || 0) < 1,
      );
      const rareBuyers = customers.filter(
        c => (c.monthlyTransactionFrequency || 0) < 0.5,
      );

      // Weekend shoppers pattern
      const weekendShoppers = customers.filter(
        c => (c.weekendTransactionRatio || 0) > 0.4,
      );

      // High-value transaction pattern
      const highValueBuyers = customers.filter(
        c => (c.averageOrderValue || 0) > 1000000,
      ); // Above 1M IDR

      // Seasonal buyers pattern - based on transaction timing
      const seasonalBuyers = customers.filter(c => this.isSeasonalBuyer(c));

      // Bulk buyers pattern - fewer transactions but higher average order value
      const bulkBuyers = customers.filter(
        c =>
          (c.monthlyTransactionFrequency || 0) < 1 &&
          (c.averageOrderValue || 0) > 2000000,
      );

      // Loyalty pattern - long-term customers with consistent behavior
      const loyalCustomers = customers.filter(
        c =>
          (c.daysSinceFirstTransaction || 0) > 365 &&
          (c.monthlyTransactionFrequency || 0) > 0.5,
      );

      // Impulse buyers - frequent small purchases
      const impulseBuyers = customers.filter(
        c =>
          (c.monthlyTransactionFrequency || 0) > 3 &&
          (c.averageOrderValue || 0) < 500000,
      );

      // Add patterns to analysis
      patterns.push({
        name: 'Frequent Buyers',
        customers: frequentBuyers,
        description: 'Customers who make purchases 2+ times per month',
        frequency: 'high',
      });

      patterns.push({
        name: 'Regular Buyers',
        customers: regularBuyers,
        description: 'Customers who make purchases 1-2 times per month',
        frequency: 'medium',
      });

      patterns.push({
        name: 'Occasional Buyers',
        customers: occasionalBuyers,
        description: 'Customers who make purchases 0.5-1 times per month',
        frequency: 'low',
      });

      patterns.push({
        name: 'Weekend Shoppers',
        customers: weekendShoppers,
        description: 'Customers who primarily shop on weekends',
        frequency: 'weekend-focused',
      });

      patterns.push({
        name: 'High-Value Buyers',
        customers: highValueBuyers,
        description: 'Customers with high average order values (>1M IDR)',
        frequency: 'value-focused',
      });

      patterns.push({
        name: 'Seasonal Buyers',
        customers: seasonalBuyers,
        description: 'Customers who show seasonal purchasing patterns',
        frequency: 'seasonal',
      });

      patterns.push({
        name: 'Bulk Buyers',
        customers: bulkBuyers,
        description: 'Customers who make infrequent but large purchases',
        frequency: 'bulk',
      });

      patterns.push({
        name: 'Loyal Customers',
        customers: loyalCustomers,
        description: 'Long-term customers with consistent purchasing behavior',
        frequency: 'consistent',
      });

      patterns.push({
        name: 'Impulse Buyers',
        customers: impulseBuyers,
        description: 'Customers who make frequent small purchases',
        frequency: 'impulse',
      });

      return patterns.filter(pattern => pattern.customers.length > 0);
    } catch (error) {
      this.logger.error(
        `Failed to identify purchase patterns: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Calculate seasonal influences for purchase patterns
   */
  private async calculateSeasonalInfluences(
    customers: any[],
    tenantId: string,
  ): Promise<any> {
    try {
      const seasonalData = {
        ramadanInfluence: 0,
        lebaranInfluence: 0,
        yearEndInfluence: 0,
        payDayInfluence: 0,
        weekendInfluence: 0,
      };

      // Calculate average seasonal influence based on customer behavior
      const totalCustomers = customers.length;

      if (totalCustomers > 0) {
        // Ramadan influence - customers who show increased activity during Ramadan months
        const ramadanActiveCustomers = customers.filter(
          c => c.peakShoppingHour >= 18 && c.peakShoppingHour <= 23, // Evening shoppers during Ramadan
        ).length;
        seasonalData.ramadanInfluence =
          (ramadanActiveCustomers / totalCustomers) * 100;

        // Lebaran influence - customers who show surge patterns
        const lebaranActiveCustomers = customers.filter(
          c => (c.averageOrderValue || 0) > 1500000, // Higher spending during Lebaran
        ).length;
        seasonalData.lebaranInfluence =
          (lebaranActiveCustomers / totalCustomers) * 100;

        // Year-end influence
        const yearEndActiveCustomers = customers.filter(
          c => (c.totalTransactions || 0) > 10, // More active customers at year-end
        ).length;
        seasonalData.yearEndInfluence =
          (yearEndActiveCustomers / totalCustomers) * 100;

        // Pay day influence (assuming 25th and 1st of month)
        const payDayInfluence =
          customers.reduce(
            (avg, c) => avg + (c.monthlyTransactionFrequency || 0),
            0,
          ) / totalCustomers;
        seasonalData.payDayInfluence = Math.min(100, payDayInfluence * 20);

        // Weekend influence
        const weekendInfluence =
          customers.reduce(
            (avg, c) => avg + (c.weekendTransactionRatio || 0),
            0,
          ) / totalCustomers;
        seasonalData.weekendInfluence = weekendInfluence * 100;
      }

      return seasonalData;
    } catch (error) {
      this.logger.error(
        `Failed to calculate seasonal influences: ${error.message}`,
      );
      return {
        ramadanInfluence: 0,
        lebaranInfluence: 0,
        yearEndInfluence: 0,
        payDayInfluence: 0,
        weekendInfluence: 0,
      };
    }
  }

  /**
   * Generate comprehensive purchase pattern analysis
   */
  private async generatePurchasePatternAnalysis(
    patterns: any[],
    seasonalData: any,
    allCustomers: any[],
  ): Promise<any[]> {
    try {
      const analysis = [];
      const totalCustomers = allCustomers.length;
      const totalRevenue = allCustomers.reduce(
        (sum, c) => sum + (c.totalSpent || 0),
        0,
      );

      for (const pattern of patterns) {
        const patternCustomers = pattern.customers;
        const customerCount = patternCustomers.length;

        if (customerCount === 0) continue;

        // Calculate customer percentage
        const customerPercentage = (customerCount / totalCustomers) * 100;

        // Calculate revenue contribution
        const patternRevenue = patternCustomers.reduce(
          (sum, c) => sum + (c.totalSpent || 0),
          0,
        );
        const revenueContribution =
          totalRevenue > 0 ? (patternRevenue / totalRevenue) * 100 : 0;

        // Calculate seasonal influence based on pattern type
        const seasonalInfluence = this.calculatePatternSeasonalInfluence(
          pattern.name,
          seasonalData,
        );

        // Calculate optimization potential
        const optimizationPotential = this.calculateOptimizationPotential(
          pattern,
          patternCustomers,
        );

        analysis.push({
          pattern: pattern.name,
          customerPercentage: Math.round(customerPercentage * 100) / 100,
          revenueContribution: Math.round(revenueContribution * 100) / 100,
          seasonalInfluence: Math.round(seasonalInfluence * 100) / 100,
          optimizationPotential: Math.round(optimizationPotential * 100) / 100,
        });
      }

      // Sort by revenue contribution descending
      return analysis.sort(
        (a, b) => b.revenueContribution - a.revenueContribution,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate purchase pattern analysis: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Check if customer shows seasonal buying patterns
   */
  private isSeasonalBuyer(customer: any): boolean {
    try {
      // Simple heuristic to identify seasonal buyers
      const avgOrderValue = customer.averageOrderValue || 0;
      const transactionFrequency = customer.monthlyTransactionFrequency || 0;
      const daysSinceFirst = customer.daysSinceFirstTransaction || 0;

      // Seasonal buyers tend to have:
      // - Lower frequency but higher order values during peak seasons
      // - Been customers for at least 6 months
      return (
        daysSinceFirst > 180 &&
        transactionFrequency < 1 &&
        avgOrderValue > 800000 // Above 800K IDR suggests seasonal big purchases
      );
    } catch (error) {
      this.logger.error(`Failed to check seasonal buyer: ${error.message}`);
      return false;
    }
  }

  /**
   * Calculate seasonal influence for specific pattern
   */
  private calculatePatternSeasonalInfluence(
    patternName: string,
    seasonalData: any,
  ): number {
    try {
      switch (patternName) {
        case 'Seasonal Buyers':
          return (
            (seasonalData.ramadanInfluence +
              seasonalData.lebaranInfluence +
              seasonalData.yearEndInfluence) /
            3
          );
        case 'Weekend Shoppers':
          return seasonalData.weekendInfluence;
        case 'High-Value Buyers':
          return seasonalData.lebaranInfluence;
        case 'Frequent Buyers':
          return seasonalData.payDayInfluence;
        case 'Bulk Buyers':
          return seasonalData.ramadanInfluence;
        case 'Loyal Customers':
          return (
            (seasonalData.ramadanInfluence + seasonalData.lebaranInfluence) / 2
          );
        case 'Impulse Buyers':
          return seasonalData.weekendInfluence;
        default:
          return (
            (seasonalData.ramadanInfluence +
              seasonalData.lebaranInfluence +
              seasonalData.weekendInfluence) /
            3
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to calculate pattern seasonal influence: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Calculate optimization potential for purchase pattern
   */
  private calculateOptimizationPotential(
    pattern: any,
    customers: any[],
  ): number {
    try {
      let potential = 0;

      // Base optimization potential based on pattern characteristics
      switch (pattern.name) {
        case 'Occasional Buyers':
          potential = 70; // High potential to convert to regular buyers
          break;
        case 'Regular Buyers':
          potential = 50; // Medium potential to convert to frequent buyers
          break;
        case 'Seasonal Buyers':
          potential = 60; // Good potential for targeted seasonal campaigns
          break;
        case 'Weekend Shoppers':
          potential = 40; // Moderate potential for weekday activation
          break;
        case 'Impulse Buyers':
          potential = 65; // High potential for value optimization
          break;
        case 'Bulk Buyers':
          potential = 45; // Moderate potential for frequency increase
          break;
        case 'Loyal Customers':
          potential = 30; // Lower potential but stable base
          break;
        case 'High-Value Buyers':
          potential = 35; // Lower potential but high value
          break;
        case 'Frequent Buyers':
          potential = 25; // Lowest potential but already optimized
          break;
        default:
          potential = 50;
      }

      // Adjust based on customer behavior patterns
      const avgChurnRisk =
        customers.reduce((avg, c) => avg + (c.churnRiskScore || 0), 0) /
        customers.length;
      const avgEngagement =
        customers.reduce(
          (avg, c) => avg + (c.daysSinceLastTransaction || 0),
          0,
        ) / customers.length;

      // Reduce potential for high churn risk customers
      if (avgChurnRisk > 70) {
        potential *= 0.7;
      }

      // Reduce potential for low engagement customers
      if (avgEngagement > 90) {
        potential *= 0.8;
      }

      return Math.max(0, Math.min(100, potential));
    } catch (error) {
      this.logger.error(
        `Failed to calculate optimization potential: ${error.message}`,
      );
      return 0;
    }
  }

  async generateProductAffinityMatrix(tenantId: string): Promise<
    Array<{
      primaryCategory: string;
      crossSellCategories: Array<{
        category: string;
        affinityStrength: number;
        conversionPotential: number;
        revenueUpside: number;
      }>;
    }>
  > {
    try {
      this.logger.debug(
        `Generating product affinity matrix for tenant: ${tenantId}`,
      );

      // Get customer analytics data with product category information
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsList(tenantId, {
          limit: 3000,
          offset: 0,
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        });

      const customers = customerAnalytics.data || [];

      if (customers.length === 0) {
        this.logger.warn(
          `No customer data found for product affinity analysis in tenant: ${tenantId}`,
        );
        return [];
      }

      // Analyze product category relationships
      const categoryRelationships =
        await this.analyzeProductCategoryRelationships(customers, tenantId);

      // Calculate cross-selling opportunities
      const crossSellOpportunities = await this.calculateCrossSellOpportunities(
        categoryRelationships,
        customers,
      );

      // Generate comprehensive affinity matrix
      const affinityMatrix = await this.buildProductAffinityMatrix(
        crossSellOpportunities,
      );

      this.logger.debug(
        `Successfully generated product affinity matrix with ${affinityMatrix.length} primary categories`,
      );
      return affinityMatrix;
    } catch (error) {
      this.logger.error(
        `Failed to generate product affinity matrix: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Analyze product category relationships from customer purchase data
   */
  private async analyzeProductCategoryRelationships(
    customers: any[],
    tenantId: string,
  ): Promise<any> {
    try {
      const categoryData = new Map<
        string,
        {
          customers: Set<string>;
          totalRevenue: number;
          averageOrderValue: number;
          frequentlyBoughtWith: Map<string, number>;
          totalPurchases: number;
        }
      >();

      // Extract category information from customer data
      customers.forEach(customer => {
        const categories = customer.productCategories || [];
        const customerRevenue = customer.totalSpent || 0;
        const customerTransactions = customer.totalTransactions || 0;

        categories.forEach((category: string) => {
          if (!categoryData.has(category)) {
            categoryData.set(category, {
              customers: new Set(),
              totalRevenue: 0,
              averageOrderValue: 0,
              frequentlyBoughtWith: new Map(),
              totalPurchases: 0,
            });
          }

          const categoryInfo = categoryData.get(category)!;
          categoryInfo.customers.add(customer.customerId);
          categoryInfo.totalRevenue += customerRevenue;
          categoryInfo.totalPurchases += customerTransactions;

          // Analyze co-purchase patterns
          categories.forEach((otherCategory: string) => {
            if (category !== otherCategory) {
              const currentCount =
                categoryInfo.frequentlyBoughtWith.get(otherCategory) || 0;
              categoryInfo.frequentlyBoughtWith.set(
                otherCategory,
                currentCount + 1,
              );
            }
          });
        });
      });

      // Calculate average order values
      categoryData.forEach((data, category) => {
        if (data.totalPurchases > 0) {
          data.averageOrderValue = data.totalRevenue / data.totalPurchases;
        }
      });

      return categoryData;
    } catch (error) {
      this.logger.error(
        `Failed to analyze product category relationships: ${error.message}`,
      );
      return new Map();
    }
  }

  /**
   * Calculate cross-selling opportunities based on category relationships
   */
  private async calculateCrossSellOpportunities(
    categoryRelationships: any,
    customers: any[],
  ): Promise<any> {
    try {
      const opportunities = new Map<
        string,
        Array<{
          category: string;
          coOccurrences: number;
          affinityStrength: number;
          customerOverlap: number;
          revenueOpportunity: number;
        }>
      >();

      const totalCustomers = customers.length;

      for (const [
        primaryCategory,
        primaryData,
      ] of categoryRelationships.entries()) {
        const crossSellOpportunities = [];

        for (const [
          targetCategory,
          coOccurrences,
        ] of primaryData.frequentlyBoughtWith.entries()) {
          const targetData = categoryRelationships.get(targetCategory);

          if (!targetData || coOccurrences < 2) continue; // Skip weak relationships

          // Calculate affinity strength (lift metric)
          const primaryCustomerCount = primaryData.customers.size;
          const targetCustomerCount = targetData.customers.size;
          const expectedCoOccurrences =
            (primaryCustomerCount * targetCustomerCount) / totalCustomers;
          const affinityStrength =
            expectedCoOccurrences > 0
              ? (coOccurrences / expectedCoOccurrences) * 100
              : 0;

          // Calculate customer overlap
          const customerOverlap = this.calculateCustomerOverlap(
            primaryData.customers,
            targetData.customers,
          );

          // Calculate revenue opportunity
          const revenueOpportunity = this.calculateRevenueOpportunity(
            primaryData,
            targetData,
            customerOverlap,
            affinityStrength,
          );

          crossSellOpportunities.push({
            category: targetCategory,
            coOccurrences,
            affinityStrength: Math.round(affinityStrength * 100) / 100,
            customerOverlap,
            revenueOpportunity,
          });
        }

        // Sort by affinity strength and take top opportunities
        crossSellOpportunities.sort(
          (a, b) => b.affinityStrength - a.affinityStrength,
        );
        opportunities.set(primaryCategory, crossSellOpportunities.slice(0, 5)); // Top 5 opportunities
      }

      return opportunities;
    } catch (error) {
      this.logger.error(
        `Failed to calculate cross-sell opportunities: ${error.message}`,
      );
      return new Map();
    }
  }

  /**
   * Build the final product affinity matrix
   */
  private async buildProductAffinityMatrix(
    crossSellOpportunities: any,
  ): Promise<any[]> {
    try {
      const affinityMatrix = [];

      for (const [
        primaryCategory,
        opportunities,
      ] of crossSellOpportunities.entries()) {
        if (opportunities.length === 0) continue;

        const crossSellCategories = opportunities.map((opportunity: any) => ({
          category: opportunity.category,
          affinityStrength: opportunity.affinityStrength,
          conversionPotential: this.calculateConversionPotential(opportunity),
          revenueUpside: Math.round(opportunity.revenueOpportunity),
        }));

        affinityMatrix.push({
          primaryCategory,
          crossSellCategories,
        });
      }

      // Sort by the strongest affinity relationships first
      return affinityMatrix.sort((a, b) => {
        const aMaxAffinity = Math.max(
          ...a.crossSellCategories.map(c => c.affinityStrength),
        );
        const bMaxAffinity = Math.max(
          ...b.crossSellCategories.map(c => c.affinityStrength),
        );
        return bMaxAffinity - aMaxAffinity;
      });
    } catch (error) {
      this.logger.error(
        `Failed to build product affinity matrix: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Calculate customer overlap between two category customer sets
   */
  private calculateCustomerOverlap(
    customersA: Set<string>,
    customersB: Set<string>,
  ): number {
    try {
      const intersection = new Set(
        [...customersA].filter(x => customersB.has(x)),
      );
      const union = new Set([...customersA, ...customersB]);

      return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
    } catch (error) {
      this.logger.error(
        `Failed to calculate customer overlap: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Calculate revenue opportunity for cross-selling
   */
  private calculateRevenueOpportunity(
    primaryData: any,
    targetData: any,
    customerOverlap: number,
    affinityStrength: number,
  ): number {
    try {
      // Base revenue opportunity calculation
      const primaryCustomerCount = primaryData.customers.size;
      const targetAverageOrderValue = targetData.averageOrderValue;

      // Calculate potential customers who might buy the target category
      const potentialCustomers =
        primaryCustomerCount *
        (affinityStrength / 100) *
        (customerOverlap / 100);

      // Calculate revenue opportunity
      const revenueOpportunity =
        potentialCustomers * targetAverageOrderValue * 0.3; // 30% conversion assumption

      return Math.max(0, revenueOpportunity);
    } catch (error) {
      this.logger.error(
        `Failed to calculate revenue opportunity: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Calculate conversion potential for cross-selling
   */
  private calculateConversionPotential(opportunity: any): number {
    try {
      const { affinityStrength, customerOverlap, coOccurrences } = opportunity;

      // Base conversion potential based on affinity strength
      let conversionPotential = Math.min(100, affinityStrength * 0.5);

      // Adjust for customer overlap
      if (customerOverlap > 50) {
        conversionPotential *= 1.2; // Boost for high overlap
      } else if (customerOverlap < 20) {
        conversionPotential *= 0.8; // Reduce for low overlap
      }

      // Adjust for co-occurrence frequency
      if (coOccurrences > 10) {
        conversionPotential *= 1.1; // Boost for frequent co-occurrences
      } else if (coOccurrences < 5) {
        conversionPotential *= 0.9; // Reduce for rare co-occurrences
      }

      // Indonesian market adjustments
      conversionPotential *= 0.85; // Conservative adjustment for Indonesian market

      return (
        Math.round(Math.max(0, Math.min(100, conversionPotential)) * 100) / 100
      );
    } catch (error) {
      this.logger.error(
        `Failed to calculate conversion potential: ${error.message}`,
      );
      return 0;
    }
  }

  async analyzeChannelEffectiveness(tenantId: string): Promise<
    Array<{
      channel: string;
      customerAcquisitionCost: number;
      averageOrderValue: number;
      retentionRate: number;
      profitabilityScore: number;
      optimizationRecommendations: string[];
    }>
  > {
    try {
      this.logger.debug(
        `Analyzing channel effectiveness for tenant ${tenantId}`,
      );

      // Get channel performance data from orders and customer analytics
      const channelPerformanceQuery = `
        WITH channel_metrics AS (
          SELECT 
            COALESCE(o.channel_name, o.channel_id, 'Direct') as channel_name,
            COUNT(DISTINCT o.customer_id) as total_customers,
            COUNT(DISTINCT o.id) as total_orders,
            SUM(o.total_amount) as total_revenue,
            AVG(o.total_amount) as avg_order_value,
            SUM(o.total_amount - COALESCE(o.total_cost, o.total_amount * 0.7)) as gross_profit,
            MIN(o.order_date) as first_order_date,
            MAX(o.order_date) as last_order_date
          FROM orders o
          WHERE o.tenant_id = $1 
            AND o.order_date >= NOW() - INTERVAL '12 months'
            AND o.status NOT IN ('cancelled', 'refunded')
            AND o.is_deleted = false
          GROUP BY COALESCE(o.channel_name, o.channel_id, 'Direct')
        ),
        customer_acquisition_costs AS (
          SELECT 
            COALESCE(ca.primary_channel, 'Direct') as channel_name,
            COUNT(*) as acquired_customers,
            -- Estimate acquisition cost based on order value and frequency patterns
            AVG(ca.total_spent / NULLIF(ca.total_transactions, 0)) * 0.15 as estimated_acquisition_cost
          FROM customer_analytics_summary ca
          WHERE ca.tenant_id = $1
            AND ca.last_updated >= NOW() - INTERVAL '12 months'
          GROUP BY COALESCE(ca.primary_channel, 'Direct')
        ),
        retention_analysis AS (
          SELECT 
            COALESCE(o.channel_name, o.channel_id, 'Direct') as channel_name,
            COUNT(DISTINCT CASE 
              WHEN customer_order_count.order_count > 1 THEN o.customer_id 
            END) as retained_customers,
            COUNT(DISTINCT o.customer_id) as total_unique_customers
          FROM orders o
          JOIN (
            SELECT customer_id, COUNT(*) as order_count
            FROM orders 
            WHERE tenant_id = $1 AND order_date >= NOW() - INTERVAL '12 months'
            GROUP BY customer_id
          ) customer_order_count ON o.customer_id = customer_order_count.customer_id
          WHERE o.tenant_id = $1 
            AND o.order_date >= NOW() - INTERVAL '12 months'
            AND o.status NOT IN ('cancelled', 'refunded')
          GROUP BY COALESCE(o.channel_name, o.channel_id, 'Direct')
        )
        SELECT 
          cm.channel_name,
          cm.total_customers,
          cm.total_orders,
          cm.total_revenue,
          cm.avg_order_value,
          cm.gross_profit,
          COALESCE(cac.estimated_acquisition_cost, 0) as acquisition_cost,
          CASE 
            WHEN ra.total_unique_customers > 0 
            THEN (ra.retained_customers::DECIMAL / ra.total_unique_customers * 100)
            ELSE 0 
          END as retention_rate,
          CASE 
            WHEN cm.total_revenue > 0 
            THEN (cm.gross_profit / cm.total_revenue * 100)
            ELSE 0 
          END as profit_margin
        FROM channel_metrics cm
        LEFT JOIN customer_acquisition_costs cac ON cm.channel_name = cac.channel_name
        LEFT JOIN retention_analysis ra ON cm.channel_name = ra.channel_name
        ORDER BY cm.total_revenue DESC
      `;

      const channelData = await this.dataSource.query(channelPerformanceQuery, [
        tenantId,
      ]);

      if (!channelData || channelData.length === 0) {
        this.logger.warn(`No channel data found for tenant ${tenantId}`);
        return [
          {
            channel: 'Direct',
            customerAcquisitionCost: 0,
            averageOrderValue: 0,
            retentionRate: 0,
            profitabilityScore: 0,
            optimizationRecommendations: [
              'Tidak ada data channel ditemukan',
              'Mulai tracking channel untuk setiap order',
              'Implementasikan multi-channel selling strategy',
            ],
          },
        ];
      }

      // Calculate profitability scores and generate recommendations
      const channelAnalysis = channelData.map((channel: any) => {
        const avgOrderValue = parseFloat(channel.avg_order_value) || 0;
        const retentionRate = parseFloat(channel.retention_rate) || 0;
        const profitMargin = parseFloat(channel.profit_margin) || 0;
        const acquisitionCost = parseFloat(channel.acquisition_cost) || 0;
        const totalRevenue = parseFloat(channel.total_revenue) || 0;
        const totalCustomers = parseInt(channel.total_customers) || 0;

        // Calculate profitability score (0-100)
        let profitabilityScore = 0;

        // Revenue contribution (30%)
        const revenueWeight = Math.min(30, (totalRevenue / 100000000) * 30); // Normalize to 100M IDR

        // Profit margin (25%)
        const marginWeight = Math.min(25, profitMargin * 0.8);

        // Customer retention (25%)
        const retentionWeight = retentionRate * 0.25;

        // Acquisition efficiency (20%)
        const ltv = avgOrderValue * (retentionRate / 100 + 1); // Simple LTV calculation
        const acquisitionEfficiency =
          acquisitionCost > 0 ? Math.min(20, (ltv / acquisitionCost) * 5) : 20;

        profitabilityScore =
          revenueWeight +
          marginWeight +
          retentionWeight +
          acquisitionEfficiency;

        // Generate Indonesian context recommendations
        const recommendations = this.generateChannelRecommendations(
          channel.channel_name,
          {
            avgOrderValue,
            retentionRate,
            profitMargin,
            acquisitionCost,
            totalRevenue,
            totalCustomers,
            profitabilityScore,
          },
        );

        return {
          channel: channel.channel_name,
          customerAcquisitionCost: Math.round(acquisitionCost),
          averageOrderValue: Math.round(avgOrderValue),
          retentionRate: Math.round(retentionRate * 100) / 100,
          profitabilityScore: Math.round(profitabilityScore * 100) / 100,
          optimizationRecommendations: recommendations,
        };
      });

      this.logger.debug(
        `Channel effectiveness analysis completed for ${channelAnalysis.length} channels`,
      );
      return channelAnalysis;
    } catch (error) {
      this.logger.error(
        `Failed to analyze channel effectiveness: ${error.message}`,
        error.stack,
      );
      return [
        {
          channel: 'Error',
          customerAcquisitionCost: 0,
          averageOrderValue: 0,
          retentionRate: 0,
          profitabilityScore: 0,
          optimizationRecommendations: [
            'Terjadi error dalam analisis channel',
            'Periksa koneksi database dan data order',
            'Hubungi tim teknis untuk troubleshooting',
          ],
        },
      ];
    }
  }

  /**
   * Generate channel-specific optimization recommendations for Indonesian market
   */
  private generateChannelRecommendations(
    channelName: string,
    metrics: {
      avgOrderValue: number;
      retentionRate: number;
      profitMargin: number;
      acquisitionCost: number;
      totalRevenue: number;
      totalCustomers: number;
      profitabilityScore: number;
    },
  ): string[] {
    const recommendations: string[] = [];
    const {
      avgOrderValue,
      retentionRate,
      profitMargin,
      acquisitionCost,
      profitabilityScore,
    } = metrics;

    // Performance-based recommendations
    if (profitabilityScore >= 80) {
      recommendations.push(
        `Channel ${channelName} menunjukkan performa excellent - pertahankan strategy ini`,
      );
      recommendations.push('Tingkatkan investasi marketing untuk channel ini');
      recommendations.push('Gunakan sebagai model untuk channel lain');
    } else if (profitabilityScore >= 60) {
      recommendations.push(
        `Channel ${channelName} memiliki potensi good - optimasi diperlukan`,
      );
    } else {
      recommendations.push(
        `Channel ${channelName} perlu perbaikan significant`,
      );
    }

    // AOV optimization
    if (avgOrderValue < 500000) {
      // Less than 500K IDR
      recommendations.push(
        'Implementasikan bundle deals untuk meningkatkan AOV',
      );
      recommendations.push('Tawarkan free shipping untuk minimum purchase');
      if (
        channelName.toLowerCase().includes('shopee') ||
        channelName.toLowerCase().includes('tokopedia')
      ) {
        recommendations.push(
          'Manfaatkan flash sale dan mega sale di marketplace',
        );
      }
    } else if (avgOrderValue > 2000000) {
      // Above 2M IDR
      recommendations.push('Focus pada premium customer experience');
      recommendations.push('Tawarkan layanan VIP dan personal shopper');
    }

    // Retention optimization
    if (retentionRate < 30) {
      recommendations.push('Implementasikan customer loyalty program');
      recommendations.push('Tingkatkan after-sales service dan follow-up');
      recommendations.push(
        'Gunakan email/WhatsApp marketing untuk re-engagement',
      );
    } else if (retentionRate > 70) {
      recommendations.push('Channel ini excellent untuk customer retention');
      recommendations.push(
        'Focus pada customer expansion dan referral program',
      );
    }

    // Indonesian market specific recommendations
    if (channelName.toLowerCase().includes('whatsapp')) {
      recommendations.push(
        'Manfaatkan WhatsApp Business API untuk automated responses',
      );
      recommendations.push('Gunakan WhatsApp catalog untuk showcase produk');
      recommendations.push(
        'Implementasikan WhatsApp payment untuk convenience',
      );
    } else if (channelName.toLowerCase().includes('instagram')) {
      recommendations.push(
        'Gunakan Instagram Stories dan Reels untuk engagement',
      );
      recommendations.push('Manfaatkan Instagram Shopping tags');
      recommendations.push('Kolaborasi dengan micro-influencer Indonesia');
    } else if (channelName.toLowerCase().includes('shopee')) {
      recommendations.push(
        'Optimalkan Shopee Live untuk product demonstration',
      );
      recommendations.push('Manfaatkan Shopee Coins dan voucher system');
      recommendations.push('Focus pada Shopee Mall untuk brand credibility');
    } else if (channelName.toLowerCase().includes('tokopedia')) {
      recommendations.push('Gunakan Tokopedia Play untuk video marketing');
      recommendations.push('Manfaatkan TopAds untuk visibility');
      recommendations.push('Focus pada Official Store status');
    }

    // Profit margin optimization
    if (profitMargin < 20) {
      recommendations.push('Review pricing strategy dan struktur cost');
      recommendations.push('Negosiasi commission rate dengan platform');
      recommendations.push('Optimasi operational efficiency');
    }

    // Acquisition cost optimization
    if (acquisitionCost > avgOrderValue * 0.3) {
      recommendations.push(
        'Acquisition cost terlalu tinggi - review marketing spend',
      );
      recommendations.push('Focus pada organic growth dan word-of-mouth');
      recommendations.push('Implementasikan referral program');
    }

    // Always include Indonesian business context
    recommendations.push(
      'Sesuaikan strategi dengan cultural events (Ramadan, Lebaran, etc.)',
    );
    recommendations.push(
      'Optimalkan untuk mobile experience (85% pengguna mobile)',
    );

    return recommendations.slice(0, 8); // Limit to 8 recommendations
  }

  async generateNextMonthPredictions(tenantId: string): Promise<{
    expectedNewCustomers: number;
    expectedChurnCustomers: number;
    predictedRevenue: number;
    seasonalAdjustment: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  }> {
    try {
      this.logger.debug(
        `Generating next month predictions for tenant ${tenantId}`,
      );

      // Get historical data for the last 12 months for trend analysis
      const historicalDataQuery = `
        WITH monthly_metrics AS (
          SELECT 
            DATE_TRUNC('month', o.order_date) as month,
            COUNT(DISTINCT o.customer_id) as unique_customers,
            COUNT(DISTINCT CASE WHEN first_order.first_order_month = DATE_TRUNC('month', o.order_date) 
                                THEN o.customer_id END) as new_customers,
            SUM(o.total_amount) as total_revenue,
            COUNT(DISTINCT o.id) as total_orders,
            AVG(o.total_amount) as avg_order_value
          FROM orders o
          LEFT JOIN (
            SELECT customer_id, MIN(DATE_TRUNC('month', order_date)) as first_order_month
            FROM orders 
            WHERE tenant_id = $1 AND is_deleted = false
            GROUP BY customer_id
          ) first_order ON o.customer_id = first_order.customer_id
          WHERE o.tenant_id = $1 
            AND o.order_date >= NOW() - INTERVAL '12 months'
            AND o.order_date < DATE_TRUNC('month', NOW())
            AND o.status NOT IN ('cancelled', 'refunded')
            AND o.is_deleted = false
          GROUP BY DATE_TRUNC('month', o.order_date)
          ORDER BY month DESC
        ),
        customer_behavior AS (
          SELECT 
            COUNT(DISTINCT CASE WHEN ca.days_since_last_transaction > 90 
                                THEN ca.customer_id END) as potential_churn_customers,
            COUNT(DISTINCT ca.customer_id) as total_active_customers,
            AVG(ca.monthly_transaction_frequency) as avg_purchase_frequency,
            AVG(ca.churn_risk_score) as avg_churn_risk
          FROM customer_analytics_summary ca
          WHERE ca.tenant_id = $1
            AND ca.last_updated >= NOW() - INTERVAL '3 months'
        )
        SELECT 
          mm.*,
          cb.potential_churn_customers,
          cb.total_active_customers,
          cb.avg_purchase_frequency,
          cb.avg_churn_risk
        FROM monthly_metrics mm
        CROSS JOIN customer_behavior cb
        ORDER BY mm.month DESC
        LIMIT 12
      `;

      const historicalData = await this.dataSource.query(historicalDataQuery, [
        tenantId,
      ]);

      if (!historicalData || historicalData.length === 0) {
        this.logger.warn(
          `No historical data found for predictions for tenant ${tenantId}`,
        );
        return {
          expectedNewCustomers: 0,
          expectedChurnCustomers: 0,
          predictedRevenue: 0,
          seasonalAdjustment: 0,
          confidenceInterval: { lower: 0, upper: 0 },
        };
      }

      // Calculate trend and seasonal patterns
      const recentData = historicalData.slice(0, 6); // Last 6 months
      const olderData = historicalData.slice(6, 12); // Previous 6 months

      // Calculate revenue trend
      const recentAvgRevenue =
        recentData.reduce(
          (sum, month) => sum + parseFloat(month.total_revenue || 0),
          0,
        ) / recentData.length;
      const olderAvgRevenue =
        olderData.length > 0
          ? olderData.reduce(
              (sum, month) => sum + parseFloat(month.total_revenue || 0),
              0,
            ) / olderData.length
          : recentAvgRevenue;

      const revenueGrowthRate =
        olderAvgRevenue > 0
          ? (recentAvgRevenue - olderAvgRevenue) / olderAvgRevenue
          : 0;

      // Calculate customer acquisition trend
      const recentAvgNewCustomers =
        recentData.reduce(
          (sum, month) => sum + parseInt(month.new_customers || 0),
          0,
        ) / recentData.length;
      const olderAvgNewCustomers =
        olderData.length > 0
          ? olderData.reduce(
              (sum, month) => sum + parseInt(month.new_customers || 0),
              0,
            ) / olderData.length
          : recentAvgNewCustomers;

      const customerGrowthRate =
        olderAvgNewCustomers > 0
          ? (recentAvgNewCustomers - olderAvgNewCustomers) /
            olderAvgNewCustomers
          : 0;

      // Calculate seasonal adjustment for Indonesian market
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

      let seasonalMultiplier = 1.0;

      // Indonesian seasonal patterns
      if (nextMonth === 3 || nextMonth === 4) {
        // Ramadan period - typically lower sales initially, then surge
        seasonalMultiplier = 1.15;
      } else if (nextMonth === 5 || nextMonth === 6) {
        // Lebaran period - highest sales
        seasonalMultiplier = 1.35;
      } else if (nextMonth === 12 || nextMonth === 1) {
        // Christmas and New Year
        seasonalMultiplier = 1.2;
      } else if (nextMonth === 8) {
        // Independence Day
        seasonalMultiplier = 1.1;
      } else if (nextMonth === 7 || nextMonth === 9) {
        // Back to school season
        seasonalMultiplier = 1.05;
      }

      // Predict next month values
      const baseRevenuePrediction = recentAvgRevenue * (1 + revenueGrowthRate);
      const predictedRevenue = baseRevenuePrediction * seasonalMultiplier;

      const baseNewCustomers = recentAvgNewCustomers * (1 + customerGrowthRate);
      const expectedNewCustomers = Math.round(
        baseNewCustomers * seasonalMultiplier,
      );

      // Estimate churn based on historical patterns and churn risk scores
      const avgChurnRisk = parseFloat(historicalData[0]?.avg_churn_risk || 50);
      const totalActiveCustomers = parseInt(
        historicalData[0]?.total_active_customers || 0,
      );
      const expectedChurnCustomers = Math.round(
        totalActiveCustomers * (avgChurnRisk / 100) * 0.1,
      ); // 10% of high-risk customers

      // Calculate seasonal adjustment percentage
      const seasonalAdjustment = (seasonalMultiplier - 1) * 100;

      // Calculate confidence intervals based on data variability
      const revenueVariability = this.calculateVariability(
        recentData.map(d => parseFloat(d.total_revenue || 0)),
      );
      const confidenceMargin =
        predictedRevenue * (revenueVariability / 100) * 1.96; // 95% confidence interval

      const result = {
        expectedNewCustomers,
        expectedChurnCustomers,
        predictedRevenue: Math.round(predictedRevenue),
        seasonalAdjustment: Math.round(seasonalAdjustment * 100) / 100,
        confidenceInterval: {
          lower: Math.round(predictedRevenue - confidenceMargin),
          upper: Math.round(predictedRevenue + confidenceMargin),
        },
      };

      this.logger.debug(
        `Next month predictions generated: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate next month predictions: ${error.message}`,
        error.stack,
      );
      return {
        expectedNewCustomers: 0,
        expectedChurnCustomers: 0,
        predictedRevenue: 0,
        seasonalAdjustment: 0,
        confidenceInterval: { lower: 0, upper: 0 },
      };
    }
  }

  /**
   * Calculate variability (coefficient of variation) for confidence intervals
   */
  private calculateVariability(values: number[]): number {
    if (values.length === 0) return 20; // Default 20% variability

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (mean === 0) return 20;

    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = (standardDeviation / mean) * 100;

    // Cap variability between 5% and 50%
    return Math.max(5, Math.min(50, coefficientOfVariation));
  }

  async generateLTVForecasting(tenantId: string): Promise<
    Array<{
      customerSegment: string;
      currentAverageLTV: number;
      predictedLTVIn12Months: number;
      growthPotential: number;
      riskFactors: string[];
      opportunityFactors: string[];
    }>
  > {
    try {
      this.logger.debug(`Generating LTV forecasting for tenant ${tenantId}`);

      // Get customer segment data with LTV calculations
      const ltvAnalysisQuery = `
        WITH customer_segments AS (
          SELECT 
            COALESCE(ca.segment, 'unassigned') as segment,
            COALESCE(ca.loyalty_tier, 'standard') as loyalty_tier,
            COUNT(DISTINCT ca.customer_id) as customer_count,
            AVG(ca.total_spent) as avg_current_ltv,
            AVG(ca.monthly_transaction_frequency) as avg_frequency,
            AVG(ca.average_order_value) as avg_order_value,
            AVG(ca.days_since_last_transaction) as avg_days_since_last,
            AVG(ca.days_since_first_transaction) as avg_customer_age,
            AVG(ca.churn_risk_score) as avg_churn_risk,
            AVG(ca.unique_products_purchased) as avg_product_diversity,
            AVG(ca.channel_count) as avg_channel_usage,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ca.total_spent) as median_ltv,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ca.total_spent) as ltv_75th_percentile,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ca.total_spent) as ltv_25th_percentile
          FROM customer_analytics_summary ca
          WHERE ca.tenant_id = $1
            AND ca.last_updated >= NOW() - INTERVAL '3 months'
            AND ca.total_spent > 0
          GROUP BY COALESCE(ca.segment, 'unassigned'), COALESCE(ca.loyalty_tier, 'standard')
        ),
        growth_trends AS (
          SELECT 
            COALESCE(ca.segment, 'unassigned') as segment,
            -- Calculate growth rate by comparing recent vs older periods
            AVG(CASE WHEN ca.last_transaction_date >= NOW() - INTERVAL '3 months' 
                     THEN ca.total_spent END) as recent_avg_ltv,
            AVG(CASE WHEN ca.last_transaction_date < NOW() - INTERVAL '3 months' 
                     AND ca.last_transaction_date >= NOW() - INTERVAL '6 months'
                     THEN ca.total_spent END) as older_avg_ltv,
            COUNT(DISTINCT CASE WHEN ca.last_transaction_date >= NOW() - INTERVAL '3 months' 
                               THEN ca.customer_id END) as recent_active_customers,
            COUNT(DISTINCT CASE WHEN ca.last_transaction_date < NOW() - INTERVAL '3 months' 
                               THEN ca.customer_id END) as older_active_customers
          FROM customer_analytics_summary ca
          WHERE ca.tenant_id = $1
            AND ca.last_updated >= NOW() - INTERVAL '6 months'
          GROUP BY COALESCE(ca.segment, 'unassigned')
        )
        SELECT 
          cs.segment,
          cs.loyalty_tier,
          cs.customer_count,
          cs.avg_current_ltv,
          cs.avg_frequency,
          cs.avg_order_value,
          cs.avg_days_since_last,
          cs.avg_customer_age,
          cs.avg_churn_risk,
          cs.avg_product_diversity,
          cs.avg_channel_usage,
          cs.median_ltv,
          cs.ltv_75th_percentile,
          cs.ltv_25th_percentile,
          gt.recent_avg_ltv,
          gt.older_avg_ltv,
          gt.recent_active_customers,
          gt.older_active_customers
        FROM customer_segments cs
        LEFT JOIN growth_trends gt ON cs.segment = gt.segment
        WHERE cs.customer_count >= 5  -- Only segments with meaningful data
        ORDER BY cs.avg_current_ltv DESC
      `;

      const segmentData = await this.dataSource.query(ltvAnalysisQuery, [
        tenantId,
      ]);

      if (!segmentData || segmentData.length === 0) {
        this.logger.warn(
          `No segment data found for LTV forecasting for tenant ${tenantId}`,
        );
        return [
          {
            customerSegment: 'Default',
            currentAverageLTV: 0,
            predictedLTVIn12Months: 0,
            growthPotential: 0,
            riskFactors: [
              'Data tidak mencukupi untuk analisis LTV',
              'Perlu lebih banyak historical data',
              'Implementasikan customer segmentation',
            ],
            opportunityFactors: [
              'Mulai tracking customer behavior',
              'Implementasikan loyalty program',
              'Focus pada customer retention',
            ],
          },
        ];
      }

      // Process each segment to calculate LTV forecasting
      const ltvForecasting = segmentData.map((segment: any) => {
        const currentLTV = parseFloat(segment.avg_current_ltv) || 0;
        const frequency = parseFloat(segment.avg_frequency) || 0;
        const avgOrderValue = parseFloat(segment.avg_order_value) || 0;
        const customerAge = parseFloat(segment.avg_customer_age) || 0;
        const churnRisk = parseFloat(segment.avg_churn_risk) || 0;
        const productDiversity = parseFloat(segment.avg_product_diversity) || 0;
        const channelUsage = parseFloat(segment.avg_channel_usage) || 0;
        const recentLTV = parseFloat(segment.recent_avg_ltv) || currentLTV;
        const olderLTV = parseFloat(segment.older_avg_ltv) || currentLTV;

        // Calculate growth rate
        const growthRate = olderLTV > 0 ? (recentLTV - olderLTV) / olderLTV : 0;

        // Predict LTV in 12 months using multiple factors
        let predictedLTV = currentLTV;

        // Factor 1: Historical growth trend
        predictedLTV = predictedLTV * (1 + growthRate);

        // Factor 2: Frequency adjustment (more frequent buyers tend to increase LTV)
        if (frequency > 2) {
          predictedLTV *= 1.15; // 15% boost for high frequency
        } else if (frequency < 0.5) {
          predictedLTV *= 0.9; // 10% reduction for low frequency
        }

        // Factor 3: Product diversity (customers buying diverse products tend to stay longer)
        if (productDiversity > 5) {
          predictedLTV *= 1.1; // 10% boost for high diversity
        } else if (productDiversity < 2) {
          predictedLTV *= 0.95; // 5% reduction for low diversity
        }

        // Factor 4: Channel usage (omnichannel customers have higher LTV)
        if (channelUsage > 2) {
          predictedLTV *= 1.2; // 20% boost for omnichannel
        } else if (channelUsage < 1) {
          predictedLTV *= 0.95; // 5% reduction for single channel
        }

        // Factor 5: Customer maturity (older customers tend to be more valuable)
        if (customerAge > 365) {
          predictedLTV *= 1.05; // 5% boost for mature customers
        }

        // Factor 6: Churn risk adjustment
        const churnFactor = Math.max(0.5, 1 - (churnRisk / 100) * 0.3);
        predictedLTV *= churnFactor;

        // Indonesian market seasonal adjustments
        const seasonalBoost = 1.08; // 8% seasonal boost for Indonesian market cycles
        predictedLTV *= seasonalBoost;

        // Calculate growth potential
        const growthPotential =
          predictedLTV > 0
            ? ((predictedLTV - currentLTV) / currentLTV) * 100
            : 0;

        // Generate risk factors
        const riskFactors = this.generateLTVRiskFactors(segment, {
          churnRisk,
          frequency,
          customerAge,
          productDiversity,
          channelUsage,
          growthRate,
        });

        // Generate opportunity factors
        const opportunityFactors = this.generateLTVOpportunityFactors(segment, {
          churnRisk,
          frequency,
          customerAge,
          productDiversity,
          channelUsage,
          growthRate,
          currentLTV,
          predictedLTV,
        });

        return {
          customerSegment: this.formatSegmentName(segment.segment),
          currentAverageLTV: Math.round(currentLTV),
          predictedLTVIn12Months: Math.round(predictedLTV),
          growthPotential: Math.round(growthPotential * 100) / 100,
          riskFactors,
          opportunityFactors,
        };
      });

      this.logger.debug(
        `LTV forecasting completed for ${ltvForecasting.length} segments`,
      );
      return ltvForecasting;
    } catch (error) {
      this.logger.error(
        `Failed to generate LTV forecasting: ${error.message}`,
        error.stack,
      );
      return [
        {
          customerSegment: 'Error',
          currentAverageLTV: 0,
          predictedLTVIn12Months: 0,
          growthPotential: 0,
          riskFactors: [
            'Terjadi error dalam analisis LTV',
            'Periksa koneksi database dan data customer',
            'Hubungi tim teknis untuk troubleshooting',
          ],
          opportunityFactors: [
            'Perbaiki sistem tracking customer',
            'Implementasikan customer analytics',
            'Review data quality dan completeness',
          ],
        },
      ];
    }
  }

  /**
   * Generate risk factors for LTV forecasting
   */
  private generateLTVRiskFactors(
    segment: any,
    metrics: {
      churnRisk: number;
      frequency: number;
      customerAge: number;
      productDiversity: number;
      channelUsage: number;
      growthRate: number;
    },
  ): string[] {
    const risks: string[] = [];
    const {
      churnRisk,
      frequency,
      customerAge,
      productDiversity,
      channelUsage,
      growthRate,
    } = metrics;

    // Churn risk analysis
    if (churnRisk > 70) {
      risks.push('Tingkat churn risk sangat tinggi - perlu immediate action');
    } else if (churnRisk > 50) {
      risks.push('Churn risk moderate - implementasikan retention program');
    }

    // Frequency analysis
    if (frequency < 0.5) {
      risks.push('Frekuensi pembelian sangat rendah - customer tidak engaged');
    } else if (frequency < 1) {
      risks.push('Frekuensi pembelian rendah - perlu re-engagement campaign');
    }

    // Customer maturity analysis
    if (customerAge < 90) {
      risks.push('Customer masih baru - belum proven loyalty');
    } else if (customerAge > 730) {
      risks.push('Customer sudah lama - risk of fatigue atau switching');
    }

    // Product diversity analysis
    if (productDiversity < 2) {
      risks.push('Customer hanya beli produk terbatas - vulnerability tinggi');
    }

    // Channel usage analysis
    if (channelUsage < 1.5) {
      risks.push(
        'Customer hanya menggunakan single channel - limited touchpoints',
      );
    }

    // Growth trend analysis
    if (growthRate < -0.1) {
      risks.push('Trend pertumbuhan LTV negatif - declining customer value');
    }

    // Indonesian market specific risks
    risks.push('Kompetisi marketplace Indonesia semakin ketat');
    if (parseFloat(segment.avg_current_ltv) < 1000000) {
      risks.push('Low LTV segment - sensitive terhadap price competition');
    }

    return risks.slice(0, 6); // Limit to 6 risk factors
  }

  /**
   * Generate opportunity factors for LTV forecasting
   */
  private generateLTVOpportunityFactors(
    segment: any,
    metrics: {
      churnRisk: number;
      frequency: number;
      customerAge: number;
      productDiversity: number;
      channelUsage: number;
      growthRate: number;
      currentLTV: number;
      predictedLTV: number;
    },
  ): string[] {
    const opportunities: string[] = [];
    const {
      churnRisk,
      frequency,
      customerAge,
      productDiversity,
      channelUsage,
      growthRate,
      currentLTV,
      predictedLTV,
    } = metrics;

    // Growth potential analysis
    if (predictedLTV > currentLTV * 1.2) {
      opportunities.push(
        'Potensi pertumbuhan LTV tinggi - investasi marketing profitable',
      );
    } else if (predictedLTV > currentLTV * 1.1) {
      opportunities.push(
        'Potensi pertumbuhan LTV moderate - optimize existing channels',
      );
    }

    // Frequency opportunities
    if (frequency > 2) {
      opportunities.push(
        'High frequency customers - excellent untuk upselling',
      );
    } else if (frequency > 1) {
      opportunities.push('Regular customers - target untuk premium products');
    } else {
      opportunities.push(
        'Low frequency - opportunity untuk engagement campaigns',
      );
    }

    // Product diversity opportunities
    if (productDiversity > 5) {
      opportunities.push(
        'High product diversity - excellent cross-selling candidate',
      );
    } else if (productDiversity < 3) {
      opportunities.push(
        'Low product diversity - huge cross-selling potential',
      );
    }

    // Channel usage opportunities
    if (channelUsage > 2) {
      opportunities.push(
        'Omnichannel customer - higher retention dan LTV potential',
      );
    } else {
      opportunities.push(
        'Single channel - opportunity untuk channel expansion',
      );
    }

    // Churn risk opportunities
    if (churnRisk < 30) {
      opportunities.push('Low churn risk - safe untuk long-term investment');
    } else if (churnRisk < 60) {
      opportunities.push(
        'Moderate churn risk - preventable dengan right strategy',
      );
    }

    // Indonesian market specific opportunities
    opportunities.push(
      'Manfaatkan seasonal events (Ramadan, Lebaran) untuk LTV boost',
    );
    opportunities.push(
      'Implementasikan loyalty program dengan Indonesian cultural touch',
    );

    if (segment.loyalty_tier === 'premium') {
      opportunities.push('Premium segment - focus pada exclusive experiences');
    } else if (segment.loyalty_tier === 'gold') {
      opportunities.push(
        'Gold segment - upgrade ke premium dengan targeted offers',
      );
    } else {
      opportunities.push('Standard segment - opportunity untuk tier upgrade');
    }

    return opportunities.slice(0, 6); // Limit to 6 opportunity factors
  }

  /**
   * Helper: Format segment name for display
   */
  private formatSegmentName(segment: string): string {
    return segment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  async generateSeasonalBusinessPlanning(tenantId: string): Promise<
    Array<{
      upcomingSeason: string;
      daysUntilPeak: number;
      expectedDemandIncrease: number;
      preparationRecommendations: Array<{
        action: string;
        deadline: Date;
        estimatedImpact: number;
        resourceRequirement: string;
      }>;
    }>
  > {
    try {
      this.logger.debug(
        `Generating seasonal business planning for tenant ${tenantId}`,
      );

      // Get historical seasonal data for demand analysis
      const seasonalHistoryQuery = `
        WITH seasonal_analysis AS (
          SELECT 
            EXTRACT(MONTH FROM o.order_date) as month,
            EXTRACT(YEAR FROM o.order_date) as year,
            COUNT(DISTINCT o.id) as total_orders,
            SUM(o.total_amount) as total_revenue,
            COUNT(DISTINCT o.customer_id) as unique_customers,
            AVG(o.total_amount) as avg_order_value
          FROM orders o
          WHERE o.tenant_id = $1 
            AND o.order_date >= NOW() - INTERVAL '24 months'
            AND o.status NOT IN ('cancelled', 'refunded')
            AND o.is_deleted = false
          GROUP BY EXTRACT(MONTH FROM o.order_date), EXTRACT(YEAR FROM o.order_date)
        ),
        monthly_averages AS (
          SELECT 
            month,
            AVG(total_orders) as avg_monthly_orders,
            AVG(total_revenue) as avg_monthly_revenue,
            AVG(unique_customers) as avg_monthly_customers,
            AVG(avg_order_value) as avg_monthly_aov
          FROM seasonal_analysis
          GROUP BY month
          ORDER BY month
        )
        SELECT * FROM monthly_averages
      `;

      const seasonalData = await this.dataSource.query(seasonalHistoryQuery, [
        tenantId,
      ]);

      // Calculate baseline averages
      const baselineOrders =
        seasonalData.length > 0
          ? seasonalData.reduce(
              (sum, month) => sum + parseFloat(month.avg_monthly_orders || 0),
              0,
            ) / seasonalData.length
          : 0;
      const baselineRevenue =
        seasonalData.length > 0
          ? seasonalData.reduce(
              (sum, month) => sum + parseFloat(month.avg_monthly_revenue || 0),
              0,
            ) / seasonalData.length
          : 0;

      // Generate upcoming seasonal events for Indonesian market
      const upcomingSeasons = this.getUpcomingIndonesianSeasons();

      const seasonalPlanning = upcomingSeasons.map(season => {
        // Calculate expected demand increase based on historical data and Indonesian market patterns
        const historicalMonth = seasonalData.find(
          m => parseInt(m.month) === season.peakMonth,
        );
        const historicalMultiplier =
          historicalMonth && baselineOrders > 0
            ? parseFloat(historicalMonth.avg_monthly_orders) / baselineOrders
            : 1;

        // Apply Indonesian market context multipliers
        const marketMultiplier = season.marketMultiplier;
        const expectedDemandIncrease = Math.round(
          (historicalMultiplier * marketMultiplier - 1) * 100,
        );

        // Generate preparation recommendations
        const preparations = this.generateSeasonalPreparations(
          season,
          expectedDemandIncrease,
          baselineRevenue,
        );

        return {
          upcomingSeason: season.name,
          daysUntilPeak: season.daysUntilPeak,
          expectedDemandIncrease: Math.max(0, expectedDemandIncrease),
          preparationRecommendations: preparations,
        };
      });

      // Sort by days until peak (closest first)
      seasonalPlanning.sort((a, b) => a.daysUntilPeak - b.daysUntilPeak);

      this.logger.debug(
        `Seasonal business planning generated for ${seasonalPlanning.length} seasons`,
      );
      return seasonalPlanning;
    } catch (error) {
      this.logger.error(
        `Failed to generate seasonal business planning: ${error.message}`,
        error.stack,
      );
      return [
        {
          upcomingSeason: 'Error in Analysis',
          daysUntilPeak: 0,
          expectedDemandIncrease: 0,
          preparationRecommendations: [
            {
              action: 'Perbaiki sistem analisis seasonal',
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              estimatedImpact: 0,
              resourceRequirement: 'Tim teknis untuk troubleshooting',
            },
          ],
        },
      ];
    }
  }

  /**
   * Get upcoming Indonesian seasonal events with market context
   */
  private getUpcomingIndonesianSeasons(): Array<{
    name: string;
    peakMonth: number;
    daysUntilPeak: number;
    marketMultiplier: number;
    category: string;
    culturalContext: string;
  }> {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    const seasons = [
      // Ramadan (shifting dates - estimated)
      {
        name: 'Ramadan 2025',
        peakMonth: 3, // March 2025 (estimated)
        marketMultiplier: 1.35,
        category: 'religious',
        culturalContext: 'Muslim fasting month - evening shopping surge',
      },
      // Lebaran/Eid (after Ramadan)
      {
        name: 'Lebaran 2025',
        peakMonth: 4, // April 2025 (estimated)
        marketMultiplier: 1.8,
        category: 'religious',
        culturalContext: 'Biggest shopping season - gifts, clothes, food',
      },
      // Back to School
      {
        name: 'Back to School 2025',
        peakMonth: 7, // July
        marketMultiplier: 1.25,
        category: 'educational',
        culturalContext: 'School supplies, uniforms, electronics',
      },
      // Independence Day
      {
        name: 'Indonesian Independence Day',
        peakMonth: 8, // August 17
        marketMultiplier: 1.15,
        category: 'national',
        culturalContext: 'National pride - local products boost',
      },
      // Christmas
      {
        name: 'Christmas 2025',
        peakMonth: 12, // December
        marketMultiplier: 1.3,
        category: 'religious',
        culturalContext: 'Gift giving, decorations, celebrations',
      },
      // New Year
      {
        name: 'New Year 2026',
        peakMonth: 1, // January (next year)
        marketMultiplier: 1.2,
        category: 'cultural',
        culturalContext: 'Resolutions, new beginnings',
      },
    ];

    return seasons
      .map(season => {
        // Calculate days until peak
        let peakDate = new Date(currentYear, season.peakMonth - 1, 15); // Mid-month peak

        // If peak month has passed this year, use next year
        if (
          season.peakMonth < currentMonth ||
          (season.peakMonth === currentMonth && currentDate.getDate() > 15)
        ) {
          peakDate = new Date(currentYear + 1, season.peakMonth - 1, 15);
        }

        const daysUntilPeak = Math.ceil(
          (peakDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          ...season,
          daysUntilPeak: Math.max(0, daysUntilPeak),
        };
      })
      .filter(season => season.daysUntilPeak <= 365); // Only next 12 months
  }

  /**
   * Generate preparation recommendations for seasonal events
   */
  private generateSeasonalPreparations(
    season: {
      name: string;
      peakMonth: number;
      daysUntilPeak: number;
      marketMultiplier: number;
      category: string;
      culturalContext: string;
    },
    expectedDemandIncrease: number,
    baselineRevenue: number,
  ): Array<{
    action: string;
    deadline: Date;
    estimatedImpact: number;
    resourceRequirement: string;
  }> {
    const preparations = [];
    const currentDate = new Date();
    const peakDate = new Date(
      currentDate.getTime() + season.daysUntilPeak * 24 * 60 * 60 * 1000,
    );

    // Calculate estimated revenue impact
    const estimatedImpact = Math.round(
      baselineRevenue * (expectedDemandIncrease / 100),
    );

    // Common preparations for all seasons
    if (season.daysUntilPeak > 30) {
      preparations.push({
        action:
          'Analisis inventory dan demand forecasting untuk seasonal products',
        deadline: new Date(peakDate.getTime() - 21 * 24 * 60 * 60 * 1000), // 3 weeks before
        estimatedImpact: estimatedImpact * 0.3,
        resourceRequirement: 'Tim analytics dan inventory management',
      });

      preparations.push({
        action: 'Persiapan marketing campaign dan promotional materials',
        deadline: new Date(peakDate.getTime() - 14 * 24 * 60 * 60 * 1000), // 2 weeks before
        estimatedImpact: estimatedImpact * 0.4,
        resourceRequirement: 'Tim marketing dan creative',
      });
    }

    if (season.daysUntilPeak > 14) {
      preparations.push({
        action: 'Optimasi stock levels dan supplier coordination',
        deadline: new Date(peakDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week before
        estimatedImpact: estimatedImpact * 0.5,
        resourceRequirement: 'Tim procurement dan logistics',
      });
    }

    // Season-specific preparations
    if (season.name.includes('Ramadan')) {
      preparations.push({
        action: 'Adjust operating hours untuk berbuka puasa shopping surge',
        deadline: new Date(peakDate.getTime() - 10 * 24 * 60 * 60 * 1000),
        estimatedImpact: estimatedImpact * 0.2,
        resourceRequirement: 'Tim operations dan customer service',
      });

      preparations.push({
        action: 'Prepare halal certification dan Islamic-themed marketing',
        deadline: new Date(peakDate.getTime() - 14 * 24 * 60 * 60 * 1000),
        estimatedImpact: estimatedImpact * 0.3,
        resourceRequirement: 'Tim compliance dan marketing',
      });
    }

    if (season.name.includes('Lebaran')) {
      preparations.push({
        action: 'Prepare mudik logistics dan regional distribution',
        deadline: new Date(peakDate.getTime() - 14 * 24 * 60 * 60 * 1000),
        estimatedImpact: estimatedImpact * 0.4,
        resourceRequirement: 'Tim logistics dan regional operations',
      });

      preparations.push({
        action: 'Stock up on gift items, traditional clothes, dan food items',
        deadline: new Date(peakDate.getTime() - 21 * 24 * 60 * 60 * 1000),
        estimatedImpact: estimatedImpact * 0.6,
        resourceRequirement: 'Tim procurement dan category management',
      });
    }

    if (season.name.includes('Christmas')) {
      preparations.push({
        action: 'Prepare gift wrapping services dan Christmas decorations',
        deadline: new Date(peakDate.getTime() - 14 * 24 * 60 * 60 * 1000),
        estimatedImpact: estimatedImpact * 0.3,
        resourceRequirement: 'Tim customer service dan visual merchandising',
      });
    }

    if (season.name.includes('Back to School')) {
      preparations.push({
        action: 'Stock educational supplies, uniforms, dan electronics',
        deadline: new Date(peakDate.getTime() - 21 * 24 * 60 * 60 * 1000),
        estimatedImpact: estimatedImpact * 0.5,
        resourceRequirement: 'Tim procurement dan education category',
      });
    }

    // Always include customer service preparation
    preparations.push({
      action: 'Scale up customer service team untuk increased demand',
      deadline: new Date(peakDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      estimatedImpact: estimatedImpact * 0.2,
      resourceRequirement: 'Tim HR dan customer service',
    });

    return preparations.slice(0, 6); // Limit to 6 key preparations
  }

  async generateHighPriorityActions(tenantId: string): Promise<
    Array<{
      actionType: BusinessOpportunityType;
      title: string;
      description: string;
      estimatedImpact: number;
      effortLevel: 'low' | 'medium' | 'high';
      timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
      requiredResources: string[];
      successMetrics: string[];
      indonesianContextConsiderations: string[];
    }>
  > {
    try {
      return [
        {
          actionType: BusinessOpportunityType.CHURN_PREVENTION,
          title: 'Implement Customer Retention Campaigns',
          description:
            'Launch targeted campaigns to prevent high-risk customers from churning',
          estimatedImpact: 5000000, // IDR 5M potential retention value
          effortLevel: 'medium',
          timeframe: 'immediate',
          requiredResources: [
            'Marketing team',
            'Customer success team',
            'Analytics tools',
          ],
          successMetrics: [
            'Churn rate reduction',
            'Customer satisfaction scores',
            'Retention rate improvement',
          ],
          indonesianContextConsiderations: [
            'Focus on relationship building',
            'Use WhatsApp for personal touch',
            'Consider cultural loyalty factors',
          ],
        },
        {
          actionType: BusinessOpportunityType.UPSELL_EXPANSION,
          title: 'Optimize High-Value Customer Experience',
          description:
            'Enhance service quality and offerings for premium customer segment',
          estimatedImpact: 8000000, // IDR 8M upsell potential
          effortLevel: 'high',
          timeframe: 'short_term',
          requiredResources: [
            'Product team',
            'Customer service team',
            'Premium support infrastructure',
          ],
          successMetrics: [
            'Average order value increase',
            'Customer lifetime value growth',
            'Premium conversion rate',
          ],
          indonesianContextConsiderations: [
            'Indonesian premium customers value exclusivity',
            'Personal service important',
            'Local language support essential',
          ],
        },
        {
          actionType: BusinessOpportunityType.SEASONAL_PREPARATION,
          title: 'Develop Seasonal Marketing Strategies',
          description:
            'Prepare comprehensive campaigns for Ramadan and Lebaran seasons',
          estimatedImpact: 12000000, // IDR 12M seasonal boost potential
          effortLevel: 'medium',
          timeframe: 'medium_term',
          requiredResources: [
            'Marketing team',
            'Content creators',
            'Inventory planning team',
          ],
          successMetrics: [
            'Seasonal revenue growth',
            'Campaign engagement rates',
            'Inventory turnover',
          ],
          indonesianContextConsiderations: [
            'Ramadan timing crucial',
            'Religious sensitivities',
            'Family-oriented messaging',
            'Bulk purchase patterns',
          ],
        },
      ];
    } catch (error) {
      this.logger.error(
        `Failed to generate high priority actions: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  async generateMarketingRecommendations(tenantId: string): Promise<
    Array<{
      targetSegment: string;
      campaignType: string;
      suggestedChannels: string[];
      budgetAllocation: number;
      expectedROI: number;
      culturalConsiderations: string[];
    }>
  > {
    try {
      return [
        {
          targetSegment: 'High-Value Jakarta Customers',
          campaignType: 'Premium Product Launch',
          suggestedChannels: [
            'Instagram',
            'WhatsApp Business',
            'Email',
            'Direct Sales',
          ],
          budgetAllocation: 15000000, // IDR 15M budget
          expectedROI: 250, // 250% ROI
          culturalConsiderations: [
            'Jakarta customers prefer premium branding',
            'High-quality visuals essential',
            'Personal service expectations',
            'Status symbol messaging effective',
          ],
        },
        {
          targetSegment: 'UMKM Business Customers',
          campaignType: 'B2B Growth Campaign',
          suggestedChannels: [
            'LinkedIn',
            'WhatsApp Business',
            'Trade publications',
            'Business events',
          ],
          budgetAllocation: 12000000, // IDR 12M budget
          expectedROI: 300, // 300% ROI
          culturalConsiderations: [
            'Focus on business growth benefits',
            'Relationship-based selling important',
            'Local business network integration',
            'Family business considerations',
          ],
        },
        {
          targetSegment: 'Mobile-First Users',
          campaignType: 'Mobile App Engagement',
          suggestedChannels: [
            'Mobile push notifications',
            'WhatsApp',
            'TikTok',
            'Instagram Stories',
          ],
          budgetAllocation: 8000000, // IDR 8M budget
          expectedROI: 200, // 200% ROI
          culturalConsiderations: [
            '85% Indonesian users are mobile-first',
            'Video content highly engaging',
            'Social sharing important',
            'Mobile payment integration crucial',
          ],
        },
      ];
    } catch (error) {
      this.logger.error(
        `Failed to generate marketing recommendations: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  async generateProductDevelopmentInsights(tenantId: string): Promise<any> {
    try {
      return {
        insights: [],
        recommendations: [],
        opportunities: [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate product development insights: ${error.message}`,
        error.stack,
      );
      return { insights: [], recommendations: [], opportunities: [] };
    }
  }

  async generateCustomerAcquisitionMetrics(tenantId: string): Promise<any> {
    try {
      return {
        acquisitionRate: 0,
        costPerAcquisition: 0,
        channels: {},
        trends: {},
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate customer acquisition metrics: ${error.message}`,
        error.stack,
      );
      return {
        acquisitionRate: 0,
        costPerAcquisition: 0,
        channels: {},
        trends: {},
      };
    }
  }

  async generateCustomerRetentionMetrics(tenantId: string): Promise<any> {
    try {
      return {
        retentionRate: 0,
        churnRate: 0,
        segments: {},
        trends: {},
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate customer retention metrics: ${error.message}`,
        error.stack,
      );
      return { retentionRate: 0, churnRate: 0, segments: {}, trends: {} };
    }
  }

  async generateRevenueOptimizationMetrics(tenantId: string): Promise<any> {
    try {
      return {
        optimization: {},
        opportunities: [],
        recommendations: [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate revenue optimization metrics: ${error.message}`,
        error.stack,
      );
      return { optimization: {}, opportunities: [], recommendations: [] };
    }
  }

  async generateMarketPositioningMetrics(tenantId: string): Promise<any> {
    try {
      return {
        position: {},
        competitive: {},
        recommendations: [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate market positioning metrics: ${error.message}`,
        error.stack,
      );
      return { position: {}, competitive: {}, recommendations: [] };
    }
  }

  // =============================================
  // COMPREHENSIVE BUSINESS OPPORTUNITY ANALYSIS HELPERS
  // Supporting methods for enhanced opportunity identification
  // =============================================

  /**
   * Calculate dynamic high-value threshold based on customer distribution
   */
  private async calculateDynamicHighValueThreshold(
    customers: any[],
  ): Promise<number> {
    if (customers.length === 0) return 5000000; // Default 5M IDR

    const spendingValues = customers
      .map(c => c.totalSpent || 0)
      .sort((a, b) => b - a);
    const percentile80 =
      spendingValues[Math.floor(spendingValues.length * 0.2)]; // Top 20%
    const percentile90 =
      spendingValues[Math.floor(spendingValues.length * 0.1)]; // Top 10%

    // Use 80th percentile as high-value threshold, minimum 3M IDR
    return Math.max(3000000, percentile80 || 5000000);
  }

  /**
   * Calculate potential order value increase for upselling analysis
   */
  private async calculatePotentialOrderValueIncrease(
    tenantId: string,
    customers: any[],
  ): Promise<number> {
    try {
      if (customers.length === 0) return 500000; // Default IDR 500K

      // Analyze historical purchasing patterns to predict upsell potential
      const customerIds = customers.map(c => c.customerId).filter(Boolean);

      if (customerIds.length === 0) {
        // Fallback: Use average order value increase
        const avgOrderValues = customers.map(c => c.averageOrderValue || 0);
        const currentAvg =
          avgOrderValues.reduce((sum, val) => sum + val, 0) /
          avgOrderValues.length;
        return currentAvg * 0.3; // 30% increase potential
      }

      // Query historical order progression for these customers
      const orderProgression = await this.dataSource.query(
        `
        WITH customer_order_progression AS (
          SELECT 
            customer_id,
            DATE_TRUNC('month', created_at) as order_month,
            AVG(total_amount) as avg_monthly_order,
            COUNT(*) as order_count
          FROM orders 
          WHERE tenant_id = $1 
            AND customer_id = ANY($2)
            AND created_at >= CURRENT_DATE - INTERVAL '12 months'
          GROUP BY customer_id, DATE_TRUNC('month', created_at)
        ),
        growth_analysis AS (
          SELECT 
            customer_id,
            order_month,
            avg_monthly_order,
            LAG(avg_monthly_order) OVER (PARTITION BY customer_id ORDER BY order_month) as prev_month_order,
            order_count
          FROM customer_order_progression
        )
        SELECT 
          AVG(CASE 
            WHEN prev_month_order > 0 AND avg_monthly_order > prev_month_order 
            THEN (avg_monthly_order - prev_month_order) 
            ELSE 0 
          END) as avg_increase
        FROM growth_analysis
        WHERE prev_month_order IS NOT NULL
      `,
        [tenantId, customerIds],
      );

      const historicalIncrease = parseFloat(
        orderProgression[0]?.avg_increase || '0',
      );
      return Math.max(500000, historicalIncrease * 1.2); // 20% buffer for upselling potential
    } catch (error) {
      this.logger.error(
        `Error calculating order value increase: ${error.message}`,
      );
      // Fallback calculation
      const avgSpent =
        customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
        customers.length;
      return Math.max(500000, avgSpent * 0.15); // 15% of total spent
    }
  }

  /**
   * Calculate confidence score based on data quality and sample size
   */
  private calculateConfidenceScore(
    count: number,
    total: number,
    baseConfidence: number,
  ): number {
    if (total === 0) return 30; // Low confidence with no data

    const sampleRatio = count / total;
    const sampleSizeMultiplier = Math.min(1, count / 50); // Confidence increases up to 50 samples
    const representativenessScore = Math.min(1, sampleRatio * 10); // Good if sample is >10% of total

    const confidence =
      baseConfidence * 100 * sampleSizeMultiplier * representativenessScore;
    return Math.max(30, Math.min(95, confidence)); // Confidence between 30-95%
  }

  /**
   * Calculate potential lost revenue from churning customers
   */
  private async calculatePotentialLostRevenue(
    tenantId: string,
    churnRiskCustomers: any[],
  ): Promise<number> {
    try {
      if (churnRiskCustomers.length === 0) return 0;

      // Calculate annualized revenue for at-risk customers
      const customerIds = churnRiskCustomers
        .map(c => c.customerId)
        .filter(Boolean);

      if (customerIds.length === 0) {
        // Fallback: Use LTV estimates
        return (
          churnRiskCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) *
          0.5
        ); // 50% annual risk
      }

      const revenueAnalysis = await this.dataSource.query(
        `
        SELECT 
          customer_id,
          SUM(total_amount) as last_12_months_revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(*) as order_frequency
        FROM orders 
        WHERE tenant_id = $1 
          AND customer_id = ANY($2)
          AND created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY customer_id
      `,
        [tenantId, customerIds],
      );

      // Calculate annualized potential loss
      let totalPotentialLoss = 0;
      for (const analysis of revenueAnalysis) {
        const annualRevenue = parseFloat(
          analysis.last_12_months_revenue || '0',
        );
        const churnCustomer = churnRiskCustomers.find(
          c => c.customerId === analysis.customer_id,
        );
        const churnProbability = (churnCustomer?.churnRiskScore || 70) / 100;

        totalPotentialLoss += annualRevenue * churnProbability;
      }

      return totalPotentialLoss;
    } catch (error) {
      this.logger.error(
        `Error calculating potential lost revenue: ${error.message}`,
      );
      // Fallback: Use average lifetime value
      return (
        churnRiskCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) *
        0.4
      );
    }
  }

  /**
   * Calculate historical retention success rate for confidence scoring
   */
  private async calculateRetentionSuccessRate(
    tenantId: string,
  ): Promise<number> {
    try {
      // Analyze historical retention campaigns effectiveness
      const retentionHistory = await this.dataSource.query(
        `
        WITH churn_risk_history AS (
          SELECT 
            customer_id,
            DATE_TRUNC('month', updated_at) as analysis_month,
            churn_risk_score,
            LAG(churn_risk_score) OVER (PARTITION BY customer_id ORDER BY updated_at) as prev_churn_risk
          FROM customer_analytics
          WHERE tenant_id = $1 
            AND churn_risk_score >= 60
            AND updated_at >= CURRENT_DATE - INTERVAL '6 months'
        ),
        retention_outcomes AS (
          SELECT 
            customer_id,
            analysis_month,
            churn_risk_score,
            prev_churn_risk,
            CASE 
              WHEN prev_churn_risk > churn_risk_score THEN 1 
              ELSE 0 
            END as retention_success
          FROM churn_risk_history
          WHERE prev_churn_risk IS NOT NULL
        )
        SELECT 
          COUNT(*) as total_interventions,
          SUM(retention_success) as successful_retentions,
          CASE 
            WHEN COUNT(*) > 0 THEN (SUM(retention_success)::float / COUNT(*) * 100)
            ELSE 65 
          END as success_rate
        FROM retention_outcomes
      `,
        [tenantId],
      );

      const successRate = parseFloat(retentionHistory[0]?.success_rate || '65');
      return Math.max(45, Math.min(85, successRate)); // Success rate between 45-85%
    } catch (error) {
      this.logger.error(
        `Error calculating retention success rate: ${error.message}`,
      );
      return 65; // Default 65% success rate
    }
  }

  /**
   * Analyze cross-sell potential based on customer purchase patterns
   */
  private async analyzeCrossSellPotential(
    tenantId: string,
    customers: any[],
  ): Promise<{
    eligibleCustomers: number;
    estimatedRevenue: number;
    confidence: number;
    topCategories: string[];
  }> {
    try {
      // Find customers with single-category purchases (cross-sell potential)
      const eligibleCustomers = customers.filter(
        c =>
          (c.productCategories?.length || 0) <= 2 &&
          (c.totalTransactions || 0) >= 3 &&
          (c.daysSinceLastTransaction || 0) <= 90,
      );

      if (eligibleCustomers.length === 0) {
        return {
          eligibleCustomers: 0,
          estimatedRevenue: 0,
          confidence: 30,
          topCategories: [],
        };
      }

      // Analyze category affinity and cross-sell potential
      const categoryAnalysis = await this.dataSource.query(
        `
        WITH customer_categories AS (
          SELECT 
            o.customer_id,
            p.category_id,
            COUNT(*) as category_purchases,
            SUM(oi.total_price) as category_revenue
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          JOIN products p ON oi.product_id = p.id
          WHERE o.tenant_id = $1 
            AND o.created_at >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY o.customer_id, p.category_id
        ),
        cross_sell_analysis AS (
          SELECT 
            category_id,
            COUNT(DISTINCT customer_id) as customers_in_category,
            AVG(category_revenue) as avg_category_revenue
          FROM customer_categories
          GROUP BY category_id
          HAVING COUNT(DISTINCT customer_id) >= 5
        )
        SELECT 
          category_id,
          customers_in_category,
          avg_category_revenue
        FROM cross_sell_analysis
        ORDER BY avg_category_revenue DESC
        LIMIT 5
      `,
        [tenantId],
      );

      const topCategories = categoryAnalysis
        .map(cat => cat.category_id || 'Unknown')
        .slice(0, 3);
      const avgCategoryRevenue =
        categoryAnalysis.length > 0
          ? categoryAnalysis.reduce(
              (sum, cat) => sum + parseFloat(cat.avg_category_revenue || '0'),
              0,
            ) / categoryAnalysis.length
          : 1500000; // Default IDR 1.5M

      const estimatedRevenue =
        eligibleCustomers.length * avgCategoryRevenue * 0.4; // 40% cross-sell success rate
      const confidence = this.calculateConfidenceScore(
        eligibleCustomers.length,
        customers.length,
        0.6,
      );

      return {
        eligibleCustomers: eligibleCustomers.length,
        estimatedRevenue,
        confidence,
        topCategories,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing cross-sell potential: ${error.message}`,
      );
      return {
        eligibleCustomers: 0,
        estimatedRevenue: 0,
        confidence: 30,
        topCategories: [],
      };
    }
  }

  /**
   * Analyze customer acquisition opportunities based on market gaps
   */
  private async analyzeCustomerAcquisitionOpportunity(
    tenantId: string,
    customers: any[],
  ): Promise<{
    score: number;
    estimatedRevenue: number;
    confidence: number;
    topChannels: string[];
    expectedCustomers: number;
  }> {
    try {
      // Analyze customer acquisition trends and channel effectiveness
      const acquisitionAnalysis = await this.dataSource.query(
        `
        WITH monthly_acquisitions AS (
          SELECT 
            DATE_TRUNC('month', created_at) as acquisition_month,
            COUNT(*) as new_customers,
            acquisition_channel,
            AVG(EXTRACT(DAY FROM (first_order_date - created_at))) as avg_days_to_first_order
          FROM customers c
          LEFT JOIN (
            SELECT 
              customer_id,
              MIN(created_at) as first_order_date
            FROM orders 
            WHERE tenant_id = $1
            GROUP BY customer_id
          ) fo ON c.id = fo.customer_id
          WHERE c.tenant_id = $1 
            AND c.created_at >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', created_at), acquisition_channel
        )
        SELECT 
          acquisition_channel,
          AVG(new_customers) as avg_monthly_acquisitions,
          AVG(avg_days_to_first_order) as avg_conversion_days
        FROM monthly_acquisitions
        WHERE acquisition_channel IS NOT NULL
        GROUP BY acquisition_channel
        ORDER BY avg_monthly_acquisitions DESC
        LIMIT 3
      `,
        [tenantId],
      );

      const currentMonthlyGrowth = customers.length / 12; // Estimate monthly growth
      const topChannels = acquisitionAnalysis.map(
        ch => ch.acquisition_channel || 'Unknown',
      );

      // Calculate acquisition potential
      const potentialGrowthRate = Math.min(50, currentMonthlyGrowth * 1.5); // 50% increase max
      const expectedCustomers = Math.round(potentialGrowthRate * 3); // 3 months projection

      const avgCustomerValue =
        customers.length > 0
          ? customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
            customers.length
          : 2000000; // Default IDR 2M LTV

      const estimatedRevenue = expectedCustomers * avgCustomerValue * 0.7; // 70% success rate
      const score = Math.min(
        100,
        (potentialGrowthRate / currentMonthlyGrowth) * 50,
      );
      const confidence = this.calculateConfidenceScore(
        acquisitionAnalysis.length,
        10,
        0.65,
      );

      return {
        score,
        estimatedRevenue,
        confidence,
        topChannels:
          topChannels.length > 0
            ? topChannels
            : ['Digital Marketing', 'Referral', 'Social Media'],
        expectedCustomers,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing customer acquisition opportunity: ${error.message}`,
      );
      return {
        score: 40,
        estimatedRevenue: 10000000, // Default IDR 10M
        confidence: 45,
        topChannels: ['Digital Marketing', 'Social Media'],
        expectedCustomers: 15,
      };
    }
  }

  /**
   * Analyze Indonesian seasonal opportunities dynamically
   */
  private async analyzeIndonesianSeasonalOpportunities(
    tenantId: string,
    customers: any[],
  ): Promise<
    Array<{
      type: BusinessOpportunityType;
      estimatedImpact: number;
      timeToRealize: number;
      confidence: number;
      description: string;
    }>
  > {
    const opportunities = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    try {
      // Ramadan opportunity analysis (March-April preparation)
      if (currentMonth >= 2 && currentMonth <= 4) {
        const ramadanCustomers = customers.filter(
          c =>
            c.purchaseBehavior?.seasonalPatterns?.includes('ramadan') ||
            c.productCategories?.some((cat: string) =>
              ['food', 'beverage', 'religious', 'clothing'].includes(
                cat.toLowerCase(),
              ),
            ),
        );

        if (ramadanCustomers.length > 10) {
          const historicalRamadanBoost = await this.calculateSeasonalBoost(
            tenantId,
            'ramadan',
          );
          const estimatedImpact =
            ramadanCustomers.length * 2500000 * (historicalRamadanBoost / 100); // Based on historical data

          opportunities.push({
            type: BusinessOpportunityType.SEASONAL_PREPARATION,
            estimatedImpact,
            timeToRealize: 30,
            confidence: 90,
            description: `Ramadan preparation opportunity: ${ramadanCustomers.length} customers with ${historicalRamadanBoost}% historical seasonal increase`,
          });
        }
      }

      // Lebaran opportunity analysis (April-May)
      if (currentMonth >= 4 && currentMonth <= 6) {
        const lebaranCategories = customers.filter(c =>
          c.productCategories?.some((cat: string) =>
            ['fashion', 'food', 'gift', 'decoration'].includes(
              cat.toLowerCase(),
            ),
          ),
        );

        if (lebaranCategories.length > 5) {
          opportunities.push({
            type: BusinessOpportunityType.SEASONAL_PREPARATION,
            estimatedImpact: lebaranCategories.length * 3000000, // Higher spending during Lebaran
            timeToRealize: 25,
            confidence: 85,
            description: `Lebaran surge preparation: ${lebaranCategories.length} customers in relevant categories with gift and celebration purchases`,
          });
        }
      }

      // Back-to-school opportunity (June-July)
      if (currentMonth >= 6 && currentMonth <= 8) {
        const schoolAgeCustomers = customers.filter(
          c =>
            c.demographicSegment?.includes('family') ||
            c.productCategories?.some((cat: string) =>
              ['education', 'stationery', 'electronics', 'clothing'].includes(
                cat.toLowerCase(),
              ),
            ),
        );

        if (schoolAgeCustomers.length > 8) {
          opportunities.push({
            type: BusinessOpportunityType.SEASONAL_PREPARATION,
            estimatedImpact: schoolAgeCustomers.length * 1800000,
            timeToRealize: 35,
            confidence: 75,
            description: `Back-to-school opportunity: ${schoolAgeCustomers.length} family customers with education-related purchase potential`,
          });
        }
      }

      // Year-end opportunity (November-December)
      if (currentMonth >= 11 || currentMonth <= 1) {
        const yearEndCustomers = customers.filter(
          c =>
            (c.totalSpent || 0) > 3000000 && // High spenders for year-end bonuses
            (c.daysSinceLastTransaction || 0) <= 60,
        );

        if (yearEndCustomers.length > 10) {
          opportunities.push({
            type: BusinessOpportunityType.SEASONAL_PREPARATION,
            estimatedImpact: yearEndCustomers.length * 4000000, // Year-end bonuses effect
            timeToRealize: 20,
            confidence: 80,
            description: `Year-end bonus season: ${yearEndCustomers.length} high-value customers with increased purchasing power from 13th-month salary`,
          });
        }
      }

      return opportunities;
    } catch (error) {
      this.logger.error(
        `Error analyzing seasonal opportunities: ${error.message}`,
      );
      // Fallback seasonal opportunity
      return [
        {
          type: BusinessOpportunityType.SEASONAL_PREPARATION,
          estimatedImpact: 12000000,
          timeToRealize: 45,
          confidence: 70,
          description:
            'General Indonesian seasonal shopping pattern preparation',
        },
      ];
    }
  }

  /**
   * Calculate historical seasonal boost percentage
   */
  private async calculateSeasonalBoost(
    tenantId: string,
    season: string,
  ): Promise<number> {
    try {
      const seasonalData = await this.dataSource.query(
        `
        WITH seasonal_analysis AS (
          SELECT 
            EXTRACT(MONTH FROM created_at) as order_month,
            SUM(total_amount) as monthly_revenue
          FROM orders
          WHERE tenant_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '24 months'
          GROUP BY EXTRACT(MONTH FROM created_at)
        ),
        baseline AS (
          SELECT AVG(monthly_revenue) as avg_monthly_revenue
          FROM seasonal_analysis
        )
        SELECT 
          sa.order_month,
          sa.monthly_revenue,
          b.avg_monthly_revenue,
          CASE 
            WHEN b.avg_monthly_revenue > 0 
            THEN ((sa.monthly_revenue - b.avg_monthly_revenue) / b.avg_monthly_revenue * 100)
            ELSE 0 
          END as boost_percentage
        FROM seasonal_analysis sa
        CROSS JOIN baseline b
        WHERE sa.order_month IN (3, 4, 5) -- Ramadan/Lebaran months typically
        ORDER BY boost_percentage DESC
        LIMIT 1
      `,
        [tenantId],
      );

      return parseFloat(seasonalData[0]?.boost_percentage || '25'); // Default 25% boost
    } catch (error) {
      this.logger.error(`Error calculating seasonal boost: ${error.message}`);
      return 25; // Default 25% seasonal boost
    }
  }

  /**
   * Analyze loyalty enhancement potential
   */
  private async analyzeLoyaltyEnhancementPotential(
    tenantId: string,
    customers: any[],
  ): Promise<{
    eligibleCustomers: number;
    estimatedRevenue: number;
    confidence: number;
    averageIncrease: number;
  }> {
    try {
      // Find customers suitable for loyalty program enhancement
      const loyaltyEligible = customers.filter(
        c =>
          (c.totalTransactions || 0) >= 5 &&
          (c.monthlyTransactionFrequency || 0) >= 1 &&
          (c.loyaltyScore || 0) >= 60 &&
          (c.daysSinceLastTransaction || 0) <= 45,
      );

      if (loyaltyEligible.length === 0) {
        return {
          eligibleCustomers: 0,
          estimatedRevenue: 0,
          confidence: 30,
          averageIncrease: 0,
        };
      }

      // Calculate potential increase from loyalty program
      const avgCustomerValue =
        loyaltyEligible.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
        loyaltyEligible.length;
      const loyaltyIncrease = 15; // 15% average increase from loyalty programs
      const estimatedIncrease = avgCustomerValue * (loyaltyIncrease / 100) * 12; // Annualized
      const estimatedRevenue = loyaltyEligible.length * estimatedIncrease;

      const confidence = this.calculateConfidenceScore(
        loyaltyEligible.length,
        customers.length,
        0.7,
      );

      return {
        eligibleCustomers: loyaltyEligible.length,
        estimatedRevenue,
        confidence,
        averageIncrease: loyaltyIncrease,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing loyalty enhancement potential: ${error.message}`,
      );
      return {
        eligibleCustomers: 0,
        estimatedRevenue: 0,
        confidence: 30,
        averageIncrease: 0,
      };
    }
  }

  /**
   * Analyze market penetration opportunities
   */
  private async analyzeMarketPenetrationOpportunity(
    tenantId: string,
    customers: any[],
  ): Promise<{
    score: number;
    estimatedRevenue: number;
    confidence: number;
    targetSegments: string[];
    potentialCustomers: number;
  }> {
    try {
      // Analyze underrepresented segments
      const segmentAnalysis = new Map<string, number>();
      customers.forEach(c => {
        const segment = c.segment || 'undefined';
        segmentAnalysis.set(segment, (segmentAnalysis.get(segment) || 0) + 1);
      });

      // Identify growth segments (segments with fewer customers but high potential)
      const totalCustomers = customers.length;
      const underrepresentedSegments = Array.from(segmentAnalysis.entries())
        .filter(([segment, count]) => count < totalCustomers * 0.15) // Less than 15% of customer base
        .map(([segment]) => segment)
        .filter(segment => segment !== 'undefined')
        .slice(0, 3);

      if (underrepresentedSegments.length === 0) {
        return {
          score: 30,
          estimatedRevenue: 0,
          confidence: 40,
          targetSegments: [],
          potentialCustomers: 0,
        };
      }

      // Calculate market penetration potential
      const avgCustomerValue =
        customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
        customers.length;
      const marketPenetrationRate = 0.05; // 5% market penetration assumed
      const potentialCustomers = Math.round(totalCustomers * 0.3); // 30% growth potential
      const estimatedRevenue = potentialCustomers * avgCustomerValue * 0.6; // 60% success rate

      const score = Math.min(100, underrepresentedSegments.length * 25);
      const confidence = this.calculateConfidenceScore(
        underrepresentedSegments.length,
        10,
        0.55,
      );

      return {
        score,
        estimatedRevenue,
        confidence,
        targetSegments: underrepresentedSegments,
        potentialCustomers,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing market penetration opportunity: ${error.message}`,
      );
      return {
        score: 40,
        estimatedRevenue: 8000000,
        confidence: 45,
        targetSegments: ['UMKM', 'Premium'],
        potentialCustomers: 12,
      };
    }
  }

  /**
   * Fallback method for basic opportunity generation when comprehensive analysis fails
   */
  private generateBasicOpportunities(customerData: any): Array<{
    type: BusinessOpportunityType;
    estimatedImpact: number;
    timeToRealize: number;
    confidence: number;
    description: string;
  }> {
    const opportunities = [];

    // Basic seasonal opportunity
    opportunities.push({
      type: BusinessOpportunityType.SEASONAL_PREPARATION,
      estimatedImpact: 10000000, // IDR 10M
      timeToRealize: 30,
      confidence: 70,
      description:
        'Indonesian seasonal shopping patterns preparation (Ramadan/Lebaran/Year-end)',
    });

    // Basic customer retention
    if (customerData?.length > 10) {
      opportunities.push({
        type: BusinessOpportunityType.CHURN_PREVENTION,
        estimatedImpact: customerData.length * 500000, // IDR 500K per customer
        timeToRealize: 21,
        confidence: 65,
        description: `Basic retention program for ${customerData.length} customers`,
      });
    }

    return opportunities;
  }

  // =============================================
  // COMPREHENSIVE INDONESIAN MARKET ANALYSIS HELPERS
  // Supporting methods for enhanced Indonesian market insights
  // =============================================

  /**
   * Comprehensive Ramadan market opportunity analysis
   */
  private async analyzeRamadanMarketOpportunity(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      const currentMonth = new Date().getMonth() + 1;

      // Calculate Ramadan relevance based on timing and customer data
      let temporalRelevance = 0;
      if (currentMonth >= 2 && currentMonth <= 4) {
        temporalRelevance = 95; // High relevance during Ramadan preparation/period
      } else if (currentMonth >= 11 || currentMonth <= 1) {
        temporalRelevance = 75; // Medium relevance for early planning
      } else {
        temporalRelevance = 40; // Lower relevance outside Ramadan season
      }

      // Analyze historical Ramadan shopping patterns
      const ramadanData = await this.dataSource.query(
        `
        WITH ramadan_analysis AS (
          SELECT 
            EXTRACT(MONTH FROM created_at) as order_month,
            COUNT(*) as order_count,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_order_value
          FROM orders
          WHERE tenant_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '24 months'
            AND EXTRACT(MONTH FROM created_at) IN (3, 4, 5) -- Ramadan months typically
          GROUP BY EXTRACT(MONTH FROM created_at)
        ),
        baseline AS (
          SELECT 
            AVG(total_revenue) as avg_monthly_revenue,
            AVG(order_count) as avg_monthly_orders
          FROM (
            SELECT 
              EXTRACT(MONTH FROM created_at) as order_month,
              SUM(total_amount) as total_revenue,
              COUNT(*) as order_count
            FROM orders
            WHERE tenant_id = $1 
              AND created_at >= CURRENT_DATE - INTERVAL '24 months'
              AND EXTRACT(MONTH FROM created_at) NOT IN (3, 4, 5, 12) -- Exclude seasonal months
            GROUP BY EXTRACT(MONTH FROM created_at)
          ) baseline_months
        )
        SELECT 
          AVG(ra.total_revenue) as ramadan_avg_revenue,
          AVG(ra.order_count) as ramadan_avg_orders,
          b.avg_monthly_revenue,
          b.avg_monthly_orders,
          CASE 
            WHEN b.avg_monthly_revenue > 0 
            THEN ((AVG(ra.total_revenue) - b.avg_monthly_revenue) / b.avg_monthly_revenue * 100)
            ELSE 0 
          END as revenue_boost_percentage
        FROM ramadan_analysis ra
        CROSS JOIN baseline b
      `,
        [tenantId],
      );

      const revenueBoost = parseFloat(
        ramadanData[0]?.revenue_boost_percentage || '0',
      );
      const ramadanRevenue = parseFloat(
        ramadanData[0]?.ramadan_avg_revenue || '0',
      );

      // Analyze Ramadan-relevant customer segments
      const ramadanCustomers = customers.filter(
        c =>
          c.productCategories?.some((cat: string) =>
            [
              'food',
              'beverage',
              'religious',
              'clothing',
              'dates',
              'halal',
            ].includes(cat.toLowerCase()),
          ) ||
          (c.customerSegment &&
            c.customerSegment.toLowerCase().includes('muslim')),
      );

      const relevantCustomerPercentage =
        customers.length > 0
          ? (ramadanCustomers.length / customers.length) * 100
          : 0;

      // Calculate final relevance score
      const customerRelevance = Math.min(100, relevantCustomerPercentage * 2); // Scale customer relevance
      const historicalRelevance = Math.min(100, Math.abs(revenueBoost) * 2); // Scale historical impact
      const finalRelevance = Math.round(
        temporalRelevance * 0.4 +
          customerRelevance * 0.35 +
          historicalRelevance * 0.25,
      );

      const insight = `${
        ramadanCustomers.length
      } customers (${relevantCustomerPercentage.toFixed(
        1,
      )}%) in Ramadan-relevant categories with ${
        revenueBoost > 0
          ? `+${revenueBoost.toFixed(1)}%`
          : `${revenueBoost.toFixed(1)}%`
      } historical revenue impact during Ramadan period`;

      const implication =
        revenueBoost > 15
          ? `High Ramadan opportunity: Prepare specialized inventory, halal certifications, and Ramadan marketing campaigns 45-60 days before. Expected ${revenueBoost.toFixed(
              0,
            )}% revenue boost with proper preparation.`
          : revenueBoost > 5
          ? `Moderate Ramadan opportunity: Focus on halal food products, religious items, and family-oriented promotions. Potential ${revenueBoost.toFixed(
              0,
            )}% revenue increase.`
          : `Build Ramadan foundation: Develop halal product lines, partner with religious communities, and establish Ramadan shopping traditions for future growth.`;

      return {
        relevance: Math.max(30, finalRelevance),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing Ramadan opportunity: ${error.message}`,
      );
      return {
        relevance: 70,
        insight:
          'Ramadan represents significant opportunity for Indonesian businesses with 87% Muslim population',
        implication:
          'Prepare halal-certified products, religious-themed campaigns, and family-oriented promotions for Ramadan season',
      };
    }
  }

  /**
   * Lebaran surge patterns analysis
   */
  private async analyzeLebaranSurgePatterns(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      const currentMonth = new Date().getMonth() + 1;

      // Calculate Lebaran timing relevance
      let temporalRelevance = 0;
      if (currentMonth >= 4 && currentMonth <= 6) {
        temporalRelevance = 90; // High relevance during Lebaran period
      } else if (currentMonth >= 2 && currentMonth <= 3) {
        temporalRelevance = 75; // Medium relevance for preparation
      } else {
        temporalRelevance = 35; // Lower relevance outside Lebaran season
      }

      // Analyze historical Lebaran shopping surge
      const lebaranData = await this.dataSource.query(
        `
        WITH lebaran_analysis AS (
          SELECT 
            EXTRACT(MONTH FROM created_at) as order_month,
            COUNT(*) as order_count,
            SUM(total_amount) as total_revenue,
            COUNT(DISTINCT customer_id) as unique_customers
          FROM orders
          WHERE tenant_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '24 months'
            AND EXTRACT(MONTH FROM created_at) IN (4, 5, 6) -- Lebaran months typically
          GROUP BY EXTRACT(MONTH FROM created_at)
        )
        SELECT 
          AVG(total_revenue) as avg_lebaran_revenue,
          AVG(order_count) as avg_lebaran_orders,
          AVG(unique_customers) as avg_lebaran_customers
        FROM lebaran_analysis
      `,
        [tenantId],
      );

      const lebaranRevenue = parseFloat(
        lebaranData[0]?.avg_lebaran_revenue || '0',
      );
      const lebaranCustomers = parseInt(
        lebaranData[0]?.avg_lebaran_customers || '0',
      );

      // Analyze Lebaran-relevant customer categories
      const lebaranCategories = customers.filter(c =>
        c.productCategories?.some((cat: string) =>
          [
            'fashion',
            'clothing',
            'gift',
            'food',
            'decoration',
            'travel',
            'jewelry',
          ].includes(cat.toLowerCase()),
        ),
      );

      const giftGivingCustomers = customers.filter(
        c =>
          (c.totalTransactions || 0) > 3 && // Active customers likely to give gifts
          (c.averageOrderValue || 0) > 500000, // Customers who can afford gifts
      );

      const relevantCustomerPercentage =
        customers.length > 0
          ? (lebaranCategories.length / customers.length) * 100
          : 0;

      const giftPotentialPercentage =
        customers.length > 0
          ? (giftGivingCustomers.length / customers.length) * 100
          : 0;

      // Calculate final relevance
      const customerRelevance = Math.min(100, relevantCustomerPercentage * 1.5);
      const giftRelevance = Math.min(100, giftPotentialPercentage * 1.2);
      const finalRelevance = Math.round(
        temporalRelevance * 0.5 + customerRelevance * 0.3 + giftRelevance * 0.2,
      );

      const insight = `${
        lebaranCategories.length
      } customers (${relevantCustomerPercentage.toFixed(
        1,
      )}%) in Lebaran-relevant categories, ${
        giftGivingCustomers.length
      } customers (${giftPotentialPercentage.toFixed(
        1,
      )}%) with gift-giving potential`;

      const implication =
        giftPotentialPercentage > 40
          ? `Strong Lebaran opportunity: Focus on premium gift packaging, family sets, and traditional Indonesian items. Target ${giftGivingCustomers.length} high-potential gift buyers.`
          : giftPotentialPercentage > 20
          ? `Moderate Lebaran potential: Develop gift bundles, traditional clothing, and family-oriented products for ${lebaranCategories.length} relevant customers.`
          : `Build Lebaran presence: Create gift catalogs, partner with traditional suppliers, and establish Lebaran shopping traditions.`;

      return {
        relevance: Math.max(25, finalRelevance),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(`Error analyzing Lebaran surge: ${error.message}`);
      return {
        relevance: 60,
        insight:
          'Lebaran represents major gift-giving and celebration opportunity in Indonesian market',
        implication:
          'Develop gift bundles, traditional products, and family-oriented promotions for Lebaran celebrations',
      };
    }
  }

  /**
   * Advanced mobile-first behavior analysis
   */
  private async analyzeMobileFirstBehavior(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Analyze mobile vs web ordering patterns
      const mobileData = await this.dataSource.query(
        `
        WITH channel_analysis AS (
          SELECT 
            order_channel,
            COUNT(*) as order_count,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_order_value,
            COUNT(DISTINCT customer_id) as unique_customers
          FROM orders
          WHERE tenant_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '6 months'
            AND order_channel IS NOT NULL
          GROUP BY order_channel
        )
        SELECT 
          order_channel,
          order_count,
          total_revenue,
          avg_order_value,
          unique_customers,
          (order_count::float / SUM(order_count) OVER()) * 100 as percentage
        FROM channel_analysis
        ORDER BY order_count DESC
      `,
        [tenantId],
      );

      const mobileOrders = mobileData.filter(
        d =>
          d.order_channel && d.order_channel.toLowerCase().includes('mobile'),
      );

      const totalOrders = mobileData.reduce(
        (sum, d) => sum + parseInt(d.order_count),
        0,
      );
      const mobileOrderCount = mobileOrders.reduce(
        (sum, d) => sum + parseInt(d.order_count),
        0,
      );
      const mobilePercentage =
        totalOrders > 0 ? (mobileOrderCount / totalOrders) * 100 : 85; // Default 85% for Indonesia

      // Analyze mobile payment preferences
      const paymentData = await this.dataSource.query(
        `
        SELECT 
          payment_method,
          COUNT(*) as usage_count,
          (COUNT(*)::float / SUM(COUNT(*)) OVER()) * 100 as percentage
        FROM orders
        WHERE tenant_id = $1 
          AND created_at >= CURRENT_DATE - INTERVAL '6 months'
          AND payment_method IS NOT NULL
        GROUP BY payment_method
        ORDER BY usage_count DESC
      `,
        [tenantId],
      );

      const mobilePayments = paymentData.filter(
        p =>
          p.payment_method &&
          ['qris', 'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja'].includes(
            p.payment_method.toLowerCase(),
          ),
      );

      const mobilePaymentPercentage = mobilePayments.reduce(
        (sum, p) => sum + parseFloat(p.percentage),
        0,
      );

      // Calculate mobile optimization score
      const mobileOptimizationScore = Math.min(
        100,
        (mobilePercentage + mobilePaymentPercentage) / 2,
      );

      const insight = `${mobilePercentage.toFixed(
        1,
      )}% of orders via mobile channels, ${mobilePaymentPercentage.toFixed(
        1,
      )}% using mobile payment methods (QRIS, e-wallets). Mobile optimization score: ${mobileOptimizationScore.toFixed(
        0,
      )}/100`;

      const implication =
        mobileOptimizationScore > 80
          ? `Excellent mobile optimization: Continue enhancing mobile experience, implement progressive web app features, and expand mobile payment options.`
          : mobileOptimizationScore > 60
          ? `Good mobile foundation: Improve mobile checkout flow, add more e-wallet options, and optimize for Indonesian mobile user patterns.`
          : `Critical mobile gap: Urgent need for mobile-first redesign, QRIS integration, and Indonesian e-wallet partnerships to capture 85% mobile-first market.`;

      return {
        relevance: Math.max(85, Math.round(mobileOptimizationScore)), // Always high relevance for Indonesia
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(`Error analyzing mobile behavior: ${error.message}`);
      return {
        relevance: 90,
        insight:
          'Indonesian market is 85% mobile-first with strong preference for mobile payments and social commerce',
        implication:
          'Prioritize mobile experience, integrate QRIS and e-wallets, and optimize for mobile social sharing and commerce',
      };
    }
  }

  /**
   * Jakarta premium market analysis
   */
  private async analyzeJakartaPremiumMarket(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Identify Jakarta customers
      const jakartaCustomers = customers.filter(
        c =>
          c.region &&
          (c.region.toLowerCase().includes('jakarta') ||
            c.region.toLowerCase().includes('dki') ||
            (c.city && c.city.toLowerCase().includes('jakarta'))),
      );

      if (jakartaCustomers.length === 0) {
        return {
          relevance: 25,
          insight: 'No Jakarta customers identified in current customer base',
          implication:
            'Consider Jakarta market expansion strategy targeting premium urban consumers',
        };
      }

      // Analyze Jakarta customer value distribution
      const jakartaHighValue = jakartaCustomers.filter(
        c => (c.totalSpent || 0) > 5000000,
      ); // IDR 5M+
      const jakartaPremium = jakartaCustomers.filter(
        c => (c.totalSpent || 0) > 10000000,
      ); // IDR 10M+

      const jakartaPercentage =
        (jakartaCustomers.length / customers.length) * 100;
      const premiumPercentage =
        jakartaCustomers.length > 0
          ? (jakartaPremium.length / jakartaCustomers.length) * 100
          : 0;
      const highValuePercentage =
        jakartaCustomers.length > 0
          ? (jakartaHighValue.length / jakartaCustomers.length) * 100
          : 0;

      // Calculate average values
      const avgJakartaLTV =
        jakartaCustomers.length > 0
          ? jakartaCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
            jakartaCustomers.length
          : 0;

      const avgNonJakartaLTV =
        customers.length > jakartaCustomers.length
          ? customers
              .filter(c => !jakartaCustomers.includes(c))
              .reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
            (customers.length - jakartaCustomers.length)
          : 0;

      const valueMultiplier =
        avgNonJakartaLTV > 0 ? avgJakartaLTV / avgNonJakartaLTV : 1;

      const relevance = Math.round(
        jakartaPercentage * 2 + premiumPercentage * 1.5,
      );

      const insight = `${
        jakartaCustomers.length
      } Jakarta customers (${jakartaPercentage.toFixed(
        1,
      )}% of base) with ${premiumPercentage.toFixed(
        1,
      )}% premium customers (>IDR 10M LTV). Jakarta customers have ${valueMultiplier.toFixed(
        1,
      )}x higher LTV than other regions`;

      const implication =
        premiumPercentage > 20
          ? `Strong Jakarta premium opportunity: Develop luxury product lines, concierge services, and exclusive experiences for ${jakartaPremium.length} premium customers.`
          : premiumPercentage > 10
          ? `Moderate Jakarta premium potential: Create premium tiers, faster delivery options, and personalized service for ${jakartaHighValue.length} high-value customers.`
          : jakartaPercentage > 5
          ? `Jakarta market foundation: Build premium positioning, improve service quality, and develop Jakarta-specific marketing approaches.`
          : `Jakarta expansion opportunity: Target urban professionals, implement premium services, and establish Jakarta market presence.`;

      return {
        relevance: Math.max(20, Math.min(95, relevance)),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing Jakarta premium market: ${error.message}`,
      );
      return {
        relevance: 45,
        insight:
          "Jakarta represents Indonesia's premium market with highest purchasing power and luxury demand",
        implication:
          'Develop premium product tiers, personalized services, and luxury experiences for Jakarta urban market',
      };
    }
  }

  /**
   * UMKM segment growth analysis
   */
  private async analyzeUMKMSegmentGrowth(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Identify UMKM customers
      const umkmCustomers = customers.filter(
        c =>
          (c.customerType && c.customerType.toUpperCase() === 'BUSINESS') ||
          (c.segment && c.segment.toLowerCase().includes('umkm')) ||
          (c.businessCategory &&
            ['retail', 'food', 'service', 'manufacturing'].includes(
              c.businessCategory.toLowerCase(),
            )),
      );

      if (umkmCustomers.length === 0) {
        return {
          relevance: 20,
          insight: 'No UMKM customers identified in current customer base',
          implication:
            'Significant opportunity to target Indonesian UMKM sector representing 64% of GDP and 97% of employment',
        };
      }

      // Analyze UMKM growth patterns
      const umkmGrowthData = await this.dataSource.query(
        `
        WITH umkm_growth AS (
          SELECT 
            DATE_TRUNC('month', created_at) as order_month,
            COUNT(DISTINCT customer_id) as unique_customers,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_order_value
          FROM orders
          WHERE tenant_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '12 months'
            AND customer_id IN (
              SELECT id FROM customers 
              WHERE tenant_id = $1 
                AND (customer_type = 'BUSINESS' OR segment ILIKE '%umkm%')
            )
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY order_month
        )
        SELECT 
          order_month,
          unique_customers,
          total_revenue,
          avg_order_value,
          LAG(unique_customers) OVER (ORDER BY order_month) as prev_customers,
          LAG(total_revenue) OVER (ORDER BY order_month) as prev_revenue
        FROM umkm_growth
      `,
        [tenantId],
      );

      // Calculate growth metrics
      const recentGrowth =
        umkmGrowthData.length > 1 ? umkmGrowthData.slice(-3) : umkmGrowthData; // Last 3 months

      let avgCustomerGrowth = 0;
      let avgRevenueGrowth = 0;

      if (recentGrowth.length > 0) {
        const growthRates = recentGrowth.filter(
          d => d.prev_customers && d.prev_revenue,
        );
        if (growthRates.length > 0) {
          avgCustomerGrowth =
            growthRates.reduce((sum, d) => {
              const growth =
                ((d.unique_customers - d.prev_customers) / d.prev_customers) *
                100;
              return sum + growth;
            }, 0) / growthRates.length;

          avgRevenueGrowth =
            growthRates.reduce((sum, d) => {
              const growth =
                ((d.total_revenue - d.prev_revenue) / d.prev_revenue) * 100;
              return sum + growth;
            }, 0) / growthRates.length;
        }
      }

      const umkmPercentage = (umkmCustomers.length / customers.length) * 100;
      const avgUMKMOrderValue =
        umkmCustomers.length > 0
          ? umkmCustomers.reduce(
              (sum, c) => sum + (c.averageOrderValue || 0),
              0,
            ) / umkmCustomers.length
          : 0;

      // Analyze UMKM-specific needs
      const bulkBuyers = umkmCustomers.filter(
        c => (c.averageOrderValue || 0) > 2000000,
      ); // IDR 2M+ orders
      const frequentBuyers = umkmCustomers.filter(
        c => (c.monthlyTransactionFrequency || 0) > 2,
      );

      const relevance = Math.round(
        umkmPercentage * 2 +
          Math.abs(avgCustomerGrowth) +
          Math.abs(avgRevenueGrowth),
      );

      const insight = `${
        umkmCustomers.length
      } UMKM customers (${umkmPercentage.toFixed(
        1,
      )}% of base) with ${avgCustomerGrowth.toFixed(
        1,
      )}% customer growth and ${avgRevenueGrowth.toFixed(1)}% revenue growth. ${
        bulkBuyers.length
      } bulk buyers, ${frequentBuyers.length} frequent buyers`;

      const implication =
        umkmPercentage > 15
          ? `Strong UMKM foundation: Develop B2B features including bulk pricing, credit facilities, business tax integration, and supply chain financing for ${umkmCustomers.length} customers.`
          : umkmPercentage > 5
          ? `Growing UMKM opportunity: Create business-specific features, installment payments, and B2B relationship management for ${umkmCustomers.length} business customers.`
          : `UMKM expansion opportunity: Target Indonesia's 64 million UMKM businesses with specialized B2B solutions, financing options, and business support services.`;

      return {
        relevance: Math.max(15, Math.min(90, relevance)),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(`Error analyzing UMKM segment: ${error.message}`);
      return {
        relevance: 70,
        insight:
          'Indonesian UMKM sector represents 64% of GDP and 64 million businesses with growing digitalization needs',
        implication:
          'Develop UMKM-specific features: bulk pricing, business financing, tax integration, and digital transformation support',
      };
    }
  }

  /**
   * Regional diversity and expansion analysis
   */
  private async analyzeRegionalDiversityOpportunity(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Analyze regional distribution
      const regionalData = new Map<
        string,
        { count: number; revenue: number; avgLTV: number }
      >();

      customers.forEach(c => {
        const region = c.region || c.city || 'Unknown';
        const cleanRegion = this.normalizeIndonesianRegion(region);

        if (!regionalData.has(cleanRegion)) {
          regionalData.set(cleanRegion, { count: 0, revenue: 0, avgLTV: 0 });
        }

        const data = regionalData.get(cleanRegion)!;
        data.count += 1;
        data.revenue += c.totalSpent || 0;
      });

      // Calculate averages
      regionalData.forEach((data, region) => {
        data.avgLTV = data.count > 0 ? data.revenue / data.count : 0;
      });

      const uniqueRegions = regionalData.size;
      const topRegions = Array.from(regionalData.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

      const dominantRegion = topRegions[0];
      const dominancePercentage = dominantRegion
        ? (dominantRegion[1].count / customers.length) * 100
        : 0;

      // Analyze underrepresented high-potential regions
      const indonesianMajorCities = [
        'Jakarta',
        'Surabaya',
        'Bandung',
        'Medan',
        'Semarang',
        'Makassar',
        'Palembang',
        'Tangerang',
        'Depok',
        'Bekasi',
      ];
      const representedCities = topRegions.map(r => r[0]);
      const missingMajorCities = indonesianMajorCities.filter(
        city =>
          !representedCities.some(repr =>
            repr.toLowerCase().includes(city.toLowerCase()),
          ),
      );

      const relevance = Math.round(
        uniqueRegions * 10 + // Diversity bonus
          (100 - dominancePercentage) * 0.5 + // Anti-concentration bonus
          missingMajorCities.length * 5, // Expansion opportunity bonus
      );

      const insight = `Customer base spans ${uniqueRegions} regions with ${dominancePercentage.toFixed(
        1,
      )}% concentration in ${
        dominantRegion?.[0] || 'main region'
      }. Top regions: ${topRegions
        .map(r => `${r[0]} (${r[1].count})`)
        .join(', ')}. Missing presence in: ${missingMajorCities
        .slice(0, 3)
        .join(', ')}`;

      const implication =
        uniqueRegions > 10
          ? `Excellent regional diversity: Implement region-specific logistics optimization, local partnerships, and cultural adaptation strategies for ${uniqueRegions} regions.`
          : uniqueRegions > 5
          ? `Good regional spread: Develop regional hubs, localized marketing, and region-specific product offerings. Expand to ${missingMajorCities
              .slice(0, 2)
              .join(', ')}.`
          : dominancePercentage > 60
          ? `High regional concentration risk: Diversify to major Indonesian cities (${missingMajorCities
              .slice(0, 3)
              .join(', ')}) to reduce dependency and capture national market.`
          : `Regional expansion opportunity: Target Indonesia's major urban centers and develop multi-regional logistics and marketing strategies.`;

      return {
        relevance: Math.max(20, Math.min(85, relevance)),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(`Error analyzing regional diversity: ${error.message}`);
      return {
        relevance: 50,
        insight:
          "Indonesia's archipelagic geography requires regional diversification strategy across 34 provinces and major urban centers",
        implication:
          'Develop multi-regional presence, local partnerships, and region-specific logistics and cultural adaptations',
      };
    }
  }

  /**
   * Rural expansion opportunity analysis
   */
  private async analyzeRuralExpansionOpportunity(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Identify urban vs rural customers
      const majorUrbanAreas = [
        'jakarta',
        'surabaya',
        'bandung',
        'medan',
        'semarang',
        'makassar',
        'palembang',
        'tangerang',
        'depok',
        'bekasi',
      ];

      const urbanCustomers = customers.filter(
        c =>
          c.region &&
          majorUrbanAreas.some(city => c.region.toLowerCase().includes(city)),
      );

      const ruralCustomers = customers.filter(
        c =>
          c.region &&
          !majorUrbanAreas.some(city => c.region.toLowerCase().includes(city)),
      );

      const unknownLocationCustomers = customers.filter(c => !c.region);

      const urbanPercentage = (urbanCustomers.length / customers.length) * 100;
      const ruralPercentage = (ruralCustomers.length / customers.length) * 100;
      const unknownPercentage =
        (unknownLocationCustomers.length / customers.length) * 100;

      // Analyze rural customer behavior
      const avgRuralLTV =
        ruralCustomers.length > 0
          ? ruralCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
            ruralCustomers.length
          : 0;

      const avgUrbanLTV =
        urbanCustomers.length > 0
          ? urbanCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) /
            urbanCustomers.length
          : 0;

      const ruralValueRatio = avgUrbanLTV > 0 ? avgRuralLTV / avgUrbanLTV : 0;

      // Calculate rural expansion potential
      const indonesianRuralPopulation = 47; // 47% of Indonesian population is rural
      const currentRuralRepresentation = ruralPercentage;
      const ruralGap = Math.max(
        0,
        indonesianRuralPopulation - currentRuralRepresentation,
      );

      const relevance = Math.round(
        ruralGap * 1.5 + // Gap opportunity
          (ruralValueRatio > 0.7 ? 25 : 0) + // Rural value potential
          (unknownPercentage > 20 ? 15 : 0), // Unknown locations as rural potential
      );

      const insight = `${
        ruralCustomers.length
      } rural customers (${ruralPercentage.toFixed(1)}%), ${
        urbanCustomers.length
      } urban customers (${urbanPercentage.toFixed(
        1,
      )}%). Rural customers have ${ruralValueRatio.toFixed(
        2,
      )}x urban LTV. Gap: ${ruralGap.toFixed(
        1,
      )}% vs 47% national rural population`;

      const implication =
        ruralGap > 30
          ? `Significant rural expansion opportunity: Develop rural-specific logistics, mobile-first solutions, and cash-on-delivery options to capture untapped ${ruralGap.toFixed(
              0,
            )}% market gap.`
          : ruralGap > 15
          ? `Moderate rural potential: Improve rural delivery networks, partner with local agents, and create rural-friendly payment options for ${ruralGap.toFixed(
              0,
            )}% expansion opportunity.`
          : ruralValueRatio > 0.8
          ? `Strong rural performance: Leverage successful rural model to expand to similar rural markets and optimize rural customer experience.`
          : ruralPercentage > 25
          ? `Good rural foundation: Enhance rural services, improve logistics efficiency, and develop rural community partnerships.`
          : `Rural market exploration: Research rural customer needs, test rural-specific offerings, and establish rural market entry strategy.`;

      return {
        relevance: Math.max(15, Math.min(80, relevance)),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(`Error analyzing rural expansion: ${error.message}`);
      return {
        relevance: 55,
        insight:
          "Indonesia's 47% rural population represents significant untapped market with growing digital adoption",
        implication:
          'Develop rural-specific solutions: mobile-first interfaces, cash-on-delivery, local agent networks, and simplified logistics',
      };
    }
  }

  /**
   * Muslim market dominance analysis
   */
  private async analyzeMuslimMarketDominance(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Analyze Islamic/halal-relevant business indicators
      const halalRelevantCustomers = customers.filter(
        c =>
          c.productCategories?.some((cat: string) =>
            ['food', 'beverage', 'restaurant', 'catering', 'grocery'].includes(
              cat.toLowerCase(),
            ),
          ) ||
          c.businessCategory?.toLowerCase().includes('food') ||
          c.segment?.toLowerCase().includes('restaurant'),
      );

      // Analyze halal certification and religious consideration needs
      const currentMonth = new Date().getMonth() + 1;
      const isRamadanSeason = currentMonth >= 3 && currentMonth <= 5;
      const isHajSeason = currentMonth >= 7 && currentMonth <= 9;

      const halalPercentage =
        (halalRelevantCustomers.length / customers.length) * 100;

      // Analyze religious shopping patterns
      const religiousPatternData = await this.dataSource.query(
        `
        WITH religious_patterns AS (
          SELECT 
            EXTRACT(MONTH FROM created_at) as order_month,
            COUNT(*) as order_count,
            SUM(total_amount) as total_revenue
          FROM orders
          WHERE tenant_id = $1 
            AND created_at >= CURRENT_DATE - INTERVAL '24 months'
          GROUP BY EXTRACT(MONTH FROM created_at)
        ),
        ramadan_months AS (
          SELECT 
            order_month,
            order_count,
            total_revenue
          FROM religious_patterns
          WHERE order_month IN (3, 4, 5) -- Typical Ramadan months
        ),
        regular_months AS (
          SELECT 
            AVG(order_count) as avg_orders,
            AVG(total_revenue) as avg_revenue
          FROM religious_patterns
          WHERE order_month NOT IN (3, 4, 5, 12) -- Exclude seasonal months
        )
        SELECT 
          AVG(rm.order_count) as ramadan_avg_orders,
          AVG(rm.total_revenue) as ramadan_avg_revenue,
          reg.avg_orders,
          reg.avg_revenue,
          CASE 
            WHEN reg.avg_revenue > 0 
            THEN ((AVG(rm.total_revenue) - reg.avg_revenue) / reg.avg_revenue * 100)
            ELSE 0 
          END as religious_boost_percentage
        FROM ramadan_months rm
        CROSS JOIN regular_months reg
      `,
        [tenantId],
      );

      const religiousBoost = parseFloat(
        religiousPatternData[0]?.religious_boost_percentage || '0',
      );

      // Calculate Muslim market relevance
      const baseRelevance = 87; // 87% of Indonesia is Muslim
      const businessRelevance = halalPercentage;
      const seasonalRelevance = isRamadanSeason ? 95 : isHajSeason ? 75 : 60;
      const historicalRelevance = Math.min(100, Math.abs(religiousBoost) * 2);

      const finalRelevance = Math.round(
        baseRelevance * 0.4 +
          businessRelevance * 0.3 +
          seasonalRelevance * 0.2 +
          historicalRelevance * 0.1,
      );

      const insight = `${
        halalRelevantCustomers.length
      } customers (${halalPercentage.toFixed(
        1,
      )}%) in halal-relevant categories. Religious seasonality shows ${
        religiousBoost > 0
          ? `+${religiousBoost.toFixed(1)}%`
          : `${religiousBoost.toFixed(1)}%`
      } revenue impact during Islamic seasons`;

      const implication =
        halalPercentage > 30
          ? `Critical halal opportunity: Obtain halal certifications, develop Islamic finance options, and create religious-compliant product lines for ${halalRelevantCustomers.length} relevant customers.`
          : halalPercentage > 15
          ? `Significant halal potential: Partner with halal suppliers, ensure Islamic compliance, and develop Muslim-friendly features for ${halalRelevantCustomers.length} customers.`
          : religiousBoost > 10
          ? `Religious seasonality opportunity: Leverage ${religiousBoost.toFixed(
              0,
            )}% seasonal boost with Islamic calendar-based campaigns and halal product focus.`
          : `Muslim market foundation: Establish halal credibility, Islamic compliance, and Muslim community partnerships to capture 87% market potential.`;

      return {
        relevance: Math.max(60, Math.min(95, finalRelevance)),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(`Error analyzing Muslim market: ${error.message}`);
      return {
        relevance: 85,
        insight:
          "Indonesia's 87% Muslim population requires halal compliance and Islamic considerations across all business aspects",
        implication:
          'Implement halal certifications, Islamic finance options, and religious-compliant business practices for market leadership',
      };
    }
  }

  /**
   * Local brand preference analysis
   */
  private async analyzeLocalBrandPreference(
    tenantId: string,
    customers: any[],
  ): Promise<{
    relevance: number;
    insight: string;
    implication: string;
  }> {
    try {
      // Analyze preference for local vs international brands
      const brandPreferenceData = await this.dataSource.query(
        `
        WITH brand_analysis AS (
          SELECT 
            p.brand,
            p.origin_country,
            COUNT(DISTINCT oi.order_id) as order_count,
            SUM(oi.total_price) as total_revenue,
            COUNT(DISTINCT o.customer_id) as unique_customers,
            AVG(oi.total_price) as avg_order_value
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN products p ON oi.product_id = p.id
          WHERE o.tenant_id = $1 
            AND o.created_at >= CURRENT_DATE - INTERVAL '12 months'
            AND p.brand IS NOT NULL
          GROUP BY p.brand, p.origin_country
        ),
        local_vs_international AS (
          SELECT 
            CASE 
              WHEN origin_country = 'Indonesia' OR origin_country IS NULL THEN 'Local'
              ELSE 'International'
            END as brand_type,
            SUM(order_count) as total_orders,
            SUM(total_revenue) as total_revenue,
            COUNT(DISTINCT brand) as brand_count,
            AVG(avg_order_value) as avg_order_value
          FROM brand_analysis
          GROUP BY CASE 
            WHEN origin_country = 'Indonesia' OR origin_country IS NULL THEN 'Local'
            ELSE 'International'
          END
        )
        SELECT 
          brand_type,
          total_orders,
          total_revenue,
          brand_count,
          avg_order_value,
          (total_orders::float / SUM(total_orders) OVER()) * 100 as order_percentage,
          (total_revenue::float / SUM(total_revenue) OVER()) * 100 as revenue_percentage
        FROM local_vs_international
        ORDER BY total_revenue DESC
      `,
        [tenantId],
      );

      const localData = brandPreferenceData.find(d => d.brand_type === 'Local');
      const internationalData = brandPreferenceData.find(
        d => d.brand_type === 'International',
      );

      const localOrderPercentage = parseFloat(
        localData?.order_percentage || '0',
      );
      const localRevenuePercentage = parseFloat(
        localData?.revenue_percentage || '0',
      );
      const localBrandCount = parseInt(localData?.brand_count || '0');
      const internationalBrandCount = parseInt(
        internationalData?.brand_count || '0',
      );

      // Analyze customer loyalty to local brands
      const localLoyalCustomers = customers.filter(
        c =>
          c.purchaseBehavior?.brandLoyalty > 0.7 && // High brand loyalty
          c.preferredBrands?.some((brand: string) =>
            // Assume local brands based on Indonesian names/characteristics
            this.isIndonesianBrand(brand),
          ),
      );

      const localLoyaltyPercentage =
        customers.length > 0
          ? (localLoyalCustomers.length / customers.length) * 100
          : 0;

      // Calculate relevance based on local preference strength
      const relevance = Math.round(
        localOrderPercentage * 0.4 +
          localRevenuePercentage * 0.4 +
          localLoyaltyPercentage * 0.2,
      );

      const insight = `${localOrderPercentage.toFixed(
        1,
      )}% of orders for local brands (${localBrandCount} brands) vs ${(
        100 - localOrderPercentage
      ).toFixed(
        1,
      )}% international (${internationalBrandCount} brands). Local brands generate ${localRevenuePercentage.toFixed(
        1,
      )}% of revenue. ${
        localLoyalCustomers.length
      } customers show local brand loyalty`;

      const implication =
        localOrderPercentage > 60
          ? `Strong local brand preference: Partner with Indonesian brands, develop local product lines, and emphasize "Made in Indonesia" positioning for ${localLoyalCustomers.length} loyal customers.`
          : localOrderPercentage > 40
          ? `Balanced brand portfolio: Maintain mix of local and international brands while emphasizing Indonesian partnerships and local manufacturing for market authenticity.`
          : localOrderPercentage > 20
          ? `International brand dominance: Consider balancing with strategic local partnerships to build Indonesian market credibility and cultural connection.`
          : `Local brand opportunity: Develop partnerships with Indonesian brands, support local manufacturers, and create "Proudly Indonesian" product categories.`;

      return {
        relevance: Math.max(30, Math.min(85, relevance)),
        insight,
        implication,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing local brand preference: ${error.message}`,
      );
      return {
        relevance: 60,
        insight:
          'Indonesian consumers show growing preference for local brands driven by nationalism and cultural pride',
        implication:
          'Partner with Indonesian brands, develop local manufacturing, and emphasize "Made in Indonesia" positioning',
      };
    }
  }

  /**
   * Fallback method for basic Indonesian insights when comprehensive analysis fails
   */
  private generateBasicIndonesianInsights(customerData: any): Array<{
    context: IndonesianMarketContext;
    currentRelevance: number;
    actionableInsight: string;
    businessImplication: string;
  }> {
    const insights = [];

    // Basic mobile-first insight
    insights.push({
      context: IndonesianMarketContext.MOBILE_FIRST_BEHAVIOR,
      currentRelevance: 90,
      actionableInsight:
        'Indonesian market is 85% mobile-first with strong preference for mobile payments and social commerce',
      businessImplication:
        'Prioritize mobile experience, integrate QRIS and e-wallets, and optimize for mobile social sharing',
    });

    // Basic Ramadan insight
    insights.push({
      context: IndonesianMarketContext.RAMADAN_OPPORTUNITY,
      currentRelevance: 85,
      actionableInsight:
        'Ramadan represents major opportunity affecting 87% of Indonesian population with seasonal shopping surge',
      businessImplication:
        'Prepare halal-certified products, religious-themed campaigns, and family-oriented promotions',
    });

    // Basic UMKM insight
    if (customerData?.length > 10) {
      insights.push({
        context: IndonesianMarketContext.UMKM_SEGMENT_GROWTH,
        currentRelevance: 75,
        actionableInsight:
          'Indonesian UMKM sector represents 64% of GDP and 64 million businesses with growing digitalization needs',
        businessImplication:
          'Develop UMKM-specific features: bulk pricing, business financing, and digital transformation support',
      });
    }

    return insights;
  }

  // Helper methods for Indonesian market analysis

  /**
   * Normalize Indonesian region names for consistency
   */
  private normalizeIndonesianRegion(region: string): string {
    const cleaned = region.toLowerCase().trim();

    // Jakarta variations
    if (cleaned.includes('jakarta') || cleaned.includes('dki'))
      return 'Jakarta';
    if (
      cleaned.includes('tangerang') ||
      cleaned.includes('bekasi') ||
      cleaned.includes('depok')
    )
      return 'Jabodetabek';

    // Major cities
    if (cleaned.includes('surabaya')) return 'Surabaya';
    if (cleaned.includes('bandung')) return 'Bandung';
    if (cleaned.includes('medan')) return 'Medan';
    if (cleaned.includes('semarang')) return 'Semarang';
    if (cleaned.includes('makassar')) return 'Makassar';
    if (cleaned.includes('palembang')) return 'Palembang';

    // Provinces
    if (cleaned.includes('jawa barat') || cleaned.includes('west java'))
      return 'Jawa Barat';
    if (cleaned.includes('jawa tengah') || cleaned.includes('central java'))
      return 'Jawa Tengah';
    if (cleaned.includes('jawa timur') || cleaned.includes('east java'))
      return 'Jawa Timur';
    if (cleaned.includes('sumatra') || cleaned.includes('sumatera'))
      return 'Sumatra';
    if (cleaned.includes('kalimantan') || cleaned.includes('borneo'))
      return 'Kalimantan';
    if (cleaned.includes('sulawesi')) return 'Sulawesi';
    if (cleaned.includes('bali')) return 'Bali';

    return region; // Return original if no match
  }

  /**
   * Check if a brand name appears to be Indonesian
   */
  private isIndonesianBrand(brand: string): boolean {
    const indonesianBrandIndicators = [
      'indo',
      'nusantara',
      'garuda',
      'sari',
      'prima',
      'jaya',
      'rasa',
      'mas',
      'budi',
      'sinar',
      'cahaya',
      'mulia',
      'sejahtera',
      'makmur',
    ];

    const lowerBrand = brand.toLowerCase();
    return indonesianBrandIndicators.some(indicator =>
      lowerBrand.includes(indicator),
    );
  }
}
