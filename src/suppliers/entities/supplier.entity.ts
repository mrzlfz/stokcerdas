import {
  Entity,
  Column,
  Index,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';

export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum PaymentTerms {
  COD = 'cod', // Cash on Delivery
  NET_7 = 'net_7', // Payment due in 7 days
  NET_15 = 'net_15', // Payment due in 15 days
  NET_30 = 'net_30', // Payment due in 30 days
  NET_45 = 'net_45', // Payment due in 45 days
  NET_60 = 'net_60', // Payment due in 60 days
  PREPAID = 'prepaid', // Payment in advance
  CUSTOM = 'custom', // Custom payment terms
}

export enum SupplierType {
  MANUFACTURER = 'manufacturer',
  DISTRIBUTOR = 'distributor',
  WHOLESALER = 'wholesaler',
  RETAILER = 'retailer',
  SERVICE_PROVIDER = 'service_provider',
  DROPSHIPPER = 'dropshipper',
}

export enum CurrencyCode {
  IDR = 'IDR',
  USD = 'USD',
  EUR = 'EUR',
  SGD = 'SGD',
  MYR = 'MYR',
}

@Entity('suppliers')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'code'], { unique: true, where: 'is_deleted = false' })
@Index(['tenantId', 'email'], { where: 'is_deleted = false' })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'type'])
export class Supplier extends AuditableEntity {
  // Basic Information
  @Column({ type: 'varchar', length: 50, unique: false })
  @Index()
  code: string; // Supplier code (e.g., SUP-001)

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  legalName?: string; // Official legal name if different

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: SupplierType,
    default: SupplierType.DISTRIBUTOR,
  })
  type: SupplierType;

  @Column({
    type: 'enum',
    enum: SupplierStatus,
    default: SupplierStatus.ACTIVE,
  })
  @Index()
  status: SupplierStatus;

  // Contact Information
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  website?: string;

  // Address Information
  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postalCode?: string;

  @Column({ type: 'varchar', length: 100, default: 'Indonesia' })
  country: string;

  // Business Information
  @Column({ type: 'varchar', length: 50, nullable: true })
  taxId?: string; // NPWP in Indonesia

  @Column({ type: 'varchar', length: 50, nullable: true })
  businessLicense?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bankAccountNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankAccountName?: string;

  // Payment Terms
  @Column({
    type: 'enum',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  paymentTerms: PaymentTerms;

  @Column({ type: 'int', nullable: true })
  customPaymentDays?: number; // For CUSTOM payment terms

  @Column({
    type: 'enum',
    enum: CurrencyCode,
    default: CurrencyCode.IDR,
  })
  currency: CurrencyCode;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  creditLimit: number; // Credit limit in currency

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount: number; // Default discount percentage

  // Performance Metrics
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number; // Rating from 0-5

  @Column({ type: 'int', default: 0 })
  totalOrders: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPurchaseAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  onTimeDeliveryRate: number; // Percentage

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  qualityScore: number; // Percentage

  @Column({ type: 'int', default: 0 })
  leadTimeDays: number; // Average lead time in days

  // Dates
  @Column({ type: 'date', nullable: true })
  contractStartDate?: Date;

  @Column({ type: 'date', nullable: true })
  contractEndDate?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  lastOrderDate?: Date;

  // Additional Information
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[]; // Searchable tags

  @Column({ type: 'jsonb', nullable: true })
  notes?: {
    note: string;
    createdBy: string;
    createdAt: Date;
  }[]; // Supplier notes history

  @Column({ type: 'jsonb', nullable: true })
  customFields?: Record<string, any>; // Custom fields for flexibility

  @Column({ type: 'varchar', length: 255, nullable: true })
  primaryContactName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  primaryContactEmail?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  primaryContactPhone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  primaryContactPosition?: string;

  // Relationships
  @OneToMany(() => Product, (product) => product.supplier)
  products: Product[];

  @OneToMany(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.supplier)
  purchaseOrders: PurchaseOrder[];

  // @OneToMany(() => ReorderRule, (rule) => rule.primarySupplier)
  // reorderRules: ReorderRule[];

  // Business Logic Methods
  updatePerformance(orderData: {
    amount: number;
    onTime: boolean;
    qualityScore: number;
    leadTime: number;
  }) {
    this.totalOrders += 1;
    this.totalPurchaseAmount += orderData.amount;
    
    // Update on-time delivery rate
    const currentOnTimeCount = Math.round((this.onTimeDeliveryRate / 100) * (this.totalOrders - 1));
    const newOnTimeCount = currentOnTimeCount + (orderData.onTime ? 1 : 0);
    this.onTimeDeliveryRate = (newOnTimeCount / this.totalOrders) * 100;
    
    // Update quality score (weighted average)
    this.qualityScore = ((this.qualityScore * (this.totalOrders - 1)) + orderData.qualityScore) / this.totalOrders;
    
    // Update lead time (weighted average)
    this.leadTimeDays = Math.round(((this.leadTimeDays * (this.totalOrders - 1)) + orderData.leadTime) / this.totalOrders);
    
    // Calculate overall rating based on performance metrics
    this.updateRating();
    
    this.lastOrderDate = new Date();
  }

  private updateRating() {
    // Rating calculation based on multiple factors
    const onTimeWeight = 0.4;
    const qualityWeight = 0.4;
    const reliabilityWeight = 0.2;
    
    const onTimeScore = this.onTimeDeliveryRate / 20; // Convert to 0-5 scale
    const qualityRating = this.qualityScore / 20; // Convert to 0-5 scale
    const reliabilityScore = Math.min(5, this.totalOrders / 10); // Bonus for order history
    
    this.rating = Math.round(
      (onTimeScore * onTimeWeight + 
       qualityRating * qualityWeight + 
       reliabilityScore * reliabilityWeight) * 100
    ) / 100;
    
    // Ensure rating is within bounds
    this.rating = Math.max(0, Math.min(5, this.rating));
  }

  addNote(note: string, createdBy: string) {
    if (!this.notes) {
      this.notes = [];
    }
    
    this.notes.unshift({
      note,
      createdBy,
      createdAt: new Date(),
    });
    
    // Keep only last 50 notes
    if (this.notes.length > 50) {
      this.notes = this.notes.slice(0, 50);
    }
  }

  isActive(): boolean {
    return this.status === SupplierStatus.ACTIVE;
  }

  isContractValid(): boolean {
    if (!this.contractStartDate || !this.contractEndDate) {
      return true; // No contract restrictions
    }
    
    const now = new Date();
    return now >= this.contractStartDate && now <= this.contractEndDate;
  }

  getPaymentDueDays(): number {
    switch (this.paymentTerms) {
      case PaymentTerms.COD:
        return 0;
      case PaymentTerms.NET_7:
        return 7;
      case PaymentTerms.NET_15:
        return 15;
      case PaymentTerms.NET_30:
        return 30;
      case PaymentTerms.NET_45:
        return 45;
      case PaymentTerms.NET_60:
        return 60;
      case PaymentTerms.PREPAID:
        return -1; // Negative indicates payment in advance
      case PaymentTerms.CUSTOM:
        return this.customPaymentDays || 30;
      default:
        return 30;
    }
  }
}