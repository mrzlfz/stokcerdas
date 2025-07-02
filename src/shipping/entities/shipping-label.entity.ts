import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';

export enum ShippingLabelStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  PRINTED = 'printed',
  ATTACHED = 'attached',
  SHIPPED = 'shipped',
  CANCELLED = 'cancelled',
}

export enum ShippingServiceType {
  REGULAR = 'regular',
  EXPRESS = 'express',
  SAME_DAY = 'same_day',
  NEXT_DAY = 'next_day',
  INSTANT = 'instant',
  COD = 'cod', // Cash on Delivery
}

export enum InsuranceType {
  NONE = 'none',
  BASIC = 'basic',
  FULL = 'full',
  CUSTOM = 'custom',
}

@Entity('shipping_labels')
@Index(['tenantId', 'orderId'], { unique: true })
@Index(['tenantId', 'carrierId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['trackingNumber'], { unique: true, where: 'trackingNumber IS NOT NULL' })
export class ShippingLabel extends BaseEntity {
  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'varchar', length: 100 })
  carrierId: string; // JNE, JT, SICEPAT, etc.

  @Column({ type: 'varchar', length: 100 })
  carrierName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  airwayBill?: string; // AWB number

  @Column({
    type: 'enum',
    enum: ShippingLabelStatus,
    default: ShippingLabelStatus.DRAFT,
  })
  status: ShippingLabelStatus;

  @Column({
    type: 'enum',
    enum: ShippingServiceType,
    default: ShippingServiceType.REGULAR,
  })
  serviceType: ShippingServiceType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  serviceCode?: string; // Carrier-specific service code

  @Column({ type: 'varchar', length: 100, nullable: true })
  serviceName?: string; // Human-readable service name

  // Shipping Addresses
  @Column({ type: 'jsonb' })
  senderAddress: {
    name: string;
    company?: string;
    address: string;
    district: string; // kecamatan
    city: string;
    state: string; // province
    postalCode: string;
    phone: string;
    email?: string;
  };

  @Column({ type: 'jsonb' })
  recipientAddress: {
    name: string;
    company?: string;
    address: string;
    district: string; // kecamatan
    city: string;
    state: string; // province
    postalCode: string;
    phone: string;
    email?: string;
    notes?: string;
  };

  // Package Information
  @Column({ type: 'jsonb' })
  packageInfo: {
    weight: number; // in grams
    length: number; // in cm
    width: number; // in cm
    height: number; // in cm
    volume?: number; // calculated volume
    content: string; // package description
    category?: string; // kategori barang
    pieces: number; // number of packages
  };

  // Financial Information
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  insuranceCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  codAmount: number; // Cash on Delivery amount

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  adminFee: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalCost: number;

  @Column({ type: 'varchar', length: 10, default: 'IDR' })
  currency: string;

  // Insurance
  @Column({
    type: 'enum',
    enum: InsuranceType,
    default: InsuranceType.NONE,
  })
  insuranceType: InsuranceType;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  insuredValue?: number;

  // Service Features
  @Column({ type: 'boolean', default: false })
  isCod: boolean; // Cash on Delivery

  @Column({ type: 'boolean', default: false })
  requiresSignature: boolean;

  @Column({ type: 'boolean', default: false })
  isFragile: boolean;

  @Column({ type: 'boolean', default: false })
  isHazardous: boolean;

  // Delivery Information
  @Column({ type: 'timestamp', nullable: true })
  estimatedPickupDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualPickupDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualDeliveryDate?: Date;

  // Label Information
  @Column({ type: 'text', nullable: true })
  labelUrl?: string; // URL to download label PDF

  @Column({ type: 'text', nullable: true })
  labelData?: string; // Base64 encoded label data

  @Column({ type: 'varchar', length: 20, nullable: true })
  labelFormat?: string; // PDF, PNG, ZPL, etc.

  @Column({ type: 'timestamp', nullable: true })
  printedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  printedBy?: string;

  // Carrier-specific data
  @Column({ type: 'jsonb', nullable: true })
  carrierData?: {
    bookingId?: string;
    manifestId?: string;
    routeCode?: string;
    originHub?: string;
    destinationHub?: string;
    instructions?: string[];
    additionalServices?: string[];
    [key: string]: any;
  };

  // API Integration
  @Column({ type: 'jsonb', nullable: true })
  apiData?: {
    requestId?: string;
    responseId?: string;
    externalId?: string;
    lastSyncAt?: string;
    syncStatus?: 'pending' | 'synced' | 'failed';
    syncErrors?: string[];
    rawResponse?: any;
  };

  // Status timestamps
  @Column({ type: 'timestamp', nullable: true })
  generatedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  shippedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  // Additional fields
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  // Relations
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  // Virtual fields
  get isActive(): boolean {
    return ![ShippingLabelStatus.CANCELLED].includes(this.status);
  }

  get isShipped(): boolean {
    return [ShippingLabelStatus.SHIPPED].includes(this.status);
  }

  get canBePrinted(): boolean {
    return [ShippingLabelStatus.GENERATED].includes(this.status);
  }

  get canBeCancelled(): boolean {
    return [ShippingLabelStatus.DRAFT, ShippingLabelStatus.GENERATED, ShippingLabelStatus.PRINTED].includes(this.status);
  }

  get totalVolume(): number {
    const { length, width, height } = this.packageInfo;
    return (length * width * height) / 1000; // Convert to liters
  }

  get volumetricWeight(): number {
    // Standard formula: (L x W x H) / 6000 for domestic Indonesia
    const { length, width, height } = this.packageInfo;
    return (length * width * height) / 6000;
  }

  get chargeableWeight(): number {
    // Use higher of actual weight or volumetric weight
    return Math.max(this.packageInfo.weight, this.volumetricWeight);
  }

  // Methods
  updateStatus(newStatus: ShippingLabelStatus, userId?: string, reason?: string): void {
    this.status = newStatus;
    this.updatedBy = userId;

    const now = new Date();
    switch (newStatus) {
      case ShippingLabelStatus.GENERATED:
        this.generatedAt = now;
        break;
      case ShippingLabelStatus.PRINTED:
        this.printedAt = now;
        this.printedBy = userId;
        break;
      case ShippingLabelStatus.SHIPPED:
        this.shippedAt = now;
        break;
      case ShippingLabelStatus.CANCELLED:
        this.cancelledAt = now;
        this.cancellationReason = reason;
        break;
    }
  }

  calculateCosts(): void {
    this.totalCost = this.shippingCost + this.insuranceCost + this.adminFee;
  }

  validateAddresses(): boolean {
    const requiredFields = ['name', 'address', 'city', 'state', 'postalCode', 'phone'];
    
    const senderValid = requiredFields.every(field => 
      this.senderAddress[field] && this.senderAddress[field].trim().length > 0
    );
    
    const recipientValid = requiredFields.every(field => 
      this.recipientAddress[field] && this.recipientAddress[field].trim().length > 0
    );
    
    return senderValid && recipientValid;
  }

  validatePackageInfo(): boolean {
    const { weight, length, width, height, content } = this.packageInfo;
    return weight > 0 && length > 0 && width > 0 && height > 0 && content && content.trim().length > 0;
  }

  isExpressService(): boolean {
    return [ShippingServiceType.EXPRESS, ShippingServiceType.SAME_DAY, ShippingServiceType.NEXT_DAY, ShippingServiceType.INSTANT].includes(this.serviceType);
  }

  getDaysToDelivery(): number | null {
    if (!this.estimatedDeliveryDate) return null;
    
    const now = new Date();
    const diffTime = this.estimatedDeliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}