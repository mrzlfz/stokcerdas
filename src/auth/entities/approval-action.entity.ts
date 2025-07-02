import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/auditable.entity';
import { ApprovalInstance } from './approval-instance.entity';
import { ApprovalStep } from './approval-step.entity';
import { User } from '../../users/entities/user.entity';

export enum ApprovalActionType {
  APPROVE = 'approve',
  REJECT = 'reject',
  DELEGATE = 'delegate',
  ESCALATE = 'escalate',
  REQUEST_INFO = 'request_info',
  PROVIDE_INFO = 'provide_info',
  COMMENT = 'comment',
  REASSIGN = 'reassign',
  WITHDRAW = 'withdraw',
  CANCEL = 'cancel',
  HOLD = 'hold',
  RESUME = 'resume',
  REMIND = 'remind',
  VIEW = 'view',
  DOWNLOAD = 'download',
}

export enum ApprovalDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
  CONDITIONAL = 'conditional',
  DEFERRED = 'deferred',
}

export enum ActionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUPERSEDED = 'superseded',
}

export enum DelegationType {
  TEMPORARY = 'temporary',
  PERMANENT = 'permanent',
  VACATION = 'vacation',
  EMERGENCY = 'emergency',
  EXPERTISE = 'expertise',
}

@Entity('approval_actions')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'instanceId'])
@Index(['tenantId', 'actorId'])
@Index(['tenantId', 'actionType'])
@Index(['tenantId', 'decision'])
@Index(['tenantId', 'actionDate'])
@Index(['instanceId', 'stepId'])
@Index(['actionType', 'actionDate'])
export class ApprovalAction extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ name: 'instance_id', type: 'uuid' })
  instanceId: string;

  @ManyToOne(() => ApprovalInstance, instance => instance.actions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'instance_id' })
  instance: ApprovalInstance;

  @Column({ name: 'step_id', type: 'uuid' })
  stepId: string;

  @ManyToOne(() => ApprovalStep, { eager: true })
  @JoinColumn({ name: 'step_id' })
  step: ApprovalStep;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: ApprovalActionType,
  })
  actionType: ApprovalActionType;

  @Column({
    name: 'decision',
    type: 'enum',
    enum: ApprovalDecision,
    nullable: true,
  })
  decision: ApprovalDecision;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ActionStatus,
    default: ActionStatus.ACTIVE,
  })
  status: ActionStatus;

  @Column({ name: 'action_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  actionDate: Date;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments: string;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

  @Column({ name: 'is_system_action', type: 'boolean', default: false })
  isSystemAction: boolean;

  @Column({ name: 'is_automated', type: 'boolean', default: false })
  isAutomated: boolean;

  // Delegation specific fields
  @Column({ name: 'delegated_to_id', type: 'uuid', nullable: true })
  delegatedToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'delegated_to_id' })
  delegatedTo: User;

  @Column({
    name: 'delegation_type',
    type: 'enum',
    enum: DelegationType,
    nullable: true,
  })
  delegationType: DelegationType;

  @Column({ name: 'delegation_start_date', type: 'timestamp', nullable: true })
  delegationStartDate: Date;

  @Column({ name: 'delegation_end_date', type: 'timestamp', nullable: true })
  delegationEndDate: Date;

  @Column({ name: 'delegation_reason', type: 'text', nullable: true })
  delegationReason: string;

  // Escalation specific fields
  @Column({ name: 'escalated_to_id', type: 'uuid', nullable: true })
  escalatedToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'escalated_to_id' })
  escalatedTo: User;

  @Column({ name: 'escalation_reason', type: 'text', nullable: true })
  escalationReason: string;

  @Column({ name: 'escalation_level', type: 'integer', nullable: true })
  escalationLevel: number;

  // Timing and performance
  @Column({ name: 'processing_time_minutes', type: 'integer', nullable: true })
  processingTimeMinutes: number;

  @Column({ name: 'decision_deadline', type: 'timestamp', nullable: true })
  decisionDeadline: Date;

  @Column({ name: 'is_overdue', type: 'boolean', default: false })
  isOverdue: boolean;

  @Column({ name: 'overdue_by_hours', type: 'integer', nullable: true })
  overdueByHours: number;

  // Context and metadata
  @Column({ name: 'client_ip', type: 'inet', nullable: true })
  clientIp: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'location', type: 'varchar', length: 100, nullable: true })
  location: string;

  @Column({ name: 'device_type', type: 'varchar', length: 50, nullable: true })
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'api' | 'system';

  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId: string;

  // Business context
  @Column({ name: 'business_justification', type: 'text', nullable: true })
  businessJustification: string;

  @Column({ name: 'risk_assessment', type: 'text', nullable: true })
  riskAssessment: string;

  @Column({ name: 'compliance_notes', type: 'text', nullable: true })
  complianceNotes: string;

  @Column({ name: 'financial_impact_notes', type: 'text', nullable: true })
  financialImpactNotes: string;

  // Conditions and requirements
  @Column({ name: 'conditions', type: 'jsonb', nullable: true })
  conditions: {
    approvalConditions?: string[];
    expiryDate?: Date;
    reviewDate?: Date;
    specialRequirements?: string[];
    followUpActions?: string[];
    notificationRequired?: boolean;
    documentationRequired?: boolean;
  };

  // Attachments and evidence
  @Column({ name: 'attachments', type: 'simple-array', nullable: true })
  attachments: string[];

  @Column({ name: 'supporting_documents', type: 'simple-array', nullable: true })
  supportingDocuments: string[];

  @Column({ name: 'digital_signature', type: 'text', nullable: true })
  digitalSignature: string;

  @Column({ name: 'signature_timestamp', type: 'timestamp', nullable: true })
  signatureTimestamp: Date;

  // Approval hierarchy
  @Column({ name: 'approval_authority_level', type: 'integer', nullable: true })
  approvalAuthorityLevel: number;

  @Column({ name: 'approval_limit', type: 'decimal', precision: 15, scale: 2, nullable: true })
  approvalLimit: number;

  @Column({ name: 'exceeds_authority', type: 'boolean', default: false })
  exceedsAuthority: boolean;

  @Column({ name: 'authority_override_reason', type: 'text', nullable: true })
  authorityOverrideReason: string;

  // Communication and notifications
  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent: boolean;

  @Column({ name: 'notification_sent_at', type: 'timestamp', nullable: true })
  notificationSentAt: Date;

  @Column({ name: 'acknowledgment_required', type: 'boolean', default: false })
  acknowledgmentRequired: boolean;

  @Column({ name: 'acknowledgment_received', type: 'boolean', default: false })
  acknowledgmentReceived: boolean;

  @Column({ name: 'acknowledgment_date', type: 'timestamp', nullable: true })
  acknowledgmentDate: Date;

  // Quality and feedback
  @Column({ name: 'confidence_level', type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidenceLevel: number; // 0.0 to 1.0

  @Column({ name: 'quality_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  qualityScore: number; // 0.0 to 1.0

  @Column({ name: 'reviewer_feedback', type: 'text', nullable: true })
  reviewerFeedback: string;

  @Column({ name: 'improvement_suggestions', type: 'text', nullable: true })
  improvementSuggestions: string;

  // Workflow state
  @Column({ name: 'previous_action_id', type: 'uuid', nullable: true })
  previousActionId: string;

  @Column({ name: 'next_action_id', type: 'uuid', nullable: true })
  nextActionId: string;

  @Column({ name: 'related_actions', type: 'simple-array', nullable: true })
  relatedActions: string[];

  @Column({ name: 'action_sequence', type: 'integer', nullable: true })
  actionSequence: number;

  // Security and compliance
  @Column({ name: 'requires_dual_approval', type: 'boolean', default: false })
  requiresDualApproval: boolean;

  @Column({ name: 'dual_approver_id', type: 'uuid', nullable: true })
  dualApproverId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'dual_approver_id' })
  dualApprover: User;

  @Column({ name: 'dual_approval_received', type: 'boolean', default: false })
  dualApprovalReceived: boolean;

  @Column({ name: 'audit_required', type: 'boolean', default: false })
  auditRequired: boolean;

  @Column({ name: 'audit_completed', type: 'boolean', default: false })
  auditCompleted: boolean;

  @Column({ name: 'audit_notes', type: 'text', nullable: true })
  auditNotes: string;

  // Custom fields and metadata
  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  // Helper methods
  calculateProcessingTime(startTime: Date): void {
    const diffMs = this.actionDate.getTime() - startTime.getTime();
    this.processingTimeMinutes = Math.floor(diffMs / (1000 * 60));
  }

  checkOverdue(): void {
    if (this.decisionDeadline) {
      const now = new Date();
      this.isOverdue = now > this.decisionDeadline;
      if (this.isOverdue) {
        const diffMs = now.getTime() - this.decisionDeadline.getTime();
        this.overdueByHours = Math.floor(diffMs / (1000 * 60 * 60));
      }
    }
  }

  isApprovalAction(): boolean {
    return [ApprovalActionType.APPROVE, ApprovalActionType.REJECT].includes(this.actionType);
  }

  isDelegationAction(): boolean {
    return this.actionType === ApprovalActionType.DELEGATE;
  }

  isEscalationAction(): boolean {
    return this.actionType === ApprovalActionType.ESCALATE;
  }

  isSystemAction(): boolean {
    return this.isSystemAction || this.isAutomated;
  }

  requiresFollowUp(): boolean {
    return Boolean(this.conditions?.followUpActions?.length);
  }

  hasConditions(): boolean {
    return Boolean(this.conditions && Object.keys(this.conditions).length);
  }

  isConditionalApproval(): boolean {
    return this.decision === ApprovalDecision.CONDITIONAL;
  }

  isDeferredDecision(): boolean {
    return this.decision === ApprovalDecision.DEFERRED;
  }

  hasAttachments(): boolean {
    return Boolean(this.attachments?.length || this.supportingDocuments?.length);
  }

  isDigitallySigned(): boolean {
    return Boolean(this.digitalSignature && this.signatureTimestamp);
  }

  addAttachment(filename: string): void {
    if (!this.attachments) {
      this.attachments = [];
    }
    if (!this.attachments.includes(filename)) {
      this.attachments.push(filename);
    }
  }

  addSupportingDocument(documentId: string): void {
    if (!this.supportingDocuments) {
      this.supportingDocuments = [];
    }
    if (!this.supportingDocuments.includes(documentId)) {
      this.supportingDocuments.push(documentId);
    }
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

  setCustomField(key: string, value: any): void {
    if (!this.customFields) {
      this.customFields = {};
    }
    this.customFields[key] = value;
  }

  getCustomField(key: string, defaultValue: any = null): any {
    return this.customFields?.[key] || defaultValue;
  }

  addCondition(type: keyof ApprovalAction['conditions'], value: any): void {
    if (!this.conditions) {
      this.conditions = {};
    }
    this.conditions[type] = value;
  }

  addFollowUpAction(action: string): void {
    if (!this.conditions) {
      this.conditions = {};
    }
    if (!this.conditions.followUpActions) {
      this.conditions.followUpActions = [];
    }
    if (!this.conditions.followUpActions.includes(action)) {
      this.conditions.followUpActions.push(action);
    }
  }

  markNotificationSent(): void {
    this.notificationSent = true;
    this.notificationSentAt = new Date();
  }

  acknowledgeAction(): void {
    this.acknowledgmentReceived = true;
    this.acknowledgmentDate = new Date();
  }

  addDualApproval(approverId: string): void {
    this.dualApproverId = approverId;
    this.dualApprovalReceived = true;
  }

  supersede(reason: string): void {
    this.status = ActionStatus.SUPERSEDED;
    this.setCustomField('superseded_reason', reason);
    this.setCustomField('superseded_at', new Date());
  }

  cancel(reason: string): void {
    this.status = ActionStatus.CANCELLED;
    this.setCustomField('cancellation_reason', reason);
    this.setCustomField('cancelled_at', new Date());
  }

  complete(): void {
    this.status = ActionStatus.COMPLETED;
    this.setCustomField('completed_at', new Date());
  }

  setQualityScore(score: number, feedback?: string): void {
    this.qualityScore = Math.max(0, Math.min(1, score));
    if (feedback) {
      this.reviewerFeedback = feedback;
    }
  }

  setConfidenceLevel(level: number): void {
    this.confidenceLevel = Math.max(0, Math.min(1, level));
  }

  addDigitalSignature(signature: string): void {
    this.digitalSignature = signature;
    this.signatureTimestamp = new Date();
  }

  validateAction(): boolean {
    // Basic validation rules
    if (!this.actorId || !this.actionType) {
      return false;
    }

    // Approval actions must have a decision
    if (this.isApprovalAction() && !this.decision) {
      return false;
    }

    // Delegation actions must have a delegate
    if (this.isDelegationAction() && !this.delegatedToId) {
      return false;
    }

    // Escalation actions must have an escalation target
    if (this.isEscalationAction() && !this.escalatedToId) {
      return false;
    }

    return true;
  }

  getActionSummary(): string {
    switch (this.actionType) {
      case ApprovalActionType.APPROVE:
        return `Approved${this.decision === ApprovalDecision.CONDITIONAL ? ' with conditions' : ''}`;
      case ApprovalActionType.REJECT:
        return 'Rejected';
      case ApprovalActionType.DELEGATE:
        return `Delegated to ${this.delegatedTo?.name || 'another user'}`;
      case ApprovalActionType.ESCALATE:
        return `Escalated to ${this.escalatedTo?.name || 'higher authority'}`;
      case ApprovalActionType.REQUEST_INFO:
        return 'Requested additional information';
      case ApprovalActionType.PROVIDE_INFO:
        return 'Provided requested information';
      case ApprovalActionType.COMMENT:
        return 'Added comment';
      default:
        return this.actionType.replace('_', ' ').toLowerCase();
    }
  }
}