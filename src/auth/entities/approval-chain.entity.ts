import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AuditableEntity } from '../../common/entities/base.entity';
import { HierarchicalRole } from './hierarchical-role.entity';
import { Department } from './department.entity';

export enum ApprovalType {
  ROLE_ASSIGNMENT = 'role_assignment',      // Role assignment approvals
  PERMISSION_GRANT = 'permission_grant',    // Permission granting approvals
  ACCESS_REQUEST = 'access_request',        // Access request approvals
  DEPARTMENT_TRANSFER = 'department_transfer', // Department transfer approvals
  SYSTEM_ACCESS = 'system_access',          // System access approvals
  DATA_ACCESS = 'data_access',              // Data access approvals
  BUDGET_APPROVAL = 'budget_approval',      // Budget-related approvals
  PURCHASE_ORDER = 'purchase_order',        // Purchase order approvals
  EXPENSE_APPROVAL = 'expense_approval',    // Expense approvals
  CUSTOM = 'custom',                        // Custom approval workflows
}

export enum ApprovalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

export enum ApprovalMode {
  SEQUENTIAL = 'sequential',    // One after another
  PARALLEL = 'parallel',       // All at the same time
  MAJORITY = 'majority',       // Majority consensus
  UNANIMOUS = 'unanimous',     // All must approve
  FIRST_RESPONSE = 'first_response', // First approval wins
}

export enum EscalationTrigger {
  TIMEOUT = 'timeout',         // Time-based escalation
  REJECTION = 'rejection',     // Escalate on rejection
  MULTIPLE_REJECTIONS = 'multiple_rejections', // Multiple rejections
  CUSTOM_CONDITION = 'custom_condition', // Custom business logic
}

@Entity('approval_chains')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'code'], { unique: true, where: 'is_deleted = false' })
@Index(['tenantId', 'type'])
@Index(['tenantId', 'departmentId'])
export class ApprovalChain extends AuditableEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string; // Unique approval chain code

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ApprovalType,
    default: ApprovalType.CUSTOM,
  })
  type: ApprovalType;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.DRAFT,
  })
  status: ApprovalStatus;

  @Column({
    type: 'enum',
    enum: ApprovalMode,
    default: ApprovalMode.SEQUENTIAL,
  })
  mode: ApprovalMode;

  // Department context
  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  @Exclude({ toPlainOnly: true })
  departmentId?: string;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  // Chain steps
  @OneToMany(() => ApprovalStep, (step) => step.approvalChain, {
    cascade: true,
    eager: true,
  })
  steps: ApprovalStep[];

  // Configuration
  @Column({ type: 'boolean', default: false })
  isSystemDefined: boolean; // System-defined, cannot be deleted

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  allowSkipping: boolean; // Allow skipping steps under certain conditions

  @Column({ type: 'boolean', default: false })
  allowDelegation: boolean; // Allow approvers to delegate

  @Column({ type: 'boolean', default: true })
  requiresComments: boolean; // Require comments for approval/rejection

  // Timing and escalation
  @Column({ type: 'int', nullable: true })
  defaultTimeoutHours?: number; // Default timeout for each step

  @Column({ type: 'int', nullable: true })
  maxTotalTimeHours?: number; // Maximum total time for entire chain

  @Column({ type: 'boolean', default: false })
  enableEscalation: boolean;

  @Column({
    type: 'enum',
    enum: EscalationTrigger,
    nullable: true,
  })
  escalationTrigger?: EscalationTrigger;

  @Column({ type: 'int', nullable: true })
  escalationTimeoutHours?: number;

  @Column({ type: 'uuid', name: 'escalation_role_id', nullable: true })
  escalationRoleId?: string; // Role to escalate to

  @ManyToOne(() => HierarchicalRole, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'escalation_role_id' })
  escalationRole?: HierarchicalRole;

  // Conditional logic
  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    amountThresholds?: {
      step1?: number;
      step2?: number;
      step3?: number;
    };
    departmentRules?: {
      [departmentId: string]: {
        skipSteps?: number[];
        additionalApprovers?: string[];
      };
    };
    userRules?: {
      [userId: string]: {
        skipSteps?: number[];
        requireAdditionalApproval?: boolean;
      };
    };
    timeBasedRules?: {
      businessHoursOnly?: boolean;
      weekdaysOnly?: boolean;
      excludeHolidays?: boolean;
    };
  };

  // Notification settings
  @Column({ type: 'jsonb', nullable: true })
  notificationSettings?: {
    onSubmission?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onApproval?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onRejection?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onTimeout?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onEscalation?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
  };

  // Usage tracking
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  usageStats?: {
    totalApprovals?: number;
    totalRejections?: number;
    averageApprovalTime?: number;
    timeoutCount?: number;
    escalationCount?: number;
  };

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Methods
  get isActiveChain(): boolean {
    return this.status === ApprovalStatus.ACTIVE && this.isActive && !this.isDeleted;
  }

  get canBeDeleted(): boolean {
    return !this.isSystemDefined && this.usageCount === 0;
  }

  get stepCount(): number {
    return this.steps?.length || 0;
  }

  get sortedSteps(): ApprovalStep[] {
    return this.steps?.sort((a, b) => a.stepOrder - b.stepOrder) || [];
  }

  // Get steps that can run in parallel
  getParallelSteps(stepOrder: number): ApprovalStep[] {
    return this.steps?.filter(s => s.stepOrder === stepOrder) || [];
  }

  // Check if chain is configured correctly
  isValidConfiguration(): boolean {
    if (!this.steps || this.steps.length === 0) return false;
    
    // Check for valid step orders
    const orders = this.steps.map(s => s.stepOrder);
    const uniqueOrders = [...new Set(orders)];
    
    // Must have at least one step
    if (uniqueOrders.length === 0) return false;
    
    // Check for gaps in step orders
    uniqueOrders.sort((a, b) => a - b);
    for (let i = 1; i < uniqueOrders.length; i++) {
      if (uniqueOrders[i] !== uniqueOrders[i-1] + 1) return false;
    }
    
    return true;
  }

  // Update usage statistics
  updateUsageStats(approved: boolean, processingTimeHours: number): void {
    if (!this.usageStats) {
      this.usageStats = {
        totalApprovals: 0,
        totalRejections: 0,
        averageApprovalTime: 0,
        timeoutCount: 0,
        escalationCount: 0,
      };
    }
    
    if (approved) {
      this.usageStats.totalApprovals += 1;
    } else {
      this.usageStats.totalRejections += 1;
    }
    
    // Update average approval time
    const totalRequests = this.usageStats.totalApprovals + this.usageStats.totalRejections;
    const currentAvg = this.usageStats.averageApprovalTime || 0;
    this.usageStats.averageApprovalTime = 
      ((currentAvg * (totalRequests - 1)) + processingTimeHours) / totalRequests;
    
    this.usageCount += 1;
    this.lastUsedAt = new Date();
  }

  // Record timeout
  recordTimeout(): void {
    if (!this.usageStats) this.usageStats = {};
    this.usageStats.timeoutCount = (this.usageStats.timeoutCount || 0) + 1;
  }

  // Record escalation
  recordEscalation(): void {
    if (!this.usageStats) this.usageStats = {};
    this.usageStats.escalationCount = (this.usageStats.escalationCount || 0) + 1;
  }
}

@Entity('approval_steps')
@Index(['tenantId', 'approvalChainId'])
@Index(['tenantId', 'approverRoleId'])
export class ApprovalStep extends AuditableEntity {
  // Chain reference
  @Column({ type: 'uuid', name: 'approval_chain_id' })
  @Exclude({ toPlainOnly: true })
  approvalChainId: string;

  @ManyToOne(() => ApprovalChain, (chain) => chain.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'approval_chain_id' })
  approvalChain: ApprovalChain;

  // Step configuration
  @Column({ type: 'int' })
  stepOrder: number; // Order in the approval chain (1, 2, 3, etc.)

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Approver configuration
  @Column({ type: 'uuid', name: 'approver_role_id', nullable: true })
  approverRoleId?: string;

  @ManyToOne(() => HierarchicalRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approver_role_id' })
  approverRole?: HierarchicalRole;

  @Column({ type: 'uuid', name: 'approver_user_id', nullable: true })
  approverUserId?: string; // Specific user approver

  @Column({ type: 'varchar', length: 100, nullable: true })
  approverDepartment?: string; // Department-based approver

  // Step behavior
  @Column({ type: 'boolean', default: true })
  isRequired: boolean; // Can this step be skipped?

  @Column({ type: 'boolean', default: false })
  allowDelegation: boolean; // Can approver delegate?

  @Column({ type: 'boolean', default: false })
  requiresComments: boolean; // Must provide comments?

  @Column({ type: 'int', nullable: true })
  timeoutHours?: number; // Specific timeout for this step

  @Column({ type: 'boolean', default: false })
  autoApprove: boolean; // Auto-approve under certain conditions

  // Conditional logic
  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    skipIf?: {
      amountBelow?: number;
      departmentMatches?: string[];
      roleMatches?: string[];
      timeCondition?: string;
    };
    requireIf?: {
      amountAbove?: number;
      riskLevel?: string;
      departmentMatches?: string[];
    };
    autoApproveIf?: {
      amountBelow?: number;
      previouslyApproved?: boolean;
      trustLevel?: string;
    };
  };

  // Escalation for this step
  @Column({ type: 'uuid', name: 'escalation_role_id', nullable: true })
  escalationRoleId?: string;

  @ManyToOne(() => HierarchicalRole, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'escalation_role_id' })
  escalationRole?: HierarchicalRole;

  @Column({ type: 'int', nullable: true })
  escalationTimeoutHours?: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Methods
  get isValid(): boolean {
    return (this.approverRoleId || this.approverUserId || this.approverDepartment) !== null;
  }

  shouldSkip(context: any): boolean {
    if (!this.isRequired) return true;
    if (!this.conditions?.skipIf) return false;
    
    const skipIf = this.conditions.skipIf;
    
    // Check amount condition
    if (skipIf.amountBelow && context.amount < skipIf.amountBelow) return true;
    
    // Check department condition
    if (skipIf.departmentMatches && skipIf.departmentMatches.includes(context.department)) return true;
    
    // Check role condition
    if (skipIf.roleMatches && skipIf.roleMatches.includes(context.role)) return true;
    
    return false;
  }

  shouldAutoApprove(context: any): boolean {
    if (!this.autoApprove) return false;
    if (!this.conditions?.autoApproveIf) return false;
    
    const autoApproveIf = this.conditions.autoApproveIf;
    
    // Check amount condition
    if (autoApproveIf.amountBelow && context.amount < autoApproveIf.amountBelow) return true;
    
    // Check previous approval condition
    if (autoApproveIf.previouslyApproved && context.previouslyApproved) return true;
    
    return false;
  }
}