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
import { ApprovalChain } from './approval-chain.entity';
import { User } from '../../users/entities/user.entity';
import { HierarchicalRole } from './hierarchical-role.entity';
import { Department } from './department.entity';
import { ApprovalInstance } from './approval-instance.entity';

export enum ApprovalStepType {
  USER = 'user',
  ROLE = 'role', 
  DEPARTMENT = 'department',
  EXTERNAL = 'external',
  AUTOMATIC = 'automatic',
}

export enum ApprovalLogic {
  ANY = 'any',
  ALL = 'all',
  MAJORITY = 'majority',
  UNANIMOUS = 'unanimous',
  SEQUENTIAL = 'sequential',
}

@Entity('approval_steps')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'chainId'])
@Index(['tenantId', 'stepOrder'])
@Index(['tenantId', 'approverType'])
export class ApprovalStep extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ name: 'chain_id', type: 'uuid' })
  chainId: string;

  @ManyToOne(() => ApprovalChain, chain => chain.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chain_id' })
  chain: ApprovalChain;

  @Column({ name: 'step_order', type: 'integer' })
  stepOrder: number;

  @Column({ name: 'step_name', length: 100 })
  stepName: string;

  @Column({ name: 'step_description', type: 'text', nullable: true })
  stepDescription: string;

  @Column({
    name: 'approver_type',
    type: 'enum',
    enum: ApprovalStepType,
    default: ApprovalStepType.USER,
  })
  approverType: ApprovalStepType;

  @Column({
    name: 'approval_logic',
    type: 'enum',
    enum: ApprovalLogic,
    default: ApprovalLogic.ANY,
  })
  approvalLogic: ApprovalLogic;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;

  @Column({ name: 'is_parallel', type: 'boolean', default: false })
  isParallel: boolean;

  @Column({ name: 'timeout_hours', type: 'integer', nullable: true })
  timeoutHours: number;

  @Column({ name: 'escalation_hours', type: 'integer', nullable: true })
  escalationHours: number;

  @Column({ name: 'auto_approve_on_timeout', type: 'boolean', default: false })
  autoApproveOnTimeout: boolean;

  @Column({ name: 'allow_delegation', type: 'boolean', default: true })
  allowDelegation: boolean;

  @Column({ name: 'require_comments', type: 'boolean', default: false })
  requireComments: boolean;

  @Column({ name: 'minimum_approvers', type: 'integer', default: 1 })
  minimumApprovers: number;

  @Column({ name: 'maximum_approvers', type: 'integer', nullable: true })
  maximumApprovers: number;

  // Specific approver references
  @Column({ name: 'approver_user_id', type: 'uuid', nullable: true })
  approverUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_user_id' })
  approverUser: User;

  @Column({ name: 'approver_role_id', type: 'uuid', nullable: true })
  approverRoleId: string;

  @ManyToOne(() => HierarchicalRole, { nullable: true })
  @JoinColumn({ name: 'approver_role_id' })
  approverRole: HierarchicalRole;

  @Column({ name: 'approver_department_id', type: 'uuid', nullable: true })
  approverDepartmentId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'approver_department_id' })
  approverDepartment: Department;

  // Escalation settings
  @Column({ name: 'escalation_user_id', type: 'uuid', nullable: true })
  escalationUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'escalation_user_id' })
  escalationUser: User;

  @Column({ name: 'escalation_role_id', type: 'uuid', nullable: true })
  escalationRoleId: string;

  @ManyToOne(() => HierarchicalRole, { nullable: true })
  @JoinColumn({ name: 'escalation_role_id' })
  escalationRole: HierarchicalRole;

  // Conditions and rules
  @Column({ name: 'conditions', type: 'jsonb', nullable: true })
  conditions: Record<string, any>;

  @Column({ name: 'approval_criteria', type: 'jsonb', nullable: true })
  approvalCriteria: Record<string, any>;

  @Column({ name: 'notification_settings', type: 'jsonb', nullable: true })
  notificationSettings: {
    sendEmail?: boolean;
    sendSms?: boolean;
    sendPush?: boolean;
    reminderIntervalHours?: number;
    escalationNotification?: boolean;
    notificationTemplate?: string;
  };

  // Business rules
  @Column({ name: 'business_hours_only', type: 'boolean', default: false })
  businessHoursOnly: boolean;

  @Column({ name: 'weekend_approval', type: 'boolean', default: true })
  weekendApproval: boolean;

  @Column({ name: 'holiday_approval', type: 'boolean', default: true })
  holidayApproval: boolean;

  // Performance tracking
  @Column({ name: 'average_approval_time_hours', type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageApprovalTimeHours: number;

  @Column({ name: 'approval_success_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  approvalSuccessRate: number;

  @Column({ name: 'escalation_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  escalationRate: number;

  // Activity tracking
  @Column({ name: 'last_approval_at', type: 'timestamp', nullable: true })
  lastApprovalAt: Date;

  @Column({ name: 'total_approvals', type: 'integer', default: 0 })
  totalApprovals: number;

  @Column({ name: 'total_rejections', type: 'integer', default: 0 })
  totalRejections: number;

  @Column({ name: 'total_escalations', type: 'integer', default: 0 })
  totalEscalations: number;

  // Status and metadata
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_system_step', type: 'boolean', default: false })
  isSystemStep: boolean;

  @Column({ name: 'step_version', type: 'integer', default: 1 })
  stepVersion: number;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Relationships
  @OneToMany(() => ApprovalInstance, instance => instance.currentStep)
  instances: ApprovalInstance[];

  // Helper methods
  isEligibleApprover(userId: string, userRoles: string[], userDepartments: string[]): boolean {
    switch (this.approverType) {
      case ApprovalStepType.USER:
        return this.approverUserId === userId;
      case ApprovalStepType.ROLE:
        return userRoles.includes(this.approverRoleId);
      case ApprovalStepType.DEPARTMENT:
        return userDepartments.includes(this.approverDepartmentId);
      case ApprovalStepType.AUTOMATIC:
        return true;
      default:
        return false;
    }
  }

  isTimeoutExpired(startTime: Date): boolean {
    if (!this.timeoutHours) return false;
    const timeoutDate = new Date(startTime.getTime() + this.timeoutHours * 60 * 60 * 1000);
    return new Date() > timeoutDate;
  }

  isEscalationRequired(startTime: Date): boolean {
    if (!this.escalationHours) return false;
    const escalationDate = new Date(startTime.getTime() + this.escalationHours * 60 * 60 * 1000);
    return new Date() > escalationDate;
  }

  getApprovalDeadline(startTime: Date): Date | null {
    if (!this.timeoutHours) return null;
    return new Date(startTime.getTime() + this.timeoutHours * 60 * 60 * 1000);
  }

  getEscalationDeadline(startTime: Date): Date | null {
    if (!this.escalationHours) return null;
    return new Date(startTime.getTime() + this.escalationHours * 60 * 60 * 1000);
  }

  shouldAutoApprove(startTime: Date): boolean {
    return this.autoApproveOnTimeout && this.isTimeoutExpired(startTime);
  }

  validateApprovalCriteria(requestData: any): boolean {
    if (!this.approvalCriteria) return true;
    
    // Implementation for validating approval criteria against request data
    // This would contain business logic for checking if the request meets the criteria
    return true;
  }

  getNotificationRecipients(): string[] {
    const recipients = [];
    
    if (this.approverUserId) {
      recipients.push(this.approverUserId);
    }
    
    // Add role-based recipients
    // Add department-based recipients
    
    return recipients;
  }

  updatePerformanceMetrics(isApproved: boolean, processingTimeHours: number, wasEscalated: boolean): void {
    this.totalApprovals += isApproved ? 1 : 0;
    this.totalRejections += isApproved ? 0 : 1;
    this.totalEscalations += wasEscalated ? 1 : 0;
    
    // Update average approval time
    const totalProcessedItems = this.totalApprovals + this.totalRejections;
    if (totalProcessedItems > 0) {
      this.averageApprovalTimeHours = 
        ((this.averageApprovalTimeHours || 0) * (totalProcessedItems - 1) + processingTimeHours) / totalProcessedItems;
    }
    
    // Update success rate
    this.approvalSuccessRate = (this.totalApprovals / totalProcessedItems) * 100;
    
    // Update escalation rate
    this.escalationRate = (this.totalEscalations / totalProcessedItems) * 100;
    
    this.lastApprovalAt = new Date();
  }
}