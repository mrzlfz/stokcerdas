import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { CompetitiveProduct } from './competitive-product.entity';

export enum PriceChangeReason {
  PROMOTION = 'promotion',
  DISCOUNT = 'discount',
  FLASH_SALE = 'flash_sale',
  PRICE_ADJUSTMENT = 'price_adjustment',
  SEASONAL_CHANGE = 'seasonal_change',
  COMPETITION_RESPONSE = 'competition_response',
  STOCK_CLEARANCE = 'stock_clearance',
  NEW_PRODUCT_LAUNCH = 'new_product_launch',
  SUPPLY_CHAIN_IMPACT = 'supply_chain_impact',
  MARKET_FLUCTUATION = 'market_fluctuation',
  AUTOMATIC_REPRICING = 'automatic_repricing',
  UNKNOWN = 'unknown',
}

export enum PriceEventType {
  PRICE_INCREASE = 'price_increase',
  PRICE_DECREASE = 'price_decrease',
  DISCOUNT_APPLIED = 'discount_applied',
  DISCOUNT_REMOVED = 'discount_removed',
  OUT_OF_STOCK = 'out_of_stock',
  BACK_IN_STOCK = 'back_in_stock',
  NEW_VARIANT_ADDED = 'new_variant_added',
  VARIANT_REMOVED = 'variant_removed',
  SHIPPING_CHANGE = 'shipping_change',
  PROMOTION_START = 'promotion_start',
  PROMOTION_END = 'promotion_end',
}

@Entity('competitive_price_history')
@Index(['tenantId', 'competitiveProductId', 'recordedAt'])
@Index(['tenantId', 'competitiveProductId', 'priceChange'])
@Index(['recordedAt'])
@Index(['priceChangePercent'])
@Index(['eventType'])
@Index(['priceChangeReason'])
export class CompetitivePriceHistory {
  @ApiProperty({ description: 'Unique identifier for price history record' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy' })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  @ApiProperty({ description: 'Reference to competitive product' })
  @Column({ type: 'uuid' })
  competitiveProductId: string;

  // Price Information
  @ApiProperty({ description: 'Current price at time of recording' })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  currentPrice: number;

  @ApiProperty({ description: 'Previous price before this change' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  previousPrice?: number;

  @ApiProperty({ description: 'Original/MSRP price' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  originalPrice?: number;

  @ApiProperty({ description: 'Price change amount (current - previous)' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  priceChange?: number;

  @ApiProperty({ description: 'Price change percentage' })
  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  priceChangePercent?: number;

  @ApiProperty({ description: 'Discount percentage at time of recording' })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercent?: number;

  @ApiProperty({ description: 'Currency code' })
  @Column({ type: 'varchar', length: 3, default: 'IDR' })
  currency: string;

  // Stock Information
  @ApiProperty({ description: 'Available stock at time of recording' })
  @Column({ type: 'integer', nullable: true })
  stockQuantity?: number;

  @ApiProperty({ description: 'Previous stock quantity' })
  @Column({ type: 'integer', nullable: true })
  previousStockQuantity?: number;

  @ApiProperty({ description: 'Stock change amount' })
  @Column({ type: 'integer', nullable: true })
  stockChange?: number;

  @ApiProperty({ description: 'Whether product was in stock' })
  @Column({ type: 'boolean', default: true })
  inStock: boolean;

  @ApiProperty({ description: 'Whether stock was unlimited/high quantity' })
  @Column({ type: 'boolean', default: false })
  unlimitedStock: boolean;

  // Event Information
  @ApiProperty({
    enum: PriceEventType,
    description: 'Type of price event detected',
  })
  @Column({
    type: 'enum',
    enum: PriceEventType,
    nullable: true,
  })
  eventType?: PriceEventType;

  @ApiProperty({
    enum: PriceChangeReason,
    description: 'Reason for price change',
  })
  @Column({
    type: 'enum',
    enum: PriceChangeReason,
    default: PriceChangeReason.UNKNOWN,
  })
  priceChangeReason: PriceChangeReason;

  @ApiProperty({ description: 'Is this part of a promotion/sale campaign' })
  @Column({ type: 'boolean', default: false })
  isPromotion: boolean;

  @ApiProperty({ description: 'Promotion name or campaign title' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  promotionName?: string;

  @ApiProperty({ description: 'Promotion start date' })
  @Column({ type: 'timestamp', nullable: true })
  promotionStart?: Date;

  @ApiProperty({ description: 'Promotion end date' })
  @Column({ type: 'timestamp', nullable: true })
  promotionEnd?: Date;

  // Performance Metrics
  @ApiProperty({ description: 'Product rating at time of recording' })
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating?: number;

  @ApiProperty({ description: 'Number of reviews at time of recording' })
  @Column({ type: 'integer', nullable: true })
  reviewCount?: number;

  @ApiProperty({ description: 'Number of sales at time of recording' })
  @Column({ type: 'integer', nullable: true })
  soldCount?: number;

  @ApiProperty({ description: 'Number of views at time of recording' })
  @Column({ type: 'integer', nullable: true })
  viewCount?: number;

  @ApiProperty({ description: 'Changes in performance metrics' })
  @Column({ type: 'json', nullable: true })
  performanceChanges?: {
    ratingChange?: number;
    reviewCountChange?: number;
    soldCountChange?: number;
    viewCountChange?: number;
  };

  // Shipping Information
  @ApiProperty({ description: 'Shipping cost at time of recording' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingCost?: number;

  @ApiProperty({ description: 'Previous shipping cost' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousShippingCost?: number;

  @ApiProperty({ description: 'Free shipping threshold' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  freeShippingThreshold?: number;

  @ApiProperty({ description: 'Estimated delivery time in days' })
  @Column({ type: 'integer', nullable: true })
  deliveryTimeDays?: number;

  // Market Context
  @ApiProperty({ description: 'Competitor price range at time of recording' })
  @Column({ type: 'json', nullable: true })
  competitorPriceRange?: {
    min: number;
    max: number;
    average: number;
    median: number;
    count: number;
  };

  @ApiProperty({
    description: 'Market position (1 = cheapest, higher = more expensive)',
  })
  @Column({ type: 'integer', nullable: true })
  marketPosition?: number;

  @ApiProperty({ description: 'Price percentile in market (0-100)' })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pricePercentile?: number;

  // Detection and Analysis
  @ApiProperty({
    description: 'Whether this was an automated price change detection',
  })
  @Column({ type: 'boolean', default: true })
  autoDetected: boolean;

  @ApiProperty({
    description: 'Confidence level of price change detection (0-1)',
  })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  detectionConfidence: number;

  @ApiProperty({ description: 'Algorithm or method used for detection' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  detectionMethod?: string;

  @ApiProperty({ description: 'Time taken to detect this change (seconds)' })
  @Column({ type: 'integer', nullable: true })
  detectionLatency?: number;

  // Data Quality
  @ApiProperty({ description: 'Data source reliability score (0-1)' })
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  dataReliability: number;

  @ApiProperty({ description: 'Any data quality issues detected' })
  @Column({ type: 'json', nullable: true })
  dataQualityIssues?: string[];

  @ApiProperty({ description: 'Raw data snapshot for debugging' })
  @Column({ type: 'json', nullable: true })
  rawDataSnapshot?: Record<string, any>;

  // Indonesian Context
  @ApiProperty({ description: 'Indonesian business day context' })
  @Column({ type: 'boolean', default: true })
  isBusinessDay: boolean;

  @ApiProperty({ description: 'Indonesian timezone when recorded' })
  @Column({ type: 'varchar', length: 50, default: 'Asia/Jakarta' })
  timezone: string;

  @ApiProperty({ description: 'Hour of day when recorded (0-23)' })
  @Column({ type: 'integer' })
  hourOfDay: number;

  @ApiProperty({ description: 'Day of week when recorded (0=Sunday)' })
  @Column({ type: 'integer' })
  dayOfWeek: number;

  @ApiProperty({ description: 'Indonesian holiday context if applicable' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  holidayContext?: string;

  @ApiProperty({ description: 'Ramadan period context if applicable' })
  @Column({ type: 'boolean', default: false })
  isRamadanPeriod: boolean;

  // Trend Analysis
  @ApiProperty({ description: 'Short-term price trend (7 days)' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  shortTermTrend?: 'increasing' | 'decreasing' | 'stable' | 'volatile';

  @ApiProperty({ description: 'Medium-term price trend (30 days)' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  mediumTermTrend?: 'increasing' | 'decreasing' | 'stable' | 'volatile';

  @ApiProperty({ description: 'Long-term price trend (90 days)' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  longTermTrend?: 'increasing' | 'decreasing' | 'stable' | 'volatile';

  @ApiProperty({ description: 'Price volatility score (0-1)' })
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  volatilityScore?: number;

  // Metadata
  @ApiProperty({ description: 'Additional metadata about this price record' })
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Internal notes about this price change' })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'When this price was recorded' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => CompetitiveProduct, product => product.priceHistory)
  @JoinColumn({ name: 'competitiveProductId' })
  competitiveProduct: CompetitiveProduct;

  // Computed Properties
  get isSignificantChange(): boolean {
    if (!this.priceChangePercent) return false;
    return Math.abs(this.priceChangePercent) >= 5.0; // 5% or more change
  }

  get isPriceIncrease(): boolean {
    return this.priceChange > 0;
  }

  get isPriceDecrease(): boolean {
    return this.priceChange < 0;
  }

  get changeType(): 'increase' | 'decrease' | 'stable' {
    if (!this.priceChange) return 'stable';
    return this.priceChange > 0 ? 'increase' : 'decrease';
  }

  get isWeekend(): boolean {
    return this.dayOfWeek === 0 || this.dayOfWeek === 6; // Sunday or Saturday
  }

  get isBusinessHours(): boolean {
    return this.hourOfDay >= 9 && this.hourOfDay <= 17; // 9 AM to 5 PM
  }

  get competitivenessScore(): number {
    // Calculate how competitive this price is
    // Lower score = more competitive (cheaper)
    if (!this.competitorPriceRange) return 0.5;

    const { min, max } = this.competitorPriceRange;
    if (max === min) return 0.5;

    return (this.currentPrice - min) / (max - min);
  }
}
