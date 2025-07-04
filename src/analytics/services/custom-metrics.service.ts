import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';

import {
  CustomMetricQueryDto,
  MetricType,
  TimeGranularity,
} from '../dto/analytics-query.dto';

import {
  CustomMetricResponseDto,
  CustomMetricResultDto,
  AnalyticsMetaDto,
} from '../dto/analytics-response.dto';

export interface CustomMetricDefinition {
  id: string;
  name: string;
  description: string;
  type: MetricType;
  formula: string;
  parameters: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CustomMetricsService {
  private readonly logger = new Logger(CustomMetricsService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Calculate custom metric based on user-defined formula
   */
  async calculateCustomMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Calculating custom metric '${query.metricName}' for tenant ${tenantId}`,
      );

      // Validate metric type and formula
      this.validateMetricQuery(query);

      let result: CustomMetricResultDto;

      // Route to appropriate calculation method based on metric type
      switch (query.metricType) {
        case MetricType.REVENUE:
          result = await this.calculateRevenueMetric(tenantId, query);
          break;
        case MetricType.PROFIT:
          result = await this.calculateProfitMetric(tenantId, query);
          break;
        case MetricType.VOLUME:
          result = await this.calculateVolumeMetric(tenantId, query);
          break;
        case MetricType.TURNOVER:
          result = await this.calculateTurnoverMetric(tenantId, query);
          break;
        case MetricType.MARGIN:
          result = await this.calculateMarginMetric(tenantId, query);
          break;
        case MetricType.GROWTH:
          result = await this.calculateGrowthMetric(tenantId, query);
          break;
        default:
          throw new BadRequestException(
            `Unsupported metric type: ${query.metricType}`,
          );
      }

      // Generate insights if possible
      const insights = await this.generateMetricInsights(
        tenantId,
        query,
        result,
      );

      const meta: AnalyticsMetaDto = {
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1,
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: result,
        meta,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate custom metric: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to calculate custom metric: ${error.message}`,
      );
    }
  }

  /**
   * Calculate revenue-based custom metric
   */
  private async calculateRevenueMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResultDto> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    let queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .leftJoinAndSelect('transaction.location', 'location')
      .leftJoinAndSelect('product.category', 'category')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    // Apply custom filters
    if (query.additionalFilters) {
      queryBuilder = this.applyCustomFilters(
        queryBuilder,
        query.additionalFilters,
      );
    }

    // Use custom formula or default calculation
    let selectClause: string;
    if (query.customFormula) {
      selectClause = this.parseCustomFormula(query.customFormula, 'revenue');
    } else {
      selectClause = 'SUM(transaction.quantity * transaction.unitCost)';
    }

    const result = await queryBuilder
      .select(selectClause, 'metricValue')
      .getRawOne();

    const value = Number(result?.metricValue) || 0;

    // Calculate breakdown by dimensions
    const breakdown = await this.calculateRevenueBreakdown(
      tenantId,
      query,
      startDate,
      endDate,
    );

    // Get historical data
    const historical = await this.getHistoricalRevenueData(
      tenantId,
      query,
      startDate,
      endDate,
    );

    return {
      metricName: query.metricName,
      value,
      metricType: query.metricType,
      calculatedAt: new Date().toISOString(),
      breakdown,
      historical,
    };
  }

  /**
   * Calculate profit-based custom metric
   */
  private async calculateProfitMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResultDto> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    let queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .leftJoinAndSelect('transaction.location', 'location')
      .leftJoinAndSelect('product.category', 'category')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    // Apply custom filters
    if (query.additionalFilters) {
      queryBuilder = this.applyCustomFilters(
        queryBuilder,
        query.additionalFilters,
      );
    }

    // Calculate profit (Revenue - COGS)
    let selectClause: string;
    if (query.customFormula) {
      selectClause = this.parseCustomFormula(query.customFormula, 'profit');
    } else {
      selectClause =
        'SUM(transaction.quantity * (transaction.unitCost - product.costPrice))';
    }

    const result = await queryBuilder
      .select(selectClause, 'metricValue')
      .getRawOne();

    const value = Number(result?.metricValue) || 0;

    // Calculate breakdown and historical data
    const breakdown = await this.calculateProfitBreakdown(
      tenantId,
      query,
      startDate,
      endDate,
    );
    const historical = await this.getHistoricalProfitData(
      tenantId,
      query,
      startDate,
      endDate,
    );

    return {
      metricName: query.metricName,
      value,
      metricType: query.metricType,
      calculatedAt: new Date().toISOString(),
      breakdown,
      historical,
    };
  }

  /**
   * Calculate volume-based custom metric
   */
  private async calculateVolumeMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResultDto> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    let queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .leftJoinAndSelect('transaction.location', 'location')
      .leftJoinAndSelect('product.category', 'category')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    // Apply custom filters
    if (query.additionalFilters) {
      queryBuilder = this.applyCustomFilters(
        queryBuilder,
        query.additionalFilters,
      );
    }

    // Calculate volume
    let selectClause: string;
    if (query.customFormula) {
      selectClause = this.parseCustomFormula(query.customFormula, 'volume');
    } else {
      selectClause = 'SUM(transaction.quantity)';
    }

    const result = await queryBuilder
      .select(selectClause, 'metricValue')
      .getRawOne();

    const value = Number(result?.metricValue) || 0;

    // Calculate breakdown and historical data
    const breakdown = await this.calculateVolumeBreakdown(
      tenantId,
      query,
      startDate,
      endDate,
    );
    const historical = await this.getHistoricalVolumeData(
      tenantId,
      query,
      startDate,
      endDate,
    );

    return {
      metricName: query.metricName,
      value,
      metricType: query.metricType,
      calculatedAt: new Date().toISOString(),
      breakdown,
      historical,
    };
  }

  /**
   * Calculate turnover-based custom metric
   */
  private async calculateTurnoverMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResultDto> {
    // Inventory turnover = COGS / Average Inventory Value
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Calculate COGS
    const cogsResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select('SUM(transaction.quantity * product.costPrice)', 'totalCogs')
      .getRawOne();

    // Calculate Average Inventory Value
    const avgInventoryResult = await this.inventoryItemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.isActive = true')
      .select('AVG(item.totalValue)', 'avgInventoryValue')
      .getRawOne();

    const cogs = Number(cogsResult?.totalCogs) || 0;
    const avgInventory = Number(avgInventoryResult?.avgInventoryValue) || 0;

    const value = avgInventory > 0 ? cogs / avgInventory : 0;

    return {
      metricName: query.metricName,
      value,
      metricType: query.metricType,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate margin-based custom metric
   */
  private async calculateMarginMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResultDto> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate both revenue and profit to get margin
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', { saleType: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select([
        'SUM(transaction.quantity * transaction.unitCost) as totalRevenue',
        'SUM(transaction.quantity * (transaction.unitCost - product.costPrice)) as totalProfit',
      ])
      .getRawOne();

    const revenue = Number(result?.totalRevenue) || 0;
    const profit = Number(result?.totalProfit) || 0;

    // Margin = (Profit / Revenue) * 100
    const value = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      metricName: query.metricName,
      value,
      metricType: query.metricType,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate growth-based custom metric
   */
  private async calculateGrowthMetric(
    tenantId: string,
    query: CustomMetricQueryDto,
  ): Promise<CustomMetricResultDto> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Calculate current period and previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    // Current period revenue
    const currentResult = await this.transactionRepository
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

    // Previous period revenue
    const previousResult = await this.transactionRepository
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

    const currentRevenue = Number(currentResult?.totalRevenue) || 0;
    const previousRevenue = Number(previousResult?.totalRevenue) || 0;

    // Growth = ((Current - Previous) / Previous) * 100
    const value =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

    return {
      metricName: query.metricName,
      value,
      metricType: query.metricType,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate insights for the calculated metric
   */
  private async generateMetricInsights(
    tenantId: string,
    query: CustomMetricQueryDto,
    result: CustomMetricResultDto,
  ): Promise<any> {
    const insights = {
      trend: 'stable' as 'increasing' | 'decreasing' | 'stable',
      seasonality: false,
      anomalies: [] as Array<{
        date: string;
        expectedValue: number;
        actualValue: number;
        deviation: number;
      }>,
      recommendations: [] as string[],
    };

    // Analyze trend from historical data
    if (result.historical && result.historical.length > 1) {
      const values = result.historical.map(h => h.value);
      const trend = this.analyzeTrend(values);
      insights.trend = trend;
    }

    // Generate recommendations based on metric type and value
    switch (query.metricType) {
      case MetricType.REVENUE:
        if (result.value < 1000000) {
          // Less than 1M IDR
          insights.recommendations.push(
            'Consider implementing promotional campaigns to boost revenue',
          );
        }
        break;
      case MetricType.MARGIN:
        if (result.value < 20) {
          // Less than 20% margin
          insights.recommendations.push(
            'Review pricing strategy to improve profit margins',
          );
          insights.recommendations.push(
            'Analyze cost structure for optimization opportunities',
          );
        }
        break;
      case MetricType.TURNOVER:
        if (result.value < 2) {
          // Less than 2x turnover per year
          insights.recommendations.push(
            'Improve inventory management to increase turnover',
          );
          insights.recommendations.push(
            'Consider reducing slow-moving inventory',
          );
        }
        break;
    }

    return insights;
  }

  // Helper methods

  private validateMetricQuery(query: CustomMetricQueryDto): void {
    if (!query.metricName || query.metricName.trim().length === 0) {
      throw new BadRequestException('Metric name is required');
    }

    if (!Object.values(MetricType).includes(query.metricType)) {
      throw new BadRequestException('Invalid metric type');
    }

    // Validate custom formula if provided
    if (query.customFormula) {
      this.validateCustomFormula(query.customFormula);
    }
  }

  private validateCustomFormula(formula: string): void {
    // Basic validation for SQL injection prevention
    const forbiddenKeywords = [
      'DELETE',
      'DROP',
      'INSERT',
      'UPDATE',
      'CREATE',
      'ALTER',
    ];
    const upperFormula = formula.toUpperCase();

    for (const keyword of forbiddenKeywords) {
      if (upperFormula.includes(keyword)) {
        throw new BadRequestException(
          `Formula contains forbidden keyword: ${keyword}`,
        );
      }
    }

    // Additional validation can be added here
  }

  private parseCustomFormula(formula: string, metricType: string): string {
    // Simple formula parser - in production, use a proper SQL parser
    // Replace placeholders with actual column names
    const parsedFormula = formula
      .replace(/\{revenue\}/g, 'transaction.quantity * transaction.unitCost')
      .replace(/\{quantity\}/g, 'transaction.quantity')
      .replace(/\{price\}/g, 'transaction.unitCost')
      .replace(/\{cost\}/g, 'product.costPrice');

    return parsedFormula;
  }

  private applyCustomFilters(
    queryBuilder: SelectQueryBuilder<any>,
    filters: Record<string, any>,
  ): SelectQueryBuilder<any> {
    for (const [key, value] of Object.entries(filters)) {
      switch (key) {
        case 'categoryId':
          queryBuilder.andWhere('category.id = :categoryId', {
            categoryId: value,
          });
          break;
        case 'locationId':
          queryBuilder.andWhere('location.id = :locationId', {
            locationId: value,
          });
          break;
        case 'productIds':
          if (Array.isArray(value) && value.length > 0) {
            queryBuilder.andWhere('product.id IN (:...productIds)', {
              productIds: value,
            });
          }
          break;
        // Add more filter types as needed
      }
    }
    return queryBuilder;
  }

  private async calculateRevenueBreakdown(
    tenantId: string,
    query: CustomMetricQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ dimension: string; value: number; percentage: number }>> {
    // Implementation for revenue breakdown by category, location, etc.
    return [];
  }

  private async getHistoricalRevenueData(
    tenantId: string,
    query: CustomMetricQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ period: string; value: number }>> {
    // Implementation for historical revenue data
    return [];
  }

  private async calculateProfitBreakdown(
    tenantId: string,
    query: CustomMetricQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ dimension: string; value: number; percentage: number }>> {
    // Implementation for profit breakdown
    return [];
  }

  private async getHistoricalProfitData(
    tenantId: string,
    query: CustomMetricQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ period: string; value: number }>> {
    // Implementation for historical profit data
    return [];
  }

  private async calculateVolumeBreakdown(
    tenantId: string,
    query: CustomMetricQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ dimension: string; value: number; percentage: number }>> {
    // Implementation for volume breakdown
    return [];
  }

  private async getHistoricalVolumeData(
    tenantId: string,
    query: CustomMetricQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ period: string; value: number }>> {
    // Implementation for historical volume data
    return [];
  }

  private analyzeTrend(
    values: number[],
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const changePercent = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent < 5) return 'stable';
    return secondAvg > firstAvg ? 'increasing' : 'decreasing';
  }
}
