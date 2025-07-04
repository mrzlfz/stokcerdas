import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as cronParser from 'cron-parser';
import * as moment from 'moment-timezone';
import * as crypto from 'crypto';

import {
  Workflow,
  WorkflowTriggerType,
  WorkflowStatus,
} from '../entities/workflow.entity';
import {
  WorkflowExecution,
  WorkflowExecutionStatus,
  ExecutionTrigger,
} from '../entities/workflow-execution.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Product } from '../../products/entities/product.entity';

export interface TriggerCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains'
    | 'in'
    | 'between';
  value: any;
  secondValue?: any; // For 'between' operator
}

export interface EventTriggerConfig {
  eventType: string;
  filters?: Record<string, any>;
  conditions?: TriggerCondition[];
  debounceMs?: number; // Prevent rapid triggers
  batchSize?: number; // Batch multiple events
  batchTimeoutMs?: number; // Max time to wait for batch
}

export interface ScheduledTriggerConfig {
  cronExpression: string;
  timezone: string;
  startDate?: Date;
  endDate?: Date;
  maxExecutions?: number;
  skipIfRunning?: boolean;
}

export interface WebhookTriggerConfig {
  webhookUrl: string;
  secret?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'api_key';
    credentials?: Record<string, string>;
  };
  expectedStatusCodes?: number[];
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ConditionTriggerConfig {
  conditions: TriggerCondition[];
  logicalOperator: 'AND' | 'OR';
  evaluationInterval?: number; // in seconds
  persistentCheck?: boolean; // Keep checking or one-time
  checkOnDataChange?: boolean; // Trigger when underlying data changes
}

export interface ApiTriggerConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  parameters?: Record<string, any>;
  headers?: Record<string, string>;
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'api_key';
    credentials?: Record<string, string>;
  };
  polling?: {
    enabled: boolean;
    intervalMs: number;
    responseComparison?: 'hash' | 'full' | 'custom';
    customComparisonField?: string;
  };
}

export interface TriggerEvaluationContext {
  tenantId: string;
  workflowId: string;
  currentData?: Record<string, any>;
  previousData?: Record<string, any>;
  eventData?: Record<string, any>;
  systemTime: Date;
  userContext?: {
    userId?: string;
    roles?: string[];
    permissions?: string[];
  };
}

export interface TriggerExecutionResult {
  shouldTrigger: boolean;
  triggerData?: Record<string, any>;
  triggerReason?: string;
  nextEvaluationTime?: Date;
  errors?: string[];
}

@Injectable()
export class TriggerConfigurationService {
  private readonly logger = new Logger(TriggerConfigurationService.name);
  private readonly cachePrefix = 'trigger_config';
  private readonly eventBuffer = new Map<string, any[]>(); // For batching events
  private readonly webhookCallbacks = new Map<string, Function>(); // For webhook handlers

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowExecution)
    private readonly workflowExecutionRepository: Repository<WorkflowExecution>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Setup event listeners for different trigger types
    this.setupEventListeners();
  }

  // =============================================
  // TRIGGER CONFIGURATION MANAGEMENT
  // =============================================

  async configureTrigger(
    tenantId: string,
    workflowId: string,
    triggerType: WorkflowTriggerType,
    triggerConfig: any,
    updatedBy?: string,
  ): Promise<Workflow> {
    try {
      this.logger.log(
        `Configuring ${triggerType} trigger for workflow ${workflowId}`,
      );

      const workflow = await this.getWorkflow(tenantId, workflowId);

      // Validate trigger configuration
      await this.validateTriggerConfiguration(triggerType, triggerConfig);

      // Update workflow with new trigger configuration
      workflow.triggerType = triggerType;
      workflow.triggerConfig = triggerConfig;
      workflow.updatedBy = updatedBy;
      workflow.updatedAt = new Date();

      // Calculate next execution time for scheduled triggers
      if (triggerType === WorkflowTriggerType.SCHEDULED) {
        workflow.nextExecutionAt = this.calculateNextExecution(triggerConfig);
      }

      const updatedWorkflow = await this.workflowRepository.save(workflow);

      // Setup trigger monitoring
      await this.setupTriggerMonitoring(
        tenantId,
        workflowId,
        triggerType,
        triggerConfig,
      );

      // Clear cache
      await this.clearTriggerCache(tenantId, workflowId);

      // Emit configuration event
      this.eventEmitter.emit('trigger.configured', {
        tenantId,
        workflowId,
        triggerType,
        configuredBy: updatedBy,
      });

      this.logger.log(
        `Trigger configured successfully for workflow ${workflowId}`,
      );
      return updatedWorkflow;
    } catch (error) {
      this.logger.error(
        `Failed to configure trigger for workflow ${workflowId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateTriggerConfiguration(
    tenantId: string,
    workflowId: string,
    triggerConfig: any,
    updatedBy?: string,
  ): Promise<Workflow> {
    try {
      const workflow = await this.getWorkflow(tenantId, workflowId);

      await this.validateTriggerConfiguration(
        workflow.triggerType,
        triggerConfig,
      );

      workflow.triggerConfig = triggerConfig;
      workflow.updatedBy = updatedBy;
      workflow.updatedAt = new Date();

      if (workflow.triggerType === WorkflowTriggerType.SCHEDULED) {
        workflow.nextExecutionAt = this.calculateNextExecution(triggerConfig);
      }

      const updatedWorkflow = await this.workflowRepository.save(workflow);

      // Update trigger monitoring
      await this.setupTriggerMonitoring(
        tenantId,
        workflowId,
        workflow.triggerType,
        triggerConfig,
      );

      await this.clearTriggerCache(tenantId, workflowId);

      return updatedWorkflow;
    } catch (error) {
      this.logger.error(
        `Failed to update trigger configuration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async disableTrigger(
    tenantId: string,
    workflowId: string,
    updatedBy?: string,
  ): Promise<void> {
    try {
      const workflow = await this.getWorkflow(tenantId, workflowId);

      workflow.isActive = false;
      workflow.updatedBy = updatedBy;
      workflow.updatedAt = new Date();

      await this.workflowRepository.save(workflow);

      // Remove trigger monitoring
      await this.removeTriggerMonitoring(tenantId, workflowId);

      await this.clearTriggerCache(tenantId, workflowId);

      this.eventEmitter.emit('trigger.disabled', {
        tenantId,
        workflowId,
        disabledBy: updatedBy,
      });
    } catch (error) {
      this.logger.error(
        `Failed to disable trigger: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =============================================
  // TRIGGER EVALUATION AND EXECUTION
  // =============================================

  async evaluateTrigger(
    tenantId: string,
    workflowId: string,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    try {
      const workflow = await this.getWorkflow(tenantId, workflowId);

      if (!workflow.isActive || workflow.status !== WorkflowStatus.ACTIVE) {
        return { shouldTrigger: false, triggerReason: 'Workflow not active' };
      }

      // Check if workflow can execute (not already running, etc.)
      if (!workflow.canExecute()) {
        return {
          shouldTrigger: false,
          triggerReason: 'Workflow cannot execute',
        };
      }

      // Evaluate trigger based on type
      switch (workflow.triggerType) {
        case WorkflowTriggerType.MANUAL:
          return this.evaluateManualTrigger(workflow, context);

        case WorkflowTriggerType.SCHEDULED:
          return this.evaluateScheduledTrigger(workflow, context);

        case WorkflowTriggerType.EVENT_BASED:
          return this.evaluateEventBasedTrigger(workflow, context);

        case WorkflowTriggerType.WEBHOOK:
          return this.evaluateWebhookTrigger(workflow, context);

        case WorkflowTriggerType.CONDITION_BASED:
          return this.evaluateConditionBasedTrigger(workflow, context);

        case WorkflowTriggerType.API_TRIGGER:
          return this.evaluateApiTrigger(workflow, context);

        default:
          return {
            shouldTrigger: false,
            triggerReason: 'Unknown trigger type',
          };
      }
    } catch (error) {
      this.logger.error(
        `Failed to evaluate trigger for workflow ${workflowId}: ${error.message}`,
        error.stack,
      );
      return {
        shouldTrigger: false,
        triggerReason: 'Evaluation error',
        errors: [error.message],
      };
    }
  }

  async triggerWorkflow(
    tenantId: string,
    workflowId: string,
    triggerData?: Record<string, any>,
    triggeredBy?: string,
    triggerSource?: string,
  ): Promise<string> {
    // Returns execution ID
    try {
      this.logger.log(
        `Triggering workflow ${workflowId} for tenant ${tenantId}`,
      );

      const workflow = await this.getWorkflow(tenantId, workflowId);

      // Generate unique execution ID
      const executionId = this.generateExecutionId();

      // Create workflow execution record
      const execution = this.workflowExecutionRepository.create({
        tenantId,
        workflowId,
        executionId,
        status: WorkflowExecutionStatus.PENDING,
        trigger: this.mapTriggerType(workflow.triggerType),
        inputData: triggerData,
        triggeredByUserId: triggeredBy,
        triggeredBySystem: triggerSource,
        startedAt: new Date(),
        totalSteps: workflow.steps?.length || 0,
        executionContext: {
          triggerInfo: {
            source: triggerSource,
            metadata: triggerData,
            timestamp: new Date().toISOString(),
          },
          serverInfo: {
            hostname: process.env.HOSTNAME,
            nodeVersion: process.version,
          },
        },
      });

      await this.workflowExecutionRepository.save(execution);

      // Emit trigger event for workflow execution service
      this.eventEmitter.emit('workflow.triggered', {
        tenantId,
        workflowId,
        executionId,
        triggerData,
        triggeredBy,
        triggerSource,
      });

      // Update workflow last execution timestamp
      workflow.lastExecutionAt = new Date();
      workflow.totalExecutions += 1;
      await this.workflowRepository.save(workflow);

      this.logger.log(
        `Workflow ${workflowId} triggered successfully with execution ID ${executionId}`,
      );
      return executionId;
    } catch (error) {
      this.logger.error(
        `Failed to trigger workflow ${workflowId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =============================================
  // SCHEDULED TRIGGER MANAGEMENT
  // =============================================

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledTriggers(): Promise<void> {
    try {
      const now = new Date();

      // Get all active scheduled workflows that are due for execution
      const dueWorkflows = await this.workflowRepository.find({
        where: {
          triggerType: WorkflowTriggerType.SCHEDULED,
          isActive: true,
          status: WorkflowStatus.ACTIVE,
          nextExecutionAt: { $lte: now } as any,
        },
      });

      this.logger.log(
        `Found ${dueWorkflows.length} scheduled workflows due for execution`,
      );

      for (const workflow of dueWorkflows) {
        try {
          // Check if workflow should skip if already running
          const config = this.convertToScheduledTriggerConfig(
            workflow.triggerConfig,
          );
          if (config.skipIfRunning) {
            const runningExecution =
              await this.workflowExecutionRepository.findOne({
                where: {
                  workflowId: workflow.id,
                  status: WorkflowExecutionStatus.RUNNING,
                },
              });

            if (runningExecution) {
              this.logger.log(
                `Skipping scheduled execution for workflow ${workflow.id} - already running`,
              );
              continue;
            }
          }

          // Trigger the workflow
          await this.triggerWorkflow(
            workflow.tenantId,
            workflow.id,
            { scheduledExecution: true },
            undefined,
            'scheduler',
          );

          // Calculate next execution time
          workflow.nextExecutionAt = this.calculateNextExecution(config);
          await this.workflowRepository.save(workflow);
        } catch (error) {
          this.logger.error(
            `Failed to execute scheduled workflow ${workflow.id}: ${error.message}`,
            error.stack,
          );

          // Mark workflow as error if too many consecutive failures
          workflow.consecutiveFailures += 1;
          if (workflow.consecutiveFailures >= 5) {
            workflow.status = WorkflowStatus.ERROR;
            workflow.lastErrorMessage = `Too many consecutive failures: ${error.message}`;
            workflow.lastErrorAt = new Date();
          }
          await this.workflowRepository.save(workflow);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process scheduled triggers: ${error.message}`,
        error.stack,
      );
    }
  }

  // =============================================
  // EVENT-BASED TRIGGER MANAGEMENT
  // =============================================

  private setupEventListeners(): void {
    // Listen for inventory events
    this.eventEmitter.on('inventory.stock_level_changed', data => {
      this.handleInventoryEvent('stock_level_changed', data);
    });

    this.eventEmitter.on('inventory.low_stock_detected', data => {
      this.handleInventoryEvent('low_stock_detected', data);
    });

    // Listen for product events
    this.eventEmitter.on('product.created', data => {
      this.handleProductEvent('product_created', data);
    });

    this.eventEmitter.on('product.updated', data => {
      this.handleProductEvent('product_updated', data);
    });

    // Listen for purchase order events
    this.eventEmitter.on('purchase_order.created', data => {
      this.handlePurchaseOrderEvent('po_created', data);
    });

    this.eventEmitter.on('purchase_order.approved', data => {
      this.handlePurchaseOrderEvent('po_approved', data);
    });

    // Listen for supplier events
    this.eventEmitter.on('supplier.performance_updated', data => {
      this.handleSupplierEvent('performance_updated', data);
    });

    // Listen for system events
    this.eventEmitter.on('system.error', data => {
      this.handleSystemEvent('system_error', data);
    });

    this.eventEmitter.on('system.maintenance', data => {
      this.handleSystemEvent('maintenance', data);
    });
  }

  private async handleInventoryEvent(
    eventType: string,
    eventData: any,
  ): Promise<void> {
    await this.processEventTriggers('inventory', eventType, eventData);
  }

  private async handleProductEvent(
    eventType: string,
    eventData: any,
  ): Promise<void> {
    await this.processEventTriggers('product', eventType, eventData);
  }

  private async handlePurchaseOrderEvent(
    eventType: string,
    eventData: any,
  ): Promise<void> {
    await this.processEventTriggers('purchase_order', eventType, eventData);
  }

  private async handleSupplierEvent(
    eventType: string,
    eventData: any,
  ): Promise<void> {
    await this.processEventTriggers('supplier', eventType, eventData);
  }

  private async handleSystemEvent(
    eventType: string,
    eventData: any,
  ): Promise<void> {
    await this.processEventTriggers('system', eventType, eventData);
  }

  private async processEventTriggers(
    category: string,
    eventType: string,
    eventData: any,
  ): Promise<void> {
    try {
      // Find workflows with event-based triggers for this event type
      const workflows = await this.workflowRepository.find({
        where: {
          triggerType: WorkflowTriggerType.EVENT_BASED,
          isActive: true,
          status: WorkflowStatus.ACTIVE,
          tenantId: eventData.tenantId,
        },
      });

      for (const workflow of workflows) {
        const config = workflow.triggerConfig as EventTriggerConfig;

        // Check if this workflow should be triggered by this event
        if (config.eventType === `${category}.${eventType}`) {
          // Apply filters if configured
          if (
            config.filters &&
            !this.matchesFilters(eventData, config.filters)
          ) {
            continue;
          }

          // Apply conditions if configured
          if (
            config.conditions &&
            !this.evaluateConditions(config.conditions, eventData)
          ) {
            continue;
          }

          // Handle debouncing or batching if configured
          if (config.debounceMs || config.batchSize) {
            await this.handleEventBatching(workflow, eventData, config);
          } else {
            // Trigger immediately
            await this.triggerWorkflow(
              workflow.tenantId,
              workflow.id,
              { eventData, eventType: `${category}.${eventType}` },
              undefined,
              'event_trigger',
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process event triggers for ${category}.${eventType}: ${error.message}`,
        error.stack,
      );
    }
  }

  // =============================================
  // WEBHOOK TRIGGER MANAGEMENT
  // =============================================

  async registerWebhookTrigger(
    tenantId: string,
    workflowId: string,
    config: WebhookTriggerConfig,
  ): Promise<{ webhookId: string; webhookUrl: string }> {
    try {
      const webhookId = this.generateWebhookId(tenantId, workflowId);
      const webhookUrl = `${config.webhookUrl}/${webhookId}`;

      // Store webhook callback
      this.webhookCallbacks.set(webhookId, async (data: any) => {
        await this.triggerWorkflow(
          tenantId,
          workflowId,
          { webhookData: data },
          undefined,
          'webhook',
        );
      });

      return { webhookId, webhookUrl };
    } catch (error) {
      this.logger.error(
        `Failed to register webhook trigger: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async handleWebhookCall(
    webhookId: string,
    payload: any,
    headers: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const callback = this.webhookCallbacks.get(webhookId);
      if (!callback) {
        return { success: false, message: 'Webhook not found' };
      }

      // Validate webhook signature if configured
      // This would check HMAC signature, etc.

      await callback(payload);

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to handle webhook call: ${error.message}`,
        error.stack,
      );
      return { success: false, message: error.message };
    }
  }

  // =============================================
  // CONDITION-BASED TRIGGER EVALUATION
  // =============================================

  @Cron(CronExpression.EVERY_30_SECONDS)
  async evaluateConditionBasedTriggers(): Promise<void> {
    try {
      // Get all active condition-based workflows
      const workflows = await this.workflowRepository.find({
        where: {
          triggerType: WorkflowTriggerType.CONDITION_BASED,
          isActive: true,
          status: WorkflowStatus.ACTIVE,
        },
      });

      for (const workflow of workflows) {
        try {
          const config = workflow.triggerConfig as ConditionTriggerConfig;

          // Get current data context
          const context: TriggerEvaluationContext = {
            tenantId: workflow.tenantId,
            workflowId: workflow.id,
            systemTime: new Date(),
          };

          // Load relevant data based on conditions
          context.currentData = await this.loadConditionData(
            workflow.tenantId,
            config.conditions,
          );

          // Evaluate conditions
          const result = await this.evaluateConditionBasedTrigger(
            workflow,
            context,
          );

          if (result.shouldTrigger) {
            await this.triggerWorkflow(
              workflow.tenantId,
              workflow.id,
              result.triggerData,
              undefined,
              'condition_trigger',
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to evaluate condition trigger for workflow ${workflow.id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to evaluate condition-based triggers: ${error.message}`,
        error.stack,
      );
    }
  }

  // =============================================
  // TRIGGER EVALUATION METHODS
  // =============================================

  private async evaluateManualTrigger(
    workflow: Workflow,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    // Manual triggers are always allowed when requested
    return {
      shouldTrigger: true,
      triggerReason: 'Manual trigger requested',
      triggerData: context.eventData,
    };
  }

  private async evaluateScheduledTrigger(
    workflow: Workflow,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    const config = this.convertToScheduledTriggerConfig(workflow.triggerConfig);
    const now = context.systemTime;

    // Check if execution time has arrived
    if (workflow.nextExecutionAt && workflow.nextExecutionAt <= now) {
      // Check if we've reached max executions
      if (
        config.maxExecutions &&
        workflow.totalExecutions >= config.maxExecutions
      ) {
        return {
          shouldTrigger: false,
          triggerReason: 'Maximum executions reached',
        };
      }

      return {
        shouldTrigger: true,
        triggerReason: 'Scheduled time reached',
        triggerData: { scheduledExecution: true },
        nextEvaluationTime: this.calculateNextExecution(config),
      };
    }

    return {
      shouldTrigger: false,
      triggerReason: 'Not yet scheduled time',
      nextEvaluationTime: workflow.nextExecutionAt,
    };
  }

  private async evaluateEventBasedTrigger(
    workflow: Workflow,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    const config = workflow.triggerConfig as EventTriggerConfig;

    if (!context.eventData) {
      return {
        shouldTrigger: false,
        triggerReason: 'No event data provided',
      };
    }

    // Apply filters
    if (
      config.filters &&
      !this.matchesFilters(context.eventData, config.filters)
    ) {
      return {
        shouldTrigger: false,
        triggerReason: 'Event data does not match filters',
      };
    }

    // Apply conditions
    if (
      config.conditions &&
      !this.evaluateConditions(config.conditions, context.eventData)
    ) {
      return {
        shouldTrigger: false,
        triggerReason: 'Event data does not meet conditions',
      };
    }

    return {
      shouldTrigger: true,
      triggerReason: 'Event conditions met',
      triggerData: context.eventData,
    };
  }

  private async evaluateWebhookTrigger(
    workflow: Workflow,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    // Webhook triggers are evaluated when webhook is called
    if (context.eventData?.webhookData) {
      return {
        shouldTrigger: true,
        triggerReason: 'Webhook called',
        triggerData: context.eventData.webhookData,
      };
    }

    return {
      shouldTrigger: false,
      triggerReason: 'No webhook data',
    };
  }

  private async evaluateConditionBasedTrigger(
    workflow: Workflow,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    const config = workflow.triggerConfig as ConditionTriggerConfig;

    if (!context.currentData) {
      return {
        shouldTrigger: false,
        triggerReason: 'No data to evaluate conditions',
      };
    }

    const conditionsMet = this.evaluateConditions(
      config.conditions,
      context.currentData,
      config.logicalOperator,
    );

    if (conditionsMet) {
      return {
        shouldTrigger: true,
        triggerReason: 'Conditions met',
        triggerData: context.currentData,
      };
    }

    return {
      shouldTrigger: false,
      triggerReason: 'Conditions not met',
    };
  }

  private async evaluateApiTrigger(
    workflow: Workflow,
    context: TriggerEvaluationContext,
  ): Promise<TriggerExecutionResult> {
    // API triggers would make HTTP calls and evaluate responses
    // This is a simplified implementation
    return {
      shouldTrigger: false,
      triggerReason: 'API trigger evaluation not implemented',
    };
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private async validateTriggerConfiguration(
    triggerType: WorkflowTriggerType,
    config: any,
  ): Promise<void> {
    switch (triggerType) {
      case WorkflowTriggerType.SCHEDULED:
        this.validateScheduledTriggerConfig(config);
        break;
      case WorkflowTriggerType.EVENT_BASED:
        this.validateEventTriggerConfig(config);
        break;
      case WorkflowTriggerType.WEBHOOK:
        this.validateWebhookTriggerConfig(config);
        break;
      case WorkflowTriggerType.CONDITION_BASED:
        this.validateConditionTriggerConfig(config);
        break;
      case WorkflowTriggerType.API_TRIGGER:
        this.validateApiTriggerConfig(config);
        break;
    }
  }

  private validateScheduledTriggerConfig(config: ScheduledTriggerConfig): void {
    if (!config.cronExpression) {
      throw new BadRequestException(
        'Cron expression diperlukan untuk scheduled trigger',
      );
    }

    try {
      cronParser.parseExpression(config.cronExpression);
    } catch (error) {
      throw new BadRequestException('Cron expression tidak valid');
    }

    if (!config.timezone) {
      throw new BadRequestException(
        'Timezone diperlukan untuk scheduled trigger',
      );
    }
  }

  private validateEventTriggerConfig(config: EventTriggerConfig): void {
    if (!config.eventType) {
      throw new BadRequestException(
        'Event type diperlukan untuk event-based trigger',
      );
    }
  }

  private validateWebhookTriggerConfig(config: WebhookTriggerConfig): void {
    if (!config.webhookUrl) {
      throw new BadRequestException(
        'Webhook URL diperlukan untuk webhook trigger',
      );
    }
  }

  private validateConditionTriggerConfig(config: ConditionTriggerConfig): void {
    if (!config.conditions || config.conditions.length === 0) {
      throw new BadRequestException(
        'Conditions diperlukan untuk condition-based trigger',
      );
    }
  }

  private validateApiTriggerConfig(config: ApiTriggerConfig): void {
    if (!config.endpoint) {
      throw new BadRequestException('Endpoint diperlukan untuk API trigger');
    }
  }

  private calculateNextExecution(config: ScheduledTriggerConfig): Date | null {
    try {
      const interval = cronParser.parseExpression(config.cronExpression, {
        currentDate: new Date(),
        tz: config.timezone || 'Asia/Jakarta',
      });

      const nextDate = interval.next().toDate();

      // Check if within start/end date range
      if (config.startDate && nextDate < config.startDate) {
        return null;
      }

      if (config.endDate && nextDate > config.endDate) {
        return null;
      }

      return nextDate;
    } catch (error) {
      this.logger.error(`Failed to calculate next execution: ${error.message}`);
      return null;
    }
  }

  private evaluateConditions(
    conditions: TriggerCondition[],
    data: any,
    logicalOperator: 'AND' | 'OR' = 'AND',
  ): boolean {
    if (!conditions || conditions.length === 0) return true;

    const results = conditions.map(condition =>
      this.evaluateCondition(condition, data),
    );

    if (logicalOperator === 'AND') {
      return results.every(result => result);
    } else {
      return results.some(result => result);
    }
  }

  private evaluateCondition(condition: TriggerCondition, data: any): boolean {
    const fieldValue = this.getFieldValue(condition.field, data);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'in':
        return (
          Array.isArray(condition.value) && condition.value.includes(fieldValue)
        );
      case 'between':
        return (
          Number(fieldValue) >= Number(condition.value) &&
          Number(fieldValue) <= Number(condition.secondValue)
        );
      default:
        return false;
    }
  }

  private getFieldValue(fieldPath: string, data: any): any {
    const keys = fieldPath.split('.');
    let value = data;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private matchesFilters(data: any, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      const dataValue = this.getFieldValue(key, data);
      if (dataValue !== value) {
        return false;
      }
    }
    return true;
  }

  private async loadConditionData(
    tenantId: string,
    conditions: TriggerCondition[],
  ): Promise<any> {
    const data: any = {};

    // Load relevant data based on condition fields
    for (const condition of conditions) {
      if (condition.field.startsWith('inventory.')) {
        // Load inventory data
        const inventoryItems = await this.inventoryItemRepository.find({
          where: { tenantId },
          take: 1000, // Limit for performance
        });
        data.inventory = inventoryItems;
      }

      if (condition.field.startsWith('product.')) {
        // Load product data
        const products = await this.productRepository.find({
          where: { tenantId },
          take: 1000,
        });
        data.products = products;
      }
    }

    return data;
  }

  private async handleEventBatching(
    workflow: Workflow,
    eventData: any,
    config: EventTriggerConfig,
  ): Promise<void> {
    const batchKey = `${workflow.id}_batch`;

    if (!this.eventBuffer.has(batchKey)) {
      this.eventBuffer.set(batchKey, []);
    }

    const batch = this.eventBuffer.get(batchKey)!;
    batch.push(eventData);

    // Check if batch is full or timeout reached
    if (batch.length >= (config.batchSize || 10)) {
      await this.processBatchedEvents(workflow, batch);
      this.eventBuffer.delete(batchKey);
    } else if (config.batchTimeoutMs) {
      // Set timeout to process batch
      setTimeout(async () => {
        const currentBatch = this.eventBuffer.get(batchKey);
        if (currentBatch && currentBatch.length > 0) {
          await this.processBatchedEvents(workflow, currentBatch);
          this.eventBuffer.delete(batchKey);
        }
      }, config.batchTimeoutMs);
    }
  }

  private async processBatchedEvents(
    workflow: Workflow,
    events: any[],
  ): Promise<void> {
    await this.triggerWorkflow(
      workflow.tenantId,
      workflow.id,
      { batchedEvents: events, eventCount: events.length },
      undefined,
      'event_batch',
    );
  }

  private mapTriggerType(triggerType: WorkflowTriggerType): ExecutionTrigger {
    switch (triggerType) {
      case WorkflowTriggerType.MANUAL:
        return ExecutionTrigger.MANUAL;
      case WorkflowTriggerType.SCHEDULED:
        return ExecutionTrigger.SCHEDULED;
      case WorkflowTriggerType.EVENT_BASED:
        return ExecutionTrigger.EVENT_TRIGGERED;
      case WorkflowTriggerType.WEBHOOK:
        return ExecutionTrigger.WEBHOOK_TRIGGERED;
      case WorkflowTriggerType.CONDITION_BASED:
        return ExecutionTrigger.CONDITION_MET;
      case WorkflowTriggerType.API_TRIGGER:
        return ExecutionTrigger.API_TRIGGERED;
      default:
        return ExecutionTrigger.MANUAL;
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateWebhookId(tenantId: string, workflowId: string): string {
    return `wh_${tenantId}_${workflowId}_${crypto
      .randomBytes(8)
      .toString('hex')}`;
  }

  private async getWorkflow(
    tenantId: string,
    workflowId: string,
  ): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, tenantId, deletedAt: null },
      relations: ['steps'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} tidak ditemukan`);
    }

    return workflow;
  }

  private async setupTriggerMonitoring(
    tenantId: string,
    workflowId: string,
    triggerType: WorkflowTriggerType,
    triggerConfig: any,
  ): Promise<void> {
    // Setup monitoring based on trigger type
    // This could include registering cron jobs, event listeners, webhooks, etc.
    this.logger.log(
      `Setting up monitoring for ${triggerType} trigger on workflow ${workflowId}`,
    );
  }

  private async removeTriggerMonitoring(
    tenantId: string,
    workflowId: string,
  ): Promise<void> {
    // Remove monitoring for the workflow
    this.logger.log(`Removing trigger monitoring for workflow ${workflowId}`);
  }

  private async clearTriggerCache(
    tenantId: string,
    workflowId?: string,
  ): Promise<void> {
    if (workflowId) {
      await this.cacheManager.del(
        `${this.cachePrefix}:${tenantId}:${workflowId}`,
      );
    }
    await this.cacheManager.del(`${this.cachePrefix}:${tenantId}`);
  }

  /**
   * Convert raw triggerConfig JSON to ScheduledTriggerConfig with proper Date objects
   */
  private convertToScheduledTriggerConfig(
    triggerConfig: any,
  ): ScheduledTriggerConfig {
    return {
      cronExpression: triggerConfig.cronExpression || '0 0 * * *',
      timezone: triggerConfig.timezone || 'Asia/Jakarta',
      startDate: triggerConfig.startDate
        ? new Date(triggerConfig.startDate)
        : undefined,
      endDate: triggerConfig.endDate
        ? new Date(triggerConfig.endDate)
        : undefined,
      maxExecutions: triggerConfig.maxExecutions,
      skipIfRunning: triggerConfig.skipIfRunning || false,
    };
  }
}
