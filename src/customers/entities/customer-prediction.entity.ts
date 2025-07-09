import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { Customer } from './customer.entity';

export enum PredictionType {
  CHURN_PREDICTION = 'churn_prediction',
  LTV_FORECASTING = 'ltv_forecasting',
  NEXT_PURCHASE_PREDICTION = 'next_purchase_prediction',
  PRODUCT_RECOMMENDATION = 'product_recommendation',
  PRICE_SENSITIVITY_ANALYSIS = 'price_sensitivity_analysis',
  SEASONAL_BEHAVIOR_PREDICTION = 'seasonal_behavior_prediction',
  PAYMENT_METHOD_PREDICTION = 'payment_method_prediction',
  RISK_ASSESSMENT = 'risk_assessment',
  ENGAGEMENT_PREDICTION = 'engagement_prediction',
  RETENTION_PROBABILITY = 'retention_probability',
}

export enum PredictionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  UPDATED = 'updated',
}

export enum PredictionConfidence {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum MLModelType {
  LOGISTIC_REGRESSION = 'logistic_regression',
  RANDOM_FOREST = 'random_forest',
  GRADIENT_BOOSTING = 'gradient_boosting',
  NEURAL_NETWORK = 'neural_network',
  SVM = 'svm',
  NAIVE_BAYES = 'naive_bayes',
  ENSEMBLE_MODEL = 'ensemble_model',
  ARIMA = 'arima',
  LSTM = 'lstm',
  PROPHET = 'prophet',
}

export interface PredictionFeatures {
  demographic: {
    age: number;
    gender: string;
    location: string;
    region: string;
    economicSegment: string;
    educationLevel: string;
    familySize: number;
    occupation: string;
  };
  behavioral: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    frequency: number;
    recency: number;
    monthsSinceFirstOrder: number;
    daysSinceLastOrder: number;
    favoriteCategory: string;
    preferredPaymentMethod: string;
    averageSessionDuration: number;
    returningCustomer: boolean;
  };
  engagement: {
    emailOpenRate: number;
    clickThroughRate: number;
    responseRate: number;
    socialMediaEngagement: number;
    supportTicketsCount: number;
    reviewsSubmitted: number;
    referralsMade: number;
    loyaltyPointsEarned: number;
  };
  seasonal: {
    ramadanActivity: number;
    holidaySeasonActivity: number;
    newYearActivity: number;
    valentineActivity: number;
    harbolnasActivity: number;
    culturalEventParticipation: Record<string, number>;
  };
  indonesian: {
    culturalAlignmentScore: number;
    localPaymentMethodUsage: number;
    bahasa_indonesiaPreference: boolean;
    regionalRelevanceScore: number;
    religiousConsiderations: number;
    familyInfluenceScore: number;
    priceAwarenessLevel: number;
    promotionSensitivity: number;
  };
  technical: {
    deviceType: string;
    operatingSystem: string;
    browserType: string;
    connectionQuality: string;
    mobileAppUsage: number;
    desktopUsage: number;
    digitalLiteracyScore: number;
  };
}

export interface PredictionResult {
  prediction: any;
  probability: number;
  confidence: PredictionConfidence;
  factors: Array<{
    feature: string;
    importance: number;
    contribution: number;
    description: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: number;
    expectedImpact: number;
    implementation: string;
    culturalConsiderations: string[];
  }>;
  metadata: {
    modelAccuracy: number;
    dataQuality: number;
    sampleSize: number;
    trainingDate: Date;
    featureImportanceMap: Record<string, number>;
  };
}

export interface IndonesianBusinessPredictionContext {
  culturalFactors: {
    religiousEvents: Array<{
      event: string;
      impact: number;
      startDate: Date;
      endDate: Date;
    }>;
    regionalPreferences: {
      region: string;
      preferences: Record<string, number>;
      seasonality: Record<string, number>;
    };
    socialInfluence: {
      familyInfluence: number;
      communityInfluence: number;
      peerRecommendations: number;
    };
  };
  economicFactors: {
    priceElasticity: number;
    incomeLevel: string;
    spendingPattern: string;
    promotionResponse: number;
    loyaltyToLocal: number;
  };
  digitalBehavior: {
    mobileFirst: boolean;
    socialCommerceUsage: number;
    whatsappCommerceEngagement: number;
    instagramShoppingUsage: number;
    marketplacePreference: string[];
  };
  logistics: {
    preferredShippingMethods: string[];
    codPreference: boolean;
    deliveryTimeExpectation: number;
    returnBehavior: number;
  };
}

export interface PredictionAnalytics {
  accuracy: {
    overall: number;
    bySegment: Record<string, number>;
    byTimeRange: Record<string, number>;
    byRegion: Record<string, number>;
  };
  performance: {
    precision: number;
    recall: number;
    f1Score: number;
    roc_auc: number;
    confusionMatrix: number[][];
  };
  featureAnalysis: {
    topFeatures: Array<{
      feature: string;
      importance: number;
      correlation: number;
      stability: number;
    }>;
    featureInteractions: Array<{
      features: string[];
      interaction_strength: number;
      business_impact: number;
    }>;
  };
  businessImpact: {
    predictionValue: number;
    actionabilityScore: number;
    implementationCost: number;
    expectedROI: number;
    riskReduction: number;
  };
}

@Entity('customer_predictions')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'predictionType'])
@Index(['tenantId', 'modelType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'confidence'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerPrediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.predictions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({
    type: 'enum',
    enum: PredictionType,
    name: 'prediction_type',
  })
  predictionType: PredictionType;

  @Column({
    type: 'enum',
    enum: MLModelType,
    name: 'model_type',
  })
  modelType: MLModelType;

  @Column({
    type: 'enum',
    enum: PredictionStatus,
    default: PredictionStatus.PENDING,
    name: 'status',
  })
  status: PredictionStatus;

  @Column({
    type: 'enum',
    enum: PredictionConfidence,
    name: 'confidence',
  })
  confidence: PredictionConfidence;

  @Column({ name: 'model_version', length: 50 })
  modelVersion: string;

  @Column({ name: 'prediction_date', type: 'timestamp' })
  predictionDate: Date;

  @Column({ name: 'valid_until', type: 'timestamp' })
  validUntil: Date;

  @Column({ name: 'prediction_features', type: 'jsonb' })
  predictionFeatures: PredictionFeatures;

  @Column({ name: 'prediction_result', type: 'jsonb' })
  predictionResult: PredictionResult;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: IndonesianBusinessPredictionContext;

  @Column({ name: 'prediction_analytics', type: 'jsonb', nullable: true })
  predictionAnalytics: PredictionAnalytics;

  @Column({ name: 'accuracy_score', type: 'decimal', precision: 5, scale: 4 })
  accuracyScore: number;

  @Column({
    name: 'probability_score',
    type: 'decimal',
    precision: 5,
    scale: 4,
  })
  probabilityScore: number;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4 })
  confidenceScore: number;

  @Column({
    name: 'business_impact_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  businessImpactScore: number;

  @Column({
    name: 'actionability_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  actionabilityScore: number;

  @Column({ name: 'risk_level', type: 'int', default: 0 })
  riskLevel: number;

  @Column({ name: 'intervention_required', type: 'boolean', default: false })
  interventionRequired: boolean;

  @Column({ name: 'intervention_priority', type: 'int', default: 50 })
  interventionPriority: number;

  @Column({
    name: 'automated_actions_triggered',
    type: 'jsonb',
    nullable: true,
  })
  automatedActionsTriggered: Array<{
    action: string;
    triggeredAt: Date;
    status: string;
    result: any;
  }>;

  @Column({ name: 'human_review_required', type: 'boolean', default: false })
  humanReviewRequired: boolean;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string;

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  // Helper methods for Indonesian business context
  isExpired(): boolean {
    return new Date() > this.validUntil;
  }

  getRecommendationsByPriority(): Array<{
    action: string;
    priority: number;
    expectedImpact: number;
    implementation: string;
    culturalConsiderations: string[];
  }> {
    if (!this.predictionResult?.recommendations) {
      return [];
    }

    return this.predictionResult.recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  getTopInfluencingFactors(limit: number = 5): Array<{
    feature: string;
    importance: number;
    contribution: number;
    description: string;
  }> {
    if (!this.predictionResult?.factors) {
      return [];
    }

    return this.predictionResult.factors
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  needsIndonesianCulturalAdjustment(): boolean {
    const culturalScore =
      this.indonesianContext?.culturalFactors?.socialInfluence
        ?.familyInfluence || 0;
    const religiousScore =
      this.indonesianContext?.culturalFactors?.regionalPreferences?.preferences
        ?.religious || 0;

    return culturalScore > 70 || religiousScore > 80;
  }

  isHighRiskPrediction(): boolean {
    return (
      this.riskLevel > 70 ||
      this.confidenceScore < 0.6 ||
      this.accuracyScore < 0.75 ||
      this.humanReviewRequired
    );
  }

  requiresImmediateAction(): boolean {
    if (
      this.predictionType === PredictionType.CHURN_PREDICTION &&
      this.probabilityScore > 0.8
    ) {
      return true;
    }

    if (
      this.predictionType === PredictionType.RISK_ASSESSMENT &&
      this.riskLevel > 80
    ) {
      return true;
    }

    return this.interventionRequired && this.interventionPriority > 80;
  }

  getIndonesianContextSummary(): string {
    const context: string[] = [];

    if (
      this.indonesianContext?.culturalFactors?.socialInfluence
        ?.familyInfluence > 70
    ) {
      context.push('High family influence');
    }

    if (this.indonesianContext?.economicFactors?.promotionResponse > 80) {
      context.push('Promotion sensitive');
    }

    if (this.indonesianContext?.digitalBehavior?.mobileFirst) {
      context.push('Mobile first');
    }

    if (this.indonesianContext?.logistics?.codPreference) {
      context.push('COD preferred');
    }

    return context.join(', ') || 'Standard context';
  }

  getPredictionQualityScore(): number {
    const accuracyWeight = 0.4;
    const confidenceWeight = 0.3;
    const businessImpactWeight = 0.2;
    const actionabilityWeight = 0.1;

    return (
      (this.accuracyScore * accuracyWeight +
        this.confidenceScore * confidenceWeight +
        (this.businessImpactScore / 100) * businessImpactWeight +
        (this.actionabilityScore / 100) * actionabilityWeight) *
      100
    );
  }

  getModelPerformanceInsights(): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const insights = {
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };

    if (this.accuracyScore > 0.85) {
      insights.strengths.push('High model accuracy');
    } else if (this.accuracyScore < 0.7) {
      insights.weaknesses.push('Low model accuracy');
      insights.recommendations.push('Consider model retraining with more data');
    }

    if (this.confidenceScore > 0.8) {
      insights.strengths.push('High prediction confidence');
    } else if (this.confidenceScore < 0.6) {
      insights.weaknesses.push('Low prediction confidence');
      insights.recommendations.push(
        'Gather more feature data for better predictions',
      );
    }

    if (this.businessImpactScore > 80) {
      insights.strengths.push('High business impact potential');
    } else if (this.businessImpactScore < 50) {
      insights.weaknesses.push('Limited business impact');
      insights.recommendations.push(
        'Focus on actionable insights with higher impact',
      );
    }

    if (this.needsIndonesianCulturalAdjustment()) {
      insights.recommendations.push(
        'Apply Indonesian cultural context adjustments',
      );
    }

    return insights;
  }

  getNextPredictionRecommendation(): {
    when: Date;
    type: PredictionType;
    reason: string;
  } {
    const now = new Date();
    const daysSinceCreated = Math.floor(
      (now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Default recommendation based on prediction type
    const recommendations = {
      [PredictionType.CHURN_PREDICTION]: {
        interval: 7, // Weekly for high-risk customers
        reason: 'Monitor churn risk changes weekly for proactive intervention',
      },
      [PredictionType.LTV_FORECASTING]: {
        interval: 30, // Monthly LTV updates
        reason: 'Update lifetime value forecasts monthly for planning',
      },
      [PredictionType.NEXT_PURCHASE_PREDICTION]: {
        interval: 14, // Bi-weekly purchase predictions
        reason: 'Refresh purchase predictions bi-weekly for campaign timing',
      },
      [PredictionType.RISK_ASSESSMENT]: {
        interval: 3, // Every 3 days for high-risk customers
        reason: 'Frequent risk assessment for early warning system',
      },
    };

    const config = recommendations[this.predictionType] || {
      interval: 30,
      reason: 'Standard monthly refresh',
    };

    const nextDate = new Date(this.createdAt);
    nextDate.setDate(nextDate.getDate() + config.interval);

    return {
      when: nextDate,
      type: this.predictionType,
      reason: config.reason,
    };
  }
}
