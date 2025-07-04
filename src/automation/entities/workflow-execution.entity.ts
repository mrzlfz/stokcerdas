import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { User } from '../../users/entities/user.entity';

export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  PAUSED = 'paused',
  WAITING = 'waiting', // Waiting for external input or condition
}

export enum WorkflowStepExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
  WAITING_RETRY = 'waiting_retry',
  WAITING_CONDITION = 'waiting_condition',
  WAITING_INPUT = 'waiting_input',
}

export enum ExecutionTrigger {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  EVENT_TRIGGERED = 'event_triggered',
  API_TRIGGERED = 'api_triggered',
  WEBHOOK_TRIGGERED = 'webhook_triggered',
  CONDITION_MET = 'condition_met',
  DEPENDENCY_SATISFIED = 'dependency_satisfied',
}

@Entity('workflow_executions')
@Index(['tenantId', 'workflowId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'triggeredBy'])
@Index(['tenantId', 'startedAt'])
@Index(['tenantId', 'completedAt'])
@Index(['parentExecutionId'])
export class WorkflowExecution extends AuditableEntity {
  @Column({ type: 'uuid' })
  workflowId: string;

  @Column({ type: 'varchar', length: 50 })
  executionId: string; // Unique identifier for this execution

  @Column({
    type: 'enum',
    enum: WorkflowExecutionStatus,
    default: WorkflowExecutionStatus.PENDING,
  })
  status: WorkflowExecutionStatus;

  @Column({ type: 'enum', enum: ExecutionTrigger })
  trigger: ExecutionTrigger;

  // Execution Details
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  @Column({ type: 'uuid', nullable: true })
  triggeredByUserId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  triggeredBySystem?: string; // e.g., 'scheduler', 'webhook', 'api'

  // Input/Output Data
  @Column({ type: 'jsonb', nullable: true })
  inputData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  outputData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  workflowVariables?: Record<string, any>;

  // Execution Context
  @Column({ type: 'jsonb', nullable: true })
  executionContext?: {
    // Environment information
    serverInfo?: {
      hostname?: string;
      nodeVersion?: string;
      memoryUsage?: number;
      cpuUsage?: number;
    };

    // Request context (if API triggered)
    requestInfo?: {
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
      correlationId?: string;
    };

    // Trigger context
    triggerInfo?: {
      source?: string;
      metadata?: Record<string, any>;
      timestamp?: string;
    };

    // Execution settings
    settings?: {
      retryOnFailure?: boolean;
      maxRetries?: number;
      timeout?: number;
      priority?: number;
    };
  };

  // Progress Tracking
  @Column({ type: 'integer', default: 0 })
  currentStepIndex: number;

  @Column({ type: 'uuid', nullable: true })
  currentStepId?: string;

  @Column({ type: 'integer', default: 0 })
  totalSteps: number;

  @Column({ type: 'integer', default: 0 })
  completedSteps: number;

  @Column({ type: 'integer', default: 0 })
  failedSteps: number;

  @Column({ type: 'integer', default: 0 })
  skippedSteps: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercentage: number;

  // Error Handling
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  errorStack?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode?: string;

  @Column({ type: 'uuid', nullable: true })
  failedStepId?: string;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  nextRetryAt?: Date;

  // Resource Usage
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  peakMemoryUsageMB?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageCpuUsage?: number;

  @Column({ type: 'integer', nullable: true })
  totalApiCalls?: number;

  @Column({ type: 'integer', nullable: true })
  totalDbQueries?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedCost?: number; // in IDR

  // Nested Execution Support
  @Column({ type: 'uuid', nullable: true })
  parentExecutionId?: string;

  @Column({ type: 'integer', default: 0 })
  nestedLevel: number;

  @Column({ type: 'boolean', default: false })
  isSubWorkflow: boolean;

  // State Management
  @Column({ type: 'boolean', default: false })
  isPaused: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  pausedAt?: Date;

  @Column({ type: 'text', nullable: true })
  pauseReason?: string;

  @Column({ type: 'boolean', default: false })
  canResume: boolean;

  // Audit and Compliance
  @Column({ type: 'jsonb', nullable: true })
  auditLog?: Array<{
    timestamp: string;
    action: string;
    details: Record<string, any>;
    userId?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  complianceInfo?: {
    dataProcessed?: number;
    personalDataAccessed?: boolean;
    externalSystemsCalled?: string[];
    documentsGenerated?: string[];
  };

  // Relationships
  @ManyToOne(() => Workflow, workflow => workflow.executions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'triggeredByUserId' })
  triggeredBy?: User;

  @ManyToOne(() => WorkflowExecution, { nullable: true })
  @JoinColumn({ name: 'parentExecutionId' })
  parentExecution?: WorkflowExecution;

  @OneToMany(
    () => WorkflowStepExecution,
    stepExecution => stepExecution.workflowExecution,
    { cascade: true },
  )
  stepExecutions: WorkflowStepExecution[];

  // Business Logic Methods
  canCancel(): boolean {
    return [
      WorkflowExecutionStatus.PENDING,
      WorkflowExecutionStatus.RUNNING,
      WorkflowExecutionStatus.PAUSED,
      WorkflowExecutionStatus.WAITING,
    ].includes(this.status);
  }

  isResumable(): boolean {
    return this.status === WorkflowExecutionStatus.PAUSED && this.canResume;
  }

  canRetry(): boolean {
    return [
      WorkflowExecutionStatus.FAILED,
      WorkflowExecutionStatus.TIMEOUT,
    ].includes(this.status);
  }

  updateProgress(): void {
    if (this.totalSteps > 0) {
      this.progressPercentage = (this.completedSteps / this.totalSteps) * 100;
    }
  }

  recordStepCompletion(stepId: string, success: boolean): void {
    if (success) {
      this.completedSteps += 1;
    } else {
      this.failedSteps += 1;
      this.failedStepId = stepId;
    }
    this.updateProgress();
  }

  markCompleted(outputData?: Record<string, any>): void {
    this.status = WorkflowExecutionStatus.COMPLETED;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.outputData = outputData;
    this.progressPercentage = 100;
  }

  markFailed(error: string, stepId?: string, errorCode?: string): void {
    this.status = WorkflowExecutionStatus.FAILED;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.errorMessage = error;
    this.failedStepId = stepId;
    this.errorCode = errorCode;
  }

  markCancelled(reason?: string): void {
    this.status = WorkflowExecutionStatus.CANCELLED;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.pauseReason = reason;
  }

  pause(reason?: string): void {
    this.status = WorkflowExecutionStatus.PAUSED;
    this.isPaused = true;
    this.pausedAt = new Date();
    this.pauseReason = reason;
    this.canResume = true;
  }

  resume(): void {
    this.status = WorkflowExecutionStatus.RUNNING;
    this.isPaused = false;
    this.pausedAt = null;
    this.pauseReason = null;
    this.canResume = false;
  }

  addAuditEntry(
    action: string,
    details: Record<string, any>,
    userId?: string,
  ): void {
    if (!this.auditLog) {
      this.auditLog = [];
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
      userId,
    });
  }

  getExecutionMetrics() {
    return {
      executionId: this.executionId,
      status: this.status,
      duration: this.durationMs,
      progressPercentage: this.progressPercentage,
      totalSteps: this.totalSteps,
      completedSteps: this.completedSteps,
      failedSteps: this.failedSteps,
      skippedSteps: this.skippedSteps,
      retryCount: this.retryCount,
      resourceUsage: {
        peakMemoryUsageMB: this.peakMemoryUsageMB,
        averageCpuUsage: this.averageCpuUsage,
        totalApiCalls: this.totalApiCalls,
        totalDbQueries: this.totalDbQueries,
        estimatedCost: this.estimatedCost,
      },
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      trigger: this.trigger,
      triggeredByUserId: this.triggeredByUserId,
    };
  }

  generateExecutionReport(): any {
    return {
      execution: this.getExecutionMetrics(),
      workflow: {
        id: this.workflowId,
        name: this.workflow?.name,
        category: this.workflow?.category,
      },
      steps: this.stepExecutions?.map(step => step.getStepMetrics()) || [],
      auditTrail: this.auditLog || [],
      summary: {
        successful: this.status === WorkflowExecutionStatus.COMPLETED,
        totalExecutionTime: this.durationMs,
        stepsSuccessRate:
          this.totalSteps > 0
            ? (this.completedSteps / this.totalSteps) * 100
            : 0,
        resourceEfficiency: this.calculateResourceEfficiency(),
        errorSummary: this.errorMessage
          ? {
              message: this.errorMessage,
              code: this.errorCode,
              failedStep: this.failedStepId,
            }
          : null,
      },
    };
  }

  private calculateResourceEfficiency(): number {
    // Simple efficiency calculation based on resource usage vs duration
    if (!this.durationMs || !this.peakMemoryUsageMB) return 1;

    const baselineMemory = 50; // MB
    const baselineTime = 30000; // 30 seconds

    const memoryEfficiency = Math.min(
      baselineMemory / (this.peakMemoryUsageMB || baselineMemory),
      1,
    );
    const timeEfficiency = Math.min(baselineTime / this.durationMs, 1);

    return (memoryEfficiency + timeEfficiency) / 2;
  }
}

@Entity('workflow_step_executions')
@Index(['tenantId', 'workflowExecutionId'])
@Index(['tenantId', 'stepId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'startedAt'])
export class WorkflowStepExecution extends AuditableEntity {
  @Column({ type: 'uuid' })
  workflowExecutionId: string;

  @Column({ type: 'uuid' })
  stepId: string;

  @Column({ type: 'varchar', length: 100 })
  stepName: string;

  @Column({ type: 'varchar', length: 50 })
  stepType: string;

  @Column({
    type: 'enum',
    enum: WorkflowStepExecutionStatus,
    default: WorkflowStepExecutionStatus.PENDING,
  })
  status: WorkflowStepExecutionStatus;

  @Column({ type: 'integer' })
  executionOrder: number;

  // Execution Details
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  // Input/Output Data
  @Column({ type: 'jsonb', nullable: true })
  inputData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  outputData?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  stepConfiguration?: Record<string, any>;

  // Error Handling
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  errorStack?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode?: string;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  nextRetryAt?: Date;

  // Resource Usage
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  memoryUsageMB?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  cpuUsage?: number;

  @Column({ type: 'integer', nullable: true })
  apiCallsCount?: number;

  @Column({ type: 'integer', nullable: true })
  dbQueriesCount?: number;

  // Result Metadata
  @Column({ type: 'integer', nullable: true })
  recordsProcessed?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dataSize?: number; // in KB

  @Column({ type: 'jsonb', nullable: true })
  executionMetadata?: Record<string, any>;

  // Conditional Execution
  @Column({ type: 'boolean', nullable: true })
  conditionResult?: boolean;

  @Column({ type: 'uuid', nullable: true })
  nextStepId?: string;

  @Column({ type: 'boolean', default: false })
  wasSkipped: boolean;

  @Column({ type: 'text', nullable: true })
  skipReason?: string;

  // Relationships
  @ManyToOne(() => WorkflowExecution, execution => execution.stepExecutions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflowExecutionId' })
  workflowExecution: WorkflowExecution;

  @ManyToOne(() => WorkflowStep, step => step.executions)
  @JoinColumn({ name: 'stepId' })
  step: WorkflowStep;

  // Business Logic Methods
  markCompleted(
    outputData?: Record<string, any>,
    recordsProcessed?: number,
  ): void {
    this.status = WorkflowStepExecutionStatus.COMPLETED;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.outputData = outputData;
    this.recordsProcessed = recordsProcessed;
  }

  markFailed(error: string, errorCode?: string): void {
    this.status = WorkflowStepExecutionStatus.FAILED;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.errorMessage = error;
    this.errorCode = errorCode;
  }

  markSkipped(reason?: string): void {
    this.status = WorkflowStepExecutionStatus.SKIPPED;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
    this.wasSkipped = true;
    this.skipReason = reason;
  }

  updateResourceUsage(memoryMB?: number, cpuPercent?: number): void {
    if (memoryMB) this.memoryUsageMB = memoryMB;
    if (cpuPercent) this.cpuUsage = cpuPercent;
  }

  getStepMetrics() {
    return {
      stepId: this.stepId,
      stepName: this.stepName,
      stepType: this.stepType,
      status: this.status,
      executionOrder: this.executionOrder,
      duration: this.durationMs,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      wasSkipped: this.wasSkipped,
      skipReason: this.skipReason,
      retryCount: this.retryCount,
      recordsProcessed: this.recordsProcessed,
      resourceUsage: {
        memoryUsageMB: this.memoryUsageMB,
        cpuUsage: this.cpuUsage,
        apiCallsCount: this.apiCallsCount,
        dbQueriesCount: this.dbQueriesCount,
        dataSize: this.dataSize,
      },
      error: this.errorMessage
        ? {
            message: this.errorMessage,
            code: this.errorCode,
          }
        : null,
    };
  }
}
