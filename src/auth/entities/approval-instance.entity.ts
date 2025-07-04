import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { ApprovalChain } from './approval-chain.entity';
import { ApprovalStep } from './approval-step.entity';
import { User } from '../../users/entities/user.entity';
import { ApprovalAction } from './approval-action.entity';

export enum ApprovalInstanceStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum ApprovalPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export enum ApprovalReason {
  PURCHASE_ORDER = 'purchase_order',
  EXPENSE_APPROVAL = 'expense_approval',
  ROLE_ASSIGNMENT = 'role_assignment',
  PERMISSION_CHANGE = 'permission_change',
  USER_ACCESS = 'user_access',
  BUDGET_ALLOCATION = 'budget_allocation',
  POLICY_EXCEPTION = 'policy_exception',
  SYSTEM_CHANGE = 'system_change',
  DATA_EXPORT = 'data_export',
  VENDOR_APPROVAL = 'vendor_approval',
  CONTRACT_APPROVAL = 'contract_approval',
  CUSTOM = 'custom',
}

@Entity('approval_instances')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'requestorId'])
@Index(['tenantId', 'chainId'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'dueDate'])
@Index(['status', 'dueDate'])
export class ApprovalInstance extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ name: 'chain_id', type: 'uuid' })
  chainId: string;

  @ManyToOne(() => ApprovalChain, { eager: true })
  @JoinColumn({ name: 'chain_id' })
  chain: ApprovalChain;

  @Column({ name: 'current_step_id', type: 'uuid', nullable: true })
  currentStepId: string;

  @ManyToOne(() => ApprovalStep, step => step.instances, { eager: true })
  @JoinColumn({ name: 'current_step_id' })
  currentStep: ApprovalStep;

  @Column({ name: 'requestor_id', type: 'uuid' })
  requestorId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requestor_id' })
  requestor: User;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ApprovalInstanceStatus,
    default: ApprovalInstanceStatus.PENDING,
  })
  status: ApprovalInstanceStatus;

  @Column({
    name: 'priority',
    type: 'enum',
    enum: ApprovalPriority,
    default: ApprovalPriority.NORMAL,
  })
  priority: ApprovalPriority;

  @Column({
    name: 'reason',
    type: 'enum',
    enum: ApprovalReason,
    default: ApprovalReason.CUSTOM,
  })
  reason: ApprovalReason;

  @Column({ name: 'title', length: 200 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'request_data', type: 'jsonb' })
  requestData: Record<string, any>;

  @Column({ name: 'context_data', type: 'jsonb', nullable: true })
  contextData: {
    entityType?: string;
    entityId?: string;
    amount?: number;
    currency?: string;
    department?: string;
    project?: string;
    costCenter?: string;
    attachments?: string[];
    relatedInstances?: string[];
    businessJustification?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    complianceRequirements?: string[];
  };

  // Timing and deadlines
  @Column({
    name: 'submitted_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  submittedAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ name: 'escalation_date', type: 'timestamp', nullable: true })
  escalationDate: Date;

  @Column({
    name: 'last_activity_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastActivityAt: Date;

  // Progress tracking
  @Column({ name: 'current_step_order', type: 'integer', default: 1 })
  currentStepOrder: number;

  @Column({ name: 'total_steps', type: 'integer' })
  totalSteps: number;

  @Column({ name: 'completed_steps', type: 'integer', default: 0 })
  completedSteps: number;

  @Column({
    name: 'progress_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  progressPercentage: number;

  // Approval tracking
  @Column({ name: 'approvals_received', type: 'integer', default: 0 })
  approvalsReceived: number;

  @Column({ name: 'rejections_received', type: 'integer', default: 0 })
  rejectionsReceived: number;

  @Column({ name: 'escalations_count', type: 'integer', default: 0 })
  escalationsCount: number;

  @Column({ name: 'comments_count', type: 'integer', default: 0 })
  commentsCount: number;

  // Workflow state
  @Column({ name: 'is_parallel_approval', type: 'boolean', default: false })
  isParallelApproval: boolean;

  @Column({
    name: 'parallel_approvals_needed',
    type: 'integer',
    nullable: true,
  })
  parallelApprovalsNeeded: number;

  @Column({ name: 'parallel_approvals_received', type: 'integer', default: 0 })
  parallelApprovalsReceived: number;

  @Column({ name: 'can_be_delegated', type: 'boolean', default: true })
  canBeDelegated: boolean;

  @Column({ name: 'requires_unanimous', type: 'boolean', default: false })
  requiresUnanimous: boolean;

  // Notifications and reminders
  @Column({ name: 'reminder_sent_count', type: 'integer', default: 0 })
  reminderSentCount: number;

  @Column({ name: 'last_reminder_sent_at', type: 'timestamp', nullable: true })
  lastReminderSentAt: Date;

  @Column({ name: 'notification_settings', type: 'jsonb', nullable: true })
  notificationSettings: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
    reminderFrequencyHours?: number;
    escalationNotifications?: boolean;
    statusChangeNotifications?: boolean;
  };

  // Business context
  @Column({
    name: 'business_impact',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  businessImpact: 'low' | 'medium' | 'high' | 'critical';

  @Column({
    name: 'financial_impact',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  financialImpact: number;

  @Column({ name: 'compliance_required', type: 'boolean', default: false })
  complianceRequired: boolean;

  @Column({ name: 'audit_trail_required', type: 'boolean', default: true })
  auditTrailRequired: boolean;

  // Performance metrics
  @Column({ name: 'sla_target_hours', type: 'integer', nullable: true })
  slaTargetHours: number;

  @Column({
    name: 'processing_time_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  processingTimeHours: number;

  @Column({ name: 'is_sla_breached', type: 'boolean', default: false })
  isSlaBreached: boolean;

  @Column({ name: 'breach_reason', type: 'text', nullable: true })
  breachReason: string;

  // External integrations
  @Column({
    name: 'external_reference_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalReferenceId: string;

  @Column({
    name: 'external_system',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  externalSystem: string;

  @Column({ name: 'external_url', type: 'text', nullable: true })
  externalUrl: string;

  // Tags and categorization
  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ name: 'subcategory', type: 'varchar', length: 100, nullable: true })
  subcategory: string;

  // Security and access
  @Column({ name: 'is_confidential', type: 'boolean', default: false })
  isConfidential: boolean;

  @Column({
    name: 'access_level',
    type: 'varchar',
    length: 50,
    default: 'normal',
  })
  accessLevel: 'public' | 'internal' | 'confidential' | 'restricted';

  @Column({ name: 'allowed_viewers', type: 'simple-array', nullable: true })
  allowedViewers: string[];

  // Metadata and extensions
  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'workflow_version', type: 'integer', default: 1 })
  workflowVersion: number;

  // Relationships
  @OneToMany(() => ApprovalAction, action => action.instance, { cascade: true })
  actions: ApprovalAction[];

  // Helper methods
  updateProgress(): void {
    if (this.totalSteps > 0) {
      this.progressPercentage = (this.completedSteps / this.totalSteps) * 100;
    }
  }

  calculateProcessingTime(): void {
    if (this.startedAt && this.completedAt) {
      const diffMs = this.completedAt.getTime() - this.startedAt.getTime();
      this.processingTimeHours = diffMs / (1000 * 60 * 60);
    }
  }

  checkSlaCompliance(): void {
    if (this.slaTargetHours && this.processingTimeHours) {
      this.isSlaBreached = this.processingTimeHours > this.slaTargetHours;
    }
  }

  isOverdue(): boolean {
    if (!this.dueDate) return false;
    return (
      new Date() > this.dueDate &&
      ![
        ApprovalInstanceStatus.APPROVED,
        ApprovalInstanceStatus.REJECTED,
        ApprovalInstanceStatus.CANCELLED,
      ].includes(this.status)
    );
  }

  needsEscalation(): boolean {
    if (!this.escalationDate) return false;
    return (
      new Date() > this.escalationDate &&
      this.status === ApprovalInstanceStatus.PENDING
    );
  }

  canBeApprovedBy(
    userId: string,
    userRoles: string[],
    userDepartments: string[],
  ): boolean {
    if (!this.currentStep) return false;
    return this.currentStep.isEligibleApprover(
      userId,
      userRoles,
      userDepartments,
    );
  }

  getTimeRemaining(): number | null {
    if (!this.dueDate) return null;
    const now = new Date();
    const diff = this.dueDate.getTime() - now.getTime();
    return Math.max(0, diff / (1000 * 60 * 60)); // hours
  }

  isParallelApprovalComplete(): boolean {
    if (!this.isParallelApproval || !this.parallelApprovalsNeeded) return true;
    return this.parallelApprovalsReceived >= this.parallelApprovalsNeeded;
  }

  requiresMoreApprovals(): boolean {
    if (this.isParallelApproval) {
      return !this.isParallelApprovalComplete();
    }
    return this.status === ApprovalInstanceStatus.PENDING;
  }

  getNextApprovers(): string[] {
    if (!this.currentStep) return [];
    return this.currentStep.getNotificationRecipients();
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

  updateLastActivity(): void {
    this.lastActivityAt = new Date();
  }

  markAsStarted(): void {
    if (!this.startedAt) {
      this.startedAt = new Date();
      this.status = ApprovalInstanceStatus.IN_PROGRESS;
    }
    this.updateLastActivity();
  }

  markAsCompleted(
    finalStatus:
      | ApprovalInstanceStatus.APPROVED
      | ApprovalInstanceStatus.REJECTED,
  ): void {
    this.completedAt = new Date();
    this.status = finalStatus;
    this.progressPercentage = 100;
    this.calculateProcessingTime();
    this.checkSlaCompliance();
    this.updateLastActivity();
  }

  escalate(reason: string): void {
    this.escalationsCount++;
    this.status = ApprovalInstanceStatus.ESCALATED;
    this.escalationDate = new Date();
    if (reason) {
      this.addCustomField('escalation_reason', reason);
    }
    this.updateLastActivity();
  }

  cancel(reason: string): void {
    this.status = ApprovalInstanceStatus.CANCELLED;
    this.completedAt = new Date();
    if (reason) {
      this.addCustomField('cancellation_reason', reason);
    }
    this.updateLastActivity();
  }

  putOnHold(reason: string): void {
    this.status = ApprovalInstanceStatus.ON_HOLD;
    if (reason) {
      this.addCustomField('hold_reason', reason);
    }
    this.updateLastActivity();
  }

  resume(): void {
    if (this.status === ApprovalInstanceStatus.ON_HOLD) {
      this.status = ApprovalInstanceStatus.IN_PROGRESS;
      this.addCustomField('resumed_at', new Date());
    }
    this.updateLastActivity();
  }

  sendReminder(): void {
    this.reminderSentCount++;
    this.lastReminderSentAt = new Date();
    this.updateLastActivity();
  }

  shouldSendReminder(): boolean {
    if (!this.notificationSettings?.reminderFrequencyHours) return false;
    if (!this.lastReminderSentAt) return true;

    const hoursSinceLastReminder =
      (new Date().getTime() - this.lastReminderSentAt.getTime()) /
      (1000 * 60 * 60);

    return (
      hoursSinceLastReminder >= this.notificationSettings.reminderFrequencyHours
    );
  }
}
