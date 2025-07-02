import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AuditableEntity } from '../../common/entities/base.entity';
import { HierarchicalRole } from './hierarchical-role.entity';

export enum InheritanceType {
  FULL = 'full',           // Inherit all permissions
  PARTIAL = 'partial',     // Inherit selected permissions
  ADDITIVE = 'additive',   // Add permissions to existing ones
  OVERRIDE = 'override',   // Override specific permissions
}

export enum HierarchyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('role_hierarchies')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'parentRoleId'])
@Index(['tenantId', 'childRoleId'])
@Index(['parentRoleId', 'childRoleId'], { unique: true, where: 'is_deleted = false' })
export class RoleHierarchy extends AuditableEntity {
  // Parent role (grants permissions)
  @Column({ type: 'uuid', name: 'parent_role_id' })
  @Exclude({ toPlainOnly: true })
  parentRoleId: string;

  @ManyToOne(() => HierarchicalRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_role_id' })
  parentRole: HierarchicalRole;

  // Child role (inherits permissions)
  @Column({ type: 'uuid', name: 'child_role_id' })
  @Exclude({ toPlainOnly: true })
  childRoleId: string;

  @ManyToOne(() => HierarchicalRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_role_id' })
  childRole: HierarchicalRole;

  // Inheritance configuration
  @Column({
    type: 'enum',
    enum: InheritanceType,
    default: InheritanceType.FULL,
  })
  inheritanceType: InheritanceType;

  @Column({
    type: 'enum',
    enum: HierarchyStatus,
    default: HierarchyStatus.ACTIVE,
  })
  status: HierarchyStatus;

  // Hierarchy depth and path
  @Column({ type: 'int', default: 1 })
  depth: number; // How many levels between parent and child

  @Column({ type: 'varchar', length: 500, nullable: true })
  path?: string; // Full path from root to child

  // Permission filtering
  @Column({ type: 'jsonb', nullable: true })
  includedPermissions?: string[]; // Specific permissions to inherit

  @Column({ type: 'jsonb', nullable: true })
  excludedPermissions?: string[]; // Permissions to exclude from inheritance

  @Column({ type: 'jsonb', nullable: true })
  overriddenPermissions?: { // Override specific permissions
    [permissionKey: string]: {
      action: 'grant' | 'deny';
      reason?: string;
      conditions?: Record<string, any>;
    };
  };

  // Conditional inheritance
  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    departmentRestriction?: {
      allowedDepartments?: string[];
      excludedDepartments?: string[];
    };
    timeRestriction?: {
      validFrom?: string;
      validUntil?: string;
      allowedHours?: Record<string, { start: string; end: string; }>;
    };
    contextRestriction?: {
      requiresSameLocation?: boolean;
      requiresSameDepartment?: boolean;
      requiresApproval?: boolean;
    };
  };

  // Approval and auditing
  @Column({ type: 'boolean', default: false })
  requiresApproval: boolean;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  approvalNotes?: string;

  // Effective period
  @Column({ type: 'timestamp', nullable: true })
  validFrom?: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil?: Date;

  // Delegation settings
  @Column({ type: 'boolean', default: false })
  allowsDelegation: boolean; // Can child role delegate parent permissions?

  @Column({ type: 'boolean', default: false })
  allowsSubInheritance: boolean; // Can child role pass permissions to its children?

  @Column({ type: 'int', nullable: true })
  maxDelegationDepth?: number; // Maximum delegation depth

  // Usage tracking
  @Column({ type: 'int', default: 0 })
  usageCount: number; // How many times this inheritance was used

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  // Metadata and context
  @Column({ type: 'varchar', length: 200, nullable: true })
  reason?: string; // Reason for this hierarchy relationship

  @Column({ type: 'varchar', length: 100, nullable: true })
  context?: string; // Business context (e.g., 'organizational', 'project-based')

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Notification preferences
  @Column({ type: 'boolean', default: false })
  notifyOnInheritance: boolean; // Notify when permissions are inherited

  @Column({ type: 'boolean', default: false })
  notifyOnChanges: boolean; // Notify when parent permissions change

  // Computed properties
  get isActive(): boolean {
    return this.status === HierarchyStatus.ACTIVE && !this.isDeleted && this.isValidNow;
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
    return this.status === HierarchyStatus.PENDING;
  }

  get hasConditions(): boolean {
    return !!this.conditions && Object.keys(this.conditions).length > 0;
  }

  get isDirectInheritance(): boolean {
    return this.depth === 1;
  }

  // Methods
  shouldInheritPermission(permissionKey: string): boolean {
    // Check if explicitly excluded
    if (this.excludedPermissions?.includes(permissionKey)) {
      return false;
    }

    // For partial inheritance, check if explicitly included
    if (this.inheritanceType === InheritanceType.PARTIAL) {
      return this.includedPermissions?.includes(permissionKey) || false;
    }

    // For full inheritance, include unless excluded
    if (this.inheritanceType === InheritanceType.FULL) {
      return true;
    }

    return false;
  }

  getPermissionOverride(permissionKey: string): 'grant' | 'deny' | null {
    if (!this.overriddenPermissions) return null;
    
    const override = this.overriddenPermissions[permissionKey];
    return override?.action || null;
  }

  isValidForDepartment(departmentId: string): boolean {
    const deptRestriction = this.conditions?.departmentRestriction;
    if (!deptRestriction) return true;

    // Check if department is explicitly excluded
    if (deptRestriction.excludedDepartments?.includes(departmentId)) {
      return false;
    }

    // If there's an allowed list, check if department is in it
    if (deptRestriction.allowedDepartments?.length) {
      return deptRestriction.allowedDepartments.includes(departmentId);
    }

    return true;
  }

  isValidForTime(): boolean {
    const timeRestriction = this.conditions?.timeRestriction;
    if (!timeRestriction) return true;

    const now = new Date();

    // Check date range
    if (timeRestriction.validFrom && now < new Date(timeRestriction.validFrom)) {
      return false;
    }
    if (timeRestriction.validUntil && now > new Date(timeRestriction.validUntil)) {
      return false;
    }

    // Check allowed hours
    if (timeRestriction.allowedHours) {
      const dayOfWeek = now.toLocaleDateString('en', { weekday: 'lowercase' });
      const schedule = timeRestriction.allowedHours[dayOfWeek];
      
      if (!schedule) return false;
      
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      return currentTime >= schedule.start && currentTime <= schedule.end;
    }

    return true;
  }

  updateUsage(): void {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
  }

  buildPath(parentPath?: string): string {
    if (!parentPath) {
      return this.parentRole?.code || '';
    }
    return `${parentPath}/${this.childRole?.code || ''}`;
  }

  // Activate the hierarchy relationship
  activate(approvedBy?: string, notes?: string): void {
    this.status = HierarchyStatus.ACTIVE;
    if (approvedBy) {
      this.approvedBy = approvedBy;
      this.approvedAt = new Date();
      this.approvalNotes = notes;
    }
  }

  // Deactivate the hierarchy relationship
  deactivate(): void {
    this.status = HierarchyStatus.INACTIVE;
  }

  // Add permission to inclusion list
  includePermission(permissionKey: string): void {
    if (!this.includedPermissions) {
      this.includedPermissions = [];
    }
    if (!this.includedPermissions.includes(permissionKey)) {
      this.includedPermissions.push(permissionKey);
    }
  }

  // Add permission to exclusion list
  excludePermission(permissionKey: string): void {
    if (!this.excludedPermissions) {
      this.excludedPermissions = [];
    }
    if (!this.excludedPermissions.includes(permissionKey)) {
      this.excludedPermissions.push(permissionKey);
    }
  }

  // Override a specific permission
  overridePermission(
    permissionKey: string, 
    action: 'grant' | 'deny', 
    reason?: string,
    conditions?: Record<string, any>
  ): void {
    if (!this.overriddenPermissions) {
      this.overriddenPermissions = {};
    }
    
    this.overriddenPermissions[permissionKey] = {
      action,
      reason,
      conditions,
    };
  }
}