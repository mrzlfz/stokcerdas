import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import {
  CommunicationType,
  CommunicationChannel,
} from './customer-communication.entity';

export enum TemplateStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DEPRECATED = 'deprecated',
}

export enum TemplateCategory {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
  SUPPORT = 'support',
  ONBOARDING = 'onboarding',
  RETENTION = 'retention',
  WINBACK = 'winback',
  SEASONAL = 'seasonal',
  EDUCATIONAL = 'educational',
  SURVEY = 'survey',
  ANNOUNCEMENT = 'announcement',
  PROMOTIONAL = 'promotional',
}

export enum TemplateLanguage {
  INDONESIAN = 'id',
  ENGLISH = 'en',
  BILINGUAL = 'bilingual',
}

export enum TemplateFormalityLevel {
  VERY_FORMAL = 'very_formal',
  FORMAL = 'formal',
  NEUTRAL = 'neutral',
  INFORMAL = 'informal',
  VERY_INFORMAL = 'very_informal',
}

export interface TemplateVariables {
  customer: {
    firstName?: boolean;
    lastName?: boolean;
    fullName?: boolean;
    email?: boolean;
    phone?: boolean;
    companyName?: boolean;
    loyaltyTier?: boolean;
    segment?: boolean;
    lastOrderDate?: boolean;
    totalOrders?: boolean;
    lifetimeValue?: boolean;
  };
  order: {
    orderNumber?: boolean;
    orderDate?: boolean;
    orderAmount?: boolean;
    orderStatus?: boolean;
    shippingAddress?: boolean;
    trackingNumber?: boolean;
    estimatedDelivery?: boolean;
    paymentMethod?: boolean;
  };
  product: {
    productName?: boolean;
    productImage?: boolean;
    productPrice?: boolean;
    productDescription?: boolean;
    productCategory?: boolean;
    productBrand?: boolean;
    productUrl?: boolean;
    productRecommendations?: boolean;
  };
  business: {
    companyName?: boolean;
    companyLogo?: boolean;
    contactInfo?: boolean;
    websiteUrl?: boolean;
    socialMediaLinks?: boolean;
    storeLocation?: boolean;
    businessHours?: boolean;
  };
  indonesian: {
    localGreeting?: boolean;
    culturalReferences?: boolean;
    localPaymentMethods?: boolean;
    regionalContent?: boolean;
    religiousGreetings?: boolean;
    familyReferences?: boolean;
    localHolidays?: boolean;
    bahasaIndonesiaTerms?: boolean;
  };
  dynamic: {
    currentDate?: boolean;
    currentTime?: boolean;
    season?: boolean;
    weather?: boolean;
    exchangeRate?: boolean;
    promotionalOffers?: boolean;
    personalizedRecommendations?: boolean;
    behavioralTriggers?: boolean;
  };
}

export interface TemplatePersonalization {
  segmentBased: {
    enabled: boolean;
    segments: Array<{
      segmentId: string;
      customContent: string;
      variables: Record<string, any>;
    }>;
  };
  behaviorBased: {
    enabled: boolean;
    triggers: Array<{
      behavior: string;
      condition: any;
      customContent: string;
      variables: Record<string, any>;
    }>;
  };
  locationBased: {
    enabled: boolean;
    regions: Array<{
      region: string;
      customContent: string;
      localizedVariables: Record<string, any>;
    }>;
  };
  languageBased: {
    enabled: boolean;
    languages: Array<{
      language: string;
      content: string;
      variables: Record<string, any>;
    }>;
  };
  timeBased: {
    enabled: boolean;
    schedules: Array<{
      timeRange: string;
      customContent: string;
      seasonalVariables: Record<string, any>;
    }>;
  };
}

export interface TemplateIndonesianContext {
  cultural: {
    religiousSensitive: boolean;
    ramadanAppropriate: boolean;
    culturalEventAware: boolean;
    familyOriented: boolean;
    communityFocused: boolean;
    respectfulLanguage: boolean;
    localCustomsConsidered: boolean;
  };
  linguistic: {
    language: TemplateLanguage;
    formalityLevel: TemplateFormalityLevel;
    localTerms: string[];
    avoidedPhrases: string[];
    culturalNuances: string[];
    regionalDialects: string[];
  };
  business: {
    localPaymentMethods: string[];
    preferredCurrency: string;
    taxInclusivePricing: boolean;
    shippingOptions: string[];
    customerServiceNumbers: string[];
    businessEtiquette: string[];
  };
  digital: {
    mobileOptimized: boolean;
    whatsappFormatting: boolean;
    socialMediaTags: string[];
    localPlatformIntegration: string[];
    dataUsageOptimized: boolean;
  };
}

export interface TemplateAnalytics {
  usage: {
    totalSent: number;
    lastUsedDate: Date;
    usageFrequency: number;
    campaignsUsed: string[];
    averagePerformance: number;
  };
  performance: {
    openRate: number;
    clickThroughRate: number;
    conversionRate: number;
    unsubscribeRate: number;
    responseRate: number;
    engagementScore: number;
  };
  segmentPerformance: {
    byAge: Record<string, number>;
    byGender: Record<string, number>;
    byRegion: Record<string, number>;
    byLoyaltyTier: Record<string, number>;
    bySegment: Record<string, number>;
  };
  abTestResults: Array<{
    testId: string;
    variant: string;
    performance: number;
    sampleSize: number;
    confidence: number;
    winner: boolean;
  }>;
  optimization: {
    bestSubjectLines: string[];
    topPerformingContent: string[];
    optimalSendTimes: string[];
    effectivePersonalization: string[];
    indonesianOptimizations: string[];
  };
}

export interface TemplateCompliance {
  dataProtection: {
    gdprCompliant: boolean;
    uuPdpCompliant: boolean;
    consentRequired: boolean;
    dataProcessingLegal: boolean;
    retentionPeriod: number;
  };
  marketing: {
    canSpamCompliant: boolean;
    unsubscribeIncluded: boolean;
    senderIdentification: boolean;
    truthfulSubjectLine: boolean;
    commercialIdentification: boolean;
  };
  indonesian: {
    kominfoCertified: boolean;
    localAdvertisingStandards: boolean;
    culturallyAppropriate: boolean;
    languageRegulationCompliant: boolean;
    businessLicenseReferences: boolean;
  };
}

@Entity('communication_templates')
@Index(['tenantId', 'templateType'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'language'])
@Index(['tenantId', 'formalityLevel'])
@Index(['tenantId', 'isDeleted'])
export class CommunicationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'template_name', length: 255 })
  templateName: string;

  @Column({ name: 'template_description', type: 'text', nullable: true })
  templateDescription: string;

  @Column({
    type: 'enum',
    enum: CommunicationType,
    name: 'template_type',
  })
  templateType: CommunicationType;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    name: 'category',
  })
  category: TemplateCategory;

  @Column({
    type: 'enum',
    enum: CommunicationChannel,
    name: 'communication_channel',
  })
  communicationChannel: CommunicationChannel;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.DRAFT,
    name: 'status',
  })
  status: TemplateStatus;

  @Column({
    type: 'enum',
    enum: TemplateLanguage,
    default: TemplateLanguage.INDONESIAN,
    name: 'language',
  })
  language: TemplateLanguage;

  @Column({
    type: 'enum',
    enum: TemplateFormalityLevel,
    default: TemplateFormalityLevel.NEUTRAL,
    name: 'formality_level',
  })
  formalityLevel: TemplateFormalityLevel;

  @Column({ name: 'subject_template', length: 500, nullable: true })
  subjectTemplate: string;

  @Column({ name: 'content_template', type: 'text' })
  contentTemplate: string;

  @Column({ name: 'html_template', type: 'text', nullable: true })
  htmlTemplate: string;

  @Column({ name: 'preview_text', length: 255, nullable: true })
  previewText: string;

  @Column({ name: 'variables_config', type: 'jsonb' })
  variablesConfig: TemplateVariables;

  @Column({ name: 'personalization_config', type: 'jsonb', nullable: true })
  personalizationConfig: TemplatePersonalization;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: TemplateIndonesianContext;

  @Column({ name: 'template_analytics', type: 'jsonb', nullable: true })
  templateAnalytics: TemplateAnalytics;

  @Column({ name: 'compliance_settings', type: 'jsonb', nullable: true })
  complianceSettings: TemplateCompliance;

  @Column({ name: 'styling_config', type: 'jsonb', nullable: true })
  stylingConfig: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      text: string;
      background: string;
    };
    fonts: {
      primary: string;
      secondary: string;
      size: Record<string, string>;
    };
    layout: {
      width: string;
      padding: string;
      margin: string;
      borderRadius: string;
    };
    branding: {
      logo: string;
      logoPosition: string;
      footerContent: string;
      socialLinks: Record<string, string>;
    };
    mobile: {
      responsive: boolean;
      breakpoints: Record<string, string>;
      optimizations: string[];
    };
  };

  @Column({ name: 'automation_triggers', type: 'jsonb', nullable: true })
  automationTriggers: Array<{
    trigger: string;
    condition: any;
    delay: number;
    priority: number;
    enabled: boolean;
  }>;

  @Column({ name: 'a_b_test_variants', type: 'jsonb', nullable: true })
  abTestVariants: Array<{
    id: string;
    name: string;
    subjectTemplate?: string;
    contentTemplate: string;
    percentage: number;
    active: boolean;
    performance?: any;
  }>;

  @Column({ name: 'approval_workflow', type: 'jsonb', nullable: true })
  approvalWorkflow: {
    required: boolean;
    approvers: string[];
    currentStep: number;
    status: string;
    approvalHistory: Array<{
      approver: string;
      action: string;
      timestamp: Date;
      comments?: string;
    }>;
  };

  @Column({ name: 'version_history', type: 'jsonb', nullable: true })
  versionHistory: Array<{
    version: string;
    changes: string;
    author: string;
    timestamp: Date;
    templateSnapshot: any;
  }>;

  @Column({ name: 'usage_restrictions', type: 'jsonb', nullable: true })
  usageRestrictions: {
    maxUsesPerDay: number;
    maxUsesPerMonth: number;
    allowedCampaignTypes: string[];
    restrictedSegments: string[];
    timeRestrictions: Array<{
      startTime: string;
      endTime: string;
      timezone: string;
    }>;
    frequencyCapping: {
      enabled: boolean;
      cooldownHours: number;
    };
  };

  @Column({ name: 'integration_settings', type: 'jsonb', nullable: true })
  integrationSettings: {
    externalSystems: Record<string, any>;
    webhooks: string[];
    apiEndpoints: string[];
    dynamicContentSources: string[];
    realTimeDataFeeds: string[];
  };

  @Column({ name: 'performance_goals', type: 'jsonb', nullable: true })
  performanceGoals: {
    targetOpenRate: number;
    targetClickRate: number;
    targetConversionRate: number;
    targetEngagement: number;
    benchmarkComparison: boolean;
    alertThresholds: Record<string, number>;
  };

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'is_system_template', type: 'boolean', default: false })
  isSystemTemplate: boolean;

  @Column({ name: 'is_shared', type: 'boolean', default: false })
  isShared: boolean;

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

  // Helper methods for Indonesian business context
  isIndonesianOptimized(): boolean {
    return (
      this.language === TemplateLanguage.INDONESIAN &&
      this.indonesianContext?.cultural?.localCustomsConsidered === true &&
      this.indonesianContext?.business?.localPaymentMethods?.length > 0
    );
  }

  isCulturallyAppropriate(): boolean {
    if (!this.indonesianContext?.cultural) {
      return true; // Default to appropriate if no context
    }

    const cultural = this.indonesianContext.cultural;
    return (
      cultural.respectfulLanguage &&
      cultural.localCustomsConsidered &&
      cultural.religiousSensitive !== false
    );
  }

  isRamadanAppropriate(): boolean {
    return (
      this.indonesianContext?.cultural?.ramadanAppropriate === true ||
      this.tags?.includes('ramadan') ||
      this.templateName.toLowerCase().includes('ramadan')
    );
  }

  getIndonesianOptimizationScore(): number {
    if (!this.indonesianContext) {
      return 0;
    }

    let score = 0;
    const cultural = this.indonesianContext.cultural;
    const linguistic = this.indonesianContext.linguistic;
    const business = this.indonesianContext.business;
    const digital = this.indonesianContext.digital;

    // Cultural factors (40%)
    if (cultural.respectfulLanguage) score += 10;
    if (cultural.localCustomsConsidered) score += 10;
    if (cultural.religiousSensitive) score += 10;
    if (cultural.familyOriented) score += 10;

    // Linguistic factors (30%)
    if (linguistic.language === TemplateLanguage.INDONESIAN) score += 15;
    if (linguistic.localTerms.length > 0) score += 10;
    if (linguistic.formalityLevel !== TemplateFormalityLevel.VERY_INFORMAL)
      score += 5;

    // Business factors (20%)
    if (business.localPaymentMethods.length > 0) score += 10;
    if (business.preferredCurrency === 'IDR') score += 5;
    if (business.businessEtiquette.length > 0) score += 5;

    // Digital factors (10%)
    if (digital.mobileOptimized) score += 5;
    if (digital.whatsappFormatting) score += 3;
    if (digital.dataUsageOptimized) score += 2;

    return Math.min(100, score);
  }

  getPerformanceScore(): number {
    if (!this.templateAnalytics?.performance) {
      return 0;
    }

    const perf = this.templateAnalytics.performance;
    const weights = {
      openRate: 0.25,
      clickThroughRate: 0.25,
      conversionRate: 0.3,
      responseRate: 0.15,
      unsubscribeRate: -0.05, // Negative weight
    };

    let score = 0;
    score += (perf.openRate || 0) * weights.openRate;
    score += (perf.clickThroughRate || 0) * weights.clickThroughRate;
    score += (perf.conversionRate || 0) * weights.conversionRate;
    score += (perf.responseRate || 0) * weights.responseRate;
    score += (perf.unsubscribeRate || 0) * weights.unsubscribeRate;

    return Math.max(0, Math.min(100, score));
  }

  canBeUsed(): boolean {
    if (this.status !== TemplateStatus.ACTIVE) {
      return false;
    }

    if (this.usageRestrictions) {
      const now = new Date();
      const today = now.toDateString();

      // Check daily usage limit
      if (this.usageRestrictions.maxUsesPerDay > 0) {
        // This would need to be implemented with actual usage tracking
        // For now, assume it's within limits
      }

      // Check time restrictions
      if (this.usageRestrictions.timeRestrictions?.length > 0) {
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const isWithinAllowedTime =
          this.usageRestrictions.timeRestrictions.some(restriction => {
            const startTime = parseInt(restriction.startTime.replace(':', ''));
            const endTime = parseInt(restriction.endTime.replace(':', ''));
            return currentTime >= startTime && currentTime <= endTime;
          });

        if (!isWithinAllowedTime) {
          return false;
        }
      }
    }

    return true;
  }

  renderTemplate(variables: Record<string, any>): {
    subject?: string;
    content: string;
    htmlContent?: string;
  } {
    const result = {
      subject: this.subjectTemplate,
      content: this.contentTemplate,
      htmlContent: this.htmlTemplate,
    };

    // Simple variable replacement (in real implementation, use a proper template engine)
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      if (result.subject) {
        result.subject = result.subject.replace(
          new RegExp(placeholder, 'g'),
          String(value),
        );
      }
      result.content = result.content.replace(
        new RegExp(placeholder, 'g'),
        String(value),
      );
      if (result.htmlContent) {
        result.htmlContent = result.htmlContent.replace(
          new RegExp(placeholder, 'g'),
          String(value),
        );
      }
    });

    // Apply Indonesian context if available
    if (this.indonesianContext?.linguistic?.localTerms) {
      this.indonesianContext.linguistic.localTerms.forEach(term => {
        // Apply local term replacements
        // This would be implemented with proper localization logic
      });
    }

    return result;
  }

  getRecommendedVariables(customerData: any): Record<string, any> {
    const variables: Record<string, any> = {};

    // Customer variables
    if (this.variablesConfig.customer) {
      if (this.variablesConfig.customer.firstName && customerData.firstName) {
        variables.firstName = customerData.firstName;
      }
      if (this.variablesConfig.customer.fullName && customerData.fullName) {
        variables.fullName = customerData.fullName;
      }
      if (
        this.variablesConfig.customer.loyaltyTier &&
        customerData.loyaltyTier
      ) {
        variables.loyaltyTier = customerData.loyaltyTier;
      }
    }

    // Indonesian variables
    if (this.variablesConfig.indonesian) {
      if (this.variablesConfig.indonesian.localGreeting) {
        const hour = new Date().getHours();
        if (hour < 12) {
          variables.localGreeting = 'Selamat pagi';
        } else if (hour < 15) {
          variables.localGreeting = 'Selamat siang';
        } else if (hour < 18) {
          variables.localGreeting = 'Selamat sore';
        } else {
          variables.localGreeting = 'Selamat malam';
        }
      }

      if (this.variablesConfig.indonesian.religiousGreetings) {
        // Check if it's a religious holiday or Friday
        const today = new Date();
        if (today.getDay() === 5) {
          // Friday
          variables.religiousGreeting = 'Semoga ibadah Anda lancar';
        }
      }
    }

    // Dynamic variables
    if (this.variablesConfig.dynamic) {
      if (this.variablesConfig.dynamic.currentDate) {
        variables.currentDate = new Date().toLocaleDateString('id-ID');
      }
      if (this.variablesConfig.dynamic.season) {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) {
          variables.season = 'Ramadan'; // Approximate
        } else if (month >= 12 || month <= 2) {
          variables.season = 'Musim Liburan';
        }
      }
    }

    return variables;
  }

  getOptimizationRecommendations(): Array<{
    area: string;
    priority: number;
    recommendation: string;
    indonesianSpecific: boolean;
  }> {
    const recommendations = [];

    // Performance-based recommendations
    const performanceScore = this.getPerformanceScore();
    if (performanceScore < 60) {
      recommendations.push({
        area: 'overall_performance',
        priority: 90,
        recommendation: 'Review and optimize template content and structure',
        indonesianSpecific: false,
      });
    }

    // Indonesian optimization recommendations
    const indonesianScore = this.getIndonesianOptimizationScore();
    if (indonesianScore < 80) {
      recommendations.push({
        area: 'indonesian_localization',
        priority: 85,
        recommendation:
          'Improve Indonesian cultural adaptation and language usage',
        indonesianSpecific: true,
      });
    }

    // Language and formality recommendations
    if (
      this.language === TemplateLanguage.ENGLISH &&
      this.indonesianContext?.linguistic?.formalityLevel ===
        TemplateFormalityLevel.VERY_INFORMAL
    ) {
      recommendations.push({
        area: 'language_appropriateness',
        priority: 80,
        recommendation:
          'Consider using Bahasa Indonesia with appropriate formality level',
        indonesianSpecific: true,
      });
    }

    // Mobile optimization
    if (!this.indonesianContext?.digital?.mobileOptimized) {
      recommendations.push({
        area: 'mobile_optimization',
        priority: 75,
        recommendation:
          'Optimize template for mobile devices (85% of Indonesian users are mobile-first)',
        indonesianSpecific: true,
      });
    }

    // Cultural sensitivity
    if (!this.isCulturallyAppropriate()) {
      recommendations.push({
        area: 'cultural_sensitivity',
        priority: 85,
        recommendation:
          'Review content for Indonesian cultural sensitivity and religious considerations',
        indonesianSpecific: true,
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  createNewVersion(changes: string, author: string): void {
    if (!this.versionHistory) {
      this.versionHistory = [];
    }

    const newVersion = `v${this.versionHistory.length + 1}.0`;

    this.versionHistory.push({
      version: newVersion,
      changes,
      author,
      timestamp: new Date(),
      templateSnapshot: {
        subjectTemplate: this.subjectTemplate,
        contentTemplate: this.contentTemplate,
        htmlTemplate: this.htmlTemplate,
        variablesConfig: this.variablesConfig,
        personalizationConfig: this.personalizationConfig,
        indonesianContext: this.indonesianContext,
      },
    });

    // Keep only last 10 versions
    if (this.versionHistory.length > 10) {
      this.versionHistory = this.versionHistory.slice(-10);
    }
  }

  getUsageInsights(): {
    frequency: string;
    bestPerformingSegments: string[];
    optimalUsageTimes: string[];
    indonesianFactors: Record<string, any>;
  } {
    const insights = {
      frequency: 'unknown',
      bestPerformingSegments: [],
      optimalUsageTimes: [],
      indonesianFactors: {},
    };

    if (this.templateAnalytics?.usage) {
      const usage = this.templateAnalytics.usage;

      if (usage.usageFrequency > 20) {
        insights.frequency = 'high';
      } else if (usage.usageFrequency > 10) {
        insights.frequency = 'medium';
      } else if (usage.usageFrequency > 0) {
        insights.frequency = 'low';
      }
    }

    if (this.templateAnalytics?.segmentPerformance) {
      const segments = Object.entries(this.templateAnalytics.segmentPerformance)
        .sort(
          ([, a], [, b]) => (b as unknown as number) - (a as unknown as number),
        )
        .slice(0, 3)
        .map(([segment]) => segment);

      insights.bestPerformingSegments = segments;
    }

    if (this.templateAnalytics?.optimization?.optimalSendTimes) {
      insights.optimalUsageTimes =
        this.templateAnalytics.optimization.optimalSendTimes;
    }

    if (this.indonesianContext) {
      insights.indonesianFactors = {
        culturallyAppropriate: this.isCulturallyAppropriate(),
        ramadanReady: this.isRamadanAppropriate(),
        mobileOptimized: this.indonesianContext.digital?.mobileOptimized,
        localPaymentIntegrated:
          this.indonesianContext.business?.localPaymentMethods?.length > 0,
        optimizationScore: this.getIndonesianOptimizationScore(),
      };
    }

    return insights;
  }
}
