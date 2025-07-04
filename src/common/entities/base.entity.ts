import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Exclude({ toPlainOnly: true }) // Hide tenant_id from API responses
  tenantId: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'created_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy?: string;

  @BeforeInsert()
  beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  beforeUpdate() {
    this.updatedAt = new Date();
  }
}

// Audit entity for tracking changes
export abstract class AuditableEntity extends BaseEntity {
  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  @Exclude({ toPlainOnly: true })
  isDeleted: boolean;

  @Column({
    type: 'timestamp with time zone',
    name: 'deleted_at',
    nullable: true,
  })
  @Exclude({ toPlainOnly: true })
  deletedAt?: Date;

  @Column({ type: 'uuid', name: 'deleted_by', nullable: true })
  @Exclude({ toPlainOnly: true })
  deletedBy?: string;

  softDelete(deletedBy?: string) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
  }

  restore() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
  }
}
