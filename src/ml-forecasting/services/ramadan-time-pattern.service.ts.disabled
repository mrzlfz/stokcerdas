import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as moment from 'moment-timezone';
import { mean, median, standardDeviation, quantile } from 'simple-statistics';

import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * PHASE 3.2.3.2.3: Sahur/Iftar Time-based Pattern Detection
 * 
 * Specialized service for detecting and learning time-of-day patterns specific to Ramadan.
 * Focuses on sahur (pre-dawn meals) and iftar (breaking fast) timing impacts on business.
 */

export interface SahurIftarAnalysisRequest {
  tenantId: string;
  businessType?: string;
  region?: string;
  categories?: string[];
  ramadanYear?: number;
  analysisGranularity: 'hourly' | '30min' | '15min'; // How detailed the time analysis should be
  includeGeoLocation?: boolean; // Consider geographical variations
  includeDayOfWeekEffect?: boolean; // Weekend vs weekday patterns
  minimumTransactionThreshold?: number; // Minimum transactions per time slot for reliability
}

export interface TimeSlotPattern {
  timeSlot: string; // e.g., "04:00-04:30", "18:00-18:15"
  timeSlotType: 'sahur_prep' | 'sahur_peak' | 'morning_post_sahur' | 
                'afternoon_pre_iftar' | 'iftar_prep' | 'iftar_peak' | 
                'evening_post_iftar' | 'late_evening' | 'regular';
  baselineMultiplier: number; // vs same time in non-Ramadan
  ramadanMultiplier: number; // vs overall Ramadan average
  confidence: number;
  characteristics: {
    transactionVolume: number;
    averageOrderValue: number;
    purchaseFrequency: number;
    customerBehavior: 'rushed' | 'planned' | 'bulk' | 'selective' | 'routine';
    peakDuration: number; // Minutes of peak activity
    intensityScore: number; // 0-1, how intense the activity is
  };
  categoryBreakdown: Record<string, {
    volume: number;
    multiplier: number;
    significance: 'high' | 'medium' | 'low';
  }>;
  weekdayWeekendDifference?: {
    weekdayMultiplier: number;
    weekendMultiplier: number;
    significantDifference: boolean;
  };
  geographicalVariations?: Record<string, number>; // Region -> multiplier
}

export interface SahurPattern {
  overallSahurEffect: {
    totalSahurMultiplier: number; // 3-6 AM vs baseline
    peakSahurHour: string; // e.g., "04:30"
    sahurDuration: number; // Minutes of elevated activity
    confidence: number;
  };
  timeSlotBreakdown: TimeSlotPattern[];
  categoryInsights: {
    strongestSahurCategories: string[]; // Categories most affected
    preparationCategories: string[]; // Categories bought during prep
    consumptionCategories: string[]; // Categories bought for immediate use
  };
  businessRecommendations: {
    optimalStockingHours: string[];
    staffingRecommendations: string[];
    promotionalTiming: string[];
    inventoryPreparation: Record<string, string>; // Category -> recommendation
  };
}

export interface IftarPattern {
  overallIftarEffect: {
    totalIftarMultiplier: number; // 5-8 PM vs baseline
    peakIftarHour: string; // e.g., "18:15"
    iftarDuration: number; // Minutes of elevated activity
    preIftarRushDuration: number; // Minutes before iftar with high activity
    confidence: number;
  };
  timeSlotBreakdown: TimeSlotPattern[];
  rushPatterns: {
    lastMinuteRushStart: string; // e.g., "17:30"
    rushIntensity: number; // How much more intense than normal
    rushCategories: string[]; // What categories see rush buying
  };
  familyPatterns: {
    familyShoppingHours: string[]; // When families shop together
    bulkPurchaseHours: string[]; // When bulk buying occurs
    freshItemsHours: string[]; // When fresh items are prioritized
  };
  businessRecommendations: {
    rushPreparationTime: string;
    lastMinuteStockChecklist: string[];
    customerFlowManagement: string[];
    expressCheckoutHours: string[];
  };
}

export interface SahurIftarLearningResult {
  analysisId: string;
  tenantId: string;
  ramadanYear: number;
  sahurPatterns: SahurPattern;
  iftarPatterns: IftarPattern;
  overallInsights: {
    primaryTimeShifts: string[]; // Major time shift observations
    customerBehaviorChanges: string[]; // How behavior changes during Ramadan
    businessImpactSummary: string[]; // Key business impact insights
    operationalRecommendations: string[]; // Actionable operational advice
  };
  forecasting: {
    nextRamadanPredictions: {
      expectedSahurPeakHour: string;
      expectedIftarPeakHour: string;
      highestImpactCategories: string[];
      recommendedPreparationWeeks: number;
    };
    timeSlotMultipliers: Record<string, number>; // Time -> multiplier for forecasting
  };
  qualityMetrics: {
    dataReliability: number; // 0-1
    patternConsistency: number; // 0-1
    timeGranularityAccuracy: number; // 0-1
    behaviorPredictability: number; // 0-1
  };
  metadata: {
    totalTimeSlotAnalyzed: number;
    totalTransactionsAnalyzed: number;
    analysisGranularity: string;
    geographicalScope: string[];
    generatedAt: string;
    validityPeriod: string; // Until when these patterns are expected to be valid
  };
}

@Injectable()
export class RamadanTimePatternService {
  private readonly logger = new Logger(RamadanTimePatternService.name);
  private readonly CACHE_TTL = 86400 * 30; // 30 days cache for time patterns
  private readonly INDONESIAN_TIMEZONE = 'Asia/Jakarta';

  // Indonesian prayer times (approximate - production should use accurate prayer time API)
  private readonly typicalPrayerTimes = {
    fajr: '04:30', // Dawn prayer, start of sahur
    sahur_end: '05:30', // End of sahur eating time
    maghrib: '18:00', // Sunset prayer, iftar time
    iftar_main: '18:30', // Main iftar meal time
    isha: '19:30', // Night prayer
  };

  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Analyze Sahur and Iftar time-based patterns for a specific Ramadan period
   */
  async analyzeSahurIftarPatterns(request: SahurIftarAnalysisRequest): Promise<SahurIftarLearningResult> {
    const analysisId = `sahur_iftar_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.logger.log(`Starting Sahur/Iftar pattern analysis: ${analysisId} for tenant: ${request.tenantId}`);

      // Get Ramadan period dates
      const ramadanPeriod = this.getRamadanPeriod(request.ramadanYear || new Date().getFullYear());
      
      if (!ramadanPeriod) {
        throw new Error(`No Ramadan period data available for year ${request.ramadanYear}`);
      }

      // Get transaction data for Ramadan period with hourly/sub-hourly granularity
      const ramadanTransactions = await this.getRamadanTimeTransactionData(
        request,
        ramadanPeriod.startDate,
        ramadanPeriod.endDate
      );

      // Get baseline (non-Ramadan) transaction data for comparison
      const baselineTransactions = await this.getBaselineTimeTransactionData(
        request,
        ramadanPeriod.startDate,
        ramadanPeriod.endDate
      );

      if (ramadanTransactions.length < 100) {
        throw new Error(`Insufficient Ramadan transaction data: ${ramadanTransactions.length}. Minimum 100 required.`);
      }

      // Analyze Sahur patterns (3-6 AM)
      const sahurPatterns = await this.analyzeSahurPatterns(
        ramadanTransactions,
        baselineTransactions,
        request
      );

      // Analyze Iftar patterns (5-8 PM)
      const iftarPatterns = await this.analyzeIftarPatterns(
        ramadanTransactions,
        baselineTransactions,
        request
      );

      // Generate overall insights and recommendations
      const overallInsights = this.generateOverallInsights(sahurPatterns, iftarPatterns);
      
      // Create forecasting guidance
      const forecasting = this.generateForecastingGuidance(sahurPatterns, iftarPatterns, ramadanPeriod);
      
      // Assess quality of analysis
      const qualityMetrics = this.assessAnalysisQuality(ramadanTransactions, baselineTransactions, request);

      const result: SahurIftarLearningResult = {
        analysisId,
        tenantId: request.tenantId,
        ramadanYear: ramadanPeriod.year,
        sahurPatterns,
        iftarPatterns,
        overallInsights,
        forecasting,
        qualityMetrics,
        metadata: {
          totalTimeSlotAnalyzed: this.calculateTotalTimeSlots(request.analysisGranularity),
          totalTransactionsAnalyzed: ramadanTransactions.length + baselineTransactions.length,
          analysisGranularity: request.analysisGranularity,
          geographicalScope: request.region ? [request.region] : ['national'],
          generatedAt: new Date().toISOString(),
          validityPeriod: moment().add(1, 'year').toISOString()
        }
      };

      // Cache the results
      await this.cacheManager.set(
        `sahur_iftar_patterns_${request.tenantId}_${request.ramadanYear}`,
        result,
        this.CACHE_TTL
      );

      this.logger.log(`Sahur/Iftar pattern analysis completed: ${analysisId}`);
      return result;

    } catch (error) {
      this.logger.error(`Sahur/Iftar pattern analysis failed: ${error.message}`, error.stack);
      throw new Error(`Time pattern analysis failed: ${error.message}`);
    }
  }

  /**
   * Get Ramadan period information
   */
  private getRamadanPeriod(year: number): { startDate: Date; endDate: Date; year: number } | null {
    const ramadanDates = {
      2024: { start: '2024-03-11', end: '2024-04-09' },
      2025: { start: '2025-02-28', end: '2025-03-29' },
      2026: { start: '2026-02-17', end: '2026-03-18' }
    };

    const dates = ramadanDates[year];
    if (!dates) return null;

    return {
      startDate: new Date(dates.start),
      endDate: new Date(dates.end),
      year
    };
  }

  /**
   * Get Ramadan transaction data with time granularity
   */
  private async getRamadanTimeTransactionData(
    request: SahurIftarAnalysisRequest,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('transaction.tenantId = :tenantId', { tenantId: request.tenantId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .andWhere('transaction.transactionDate BETWEEN :startDate AND :endDate', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
      .orderBy('transaction.transactionDate', 'ASC');

    if (request.categories?.length) {
      queryBuilder.andWhere('category.name IN (:...categories)', { categories: request.categories });
    }

    const transactions = await queryBuilder.getMany();

    return transactions.map(transaction => {
      const transactionMoment = moment(transaction.transactionDate).tz(this.INDONESIAN_TIMEZONE);
      
      return {
        id: transaction.id,
        datetime: transactionMoment,
        hour: transactionMoment.hour(),
        minute: transactionMoment.minute(),
        timeSlot: this.determineTimeSlot(transactionMoment, request.analysisGranularity),
        timeSlotType: this.determineTimeSlotType(transactionMoment),
        revenue: Number(transaction.quantity) * Number(transaction.unitCost),
        quantity: Number(transaction.quantity),
        category: transaction.product?.category?.name || 'uncategorized',
        productId: transaction.product?.id,
        dayOfWeek: transactionMoment.day(),
        isWeekend: transactionMoment.day() === 0 || transactionMoment.day() === 6,
        ramadanDay: Math.ceil(transactionMoment.diff(moment(startDate), 'days')) + 1
      };
    });
  }

  /**
   * Get baseline (non-Ramadan) transaction data for comparison
   */
  private async getBaselineTimeTransactionData(
    request: SahurIftarAnalysisRequest,
    ramadanStartDate: Date,
    ramadanEndDate: Date
  ): Promise<any[]> {
    // Get same period from previous year (non-Ramadan)
    const baselineStart = moment(ramadanStartDate).subtract(1, 'year').toDate();
    const baselineEnd = moment(ramadanEndDate).subtract(1, 'year').toDate();

    return this.getRamadanTimeTransactionData(
      { ...request, ramadanYear: request.ramadanYear ? request.ramadanYear - 1 : undefined },
      baselineStart,
      baselineEnd
    );
  }

  /**
   * Determine time slot based on granularity
   */
  private determineTimeSlot(momentDate: moment.Moment, granularity: 'hourly' | '30min' | '15min'): string {
    const hour = momentDate.hour();
    const minute = momentDate.minute();

    switch (granularity) {
      case 'hourly':
        return `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
      
      case '30min':
        const halfHour = minute < 30 ? '00' : '30';
        const nextHalfHour = minute < 30 ? '30' : '00';
        const nextHour = minute < 30 ? hour : hour + 1;
        return `${hour.toString().padStart(2, '0')}:${halfHour}-${nextHour.toString().padStart(2, '0')}:${nextHalfHour}`;
      
      case '15min':
        const quarter = Math.floor(minute / 15) * 15;
        const nextQuarter = quarter + 15;
        const nextHourQuarter = nextQuarter >= 60 ? hour + 1 : hour;
        const nextMinuteQuarter = nextQuarter >= 60 ? '00' : nextQuarter.toString().padStart(2, '0');
        return `${hour.toString().padStart(2, '0')}:${quarter.toString().padStart(2, '0')}-${nextHourQuarter.toString().padStart(2, '0')}:${nextMinuteQuarter}`;
      
      default:
        return `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`;
    }
  }

  /**
   * Determine time slot type based on Ramadan prayer times and eating patterns
   */
  private determineTimeSlotType(momentDate: moment.Moment): TimeSlotPattern['timeSlotType'] {
    const hour = momentDate.hour();
    const minute = momentDate.minute();
    const totalMinutes = hour * 60 + minute;

    // Sahur period analysis (3-6 AM)
    if (totalMinutes >= 3 * 60 && totalMinutes < 4 * 60) {
      return 'sahur_prep'; // 3-4 AM: Preparation for sahur
    } else if (totalMinutes >= 4 * 60 && totalMinutes < 5.5 * 60) {
      return 'sahur_peak'; // 4-5:30 AM: Peak sahur eating time
    } else if (totalMinutes >= 5.5 * 60 && totalMinutes < 7 * 60) {
      return 'morning_post_sahur'; // 5:30-7 AM: Post-sahur period
    }

    // Iftar period analysis (5-8 PM)
    else if (totalMinutes >= 17 * 60 && totalMinutes < 18 * 60) {
      return 'afternoon_pre_iftar'; // 5-6 PM: Pre-iftar preparation
    } else if (totalMinutes >= 18 * 60 && totalMinutes < 18.5 * 60) {
      return 'iftar_prep'; // 6-6:30 PM: Iftar preparation time
    } else if (totalMinutes >= 18.5 * 60 && totalMinutes < 20 * 60) {
      return 'iftar_peak'; // 6:30-8 PM: Peak iftar and eating time
    } else if (totalMinutes >= 20 * 60 && totalMinutes < 22 * 60) {
      return 'evening_post_iftar'; // 8-10 PM: Post-iftar evening
    } else if (totalMinutes >= 22 * 60 || totalMinutes < 3 * 60) {
      return 'late_evening'; // 10 PM-3 AM: Late evening and night
    }

    return 'regular'; // All other times
  }

  /**
   * Analyze Sahur patterns (3-6 AM)
   */
  private async analyzeSahurPatterns(
    ramadanTransactions: any[],
    baselineTransactions: any[],
    request: SahurIftarAnalysisRequest
  ): Promise<SahurPattern> {
    // Filter for Sahur time period
    const sahurTypes = ['sahur_prep', 'sahur_peak', 'morning_post_sahur'];
    const sahurRamadanTx = ramadanTransactions.filter(tx => sahurTypes.includes(tx.timeSlotType));
    const sahurBaselineTx = baselineTransactions.filter(tx => sahurTypes.includes(tx.timeSlotType));

    // Calculate overall Sahur effect
    const sahurRamadanRevenue = sahurRamadanTx.reduce((sum, tx) => sum + tx.revenue, 0);
    const sahurBaselineRevenue = sahurBaselineTx.reduce((sum, tx) => sum + tx.revenue, 0);
    
    const sahurRamadanDays = this.getUniqueDays(sahurRamadanTx);
    const sahurBaselineDays = this.getUniqueDays(sahurBaselineTx);
    
    const sahurRamadanDaily = sahurRamadanDays > 0 ? sahurRamadanRevenue / sahurRamadanDays : 0;
    const sahurBaselineDaily = sahurBaselineDays > 0 ? sahurBaselineRevenue / sahurBaselineDays : 0;
    
    const totalSahurMultiplier = sahurBaselineDaily > 0 ? sahurRamadanDaily / sahurBaselineDaily : 1.0;

    // Find peak Sahur hour
    const hourlyRamadanRevenue = this.groupByHour(sahurRamadanTx);
    const peakHour = this.findPeakHour(hourlyRamadanRevenue);
    
    // Analyze time slot breakdown
    const timeSlotBreakdown = this.analyzeTimeSlotBreakdown(
      sahurRamadanTx,
      sahurBaselineTx,
      request,
      'sahur'
    );

    // Identify category insights
    const categoryInsights = this.analyzeSahurCategoryInsights(sahurRamadanTx, sahurBaselineTx);

    // Generate business recommendations
    const businessRecommendations = this.generateSahurBusinessRecommendations(
      timeSlotBreakdown,
      categoryInsights,
      peakHour
    );

    return {
      overallSahurEffect: {
        totalSahurMultiplier,
        peakSahurHour: peakHour,
        sahurDuration: this.calculateSahurDuration(timeSlotBreakdown),
        confidence: this.calculateConfidence(sahurRamadanTx, sahurBaselineTx)
      },
      timeSlotBreakdown,
      categoryInsights,
      businessRecommendations
    };
  }

  /**
   * Analyze Iftar patterns (5-8 PM)
   */
  private async analyzeIftarPatterns(
    ramadanTransactions: any[],
    baselineTransactions: any[],
    request: SahurIftarAnalysisRequest
  ): Promise<IftarPattern> {
    // Filter for Iftar time period
    const iftarTypes = ['afternoon_pre_iftar', 'iftar_prep', 'iftar_peak', 'evening_post_iftar'];
    const iftarRamadanTx = ramadanTransactions.filter(tx => iftarTypes.includes(tx.timeSlotType));
    const iftarBaselineTx = baselineTransactions.filter(tx => iftarTypes.includes(tx.timeSlotType));

    // Calculate overall Iftar effect
    const iftarRamadanRevenue = iftarRamadanTx.reduce((sum, tx) => sum + tx.revenue, 0);
    const iftarBaselineRevenue = iftarBaselineTx.reduce((sum, tx) => sum + tx.revenue, 0);
    
    const iftarRamadanDays = this.getUniqueDays(iftarRamadanTx);
    const iftarBaselineDays = this.getUniqueDays(iftarBaselineTx);
    
    const iftarRamadanDaily = iftarRamadanDays > 0 ? iftarRamadanRevenue / iftarRamadanDays : 0;
    const iftarBaselineDaily = iftarBaselineDays > 0 ? iftarBaselineRevenue / iftarBaselineDays : 0;
    
    const totalIftarMultiplier = iftarBaselineDaily > 0 ? iftarRamadanDaily / iftarBaselineDaily : 1.0;

    // Find peak Iftar hour and pre-iftar rush
    const hourlyRamadanRevenue = this.groupByHour(iftarRamadanTx);
    const peakHour = this.findPeakHour(hourlyRamadanRevenue);
    
    // Analyze time slot breakdown
    const timeSlotBreakdown = this.analyzeTimeSlotBreakdown(
      iftarRamadanTx,
      iftarBaselineTx,
      request,
      'iftar'
    );

    // Analyze rush patterns
    const rushPatterns = this.analyzeRushPatterns(iftarRamadanTx, timeSlotBreakdown);

    // Analyze family shopping patterns
    const familyPatterns = this.analyzeFamilyPatterns(iftarRamadanTx, request);

    // Generate business recommendations
    const businessRecommendations = this.generateIftarBusinessRecommendations(
      timeSlotBreakdown,
      rushPatterns,
      familyPatterns
    );

    return {
      overallIftarEffect: {
        totalIftarMultiplier,
        peakIftarHour: peakHour,
        iftarDuration: this.calculateIftarDuration(timeSlotBreakdown),
        preIftarRushDuration: rushPatterns.lastMinuteRushStart ? 
          this.calculateRushDuration(rushPatterns.lastMinuteRushStart, peakHour) : 0,
        confidence: this.calculateConfidence(iftarRamadanTx, iftarBaselineTx)
      },
      timeSlotBreakdown,
      rushPatterns,
      familyPatterns,
      businessRecommendations
    };
  }

  // Helper methods for analysis
  private getUniqueDays(transactions: any[]): number {
    const uniqueDays = new Set(transactions.map(tx => tx.datetime.format('YYYY-MM-DD')));
    return uniqueDays.size;
  }

  private groupByHour(transactions: any[]): Record<number, number> {
    const hourlyRevenue: Record<number, number> = {};
    
    transactions.forEach(tx => {
      const hour = tx.hour;
      hourlyRevenue[hour] = (hourlyRevenue[hour] || 0) + tx.revenue;
    });
    
    return hourlyRevenue;
  }

  private findPeakHour(hourlyRevenue: Record<number, number>): string {
    let maxRevenue = 0;
    let peakHour = 0;
    
    Object.entries(hourlyRevenue).forEach(([hour, revenue]) => {
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        peakHour = parseInt(hour);
      }
    });
    
    return `${peakHour.toString().padStart(2, '0')}:00`;
  }

  private analyzeTimeSlotBreakdown(
    ramadanTx: any[],
    baselineTx: any[],
    request: SahurIftarAnalysisRequest,
    period: 'sahur' | 'iftar'
  ): TimeSlotPattern[] {
    const timeSlots = new Set([...ramadanTx, ...baselineTx].map(tx => tx.timeSlot));
    const breakdown: TimeSlotPattern[] = [];

    for (const timeSlot of timeSlots) {
      const ramadanSlotTx = ramadanTx.filter(tx => tx.timeSlot === timeSlot);
      const baselineSlotTx = baselineTx.filter(tx => tx.timeSlot === timeSlot);

      if (ramadanSlotTx.length >= (request.minimumTransactionThreshold || 5)) {
        const pattern = this.analyzeTimeSlotPattern(
          timeSlot,
          ramadanSlotTx,
          baselineSlotTx,
          request
        );
        
        breakdown.push(pattern);
      }
    }

    return breakdown.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }

  private analyzeTimeSlotPattern(
    timeSlot: string,
    ramadanTx: any[],
    baselineTx: any[],
    request: SahurIftarAnalysisRequest
  ): TimeSlotPattern {
    // Calculate multipliers
    const ramadanAverage = this.calculateAverageRevenue(ramadanTx);
    const baselineAverage = this.calculateAverageRevenue(baselineTx);
    const baselineMultiplier = baselineAverage > 0 ? ramadanAverage / baselineAverage : 1.0;

    // Determine time slot type
    const timeSlotType = ramadanTx.length > 0 ? ramadanTx[0].timeSlotType : 'regular';

    // Calculate characteristics
    const characteristics = this.calculateTimeSlotCharacteristics(ramadanTx, baselineTx);

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(ramadanTx, baselineTx);

    // Weekend vs weekday analysis if requested
    const weekdayWeekendDifference = request.includeDayOfWeekEffect 
      ? this.analyzeWeekdayWeekendDifference(ramadanTx, baselineTx)
      : undefined;

    return {
      timeSlot,
      timeSlotType,
      baselineMultiplier,
      ramadanMultiplier: baselineMultiplier, // Simplified - would calculate vs overall Ramadan average
      confidence: this.calculateConfidence(ramadanTx, baselineTx),
      characteristics,
      categoryBreakdown,
      weekdayWeekendDifference
    };
  }

  private calculateAverageRevenue(transactions: any[]): number {
    if (transactions.length === 0) return 0;
    
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.revenue, 0);
    const uniqueDays = this.getUniqueDays(transactions);
    
    return uniqueDays > 0 ? totalRevenue / uniqueDays : 0;
  }

  private calculateTimeSlotCharacteristics(ramadanTx: any[], baselineTx: any[]): TimeSlotPattern['characteristics'] {
    const ramadanVolume = ramadanTx.reduce((sum, tx) => sum + tx.quantity, 0);
    const ramadanRevenue = ramadanTx.reduce((sum, tx) => sum + tx.revenue, 0);
    const ramadanAOV = ramadanTx.length > 0 ? ramadanRevenue / ramadanTx.length : 0;

    const baselineVolume = baselineTx.reduce((sum, tx) => sum + tx.quantity, 0);
    const baselineRevenue = baselineTx.reduce((sum, tx) => sum + tx.revenue, 0);
    const baselineAOV = baselineTx.length > 0 ? baselineRevenue / baselineTx.length : 0;

    // Determine customer behavior based on transaction patterns
    const avgTransactionValue = ramadanAOV;
    const transactionFrequency = ramadanTx.length;
    
    let customerBehavior: TimeSlotPattern['characteristics']['customerBehavior'];
    if (avgTransactionValue > baselineAOV * 1.5 && transactionFrequency < baselineTx.length * 0.8) {
      customerBehavior = 'bulk';
    } else if (transactionFrequency > baselineTx.length * 1.2) {
      customerBehavior = 'rushed';
    } else if (avgTransactionValue > baselineAOV * 1.2) {
      customerBehavior = 'planned';
    } else if (ramadanVolume < baselineVolume * 0.8) {
      customerBehavior = 'selective';
    } else {
      customerBehavior = 'routine';
    }

    return {
      transactionVolume: ramadanVolume,
      averageOrderValue: ramadanAOV,
      purchaseFrequency: transactionFrequency,
      customerBehavior,
      peakDuration: 60, // Simplified - would calculate actual duration
      intensityScore: Math.min(1.0, transactionFrequency / 100) // Simplified scoring
    };
  }

  private calculateCategoryBreakdown(ramadanTx: any[], baselineTx: any[]): Record<string, {
    volume: number;
    multiplier: number;
    significance: 'high' | 'medium' | 'low';
  }> {
    const categoryBreakdown: Record<string, any> = {};
    
    // Group by category
    const ramadanByCategory = this.groupByCategory(ramadanTx);
    const baselineByCategory = this.groupByCategory(baselineTx);
    
    const allCategories = new Set([
      ...Object.keys(ramadanByCategory),
      ...Object.keys(baselineByCategory)
    ]);

    for (const category of allCategories) {
      const ramadanCategoryRevenue = ramadanByCategory[category] || 0;
      const baselineCategoryRevenue = baselineByCategory[category] || 0;
      const multiplier = baselineCategoryRevenue > 0 ? ramadanCategoryRevenue / baselineCategoryRevenue : 1.0;
      
      let significance: 'high' | 'medium' | 'low';
      if (multiplier > 2.0 || multiplier < 0.5) {
        significance = 'high';
      } else if (multiplier > 1.5 || multiplier < 0.7) {
        significance = 'medium';
      } else {
        significance = 'low';
      }

      categoryBreakdown[category] = {
        volume: ramadanByCategory[category] || 0,
        multiplier,
        significance
      };
    }

    return categoryBreakdown;
  }

  private groupByCategory(transactions: any[]): Record<string, number> {
    const categoryRevenue: Record<string, number> = {};
    
    transactions.forEach(tx => {
      categoryRevenue[tx.category] = (categoryRevenue[tx.category] || 0) + tx.revenue;
    });
    
    return categoryRevenue;
  }

  private analyzeWeekdayWeekendDifference(ramadanTx: any[], baselineTx: any[]): {
    weekdayMultiplier: number;
    weekendMultiplier: number;
    significantDifference: boolean;
  } {
    const ramadanWeekday = ramadanTx.filter(tx => !tx.isWeekend);
    const ramadanWeekend = ramadanTx.filter(tx => tx.isWeekend);
    const baselineWeekday = baselineTx.filter(tx => !tx.isWeekend);
    const baselineWeekend = baselineTx.filter(tx => tx.isWeekend);

    const weekdayMultiplier = this.calculateAverageRevenue(baselineWeekday) > 0 
      ? this.calculateAverageRevenue(ramadanWeekday) / this.calculateAverageRevenue(baselineWeekday)
      : 1.0;

    const weekendMultiplier = this.calculateAverageRevenue(baselineWeekend) > 0
      ? this.calculateAverageRevenue(ramadanWeekend) / this.calculateAverageRevenue(baselineWeekend)
      : 1.0;

    const significantDifference = Math.abs(weekdayMultiplier - weekendMultiplier) > 0.2;

    return {
      weekdayMultiplier,
      weekendMultiplier,
      significantDifference
    };
  }

  private calculateConfidence(ramadanTx: any[], baselineTx: any[]): number {
    let confidence = 0.5;
    
    // Sample size factor
    const totalSampleSize = ramadanTx.length + baselineTx.length;
    confidence += Math.min(0.3, totalSampleSize / 1000);
    
    // Data balance factor
    const balanceFactor = Math.min(ramadanTx.length, baselineTx.length) / 
                         Math.max(ramadanTx.length, baselineTx.length);
    confidence += balanceFactor * 0.2;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // Additional helper methods would continue here...
  private analyzeSahurCategoryInsights(sahurRamadanTx: any[], sahurBaselineTx: any[]): SahurPattern['categoryInsights'] {
    const categoryMultipliers = this.calculateCategoryBreakdown(sahurRamadanTx, sahurBaselineTx);
    
    const strongestCategories = Object.entries(categoryMultipliers)
      .filter(([_, data]) => data.significance === 'high' && data.multiplier > 1.5)
      .sort((a, b) => b[1].multiplier - a[1].multiplier)
      .slice(0, 5)
      .map(([category]) => category);

    return {
      strongestSahurCategories: strongestCategories,
      preparationCategories: strongestCategories.filter(cat => 
        cat.toLowerCase().includes('food') || cat.toLowerCase().includes('drink')
      ),
      consumptionCategories: strongestCategories.filter(cat => 
        cat.toLowerCase().includes('fresh') || cat.toLowerCase().includes('ready')
      )
    };
  }

  private generateSahurBusinessRecommendations(
    timeSlotBreakdown: TimeSlotPattern[],
    categoryInsights: SahurPattern['categoryInsights'],
    peakHour: string
  ): SahurPattern['businessRecommendations'] {
    return {
      optimalStockingHours: ['22:00', '23:00', '00:00'], // Late night preparation
      staffingRecommendations: [`Minimal staff 3-4 AM`, `Peak staff ${peakHour}-6:00`],
      promotionalTiming: ['Late evening (10-11 PM) for next day sahur'],
      inventoryPreparation: categoryInsights.strongestSahurCategories.reduce((acc, category) => {
        acc[category] = 'Stock up evening before, ensure 24-hour availability';
        return acc;
      }, {} as Record<string, string>)
    };
  }

  private analyzeRushPatterns(iftarTx: any[], timeSlotBreakdown: TimeSlotPattern[]): IftarPattern['rushPatterns'] {
    // Find when rush begins (significant increase in activity)
    const preIftarSlots = timeSlotBreakdown.filter(slot => 
      slot.timeSlotType === 'afternoon_pre_iftar' || slot.timeSlotType === 'iftar_prep'
    );

    const rushSlot = preIftarSlots.find(slot => slot.baselineMultiplier > 1.5);
    const lastMinuteRushStart = rushSlot ? rushSlot.timeSlot.split('-')[0] : '17:30';

    const rushTx = iftarTx.filter(tx => {
      const txHour = tx.hour;
      const rushHour = parseInt(lastMinuteRushStart.split(':')[0]);
      return txHour >= rushHour && txHour < 18;
    });

    const normalTx = iftarTx.filter(tx => tx.hour < 17);
    const rushIntensity = normalTx.length > 0 ? rushTx.length / normalTx.length : 1.0;

    const rushCategories = Object.entries(this.groupByCategory(rushTx))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    return {
      lastMinuteRushStart,
      rushIntensity,
      rushCategories
    };
  }

  private analyzeFamilyPatterns(iftarTx: any[], request: SahurIftarAnalysisRequest): IftarPattern['familyPatterns'] {
    // Weekend typically indicates family shopping
    const weekendTx = iftarTx.filter(tx => tx.isWeekend);
    const weekdayTx = iftarTx.filter(tx => !tx.isWeekend);

    // Higher AOV typically indicates bulk/family purchases
    const bulkTx = iftarTx.filter(tx => tx.revenue > mean(iftarTx.map(t => t.revenue)) * 1.5);

    return {
      familyShoppingHours: weekendTx.length > weekdayTx.length ? ['16:00-18:00', '19:00-20:00'] : ['17:00-18:00'],
      bulkPurchaseHours: this.getTimeRanges(bulkTx),
      freshItemsHours: ['17:30-18:30'] // Typically close to iftar time
    };
  }

  private generateIftarBusinessRecommendations(
    timeSlotBreakdown: TimeSlotPattern[],
    rushPatterns: IftarPattern['rushPatterns'],
    familyPatterns: IftarPattern['familyPatterns']
  ): IftarPattern['businessRecommendations'] {
    return {
      rushPreparationTime: `30 minutes before ${rushPatterns.lastMinuteRushStart}`,
      lastMinuteStockChecklist: rushPatterns.rushCategories,
      customerFlowManagement: [
        'Setup express checkout 17:00-18:30',
        'Additional staff during rush period',
        'Queue management system'
      ],
      expressCheckoutHours: ['17:00-18:30']
    };
  }

  // Additional helper methods
  private calculateSahurDuration(timeSlotBreakdown: TimeSlotPattern[]): number {
    const sahurSlots = timeSlotBreakdown.filter(slot => 
      slot.timeSlotType.includes('sahur') && slot.baselineMultiplier > 1.2
    );
    return sahurSlots.length * 60; // Assume 60 minutes per slot
  }

  private calculateIftarDuration(timeSlotBreakdown: TimeSlotPattern[]): number {
    const iftarSlots = timeSlotBreakdown.filter(slot => 
      slot.timeSlotType.includes('iftar') && slot.baselineMultiplier > 1.2
    );
    return iftarSlots.length * 60; // Assume 60 minutes per slot
  }

  private calculateRushDuration(rushStart: string, peakHour: string): number {
    const rushHour = parseInt(rushStart.split(':')[0]);
    const peakHourNum = parseInt(peakHour.split(':')[0]);
    return Math.max(0, (peakHourNum - rushHour) * 60);
  }

  private getTimeRanges(transactions: any[]): string[] {
    const hours = transactions.map(tx => tx.hour);
    const minHour = Math.min(...hours);
    const maxHour = Math.max(...hours);
    
    return [`${minHour.toString().padStart(2, '0')}:00-${(maxHour + 1).toString().padStart(2, '0')}:00`];
  }

  private calculateTotalTimeSlots(granularity: string): number {
    switch (granularity) {
      case 'hourly': return 24;
      case '30min': return 48;
      case '15min': return 96;
      default: return 24;
    }
  }

  private generateOverallInsights(
    sahurPatterns: SahurPattern,
    iftarPatterns: IftarPattern
  ): SahurIftarLearningResult['overallInsights'] {
    return {
      primaryTimeShifts: [
        `Sahur peak at ${sahurPatterns.overallSahurEffect.peakSahurHour} (${sahurPatterns.overallSahurEffect.totalSahurMultiplier.toFixed(1)}x normal)`,
        `Iftar peak at ${iftarPatterns.overallIftarEffect.peakIftarHour} (${iftarPatterns.overallIftarEffect.totalIftarMultiplier.toFixed(1)}x normal)`
      ],
      customerBehaviorChanges: [
        'Extended operating hours needed for sahur period',
        'Rush behavior intensifies before iftar',
        'Family shopping patterns emerge during iftar preparation'
      ],
      businessImpactSummary: [
        `Sahur period provides ${((sahurPatterns.overallSahurEffect.totalSahurMultiplier - 1) * 100).toFixed(0)}% revenue increase`,
        `Iftar period provides ${((iftarPatterns.overallIftarEffect.totalIftarMultiplier - 1) * 100).toFixed(0)}% revenue increase`,
        'Time-sensitive inventory management becomes critical'
      ],
      operationalRecommendations: [
        'Implement 24-hour operations or extended hours',
        'Deploy dynamic staffing based on predicted rush times',
        'Optimize inventory allocation for time-sensitive categories'
      ]
    };
  }

  private generateForecastingGuidance(
    sahurPatterns: SahurPattern,
    iftarPatterns: IftarPattern,
    ramadanPeriod: any
  ): SahurIftarLearningResult['forecasting'] {
    return {
      nextRamadanPredictions: {
        expectedSahurPeakHour: sahurPatterns.overallSahurEffect.peakSahurHour,
        expectedIftarPeakHour: iftarPatterns.overallIftarEffect.peakIftarHour,
        highestImpactCategories: [
          ...sahurPatterns.categoryInsights.strongestSahurCategories.slice(0, 3),
          ...iftarPatterns.rushPatterns.rushCategories.slice(0, 2)
        ],
        recommendedPreparationWeeks: 2
      },
      timeSlotMultipliers: this.generateTimeSlotMultipliers(sahurPatterns, iftarPatterns)
    };
  }

  private generateTimeSlotMultipliers(
    sahurPatterns: SahurPattern,
    iftarPatterns: IftarPattern
  ): Record<string, number> {
    const multipliers: Record<string, number> = {};
    
    // Add sahur multipliers
    sahurPatterns.timeSlotBreakdown.forEach(slot => {
      multipliers[slot.timeSlot] = slot.baselineMultiplier;
    });
    
    // Add iftar multipliers
    iftarPatterns.timeSlotBreakdown.forEach(slot => {
      multipliers[slot.timeSlot] = slot.baselineMultiplier;
    });
    
    return multipliers;
  }

  private assessAnalysisQuality(
    ramadanTx: any[],
    baselineTx: any[],
    request: SahurIftarAnalysisRequest
  ): SahurIftarLearningResult['qualityMetrics'] {
    const totalTransactions = ramadanTx.length + baselineTx.length;
    
    return {
      dataReliability: Math.min(1.0, totalTransactions / 1000),
      patternConsistency: 0.85, // Would calculate actual consistency
      timeGranularityAccuracy: request.analysisGranularity === '15min' ? 0.95 : 
                              request.analysisGranularity === '30min' ? 0.90 : 0.80,
      behaviorPredictability: 0.80 // Would calculate based on variance
    };
  }

  /**
   * Get time-specific multiplier for a given date and time
   */
  async getTimeSpecificMultiplier(
    tenantId: string,
    dateTime: Date,
    category?: string
  ): Promise<{
    multiplier: number;
    confidence: number;
    timeSlotType: string;
    explanation: string;
  }> {
    try {
      const year = dateTime.getFullYear();
      const cacheKey = `sahur_iftar_patterns_${tenantId}_${year}`;
      const cachedResult = await this.cacheManager.get(cacheKey) as SahurIftarLearningResult;
      
      if (!cachedResult) {
        return {
          multiplier: 1.0,
          confidence: 0.5,
          timeSlotType: 'regular',
          explanation: 'No time pattern data available'
        };
      }
      
      const momentDateTime = moment(dateTime).tz(this.INDONESIAN_TIMEZONE);
      const timeSlot = this.determineTimeSlot(momentDateTime, 'hourly');
      const timeSlotType = this.determineTimeSlotType(momentDateTime);
      
      // Find matching time slot in patterns
      const allTimeSlots = [
        ...cachedResult.sahurPatterns.timeSlotBreakdown,
        ...cachedResult.iftarPatterns.timeSlotBreakdown
      ];
      
      const matchingSlot = allTimeSlots.find(slot => slot.timeSlot === timeSlot);
      
      if (matchingSlot) {
        let multiplier = matchingSlot.baselineMultiplier;
        
        // Apply category-specific adjustment if available
        if (category && matchingSlot.categoryBreakdown[category]) {
          multiplier = matchingSlot.categoryBreakdown[category].multiplier;
        }
        
        return {
          multiplier,
          confidence: matchingSlot.confidence,
          timeSlotType: matchingSlot.timeSlotType,
          explanation: `${timeSlotType} pattern (${timeSlot})`
        };
      }
      
      return {
        multiplier: 1.0,
        confidence: 0.8,
        timeSlotType,
        explanation: `No specific pattern data for ${timeSlot}`
      };
      
    } catch (error) {
      this.logger.warn(`Failed to get time-specific multiplier: ${error.message}`);
      return {
        multiplier: 1.0,
        confidence: 0.5,
        timeSlotType: 'regular',
        explanation: 'Error retrieving time pattern'
      };
    }
  }
}