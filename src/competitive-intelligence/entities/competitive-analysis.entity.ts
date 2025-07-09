import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { CompetitiveProduct } from './competitive-product.entity';

export enum AnalysisType {
  PRICE_ANALYSIS = 'price_analysis',
  MARKET_SHARE_ANALYSIS = 'market_share_analysis',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  TREND_ANALYSIS = 'trend_analysis',
  COMPETITOR_POSITIONING = 'competitor_positioning',
  PROMOTIONAL_ANALYSIS = 'promotional_analysis',
  SEASONAL_ANALYSIS = 'seasonal_analysis',
  PRODUCT_FEATURE_COMPARISON = 'product_feature_comparison',
  BRAND_SENTIMENT_ANALYSIS = 'brand_sentiment_analysis',
  SUPPLY_CHAIN_ANALYSIS = 'supply_chain_analysis',
}

export enum AnalysisStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum CompetitiveAdvantage {
  PRICE_ADVANTAGE = 'price_advantage',
  QUALITY_ADVANTAGE = 'quality_advantage',
  BRAND_ADVANTAGE = 'brand_advantage',
  AVAILABILITY_ADVANTAGE = 'availability_advantage',
  SERVICE_ADVANTAGE = 'service_advantage',
  FEATURE_ADVANTAGE = 'feature_advantage',
  SHIPPING_ADVANTAGE = 'shipping_advantage',
  RATING_ADVANTAGE = 'rating_advantage',
  NO_CLEAR_ADVANTAGE = 'no_clear_advantage',
  MULTIPLE_ADVANTAGES = 'multiple_advantages',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('competitive_analyses')
@Index(['tenantId', 'competitiveProductId', 'analysisType'])
@Index(['tenantId', 'analysisStatus'])
@Index(['tenantId', 'overallThreatLevel'])
@Index(['analysisDate'])
@Index(['nextAnalysisDate'])
@Index(['competitiveAdvantage'])
export class CompetitiveAnalysis {
  @ApiProperty({ description: 'Unique identifier for competitive analysis' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy' })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  @ApiProperty({
    description: 'Reference to competitive product being analyzed',
  })
  @Column({ type: 'uuid' })
  competitiveProductId: string;

  // Analysis Configuration
  @ApiProperty({
    enum: AnalysisType,
    description: 'Type of competitive analysis',
  })
  @Column({
    type: 'enum',
    enum: AnalysisType,
  })
  analysisType: AnalysisType;

  @ApiProperty({
    enum: AnalysisStatus,
    description: 'Current status of analysis',
  })
  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    default: AnalysisStatus.PENDING,
  })
  analysisStatus: AnalysisStatus;

  @ApiProperty({ description: 'When this analysis was performed' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  analysisDate: Date;

  @ApiProperty({ description: 'Date range start for analysis data' })
  @Column({ type: 'timestamp', nullable: true })
  dataStartDate?: Date;

  @ApiProperty({ description: 'Date range end for analysis data' })
  @Column({ type: 'timestamp', nullable: true })
  dataEndDate?: Date;

  @ApiProperty({ description: 'When next analysis should be performed' })
  @Column({ type: 'timestamp', nullable: true })
  nextAnalysisDate?: Date;

  // Competitive Positioning
  @ApiProperty({
    enum: CompetitiveAdvantage,
    description: 'Primary competitive advantage identified',
  })
  @Column({
    type: 'enum',
    enum: CompetitiveAdvantage,
    nullable: true,
  })
  competitiveAdvantage?: CompetitiveAdvantage;

  @ApiProperty({ description: 'Overall threat level score (0-100)' })
  @Column({ type: 'integer', nullable: true })
  overallThreatLevel?: number;

  @ApiProperty({ enum: RiskLevel, description: 'Risk level category' })
  @Column({
    type: 'enum',
    enum: RiskLevel,
    nullable: true,
  })
  riskLevel?: RiskLevel;

  @ApiProperty({ description: 'Market position ranking among competitors' })
  @Column({ type: 'integer', nullable: true })
  marketRanking?: number;

  @ApiProperty({ description: 'Estimated market share percentage' })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  marketShare?: number;

  // Price Analysis
  @ApiProperty({ description: 'Price competitiveness analysis' })
  @Column({ type: 'json', nullable: true })
  priceAnalysis?: {
    ourPrice?: number;
    competitorPrice: number;
    priceDifference: number;
    priceDifferencePercent: number;
    pricePosition: 'cheapest' | 'competitive' | 'premium' | 'expensive';
    priceRecommendation: string;
    priceElasticity?: number;
    priceOptimal?: number;
    competitorPriceHistory: {
      trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
      volatility: number;
      averageChange: number;
      frequency: number;
    };
  };

  // Performance Analysis
  @ApiProperty({ description: 'Performance metrics comparison' })
  @Column({ type: 'json', nullable: true })
  performanceAnalysis?: {
    sales: {
      competitorSales: number;
      ourSales?: number;
      salesGap: number;
      salesTrend: 'increasing' | 'decreasing' | 'stable';
    };
    rating: {
      competitorRating: number;
      ourRating?: number;
      ratingGap: number;
      reviewQuality: 'high' | 'medium' | 'low';
    };
    engagement: {
      competitorViews: number;
      competitorLikes: number;
      ourViews?: number;
      ourLikes?: number;
      engagementRate: number;
    };
    availability: {
      stockLevel: 'high' | 'medium' | 'low' | 'out_of_stock';
      stockHistory: string;
      stockoutFrequency: number;
    };
  };

  // Market Analysis
  @ApiProperty({ description: 'Market and competitive landscape analysis' })
  @Column({ type: 'json', nullable: true })
  marketAnalysis?: {
    categoryTrends: {
      growth: number;
      seasonality: string;
      keyDrivers: string[];
    };
    competitorCount: number;
    marketConcentration: 'high' | 'medium' | 'low';
    entryBarriers: 'high' | 'medium' | 'low';
    customerSegments: Array<{
      segment: string;
      size: number;
      preference: string;
    }>;
    geographicDistribution: Record<string, number>;
  };

  // Feature Comparison
  @ApiProperty({ description: 'Product feature comparison analysis' })
  @Column({ type: 'json', nullable: true })
  featureAnalysis?: {
    competitorFeatures: Record<string, any>;
    ourFeatures?: Record<string, any>;
    featureGaps: string[];
    uniqueFeatures: string[];
    featureScore: number;
    customerPreferences: Record<string, number>;
  };

  // Promotional Analysis
  @ApiProperty({ description: 'Promotional strategy analysis' })
  @Column({ type: 'json', nullable: true })
  promotionalAnalysis?: {
    currentPromotions: Array<{
      type: string;
      discount: number;
      duration: string;
      conditions: string;
    }>;
    promotionalFrequency: number;
    promotionalEffectiveness: number;
    seasonalPatterns: Record<string, any>;
    promotionalStrategy: string;
    recommendedResponse: string;
  };

  // Customer Sentiment
  @ApiProperty({ description: 'Customer sentiment and review analysis' })
  @Column({ type: 'json', nullable: true })
  sentimentAnalysis?: {
    overallSentiment: 'positive' | 'neutral' | 'negative';
    sentimentScore: number; // -1 to 1
    positiveKeywords: string[];
    negativeKeywords: string[];
    commonComplaints: string[];
    commonPraises: string[];
    customerSatisfaction: number; // 0-100
    brandPerception: string;
    recommendationRate: number;
  };

  // Supply Chain Analysis
  @ApiProperty({ description: 'Supply chain and logistics analysis' })
  @Column({ type: 'json', nullable: true })
  supplyChainAnalysis?: {
    shippingOptions: string[];
    shippingCost: number;
    deliveryTime: number;
    deliveryReliability: number; // 0-100
    geographicCoverage: string[];
    stockoutRisk: 'high' | 'medium' | 'low';
    supplierDiversity: number;
    logisticsAdvantage: boolean;
  };

  // Trend Analysis
  @ApiProperty({ description: 'Historical trend analysis' })
  @Column({ type: 'json', nullable: true })
  trendAnalysis?: {
    priceTrends: {
      shortTerm: 'up' | 'down' | 'stable';
      mediumTerm: 'up' | 'down' | 'stable';
      longTerm: 'up' | 'down' | 'stable';
      seasonalPatterns: Record<string, number>;
    };
    salesTrends: {
      velocity: 'accelerating' | 'decelerating' | 'stable';
      cyclical: boolean;
      growth: number;
    };
    marketTrends: {
      categoryGrowth: number;
      newEntrants: number;
      exitingPlayers: number;
      innovationRate: number;
    };
  };

  // Strategic Insights
  @ApiProperty({ description: 'Strategic insights and recommendations' })
  @Column({ type: 'json', nullable: true })
  strategicInsights?: {
    keyStrengths: string[];
    keyWeaknesses: string[];
    opportunities: string[];
    threats: string[];
    strategicRecommendations: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      timeline: string;
      expectedImpact: number;
      riskLevel: 'high' | 'medium' | 'low';
    }>;
    competitiveStrategy: string;
    defensiveActions: string[];
    offensiveActions: string[];
  };

  // Indonesian Market Context
  @ApiProperty({ description: 'Indonesian market specific analysis' })
  @Column({ type: 'json', nullable: true })
  indonesianMarketContext?: {
    regionalPerformance: Record<
      string,
      {
        marketShare: number;
        pricePosition: string;
        customerPreference: string;
      }
    >;
    culturalFactors: string[];
    regulatoryConsiderations: string[];
    localCompetitorAdvantages: string[];
    ramadanImpact?: {
      demandChange: number;
      priceStrategy: string;
      competitiveResponse: string;
    };
    ecommerceMaturity: 'high' | 'medium' | 'low';
    paymentPreferences: Record<string, number>;
    logisticsChallenges: string[];
  };

  // Data Quality and Confidence
  @ApiProperty({ description: 'Analysis confidence score (0-100)' })
  @Column({ type: 'integer', default: 80 })
  confidenceScore: number;

  @ApiProperty({ description: 'Data completeness percentage' })
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100.0 })
  dataCompleteness: number;

  @ApiProperty({ description: 'Data sources used for analysis' })
  @Column({ type: 'json', nullable: true })
  dataSources?: string[];

  @ApiProperty({ description: 'Analysis methodology used' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  methodology?: string;

  @ApiProperty({ description: 'Limitations or caveats of this analysis' })
  @Column({ type: 'json', nullable: true })
  limitations?: string[];

  // Processing Information
  @ApiProperty({ description: 'Time taken to complete analysis (seconds)' })
  @Column({ type: 'integer', nullable: true })
  processingTime?: number;

  @ApiProperty({ description: 'Analysis algorithm version' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  algorithmVersion?: string;

  @ApiProperty({ description: 'Any errors encountered during analysis' })
  @Column({ type: 'json', nullable: true })
  analysisErrors?: string[];

  @ApiProperty({ description: 'Analysis warnings or notes' })
  @Column({ type: 'json', nullable: true })
  analysisWarnings?: string[];

  // Action Items
  @ApiProperty({
    description: 'Immediate action items generated from analysis',
  })
  @Column({ type: 'json', nullable: true })
  actionItems?: Array<{
    action: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    timeline: string;
    owner: string;
    status: 'pending' | 'in_progress' | 'completed';
    expectedOutcome: string;
  }>;

  @ApiProperty({ description: 'Key performance indicators to monitor' })
  @Column({ type: 'json', nullable: true })
  kpisToMonitor?: Array<{
    metric: string;
    currentValue: number;
    targetValue: number;
    threshold: number;
    alertCondition: string;
  }>;

  // Automation
  @ApiProperty({ description: 'Whether this analysis was automated' })
  @Column({ type: 'boolean', default: true })
  isAutomated: boolean;

  @ApiProperty({ description: 'Automated analysis schedule' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  analysisSchedule?: string;

  @ApiProperty({ description: 'Triggers that initiated this analysis' })
  @Column({ type: 'json', nullable: true })
  analysisTriggers?: string[];

  // Metadata
  @ApiProperty({ description: 'Additional metadata for this analysis' })
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Internal notes about this analysis' })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'Tags for categorizing this analysis' })
  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CompetitiveProduct, product => product.competitiveAnalyses)
  @JoinColumn({ name: 'competitiveProductId' })
  competitiveProduct: CompetitiveProduct;

  // Computed Properties
  get isHighRisk(): boolean {
    return this.overallThreatLevel >= 70;
  }

  get needsImmediateAction(): boolean {
    return (
      this.riskLevel === RiskLevel.CRITICAL ||
      (this.overallThreatLevel >= 80 &&
        this.competitiveAdvantage !== CompetitiveAdvantage.PRICE_ADVANTAGE)
    );
  }

  get analysisAge(): number {
    return Math.floor(
      (Date.now() - this.analysisDate.getTime()) / (1000 * 60 * 60 * 24),
    ); // days
  }

  get isStale(): boolean {
    return this.analysisAge > 7; // More than 7 days old
  }

  get hasCompetitiveAdvantage(): boolean {
    return (
      this.competitiveAdvantage !== CompetitiveAdvantage.NO_CLEAR_ADVANTAGE
    );
  }

  get priceCompetitiveness():
    | 'very_competitive'
    | 'competitive'
    | 'neutral'
    | 'expensive'
    | 'very_expensive' {
    if (!this.priceAnalysis) return 'neutral';

    const priceDiff = this.priceAnalysis.priceDifferencePercent;
    if (priceDiff <= -20) return 'very_competitive';
    if (priceDiff <= -5) return 'competitive';
    if (priceDiff >= 20) return 'very_expensive';
    if (priceDiff >= 5) return 'expensive';
    return 'neutral';
  }

  get overallPerformanceGap(): number {
    if (!this.performanceAnalysis) return 0;

    // Calculate weighted performance gap
    let totalGap = 0;
    let weights = 0;

    if (this.performanceAnalysis.sales) {
      totalGap += this.performanceAnalysis.sales.salesGap * 0.4;
      weights += 0.4;
    }

    if (this.performanceAnalysis.rating) {
      totalGap += this.performanceAnalysis.rating.ratingGap * 0.3;
      weights += 0.3;
    }

    if (this.performanceAnalysis.engagement) {
      totalGap += this.performanceAnalysis.engagement.engagementRate * 0.3;
      weights += 0.3;
    }

    return weights > 0 ? totalGap / weights : 0;
  }
}
