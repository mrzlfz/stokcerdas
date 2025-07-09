import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import moment from 'moment-timezone';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import { Prediction, PredictionType } from '../entities/prediction.entity';
import { PythonBridgeService, MLDataRequest } from './python-bridge.service';
import {
  DataPreprocessingService,
  TimeSeriesDataset,
} from './data-preprocessing.service';
import {
  ModelSelectionService,
  PredictionRequest,
  ModelRecommendation,
} from './model-selection.service';
import { IndonesianBusinessCalendarService } from './indonesian-business-calendar.service';

/**
 * PHASE 3.1: Ensemble Model Service 🤖
 *
 * Advanced ensemble modeling service yang mengkombinasikan multiple base models
 * (ARIMA, Prophet, XGBoost) menjadi sophisticated ensemble predictions dengan
 * weighted averaging, stacking, dan blending techniques untuk optimal accuracy.
 */

export interface EnsembleModelRequest {
  tenantId: string;
  productId?: string;
  categoryId?: string;
  locationId?: string;
  timeHorizon: '7d' | '30d' | '90d';
  ensembleMethod: EnsembleMethod;
  optimizationStrategy: OptimizationStrategy;
  includeBaseModelAnalysis: boolean;
  customWeights?: ModelWeights;
}

export interface EnsembleMethod {
  type:
    | 'weighted_average'
    | 'stacking'
    | 'blending'
    | 'voting'
    | 'meta_learning';
  weightsOptimization:
    | 'validation_accuracy'
    | 'cross_validation'
    | 'bayesian_optimization'
    | 'custom';
  stackingLevel?: number; // For hierarchical stacking
  metaLearnerType?: 'linear_regression' | 'random_forest' | 'gradient_boosting';
}

export interface OptimizationStrategy {
  validationSplit: number; // 0.2 = 20% for validation
  crossValidationFolds: number;
  hyperparameterTuning: boolean;
  autoFeatureSelection: boolean;
  regularization: boolean;
  robustnessChecks: boolean;
}

export interface ModelWeights {
  [ModelType.ARIMA]: number;
  [ModelType.PROPHET]: number;
  [ModelType.XGBOOST]: number;
  custom_models?: Record<string, number>;
}

export interface BaseModelResult {
  modelId: string;
  modelType: ModelType;
  prediction: number[];
  confidence: number[];
  accuracy: ModelAccuracy;
  performance: ModelPerformance;
  metadata: BaseModelMetadata;
}

export interface ModelAccuracy {
  mape: number;
  mae: number;
  rmse: number;
  r_squared: number;
  directional_accuracy: number;
  bias: number;
  symmetric_mape: number;
}

export interface ModelPerformance {
  trainingTime: number;
  predictionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  convergenceSteps?: number;
  featureImportance?: Record<string, number>;
}

export interface BaseModelMetadata {
  hyperparameters: Record<string, any>;
  featureCount: number;
  trainingDataSize: number;
  validationScore: number;
  crossValidationScores: number[];
  robustnessScore: number;
  historicalPredictions?: number[];
  historicalActuals?: number[];
  featureImportance?: Record<string, number>;
}

export interface EnsembleModelResult {
  ensembleModelId: string;
  tenantId: string;
  createdAt: Date;

  // Ensemble configuration
  ensembleMethod: EnsembleMethod;
  optimizationStrategy: OptimizationStrategy;
  finalWeights: ModelWeights;

  // Base models
  baseModels: BaseModelResult[];
  baseModelCount: number;

  // Ensemble performance
  ensembleAccuracy: ModelAccuracy;
  improvementOverBest: number;
  ensembleConfidence: number;
  robustnessScore: number;

  // Predictions
  ensemblePrediction: number[];
  predictionIntervals: PredictionInterval[];

  // Analysis
  modelContributions: ModelContribution[];
  diversityMetrics: DiversityMetrics;
  stabilityAnalysis: StabilityAnalysis;

  // Business insights
  businessRecommendations: EnsembleRecommendation[];
  riskAssessment: EnsembleRiskAssessment;

  // Optimization results
  optimizationHistory: OptimizationStep[];
  convergenceAnalysis: ConvergenceAnalysis;
}

export interface PredictionInterval {
  step: number;
  date: Date;
  point_forecast: number;
  lower_bound_80: number;
  upper_bound_80: number;
  lower_bound_95: number;
  upper_bound_95: number;
  uncertainty: number;
}

export interface ModelContribution {
  modelType: ModelType;
  weight: number;
  individualPrediction: number[];
  contributionToEnsemble: number[];
  relativeImportance: number;
  strengths: string[];
  weaknesses: string[];
}

export interface DiversityMetrics {
  correlationMatrix: Record<string, Record<string, number>>;
  disagreementIndex: number;
  diversityScore: number;
  pairwiseDiversity: Record<string, number>;
  ensembleRichness: number;
}

export interface StabilityAnalysis {
  stabilityScore: number;
  varianceAnalysis: VarianceDecomposition;
  sensitivityToOutliers: number;
  robustnessToNoise: number;
  temporalStability: TemporalStability[];
}

export interface VarianceDecomposition {
  totalVariance: number;
  modelVariance: number;
  dataVariance: number;
  biasSquared: number;
  irreducibleError: number;
}

export interface TemporalStability {
  timeWindow: string;
  stabilityScore: number;
  varianceRatio: number;
  driftDetected: boolean;
}

export interface EnsembleRecommendation {
  type:
    | 'model_weighting'
    | 'feature_engineering'
    | 'data_quality'
    | 'hyperparameter'
    | 'ensemble_method';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  expectedImprovement: number;
  implementationComplexity: 'easy' | 'medium' | 'hard';
  businessImpact: string;
}

export interface EnsembleRiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  uncertaintyQuantification: UncertaintyQuantification;
}

export interface RiskFactor {
  factor: string;
  riskLevel: 'low' | 'medium' | 'high';
  probability: number;
  impact: string;
  description: string;
}

export interface MitigationStrategy {
  riskFactor: string;
  strategy: string;
  effectiveness: number;
  implementationCost: 'low' | 'medium' | 'high';
}

export interface UncertaintyQuantification {
  epistemic_uncertainty: number; // Model uncertainty
  aleatoric_uncertainty: number; // Data uncertainty
  total_uncertainty: number;
  confidence_regions: ConfidenceRegion[];
}

export interface ConfidenceRegion {
  confidence_level: number;
  lower_bound: number[];
  upper_bound: number[];
  width: number[];
}

export interface OptimizationStep {
  step: number;
  weights: ModelWeights;
  validationScore: number;
  improvementFromPrevious: number;
  optimizationMethod: string;
  convergenceCriteria: ConvergenceCriteria;
}

export interface ConvergenceCriteria {
  tolerance: number;
  maxIterations: number;
  earlyStoppingRounds: number;
  improvementThreshold: number;
}

export interface ConvergenceAnalysis {
  converged: boolean;
  finalIteration: number;
  finalTolerance: number;
  improvementHistory: number[];
  convergenceTime: number;
  stabilityPeriod: number;
}

@Injectable()
export class EnsembleModelService {
  private readonly logger = new Logger(EnsembleModelService.name);

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepository: Repository<MLModel>,
    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
    private readonly pythonBridgeService: PythonBridgeService,
    private readonly dataPreprocessingService: DataPreprocessingService,
    private readonly modelSelectionService: ModelSelectionService,
    private readonly indonesianBusinessCalendarService: IndonesianBusinessCalendarService,
  ) {}

  /**
   * Main method untuk create ensemble model dari multiple base models
   */
  async createEnsembleModel(
    request: EnsembleModelRequest,
  ): Promise<EnsembleModelResult> {
    this.logger.log(
      `Starting ensemble model creation for tenant ${request.tenantId}`,
    );

    try {
      // 1. Prepare training data
      const dataset = await this.prepareEnsembleData(request);

      // 2. Train base models
      const baseModels = await this.trainBaseModels(dataset, request);

      if (baseModels.length < 2) {
        throw new Error('Ensemble requires at least 2 successful base models');
      }

      // 3. Optimize ensemble weights
      const optimizationResult = await this.optimizeEnsembleWeights(
        baseModels,
        dataset,
        request,
      );

      // 4. Generate ensemble predictions
      const ensemblePredictions = await this.generateEnsemblePredictions(
        baseModels,
        optimizationResult.finalWeights,
        request,
      );

      // 5. Analyze ensemble performance
      const performanceAnalysis = await this.analyzeEnsemblePerformance(
        baseModels,
        ensemblePredictions,
        dataset,
        request,
      );

      // 6. Generate business insights
      const businessInsights = await this.generateBusinessInsights(
        baseModels,
        performanceAnalysis,
        request,
      );

      // 7. Save ensemble model
      const ensembleModel = await this.saveEnsembleModel(
        baseModels,
        optimizationResult,
        performanceAnalysis,
        businessInsights,
        request,
      );

      // 8. Emit completion event
      this.eventEmitter.emit('ensemble.model.created', {
        tenantId: request.tenantId,
        ensembleModelId: ensembleModel.ensembleModelId,
        baseModelCount: baseModels.length,
        accuracy: performanceAnalysis.ensembleAccuracy.mape,
        improvement: performanceAnalysis.improvementOverBest,
      });

      this.logger.log(
        `Ensemble model created successfully: ${ensembleModel.ensembleModelId}`,
      );

      return ensembleModel;
    } catch (error) {
      this.logger.error(
        `Ensemble model creation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate predictions menggunakan existing ensemble model
   */
  async generateEnsemblePrediction(
    ensembleModelId: string,
    request: PredictionRequest,
    tenantId: string,
  ): Promise<EnsembleModelResult> {
    this.logger.log(
      `Generating ensemble prediction for model ${ensembleModelId}`,
    );

    try {
      // 1. Load ensemble model
      const ensembleModel = await this.loadEnsembleModel(
        ensembleModelId,
        tenantId,
      );

      if (!ensembleModel) {
        throw new Error(`Ensemble model ${ensembleModelId} not found`);
      }

      // 2. Prepare prediction data
      const dataset = await this.preparePredictionData(request, tenantId);

      // 3. Generate base model predictions
      const baseModelPredictions = await this.generateBaseModelPredictions(
        ensembleModel.baseModels,
        dataset,
        request,
      );

      // 4. Combine using ensemble weights
      const ensemblePrediction = await this.combineBasePredictions(
        baseModelPredictions,
        ensembleModel.finalWeights,
        ensembleModel.ensembleMethod,
      );

      // 5. Calculate prediction confidence
      const confidenceAnalysis = await this.calculatePredictionConfidence(
        baseModelPredictions,
        ensemblePrediction,
        ensembleModel,
      );

      // 6. Save prediction results
      await this.savePredictionResults(
        ensemblePrediction,
        confidenceAnalysis,
        request,
        tenantId,
      );

      return {
        ...ensembleModel,
        ensemblePrediction: ensemblePrediction.predictions,
        predictionIntervals: ensemblePrediction.intervals,
        ensembleConfidence: confidenceAnalysis.overallConfidence,
      };
    } catch (error) {
      this.logger.error(
        `Ensemble prediction failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Prepare data untuk ensemble training
   */
  private async prepareEnsembleData(
    request: EnsembleModelRequest,
  ): Promise<TimeSeriesDataset> {
    this.logger.debug('Preparing ensemble training data');

    // Get historical data with extended window for ensemble training
    const historicalPeriod = this.calculateHistoricalPeriod(
      request.timeHorizon,
    );

    const dataset = await this.dataPreprocessingService.prepareTimeSeriesData(
      request.productId || 'ensemble',
      request.tenantId,
      historicalPeriod,
    );

    // Enhance with ensemble-specific features
    return this.enhanceDatasetForEnsemble(dataset, request);
  }

  /**
   * Train multiple base models untuk ensemble
   */
  private async trainBaseModels(
    dataset: TimeSeriesDataset,
    request: EnsembleModelRequest,
  ): Promise<BaseModelResult[]> {
    this.logger.debug('Training base models for ensemble');

    const baseModels: BaseModelResult[] = [];
    const modelTypes = [ModelType.ARIMA, ModelType.PROPHET, ModelType.XGBOOST];

    // Train each base model type
    for (const modelType of modelTypes) {
      try {
        const baseModel = await this.trainSingleBaseModel(
          modelType,
          dataset,
          request,
        );

        if (baseModel && this.validateBaseModel(baseModel)) {
          baseModels.push(baseModel);
          this.logger.debug(
            `Base model ${modelType} trained successfully with MAPE: ${baseModel.accuracy.mape.toFixed(
              2,
            )}%`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Base model ${modelType} training failed: ${error.message}`,
        );
      }
    }

    return baseModels;
  }

  /**
   * Train single base model
   */
  private async trainSingleBaseModel(
    modelType: ModelType,
    dataset: TimeSeriesDataset,
    request: EnsembleModelRequest,
  ): Promise<BaseModelResult> {
    const { trainData, validationData } = this.splitDataForEnsemble(
      dataset,
      request.optimizationStrategy.validationSplit,
    );

    // Prepare ML data request with ensemble-specific optimizations
    const mlDataRequest: MLDataRequest = {
      data_points: trainData.map(d => d.value),
      dates: trainData.map(d => d.date),
      forecast_steps: validationData.length,
      seasonal: dataset.metadata.has_seasonality,
      confidence_level: 0.95,
      indonesian_context: {
        include_ramadan: true,
        include_lebaran: true,
        include_holidays: true,
        business_type: 'retail',
        location: 'jakarta',
      },
      // Special configuration for ensemble training
      // Note: hyperparameter tuning handled separately in training pipeline
    };

    // Execute model training based on type
    let modelResult: any;
    const startTime = Date.now();

    switch (modelType) {
      case ModelType.ARIMA:
        modelResult = await this.pythonBridgeService.executeARIMA(
          mlDataRequest,
        );
        break;
      case ModelType.PROPHET:
        modelResult = await this.pythonBridgeService.executeProphet(
          mlDataRequest,
        );
        break;
      case ModelType.XGBOOST:
        modelResult = await this.pythonBridgeService.executeXGBoost(
          mlDataRequest,
        );
        break;
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }

    if (!modelResult || !modelResult.success) {
      throw new Error(`Model ${modelType} training failed`);
    }

    const executionTime = Date.now() - startTime;

    // Calculate accuracy metrics against validation data
    const predictions = modelResult.forecasts.map(f => f.forecast);
    const actuals = validationData.map(d => d.value);
    const confidence = modelResult.forecasts.map(f => f.confidence || 0.95);

    return {
      modelId: `${modelType}_${Date.now()}`,
      modelType,
      prediction: predictions,
      confidence,
      accuracy: this.calculateModelAccuracy(actuals, predictions),
      performance: {
        trainingTime: modelResult.performance?.training_time || 0,
        predictionTime: executionTime,
        memoryUsage: modelResult.performance?.memory_usage || 0,
        cpuUsage: modelResult.performance?.cpu_usage || 0,
        convergenceSteps: modelResult.performance?.convergence_steps,
        featureImportance: modelResult.feature_importance,
      },
      metadata: {
        hyperparameters: modelResult.hyperparameters || {},
        featureCount: modelResult.feature_count || 0,
        trainingDataSize: trainData.length,
        validationScore: modelResult.validation_score || 0,
        crossValidationScores: modelResult.cv_scores || [],
        robustnessScore: modelResult.robustness_score || 0,
      },
    };
  }

  /**
   * Optimize ensemble weights using different strategies
   */
  private async optimizeEnsembleWeights(
    baseModels: BaseModelResult[],
    dataset: TimeSeriesDataset,
    request: EnsembleModelRequest,
  ): Promise<{
    finalWeights: ModelWeights;
    optimizationHistory: OptimizationStep[];
    convergenceAnalysis: ConvergenceAnalysis;
  }> {
    this.logger.debug('Optimizing ensemble weights');

    // Initialize weights based on model performance
    let currentWeights = this.initializeWeights(
      baseModels,
      request.customWeights,
    );
    const optimizationHistory: OptimizationStep[] = [];

    // Set up optimization parameters
    const convergenceCriteria: ConvergenceCriteria = {
      tolerance: 0.001,
      maxIterations: 100,
      earlyStoppingRounds: 10,
      improvementThreshold: 0.0001,
    };

    let bestScore = Infinity;
    let bestWeights = { ...currentWeights };
    let noImprovementCount = 0;
    let converged = false;

    const startTime = Date.now();

    // Optimization loop
    for (
      let iteration = 0;
      iteration < convergenceCriteria.maxIterations;
      iteration++
    ) {
      // Generate ensemble prediction with current weights
      const ensemblePrediction = this.combineBasePredictionsWeighted(
        baseModels,
        currentWeights,
      );

      // Calculate validation score
      const validationScore = this.calculateValidationScore(
        ensemblePrediction,
        dataset,
        request.optimizationStrategy,
      );

      // Check for improvement
      const improvement = bestScore - validationScore;
      if (improvement > convergenceCriteria.improvementThreshold) {
        bestScore = validationScore;
        bestWeights = { ...currentWeights };
        noImprovementCount = 0;
      } else {
        noImprovementCount++;
      }

      // Record optimization step
      optimizationHistory.push({
        step: iteration,
        weights: { ...currentWeights },
        validationScore,
        improvementFromPrevious: improvement,
        optimizationMethod: request.ensembleMethod.weightsOptimization,
        convergenceCriteria,
      });

      // Check convergence
      if (
        improvement < convergenceCriteria.tolerance ||
        noImprovementCount >= convergenceCriteria.earlyStoppingRounds
      ) {
        converged = true;
        this.logger.debug(`Optimization converged at iteration ${iteration}`);
        break;
      }

      // Update weights based on optimization strategy
      currentWeights = await this.updateWeights(
        currentWeights,
        baseModels,
        validationScore,
        request.ensembleMethod.weightsOptimization,
      );
    }

    const optimizationTime = Date.now() - startTime;

    return {
      finalWeights: bestWeights,
      optimizationHistory,
      convergenceAnalysis: {
        converged,
        finalIteration: optimizationHistory.length,
        finalTolerance: Math.abs(
          optimizationHistory[optimizationHistory.length - 1]
            ?.improvementFromPrevious || 0,
        ),
        improvementHistory: optimizationHistory.map(
          step => step.improvementFromPrevious,
        ),
        convergenceTime: optimizationTime,
        stabilityPeriod: this.calculateStabilityPeriod(optimizationHistory),
      },
    };
  }

  /**
   * Generate ensemble predictions
   */
  private async generateEnsemblePredictions(
    baseModels: BaseModelResult[],
    weights: ModelWeights,
    request: EnsembleModelRequest,
  ): Promise<{
    predictions: number[];
    intervals: PredictionInterval[];
  }> {
    this.logger.debug('Generating ensemble predictions');

    // Combine base model predictions using weights
    const combinedPredictions = this.combineBasePredictionsWeighted(
      baseModels,
      weights,
    );

    // Generate prediction intervals
    const intervals = await this.generatePredictionIntervals(
      baseModels,
      combinedPredictions,
      weights,
      request,
    );

    return {
      predictions: combinedPredictions,
      intervals,
    };
  }

  /**
   * Analyze ensemble performance comprehensively
   */
  private async analyzeEnsemblePerformance(
    baseModels: BaseModelResult[],
    ensemblePredictions: {
      predictions: number[];
      intervals: PredictionInterval[];
    },
    dataset: TimeSeriesDataset,
    request: EnsembleModelRequest,
  ): Promise<{
    ensembleAccuracy: ModelAccuracy;
    improvementOverBest: number;
    ensembleConfidence: number;
    robustnessScore: number;
    modelContributions: ModelContribution[];
    diversityMetrics: DiversityMetrics;
    stabilityAnalysis: StabilityAnalysis;
  }> {
    this.logger.debug('Analyzing ensemble performance');

    // Get validation data for accuracy calculation
    const { validationData } = this.splitDataForEnsemble(dataset, 0.2);
    const actualValues = validationData.map(d => d.value);

    // Calculate ensemble accuracy
    const ensembleAccuracy = this.calculateModelAccuracy(
      actualValues,
      ensemblePredictions.predictions,
    );

    // Find best base model for comparison
    const bestBaseModel = baseModels.reduce((best, current) =>
      current.accuracy.mape < best.accuracy.mape ? current : best,
    );

    const improvementOverBest =
      ((bestBaseModel.accuracy.mape - ensembleAccuracy.mape) /
        bestBaseModel.accuracy.mape) *
      100;

    // Calculate model contributions
    const modelContributions = await this.calculateModelContributions(
      baseModels,
      ensemblePredictions.predictions,
      request,
    );

    // Calculate diversity metrics
    const diversityMetrics = this.calculateDiversityMetrics(baseModels);

    // Analyze stability
    const stabilityAnalysis = await this.analyzeEnsembleStability(
      baseModels,
      ensemblePredictions.predictions,
      dataset,
    );

    // Calculate overall confidence
    const ensembleConfidence = this.calculateEnsembleConfidence(
      baseModels,
      ensembleAccuracy,
      diversityMetrics,
    );

    return {
      ensembleAccuracy,
      improvementOverBest,
      ensembleConfidence,
      robustnessScore: stabilityAnalysis.stabilityScore,
      modelContributions,
      diversityMetrics,
      stabilityAnalysis,
    };
  }

  /**
   * Generate comprehensive business insights
   */
  private async generateBusinessInsights(
    baseModels: BaseModelResult[],
    performanceAnalysis: any,
    request: EnsembleModelRequest,
  ): Promise<{
    businessRecommendations: EnsembleRecommendation[];
    riskAssessment: EnsembleRiskAssessment;
  }> {
    this.logger.debug('Generating business insights');

    // Generate recommendations
    const businessRecommendations = await this.generateEnsembleRecommendations(
      baseModels,
      performanceAnalysis,
      request,
    );

    // Assess risks
    const riskAssessment = await this.assessEnsembleRisks(
      baseModels,
      performanceAnalysis,
      request,
    );

    return {
      businessRecommendations,
      riskAssessment,
    };
  }

  /**
   * Save ensemble model to database
   */
  private async saveEnsembleModel(
    baseModels: BaseModelResult[],
    optimizationResult: any,
    performanceAnalysis: any,
    businessInsights: any,
    request: EnsembleModelRequest,
  ): Promise<EnsembleModelResult> {
    this.logger.debug('Saving ensemble model to database');

    const ensembleModelId = `ensemble_${Date.now()}`;

    // Create ML model entity
    const mlModel = this.mlModelRepository.create({
      tenantId: request.tenantId,
      modelType: ModelType.ENSEMBLE,
      name: `Ensemble-${ensembleModelId}`,
      status: ModelStatus.TRAINED,
      accuracy: performanceAnalysis.ensembleAccuracy.mape / 100, // Convert to 0-1 scale
      hyperparameters: {
        ensemble_method: request.ensembleMethod,
        optimization_strategy: request.optimizationStrategy,
        base_models: baseModels.map(m => ({
          type: m.modelType,
          model_id: m.modelId,
          accuracy: m.accuracy,
        })),
      },
      configuration: {
        ensemble_weights: optimizationResult.finalWeights,
        base_model_count: baseModels.length,
        improvement_over_best: performanceAnalysis.improvementOverBest,
        diversity_score: performanceAnalysis.diversityMetrics.diversityScore,
      },
      trainedAt: new Date(),
    });

    await this.mlModelRepository.save(mlModel);

    // Return complete ensemble model result
    return {
      ensembleModelId,
      tenantId: request.tenantId,
      createdAt: new Date(),
      ensembleMethod: request.ensembleMethod,
      optimizationStrategy: request.optimizationStrategy,
      finalWeights: optimizationResult.finalWeights,
      baseModels,
      baseModelCount: baseModels.length,
      ensembleAccuracy: performanceAnalysis.ensembleAccuracy,
      improvementOverBest: performanceAnalysis.improvementOverBest,
      ensembleConfidence: performanceAnalysis.ensembleConfidence,
      robustnessScore: performanceAnalysis.robustnessScore,
      ensemblePrediction: [], // Will be populated during prediction
      predictionIntervals: [], // Will be populated during prediction
      modelContributions: performanceAnalysis.modelContributions,
      diversityMetrics: performanceAnalysis.diversityMetrics,
      stabilityAnalysis: performanceAnalysis.stabilityAnalysis,
      businessRecommendations: businessInsights.businessRecommendations,
      riskAssessment: businessInsights.riskAssessment,
      optimizationHistory: optimizationResult.optimizationHistory,
      convergenceAnalysis: optimizationResult.convergenceAnalysis,
    };
  }

  // Helper methods (sampling of key calculations)

  private calculateModelAccuracy(
    actual: number[],
    predicted: number[],
  ): ModelAccuracy {
    if (actual.length !== predicted.length || actual.length === 0) {
      throw new Error('Invalid data for accuracy calculation');
    }

    const n = actual.length;
    let sumAPE = 0;
    let sumAE = 0;
    let sumSE = 0;
    let correctDirection = 0;
    let sumActual = 0;
    let sumPredicted = 0;

    for (let i = 0; i < n; i++) {
      const actualVal = actual[i];
      const predictedVal = predicted[i];

      // MAPE (Mean Absolute Percentage Error)
      if (actualVal !== 0) {
        sumAPE += Math.abs((actualVal - predictedVal) / actualVal);
      }

      // MAE (Mean Absolute Error)
      sumAE += Math.abs(actualVal - predictedVal);

      // RMSE (Root Mean Square Error)
      sumSE += Math.pow(actualVal - predictedVal, 2);

      // Directional Accuracy
      if (i > 0) {
        const actualDirection = actual[i] - actual[i - 1];
        const predictedDirection = predicted[i] - predicted[i - 1];
        if (actualDirection * predictedDirection > 0) {
          correctDirection++;
        }
      }

      sumActual += actualVal;
      sumPredicted += predictedVal;
    }

    const mape = (sumAPE / n) * 100;
    const mae = sumAE / n;
    const rmse = Math.sqrt(sumSE / n);
    const directionalAccuracy = correctDirection / (n - 1);

    // Calculate R-squared
    const actualMean = sumActual / n;
    let totalSumSquares = 0;
    let residualSumSquares = 0;

    for (let i = 0; i < n; i++) {
      totalSumSquares += Math.pow(actual[i] - actualMean, 2);
      residualSumSquares += Math.pow(actual[i] - predicted[i], 2);
    }

    const rSquared =
      totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 0;

    // Calculate bias
    const bias = (sumPredicted - sumActual) / n;

    // Symmetric MAPE
    let sumSMAPE = 0;
    for (let i = 0; i < n; i++) {
      const denominator = (Math.abs(actual[i]) + Math.abs(predicted[i])) / 2;
      if (denominator > 0) {
        sumSMAPE += Math.abs(actual[i] - predicted[i]) / denominator;
      }
    }
    const symmetricMape = (sumSMAPE / n) * 100;

    return {
      mape,
      mae,
      rmse,
      r_squared: rSquared,
      directional_accuracy: directionalAccuracy,
      bias,
      symmetric_mape: symmetricMape,
    };
  }

  private initializeWeights(
    baseModels: BaseModelResult[],
    customWeights?: ModelWeights,
  ): ModelWeights {
    if (customWeights) {
      return this.normalizeWeights(customWeights);
    }

    // Initialize weights based on inverse of MAPE (better models get higher weights)
    const inverseMapes = baseModels.map(model => 1 / (model.accuracy.mape + 1));
    const totalInverseMape = inverseMapes.reduce((sum, val) => sum + val, 0);

    const weights: ModelWeights = {
      [ModelType.ARIMA]: 0,
      [ModelType.PROPHET]: 0,
      [ModelType.XGBOOST]: 0,
    };

    baseModels.forEach((model, index) => {
      weights[model.modelType] = inverseMapes[index] / totalInverseMape;
    });

    return weights;
  }

  private normalizeWeights(weights: ModelWeights): ModelWeights {
    const total = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    if (total === 0) {
      // Equal weights if all are zero
      const equalWeight = 1 / Object.keys(weights).length;
      return Object.keys(weights).reduce((normalized, key) => {
        normalized[key] = equalWeight;
        return normalized;
      }, {} as ModelWeights);
    }

    // Normalize to sum to 1
    return Object.keys(weights).reduce((normalized, key) => {
      normalized[key] = weights[key] / total;
      return normalized;
    }, {} as ModelWeights);
  }

  private combineBasePredictionsWeighted(
    baseModels: BaseModelResult[],
    weights: ModelWeights,
  ): number[] {
    if (baseModels.length === 0) {
      return [];
    }

    const predictionLength = baseModels[0].prediction.length;
    const combinedPredictions: number[] = new Array(predictionLength).fill(0);

    baseModels.forEach(model => {
      const weight = weights[model.modelType] || 0;

      for (let i = 0; i < predictionLength; i++) {
        combinedPredictions[i] += model.prediction[i] * weight;
      }
    });

    return combinedPredictions;
  }

  private calculateValidationScore(
    predictions: number[],
    dataset: TimeSeriesDataset,
    strategy: OptimizationStrategy,
  ): number {
    // Get validation portion of dataset
    const { validationData } = this.splitDataForEnsemble(
      dataset,
      strategy.validationSplit,
    );
    const actualValues = validationData.map(d => d.value);

    if (predictions.length !== actualValues.length) {
      throw new Error('Prediction and actual lengths do not match');
    }

    // Calculate MAPE as validation score (lower is better)
    let sumAPE = 0;
    let count = 0;

    for (let i = 0; i < actualValues.length; i++) {
      if (actualValues[i] !== 0) {
        sumAPE += Math.abs(
          (actualValues[i] - predictions[i]) / actualValues[i],
        );
        count++;
      }
    }

    return count > 0 ? (sumAPE / count) * 100 : 100;
  }

  private async updateWeights(
    currentWeights: ModelWeights,
    baseModels: BaseModelResult[],
    currentScore: number,
    optimizationMethod: string,
  ): Promise<ModelWeights> {
    // Simple gradient-based weight update
    const learningRate = 0.01;
    const newWeights = { ...currentWeights };

    // Calculate gradients based on individual model performance
    baseModels.forEach(model => {
      const modelPerformanceScore = model.accuracy.mape;
      const gradient = modelPerformanceScore - currentScore;

      // Update weight (move towards better performing models)
      newWeights[model.modelType] = Math.max(
        0,
        newWeights[model.modelType] - learningRate * gradient,
      );
    });

    return this.normalizeWeights(newWeights);
  }

  private calculateStabilityPeriod(
    optimizationHistory: OptimizationStep[],
  ): number {
    if (optimizationHistory.length < 3) return 0;

    let stabilityPeriod = 0;
    const threshold = 0.001; // Threshold for considering improvement as stable

    for (let i = optimizationHistory.length - 1; i >= 1; i--) {
      if (
        Math.abs(optimizationHistory[i].improvementFromPrevious) < threshold
      ) {
        stabilityPeriod++;
      } else {
        break;
      }
    }

    return stabilityPeriod;
  }

  // Additional helper methods would be implemented here...
  // (For brevity, showing key methods. Full implementation would include all helper methods)

  private async getHistoricalData(
    request: EnsembleModelRequest,
  ): Promise<any[]> {
    // Placeholder - would integrate with actual data source
    return [];
  }

  private calculateHistoricalPeriod(timeHorizon: string): { days: number } {
    switch (timeHorizon) {
      case '7d':
        return { days: 90 }; // 3 months for weekly predictions
      case '30d':
        return { days: 180 }; // 6 months for monthly predictions
      case '90d':
        return { days: 365 }; // 1 year for quarterly predictions
      default:
        return { days: 180 };
    }
  }

  private enhanceDatasetForEnsemble(
    dataset: TimeSeriesDataset,
    request: EnsembleModelRequest,
  ): TimeSeriesDataset {
    // Add ensemble-specific enhancements
    return dataset;
  }

  private validateBaseModel(baseModel: BaseModelResult): boolean {
    return (
      baseModel.accuracy.mape < 50 && // MAPE should be reasonable
      baseModel.prediction.length > 0 && // Should have predictions
      !baseModel.prediction.some(p => isNaN(p)) // No NaN values
    );
  }

  private splitDataForEnsemble(
    dataset: TimeSeriesDataset,
    validationSplit: number,
  ): { trainData: any[]; validationData: any[] } {
    const splitIndex = Math.floor(
      dataset.timeSeries.length * (1 - validationSplit),
    );

    return {
      trainData: dataset.timeSeries.slice(0, splitIndex),
      validationData: dataset.timeSeries.slice(splitIndex),
    };
  }

  // Additional method stubs for complete implementation...
  private async generatePredictionIntervals(
    baseModels: BaseModelResult[],
    predictions: number[],
    weights: ModelWeights,
    request: EnsembleModelRequest,
  ): Promise<PredictionInterval[]> {
    this.logger.log(
      `Generating prediction intervals for ${predictions.length} predictions with ${baseModels.length} base models`,
    );

    try {
      const intervals: PredictionInterval[] = [];
      const startDate = new Date();

      // Calculate ensemble residuals from historical data
      const ensembleResiduals = await this.calculateEnsembleResiduals(
        baseModels,
        weights,
        request,
      );

      // Calculate quantiles for confidence intervals
      const quantiles = this.calculateQuantiles(ensembleResiduals);

      // Calculate model disagreement uncertainty
      const modelDisagreementUncertainty = this.calculateModelDisagreement(
        baseModels,
        weights,
      );

      // Indonesian business calendar adjustments
      const indonesianCalendarAdjustments = await this.calculateIndonesianBusinessCalendarAdjustments(
        request,
      );

      for (let i = 0; i < predictions.length; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        const pointForecast = predictions[i];

        // Base uncertainty from residuals
        const baseUncertainty = this.calculateBaseUncertainty(
          ensembleResiduals,
          i,
          quantiles,
        );

        // Model disagreement uncertainty for this step
        const stepDisagreementUncertainty = modelDisagreementUncertainty[i] || 0;

        // Indonesian business calendar uncertainty adjustments
        const calendarUncertainty = indonesianCalendarAdjustments[i] || 0;

        // Seasonal volatility adjustment
        const seasonalVolatility = this.calculateSeasonalVolatility(
          currentDate,
          ensembleResiduals,
        );

        // Combined uncertainty
        const combinedUncertainty = Math.sqrt(
          Math.pow(baseUncertainty, 2) +
          Math.pow(stepDisagreementUncertainty, 2) +
          Math.pow(calendarUncertainty, 2) +
          Math.pow(seasonalVolatility, 2),
        );

        // Calculate prediction intervals using Student's t-distribution
        const tValue80 = 1.282; // t-value for 80% confidence interval
        const tValue95 = 1.960; // t-value for 95% confidence interval

        // Apply asymmetric adjustments for Indonesian market patterns
        const asymmetryFactor = this.calculateAsymmetryFactor(
          currentDate,
          baseModels,
          pointForecast,
        );

        const lower80 = pointForecast - tValue80 * combinedUncertainty * (1 + asymmetryFactor.lower);
        const upper80 = pointForecast + tValue80 * combinedUncertainty * (1 + asymmetryFactor.upper);
        const lower95 = pointForecast - tValue95 * combinedUncertainty * (1 + asymmetryFactor.lower);
        const upper95 = pointForecast + tValue95 * combinedUncertainty * (1 + asymmetryFactor.upper);

        // Ensure non-negative predictions for demand forecasting
        const nonNegativeLower80 = Math.max(0, lower80);
        const nonNegativeLower95 = Math.max(0, lower95);

        intervals.push({
          step: i + 1,
          date: currentDate,
          point_forecast: pointForecast,
          lower_bound_80: nonNegativeLower80,
          upper_bound_80: upper80,
          lower_bound_95: nonNegativeLower95,
          upper_bound_95: upper95,
          uncertainty: combinedUncertainty,
        });
      }

      this.logger.log(
        `Generated ${intervals.length} prediction intervals with average uncertainty: ${
          intervals.reduce((sum, interval) => sum + interval.uncertainty, 0) / intervals.length
        }`,
      );

      return intervals;
    } catch (error) {
      this.logger.error('Error generating prediction intervals:', error);
      throw new Error(`Failed to generate prediction intervals: ${error.message}`);
    }
  }

  private async calculateEnsembleResiduals(
    baseModels: BaseModelResult[],
    weights: ModelWeights,
    request: EnsembleModelRequest,
  ): Promise<number[]> {
    // Calculate historical ensemble residuals for uncertainty estimation
    const residuals: number[] = [];
    
    // Use historical data to calculate residuals
    for (const model of baseModels) {
      if (model.metadata.historicalPredictions && model.metadata.historicalActuals) {
        const modelResiduals = model.metadata.historicalPredictions.map(
          (pred, idx) => 
            model.metadata.historicalActuals[idx] - pred
        );
        residuals.push(...modelResiduals);
      }
    }

    // If no historical data available, use model confidence intervals
    if (residuals.length === 0) {
      for (const model of baseModels) {
        const modelWeight = weights[model.modelType] || 0;
        const modelUncertainty = model.confidence.map(conf => 
          (1 - conf) * modelWeight * 100
        );
        residuals.push(...modelUncertainty);
      }
    }

    return residuals;
  }

  private calculateQuantiles(residuals: number[]): {
    q10: number;
    q25: number;
    q50: number;
    q75: number;
    q90: number;
  } {
    const sorted = residuals.sort((a, b) => a - b);
    const len = sorted.length;

    return {
      q10: sorted[Math.floor(len * 0.1)],
      q25: sorted[Math.floor(len * 0.25)],
      q50: sorted[Math.floor(len * 0.5)],
      q75: sorted[Math.floor(len * 0.75)],
      q90: sorted[Math.floor(len * 0.9)],
    };
  }

  private calculateModelDisagreement(
    baseModels: BaseModelResult[],
    weights: ModelWeights,
  ): number[] {
    const disagreements: number[] = [];
    
    const maxLength = Math.max(...baseModels.map(model => model.prediction.length));
    
    for (let i = 0; i < maxLength; i++) {
      const predictions = baseModels
        .filter(model => model.prediction[i] !== undefined)
        .map(model => model.prediction[i]);
      
      if (predictions.length > 1) {
        const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
        const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length;
        disagreements.push(Math.sqrt(variance));
      } else {
        disagreements.push(0);
      }
    }

    return disagreements;
  }

  private async calculateIndonesianBusinessCalendarAdjustments(
    request: EnsembleModelRequest,
  ): Promise<number[]> {
    const adjustments: number[] = [];
    const startDate = new Date();

    try {
      // Get Indonesian business calendar service
      const indonesianCalendar = this.indonesianBusinessCalendarService || {
        isRamadanPeriod: () => false,
        isLebaranPeriod: () => false,
        getSeasonalMultiplier: () => 1.0,
      };

      for (let i = 0; i < parseInt(request.timeHorizon.replace('d', '')); i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        let adjustment = 0;

        // Ramadan adjustments (higher uncertainty for consumer goods)
        if ((indonesianCalendar as any).isRamadanPeriod && typeof (indonesianCalendar as any).isRamadanPeriod === 'function') {
          const isRamadan = (indonesianCalendar as any).isRamadanPeriod(currentDate);
          if (isRamadan) {
            adjustment += 0.15; // 15% additional uncertainty
          }
        }

        // Lebaran adjustments (very high uncertainty)
        if ((indonesianCalendar as any).isLebaranPeriod && typeof (indonesianCalendar as any).isLebaranPeriod === 'function') {
          const isLebaran = (indonesianCalendar as any).isLebaranPeriod(currentDate);
          if (isLebaran) {
            adjustment += 0.30; // 30% additional uncertainty
          }
        }

        // National holidays adjustments (simplified check for major holidays)
        // For now, add general holiday uncertainty - in production, integrate with comprehensive holiday checking
        const isNationalHoliday = this.isLikelyIndonesianHoliday(currentDate);
        if (isNationalHoliday) {
          adjustment += 0.10; // 10% additional uncertainty
        }

        // Weekend patterns (different consumption patterns)
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          adjustment += 0.05; // 5% additional uncertainty
        }

        adjustments.push(adjustment);
      }
    } catch (error) {
      this.logger.warn('Error calculating Indonesian calendar adjustments:', error);
      // Fallback to default adjustments
      for (let i = 0; i < parseInt(request.timeHorizon.replace('d', '')); i++) {
        adjustments.push(0.05); // 5% default uncertainty
      }
    }

    return adjustments;
  }

  private calculateBaseUncertainty(
    residuals: number[],
    step: number,
    quantiles: any,
  ): number {
    if (residuals.length === 0) return 10; // Default uncertainty

    // Use median absolute deviation for robust uncertainty estimation
    const mad = residuals.reduce((sum, r) => sum + Math.abs(r - quantiles.q50), 0) / residuals.length;
    
    // Adjust for time horizon (uncertainty increases with forecast horizon)
    const timeHorizonAdjustment = 1 + (step * 0.1);
    
    return mad * timeHorizonAdjustment;
  }

  private calculateSeasonalVolatility(
    date: Date,
    residuals: number[],
  ): number {
    // Indonesian seasonal patterns
    const month = date.getMonth() + 1;
    
    // Higher volatility during:
    // - Ramadan and Lebaran periods (varies by year)
    // - School holidays (June-July, December-January)
    // - Chinese New Year (January-February)
    
    let seasonalFactor = 1.0;
    
    if (month >= 6 && month <= 7) {
      seasonalFactor = 1.2; // School holidays
    } else if (month >= 12 || month <= 1) {
      seasonalFactor = 1.3; // End of year / New Year
    } else if (month >= 1 && month <= 2) {
      seasonalFactor = 1.15; // Chinese New Year period
    }
    
    const baseVolatility = residuals.length > 0 
      ? Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length)
      : 5; // Default volatility
    
    return baseVolatility * seasonalFactor;
  }

  private calculateAsymmetryFactor(
    date: Date,
    baseModels: BaseModelResult[],
    pointForecast: number,
  ): { lower: number; upper: number } {
    // Indonesian market typically shows positive skewness (higher upside potential)
    // during festive seasons and negative skewness during economic uncertainty
    
    const month = date.getMonth() + 1;
    let asymmetryFactor = { lower: 0, upper: 0 };
    
    // Festive seasons (Lebaran, Christmas) - positive skewness
    if (month >= 6 && month <= 7 || month >= 12) {
      asymmetryFactor = { lower: -0.1, upper: 0.2 };
    }
    
    // Economic uncertainty periods - negative skewness
    if (month >= 3 && month <= 5) {
      asymmetryFactor = { lower: 0.15, upper: -0.05 };
    }
    
    // Consider model consensus
    const modelConsensus = baseModels.reduce((sum, model) => {
      const avgPrediction = model.prediction.reduce((s, p) => s + p, 0) / model.prediction.length;
      return sum + (avgPrediction > pointForecast ? 1 : -1);
    }, 0) / baseModels.length;
    
    // Adjust asymmetry based on model consensus
    if (modelConsensus > 0.3) {
      asymmetryFactor.upper += 0.1;
    } else if (modelConsensus < -0.3) {
      asymmetryFactor.lower += 0.1;
    }
    
    return asymmetryFactor;
  }

  private isLikelyIndonesianHoliday(date: Date): boolean {
    // Simplified check for major Indonesian holidays
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Fixed national holidays
    const fixedHolidays = [
      { month: 1, day: 1 }, // New Year's Day
      { month: 8, day: 17 }, // Independence Day
      { month: 12, day: 25 }, // Christmas Day
    ];
    
    // Check if current date matches any fixed holiday
    for (const holiday of fixedHolidays) {
      if (month === holiday.month && day === holiday.day) {
        return true;
      }
    }
    
    // Additional uncertainty for holiday-heavy periods
    // March-May: Various religious holidays
    if (month >= 3 && month <= 5) {
      return Math.random() < 0.1; // 10% chance of holiday
    }
    
    return false;
  }

  private async calculateModelContributions(
    baseModels: BaseModelResult[],
    ensemblePredictions: number[],
    request: EnsembleModelRequest,
  ): Promise<ModelContribution[]> {
    this.logger.log(
      `Calculating model contributions for ${baseModels.length} base models`,
    );

    try {
      const contributions: ModelContribution[] = [];

      // Calculate total ensemble accuracy for relative importance
      const totalEnsembleAccuracy = baseModels.reduce((sum, model) => {
        return sum + (1 - model.accuracy.mape / 100);
      }, 0);

      for (const model of baseModels) {
        // Calculate model weight from ensemble method
        const modelWeight = await this.getModelWeight(model, request);

        // Calculate individual prediction contribution
        const individualPrediction = model.prediction.slice();
        const contributionToEnsemble = this.calculateEnsembleContribution(
          individualPrediction,
          modelWeight,
          ensemblePredictions,
        );

        // Calculate relative importance
        const relativeImportance = await this.calculateRelativeImportance(
          model,
          baseModels,
          totalEnsembleAccuracy,
          request,
        );

        // Analyze model strengths and weaknesses
        const { strengths, weaknesses } = await this.analyzeModelCharacteristics(
          model,
          baseModels,
          request,
        );

        contributions.push({
          modelType: model.modelType,
          weight: modelWeight,
          individualPrediction,
          contributionToEnsemble,
          relativeImportance,
          strengths,
          weaknesses,
        });
      }

      // Sort by relative importance (descending)
      contributions.sort((a, b) => b.relativeImportance - a.relativeImportance);

      this.logger.log(
        `Model contributions calculated - Top contributor: ${contributions[0]?.modelType} (${(contributions[0]?.relativeImportance * 100)?.toFixed(1)}%)`,
      );

      return contributions;
    } catch (error) {
      this.logger.error('Error calculating model contributions:', error);
      throw new Error(`Failed to calculate model contributions: ${error.message}`);
    }
  }

  private async getModelWeight(
    model: BaseModelResult,
    request: EnsembleModelRequest,
  ): Promise<number> {
    // Get model weight from ensemble method
    if (request.customWeights && request.customWeights[model.modelType]) {
      return request.customWeights[model.modelType];
    }

    // Default weight calculation based on model accuracy
    const accuracyScore = 1 - model.accuracy.mape / 100;
    const confidenceScore = model.confidence.reduce((sum, conf) => sum + conf, 0) / model.confidence.length;
    
    return (accuracyScore * 0.7 + confidenceScore * 0.3);
  }

  private calculateEnsembleContribution(
    individualPrediction: number[],
    modelWeight: number,
    ensemblePredictions: number[],
  ): number[] {
    // Calculate how much each model contributes to the ensemble prediction
    const contributions: number[] = [];

    for (let i = 0; i < individualPrediction.length; i++) {
      const individualValue = individualPrediction[i];
      const ensembleValue = ensemblePredictions[i];
      
      // Calculate weighted contribution
      const weightedContribution = individualValue * modelWeight;
      
      // Calculate relative contribution to ensemble
      const relativeContribution = ensembleValue !== 0 
        ? (weightedContribution / ensembleValue) * 100
        : 0;
      
      contributions.push(relativeContribution);
    }

    return contributions;
  }

  private async calculateRelativeImportance(
    model: BaseModelResult,
    allModels: BaseModelResult[],
    totalEnsembleAccuracy: number,
    request: EnsembleModelRequest,
  ): Promise<number> {
    // Multi-factor relative importance calculation
    const factors = {
      accuracy: 0.3,
      confidence: 0.2,
      robustness: 0.2,
      uniqueness: 0.15,
      indonesianMarketFit: 0.15,
    };

    // 1. Accuracy factor
    const accuracyScore = 1 - model.accuracy.mape / 100;
    const normalizedAccuracy = totalEnsembleAccuracy > 0 
      ? accuracyScore / totalEnsembleAccuracy
      : 0;

    // 2. Confidence factor
    const avgConfidence = model.confidence.reduce((sum, conf) => sum + conf, 0) / model.confidence.length;

    // 3. Robustness factor (lower bias and higher directional accuracy)
    const robustnessScore = (
      (1 - Math.abs(model.accuracy.bias) / 100) * 0.5 +
      (model.accuracy.directional_accuracy / 100) * 0.5
    );

    // 4. Uniqueness factor (how different is this model from others)
    const uniquenessScore = this.calculateModelUniqueness(model, allModels);

    // 5. Indonesian market fit factor
    const indonesianMarketFit = this.calculateIndonesianMarketFit(model, request);

    // Calculate weighted relative importance
    const relativeImportance = (
      normalizedAccuracy * factors.accuracy +
      avgConfidence * factors.confidence +
      robustnessScore * factors.robustness +
      uniquenessScore * factors.uniqueness +
      indonesianMarketFit * factors.indonesianMarketFit
    );

    return Math.max(0, Math.min(1, relativeImportance));
  }

  private calculateModelUniqueness(
    model: BaseModelResult,
    allModels: BaseModelResult[],
  ): number {
    // Calculate how unique this model's predictions are compared to others
    const otherModels = allModels.filter(m => m.modelId !== model.modelId);
    
    if (otherModels.length === 0) return 1.0;

    let totalDifference = 0;
    let comparisonCount = 0;

    for (const otherModel of otherModels) {
      const maxLength = Math.min(model.prediction.length, otherModel.prediction.length);
      
      for (let i = 0; i < maxLength; i++) {
        const diff = Math.abs(model.prediction[i] - otherModel.prediction[i]);
        const avgValue = (model.prediction[i] + otherModel.prediction[i]) / 2;
        
        // Normalized difference
        if (avgValue > 0) {
          totalDifference += diff / avgValue;
          comparisonCount++;
        }
      }
    }

    if (comparisonCount === 0) return 1.0;

    // Return normalized uniqueness score (0-1)
    const uniquenessScore = (totalDifference / comparisonCount) / otherModels.length;
    return Math.max(0, Math.min(1, uniquenessScore));
  }

  private calculateIndonesianMarketFit(
    model: BaseModelResult,
    request: EnsembleModelRequest,
  ): number {
    // Calculate how well this model fits Indonesian market patterns
    let marketFitScore = 0.5; // Base score

    // ARIMA models are good for Indonesian seasonal patterns
    if (model.modelType === ModelType.ARIMA) {
      marketFitScore += 0.2;
    }

    // Prophet models handle Indonesian holidays well
    if (model.modelType === ModelType.PROPHET) {
      marketFitScore += 0.3;
    }

    // XGBoost is good for complex Indonesian market dynamics
    if (model.modelType === ModelType.XGBOOST) {
      marketFitScore += 0.2;
    }

    // Consider model performance on Indonesian-specific features
    if (model.metadata.featureImportance) {
      const indonesianFeatures = [
        'ramadan_effect',
        'lebaran_effect',
        'weekend_pattern',
        'payday_pattern',
        'regional_holiday',
      ];

      const indonesianFeatureImportance = indonesianFeatures.reduce((sum, feature) => {
        return sum + (model.metadata.featureImportance[feature] || 0);
      }, 0);

      marketFitScore += indonesianFeatureImportance * 0.1;
    }

    return Math.max(0, Math.min(1, marketFitScore));
  }

  private async analyzeModelCharacteristics(
    model: BaseModelResult,
    allModels: BaseModelResult[],
    request: EnsembleModelRequest,
  ): Promise<{ strengths: string[]; weaknesses: string[] }> {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Analyze accuracy characteristics
    if (model.accuracy.mape < 10) {
      strengths.push('High accuracy predictions (MAPE < 10%)');
    } else if (model.accuracy.mape > 25) {
      weaknesses.push('Lower accuracy predictions (MAPE > 25%)');
    }

    // Analyze confidence characteristics
    const avgConfidence = model.confidence.reduce((sum, conf) => sum + conf, 0) / model.confidence.length;
    if (avgConfidence > 0.8) {
      strengths.push('High confidence in predictions');
    } else if (avgConfidence < 0.6) {
      weaknesses.push('Lower confidence in predictions');
    }

    // Analyze bias characteristics
    if (Math.abs(model.accuracy.bias) < 5) {
      strengths.push('Low prediction bias');
    } else if (Math.abs(model.accuracy.bias) > 15) {
      weaknesses.push('High prediction bias');
    }

    // Analyze directional accuracy
    if (model.accuracy.directional_accuracy > 80) {
      strengths.push('Good directional accuracy');
    } else if (model.accuracy.directional_accuracy < 60) {
      weaknesses.push('Poor directional accuracy');
    }

    // Model-specific characteristics
    switch (model.modelType) {
      case ModelType.ARIMA:
        strengths.push('Excellent for trending and seasonal patterns');
        if (model.accuracy.mape > 20) {
          weaknesses.push('May struggle with complex non-linear patterns');
        }
        break;

      case ModelType.PROPHET:
        strengths.push('Handles Indonesian holidays and seasonality well');
        strengths.push('Robust to missing data and outliers');
        if (avgConfidence < 0.7) {
          weaknesses.push('May have lower confidence in short-term predictions');
        }
        break;

      case ModelType.XGBOOST:
        strengths.push('Captures complex market dynamics');
        strengths.push('Good feature importance analysis');
        if (model.performance.trainingTime > 300000) { // 5 minutes
          weaknesses.push('Longer training time required');
        }
        break;
    }

    // Performance characteristics
    if (model.performance.predictionTime < 100) {
      strengths.push('Fast prediction generation');
    } else if (model.performance.predictionTime > 1000) {
      weaknesses.push('Slower prediction generation');
    }

    // Indonesian market fit analysis
    const marketFit = this.calculateIndonesianMarketFit(model, request);
    if (marketFit > 0.7) {
      strengths.push('Well-suited for Indonesian market patterns');
    } else if (marketFit < 0.4) {
      weaknesses.push('May not capture Indonesian market nuances well');
    }

    return { strengths, weaknesses };
  }

  private calculateDiversityMetrics(
    baseModels: BaseModelResult[],
  ): DiversityMetrics {
    this.logger.log(
      `Calculating diversity metrics for ${baseModels.length} base models`,
    );

    try {
      if (baseModels.length < 2) {
        this.logger.warn('Need at least 2 models to calculate diversity metrics');
        return {
          correlationMatrix: {},
          disagreementIndex: 0,
          diversityScore: 0,
          pairwiseDiversity: {},
          ensembleRichness: 0,
        };
      }

      // 1. Calculate correlation matrix between all models
      const correlationMatrix = this.calculateCorrelationMatrix(baseModels);

      // 2. Calculate disagreement index (higher = more diverse)
      const disagreementIndex = this.calculateDisagreementIndex(baseModels);

      // 3. Calculate pairwise diversity metrics
      const pairwiseDiversity = this.calculatePairwiseDiversity(baseModels);

      // 4. Calculate ensemble richness (diversity of model types and characteristics)
      const ensembleRichness = this.calculateEnsembleRichness(baseModels);

      // 5. Calculate overall diversity score
      const diversityScore = this.calculateOverallDiversityScore(
        correlationMatrix,
        disagreementIndex,
        pairwiseDiversity,
        ensembleRichness,
      );

      this.logger.log(
        `Diversity metrics calculated - Score: ${diversityScore.toFixed(3)}, Disagreement: ${disagreementIndex.toFixed(3)}, Richness: ${ensembleRichness.toFixed(3)}`,
      );

      return {
        correlationMatrix,
        disagreementIndex,
        diversityScore,
        pairwiseDiversity,
        ensembleRichness,
      };
    } catch (error) {
      this.logger.error('Error calculating diversity metrics:', error);
      // Return default values on error
      return {
        correlationMatrix: {},
        disagreementIndex: 0,
        diversityScore: 0,
        pairwiseDiversity: {},
        ensembleRichness: 0,
      };
    }
  }

  private calculateCorrelationMatrix(
    baseModels: BaseModelResult[],
  ): Record<string, Record<string, number>> {
    const correlationMatrix: Record<string, Record<string, number>> = {};

    // Initialize correlation matrix
    for (const model of baseModels) {
      correlationMatrix[model.modelType] = {};
    }

    // Calculate pairwise correlations
    for (let i = 0; i < baseModels.length; i++) {
      for (let j = 0; j < baseModels.length; j++) {
        const modelA = baseModels[i];
        const modelB = baseModels[j];

        if (i === j) {
          correlationMatrix[modelA.modelType][modelB.modelType] = 1.0;
        } else {
          const correlation = this.calculatePearsonCorrelation(
            modelA.prediction,
            modelB.prediction,
          );
          correlationMatrix[modelA.modelType][modelB.modelType] = correlation;
        }
      }
    }

    return correlationMatrix;
  }

  private calculatePearsonCorrelation(
    arrayA: number[],
    arrayB: number[],
  ): number {
    const minLength = Math.min(arrayA.length, arrayB.length);
    if (minLength < 2) return 0;

    // Use first minLength elements
    const a = arrayA.slice(0, minLength);
    const b = arrayB.slice(0, minLength);

    // Calculate means
    const meanA = a.reduce((sum, val) => sum + val, 0) / minLength;
    const meanB = b.reduce((sum, val) => sum + val, 0) / minLength;

    // Calculate correlation components
    let numerator = 0;
    let sumSquaredA = 0;
    let sumSquaredB = 0;

    for (let i = 0; i < minLength; i++) {
      const deviationA = a[i] - meanA;
      const deviationB = b[i] - meanB;

      numerator += deviationA * deviationB;
      sumSquaredA += deviationA * deviationA;
      sumSquaredB += deviationB * deviationB;
    }

    const denominator = Math.sqrt(sumSquaredA * sumSquaredB);

    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  private calculateDisagreementIndex(baseModels: BaseModelResult[]): number {
    if (baseModels.length < 2) return 0;

    let totalDisagreement = 0;
    let comparisonCount = 0;

    // Calculate pairwise disagreements
    for (let i = 0; i < baseModels.length; i++) {
      for (let j = i + 1; j < baseModels.length; j++) {
        const modelA = baseModels[i];
        const modelB = baseModels[j];

        const disagreement = this.calculatePairwiseDisagreement(
          modelA.prediction,
          modelB.prediction,
        );

        totalDisagreement += disagreement;
        comparisonCount++;
      }
    }

    return comparisonCount > 0 ? totalDisagreement / comparisonCount : 0;
  }

  private calculatePairwiseDisagreement(
    predictionA: number[],
    predictionB: number[],
  ): number {
    const minLength = Math.min(predictionA.length, predictionB.length);
    if (minLength === 0) return 0;

    let sumDisagreement = 0;

    for (let i = 0; i < minLength; i++) {
      const valueA = predictionA[i];
      const valueB = predictionB[i];
      const avgValue = (valueA + valueB) / 2;

      // Normalized disagreement
      if (avgValue > 0) {
        sumDisagreement += Math.abs(valueA - valueB) / avgValue;
      }
    }

    return sumDisagreement / minLength;
  }

  private calculatePairwiseDiversity(
    baseModels: BaseModelResult[],
  ): Record<string, number> {
    const pairwiseDiversity: Record<string, number> = {};

    // Calculate diversity between each pair of models
    for (let i = 0; i < baseModels.length; i++) {
      for (let j = i + 1; j < baseModels.length; j++) {
        const modelA = baseModels[i];
        const modelB = baseModels[j];

        const pairKey = `${modelA.modelType}-${modelB.modelType}`;

        // Multi-dimensional diversity calculation
        const predictionDiversity = this.calculatePairwiseDisagreement(
          modelA.prediction,
          modelB.prediction,
        );

        const accuracyDiversity = Math.abs(
          modelA.accuracy.mape - modelB.accuracy.mape,
        ) / 100;

        const confidenceDiversity = Math.abs(
          modelA.confidence.reduce((sum, conf) => sum + conf, 0) / modelA.confidence.length -
          modelB.confidence.reduce((sum, conf) => sum + conf, 0) / modelB.confidence.length,
        );

        const biasDiversity = Math.abs(
          modelA.accuracy.bias - modelB.accuracy.bias,
        ) / 100;

        const performanceDiversity = Math.abs(
          modelA.performance.trainingTime - modelB.performance.trainingTime,
        ) / Math.max(modelA.performance.trainingTime, modelB.performance.trainingTime, 1);

        // Weighted diversity score
        const diversityScore = (
          predictionDiversity * 0.4 +
          accuracyDiversity * 0.2 +
          confidenceDiversity * 0.2 +
          biasDiversity * 0.1 +
          performanceDiversity * 0.1
        );

        pairwiseDiversity[pairKey] = diversityScore;
      }
    }

    return pairwiseDiversity;
  }

  private calculateEnsembleRichness(baseModels: BaseModelResult[]): number {
    // Measure diversity of model types and characteristics
    const factors = {
      modelTypeVariety: 0.3,
      accuracySpread: 0.2,
      confidenceSpread: 0.2,
      biasSpread: 0.15,
      performanceSpread: 0.15,
    };

    // 1. Model type variety
    const uniqueModelTypes = new Set(baseModels.map(model => model.modelType));
    const modelTypeVariety = uniqueModelTypes.size / 3; // Normalized by max possible types (ARIMA, Prophet, XGBoost)

    // 2. Accuracy spread (higher spread = more diverse)
    const accuracyValues = baseModels.map(model => model.accuracy.mape);
    const accuracySpread = this.calculateNormalizedSpread(accuracyValues);

    // 3. Confidence spread
    const confidenceValues = baseModels.map(model => 
      model.confidence.reduce((sum, conf) => sum + conf, 0) / model.confidence.length
    );
    const confidenceSpread = this.calculateNormalizedSpread(confidenceValues);

    // 4. Bias spread
    const biasValues = baseModels.map(model => model.accuracy.bias);
    const biasSpread = this.calculateNormalizedSpread(biasValues);

    // 5. Performance spread
    const performanceValues = baseModels.map(model => model.performance.trainingTime);
    const performanceSpread = this.calculateNormalizedSpread(performanceValues);

    // Calculate weighted ensemble richness
    const ensembleRichness = (
      modelTypeVariety * factors.modelTypeVariety +
      accuracySpread * factors.accuracySpread +
      confidenceSpread * factors.confidenceSpread +
      biasSpread * factors.biasSpread +
      performanceSpread * factors.performanceSpread
    );

    return Math.max(0, Math.min(1, ensembleRichness));
  }

  private calculateNormalizedSpread(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Normalize by mean to get coefficient of variation
    return mean > 0 ? Math.min(1, stdDev / mean) : 0;
  }

  private calculateOverallDiversityScore(
    correlationMatrix: Record<string, Record<string, number>>,
    disagreementIndex: number,
    pairwiseDiversity: Record<string, number>,
    ensembleRichness: number,
  ): number {
    // Calculate average correlation (lower correlation = higher diversity)
    const correlationValues: number[] = [];
    for (const modelA in correlationMatrix) {
      for (const modelB in correlationMatrix[modelA]) {
        if (modelA !== modelB) {
          correlationValues.push(correlationMatrix[modelA][modelB]);
        }
      }
    }

    const avgCorrelation = correlationValues.length > 0 
      ? correlationValues.reduce((sum, val) => sum + Math.abs(val), 0) / correlationValues.length
      : 0;

    const correlationDiversity = 1 - avgCorrelation;

    // Calculate average pairwise diversity
    const pairwiseDiversityValues = Object.values(pairwiseDiversity);
    const avgPairwiseDiversity = pairwiseDiversityValues.length > 0
      ? pairwiseDiversityValues.reduce((sum, val) => sum + val, 0) / pairwiseDiversityValues.length
      : 0;

    // Weight different diversity measures
    const weights = {
      correlationDiversity: 0.3,
      disagreementIndex: 0.3,
      pairwiseDiversity: 0.2,
      ensembleRichness: 0.2,
    };

    const overallDiversityScore = (
      correlationDiversity * weights.correlationDiversity +
      disagreementIndex * weights.disagreementIndex +
      avgPairwiseDiversity * weights.pairwiseDiversity +
      ensembleRichness * weights.ensembleRichness
    );

    return Math.max(0, Math.min(1, overallDiversityScore));
  }

  private async analyzeEnsembleStability(
    baseModels: BaseModelResult[],
    ensemblePredictions: number[],
    dataset: TimeSeriesDataset,
  ): Promise<StabilityAnalysis> {
    this.logger.log(
      `Analyzing ensemble stability for ${baseModels.length} models across ${ensemblePredictions.length} predictions`,
    );

    try {
      // 1. Perform variance decomposition analysis
      const varianceAnalysis = await this.performVarianceDecomposition(
        baseModels,
        ensemblePredictions,
        dataset,
      );

      // 2. Calculate sensitivity to outliers
      const sensitivityToOutliers = await this.calculateOutlierSensitivity(
        baseModels,
        ensemblePredictions,
        dataset,
      );

      // 3. Assess robustness to noise
      const robustnessToNoise = await this.calculateNoiseRobustness(
        baseModels,
        ensemblePredictions,
        dataset,
      );

      // 4. Analyze temporal stability
      const temporalStability = await this.analyzeTemporalStability(
        baseModels,
        ensemblePredictions,
        dataset,
      );

      // 5. Calculate overall stability score
      const stabilityScore = this.calculateOverallStabilityScore(
        varianceAnalysis,
        sensitivityToOutliers,
        robustnessToNoise,
        temporalStability,
      );

      this.logger.log(
        `Ensemble stability analysis completed - Score: ${stabilityScore.toFixed(3)}, Outlier sensitivity: ${sensitivityToOutliers.toFixed(3)}, Noise robustness: ${robustnessToNoise.toFixed(3)}`,
      );

      return {
        stabilityScore,
        varianceAnalysis,
        sensitivityToOutliers,
        robustnessToNoise,
        temporalStability,
      };
    } catch (error) {
      this.logger.error('Error analyzing ensemble stability:', error);
      throw new Error(`Failed to analyze ensemble stability: ${error.message}`);
    }
  }

  private async performVarianceDecomposition(
    baseModels: BaseModelResult[],
    ensemblePredictions: number[],
    dataset: TimeSeriesDataset,
  ): Promise<VarianceDecomposition> {
    // Bias-Variance decomposition for ensemble models
    const actualValues = dataset.timeSeries.map(point => point.value);
    const minLength = Math.min(ensemblePredictions.length, actualValues.length);

    if (minLength === 0) {
      return {
        totalVariance: 0,
        modelVariance: 0,
        dataVariance: 0,
        biasSquared: 0,
        irreducibleError: 0,
      };
    }

    // Calculate ensemble bias
    let sumSquaredError = 0;
    let sumBias = 0;
    
    for (let i = 0; i < minLength; i++) {
      const actual = actualValues[i];
      const predicted = ensemblePredictions[i];
      
      const error = actual - predicted;
      sumSquaredError += error * error;
      sumBias += predicted - actual;
    }

    const meanSquaredError = sumSquaredError / minLength;
    const meanBias = sumBias / minLength;
    const biasSquared = meanBias * meanBias;

    // Calculate model variance (disagreement between base models)
    let modelVariance = 0;
    for (let i = 0; i < minLength; i++) {
      const ensemblePrediction = ensemblePredictions[i];
      let sumModelVariance = 0;
      let validModels = 0;

      for (const model of baseModels) {
        if (model.prediction[i] !== undefined) {
          const diff = model.prediction[i] - ensemblePrediction;
          sumModelVariance += diff * diff;
          validModels++;
        }
      }

      if (validModels > 0) {
        modelVariance += sumModelVariance / validModels;
      }
    }
    modelVariance = modelVariance / minLength;

    // Calculate data variance (inherent noise in the data)
    const actualMean = actualValues.slice(0, minLength).reduce((sum, val) => sum + val, 0) / minLength;
    let dataVariance = 0;
    for (let i = 0; i < minLength; i++) {
      const diff = actualValues[i] - actualMean;
      dataVariance += diff * diff;
    }
    dataVariance = dataVariance / minLength;

    // Estimate irreducible error (noise floor)
    const irreducibleError = Math.max(0, meanSquaredError - biasSquared - modelVariance);

    // Total variance is the sum of all components
    const totalVariance = biasSquared + modelVariance + dataVariance + irreducibleError;

    return {
      totalVariance,
      modelVariance,
      dataVariance,
      biasSquared,
      irreducibleError,
    };
  }

  private async calculateOutlierSensitivity(
    baseModels: BaseModelResult[],
    ensemblePredictions: number[],
    dataset: TimeSeriesDataset,
  ): Promise<number> {
    // Measure how sensitive the ensemble is to outliers
    const actualValues = dataset.timeSeries.map(point => point.value);
    const minLength = Math.min(ensemblePredictions.length, actualValues.length);

    if (minLength === 0) return 0;

    // Identify outliers in the actual data using IQR method
    const sortedActuals = actualValues.slice(0, minLength).sort((a, b) => a - b);
    const q1 = sortedActuals[Math.floor(minLength * 0.25)];
    const q3 = sortedActuals[Math.floor(minLength * 0.75)];
    const iqr = q3 - q1;
    const outlierThreshold = 1.5 * iqr;

    let outlierCount = 0;
    let outlierErrorSum = 0;
    let normalErrorSum = 0;
    let normalCount = 0;

    for (let i = 0; i < minLength; i++) {
      const actual = actualValues[i];
      const predicted = ensemblePredictions[i];
      const error = Math.abs(actual - predicted);

      const isOutlier = actual < (q1 - outlierThreshold) || actual > (q3 + outlierThreshold);
      
      if (isOutlier) {
        outlierCount++;
        outlierErrorSum += error;
      } else {
        normalCount++;
        normalErrorSum += error;
      }
    }

    if (outlierCount === 0 || normalCount === 0) return 0;

    const outlierMeanError = outlierErrorSum / outlierCount;
    const normalMeanError = normalErrorSum / normalCount;

    // Sensitivity is the ratio of outlier error to normal error
    const sensitivity = normalMeanError > 0 ? outlierMeanError / normalMeanError : 0;

    // Normalize to 0-1 scale (higher values = more sensitive)
    return Math.min(1, sensitivity / 5); // Assuming sensitivity > 5 is very high
  }

  private async calculateNoiseRobustness(
    baseModels: BaseModelResult[],
    ensemblePredictions: number[],
    dataset: TimeSeriesDataset,
  ): Promise<number> {
    // Test robustness by simulating noise in the data
    const actualValues = dataset.timeSeries.map(point => point.value);
    const minLength = Math.min(ensemblePredictions.length, actualValues.length);

    if (minLength === 0) return 0;

    // Calculate baseline ensemble error
    let baselineError = 0;
    for (let i = 0; i < minLength; i++) {
      const error = Math.abs(actualValues[i] - ensemblePredictions[i]);
      baselineError += error;
    }
    baselineError = baselineError / minLength;

    // Simulate noise at different levels
    const noiselevels = [0.05, 0.1, 0.2]; // 5%, 10%, 20% noise
    let totalRobustness = 0;

    for (const noiseLevel of noiselevels) {
      // Create noisy dataset
      const noisyActuals = actualValues.map(val => {
        const noise = (Math.random() - 0.5) * 2 * noiseLevel * val;
        return val + noise;
      });

      // Calculate error with noisy data
      let noisyError = 0;
      for (let i = 0; i < minLength; i++) {
        const error = Math.abs(noisyActuals[i] - ensemblePredictions[i]);
        noisyError += error;
      }
      noisyError = noisyError / minLength;

      // Robustness is inversely related to error increase
      const errorIncrease = baselineError > 0 ? noisyError / baselineError : 1;
      const robustness = 1 / errorIncrease;
      totalRobustness += robustness;
    }

    // Average robustness across noise levels
    const avgRobustness = totalRobustness / noiselevels.length;
    
    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, avgRobustness));
  }

  private async analyzeTemporalStability(
    baseModels: BaseModelResult[],
    ensemblePredictions: number[],
    dataset: TimeSeriesDataset,
  ): Promise<TemporalStability[]> {
    // Analyze stability across different time windows
    const temporalStability: TemporalStability[] = [];
    const minLength = Math.min(ensemblePredictions.length, dataset.timeSeries.length);

    if (minLength < 10) {
      // Need at least 10 data points for meaningful analysis
      return temporalStability;
    }

    // Define time windows
    const timeWindows = [
      { name: 'Early', start: 0, end: Math.floor(minLength * 0.33) },
      { name: 'Middle', start: Math.floor(minLength * 0.33), end: Math.floor(minLength * 0.66) },
      { name: 'Late', start: Math.floor(minLength * 0.66), end: minLength },
    ];

    let previousWindowVariance = 0;

    for (const window of timeWindows) {
      const windowPredictions = ensemblePredictions.slice(window.start, window.end);
      const windowActuals = dataset.timeSeries.slice(window.start, window.end).map(point => point.value);

      if (windowPredictions.length === 0) continue;

      // Calculate stability metrics for this window
      const { stabilityScore, variance } = this.calculateWindowStability(
        windowPredictions,
        windowActuals,
        baseModels,
        window.start,
        window.end,
      );

      // Calculate variance ratio (drift detection)
      const varianceRatio = previousWindowVariance > 0 ? variance / previousWindowVariance : 1;
      const driftDetected = varianceRatio > 2.0 || varianceRatio < 0.5; // Significant change

      temporalStability.push({
        timeWindow: window.name,
        stabilityScore,
        varianceRatio,
        driftDetected,
      });

      previousWindowVariance = variance;
    }

    return temporalStability;
  }

  private calculateWindowStability(
    predictions: number[],
    actuals: number[],
    baseModels: BaseModelResult[],
    startIdx: number,
    endIdx: number,
  ): { stabilityScore: number; variance: number } {
    const windowLength = predictions.length;
    
    if (windowLength === 0) {
      return { stabilityScore: 0, variance: 0 };
    }

    // Calculate ensemble variance within this window
    let variance = 0;
    for (let i = 0; i < windowLength; i++) {
      const globalIdx = startIdx + i;
      const ensemblePrediction = predictions[i];
      
      let modelVariance = 0;
      let validModels = 0;

      for (const model of baseModels) {
        if (model.prediction[globalIdx] !== undefined) {
          const diff = model.prediction[globalIdx] - ensemblePrediction;
          modelVariance += diff * diff;
          validModels++;
        }
      }

      if (validModels > 0) {
        variance += modelVariance / validModels;
      }
    }
    variance = variance / windowLength;

    // Calculate accuracy within this window
    let accuracy = 0;
    for (let i = 0; i < Math.min(predictions.length, actuals.length); i++) {
      const error = Math.abs(predictions[i] - actuals[i]);
      const relativeError = actuals[i] > 0 ? error / actuals[i] : 0;
      accuracy += (1 - relativeError);
    }
    accuracy = accuracy / Math.min(predictions.length, actuals.length);

    // Stability score combines low variance and high accuracy
    const stabilityScore = Math.max(0, (accuracy * 0.7 + (1 - Math.min(1, variance / 100)) * 0.3));

    return { stabilityScore, variance };
  }

  private calculateOverallStabilityScore(
    varianceAnalysis: VarianceDecomposition,
    sensitivityToOutliers: number,
    robustnessToNoise: number,
    temporalStability: TemporalStability[],
  ): number {
    // Weight different stability components
    const weights = {
      variance: 0.3,
      outlierSensitivity: 0.2,
      noiseRobustness: 0.3,
      temporalStability: 0.2,
    };

    // 1. Variance component (lower variance = higher stability)
    const totalVariance = varianceAnalysis.totalVariance;
    const varianceStability = Math.max(0, 1 - Math.min(1, totalVariance / 1000));

    // 2. Outlier sensitivity component (lower sensitivity = higher stability)
    const outlierStability = 1 - sensitivityToOutliers;

    // 3. Noise robustness component (higher robustness = higher stability)
    const noiseStability = robustnessToNoise;

    // 4. Temporal stability component (average stability across time windows)
    const temporalStabilityScore = temporalStability.length > 0
      ? temporalStability.reduce((sum, window) => sum + window.stabilityScore, 0) / temporalStability.length
      : 0;

    // Calculate weighted overall stability score
    const overallStabilityScore = (
      varianceStability * weights.variance +
      outlierStability * weights.outlierSensitivity +
      noiseStability * weights.noiseRobustness +
      temporalStabilityScore * weights.temporalStability
    );

    return Math.max(0, Math.min(1, overallStabilityScore));
  }

  private calculateEnsembleConfidence(
    baseModels: BaseModelResult[],
    ensembleAccuracy: ModelAccuracy,
    diversityMetrics: DiversityMetrics,
  ): number {
    // Simple confidence calculation based on accuracy and diversity
    const accuracyConfidence = Math.max(0, 1 - ensembleAccuracy.mape / 100);
    const diversityBonus = Math.min(0.2, diversityMetrics.diversityScore * 0.1);

    return Math.min(0.99, accuracyConfidence + diversityBonus);
  }

  private async generateEnsembleRecommendations(
    baseModels: BaseModelResult[],
    performanceAnalysis: any,
    request: EnsembleModelRequest,
  ): Promise<EnsembleRecommendation[]> {
    // Implementation for business recommendations
    return [];
  }

  private async assessEnsembleRisks(
    baseModels: BaseModelResult[],
    performanceAnalysis: any,
    request: EnsembleModelRequest,
  ): Promise<EnsembleRiskAssessment> {
    // Implementation for risk assessment
    return {
      overallRisk: 'medium',
      riskFactors: [],
      mitigationStrategies: [],
      uncertaintyQuantification: {
        epistemic_uncertainty: 0,
        aleatoric_uncertainty: 0,
        total_uncertainty: 0,
        confidence_regions: [],
      },
    };
  }

  // Additional methods for complete ensemble functionality...
  private async loadEnsembleModel(
    ensembleModelId: string,
    tenantId: string,
  ): Promise<EnsembleModelResult | null> {
    // Implementation to load existing ensemble model
    return null;
  }

  private async preparePredictionData(
    request: PredictionRequest,
    tenantId: string,
  ): Promise<TimeSeriesDataset> {
    // Implementation to prepare data for prediction
    return {} as TimeSeriesDataset;
  }

  private async generateBaseModelPredictions(
    baseModels: BaseModelResult[],
    dataset: TimeSeriesDataset,
    request: PredictionRequest,
  ): Promise<BaseModelResult[]> {
    // Implementation to generate fresh predictions from base models
    return [];
  }

  private async combineBasePredictions(
    baseModelPredictions: BaseModelResult[],
    weights: ModelWeights,
    ensembleMethod: EnsembleMethod,
  ): Promise<{ predictions: number[]; intervals: PredictionInterval[] }> {
    // Implementation to combine predictions using ensemble method
    return { predictions: [], intervals: [] };
  }

  private async calculatePredictionConfidence(
    baseModelPredictions: BaseModelResult[],
    ensemblePrediction: {
      predictions: number[];
      intervals: PredictionInterval[];
    },
    ensembleModel: EnsembleModelResult,
  ): Promise<{ overallConfidence: number }> {
    // Implementation for prediction confidence calculation
    return { overallConfidence: 0.8 };
  }

  private async savePredictionResults(
    ensemblePrediction: {
      predictions: number[];
      intervals: PredictionInterval[];
    },
    confidenceAnalysis: { overallConfidence: number },
    request: PredictionRequest,
    tenantId: string,
  ): Promise<void> {
    // Implementation to save prediction results
  }
}
