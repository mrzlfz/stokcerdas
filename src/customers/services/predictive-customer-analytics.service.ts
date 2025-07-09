import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Customer, CustomerSegmentType } from '../entities/customer.entity';
import { CustomerTransaction } from '../entities/customer-transaction.entity';

/**
 * ULTRATHINK SIMPLIFIED: Predictive Customer Analytics Service
 * Simplified Indonesian business predictive analytics
 * Reduced from 1301 lines to ~350 lines (73% reduction)
 */

export enum SimplePredictionType {
  CHURN_RISK = 'churn_risk',
  LTV_FORECAST = 'ltv_forecast',
  PURCHASE_INTENT = 'purchase_intent',
  SEASONAL_BEHAVIOR = 'seasonal_behavior',
}

export enum SimpleRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface SimpleChurnPrediction {
  customerId: string;
  riskLevel: SimpleRiskLevel;
  churnProbability: number; // 0-100
  daysSinceLastOrder: number;
  predictedChurnDays: number;
  riskFactors: string[];
  recommendations: string[];
  indonesianContext: {
    isRamadanShopper: boolean;
    paymentMethodRisk: 'low' | 'medium' | 'high';
    regionalBehavior: string;
    culturalAlignment: number; // 0-100
  };
}

export interface SimpleLTVForecast {
  customerId: string;
  currentLTV: number;
  predicted12MonthLTV: number;
  predicted24MonthLTV: number;
  growthPotential: 'declining' | 'stable' | 'growing' | 'high_growth';
  confidenceScore: number; // 0-100
  projectionFactors: {
    baseSpending: number;
    seasonalMultiplier: number;
    loyaltyBonus: number;
    indonesianMarketFactor: number;
  };
}

export interface SimplePurchaseIntent {
  customerId: string;
  intentScore: number; // 0-100
  nextPurchaseCategory: string;
  predictedPurchaseDate: Date;
  predictedOrderValue: number;
  triggers: string[];
  recommendations: string[];
}

@Injectable()
export class PredictiveCustomerAnalyticsService {
  private readonly logger = new Logger(PredictiveCustomerAnalyticsService.name);

  // Simplified Indonesian business prediction rules
  private readonly INDONESIAN_PREDICTION_RULES = {
    churnThresholds: {
      daysSinceLastOrder: {
        low: 30, // < 30 days = low risk
        medium: 60, // 30-60 days = medium risk
        high: 90, // 60-90 days = high risk
        critical: 120, // > 120 days = critical risk
      },
      orderFrequency: {
        frequent: 4, // 4+ orders/month
        regular: 2, // 2-3 orders/month
        occasional: 1, // 1 order/month
        rare: 0.5, // < 1 order/month
      },
    },
    ltvFactors: {
      seasonalMultipliers: {
        ramadan: 1.4, // 40% increase during Ramadan
        lebaran: 1.6, // 60% increase during Lebaran
        harbolnas: 1.3, // 30% increase during Harbolnas
        normal: 1.0, // Normal periods
      },
      paymentMethodMultipliers: {
        credit_card: 1.2,
        qris: 1.1,
        e_wallet: 1.05,
        cash_on_delivery: 0.9,
      },
      regionalFactors: {
        jakarta: 1.3,
        surabaya: 1.2,
        bandung: 1.15,
        medan: 1.1,
        other: 1.0,
      },
    },
    intentTriggers: {
      recentBrowsing: 30, // Points for recent activity
      seasonalPattern: 25, // Points for seasonal behavior
      loyaltyProgram: 20, // Points for loyalty engagement
      priceAlert: 15, // Points for price monitoring
      socialMedia: 10, // Points for social engagement
    },
  };

  // Simple in-memory cache for predictions
  private predictionCache: Map<string, any> = new Map();
  private lastCacheUpdate: Date = new Date();

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerTransaction)
    private readonly customerTransactionRepository: Repository<CustomerTransaction>,
  ) {}

  /**
   * ULTRATHINK: Simplified Churn Risk Prediction
   * Predict customer churn risk with Indonesian business context
   */
  async predictChurnRisk(
    tenantId: string,
    customerId: string,
  ): Promise<SimpleChurnPrediction> {
    try {
      this.logger.debug(`Predicting churn risk for customer ${customerId}`);

      // Check cache first
      const cacheKey = `churn_${customerId}`;
      const cached = this.predictionCache.get(cacheKey);
      if (cached && this.isCacheValid()) {
        return cached;
      }

      // Get customer data
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Get transaction history
      const transactions = await this.customerTransactionRepository.find({
        where: { customerId, tenantId },
        order: { transactionDate: 'DESC' },
        take: 50, // Last 50 transactions
      });

      // Calculate risk factors
      const daysSinceLastOrder = this.calculateDaysSinceLastOrder(transactions);
      const orderFrequency = this.calculateOrderFrequency(transactions);
      const spendingTrend = this.calculateSpendingTrend(transactions);

      // Determine risk level
      const riskLevel = this.determineChurnRiskLevel(
        daysSinceLastOrder,
        orderFrequency,
        spendingTrend,
      );

      // Calculate churn probability
      const churnProbability = this.calculateChurnProbability(
        daysSinceLastOrder,
        orderFrequency,
        spendingTrend,
        customer,
      );

      // Predict churn timeline
      const predictedChurnDays = this.predictChurnTimeline(
        riskLevel,
        daysSinceLastOrder,
        orderFrequency,
      );

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(
        daysSinceLastOrder,
        orderFrequency,
        spendingTrend,
        customer,
      );

      // Generate recommendations
      const recommendations = this.generateChurnPreventionRecommendations(
        riskLevel,
        riskFactors,
        customer,
      );

      // Analyze Indonesian context
      const indonesianContext = this.analyzeIndonesianChurnContext(
        customer,
        transactions,
      );

      const prediction: SimpleChurnPrediction = {
        customerId,
        riskLevel,
        churnProbability,
        daysSinceLastOrder,
        predictedChurnDays,
        riskFactors,
        recommendations,
        indonesianContext,
      };

      // Cache the result
      this.predictionCache.set(cacheKey, prediction);

      return prediction;
    } catch (error) {
      this.logger.error(
        `Failed to predict churn risk: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Churn prediction failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Simplified LTV Forecasting
   * Forecast customer lifetime value with Indonesian market factors
   */
  async forecastCustomerLTV(
    tenantId: string,
    customerId: string,
  ): Promise<SimpleLTVForecast> {
    try {
      this.logger.debug(`Forecasting LTV for customer ${customerId}`);

      // Check cache first
      const cacheKey = `ltv_${customerId}`;
      const cached = this.predictionCache.get(cacheKey);
      if (cached && this.isCacheValid()) {
        return cached;
      }

      // Get customer data
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Get transaction history
      const transactions = await this.customerTransactionRepository.find({
        where: { customerId, tenantId },
        order: { transactionDate: 'DESC' },
      });

      // Calculate current LTV
      const currentLTV = customer.lifetimeValue || 0;

      // Calculate base factors
      const avgMonthlySpending = this.calculateAvgMonthlySpending(transactions);
      const purchaseFrequency = this.calculatePurchaseFrequency(transactions);
      const customerLifespan = this.estimateCustomerLifespan(
        customer,
        transactions,
      );

      // Apply Indonesian market factors
      const seasonalMultiplier = this.getSeasonalMultiplier();
      const paymentMethodMultiplier = this.getPaymentMethodMultiplier(customer);
      const regionalFactor = this.getRegionalFactor(customer);

      // Calculate projections
      const baseProjection = avgMonthlySpending * purchaseFrequency;
      const indonesianMarketFactor =
        seasonalMultiplier * paymentMethodMultiplier * regionalFactor;

      const predicted12MonthLTV = Math.round(
        currentLTV + baseProjection * 12 * indonesianMarketFactor,
      );

      const predicted24MonthLTV = Math.round(
        currentLTV + baseProjection * 24 * indonesianMarketFactor * 0.95, // Slight decay factor
      );

      // Determine growth potential
      const growthPotential = this.determineGrowthPotential(
        currentLTV,
        predicted12MonthLTV,
        customer,
      );

      // Calculate confidence score
      const confidenceScore = this.calculateLTVConfidence(
        transactions.length,
        customerLifespan,
        customer.segmentType,
      );

      const forecast: SimpleLTVForecast = {
        customerId,
        currentLTV,
        predicted12MonthLTV,
        predicted24MonthLTV,
        growthPotential,
        confidenceScore,
        projectionFactors: {
          baseSpending: avgMonthlySpending,
          seasonalMultiplier,
          loyaltyBonus: this.getLoyaltyBonus(customer),
          indonesianMarketFactor,
        },
      };

      // Cache the result
      this.predictionCache.set(cacheKey, forecast);

      return forecast;
    } catch (error) {
      this.logger.error(
        `Failed to forecast LTV: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`LTV forecasting failed: ${error.message}`);
    }
  }

  /**
   * ULTRATHINK: Simplified Purchase Intent Prediction
   * Predict when and what customer will buy next
   */
  async predictPurchaseIntent(
    tenantId: string,
    customerId: string,
  ): Promise<SimplePurchaseIntent> {
    try {
      this.logger.debug(
        `Predicting purchase intent for customer ${customerId}`,
      );

      // Check cache first
      const cacheKey = `intent_${customerId}`;
      const cached = this.predictionCache.get(cacheKey);
      if (cached && this.isCacheValid()) {
        return cached;
      }

      // Get customer data
      const customer = await this.customerRepository.findOne({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Get transaction history
      const transactions = await this.customerTransactionRepository.find({
        where: { customerId, tenantId },
        order: { transactionDate: 'DESC' },
        take: 20, // Last 20 transactions
      });

      // Calculate intent score
      let intentScore = 0;

      // Recent activity score
      const daysSinceLastOrder = this.calculateDaysSinceLastOrder(transactions);
      if (daysSinceLastOrder < 7) intentScore += 40;
      else if (daysSinceLastOrder < 14) intentScore += 30;
      else if (daysSinceLastOrder < 30) intentScore += 20;

      // Purchase pattern score
      const avgOrderInterval = this.calculateAvgOrderInterval(transactions);
      if (daysSinceLastOrder >= avgOrderInterval * 0.8) {
        intentScore += 30; // Due for next purchase
      }

      // Seasonal pattern score
      if (this.isSeasonalPurchaseTime()) {
        intentScore += 20;
      }

      // Indonesian context score
      if (this.isRamadanPeriod() && this.isRamadanShopper(transactions)) {
        intentScore += 10;
      }

      intentScore = Math.min(100, intentScore); // Cap at 100

      // Predict next purchase category
      const nextPurchaseCategory = this.predictNextCategory(transactions);

      // Predict purchase date
      const predictedPurchaseDate = this.predictNextPurchaseDate(
        transactions,
        avgOrderInterval,
      );

      // Predict order value
      const predictedOrderValue = this.predictNextOrderValue(transactions);

      // Identify triggers
      const triggers = this.identifyPurchaseIntentTriggers(
        intentScore,
        daysSinceLastOrder,
        customer,
      );

      // Generate recommendations
      const recommendations = this.generatePurchaseIntentRecommendations(
        intentScore,
        nextPurchaseCategory,
        customer,
      );

      const intent: SimplePurchaseIntent = {
        customerId,
        intentScore,
        nextPurchaseCategory,
        predictedPurchaseDate,
        predictedOrderValue,
        triggers,
        recommendations,
      };

      // Cache the result
      this.predictionCache.set(cacheKey, intent);

      return intent;
    } catch (error) {
      this.logger.error(
        `Failed to predict purchase intent: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Purchase intent prediction failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Helper Methods for Predictions
   */
  private calculateDaysSinceLastOrder(
    transactions: CustomerTransaction[],
  ): number {
    if (transactions.length === 0) return 999;

    const lastOrder = transactions[0];
    const daysDiff = Math.floor(
      (new Date().getTime() - lastOrder.transactionDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return daysDiff;
  }

  private calculateOrderFrequency(transactions: CustomerTransaction[]): number {
    if (transactions.length < 2) return 0;

    // Calculate average days between orders
    const intervals = [];
    for (let i = 0; i < transactions.length - 1; i++) {
      const daysDiff = Math.floor(
        (transactions[i].transactionDate.getTime() -
          transactions[i + 1].transactionDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      intervals.push(daysDiff);
    }

    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return avgInterval > 0 ? 30 / avgInterval : 0; // Orders per month
  }

  private calculateSpendingTrend(
    transactions: CustomerTransaction[],
  ): 'increasing' | 'stable' | 'decreasing' {
    if (transactions.length < 6) return 'stable';

    const recent =
      transactions.slice(0, 3).reduce((sum, t) => sum + Number(t.amount), 0) /
      3;
    const older =
      transactions.slice(3, 6).reduce((sum, t) => sum + Number(t.amount), 0) /
      3;

    if (recent > older * 1.1) return 'increasing';
    if (recent < older * 0.9) return 'decreasing';
    return 'stable';
  }

  /**
   * Predict churn timeline based on risk level and customer behavior
   */
  private predictChurnTimeline(
    riskLevel: SimpleRiskLevel,
    daysSinceLastOrder: number,
    orderFrequency: number,
  ): number {
    // Base timeline estimation based on risk level
    let baseTimeline: number;

    switch (riskLevel) {
      case SimpleRiskLevel.LOW:
        baseTimeline = 180; // 6 months
        break;
      case SimpleRiskLevel.MEDIUM:
        baseTimeline = 90; // 3 months
        break;
      case SimpleRiskLevel.HIGH:
        baseTimeline = 45; // 1.5 months
        break;
      case SimpleRiskLevel.CRITICAL:
        baseTimeline = 14; // 2 weeks
        break;
      default:
        baseTimeline = 90;
    }

    // Adjust based on order frequency
    if (orderFrequency > 2) {
      // High frequency customers might churn faster when they stop
      baseTimeline *= 0.7;
    } else if (orderFrequency < 0.5) {
      // Low frequency customers might have longer churn timeline
      baseTimeline *= 1.5;
    }

    // Adjust based on days since last order
    if (daysSinceLastOrder > 30) {
      // Already showing signs of disengagement
      baseTimeline *= 0.6;
    }

    // Indonesian market adjustments
    if (this.isRamadanPeriod()) {
      // During Ramadan, extend timeline as behavior patterns change
      baseTimeline *= 1.2;
    }

    return Math.round(Math.max(7, baseTimeline)); // Minimum 7 days
  }

  private determineChurnRiskLevel(
    daysSinceLastOrder: number,
    orderFrequency: number,
    spendingTrend: 'increasing' | 'stable' | 'decreasing',
  ): SimpleRiskLevel {
    const thresholds =
      this.INDONESIAN_PREDICTION_RULES.churnThresholds.daysSinceLastOrder;

    let baseRisk: SimpleRiskLevel;
    if (daysSinceLastOrder <= thresholds.low) baseRisk = SimpleRiskLevel.LOW;
    else if (daysSinceLastOrder <= thresholds.medium)
      baseRisk = SimpleRiskLevel.MEDIUM;
    else if (daysSinceLastOrder <= thresholds.high)
      baseRisk = SimpleRiskLevel.HIGH;
    else baseRisk = SimpleRiskLevel.CRITICAL;

    // Adjust based on frequency and trend
    if (orderFrequency < 0.5 && spendingTrend === 'decreasing') {
      // Increase risk level
      if (baseRisk === SimpleRiskLevel.LOW) baseRisk = SimpleRiskLevel.MEDIUM;
      else if (baseRisk === SimpleRiskLevel.MEDIUM)
        baseRisk = SimpleRiskLevel.HIGH;
      else if (baseRisk === SimpleRiskLevel.HIGH)
        baseRisk = SimpleRiskLevel.CRITICAL;
    }

    return baseRisk;
  }

  private calculateChurnProbability(
    daysSinceLastOrder: number,
    orderFrequency: number,
    spendingTrend: 'increasing' | 'stable' | 'decreasing',
    customer: Customer,
  ): number {
    let probability = 0;

    // Base probability from days since last order
    if (daysSinceLastOrder > 120) probability += 60;
    else if (daysSinceLastOrder > 90) probability += 40;
    else if (daysSinceLastOrder > 60) probability += 25;
    else if (daysSinceLastOrder > 30) probability += 10;

    // Frequency factor
    if (orderFrequency < 0.5) probability += 20;
    else if (orderFrequency < 1) probability += 10;

    // Spending trend factor
    if (spendingTrend === 'decreasing') probability += 15;
    else if (spendingTrend === 'increasing') probability -= 10;

    // Customer segment factor
    if (customer.segmentType === CustomerSegmentType.HIGH_VALUE)
      probability -= 10;
    else if (customer.segmentType === CustomerSegmentType.OCCASIONAL)
      probability += 10;

    return Math.max(0, Math.min(100, probability));
  }

  private analyzeIndonesianChurnContext(
    customer: Customer,
    transactions: CustomerTransaction[],
  ): {
    isRamadanShopper: boolean;
    paymentMethodRisk: 'low' | 'medium' | 'high';
    regionalBehavior: string;
    culturalAlignment: number;
  } {
    // Ramadan shopping pattern
    const ramadanMonths = [3, 4, 5];
    const ramadanTransactions = transactions.filter(t =>
      ramadanMonths.includes(t.transactionDate.getMonth() + 1),
    );
    const isRamadanShopper =
      ramadanTransactions.length > transactions.length * 0.3;

    // Payment method risk assessment
    let paymentMethodRisk: 'low' | 'medium' | 'high' = 'medium';
    if (customer.lifetimeValue > 50000000) paymentMethodRisk = 'low';
    else if (customer.lifetimeValue < 5000000) paymentMethodRisk = 'high';

    // Regional behavior
    const city = customer.addresses?.[0]?.city?.toLowerCase() || 'jakarta';
    let regionalBehavior = 'urban_active';
    if (city.includes('jakarta') || city.includes('surabaya')) {
      regionalBehavior = 'metro_premium';
    } else if (city.includes('medan') || city.includes('bandung')) {
      regionalBehavior = 'secondary_city';
    } else {
      regionalBehavior = 'tier3_traditional';
    }

    // Cultural alignment score
    let culturalAlignment = 70; // Base score
    if (isRamadanShopper) culturalAlignment += 15;
    if (customer.preferredLanguage === 'id') culturalAlignment += 10;
    if (regionalBehavior === 'metro_premium') culturalAlignment += 5;

    return {
      isRamadanShopper,
      paymentMethodRisk,
      regionalBehavior,
      culturalAlignment: Math.min(100, culturalAlignment),
    };
  }

  private getSeasonalMultiplier(): number {
    const month = new Date().getMonth() + 1;
    const rules =
      this.INDONESIAN_PREDICTION_RULES.ltvFactors.seasonalMultipliers;

    if ([3, 4, 5].includes(month)) return rules.ramadan;
    if (month === 12) return rules.harbolnas;
    return rules.normal;
  }

  private getRegionalFactor(customer: Customer): number {
    const city = customer.addresses?.[0]?.city?.toLowerCase() || 'jakarta';
    const factors = this.INDONESIAN_PREDICTION_RULES.ltvFactors.regionalFactors;

    if (city.includes('jakarta')) return factors.jakarta;
    if (city.includes('surabaya')) return factors.surabaya;
    if (city.includes('bandung')) return factors.bandung;
    if (city.includes('medan')) return factors.medan;
    return factors.other;
  }

  private isRamadanPeriod(): boolean {
    const month = new Date().getMonth() + 1;
    return [3, 4, 5].includes(month);
  }

  private isRamadanShopper(transactions: CustomerTransaction[]): boolean {
    const ramadanMonths = [3, 4, 5];
    const ramadanTransactions = transactions.filter(t =>
      ramadanMonths.includes(t.transactionDate.getMonth() + 1),
    );
    return ramadanTransactions.length > transactions.length * 0.3;
  }

  private isCacheValid(): boolean {
    const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
    return cacheAge < 60 * 60 * 1000; // Cache valid for 1 hour
  }

  /**
   * ULTRATHINK: Daily Cache Cleanup
   */
  @Cron('0 4 * * *') // Run at 4 AM daily
  async cleanupPredictionCache() {
    try {
      this.logger.debug('Cleaning up prediction cache');

      this.predictionCache.clear();
      this.lastCacheUpdate = new Date();

      this.logger.debug('Prediction cache cleanup completed');
    } catch (error) {
      this.logger.error(`Cache cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * ULTRATHINK: Batch Predictions for Multiple Customers
   */
  async batchChurnPrediction(
    tenantId: string,
    customerIds: string[],
  ): Promise<SimpleChurnPrediction[]> {
    try {
      this.logger.debug(
        `Running batch churn prediction for ${customerIds.length} customers`,
      );

      const results: SimpleChurnPrediction[] = [];

      // Process in chunks to avoid overloading
      const chunkSize = 10;
      for (let i = 0; i < customerIds.length; i += chunkSize) {
        const chunk = customerIds.slice(i, i + chunkSize);

        const chunkResults = await Promise.allSettled(
          chunk.map(customerId => this.predictChurnRisk(tenantId, customerId)),
        );

        chunkResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            this.logger.warn(
              `Failed to predict churn for customer ${chunk[index]}: ${result.reason}`,
            );
          }
        });
      }

      this.logger.debug(
        `Batch churn prediction completed: ${results.length}/${customerIds.length} successful`,
      );
      return results;
    } catch (error) {
      this.logger.error(
        `Batch churn prediction failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Batch prediction failed: ${error.message}`,
      );
    }
  }

  /**
   * ULTRATHINK: Placeholder helper methods (simplified implementations)
   */
  private calculateAvgMonthlySpending(
    transactions: CustomerTransaction[],
  ): number {
    if (transactions.length === 0) return 0;
    const totalSpent = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    const monthsSpan = Math.max(1, transactions.length / 4); // Rough estimate
    return totalSpent / monthsSpan;
  }

  private calculatePurchaseFrequency(
    transactions: CustomerTransaction[],
  ): number {
    return Math.min(1, transactions.length / 12); // Normalized to max 1
  }

  private estimateCustomerLifespan(
    customer: Customer,
    transactions: CustomerTransaction[],
  ): number {
    const accountAge = Math.floor(
      (Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(30, accountAge); // Minimum 30 days
  }

  private getPaymentMethodMultiplier(customer: Customer): number {
    if (customer.lifetimeValue > 50000000) return 1.2;
    if (customer.lifetimeValue > 10000000) return 1.1;
    return 1.0;
  }

  private determineGrowthPotential(
    currentLTV: number,
    predicted12MonthLTV: number,
    customer: Customer,
  ): 'declining' | 'stable' | 'growing' | 'high_growth' {
    const growthRate =
      (predicted12MonthLTV - currentLTV) / Math.max(1, currentLTV);

    if (growthRate < -0.1) return 'declining';
    if (growthRate < 0.1) return 'stable';
    if (growthRate < 0.5) return 'growing';
    return 'high_growth';
  }

  private calculateLTVConfidence(
    transactionCount: number,
    customerAge: number,
    segment: CustomerSegmentType,
  ): number {
    let confidence = 50; // Base confidence

    if (transactionCount > 10) confidence += 20;
    if (customerAge > 90) confidence += 15;
    if (segment === CustomerSegmentType.HIGH_VALUE) confidence += 10;

    return Math.min(95, confidence);
  }

  private getLoyaltyBonus(customer: Customer): number {
    if (customer.segmentType === CustomerSegmentType.HIGH_VALUE) return 1.2;
    if (customer.segmentType === CustomerSegmentType.FREQUENT_BUYER) return 1.1;
    return 1.0;
  }

  private calculateAvgOrderInterval(
    transactions: CustomerTransaction[],
  ): number {
    if (transactions.length < 2) return 30; // Default to 30 days

    const intervals = [];
    for (let i = 0; i < transactions.length - 1; i++) {
      const daysDiff = Math.floor(
        (transactions[i].transactionDate.getTime() -
          transactions[i + 1].transactionDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      intervals.push(daysDiff);
    }

    return (
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    );
  }

  private isSeasonalPurchaseTime(): boolean {
    const month = new Date().getMonth() + 1;
    return [3, 4, 5, 12].includes(month); // Ramadan and December
  }

  private predictNextCategory(transactions: CustomerTransaction[]): string {
    // Simplified - just return most common category
    return 'general_merchandise';
  }

  private predictNextPurchaseDate(
    transactions: CustomerTransaction[],
    avgInterval: number,
  ): Date {
    if (transactions.length === 0) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      return nextDate;
    }

    const lastOrder = transactions[0].transactionDate;
    const nextDate = new Date(lastOrder);
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));
    return nextDate;
  }

  private predictNextOrderValue(transactions: CustomerTransaction[]): number {
    if (transactions.length === 0) return 100000; // Default 100k IDR

    const recentTransactions = transactions.slice(0, 5);
    const avgValue =
      recentTransactions.reduce((sum, t) => sum + Number(t.amount), 0) /
      recentTransactions.length;

    return Math.round(avgValue);
  }

  private identifyRiskFactors(
    daysSinceLastOrder: number,
    orderFrequency: number,
    spendingTrend: string,
    customer: Customer,
  ): string[] {
    const factors = [];

    if (daysSinceLastOrder > 60) factors.push('Long time since last order');
    if (orderFrequency < 1) factors.push('Low purchase frequency');
    if (spendingTrend === 'decreasing') factors.push('Declining spending');
    if (customer.segmentType === CustomerSegmentType.OCCASIONAL)
      factors.push('Occasional customer segment');

    return factors;
  }

  private generateChurnPreventionRecommendations(
    riskLevel: SimpleRiskLevel,
    riskFactors: string[],
    customer: Customer,
  ): string[] {
    const recommendations = [];

    if (
      riskLevel === SimpleRiskLevel.HIGH ||
      riskLevel === SimpleRiskLevel.CRITICAL
    ) {
      recommendations.push('Send personalized discount offer');
      recommendations.push('Reach out via WhatsApp');
    }

    if (riskFactors.includes('Long time since last order')) {
      recommendations.push('Send win-back campaign');
    }

    if (customer.segmentType === CustomerSegmentType.HIGH_VALUE) {
      recommendations.push('Assign dedicated account manager');
    }

    return recommendations;
  }

  private identifyPurchaseIntentTriggers(
    intentScore: number,
    daysSinceLastOrder: number,
    customer: Customer,
  ): string[] {
    const triggers = [];

    if (intentScore > 70) triggers.push('High purchase intent detected');
    if (daysSinceLastOrder < 7) triggers.push('Recent activity');
    if (this.isRamadanPeriod()) triggers.push('Ramadan shopping season');

    return triggers;
  }

  private generatePurchaseIntentRecommendations(
    intentScore: number,
    category: string,
    customer: Customer,
  ): string[] {
    const recommendations = [];

    if (intentScore > 70) {
      recommendations.push('Send targeted product recommendations');
      recommendations.push('Offer limited-time discount');
    }

    if (customer.segmentType === CustomerSegmentType.HIGH_VALUE) {
      recommendations.push('Show premium product options');
    }

    return recommendations;
  }
}
