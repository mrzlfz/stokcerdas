import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStepExecution } from './workflow-execution.entity';

export enum WorkflowStepType {
  // Core actions
  CONDITION = 'condition',
  LOOP = 'loop',
  DELAY = 'delay',
  PARALLEL = 'parallel',
  
  // Data operations
  DATA_TRANSFORM = 'data_transform',
  DATA_VALIDATION = 'data_validation',
  DATA_FILTER = 'data_filter',
  DATA_AGGREGATION = 'data_aggregation',
  
  // Inventory operations
  UPDATE_INVENTORY = 'update_inventory',
  CREATE_ADJUSTMENT = 'create_adjustment',
  TRANSFER_STOCK = 'transfer_stock',
  CHECK_STOCK_LEVEL = 'check_stock_level',
  
  // Purchase order operations
  CREATE_PURCHASE_ORDER = 'create_purchase_order',
  APPROVE_PURCHASE_ORDER = 'approve_purchase_order',
  SEND_PO_TO_SUPPLIER = 'send_po_to_supplier',
  UPDATE_PO_STATUS = 'update_po_status',
  
  // Supplier operations
  EVALUATE_SUPPLIER = 'evaluate_supplier',
  SELECT_SUPPLIER = 'select_supplier',
  UPDATE_SUPPLIER_INFO = 'update_supplier_info',
  REQUEST_QUOTE = 'request_quote',
  
  // Notification operations
  SEND_EMAIL = 'send_email',
  SEND_SMS = 'send_sms',
  SEND_ALERT = 'send_alert',
  SEND_WEBHOOK = 'send_webhook',
  
  // Reporting operations
  GENERATE_REPORT = 'generate_report',
  EXPORT_DATA = 'export_data',
  SCHEDULE_REPORT = 'schedule_report',
  
  // Integration operations
  API_CALL = 'api_call',
  DATABASE_QUERY = 'database_query',
  FILE_OPERATION = 'file_operation',
  
  // Custom operations
  CUSTOM_SCRIPT = 'custom_script',
  CUSTOM_FUNCTION = 'custom_function',
}

export enum WorkflowStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_EQUAL = 'greater_equal',
  LESS_EQUAL = 'less_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  REGEX_MATCH = 'regex_match',
}

export enum DataTransformOperation {
  MAP = 'map',
  FILTER = 'filter',
  REDUCE = 'reduce',
  SORT = 'sort',
  GROUP_BY = 'group_by',
  JOIN = 'join',
  MERGE = 'merge',
  SPLIT = 'split',
  FORMAT = 'format',
  CALCULATE = 'calculate',
}

@Entity('workflow_steps')
@Index(['tenantId', 'workflowId'])
@Index(['tenantId', 'stepType'])
@Index(['tenantId', 'executionOrder'])
@Index(['tenantId', 'isActive'])
export class WorkflowStep extends AuditableEntity {
  @Column({ type: 'uuid' })
  workflowId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: WorkflowStepType })
  stepType: WorkflowStepType;

  @Column({ type: 'integer' })
  executionOrder: number;

  // Step Configuration
  @Column({ type: 'jsonb', nullable: true })
  stepConfig?: {
    // Condition step configuration
    condition?: {
      field: string;
      operator: ConditionOperator;
      value: any;
      logicalOperator?: 'AND' | 'OR';
      conditions?: Array<{
        field: string;
        operator: ConditionOperator;
        value: any;
        logicalOperator?: 'AND' | 'OR';
      }>;
      trueStepId?: string;
      falseStepId?: string;
    };
    
    // Loop step configuration
    loop?: {
      type: 'for' | 'while' | 'foreach';
      condition?: string;
      iterationVariable?: string;
      maxIterations?: number;
      breakCondition?: string;
      dataSource?: string;
    };
    
    // Delay step configuration
    delay?: {
      duration: number; // in milliseconds
      unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
      dynamic?: boolean;
      delayExpression?: string;
    };
    
    // Parallel step configuration
    parallel?: {
      steps: string[]; // Step IDs to execute in parallel
      waitForAll?: boolean;
      continueOnFirstCompletion?: boolean;
      continueOnFirstFailure?: boolean;
    };
    
    // Data transformation configuration
    dataTransform?: {
      operation: DataTransformOperation;
      sourceField?: string;
      targetField?: string;
      transformFunction?: string;
      parameters?: Record<string, any>;
    };
    
    // Inventory operation configuration
    inventoryOperation?: {
      productId?: string;
      locationId?: string;
      quantity?: number;
      adjustmentType?: string;
      reason?: string;
      transferToLocationId?: string;
    };
    
    // Purchase order configuration
    purchaseOrderOperation?: {
      supplierId?: string;
      productId?: string;
      quantity?: number;
      unitPrice?: number;
      approverUserId?: string;
      autoApprove?: boolean;
      deliveryDate?: string;
    };
    
    // Notification configuration
    notification?: {
      recipients: string[];
      subject?: string;
      message: string;
      template?: string;
      attachments?: string[];
      priority?: 'low' | 'normal' | 'high' | 'critical';
    };
    
    // API call configuration
    apiCall?: {
      url: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      headers?: Record<string, string>;
      body?: any;
      authentication?: {
        type: 'bearer' | 'basic' | 'api_key';
        credentials: Record<string, string>;
      };
      timeout?: number;
      retries?: number;
    };
    
    // Database operation configuration
    databaseOperation?: {
      query: string;
      parameters?: Record<string, any>;
      operation: 'select' | 'insert' | 'update' | 'delete';
      targetTable?: string;
    };
    
    // File operation configuration
    fileOperation?: {
      operation: 'read' | 'write' | 'delete' | 'move' | 'copy';
      sourcePath?: string;
      targetPath?: string;
      content?: string;
      encoding?: string;
    };
    
    // Custom script configuration
    customScript?: {
      language: 'javascript' | 'python' | 'sql';
      script: string;
      parameters?: Record<string, any>;
      timeout?: number;
      environment?: Record<string, string>;
    };
    
    // Report generation configuration
    reportGeneration?: {
      reportType: string;
      template?: string;
      filters?: Record<string, any>;
      format: 'pdf' | 'excel' | 'csv' | 'json';
      outputPath?: string;
    };
  };

  // Input/Output Mapping
  @Column({ type: 'jsonb', nullable: true })
  inputMapping?: Record<string, {
    source: 'workflow_variable' | 'previous_step' | 'static_value' | 'user_input';
    path?: string;
    defaultValue?: any;
    required?: boolean;
    validation?: Record<string, any>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  outputMapping?: Record<string, {
    target: 'workflow_variable' | 'next_step' | 'workflow_output';
    path?: string;
    transform?: string;
  }>;

  // Error Handling
  @Column({ type: 'jsonb', nullable: true })
  errorHandling?: {
    onError: 'stop' | 'continue' | 'retry' | 'skip' | 'goto_step';
    maxRetries?: number;
    retryDelay?: number;
    fallbackStepId?: string;
    continueStepId?: string;
    errorNotification?: boolean;
    customErrorHandler?: string;
  };

  // Conditional Execution
  @Column({ type: 'jsonb', nullable: true })
  executionConditions?: Array<{
    field: string;
    operator: ConditionOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;

  // Dependencies
  @Column({ type: 'jsonb', nullable: true })
  dependencies?: {
    requiredSteps?: string[]; // Step IDs that must complete before this step
    blockedBySteps?: string[]; // Step IDs that block this step
    dependsOnVariables?: string[]; // Variable names that must exist
    requiredPermissions?: string[]; // Permissions required to execute
  };

  // Performance and Resource Management
  @Column({ type: 'integer', nullable: true })
  timeoutSeconds?: number;

  @Column({ type: 'integer', nullable: true })
  maxMemoryMB?: number;

  @Column({ type: 'integer', nullable: true })
  maxCpuPercent?: number;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ type: 'integer', nullable: true })
  retryDelayMs?: number;

  // State Management
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isOptional: boolean;

  @Column({ type: 'boolean', default: false })
  canSkip: boolean;

  @Column({ type: 'boolean', default: false })
  isCritical: boolean; // If true, failure stops entire workflow

  // Execution Statistics
  @Column({ type: 'integer', default: 0 })
  totalExecutions: number;

  @Column({ type: 'integer', default: 0 })
  successfulExecutions: number;

  @Column({ type: 'integer', default: 0 })
  failedExecutions: number;

  @Column({ type: 'integer', default: 0 })
  skippedExecutions: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  averageExecutionTime?: number; // in seconds

  @Column({ type: 'decimal', precision: 5, scale: 3, nullable: true })
  successRate?: number;

  // Last Execution Info
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastExecutionAt?: Date;

  @Column({ type: 'integer', nullable: true })
  lastExecutionDuration?: number; // in milliseconds

  @Column({ type: 'enum', enum: WorkflowStepStatus, nullable: true })
  lastExecutionStatus?: WorkflowStepStatus;

  @Column({ type: 'text', nullable: true })
  lastErrorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  lastExecutionResult?: any;

  // UI and Visual Configuration
  @Column({ type: 'jsonb', nullable: true })
  uiConfig?: {
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    color?: string;
    icon?: string;
    isCollapsed?: boolean;
    notes?: string;
  };

  // Relationships
  @ManyToOne(() => Workflow, (workflow) => workflow.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;

  @OneToMany(() => WorkflowStepExecution, (execution) => execution.step)
  executions: WorkflowStepExecution[];

  // Business Logic Methods
  canExecute(workflowVariables?: Record<string, any>): boolean {
    if (!this.isActive) return false;
    
    // Check execution conditions
    if (this.executionConditions && this.executionConditions.length > 0) {
      return this.evaluateConditions(this.executionConditions, workflowVariables);
    }
    
    return true;
  }

  private evaluateConditions(
    conditions: Array<{
      field: string;
      operator: ConditionOperator;
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>,
    variables?: Record<string, any>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;
    
    let result = true;
    let operator: 'AND' | 'OR' = 'AND';
    
    for (const condition of conditions) {
      const fieldValue = this.getVariableValue(condition.field, variables);
      const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);
      
      if (operator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }
      
      operator = condition.logicalOperator || 'AND';
    }
    
    return result;
  }

  private evaluateCondition(fieldValue: any, operator: ConditionOperator, expectedValue: any): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return fieldValue === expectedValue;
      case ConditionOperator.NOT_EQUALS:
        return fieldValue !== expectedValue;
      case ConditionOperator.GREATER_THAN:
        return Number(fieldValue) > Number(expectedValue);
      case ConditionOperator.LESS_THAN:
        return Number(fieldValue) < Number(expectedValue);
      case ConditionOperator.GREATER_EQUAL:
        return Number(fieldValue) >= Number(expectedValue);
      case ConditionOperator.LESS_EQUAL:
        return Number(fieldValue) <= Number(expectedValue);
      case ConditionOperator.CONTAINS:
        return String(fieldValue).includes(String(expectedValue));
      case ConditionOperator.NOT_CONTAINS:
        return !String(fieldValue).includes(String(expectedValue));
      case ConditionOperator.IN:
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case ConditionOperator.NOT_IN:
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case ConditionOperator.IS_NULL:
        return fieldValue === null || fieldValue === undefined;
      case ConditionOperator.IS_NOT_NULL:
        return fieldValue !== null && fieldValue !== undefined;
      case ConditionOperator.REGEX_MATCH:
        return new RegExp(String(expectedValue)).test(String(fieldValue));
      default:
        return false;
    }
  }

  private getVariableValue(fieldPath: string, variables?: Record<string, any>): any {
    if (!variables) return undefined;
    
    // Support nested field access with dot notation
    const keys = fieldPath.split('.');
    let value = variables;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  recordExecution(success: boolean, duration: number, result?: any, error?: string): void {
    this.totalExecutions += 1;
    this.lastExecutionAt = new Date();
    this.lastExecutionDuration = duration;
    this.lastExecutionResult = result;
    
    if (success) {
      this.successfulExecutions += 1;
      this.lastExecutionStatus = WorkflowStepStatus.COMPLETED;
    } else {
      this.failedExecutions += 1;
      this.lastExecutionStatus = WorkflowStepStatus.FAILED;
      this.lastErrorMessage = error;
    }
    
    // Update success rate
    this.successRate = this.totalExecutions > 0 ? 
      (this.successfulExecutions / this.totalExecutions) : 0;
    
    // Update average execution time
    const totalTime = ((this.averageExecutionTime || 0) * (this.totalExecutions - 1)) + (duration / 1000);
    this.averageExecutionTime = totalTime / this.totalExecutions;
  }

  getNextStepId(result?: any): string | null {
    // For condition steps, determine next step based on result
    if (this.stepType === WorkflowStepType.CONDITION && this.stepConfig?.condition) {
      const conditionResult = result?.conditionResult || false;
      return conditionResult ? 
        this.stepConfig.condition.trueStepId || null :
        this.stepConfig.condition.falseStepId || null;
    }
    
    // For other steps, execution continues to next step in order
    return null;
  }

  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate basic required fields
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Nama step tidak boleh kosong');
    }
    
    if (this.executionOrder < 0) {
      errors.push('Execution order harus >= 0');
    }
    
    // Validate step-specific configuration
    switch (this.stepType) {
      case WorkflowStepType.CONDITION:
        if (!this.stepConfig?.condition?.field) {
          errors.push('Condition field diperlukan untuk condition step');
        }
        break;
        
      case WorkflowStepType.API_CALL:
        if (!this.stepConfig?.apiCall?.url) {
          errors.push('URL diperlukan untuk API call step');
        }
        break;
        
      case WorkflowStepType.SEND_EMAIL:
        if (!this.stepConfig?.notification?.recipients?.length) {
          errors.push('Recipients diperlukan untuk email step');
        }
        break;
        
      case WorkflowStepType.DELAY:
        if (!this.stepConfig?.delay?.duration || this.stepConfig.delay.duration <= 0) {
          errors.push('Duration harus > 0 untuk delay step');
        }
        break;
    }
    
    // Validate timeout settings
    if (this.timeoutSeconds && this.timeoutSeconds <= 0) {
      errors.push('Timeout harus > 0 jika diset');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  clone(): Partial<WorkflowStep> {
    return {
      name: `${this.name} (Copy)`,
      description: this.description,
      stepType: this.stepType,
      stepConfig: JSON.parse(JSON.stringify(this.stepConfig)),
      inputMapping: JSON.parse(JSON.stringify(this.inputMapping)),
      outputMapping: JSON.parse(JSON.stringify(this.outputMapping)),
      errorHandling: JSON.parse(JSON.stringify(this.errorHandling)),
      executionConditions: JSON.parse(JSON.stringify(this.executionConditions)),
      dependencies: JSON.parse(JSON.stringify(this.dependencies)),
      timeoutSeconds: this.timeoutSeconds,
      maxMemoryMB: this.maxMemoryMB,
      maxCpuPercent: this.maxCpuPercent,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      isOptional: this.isOptional,
      canSkip: this.canSkip,
      isCritical: this.isCritical,
      uiConfig: JSON.parse(JSON.stringify(this.uiConfig)),
    };
  }
}