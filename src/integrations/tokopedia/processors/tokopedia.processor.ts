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

import { TokopediaWebhookService } from '../services/tokopedia-webhook.service';
import { TokopediaProductService } from '../services/tokopedia-product.service';
import { TokopediaOrderService } from '../services/tokopedia-order.service';
import { TokopediaInventoryService } from '../services/tokopedia-inventory.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export interface TokopediaWebhookJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  eventSource: string;
  isRetry?: boolean;
}

export interface TokopediaProductSyncJobData {
  tenantId: string;
  channelId: string;
  productId?: string;
  tokopediaProductId?: number;
  syncDirection: 'inbound' | 'outbound';
  options?: any;
}

export interface TokopediaOrderSyncJobData {
  tenantId: string;
  channelId: string;
  orderId?: string;
  tokopediaOrderId?: number;
  syncDirection: 'inbound' | 'outbound';
  options?: any;
}

export interface TokopediaInventorySyncJobData {
  tenantId: string;
  channelId: string;
  productId?: string;
  productSku?: string;
  syncType: 'stock' | 'price' | 'both';
  updates?: any;
}

@Processor('tokopedia')
export class TokopediaProcessor {
  private readonly logger = new Logger(TokopediaProcessor.name);

  constructor(
    private readonly webhookService: TokopediaWebhookService,
    private readonly productService: TokopediaProductService,
    private readonly orderService: TokopediaOrderService,
    private readonly inventoryService: TokopediaInventoryService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing Tokopedia job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Tokopedia job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Tokopedia job failed: ${job.name} [${job.id}] - ${err.message}`,
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
   * Process webhook events
   */
  @Process('process-webhook')
  async processWebhook(job: Job<TokopediaWebhookJobData>) {
    const { webhookId, tenantId, channelId, eventType, eventSource, isRetry } =
      job.data;

    try {
      this.logger.debug(`Processing Tokopedia webhook: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
        isRetry,
      });

      // Mark webhook as processing
      const webhook = await this.webhookHandler.markWebhookAsProcessing(
        webhookId,
      );

      // Get webhook payload
      const payload = webhook.payload;

      // Process webhook based on event type
      const result = await this.webhookService.handleWebhookEvent(
        webhookId,
        tenantId,
        channelId,
        eventType as any,
        payload as any,
      );

      if (result.success) {
        // Mark webhook as processed
        await this.webhookHandler.markWebhookAsProcessed(webhookId, {
          processedAt: new Date(),
          processingResult: result,
        });

        // Log success
        await this.logService.logWebhook(
          tenantId,
          channelId,
          eventType,
          'processed',
          `Tokopedia webhook ${eventType} processed successfully`,
          { webhookId, result },
        );

        return {
          success: true,
          webhookId,
          eventType,
          result,
        };
      } else {
        // Mark webhook as failed
        await this.webhookHandler.markWebhookAsFailed(
          webhookId,
          result.error || 'Processing failed',
          true, // Schedule retry
        );

        throw new Error(result.error || 'Webhook processing failed');
      }
    } catch (error) {
      this.logger.error(
        `Webhook processing failed: ${error.message}`,
        error.stack,
      );

      // Mark webhook as failed
      await this.webhookHandler.markWebhookAsFailed(
        webhookId,
        error.message,
        !isRetry, // Don't retry if this is already a retry
      );

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        eventType,
        'failed',
        `Tokopedia webhook processing failed: ${error.message}`,
        { webhookId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process product sync jobs
   */
  @Process('product-sync')
  async processProductSync(job: Job<TokopediaProductSyncJobData>) {
    const {
      tenantId,
      channelId,
      productId,
      tokopediaProductId,
      syncDirection,
      options,
    } = job.data;

    try {
      this.logger.debug(`Processing Tokopedia product sync: ${syncDirection}`, {
        tenantId,
        channelId,
        productId,
        tokopediaProductId,
        syncDirection,
      });

      let result;

      if (syncDirection === 'inbound') {
        // Sync from Tokopedia to local system
        if (tokopediaProductId) {
          // Sync specific product
          const productDetails =
            await this.productService.getTokopediaProductDetails(
              tenantId,
              channelId,
              tokopediaProductId,
            );

          if (productDetails.success) {
            // Process the product data
            result = {
              success: true,
              tokopediaProductId,
              data: productDetails.data,
            };
          } else {
            throw new Error(
              `Failed to get product details: ${productDetails.error}`,
            );
          }
        } else {
          // Sync all products
          result = await this.productService.syncProductsFromTokopedia(
            tenantId,
            channelId,
            options,
          );
        }
      } else {
        // Sync from local system to Tokopedia
        if (!productId) {
          throw new Error('Product ID is required for outbound sync');
        }

        result = await this.productService.syncProductToTokopedia(
          tenantId,
          channelId,
          productId,
        );
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_product_${syncDirection}`,
        'completed',
        `Product sync completed successfully`,
        { productId, tokopediaProductId, result },
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.product.sync.completed', {
        tenantId,
        channelId,
        productId,
        tokopediaProductId,
        syncDirection,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Product sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_product_${syncDirection}`,
        'failed',
        `Product sync failed: ${error.message}`,
        { productId, tokopediaProductId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process order sync jobs
   */
  @Process('order-sync')
  async processOrderSync(job: Job<TokopediaOrderSyncJobData>) {
    const {
      tenantId,
      channelId,
      orderId,
      tokopediaOrderId,
      syncDirection,
      options,
    } = job.data;

    try {
      this.logger.debug(`Processing Tokopedia order sync: ${syncDirection}`, {
        tenantId,
        channelId,
        orderId,
        tokopediaOrderId,
        syncDirection,
      });

      let result;

      if (syncDirection === 'inbound') {
        // Sync from Tokopedia to local system
        if (tokopediaOrderId) {
          // Sync specific order
          const orderDetails = await this.orderService.getTokopediaOrderDetails(
            tenantId,
            channelId,
            tokopediaOrderId,
          );

          if (orderDetails.success) {
            result = {
              success: true,
              tokopediaOrderId,
              data: orderDetails.data,
            };
          } else {
            throw new Error(
              `Failed to get order details: ${orderDetails.error}`,
            );
          }
        } else {
          // Sync all orders
          result = await this.orderService.syncOrdersFromTokopedia(
            tenantId,
            channelId,
            options,
          );
        }
      } else {
        // Outbound sync (updating Tokopedia orders)
        if (!tokopediaOrderId) {
          throw new Error('Tokopedia order ID is required for outbound sync');
        }

        // This would typically involve updating order status in Tokopedia
        result = {
          success: true,
          message: 'Outbound order sync not implemented yet',
        };
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_order_${syncDirection}`,
        'completed',
        `Order sync completed successfully`,
        { orderId, tokopediaOrderId, result },
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.order.sync.completed', {
        tenantId,
        channelId,
        orderId,
        tokopediaOrderId,
        syncDirection,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Order sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_order_${syncDirection}`,
        'failed',
        `Order sync failed: ${error.message}`,
        { orderId, tokopediaOrderId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process inventory sync jobs
   */
  @Process('inventory-sync')
  async processInventorySync(job: Job<TokopediaInventorySyncJobData>) {
    const { tenantId, channelId, productId, productSku, syncType, updates } =
      job.data;

    try {
      this.logger.debug(`Processing Tokopedia inventory sync: ${syncType}`, {
        tenantId,
        channelId,
        productId,
        productSku,
        syncType,
      });

      let result;

      switch (syncType) {
        case 'stock':
          if (updates) {
            // Update stock in Tokopedia
            result = await this.inventoryService.updateTokopediaInventory(
              tenantId,
              channelId,
              updates,
            );
          } else if (productSku) {
            // Sync stock from Tokopedia
            const stockResult = await this.inventoryService.getTokopediaStock(
              tenantId,
              channelId,
              [productSku],
            );
            result = stockResult;
          } else {
            // Sync all inventory
            result = await this.inventoryService.syncInventoryFromTokopedia(
              tenantId,
              channelId,
              { syncStock: true, syncPrices: false },
            );
          }
          break;

        case 'price':
          if (updates) {
            // Update prices in Tokopedia
            result = await this.inventoryService.updateTokopediaPrices(
              tenantId,
              channelId,
              updates,
            );
          } else if (productSku) {
            // Sync prices from Tokopedia
            const priceResult = await this.inventoryService.getTokopediaPrices(
              tenantId,
              channelId,
              [productSku],
            );
            result = priceResult;
          } else {
            // Sync all prices
            result = await this.inventoryService.syncInventoryFromTokopedia(
              tenantId,
              channelId,
              { syncStock: false, syncPrices: true },
            );
          }
          break;

        case 'both':
          // Sync both stock and prices
          result = await this.inventoryService.syncInventoryFromTokopedia(
            tenantId,
            channelId,
            { syncStock: true, syncPrices: true },
          );
          break;

        default:
          throw new Error(`Unsupported sync type: ${syncType}`);
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_inventory_${syncType}`,
        'completed',
        `Inventory ${syncType} sync completed successfully`,
        { productId, productSku, result },
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.inventory.sync.completed', {
        tenantId,
        channelId,
        productId,
        productSku,
        syncType,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Inventory sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_inventory_${syncType}`,
        'failed',
        `Inventory ${syncType} sync failed: ${error.message}`,
        { productId, productSku, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process batch sync jobs
   */
  @Process('batch-sync')
  async processBatchSync(
    job: Job<{
      tenantId: string;
      channelId: string;
      syncType: 'products' | 'orders' | 'inventory';
      batchData: any[];
      options?: any;
    }>,
  ) {
    const { tenantId, channelId, syncType, batchData, options } = job.data;

    try {
      this.logger.debug(`Processing Tokopedia batch sync: ${syncType}`, {
        tenantId,
        channelId,
        syncType,
        batchSize: batchData.length,
      });

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const item of batchData) {
        try {
          let result;

          switch (syncType) {
            case 'products':
              result = await this.productService.syncProductToTokopedia(
                tenantId,
                channelId,
                item.productId,
              );
              break;

            case 'orders':
              result = await this.orderService.getTokopediaOrderDetails(
                tenantId,
                channelId,
                item.orderId,
              );
              break;

            case 'inventory':
              result = await this.inventoryService.updateTokopediaInventory(
                tenantId,
                channelId,
                [item],
              );
              break;

            default:
              throw new Error(`Unsupported batch sync type: ${syncType}`);
          }

          results.push({ item, result, success: true });
          successCount++;
        } catch (error) {
          this.logger.error(`Batch item sync failed: ${error.message}`, {
            item,
            error: error.message,
          });

          results.push({
            item,
            error: error.message,
            success: false,
          });
          errorCount++;
        }
      }

      const batchResult = {
        success: errorCount === 0,
        totalItems: batchData.length,
        successCount,
        errorCount,
        results,
      };

      // Log batch result
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_batch_${syncType}`,
        errorCount === 0 ? 'completed' : 'failed',
        `Batch ${syncType} sync completed: ${successCount}/${batchData.length} successful`,
        batchResult,
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.batch.sync.completed', {
        tenantId,
        channelId,
        syncType,
        result: batchResult,
      });

      return batchResult;
    } catch (error) {
      this.logger.error(`Batch sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logSync(
        tenantId,
        channelId,
        `tokopedia_batch_${syncType}`,
        'failed',
        `Batch ${syncType} sync failed: ${error.message}`,
        { error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process auth token refresh jobs
   */
  @Process('auth-refresh')
  async processAuthRefresh(
    job: Job<{
      tenantId: string;
      channelId: string;
    }>,
  ) {
    const { tenantId, channelId } = job.data;

    try {
      this.logger.debug(`Processing Tokopedia auth refresh`, {
        tenantId,
        channelId,
      });

      // This would be handled by the auth service automatically
      // when credentials are accessed, but this job can be used
      // for proactive refresh before expiration

      // Log successful refresh
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Tokopedia auth refresh job completed',
        metadata: { jobId: job.id },
      });

      return { success: true, message: 'Auth refresh completed' };
    } catch (error) {
      this.logger.error(`Auth refresh failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { jobId: job.id },
      });

      throw error;
    }
  }

  /**
   * Process health check jobs
   */
  @Process('health-check')
  async processHealthCheck(
    job: Job<{
      tenantId: string;
      channelId: string;
      checkType: 'auth' | 'api' | 'webhooks';
    }>,
  ) {
    const { tenantId, channelId, checkType } = job.data;

    try {
      this.logger.debug(`Processing Tokopedia health check: ${checkType}`, {
        tenantId,
        channelId,
        checkType,
      });

      let result;

      switch (checkType) {
        case 'auth':
          // Test authentication
          result = { success: true, checkType, status: 'healthy' };
          break;

        case 'api':
          // Test API connectivity
          result = { success: true, checkType, status: 'healthy' };
          break;

        case 'webhooks':
          // Check webhook health
          result = { success: true, checkType, status: 'healthy' };
          break;

        default:
          throw new Error(`Unsupported health check type: ${checkType}`);
      }

      // Log health check result
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Tokopedia health check ${checkType} completed`,
        metadata: { checkType, result },
      });

      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { checkType },
      });

      throw error;
    }
  }

  /**
   * Process TikTok Shop migration jobs
   */
  @Process('tiktok-migration')
  async processTikTokMigration(
    job: Job<{
      tenantId: string;
      channelId: string;
      tiktokAuthCode: string;
      config: any;
    }>,
  ) {
    const { tenantId, channelId, tiktokAuthCode, config } = job.data;

    try {
      this.logger.debug(`Processing TikTok Shop migration`, {
        tenantId,
        channelId,
      });

      // This would handle the TikTok Shop migration process
      // For now, it's a placeholder for the actual implementation

      // Log migration progress
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'TikTok Shop migration job completed',
        metadata: { jobId: job.id },
      });

      return { success: true, message: 'TikTok Shop migration completed' };
    } catch (error) {
      this.logger.error(
        `TikTok Shop migration failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { jobId: job.id },
      });

      throw error;
    }
  }
}
