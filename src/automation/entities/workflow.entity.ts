import { Entity, Column, Index, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { WorkflowStep } from './workflow-step.entity';
import { WorkflowExecution } from './workflow-execution.entity';
import { User } from '../../users/entities/user.entity';

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  ERROR = 'error',
}

export enum WorkflowTriggerType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  EVENT_BASED = 'event_based',
  WEBHOOK = 'webhook',
  API_TRIGGER = 'api_trigger',
  CONDITION_BASED = 'condition_based',
}

export enum WorkflowPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10,
}

export enum WorkflowCategory {
  INVENTORY_MANAGEMENT = 'inventory_management',
  PURCHASE_ORDER = 'purchase_order',
  SUPPLIER_MANAGEMENT = 'supplier_management',
  ALERT_NOTIFICATION = 'alert_notification',
  REPORTING = 'reporting',
  DATA_SYNC = 'data_sync',
  MAINTENANCE = 'maintenance',
  CUSTOM = 'custom',
}

@Entity('workflows')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'triggerType'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'nextExecutionAt'])
export class Workflow extends AuditableEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: WorkflowCategory, default: WorkflowCategory.CUSTOM })
  category: WorkflowCategory;

  @Column({ type: 'enum', enum: WorkflowStatus, default: WorkflowStatus.DRAFT })
  status: WorkflowStatus;

  @Column({ type: 'enum', enum: WorkflowTriggerType, default: WorkflowTriggerType.MANUAL })
  triggerType: WorkflowTriggerType;

  @Column({ type: 'enum', enum: WorkflowPriority, default: WorkflowPriority.NORMAL })
  priority: WorkflowPriority;

  // Trigger Configuration
  @Column({ type: 'jsonb', nullable: true })
  triggerConfig?: {
    // For scheduled triggers
    cronExpression?: string;
    timezone?: string;
    startDate?: string;
    endDate?: string;
    
    // For event-based triggers
    eventType?: string;
    eventFilters?: Record<string, any>;
    
    // For condition-based triggers
    conditions?: Array<{
      field: string;
      operator: string;
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>;
    
    // For webhook triggers
    webhookUrl?: string;
    webhookSecret?: string;
    webhookHeaders?: Record<string, string>;
    
    // For API triggers
    apiEndpoint?: string;
    apiMethod?: string;
    apiParameters?: Record<string, any>;
    
    // Common trigger settings
    retryOnFailure?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
  };

  // Workflow Configuration
  @Column({ type: 'jsonb', nullable: true })
  workflowConfig?: {
    // Execution settings
    allowConcurrentExecution?: boolean;
    maxConcurrentExecutions?: number;
    executionTimeout?: number;
    
    // Error handling
    onErrorAction?: 'stop' | 'continue' | 'retry' | 'skip';
    maxErrorRetries?: number;
    errorNotification?: boolean;
    
    // Dependencies
    dependsOnWorkflows?: string[];
    blockingWorkflows?: string[];
    
    // Resource constraints
    resourceGroup?: string;
    maxMemoryUsage?: number;
    maxCpuUsage?: number;
    
    // Data settings
    inputSchema?: Record<string, any>;
    outputSchema?: Record<string, any>;
    dataRetention?: {
      retainInputData?: boolean;
      retainOutputData?: boolean;
      retentionDays?: number;
    };
  };

  // Notification Settings
  @Column({ type: 'jsonb', nullable: true })
  notificationConfig?: {
    sendOnStart?: boolean;
    sendOnSuccess?: boolean;
    sendOnFailure?: boolean;
    sendOnTimeout?: boolean;
    
    emailRecipients?: string[];
    slackChannels?: string[];
    webhookUrls?: string[];
    
    customTemplates?: {
      startTemplate?: string;
      successTemplate?: string;
      failureTemplate?: string;
      timeoutTemplate?: string;
    };
  };

  // Workflow Variables and Constants
  @Column({ type: 'jsonb', nullable: true })
  variables?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    value: any;
    description?: string;
    required?: boolean;
    validation?: Record<string, any>;
  }>;

  // Tags and Metadata
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // State Management
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPaused: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  pausedUntil?: Date;

  @Column({ type: 'text', nullable: true })
  pauseReason?: string;

  // Versioning
  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'uuid', nullable: true })
  previousVersionId?: string;

  @Column({ type: 'boolean', default: false })
  isTemplate: boolean;

  @Column({ type: 'uuid', nullable: true })
  templateId?: string;

  // Ownership
  @Column({ type: 'uuid', nullable: true })
  ownerId?: string;

  @Column({ type: 'jsonb', nullable: true })
  permissions?: {
    canEdit?: string[]; // User IDs
    canExecute?: string[]; // User IDs
    canView?: string[]; // User IDs
    isPublic?: boolean;
  };

  // Execution Statistics
  @Column({ type: 'integer', default: 0 })
  totalExecutions: number;

  @Column({ type: 'integer', default: 0 })
  successfulExecutions: number;

  @Column({ type: 'integer', default: 0 })
  failedExecutions: number;

  @Column({ type: 'integer', default: 0 })
  timeoutExecutions: number;

  @Column({ type: 'integer', default: 0 })
  cancelledExecutions: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  averageExecutionTime?: number; // in seconds

  @Column({ type: 'decimal', precision: 5, scale: 3, nullable: true })
  successRate?: number; // percentage

  // Scheduling and Execution
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastExecutionAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  nextExecutionAt?: Date;

  @Column({ type: 'integer', nullable: true })
  lastExecutionDuration?: number; // in milliseconds

  @Column({ type: 'text', nullable: true })
  lastExecutionStatus?: string;

  @Column({ type: 'text', nullable: true })
  lastErrorMessage?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastErrorAt?: Date;

  @Column({ type: 'integer', default: 0 })
  consecutiveFailures: number;

  // Performance Metrics
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalProcessingTime: number; // total seconds spent executing

  @Column({ type: 'integer', default: 0 })
  totalStepsExecuted: number;

  @Column({ type: 'integer', default: 0 })
  totalDataProcessed: number; // number of records/items processed

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimatedCostPerExecution: number; // in IDR

  // Relationships
  @OneToMany(() => WorkflowStep, (step) => step.workflow, { cascade: true })
  steps: WorkflowStep[];

  @OneToMany(() => WorkflowExecution, (execution) => execution.workflow)
  executions: WorkflowExecution[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner?: User;

  @ManyToOne(() => Workflow, { nullable: true })
  @JoinColumn({ name: 'previousVersionId' })
  previousVersion?: Workflow;

  @ManyToOne(() => Workflow, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template?: Workflow;

  // Business Logic Methods
  canExecute(): boolean {
    return this.isActive && 
           !this.isPaused && 
           this.status === WorkflowStatus.ACTIVE &&
           (this.pausedUntil === null || this.pausedUntil < new Date()) &&
           this.consecutiveFailures < 5; // Max 5 consecutive failures
  }

  shouldExecuteNow(): boolean {
    if (!this.canExecute()) return false;
    
    if (this.triggerType === WorkflowTriggerType.MANUAL) return false;
    
    if (this.triggerType === WorkflowTriggerType.SCHEDULED) {
      return this.nextExecutionAt !== null && this.nextExecutionAt <= new Date();
    }
    
    return true;
  }

  recordExecution(success: boolean, duration: number, error?: string): void {
    this.totalExecutions += 1;
    this.lastExecutionAt = new Date();
    this.lastExecutionDuration = duration;
    
    if (success) {
      this.successfulExecutions += 1;
      this.consecutiveFailures = 0;
      this.lastExecutionStatus = 'success';
    } else {
      this.failedExecutions += 1;
      this.consecutiveFailures += 1;
      this.lastExecutionStatus = 'failed';
      this.lastErrorMessage = error;
      this.lastErrorAt = new Date();
    }
    
    // Update success rate
    this.successRate = this.totalExecutions > 0 ? 
      (this.successfulExecutions / this.totalExecutions) : 0;
    
    // Update average execution time
    this.totalProcessingTime += duration / 1000; // convert to seconds
    this.averageExecutionTime = this.totalExecutions > 0 ? 
      this.totalProcessingTime / this.totalExecutions : 0;
  }

  calculateNextExecution(): Date | null {
    if (this.triggerType !== WorkflowTriggerType.SCHEDULED) return null;
    if (!this.triggerConfig?.cronExpression) return null;
    
    // This would use a cron parser library to calculate next execution
    // For now, return a simple calculation
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
  }

  createNewVersion(): Partial<Workflow> {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      triggerType: this.triggerType,
      triggerConfig: this.triggerConfig,
      workflowConfig: this.workflowConfig,
      notificationConfig: this.notificationConfig,
      variables: this.variables,
      tags: this.tags,
      metadata: this.metadata,
      ownerId: this.ownerId,
      permissions: this.permissions,
      version: this.version + 1,
      previousVersionId: this.id,
      status: WorkflowStatus.DRAFT,
      isActive: false,
    };
  }

  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate basic required fields
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Nama workflow tidak boleh kosong');
    }
    
    // Validate trigger configuration
    if (this.triggerType === WorkflowTriggerType.SCHEDULED) {
      if (!this.triggerConfig?.cronExpression) {
        errors.push('Cron expression diperlukan untuk scheduled trigger');
      }
    }
    
    // Validate steps exist
    if (!this.steps || this.steps.length === 0) {
      errors.push('Workflow harus memiliki minimal satu step');
    }
    
    // Validate concurrent execution settings
    if (this.workflowConfig?.allowConcurrentExecution && 
        this.workflowConfig?.maxConcurrentExecutions &&
        this.workflowConfig.maxConcurrentExecutions <= 0) {
      errors.push('Max concurrent executions harus lebih dari 0');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  estimateExecutionCost(): number {
    // Basic cost estimation based on steps and complexity
    const baseStepCost = 100; // IDR per step
    const stepCount = this.steps?.length || 0;
    const complexityMultiplier = this.priority / 5; // Higher priority = higher cost
    
    return baseStepCost * stepCount * complexityMultiplier;
  }

  getExecutionMetrics() {
    return {
      totalExecutions: this.totalExecutions,
      successfulExecutions: this.successfulExecutions,
      failedExecutions: this.failedExecutions,
      timeoutExecutions: this.timeoutExecutions,
      cancelledExecutions: this.cancelledExecutions,
      successRate: this.successRate,
      averageExecutionTime: this.averageExecutionTime,
      totalProcessingTime: this.totalProcessingTime,
      consecutiveFailures: this.consecutiveFailures,
      estimatedCostPerExecution: this.estimatedCostPerExecution,
      lastExecutionAt: this.lastExecutionAt,
      lastExecutionStatus: this.lastExecutionStatus,
      lastErrorMessage: this.lastErrorMessage,
    };
  }
}