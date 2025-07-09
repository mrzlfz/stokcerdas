import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import moment from 'moment-timezone';

import { MLModel, ModelStatus } from '../entities/ml-model.entity';
import { Prediction, PredictionStatus } from '../entities/prediction.entity';
import { TrainingJob } from '../entities/training-job.entity';

/**
 * PHASE 2.2: Real-time Model Performance Monitoring Service 📊
 *
 * Comprehensive real-time monitoring system untuk ML model performance dalam production.
 * Tracks prediction accuracy, model health, response times, dan business impact metrics
 * dengan Indonesian SMB context dan real-time alerting capabilities.
 */

export interface PerformanceMetrics {
  modelId: string;
  timestamp: Date;
  accuracy: {
    mape: number;
    mae: number;
    rmse: number;
    r2Score: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  reliability: {
    uptime: number;
    errorRate: number;
    successRate: number;
    availabilityScore: number;
  };
  businessImpact: {
    predictionVolume: number;
    businessValue: number;
    costSavings: number;
    riskMitigation: number;
  };
}

export interface ModelHealthStatus {
  modelId: string;
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  healthScore: number; // 0-100
  alerts: HealthAlert[];
  recommendations: string[];
  lastChecked: Date;
  nextCheckAt: Date;
}

export interface HealthAlert {
  id: string;
  type:
    | 'accuracy_degradation'
    | 'performance_issue'
    | 'data_drift'
    | 'system_error'
    | 'business_impact';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  detectedAt: Date;
  threshold: number;
  currentValue: number;
  actionRequired: string[];
  autoRemediation: boolean;
}

export interface MonitoringConfiguration {
  tenantId: string;
  modelId: string;
  monitoringLevel: 'basic' | 'standard' | 'advanced' | 'enterprise';
  checkInterval: number; // minutes
  alertThresholds: {
    mapeThreshold: number;
    responseTimeThreshold: number;
    errorRateThreshold: number;
    healthScoreThreshold: number;
  };
  indonesianContext: {
    businessHours: {
      start: string;
      end: string;
      timezone: 'WIB' | 'WITA' | 'WIT';
    };
    peakPeriods: string[];
    ramadanAdjustments: boolean;
    holidayConsiderations: boolean;
  };
  notifications: {
    email: boolean;
    slack: boolean;
    sms: boolean;
    dashboard: boolean;
  };
}

export interface RealTimeMetrics {
  timestamp: Date;
  modelMetrics: Map<string, PerformanceMetrics>;
  systemMetrics: {
    totalModels: number;
    activeModels: number;
    unhealthyModels: number;
    totalPredictions: number;
    avgResponseTime: number;
    systemLoad: number;
  };
  businessMetrics: {
    totalBusinessValue: number;
    predictionsServed: number;
    customersImpacted: number;
    risksPrevented: number;
  };
}

export interface PerformanceTrend {
  modelId: string;
  metric: string;
  timeframe: '1h' | '6h' | '1d' | '1w' | '1m';
  dataPoints: Array<{ timestamp: Date; value: number }>;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  forecast: Array<{
    timestamp: Date;
    predictedValue: number;
    confidence: number;
  }>;
}

@Injectable()
export class RealtimePerformanceMonitoringService {
  private readonly logger = new Logger(
    RealtimePerformanceMonitoringService.name,
  );
  private realTimeMetrics: RealTimeMetrics;
  private monitoringConfigs: Map<string, MonitoringConfiguration> = new Map();
  private alertHistory: Map<string, HealthAlert[]> = new Map();

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepo: Repository<MLModel>,
    @InjectRepository(Prediction)
    private readonly predictionRepo: Repository<Prediction>,
    @InjectRepository(TrainingJob)
    private readonly trainingJobRepo: Repository<TrainingJob>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeRealTimeMetrics();
  }

  /**
   * Initialize real-time metrics tracking
   */
  private initializeRealTimeMetrics(): void {
    this.realTimeMetrics = {
      timestamp: new Date(),
      modelMetrics: new Map(),
      systemMetrics: {
        totalModels: 0,
        activeModels: 0,
        unhealthyModels: 0,
        totalPredictions: 0,
        avgResponseTime: 0,
        systemLoad: 0,
      },
      businessMetrics: {
        totalBusinessValue: 0,
        predictionsServed: 0,
        customersImpacted: 0,
        risksPrevented: 0,
      },
    };
  }

  /**
   * Configure monitoring untuk specific model
   */
  async configureModelMonitoring(
    config: MonitoringConfiguration,
  ): Promise<void> {
    this.logger.log(`Configuring monitoring for model ${config.modelId}`);

    // Validate model exists dan active
    const model = await this.mlModelRepo.findOne({
      where: { id: config.modelId, tenantId: config.tenantId, isActive: true },
    });

    if (!model) {
      throw new Error(`Model ${config.modelId} not found or inactive`);
    }

    // Store configuration
    this.monitoringConfigs.set(config.modelId, config);

    // Cache configuration untuk quick access
    await this.cacheManager.set(
      `monitoring_config_${config.modelId}`,
      config,
      24 * 60 * 60 * 1000, // 24 hours
    );

    // Initialize alert history
    this.alertHistory.set(config.modelId, []);

    this.logger.log(
      `Monitoring configured for model ${config.modelId} with ${config.monitoringLevel} level`,
    );
  }

  /**
   * Real-time performance metrics collection
   */
  async collectPerformanceMetrics(
    modelId: string,
    tenantId: string,
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      // Get recent predictions untuk accuracy calculation
      const recentPredictions = await this.getRecentPredictions(
        modelId,
        tenantId,
        100,
      );

      if (recentPredictions.length === 0) {
        this.logger.warn(`No recent predictions found for model ${modelId}`);
        return this.createEmptyMetrics(modelId);
      }

      // Calculate accuracy metrics
      const accuracy = await this.calculateRealTimeAccuracy(recentPredictions);

      // Get performance metrics dari sistem monitoring
      const performance = await this.getSystemPerformanceMetrics(modelId);

      // Calculate reliability metrics
      const reliability = await this.calculateReliabilityMetrics(
        modelId,
        tenantId,
      );

      // Calculate business impact
      const businessImpact = await this.calculateBusinessImpact(
        modelId,
        tenantId,
      );

      const metrics: PerformanceMetrics = {
        modelId,
        timestamp: new Date(),
        accuracy,
        performance,
        reliability,
        businessImpact,
      };

      // Store metrics dalam cache for real-time access
      await this.cacheManager.set(
        `realtime_metrics_${modelId}`,
        metrics,
        5 * 60 * 1000, // 5 minutes
      );

      // Update real-time metrics map
      this.realTimeMetrics.modelMetrics.set(modelId, metrics);
      this.realTimeMetrics.timestamp = new Date();

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `Performance metrics collected for ${modelId} in ${processingTime}ms`,
      );

      return metrics;
    } catch (error) {
      this.logger.error(
        `Error collecting performance metrics for ${modelId}: ${error.message}`,
        error.stack,
      );
      return this.createEmptyMetrics(modelId);
    }
  }

  /**
   * Health check untuk model dengan comprehensive assessment
   */
  async performModelHealthCheck(
    modelId: string,
    tenantId: string,
  ): Promise<ModelHealthStatus> {
    this.logger.debug(`Performing health check for model ${modelId}`);

    try {
      // Get monitoring configuration
      const config = this.monitoringConfigs.get(modelId);
      if (!config) {
        throw new Error(
          `No monitoring configuration found for model ${modelId}`,
        );
      }

      // Collect current metrics
      const metrics = await this.collectPerformanceMetrics(modelId, tenantId);

      // Assess health berdasarkan multiple factors
      const healthAssessment = this.assessModelHealth(metrics, config);

      // Generate alerts if needed
      const alerts = await this.generateHealthAlerts(modelId, metrics, config);

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(
        healthAssessment,
        metrics,
        config,
      );

      const healthStatus: ModelHealthStatus = {
        modelId,
        overallHealth: healthAssessment.overallHealth,
        healthScore: healthAssessment.healthScore,
        alerts,
        recommendations,
        lastChecked: new Date(),
        nextCheckAt: moment().add(config.checkInterval, 'minutes').toDate(),
      };

      // Cache health status
      await this.cacheManager.set(
        `health_status_${modelId}`,
        healthStatus,
        config.checkInterval * 60 * 1000,
      );

      // Emit health events if issues detected
      if (
        healthStatus.overallHealth === 'critical' ||
        healthStatus.overallHealth === 'warning'
      ) {
        this.eventEmitter.emit('ml.model.health.issue', {
          tenantId,
          modelId,
          healthStatus,
          timestamp: new Date(),
        });
      }

      return healthStatus;
    } catch (error) {
      this.logger.error(
        `Health check failed for model ${modelId}: ${error.message}`,
        error.stack,
      );

      return {
        modelId,
        overallHealth: 'critical',
        healthScore: 0,
        alerts: [
          {
            id: `health_check_error_${Date.now()}`,
            type: 'system_error',
            severity: 'critical',
            message: `Health check failed: ${error.message}`,
            detectedAt: new Date(),
            threshold: 0,
            currentValue: 0,
            actionRequired: ['Check system logs', 'Verify model availability'],
            autoRemediation: false,
          },
        ],
        recommendations: [
          'Investigate system error',
          'Contact technical support',
        ],
        lastChecked: new Date(),
        nextCheckAt: moment().add(5, 'minutes').toDate(),
      };
    }
  }

  /**
   * Real-time dashboard data untuk monitoring interface
   */
  async getRealTimeDashboardData(tenantId: string): Promise<{
    overview: RealTimeMetrics;
    modelStatuses: ModelHealthStatus[];
    activeAlerts: HealthAlert[];
    performanceTrends: PerformanceTrend[];
  }> {
    this.logger.debug(
      `Getting real-time dashboard data for tenant ${tenantId}`,
    );

    try {
      // Get all active models untuk tenant
      const activeModels = await this.mlModelRepo.find({
        where: { tenantId, isActive: true, status: ModelStatus.DEPLOYED },
      });

      // Collect health statuses
      const modelStatuses: ModelHealthStatus[] = [];
      for (const model of activeModels) {
        try {
          const healthStatus = await this.cacheManager.get<ModelHealthStatus>(
            `health_status_${model.id}`,
          );
          if (healthStatus) {
            modelStatuses.push(healthStatus);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get health status for model ${model.id}: ${error.message}`,
          );
        }
      }

      // Aggregate active alerts
      const activeAlerts: HealthAlert[] = [];
      modelStatuses.forEach(status => {
        activeAlerts.push(
          ...status.alerts.filter(
            alert => moment().diff(moment(alert.detectedAt), 'hours') < 24,
          ),
        );
      });

      // Get performance trends
      const performanceTrends = await this.getPerformanceTrends(
        tenantId,
        activeModels.map(m => m.id),
      );

      // Update system metrics
      await this.updateSystemMetrics(tenantId);

      return {
        overview: this.realTimeMetrics,
        modelStatuses,
        activeAlerts: activeAlerts.sort(
          (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime(),
        ),
        performanceTrends,
      };
    } catch (error) {
      this.logger.error(
        `Error getting dashboard data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Scheduled monitoring checks - runs every 5 minutes
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async scheduledMonitoringCheck(): Promise<void> {
    this.logger.debug('Running scheduled monitoring check');

    try {
      // Get all configured models
      const configuredModels = Array.from(this.monitoringConfigs.keys());

      for (const modelId of configuredModels) {
        const config = this.monitoringConfigs.get(modelId);
        if (!config) continue;

        // Check if it's time for Indonesian business hours adjustment
        const now = moment().tz(this.getTimezoneFromConfig(config));
        const businessHours = config.indonesianContext.businessHours;
        const isBusinessHours =
          now.hour() >= parseInt(businessHours.start.split(':')[0]) &&
          now.hour() < parseInt(businessHours.end.split(':')[0]);

        // Adjust monitoring frequency berdasarkan business hours
        const shouldCheck =
          isBusinessHours || now.minute() % config.checkInterval === 0;

        if (shouldCheck) {
          try {
            await this.performModelHealthCheck(modelId, config.tenantId);
          } catch (error) {
            this.logger.error(
              `Scheduled health check failed for model ${modelId}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Scheduled monitoring check failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Indonesian business context adjustments
   */
  private getTimezoneFromConfig(config: MonitoringConfiguration): string {
    switch (config.indonesianContext.businessHours.timezone) {
      case 'WIB':
        return 'Asia/Jakarta';
      case 'WITA':
        return 'Asia/Makassar';
      case 'WIT':
        return 'Asia/Jayapura';
      default:
        return 'Asia/Jakarta';
    }
  }

  /**
   * Get recent predictions untuk accuracy calculation
   */
  private async getRecentPredictions(
    modelId: string,
    tenantId: string,
    limit: number,
  ): Promise<Prediction[]> {
    const thirtyMinutesAgo = moment().subtract(30, 'minutes').toDate();

    return await this.predictionRepo.find({
      where: {
        modelId,
        tenantId,
        status: PredictionStatus.COMPLETED,
        predictionDate: Between(thirtyMinutesAgo, new Date()),
      },
      order: { predictionDate: 'DESC' },
      take: limit,
    });
  }

  /**
   * Calculate real-time accuracy metrics
   */
  private async calculateRealTimeAccuracy(predictions: Prediction[]): Promise<{
    mape: number;
    mae: number;
    rmse: number;
    r2Score: number;
  }> {
    const actualizedPredictions = predictions.filter(
      p =>
        p.isActualized && p.actualValue !== null && p.actualValue !== undefined,
    );

    if (actualizedPredictions.length === 0) {
      return { mape: 0, mae: 0, rmse: 0, r2Score: 0 };
    }

    const actual = actualizedPredictions.map(p => p.actualValue!);
    const predicted = actualizedPredictions.map(p => p.predictedValue);

    return {
      mape: this.calculateMAPE(actual, predicted),
      mae: this.calculateMAE(actual, predicted),
      rmse: this.calculateRMSE(actual, predicted),
      r2Score: this.calculateRSquared(actual, predicted),
    };
  }

  /**
   * Get system performance metrics
   */
  private async getSystemPerformanceMetrics(modelId: string): Promise<{
    responseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    // Get cached performance data
    const cachedMetrics = await this.cacheManager.get<any>(
      `system_metrics_${modelId}`,
    );

    if (cachedMetrics) {
      return cachedMetrics;
    }

    // Default values jika tidak ada data sistem
    return {
      responseTime: Math.random() * 100 + 50, // 50-150ms simulated
      throughput: Math.random() * 100 + 200, // 200-300 predictions/min simulated
      memoryUsage: Math.random() * 30 + 40, // 40-70% simulated
      cpuUsage: Math.random() * 20 + 10, // 10-30% simulated
    };
  }

  /**
   * Calculate reliability metrics
   */
  private async calculateReliabilityMetrics(
    modelId: string,
    tenantId: string,
  ): Promise<{
    uptime: number;
    errorRate: number;
    successRate: number;
    availabilityScore: number;
  }> {
    const last24Hours = moment().subtract(24, 'hours').toDate();

    const totalPredictions = await this.predictionRepo.count({
      where: {
        modelId,
        tenantId,
        predictionDate: Between(last24Hours, new Date()),
      },
    });

    const failedPredictions = await this.predictionRepo.count({
      where: {
        modelId,
        tenantId,
        status: PredictionStatus.FAILED,
        predictionDate: Between(last24Hours, new Date()),
      },
    });

    const successRate =
      totalPredictions > 0
        ? ((totalPredictions - failedPredictions) / totalPredictions) * 100
        : 100;
    const errorRate =
      totalPredictions > 0 ? (failedPredictions / totalPredictions) * 100 : 0;

    return {
      uptime: 99.9, // Simplified - would integrate dengan actual uptime monitoring
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      availabilityScore:
        Math.round((successRate * 0.7 + 99.9 * 0.3) * 100) / 100,
    };
  }

  /**
   * Calculate business impact metrics
   */
  private async calculateBusinessImpact(
    modelId: string,
    tenantId: string,
  ): Promise<{
    predictionVolume: number;
    businessValue: number;
    costSavings: number;
    riskMitigation: number;
  }> {
    const last24Hours = moment().subtract(24, 'hours').toDate();

    const predictionVolume = await this.predictionRepo.count({
      where: {
        modelId,
        tenantId,
        predictionDate: Between(last24Hours, new Date()),
      },
    });

    // Indonesian SMB context - estimate business value
    const avgOrderValue = 50000; // 50k IDR average untuk SMB
    const estimatedBusinessValue = predictionVolume * avgOrderValue * 0.1; // 10% improvement assumption

    return {
      predictionVolume,
      businessValue: Math.round(estimatedBusinessValue),
      costSavings: Math.round(estimatedBusinessValue * 0.2), // 20% cost savings
      riskMitigation: Math.round(predictionVolume * 0.05), // Risk reduction score
    };
  }

  /**
   * Assess overall model health
   */
  private assessModelHealth(
    metrics: PerformanceMetrics,
    config: MonitoringConfiguration,
  ): {
    overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    healthScore: number;
  } {
    let healthScore = 100;

    // Accuracy assessment
    if (metrics.accuracy.mape > config.alertThresholds.mapeThreshold) {
      healthScore -= 30;
    } else if (
      metrics.accuracy.mape >
      config.alertThresholds.mapeThreshold * 0.8
    ) {
      healthScore -= 15;
    }

    // Performance assessment
    if (
      metrics.performance.responseTime >
      config.alertThresholds.responseTimeThreshold
    ) {
      healthScore -= 20;
    }

    // Reliability assessment
    if (
      metrics.reliability.errorRate > config.alertThresholds.errorRateThreshold
    ) {
      healthScore -= 25;
    }

    // System resource assessment
    if (metrics.performance.memoryUsage > 80) {
      healthScore -= 15;
    }
    if (metrics.performance.cpuUsage > 70) {
      healthScore -= 10;
    }

    // Determine overall health
    let overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    if (healthScore >= 90) overallHealth = 'excellent';
    else if (healthScore >= 75) overallHealth = 'good';
    else if (healthScore >= 50) overallHealth = 'warning';
    else overallHealth = 'critical';

    return { overallHealth, healthScore: Math.max(0, healthScore) };
  }

  /**
   * Generate health alerts berdasarkan thresholds
   */
  private async generateHealthAlerts(
    modelId: string,
    metrics: PerformanceMetrics,
    config: MonitoringConfiguration,
  ): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = [];

    // Accuracy alerts
    if (metrics.accuracy.mape > config.alertThresholds.mapeThreshold) {
      alerts.push({
        id: `accuracy_alert_${modelId}_${Date.now()}`,
        type: 'accuracy_degradation',
        severity:
          metrics.accuracy.mape > config.alertThresholds.mapeThreshold * 1.5
            ? 'critical'
            : 'high',
        message: `Model accuracy degraded: MAPE ${metrics.accuracy.mape.toFixed(
          2,
        )}% exceeds threshold ${config.alertThresholds.mapeThreshold}%`,
        detectedAt: new Date(),
        threshold: config.alertThresholds.mapeThreshold,
        currentValue: metrics.accuracy.mape,
        actionRequired: [
          'Review model performance',
          'Consider retraining',
          'Check data quality',
        ],
        autoRemediation: false,
      });
    }

    // Performance alerts
    if (
      metrics.performance.responseTime >
      config.alertThresholds.responseTimeThreshold
    ) {
      alerts.push({
        id: `performance_alert_${modelId}_${Date.now()}`,
        type: 'performance_issue',
        severity:
          metrics.performance.responseTime >
          config.alertThresholds.responseTimeThreshold * 2
            ? 'critical'
            : 'medium',
        message: `High response time: ${metrics.performance.responseTime.toFixed(
          0,
        )}ms exceeds threshold ${
          config.alertThresholds.responseTimeThreshold
        }ms`,
        detectedAt: new Date(),
        threshold: config.alertThresholds.responseTimeThreshold,
        currentValue: metrics.performance.responseTime,
        actionRequired: [
          'Check system resources',
          'Optimize model',
          'Scale infrastructure',
        ],
        autoRemediation: true,
      });
    }

    // Store alerts dalam history
    const existingAlerts = this.alertHistory.get(modelId) || [];
    this.alertHistory.set(modelId, [...existingAlerts, ...alerts]);

    return alerts;
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(
    healthAssessment: { overallHealth: string; healthScore: number },
    metrics: PerformanceMetrics,
    config: MonitoringConfiguration,
  ): string[] {
    const recommendations: string[] = [];

    if (healthAssessment.overallHealth === 'critical') {
      recommendations.push(
        '🚨 Immediate attention required - model performance critically degraded',
      );
      recommendations.push(
        'Consider emergency rollback to previous model version',
      );
      recommendations.push('Trigger immediate retraining with fresh data');
    } else if (healthAssessment.overallHealth === 'warning') {
      recommendations.push(
        '⚠️ Monitor model closely - performance degradation detected',
      );
      recommendations.push('Schedule model retraining within 24 hours');
      recommendations.push('Review recent data quality and feature changes');
    }

    // Indonesian business context recommendations
    if (config.indonesianContext.ramadanAdjustments) {
      const now = moment().tz(this.getTimezoneFromConfig(config));
      const isRamadanPeriod = this.isRamadanPeriod(now);

      if (isRamadanPeriod) {
        recommendations.push(
          '🌙 Ramadan adjustment: Expect demand pattern changes for F&B products',
        );
        recommendations.push(
          'Increase monitoring frequency during berbuka and sahur hours',
        );
      }
    }

    if (metrics.accuracy.mape > 15) {
      recommendations.push('Consider ensemble modeling untuk improve accuracy');
      recommendations.push(
        'Review seasonal adjustments for Indonesian market patterns',
      );
    }

    return recommendations;
  }

  /**
   * Check if current time is dalam Ramadan period (simplified)
   */
  private isRamadanPeriod(date: moment.Moment): boolean {
    // Simplified check - dalam production, akan integrate dengan Islamic calendar API
    const year = date.year();
    const ramadanMonths = [3, 4, 5]; // Approximate months untuk Ramadan in different years
    return ramadanMonths.includes(date.month() + 1);
  }

  /**
   * Get performance trends untuk dashboard
   */
  private async getPerformanceTrends(
    tenantId: string,
    modelIds: string[],
  ): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];

    for (const modelId of modelIds.slice(0, 5)) {
      // Limit to 5 models for performance
      try {
        const trend = await this.calculatePerformanceTrend(
          modelId,
          'mape',
          '1d',
        );
        if (trend) {
          trends.push(trend);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to calculate trend for model ${modelId}: ${error.message}`,
        );
      }
    }

    return trends;
  }

  /**
   * Calculate performance trend untuk specific metric
   */
  private async calculatePerformanceTrend(
    modelId: string,
    metric: string,
    timeframe: '1h' | '6h' | '1d' | '1w' | '1m',
  ): Promise<PerformanceTrend | null> {
    // Simplified trend calculation - dalam production akan lebih sophisticated
    const dataPoints = Array.from({ length: 24 }, (_, i) => ({
      timestamp: moment()
        .subtract(23 - i, 'hours')
        .toDate(),
      value: Math.random() * 10 + 5, // Simulated MAPE values
    }));

    const values = dataPoints.map(dp => dp.value);
    const changeRate =
      values.length > 1
        ? ((values[values.length - 1] - values[0]) / values[0]) * 100
        : 0;

    let trend: 'improving' | 'stable' | 'degrading';
    if (Math.abs(changeRate) < 5) trend = 'stable';
    else if (changeRate < 0) trend = 'improving'; // Lower MAPE is better
    else trend = 'degrading';

    return {
      modelId,
      metric,
      timeframe,
      dataPoints,
      trend,
      changeRate,
      forecast: [], // Would implement actual forecasting
    };
  }

  /**
   * Update system-wide metrics
   */
  private async updateSystemMetrics(tenantId: string): Promise<void> {
    const totalModels = await this.mlModelRepo.count({
      where: { tenantId, isActive: true },
    });

    const activeModels = await this.mlModelRepo.count({
      where: { tenantId, isActive: true, status: ModelStatus.DEPLOYED },
    });

    const last24Hours = moment().subtract(24, 'hours').toDate();
    const totalPredictions = await this.predictionRepo.count({
      where: {
        tenantId,
        predictionDate: Between(last24Hours, new Date()),
      },
    });

    this.realTimeMetrics.systemMetrics = {
      totalModels,
      activeModels,
      unhealthyModels: Math.max(0, totalModels - activeModels),
      totalPredictions,
      avgResponseTime: 85, // Simulated
      systemLoad: Math.random() * 30 + 40, // Simulated 40-70%
    };

    this.realTimeMetrics.businessMetrics = {
      totalBusinessValue: totalPredictions * 50000 * 0.1, // Indonesian SMB estimate
      predictionsServed: totalPredictions,
      customersImpacted: Math.round(totalPredictions * 0.3),
      risksPrevented: Math.round(totalPredictions * 0.05),
    };
  }

  /**
   * Create empty metrics untuk error cases
   */
  private createEmptyMetrics(modelId: string): PerformanceMetrics {
    return {
      modelId,
      timestamp: new Date(),
      accuracy: { mape: 0, mae: 0, rmse: 0, r2Score: 0 },
      performance: {
        responseTime: 0,
        throughput: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      reliability: {
        uptime: 0,
        errorRate: 100,
        successRate: 0,
        availabilityScore: 0,
      },
      businessImpact: {
        predictionVolume: 0,
        businessValue: 0,
        costSavings: 0,
        riskMitigation: 0,
      },
    };
  }

  // Utility methods untuk accuracy calculations
  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;

    let sum = 0;
    let count = 0;

    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }

    return count > 0 ? (sum / count) * 100 : 0;
  }

  private calculateMAE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;

    const sum = actual.reduce(
      (acc, val, idx) => acc + Math.abs(val - predicted[idx]),
      0,
    );
    return sum / actual.length;
  }

  private calculateRMSE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;

    const sum = actual.reduce(
      (acc, val, idx) => acc + Math.pow(val - predicted[idx], 2),
      0,
    );
    return Math.sqrt(sum / actual.length);
  }

  private calculateRSquared(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;

    const actualMean =
      actual.reduce((sum, val) => sum + val, 0) / actual.length;

    const totalSumSquares = actual.reduce(
      (sum, val) => sum + Math.pow(val - actualMean, 2),
      0,
    );
    const residualSumSquares = actual.reduce(
      (sum, val, idx) => sum + Math.pow(val - predicted[idx], 2),
      0,
    );

    if (totalSumSquares === 0) return 0;

    return Math.max(0, 1 - residualSumSquares / totalSumSquares);
  }
}
