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

export enum LoyaltyPointsTransactionType {
  EARNED_PURCHASE = 'earned_purchase',
  EARNED_REFERRAL = 'earned_referral',
  EARNED_REVIEW = 'earned_review',
  EARNED_SOCIAL_SHARE = 'earned_social_share',
  EARNED_BIRTHDAY = 'earned_birthday',
  EARNED_WELCOME_BONUS = 'earned_welcome_bonus',
  EARNED_MILESTONE = 'earned_milestone',
  EARNED_CHALLENGE = 'earned_challenge',
  EARNED_SURVEY = 'earned_survey',
  EARNED_CHECK_IN = 'earned_check_in',
  EARNED_INDONESIAN_EVENT = 'earned_indonesian_event',
  EARNED_RAMADAN_BONUS = 'earned_ramadan_bonus',
  EARNED_INDEPENDENCE_DAY = 'earned_independence_day',
  EARNED_LEBARAN_BONUS = 'earned_lebaran_bonus',
  REDEEMED_DISCOUNT = 'redeemed_discount',
  REDEEMED_CASHBACK = 'redeemed_cashback',
  REDEEMED_FREE_SHIPPING = 'redeemed_free_shipping',
  REDEEMED_PRODUCT = 'redeemed_product',
  REDEEMED_VOUCHER = 'redeemed_voucher',
  REDEEMED_EXPERIENCE = 'redeemed_experience',
  EXPIRED = 'expired',
  ADJUSTED = 'adjusted',
  TRANSFERRED = 'transferred',
  BONUS = 'bonus',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
  ELITE = 'elite',
}

export enum RewardType {
  DISCOUNT_PERCENTAGE = 'discount_percentage',
  DISCOUNT_FIXED = 'discount_fixed',
  CASHBACK = 'cashback',
  FREE_SHIPPING = 'free_shipping',
  FREE_PRODUCT = 'free_product',
  VOUCHER = 'voucher',
  EXPERIENCE = 'experience',
  EARLY_ACCESS = 'early_access',
  EXCLUSIVE_CONTENT = 'exclusive_content',
  PERSONAL_SHOPPER = 'personal_shopper',
  PRIORITY_SUPPORT = 'priority_support',
  INDONESIAN_EXPERIENCE = 'indonesian_experience',
  LOCAL_PARTNERSHIP = 'local_partnership',
  CULTURAL_EVENT = 'cultural_event',
  FAMILY_PACKAGE = 'family_package',
}

export enum RewardStatus {
  AVAILABLE = 'available',
  CLAIMED = 'claimed',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export interface LoyaltyPointsCalculation {
  basePoints: number;
  multiplier: number;
  bonusPoints: number;
  tierBonus: number;
  indonesianBonus: number;
  eventBonus: number;
  finalPoints: number;
  calculation: {
    purchaseAmount: number;
    baseRate: number; // Points per IDR
    tierMultiplier: number;
    culturalBonus: number;
    seasonalBonus: number;
    specialEvents: string[];
  };
}

export interface IndonesianLoyaltyContext {
  cultural: {
    ramadanPeriod: boolean;
    lebaranSeason: boolean;
    independenceDay: boolean;
    localHolidays: string[];
    familyOriented: boolean;
    communityFocused: boolean;
    religiousObservance: boolean;
  };
  regional: {
    region: string;
    timezone: string;
    localPartners: string[];
    regionalRewards: string[];
    culturalPreferences: Record<string, any>;
  };
  business: {
    localPaymentMethods: boolean;
    indonesianBusinessHours: boolean;
    localLanguageSupport: boolean;
    culturalCustomerService: boolean;
    localInfluencerPrograms: boolean;
  };
  social: {
    whatsappIntegration: boolean;
    socialMediaSharing: boolean;
    communityEngagement: boolean;
    familyReferrals: boolean;
    localCommunityEvents: boolean;
  };
}

export interface LoyaltyTierBenefits {
  tier: LoyaltyTier;
  pointsMultiplier: number;
  welcomeBonus: number;
  birthdayBonus: number;
  exclusiveRewards: string[];
  prioritySupport: boolean;
  freeShipping: boolean;
  earlyAccess: boolean;
  personalShopper: boolean;
  indonesianBenefits: {
    localExperiences: string[];
    culturalEvents: string[];
    regionalPartners: string[];
    familyBenefits: string[];
    communityPerks: string[];
  };
  requirements: {
    minPoints: number;
    minSpend: number;
    timeframe: number; // months
    additionalRequirements: string[];
  };
}

export interface RewardAnalytics {
  performance: {
    redemptionRate: number;
    customerSatisfaction: number;
    revenueImpact: number;
    engagementIncrease: number;
    retentionImprovement: number;
  };
  demographics: {
    ageGroups: Record<string, number>;
    genderDistribution: Record<string, number>;
    tierDistribution: Record<string, number>;
    regionalPreferences: Record<string, number>;
  };
  behavior: {
    preferredRewardTypes: string[];
    redemptionPatterns: Record<string, number>;
    seasonalTrends: Record<string, number>;
    indonesianCulturalAlignment: number;
  };
  optimization: {
    bestPerformingRewards: string[];
    underperformingRewards: string[];
    recommendedImprovements: string[];
    indonesianSpecificOptimizations: string[];
  };
}

@Entity('customer_loyalty_points')
@Index(['customerId', 'tenantId'])
@Index(['tenantId', 'transactionType'])
@Index(['tenantId', 'expiresAt'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerLoyaltyPoints {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, customer => customer.loyaltyPoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({
    type: 'enum',
    enum: LoyaltyPointsTransactionType,
    name: 'transaction_type',
  })
  transactionType: LoyaltyPointsTransactionType;

  @Column({ name: 'points_amount', type: 'int' })
  pointsAmount: number;

  @Column({ name: 'points_balance_after', type: 'int', default: 0 })
  pointsBalanceAfter: number;

  @Column({ name: 'related_order_id', nullable: true })
  relatedOrderId: string;

  @Column({ name: 'related_reward_id', nullable: true })
  relatedRewardId: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'description', length: 500 })
  description: string;

  @Column({ name: 'source_activity', length: 255, nullable: true })
  sourceActivity: string;

  @Column({
    name: 'multiplier_applied',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 1.0,
  })
  multiplierApplied: number;

  @Column({ name: 'tier_bonus_applied', type: 'int', default: 0 })
  tierBonusApplied: number;

  @Column({ name: 'indonesian_bonus_applied', type: 'int', default: 0 })
  indonesianBonusApplied: number;

  @Column({ name: 'calculation_details', type: 'jsonb', nullable: true })
  calculationDetails: LoyaltyPointsCalculation;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: IndonesianLoyaltyContext;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'is_expired', type: 'boolean', default: false })
  isExpired: boolean;

  @Column({ name: 'is_redeemed', type: 'boolean', default: false })
  isRedeemed: boolean;

  @Column({ name: 'redeemed_at', type: 'timestamp', nullable: true })
  redeemedAt: Date;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods for Indonesian business context
  isIndonesianEvent(): boolean {
    return [
      LoyaltyPointsTransactionType.EARNED_INDONESIAN_EVENT,
      LoyaltyPointsTransactionType.EARNED_RAMADAN_BONUS,
      LoyaltyPointsTransactionType.EARNED_INDEPENDENCE_DAY,
      LoyaltyPointsTransactionType.EARNED_LEBARAN_BONUS,
    ].includes(this.transactionType);
  }

  isEarning(): boolean {
    return this.transactionType.startsWith('earned_');
  }

  isRedemption(): boolean {
    return this.transactionType.startsWith('redeemed_');
  }

  calculateExpirationDate(): Date {
    const createdDate = this.createdAt || new Date();
    const defaultExpiryMonths = 12; // 12 months default

    // Indonesian context considerations
    let expiryMonths = defaultExpiryMonths;

    if (this.indonesianContext?.cultural?.ramadanPeriod) {
      expiryMonths = 18; // Extended for Ramadan points
    } else if (this.isIndonesianEvent()) {
      expiryMonths = 15; // Extended for cultural events
    }

    const expiryDate = new Date(createdDate);
    expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

    return expiryDate;
  }

  getIndonesianBonusScore(): number {
    if (!this.indonesianContext) return 0;

    let score = 0;
    const cultural = this.indonesianContext.cultural;
    const business = this.indonesianContext.business;
    const social = this.indonesianContext.social;

    // Cultural factors
    if (cultural.ramadanPeriod) score += 20;
    if (cultural.lebaranSeason) score += 25;
    if (cultural.familyOriented) score += 10;
    if (cultural.communityFocused) score += 10;

    // Business factors
    if (business.localPaymentMethods) score += 15;
    if (business.localLanguageSupport) score += 10;

    // Social factors
    if (social.whatsappIntegration) score += 10;
    if (social.communityEngagement) score += 15;

    return Math.min(100, score);
  }
}

@Entity('customer_loyalty_tiers')
@Index(['tenantId', 'tier'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'isDeleted'])
export class CustomerLoyaltyTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: LoyaltyTier,
    name: 'tier',
  })
  tier: LoyaltyTier;

  @Column({ name: 'tier_name', length: 255 })
  tierName: string;

  @Column({ name: 'tier_name_indonesian', length: 255, nullable: true })
  tierNameIndonesian: string;

  @Column({ name: 'tier_description', type: 'text', nullable: true })
  tierDescription: string;

  @Column({ name: 'tier_description_indonesian', type: 'text', nullable: true })
  tierDescriptionIndonesian: string;

  @Column({ name: 'min_points_required', type: 'int' })
  minPointsRequired: number;

  @Column({
    name: 'min_spend_required',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  minSpendRequired: number;

  @Column({ name: 'tier_order', type: 'int' })
  tierOrder: number;

  @Column({ name: 'benefits', type: 'jsonb' })
  benefits: LoyaltyTierBenefits;

  @Column({ name: 'tier_color', length: 7, nullable: true })
  tierColor: string;

  @Column({ name: 'tier_icon', length: 255, nullable: true })
  tierIcon: string;

  @Column({ name: 'achievement_badge', length: 255, nullable: true })
  achievementBadge: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'valid_from',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  getDisplayName(language: 'id' | 'en' = 'en'): string {
    if (language === 'id' && this.tierNameIndonesian) {
      return this.tierNameIndonesian;
    }
    return this.tierName;
  }

  getDescription(language: 'id' | 'en' = 'en'): string {
    if (language === 'id' && this.tierDescriptionIndonesian) {
      return this.tierDescriptionIndonesian;
    }
    return this.tierDescription || '';
  }

  isEligibleForUpgrade(currentPoints: number, currentSpend: number): boolean {
    return (
      currentPoints >= this.minPointsRequired &&
      currentSpend >= this.minSpendRequired
    );
  }

  getIndonesianBenefitsCount(): number {
    const indonesianBenefits = this.benefits.indonesianBenefits;
    return (
      (indonesianBenefits.localExperiences?.length || 0) +
      (indonesianBenefits.culturalEvents?.length || 0) +
      (indonesianBenefits.regionalPartners?.length || 0) +
      (indonesianBenefits.familyBenefits?.length || 0) +
      (indonesianBenefits.communityPerks?.length || 0)
    );
  }
}

@Entity('customer_loyalty_rewards')
@Index(['tenantId', 'rewardType'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'eligibleTiers'])
@Index(['tenantId', 'validFrom', 'validUntil'])
@Index(['tenantId', 'isDeleted'])
export class CustomerLoyaltyReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'reward_name', length: 255 })
  rewardName: string;

  @Column({ name: 'reward_name_indonesian', length: 255, nullable: true })
  rewardNameIndonesian: string;

  @Column({ name: 'reward_description', type: 'text' })
  rewardDescription: string;

  @Column({
    name: 'reward_description_indonesian',
    type: 'text',
    nullable: true,
  })
  rewardDescriptionIndonesian: string;

  @Column({
    type: 'enum',
    enum: RewardType,
    name: 'reward_type',
  })
  rewardType: RewardType;

  @Column({ name: 'points_required', type: 'int' })
  pointsRequired: number;

  @Column({
    name: 'monetary_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  monetaryValue: number;

  @Column({
    name: 'discount_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  discountPercentage: number;

  @Column({
    name: 'max_discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  maxDiscountAmount: number;

  @Column({ name: 'eligible_tiers', type: 'simple-array', nullable: true })
  eligibleTiers: LoyaltyTier[];

  @Column({
    name: 'min_purchase_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  minPurchaseAmount: number;

  @Column({ name: 'max_redemptions_per_customer', type: 'int', nullable: true })
  maxRedemptionsPerCustomer: number;

  @Column({ name: 'total_redemptions_limit', type: 'int', nullable: true })
  totalRedemptionsLimit: number;

  @Column({ name: 'current_redemptions', type: 'int', default: 0 })
  currentRedemptions: number;

  @Column({ name: 'reward_analytics', type: 'jsonb', nullable: true })
  rewardAnalytics: RewardAnalytics;

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: {
    culturalRelevance: number;
    regionalAvailability: string[];
    localPartners: string[];
    culturalEvents: string[];
    familyFriendly: boolean;
    languageSupport: string[];
    paymentMethods: string[];
    deliveryOptions: string[];
    customizations: Record<string, any>;
  };

  @Column({ name: 'terms_conditions', type: 'text', nullable: true })
  termsConditions: string;

  @Column({ name: 'terms_conditions_indonesian', type: 'text', nullable: true })
  termsConditionsIndonesian: string;

  @Column({ name: 'redemption_instructions', type: 'text', nullable: true })
  redemptionInstructions: string;

  @Column({
    name: 'redemption_instructions_indonesian',
    type: 'text',
    nullable: true,
  })
  redemptionInstructionsIndonesian: string;

  @Column({ name: 'reward_image', length: 500, nullable: true })
  rewardImage: string;

  @Column({ name: 'reward_icon', length: 255, nullable: true })
  rewardIcon: string;

  @Column({ name: 'priority_order', type: 'int', default: 100 })
  priorityOrder: number;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'valid_from',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ name: 'auto_apply', type: 'boolean', default: false })
  autoApply: boolean;

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ name: 'external_partner_id', nullable: true })
  externalPartnerId: string;

  @Column({ name: 'external_partner_name', length: 255, nullable: true })
  externalPartnerName: string;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'custom_attributes', type: 'jsonb', nullable: true })
  customAttributes: Record<string, any>;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => CustomerLoyaltyRedemption, redemption => redemption.reward)
  redemptions: CustomerLoyaltyRedemption[];

  // Helper methods
  getDisplayName(language: 'id' | 'en' = 'en'): string {
    if (language === 'id' && this.rewardNameIndonesian) {
      return this.rewardNameIndonesian;
    }
    return this.rewardName;
  }

  getDescription(language: 'id' | 'en' = 'en'): string {
    if (language === 'id' && this.rewardDescriptionIndonesian) {
      return this.rewardDescriptionIndonesian;
    }
    return this.rewardDescription;
  }

  isEligibleForTier(tier: LoyaltyTier): boolean {
    return (
      !this.eligibleTiers ||
      this.eligibleTiers.length === 0 ||
      this.eligibleTiers.includes(tier)
    );
  }

  isCurrentlyValid(): boolean {
    const now = new Date();
    return (
      this.isActive &&
      !this.isDeleted &&
      this.validFrom <= now &&
      (!this.validUntil || this.validUntil >= now)
    );
  }

  canBeRedeemed(): boolean {
    if (!this.isCurrentlyValid()) return false;

    if (
      this.totalRedemptionsLimit &&
      this.currentRedemptions >= this.totalRedemptionsLimit
    ) {
      return false;
    }

    return true;
  }

  getIndonesianCulturalScore(): number {
    if (!this.indonesianContext) return 50; // Default neutral score

    let score = 0;
    const context = this.indonesianContext;

    score += context.culturalRelevance || 0;

    if (context.familyFriendly) score += 20;
    if (context.regionalAvailability?.length > 0) score += 15;
    if (context.localPartners?.length > 0) score += 10;
    if (context.culturalEvents?.length > 0) score += 15;
    if (context.languageSupport?.includes('id')) score += 10;
    if (
      context.paymentMethods?.some(method =>
        ['qris', 'gopay', 'ovo', 'dana'].includes(method.toLowerCase()),
      )
    )
      score += 10;

    return Math.min(100, Math.max(0, score));
  }

  calculateRedemptionValue(purchaseAmount?: number): number {
    switch (this.rewardType) {
      case RewardType.DISCOUNT_PERCENTAGE:
        if (!purchaseAmount) return 0;
        const discountValue =
          (purchaseAmount * (this.discountPercentage || 0)) / 100;
        return this.maxDiscountAmount
          ? Math.min(discountValue, this.maxDiscountAmount)
          : discountValue;

      case RewardType.DISCOUNT_FIXED:
      case RewardType.CASHBACK:
        return this.monetaryValue || 0;

      case RewardType.FREE_SHIPPING:
        return 15000; // Typical Indonesian shipping cost

      default:
        return this.monetaryValue || 0;
    }
  }
}

@Entity('customer_loyalty_redemptions')
@Index(['customerId', 'tenantId'])
@Index(['tenantId', 'rewardId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'redeemedAt'])
@Index(['tenantId', 'isDeleted'])
export class CustomerLoyaltyRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'reward_id' })
  rewardId: string;

  @ManyToOne(() => CustomerLoyaltyReward, reward => reward.redemptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reward_id' })
  reward: CustomerLoyaltyReward;

  @Column({ name: 'points_redeemed', type: 'int' })
  pointsRedeemed: number;

  @Column({ name: 'monetary_value', type: 'decimal', precision: 15, scale: 2 })
  monetaryValue: number;

  @Column({
    type: 'enum',
    enum: RewardStatus,
    default: RewardStatus.CLAIMED,
    name: 'status',
  })
  status: RewardStatus;

  @Column({ name: 'redemption_code', length: 50, nullable: true })
  redemptionCode: string;

  @Column({ name: 'related_order_id', nullable: true })
  relatedOrderId: string;

  @Column({ name: 'applied_at', type: 'timestamp', nullable: true })
  appliedAt: Date;

  @Column({ name: 'redeemed_at', type: 'timestamp', nullable: true })
  redeemedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'redemption_details', type: 'jsonb', nullable: true })
  redemptionDetails: {
    originalValue: number;
    discountApplied: number;
    purchaseAmount?: number;
    orderItems?: string[];
    deliveryMethod?: string;
    specialInstructions?: string;
  };

  @Column({ name: 'indonesian_context', type: 'jsonb', nullable: true })
  indonesianContext: {
    culturalConsiderations: string[];
    regionalDelivery: string;
    localPartnerInvolved: boolean;
    languageUsed: string;
    familyBenefit: boolean;
    communityImpact: string;
  };

  @Column({ name: 'customer_feedback', type: 'jsonb', nullable: true })
  customerFeedback: {
    satisfaction: number; // 1-5 scale
    comments: string;
    wouldRecommend: boolean;
    indonesianRelevance: number; // 1-5 scale
    culturalAppropriatenesss: number; // 1-5 scale
  };

  @Column({ name: 'fulfillment_status', length: 100, nullable: true })
  fulfillmentStatus: string;

  @Column({ name: 'fulfillment_notes', type: 'text', nullable: true })
  fulfillmentNotes: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy: string;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  isActive(): boolean {
    const now = new Date();
    return (
      this.status === RewardStatus.CLAIMED &&
      (!this.expiresAt || this.expiresAt > now) &&
      !this.isDeleted
    );
  }

  isExpired(): boolean {
    return this.expiresAt && this.expiresAt <= new Date();
  }

  canBeApplied(): boolean {
    return (
      this.status === RewardStatus.CLAIMED && this.isActive() && !this.appliedAt
    );
  }

  isRedeemed(): boolean {
    return this.redeemedAt !== null && this.redeemedAt !== undefined;
  }

  markAsRedeemed(): void {
    this.redeemedAt = new Date();
    this.status = RewardStatus.REDEEMED;
  }

  generateRedemptionCode(): string {
    const prefix = 'STOK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  calculateExpirationDate(): Date {
    const now = new Date();
    const defaultExpiryDays = 30; // 30 days default

    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + defaultExpiryDays);

    return expiryDate;
  }

  getIndonesianCulturalScore(): number {
    if (!this.indonesianContext) return 50;

    let score = 50; // Base score

    if (this.indonesianContext.localPartnerInvolved) score += 20;
    if (this.indonesianContext.familyBenefit) score += 15;
    if (this.indonesianContext.languageUsed === 'id') score += 10;
    if (this.indonesianContext.culturalConsiderations?.length > 0) score += 15;
    if (this.indonesianContext.communityImpact) score += 10;

    // Customer feedback consideration
    if (this.customerFeedback) {
      const culturalScore = this.customerFeedback.indonesianRelevance || 3;
      score += (culturalScore - 3) * 5; // Adjust based on feedback
    }

    return Math.min(100, Math.max(0, score));
  }
}
