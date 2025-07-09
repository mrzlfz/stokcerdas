import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InventoryTransaction,
  TransactionType,
} from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';
import moment from 'moment-timezone';

// Types untuk data preprocessing
export interface TimeSeriesDataset {
  timeSeries: TimeSeriesPoint[];
  features: EngineeredFeatures[];
  metadata: DatasetMetadata;
  quality: DataQualityReport;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  original_value: number;
  is_interpolated: boolean;
  business_context: BusinessContext;
}

export interface EngineeredFeatures {
  date: string;
  // Temporal features
  day_of_week: number;
  day_of_month: number;
  day_of_year: number;
  week_of_year: number;
  month: number;
  quarter: number;
  is_weekend: boolean;
  is_month_start: boolean;
  is_month_end: boolean;
  is_quarter_start: boolean;
  is_quarter_end: boolean;

  // Statistical features
  lag_1: number;
  lag_7: number;
  lag_30: number;
  rolling_mean_7: number;
  rolling_mean_30: number;
  rolling_std_7: number;
  rolling_std_30: number;
  rolling_min_7: number;
  rolling_max_7: number;

  // Indonesian business features
  is_ramadan: boolean;
  is_lebaran: boolean;
  is_national_holiday: boolean;
  is_payday_period: boolean;
  business_impact_multiplier: number;
  holiday_distance: number; // Days to nearest holiday
  ramadan_day: number; // Day of Ramadan (0 if not Ramadan)

  // Seasonal features
  month_sin: number;
  month_cos: number;
  day_sin: number;
  day_cos: number;
  week_sin: number;
  week_cos: number;

  // Trend features
  linear_trend: number;
  quadratic_trend: number;

  // Business cycle features
  seasonal_component: number;
  trend_component: number;
  remainder_component: number;
}

export interface BusinessContext {
  holiday_info?: IndonesianHolidayInfo;
  is_ramadan: boolean;
  is_lebaran: boolean;
  ramadan_day: number;
  business_impact: number;
  cultural_significance: string;
}

export interface IndonesianHolidayInfo {
  name: string;
  type: 'national' | 'religious' | 'regional';
  impact: 'very_high' | 'high' | 'medium' | 'low';
  description: string;
}

export interface DatasetMetadata {
  product_id: string;
  product_name: string;
  category: string;
  data_points: number;
  date_range: {
    start: string;
    end: string;
    days: number;
  };
  frequency: 'daily' | 'weekly' | 'monthly';
  has_seasonality: boolean;
  seasonality_strength: number;
  trend_strength: number;
  missing_data_percentage: number;
  outlier_count: number;
  data_quality_score: number;
  business_context: {
    ramadan_periods: number;
    lebaran_periods: number;
    holidays_included: number;
    avg_business_impact: number;
  };
}

export interface DataQualityReport {
  overall_score: number; // 0-100
  issues: DataQualityIssue[];
  recommendations: string[];
  is_suitable_for_ml: boolean;
  minimum_additional_data_needed: number; // days
}

export interface DataQualityIssue {
  type:
    | 'missing_data'
    | 'outliers'
    | 'insufficient_data'
    | 'irregular_frequency'
    | 'zero_variance';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affected_dates: string[];
  recommended_action: string;
}

export interface TimeframeOptions {
  days?: number;
  weeks?: number;
  months?: number;
  start_date?: Date;
  end_date?: Date;
  include_future?: boolean;
}

@Injectable()
export class DataPreprocessingService {
  private readonly logger = new Logger(DataPreprocessingService.name);

  // Indonesian holidays database
  private readonly indonesianHolidays: Map<string, IndonesianHolidayInfo> =
    new Map();

  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {
    this.initializeIndonesianHolidays();
  }

  /**
   * Main method untuk prepare time series data for ML models
   */
  async prepareTimeSeriesData(
    productId: string,
    tenantId: string,
    timeframe: TimeframeOptions,
    aggregation: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<TimeSeriesDataset> {
    this.logger.log(
      `Preparing time series data for product ${productId}, aggregation: ${aggregation}`,
    );

    try {
      // 1. Get raw inventory transactions
      const transactions = await this.getInventoryTransactions(
        productId,
        tenantId,
        timeframe,
      );

      // 2. Get product information
      const product = await this.productRepository.findOne({
        where: { id: productId, tenantId },
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // 3. Aggregate transactions by time period
      const aggregatedData = this.aggregateTransactions(
        transactions,
        aggregation,
      );

      // 4. Fill missing dates and handle gaps
      const timeSeriesData = this.fillMissingDates(
        aggregatedData,
        timeframe,
        aggregation,
      );

      // 5. Add Indonesian business context
      const enrichedData = this.addBusinessContext(timeSeriesData);

      // 6. Generate engineered features
      const features = this.generateFeatures(enrichedData);

      // 7. Detect and handle outliers
      const cleanedData = this.handleOutliers(enrichedData);

      // 8. Generate metadata
      const metadata = this.generateMetadata(
        product,
        cleanedData,
        features,
        timeframe,
      );

      // 9. Assess data quality
      const quality = this.assessDataQuality(cleanedData, metadata);

      const dataset: TimeSeriesDataset = {
        timeSeries: cleanedData,
        features,
        metadata,
        quality,
      };

      this.logger.log(
        `Time series preparation completed: ${dataset.timeSeries.length} data points, quality score: ${quality.overall_score}`,
      );

      return dataset;
    } catch (error) {
      this.logger.error(
        `Time series preparation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get inventory transactions within timeframe
   */
  private async getInventoryTransactions(
    productId: string,
    tenantId: string,
    timeframe: TimeframeOptions,
  ): Promise<InventoryTransaction[]> {
    const { startDate, endDate } = this.calculateDateRange(timeframe);

    const transactions = await this.inventoryTransactionRepository.find({
      where: {
        productId,
        tenantId,
        transactionDate: {
          $gte: startDate,
          $lte: endDate,
        } as any,
      },
      order: {
        transactionDate: 'ASC',
      },
    });

    this.logger.log(
      `Retrieved ${transactions.length} transactions for product ${productId}`,
    );

    return transactions;
  }

  /**
   * Aggregate transactions by time period
   */
  private aggregateTransactions(
    transactions: InventoryTransaction[],
    aggregation: 'daily' | 'weekly' | 'monthly',
  ): Array<{ date: string; value: number; transaction_count: number }> {
    const grouped = new Map<string, { value: number; count: number }>();

    transactions.forEach(transaction => {
      let dateKey: string;
      const transactionDate = moment(transaction.transactionDate).tz(
        'Asia/Jakarta',
      );

      switch (aggregation) {
        case 'daily':
          dateKey = transactionDate.format('YYYY-MM-DD');
          break;
        case 'weekly':
          dateKey = transactionDate.startOf('week').format('YYYY-MM-DD');
          break;
        case 'monthly':
          dateKey = transactionDate.startOf('month').format('YYYY-MM-DD');
          break;
      }

      const existing = grouped.get(dateKey) || { value: 0, count: 0 };

      // Aggregate based on transaction type
      let value = 0;
      switch (transaction.type) {
        case TransactionType.SALE:
        case TransactionType.ISSUE:
          value = -Math.abs(transaction.quantity); // Negative for outbound
          break;
        case TransactionType.RECEIPT:
        case TransactionType.ADJUSTMENT_POSITIVE:
          value = Math.abs(transaction.quantity); // Positive for inbound
          break;
        case TransactionType.ADJUSTMENT_NEGATIVE:
          value = -Math.abs(transaction.quantity); // Negative for adjustment
          break;
        case TransactionType.TRANSFER_OUT:
          value = -Math.abs(transaction.quantity);
          break;
        case TransactionType.TRANSFER_IN:
          value = Math.abs(transaction.quantity);
          break;
        default:
          value = 0;
      }

      grouped.set(dateKey, {
        value: existing.value + Math.abs(value), // Use absolute for demand forecasting
        count: existing.count + 1,
      });
    });

    return Array.from(grouped.entries())
      .map(([date, data]) => ({
        date,
        value: data.value,
        transaction_count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Fill missing dates dalam time series
   */
  private fillMissingDates(
    data: Array<{ date: string; value: number; transaction_count: number }>,
    timeframe: TimeframeOptions,
    aggregation: 'daily' | 'weekly' | 'monthly',
  ): TimeSeriesPoint[] {
    if (data.length === 0) {
      return [];
    }

    const { startDate, endDate } = this.calculateDateRange(timeframe);
    const result: TimeSeriesPoint[] = [];
    const dataMap = new Map(data.map(d => [d.date, d]));

    const currentDate = moment(startDate).tz('Asia/Jakarta');
    const endMoment = moment(endDate).tz('Asia/Jakarta');

    while (currentDate.isSameOrBefore(endMoment)) {
      const dateKey = currentDate.format('YYYY-MM-DD');
      const existingData = dataMap.get(dateKey);

      if (existingData) {
        // Use actual data
        result.push({
          date: dateKey,
          value: existingData.value,
          original_value: existingData.value,
          is_interpolated: false,
          business_context: this.getBusinessContext(currentDate.toDate()),
        });
      } else {
        // Interpolate missing data
        const interpolatedValue = this.interpolateMissingValue(result, dateKey);
        result.push({
          date: dateKey,
          value: interpolatedValue,
          original_value: 0,
          is_interpolated: true,
          business_context: this.getBusinessContext(currentDate.toDate()),
        });
      }

      // Move to next period
      switch (aggregation) {
        case 'daily':
          currentDate.add(1, 'day');
          break;
        case 'weekly':
          currentDate.add(1, 'week');
          break;
        case 'monthly':
          currentDate.add(1, 'month');
          break;
      }
    }

    return result;
  }

  /**
   * Add Indonesian business context to time series data
   */
  private addBusinessContext(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
    return data.map(point => ({
      ...point,
      business_context: this.getBusinessContext(new Date(point.date)),
    }));
  }

  /**
   * Generate engineered features untuk ML models
   */
  private generateFeatures(data: TimeSeriesPoint[]): EngineeredFeatures[] {
    return data.map((point, index) => {
      const date = moment(point.date).tz('Asia/Jakarta');
      const dayOfYear = date.dayOfYear();

      // Statistical features (dengan handling untuk early data points)
      const lag1 = index >= 1 ? data[index - 1].value : point.value;
      const lag7 = index >= 7 ? data[index - 7].value : point.value;
      const lag30 = index >= 30 ? data[index - 30].value : point.value;

      // Rolling features
      const rollingWindow7 = data
        .slice(Math.max(0, index - 6), index + 1)
        .map(d => d.value);
      const rollingWindow30 = data
        .slice(Math.max(0, index - 29), index + 1)
        .map(d => d.value);

      const rollingMean7 =
        rollingWindow7.reduce((sum, val) => sum + val, 0) /
        rollingWindow7.length;
      const rollingMean30 =
        rollingWindow30.reduce((sum, val) => sum + val, 0) /
        rollingWindow30.length;

      const rollingStd7 = Math.sqrt(
        rollingWindow7.reduce(
          (sum, val) => sum + Math.pow(val - rollingMean7, 2),
          0,
        ) / rollingWindow7.length,
      );
      const rollingStd30 = Math.sqrt(
        rollingWindow30.reduce(
          (sum, val) => sum + Math.pow(val - rollingMean30, 2),
          0,
        ) / rollingWindow30.length,
      );

      // Seasonal encoding
      const monthSin = Math.sin((2 * Math.PI * date.month()) / 12);
      const monthCos = Math.cos((2 * Math.PI * date.month()) / 12);
      const daySin = Math.sin((2 * Math.PI * dayOfYear) / 365);
      const dayCos = Math.cos((2 * Math.PI * dayOfYear) / 365);
      const weekSin = Math.sin((2 * Math.PI * date.week()) / 52);
      const weekCos = Math.cos((2 * Math.PI * date.week()) / 52);

      return {
        date: point.date,

        // Temporal features
        day_of_week: date.day(),
        day_of_month: date.date(),
        day_of_year: dayOfYear,
        week_of_year: date.week(),
        month: date.month() + 1,
        quarter: date.quarter(),
        is_weekend: date.day() === 0 || date.day() === 6,
        is_month_start: date.date() <= 3,
        is_month_end: date.date() >= date.daysInMonth() - 2,
        is_quarter_start: date.month() % 3 === 0 && date.date() <= 7,
        is_quarter_end:
          date.month() % 3 === 2 && date.date() >= date.daysInMonth() - 7,

        // Statistical features
        lag_1: lag1,
        lag_7: lag7,
        lag_30: lag30,
        rolling_mean_7: rollingMean7,
        rolling_mean_30: rollingMean30,
        rolling_std_7: rollingStd7,
        rolling_std_30: rollingStd30,
        rolling_min_7: Math.min(...rollingWindow7),
        rolling_max_7: Math.max(...rollingWindow7),

        // Indonesian business features
        is_ramadan: point.business_context.is_ramadan,
        is_lebaran: point.business_context.is_lebaran,
        is_national_holiday: !!point.business_context.holiday_info,
        is_payday_period: date.date() >= 25 || date.date() <= 5,
        business_impact_multiplier: point.business_context.business_impact,
        holiday_distance: this.calculateHolidayDistance(date.toDate()),
        ramadan_day: point.business_context.ramadan_day,

        // Seasonal features
        month_sin: monthSin,
        month_cos: monthCos,
        day_sin: daySin,
        day_cos: dayCos,
        week_sin: weekSin,
        week_cos: weekCos,

        // Trend features
        linear_trend: index,
        quadratic_trend: index * index,

        // Business cycle features (simplified)
        seasonal_component:
          point.business_context.business_impact * rollingMean30,
        trend_component: rollingMean30,
        remainder_component: point.value - rollingMean30,
      };
    });
  }

  /**
   * Handle outliers dalam data
   */
  private handleOutliers(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
    if (data.length < 10) return data;

    const values = data.map(d => d.value);
    const q1 = this.percentile(values, 25);
    const q3 = this.percentile(values, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return data.map(point => {
      if (point.value < lowerBound || point.value > upperBound) {
        // Replace outlier dengan median of surrounding values
        const median = this.percentile(values, 50);
        return {
          ...point,
          value: median,
          is_interpolated: true,
        };
      }
      return point;
    });
  }

  /**
   * Generate metadata untuk dataset
   */
  private generateMetadata(
    product: Product,
    data: TimeSeriesPoint[],
    features: EngineeredFeatures[],
    timeframe: TimeframeOptions,
  ): DatasetMetadata {
    const values = data.map(d => d.value);
    const interpolatedCount = data.filter(d => d.is_interpolated).length;
    const ramadanPeriods = data.filter(
      d => d.business_context.is_ramadan,
    ).length;
    const lebaranPeriods = data.filter(
      d => d.business_context.is_lebaran,
    ).length;
    const holidaysCount = data.filter(
      d => d.business_context.holiday_info,
    ).length;

    // Seasonality detection (simplified)
    const hasSeasonality = this.detectSeasonality(values);
    const seasonalityStrength = this.calculateSeasonalityStrength(values);
    const trendStrength = this.calculateTrendStrength(values);

    return {
      product_id: product.id,
      product_name: product.name,
      category: product.category?.name || 'Unknown',
      data_points: data.length,
      date_range: {
        start: data[0]?.date || '',
        end: data[data.length - 1]?.date || '',
        days: data.length,
      },
      frequency: 'daily',
      has_seasonality: hasSeasonality,
      seasonality_strength: seasonalityStrength,
      trend_strength: trendStrength,
      missing_data_percentage: (interpolatedCount / data.length) * 100,
      outlier_count: 0, // Calculated in outlier handling
      data_quality_score: this.calculateDataQualityScore(data),
      business_context: {
        ramadan_periods: ramadanPeriods,
        lebaran_periods: lebaranPeriods,
        holidays_included: holidaysCount,
        avg_business_impact:
          data.reduce((sum, d) => sum + d.business_context.business_impact, 0) /
          data.length,
      },
    };
  }

  /**
   * Assess data quality for ML suitability
   */
  private assessDataQuality(
    data: TimeSeriesPoint[],
    metadata: DatasetMetadata,
  ): DataQualityReport {
    const issues: DataQualityIssue[] = [];
    let score = 100;

    // Check minimum data requirements
    if (data.length < 30) {
      issues.push({
        type: 'insufficient_data',
        severity: 'critical',
        description: `Only ${data.length} data points available. Minimum 30 required for reliable ML predictions.`,
        affected_dates: [],
        recommended_action:
          'Collect more historical data before running ML models',
      });
      score -= 40;
    }

    // Check missing data percentage
    if (metadata.missing_data_percentage > 50) {
      issues.push({
        type: 'missing_data',
        severity: 'critical',
        description: `${metadata.missing_data_percentage.toFixed(
          1,
        )}% of data is missing or interpolated`,
        affected_dates: data.filter(d => d.is_interpolated).map(d => d.date),
        recommended_action:
          'Improve data collection processes to reduce missing data',
      });
      score -= 30;
    } else if (metadata.missing_data_percentage > 20) {
      issues.push({
        type: 'missing_data',
        severity: 'warning',
        description: `${metadata.missing_data_percentage.toFixed(
          1,
        )}% of data is missing or interpolated`,
        affected_dates: data.filter(d => d.is_interpolated).map(d => d.date),
        recommended_action: 'Consider improving data collection to reduce gaps',
      });
      score -= 15;
    }

    // Check for zero variance
    const values = data.map(d => d.value);
    const variance = this.calculateVariance(values);
    if (variance === 0) {
      issues.push({
        type: 'zero_variance',
        severity: 'critical',
        description:
          'All values are identical. Cannot perform meaningful predictions.',
        affected_dates: [],
        recommended_action: 'Verify data collection is working correctly',
      });
      score -= 50;
    }

    const recommendations = this.generateRecommendations(issues, metadata);

    return {
      overall_score: Math.max(0, score),
      issues,
      recommendations,
      is_suitable_for_ml: score >= 60 && data.length >= 30,
      minimum_additional_data_needed: Math.max(0, 30 - data.length),
    };
  }

  // Helper methods

  private initializeIndonesianHolidays(): void {
    // Indonesian holidays 2024-2025
    const holidays = [
      {
        date: '2024-01-01',
        name: 'Tahun Baru Masehi',
        type: 'national',
        impact: 'high',
      },
      {
        date: '2024-02-10',
        name: 'Tahun Baru Imlek',
        type: 'national',
        impact: 'medium',
      },
      { date: '2024-03-11', name: 'Nyepi', type: 'national', impact: 'medium' },
      {
        date: '2024-03-29',
        name: 'Wafat Isa Al Masih',
        type: 'national',
        impact: 'medium',
      },
      {
        date: '2024-04-10',
        name: 'Hari Raya Idul Fitri',
        type: 'national',
        impact: 'very_high',
      },
      {
        date: '2024-04-11',
        name: 'Hari Raya Idul Fitri',
        type: 'national',
        impact: 'very_high',
      },
      {
        date: '2024-05-01',
        name: 'Hari Buruh',
        type: 'national',
        impact: 'medium',
      },
      {
        date: '2024-05-09',
        name: 'Kenaikan Isa Al Masih',
        type: 'national',
        impact: 'medium',
      },
      {
        date: '2024-05-23',
        name: 'Hari Raya Waisak',
        type: 'national',
        impact: 'low',
      },
      {
        date: '2024-06-01',
        name: 'Hari Lahir Pancasila',
        type: 'national',
        impact: 'low',
      },
      {
        date: '2024-06-17',
        name: 'Hari Raya Idul Adha',
        type: 'national',
        impact: 'high',
      },
      {
        date: '2024-08-17',
        name: 'Hari Kemerdekaan',
        type: 'national',
        impact: 'very_high',
      },
      {
        date: '2024-12-25',
        name: 'Hari Raya Natal',
        type: 'national',
        impact: 'very_high',
      },
      // 2025 holidays
      {
        date: '2025-01-01',
        name: 'Tahun Baru Masehi',
        type: 'national',
        impact: 'high',
      },
      {
        date: '2025-01-29',
        name: 'Tahun Baru Imlek',
        type: 'national',
        impact: 'medium',
      },
      { date: '2025-03-29', name: 'Nyepi', type: 'national', impact: 'medium' },
      {
        date: '2025-03-31',
        name: 'Hari Raya Idul Fitri',
        type: 'national',
        impact: 'very_high',
      },
      {
        date: '2025-04-01',
        name: 'Hari Raya Idul Fitri',
        type: 'national',
        impact: 'very_high',
      },
      {
        date: '2025-05-01',
        name: 'Hari Buruh',
        type: 'national',
        impact: 'medium',
      },
      {
        date: '2025-08-17',
        name: 'Hari Kemerdekaan',
        type: 'national',
        impact: 'very_high',
      },
      {
        date: '2025-12-25',
        name: 'Hari Raya Natal',
        type: 'national',
        impact: 'very_high',
      },
    ];

    holidays.forEach(holiday => {
      this.indonesianHolidays.set(holiday.date, {
        name: holiday.name,
        type: holiday.type as any,
        impact: holiday.impact as any,
        description: holiday.name,
      });
    });
  }

  private calculateDateRange(timeframe: TimeframeOptions): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    const endDate: Date = timeframe.end_date || now;

    if (timeframe.start_date) {
      startDate = timeframe.start_date;
    } else if (timeframe.days) {
      startDate = new Date(
        endDate.getTime() - timeframe.days * 24 * 60 * 60 * 1000,
      );
    } else if (timeframe.weeks) {
      startDate = new Date(
        endDate.getTime() - timeframe.weeks * 7 * 24 * 60 * 60 * 1000,
      );
    } else if (timeframe.months) {
      startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - timeframe.months);
    } else {
      // Default ke 90 days
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private getBusinessContext(date: Date): BusinessContext {
    const dateStr = moment(date).format('YYYY-MM-DD');
    const holiday = this.indonesianHolidays.get(dateStr);

    // Check Ramadan period
    const isRamadan = this.isRamadanPeriod(date);
    const isLebaran = this.isLebaranPeriod(date);
    const ramadanDay = isRamadan ? this.getRamadanDay(date) : 0;

    // Calculate business impact
    let businessImpact = 1.0;

    if (holiday) {
      switch (holiday.impact) {
        case 'very_high':
          businessImpact *= 2.0;
          break;
        case 'high':
          businessImpact *= 1.5;
          break;
        case 'medium':
          businessImpact *= 1.2;
          break;
        case 'low':
          businessImpact *= 1.1;
          break;
      }
    }

    if (isRamadan) businessImpact *= 1.3;
    if (isLebaran) businessImpact *= 1.8;

    // Weekend effect
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      businessImpact *= 1.15;
    }

    return {
      holiday_info: holiday,
      is_ramadan: isRamadan,
      is_lebaran: isLebaran,
      ramadan_day: ramadanDay,
      business_impact: businessImpact,
      cultural_significance: this.getCulturalSignificance(
        date,
        holiday,
        isRamadan,
        isLebaran,
      ),
    };
  }

  private isRamadanPeriod(date: Date): boolean {
    const year = date.getFullYear();
    const ramadanPeriods = {
      2024: { start: '2024-03-11', end: '2024-04-09' },
      2025: { start: '2025-03-01', end: '2025-03-29' },
    };

    const period = ramadanPeriods[year];
    if (!period) return false;

    const startDate = new Date(period.start);
    const endDate = new Date(period.end);

    return date >= startDate && date <= endDate;
  }

  private isLebaranPeriod(date: Date): boolean {
    const year = date.getFullYear();
    const lebaranPeriods = {
      2024: { start: '2024-04-10', end: '2024-04-17' },
      2025: { start: '2025-03-31', end: '2025-04-07' },
    };

    const period = lebaranPeriods[year];
    if (!period) return false;

    const startDate = new Date(period.start);
    const endDate = new Date(period.end);

    return date >= startDate && date <= endDate;
  }

  private getRamadanDay(date: Date): number {
    if (!this.isRamadanPeriod(date)) return 0;

    const year = date.getFullYear();
    const ramadanStarts = {
      2024: new Date('2024-03-11'),
      2025: new Date('2025-03-01'),
    };

    const ramadanStart = ramadanStarts[year];
    if (!ramadanStart) return 0;

    const daysDiff = Math.floor(
      (date.getTime() - ramadanStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(1, daysDiff + 1);
  }

  private calculateHolidayDistance(date: Date): number {
    const dateStr = moment(date).format('YYYY-MM-DD');
    let minDistance = 365;

    for (const [holidayDate] of this.indonesianHolidays) {
      const daysDiff = Math.abs(moment(date).diff(moment(holidayDate), 'days'));
      minDistance = Math.min(minDistance, daysDiff);
    }

    return minDistance;
  }

  private getCulturalSignificance(
    date: Date,
    holiday?: IndonesianHolidayInfo,
    isRamadan?: boolean,
    isLebaran?: boolean,
  ): string {
    if (isLebaran) return 'high_consumption_period';
    if (isRamadan) return 'reduced_daytime_activity';
    if (holiday?.impact === 'very_high') return 'major_holiday_shopping';
    if (holiday?.impact === 'high') return 'holiday_preparation';

    const dayOfWeek = date.getDay();
    if (dayOfWeek === 5) return 'friday_prayer_day';
    if (dayOfWeek === 0) return 'family_day';
    if (dayOfWeek === 6) return 'weekend_shopping';

    return 'normal_business_day';
  }

  private interpolateMissingValue(
    existingData: TimeSeriesPoint[],
    targetDate: string,
  ): number {
    if (existingData.length === 0) return 0;
    if (existingData.length === 1) return existingData[0].value;

    // Simple linear interpolation or use last known value
    const recentValues = existingData.slice(-7).map(d => d.value);
    return (
      recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length
    );
  }

  private percentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private detectSeasonality(values: number[]): boolean {
    if (values.length < 14) return false;

    // Simple autocorrelation check for weekly seasonality
    const weeklyLag = 7;
    if (values.length < weeklyLag * 2) return false;

    const correlation = this.calculateAutocorrelation(values, weeklyLag);
    return Math.abs(correlation) > 0.3;
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length <= lag) return 0;

    const n = values.length - lag;
    const mean1 = values.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const mean2 = values.slice(lag).reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = values[i] - mean1;
      const diff2 = values[i + lag] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denom1 * denom2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateSeasonalityStrength(values: number[]): number {
    // Simplified seasonality strength calculation
    if (values.length < 14) return 0;

    const weeklyCorr = Math.abs(this.calculateAutocorrelation(values, 7));
    const monthlyCorr =
      values.length >= 30
        ? Math.abs(this.calculateAutocorrelation(values, 30))
        : 0;

    return Math.max(weeklyCorr, monthlyCorr);
  }

  private calculateTrendStrength(values: number[]): number {
    if (values.length < 10) return 0;

    // Linear regression slope as trend strength
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    return Math.abs(slope) / (yMean + 1); // Normalize by mean
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return variance;
  }

  private calculateDataQualityScore(data: TimeSeriesPoint[]): number {
    let score = 100;

    // Penalize untuk missing data
    const interpolatedPercentage =
      (data.filter(d => d.is_interpolated).length / data.length) * 100;
    score -= interpolatedPercentage * 0.5;

    // Penalize untuk insufficient data
    if (data.length < 30) {
      score -= (30 - data.length) * 2;
    }

    // Bonus untuk business context richness
    const businessContextRich = data.filter(
      d =>
        d.business_context.holiday_info ||
        d.business_context.is_ramadan ||
        d.business_context.is_lebaran,
    ).length;

    const contextBonus = (businessContextRich / data.length) * 10;
    score += contextBonus;

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    issues: DataQualityIssue[],
    metadata: DatasetMetadata,
  ): string[] {
    const recommendations = [];

    if (metadata.data_points < 30) {
      recommendations.push(
        'Kumpulkan minimal 30 hari data historis untuk prediksi yang reliable',
      );
    }

    if (metadata.missing_data_percentage > 20) {
      recommendations.push(
        'Perbaiki sistem pencatatan untuk mengurangi data yang hilang',
      );
    }

    if (!metadata.has_seasonality) {
      recommendations.push(
        'Pertimbangkan menggunakan model yang lebih sederhana untuk data non-seasonal',
      );
    }

    if (metadata.business_context.ramadan_periods === 0) {
      recommendations.push(
        'Tambahkan data selama periode Ramadan untuk akurasi prediksi yang lebih baik',
      );
    }

    if (metadata.data_quality_score < 60) {
      recommendations.push(
        'Kualitas data rendah - pertimbangkan untuk memperbaiki proses pengumpulan data',
      );
    }

    return recommendations;
  }
}
