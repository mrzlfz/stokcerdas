import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
@Index(['tenantId', 'userId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'type'])
export class Notification extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  priority: NotificationPriority;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientEmail?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  recipientPhone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientDeviceToken?: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  templateId?: string;

  @Column({ type: 'jsonb', nullable: true })
  templateVariables?: Record<string, any>;

  // Methods
  get isRead(): boolean {
    return this.status === NotificationStatus.READ;
  }

  get isSent(): boolean {
    return [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(this.status);
  }

  get canRetry(): boolean {
    return this.retryCount < this.maxRetries && this.status === NotificationStatus.FAILED;
  }

  markAsSent(): void {
    this.status = NotificationStatus.SENT;
    this.sentAt = new Date();
  }

  markAsDelivered(): void {
    this.status = NotificationStatus.DELIVERED;
    this.deliveredAt = new Date();
  }

  markAsRead(): void {
    this.status = NotificationStatus.READ;
    this.readAt = new Date();
  }

  markAsFailed(errorMessage: string): void {
    this.status = NotificationStatus.FAILED;
    this.errorMessage = errorMessage;
    this.retryCount++;
  }
}