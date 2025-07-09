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
import { CustomerJourney } from './customer-journey.entity';
import { CustomerTouchpoint } from './customer-touchpoint.entity';
import {
  CustomerJourneyChannel,
  TouchpointType,
  InteractionType,
  InteractionStatus,
  InteractionSentiment,
} from './customer-enums';

// ULTRATHINK: Enums moved to customer-enums.ts to prevent circular imports
// InteractionType, InteractionStatus, InteractionSentiment now imported from shared file

export interface InteractionMetrics {
  responseTime: number;
  completionRate: number;
  engagementScore: number;
  satisfactionRating: number;
  effortScore: number;
  conversionValue: number;
  influenceScore: number;
  nextInteractionProbability: number;
  sentimentScore: number;
  personalizedContent: boolean;
  contextualRelevance: number;
}

export interface InteractionIndonesianContext {
  language: string;
  culturalSensitivity: {
    respectfulTone: boolean;
    familyContext: boolean;
    religiousConsiderations: string[];
    localCustomsRespected: boolean;
  };
  regionalContext: {
    timezone: string;
    localBusiness: boolean;
    regionallyRelevant: boolean;
    logisticsContext: string[];
  };
  economicFactors: {
    priceContext: boolean;
    promotionRelevant: boolean;
    paymentMethodLocal: boolean;
    valueProposition: string;
  };
  digitalBehavior: {
    preferredChannel: CustomerJourneyChannel;
    deviceOptimized: boolean;
    bandwidthConsidered: boolean;
    offlineCapability: boolean;
  };
}

export interface InteractionAnalytics {
  performance: {
    conversionContribution: number;
    journeyImpact: number;
    channelEffectiveness: number;
    contentRelevance: number;
    timingOptimal: boolean;
  };
  patterns: {
    frequencyPattern: string;
    seasonalInfluence: Record<string, number>;
    timePreferences: Record<string, number>;
    devicePatterns: Record<string, number>;
  };
  personalization: {
    personalizationLevel: number;
    contentMatch: number;
    behavioralRelevance: number;
    contextualAppropriate: number;
    indonesianContextMatch: number;
  };
  optimization: {
    improvementPotential: number;
    recommendedChanges: string[];
    nextBestActions: string[];
    abTestOpportunities: string[];
  };
}

@Entity('customer_interactions')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'journeyId'])
@Index(['tenantId', 'touchpointId'])
@Index(['tenantId', 'interactionType'])
@Index(['tenantId', 'channel'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'occurredAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.interactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'journey_id', nullable: true })
  journeyId: string;

  @ManyToOne(() => CustomerJourney, journey => journey.interactions, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'journey_id' })
  journey: CustomerJourney;

  @Column({ name: 'touchpoint_id', nullable: true })
  touchpointId: string;

  @ManyToOne(() => CustomerTouchpoint, touchpoint => touchpoint.interactions, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'touchpoint_id' })
  touchpoint: CustomerTouchpoint;

  @Column({
    type: 'enum',
    enum: InteractionType,
    name: 'interaction_type',
  })
  interactionType: InteractionType;

  @Column({
    type: 'enum',
    enum: CustomerJourneyChannel,
    name: 'channel',
  })
  channel: CustomerJourneyChannel;

  @Column({
    type: 'enum',
    enum: InteractionStatus,
    default: InteractionStatus.INITIATED,
    name: 'status',
  })
  status: InteractionStatus;

  @Column({
    type: 'enum',
    enum: InteractionSentiment,
    nullable: true,
    name: 'sentiment',
  })
  sentiment: InteractionSentiment;

  @Column({ name: 'interaction_title', length: 500 })
  interactionTitle: string;

  @Column({ name: 'interaction_description', type: 'text', nullable: true })
  interactionDescription: string;

  @Column({ name: 'interaction_content', type: 'text', nullable: true })
  interactionContent: string;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ name: 'response_time_ms', type: 'int', nullable: true })
  responseTimeMs: number;

  @Column({ name: 'sequence_in_touchpoint', type: 'int', default: 1 })
  sequenceInTouchpoint: number;

  @Column({ name: 'is_automated', type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({ name: 'is_personalized', type: 'boolean', default: false })
  isPersonalized: boolean;

  @Column({
    name: 'is_conversion_interaction',
    type: 'boolean',
    default: false,
  })
  isConversionInteraction: boolean;

  @Column({
    name: 'conversion_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  conversionValue: number;

  @Column({ name: 'interaction_metrics', type: 'jsonb', nullable: true })
  interactionMetrics: InteractionMetrics;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: InteractionIndonesianContext;

  @Column({ name: 'interaction_analytics', type: 'jsonb', nullable: true })
  interactionAnalytics: InteractionAnalytics;

  @Column({ name: 'content_details', type: 'jsonb', nullable: true })
  contentDetails: {
    contentId: string;
    contentType: string;
    contentTitle: string;
    contentLanguage: string;
    contentVersion: string;
    templateId: string;
    personalizationData: Record<string, any>;
    abTestVariant: string;
    dynamicContent: boolean;
  };

  @Column({ name: 'user_input', type: 'jsonb', nullable: true })
  userInput: {
    inputType: string;
    inputValue: any;
    inputValidation: boolean;
    inputErrors: string[];
    inputMetadata: Record<string, any>;
  };

  @Column({ name: 'system_response', type: 'jsonb', nullable: true })
  systemResponse: {
    responseType: string;
    responseValue: any;
    responseStatus: string;
    responseTime: number;
    errorDetails: string[];
    recommendations: string[];
  };

  @Column({ name: 'contextual_data', type: 'jsonb', nullable: true })
  contextualData: {
    sessionId: string;
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
    device: {
      type: string;
      os: string;
      browser: string;
      screenSize: string;
    };
    referrer: string;
    utmParameters: Record<string, string>;
  };

  @Column({ name: 'business_context', type: 'jsonb', nullable: true })
  businessContext: {
    orderId?: string;
    productId?: string;
    categoryId?: string;
    serviceTicketId?: string;
    campaignId?: string;
    promotionId?: string;
    loyaltyTransactionId?: string;
    agentId?: string;
    departmentId?: string;
    escalationLevel?: number;
  };

  @Column({ name: 'satisfaction_feedback', type: 'jsonb', nullable: true })
  satisfactionFeedback: {
    rating: number;
    feedback: string;
    feedbackType: string;
    feedbackCategories: string[];
    improvements: string[];
    wouldRecommend: boolean;
    netPromoterScore: number;
  };

  @Column({ name: 'engagement_metrics', type: 'jsonb', nullable: true })
  engagementMetrics: {
    clickCount: number;
    scrollDepth: number;
    timeOnPage: number;
    bounceRate: number;
    exitRate: number;
    conversionRate: number;
    shares: number;
    likes: number;
    comments: number;
  };

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'priority_score', type: 'int', default: 50 })
  priorityScore: number;

  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  qualityScore: number;

  @Column({
    name: 'influence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  influenceScore: number;

  @Column({ name: 'next_interaction_predicted', type: 'jsonb', nullable: true })
  nextInteractionPredicted: {
    interactionType: InteractionType;
    probability: number;
    timeToNext: number;
    confidence: number;
    factors: string[];
  };

  @Column({ name: 'agent_id', nullable: true })
  agentId: string;

  @Column({ name: 'agent_name', length: 255, nullable: true })
  agentName: string;

  @Column({ name: 'agent_rating', type: 'int', nullable: true })
  agentRating: number;

  @Column({ name: 'escalation_required', type: 'boolean', default: false })
  escalationRequired: boolean;

  @Column({ name: 'followup_required', type: 'boolean', default: false })
  followupRequired: boolean;

  @Column({ name: 'followup_date', type: 'timestamp', nullable: true })
  followupDate: Date;

  @Column({ name: 'resolution_achieved', type: 'boolean', default: false })
  resolutionAchieved: boolean;

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
  isInIndonesianLanguage(): boolean {
    return (
      this.indonesianContext?.language === 'id' ||
      this.contentDetails?.contentLanguage === 'id'
    );
  }

  isCulturallySensitive(): boolean {
    return (
      this.indonesianContext?.culturalSensitivity?.respectfulTone === true &&
      this.indonesianContext?.culturalSensitivity?.localCustomsRespected ===
        true
    );
  }

  isRegionallyOptimized(): boolean {
    return this.indonesianContext?.regionalContext?.regionallyRelevant === true;
  }

  getEngagementLevel(): 'low' | 'medium' | 'high' | 'very_high' {
    const score = this.interactionMetrics?.engagementScore || 0;

    if (score >= 80) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  getSentimentScore(): number {
    if (this.interactionMetrics?.sentimentScore !== undefined) {
      return this.interactionMetrics.sentimentScore;
    }

    // Calculate based on sentiment enum
    const sentimentScores = {
      [InteractionSentiment.VERY_POSITIVE]: 100,
      [InteractionSentiment.POSITIVE]: 75,
      [InteractionSentiment.NEUTRAL]: 50,
      [InteractionSentiment.NEGATIVE]: 25,
      [InteractionSentiment.VERY_NEGATIVE]: 0,
    };

    return this.sentiment ? sentimentScores[this.sentiment] : 50;
  }

  getQualityScore(): number {
    if (this.qualityScore !== null) {
      return this.qualityScore;
    }

    let score = 0;
    let factors = 0;

    // Response time factor
    if (this.responseTimeMs !== null) {
      const responseScore = Math.max(0, 100 - this.responseTimeMs / 1000); // 1 second = 0 points
      score += Math.min(100, responseScore);
      factors++;
    }

    // Completion factor
    if (this.status === InteractionStatus.COMPLETED) {
      score += 100;
      factors++;
    }

    // Satisfaction factor
    if (this.satisfactionFeedback?.rating) {
      score += (this.satisfactionFeedback.rating / 5) * 100;
      factors++;
    }

    // Indonesian context factor
    if (this.isCulturallySensitive()) {
      score += 85;
      factors++;
    }

    // Personalization factor
    if (this.isPersonalized) {
      score += 80;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  getInfluenceOnJourney(): number {
    if (this.influenceScore !== null) {
      return this.influenceScore;
    }

    let score = 0;

    // Base score by interaction type
    const interactionInfluence = {
      [InteractionType.ORDER_PLACED]: 100,
      [InteractionType.PAYMENT_COMPLETED]: 95,
      [InteractionType.CHECKOUT_INITIATED]: 80,
      [InteractionType.CART_ITEM_ADDED]: 65,
      [InteractionType.PRODUCT_VIEWED]: 40,
      [InteractionType.SUPPORT_TICKET_CREATED]: 70,
      [InteractionType.REVIEW_WRITTEN]: 60,
      [InteractionType.EMAIL_CLICKED]: 30,
      [InteractionType.PAGE_VIEW]: 20,
    };

    score = interactionInfluence[this.interactionType] || 25;

    // Adjust based on conversion value
    if (this.conversionValue && this.conversionValue > 0) {
      score += Math.min(25, (this.conversionValue / 1000000) * 25); // IDR 1M = 25 points
    }

    // Adjust based on engagement
    const engagementLevel = this.getEngagementLevel();
    const engagementBonus = {
      very_high: 20,
      high: 15,
      medium: 10,
      low: 0,
    };
    score += engagementBonus[engagementLevel];

    // Adjust for Indonesian context
    if (this.isCulturallySensitive() && this.isRegionallyOptimized()) {
      score += 15;
    }

    return Math.min(100, score);
  }

  getRecommendedFollowupActions(): string[] {
    const actions: string[] = [];

    if (this.followupRequired) {
      actions.push('Schedule follow-up interaction');
    }

    if (this.escalationRequired) {
      actions.push('Escalate to senior agent or manager');
    }

    if (this.status === InteractionStatus.FAILED) {
      actions.push('Investigate failure cause and retry');
    }

    if (
      this.satisfactionFeedback?.rating &&
      this.satisfactionFeedback.rating <= 2
    ) {
      actions.push('Address satisfaction issues immediately');
    }

    if (
      this.getEngagementLevel() === 'low' &&
      this.channel === CustomerJourneyChannel.EMAIL
    ) {
      actions.push('Try alternative communication channel');
    }

    if (!this.isCulturallySensitive()) {
      actions.push('Review content for Indonesian cultural appropriateness');
    }

    if (this.isConversionInteraction && !this.resolutionAchieved) {
      actions.push('Focus on conversion completion');
    }

    return actions;
  }

  getOptimizationOpportunities(): string[] {
    const opportunities: string[] = [];

    if (this.responseTimeMs && this.responseTimeMs > 5000) {
      opportunities.push('Improve response time performance');
    }

    if (!this.isPersonalized && this.getEngagementLevel() === 'low') {
      opportunities.push('Add personalization to improve engagement');
    }

    if (
      !this.isInIndonesianLanguage() &&
      this.indonesianContext?.language === 'id'
    ) {
      opportunities.push('Localize content to Indonesian language');
    }

    if (this.engagementMetrics?.bounceRate > 70) {
      opportunities.push('Reduce bounce rate through better content targeting');
    }

    if (!this.indonesianContext?.economicFactors?.paymentMethodLocal) {
      opportunities.push('Integrate Indonesian payment methods');
    }

    if (
      this.durationSeconds &&
      this.durationSeconds < 10 &&
      this.interactionType === InteractionType.PAGE_VIEW
    ) {
      opportunities.push('Improve page content to increase engagement time');
    }

    return opportunities;
  }

  getNextBestActions(): InteractionType[] {
    const currentType = this.interactionType;

    // Define interaction flow mapping
    const nextActionMap: Partial<Record<InteractionType, InteractionType[]>> = {
      [InteractionType.PAGE_VIEW]: [
        InteractionType.PRODUCT_VIEWED,
        InteractionType.EMAIL_SENT,
      ],
      [InteractionType.PRODUCT_VIEWED]: [
        InteractionType.CART_ITEM_ADDED,
        InteractionType.LIVE_CHAT_INITIATED,
      ],
      [InteractionType.CART_ITEM_ADDED]: [
        InteractionType.CHECKOUT_INITIATED,
        InteractionType.EMAIL_SENT,
      ],
      [InteractionType.CHECKOUT_INITIATED]: [
        InteractionType.PAYMENT_ATTEMPTED,
        InteractionType.LIVE_CHAT_INITIATED,
      ],
      [InteractionType.EMAIL_OPENED]: [
        InteractionType.EMAIL_CLICKED,
        InteractionType.PAGE_VIEW,
      ],
      [InteractionType.SUPPORT_TICKET_CREATED]: [
        InteractionType.LIVE_CHAT_INITIATED,
        InteractionType.PHONE_CALL_MADE,
      ],
    };

    return (
      nextActionMap[currentType] || [
        InteractionType.EMAIL_SENT,
        InteractionType.PHONE_CALL_MADE,
      ]
    );
  }

  calculateSuccessScore(): number {
    let score = 0;
    let factors = 0;

    // Status factor
    if (this.status === InteractionStatus.COMPLETED) {
      score += 100;
      factors++;
    } else if (this.status === InteractionStatus.IN_PROGRESS) {
      score += 50;
      factors++;
    }

    // Engagement factor
    score += this.interactionMetrics?.engagementScore || 0;
    factors++;

    // Satisfaction factor
    if (this.satisfactionFeedback?.rating) {
      score += (this.satisfactionFeedback.rating / 5) * 100;
      factors++;
    }

    // Resolution factor
    if (this.resolutionAchieved) {
      score += 90;
      factors++;
    }

    // Cultural sensitivity factor
    if (this.isCulturallySensitive()) {
      score += 85;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  isHighPriorityInteraction(): boolean {
    return (
      this.priorityScore > 80 ||
      this.escalationRequired ||
      (this.satisfactionFeedback?.rating &&
        this.satisfactionFeedback.rating <= 2) ||
      this.isConversionInteraction
    );
  }
}
