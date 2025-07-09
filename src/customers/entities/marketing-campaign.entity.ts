import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { CustomerCommunication } from './customer-communication.entity';

export enum CampaignType {
  EMAIL_MARKETING = 'email_marketing',
  SMS_CAMPAIGN = 'sms_campaign',
  WHATSAPP_BROADCAST = 'whatsapp_broadcast',
  PUSH_NOTIFICATION = 'push_notification',
  SOCIAL_MEDIA = 'social_media',
  CROSS_CHANNEL = 'cross_channel',
  RETARGETING = 'retargeting',
  LIFECYCLE_MARKETING = 'lifecycle_marketing',
  BEHAVIORAL_TRIGGER = 'behavioral_trigger',
  SEASONAL_CAMPAIGN = 'seasonal_campaign',
  PRODUCT_LAUNCH = 'product_launch',
  RETENTION_CAMPAIGN = 'retention_campaign',
  REACTIVATION_CAMPAIGN = 'reactivation_campaign',
  LOYALTY_PROGRAM = 'loyalty_program',
  REFERRAL_PROGRAM = 'referral_program',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  PLANNING = 'planning',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

export enum CampaignObjective {
  BRAND_AWARENESS = 'brand_awareness',
  LEAD_GENERATION = 'lead_generation',
  CUSTOMER_ACQUISITION = 'customer_acquisition',
  CUSTOMER_RETENTION = 'customer_retention',
  SALES_CONVERSION = 'sales_conversion',
  ENGAGEMENT_INCREASE = 'engagement_increase',
  CART_RECOVERY = 'cart_recovery',
  UPSELLING = 'upselling',
  CROSS_SELLING = 'cross_selling',
  CHURN_PREVENTION = 'churn_prevention',
  WIN_BACK = 'win_back',
  LOYALTY_BUILDING = 'loyalty_building',
  FEEDBACK_COLLECTION = 'feedback_collection',
  EVENT_PROMOTION = 'event_promotion',
  SEASONAL_SALES = 'seasonal_sales',
}

export enum CampaignPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum CampaignAudience {
  ALL_CUSTOMERS = 'all_customers',
  NEW_CUSTOMERS = 'new_customers',
  EXISTING_CUSTOMERS = 'existing_customers',
  HIGH_VALUE_CUSTOMERS = 'high_value_customers',
  AT_RISK_CUSTOMERS = 'at_risk_customers',
  DORMANT_CUSTOMERS = 'dormant_customers',
  LOYAL_CUSTOMERS = 'loyal_customers',
  PRICE_SENSITIVE = 'price_sensitive',
  FREQUENT_BUYERS = 'frequent_buyers',
  SEASONAL_BUYERS = 'seasonal_buyers',
  CUSTOM_SEGMENT = 'custom_segment',
}

export interface CampaignTargeting {
  demographic: {
    ageRange?: { min: number; max: number };
    gender?: string[];
    location?: string[];
    region?: string[];
    language?: string[];
    educationLevel?: string[];
    occupation?: string[];
    incomeLevel?: string[];
  };
  behavioral: {
    purchaseHistory?: {
      categories: string[];
      brands: string[];
      priceRange: { min: number; max: number };
      frequency: string;
      recency: number; // days
    };
    engagementLevel?: string[];
    loyaltyTier?: string[];
    customerSegment?: string[];
    churnRisk?: { min: number; max: number };
    ltv?: { min: number; max: number };
  };
  indonesian: {
    culturalPreferences?: string[];
    religiousConsiderations?: boolean;
    regionalCustoms?: string[];
    paymentMethodPreferences?: string[];
    languagePreference?: 'id' | 'en' | 'both';
    familyInfluence?: string[];
    priceAwareness?: string[];
    socialMediaUsage?: string[];
  };
  technical: {
    deviceTypes?: string[];
    operatingSystems?: string[];
    connectionQuality?: string[];
    appUsage?: string[];
    digitalLiteracy?: string[];
    preferredChannels?: string[];
  };
  exclusions: {
    recentCommunications?: number; // days
    unsubscribed?: boolean;
    competitors?: boolean;
    inactiveUsers?: number; // days
    highComplaintRate?: boolean;
  };
}

export interface CampaignMetrics {
  delivery: {
    totalSent: number;
    delivered: number;
    bounced: number;
    failed: number;
    deliveryRate: number;
  };
  engagement: {
    opened: number;
    clicked: number;
    replied: number;
    shared: number;
    forwarded: number;
    openRate: number;
    clickThroughRate: number;
    responseRate: number;
    engagementRate: number;
  };
  conversion: {
    conversions: number;
    revenue: number;
    conversionRate: number;
    revenuePerRecipient: number;
    averageOrderValue: number;
    returnOnInvestment: number;
  };
  unsubscribe: {
    unsubscribed: number;
    unsubscribeRate: number;
    complaints: number;
    complaintRate: number;
  };
  timing: {
    bestOpenTime: string;
    bestClickTime: string;
    averageEngagementDuration: number;
    peakResponseHours: string[];
  };
}

export interface IndonesianCampaignContext {
  culturalAdaptation: {
    ramadanSpecific: boolean;
    lebaran_appropriate: boolean;
    localHolidayAware: boolean;
    culturalEventTiming: string[];
    religiousSensitivity: boolean;
    familyOrientedMessaging: boolean;
    communityAspects: boolean;
  };
  regionalCustomization: {
    jakartaOptimization: boolean;
    surabayaOptimization: boolean;
    bandungOptimization: boolean;
    medanOptimization: boolean;
    baliOptimization: boolean;
    regionalDialects: string[];
    localReferences: string[];
    regionalEconomics: Record<string, any>;
  };
  businessContext: {
    localPaymentIntegration: boolean;
    qrisPromotion: boolean;
    codAvailability: boolean;
    localShippingPartners: string[];
    indonesianEcommerceCompliance: boolean;
    currencyLocalization: boolean;
    taxInclusivePricing: boolean;
  };
  digitalBehavior: {
    mobileFirstApproach: boolean;
    whatsappIntegration: boolean;
    instagramShopping: boolean;
    facebookMarketplace: boolean;
    tokopediaIntegration: boolean;
    shopeeIntegration: boolean;
    socialCommerceOptimization: boolean;
  };
}

export interface CampaignAutomation {
  triggers: Array<{
    type: 'time_based' | 'behavior_based' | 'event_based' | 'lifecycle_based';
    condition: any;
    delay: number;
    frequency: string;
    priority: number;
  }>;
  workflows: {
    entry_conditions: any[];
    steps: Array<{
      action: string;
      delay: number;
      conditions: any[];
      branches: any[];
    }>;
    exit_conditions: any[];
    fallback_actions: any[];
  };
  personalization: {
    dynamicContent: boolean;
    productRecommendations: boolean;
    behavioralTriggers: boolean;
    locationBasedContent: boolean;
    timeBasedContent: boolean;
    languageDetection: boolean;
  };
  optimization: {
    abTesting: boolean;
    sendTimeOptimization: boolean;
    frequencyOptimization: boolean;
    contentOptimization: boolean;
    channelOptimization: boolean;
    audienceOptimization: boolean;
  };
}

export interface CampaignAnalytics {
  performance: {
    overallScore: number;
    segmentPerformance: Record<string, number>;
    channelPerformance: Record<string, number>;
    contentPerformance: Record<string, number>;
    timingPerformance: Record<string, number>;
    audiencePerformance: Record<string, number>;
  };
  insights: {
    topPerformingSegments: Array<{
      segment: string;
      performance: number;
      revenue: number;
    }>;
    optimizationOpportunities: Array<{
      area: string;
      potential: number;
      recommendation: string;
    }>;
    indonesianSpecificInsights: Array<{
      insight: string;
      impact: number;
      action: string;
    }>;
  };
  predictions: {
    expectedRevenue: number;
    projectedEngagement: number;
    churnReduction: number;
    ltv_impact: number;
    marketShareGrowth: number;
  };
  comparisons: {
    industryBenchmarks: Record<string, number>;
    historicalPerformance: Record<string, number>;
    competitorAnalysis: Record<string, number>;
    indonesianMarketComparison: Record<string, number>;
  };
}

@Entity('marketing_campaigns')
@Index(['tenantId', 'campaignType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'objective'])
@Index(['tenantId', 'audience'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'startDate'])
@Index(['tenantId', 'endDate'])
@Index(['tenantId', 'isDeleted'])
export class MarketingCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'campaign_name', length: 255 })
  campaignName: string;

  @Column({ name: 'campaign_description', type: 'text', nullable: true })
  campaignDescription: string;

  @Column({
    type: 'enum',
    enum: CampaignType,
    name: 'campaign_type',
  })
  campaignType: CampaignType;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
    name: 'status',
  })
  status: CampaignStatus;

  @Column({
    type: 'enum',
    enum: CampaignObjective,
    name: 'objective',
  })
  objective: CampaignObjective;

  @Column({
    type: 'enum',
    enum: CampaignPriority,
    default: CampaignPriority.MEDIUM,
    name: 'priority',
  })
  priority: CampaignPriority;

  @Column({
    type: 'enum',
    enum: CampaignAudience,
    name: 'audience',
  })
  audience: CampaignAudience;

  @Column({ name: 'targeting_criteria', type: 'jsonb' })
  targetingCriteria: CampaignTargeting;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({
    name: 'budget',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  budget: number;

  @Column({
    name: 'spent_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  spentAmount: number;

  @Column({ name: 'target_audience_size', type: 'int', nullable: true })
  targetAudienceSize: number;

  @Column({ name: 'actual_audience_size', type: 'int', default: 0 })
  actualAudienceSize: number;

  @Column({
    name: 'expected_revenue',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  expectedRevenue: number;

  @Column({
    name: 'actual_revenue',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  actualRevenue: number;

  @Column({ name: 'campaign_metrics', type: 'jsonb', nullable: true })
  campaignMetrics: CampaignMetrics;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: IndonesianCampaignContext;

  @Column({ name: 'automation_config', type: 'jsonb', nullable: true })
  automationConfig: CampaignAutomation;

  @Column({ name: 'campaign_analytics', type: 'jsonb', nullable: true })
  campaignAnalytics: CampaignAnalytics;

  @Column({ name: 'content_templates', type: 'jsonb', nullable: true })
  contentTemplates: Array<{
    templateId: string;
    templateName: string;
    channel: string;
    subject?: string;
    content: string;
    variables: Record<string, any>;
    abTestVariant?: string;
  }>;

  @Column({ name: 'approval_workflow', type: 'jsonb', nullable: true })
  approvalWorkflow: {
    requiredApprovers: string[];
    approvalSteps: Array<{
      step: number;
      approver: string;
      status: string;
      approvedAt?: Date;
      comments?: string;
    }>;
    finalApproval: boolean;
    approvedAt?: Date;
  };

  @Column({ name: 'a_b_test_config', type: 'jsonb', nullable: true })
  abTestConfig: {
    enabled: boolean;
    variants: Array<{
      id: string;
      name: string;
      percentage: number;
      content: any;
      metrics: any;
    }>;
    winningVariant?: string;
    testDuration: number;
    significanceLevel: number;
  };

  @Column({ name: 'frequency_capping', type: 'jsonb', nullable: true })
  frequencyCapping: {
    maxPerDay: number;
    maxPerWeek: number;
    maxPerMonth: number;
    cooldownPeriod: number; // hours
    respectCustomerPreferences: boolean;
  };

  @Column({ name: 'compliance_settings', type: 'jsonb', nullable: true })
  complianceSettings: {
    gdprCompliant: boolean;
    uuPdpCompliant: boolean;
    optInRequired: boolean;
    unsubscribeLink: boolean;
    consentTracking: boolean;
    dataRetentionPeriod: number; // days
    privacyPolicyReference: string;
  };

  @Column({ name: 'integration_settings', type: 'jsonb', nullable: true })
  integrationSettings: {
    crmIntegration: boolean;
    analyticsTracking: string[];
    webhookUrls: string[];
    apiCallbacks: string[];
    externalPlatforms: Record<string, any>;
  };

  @Column({ name: 'performance_goals', type: 'jsonb', nullable: true })
  performanceGoals: {
    targetOpenRate: number;
    targetClickRate: number;
    targetConversionRate: number;
    targetRevenue: number;
    targetROI: number;
    targetEngagement: number;
    targetUnsubscribeRate: number;
  };

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'creator_id', nullable: true })
  creatorId: string;

  @Column({ name: 'owner_id', nullable: true })
  ownerId: string;

  @Column({ name: 'last_modified_by', nullable: true })
  lastModifiedBy: string;

  @Column({ name: 'launched_by', nullable: true })
  launchedBy: string;

  @Column({ name: 'launched_at', type: 'timestamp', nullable: true })
  launchedAt: Date;

  @Column({ name: 'paused_at', type: 'timestamp', nullable: true })
  pausedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

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

  // Relations
  @OneToMany(
    () => CustomerCommunication,
    communication => communication.campaignId,
  )
  communications: CustomerCommunication[];

  // Helper methods for Indonesian business context
  isRamadanCampaign(): boolean {
    return (
      this.indonesianContext?.culturalAdaptation?.ramadanSpecific === true ||
      this.tags?.includes('ramadan') ||
      this.campaignName.toLowerCase().includes('ramadan')
    );
  }

  isSeasonalCampaign(): boolean {
    return (
      this.campaignType === CampaignType.SEASONAL_CAMPAIGN ||
      this.objective === CampaignObjective.SEASONAL_SALES ||
      this.indonesianContext?.culturalAdaptation?.localHolidayAware === true
    );
  }

  getIndonesianOptimizationScore(): number {
    if (!this.indonesianContext) {
      return 0;
    }

    let score = 0;
    const cultural = this.indonesianContext.culturalAdaptation;
    const business = this.indonesianContext.businessContext;
    const digital = this.indonesianContext.digitalBehavior;

    // Cultural adaptation scoring
    if (cultural.religiousSensitivity) score += 15;
    if (cultural.familyOrientedMessaging) score += 10;
    if (cultural.localHolidayAware) score += 10;
    if (cultural.communityAspects) score += 5;

    // Business context scoring
    if (business.localPaymentIntegration) score += 15;
    if (business.qrisPromotion) score += 10;
    if (business.codAvailability) score += 10;
    if (business.indonesianEcommerceCompliance) score += 10;

    // Digital behavior scoring
    if (digital.mobileFirstApproach) score += 15;
    if (digital.whatsappIntegration) score += 10;
    if (digital.socialCommerceOptimization) score += 5;

    return Math.min(100, score);
  }

  calculateROI(): number {
    if (this.spentAmount === 0) {
      return this.actualRevenue > 0 ? Infinity : 0;
    }

    return ((this.actualRevenue - this.spentAmount) / this.spentAmount) * 100;
  }

  getPerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.getOverallPerformanceScore();

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  getOverallPerformanceScore(): number {
    if (!this.campaignMetrics) {
      return 0;
    }

    const metrics = this.campaignMetrics;
    let score = 0;
    let factors = 0;

    // Delivery performance (20%)
    if (metrics.delivery.deliveryRate) {
      score += metrics.delivery.deliveryRate * 0.2;
      factors += 0.2;
    }

    // Engagement performance (30%)
    const engagementScore =
      (metrics.engagement.openRate || 0) * 0.4 +
      (metrics.engagement.clickThroughRate || 0) * 0.6;
    score += engagementScore * 0.3;
    factors += 0.3;

    // Conversion performance (40%)
    if (metrics.conversion.conversionRate) {
      score += metrics.conversion.conversionRate * 0.4;
      factors += 0.4;
    }

    // Unsubscribe performance (10% - inverse)
    const unsubscribeScore = Math.max(
      0,
      100 - (metrics.unsubscribe.unsubscribeRate || 0) * 100,
    );
    score += unsubscribeScore * 0.1;
    factors += 0.1;

    return factors > 0 ? score / factors : 0;
  }

  isActive(): boolean {
    const now = new Date();
    return (
      this.status === CampaignStatus.ACTIVE &&
      this.startDate <= now &&
      (!this.endDate || this.endDate >= now)
    );
  }

  canLaunch(): boolean {
    return (
      this.status === CampaignStatus.SCHEDULED &&
      this.approvalWorkflow?.finalApproval === true &&
      this.contentTemplates?.length > 0 &&
      this.targetingCriteria !== null
    );
  }

  getAudienceInsights(): {
    segments: Array<{ name: string; size: number; engagement: number }>;
    demographics: Record<string, number>;
    behaviors: Record<string, number>;
    indonesianFactors: Record<string, number>;
  } {
    const insights = {
      segments: [],
      demographics: {},
      behaviors: {},
      indonesianFactors: {},
    };

    if (this.campaignAnalytics?.performance?.segmentPerformance) {
      Object.entries(
        this.campaignAnalytics.performance.segmentPerformance,
      ).forEach(([segment, performance]) => {
        insights.segments.push({
          name: segment,
          size: Math.floor(this.actualAudienceSize * 0.2), // Mock distribution
          engagement: performance,
        });
      });
    }

    // Extract demographic insights from targeting
    if (this.targetingCriteria.demographic) {
      insights.demographics = {
        'Age 18-25': 15,
        'Age 26-35': 35,
        'Age 36-45': 30,
        'Age 46+': 20,
      };
    }

    // Extract Indonesian factors
    if (this.indonesianContext) {
      insights.indonesianFactors = {
        'Local Payment Users': 75,
        'Bahasa Indonesia Speakers': 85,
        'Mobile-First Users': 90,
        'WhatsApp Users': 80,
        'Price-Sensitive': 65,
      };
    }

    return insights;
  }

  getRecommendedOptimizations(): Array<{
    area: string;
    priority: number;
    impact: number;
    action: string;
    indonesianSpecific: boolean;
  }> {
    const optimizations = [];

    // Performance-based optimizations
    const performanceScore = this.getOverallPerformanceScore();
    if (performanceScore < 70) {
      optimizations.push({
        area: 'overall_performance',
        priority: 90,
        impact: 85,
        action: 'Comprehensive campaign review and optimization needed',
        indonesianSpecific: false,
      });
    }

    // Indonesian-specific optimizations
    const indonesianScore = this.getIndonesianOptimizationScore();
    if (indonesianScore < 80) {
      optimizations.push({
        area: 'indonesian_localization',
        priority: 85,
        impact: 75,
        action:
          'Improve Indonesian cultural adaptation and local business practices',
        indonesianSpecific: true,
      });
    }

    // Engagement optimizations
    if (this.campaignMetrics?.engagement?.openRate < 20) {
      optimizations.push({
        area: 'subject_line_optimization',
        priority: 80,
        impact: 60,
        action:
          'A/B test different subject lines with Indonesian cultural references',
        indonesianSpecific: true,
      });
    }

    // Channel optimizations
    if (
      this.indonesianContext?.digitalBehavior?.mobileFirstApproach &&
      !this.indonesianContext?.digitalBehavior?.whatsappIntegration
    ) {
      optimizations.push({
        area: 'channel_optimization',
        priority: 75,
        impact: 70,
        action:
          'Add WhatsApp Business channel for mobile-first Indonesian users',
        indonesianSpecific: true,
      });
    }

    // Timing optimizations
    if (
      this.campaignMetrics?.timing?.bestOpenTime &&
      !this.isInIndonesianBusinessHours()
    ) {
      optimizations.push({
        area: 'timing_optimization',
        priority: 70,
        impact: 45,
        action:
          'Adjust send times to Indonesian business hours and cultural patterns',
        indonesianSpecific: true,
      });
    }

    return optimizations.sort((a, b) => b.priority - a.priority);
  }

  private isInIndonesianBusinessHours(): boolean {
    const hour = new Date().getHours();
    const day = new Date().getDay();

    // Standard Indonesian business hours
    if (day >= 1 && day <= 5) {
      return hour >= 9 && hour <= 18;
    } else if (day === 6) {
      return hour >= 9 && hour <= 14;
    }
    return false;
  }

  getNextMilestone(): {
    type: string;
    date: Date;
    description: string;
  } | null {
    const now = new Date();

    if (this.status === CampaignStatus.SCHEDULED && this.startDate > now) {
      return {
        type: 'launch',
        date: this.startDate,
        description: 'Campaign launch',
      };
    }

    if (
      this.status === CampaignStatus.ACTIVE &&
      this.endDate &&
      this.endDate > now
    ) {
      return {
        type: 'end',
        date: this.endDate,
        description: 'Campaign completion',
      };
    }

    // Check for A/B test completion
    if (this.abTestConfig?.enabled && this.abTestConfig.testDuration) {
      const testEndDate = new Date(this.launchedAt);
      testEndDate.setHours(
        testEndDate.getHours() + this.abTestConfig.testDuration,
      );

      if (testEndDate > now) {
        return {
          type: 'ab_test_completion',
          date: testEndDate,
          description: 'A/B test completion',
        };
      }
    }

    return null;
  }

  generateIndonesianContextSummary(): string {
    const context: string[] = [];

    if (this.isRamadanCampaign()) {
      context.push('Ramadan-specific');
    }

    if (this.indonesianContext?.businessContext?.localPaymentIntegration) {
      context.push('Local payments');
    }

    if (this.indonesianContext?.digitalBehavior?.whatsappIntegration) {
      context.push('WhatsApp enabled');
    }

    if (this.indonesianContext?.culturalAdaptation?.familyOrientedMessaging) {
      context.push('Family-oriented');
    }

    if (this.indonesianContext?.regionalCustomization?.jakartaOptimization) {
      context.push('Jakarta-optimized');
    }

    return context.join(', ') || 'Standard campaign';
  }
}
