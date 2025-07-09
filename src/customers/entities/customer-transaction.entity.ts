import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from './customer.entity';

export enum TransactionType {
  PURCHASE = 'purchase',
  RETURN = 'return',
  REFUND = 'refund',
  EXCHANGE = 'exchange',
  CREDIT = 'credit',
  LOYALTY_REDEMPTION = 'loyalty_redemption',
  LOYALTY_EARN = 'loyalty_earn',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  QRIS = 'qris',
  GOPAY = 'gopay',
  OVO = 'ovo',
  DANA = 'dana',
  SHOPEEPAY = 'shopeepay',
  LINKAJA = 'linkaja',
  COD = 'cod',
}

@Entity('customer_transactions')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'transactionDate'])
@Index(['tenantId', 'transactionType'])
@Index(['tenantId', 'channel'])
@Index(['tenantId', 'status'])
@Index(['customerId', 'transactionDate'])
@Index(['customerId', 'transactionType', 'status'])
export class CustomerTransaction extends BaseEntity {
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 50 })
  transactionNumber: string;

  @Column({ type: 'uuid', nullable: true })
  orderId?: string; // Reference to Order entity

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalTransactionId?: string; // ID from external system

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
  })
  status: TransactionStatus;

  @Column({ type: 'timestamp' })
  transactionDate: Date;

  // Financial Information
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  shippingAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'IDR' })
  currency: string;

  // Payment Information
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod?: PaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentReference?: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  // Channel & Source Information
  @Column({ type: 'varchar', length: 100, nullable: true })
  channel?: string; // 'online', 'store', 'mobile_app', 'shopee', 'tokopedia', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  channelId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceType?: string; // 'organic', 'paid_ads', 'referral', 'email_campaign', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  campaignId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceType?: string; // 'mobile', 'desktop', 'tablet', 'pos'

  // Product Information
  @Column({ type: 'jsonb' })
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    categoryId?: string;
    categoryName?: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    discountAmount: number;
    margin?: number; // Profit margin for this item
  }>;

  @Column({ type: 'integer' })
  itemCount: number; // Total number of items

  @Column({ type: 'integer' })
  uniqueItemCount: number; // Number of unique products

  // Customer Behavior Metrics
  @Column({ type: 'integer', nullable: true })
  daysSinceLastPurchase?: number;

  @Column({ type: 'integer', nullable: true })
  purchaseSequenceNumber?: number; // 1st, 2nd, 3rd purchase, etc.

  @Column({ type: 'boolean', default: false })
  isFirstPurchase: boolean;

  @Column({ type: 'boolean', default: false })
  isRepeatPurchase: boolean;

  @Column({ type: 'boolean', default: false })
  isReturnCustomer: boolean;

  // Transaction Context
  @Column({ type: 'varchar', length: 20, nullable: true })
  timeOfDay?: string; // 'morning', 'afternoon', 'evening', 'night'

  @Column({ type: 'varchar', length: 20, nullable: true })
  dayOfWeek?: string; // 'monday', 'tuesday', etc.

  @Column({ type: 'varchar', length: 20, nullable: true })
  seasonalContext?: string; // 'ramadan', 'lebaran', 'christmas', 'new_year', 'back_to_school'

  @Column({ type: 'boolean', default: false })
  isHolidayPurchase: boolean;

  @Column({ type: 'boolean', default: false })
  isWeekendPurchase: boolean;

  // Geographic Information
  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode?: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  // Promotional Information
  @Column({ type: 'jsonb', nullable: true })
  promotions?: Array<{
    promotionId: string;
    promotionName: string;
    promotionType: string;
    discountValue: number;
    discountType: 'percentage' | 'fixed';
  }>;

  @Column({ type: 'jsonb', nullable: true })
  coupons?: Array<{
    couponCode: string;
    couponName: string;
    discountValue: number;
    discountType: 'percentage' | 'fixed';
  }>;

  @Column({ type: 'integer', default: 0 })
  loyaltyPointsEarned: number;

  @Column({ type: 'integer', default: 0 })
  loyaltyPointsRedeemed: number;

  // Customer Service Information
  @Column({ type: 'boolean', default: false })
  hadCustomerService: boolean;

  @Column({ type: 'integer', nullable: true })
  customerServiceTicketId?: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  satisfactionRating?: number; // 1-10 scale

  @Column({ type: 'text', nullable: true })
  customerFeedback?: string;

  // Return/Refund Information
  @Column({ type: 'uuid', nullable: true })
  originalTransactionId?: string; // For returns/refunds

  @Column({ type: 'varchar', length: 100, nullable: true })
  returnReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  returnDate?: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  returnAmount: number;

  // Analytics & Insights
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  marginPercentage: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  profitAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  analyticsData?: {
    customerLifecycleStage: string;
    customerSegment: string;
    predictedChurnProbability: number;
    predictedNextPurchaseDate: string;
    recommendedProducts: string[];
    crossSellOpportunities: string[];
    upsellOpportunities: string[];
  };

  // External System Data
  @Column({ type: 'jsonb', nullable: true })
  externalData?: {
    platformData: Record<string, any>;
    integrationMetadata: Record<string, any>;
    syncStatus: 'pending' | 'synced' | 'failed';
    lastSyncAt: string;
  };

  // Additional Metadata
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  // Relations
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  // Virtual fields
  get netAmount(): number {
    return this.totalAmount - this.returnAmount;
  }

  get effectiveDiscountPercentage(): number {
    return this.amount > 0 ? (this.discountAmount / this.amount) * 100 : 0;
  }

  get averageItemPrice(): number {
    return this.itemCount > 0 ? this.amount / this.itemCount : 0;
  }

  get isHighValueTransaction(): boolean {
    return this.totalAmount > 1000000; // 1M IDR
  }

  get transactionAge(): number {
    return Math.floor(
      (Date.now() - this.transactionDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  // Methods
  calculateContext(): void {
    const date = new Date(this.transactionDate);
    const hour = date.getHours();

    // Set time of day
    if (hour >= 6 && hour < 12) this.timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) this.timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) this.timeOfDay = 'evening';
    else this.timeOfDay = 'night';

    // Set day of week
    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    this.dayOfWeek = dayNames[date.getDay()];
    this.isWeekendPurchase = date.getDay() === 0 || date.getDay() === 6;

    // Set seasonal context (this would be enhanced with actual Indonesian calendar)
    const month = date.getMonth();
    if (month === 11 || month === 0) this.seasonalContext = 'new_year';
    else if (month === 11) this.seasonalContext = 'christmas';
    // Add Ramadan/Lebaran logic based on Islamic calendar
  }

  calculateMetrics(): void {
    // Calculate total amounts
    this.amount = this.items.reduce(
      (sum, item) => sum + (item.totalPrice - item.discountAmount),
      0,
    );
    this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.uniqueItemCount = this.items.length;

    // Calculate margin
    this.profitAmount = this.items.reduce(
      (sum, item) => sum + (item.margin || 0),
      0,
    );
    this.marginPercentage =
      this.amount > 0 ? (this.profitAmount / this.amount) * 100 : 0;

    // Set context
    this.calculateContext();
  }

  addAnalyticsData(customerData: any): void {
    this.analyticsData = {
      customerLifecycleStage: customerData.lifecycleStage || 'unknown',
      customerSegment: customerData.segment || 'unknown',
      predictedChurnProbability: customerData.churnProbability || 0,
      predictedNextPurchaseDate: customerData.nextPurchaseDate || '',
      recommendedProducts: customerData.recommendedProducts || [],
      crossSellOpportunities: customerData.crossSellOpportunities || [],
      upsellOpportunities: customerData.upsellOpportunities || [],
    };
  }

  markAsReturn(reason: string, returnAmount: number): void {
    this.transactionType = TransactionType.RETURN;
    this.returnReason = reason;
    this.returnDate = new Date();
    this.returnAmount = returnAmount;
    this.status = TransactionStatus.COMPLETED;
  }

  addPromotion(promotion: any): void {
    if (!this.promotions) this.promotions = [];
    this.promotions.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      promotionType: promotion.type,
      discountValue: promotion.discountValue,
      discountType: promotion.discountType,
    });
  }

  addCoupon(coupon: any): void {
    if (!this.coupons) this.coupons = [];
    this.coupons.push({
      couponCode: coupon.code,
      couponName: coupon.name,
      discountValue: coupon.discountValue,
      discountType: coupon.discountType,
    });
  }
}
