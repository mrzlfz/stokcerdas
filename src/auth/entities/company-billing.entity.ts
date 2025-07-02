import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/auditable.entity';
import { Company } from './company.entity';
import { User } from '../../users/entities/user.entity';

export enum BillingPlan {
  FREE = 'free',
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually',
  PAY_AS_YOU_GO = 'pay_as_you_go',
}

export enum BillingStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  OVERDUE = 'overdue',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  CHURNED = 'churned',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  VIRTUAL_ACCOUNT = 'virtual_account',
  E_WALLET = 'e_wallet',
  QRIS = 'qris',
  INVOICE = 'invoice',
  CHECK = 'check',
  CASH = 'cash',
}

export enum UsageMetricType {
  USER_COUNT = 'user_count',
  TRANSACTION_COUNT = 'transaction_count',
  STORAGE_GB = 'storage_gb',
  API_CALLS = 'api_calls',
  PRODUCTS = 'products',
  LOCATIONS = 'locations',
  INTEGRATIONS = 'integrations',
  REPORTS = 'reports',
  CUSTOM = 'custom',
}

@Entity('company_billing')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'companyId'])
@Index(['tenantId', 'billingStatus'])
@Index(['tenantId', 'billingPlan'])
@Index(['tenantId', 'nextBillingDate'])
@Index(['billingStatus', 'nextBillingDate'])
export class CompanyBilling extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  // Company reference
  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { eager: true })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // Billing account information
  @Column({ name: 'billing_account_number', length: 50, unique: true })
  billingAccountNumber: string;

  @Column({ name: 'billing_email', length: 255 })
  billingEmail: string;

  @Column({ name: 'billing_contact_name', length: 200, nullable: true })
  billingContactName: string;

  @Column({ name: 'billing_contact_phone', length: 20, nullable: true })
  billingContactPhone: string;

  // Subscription details
  @Column({
    name: 'billing_plan',
    type: 'enum',
    enum: BillingPlan,
    default: BillingPlan.BASIC,
  })
  billingPlan: BillingPlan;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billingCycle: BillingCycle;

  @Column({
    name: 'billing_status',
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.ACTIVE,
  })
  billingStatus: BillingStatus;

  @Column({ name: 'subscription_start_date', type: 'date' })
  subscriptionStartDate: Date;

  @Column({ name: 'subscription_end_date', type: 'date', nullable: true })
  subscriptionEndDate: Date;

  @Column({ name: 'trial_end_date', type: 'date', nullable: true })
  trialEndDate: Date;

  @Column({ name: 'is_trial', type: 'boolean', default: false })
  isTrial: boolean;

  @Column({ name: 'auto_renew', type: 'boolean', default: true })
  autoRenew: boolean;

  // Pricing information
  @Column({ name: 'base_price', type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ name: 'currency', length: 3, default: 'IDR' })
  currency: string;

  @Column({ name: 'discount_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 11 })
  taxRate: number; // PPN 11% for Indonesia

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  // Usage-based billing
  @Column({ name: 'usage_based_billing', type: 'boolean', default: false })
  usageBasedBilling: boolean;

  @Column({ name: 'usage_pricing', type: 'jsonb', nullable: true })
  usagePricing: Array<{
    metricType: UsageMetricType;
    metricName: string;
    unitPrice: number;
    includedQuantity: number;
    overagePrice: number;
    maxQuantity?: number;
    billingFrequency: 'monthly' | 'quarterly' | 'annually';
  }>;

  @Column({ name: 'current_usage', type: 'jsonb', nullable: true })
  currentUsage: Record<string, {
    quantity: number;
    lastUpdated: Date;
    projectedMonthlyUsage?: number;
    exceededIncluded?: boolean;
  }>;

  // Billing cycle management
  @Column({ name: 'billing_day', type: 'integer', default: 1 })
  billingDay: number; // Day of month to bill (1-31)

  @Column({ name: 'last_billing_date', type: 'date', nullable: true })
  lastBillingDate: Date;

  @Column({ name: 'next_billing_date', type: 'date' })
  nextBillingDate: Date;

  @Column({ name: 'billing_timezone', length: 50, default: 'Asia/Jakarta' })
  billingTimezone: string;

  @Column({ name: 'proration_enabled', type: 'boolean', default: true })
  prorationEnabled: boolean;

  // Payment information
  @Column({
    name: 'preferred_payment_method',
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.BANK_TRANSFER,
  })
  preferredPaymentMethod: PaymentMethod;

  @Column({ name: 'payment_terms_days', type: 'integer', default: 30 })
  paymentTermsDays: number;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 15, scale: 2, nullable: true })
  creditLimit: number;

  @Column({ name: 'outstanding_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
  outstandingBalance: number;

  @Column({ name: 'last_payment_date', type: 'date', nullable: true })
  lastPaymentDate: Date;

  @Column({ name: 'last_payment_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  lastPaymentAmount: number;

  // Credit and collections
  @Column({ name: 'credit_score', type: 'integer', nullable: true })
  creditScore: number; // 0-1000

  @Column({ name: 'payment_history_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  paymentHistoryScore: number; // 0.0-1.0

  @Column({ name: 'days_past_due', type: 'integer', default: 0 })
  daysPastDue: number;

  @Column({ name: 'overdue_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  overdueAmount: number;

  @Column({ name: 'collection_status', length: 50, nullable: true })
  collectionStatus: string;

  @Column({ name: 'collection_notes', type: 'text', nullable: true })
  collectionNotes: string;

  // Billing address
  @Column({ name: 'billing_address', type: 'jsonb' })
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };

  // Tax information
  @Column({ name: 'tax_information', type: 'jsonb', nullable: true })
  taxInformation: {
    taxId?: string; // NPWP
    taxName?: string;
    taxAddress?: {
      line1: string;
      line2?: string;
      city: string;
      province: string;
      postalCode: string;
    };
    vatRegistered?: boolean;
    vatNumber?: string;
    taxExempt?: boolean;
    exemptionReason?: string;
  };

  // Subscription limits and features
  @Column({ name: 'subscription_limits', type: 'jsonb', nullable: true })
  subscriptionLimits: {
    maxUsers?: number;
    maxProducts?: number;
    maxLocations?: number;
    maxTransactions?: number;
    maxStorage?: number; // in GB
    maxApiCalls?: number;
    maxIntegrations?: number;
    maxReports?: number;
    customLimits?: Record<string, number>;
  };

  @Column({ name: 'enabled_features', type: 'simple-array', nullable: true })
  enabledFeatures: string[];

  @Column({ name: 'disabled_features', type: 'simple-array', nullable: true })
  disabledFeatures: string[];

  @Column({ name: 'addon_features', type: 'jsonb', nullable: true })
  addonFeatures: Array<{
    featureId: string;
    featureName: string;
    price: number;
    enabled: boolean;
    enabledDate?: Date;
  }>;

  // Notifications and communication
  @Column({ name: 'notification_settings', type: 'jsonb', nullable: true })
  notificationSettings: {
    billingReminders?: boolean;
    paymentNotifications?: boolean;
    usageAlerts?: boolean;
    planChangeNotifications?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    webhookNotifications?: boolean;
    reminderDaysBefore?: number;
    usageThresholdPercent?: number;
  };

  @Column({ name: 'communication_preferences', type: 'jsonb', nullable: true })
  communicationPreferences: {
    language?: string;
    timezone?: string;
    preferredContactMethod?: 'email' | 'phone' | 'sms';
    marketingEmails?: boolean;
    productUpdates?: boolean;
    newsletters?: boolean;
  };

  // Account management
  @Column({ name: 'account_manager_id', type: 'uuid', nullable: true })
  accountManagerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'account_manager_id' })
  accountManager: User;

  @Column({ name: 'customer_success_manager_id', type: 'uuid', nullable: true })
  customerSuccessManagerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'customer_success_manager_id' })
  customerSuccessManager: User;

  @Column({ name: 'support_tier', length: 50, default: 'standard' })
  supportTier: 'basic' | 'standard' | 'premium' | 'enterprise';

  // Analytics and insights
  @Column({ name: 'lifetime_value', type: 'decimal', precision: 15, scale: 2, default: 0 })
  lifetimeValue: number;

  @Column({ name: 'total_payments', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPayments: number;

  @Column({ name: 'average_monthly_revenue', type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageMonthlyRevenue: number;

  @Column({ name: 'churn_risk_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  churnRiskScore: number; // 0.0-1.0

  @Column({ name: 'expansion_opportunity_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  expansionOpportunityScore: number; // 0.0-1.0

  @Column({ name: 'customer_health_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  customerHealthScore: number; // 0.0-1.0

  // Contract information
  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate: Date;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate: Date;

  @Column({ name: 'contract_value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  contractValue: number;

  @Column({ name: 'minimum_commitment', type: 'decimal', precision: 15, scale: 2, nullable: true })
  minimumCommitment: number;

  @Column({ name: 'early_termination_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  earlyTerminationFee: number;

  // Referral and partnership
  @Column({ name: 'referral_code', length: 50, nullable: true })
  referralCode: string;

  @Column({ name: 'referred_by', length: 50, nullable: true })
  referredBy: string;

  @Column({ name: 'partner_id', type: 'uuid', nullable: true })
  partnerId: string;

  @Column({ name: 'partner_commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  partnerCommissionRate: number;

  // Custom fields and metadata
  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  // Helper methods
  isActive(): boolean {
    return this.billingStatus === BillingStatus.ACTIVE;
  }

  isTrial(): boolean {
    return this.isTrial && this.trialEndDate && new Date() <= this.trialEndDate;
  }

  isTrialExpired(): boolean {
    return this.isTrial && this.trialEndDate && new Date() > this.trialEndDate;
  }

  isOverdue(): boolean {
    return this.billingStatus === BillingStatus.OVERDUE || this.daysPastDue > 0;
  }

  isSuspended(): boolean {
    return this.billingStatus === BillingStatus.SUSPENDED;
  }

  getNextBillingAmount(): number {
    let amount = this.basePrice;
    
    // Apply discount
    if (this.discountPercentage > 0) {
      amount = amount * (1 - this.discountPercentage / 100);
    }
    amount -= this.discountAmount;
    
    // Add usage charges
    if (this.usageBasedBilling && this.currentUsage) {
      const usageCharges = this.calculateUsageCharges();
      amount += usageCharges;
    }
    
    // Add tax
    const taxAmount = amount * (this.taxRate / 100);
    amount += taxAmount;
    
    return Math.max(0, amount);
  }

  calculateUsageCharges(): number {
    if (!this.usageBasedBilling || !this.usagePricing || !this.currentUsage) {
      return 0;
    }
    
    let totalUsageCharges = 0;
    
    this.usagePricing.forEach(pricing => {
      const usage = this.currentUsage[pricing.metricType];
      if (usage && usage.quantity > pricing.includedQuantity) {
        const overage = usage.quantity - pricing.includedQuantity;
        totalUsageCharges += overage * pricing.overagePrice;
      }
    });
    
    return totalUsageCharges;
  }

  updateUsage(metricType: string, quantity: number): void {
    if (!this.currentUsage) {
      this.currentUsage = {};
    }
    
    this.currentUsage[metricType] = {
      quantity,
      lastUpdated: new Date(),
    };
  }

  incrementUsage(metricType: string, increment: number = 1): void {
    if (!this.currentUsage) {
      this.currentUsage = {};
    }
    
    const current = this.currentUsage[metricType]?.quantity || 0;
    this.updateUsage(metricType, current + increment);
  }

  resetUsage(): void {
    if (this.currentUsage) {
      Object.keys(this.currentUsage).forEach(key => {
        this.currentUsage[key].quantity = 0;
        this.currentUsage[key].lastUpdated = new Date();
      });
    }
  }

  isWithinLimits(metricType: string): boolean {
    const limit = this.subscriptionLimits?.[metricType];
    if (!limit) return true;
    
    const usage = this.currentUsage?.[metricType]?.quantity || 0;
    return usage < limit;
  }

  getRemainingAllowance(metricType: string): number {
    const limit = this.subscriptionLimits?.[metricType];
    if (!limit) return Infinity;
    
    const usage = this.currentUsage?.[metricType]?.quantity || 0;
    return Math.max(0, limit - usage);
  }

  getUsagePercentage(metricType: string): number {
    const limit = this.subscriptionLimits?.[metricType];
    if (!limit) return 0;
    
    const usage = this.currentUsage?.[metricType]?.quantity || 0;
    return Math.min(100, (usage / limit) * 100);
  }

  isNearingLimit(metricType: string, threshold: number = 80): boolean {
    return this.getUsagePercentage(metricType) >= threshold;
  }

  calculateDaysUntilNextBilling(): number {
    const now = new Date();
    const next = this.nextBillingDate;
    const diffTime = next.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  updateNextBillingDate(): void {
    const current = this.nextBillingDate || new Date();
    
    switch (this.billingCycle) {
      case BillingCycle.MONTHLY:
        this.nextBillingDate = new Date(current.getFullYear(), current.getMonth() + 1, this.billingDay);
        break;
      case BillingCycle.QUARTERLY:
        this.nextBillingDate = new Date(current.getFullYear(), current.getMonth() + 3, this.billingDay);
        break;
      case BillingCycle.SEMI_ANNUALLY:
        this.nextBillingDate = new Date(current.getFullYear(), current.getMonth() + 6, this.billingDay);
        break;
      case BillingCycle.ANNUALLY:
        this.nextBillingDate = new Date(current.getFullYear() + 1, current.getMonth(), this.billingDay);
        break;
    }
  }

  addCustomField(key: string, value: any): void {
    if (!this.customFields) {
      this.customFields = {};
    }
    this.customFields[key] = value;
  }

  getCustomField(key: string, defaultValue: any = null): any {
    return this.customFields?.[key] || defaultValue;
  }

  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
    }
  }

  enableFeature(featureId: string): void {
    if (!this.enabledFeatures) {
      this.enabledFeatures = [];
    }
    if (!this.enabledFeatures.includes(featureId)) {
      this.enabledFeatures.push(featureId);
    }
    
    // Remove from disabled features if present
    if (this.disabledFeatures) {
      this.disabledFeatures = this.disabledFeatures.filter(f => f !== featureId);
    }
  }

  disableFeature(featureId: string): void {
    if (!this.disabledFeatures) {
      this.disabledFeatures = [];
    }
    if (!this.disabledFeatures.includes(featureId)) {
      this.disabledFeatures.push(featureId);
    }
    
    // Remove from enabled features if present
    if (this.enabledFeatures) {
      this.enabledFeatures = this.enabledFeatures.filter(f => f !== featureId);
    }
  }

  isFeatureEnabled(featureId: string): boolean {
    if (this.disabledFeatures && this.disabledFeatures.includes(featureId)) {
      return false;
    }
    return this.enabledFeatures ? this.enabledFeatures.includes(featureId) : true;
  }

  updateLifetimeValue(): void {
    // This would typically aggregate all payments over the customer lifecycle
    this.lifetimeValue = this.totalPayments;
  }

  calculateChurnRisk(): number {
    let riskScore = 0;
    
    // Payment history factor
    if (this.paymentHistoryScore && this.paymentHistoryScore < 0.8) {
      riskScore += 0.3;
    }
    
    // Usage trend factor
    if (this.currentUsage) {
      const avgUsage = Object.values(this.currentUsage).reduce((sum, usage) => sum + usage.quantity, 0) / Object.keys(this.currentUsage).length;
      if (avgUsage < 50) { // Low usage threshold
        riskScore += 0.2;
      }
    }
    
    // Days past due factor
    if (this.daysPastDue > 0) {
      riskScore += Math.min(0.5, this.daysPastDue / 60);
    }
    
    this.churnRiskScore = Math.min(1.0, riskScore);
    return this.churnRiskScore;
  }

  calculateCustomerHealthScore(): number {
    let healthScore = 1.0;
    
    // Billing health
    if (this.billingStatus === BillingStatus.ACTIVE) {
      healthScore += 0.3;
    } else if (this.isOverdue()) {
      healthScore -= 0.4;
    }
    
    // Payment history
    if (this.paymentHistoryScore) {
      healthScore = (healthScore + this.paymentHistoryScore) / 2;
    }
    
    // Usage engagement
    if (this.currentUsage) {
      const usageEngagement = Object.values(this.currentUsage).reduce((sum, usage) => {
        return sum + Math.min(1.0, usage.quantity / 100); // Normalize usage
      }, 0) / Object.keys(this.currentUsage).length;
      healthScore = (healthScore + usageEngagement) / 2;
    }
    
    this.customerHealthScore = Math.max(0.0, Math.min(1.0, healthScore));
    return this.customerHealthScore;
  }

  // Status transition methods
  activate(): void {
    this.billingStatus = BillingStatus.ACTIVE;
    this.addCustomField('activated_at', new Date());
  }

  suspend(reason?: string): void {
    this.billingStatus = BillingStatus.SUSPENDED;
    this.addCustomField('suspended_at', new Date());
    if (reason) {
      this.addCustomField('suspension_reason', reason);
    }
  }

  markOverdue(): void {
    this.billingStatus = BillingStatus.OVERDUE;
    this.daysPastDue = this.calculateDaysUntilNextBilling() * -1;
    this.addCustomField('marked_overdue_at', new Date());
  }

  cancel(reason?: string): void {
    this.billingStatus = BillingStatus.CANCELLED;
    this.autoRenew = false;
    this.addCustomField('cancelled_at', new Date());
    if (reason) {
      this.addCustomField('cancellation_reason', reason);
    }
  }

  reactivate(): void {
    if (this.billingStatus === BillingStatus.SUSPENDED || this.billingStatus === BillingStatus.OVERDUE) {
      this.billingStatus = BillingStatus.ACTIVE;
      this.daysPastDue = 0;
      this.addCustomField('reactivated_at', new Date());
    }
  }

  processPayment(amount: number, paymentMethod: PaymentMethod): void {
    this.lastPaymentAmount = amount;
    this.lastPaymentDate = new Date();
    this.totalPayments += amount;
    this.outstandingBalance = Math.max(0, this.outstandingBalance - amount);
    
    if (this.outstandingBalance === 0) {
      this.daysPastDue = 0;
      if (this.billingStatus === BillingStatus.OVERDUE) {
        this.billingStatus = BillingStatus.ACTIVE;
      }
    }
    
    this.updateLifetimeValue();
    this.addCustomField('last_payment_method', paymentMethod);
  }

  generateInvoice(): string {
    // Generate unique invoice number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${this.company.code}-${timestamp}-${random}`;
  }

  getPlanDisplayName(): string {
    const planMap = {
      [BillingPlan.FREE]: 'Gratis',
      [BillingPlan.BASIC]: 'Dasar',
      [BillingPlan.PROFESSIONAL]: 'Profesional',
      [BillingPlan.ENTERPRISE]: 'Enterprise',
      [BillingPlan.CUSTOM]: 'Khusus',
    };
    return planMap[this.billingPlan] || this.billingPlan;
  }

  getStatusDisplayName(): string {
    const statusMap = {
      [BillingStatus.ACTIVE]: 'Aktif',
      [BillingStatus.PENDING]: 'Menunggu',
      [BillingStatus.OVERDUE]: 'Terlambat',
      [BillingStatus.SUSPENDED]: 'Ditangguhkan',
      [BillingStatus.CANCELLED]: 'Dibatalkan',
      [BillingStatus.CHURNED]: 'Churn',
    };
    return statusMap[this.billingStatus] || this.billingStatus;
  }
}