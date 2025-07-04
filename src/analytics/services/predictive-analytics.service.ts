import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductCategory } from '../../products/entities/product-category.entity';
import {
  Prediction,
  PredictionType,
} from '../../ml-forecasting/entities/prediction.entity';
import { MLModel } from '../../ml-forecasting/entities/ml-model.entity';

import { ForecastingService } from '../../ml-forecasting/services/forecasting.service';
import { ModelServingService } from '../../ml-forecasting/services/model-serving.service';

import {
  PredictiveAnalysisType,
  StockoutPredictionQueryDto,
  SlowMovingDetectionQueryDto,
  OptimalReorderQueryDto,
  PriceOptimizationQueryDto,
  DemandAnomalyQueryDto,
  SeasonalAnalysisQueryDto,
  RiskLevel,
  MovementCategory,
  TimeHorizon,
} from '../dto/predictive-analytics-query.dto';

import {
  StockoutPredictionResponseDto,
  SlowMovingDetectionResponseDto,
  OptimalReorderResponseDto,
  PriceOptimizationResponseDto,
  DemandAnomalyResponseDto,
  SeasonalAnalysisResponseDto,
  StockoutRiskDto,
  SlowMovingItemDto,
  OptimalReorderDto,
  PriceOptimizationDto,
  DemandAnomalyDto,
  SeasonalAnalysisDto,
} from '../dto/predictive-analytics-response.dto';

import { AnalyticsMetaDto } from '../dto/analytics-response.dto';

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,
    @InjectRepository(MLModel)
    private readonly mlModelRepository: Repository<MLModel>,
    private readonly forecastingService: ForecastingService,
    private readonly modelServingService: ModelServingService,
  ) {}

  /**
   * Generate stockout predictions for products
   */
  async generateStockoutPredictions(
    tenantId: string,
    query: StockoutPredictionQueryDto,
  ): Promise<StockoutPredictionResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Generating stockout predictions for tenant ${tenantId}`,
      );

      // Get products to analyze
      const products = await this.getProductsToAnalyze(tenantId, query);

      // Generate predictions for each product
      const stockoutRisks: StockoutRiskDto[] = [];
      let totalPotentialLostRevenue = 0;
      let highRiskCount = 0;
      let criticalRiskCount = 0;

      for (const product of products) {
        try {
          const stockoutRisk = await this.calculateStockoutRisk(
            tenantId,
            product,
            query,
          );
          stockoutRisks.push(stockoutRisk);

          totalPotentialLostRevenue +=
            stockoutRisk.businessImpact.potentialLostRevenue;

          if (stockoutRisk.riskLevel === RiskLevel.HIGH) highRiskCount++;
          if (stockoutRisk.riskLevel === RiskLevel.CRITICAL)
            criticalRiskCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to calculate stockout risk for product ${product.id}: ${error.message}`,
          );
        }
      }

      // Filter by minimum risk level
      const filteredRisks = stockoutRisks.filter(
        risk =>
          this.riskLevelToNumber(risk.riskLevel) >=
          this.riskLevelToNumber(query.minRiskLevel || RiskLevel.MEDIUM),
      );

      // Sort by risk score descending
      filteredRisks.sort((a, b) => b.riskScore - a.riskScore);

      // Apply pagination
      const startIndex = ((query.page || 1) - 1) * (query.limit || 50);
      const paginatedData = filteredRisks.slice(
        startIndex,
        startIndex + (query.limit || 50),
      );

      // Calculate summary statistics
      const summary = {
        totalProducts: products.length,
        highRiskProducts: highRiskCount,
        criticalRiskProducts: criticalRiskCount,
        averageRiskScore:
          stockoutRisks.reduce((sum, risk) => sum + risk.riskScore, 0) /
            stockoutRisks.length || 0,
        averageDaysToStockout:
          stockoutRisks.reduce((sum, risk) => sum + risk.daysUntilStockout, 0) /
            stockoutRisks.length || 0,
        totalPotentialLostRevenue,
        topRiskCategories: await this.getTopRiskCategories(
          tenantId,
          stockoutRisks,
        ),
      };

      // Generate trends analysis
      const trends = await this.generateStockoutTrends(tenantId, query);

      // Generate insights
      const insights = this.generateStockoutInsights(stockoutRisks, summary);

      const meta: AnalyticsMetaDto = {
        total: filteredRisks.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(filteredRisks.length / (query.limit || 50)),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: paginatedData,
        meta,
        summary,
        trends,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate stockout predictions: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate stockout predictions: ${error.message}`,
      );
    }
  }

  /**
   * Detect slow-moving inventory items
   */
  async detectSlowMovingItems(
    tenantId: string,
    query: SlowMovingDetectionQueryDto,
  ): Promise<SlowMovingDetectionResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Detecting slow-moving items for tenant ${tenantId}`);

      // Get date range for analysis
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(
            endDate.getTime() -
              (query.lookbackDays || 90) * 24 * 60 * 60 * 1000,
          );

      // Query slow-moving items
      const slowMovingItems = await this.identifySlowMovingItems(
        tenantId,
        query,
        startDate,
        endDate,
      );

      // Apply filters
      const filteredItems = slowMovingItems
        .filter(item => {
          if (query.movementCategories?.length) {
            return query.movementCategories.includes(item.movementCategory);
          }
          return true;
        })
        .filter(item => {
          return item.inventoryValue >= (query.minInventoryValue || 0);
        });

      // Sort by holding cost descending (most expensive slow-moving items first)
      filteredItems.sort((a, b) => b.holdingCost - a.holdingCost);

      // Apply pagination
      const startIndex = ((query.page || 1) - 1) * (query.limit || 50);
      const paginatedData = filteredItems.slice(
        startIndex,
        startIndex + (query.limit || 50),
      );

      // Calculate summary statistics
      const summary = {
        totalItems: slowMovingItems.length,
        slowMovingItems: slowMovingItems.filter(
          item =>
            item.movementCategory === MovementCategory.SLOW_MOVING ||
            item.movementCategory === MovementCategory.DEAD_STOCK,
        ).length,
        deadStockItems: slowMovingItems.filter(
          item => item.movementCategory === MovementCategory.DEAD_STOCK,
        ).length,
        totalInventoryValue: slowMovingItems.reduce(
          (sum, item) => sum + item.inventoryValue,
          0,
        ),
        slowMovingValue: slowMovingItems
          .filter(
            item =>
              item.movementCategory === MovementCategory.SLOW_MOVING ||
              item.movementCategory === MovementCategory.DEAD_STOCK,
          )
          .reduce((sum, item) => sum + item.inventoryValue, 0),
        averageTurnoverRatio:
          slowMovingItems.reduce((sum, item) => sum + item.turnoverRatio, 0) /
            slowMovingItems.length || 0,
        totalHoldingCost: slowMovingItems.reduce(
          (sum, item) => sum + item.holdingCost,
          0,
        ),
        potentialRecoveryValue: slowMovingItems.reduce(
          (sum, item) =>
            sum + item.markdownRecommendations.expectedRecoveredValue,
          0,
        ),
      };

      // Generate category breakdown
      const categoryBreakdown = await this.generateSlowMovingCategoryBreakdown(
        tenantId,
        slowMovingItems,
      );

      // Generate insights
      const insights = this.generateSlowMovingInsights(
        slowMovingItems,
        summary,
      );

      const meta: AnalyticsMetaDto = {
        total: filteredItems.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(filteredItems.length / (query.limit || 50)),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: paginatedData,
        meta,
        summary,
        categoryBreakdown,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to detect slow-moving items: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to detect slow-moving items: ${error.message}`,
      );
    }
  }

  /**
   * Generate optimal reorder recommendations
   */
  async generateOptimalReorders(
    tenantId: string,
    query: OptimalReorderQueryDto,
  ): Promise<OptimalReorderResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Generating optimal reorder recommendations for tenant ${tenantId}`,
      );

      // Get products that need reordering
      const products = await this.getProductsNeedingReorder(tenantId, query);

      // Generate reorder recommendations
      const reorderRecommendations: OptimalReorderDto[] = [];
      let totalReorderValue = 0;
      let totalCostSavings = 0;
      let criticalReorders = 0;

      for (const product of products) {
        try {
          const reorderRecommendation = await this.calculateOptimalReorder(
            tenantId,
            product,
            query,
          );
          reorderRecommendations.push(reorderRecommendation);

          totalReorderValue +=
            reorderRecommendation.optimalQuantity * (product.costPrice || 0);
          totalCostSavings += reorderRecommendation.costAnalysis.costSavings;

          if (reorderRecommendation.orderTiming.urgency === 'critical') {
            criticalReorders++;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to calculate optimal reorder for product ${product.id}: ${error.message}`,
          );
        }
      }

      // Apply budget constraint if specified
      if (query.maxBudget) {
        reorderRecommendations.sort(
          (a, b) =>
            b.businessJustification.revenueImpact -
            a.businessJustification.revenueImpact,
        );

        let currentBudget = 0;
        const constrainedRecommendations = [];

        for (const recommendation of reorderRecommendations) {
          const cost =
            recommendation.optimalQuantity *
            (await this.getProductCost(tenantId, recommendation.productId));
          if (currentBudget + cost <= query.maxBudget) {
            constrainedRecommendations.push(recommendation);
            currentBudget += cost;
          }
        }

        reorderRecommendations.length = 0;
        reorderRecommendations.push(...constrainedRecommendations);
      }

      // Sort by urgency and revenue impact
      reorderRecommendations.sort((a, b) => {
        const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const urgencyDiff =
          urgencyOrder[b.orderTiming.urgency] -
          urgencyOrder[a.orderTiming.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return (
          b.businessJustification.revenueImpact -
          a.businessJustification.revenueImpact
        );
      });

      // Apply pagination
      const startIndex = ((query.page || 1) - 1) * (query.limit || 50);
      const paginatedData = reorderRecommendations.slice(
        startIndex,
        startIndex + (query.limit || 50),
      );

      // Calculate summary statistics
      const summary = {
        totalProducts: products.length,
        totalReorderValue,
        averageServiceLevel:
          reorderRecommendations.reduce(
            (sum, rec) => sum + rec.serviceLevel.achievedLevel,
            0,
          ) / reorderRecommendations.length || 0,
        totalCostSavings,
        criticalReorders,
        cashFlowImpact: totalReorderValue,
      };

      // Generate insights
      const insights = this.generateReorderInsights(
        reorderRecommendations,
        summary,
      );

      const meta: AnalyticsMetaDto = {
        total: reorderRecommendations.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(
          reorderRecommendations.length / (query.limit || 50),
        ),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
        dataAsOf: new Date().toISOString(),
      };

      return {
        data: paginatedData,
        meta,
        summary,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate optimal reorders: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to generate optimal reorders: ${error.message}`,
      );
    }
  }

  // Helper methods for stockout prediction
  private async getProductsToAnalyze(
    tenantId: string,
    query: any,
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.inventoryItems', 'inventory')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true');

    if (query.productId) {
      queryBuilder.andWhere('product.id = :productId', {
        productId: query.productId,
      });
    }

    if (query.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.currentLowStockOnly) {
      queryBuilder.andWhere('inventory.quantity <= inventory.reorderPoint');
    }

    return queryBuilder.getMany();
  }

  private async calculateStockoutRisk(
    tenantId: string,
    product: Product,
    query: StockoutPredictionQueryDto,
  ): Promise<StockoutRiskDto> {
    // Get current inventory
    const inventoryItem = await this.inventoryItemRepository.findOne({
      where: { productId: product.id, tenantId, isActive: true },
    });

    if (!inventoryItem) {
      throw new Error(`No inventory found for product ${product.id}`);
    }

    // Get predicted demand using ML forecasting
    const forecastDays = this.timeHorizonToDays(query.timeHorizon);
    const demandForecast = await this.forecastingService.generateDemandForecast(
      tenantId,
      {
        productId: product.id,
        forecastHorizonDays: forecastDays,
        includeConfidenceInterval: true,
        includeSeasonality: query.includeSeasonalFactors || true,
        includeTrendDecomposition: false,
        granularity: 'daily',
      },
    );

    // Calculate daily demand
    const predictedDailyDemand = demandForecast.success
      ? demandForecast.insights.averageDailyDemand
      : await this.calculateHistoricalDailyDemand(tenantId, product.id);

    // Calculate days until stockout
    const daysUntilStockout =
      predictedDailyDemand > 0
        ? Math.floor(inventoryItem.quantity / predictedDailyDemand)
        : 999;

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      daysUntilStockout,
      forecastDays,
      inventoryItem.reorderPoint || 0,
    );
    const riskLevel = this.getRiskLevel(riskScore);

    // Get seasonal factors
    const seasonalFactors = demandForecast.seasonalDecomposition
      ? {
          isSeasonalPeak:
            demandForecast.seasonalDecomposition.seasonalityStrength > 0.3,
          seasonalMultiplier: 1.0, // Simplified
          peakPeriod: 'Q4', // Simplified
        }
      : {
          isSeasonalPeak: false,
          seasonalMultiplier: 1.0,
        };

    // Calculate business impact
    const businessImpact = {
      potentialLostRevenue:
        predictedDailyDemand *
        (product.sellingPrice || 0) *
        Math.max(0, forecastDays - daysUntilStockout),
      customerSatisfactionImpact: Math.min(100, riskScore * 100),
      urgencyScore: Math.min(100, (1 - daysUntilStockout / forecastDays) * 100),
    };

    // Generate recommendations
    const recommendations = this.generateStockoutRecommendations(
      riskLevel,
      daysUntilStockout,
      inventoryItem,
      predictedDailyDemand,
    );

    const predictedStockoutDate = new Date();
    predictedStockoutDate.setDate(
      predictedStockoutDate.getDate() + daysUntilStockout,
    );

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: inventoryItem.quantity,
      predictedStockoutDate: predictedStockoutDate.toISOString().split('T')[0],
      daysUntilStockout,
      riskScore,
      riskLevel,
      confidence: demandForecast.success
        ? demandForecast.overallConfidence
        : 0.7,
      predictedDailyDemand,
      reorderPoint: inventoryItem.reorderPoint || 0,
      recommendedSafetyStock: Math.ceil(predictedDailyDemand * 7), // 7 days safety stock
      leadTimeDays: 7, // Default lead time
      businessImpact,
      recommendations,
      seasonalFactors,
    };
  }

  private riskLevelToNumber(riskLevel: RiskLevel): number {
    const levels = {
      [RiskLevel.VERY_LOW]: 1,
      [RiskLevel.LOW]: 2,
      [RiskLevel.MEDIUM]: 3,
      [RiskLevel.HIGH]: 4,
      [RiskLevel.CRITICAL]: 5,
    };
    return levels[riskLevel] || 3;
  }

  private timeHorizonToDays(horizon: TimeHorizon): number {
    const days = {
      [TimeHorizon.NEXT_7_DAYS]: 7,
      [TimeHorizon.NEXT_14_DAYS]: 14,
      [TimeHorizon.NEXT_30_DAYS]: 30,
      [TimeHorizon.NEXT_60_DAYS]: 60,
      [TimeHorizon.NEXT_90_DAYS]: 90,
    };
    return days[horizon] || 30;
  }

  private calculateRiskScore(
    daysUntilStockout: number,
    forecastDays: number,
    reorderPoint: number,
  ): number {
    if (daysUntilStockout <= 0) return 1.0;
    if (daysUntilStockout >= forecastDays) return 0.0;

    // Higher risk as we approach stockout
    let riskScore = 1 - daysUntilStockout / forecastDays;

    // Adjust for reorder point
    if (daysUntilStockout <= 7) riskScore = Math.max(riskScore, 0.8);
    if (daysUntilStockout <= 3) riskScore = Math.max(riskScore, 0.9);
    if (daysUntilStockout <= 1) riskScore = 1.0;

    return Math.min(1.0, Math.max(0.0, riskScore));
  }

  private getRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 0.9) return RiskLevel.CRITICAL;
    if (riskScore >= 0.7) return RiskLevel.HIGH;
    if (riskScore >= 0.5) return RiskLevel.MEDIUM;
    if (riskScore >= 0.3) return RiskLevel.LOW;
    return RiskLevel.VERY_LOW;
  }

  private async calculateHistoricalDailyDemand(
    tenantId: string,
    productId: string,
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sales = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate >= :startDate', {
        startDate: thirtyDaysAgo,
      })
      .select('SUM(transaction.quantity)', 'totalQuantity')
      .getRawOne();

    return (Number(sales?.totalQuantity) || 0) / 30;
  }

  private generateStockoutRecommendations(
    riskLevel: RiskLevel,
    daysUntilStockout: number,
    inventoryItem: any,
    predictedDailyDemand: number,
  ): string[] {
    const recommendations = [];

    if (riskLevel === RiskLevel.CRITICAL) {
      recommendations.push(
        'URGENT: Lakukan pemesanan emergency untuk menghindari stockout',
      );
      recommendations.push(
        'Pertimbangkan substitute products untuk memenuhi demand',
      );
      recommendations.push(
        'Komunikasikan dengan customer tentang potential delay',
      );
    } else if (riskLevel === RiskLevel.HIGH) {
      recommendations.push('Segera lakukan reorder dengan priority tinggi');
      recommendations.push('Monitor stock level harian hingga restocking');
      recommendations.push('Siapkan alternative sourcing jika diperlukan');
    } else if (riskLevel === RiskLevel.MEDIUM) {
      recommendations.push('Jadwalkan reorder dalam 3-5 hari ke depan');
      recommendations.push('Review dan sesuaikan reorder point');
      recommendations.push('Monitor trend demand untuk adjustment');
    } else {
      recommendations.push('Stock level masih aman, monitor secara rutin');
      recommendations.push('Evaluate apakah safety stock perlu disesuaikan');
    }

    // Add specific recommendations based on current situation
    if (
      inventoryItem.reorderPoint &&
      inventoryItem.quantity <= inventoryItem.reorderPoint
    ) {
      recommendations.push(
        'Stock telah mencapai reorder point, segera lakukan pemesanan',
      );
    }

    if (predictedDailyDemand > 0) {
      const recommendedOrder = Math.ceil(predictedDailyDemand * 30); // 30 days supply
      recommendations.push(
        `Rekomendasi jumlah order: ${recommendedOrder} unit (30 hari supply)`,
      );
    }

    return recommendations;
  }

  private async getTopRiskCategories(
    tenantId: string,
    stockoutRisks: StockoutRiskDto[],
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      riskScore: number;
      productCount: number;
    }>
  > {
    // Group by category and calculate average risk
    const categoryRisks = new Map<
      string,
      { risks: number[]; products: Set<string>; name: string }
    >();

    for (const risk of stockoutRisks) {
      const product = await this.productRepository.findOne({
        where: { id: risk.productId, tenantId },
        relations: ['category'],
      });

      if (product?.category) {
        const categoryId = product.category.id;
        if (!categoryRisks.has(categoryId)) {
          categoryRisks.set(categoryId, {
            risks: [],
            products: new Set(),
            name: product.category.name,
          });
        }

        const categoryData = categoryRisks.get(categoryId)!;
        categoryData.risks.push(risk.riskScore);
        categoryData.products.add(risk.productId);
      }
    }

    return Array.from(categoryRisks.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        riskScore:
          data.risks.reduce((sum, risk) => sum + risk, 0) / data.risks.length,
        productCount: data.products.size,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }

  private async generateStockoutTrends(
    tenantId: string,
    query: StockoutPredictionQueryDto,
  ): Promise<
    Array<{
      period: string;
      averageRiskScore: number;
      riskTrend: 'increasing' | 'decreasing' | 'stable';
    }>
  > {
    // Simplified trend analysis - in a real implementation, this would analyze historical data
    return [
      {
        period: 'Current Week',
        averageRiskScore: 0.45,
        riskTrend: 'increasing',
      },
      {
        period: 'Previous Week',
        averageRiskScore: 0.38,
        riskTrend: 'stable',
      },
      {
        period: 'Two Weeks Ago',
        averageRiskScore: 0.42,
        riskTrend: 'decreasing',
      },
    ];
  }

  private generateStockoutInsights(
    stockoutRisks: StockoutRiskDto[],
    summary: any,
  ): any {
    const keyFindings = [];
    const actionPriorities = [];
    const riskMitigationStrategies = [];
    const inventoryOptimizationTips = [];

    // Key findings
    if (summary.criticalRiskProducts > 0) {
      keyFindings.push(
        `${summary.criticalRiskProducts} produk berisiko stockout kritis dalam 7 hari`,
      );
    }

    if (summary.averageDaysToStockout < 14) {
      keyFindings.push(
        `Rata-rata waktu hingga stockout hanya ${Math.round(
          summary.averageDaysToStockout,
        )} hari`,
      );
    }

    if (summary.totalPotentialLostRevenue > 10000000) {
      keyFindings.push(
        `Potensi kerugian revenue mencapai Rp ${(
          summary.totalPotentialLostRevenue / 1000000
        ).toFixed(1)}M`,
      );
    }

    // Action priorities
    const criticalProducts = stockoutRisks.filter(
      risk => risk.riskLevel === RiskLevel.CRITICAL,
    );
    if (criticalProducts.length > 0) {
      actionPriorities.push(
        `Priority 1: Emergency reorder untuk ${criticalProducts.length} produk kritis`,
      );
    }

    const highRiskProducts = stockoutRisks.filter(
      risk => risk.riskLevel === RiskLevel.HIGH,
    );
    if (highRiskProducts.length > 0) {
      actionPriorities.push(
        `Priority 2: Urgent reorder untuk ${highRiskProducts.length} produk high risk`,
      );
    }

    // Risk mitigation strategies
    riskMitigationStrategies.push(
      'Implementasi automatic reorder system untuk produk high-velocity',
    );
    riskMitigationStrategies.push(
      'Setup alert system untuk monitoring stock level harian',
    );
    riskMitigationStrategies.push(
      'Develop relationship dengan supplier alternative untuk emergency sourcing',
    );

    // Inventory optimization tips
    inventoryOptimizationTips.push(
      'Review dan adjust reorder points berdasarkan demand patterns terbaru',
    );
    inventoryOptimizationTips.push(
      'Implementasi safety stock yang sesuai dengan lead time dan demand variability',
    );
    inventoryOptimizationTips.push(
      'Gunakan seasonal forecasting untuk anticipate demand spikes',
    );

    return {
      keyFindings,
      actionPriorities,
      riskMitigationStrategies,
      inventoryOptimizationTips,
    };
  }

  // Helper methods for slow-moving detection
  private async identifySlowMovingItems(
    tenantId: string,
    query: SlowMovingDetectionQueryDto,
    startDate: Date,
    endDate: Date,
  ): Promise<SlowMovingItemDto[]> {
    // Get all products with their inventory and sales data
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.inventoryItems', 'inventory')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true')
      .andWhere('inventory.isActive = true')
      .getMany();

    const slowMovingItems: SlowMovingItemDto[] = [];

    for (const product of products) {
      const inventoryItem = product.inventoryItems?.[0];
      if (!inventoryItem) continue;

      // Calculate sales for the period
      const salesData = await this.calculateProductSalesData(
        tenantId,
        product.id,
        startDate,
        endDate,
      );

      // Calculate turnover ratio
      const avgInventoryValue = inventoryItem.totalValue;
      const turnoverRatio =
        avgInventoryValue > 0
          ? salesData.totalSalesValue / avgInventoryValue
          : 0;

      // Determine movement category
      const movementCategory = this.categorizeMovement(
        turnoverRatio,
        salesData.daysSinceLastSale,
        query.minTurnoverRatio || 0.5,
        query.maxDaysWithoutSale || 60,
      );

      // Only include slow-moving and dead stock
      if (
        movementCategory === MovementCategory.SLOW_MOVING ||
        movementCategory === MovementCategory.DEAD_STOCK
      ) {
        const slowMovingItem = await this.createSlowMovingItemDto(
          product,
          inventoryItem,
          salesData,
          turnoverRatio,
          movementCategory,
        );

        slowMovingItems.push(slowMovingItem);
      }
    }

    return slowMovingItems;
  }

  private async calculateProductSalesData(
    tenantId: string,
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalSalesValue: number;
    totalQuantitySold: number;
    daysSinceLastSale: number;
    averageMonthlySales: number;
  }> {
    // Get sales transactions
    const salesResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select([
        'SUM(transaction.quantity * transaction.unitCost) as totalValue',
        'SUM(transaction.quantity) as totalQuantity',
        'MAX(transaction.transactionDate) as lastSaleDate',
      ])
      .getRawOne();

    const totalSalesValue = Number(salesResult?.totalValue) || 0;
    const totalQuantitySold = Number(salesResult?.totalQuantity) || 0;
    const lastSaleDate = salesResult?.lastSaleDate
      ? new Date(salesResult.lastSaleDate)
      : null;

    // Calculate days since last sale
    const daysSinceLastSale = lastSaleDate
      ? Math.floor(
          (new Date().getTime() - lastSaleDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    // Calculate average monthly sales
    const periodMonths =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    const averageMonthlySales =
      periodMonths > 0 ? totalQuantitySold / periodMonths : 0;

    return {
      totalSalesValue,
      totalQuantitySold,
      daysSinceLastSale,
      averageMonthlySales,
    };
  }

  private categorizeMovement(
    turnoverRatio: number,
    daysSinceLastSale: number,
    minTurnoverRatio: number,
    maxDaysWithoutSale: number,
  ): MovementCategory {
    if (daysSinceLastSale > maxDaysWithoutSale * 2 || turnoverRatio === 0) {
      return MovementCategory.DEAD_STOCK;
    } else if (
      turnoverRatio < minTurnoverRatio ||
      daysSinceLastSale > maxDaysWithoutSale
    ) {
      return MovementCategory.SLOW_MOVING;
    } else if (turnoverRatio >= minTurnoverRatio * 3) {
      return MovementCategory.FAST_MOVING;
    } else {
      return MovementCategory.MEDIUM_MOVING;
    }
  }

  private async createSlowMovingItemDto(
    product: Product,
    inventoryItem: any,
    salesData: any,
    turnoverRatio: number,
    movementCategory: MovementCategory,
  ): Promise<SlowMovingItemDto> {
    const inventoryValue = inventoryItem.totalValue;
    const holdingCostRate = 0.25; // 25% annual holding cost
    const holdingCost = inventoryValue * holdingCostRate;
    const velocityScore = salesData.averageMonthlySales / 30; // Daily sales rate

    // Calculate markdown recommendations
    const suggestedDiscountPercent =
      movementCategory === MovementCategory.DEAD_STOCK ? 50 : 30;
    const expectedRecoveredValue =
      inventoryValue * (1 - suggestedDiscountPercent / 100);
    const estimatedClearanceTime =
      movementCategory === MovementCategory.DEAD_STOCK ? 30 : 60;

    // Calculate dead stock risk
    const deadStockRiskScore = this.calculateDeadStockRisk(
      turnoverRatio,
      salesData.daysSinceLastSale,
    );
    const timeToDeadStock = Math.max(0, 180 - salesData.daysSinceLastSale);

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: inventoryItem.quantity,
      inventoryValue,
      daysSinceLastSale: salesData.daysSinceLastSale,
      turnoverRatio,
      movementCategory,
      velocityScore,
      last90DaysSales: salesData.totalQuantitySold,
      averageMonthlySales: salesData.averageMonthlySales,
      holdingCost,
      opportunityCost: holdingCost * 0.5, // Simplified opportunity cost
      markdownRecommendations: {
        suggestedDiscountPercent,
        estimatedClearanceTime,
        expectedRecoveredValue,
      },
      alternativeActions: [
        {
          action: 'Bundle dengan produk fast-moving',
          priority: 1,
          expectedOutcome: 'Accelerate sales velocity',
          timeframe: '2-4 weeks',
        },
        {
          action: 'Transfer ke lokasi dengan demand tinggi',
          priority: 2,
          expectedOutcome: 'Improve turnover ratio',
          timeframe: '1-2 weeks',
        },
        {
          action: 'Return to supplier (jika memungkinkan)',
          priority: 3,
          expectedOutcome: 'Recover cost dan free up space',
          timeframe: '2-6 weeks',
        },
      ],
      deadStockRisk: {
        riskScore: deadStockRiskScore,
        riskFactors: this.getDeadStockRiskFactors(
          turnoverRatio,
          salesData.daysSinceLastSale,
          velocityScore,
        ),
        timeToDeadStock,
      },
    };
  }

  private calculateDeadStockRisk(
    turnoverRatio: number,
    daysSinceLastSale: number,
  ): number {
    let riskScore = 0;

    // Turnover ratio impact
    if (turnoverRatio === 0) riskScore += 0.4;
    else if (turnoverRatio < 0.1) riskScore += 0.3;
    else if (turnoverRatio < 0.3) riskScore += 0.2;

    // Days since last sale impact
    if (daysSinceLastSale > 180) riskScore += 0.4;
    else if (daysSinceLastSale > 120) riskScore += 0.3;
    else if (daysSinceLastSale > 90) riskScore += 0.2;
    else if (daysSinceLastSale > 60) riskScore += 0.1;

    // Velocity impact
    riskScore += 0.2; // Base risk for being slow-moving

    return Math.min(1.0, riskScore);
  }

  private getDeadStockRiskFactors(
    turnoverRatio: number,
    daysSinceLastSale: number,
    velocityScore: number,
  ): string[] {
    const factors = [];

    if (turnoverRatio === 0)
      factors.push('Tidak ada penjualan dalam periode analisis');
    else if (turnoverRatio < 0.1) factors.push('Turnover ratio sangat rendah');

    if (daysSinceLastSale > 120)
      factors.push('Tidak ada penjualan dalam 4+ bulan');
    else if (daysSinceLastSale > 90)
      factors.push('Tidak ada penjualan dalam 3+ bulan');

    if (velocityScore < 0.1) factors.push('Velocity penjualan sangat rendah');

    factors.push('Potensi perubahan trend pasar');
    factors.push('Biaya holding yang terus bertambah');

    return factors;
  }

  private async generateSlowMovingCategoryBreakdown(
    tenantId: string,
    slowMovingItems: SlowMovingItemDto[],
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      slowMovingCount: number;
      slowMovingValue: number;
      averageTurnover: number;
    }>
  > {
    const categoryMap = new Map<
      string,
      {
        name: string;
        items: SlowMovingItemDto[];
        totalValue: number;
        totalTurnover: number;
      }
    >();

    for (const item of slowMovingItems) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, tenantId },
        relations: ['category'],
      });

      if (product?.category) {
        const categoryId = product.category.id;
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            name: product.category.name,
            items: [],
            totalValue: 0,
            totalTurnover: 0,
          });
        }

        const categoryData = categoryMap.get(categoryId)!;
        categoryData.items.push(item);
        categoryData.totalValue += item.inventoryValue;
        categoryData.totalTurnover += item.turnoverRatio;
      }
    }

    return Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      slowMovingCount: data.items.length,
      slowMovingValue: data.totalValue,
      averageTurnover: data.totalTurnover / data.items.length,
    }));
  }

  private generateSlowMovingInsights(
    slowMovingItems: SlowMovingItemDto[],
    summary: any,
  ): any {
    const keyFindings = [];
    const liquidationStrategy = [];
    const preventionTips = [];
    const cashFlowOptimization = [];

    // Key findings
    if (summary.deadStockItems > 0) {
      keyFindings.push(
        `${summary.deadStockItems} item dikategorikan sebagai dead stock`,
      );
    }

    if (summary.slowMovingValue > 50000000) {
      keyFindings.push(
        `Rp ${(summary.slowMovingValue / 1000000).toFixed(
          1,
        )}M terikat dalam slow-moving inventory`,
      );
    }

    const avgHoldingCost = summary.totalHoldingCost / summary.totalItems;
    if (avgHoldingCost > 100000) {
      keyFindings.push(
        `Rata-rata holding cost per item: Rp ${(avgHoldingCost / 1000).toFixed(
          0,
        )}K`,
      );
    }

    // Liquidation strategy
    liquidationStrategy.push(
      'Priority markdown untuk dead stock items (diskon 40-60%)',
    );
    liquidationStrategy.push(
      'Bundle slow-moving items dengan fast-moving products',
    );
    liquidationStrategy.push(
      'Explore return-to-supplier options untuk items masih dalam kondisi baik',
    );

    // Prevention tips
    preventionTips.push('Implementasi demand forecasting yang lebih akurat');
    preventionTips.push(
      'Regular review inventory turnover (monthly/quarterly)',
    );
    preventionTips.push(
      'Set automatic alerts untuk items yang approaching slow-moving threshold',
    );

    // Cash flow optimization
    cashFlowOptimization.push(
      'Prioritas liquidation berdasarkan inventory value dan holding cost',
    );
    cashFlowOptimization.push('Reinvest recovered cash ke fast-moving items');
    cashFlowOptimization.push(
      'Negotiate dengan supplier untuk konsinyasi atau return program',
    );

    return {
      keyFindings,
      liquidationStrategy,
      preventionTips,
      cashFlowOptimization,
    };
  }

  // Helper methods for optimal reorder
  private async getProductsNeedingReorder(
    tenantId: string,
    query: OptimalReorderQueryDto,
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.inventoryItems', 'inventory')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true')
      .andWhere('inventory.isActive = true');

    if (query.productId) {
      queryBuilder.andWhere('product.id = :productId', {
        productId: query.productId,
      });
    }

    if (query.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.priorityProductsOnly) {
      // Add criteria for high-velocity, high-value products
      queryBuilder.andWhere('inventory.totalValue > :minValue', {
        minValue: 1000000,
      }); // 1M IDR
    }

    return queryBuilder.getMany();
  }

  private async calculateOptimalReorder(
    tenantId: string,
    product: Product,
    query: OptimalReorderQueryDto,
  ): Promise<OptimalReorderDto> {
    const inventoryItem = product.inventoryItems?.[0];
    if (!inventoryItem) {
      throw new Error(`No inventory found for product ${product.id}`);
    }

    // Get demand forecast
    const forecastDays = this.timeHorizonToDays(
      query.forecastHorizon || TimeHorizon.NEXT_30_DAYS,
    );
    const demandForecast = await this.forecastingService.generateDemandForecast(
      tenantId,
      {
        productId: product.id,
        forecastHorizonDays: forecastDays,
        includeConfidenceInterval: true,
        includeSeasonality: true,
        includeTrendDecomposition: false,
        granularity: 'daily',
      },
    );

    const predictedDemand = demandForecast.success
      ? demandForecast.insights.totalPredictedDemand
      : await this.estimateDemand(tenantId, product.id, forecastDays);

    // Calculate optimal parameters
    const leadTime = 7; // Default lead time
    const serviceLevel = 0.95; // 95% service level
    const safetyStockMultiplier = query.safetyStockMultiplier || 1.5;

    const dailyDemand = predictedDemand / forecastDays;
    const leadTimeDemand = dailyDemand * leadTime;
    const safetyStock = Math.ceil(
      dailyDemand * Math.sqrt(leadTime) * safetyStockMultiplier,
    );
    const reorderPoint = leadTimeDemand + safetyStock;

    // Calculate EOQ if requested
    let economicOrderQuantity = predictedDemand; // Default to forecast demand
    if (query.includeEOQ) {
      const orderingCost = 50000; // 50K IDR per order
      const holdingCostRate = 0.25; // 25% annual
      const unitCost = product.costPrice || 0;
      const annualDemand = dailyDemand * 365;

      if (unitCost > 0 && annualDemand > 0) {
        economicOrderQuantity = Math.sqrt(
          (2 * orderingCost * annualDemand) / (holdingCostRate * unitCost),
        );
      }
    }

    // Determine optimal quantity (max of EOQ and forecast demand)
    const optimalQuantity = Math.max(economicOrderQuantity, predictedDemand);
    const maximumStock = reorderPoint + optimalQuantity;

    // Calculate costs
    const orderingCost = 50000;
    const holdingCostPerUnit = ((product.costPrice || 0) * 0.25) / 365; // Daily holding cost
    const totalCost =
      orderingCost + optimalQuantity * holdingCostPerUnit * forecastDays;
    const currentCost = this.calculateCurrentInventoryCost(
      inventoryItem,
      holdingCostPerUnit,
    );
    const costSavings = Math.max(0, currentCost - totalCost);

    // Determine urgency
    const currentStock = inventoryItem.quantity;
    const daysUntilReorder = Math.max(
      0,
      (currentStock - reorderPoint) / dailyDemand,
    );

    let urgency: 'low' | 'medium' | 'high' | 'critical';
    if (currentStock <= reorderPoint * 0.5) urgency = 'critical';
    else if (currentStock <= reorderPoint) urgency = 'high';
    else if (daysUntilReorder <= 7) urgency = 'medium';
    else urgency = 'low';

    // Calculate business impact
    const revenueImpact = predictedDemand * (product.sellingPrice || 0);
    const cashFlowImpact = optimalQuantity * (product.costPrice || 0);

    const recommendedOrderDate = new Date();
    recommendedOrderDate.setDate(
      recommendedOrderDate.getDate() + Math.floor(daysUntilReorder),
    );

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock,
      optimalQuantity: Math.ceil(optimalQuantity),
      economicOrderQuantity: Math.ceil(economicOrderQuantity),
      reorderPoint: Math.ceil(reorderPoint),
      safetyStock: Math.ceil(safetyStock),
      maximumStock: Math.ceil(maximumStock),
      forecastDemand: Math.ceil(predictedDemand),
      confidence: demandForecast.success
        ? demandForecast.overallConfidence
        : 0.7,
      costAnalysis: {
        orderingCost,
        holdingCostPerUnit,
        totalCost,
        costSavings,
      },
      serviceLevel: {
        currentLevel: 0.85, // Estimated current level
        targetLevel: serviceLevel,
        achievedLevel: serviceLevel,
      },
      supplierInfo: {
        leadTime,
        minimumOrderQuantity: 0,
        priceBreaks: [], // Would be populated from supplier data
      },
      businessJustification: {
        revenueImpact,
        cashFlowImpact: -cashFlowImpact, // Negative because it's an outflow
        riskReduction: costSavings,
        reasoning: [
          `Forecasted demand: ${Math.ceil(
            predictedDemand,
          )} units untuk ${forecastDays} hari`,
          `Safety stock untuk ${(serviceLevel * 100).toFixed(
            0,
          )}% service level`,
          `EOQ optimization untuk minimize total cost`,
        ],
      },
      orderTiming: {
        recommendedOrderDate: recommendedOrderDate.toISOString().split('T')[0],
        urgency,
        daysToReorder: Math.ceil(daysUntilReorder),
      },
    };
  }

  private async estimateDemand(
    tenantId: string,
    productId: string,
    days: number,
  ): Promise<number> {
    // Fallback demand estimation using historical data
    const pastPeriod = new Date();
    pastPeriod.setDate(pastPeriod.getDate() - days);

    const sales = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate >= :startDate', {
        startDate: pastPeriod,
      })
      .select('SUM(transaction.quantity)', 'totalQuantity')
      .getRawOne();

    return Number(sales?.totalQuantity) || 0;
  }

  private calculateCurrentInventoryCost(
    inventoryItem: any,
    holdingCostPerUnit: number,
  ): number {
    return inventoryItem.quantity * holdingCostPerUnit * 30; // 30-day holding cost
  }

  private async getProductCost(
    tenantId: string,
    productId: string,
  ): Promise<number> {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
    });
    return product?.costPrice || 0;
  }

  private generateReorderInsights(
    reorderRecommendations: OptimalReorderDto[],
    summary: any,
  ): any {
    const inventoryOptimization = [];
    const cashFlowManagement = [];
    const supplierRelationships = [];
    const riskMitigation = [];

    // Inventory optimization
    inventoryOptimization.push(
      'Implement automatic reordering untuk high-velocity items',
    );
    inventoryOptimization.push(
      'Regular review safety stock levels berdasarkan demand variability',
    );
    inventoryOptimization.push(
      'Use ABC analysis untuk prioritize inventory investment',
    );

    // Cash flow management
    if (summary.totalReorderValue > 100000000) {
      cashFlowManagement.push(
        `Total investment dibutuhkan: Rp ${(
          summary.totalReorderValue / 1000000
        ).toFixed(1)}M`,
      );
    }
    cashFlowManagement.push(
      'Schedule reorders untuk optimize cash flow timing',
    );
    cashFlowManagement.push('Negotiate payment terms dengan suppliers');

    // Supplier relationships
    supplierRelationships.push(
      'Consolidate orders untuk leverage volume discounts',
    );
    supplierRelationships.push('Develop backup suppliers untuk critical items');
    supplierRelationships.push('Regular supplier performance review');

    // Risk mitigation
    riskMitigation.push(
      'Monitor lead time performance dan adjust safety stock',
    );
    riskMitigation.push('Implement demand sensing untuk early warning');
    riskMitigation.push(
      'Regular review forecast accuracy dan model performance',
    );

    return {
      inventoryOptimization,
      cashFlowManagement,
      supplierRelationships,
      riskMitigation,
    };
  }
}
