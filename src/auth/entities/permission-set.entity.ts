import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Permission } from './permission.entity';

export enum PermissionSetType {
  SYSTEM = 'system',        // Built-in system permission sets
  TEMPLATE = 'template',    // Reusable permission templates
  CUSTOM = 'custom',        // Custom permission sets
  DEPARTMENT = 'department', // Department-specific permission sets
  FUNCTION = 'function',    // Function-specific permission sets (Sales, IT, etc.)
  PROJECT = 'project',      // Project-based permission sets
}

export enum PermissionSetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

export enum PermissionSetScope {
  GLOBAL = 'global',        // Available to all tenants
  TENANT = 'tenant',        // Tenant-specific
  DEPARTMENT = 'department', // Department-specific
  TEAM = 'team',           // Team-specific
  USER = 'user',           // User-specific
}

@Entity('permission_sets')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'code'], { unique: true, where: 'is_deleted = false' })
@Index(['tenantId', 'type'])
@Index(['tenantId', 'scope'])
export class PermissionSet extends AuditableEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string; // Unique permission set code (e.g., 'SALES_MANAGER', 'IT_ADMIN')

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: PermissionSetType,
    default: PermissionSetType.CUSTOM,
  })
  type: PermissionSetType;

  @Column({
    type: 'enum',
    enum: PermissionSetStatus,
    default: PermissionSetStatus.DRAFT,
  })
  status: PermissionSetStatus;

  @Column({
    type: 'enum',
    enum: PermissionSetScope,
    default: PermissionSetScope.TENANT,
  })
  scope: PermissionSetScope;

  // Permission relationships
  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({
    name: 'permission_set_permissions',
    joinColumn: {
      name: 'permission_set_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'permission_id', 
      referencedColumnName: 'id',
    },
  })
  permissions: Permission[];

  // Category and organization
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string; // Business category (Sales, IT, Finance, etc.)

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategory?: string; // Subcategory (Regional Sales, Database Admin)

  @Column({ type: 'int', default: 0 })
  priority: number; // Display priority (higher = more important)

  // Template settings
  @Column({ type: 'boolean', default: false })
  isTemplate: boolean; // Can be used as a template for new sets

  @Column({ type: 'boolean', default: false })
  isSystemDefined: boolean; // System-defined, cannot be deleted

  @Column({ type: 'boolean', default: true })
  isReusable: boolean; // Can be assigned to multiple roles/users

  // Usage tracking
  @Column({ type: 'int', default: 0 })
  usageCount: number; // Number of times this set has been assigned

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date; // When this set was last assigned

  // Approval and workflow
  @Column({ type: 'boolean', default: false })
  requiresApproval: boolean; // Assignment requires approval

  @Column({ type: 'uuid', name: 'approval_role_id', nullable: true })
  approvalRoleId?: string; // Role that can approve assignments

  @Column({ type: 'int', nullable: true })
  approvalTimeout?: number; // Hours until auto-approval

  // Context and restrictions
  @Column({ type: 'varchar', length: 100, nullable: true })
  departmentCode?: string; // Associated department

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string; // Geographic restriction

  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    timeRestriction?: {
      validFrom?: string;
      validUntil?: string;
      allowedHours?: Record<string, { start: string; end: string; }>;
    };
    ipRestriction?: {
      allowedIps?: string[];
      blockedIps?: string[];
    };
    resourceRestriction?: {
      allowedResources?: string[];
      maxRecords?: number;
    };
  };

  // Inheritance and composition
  @Column({ type: 'uuid', name: 'inherits_from_id', nullable: true })
  inheritsFromId?: string; // Base permission set to inherit from

  @Column({ type: 'jsonb', nullable: true })
  inheritedPermissions?: string[]; // Cached inherited permission IDs

  @Column({ type: 'jsonb', nullable: true })
  overriddenPermissions?: string[]; // Permissions that override inherited ones

  // Metadata and tags
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[]; // Searchable tags

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Additional metadata

  // Version control
  @Column({ type: 'varchar', length: 20, default: '1.0.0' })
  version: string;

  @Column({ type: 'uuid', name: 'previous_version_id', nullable: true })
  previousVersionId?: string; // Reference to previous version

  @Column({ type: 'text', nullable: true })
  changelog?: string; // Changes made in this version

  // Compliance and audit
  @Column({ type: 'boolean', default: false })
  isComplianceRequired: boolean; // Requires compliance review

  @Column({ type: 'timestamp', nullable: true })
  lastReviewedAt?: Date;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  nextReviewDate?: Date;

  // Computed properties
  get isActive(): boolean {
    return this.status === PermissionSetStatus.ACTIVE && !this.isDeleted;
  }

  get isSystemProtected(): boolean {
    return this.type === PermissionSetType.SYSTEM || this.isSystemDefined;
  }

  get canBeDeleted(): boolean {
    return !this.isSystemProtected && this.usageCount === 0;
  }

  get canBeModified(): boolean {
    return !this.isSystemProtected;
  }

  get permissionCount(): number {
    return this.permissions?.length || 0;
  }

  get isExpired(): boolean {
    if (!this.conditions?.timeRestriction?.validUntil) return false;
    return new Date() > new Date(this.conditions.timeRestriction.validUntil);
  }

  get isValidNow(): boolean {
    if (this.isExpired) return false;
    
    const validFrom = this.conditions?.timeRestriction?.validFrom;
    if (validFrom && new Date() < new Date(validFrom)) return false;
    
    return this.isActive;
  }

  // Methods
  addPermission(permission: Permission): void {
    if (!this.permissions) this.permissions = [];
    
    const exists = this.permissions.some(p => p.id === permission.id);
    if (!exists) {
      this.permissions.push(permission);
    }
  }

  removePermission(permissionId: string): void {
    if (!this.permissions) return;
    
    this.permissions = this.permissions.filter(p => p.id !== permissionId);
  }

  hasPermission(permissionId: string): boolean {
    if (!this.permissions) return false;
    
    return this.permissions.some(p => p.id === permissionId);
  }

  hasPermissionByKey(resource: string, action: string): boolean {
    if (!this.permissions) return false;
    
    return this.permissions.some(p => p.resource === resource && p.action === action);
  }

  getPermissionKeys(): string[] {
    if (!this.permissions) return [];
    
    return this.permissions.map(p => `${p.resource}:${p.action}`);
  }

  // Clone this permission set
  clone(newCode: string, newName: string): Partial<PermissionSet> {
    return {
      code: newCode,
      name: newName,
      description: `Cloned from ${this.name}`,
      type: PermissionSetType.CUSTOM,
      status: PermissionSetStatus.DRAFT,
      scope: this.scope,
      category: this.category,
      subcategory: this.subcategory,
      permissions: this.permissions,
      conditions: this.conditions,
      metadata: { ...this.metadata, clonedFrom: this.id },
      version: '1.0.0',
    };
  }

  // Update usage tracking
  recordUsage(): void {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
  }

  // Check if current time is within allowed hours
  isWithinAllowedHours(): boolean {
    const allowedHours = this.conditions?.timeRestriction?.allowedHours;
    if (!allowedHours) return true;
    
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
    const schedule = allowedHours[dayOfWeek];
    
    if (!schedule) return false;
    
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    return currentTime >= schedule.start && currentTime <= schedule.end;
  }

  // Check IP restriction
  isIpAllowed(ip: string): boolean {
    const ipRestriction = this.conditions?.ipRestriction;
    if (!ipRestriction) return true;
    
    if (ipRestriction.blockedIps?.includes(ip)) return false;
    if (ipRestriction.allowedIps?.length && !ipRestriction.allowedIps.includes(ip)) return false;
    
    return true;
  }
}