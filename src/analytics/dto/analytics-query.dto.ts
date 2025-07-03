import { IsOptional, IsEnum, IsDateString, IsArray, IsUUID, IsString, IsInt, Min, Max, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsType {
  REVENUE = 'revenue',
  INVENTORY_TURNOVER = 'inventory_turnover',
  PRODUCT_PERFORMANCE = 'product_performance',
  CUSTOMER_INSIGHTS = 'customer_insights',
  DASHBOARD_METRICS = 'dashboard_metrics',
}

export enum TimeGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum MetricType {
  REVENUE = 'revenue',
  PROFIT = 'profit',
  VOLUME = 'volume',
  TURNOVER = 'turnover',
  MARGIN = 'margin',
  GROWTH = 'growth',
}

export enum ComparisonPeriod {
  PREVIOUS_PERIOD = 'previous_period',
  SAME_PERIOD_LAST_YEAR = 'same_period_last_year',
  CUSTOM = 'custom',
}

export enum BenchmarkType {
  CATEGORY_AVERAGE = 'category_average',
  INDUSTRY_STANDARD = 'industry_standard',
  BEST_PERFORMER = 'best_performer',
  HISTORICAL_AVERAGE = 'historical_average',
}

export class BaseAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for analytics period',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics period',
    example: '2025-06-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: TimeGranularity,
    default: TimeGranularity.MONTHLY,
    description: 'Time granularity for analytics aggregation',
  })
  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity = TimeGranularity.MONTHLY;

  @ApiPropertyOptional({
    description: 'Filter by specific location IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  locationIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by specific product IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by category IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Include comparison with previous period',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeComparison?: boolean = true;

  @ApiPropertyOptional({
    enum: ComparisonPeriod,
    default: ComparisonPeriod.PREVIOUS_PERIOD,
    description: 'Type of comparison period',
  })
  @IsOptional()
  @IsEnum(ComparisonPeriod)
  comparisonType?: ComparisonPeriod = ComparisonPeriod.PREVIOUS_PERIOD;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 1000,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 50;
}

export class RevenueAnalyticsQueryDto extends BaseAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Include cost of goods sold (COGS) analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCOGS?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include profit margin analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeProfitMargin?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include revenue by channel breakdown',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeChannelBreakdown?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include tax analysis',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeTaxAnalysis?: boolean = false;

  @ApiPropertyOptional({
    description: 'Currency code for analysis',
    default: 'IDR',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'IDR';

  @ApiPropertyOptional({
    description: 'Include trend analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeTrends?: boolean = true;
}

export class InventoryTurnoverQueryDto extends BaseAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Include slow-moving items analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSlowMoving?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include fast-moving items analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeFastMoving?: boolean = true;

  @ApiPropertyOptional({
    description: 'Minimum turnover ratio threshold for fast-moving',
    default: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fastMovingThreshold?: number = 4;

  @ApiPropertyOptional({
    description: 'Maximum turnover ratio threshold for slow-moving',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  slowMovingThreshold?: number = 1;

  @ApiPropertyOptional({
    description: 'Include inventory aging analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeAgingAnalysis?: boolean = true;
}

export class ProductPerformanceQueryDto extends BaseAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Minimum sales volume to include in analysis',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSalesVolume?: number = 1;

  @ApiPropertyOptional({
    description: 'Include profitability analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeProfitability?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include ABC analysis (80/20 rule)',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeABCAnalysis?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include seasonal analysis',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSeasonalAnalysis?: boolean = false;

  @ApiPropertyOptional({
    description: 'Sort by performance metric',
    enum: ['revenue', 'profit', 'volume', 'margin', 'turnover'],
    default: 'revenue',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'revenue';
}

export class CustomerInsightsQueryDto extends BaseAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Include customer segmentation analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSegmentation?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include customer lifetime value analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeLTV?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include purchase behavior analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includePurchaseBehavior?: boolean = true;

  @ApiPropertyOptional({
    description: 'Minimum transactions for customer inclusion',
    default: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minTransactions?: number = 2;
}

export class DashboardMetricsQueryDto extends BaseAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Include real-time metrics',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeRealTime?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include trend analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeTrends?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include KPI alerts',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeAlerts?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include forecasting insights',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeForecast?: boolean = false;
}

export class CustomMetricQueryDto extends BaseAnalyticsQueryDto {
  @ApiProperty({
    description: 'Custom metric name',
  })
  @IsString()
  metricName: string;

  @ApiProperty({
    enum: MetricType,
    description: 'Type of metric to calculate',
  })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiPropertyOptional({
    description: 'Custom aggregation formula (SQL-like)',
  })
  @IsOptional()
  @IsString()
  customFormula?: string;

  @ApiPropertyOptional({
    description: 'Additional filters as JSON object',
  })
  @IsOptional()
  additionalFilters?: Record<string, any>;
}

export class BenchmarkingQueryDto extends BaseAnalyticsQueryDto {
  @ApiProperty({
    enum: BenchmarkType,
    description: 'Type of benchmark comparison',
  })
  @IsEnum(BenchmarkType)
  benchmarkType: BenchmarkType;

  @ApiPropertyOptional({
    description: 'Metrics to benchmark',
    type: [String],
    enum: MetricType,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(MetricType, { each: true })
  metrics?: MetricType[];

  @ApiPropertyOptional({
    description: 'Include percentile analysis',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includePercentiles?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include peer comparison',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includePeerComparison?: boolean = false;
}