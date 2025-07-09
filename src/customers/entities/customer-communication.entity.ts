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

export enum CommunicationType {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PHONE_CALL = 'phone_call',
  PUSH_NOTIFICATION = 'push_notification',
  IN_APP_MESSAGE = 'in_app_message',
  SOCIAL_MEDIA_MESSAGE = 'social_media_message',
  DIRECT_MAIL = 'direct_mail',
  CHATBOT_INTERACTION = 'chatbot_interaction',
  VIDEO_CALL = 'video_call',
  VOICE_MESSAGE = 'voice_message',
  TELEGRAM_MESSAGE = 'telegram_message',
  INSTAGRAM_MESSAGE = 'instagram_message',
  FACEBOOK_MESSAGE = 'facebook_message',
  MARKETPLACE_MESSAGE = 'marketplace_message',
}

export enum CommunicationStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  REPLIED = 'replied',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BIDIRECTIONAL = 'bidirectional',
}

export enum CommunicationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum CommunicationChannel {
  MARKETING = 'marketing',
  TRANSACTIONAL = 'transactional',
  SUPPORT = 'support',
  SALES = 'sales',
  RETENTION = 'retention',
  REACTIVATION = 'reactivation',
  WELCOME = 'welcome',
  ABANDONED_CART = 'abandoned_cart',
  ORDER_UPDATE = 'order_update',
  FEEDBACK_REQUEST = 'feedback_request',
  LOYALTY_PROGRAM = 'loyalty_program',
  SEASONAL_CAMPAIGN = 'seasonal_campaign',
  PROMOTIONAL = 'promotional',
  EDUCATIONAL = 'educational',
  SURVEY = 'survey',
}

export interface CommunicationMetrics {
  deliveryTime: number; // Time taken to deliver in milliseconds
  openTime: number; // Time taken to open after delivery
  clickTime: number; // Time taken to click after opening
  responseTime: number; // Time taken to respond
  engagementDuration: number; // How long user engaged with content
  conversionValue: number; // Monetary value generated from this communication
  qualityScore: number; // Overall quality score (0-100)
  relevanceScore: number; // How relevant the content was (0-100)
  personalizationScore: number; // Level of personalization (0-100)
  indonesianContextScore: number; // Cultural relevance score (0-100)
}

export interface IndonesianCommunicationContext {
  culturalFactors: {
    language: 'id' | 'en' | 'mixed';
    formalityLevel:
      | 'very_formal'
      | 'formal'
      | 'neutral'
      | 'informal'
      | 'very_informal';
    religiousConsiderations: boolean;
    familyContextIncluded: boolean;
    localCustomsRespected: boolean;
    culturalEventRelevance: string[];
  };
  regionalFactors: {
    timezone: string;
    region: string;
    localDialect: string;
    regionalPreferences: Record<string, any>;
    economicContext: string;
    urbanRuralContext: 'urban' | 'suburban' | 'rural';
  };
  businessContext: {
    businessHours: boolean;
    localHolidays: boolean;
    ramadanAdjustment: boolean;
    localPaymentMethodsReferenced: boolean;
    indonesianBusinessEtiquette: boolean;
    priceLocalization: boolean;
  };
  technicalContext: {
    deviceOptimization: 'mobile' | 'desktop' | 'tablet';
    connectionQuality: 'high' | 'medium' | 'low';
    dataUsageOptimized: boolean;
    whatsappBusinessOptimized: boolean;
    localPlatformPreferences: string[];
  };
}

export interface CommunicationAnalytics {
  performance: {
    deliveryRate: number;
    openRate: number;
    clickThroughRate: number;
    responseRate: number;
    unsubscribeRate: number;
    bounceRate: number;
    conversionRate: number;
    revenuePerCommunication: number;
  };
  engagement: {
    averageEngagementTime: number;
    contentInteractionDepth: number;
    socialSharingRate: number;
    forwardingRate: number;
    saveRate: number;
    printRate: number;
  };
  segmentation: {
    demographicPerformance: Record<string, number>;
    behavioralPerformance: Record<string, number>;
    geographicPerformance: Record<string, number>;
    loyaltyTierPerformance: Record<string, number>;
  };
  optimization: {
    bestTimeToSend: string;
    optimalFrequency: number;
    effectiveSubjectLines: string[];
    highPerformingContent: string[];
    recommendedPersonalization: string[];
  };
}

export interface CommunicationAutomation {
  triggers: Array<{
    type: string;
    condition: any;
    delay: number;
    priority: number;
  }>;
  workflow: {
    steps: Array<{
      action: string;
      parameters: any;
      successPath: string;
      failurePath: string;
    }>;
    branching: boolean;
    abtesting: boolean;
  };
  scheduling: {
    sendTime: Date;
    timezone: string;
    frequencyCapping: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    suppressionRules: string[];
  };
}

@Entity('customer_communications')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'campaignId'])
@Index(['tenantId', 'communicationType'])
@Index(['tenantId', 'communicationChannel'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'direction'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'sentAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerCommunication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.communications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'campaign_id', nullable: true })
  campaignId: string;

  @Column({ name: 'template_id', nullable: true })
  templateId: string;

  @Column({
    type: 'enum',
    enum: CommunicationType,
    name: 'communication_type',
  })
  communicationType: CommunicationType;

  @Column({
    type: 'enum',
    enum: CommunicationChannel,
    name: 'communication_channel',
  })
  communicationChannel: CommunicationChannel;

  @Column({
    type: 'enum',
    enum: CommunicationDirection,
    name: 'direction',
  })
  direction: CommunicationDirection;

  @Column({
    type: 'enum',
    enum: CommunicationStatus,
    default: CommunicationStatus.DRAFT,
    name: 'status',
  })
  status: CommunicationStatus;

  @Column({
    type: 'enum',
    enum: CommunicationPriority,
    default: CommunicationPriority.NORMAL,
    name: 'priority',
  })
  priority: CommunicationPriority;

  @Column({ name: 'subject', length: 500, nullable: true })
  subject: string;

  @Column({ name: 'message_content', type: 'text' })
  messageContent: string;

  @Column({ name: 'rendered_content', type: 'text', nullable: true })
  renderedContent: string;

  @Column({ name: 'personalized_content', type: 'text', nullable: true })
  personalizedContent: string;

  @Column({ name: 'sender_name', length: 255, nullable: true })
  senderName: string;

  @Column({ name: 'sender_email', length: 255, nullable: true })
  senderEmail: string;

  @Column({ name: 'sender_phone', length: 50, nullable: true })
  senderPhone: string;

  @Column({ name: 'recipient_name', length: 255, nullable: true })
  recipientName: string;

  @Column({ name: 'recipient_email', length: 255, nullable: true })
  recipientEmail: string;

  @Column({ name: 'recipient_phone', length: 50, nullable: true })
  recipientPhone: string;

  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'opened_at', type: 'timestamp', nullable: true })
  openedAt: Date;

  @Column({ name: 'clicked_at', type: 'timestamp', nullable: true })
  clickedAt: Date;

  @Column({ name: 'replied_at', type: 'timestamp', nullable: true })
  repliedAt: Date;

  @Column({ name: 'bounced_at', type: 'timestamp', nullable: true })
  bouncedAt: Date;

  @Column({ name: 'unsubscribed_at', type: 'timestamp', nullable: true })
  unsubscribedAt: Date;

  @Column({ name: 'communication_metrics', type: 'jsonb', nullable: true })
  communicationMetrics: CommunicationMetrics;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: IndonesianCommunicationContext;

  @Column({ name: 'communication_analytics', type: 'jsonb', nullable: true })
  communicationAnalytics: CommunicationAnalytics;

  @Column({ name: 'automation_config', type: 'jsonb', nullable: true })
  automationConfig: CommunicationAutomation;

  @Column({ name: 'attachments', type: 'jsonb', nullable: true })
  attachments: Array<{
    filename: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    description?: string;
  }>;

  @Column({ name: 'tracking_data', type: 'jsonb', nullable: true })
  trackingData: {
    openCount: number;
    clickCount: number;
    forwardCount: number;
    uniqueOpens: number;
    uniqueClicks: number;
    deviceTypes: Record<string, number>;
    locations: Record<string, number>;
    timeSpentReading: number;
    mostClickedLinks: Array<{
      url: string;
      clicks: number;
      description: string;
    }>;
  };

  @Column({ name: 'personalization_data', type: 'jsonb', nullable: true })
  personalizationData: {
    customerName: string;
    segmentInfo: any;
    behavioralTriggers: string[];
    productRecommendations: any[];
    dynamicContent: Record<string, any>;
    abTestVariant: string;
    personalizationScore: number;
  };

  @Column({ name: 'compliance_data', type: 'jsonb', nullable: true })
  complianceData: {
    consentGiven: boolean;
    consentTimestamp: Date;
    consentType: string;
    gdprCompliant: boolean;
    uuPdpCompliant: boolean;
    optOutLink: string;
    unsubscribeMethod: string;
    dataRetentionPeriod: number;
  };

  @Column({ name: 'integration_data', type: 'jsonb', nullable: true })
  integrationData: {
    externalMessageId: string;
    providerName: string;
    providerResponse: any;
    deliveryStatus: any;
    providerMetrics: any;
    costData: {
      cost: number;
      currency: string;
      provider: string;
    };
  };

  @Column({ name: 'a_b_test_data', type: 'jsonb', nullable: true })
  abTestData: {
    testId: string;
    variantId: string;
    testName: string;
    controlGroup: boolean;
    hypothesis: string;
    metrics: Record<string, any>;
    winningVariant: boolean;
  };

  @Column({ name: 'business_context', type: 'jsonb', nullable: true })
  businessContext: {
    orderId?: string;
    productIds?: string[];
    categoryIds?: string[];
    promotionId?: string;
    loyaltyProgramId?: string;
    customerJourneyStage?: string;
    lifecycleStage?: string;
    churnRiskLevel?: number;
    ltv?: number;
    segmentId?: string;
  };

  @Column({ name: 'content_optimization', type: 'jsonb', nullable: true })
  contentOptimization: {
    subjectLineVariations: string[];
    contentVariations: string[];
    ctaVariations: string[];
    imageVariations: string[];
    lengthOptimization: {
      subject: number;
      body: number;
      recommended: boolean;
    };
    readabilityScore: number;
    sentimentScore: number;
    urgencyScore: number;
  };

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Column({ name: 'next_retry_at', type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ name: 'is_automated', type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({ name: 'is_personalized', type: 'boolean', default: false })
  isPersonalized: boolean;

  @Column({ name: 'is_a_b_test', type: 'boolean', default: false })
  isAbTest: boolean;

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

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
  isInIndonesianBusinessHours(): boolean {
    if (!this.indonesianContext?.regionalFactors) {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();

      // Standard Indonesian business hours
      if (day >= 1 && day <= 5) {
        return hour >= 9 && hour <= 18;
      } else if (day === 6) {
        return hour >= 9 && hour <= 14;
      }
      return false;
    }

    return this.indonesianContext.businessContext.businessHours;
  }

  isCulturallyAppropriate(): boolean {
    if (!this.indonesianContext?.culturalFactors) {
      return true; // Default to appropriate if no context
    }

    return (
      this.indonesianContext.culturalFactors.localCustomsRespected &&
      this.indonesianContext.culturalFactors.religiousConsiderations !== false
    );
  }

  getOptimalDeliveryTime(): Date {
    const now = new Date();
    const timezone =
      this.indonesianContext?.regionalFactors?.timezone || 'Asia/Jakarta';

    // Default optimal time: 10 AM local time on weekdays
    const optimal = new Date();
    optimal.setHours(10, 0, 0, 0);

    // Adjust for weekends
    if (optimal.getDay() === 0) {
      // Sunday
      optimal.setDate(optimal.getDate() + 1); // Move to Monday
    } else if (optimal.getDay() === 6) {
      // Saturday
      optimal.setDate(optimal.getDate() + 2); // Move to Monday
    }

    // Consider if it's past optimal time today
    if (optimal < now) {
      optimal.setDate(optimal.getDate() + 1);
      // Skip weekends again
      if (optimal.getDay() === 0) {
        optimal.setDate(optimal.getDate() + 1);
      } else if (optimal.getDay() === 6) {
        optimal.setDate(optimal.getDate() + 2);
      }
    }

    return optimal;
  }

  calculateEngagementScore(): number {
    let score = 0;
    let factors = 0;

    // Delivery factor
    if (this.deliveredAt) {
      score += 25;
      factors++;
    }

    // Open factor
    if (this.openedAt) {
      score += 35;
      factors++;

      // Quick open bonus
      if (this.sentAt && this.openedAt) {
        const openTime = this.openedAt.getTime() - this.sentAt.getTime();
        if (openTime < 3600000) {
          // Opened within 1 hour
          score += 10;
        }
      }
    }

    // Click factor
    if (this.clickedAt) {
      score += 25;
      factors++;
    }

    // Reply factor
    if (this.repliedAt) {
      score += 40;
      factors++;
    }

    // Tracking data bonus
    if (this.trackingData) {
      if (this.trackingData.timeSpentReading > 30000) {
        // 30+ seconds
        score += 15;
        factors++;
      }

      if (this.trackingData.forwardCount > 0) {
        score += 20;
        factors++;
      }
    }

    // Indonesian context bonus
    if (this.isCulturallyAppropriate()) {
      score += 10;
      factors++;
    }

    return factors > 0 ? Math.min(100, score) : 0;
  }

  getConversionValue(): number {
    return (
      this.communicationMetrics?.conversionValue ||
      this.businessContext?.ltv ||
      0
    );
  }

  getPersonalizationEffectiveness(): number {
    if (!this.isPersonalized || !this.personalizationData) {
      return 0;
    }

    return this.personalizationData.personalizationScore || 0;
  }

  getIndonesianLocalizationScore(): number {
    if (!this.indonesianContext) {
      return 0;
    }

    let score = 0;
    const cultural = this.indonesianContext.culturalFactors;

    if (cultural.language === 'id') score += 25;
    if (cultural.localCustomsRespected) score += 20;
    if (cultural.religiousConsiderations) score += 15;
    if (cultural.familyContextIncluded) score += 10;
    if (cultural.culturalEventRelevance.length > 0) score += 15;

    const business = this.indonesianContext.businessContext;
    if (business.localPaymentMethodsReferenced) score += 10;
    if (business.indonesianBusinessEtiquette) score += 5;

    return Math.min(100, score);
  }

  shouldRetry(): boolean {
    if (
      this.status === CommunicationStatus.FAILED &&
      this.retryCount < this.maxRetries
    ) {
      const now = new Date();
      if (this.nextRetryAt && this.nextRetryAt <= now) {
        return true;
      }
    }

    return false;
  }

  scheduleNextRetry(): void {
    if (this.retryCount >= this.maxRetries) {
      return;
    }

    // Exponential backoff: 1 hour, 4 hours, 24 hours
    const delays = [3600000, 14400000, 86400000]; // in milliseconds
    const delay = delays[Math.min(this.retryCount, delays.length - 1)];

    this.nextRetryAt = new Date(Date.now() + delay);
    this.retryCount++;
  }

  getRecommendedActions(): string[] {
    const actions = [];

    if (this.status === CommunicationStatus.SENT && !this.openedAt) {
      const hoursSinceSent = this.sentAt
        ? (Date.now() - this.sentAt.getTime()) / (1000 * 60 * 60)
        : 0;

      if (hoursSinceSent > 24) {
        actions.push('Consider follow-up with different subject line');
      }
    }

    if (this.openedAt && !this.clickedAt) {
      actions.push('Improve call-to-action or content relevance');
    }

    if (!this.isCulturallyAppropriate()) {
      actions.push('Review content for Indonesian cultural sensitivity');
    }

    const engagementScore = this.calculateEngagementScore();
    if (engagementScore < 30) {
      actions.push('Review timing, content, or personalization');
    }

    if (
      this.communicationType === CommunicationType.EMAIL &&
      this.indonesianContext?.technicalContext?.whatsappBusinessOptimized
    ) {
      actions.push('Consider switching to WhatsApp for better engagement');
    }

    return actions;
  }

  getOptimizationOpportunities(): Array<{
    area: string;
    impact: number;
    recommendation: string;
  }> {
    const opportunities = [];

    // Timing optimization
    if (!this.isInIndonesianBusinessHours()) {
      opportunities.push({
        area: 'timing',
        impact: 25,
        recommendation:
          'Send during Indonesian business hours for better open rates',
      });
    }

    // Content optimization
    const localizationScore = this.getIndonesianLocalizationScore();
    if (localizationScore < 70) {
      opportunities.push({
        area: 'localization',
        impact: 30,
        recommendation: 'Improve Indonesian cultural relevance and language',
      });
    }

    // Channel optimization
    if (
      this.communicationType === CommunicationType.EMAIL &&
      this.indonesianContext?.technicalContext?.deviceOptimization === 'mobile'
    ) {
      opportunities.push({
        area: 'channel',
        impact: 20,
        recommendation: 'Consider mobile-first channels like WhatsApp or SMS',
      });
    }

    // Personalization optimization
    const personalizationScore = this.getPersonalizationEffectiveness();
    if (personalizationScore < 50) {
      opportunities.push({
        area: 'personalization',
        impact: 35,
        recommendation:
          'Increase personalization based on customer segment and behavior',
      });
    }

    return opportunities.sort((a, b) => b.impact - a.impact);
  }

  calculateROI(): number {
    const conversionValue = this.getConversionValue();
    const cost = this.integrationData?.costData?.cost || 0;

    if (cost === 0) return conversionValue > 0 ? Infinity : 0;

    return ((conversionValue - cost) / cost) * 100;
  }

  getIndonesianContextSummary(): string {
    const context: string[] = [];

    if (this.indonesianContext?.culturalFactors?.language === 'id') {
      context.push('Bahasa Indonesia');
    }

    if (this.isInIndonesianBusinessHours()) {
      context.push('Business hours');
    }

    if (this.indonesianContext?.businessContext?.ramadanAdjustment) {
      context.push('Ramadan aware');
    }

    if (
      this.indonesianContext?.businessContext?.localPaymentMethodsReferenced
    ) {
      context.push('Local payments');
    }

    if (this.indonesianContext?.technicalContext?.whatsappBusinessOptimized) {
      context.push('WhatsApp optimized');
    }

    return context.join(', ') || 'Standard context';
  }
}
