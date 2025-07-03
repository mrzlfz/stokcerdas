import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ModelType {
  ARIMA = 'arima',
  PROPHET = 'prophet',
  XGBOOST = 'xgboost',
  LINEAR_REGRESSION = 'linear_regression',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  ENSEMBLE = 'ensemble',
}

export enum ModelStatus {
  TRAINING = 'training',
  TRAINED = 'trained',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  DEPRECATED = 'deprecated',
}

export enum ForecastHorizon {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('ml_models')
@Index(['tenantId', 'modelType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'isActive'])
export class MLModel extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ModelType,
  })
  modelType: ModelType;

  @Column({
    type: 'enum',
    enum: ModelStatus,
    default: ModelStatus.TRAINING,
  })
  status: ModelStatus;

  @Column({
    type: 'enum',
    enum: ForecastHorizon,
    default: ForecastHorizon.DAILY,
  })
  forecastHorizon: ForecastHorizon;

  @Column({ type: 'uuid', nullable: true })
  productId?: string; // For product-specific models

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string; // For category-level models

  @Column({ type: 'varchar', length: 100, nullable: true })
  locationId?: string; // For location-specific models

  @Column({ type: 'jsonb' })
  hyperparameters: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  trainingConfig?: {
    trainingDataFrom: string;
    trainingDataTo: string;
    validationSplit: number;
    features: string[];
    target: string;
    seasonality?: boolean;
    trend?: boolean;
    holiday?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  performance?: {
    mae: number; // Mean Absolute Error
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    r2Score?: number; // R-squared for regression models
    lastValidationDate: string;
    trainingDuration: number; // in seconds
    totalSamples: number;
    validationSamples: number;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  modelPath?: string; // Path to serialized model file

  @Column({ type: 'int', default: 30 })
  forecastDays: number; // Default forecast horizon in days

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.85 })
  accuracyThreshold: number; // Minimum accuracy for deployment

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracy?: number; // Current model accuracy

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  dataQuality?: number; // Data quality score

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEnsembleMember: boolean; // If this model is part of an ensemble

  @Column({ type: 'uuid', nullable: true })
  parentEnsembleId?: string; // Reference to ensemble model

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  ensembleWeight?: number; // Weight in ensemble

  @Column({ type: 'timestamp', nullable: true })
  trainedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deployedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPredictionAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetrainingAt?: Date;

  @Column({ type: 'int', default: 30 })
  retrainingIntervalDays: number;

  @Column({ type: 'jsonb', nullable: true })
  featureImportance?: Record<string, number>; // For models that support it

  @Column({ type: 'jsonb', nullable: true })
  seasonalityComponents?: {
    daily?: Record<string, number>;
    weekly?: Record<string, number>;
    monthly?: Record<string, number>;
    yearly?: Record<string, number>;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Additional model-specific data

  // Relations
  // @OneToMany(() => TrainingJob, job => job.model)
  // trainingJobs?: TrainingJob[];

  // @OneToMany(() => Prediction, prediction => prediction.model)
  // predictions?: Prediction[];

  // Virtual fields
  get isDeployed(): boolean {
    return this.status === ModelStatus.DEPLOYED && this.isActive;
  }

  get needsRetraining(): boolean {
    if (!this.nextRetrainingAt) return false;
    return new Date() >= this.nextRetrainingAt;
  }

  get isAccurate(): boolean {
    if (!this.performance) return false;
    return this.performance.mape <= (1 - this.accuracyThreshold) * 100; // Convert threshold to MAPE
  }

  get modelAge(): number {
    if (!this.trainedAt) return 0;
    return Math.floor((new Date().getTime() - this.trainedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Methods
  updatePerformance(metrics: {
    mae: number;
    mape: number;
    rmse: number;
    r2Score?: number;
    trainingDuration: number;
    totalSamples: number;
    validationSamples: number;
  }): void {
    this.performance = {
      ...metrics,
      lastValidationDate: new Date().toISOString(),
    };
  }

  deploy(): void {
    if (this.status === ModelStatus.TRAINED && this.isAccurate) {
      this.status = ModelStatus.DEPLOYED;
      this.deployedAt = new Date();
      this.nextRetrainingAt = new Date(Date.now() + this.retrainingIntervalDays * 24 * 60 * 60 * 1000);
    }
  }

  deprecate(): void {
    this.status = ModelStatus.DEPRECATED;
    this.isActive = false;
  }

  recordPrediction(): void {
    this.lastPredictionAt = new Date();
  }

  updateFeatureImportance(importance: Record<string, number>): void {
    this.featureImportance = importance;
  }

  setEnsembleMember(ensembleId: string, weight: number): void {
    this.isEnsembleMember = true;
    this.parentEnsembleId = ensembleId;
    this.ensembleWeight = weight;
  }
}

// Import types for relations (will be defined in separate files)
declare class TrainingJob {
  model: MLModel;
}

declare class Prediction {
  model: MLModel;
}