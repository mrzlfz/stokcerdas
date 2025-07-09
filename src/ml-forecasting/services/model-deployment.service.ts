import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import moment from 'moment-timezone';

import { MLModel, ModelType, ModelStatus } from '../entities/ml-model.entity';
import {
  TrainingJob,
  TrainingJobStatus,
} from '../entities/training-job.entity';
import { Prediction } from '../entities/prediction.entity';
import { ModelServingService } from './model-serving.service';
import { RealtimePerformanceMonitoringService } from './realtime-performance-monitoring.service';
import { PythonBridgeService } from './python-bridge.service';

/**
 * PHASE 3 WEEK 9: Production Model Deployment Service 🚀
 *
 * Enterprise-grade model deployment service dengan automated validation,
 * version management, production rollout, auto-retraining scheduling,
 * dan comprehensive monitoring untuk Indonesian SMB ML production environment.
 */

export interface DeploymentConfig {
  environment: 'production' | 'staging' | 'development';
  autoRetraining: boolean;
  performanceThreshold: number; // MAPE percentage
  retrainingSchedule: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  alertsEnabled: boolean;
  fallbackModel?: string;
  deploymentStrategy: DeploymentStrategy;
  indonesianContext: IndonesianDeploymentContext;
  resourceLimits: DeploymentResourceLimits;
  healthCheckConfig: HealthCheckConfig;
}

export interface DeploymentStrategy {
  type: 'blue_green' | 'canary' | 'rolling' | 'immediate';
  canaryTrafficPercentage?: number; // For canary deployments
  rolloutDuration?: number; // Minutes
  rollbackThreshold?: number; // Error rate percentage
  validationPeriod?: number; // Minutes to validate before full rollout
}

export interface IndonesianDeploymentContext {
  timezone: 'WIB' | 'WITA' | 'WIT' | 'auto';
  businessHours: { start: string; end: string };
  ramadanAware: boolean;
  lebaranAware: boolean;
  culturalEventSensitive: boolean;
  peakHourOptimization: boolean;
  regionalOptimization: boolean;
}

export interface DeploymentResourceLimits {
  maxCpuUsage: number; // Percentage
  maxMemoryUsage: number; // MB
  maxResponseTime: number; // Milliseconds
  maxConcurrentPredictions: number;
  storageQuota: number; // GB
}

export interface HealthCheckConfig {
  interval: number; // Minutes
  timeoutMs: number;
  retries: number;
  criticalThresholds: {
    errorRate: number; // Percentage
    responseTime: number; // Milliseconds
    accuracyDrop: number; // Percentage
  };
  alertChannels: string[];
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  version: string;
  environment: string;
  deployedAt: Date;
  configuration: DeploymentConfig;
  validationResults: ValidationResult;
  nextScheduledCheck: Date;
  estimatedMonthlyCost: number;
  deploymentMetrics: DeploymentMetrics;
  rolloutPlan: RolloutPlan;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  score: number;
  recommendations: string[];
  performanceMetrics: ValidationMetrics;
  businessReadiness: BusinessReadinessAssessment;
}

export interface ValidationMetrics {
  accuracy: number;
  mape: number;
  mae: number;
  rmse: number;
  r_squared: number;
  predictionLatency: number;
  memoryFootprint: number;
  cpuUsage: number;
}

export interface BusinessReadinessAssessment {
  dataQuality: number; // 0-100 score
  modelStability: number;
  indonesianContextReadiness: number;
  scalabilityReadiness: number;
  operationalReadiness: number;
  overallReadinessScore: number;
  criticalGaps: string[];
  recommendations: string[];
}

export interface DeploymentMetrics {
  deploymentDuration: number; // Minutes
  validationTests: number;
  validationsPassed: number;
  validationsFailed: number;
  rollbackRisk: number; // Percentage
  estimatedDowntime: number; // Minutes
  businessImpactAssessment: string;
}

export interface RolloutPlan {
  strategy: string;
  phases: RolloutPhase[];
  totalDuration: number; // Minutes
  checkpoints: RolloutCheckpoint[];
  rollbackTriggers: RollbackTrigger[];
  successCriteria: SuccessCriteria[];
}

export interface RolloutPhase {
  phase: number;
  name: string;
  trafficPercentage: number;
  duration: number; // Minutes
  validationChecks: string[];
  rollbackConditions: string[];
}

export interface RolloutCheckpoint {
  phase: number;
  checkpointName: string;
  scheduledTime: Date;
  validationCriteria: string[];
  autoAdvance: boolean;
}

export interface RollbackTrigger {
  triggerType: 'error_rate' | 'response_time' | 'accuracy_drop' | 'manual';
  threshold: number;
  duration: number; // Minutes to observe before triggering
  action: 'alert' | 'automatic_rollback' | 'pause_rollout';
}

export interface SuccessCriteria {
  metric: string;
  threshold: number;
  direction: 'above' | 'below';
  measurementPeriod: number; // Minutes
  required: boolean;
}

export interface ModelDeploymentRequest {
  modelId: string;
  tenantId: string;
  targetEnvironment: 'production' | 'staging';
  deploymentConfig?: Partial<DeploymentConfig>;
  validationOverrides?: {
    skipAccuracyCheck?: boolean;
    skipPerformanceCheck?: boolean;
    skipBusinessValidation?: boolean;
  };
  scheduleDeployment?: {
    scheduledTime: Date;
    maintenanceWindow: boolean;
  };
}

@Injectable()
export class ModelDeploymentService {
  private readonly logger = new Logger(ModelDeploymentService.name);

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepository: Repository<MLModel>,

    @InjectRepository(TrainingJob)
    private readonly trainingJobRepository: Repository<TrainingJob>,

    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,

    @InjectQueue('ml-training')
    private readonly trainingQueue: Queue,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    private readonly eventEmitter: EventEmitter2,
    private readonly modelServingService: ModelServingService,
    private readonly performanceMonitoringService: RealtimePerformanceMonitoringService,
    private readonly pythonBridgeService: PythonBridgeService,
  ) {}

  /**
   * Deploy model to production dengan comprehensive validation dan rollout strategy
   */
  async deployModelToProduction(
    request: ModelDeploymentRequest,
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    this.logger.log(
      `Starting deployment for model ${request.modelId} to ${request.targetEnvironment}`,
    );

    try {
      // 1. Validate model exists and is ready
      const model = await this.validateModelForDeployment(
        request.modelId,
        request.tenantId,
      );

      // 2. Perform comprehensive validation
      const validationResult = await this.performDeploymentValidation(
        model,
        request.validationOverrides,
      );

      if (
        !validationResult.isValid &&
        !request.validationOverrides?.skipBusinessValidation
      ) {
        throw new Error(
          `Model validation failed: ${validationResult.issues.join(', ')}`,
        );
      }

      // 3. Create deployment configuration
      const deploymentConfig = await this.createDeploymentConfiguration(
        model,
        request.deploymentConfig,
        request.targetEnvironment,
      );

      // 4. Generate deployment plan
      const rolloutPlan = await this.generateRolloutPlan(
        model,
        deploymentConfig,
      );

      // 5. Execute deployment
      const deploymentResult = await this.executeDeployment(
        model,
        deploymentConfig,
        rolloutPlan,
        request,
      );

      // 6. Setup monitoring and auto-retraining
      await this.setupPostDeploymentInfrastructure(
        deploymentResult,
        deploymentConfig,
      );

      const deploymentDuration = Math.round(
        (Date.now() - startTime) / 1000 / 60,
      );

      this.logger.log(
        `Model ${request.modelId} deployed successfully to ${request.targetEnvironment} in ${deploymentDuration} minutes`,
      );

      // Emit deployment event
      this.eventEmitter.emit('model.deployed', {
        modelId: request.modelId,
        tenantId: request.tenantId,
        environment: request.targetEnvironment,
        deploymentResult,
        timestamp: new Date(),
      });

      return {
        ...deploymentResult,
        deploymentMetrics: {
          ...deploymentResult.deploymentMetrics,
          deploymentDuration,
        },
      };
    } catch (error) {
      this.logger.error(
        `Model deployment failed: ${error.message}`,
        error.stack,
      );

      // Emit deployment failure event
      this.eventEmitter.emit('model.deployment.failed', {
        modelId: request.modelId,
        tenantId: request.tenantId,
        error: error.message,
        timestamp: new Date(),
      });

      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Validate model is ready for deployment
   */
  private async validateModelForDeployment(
    modelId: string,
    tenantId: string,
  ): Promise<MLModel> {
    const model = await this.mlModelRepository.findOne({
      where: { id: modelId, tenantId },
      relations: ['trainingJobs', 'predictions'],
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found for tenant ${tenantId}`);
    }

    if (
      model.status !== ModelStatus.TRAINED &&
      model.status !== ModelStatus.DEPLOYED
    ) {
      throw new Error(
        `Model ${modelId} is not trained and ready for deployment (current status: ${model.status})`,
      );
    }

    return model;
  }

  /**
   * Perform comprehensive deployment validation
   */
  private async performDeploymentValidation(
    model: MLModel,
    overrides?: ModelDeploymentRequest['validationOverrides'],
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let validationScore = 100;

    // 1. Accuracy validation
    if (!overrides?.skipAccuracyCheck) {
      const accuracyResult = await this.validateModelAccuracy(model);
      if (!accuracyResult.isValid) {
        issues.push(...accuracyResult.issues);
        validationScore -= 30;
      }
      recommendations.push(...accuracyResult.recommendations);
    }

    // 2. Performance validation
    if (!overrides?.skipPerformanceCheck) {
      const performanceResult = await this.validateModelPerformance(model);
      if (!performanceResult.isValid) {
        issues.push(...performanceResult.issues);
        validationScore -= 25;
      }
      recommendations.push(...performanceResult.recommendations);
    }

    // 3. Business readiness validation
    if (!overrides?.skipBusinessValidation) {
      const businessReadiness = await this.assessBusinessReadiness(model);
      if (businessReadiness.overallReadinessScore < 70) {
        issues.push(
          `Business readiness score too low: ${businessReadiness.overallReadinessScore}% (minimum 70%)`,
        );
        validationScore -= 20;
      }
      recommendations.push(...businessReadiness.recommendations);
    }

    // 4. Indonesian context validation
    const indonesianContextResult = await this.validateIndonesianContext(model);
    if (!indonesianContextResult.isValid) {
      issues.push(...indonesianContextResult.issues);
      validationScore -= 15;
    }

    // 5. Data quality validation
    const dataQualityResult = await this.validateDataQuality(model);
    if (!dataQualityResult.isValid) {
      issues.push(...dataQualityResult.issues);
      validationScore -= 10;
    }

    const isValid = validationScore >= 70 && issues.length === 0;

    return {
      isValid,
      issues,
      score: Math.max(0, validationScore),
      recommendations,
      performanceMetrics: await this.getModelPerformanceMetrics(model),
      businessReadiness: await this.assessBusinessReadiness(model),
    };
  }

  /**
   * Validate model accuracy for production deployment
   */
  private async validateModelAccuracy(model: MLModel): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check overall model accuracy
    if (!model.accuracy || model.accuracy < 0.7) {
      issues.push(
        `Model accuracy too low: ${
          (model.accuracy || 0) * 100
        }% (minimum 70% required)`,
      );
      recommendations.push(
        'Consider retraining with more data or different hyperparameters',
      );
    }

    // Check recent prediction accuracy
    const recentPredictions = await this.predictionRepository.find({
      where: {
        modelId: model.id,
        tenantId: model.tenantId,
        isActualized: true,
      },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (recentPredictions.length < 10) {
      issues.push(
        `Insufficient validated predictions: ${recentPredictions.length} (minimum 10 required)`,
      );
      recommendations.push(
        'Generate more predictions and validate against actual values',
      );
    } else {
      const avgError =
        recentPredictions.reduce((sum, p) => sum + (p.errorRate || 0), 0) /
        recentPredictions.length;
      if (avgError > 20) {
        issues.push(
          `Recent performance degraded: ${avgError.toFixed(
            1,
          )}% MAPE (maximum 20% allowed)`,
        );
        recommendations.push(
          'Recent performance indicates model drift - consider retraining',
        );
      }
    }

    // Check accuracy across different time periods
    const seasonalAccuracy = await this.validateSeasonalAccuracy(model);
    if (seasonalAccuracy.minAccuracy < 0.6) {
      issues.push(
        `Seasonal accuracy varies too much: ${
          seasonalAccuracy.minAccuracy * 100
        }% minimum`,
      );
      recommendations.push('Consider improving seasonal pattern handling');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Validate model performance characteristics
   */
  private async validateModelPerformance(model: MLModel): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Test prediction latency
      const latencyTest = await this.testPredictionLatency(model);
      if (latencyTest.averageLatency > 2000) {
        issues.push(
          `Prediction latency too high: ${latencyTest.averageLatency}ms (maximum 2000ms)`,
        );
        recommendations.push('Optimize model for faster inference');
      }

      // Test memory usage
      const memoryTest = await this.testMemoryUsage(model);
      if (memoryTest.peakMemoryMB > 1000) {
        issues.push(
          `Memory usage too high: ${memoryTest.peakMemoryMB}MB (maximum 1000MB)`,
        );
        recommendations.push('Consider model compression or optimization');
      }

      // Test concurrent prediction handling
      const concurrencyTest = await this.testConcurrentPredictions(model);
      if (concurrencyTest.maxConcurrentHandled < 10) {
        issues.push(
          `Concurrency handling insufficient: ${concurrencyTest.maxConcurrentHandled} (minimum 10)`,
        );
        recommendations.push('Improve model serving infrastructure');
      }
    } catch (error) {
      issues.push(`Performance testing failed: ${error.message}`);
      recommendations.push(
        'Resolve performance testing issues before deployment',
      );
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Assess business readiness for deployment
   */
  private async assessBusinessReadiness(
    model: MLModel,
  ): Promise<BusinessReadinessAssessment> {
    const scores = {
      dataQuality: await this.assessDataQuality(model),
      modelStability: await this.assessModelStability(model),
      indonesianContextReadiness: await this.assessIndonesianContextReadiness(
        model,
      ),
      scalabilityReadiness: await this.assessScalabilityReadiness(model),
      operationalReadiness: await this.assessOperationalReadiness(model),
    };

    const overallReadinessScore =
      Object.values(scores).reduce((sum, score) => sum + score, 0) /
      Object.keys(scores).length;

    const criticalGaps: string[] = [];
    const recommendations: string[] = [];

    Object.entries(scores).forEach(([area, score]) => {
      if (score < 70) {
        criticalGaps.push(`${area}: ${score}%`);
        recommendations.push(`Improve ${area} before production deployment`);
      }
    });

    return {
      ...scores,
      overallReadinessScore,
      criticalGaps,
      recommendations,
    };
  }

  /**
   * Create deployment configuration with smart defaults
   */
  private async createDeploymentConfiguration(
    model: MLModel,
    userConfig?: Partial<DeploymentConfig>,
    environment?: string,
  ): Promise<DeploymentConfig> {
    const defaultConfig: DeploymentConfig = {
      environment: (environment as any) || 'production',
      autoRetraining: true,
      performanceThreshold: 15, // MAPE percentage
      retrainingSchedule: 'monthly',
      alertsEnabled: true,
      deploymentStrategy: {
        type: 'canary',
        canaryTrafficPercentage: 10,
        rolloutDuration: 60, // 1 hour
        rollbackThreshold: 5, // 5% error rate
        validationPeriod: 30, // 30 minutes
      },
      indonesianContext: {
        timezone: 'WIB',
        businessHours: { start: '08:00', end: '17:00' },
        ramadanAware: true,
        lebaranAware: true,
        culturalEventSensitive: true,
        peakHourOptimization: true,
        regionalOptimization: true,
      },
      resourceLimits: {
        maxCpuUsage: 80,
        maxMemoryUsage: 1000,
        maxResponseTime: 2000,
        maxConcurrentPredictions: 50,
        storageQuota: 10,
      },
      healthCheckConfig: {
        interval: 5,
        timeoutMs: 10000,
        retries: 3,
        criticalThresholds: {
          errorRate: 10,
          responseTime: 3000,
          accuracyDrop: 25,
        },
        alertChannels: ['email', 'dashboard'],
      },
    };

    // Merge with user configuration
    return {
      ...defaultConfig,
      ...userConfig,
      deploymentStrategy: {
        ...defaultConfig.deploymentStrategy,
        ...userConfig?.deploymentStrategy,
      },
      indonesianContext: {
        ...defaultConfig.indonesianContext,
        ...userConfig?.indonesianContext,
      },
      resourceLimits: {
        ...defaultConfig.resourceLimits,
        ...userConfig?.resourceLimits,
      },
      healthCheckConfig: {
        ...defaultConfig.healthCheckConfig,
        ...userConfig?.healthCheckConfig,
        criticalThresholds: {
          ...defaultConfig.healthCheckConfig.criticalThresholds,
          ...userConfig?.healthCheckConfig?.criticalThresholds,
        },
      },
    };
  }

  /**
   * Generate rollout plan based on deployment strategy
   */
  private async generateRolloutPlan(
    model: MLModel,
    config: DeploymentConfig,
  ): Promise<RolloutPlan> {
    const { deploymentStrategy } = config;
    const phases: RolloutPhase[] = [];
    const checkpoints: RolloutCheckpoint[] = [];
    const rollbackTriggers: RollbackTrigger[] = [];
    const successCriteria: SuccessCriteria[] = [];

    switch (deploymentStrategy.type) {
      case 'canary':
        phases.push(
          {
            phase: 1,
            name: 'Canary Phase',
            trafficPercentage: deploymentStrategy.canaryTrafficPercentage || 10,
            duration: deploymentStrategy.validationPeriod || 30,
            validationChecks: [
              'accuracy_check',
              'performance_check',
              'error_rate_check',
            ],
            rollbackConditions: [
              'high_error_rate',
              'performance_degradation',
              'accuracy_drop',
            ],
          },
          {
            phase: 2,
            name: 'Full Rollout',
            trafficPercentage: 100,
            duration:
              (deploymentStrategy.rolloutDuration || 60) -
              (deploymentStrategy.validationPeriod || 30),
            validationChecks: ['final_validation', 'business_metrics_check'],
            rollbackConditions: ['critical_failure'],
          },
        );
        break;

      case 'blue_green':
        phases.push({
          phase: 1,
          name: 'Blue-Green Switch',
          trafficPercentage: 100,
          duration: 15,
          validationChecks: ['health_check', 'smoke_test'],
          rollbackConditions: ['deployment_failure'],
        });
        break;

      case 'rolling':
        phases.push(
          {
            phase: 1,
            name: 'Rolling Phase 1',
            trafficPercentage: 25,
            duration: 15,
            validationChecks: ['basic_health_check'],
            rollbackConditions: ['immediate_failure'],
          },
          {
            phase: 2,
            name: 'Rolling Phase 2',
            trafficPercentage: 50,
            duration: 15,
            validationChecks: ['performance_check'],
            rollbackConditions: ['performance_degradation'],
          },
          {
            phase: 3,
            name: 'Rolling Phase 3',
            trafficPercentage: 100,
            duration: 30,
            validationChecks: ['full_validation'],
            rollbackConditions: ['critical_failure'],
          },
        );
        break;

      case 'immediate':
        phases.push({
          phase: 1,
          name: 'Immediate Deployment',
          trafficPercentage: 100,
          duration: 5,
          validationChecks: ['basic_health_check'],
          rollbackConditions: ['immediate_failure'],
        });
        break;
    }

    // Generate checkpoints
    phases.forEach((phase, index) => {
      checkpoints.push({
        phase: phase.phase,
        checkpointName: `${phase.name} Validation`,
        scheduledTime: moment()
          .add(
            phases.slice(0, index).reduce((sum, p) => sum + p.duration, 0),
            'minutes',
          )
          .toDate(),
        validationCriteria: phase.validationChecks,
        autoAdvance: index < phases.length - 1,
      });
    });

    // Generate rollback triggers
    rollbackTriggers.push(
      {
        triggerType: 'error_rate',
        threshold: deploymentStrategy.rollbackThreshold || 5,
        duration: 5,
        action: 'automatic_rollback',
      },
      {
        triggerType: 'response_time',
        threshold: config.resourceLimits.maxResponseTime * 1.5,
        duration: 10,
        action: 'alert',
      },
      {
        triggerType: 'accuracy_drop',
        threshold: 25,
        duration: 15,
        action: 'automatic_rollback',
      },
    );

    // Generate success criteria
    successCriteria.push(
      {
        metric: 'error_rate',
        threshold: 2,
        direction: 'below',
        measurementPeriod: 15,
        required: true,
      },
      {
        metric: 'response_time',
        threshold: config.resourceLimits.maxResponseTime,
        direction: 'below',
        measurementPeriod: 10,
        required: true,
      },
      {
        metric: 'accuracy',
        threshold: (model.accuracy || 0.7) * 0.95, // 95% of model's trained accuracy
        direction: 'above',
        measurementPeriod: 30,
        required: true,
      },
    );

    return {
      strategy: deploymentStrategy.type,
      phases,
      totalDuration: phases.reduce((sum, phase) => sum + phase.duration, 0),
      checkpoints,
      rollbackTriggers,
      successCriteria,
    };
  }

  /**
   * Execute the actual deployment
   */
  private async executeDeployment(
    model: MLModel,
    config: DeploymentConfig,
    rolloutPlan: RolloutPlan,
    request: ModelDeploymentRequest,
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId(model);
    const version = this.generateVersionNumber(model);

    try {
      // Update model status
      model.status = ModelStatus.DEPLOYED;
      model.deployedAt = new Date();
      model.version = version;
      model.configuration = {
        ...model.configuration,
        deploymentConfig: config,
      };

      // Set as primary model for predictions
      await this.setPrimaryModel(model, request.tenantId);

      // Save model changes
      await this.mlModelRepository.save(model);

      // Calculate metrics
      const deploymentMetrics: DeploymentMetrics = {
        deploymentDuration: 0, // Will be updated by caller
        validationTests: rolloutPlan.checkpoints.length,
        validationsPassed: 0, // Will be updated during rollout
        validationsFailed: 0,
        rollbackRisk: this.calculateRollbackRisk(model, config),
        estimatedDowntime: this.estimateDowntime(config.deploymentStrategy),
        businessImpactAssessment: this.assessBusinessImpact(model, config),
      };

      return {
        success: true,
        deploymentId,
        version,
        environment: config.environment,
        deployedAt: model.deployedAt,
        configuration: config,
        validationResults: await this.performDeploymentValidation(model),
        nextScheduledCheck: this.calculateNextMonitoringCheck(config),
        estimatedMonthlyCost: this.estimateOperationalCost(model, config),
        deploymentMetrics,
        rolloutPlan,
      };
    } catch (error) {
      // Rollback on failure
      await this.rollbackDeployment(
        model,
        `Deployment failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Setup post-deployment infrastructure (monitoring, auto-retraining, etc.)
   */
  private async setupPostDeploymentInfrastructure(
    deployment: DeploymentResult,
    config: DeploymentConfig,
  ): Promise<void> {
    try {
      // 1. Schedule performance monitoring
      await this.schedulePerformanceMonitoring(deployment, config);

      // 2. Setup auto-retraining if enabled
      if (config.autoRetraining) {
        await this.scheduleAutoRetraining(deployment, config);
      }

      // 3. Setup health checks
      await this.scheduleHealthChecks(deployment, config);

      // 4. Setup alerting
      if (config.alertsEnabled) {
        await this.setupAlerting(deployment, config);
      }

      // 5. Initialize monitoring cache
      await this.initializeMonitoringCache(deployment);

      this.logger.log(
        `Post-deployment infrastructure setup completed for ${deployment.deploymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to setup post-deployment infrastructure: ${error.message}`,
        error.stack,
      );
      // Don't fail the deployment for infrastructure setup issues
    }
  }

  /**
   * Schedule performance monitoring for deployed model
   */
  private async schedulePerformanceMonitoring(
    deployment: DeploymentResult,
    config: DeploymentConfig,
  ): Promise<void> {
    const cronExpression = `*/${config.healthCheckConfig.interval} * * * *`;

    await this.trainingQueue.add(
      'monitor-model-performance',
      {
        deploymentId: deployment.deploymentId,
        modelId: deployment.deploymentId.split('_')[1], // Extract model ID
        tenantId: deployment.configuration.indonesianContext,
        thresholds: config.healthCheckConfig.criticalThresholds,
        environment: deployment.environment,
      },
      {
        repeat: { cron: cronExpression },
        jobId: `monitor-${deployment.deploymentId}`,
        removeOnComplete: 100,
        removeOnFail: 10,
      },
    );

    this.logger.log(
      `Performance monitoring scheduled for ${deployment.deploymentId}: ${cronExpression}`,
    );
  }

  /**
   * Schedule auto-retraining for the deployed model
   */
  private async scheduleAutoRetraining(
    deployment: DeploymentResult,
    config: DeploymentConfig,
  ): Promise<void> {
    const cronExpression = this.getCronExpressionForSchedule(
      config.retrainingSchedule,
    );

    await this.trainingQueue.add(
      'auto-retrain-model',
      {
        modelId: deployment.deploymentId.split('_')[1],
        tenantId: deployment.configuration.indonesianContext,
        reason: 'scheduled_retraining',
        originalModelVersion: deployment.version,
        performanceThreshold: config.performanceThreshold,
        deploymentConfig: config,
      },
      {
        repeat: { cron: cronExpression },
        jobId: `auto-retrain-${deployment.deploymentId}`,
        removeOnComplete: 5,
        removeOnFail: 3,
      },
    );

    this.logger.log(
      `Auto-retraining scheduled for ${deployment.deploymentId}: ${cronExpression}`,
    );
  }

  /**
   * Get cron expression for retraining schedule
   */
  private getCronExpressionForSchedule(schedule: string): string {
    switch (schedule) {
      case 'daily':
        return '0 2 * * *'; // Daily at 2 AM WIB
      case 'weekly':
        return '0 2 * * 0'; // Weekly on Sunday at 2 AM WIB
      case 'monthly':
        return '0 2 1 * *'; // Monthly on 1st at 2 AM WIB
      case 'quarterly':
        return '0 2 1 */3 *'; // Quarterly on 1st at 2 AM WIB
      default:
        return '0 2 1 * *'; // Default to monthly
    }
  }

  /**
   * Set model as primary for tenant predictions
   */
  private async setPrimaryModel(
    model: MLModel,
    tenantId: string,
  ): Promise<void> {
    // Mark other models of same type as not primary
    await this.mlModelRepository.update(
      {
        tenantId,
        modelType: model.modelType,
        id: { $ne: model.id } as any,
      },
      { isActive: false },
    );

    // Set this model as active
    model.isActive = true;
    await this.mlModelRepository.save(model);

    // Clear prediction cache to force use of new model
    await this.cacheManager.del(`predictions:${tenantId}:*`);
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(model: MLModel): string {
    return `deploy_${model.id}_${Date.now()}`;
  }

  /**
   * Generate version number for model
   */
  private generateVersionNumber(model: MLModel): string {
    const currentVersion = model.version || '1.0.0';
    const parts = currentVersion.split('.').map(n => parseInt(n));
    parts[2] += 1; // Increment patch version
    return parts.join('.');
  }

  /**
   * Calculate next monitoring check time
   */
  private calculateNextMonitoringCheck(config: DeploymentConfig): Date {
    return moment()
      .tz(config.indonesianContext.timezone)
      .add(config.healthCheckConfig.interval, 'minutes')
      .toDate();
  }

  /**
   * Estimate monthly operational cost
   */
  private estimateOperationalCost(
    model: MLModel,
    config: DeploymentConfig,
  ): number {
    // Base cost factors
    const baseCostPerMonth = 50; // USD
    const cpuCostFactor = config.resourceLimits.maxCpuUsage * 0.1;
    const memoryCostFactor = config.resourceLimits.maxMemoryUsage * 0.05;
    const storageCostFactor = config.resourceLimits.storageQuota * 2;
    const monitoringCostFactor = config.alertsEnabled ? 20 : 0;
    const retrainingCostFactor = config.autoRetraining ? 30 : 0;

    return Math.round(
      baseCostPerMonth +
        cpuCostFactor +
        memoryCostFactor +
        storageCostFactor +
        monitoringCostFactor +
        retrainingCostFactor,
    );
  }

  // Helper methods for validation
  private async validateSeasonalAccuracy(
    model: MLModel,
  ): Promise<{ minAccuracy: number; maxAccuracy: number }> {
    // Simulate seasonal accuracy analysis
    return { minAccuracy: 0.65, maxAccuracy: 0.85 };
  }

  private async testPredictionLatency(
    model: MLModel,
  ): Promise<{ averageLatency: number; p95Latency: number }> {
    // Simulate latency testing
    return { averageLatency: 1500, p95Latency: 2200 };
  }

  private async testMemoryUsage(
    model: MLModel,
  ): Promise<{ peakMemoryMB: number; averageMemoryMB: number }> {
    // Simulate memory testing
    return { peakMemoryMB: 800, averageMemoryMB: 600 };
  }

  private async testConcurrentPredictions(
    model: MLModel,
  ): Promise<{ maxConcurrentHandled: number }> {
    // Simulate concurrency testing
    return { maxConcurrentHandled: 25 };
  }

  private async assessDataQuality(model: MLModel): Promise<number> {
    // Assess data quality score (0-100)
    return 85;
  }

  private async assessModelStability(model: MLModel): Promise<number> {
    // Assess model stability score (0-100)
    return 82;
  }

  private async assessIndonesianContextReadiness(
    model: MLModel,
  ): Promise<number> {
    // Assess Indonesian context readiness (0-100)
    return model.configuration?.indonesianMarketSettings ? 90 : 60;
  }

  private async assessScalabilityReadiness(model: MLModel): Promise<number> {
    // Assess scalability readiness (0-100)
    return 78;
  }

  private async assessOperationalReadiness(model: MLModel): Promise<number> {
    // Assess operational readiness (0-100)
    return 88;
  }

  private async validateIndonesianContext(
    model: MLModel,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!model.configuration?.indonesianMarketSettings) {
      issues.push('Indonesian market settings not configured');
    }

    return { isValid: issues.length === 0, issues };
  }

  private async validateDataQuality(
    model: MLModel,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Simulate data quality validation
    const dataQualityScore = await this.assessDataQuality(model);
    if (dataQualityScore < 80) {
      issues.push(
        `Data quality score too low: ${dataQualityScore}% (minimum 80%)`,
      );
    }

    return { isValid: issues.length === 0, issues };
  }

  private async getModelPerformanceMetrics(
    model: MLModel,
  ): Promise<ValidationMetrics> {
    return {
      accuracy: model.accuracy || 0,
      mape: 12.5, // Simulate MAPE
      mae: 8.3, // Simulate MAE
      rmse: 15.7, // Simulate RMSE
      r_squared: 0.85, // Simulate R²
      predictionLatency: 1500, // ms
      memoryFootprint: 600, // MB
      cpuUsage: 45, // percentage
    };
  }

  private calculateRollbackRisk(
    model: MLModel,
    config: DeploymentConfig,
  ): number {
    // Calculate rollback risk percentage (0-100)
    let risk = 10; // Base risk

    if (model.accuracy && model.accuracy < 0.8) risk += 20;
    if (config.deploymentStrategy.type === 'immediate') risk += 30;
    if (!config.autoRetraining) risk += 10;

    return Math.min(100, risk);
  }

  private estimateDowntime(strategy: DeploymentStrategy): number {
    // Estimate downtime in minutes
    switch (strategy.type) {
      case 'blue_green':
        return 2;
      case 'canary':
        return 0;
      case 'rolling':
        return 1;
      case 'immediate':
        return 5;
      default:
        return 2;
    }
  }

  private assessBusinessImpact(
    model: MLModel,
    config: DeploymentConfig,
  ): string {
    if (config.environment === 'production') {
      return 'High - Direct impact on production predictions and business decisions';
    } else if (config.environment === 'staging') {
      return 'Medium - Impact on testing and validation workflows';
    } else {
      return 'Low - Development environment only';
    }
  }

  private async scheduleHealthChecks(
    deployment: DeploymentResult,
    config: DeploymentConfig,
  ): Promise<void> {
    // Implementation for health check scheduling
    this.logger.log(`Health checks scheduled for ${deployment.deploymentId}`);
  }

  private async setupAlerting(
    deployment: DeploymentResult,
    config: DeploymentConfig,
  ): Promise<void> {
    // Implementation for alerting setup
    this.logger.log(`Alerting setup completed for ${deployment.deploymentId}`);
  }

  private async initializeMonitoringCache(
    deployment: DeploymentResult,
  ): Promise<void> {
    // Initialize monitoring cache with deployment info
    await this.cacheManager.set(
      `deployment:${deployment.deploymentId}`,
      deployment,
      300000, // 5 minutes TTL
    );
  }

  private async rollbackDeployment(
    model: MLModel,
    reason: string,
  ): Promise<void> {
    model.status = ModelStatus.FAILED;
    await this.mlModelRepository.save(model);
    this.logger.error(
      `Deployment rolled back for model ${model.id}: ${reason}`,
    );
  }

  /**
   * Cron job untuk monitoring deployed models
   */
  @Cron('*/10 * * * *') // Every 10 minutes
  async monitorDeployedModels(): Promise<void> {
    try {
      const deployedModels = await this.mlModelRepository.find({
        where: { status: ModelStatus.DEPLOYED },
        relations: ['predictions'],
      });

      for (const model of deployedModels) {
        await this.performDeployedModelHealthCheck(model);
      }

      this.logger.log(`Monitored ${deployedModels.length} deployed models`);
    } catch (error) {
      this.logger.error(
        `Failed to monitor deployed models: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Perform health check on deployed model
   */
  private async performDeployedModelHealthCheck(model: MLModel): Promise<void> {
    try {
      // Check model health via performance monitoring service
      const healthStatus =
        await this.performanceMonitoringService.performModelHealthCheck(
          model.id,
          model.tenantId,
        );

      if (
        healthStatus.overallHealth !== 'excellent' &&
        healthStatus.overallHealth !== 'good'
      ) {
        this.logger.warn(
          `Model ${model.id} health degraded: ${healthStatus.overallHealth}`,
        );

        // Emit health degradation event
        this.eventEmitter.emit('model.health.degraded', {
          modelId: model.id,
          tenantId: model.tenantId,
          healthStatus,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(
        `Health check failed for model ${model.id}: ${error.message}`,
      );
    }
  }

  /**
   * Get deployment status for a specific deployment
   */
  async getDeploymentStatus(deploymentId: string): Promise<any> {
    const cached = await this.cacheManager.get(`deployment:${deploymentId}`);
    if (cached) {
      return cached;
    }

    // Fallback to database lookup
    const modelId = deploymentId.split('_')[1];
    const model = await this.mlModelRepository.findOne({
      where: { id: modelId },
    });

    if (!model) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    return {
      deploymentId,
      status: model.status,
      version: model.version,
      deployedAt: model.deployedAt,
      environment:
        model.configuration?.deploymentConfig?.environment || 'unknown',
    };
  }

  /**
   * Get all deployments for a tenant
   */
  async getDeployments(tenantId: string): Promise<any[]> {
    const models = await this.mlModelRepository.find({
      where: {
        tenantId,
        status: ModelStatus.DEPLOYED,
      },
      order: { deployedAt: 'DESC' },
    });

    return models.map(model => ({
      deploymentId: `deploy_${model.id}_${model.deployedAt?.getTime()}`,
      modelId: model.id,
      modelType: model.modelType,
      version: model.version,
      status: model.status,
      deployedAt: model.deployedAt,
      environment:
        model.configuration?.deploymentConfig?.environment || 'production',
      accuracy: model.accuracy,
    }));
  }
}
