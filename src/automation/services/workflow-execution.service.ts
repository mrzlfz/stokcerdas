import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as moment from 'moment-timezone';

import { 
  Workflow, 
  WorkflowStatus 
} from '../entities/workflow.entity';
import { 
  WorkflowStep, 
  WorkflowStepType, 
  WorkflowStepStatus,
  ConditionOperator 
} from '../entities/workflow-step.entity';
import { 
  WorkflowExecution, 
  WorkflowExecutionStatus,
  WorkflowStepExecution,
  WorkflowStepExecutionStatus,
  ExecutionTrigger 
} from '../entities/workflow-execution.entity';

// External Services
import { InventoryService } from '../../inventory/services/inventory.service';
import { ProductsService } from '../../products/services/products.service';
import { PurchaseOrderService } from '../../purchase-orders/services/purchase-order.service';
import { SuppliersService } from '../../suppliers/services/suppliers.service';
import { AlertManagementService } from '../../alerts/services/alert-management.service';
import { EmailService } from '../../notifications/services/email.service';

export interface WorkflowExecutionContext {
  tenantId: string;
  workflowId: string;
  executionId: string;
  variables: Record<string, any>;
  currentStep?: WorkflowStep;
  executionData: Record<string, any>;
  userContext?: {
    userId?: string;
    roles?: string[];
    permissions?: string[];
  };
  systemContext: {
    startTime: Date;
    timeout?: number;
    dryRun?: boolean;
    debug?: boolean;
  };
}

export interface StepExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  nextStepId?: string;
  skipRemainingSteps?: boolean;
  retryAfter?: number; // milliseconds
  resourceUsage?: {
    memoryMB?: number;
    cpuPercent?: number;
    executionTime?: number;
  };
}

export interface WorkflowExecutionResult {
  success: boolean;
  executionId: string;
  status: WorkflowExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  outputData?: Record<string, any>;
  error?: string;
  metrics: {
    totalExecutionTime: number;
    averageStepTime: number;
    peakMemoryUsage: number;
    totalApiCalls: number;
    totalDbQueries: number;
  };
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);
  private readonly cachePrefix = 'workflow_execution';
  private readonly activeExecutions = new Map<string, WorkflowExecutionContext>();

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep)
    private readonly workflowStepRepository: Repository<WorkflowStep>,
    @InjectRepository(WorkflowExecution)
    private readonly workflowExecutionRepository: Repository<WorkflowExecution>,
    @InjectRepository(WorkflowStepExecution)
    private readonly workflowStepExecutionRepository: Repository<WorkflowStepExecution>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    // External services for step execution
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly suppliersService: SuppliersService,
    private readonly alertManagementService: AlertManagementService,
    private readonly emailService: EmailService,
  ) {}

  // =============================================
  // MAIN WORKFLOW EXECUTION
  // =============================================

  async executeWorkflow(
    tenantId: string,
    workflowId: string,
    executionId: string,
    inputData?: Record<string, any>,
    options?: {
      dryRun?: boolean;
      debug?: boolean;
      timeout?: number;
      userId?: string;
    },
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting workflow execution ${executionId} for workflow ${workflowId}`);

      // Get workflow with steps
      const workflow = await this.getWorkflowWithSteps(tenantId, workflowId);
      
      // Validate workflow can be executed
      this.validateWorkflowExecution(workflow);

      // Get or create execution record
      let execution = await this.getWorkflowExecution(tenantId, executionId);
      if (!execution) {
        execution = await this.createWorkflowExecution(tenantId, workflowId, executionId, inputData, options);
      }

      // Setup execution context
      const context = await this.setupExecutionContext(
        workflow, 
        execution, 
        inputData, 
        options
      );

      // Register active execution
      this.activeExecutions.set(executionId, context);

      try {
        // Mark execution as running
        await this.updateExecutionStatus(execution, WorkflowExecutionStatus.RUNNING);

        // Execute workflow steps
        const result = await this.executeWorkflowSteps(context, workflow.steps);

        // Mark execution as completed or failed
        const finalStatus = result.success ? 
          WorkflowExecutionStatus.COMPLETED : 
          WorkflowExecutionStatus.FAILED;
        
        await this.updateExecutionStatus(execution, finalStatus, result.error);

        // Update workflow statistics
        await this.updateWorkflowStatistics(workflow, result.success, Date.now() - startTime);

        // Generate final result
        const executionResult = await this.generateExecutionResult(
          execution, 
          context, 
          result, 
          startTime
        );

        // Emit completion event
        this.eventEmitter.emit('workflow.execution.completed', {
          tenantId,
          workflowId,
          executionId,
          success: result.success,
          duration: executionResult.duration,
          metrics: executionResult.metrics,
        });

        this.logger.log(
          `Workflow execution ${executionId} ${result.success ? 'completed' : 'failed'} ` +
          `in ${executionResult.duration}ms`
        );

        return executionResult;

      } finally {
        // Cleanup active execution
        this.activeExecutions.delete(executionId);
      }

    } catch (error) {
      this.logger.error(`Workflow execution ${executionId} failed: ${error.message}`, error.stack);
      
      // Update execution with error
      try {
        const execution = await this.getWorkflowExecution(tenantId, executionId);
        if (execution) {
          await this.updateExecutionStatus(execution, WorkflowExecutionStatus.FAILED, error.message);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update execution status: ${updateError.message}`);
      }

      // Emit error event
      this.eventEmitter.emit('workflow.execution.failed', {
        tenantId,
        workflowId,
        executionId,
        error: error.message,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  async pauseWorkflowExecution(
    tenantId: string,
    executionId: string,
    reason?: string,
  ): Promise<void> {
    try {
      const execution = await this.getWorkflowExecution(tenantId, executionId);
      if (!execution || !execution.canResume()) {
        throw new BadRequestException('Execution tidak dapat di-pause');
      }

      execution.pause(reason);
      await this.workflowExecutionRepository.save(execution);

      // Update active execution context
      const context = this.activeExecutions.get(executionId);
      if (context) {
        context.systemContext.debug = true; // Enable debug mode when paused
      }

      this.eventEmitter.emit('workflow.execution.paused', {
        tenantId,
        executionId,
        reason,
      });

      this.logger.log(`Workflow execution ${executionId} paused: ${reason}`);

    } catch (error) {
      this.logger.error(`Failed to pause execution ${executionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async resumeWorkflowExecution(
    tenantId: string,
    executionId: string,
  ): Promise<void> {
    try {
      const execution = await this.getWorkflowExecution(tenantId, executionId);
      if (!execution || !execution.canResume()) {
        throw new BadRequestException('Execution tidak dapat di-resume');
      }

      execution.resume();
      await this.workflowExecutionRepository.save(execution);

      this.eventEmitter.emit('workflow.execution.resumed', {
        tenantId,
        executionId,
      });

      this.logger.log(`Workflow execution ${executionId} resumed`);

    } catch (error) {
      this.logger.error(`Failed to resume execution ${executionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cancelWorkflowExecution(
    tenantId: string,
    executionId: string,
    reason?: string,
  ): Promise<void> {
    try {
      const execution = await this.getWorkflowExecution(tenantId, executionId);
      if (!execution || !execution.canCancel()) {
        throw new BadRequestException('Execution tidak dapat dibatalkan');
      }

      execution.markCancelled(reason);
      await this.workflowExecutionRepository.save(execution);

      // Remove from active executions
      this.activeExecutions.delete(executionId);

      this.eventEmitter.emit('workflow.execution.cancelled', {
        tenantId,
        executionId,
        reason,
      });

      this.logger.log(`Workflow execution ${executionId} cancelled: ${reason}`);

    } catch (error) {
      this.logger.error(`Failed to cancel execution ${executionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============================================
  // STEP EXECUTION ENGINE
  // =============================================

  private async executeWorkflowSteps(
    context: WorkflowExecutionContext,
    steps: WorkflowStep[],
  ): Promise<StepExecutionResult> {
    const sortedSteps = steps.sort((a, b) => a.executionOrder - b.executionOrder);
    let currentStepIndex = 0;
    let totalExecutionTime = 0;
    let peakMemoryUsage = 0;
    let totalApiCalls = 0;
    let totalDbQueries = 0;

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      context.currentStep = step;
      currentStepIndex = i;

      try {
        // Check if step should be executed
        if (!this.shouldExecuteStep(step, context)) {
          this.logger.log(`Skipping step ${step.name} - conditions not met`);
          continue;
        }

        // Check execution timeout
        if (this.isExecutionTimedOut(context)) {
          throw new Error('Workflow execution timeout');
        }

        // Execute step
        this.logger.log(`Executing step ${step.name} (${step.stepType})`);
        const stepStartTime = Date.now();
        
        const stepResult = await this.executeStep(step, context);
        
        const stepExecutionTime = Date.now() - stepStartTime;
        totalExecutionTime += stepExecutionTime;

        // Update resource usage metrics
        if (stepResult.resourceUsage) {
          peakMemoryUsage = Math.max(peakMemoryUsage, stepResult.resourceUsage.memoryMB || 0);
          totalApiCalls += stepResult.resourceUsage.executionTime ? 1 : 0; // Simple heuristic
        }

        // Record step execution
        await this.recordStepExecution(context, step, stepResult, stepExecutionTime);

        // Handle step result
        if (!stepResult.success) {
          const errorAction = step.errorHandling?.onError || 'stop';
          
          switch (errorAction) {
            case 'stop':
              return {
                success: false,
                error: stepResult.error,
                data: context.executionData,
              };
            
            case 'continue':
              this.logger.warn(`Step ${step.name} failed but continuing: ${stepResult.error}`);
              continue;
            
            case 'retry':
              const retryResult = await this.retryStep(step, context, stepResult);
              if (!retryResult.success) {
                return {
                  success: false,
                  error: retryResult.error,
                  data: context.executionData,
                };
              }
              break;
            
            case 'skip':
              this.logger.warn(`Skipping failed step ${step.name}: ${stepResult.error}`);
              continue;
            
            case 'goto_step':
              const gotoStepId = step.errorHandling?.fallbackStepId;
              if (gotoStepId) {
                const gotoStep = steps.find(s => s.id === gotoStepId);
                if (gotoStep) {
                  i = steps.indexOf(gotoStep) - 1; // -1 because loop will increment
                  continue;
                }
              }
              break;
          }
        }

        // Handle conditional next step
        if (stepResult.nextStepId) {
          const nextStep = steps.find(s => s.id === stepResult.nextStepId);
          if (nextStep) {
            i = steps.indexOf(nextStep) - 1; // -1 because loop will increment
            continue;
          }
        }

        // Check if we should skip remaining steps
        if (stepResult.skipRemainingSteps) {
          break;
        }

        // Update execution progress
        await this.updateExecutionProgress(context, i + 1, steps.length);

      } catch (error) {
        this.logger.error(`Step ${step.name} execution failed: ${error.message}`, error.stack);
        
        // Record failed step execution
        await this.recordStepExecution(context, step, {
          success: false,
          error: error.message,
        }, 0);

        // Handle step error based on configuration
        if (step.isCritical) {
          return {
            success: false,
            error: `Critical step ${step.name} failed: ${error.message}`,
            data: context.executionData,
          };
        }

        // Continue with next step if not critical
        continue;
      }
    }

    return {
      success: true,
      data: context.executionData,
    };
  }

  private async executeStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    try {
      // Prepare step input data
      const inputData = await this.prepareStepInputData(step, context);
      
      // Execute based on step type
      let result: StepExecutionResult;
      
      switch (step.stepType) {
        case WorkflowStepType.CONDITION:
          result = await this.executeConditionStep(step, inputData, context);
          break;
        
        case WorkflowStepType.DELAY:
          result = await this.executeDelayStep(step, inputData, context);
          break;
        
        case WorkflowStepType.CHECK_STOCK_LEVEL:
          result = await this.executeCheckStockStep(step, inputData, context);
          break;
        
        case WorkflowStepType.CREATE_ADJUSTMENT:
          result = await this.executeCreateAdjustmentStep(step, inputData, context);
          break;
        
        case WorkflowStepType.CREATE_PURCHASE_ORDER:
          result = await this.executeCreatePurchaseOrderStep(step, inputData, context);
          break;
        
        case WorkflowStepType.SEND_EMAIL:
          result = await this.executeSendEmailStep(step, inputData, context);
          break;
        
        case WorkflowStepType.SEND_ALERT:
          result = await this.executeSendAlertStep(step, inputData, context);
          break;
        
        case WorkflowStepType.API_CALL:
          result = await this.executeApiCallStep(step, inputData, context);
          break;
        
        case WorkflowStepType.DATA_TRANSFORM:
          result = await this.executeDataTransformStep(step, inputData, context);
          break;
        
        case WorkflowStepType.DATA_VALIDATION:
          result = await this.executeDataValidationStep(step, inputData, context);
          break;
        
        default:
          throw new Error(`Unsupported step type: ${step.stepType}`);
      }

      // Process step output data
      await this.processStepOutputData(step, result, context);

      return result;

    } catch (error) {
      this.logger.error(`Step execution failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // =============================================
  // STEP TYPE IMPLEMENTATIONS
  // =============================================

  private async executeConditionStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const conditionConfig = step.stepConfig?.condition;
    if (!conditionConfig) {
      throw new Error('Condition configuration tidak ditemukan');
    }

    try {
      const conditionResult = this.evaluateCondition(
        conditionConfig.field,
        conditionConfig.operator,
        conditionConfig.value,
        inputData,
        context
      );

      const nextStepId = conditionResult ? 
        conditionConfig.trueStepId : 
        conditionConfig.falseStepId;

      return {
        success: true,
        data: { conditionResult },
        nextStepId,
      };

    } catch (error) {
      return {
        success: false,
        error: `Condition evaluation failed: ${error.message}`,
      };
    }
  }

  private async executeDelayStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const delayConfig = step.stepConfig?.delay;
    if (!delayConfig) {
      throw new Error('Delay configuration tidak ditemukan');
    }

    try {
      let delayMs = delayConfig.duration;
      
      // Convert to milliseconds based on unit
      switch (delayConfig.unit) {
        case 'seconds':
          delayMs *= 1000;
          break;
        case 'minutes':
          delayMs *= 60 * 1000;
          break;
        case 'hours':
          delayMs *= 60 * 60 * 1000;
          break;
        case 'days':
          delayMs *= 24 * 60 * 60 * 1000;
          break;
      }

      // Skip delay in dry run mode
      if (context.systemContext.dryRun) {
        this.logger.log(`Skipping delay (dry run): ${delayMs}ms`);
        return {
          success: true,
          data: { delayMs, skipped: true },
        };
      }

      this.logger.log(`Delaying execution for ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      return {
        success: true,
        data: { delayMs },
      };

    } catch (error) {
      return {
        success: false,
        error: `Delay execution failed: ${error.message}`,
      };
    }
  }

  private async executeCheckStockStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const inventoryConfig = step.stepConfig?.inventoryOperation;
    if (!inventoryConfig?.productId) {
      throw new Error('Product ID diperlukan untuk check stock step');
    }

    try {
      // Get current stock level
      const inventory = await this.inventoryService.getInventoryByProduct(
        context.tenantId,
        inventoryConfig.productId,
        inventoryConfig.locationId
      );

      const currentStock = inventory?.quantity || 0;
      const isLowStock = currentStock < (inventory?.reorderPoint || 0);

      return {
        success: true,
        data: {
          currentStock,
          reorderPoint: inventory?.reorderPoint,
          isLowStock,
          productId: inventoryConfig.productId,
          locationId: inventoryConfig.locationId,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Stock check failed: ${error.message}`,
      };
    }
  }

  private async executeCreateAdjustmentStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const inventoryConfig = step.stepConfig?.inventoryOperation;
    if (!inventoryConfig?.productId || !inventoryConfig?.quantity) {
      throw new Error('Product ID dan quantity diperlukan untuk create adjustment step');
    }

    try {
      if (context.systemContext.dryRun) {
        this.logger.log(`Dry run: Would create adjustment for ${inventoryConfig.productId}`);
        return {
          success: true,
          data: { dryRun: true, adjustment: inventoryConfig },
        };
      }

      // Create inventory adjustment
      const adjustment = await this.inventoryService.createInventoryAdjustment(
        context.tenantId,
        {
          productId: inventoryConfig.productId,
          locationId: inventoryConfig.locationId,
          quantity: inventoryConfig.quantity,
          adjustmentType: inventoryConfig.adjustmentType || 'manual',
          reason: inventoryConfig.reason || 'Workflow adjustment',
        }
      );

      return {
        success: true,
        data: { adjustmentId: adjustment.id, adjustment },
      };

    } catch (error) {
      return {
        success: false,
        error: `Create adjustment failed: ${error.message}`,
      };
    }
  }

  private async executeCreatePurchaseOrderStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const poConfig = step.stepConfig?.purchaseOrderOperation;
    if (!poConfig?.supplierId || !poConfig?.productId || !poConfig?.quantity) {
      throw new Error('Supplier ID, Product ID, dan quantity diperlukan untuk create PO step');
    }

    try {
      if (context.systemContext.dryRun) {
        this.logger.log(`Dry run: Would create PO for ${poConfig.productId}`);
        return {
          success: true,
          data: { dryRun: true, purchaseOrder: poConfig },
        };
      }

      // Create purchase order
      const purchaseOrder = await this.purchaseOrderService.createPurchaseOrder(
        context.tenantId,
        {
          supplierId: poConfig.supplierId,
          items: [{
            productId: poConfig.productId,
            quantity: poConfig.quantity,
            unitPrice: poConfig.unitPrice,
          }],
          deliveryDate: poConfig.deliveryDate ? new Date(poConfig.deliveryDate) : undefined,
          autoApprove: poConfig.autoApprove || false,
        }
      );

      return {
        success: true,
        data: { 
          purchaseOrderId: purchaseOrder.id, 
          purchaseOrder,
          totalAmount: purchaseOrder.totalAmount,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Create purchase order failed: ${error.message}`,
      };
    }
  }

  private async executeSendEmailStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const notificationConfig = step.stepConfig?.notification;
    if (!notificationConfig?.recipients?.length || !notificationConfig?.message) {
      throw new Error('Recipients dan message diperlukan untuk send email step');
    }

    try {
      if (context.systemContext.dryRun) {
        this.logger.log(`Dry run: Would send email to ${notificationConfig.recipients.length} recipients`);
        return {
          success: true,
          data: { dryRun: true, notification: notificationConfig },
        };
      }

      // Send email notification
      await this.emailService.sendEmail({
        to: notificationConfig.recipients,
        subject: notificationConfig.subject || 'Workflow Notification',
        text: this.interpolateTemplate(notificationConfig.message, context),
        tenantId: context.tenantId,
        priority: notificationConfig.priority === 'critical' ? 'high' : 'normal',
      });

      return {
        success: true,
        data: { 
          emailSent: true,
          recipients: notificationConfig.recipients.length,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Send email failed: ${error.message}`,
      };
    }
  }

  private async executeSendAlertStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const notificationConfig = step.stepConfig?.notification;
    if (!notificationConfig?.message) {
      throw new Error('Message diperlukan untuk send alert step');
    }

    try {
      if (context.systemContext.dryRun) {
        this.logger.log(`Dry run: Would send alert`);
        return {
          success: true,
          data: { dryRun: true, alert: notificationConfig },
        };
      }

      // Create alert
      const alert = await this.alertManagementService.createAlert(
        context.tenantId,
        'WORKFLOW_NOTIFICATION',
        notificationConfig.priority === 'critical' ? 'HIGH' : 'MEDIUM',
        notificationConfig.subject || 'Workflow Alert',
        this.interpolateTemplate(notificationConfig.message, context),
        {
          workflowId: context.workflowId,
          executionId: context.executionId,
          stepName: step.name,
        }
      );

      return {
        success: true,
        data: { alertId: alert.id, alert },
      };

    } catch (error) {
      return {
        success: false,
        error: `Send alert failed: ${error.message}`,
      };
    }
  }

  private async executeApiCallStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const apiConfig = step.stepConfig?.apiCall;
    if (!apiConfig?.url || !apiConfig?.method) {
      throw new Error('URL dan method diperlukan untuk API call step');
    }

    try {
      if (context.systemContext.dryRun) {
        this.logger.log(`Dry run: Would make ${apiConfig.method} request to ${apiConfig.url}`);
        return {
          success: true,
          data: { dryRun: true, apiCall: apiConfig },
        };
      }

      // Make API call (simplified implementation)
      const startTime = Date.now();
      
      // This would be a proper HTTP client implementation
      const response = await this.makeHttpRequest(apiConfig);
      
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          statusCode: response.status,
          responseData: response.data,
          responseTime,
        },
        resourceUsage: {
          executionTime: responseTime,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `API call failed: ${error.message}`,
      };
    }
  }

  private async executeDataTransformStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    const transformConfig = step.stepConfig?.dataTransform;
    if (!transformConfig?.operation) {
      throw new Error('Operation diperlukan untuk data transform step');
    }

    try {
      let transformedData: any;
      const sourceData = transformConfig.sourceField ? 
        this.getNestedValue(inputData, transformConfig.sourceField) : 
        inputData;

      switch (transformConfig.operation) {
        case 'map':
          transformedData = this.transformDataMap(sourceData, transformConfig);
          break;
        case 'filter':
          transformedData = this.transformDataFilter(sourceData, transformConfig);
          break;
        case 'sort':
          transformedData = this.transformDataSort(sourceData, transformConfig);
          break;
        default:
          throw new Error(`Unsupported transform operation: ${transformConfig.operation}`);
      }

      return {
        success: true,
        data: { transformedData },
      };

    } catch (error) {
      return {
        success: false,
        error: `Data transform failed: ${error.message}`,
      };
    }
  }

  private async executeDataValidationStep(
    step: WorkflowStep,
    inputData: any,
    context: WorkflowExecutionContext,
  ): Promise<StepExecutionResult> {
    try {
      const validationRules = step.stepConfig?.validation || {};
      const errors: string[] = [];

      // Simple validation implementation
      for (const [field, rules] of Object.entries(validationRules)) {
        const value = this.getNestedValue(inputData, field);
        
        if (rules.required && (value === undefined || value === null)) {
          errors.push(`Field ${field} is required`);
        }
        
        if (rules.type && typeof value !== rules.type) {
          errors.push(`Field ${field} must be of type ${rules.type}`);
        }
        
        if (rules.min && typeof value === 'number' && value < rules.min) {
          errors.push(`Field ${field} must be at least ${rules.min}`);
        }
        
        if (rules.max && typeof value === 'number' && value > rules.max) {
          errors.push(`Field ${field} must be at most ${rules.max}`);
        }
      }

      return {
        success: errors.length === 0,
        data: { 
          isValid: errors.length === 0,
          errors,
          validatedData: inputData,
        },
        error: errors.length > 0 ? `Validation failed: ${errors.join(', ')}` : undefined,
      };

    } catch (error) {
      return {
        success: false,
        error: `Data validation failed: ${error.message}`,
      };
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private async getWorkflowWithSteps(tenantId: string, workflowId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, tenantId, deletedAt: null },
      relations: ['steps'],
      order: { steps: { executionOrder: 'ASC' } },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} tidak ditemukan`);
    }

    return workflow;
  }

  private async getWorkflowExecution(tenantId: string, executionId: string): Promise<WorkflowExecution | null> {
    return await this.workflowExecutionRepository.findOne({
      where: { executionId, tenantId },
    });
  }

  private async createWorkflowExecution(
    tenantId: string,
    workflowId: string,
    executionId: string,
    inputData?: Record<string, any>,
    options?: any,
  ): Promise<WorkflowExecution> {
    const execution = this.workflowExecutionRepository.create({
      tenantId,
      workflowId,
      executionId,
      status: WorkflowExecutionStatus.PENDING,
      trigger: ExecutionTrigger.MANUAL,
      inputData,
      triggeredByUserId: options?.userId,
      startedAt: new Date(),
    });

    return await this.workflowExecutionRepository.save(execution);
  }

  private validateWorkflowExecution(workflow: Workflow): void {
    if (!workflow.isActive) {
      throw new BadRequestException('Workflow tidak aktif');
    }

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Workflow status bukan ACTIVE');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new BadRequestException('Workflow tidak memiliki steps');
    }
  }

  private async setupExecutionContext(
    workflow: Workflow,
    execution: WorkflowExecution,
    inputData?: Record<string, any>,
    options?: any,
  ): Promise<WorkflowExecutionContext> {
    return {
      tenantId: workflow.tenantId,
      workflowId: workflow.id,
      executionId: execution.executionId,
      variables: {
        ...workflow.variables,
        ...inputData,
      },
      executionData: {
        ...inputData,
      },
      userContext: {
        userId: options?.userId,
      },
      systemContext: {
        startTime: new Date(),
        timeout: options?.timeout || workflow.workflowConfig?.executionTimeout,
        dryRun: options?.dryRun || false,
        debug: options?.debug || false,
      },
    };
  }

  private shouldExecuteStep(step: WorkflowStep, context: WorkflowExecutionContext): boolean {
    // Check if step is active
    if (!step.isActive) {
      return false;
    }

    // Check execution conditions
    if (step.executionConditions && step.executionConditions.length > 0) {
      return this.evaluateStepConditions(step.executionConditions, context);
    }

    return true;
  }

  private evaluateStepConditions(conditions: any[], context: WorkflowExecutionContext): boolean {
    // Simple condition evaluation - would be more sophisticated in production
    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(context.variables, condition.field);
      if (!this.evaluateCondition(condition.field, condition.operator, condition.value, { [condition.field]: fieldValue }, context)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(
    field: string,
    operator: ConditionOperator,
    expectedValue: any,
    data: any,
    context: WorkflowExecutionContext,
  ): boolean {
    const fieldValue = this.getNestedValue(data, field);
    
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
      case ConditionOperator.IN:
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private isExecutionTimedOut(context: WorkflowExecutionContext): boolean {
    if (!context.systemContext.timeout) return false;
    
    const elapsed = Date.now() - context.systemContext.startTime.getTime();
    return elapsed > context.systemContext.timeout * 1000;
  }

  private async prepareStepInputData(step: WorkflowStep, context: WorkflowExecutionContext): Promise<any> {
    const inputData: any = {};

    if (step.inputMapping) {
      for (const [targetField, mapping] of Object.entries(step.inputMapping)) {
        let value: any;

        switch (mapping.source) {
          case 'workflow_variable':
            value = this.getNestedValue(context.variables, mapping.path || targetField);
            break;
          case 'static_value':
            value = mapping.defaultValue;
            break;
          case 'previous_step':
            value = this.getNestedValue(context.executionData, mapping.path || targetField);
            break;
          default:
            value = mapping.defaultValue;
        }

        this.setNestedValue(inputData, targetField, value);
      }
    } else {
      // Use all available data if no explicit mapping
      Object.assign(inputData, context.variables, context.executionData);
    }

    return inputData;
  }

  private async processStepOutputData(
    step: WorkflowStep,
    result: StepExecutionResult,
    context: WorkflowExecutionContext,
  ): Promise<void> {
    if (step.outputMapping && result.data) {
      for (const [sourceField, mapping] of Object.entries(step.outputMapping)) {
        const value = this.getNestedValue(result.data, sourceField);

        switch (mapping.target) {
          case 'workflow_variable':
            this.setNestedValue(context.variables, mapping.path || sourceField, value);
            break;
          case 'workflow_output':
            this.setNestedValue(context.executionData, mapping.path || sourceField, value);
            break;
        }
      }
    } else if (result.data) {
      // Store all result data if no explicit mapping
      Object.assign(context.executionData, result.data);
    }
  }

  private async retryStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    lastResult: StepExecutionResult,
  ): Promise<StepExecutionResult> {
    const maxRetries = step.errorHandling?.maxRetries || step.maxRetries || 3;
    const retryDelay = step.errorHandling?.retryDelay || step.retryDelayMs || 5000;

    for (let retry = 1; retry <= maxRetries; retry++) {
      this.logger.log(`Retrying step ${step.name} (attempt ${retry}/${maxRetries})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      try {
        const result = await this.executeStep(step, context);
        if (result.success) {
          this.logger.log(`Step ${step.name} succeeded on retry ${retry}`);
          return result;
        }
        
        if (retry === maxRetries) {
          return {
            success: false,
            error: `Step failed after ${maxRetries} retries. Last error: ${result.error}`,
          };
        }
        
      } catch (error) {
        if (retry === maxRetries) {
          return {
            success: false,
            error: `Step failed after ${maxRetries} retries. Last error: ${error.message}`,
          };
        }
      }
    }

    return lastResult;
  }

  private interpolateTemplate(template: string, context: WorkflowExecutionContext): string {
    let result = template;
    
    // Replace workflow variables
    for (const [key, value] of Object.entries(context.variables)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
    }
    
    // Replace execution data
    for (const [key, value] of Object.entries(context.executionData)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
    }
    
    return result;
  }

  private async makeHttpRequest(apiConfig: any): Promise<any> {
    // Simplified HTTP request implementation
    // In production, this would use a proper HTTP client like axios
    return {
      status: 200,
      data: { success: true, message: 'API call simulated' },
    };
  }

  private transformDataMap(data: any, config: any): any {
    // Simple data transformation implementation
    if (Array.isArray(data)) {
      return data.map(item => {
        // Apply transformation function if provided
        if (config.transformFunction) {
          try {
            const fn = new Function('value', `return ${config.transformFunction}`);
            return fn(item);
          } catch (error) {
            return item;
          }
        }
        return item;
      });
    }
    return data;
  }

  private transformDataFilter(data: any, config: any): any {
    if (Array.isArray(data) && config.filterFunction) {
      try {
        const fn = new Function('value', `return ${config.filterFunction}`);
        return data.filter(fn);
      } catch (error) {
        return data;
      }
    }
    return data;
  }

  private transformDataSort(data: any, config: any): any {
    if (Array.isArray(data)) {
      return [...data].sort((a, b) => {
        const aVal = config.sortField ? a[config.sortField] : a;
        const bVal = config.sortField ? b[config.sortField] : b;
        
        if (config.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }
    return data;
  }

  private async recordStepExecution(
    context: WorkflowExecutionContext,
    step: WorkflowStep,
    result: StepExecutionResult,
    executionTime: number,
  ): Promise<void> {
    try {
      const stepExecution = this.workflowStepExecutionRepository.create({
        tenantId: context.tenantId,
        workflowExecutionId: context.executionId,
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        status: result.success ? 
          WorkflowStepExecutionStatus.COMPLETED : 
          WorkflowStepExecutionStatus.FAILED,
        executionOrder: step.executionOrder,
        startedAt: new Date(Date.now() - executionTime),
        completedAt: new Date(),
        durationMs: executionTime,
        inputData: {},
        outputData: result.data,
        errorMessage: result.error,
        memoryUsageMB: result.resourceUsage?.memoryMB,
        cpuUsage: result.resourceUsage?.cpuPercent,
      });

      await this.workflowStepExecutionRepository.save(stepExecution);

    } catch (error) {
      this.logger.error(`Failed to record step execution: ${error.message}`, error.stack);
    }
  }

  private async updateExecutionStatus(
    execution: WorkflowExecution,
    status: WorkflowExecutionStatus,
    error?: string,
  ): Promise<void> {
    execution.status = status;
    
    if (status === WorkflowExecutionStatus.COMPLETED || status === WorkflowExecutionStatus.FAILED) {
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();
    }
    
    if (error) {
      execution.errorMessage = error;
    }

    await this.workflowExecutionRepository.save(execution);
  }

  private async updateExecutionProgress(
    context: WorkflowExecutionContext,
    completedSteps: number,
    totalSteps: number,
  ): Promise<void> {
    try {
      const execution = await this.getWorkflowExecution(context.tenantId, context.executionId);
      if (execution) {
        execution.completedSteps = completedSteps;
        execution.totalSteps = totalSteps;
        execution.progressPercentage = (completedSteps / totalSteps) * 100;
        await this.workflowExecutionRepository.save(execution);
      }
    } catch (error) {
      this.logger.error(`Failed to update execution progress: ${error.message}`);
    }
  }

  private async updateWorkflowStatistics(
    workflow: Workflow,
    success: boolean,
    duration: number,
  ): Promise<void> {
    try {
      workflow.totalExecutions += 1;
      
      if (success) {
        workflow.successfulExecutions += 1;
        workflow.consecutiveFailures = 0;
      } else {
        workflow.failedExecutions += 1;
        workflow.consecutiveFailures += 1;
      }

      workflow.lastExecutionAt = new Date();
      workflow.successRate = workflow.totalExecutions > 0 ? 
        (workflow.successfulExecutions / workflow.totalExecutions) : 0;

      // Update average execution time
      workflow.totalProcessingTime += duration / 1000;
      workflow.averageExecutionTime = workflow.totalExecutions > 0 ? 
        workflow.totalProcessingTime / workflow.totalExecutions : 0;

      await this.workflowRepository.save(workflow);

    } catch (error) {
      this.logger.error(`Failed to update workflow statistics: ${error.message}`);
    }
  }

  private async generateExecutionResult(
    execution: WorkflowExecution,
    context: WorkflowExecutionContext,
    stepResult: StepExecutionResult,
    startTime: number,
  ): Promise<WorkflowExecutionResult> {
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: stepResult.success,
      executionId: execution.executionId,
      status: execution.status,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration,
      totalSteps: execution.totalSteps,
      completedSteps: execution.completedSteps,
      failedSteps: execution.failedSteps,
      skippedSteps: execution.skippedSteps,
      outputData: context.executionData,
      error: stepResult.error,
      metrics: {
        totalExecutionTime: duration,
        averageStepTime: execution.totalSteps > 0 ? duration / execution.totalSteps : 0,
        peakMemoryUsage: execution.peakMemoryUsageMB || 0,
        totalApiCalls: execution.totalApiCalls || 0,
        totalDbQueries: execution.totalDbQueries || 0,
      },
    };
  }
}