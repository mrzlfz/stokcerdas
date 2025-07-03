import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AuditableEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { HierarchicalRole } from './hierarchical-role.entity';
import { Department } from './department.entity';
import { PermissionSet } from './permission-set.entity';

export enum UserRoleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_APPROVAL = 'pending_approval',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export enum AssignmentType {
  PERMANENT = 'permanent',    // Permanent role assignment
  TEMPORARY = 'temporary',    // Temporary assignment with expiry
  DELEGATION = 'delegation',  // Delegated from another user
  ACTING = 'acting',         // Acting in role (e.g., manager on leave)
  PROJECT = 'project',       // Project-specific assignment
}

@Entity('user_roles')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'userId'])
@Index(['tenantId', 'roleId'])
@Index(['tenantId', 'departmentId'])
@Index(['userId', 'roleId', 'departmentId'], { unique: true, where: 'is_deleted = false' })
export class UserRole extends AuditableEntity {
  // User reference
  @Column({ type: 'uuid', name: 'user_id' })
  @Exclude({ toPlainOnly: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Role reference
  @Column({ type: 'uuid', name: 'role_id' })
  @Exclude({ toPlainOnly: true })
  roleId: string;

  @ManyToOne(() => HierarchicalRole, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: HierarchicalRole;

  // Department context
  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  @Exclude({ toPlainOnly: true })
  departmentId?: string;

  @ManyToOne(() => Department, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  // Permission set override
  @Column({ type: 'uuid', name: 'permission_set_id', nullable: true })
  @Exclude({ toPlainOnly: true })
  permissionSetId?: string;

  @ManyToOne(() => PermissionSet, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'permission_set_id' })
  permissionSet?: PermissionSet;

  // Assignment details
  @Column({
    type: 'enum',
    enum: UserRoleStatus,
    default: UserRoleStatus.ACTIVE,
  })
  status: UserRoleStatus;

  @Column({
    type: 'enum',
    enum: AssignmentType,
    default: AssignmentType.PERMANENT,
  })
  assignmentType: AssignmentType;

  @Column({ type: 'boolean', default: true })
  isPrimary: boolean; // Primary role for the user in this department

  @Column({ type: 'int', default: 0 })
  priority: number; // Priority when user has multiple roles (higher = more important)

  // Time-based assignment
  @Column({ type: 'timestamp', nullable: true })
  validFrom?: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt?: Date;

  // Delegation details
  @Column({ type: 'uuid', name: 'delegated_by', nullable: true })
  delegatedBy?: string; // User who delegated this role

  @Column({ type: 'uuid', name: 'delegated_to', nullable: true })
  delegatedTo?: string; // User this role is delegated to (for acting assignments)

  @Column({ type: 'text', nullable: true })
  delegationReason?: string;

  // Approval workflow
  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy?: string; // User who approved this assignment

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'uuid', name: 'requested_by', nullable: true })
  requestedBy?: string; // User who requested this assignment

  @Column({ type: 'timestamp', nullable: true })
  requestedAt?: Date;

  @Column({ type: 'text', nullable: true })
  approvalNotes?: string;

  // Assignment context
  @Column({ type: 'varchar', length: 100, nullable: true })
  assignmentReason?: string; // Reason for assignment (promotion, transfer, etc.)

  @Column({ type: 'varchar', length: 100, nullable: true })
  projectCode?: string; // Project code for project-based assignments

  @Column({ type: 'varchar', length: 100, nullable: true })
  costCenter?: string; // Cost center for billing

  // Restrictions and conditions
  @Column({ type: 'jsonb', nullable: true })
  restrictions?: {
    ipWhitelist?: string[];
    timeRestriction?: {
      allowedHours?: Record<string, { start: string; end: string; }>;
      timezone?: string;
    };
    locationRestriction?: {
      allowedLocations?: string[];
      requiresVpn?: boolean;
    };
    deviceRestriction?: {
      allowedDevices?: string[];
      requiresMfa?: boolean;
    };
  };

  // Performance and compliance
  @Column({ type: 'jsonb', nullable: true })
  performanceMetrics?: {
    lastReview?: string;
    nextReview?: string;
    rating?: number;
    goals?: string[];
  };

  @Column({ type: 'boolean', default: false })
  requiresReview: boolean;

  @Column({ type: 'timestamp', nullable: true })
  nextReviewDate?: Date;

  // Additional metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Notification preferences
  @Column({ type: 'jsonb', nullable: true })
  notificationSettings?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    inAppNotifications?: boolean;
    escalationSettings?: {
      enabled?: boolean;
      timeoutMinutes?: number;
      escalateTo?: string;
    };
  };

  // Computed properties
  get isActive(): boolean {
    return this.status === UserRoleStatus.ACTIVE && !this.isDeleted && this.isValidNow;
  }

  get isValidNow(): boolean {
    const now = new Date();
    const validFrom = !this.validFrom || this.validFrom <= now;
    const validUntil = !this.validUntil || this.validUntil >= now;
    return validFrom && validUntil;
  }

  get isExpired(): boolean {
    return this.validUntil ? new Date() > this.validUntil : false;
  }

  get isPendingApproval(): boolean {
    return this.status === UserRoleStatus.PENDING_APPROVAL;
  }

  get isTemporary(): boolean {
    return this.assignmentType === AssignmentType.TEMPORARY || 
           this.assignmentType === AssignmentType.DELEGATION ||
           this.assignmentType === AssignmentType.ACTING;
  }

  get isDelegated(): boolean {
    return this.assignmentType === AssignmentType.DELEGATION && !!this.delegatedBy;
  }

  get hasRestrictions(): boolean {
    return !!this.restrictions && Object.keys(this.restrictions).length > 0;
  }

  get effectivePermissions(): string[] {
    const permissions: string[] = [];
    
    // Add role permissions
    if (this.role?.inheritsPermissions) {
      // TODO: Implement role inheritance logic
    }
    
    // Add permission set permissions
    if (this.permissionSet?.permissions) {
      permissions.push(...this.permissionSet.getPermissionKeys());
    }
    
    return [...new Set(permissions)]; // Remove duplicates
  }

  // Methods
  activate(): void {
    this.status = UserRoleStatus.ACTIVE;
    this.lastActiveAt = new Date();
  }

  deactivate(): void {
    this.status = UserRoleStatus.INACTIVE;
  }

  suspend(reason?: string): void {
    this.status = UserRoleStatus.SUSPENDED;
    if (reason && this.metadata) {
      this.metadata.suspensionReason = reason;
    }
  }

  approve(approvedBy: string, notes?: string): void {
    this.status = UserRoleStatus.ACTIVE;
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.approvalNotes = notes;
  }

  extend(newExpiryDate: Date, extendedBy: string): void {
    this.validUntil = newExpiryDate;
    this.updatedBy = extendedBy;
    
    if (!this.metadata) this.metadata = {};
    this.metadata.lastExtension = {
      date: new Date().toISOString(),
      extendedBy,
      previousExpiry: this.validUntil?.toISOString(),
    };
  }

  delegate(delegatedTo: string, reason: string, expiryDate?: Date): void {
    this.delegatedTo = delegatedTo;
    this.delegationReason = reason;
    this.assignmentType = AssignmentType.DELEGATION;
    
    if (expiryDate) {
      this.validUntil = expiryDate;
    }
  }

  // Check if current time is within allowed hours
  isWithinAllowedHours(): boolean {
    const timeRestriction = this.restrictions?.timeRestriction;
    if (!timeRestriction?.allowedHours) return true;
    
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
    const schedule = timeRestriction.allowedHours[dayOfWeek];
    
    if (!schedule) return false;
    
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    return currentTime >= schedule.start && currentTime <= schedule.end;
  }

  // Check IP restriction
  isIpAllowed(ip: string): boolean {
    const ipWhitelist = this.restrictions?.ipWhitelist;
    if (!ipWhitelist || ipWhitelist.length === 0) return true;
    
    return ipWhitelist.includes(ip);
  }

  // Check location restriction
  isLocationAllowed(location: string): boolean {
    const locationRestriction = this.restrictions?.locationRestriction;
    if (!locationRestriction?.allowedLocations) return true;
    
    return locationRestriction.allowedLocations.includes(location);
  }

  // Get effective role considering inheritance
  getEffectiveRole(): HierarchicalRole {
    // TODO: Implement role inheritance logic
    return this.role;
  }

  // Calculate priority score for role conflicts
  getPriorityScore(): number {
    let score = this.priority;
    
    // Primary roles get higher priority
    if (this.isPrimary) score += 1000;
    
    // Permanent assignments get higher priority than temporary
    if (this.assignmentType === AssignmentType.PERMANENT) score += 100;
    
    // Active roles get higher priority
    if (this.isActive) score += 10;
    
    return score;
  }
}