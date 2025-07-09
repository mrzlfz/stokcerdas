import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BaseService } from './base.service';
import { SyncMetrics } from '../entities/sync-metrics.entity';
// import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
// import { IntegrationLogLevel, IntegrationLogType } from '../../integrations/entities/integration-log.entity';

export interface SyncOperationMetrics {
  operationId: string;
  operationType: string;
  platform: string;
  channelId: string;
  tenantId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'started' | 'completed' | 'failed' | 'timeout';
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errorCount: number;
  lastError?: {
    message: string;
    code: string;
    stack?: string;
    timestamp: Date;
  };
  performanceMetrics: {
    averageResponseTime: number;
    peakResponseTime: number;
    throughputPerSecond: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  businessContext: {
    isBusinessHours: boolean;
    ramadanPeriod: boolean;
    holidayPeriod: boolean;
    timezone: string;
    peakTrafficPeriod: boolean;
  };
  indonesianLocalization: {
    jakartaTime: Date;
    workingDay: boolean;
    businessQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    seasonalFactor: number;
  };
}

export interface SyncHealthMetrics {
  tenantId: string;
  platform: string;
  channelId: string;
  healthScore: number; // 0-100
  availability: number; // 0-100
  errorRate: number; // 0-100
  averageResponseTime: number;
  throughput: number;
  lastSyncTime: Date;
  consecutiveFailures: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  alertsGenerated: number;
  indonesianBusinessImpact: {
    businessHoursAvailability: number;
    ramadanPerformance: number;
    holidayResilience: number;
    peakTrafficHandling: number;
  };
}

export interface SyncAlertRule {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  platform?: string;
  channelId?: string;
  condition: {
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
    threshold: number;
    timeWindow: number; // minutes
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  indonesianBusinessRules: {
    onlyDuringBusinessHours: boolean;
    excludeRamadanPeriod: boolean;
    excludeHolidays: boolean;
    priorityDuringPeakHours: boolean;
  };
  notificationChannels: string[];
  cooldownPeriod: number; // minutes
  escalationRules: Array<{
    level: number;
    delayMinutes: number;
    notificationChannels: string[];
  }>;
  lastTriggered?: Date;
  triggerCount: number;
}

@Injectable()
export class SyncMonitoringService extends BaseService<SyncMetrics> {
  private readonly logger = new Logger(SyncMonitoringService.name);
  private readonly metricsBuffer: Map<string, SyncOperationMetrics> = new Map();
  private readonly healthMetrics: Map<string, SyncHealthMetrics> = new Map();
  private readonly alertRules: Map<string, SyncAlertRule> = new Map();
  private readonly performanceBaseline: Map<string, number> = new Map();

  constructor(
    @InjectRepository(SyncMetrics)
    protected readonly repository: Repository<SyncMetrics>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Start monitoring a sync operation
   */
  async startSyncMonitoring(
    tenantId: string,
    operationType: string,
    platform: string,
    channelId: string,
    operationId: string,
    metadata?: any,
  ): Promise<void> {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    
    const metrics: SyncOperationMetrics = {
      operationId,
      operationType,
      platform,
      channelId,
      tenantId,
      startTime: now,
      status: 'started',
      recordsProcessed: 0,
      recordsSuccessful: 0,
      recordsFailed: 0,
      errorCount: 0,
      performanceMetrics: {
        averageResponseTime: 0,
        peakResponseTime: 0,
        throughputPerSecond: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user,
      },
      businessContext: {
        isBusinessHours: this.isIndonesianBusinessHours(jakartaTime),
        ramadanPeriod: this.isRamadanPeriod(jakartaTime),
        holidayPeriod: this.isIndonesianHoliday(jakartaTime),
        timezone: 'Asia/Jakarta',
        peakTrafficPeriod: this.isPeakTrafficPeriod(jakartaTime),
      },
      indonesianLocalization: {
        jakartaTime,
        workingDay: this.isWorkingDay(jakartaTime),
        businessQuarter: this.getBusinessQuarter(jakartaTime),
        seasonalFactor: this.getSeasonalFactor(jakartaTime),
      },
    };

    this.metricsBuffer.set(operationId, metrics);

    // Log operation start
    this.logger.log(`Sync operation started: ${operationType} on ${platform}`, {
      tenantId,
      channelId,
      operationId,
      operationType,
      platform,
      startTime: now,
      businessContext: metrics.businessContext,
      indonesianLocalization: metrics.indonesianLocalization,
      ...metadata,
    });

    this.logger.log(`Sync monitoring started for operation ${operationId}`, {
      tenantId,
      operationType,
      platform,
      channelId,
      businessContext: metrics.businessContext,
    });
  }

  /**
   * Update sync operation metrics
   */
  async updateSyncMetrics(
    operationId: string,
    update: {
      recordsProcessed?: number;
      recordsSuccessful?: number;
      recordsFailed?: number;
      responseTime?: number;
      error?: {
        message: string;
        code: string;
        stack?: string;
      };
    },
  ): Promise<void> {
    const metrics = this.metricsBuffer.get(operationId);
    if (!metrics) {
      this.logger.warn(`No metrics found for operation ${operationId}`);
      return;
    }

    // Update record counts
    if (update.recordsProcessed !== undefined) {
      metrics.recordsProcessed = update.recordsProcessed;
    }
    if (update.recordsSuccessful !== undefined) {
      metrics.recordsSuccessful = update.recordsSuccessful;
    }
    if (update.recordsFailed !== undefined) {
      metrics.recordsFailed = update.recordsFailed;
    }

    // Update performance metrics
    if (update.responseTime !== undefined) {
      const currentAvg = metrics.performanceMetrics.averageResponseTime;
      const processed = metrics.recordsProcessed || 1;
      metrics.performanceMetrics.averageResponseTime = 
        (currentAvg * (processed - 1) + update.responseTime) / processed;
      
      if (update.responseTime > metrics.performanceMetrics.peakResponseTime) {
        metrics.performanceMetrics.peakResponseTime = update.responseTime;
      }
    }

    // Update error information
    if (update.error) {
      metrics.errorCount++;
      metrics.lastError = {
        ...update.error,
        timestamp: new Date(),
      };
    }

    // Update throughput
    const duration = (Date.now() - metrics.startTime.getTime()) / 1000;
    if (duration > 0) {
      metrics.performanceMetrics.throughputPerSecond = metrics.recordsProcessed / duration;
    }

    // Update memory and CPU usage
    metrics.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;
    metrics.performanceMetrics.cpuUsage = process.cpuUsage().user;

    this.metricsBuffer.set(operationId, metrics);

    // Check for alerts
    await this.checkAlerts(metrics);
  }

  /**
   * Complete sync operation monitoring
   */
  async completeSyncMonitoring(
    operationId: string,
    status: 'completed' | 'failed' | 'timeout',
    finalMetrics?: any,
  ): Promise<void> {
    const metrics = this.metricsBuffer.get(operationId);
    if (!metrics) {
      this.logger.warn(`No metrics found for operation ${operationId}`);
      return;
    }

    const now = new Date();
    metrics.endTime = now;
    metrics.duration = now.getTime() - metrics.startTime.getTime();
    metrics.status = status;

    // Update final metrics
    if (finalMetrics) {
      Object.assign(metrics, finalMetrics);
    }

    // Update health metrics
    await this.updateHealthMetrics(metrics);

    // Log operation completion
    this.logger.log(`Sync operation ${status}: ${metrics.operationType} on ${metrics.platform}`, {
      tenantId: metrics.tenantId,
      channelId: metrics.channelId,
      operationId,
      operationType: metrics.operationType,
      platform: metrics.platform,
      duration: metrics.duration,
      recordsProcessed: metrics.recordsProcessed,
      recordsSuccessful: metrics.recordsSuccessful,
      recordsFailed: metrics.recordsFailed,
      errorCount: metrics.errorCount,
      performanceMetrics: metrics.performanceMetrics,
      businessContext: metrics.businessContext,
      indonesianLocalization: metrics.indonesianLocalization,
      finalStatus: status,
    });

    this.logger.log(`Sync monitoring completed for operation ${operationId}`, {
      tenantId: metrics.tenantId,
      operationType: metrics.operationType,
      platform: metrics.platform,
      status,
      duration: metrics.duration,
      recordsProcessed: metrics.recordsProcessed,
      errorCount: metrics.errorCount,
    });

    // Emit completion event
    this.eventEmitter.emit('sync.operation.completed', {
      operationId,
      metrics,
      status,
    });

    // Remove from buffer after processing
    this.metricsBuffer.delete(operationId);
  }

  /**
   * Get current sync health metrics
   */
  async getSyncHealthMetrics(
    tenantId: string,
    platform?: string,
    channelId?: string,
  ): Promise<SyncHealthMetrics[]> {
    const healthMetrics: SyncHealthMetrics[] = [];
    
    for (const [key, metrics] of this.healthMetrics) {
      const [metricTenantId, metricPlatform, metricChannelId] = key.split('_');
      
      if (metricTenantId === tenantId &&
          (!platform || metricPlatform === platform) &&
          (!channelId || metricChannelId === channelId)) {
        healthMetrics.push(metrics);
      }
    }

    return healthMetrics;
  }

  /**
   * Create or update alert rule
   */
  async createAlertRule(
    tenantId: string,
    rule: Omit<SyncAlertRule, 'id' | 'tenantId' | 'lastTriggered' | 'triggerCount'>,
  ): Promise<string> {
    const ruleId = `${tenantId}_${rule.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
    
    const alertRule: SyncAlertRule = {
      id: ruleId,
      tenantId,
      lastTriggered: undefined,
      triggerCount: 0,
      ...rule,
    };

    this.alertRules.set(ruleId, alertRule);

    this.logger.log(`Alert rule created: ${rule.name}`, {
      tenantId,
      ruleId,
      rule: alertRule,
    });

    return ruleId;
  }

  /**
   * Get sync operation performance report
   */
  async getPerformanceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    platform?: string,
    channelId?: string,
  ): Promise<{
    summary: {
      totalOperations: number;
      successfulOperations: number;
      failedOperations: number;
      averageResponseTime: number;
      totalErrorCount: number;
      uptimePercentage: number;
    };
    indonesianBusinessInsights: {
      businessHoursPerformance: number;
      ramadanPeriodPerformance: number;
      holidayPerformance: number;
      peakTrafficPerformance: number;
      workingDayVsWeekendPerformance: {
        workingDays: number;
        weekends: number;
      };
    };
    performanceTrends: Array<{
      date: Date;
      responseTime: number;
      throughput: number;
      errorRate: number;
      successRate: number;
    }>;
    platformBreakdown: Record<string, {
      operations: number;
      successRate: number;
      averageResponseTime: number;
      errorCount: number;
    }>;
    recommendations: string[];
  }> {
    // Implementation would aggregate data from logs and metrics
    // This is a simplified structure showing the expected format
    
    const summary = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      totalErrorCount: 0,
      uptimePercentage: 0,
    };

    const indonesianBusinessInsights = {
      businessHoursPerformance: 0,
      ramadanPeriodPerformance: 0,
      holidayPerformance: 0,
      peakTrafficPerformance: 0,
      workingDayVsWeekendPerformance: {
        workingDays: 0,
        weekends: 0,
      },
    };

    const performanceTrends: Array<{
      date: Date;
      responseTime: number;
      throughput: number;
      errorRate: number;
      successRate: number;
    }> = [];

    const platformBreakdown: Record<string, {
      operations: number;
      successRate: number;
      averageResponseTime: number;
      errorCount: number;
    }> = {};

    const recommendations: string[] = [];

    // Generate recommendations based on performance
    if (summary.averageResponseTime > 5000) {
      recommendations.push('Consider optimizing API calls during Indonesian business hours');
    }
    
    if (indonesianBusinessInsights.ramadanPeriodPerformance < 0.8) {
      recommendations.push('Implement Ramadan-specific retry strategies');
    }
    
    if (indonesianBusinessInsights.holidayPerformance < 0.9) {
      recommendations.push('Adjust sync schedules during Indonesian holidays');
    }

    return {
      summary,
      indonesianBusinessInsights,
      performanceTrends,
      platformBreakdown,
      recommendations,
    };
  }

  /**
   * Scheduled health check for all sync operations
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthCheck(): Promise<void> {
    this.logger.debug('Performing sync health check');
    
    for (const [key, metrics] of this.healthMetrics) {
      const [tenantId, platform, channelId] = key.split('_');
      
      // Check if last sync was too long ago
      const timeSinceLastSync = Date.now() - metrics.lastSyncTime.getTime();
      const maxSyncInterval = 30 * 60 * 1000; // 30 minutes
      
      if (timeSinceLastSync > maxSyncInterval) {
        await this.generateAlert(tenantId, platform, channelId, {
          type: 'sync_timeout',
          message: `No sync activity for ${Math.round(timeSinceLastSync / 60000)} minutes`,
          severity: 'high',
          metadata: {
            lastSyncTime: metrics.lastSyncTime,
            timeSinceLastSync,
          },
        });
      }
      
      // Check error rate
      if (metrics.errorRate > 10) {
        await this.generateAlert(tenantId, platform, channelId, {
          type: 'high_error_rate',
          message: `Error rate is ${metrics.errorRate.toFixed(2)}%`,
          severity: 'medium',
          metadata: {
            errorRate: metrics.errorRate,
            consecutiveFailures: metrics.consecutiveFailures,
          },
        });
      }
      
      // Check response time
      if (metrics.averageResponseTime > 10000) {
        await this.generateAlert(tenantId, platform, channelId, {
          type: 'slow_response',
          message: `Average response time is ${metrics.averageResponseTime}ms`,
          severity: 'medium',
          metadata: {
            averageResponseTime: metrics.averageResponseTime,
          },
        });
      }
    }
  }

  /**
   * Generate performance baseline for Indonesian business context
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generatePerformanceBaseline(): Promise<void> {
    this.logger.debug('Generating performance baseline for Indonesian business context');
    
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    
    for (const [key, metrics] of this.healthMetrics) {
      const baselineKey = `${key}_baseline`;
      
      // Calculate baseline considering Indonesian business context
      let baselineScore = metrics.healthScore;
      
      // Adjust baseline for business hours
      if (this.isIndonesianBusinessHours(jakartaTime)) {
        baselineScore *= 1.1; // Higher expectations during business hours
      }
      
      // Adjust baseline for Ramadan period
      if (this.isRamadanPeriod(jakartaTime)) {
        baselineScore *= 0.9; // Lower expectations during Ramadan
      }
      
      // Adjust baseline for holidays
      if (this.isIndonesianHoliday(jakartaTime)) {
        baselineScore *= 0.8; // Lower expectations during holidays
      }
      
      this.performanceBaseline.set(baselineKey, baselineScore);
    }
  }

  // Private helper methods

  private async updateHealthMetrics(metrics: SyncOperationMetrics): Promise<void> {
    const key = `${metrics.tenantId}_${metrics.platform}_${metrics.channelId}`;
    let healthMetrics = this.healthMetrics.get(key);

    if (!healthMetrics) {
      healthMetrics = {
        tenantId: metrics.tenantId,
        platform: metrics.platform,
        channelId: metrics.channelId,
        healthScore: 100,
        availability: 100,
        errorRate: 0,
        averageResponseTime: 0,
        throughput: 0,
        lastSyncTime: new Date(),
        consecutiveFailures: 0,
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        alertsGenerated: 0,
        indonesianBusinessImpact: {
          businessHoursAvailability: 100,
          ramadanPerformance: 100,
          holidayResilience: 100,
          peakTrafficHandling: 100,
        },
      };
    }

    // Update metrics
    healthMetrics.totalOperations++;
    healthMetrics.lastSyncTime = new Date();
    
    if (metrics.status === 'completed') {
      healthMetrics.successfulOperations++;
      healthMetrics.consecutiveFailures = 0;
    } else {
      healthMetrics.failedOperations++;
      healthMetrics.consecutiveFailures++;
    }

    // Calculate rates
    healthMetrics.errorRate = (healthMetrics.failedOperations / healthMetrics.totalOperations) * 100;
    healthMetrics.availability = ((healthMetrics.totalOperations - healthMetrics.failedOperations) / healthMetrics.totalOperations) * 100;

    // Update response time
    const currentAvg = healthMetrics.averageResponseTime;
    const totalOps = healthMetrics.totalOperations;
    healthMetrics.averageResponseTime = 
      (currentAvg * (totalOps - 1) + metrics.performanceMetrics.averageResponseTime) / totalOps;

    // Update throughput
    healthMetrics.throughput = metrics.performanceMetrics.throughputPerSecond;

    // Update Indonesian business impact
    if (metrics.businessContext.isBusinessHours) {
      healthMetrics.indonesianBusinessImpact.businessHoursAvailability = 
        (healthMetrics.indonesianBusinessImpact.businessHoursAvailability * 0.9) + 
        (metrics.status === 'completed' ? 10 : 0);
    }

    if (metrics.businessContext.ramadanPeriod) {
      healthMetrics.indonesianBusinessImpact.ramadanPerformance = 
        (healthMetrics.indonesianBusinessImpact.ramadanPerformance * 0.9) + 
        (metrics.status === 'completed' ? 10 : 0);
    }

    if (metrics.businessContext.holidayPeriod) {
      healthMetrics.indonesianBusinessImpact.holidayResilience = 
        (healthMetrics.indonesianBusinessImpact.holidayResilience * 0.9) + 
        (metrics.status === 'completed' ? 10 : 0);
    }

    if (metrics.businessContext.peakTrafficPeriod) {
      healthMetrics.indonesianBusinessImpact.peakTrafficHandling = 
        (healthMetrics.indonesianBusinessImpact.peakTrafficHandling * 0.9) + 
        (metrics.status === 'completed' ? 10 : 0);
    }

    // Calculate overall health score
    healthMetrics.healthScore = Math.min(100, Math.max(0, 
      (healthMetrics.availability * 0.4) + 
      (Math.max(0, 100 - healthMetrics.errorRate) * 0.3) + 
      (Math.max(0, 100 - (healthMetrics.averageResponseTime / 100)) * 0.3)
    ));

    this.healthMetrics.set(key, healthMetrics);
  }

  private async checkAlerts(metrics: SyncOperationMetrics): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.isActive || rule.tenantId !== metrics.tenantId) {
        continue;
      }

      // Check platform and channel filters
      if (rule.platform && rule.platform !== metrics.platform) {
        continue;
      }
      if (rule.channelId && rule.channelId !== metrics.channelId) {
        continue;
      }

      // Check Indonesian business rules
      if (rule.indonesianBusinessRules.onlyDuringBusinessHours && 
          !metrics.businessContext.isBusinessHours) {
        continue;
      }
      if (rule.indonesianBusinessRules.excludeRamadanPeriod && 
          metrics.businessContext.ramadanPeriod) {
        continue;
      }
      if (rule.indonesianBusinessRules.excludeHolidays && 
          metrics.businessContext.holidayPeriod) {
        continue;
      }

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldownPeriod * 60000) {
        continue;
      }

      // Check condition
      const metricValue = this.getMetricValue(metrics, rule.condition.metric);
      const conditionMet = this.evaluateCondition(
        metricValue,
        rule.condition.operator,
        rule.condition.threshold
      );

      if (conditionMet) {
        await this.triggerAlert(rule, metrics, metricValue);
      }
    }
  }

  private getMetricValue(metrics: SyncOperationMetrics, metricName: string): number {
    switch (metricName) {
      case 'error_rate':
        return metrics.recordsProcessed > 0 ? 
          (metrics.recordsFailed / metrics.recordsProcessed) * 100 : 0;
      case 'response_time':
        return metrics.performanceMetrics.averageResponseTime;
      case 'throughput':
        return metrics.performanceMetrics.throughputPerSecond;
      case 'error_count':
        return metrics.errorCount;
      case 'records_failed':
        return metrics.recordsFailed;
      default:
        return 0;
    }
  }

  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number
  ): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    rule: SyncAlertRule,
    metrics: SyncOperationMetrics,
    metricValue: number
  ): Promise<void> {
    rule.lastTriggered = new Date();
    rule.triggerCount++;

    await this.generateAlert(metrics.tenantId, metrics.platform, metrics.channelId, {
      type: 'alert_rule_triggered',
      message: `Alert rule "${rule.name}" triggered: ${rule.condition.metric} ${rule.condition.operator} ${rule.condition.threshold} (actual: ${metricValue})`,
      severity: rule.severity,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        condition: rule.condition,
        metricValue,
        operationId: metrics.operationId,
        triggerCount: rule.triggerCount,
      },
    });

    this.alertRules.set(rule.id, rule);
  }

  private async generateAlert(
    tenantId: string,
    platform: string,
    channelId: string,
    alert: {
      type: string;
      message: string;
      severity: string;
      metadata: any;
    }
  ): Promise<void> {
    this.logger.log(alert.message, {
      tenantId,
      channelId,
      alertType: alert.type,
      platform,
      severity: alert.severity,
      timestamp: new Date(),
      ...alert.metadata,
    });

    // Emit alert event
    this.eventEmitter.emit('sync.alert.generated', {
      tenantId,
      platform,
      channelId,
      alert,
    });

    // Update health metrics
    const key = `${tenantId}_${platform}_${channelId}`;
    const healthMetrics = this.healthMetrics.get(key);
    if (healthMetrics) {
      healthMetrics.alertsGenerated++;
      this.healthMetrics.set(key, healthMetrics);
    }
  }

  // Indonesian business context helper methods

  private isIndonesianBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    // Monday to Friday, 9 AM to 5 PM Jakarta time
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  private isRamadanPeriod(date: Date): boolean {
    // Simplified Ramadan detection - in real implementation, 
    // you'd use a proper Islamic calendar library
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Approximate Ramadan months for different years
    const ramadanMonths: Record<number, number> = {
      2024: 2, // March
      2025: 1, // February
      2026: 1, // February
      2027: 0, // January
    };
    
    return ramadanMonths[year] === month;
  }

  private isIndonesianHoliday(date: Date): boolean {
    // Simplified holiday detection - in real implementation,
    // you'd use a proper Indonesian holiday calendar
    const month = date.getMonth();
    const day = date.getDate();
    
    // Some major Indonesian holidays
    const holidays = [
      { month: 0, day: 1 },   // New Year
      { month: 7, day: 17 },  // Independence Day
      { month: 11, day: 25 }, // Christmas
    ];
    
    return holidays.some(holiday => 
      holiday.month === month && holiday.day === day
    );
  }

  private isPeakTrafficPeriod(date: Date): boolean {
    const hour = date.getHours();
    // Peak traffic typically during business hours and early evening
    return (hour >= 9 && hour <= 12) || (hour >= 19 && hour <= 21);
  }

  private isWorkingDay(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Monday to Friday
  }

  private getBusinessQuarter(date: Date): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
    const month = date.getMonth();
    if (month >= 0 && month <= 2) return 'Q1';
    if (month >= 3 && month <= 5) return 'Q2';
    if (month >= 6 && month <= 8) return 'Q3';
    return 'Q4';
  }

  private getSeasonalFactor(date: Date): number {
    const month = date.getMonth();
    
    // Indonesian seasonal factors considering monsoon seasons
    const seasonalFactors = [
      0.9, // Jan - wet season
      0.8, // Feb - wet season
      0.7, // Mar - wet season
      0.8, // Apr - transition
      0.9, // May - dry season
      1.0, // Jun - dry season
      1.1, // Jul - dry season
      1.2, // Aug - dry season
      1.1, // Sep - dry season
      1.0, // Oct - transition
      0.9, // Nov - wet season
      0.8, // Dec - wet season
    ];
    
    return seasonalFactors[month];
  }

  // Removed mapSeverityToLogLevel method - no longer needed
}