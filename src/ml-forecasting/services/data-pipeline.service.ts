import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as moment from 'moment-timezone';

import {
  InventoryTransaction,
  TransactionType,
} from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  productId: string;
  locationId?: string;
  categoryId?: string;
  metadata?: Record<string, any>;
}

export interface FeatureSet {
  productFeatures: Record<string, any>;
  temporalFeatures: Record<string, any>;
  inventoryFeatures: Record<string, any>;
  externalFeatures?: Record<string, any>;
}

export interface DataPipelineConfig {
  dateRange: {
    from: string;
    to: string;
  };
  aggregation: 'daily' | 'weekly' | 'monthly';
  productIds?: string[];
  categoryIds?: string[];
  locationIds?: string[];
  includeExternalFactors?: boolean;
  features: string[];
  target: string;
}

@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);

  constructor(
    @InjectRepository(InventoryTransaction)
    private inventoryTransactionRepo: Repository<InventoryTransaction>,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(InventoryItem)
    private inventoryItemRepo: Repository<InventoryItem>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Extract historical sales data for time series analysis
   */
  async extractSalesData(
    tenantId: string,
    config: DataPipelineConfig,
  ): Promise<TimeSeriesDataPoint[]> {
    this.logger.debug(`Extracting sales data for tenant ${tenantId}`);

    const cacheKey = `sales_data_${tenantId}_${JSON.stringify(config)}`;
    const cached = await this.cacheManager.get<TimeSeriesDataPoint[]>(cacheKey);

    if (cached) {
      this.logger.debug('Returning cached sales data');
      return cached;
    }

    const queryBuilder = this.inventoryTransactionRepo
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.type = :saleType', {
        saleType: TransactionType.SALE,
      })
      .andWhere('transaction.transactionDate BETWEEN :from AND :to', {
        from: config.dateRange.from,
        to: config.dateRange.to,
      })
      .andWhere('transaction.status = :status', { status: 'completed' });

    if (config.productIds?.length) {
      queryBuilder.andWhere('transaction.productId IN (:...productIds)', {
        productIds: config.productIds,
      });
    }

    if (config.categoryIds?.length) {
      queryBuilder.andWhere('product.categoryId IN (:...categoryIds)', {
        categoryIds: config.categoryIds,
      });
    }

    if (config.locationIds?.length) {
      queryBuilder.andWhere('transaction.locationId IN (:...locationIds)', {
        locationIds: config.locationIds,
      });
    }

    const transactions = await queryBuilder
      .orderBy('transaction.transactionDate', 'ASC')
      .getMany();

    const timeSeries = this.aggregateTransactionData(
      transactions,
      config.aggregation,
    );

    // Cache for 1 hour
    await this.cacheManager.set(cacheKey, timeSeries, 3600);

    this.logger.debug(`Extracted ${timeSeries.length} data points`);
    return timeSeries;
  }

  /**
   * Extract product features for ML models
   */
  async extractProductFeatures(
    tenantId: string,
    productIds: string[],
  ): Promise<Record<string, FeatureSet>> {
    this.logger.debug(`Extracting features for ${productIds.length} products`);

    const products = await this.productRepo.find({
      where: {
        tenantId,
        id: productIds.length ? ({ $in: productIds } as any) : undefined,
      },
      relations: ['category', 'inventoryItems'],
    });

    const features: Record<string, FeatureSet> = {};

    for (const product of products) {
      features[product.id] = await this.extractSingleProductFeatures(
        tenantId,
        product,
      );
    }

    return features;
  }

  /**
   * Extract temporal features (seasonality, trends, etc.)
   */
  async extractTemporalFeatures(
    timeSeries: TimeSeriesDataPoint[],
    aggregation: 'daily' | 'weekly' | 'monthly',
  ): Promise<Record<string, any>> {
    this.logger.debug('Extracting temporal features');

    if (timeSeries.length === 0) {
      return {};
    }

    const features: Record<string, any> = {};

    // Sort by date
    const sortedData = timeSeries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Basic statistics
    const values = sortedData.map(d => d.value);
    features.mean = this.calculateMean(values);
    features.std = this.calculateStandardDeviation(values);
    features.min = Math.min(...values);
    features.max = Math.max(...values);
    features.median = this.calculateMedian(values);

    // Trend analysis
    features.trend = this.calculateTrend(sortedData);

    // Seasonality analysis
    const seasonality = this.calculateSeasonality(sortedData, aggregation);
    features.seasonality = seasonality;

    // Autocorrelation
    features.autocorrelation = this.calculateAutocorrelation(
      values,
      [1, 7, 30],
    );

    // Volatility
    features.volatility = this.calculateVolatility(values);

    // Growth rate
    features.growthRate = this.calculateGrowthRate(values);

    return features;
  }

  /**
   * Preprocess data for ML models
   */
  async preprocessData(
    timeSeries: TimeSeriesDataPoint[],
    features: Record<string, FeatureSet>,
    config: DataPipelineConfig,
  ): Promise<{
    features: number[][];
    target: number[];
    featureNames: string[];
    dates: string[];
  }> {
    this.logger.debug('Preprocessing data for ML training');

    const processedData = {
      features: [] as number[][],
      target: [] as number[],
      featureNames: [] as string[],
      dates: [] as string[],
    };

    // Group time series by product
    const productTimeSeries = this.groupTimeSeriesByProduct(timeSeries);

    for (const [productId, productData] of Object.entries(productTimeSeries)) {
      const productFeatures = features[productId];
      if (!productFeatures) continue;

      // Create feature matrix for this product
      const productFeatureMatrix = this.createFeatureMatrix(
        productData,
        productFeatures,
        config.features,
      );

      processedData.features.push(...productFeatureMatrix.features);
      processedData.target.push(...productFeatureMatrix.target);
      processedData.dates.push(...productFeatureMatrix.dates);

      // Store feature names (only once)
      if (processedData.featureNames.length === 0) {
        processedData.featureNames = productFeatureMatrix.featureNames;
      }
    }

    // Handle missing values
    this.handleMissingValues(processedData.features);

    // Normalize features if needed
    if (config.features.includes('normalize')) {
      this.normalizeFeatures(processedData.features);
    }

    this.logger.debug(
      `Preprocessed data: ${processedData.features.length} samples, ${processedData.featureNames.length} features`,
    );

    return processedData;
  }

  /**
   * Create training and validation sets
   */
  createTrainValidationSplit(
    features: number[][],
    target: number[],
    dates: string[],
    splitRatio: number = 0.8,
    method: 'time_series' | 'random' = 'time_series',
  ): {
    train: { features: number[][]; target: number[]; dates: string[] };
    validation: { features: number[][]; target: number[]; dates: string[] };
  } {
    this.logger.debug(
      `Creating train/validation split with ratio ${splitRatio}`,
    );

    const totalSamples = features.length;
    const trainSize = Math.floor(totalSamples * splitRatio);

    if (method === 'time_series') {
      // For time series, split by time to avoid data leakage
      return {
        train: {
          features: features.slice(0, trainSize),
          target: target.slice(0, trainSize),
          dates: dates.slice(0, trainSize),
        },
        validation: {
          features: features.slice(trainSize),
          target: target.slice(trainSize),
          dates: dates.slice(trainSize),
        },
      };
    } else {
      // Random split
      const indices = Array.from({ length: totalSamples }, (_, i) => i);
      this.shuffleArray(indices);

      const trainIndices = indices.slice(0, trainSize);
      const validationIndices = indices.slice(trainSize);

      return {
        train: {
          features: trainIndices.map(i => features[i]),
          target: trainIndices.map(i => target[i]),
          dates: trainIndices.map(i => dates[i]),
        },
        validation: {
          features: validationIndices.map(i => features[i]),
          target: validationIndices.map(i => target[i]),
          dates: validationIndices.map(i => dates[i]),
        },
      };
    }
  }

  /**
   * Get external factors (holidays, weather, etc.)
   */
  async getExternalFactors(
    dateRange: { from: string; to: string },
    tenantId: string,
  ): Promise<Record<string, any>> {
    this.logger.debug('Getting external factors');

    const factors: Record<string, any> = {};

    // Indonesian holidays and events
    factors.holidays = this.getIndonesianHolidays(dateRange);

    // Ramadan and religious periods
    factors.religiousPeriods = this.getReligiousPeriods(dateRange);

    // Economic indicators (placeholder - would integrate with external APIs)
    factors.economicIndicators = this.getEconomicIndicators(dateRange);

    // Payday cycles (common in Indonesia: 25th and 10th)
    factors.paydayCycles = this.getPaydayCycles(dateRange);

    return factors;
  }

  // Private helper methods

  private aggregateTransactionData(
    transactions: InventoryTransaction[],
    aggregation: 'daily' | 'weekly' | 'monthly',
  ): TimeSeriesDataPoint[] {
    const aggregated: Record<string, Record<string, number>> = {};

    for (const transaction of transactions) {
      const date = this.getAggregationKey(
        transaction.transactionDate,
        aggregation,
      );
      const productId = transaction.productId;

      if (!aggregated[date]) {
        aggregated[date] = {};
      }

      if (!aggregated[date][productId]) {
        aggregated[date][productId] = 0;
      }

      aggregated[date][productId] += Math.abs(transaction.quantity);
    }

    const result: TimeSeriesDataPoint[] = [];

    for (const [date, products] of Object.entries(aggregated)) {
      for (const [productId, value] of Object.entries(products)) {
        result.push({
          date,
          value,
          productId,
          metadata: { aggregation },
        });
      }
    }

    return result;
  }

  private async extractSingleProductFeatures(
    tenantId: string,
    product: Product,
  ): Promise<FeatureSet> {
    const productFeatures: Record<string, any> = {
      // Price features
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      profitMargin: product.profitMargin,

      // Product characteristics
      hasVariants: product.hasVariants,
      trackStock: product.trackStock,
      allowBackorder: product.allowBackorder,
      minStock: product.minStock,
      maxStock: product.maxStock,
      reorderPoint: product.reorderPoint,

      // Historical performance
      salesCount: product.salesCount,
      totalRevenue: product.totalRevenue,
      viewCount: product.viewCount,

      // Category features
      categoryId: product.categoryId || 'unknown',
      brand: product.brand || 'unknown',
      unit: product.unit || 'pcs',

      // Time features
      daysSinceCreated: moment().diff(moment(product.createdAt), 'days'),
      daysSinceLastSold: product.lastSoldAt
        ? moment().diff(moment(product.lastSoldAt), 'days')
        : 0,
    };

    // Get current inventory levels
    const inventoryFeatures = await this.getInventoryFeatures(
      tenantId,
      product.id,
    );

    return {
      productFeatures,
      temporalFeatures: {},
      inventoryFeatures,
    };
  }

  private async getInventoryFeatures(
    tenantId: string,
    productId: string,
  ): Promise<Record<string, any>> {
    const inventoryItems = await this.inventoryItemRepo.find({
      where: { tenantId, productId },
    });

    const totalStock = inventoryItems.reduce(
      (sum, item) => sum + item.quantityOnHand,
      0,
    );
    const totalReserved = inventoryItems.reduce(
      (sum, item) => sum + item.quantityReserved,
      0,
    );
    const totalValue = inventoryItems.reduce(
      (sum, item) => sum + item.totalValue,
      0,
    );

    return {
      totalStock,
      totalReserved,
      totalValue,
      stockLocations: inventoryItems.length,
      averageCost: totalStock > 0 ? totalValue / totalStock : 0,
      stockoutLocations: inventoryItems.filter(item => item.quantityOnHand <= 0)
        .length,
      lowStockLocations: inventoryItems.filter(item => item.isLowStock).length,
    };
  }

  private getAggregationKey(
    date: Date,
    aggregation: 'daily' | 'weekly' | 'monthly',
  ): string {
    const momentDate = moment(date).tz('Asia/Jakarta');

    switch (aggregation) {
      case 'daily':
        return momentDate.format('YYYY-MM-DD');
      case 'weekly':
        return momentDate.startOf('week').format('YYYY-MM-DD');
      case 'monthly':
        return momentDate.format('YYYY-MM');
      default:
        return momentDate.format('YYYY-MM-DD');
    }
  }

  private groupTimeSeriesByProduct(
    timeSeries: TimeSeriesDataPoint[],
  ): Record<string, TimeSeriesDataPoint[]> {
    const grouped: Record<string, TimeSeriesDataPoint[]> = {};

    for (const point of timeSeries) {
      if (!grouped[point.productId]) {
        grouped[point.productId] = [];
      }
      grouped[point.productId].push(point);
    }

    return grouped;
  }

  private createFeatureMatrix(
    timeSeries: TimeSeriesDataPoint[],
    productFeatures: FeatureSet,
    requestedFeatures: string[],
  ): {
    features: number[][];
    target: number[];
    featureNames: string[];
    dates: string[];
  } {
    const features: number[][] = [];
    const target: number[] = [];
    const dates: string[] = [];
    const featureNames: string[] = [];

    // Create feature names
    Object.keys(productFeatures.productFeatures).forEach(key => {
      featureNames.push(`product_${key}`);
    });
    Object.keys(productFeatures.inventoryFeatures).forEach(key => {
      featureNames.push(`inventory_${key}`);
    });

    // Add temporal features
    featureNames.push(
      'day_of_week',
      'day_of_month',
      'month',
      'quarter',
      'is_weekend',
    );

    // Create feature matrix
    for (const point of timeSeries) {
      const featureRow: number[] = [];

      // Product features
      Object.values(productFeatures.productFeatures).forEach(value => {
        featureRow.push(typeof value === 'number' ? value : 0);
      });

      // Inventory features
      Object.values(productFeatures.inventoryFeatures).forEach(value => {
        featureRow.push(typeof value === 'number' ? value : 0);
      });

      // Temporal features
      const momentDate = moment(point.date);
      featureRow.push(momentDate.day()); // day of week
      featureRow.push(momentDate.date()); // day of month
      featureRow.push(momentDate.month() + 1); // month
      featureRow.push(momentDate.quarter()); // quarter
      featureRow.push(momentDate.day() === 0 || momentDate.day() === 6 ? 1 : 0); // is weekend

      features.push(featureRow);
      target.push(point.value);
      dates.push(point.date);
    }

    return { features, target, featureNames, dates };
  }

  // Statistical helper methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateTrend(data: TimeSeriesDataPoint[]): number {
    if (data.length < 2) return 0;

    // Simple linear trend calculation
    const n = data.length;
    const sumX = data.reduce((sum, _, index) => sum + index, 0);
    const sumY = data.reduce((sum, point) => sum + point.value, 0);
    const sumXY = data.reduce(
      (sum, point, index) => sum + index * point.value,
      0,
    );
    const sumXX = data.reduce((sum, _, index) => sum + index * index, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateSeasonality(
    data: TimeSeriesDataPoint[],
    aggregation: 'daily' | 'weekly' | 'monthly',
  ): Record<string, number> {
    const seasonality: Record<string, number[]> = {};

    for (const point of data) {
      const momentDate = moment(point.date);
      let key: string;

      switch (aggregation) {
        case 'daily':
          key = momentDate.format('dddd'); // Day of week
          break;
        case 'weekly':
          key = `week_${momentDate.week()}`;
          break;
        case 'monthly':
          key = momentDate.format('MMMM'); // Month name
          break;
        default:
          key = momentDate.format('dddd');
      }

      if (!seasonality[key]) {
        seasonality[key] = [];
      }
      seasonality[key].push(point.value);
    }

    // Calculate average for each seasonal component
    const result: Record<string, number> = {};
    for (const [key, values] of Object.entries(seasonality)) {
      result[key] = this.calculateMean(values);
    }

    return result;
  }

  private calculateAutocorrelation(
    values: number[],
    lags: number[],
  ): Record<string, number> {
    const result: Record<string, number> = {};
    const n = values.length;
    const mean = this.calculateMean(values);

    for (const lag of lags) {
      if (lag >= n) {
        result[`lag_${lag}`] = 0;
        continue;
      }

      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i < n - lag; i++) {
        numerator += (values[i] - mean) * (values[i + lag] - mean);
      }

      for (let i = 0; i < n; i++) {
        denominator += Math.pow(values[i] - mean, 2);
      }

      result[`lag_${lag}`] = denominator !== 0 ? numerator / denominator : 0;
    }

    return result;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    return this.calculateStandardDeviation(returns);
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const periods = values.length - 1;

    if (firstValue <= 0) return 0;

    return Math.pow(lastValue / firstValue, 1 / periods) - 1;
  }

  private handleMissingValues(features: number[][]): void {
    // Simple imputation with column means
    if (features.length === 0) return;

    const numFeatures = features[0].length;
    const columnMeans = new Array(numFeatures).fill(0);

    // Calculate means for each column
    for (let col = 0; col < numFeatures; col++) {
      let sum = 0;
      let count = 0;

      for (let row = 0; row < features.length; row++) {
        if (!isNaN(features[row][col]) && isFinite(features[row][col])) {
          sum += features[row][col];
          count++;
        }
      }

      columnMeans[col] = count > 0 ? sum / count : 0;
    }

    // Replace missing values with column means
    for (let row = 0; row < features.length; row++) {
      for (let col = 0; col < numFeatures; col++) {
        if (isNaN(features[row][col]) || !isFinite(features[row][col])) {
          features[row][col] = columnMeans[col];
        }
      }
    }
  }

  private normalizeFeatures(features: number[][]): void {
    if (features.length === 0) return;

    const numFeatures = features[0].length;

    for (let col = 0; col < numFeatures; col++) {
      const values = features.map(row => row[col]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      if (range === 0) continue;

      for (let row = 0; row < features.length; row++) {
        features[row][col] = (features[row][col] - min) / range;
      }
    }
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Indonesian-specific external factors
  private getIndonesianHolidays(dateRange: {
    from: string;
    to: string;
  }): Record<string, boolean> {
    const holidays: Record<string, boolean> = {};

    // Major Indonesian holidays (simplified)
    const holidayDates = [
      '01-01', // New Year
      '08-17', // Independence Day
      '12-25', // Christmas
      // Add more holidays based on calendar
    ];

    const startYear = new Date(dateRange.from).getFullYear();
    const endYear = new Date(dateRange.to).getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      for (const holiday of holidayDates) {
        const date = `${year}-${holiday}`;
        if (date >= dateRange.from && date <= dateRange.to) {
          holidays[date] = true;
        }
      }
    }

    return holidays;
  }

  private getReligiousPeriods(dateRange: {
    from: string;
    to: string;
  }): Record<string, string> {
    // Simplified - would need proper Islamic calendar integration
    return {};
  }

  private getEconomicIndicators(dateRange: {
    from: string;
    to: string;
  }): Record<string, number> {
    // Placeholder - would integrate with external economic data APIs
    return {
      inflationRate: 3.5,
      gdpGrowth: 5.2,
      unemploymentRate: 6.1,
    };
  }

  private getPaydayCycles(dateRange: {
    from: string;
    to: string;
  }): Record<string, boolean> {
    const paydayCycles: Record<string, boolean> = {};

    const start = moment(dateRange.from);
    const end = moment(dateRange.to);

    const current = start.clone();

    while (current.isSameOrBefore(end)) {
      const day = current.date();

      // Common payday cycles in Indonesia: 25th and 10th
      if (day === 25 || day === 10) {
        paydayCycles[current.format('YYYY-MM-DD')] = true;
      }

      current.add(1, 'day');
    }

    return paydayCycles;
  }
}
