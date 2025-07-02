import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SENT_TO_SUPPLIER = 'sent_to_supplier',
  ACKNOWLEDGED = 'acknowledged',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum PurchaseOrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum PurchaseOrderType {
  STANDARD = 'standard',
  DROP_SHIP = 'drop_ship',
  CONSIGNMENT = 'consignment',
  SERVICE = 'service',
  EMERGENCY = 'emergency',
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

export enum ApprovalStatus {
  NOT_REQUIRED = 'not_required',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
}

@Entity('purchase_orders')
@Index(['tenantId', 'poNumber'], { unique: true })
@Index(['tenantId', 'supplierId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'orderDate'])
@Index(['tenantId', 'expectedDeliveryDate'])
@Index(['tenantId', 'approvalStatus'])
export class PurchaseOrder extends AuditableEntity {
  // Basic Information
  @Column({ type: 'varchar', length: 50 })
  @Index()
  poNumber: string; // PO-2025-001

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierReference?: string; // Supplier's reference number

  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, supplier => supplier.purchaseOrders, { eager: true })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({
    type: 'enum',
    enum: PurchaseOrderType,
    default: PurchaseOrderType.STANDARD,
  })
  type: PurchaseOrderType;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  @Index()
  status: PurchaseOrderStatus;

  @Column({
    type: 'enum',
    enum: PurchaseOrderPriority,
    default: PurchaseOrderPriority.NORMAL,
  })
  @Index()
  priority: PurchaseOrderPriority;

  // Dates
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  orderDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  expectedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  requestedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentToSupplierAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  firstReceivedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  fullyReceivedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

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

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number; // Percentage

  @Column({ type: 'varchar', length: 10, default: 'IDR' })
  currency: string;

  // Payment Information
  @Column({
    type: 'enum',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  paymentTerms: PaymentTerms;

  @Column({ type: 'integer', nullable: true })
  customPaymentDays?: number; // Used when paymentTerms is CUSTOM

  @Column({ type: 'timestamp', nullable: true })
  paymentDueDate?: Date;

  // Delivery Information
  @Column({ type: 'jsonb', nullable: true })
  deliveryAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    contactPerson?: string;
    notes?: string;
  };

  @Column({ type: 'varchar', length: 100, nullable: true })
  deliveryLocationId?: string; // Reference to inventory location

  @Column({ type: 'varchar', length: 255, nullable: true })
  shippingMethod?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingNumber?: string;

  // Approval Information
  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.NOT_REQUIRED,
  })
  @Index()
  approvalStatus: ApprovalStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  approvalThreshold?: number; // Auto-approval below this amount

  @Column({ type: 'uuid', nullable: true })
  approvedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approver?: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  rejectedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'rejectedBy' })
  rejector?: User;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt?: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  // Additional Information
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ type: 'text', nullable: true })
  supplierInstructions?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  // Status Tracking
  @Column({ type: 'boolean', default: false })
  isUrgent: boolean;

  @Column({ type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  itemCount: number;

  @Column({ type: 'integer', default: 0 })
  receivedItemCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionPercentage: number;

  // PDF and Email Information
  @Column({ type: 'varchar', length: 255, nullable: true })
  pdfFilePath?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastEmailSentAt?: Date;

  @Column({ type: 'integer', default: 0 })
  emailSentCount: number;

  // Relations
  @OneToMany(() => PurchaseOrderItem, item => item.purchaseOrder, { cascade: true, eager: true })
  items?: PurchaseOrderItem[];

  @OneToMany(() => PurchaseOrderApproval, approval => approval.purchaseOrder)
  approvals?: PurchaseOrderApproval[];

  @OneToMany(() => PurchaseOrderStatusHistory, history => history.purchaseOrder)
  statusHistory?: PurchaseOrderStatusHistory[];

  // Virtual fields
  get isEditable(): boolean {
    return [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.REJECTED].includes(this.status);
  }

  get canBeApproved(): boolean {
    return this.status === PurchaseOrderStatus.PENDING_APPROVAL && 
           this.approvalStatus === ApprovalStatus.PENDING;
  }

  get canBeRejected(): boolean {
    return this.status === PurchaseOrderStatus.PENDING_APPROVAL && 
           this.approvalStatus === ApprovalStatus.PENDING;
  }

  get canBeSentToSupplier(): boolean {
    return this.status === PurchaseOrderStatus.APPROVED;
  }

  get canBeCancelled(): boolean {
    return ![
      PurchaseOrderStatus.RECEIVED,
      PurchaseOrderStatus.CLOSED,
      PurchaseOrderStatus.CANCELLED
    ].includes(this.status);
  }

  get isPartiallyReceived(): boolean {
    return this.receivedItemCount > 0 && this.receivedItemCount < this.itemCount;
  }

  get isFullyReceived(): boolean {
    return this.receivedItemCount === this.itemCount && this.itemCount > 0;
  }

  get needsApproval(): boolean {
    return this.requiresApproval && this.approvalStatus === ApprovalStatus.PENDING;
  }

  get isOverdue(): boolean {
    if (!this.expectedDeliveryDate) return false;
    return new Date() > this.expectedDeliveryDate && 
           ![PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CLOSED, PurchaseOrderStatus.CANCELLED].includes(this.status);
  }

  // Methods
  updateStatus(newStatus: PurchaseOrderStatus, userId?: string, reason?: string): void {
    const previousStatus = this.status;
    this.status = newStatus;
    this.updatedBy = userId;

    // Update timestamps based on status
    const now = new Date();
    switch (newStatus) {
      case PurchaseOrderStatus.SENT_TO_SUPPLIER:
        this.sentToSupplierAt = now;
        break;
      case PurchaseOrderStatus.ACKNOWLEDGED:
        this.acknowledgedAt = now;
        break;
      case PurchaseOrderStatus.PARTIALLY_RECEIVED:
        if (!this.firstReceivedAt) {
          this.firstReceivedAt = now;
        }
        break;
      case PurchaseOrderStatus.RECEIVED:
        this.fullyReceivedAt = now;
        if (!this.firstReceivedAt) {
          this.firstReceivedAt = now;
        }
        break;
      case PurchaseOrderStatus.CLOSED:
        this.closedAt = now;
        break;
      case PurchaseOrderStatus.CANCELLED:
        this.cancelledAt = now;
        this.isActive = false;
        break;
    }

    // Update completion percentage
    this.updateCompletionPercentage();
  }

  updateApprovalStatus(newStatus: ApprovalStatus, userId?: string, reason?: string): void {
    this.approvalStatus = newStatus;
    this.updatedBy = userId;

    const now = new Date();
    switch (newStatus) {
      case ApprovalStatus.APPROVED:
        this.approvedBy = userId;
        this.approvedAt = now;
        this.status = PurchaseOrderStatus.APPROVED;
        break;
      case ApprovalStatus.REJECTED:
        this.rejectedBy = userId;
        this.rejectedAt = now;
        this.rejectionReason = reason;
        this.status = PurchaseOrderStatus.REJECTED;
        break;
    }
  }

  calculateTotals(): void {
    if (this.items && this.items.length > 0) {
      this.subtotalAmount = this.items.reduce(
        (sum, item) => sum + (item.unitPrice * item.orderedQuantity),
        0
      );
      
      this.taxAmount = this.subtotalAmount * (this.taxRate / 100);
      this.totalAmount = this.subtotalAmount + this.taxAmount + this.shippingAmount - this.discountAmount;
      this.itemCount = this.items.length;
      this.receivedItemCount = this.items.filter(item => item.receivedQuantity >= item.orderedQuantity).length;
    }
  }

  updateCompletionPercentage(): void {
    if (this.itemCount === 0) {
      this.completionPercentage = 0;
      return;
    }

    const totalOrdered = this.items?.reduce((sum, item) => sum + item.orderedQuantity, 0) || 0;
    const totalReceived = this.items?.reduce((sum, item) => sum + item.receivedQuantity, 0) || 0;

    this.completionPercentage = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;
  }

  addItem(item: Partial<PurchaseOrderItem>): void {
    if (!this.items) this.items = [];
    this.items.push(item as PurchaseOrderItem);
    this.calculateTotals();
  }

  generatePaymentDueDate(): void {
    if (!this.orderDate) return;

    let daysToAdd = 30; // Default NET_30

    switch (this.paymentTerms) {
      case PaymentTerms.COD:
        daysToAdd = 0;
        break;
      case PaymentTerms.NET_7:
        daysToAdd = 7;
        break;
      case PaymentTerms.NET_15:
        daysToAdd = 15;
        break;
      case PaymentTerms.NET_30:
        daysToAdd = 30;
        break;
      case PaymentTerms.NET_45:
        daysToAdd = 45;
        break;
      case PaymentTerms.NET_60:
        daysToAdd = 60;
        break;
      case PaymentTerms.PREPAID:
        daysToAdd = -1; // Payment before order
        break;
      case PaymentTerms.CUSTOM:
        daysToAdd = this.customPaymentDays || 30;
        break;
    }

    const dueDate = new Date(this.orderDate);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    this.paymentDueDate = dueDate;
  }

  requiresApprovalCheck(approvalThreshold: number = 10000000): boolean {
    // Auto-approval for orders below threshold (10 million IDR default)
    if (this.totalAmount < approvalThreshold) {
      this.requiresApproval = false;
      this.approvalStatus = ApprovalStatus.NOT_REQUIRED;
      return false;
    }

    this.requiresApproval = true;
    this.approvalStatus = ApprovalStatus.PENDING;
    return true;
  }
}

// Supporting entities
@Entity('purchase_order_items')
@Index(['tenantId', 'purchaseOrderId'])
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'sku'])
export class PurchaseOrderItem extends AuditableEntity {
  @Column({ type: 'uuid' })
  purchaseOrderId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierSku?: string; // Supplier's product code

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string; // piece, kg, liter, etc.

  @Column({ type: 'integer' })
  orderedQuantity: number;

  @Column({ type: 'integer', default: 0 })
  receivedQuantity: number;

  @Column({ type: 'integer', default: 0 })
  rejectedQuantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  taxRate?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp', nullable: true })
  expectedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastReceivedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  @ManyToOne(() => PurchaseOrder, po => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  // Virtual fields
  get finalPrice(): number {
    return this.totalPrice - this.discountAmount + this.taxAmount;
  }

  get isFullyReceived(): boolean {
    return this.receivedQuantity >= this.orderedQuantity;
  }

  get isPartiallyReceived(): boolean {
    return this.receivedQuantity > 0 && this.receivedQuantity < this.orderedQuantity;
  }

  get remainingQuantity(): number {
    return Math.max(0, this.orderedQuantity - this.receivedQuantity);
  }

  get receivedPercentage(): number {
    return this.orderedQuantity > 0 ? (this.receivedQuantity / this.orderedQuantity) * 100 : 0;
  }

  // Methods
  calculateTotals(): void {
    this.totalPrice = this.unitPrice * this.orderedQuantity;
    
    // Apply discount
    if (this.discountPercentage > 0) {
      this.discountAmount = this.totalPrice * (this.discountPercentage / 100);
    }
    
    // Calculate tax
    const taxableAmount = this.totalPrice - this.discountAmount;
    this.taxAmount = taxableAmount * ((this.taxRate || 0) / 100);
  }

  receiveQuantity(quantity: number, rejectedQuantity: number = 0): void {
    const maxReceivable = this.orderedQuantity - this.receivedQuantity;
    const actualReceived = Math.min(quantity, maxReceivable);
    
    this.receivedQuantity += actualReceived;
    this.rejectedQuantity += rejectedQuantity;
    this.lastReceivedAt = new Date();
  }
}

@Entity('purchase_order_approvals')
@Index(['tenantId', 'purchaseOrderId'])
@Index(['tenantId', 'approverId'])
export class PurchaseOrderApproval extends AuditableEntity {
  @Column({ type: 'uuid' })
  purchaseOrderId: string;

  @Column({ type: 'uuid' })
  approverId: string;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Column({ type: 'integer', default: 1 })
  level: number; // For multi-level approvals

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ type: 'boolean', default: false })
  isEscalated: boolean;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  escalatedTo?: string;

  @ManyToOne(() => PurchaseOrder, po => po.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approverId' })
  approver: User;

  // Methods
  approve(comments?: string): void {
    this.status = ApprovalStatus.APPROVED;
    this.reviewedAt = new Date();
    this.comments = comments;
  }

  reject(reason: string, comments?: string): void {
    this.status = ApprovalStatus.REJECTED;
    this.reviewedAt = new Date();
    this.rejectionReason = reason;
    this.comments = comments;
  }

  escalate(escalatedTo: string): void {
    this.isEscalated = true;
    this.escalatedAt = new Date();
    this.escalatedTo = escalatedTo;
    this.status = ApprovalStatus.ESCALATED;
  }
}

@Entity('purchase_order_status_history')
@Index(['tenantId', 'purchaseOrderId'])
export class PurchaseOrderStatusHistory extends AuditableEntity {
  @Column({ type: 'uuid' })
  purchaseOrderId: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
  })
  status: PurchaseOrderStatus;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    nullable: true,
  })
  previousStatus?: PurchaseOrderStatus;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  changedBy?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string; // 'manual', 'system', 'approval', etc.

  @ManyToOne(() => PurchaseOrder, po => po.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changedBy' })
  user?: User;
}

// Import types for relations (these would be defined in their respective files)
declare class Product {
  id: string;
}

declare class InventoryLocation {
  id: string;
}