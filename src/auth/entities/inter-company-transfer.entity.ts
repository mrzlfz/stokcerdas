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
import { ApprovalInstance } from './approval-instance.entity';

export enum TransferType {
  INVENTORY = 'inventory',
  FINANCIAL = 'financial',
  ASSET = 'asset',
  SERVICE = 'service',
  INTELLECTUAL_PROPERTY = 'intellectual_property',
  EMPLOYEE = 'employee',
  CONTRACT = 'contract',
  OTHER = 'other',
}

export enum TransferStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  FAILED = 'failed',
}

export enum TransferPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum TransferReason {
  OPERATIONAL_NEED = 'operational_need',
  COST_OPTIMIZATION = 'cost_optimization',
  CAPACITY_BALANCING = 'capacity_balancing',
  MAINTENANCE = 'maintenance',
  EMERGENCY = 'emergency',
  STRATEGIC = 'strategic',
  REGULATORY = 'regulatory',
  SEASONAL = 'seasonal',
  PROJECT_ALLOCATION = 'project_allocation',
  RESTRUCTURING = 'restructuring',
  OTHER = 'other',
}

export enum PaymentTerms {
  IMMEDIATE = 'immediate',
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  INTER_COMPANY_ACCOUNT = 'inter_company_account',
  NO_PAYMENT = 'no_payment',
  COST_ALLOCATION = 'cost_allocation',
  SHARED_SERVICE = 'shared_service',
}

@Entity('inter_company_transfers')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'transferNumber'])
@Index(['tenantId', 'fromCompanyId'])
@Index(['tenantId', 'toCompanyId'])
@Index(['tenantId', 'transferType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'transferDate'])
@Index(['status', 'transferDate'])
@Index(['fromCompanyId', 'toCompanyId', 'status'])
export class InterCompanyTransfer extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  // Transfer identification
  @Column({ name: 'transfer_number', length: 50, unique: true })
  transferNumber: string;

  @Column({ name: 'reference_number', length: 100, nullable: true })
  referenceNumber: string;

  @Column({ name: 'external_reference', length: 100, nullable: true })
  externalReference: string;

  // Transfer parties
  @Column({ name: 'from_company_id', type: 'uuid' })
  fromCompanyId: string;

  @ManyToOne(() => Company, { eager: true })
  @JoinColumn({ name: 'from_company_id' })
  fromCompany: Company;

  @Column({ name: 'to_company_id', type: 'uuid' })
  toCompanyId: string;

  @ManyToOne(() => Company, { eager: true })
  @JoinColumn({ name: 'to_company_id' })
  toCompany: Company;

  // Transfer details
  @Column({
    name: 'transfer_type',
    type: 'enum',
    enum: TransferType,
  })
  transferType: TransferType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.DRAFT,
  })
  status: TransferStatus;

  @Column({
    name: 'priority',
    type: 'enum',
    enum: TransferPriority,
    default: TransferPriority.NORMAL,
  })
  priority: TransferPriority;

  @Column({
    name: 'reason',
    type: 'enum',
    enum: TransferReason,
    default: TransferReason.OPERATIONAL_NEED,
  })
  reason: TransferReason;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'business_justification', type: 'text', nullable: true })
  businessJustification: string;

  // Dates and timing
  @Column({ name: 'transfer_date', type: 'date' })
  transferDate: Date;

  @Column({ name: 'requested_date', type: 'date', nullable: true })
  requestedDate: Date;

  @Column({ name: 'approved_date', type: 'timestamp', nullable: true })
  approvedDate: Date;

  @Column({ name: 'shipped_date', type: 'timestamp', nullable: true })
  shippedDate: Date;

  @Column({ name: 'received_date', type: 'timestamp', nullable: true })
  receivedDate: Date;

  @Column({ name: 'completed_date', type: 'timestamp', nullable: true })
  completedDate: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  // Users and responsibilities
  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ name: 'shipped_by_id', type: 'uuid', nullable: true })
  shippedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'shipped_by_id' })
  shippedBy: User;

  @Column({ name: 'received_by_id', type: 'uuid', nullable: true })
  receivedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ name: 'responsible_person_from_id', type: 'uuid', nullable: true })
  responsiblePersonFromId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_person_from_id' })
  responsiblePersonFrom: User;

  @Column({ name: 'responsible_person_to_id', type: 'uuid', nullable: true })
  responsiblePersonToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_person_to_id' })
  responsiblePersonTo: User;

  // Financial information
  @Column({ name: 'total_value', type: 'decimal', precision: 20, scale: 2, nullable: true })
  totalValue: number;

  @Column({ name: 'currency', length: 3, default: 'IDR' })
  currency: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 10, scale: 6, nullable: true })
  exchangeRate: number;

  @Column({ name: 'total_value_base_currency', type: 'decimal', precision: 20, scale: 2, nullable: true })
  totalValueBaseCurrency: number;

  @Column({
    name: 'payment_terms',
    type: 'enum',
    enum: PaymentTerms,
    default: PaymentTerms.INTER_COMPANY_ACCOUNT,
  })
  paymentTerms: PaymentTerms;

  @Column({ name: 'payment_due_date', type: 'date', nullable: true })
  paymentDueDate: Date;

  @Column({ name: 'payment_completed', type: 'boolean', default: false })
  paymentCompleted: boolean;

  @Column({ name: 'payment_reference', length: 100, nullable: true })
  paymentReference: string;

  // Transfer items details
  @Column({ name: 'transfer_items', type: 'jsonb' })
  transferItems: Array<{
    itemType: 'product' | 'asset' | 'service' | 'financial' | 'other';
    itemId?: string;
    itemCode?: string;
    itemName: string;
    itemDescription?: string;
    quantity?: number;
    unitOfMeasure?: string;
    unitPrice?: number;
    totalPrice?: number;
    specifications?: Record<string, any>;
    serialNumbers?: string[];
    batchNumbers?: string[];
    expiryDates?: Date[];
    condition?: 'new' | 'used' | 'refurbished' | 'damaged';
    location?: string;
    notes?: string;
  }>;

  // Shipping and logistics
  @Column({ name: 'shipping_method', length: 100, nullable: true })
  shippingMethod: string;

  @Column({ name: 'shipping_carrier', length: 100, nullable: true })
  shippingCarrier: string;

  @Column({ name: 'tracking_number', length: 100, nullable: true })
  trackingNumber: string;

  @Column({ name: 'shipping_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingCost: number;

  @Column({ name: 'insurance_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  insuranceCost: number;

  @Column({ name: 'estimated_delivery_date', type: 'date', nullable: true })
  estimatedDeliveryDate: Date;

  @Column({ name: 'actual_delivery_date', type: 'date', nullable: true })
  actualDeliveryDate: Date;

  // Source and destination locations
  @Column({ name: 'from_location', type: 'jsonb', nullable: true })
  fromLocation: {
    warehouseId?: string;
    warehouseName?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    contactPerson?: string;
    contactPhone?: string;
  };

  @Column({ name: 'to_location', type: 'jsonb', nullable: true })
  toLocation: {
    warehouseId?: string;
    warehouseName?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    contactPerson?: string;
    contactPhone?: string;
  };

  // Quality and inspection
  @Column({ name: 'requires_inspection', type: 'boolean', default: false })
  requiresInspection: boolean;

  @Column({ name: 'inspection_completed', type: 'boolean', default: false })
  inspectionCompleted: boolean;

  @Column({ name: 'inspection_date', type: 'timestamp', nullable: true })
  inspectionDate: Date;

  @Column({ name: 'inspection_notes', type: 'text', nullable: true })
  inspectionNotes: string;

  @Column({ name: 'quality_rating', type: 'varchar', length: 20, nullable: true })
  qualityRating: 'excellent' | 'good' | 'acceptable' | 'poor' | 'rejected';

  // Documentation
  @Column({ name: 'required_documents', type: 'simple-array', nullable: true })
  requiredDocuments: string[];

  @Column({ name: 'attached_documents', type: 'simple-array', nullable: true })
  attachedDocuments: string[];

  @Column({ name: 'delivery_receipt_url', type: 'text', nullable: true })
  deliveryReceiptUrl: string;

  @Column({ name: 'invoice_number', length: 100, nullable: true })
  invoiceNumber: string;

  @Column({ name: 'packing_list_url', type: 'text', nullable: true })
  packingListUrl: string;

  // Approval workflow
  @Column({ name: 'requires_approval', type: 'boolean', default: true })
  requiresApproval: boolean;

  @Column({ name: 'approval_instance_id', type: 'uuid', nullable: true })
  approvalInstanceId: string;

  @ManyToOne(() => ApprovalInstance, { nullable: true })
  @JoinColumn({ name: 'approval_instance_id' })
  approvalInstance: ApprovalInstance;

  @Column({ name: 'approval_notes', type: 'text', nullable: true })
  approvalNotes: string;

  // Compliance and regulations
  @Column({ name: 'regulatory_compliance', type: 'jsonb', nullable: true })
  regulatoryCompliance: {
    requiredLicenses?: string[];
    exportPermits?: string[];
    importPermits?: string[];
    taxCompliance?: boolean;
    customsDeclaration?: string;
    complianceNotes?: string;
  };

  // Performance tracking
  @Column({ name: 'processing_time_hours', type: 'decimal', precision: 10, scale: 2, nullable: true })
  processingTimeHours: number;

  @Column({ name: 'delivery_time_hours', type: 'decimal', precision: 10, scale: 2, nullable: true })
  deliveryTimeHours: number;

  @Column({ name: 'is_on_time', type: 'boolean', nullable: true })
  isOnTime: boolean;

  @Column({ name: 'delay_reason', type: 'text', nullable: true })
  delayReason: string;

  // Cost tracking
  @Column({ name: 'cost_breakdown', type: 'jsonb', nullable: true })
  costBreakdown: {
    itemsCost?: number;
    shippingCost?: number;
    insuranceCost?: number;
    handlingCost?: number;
    documentationCost?: number;
    customsCost?: number;
    taxesCost?: number;
    otherCosts?: number;
    totalCost?: number;
  };

  // Risk and insurance
  @Column({ name: 'risk_assessment', type: 'jsonb', nullable: true })
  riskAssessment: {
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    riskFactors?: string[];
    mitigationMeasures?: string[];
    insuranceRequired?: boolean;
    insuranceCoverage?: number;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };

  // Communication and notifications
  @Column({ name: 'notification_settings', type: 'jsonb', nullable: true })
  notificationSettings: {
    notifyOnStatusChange?: boolean;
    notifyOnDelay?: boolean;
    notifyOnCompletion?: boolean;
    emailNotifications?: string[];
    smsNotifications?: string[];
    pushNotifications?: boolean;
  };

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
    return ![
      TransferStatus.COMPLETED,
      TransferStatus.CANCELLED,
      TransferStatus.REJECTED,
      TransferStatus.FAILED,
    ].includes(this.status);
  }

  isPending(): boolean {
    return [
      TransferStatus.DRAFT,
      TransferStatus.PENDING_APPROVAL,
      TransferStatus.APPROVED,
      TransferStatus.IN_TRANSIT,
    ].includes(this.status);
  }

  isCompleted(): boolean {
    return this.status === TransferStatus.COMPLETED;
  }

  canBeModified(): boolean {
    return [TransferStatus.DRAFT, TransferStatus.PENDING_APPROVAL].includes(this.status);
  }

  canBeApproved(): boolean {
    return this.status === TransferStatus.PENDING_APPROVAL;
  }

  canBeShipped(): boolean {
    return this.status === TransferStatus.APPROVED;
  }

  canBeReceived(): boolean {
    return this.status === TransferStatus.IN_TRANSIT;
  }

  isOverdue(): boolean {
    if (!this.dueDate) return false;
    return new Date() > this.dueDate && this.isPending();
  }

  isHighPriority(): boolean {
    return [TransferPriority.HIGH, TransferPriority.URGENT, TransferPriority.CRITICAL].includes(this.priority);
  }

  calculateTotalValue(): number {
    if (!this.transferItems) return 0;
    return this.transferItems.reduce((total, item) => {
      return total + (item.totalPrice || 0);
    }, 0);
  }

  updateTotalValue(): void {
    this.totalValue = this.calculateTotalValue();
    if (this.exchangeRate && this.exchangeRate !== 1) {
      this.totalValueBaseCurrency = this.totalValue * this.exchangeRate;
    } else {
      this.totalValueBaseCurrency = this.totalValue;
    }
  }

  calculateProcessingTime(): void {
    if (this.createdAt && this.completedDate) {
      const diffMs = this.completedDate.getTime() - this.createdAt.getTime();
      this.processingTimeHours = diffMs / (1000 * 60 * 60);
    }
  }

  calculateDeliveryTime(): void {
    if (this.shippedDate && this.actualDeliveryDate) {
      const diffMs = this.actualDeliveryDate.getTime() - this.shippedDate.getTime();
      this.deliveryTimeHours = diffMs / (1000 * 60 * 60);
    }
  }

  checkOnTimeDelivery(): void {
    if (this.dueDate && this.actualDeliveryDate) {
      this.isOnTime = this.actualDeliveryDate <= this.dueDate;
    } else if (this.estimatedDeliveryDate && this.actualDeliveryDate) {
      this.isOnTime = this.actualDeliveryDate <= this.estimatedDeliveryDate;
    }
  }

  addTransferItem(item: InterCompanyTransfer['transferItems'][0]): void {
    if (!this.transferItems) {
      this.transferItems = [];
    }
    this.transferItems.push(item);
    this.updateTotalValue();
  }

  removeTransferItem(index: number): void {
    if (this.transferItems && index >= 0 && index < this.transferItems.length) {
      this.transferItems.splice(index, 1);
      this.updateTotalValue();
    }
  }

  updateTransferItem(index: number, item: Partial<InterCompanyTransfer['transferItems'][0]>): void {
    if (this.transferItems && index >= 0 && index < this.transferItems.length) {
      this.transferItems[index] = { ...this.transferItems[index], ...item };
      this.updateTotalValue();
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

  addDocument(documentUrl: string): void {
    if (!this.attachedDocuments) {
      this.attachedDocuments = [];
    }
    if (!this.attachedDocuments.includes(documentUrl)) {
      this.attachedDocuments.push(documentUrl);
    }
  }

  removeDocument(documentUrl: string): void {
    if (this.attachedDocuments) {
      this.attachedDocuments = this.attachedDocuments.filter(doc => doc !== documentUrl);
    }
  }

  // Status transition methods
  submitForApproval(): void {
    if (this.status === TransferStatus.DRAFT) {
      this.status = TransferStatus.PENDING_APPROVAL;
      this.addCustomField('submitted_at', new Date());
    }
  }

  approve(approvedBy: string, notes?: string): void {
    if (this.status === TransferStatus.PENDING_APPROVAL) {
      this.status = TransferStatus.APPROVED;
      this.approvedById = approvedBy;
      this.approvedDate = new Date();
      if (notes) {
        this.approvalNotes = notes;
      }
    }
  }

  reject(rejectedBy: string, reason: string): void {
    if (this.status === TransferStatus.PENDING_APPROVAL) {
      this.status = TransferStatus.REJECTED;
      this.addCustomField('rejected_by', rejectedBy);
      this.addCustomField('rejected_at', new Date());
      this.addCustomField('rejection_reason', reason);
    }
  }

  ship(shippedBy: string, trackingNumber?: string): void {
    if (this.status === TransferStatus.APPROVED) {
      this.status = TransferStatus.IN_TRANSIT;
      this.shippedById = shippedBy;
      this.shippedDate = new Date();
      if (trackingNumber) {
        this.trackingNumber = trackingNumber;
      }
    }
  }

  receive(receivedBy: string, qualityRating?: InterCompanyTransfer['qualityRating']): void {
    if (this.status === TransferStatus.IN_TRANSIT) {
      this.status = TransferStatus.RECEIVED;
      this.receivedById = receivedBy;
      this.receivedDate = new Date();
      this.actualDeliveryDate = new Date();
      if (qualityRating) {
        this.qualityRating = qualityRating;
      }
      this.calculateDeliveryTime();
      this.checkOnTimeDelivery();
    }
  }

  complete(completedBy?: string): void {
    if (this.status === TransferStatus.RECEIVED) {
      this.status = TransferStatus.COMPLETED;
      this.completedDate = new Date();
      if (completedBy) {
        this.addCustomField('completed_by', completedBy);
      }
      this.calculateProcessingTime();
    }
  }

  cancel(cancelledBy: string, reason: string): void {
    if (this.canBeModified()) {
      this.status = TransferStatus.CANCELLED;
      this.addCustomField('cancelled_by', cancelledBy);
      this.addCustomField('cancelled_at', new Date());
      this.addCustomField('cancellation_reason', reason);
    }
  }

  markAsFailed(failureReason: string): void {
    this.status = TransferStatus.FAILED;
    this.addCustomField('failed_at', new Date());
    this.addCustomField('failure_reason', failureReason);
  }

  returnToSender(returnReason: string): void {
    if (this.status === TransferStatus.IN_TRANSIT || this.status === TransferStatus.RECEIVED) {
      this.status = TransferStatus.RETURNED;
      this.addCustomField('returned_at', new Date());
      this.addCustomField('return_reason', returnReason);
    }
  }

  getStatusDisplayName(): string {
    const statusMap = {
      [TransferStatus.DRAFT]: 'Draft',
      [TransferStatus.PENDING_APPROVAL]: 'Menunggu Persetujuan',
      [TransferStatus.APPROVED]: 'Disetujui',
      [TransferStatus.IN_TRANSIT]: 'Dalam Perjalanan',
      [TransferStatus.RECEIVED]: 'Diterima',
      [TransferStatus.COMPLETED]: 'Selesai',
      [TransferStatus.REJECTED]: 'Ditolak',
      [TransferStatus.CANCELLED]: 'Dibatalkan',
      [TransferStatus.RETURNED]: 'Dikembalikan',
      [TransferStatus.FAILED]: 'Gagal',
    };
    return statusMap[this.status] || this.status;
  }

  validateTransfer(): boolean {
    // Basic validation
    if (!this.fromCompanyId || !this.toCompanyId) return false;
    if (this.fromCompanyId === this.toCompanyId) return false;
    if (!this.transferItems || this.transferItems.length === 0) return false;
    if (!this.transferDate) return false;
    
    // Financial validation
    if (this.totalValue && this.totalValue <= 0) return false;
    
    // Item validation
    for (const item of this.transferItems) {
      if (!item.itemName) return false;
      if (item.quantity && item.quantity <= 0) return false;
    }
    
    return true;
  }
}