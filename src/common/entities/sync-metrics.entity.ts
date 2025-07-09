import {
  Entity,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export enum SyncOperationStatus {
  STARTED = 'started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export enum SyncOperationType {
  PRODUCT_SYNC = 'product_sync',
  INVENTORY_SYNC = 'inventory_sync',
  ORDER_SYNC = 'order_sync',
  PRICE_SYNC = 'price_sync',
  CUSTOMER_SYNC = 'customer_sync',
  PROMOTION_SYNC = 'promotion_sync',
  CATEGORY_SYNC = 'category_sync',
  FULL_SYNC = 'full_sync',
}

export enum SyncDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BIDIRECTIONAL = 'bidirectional',
}

@Entity('sync_metrics')
@Index(['tenantId', 'platform', 'operationType', 'createdAt'])
@Index(['tenantId', 'operationId'])
@Index(['tenantId', 'status', 'createdAt'])
@Index(['platform', 'channelId', 'status'])
@Index(['createdAt'])
export class SyncMetrics extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'operation_id', unique: true })
  operationId: string;

  @Column({
    type: 'enum',
    enum: SyncOperationType,
    name: 'operation_type',
  })
  operationType: SyncOperationType;

  @Column({
    type: 'enum',
    enum: SyncDirection,
    name: 'sync_direction',
    default: SyncDirection.BIDIRECTIONAL,
  })
  syncDirection: SyncDirection;

  @Column({ type: 'varchar', length: 50, name: 'platform' })
  platform: string;

  @Column({ type: 'varchar', length: 100, name: 'channel_id' })
  channelId: string;

  @Column({
    type: 'enum',
    enum: SyncOperationStatus,
    default: SyncOperationStatus.STARTED,
  })
  status: SyncOperationStatus;

  @Column({
    type: 'timestamp with time zone',
    name: 'start_time',
  })
  startTime: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'end_time',
    nullable: true,
  })
  endTime?: Date;

  @Column({ type: 'integer', name: 'duration_ms', default: 0 })
  durationMs: number;

  @Column({ type: 'integer', name: 'records_processed', default: 0 })
  recordsProcessed: number;

  @Column({ type: 'integer', name: 'records_successful', default: 0 })
  recordsSuccessful: number;

  @Column({ type: 'integer', name: 'records_failed', default: 0 })
  recordsFailed: number;

  @Column({ type: 'integer', name: 'records_skipped', default: 0 })
  recordsSkipped: number;

  @Column({ type: 'integer', name: 'error_count', default: 0 })
  errorCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'success_rate', default: 0 })
  successRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'throughput_per_second', default: 0 })
  throughputPerSecond: number;

  @Column({ type: 'integer', name: 'average_response_time_ms', default: 0 })
  averageResponseTimeMs: number;

  @Column({ type: 'integer', name: 'peak_response_time_ms', default: 0 })
  peakResponseTimeMs: number;

  @Column({ type: 'bigint', name: 'memory_usage_bytes', default: 0 })
  memoryUsageBytes: number;

  @Column({ type: 'bigint', name: 'cpu_usage_microseconds', default: 0 })
  cpuUsageMicroseconds: number;

  @Column({ type: 'jsonb', name: 'last_error', nullable: true })
  lastError?: {
    message: string;
    code: string;
    stack?: string;
    timestamp: Date;
    context?: any;
  };

  @Column({ type: 'jsonb', name: 'business_context' })
  businessContext: {
    isBusinessHours: boolean;
    ramadanPeriod: boolean;
    holidayPeriod: boolean;
    timezone: string;
    peakTrafficPeriod: boolean;
    jakartaTime: Date;
    workingDay: boolean;
    businessQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    seasonalFactor: number;
  };

  @Column({ type: 'jsonb', name: 'performance_metrics' })
  performanceMetrics: {
    requestsPerSecond: number;
    cacheMisses: number;
    cacheHits: number;
    networkLatency: number;
    databaseQueryTime: number;
    apiCallDuration: number;
    queueProcessingTime: number;
    retryAttempts: number;
    circuitBreakerState: string;
  };

  @Column({ type: 'jsonb', name: 'data_quality_metrics' })
  dataQualityMetrics: {
    duplicateRecords: number;
    invalidRecords: number;
    missingRequiredFields: number;
    dataTransformationErrors: number;
    validationErrors: number;
    dataIntegrityScore: number;
  };

  @Column({ type: 'jsonb', name: 'platform_specific_metrics' })
  platformSpecificMetrics: {
    rateLimitHits: number;
    apiQuotaUsed: number;
    authenticationRefreshes: number;
    webhookDeliveries: number;
    batchSizeOptimization: number;
    platformSpecificErrors: Record<string, number>;
  };

  @Column({ type: 'jsonb', name: 'sync_configuration' })
  syncConfiguration: {
    batchSize: number;
    concurrencyLevel: number;
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
      initialDelay: number;
    };
    filterCriteria: any;
    mappingRules: any;
    validationRules: any;
  };

  @Column({ type: 'jsonb', name: 'alerts_generated', default: '[]' })
  alertsGenerated: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
  }>;

  @Column({ type: 'varchar', length: 100, name: 'correlation_id', nullable: true })
  correlationId?: string;

  @Column({ type: 'varchar', length: 100, name: 'parent_operation_id', nullable: true })
  parentOperationId?: string;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    requestHeaders?: Record<string, string>;
    triggerType?: 'manual' | 'scheduled' | 'webhook' | 'event';
    triggeredBy?: string;
    syncReason?: string;
    priorities?: string[];
    tags?: string[];
  };

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', name: 'is_manual_trigger', default: false })
  isManualTrigger: boolean;

  @Column({ type: 'boolean', name: 'is_scheduled_trigger', default: false })
  isScheduledTrigger: boolean;

  @Column({ type: 'boolean', name: 'is_webhook_trigger', default: false })
  isWebhookTrigger: boolean;

  @Column({ type: 'boolean', name: 'is_event_trigger', default: false })
  isEventTrigger: boolean;

  @Column({ type: 'boolean', name: 'requires_manual_review', default: false })
  requiresManualReview: boolean;

  @Column({ type: 'boolean', name: 'has_data_quality_issues', default: false })
  hasDataQualityIssues: boolean;

  @Column({ type: 'boolean', name: 'has_performance_issues', default: false })
  hasPerformanceIssues: boolean;

  @Column({ type: 'boolean', name: 'Indonesian_business_hours_only', default: false })
  indonesianBusinessHoursOnly: boolean;

  @Column({ type: 'boolean', name: 'ramadan_sensitive', default: false })
  ramadanSensitive: boolean;

  @Column({ type: 'boolean', name: 'holiday_sensitive', default: false })
  holidaySensitive: boolean;

  @BeforeInsert()
  beforeInsert() {
    super.beforeInsert();
    if (!this.startTime) {
      this.startTime = new Date();
    }
    if (!this.operationId) {
      this.operationId = `sync_${this.tenantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  @BeforeUpdate()
  beforeUpdate() {
    super.beforeUpdate();
    
    // Update duration if operation is completed
    if (this.endTime && this.startTime) {
      this.durationMs = this.endTime.getTime() - this.startTime.getTime();
    }
    
    // Calculate success rate
    if (this.recordsProcessed > 0) {
      this.successRate = (this.recordsSuccessful / this.recordsProcessed) * 100;
    }
    
    // Calculate throughput
    if (this.durationMs > 0) {
      this.throughputPerSecond = (this.recordsProcessed / this.durationMs) * 1000;
    }
    
    // Set flags based on thresholds
    this.hasDataQualityIssues = this.dataQualityMetrics.dataIntegrityScore < 0.8;
    this.hasPerformanceIssues = this.averageResponseTimeMs > 5000 || this.successRate < 90;
    this.requiresManualReview = this.hasDataQualityIssues || this.hasPerformanceIssues || this.errorCount > 10;
  }

  /**
   * Mark operation as completed
   */
  markAsCompleted(): void {
    this.status = SyncOperationStatus.COMPLETED;
    this.endTime = new Date();
  }

  /**
   * Mark operation as failed
   */
  markAsFailed(error?: any): void {
    this.status = SyncOperationStatus.FAILED;
    this.endTime = new Date();
    
    if (error) {
      this.lastError = {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN_ERROR',
        stack: error.stack,
        timestamp: new Date(),
        context: error.context,
      };
    }
  }

  /**
   * Add an alert to the operation
   */
  addAlert(alert: {
    type: string;
    severity: string;
    message: string;
    metadata?: any;
  }): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.alertsGenerated.push({
      id: alertId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: new Date(),
      resolved: false,
    });
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alertsGenerated.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
    }
  }

  /**
   * Get sync performance score (0-100)
   */
  getPerformanceScore(): number {
    const successRateScore = this.successRate;
    const responseTimeScore = Math.max(0, 100 - (this.averageResponseTimeMs / 100));
    const throughputScore = Math.min(100, this.throughputPerSecond * 10);
    const errorScore = Math.max(0, 100 - (this.errorCount * 10));
    
    return Math.round(
      (successRateScore * 0.3) +
      (responseTimeScore * 0.25) +
      (throughputScore * 0.25) +
      (errorScore * 0.2)
    );
  }

  /**
   * Get Indonesian business context impact score
   */
  getBusinessContextImpactScore(): number {
    let score = 100;
    
    // Penalize operations outside business hours (if business hours only)
    if (this.indonesianBusinessHoursOnly && !this.businessContext.isBusinessHours) {
      score -= 20;
    }
    
    // Adjust for Ramadan period
    if (this.ramadanSensitive && this.businessContext.ramadanPeriod) {
      score -= 10;
    }
    
    // Adjust for holiday period
    if (this.holidaySensitive && this.businessContext.holidayPeriod) {
      score -= 15;
    }
    
    // Bonus for peak traffic handling
    if (this.businessContext.peakTrafficPeriod && this.successRate > 95) {
      score += 5;
    }
    
    // Seasonal factor adjustment
    score *= this.businessContext.seasonalFactor;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get human-readable summary
   */
  getSummary(): string {
    const duration = this.durationMs ? `${Math.round(this.durationMs / 1000)}s` : 'ongoing';
    const successRate = this.successRate ? `${this.successRate.toFixed(1)}%` : '0%';
    
    return `${this.operationType} on ${this.platform} - ${this.status} - ${duration} - ${this.recordsProcessed} records - ${successRate} success`;
  }

  /**
   * Check if operation is considered healthy
   */
  isHealthy(): boolean {
    return this.successRate >= 95 && 
           this.averageResponseTimeMs < 5000 && 
           this.errorCount < 5 &&
           !this.hasDataQualityIssues;
  }

  /**
   * Get recommendations for improvement
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.successRate < 90) {
      recommendations.push('Improve error handling and retry logic');
    }
    
    if (this.averageResponseTimeMs > 5000) {
      recommendations.push('Optimize API call performance');
    }
    
    if (this.hasDataQualityIssues) {
      recommendations.push('Implement better data validation and cleansing');
    }
    
    if (this.indonesianBusinessHoursOnly && !this.businessContext.isBusinessHours) {
      recommendations.push('Schedule operations during Indonesian business hours');
    }
    
    if (this.ramadanSensitive && this.businessContext.ramadanPeriod) {
      recommendations.push('Adjust sync frequency during Ramadan period');
    }
    
    if (this.platformSpecificMetrics.rateLimitHits > 0) {
      recommendations.push('Implement better rate limiting and backoff strategies');
    }
    
    return recommendations;
  }
}