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
import { CustomerTouchpoint } from './customer-touchpoint.entity';
import { CustomerInteraction } from './customer-interaction.entity';
import {
  CustomerJourneyStatus,
  CustomerJourneyType,
  CustomerJourneyChannel,
} from './customer-enums';

// ULTRATHINK: Enums moved to customer-enums.ts to prevent circular imports
// CustomerJourneyStatus, CustomerJourneyType, CustomerJourneyChannel now imported from shared file

export interface CustomerJourneyMetrics {
  totalTouchpoints: number;
  totalInteractions: number;
  journeyDurationHours: number;
  conversionRate: number;
  engagementScore: number;
  satisfactionScore: number;
  effortScore: number;
  netPromoterScore: number;
  journeyCompletionRate: number;
  averageResponseTime: number;
  touchpointEffectiveness: Record<string, number>;
  channelEffectiveness: Record<CustomerJourneyChannel, number>;
}

export interface CustomerJourneyIndonesianContext {
  culturalFactors: {
    respectfulCommunication: boolean;
    familyOrientedDecision: boolean;
    religiousConsiderations: string[];
    localLanguagePreference: string;
    culturalHolidayInfluence: string[];
  };
  regionalFactors: {
    region: string;
    timeZone: string;
    localBusinessHours: string;
    regionalPreferences: string[];
    logisticsAccessibility: string;
  };
  economicFactors: {
    economicSegment: string;
    pricesensitivity: number;
    paymentMethodPreferences: string[];
    purchasingPower: string;
  };
  digitalBehavior: {
    digitalLiteracy: string;
    preferredChannels: CustomerJourneyChannel[];
    mobileUsagePattern: string;
    socialMediaActivity: string;
  };
}

export interface CustomerJourneyAnalytics {
  pathAnalysis: {
    commonPaths: Array<{
      path: string[];
      frequency: number;
      conversionRate: number;
      averageDuration: number;
    }>;
    dropOffPoints: Array<{
      touchpoint: string;
      dropOffRate: number;
      reasons: string[];
    }>;
    conversionPaths: Array<{
      path: string[];
      conversionRate: number;
      averageValue: number;
    }>;
  };
  segmentAnalysis: {
    segment: string;
    journeyPatterns: string[];
    preferredChannels: CustomerJourneyChannel[];
    averageJourneyLength: number;
    conversionRate: number;
  };
  temporalAnalysis: {
    hourlyPattern: Record<string, number>;
    dailyPattern: Record<string, number>;
    weeklyPattern: Record<string, number>;
    monthlyPattern: Record<string, number>;
    seasonalInfluence: Record<string, number>;
  };
  indonesianMarketAnalysis: {
    ramadanEffect: {
      journeyLength: number;
      preferredTouchpoints: string[];
      conversionPattern: string;
    };
    regionalVariations: Record<
      string,
      {
        journeyCharacteristics: string[];
        preferredChannels: CustomerJourneyChannel[];
        conversionFactors: string[];
      }
    >;
    culturalInfluence: {
      decisionMakingPattern: string;
      familyInfluence: number;
      socialProofImportance: number;
    };
  };
}

@Entity('customer_journeys')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'journeyType'])
@Index(['tenantId', 'primaryChannel'])
@Index(['tenantId', 'startedAt'])
@Index(['tenantId', 'completedAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerJourney {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.journeys, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => CustomerTouchpoint, touchpoint => touchpoint.journey, {
    cascade: true,
  })
  touchpoints: CustomerTouchpoint[];

  @OneToMany(() => CustomerInteraction, interaction => interaction.journey, {
    cascade: true,
  })
  interactions: CustomerInteraction[];

  @Column({
    type: 'enum',
    enum: CustomerJourneyStatus,
    default: CustomerJourneyStatus.ACTIVE,
    name: 'status',
  })
  status: CustomerJourneyStatus;

  @Column({
    type: 'enum',
    enum: CustomerJourneyType,
    name: 'journey_type',
  })
  journeyType: CustomerJourneyType;

  @Column({
    type: 'enum',
    enum: CustomerJourneyChannel,
    name: 'primary_channel',
  })
  primaryChannel: CustomerJourneyChannel;

  @Column({ name: 'journey_name', length: 255 })
  journeyName: string;

  @Column({ name: 'journey_description', type: 'text', nullable: true })
  journeyDescription: string;

  @Column({ name: 'journey_goal', length: 500, nullable: true })
  journeyGoal: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'expected_completion_at', type: 'timestamp', nullable: true })
  expectedCompletionAt: Date;

  @Column({ name: 'last_interaction_at', type: 'timestamp', nullable: true })
  lastInteractionAt: Date;

  @Column({ name: 'total_touchpoints', type: 'int', default: 0 })
  totalTouchpoints: number;

  @Column({ name: 'total_interactions', type: 'int', default: 0 })
  totalInteractions: number;

  @Column({
    name: 'journey_duration_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  journeyDurationHours: number;

  @Column({ name: 'conversion_achieved', type: 'boolean', default: false })
  conversionAchieved: boolean;

  @Column({
    name: 'conversion_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  conversionValue: number;

  @Column({ name: 'conversion_date', type: 'timestamp', nullable: true })
  conversionDate: Date;

  @Column({
    name: 'engagement_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  engagementScore: number;

  @Column({
    name: 'satisfaction_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  satisfactionScore: number;

  @Column({
    name: 'effort_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  effortScore: number;

  @Column({ name: 'net_promoter_score', type: 'int', nullable: true })
  netPromoterScore: number;

  @Column({ name: 'journey_metrics', type: 'jsonb', nullable: true })
  journeyMetrics: CustomerJourneyMetrics;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: CustomerJourneyIndonesianContext;

  @Column({ name: 'journey_analytics', type: 'jsonb', nullable: true })
  journeyAnalytics: CustomerJourneyAnalytics;

  @Column({ name: 'source_campaign', length: 255, nullable: true })
  sourceCampaign: string;

  @Column({ name: 'source_medium', length: 100, nullable: true })
  sourceMedium: string;

  @Column({ name: 'source_referrer', length: 500, nullable: true })
  sourceReferrer: string;

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

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'priority_score', type: 'int', default: 50 })
  priorityScore: number;

  @Column({ name: 'is_high_value', type: 'boolean', default: false })
  isHighValue: boolean;

  @Column({ name: 'is_vip_customer', type: 'boolean', default: false })
  isVipCustomer: boolean;

  @Column({
    name: 'requires_personal_attention',
    type: 'boolean',
    default: false,
  })
  requiresPersonalAttention: boolean;

  @Column({ name: 'escalation_level', type: 'int', default: 0 })
  escalationLevel: number;

  @Column({ name: 'assigned_agent_id', nullable: true })
  assignedAgentId: string;

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
  isRamadanPeriod(): boolean {
    if (!this.indonesianContext?.culturalFactors?.religiousConsiderations) {
      return false;
    }
    return this.indonesianContext.culturalFactors.religiousConsiderations.includes(
      'ramadan',
    );
  }

  isLebaranPeriod(): boolean {
    if (!this.indonesianContext?.culturalFactors?.culturalHolidayInfluence) {
      return false;
    }
    return this.indonesianContext.culturalFactors.culturalHolidayInfluence.includes(
      'lebaran',
    );
  }

  isPriceVolumeCustomer(): boolean {
    return this.indonesianContext?.economicFactors?.pricesensitivity > 80;
  }

  isHighTouchCustomer(): boolean {
    return (
      this.requiresPersonalAttention ||
      this.isVipCustomer ||
      this.escalationLevel > 2
    );
  }

  getPreferredCommunicationLanguage(): string {
    return (
      this.indonesianContext?.culturalFactors?.localLanguagePreference || 'id'
    );
  }

  getRegionalTimeZone(): string {
    return this.indonesianContext?.regionalFactors?.timeZone || 'WIB';
  }

  calculateJourneyCompletionRate(): number {
    if (this.totalTouchpoints === 0) return 0;

    const expectedTouchpoints = this.getExpectedTouchpointsForJourneyType();
    return Math.min(100, (this.totalTouchpoints / expectedTouchpoints) * 100);
  }

  private getExpectedTouchpointsForJourneyType(): number {
    const touchpointMap = {
      [CustomerJourneyType.AWARENESS]: 3,
      [CustomerJourneyType.CONSIDERATION]: 5,
      [CustomerJourneyType.PURCHASE]: 8,
      [CustomerJourneyType.RETENTION]: 6,
      [CustomerJourneyType.ADVOCACY]: 4,
      [CustomerJourneyType.SUPPORT]: 7,
      [CustomerJourneyType.REACTIVATION]: 5,
    };

    return touchpointMap[this.journeyType] || 5;
  }

  getJourneyHealthScore(): number {
    let score = 0;
    let factors = 0;

    if (this.engagementScore !== null) {
      score += this.engagementScore;
      factors++;
    }

    if (this.satisfactionScore !== null) {
      score += this.satisfactionScore;
      factors++;
    }

    if (this.effortScore !== null) {
      // Effort score is inverse - lower is better
      score += 100 - this.effortScore;
      factors++;
    }

    if (this.netPromoterScore !== null) {
      // Convert NPS (-100 to +100) to 0-100 scale
      score += (this.netPromoterScore + 100) / 2;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  isJourneyStalled(): boolean {
    if (!this.lastInteractionAt) return true;

    const hoursSinceLastInteraction =
      (Date.now() - this.lastInteractionAt.getTime()) / (1000 * 60 * 60);

    // Consider journey stalled based on type
    const stallThresholds = {
      [CustomerJourneyType.AWARENESS]: 72, // 3 days
      [CustomerJourneyType.CONSIDERATION]: 168, // 7 days
      [CustomerJourneyType.PURCHASE]: 48, // 2 days
      [CustomerJourneyType.RETENTION]: 336, // 14 days
      [CustomerJourneyType.ADVOCACY]: 168, // 7 days
      [CustomerJourneyType.SUPPORT]: 24, // 1 day
      [CustomerJourneyType.REACTIVATION]: 240, // 10 days
    };

    return (
      hoursSinceLastInteraction > (stallThresholds[this.journeyType] || 168)
    );
  }

  getNextRecommendedActions(): string[] {
    const actions: string[] = [];

    if (this.isJourneyStalled()) {
      actions.push('Re-engage customer through preferred channel');
    }

    if (this.getJourneyHealthScore() < 50) {
      actions.push('Investigate satisfaction issues');
    }

    if (this.effortScore > 70) {
      actions.push('Simplify customer experience');
    }

    if (this.isHighValue && !this.assignedAgentId) {
      actions.push('Assign dedicated account manager');
    }

    if (
      this.isPriceVolumeCustomer() &&
      this.journeyType === CustomerJourneyType.PURCHASE
    ) {
      actions.push('Offer volume discount or promotion');
    }

    if (this.isRamadanPeriod()) {
      actions.push('Adjust communication timing for evening hours');
    }

    return actions;
  }
}
