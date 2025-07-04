import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { MLModel } from './ml-model.entity';
import { Product } from '../../products/entities/product.entity';

export enum PredictionType {
  DEMAND_FORECAST = 'demand_forecast',
  STOCKOUT_RISK = 'stockout_risk',
  OPTIMAL_REORDER = 'optimal_reorder',
  PRICE_ELASTICITY = 'price_elasticity',
  SEASONAL_TREND = 'seasonal_trend',
  INVENTORY_TURNOVER = 'inventory_turnover',
}

export enum PredictionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum ConfidenceLevel {
  LOW = 'low', // 60-70%
  MEDIUM = 'medium', // 70-85%
  HIGH = 'high', // 85-95%
  VERY_HIGH = 'very_high', // 95%+
}

@Entity('predictions')
@Index(['tenantId', 'modelId'])
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'predictionType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'predictionDate'])
@Index(['tenantId', 'targetDate'])
export class Prediction extends BaseEntity {
  @Column({ type: 'uuid' })
  modelId: string;

  @Column({ type: 'uuid', nullable: true })
  productId?: string; // For product-specific predictions

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string; // For category-level predictions

  @Column({ type: 'varchar', length: 100, nullable: true })
  locationId?: string; // For location-specific predictions

  @Column({
    type: 'enum',
    enum: PredictionType,
  })
  predictionType: PredictionType;

  @Column({
    type: 'enum',
    enum: PredictionStatus,
    default: PredictionStatus.PENDING,
  })
  status: PredictionStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  predictionDate: Date; // When the prediction was made

  @Column({ type: 'date' })
  targetDate: Date; // The date this prediction is for

  @Column({ type: 'decimal', precision: 15, scale: 4 })
  predictedValue: number; // Main prediction value

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  lowerBound?: number; // Lower confidence interval

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  upperBound?: number; // Upper confidence interval

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence: number; // Confidence score (0-1)

  @Column({
    type: 'enum',
    enum: ConfidenceLevel,
  })
  confidenceLevel: ConfidenceLevel;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  actualValue?: number; // Actual value when available (for validation)

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  errorRate?: number; // Prediction error when actual value is known

  @Column({ type: 'jsonb' })
  predictionData: {
    timeSeries?: Array<{
      date: string;
      value: number;
      lowerBound?: number;
      upperBound?: number;
    }>;
    seasonalComponents?: {
      trend?: number;
      seasonal?: number;
      residual?: number;
    };
    externalFactors?: Record<string, number>;
    featureContributions?: Record<string, number>;
  };

  @Column({ type: 'jsonb', nullable: true })
  inputFeatures?: Record<string, any>; // Features used for this prediction

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    modelVersion?: string;
    predictionLatency?: number; // Time taken to generate prediction (ms)
    batchSize?: number;
    requestId?: string;
    userId?: string;
    apiVersion?: string;
    preprocessingSteps?: string[];
    postprocessingSteps?: string[];
  };

  @Column({ type: 'int', default: 30 })
  forecastHorizonDays: number; // How many days into the future

  @Column({ type: 'boolean', default: false })
  isOutlier: boolean; // If prediction is flagged as outlier

  @Column({ type: 'text', nullable: true })
  outlierReason?: string;

  @Column({ type: 'boolean', default: false })
  isActualized: boolean; // If actual value has been recorded

  @Column({ type: 'timestamp', nullable: true })
  actualizedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date; // When this prediction expires

  @Column({ type: 'jsonb', nullable: true })
  actionableInsights?: {
    recommendations?: string[];
    alerts?: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
    nextActions?: Array<{
      action: string;
      priority: number;
      deadline?: string;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  businessImpact?: {
    revenueImpact?: number;
    costImpact?: number;
    stockoutRisk?: number;
    overstockRisk?: number;
    customerSatisfactionImpact?: number;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  predictionJobId?: string; // Reference to batch prediction job

  // Relations
  @ManyToOne(() => MLModel)
  @JoinColumn({ name: 'modelId' })
  model: MLModel;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  // Virtual fields
  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get daysUntilTarget(): number {
    const now = new Date();
    const target = new Date(this.targetDate);
    return Math.ceil(
      (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  get predictionAge(): number {
    const now = new Date();
    return Math.floor(
      (now.getTime() - this.predictionDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  get isAccurate(): boolean {
    if (
      !this.isActualized ||
      this.actualValue === null ||
      this.actualValue === undefined
    ) {
      return false;
    }

    // Consider prediction accurate if error rate is less than 15%
    return (this.errorRate || 100) < 15;
  }

  get isCritical(): boolean {
    return (
      this.actionableInsights?.alerts?.some(
        alert => alert.severity === 'critical',
      ) || false
    );
  }

  get confidenceCategory(): string {
    if (this.confidence >= 0.95) return 'Sangat Tinggi';
    if (this.confidence >= 0.85) return 'Tinggi';
    if (this.confidence >= 0.7) return 'Sedang';
    return 'Rendah';
  }

  // Methods
  actualize(actualValue: number): void {
    this.actualValue = actualValue;
    this.isActualized = true;
    this.actualizedAt = new Date();

    // Calculate error rate
    if (this.predictedValue !== 0) {
      this.errorRate =
        Math.abs((actualValue - this.predictedValue) / this.predictedValue) *
        100;
    }
  }

  markAsOutlier(reason: string): void {
    this.isOutlier = true;
    this.outlierReason = reason;
  }

  addActionableInsight(insight: {
    recommendations?: string[];
    alerts?: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
    nextActions?: Array<{
      action: string;
      priority: number;
      deadline?: string;
    }>;
  }): void {
    this.actionableInsights = {
      ...this.actionableInsights,
      ...insight,
    };
  }

  setBusinessImpact(impact: {
    revenueImpact?: number;
    costImpact?: number;
    stockoutRisk?: number;
    overstockRisk?: number;
    customerSatisfactionImpact?: number;
  }): void {
    this.businessImpact = impact;
  }

  complete(): void {
    this.status = PredictionStatus.COMPLETED;

    // Set expiration based on prediction type and horizon
    const expirationDays =
      this.predictionType === PredictionType.DEMAND_FORECAST
        ? Math.min(this.forecastHorizonDays, 7) // Demand forecasts expire in 7 days max
        : 1; // Other predictions expire in 1 day

    this.expiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000,
    );
  }

  fail(error: string): void {
    this.status = PredictionStatus.FAILED;
    this.metadata = {
      ...this.metadata,
      error,
      failedAt: new Date().toISOString(),
    } as any;
  }

  expire(): void {
    this.status = PredictionStatus.EXPIRED;
  }

  updateConfidenceLevel(): void {
    if (this.confidence >= 0.95) {
      this.confidenceLevel = ConfidenceLevel.VERY_HIGH;
    } else if (this.confidence >= 0.85) {
      this.confidenceLevel = ConfidenceLevel.HIGH;
    } else if (this.confidence >= 0.7) {
      this.confidenceLevel = ConfidenceLevel.MEDIUM;
    } else {
      this.confidenceLevel = ConfidenceLevel.LOW;
    }
  }

  static createDemandForecast(
    modelId: string,
    productId: string,
    targetDate: Date,
    predictedDemand: number,
    confidence: number,
    bounds?: { lower: number; upper: number },
  ): Prediction {
    const prediction = new Prediction();
    prediction.modelId = modelId;
    prediction.productId = productId;
    prediction.predictionType = PredictionType.DEMAND_FORECAST;
    prediction.targetDate = targetDate;
    prediction.predictedValue = predictedDemand;
    prediction.confidence = confidence;
    prediction.lowerBound = bounds?.lower;
    prediction.upperBound = bounds?.upper;
    prediction.updateConfidenceLevel();

    return prediction;
  }

  static createStockoutRisk(
    modelId: string,
    productId: string,
    targetDate: Date,
    riskScore: number,
    confidence: number,
  ): Prediction {
    const prediction = new Prediction();
    prediction.modelId = modelId;
    prediction.productId = productId;
    prediction.predictionType = PredictionType.STOCKOUT_RISK;
    prediction.targetDate = targetDate;
    prediction.predictedValue = riskScore;
    prediction.confidence = confidence;
    prediction.updateConfidenceLevel();

    return prediction;
  }
}
