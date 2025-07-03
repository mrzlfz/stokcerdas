import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductCategory } from '../../products/entities/product-category.entity';

import {
  PriceOptimizationQueryDto,
} from '../dto/predictive-analytics-query.dto';

import {
  PriceOptimizationResponseDto,
  PriceOptimizationDto,
} from '../dto/predictive-analytics-response.dto';

import { AnalyticsMetaDto } from '../dto/analytics-response.dto';

export interface PriceElasticityAnalysis {
  elasticityCoefficient: number;
  isElastic: boolean;
  pricePoints: Array<{
    price: number;
    expectedVolume: number;
    expectedRevenue: number;
  }>;
}

export interface CompetitorPricing {
  averageMarketPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  marketPosition: 'below' | 'at' | 'above' | 'premium';
  competitiveGap: number;
}

export interface SeasonalPricing {
  peakSeasonMultiplier: number;
  lowSeasonMultiplier: number;
  holidayAdjustments: Array<{
    holiday: string;
    period: string;
    multiplier: number;
    reasoning: string;
  }>;
}

@Injectable()
export class PriceOptimizationService {
  private readonly logger = new Logger(PriceOptimizationService.name);

  // Indonesian holiday pricing patterns
  private readonly indonesianHolidays = [
    {
      name: 'Ramadan',
      period: 'March-April',
      effect: 'increase',
      multiplier: 1.15,
      categories: ['food', 'clothing', 'gifts'],
      reasoning: 'Peningkatan konsumsi dan demand untuk produk Ramadan',
    },
    {
      name: 'Lebaran/Eid',
      period: 'April-May',
      effect: 'increase',
      multiplier: 1.25,
      categories: ['clothing', 'food', 'gifts', 'electronics'],
      reasoning: 'Peak demand untuk shopping Lebaran dan THR season',
    },
    {
      name: 'Christmas/New Year',
      period: 'December-January',
      effect: 'increase',
      multiplier: 1.20,
      categories: ['gifts', 'food', 'electronics'],
      reasoning: 'Holiday season dan bonus tahun akhir',
    },
    {
      name: 'Back to School',
      period: 'June-July',
      effect: 'increase',
      multiplier: 1.10,
      categories: ['stationery', 'electronics', 'clothing'],
      reasoning: 'Persiapan tahun ajaran baru',
    },
    {
      name: 'Independence Day',
      period: 'August',
      effect: 'neutral',
      multiplier: 1.05,
      categories: ['clothing', 'food'],
      reasoning: 'Perayaan kemerdekaan dengan konsumsi moderat',
    },
  ];

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
  ) {}

  /**
   * Generate price optimization recommendations
   */
  async generatePriceOptimizations(
    tenantId: string,
    query: PriceOptimizationQueryDto,
  ): Promise<PriceOptimizationResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Generating price optimization recommendations for tenant ${tenantId}`);

      // Get products to analyze
      const products = await this.getProductsForPriceOptimization(tenantId, query);

      const priceOptimizations: PriceOptimizationDto[] = [];
      let totalRevenueImpact = 0;
      let averageMarginImprovement = 0;
      let highImpactProducts = 0;

      for (const product of products) {
        try {
          const optimization = await this.optimizeProductPrice(tenantId, product, query);
          priceOptimizations.push(optimization);

          totalRevenueImpact += optimization.revenueImpact.revenueChange;
          averageMarginImprovement += (optimization.recommendedMargin - optimization.currentMargin);
          
          if (Math.abs(optimization.revenueImpact.revenueChange) > 100000) { // 100K IDR impact
            highImpactProducts++;
          }
        } catch (error) {
          this.logger.warn(`Failed to optimize price for product ${product.id}: ${error.message}`);
        }
      }

      // Filter products that meet minimum criteria
      const filteredOptimizations = priceOptimizations.filter(opt => {
        return Math.abs(opt.priceChangePercent) >= 2; // At least 2% price change
      });

      // Sort by revenue impact (highest impact first)
      filteredOptimizations.sort((a, b) => 
        Math.abs(b.revenueImpact.revenueChange) - Math.abs(a.revenueImpact.revenueChange)
      );

      // Apply pagination
      const startIndex = ((query.page || 1) - 1) * (query.limit || 50);
      const paginatedData = filteredOptimizations.slice(startIndex, startIndex + (query.limit || 50));

      // Calculate summary statistics
      averageMarginImprovement = priceOptimizations.length > 0 
        ? averageMarginImprovement / priceOptimizations.length 
        : 0;

      const riskLevel = this.assessOverallPricingRisk(priceOptimizations);

      const summary = {
        totalProducts: products.length,
        averageMarginImprovement,
        totalRevenueImpact,
        highImpactProducts,
        riskLevel,
      };

      // Generate strategic insights
      const insights = this.generatePricingInsights(priceOptimizations, summary);

      const meta: AnalyticsMetaDto = {
        total: filteredOptimizations.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(filteredOptimizations.length / (query.limit || 50)),
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
      this.logger.error(`Failed to generate price optimizations: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to generate price optimizations: ${error.message}`);
    }
  }

  /**
   * Get products eligible for price optimization
   */
  private async getProductsForPriceOptimization(
    tenantId: string,
    query: PriceOptimizationQueryDto,
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.inventoryItems', 'inventory')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true')
      .andWhere('product.sellingPrice > 0')
      .andWhere('product.costPrice > 0');

    if (query.productId) {
      queryBuilder.andWhere('product.id = :productId', { productId: query.productId });
    }

    if (query.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
    }

    // Filter by margin threshold
    if (query.currentMarginThreshold) {
      queryBuilder.andWhere(
        '((product.sellingPrice - product.costPrice) / product.sellingPrice * 100) >= :marginThreshold',
        { marginThreshold: query.currentMarginThreshold }
      );
    }

    // Filter by minimum volume if specified
    if (query.minVolumeThreshold) {
      queryBuilder.andWhere(`
        (SELECT COALESCE(SUM(t.quantity), 0) 
         FROM inventory_transactions t 
         WHERE t.productId = product.id 
         AND t.tenantId = :tenantId 
         AND t.type = 'sale' 
         AND t.transactionDate >= :thirtyDaysAgo) >= :minVolume
      `, {
        tenantId,
        thirtyDaysAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        minVolume: query.minVolumeThreshold,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * Optimize price for a specific product
   */
  private async optimizeProductPrice(
    tenantId: string,
    product: Product,
    query: PriceOptimizationQueryDto,
  ): Promise<PriceOptimizationDto> {
    const currentPrice = product.sellingPrice || 0;
    const costPrice = product.costPrice || 0;
    const currentMargin = ((currentPrice - costPrice) / currentPrice) * 100;

    // Analyze demand elasticity
    const elasticityAnalysis = await this.analyzeDemandElasticity(tenantId, product);

    // Get competitive analysis (simulated for now)
    const competitiveAnalysis = await this.analyzeCompetitivePricing(product);

    // Calculate optimal price
    const recommendedPrice = await this.calculateOptimalPrice(
      product,
      elasticityAnalysis,
      competitiveAnalysis,
      query,
    );

    const recommendedMargin = ((recommendedPrice - costPrice) / recommendedPrice) * 100;
    const priceChangePercent = ((recommendedPrice - currentPrice) / currentPrice) * 100;

    // Calculate revenue impact
    const revenueImpact = await this.calculateRevenueImpact(
      tenantId,
      product,
      currentPrice,
      recommendedPrice,
      elasticityAnalysis,
    );

    // Determine pricing strategy
    const strategy = this.determinePricingStrategy(
      currentMargin,
      recommendedMargin,
      elasticityAnalysis,
      competitiveAnalysis,
    );

    // Generate seasonal pricing recommendations
    const seasonalPricingData = query.includeSeasonalPricing 
      ? this.generateSeasonalPricing(product, recommendedPrice)
      : undefined;
    
    const seasonalPricing = seasonalPricingData ? {
      peakSeasonAdjustment: (seasonalPricingData.peakSeasonMultiplier - 1) * 100,
      lowSeasonAdjustment: (seasonalPricingData.lowSeasonMultiplier - 1) * 100,
      holidayPricing: seasonalPricingData.holidayAdjustments.map(holiday => ({
        period: holiday.period,
        adjustment: (holiday.multiplier - 1) * 100,
        reasoning: holiday.reasoning,
      })),
    } : undefined;

    // Create implementation plan
    const implementation = this.createImplementationPlan(recommendedPrice, currentPrice);

    // Assess risks and create mitigation plan
    const riskMitigation = this.createRiskMitigation(priceChangePercent, elasticityAnalysis);

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentPrice,
      costPrice,
      currentMargin,
      recommendedPrice,
      recommendedMargin,
      priceChangePercent,
      demandElasticity: {
        elasticityCoefficient: elasticityAnalysis.elasticityCoefficient,
        isElastic: elasticityAnalysis.isElastic,
        expectedVolumeChange: this.calculateVolumeChange(priceChangePercent, elasticityAnalysis.elasticityCoefficient),
      },
      revenueImpact,
      competitiveAnalysis,
      strategy,
      seasonalPricing,
      implementation,
      riskMitigation,
    };
  }

  /**
   * Analyze demand elasticity for a product
   */
  private async analyzeDemandElasticity(
    tenantId: string,
    product: Product,
  ): Promise<PriceElasticityAnalysis> {
    // Get historical sales and price data
    const salesHistory = await this.getProductSalesHistory(tenantId, product.id);
    
    // Calculate elasticity using simplified method
    let elasticityCoefficient = -1.2; // Default moderate elasticity
    
    if (salesHistory.length >= 2) {
      // Simple elasticity calculation using two periods
      const recent = salesHistory[0];
      const previous = salesHistory[1];
      
      const volumeChange = (recent.volume - previous.volume) / previous.volume;
      const priceChange = (recent.averagePrice - previous.averagePrice) / previous.averagePrice;
      
      if (priceChange !== 0) {
        elasticityCoefficient = volumeChange / priceChange;
      }
    }

    // Determine if product is elastic
    const isElastic = Math.abs(elasticityCoefficient) > 1;

    // Generate price sensitivity scenarios
    const currentPrice = product.sellingPrice || 0;
    const pricePoints = [];
    
    for (let adjustment = -0.2; adjustment <= 0.2; adjustment += 0.05) {
      const newPrice = currentPrice * (1 + adjustment);
      const volumeMultiplier = Math.pow(1 + adjustment, elasticityCoefficient);
      const baseVolume = salesHistory[0]?.volume || 100; // Default if no history
      
      pricePoints.push({
        price: Math.round(newPrice),
        expectedVolume: Math.round(baseVolume * volumeMultiplier),
        expectedRevenue: Math.round(newPrice * baseVolume * volumeMultiplier),
      });
    }

    return {
      elasticityCoefficient,
      isElastic,
      pricePoints,
    };
  }

  /**
   * Analyze competitive pricing position
   */
  private async analyzeCompetitivePricing(product: Product): Promise<{
    marketPosition: 'below' | 'at' | 'above' | 'premium';
    competitorAveragePrice: number;
    priceGap: number;
    competitiveAdvantage: string;
  }> {
    // Simulated competitive analysis - in a real implementation, this would
    // integrate with market data APIs or manual competitive intelligence
    const currentPrice = product.sellingPrice || 0;
    
    // Simulate market pricing based on product category and characteristics
    const categoryMultiplier = this.getCategoryPricingMultiplier(product.category?.name || '');
    const marketPrice = currentPrice * (0.9 + Math.random() * 0.2); // ±10% variation
    
    const competitorAveragePrice = Math.round(marketPrice * categoryMultiplier);
    const priceGap = currentPrice - competitorAveragePrice;
    
    let marketPosition: 'below' | 'at' | 'above' | 'premium';
    if (currentPrice < competitorAveragePrice * 0.9) {
      marketPosition = 'below';
    } else if (currentPrice > competitorAveragePrice * 1.15) {
      marketPosition = 'premium';
    } else if (currentPrice > competitorAveragePrice * 1.05) {
      marketPosition = 'above';
    } else {
      marketPosition = 'at';
    }

    const competitiveAdvantage = this.determineCompetitiveAdvantage(marketPosition, priceGap);

    return {
      marketPosition,
      competitorAveragePrice,
      priceGap,
      competitiveAdvantage,
    };
  }

  /**
   * Calculate optimal price based on various factors
   */
  private async calculateOptimalPrice(
    product: Product,
    elasticityAnalysis: PriceElasticityAnalysis,
    competitiveAnalysis: any,
    query: PriceOptimizationQueryDto,
  ): Promise<number> {
    const currentPrice = product.sellingPrice || 0;
    const costPrice = product.costPrice || 0;
    const targetMargin = (query.targetMargin || 30) / 100;

    // Calculate price based on target margin
    const marginBasedPrice = costPrice / (1 - targetMargin);

    // Calculate price based on elasticity optimization
    const elasticityOptimalPrice = this.calculateElasticityOptimalPrice(
      currentPrice,
      elasticityAnalysis,
    );

    // Calculate price based on competitive position
    const competitiveOptimalPrice = this.calculateCompetitiveOptimalPrice(
      currentPrice,
      competitiveAnalysis,
      query.considerCompetitorPricing || true,
    );

    // Weighted average of different pricing approaches
    const weights = {
      margin: 0.4,
      elasticity: 0.35,
      competitive: 0.25,
    };

    let optimalPrice = 
      marginBasedPrice * weights.margin +
      elasticityOptimalPrice * weights.elasticity +
      competitiveOptimalPrice * weights.competitive;

    // Apply constraints
    const maxIncrease = (query.maxPriceIncrease || 15) / 100;
    const maxPrice = currentPrice * (1 + maxIncrease);
    const minPrice = costPrice * 1.05; // Minimum 5% margin

    optimalPrice = Math.max(minPrice, Math.min(maxPrice, optimalPrice));

    return Math.round(optimalPrice);
  }

  /**
   * Calculate revenue impact of price change
   */
  private async calculateRevenueImpact(
    tenantId: string,
    product: Product,
    currentPrice: number,
    recommendedPrice: number,
    elasticityAnalysis: PriceElasticityAnalysis,
  ): Promise<{
    currentDailyRevenue: number;
    projectedDailyRevenue: number;
    revenueChange: number;
    paybackPeriod: number;
  }> {
    // Get current daily sales volume
    const currentDailyVolume = await this.getCurrentDailyVolume(tenantId, product.id);
    
    // Calculate projected volume with new price
    const priceChange = (recommendedPrice - currentPrice) / currentPrice;
    const volumeChange = Math.pow(1 + priceChange, elasticityAnalysis.elasticityCoefficient);
    const projectedDailyVolume = currentDailyVolume * volumeChange;

    const currentDailyRevenue = currentDailyVolume * currentPrice;
    const projectedDailyRevenue = projectedDailyVolume * recommendedPrice;
    const revenueChange = projectedDailyRevenue - currentDailyRevenue;

    // Calculate payback period (simplified)
    const implementationCost = 10000; // Cost of price change implementation
    const paybackPeriod = revenueChange > 0 ? implementationCost / revenueChange : 365;

    return {
      currentDailyRevenue: Math.round(currentDailyRevenue),
      projectedDailyRevenue: Math.round(projectedDailyRevenue),
      revenueChange: Math.round(revenueChange),
      paybackPeriod: Math.round(paybackPeriod),
    };
  }

  /**
   * Get product sales history for analysis
   */
  private async getProductSalesHistory(
    tenantId: string,
    productId: string,
  ): Promise<Array<{
    period: string;
    volume: number;
    averagePrice: number;
    revenue: number;
  }>> {
    // Get sales data for the last 6 months, grouped by month
    const salesData = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate >= :sixMonthsAgo', {
        sixMonthsAgo: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
      })
      .select([
        "DATE_TRUNC('month', transaction.transactionDate) as period",
        'SUM(transaction.quantity) as volume',
        'AVG(transaction.unitCost) as averagePrice',
        'SUM(transaction.quantity * transaction.unitCost) as revenue',
      ])
      .groupBy("DATE_TRUNC('month', transaction.transactionDate)")
      .orderBy('period', 'DESC')
      .getRawMany();

    return salesData.map(data => ({
      period: data.period,
      volume: Number(data.volume) || 0,
      averagePrice: Number(data.averagePrice) || 0,
      revenue: Number(data.revenue) || 0,
    }));
  }

  /**
   * Get current daily sales volume
   */
  private async getCurrentDailyVolume(tenantId: string, productId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate >= :startDate', { startDate: thirtyDaysAgo })
      .select('SUM(transaction.quantity)', 'totalQuantity')
      .getRawOne();

    return (Number(result?.totalQuantity) || 0) / 30;
  }

  // Helper methods for pricing calculations
  private getCategoryPricingMultiplier(categoryName: string): number {
    const multipliers: Record<string, number> = {
      'electronics': 0.95,
      'fashion': 1.1,
      'food': 0.9,
      'books': 0.85,
      'toys': 1.05,
      'home': 1.0,
    };
    
    const category = categoryName.toLowerCase();
    return multipliers[category] || 1.0;
  }

  private determineCompetitiveAdvantage(
    marketPosition: string,
    priceGap: number,
  ): string {
    if (marketPosition === 'below') {
      return 'Price advantage - dapat meningkatkan margin atau volume';
    } else if (marketPosition === 'premium') {
      return 'Premium positioning - fokus pada value proposition';
    } else if (marketPosition === 'above') {
      return 'Slight premium - monitor competitive response';
    } else {
      return 'Competitive parity - differentiate melalui value-add';
    }
  }

  private calculateElasticityOptimalPrice(
    currentPrice: number,
    elasticityAnalysis: PriceElasticityAnalysis,
  ): number {
    // Find the price point that maximizes revenue
    const optimalPoint = elasticityAnalysis.pricePoints.reduce((max, point) => 
      point.expectedRevenue > max.expectedRevenue ? point : max
    );
    
    return optimalPoint.price;
  }

  private calculateCompetitiveOptimalPrice(
    currentPrice: number,
    competitiveAnalysis: any,
    considerCompetitors: boolean,
  ): number {
    if (!considerCompetitors) {
      return currentPrice;
    }

    // Adjust price based on competitive position
    const competitorPrice = competitiveAnalysis.competitorAveragePrice;
    
    if (competitiveAnalysis.marketPosition === 'below') {
      // Can increase price towards market average
      return Math.min(currentPrice * 1.1, competitorPrice * 0.95);
    } else if (competitiveAnalysis.marketPosition === 'premium') {
      // Should justify premium or adjust down
      return Math.max(currentPrice * 0.95, competitorPrice * 1.05);
    } else {
      // Minor adjustments to maintain position
      return competitorPrice;
    }
  }

  private calculateVolumeChange(priceChangePercent: number, elasticityCoefficient: number): number {
    const volumeChangePercent = priceChangePercent * elasticityCoefficient;
    return Math.round(volumeChangePercent * 100) / 100;
  }

  private determinePricingStrategy(
    currentMargin: number,
    recommendedMargin: number,
    elasticityAnalysis: PriceElasticityAnalysis,
    competitiveAnalysis: any,
  ): {
    strategyType: 'penetration' | 'skimming' | 'competitive' | 'value_based';
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
    successProbability: number;
  } {
    let strategyType: 'penetration' | 'skimming' | 'competitive' | 'value_based';
    let reasoning: string;
    let riskLevel: 'low' | 'medium' | 'high';
    let successProbability: number;

    if (recommendedMargin > currentMargin + 5) {
      strategyType = 'skimming';
      reasoning = 'Margin improvement opportunity dengan premium pricing';
      riskLevel = elasticityAnalysis.isElastic ? 'high' : 'medium';
      successProbability = elasticityAnalysis.isElastic ? 0.6 : 0.8;
    } else if (competitiveAnalysis.marketPosition === 'above') {
      strategyType = 'competitive';
      reasoning = 'Maintain competitive position dengan market-based pricing';
      riskLevel = 'low';
      successProbability = 0.85;
    } else if (currentMargin < 20) {
      strategyType = 'penetration';
      reasoning = 'Volume-focused strategy untuk market share growth';
      riskLevel = 'medium';
      successProbability = 0.75;
    } else {
      strategyType = 'value_based';
      reasoning = 'Balanced approach berdasarkan customer value perception';
      riskLevel = 'low';
      successProbability = 0.8;
    }

    return {
      strategyType,
      reasoning,
      riskLevel,
      successProbability,
    };
  }

  private generateSeasonalPricing(product: Product, basePrice: number): SeasonalPricing {
    const categoryName = product.category?.name?.toLowerCase() || '';
    
    // Get relevant holidays for this product category
    const relevantHolidays = this.indonesianHolidays.filter(holiday =>
      holiday.categories.some(cat => categoryName.includes(cat))
    );

    return {
      peakSeasonMultiplier: 1.1, // 10% increase during peak season
      lowSeasonMultiplier: 0.95, // 5% decrease during low season
      holidayAdjustments: relevantHolidays.map(holiday => ({
        holiday: holiday.name,
        period: holiday.period,
        multiplier: holiday.multiplier,
        reasoning: holiday.reasoning,
      })),
    };
  }

  private createImplementationPlan(recommendedPrice: number, currentPrice: number): {
    recommendedStart: string;
    testPeriod: number;
    fullRollout: string;
    monitoringMetrics: string[];
  } {
    const priceChange = Math.abs((recommendedPrice - currentPrice) / currentPrice);
    
    // Larger price changes need longer test periods
    const testPeriod = priceChange > 0.1 ? 14 : 7; // 14 days for >10% change, 7 days otherwise
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 3); // Start in 3 days
    
    const rolloutDate = new Date(startDate);
    rolloutDate.setDate(rolloutDate.getDate() + testPeriod);

    return {
      recommendedStart: startDate.toISOString().split('T')[0],
      testPeriod,
      fullRollout: rolloutDate.toISOString().split('T')[0],
      monitoringMetrics: [
        'Daily sales volume',
        'Revenue impact',
        'Customer complaints',
        'Competitive response',
        'Inventory turnover',
        'Profit margin',
      ],
    };
  }

  private createRiskMitigation(priceChangePercent: number, elasticityAnalysis: PriceElasticityAnalysis): {
    identifiedRisks: string[];
    mitigationStrategies: string[];
    rollbackPlan: string;
  } {
    const risks = [];
    const mitigations = [];

    if (Math.abs(priceChangePercent) > 10) {
      risks.push('Significant price change dapat menyebabkan customer resistance');
      mitigations.push('Implement gradual price adjustment over 2-3 stages');
    }

    if (elasticityAnalysis.isElastic) {
      risks.push('High price elasticity - volume dapat turun signifikan');
      mitigations.push('Enhanced value communication dan customer education');
    }

    if (priceChangePercent > 0) {
      risks.push('Competitor dapat respond dengan price cuts');
      mitigations.push('Monitor competitor pricing weekly dan prepare counter-strategy');
    }

    risks.push('Customer churn risk dari price-sensitive segments');
    mitigations.push('Prepare retention offers untuk key customers');

    const rollbackPlan = 'Automatic rollback jika volume turun >20% dalam 1 minggu atau complaints increase >50%';

    return {
      identifiedRisks: risks,
      mitigationStrategies: mitigations,
      rollbackPlan,
    };
  }

  private assessOverallPricingRisk(optimizations: PriceOptimizationDto[]): 'low' | 'medium' | 'high' {
    const highRiskCount = optimizations.filter(opt => 
      opt.strategy.riskLevel === 'high' || Math.abs(opt.priceChangePercent) > 15
    ).length;

    const totalCount = optimizations.length;
    const highRiskRatio = totalCount > 0 ? highRiskCount / totalCount : 0;

    if (highRiskRatio > 0.3) return 'high';
    if (highRiskRatio > 0.1) return 'medium';
    return 'low';
  }

  private generatePricingInsights(optimizations: PriceOptimizationDto[], summary: any): any {
    const pricingStrategy = [];
    const competitivePosition = [];
    const marketOpportunities = [];
    const implementationGuide = [];

    // Pricing strategy insights
    const strategyTypes = optimizations.reduce((acc, opt) => {
      acc[opt.strategy.strategyType] = (acc[opt.strategy.strategyType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantStrategy = Object.entries(strategyTypes).reduce((max, [strategy, count]) => 
      count > max.count ? { strategy, count } : max, { strategy: '', count: 0 });

    pricingStrategy.push(`Dominant strategy: ${dominantStrategy.strategy} untuk ${dominantStrategy.count} produk`);
    
    if (summary.averageMarginImprovement > 3) {
      pricingStrategy.push(`Opportunity untuk improve margin rata-rata ${summary.averageMarginImprovement.toFixed(1)}%`);
    }

    // Competitive position insights
    const positions = optimizations.reduce((acc, opt) => {
      acc[opt.competitiveAnalysis.marketPosition] = (acc[opt.competitiveAnalysis.marketPosition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    competitivePosition.push('Portfolio positioning analysis:');
    Object.entries(positions).forEach(([position, count]) => {
      competitivePosition.push(`- ${position}: ${count} produk`);
    });

    // Market opportunities
    if (summary.totalRevenueImpact > 1000000) {
      marketOpportunities.push(`Total revenue opportunity: Rp ${(summary.totalRevenueImpact / 1000000).toFixed(1)}M`);
    }
    
    marketOpportunities.push('Focus on high-impact products untuk maximize ROI');
    marketOpportunities.push('Consider bundling strategies untuk less elastic products');

    // Implementation guide
    implementationGuide.push('Start dengan products yang memiliki lowest risk dan highest impact');
    implementationGuide.push('Implement A/B testing untuk validate price elasticity assumptions');
    implementationGuide.push('Setup monitoring dashboard untuk track key metrics');
    implementationGuide.push('Prepare customer communication strategy untuk significant price changes');

    return {
      pricingStrategy,
      competitivePosition,
      marketOpportunities,
      implementationGuide,
    };
  }
}