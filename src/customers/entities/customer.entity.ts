import {
  Entity,
  Column,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { CustomerTransaction } from './customer-transaction.entity';
import { CustomerJourney } from './customer-journey.entity';
import { CustomerTouchpoint } from './customer-touchpoint.entity';
import { CustomerInteraction } from './customer-interaction.entity';
import { CustomerPrediction } from './customer-prediction.entity';
import { CustomerLoyaltyPoints } from './customer-loyalty.entity';
import { CustomerCommunication } from './customer-communication.entity';

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLACKLISTED = 'blacklisted',
  PROSPECT = 'prospect',
}

export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
  CORPORATE = 'corporate',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

export enum CustomerSegmentType {
  HIGH_VALUE = 'high_value',
  FREQUENT_BUYER = 'frequent_buyer',
  SEASONAL = 'seasonal',
  OCCASIONAL = 'occasional',
  AT_RISK = 'at_risk',
  DORMANT = 'dormant',
  NEW_CUSTOMER = 'new_customer',
}

@Entity('customers')
@Index(['tenantId', 'email'], { unique: true, where: 'email IS NOT NULL' })
@Index(['tenantId', 'phone'], { unique: true, where: 'phone IS NOT NULL' })
@Index(['tenantId', 'customerNumber'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'segment'])
@Index(['tenantId', 'loyaltyTier'])
@Index(['tenantId', 'lastOrderDate'])
@Index(['tenantId', 'lifetimeValue'])
export class Customer extends BaseEntity {
  // Basic Information
  @Column({ type: 'varchar', length: 50 })
  customerNumber: string; // Auto-generated unique customer number

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date;

  @Column({
    type: 'enum',
    enum: CustomerType,
    default: CustomerType.INDIVIDUAL,
  })
  customerType: CustomerType;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  // Business Information (for business customers)
  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  taxId?: string; // NPWP for Indonesian businesses

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  businessSize?: string; // Micro, Small, Medium, Large

  // Address Information
  @Column({ type: 'jsonb', nullable: true })
  addresses?: Array<{
    id: string;
    type: 'billing' | 'shipping' | 'business';
    isDefault: boolean;
    name: string;
    address: string;
    city: string;
    state: string;
    province: string; // Added for Indonesian provinces
    postalCode: string;
    country: string;
    phone?: string;
    notes?: string;
  }>;

  // Customer Analytics & Segmentation
  @Column({
    type: 'enum',
    enum: CustomerSegmentType,
    default: CustomerSegmentType.NEW_CUSTOMER,
  })
  segment: CustomerSegmentType;

  @Column({
    type: 'enum',
    enum: LoyaltyTier,
    default: LoyaltyTier.BRONZE,
  })
  loyaltyTier: LoyaltyTier;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  lifetimeValue: number; // Total LTV in IDR

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  predictedLifetimeValue: number; // Predicted LTV using ML

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  averageOrderValue: number;

  @Column({ type: 'integer', default: 0 })
  totalOrders: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSpent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageOrderFrequency: number; // Orders per month

  @Column({ type: 'timestamp', nullable: true })
  firstOrderDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastOrderDate?: Date;

  @Column({ type: 'integer', default: 0 })
  daysSinceLastOrder: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  churnProbability: number; // 0-100 percentage

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  retentionScore: number; // 0-100 score

  // Behavioral Data
  @Column({ type: 'jsonb', nullable: true })
  preferences?: {
    preferredCategories: string[];
    preferredBrands: string[];
    preferredPriceRange: { min: number; max: number };
    preferredPaymentMethods: string[];
    preferredDeliveryMethods: string[];
    communicationPreferences: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
      phone: boolean;
      restrictedContent?: boolean;
    };
    marketingConsent: boolean;
    familySize?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  purchaseBehavior?: {
    averageDaysBetweenOrders: number;
    mostActiveTimeOfDay: string; // '09:00', '14:30', etc.
    mostActiveDayOfWeek: string; // 'monday', 'tuesday', etc.
    seasonalPurchasePattern: {
      ramadan: boolean;
      lebaran: boolean;
      christmas: boolean;
      newYear: boolean;
    };
    pricesensitivity: 'low' | 'medium' | 'high';
    brandLoyalty: 'low' | 'medium' | 'high';
  };

  // Customer Service & Support
  @Column({ type: 'integer', default: 0 })
  supportTicketsCount: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  averageSatisfactionRating: number; // 0-10 scale

  @Column({ type: 'integer', default: 0 })
  complaintsCount: number;

  @Column({ type: 'integer', default: 0 })
  returnsCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalReturnsValue: number;

  // Loyalty & Rewards
  @Column({ type: 'integer', default: 0 })
  loyaltyPointsBalance: number;

  @Column({ type: 'integer', default: 0 })
  referralsCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  referralValue: number; // Value generated from referrals

  @Column({ type: 'varchar', length: 50, nullable: true })
  referredBy?: string; // Customer ID of referrer

  // External Integration Data
  @Column({ type: 'jsonb', nullable: true })
  externalIds?: {
    shopeeCustomerId?: string;
    tokopediaCustomerId?: string;
    lazadaCustomerId?: string;
    whatsappContactId?: string;
    mokaCustomerId?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  socialProfiles?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    telegram?: string;
  };

  // Marketing & Communication
  @Column({ type: 'jsonb', nullable: true })
  communicationHistory?: Array<{
    id: string;
    type: 'email' | 'sms' | 'whatsapp' | 'phone' | 'push';
    subject: string;
    sentAt: string;
    openedAt?: string;
    clickedAt?: string;
    respondedAt?: string;
    status:
      | 'sent'
      | 'delivered'
      | 'opened'
      | 'clicked'
      | 'responded'
      | 'failed';
  }>;

  @Column({ type: 'jsonb', nullable: true })
  marketingCampaigns?: Array<{
    campaignId: string;
    campaignName: string;
    participatedAt: string;
    response?: 'positive' | 'negative' | 'neutral';
    conversionValue?: number;
  }>;

  // Risk Assessment
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  creditScore: number; // 0-100 for business customers

  @Column({ type: 'boolean', default: false })
  isHighRisk: boolean;

  @Column({ type: 'jsonb', nullable: true })
  riskFactors?: {
    paymentDelays: number;
    disputedOrders: number;
    fraudulentActivity: boolean;
    excessiveReturns: boolean;
    notes?: string;
  };

  // Language & Localization
  @Column({ type: 'varchar', length: 10, default: 'id' })
  preferredLanguage: string; // 'id' for Indonesian, 'en' for English

  // Indonesian Market Context
  @Column({ type: 'jsonb', nullable: true })
  indonesianMarketContext?: {
    culturalAlignmentScore?: number; // 0-100 score
    religiousConsiderations?: {
      isMuslim?: boolean;
      observesHalal?: boolean;
      observesRamadan?: boolean;
      prayerTimePreferences?: string[];
    };
    regionalFactors?: {
      province?: string;
      city?: string;
      timeZone?: 'WIB' | 'WITA' | 'WIT';
      economicZone?: string;
      localLanguages?: string[];
    };
    businessCulture?: {
      communicationStyle?: 'formal' | 'informal' | 'mixed';
      decisionMakingStyle?: 'individual' | 'collective' | 'hierarchical';
      relationshipOrientation?: 'task' | 'relationship' | 'balanced';
      timeOrientation?: 'strict' | 'flexible' | 'moderate';
    };
    marketAdaptation?: {
      localPaymentMethods?: string[];
      preferredChannels?: string[];
      seasonalBehaviors?: Record<string, any>;
      culturalEvents?: string[];
    };
  };

  // Additional Metadata
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  // System fields
  @Column({ type: 'uuid', nullable: true })
  assignedSalesRepId?: string;

  @Column({ type: 'uuid', nullable: true })
  accountManagerId?: string;

  @Column({ type: 'boolean', default: true })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isPhoneVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  phoneVerifiedAt?: Date;

  // Virtual fields
  get fullAddress(): string {
    const defaultAddress = this.addresses?.find(addr => addr.isDefault);
    if (!defaultAddress) return '';
    return `${defaultAddress.address}, ${defaultAddress.city}, ${defaultAddress.state} ${defaultAddress.postalCode}`;
  }

  get isActive(): boolean {
    return this.status === CustomerStatus.ACTIVE;
  }

  get isHighValue(): boolean {
    return (
      this.segment === CustomerSegmentType.HIGH_VALUE ||
      this.lifetimeValue > 10000000
    ); // 10M IDR
  }

  get daysSinceFirstOrder(): number {
    if (!this.firstOrderDate) return 0;
    return Math.floor(
      (Date.now() - this.firstOrderDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  get customerLifecycleStage():
    | 'new'
    | 'growing'
    | 'mature'
    | 'declining'
    | 'dormant' {
    if (this.daysSinceFirstOrder <= 30) return 'new';
    if (this.totalOrders < 5) return 'growing';
    if (this.daysSinceLastOrder <= 90) return 'mature';
    if (this.daysSinceLastOrder <= 365) return 'declining';
    return 'dormant';
  }

  get recentOrderFrequency(): number {
    if (!this.firstOrderDate || !this.lastOrderDate) return 0;
    const monthsSinceFirst = Math.max(
      1,
      (Date.now() - this.firstOrderDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    return this.totalOrders / monthsSinceFirst;
  }

  // Compatibility getters for service layer
  get segmentType(): CustomerSegmentType {
    return this.segment;
  }

  set segmentType(value: CustomerSegmentType) {
    this.segment = value;
  }

  // loyaltyPoints compatibility - return the balance for backward compatibility
  get loyaltyPoints(): number {
    return this.loyaltyPointsBalance;
  }

  set loyaltyPoints(value: number) {
    this.loyaltyPointsBalance = value;
  }

  // Relations
  @OneToMany(() => Order, order => order.customer)
  orders?: Order[];

  @OneToMany(() => CustomerTransaction, transaction => transaction.customer, {
    cascade: true,
  })
  transactions?: CustomerTransaction[];

  @OneToMany(() => CustomerJourney, journey => journey.customer, {
    cascade: true,
  })
  journeys?: CustomerJourney[];

  @OneToMany(() => CustomerTouchpoint, touchpoint => touchpoint.customer, {
    cascade: true,
  })
  touchpoints?: CustomerTouchpoint[];

  @OneToMany(() => CustomerInteraction, interaction => interaction.customer, {
    cascade: true,
  })
  interactions?: CustomerInteraction[];

  @OneToMany(() => CustomerPrediction, prediction => prediction.customer, {
    cascade: true,
  })
  predictions?: CustomerPrediction[];

  @OneToMany(
    () => CustomerLoyaltyPoints,
    loyaltyPoints => loyaltyPoints.customer,
    { cascade: true },
  )
  loyaltyPointsRecords?: CustomerLoyaltyPoints[];

  @OneToMany(
    () => CustomerCommunication,
    communication => communication.customer,
    { cascade: true },
  )
  communications?: CustomerCommunication[];

  // Methods
  updateSegment(): void {
    // Auto-calculate customer segment based on behavior
    if (this.lifetimeValue > 50000000) {
      // 50M IDR
      this.segment = CustomerSegmentType.HIGH_VALUE;
    } else if (this.averageOrderFrequency > 2) {
      // More than 2 orders per month
      this.segment = CustomerSegmentType.FREQUENT_BUYER;
    } else if (this.churnProbability > 70) {
      this.segment = CustomerSegmentType.AT_RISK;
    } else if (this.daysSinceLastOrder > 365) {
      this.segment = CustomerSegmentType.DORMANT;
    } else if (this.totalOrders <= 2) {
      this.segment = CustomerSegmentType.NEW_CUSTOMER;
    } else if (this.purchaseBehavior?.seasonalPurchasePattern) {
      this.segment = CustomerSegmentType.SEASONAL;
    } else {
      this.segment = CustomerSegmentType.OCCASIONAL;
    }
  }

  updateLoyaltyTier(): void {
    // Auto-calculate loyalty tier based on total spent and orders
    if (this.lifetimeValue >= 100000000) {
      // 100M IDR
      this.loyaltyTier = LoyaltyTier.DIAMOND;
    } else if (this.lifetimeValue >= 50000000) {
      // 50M IDR
      this.loyaltyTier = LoyaltyTier.PLATINUM;
    } else if (this.lifetimeValue >= 20000000) {
      // 20M IDR
      this.loyaltyTier = LoyaltyTier.GOLD;
    } else if (this.lifetimeValue >= 5000000) {
      // 5M IDR
      this.loyaltyTier = LoyaltyTier.SILVER;
    } else {
      this.loyaltyTier = LoyaltyTier.BRONZE;
    }
  }

  addCommunicationRecord(record: any): void {
    if (!this.communicationHistory) this.communicationHistory = [];
    this.communicationHistory.push({
      id: record.id || Date.now().toString(),
      type: record.type,
      subject: record.subject,
      sentAt: record.sentAt || new Date().toISOString(),
      status: record.status || 'sent',
      ...record,
    });

    // Keep only last 50 communication records
    if (this.communicationHistory.length > 50) {
      this.communicationHistory = this.communicationHistory.slice(-50);
    }
  }

  calculateChurnProbability(): number {
    // Simple churn probability calculation
    let score = 0;

    // Days since last order factor
    if (this.daysSinceLastOrder > 365) score += 40;
    else if (this.daysSinceLastOrder > 180) score += 30;
    else if (this.daysSinceLastOrder > 90) score += 20;
    else if (this.daysSinceLastOrder > 30) score += 10;

    // Order frequency factor
    if (this.averageOrderFrequency < 0.5) score += 25;
    else if (this.averageOrderFrequency < 1) score += 15;
    else if (this.averageOrderFrequency < 2) score += 5;

    // Support issues factor
    if (this.complaintsCount > 5) score += 20;
    else if (this.complaintsCount > 2) score += 10;

    // Returns factor
    if (this.returnsCount > this.totalOrders * 0.3) score += 15;

    this.churnProbability = Math.min(100, score);
    return this.churnProbability;
  }

  updateAnalytics(orderData: any): void {
    // Update customer analytics when new order is placed
    this.totalOrders = orderData.totalOrders || this.totalOrders;
    this.totalSpent = orderData.totalSpent || this.totalSpent;
    this.lifetimeValue = this.totalSpent; // Simple LTV calculation
    this.averageOrderValue =
      this.totalOrders > 0 ? this.totalSpent / this.totalOrders : 0;
    this.lastOrderDate = orderData.lastOrderDate || this.lastOrderDate;
    this.daysSinceLastOrder = this.lastOrderDate
      ? Math.floor(
          (Date.now() - this.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    // Recalculate metrics
    this.calculateChurnProbability();
    this.updateSegment();
    this.updateLoyaltyTier();
  }
}
