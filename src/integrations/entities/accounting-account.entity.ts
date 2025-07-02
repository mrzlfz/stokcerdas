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

export enum AccountingPlatform {
  QUICKBOOKS = 'quickbooks',
  ACCURATE = 'accurate',
  XERO = 'xero',
  JURNAL = 'jurnal',
  KLEDO = 'kledo',
}

export enum AccountingConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export enum AccountingDataType {
  ITEM = 'item',
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  INVOICE = 'invoice',
  BILL = 'bill',
  PAYMENT = 'payment',
  JOURNAL_ENTRY = 'journal_entry',
  ACCOUNT = 'account',
  TAX_CODE = 'tax_code',
  PURCHASE_ORDER = 'purchase_order',
}

export enum SyncFrequency {
  REAL_TIME = 'real_time',
  EVERY_15_MINUTES = 'every_15_minutes',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MANUAL = 'manual',
}

@Entity('accounting_accounts')
@Index(['tenantId', 'platform'])
@Index(['tenantId', 'status'])
@Index(['companyId'])
export class AccountingAccount {
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
    enum: AccountingPlatform,
  })
  platform: AccountingPlatform;

  @Column({
    type: 'enum',
    enum: AccountingConnectionStatus,
    default: AccountingConnectionStatus.DISCONNECTED,
  })
  status: AccountingConnectionStatus;

  // QuickBooks/Accurate Company Information
  @Column({ name: 'company_id', nullable: true })
  @Index()
  companyId?: string;

  @Column({ name: 'company_name', length: 200, nullable: true })
  companyName?: string;

  @Column({ name: 'company_legal_name', length: 200, nullable: true })
  companyLegalName?: string;

  @Column({ name: 'company_country', length: 3, nullable: true })
  companyCountry?: string;

  @Column({ name: 'company_currency', length: 3, nullable: true })
  companyCurrency?: string;

  @Column({ name: 'fiscal_year_start_month', nullable: true })
  fiscalYearStartMonth?: number; // 1-12

  // Authentication credentials (encrypted)
  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken?: string;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ name: 'token_expires_at', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ name: 'client_id', length: 255, nullable: true })
  clientId?: string;

  @Column({ name: 'client_secret', type: 'text', nullable: true })
  clientSecret?: string;

  @Column({ name: 'api_base_url', type: 'text', nullable: true })
  apiBaseUrl?: string;

  @Column({ name: 'webhook_url', type: 'text', nullable: true })
  webhookUrl?: string;

  @Column({ name: 'webhook_secret', type: 'text', nullable: true })
  webhookSecret?: string;

  // Platform-specific configuration
  @Column({ type: 'jsonb', nullable: true })
  platformConfig?: {
    // QuickBooks specific
    realmId?: string;
    discoveryDocument?: string;
    environment?: 'sandbox' | 'production';
    
    // Accurate specific
    sessionId?: string;
    databaseId?: string;
    serverUrl?: string;
    
    // Common settings
    enabledDataTypes?: AccountingDataType[];
    syncSettings?: {
      [key in AccountingDataType]?: {
        enabled: boolean;
        frequency: SyncFrequency;
        direction: 'inbound' | 'outbound' | 'bidirectional';
        lastSync?: Date;
        nextSync?: Date;
      };
    };
  };

  // Sync configuration
  @Column({ name: 'auto_sync_enabled', default: true })
  autoSyncEnabled: boolean;

  @Column({
    type: 'enum',
    enum: SyncFrequency,
    default: SyncFrequency.HOURLY,
  })
  defaultSyncFrequency: SyncFrequency;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt?: Date;

  @Column({ name: 'next_sync_at', nullable: true })
  nextSyncAt?: Date;

  @Column({ name: 'sync_error_count', default: 0 })
  syncErrorCount: number;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError?: string;

  // Account mapping configuration
  @Column({ type: 'jsonb', nullable: true })
  accountMappings?: {
    // Chart of accounts mapping
    salesAccount?: string;
    cogsAccount?: string;
    inventoryAssetAccount?: string;
    receivablesAccount?: string;
    payablesAccount?: string;
    taxPayableAccount?: string;
    discountAccount?: string;
    shippingAccount?: string;
    
    // Default tax codes
    salesTaxCode?: string;
    purchaseTaxCode?: string;
    
    // Default payment terms
    defaultPaymentTerms?: string;
    
    // Custom mappings
    customMappings?: Record<string, string>;
  };

  // Indonesian tax and compliance settings
  @Column({ type: 'jsonb', nullable: true })
  indonesianSettings?: {
    npwp?: string; // Nomor Pokok Wajib Pajak
    nppkp?: string; // Nomor Pengukuhan Pengusaha Kena Pajak
    pkpStatus?: boolean; // Pengusaha Kena Pajak status
    vatRate?: number; // PPN rate (default 11%)
    enableEFaktur?: boolean;
    eFakturConfig?: {
      certificatePath?: string;
      certificatePassword?: string;
      counterNumber?: string;
    };
  };

  // Feature capabilities
  @Column({ type: 'jsonb', nullable: true })
  capabilities?: {
    supportsItems?: boolean;
    supportsInventory?: boolean;
    supportsInvoices?: boolean;
    supportsBills?: boolean;
    supportsPayments?: boolean;
    supportsJournalEntries?: boolean;
    supportsMultiCurrency?: boolean;
    supportsTaxes?: boolean;
    supportsCustomers?: boolean;
    supportsVendors?: boolean;
    supportsWebhooks?: boolean;
    supportsBatchOperations?: boolean;
    supportsAttachments?: boolean;
    supportsCustomFields?: boolean;
  };

  // Statistics and monitoring
  @Column({ type: 'jsonb', nullable: true })
  syncStatistics?: {
    totalSyncs?: number;
    successfulSyncs?: number;
    failedSyncs?: number;
    lastSyncDuration?: number; // in milliseconds
    averageSyncDuration?: number;
    
    byDataType?: {
      [key in AccountingDataType]?: {
        totalRecords?: number;
        syncedRecords?: number;
        failedRecords?: number;
        lastSyncAt?: Date;
      };
    };
  };

  @Column({ name: 'connection_health_score', type: 'decimal', precision: 3, scale: 2, default: 100 })
  connectionHealthScore: number; // 0-100

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'updated_by' })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper methods
  get isConnected(): boolean {
    return this.status === AccountingConnectionStatus.CONNECTED;
  }

  get isTokenExpired(): boolean {
    return this.tokenExpiresAt ? new Date() >= this.tokenExpiresAt : false;
  }

  get requiresReconnection(): boolean {
    return [
      AccountingConnectionStatus.DISCONNECTED,
      AccountingConnectionStatus.ERROR,
      AccountingConnectionStatus.EXPIRED,
    ].includes(this.status);
  }

  // Update connection status
  updateConnectionStatus(status: AccountingConnectionStatus, error?: string): void {
    this.status = status;
    if (error) {
      this.lastSyncError = error;
      this.syncErrorCount += 1;
    } else if (status === AccountingConnectionStatus.CONNECTED) {
      this.syncErrorCount = 0;
      this.lastSyncError = null;
    }
    this.updatedAt = new Date();
  }

  // Update tokens
  updateTokens(accessToken: string, refreshToken?: string, expiresIn?: number): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    if (expiresIn) {
      this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }
    this.status = AccountingConnectionStatus.CONNECTED;
    this.updatedAt = new Date();
  }

  // Update sync statistics
  updateSyncStats(dataType: AccountingDataType, success: boolean, duration?: number): void {
    if (!this.syncStatistics) {
      this.syncStatistics = {};
    }

    // Update overall stats
    this.syncStatistics.totalSyncs = (this.syncStatistics.totalSyncs || 0) + 1;
    if (success) {
      this.syncStatistics.successfulSyncs = (this.syncStatistics.successfulSyncs || 0) + 1;
    } else {
      this.syncStatistics.failedSyncs = (this.syncStatistics.failedSyncs || 0) + 1;
    }

    if (duration) {
      this.syncStatistics.lastSyncDuration = duration;
      const avgDuration = this.syncStatistics.averageSyncDuration || 0;
      this.syncStatistics.averageSyncDuration = 
        (avgDuration * (this.syncStatistics.totalSyncs - 1) + duration) / this.syncStatistics.totalSyncs;
    }

    // Update data type specific stats
    if (!this.syncStatistics.byDataType) {
      this.syncStatistics.byDataType = {} as any;
    }

    const dataTypeStats = this.syncStatistics.byDataType[dataType] || {};
    dataTypeStats.lastSyncAt = new Date();
    if (success) {
      dataTypeStats.syncedRecords = (dataTypeStats.syncedRecords || 0) + 1;
    } else {
      dataTypeStats.failedRecords = (dataTypeStats.failedRecords || 0) + 1;
    }

    this.syncStatistics.byDataType[dataType] = dataTypeStats;
    this.lastSyncAt = new Date();
  }

  // Calculate and update health score
  updateHealthScore(): void {
    let score = 100;

    // Deduct points for connection issues
    if (this.status !== AccountingConnectionStatus.CONNECTED) {
      score -= 50;
    }

    // Deduct points for sync errors
    if (this.syncErrorCount > 0) {
      score -= Math.min(this.syncErrorCount * 5, 30);
    }

    // Deduct points for expired tokens
    if (this.isTokenExpired) {
      score -= 20;
    }

    // Consider sync success rate
    if (this.syncStatistics?.totalSyncs > 0) {
      const successRate = (this.syncStatistics.successfulSyncs || 0) / this.syncStatistics.totalSyncs;
      score = score * successRate;
    }

    this.connectionHealthScore = Math.max(0, Math.min(100, score));
  }

  // Get sync configuration for a data type
  getSyncConfig(dataType: AccountingDataType): {
    enabled: boolean;
    frequency: SyncFrequency;
    direction: 'inbound' | 'outbound' | 'bidirectional';
    lastSync?: Date;
    nextSync?: Date;
  } {
    const defaultConfig = {
      enabled: true,
      frequency: this.defaultSyncFrequency,
      direction: 'bidirectional' as const,
    };

    return this.platformConfig?.syncSettings?.[dataType] || defaultConfig;
  }

  // Update sync configuration for a data type
  updateSyncConfig(
    dataType: AccountingDataType,
    config: Partial<{
      enabled: boolean;
      frequency: SyncFrequency;
      direction: 'inbound' | 'outbound' | 'bidirectional';
    }>,
  ): void {
    if (!this.platformConfig) {
      this.platformConfig = {};
    }
    if (!this.platformConfig.syncSettings) {
      this.platformConfig.syncSettings = {};
    }

    this.platformConfig.syncSettings[dataType] = {
      ...this.getSyncConfig(dataType),
      ...config,
    };

    this.updatedAt = new Date();
  }
}