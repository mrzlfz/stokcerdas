import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Company } from './company.entity';
import { User } from '../../users/entities/user.entity';

export enum RelationshipType {
  PARENT_SUBSIDIARY = 'parent_subsidiary',
  JOINT_VENTURE = 'joint_venture',
  SISTER_COMPANY = 'sister_company',
  PARTNER = 'partner',
  SUPPLIER = 'supplier',
  CUSTOMER = 'customer',
  DISTRIBUTOR = 'distributor',
  FRANCHISE = 'franchise',
  LICENSING = 'licensing',
  MERGER = 'merger',
  ACQUISITION = 'acquisition',
  STRATEGIC_ALLIANCE = 'strategic_alliance',
  CONSORTIUM = 'consortium',
  OTHER = 'other',
}

export enum RelationshipStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_APPROVAL = 'pending_approval',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  UNDER_REVIEW = 'under_review',
}

export enum TradingTerms {
  CASH_ON_DELIVERY = 'cash_on_delivery',
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  LETTER_OF_CREDIT = 'letter_of_credit',
  ADVANCE_PAYMENT = 'advance_payment',
  CONSIGNMENT = 'consignment',
  CUSTOM = 'custom',
}

@Entity('company_relationships')
@Unique('unique_relationship', [
  'tenantId',
  'fromCompanyId',
  'toCompanyId',
  'relationshipType',
])
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'fromCompanyId'])
@Index(['tenantId', 'toCompanyId'])
@Index(['tenantId', 'relationshipType'])
@Index(['tenantId', 'status'])
@Index(['status', 'isActive'])
export class CompanyRelationship extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  // Relationship participants
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

  // Relationship details
  @Column({
    name: 'relationship_type',
    type: 'enum',
    enum: RelationshipType,
  })
  relationshipType: RelationshipType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RelationshipStatus,
    default: RelationshipStatus.ACTIVE,
  })
  status: RelationshipStatus;

  @Column({ name: 'relationship_name', length: 200, nullable: true })
  relationshipName: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  // Ownership and control
  @Column({
    name: 'ownership_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  ownershipPercentage: number; // For parent-subsidiary relationships

  @Column({
    name: 'voting_rights_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  votingRightsPercentage: number;

  @Column({ name: 'is_controlling_interest', type: 'boolean', default: false })
  isControllingInterest: boolean;

  @Column({ name: 'board_representation', type: 'integer', nullable: true })
  boardRepresentation: number; // Number of board seats

  // Legal and regulatory
  @Column({ name: 'legal_structure', length: 100, nullable: true })
  legalStructure: string;

  @Column({
    name: 'regulatory_approval_required',
    type: 'boolean',
    default: false,
  })
  regulatoryApprovalRequired: boolean;

  @Column({ name: 'regulatory_approval_status', length: 50, nullable: true })
  regulatoryApprovalStatus: string;

  @Column({ name: 'contract_reference', length: 100, nullable: true })
  contractReference: string;

  @Column({ name: 'legal_agreement_date', type: 'date', nullable: true })
  legalAgreementDate: Date;

  @Column({ name: 'contract_expiry_date', type: 'date', nullable: true })
  contractExpiryDate: Date;

  // Financial arrangements
  @Column({
    name: 'trading_terms',
    type: 'enum',
    enum: TradingTerms,
    nullable: true,
  })
  tradingTerms: TradingTerms;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  creditLimit: number;

  @Column({ name: 'payment_terms_days', type: 'integer', nullable: true })
  paymentTermsDays: number;

  @Column({ name: 'currency', length: 3, default: 'IDR' })
  currency: string;

  @Column({ name: 'settlement_terms', type: 'text', nullable: true })
  settlementTerms: string;

  // Operational settings
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'allows_inter_company_transfers',
    type: 'boolean',
    default: true,
  })
  allowsInterCompanyTransfers: boolean;

  @Column({
    name: 'requires_approval_for_transfers',
    type: 'boolean',
    default: true,
  })
  requiresApprovalForTransfers: boolean;

  @Column({
    name: 'auto_approve_transfers_under',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  autoApproveTransfersUnder: number;

  @Column({ name: 'consolidated_reporting', type: 'boolean', default: false })
  consolidatedReporting: boolean;

  @Column({ name: 'shared_services', type: 'simple-array', nullable: true })
  sharedServices: string[]; // IT, HR, Finance, etc.

  // Communication and contacts
  @Column({ name: 'primary_contact_from_id', type: 'uuid', nullable: true })
  primaryContactFromId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'primary_contact_from_id' })
  primaryContactFrom: User;

  @Column({ name: 'primary_contact_to_id', type: 'uuid', nullable: true })
  primaryContactToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'primary_contact_to_id' })
  primaryContactTo: User;

  @Column({ name: 'relationship_manager_id', type: 'uuid', nullable: true })
  relationshipManagerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'relationship_manager_id' })
  relationshipManager: User;

  // Validity period
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'effective_until', type: 'date', nullable: true })
  effectiveUntil: Date;

  @Column({ name: 'auto_renew', type: 'boolean', default: false })
  autoRenew: boolean;

  @Column({ name: 'renewal_period_months', type: 'integer', nullable: true })
  renewalPeriodMonths: number;

  @Column({ name: 'notice_period_days', type: 'integer', default: 30 })
  noticePeriodDays: number;

  // Performance tracking
  @Column({
    name: 'transaction_volume',
    type: 'decimal',
    precision: 20,
    scale: 2,
    default: 0,
  })
  transactionVolume: number;

  @Column({ name: 'transaction_count', type: 'integer', default: 0 })
  transactionCount: number;

  @Column({ name: 'last_transaction_date', type: 'timestamp', nullable: true })
  lastTransactionDate: Date;

  @Column({
    name: 'relationship_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  relationshipScore: number; // 0.0 to 5.0

  @Column({
    name: 'performance_rating',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  performanceRating:
    | 'excellent'
    | 'good'
    | 'satisfactory'
    | 'poor'
    | 'critical';

  // Risk management
  @Column({
    name: 'risk_level',
    type: 'varchar',
    length: 20,
    default: 'medium',
  })
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  @Column({ name: 'risk_factors', type: 'simple-array', nullable: true })
  riskFactors: string[];

  @Column({
    name: 'compliance_status',
    type: 'varchar',
    length: 50,
    default: 'compliant',
  })
  complianceStatus: string;

  @Column({ name: 'last_compliance_check', type: 'date', nullable: true })
  lastComplianceCheck: Date;

  @Column({ name: 'next_review_date', type: 'date', nullable: true })
  nextReviewDate: Date;

  // Business terms and conditions
  @Column({ name: 'business_terms', type: 'jsonb', nullable: true })
  businessTerms: {
    minimumOrderValue?: number;
    maximumOrderValue?: number;
    preferredCurrency?: string;
    discountTerms?: string;
    penaltyTerms?: string;
    escalationProcedure?: string;
    disputeResolution?: string;
    governingLaw?: string;
    jurisdiction?: string;
  };

  // Integration settings
  @Column({ name: 'integration_settings', type: 'jsonb', nullable: true })
  integrationSettings: {
    ediEnabled?: boolean;
    apiIntegration?: boolean;
    dataExchangeFormat?: string;
    syncFrequency?: string;
    lastSyncDate?: Date;
    errorLog?: Array<{
      date: Date;
      error: string;
      resolved: boolean;
    }>;
  };

  // Workflow and approval settings
  @Column({ name: 'approval_workflow_id', type: 'uuid', nullable: true })
  approvalWorkflowId: string;

  @Column({ name: 'notification_settings', type: 'jsonb', nullable: true })
  notificationSettings: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
    notifyOnTransactions?: boolean;
    notifyOnStatusChange?: boolean;
    notifyOnExpiry?: boolean;
    reminderDaysBefore?: number;
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
  getIsActive(): boolean {
    return this.status === RelationshipStatus.ACTIVE && this.isActive;
  }

  isParentSubsidiary(): boolean {
    return this.relationshipType === RelationshipType.PARENT_SUBSIDIARY;
  }

  isBusinessPartnership(): boolean {
    return [
      RelationshipType.JOINT_VENTURE,
      RelationshipType.PARTNER,
      RelationshipType.STRATEGIC_ALLIANCE,
    ].includes(this.relationshipType);
  }

  isTradingRelationship(): boolean {
    return [
      RelationshipType.SUPPLIER,
      RelationshipType.CUSTOMER,
      RelationshipType.DISTRIBUTOR,
    ].includes(this.relationshipType);
  }

  hasControllingInterest(): boolean {
    return (
      this.isControllingInterest ||
      (this.ownershipPercentage && this.ownershipPercentage > 50)
    );
  }

  isExpired(): boolean {
    if (!this.effectiveUntil) return false;
    return new Date() > this.effectiveUntil;
  }

  isExpiringSoon(daysAhead: number = 30): boolean {
    if (!this.effectiveUntil) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + daysAhead);
    return this.effectiveUntil <= warningDate;
  }

  canTransfer(): boolean {
    return this.getIsActive() && this.allowsInterCompanyTransfers;
  }

  requiresTransferApproval(amount?: number): boolean {
    if (!this.requiresApprovalForTransfers) return false;
    if (
      amount &&
      this.autoApproveTransfersUnder &&
      amount < this.autoApproveTransfersUnder
    ) {
      return false;
    }
    return true;
  }

  isWithinCreditLimit(amount: number): boolean {
    if (!this.creditLimit) return true;
    return amount <= this.creditLimit;
  }

  calculateRelationshipHealth(): number {
    let score = 0;
    let factors = 0;

    // Status factor
    if (this.status === RelationshipStatus.ACTIVE) {
      score += 20;
    }
    factors += 20;

    // Transaction activity factor
    if (this.lastTransactionDate) {
      const daysSinceLastTransaction = Math.floor(
        (new Date().getTime() - this.lastTransactionDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastTransaction <= 30) {
        score += 20;
      } else if (daysSinceLastTransaction <= 90) {
        score += 15;
      } else if (daysSinceLastTransaction <= 180) {
        score += 10;
      }
    }
    factors += 20;

    // Compliance factor
    if (this.complianceStatus === 'compliant') {
      score += 20;
    } else if (this.complianceStatus === 'minor_issues') {
      score += 10;
    }
    factors += 20;

    // Risk factor
    switch (this.riskLevel) {
      case 'low':
        score += 20;
        break;
      case 'medium':
        score += 15;
        break;
      case 'high':
        score += 10;
        break;
      case 'critical':
        score += 0;
        break;
    }
    factors += 20;

    // Performance rating factor
    switch (this.performanceRating) {
      case 'excellent':
        score += 20;
        break;
      case 'good':
        score += 15;
        break;
      case 'satisfactory':
        score += 10;
        break;
      case 'poor':
        score += 5;
        break;
      case 'critical':
        score += 0;
        break;
    }
    factors += 20;

    return Math.round((score / factors) * 100);
  }

  updatePerformanceMetrics(transactionAmount: number): void {
    this.transactionVolume += transactionAmount;
    this.transactionCount += 1;
    this.lastTransactionDate = new Date();
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

  addRiskFactor(factor: string): void {
    if (!this.riskFactors) {
      this.riskFactors = [];
    }
    if (!this.riskFactors.includes(factor)) {
      this.riskFactors.push(factor);
    }
  }

  removeRiskFactor(factor: string): void {
    if (this.riskFactors) {
      this.riskFactors = this.riskFactors.filter(f => f !== factor);
    }
  }

  activate(): void {
    this.status = RelationshipStatus.ACTIVE;
    this.isActive = true;
  }

  deactivate(): void {
    this.status = RelationshipStatus.INACTIVE;
    this.isActive = false;
  }

  suspend(reason?: string): void {
    this.status = RelationshipStatus.SUSPENDED;
    this.isActive = false;
    if (reason) {
      this.addCustomField('suspension_reason', reason);
      this.addCustomField('suspended_at', new Date());
    }
  }

  terminate(reason?: string): void {
    this.status = RelationshipStatus.TERMINATED;
    this.isActive = false;
    if (reason) {
      this.addCustomField('termination_reason', reason);
      this.addCustomField('terminated_at', new Date());
    }
  }

  renew(months?: number): void {
    if (this.effectiveUntil && this.autoRenew) {
      const renewalMonths = months || this.renewalPeriodMonths || 12;
      this.effectiveUntil = new Date(
        this.effectiveUntil.getFullYear(),
        this.effectiveUntil.getMonth() + renewalMonths,
        this.effectiveUntil.getDate(),
      );
      this.addCustomField('last_renewal_date', new Date());
    }
  }

  validateBusinessTerms(): boolean {
    if (!this.businessTerms) return true;

    const { minimumOrderValue, maximumOrderValue } = this.businessTerms;
    if (
      minimumOrderValue &&
      maximumOrderValue &&
      minimumOrderValue > maximumOrderValue
    ) {
      return false;
    }

    return true;
  }

  getRelationshipSummary(): string {
    const fromName = this.fromCompany.name;
    const toName = this.toCompany.name;
    const type = this.relationshipType.replace('_', ' ').toLowerCase();

    return `${fromName} has ${type} relationship with ${toName}`;
  }

  isValidForDate(date: Date): boolean {
    if (date < this.effectiveFrom) return false;
    if (this.effectiveUntil && date > this.effectiveUntil) return false;
    return true;
  }

  scheduleReview(daysFromNow: number): void {
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + daysFromNow);
    this.nextReviewDate = reviewDate;
  }

  updateComplianceStatus(status: string, checkDate?: Date): void {
    this.complianceStatus = status;
    this.lastComplianceCheck = checkDate || new Date();
  }

  setRiskLevel(
    level: CompanyRelationship['riskLevel'],
    factors?: string[],
  ): void {
    this.riskLevel = level;
    if (factors) {
      this.riskFactors = factors;
    }
  }
}
