import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { DeadLetterJob, RecoveryStrategy } from './dead-letter-job.entity';
import { JobFailurePattern } from './job-failure-pattern.entity';

export enum RecoveryStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export enum RecoveryMethod {
  AUTOMATIC_RETRY = 'automatic_retry',
  MANUAL_RETRY = 'manual_retry',
  MODIFIED_RETRY = 'modified_retry',
  ESCALATION = 'escalation',
  MANUAL_INTERVENTION = 'manual_intervention',
  PATTERN_BASED = 'pattern_based',
  BULK_RECOVERY = 'bulk_recovery',
}

export enum RecoveryTrigger {
  SCHEDULE = 'schedule',
  MANUAL = 'manual',
  PATTERN_DETECTION = 'pattern_detection',
  BUSINESS_HOURS = 'business_hours',
  SYSTEM_RECOVERY = 'system_recovery',
  ESCALATION = 'escalation',
}

@Entity('job_recovery_logs')
@Index(['tenantId', 'status', 'createdAt'])
@Index(['tenantId', 'recoveryMethod', 'status'])
@Index(['deadLetterJobId'])
@Index(['patternId'])
@Index(['recoveryStartedAt'])
export class JobRecoveryLog extends BaseEntity {
  @Column({ type: 'uuid', name: 'dead_letter_job_id' })
  deadLetterJobId: string;

  @ManyToOne(() => DeadLetterJob, { nullable: false })
  @JoinColumn({ name: 'dead_letter_job_id' })
  deadLetterJob: DeadLetterJob;

  @Column({ type: 'uuid', nullable: true, name: 'pattern_id' })
  patternId?: string;

  @ManyToOne(() => JobFailurePattern, { nullable: true })
  @JoinColumn({ name: 'pattern_id' })
  pattern?: JobFailurePattern;

  @Column({
    type: 'enum',
    enum: RecoveryStatus,
    default: RecoveryStatus.INITIATED,
  })
  status: RecoveryStatus;

  @Column({
    type: 'enum',
    enum: RecoveryMethod,
    name: 'recovery_method',
  })
  recoveryMethod: RecoveryMethod;

  @Column({
    type: 'enum',
    enum: RecoveryStrategy,
    name: 'recovery_strategy',
  })
  recoveryStrategy: RecoveryStrategy;

  @Column({
    type: 'enum',
    enum: RecoveryTrigger,
    name: 'recovery_trigger',
  })
  recoveryTrigger: RecoveryTrigger;

  @Column({ type: 'varchar', length: 100, name: 'recovery_job_id', nullable: true })
  recoveryJobId?: string;

  @Column({ type: 'varchar', length: 100, name: 'recovery_queue', nullable: true })
  recoveryQueue?: string;

  @Column({
    type: 'timestamp with time zone',
    name: 'recovery_started_at',
  })
  recoveryStartedAt: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'recovery_completed_at',
    nullable: true,
  })
  recoveryCompletedAt?: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'recovery_failed_at',
    nullable: true,
  })
  recoveryFailedAt?: Date;

  @Column({ type: 'integer', default: 0, name: 'recovery_duration_ms' })
  recoveryDurationMs: number;

  @Column({ type: 'integer', default: 1, name: 'recovery_attempt_number' })
  recoveryAttemptNumber: number;

  @Column({ type: 'jsonb', name: 'recovery_configuration' })
  recoveryConfiguration: {
    originalJobData: any;
    modifiedJobData?: any;
    retryOptions?: {
      maxAttempts: number;
      backoffMultiplier: number;
      respectBusinessHours: boolean;
      customDelay?: number;
    };
    overrides?: {
      queue?: string;
      priority?: number;
      timeout?: number;
      credentials?: any;
    };
    businessRules?: {
      requireBusinessHours: boolean;
      isRamadanSensitive: boolean;
      isHolidaySensitive: boolean;
      timezone: string;
    };
  };

  @Column({ type: 'jsonb', name: 'recovery_result', nullable: true })
  recoveryResult?: {
    success: boolean;
    result?: any;
    error?: {
      message: string;
      code: string;
      stack?: string;
    };
    metrics?: {
      executionTime: number;
      retryAttempts: number;
      circuitBreakerState: string;
    };
  };

  @Column({ type: 'text', name: 'recovery_notes', nullable: true })
  recoveryNotes?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'initiated_by' })
  initiatedBy?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'assigned_to' })
  assignedTo?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @Column({
    type: 'timestamp with time zone',
    name: 'approved_at',
    nullable: true,
  })
  approvedAt?: Date;

  @Column({ type: 'text', name: 'approval_notes', nullable: true })
  approvalNotes?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'correlation_id' })
  correlationId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'request_id' })
  requestId?: string;

  @Column({ type: 'jsonb', name: 'business_context', nullable: true })
  businessContext?: {
    platform?: string;
    channelId?: string;
    orderIds?: string[];
    priority?: string;
    impactLevel?: string;
    businessJustification?: string;
  };

  @Column({ type: 'jsonb', name: 'error_analysis', nullable: true })
  errorAnalysis?: {
    errorCategory: string;
    rootCause?: string;
    similarPatterns?: string[];
    preventionMeasures?: string[];
    estimatedImpact?: {
      affectedOrders: number;
      estimatedLoss: number;
      customerImpact: string;
    };
  };

  @Column({ type: 'jsonb', name: 'success_metrics', nullable: true })
  successMetrics?: {
    originalFailureTime: Date;
    recoveryTime: Date;
    totalDowntime: number;
    businessImpactMitigated: boolean;
    customerNotificationsSent: number;
    ordersProcessed: number;
  };

  @Column({ type: 'boolean', default: false, name: 'requires_approval' })
  requiresApproval: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_critical_recovery' })
  isCriticalRecovery: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_bulk_recovery' })
  isBulkRecovery: boolean;

  @Column({ type: 'boolean', default: false, name: 'has_side_effects' })
  hasSideEffects: boolean;

  @Column({ type: 'boolean', default: false, name: 'requires_manual_validation' })
  requiresManualValidation: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_business_hours_only' })
  isBusinessHoursOnly: boolean;

  // Indonesian business context fields
  @Column({ type: 'varchar', length: 50, default: 'Asia/Jakarta', name: 'timezone' })
  timezone: string;

  @Column({ type: 'boolean', default: false, name: 'scheduled_for_business_hours' })
  scheduledForBusinessHours: boolean;

  @Column({ type: 'boolean', default: false, name: 'ramadan_consideration' })
  ramadanConsideration: boolean;

  @Column({ type: 'boolean', default: false, name: 'holiday_consideration' })
  holidayConsideration: boolean;

  @Column({ type: 'jsonb', name: 'validation_results', nullable: true })
  validationResults?: {
    preRecoveryChecks: Array<{
      check: string;
      passed: boolean;
      message: string;
    }>;
    postRecoveryChecks: Array<{
      check: string;
      passed: boolean;
      message: string;
    }>;
    overallStatus: 'passed' | 'failed' | 'warning';
  };

  @BeforeInsert()
  beforeInsert() {
    super.beforeInsert();
    if (!this.recoveryStartedAt) {
      this.recoveryStartedAt = new Date();
    }
  }

  @BeforeUpdate()
  beforeUpdate() {
    super.beforeUpdate();
    if (this.status === RecoveryStatus.COMPLETED && !this.recoveryCompletedAt) {
      this.recoveryCompletedAt = new Date();
      this.recoveryDurationMs = this.recoveryCompletedAt.getTime() - this.recoveryStartedAt.getTime();
    }
    if (this.status === RecoveryStatus.FAILED && !this.recoveryFailedAt) {
      this.recoveryFailedAt = new Date();
      this.recoveryDurationMs = this.recoveryFailedAt.getTime() - this.recoveryStartedAt.getTime();
    }
  }

  /**
   * Check if recovery is within Indonesian business hours
   */
  isWithinBusinessHours(): boolean {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    const day = jakartaTime.getDay();

    // Monday to Friday, 9 AM to 5 PM Jakarta time
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  /**
   * Check if recovery should be delayed for business hours
   */
  shouldDelayForBusinessHours(): boolean {
    return this.isBusinessHoursOnly && !this.isWithinBusinessHours();
  }

  /**
   * Calculate next business hour for recovery
   */
  getNextBusinessHour(): Date {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const nextBusinessHour = new Date(jakartaTime);
    
    nextBusinessHour.setHours(9, 0, 0, 0);
    
    const currentDay = nextBusinessHour.getDay();
    
    // If weekend, move to Monday
    if (currentDay === 0) { // Sunday
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 1);
    } else if (currentDay === 6) { // Saturday
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 2);
    } else if (jakartaTime.getHours() >= 17) { // After business hours
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 1);
    }
    
    return nextBusinessHour;
  }

  /**
   * Mark recovery as completed
   */
  markAsCompleted(result?: any, metrics?: any): void {
    this.status = RecoveryStatus.COMPLETED;
    this.recoveryCompletedAt = new Date();
    this.recoveryDurationMs = this.recoveryCompletedAt.getTime() - this.recoveryStartedAt.getTime();
    
    if (result || metrics) {
      this.recoveryResult = {
        success: true,
        result,
        metrics,
      };
    }
  }

  /**
   * Mark recovery as failed
   */
  markAsFailed(error: Error, metrics?: any): void {
    this.status = RecoveryStatus.FAILED;
    this.recoveryFailedAt = new Date();
    this.recoveryDurationMs = this.recoveryFailedAt.getTime() - this.recoveryStartedAt.getTime();
    
    this.recoveryResult = {
      success: false,
      error: {
        message: error.message,
        code: error.name,
        stack: error.stack,
      },
      metrics,
    };
  }

  /**
   * Add validation results
   */
  addValidationResults(
    preRecoveryChecks: Array<{ check: string; passed: boolean; message: string }>,
    postRecoveryChecks: Array<{ check: string; passed: boolean; message: string }> = []
  ): void {
    const overallStatus = [
      ...preRecoveryChecks,
      ...postRecoveryChecks
    ].every(check => check.passed) ? 'passed' : 'failed';
    
    this.validationResults = {
      preRecoveryChecks,
      postRecoveryChecks,
      overallStatus,
    };
  }

  /**
   * Approve recovery (for critical recoveries)
   */
  approve(approvedBy: string, notes?: string): void {
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.approvalNotes = notes;
  }

  /**
   * Calculate recovery success rate for this type of recovery
   */
  static calculateSuccessRate(logs: JobRecoveryLog[]): number {
    if (logs.length === 0) return 0;
    
    const successfulRecoveries = logs.filter(log => 
      log.status === RecoveryStatus.COMPLETED
    ).length;
    
    return (successfulRecoveries / logs.length) * 100;
  }

  /**
   * Get average recovery time for this type of recovery
   */
  static getAverageRecoveryTime(logs: JobRecoveryLog[]): number {
    const completedLogs = logs.filter(log => 
      log.status === RecoveryStatus.COMPLETED && log.recoveryDurationMs > 0
    );
    
    if (completedLogs.length === 0) return 0;
    
    const totalDuration = completedLogs.reduce((sum, log) => sum + log.recoveryDurationMs, 0);
    return totalDuration / completedLogs.length;
  }

  /**
   * Get recovery performance metrics
   */
  getPerformanceMetrics(): {
    duration: number;
    success: boolean;
    businessImpact: string;
    efficiency: string;
  } {
    return {
      duration: this.recoveryDurationMs,
      success: this.status === RecoveryStatus.COMPLETED,
      businessImpact: this.isCriticalRecovery ? 'high' : 'medium',
      efficiency: this.recoveryDurationMs < 300000 ? 'excellent' : // < 5 minutes
                 this.recoveryDurationMs < 1800000 ? 'good' : // < 30 minutes
                 'needs_improvement',
    };
  }

  /**
   * Get human-readable summary
   */
  getSummary(): string {
    const duration = this.recoveryDurationMs ? 
      `${Math.round(this.recoveryDurationMs / 1000)}s` : 
      'ongoing';
    
    return `${this.recoveryMethod} recovery - ${this.status} - ${duration}`;
  }

  /**
   * Check if recovery is overdue
   */
  isOverdue(): boolean {
    if (this.status === RecoveryStatus.COMPLETED || this.status === RecoveryStatus.FAILED) {
      return false;
    }
    
    const now = new Date();
    const hoursElapsed = (now.getTime() - this.recoveryStartedAt.getTime()) / (1000 * 60 * 60);
    
    // Recovery is overdue if it takes more than 2 hours
    return hoursElapsed > 2;
  }

  /**
   * Generate recovery report
   */
  generateReport(): {
    summary: string;
    details: any;
    recommendations: string[];
  } {
    const summary = this.getSummary();
    const performance = this.getPerformanceMetrics();
    
    const recommendations: string[] = [];
    
    if (!performance.success) {
      recommendations.push('Review error analysis and consider alternative recovery strategies');
    }
    
    if (performance.efficiency === 'needs_improvement') {
      recommendations.push('Optimize recovery process to reduce duration');
    }
    
    if (this.isOverdue()) {
      recommendations.push('Consider escalating to manual intervention');
    }
    
    return {
      summary,
      details: {
        performance,
        validationResults: this.validationResults,
        businessContext: this.businessContext,
        errorAnalysis: this.errorAnalysis,
      },
      recommendations,
    };
  }
}