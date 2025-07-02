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

export enum IntegrationLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum IntegrationLogType {
  API_REQUEST = 'api_request',
  API_RESPONSE = 'api_response',
  WEBHOOK = 'webhook',
  SYNC = 'sync',
  AUTH = 'auth',
  ERROR = 'error',
  SYSTEM = 'system',
}

@Entity('integration_logs')
@Index(['tenantId', 'channelId', 'createdAt'])
@Index(['tenantId', 'type', 'level'])
@Index(['requestId'])
export class IntegrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'channel_id', nullable: true })
  channelId?: string;

  @ManyToOne(() => Channel, { nullable: true })
  @JoinColumn({ name: 'channel_id' })
  channel?: Channel;

  @Column({
    type: 'enum',
    enum: IntegrationLogType,
    default: IntegrationLogType.SYSTEM,
  })
  type: IntegrationLogType;

  @Column({
    type: 'enum',
    enum: IntegrationLogLevel,
    default: IntegrationLogLevel.INFO,
  })
  level: IntegrationLogLevel;

  @Column({ name: 'request_id', nullable: true })
  @Index()
  requestId?: string;

  @Column({ length: 255 })
  message: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'http_method', length: 10, nullable: true })
  httpMethod?: string;

  @Column({ name: 'http_url', type: 'text', nullable: true })
  httpUrl?: string;

  @Column({ name: 'http_status', nullable: true })
  httpStatus?: number;

  @Column({ name: 'response_time_ms', nullable: true })
  responseTimeMs?: number;

  @Column({ name: 'error_code', length: 100, nullable: true })
  errorCode?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}