import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Channel } from './channel.entity';

@Entity('channel_configs')
export class ChannelConfig extends BaseEntity {
  @Column({ type: 'uuid' })
  channelId: string;

  // Webhook configuration
  @Column({ type: 'jsonb', nullable: true })
  webhookConfig?: {
    url?: string;
    secret?: string;
    events?: string[];
    isActive?: boolean;
    lastDelivery?: string;
    deliveryCount?: number;
    failureCount?: number;
  };

  // Sync configuration
  @Column({ type: 'jsonb', nullable: true })
  syncConfig?: {
    batchSize?: number;
    concurrency?: number;
    conflictResolution?: 'local_wins' | 'remote_wins' | 'manual';
    fieldMappings?: Record<string, string>;
    transformations?: Array<{
      field: string;
      type: 'format' | 'calculate' | 'lookup';
      rules: Record<string, any>;
    }>;
  };

  // Notification settings
  @Column({ type: 'jsonb', nullable: true })
  notificationConfig?: {
    email?: {
      enabled: boolean;
      events: string[];
      recipients: string[];
    };
    webhook?: {
      enabled: boolean;
      url: string;
      events: string[];
    };
    inApp?: {
      enabled: boolean;
      events: string[];
    };
  };

  // Advanced settings
  @Column({ type: 'jsonb', nullable: true })
  advancedSettings?: {
    customHeaders?: Record<string, string>;
    proxy?: {
      host: string;
      port: number;
      username?: string;
      password?: string;
    };
    ssl?: {
      verify: boolean;
      cert?: string;
      key?: string;
    };
    logging?: {
      level: 'debug' | 'info' | 'warn' | 'error';
      retention: number; // days
    };
  };

  @OneToOne(() => Channel, channel => channel.config, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;
}
