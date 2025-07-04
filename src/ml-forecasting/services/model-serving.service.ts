import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as moment from 'moment-timezone';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import {
  Prediction,
  PredictionType,
  PredictionStatus,
} from '../entities/prediction.entity';
import { Product } from '../../products/entities/product.entity';
import { DataPipelineService } from './data-pipeline.service';

export interface PredictionRequest {
  modelId?: string;
  productId?: string;
  categoryId?: string;
  locationId?: string;
  predictionType: PredictionType;
  targetDate?: Date;
  forecastDays?: number;
  includeConfidenceInterval?: boolean;
  features?: Record<string, any>;
}

export interface PredictionResult {
  success: boolean;
  predictionId?: string;
  predictedValue?: number;
  confidence?: number;
  lowerBound?: number;
  upperBound?: number;
  timeSeries?: Array<{
    date: string;
    value: number;
    lowerBound?: number;
    upperBound?: number;
  }>;
  actionableInsights?: {
    recommendations?: string[];
    alerts?: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
  };
  error?: string;
}

export interface BatchPredictionRequest {
  modelId?: string;
  productIds?: string[];
  predictionType: PredictionType;
  targetDate?: Date;
  forecastDays?: number;
}

@Injectable()
export class ModelServingService {
  private readonly logger = new Logger(ModelServingService.name);
  private readonly modelCache = new Map<string, any>();

  constructor(
    @InjectRepository(MLModel)
    private mlModelRepo: Repository<MLModel>,

    @InjectRepository(Prediction)
    private predictionRepo: Repository<Prediction>,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,

    private dataPipelineService: DataPipelineService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate prediction for a single product/entity
   */
  async predict(
    tenantId: string,
    request: PredictionRequest,
  ): Promise<PredictionResult> {
    this.logger.debug(`Generating prediction for tenant ${tenantId}`);

    try {
      // Find appropriate model
      const model = await this.findBestModel(tenantId, request);

      if (!model) {
        return {
          success: false,
          error: 'No suitable model found for prediction',
        };
      }

      // Check cache for recent predictions
      const cacheKey = this.buildCacheKey(tenantId, request, model.id);
      const cached = await this.cacheManager.get<PredictionResult>(cacheKey);

      if (cached) {
        this.logger.debug('Returning cached prediction');
        return cached;
      }

      // Load model if not in memory
      const loadedModel = await this.loadModel(model);

      // Prepare features
      const features = await this.prepareFeatures(tenantId, request);

      // Generate prediction
      const predictionValue = await this.generatePrediction(
        loadedModel,
        features,
        request.forecastDays || 30,
      );

      // Calculate confidence and bounds
      const confidence = this.calculateConfidence(model, features);
      const bounds = this.calculateConfidenceBounds(
        predictionValue,
        confidence,
      );

      // Create prediction record
      const prediction = new Prediction();
      prediction.tenantId = tenantId;
      prediction.modelId = model.id;
      prediction.productId = request.productId;
      prediction.categoryId = request.categoryId;
      prediction.locationId = request.locationId;
      prediction.predictionType = request.predictionType;
      prediction.targetDate = request.targetDate || new Date();
      prediction.predictedValue = predictionValue;
      prediction.confidence = confidence;
      prediction.lowerBound = bounds.lower;
      prediction.upperBound = bounds.upper;
      prediction.forecastHorizonDays = request.forecastDays || 30;
      prediction.inputFeatures = features;
      prediction.updateConfidenceLevel();

      // Generate time series if requested
      if (request.forecastDays && request.forecastDays > 1) {
        prediction.predictionData = {
          timeSeries: await this.generateTimeSeriesForecast(
            loadedModel,
            features,
            request.forecastDays,
          ),
        };
      }

      // Generate actionable insights
      const insights = await this.generateActionableInsights(
        tenantId,
        prediction,
        model,
      );

      prediction.addActionableInsight(insights);

      // Calculate business impact
      const businessImpact = await this.calculateBusinessImpact(
        tenantId,
        prediction,
      );

      prediction.setBusinessImpact(businessImpact);

      prediction.complete();
      const savedPrediction = await this.predictionRepo.save(prediction);

      // Update model usage
      model.recordPrediction();
      await this.mlModelRepo.save(model);

      const result: PredictionResult = {
        success: true,
        predictionId: savedPrediction.id,
        predictedValue: predictionValue,
        confidence,
        lowerBound: bounds.lower,
        upperBound: bounds.upper,
        timeSeries: prediction.predictionData?.timeSeries,
        actionableInsights: insights,
      };

      // Cache result for 1 hour
      await this.cacheManager.set(cacheKey, result, 3600);

      return result;
    } catch (error) {
      this.logger.error(`Prediction failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate batch predictions for multiple products
   */
  async batchPredict(
    tenantId: string,
    request: BatchPredictionRequest,
  ): Promise<Record<string, PredictionResult>> {
    this.logger.debug(
      `Generating batch predictions for ${
        request.productIds?.length || 0
      } products`,
    );

    const results: Record<string, PredictionResult> = {};

    if (!request.productIds?.length) {
      return results;
    }

    // Process predictions in parallel
    const promises = request.productIds.map(async productId => {
      const productRequest: PredictionRequest = {
        modelId: request.modelId,
        productId,
        predictionType: request.predictionType,
        targetDate: request.targetDate,
        forecastDays: request.forecastDays,
      };

      const result = await this.predict(tenantId, productRequest);
      return { productId, result };
    });

    const batchResults = await Promise.allSettled(promises);

    for (const settled of batchResults) {
      if (settled.status === 'fulfilled') {
        const { productId, result } = settled.value;
        results[productId] = result;
      } else {
        this.logger.error(
          `Batch prediction failed for a product: ${settled.reason}`,
        );
      }
    }

    return results;
  }

  /**
   * Get demand forecast for a product
   */
  async getDemandForecast(
    tenantId: string,
    productId: string,
    days: number = 30,
  ): Promise<PredictionResult> {
    return this.predict(tenantId, {
      productId,
      predictionType: PredictionType.DEMAND_FORECAST,
      forecastDays: days,
      includeConfidenceInterval: true,
    });
  }

  /**
   * Calculate stockout risk for a product
   */
  async getStockoutRisk(
    tenantId: string,
    productId: string,
    daysAhead: number = 7,
  ): Promise<PredictionResult> {
    const targetDate = moment().add(daysAhead, 'days').toDate();

    return this.predict(tenantId, {
      productId,
      predictionType: PredictionType.STOCKOUT_RISK,
      targetDate,
      forecastDays: 1,
    });
  }

  /**
   * Get optimal reorder recommendations
   */
  async getOptimalReorder(
    tenantId: string,
    productId: string,
  ): Promise<PredictionResult> {
    return this.predict(tenantId, {
      productId,
      predictionType: PredictionType.OPTIMAL_REORDER,
      forecastDays: 1,
    });
  }

  /**
   * Validate predictions against actual values
   */
  async validatePredictions(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalPredictions: number;
    accuratePredictions: number;
    averageErrorRate: number;
    modelPerformance: Record<string, any>;
  }> {
    this.logger.debug('Validating predictions against actual values');

    const predictions = await this.predictionRepo.find({
      where: {
        tenantId,
        targetDate: { $gte: startDate, $lte: endDate } as any,
        status: PredictionStatus.COMPLETED,
      },
      relations: ['model'],
    });

    // Get actual sales data for validation
    const actualData = await this.dataPipelineService.extractSalesData(
      tenantId,
      {
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        aggregation: 'daily',
        features: ['sales'],
        target: 'quantity',
      },
    );

    // Create lookup for actual values
    const actualLookup = new Map<string, number>();
    for (const data of actualData) {
      const key = `${data.productId}_${data.date}`;
      actualLookup.set(key, data.value);
    }

    let totalPredictions = 0;
    let accuratePredictions = 0;
    let totalErrorRate = 0;
    const modelPerformance: Record<string, any> = {};

    for (const prediction of predictions) {
      const key = `${prediction.productId}_${moment(
        prediction.targetDate,
      ).format('YYYY-MM-DD')}`;
      const actualValue = actualLookup.get(key);

      if (actualValue !== undefined) {
        prediction.actualize(actualValue);
        await this.predictionRepo.save(prediction);

        totalPredictions++;
        totalErrorRate += prediction.errorRate || 0;

        if (prediction.isAccurate) {
          accuratePredictions++;
        }

        // Track model performance
        const modelId = prediction.modelId;
        if (!modelPerformance[modelId]) {
          modelPerformance[modelId] = {
            total: 0,
            accurate: 0,
            totalError: 0,
            modelType: prediction.model?.modelType,
          };
        }

        modelPerformance[modelId].total++;
        modelPerformance[modelId].totalError += prediction.errorRate || 0;

        if (prediction.isAccurate) {
          modelPerformance[modelId].accurate++;
        }
      }
    }

    // Calculate final metrics
    Object.values(modelPerformance).forEach((perf: any) => {
      perf.accuracy = perf.total > 0 ? perf.accurate / perf.total : 0;
      perf.averageError = perf.total > 0 ? perf.totalError / perf.total : 0;
    });

    return {
      totalPredictions,
      accuratePredictions,
      averageErrorRate:
        totalPredictions > 0 ? totalErrorRate / totalPredictions : 0,
      modelPerformance,
    };
  }

  // Private helper methods

  private async findBestModel(
    tenantId: string,
    request: PredictionRequest,
  ): Promise<MLModel | null> {
    const queryBuilder = this.mlModelRepo
      .createQueryBuilder('model')
      .where('model.tenantId = :tenantId', { tenantId })
      .andWhere('model.status = :status', { status: ModelStatus.DEPLOYED })
      .andWhere('model.isActive = :isActive', { isActive: true });

    // Filter by specific model if requested
    if (request.modelId) {
      queryBuilder.andWhere('model.id = :modelId', {
        modelId: request.modelId,
      });
    }

    // Filter by product/category/location
    if (request.productId) {
      queryBuilder.andWhere(
        '(model.productId = :productId OR model.productId IS NULL)',
        { productId: request.productId },
      );
    }

    if (request.categoryId) {
      queryBuilder.andWhere(
        '(model.categoryId = :categoryId OR model.categoryId IS NULL)',
        { categoryId: request.categoryId },
      );
    }

    if (request.locationId) {
      queryBuilder.andWhere(
        '(model.locationId = :locationId OR model.locationId IS NULL)',
        { locationId: request.locationId },
      );
    }

    // Order by specificity (more specific models first) and performance
    queryBuilder
      .orderBy("model.performance->'mape'", 'ASC')
      .addOrderBy('model.lastPredictionAt', 'DESC');

    const models = await queryBuilder.getMany();

    // Return the best performing model
    return models.length > 0 ? models[0] : null;
  }

  private async loadModel(model: MLModel): Promise<any> {
    const cacheKey = `model_${model.id}`;

    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey);
    }

    try {
      if (!model.modelPath || !fs.existsSync(model.modelPath)) {
        throw new Error(`Model file not found: ${model.modelPath}`);
      }

      const modelData = JSON.parse(fs.readFileSync(model.modelPath, 'utf8'));

      // Cache model for 1 hour
      this.modelCache.set(cacheKey, modelData);

      // Clean cache periodically
      setTimeout(() => {
        this.modelCache.delete(cacheKey);
      }, 3600000); // 1 hour

      return modelData;
    } catch (error) {
      this.logger.error(`Failed to load model ${model.id}: ${error.message}`);
      throw error;
    }
  }

  private async prepareFeatures(
    tenantId: string,
    request: PredictionRequest,
  ): Promise<Record<string, any>> {
    const features: Record<string, any> = {};

    // Get product features if productId is provided
    if (request.productId) {
      const productFeatures =
        await this.dataPipelineService.extractProductFeatures(tenantId, [
          request.productId,
        ]);

      if (productFeatures[request.productId]) {
        Object.assign(
          features,
          productFeatures[request.productId].productFeatures,
        );
        Object.assign(
          features,
          productFeatures[request.productId].inventoryFeatures,
        );
      }
    }

    // Add temporal features
    const targetDate = request.targetDate || new Date();
    const momentDate = moment(targetDate);

    features.dayOfWeek = momentDate.day();
    features.dayOfMonth = momentDate.date();
    features.month = momentDate.month() + 1;
    features.quarter = momentDate.quarter();
    features.isWeekend =
      momentDate.day() === 0 || momentDate.day() === 6 ? 1 : 0;
    features.isMonthEnd = momentDate.date() > 25 ? 1 : 0;
    features.isQuarterEnd =
      momentDate.month() % 3 === 2 && momentDate.date() > 25 ? 1 : 0;

    // Add any custom features from request
    if (request.features) {
      Object.assign(features, request.features);
    }

    return features;
  }

  private async generatePrediction(
    model: any,
    features: Record<string, any>,
    forecastDays: number,
  ): Promise<number> {
    switch (model.type) {
      case 'linear_regression':
        return this.predictLinearRegression(model, features);

      case 'exponential_smoothing':
        return this.predictExponentialSmoothing(model, forecastDays);

      case 'arima':
        return this.predictARIMA(model, forecastDays);

      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  }

  private predictLinearRegression(
    model: any,
    features: Record<string, any>,
  ): number {
    const featureVector = model.weights.map((weight: number, index: number) => {
      const featureValue = Object.values(features)[index] || 0;
      return weight * (typeof featureValue === 'number' ? featureValue : 0);
    });

    const prediction =
      featureVector.reduce((sum: number, val: number) => sum + val, 0) +
      model.intercept;
    return Math.max(0, prediction); // Ensure non-negative predictions
  }

  private predictExponentialSmoothing(
    model: any,
    forecastDays: number,
  ): number {
    // Use the last value from training as baseline
    const lastValue = model.lastValues[model.lastValues.length - 1] || 0;

    // Simple forecast using the smoothing parameters
    // In a real implementation, this would use the full Holt-Winters equations
    return Math.max(0, lastValue);
  }

  private predictARIMA(model: any, forecastDays: number): number {
    // Simplified ARIMA prediction
    // In production, you would use the actual ARIMA parameters and state
    const lastValues = model.lastValues || [0];
    const lastValue = lastValues[lastValues.length - 1] || 0;

    return Math.max(0, lastValue);
  }

  private calculateConfidence(
    model: MLModel,
    features: Record<string, any>,
  ): number {
    // Base confidence on model performance
    const baseConfidence = model.performance
      ? 1 - model.performance.mape / 100
      : 0.5;

    // Adjust confidence based on feature completeness
    const expectedFeatures = model.trainingConfig?.features?.length || 1;
    const providedFeatures = Object.keys(features).length;
    const featureCompleteness = Math.min(
      1,
      providedFeatures / expectedFeatures,
    );

    // Adjust confidence based on model age
    const ageAdjustment = Math.max(0.7, 1 - model.modelAge / 365); // Reduce confidence for old models

    return Math.max(
      0.1,
      Math.min(1, baseConfidence * featureCompleteness * ageAdjustment),
    );
  }

  private calculateConfidenceBounds(
    prediction: number,
    confidence: number,
  ): { lower: number; upper: number } {
    // Calculate bounds based on confidence level
    const errorMargin = prediction * (1 - confidence) * 0.5;

    return {
      lower: Math.max(0, prediction - errorMargin),
      upper: prediction + errorMargin,
    };
  }

  private async generateTimeSeriesForecast(
    model: any,
    features: Record<string, any>,
    days: number,
  ): Promise<
    Array<{
      date: string;
      value: number;
      lowerBound?: number;
      upperBound?: number;
    }>
  > {
    const timeSeries = [];
    const baseDate = moment();

    for (let i = 0; i < days; i++) {
      const date = baseDate.clone().add(i, 'days');

      // Generate prediction for this date
      const dayFeatures = {
        ...features,
        dayOfWeek: date.day(),
        dayOfMonth: date.date(),
        month: date.month() + 1,
        quarter: date.quarter(),
        isWeekend: date.day() === 0 || date.day() === 6 ? 1 : 0,
      };

      const value = await this.generatePrediction(model, dayFeatures, 1);
      const confidence = this.calculateConfidence(
        { performance: { mape: 10 } } as any,
        dayFeatures,
      );
      const bounds = this.calculateConfidenceBounds(value, confidence);

      timeSeries.push({
        date: date.format('YYYY-MM-DD'),
        value,
        lowerBound: bounds.lower,
        upperBound: bounds.upper,
      });
    }

    return timeSeries;
  }

  private async generateActionableInsights(
    tenantId: string,
    prediction: Prediction,
    model: MLModel,
  ): Promise<{
    recommendations?: string[];
    alerts?: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
  }> {
    const insights: any = {
      recommendations: [],
      alerts: [],
    };

    // Generate insights based on prediction type
    switch (prediction.predictionType) {
      case PredictionType.DEMAND_FORECAST:
        await this.generateDemandForecastInsights(
          tenantId,
          prediction,
          insights,
        );
        break;

      case PredictionType.STOCKOUT_RISK:
        await this.generateStockoutRiskInsights(tenantId, prediction, insights);
        break;

      case PredictionType.OPTIMAL_REORDER:
        await this.generateReorderInsights(tenantId, prediction, insights);
        break;
    }

    // Add confidence-based insights
    if (prediction.confidence < 0.7) {
      insights.alerts.push({
        type: 'low_confidence',
        severity: 'medium',
        message:
          'Prediksi memiliki tingkat kepercayaan rendah. Pertimbangkan untuk mengumpulkan lebih banyak data.',
      });
    }

    return insights;
  }

  private async generateDemandForecastInsights(
    tenantId: string,
    prediction: Prediction,
    insights: any,
  ): Promise<void> {
    const predictedDemand = prediction.predictedValue;

    // Get current inventory
    if (prediction.productId) {
      const currentStock = await this.getCurrentStock(
        tenantId,
        prediction.productId,
      );

      if (currentStock < predictedDemand) {
        const shortage = predictedDemand - currentStock;
        insights.alerts.push({
          type: 'stock_shortage',
          severity: shortage > predictedDemand * 0.5 ? 'critical' : 'high',
          message: `Stok saat ini (${currentStock}) tidak mencukupi untuk memenuhi prediksi permintaan (${predictedDemand.toFixed(
            0,
          )}). Kekurangan: ${shortage.toFixed(0)} unit.`,
        });

        insights.recommendations.push(
          `Segera lakukan restok untuk ${Math.ceil(
            shortage,
          )} unit untuk memenuhi prediksi permintaan.`,
        );
      }
    }

    // Seasonal insights
    if (prediction.predictionData?.seasonalComponents) {
      insights.recommendations.push(
        'Perhatikan pola musiman dalam perencanaan stok.',
      );
    }
  }

  private async generateStockoutRiskInsights(
    tenantId: string,
    prediction: Prediction,
    insights: any,
  ): Promise<void> {
    const riskScore = prediction.predictedValue;

    if (riskScore > 0.7) {
      insights.alerts.push({
        type: 'high_stockout_risk',
        severity: 'critical',
        message: `Risiko kehabisan stok sangat tinggi (${(
          riskScore * 100
        ).toFixed(0)}%). Tindakan segera diperlukan.`,
      });

      insights.recommendations.push(
        'Segera lakukan pemesanan darurat untuk mencegah kehabisan stok.',
      );
    } else if (riskScore > 0.4) {
      insights.alerts.push({
        type: 'medium_stockout_risk',
        severity: 'medium',
        message: `Risiko kehabisan stok sedang (${(riskScore * 100).toFixed(
          0,
        )}%). Pertimbangkan untuk melakukan restok.`,
      });
    }
  }

  private async generateReorderInsights(
    tenantId: string,
    prediction: Prediction,
    insights: any,
  ): Promise<void> {
    const optimalQuantity = prediction.predictedValue;

    insights.recommendations.push(
      `Jumlah pemesanan optimal: ${Math.ceil(optimalQuantity)} unit.`,
    );

    if (optimalQuantity > 1000) {
      insights.recommendations.push(
        'Pertimbangkan untuk bernegosiasi diskon volume dengan pemasok.',
      );
    }
  }

  private async calculateBusinessImpact(
    tenantId: string,
    prediction: Prediction,
  ): Promise<{
    revenueImpact?: number;
    costImpact?: number;
    stockoutRisk?: number;
    overstockRisk?: number;
  }> {
    const impact: any = {};

    if (prediction.productId) {
      const product = await this.productRepo.findOne({
        where: { id: prediction.productId, tenantId },
      });

      if (product) {
        // Calculate revenue impact
        impact.revenueImpact = prediction.predictedValue * product.sellingPrice;

        // Calculate cost impact
        impact.costImpact = prediction.predictedValue * product.costPrice;

        // Simple risk calculations
        const currentStock = await this.getCurrentStock(
          tenantId,
          prediction.productId,
        );
        const demandRatio = currentStock / (prediction.predictedValue || 1);

        impact.stockoutRisk =
          demandRatio < 0.5 ? 0.8 : demandRatio < 1 ? 0.4 : 0.1;
        impact.overstockRisk =
          demandRatio > 3 ? 0.7 : demandRatio > 2 ? 0.3 : 0.1;
      }
    }

    return impact;
  }

  private async getCurrentStock(
    tenantId: string,
    productId: string,
  ): Promise<number> {
    // This would query the inventory system for current stock levels
    // Simplified implementation
    return 100; // Placeholder
  }

  private buildCacheKey(
    tenantId: string,
    request: PredictionRequest,
    modelId: string,
  ): string {
    const keyParts = [
      tenantId,
      modelId,
      request.productId || 'all',
      request.predictionType,
      request.targetDate?.toISOString().split('T')[0] || 'now',
      request.forecastDays || 1,
    ];

    return `prediction_${keyParts.join('_')}`;
  }
}
