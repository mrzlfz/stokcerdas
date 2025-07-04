import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Channel } from './channel.entity';

export enum MappingType {
  PRODUCT = 'product',
  CATEGORY = 'category',
  ATTRIBUTE = 'attribute',
  ORDER_STATUS = 'order_status',
  PAYMENT_METHOD = 'payment_method',
  SHIPPING_METHOD = 'shipping_method',
  CUSTOMER = 'customer',
  LOCATION = 'location',
}

export enum MappingDirection {
  BIDIRECTIONAL = 'bidirectional',
  IMPORT_ONLY = 'import_only',
  EXPORT_ONLY = 'export_only',
}

@Entity('channel_mappings')
@Index(['tenantId', 'channelId', 'mappingType'])
@Index(['tenantId', 'channelId', 'internalId'], { unique: true })
@Index(['tenantId', 'channelId', 'externalId'], { unique: true })
export class ChannelMapping extends BaseEntity {
  @Column({ type: 'uuid' })
  channelId: string;

  @Column({
    type: 'enum',
    enum: MappingType,
  })
  mappingType: MappingType;

  @Column({
    type: 'enum',
    enum: MappingDirection,
    default: MappingDirection.BIDIRECTIONAL,
  })
  direction: MappingDirection;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entityType?: string;

  // Internal system reference
  @Column({ type: 'varchar', length: 255 })
  internalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  internalValue?: string;

  @Column({ type: 'jsonb', nullable: true })
  internalData?: Record<string, any>;

  // External platform reference
  @Column({ type: 'varchar', length: 255 })
  externalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalValue?: string;

  @Column({ type: 'jsonb', nullable: true })
  externalData?: Record<string, any>;

  // Mapping configuration
  @Column({ type: 'jsonb', nullable: true })
  mappingRules?: {
    // Field transformations
    fieldMappings?: Record<string, string>;

    // Value transformations
    valueTransformations?: Array<{
      field: string;
      type: 'format' | 'calculate' | 'lookup' | 'conditional';
      rules: Record<string, any>;
    }>;

    // Validation rules
    validations?: Array<{
      field: string;
      type: 'required' | 'format' | 'range' | 'custom';
      rules: Record<string, any>;
    }>;

    // Sync preferences
    syncPreferences?: {
      priority: 'internal' | 'external' | 'latest';
      conflictResolution: 'manual' | 'auto_internal' | 'auto_external';
      autoCreate: boolean;
      autoUpdate: boolean;
    };
  };

  // Status tracking
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean; // Whether the mapping has been verified to work

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastVerifiedAt?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  syncStatus?: 'pending' | 'synced' | 'failed' | 'conflict' | 'skipped';

  @Column({ type: 'text', nullable: true })
  syncError?: string;

  @Column({ type: 'integer', default: 0 })
  syncCount: number;

  @Column({ type: 'integer', default: 0 })
  errorCount: number;

  // Change tracking
  @Column({ type: 'timestamp', nullable: true })
  internalLastModified?: Date;

  @Column({ type: 'timestamp', nullable: true })
  externalLastModified?: Date;

  @Column({ type: 'jsonb', nullable: true })
  changeLog?: Array<{
    timestamp: string;
    type: 'created' | 'updated' | 'deleted' | 'synced';
    source: 'internal' | 'external' | 'system';
    changes: Record<string, any>;
    userId?: string;
  }>;

  // Metadata
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'integer', default: 0 })
  priority: number; // For conflict resolution

  // Performance metrics
  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    syncSuccessRate?: number;
    averageSyncTime?: number; // milliseconds
    lastSyncDuration?: number;
    dataIntegrityScore?: number; // 0-100
    usageCount?: number;
  };

  // Relations
  @ManyToOne(() => Channel, channel => channel.mappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  // Virtual fields
  get hasConflict(): boolean {
    return this.syncStatus === 'conflict';
  }

  get needsSync(): boolean {
    if (!this.isActive) return false;

    const lastSync = this.lastSyncAt;
    const internalModified = this.internalLastModified;
    const externalModified = this.externalLastModified;

    if (!lastSync) return true;

    if (internalModified && internalModified > lastSync) return true;
    if (externalModified && externalModified > lastSync) return true;

    return false;
  }

  get isStale(): boolean {
    if (!this.lastSyncAt) return true;

    const hoursSinceSync =
      (Date.now() - this.lastSyncAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24; // Consider stale after 24 hours
  }

  get syncSuccessRate(): number {
    if (this.syncCount === 0) return 0;
    return ((this.syncCount - this.errorCount) / this.syncCount) * 100;
  }

  // Methods
  updateInternalData(data: Record<string, any>, userId?: string): void {
    this.internalData = { ...this.internalData, ...data };
    this.internalLastModified = new Date();

    this.addToChangeLog({
      type: 'updated',
      source: 'internal',
      changes: data,
      userId,
    });
  }

  updateExternalData(data: Record<string, any>): void {
    this.externalData = { ...this.externalData, ...data };
    this.externalLastModified = new Date();

    this.addToChangeLog({
      type: 'updated',
      source: 'external',
      changes: data,
    });
  }

  recordSync(success: boolean, error?: string, duration?: number): void {
    this.lastSyncAt = new Date();
    this.syncCount += 1;

    if (success) {
      this.syncStatus = 'synced';
      this.syncError = null;
    } else {
      this.syncStatus = 'failed';
      this.syncError = error;
      this.errorCount += 1;
    }

    // Update metrics
    this.updateMetrics({ lastSyncDuration: duration });

    this.addToChangeLog({
      type: 'synced',
      source: 'system',
      changes: { success, error, duration },
    });
  }

  markConflict(conflictData: Record<string, any>): void {
    this.syncStatus = 'conflict';
    this.addToChangeLog({
      type: 'updated',
      source: 'system',
      changes: { conflict: conflictData },
    });
  }

  resolveConflict(
    resolution: 'internal' | 'external' | 'merge',
    mergeData?: Record<string, any>,
  ): void {
    switch (resolution) {
      case 'internal':
        // Keep internal data, update external
        break;
      case 'external':
        // Keep external data, update internal
        break;
      case 'merge':
        // Merge data from both sides
        if (mergeData) {
          this.internalData = { ...this.internalData, ...mergeData };
          this.externalData = { ...this.externalData, ...mergeData };
        }
        break;
    }

    this.syncStatus = 'synced';
    this.addToChangeLog({
      type: 'updated',
      source: 'system',
      changes: { conflictResolution: resolution, mergeData },
    });
  }

  verify(): boolean {
    // Implement verification logic based on mapping type
    const isValid = this.validateMapping();

    if (isValid) {
      this.isVerified = true;
      this.lastVerifiedAt = new Date();
    }

    return isValid;
  }

  private validateMapping(): boolean {
    // Basic validation - can be extended based on mapping type
    if (!this.internalId || !this.externalId) return false;
    if (!this.isActive) return false;

    // Type-specific validation
    switch (this.mappingType) {
      case MappingType.PRODUCT:
        return this.validateProductMapping();
      case MappingType.CATEGORY:
        return this.validateCategoryMapping();
      default:
        return true;
    }
  }

  private validateProductMapping(): boolean {
    // Product-specific validation logic
    return Boolean(this.internalData?.sku && this.externalData?.sku);
  }

  private validateCategoryMapping(): boolean {
    // Category-specific validation logic
    return Boolean(this.internalData?.name && this.externalData?.name);
  }

  private addToChangeLog(
    entry: Omit<ChannelMapping['changeLog'][0], 'timestamp'>,
  ): void {
    if (!this.changeLog) this.changeLog = [];

    this.changeLog.push({
      timestamp: new Date().toISOString(),
      ...entry,
    });

    // Keep only last 50 entries
    if (this.changeLog.length > 50) {
      this.changeLog = this.changeLog.slice(-50);
    }
  }

  private updateMetrics(newMetrics: Partial<ChannelMapping['metrics']>): void {
    this.metrics = {
      ...this.metrics,
      ...newMetrics,
    };

    // Calculate success rate
    if (this.syncCount > 0) {
      this.metrics.syncSuccessRate = this.syncSuccessRate;
    }
  }

  // Static helper methods
  static createProductMapping(
    channelId: string,
    internalProductId: string,
    externalProductId: string,
    productData?: Record<string, any>,
  ): Partial<ChannelMapping> {
    return {
      channelId,
      mappingType: MappingType.PRODUCT,
      direction: MappingDirection.BIDIRECTIONAL,
      internalId: internalProductId,
      externalId: externalProductId,
      internalData: productData?.internal,
      externalData: productData?.external,
      isActive: true,
    };
  }

  static createCategoryMapping(
    channelId: string,
    internalCategoryId: string,
    externalCategoryId: string,
    categoryData?: Record<string, any>,
  ): Partial<ChannelMapping> {
    return {
      channelId,
      mappingType: MappingType.CATEGORY,
      direction: MappingDirection.BIDIRECTIONAL,
      internalId: internalCategoryId,
      externalId: externalCategoryId,
      internalData: categoryData?.internal,
      externalData: categoryData?.external,
      isActive: true,
    };
  }
}
