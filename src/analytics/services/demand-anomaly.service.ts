import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductCategory } from '../../products/entities/product-category.entity';

import {
  DemandAnomalyQueryDto,
  SeasonalAnalysisQueryDto,
} from '../dto/predictive-analytics-query.dto';

import {
  DemandAnomalyResponseDto,
  SeasonalAnalysisResponseDto,
  DemandAnomalyDto,
  SeasonalAnalysisDto,
} from '../dto/predictive-analytics-response.dto';

import { AnalyticsMetaDto } from '../dto/analytics-response.dto';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  expectedValue?: number;
  isAnomaly?: boolean;
  anomalyScore?: number;
}

export interface SeasonalDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalityStrength: number;
}

export interface HolidayEffect {
  holiday: string;
  date: string;
  effect: 'increase' | 'decrease' | 'neutral';
  multiplier: number;
  duration: number;
  confidence: number;
}

@Injectable()
export class DemandAnomalyService {
  private readonly logger = new Logger(DemandAnomalyService.name);

  // Indonesian holidays and special events that affect demand
  private readonly indonesianHolidays = [
    {
      name: 'Tahun Baru',
      type: 'fixed',
      date: '01-01',
      effect: 'decrease',
      multiplier: 0.7,
      duration: 3,
      categories: ['all'],
    },
    {
      name: 'Imlek',
      type: 'lunar',
      effect: 'increase',
      multiplier: 1.3,
      duration: 5,
      categories: ['food', 'gifts', 'clothing'],
    },
    {
      name: 'Ramadan',
      type: 'lunar',
      effect: 'mixed',
      multiplier: 1.2,
      duration: 30,
      categories: ['food', 'clothing', 'electronics'],
    },
    {
      name: 'Lebaran',
      type: 'lunar',
      effect: 'increase',
      multiplier: 1.5,
      duration: 7,
      categories: ['clothing', 'food', 'gifts', 'electronics'],
    },
    {
      name: 'Kemerdekaan',
      type: 'fixed',
      date: '08-17',
      effect: 'neutral',
      multiplier: 1.1,
      duration: 3,
      categories: ['food', 'clothing'],
    },
    {
      name: 'Natal',
      type: 'fixed',
      date: '12-25',
      effect: 'increase',
      multiplier: 1.4,
      duration: 7,
      categories: ['gifts', 'food', 'electronics', 'clothing'],
    },
  ];

  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
  ) {}

  /**
   * Detect demand anomalies in sales data
   */
  async detectDemandAnomalies(
    tenantId: string,
    query: DemandAnomalyQueryDto,
  ): Promise<DemandAnomalyResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Detecting demand anomalies for tenant ${tenantId}`);

      // Get date range for analysis
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate 
        ? new Date(query.startDate) 
        : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // Default 90 days

      // Get products to analyze
      const products = await this.getProductsForAnomalyDetection(tenantId, query);

      const anomalies: DemandAnomalyDto[] = [];
      let totalSpikes = 0;
      let totalDrops = 0;

      for (const product of products) {
        try {
          const productAnomalies = await this.detectProductAnomalies(
            tenantId,
            product,
            startDate,
            endDate,
            query,
          );

          anomalies.push(...productAnomalies);
          
          productAnomalies.forEach(anomaly => {
            if (anomaly.anomalyType === 'spike') totalSpikes++;
            if (anomaly.anomalyType === 'drop') totalDrops++;
          });
        } catch (error) {
          this.logger.warn(`Failed to detect anomalies for product ${product.id}: ${error.message}`);
        }
      }

      // Sort by severity and date
      anomalies.sort((a, b) => {
        if (a.severityScore !== b.severityScore) {
          return b.severityScore - a.severityScore;
        }
        return new Date(b.anomalyDate).getTime() - new Date(a.anomalyDate).getTime();
      });

      // Apply pagination
      const startIndex = ((query.page || 1) - 1) * (query.limit || 50);
      const paginatedData = anomalies.slice(startIndex, startIndex + (query.limit || 50));

      // Calculate severity distribution
      const severityDistribution = anomalies.reduce((acc, anomaly) => {
        const severityLevel = this.getSeverityLevel(anomaly.severityScore);
        acc[severityLevel] = (acc[severityLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const averageDeviation = anomalies.length > 0 
        ? anomalies.reduce((sum, anomaly) => sum + Math.abs(anomaly.deviationPercent), 0) / anomalies.length
        : 0;

      const summary = {
        totalAnomalies: anomalies.length,
        spikes: totalSpikes,
        drops: totalDrops,
        severityDistribution,
        averageDeviation,
      };

      // Generate insights
      const insights = this.generateAnomalyInsights(anomalies, summary);

      const meta: AnalyticsMetaDto = {
        total: anomalies.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(anomalies.length / (query.limit || 50)),
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
      this.logger.error(`Failed to detect demand anomalies: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to detect demand anomalies: ${error.message}`);
    }
  }

  /**
   * Perform seasonal analysis on product demand
   */
  async performSeasonalAnalysis(
    tenantId: string,
    query: SeasonalAnalysisQueryDto,
  ): Promise<SeasonalAnalysisResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Performing seasonal analysis for tenant ${tenantId}`);

      // Get analysis period
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate 
        ? new Date(query.startDate) 
        : new Date(endDate.getTime() - (query.analysisPeriodMonths || 12) * 30 * 24 * 60 * 60 * 1000);

      // Get products to analyze
      const products = await this.getProductsForSeasonalAnalysis(tenantId, query);

      const seasonalAnalyses: SeasonalAnalysisDto[] = [];
      let totalHighSeasonality = 0;
      let totalSeasonalityStrength = 0;

      for (const product of products) {
        try {
          const analysis = await this.analyzeProductSeasonality(
            tenantId,
            product,
            startDate,
            endDate,
            query,
          );

          if (analysis.seasonalityStrength >= (query.minSeasonalityStrength || 0.3)) {
            seasonalAnalyses.push(analysis);
            
            if (analysis.seasonalityStrength > 0.6) {
              totalHighSeasonality++;
            }
            totalSeasonalityStrength += analysis.seasonalityStrength;
          }
        } catch (error) {
          this.logger.warn(`Failed to analyze seasonality for product ${product.id}: ${error.message}`);
        }
      }

      // Sort by seasonality strength
      seasonalAnalyses.sort((a, b) => b.seasonalityStrength - a.seasonalityStrength);

      // Apply pagination
      const startIndex = ((query.page || 1) - 1) * (query.limit || 50);
      const paginatedData = seasonalAnalyses.slice(startIndex, startIndex + (query.limit || 50));

      // Calculate summary statistics
      const averageSeasonalityStrength = seasonalAnalyses.length > 0 
        ? totalSeasonalityStrength / seasonalAnalyses.length 
        : 0;

      // Find most common peak and low seasons
      const peakSeasons = seasonalAnalyses.flatMap(analysis => 
        analysis.peakSeasons.map(peak => peak.period)
      );
      const lowSeasons = seasonalAnalyses.flatMap(analysis => 
        analysis.lowSeasons.map(low => low.period)
      );

      const mostCommonPeakSeason = this.getMostCommon(peakSeasons);
      const mostCommonLowSeason = this.getMostCommon(lowSeasons);

      const summary = {
        totalProducts: products.length,
        highSeasonalityProducts: totalHighSeasonality,
        averageSeasonalityStrength,
        mostCommonPeakSeason,
        mostCommonLowSeason,
      };

      // Generate insights
      const insights = this.generateSeasonalInsights(seasonalAnalyses, summary);

      const meta: AnalyticsMetaDto = {
        total: seasonalAnalyses.length,
        page: query.page || 1,
        limit: query.limit || 50,
        totalPages: Math.ceil(seasonalAnalyses.length / (query.limit || 50)),
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
      this.logger.error(`Failed to perform seasonal analysis: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to perform seasonal analysis: ${error.message}`);
    }
  }

  // Helper methods for anomaly detection
  private async getProductsForAnomalyDetection(
    tenantId: string,
    query: DemandAnomalyQueryDto,
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true');

    if (query.productId) {
      queryBuilder.andWhere('product.id = :productId', { productId: query.productId });
    }

    if (query.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
    }

    return queryBuilder.getMany();
  }

  private async detectProductAnomalies(
    tenantId: string,
    product: Product,
    startDate: Date,
    endDate: Date,
    query: DemandAnomalyQueryDto,
  ): Promise<DemandAnomalyDto[]> {
    // Get daily sales data
    const salesData = await this.getDailySalesData(tenantId, product.id, startDate, endDate);
    
    if (salesData.length < 7) {
      return []; // Need at least 7 days of data
    }

    // Calculate moving average and standard deviation
    const windowSize = 7;
    const anomalies: DemandAnomalyDto[] = [];

    for (let i = windowSize; i < salesData.length; i++) {
      const window = salesData.slice(i - windowSize, i);
      const current = salesData[i];
      
      const mean = window.reduce((sum, point) => sum + point.value, 0) / window.length;
      const variance = window.reduce((sum, point) => sum + Math.pow(point.value - mean, 2), 0) / window.length;
      const stdDev = Math.sqrt(variance);
      
      // Calculate z-score
      const zScore = stdDev > 0 ? Math.abs(current.value - mean) / stdDev : 0;
      
      // Determine if it's an anomaly
      const threshold = this.getSensitivityThreshold(query.sensitivityLevel || 5);
      const isAnomaly = zScore > threshold;
      
      if (isAnomaly) {
        const deviationPercent = mean > 0 ? ((current.value - mean) / mean) * 100 : 0;
        
        // Filter by minimum deviation if specified
        if (Math.abs(deviationPercent) >= (query.minDeviationPercent || 25)) {
          const anomalyType = this.determineAnomalyType(current.value, mean, deviationPercent);
          
          // Apply type filters
          if (this.shouldIncludeAnomaly(anomalyType, query)) {
            const anomaly = await this.createAnomalyDto(
              product,
              current,
              mean,
              deviationPercent,
              zScore,
              anomalyType,
            );
            
            anomalies.push(anomaly);
          }
        }
      }
    }

    return anomalies;
  }

  private async getDailySalesData(
    tenantId: string,
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSeriesDataPoint[]> {
    const sales = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select([
        "DATE(transaction.transactionDate) as date",
        'SUM(transaction.quantity) as totalQuantity',
      ])
      .groupBy("DATE(transaction.transactionDate)")
      .orderBy('date', 'ASC')
      .getRawMany();

    // Fill in missing dates with 0 sales
    const result: TimeSeriesDataPoint[] = [];
    const currentDate = new Date(startDate);
    const salesMap = new Map(sales.map(s => [s.date, Number(s.totalQuantity)]));

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        value: salesMap.get(dateStr) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  private getSensitivityThreshold(sensitivityLevel: number): number {
    // Map sensitivity level (1-10) to z-score threshold
    const thresholds = [3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2];
    return thresholds[Math.max(0, Math.min(9, sensitivityLevel - 1))];
  }

  private determineAnomalyType(
    currentValue: number,
    expectedValue: number,
    deviationPercent: number,
  ): 'spike' | 'drop' | 'seasonal_deviation' | 'trend_break' {
    if (deviationPercent > 50) {
      return 'spike';
    } else if (deviationPercent < -50) {
      return 'drop';
    } else if (Math.abs(deviationPercent) > 25) {
      // Check if it might be seasonal (simplified check)
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend effect
        return 'seasonal_deviation';
      } else {
        return 'trend_break';
      }
    } else {
      return currentValue > expectedValue ? 'spike' : 'drop';
    }
  }

  private shouldIncludeAnomaly(
    anomalyType: string,
    query: DemandAnomalyQueryDto,
  ): boolean {
    if (anomalyType === 'spike' && !query.detectSpikes) return false;
    if (anomalyType === 'drop' && !query.detectDrops) return false;
    if (anomalyType === 'seasonal_deviation' && !query.includeSeasonalAnomalies) return false;
    return true;
  }

  private async createAnomalyDto(
    product: Product,
    dataPoint: TimeSeriesDataPoint,
    expectedValue: number,
    deviationPercent: number,
    zScore: number,
    anomalyType: 'spike' | 'drop' | 'seasonal_deviation' | 'trend_break',
  ): Promise<DemandAnomalyDto> {
    const severityScore = Math.min(1.0, zScore / 3.0); // Normalize to 0-1
    const confidence = Math.min(1.0, Math.max(0.5, severityScore));

    // Generate possible causes
    const possibleCauses = this.generatePossibleCauses(anomalyType, dataPoint.date, deviationPercent);

    // Calculate business impact
    const businessImpact = this.calculateAnomalyBusinessImpact(
      product,
      dataPoint.value,
      expectedValue,
      anomalyType,
    );

    // Generate recommendations
    const recommendedActions = this.generateAnomalyRecommendations(anomalyType, severityScore);

    // Analyze pattern context
    const patternContext = await this.analyzeAnomalyPattern(product.id, dataPoint.date, anomalyType);

    return {
      productId: product.id,
      productName: product.name,
      anomalyDate: dataPoint.date,
      anomalyType,
      expectedDemand: Math.round(expectedValue),
      actualDemand: dataPoint.value,
      deviationPercent: Math.round(deviationPercent * 100) / 100,
      severityScore,
      confidence,
      possibleCauses,
      businessImpact,
      recommendedActions,
      patternContext,
    };
  }

  private generatePossibleCauses(
    anomalyType: string,
    date: string,
    deviationPercent: number,
  ): string[] {
    const causes = [];
    const anomalyDate = new Date(date);

    // Check for holidays or special events
    const holiday = this.checkForHoliday(anomalyDate);
    if (holiday) {
      causes.push(`${holiday.name} holiday effect`);
    }

    // Day of week effects
    const dayOfWeek = anomalyDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      causes.push('Weekend demand pattern');
    }

    // Month-specific effects
    const month = anomalyDate.getMonth();
    if (month === 11 || month === 0) { // Dec or Jan
      causes.push('Year-end holiday season effect');
    }

    // Anomaly-specific causes
    if (anomalyType === 'spike') {
      causes.push('Promotional campaign atau viral marketing');
      causes.push('Competitor stockout atau supply shortage');
      causes.push('Social media influence atau trending');
      if (Math.abs(deviationPercent) > 100) {
        causes.push('One-time bulk purchase atau B2B order');
      }
    } else if (anomalyType === 'drop') {
      causes.push('Competitor promotion atau price war');
      causes.push('Product quality issue atau negative review');
      causes.push('Supply chain disruption');
      causes.push('Economic atau external market factors');
    }

    causes.push('Data quality issue atau system error');
    causes.push('Seasonal shift atau trend change');

    return causes;
  }

  private checkForHoliday(date: Date): any {
    const monthDay = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    return this.indonesianHolidays.find(holiday => 
      holiday.type === 'fixed' && holiday.date === monthDay
    );
  }

  private calculateAnomalyBusinessImpact(
    product: Product,
    actualDemand: number,
    expectedDemand: number,
    anomalyType: string,
  ): {
    revenueImpact: number;
    inventoryImpact: number;
    customerSatisfactionImpact: number;
  } {
    const sellingPrice = product.sellingPrice || 0;
    const demandDifference = actualDemand - expectedDemand;
    
    const revenueImpact = demandDifference * sellingPrice;
    
    let inventoryImpact = 0;
    let customerSatisfactionImpact = 0;

    if (anomalyType === 'spike') {
      // Positive revenue but potential stockout risk
      inventoryImpact = -demandDifference; // Negative because inventory decreased more than expected
      customerSatisfactionImpact = inventoryImpact < -10 ? -20 : 0; // Risk of stockout affecting satisfaction
    } else if (anomalyType === 'drop') {
      // Negative revenue but less inventory depletion
      inventoryImpact = -demandDifference; // Positive because less inventory was used
      customerSatisfactionImpact = demandDifference < -20 ? -10 : 0; // Potential brand perception issues
    }

    return {
      revenueImpact: Math.round(revenueImpact),
      inventoryImpact: Math.round(inventoryImpact),
      customerSatisfactionImpact,
    };
  }

  private generateAnomalyRecommendations(
    anomalyType: string,
    severityScore: number,
  ): Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    timeline: string;
  }> {
    const recommendations = [];

    if (anomalyType === 'spike') {
      recommendations.push({
        action: 'Investigate demand drivers dan capitalize on opportunity',
        priority: 'high' as const,
        timeline: 'Immediate (24 hours)',
      });
      
      if (severityScore > 0.7) {
        recommendations.push({
          action: 'Check inventory levels dan prepare emergency restock',
          priority: 'high' as const,
          timeline: 'Immediate',
        });
      }
      
      recommendations.push({
        action: 'Analyze customer segments untuk targeted marketing',
        priority: 'medium' as const,
        timeline: '1-3 days',
      });
    } else if (anomalyType === 'drop') {
      recommendations.push({
        action: 'Investigate root cause - competitors, quality, pricing',
        priority: 'high' as const,
        timeline: 'Immediate (24 hours)',
      });
      
      recommendations.push({
        action: 'Review marketing strategy dan promotional activities',
        priority: 'medium' as const,
        timeline: '2-5 days',
      });
      
      if (severityScore > 0.7) {
        recommendations.push({
          action: 'Consider pricing adjustment atau promotional campaign',
          priority: 'high' as const,
          timeline: '1-2 days',
        });
      }
    }

    recommendations.push({
      action: 'Update demand forecast models dengan new data',
      priority: 'medium' as const,
      timeline: '1 week',
    });

    recommendations.push({
      action: 'Setup monitoring alerts untuk similar patterns',
      priority: 'low' as const,
      timeline: '2 weeks',
    });

    return recommendations;
  }

  private async analyzeAnomalyPattern(
    productId: string,
    currentDate: string,
    anomalyType: string,
  ): Promise<{
    isRecurring: boolean;
    lastOccurrence?: string;
    frequency?: string;
    seasonalPattern?: boolean;
  }> {
    // Simplified pattern analysis - in a real implementation, this would
    // analyze historical anomalies stored in the database
    
    const currentDateObj = new Date(currentDate);
    const dayOfWeek = currentDateObj.getDay();
    const dayOfMonth = currentDateObj.getDate();
    
    // Check for weekly patterns
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isMonday = dayOfWeek === 1;
    
    // Check for monthly patterns
    const isMonthEnd = dayOfMonth > 25;
    const isMonthStart = dayOfMonth <= 5;
    
    let isRecurring = false;
    let frequency;
    let seasonalPattern = false;

    if (isWeekend && anomalyType === 'drop') {
      isRecurring = true;
      frequency = 'weekly';
      seasonalPattern = true;
    } else if (isMonday && anomalyType === 'spike') {
      isRecurring = true;
      frequency = 'weekly';
      seasonalPattern = true;
    } else if (isMonthEnd && anomalyType === 'spike') {
      isRecurring = true;
      frequency = 'monthly';
      seasonalPattern = true;
    }

    return {
      isRecurring,
      frequency,
      seasonalPattern,
      lastOccurrence: isRecurring ? 'Previous occurrence detected in pattern analysis' : undefined,
    };
  }

  private getSeverityLevel(severityScore: number): string {
    if (severityScore >= 0.8) return 'critical';
    if (severityScore >= 0.6) return 'high';
    if (severityScore >= 0.4) return 'medium';
    return 'low';
  }

  private generateAnomalyInsights(anomalies: DemandAnomalyDto[], summary: any): any {
    const commonPatterns = [];
    const triggerFactors = [];
    const preventionStrategies = [];
    const monitoringRecommendations = [];

    // Analyze common patterns
    const weekendAnomalies = anomalies.filter(a => {
      const date = new Date(a.anomalyDate);
      return date.getDay() === 0 || date.getDay() === 6;
    });

    if (weekendAnomalies.length > anomalies.length * 0.3) {
      commonPatterns.push('Weekend patterns significantly different from weekdays');
    }

    const spikeAnomalies = anomalies.filter(a => a.anomalyType === 'spike');
    const dropAnomalies = anomalies.filter(a => a.anomalyType === 'drop');

    if (spikeAnomalies.length > dropAnomalies.length * 2) {
      commonPatterns.push('More demand spikes than drops - growing market');
    } else if (dropAnomalies.length > spikeAnomalies.length * 2) {
      commonPatterns.push('More demand drops than spikes - declining trend');
    }

    // Trigger factors
    triggerFactors.push('Holiday seasons dan special events');
    triggerFactors.push('Competitor activities dan market dynamics');
    triggerFactors.push('Marketing campaigns dan promotional activities');
    triggerFactors.push('External economic factors');

    // Prevention strategies
    preventionStrategies.push('Implement demand sensing untuk early detection');
    preventionStrategies.push('Develop scenario planning untuk holiday seasons');
    preventionStrategies.push('Setup competitive monitoring system');
    preventionStrategies.push('Create flexible inventory buffer untuk anomaly handling');

    // Monitoring recommendations
    monitoringRecommendations.push('Daily anomaly detection dengan automated alerts');
    monitoringRecommendations.push('Weekly pattern analysis untuk recurring anomalies');
    monitoringRecommendations.push('Monthly trend review untuk structural changes');
    monitoringRecommendations.push('Real-time dashboard untuk immediate response');

    return {
      commonPatterns,
      triggerFactors,
      preventionStrategies,
      monitoringRecommendations,
    };
  }

  // Helper methods for seasonal analysis
  private async getProductsForSeasonalAnalysis(
    tenantId: string,
    query: SeasonalAnalysisQueryDto,
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true');

    if (query.productId) {
      queryBuilder.andWhere('product.id = :productId', { productId: query.productId });
    }

    if (query.categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
    }

    return queryBuilder.getMany();
  }

  private async analyzeProductSeasonality(
    tenantId: string,
    product: Product,
    startDate: Date,
    endDate: Date,
    query: SeasonalAnalysisQueryDto,
  ): Promise<SeasonalAnalysisDto> {
    // Get sales data with appropriate granularity
    const salesData = await this.getSeasonalSalesData(tenantId, product.id, startDate, endDate);
    
    // Perform seasonal decomposition
    const decomposition = this.performSeasonalDecomposition(salesData);
    
    // Analyze patterns
    const weeklyPatterns = query.includeWeeklyPatterns 
      ? this.analyzeWeeklyPatterns(salesData)
      : [];
    
    const monthlyPatterns = query.includeMonthlyPatterns 
      ? this.analyzeMonthlyPatterns(salesData)
      : [];
    
    // Identify peaks and lows
    const peakSeasons = this.identifyPeakSeasons(decomposition, monthlyPatterns);
    const lowSeasons = this.identifyLowSeasons(decomposition, monthlyPatterns);
    
    // Analyze holiday effects
    const holidayEffects = query.includeHolidayEffects 
      ? this.analyzeHolidayEffects(product, salesData, query.useIndonesianHolidays || true)
      : [];
    
    // Generate forecasting insights
    const forecastingInsights = this.generateForecastingInsights(decomposition);
    
    // Create strategic recommendations
    const strategicRecommendations = this.generateStrategicRecommendations(
      product,
      decomposition,
      peakSeasons,
      lowSeasons,
    );

    // Determine trend direction
    const trendDirection = this.determineTrendDirection(decomposition.trend);

    return {
      productId: product.id,
      productName: product.name,
      seasonalityStrength: decomposition.seasonalityStrength,
      trendDirection,
      peakSeasons,
      lowSeasons,
      weeklyPatterns,
      monthlyPatterns,
      holidayEffects,
      forecastingInsights,
      strategicRecommendations,
    };
  }

  private async getSeasonalSalesData(
    tenantId: string,
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSeriesDataPoint[]> {
    // Get weekly aggregated data for seasonal analysis
    const sales = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .select([
        "DATE_TRUNC('week', transaction.transactionDate) as week",
        'SUM(transaction.quantity) as totalQuantity',
      ])
      .groupBy("DATE_TRUNC('week', transaction.transactionDate)")
      .orderBy('week', 'ASC')
      .getRawMany();

    return sales.map(s => ({
      date: s.week,
      value: Number(s.totalQuantity) || 0,
    }));
  }

  private performSeasonalDecomposition(data: TimeSeriesDataPoint[]): SeasonalDecomposition {
    if (data.length < 12) {
      // Not enough data for proper seasonal decomposition
      return {
        trend: data.map(d => d.value),
        seasonal: data.map(() => 0),
        residual: data.map(() => 0),
        seasonalityStrength: 0,
      };
    }

    // Simple moving average for trend
    const windowSize = Math.min(12, Math.floor(data.length / 4));
    const trend = [];
    const seasonal = [];
    const residual = [];

    for (let i = 0; i < data.length; i++) {
      // Calculate trend using centered moving average
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
      const window = data.slice(start, end);
      const trendValue = window.reduce((sum, point) => sum + point.value, 0) / window.length;
      trend.push(trendValue);

      // Calculate seasonal component (simplified - using weekly cycle)
      const seasonalIndex = i % 52; // Assuming weekly data for yearly seasonality
      const seasonalAverage = this.calculateSeasonalAverage(data, seasonalIndex, 52);
      const seasonalValue = seasonalAverage - trendValue;
      seasonal.push(seasonalValue);

      // Calculate residual
      const residualValue = data[i].value - trendValue - seasonalValue;
      residual.push(residualValue);
    }

    // Calculate seasonality strength
    const seasonalVariance = this.calculateVariance(seasonal);
    const totalVariance = this.calculateVariance(data.map(d => d.value));
    const seasonalityStrength = totalVariance > 0 ? Math.min(1, seasonalVariance / totalVariance) : 0;

    return {
      trend,
      seasonal,
      residual,
      seasonalityStrength,
    };
  }

  private calculateSeasonalAverage(data: TimeSeriesDataPoint[], index: number, period: number): number {
    const seasonalPoints = [];
    for (let i = index; i < data.length; i += period) {
      seasonalPoints.push(data[i].value);
    }
    return seasonalPoints.length > 0 
      ? seasonalPoints.reduce((sum, val) => sum + val, 0) / seasonalPoints.length 
      : 0;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private analyzeWeeklyPatterns(data: TimeSeriesDataPoint[]): Array<{
    dayOfWeek: string;
    averageMultiplier: number;
    variance: number;
  }> {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyData = new Map<number, number[]>();

    // Group data by day of week
    data.forEach(point => {
      const date = new Date(point.date);
      const dayOfWeek = date.getDay();
      if (!weeklyData.has(dayOfWeek)) {
        weeklyData.set(dayOfWeek, []);
      }
      weeklyData.get(dayOfWeek)!.push(point.value);
    });

    // Calculate overall average
    const overallAverage = data.reduce((sum, point) => sum + point.value, 0) / data.length;

    return Array.from(weeklyData.entries()).map(([dayOfWeek, values]) => {
      const dayAverage = values.reduce((sum, val) => sum + val, 0) / values.length;
      const multiplier = overallAverage > 0 ? dayAverage / overallAverage : 1;
      const variance = this.calculateVariance(values);

      return {
        dayOfWeek: dayNames[dayOfWeek],
        averageMultiplier: Math.round(multiplier * 100) / 100,
        variance: Math.round(variance * 100) / 100,
      };
    });
  }

  private analyzeMonthlyPatterns(data: TimeSeriesDataPoint[]): Array<{
    month: string;
    averageMultiplier: number;
    variance: number;
  }> {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthlyData = new Map<number, number[]>();

    // Group data by month
    data.forEach(point => {
      const date = new Date(point.date);
      const month = date.getMonth();
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(point.value);
    });

    // Calculate overall average
    const overallAverage = data.reduce((sum, point) => sum + point.value, 0) / data.length;

    return Array.from(monthlyData.entries()).map(([month, values]) => {
      const monthAverage = values.reduce((sum, val) => sum + val, 0) / values.length;
      const multiplier = overallAverage > 0 ? monthAverage / overallAverage : 1;
      const variance = this.calculateVariance(values);

      return {
        month: monthNames[month],
        averageMultiplier: Math.round(multiplier * 100) / 100,
        variance: Math.round(variance * 100) / 100,
      };
    });
  }

  private identifyPeakSeasons(
    decomposition: SeasonalDecomposition,
    monthlyPatterns: any[],
  ): Array<{
    period: string;
    multiplier: number;
    confidence: number;
  }> {
    // Identify top 3 months with highest multipliers
    return monthlyPatterns
      .sort((a, b) => b.averageMultiplier - a.averageMultiplier)
      .slice(0, 3)
      .filter(pattern => pattern.averageMultiplier > 1.1) // At least 10% above average
      .map(pattern => ({
        period: pattern.month,
        multiplier: pattern.averageMultiplier,
        confidence: Math.min(1, decomposition.seasonalityStrength * 1.2),
      }));
  }

  private identifyLowSeasons(
    decomposition: SeasonalDecomposition,
    monthlyPatterns: any[],
  ): Array<{
    period: string;
    multiplier: number;
    confidence: number;
  }> {
    // Identify bottom 3 months with lowest multipliers
    return monthlyPatterns
      .sort((a, b) => a.averageMultiplier - b.averageMultiplier)
      .slice(0, 3)
      .filter(pattern => pattern.averageMultiplier < 0.9) // At least 10% below average
      .map(pattern => ({
        period: pattern.month,
        multiplier: pattern.averageMultiplier,
        confidence: Math.min(1, decomposition.seasonalityStrength * 1.2),
      }));
  }

  private analyzeHolidayEffects(
    product: Product,
    salesData: TimeSeriesDataPoint[],
    useIndonesianHolidays: boolean,
  ): Array<{
    holiday: string;
    effect: 'increase' | 'decrease' | 'neutral';
    multiplier: number;
    duration: number;
  }> {
    if (!useIndonesianHolidays) return [];

    const categoryName = product.category?.name?.toLowerCase() || '';
    
    // Filter holidays relevant to this product category
    const relevantHolidays = this.indonesianHolidays.filter(holiday =>
      holiday.categories.includes('all') || 
      holiday.categories.some(cat => categoryName.includes(cat))
    );

    return relevantHolidays.map(holiday => ({
      holiday: holiday.name,
      effect: holiday.effect as 'increase' | 'decrease' | 'neutral',
      multiplier: holiday.multiplier,
      duration: holiday.duration,
    }));
  }

  private generateForecastingInsights(decomposition: SeasonalDecomposition): {
    bestModelType: string;
    modelAccuracy: number;
    forecastReliability: 'high' | 'medium' | 'low';
    recommendedForecastHorizon: number;
  } {
    let bestModelType = 'ARIMA';
    let forecastReliability: 'high' | 'medium' | 'low' = 'medium';
    
    if (decomposition.seasonalityStrength > 0.6) {
      bestModelType = 'Prophet';
      forecastReliability = 'high';
    } else if (decomposition.seasonalityStrength < 0.3) {
      bestModelType = 'Simple Moving Average';
      forecastReliability = 'low';
    }

    const modelAccuracy = Math.max(0.7, 0.9 - (0.2 * (1 - decomposition.seasonalityStrength)));
    const recommendedForecastHorizon = decomposition.seasonalityStrength > 0.5 ? 90 : 30;

    return {
      bestModelType,
      modelAccuracy,
      forecastReliability,
      recommendedForecastHorizon,
    };
  }

  private generateStrategicRecommendations(
    product: Product,
    decomposition: SeasonalDecomposition,
    peakSeasons: any[],
    lowSeasons: any[],
  ): Array<{
    recommendation: string;
    category: 'inventory' | 'pricing' | 'marketing' | 'procurement';
    impact: 'high' | 'medium' | 'low';
    implementation: string;
  }> {
    const recommendations = [];

    if (decomposition.seasonalityStrength > 0.5) {
      // High seasonality products
      recommendations.push({
        recommendation: 'Implement seasonal inventory planning dengan safety stock adjustment',
        category: 'inventory' as const,
        impact: 'high' as const,
        implementation: 'Increase inventory 2-3 bulan sebelum peak season',
      });

      if (peakSeasons.length > 0) {
        recommendations.push({
          recommendation: `Optimize pricing strategy untuk peak seasons: ${peakSeasons.map(p => p.period).join(', ')}`,
          category: 'pricing' as const,
          impact: 'high' as const,
          implementation: 'Increase prices 5-15% during peak periods',
        });
      }

      recommendations.push({
        recommendation: 'Develop targeted marketing campaigns untuk seasonal peaks',
        category: 'marketing' as const,
        impact: 'medium' as const,
        implementation: 'Pre-season marketing 4-6 minggu sebelum peak',
      });
    }

    if (lowSeasons.length > 0) {
      recommendations.push({
        recommendation: 'Plan promotional activities during low seasons untuk boost demand',
        category: 'marketing' as const,
        impact: 'medium' as const,
        implementation: `Promotional campaigns selama ${lowSeasons.map(l => l.period).join(', ')}`,
      });

      recommendations.push({
        recommendation: 'Optimize procurement scheduling untuk avoid excess inventory',
        category: 'procurement' as const,
        impact: 'medium' as const,
        implementation: 'Reduce orders 20-30% during low season periods',
      });
    }

    return recommendations;
  }

  private determineTrendDirection(trend: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (trend.length < 2) return 'stable';
    
    const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
    const secondHalf = trend.slice(Math.floor(trend.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  private getMostCommon(items: string[]): string {
    if (items.length === 0) return 'N/A';
    
    const frequency = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(frequency).reduce((max, [item, count]) => 
      count > max.count ? { item, count } : max, { item: 'N/A', count: 0 }).item;
  }

  private generateSeasonalInsights(analyses: SeasonalAnalysisDto[], summary: any): any {
    const seasonalStrategy = [];
    const inventoryPlanning = [];
    const marketingOpportunities = [];
    const forecastingImprovements = [];

    // Seasonal strategy insights
    if (summary.highSeasonalityProducts > 0) {
      seasonalStrategy.push(`${summary.highSeasonalityProducts} produk memiliki high seasonality (>60%)`);
      seasonalStrategy.push('Implement differentiated strategy untuk seasonal vs non-seasonal products');
    }

    seasonalStrategy.push(`Peak season dominan: ${summary.mostCommonPeakSeason}`);
    seasonalStrategy.push(`Low season dominan: ${summary.mostCommonLowSeason}`);

    // Inventory planning
    inventoryPlanning.push('Build inventory 2-3 months sebelum peak season');
    inventoryPlanning.push('Implement dynamic safety stock berdasarkan seasonal patterns');
    inventoryPlanning.push('Plan clearance activities during low seasons');

    // Marketing opportunities
    marketingOpportunities.push('Pre-season marketing campaigns untuk build awareness');
    marketingOpportunities.push('Off-season promotions untuk maintain engagement');
    marketingOpportunities.push('Holiday-specific product bundling strategies');

    // Forecasting improvements
    forecastingImprovements.push('Use seasonal decomposition models untuk high-seasonality products');
    forecastingImprovements.push('Incorporate holiday calendar dalam forecasting models');
    forecastingImprovements.push('Regular model validation dengan seasonal holdout testing');

    return {
      seasonalStrategy,
      inventoryPlanning,
      marketingOpportunities,
      forecastingImprovements,
    };
  }
}