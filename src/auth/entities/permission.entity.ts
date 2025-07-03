import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { RolePermission } from './role-permission.entity';

export enum PermissionResource {
  USERS = 'users',
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  REPORTS = 'reports',
  SETTINGS = 'settings',
  ANALYTICS = 'analytics',
  INTEGRATIONS = 'integrations',
  SUPPLIERS = 'suppliers',
  LOCATIONS = 'locations',
  TRANSACTIONS = 'transactions',
  PRIVACY = 'privacy',
  COMPLIANCE = 'compliance',
  AUDIT_LOGS = 'audit_logs',
}

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  IMPORT = 'import',
  APPROVE = 'approve',
  CANCEL = 'cancel',
  TRANSFER = 'transfer',
  ADJUST = 'adjust',
  VIEW_ALL = 'view_all', // View all tenants (super admin only)
  MANAGE_SYSTEM = 'manage_system', // System management (super admin only)
}

@Entity('permissions')
@Index(['resource', 'action'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PermissionResource,
  })
  resource: PermissionResource;

  @Column({
    type: 'enum',
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystemPermission: boolean; // For super admin only permissions

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission, {
    cascade: true,
  })
  @Exclude({ toPlainOnly: true })
  rolePermissions: RolePermission[];

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    name: 'updated_at',
  })
  updatedAt: Date;

  // Helper method to generate permission key
  get key(): string {
    return `${this.resource}:${this.action}`;
  }

  // Static method to get permission key
  static getKey(resource: PermissionResource, action: PermissionAction): string {
    return `${resource}:${action}`;
  }
}