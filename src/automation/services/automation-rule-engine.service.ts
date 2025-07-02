import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as moment from 'moment-timezone';

import { ReorderRule, ReorderTrigger, ReorderStatus } from '../entities/reorder-rule.entity';
import { AutomationSchedule, ScheduleType, ScheduleStatus } from '../entities/automation-schedule.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Product } from '../../products/entities/product.entity';
import { AutomatedPurchasingService } from './automated-purchasing.service';

export interface RuleEvaluationContext {
  tenantId: string;
  currentTime: Date;
  inventoryThresholds: {
    criticalLevel: number; // % of reorder point
    warningLevel: number; // % of reorder point
  };
  systemLoad: {
    cpuUsage: number;
    memoryUsage: number;
    activeJobs: number;
  };
  budgetConstraints: {
    dailyLimit?: number;
    monthlyLimit?: number;
    remainingBudget?: number;
  };
}

export interface TriggerEvaluationResult {
  ruleId: string;
  shouldTrigger: boolean;
  triggerReason: string;
  urgencyLevel: number; // 0-10
  confidence: number; // 0-1
  estimatedValue?: number;
  blockers: string[];
  warnings: string[];
  nextEvaluationTime?: Date;
}

export interface RuleExecutionPlan {
  tenantId: string;
  totalRules: number;
  eligibleRules: TriggerEvaluationResult[];
  executionOrder: string[]; // Rule IDs in execution order
  estimatedTotalValue: number;
  estimatedExecutionTime: number; // milliseconds
  resourceRequirements: {
    maxConcurrentJobs: number;
    estimatedMemoryUsage: number;
  };
  riskAssessment: {
    highRiskRules: string[];
    budgetExceedanceRisk: number; // 0-1
    systemOverloadRisk: number; // 0-1
  };
}

export interface RuleEngineMetrics {
  totalRulesProcessed: number;
  triggeredRules: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedRules: number;
  averageProcessingTime: number;
  totalValueGenerated: number;
  systemEfficiency: number; // 0-1
}

@Injectable()
export class AutomationRuleEngine {
  private readonly logger = new Logger(AutomationRuleEngine.name);
  private readonly processingState = new Map<string, boolean>(); // Track processing state per tenant

  constructor(
    @InjectRepository(ReorderRule)
    private readonly reorderRuleRepository: Repository<ReorderRule>,
    @InjectRepository(AutomationSchedule)
    private readonly automationScheduleRepository: Repository<AutomationSchedule>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectQueue('automation')
    private readonly automationQueue: Queue,
    private readonly automatedPurchasingService: AutomatedPurchasingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Main entry point for processing automation rules
   */
  async processAutomationRules(tenantId: string, context?: Partial<RuleEvaluationContext>): Promise<RuleEngineMetrics> {
    const startTime = Date.now();
    
    // Prevent concurrent processing for the same tenant
    if (this.processingState.get(tenantId)) {
      this.logger.warn(`Automation rules already processing for tenant ${tenantId}`);
      return this.createEmptyMetrics();
    }

    this.processingState.set(tenantId, true);

    try {
      this.logger.log(`Starting automation rule processing for tenant ${tenantId}`);

      // Build evaluation context
      const evaluationContext = await this.buildEvaluationContext(tenantId, context);

      // Get active reorder rules
      const activeRules = await this.getActiveReorderRules(tenantId);
      
      if (activeRules.length === 0) {
        this.logger.log(`No active reorder rules found for tenant ${tenantId}`);
        return this.createEmptyMetrics();
      }

      // Evaluate each rule for trigger conditions
      const triggerResults = await this.evaluateReorderTriggers(activeRules, evaluationContext);
      
      // Create execution plan
      const executionPlan = this.createExecutionPlan(triggerResults, evaluationContext);
      
      // Execute rules according to plan
      const executionResults = await this.executeRulePlan(executionPlan);
      
      // Calculate and return metrics
      const metrics = this.calculateMetrics(executionResults, startTime);
      
      // Emit completion event
      this.eventEmitter.emit('automation.rules.processed', {
        tenantId,
        metrics,
        executionPlan,
      });

      this.logger.log(`Automation rule processing completed for tenant ${tenantId}. Processed: ${metrics.totalRulesProcessed}, Triggered: ${metrics.triggeredRules}`);
      
      return metrics;

    } catch (error) {
      this.logger.error(`Error processing automation rules for tenant ${tenantId}: ${error.message}`, error.stack);
      
      // Emit error event
      this.eventEmitter.emit('automation.rules.error', {
        tenantId,
        error: error.message,
      });

      return this.createErrorMetrics(error.message);
      
    } finally {
      this.processingState.delete(tenantId);
    }
  }

  /**
   * Process scheduled automation jobs
   */
  async processScheduledAutomation(scheduleId?: string): Promise<void> {
    try {
      let schedules: AutomationSchedule[];
      
      if (scheduleId) {
        const schedule = await this.automationScheduleRepository.findOne({
          where: { id: scheduleId },
        });
        schedules = schedule ? [schedule] : [];
      } else {
        // Get all due schedules
        schedules = await this.automationScheduleRepository
          .createQueryBuilder('schedule')
          .where('schedule.shouldExecute = true')
          .andWhere('schedule.canExecute = true')
          .orderBy('schedule.priority', 'DESC')
          .getMany();
      }

      for (const schedule of schedules) {
        await this.executeScheduledJob(schedule);
      }

    } catch (error) {
      this.logger.error(`Error processing scheduled automation: ${error.message}`, error.stack);
    }
  }

  /**
   * Evaluate trigger conditions for reorder rules
   */
  private async evaluateReorderTriggers(
    rules: ReorderRule[],
    context: RuleEvaluationContext
  ): Promise<TriggerEvaluationResult[]> {
    const results: TriggerEvaluationResult[] = [];

    for (const rule of rules) {
      try {
        const result = await this.evaluateSingleRuleTrigger(rule, context);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error evaluating rule ${rule.id}: ${error.message}`);
        results.push({
          ruleId: rule.id,
          shouldTrigger: false,
          triggerReason: `Evaluation error: ${error.message}`,
          urgencyLevel: 0,
          confidence: 0,
          blockers: [error.message],
          warnings: [],
        });
      }
    }

    return results;
  }

  /**
   * Evaluate a single reorder rule trigger
   */
  private async evaluateSingleRuleTrigger(
    rule: ReorderRule,
    context: RuleEvaluationContext
  ): Promise<TriggerEvaluationResult> {
    this.logger.debug(`Evaluating trigger for rule ${rule.id} (${rule.name})`);

    // Get inventory item
    const inventoryItem = await this.inventoryItemRepository.findOne({
      where: {
        tenantId: rule.tenantId,
        productId: rule.productId,
        locationId: rule.locationId,
      },
    });

    if (!inventoryItem) {
      return {
        ruleId: rule.id,
        shouldTrigger: false,
        triggerReason: 'Inventory item not found',
        urgencyLevel: 0,
        confidence: 0,
        blockers: ['Inventory item not found'],
        warnings: [],
      };
    }

    // Check basic eligibility
    const eligibilityCheck = this.checkRuleEligibility(rule, context);
    if (!eligibilityCheck.eligible) {
      return {
        ruleId: rule.id,
        shouldTrigger: false,
        triggerReason: eligibilityCheck.reason,
        urgencyLevel: 0,
        confidence: 0,
        blockers: eligibilityCheck.blockers,
        warnings: eligibilityCheck.warnings,
      };
    }

    // Evaluate specific trigger conditions
    const triggerEvaluation = await this.evaluateTriggerConditions(rule, inventoryItem, context);
    
    // Calculate urgency level
    const urgencyLevel = this.calculateUrgencyLevel(rule, inventoryItem, context);
    
    // Calculate confidence
    const confidence = this.calculateTriggerConfidence(rule, inventoryItem, triggerEvaluation);
    
    // Estimate order value
    const estimatedValue = this.estimateOrderValue(rule, inventoryItem);

    return {
      ruleId: rule.id,
      shouldTrigger: triggerEvaluation.shouldTrigger,
      triggerReason: triggerEvaluation.reason,
      urgencyLevel,
      confidence,
      estimatedValue,
      blockers: triggerEvaluation.blockers,
      warnings: triggerEvaluation.warnings,
      nextEvaluationTime: this.calculateNextEvaluationTime(rule, triggerEvaluation),
    };
  }

  /**
   * Check if rule is eligible for execution
   */
  private checkRuleEligibility(
    rule: ReorderRule,
    context: RuleEvaluationContext
  ): { eligible: boolean; reason: string; blockers: string[]; warnings: string[] } {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Basic rule status checks
    if (!rule.isEligibleForExecution) {
      blockers.push('Rule not eligible for execution');
    }

    if (!rule.isDue) {
      return {
        eligible: false,
        reason: 'Rule not due for execution',
        blockers: ['Not due for execution'],
        warnings: [],
      };
    }

    if (rule.hasRecentErrors) {
      blockers.push('Rule has recent errors - requires manual intervention');
    }

    // Budget checks
    if (rule.budgetLimit && rule.currentMonthSpend >= rule.budgetLimit) {
      blockers.push('Monthly budget limit exceeded');
    }

    if (context.budgetConstraints.remainingBudget !== undefined) {
      const estimatedValue = this.estimateBasicOrderValue(rule);
      if (estimatedValue > context.budgetConstraints.remainingBudget) {
        blockers.push('Insufficient remaining budget');
      }
    }

    // System load checks
    if (context.systemLoad.cpuUsage > 90) {
      warnings.push('High system CPU usage - may delay execution');
    }

    if (context.systemLoad.activeJobs > 100) {
      warnings.push('High job queue load - execution may be delayed');
    }

    // Time-based restrictions (business hours, maintenance windows, etc.)
    const timeRestrictions = this.checkTimeRestrictions(rule, context.currentTime);
    if (timeRestrictions.blocked) {
      blockers.push(timeRestrictions.reason);
    }

    return {
      eligible: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : 'Rule eligible for execution',
      blockers,
      warnings,
    };
  }

  /**
   * Evaluate specific trigger conditions based on rule type
   */
  private async evaluateTriggerConditions(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    context: RuleEvaluationContext
  ): Promise<{
    shouldTrigger: boolean;
    reason: string;
    blockers: string[];
    warnings: string[];
    details: any;
  }> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let shouldTrigger = false;
    let reason = '';
    const details: any = {};

    switch (rule.trigger) {
      case ReorderTrigger.STOCK_LEVEL:
        const stockEvaluation = this.evaluateStockLevelTrigger(rule, inventoryItem, context);
        shouldTrigger = stockEvaluation.triggered;
        reason = stockEvaluation.reason;
        details.stockLevel = stockEvaluation.details;
        break;

      case ReorderTrigger.DAYS_OF_SUPPLY:
        const daysSupplyEvaluation = this.evaluateDaysOfSupplyTrigger(rule, inventoryItem, context);
        shouldTrigger = daysSupplyEvaluation.triggered;
        reason = daysSupplyEvaluation.reason;
        details.daysOfSupply = daysSupplyEvaluation.details;
        break;

      case ReorderTrigger.SCHEDULED:
        const scheduledEvaluation = this.evaluateScheduledTrigger(rule, context);
        shouldTrigger = scheduledEvaluation.triggered;
        reason = scheduledEvaluation.reason;
        details.schedule = scheduledEvaluation.details;
        break;

      case ReorderTrigger.DEMAND_FORECAST:
        const forecastEvaluation = await this.evaluateDemandForecastTrigger(rule, inventoryItem, context);
        shouldTrigger = forecastEvaluation.triggered;
        reason = forecastEvaluation.reason;
        details.forecast = forecastEvaluation.details;
        break;

      case ReorderTrigger.COMBINED:
        const combinedEvaluation = await this.evaluateCombinedTrigger(rule, inventoryItem, context);
        shouldTrigger = combinedEvaluation.triggered;
        reason = combinedEvaluation.reason;
        details.combined = combinedEvaluation.details;
        break;

      default:
        blockers.push(`Unknown trigger type: ${rule.trigger}`);
    }

    return { shouldTrigger, reason, blockers, warnings, details };
  }

  // Trigger evaluation methods
  private evaluateStockLevelTrigger(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    context: RuleEvaluationContext
  ): { triggered: boolean; reason: string; details: any } {
    const currentStock = inventoryItem.quantityAvailable;
    const reorderPoint = rule.reorderPoint;
    
    if (currentStock <= 0) {
      return {
        triggered: true,
        reason: 'Stock depleted - critical reorder needed',
        details: { currentStock, reorderPoint, deficit: Math.abs(currentStock) },
      };
    }

    if (currentStock <= reorderPoint) {
      return {
        triggered: true,
        reason: `Stock level (${currentStock}) below reorder point (${reorderPoint})`,
        details: { currentStock, reorderPoint, deficit: reorderPoint - currentStock },
      };
    }

    // Check critical and warning levels
    const criticalLevel = reorderPoint * (1 + context.inventoryThresholds.criticalLevel / 100);
    const warningLevel = reorderPoint * (1 + context.inventoryThresholds.warningLevel / 100);

    if (currentStock <= criticalLevel) {
      return {
        triggered: true,
        reason: `Stock approaching critical level (${currentStock} <= ${criticalLevel})`,
        details: { currentStock, reorderPoint, criticalLevel, urgency: 'high' },
      };
    }

    if (currentStock <= warningLevel) {
      return {
        triggered: false, // Warning level - don't trigger yet but log
        reason: `Stock approaching warning level (${currentStock} <= ${warningLevel})`,
        details: { currentStock, reorderPoint, warningLevel, urgency: 'medium' },
      };
    }

    return {
      triggered: false,
      reason: `Stock level adequate (${currentStock} > ${reorderPoint})`,
      details: { currentStock, reorderPoint, status: 'adequate' },
    };
  }

  private evaluateDaysOfSupplyTrigger(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    context: RuleEvaluationContext
  ): { triggered: boolean; reason: string; details: any } {
    const currentStock = inventoryItem.quantityAvailable;
    const dailyDemand = rule.annualDemand ? rule.annualDemand / 365 : 1;
    const daysOfSupply = dailyDemand > 0 ? currentStock / dailyDemand : Infinity;
    const targetDaysOfSupply = rule.safetyStockDays || 14;

    if (daysOfSupply <= 0) {
      return {
        triggered: true,
        reason: 'No days of supply remaining - immediate reorder required',
        details: { daysOfSupply: 0, targetDaysOfSupply, dailyDemand, currentStock },
      };
    }

    if (daysOfSupply <= targetDaysOfSupply) {
      return {
        triggered: true,
        reason: `Days of supply (${daysOfSupply.toFixed(1)}) below target (${targetDaysOfSupply})`,
        details: { daysOfSupply, targetDaysOfSupply, dailyDemand, currentStock },
      };
    }

    return {
      triggered: false,
      reason: `Days of supply adequate (${daysOfSupply.toFixed(1)} > ${targetDaysOfSupply})`,
      details: { daysOfSupply, targetDaysOfSupply, dailyDemand, currentStock },
    };
  }

  private evaluateScheduledTrigger(
    rule: ReorderRule,
    context: RuleEvaluationContext
  ): { triggered: boolean; reason: string; details: any } {
    if (!rule.nextReviewDate) {
      return {
        triggered: false,
        reason: 'No scheduled review date set',
        details: { scheduled: false },
      };
    }

    const now = context.currentTime;
    const isScheduled = rule.nextReviewDate <= now;

    return {
      triggered: isScheduled,
      reason: isScheduled 
        ? `Scheduled review time reached (${rule.nextReviewDate.toISOString()})`
        : `Not yet scheduled (next review: ${rule.nextReviewDate.toISOString()})`,
      details: {
        nextReviewDate: rule.nextReviewDate,
        currentTime: now,
        scheduled: isScheduled,
      },
    };
  }

  private async evaluateDemandForecastTrigger(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    context: RuleEvaluationContext
  ): Promise<{ triggered: boolean; reason: string; details: any }> {
    if (!rule.useForecastingData) {
      return {
        triggered: false,
        reason: 'Demand forecasting not enabled for this rule',
        details: { forecastingEnabled: false },
      };
    }

    // This would integrate with the ML forecasting service
    // For now, simulate forecast-based triggering
    const currentStock = inventoryItem.quantityAvailable;
    const forecastHorizon = rule.forecastHorizonDays || 30;
    const leadTimeDays = rule.leadTimeDays || 7;
    
    // Simulate forecast demand (in real implementation, this would come from ML service)
    const simulatedForecastDemand = rule.annualDemand 
      ? (rule.annualDemand / 365) * (leadTimeDays + forecastHorizon)
      : currentStock * 0.5; // Fallback simulation

    const forecastThreshold = simulatedForecastDemand * rule.forecastConfidenceThreshold;

    const triggered = currentStock <= forecastThreshold;

    return {
      triggered,
      reason: triggered
        ? `Forecasted demand (${simulatedForecastDemand.toFixed(1)}) exceeds available stock`
        : `Stock adequate for forecasted demand`,
      details: {
        currentStock,
        forecastDemand: simulatedForecastDemand,
        forecastThreshold,
        forecastHorizon,
        confidenceThreshold: rule.forecastConfidenceThreshold,
      },
    };
  }

  private async evaluateCombinedTrigger(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    context: RuleEvaluationContext
  ): Promise<{ triggered: boolean; reason: string; details: any }> {
    // Evaluate multiple trigger conditions and combine results
    const stockLevel = this.evaluateStockLevelTrigger(rule, inventoryItem, context);
    const daysSupply = this.evaluateDaysOfSupplyTrigger(rule, inventoryItem, context);
    const scheduled = this.evaluateScheduledTrigger(rule, context);
    const forecast = await this.evaluateDemandForecastTrigger(rule, inventoryItem, context);

    const triggers = [stockLevel, daysSupply, scheduled, forecast];
    const activeTriggers = triggers.filter(t => t.triggered);
    
    // Combined trigger fires if any condition is met
    const triggered = activeTriggers.length > 0;
    
    const reasons = activeTriggers.map(t => t.reason);
    const combinedReason = triggered 
      ? `Multiple triggers active: ${reasons.join('; ')}`
      : 'No trigger conditions met';

    return {
      triggered,
      reason: combinedReason,
      details: {
        stockLevel: stockLevel.details,
        daysSupply: daysSupply.details,
        scheduled: scheduled.details,
        forecast: forecast.details,
        activeTriggers: activeTriggers.length,
        totalEvaluated: triggers.length,
      },
    };
  }

  // Helper methods
  private async buildEvaluationContext(
    tenantId: string,
    context?: Partial<RuleEvaluationContext>
  ): Promise<RuleEvaluationContext> {
    // Get current system metrics
    const systemLoad = {
      cpuUsage: 45, // Would be actual system metrics
      memoryUsage: 60,
      activeJobs: await this.automationQueue.getActive().then(jobs => jobs.length),
    };

    // Get budget information for tenant
    const budgetConstraints = {
      remainingBudget: context?.budgetConstraints?.remainingBudget,
      dailyLimit: context?.budgetConstraints?.dailyLimit,
      monthlyLimit: context?.budgetConstraints?.monthlyLimit,
    };

    return {
      tenantId,
      currentTime: new Date(),
      inventoryThresholds: {
        criticalLevel: 10, // 10% above reorder point
        warningLevel: 25,  // 25% above reorder point
      },
      systemLoad,
      budgetConstraints,
      ...context,
    };
  }

  private async getActiveReorderRules(tenantId: string): Promise<ReorderRule[]> {
    return this.reorderRuleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.product', 'product')
      .leftJoinAndSelect('rule.location', 'location')
      .where('rule.tenantId = :tenantId', { tenantId })
      .andWhere('rule.isActive = true')
      .andWhere('rule.status = :status', { status: ReorderStatus.ACTIVE })
      .andWhere('rule.isPaused = false')
      .orderBy('rule.priority', 'DESC')
      .getMany();
  }

  private calculateUrgencyLevel(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    context: RuleEvaluationContext
  ): number {
    let urgency = 1; // Base urgency

    const currentStock = inventoryItem.quantityAvailable;
    const reorderPoint = rule.reorderPoint;

    // Stock level urgency
    if (currentStock <= 0) {
      urgency = 10; // Critical
    } else if (currentStock <= reorderPoint * 0.25) {
      urgency = 9; // Very urgent
    } else if (currentStock <= reorderPoint * 0.5) {
      urgency = 7; // Urgent
    } else if (currentStock <= reorderPoint) {
      urgency = 5; // Moderate
    } else if (currentStock <= reorderPoint * 1.1) {
      urgency = 3; // Low
    }

    // Days of supply urgency
    const dailyDemand = rule.annualDemand ? rule.annualDemand / 365 : 1;
    const daysOfSupply = dailyDemand > 0 ? currentStock / dailyDemand : Infinity;
    const leadTimeDays = rule.leadTimeDays || 7;

    if (daysOfSupply <= leadTimeDays) {
      urgency = Math.max(urgency, 8); // Will stockout during lead time
    } else if (daysOfSupply <= leadTimeDays * 1.5) {
      urgency = Math.max(urgency, 6); // Close to lead time
    }

    // Time-based urgency (end of business day, weekend, etc.)
    const hour = context.currentTime.getHours();
    const dayOfWeek = context.currentTime.getDay();
    
    if (hour >= 16 || dayOfWeek === 5) { // After 4 PM or Friday
      urgency += 1; // Slight urgency increase for timing
    }

    return Math.min(10, Math.max(1, Math.round(urgency)));
  }

  private calculateTriggerConfidence(
    rule: ReorderRule,
    inventoryItem: InventoryItem,
    triggerEvaluation: any
  ): number {
    let confidence = 0.8; // Base confidence

    // Reduce confidence for rules with limited order history
    if (rule.totalOrdersGenerated < 5) {
      confidence *= 0.7;
    }

    // Reduce confidence for rules with recent errors
    if (rule.consecutiveErrors > 0) {
      confidence *= 0.8;
    }

    // Increase confidence for rules with good performance
    if (rule.averageAccuracy && rule.averageAccuracy > 0.9) {
      confidence *= 1.1;
    }

    // Adjust based on data quality
    const dataAge = rule.lastExecutedAt 
      ? (Date.now() - rule.lastExecutedAt.getTime()) / (24 * 60 * 60 * 1000) // days
      : 365;
    
    if (dataAge > 30) {
      confidence *= 0.9; // Reduce for old data
    }

    return Math.min(1, Math.max(0.1, confidence));
  }

  private estimateOrderValue(rule: ReorderRule, inventoryItem: InventoryItem): number {
    const orderQuantity = rule.reorderQuantity;
    const unitCost = rule.unitCost || 0;
    return orderQuantity * unitCost;
  }

  private estimateBasicOrderValue(rule: ReorderRule): number {
    return rule.reorderQuantity * (rule.unitCost || 0);
  }

  private calculateNextEvaluationTime(
    rule: ReorderRule,
    triggerEvaluation: any
  ): Date | undefined {
    if (triggerEvaluation.shouldTrigger) {
      return undefined; // No next evaluation needed if triggered
    }

    // Calculate based on trigger type and current conditions
    const now = new Date();
    let nextTime: Date;

    switch (rule.trigger) {
      case ReorderTrigger.SCHEDULED:
        nextTime = rule.nextReviewDate || moment(now).add(1, 'day').toDate();
        break;
      case ReorderTrigger.STOCK_LEVEL:
      case ReorderTrigger.DAYS_OF_SUPPLY:
        // More frequent checks for stock-based triggers
        nextTime = moment(now).add(4, 'hours').toDate();
        break;
      case ReorderTrigger.DEMAND_FORECAST:
        // Daily evaluation for forecast-based triggers
        nextTime = moment(now).add(1, 'day').toDate();
        break;
      default:
        nextTime = moment(now).add(6, 'hours').toDate();
    }

    return nextTime;
  }

  private checkTimeRestrictions(
    rule: ReorderRule,
    currentTime: Date
  ): { blocked: boolean; reason: string } {
    // Implement business hours, maintenance windows, etc.
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();

    // Example: Block during maintenance window (2-4 AM)
    if (hour >= 2 && hour < 4) {
      return {
        blocked: true,
        reason: 'System maintenance window - execution blocked',
      };
    }

    // Example: Block on weekends for non-urgent rules
    if ((dayOfWeek === 0 || dayOfWeek === 6) && !rule.isUrgent) {
      return {
        blocked: true,
        reason: 'Weekend restriction for non-urgent rules',
      };
    }

    return { blocked: false, reason: '' };
  }

  private createExecutionPlan(
    triggerResults: TriggerEvaluationResult[],
    context: RuleEvaluationContext
  ): RuleExecutionPlan {
    const eligibleRules = triggerResults.filter(r => r.shouldTrigger && r.blockers.length === 0);
    
    // Sort by urgency and confidence
    eligibleRules.sort((a, b) => {
      const scoreA = a.urgencyLevel * a.confidence;
      const scoreB = b.urgencyLevel * b.confidence;
      return scoreB - scoreA;
    });

    const executionOrder = eligibleRules.map(r => r.ruleId);
    const estimatedTotalValue = eligibleRules.reduce((sum, r) => sum + (r.estimatedValue || 0), 0);
    const estimatedExecutionTime = eligibleRules.length * 30000; // 30 seconds per rule estimate

    const highRiskRules = eligibleRules
      .filter(r => r.urgencyLevel >= 8 || r.confidence < 0.6)
      .map(r => r.ruleId);

    return {
      tenantId: context.tenantId,
      totalRules: triggerResults.length,
      eligibleRules,
      executionOrder,
      estimatedTotalValue,
      estimatedExecutionTime,
      resourceRequirements: {
        maxConcurrentJobs: Math.min(5, eligibleRules.length), // Limit concurrency
        estimatedMemoryUsage: eligibleRules.length * 50, // MB estimate
      },
      riskAssessment: {
        highRiskRules,
        budgetExceedanceRisk: context.budgetConstraints.remainingBudget 
          ? Math.min(1, estimatedTotalValue / context.budgetConstraints.remainingBudget)
          : 0,
        systemOverloadRisk: context.systemLoad.activeJobs / 100, // Assume 100 is max capacity
      },
    };
  }

  private async executeRulePlan(plan: RuleExecutionPlan): Promise<any[]> {
    const results = [];

    // Execute rules in batches to control system load
    const batchSize = Math.min(3, plan.resourceRequirements.maxConcurrentJobs);
    
    for (let i = 0; i < plan.executionOrder.length; i += batchSize) {
      const batch = plan.executionOrder.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (ruleId) => {
        try {
          const result = await this.automatedPurchasingService.executeAutomatedPurchase({
            reorderRuleId: ruleId,
            tenantId: plan.tenantId,
          });
          return result;
        } catch (error) {
          this.logger.error(`Failed to execute rule ${ruleId}: ${error.message}`);
          return { success: false, ruleId, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches if needed
      if (i + batchSize < plan.executionOrder.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return results;
  }

  private async executeScheduledJob(schedule: AutomationSchedule): Promise<void> {
    this.logger.log(`Executing scheduled automation job: ${schedule.name} (${schedule.type})`);

    try {
      // Update schedule execution status
      schedule.updateExecutionStats(0, false); // Will be updated on completion
      await this.automationScheduleRepository.save(schedule);

      // Execute based on schedule type
      switch (schedule.type) {
        case ScheduleType.REORDER_CHECK:
          await this.executeReorderCheckJob(schedule);
          break;
        case ScheduleType.INVENTORY_REVIEW:
          await this.executeInventoryReviewJob(schedule);
          break;
        case ScheduleType.DEMAND_FORECAST:
          await this.executeDemandForecastJob(schedule);
          break;
        case ScheduleType.SUPPLIER_EVALUATION:
          await this.executeSupplierEvaluationJob(schedule);
          break;
        default:
          throw new Error(`Unknown schedule type: ${schedule.type}`);
      }

      // Mark as successful
      schedule.updateExecutionStats(Date.now() - schedule.lastExecution!.getTime(), true);
      await this.automationScheduleRepository.save(schedule);

    } catch (error) {
      this.logger.error(`Scheduled job ${schedule.id} failed: ${error.message}`);
      
      // Mark as failed
      schedule.updateExecutionStats(
        Date.now() - schedule.lastExecution!.getTime(),
        false,
        error.message
      );
      await this.automationScheduleRepository.save(schedule);
    }
  }

  private async executeReorderCheckJob(schedule: AutomationSchedule): Promise<void> {
    // Execute automation rules for specified tenants or products
    const tenantId = schedule.jobParameters?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant ID required for reorder check job');
    }

    await this.processAutomationRules(tenantId, schedule.jobParameters);
  }

  private async executeInventoryReviewJob(schedule: AutomationSchedule): Promise<void> {
    // Implement inventory review logic
    this.logger.log('Executing inventory review job');
  }

  private async executeDemandForecastJob(schedule: AutomationSchedule): Promise<void> {
    // Implement demand forecast update logic
    this.logger.log('Executing demand forecast job');
  }

  private async executeSupplierEvaluationJob(schedule: AutomationSchedule): Promise<void> {
    // Implement supplier evaluation logic
    this.logger.log('Executing supplier evaluation job');
  }

  private calculateMetrics(executionResults: any[], startTime: number): RuleEngineMetrics {
    const totalRulesProcessed = executionResults.length;
    const successfulExecutions = executionResults.filter(r => r.success).length;
    const failedExecutions = executionResults.filter(r => !r.success).length;
    const triggeredRules = executionResults.filter(r => r.shouldCreatePurchaseOrder).length;
    const skippedRules = totalRulesProcessed - triggeredRules - failedExecutions;

    const totalValueGenerated = executionResults
      .filter(r => r.success && r.estimatedValue)
      .reduce((sum, r) => sum + r.estimatedValue, 0);

    const averageProcessingTime = totalRulesProcessed > 0 
      ? (Date.now() - startTime) / totalRulesProcessed 
      : 0;

    const systemEfficiency = totalRulesProcessed > 0 
      ? successfulExecutions / totalRulesProcessed 
      : 0;

    return {
      totalRulesProcessed,
      triggeredRules,
      successfulExecutions,
      failedExecutions,
      skippedRules,
      averageProcessingTime,
      totalValueGenerated,
      systemEfficiency,
    };
  }

  private createEmptyMetrics(): RuleEngineMetrics {
    return {
      totalRulesProcessed: 0,
      triggeredRules: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      skippedRules: 0,
      averageProcessingTime: 0,
      totalValueGenerated: 0,
      systemEfficiency: 0,
    };
  }

  private createErrorMetrics(errorMessage: string): RuleEngineMetrics {
    return {
      totalRulesProcessed: 0,
      triggeredRules: 0,
      successfulExecutions: 0,
      failedExecutions: 1,
      skippedRules: 0,
      averageProcessingTime: 0,
      totalValueGenerated: 0,
      systemEfficiency: 0,
    };
  }
}