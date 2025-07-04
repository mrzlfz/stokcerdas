import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';

export enum WebhookEventType {
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_COMPLETED = 'order_completed',
  ORDER_REFUNDED = 'order_refunded',
  PRODUCT_CREATED = 'product_created',
  PRODUCT_UPDATED = 'product_updated',
  PRODUCT_DELETED = 'product_deleted',
  INVENTORY_UPDATED = 'inventory_updated',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  CUSTOMER_CREATED = 'customer_created',
  CUSTOMER_UPDATED = 'customer_updated',
  SHOP_UPDATED = 'shop_updated',
  SYSTEM_NOTIFICATION = 'system_notification',
}

export enum WebhookProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored',
  DUPLICATE = 'duplicate',
}

export enum WebhookPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5,
}

@Entity('webhook_events')
@Index(['tenantId', 'channelId', 'eventType'])
@Index(['tenantId', 'processingStatus', 'createdAt'])
@Index(['externalEventId', 'channelId'])
@Index(['processingStatus', 'priority', 'createdAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'channel_id' })
  channelId: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: WebhookEventType,
    name: 'event_type',
  })
  @Index()
  eventType: WebhookEventType;

  @Column({ name: 'external_event_id', nullable: true })
  @Index()
  externalEventId?: string;

  @Column({ name: 'event_source', length: 100 })
  eventSource: string; // e.g., 'shopee', 'lazada', 'tokopedia'

  @Column({
    type: 'enum',
    enum: WebhookProcessingStatus,
    name: 'processing_status',
    default: WebhookProcessingStatus.PENDING,
  })
  @Index()
  processingStatus: WebhookProcessingStatus;

  @Column({
    type: 'enum',
    enum: WebhookPriority,
    default: WebhookPriority.NORMAL,
  })
  @Index()
  priority: WebhookPriority;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, string>;

  @Column({ name: 'raw_payload', type: 'text', nullable: true })
  rawPayload?: string;

  @Column({ name: 'signature_header', type: 'text', nullable: true })
  signatureHeader?: string;

  @Column({ name: 'signature_verified', default: false })
  signatureVerified: boolean;

  @Column({ name: 'processing_attempts', default: 0 })
  processingAttempts: number;

  @Column({ name: 'max_attempts', default: 5 })
  maxAttempts: number;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError?: string;

  @Column({ name: 'processing_details', type: 'jsonb', nullable: true })
  processingDetails?: Record<string, any>;

  @Column({ name: 'processed_at', nullable: true })
  processedAt?: Date;

  @Column({ name: 'next_retry_at', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'related_entity_type', length: 50, nullable: true })
  relatedEntityType?: string; // e.g., 'order', 'product', 'inventory'

  @Column({ name: 'related_entity_id', nullable: true })
  relatedEntityId?: string;

  @Column({ name: 'external_entity_id', nullable: true })
  externalEntityId?: string;

  @Column({ name: 'webhook_url', type: 'text', nullable: true })
  webhookUrl?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'event_timestamp', nullable: true })
  eventTimestamp?: Date;

  @Column({ name: 'processing_duration_ms', nullable: true })
  processingDurationMs?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  get canRetry(): boolean {
    return (
      this.processingAttempts < this.maxAttempts &&
      this.processingStatus === WebhookProcessingStatus.FAILED
    );
  }

  get isProcessed(): boolean {
    return this.processingStatus === WebhookProcessingStatus.PROCESSED;
  }

  get isFailed(): boolean {
    return this.processingStatus === WebhookProcessingStatus.FAILED;
  }

  get isPending(): boolean {
    return this.processingStatus === WebhookProcessingStatus.PENDING;
  }

  markAsProcessing(): void {
    this.processingStatus = WebhookProcessingStatus.PROCESSING;
    this.processingAttempts += 1;
  }

  markAsProcessed(processingDetails?: Record<string, any>): void {
    this.processingStatus = WebhookProcessingStatus.PROCESSED;
    this.processedAt = new Date();
    this.processingDetails = processingDetails;
  }

  markAsFailed(error: string, nextRetryAt?: Date): void {
    this.processingStatus = WebhookProcessingStatus.FAILED;
    this.processingError = error;
    this.nextRetryAt = nextRetryAt;
  }

  markAsIgnored(reason?: string): void {
    this.processingStatus = WebhookProcessingStatus.IGNORED;
    this.processingError = reason;
    this.processedAt = new Date();
  }

  markAsDuplicate(): void {
    this.processingStatus = WebhookProcessingStatus.DUPLICATE;
    this.processedAt = new Date();
  }

  calculateNextRetryTime(baseDelayMs: number = 5000): Date {
    const backoffMultiplier = Math.pow(2, this.processingAttempts - 1);
    const delayMs = Math.min(baseDelayMs * backoffMultiplier, 300000); // Max 5 minutes
    return new Date(Date.now() + delayMs);
  }
}
