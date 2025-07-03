import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { NotificationType } from './notification.entity';

@Entity('notification_templates')
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'type'])
export class NotificationTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  bodyTemplate: string;

  @Column({ type: 'jsonb', nullable: true })
  variables?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}