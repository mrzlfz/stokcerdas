import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, SelectQueryBuilder } from 'typeorm';

import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import {
  InventoryTransaction,
  TransactionType,
} from '../../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { Product } from '../../products/entities/product.entity';

import {
  BaseAnalyticsQueryDto,
  RevenueAnalyticsQueryDto,
  InventoryTurnoverQueryDto,
  ProductPerformanceQueryDto,
  CustomerInsightsQueryDto,
  DashboardMetricsQueryDto,
  TimeGranularity,
} from '../dto/analytics-query.dto';

import {
  RevenueAnalyticsResponseDto,
  RevenueBreakdownDto,
  InventoryTurnoverResponseDto,
  InventoryTurnoverItemDto,
  ProductPerformanceResponseDto,
  ProductPerformanceItemDto,
  CustomerInsightsResponseDto,
  CustomerSegmentDto,
  DashboardMetricsResponseDto,
  DashboardKPIDto,
  AnalyticsMetaDto,
  TrendDataDto,
  ComparisonDataDto,
  KPIAlertDto,
} from '../dto/analytics-response.dto';

@Injectable()
export class BusinessIntelligenceService {
  private readonly logger = new Logger(BusinessIntelligenceService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Generate Revenue Analytics Report
   */
  async generateRevenueAnalytics(
    tenantId: string,
    query: RevenueAnalyticsQueryDto,
  ): Promise<RevenueAnalyticsResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Generating revenue analytics for tenant ${tenantId}`);

      // Set default date range if not provided
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days back

      // Build base query for sales transactions
      const queryBuilder = this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoinAndSelect('transaction.product', 'product')
        .leftJoinAndSelect('transaction.location', 'location')
        .leftJoinAndSelect('product.category', 'category')
        .where('transaction.tenantId = :tenantId', { tenantId })
        .andWhere('transaction.type = :saleType', {
          saleType: TransactionType.SALE,
        })
        .andWhere(
          'transaction.transactionDate BETWEEN :startDate AND :endDate',
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        );

      // Apply common filters
      this.applyCommonFilters(queryBuilder, query, 'transaction');

      // Group data by time granularity
      const groupByClause = this.getTimeGroupByClause(query.granularity);

      const revenueData = await queryBuilder
        .select([
          `${groupByClause} as period`,
          'SUM(transaction.quantity * transaction.unitCost) as totalRevenue',
          "SUM(CASE WHEN transaction.metadata->>'discount' IS NOT NULL THEN (transaction.metadata->>'discount')::numeric ELSE 0 END) as totalDiscounts",
          "SUM(CASE WHEN transaction.metadata->>'tax' IS NOT NULL THEN (transaction.metadata->>'tax')::numeric ELSE 0 END) as totalTax",
          'COUNT(DISTINCT transaction.id) as transactionCount',
          'COUNT(DISTINCT transaction.referenceNumber) as orderCount',
          'AVG(transaction.quantity * transaction.unitCost) as averageOrderValue',
        ])
        .groupBy(groupByClause)
        .orderBy(groupByClause, 'ASC')
        .getRawMany();

      // Calculate COGS if requested
      let cogsData: any[] = [];
      if (query.includeCOGS) {
        cogsData = await this.calculateCOGS(
          tenantId,
          startDate,
          endDate,
          query.granularity,
        );
      }

      // Transform data to response format
      const data: RevenueBreakdownDto[] = revenueData.map((item, index) => {
        const cogs = cogsData[index]?.totalCogs || 0;
        const totalRevenue = Number(item.totalRevenue) || 0;
        const totalDiscounts = Number(item.totalDiscounts) || 0;
        const netRevenue = totalRevenue - totalDiscounts;
        const grossProfit = netRevenue - cogs;
        const grossProfitMargin =
          netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

        return {
          period: item.period,
          totalRevenue,
          grossRevenue: totalRevenue,
          netRevenue,
          cogs,
          grossProfit,
          grossProfitMargin,
          totalDiscounts,
          totalTax: Number(item.totalTax) || 0,
          transactionCount: Number(item.transactionCount) || 0,
          averageOrderValue: Number(item.averageOrderValue) || 0,
        };
      });

      // Calculate summary metrics
      const summary = this.calculateRevenueSummary(data);

      // Generate trend data
      const trends = this.generateTrendData(data, 'totalRevenue');

      // Generate comparison data if requested
      let comparison: ComparisonDataDto | undefined;
      if (query.includeComparison) {
        comparison = await this.generateRevenueComparison(
          tenantId,
          query,
          startDate,
          endDate,
        );
      }

      // Generate alerts
      const alerts = this.generateRevenueAlerts(data, summary);

      const meta: AnalyticsMetaDto = {
        total: data.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(data.length / (query.limit || 50)),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data,
        meta,
        summary,
        trends,
        comparison,
        alerts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate revenue analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate revenue analytics: ${error.message}`,
      );
    }
  }

  /**
   * Generate Inventory Turnover Analysis
   */
  async generateInventoryTurnoverAnalysis(
    tenantId: string,
    query: InventoryTurnoverQueryDto,
  ): Promise<InventoryTurnoverResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Generating inventory turnover analysis for tenant ${tenantId}`,
      );

      // Set default date range
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year back

      // Build complex query for inventory turnover calculation
      const queryBuilder = this.inventoryItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .leftJoinAndSelect('item.location', 'location')
        .leftJoinAndSelect('product.category', 'category')
        .leftJoin(
          'item.transactions',
          'transaction',
          'transaction.type = :saleType AND transaction.transactionDate BETWEEN :startDate AND :endDate',
          {
            saleType: TransactionType.SALE,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        )
        .where('item.tenantId = :tenantId', { tenantId })
        .andWhere('item.isActive = true');

      // Apply common filters
      this.applyCommonFilters(queryBuilder, query, 'item');

      // Calculate turnover metrics using SQL
      const turnoverData = await queryBuilder
        .select([
          'product.id as productId',
          'product.sku as sku',
          'product.name as productName',
          'category.name as category',
          'item.quantityOnHand as currentStockLevel',
          'AVG(item.totalValue / NULLIF(item.quantityOnHand, 0)) as averageCost',
          "SUM(CASE WHEN transaction.type = 'sale' THEN transaction.quantity ELSE 0 END) as totalUnitsSold",
          "SUM(CASE WHEN transaction.type = 'sale' THEN transaction.quantity * transaction.unitCost ELSE 0 END) as totalCOGS",
          'AVG(item.totalValue) as averageInventoryValue',
          'MAX(transaction.transactionDate) as lastSaleDate',
          'EXTRACT(days FROM AGE(NOW(), MIN(item.createdAt))) as inventoryAge',
        ])
        .groupBy(
          'product.id, product.sku, product.name, category.name, item.quantityOnHand',
        )
        .having(
          "SUM(CASE WHEN transaction.type = 'sale' THEN transaction.quantity ELSE 0 END) > 0",
        ) // Only products with sales
        .getRawMany();

      // Transform data and calculate additional metrics
      const data: InventoryTurnoverItemDto[] = turnoverData.map(item => {
        const totalUnitsSold = Number(item.totalUnitsSold) || 0;
        const averageInventoryValue = Number(item.averageInventoryValue) || 0;
        const totalCOGS = Number(item.totalCOGS) || 0;

        // Calculate turnover ratio: COGS / Average Inventory Value
        const turnoverRatio =
          averageInventoryValue > 0 ? totalCOGS / averageInventoryValue : 0;

        // Calculate days in inventory: 365 / Turnover Ratio
        const daysInInventory = turnoverRatio > 0 ? 365 / turnoverRatio : 365;

        // Calculate sales velocity: Units sold / Days in period
        const periodDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const salesVelocity = totalUnitsSold / periodDays;

        // Classify stock status
        const stockStatus = this.classifyStockStatus(
          turnoverRatio,
          query.fastMovingThreshold || 4,
          query.slowMovingThreshold || 1,
        );

        // Generate recommendation
        const recommendation = this.generateStockRecommendation(
          turnoverRatio,
          Number(item.currentStockLevel),
          salesVelocity,
        );

        return {
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          category: item.category,
          averageInventoryValue,
          cogs: totalCOGS,
          turnoverRatio,
          daysInInventory,
          currentStockLevel: Number(item.currentStockLevel),
          stockStatus,
          totalUnitsSold,
          salesVelocity,
          inventoryAge: Number(item.inventoryAge) || 0,
          lastSaleDate: item.lastSaleDate,
          recommendation,
        };
      });

      // Apply pagination
      const offset = (query.page - 1) * query.limit;
      const paginatedData = data.slice(offset, offset + query.limit);

      // Calculate summary metrics
      const summary = this.calculateTurnoverSummary(data);

      // Generate trend data
      const trends = this.generateTurnoverTrends(
        tenantId,
        startDate,
        endDate,
        query.granularity,
      );

      // Generate comparison data if requested
      let comparison: ComparisonDataDto | undefined;
      if (query.includeComparison) {
        comparison = await this.generateTurnoverComparison(
          tenantId,
          query,
          startDate,
          endDate,
        );
      }

      // Generate alerts
      const alerts = this.generateTurnoverAlerts(data, summary);

      const meta: AnalyticsMetaDto = {
        total: data.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(data.length / (query.limit || 50)),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: paginatedData,
        meta,
        summary,
        trends: await trends,
        comparison,
        alerts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate inventory turnover analysis: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate inventory turnover analysis: ${error.message}`,
      );
    }
  }

  /**
   * Generate Product Performance Analytics
   */
  async generateProductPerformanceAnalytics(
    tenantId: string,
    query: ProductPerformanceQueryDto,
  ): Promise<ProductPerformanceResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Generating product performance analytics for tenant ${tenantId}`,
      );

      // Set default date range
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days back

      // Build comprehensive product performance query
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .leftJoin('product.inventoryItems', 'item')
        .leftJoin(
          'item.transactions',
          'transaction',
          'transaction.type = :saleType AND transaction.transactionDate BETWEEN :startDate AND :endDate',
          {
            saleType: TransactionType.SALE,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        )
        .where('product.tenantId = :tenantId', { tenantId })
        .andWhere('product.status = :activeStatus', { activeStatus: 'active' });

      // Apply common filters
      this.applyCommonFilters(queryBuilder, query, 'product');

      // Calculate comprehensive performance metrics
      const performanceData = await queryBuilder
        .select([
          'product.id as productId',
          'product.sku as sku',
          'product.name as productName',
          'category.name as category',
          'SUM(transaction.quantity) as totalUnitsSold',
          'SUM(transaction.quantity * transaction.unitCost) as totalRevenue',
          'SUM(transaction.quantity * (transaction.unitCost - product.costPrice)) as totalProfit',
          'AVG(transaction.unitCost) as averageSellingPrice',
          'COUNT(DISTINCT transaction.id) as transactionCount',
          'SUM(item.quantityOnHand) as currentStockLevel',
          'SUM(item.totalValue) as currentInventoryValue',
          'MIN(transaction.transactionDate) as firstSaleDate',
          'MAX(transaction.transactionDate) as lastSaleDate',
        ])
        .groupBy(
          'product.id, product.sku, product.name, category.name, product.costPrice',
        )
        .having('SUM(transaction.quantity) >= :minSalesVolume', {
          minSalesVolume: query.minSalesVolume || 1,
        })
        .getRawMany();

      // Calculate additional performance metrics and rankings
      const totalRevenue = performanceData.reduce(
        (sum, item) => sum + (Number(item.totalRevenue) || 0),
        0,
      );

      const data: ProductPerformanceItemDto[] = performanceData
        .map((item, index) => {
          const revenue = Number(item.totalRevenue) || 0;
          const profit = Number(item.totalProfit) || 0;
          const unitsSold = Number(item.totalUnitsSold) || 0;
          const inventoryValue = Number(item.currentInventoryValue) || 0;

          // Calculate metrics
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          const revenueContribution =
            totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
          const inventoryTurnover =
            inventoryValue > 0 ? revenue / inventoryValue : 0;

          // Calculate performance score (weighted combination of metrics)
          const performanceScore = this.calculatePerformanceScore(
            revenueContribution,
            profitMargin,
            inventoryTurnover,
            unitsSold,
          );

          return {
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            category: item.category,
            totalRevenue: revenue,
            totalUnitsSold: unitsSold,
            totalProfit: profit,
            profitMargin,
            averageSellingPrice: Number(item.averageSellingPrice) || 0,
            inventoryTurnover,
            abcClassification: 'A' as 'A' | 'B' | 'C', // Will be calculated after sorting
            performanceScore,
            performanceRank: index + 1, // Will be updated after sorting
            revenueContribution,
            growthRate: 0, // Will be calculated with historical data
            currentStockLevel: Number(item.currentStockLevel) || 0,
            recommendation: 'maintain' as
              | 'promote'
              | 'maintain'
              | 'review_pricing'
              | 'discontinue', // Will be determined based on performance
          };
        })
        .sort((a, b) => b.performanceScore - a.performanceScore); // Sort by performance score

      // Apply ABC Classification (80/20 rule)
      if (query.includeABCAnalysis) {
        this.applyABCClassification(data);
      }

      // Update rankings after sorting
      data.forEach((item, index) => {
        item.performanceRank = index + 1;
        item.recommendation = this.generatePerformanceRecommendation(item);
      });

      // Apply pagination
      const offset = (query.page - 1) * query.limit;
      const paginatedData = data.slice(offset, offset + query.limit);

      // Calculate summary metrics
      const summary = this.calculatePerformanceSummary(data);

      // Generate trend data
      const trends = this.generatePerformanceTrends(
        tenantId,
        startDate,
        endDate,
        query.granularity,
      );

      // Generate comparison data if requested
      let comparison: ComparisonDataDto | undefined;
      if (query.includeComparison) {
        comparison = await this.generatePerformanceComparison(
          tenantId,
          query,
          startDate,
          endDate,
        );
      }

      // Generate alerts
      const alerts = this.generatePerformanceAlerts(data, summary);

      const meta: AnalyticsMetaDto = {
        total: data.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(data.length / (query.limit || 50)),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: paginatedData,
        meta,
        summary,
        trends: await trends,
        comparison,
        alerts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate product performance analytics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate product performance analytics: ${error.message}`,
      );
    }
  }

  /**
   * Generate Dashboard Metrics
   */
  async generateDashboardMetrics(
    tenantId: string,
    query: DashboardMetricsQueryDto,
  ): Promise<DashboardMetricsResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Generating dashboard metrics for tenant ${tenantId}`);

      const kpis: DashboardKPIDto[] = [];

      // Revenue KPIs
      const revenueKPIs = await this.calculateRevenueKPIs(tenantId, query);
      kpis.push(...revenueKPIs);

      // Inventory KPIs
      const inventoryKPIs = await this.calculateInventoryKPIs(tenantId, query);
      kpis.push(...inventoryKPIs);

      // Product KPIs
      const productKPIs = await this.calculateProductKPIs(tenantId, query);
      kpis.push(...productKPIs);

      // Operational KPIs
      const operationalKPIs = await this.calculateOperationalKPIs(
        tenantId,
        query,
      );
      kpis.push(...operationalKPIs);

      // Calculate overall dashboard score
      const overallScore = this.calculateOverallScore(kpis);

      // Generate critical alerts
      const alerts = this.generateCriticalAlerts(kpis);

      // Calculate summary metrics
      const summary = {
        overallScore,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        improvingMetrics: kpis.filter(k => k.trend === 'up').length,
        decliningMetrics: kpis.filter(k => k.trend === 'down').length,
        lastUpdated: new Date().toISOString(),
      };

      // Real-time metrics
      let realTimeMetrics;
      if (query.includeRealTime) {
        realTimeMetrics = await this.calculateRealTimeMetrics(tenantId);
      }

      const meta: AnalyticsMetaDto = {
        total: kpis.length,
        page: 1,
        limit: kpis.length,
        totalPages: 1,
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: kpis,
        meta,
        summary,
        alerts,
        realTimeMetrics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate dashboard metrics: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate dashboard metrics: ${error.message}`,
      );
    }
  }

  // Helper methods

  private applyCommonFilters(
    queryBuilder: SelectQueryBuilder<any>,
    query: BaseAnalyticsQueryDto,
    alias: string,
  ): void {
    if (query.locationIds?.length) {
      queryBuilder.andWhere(`${alias}.locationId IN (:...locationIds)`, {
        locationIds: query.locationIds,
      });
    }

    if (query.productIds?.length) {
      queryBuilder.andWhere(`${alias}.productId IN (:...productIds)`, {
        productIds: query.productIds,
      });
    }

    if (query.categoryIds?.length) {
      queryBuilder.andWhere(`category.id IN (:...categoryIds)`, {
        categoryIds: query.categoryIds,
      });
    }
  }

  private getTimeGroupByClause(granularity: TimeGranularity): string {
    switch (granularity) {
      case TimeGranularity.DAILY:
        return 'DATE(transaction.transactionDate)';
      case TimeGranularity.WEEKLY:
        return "DATE_TRUNC('week', transaction.transactionDate)";
      case TimeGranularity.MONTHLY:
        return "DATE_TRUNC('month', transaction.transactionDate)";
      case TimeGranularity.QUARTERLY:
        return "DATE_TRUNC('quarter', transaction.transactionDate)";
      case TimeGranularity.YEARLY:
        return "DATE_TRUNC('year', transaction.transactionDate)";
      default:
        return "DATE_TRUNC('month', transaction.transactionDate)";
    }
  }

  private calculateRevenueSummary(data: RevenueBreakdownDto[]) {
    const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalGrossProfit = data.reduce(
      (sum, item) => sum + item.grossProfit,
      0,
    );
    const averageGrossProfitMargin =
      data.length > 0
        ? data.reduce((sum, item) => sum + item.grossProfitMargin, 0) /
          data.length
        : 0;

    const revenueValues = data.map(item => item.totalRevenue);
    const bestPerformingPeriod =
      data[revenueValues.indexOf(Math.max(...revenueValues))]?.period || '';
    const worstPerformingPeriod =
      data[revenueValues.indexOf(Math.min(...revenueValues))]?.period || '';

    return {
      totalRevenue,
      totalGrossProfit,
      averageGrossProfitMargin,
      revenueGrowth: this.calculateGrowthRate(data, 'totalRevenue'),
      profitGrowth: this.calculateGrowthRate(data, 'grossProfit'),
      bestPerformingPeriod,
      worstPerformingPeriod,
    };
  }

  private generateTrendData(data: any[], valueField: string): TrendDataDto[] {
    return data.map((item, index) => {
      const currentValue = item[valueField];
      const previousValue =
        index > 0 ? data[index - 1][valueField] : currentValue;
      const change = currentValue - previousValue;
      const changePercent =
        previousValue > 0 ? (change / previousValue) * 100 : 0;

      return {
        period: item.period,
        value: currentValue,
        change,
        changePercent,
        periodStart: item.period, // This should be calculated based on granularity
        periodEnd: item.period, // This should be calculated based on granularity
      };
    });
  }

  private calculateGrowthRate(data: any[], field: string): number {
    if (data.length < 2) return 0;

    const firstValue = data[0][field];
    const lastValue = data[data.length - 1][field];

    return firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  }

  private classifyStockStatus(
    turnoverRatio: number,
    fastThreshold: number,
    slowThreshold: number,
  ): 'fast_moving' | 'normal' | 'slow_moving' | 'dead_stock' {
    if (turnoverRatio >= fastThreshold) return 'fast_moving';
    if (turnoverRatio <= 0.1) return 'dead_stock';
    if (turnoverRatio <= slowThreshold) return 'slow_moving';
    return 'normal';
  }

  private generateStockRecommendation(
    turnoverRatio: number,
    currentStock: number,
    salesVelocity: number,
  ): 'increase_stock' | 'reduce_stock' | 'maintain' | 'discontinue' {
    if (turnoverRatio <= 0.1) return 'discontinue';
    if (turnoverRatio >= 6 && currentStock < salesVelocity * 30)
      return 'increase_stock';
    if (turnoverRatio <= 1 && currentStock > salesVelocity * 90)
      return 'reduce_stock';
    return 'maintain';
  }

  private calculatePerformanceScore(
    revenueContribution: number,
    profitMargin: number,
    inventoryTurnover: number,
    unitsSold: number,
  ): number {
    // Weighted performance score calculation
    const revenueWeight = 0.4;
    const profitWeight = 0.3;
    const turnoverWeight = 0.2;
    const volumeWeight = 0.1;

    const revenueScore = Math.min(revenueContribution * 10, 100); // Scale to 100
    const profitScore = Math.min(profitMargin, 100);
    const turnoverScore = Math.min(inventoryTurnover * 20, 100);
    const volumeScore = Math.min(Math.log(unitsSold + 1) * 20, 100);

    return (
      revenueScore * revenueWeight +
      profitScore * profitWeight +
      turnoverScore * turnoverWeight +
      volumeScore * volumeWeight
    );
  }

  private applyABCClassification(data: ProductPerformanceItemDto[]): void {
    // Sort by revenue contribution descending
    data.sort((a, b) => b.revenueContribution - a.revenueContribution);

    let cumulativeRevenue = 0;
    const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);

    data.forEach(item => {
      cumulativeRevenue += item.totalRevenue;
      const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;

      if (cumulativePercent <= 80) {
        item.abcClassification = 'A' as 'A' | 'B' | 'C';
      } else if (cumulativePercent <= 95) {
        item.abcClassification = 'B' as 'A' | 'B' | 'C';
      } else {
        item.abcClassification = 'C' as 'A' | 'B' | 'C';
      }
    });
  }

  private generatePerformanceRecommendation(
    item: ProductPerformanceItemDto,
  ): 'promote' | 'maintain' | 'review_pricing' | 'discontinue' {
    if (item.performanceScore >= 80) return 'promote';
    if (item.performanceScore <= 30) return 'discontinue';
    if (item.profitMargin < 10) return 'review_pricing';
    return 'maintain';
  }

  // Placeholder methods for complex calculations
  private async calculateCOGS(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity,
  ): Promise<any[]> {
    // Implementation for COGS calculation
    return [];
  }

  private async generateRevenueComparison(
    tenantId: string,
    query: RevenueAnalyticsQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<ComparisonDataDto> {
    // Implementation for revenue comparison
    return {
      current: 0,
      previous: 0,
      change: 0,
      changePercent: 0,
      trend: 'stable',
      comparisonPeriod: 'Previous Period',
    };
  }

  private generateRevenueAlerts(
    data: RevenueBreakdownDto[],
    summary: any,
  ): KPIAlertDto[] {
    // Implementation for revenue alerts
    return [];
  }

  private calculateTurnoverSummary(data: InventoryTurnoverItemDto[]) {
    // Implementation for turnover summary
    return {
      averageTurnoverRatio: 0,
      averageDaysInInventory: 0,
      fastMovingItems: 0,
      slowMovingItems: 0,
      deadStockItems: 0,
      totalInventoryValue: 0,
      turnoverImprovement: 0,
      topPerformingCategory: '',
      underperformingCategories: [],
    };
  }

  private async generateTurnoverTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity,
  ): Promise<TrendDataDto[]> {
    // Implementation for turnover trends
    return [];
  }

  private async generateTurnoverComparison(
    tenantId: string,
    query: InventoryTurnoverQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<ComparisonDataDto> {
    // Implementation for turnover comparison
    return {
      current: 0,
      previous: 0,
      change: 0,
      changePercent: 0,
      trend: 'stable',
      comparisonPeriod: 'Previous Period',
    };
  }

  private generateTurnoverAlerts(
    data: InventoryTurnoverItemDto[],
    summary: any,
  ): KPIAlertDto[] {
    // Implementation for turnover alerts
    return [];
  }

  private calculatePerformanceSummary(data: ProductPerformanceItemDto[]) {
    // Implementation for performance summary
    return {
      totalProducts: data.length,
      topPerformers: data.filter(p => p.abcClassification === 'A').length,
      mediumPerformers: data.filter(p => p.abcClassification === 'B').length,
      underperformers: data.filter(p => p.abcClassification === 'C').length,
      averagePerformanceScore:
        data.reduce((sum, p) => sum + p.performanceScore, 0) / data.length,
      totalRevenue: data.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalProfit: data.reduce((sum, p) => sum + p.totalProfit, 0),
      averageProfitMargin:
        data.reduce((sum, p) => sum + p.profitMargin, 0) / data.length,
      topRevenueProduct: data[0]?.productName || '',
      topProfitProduct:
        data.sort((a, b) => b.totalProfit - a.totalProfit)[0]?.productName ||
        '',
      fastestGrowingProduct:
        data.sort((a, b) => b.growthRate - a.growthRate)[0]?.productName || '',
    };
  }

  private async generatePerformanceTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    granularity: TimeGranularity,
  ): Promise<TrendDataDto[]> {
    // Implementation for performance trends
    return [];
  }

  private async generatePerformanceComparison(
    tenantId: string,
    query: ProductPerformanceQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<ComparisonDataDto> {
    // Implementation for performance comparison
    return {
      current: 0,
      previous: 0,
      change: 0,
      changePercent: 0,
      trend: 'stable',
      comparisonPeriod: 'Previous Period',
    };
  }

  private generatePerformanceAlerts(
    data: ProductPerformanceItemDto[],
    summary: any,
  ): KPIAlertDto[] {
    // Implementation for performance alerts
    return [];
  }

  private async calculateRevenueKPIs(
    tenantId: string,
    query: DashboardMetricsQueryDto,
  ): Promise<DashboardKPIDto[]> {
    // Implementation for revenue KPIs
    return [];
  }

  private async calculateInventoryKPIs(
    tenantId: string,
    query: DashboardMetricsQueryDto,
  ): Promise<DashboardKPIDto[]> {
    // Implementation for inventory KPIs
    return [];
  }

  private async calculateProductKPIs(
    tenantId: string,
    query: DashboardMetricsQueryDto,
  ): Promise<DashboardKPIDto[]> {
    // Implementation for product KPIs
    return [];
  }

  private async calculateOperationalKPIs(
    tenantId: string,
    query: DashboardMetricsQueryDto,
  ): Promise<DashboardKPIDto[]> {
    // Implementation for operational KPIs
    return [];
  }

  private calculateOverallScore(kpis: DashboardKPIDto[]): number {
    // Implementation for overall score calculation
    return 85;
  }

  private generateCriticalAlerts(kpis: DashboardKPIDto[]): KPIAlertDto[] {
    // Implementation for critical alerts
    return [];
  }

  private async calculateRealTimeMetrics(tenantId: string): Promise<any> {
    // Implementation for real-time metrics
    return {
      currentDayRevenue: 0,
      currentDayOrders: 0,
      activeUsers: 0,
      lowStockAlerts: 0,
      systemHealth: 'healthy',
    };
  }
}
