import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { Customer } from './customer.entity';
import { CustomerJourney } from './customer-journey.entity';
import { CustomerInteraction } from './customer-interaction.entity';
import {
  CustomerJourneyChannel,
  TouchpointType,
  TouchpointStatus,
} from './customer-enums';

// ULTRATHINK: Removed duplicate TouchpointType enum - now using shared enum from customer-enums.ts

// ULTRATHINK: Removed duplicate TouchpointStatus enum - now using shared enum from customer-enums.ts

// ULTRATHINK: TouchpointPriority enum - this is unique to touchpoint entity
export enum TouchpointPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface TouchpointMetrics {
  durationSeconds: number;
  responseTime: number;
  conversionRate: number;
  bounceRate: number;
  engagementScore: number;
  satisfactionRating: number;
  effortRating: number;
  completionRate: number;
  clickThroughRate: number;
  timeToConversion: number;
  influenceScore: number;
  touchpointValue: number;
}

export interface TouchpointIndonesianContext {
  culturalRelevance: {
    respectfulInteraction: boolean;
    localLanguageUsed: boolean;
    culturallyAppropriate: boolean;
    religiousConsiderations: string[];
    familyContextConsidered: boolean;
  };
  regionalFactors: {
    timezone: string;
    withinBusinessHours: boolean;
    regionallyRelevant: boolean;
    localPaymentMethods: string[];
    shippingConsiderations: string[];
  };
  digitalBehavior: {
    deviceType: string;
    connectionQuality: string;
    platformPreference: string;
    digitalLiteracyLevel: string;
  };
  economicContext: {
    priceAwareness: boolean;
    promotionSensitive: boolean;
    valueSeekingBehavior: boolean;
    paymentMethodPreference: string;
  };
}

export interface TouchpointAnalytics {
  performance: {
    conversionContribution: number;
    influenceScore: number;
    attributionWeight: number;
    crossTouchpointImpact: number;
  };
  patterns: {
    commonNextTouchpoints: Array<{
      touchpointType: TouchpointType;
      probability: number;
      averageTimeToNext: number;
    }>;
    commonPreviousTouchpoints: Array<{
      touchpointType: TouchpointType;
      frequency: number;
      averageTimeSincePrevious: number;
    }>;
    seasonalPatterns: Record<string, number>;
    timeOfDayPatterns: Record<string, number>;
  };
  effectiveness: {
    overallScore: number;
    channelEffectiveness: number;
    contentRelevance: number;
    timingAppropriate: number;
    personalizationScore: number;
    indonesianContextRelevance: number;
  };
  optimization: {
    improvementAreas: string[];
    recommendedActions: string[];
    expectedImpact: Record<string, number>;
    abTestOpportunities: string[];
  };
}

@Entity('customer_touchpoints')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'journeyId'])
@Index(['tenantId', 'touchpointType'])
@Index(['tenantId', 'channel'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'occurredAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerTouchpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.touchpoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'journey_id', nullable: true })
  journeyId: string;

  @ManyToOne(() => CustomerJourney, journey => journey.touchpoints, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'journey_id' })
  journey: CustomerJourney;

  @OneToMany(() => CustomerInteraction, interaction => interaction.touchpoint, {
    cascade: true,
  })
  interactions: CustomerInteraction[];

  @Column({
    type: 'enum',
    enum: TouchpointType,
    name: 'touchpoint_type',
  })
  touchpointType: TouchpointType;

  @Column({
    type: 'enum',
    enum: CustomerJourneyChannel,
    name: 'channel',
  })
  channel: CustomerJourneyChannel;

  @Column({
    type: 'enum',
    enum: TouchpointStatus,
    default: TouchpointStatus.ACTIVE,
    name: 'status',
  })
  status: TouchpointStatus;

  @Column({
    type: 'enum',
    enum: TouchpointPriority,
    default: TouchpointPriority.MEDIUM,
    name: 'priority',
  })
  priority: TouchpointPriority;

  @Column({ name: 'touchpoint_name', length: 255 })
  touchpointName: string;

  @Column({ name: 'touchpoint_description', type: 'text', nullable: true })
  touchpointDescription: string;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ name: 'sequence_number', type: 'int', default: 1 })
  sequenceNumber: number;

  @Column({ name: 'is_conversion_touchpoint', type: 'boolean', default: false })
  isConversionTouchpoint: boolean;

  @Column({
    name: 'conversion_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  conversionValue: number;

  @Column({ name: 'touchpoint_metrics', type: 'jsonb', nullable: true })
  touchpointMetrics: TouchpointMetrics;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: TouchpointIndonesianContext;

  @Column({ name: 'touchpoint_analytics', type: 'jsonb', nullable: true })
  touchpointAnalytics: TouchpointAnalytics;

  @Column({ name: 'page_url', length: 1000, nullable: true })
  pageUrl: string;

  @Column({ name: 'referrer_url', length: 1000, nullable: true })
  referrerUrl: string;

  @Column({ name: 'campaign_source', length: 255, nullable: true })
  campaignSource: string;

  @Column({ name: 'campaign_medium', length: 100, nullable: true })
  campaignMedium: string;

  @Column({ name: 'campaign_name', length: 255, nullable: true })
  campaignName: string;

  @Column({ name: 'utm_parameters', type: 'jsonb', nullable: true })
  utmParameters: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo: {
    deviceType: string;
    operatingSystem: string;
    browser: string;
    screenResolution: string;
    userAgent: string;
    ipAddress: string;
    location: {
      country: string;
      region: string;
      city: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
  };

  @Column({ name: 'content_details', type: 'jsonb', nullable: true })
  contentDetails: {
    contentType: string;
    contentId: string;
    contentTitle: string;
    contentCategory: string;
    language: string;
    personalized: boolean;
    abTestVariant: string;
    recommendation: boolean;
  };

  @Column({ name: 'interaction_details', type: 'jsonb', nullable: true })
  interactionDetails: {
    clickCount: number;
    scrollDepth: number;
    timeOnPage: number;
    formInteractions: number;
    downloadCount: number;
    shareCount: number;
    heatmapData: any;
    customEvents: Array<{
      event: string;
      timestamp: Date;
      value: any;
    }>;
  };

  @Column({ name: 'business_context', type: 'jsonb', nullable: true })
  businessContext: {
    orderId?: string;
    productId?: string;
    categoryId?: string;
    serviceTicketId?: string;
    promotionId?: string;
    loyaltyProgramId?: string;
    agentId?: string;
    storeId?: string;
    paymentMethodId?: string;
  };

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({
    name: 'sentiment_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  sentimentScore: number;

  @Column({ name: 'satisfaction_rating', type: 'int', nullable: true })
  satisfactionRating: number;

  @Column({ name: 'effort_rating', type: 'int', nullable: true })
  effortRating: number;

  @Column({ name: 'net_promoter_score', type: 'int', nullable: true })
  netPromoterScore: number;

  @Column({ name: 'feedback_text', type: 'text', nullable: true })
  feedbackText: string;

  @Column({ name: 'agent_id', nullable: true })
  agentId: string;

  @Column({ name: 'agent_rating', type: 'int', nullable: true })
  agentRating: number;

  @Column({ name: 'resolution_time_minutes', type: 'int', nullable: true })
  resolutionTimeMinutes: number;

  @Column({ name: 'escalation_level', type: 'int', default: 0 })
  escalationLevel: number;

  @Column({ name: 'requires_followup', type: 'boolean', default: false })
  requiresFollowup: boolean;

  @Column({ name: 'followup_date', type: 'timestamp', nullable: true })
  followupDate: Date;

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
  isWithinIndonesianBusinessHours(): boolean {
    if (!this.indonesianContext?.regionalFactors?.withinBusinessHours) {
      const hour = this.occurredAt.getHours();
      const day = this.occurredAt.getDay();

      // Standard Indonesian business hours: Monday-Friday 9-18, Saturday 9-14
      if (day >= 1 && day <= 5) {
        return hour >= 9 && hour <= 18;
      } else if (day === 6) {
        return hour >= 9 && hour <= 14;
      }
      return false;
    }

    return this.indonesianContext.regionalFactors.withinBusinessHours;
  }

  isCulturallyAppropriate(): boolean {
    return (
      this.indonesianContext?.culturalRelevance?.culturallyAppropriate !== false
    );
  }

  getLocalizedLanguage(): string {
    return this.indonesianContext?.culturalRelevance?.localLanguageUsed
      ? 'id'
      : 'en';
  }

  getEffectivenessScore(): number {
    if (!this.touchpointAnalytics?.effectiveness) {
      return this.calculateBasicEffectivenessScore();
    }

    return this.touchpointAnalytics.effectiveness.overallScore;
  }

  private calculateBasicEffectivenessScore(): number {
    let score = 0;
    let factors = 0;

    // Duration factor
    if (this.durationSeconds !== null) {
      const normalizedDuration = Math.min(
        100,
        (this.durationSeconds / 300) * 100,
      ); // 5 minutes = 100%
      score += normalizedDuration;
      factors++;
    }

    // Conversion factor
    if (this.isConversionTouchpoint) {
      score += 100;
      factors++;
    }

    // Satisfaction factor
    if (this.satisfactionRating !== null) {
      score += (this.satisfactionRating / 5) * 100;
      factors++;
    }

    // Effort factor (inverse)
    if (this.effortRating !== null) {
      score += ((5 - this.effortRating) / 5) * 100;
      factors++;
    }

    // Indonesian context factor
    if (this.isCulturallyAppropriate()) {
      score += 85;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  getInfluenceOnCustomerJourney(): number {
    if (!this.touchpointAnalytics?.performance?.influenceScore) {
      return this.calculateBasicInfluenceScore();
    }

    return this.touchpointAnalytics.performance.influenceScore;
  }

  private calculateBasicInfluenceScore(): number {
    let score = 0;

    // Base score by touchpoint type
    const touchpointInfluence = {
      [TouchpointType.PURCHASE_COMPLETION]: 100,
      [TouchpointType.CHECKOUT_START]: 85,
      [TouchpointType.CART_ADDITION]: 70,
      [TouchpointType.PRODUCT_VIEW]: 40,
      [TouchpointType.CUSTOMER_SUPPORT_CONTACT]: 60,
      [TouchpointType.EMAIL_CLICK]: 30,
      [TouchpointType.WEBSITE_VISIT]: 20,
    };

    score = touchpointInfluence[this.touchpointType] || 25;

    // Adjust based on conversion value
    if (this.conversionValue && this.conversionValue > 0) {
      score += Math.min(25, (this.conversionValue / 1000000) * 25); // IDR 1M = 25 points
    }

    // Adjust based on satisfaction
    if (this.satisfactionRating && this.satisfactionRating >= 4) {
      score += 15;
    }

    // Adjust for Indonesian context appropriateness
    if (this.isCulturallyAppropriate()) {
      score += 10;
    }

    return Math.min(100, score);
  }

  getRecommendedNextTouchpoints(): TouchpointType[] {
    if (this.touchpointAnalytics?.patterns?.commonNextTouchpoints) {
      return this.touchpointAnalytics.patterns.commonNextTouchpoints
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)
        .map(next => next.touchpointType);
    }

    // Default recommendations based on current touchpoint type
    const nextTouchpointMap: Partial<Record<TouchpointType, TouchpointType[]>> =
      {
        [TouchpointType.WEBSITE_VISIT]: [
          TouchpointType.PRODUCT_VIEW,
          TouchpointType.EMAIL_OPEN,
        ],
        [TouchpointType.PRODUCT_VIEW]: [
          TouchpointType.CART_ADDITION,
          TouchpointType.CUSTOMER_SUPPORT_CONTACT,
        ],
        [TouchpointType.CART_ADDITION]: [
          TouchpointType.CHECKOUT_START,
          TouchpointType.EMAIL_CLICK,
        ],
        [TouchpointType.CHECKOUT_START]: [
          TouchpointType.PURCHASE_COMPLETION,
          TouchpointType.CUSTOMER_SUPPORT_CONTACT,
        ],
        [TouchpointType.CART_ABANDONMENT]: [
          TouchpointType.EMAIL_OPEN,
          TouchpointType.WHATSAPP_MESSAGE,
        ],
        [TouchpointType.PURCHASE_COMPLETION]: [
          TouchpointType.SHIPPING_NOTIFICATION,
          TouchpointType.REVIEW_SUBMISSION,
        ],
      };

    return nextTouchpointMap[this.touchpointType] || [];
  }

  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    const effectiveness = this.getEffectivenessScore();

    if (effectiveness < 30) {
      recommendations.push(
        'Touchpoint shows low effectiveness - consider redesign or removal',
      );
    }

    if (
      !this.isWithinIndonesianBusinessHours() &&
      this.channel === CustomerJourneyChannel.PHONE
    ) {
      recommendations.push(
        'Consider offering callback service for out-of-hours contact attempts',
      );
    }

    if (!this.isCulturallyAppropriate()) {
      recommendations.push(
        'Review content for Indonesian cultural sensitivity',
      );
    }

    if (this.effortRating && this.effortRating > 3) {
      recommendations.push('Simplify interaction to reduce customer effort');
    }

    if (
      this.durationSeconds &&
      this.durationSeconds < 10 &&
      this.touchpointType === TouchpointType.WEBSITE_VISIT
    ) {
      recommendations.push(
        'High bounce rate - improve page content or loading speed',
      );
    }

    if (
      this.indonesianContext?.economicContext?.priceAwareness &&
      !this.businessContext?.promotionId
    ) {
      recommendations.push('Consider offering price-conscious promotions');
    }

    return recommendations;
  }

  isHighValueTouchpoint(): boolean {
    return (
      this.isConversionTouchpoint ||
      (this.conversionValue && this.conversionValue > 1000000) || // IDR 1M
      this.getInfluenceOnCustomerJourney() > 80
    );
  }

  requiresImmedateAttention(): boolean {
    return (
      this.priority === TouchpointPriority.CRITICAL ||
      (this.satisfactionRating && this.satisfactionRating <= 2) ||
      (this.effortRating && this.effortRating >= 4) ||
      this.escalationLevel > 0
    );
  }

  getIndonesianContextSummary(): string {
    const context: string[] = [];

    if (this.indonesianContext?.culturalRelevance?.localLanguageUsed) {
      context.push('Local language');
    }

    if (this.isWithinIndonesianBusinessHours()) {
      context.push('Business hours');
    }

    if (this.indonesianContext?.regionalFactors?.regionallyRelevant) {
      context.push('Regionally relevant');
    }

    if (this.indonesianContext?.economicContext?.promotionSensitive) {
      context.push('Promotion sensitive');
    }

    return context.join(', ') || 'Standard context';
  }
}
