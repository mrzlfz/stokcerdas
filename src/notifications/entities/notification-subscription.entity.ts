import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { NotificationType } from './notification.entity';

@Entity('notification_subscriptions')
@Index(['tenantId', 'userId'])
@Index(['tenantId', 'eventType'])
export class NotificationSubscription extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'enum', enum: NotificationType })
  notificationType: NotificationType;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: Record<string, any>;
}
