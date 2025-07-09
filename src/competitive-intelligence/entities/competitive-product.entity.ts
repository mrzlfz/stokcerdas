import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { Product } from '../../products/entities/product.entity';
import { CompetitivePriceHistory } from './competitive-price-history.entity';
import { CompetitiveAnalysis } from './competitive-analysis.entity';

export enum MarketplaceType {
  TOKOPEDIA = 'tokopedia',
  SHOPEE = 'shopee',
  LAZADA = 'lazada',
  BUKALAPAK = 'bukalapak',
  BLIBLI = 'blibli',
  ORAMI = 'orami',
  ZALORA = 'zalora',
  OFFLINE_STORE = 'offline_store',
  OTHER = 'other',
}

export enum CompetitiveProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
  RESTRICTED = 'restricted',
  UNKNOWN = 'unknown',
}

export enum DataQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  UNRELIABLE = 'unreliable',
}

@Entity('competitive_products')
@Index(['tenantId', 'marketplace', 'externalProductId'], { unique: true })
@Index(['tenantId', 'ourProductId'])
@Index(['tenantId', 'marketplace', 'status'])
@Index(['tenantId', 'category', 'marketplace'])
@Index(['tenantId', 'brand', 'marketplace'])
@Index(['currentPrice', 'marketplace'])
@Index(['lastUpdated'])
@Index(['dataQuality', 'status'])
export class CompetitiveProduct {
  @ApiProperty({ description: 'Unique identifier for competitive product' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy' })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;

  // Product Identification
  @ApiProperty({ description: 'Reference to our own product for comparison' })
  @Column({ type: 'uuid', nullable: true })
  ourProductId?: string;

  @ApiProperty({ description: 'External marketplace product ID' })
  @Column({ type: 'varchar', length: 255 })
  externalProductId: string;

  @ApiProperty({ description: 'External marketplace SKU' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  externalSku?: string;

  // Marketplace Information
  @ApiProperty({ enum: MarketplaceType, description: 'Marketplace platform' })
  @Column({
    type: 'enum',
    enum: MarketplaceType,
  })
  marketplace: MarketplaceType;

  @ApiProperty({ description: 'Marketplace seller/store ID' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  sellerId?: string;

  @ApiProperty({ description: 'Marketplace seller/store name' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  sellerName?: string;

  @ApiProperty({ description: 'Store reputation score (0-100)' })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  sellerRating?: number;

  @ApiProperty({ description: 'Number of reviews for the seller' })
  @Column({ type: 'integer', nullable: true })
  sellerReviewCount?: number;

  // Product Details
  @ApiProperty({ description: 'Product name on marketplace' })
  @Column({ type: 'varchar', length: 1000 })
  name: string;

  @ApiProperty({ description: 'Product description on marketplace' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Product brand' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  brand?: string;

  @ApiProperty({ description: 'Product category on marketplace' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  category?: string;

  @ApiProperty({ description: 'Product subcategory' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  subcategory?: string;

  @ApiProperty({ description: 'Product tags/keywords' })
  @Column({ type: 'json', nullable: true })
  tags?: string[];

  // Pricing Information
  @ApiProperty({ description: 'Current price in IDR' })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  currentPrice: number;

  @ApiProperty({ description: 'Original price before discount' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  originalPrice?: number;

  @ApiProperty({ description: 'Discount percentage' })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercent?: number;

  @ApiProperty({ description: 'Minimum order quantity' })
  @Column({ type: 'integer', default: 1 })
  minOrderQty: number;

  @ApiProperty({ description: 'Currency code (usually IDR)' })
  @Column({ type: 'varchar', length: 3, default: 'IDR' })
  currency: string;

  // Stock and Availability
  @ApiProperty({
    enum: CompetitiveProductStatus,
    description: 'Product status',
  })
  @Column({
    type: 'enum',
    enum: CompetitiveProductStatus,
    default: CompetitiveProductStatus.ACTIVE,
  })
  status: CompetitiveProductStatus;

  @ApiProperty({ description: 'Available stock quantity' })
  @Column({ type: 'integer', nullable: true })
  stockQuantity?: number;

  @ApiProperty({ description: 'Stock location/warehouse' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  stockLocation?: string;

  @ApiProperty({ description: 'Is stock unlimited/high quantity' })
  @Column({ type: 'boolean', default: false })
  unlimitedStock: boolean;

  // Performance Metrics
  @ApiProperty({ description: 'Number of times product was sold' })
  @Column({ type: 'integer', nullable: true })
  soldCount?: number;

  @ApiProperty({ description: 'Number of product views' })
  @Column({ type: 'integer', nullable: true })
  viewCount?: number;

  @ApiProperty({ description: 'Number of likes/favorites' })
  @Column({ type: 'integer', nullable: true })
  likeCount?: number;

  @ApiProperty({ description: 'Product rating (1-5)' })
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating?: number;

  @ApiProperty({ description: 'Number of reviews' })
  @Column({ type: 'integer', nullable: true })
  reviewCount?: number;

  // Shipping Information
  @ApiProperty({ description: 'Shipping cost in IDR' })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingCost?: number;

  @ApiProperty({ description: 'Free shipping threshold' })
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  freeShippingThreshold?: number;

  @ApiProperty({ description: 'Estimated delivery time in days' })
  @Column({ type: 'integer', nullable: true })
  deliveryTimeDays?: number;

  @ApiProperty({ description: 'Available shipping methods' })
  @Column({ type: 'json', nullable: true })
  shippingMethods?: string[];

  // Media and Content
  @ApiProperty({ description: 'Primary product image URL' })
  @Column({ type: 'text', nullable: true })
  primaryImageUrl?: string;

  @ApiProperty({ description: 'Additional product image URLs' })
  @Column({ type: 'json', nullable: true })
  imageUrls?: string[];

  @ApiProperty({ description: 'Product video URLs' })
  @Column({ type: 'json', nullable: true })
  videoUrls?: string[];

  // Product Attributes
  @ApiProperty({ description: 'Product specifications and attributes' })
  @Column({ type: 'json', nullable: true })
  attributes?: Record<string, any>;

  @ApiProperty({ description: 'Product variants (size, color, etc.)' })
  @Column({ type: 'json', nullable: true })
  variants?: Array<{
    name: string;
    value: string;
    price?: number;
    stock?: number;
    sku?: string;
  }>;

  // Competitive Intelligence
  @ApiProperty({ description: 'Direct competitor flag' })
  @Column({ type: 'boolean', default: false })
  isDirectCompetitor: boolean;

  @ApiProperty({ description: 'Competitive threat level (1-10)' })
  @Column({ type: 'integer', nullable: true })
  threatLevel?: number;

  @ApiProperty({ description: 'Market position ranking' })
  @Column({ type: 'integer', nullable: true })
  marketRanking?: number;

  @ApiProperty({ description: 'Estimated market share percentage' })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  marketShare?: number;

  // Data Quality and Tracking
  @ApiProperty({ enum: DataQuality, description: 'Quality of scraped data' })
  @Column({
    type: 'enum',
    enum: DataQuality,
    default: DataQuality.MEDIUM,
  })
  dataQuality: DataQuality;

  @ApiProperty({ description: 'Last successful data update timestamp' })
  @Column({ type: 'timestamp', nullable: true })
  lastUpdated?: Date;

  @ApiProperty({ description: 'Last time product was checked' })
  @Column({ type: 'timestamp', nullable: true })
  lastChecked?: Date;

  @ApiProperty({ description: 'Number of consecutive failed checks' })
  @Column({ type: 'integer', default: 0 })
  failedChecks: number;

  @ApiProperty({ description: 'Reason for last failed check' })
  @Column({ type: 'text', nullable: true })
  lastError?: string;

  // Monitoring Configuration
  @ApiProperty({ description: 'How often to check this product (minutes)' })
  @Column({ type: 'integer', default: 1440 }) // Default: daily
  checkInterval: number;

  @ApiProperty({ description: 'Enable/disable monitoring for this product' })
  @Column({ type: 'boolean', default: true })
  monitoringEnabled: boolean;

  @ApiProperty({ description: 'Priority level for monitoring (1-10)' })
  @Column({ type: 'integer', default: 5 })
  monitoringPriority: number;

  // Indonesian Context
  @ApiProperty({ description: 'Indonesian region (Java, Sumatra, etc.)' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  region?: string;

  @ApiProperty({ description: 'Major Indonesian cities where available' })
  @Column({ type: 'json', nullable: true })
  availableCities?: string[];

  @ApiProperty({ description: 'Indonesian business license info' })
  @Column({ type: 'json', nullable: true })
  businessLicense?: {
    type: string;
    number: string;
    verified: boolean;
  };

  // Metadata
  @ApiProperty({ description: 'Additional metadata' })
  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Internal notes about this competitive product' })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ApiProperty({ description: 'Tags for categorizing competitive products' })
  @Column({ type: 'json', nullable: true })
  internalTags?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'ourProductId' })
  ourProduct?: Product;

  @OneToMany(
    () => CompetitivePriceHistory,
    history => history.competitiveProduct,
  )
  priceHistory: CompetitivePriceHistory[];

  @OneToMany(() => CompetitiveAnalysis, analysis => analysis.competitiveProduct)
  competitiveAnalyses: CompetitiveAnalysis[];

  // Computed Properties
  get priceCompetitiveness(): 'cheaper' | 'similar' | 'expensive' | 'unknown' {
    if (
      !this.ourProduct ||
      !this.ourProduct.sellingPrice ||
      !this.currentPrice
    ) {
      return 'unknown';
    }

    // Convert prices to ensure proper comparison (handle currency if needed)
    const ourPrice = Number(this.ourProduct.sellingPrice);
    const competitorPrice = Number(this.currentPrice);

    if (ourPrice <= 0 || competitorPrice <= 0) {
      return 'unknown';
    }

    // Calculate price difference percentage
    const priceDifference = ((competitorPrice - ourPrice) / ourPrice) * 100;

    // Define tolerance thresholds (Indonesian market context)
    const toleranceThreshold = 5; // ±5% considered similar

    if (priceDifference > toleranceThreshold) {
      return 'expensive'; // Competitor more expensive than us
    } else if (priceDifference < -toleranceThreshold) {
      return 'cheaper'; // Competitor cheaper than us
    } else {
      return 'similar'; // Within tolerance range
    }
  }

  get isOutperforming(): boolean {
    if (!this.ourProduct) return false;

    // Compare key performance metrics
    const hasGoodSales = (this.soldCount || 0) > 1000;
    const hasGoodRating = (this.rating || 0) > 4.0;
    const hasGoodReviews = (this.reviewCount || 0) > 100;

    return hasGoodSales && hasGoodRating && hasGoodReviews;
  }

  get priceAdvantage(): number {
    if (
      !this.ourProduct ||
      !this.ourProduct.sellingPrice ||
      !this.currentPrice
    ) {
      return 0;
    }

    const ourPrice = Number(this.ourProduct.sellingPrice);
    const competitorPrice = Number(this.currentPrice);

    if (ourPrice <= 0 || competitorPrice <= 0) {
      return 0;
    }

    // Positive value means we're cheaper (advantage), negative means we're more expensive
    return ((ourPrice - competitorPrice) / competitorPrice) * 100;
  }

  get competitiveThreatScore(): number {
    let score = 0;

    // Price competitiveness (40% weight)
    const priceComp = this.priceCompetitiveness;
    if (priceComp === 'cheaper') score += 40;
    else if (priceComp === 'similar') score += 25;
    else if (priceComp === 'expensive') score += 0;

    // Performance metrics (35% weight)
    if (this.isOutperforming) score += 35;
    else if ((this.rating || 0) > 3.5) score += 20;
    else if ((this.rating || 0) > 2.5) score += 10;

    // Market presence (25% weight)
    if ((this.soldCount || 0) > 5000) score += 25;
    else if ((this.soldCount || 0) > 1000) score += 15;
    else if ((this.soldCount || 0) > 100) score += 5;

    return Math.min(score, 100); // Cap at 100
  }

  get dataFreshness(): 'fresh' | 'stale' | 'expired' {
    if (!this.lastUpdated) return 'expired';

    const hoursSinceUpdate =
      (Date.now() - this.lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursSinceUpdate < 24) return 'fresh';
    if (hoursSinceUpdate < 72) return 'stale';
    return 'expired';
  }

  get discountPercentage(): number {
    if (!this.originalPrice || !this.currentPrice) return 0;

    const original = Number(this.originalPrice);
    const current = Number(this.currentPrice);

    if (original <= 0 || current <= 0 || current >= original) return 0;

    return ((original - current) / original) * 100;
  }
}
