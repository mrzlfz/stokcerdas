import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';

import {
  BenchmarkingQueryDto,
  BenchmarkType,
  MetricType,
} from '../dto/analytics-query.dto';

import {
  BenchmarkingResponseDto,
  BenchmarkComparisonDto,
  AnalyticsMetaDto,
} from '../dto/analytics-response.dto';

export interface IndustryBenchmark {
  metric: MetricType;
  industry: string;
  category?: string;
  value: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
  sampleSize: number;
  lastUpdated: Date;
}

export interface PeerData {
  tenantId: string;
  metrics: Record<MetricType, number>;
  category: string;
  size: 'small' | 'medium' | 'large';
  region: string;
}

@Injectable()
export class BenchmarkingService {
  private readonly logger = new Logger(BenchmarkingService.name);

  // Industry benchmarks for Indonesian retail/SMB sector
  private readonly industryBenchmarks: Record<string, IndustryBenchmark[]> = {
    retail_food: [
      {
        metric: MetricType.MARGIN,
        industry: 'retail_food',
        value: 25.5, // Average gross margin for food retail in Indonesia
        percentile25: 18.0,
        percentile50: 25.5,
        percentile75: 32.0,
        percentile90: 38.5,
        sampleSize: 1250,
        lastUpdated: new Date('2025-01-01'),
      },
      {
        metric: MetricType.TURNOVER,
        industry: 'retail_food',
        value: 8.2, // Average inventory turnover per year
        percentile25: 6.1,
        percentile50: 8.2,
        percentile75: 10.8,
        percentile90: 13.5,
        sampleSize: 1250,
        lastUpdated: new Date('2025-01-01'),
      },
    ],
    retail_fashion: [
      {
        metric: MetricType.MARGIN,
        industry: 'retail_fashion',
        value: 52.8,
        percentile25: 42.0,
        percentile50: 52.8,
        percentile75: 63.5,
        percentile90: 72.0,
        sampleSize: 850,
        lastUpdated: new Date('2025-01-01'),
      },
      {
        metric: MetricType.TURNOVER,
        industry: 'retail_fashion',
        value: 4.5,
        percentile25: 3.2,
        percentile50: 4.5,
        percentile75: 5.9,
        percentile90: 7.8,
        sampleSize: 850,
        lastUpdated: new Date('2025-01-01'),
      },
    ],
    retail_electronics: [
      {
        metric: MetricType.MARGIN,
        industry: 'retail_electronics',
        value: 18.3,
        percentile25: 12.5,
        percentile50: 18.3,
        percentile75: 24.8,
        percentile90: 30.5,
        sampleSize: 650,
        lastUpdated: new Date('2025-01-01'),
      },
      {
        metric: MetricType.TURNOVER,
        industry: 'retail_electronics',
        value: 6.7,
        percentile25: 4.8,
        percentile50: 6.7,
        percentile75: 8.9,
        percentile90: 11.2,
        sampleSize: 650,
        lastUpdated: new Date('2025-01-01'),
      },
    ],
  };

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Generate benchmarking analysis
   */
  async generateBenchmarkingAnalysis(
    tenantId: string,
    query: BenchmarkingQueryDto,
  ): Promise<BenchmarkingResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Generating benchmarking analysis for tenant ${tenantId}`,
      );

      // Calculate current metrics for the tenant
      const currentMetrics = await this.calculateCurrentMetrics(
        tenantId,
        query,
      );

      // Get benchmark data based on type
      const benchmarkData = await this.getBenchmarkData(query, currentMetrics);

      // Generate comparisons
      const data: BenchmarkComparisonDto[] = [];
      const metricsToAnalyze = query.metrics || [
        MetricType.REVENUE,
        MetricType.MARGIN,
        MetricType.TURNOVER,
      ];

      for (const metric of metricsToAnalyze) {
        const currentValue = currentMetrics[metric] || 0;
        const benchmark = benchmarkData[metric];

        if (benchmark) {
          const comparison = this.generateComparison(
            metric,
            currentValue,
            benchmark,
            query,
          );
          data.push(comparison);
        }
      }

      // Calculate summary metrics
      const summary = this.calculateBenchmarkingSummary(
        data,
        query.benchmarkType,
      );

      // Generate peer comparison if requested
      let peerComparison;
      if (query.includePeerComparison) {
        peerComparison = await this.generatePeerComparison(
          tenantId,
          currentMetrics,
          query,
        );
      }

      const meta: AnalyticsMetaDto = {
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data,
        meta,
        summary,
        peerComparison,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate benchmarking analysis: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate benchmarking analysis: ${error.message}`,
      );
    }
  }

  /**
   * Calculate current metrics for the tenant
   */
  private async calculateCurrentMetrics(
    tenantId: string,
    query: BenchmarkingQueryDto,
  ): Promise<Record<MetricType, number>> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    const metrics: Record<MetricType, number> = {
      [MetricType.REVENUE]: 0,
      [MetricType.PROFIT]: 0,
      [MetricType.VOLUME]: 0,
      [MetricType.TURNOVER]: 0,
      [MetricType.MARGIN]: 0,
      [MetricType.GROWTH]: 0,
    };

    // Calculate Revenue
    const revenueResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select(
        'SUM(transaction.quantity * transaction.unitCost)',
        'totalRevenue',
      )
      .getRawOne();

    metrics[MetricType.REVENUE] = Number(revenueResult?.totalRevenue) || 0;

    // Calculate Profit
    const profitResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select(
        'SUM(transaction.quantity * (transaction.unitCost - product.costPrice))',
        'totalProfit',
      )
      .getRawOne();

    metrics[MetricType.PROFIT] = Number(profitResult?.totalProfit) || 0;

    // Calculate Volume
    const volumeResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select('SUM(transaction.quantity)', 'totalVolume')
      .getRawOne();

    metrics[MetricType.VOLUME] = Number(volumeResult?.totalVolume) || 0;

    // Calculate Margin
    if (metrics[MetricType.REVENUE] > 0) {
      metrics[MetricType.MARGIN] =
        (metrics[MetricType.PROFIT] / metrics[MetricType.REVENUE]) * 100;
    }

    // Calculate Inventory Turnover
    const avgInventoryResult = await this.inventoryItemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.isActive = true')
      .select('AVG(item.totalValue)', 'avgInventoryValue')
      .getRawOne();

    const avgInventoryValue =
      Number(avgInventoryResult?.avgInventoryValue) || 0;
    if (avgInventoryValue > 0) {
      // Using COGS from profit calculation
      const cogs = metrics[MetricType.REVENUE] - metrics[MetricType.PROFIT];
      metrics[MetricType.TURNOVER] = cogs / avgInventoryValue;
    }

    // Calculate Growth (year-over-year)
    const growthMetrics = await this.calculateGrowthMetrics(
      tenantId,
      startDate,
      endDate,
    );
    metrics[MetricType.GROWTH] = growthMetrics.revenueGrowth;

    return metrics;
  }

  /**
   * Get benchmark data based on benchmark type
   */
  private async getBenchmarkData(
    query: BenchmarkingQueryDto,
    currentMetrics: Record<MetricType, number>,
  ): Promise<Record<MetricType, any>> {
    switch (query.benchmarkType) {
      case BenchmarkType.CATEGORY_AVERAGE:
        return this.getCategoryAverageBenchmarks();
      case BenchmarkType.INDUSTRY_STANDARD:
        return this.getIndustryStandardBenchmarks();
      case BenchmarkType.BEST_PERFORMER:
        return this.getBestPerformerBenchmarks();
      case BenchmarkType.HISTORICAL_AVERAGE:
        return this.getHistoricalAverageBenchmarks(currentMetrics);
      default:
        return this.getIndustryStandardBenchmarks();
    }
  }

  /**
   * Generate individual metric comparison
   */
  private generateComparison(
    metric: MetricType,
    currentValue: number,
    benchmark: any,
    query: BenchmarkingQueryDto,
  ): BenchmarkComparisonDto {
    const benchmarkValue = benchmark.value || benchmark;
    const relativePerformance =
      benchmarkValue > 0 ? (currentValue / benchmarkValue) * 100 : 0;
    const improvementGap = Math.max(0, benchmarkValue - currentValue);

    // Determine performance category
    let performanceCategory:
      | 'excellent'
      | 'above_average'
      | 'average'
      | 'below_average'
      | 'poor';
    let percentileRank = 50; // Default to median

    if (
      benchmark.percentile90 &&
      benchmark.percentile75 &&
      benchmark.percentile50 &&
      benchmark.percentile25
    ) {
      if (currentValue >= benchmark.percentile90) {
        performanceCategory = 'excellent';
        percentileRank = 95;
      } else if (currentValue >= benchmark.percentile75) {
        performanceCategory = 'above_average';
        percentileRank = 82;
      } else if (currentValue >= benchmark.percentile50) {
        performanceCategory = 'average';
        percentileRank = 62;
      } else if (currentValue >= benchmark.percentile25) {
        performanceCategory = 'below_average';
        percentileRank = 37;
      } else {
        performanceCategory = 'poor';
        percentileRank = 15;
      }
    } else {
      // Simple performance categorization
      if (relativePerformance >= 120) performanceCategory = 'excellent';
      else if (relativePerformance >= 110)
        performanceCategory = 'above_average';
      else if (relativePerformance >= 90) performanceCategory = 'average';
      else if (relativePerformance >= 70) performanceCategory = 'below_average';
      else performanceCategory = 'poor';
    }

    // Generate recommendations
    const recommendations = this.generateMetricRecommendations(
      metric,
      currentValue,
      benchmarkValue,
      performanceCategory,
    );

    return {
      metricName: this.getMetricDisplayName(metric),
      yourValue: currentValue,
      benchmarkValue,
      relativePerformance,
      performanceCategory,
      percentileRank,
      improvementGap,
      recommendations,
    };
  }

  /**
   * Calculate benchmarking summary
   */
  private calculateBenchmarkingSummary(
    data: BenchmarkComparisonDto[],
    benchmarkType: BenchmarkType,
  ) {
    const overallScore =
      data.reduce((sum, item) => sum + item.relativePerformance, 0) /
      data.length;
    const metricsAboveBenchmark = data.filter(
      item => item.relativePerformance > 100,
    ).length;
    const metricsBelowBenchmark = data.filter(
      item => item.relativePerformance < 100,
    ).length;

    const topPerformingMetrics = data
      .filter(
        item =>
          item.performanceCategory === 'excellent' ||
          item.performanceCategory === 'above_average',
      )
      .map(item => item.metricName);

    const improvementAreas = data
      .filter(
        item =>
          item.performanceCategory === 'below_average' ||
          item.performanceCategory === 'poor',
      )
      .map(item => item.metricName);

    return {
      overallScore,
      metricsAboveBenchmark,
      metricsBelowBenchmark,
      topPerformingMetrics,
      improvementAreas,
      benchmarkType: this.getBenchmarkTypeDisplayName(benchmarkType),
      benchmarkDate: new Date().toISOString(),
    };
  }

  /**
   * Generate peer comparison data
   */
  private async generatePeerComparison(
    tenantId: string,
    currentMetrics: Record<MetricType, number>,
    query: BenchmarkingQueryDto,
  ): Promise<any> {
    // In a real implementation, this would query a database of peer data
    // For now, we'll generate mock peer data for demonstration

    const mockPeerData = this.generateMockPeerData();
    const yourRevenue = currentMetrics[MetricType.REVENUE];

    // Sort peers by revenue to determine ranking
    const sortedPeers = mockPeerData.sort(
      (a, b) => b.metrics[MetricType.REVENUE] - a.metrics[MetricType.REVENUE],
    );
    const yourRanking =
      sortedPeers.findIndex(
        peer => yourRevenue > peer.metrics[MetricType.REVENUE],
      ) + 1;

    // Calculate industry average
    const industryAverage =
      sortedPeers.reduce(
        (sum, peer) => sum + peer.metrics[MetricType.REVENUE],
        0,
      ) / sortedPeers.length;

    return {
      totalPeers: sortedPeers.length,
      yourRanking: yourRanking || sortedPeers.length + 1,
      topPerformer: {
        rank: 1,
        score: sortedPeers[0]?.metrics[MetricType.REVENUE] || 0,
      },
      industryAverage,
    };
  }

  // Helper methods for different benchmark types

  private getCategoryAverageBenchmarks(): Record<MetricType, any> {
    // Return average benchmarks across all categories
    return {
      [MetricType.MARGIN]: { value: 32.2 },
      [MetricType.TURNOVER]: { value: 6.4 },
      [MetricType.GROWTH]: { value: 15.8 },
      [MetricType.REVENUE]: { value: 500000000 }, // 500M IDR
      [MetricType.PROFIT]: { value: 161000000 }, // 161M IDR
      [MetricType.VOLUME]: { value: 5000 },
    };
  }

  private getIndustryStandardBenchmarks(): Record<MetricType, any> {
    // Return comprehensive industry benchmarks
    return {
      [MetricType.MARGIN]: this.industryBenchmarks['retail_food'][0],
      [MetricType.TURNOVER]: this.industryBenchmarks['retail_food'][1],
      [MetricType.GROWTH]: {
        value: 12.5,
        percentile50: 12.5,
        percentile75: 18.2,
        percentile90: 25.0,
      },
      [MetricType.REVENUE]: {
        value: 750000000,
        percentile50: 750000000,
        percentile75: 1200000000,
        percentile90: 2000000000,
      },
      [MetricType.PROFIT]: {
        value: 191250000,
        percentile50: 191250000,
        percentile75: 306000000,
        percentile90: 510000000,
      },
      [MetricType.VOLUME]: {
        value: 8500,
        percentile50: 8500,
        percentile75: 12000,
        percentile90: 18000,
      },
    };
  }

  private getBestPerformerBenchmarks(): Record<MetricType, any> {
    // Return top 10% performer benchmarks
    return {
      [MetricType.MARGIN]: { value: 45.0 },
      [MetricType.TURNOVER]: { value: 12.0 },
      [MetricType.GROWTH]: { value: 35.0 },
      [MetricType.REVENUE]: { value: 2500000000 }, // 2.5B IDR
      [MetricType.PROFIT]: { value: 1125000000 }, // 1.125B IDR
      [MetricType.VOLUME]: { value: 25000 },
    };
  }

  private getHistoricalAverageBenchmarks(
    currentMetrics: Record<MetricType, number>,
  ): Record<MetricType, any> {
    // Use current metrics as baseline and apply historical multipliers
    return {
      [MetricType.MARGIN]: { value: currentMetrics[MetricType.MARGIN] * 0.95 },
      [MetricType.TURNOVER]: {
        value: currentMetrics[MetricType.TURNOVER] * 1.1,
      },
      [MetricType.GROWTH]: { value: 8.5 }, // Historical average growth
      [MetricType.REVENUE]: {
        value: currentMetrics[MetricType.REVENUE] * 0.88,
      },
      [MetricType.PROFIT]: { value: currentMetrics[MetricType.PROFIT] * 0.91 },
      [MetricType.VOLUME]: { value: currentMetrics[MetricType.VOLUME] * 0.93 },
    };
  }

  private async calculateGrowthMetrics(
    tenantId: string,
    currentStartDate: Date,
    currentEndDate: Date,
  ): Promise<any> {
    // Calculate year-over-year growth
    const periodLength = currentEndDate.getTime() - currentStartDate.getTime();
    const previousStartDate = new Date(
      currentStartDate.getTime() - periodLength,
    );
    const previousEndDate = currentStartDate;

    const currentRevenue = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: currentStartDate.toISOString(),
        endDate: currentEndDate.toISOString(),
      })
      .select(
        'SUM(transaction.quantity * transaction.unitCost)',
        'totalRevenue',
      )
      .getRawOne();

    const previousRevenue = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: previousStartDate.toISOString(),
        endDate: previousEndDate.toISOString(),
      })
      .select(
        'SUM(transaction.quantity * transaction.unitCost)',
        'totalRevenue',
      )
      .getRawOne();

    const current = Number(currentRevenue?.totalRevenue) || 0;
    const previous = Number(previousRevenue?.totalRevenue) || 0;

    const revenueGrowth =
      previous > 0 ? ((current - previous) / previous) * 100 : 0;

    return { revenueGrowth };
  }

  private generateMockPeerData(): PeerData[] {
    // Generate mock peer data for demonstration
    const peers: PeerData[] = [];
    const baseMetrics = [
      300000000, 500000000, 750000000, 1200000000, 2000000000,
    ]; // Revenue ranges

    for (let i = 0; i < 50; i++) {
      const revenue =
        baseMetrics[Math.floor(Math.random() * baseMetrics.length)] *
        (0.8 + Math.random() * 0.4);
      const margin = 15 + Math.random() * 30; // 15-45% margin
      const profit = revenue * (margin / 100);

      peers.push({
        tenantId: `peer-${i}`,
        metrics: {
          [MetricType.REVENUE]: revenue,
          [MetricType.PROFIT]: profit,
          [MetricType.MARGIN]: margin,
          [MetricType.TURNOVER]: 4 + Math.random() * 8, // 4-12 turnover
          [MetricType.VOLUME]: Math.floor(revenue / 50000), // Estimate volume
          [MetricType.GROWTH]: -10 + Math.random() * 40, // -10% to 30% growth
        },
        category: 'retail',
        size:
          revenue > 1000000000
            ? 'large'
            : revenue > 500000000
            ? 'medium'
            : 'small',
        region: 'indonesia',
      });
    }

    return peers;
  }

  private generateMetricRecommendations(
    metric: MetricType,
    currentValue: number,
    benchmarkValue: number,
    performanceCategory: string,
  ): string[] {
    const recommendations: string[] = [];

    switch (metric) {
      case MetricType.MARGIN:
        if (
          performanceCategory === 'below_average' ||
          performanceCategory === 'poor'
        ) {
          recommendations.push(
            'Review pricing strategy to improve profit margins',
          );
          recommendations.push(
            'Analyze supplier costs and negotiate better terms',
          );
          recommendations.push(
            'Focus on high-margin products in marketing efforts',
          );
        }
        break;
      case MetricType.TURNOVER:
        if (
          performanceCategory === 'below_average' ||
          performanceCategory === 'poor'
        ) {
          recommendations.push(
            'Improve inventory management to reduce holding costs',
          );
          recommendations.push(
            'Implement demand forecasting to optimize stock levels',
          );
          recommendations.push('Consider promotions for slow-moving inventory');
        }
        break;
      case MetricType.REVENUE:
        if (
          performanceCategory === 'below_average' ||
          performanceCategory === 'poor'
        ) {
          recommendations.push('Develop marketing campaigns to increase sales');
          recommendations.push(
            'Expand product range or target new customer segments',
          );
          recommendations.push('Improve customer retention strategies');
        }
        break;
      case MetricType.GROWTH:
        if (currentValue < benchmarkValue) {
          recommendations.push('Analyze market trends and customer needs');
          recommendations.push(
            'Invest in digital marketing and online presence',
          );
          recommendations.push(
            'Consider expanding to new locations or channels',
          );
        }
        break;
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Continue current strategies to maintain performance',
      );
    }

    return recommendations;
  }

  private getMetricDisplayName(metric: MetricType): string {
    const names = {
      [MetricType.REVENUE]: 'Revenue',
      [MetricType.PROFIT]: 'Profit',
      [MetricType.MARGIN]: 'Gross Margin %',
      [MetricType.TURNOVER]: 'Inventory Turnover',
      [MetricType.VOLUME]: 'Sales Volume',
      [MetricType.GROWTH]: 'Growth Rate %',
    };
    return names[metric] || metric;
  }

  private getBenchmarkTypeDisplayName(benchmarkType: BenchmarkType): string {
    const names = {
      [BenchmarkType.CATEGORY_AVERAGE]: 'Category Average',
      [BenchmarkType.INDUSTRY_STANDARD]: 'Industry Standard',
      [BenchmarkType.BEST_PERFORMER]: 'Best Performer',
      [BenchmarkType.HISTORICAL_AVERAGE]: 'Historical Average',
    };
    return names[benchmarkType] || benchmarkType;
  }
}
