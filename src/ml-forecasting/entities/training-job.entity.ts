import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { MLModel } from './ml-model.entity';
import { User } from '../../users/entities/user.entity';

export enum TrainingJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TrainingJobType {
  INITIAL_TRAINING = 'initial_training',
  RETRAINING = 'retraining',
  HYPERPARAMETER_TUNING = 'hyperparameter_tuning',
  ENSEMBLE_TRAINING = 'ensemble_training',
}

@Entity('training_jobs')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'modelId'])
@Index(['tenantId', 'jobType'])
@Index(['tenantId', 'createdAt'])
export class TrainingJob extends BaseEntity {
  @Column({ type: 'uuid' })
  modelId: string;

  @Column({
    type: 'enum',
    enum: TrainingJobType,
    default: TrainingJobType.INITIAL_TRAINING,
  })
  jobType: TrainingJobType;

  @Column({
    type: 'enum',
    enum: TrainingJobStatus,
    default: TrainingJobStatus.QUEUED,
  })
  status: TrainingJobStatus;

  @Column({ type: 'jsonb' })
  trainingConfig: {
    dataSource: {
      from: string;
      to: string;
      productIds?: string[];
      categoryIds?: string[];
      locationIds?: string[];
      includeExternalFactors?: boolean;
    };
    validation: {
      splitRatio: number;
      method: 'time_series' | 'random';
      crossValidationFolds?: number;
    };
    hyperparameters: Record<string, any>;
    features: string[];
    target: string;
    preprocessingSteps?: string[];
  };

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', nullable: true })
  duration?: number; // Duration in seconds

  @Column({ type: 'int', default: 0 })
  progress: number; // Progress percentage (0-100)

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentStep?: string; // Current training step

  @Column({ type: 'jsonb', nullable: true })
  trainingMetrics?: {
    totalSamples: number;
    trainingSamples: number;
    validationSamples: number;
    features: number;
    epochs?: number;
    iterations?: number;
    convergence?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  performanceMetrics?: {
    training: {
      mae: number;
      mape: number;
      rmse: number;
      r2Score?: number;
    };
    validation: {
      mae: number;
      mape: number;
      rmse: number;
      r2Score?: number;
    };
    crossValidation?: {
      mean: Record<string, number>;
      std: Record<string, number>;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  hyperparameterResults?: {
    searchMethod?: 'grid' | 'random' | 'bayesian';
    searchSpace?: Record<string, any>;
    bestParams?: Record<string, any>;
    bestScore?: number;
    totalTrials?: number;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  errorDetails?: {
    errorType: string;
    stackTrace?: string;
    step?: string;
    timestamp: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  logs?: string[]; // Training logs

  @Column({ type: 'varchar', length: 255, nullable: true })
  jobId?: string; // External job ID (from queue system)

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'jsonb', nullable: true })
  resourceUsage?: {
    cpuUsage?: number;
    memoryUsage?: number;
    gpuUsage?: number;
    diskUsage?: number;
    maxMemory?: number;
    peakCpuUsage?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  artifacts?: {
    modelPath?: string;
    checkpointPath?: string;
    logPath?: string;
    visualizationPath?: string;
    preprocessorPath?: string;
    featureImportancePath?: string;
  };

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  cancelledBy?: string;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  // Relations
  @ManyToOne(() => MLModel, model => model.trainingJobs)
  @JoinColumn({ name: 'modelId' })
  model: MLModel;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cancelledBy' })
  canceller?: User;

  // Virtual fields
  get isRunning(): boolean {
    return this.status === TrainingJobStatus.RUNNING;
  }

  get isCompleted(): boolean {
    return this.status === TrainingJobStatus.COMPLETED;
  }

  get isFailed(): boolean {
    return this.status === TrainingJobStatus.FAILED;
  }

  get canRetry(): boolean {
    return this.isFailed && this.retryCount < this.maxRetries;
  }

  get canCancel(): boolean {
    return [TrainingJobStatus.QUEUED, TrainingJobStatus.RUNNING].includes(this.status);
  }

  get estimatedTimeRemaining(): number | null {
    if (!this.isRunning || !this.startedAt) return null;
    
    const elapsed = new Date().getTime() - this.startedAt.getTime();
    const progressPercent = this.progress / 100;
    
    if (progressPercent <= 0) return null;
    
    const totalEstimated = elapsed / progressPercent;
    return Math.max(0, totalEstimated - elapsed);
  }

  // Methods
  start(): void {
    this.status = TrainingJobStatus.RUNNING;
    this.startedAt = new Date();
    this.progress = 0;
  }

  updateProgress(progress: number, step?: string): void {
    this.progress = Math.max(0, Math.min(100, progress));
    this.currentStep = step;
  }

  complete(metrics: any): void {
    this.status = TrainingJobStatus.COMPLETED;
    this.completedAt = new Date();
    this.progress = 100;
    this.performanceMetrics = metrics;
    
    if (this.startedAt) {
      this.duration = Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / 1000);
    }
  }

  fail(error: string, details?: any): void {
    this.status = TrainingJobStatus.FAILED;
    this.completedAt = new Date();
    this.errorMessage = error;
    this.errorDetails = {
      errorType: details?.type || 'Unknown',
      stackTrace: details?.stack,
      step: this.currentStep,
      timestamp: new Date().toISOString(),
    };
    
    if (this.startedAt) {
      this.duration = Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / 1000);
    }
  }

  cancel(userId?: string, reason?: string): void {
    if (this.canCancel) {
      this.status = TrainingJobStatus.CANCELLED;
      this.cancelledAt = new Date();
      this.cancelledBy = userId;
      this.cancellationReason = reason;
      
      if (this.startedAt) {
        this.duration = Math.floor((this.cancelledAt.getTime() - this.startedAt.getTime()) / 1000);
      }
    }
  }

  retry(): void {
    if (this.canRetry) {
      this.retryCount += 1;
      this.status = TrainingJobStatus.QUEUED;
      this.errorMessage = null;
      this.errorDetails = null;
      this.startedAt = null;
      this.completedAt = null;
      this.duration = null;
      this.progress = 0;
      this.currentStep = null;
    }
  }

  addLog(message: string): void {
    if (!this.logs) this.logs = [];
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    
    // Keep only last 1000 log entries
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  updateResourceUsage(usage: {
    cpuUsage?: number;
    memoryUsage?: number;
    gpuUsage?: number;
    diskUsage?: number;
  }): void {
    this.resourceUsage = {
      ...this.resourceUsage,
      ...usage,
      maxMemory: Math.max(this.resourceUsage?.maxMemory || 0, usage.memoryUsage || 0),
      peakCpuUsage: Math.max(this.resourceUsage?.peakCpuUsage || 0, usage.cpuUsage || 0),
    };
  }

  setArtifacts(artifacts: {
    modelPath?: string;
    checkpointPath?: string;
    logPath?: string;
    visualizationPath?: string;
    preprocessorPath?: string;
    featureImportancePath?: string;
  }): void {
    this.artifacts = artifacts;
  }
}