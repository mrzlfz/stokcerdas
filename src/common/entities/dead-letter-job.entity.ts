import {
  Entity,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Exclude } from 'class-transformer';

export enum DeadLetterJobStatus {
  QUARANTINED = 'quarantined',
  ANALYZING = 'analyzing',
  RETRY_SCHEDULED = 'retry_scheduled',
  RETRYING = 'retrying',
  RECOVERED = 'recovered',
  PERMANENTLY_FAILED = 'permanently_failed',
  ARCHIVED = 'archived',
}

export enum DeadLetterJobPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum FailureType {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  BUSINESS_LOGIC = 'business_logic',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  UNKNOWN = 'unknown',
}

export enum RecoveryStrategy {
  MANUAL_RETRY = 'manual_retry',
  DELAYED_RETRY = 'delayed_retry',
  MODIFIED_RETRY = 'modified_retry',
  ESCALATE = 'escalate',
  DISCARD = 'discard',
}

@Entity('dead_letter_jobs')
@Index(['tenantId', 'status', 'createdAt'])
@Index(['tenantId', 'originalQueue', 'originalJobType'])
@Index(['tenantId', 'failureType', 'createdAt'])
@Index(['tenantId', 'priority', 'status'])
@Index(['nextRetryAt'])
export class DeadLetterJob extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'original_queue' })
  originalQueue: string;

  @Column({ type: 'varchar', length: 100, name: 'original_job_type' })
  originalJobType: string;

  @Column({ type: 'varchar', length: 100, name: 'original_job_id' })
  originalJobId: string;

  @Column({ type: 'jsonb', name: 'original_job_data' })
  originalJobData: any;

  @Column({ type: 'jsonb', name: 'original_job_options', nullable: true })
  originalJobOptions?: any;

  @Column({
    type: 'enum',
    enum: DeadLetterJobStatus,
    default: DeadLetterJobStatus.QUARANTINED,
  })
  status: DeadLetterJobStatus;

  @Column({
    type: 'enum',
    enum: DeadLetterJobPriority,
    default: DeadLetterJobPriority.MEDIUM,
  })
  priority: DeadLetterJobPriority;

  @Column({
    type: 'enum',
    enum: FailureType,
    default: FailureType.UNKNOWN,
    name: 'failure_type',
  })
  failureType: FailureType;

  @Column({ type: 'text', name: 'failure_reason' })
  failureReason: string;

  @Column({ type: 'text', name: 'stack_trace', nullable: true })
  stackTrace?: string;

  @Column({ type: 'text', name: 'error_details', nullable: true })
  errorDetails?: string;

  @Column({ type: 'integer', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'integer', default: 0, name: 'max_retries' })
  maxRetries: number;

  @Column({
    type: 'timestamp with time zone',
    name: 'first_failure_at',
    nullable: true,
  })
  firstFailureAt?: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'last_failure_at',
    nullable: true,
  })
  lastFailureAt?: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'last_retry_at',
    nullable: true,
  })
  lastRetryAt?: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'next_retry_at',
    nullable: true,
  })
  nextRetryAt?: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'recovered_at',
    nullable: true,
  })
  recoveredAt?: Date;

  @Column({
    type: 'enum',
    enum: RecoveryStrategy,
    nullable: true,
    name: 'recovery_strategy',
  })
  recoveryStrategy?: RecoveryStrategy;

  @Column({ type: 'jsonb', name: 'recovery_metadata', nullable: true })
  recoveryMetadata?: any;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'channel_id' })
  channelId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'platform' })
  platform?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'correlation_id' })
  correlationId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'request_id' })
  requestId?: string;

  @Column({ type: 'jsonb', name: 'business_context', nullable: true })
  businessContext?: any;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'assigned_to' })
  assignedTo?: string;

  @Column({
    type: 'timestamp with time zone',
    name: 'assigned_at',
    nullable: true,
  })
  assignedAt?: Date;

  @Column({ type: 'jsonb', name: 'metrics', nullable: true })
  metrics?: {
    originalAttempts: number;
    totalDuration: number;
    avgRetryDelay: number;
    errorPattern: string;
    similarFailures: number;
  };

  @Column({ type: 'boolean', default: false, name: 'is_critical' })
  isCritical: boolean;

  @Column({ type: 'boolean', default: false, name: 'requires_manual_intervention' })
  requiresManualIntervention: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_business_hours_only' })
  isBusinessHoursOnly: boolean;

  // Indonesian business context fields
  @Column({ type: 'boolean', default: false, name: 'is_ramadan_sensitive' })
  isRamadanSensitive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_holiday_sensitive' })
  isHolidaySensitive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'timezone' })
  timezone?: string;

  @BeforeInsert()
  beforeInsert() {
    super.beforeInsert();
    if (!this.firstFailureAt) {
      this.firstFailureAt = new Date();
    }
    if (!this.lastFailureAt) {
      this.lastFailureAt = new Date();
    }
    if (!this.timezone) {
      this.timezone = 'Asia/Jakarta';
    }
  }

  @BeforeUpdate()
  beforeUpdate() {
    super.beforeUpdate();
    this.lastFailureAt = new Date();
  }

  /**
   * Check if job can be retried based on current conditions
   */
  canRetry(): boolean {
    if (this.status === DeadLetterJobStatus.PERMANENTLY_FAILED) {
      return false;
    }
    if (this.retryCount >= this.maxRetries) {
      return false;
    }
    if (this.status === DeadLetterJobStatus.RETRYING) {
      return false;
    }
    return true;
  }

  /**
   * Check if job should be retried during Indonesian business hours
   */
  shouldWaitForBusinessHours(): boolean {
    if (!this.isBusinessHoursOnly) {
      return false;
    }

    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    const day = jakartaTime.getDay();

    // Monday to Friday, 9 AM to 5 PM Jakarta time
    return !(day >= 1 && day <= 5 && hour >= 9 && hour <= 17);
  }

  /**
   * Calculate next retry time based on failure type and business context
   */
  calculateNextRetryTime(): Date {
    const baseDelay = this.getBaseRetryDelay();
    const exponentialDelay = baseDelay * Math.pow(2, this.retryCount);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    
    let nextRetryTime = new Date(Date.now() + exponentialDelay + jitter);

    // Respect Indonesian business hours if required
    if (this.shouldWaitForBusinessHours()) {
      const jakartaTime = new Date(nextRetryTime.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hour = jakartaTime.getHours();
      const day = jakartaTime.getDay();

      // If outside business hours, schedule for next business day 9 AM
      if (day === 0 || day === 6 || hour < 9 || hour >= 17) {
        const nextBusinessDay = new Date(jakartaTime);
        nextBusinessDay.setHours(9, 0, 0, 0);
        
        // If weekend, move to Monday
        if (day === 0) { // Sunday
          nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
        } else if (day === 6) { // Saturday
          nextBusinessDay.setDate(nextBusinessDay.getDate() + 2);
        } else if (hour >= 17) { // After business hours
          nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
        }
        
        nextRetryTime = nextBusinessDay;
      }
    }

    return nextRetryTime;
  }

  /**
   * Get base retry delay based on failure type
   */
  private getBaseRetryDelay(): number {
    switch (this.failureType) {
      case FailureType.RATE_LIMIT:
        return 60000; // 1 minute for rate limits
      case FailureType.NETWORK:
        return 30000; // 30 seconds for network issues
      case FailureType.TIMEOUT:
        return 15000; // 15 seconds for timeouts
      case FailureType.AUTHENTICATION:
        return 300000; // 5 minutes for auth issues
      case FailureType.BUSINESS_LOGIC:
        return 3600000; // 1 hour for business logic errors
      case FailureType.VALIDATION:
        return 1800000; // 30 minutes for validation errors
      case FailureType.RESOURCE_EXHAUSTED:
        return 600000; // 10 minutes for resource issues
      default:
        return 60000; // 1 minute default
    }
  }

  /**
   * Mark job as permanently failed
   */
  markAsPermanentlyFailed(reason?: string): void {
    this.status = DeadLetterJobStatus.PERMANENTLY_FAILED;
    this.recoveryStrategy = RecoveryStrategy.DISCARD;
    if (reason) {
      this.notes = reason;
    }
  }

  /**
   * Schedule job for retry
   */
  scheduleRetry(strategy: RecoveryStrategy, metadata?: any): void {
    this.status = DeadLetterJobStatus.RETRY_SCHEDULED;
    this.recoveryStrategy = strategy;
    this.nextRetryAt = this.calculateNextRetryTime();
    this.recoveryMetadata = metadata;
    this.retryCount++;
  }

  /**
   * Mark job as recovered
   */
  markAsRecovered(): void {
    this.status = DeadLetterJobStatus.RECOVERED;
    this.recoveredAt = new Date();
    this.nextRetryAt = null;
  }

  /**
   * Assign job to user for manual intervention
   */
  assignTo(userId: string): void {
    this.assignedTo = userId;
    this.assignedAt = new Date();
    this.requiresManualIntervention = true;
  }

  /**
   * Get human-readable summary of the job
   */
  getSummary(): string {
    return `${this.originalQueue}/${this.originalJobType} - ${this.failureType} - Retry ${this.retryCount}/${this.maxRetries}`;
  }

  /**
   * Check if job is stale (older than 7 days and not recovered)
   */
  isStale(): boolean {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.createdAt < sevenDaysAgo && 
           this.status !== DeadLetterJobStatus.RECOVERED &&
           this.status !== DeadLetterJobStatus.ARCHIVED;
  }
}