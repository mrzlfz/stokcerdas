/**
 * Configuration Mapping Entity
 * Database storage for dynamic Indonesian configuration mappings
 * Supports runtime configuration updates and versioning
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ConfigurationType {
  BUSINESS_RULES = 'business_rules',
  PAYMENT_METHODS = 'payment_methods',
  GEOGRAPHY = 'geography',
  TELECOM_PROVIDERS = 'telecom_providers',
  BUSINESS_CALENDAR = 'business_calendar',
  SHIPPING_RATES = 'shipping_rates',
  LOYALTY_TIERS = 'loyalty_tiers',
  CULTURAL_SETTINGS = 'cultural_settings',
}

export enum ConfigurationScope {
  GLOBAL = 'global', // Applies to all tenants
  TENANT_SPECIFIC = 'tenant', // Specific to one tenant
  REGIONAL = 'regional', // Specific to Indonesian region
}

export enum ConfigurationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  DEPRECATED = 'deprecated',
}

@Entity('configuration_mappings')
@Index(['tenantId', 'type', 'scope', 'isActive'])
@Index(['type', 'key', 'scope'])
@Index(['tenantId', 'type', 'isActive'])
export class ConfigurationMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  @Index()
  tenantId?: string; // null for global configurations

  @Column({
    type: 'enum',
    enum: ConfigurationType,
    name: 'configuration_type',
  })
  @Index()
  type: ConfigurationType;

  @Column({ name: 'configuration_key' })
  @Index()
  key: string; // e.g., 'payment_methods.qris.transaction_fee'

  @Column({
    type: 'enum',
    enum: ConfigurationScope,
    default: ConfigurationScope.GLOBAL,
  })
  scope: ConfigurationScope;

  @Column({
    type: 'enum',
    enum: ConfigurationStatus,
    default: ConfigurationStatus.ACTIVE,
  })
  status: ConfigurationStatus;

  // Configuration value stored as JSONB for flexibility
  @Column({
    type: 'jsonb',
    name: 'configuration_value',
  })
  value: any;

  // Default/fallback value
  @Column({
    type: 'jsonb',
    name: 'default_value',
    nullable: true,
  })
  defaultValue?: any;

  // Configuration metadata
  @Column({
    type: 'jsonb',
    name: 'metadata',
    default: {},
  })
  metadata: {
    description?: string;
    category?: string;
    dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validationRules?: any;
    updateSource?: 'admin' | 'api' | 'system' | 'migration';
    regionalContext?: string; // e.g., 'DKI', 'JABAR'
    businessImpact?: 'low' | 'medium' | 'high' | 'critical';
    effectiveDate?: string;
    expirationDate?: string;
    approvalRequired?: boolean;
    lastApprovedBy?: string;
    tags?: string[];
  };

  // Versioning support
  @Column({ name: 'version', default: 1 })
  version: number;

  @Column({ name: 'previous_value', type: 'jsonb', nullable: true })
  previousValue?: any;

  @Column({ name: 'is_active', default: true })
  @Index()
  isActive: boolean;

  // Cache configuration
  @Column({ name: 'cache_ttl_seconds', default: 3600 })
  cacheTtl: number; // Cache time-to-live in seconds

  @Column({ name: 'cache_key', nullable: true })
  cacheKey?: string; // Custom cache key for this configuration

  // Regional and cultural context
  @Column({ name: 'region_code', nullable: true })
  regionCode?: string; // Indonesian region code (e.g., 'DKI', 'JABAR')

  @Column({ name: 'cultural_context', type: 'jsonb', default: {} })
  culturalContext: {
    language?: 'id' | 'en' | 'jv' | 'su'; // Indonesian, English, Javanese, Sundanese
    religiousContext?:
      | 'islamic'
      | 'christian'
      | 'hindu'
      | 'buddhist'
      | 'general';
    socialContext?: 'urban' | 'rural' | 'suburban';
    economicContext?: 'low' | 'medium' | 'high';
  };

  // Audit trail
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete support
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Configuration dependencies
  @Column({ name: 'depends_on', type: 'jsonb', default: [] })
  dependsOn: string[]; // Array of configuration keys this depends on

  @Column({ name: 'affects', type: 'jsonb', default: [] })
  affects: string[]; // Array of configuration keys affected by this

  // Performance and monitoring
  @Column({ name: 'usage_count', default: 0 })
  usageCount: number; // How many times this configuration has been accessed

  @Column({ name: 'last_accessed_at', nullable: true })
  lastAccessedAt?: Date;

  @Column({ name: 'error_count', default: 0 })
  errorCount: number; // Number of errors when using this configuration

  @Column({ name: 'last_error_at', nullable: true })
  lastErrorAt?: Date;

  @Column({ name: 'last_error_message', nullable: true })
  lastErrorMessage?: string;
}
