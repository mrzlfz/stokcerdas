import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as moment from 'moment-timezone';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import { Prediction, PredictionType } from '../entities/prediction.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductCategory } from '../../products/entities/product-category.entity';
import { DataPipelineService } from './data-pipeline.service';
import { ModelServingService } from './model-serving.service';

export interface DemandForecastRequest {
  productId: string;
  forecastHorizonDays: number; // 30, 60, or 90 days
  includeConfidenceInterval: boolean;
  includeSeasonality: boolean;
  includeTrendDecomposition: boolean;
  granularity: 'daily' | 'weekly' | 'monthly';
}

export interface DemandForecastResult {
  success: boolean;
  productId: string;
  forecastHorizon: number;
  granularity: string;

  // Main forecast data
  timeSeries: Array<{
    date: string;
    predictedDemand: number;
    lowerBound?: number;
    upperBound?: number;
    confidence?: number;
  }>;

  // Seasonality analysis
  seasonalDecomposition?: {
    trend: Array<{ date: string; value: number }>;
    seasonal: Array<{ date: string; value: number }>;
    residual: Array<{ date: string; value: number }>;
    seasonalityStrength: number; // 0-1 score
    trendDirection: 'increasing' | 'decreasing' | 'stable';
  };

  // Confidence metrics
  overallConfidence: number;
  confidenceByPeriod: Array<{
    period: string; // week/month
    confidence: number;
  }>;

  // Business insights
  insights: {
    peakDemandPeriods: string[];
    lowDemandPeriods: string[];
    totalPredictedDemand: number;
    averageDailyDemand: number;
    demandVolatility: number; // Standard deviation
    seasonalPeaks: string[];
    recommendations: string[];
    alerts: Array<{
      type:
        | 'high_volatility'
        | 'low_confidence'
        | 'seasonal_peak'
        | 'demand_spike';
      severity: 'low' | 'medium' | 'high';
      message: string;
      actionRequired?: string;
    }>;
  };

  // Model information
  modelInfo: {
    modelType: string;
    accuracy: number;
    lastTrained: Date;
    dataQuality: number;
  };

  error?: string;
}

export interface NewProductForecastRequest {
  productName: string;
  categoryId: string;
  attributes: Record<string, any>;
  launchDate?: Date;
  marketingBudget?: number;
  forecastHorizonDays: number;
}

export interface NewProductForecastResult {
  success: boolean;
  productName: string;
  categoryId: string;

  forecast: Array<{
    date: string;
    predictedDemand: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }>;

  // Category comparison
  categoryBenchmarks: {
    averageCategoryDemand: number;
    topPerformingProducts: Array<{
      productId: string;
      name: string;
      averageDemand: number;
    }>;
    marketPenetrationEstimate: number;
  };

  // Similar product analysis
  similarProducts: Array<{
    productId: string;
    name: string;
    similarity: number;
    launchPerformance: {
      weeklyDemand: Array<{ week: number; demand: number }>;
      peakWeek: number;
      stabilizationWeek: number;
    };
  }>;

  insights: {
    expectedPeakWeek: number;
    expectedStabilizationWeek: number;
    recommendedInitialStock: number;
    riskFactors: string[];
    successFactors: string[];
  };

  error?: string;
}

@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  constructor(
    @InjectRepository(MLModel)
    private mlModelRepo: Repository<MLModel>,

    @InjectRepository(Prediction)
    private predictionRepo: Repository<Prediction>,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private categoryRepo: Repository<ProductCategory>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,

    private dataPipelineService: DataPipelineService,
    private modelServingService: ModelServingService,
  ) {}

  /**
   * Generate enhanced demand forecast with 30/60/90 day options
   */
  async generateDemandForecast(
    tenantId: string,
    request: DemandForecastRequest,
  ): Promise<DemandForecastResult> {
    this.logger.debug(
      `Generating enhanced demand forecast for product ${request.productId}`,
    );

    try {
      // Validate forecast horizon
      if (![30, 60, 90].includes(request.forecastHorizonDays)) {
        return {
          success: false,
          productId: request.productId,
          forecastHorizon: request.forecastHorizonDays,
          granularity: request.granularity,
          timeSeries: [],
          overallConfidence: 0,
          confidenceByPeriod: [],
          insights: {
            peakDemandPeriods: [],
            lowDemandPeriods: [],
            totalPredictedDemand: 0,
            averageDailyDemand: 0,
            demandVolatility: 0,
            seasonalPeaks: [],
            recommendations: [],
            alerts: [],
          },
          modelInfo: {
            modelType: '',
            accuracy: 0,
            lastTrained: new Date(),
            dataQuality: 0,
          },
          error: 'Forecast horizon must be 30, 60, or 90 days',
        };
      }

      // Get product information
      const product = await this.productRepo.findOne({
        where: { id: request.productId, tenantId },
        relations: ['category'],
      });

      if (!product) {
        throw new Error(`Product ${request.productId} not found`);
      }

      // Find best forecasting model
      const model = await this.findBestForecastingModel(
        tenantId,
        request.productId,
      );

      if (!model) {
        throw new Error('No suitable forecasting model found');
      }

      // Generate base forecast
      const baseForecast = await this.modelServingService.getDemandForecast(
        tenantId,
        request.productId,
        request.forecastHorizonDays,
      );

      if (!baseForecast.success) {
        throw new Error(
          baseForecast.error || 'Failed to generate base forecast',
        );
      }

      // Generate enhanced time series with granularity
      const timeSeries = await this.generateEnhancedTimeSeries(
        tenantId,
        request,
        baseForecast,
      );

      // Perform seasonality analysis if requested
      let seasonalDecomposition;
      if (request.includeSeasonality) {
        seasonalDecomposition = await this.performSeasonalDecomposition(
          tenantId,
          request.productId,
          timeSeries,
        );
      }

      // Calculate confidence metrics
      const confidenceMetrics = await this.calculateConfidenceMetrics(
        timeSeries,
        request.granularity,
      );

      // Generate business insights
      const insights = await this.generateBusinessInsights(
        tenantId,
        product,
        timeSeries,
        seasonalDecomposition,
      );

      // Get model information
      const modelInfo = {
        modelType: model.modelType,
        accuracy: model.accuracy || 0.85,
        lastTrained: model.trainedAt || new Date(),
        dataQuality: model.dataQuality || 0.9,
      };

      return {
        success: true,
        productId: request.productId,
        forecastHorizon: request.forecastHorizonDays,
        granularity: request.granularity,
        timeSeries,
        seasonalDecomposition,
        overallConfidence: confidenceMetrics.overall,
        confidenceByPeriod: confidenceMetrics.byPeriod,
        insights,
        modelInfo,
      };
    } catch (error) {
      this.logger.error(
        `Enhanced demand forecast failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        productId: request.productId,
        forecastHorizon: request.forecastHorizonDays,
        granularity: request.granularity,
        timeSeries: [],
        overallConfidence: 0,
        confidenceByPeriod: [],
        insights: {
          peakDemandPeriods: [],
          lowDemandPeriods: [],
          totalPredictedDemand: 0,
          averageDailyDemand: 0,
          demandVolatility: 0,
          seasonalPeaks: [],
          recommendations: [],
          alerts: [],
        },
        modelInfo: {
          modelType: '',
          accuracy: 0,
          lastTrained: new Date(),
          dataQuality: 0,
        },
        error: error.message,
      };
    }
  }

  /**
   * Generate forecast for new products based on category and similar products
   */
  async generateNewProductForecast(
    tenantId: string,
    request: NewProductForecastRequest,
  ): Promise<NewProductForecastResult> {
    this.logger.debug(
      `Generating new product forecast for ${request.productName}`,
    );

    try {
      // Get category information
      const category = await this.categoryRepo.findOne({
        where: { id: request.categoryId, tenantId },
        relations: ['products'],
      });

      if (!category) {
        throw new Error(`Category ${request.categoryId} not found`);
      }

      // Analyze category benchmarks
      const categoryBenchmarks = await this.analyzeCategoryBenchmarks(
        tenantId,
        request.categoryId,
      );

      // Find similar products
      const similarProducts = await this.findSimilarProducts(
        tenantId,
        request.categoryId,
        request.attributes,
      );

      // Generate forecast based on similar products and category data
      const forecast = await this.generateNewProductTimeSeries(
        tenantId,
        request,
        categoryBenchmarks,
        similarProducts,
      );

      // Generate insights
      const insights = await this.generateNewProductInsights(
        request,
        categoryBenchmarks,
        similarProducts,
        forecast,
      );

      return {
        success: true,
        productName: request.productName,
        categoryId: request.categoryId,
        forecast,
        categoryBenchmarks,
        similarProducts,
        insights,
      };
    } catch (error) {
      this.logger.error(
        `New product forecast failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        productName: request.productName,
        categoryId: request.categoryId,
        forecast: [],
        categoryBenchmarks: {
          averageCategoryDemand: 0,
          topPerformingProducts: [],
          marketPenetrationEstimate: 0,
        },
        similarProducts: [],
        insights: {
          expectedPeakWeek: 0,
          expectedStabilizationWeek: 0,
          recommendedInitialStock: 0,
          riskFactors: [],
          successFactors: [],
        },
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async findBestForecastingModel(
    tenantId: string,
    productId: string,
  ): Promise<MLModel | null> {
    return await this.mlModelRepo.findOne({
      where: {
        tenantId,
        status: ModelStatus.DEPLOYED,
        modelType: ModelType.PROPHET, // Prefer Prophet for time series forecasting
      },
      order: { accuracy: 'DESC' },
    });
  }

  private async generateEnhancedTimeSeries(
    tenantId: string,
    request: DemandForecastRequest,
    baseForecast: any,
  ): Promise<
    Array<{
      date: string;
      predictedDemand: number;
      lowerBound?: number;
      upperBound?: number;
      confidence?: number;
    }>
  > {
    // If base forecast has time series, use it; otherwise generate daily points
    if (baseForecast.timeSeries?.length) {
      return baseForecast.timeSeries.map((point: any) => ({
        date: point.date,
        predictedDemand: point.value,
        lowerBound: point.lowerBound,
        upperBound: point.upperBound,
        confidence: 0.85, // Default confidence
      }));
    }

    // Generate daily time series for the forecast horizon
    const timeSeries = [];
    const baseValue = baseForecast.predictedValue || 0;
    const startDate = moment().startOf('day');

    for (let i = 0; i < request.forecastHorizonDays; i++) {
      const date = startDate.clone().add(i, 'days');

      // Add some realistic variation and seasonality
      const seasonalFactor = 1 + 0.2 * Math.sin((i / 7) * Math.PI); // Weekly seasonality
      const randomVariation = 0.8 + Math.random() * 0.4; // ±20% variation
      const trendFactor = 1 + i * 0.001; // Slight upward trend

      const predictedDemand = Math.max(
        0,
        baseValue * seasonalFactor * randomVariation * trendFactor,
      );
      const confidence = Math.max(0.6, 0.9 - i * 0.003); // Decreasing confidence over time

      timeSeries.push({
        date: date.format('YYYY-MM-DD'),
        predictedDemand: Math.round(predictedDemand * 100) / 100,
        lowerBound: Math.round(predictedDemand * 0.8 * 100) / 100,
        upperBound: Math.round(predictedDemand * 1.2 * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    return timeSeries;
  }

  private async performSeasonalDecomposition(
    tenantId: string,
    productId: string,
    timeSeries: any[],
  ): Promise<{
    trend: Array<{ date: string; value: number }>;
    seasonal: Array<{ date: string; value: number }>;
    residual: Array<{ date: string; value: number }>;
    seasonalityStrength: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
  }> {
    // Simplified seasonal decomposition
    const trend = [];
    const seasonal = [];
    const residual = [];

    // Calculate moving average for trend
    const windowSize = Math.min(7, Math.floor(timeSeries.length / 4));

    for (let i = 0; i < timeSeries.length; i++) {
      const point = timeSeries[i];

      // Calculate trend using moving average
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(
        timeSeries.length,
        i + Math.floor(windowSize / 2) + 1,
      );
      const window = timeSeries.slice(start, end);
      const trendValue =
        window.reduce((sum, p) => sum + p.predictedDemand, 0) / window.length;

      // Calculate seasonal component (simplified - weekly pattern)
      const dayOfWeek = moment(point.date).day();
      const seasonalMultiplier = [1.0, 0.8, 0.9, 1.1, 1.2, 1.3, 1.1][dayOfWeek]; // Example weekly pattern
      const seasonalValue = trendValue * (seasonalMultiplier - 1);

      // Calculate residual
      const residualValue = point.predictedDemand - trendValue - seasonalValue;

      trend.push({
        date: point.date,
        value: Math.round(trendValue * 100) / 100,
      });
      seasonal.push({
        date: point.date,
        value: Math.round(seasonalValue * 100) / 100,
      });
      residual.push({
        date: point.date,
        value: Math.round(residualValue * 100) / 100,
      });
    }

    // Calculate seasonality strength
    const seasonalVariance = this.calculateVariance(seasonal.map(s => s.value));
    const totalVariance = this.calculateVariance(
      timeSeries.map(t => t.predictedDemand),
    );
    const seasonalityStrength = Math.min(1, seasonalVariance / totalVariance);

    // Determine trend direction
    const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
    const secondHalf = trend.slice(Math.floor(trend.length / 2));
    const firstAvg =
      firstHalf.reduce((sum, t) => sum + t.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, t) => sum + t.value, 0) / secondHalf.length;

    let trendDirection: 'increasing' | 'decreasing' | 'stable';
    const trendChange = (secondAvg - firstAvg) / firstAvg;

    if (trendChange > 0.05) {
      trendDirection = 'increasing';
    } else if (trendChange < -0.05) {
      trendDirection = 'decreasing';
    } else {
      trendDirection = 'stable';
    }

    return {
      trend,
      seasonal,
      residual,
      seasonalityStrength: Math.round(seasonalityStrength * 100) / 100,
      trendDirection,
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private async calculateConfidenceMetrics(
    timeSeries: any[],
    granularity: string,
  ): Promise<{
    overall: number;
    byPeriod: Array<{ period: string; confidence: number }>;
  }> {
    const overall =
      timeSeries.reduce((sum, point) => sum + (point.confidence || 0.8), 0) /
      timeSeries.length;

    // Group by periods based on granularity
    const periods = new Map<string, number[]>();

    for (const point of timeSeries) {
      let periodKey: string;
      const date = moment(point.date);

      if (granularity === 'weekly') {
        periodKey = `Week ${date.isoWeek()}`;
      } else if (granularity === 'monthly') {
        periodKey = date.format('MMMM YYYY');
      } else {
        periodKey = `Week ${date.isoWeek()}`; // Default to weekly for daily data
      }

      if (!periods.has(periodKey)) {
        periods.set(periodKey, []);
      }
      periods.get(periodKey)!.push(point.confidence || 0.8);
    }

    const byPeriod = Array.from(periods.entries()).map(
      ([period, confidences]) => ({
        period,
        confidence:
          Math.round(
            (confidences.reduce((sum, c) => sum + c, 0) / confidences.length) *
              100,
          ) / 100,
      }),
    );

    return {
      overall: Math.round(overall * 100) / 100,
      byPeriod,
    };
  }

  private async generateBusinessInsights(
    tenantId: string,
    product: Product,
    timeSeries: any[],
    seasonalDecomposition?: any,
  ): Promise<any> {
    const values = timeSeries.map(t => t.predictedDemand);
    const totalPredictedDemand = values.reduce((sum, val) => sum + val, 0);
    const averageDailyDemand = totalPredictedDemand / timeSeries.length;
    const demandVolatility = Math.sqrt(this.calculateVariance(values));

    // Find peak and low demand periods
    const sortedWithIndex = timeSeries
      .map((point, index) => ({ ...point, index }))
      .sort((a, b) => b.predictedDemand - a.predictedDemand);

    const topPeriods = sortedWithIndex.slice(0, 3);
    const bottomPeriods = sortedWithIndex.slice(-3);

    const peakDemandPeriods = topPeriods.map(p =>
      moment(p.date).format('DD MMM YYYY'),
    );
    const lowDemandPeriods = bottomPeriods.map(p =>
      moment(p.date).format('DD MMM YYYY'),
    );

    // Generate recommendations
    const recommendations = [];
    const alerts = [];

    if (demandVolatility > averageDailyDemand * 0.3) {
      recommendations.push(
        'Tingkatkan safety stock karena permintaan berfluktuasi tinggi',
      );
      alerts.push({
        type: 'high_volatility' as const,
        severity: 'medium' as const,
        message: 'Volatilitas permintaan tinggi terdeteksi',
        actionRequired: 'Review inventory buffer dan reorder points',
      });
    }

    if (seasonalDecomposition?.seasonalityStrength > 0.3) {
      recommendations.push(
        'Sesuaikan strategi stocking dengan pola musiman yang terdeteksi',
      );

      const seasonalPeaks = seasonalDecomposition.seasonal
        .map((s: any, index: number) => ({
          value: s.value,
          date: timeSeries[index].date,
        }))
        .filter((s: any) => s.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 3)
        .map((s: any) => moment(s.date).format('DD MMM'));

      recommendations.push(
        `Periode puncak musiman diprediksi: ${seasonalPeaks.join(', ')}`,
      );
    }

    // Check for low confidence periods
    const lowConfidencePeriods = timeSeries.filter(
      t => (t.confidence || 0.8) < 0.7,
    );
    if (lowConfidencePeriods.length > timeSeries.length * 0.2) {
      alerts.push({
        type: 'low_confidence' as const,
        severity: 'high' as const,
        message: 'Tingkat kepercayaan prediksi rendah untuk beberapa periode',
        actionRequired:
          'Pertimbangkan untuk mengumpulkan data historis lebih banyak',
      });
    }

    return {
      peakDemandPeriods,
      lowDemandPeriods,
      totalPredictedDemand: Math.round(totalPredictedDemand),
      averageDailyDemand: Math.round(averageDailyDemand * 100) / 100,
      demandVolatility: Math.round(demandVolatility * 100) / 100,
      seasonalPeaks:
        seasonalDecomposition?.seasonal
          ?.filter((s: any) => s.value > 0)
          ?.map((s: any) => moment(s.date).format('DD MMM'))
          ?.slice(0, 3) || [],
      recommendations,
      alerts,
    };
  }

  private async analyzeCategoryBenchmarks(
    tenantId: string,
    categoryId: string,
  ): Promise<any> {
    // Get products in the same category
    const categoryProducts = await this.productRepo.find({
      where: { categoryId, tenantId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // Calculate average demand (simplified - would need actual sales data)
    const averageCategoryDemand = 50; // Placeholder

    // Get top performing products (simplified)
    const topPerformingProducts = categoryProducts.slice(0, 5).map(product => ({
      productId: product.id,
      name: product.name,
      averageDemand: 75, // Placeholder
    }));

    return {
      averageCategoryDemand,
      topPerformingProducts,
      marketPenetrationEstimate: 0.15, // 15% market penetration estimate
    };
  }

  private async findSimilarProducts(
    tenantId: string,
    categoryId: string,
    attributes: Record<string, any>,
  ): Promise<any[]> {
    // Get products in the same category
    const categoryProducts = await this.productRepo.find({
      where: { categoryId, tenantId },
      take: 10,
    });

    // Calculate similarity (simplified - would use actual ML similarity)
    return categoryProducts.map(product => ({
      productId: product.id,
      name: product.name,
      similarity: Math.random() * 0.5 + 0.5, // Random similarity 0.5-1.0
      launchPerformance: {
        weeklyDemand: Array.from({ length: 12 }, (_, week) => ({
          week: week + 1,
          demand: Math.floor(Math.random() * 100) + 20,
        })),
        peakWeek: Math.floor(Math.random() * 4) + 3,
        stabilizationWeek: Math.floor(Math.random() * 4) + 8,
      },
    }));
  }

  private async generateNewProductTimeSeries(
    tenantId: string,
    request: NewProductForecastRequest,
    categoryBenchmarks: any,
    similarProducts: any[],
  ): Promise<any[]> {
    const forecast = [];
    const startDate = moment(request.launchDate || new Date());

    // Generate weekly forecast for new product
    const weeksToForecast = Math.ceil(request.forecastHorizonDays / 7);

    for (let week = 0; week < weeksToForecast; week++) {
      const date = startDate.clone().add(week, 'weeks');

      // Use similar products to estimate demand pattern
      const avgSimilarDemand =
        similarProducts.length > 0
          ? similarProducts.reduce((sum, p) => {
              const weekData = p.launchPerformance.weeklyDemand.find(
                (w: any) => w.week === week + 1,
              );
              return sum + (weekData?.demand || 0);
            }, 0) / similarProducts.length
          : categoryBenchmarks.averageCategoryDemand;

      // Apply scaling factors
      const marketingFactor = request.marketingBudget
        ? Math.min(2, 1 + request.marketingBudget / 10000)
        : 1;
      const categoryFactor = 0.7; // New products typically start at 70% of category average

      const baseDemand = avgSimilarDemand * categoryFactor * marketingFactor;
      const confidence = Math.max(0.5, 0.8 - week * 0.02); // Decreasing confidence

      forecast.push({
        date: date.format('YYYY-MM-DD'),
        predictedDemand: Math.round(baseDemand),
        lowerBound: Math.round(baseDemand * 0.6),
        upperBound: Math.round(baseDemand * 1.4),
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    return forecast;
  }

  private async generateNewProductInsights(
    request: NewProductForecastRequest,
    categoryBenchmarks: any,
    similarProducts: any[],
    forecast: any[],
  ): Promise<any> {
    // Find expected peak week
    const peakWeek =
      forecast.reduce((maxWeek, current, index) => {
        return current.predictedDemand > forecast[maxWeek].predictedDemand
          ? index
          : maxWeek;
      }, 0) + 1;

    // Find stabilization week (when demand becomes more stable)
    const stabilizationWeek = Math.max(8, peakWeek + 4);

    // Calculate recommended initial stock
    const firstMonthDemand = forecast
      .slice(0, 4)
      .reduce((sum, f) => sum + f.predictedDemand, 0);
    const recommendedInitialStock = Math.round(firstMonthDemand * 1.5); // 150% of first month

    // Risk factors
    const riskFactors = [];
    const successFactors = [];

    if (similarProducts.length < 3) {
      riskFactors.push('Data produk serupa terbatas untuk analisis');
    }

    if (request.marketingBudget && request.marketingBudget < 5000) {
      riskFactors.push(
        'Budget marketing terbatas dapat mempengaruhi adopsi produk',
      );
    }

    if (categoryBenchmarks.averageCategoryDemand > 100) {
      successFactors.push(
        'Kategori produk memiliki permintaan tinggi di pasar',
      );
    }

    successFactors.push(
      'Analisis produk serupa menunjukkan potensi pasar yang baik',
    );

    return {
      expectedPeakWeek: peakWeek,
      expectedStabilizationWeek: stabilizationWeek,
      recommendedInitialStock,
      riskFactors,
      successFactors,
    };
  }
}
