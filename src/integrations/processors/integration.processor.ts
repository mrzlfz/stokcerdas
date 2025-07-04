import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { WebhookHandlerService } from '../common/services/webhook-handler.service';
import { IntegrationLogService } from '../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../entities/integration-log.entity';
import { RateLimiterService } from '../common/services/rate-limiter.service';

export interface IntegrationJobData {
  tenantId: string;
  channelId: string;
  jobType: string;
  payload: Record<string, any>;
  priority?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface LogCleanupJobData {
  tenantId: string;
  olderThanDays: number;
  maxLogsToKeep: number;
}

export interface WebhookRetryJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  retryAttempt: number;
  maxRetries: number;
}

export interface SyncJobData {
  tenantId: string;
  channelId: string;
  entityType: 'product' | 'order' | 'inventory' | 'customer';
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  entityIds?: string[];
  batchSize?: number;
  options?: Record<string, any>;
}

export interface HealthCheckJobData {
  tenantId: string;
  checkType: 'api_status' | 'auth_status' | 'rate_limits' | 'webhook_health';
  platforms?: string[];
}

@Processor('integrations')
export class IntegrationProcessor {
  private readonly logger = new Logger(IntegrationProcessor.name);

  constructor(
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly rateLimiter: RateLimiterService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing integration job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Integration job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Integration job failed: ${job.name} [${job.id}] - ${err.message}`,
      {
        jobId: job.id,
        jobName: job.name,
        error: err.message,
        stack: err.stack,
        data: job.data,
        attemptsMade: job.attemptsMade,
        attemptsLeft: job.opts.attempts - job.attemptsMade,
      },
    );
  }

  /**
   * Process generic integration jobs
   */
  @Process('generic-integration')
  async processGenericIntegration(job: Job<IntegrationJobData>) {
    const { tenantId, channelId, jobType, payload } = job.data;

    try {
      this.logger.debug(`Processing generic integration job: ${jobType}`, {
        tenantId,
        channelId,
        jobType,
      });

      // Log job start
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Started processing ${jobType} job`,
        metadata: { jobId: job.id, jobType, payload },
      });

      let result;

      switch (jobType) {
        case 'data_validation':
          result = await this.processDataValidation(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'error_recovery':
          result = await this.processErrorRecovery(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'batch_operation':
          result = await this.processBatchOperation(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'scheduled_sync':
          result = await this.processScheduledSync(
            tenantId,
            channelId,
            payload,
          );
          break;

        default:
          throw new Error(`Unsupported job type: ${jobType}`);
      }

      // Log job completion
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Completed processing ${jobType} job`,
        metadata: { jobId: job.id, jobType, result },
      });

      // Emit event
      this.eventEmitter.emit('integration.job.completed', {
        tenantId,
        channelId,
        jobType,
        jobId: job.id,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Generic integration job failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { jobId: job.id, jobType, payload },
      });

      throw error;
    }
  }

  /**
   * Process log cleanup jobs
   */
  @Process('log-cleanup')
  async processLogCleanup(job: Job<LogCleanupJobData>) {
    const { tenantId, olderThanDays, maxLogsToKeep } = job.data;

    try {
      this.logger.debug(`Processing log cleanup for tenant: ${tenantId}`, {
        tenantId,
        olderThanDays,
        maxLogsToKeep,
      });

      const deletedCount = await this.logService.cleanupOldLogs(
        tenantId,
        olderThanDays,
        maxLogsToKeep,
      );

      // Also cleanup old webhooks
      const deletedWebhooks = await this.webhookHandler.cleanupOldWebhooks(
        tenantId,
        olderThanDays,
      );

      const result = {
        deletedLogs: deletedCount,
        deletedWebhooks,
        total: deletedCount + deletedWebhooks,
      };

      // Log cleanup completion
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Cleanup completed: ${deletedCount} logs, ${deletedWebhooks} webhooks deleted`,
        metadata: result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Log cleanup failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, '', error);

      throw error;
    }
  }

  /**
   * Process webhook retry jobs
   */
  @Process('webhook-retry')
  async processWebhookRetry(job: Job<WebhookRetryJobData>) {
    const { webhookId, tenantId, channelId, retryAttempt, maxRetries } =
      job.data;

    try {
      this.logger.debug(`Processing webhook retry: ${webhookId}`, {
        webhookId,
        tenantId,
        channelId,
        retryAttempt,
        maxRetries,
      });

      if (retryAttempt >= maxRetries) {
        throw new Error(
          `Maximum retry attempts (${maxRetries}) exceeded for webhook ${webhookId}`,
        );
      }

      // Mark webhook as processing
      const webhook = await this.webhookHandler.markWebhookAsProcessing(
        webhookId,
      );

      if (!webhook) {
        throw new Error(`Webhook not found: ${webhookId}`);
      }

      // Process webhook based on its event type and source
      // This would need to be extended based on the specific webhook handlers
      const result = { success: true, retryAttempt };

      // Mark webhook as processed
      await this.webhookHandler.markWebhookAsProcessed(webhookId, {
        retryAttempt,
        retrySuccess: true,
      });

      await this.logService.logWebhook(
        tenantId,
        channelId,
        'webhook_retry',
        'processed',
        `Webhook ${webhookId} retry ${retryAttempt} succeeded`,
        { webhookId, retryAttempt },
      );

      return result;
    } catch (error) {
      this.logger.error(`Webhook retry failed: ${error.message}`, error.stack);

      // Mark webhook as failed
      await this.webhookHandler.markWebhookAsFailed(
        webhookId,
        `Retry ${retryAttempt} failed: ${error.message}`,
        retryAttempt < maxRetries,
      );

      await this.logService.logWebhook(
        tenantId,
        channelId,
        'webhook_retry',
        'failed',
        `Webhook ${webhookId} retry ${retryAttempt} failed: ${error.message}`,
        { webhookId, retryAttempt, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process synchronization jobs
   */
  @Process('sync-operation')
  async processSyncOperation(job: Job<SyncJobData>) {
    const {
      tenantId,
      channelId,
      entityType,
      syncDirection,
      entityIds,
      batchSize,
      options,
    } = job.data;

    try {
      this.logger.debug(
        `Processing sync operation: ${entityType} ${syncDirection}`,
        {
          tenantId,
          channelId,
          entityType,
          syncDirection,
          entityCount: entityIds?.length || 0,
        },
      );

      // Log sync start
      await this.logService.logSync(
        tenantId,
        channelId,
        `${entityType}_${syncDirection}`,
        'started',
        `Started ${entityType} sync (${syncDirection})`,
        { entityIds, batchSize, options },
      );

      let result;

      switch (entityType) {
        case 'product':
          result = await this.processSyncProducts(
            tenantId,
            channelId,
            syncDirection,
            entityIds,
            options,
          );
          break;

        case 'order':
          result = await this.processSyncOrders(
            tenantId,
            channelId,
            syncDirection,
            entityIds,
            options,
          );
          break;

        case 'inventory':
          result = await this.processSyncInventory(
            tenantId,
            channelId,
            syncDirection,
            entityIds,
            options,
          );
          break;

        case 'customer':
          result = await this.processSyncCustomers(
            tenantId,
            channelId,
            syncDirection,
            entityIds,
            options,
          );
          break;

        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }

      // Log sync completion
      await this.logService.logSync(
        tenantId,
        channelId,
        `${entityType}_${syncDirection}`,
        'completed',
        `Completed ${entityType} sync (${syncDirection})`,
        result,
      );

      // Emit event
      this.eventEmitter.emit('integration.sync.completed', {
        tenantId,
        channelId,
        entityType,
        syncDirection,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Sync operation failed: ${error.message}`, error.stack);

      // Log sync failure
      await this.logService.logSync(
        tenantId,
        channelId,
        `${entityType}_${syncDirection}`,
        'failed',
        `Failed ${entityType} sync (${syncDirection}): ${error.message}`,
        { error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process health check jobs
   */
  @Process('health-check')
  async processHealthCheck(job: Job<HealthCheckJobData>) {
    const { tenantId, checkType, platforms } = job.data;

    try {
      this.logger.debug(`Processing health check: ${checkType}`, {
        tenantId,
        checkType,
        platforms,
      });

      let result;

      switch (checkType) {
        case 'api_status':
          result = await this.checkApiStatus(tenantId, platforms);
          break;

        case 'auth_status':
          result = await this.checkAuthStatus(tenantId, platforms);
          break;

        case 'rate_limits':
          result = await this.checkRateLimits(tenantId, platforms);
          break;

        case 'webhook_health':
          result = await this.checkWebhookHealth(tenantId);
          break;

        default:
          throw new Error(`Unsupported health check type: ${checkType}`);
      }

      // Log health check result
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Health check ${checkType} completed`,
        metadata: { checkType, platforms, result },
      });

      // Emit event
      this.eventEmitter.emit('integration.health.checked', {
        tenantId,
        checkType,
        platforms,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, '', error, {
        metadata: { checkType, platforms },
      });

      throw error;
    }
  }

  // Private helper methods

  private async processDataValidation(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    // Implement data validation logic
    this.logger.debug(`Processing data validation for tenant ${tenantId}`);

    return {
      validated: true,
      errors: [],
      warnings: [],
    };
  }

  private async processErrorRecovery(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    // Implement error recovery logic
    this.logger.debug(`Processing error recovery for tenant ${tenantId}`);

    return {
      recovered: true,
      actions: [],
    };
  }

  private async processBatchOperation(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    // Implement batch operation logic
    this.logger.debug(`Processing batch operation for tenant ${tenantId}`);

    return {
      processed: 0,
      successful: 0,
      failed: 0,
    };
  }

  private async processScheduledSync(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    // Implement scheduled sync logic
    this.logger.debug(`Processing scheduled sync for tenant ${tenantId}`);

    return {
      syncType: payload.syncType || 'unknown',
      status: 'completed',
    };
  }

  private async processSyncProducts(
    tenantId: string,
    channelId: string,
    syncDirection: string,
    entityIds?: string[],
    options?: any,
  ): Promise<any> {
    // Implement product sync logic
    this.logger.debug(`Processing product sync: ${syncDirection}`);

    return {
      entityType: 'product',
      syncDirection,
      processed: entityIds?.length || 0,
      successful: entityIds?.length || 0,
      failed: 0,
    };
  }

  private async processSyncOrders(
    tenantId: string,
    channelId: string,
    syncDirection: string,
    entityIds?: string[],
    options?: any,
  ): Promise<any> {
    // Implement order sync logic
    this.logger.debug(`Processing order sync: ${syncDirection}`);

    return {
      entityType: 'order',
      syncDirection,
      processed: entityIds?.length || 0,
      successful: entityIds?.length || 0,
      failed: 0,
    };
  }

  private async processSyncInventory(
    tenantId: string,
    channelId: string,
    syncDirection: string,
    entityIds?: string[],
    options?: any,
  ): Promise<any> {
    // Implement inventory sync logic
    this.logger.debug(`Processing inventory sync: ${syncDirection}`);

    return {
      entityType: 'inventory',
      syncDirection,
      processed: entityIds?.length || 0,
      successful: entityIds?.length || 0,
      failed: 0,
    };
  }

  private async processSyncCustomers(
    tenantId: string,
    channelId: string,
    syncDirection: string,
    entityIds?: string[],
    options?: any,
  ): Promise<any> {
    // Implement customer sync logic
    this.logger.debug(`Processing customer sync: ${syncDirection}`);

    return {
      entityType: 'customer',
      syncDirection,
      processed: entityIds?.length || 0,
      successful: entityIds?.length || 0,
      failed: 0,
    };
  }

  private async checkApiStatus(
    tenantId: string,
    platforms?: string[],
  ): Promise<any> {
    // Implement API status check
    this.logger.debug(
      `Checking API status for platforms: ${platforms?.join(', ')}`,
    );

    const checks = (platforms || ['shopee', 'lazada', 'tokopedia']).map(
      platform => ({
        platform,
        status: 'healthy',
        responseTime: Math.random() * 100 + 50, // Mock response time
        lastCheck: new Date(),
      }),
    );

    return {
      overall: 'healthy',
      platforms: checks,
    };
  }

  private async checkAuthStatus(
    tenantId: string,
    platforms?: string[],
  ): Promise<any> {
    // Implement auth status check
    this.logger.debug(
      `Checking auth status for platforms: ${platforms?.join(', ')}`,
    );

    const checks = (platforms || ['shopee', 'lazada', 'tokopedia']).map(
      platform => ({
        platform,
        authenticated: true,
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        lastCheck: new Date(),
      }),
    );

    return {
      overall: 'authenticated',
      platforms: checks,
    };
  }

  private async checkRateLimits(
    tenantId: string,
    platforms?: string[],
  ): Promise<any> {
    // Implement rate limit check
    this.logger.debug(
      `Checking rate limits for platforms: ${platforms?.join(', ')}`,
    );

    const checks = (platforms || ['shopee', 'lazada', 'tokopedia']).map(
      platform => ({
        platform,
        remaining: Math.floor(Math.random() * 1000),
        limit: 1000,
        resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        status: 'healthy',
      }),
    );

    return {
      overall: 'healthy',
      platforms: checks,
    };
  }

  private async checkWebhookHealth(tenantId: string): Promise<any> {
    // Implement webhook health check
    this.logger.debug(`Checking webhook health for tenant: ${tenantId}`);

    const stats = await this.webhookHandler.getWebhookStats(tenantId);

    return {
      status: stats.successRate > 90 ? 'healthy' : 'degraded',
      stats,
      lastCheck: new Date(),
    };
  }
}
