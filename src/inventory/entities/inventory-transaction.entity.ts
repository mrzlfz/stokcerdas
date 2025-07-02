import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryLocation } from './inventory-location.entity';
import { InventoryItem } from './inventory-item.entity';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  RECEIPT = 'receipt',                    // Incoming stock
  ISSUE = 'issue',                        // Outgoing stock
  TRANSFER_OUT = 'transfer_out',          // Transfer to another location
  TRANSFER_IN = 'transfer_in',            // Transfer from another location
  ADJUSTMENT_POSITIVE = 'adjustment_positive', // Stock count increase
  ADJUSTMENT_NEGATIVE = 'adjustment_negative', // Stock count decrease
  SALE = 'sale',                         // Sale transaction
  RETURN = 'return',                     // Return from customer
  PRODUCTION_INPUT = 'production_input',  // Used in production
  PRODUCTION_OUTPUT = 'production_output', // Created from production
  DAMAGED = 'damaged',                   // Stock marked as damaged
  EXPIRED = 'expired',                   // Stock marked as expired
  LOST = 'lost',                         // Stock marked as lost
  FOUND = 'found',                       // Stock found during audit
  RESERVATION = 'reservation',           // Stock reserved
  RESERVATION_RELEASE = 'reservation_release', // Reservation released
  ALLOCATION = 'allocation',             // Stock allocated
  ALLOCATION_RELEASE = 'allocation_release',   // Allocation released
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

@Entity('inventory_transactions')
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'locationId'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'transactionDate'])
@Index(['tenantId', 'referenceType', 'referenceId'])
export class InventoryTransaction extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'uuid', nullable: true })
  inventoryItemId?: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  quantityBefore: number;

  @Column({ type: 'int' })
  quantityAfter: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  unitCost?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  totalCost?: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transactionDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType?: string; // 'sale', 'purchase_order', 'transfer', etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId?: string; // ID of the related document

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber?: string; // Human-readable reference

  @Column({ type: 'uuid', nullable: true })
  relatedTransactionId?: string; // For transfer pairs, reversals, etc.

  @Column({ type: 'uuid', nullable: true })
  sourceLocationId?: string; // For transfers

  @Column({ type: 'uuid', nullable: true })
  destinationLocationId?: string; // For transfers

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Additional data specific to transaction type

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  processedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  cancelledBy?: string;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  // Relations
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => InventoryLocation)
  @JoinColumn({ name: 'locationId' })
  location: InventoryLocation;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem?: InventoryItem;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'sourceLocationId' })
  sourceLocation?: InventoryLocation;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'destinationLocationId' })
  destinationLocation?: InventoryLocation;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processedBy' })
  processor?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cancelledBy' })
  canceller?: User;

  @ManyToOne(() => InventoryTransaction, { nullable: true })
  @JoinColumn({ name: 'relatedTransactionId' })
  relatedTransaction?: InventoryTransaction;

  // Virtual fields
  get isIncoming(): boolean {
    return [
      TransactionType.RECEIPT,
      TransactionType.TRANSFER_IN,
      TransactionType.ADJUSTMENT_POSITIVE,
      TransactionType.RETURN,
      TransactionType.PRODUCTION_OUTPUT,
      TransactionType.FOUND,
      TransactionType.RESERVATION_RELEASE,
      TransactionType.ALLOCATION_RELEASE,
    ].includes(this.type);
  }

  get isOutgoing(): boolean {
    return [
      TransactionType.ISSUE,
      TransactionType.TRANSFER_OUT,
      TransactionType.ADJUSTMENT_NEGATIVE,
      TransactionType.SALE,
      TransactionType.PRODUCTION_INPUT,
      TransactionType.DAMAGED,
      TransactionType.EXPIRED,
      TransactionType.LOST,
      TransactionType.RESERVATION,
      TransactionType.ALLOCATION,
    ].includes(this.type);
  }

  get isTransfer(): boolean {
    return [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT].includes(this.type);
  }

  get isAdjustment(): boolean {
    return [
      TransactionType.ADJUSTMENT_POSITIVE,
      TransactionType.ADJUSTMENT_NEGATIVE,
    ].includes(this.type);
  }

  get isReservation(): boolean {
    return [
      TransactionType.RESERVATION,
      TransactionType.RESERVATION_RELEASE,
    ].includes(this.type);
  }

  get isAllocation(): boolean {
    return [
      TransactionType.ALLOCATION,
      TransactionType.ALLOCATION_RELEASE,
    ].includes(this.type);
  }

  get netQuantityChange(): number {
    return this.isIncoming ? this.quantity : -this.quantity;
  }

  get canBeCancelled(): boolean {
    return this.status === TransactionStatus.COMPLETED && !this.cancelledAt;
  }

  get isProcessed(): boolean {
    return this.status === TransactionStatus.COMPLETED && !!this.processedAt;
  }

  // Methods
  complete(processedBy?: string): void {
    this.status = TransactionStatus.COMPLETED;
    this.processedAt = new Date();
    this.processedBy = processedBy;
  }

  cancel(cancelledBy?: string, reason?: string): void {
    this.status = TransactionStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.cancelledBy = cancelledBy;
    this.cancellationReason = reason;
  }

  fail(reason?: string): void {
    this.status = TransactionStatus.FAILED;
    this.notes = reason ? `${this.notes || ''}\nFailure reason: ${reason}`.trim() : this.notes;
  }

  addMetadata(key: string, value: any): void {
    this.metadata = { ...this.metadata, [key]: value };
  }

  getMetadata(key: string): any {
    return this.metadata?.[key];
  }

  static createTransferPair(
    productId: string,
    quantity: number,
    sourceLocationId: string,
    destinationLocationId: string,
    tenantId: string,
    createdBy?: string,
    reason?: string,
    referenceType?: string,
    referenceId?: string
  ): [InventoryTransaction, InventoryTransaction] {
    const outTransaction = new InventoryTransaction();
    outTransaction.productId = productId;
    outTransaction.locationId = sourceLocationId;
    outTransaction.destinationLocationId = destinationLocationId;
    outTransaction.type = TransactionType.TRANSFER_OUT;
    outTransaction.quantity = quantity;
    outTransaction.tenantId = tenantId;
    outTransaction.createdBy = createdBy;
    outTransaction.reason = reason;
    outTransaction.referenceType = referenceType;
    outTransaction.referenceId = referenceId;

    const inTransaction = new InventoryTransaction();
    inTransaction.productId = productId;
    inTransaction.locationId = destinationLocationId;
    inTransaction.sourceLocationId = sourceLocationId;
    inTransaction.type = TransactionType.TRANSFER_IN;
    inTransaction.quantity = quantity;
    inTransaction.tenantId = tenantId;
    inTransaction.createdBy = createdBy;
    inTransaction.reason = reason;
    inTransaction.referenceType = referenceType;
    inTransaction.referenceId = referenceId;

    return [outTransaction, inTransaction];
  }
}