import { Entity, Column, Index, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  RETURNED = 'returned',
}

export enum OrderType {
  SALE = 'sale',
  RETURN = 'return',
  EXCHANGE = 'exchange',
  INTERNAL = 'internal',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIAL = 'partial',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum FulfillmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('orders')
@Index(['tenantId', 'orderNumber'], { unique: true })
@Index(['tenantId', 'channelId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'orderDate'])
@Index(['tenantId', 'externalOrderId'], { where: 'externalOrderId IS NOT NULL' })
export class Order extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  orderNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalOrderId?: string; // Order ID from external platform (Shopee, Tokopedia, etc.)

  @Column({ type: 'varchar', length: 50, nullable: true })
  channelId?: string; // Sales channel ID

  @Column({ type: 'varchar', length: 100, nullable: true })
  channelName?: string; // Channel display name

  @Column({
    type: 'enum',
    enum: OrderType,
    default: OrderType.SALE,
  })
  type: OrderType;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({
    type: 'enum',
    enum: FulfillmentStatus,
    default: FulfillmentStatus.PENDING,
  })
  fulfillmentStatus: FulfillmentStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  orderDate: Date;

  // Customer Information
  @Column({ type: 'varchar', length: 255 })
  customerName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customerPhone?: string;

  @Column({ type: 'jsonb', nullable: true })
  customerInfo?: {
    id?: string;
    username?: string;
    loyaltyLevel?: string;
    notes?: string;
  };

  // Shipping Information
  @Column({ type: 'jsonb', nullable: true })
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    notes?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  billingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };

  // Financial Information
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  shippingAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'IDR' })
  currency: string;

  // Shipping Information
  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingMethod?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  shippingCarrier?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingNumber?: string;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualDeliveryDate?: Date;

  // Order Processing
  @Column({ type: 'varchar', length: 100, nullable: true })
  processingLocationId?: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  shippedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  // Payment Information
  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentReference?: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  // Additional Information
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'integer', default: 1 })
  priority: number; // 1 = highest, 5 = lowest

  // Channel-specific data
  @Column({ type: 'jsonb', nullable: true })
  channelMetadata?: Record<string, any>;

  // External integration tracking
  @Column({ type: 'jsonb', nullable: true })
  externalData?: {
    platformOrderId?: string;
    platformCustomerId?: string;
    platformData?: Record<string, any>;
    lastSyncAt?: string;
    syncStatus?: 'pending' | 'synced' | 'failed';
    syncErrors?: string[];
  };

  // Relations
  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items?: OrderItem[];

  @OneToMany(() => OrderStatusHistory, status => status.order)
  statusHistory?: OrderStatusHistory[];

  // Virtual fields
  get isActive(): boolean {
    return ![OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(this.status);
  }

  get isPaid(): boolean {
    return this.paymentStatus === PaymentStatus.PAID;
  }

  get isShipped(): boolean {
    return this.fulfillmentStatus === FulfillmentStatus.SHIPPED;
  }

  get isDelivered(): boolean {
    return this.fulfillmentStatus === FulfillmentStatus.DELIVERED;
  }

  get canBeCancelled(): boolean {
    return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(this.status);
  }

  get itemCount(): number {
    return this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  }

  // Methods
  updateStatus(newStatus: OrderStatus, userId?: string, reason?: string): void {
    this.status = newStatus;
    this.updatedBy = userId;

    // Update timestamps based on status
    const now = new Date();
    switch (newStatus) {
      case OrderStatus.CONFIRMED:
        this.confirmedAt = now;
        break;
      case OrderStatus.SHIPPED:
        this.shippedAt = now;
        this.fulfillmentStatus = FulfillmentStatus.SHIPPED;
        break;
      case OrderStatus.DELIVERED:
        this.deliveredAt = now;
        this.fulfillmentStatus = FulfillmentStatus.DELIVERED;
        break;
      case OrderStatus.CANCELLED:
        this.cancelledAt = now;
        this.cancellationReason = reason;
        break;
    }
  }

  calculateTotals(): void {
    if (this.items && this.items.length > 0) {
      this.subtotalAmount = this.items.reduce(
        (sum, item) => sum + (item.unitPrice * item.quantity),
        0
      );
      
      this.totalAmount = this.subtotalAmount + this.taxAmount + this.shippingAmount - this.discountAmount;
    }
  }

  addItem(item: Partial<OrderItem>): void {
    if (!this.items) this.items = [];
    this.items.push(item as OrderItem);
    this.calculateTotals();
  }
}

// Supporting entities
@Entity('order_items')
@Index(['tenantId', 'orderId'])
@Index(['tenantId', 'productId'])
export class OrderItem extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  variantId?: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  variantName?: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  taxRate?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image?: string;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // External platform specific data
  @Column({ type: 'varchar', length: 100, nullable: true })
  externalItemId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalProductId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalVariantId?: string;

  @Column({ type: 'jsonb', nullable: true })
  externalData?: Record<string, any>;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // Virtual fields
  get finalPrice(): number {
    return this.totalPrice - this.discountAmount + this.taxAmount;
  }

  // Methods
  calculateTotals(): void {
    this.totalPrice = this.unitPrice * this.quantity;
    this.taxAmount = this.totalPrice * (this.taxRate || 0) / 100;
  }
}

@Entity('order_status_history')
@Index(['tenantId', 'orderId'])
export class OrderStatusHistory extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    nullable: true,
  })
  previousStatus?: OrderStatus;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  changedBy?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string; // 'manual', 'system', 'channel', etc.

  @ManyToOne(() => Order, order => order.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}

// Import types for relations (these would be defined in their respective files)
declare class Product {
  id: string;
}

declare class ProductVariant {
  id: string;
}