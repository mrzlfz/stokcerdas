import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment-timezone';

import { MLModel, ModelStatus, ModelType } from '../entities/ml-model.entity';
import { TrainingJob, JobStatus, TrainingJobType } from '../entities/training-job.entity';
import { Prediction } from '../entities/prediction.entity';
import { ModelTrainingService } from './model-training.service';
import { AccuracyTrackingService, RetrainingTrigger } from './accuracy-tracking.service';

export interface RetrainingSchedule {
  modelId: string;
  tenantId: string;
  scheduledAt: Date;
  triggerType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  autoExecute: boolean;
  estimatedDuration: number; // in minutes
  resourceRequirements: {
    cpu: string;
    memory: string;
    estimatedCost: number;
  };
}

export interface RetrainingPolicy {
  tenantId: string;
  modelType: ModelType;
  triggers: {
    accuracyThreshold: number; // MAPE threshold for triggering retraining
    biasThreshold: number; // Bias threshold
    timeBasedInterval: number; // Days between automatic retraining
    dataVolumeThreshold: number; // New data points threshold
  };
  schedule: {
    allowedHours: number[]; // Hours when retraining is allowed (0-23)
    allowedDays: number[]; // Days of week (0-6, 0=Sunday)
    maxConcurrentJobs: number;
  };
  approval: {
    requiresApproval: boolean;
    approvers: string[]; // User IDs who can approve retraining
    autoApproveThreshold: number; // Auto-approve if degradation > threshold
  };
}

@Injectable()
export class ModelRetrainingService {
  private readonly logger = new Logger(ModelRetrainingService.name);
  private readonly retrainingSchedule = new Map<string, RetrainingSchedule>();

  constructor(
    @InjectRepository(MLModel)
    private mlModelRepo: Repository<MLModel>,
    
    @InjectRepository(TrainingJob)
    private trainingJobRepo: Repository<TrainingJob>,
    
    @InjectRepository(Prediction)
    private predictionRepo: Repository<Prediction>,
    
    @InjectQueue('ml-training')
    private trainingQueue: Queue,
    
    private modelTrainingService: ModelTrainingService,
    private accuracyTrackingService: AccuracyTrackingService,
    private configService: ConfigService,
  ) {
    // Initialize retraining schedules from database on startup
    this.initializeRetrainingSchedules();
  }

  /**
   * Handle retraining trigger events
   */
  @OnEvent('ml.retraining.trigger')
  async handleRetrainingTrigger(event: {
    tenantId: string;
    trigger: RetrainingTrigger;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`Handling retraining trigger for model ${event.trigger.modelId}`);

    try {
      const model = await this.mlModelRepo.findOne({
        where: { id: event.trigger.modelId, tenantId: event.tenantId },
      });

      if (!model) {
        this.logger.error(`Model ${event.trigger.modelId} not found`);
        return;
      }

      // Get retraining policy for this tenant/model type
      const policy = await this.getRetrainingPolicy(event.tenantId, model.modelType);

      // Check if retraining should be scheduled
      const shouldSchedule = await this.shouldScheduleRetraining(event.trigger, policy);

      if (shouldSchedule) {
        await this.scheduleRetraining(event.tenantId, event.trigger, policy);
      } else {
        this.logger.log(`Retraining trigger ignored for model ${event.trigger.modelId} due to policy restrictions`);
      }

    } catch (error) {
      this.logger.error(`Failed to handle retraining trigger: ${error.message}`, error.stack);
    }
  }

  /**
   * Schedule model retraining
   */
  async scheduleRetraining(
    tenantId: string,
    trigger: RetrainingTrigger,
    policy: RetrainingPolicy
  ): Promise<RetrainingSchedule> {
    this.logger.log(`Scheduling retraining for model ${trigger.modelId}`);

    const model = await this.mlModelRepo.findOne({
      where: { id: trigger.modelId, tenantId },
    });

    if (!model) {
      throw new Error(`Model ${trigger.modelId} not found`);
    }

    // Calculate scheduled time based on policy
    const scheduledAt = this.calculateScheduledTime(policy, trigger.priority);

    // Estimate resource requirements
    const resourceRequirements = this.estimateResourceRequirements(model.modelType, trigger.priority);

    // Check if approval is required
    const requiresApproval = policy.approval.requiresApproval && 
      trigger.triggerValue < policy.approval.autoApproveThreshold;

    const schedule: RetrainingSchedule = {
      modelId: trigger.modelId,
      tenantId,
      scheduledAt,
      triggerType: trigger.triggerType,
      priority: trigger.priority,
      autoExecute: !requiresApproval,
      estimatedDuration: this.estimateTrainingDuration(model.modelType),
      resourceRequirements,
    };

    // Store schedule
    this.retrainingSchedule.set(trigger.modelId, schedule);

    // Update model metadata
    model.metadata = {
      ...model.metadata,
      retrainingScheduled: true,
      scheduledAt: scheduledAt.toISOString(),
      triggerReason: trigger.description,
      requiresApproval,
    };
    await this.mlModelRepo.save(model);

    // If auto-execute is enabled, add to training queue
    if (schedule.autoExecute) {
      await this.queueRetrainingJob(schedule);
    } else {
      // Send notification for approval
      await this.sendApprovalNotification(tenantId, schedule, trigger);
    }

    this.logger.log(`Retraining scheduled for model ${trigger.modelId} at ${scheduledAt.toISOString()}`);
    return schedule;
  }

  /**
   * Execute model retraining
   */
  async executeRetraining(
    tenantId: string,
    modelId: string,
    approvedBy?: string
  ): Promise<string> {
    this.logger.log(`Executing retraining for model ${modelId}`);

    const schedule = this.retrainingSchedule.get(modelId);
    if (!schedule) {
      throw new Error(`No retraining schedule found for model ${modelId}`);
    }

    const model = await this.mlModelRepo.findOne({
      where: { id: modelId, tenantId },
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Create new training job
    const trainingJob = new TrainingJob();
    trainingJob.tenantId = tenantId;
    trainingJob.modelId = modelId;
    trainingJob.jobType = TrainingJobType.RETRAINING;
    trainingJob.priority = schedule.priority;
    trainingJob.trainingConfig = {
      dataSource: {
        from: model.trainingConfig?.trainingDataFrom || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
      validation: {
        splitRatio: 0.8,
        method: 'time_series' as const,
      },
      hyperparameters: model.hyperparameters || {},
      features: model.trainingConfig?.features || [],
      target: model.trainingConfig?.target || 'quantity',
    };
    trainingJob.estimatedDuration = schedule.estimatedDuration;
    
    trainingJob.start();
    const savedJob = await this.trainingJobRepo.save(trainingJob);

    // Update model status
    model.status = ModelStatus.TRAINING;
    model.metadata = {
      ...model.metadata,
      retrainingInProgress: true,
      retrainingJobId: savedJob.id,
      retrainingStartedAt: new Date().toISOString(),
      retrainingApprovedBy: approvedBy,
    };
    await this.mlModelRepo.save(model);

    // Add to training queue
    await this.trainingQueue.add('retrain-model', {
      tenantId,
      modelId,
      jobId: savedJob.id,
      trainingConfig: trainingJob.trainingConfig,
    }, {
      priority: this.getPriorityScore(schedule.priority),
      delay: Math.max(0, schedule.scheduledAt.getTime() - Date.now()),
    });

    // Remove from schedule
    this.retrainingSchedule.delete(modelId);

    this.logger.log(`Retraining started for model ${modelId} with job ${savedJob.id}`);
    return savedJob.id;
  }

  /**
   * Cancel scheduled retraining
   */
  async cancelRetraining(
    tenantId: string,
    modelId: string,
    canceledBy: string,
    reason: string
  ): Promise<void> {
    this.logger.log(`Canceling retraining for model ${modelId}`);

    const schedule = this.retrainingSchedule.get(modelId);
    if (!schedule) {
      throw new Error(`No retraining schedule found for model ${modelId}`);
    }

    // Remove from schedule
    this.retrainingSchedule.delete(modelId);

    // Update model metadata
    const model = await this.mlModelRepo.findOne({ where: { id: modelId, tenantId } });
    if (model) {
      model.metadata = {
        ...model.metadata,
        retrainingScheduled: false,
        retrainingCanceled: true,
        canceledBy,
        cancelReason: reason,
        canceledAt: new Date().toISOString(),
      };
      await this.mlModelRepo.save(model);
    }

    this.logger.log(`Retraining canceled for model ${modelId} by ${canceledBy}: ${reason}`);
  }

  /**
   * Get retraining status for a model
   */
  async getRetrainingStatus(tenantId: string, modelId: string): Promise<{
    isScheduled: boolean;
    schedule?: RetrainingSchedule;
    inProgress: boolean;
    lastRetraining?: Date;
    nextScheduled?: Date;
  }> {
    const schedule = this.retrainingSchedule.get(modelId);
    const model = await this.mlModelRepo.findOne({
      where: { id: modelId, tenantId },
    });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const inProgress = model.status === ModelStatus.TRAINING;
    const lastRetraining = model.metadata?.lastRetrainingAt 
      ? new Date(model.metadata.lastRetrainingAt) 
      : undefined;

    // Check for time-based next retraining
    const policy = await this.getRetrainingPolicy(tenantId, model.modelType);
    let nextScheduled: Date | undefined;
    
    if (policy.triggers.timeBasedInterval > 0 && lastRetraining) {
      nextScheduled = moment(lastRetraining)
        .add(policy.triggers.timeBasedInterval, 'days')
        .toDate();
    }

    return {
      isScheduled: !!schedule,
      schedule,
      inProgress,
      lastRetraining,
      nextScheduled,
    };
  }

  /**
   * List all scheduled retrainings for a tenant
   */
  async listScheduledRetrainings(tenantId: string): Promise<RetrainingSchedule[]> {
    return Array.from(this.retrainingSchedule.values())
      .filter(schedule => schedule.tenantId === tenantId)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  /**
   * Monitor and execute time-based retrainings
   */
  async processScheduledRetrainings(): Promise<void> {
    this.logger.debug('Processing scheduled retrainings');

    const now = new Date();
    const dueSchedules = Array.from(this.retrainingSchedule.values())
      .filter(schedule => schedule.scheduledAt <= now && schedule.autoExecute);

    for (const schedule of dueSchedules) {
      try {
        await this.executeRetraining(schedule.tenantId, schedule.modelId);
        this.logger.log(`Executed scheduled retraining for model ${schedule.modelId}`);
      } catch (error) {
        this.logger.error(`Failed to execute scheduled retraining for model ${schedule.modelId}: ${error.message}`);
      }
    }
  }

  // Private helper methods

  private async initializeRetrainingSchedules(): Promise<void> {
    // Load existing retraining schedules from database
    // This would be implemented to restore schedules after restart
    this.logger.log('Retraining schedules initialized');
  }

  private async getRetrainingPolicy(tenantId: string, modelType: ModelType): Promise<RetrainingPolicy> {
    // Get policy from database or configuration
    // For now, return default policy
    return {
      tenantId,
      modelType,
      triggers: {
        accuracyThreshold: 20, // MAPE > 20%
        biasThreshold: 10, // Bias > 10%
        timeBasedInterval: 30, // 30 days
        dataVolumeThreshold: 1000, // 1000 new data points
      },
      schedule: {
        allowedHours: [2, 3, 4, 5], // 2 AM - 5 AM
        allowedDays: [0, 1, 2, 3, 4, 5, 6], // All days
        maxConcurrentJobs: 2,
      },
      approval: {
        requiresApproval: true,
        approvers: [], // Would be populated from database
        autoApproveThreshold: 30, // Auto-approve if degradation > 30%
      },
    };
  }

  private async shouldScheduleRetraining(
    trigger: RetrainingTrigger,
    policy: RetrainingPolicy
  ): Promise<boolean> {
    // Check if trigger value exceeds policy thresholds
    switch (trigger.triggerType) {
      case 'accuracy_degradation':
        return trigger.triggerValue > policy.triggers.accuracyThreshold;
      case 'bias_drift':
        return trigger.triggerValue > policy.triggers.biasThreshold;
      case 'time_based':
        return true; // Time-based triggers are always valid
      case 'manual':
        return true; // Manual triggers are always valid
      default:
        return false;
    }
  }

  private calculateScheduledTime(policy: RetrainingPolicy, priority: string): Date {
    const now = moment();
    let scheduledTime = now.clone();

    // For critical priority, schedule immediately during allowed hours
    if (priority === 'critical') {
      if (!policy.schedule.allowedHours.includes(now.hour())) {
        // Find next allowed hour
        const nextAllowedHour = policy.schedule.allowedHours.find(hour => hour > now.hour()) ||
          policy.schedule.allowedHours[0];
        
        if (nextAllowedHour > now.hour()) {
          scheduledTime.hour(nextAllowedHour).minute(0).second(0);
        } else {
          scheduledTime.add(1, 'day').hour(nextAllowedHour).minute(0).second(0);
        }
      }
    } else {
      // For other priorities, schedule for next allowed time window
      let foundSlot = false;
      
      for (let i = 0; i < 7 && !foundSlot; i++) { // Check next 7 days
        const checkDate = now.clone().add(i, 'days');
        
        if (policy.schedule.allowedDays.includes(checkDate.day())) {
          const allowedHour = policy.schedule.allowedHours[0]; // Use first allowed hour
          scheduledTime = checkDate.hour(allowedHour).minute(0).second(0);
          
          if (scheduledTime.isAfter(now)) {
            foundSlot = true;
          }
        }
      }
      
      if (!foundSlot) {
        // Fallback to tomorrow at first allowed hour
        scheduledTime = now.clone().add(1, 'day').hour(policy.schedule.allowedHours[0]).minute(0).second(0);
      }
    }

    return scheduledTime.toDate();
  }

  private estimateResourceRequirements(modelType: ModelType, priority: string): {
    cpu: string;
    memory: string;
    estimatedCost: number;
  } {
    const baseRequirements = {
      [ModelType.ARIMA]: { cpu: '2 cores', memory: '4GB', cost: 10 },
      [ModelType.PROPHET]: { cpu: '4 cores', memory: '8GB', cost: 20 },
      [ModelType.XGBOOST]: { cpu: '8 cores', memory: '16GB', cost: 40 },
      [ModelType.LINEAR_REGRESSION]: { cpu: '1 core', memory: '2GB', cost: 5 },
      [ModelType.EXPONENTIAL_SMOOTHING]: { cpu: '1 core', memory: '2GB', cost: 5 },
      [ModelType.ENSEMBLE]: { cpu: '16 cores', memory: '32GB', cost: 80 },
    };

    const base = baseRequirements[modelType] || baseRequirements[ModelType.LINEAR_REGRESSION];
    const priorityMultiplier = priority === 'critical' ? 1.5 : 1;

    return {
      cpu: base.cpu,
      memory: base.memory,
      estimatedCost: Math.round(base.cost * priorityMultiplier),
    };
  }

  private estimateTrainingDuration(modelType: ModelType): number {
    // Estimated duration in minutes
    const durations = {
      [ModelType.ARIMA]: 30,
      [ModelType.PROPHET]: 60,
      [ModelType.XGBOOST]: 120,
      [ModelType.LINEAR_REGRESSION]: 15,
      [ModelType.EXPONENTIAL_SMOOTHING]: 20,
      [ModelType.ENSEMBLE]: 180,
    };

    return durations[modelType] || 60;
  }

  private async queueRetrainingJob(schedule: RetrainingSchedule): Promise<void> {
    const delay = Math.max(0, schedule.scheduledAt.getTime() - Date.now());
    
    await this.trainingQueue.add('retrain-model', {
      tenantId: schedule.tenantId,
      modelId: schedule.modelId,
      triggerType: schedule.triggerType,
      priority: schedule.priority,
    }, {
      priority: this.getPriorityScore(schedule.priority),
      delay,
    });
  }

  private getPriorityScore(priority: string): number {
    const scores = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4,
    };
    return scores[priority] || 3;
  }

  private async sendApprovalNotification(
    tenantId: string,
    schedule: RetrainingSchedule,
    trigger: RetrainingTrigger
  ): Promise<void> {
    // This would send notifications to approvers
    // Implementation would depend on notification system
    this.logger.log(`Approval notification sent for model ${schedule.modelId} retraining`);
  }
}