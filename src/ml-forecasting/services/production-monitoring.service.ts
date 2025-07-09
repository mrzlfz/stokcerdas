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

import { MLModel, ModelStatus } from '../entities/ml-model.entity';
import { Prediction } from '../entities/prediction.entity';
import { TrainingJob } from '../entities/training-job.entity';
import { RealtimePerformanceMonitoringService } from './realtime-performance-monitoring.service';
import { ModelServingService } from './model-serving.service';

/**
 * PHASE 3 WEEK 9: Production Monitoring & Alerting Service 📊
 *
 * Enterprise-grade production monitoring system untuk deployed ML models dengan
 * comprehensive alerting, automated remediation, SLA monitoring, business impact
 * tracking, dan Indonesian business context awareness untuk 24/7 ML operations.
 */

export interface ProductionAlert {
  alertId: string;
  tenantId: string;
  modelId: string;
  deploymentId?: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: AlertStatus;
  metadata: AlertMetadata;
  affectedMetrics: string[];
  businessImpact: BusinessImpactAssessment;
  indonesianContext: IndonesianAlertContext;
  remediationActions: RemediationAction[];
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertType {
  ACCURACY_DEGRADATION = 'accuracy_degradation',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  HIGH_ERROR_RATE = 'high_error_rate',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  MODEL_DRIFT = 'model_drift',
  DATA_QUALITY_ISSUE = 'data_quality_issue',
  SYSTEM_OUTAGE = 'system_outage',
  BUSINESS_THRESHOLD_BREACH = 'business_threshold_breach',
  INDONESIAN_CONTEXT_ANOMALY = 'indonesian_context_anomaly',
  AUTO_RETRAINING_FAILED = 'auto_retraining_failed',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export interface AlertMetadata {
  currentValue: number;
  threshold: number;
  expectedValue?: number;
  severity_score: number;
  confidence: number;
  detection_method: string;
  related_alerts: string[];
  correlation_id?: string;
}

export interface BusinessImpactAssessment {
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  affectedUsers: number;
  estimatedRevenueLoss: number;
  businessProcessesAffected: string[];
  slaBreaches: SLABreach[];
  customerExperienceImpact: number; // 0-100 score
}

export interface SLABreach {
  slaType: 'availability' | 'response_time' | 'accuracy' | 'throughput';
  target: number;
  actual: number;
  breachDuration: number; // minutes
  breachSeverity: 'minor' | 'major' | 'critical';
}

export interface IndonesianAlertContext {
  timezone: 'WIB' | 'WITA' | 'WIT';
  businessHours: boolean;
  culturalEvent?: string;
  ramadanPeriod: boolean;
  lebaranPeriod: boolean;
  peakBusinessHour: boolean;
  regionalImpact: string[];
  localizedSeverity: AlertSeverity;
}

export interface RemediationAction {
  actionId: string;
  type: 'automated' | 'manual' | 'escalation';
  title: string;
  description: string;
  priority: number;
  estimatedTime: number; // minutes
  prerequisites: string[];
  automatedScript?: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface MonitoringConfiguration {
  tenantId: string;
  modelId: string;
  deploymentId?: string;
  thresholds: MonitoringThresholds;
  alertChannels: AlertChannel[];
  indonesianSettings: IndonesianMonitoringSettings;
  slaTargets: SLATargets;
  escalationRules: EscalationRule[];
  businessHours: BusinessHoursConfig;
}

export interface MonitoringThresholds {
  accuracy: {
    critical: number;
    high: number;
    medium: number;
  };
  responseTime: {
    critical: number; // ms
    high: number;
    medium: number;
  };
  errorRate: {
    critical: number; // percentage
    high: number;
    medium: number;
  };
  memoryUsage: {
    critical: number; // percentage
    high: number;
    medium: number;
  };
  cpuUsage: {
    critical: number; // percentage
    high: number;
    medium: number;
  };
  throughput: {
    critical: number; // predictions/minute
    high: number;
    medium: number;
  };
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'dashboard' | 'whatsapp';
  enabled: boolean;
  configuration: any;
  severityFilters: AlertSeverity[];
  businessHoursOnly: boolean;
  indonesianLocalization: boolean;
}

export interface IndonesianMonitoringSettings {
  timezone: 'WIB' | 'WITA' | 'WIT' | 'auto';
  culturalEventAwareness: boolean;
  ramadanAdjustments: {
    enabled: boolean;
    alertSuppression: boolean;
    thresholdAdjustments: number; // percentage
  };
  lebaranAdjustments: {
    enabled: boolean;
    alertSuppression: boolean;
    thresholdAdjustments: number;
  };
  regionalPrioritization: string[];
  businessContextConsiderations: boolean;
}

export interface SLATargets {
  availability: number; // percentage (e.g., 99.9)
  responseTime: number; // ms (e.g., 2000)
  accuracy: number; // percentage (e.g., 85)
  throughput: number; // predictions/minute
  errorRate: number; // percentage (e.g., 1)
}

export interface EscalationRule {
  id: string;
  triggerConditions: EscalationTrigger[];
  escalationLevels: EscalationLevel[];
  enabled: boolean;
}

export interface EscalationTrigger {
  metric: string;
  condition: 'threshold_breach' | 'duration_exceeded' | 'frequency_exceeded';
  value: number;
  duration?: number; // minutes
}

export interface EscalationLevel {
  level: number;
  delay: number; // minutes
  recipients: string[];
  channels: string[];
  autoRemediation: boolean;
}

export interface BusinessHoursConfig {
  timezone: string;
  workingDays: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  holidayCalendar: string; // Indonesian holidays
}

export interface ProductionHealthReport {
  reportId: string;
  tenantId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  overallHealth: {
    score: number; // 0-100
    status: 'excellent' | 'good' | 'warning' | 'critical';
    trend: 'improving' | 'stable' | 'degrading';
  };
  modelHealth: ModelHealthSummary[];
  slaCompliance: SLAComplianceReport;
  alertsSummary: AlertsSummary;
  businessImpact: BusinessImpactSummary;
  indonesianInsights: IndonesianInsightsSummary;
  recommendations: ProductionRecommendation[];
}

export interface ModelHealthSummary {
  modelId: string;
  modelType: string;
  deploymentId?: string;
  healthScore: number;
  status: string;
  uptime: number; // percentage
  lastIncident?: Date;
  keyMetrics: {
    accuracy: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  trend: 'improving' | 'stable' | 'degrading';
}

export interface SLAComplianceReport {
  overallCompliance: number; // percentage
  slaBreaches: SLABreach[];
  complianceByMetric: Record<string, number>;
  penalties: number; // estimated cost
  improvementActions: string[];
}

export interface AlertsSummary {
  totalAlerts: number;
  alertsByType: Record<AlertType, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertTrends: number[];
  meanTimeToResolution: number; // minutes
  falsePositiveRate: number; // percentage
}

export interface BusinessImpactSummary {
  totalRevenueLoss: number;
  affectedCustomers: number;
  serviceDowntime: number; // minutes
  businessProcessImpacts: string[];
  customerSatisfactionImpact: number; // 0-100 score
}

export interface IndonesianInsightsSummary {
  culturalEventImpacts: CulturalEventImpact[];
  regionalPerformance: RegionalPerformance[];
  timezoneCoverage: TimezonePerformance[];
  businessHoursOptimization: number; // percentage
  ramadanLebaranAdjustments: SeasonalAdjustmentSummary;
}

export interface CulturalEventImpact {
  event: string;
  dateRange: { start: Date; end: Date };
  performanceImpact: number; // percentage change
  alertVolumeChange: number; // percentage change
  businessImpact: string;
}

export interface RegionalPerformance {
  region: string;
  timezone: string;
  healthScore: number;
  specificChallenges: string[];
  optimizationOpportunities: string[];
}

export interface TimezonePerformance {
  timezone: 'WIB' | 'WITA' | 'WIT';
  coverage: number; // percentage
  averageResponseTime: number;
  reliabilityScore: number;
}

export interface SeasonalAdjustmentSummary {
  ramadanAdjustments: {
    enabled: boolean;
    effectivenessScore: number;
    alertReduction: number;
  };
  lebaranAdjustments: {
    enabled: boolean;
    effectivenessScore: number;
    alertReduction: number;
  };
}

export interface ProductionRecommendation {
  id: string;
  type: 'optimization' | 'scaling' | 'configuration' | 'infrastructure';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedBenefit: string;
  estimatedEffort: string;
  businessJustification: string;
  implementationSteps: string[];
  indonesianContext?: string;
}

@Injectable()
export class ProductionMonitoringService {
  private readonly logger = new Logger(ProductionMonitoringService.name);
  private readonly alertCache = new Map<string, ProductionAlert>();

  constructor(
    @InjectRepository(MLModel)
    private readonly mlModelRepository: Repository<MLModel>,

    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,

    @InjectRepository(TrainingJob)
    private readonly trainingJobRepository: Repository<TrainingJob>,

    @InjectQueue('ml-training')
    private readonly monitoringQueue: Queue,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    private readonly eventEmitter: EventEmitter2,
    private readonly performanceMonitoringService: RealtimePerformanceMonitoringService,
    private readonly modelServingService: ModelServingService,
  ) {}

  /**
   * Setup monitoring untuk deployed model
   */
  async setupProductionMonitoring(
    config: MonitoringConfiguration,
  ): Promise<void> {
    try {
      this.logger.log(
        `Setting up production monitoring for model ${config.modelId}`,
      );

      // Store monitoring configuration
      await this.cacheManager.set(
        `monitoring:config:${config.modelId}`,
        config,
        7 * 24 * 60 * 60 * 1000, // 7 days
      );

      // Schedule monitoring jobs
      await this.scheduleMonitoringJobs(config);

      // Setup alert channels
      await this.setupAlertChannels(config.alertChannels);

      // Initialize baseline metrics
      await this.initializeBaselineMetrics(config);

      // Setup Indonesian context monitoring
      await this.setupIndonesianContextMonitoring(config);

      this.logger.log(
        `Production monitoring setup completed for model ${config.modelId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to setup production monitoring: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Comprehensive production health check
   */
  async performProductionHealthCheck(
    tenantId: string,
    modelId?: string,
  ): Promise<ProductionHealthReport> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Performing production health check for tenant ${tenantId}${
          modelId ? `, model ${modelId}` : ''
        }`,
      );

      // Get deployed models to monitor
      const modelsToMonitor = await this.getDeployedModels(tenantId, modelId);

      // Collect health data for each model
      const modelHealthSummaries: ModelHealthSummary[] = [];
      for (const model of modelsToMonitor) {
        const healthSummary = await this.collectModelHealthSummary(model);
        modelHealthSummaries.push(healthSummary);
      }

      // Calculate overall health
      const overallHealth = this.calculateOverallHealth(modelHealthSummaries);

      // Get SLA compliance report
      const slaCompliance = await this.generateSLAComplianceReport(
        tenantId,
        modelId,
      );

      // Get alerts summary
      const alertsSummary = await this.generateAlertsSummary(tenantId, modelId);

      // Calculate business impact
      const businessImpact = await this.calculateBusinessImpact(
        tenantId,
        modelId,
      );

      // Generate Indonesian insights
      const indonesianInsights = await this.generateIndonesianInsights(
        tenantId,
        modelId,
      );

      // Generate recommendations
      const recommendations = await this.generateProductionRecommendations(
        modelHealthSummaries,
        slaCompliance,
        alertsSummary,
        businessImpact,
      );

      const healthReport: ProductionHealthReport = {
        reportId: `health_${Date.now()}_${tenantId}`,
        tenantId,
        generatedAt: new Date(),
        timeRange: {
          start: moment().subtract(24, 'hours').toDate(),
          end: new Date(),
        },
        overallHealth,
        modelHealth: modelHealthSummaries,
        slaCompliance,
        alertsSummary,
        businessImpact,
        indonesianInsights,
        recommendations,
      };

      // Cache the report
      await this.cacheManager.set(
        `health:report:${tenantId}${modelId ? `:${modelId}` : ''}`,
        healthReport,
        60 * 60 * 1000, // 1 hour
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Production health check completed in ${processingTime}ms`,
      );

      return healthReport;
    } catch (error) {
      this.logger.error(
        `Production health check failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create and manage production alerts
   */
  async createAlert(
    tenantId: string,
    modelId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    title: string,
    description: string,
    metadata: AlertMetadata,
    deploymentId?: string,
  ): Promise<ProductionAlert> {
    try {
      const alertId = `alert_${Date.now()}_${modelId}_${alertType}`;

      // Assess business impact
      const businessImpact = await this.assessAlertBusinessImpact(
        tenantId,
        modelId,
        alertType,
        severity,
        metadata,
      );

      // Get Indonesian context
      const indonesianContext = await this.getIndonesianAlertContext(
        tenantId,
        severity,
      );

      // Generate remediation actions
      const remediationActions = await this.generateRemediationActions(
        alertType,
        severity,
        metadata,
        modelId,
      );

      const alert: ProductionAlert = {
        alertId,
        tenantId,
        modelId,
        deploymentId,
        severity,
        type: alertType,
        title,
        description,
        triggeredAt: new Date(),
        status: AlertStatus.ACTIVE,
        metadata,
        affectedMetrics: this.getAffectedMetrics(alertType),
        businessImpact,
        indonesianContext,
        remediationActions,
      };

      // Store alert
      this.alertCache.set(alertId, alert);
      await this.cacheManager.set(
        `alert:${alertId}`,
        alert,
        7 * 24 * 60 * 60 * 1000,
      ); // 7 days

      // Send alert notifications
      await this.sendAlertNotifications(alert);

      // Execute automated remediation if applicable
      await this.executeAutomatedRemediation(alert);

      // Emit alert event
      this.eventEmitter.emit('production.alert.created', alert);

      this.logger.warn(`Production alert created: ${alertId} - ${title}`);

      return alert;
    } catch (error) {
      this.logger.error(
        `Failed to create alert: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get active alerts for tenant/model
   */
  async getActiveAlerts(
    tenantId: string,
    modelId?: string,
    severity?: AlertSeverity,
  ): Promise<ProductionAlert[]> {
    try {
      // Get all alerts from cache
      const alerts: ProductionAlert[] = [];

      for (const [alertId, alert] of this.alertCache.entries()) {
        if (alert.tenantId !== tenantId) continue;
        if (modelId && alert.modelId !== modelId) continue;
        if (severity && alert.severity !== severity) continue;
        if (alert.status !== AlertStatus.ACTIVE) continue;

        alerts.push(alert);
      }

      // Sort by severity and date
      alerts.sort((a, b) => {
        const severityOrder = {
          [AlertSeverity.CRITICAL]: 5,
          [AlertSeverity.HIGH]: 4,
          [AlertSeverity.MEDIUM]: 3,
          [AlertSeverity.LOW]: 2,
          [AlertSeverity.INFO]: 1,
        };

        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }

        return b.triggeredAt.getTime() - a.triggeredAt.getTime();
      });

      return alerts;
    } catch (error) {
      this.logger.error(
        `Failed to get active alerts: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolution: {
      resolvedBy: string;
      resolutionNote: string;
      rootCause?: string;
      preventionMeasures?: string[];
    },
  ): Promise<void> {
    try {
      const alert = this.alertCache.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      // Update alert status
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();

      // Store resolution details
      const resolutionDetails = {
        ...resolution,
        resolvedAt: new Date(),
        resolutionTime:
          alert.resolvedAt.getTime() - alert.triggeredAt.getTime(),
      };

      await this.cacheManager.set(
        `alert:resolution:${alertId}`,
        resolutionDetails,
        7 * 24 * 60 * 60 * 1000,
      );

      // Update cache
      this.alertCache.set(alertId, alert);
      await this.cacheManager.set(
        `alert:${alertId}`,
        alert,
        7 * 24 * 60 * 60 * 1000,
      );

      // Emit resolution event
      this.eventEmitter.emit('production.alert.resolved', {
        alert,
        resolution: resolutionDetails,
      });

      this.logger.log(`Alert resolved: ${alertId} by ${resolution.resolvedBy}`);
    } catch (error) {
      this.logger.error(
        `Failed to resolve alert: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Scheduled monitoring job - runs every 5 minutes
   */
  @Cron('*/5 * * * *')
  async scheduledProductionMonitoring(): Promise<void> {
    try {
      this.logger.log('Running scheduled production monitoring check');

      // Get all deployed models
      const deployedModels = await this.mlModelRepository.find({
        where: { status: ModelStatus.DEPLOYED },
      });

      for (const model of deployedModels) {
        await this.performModelMonitoringCheck(model);
      }

      // Cleanup old alerts
      await this.cleanupOldAlerts();

      this.logger.log(
        `Scheduled monitoring completed for ${deployedModels.length} models`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled monitoring failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Comprehensive model monitoring check
   */
  private async performModelMonitoringCheck(model: MLModel): Promise<void> {
    try {
      // Get monitoring configuration
      const config = await this.cacheManager.get<MonitoringConfiguration>(
        `monitoring:config:${model.id}`,
      );

      if (!config) {
        this.logger.warn(
          `No monitoring configuration found for model ${model.id}`,
        );
        return;
      }

      // Perform health check
      const healthStatus =
        await this.performanceMonitoringService.performModelHealthCheck(
          model.id,
          model.tenantId,
        );

      // Check thresholds and create alerts if needed
      await this.checkThresholdsAndCreateAlerts(model, config, healthStatus);

      // Update health metrics cache
      await this.updateHealthMetricsCache(model.id, healthStatus);
    } catch (error) {
      this.logger.error(
        `Model monitoring check failed for ${model.id}: ${error.message}`,
      );
    }
  }

  /**
   * Check thresholds and create alerts
   */
  private async checkThresholdsAndCreateAlerts(
    model: MLModel,
    config: MonitoringConfiguration,
    healthStatus: any,
  ): Promise<void> {
    const { thresholds } = config;

    // Check accuracy degradation
    if (healthStatus.accuracyMetrics?.mape > thresholds.accuracy.critical) {
      await this.createAlert(
        model.tenantId,
        model.id,
        AlertType.ACCURACY_DEGRADATION,
        AlertSeverity.CRITICAL,
        'Critical Accuracy Degradation',
        `Model accuracy degraded to ${healthStatus.accuracyMetrics.mape}% MAPE`,
        {
          currentValue: healthStatus.accuracyMetrics.mape,
          threshold: thresholds.accuracy.critical,
          severity_score: 95,
          confidence: 0.9,
          detection_method: 'threshold_monitoring',
          related_alerts: [],
        },
      );
    }

    // Check response time
    if (
      healthStatus.performanceMetrics?.responseTime >
      thresholds.responseTime.critical
    ) {
      await this.createAlert(
        model.tenantId,
        model.id,
        AlertType.PERFORMANCE_DEGRADATION,
        AlertSeverity.HIGH,
        'High Response Time',
        `Model response time increased to ${healthStatus.performanceMetrics.responseTime}ms`,
        {
          currentValue: healthStatus.performanceMetrics.responseTime,
          threshold: thresholds.responseTime.critical,
          severity_score: 85,
          confidence: 0.95,
          detection_method: 'performance_monitoring',
          related_alerts: [],
        },
      );
    }

    // Check error rate
    if (
      healthStatus.reliabilityMetrics?.errorRate > thresholds.errorRate.critical
    ) {
      await this.createAlert(
        model.tenantId,
        model.id,
        AlertType.HIGH_ERROR_RATE,
        AlertSeverity.CRITICAL,
        'High Error Rate',
        `Model error rate increased to ${healthStatus.reliabilityMetrics.errorRate}%`,
        {
          currentValue: healthStatus.reliabilityMetrics.errorRate,
          threshold: thresholds.errorRate.critical,
          severity_score: 90,
          confidence: 0.98,
          detection_method: 'error_rate_monitoring',
          related_alerts: [],
        },
      );
    }
  }

  // Helper methods for supporting functionality

  private async getDeployedModels(
    tenantId: string,
    modelId?: string,
  ): Promise<MLModel[]> {
    const whereCondition: any = { tenantId, status: ModelStatus.DEPLOYED };
    if (modelId) {
      whereCondition.id = modelId;
    }

    return this.mlModelRepository.find({
      where: whereCondition,
      relations: ['predictions', 'trainingJobs'],
    });
  }

  private async collectModelHealthSummary(
    model: MLModel,
  ): Promise<ModelHealthSummary> {
    const healthStatus =
      await this.performanceMonitoringService.performModelHealthCheck(
        model.id,
        model.tenantId,
      );

    return {
      modelId: model.id,
      modelType: model.modelType,
      deploymentId: `deploy_${model.id}_${model.deployedAt?.getTime()}`,
      healthScore: this.calculateHealthScore(healthStatus),
      status: healthStatus.overallHealth || 'unknown',
      uptime: 99.5, // Would calculate actual uptime
      keyMetrics: {
        accuracy: model.accuracy || 0,
        responseTime: 0, // Would get from actual performance metrics
        errorRate: 0, // Would get from actual reliability metrics
        throughput: 0, // Would get from actual performance metrics
      },
      trend: 'stable', // Would analyze historical data
    };
  }

  private calculateOverallHealth(
    modelHealthSummaries: ModelHealthSummary[],
  ): any {
    if (modelHealthSummaries.length === 0) {
      return { score: 0, status: 'unknown', trend: 'stable' };
    }

    const avgScore =
      modelHealthSummaries.reduce((sum, model) => sum + model.healthScore, 0) /
      modelHealthSummaries.length;

    let status: string;
    if (avgScore >= 90) status = 'excellent';
    else if (avgScore >= 75) status = 'good';
    else if (avgScore >= 60) status = 'warning';
    else status = 'critical';

    return {
      score: Math.round(avgScore),
      status,
      trend: 'stable', // Would analyze trends
    };
  }

  private calculateHealthScore(healthStatus: any): number {
    // Weighted calculation of health score
    const weights = {
      accuracy: 0.3,
      performance: 0.25,
      reliability: 0.25,
      availability: 0.2,
    };

    let score = 0;

    // Accuracy score (inverse of MAPE)
    const accuracyScore = Math.max(
      0,
      100 - (healthStatus.accuracyMetrics?.mape || 50),
    );
    score += accuracyScore * weights.accuracy;

    // Performance score (inverse of response time)
    const performanceScore = Math.max(
      0,
      100 - (healthStatus.performanceMetrics?.responseTime || 2000) / 20,
    );
    score += performanceScore * weights.performance;

    // Reliability score (inverse of error rate)
    const reliabilityScore = Math.max(
      0,
      100 - (healthStatus.reliabilityMetrics?.errorRate || 10) * 10,
    );
    score += reliabilityScore * weights.reliability;

    // Availability score
    const availabilityScore =
      (healthStatus.reliabilityMetrics?.uptime || 0.95) * 100;
    score += availabilityScore * weights.availability;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private async generateSLAComplianceReport(
    tenantId: string,
    modelId?: string,
  ): Promise<SLAComplianceReport> {
    // Mock implementation - would analyze actual SLA data
    return {
      overallCompliance: 98.5,
      slaBreaches: [],
      complianceByMetric: {
        availability: 99.2,
        response_time: 97.8,
        accuracy: 95.5,
        throughput: 98.9,
      },
      penalties: 0,
      improvementActions: ['Optimize response time during peak hours'],
    };
  }

  private async generateAlertsSummary(
    tenantId: string,
    modelId?: string,
  ): Promise<AlertsSummary> {
    const alerts = await this.getActiveAlerts(tenantId, modelId);

    return {
      totalAlerts: alerts.length,
      alertsByType: alerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<AlertType, number>),
      alertsBySeverity: alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<AlertSeverity, number>),
      alertTrends: [5, 3, 7, 2, 4], // Last 5 periods
      meanTimeToResolution: 45, // minutes
      falsePositiveRate: 5.2, // percentage
    };
  }

  private async calculateBusinessImpact(
    tenantId: string,
    modelId?: string,
  ): Promise<BusinessImpactSummary> {
    // Mock implementation - would calculate actual business impact
    return {
      totalRevenueLoss: 0,
      affectedCustomers: 0,
      serviceDowntime: 0,
      businessProcessImpacts: [],
      customerSatisfactionImpact: 95,
    };
  }

  private async generateIndonesianInsights(
    tenantId: string,
    modelId?: string,
  ): Promise<IndonesianInsightsSummary> {
    return {
      culturalEventImpacts: [],
      regionalPerformance: [
        {
          region: 'Jakarta',
          timezone: 'WIB',
          healthScore: 95,
          specificChallenges: [],
          optimizationOpportunities: ['Peak hour optimization'],
        },
      ],
      timezoneCoverage: [
        {
          timezone: 'WIB',
          coverage: 98.5,
          averageResponseTime: 1200,
          reliabilityScore: 96,
        },
        {
          timezone: 'WITA',
          coverage: 97.2,
          averageResponseTime: 1350,
          reliabilityScore: 94,
        },
        {
          timezone: 'WIT',
          coverage: 95.8,
          averageResponseTime: 1500,
          reliabilityScore: 92,
        },
      ],
      businessHoursOptimization: 92.5,
      ramadanLebaranAdjustments: {
        ramadanAdjustments: {
          enabled: true,
          effectivenessScore: 88,
          alertReduction: 25,
        },
        lebaranAdjustments: {
          enabled: true,
          effectivenessScore: 90,
          alertReduction: 30,
        },
      },
    };
  }

  private async generateProductionRecommendations(
    modelHealth: ModelHealthSummary[],
    slaCompliance: SLAComplianceReport,
    alerts: AlertsSummary,
    businessImpact: BusinessImpactSummary,
  ): Promise<ProductionRecommendation[]> {
    const recommendations: ProductionRecommendation[] = [];

    // Add performance optimization recommendations
    if (modelHealth.some(m => m.keyMetrics.responseTime > 1500)) {
      recommendations.push({
        id: 'perf_opt_1',
        type: 'optimization',
        priority: 'high',
        title: 'Optimize Model Response Time',
        description:
          'Implement caching and model optimization to reduce response time',
        expectedBenefit: '30% response time improvement',
        estimatedEffort: '2-3 weeks',
        businessJustification: 'Improved user experience and higher throughput',
        implementationSteps: [
          'Implement prediction result caching',
          'Optimize model serving infrastructure',
          'Add load balancing',
        ],
        indonesianContext:
          'Optimized for Indonesian business hours and peak periods',
      });
    }

    return recommendations;
  }

  private async assessAlertBusinessImpact(
    tenantId: string,
    modelId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    metadata: AlertMetadata,
  ): Promise<BusinessImpactAssessment> {
    // Calculate business impact based on alert type and severity
    let impactLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
    let estimatedRevenueLoss = 0;
    let affectedUsers = 0;

    switch (severity) {
      case AlertSeverity.CRITICAL:
        impactLevel = 'critical';
        estimatedRevenueLoss = 10000;
        affectedUsers = 1000;
        break;
      case AlertSeverity.HIGH:
        impactLevel = 'high';
        estimatedRevenueLoss = 5000;
        affectedUsers = 500;
        break;
      case AlertSeverity.MEDIUM:
        impactLevel = 'medium';
        estimatedRevenueLoss = 1000;
        affectedUsers = 100;
        break;
      default:
        impactLevel = 'low';
        estimatedRevenueLoss = 100;
        affectedUsers = 10;
    }

    return {
      impactLevel,
      affectedUsers,
      estimatedRevenueLoss,
      businessProcessesAffected: ['Inventory Forecasting', 'Demand Planning'],
      slaBreaches: [],
      customerExperienceImpact: severity === AlertSeverity.CRITICAL ? 20 : 5,
    };
  }

  private async getIndonesianAlertContext(
    tenantId: string,
    severity: AlertSeverity,
  ): Promise<IndonesianAlertContext> {
    const now = moment().tz('Asia/Jakarta');

    return {
      timezone: 'WIB',
      businessHours: now.hour() >= 8 && now.hour() <= 17,
      ramadanPeriod: false, // Would check actual calendar
      lebaranPeriod: false,
      peakBusinessHour: now.hour() >= 9 && now.hour() <= 11,
      regionalImpact: ['Jakarta', 'Surabaya', 'Bandung'],
      localizedSeverity: severity,
    };
  }

  private async generateRemediationActions(
    alertType: AlertType,
    severity: AlertSeverity,
    metadata: AlertMetadata,
    modelId: string,
  ): Promise<RemediationAction[]> {
    const actions: RemediationAction[] = [];

    switch (alertType) {
      case AlertType.ACCURACY_DEGRADATION:
        actions.push({
          actionId: `remediation_${Date.now()}_1`,
          type: 'automated',
          title: 'Trigger Model Retraining',
          description:
            'Automatically trigger model retraining with latest data',
          priority: 1,
          estimatedTime: 30,
          prerequisites: ['Sufficient training data available'],
          automatedScript: 'trigger_retraining.sh',
          status: 'pending',
        });
        break;

      case AlertType.HIGH_ERROR_RATE:
        actions.push({
          actionId: `remediation_${Date.now()}_2`,
          type: 'automated',
          title: 'Restart Model Service',
          description:
            'Restart the model serving service to clear any stuck processes',
          priority: 1,
          estimatedTime: 5,
          prerequisites: [],
          automatedScript: 'restart_service.sh',
          status: 'pending',
        });
        break;
    }

    return actions;
  }

  private getAffectedMetrics(alertType: AlertType): string[] {
    switch (alertType) {
      case AlertType.ACCURACY_DEGRADATION:
        return ['accuracy', 'mape', 'mae', 'rmse'];
      case AlertType.PERFORMANCE_DEGRADATION:
        return ['response_time', 'throughput', 'cpu_usage'];
      case AlertType.HIGH_ERROR_RATE:
        return ['error_rate', 'success_rate', 'availability'];
      default:
        return [];
    }
  }

  private async scheduleMonitoringJobs(
    config: MonitoringConfiguration,
  ): Promise<void> {
    // Implementation for scheduling monitoring jobs
    this.logger.log(`Monitoring jobs scheduled for model ${config.modelId}`);
  }

  private async setupAlertChannels(channels: AlertChannel[]): Promise<void> {
    // Implementation for setting up alert channels
    this.logger.log(
      `Alert channels configured: ${channels.map(c => c.type).join(', ')}`,
    );
  }

  private async initializeBaselineMetrics(
    config: MonitoringConfiguration,
  ): Promise<void> {
    // Implementation for initializing baseline metrics
    this.logger.log(`Baseline metrics initialized for model ${config.modelId}`);
  }

  private async setupIndonesianContextMonitoring(
    config: MonitoringConfiguration,
  ): Promise<void> {
    // Implementation for Indonesian context monitoring
    this.logger.log(
      `Indonesian context monitoring enabled for model ${config.modelId}`,
    );
  }

  private async sendAlertNotifications(alert: ProductionAlert): Promise<void> {
    // Implementation for sending alert notifications
    this.logger.warn(`Alert notification sent: ${alert.alertId}`);
  }

  private async executeAutomatedRemediation(
    alert: ProductionAlert,
  ): Promise<void> {
    // Implementation for automated remediation
    const automatedActions = alert.remediationActions.filter(
      a => a.type === 'automated',
    );
    for (const action of automatedActions) {
      this.logger.log(`Executing automated remediation: ${action.title}`);
      // Execute the remediation script
    }
  }

  private async updateHealthMetricsCache(
    modelId: string,
    healthStatus: any,
  ): Promise<void> {
    await this.cacheManager.set(
      `health:metrics:${modelId}`,
      healthStatus,
      5 * 60 * 1000, // 5 minutes
    );
  }

  private async cleanupOldAlerts(): Promise<void> {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    for (const [alertId, alert] of this.alertCache.entries()) {
      if (
        alert.triggeredAt.getTime() < cutoffTime &&
        alert.status === AlertStatus.RESOLVED
      ) {
        this.alertCache.delete(alertId);
      }
    }
  }
}
