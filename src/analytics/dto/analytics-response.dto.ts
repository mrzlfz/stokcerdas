import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsMetaDto {
  @ApiProperty({ description: 'Total number of records' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Analytics generation timestamp' })
  generatedAt: string;

  @ApiProperty({ description: 'Query execution duration in milliseconds' })
  executionTime: number;

  @ApiProperty({ description: 'Analytics parameters used' })
  parameters: Record<string, any>;

  @ApiProperty({ description: 'Data refresh timestamp' })
  dataAsOf: string;
}

export class TrendDataDto {
  @ApiProperty({ description: 'Period identifier (date/month/quarter)' })
  period: string;

  @ApiProperty({ description: 'Period value' })
  value: number;

  @ApiProperty({ description: 'Change from previous period' })
  change?: number;

  @ApiProperty({ description: 'Change percentage from previous period' })
  changePercent?: number;

  @ApiProperty({ description: 'Period start date' })
  periodStart: string;

  @ApiProperty({ description: 'Period end date' })
  periodEnd: string;
}

export class ComparisonDataDto {
  @ApiProperty({ description: 'Current period value' })
  current: number;

  @ApiProperty({ description: 'Previous period value' })
  previous: number;

  @ApiProperty({ description: 'Absolute change' })
  change: number;

  @ApiProperty({ description: 'Percentage change' })
  changePercent: number;

  @ApiProperty({ description: 'Trend direction' })
  trend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Comparison period description' })
  comparisonPeriod: string;
}

export class KPIAlertDto {
  @ApiProperty({ description: 'Alert ID' })
  id: string;

  @ApiProperty({ description: 'Alert message' })
  message: string;

  @ApiProperty({ description: 'Alert severity' })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ description: 'Alert type' })
  type: 'threshold' | 'trend' | 'anomaly' | 'forecast';

  @ApiProperty({ description: 'Metric that triggered the alert' })
  metric: string;

  @ApiProperty({ description: 'Current value' })
  currentValue: number;

  @ApiProperty({ description: 'Threshold value' })
  thresholdValue?: number;

  @ApiProperty({ description: 'Recommended action' })
  recommendation?: string;

  @ApiProperty({ description: 'Alert timestamp' })
  timestamp: string;
}

// Revenue Analytics DTOs
export class RevenueBreakdownDto {
  @ApiProperty({ description: 'Period identifier' })
  period: string;

  @ApiProperty({ description: 'Total revenue (IDR)' })
  totalRevenue: number;

  @ApiProperty({ description: 'Gross revenue (before discounts)' })
  grossRevenue: number;

  @ApiProperty({ description: 'Net revenue (after discounts)' })
  netRevenue: number;

  @ApiProperty({ description: 'Total cost of goods sold' })
  cogs: number;

  @ApiProperty({ description: 'Gross profit' })
  grossProfit: number;

  @ApiProperty({ description: 'Gross profit margin percentage' })
  grossProfitMargin: number;

  @ApiProperty({ description: 'Total discounts given' })
  totalDiscounts: number;

  @ApiProperty({ description: 'Total tax collected' })
  totalTax: number;

  @ApiProperty({ description: 'Number of transactions' })
  transactionCount: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Revenue by channel breakdown' })
  channelBreakdown?: Array<{
    channelName: string;
    revenue: number;
    percentage: number;
    transactionCount: number;
  }>;
}

export class RevenueAnalyticsResponseDto {
  @ApiProperty({ type: [RevenueBreakdownDto] })
  data: RevenueBreakdownDto[];

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Revenue analytics summary' })
  summary: {
    totalRevenue: number;
    totalGrossProfit: number;
    averageGrossProfitMargin: number;
    revenueGrowth: number;
    profitGrowth: number;
    bestPerformingPeriod: string;
    worstPerformingPeriod: string;
    topRevenueChannel?: string;
  };

  @ApiProperty({ type: [TrendDataDto], description: 'Revenue trend data' })
  trends: TrendDataDto[];

  @ApiProperty({ type: ComparisonDataDto, description: 'Period comparison' })
  comparison?: ComparisonDataDto;

  @ApiProperty({ type: [KPIAlertDto], description: 'Revenue-related alerts' })
  alerts?: KPIAlertDto[];
}

// Inventory Turnover DTOs
export class InventoryTurnoverItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product SKU' })
  sku: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Average inventory value' })
  averageInventoryValue: number;

  @ApiProperty({ description: 'Cost of goods sold' })
  cogs: number;

  @ApiProperty({ description: 'Inventory turnover ratio' })
  turnoverRatio: number;

  @ApiProperty({ description: 'Days in inventory' })
  daysInInventory: number;

  @ApiProperty({ description: 'Current stock level' })
  currentStockLevel: number;

  @ApiProperty({ description: 'Stock status classification' })
  stockStatus: 'fast_moving' | 'normal' | 'slow_moving' | 'dead_stock';

  @ApiProperty({ description: 'Total units sold' })
  totalUnitsSold: number;

  @ApiProperty({ description: 'Sales velocity (units per day)' })
  salesVelocity: number;

  @ApiProperty({ description: 'Inventory aging in days' })
  inventoryAge: number;

  @ApiProperty({ description: 'Last sale date' })
  lastSaleDate?: string;

  @ApiProperty({ description: 'Recommended action' })
  recommendation: 'increase_stock' | 'reduce_stock' | 'maintain' | 'discontinue';
}

export class InventoryTurnoverResponseDto {
  @ApiProperty({ type: [InventoryTurnoverItemDto] })
  data: InventoryTurnoverItemDto[];

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Inventory turnover summary' })
  summary: {
    averageTurnoverRatio: number;
    averageDaysInInventory: number;
    fastMovingItems: number;
    slowMovingItems: number;
    deadStockItems: number;
    totalInventoryValue: number;
    turnoverImprovement: number;
    topPerformingCategory: string;
    underperformingCategories: string[];
  };

  @ApiProperty({ type: [TrendDataDto], description: 'Turnover trend data' })
  trends: TrendDataDto[];

  @ApiProperty({ type: ComparisonDataDto, description: 'Period comparison' })
  comparison?: ComparisonDataDto;

  @ApiProperty({ type: [KPIAlertDto], description: 'Inventory-related alerts' })
  alerts?: KPIAlertDto[];
}

// Product Performance DTOs
export class ProductPerformanceItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product SKU' })
  sku: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Total revenue generated' })
  totalRevenue: number;

  @ApiProperty({ description: 'Total units sold' })
  totalUnitsSold: number;

  @ApiProperty({ description: 'Total profit generated' })
  totalProfit: number;

  @ApiProperty({ description: 'Profit margin percentage' })
  profitMargin: number;

  @ApiProperty({ description: 'Average selling price' })
  averageSellingPrice: number;

  @ApiProperty({ description: 'Inventory turnover ratio' })
  inventoryTurnover: number;

  @ApiProperty({ description: 'ABC classification' })
  abcClassification: 'A' | 'B' | 'C';

  @ApiProperty({ description: 'Performance score (0-100)' })
  performanceScore: number;

  @ApiProperty({ description: 'Performance ranking' })
  performanceRank: number;

  @ApiProperty({ description: 'Revenue contribution percentage' })
  revenueContribution: number;

  @ApiProperty({ description: 'Growth rate percentage' })
  growthRate: number;

  @ApiProperty({ description: 'Seasonal pattern indicator' })
  seasonalPattern?: 'seasonal' | 'stable' | 'declining';

  @ApiProperty({ description: 'Current stock level' })
  currentStockLevel: number;

  @ApiProperty({ description: 'Recommended action' })
  recommendation: 'promote' | 'maintain' | 'review_pricing' | 'discontinue';
}

export class ProductPerformanceResponseDto {
  @ApiProperty({ type: [ProductPerformanceItemDto] })
  data: ProductPerformanceItemDto[];

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Product performance summary' })
  summary: {
    totalProducts: number;
    topPerformers: number; // Class A products
    mediumPerformers: number; // Class B products
    underperformers: number; // Class C products
    averagePerformanceScore: number;
    totalRevenue: number;
    totalProfit: number;
    averageProfitMargin: number;
    topRevenueProduct: string;
    topProfitProduct: string;
    fastestGrowingProduct: string;
  };

  @ApiProperty({ type: [TrendDataDto], description: 'Performance trend data' })
  trends: TrendDataDto[];

  @ApiProperty({ type: ComparisonDataDto, description: 'Period comparison' })
  comparison?: ComparisonDataDto;

  @ApiProperty({ type: [KPIAlertDto], description: 'Product performance alerts' })
  alerts?: KPIAlertDto[];
}

// Customer Insights DTOs
export class CustomerSegmentDto {
  @ApiProperty({ description: 'Segment name' })
  segmentName: string;

  @ApiProperty({ description: 'Number of customers in segment' })
  customerCount: number;

  @ApiProperty({ description: 'Total revenue from segment' })
  totalRevenue: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Average purchase frequency' })
  averagePurchaseFrequency: number;

  @ApiProperty({ description: 'Customer lifetime value' })
  averageLTV: number;

  @ApiProperty({ description: 'Segment characteristics' })
  characteristics: {
    averageOrderSize: number;
    preferredCategories: string[];
    purchasePattern: 'frequent' | 'occasional' | 'rare';
    loyaltyLevel: 'high' | 'medium' | 'low';
  };
}

export class CustomerInsightsResponseDto {
  @ApiProperty({ type: [CustomerSegmentDto] })
  data: CustomerSegmentDto[];

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Customer insights summary' })
  summary: {
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
  };

  @ApiProperty({ type: [TrendDataDto], description: 'Customer trend data' })
  trends: TrendDataDto[];

  @ApiProperty({ type: ComparisonDataDto, description: 'Period comparison' })
  comparison?: ComparisonDataDto;

  @ApiProperty({ type: [KPIAlertDto], description: 'Customer-related alerts' })
  alerts?: KPIAlertDto[];
}

// Dashboard Metrics DTOs
export class DashboardKPIDto {
  @ApiProperty({ description: 'KPI name' })
  name: string;

  @ApiProperty({ description: 'Current value' })
  value: number;

  @ApiProperty({ description: 'Display format' })
  format: 'currency' | 'percentage' | 'number' | 'ratio';

  @ApiProperty({ description: 'Change from previous period' })
  change: number;

  @ApiProperty({ description: 'Change percentage' })
  changePercent: number;

  @ApiProperty({ description: 'Trend direction' })
  trend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Target value (if applicable)' })
  target?: number;

  @ApiProperty({ description: 'Performance against target' })
  targetProgress?: number;

  @ApiProperty({ description: 'Status indicator' })
  status: 'excellent' | 'good' | 'warning' | 'critical';

  @ApiProperty({ description: 'Sparkline data for mini chart' })
  sparklineData?: number[];
}

export class DashboardMetricsResponseDto {
  @ApiProperty({ type: [DashboardKPIDto] })
  data: DashboardKPIDto[];

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Dashboard summary' })
  summary: {
    overallScore: number;
    criticalAlerts: number;
    improvingMetrics: number;
    decliningMetrics: number;
    lastUpdated: string;
  };

  @ApiProperty({ type: [KPIAlertDto], description: 'Critical dashboard alerts' })
  alerts: KPIAlertDto[];

  @ApiProperty({ description: 'Real-time metrics' })
  realTimeMetrics?: {
    currentDayRevenue: number;
    currentDayOrders: number;
    activeUsers: number;
    lowStockAlerts: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  };
}

// Custom Metrics DTOs
export class CustomMetricResultDto {
  @ApiProperty({ description: 'Metric name' })
  metricName: string;

  @ApiProperty({ description: 'Calculated value' })
  value: number;

  @ApiProperty({ description: 'Metric type' })
  metricType: string;

  @ApiProperty({ description: 'Calculation timestamp' })
  calculatedAt: string;

  @ApiProperty({ description: 'Breakdown by dimensions' })
  breakdown?: Array<{
    dimension: string;
    value: number;
    percentage: number;
  }>;

  @ApiProperty({ description: 'Historical values' })
  historical?: Array<{
    period: string;
    value: number;
  }>;
}

export class CustomMetricResponseDto {
  @ApiProperty({ type: CustomMetricResultDto })
  data: CustomMetricResultDto;

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Metric insights' })
  insights?: {
    trend: 'increasing' | 'decreasing' | 'stable';
    seasonality: boolean;
    anomalies: Array<{
      date: string;
      expectedValue: number;
      actualValue: number;
      deviation: number;
    }>;
    recommendations: string[];
  };
}

// Benchmarking DTOs
export class BenchmarkComparisonDto {
  @ApiProperty({ description: 'Metric name' })
  metricName: string;

  @ApiProperty({ description: 'Your value' })
  yourValue: number;

  @ApiProperty({ description: 'Benchmark value' })
  benchmarkValue: number;

  @ApiProperty({ description: 'Performance relative to benchmark' })
  relativePerformance: number;

  @ApiProperty({ description: 'Performance category' })
  performanceCategory: 'excellent' | 'above_average' | 'average' | 'below_average' | 'poor';

  @ApiProperty({ description: 'Percentile ranking' })
  percentileRank: number;

  @ApiProperty({ description: 'Gap to close to reach benchmark' })
  improvementGap: number;

  @ApiProperty({ description: 'Improvement recommendations' })
  recommendations: string[];
}

export class BenchmarkingResponseDto {
  @ApiProperty({ type: [BenchmarkComparisonDto] })
  data: BenchmarkComparisonDto[];

  @ApiProperty({ type: AnalyticsMetaDto })
  meta: AnalyticsMetaDto;

  @ApiProperty({ description: 'Overall benchmarking summary' })
  summary: {
    overallScore: number;
    metricsAboveBenchmark: number;
    metricsBelowBenchmark: number;
    topPerformingMetrics: string[];
    improvementAreas: string[];
    benchmarkType: string;
    benchmarkDate: string;
  };

  @ApiProperty({ description: 'Peer comparison data' })
  peerComparison?: {
    totalPeers: number;
    yourRanking: number;
    topPerformer: {
      rank: 1;
      score: number;
    };
    industryAverage: number;
  };
}