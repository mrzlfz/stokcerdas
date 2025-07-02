import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PredictiveAnalysisType {
  STOCKOUT_PREDICTION = 'stockout_prediction',
  SLOW_MOVING_DETECTION = 'slow_moving_detection',
  OPTIMAL_REORDER = 'optimal_reorder',
  PRICE_OPTIMIZATION = 'price_optimization',
  DEMAND_ANOMALY = 'demand_anomaly',
  SEASONAL_ANALYSIS = 'seasonal_analysis',
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TimeHorizon {
  NEXT_7_DAYS = '7d',
  NEXT_14_DAYS = '14d',
  NEXT_30_DAYS = '30d',
  NEXT_60_DAYS = '60d',
  NEXT_90_DAYS = '90d',
}

export enum MovementCategory {
  FAST_MOVING = 'fast_moving',
  MEDIUM_MOVING = 'medium_moving',
  SLOW_MOVING = 'slow_moving',
  DEAD_STOCK = 'dead_stock',
}

export class BasePredictiveQueryDto {
  @ApiPropertyOptional({ description: 'Start date for analysis (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for analysis (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Specific product ID to analyze' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Category ID to filter products' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Location ID to filter by location' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Include confidence intervals', default: true })
  @IsOptional()
  @IsBoolean()
  includeConfidenceInterval?: boolean = true;

  @ApiPropertyOptional({ description: 'Include actionable recommendations', default: true })
  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean = true;

  @ApiPropertyOptional({ description: 'Minimum confidence threshold (0-1)', default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number = 0.7;

  @ApiPropertyOptional({ description: 'Number of results to return', default: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;
}

export class StockoutPredictionQueryDto extends BasePredictiveQueryDto {
  @ApiProperty({ description: 'Time horizon for stockout prediction', enum: TimeHorizon, default: TimeHorizon.NEXT_30_DAYS })
  @IsEnum(TimeHorizon)
  timeHorizon: TimeHorizon = TimeHorizon.NEXT_30_DAYS;

  @ApiPropertyOptional({ description: 'Minimum risk level to include', enum: RiskLevel, default: RiskLevel.MEDIUM })
  @IsOptional()
  @IsEnum(RiskLevel)
  minRiskLevel?: RiskLevel = RiskLevel.MEDIUM;

  @ApiPropertyOptional({ description: 'Include products with current low stock only', default: false })
  @IsOptional()
  @IsBoolean()
  currentLowStockOnly?: boolean = false;

  @ApiPropertyOptional({ description: 'Include seasonal factors in prediction', default: true })
  @IsOptional()
  @IsBoolean()
  includeSeasonalFactors?: boolean = true;

  @ApiPropertyOptional({ description: 'Consider lead time in predictions', default: true })
  @IsOptional()
  @IsBoolean()
  considerLeadTime?: boolean = true;
}

export class SlowMovingDetectionQueryDto extends BasePredictiveQueryDto {
  @ApiPropertyOptional({ description: 'Days to look back for movement analysis', default: 90 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(365)
  lookbackDays?: number = 90;

  @ApiPropertyOptional({ description: 'Minimum turnover ratio threshold', default: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minTurnoverRatio?: number = 0.5;

  @ApiPropertyOptional({ description: 'Maximum days without sale to consider slow-moving', default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(7)
  @Max(180)
  maxDaysWithoutSale?: number = 60;

  @ApiPropertyOptional({ description: 'Movement categories to include', enum: MovementCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MovementCategory, { each: true })
  movementCategories?: MovementCategory[];

  @ApiPropertyOptional({ description: 'Include value analysis (slow-moving high-value items)', default: true })
  @IsOptional()
  @IsBoolean()
  includeValueAnalysis?: boolean = true;

  @ApiPropertyOptional({ description: 'Minimum inventory value to include', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minInventoryValue?: number = 0;
}

export class OptimalReorderQueryDto extends BasePredictiveQueryDto {
  @ApiPropertyOptional({ description: 'Forecast horizon for reorder calculation', enum: TimeHorizon, default: TimeHorizon.NEXT_30_DAYS })
  @IsOptional()
  @IsEnum(TimeHorizon)
  forecastHorizon?: TimeHorizon = TimeHorizon.NEXT_30_DAYS;

  @ApiPropertyOptional({ description: 'Safety stock multiplier (1-3)', default: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  safetyStockMultiplier?: number = 1.5;

  @ApiPropertyOptional({ description: 'Consider supplier lead time', default: true })
  @IsOptional()
  @IsBoolean()
  considerSupplierLeadTime?: boolean = true;

  @ApiPropertyOptional({ description: 'Include economic order quantity (EOQ) calculation', default: true })
  @IsOptional()
  @IsBoolean()
  includeEOQ?: boolean = true;

  @ApiPropertyOptional({ description: 'Maximum budget constraint for reorders' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ description: 'Priority products only (high-velocity, high-value)', default: false })
  @IsOptional()
  @IsBoolean()
  priorityProductsOnly?: boolean = false;
}

export class PriceOptimizationQueryDto extends BasePredictiveQueryDto {
  @ApiPropertyOptional({ description: 'Current profit margin threshold (%)', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  currentMarginThreshold?: number = 20;

  @ApiPropertyOptional({ description: 'Target profit margin (%)', default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetMargin?: number = 30;

  @ApiPropertyOptional({ description: 'Consider competitor pricing', default: true })
  @IsOptional()
  @IsBoolean()
  considerCompetitorPricing?: boolean = true;

  @ApiPropertyOptional({ description: 'Include demand elasticity analysis', default: true })
  @IsOptional()
  @IsBoolean()
  includeDemandElasticity?: boolean = true;

  @ApiPropertyOptional({ description: 'Maximum price increase percentage', default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  maxPriceIncrease?: number = 15;

  @ApiPropertyOptional({ description: 'Include seasonal pricing recommendations', default: true })
  @IsOptional()
  @IsBoolean()
  includeSeasonalPricing?: boolean = true;

  @ApiPropertyOptional({ description: 'Minimum volume threshold for analysis', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minVolumeThreshold?: number = 10;
}

export class DemandAnomalyQueryDto extends BasePredictiveQueryDto {
  @ApiPropertyOptional({ description: 'Sensitivity for anomaly detection (1-10)', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  sensitivityLevel?: number = 5;

  @ApiPropertyOptional({ description: 'Look for positive anomalies (spikes)', default: true })
  @IsOptional()
  @IsBoolean()
  detectSpikes?: boolean = true;

  @ApiPropertyOptional({ description: 'Look for negative anomalies (drops)', default: true })
  @IsOptional()
  @IsBoolean()
  detectDrops?: boolean = true;

  @ApiPropertyOptional({ description: 'Include seasonal anomalies', default: true })
  @IsOptional()
  @IsBoolean()
  includeSeasonalAnomalies?: boolean = true;

  @ApiPropertyOptional({ description: 'Minimum deviation percentage to consider anomaly', default: 25 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100)
  minDeviationPercent?: number = 25;
}

export class SeasonalAnalysisQueryDto extends BasePredictiveQueryDto {
  @ApiPropertyOptional({ description: 'Analysis period in months', default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(24)
  analysisPeriodMonths?: number = 12;

  @ApiPropertyOptional({ description: 'Include weekly patterns', default: true })
  @IsOptional()
  @IsBoolean()
  includeWeeklyPatterns?: boolean = true;

  @ApiPropertyOptional({ description: 'Include monthly patterns', default: true })
  @IsOptional()
  @IsBoolean()
  includeMonthlyPatterns?: boolean = true;

  @ApiPropertyOptional({ description: 'Include holiday effects', default: true })
  @IsOptional()
  @IsBoolean()
  includeHolidayEffects?: boolean = true;

  @ApiPropertyOptional({ description: 'Indonesian holiday calendar', default: true })
  @IsOptional()
  @IsBoolean()
  useIndonesianHolidays?: boolean = true;

  @ApiPropertyOptional({ description: 'Minimum seasonality strength to report', default: 0.3 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1)
  minSeasonalityStrength?: number = 0.3;
}

export class PredictiveAnalyticsQueryDto extends BasePredictiveQueryDto {
  @ApiProperty({ description: 'Type of predictive analysis to perform', enum: PredictiveAnalysisType })
  @IsEnum(PredictiveAnalysisType)
  analysisType: PredictiveAnalysisType;

  @ApiPropertyOptional({ description: 'Specific parameters for the analysis type' })
  @IsOptional()
  @Type(() => Object)
  parameters?: StockoutPredictionQueryDto | SlowMovingDetectionQueryDto | OptimalReorderQueryDto | PriceOptimizationQueryDto | DemandAnomalyQueryDto | SeasonalAnalysisQueryDto;
}