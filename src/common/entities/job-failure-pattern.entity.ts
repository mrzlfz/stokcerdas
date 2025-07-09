import {
  Entity,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { DeadLetterJob, FailureType } from './dead-letter-job.entity';

export enum PatternType {
  RECURRING_FAILURE = 'recurring_failure',
  TIME_BASED_FAILURE = 'time_based_failure',
  PLATFORM_SPECIFIC = 'platform_specific',
  BUSINESS_HOURS = 'business_hours',
  RATE_LIMIT_PATTERN = 'rate_limit_pattern',
  AUTHENTICATION_PATTERN = 'authentication_pattern',
  SEASONAL_PATTERN = 'seasonal_pattern',
  ESCALATION_PATTERN = 'escalation_pattern',
}

export enum PatternSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum PatternStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
  MONITORING = 'monitoring',
}

@Entity('job_failure_patterns')
@Index(['tenantId', 'patternType', 'status'])
@Index(['tenantId', 'severity', 'createdAt'])
@Index(['tenantId', 'failureType', 'platform'])
@Index(['patternKey'])
@Index(['isActive'])
export class JobFailurePattern extends BaseEntity {
  @Column({ type: 'varchar', length: 200, name: 'pattern_key', unique: true })
  patternKey: string;

  @Column({ type: 'varchar', length: 100, name: 'pattern_name' })
  patternName: string;

  @Column({ type: 'text', name: 'pattern_description' })
  patternDescription: string;

  @Column({
    type: 'enum',
    enum: PatternType,
    name: 'pattern_type',
  })
  patternType: PatternType;

  @Column({
    type: 'enum',
    enum: PatternSeverity,
    default: PatternSeverity.MEDIUM,
  })
  severity: PatternSeverity;

  @Column({
    type: 'enum',
    enum: PatternStatus,
    default: PatternStatus.ACTIVE,
  })
  status: PatternStatus;

  @Column({
    type: 'enum',
    enum: FailureType,
    name: 'failure_type',
  })
  failureType: FailureType;

  @Column({ type: 'varchar', length: 100, name: 'original_queue' })
  originalQueue: string;

  @Column({ type: 'varchar', length: 100, name: 'original_job_type' })
  originalJobType: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'channel_id' })
  channelId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'platform' })
  platform?: string;

  @Column({ type: 'integer', default: 1, name: 'occurrence_count' })
  occurrenceCount: number;

  @Column({ type: 'integer', default: 0, name: 'affected_jobs_count' })
  affectedJobsCount: number;

  @Column({
    type: 'timestamp with time zone',
    name: 'first_occurrence_at',
  })
  firstOccurrenceAt: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'last_occurrence_at',
  })
  lastOccurrenceAt: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'resolved_at',
    nullable: true,
  })
  resolvedAt?: Date;

  @Column({ type: 'jsonb', name: 'pattern_conditions' })
  patternConditions: {
    errorMessagePattern?: string;
    stackTracePattern?: string;
    timeWindow?: {
      startHour: number;
      endHour: number;
      daysOfWeek: number[];
    };
    businessContext?: {
      isRamadanSensitive: boolean;
      isHolidaySensitive: boolean;
      requiresBusinessHours: boolean;
    };
    rateLimit?: {
      requestsPerSecond: number;
      requestsPerMinute: number;
      burstLimit: number;
    };
    authentication?: {
      tokenExpiry: boolean;
      credentialsRotation: boolean;
      permissionChanges: boolean;
    };
    seasonal?: {
      months: number[];
      dateRanges: Array<{
        startDate: string;
        endDate: string;
        year?: number;
      }>;
    };
  };

  @Column({ type: 'jsonb', name: 'pattern_metadata' })
  patternMetadata: {
    averageFailureRate: number;
    peakFailureHours: number[];
    commonErrorCodes: string[];
    affectedPlatforms: string[];
    recoverySuccessRate: number;
    averageRecoveryTime: number;
    businessImpact: {
      severity: string;
      affectedTenants: number;
      estimatedLoss: number;
    };
    recommendations: string[];
  };

  @Column({ type: 'jsonb', name: 'detection_rules' })
  detectionRules: {
    minOccurrences: number;
    timeWindowMinutes: number;
    similarityThreshold: number;
    excludePatterns: string[];
    includePatterns: string[];
  };

  @Column({ type: 'jsonb', name: 'mitigation_strategies' })
  mitigationStrategies: {
    preventionActions: string[];
    recoveryActions: string[];
    escalationRules: Array<{
      condition: string;
      action: string;
      delay: number;
    }>;
    automaticRetryStrategy: {
      enabled: boolean;
      maxRetries: number;
      backoffMultiplier: number;
      respectBusinessHours: boolean;
    };
  };

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_auto_detected' })
  isAutoDetected: boolean;

  @Column({ type: 'boolean', default: false, name: 'requires_immediate_attention' })
  requiresImmediateAttention: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'suppressed_by' })
  suppressedBy?: string;

  @Column({
    type: 'timestamp with time zone',
    name: 'suppressed_at',
    nullable: true,
  })
  suppressedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'suppression_reason' })
  suppressionReason?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'resolved_by' })
  resolvedBy?: string;

  @Column({ type: 'text', nullable: true, name: 'resolution_notes' })
  resolutionNotes?: string;

  @Column({ type: 'integer', default: 0, name: 'alert_count' })
  alertCount: number;

  @Column({
    type: 'timestamp with time zone',
    name: 'last_alert_at',
    nullable: true,
  })
  lastAlertAt?: Date;

  // Indonesian business context
  @Column({ type: 'varchar', length: 50, default: 'Asia/Jakarta', name: 'timezone' })
  timezone: string;

  @Column({ type: 'boolean', default: false, name: 'affects_indonesian_business_hours' })
  affectsIndonesianBusinessHours: boolean;

  @Column({ type: 'boolean', default: false, name: 'ramadan_pattern' })
  ramadanPattern: boolean;

  @Column({ type: 'boolean', default: false, name: 'holiday_pattern' })
  holidayPattern: boolean;

  // Most recent example job for reference
  @Column({ type: 'uuid', nullable: true, name: 'example_job_id' })
  exampleJobId?: string;

  @ManyToOne(() => DeadLetterJob, { nullable: true })
  @JoinColumn({ name: 'example_job_id' })
  exampleJob?: DeadLetterJob;

  @BeforeInsert()
  beforeInsert() {
    super.beforeInsert();
    if (!this.firstOccurrenceAt) {
      this.firstOccurrenceAt = new Date();
    }
    if (!this.lastOccurrenceAt) {
      this.lastOccurrenceAt = new Date();
    }
  }

  @BeforeUpdate()
  beforeUpdate() {
    super.beforeUpdate();
    this.lastOccurrenceAt = new Date();
  }

  /**
   * Check if pattern matches a given dead letter job
   */
  matchesJob(job: DeadLetterJob): boolean {
    // Basic matching conditions
    if (this.failureType !== job.failureType) {
      return false;
    }
    if (this.originalQueue !== job.originalQueue) {
      return false;
    }
    if (this.originalJobType !== job.originalJobType) {
      return false;
    }
    if (this.platform && this.platform !== job.platform) {
      return false;
    }
    if (this.channelId && this.channelId !== job.channelId) {
      return false;
    }

    // Pattern-specific conditions
    if (this.patternConditions.errorMessagePattern) {
      const regex = new RegExp(this.patternConditions.errorMessagePattern, 'i');
      if (!regex.test(job.failureReason)) {
        return false;
      }
    }

    if (this.patternConditions.stackTracePattern && job.stackTrace) {
      const regex = new RegExp(this.patternConditions.stackTracePattern, 'i');
      if (!regex.test(job.stackTrace)) {
        return false;
      }
    }

    // Time-based matching
    if (this.patternConditions.timeWindow) {
      const jobTime = new Date(job.createdAt);
      const jakartaTime = new Date(jobTime.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hour = jakartaTime.getHours();
      const dayOfWeek = jakartaTime.getDay();

      const { startHour, endHour, daysOfWeek } = this.patternConditions.timeWindow;
      
      if (hour < startHour || hour > endHour) {
        return false;
      }
      
      if (daysOfWeek.length > 0 && !daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Increment pattern occurrence count
   */
  incrementOccurrence(job: DeadLetterJob): void {
    this.occurrenceCount++;
    this.affectedJobsCount++;
    this.lastOccurrenceAt = new Date();
    this.exampleJobId = job.id;
  }

  /**
   * Calculate pattern severity based on occurrence and impact
   */
  calculateSeverity(): PatternSeverity {
    const occurrenceWeight = Math.min(this.occurrenceCount / 10, 1);
    const affectedJobsWeight = Math.min(this.affectedJobsCount / 50, 1);
    const timeWeight = this.getTimeBasedWeight();
    const impactWeight = this.getImpactWeight();

    const totalWeight = (occurrenceWeight + affectedJobsWeight + timeWeight + impactWeight) / 4;

    if (totalWeight > 0.8) {
      return PatternSeverity.CRITICAL;
    } else if (totalWeight > 0.6) {
      return PatternSeverity.HIGH;
    } else if (totalWeight > 0.3) {
      return PatternSeverity.MEDIUM;
    } else {
      return PatternSeverity.LOW;
    }
  }

  /**
   * Get time-based weight for severity calculation
   */
  private getTimeBasedWeight(): number {
    const now = new Date();
    const hoursSinceFirst = (now.getTime() - this.firstOccurrenceAt.getTime()) / (1000 * 60 * 60);
    const hoursSinceLast = (now.getTime() - this.lastOccurrenceAt.getTime()) / (1000 * 60 * 60);

    // Recent and frequent patterns are more severe
    if (hoursSinceLast < 1) {
      return 1.0;
    } else if (hoursSinceLast < 6) {
      return 0.8;
    } else if (hoursSinceLast < 24) {
      return 0.6;
    } else {
      return 0.2;
    }
  }

  /**
   * Get impact weight for severity calculation
   */
  private getImpactWeight(): number {
    if (this.requiresImmediateAttention) {
      return 1.0;
    }
    if (this.affectsIndonesianBusinessHours) {
      return 0.8;
    }
    if (this.failureType === FailureType.AUTHENTICATION) {
      return 0.9;
    }
    if (this.failureType === FailureType.BUSINESS_LOGIC) {
      return 0.7;
    }
    return 0.5;
  }

  /**
   * Check if pattern should trigger an alert
   */
  shouldTriggerAlert(): boolean {
    if (!this.isActive) {
      return false;
    }
    
    const now = new Date();
    const hoursSinceLastAlert = this.lastAlertAt ? 
      (now.getTime() - this.lastAlertAt.getTime()) / (1000 * 60 * 60) : 
      Infinity;

    // Alert frequency based on severity
    const alertIntervalHours = {
      [PatternSeverity.CRITICAL]: 0.5, // 30 minutes
      [PatternSeverity.HIGH]: 2,       // 2 hours
      [PatternSeverity.MEDIUM]: 8,     // 8 hours
      [PatternSeverity.LOW]: 24,       // 24 hours
    };

    return hoursSinceLastAlert >= alertIntervalHours[this.severity];
  }

  /**
   * Record alert sent
   */
  recordAlert(): void {
    this.alertCount++;
    this.lastAlertAt = new Date();
  }

  /**
   * Mark pattern as resolved
   */
  markAsResolved(resolvedBy: string, notes?: string): void {
    this.status = PatternStatus.RESOLVED;
    this.resolvedBy = resolvedBy;
    this.resolvedAt = new Date();
    this.resolutionNotes = notes;
    this.isActive = false;
  }

  /**
   * Suppress pattern (temporarily disable alerts)
   */
  suppress(suppressedBy: string, reason?: string): void {
    this.status = PatternStatus.SUPPRESSED;
    this.suppressedBy = suppressedBy;
    this.suppressedAt = new Date();
    this.suppressionReason = reason;
    this.isActive = false;
  }

  /**
   * Reactivate suppressed pattern
   */
  reactivate(): void {
    this.status = PatternStatus.ACTIVE;
    this.suppressedBy = null;
    this.suppressedAt = null;
    this.suppressionReason = null;
    this.isActive = true;
  }

  /**
   * Get recommendation for handling this pattern
   */
  getRecommendation(): string {
    const recommendations = this.patternMetadata.recommendations || [];
    
    if (recommendations.length === 0) {
      return this.generateDefaultRecommendation();
    }
    
    return recommendations[0];
  }

  /**
   * Generate default recommendation based on pattern type
   */
  private generateDefaultRecommendation(): string {
    switch (this.patternType) {
      case PatternType.RATE_LIMIT_PATTERN:
        return 'Implement exponential backoff and respect rate limit headers';
      case PatternType.AUTHENTICATION_PATTERN:
        return 'Review authentication credentials and token refresh logic';
      case PatternType.BUSINESS_HOURS:
        return 'Schedule retries during Indonesian business hours (9 AM - 5 PM WIB)';
      case PatternType.SEASONAL_PATTERN:
        return 'Adjust processing strategies for seasonal variations';
      case PatternType.PLATFORM_SPECIFIC:
        return 'Review platform-specific error handling and retry strategies';
      default:
        return 'Review error handling and implement appropriate retry strategies';
    }
  }

  /**
   * Get human-readable summary
   */
  getSummary(): string {
    return `${this.patternName} - ${this.occurrenceCount} occurrences affecting ${this.affectedJobsCount} jobs`;
  }
}