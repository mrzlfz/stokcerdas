import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Channel } from './channel.entity';

export enum AllocationStrategy {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  DYNAMIC = 'dynamic',
  PRIORITY = 'priority',
}

export enum AllocationStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

@Entity('channel_inventory')
@Index(['tenantId', 'channelId', 'productId'], { unique: true })
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'channelId'])
@Index(['tenantId', 'status'])
export class ChannelInventory extends BaseEntity {
  @Column({ type: 'uuid' })
  channelId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  variantId?: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  // Allocation configuration
  @Column({
    type: 'enum',
    enum: AllocationStrategy,
    default: AllocationStrategy.PERCENTAGE,
  })
  allocationStrategy: AllocationStrategy;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  allocationValue: number; // Percentage or fixed amount

  @Column({ type: 'integer', default: 1 })
  priority: number; // 1 = highest priority

  // Current inventory state
  @Column({ type: 'integer', default: 0 })
  allocatedQuantity: number;

  @Column({ type: 'integer', default: 0 })
  reservedQuantity: number;

  @Column({ type: 'integer', default: 0 })
  availableQuantity: number;

  @Column({ type: 'integer', default: 0 })
  bufferStock: number; // Safety buffer

  @Column({ type: 'integer', default: 0 })
  minStock: number; // Minimum stock to maintain

  @Column({ type: 'integer', default: 0 })
  maxStock: number; // Maximum stock to allocate

  // Pricing for this channel
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  channelPrice?: number; // Override price for this channel

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  priceMarkup: number; // Percentage markup from base price

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  discountPrice?: number; // Promotional price

  @Column({ type: 'timestamp', nullable: true })
  discountStartDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  discountEndDate?: Date;

  // Status and visibility
  @Column({
    type: 'enum',
    enum: AllocationStatus,
    default: AllocationStatus.ACTIVE,
  })
  status: AllocationStatus;

  @Column({ type: 'boolean', default: true })
  isVisible: boolean; // Show/hide on channel

  @Column({ type: 'boolean', default: true })
  autoSync: boolean; // Auto-sync inventory changes

  @Column({ type: 'boolean', default: false })
  allowBackorder: boolean;

  // Channel-specific data
  @Column({ type: 'varchar', length: 100, nullable: true })
  externalId?: string; // Product ID on external platform

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalSku?: string; // SKU on external platform

  @Column({ type: 'jsonb', nullable: true })
  channelData?: {
    categoryId?: string;
    categoryName?: string;
    listing?: {
      title?: string;
      description?: string;
      images?: string[];
      specifications?: Record<string, any>;
    };
    shipping?: {
      weight?: number;
      dimensions?: string;
      shippingClass?: string;
    };
    seo?: {
      tags?: string[];
      keywords?: string[];
    };
  };

  // Sync tracking
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPriceSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastInventorySyncAt?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  syncStatus?: 'pending' | 'synced' | 'failed' | 'conflict';

  @Column({ type: 'text', nullable: true })
  syncError?: string;

  @Column({ type: 'integer', default: 0 })
  syncRetryCount: number;

  // Performance metrics
  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    totalSales?: number;
    totalRevenue?: number;
    averageOrderValue?: number;
    conversionRate?: number;
    viewCount?: number;
    lastSaleAt?: string;
    stockTurnover?: number;
    outOfStockDays?: number;
  };

  // Historical tracking
  @Column({ type: 'timestamp', nullable: true })
  lastStockUpdateAt?: Date;

  @Column({ type: 'integer', nullable: true })
  previousQuantity?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Relations
  @ManyToOne(() => Channel, channel => channel.inventoryAllocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  // Virtual fields
  get actualAvailable(): number {
    return Math.max(0, this.allocatedQuantity - this.reservedQuantity);
  }

  get isOutOfStock(): boolean {
    return this.actualAvailable <= 0;
  }

  get isLowStock(): boolean {
    return this.actualAvailable <= this.minStock && this.actualAvailable > 0;
  }

  get hasDiscount(): boolean {
    if (!this.discountPrice || !this.discountStartDate || !this.discountEndDate) {
      return false;
    }
    const now = new Date();
    return now >= this.discountStartDate && now <= this.discountEndDate;
  }

  get effectivePrice(): number {
    if (this.hasDiscount && this.discountPrice) {
      return this.discountPrice;
    }
    return this.channelPrice || 0;
  }

  get needsRebalancing(): boolean {
    return this.allocationStrategy === AllocationStrategy.DYNAMIC && 
           (this.isOutOfStock || this.isLowStock);
  }

  // Methods
  updateAllocation(newQuantity: number, reason?: string): void {
    this.previousQuantity = this.allocatedQuantity;
    this.allocatedQuantity = newQuantity;
    this.availableQuantity = Math.max(0, newQuantity - this.reservedQuantity);
    this.lastStockUpdateAt = new Date();
    
    // Update status based on stock level
    if (this.isOutOfStock) {
      this.status = AllocationStatus.OUT_OF_STOCK;
    } else if (this.status === AllocationStatus.OUT_OF_STOCK) {
      this.status = AllocationStatus.ACTIVE;
    }
  }

  reserve(quantity: number): boolean {
    if (this.actualAvailable >= quantity) {
      this.reservedQuantity += quantity;
      this.availableQuantity = Math.max(0, this.allocatedQuantity - this.reservedQuantity);
      return true;
    }
    return false;
  }

  releaseReservation(quantity: number): void {
    this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
    this.availableQuantity = Math.max(0, this.allocatedQuantity - this.reservedQuantity);
  }

  calculateAllocation(totalStock: number): number {
    switch (this.allocationStrategy) {
      case AllocationStrategy.PERCENTAGE:
        return Math.floor(totalStock * (this.allocationValue / 100));
      
      case AllocationStrategy.FIXED_AMOUNT:
        return Math.min(this.allocationValue, totalStock);
      
      case AllocationStrategy.DYNAMIC:
        // Dynamic allocation based on sales velocity and other factors
        const baseAllocation = Math.floor(totalStock * (this.allocationValue / 100));
        const salesVelocity = this.metrics?.totalSales || 0;
        const conversionRate = this.metrics?.conversionRate || 0;
        
        // Adjust based on performance
        const performanceMultiplier = (salesVelocity * conversionRate) / 100;
        return Math.floor(baseAllocation * (1 + performanceMultiplier));
      
      case AllocationStrategy.PRIORITY:
        // Will be calculated at service level considering all channels
        return this.allocatedQuantity;
      
      default:
        return 0;
    }
  }

  updatePrice(newPrice: number, isDiscounted: boolean = false): void {
    if (isDiscounted) {
      this.discountPrice = newPrice;
    } else {
      this.channelPrice = newPrice;
    }
    this.lastPriceSyncAt = new Date();
  }

  recordSale(quantity: number, amount: number): void {
    this.metrics = {
      ...this.metrics,
      totalSales: (this.metrics?.totalSales || 0) + quantity,
      totalRevenue: (this.metrics?.totalRevenue || 0) + amount,
      lastSaleAt: new Date().toISOString(),
    };
    
    // Update average order value
    if (this.metrics.totalSales > 0) {
      this.metrics.averageOrderValue = this.metrics.totalRevenue / this.metrics.totalSales;
    }
  }

  updateSyncStatus(status: string, error?: string): void {
    this.syncStatus = status as any;
    this.lastSyncAt = new Date();
    
    if (error) {
      this.syncError = error;
      this.syncRetryCount += 1;
    } else {
      this.syncError = null;
      this.syncRetryCount = 0;
    }
  }
}