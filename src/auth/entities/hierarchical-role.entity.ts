import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Tree,
  TreeParent,
  TreeChildren,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AuditableEntity } from '../../common/entities/base.entity';

export enum RoleType {
  SYSTEM = 'system', // Built-in system roles (Super Admin, Admin)
  ORGANIZATIONAL = 'organizational', // Organization-level roles (CEO, VP)
  DEPARTMENTAL = 'departmental', // Department-specific roles (Manager, Lead)
  FUNCTIONAL = 'functional', // Function-specific roles (Analyst, Specialist)
  CUSTOM = 'custom', // Custom user-defined roles
}

export enum RoleLevel {
  EXECUTIVE = 1, // C-level, VP level
  SENIOR = 2, // Senior management
  MIDDLE = 3, // Middle management
  JUNIOR = 4, // Junior management
  STAFF = 5, // Individual contributors
  INTERN = 6, // Interns, trainees
}

export enum RoleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
}

@Entity('hierarchical_roles')
@Tree('closure-table')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'code'], { unique: true, where: 'is_deleted = false' })
@Index(['tenantId', 'parentId'])
@Index(['tenantId', 'level'])
export class HierarchicalRole extends AuditableEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string; // Unique role code (e.g., 'SUPER_ADMIN', 'DEPT_MANAGER')

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: RoleType,
    default: RoleType.CUSTOM,
  })
  type: RoleType;

  @Column({
    type: 'enum',
    enum: RoleLevel,
    default: RoleLevel.STAFF,
  })
  level: RoleLevel;

  @Column({
    type: 'enum',
    enum: RoleStatus,
    default: RoleStatus.ACTIVE,
  })
  status: RoleStatus;

  // Hierarchical structure
  @TreeParent()
  parent?: HierarchicalRole;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  @Exclude({ toPlainOnly: true })
  parentId?: string;

  @TreeChildren()
  children: HierarchicalRole[];

  // Role hierarchy depth (0 = root role)
  @Column({ type: 'int', default: 0 })
  depth: number;

  // Role hierarchy path
  @Column({ type: 'varchar', length: 500, nullable: true })
  path?: string;

  // Permission inheritance settings
  @Column({ type: 'boolean', default: true })
  inheritsPermissions: boolean; // Inherit from parent roles

  @Column({ type: 'boolean', default: false })
  grantsPermissions: boolean; // Can grant permissions to child roles

  // Administrative settings
  @Column({ type: 'boolean', default: false })
  isSystemRole: boolean; // System-defined, cannot be deleted

  @Column({ type: 'boolean', default: false })
  isExecutiveRole: boolean; // Executive/leadership role

  @Column({ type: 'boolean', default: false })
  requiresApproval: boolean; // Role assignments require approval

  // Scope and limitations
  @Column({ type: 'varchar', length: 100, nullable: true })
  scope?: string; // Global, Department, Team, etc.

  @Column({ type: 'int', nullable: true })
  maxUsers?: number; // Maximum users that can have this role

  @Column({ type: 'int', default: 0 })
  currentUsers: number; // Current number of users with this role

  // Security settings
  @Column({ type: 'boolean', default: false })
  requiresMfa: boolean; // MFA required for this role

  @Column({ type: 'boolean', default: false })
  requiresIpWhitelist: boolean; // IP whitelist required

  @Column({ type: 'jsonb', nullable: true })
  ipWhitelist?: string[]; // Allowed IP addresses

  // Business context
  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string; // Associated department

  @Column({ type: 'varchar', length: 100, nullable: true })
  function?: string; // Business function (Sales, IT, Finance)

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string; // Geographic location restriction

  // Approval workflow
  @Column({ type: 'uuid', name: 'approval_role_id', nullable: true })
  approvalRoleId?: string; // Role that can approve assignments

  @Column({ type: 'int', nullable: true })
  approvalTimeout?: number; // Hours until auto-approval

  // IP restrictions
  @Column({ type: 'jsonb', nullable: true })
  ipRestrictions?: {
    allowedIps?: string[];
    blockedIps?: string[];
  };

  // Direct permissions for this role
  @Column({ type: 'jsonb', nullable: true })
  permissions?: Array<{
    resource: string;
    action: string;
    conditions?: Record<string, any>;
  }>;

  // Additional metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Time-based access
  @Column({ type: 'timestamp', nullable: true })
  validFrom?: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil?: Date;

  // Business hours restriction
  @Column({ type: 'jsonb', nullable: true })
  allowedHours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };

  // Methods
  get fullPath(): string {
    return this.path || this.code;
  }

  get isActive(): boolean {
    return this.status === RoleStatus.ACTIVE && !this.isDeleted;
  }

  get isSystemDefined(): boolean {
    return this.type === RoleType.SYSTEM || this.isSystemRole;
  }

  get canBeDeleted(): boolean {
    return !this.isSystemDefined && this.currentUsers === 0;
  }

  get isExecutive(): boolean {
    return this.isExecutiveRole || this.level <= RoleLevel.SENIOR;
  }

  get isValid(): boolean {
    const now = new Date();
    const validFrom = !this.validFrom || this.validFrom <= now;
    const validUntil = !this.validUntil || this.validUntil >= now;
    return this.isActive && validFrom && validUntil;
  }

  get hasCapacity(): boolean {
    return !this.maxUsers || this.currentUsers < this.maxUsers;
  }

  // Build role path
  buildPath(parentPath?: string): string {
    if (!parentPath || this.depth === 0) {
      return this.code;
    }
    return `${parentPath}/${this.code}`;
  }

  // Update path recursively
  updatePath(parentPath?: string): void {
    this.path = this.buildPath(parentPath);
    if (this.children && this.children.length > 0) {
      this.children.forEach(child => {
        child.updatePath(this.path);
      });
    }
  }

  // Check if role can grant permissions to another role
  canGrantTo(targetRole: HierarchicalRole): boolean {
    if (!this.grantsPermissions) return false;
    if (targetRole.level <= this.level) return false; // Can only grant to lower levels
    return true;
  }

  // Check if role inherits from another role
  inheritsFrom(sourceRole: HierarchicalRole): boolean {
    if (!this.inheritsPermissions) return false;

    // Check if sourceRole is an ancestor
    let current = this.parent;
    while (current) {
      if (current.id === sourceRole.id) return true;
      current = current.parent;
    }
    return false;
  }

  // Check if current time is within allowed hours
  isWithinAllowedHours(): boolean {
    if (!this.allowedHours) return true;

    const now = new Date();
    const dayOfWeek = now
      .toLocaleDateString('en', { weekday: 'long' })
      .toLowerCase() as keyof typeof this.allowedHours;
    const schedule = this.allowedHours[dayOfWeek];

    if (!schedule) return false;

    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    return currentTime >= schedule.start && currentTime <= schedule.end;
  }

  // Check if IP address is allowed for this role
  isIpAllowed(ipAddress: string): boolean {
    if (!this.ipRestrictions) return true;

    // Check if IP is in blocked list
    if (this.ipRestrictions.blockedIps?.includes(ipAddress)) {
      return false;
    }

    // Check if IP is in allowed list (if specified)
    if (this.ipRestrictions.allowedIps?.length > 0) {
      return this.ipRestrictions.allowedIps.some(allowedIp => {
        // Simple IP matching - in production, use proper CIDR matching
        return ipAddress.startsWith(allowedIp.split('/')[0]);
      });
    }

    return true;
  }

  // Check if role has direct permission
  hasDirectPermission(permissionKey: string): boolean {
    if (!this.permissions) return false;

    return this.permissions.some(permission => {
      const key = `${permission.resource}:${permission.action}`;
      return key === permissionKey;
    });
  }

  // Get effective permissions including inherited ones
  getEffectivePermissions(): string[] {
    const permissions: string[] = [];

    // Add direct permissions
    if (this.permissions) {
      this.permissions.forEach(permission => {
        permissions.push(`${permission.resource}:${permission.action}`);
      });
    }

    // Add inherited permissions from parent
    if (this.inheritsPermissions && this.parent) {
      permissions.push(...this.parent.getEffectivePermissions());
    }

    // Remove duplicates
    return [...new Set(permissions)];
  }
}
