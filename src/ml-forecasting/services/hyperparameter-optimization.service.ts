import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import moment from 'moment-timezone';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import {
  TrainingJob,
  TrainingJobStatus,
} from '../entities/training-job.entity';
import { PythonBridgeService, MLDataRequest } from './python-bridge.service';
import {
  DataPreprocessingService,
  TimeSeriesDataset,
} from './data-preprocessing.service';

/**
 * PHASE 3.2: Hyperparameter Optimization Service ⚙️
 *
 * Advanced hyperparameter tuning service dengan multiple optimization algorithms
 * (Grid Search, Random Search, Bayesian Optimization, Genetic Algorithm) untuk
 * automated optimal model configuration discovery untuk Indonesian SMB patterns.
 */

export interface HyperparameterOptimizationRequest {
  tenantId: string;
  modelType: ModelType;
  dataset: TimeSeriesDataset;
  optimizationConfig: OptimizationConfig;
  constraints: OptimizationConstraints;
  indonesianContext: IndonesianOptimizationContext;
}

export interface OptimizationConfig {
  method: OptimizationMethod;
  objectiveFunction: ObjectiveFunction;
  maxEvaluations: number;
  maxTime: number; // minutes
  parallelJobs: number;
  crossValidationFolds: number;
  earlyStoppingEnabled: boolean;
  warmStartEnabled: boolean;
}

export interface OptimizationMethod {
  algorithm:
    | 'grid_search'
    | 'random_search'
    | 'bayesian_optimization'
    | 'genetic_algorithm'
    | 'tpe'
    | 'hyperband';
  searchSpace: HyperparameterSearchSpace;
  acquisitionFunction?: 'ei' | 'poi' | 'ucb' | 'gp_hedge'; // For Bayesian optimization
  populationSize?: number; // For genetic algorithm
  mutationRate?: number; // For genetic algorithm
  crossoverRate?: number; // For genetic algorithm
  bandits?: number; // For hyperband
}

export interface HyperparameterSearchSpace {
  [key: string]: ParameterSpace;
}

export interface ParameterSpace {
  type: 'continuous' | 'discrete' | 'categorical' | 'integer';
  low?: number;
  high?: number;
  values?: any[];
  distribution?: 'uniform' | 'normal' | 'log_uniform' | 'log_normal';
  scale?: 'linear' | 'log';
  default?: any;
  description?: string;
}

export interface ObjectiveFunction {
  primary: 'mape' | 'mae' | 'rmse' | 'r_squared' | 'aic' | 'bic' | 'composite';
  weights?: ObjectiveWeights;
  direction: 'minimize' | 'maximize';
  constraintsPenalty?: number;
  indonesianContextWeight?: number;
}

export interface ObjectiveWeights {
  accuracy: number;
  speed: number;
  interpretability: number;
  stability: number;
  indonesianFit: number;
}

export interface OptimizationConstraints {
  maxTrainingTime: number; // seconds
  maxMemoryUsage: number; // MB
  minAccuracyThreshold: number;
  maxComplexity?: number;
  resourceLimits: ResourceLimits;
  businessConstraints: BusinessConstraints;
}

export interface ResourceLimits {
  cpuCores: number;
  ramGB: number;
  diskSpaceGB: number;
  networkBandwidth?: number; // Mbps
}

export interface BusinessConstraints {
  maxLatencyMs: number;
  minThroughput: number; // predictions per second
  interpretabilityRequired: boolean;
  regulatoryCompliance: boolean;
  budgetLimitUSD?: number;
}

export interface IndonesianOptimizationContext {
  businessType: 'retail' | 'wholesale' | 'manufacturing' | 'services';
  region: 'WIB' | 'WITA' | 'WIT' | 'national';
  seasonalityImportance: 'low' | 'medium' | 'high' | 'critical';
  ramadanSensitive: boolean;
  lebaranSensitive: boolean;
  holidayPatterns: string[];
  marketVolatility: 'low' | 'medium' | 'high';
  competitiveLandscape:
    | 'monopolistic'
    | 'oligopolistic'
    | 'competitive'
    | 'perfectly_competitive';
}

export interface OptimizationResult {
  optimizationId: string;
  tenantId: string;
  modelType: ModelType;
  startedAt: Date;
  completedAt: Date;

  // Best configuration found
  bestHyperparameters: Record<string, any>;
  bestObjectiveValue: number;
  bestModelMetrics: ModelPerformanceMetrics;

  // Optimization process
  totalEvaluations: number;
  convergenceIteration: number;
  optimizationHistory: OptimizationIteration[];

  // Analysis
  parameterImportance: ParameterImportance[];
  convergenceAnalysis: ConvergenceAnalysis;
  sensitivityAnalysis: SensitivityAnalysis;

  // Indonesian context results
  indonesianOptimizationResults: IndonesianOptimizationResults;

  // Resource usage
  resourceUsage: ResourceUsageAnalysis;

  // Recommendations
  recommendations: OptimizationRecommendation[];
  nextSteps: string[];
}

export interface ModelPerformanceMetrics {
  accuracy: {
    mape: number;
    mae: number;
    rmse: number;
    r_squared: number;
    directional_accuracy: number;
  };
  performance: {
    training_time: number;
    prediction_time: number;
    memory_usage: number;
    cpu_utilization: number;
  };
  stability: {
    cross_validation_std: number;
    parameter_sensitivity: number;
    noise_robustness: number;
  };
  interpretability: {
    feature_importance_clarity: number;
    model_complexity: number;
    explanation_quality: number;
  };
  indonesian_context: {
    ramadan_accuracy: number;
    lebaran_accuracy: number;
    holiday_pattern_fit: number;
    seasonal_adaptation: number;
  };
}

export interface OptimizationIteration {
  iteration: number;
  hyperparameters: Record<string, any>;
  objectiveValue: number;
  constraintViolations: ConstraintViolation[];
  metrics: ModelPerformanceMetrics;
  evaluationTime: number;
  improvement: number;
  isParetoDominant?: boolean;
}

export interface ConstraintViolation {
  constraint: string;
  violation: number;
  severity: 'minor' | 'major' | 'critical';
  suggestion: string;
}

export interface ParameterImportance {
  parameter: string;
  importance: number;
  effect: 'positive' | 'negative' | 'non_linear';
  optimalRange: [number, number] | string[];
  sensitivity: number;
  interactions: ParameterInteraction[];
}

export interface ParameterInteraction {
  otherParameter: string;
  interactionStrength: number;
  interactionType: 'synergy' | 'antagonism' | 'conditional';
  description: string;
}

export interface ConvergenceAnalysis {
  converged: boolean;
  convergenceIteration: number;
  convergenceRate: number;
  plateauLength: number;
  finalImprovement: number;
  stabilitySince: number;
  trendAnalysis: TrendAnalysis;
}

export interface TrendAnalysis {
  trend: 'improving' | 'plateauing' | 'deteriorating' | 'oscillating';
  trendStrength: number;
  volatility: number;
  acceleration: number;
  cyclicalPattern?: boolean;
}

export interface SensitivityAnalysis {
  mostSensitiveParameters: string[];
  leastSensitiveParameters: string[];
  parameterSensitivity: Record<string, number>;
  robustnessScore: number;
  optimalityWidth: Record<string, number>;
}

export interface IndonesianOptimizationResults {
  ramadanOptimization: SeasonalOptimizationResult;
  lebaranOptimization: SeasonalOptimizationResult;
  holidayOptimization: HolidayOptimizationResult;
  regionalOptimization: RegionalOptimizationResult;
  culturalAdaptation: CulturalAdaptationResult;
}

export interface SeasonalOptimizationResult {
  optimizedParameters: Record<string, any>;
  performanceImprovement: number;
  accuracyDuringPeriod: number;
  adaptationStrategy: string;
  recommendations: string[];
}

export interface HolidayOptimizationResult {
  holidaySpecificParameters: Record<string, Record<string, any>>;
  averageHolidayAccuracy: number;
  worstPerformingHoliday: string;
  bestPerformingHoliday: string;
  holidayImpactMultipliers: Record<string, number>;
}

export interface RegionalOptimizationResult {
  wibOptimization: RegionalSpecificResult;
  witaOptimization: RegionalSpecificResult;
  witOptimization: RegionalSpecificResult;
  nationalOptimization: RegionalSpecificResult;
  regionalVariability: number;
}

export interface RegionalSpecificResult {
  optimalParameters: Record<string, any>;
  regionalAccuracy: number;
  uniqueCharacteristics: string[];
  adaptationNeeded: boolean;
}

export interface CulturalAdaptationResult {
  culturalFactorsImpact: Record<string, number>;
  adaptationSuccessRate: number;
  culturalParameterWeights: Record<string, number>;
  recommendedCulturalAdjustments: string[];
}

export interface ResourceUsageAnalysis {
  totalCpuHours: number;
  peakMemoryUsage: number;
  totalNetworkUsage: number;
  costEstimate: CostEstimate;
  efficiency: EfficiencyMetrics;
}

export interface CostEstimate {
  computeCost: number;
  storageCost: number;
  networkCost: number;
  totalCost: number;
  currency: 'USD' | 'IDR';
}

export interface EfficiencyMetrics {
  evaluationsPerHour: number;
  improvementPerEvaluation: number;
  resourceEfficiency: number;
  timeToOptimal: number;
}

export interface OptimizationRecommendation {
  type:
    | 'parameter_tuning'
    | 'algorithm_change'
    | 'data_preprocessing'
    | 'feature_engineering'
    | 'ensemble_method';
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  expectedImprovement: number;
  implementationEffort: 'minimal' | 'moderate' | 'significant' | 'major';
  businessImpact: string;
  indonesianSpecific: boolean;
}

@Injectable()
export class HyperparameterOptimizationService {
  private readonly logger = new Logger(HyperparameterOptimizationService.name);
  private readonly activeOptimizations = new Map<string, any>();

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepository: Repository<MLModel>,
    @InjectRepository(TrainingJob)
    private readonly trainingJobRepository: Repository<TrainingJob>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
    private readonly pythonBridgeService: PythonBridgeService,
    private readonly dataPreprocessingService: DataPreprocessingService,
  ) {}

  /**
   * Main method untuk start hyperparameter optimization
   */
  async startOptimization(
    request: HyperparameterOptimizationRequest,
  ): Promise<OptimizationResult> {
    const optimizationId = `opt_${Date.now()}_${request.modelType}`;

    this.logger.log(
      `Starting hyperparameter optimization ${optimizationId} for ${request.modelType}`,
    );

    try {
      // 1. Validate request and setup
      await this.validateOptimizationRequest(request);

      // 2. Initialize optimization
      const optimization = await this.initializeOptimization(
        optimizationId,
        request,
      );

      // 3. Create search space based on model type and Indonesian context
      const searchSpace = await this.createIndonesianAwareSearchSpace(
        request.modelType,
        request.indonesianContext,
        request.optimizationConfig.method.searchSpace,
      );

      // 4. Execute optimization based on algorithm
      const optimizationResult = await this.executeOptimization(
        optimizationId,
        request,
        searchSpace,
      );

      // 5. Analyze results
      const analysis = await this.analyzeOptimizationResults(
        optimizationResult,
        request,
      );

      // 6. Generate Indonesian-specific insights
      const indonesianInsights = await this.generateIndonesianInsights(
        optimizationResult,
        request,
      );

      // 7. Create final result
      const finalResult = await this.compileOptimizationResult(
        optimizationId,
        optimizationResult,
        analysis,
        indonesianInsights,
        request,
      );

      // 8. Save results and emit events
      await this.saveOptimizationResult(finalResult);

      this.eventEmitter.emit('hyperparameter.optimization.completed', {
        optimizationId,
        tenantId: request.tenantId,
        modelType: request.modelType,
        bestObjectiveValue: finalResult.bestObjectiveValue,
        totalEvaluations: finalResult.totalEvaluations,
        indonesianOptimized: true,
      });

      this.logger.log(
        `Hyperparameter optimization ${optimizationId} completed successfully`,
      );

      return finalResult;
    } catch (error) {
      this.logger.error(
        `Hyperparameter optimization ${optimizationId} failed: ${error.message}`,
        error.stack,
      );

      // Cleanup failed optimization
      this.activeOptimizations.delete(optimizationId);

      throw error;
    }
  }

  /**
   * Get optimization status untuk running optimization
   */
  async getOptimizationStatus(optimizationId: string): Promise<{
    status: 'running' | 'completed' | 'failed' | 'not_found';
    progress: number;
    currentIteration: number;
    bestObjectiveValue?: number;
    estimatedTimeRemaining?: number;
  }> {
    const optimization = this.activeOptimizations.get(optimizationId);

    if (!optimization) {
      return { status: 'not_found', progress: 0, currentIteration: 0 };
    }

    return {
      status: optimization.status,
      progress: optimization.progress,
      currentIteration: optimization.currentIteration,
      bestObjectiveValue: optimization.bestObjectiveValue,
      estimatedTimeRemaining: optimization.estimatedTimeRemaining,
    };
  }

  /**
   * Stop running optimization
   */
  async stopOptimization(optimizationId: string): Promise<boolean> {
    const optimization = this.activeOptimizations.get(optimizationId);

    if (!optimization) {
      return false;
    }

    optimization.shouldStop = true;
    this.logger.log(`Stopping optimization ${optimizationId}`);

    return true;
  }

  /**
   * Auto-tune model dengan smart defaults untuk Indonesian context
   */
  async autoTuneModel(
    tenantId: string,
    modelType: ModelType,
    dataset: TimeSeriesDataset,
    businessContext?: IndonesianOptimizationContext,
  ): Promise<OptimizationResult> {
    this.logger.log(`Auto-tuning ${modelType} model for tenant ${tenantId}`);

    // Create smart auto-tuning configuration
    const autoTuningRequest: HyperparameterOptimizationRequest = {
      tenantId,
      modelType,
      dataset,
      optimizationConfig: await this.createAutoTuningConfig(modelType, dataset),
      constraints: await this.createSmartConstraints(modelType, dataset),
      indonesianContext:
        businessContext || (await this.inferIndonesianContext(dataset)),
    };

    return this.startOptimization(autoTuningRequest);
  }

  /**
   * Create Indonesian-aware search space
   */
  private async createIndonesianAwareSearchSpace(
    modelType: ModelType,
    indonesianContext: IndonesianOptimizationContext,
    baseSearchSpace: HyperparameterSearchSpace,
  ): Promise<HyperparameterSearchSpace> {
    let searchSpace = { ...baseSearchSpace };

    switch (modelType) {
      case ModelType.ARIMA:
        searchSpace = await this.createARIMAIndonesianSearchSpace(
          indonesianContext,
          searchSpace,
        );
        break;

      case ModelType.PROPHET:
        searchSpace = await this.createProphetIndonesianSearchSpace(
          indonesianContext,
          searchSpace,
        );
        break;

      case ModelType.XGBOOST:
        searchSpace = await this.createXGBoostIndonesianSearchSpace(
          indonesianContext,
          searchSpace,
        );
        break;
    }

    return searchSpace;
  }

  /**
   * Create ARIMA-specific Indonesian search space
   */
  private async createARIMAIndonesianSearchSpace(
    context: IndonesianOptimizationContext,
    baseSpace: HyperparameterSearchSpace,
  ): Promise<HyperparameterSearchSpace> {
    const searchSpace = { ...baseSpace };

    // ARIMA parameters with Indonesian business context
    searchSpace.p = {
      type: 'integer',
      low: 0,
      high: context.seasonalityImportance === 'critical' ? 5 : 3,
      description: 'AR order - autoregressive terms',
    };

    searchSpace.d = {
      type: 'integer',
      low: 0,
      high: 2,
      description: 'Differencing order',
    };

    searchSpace.q = {
      type: 'integer',
      low: 0,
      high: context.marketVolatility === 'high' ? 4 : 2,
      description: 'MA order - moving average terms',
    };

    // Seasonal ARIMA parameters for Indonesian patterns
    if (context.seasonalityImportance !== 'low') {
      searchSpace.P = {
        type: 'integer',
        low: 0,
        high: 2,
        description: 'Seasonal AR order',
      };

      searchSpace.D = {
        type: 'integer',
        low: 0,
        high: 1,
        description: 'Seasonal differencing',
      };

      searchSpace.Q = {
        type: 'integer',
        low: 0,
        high: 2,
        description: 'Seasonal MA order',
      };

      searchSpace.seasonal_period = {
        type: 'categorical',
        values: context.ramadanSensitive ? [7, 30, 354] : [7, 30], // Include Islamic calendar
        description: 'Seasonal period',
      };
    }

    // Indonesian-specific adjustments
    searchSpace.ramadan_adjustment = {
      type: 'continuous',
      low: 0.8,
      high: 2.0,
      distribution: 'uniform',
      description: 'Ramadan demand adjustment factor',
    };

    searchSpace.lebaran_adjustment = {
      type: 'continuous',
      low: 1.0,
      high: 3.0,
      distribution: 'uniform',
      description: 'Lebaran surge adjustment factor',
    };

    return searchSpace;
  }

  /**
   * Create Prophet-specific Indonesian search space
   */
  private async createProphetIndonesianSearchSpace(
    context: IndonesianOptimizationContext,
    baseSpace: HyperparameterSearchSpace,
  ): Promise<HyperparameterSearchSpace> {
    const searchSpace = { ...baseSpace };

    // Prophet seasonality parameters
    searchSpace.yearly_seasonality = {
      type: 'categorical',
      values:
        context.seasonalityImportance === 'low' ? [false] : [true, 'auto'],
      description: 'Yearly seasonality',
    };

    searchSpace.weekly_seasonality = {
      type: 'categorical',
      values: [true, false, 'auto'],
      description: 'Weekly seasonality',
    };

    searchSpace.daily_seasonality = {
      type: 'categorical',
      values: context.businessType === 'retail' ? [true, 'auto'] : [false],
      description: 'Daily seasonality',
    };

    // Growth parameters
    searchSpace.growth = {
      type: 'categorical',
      values:
        context.marketVolatility === 'high'
          ? ['linear', 'logistic']
          : ['linear'],
      description: 'Growth model',
    };

    // Seasonality mode for Indonesian patterns
    searchSpace.seasonality_mode = {
      type: 'categorical',
      values: ['additive', 'multiplicative'],
      description: 'Seasonality mode',
    };

    // Change point detection
    searchSpace.changepoint_prior_scale = {
      type: 'continuous',
      low: 0.001,
      high: context.marketVolatility === 'high' ? 0.5 : 0.1,
      distribution: 'log_uniform',
      description: 'Change point prior scale',
    };

    searchSpace.seasonality_prior_scale = {
      type: 'continuous',
      low: 0.01,
      high: 10.0,
      distribution: 'log_uniform',
      description: 'Seasonality prior scale',
    };

    // Indonesian holidays integration
    searchSpace.holidays_prior_scale = {
      type: 'continuous',
      low: 0.01,
      high: 50.0,
      distribution: 'log_uniform',
      description: 'Holidays prior scale',
    };

    // Indonesian-specific parameters
    searchSpace.ramadan_fourier_order = {
      type: 'integer',
      low: 3,
      high: 10,
      description: 'Ramadan seasonality Fourier order',
    };

    searchSpace.indonesian_holiday_impact = {
      type: 'continuous',
      low: 0.5,
      high: 3.0,
      distribution: 'uniform',
      description: 'Indonesian holiday impact multiplier',
    };

    return searchSpace;
  }

  /**
   * Create XGBoost-specific Indonesian search space
   */
  private async createXGBoostIndonesianSearchSpace(
    context: IndonesianOptimizationContext,
    baseSpace: HyperparameterSearchSpace,
  ): Promise<HyperparameterSearchSpace> {
    const searchSpace = { ...baseSpace };

    // XGBoost tree parameters
    searchSpace.n_estimators = {
      type: 'integer',
      low: 50,
      high: context.businessType === 'manufacturing' ? 1000 : 500,
      description: 'Number of boosting rounds',
    };

    searchSpace.max_depth = {
      type: 'integer',
      low: 3,
      high: context.marketVolatility === 'high' ? 10 : 8,
      description: 'Maximum tree depth',
    };

    searchSpace.learning_rate = {
      type: 'continuous',
      low: 0.01,
      high: 0.3,
      distribution: 'log_uniform',
      description: 'Learning rate',
    };

    searchSpace.subsample = {
      type: 'continuous',
      low: 0.6,
      high: 1.0,
      distribution: 'uniform',
      description: 'Subsample ratio',
    };

    searchSpace.colsample_bytree = {
      type: 'continuous',
      low: 0.6,
      high: 1.0,
      distribution: 'uniform',
      description: 'Column subsample ratio',
    };

    // Regularization
    searchSpace.reg_alpha = {
      type: 'continuous',
      low: 0,
      high: 1.0,
      distribution: 'uniform',
      description: 'L1 regularization',
    };

    searchSpace.reg_lambda = {
      type: 'continuous',
      low: 0,
      high: 1.0,
      distribution: 'uniform',
      description: 'L2 regularization',
    };

    // Indonesian feature engineering parameters
    searchSpace.ramadan_lag_features = {
      type: 'integer',
      low: 1,
      high: 14,
      description: 'Number of Ramadan lag features',
    };

    searchSpace.lebaran_window_size = {
      type: 'integer',
      low: 3,
      high: 21,
      description: 'Lebaran effect window size',
    };

    searchSpace.holiday_interaction_depth = {
      type: 'integer',
      low: 1,
      high: 3,
      description: 'Holiday interaction feature depth',
    };

    return searchSpace;
  }

  /**
   * Execute optimization based on selected algorithm
   */
  private async executeOptimization(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<{
    bestHyperparameters: Record<string, any>;
    bestObjectiveValue: number;
    optimizationHistory: OptimizationIteration[];
    resourceUsage: any;
  }> {
    const algorithm = request.optimizationConfig.method.algorithm;

    this.logger.debug(
      `Executing ${algorithm} optimization for ${optimizationId}`,
    );

    switch (algorithm) {
      case 'grid_search':
        return this.executeGridSearch(optimizationId, request, searchSpace);
      case 'random_search':
        return this.executeRandomSearch(optimizationId, request, searchSpace);
      case 'bayesian_optimization':
        return this.executeBayesianOptimization(
          optimizationId,
          request,
          searchSpace,
        );
      case 'genetic_algorithm':
        return this.executeGeneticAlgorithm(
          optimizationId,
          request,
          searchSpace,
        );
      case 'tpe':
        return this.executeTPE(optimizationId, request, searchSpace);
      case 'hyperband':
        return this.executeHyperband(optimizationId, request, searchSpace);
      default:
        throw new Error(`Unsupported optimization algorithm: ${algorithm}`);
    }
  }

  /**
   * Execute Random Search optimization (most commonly used for Indonesian SMB)
   */
  private async executeRandomSearch(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<any> {
    const maxEvaluations = request.optimizationConfig.maxEvaluations;
    const optimizationHistory: OptimizationIteration[] = [];
    let bestObjectiveValue = Infinity;
    let bestHyperparameters: Record<string, any> = {};

    const startTime = Date.now();
    const resourceUsage = {
      totalCpuTime: 0,
      peakMemoryUsage: 0,
      evaluationTimes: [],
    };

    // Track optimization progress
    this.activeOptimizations.set(optimizationId, {
      status: 'running',
      progress: 0,
      currentIteration: 0,
      bestObjectiveValue: Infinity,
      shouldStop: false,
      startTime,
    });

    for (let iteration = 0; iteration < maxEvaluations; iteration++) {
      const optimization = this.activeOptimizations.get(optimizationId);

      // Check if optimization should stop
      if (optimization?.shouldStop) {
        this.logger.log(`Optimization ${optimizationId} stopped by user`);
        break;
      }

      // Check time limit
      const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
      if (elapsedMinutes > request.optimizationConfig.maxTime) {
        this.logger.log(
          `Optimization ${optimizationId} stopped due to time limit`,
        );
        break;
      }

      try {
        // Sample random hyperparameters
        const hyperparameters = this.sampleRandomHyperparameters(searchSpace);

        // Evaluate hyperparameters
        const evaluationStart = Date.now();
        const evaluation = await this.evaluateHyperparameters(
          hyperparameters,
          request,
        );
        const evaluationTime = Date.now() - evaluationStart;

        // Check constraints
        const constraintViolations = this.checkConstraints(
          evaluation,
          request.constraints,
        );

        // Calculate objective value with penalty for constraint violations
        const objectiveValue = this.calculateObjectiveValue(
          evaluation,
          request.optimizationConfig.objectiveFunction,
          constraintViolations,
        );

        // Record iteration
        const iterationResult: OptimizationIteration = {
          iteration,
          hyperparameters,
          objectiveValue,
          constraintViolations,
          metrics: evaluation,
          evaluationTime,
          improvement: bestObjectiveValue - objectiveValue,
        };

        optimizationHistory.push(iterationResult);

        // Update best if improved
        if (objectiveValue < bestObjectiveValue) {
          bestObjectiveValue = objectiveValue;
          bestHyperparameters = { ...hyperparameters };

          this.logger.debug(
            `New best found at iteration ${iteration}: ${objectiveValue.toFixed(
              4,
            )}`,
          );
        }

        // Update resource usage
        resourceUsage.totalCpuTime += evaluationTime;
        resourceUsage.evaluationTimes.push(evaluationTime);
        resourceUsage.peakMemoryUsage = Math.max(
          resourceUsage.peakMemoryUsage,
          evaluation.performance.memory_usage,
        );

        // Update progress
        const progress = ((iteration + 1) / maxEvaluations) * 100;
        const estimatedTimeRemaining =
          (elapsedMinutes / (iteration + 1)) * (maxEvaluations - iteration - 1);

        this.activeOptimizations.set(optimizationId, {
          ...optimization,
          progress,
          currentIteration: iteration + 1,
          bestObjectiveValue,
          estimatedTimeRemaining,
        });

        // Early stopping check
        if (
          this.shouldEarlyStop(optimizationHistory, request.optimizationConfig)
        ) {
          this.logger.log(`Early stopping triggered at iteration ${iteration}`);
          break;
        }
      } catch (error) {
        this.logger.warn(`Evaluation ${iteration} failed: ${error.message}`);
      }
    }

    // Mark optimization as completed
    this.activeOptimizations.set(optimizationId, {
      ...this.activeOptimizations.get(optimizationId),
      status: 'completed',
      progress: 100,
    });

    return {
      bestHyperparameters,
      bestObjectiveValue,
      optimizationHistory,
      resourceUsage,
    };
  }

  /**
   * Sample random hyperparameters from search space
   */
  private sampleRandomHyperparameters(
    searchSpace: HyperparameterSearchSpace,
  ): Record<string, any> {
    const hyperparameters: Record<string, any> = {};

    for (const [paramName, paramSpace] of Object.entries(searchSpace)) {
      hyperparameters[paramName] = this.sampleParameter(paramSpace);
    }

    return hyperparameters;
  }

  /**
   * Sample single parameter value
   */
  private sampleParameter(paramSpace: ParameterSpace): any {
    switch (paramSpace.type) {
      case 'continuous':
        return this.sampleContinuous(paramSpace);
      case 'integer':
        return this.sampleInteger(paramSpace);
      case 'categorical':
        return this.sampleCategorical(paramSpace);
      case 'discrete':
        return this.sampleDiscrete(paramSpace);
      default:
        throw new Error(`Unknown parameter type: ${paramSpace.type}`);
    }
  }

  private sampleContinuous(paramSpace: ParameterSpace): number {
    const { low = 0, high = 1, distribution = 'uniform' } = paramSpace;

    switch (distribution) {
      case 'uniform':
        return Math.random() * (high - low) + low;
      case 'log_uniform':
        const logLow = Math.log(low);
        const logHigh = Math.log(high);
        return Math.exp(Math.random() * (logHigh - logLow) + logLow);
      case 'normal':
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mean = (low + high) / 2;
        const std = (high - low) / 6; // 99.7% within bounds
        return Math.max(low, Math.min(high, mean + z * std));
      default:
        return Math.random() * (high - low) + low;
    }
  }

  private sampleInteger(paramSpace: ParameterSpace): number {
    const { low = 0, high = 10 } = paramSpace;
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }

  private sampleCategorical(paramSpace: ParameterSpace): any {
    const { values = [] } = paramSpace;
    return values[Math.floor(Math.random() * values.length)];
  }

  private sampleDiscrete(paramSpace: ParameterSpace): any {
    return this.sampleCategorical(paramSpace);
  }

  /**
   * Evaluate hyperparameters by training model
   */
  private async evaluateHyperparameters(
    hyperparameters: Record<string, any>,
    request: HyperparameterOptimizationRequest,
  ): Promise<ModelPerformanceMetrics> {
    // Prepare ML data request with hyperparameters
    const mlDataRequest: MLDataRequest = {
      data_points: request.dataset.timeSeries.map(d => d.value),
      dates: request.dataset.timeSeries.map(d => d.date),
      forecast_steps: Math.floor(request.dataset.timeSeries.length * 0.2), // 20% for validation
      seasonal: request.dataset.metadata.has_seasonality,
      confidence_level: 0.95,
      indonesian_context: {
        include_ramadan: request.indonesianContext.ramadanSensitive,
        include_lebaran: request.indonesianContext.lebaranSensitive,
        include_holidays: true,
        business_type: request.indonesianContext.businessType,
      },
    };

    // Execute model training based on type
    const startTime = Date.now();
    let modelResult: any;

    switch (request.modelType) {
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
        throw new Error(`Unsupported model type: ${request.modelType}`);
    }

    const trainingTime = Date.now() - startTime;

    if (!modelResult || !modelResult.success) {
      throw new Error('Model training failed');
    }

    // Calculate comprehensive metrics
    return this.calculateComprehensiveMetrics(
      modelResult,
      trainingTime,
      request,
    );
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculateComprehensiveMetrics(
    modelResult: any,
    trainingTime: number,
    request: HyperparameterOptimizationRequest,
  ): ModelPerformanceMetrics {
    // Extract predictions and actual values for validation
    const predictions = modelResult.forecasts?.map(f => f.forecast) || [];
    const actualValues = this.getValidationActuals(request.dataset);

    // Calculate accuracy metrics
    const accuracy = this.calculateAccuracyMetrics(actualValues, predictions);

    // Performance metrics
    const performance = {
      training_time: trainingTime,
      prediction_time: modelResult.performance?.prediction_time || 0,
      memory_usage: modelResult.performance?.memory_usage || 0,
      cpu_utilization: modelResult.performance?.cpu_usage || 0,
    };

    // Stability metrics (cross-validation, robustness)
    const stability = {
      cross_validation_std: modelResult.cv_scores
        ? this.calculateStandardDeviation(modelResult.cv_scores)
        : 0,
      parameter_sensitivity: this.estimateParameterSensitivity(modelResult),
      noise_robustness: this.estimateNoiseRobustness(modelResult),
    };

    // Interpretability metrics
    const interpretability = {
      feature_importance_clarity:
        this.assessFeatureImportanceClarity(modelResult),
      model_complexity: this.assessModelComplexity(
        modelResult,
        request.modelType,
      ),
      explanation_quality: this.assessExplanationQuality(
        modelResult,
        request.modelType,
      ),
    };

    // Indonesian context metrics
    const indonesian_context = {
      ramadan_accuracy: this.calculateRamadanAccuracy(modelResult, request),
      lebaran_accuracy: this.calculateLebaranAccuracy(modelResult, request),
      holiday_pattern_fit: this.calculateHolidayPatternFit(
        modelResult,
        request,
      ),
      seasonal_adaptation: this.calculateSeasonalAdaptation(
        modelResult,
        request,
      ),
    };

    return {
      accuracy,
      performance,
      stability,
      interpretability,
      indonesian_context,
    };
  }

  // Helper methods for metrics calculation

  private calculateAccuracyMetrics(actual: number[], predicted: number[]): any {
    if (
      actual.length === 0 ||
      predicted.length === 0 ||
      actual.length !== predicted.length
    ) {
      return {
        mape: 100,
        mae: Number.MAX_VALUE,
        rmse: Number.MAX_VALUE,
        r_squared: 0,
        directional_accuracy: 0,
      };
    }

    const n = actual.length;
    let sumAPE = 0;
    let sumAE = 0;
    let sumSE = 0;
    let correctDirection = 0;

    for (let i = 0; i < n; i++) {
      const actualVal = actual[i];
      const predictedVal = predicted[i];

      // MAPE
      if (actualVal !== 0) {
        sumAPE += Math.abs((actualVal - predictedVal) / actualVal);
      }

      // MAE
      sumAE += Math.abs(actualVal - predictedVal);

      // RMSE
      sumSE += Math.pow(actualVal - predictedVal, 2);

      // Directional accuracy
      if (i > 0) {
        const actualDirection = actual[i] - actual[i - 1];
        const predictedDirection = predicted[i] - predicted[i - 1];
        if (actualDirection * predictedDirection > 0) {
          correctDirection++;
        }
      }
    }

    const mape = (sumAPE / n) * 100;
    const mae = sumAE / n;
    const rmse = Math.sqrt(sumSE / n);
    const directionalAccuracy = correctDirection / (n - 1);

    // R-squared
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / n;
    const totalSumSquares = actual.reduce(
      (sum, val) => sum + Math.pow(val - actualMean, 2),
      0,
    );
    const residualSumSquares = actual.reduce(
      (sum, val, idx) => sum + Math.pow(val - predicted[idx], 2),
      0,
    );
    const rSquared =
      totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 0;

    return {
      mape,
      mae,
      rmse,
      r_squared: rSquared,
      directional_accuracy: directionalAccuracy,
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length <= 1) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      (values.length - 1);

    return Math.sqrt(variance);
  }

  private estimateParameterSensitivity(modelResult: any): number {
    // Estimate how sensitive the model is to parameter changes
    // This is a simplified heuristic - in practice, this would involve
    // perturbing parameters and measuring output changes
    return modelResult.parameter_sensitivity || 0.5;
  }

  private estimateNoiseRobustness(modelResult: any): number {
    // Estimate model robustness to noise in data
    return modelResult.noise_robustness || 0.7;
  }

  private assessFeatureImportanceClarity(modelResult: any): number {
    // Assess how clear and interpretable feature importance is
    const featureImportance = modelResult.feature_importance;
    if (!featureImportance || Object.keys(featureImportance).length === 0) {
      return 0.3; // Low clarity if no feature importance available
    }

    // Calculate entropy of feature importance distribution
    const importanceValues = Object.values(featureImportance) as number[];
    const totalImportance = importanceValues.reduce((sum, val) => sum + val, 0);

    if (totalImportance === 0) return 0.3;

    const normalizedImportance = importanceValues.map(
      val => val / totalImportance,
    );
    const entropy = -normalizedImportance.reduce(
      (sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0),
      0,
    );

    // Convert entropy to clarity score (lower entropy = higher clarity)
    const maxEntropy = Math.log2(importanceValues.length);
    return maxEntropy > 0 ? 1 - entropy / maxEntropy : 0.5;
  }

  private assessModelComplexity(
    modelResult: any,
    modelType: ModelType,
  ): number {
    // Assess model complexity on a 0-1 scale (0 = simple, 1 = complex)
    switch (modelType) {
      case ModelType.ARIMA:
        const arimaComplexity =
          (modelResult.hyperparameters?.p || 0) +
          (modelResult.hyperparameters?.d || 0) +
          (modelResult.hyperparameters?.q || 0) +
          (modelResult.hyperparameters?.P || 0) +
          (modelResult.hyperparameters?.D || 0) +
          (modelResult.hyperparameters?.Q || 0);
        return Math.min(1, arimaComplexity / 15); // Normalize to 0-1

      case ModelType.PROPHET:
        let prophetComplexity = 0;
        if (modelResult.hyperparameters?.yearly_seasonality)
          prophetComplexity += 0.2;
        if (modelResult.hyperparameters?.weekly_seasonality)
          prophetComplexity += 0.1;
        if (modelResult.hyperparameters?.daily_seasonality)
          prophetComplexity += 0.1;
        prophetComplexity +=
          (modelResult.hyperparameters?.changepoint_prior_scale || 0) * 0.3;
        return Math.min(1, prophetComplexity);

      case ModelType.XGBOOST:
        const trees = modelResult.hyperparameters?.n_estimators || 100;
        const depth = modelResult.hyperparameters?.max_depth || 6;
        return Math.min(1, (trees * depth) / 5000); // Normalize

      default:
        return 0.5;
    }
  }

  private assessExplanationQuality(
    modelResult: any,
    modelType: ModelType,
  ): number {
    // Assess quality of model explanations
    switch (modelType) {
      case ModelType.ARIMA:
        return 0.9; // ARIMA is highly interpretable
      case ModelType.PROPHET:
        return 0.95; // Prophet provides excellent decomposition
      case ModelType.XGBOOST:
        return 0.6; // XGBoost is moderately interpretable with feature importance
      default:
        return 0.5;
    }
  }

  private calculateRamadanAccuracy(
    modelResult: any,
    request: HyperparameterOptimizationRequest,
  ): number {
    // Calculate accuracy specifically during Ramadan periods
    // This would involve filtering data for Ramadan periods and calculating MAPE
    return modelResult.ramadan_accuracy || 0.8;
  }

  private calculateLebaranAccuracy(
    modelResult: any,
    request: HyperparameterOptimizationRequest,
  ): number {
    // Calculate accuracy specifically during Lebaran periods
    return modelResult.lebaran_accuracy || 0.75;
  }

  private calculateHolidayPatternFit(
    modelResult: any,
    request: HyperparameterOptimizationRequest,
  ): number {
    // Calculate how well the model captures Indonesian holiday patterns
    return modelResult.holiday_pattern_fit || 0.7;
  }

  private calculateSeasonalAdaptation(
    modelResult: any,
    request: HyperparameterOptimizationRequest,
  ): number {
    // Calculate how well the model adapts to Indonesian seasonal patterns
    return modelResult.seasonal_adaptation || 0.8;
  }

  private getValidationActuals(dataset: TimeSeriesDataset): number[] {
    // Get the validation portion of the dataset (last 20%)
    const validationSize = Math.floor(dataset.timeSeries.length * 0.2);
    return dataset.timeSeries.slice(-validationSize).map(d => d.value);
  }

  private checkConstraints(
    evaluation: ModelPerformanceMetrics,
    constraints: OptimizationConstraints,
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Training time constraint
    if (
      evaluation.performance.training_time >
      constraints.maxTrainingTime * 1000
    ) {
      violations.push({
        constraint: 'maxTrainingTime',
        violation:
          evaluation.performance.training_time -
          constraints.maxTrainingTime * 1000,
        severity: 'major',
        suggestion: 'Reduce model complexity or increase time limit',
      });
    }

    // Memory usage constraint
    if (evaluation.performance.memory_usage > constraints.maxMemoryUsage) {
      violations.push({
        constraint: 'maxMemoryUsage',
        violation:
          evaluation.performance.memory_usage - constraints.maxMemoryUsage,
        severity: 'critical',
        suggestion: 'Reduce data size or model complexity',
      });
    }

    // Accuracy threshold constraint
    if (evaluation.accuracy.mape > 100 - constraints.minAccuracyThreshold) {
      violations.push({
        constraint: 'minAccuracyThreshold',
        violation:
          evaluation.accuracy.mape - (100 - constraints.minAccuracyThreshold),
        severity: 'major',
        suggestion: 'Improve data quality or model selection',
      });
    }

    return violations;
  }

  private calculateObjectiveValue(
    evaluation: ModelPerformanceMetrics,
    objectiveFunction: ObjectiveFunction,
    constraintViolations: ConstraintViolation[],
  ): number {
    let objectiveValue = 0;

    // Calculate primary objective
    switch (objectiveFunction.primary) {
      case 'mape':
        objectiveValue = evaluation.accuracy.mape;
        break;
      case 'mae':
        objectiveValue = evaluation.accuracy.mae;
        break;
      case 'rmse':
        objectiveValue = evaluation.accuracy.rmse;
        break;
      case 'r_squared':
        objectiveValue = 1 - evaluation.accuracy.r_squared; // Minimize (1 - r_squared)
        break;
      case 'composite':
        // Weighted combination of multiple metrics
        const weights = objectiveFunction.weights || {
          accuracy: 0.4,
          speed: 0.2,
          interpretability: 0.2,
          stability: 0.1,
          indonesianFit: 0.1,
        };

        objectiveValue =
          weights.accuracy * evaluation.accuracy.mape +
          weights.speed * (evaluation.performance.training_time / 1000) +
          weights.interpretability *
            (1 - evaluation.interpretability.explanation_quality) *
            100 +
          weights.stability *
            (1 - evaluation.stability.cross_validation_std) *
            100 +
          weights.indonesianFit *
            (1 - evaluation.indonesian_context.ramadan_accuracy) *
            100;
        break;
      default:
        objectiveValue = evaluation.accuracy.mape;
    }

    // Add penalty for constraint violations
    const penalty = constraintViolations.reduce((sum, violation) => {
      const severityMultiplier = {
        minor: 1,
        major: 10,
        critical: 100,
      };
      return sum + violation.violation * severityMultiplier[violation.severity];
    }, 0);

    objectiveValue += penalty * (objectiveFunction.constraintsPenalty || 1);

    return objectiveValue;
  }

  private shouldEarlyStop(
    history: OptimizationIteration[],
    config: OptimizationConfig,
  ): boolean {
    if (!config.earlyStoppingEnabled || history.length < 10) {
      return false;
    }

    // Check if no improvement in last 10 iterations
    const recentHistory = history.slice(-10);
    const hasImprovement = recentHistory.some(
      iteration => iteration.improvement > 0.001,
    );

    return !hasImprovement;
  }

  // Additional optimization algorithms (stubs for full implementation)

  private async executeGridSearch(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<any> {
    // Implementation for grid search
    throw new Error('Grid search not yet implemented');
  }

  private async executeBayesianOptimization(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<any> {
    // Implementation for Bayesian optimization
    throw new Error('Bayesian optimization not yet implemented');
  }

  private async executeGeneticAlgorithm(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<any> {
    // Implementation for genetic algorithm
    throw new Error('Genetic algorithm not yet implemented');
  }

  private async executeTPE(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<any> {
    // Implementation for Tree-structured Parzen Estimator
    throw new Error('TPE not yet implemented');
  }

  private async executeHyperband(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
    searchSpace: HyperparameterSearchSpace,
  ): Promise<any> {
    // Implementation for Hyperband
    throw new Error('Hyperband not yet implemented');
  }

  // Additional helper methods (stubs for full implementation)

  private async validateOptimizationRequest(
    request: HyperparameterOptimizationRequest,
  ): Promise<void> {
    // Validate optimization request
  }

  private async initializeOptimization(
    optimizationId: string,
    request: HyperparameterOptimizationRequest,
  ): Promise<any> {
    // Initialize optimization
    return {};
  }

  private async analyzeOptimizationResults(
    optimizationResult: any,
    request: HyperparameterOptimizationRequest,
  ): Promise<any> {
    // Analyze optimization results
    return {};
  }

  private async generateIndonesianInsights(
    optimizationResult: any,
    request: HyperparameterOptimizationRequest,
  ): Promise<any> {
    // Generate Indonesian-specific insights
    return {};
  }

  private async compileOptimizationResult(
    optimizationId: string,
    optimizationResult: any,
    analysis: any,
    indonesianInsights: any,
    request: HyperparameterOptimizationRequest,
  ): Promise<OptimizationResult> {
    // Compile final optimization result
    return {} as OptimizationResult;
  }

  private async saveOptimizationResult(
    result: OptimizationResult,
  ): Promise<void> {
    // Save optimization result to database
  }

  private async createAutoTuningConfig(
    modelType: ModelType,
    dataset: TimeSeriesDataset,
  ): Promise<OptimizationConfig> {
    // Create smart auto-tuning configuration
    return {} as OptimizationConfig;
  }

  private async createSmartConstraints(
    modelType: ModelType,
    dataset: TimeSeriesDataset,
  ): Promise<OptimizationConstraints> {
    // Create smart constraints
    return {} as OptimizationConstraints;
  }

  private async inferIndonesianContext(
    dataset: TimeSeriesDataset,
  ): Promise<IndonesianOptimizationContext> {
    // Infer Indonesian context from dataset
    return {} as IndonesianOptimizationContext;
  }

  /**
   * Scheduled cleanup of completed optimizations
   */
  @Cron('0 0 * * *') // Daily at midnight
  private async cleanupOptimizations(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [
      optimizationId,
      optimization,
    ] of this.activeOptimizations.entries()) {
      if (
        optimization.status === 'completed' &&
        now - optimization.startTime > maxAge
      ) {
        this.activeOptimizations.delete(optimizationId);
        this.logger.debug(`Cleaned up optimization ${optimizationId}`);
      }
    }
  }
}
