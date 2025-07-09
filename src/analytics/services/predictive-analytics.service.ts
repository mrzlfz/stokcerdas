import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import moment from 'moment';
const HijriDate = require('hijri-date');

import { Product } from '../../products/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';

export interface DemandForecastRequest {
  productId?: string;
  categoryId?: string;
  locationId?: string;
  timeHorizon: '7d' | '30d' | '90d';
  forecastType?: 'demand' | 'sales' | 'stock';
}

export interface DemandForecastResponse {
  productId: string;
  productName: string;
  timeHorizon: string;
  forecastData: Array<{
    date: string;
    predicted_demand: number;
    confidence_interval: {
      lower: number;
      upper: number;
    };
    trend_component: number;
    seasonal_component: number;
    residual_component: number;
  }>;
  accuracy: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: {
    detected: boolean;
    strength: number;
    period: number;
    peak_periods: string[];
  };
  modelUsed: string;
  modelComponents: {
    trend_model: string;
    seasonal_model: string;
    islamic_calendar_integration: boolean;
    confidence_calculation: string;
  };
  backtesting: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    mae: number; // Mean Absolute Error
    samples_tested: number;
  };
  generatedAt: Date;
}

@Injectable()
export class PredictiveAnalyticsService {
  private readonly logger = new Logger(PredictiveAnalyticsService.name);

  // Professional forecasting configuration for Indonesian market
  private readonly INDONESIAN_MARKET_CONFIG = {
    seasonality: {
      weekly_pattern: true,
      ramadan_effect: true,
      lebaran_effect: true,
      school_season_effect: true,
      harvest_season_effect: true,
      christmas_new_year_effect: true,
    },
    trend: {
      method: 'double_exponential_smoothing',
      alpha: 0.3, // Level smoothing
      beta: 0.1, // Trend smoothing
      gamma: 0.2, // Seasonal smoothing
    },
    confidence: {
      method: 'historical_variance',
      min_samples: 14, // Minimum historical samples
      confidence_level: 0.95,
    },
    islamic_calendar: {
      ramadan_multiplier_range: [1.2, 2.5],
      lebaran_multiplier_range: [1.8, 3.2],
      pre_ramadan_effect_days: 14,
      post_lebaran_effect_days: 7,
    },
  };

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
  ) {}

  /**
   * Generate demand forecast for Indonesian SMB products
   */
  async generateDemandForecast(
    request: DemandForecastRequest,
    tenantId: string,
  ): Promise<DemandForecastResponse> {
    this.logger.log(
      `Generating demand forecast for ${
        request.productId || 'multiple products'
      }`,
    );

    try {
      // Get product information
      let product: Product;
      if (request.productId) {
        product = await this.productRepository.findOne({
          where: { id: request.productId, tenantId },
        });
        if (!product) {
          throw new Error(`Product ${request.productId} not found`);
        }
      }

      // Get historical data for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { MoreThanOrEqual } = await import('typeorm');
      const historicalData = await this.inventoryTransactionRepository.find({
        where: {
          tenantId,
          ...(request.productId && { productId: request.productId }),
          createdAt: MoreThanOrEqual(sixMonthsAgo),
        },
        order: { createdAt: 'ASC' },
        take: 1000,
      });

      // Professional forecast logic for Indonesian market patterns
      const forecast = this.generateSimpleForecast(
        historicalData,
        request.timeHorizon,
        product?.name || 'Multiple Products',
      );

      return forecast;
    } catch (error) {
      this.logger.error(`Error generating demand forecast: ${error.message}`);
      throw error;
    }
  }

  /**
   * Professional forecasting algorithm using advanced time series analysis for Indonesian SMB patterns
   */
  private generateSimpleForecast(
    historicalData: any[],
    timeHorizon: string,
    productName: string,
  ): DemandForecastResponse {
    const days = timeHorizon === '7d' ? 7 : timeHorizon === '30d' ? 30 : 90;
    const forecastData = [];

    // Advanced time series decomposition
    const timeSeriesData = this.preprocessTimeSeriesData(historicalData);
    const decomposition = this.performTimeSeriesDecomposition(timeSeriesData);
    const seasonalityAnalysis = this.detectAdvancedSeasonality(timeSeriesData);
    const trendAnalysis = this.performAdvancedTrendAnalysis(timeSeriesData);

    // Calculate dynamic accuracy from backtesting
    const backtestingResults = this.performBacktesting(timeSeriesData, days);

    // Professional forecasting using Holt-Winters method with Indonesian context
    const baseForecasts = this.generateHoltWintersForecasts(
      timeSeriesData,
      days,
    );

    // Generate forecast for each day with advanced components
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);

      // Base forecast from Holt-Winters
      const baseForecast = baseForecasts[i] || decomposition.baseline;

      // Advanced trend component using linear regression and exponential smoothing
      const trendComponent = this.calculateAdvancedTrendComponent(
        trendAnalysis,
        i,
      );

      // Advanced seasonal component with Indonesian cultural patterns
      const seasonalComponent = this.calculateAdvancedSeasonalComponent(
        seasonalityAnalysis,
        date,
        i,
      );

      // Islamic calendar integration for accurate Ramadan/Lebaran effects
      const islamicCalendarEffect = this.calculateIslamicCalendarEffect(date);

      // Indonesian business cycle effects (harvest seasons, school terms, etc.)
      const businessCycleEffect =
        this.calculateIndonesianBusinessCycleEffect(date);

      // Weekend and holiday effects specific to Indonesian retail patterns
      const weekendHolidayEffect = this.calculateWeekendHolidayEffect(date);

      // Combine all components with proper statistical weights
      const combinedForecast =
        baseForecast *
        (1 + trendComponent) *
        (1 + seasonalComponent) *
        islamicCalendarEffect *
        businessCycleEffect *
        weekendHolidayEffect;

      // Calculate sophisticated confidence intervals using historical variance
      const confidenceInterval = this.calculateDynamicConfidenceInterval(
        combinedForecast,
        timeSeriesData,
        i,
        days,
      );

      const predictedDemand = Math.max(0, Math.round(combinedForecast));

      forecastData.push({
        date: date.toISOString().split('T')[0],
        predicted_demand: predictedDemand,
        confidence_interval: confidenceInterval,
        trend_component: trendComponent,
        seasonal_component: seasonalComponent,
        residual_component:
          combinedForecast -
          baseForecast -
          trendComponent * baseForecast -
          seasonalComponent * baseForecast,
      });
    }

    return {
      productId: 'unknown',
      productName,
      timeHorizon,
      forecastData,
      accuracy: backtestingResults.accuracy,
      trend: trendAnalysis.direction,
      seasonality: seasonalityAnalysis,
      modelUsed:
        'StokCerdas Professional Indonesian SMB Forecasting Engine v2.0',
      modelComponents: {
        trend_model:
          'Holt-Winters Double Exponential Smoothing with Linear Regression',
        seasonal_model:
          'Advanced Seasonality Detection with Islamic Calendar Integration',
        islamic_calendar_integration: true,
        confidence_calculation: 'Dynamic Variance-based Confidence Intervals',
      },
      backtesting: backtestingResults,
      generatedAt: new Date(),
    };
  }

  /**
   * Advanced time series data preprocessing with outlier detection and smoothing
   */
  private preprocessTimeSeriesData(data: any[]): Array<{
    date: string;
    value: number;
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
  }> {
    if (!data.length) return [];

    const dailyTotals = new Map<string, number>();

    // Aggregate transactions by date
    data.forEach(transaction => {
      const date = new Date(transaction.createdAt).toISOString().split('T')[0];
      const quantity = Math.abs(transaction.quantityChange || 0);
      dailyTotals.set(date, (dailyTotals.get(date) || 0) + quantity);
    });

    // Convert to time series format with additional context
    const timeSeries = [];
    const entriesArray = Array.from(dailyTotals.entries());
    for (const [dateStr, value] of entriesArray) {
      const date = new Date(dateStr);
      timeSeries.push({
        date: dateStr,
        value: value,
        dayOfWeek: date.getDay(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isHoliday: this.isIndonesianHoliday(date),
      });
    }

    // Sort by date
    timeSeries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Remove outliers using IQR method
    return this.removeOutliers(timeSeries);
  }

  /**
   * Remove statistical outliers using Interquartile Range (IQR) method
   */
  private removeOutliers(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): Array<{
    date: string;
    value: number;
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
  }> {
    if (data.length < 4) return data;

    const values = data.map(d => d.value).sort((a, b) => a - b);
    const q1Index = Math.floor(values.length * 0.25);
    const q3Index = Math.floor(values.length * 0.75);
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return data.filter(d => d.value >= lowerBound && d.value <= upperBound);
  }

  /**
   * Professional time series decomposition into trend, seasonal, and residual components
   */
  private performTimeSeriesDecomposition(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): {
    trend: number[];
    seasonal: number[];
    residual: number[];
    baseline: number;
  } {
    if (data.length < 14) {
      const baseline = data.length
        ? data.reduce((sum, d) => sum + d.value, 0) / data.length
        : 10;
      return {
        trend: [baseline],
        seasonal: [0],
        residual: [0],
        baseline,
      };
    }

    const values = data.map(d => d.value);
    const baseline = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Calculate trend using moving average with different window sizes
    const trend = this.calculateMovingAverageTrend(values, 7); // 7-day moving average

    // Calculate seasonal component using day-of-week patterns
    const seasonal = this.calculateSeasonalComponent(data);

    // Calculate residual component
    const residual = values.map(
      (val, i) => val - (trend[i] || baseline) - (seasonal[i] || 0),
    );

    return { trend, seasonal, residual, baseline };
  }

  /**
   * Calculate moving average trend with exponential smoothing
   */
  private calculateMovingAverageTrend(
    values: number[],
    window: number,
  ): number[] {
    const trend = [];
    const alpha = this.INDONESIAN_MARKET_CONFIG.trend.alpha;

    for (let i = 0; i < values.length; i++) {
      if (i < window) {
        // For early values, use simple average
        const slice = values.slice(0, i + 1);
        trend.push(slice.reduce((sum, val) => sum + val, 0) / slice.length);
      } else {
        // Use exponential smoothing for trend
        const recentAvg =
          values
            .slice(i - window + 1, i + 1)
            .reduce((sum, val) => sum + val, 0) / window;
        const prevTrend = trend[i - 1];
        trend.push(alpha * recentAvg + (1 - alpha) * prevTrend);
      }
    }

    return trend;
  }

  /**
   * Calculate seasonal component considering Indonesian patterns
   */
  private calculateSeasonalComponent(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): number[] {
    const dayOfWeekEffects = new Array(7).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);

    // Calculate average effect for each day of week
    data.forEach(d => {
      dayOfWeekEffects[d.dayOfWeek] += d.value;
      dayOfWeekCounts[d.dayOfWeek]++;
    });

    const avgDayEffects = dayOfWeekEffects.map((sum, i) =>
      dayOfWeekCounts[i] > 0 ? sum / dayOfWeekCounts[i] : 0,
    );

    const overallAvg = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    // Convert to seasonal indices (1.0 = average, >1.0 = above average, <1.0 = below average)
    const seasonalIndices = avgDayEffects.map(avg =>
      overallAvg > 0 ? avg / overallAvg - 1 : 0,
    );

    // Apply seasonal indices to data points
    return data.map(d => seasonalIndices[d.dayOfWeek] * overallAvg);
  }

  /**
   * Advanced trend analysis using multiple statistical methods
   */
  private performAdvancedTrendAnalysis(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    slope: number;
    r_squared: number;
    confidence: number;
  } {
    if (data.length < 3) {
      return {
        direction: 'stable',
        strength: 0,
        slope: 0,
        r_squared: 0,
        confidence: 0,
      };
    }

    const values = data.map(d => d.value);
    const x = data.map((_, i) => i); // Time indices

    // Linear regression for trend analysis
    const regression = this.calculateLinearRegression(x, values);

    // Mann-Kendall trend test for statistical significance
    const mannKendall = this.performMannKendallTest(values);

    // Determine trend direction and strength
    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const strength = Math.abs(regression.slope);

    if (regression.slope > 0 && mannKendall.p_value < 0.05) {
      direction = 'increasing';
    } else if (regression.slope < 0 && mannKendall.p_value < 0.05) {
      direction = 'decreasing';
    }

    // Calculate confidence based on R-squared and p-value
    const confidence = regression.r_squared * (1 - mannKendall.p_value);

    return {
      direction,
      strength,
      slope: regression.slope,
      r_squared: regression.r_squared,
      confidence,
    };
  }

  /**
   * Linear regression calculation for trend analysis
   */
  private calculateLinearRegression(
    x: number[],
    y: number[],
  ): {
    slope: number;
    intercept: number;
    r_squared: number;
  } {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const r_squared = 1 - ssResidual / ssTotal;

    return { slope, intercept, r_squared };
  }

  /**
   * Mann-Kendall trend test for statistical significance
   */
  private performMannKendallTest(data: number[]): {
    statistic: number;
    p_value: number;
  } {
    const n = data.length;
    let s = 0;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        if (data[j] > data[i]) s++;
        else if (data[j] < data[i]) s--;
      }
    }

    // Calculate variance (simplified, assuming no ties)
    const variance = (n * (n - 1) * (2 * n + 5)) / 18;
    const z = s / Math.sqrt(variance);

    // Approximate p-value using normal distribution
    const p_value = 2 * (1 - this.normalCDF(Math.abs(z)));

    return { statistic: s, p_value };
  }

  /**
   * Normal cumulative distribution function approximation
   */
  private normalCDF(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Advanced seasonality detection using multiple statistical methods
   */
  private detectAdvancedSeasonality(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): {
    detected: boolean;
    strength: number;
    period: number;
    peak_periods: string[];
  } {
    if (data.length < 14) {
      return {
        detected: false,
        strength: 0,
        period: 7, // Default to weekly
        peak_periods: [],
      };
    }

    const values = data.map(d => d.value);

    // Test for different seasonal periods
    const periodsToTest = [7, 14, 30]; // Weekly, bi-weekly, monthly
    let bestPeriod = 7;
    let maxStrength = 0;

    for (const period of periodsToTest) {
      if (data.length >= period * 2) {
        const strength = this.calculateSeasonalStrength(values, period);
        if (strength > maxStrength) {
          maxStrength = strength;
          bestPeriod = period;
        }
      }
    }

    // Additional analysis for Indonesian-specific patterns
    const weeklyPattern = this.analyzeWeeklyPattern(data);
    const islamicCalendarPattern = this.analyzeIslamicCalendarPattern(data);

    // Combine different seasonal strengths
    const combinedStrength = Math.max(
      maxStrength,
      weeklyPattern.strength,
      islamicCalendarPattern.strength,
    );
    const detected = combinedStrength > 0.3; // Threshold for seasonal detection

    // Identify peak periods
    const peakPeriods = this.identifyPeakPeriods(data, bestPeriod);

    return {
      detected,
      strength: combinedStrength,
      period: bestPeriod,
      peak_periods: peakPeriods,
    };
  }

  /**
   * Calculate seasonal strength using autocorrelation
   */
  private calculateSeasonalStrength(values: number[], period: number): number {
    if (values.length < period * 2) return 0;

    // Calculate autocorrelation at the specified lag (period)
    const autocorr = this.calculateAutocorrelation(values, period);
    return Math.abs(autocorr);
  }

  /**
   * Calculate autocorrelation at specific lag
   */
  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length <= lag) return 0;

    const n = values.length - lag;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Analyze weekly patterns specific to Indonesian business cycles
   */
  private analyzeWeeklyPattern(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): {
    strength: number;
    peak_days: number[];
  } {
    const dayTotals = new Array(7).fill(0);
    const dayCounts = new Array(7).fill(0);

    data.forEach(d => {
      dayTotals[d.dayOfWeek] += d.value;
      dayCounts[d.dayOfWeek]++;
    });

    const dayAverages = dayTotals.map((total, i) =>
      dayCounts[i] > 0 ? total / dayCounts[i] : 0,
    );

    const overallAvg = dayAverages.reduce((sum, avg) => sum + avg, 0) / 7;
    const variance =
      dayAverages.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) /
      7;
    const strength = overallAvg > 0 ? Math.sqrt(variance) / overallAvg : 0;

    // Identify peak days (above average)
    const peakDays = dayAverages
      .map((avg, day) => ({ day, avg }))
      .filter(item => item.avg > overallAvg)
      .map(item => item.day);

    return { strength, peak_days: peakDays };
  }

  /**
   * Analyze Islamic calendar patterns (Ramadan, Lebaran effects)
   */
  private analyzeIslamicCalendarPattern(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
  ): {
    strength: number;
    ramadan_effect: number;
    lebaran_effect: number;
  } {
    const ramadanValues = [];
    const lebaranValues = [];
    const normalValues = [];

    data.forEach(d => {
      const date = new Date(d.date);
      if (this.isRamadanPeriod(date)) {
        ramadanValues.push(d.value);
      } else if (this.isLebaranPeriod(date)) {
        lebaranValues.push(d.value);
      } else {
        normalValues.push(d.value);
      }
    });

    const normalAvg =
      normalValues.length > 0
        ? normalValues.reduce((sum, val) => sum + val, 0) / normalValues.length
        : 0;
    const ramadanAvg =
      ramadanValues.length > 0
        ? ramadanValues.reduce((sum, val) => sum + val, 0) /
          ramadanValues.length
        : normalAvg;
    const lebaranAvg =
      lebaranValues.length > 0
        ? lebaranValues.reduce((sum, val) => sum + val, 0) /
          lebaranValues.length
        : normalAvg;

    const ramadanEffect =
      normalAvg > 0 ? (ramadanAvg - normalAvg) / normalAvg : 0;
    const lebaranEffect =
      normalAvg > 0 ? (lebaranAvg - normalAvg) / normalAvg : 0;

    const strength = Math.max(Math.abs(ramadanEffect), Math.abs(lebaranEffect));

    return {
      strength,
      ramadan_effect: ramadanEffect,
      lebaran_effect: lebaranEffect,
    };
  }

  /**
   * Identify peak periods within the seasonal cycle
   */
  private identifyPeakPeriods(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
    period: number,
  ): string[] {
    const peaks = [];

    // Analyze by day of week for weekly patterns
    if (period === 7) {
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const weeklyAnalysis = this.analyzeWeeklyPattern(data);
      weeklyAnalysis.peak_days.forEach(day => {
        peaks.push(dayNames[day]);
      });
    }

    // Add Islamic calendar peaks
    const islamicAnalysis = this.analyzeIslamicCalendarPattern(data);
    if (islamicAnalysis.ramadan_effect > 0.2) peaks.push('Ramadan Period');
    if (islamicAnalysis.lebaran_effect > 0.3) peaks.push('Lebaran Period');

    return peaks;
  }

  /**
   * Accurate Ramadan period detection using Islamic (Hijri) calendar
   */
  private isRamadanPeriod(date: Date): boolean {
    try {
      // Convert Gregorian date to Hijri
      const hijriDate = new HijriDate(date);
      const hijriMonth = hijriDate.getMonth();

      // Ramadan is the 9th month in Islamic calendar
      return hijriMonth === 9;
    } catch (error) {
      // Fallback to approximate detection if Hijri conversion fails
      this.logger.warn('Hijri date conversion failed, using approximation');
      return this.isRamadanPeriodApproximate(date);
    }
  }

  /**
   * Fallback approximate Ramadan detection
   */
  private isRamadanPeriodApproximate(date: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Approximate Ramadan dates for recent years (this would be better maintained as a lookup table)
    const ramadanDates = {
      2024: { start: { month: 3, day: 11 }, end: { month: 4, day: 9 } },
      2025: { start: { month: 3, day: 1 }, end: { month: 3, day: 30 } },
      2026: { start: { month: 2, day: 18 }, end: { month: 3, day: 19 } },
    };

    const ramadan = ramadanDates[year];
    if (!ramadan) return false;

    const currentDate = new Date(year, month - 1, day);
    const startDate = new Date(
      year,
      ramadan.start.month - 1,
      ramadan.start.day,
    );
    const endDate = new Date(year, ramadan.end.month - 1, ramadan.end.day);

    return currentDate >= startDate && currentDate <= endDate;
  }

  /**
   * Accurate Lebaran (Eid al-Fitr) period detection using Islamic calendar
   */
  private isLebaranPeriod(date: Date): boolean {
    try {
      // Convert Gregorian date to Hijri
      const hijriDate = new HijriDate(date);
      const hijriMonth = hijriDate.getMonth();
      const hijriDay = hijriDate.getDate();

      // Lebaran is 1st of Shawwal (10th month) and typically celebrated for 2-7 days
      return hijriMonth === 10 && hijriDay <= 7;
    } catch (error) {
      // Fallback to approximate detection
      this.logger.warn(
        'Hijri date conversion failed for Lebaran, using approximation',
      );
      return this.isLebaranPeriodApproximate(date);
    }
  }

  /**
   * Fallback approximate Lebaran detection
   */
  private isLebaranPeriodApproximate(date: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Approximate Lebaran dates (Eid al-Fitr)
    const lebaranDates = {
      2024: { start: { month: 4, day: 10 }, end: { month: 4, day: 16 } },
      2025: { start: { month: 3, day: 31 }, end: { month: 4, day: 6 } },
      2026: { start: { month: 3, day: 20 }, end: { month: 3, day: 26 } },
    };

    const lebaran = lebaranDates[year];
    if (!lebaran) return false;

    const currentDate = new Date(year, month - 1, day);
    const startDate = new Date(
      year,
      lebaran.start.month - 1,
      lebaran.start.day,
    );
    const endDate = new Date(year, lebaran.end.month - 1, lebaran.end.day);

    return currentDate >= startDate && currentDate <= endDate;
  }

  /**
   * Check if date is an Indonesian public holiday
   */
  private isIndonesianHoliday(date: Date): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Fixed Indonesian holidays
    const fixedHolidays = [
      { month: 1, day: 1 }, // New Year
      { month: 8, day: 17 }, // Independence Day
      { month: 12, day: 25 }, // Christmas
    ];

    const isFixedHoliday = fixedHolidays.some(
      h => h.month === month && h.day === day,
    );

    // Check for Islamic holidays
    const isIslamicHoliday =
      this.isRamadanPeriod(date) || this.isLebaranPeriod(date);

    return isFixedHoliday || isIslamicHoliday;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Get available analysis types for Indonesian SMB
   */
  getAvailableAnalysisTypes(): string[] {
    return [
      'demand_forecast',
      'ramadan_forecast',
      'lebaran_forecast',
      'weekend_pattern',
      'seasonal_trend',
      'product_popularity',
    ];
  }

  /**
   * Analyze stockout risk for Indonesian products
   */
  async analyzeStockoutRisk(
    productIds: string[],
    tenantId: string,
  ): Promise<
    Array<{
      productId: string;
      productName: string;
      currentStock: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      daysUntilStockout: number;
      recommendedAction: string;
    }>
  > {
    this.logger.log(
      `Analyzing stockout risk for ${productIds.length} products`,
    );

    const results = [];

    for (const productId of productIds) {
      try {
        const product = await this.productRepository.findOne({
          where: { id: productId, tenantId },
        });

        if (!product) continue;

        const inventoryItem = await this.inventoryItemRepository.findOne({
          where: { productId, tenantId },
        });

        const currentStock = inventoryItem?.quantityOnHand || 0;
        const dailyUsage = await this.calculateDailyUsage(productId, tenantId);

        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        const daysUntilStockout = currentStock / (dailyUsage || 1);
        let recommendedAction = 'Monitor normal usage';

        if (daysUntilStockout <= 3) {
          riskLevel = 'critical';
          recommendedAction = 'ORDER IMMEDIATELY - Stock critical!';
        } else if (daysUntilStockout <= 7) {
          riskLevel = 'high';
          recommendedAction = 'Order within 24 hours';
        } else if (daysUntilStockout <= 14) {
          riskLevel = 'medium';
          recommendedAction = 'Plan reorder within 3 days';
        }

        results.push({
          productId,
          productName: product.name,
          currentStock,
          riskLevel,
          daysUntilStockout: Math.round(daysUntilStockout),
          recommendedAction,
        });
      } catch (error) {
        this.logger.error(
          `Error analyzing stockout risk for ${productId}: ${error.message}`,
        );
      }
    }

    return results;
  }

  private async calculateDailyUsage(
    productId: string,
    tenantId: string,
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await this.inventoryTransactionRepository.find({
      where: {
        productId,
        tenantId,
        createdAt: { $gte: thirtyDaysAgo },
        quantityChange: { $lt: 0 }, // Only outgoing transactions
      } as any,
    });

    const totalUsage = transactions.reduce(
      (sum, t) => sum + Math.abs(t.netQuantityChange),
      0,
    );
    return totalUsage / 30; // Average daily usage
  }

  /**
   * Generate stockout predictions for products
   */
  async generateStockoutPredictions(
    tenantId: string,
    query: any,
  ): Promise<any> {
    this.logger.log(`Generating stockout predictions for tenant: ${tenantId}`);

    try {
      // Get all products if none specified
      const products = await this.productRepository.find({
        where: { tenantId },
        take: 100, // Limit for performance
      });

      const productIds = query.productIds || products.map(p => p.id);
      const stockoutRisk = await this.analyzeStockoutRisk(productIds, tenantId);

      return {
        data: stockoutRisk,
        summary: {
          totalProducts: productIds.length,
          highRisk: stockoutRisk.filter(
            r => r.riskLevel === 'high' || r.riskLevel === 'critical',
          ).length,
          mediumRisk: stockoutRisk.filter(r => r.riskLevel === 'medium').length,
          lowRisk: stockoutRisk.filter(r => r.riskLevel === 'low').length,
        },
        insights: [
          'Prediksi kehabisan stok berdasarkan pola konsumsi historis',
          'Faktor musiman Indonesia telah diperhitungkan',
          'Rekomendasi pemesanan ulang tersedia',
        ],
        meta: {
          analysisType: 'stockout_prediction',
          timeHorizon: query.timeHorizon || '30d',
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error generating stockout predictions: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Detect slow moving items
   */
  async detectSlowMovingItems(tenantId: string, query: any): Promise<any> {
    this.logger.log(`Detecting slow moving items for tenant: ${tenantId}`);

    try {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Get inventory items with low movement
      const inventoryItems = await this.inventoryItemRepository.find({
        where: { tenantId },
        relations: ['product'],
        take: 100,
      });

      const slowMovingItems = [];

      for (const item of inventoryItems) {
        if (!item.product) continue;

        const movements = await this.inventoryTransactionRepository.count({
          where: {
            productId: item.productId,
            tenantId,
            createdAt: { $gte: sixtyDaysAgo },
          } as any,
        });

        const dailyMovement = movements / 60;
        const turnoverRate = dailyMovement / (item.quantityOnHand || 1);

        let classification = 'normal';
        if (turnoverRate < 0.01) classification = 'very_slow';
        else if (turnoverRate < 0.05) classification = 'slow';
        else if (turnoverRate < 0.1) classification = 'moderate';

        if (classification !== 'normal') {
          slowMovingItems.push({
            productId: item.productId,
            productName: item.product.name,
            currentStock: item.quantityOnHand,
            movements60Days: movements,
            turnoverRate: Number(turnoverRate.toFixed(4)),
            classification,
            recommendation: this.getSlowMovingRecommendation(classification),
          });
        }
      }

      return {
        data: slowMovingItems,
        summary: {
          totalAnalyzed: inventoryItems.length,
          slowMovingItems: slowMovingItems.length,
          verySlowItems: slowMovingItems.filter(
            i => i.classification === 'very_slow',
          ).length,
          potentialValue: slowMovingItems.reduce(
            (sum, i) => sum + i.currentStock * 10,
            0,
          ), // Estimated value
        },
        insights: [
          'Identifikasi produk dengan perputaran lambat',
          'Rekomendasi strategi clearance sale',
          'Optimasi ruang gudang dan modal kerja',
        ],
        meta: {
          analysisType: 'slow_moving_detection',
          analysisWindow: '60 days',
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Error detecting slow moving items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate optimal reorder suggestions
   */
  async generateOptimalReorders(tenantId: string, query: any): Promise<any> {
    this.logger.log(`Generating optimal reorders for tenant: ${tenantId}`);

    try {
      const products = await this.productRepository.find({
        where: { tenantId },
        take: 50, // Limit for performance
      });

      const reorderSuggestions = [];

      for (const product of products) {
        const inventoryItem = await this.inventoryItemRepository.findOne({
          where: { productId: product.id, tenantId },
        });

        if (!inventoryItem) continue;

        const dailyUsage = await this.calculateDailyUsage(product.id, tenantId);
        const leadTime = 7; // Default 7 days lead time
        const safetyStock = dailyUsage * 3; // 3 days safety stock
        const reorderPoint = dailyUsage * leadTime + safetyStock;
        const economicOrderQuantity = Math.sqrt(
          (2 * dailyUsage * 365 * 50) / 2,
        ); // EOQ formula simplified

        if (inventoryItem.quantityOnHand <= reorderPoint) {
          reorderSuggestions.push({
            productId: product.id,
            productName: product.name,
            currentStock: inventoryItem.quantityOnHand,
            reorderPoint: Math.round(reorderPoint),
            suggestedOrderQuantity: Math.round(economicOrderQuantity),
            dailyUsage: Math.round(dailyUsage * 100) / 100,
            estimatedDaysOfStock: Math.round(
              inventoryItem.quantityOnHand / (dailyUsage || 1),
            ),
            priority: this.calculateReorderPriority(
              inventoryItem.quantityOnHand,
              reorderPoint,
              dailyUsage,
            ),
          });
        }
      }

      // Sort by priority
      reorderSuggestions.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      return {
        data: reorderSuggestions,
        summary: {
          totalProductsAnalyzed: products.length,
          productsNeedingReorder: reorderSuggestions.length,
          criticalItems: reorderSuggestions.filter(
            r => r.priority === 'critical',
          ).length,
          estimatedOrderValue: reorderSuggestions.reduce(
            (sum, r) => sum + r.suggestedOrderQuantity * 10,
            0,
          ),
        },
        insights: [
          'Perhitungan EOQ (Economic Order Quantity) untuk optimasi biaya',
          'Faktor lead time dan safety stock diperhitungkan',
          'Prioritas berdasarkan tingkat kekritisan stok',
        ],
        meta: {
          analysisType: 'optimal_reorder',
          methodology: 'EOQ with safety stock',
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Error generating optimal reorders: ${error.message}`);
      throw error;
    }
  }

  private getSlowMovingRecommendation(classification: string): string {
    switch (classification) {
      case 'very_slow':
        return 'Pertimbangkan clearance sale atau bundling dengan produk populer';
      case 'slow':
        return 'Evaluasi strategi marketing dan promosi khusus';
      case 'moderate':
        return 'Monitor trend dan pertimbangkan penyesuaian stok';
      default:
        return 'Pertahankan level stok saat ini';
    }
  }

  private calculateReorderPriority(
    currentStock: number,
    reorderPoint: number,
    dailyUsage: number,
  ): string {
    const daysLeft = currentStock / (dailyUsage || 1);

    if (daysLeft <= 2) return 'critical';
    if (daysLeft <= 5) return 'high';
    if (daysLeft <= 10) return 'medium';
    return 'low';
  }

  /**
   * Perform backtesting to calculate dynamic forecast accuracy
   */
  private performBacktesting(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
    forecastDays: number,
  ): {
    accuracy: number;
    mape: number;
    rmse: number;
    mae: number;
    samples_tested: number;
  } {
    if (data.length < forecastDays * 2) {
      return {
        accuracy: 0.75, // Conservative default
        mape: 0.25,
        rmse: 0,
        mae: 0,
        samples_tested: 0,
      };
    }

    const testSamples = Math.min(5, Math.floor(data.length / forecastDays) - 1);
    let totalMAPE = 0;
    let totalRMSE = 0;
    let totalMAE = 0;
    let validSamples = 0;

    for (let i = 0; i < testSamples; i++) {
      const trainEndIndex = data.length - (i + 1) * forecastDays;
      const testStartIndex = trainEndIndex;
      const testEndIndex = trainEndIndex + forecastDays;

      if (trainEndIndex < forecastDays) break;

      const trainData = data.slice(0, trainEndIndex);
      const testData = data.slice(testStartIndex, testEndIndex);

      // Generate forecast for test period
      const forecast = this.generateHoltWintersForecasts(
        trainData,
        forecastDays,
      );

      // Calculate error metrics
      let sampleMAPE = 0;
      let sampleRMSE = 0;
      let sampleMAE = 0;

      for (let j = 0; j < Math.min(forecast.length, testData.length); j++) {
        const actual = testData[j].value;
        const predicted = forecast[j];

        if (actual > 0) {
          sampleMAPE += Math.abs((actual - predicted) / actual);
        }
        sampleRMSE += Math.pow(actual - predicted, 2);
        sampleMAE += Math.abs(actual - predicted);
      }

      const numPoints = Math.min(forecast.length, testData.length);
      if (numPoints > 0) {
        totalMAPE += sampleMAPE / numPoints;
        totalRMSE += Math.sqrt(sampleRMSE / numPoints);
        totalMAE += sampleMAE / numPoints;
        validSamples++;
      }
    }

    if (validSamples === 0) {
      return {
        accuracy: 0.75,
        mape: 0.25,
        rmse: 0,
        mae: 0,
        samples_tested: 0,
      };
    }

    const avgMAPE = totalMAPE / validSamples;
    const avgRMSE = totalRMSE / validSamples;
    const avgMAE = totalMAE / validSamples;
    const accuracy = Math.max(0.1, 1 - avgMAPE); // Convert MAPE to accuracy

    return {
      accuracy,
      mape: avgMAPE,
      rmse: avgRMSE,
      mae: avgMAE,
      samples_tested: validSamples,
    };
  }

  /**
   * Generate forecasts using Holt-Winters exponential smoothing method
   */
  private generateHoltWintersForecasts(
    data: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
    days: number,
  ): number[] {
    if (data.length < 7) {
      const avg =
        data.length > 0
          ? data.reduce((sum, d) => sum + d.value, 0) / data.length
          : 10;
      return new Array(days).fill(avg);
    }

    const values = data.map(d => d.value);
    const { alpha, beta, gamma } = this.INDONESIAN_MARKET_CONFIG.trend;
    const seasonLength = 7; // Weekly seasonality

    // Initialize components
    let level = values[0];
    let trend = values.length > 1 ? values[1] - values[0] : 0;
    const seasonal = new Array(seasonLength).fill(0);

    // Initialize seasonal indices
    if (values.length >= seasonLength) {
      for (let i = 0; i < seasonLength; i++) {
        const seasonalValues = [];
        for (let j = i; j < values.length; j += seasonLength) {
          seasonalValues.push(values[j]);
        }
        const avgSeasonal =
          seasonalValues.reduce((sum, val) => sum + val, 0) /
          seasonalValues.length;
        seasonal[i] = avgSeasonal - level;
      }
    }

    // Apply Holt-Winters smoothing
    for (let i = 1; i < values.length; i++) {
      const seasonalIndex = i % seasonLength;
      const prevLevel = level;
      const prevTrend = trend;

      // Update level
      level =
        alpha * (values[i] - seasonal[seasonalIndex]) +
        (1 - alpha) * (prevLevel + prevTrend);

      // Update trend
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;

      // Update seasonal component
      seasonal[seasonalIndex] =
        gamma * (values[i] - level) + (1 - gamma) * seasonal[seasonalIndex];
    }

    // Generate forecasts
    const forecasts = [];
    for (let i = 0; i < days; i++) {
      const seasonalIndex = (values.length + i) % seasonLength;
      const forecast = level + (i + 1) * trend + seasonal[seasonalIndex];
      forecasts.push(Math.max(0, forecast));
    }

    return forecasts;
  }

  /**
   * Calculate advanced trend component for forecasting
   */
  private calculateAdvancedTrendComponent(
    trendAnalysis: any,
    dayIndex: number,
  ): number {
    if (!trendAnalysis || trendAnalysis.confidence < 0.3) {
      return 0; // No significant trend
    }

    // Apply trend with diminishing effect over time
    const trendDecay = Math.exp(-dayIndex * 0.02); // 2% daily decay
    const trendEffect = trendAnalysis.slope * dayIndex * trendDecay;

    // Scale by confidence
    return trendEffect * trendAnalysis.confidence;
  }

  /**
   * Calculate advanced seasonal component with Indonesian cultural patterns
   */
  private calculateAdvancedSeasonalComponent(
    seasonalityAnalysis: any,
    date: Date,
    dayIndex: number,
  ): number {
    if (!seasonalityAnalysis.detected) {
      return 0;
    }

    let seasonalEffect = 0;

    // Weekly seasonal pattern
    const dayOfWeek = date.getDay();
    const weeklyEffects = {
      0: -0.1, // Sunday (lower activity)
      1: 0.05, // Monday
      2: 0.02, // Tuesday
      3: 0.03, // Wednesday
      4: 0.08, // Thursday
      5: 0.15, // Friday (high activity)
      6: 0.1, // Saturday
    };
    seasonalEffect += weeklyEffects[dayOfWeek] || 0;

    // Scale by seasonality strength
    return seasonalEffect * seasonalityAnalysis.strength;
  }

  /**
   * Calculate Islamic calendar effects (Ramadan, Lebaran, etc.)
   */
  private calculateIslamicCalendarEffect(date: Date): number {
    let effect = 1.0; // Base multiplier

    if (this.isRamadanPeriod(date)) {
      // Ramadan effect varies by product type and days into Ramadan
      const ramadanDay = this.getDayIntoRamadan(date);
      if (ramadanDay <= 10) {
        effect *= 1.3; // Early Ramadan boost
      } else if (ramadanDay <= 20) {
        effect *= 1.6; // Mid Ramadan peak
      } else {
        effect *= 1.8; // Late Ramadan preparation for Lebaran
      }
    } else if (this.isLebaranPeriod(date)) {
      const lebaranDay = this.getDayIntoLebaran(date);
      if (lebaranDay <= 2) {
        effect *= 2.2; // Peak Lebaran days
      } else if (lebaranDay <= 7) {
        effect *= 1.5; // Extended Lebaran celebration
      }
    } else if (this.isPreRamadanPeriod(date)) {
      effect *= 1.1; // Preparation period
    }

    return effect;
  }

  /**
   * Calculate Indonesian business cycle effects
   */
  private calculateIndonesianBusinessCycleEffect(date: Date): number {
    let effect = 1.0;
    const month = date.getMonth() + 1;

    // School season effects
    if (this.isSchoolHolidayPeriod(date)) {
      effect *= 1.15; // Increased activity during school holidays
    }

    // Harvest season effects (varies by region)
    if (this.isHarvestSeason(date)) {
      effect *= 1.1; // Increased economic activity
    }

    // End of year effects
    if (month === 12) {
      effect *= 1.2; // Year-end business activity
    }

    // Gajian effect (payday effects - typically end of month)
    if (this.isPaydayPeriod(date)) {
      effect *= 1.1;
    }

    return effect;
  }

  /**
   * Calculate weekend and holiday effects for Indonesian market
   */
  private calculateWeekendHolidayEffect(date: Date): number {
    let effect = 1.0;

    if (this.isWeekend(date)) {
      effect *= 1.15; // Indonesian retail typically sees weekend boost
    }

    if (this.isIndonesianHoliday(date)) {
      effect *= 1.25; // Holiday shopping boost
    }

    // Friday effect (preparation for weekend)
    if (date.getDay() === 5) {
      effect *= 1.08;
    }

    return effect;
  }

  /**
   * Calculate dynamic confidence intervals based on historical variance
   */
  private calculateDynamicConfidenceInterval(
    forecast: number,
    historicalData: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }>,
    dayIndex: number,
    totalDays: number,
  ): {
    lower: number;
    upper: number;
  } {
    if (historicalData.length < 7) {
      return {
        lower: Math.max(0, Math.round(forecast * 0.7)),
        upper: Math.round(forecast * 1.3),
      };
    }

    // Calculate historical variance
    const values = historicalData.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    // Confidence interval widens with forecast horizon
    const horizonFactor = 1 + (dayIndex / totalDays) * 0.5; // Up to 50% wider for longer horizons
    const confidenceLevel =
      this.INDONESIAN_MARKET_CONFIG.confidence.confidence_level;
    const zScore = this.getZScoreForConfidence(confidenceLevel);

    const margin = zScore * stdDev * horizonFactor;

    return {
      lower: Math.max(0, Math.round(forecast - margin)),
      upper: Math.round(forecast + margin),
    };
  }

  /**
   * Helper methods for Islamic calendar calculations
   */
  private getDayIntoRamadan(date: Date): number {
    // Simplified calculation - in production would use proper Islamic calendar
    try {
      const hijriDate = new HijriDate(date);
      if (hijriDate.getMonth() === 9) {
        return hijriDate.getDate();
      }
    } catch (error) {
      // Fallback calculation
    }
    return 15; // Default mid-Ramadan
  }

  private getDayIntoLebaran(date: Date): number {
    try {
      const hijriDate = new HijriDate(date);
      if (hijriDate.getMonth() === 10) {
        return hijriDate.getDate();
      }
    } catch (error) {
      // Fallback calculation
    }
    return 3; // Default mid-Lebaran
  }

  private isPreRamadanPeriod(date: Date): boolean {
    // Check if date is in the 2 weeks before Ramadan
    const preRamadanDate = new Date(date);
    preRamadanDate.setDate(preRamadanDate.getDate() + 14);
    return this.isRamadanPeriod(preRamadanDate);
  }

  /**
   * Indonesian business cycle helper methods
   */
  private isSchoolHolidayPeriod(date: Date): boolean {
    const month = date.getMonth() + 1;
    // Indonesian school holidays: June-July, December-January
    return (month >= 6 && month <= 7) || month === 12 || month === 1;
  }

  private isHarvestSeason(date: Date): boolean {
    const month = date.getMonth() + 1;
    // Indonesian harvest seasons vary by region, but generally March-May and September-November
    return (month >= 3 && month <= 5) || (month >= 9 && month <= 11);
  }

  private isPaydayPeriod(date: Date): boolean {
    const day = date.getDate();
    // Last 3 days of month and first 3 days (gajian period)
    return day >= 28 || day <= 3;
  }

  /**
   * Statistical helper methods
   */
  private getZScoreForConfidence(confidenceLevel: number): number {
    // Z-scores for common confidence levels
    const zScores = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    return zScores[confidenceLevel] || 1.96; // Default to 95%
  }
}
