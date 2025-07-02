import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnalyticsMetaDto } from './analytics-response.dto';
import { PredictiveAnalysisType, RiskLevel, MovementCategory } from './predictive-analytics-query.dto';

export class StockoutRiskDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'SKU code' })
  sku: string;

  @ApiProperty({ description: 'Current stock level' })
  currentStock: number;

  @ApiProperty({ description: 'Predicted stockout date' })
  predictedStockoutDate: string;

  @ApiProperty({ description: 'Days until stockout' })
  daysUntilStockout: number;

  @ApiProperty({ description: 'Risk score (0-1)' })
  riskScore: number;

  @ApiProperty({ description: 'Risk level', enum: RiskLevel })
  riskLevel: RiskLevel;

  @ApiProperty({ description: 'Confidence in prediction (0-1)' })
  confidence: number;

  @ApiProperty({ description: 'Predicted daily demand' })
  predictedDailyDemand: number;

  @ApiProperty({ description: 'Current reorder point' })
  reorderPoint: number;

  @ApiProperty({ description: 'Recommended safety stock' })
  recommendedSafetyStock: number;

  @ApiPropertyOptional({ description: 'Lead time for restocking (days)' })
  leadTimeDays?: number;

  @ApiProperty({ description: 'Business impact assessment' })
  businessImpact: {
    potentialLostRevenue: number;
    customerSatisfactionImpact: number;
    urgencyScore: number;
  };

  @ApiProperty({ description: 'Actionable recommendations' })
  recommendations: string[];

  @ApiProperty({ description: 'Seasonal factors affecting prediction' })
  seasonalFactors: {
    isSeasonalPeak: boolean;
    seasonalMultiplier: number;
    peakPeriod?: string;
  };
}

export class SlowMovingItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'SKU code' })
  sku: string;

  @ApiProperty({ description: 'Current stock quantity' })
  currentStock: number;

  @ApiProperty({ description: 'Inventory value' })
  inventoryValue: number;

  @ApiProperty({ description: 'Days since last sale' })
  daysSinceLastSale: number;

  @ApiProperty({ description: 'Inventory turnover ratio' })
  turnoverRatio: number;

  @ApiProperty({ description: 'Movement category', enum: MovementCategory })
  movementCategory: MovementCategory;

  @ApiProperty({ description: 'Velocity score (sales per day)' })
  velocityScore: number;

  @ApiProperty({ description: 'Last 90 days sales' })
  last90DaysSales: number;

  @ApiProperty({ description: 'Average monthly sales' })
  averageMonthlySales: number;

  @ApiProperty({ description: 'Cost of holding this inventory' })
  holdingCost: number;

  @ApiProperty({ description: 'Opportunity cost' })
  opportunityCost: number;

  @ApiProperty({ description: 'Markdown recommendations' })
  markdownRecommendations: {
    suggestedDiscountPercent: number;
    estimatedClearanceTime: number;
    expectedRecoveredValue: number;
  };

  @ApiProperty({ description: 'Alternative actions' })
  alternativeActions: Array<{
    action: string;
    priority: number;
    expectedOutcome: string;
    timeframe: string;
  }>;

  @ApiProperty({ description: 'Risk factors for becoming dead stock' })
  deadStockRisk: {
    riskScore: number;
    riskFactors: string[];
    timeToDeadStock: number; // days
  };
}

export class OptimalReorderDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'SKU code' })
  sku: string;

  @ApiProperty({ description: 'Current stock level' })
  currentStock: number;

  @ApiProperty({ description: 'Optimal reorder quantity' })
  optimalQuantity: number;

  @ApiProperty({ description: 'Economic order quantity (EOQ)' })
  economicOrderQuantity: number;

  @ApiProperty({ description: 'Reorder point' })
  reorderPoint: number;

  @ApiProperty({ description: 'Safety stock level' })
  safetyStock: number;

  @ApiProperty({ description: 'Maximum stock level' })
  maximumStock: number;

  @ApiProperty({ description: 'Predicted demand for forecast period' })
  forecastDemand: number;

  @ApiProperty({ description: 'Confidence in recommendation (0-1)' })
  confidence: number;

  @ApiProperty({ description: 'Cost analysis' })
  costAnalysis: {
    orderingCost: number;
    holdingCostPerUnit: number;
    totalCost: number;
    costSavings: number;
  };

  @ApiProperty({ description: 'Service level achievement' })
  serviceLevel: {
    currentLevel: number;
    targetLevel: number;
    achievedLevel: number;
  };

  @ApiProperty({ description: 'Supplier information' })
  supplierInfo: {
    leadTime: number;
    minimumOrderQuantity: number;
    priceBreaks?: Array<{
      quantity: number;
      unitPrice: number;
    }>;
  };

  @ApiProperty({ description: 'Business justification' })
  businessJustification: {
    revenueImpact: number;
    cashFlowImpact: number;
    riskReduction: number;
    reasoning: string[];
  };

  @ApiProperty({ description: 'When to place the order' })
  orderTiming: {
    recommendedOrderDate: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    daysToReorder: number;
  };
}

export class PriceOptimizationDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'SKU code' })
  sku: string;

  @ApiProperty({ description: 'Current selling price' })
  currentPrice: number;

  @ApiProperty({ description: 'Current cost price' })
  costPrice: number;

  @ApiProperty({ description: 'Current profit margin %' })
  currentMargin: number;

  @ApiProperty({ description: 'Recommended new price' })
  recommendedPrice: number;

  @ApiProperty({ description: 'Recommended profit margin %' })
  recommendedMargin: number;

  @ApiProperty({ description: 'Price change percentage' })
  priceChangePercent: number;

  @ApiProperty({ description: 'Demand elasticity analysis' })
  demandElasticity: {
    elasticityCoefficient: number;
    isElastic: boolean;
    expectedVolumeChange: number;
  };

  @ApiProperty({ description: 'Revenue impact projection' })
  revenueImpact: {
    currentDailyRevenue: number;
    projectedDailyRevenue: number;
    revenueChange: number;
    paybackPeriod: number; // days
  };

  @ApiProperty({ description: 'Competitive analysis' })
  competitiveAnalysis: {
    marketPosition: 'below' | 'at' | 'above' | 'premium';
    competitorAveragePrice: number;
    priceGap: number;
    competitiveAdvantage: string;
  };

  @ApiProperty({ description: 'Optimization strategy' })
  strategy: {
    strategyType: 'penetration' | 'skimming' | 'competitive' | 'value_based';
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
    successProbability: number;
  };

  @ApiProperty({ description: 'Seasonal pricing recommendations' })
  seasonalPricing?: {
    peakSeasonAdjustment: number;
    lowSeasonAdjustment: number;
    holidayPricing: Array<{
      period: string;
      adjustment: number;
      reasoning: string;
    }>;
  };

  @ApiProperty({ description: 'Implementation timeline' })
  implementation: {
    recommendedStart: string;
    testPeriod: number; // days
    fullRollout: string;
    monitoringMetrics: string[];
  };

  @ApiProperty({ description: 'Risk mitigation' })
  riskMitigation: {
    identifiedRisks: string[];
    mitigationStrategies: string[];
    rollbackPlan: string;
  };
}

export class DemandAnomalyDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Anomaly date' })
  anomalyDate: string;

  @ApiProperty({ description: 'Anomaly type' })
  anomalyType: 'spike' | 'drop' | 'seasonal_deviation' | 'trend_break';

  @ApiProperty({ description: 'Expected demand' })
  expectedDemand: number;

  @ApiProperty({ description: 'Actual demand' })
  actualDemand: number;

  @ApiProperty({ description: 'Deviation percentage' })
  deviationPercent: number;

  @ApiProperty({ description: 'Severity score (0-1)' })
  severityScore: number;

  @ApiProperty({ description: 'Confidence in anomaly detection (0-1)' })
  confidence: number;

  @ApiProperty({ description: 'Possible causes' })
  possibleCauses: string[];

  @ApiProperty({ description: 'Business impact' })
  businessImpact: {
    revenueImpact: number;
    inventoryImpact: number;
    customerSatisfactionImpact: number;
  };

  @ApiProperty({ description: 'Recommended actions' })
  recommendedActions: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    timeline: string;
  }>;

  @ApiProperty({ description: 'Pattern context' })
  patternContext: {
    isRecurring: boolean;
    lastOccurrence?: string;
    frequency?: string;
    seasonalPattern?: boolean;
  };
}

export class SeasonalAnalysisDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Seasonality strength (0-1)' })
  seasonalityStrength: number;

  @ApiProperty({ description: 'Trend direction' })
  trendDirection: 'increasing' | 'decreasing' | 'stable';

  @ApiProperty({ description: 'Peak seasons' })
  peakSeasons: Array<{
    period: string;
    multiplier: number;
    confidence: number;
  }>;

  @ApiProperty({ description: 'Low seasons' })
  lowSeasons: Array<{
    period: string;
    multiplier: number;
    confidence: number;
  }>;

  @ApiProperty({ description: 'Weekly patterns' })
  weeklyPatterns: Array<{
    dayOfWeek: string;
    averageMultiplier: number;
    variance: number;
  }>;

  @ApiProperty({ description: 'Monthly patterns' })
  monthlyPatterns: Array<{
    month: string;
    averageMultiplier: number;
    variance: number;
  }>;

  @ApiProperty({ description: 'Holiday effects' })
  holidayEffects: Array<{
    holiday: string;
    effect: 'increase' | 'decrease' | 'neutral';
    multiplier: number;
    duration: number; // days
  }>;

  @ApiProperty({ description: 'Forecasting insights' })
  forecastingInsights: {
    bestModelType: string;
    modelAccuracy: number;
    forecastReliability: 'high' | 'medium' | 'low';
    recommendedForecastHorizon: number; // days
  };

  @ApiProperty({ description: 'Strategic recommendations' })
  strategicRecommendations: Array<{
    recommendation: string;
    category: 'inventory' | 'pricing' | 'marketing' | 'procurement';
    impact: 'high' | 'medium' | 'low';
    implementation: string;
  }>;
}

// Response DTOs for each analysis type
export class StockoutPredictionResponseDto {
  @ApiProperty({ description: 'Analysis results', type: [StockoutRiskDto] })
  data: StockoutRiskDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalProducts: number;
    highRiskProducts: number;
    criticalRiskProducts: number;
    averageRiskScore: number;
    averageDaysToStockout: number;
    totalPotentialLostRevenue: number;
    topRiskCategories: Array<{
      categoryId: string;
      categoryName: string;
      riskScore: number;
      productCount: number;
    }>;
  };

  @ApiProperty({ description: 'Trend analysis' })
  trends: Array<{
    period: string;
    averageRiskScore: number;
    riskTrend: 'increasing' | 'decreasing' | 'stable';
  }>;

  @ApiProperty({ description: 'Overall insights and recommendations' })
  insights: {
    keyFindings: string[];
    actionPriorities: string[];
    riskMitigationStrategies: string[];
    inventoryOptimizationTips: string[];
  };
}

export class SlowMovingDetectionResponseDto {
  @ApiProperty({ description: 'Analysis results', type: [SlowMovingItemDto] })
  data: SlowMovingItemDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalItems: number;
    slowMovingItems: number;
    deadStockItems: number;
    totalInventoryValue: number;
    slowMovingValue: number;
    averageTurnoverRatio: number;
    totalHoldingCost: number;
    potentialRecoveryValue: number;
  };

  @ApiProperty({ description: 'Category breakdown' })
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    slowMovingCount: number;
    slowMovingValue: number;
    averageTurnover: number;
  }>;

  @ApiProperty({ description: 'Strategic insights' })
  insights: {
    keyFindings: string[];
    liquidationStrategy: string[];
    preventionTips: string[];
    cashFlowOptimization: string[];
  };
}

export class OptimalReorderResponseDto {
  @ApiProperty({ description: 'Analysis results', type: [OptimalReorderDto] })
  data: OptimalReorderDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalProducts: number;
    totalReorderValue: number;
    averageServiceLevel: number;
    totalCostSavings: number;
    criticalReorders: number;
    cashFlowImpact: number;
  };

  @ApiProperty({ description: 'Portfolio insights' })
  insights: {
    inventoryOptimization: string[];
    cashFlowManagement: string[];
    supplierRelationships: string[];
    riskMitigation: string[];
  };
}

export class PriceOptimizationResponseDto {
  @ApiProperty({ description: 'Analysis results', type: [PriceOptimizationDto] })
  data: PriceOptimizationDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalProducts: number;
    averageMarginImprovement: number;
    totalRevenueImpact: number;
    highImpactProducts: number;
    riskLevel: 'low' | 'medium' | 'high';
  };

  @ApiProperty({ description: 'Strategic insights' })
  insights: {
    pricingStrategy: string[];
    competitivePosition: string[];
    marketOpportunities: string[];
    implementationGuide: string[];
  };
}

export class DemandAnomalyResponseDto {
  @ApiProperty({ description: 'Analysis results', type: [DemandAnomalyDto] })
  data: DemandAnomalyDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalAnomalies: number;
    spikes: number;
    drops: number;
    severityDistribution: Record<string, number>;
    averageDeviation: number;
  };

  @ApiProperty({ description: 'Pattern insights' })
  insights: {
    commonPatterns: string[];
    triggerFactors: string[];
    preventionStrategies: string[];
    monitoringRecommendations: string[];
  };
}

export class SeasonalAnalysisResponseDto {
  @ApiProperty({ description: 'Analysis results', type: [SeasonalAnalysisDto] })
  data: SeasonalAnalysisDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Summary statistics' })
  summary: {
    totalProducts: number;
    highSeasonalityProducts: number;
    averageSeasonalityStrength: number;
    mostCommonPeakSeason: string;
    mostCommonLowSeason: string;
  };

  @ApiProperty({ description: 'Strategic insights' })
  insights: {
    seasonalStrategy: string[];
    inventoryPlanning: string[];
    marketingOpportunities: string[];
    forecastingImprovements: string[];
  };
}

export class PredictiveAnalyticsResponseDto {
  @ApiProperty({ description: 'Analysis type performed', enum: PredictiveAnalysisType })
  analysisType: PredictiveAnalysisType;

  @ApiProperty({ description: 'Analysis results' })
  data: StockoutRiskDto[] | SlowMovingItemDto[] | OptimalReorderDto[] | PriceOptimizationDto[] | DemandAnomalyDto[] | SeasonalAnalysisDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Type-specific summary' })
  summary: any;

  @ApiProperty({ description: 'Type-specific insights' })
  insights: any;

  @ApiPropertyOptional({ description: 'Cross-analysis correlations' })
  correlations?: Array<{
    metric1: string;
    metric2: string;
    correlation: number;
    significance: 'low' | 'medium' | 'high';
  }>;

  @ApiPropertyOptional({ description: 'Next recommended analysis' })
  nextRecommendedAnalysis?: {
    analysisType: PredictiveAnalysisType;
    reasoning: string;
    priority: 'low' | 'medium' | 'high';
  };
}