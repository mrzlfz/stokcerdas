import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Services
import { ChannelSyncService, SyncType } from '../services/channel-sync.service';
import { ChannelsService } from '../services/channels.service';
import { ChannelInventoryService } from '../services/channel-inventory.service';
import { ChannelMappingService } from '../services/channel-mapping.service';

// Common services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';

// Job data interfaces
export interface ChannelSyncJobData {
  syncId: string;
  tenantId: string;
  channelId: string;
  syncType: SyncType;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  options?: {
    forceSync?: boolean;
    batchSize?: number;
    dryRun?: boolean;
    filters?: Record<string, any>;
  };
}

export interface CrossChannelSyncJobData {
  syncId: string;
  tenantId: string;
  sourceChannel?: any;
  targetChannels: any[];
  request: {
    syncTypes: SyncType[];
    syncRules?: {
      priorityOrder?: string[];
      conflictResolution?: 'source_wins' | 'target_wins' | 'merge' | 'manual';
      skipDuplicates?: boolean;
    };
  };
}

export interface ChannelHealthCheckJobData {
  tenantId: string;
  channelId: string;
  checkType: 'connection' | 'sync_status' | 'performance' | 'all';
}

export interface ChannelMaintenanceJobData {
  tenantId: string;
  channelId?: string;
  maintenanceType: 'cleanup' | 'rebalance' | 'reconcile' | 'optimize';
  options?: any;
}

export interface ScheduledSyncJobData {
  tenantId: string;
  scheduleId: string;
  channelIds: string[];
  syncTypes: SyncType[];
  direction: 'inbound' | 'outbound' | 'bidirectional';
  options?: any;
}

@Processor('channel-sync')
export class ChannelSyncProcessor {
  private readonly logger = new Logger(ChannelSyncProcessor.name);

  constructor(
    private readonly syncService: ChannelSyncService,
    private readonly channelsService: ChannelsService,
    private readonly inventoryService: ChannelInventoryService,
    private readonly mappingService: ChannelMappingService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing channel sync job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Channel sync job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Channel sync job failed: ${job.name} [${job.id}] - ${err.message}`, {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
      stack: err.stack,
      data: job.data,
      attemptsMade: job.attemptsMade,
      attemptsLeft: job.opts.attempts - job.attemptsMade,
    });
  }

  /**
   * Process single channel sync
   */
  @Process('channel-sync')
  async processChannelSync(job: Job<ChannelSyncJobData>) {
    const { syncId, tenantId, channelId, syncType, direction, options } = job.data;
    
    try {
      this.logger.debug(`Processing channel sync: ${syncType} for channel ${channelId}`, {
        syncId,
        tenantId,
        channelId,
        syncType,
        direction,
      });

      // Update sync status
      this.updateSyncProgress(syncId, channelId, 'running', 10, 'Starting sync');

      // Perform the sync
      const result = await this.syncService.syncChannel(
        tenantId,
        channelId,
        syncType,
        direction,
        options,
      );

      // Update sync status
      this.updateSyncProgress(syncId, channelId, 'completed', 100, 'Sync completed');

      // Log sync completion
      await this.logService.log({
        tenantId,
        channelId,
        type: 'SYNC',
        level: result.success ? 'INFO' : 'WARN',
        message: `Channel sync completed: ${syncType} (${direction})`,
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

      // Emit completion event
      this.eventEmitter.emit('channel.sync.job.completed', {
        tenantId,
        channelId,
        syncId,
        syncType,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Channel sync failed: ${error.message}`, error.stack);

      // Update sync status
      this.updateSyncProgress(syncId, channelId, 'failed', 0, `Sync failed: ${error.message}`);

      // Log sync error
      await this.logService.logSync(
        tenantId,
        channelId,
        `channel_sync_${syncType}`,
        'failed',
        `Channel sync failed: ${error.message}`,
        { syncId, syncType, direction, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process cross-channel synchronization
   */
  @Process('cross-channel-sync')
  async processCrossChannelSync(job: Job<CrossChannelSyncJobData>) {
    const { syncId, tenantId, sourceChannel, targetChannels, request } = job.data;
    
    try {
      this.logger.debug(`Processing cross-channel sync: ${syncId}`, {
        syncId,
        tenantId,
        sourceChannelId: sourceChannel?.id,
        targetChannelCount: targetChannels.length,
        syncTypes: request.syncTypes,
      });

      const result = {
        success: true,
        syncId,
        startTime: new Date(),
        channelResults: [],
        summary: {
          totalChannels: targetChannels.length,
          successfulChannels: 0,
          failedChannels: 0,
          totalItems: 0,
          totalErrors: 0,
        },
      };

      // Process each target channel
      for (const targetChannel of targetChannels) {
        try {
          for (const syncType of request.syncTypes) {
            const channelResult = await this.syncService.syncChannel(
              tenantId,
              targetChannel.id,
              syncType,
              'inbound', // Cross-channel is typically inbound
              {},
            );

            result.channelResults.push(channelResult);
            result.summary.totalItems += channelResult.itemsProcessed;
            result.summary.totalErrors += channelResult.itemsFailed;
          }

          result.summary.successfulChannels++;

        } catch (error) {
          this.logger.error(`Cross-channel sync failed for channel ${targetChannel.id}: ${error.message}`);
          result.summary.failedChannels++;
          result.success = false;
        }
      }

      result.endTime = new Date();

      // Log cross-channel sync completion
      await this.logService.log({
        tenantId,
        type: 'SYNC',
        level: result.success ? 'INFO' : 'WARN',
        message: `Cross-channel sync completed: ${result.summary.successfulChannels}/${result.summary.totalChannels} successful`,
        metadata: {
          syncId,
          sourceChannelId: sourceChannel?.id,
          result,
        },
      });

      // Emit completion event
      this.eventEmitter.emit('channel.cross.sync.completed', {
        tenantId,
        syncId,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Cross-channel sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'cross_channel_sync', syncId },
      });

      throw error;
    }
  }

  /**
   * Process scheduled sync
   */
  @Process('scheduled-sync')
  async processScheduledSync(job: Job<ScheduledSyncJobData>) {
    const { tenantId, scheduleId, channelIds, syncTypes, direction, options } = job.data;
    
    try {
      this.logger.debug(`Processing scheduled sync: ${scheduleId}`, {
        tenantId,
        scheduleId,
        channelIds,
        syncTypes,
        direction,
      });

      // Start sync for the scheduled channels
      const syncId = await this.syncService.startSync(tenantId, {
        channelIds,
        syncTypes,
        direction,
        priority: 'normal',
        options,
      });

      // Log scheduled sync start
      await this.logService.log({
        tenantId,
        type: 'SYNC',
        level: 'INFO',
        message: `Scheduled sync started: ${scheduleId}`,
        metadata: {
          scheduleId,
          syncId,
          channelIds,
          syncTypes,
          direction,
        },
      });

      return { success: true, syncId, scheduleId };

    } catch (error) {
      this.logger.error(`Scheduled sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'scheduled_sync', scheduleId },
      });

      throw error;
    }
  }

  /**
   * Process channel health check
   */
  @Process('health-check')
  async processHealthCheck(job: Job<ChannelHealthCheckJobData>) {
    const { tenantId, channelId, checkType } = job.data;
    
    try {
      this.logger.debug(`Processing health check: ${checkType} for channel ${channelId}`, {
        tenantId,
        channelId,
        checkType,
      });

      const results = {};

      if (checkType === 'connection' || checkType === 'all') {
        // Test channel connection
        const connectionResult = await this.channelsService.testChannelConnection(
          tenantId,
          channelId,
        );
        results['connection'] = connectionResult;
      }

      if (checkType === 'sync_status' || checkType === 'all') {
        // Check sync status and history
        const syncHistory = await this.syncService.getSyncHistory(tenantId, channelId, 5);
        const recentErrors = syncHistory.filter(sync => sync.status === 'failed').length;
        
        results['sync_status'] = {
          recentSyncs: syncHistory.length,
          recentErrors,
          errorRate: syncHistory.length > 0 ? (recentErrors / syncHistory.length) * 100 : 0,
        };
      }

      if (checkType === 'performance' || checkType === 'all') {
        // Check inventory allocation performance
        const { allocations } = await this.inventoryService.getChannelInventory(tenantId, {
          channelId,
          includeMetrics: true,
          limit: 100,
        });

        const performanceMetrics = {
          totalAllocations: allocations.length,
          outOfStockCount: allocations.filter(a => a.isOutOfStock).length,
          lowStockCount: allocations.filter(a => a.isLowStock).length,
          needsRebalancingCount: allocations.filter(a => a.needsRebalancing).length,
        };

        results['performance'] = performanceMetrics;
      }

      // Log health check completion
      await this.logService.log({
        tenantId,
        channelId,
        type: 'SYSTEM',
        level: 'INFO',
        message: `Health check completed: ${checkType}`,
        metadata: {
          checkType,
          results,
        },
      });

      // Emit health check event
      this.eventEmitter.emit('channel.health.check.completed', {
        tenantId,
        channelId,
        checkType,
        results,
      });

      return { success: true, checkType, results };

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'health_check', checkType },
      });

      throw error;
    }
  }

  /**
   * Process channel maintenance
   */
  @Process('maintenance')
  async processChannelMaintenance(job: Job<ChannelMaintenanceJobData>) {
    const { tenantId, channelId, maintenanceType, options } = job.data;
    
    try {
      this.logger.debug(`Processing maintenance: ${maintenanceType}`, {
        tenantId,
        channelId,
        maintenanceType,
        options,
      });

      let result;

      switch (maintenanceType) {
        case 'cleanup':
          result = await this.performCleanup(tenantId, channelId, options);
          break;

        case 'rebalance':
          result = await this.performRebalancing(tenantId, channelId, options);
          break;

        case 'reconcile':
          result = await this.performReconciliation(tenantId, channelId, options);
          break;

        case 'optimize':
          result = await this.performOptimization(tenantId, channelId, options);
          break;

        default:
          throw new Error(`Unknown maintenance type: ${maintenanceType}`);
      }

      // Log maintenance completion
      await this.logService.log({
        tenantId,
        channelId,
        type: 'SYSTEM',
        level: 'INFO',
        message: `Maintenance completed: ${maintenanceType}`,
        metadata: {
          maintenanceType,
          result,
        },
      });

      // Emit maintenance event
      this.eventEmitter.emit('channel.maintenance.completed', {
        tenantId,
        channelId,
        maintenanceType,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Maintenance failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'maintenance', maintenanceType },
      });

      throw error;
    }
  }

  /**
   * Process batch inventory rebalancing
   */
  @Process('batch-rebalance')
  async processBatchRebalance(job: Job<{
    tenantId: string;
    productIds: string[];
    options?: any;
  }>) {
    const { tenantId, productIds, options } = job.data;
    
    try {
      this.logger.debug(`Processing batch rebalance for ${productIds.length} products`, {
        tenantId,
        productCount: productIds.length,
      });

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const productId of productIds) {
        try {
          // This would get the total stock for the product and rebalance
          const rebalanceRequest = {
            productId,
            totalStock: options?.totalStock || 0, // This should be calculated from actual inventory
            forceRebalance: options?.forceRebalance || false,
          };

          const result = await this.inventoryService.rebalanceProductAllocations(
            tenantId,
            rebalanceRequest,
          );

          results.push({ productId, success: true, result });
          successCount++;

        } catch (error) {
          this.logger.error(`Rebalance failed for product ${productId}: ${error.message}`);
          results.push({ productId, success: false, error: error.message });
          errorCount++;
        }
      }

      const batchResult = {
        success: errorCount === 0,
        totalProducts: productIds.length,
        successCount,
        errorCount,
        results,
      };

      // Log batch rebalance completion
      await this.logService.log({
        tenantId,
        type: 'SYSTEM',
        level: batchResult.success ? 'INFO' : 'WARN',
        message: `Batch rebalance completed: ${successCount}/${productIds.length} successful`,
        metadata: {
          productCount: productIds.length,
          successCount,
          errorCount,
        },
      });

      return batchResult;

    } catch (error) {
      this.logger.error(`Batch rebalance failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private updateSyncProgress(
    syncId: string,
    channelId: string,
    status: string,
    progress: number,
    currentStep: string,
  ): void {
    // Update sync status in service (this would typically update a cache or database)
    this.eventEmitter.emit('sync.progress.updated', {
      syncId,
      channelId,
      status,
      progress,
      currentStep,
      lastUpdate: new Date(),
    });
  }

  private async performCleanup(tenantId: string, channelId?: string, options?: any) {
    // Cleanup old sync logs, expired mappings, etc.
    const results = {
      logsDeleted: 0,
      mappingsCleanup: 0,
      allocationsOptimized: 0,
    };

    // This would implement actual cleanup logic
    return results;
  }

  private async performRebalancing(tenantId: string, channelId?: string, options?: any) {
    // Rebalance inventory allocations
    const results = {
      productsRebalanced: 0,
      allocationsUpdated: 0,
      errors: 0,
    };

    try {
      // Get allocations that need rebalancing
      const { allocations } = await this.inventoryService.getChannelInventory(tenantId, {
        channelId,
        needsRebalancing: true,
      });

      for (const allocation of allocations) {
        try {
          // This would perform actual rebalancing
          results.productsRebalanced++;
        } catch (error) {
          results.errors++;
        }
      }

    } catch (error) {
      this.logger.error(`Rebalancing failed: ${error.message}`);
      throw error;
    }

    return results;
  }

  private async performReconciliation(tenantId: string, channelId?: string, options?: any) {
    // Reconcile data between internal and external systems
    const results = {
      productsReconciled: 0,
      inventoryUpdated: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
    };

    // This would implement actual reconciliation logic
    return results;
  }

  private async performOptimization(tenantId: string, channelId?: string, options?: any) {
    // Optimize channel performance and configurations
    const results = {
      allocationsOptimized: 0,
      mappingsUpdated: 0,
      performanceImproved: false,
    };

    // This would implement actual optimization logic
    return results;
  }
}