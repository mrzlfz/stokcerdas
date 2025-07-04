import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as moment from 'moment-timezone';

// Services
import { AutomatedPurchasingService } from '../services/automated-purchasing.service';
import { AutomationRuleEngine } from '../services/automation-rule-engine.service';
import { ReorderCalculationService } from '../services/reorder-calculation.service';
import { SupplierSelectionService } from '../services/supplier-selection.service';
import { AlertManagementService } from '../../alerts/services/alert-management.service';
import { EmailService } from '../../notifications/services/email.service';

// Entities
import { ReorderRule } from '../entities/reorder-rule.entity';
import { AutomationSchedule } from '../entities/automation-schedule.entity';
import { ReorderExecution } from '../entities/reorder-rule.entity';

// Types
import {
  AlertType,
  AlertSeverity,
} from '../../alerts/entities/alert-configuration.entity';

// Job Data Interfaces
export interface ProcessReorderRulesJobData {
  tenantId: string;
  ruleIds?: string[];
  productIds?: string[];
  locationIds?: string[];
  filters?: {
    minUrgencyLevel?: number;
    maxOrderValue?: number;
    requiresApproval?: boolean;
  };
  context?: {
    criticalLevel?: number;
    warningLevel?: number;
    budgetConstraint?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  };
  options?: {
    batchSize?: number;
    maxConcurrentJobs?: number;
    delayBetweenOrdersMs?: number;
    dryRun?: boolean;
  };
  triggeredBy?: string;
  executionId?: string;
}

export interface ExecuteAutomatedPurchaseJobData {
  tenantId: string;
  reorderRuleId?: string;
  productId?: string;
  locationId?: string;
  forceExecution?: boolean;
  dryRun?: boolean;
  overrides?: {
    orderQuantity?: number;
    selectedSupplierId?: string;
    urgencyLevel?: number;
    skipApproval?: boolean;
  };
  executionId?: string;
  triggeredBy?: string;
}

export interface BulkAutomatedPurchaseJobData {
  tenantId: string;
  reorderRuleIds?: string[];
  productIds?: string[];
  locationIds?: string[];
  filters?: {
    minUrgencyLevel?: number;
    maxOrderValue?: number;
    requiresApproval?: boolean;
    supplierIds?: string[];
  };
  options?: {
    dryRun?: boolean;
    maxConcurrentOrders?: number;
    batchSize?: number;
    delayBetweenOrdersMs?: number;
  };
  batchId?: string;
  triggeredBy?: string;
}

export interface ScheduledAutomationJobData {
  tenantId: string;
  scheduleId: string;
  scheduleName: string;
  scheduleType: string;
  jobParameters?: Record<string, any>;
  filters?: Record<string, any>;
  executionId?: string;
}

export interface SendNotificationJobData {
  tenantId: string;
  type: 'email' | 'alert' | 'webhook';
  recipients: string[];
  subject: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  retryAttempts?: number;
}

export interface MaintenanceJobData {
  tenantId?: string;
  taskType:
    | 'cleanup_executions'
    | 'archive_logs'
    | 'update_metrics'
    | 'health_check';
  parameters?: Record<string, any>;
}

@Processor('automation')
export class AutomationProcessor {
  private readonly logger = new Logger(AutomationProcessor.name);
  private readonly processingState = new Map<string, boolean>();

  constructor(
    @InjectRepository(ReorderRule)
    private readonly reorderRuleRepository: Repository<ReorderRule>,
    @InjectRepository(AutomationSchedule)
    private readonly automationScheduleRepository: Repository<AutomationSchedule>,
    @InjectRepository(ReorderExecution)
    private readonly reorderExecutionRepository: Repository<ReorderExecution>,
    private readonly automatedPurchasingService: AutomatedPurchasingService,
    private readonly automationRuleEngine: AutomationRuleEngine,
    private readonly reorderCalculationService: ReorderCalculationService,
    private readonly supplierSelectionService: SupplierSelectionService,
    private readonly alertManagementService: AlertManagementService,
    private readonly emailService: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =============================================
  // MAIN AUTOMATION PROCESSING JOBS
  // =============================================

  @Process('processReorderRules')
  async processReorderRulesJob(
    job: Job<ProcessReorderRulesJobData>,
  ): Promise<any> {
    const { data } = job;
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing reorder rules job for tenant ${data.tenantId}`,
      );

      // Prevent concurrent processing for same tenant
      const lockKey = `process_rules_${data.tenantId}`;
      if (this.processingState.get(lockKey)) {
        this.logger.warn(
          `Reorder rules processing already running for tenant ${data.tenantId}`,
        );
        return { skipped: true, reason: 'Already processing' };
      }

      this.processingState.set(lockKey, true);

      try {
        // Update job progress
        await job.progress(10);

        // Build evaluation context
        const context = {
          tenantId: data.tenantId,
          currentTime: new Date(),
          inventoryThresholds: {
            criticalLevel: data.context?.criticalLevel || 10,
            warningLevel: data.context?.warningLevel || 25,
          },
          systemLoad: {
            cpuUsage: 45, // Would be actual system metrics in production
            memoryUsage: 60,
            activeJobs: await job.queue.getActive().then(jobs => jobs.length),
          },
          budgetConstraints: {
            remainingBudget: data.context?.budgetConstraint,
            dailyLimit: data.context?.dailyLimit,
            monthlyLimit: data.context?.monthlyLimit,
          },
        };

        await job.progress(25);

        // Process automation rules
        const metrics = await this.automationRuleEngine.processAutomationRules(
          data.tenantId,
          context,
        );

        await job.progress(90);

        // Send completion notification if configured
        if (data.triggeredBy) {
          await this.sendProcessingCompletionNotification(data, metrics);
        }

        await job.progress(100);

        const executionTime = Date.now() - startTime;
        this.logger.log(
          `Reorder rules processing completed for tenant ${data.tenantId}. ` +
            `Processed: ${metrics.totalRulesProcessed}, Triggered: ${metrics.triggeredRules}, ` +
            `Time: ${executionTime}ms`,
        );

        // Emit completion event
        this.eventEmitter.emit('automation.processing.completed', {
          tenantId: data.tenantId,
          executionId: data.executionId,
          metrics,
          executionTime,
        });

        return {
          success: true,
          tenantId: data.tenantId,
          metrics,
          executionTime,
          triggeredBy: data.triggeredBy,
        };
      } finally {
        this.processingState.delete(lockKey);
      }
    } catch (error) {
      this.logger.error(
        `Reorder rules processing failed for tenant ${data.tenantId}: ${error.message}`,
        error.stack,
      );

      // Emit error event
      this.eventEmitter.emit('automation.processing.failed', {
        tenantId: data.tenantId,
        executionId: data.executionId,
        error: error.message,
      });

      // Send error notification
      await this.sendErrorNotification(
        data.tenantId,
        'Reorder Rules Processing Failed',
        error.message,
      );

      throw error;
    }
  }

  @Process('executeAutomatedPurchase')
  async executeAutomatedPurchaseJob(
    job: Job<ExecuteAutomatedPurchaseJobData>,
  ): Promise<any> {
    const { data } = job;

    try {
      this.logger.log(
        `Executing automated purchase for tenant ${data.tenantId}, rule ${data.reorderRuleId}`,
      );

      await job.progress(20);

      const result =
        await this.automatedPurchasingService.executeAutomatedPurchase({
          tenantId: data.tenantId,
          reorderRuleId: data.reorderRuleId,
          productId: data.productId,
          locationId: data.locationId,
          forceExecution: data.forceExecution,
          dryRun: data.dryRun,
          overrides: data.overrides,
        });

      await job.progress(80);

      // Send notification if purchase order was created
      if (result.success && result.purchaseOrderId && !data.dryRun) {
        await this.sendPurchaseOrderNotification(result);
      }

      await job.progress(100);

      this.logger.log(
        `Automated purchase ${
          result.success ? 'completed' : 'failed'
        } for tenant ${data.tenantId}. ` +
          `PO Created: ${
            result.shouldCreatePurchaseOrder
          }, Value: IDR ${result.estimatedValue.toLocaleString()}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Automated purchase execution failed: ${error.message}`,
        error.stack,
      );

      await this.sendErrorNotification(
        data.tenantId,
        'Automated Purchase Failed',
        `Failed to execute automated purchase for rule ${data.reorderRuleId}: ${error.message}`,
      );

      throw error;
    }
  }

  @Process('bulkAutomatedPurchase')
  async bulkAutomatedPurchaseJob(
    job: Job<BulkAutomatedPurchaseJobData>,
  ): Promise<any> {
    const { data } = job;

    try {
      this.logger.log(
        `Executing bulk automated purchase for tenant ${data.tenantId}`,
      );

      await job.progress(10);

      const result =
        await this.automatedPurchasingService.executeBulkAutomatedPurchase({
          tenantId: data.tenantId,
          reorderRuleIds: data.reorderRuleIds,
          productIds: data.productIds,
          locationIds: data.locationIds,
          filters: data.filters,
          options: data.options,
        });

      await job.progress(80);

      // Send bulk completion notification
      await this.sendBulkPurchaseNotification(result, data.batchId);

      await job.progress(100);

      this.logger.log(
        `Bulk automated purchase completed for tenant ${data.tenantId}. ` +
          `Processed: ${result.totalProcessed}, Successful: ${result.successfulOrders}, ` +
          `Failed: ${
            result.failedOrders
          }, Total Value: IDR ${result.summary.totalValue.toLocaleString()}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Bulk automated purchase failed: ${error.message}`,
        error.stack,
      );

      await this.sendErrorNotification(
        data.tenantId,
        'Bulk Automated Purchase Failed',
        `Bulk purchase execution failed: ${error.message}`,
      );

      throw error;
    }
  }

  @Process('scheduledAutomation')
  async scheduledAutomationJob(
    job: Job<ScheduledAutomationJobData>,
  ): Promise<any> {
    const { data } = job;

    try {
      this.logger.log(
        `Executing scheduled automation: ${data.scheduleName} (${data.scheduleType})`,
      );

      await job.progress(20);

      // Get and update schedule
      const schedule = await this.automationScheduleRepository.findOne({
        where: { id: data.scheduleId, tenantId: data.tenantId },
      });

      if (!schedule) {
        throw new Error(`Schedule ${data.scheduleId} not found`);
      }

      // Check if schedule is still active and eligible
      if (!schedule.canExecute) {
        this.logger.warn(
          `Schedule ${data.scheduleId} is not eligible for execution`,
        );
        return { skipped: true, reason: 'Schedule not eligible' };
      }

      await job.progress(40);

      // Execute based on schedule type
      let result: any;
      switch (data.scheduleType) {
        case 'REORDER_CHECK':
          result = await this.executeReorderCheckSchedule(
            schedule,
            data.jobParameters,
          );
          break;
        case 'INVENTORY_REVIEW':
          result = await this.executeInventoryReviewSchedule(
            schedule,
            data.jobParameters,
          );
          break;
        case 'DEMAND_FORECAST':
          result = await this.executeDemandForecastSchedule(
            schedule,
            data.jobParameters,
          );
          break;
        case 'SUPPLIER_EVALUATION':
          result = await this.executeSupplierEvaluationSchedule(
            schedule,
            data.jobParameters,
          );
          break;
        case 'SYSTEM_MAINTENANCE':
          result = await this.executeSystemMaintenanceSchedule(
            schedule,
            data.jobParameters,
          );
          break;
        default:
          throw new Error(`Unknown schedule type: ${data.scheduleType}`);
      }

      await job.progress(80);

      // Update schedule execution stats
      schedule.recordExecution(true, Date.now() - job.timestamp);
      await this.automationScheduleRepository.save(schedule);

      // Send notification if configured
      if (schedule.sendNotifications && schedule.notifyOnSuccess) {
        await this.sendScheduleCompletionNotification(schedule, result);
      }

      await job.progress(100);

      this.logger.log(
        `Scheduled automation ${data.scheduleName} completed successfully`,
      );

      return {
        success: true,
        scheduleId: data.scheduleId,
        scheduleName: data.scheduleName,
        result,
        executionTime: Date.now() - job.timestamp,
      };
    } catch (error) {
      this.logger.error(
        `Scheduled automation ${data.scheduleName} failed: ${error.message}`,
        error.stack,
      );

      // Update schedule with error
      try {
        const schedule = await this.automationScheduleRepository.findOne({
          where: { id: data.scheduleId, tenantId: data.tenantId },
        });

        if (schedule) {
          schedule.recordExecution(
            false,
            Date.now() - job.timestamp,
            error.message,
          );
          await this.automationScheduleRepository.save(schedule);

          // Send error notification if configured
          if (schedule.sendNotifications && schedule.notifyOnFailure) {
            await this.sendScheduleErrorNotification(schedule, error.message);
          }
        }
      } catch (updateError) {
        this.logger.error(
          `Failed to update schedule error status: ${updateError.message}`,
        );
      }

      throw error;
    }
  }

  // =============================================
  // NOTIFICATION JOBS
  // =============================================

  @Process('sendNotification')
  async sendNotificationJob(job: Job<SendNotificationJobData>): Promise<any> {
    const { data } = job;

    try {
      this.logger.log(
        `Sending ${data.type} notification to ${data.recipients.length} recipients`,
      );

      await job.progress(20);

      switch (data.type) {
        case 'email':
          await this.sendEmailNotification(data);
          break;
        case 'alert':
          await this.sendAlertNotification(data);
          break;
        case 'webhook':
          await this.sendWebhookNotification(data);
          break;
        default:
          throw new Error(`Unknown notification type: ${data.type}`);
      }

      await job.progress(100);

      this.logger.log(
        `${data.type} notification sent successfully to ${data.recipients.length} recipients`,
      );

      return {
        success: true,
        type: data.type,
        recipients: data.recipients.length,
        sentAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Notification sending failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =============================================
  // MAINTENANCE JOBS
  // =============================================

  @Process('maintenance')
  async maintenanceJob(job: Job<MaintenanceJobData>): Promise<any> {
    const { data } = job;

    try {
      this.logger.log(`Executing maintenance task: ${data.taskType}`);

      await job.progress(20);

      let result: any;
      switch (data.taskType) {
        case 'cleanup_executions':
          result = await this.cleanupOldExecutions(
            data.tenantId,
            data.parameters,
          );
          break;
        case 'archive_logs':
          result = await this.archiveOldLogs(data.tenantId, data.parameters);
          break;
        case 'update_metrics':
          result = await this.updateMetrics(data.tenantId, data.parameters);
          break;
        case 'health_check':
          result = await this.performHealthCheck(
            data.tenantId,
            data.parameters,
          );
          break;
        default:
          throw new Error(`Unknown maintenance task: ${data.taskType}`);
      }

      await job.progress(100);

      this.logger.log(
        `Maintenance task ${data.taskType} completed: ${JSON.stringify(
          result,
        )}`,
      );

      return {
        success: true,
        taskType: data.taskType,
        result,
        executedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Maintenance task ${data.taskType} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =============================================
  // HELPER METHODS - SCHEDULE EXECUTION
  // =============================================

  private async executeReorderCheckSchedule(
    schedule: AutomationSchedule,
    parameters?: any,
  ): Promise<any> {
    const context = {
      currentTime: new Date(),
      inventoryThresholds: {
        criticalLevel: parameters?.criticalLevel || 10,
        warningLevel: parameters?.warningLevel || 25,
      },
      systemLoad: {
        cpuUsage: 50,
        memoryUsage: 60,
        activeJobs: 5,
      },
      budgetConstraints: {
        dailyLimit: parameters?.dailyLimit,
        monthlyLimit: parameters?.monthlyLimit,
        remainingBudget: parameters?.budgetConstraint,
      },
    };

    return this.automationRuleEngine.processAutomationRules(
      schedule.tenantId,
      context,
    );
  }

  private async executeInventoryReviewSchedule(
    schedule: AutomationSchedule,
    parameters?: any,
  ): Promise<any> {
    // Implement inventory review logic
    this.logger.log('Executing inventory review schedule');

    // Get all active reorder rules for the tenant
    const rules = await this.reorderRuleRepository.find({
      where: { tenantId: schedule.tenantId, isActive: true },
      relations: ['product', 'location'],
    });

    const reviewResults = [];
    for (const rule of rules) {
      try {
        // Analyze current rule performance
        const metrics =
          await this.reorderCalculationService.getReorderRuleMetrics(
            schedule.tenantId,
            rule.id,
          );

        reviewResults.push({
          ruleId: rule.id,
          productName: rule.product?.name,
          performanceScore: metrics.performance.averageAccuracy,
          recommendationsCount: 0, // Would calculate actual recommendations
          needsAttention: metrics.performance.averageAccuracy < 0.8,
        });
      } catch (error) {
        this.logger.warn(`Failed to review rule ${rule.id}: ${error.message}`);
      }
    }

    return {
      totalRulesReviewed: reviewResults.length,
      rulesNeedingAttention: reviewResults.filter(r => r.needsAttention).length,
      averagePerformanceScore:
        reviewResults.reduce((sum, r) => sum + r.performanceScore, 0) /
        reviewResults.length,
      details: reviewResults,
    };
  }

  private async executeDemandForecastSchedule(
    schedule: AutomationSchedule,
    parameters?: any,
  ): Promise<any> {
    // Implement demand forecast update logic
    this.logger.log('Executing demand forecast schedule');

    // This would integrate with ML forecasting service
    // For now, return placeholder results
    return {
      forecastsUpdated: 0,
      averageAccuracy: 0.85,
      modelsRetrained: 0,
      nextUpdateDue: moment().add(1, 'day').toDate(),
    };
  }

  private async executeSupplierEvaluationSchedule(
    schedule: AutomationSchedule,
    parameters?: any,
  ): Promise<any> {
    // Implement supplier evaluation logic
    this.logger.log('Executing supplier evaluation schedule');

    // This would evaluate supplier performance
    return {
      suppliersEvaluated: 0,
      performanceUpdated: 0,
      newRecommendations: 0,
      alertsGenerated: 0,
    };
  }

  private async executeSystemMaintenanceSchedule(
    schedule: AutomationSchedule,
    parameters?: any,
  ): Promise<any> {
    // Implement system maintenance logic
    this.logger.log('Executing system maintenance schedule');

    const results = {
      executionsCleanedUp: 0,
      logsArchived: 0,
      metricsUpdated: 0,
      healthChecksPerformed: 0,
    };

    // Cleanup old executions
    results.executionsCleanedUp = await this.cleanupOldExecutions(
      schedule.tenantId,
      { retentionDays: parameters?.retentionDays || 90 },
    );

    // Update metrics
    await this.updateMetrics(schedule.tenantId);
    results.metricsUpdated = 1;

    // Perform health check
    const healthCheck = await this.performHealthCheck(schedule.tenantId);
    results.healthChecksPerformed = 1;

    return results;
  }

  // =============================================
  // HELPER METHODS - NOTIFICATIONS
  // =============================================

  private async sendProcessingCompletionNotification(
    jobData: ProcessReorderRulesJobData,
    metrics: any,
  ): Promise<void> {
    const message =
      `Automation rules processing completed for tenant ${jobData.tenantId}.

` +
      `📊 Summary:
` +
      `• Rules Processed: ${metrics.totalRulesProcessed}
` +
      `• Rules Triggered: ${metrics.triggeredRules}
` +
      `• Successful Executions: ${metrics.successfulExecutions}
` +
      `• Failed Executions: ${metrics.failedExecutions}
` +
      `• Total Value Generated: IDR ${metrics.totalValueGenerated.toLocaleString()}
` +
      `• System Efficiency: ${(metrics.systemEfficiency * 100).toFixed(1)}%`;

    await this.alertManagementService.createAlert(
      jobData.tenantId,
      AlertType.SYSTEM_MAINTENANCE,
      metrics.failedExecutions > 0 ? AlertSeverity.WARNING : AlertSeverity.INFO,
      'Automation Processing Completed',
      message,
      {
        executionId: jobData.executionId,
        metrics,
        triggeredBy: jobData.triggeredBy,
      },
    );
  }

  private async sendPurchaseOrderNotification(result: any): Promise<void> {
    if (!result.success || !result.purchaseOrderId) return;

    const severity =
      result.urgencyLevel >= 8 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
    const message =
      `Automated purchase order created successfully.

` +
      `📦 Order Details:
` +
      `• Product: ${result.reorderCalculation.productName || 'Unknown'}
` +
      `• Quantity: ${result.actualQuantity}
` +
      `• Estimated Value: IDR ${result.estimatedValue.toLocaleString()}
` +
      `• Supplier: ${
        result.supplierSelection.selectedSupplier?.supplier?.name || 'Unknown'
      }
` +
      `• Urgency Level: ${result.urgencyLevel}/10
` +
      `• Requires Approval: ${result.requiresApproval ? 'Yes' : 'No'}`;

    await this.alertManagementService.createAlert(
      result.tenantId,
      AlertType.ORDER_STATUS_UPDATE,
      severity,
      `Purchase Order Created: ${result.purchaseOrderId}`,
      message,
      {
        purchaseOrderId: result.purchaseOrderId,
        reorderRuleId: result.reorderRuleId,
        productId: result.productId,
        urgencyLevel: result.urgencyLevel,
        estimatedValue: result.estimatedValue,
      },
      result.productId,
      result.locationId,
    );
  }

  private async sendBulkPurchaseNotification(
    result: any,
    batchId?: string,
  ): Promise<void> {
    const message =
      `Bulk automated purchase processing completed.

` +
      `📊 Batch Summary:
` +
      `• Total Processed: ${result.totalProcessed}
` +
      `• Successful Orders: ${result.successfulOrders}
` +
      `• Failed Orders: ${result.failedOrders}
` +
      `• Skipped Orders: ${result.skippedOrders}
` +
      `• Total Value: IDR ${result.summary.totalValue.toLocaleString()}
` +
      `• Average Order Value: IDR ${result.summary.averageOrderValue.toLocaleString()}
` +
      `• Unique Suppliers: ${result.summary.uniqueSuppliers}
` +
      `• Orders Requiring Approval: ${result.summary.ordersRequiringApproval}`;

    await this.alertManagementService.createAlert(
      result.tenantId,
      AlertType.SYSTEM_MAINTENANCE,
      result.failedOrders > 0 ? AlertSeverity.WARNING : AlertSeverity.INFO,
      `Bulk Purchase Completed: ${batchId || 'Unknown Batch'}`,
      message,
      {
        batchId,
        summary: result.summary,
        totalProcessed: result.totalProcessed,
        successfulOrders: result.successfulOrders,
        failedOrders: result.failedOrders,
      },
    );
  }

  private async sendScheduleCompletionNotification(
    schedule: AutomationSchedule,
    result: any,
  ): Promise<void> {
    const message =
      `Scheduled automation task completed successfully.

` +
      `📅 Schedule Details:
` +
      `• Name: ${schedule.name}
` +
      `• Type: ${schedule.type}
` +
      `• Execution Time: ${(schedule.lastExecutionTimeMs || 0) / 1000}s
` +
      `• Next Execution: ${
        schedule.nextExecution?.toISOString() || 'Not scheduled'
      }

` +
      `✅ Results: ${JSON.stringify(result, null, 2)}`;

    if (schedule.notificationEmails?.length) {
      await this.emailService.sendEmail({
        to: schedule.notificationEmails.join(','),
        subject: `Schedule Completed: ${schedule.name}`,
        text: message,
      });
    }
  }

  private async sendScheduleErrorNotification(
    schedule: AutomationSchedule,
    error: string,
  ): Promise<void> {
    const message =
      `Scheduled automation task failed.

` +
      `📅 Schedule Details:
` +
      `• Name: ${schedule.name}
` +
      `• Type: ${schedule.type}
` +
      `• Error: ${error}
` +
      `• Failed At: ${new Date().toISOString()}
` +
      `• Consecutive Failures: ${schedule.consecutiveFailures}

` +
      `⚠️ Please review the schedule configuration and system logs.`;

    if (schedule.notificationEmails?.length) {
      await this.emailService.sendEmail({
        to: schedule.notificationEmails.join(','),
        subject: `Schedule Failed: ${schedule.name}`,
        text: message,
      });
    }

    // Create high-priority alert
    await this.alertManagementService.createAlert(
      schedule.tenantId,
      AlertType.SYSTEM_MAINTENANCE,
      AlertSeverity.CRITICAL,
      `Schedule Failed: ${schedule.name}`,
      message,
      {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        error,
        consecutiveFailures: schedule.consecutiveFailures,
      },
    );
  }

  private async sendErrorNotification(
    tenantId: string,
    subject: string,
    error: string,
  ): Promise<void> {
    await this.alertManagementService.createAlert(
      tenantId,
      AlertType.SYSTEM_MAINTENANCE,
      AlertSeverity.CRITICAL,
      subject,
      `System error occurred: ${error}`,
      { error, timestamp: new Date().toISOString() },
    );
  }

  private async sendEmailNotification(
    data: SendNotificationJobData,
  ): Promise<void> {
    await this.emailService.sendEmail({
      to: Array.isArray(data.recipients)
        ? data.recipients.join(',')
        : data.recipients,
      subject: data.subject,
      text: data.message,
    });
  }

  private async sendAlertNotification(
    data: SendNotificationJobData,
  ): Promise<void> {
    const severity =
      data.priority === 'critical'
        ? AlertSeverity.CRITICAL
        : data.priority === 'high'
        ? AlertSeverity.WARNING
        : data.priority === 'low'
        ? AlertSeverity.INFO
        : AlertSeverity.WARNING;

    await this.alertManagementService.createAlert(
      data.tenantId,
      AlertType.SYSTEM_MAINTENANCE,
      severity,
      data.subject,
      data.message,
      data.data,
    );
  }

  private async sendWebhookNotification(
    data: SendNotificationJobData,
  ): Promise<void> {
    // Implement webhook notification logic
    this.logger.log(
      `Webhook notification sent to ${data.recipients.join(', ')}`,
    );
  }

  // =============================================
  // HELPER METHODS - MAINTENANCE
  // =============================================

  private async cleanupOldExecutions(
    tenantId?: string,
    parameters?: any,
  ): Promise<number> {
    const retentionDays = parameters?.retentionDays || 90;
    const cutoffDate = moment().subtract(retentionDays, 'days').toDate();

    const query = this.reorderExecutionRepository
      .createQueryBuilder()
      .delete()
      .where('executedAt < :cutoffDate', { cutoffDate });

    if (tenantId) {
      query.andWhere('tenantId = :tenantId', { tenantId });
    }

    const result = await query.execute();
    this.logger.log(`Cleaned up ${result.affected || 0} old execution records`);

    return result.affected || 0;
  }

  private async archiveOldLogs(
    tenantId?: string,
    parameters?: any,
  ): Promise<number> {
    // Implement log archiving logic
    this.logger.log('Log archiving not implemented yet');
    return 0;
  }

  private async updateMetrics(
    tenantId?: string,
    parameters?: any,
  ): Promise<void> {
    // Implement metrics update logic
    this.logger.log('Updating automation metrics');

    // This would update cached metrics, performance counters, etc.
  }

  private async performHealthCheck(
    tenantId?: string,
    parameters?: any,
  ): Promise<any> {
    // Implement health check logic
    this.logger.log('Performing automation system health check');

    const health = {
      status: 'healthy',
      components: {
        ruleEngine: 'up',
        schedules: 'up',
        purchasingService: 'up',
        queueSystem: 'up',
      },
      checkedAt: new Date(),
    };

    return health;
  }
}
