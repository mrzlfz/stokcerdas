import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as moment from 'moment-timezone';

import { ReorderRule, ReorderRuleType } from '../entities/reorder-rule.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Product } from '../../products/entities/product.entity';
import {
  InventoryTransaction,
  TransactionType,
} from '../../inventory/entities/inventory-transaction.entity';
import { ForecastingService } from '../../ml-forecasting/services/forecasting.service';

export interface ReorderCalculationRequest {
  reorderRule: ReorderRule;
  inventoryItem: InventoryItem;
  product: Product;
  currentDate?: Date;
  overrides?: {
    leadTimeDays?: number;
    serviceLevel?: number;
    forecastHorizon?: number;
    budgetConstraint?: number;
  };
}

export interface DemandAnalysis {
  averageDailyDemand: number;
  demandVariance: number;
  demandStandardDeviation: number;
  totalDemand: number;
  demandTrend: 'increasing' | 'decreasing' | 'stable';
  seasonalityFactor: number;
  confidenceLevel: number;
  dataPoints: number;
  forecastDemand?: number;
  forecastConfidence?: number;
}

export interface EOQCalculation {
  economicOrderQuantity: number;
  totalCost: number;
  orderingCost: number;
  holdingCost: number;
  optimalOrderFrequency: number; // orders per year
  costSavings: number; // vs current order quantity
}

export interface SafetyStockCalculation {
  safetyStock: number;
  serviceLevel: number;
  zScore: number;
  leadTimeDemand: number;
  leadTimeVariance: number;
  demandDuringLeadTime: number;
  stockoutRisk: number; // probability
}

export interface ReorderCalculationResult {
  // Input validation
  isValid: boolean;
  validationErrors: string[];

  // Core calculations
  recommendedReorderPoint: number;
  recommendedOrderQuantity: number;
  currentStock: number;
  availableStock: number;

  // Analysis components
  demandAnalysis: DemandAnalysis;
  eoqCalculation?: EOQCalculation;
  safetyStockCalculation: SafetyStockCalculation;

  // Timing and urgency
  urgencyScore: number; // 0-10, higher = more urgent
  daysUntilStockout: number;
  shouldReorderNow: boolean;

  // Financial impact
  estimatedOrderValue: number;
  budgetImpact: number;
  costPerDayOfStock: number;

  // Risk assessment
  stockoutRisk: number;
  overstockRisk: number;
  riskMitigationSuggestions: string[];

  // Metadata
  calculatedAt: Date;
  calculationMethod: string;
  confidenceLevel: number;
  dataQuality: number; // 0-1, higher = better data

  // Additional insights
  insights: {
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    priority: number;
  }[];
}

@Injectable()
export class ReorderCalculationService {
  private readonly logger = new Logger(ReorderCalculationService.name);

  constructor(
    @InjectRepository(ReorderRule)
    private readonly reorderRuleRepository: Repository<ReorderRule>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly forecastingService: ForecastingService,
  ) {}

  /**
   * Calculate reorder recommendations based on rule and current inventory
   */
  async calculateReorderRecommendation(
    request: ReorderCalculationRequest,
  ): Promise<ReorderCalculationResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Calculating reorder for product ${request.product.id}, rule ${request.reorderRule.id}`,
      );

      // Validate inputs
      const validation = this.validateInputs(request);
      if (!validation.isValid) {
        return this.createInvalidResult(validation.errors);
      }

      // Get demand analysis
      const demandAnalysis = await this.analyzeDemand(request);

      // Calculate safety stock
      const safetyStock = this.calculateSafetyStock(request, demandAnalysis);

      // Calculate EOQ if applicable
      let eoqCalculation: EOQCalculation | undefined;
      if (request.reorderRule.ruleType === ReorderRuleType.EOQ) {
        eoqCalculation = this.calculateEOQ(request, demandAnalysis);
      }

      // Determine reorder point and quantity
      const { reorderPoint, orderQuantity } = this.determineReorderParameters(
        request,
        demandAnalysis,
        safetyStock,
        eoqCalculation,
      );

      // Calculate urgency and timing
      const urgencyAnalysis = this.calculateUrgency(request, reorderPoint);

      // Financial impact analysis
      const financialImpact = this.calculateFinancialImpact(
        request,
        orderQuantity,
        demandAnalysis,
      );

      // Risk assessment
      const riskAssessment = this.assessRisks(
        request,
        reorderPoint,
        orderQuantity,
        demandAnalysis,
      );

      // Generate insights
      const insights = this.generateInsights(
        request,
        demandAnalysis,
        urgencyAnalysis,
        riskAssessment,
      );

      const calculationTime = Date.now() - startTime;
      this.logger.debug(
        `Reorder calculation completed in ${calculationTime}ms`,
      );

      return {
        isValid: true,
        validationErrors: [],
        recommendedReorderPoint: reorderPoint,
        recommendedOrderQuantity: orderQuantity,
        currentStock: request.inventoryItem.quantityOnHand,
        availableStock: request.inventoryItem.quantityAvailable,
        demandAnalysis,
        eoqCalculation,
        safetyStockCalculation: safetyStock,
        urgencyScore: urgencyAnalysis.urgencyScore,
        daysUntilStockout: urgencyAnalysis.daysUntilStockout,
        shouldReorderNow: urgencyAnalysis.shouldReorderNow,
        estimatedOrderValue: financialImpact.estimatedOrderValue,
        budgetImpact: financialImpact.budgetImpact,
        costPerDayOfStock: financialImpact.costPerDayOfStock,
        stockoutRisk: riskAssessment.stockoutRisk,
        overstockRisk: riskAssessment.overstockRisk,
        riskMitigationSuggestions: riskAssessment.suggestions,
        calculatedAt: new Date(),
        calculationMethod: request.reorderRule.ruleType,
        confidenceLevel: demandAnalysis.confidenceLevel,
        dataQuality: this.calculateDataQuality(demandAnalysis),
        insights,
      };
    } catch (error) {
      this.logger.error(
        `Error in reorder calculation: ${error.message}`,
        error.stack,
      );
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Analyze historical demand patterns
   */
  private async analyzeDemand(
    request: ReorderCalculationRequest,
  ): Promise<DemandAnalysis> {
    const { reorderRule, inventoryItem, product } = request;
    const lookbackDays = reorderRule.demandLookbackDays || 30;

    // Get historical transactions
    const endDate = request.currentDate || new Date();
    const startDate = moment(endDate).subtract(lookbackDays, 'days').toDate();

    const transactions = await this.inventoryTransactionRepository.find({
      where: {
        tenantId: reorderRule.tenantId,
        inventoryItemId: inventoryItem.id,
        transactionDate: { $gte: startDate, $lte: endDate } as any,
        type: TransactionType.ISSUE, // Only outbound transactions (sales/usage)
      },
      order: { transactionDate: 'DESC' },
    });

    // Process demand data
    const dailyDemand = this.aggregateDailyDemand(
      transactions,
      startDate,
      endDate,
    );
    const totalDemand = dailyDemand.reduce((sum, demand) => sum + demand, 0);
    const averageDailyDemand = totalDemand / lookbackDays;

    // Calculate variance and standard deviation
    const demandVariance = this.calculateVariance(
      dailyDemand,
      averageDailyDemand,
    );
    const demandStandardDeviation = Math.sqrt(demandVariance);

    // Determine trend
    const demandTrend = this.calculateTrend(dailyDemand);

    // Get seasonality factor
    const seasonalityFactor = reorderRule.getSeasonalFactor();

    // Get forecast if enabled
    let forecastDemand: number | undefined;
    let forecastConfidence: number | undefined;

    if (reorderRule.useForecastingData) {
      try {
        const forecast = await this.forecastingService.generateDemandForecast(
          reorderRule.tenantId,
          {
            productId: product.id,
            forecastHorizonDays: reorderRule.forecastHorizonDays,
            includeConfidenceInterval: true,
            includeSeasonality: true,
            includeTrendDecomposition: false,
            granularity: 'daily',
          },
        );

        if (forecast.success && forecast.timeSeries.length > 0) {
          // Sum up forecast for lead time period
          const leadTimeDays = reorderRule.leadTimeDays || 7;
          forecastDemand = forecast.timeSeries
            .slice(0, leadTimeDays)
            .reduce((sum, point) => sum + point.predictedDemand, 0);
          forecastConfidence = forecast.overallConfidence;
        }
      } catch (error) {
        this.logger.warn(`Failed to get forecast data: ${error.message}`);
      }
    }

    return {
      averageDailyDemand,
      demandVariance,
      demandStandardDeviation,
      totalDemand,
      demandTrend,
      seasonalityFactor,
      confidenceLevel: this.calculateConfidenceLevel(
        dailyDemand.length,
        demandVariance,
      ),
      dataPoints: dailyDemand.length,
      forecastDemand,
      forecastConfidence,
    };
  }

  /**
   * Calculate Economic Order Quantity
   */
  private calculateEOQ(
    request: ReorderCalculationRequest,
    demandAnalysis: DemandAnalysis,
  ): EOQCalculation {
    const { reorderRule } = request;

    const annualDemand =
      reorderRule.annualDemand || demandAnalysis.averageDailyDemand * 365;
    const orderingCost = reorderRule.orderingCost || 50000; // Default IDR 50k per order
    const unitCost = reorderRule.unitCost || request.product.costPrice || 0;
    const holdingCostRate = (reorderRule.holdingCostRate || 25) / 100; // Convert percentage

    const holdingCostPerUnit = unitCost * holdingCostRate;

    // Classic EOQ formula: √(2DS/H)
    const eoq = Math.sqrt(
      (2 * annualDemand * orderingCost) / holdingCostPerUnit,
    );

    // Calculate total costs
    const optimalOrderQuantity = Math.round(eoq);
    const numberOfOrders = annualDemand / optimalOrderQuantity;
    const totalOrderingCost = numberOfOrders * orderingCost;
    const averageInventory = optimalOrderQuantity / 2;
    const totalHoldingCost = averageInventory * holdingCostPerUnit;
    const totalCost = totalOrderingCost + totalHoldingCost;

    // Calculate cost savings vs current order quantity
    const currentOrderQuantity = reorderRule.reorderQuantity;
    const currentNumberOfOrders = annualDemand / currentOrderQuantity;
    const currentOrderingCost = currentNumberOfOrders * orderingCost;
    const currentAverageInventory = currentOrderQuantity / 2;
    const currentHoldingCost = currentAverageInventory * holdingCostPerUnit;
    const currentTotalCost = currentOrderingCost + currentHoldingCost;

    const costSavings = currentTotalCost - totalCost;

    return {
      economicOrderQuantity: optimalOrderQuantity,
      totalCost,
      orderingCost: totalOrderingCost,
      holdingCost: totalHoldingCost,
      optimalOrderFrequency: numberOfOrders,
      costSavings,
    };
  }

  /**
   * Calculate safety stock requirements
   */
  private calculateSafetyStock(
    request: ReorderCalculationRequest,
    demandAnalysis: DemandAnalysis,
  ): SafetyStockCalculation {
    const { reorderRule } = request;

    const serviceLevel = reorderRule.effectiveServiceLevel;
    const leadTimeDays = reorderRule.leadTimeDays || 7;
    const zScore = this.getZScoreForServiceLevel(serviceLevel);

    // Lead time demand
    const leadTimeDemand = demandAnalysis.averageDailyDemand * leadTimeDays;

    // Lead time variance (assuming demand variance is independent each day)
    const leadTimeVariance = leadTimeDays * demandAnalysis.demandVariance;
    const leadTimeStandardDeviation = Math.sqrt(leadTimeVariance);

    // Safety stock calculation
    const safetyStock = Math.round(zScore * leadTimeStandardDeviation);

    // Calculate stockout risk
    const stockoutRisk = 1 - serviceLevel;

    return {
      safetyStock: Math.max(0, safetyStock),
      serviceLevel,
      zScore,
      leadTimeDemand,
      leadTimeVariance,
      demandDuringLeadTime: leadTimeDemand,
      stockoutRisk,
    };
  }

  /**
   * Determine final reorder point and quantity
   */
  private determineReorderParameters(
    request: ReorderCalculationRequest,
    demandAnalysis: DemandAnalysis,
    safetyStock: SafetyStockCalculation,
    eoqCalculation?: EOQCalculation,
  ): { reorderPoint: number; orderQuantity: number } {
    const { reorderRule } = request;

    let reorderPoint: number;
    let orderQuantity: number;

    // Calculate base reorder point
    reorderPoint = safetyStock.leadTimeDemand + safetyStock.safetyStock;

    // Apply seasonal adjustment
    reorderPoint = Math.round(reorderPoint * demandAnalysis.seasonalityFactor);

    // Determine order quantity based on rule type
    switch (reorderRule.ruleType) {
      case ReorderRuleType.EOQ:
        orderQuantity =
          eoqCalculation?.economicOrderQuantity || reorderRule.reorderQuantity;
        break;

      case ReorderRuleType.DEMAND_BASED:
        // Order for demand period * multiplier
        const demandPeriod = reorderRule.forecastHorizonDays || 30;
        const baseDemand =
          demandAnalysis.forecastDemand ||
          demandAnalysis.averageDailyDemand * demandPeriod;
        orderQuantity = Math.round(baseDemand * reorderRule.demandMultiplier);
        break;

      case ReorderRuleType.MIN_MAX:
        // Order up to max level
        const maxLevel = reorderRule.maxStockLevel || reorderPoint * 2;
        const currentStock = request.inventoryItem.quantityOnHand;
        orderQuantity = Math.max(0, maxLevel - currentStock);
        break;

      case ReorderRuleType.SEASONAL:
        // Seasonal adjustment to standard quantity
        orderQuantity = Math.round(
          reorderRule.reorderQuantity * demandAnalysis.seasonalityFactor,
        );
        break;

      default:
        orderQuantity = reorderRule.reorderQuantity;
    }

    // Apply constraints
    if (reorderRule.minOrderQuantity) {
      orderQuantity = Math.max(orderQuantity, reorderRule.minOrderQuantity);
    }

    if (reorderRule.maxOrderQuantity) {
      orderQuantity = Math.min(orderQuantity, reorderRule.maxOrderQuantity);
    }

    // Budget constraint
    if (reorderRule.maxOrderValue && request.product.costPrice) {
      const maxQuantityByBudget = Math.floor(
        reorderRule.maxOrderValue / request.product.costPrice,
      );
      orderQuantity = Math.min(orderQuantity, maxQuantityByBudget);
    }

    return { reorderPoint, orderQuantity };
  }

  /**
   * Calculate urgency and timing metrics
   */
  private calculateUrgency(
    request: ReorderCalculationRequest,
    reorderPoint: number,
  ): {
    urgencyScore: number;
    daysUntilStockout: number;
    shouldReorderNow: boolean;
  } {
    const currentStock = request.inventoryItem.quantityAvailable;
    const dailyDemand = request.reorderRule.annualDemand
      ? request.reorderRule.annualDemand / 365
      : 1; // Fallback to prevent division by zero

    const daysUntilStockout =
      dailyDemand > 0 ? currentStock / dailyDemand : Infinity;
    const leadTimeDays = request.reorderRule.leadTimeDays || 7;

    // Calculate urgency score (0-10)
    let urgencyScore = 0;

    if (currentStock <= 0) {
      urgencyScore = 10; // Critical - stockout
    } else if (currentStock <= reorderPoint * 0.5) {
      urgencyScore = 9; // Very urgent
    } else if (currentStock <= reorderPoint * 0.7) {
      urgencyScore = 7; // Urgent
    } else if (currentStock <= reorderPoint) {
      urgencyScore = 5; // Should reorder
    } else if (daysUntilStockout <= leadTimeDays) {
      urgencyScore = 8; // Time-critical
    } else if (daysUntilStockout <= leadTimeDays * 2) {
      urgencyScore = 3; // Plan ahead
    } else {
      urgencyScore = 1; // Low priority
    }

    const shouldReorderNow = currentStock <= reorderPoint || urgencyScore >= 5;

    return { urgencyScore, daysUntilStockout, shouldReorderNow };
  }

  /**
   * Calculate financial impact
   */
  private calculateFinancialImpact(
    request: ReorderCalculationRequest,
    orderQuantity: number,
    demandAnalysis: DemandAnalysis,
  ): {
    estimatedOrderValue: number;
    budgetImpact: number;
    costPerDayOfStock: number;
  } {
    const unitCost = request.product.costPrice || 0;
    const estimatedOrderValue = orderQuantity * unitCost;

    // Budget impact as percentage of remaining budget
    const remainingBudget = request.reorderRule.remainingBudget;
    const budgetImpact =
      remainingBudget === Infinity
        ? 0
        : (estimatedOrderValue / remainingBudget) * 100;

    // Cost per day of stock
    const holdingCostRate =
      (request.reorderRule.holdingCostRate || 25) / 100 / 365;
    const costPerDayOfStock = unitCost * holdingCostRate;

    return { estimatedOrderValue, budgetImpact, costPerDayOfStock };
  }

  /**
   * Assess risks
   */
  private assessRisks(
    request: ReorderCalculationRequest,
    reorderPoint: number,
    orderQuantity: number,
    demandAnalysis: DemandAnalysis,
  ): { stockoutRisk: number; overstockRisk: number; suggestions: string[] } {
    const currentStock = request.inventoryItem.quantityAvailable;
    const leadTimeDays = request.reorderRule.leadTimeDays || 7;
    const avgDailyDemand = demandAnalysis.averageDailyDemand;

    // Stockout risk
    const demandDuringLeadTime = avgDailyDemand * leadTimeDays;
    const stockoutRisk =
      currentStock < demandDuringLeadTime
        ? Math.max(
            0,
            (demandDuringLeadTime - currentStock) / demandDuringLeadTime,
          )
        : 0;

    // Overstock risk
    const futureStock = currentStock + orderQuantity;
    const daysOfSupply =
      avgDailyDemand > 0 ? futureStock / avgDailyDemand : Infinity;
    const optimalDaysOfSupply = leadTimeDays + 30; // Lead time + 1 month buffer
    const overstockRisk =
      daysOfSupply > optimalDaysOfSupply
        ? Math.min(
            1,
            (daysOfSupply - optimalDaysOfSupply) / optimalDaysOfSupply,
          )
        : 0;

    // Generate suggestions
    const suggestions: string[] = [];

    if (stockoutRisk > 0.3) {
      suggestions.push('Consider expedited shipping or emergency purchase');
    }

    if (overstockRisk > 0.3) {
      suggestions.push('Reduce order quantity to avoid excess inventory');
    }

    if (demandAnalysis.confidenceLevel < 0.7) {
      suggestions.push('Improve demand data quality for better predictions');
    }

    if (demandAnalysis.demandTrend === 'increasing') {
      suggestions.push(
        'Consider increasing reorder point due to growing demand',
      );
    } else if (demandAnalysis.demandTrend === 'decreasing') {
      suggestions.push('Review reorder rules - demand appears to be declining');
    }

    return { stockoutRisk, overstockRisk, suggestions };
  }

  /**
   * Generate actionable insights
   */
  private generateInsights(
    request: ReorderCalculationRequest,
    demandAnalysis: DemandAnalysis,
    urgencyAnalysis: { urgencyScore: number; daysUntilStockout: number },
    riskAssessment: { stockoutRisk: number; overstockRisk: number },
  ): Array<{
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    priority: number;
  }> {
    const insights = [];

    // Urgency insights
    if (urgencyAnalysis.urgencyScore >= 8) {
      insights.push({
        message: `Critical: Only ${Math.round(
          urgencyAnalysis.daysUntilStockout,
        )} days until stockout`,
        type: 'error' as const,
        priority: 10,
      });
    } else if (urgencyAnalysis.urgencyScore >= 5) {
      insights.push({
        message: 'Reorder recommended based on current stock levels',
        type: 'warning' as const,
        priority: 7,
      });
    }

    // Risk insights
    if (riskAssessment.stockoutRisk > 0.5) {
      insights.push({
        message: 'High stockout risk detected - consider emergency reorder',
        type: 'error' as const,
        priority: 9,
      });
    }

    if (riskAssessment.overstockRisk > 0.5) {
      insights.push({
        message: 'Overstock risk - consider reducing order quantity',
        type: 'warning' as const,
        priority: 6,
      });
    }

    // Demand insights
    if (demandAnalysis.demandTrend === 'increasing') {
      insights.push({
        message: 'Demand is trending upward - consider adjusting reorder rules',
        type: 'info' as const,
        priority: 5,
      });
    }

    if (demandAnalysis.confidenceLevel < 0.6) {
      insights.push({
        message: 'Low data confidence - predictions may be unreliable',
        type: 'warning' as const,
        priority: 4,
      });
    }

    // Seasonal insights
    if (demandAnalysis.seasonalityFactor > 1.2) {
      insights.push({
        message: 'Peak season detected - 20% higher demand expected',
        type: 'info' as const,
        priority: 6,
      });
    } else if (demandAnalysis.seasonalityFactor < 0.8) {
      insights.push({
        message: 'Low season - 20% lower demand expected',
        type: 'info' as const,
        priority: 3,
      });
    }

    return insights.sort((a, b) => b.priority - a.priority);
  }

  // Helper methods
  private validateInputs(request: ReorderCalculationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.reorderRule) {
      errors.push('Reorder rule is required');
    }

    if (!request.inventoryItem) {
      errors.push('Inventory item is required');
    }

    if (!request.product) {
      errors.push('Product is required');
    }

    if (
      request.reorderRule?.leadTimeDays &&
      request.reorderRule.leadTimeDays < 0
    ) {
      errors.push('Lead time cannot be negative');
    }

    if (
      request.reorderRule?.serviceLevel &&
      (request.reorderRule.serviceLevel < 0 ||
        request.reorderRule.serviceLevel > 1)
    ) {
      errors.push('Service level must be between 0 and 1');
    }

    return { isValid: errors.length === 0, errors };
  }

  private aggregateDailyDemand(
    transactions: InventoryTransaction[],
    startDate: Date,
    endDate: Date,
  ): number[] {
    const dailyDemand: { [date: string]: number } = {};
    const totalDays = moment(endDate).diff(moment(startDate), 'days') + 1;

    // Initialize all days with 0
    for (let i = 0; i < totalDays; i++) {
      const date = moment(startDate).add(i, 'days').format('YYYY-MM-DD');
      dailyDemand[date] = 0;
    }

    // Aggregate transactions by day
    transactions.forEach(transaction => {
      const date = moment(transaction.transactionDate).format('YYYY-MM-DD');
      if (dailyDemand[date] !== undefined) {
        dailyDemand[date] += Math.abs(transaction.quantity);
      }
    });

    return Object.values(dailyDemand);
  }

  private calculateVariance(values: number[], mean: number): number {
    if (values.length === 0) return 0;

    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    return (
      squaredDifferences.reduce((sum, sqDiff) => sum + sqDiff, 0) /
      values.length
    );
  }

  private calculateTrend(
    values: number[],
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 7) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstHalfAvg =
      firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateConfidenceLevel(
    dataPoints: number,
    variance: number,
  ): number {
    // Simple confidence calculation based on data points and variance
    let confidence = Math.min(dataPoints / 30, 1); // More data = higher confidence

    // Lower confidence for high variance
    if (variance > 0) {
      const cvThreshold = 0.5; // Coefficient of variation threshold
      const penaltyFactor = Math.min(variance / cvThreshold, 1);
      confidence *= 1 - penaltyFactor * 0.3;
    }

    return Math.max(0.1, confidence);
  }

  private calculateDataQuality(demandAnalysis: DemandAnalysis): number {
    let quality = 1.0;

    // Penalize for low data points
    if (demandAnalysis.dataPoints < 14) {
      quality *= 0.7;
    } else if (demandAnalysis.dataPoints < 7) {
      quality *= 0.4;
    }

    // Penalize for high variance
    const coefficientOfVariation =
      demandAnalysis.demandStandardDeviation /
      Math.max(demandAnalysis.averageDailyDemand, 0.1);
    if (coefficientOfVariation > 1) {
      quality *= 0.8;
    } else if (coefficientOfVariation > 2) {
      quality *= 0.6;
    }

    return Math.max(0.1, quality);
  }

  private getZScoreForServiceLevel(serviceLevel: number): number {
    // Z-score lookup table for service levels
    const zScores: { [key: number]: number } = {
      0.5: 0.0,
      0.6: 0.25,
      0.7: 0.52,
      0.8: 0.84,
      0.85: 1.04,
      0.9: 1.28,
      0.95: 1.65,
      0.97: 1.88,
      0.98: 2.05,
      0.99: 2.33,
      0.995: 2.58,
      0.999: 3.09,
    };

    // Find closest service level
    let closestLevel = 0.95; // Default
    let minDiff = Math.abs(serviceLevel - closestLevel);

    Object.keys(zScores).forEach(level => {
      const levelNum = parseFloat(level);
      const diff = Math.abs(serviceLevel - levelNum);
      if (diff < minDiff) {
        minDiff = diff;
        closestLevel = levelNum;
      }
    });

    return zScores[closestLevel];
  }

  private createInvalidResult(errors: string[]): ReorderCalculationResult {
    return {
      isValid: false,
      validationErrors: errors,
      recommendedReorderPoint: 0,
      recommendedOrderQuantity: 0,
      currentStock: 0,
      availableStock: 0,
      demandAnalysis: {
        averageDailyDemand: 0,
        demandVariance: 0,
        demandStandardDeviation: 0,
        totalDemand: 0,
        demandTrend: 'stable',
        seasonalityFactor: 1,
        confidenceLevel: 0,
        dataPoints: 0,
      },
      safetyStockCalculation: {
        safetyStock: 0,
        serviceLevel: 0.95,
        zScore: 1.65,
        leadTimeDemand: 0,
        leadTimeVariance: 0,
        demandDuringLeadTime: 0,
        stockoutRisk: 1,
      },
      urgencyScore: 0,
      daysUntilStockout: 0,
      shouldReorderNow: false,
      estimatedOrderValue: 0,
      budgetImpact: 0,
      costPerDayOfStock: 0,
      stockoutRisk: 0,
      overstockRisk: 0,
      riskMitigationSuggestions: [],
      calculatedAt: new Date(),
      calculationMethod: 'validation_failed',
      confidenceLevel: 0,
      dataQuality: 0,
      insights: errors.map(error => ({
        message: error,
        type: 'error' as const,
        priority: 10,
      })),
    };
  }

  private createErrorResult(errorMessage: string): ReorderCalculationResult {
    return this.createInvalidResult([`Calculation error: ${errorMessage}`]);
  }

  // CRUD Methods for ReorderRule management

  async createReorderRule(
    tenantId: string,
    createDto: any,
    userId: string,
  ): Promise<ReorderRule> {
    const reorderRule = this.reorderRuleRepository.create({
      ...createDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.reorderRuleRepository.save(reorderRule as any);
  }

  async findReorderRules(tenantId: string, query: any): Promise<ReorderRule[]> {
    const where: any = { tenantId, isDeleted: false };

    if (query.productId) where.productId = query.productId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.type) where.type = query.type;

    return this.reorderRuleRepository.find({
      where,
      relations: ['product', 'location'],
      order: { createdAt: 'DESC' },
      take: query.limit || 50,
      skip: query.offset || 0,
    });
  }

  async findReorderRuleById(
    tenantId: string,
    id: string,
  ): Promise<ReorderRule> {
    return this.reorderRuleRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['product', 'location'],
    });
  }

  async updateReorderRule(
    tenantId: string,
    id: string,
    updateDto: any,
    userId: string,
  ): Promise<ReorderRule> {
    await this.reorderRuleRepository.update(
      { id, tenantId },
      { ...updateDto, updatedBy: userId, updatedAt: new Date() },
    );

    return this.findReorderRuleById(tenantId, id);
  }

  async deleteReorderRule(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    await this.reorderRuleRepository.update(
      { id, tenantId },
      { isDeleted: true, updatedBy: userId, updatedAt: new Date() },
    );
  }

  async pauseReorderRule(
    tenantId: string,
    id: string,
    reason: string,
    userId: string,
  ): Promise<ReorderRule> {
    await this.reorderRuleRepository.update(
      { id, tenantId },
      {
        isActive: false,
        isPaused: true,
        pauseReason: reason,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    );

    return this.findReorderRuleById(tenantId, id);
  }

  async resumeReorderRule(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<ReorderRule> {
    await this.reorderRuleRepository.update(
      { id, tenantId },
      {
        isActive: true,
        isPaused: false,
        pauseReason: null,
        pausedUntil: null,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    );

    return this.findReorderRuleById(tenantId, id);
  }

  async bulkActionReorderRules(
    tenantId: string,
    action: string,
    ruleIds: string[],
    userId: string,
  ): Promise<any> {
    let result;

    switch (action) {
      case 'activate':
        result = await this.reorderRuleRepository.update(
          { id: { $in: ruleIds } as any, tenantId },
          { isActive: true, updatedBy: userId, updatedAt: new Date() },
        );
        break;
      case 'deactivate':
        result = await this.reorderRuleRepository.update(
          { id: { $in: ruleIds } as any, tenantId },
          { isActive: false, updatedBy: userId, updatedAt: new Date() },
        );
        break;
      case 'delete':
        result = await this.reorderRuleRepository.update(
          { id: { $in: ruleIds } as any, tenantId },
          { isDeleted: true, updatedBy: userId, updatedAt: new Date() },
        );
        break;
      default:
        throw new Error(`Unknown bulk action: ${action}`);
    }

    return {
      success: true,
      affected: result.affected || 0,
      message: `Successfully ${action}d ${result.affected || 0} reorder rules`,
    };
  }

  // Get metrics for a specific reorder rule
  async getReorderRuleMetrics(tenantId: string, ruleId: string): Promise<any> {
    const rule = await this.findReorderRuleById(tenantId, ruleId);
    if (!rule) {
      throw new Error(`Reorder rule not found: ${ruleId}`);
    }

    // Mock metrics - in a real implementation, this would query execution history
    return {
      ruleId,
      ruleName: rule.name,
      totalExecutions: Math.floor(Math.random() * 100),
      successfulExecutions: Math.floor(Math.random() * 80),
      failedExecutions: Math.floor(Math.random() * 10),
      averageExecutionTime: Math.floor(Math.random() * 5000) + 1000,
      totalValueGenerated: Math.floor(Math.random() * 1000000),
      lastExecution: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      ),
      nextScheduledExecution: new Date(
        Date.now() + Math.random() * 24 * 60 * 60 * 1000,
      ),
      efficiency: 0.85 + Math.random() * 0.1,
    };
  }

  // Debug a reorder rule calculation
  async debugReorderRule(tenantId: string, ruleId: string): Promise<any> {
    const rule = await this.findReorderRuleById(tenantId, ruleId);
    if (!rule) {
      throw new Error(`Reorder rule not found: ${ruleId}`);
    }

    // Mock debug info - in a real implementation, this would show calculation steps
    return {
      ruleId,
      debugInfo: {
        lastCalculationAt: new Date(),
        calculationSteps: [
          { step: 'Fetch inventory data', duration: 150, status: 'success' },
          { step: 'Analyze demand', duration: 300, status: 'success' },
          { step: 'Calculate EOQ', duration: 50, status: 'success' },
          { step: 'Apply safety stock', duration: 25, status: 'success' },
          { step: 'Generate recommendation', duration: 75, status: 'success' },
        ],
        inputData: {
          currentStock: 45,
          reorderPoint: 20,
          leadTime: 7,
          averageDemand: 5.2,
        },
        outputData: {
          shouldReorder: true,
          recommendedQuantity: 100,
          urgencyScore: 7.5,
          estimatedCost: 5000,
        },
      },
    };
  }

  // Simulate reorder rule execution
  async simulateReorderRule(
    tenantId: string,
    ruleId: string,
    simulationParams: any,
  ): Promise<any> {
    const rule = await this.findReorderRuleById(tenantId, ruleId);
    if (!rule) {
      throw new Error(`Reorder rule not found: ${ruleId}`);
    }

    // Mock simulation - in a real implementation, this would run a what-if scenario
    return {
      ruleId,
      simulationParams,
      results: {
        scenario: 'normal_conditions',
        wouldTrigger: true,
        estimatedQuantity: simulationParams.quantity || 100,
        estimatedCost:
          (simulationParams.quantity || 100) *
          (simulationParams.unitCost || 50),
        estimatedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        riskFactors: [
          { factor: 'Supplier reliability', risk: 'low' },
          { factor: 'Demand volatility', risk: 'medium' },
          { factor: 'Lead time variance', risk: 'low' },
        ],
        recommendations: [
          'Consider increasing safety stock by 10%',
          'Monitor supplier performance closely',
        ],
      },
    };
  }
}
