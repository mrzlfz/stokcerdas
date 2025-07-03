import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

// Entities
import { Channel, ChannelStatus } from '../entities/channel.entity';
import { ChannelInventory } from '../entities/channel-inventory.entity';
import { ChannelMapping, MappingType } from '../entities/channel-mapping.entity';

// Services
import { ChannelsService } from './channels.service';
import { ChannelInventoryService } from './channel-inventory.service';
import { ChannelMappingService } from './channel-mapping.service';

// Integration services
import { ShopeeProductService } from '../../integrations/shopee/services/shopee-product.service';
import { ShopeeOrderService } from '../../integrations/shopee/services/shopee-order.service';
import { ShopeeInventoryService } from '../../integrations/shopee/services/shopee-inventory.service';
import { LazadaProductService } from '../../integrations/lazada/services/lazada-product.service';
import { LazadaOrderService } from '../../integrations/lazada/services/lazada-order.service';
import { LazadaInventoryService } from '../../integrations/lazada/services/lazada-inventory.service';
import { TokopediaProductService } from '../../integrations/tokopedia/services/tokopedia-product.service';
import { TokopediaOrderService } from '../../integrations/tokopedia/services/tokopedia-order.service';
import { TokopediaInventoryService } from '../../integrations/tokopedia/services/tokopedia-inventory.service';

// Common services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../integrations/entities/integration-log.entity';

export interface SyncRequest {
  channelIds?: string[];
  syncTypes: SyncType[];
  direction: 'inbound' | 'outbound' | 'bidirectional';
  priority?: 'high' | 'normal' | 'low';
  scheduleAt?: Date;
  options?: {
    forceSync?: boolean;
    batchSize?: number;
    dryRun?: boolean;
    filters?: Record<string, any>;
  };
}

export enum SyncType {
  PRODUCTS = 'products',
  CATEGORIES = 'categories',
  INVENTORY = 'inventory',
  ORDERS = 'orders',
  CUSTOMERS = 'customers',
  ALL = 'all',
}

export interface SyncResult {
  success: boolean;
  syncId: string;
  channelId: string;
  channelName: string;
  syncType: SyncType;
  direction: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  summary: {
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    errors: number;
  };
  details?: Array<{
    itemId: string;
    itemType: string;
    action: 'created' | 'updated' | 'deleted' | 'skipped' | 'error';
    error?: string;
  }>;
  errors?: string[];
  warnings?: string[];
}

export interface CrossChannelSyncRequest {
  syncTypes: SyncType[];
  sourceChannelId?: string;
  targetChannelIds?: string[];
  syncRules?: {
    priorityOrder?: string[];
    conflictResolution?: 'source_wins' | 'target_wins' | 'merge' | 'manual';
    skipDuplicates?: boolean;
  };
}

export interface CrossChannelSyncResult {
  success: boolean;
  syncId: string;
  startTime: Date;
  endTime?: Date;
  channelResults: SyncResult[];
  summary: {
    totalChannels: number;
    successfulChannels: number;
    failedChannels: number;
    totalItems: number;
    totalErrors: number;
  };
}

export interface SyncStatus {
  syncId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number;
  startTime: Date;
  lastUpdate: Date;
  channelStatuses?: Array<{
    channelId: string;
    status: string;
    progress: number;
    itemsProcessed: number;
    errors: number;
  }>;
}

export interface SyncSchedule {
  id: string;
  tenantId: string;
  channelIds: string[];
  syncTypes: SyncType[];
  direction: string;
  cronExpression: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  options?: any;
}

@Injectable()
export class ChannelSyncService {
  private readonly logger = new Logger(ChannelSyncService.name);
  private activeSyncs = new Map<string, SyncStatus>();

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelInventory)
    private readonly inventoryRepository: Repository<ChannelInventory>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,

    @InjectQueue('channel-sync')
    private readonly syncQueue: Queue,

    // Channel services
    private readonly channelsService: ChannelsService,
    private readonly inventoryService: ChannelInventoryService,
    private readonly mappingService: ChannelMappingService,

    // Shopee services
    private readonly shopeeProductService: ShopeeProductService,
    private readonly shopeeOrderService: ShopeeOrderService,
    private readonly shopeeInventoryService: ShopeeInventoryService,

    // Lazada services
    private readonly lazadaProductService: LazadaProductService,
    private readonly lazadaOrderService: LazadaOrderService,
    private readonly lazadaInventoryService: LazadaInventoryService,

    // Tokopedia services
    private readonly tokopediaProductService: TokopediaProductService,
    private readonly tokopediaOrderService: TokopediaOrderService,
    private readonly tokopediaInventoryService: TokopediaInventoryService,

    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start synchronization for specified channels
   */
  async startSync(tenantId: string, request: SyncRequest): Promise<string> {
    try {
      const syncId = this.generateSyncId();
      
      this.logger.debug(`Starting sync ${syncId} for tenant ${tenantId}`, { request });

      // Get channels to sync
      const channels = await this.getChannelsForSync(tenantId, request.channelIds);
      if (channels.length === 0) {
        throw new BadRequestException('No active channels found for sync');
      }

      // Create sync status
      const syncStatus: SyncStatus = {
        syncId,
        status: 'pending',
        progress: 0,
        currentStep: 'Initializing',
        startTime: new Date(),
        lastUpdate: new Date(),
        channelStatuses: channels.map(channel => ({
          channelId: channel.id,
          status: 'pending',
          progress: 0,
          itemsProcessed: 0,
          errors: 0,
        })),
      };

      this.activeSyncs.set(syncId, syncStatus);

      // Schedule sync jobs
      if (request.scheduleAt && request.scheduleAt > new Date()) {
        // Schedule for later
        await this.scheduleSyncJobs(syncId, tenantId, channels, request);
      } else {
        // Start immediately
        await this.executeSyncJobs(syncId, tenantId, channels, request);
      }

      // Log sync start
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYNC,
        level: IntegrationLogLevel.INFO,
        message: `Sync started: ${syncId}`,
        metadata: {
          syncId,
          channelIds: request.channelIds,
          syncTypes: request.syncTypes,
          direction: request.direction,
          channelsCount: channels.length,
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.sync.started', {
        tenantId,
        syncId,
        channels: channels.map(c => c.id),
        request,
      });

      return syncId;

    } catch (error) {
      this.logger.error(`Failed to start sync: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'start_sync', request },
      });
      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(syncId: string): Promise<SyncStatus | null> {
    return this.activeSyncs.get(syncId) || null;
  }

  /**
   * Cancel an active sync
   */
  async cancelSync(tenantId: string, syncId: string): Promise<void> {
    try {
      const syncStatus = this.activeSyncs.get(syncId);
      if (!syncStatus) {
        throw new NotFoundException(`Sync ${syncId} not found`);
      }

      if (syncStatus.status === 'completed' || syncStatus.status === 'failed') {
        throw new BadRequestException(`Sync ${syncId} cannot be cancelled (status: ${syncStatus.status})`);
      }

      // Update status
      syncStatus.status = 'cancelled';
      syncStatus.lastUpdate = new Date();
      this.activeSyncs.set(syncId, syncStatus);

      // Cancel queue jobs
      const jobs = await this.syncQueue.getJobs(['waiting', 'active', 'delayed']);
      const syncJobs = jobs.filter(job => job.data.syncId === syncId);
      
      for (const job of syncJobs) {
        await job.remove();
      }

      // Log cancellation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYNC,
        level: IntegrationLogLevel.INFO,
        message: `Sync cancelled: ${syncId}`,
        metadata: { syncId },
      });

      // Emit event
      this.eventEmitter.emit('channel.sync.cancelled', {
        tenantId,
        syncId,
      });

    } catch (error) {
      this.logger.error(`Failed to cancel sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cross-channel synchronization
   */
  async startCrossChannelSync(
    tenantId: string,
    request: CrossChannelSyncRequest,
  ): Promise<string> {
    try {
      const syncId = this.generateSyncId();
      
      this.logger.debug(`Starting cross-channel sync ${syncId}`, { request });

      // Get source and target channels
      const sourceChannel = request.sourceChannelId
        ? await this.channelsService.getChannelById(tenantId, request.sourceChannelId)
        : null;

      const targetChannels = request.targetChannelIds
        ? await this.getChannelsByIds(tenantId, request.targetChannelIds)
        : await this.channelsService.getActiveChannels(tenantId);

      if (targetChannels.length === 0) {
        throw new BadRequestException('No target channels found for cross-channel sync');
      }

      // Create cross-channel sync job
      await this.syncQueue.add('cross-channel-sync', {
        syncId,
        tenantId,
        sourceChannel,
        targetChannels,
        request,
      }, {
        priority: request.syncRules?.priorityOrder ? 10 : 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      // Log start
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYNC,
        level: IntegrationLogLevel.INFO,
        message: `Cross-channel sync started: ${syncId}`,
        metadata: {
          syncId,
          sourceChannelId: request.sourceChannelId,
          targetChannelIds: request.targetChannelIds,
          syncTypes: request.syncTypes,
        },
      });

      return syncId;

    } catch (error) {
      this.logger.error(`Failed to start cross-channel sync: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Sync single channel
   */
  async syncChannel(
    tenantId: string,
    channelId: string,
    syncType: SyncType,
    direction: 'inbound' | 'outbound' | 'bidirectional',
    options: any = {},
  ): Promise<SyncResult> {
    try {
      const channel = await this.channelsService.getChannelById(tenantId, channelId);
      const syncId = this.generateSyncId();

      this.logger.debug(`Syncing channel ${channelId} (${syncType})`, { direction, options });

      const result: SyncResult = {
        success: true,
        syncId,
        channelId,
        channelName: channel.name,
        syncType,
        direction,
        startTime: new Date(),
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        summary: {
          created: 0,
          updated: 0,
          deleted: 0,
          skipped: 0,
          errors: 0,
        },
        details: [],
        errors: [],
        warnings: [],
      };

      // Perform sync based on platform and type
      const platformId = channel.platformId.toLowerCase();
      
      switch (syncType) {
        case SyncType.PRODUCTS:
          await this.syncProducts(tenantId, channel, direction, result, options);
          break;

        case SyncType.INVENTORY:
          await this.syncInventory(tenantId, channel, direction, result, options);
          break;

        case SyncType.ORDERS:
          await this.syncOrders(tenantId, channel, direction, result, options);
          break;

        case SyncType.CATEGORIES:
          await this.syncCategories(tenantId, channel, direction, result, options);
          break;

        case SyncType.ALL:
          await this.syncProducts(tenantId, channel, direction, result, options);
          await this.syncInventory(tenantId, channel, direction, result, options);
          await this.syncOrders(tenantId, channel, direction, result, options);
          break;

        default:
          throw new BadRequestException(`Sync type ${syncType} is not supported`);
      }

      // Finalize result
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.success = result.itemsFailed === 0;

      // Update channel sync timestamp
      await this.channelsService.updateSyncTimestamp(tenantId, channelId);

      // Log completion
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYNC,
        level: result.success ? IntegrationLogLevel.INFO : IntegrationLogLevel.WARN,
        message: `Channel sync completed: ${result.itemsSucceeded}/${result.itemsProcessed} successful`,
        metadata: {
          syncId,
          syncType,
          direction,
          result: {
            success: result.success,
            duration: result.duration,
            itemsProcessed: result.itemsProcessed,
            summary: result.summary,
          },
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.sync.completed', {
        tenantId,
        channelId,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to sync channel: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'sync_channel', syncType, direction },
      });
      throw error;
    }
  }

  /**
   * Get sync history for a channel
   */
  async getSyncHistory(
    tenantId: string,
    channelId?: string,
    limit: number = 50,
  ): Promise<any[]> {
    try {
      // This would typically query a sync history table
      // For now, return recent sync logs
      const query = {
        tenantId,
        type: IntegrationLogType.SYNC,
        limit,
        orderBy: 'createdAt' as const,
        orderDirection: 'DESC' as const,
        ...(channelId && { channelId }),
      };

      const { logs } = await this.logService.queryLogs(query);
      
      return logs.map(log => ({
        syncId: log.metadata?.syncId || 'unknown',
        channelId: log.channelId,
        syncType: log.metadata?.syncType,
        direction: log.metadata?.direction,
        status: log.level === IntegrationLogLevel.ERROR ? 'failed' : 'completed',
        startTime: log.createdAt,
        duration: log.metadata?.result?.duration,
        itemsProcessed: log.metadata?.result?.itemsProcessed || 0,
        summary: log.metadata?.result?.summary || {},
        message: log.message,
      }));

    } catch (error) {
      this.logger.error(`Failed to get sync history: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getChannelsForSync(tenantId: string, channelIds?: string[]): Promise<Channel[]> {
    if (channelIds && channelIds.length > 0) {
      return this.channelRepository.find({
        where: {
          tenantId,
          id: In(channelIds),
          status: ChannelStatus.ACTIVE,
          isEnabled: true,
        },
        relations: ['config'],
      });
    }

    return this.channelRepository.find({
      where: {
        tenantId,
        status: ChannelStatus.ACTIVE,
        isEnabled: true,
        autoSync: true,
      },
      relations: ['config'],
    });
  }

  private async getChannelsByIds(tenantId: string, channelIds: string[]): Promise<Channel[]> {
    return this.channelRepository.find({
      where: {
        tenantId,
        id: In(channelIds),
        status: ChannelStatus.ACTIVE,
        isEnabled: true,
      },
      relations: ['config'],
    });
  }

  private async scheduleSyncJobs(
    syncId: string,
    tenantId: string,
    channels: Channel[],
    request: SyncRequest,
  ): Promise<void> {
    const delay = request.scheduleAt!.getTime() - Date.now();

    for (const channel of channels) {
      for (const syncType of request.syncTypes) {
        await this.syncQueue.add('channel-sync', {
          syncId,
          tenantId,
          channelId: channel.id,
          syncType,
          direction: request.direction,
          options: request.options,
        }, {
          delay,
          priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      }
    }
  }

  private async executeSyncJobs(
    syncId: string,
    tenantId: string,
    channels: Channel[],
    request: SyncRequest,
  ): Promise<void> {
    for (const channel of channels) {
      for (const syncType of request.syncTypes) {
        await this.syncQueue.add('channel-sync', {
          syncId,
          tenantId,
          channelId: channel.id,
          syncType,
          direction: request.direction,
          options: request.options,
        }, {
          priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      }
    }
  }

  private async syncProducts(
    tenantId: string,
    channel: Channel,
    direction: string,
    result: SyncResult,
    options: any,
  ): Promise<void> {
    const platformId = channel.platformId.toLowerCase();

    try {
      let syncResult;

      switch (platformId) {
        case 'shopee':
          if (direction === 'inbound' || direction === 'bidirectional') {
            syncResult = await this.shopeeProductService.syncProductsFromShopee(
              tenantId,
              channel.id,
              options,
            );
          }
          if (direction === 'outbound' || direction === 'bidirectional') {
            // Sync products to Shopee
          }
          break;

        case 'lazada':
          if (direction === 'inbound' || direction === 'bidirectional') {
            syncResult = await this.lazadaProductService.syncProductsFromLazada(
              tenantId,
              channel.id,
              options,
            );
          }
          break;

        case 'tokopedia':
          if (direction === 'inbound' || direction === 'bidirectional') {
            syncResult = await this.tokopediaProductService.syncProductsFromTokopedia(
              tenantId,
              channel.id,
              options,
            );
          }
          break;

        default:
          throw new Error(`Platform ${platformId} product sync not supported`);
      }

      if (syncResult) {
        this.updateSyncResult(result, syncResult);
      }

    } catch (error) {
      result.errors?.push(`Product sync failed: ${error.message}`);
      result.summary.errors++;
    }
  }

  private async syncInventory(
    tenantId: string,
    channel: Channel,
    direction: string,
    result: SyncResult,
    options: any,
  ): Promise<void> {
    try {
      const syncResult = await this.inventoryService.syncChannelInventory(tenantId, {
        channelId: channel.id,
        syncType: 'both',
        direction: direction as any,
      });

      if (syncResult) {
        result.itemsProcessed += syncResult.processedItems;
        result.itemsSucceeded += syncResult.successCount;
        result.itemsFailed += syncResult.errorCount;
        result.summary.updated += syncResult.successCount;
        result.summary.errors += syncResult.errorCount;
      }

    } catch (error) {
      result.errors?.push(`Inventory sync failed: ${error.message}`);
      result.summary.errors++;
    }
  }

  private async syncOrders(
    tenantId: string,
    channel: Channel,
    direction: string,
    result: SyncResult,
    options: any,
  ): Promise<void> {
    const platformId = channel.platformId.toLowerCase();

    try {
      let syncResult;

      switch (platformId) {
        case 'shopee':
          if (direction === 'inbound' || direction === 'bidirectional') {
            syncResult = await this.shopeeOrderService.syncOrdersFromShopee(
              tenantId,
              channel.id,
              options,
            );
          }
          break;

        case 'lazada':
          if (direction === 'inbound' || direction === 'bidirectional') {
            syncResult = await this.lazadaOrderService.syncOrdersFromLazada(
              tenantId,
              channel.id,
              options,
            );
          }
          break;

        case 'tokopedia':
          if (direction === 'inbound' || direction === 'bidirectional') {
            syncResult = await this.tokopediaOrderService.syncOrdersFromTokopedia(
              tenantId,
              channel.id,
              options,
            );
          }
          break;

        default:
          throw new Error(`Platform ${platformId} order sync not supported`);
      }

      if (syncResult) {
        this.updateSyncResult(result, syncResult);
      }

    } catch (error) {
      result.errors?.push(`Order sync failed: ${error.message}`);
      result.summary.errors++;
    }
  }

  private async syncCategories(
    tenantId: string,
    channel: Channel,
    direction: string,
    result: SyncResult,
    options: any,
  ): Promise<void> {
    try {
      // Get category mappings
      const { mappings } = await this.mappingService.getChannelMappings(tenantId, {
        channelId: channel.id,
        mappingType: MappingType.CATEGORY,
        isActive: true,
      });

      result.itemsProcessed += mappings.length;
      result.itemsSucceeded += mappings.length;
      result.summary.updated += mappings.length;

    } catch (error) {
      result.errors?.push(`Category sync failed: ${error.message}`);
      result.summary.errors++;
    }
  }

  private updateSyncResult(result: SyncResult, syncResult: any): void {
    if (syncResult.totalProcessed) {
      result.itemsProcessed += syncResult.totalProcessed;
    }
    if (syncResult.successCount) {
      result.itemsSucceeded += syncResult.successCount;
    }
    if (syncResult.errorCount) {
      result.itemsFailed += syncResult.errorCount;
    }
    if (syncResult.created) {
      result.summary.created += syncResult.created;
    }
    if (syncResult.updated) {
      result.summary.updated += syncResult.updated;
    }
    if (syncResult.skipped) {
      result.summary.skipped += syncResult.skipped;
    }
    if (syncResult.errors) {
      result.summary.errors += syncResult.errors;
    }
  }
}