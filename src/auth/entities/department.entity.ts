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
import { Company } from './company.entity';

export enum DepartmentType {
  ROOT = 'root',           // Root organization
  DIVISION = 'division',   // Major divisions (Sales, Operations, Finance)
  DEPARTMENT = 'department', // Departments within divisions
  TEAM = 'team',          // Teams within departments
  GROUP = 'group',        // Small groups within teams
}

export enum DepartmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Entity('departments')
@Tree('closure-table')
@Index(['tenantId', 'isDeleted'])
@Index(['tenantId', 'code'], { unique: true, where: 'is_deleted = false' })
@Index(['tenantId', 'parentId'])
@Index(['tenantId', 'companyId'])
export class Department extends AuditableEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string; // Unique department code (e.g., 'SALES', 'IT', 'HR')

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Company relationship
  @Column({ type: 'uuid', name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, company => company.departments)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    type: 'enum',
    enum: DepartmentType,
    default: DepartmentType.DEPARTMENT,
  })
  type: DepartmentType;

  @Column({
    type: 'enum',
    enum: DepartmentStatus,
    default: DepartmentStatus.ACTIVE,
  })
  status: DepartmentStatus;

  // Hierarchical structure using closure table
  @TreeParent()
  parent?: Department;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  @Exclude({ toPlainOnly: true })
  parentId?: string;

  @TreeChildren()
  children: Department[];

  // Department hierarchy level (0 = root, 1 = division, etc.)
  @Column({ type: 'int', default: 0 })
  level: number;

  // Full hierarchy path (e.g., 'ROOT/SALES/REGIONAL')
  @Column({ type: 'varchar', length: 500, nullable: true })
  path?: string;

  // Department manager (User ID)
  @Column({ type: 'uuid', name: 'manager_id', nullable: true })
  managerId?: string;

  // Cost center for financial tracking
  @Column({ type: 'varchar', length: 50, nullable: true })
  costCenter?: string;

  // Budget allocation
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budgetLimit?: number;

  // Location information
  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  timezone?: string;

  // Contact information
  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber?: string;

  // Additional metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Business hours
  @Column({ type: 'jsonb', nullable: true })
  businessHours?: {
    monday?: { start: string; end: string; };
    tuesday?: { start: string; end: string; };
    wednesday?: { start: string; end: string; };
    thursday?: { start: string; end: string; };
    friday?: { start: string; end: string; };
    saturday?: { start: string; end: string; };
    sunday?: { start: string; end: string; };
  };

  // Methods
  get fullPath(): string {
    return this.path || this.code;
  }

  get isRoot(): boolean {
    return this.type === DepartmentType.ROOT;
  }

  get isActive(): boolean {
    return this.status === DepartmentStatus.ACTIVE && !this.isDeleted;
  }

  // Build department path
  buildPath(parentPath?: string): string {
    if (!parentPath || this.isRoot) {
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
}