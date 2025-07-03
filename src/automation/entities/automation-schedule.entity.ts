import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';

export enum ScheduleType {
  REORDER_CHECK = 'reorder_check',
  INVENTORY_REVIEW = 'inventory_review',
  DEMAND_FORECAST = 'demand_forecast',
  SUPPLIER_EVALUATION = 'supplier_evaluation',
  BUDGET_REVIEW = 'budget_review',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  CUSTOM = 'custom',
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

@Entity('automation_schedules')
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'nextExecution'])
export class AutomationSchedule extends AuditableEntity {
  // Basic Information
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ScheduleType,
    default: ScheduleType.REORDER_CHECK,
  })
  type: ScheduleType;

  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.ACTIVE,
  })
  status: ScheduleStatus;

  // Scheduling Configuration
  @Column({ type: 'varchar', length: 100 })
  cronExpression: string; // Cron expression for scheduling

  @Column({ type: 'varchar', length: 50, default: 'Asia/Jakarta' })
  timezone: string;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextExecution?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastExecution?: Date;

  // Execution Configuration
  @Column({ type: 'int', default: 3600 }) // 1 hour
  timeoutSeconds: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'int', default: 300 }) // 5 minutes
  retryDelaySeconds: number;

  @Column({ type: 'boolean', default: true })
  allowConcurrentExecution: boolean;

  @Column({ type: 'boolean', default: false })
  skipIfPreviousRunning: boolean;

  // Job Configuration
  @Column({ type: 'varchar', length: 100 })
  jobName: string; // Name of the job to execute

  @Column({ type: 'jsonb', nullable: true })
  jobParameters?: Record<string, any>; // Parameters for the job

  @Column({ type: 'jsonb', nullable: true })
  filters?: {
    productIds?: string[];
    locationIds?: string[];
    supplierIds?: string[];
    categories?: string[];
    tags?: string[];
    conditions?: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
      value: any;
    }>;
  };

  // Notification Configuration
  @Column({ type: 'boolean', default: true })
  sendNotifications: boolean;

  @Column({ type: 'simple-array', nullable: true })
  notificationEmails?: string[];

  @Column({ type: 'boolean', default: false })
  notifyOnStart: boolean;

  @Column({ type: 'boolean', default: true })
  notifyOnSuccess: boolean;

  @Column({ type: 'boolean', default: true })
  notifyOnFailure: boolean;

  @Column({ type: 'boolean', default: false })
  notifyOnTimeout: boolean;

  // Performance and Monitoring
  @Column({ type: 'int', default: 0 })
  totalExecutions: number;

  @Column({ type: 'int', default: 0 })
  successfulExecutions: number;

  @Column({ type: 'int', default: 0 })
  failedExecutions: number;

  @Column({ type: 'int', default: 0 })
  timeoutExecutions: number;

  @Column({ type: 'int', nullable: true })
  averageExecutionTimeMs?: number;

  @Column({ type: 'int', nullable: true })
  lastExecutionTimeMs?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  successRate: number; // Percentage

  // Error Handling
  @Column({ type: 'int', default: 0 })
  consecutiveFailures: number;

  @Column({ type: 'timestamp', nullable: true })
  lastFailureAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastErrorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  lastErrorDetails?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  pauseOnConsecutiveFailures: boolean;

  @Column({ type: 'int', default: 5 })
  maxConsecutiveFailures: number;

  // Activity Control
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPaused: boolean;

  @Column({ type: 'timestamp', nullable: true })
  pausedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  pausedUntil?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pauseReason?: string;

  // Priority and Resource Management
  @Column({ type: 'int', default: 5 })
  priority: number; // 1-10, higher number = higher priority

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceGroup?: string; // For resource allocation

  @Column({ type: 'int', nullable: true })
  maxConcurrentJobs?: number; // Max concurrent jobs of this type

  // Dependency Management
  @Column({ type: 'simple-array', nullable: true })
  dependencies?: string[]; // IDs of schedules that must complete first

  @Column({ type: 'boolean', default: false })
  waitForDependencies: boolean;

  @Column({ type: 'int', default: 3600 }) // 1 hour
  dependencyTimeoutSeconds: number;

  // Maintenance and Lifecycle
  @Column({ type: 'timestamp', nullable: true })
  lastMaintenanceAt?: Date;

  @Column({ type: 'int', default: 30 })
  maintenanceIntervalDays: number;

  @Column({ type: 'boolean', default: false })
  archiveOnCompletion: boolean;

  @Column({ type: 'int', default: 90 })
  retentionDays: number; // How long to keep execution history

  // Relations
  @OneToMany(() => ScheduleExecution, execution => execution.schedule)
  executions?: ScheduleExecution[];

  // Virtual Properties
  get isOverdue(): boolean {
    if (!this.nextExecution || !this.isActive) return false;
    return this.nextExecution < new Date();
  }

  get isHealthy(): boolean {
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) return false;
    if (this.successRate < 80 && this.totalExecutions > 10) return false;
    return true;
  }

  get shouldBePaused(): boolean {
    if (this.pauseOnConsecutiveFailures && this.consecutiveFailures >= this.maxConsecutiveFailures) {
      return true;
    }
    return false;
  }

  get estimatedNextDuration(): number {
    return this.averageExecutionTimeMs || 60000; // Default 1 minute
  }

  // Business Methods
  calculateNextExecution(): Date {
    // This would use a proper cron parser library
    // For now, simple implementation based on cron expression
    const now = new Date();
    
    // Parse simple patterns
    if (this.cronExpression === '0 * * * *') { // Every hour
      const next = new Date(now);
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next;
    } else if (this.cronExpression === '0 0 * * *') { // Daily at midnight
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    } else if (this.cronExpression === '0 0 * * 0') { // Weekly on Sunday
      const next = new Date(now);
      const daysUntilSunday = (7 - next.getDay()) % 7;
      next.setDate(next.getDate() + (daysUntilSunday || 7));
      next.setHours(0, 0, 0, 0);
      return next;
    }
    
    // Default to next hour
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  updateExecutionStats(executionTimeMs: number, success: boolean, errorMessage?: string): void {
    this.totalExecutions += 1;
    this.lastExecutionTimeMs = executionTimeMs;
    this.lastExecution = new Date();

    if (success) {
      this.successfulExecutions += 1;
      this.consecutiveFailures = 0;
      this.lastErrorMessage = null;
    } else {
      this.failedExecutions += 1;
      this.consecutiveFailures += 1;
      this.lastFailureAt = new Date();
      this.lastErrorMessage = errorMessage;
    }

    // Update success rate
    this.successRate = (this.successfulExecutions / this.totalExecutions) * 100;

    // Update average execution time
    if (this.averageExecutionTimeMs) {
      this.averageExecutionTimeMs = Math.round(
        (this.averageExecutionTimeMs * (this.totalExecutions - 1) + executionTimeMs) / this.totalExecutions
      );
    } else {
      this.averageExecutionTimeMs = executionTimeMs;
    }

    // Check if should be paused due to consecutive failures
    if (this.shouldBePaused && this.isActive) {
      this.pause(`Paused due to ${this.consecutiveFailures} consecutive failures`);
    }

    // Calculate next execution
    this.nextExecution = this.calculateNextExecution();
  }

  pause(reason?: string, durationHours?: number): void {
    this.isPaused = true;
    this.pausedAt = new Date();
    this.pauseReason = reason;

    if (durationHours) {
      this.pausedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    }
  }

  resume(): void {
    this.isPaused = false;
    this.pausedAt = null;
    this.pausedUntil = null;
    this.pauseReason = null;
    this.nextExecution = this.calculateNextExecution();
  }

  activate(): void {
    this.isActive = true;
    this.status = ScheduleStatus.ACTIVE;
    this.nextExecution = this.calculateNextExecution();
  }

  deactivate(): void {
    this.isActive = false;
    this.status = ScheduleStatus.INACTIVE;
    this.nextExecution = null;
  }

  canExecute(): boolean {
    if (!this.isActive || this.isPaused) return false;
    if (this.status !== ScheduleStatus.ACTIVE) return false;
    if (this.pausedUntil && this.pausedUntil > new Date()) return false;
    if (this.endDate && this.endDate < new Date()) return false;
    return true;
  }

  shouldExecute(): boolean {
    if (!this.canExecute()) return false;
    if (!this.nextExecution) return false;
    return this.nextExecution <= new Date();
  }

  recordExecution(success: boolean, executionTime: number, errorMessage?: string): void {
    this.totalExecutions += 1;
    this.lastExecution = new Date();
    this.averageExecutionTimeMs = this.averageExecutionTimeMs
      ? Math.round((this.averageExecutionTimeMs + executionTime) / 2)
      : executionTime;

    if (success) {
      this.successfulExecutions += 1;
      this.consecutiveFailures = 0;
    } else {
      this.failedExecutions += 1;
      this.consecutiveFailures += 1;
      this.lastErrorMessage = errorMessage;
    }

    // Update success rate
    this.successRate = (this.successfulExecutions / this.totalExecutions) * 100;

    // Calculate next execution time
    this.calculateNextExecution();
  }
}

@Entity('schedule_executions')
@Index(['tenantId', 'scheduleId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'executedAt'])
export class ScheduleExecution extends AuditableEntity {
  @Column({ type: 'uuid' })
  scheduleId: string;

  @Column({ type: 'timestamp' })
  executedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @Column({ type: 'int', nullable: true })
  executionTimeMs?: number;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result?: {
    processed: number;
    created: number;
    updated: number;
    errors: number;
    warnings: number;
    summary?: string;
    details?: any;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  jobId?: string; // Bull job ID

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId?: string; // For tracking related executions

  @Column({ type: 'int', nullable: true })
  resourcesUsed?: number; // CPU, memory usage if tracked

  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    itemsProcessed: number;
    ordersGenerated: number;
    emailsSent: number;
    errorsEncountered: number;
    [key: string]: any;
  };

  // Relations
  @ManyToOne(() => AutomationSchedule, schedule => schedule.executions)
  @JoinColumn({ name: 'scheduleId' })
  schedule: AutomationSchedule;

  // Virtual Properties
  get isRunning(): boolean {
    return this.status === ExecutionStatus.RUNNING;
  }

  get isCompleted(): boolean {
    return [ExecutionStatus.SUCCESS, ExecutionStatus.FAILED, ExecutionStatus.TIMEOUT, ExecutionStatus.CANCELLED].includes(this.status);
  }

  get wasSuccessful(): boolean {
    return this.status === ExecutionStatus.SUCCESS;
  }

  get duration(): number {
    if (!this.completedAt || !this.executedAt) return 0;
    return this.completedAt.getTime() - this.executedAt.getTime();
  }

  // Business Methods
  start(jobId?: string): void {
    this.status = ExecutionStatus.RUNNING;
    this.executedAt = new Date();
    this.jobId = jobId;
  }

  complete(result?: any, metrics?: any): void {
    this.status = ExecutionStatus.SUCCESS;
    this.completedAt = new Date();
    this.executionTimeMs = this.duration;
    this.result = result;
    this.metrics = metrics;
  }

  fail(errorMessage: string, errorDetails?: any): void {
    this.status = ExecutionStatus.FAILED;
    this.completedAt = new Date();
    this.executionTimeMs = this.duration;
    this.errorMessage = errorMessage;
    this.errorDetails = errorDetails;
  }

  timeout(): void {
    this.status = ExecutionStatus.TIMEOUT;
    this.completedAt = new Date();
    this.executionTimeMs = this.duration;
    this.errorMessage = 'Execution timed out';
  }

  cancel(reason?: string): void {
    this.status = ExecutionStatus.CANCELLED;
    this.completedAt = new Date();
    this.executionTimeMs = this.duration;
    this.errorMessage = reason || 'Execution cancelled';
  }

  retry(): void {
    this.retryCount += 1;
    this.status = ExecutionStatus.PENDING;
    this.completedAt = null;
    this.executionTimeMs = null;
    this.errorMessage = null;
    this.errorDetails = null;
  }
}