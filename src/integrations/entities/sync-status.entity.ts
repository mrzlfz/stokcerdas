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

export enum SyncEntityType {
  PRODUCT = 'product',
  INVENTORY = 'inventory',
  ORDER = 'order',
  CUSTOMER = 'customer',
  CATEGORY = 'category',
}

export enum SyncDirection {
  INBOUND = 'inbound', // From external platform to our system
  OUTBOUND = 'outbound', // From our system to external platform
  BIDIRECTIONAL = 'bidirectional',
}

export enum SyncStatusEnum {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
  QUEUED = 'queued',
}

export enum SyncTrigger {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  WEBHOOK = 'webhook',
  REAL_TIME = 'real_time',
  BATCH = 'batch',
  API_CHANGE = 'api_change',
}

@Entity('sync_status')
@Index(['tenantId', 'channelId', 'entityType'])
@Index(['tenantId', 'status', 'createdAt'])
@Index(['externalId', 'entityType'])
export class SyncStatus {
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
    enum: SyncEntityType,
    name: 'entity_type',
  })
  @Index()
  entityType: SyncEntityType;

  @Column({ name: 'entity_id' })
  @Index()
  entityId: string;

  @Column({ name: 'external_id', nullable: true })
  @Index()
  externalId?: string;

  @Column({
    type: 'enum',
    enum: SyncDirection,
    default: SyncDirection.BIDIRECTIONAL,
  })
  direction: SyncDirection;

  @Column({
    type: 'enum',
    enum: SyncStatusEnum,
    default: SyncStatusEnum.PENDING,
  })
  @Index()
  status: SyncStatusEnum;

  @Column({
    type: 'enum',
    enum: SyncTrigger,
    default: SyncTrigger.MANUAL,
  })
  trigger: SyncTrigger;

  @Column({ name: 'sync_batch_id', nullable: true })
  @Index()
  syncBatchId?: string;

  @Column({ name: 'total_records', default: 0 })
  totalRecords: number;

  @Column({ name: 'processed_records', default: 0 })
  processedRecords: number;

  @Column({ name: 'successful_records', default: 0 })
  successfulRecords: number;

  @Column({ name: 'failed_records', default: 0 })
  failedRecords: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ name: 'sync_metadata', type: 'jsonb', nullable: true })
  syncMetadata?: Record<string, any>;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'next_retry_at', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ name: 'priority', default: 5 })
  priority: number;

  @Column({
    name: 'progress_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  progressPercentage: number;

  @Column({ name: 'estimated_completion', nullable: true })
  estimatedCompletion?: Date;

  @Column({ name: 'processing_node', nullable: true })
  processingNode?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  get isCompleted(): boolean {
    return this.status === SyncStatusEnum.COMPLETED;
  }

  get isFailed(): boolean {
    return this.status === SyncStatusEnum.FAILED;
  }

  get isInProgress(): boolean {
    return this.status === SyncStatusEnum.IN_PROGRESS;
  }

  get successRate(): number {
    if (this.totalRecords === 0) return 0;
    return (this.successfulRecords / this.totalRecords) * 100;
  }

  updateProgress(processed: number, successful: number, failed: number): void {
    this.processedRecords = processed;
    this.successfulRecords = successful;
    this.failedRecords = failed;

    if (this.totalRecords > 0) {
      this.progressPercentage = (processed / this.totalRecords) * 100;
    }

    // Auto-update status based on progress
    if (processed === this.totalRecords) {
      if (failed === 0) {
        this.status = SyncStatusEnum.COMPLETED;
        this.completedAt = new Date();
      } else if (successful > 0) {
        this.status = SyncStatusEnum.PARTIAL;
        this.completedAt = new Date();
      } else {
        this.status = SyncStatusEnum.FAILED;
        this.completedAt = new Date();
      }
    }
  }
}
