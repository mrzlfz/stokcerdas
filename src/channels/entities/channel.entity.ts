import { Entity, Column, Index, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ChannelType {
  ONLINE_MARKETPLACE = 'online_marketplace',
  SOCIAL_COMMERCE = 'social_commerce',
  DIRECT_ONLINE = 'direct_online',
  OFFLINE_STORE = 'offline_store',
  WHOLESALE = 'wholesale',
  CUSTOM = 'custom',
}

export enum ChannelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SETUP_PENDING = 'setup_pending',
  SUSPENDED = 'suspended',
  ERROR = 'error',
}

export enum SyncStrategy {
  REAL_TIME = 'real_time',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
}

@Entity('channels')
@Index(['tenantId', 'channelType'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'platformId'], { unique: true, where: 'platformId IS NOT NULL' })
export class Channel extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ChannelType,
  })
  channelType: ChannelType;

  @Column({
    type: 'enum',
    enum: ChannelStatus,
    default: ChannelStatus.SETUP_PENDING,
  })
  status: ChannelStatus;

  // Platform-specific information
  @Column({ type: 'varchar', length: 50 })
  platformId: string; // 'shopee', 'tokopedia', 'lazada', etc.

  @Column({ type: 'varchar', length: 100 })
  platformName: string; // Display name: 'Shopee', 'Tokopedia', 'Lazada'

  @Column({ type: 'varchar', length: 255, nullable: true })
  platformUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  storeName?: string; // Store name on the platform

  @Column({ type: 'varchar', length: 100, nullable: true })
  storeId?: string; // Store ID on the platform

  // Sync configuration
  @Column({
    type: 'enum',
    enum: SyncStrategy,
    default: SyncStrategy.SCHEDULED,
  })
  syncStrategy: SyncStrategy;

  @Column({ type: 'varchar', length: 50, nullable: true })
  syncFrequency?: string; // Cron expression for scheduled sync

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextSyncAt?: Date;

  @Column({ type: 'boolean', default: true })
  autoSync: boolean;

  // API configuration (encrypted in production)
  @Column({ type: 'jsonb', nullable: true })
  apiCredentials?: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    sandbox?: boolean;
    expiresAt?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  apiConfig?: {
    baseUrl?: string;
    apiVersion?: string;
    rateLimit?: {
      requestsPerMinute: number;
      burstLimit: number;
    };
    timeout?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffStrategy: 'exponential' | 'linear';
    };
  };

  // Channel settings
  @Column({ type: 'jsonb', nullable: true })
  settings?: {
    // Inventory settings
    autoInventorySync?: boolean;
    inventoryBuffer?: number; // Percentage buffer for safety stock
    negativeStockHandling?: 'hide' | 'show_zero' | 'allow_backorder';
    
    // Order settings
    autoOrderImport?: boolean;
    orderStatusMapping?: Record<string, string>;
    paymentMethodMapping?: Record<string, string>;
    
    // Product settings
    autoProductSync?: boolean;
    priceMarkup?: number; // Percentage markup
    categoryMapping?: Record<string, string>;
    
    // Shipping settings
    shippingMethods?: Array<{
      id: string;
      name: string;
      cost: number;
      estimatedDays: number;
    }>;
    
    // Business rules
    businessRules?: {
      minOrderValue?: number;
      maxOrderValue?: number;
      allowedRegions?: string[];
      restrictedProducts?: string[];
    };
  };

  // Performance metrics
  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    totalOrders?: number;
    totalRevenue?: number;
    averageOrderValue?: number;
    conversionRate?: number;
    lastMonthOrders?: number;
    lastMonthRevenue?: number;
    syncSuccessRate?: number;
    errorCount?: number;
    responseTime?: number; // Average API response time in ms
  };

  // Status tracking
  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastErrorAt?: Date;

  @Column({ type: 'integer', default: 0 })
  consecutiveErrors: number;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  enabledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt?: Date;

  @Column({ type: 'text', nullable: true })
  disabledReason?: string;

  // Display and UI
  @Column({ type: 'varchar', length: 255, nullable: true })
  logo?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string; // Brand color for UI

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  // Relations
  @OneToOne('ChannelConfig', 'channel', { cascade: true })
  config?: any;

  @OneToMany('ChannelInventory', 'channel')
  inventoryAllocations?: any[];

  @OneToMany('ChannelMapping', 'channel')
  mappings?: any[];

  // Virtual fields
  get isActive(): boolean {
    return this.status === ChannelStatus.ACTIVE && this.isEnabled;
  }

  get isConnected(): boolean {
    return this.apiCredentials?.accessToken ? true : false;
  }

  get hasErrors(): boolean {
    return this.consecutiveErrors > 0;
  }

  get needsReconnection(): boolean {
    if (!this.apiCredentials?.expiresAt) return false;
    const expiryDate = new Date(this.apiCredentials.expiresAt);
    const now = new Date();
    return expiryDate <= now;
  }

  // Methods
  updateStatus(newStatus: ChannelStatus, reason?: string): void {
    this.status = newStatus;
    
    if (newStatus === ChannelStatus.ACTIVE) {
      this.enabledAt = new Date();
      this.disabledAt = null;
      this.disabledReason = null;
      this.consecutiveErrors = 0;
    } else if (newStatus === ChannelStatus.SUSPENDED || newStatus === ChannelStatus.ERROR) {
      this.disabledAt = new Date();
      this.disabledReason = reason;
    }
  }

  recordError(error: string): void {
    this.lastError = error;
    this.lastErrorAt = new Date();
    this.consecutiveErrors += 1;
    
    // Auto-suspend after 10 consecutive errors
    if (this.consecutiveErrors >= 10) {
      this.updateStatus(ChannelStatus.SUSPENDED, 'Too many consecutive errors');
    }
  }

  clearErrors(): void {
    this.lastError = null;
    this.lastErrorAt = null;
    this.consecutiveErrors = 0;
    
    if (this.status === ChannelStatus.ERROR) {
      this.updateStatus(ChannelStatus.ACTIVE);
    }
  }

  updateSyncTimestamp(): void {
    this.lastSyncAt = new Date();
    
    // Calculate next sync based on frequency
    if (this.syncFrequency && this.syncStrategy === SyncStrategy.SCHEDULED) {
      // This would use a cron parser to calculate next execution
      // For now, default to 1 hour
      this.nextSyncAt = new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  updateCredentials(credentials: Partial<Channel['apiCredentials']>): void {
    this.apiCredentials = {
      ...this.apiCredentials,
      ...credentials,
    };
    
    if (credentials.accessToken) {
      this.clearErrors();
      if (this.status === ChannelStatus.SETUP_PENDING) {
        this.updateStatus(ChannelStatus.ACTIVE);
      }
    }
  }

  updateMetrics(newMetrics: Partial<Channel['metrics']>): void {
    this.metrics = {
      ...this.metrics,
      ...newMetrics,
    };
  }
}

// Supporting entity for detailed channel configuration
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