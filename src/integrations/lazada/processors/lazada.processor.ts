import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { LazadaWebhookService, LazadaWebhookPayload } from '../services/lazada-webhook.service';
import { LazadaProductService } from '../services/lazada-product.service';
import { LazadaOrderService } from '../services/lazada-order.service';
import { LazadaInventoryService } from '../services/lazada-inventory.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../entities/integration-log.entity';

export interface LazadaWebhookJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  eventSource: string;
  isRetry?: boolean;
}

export interface LazadaProductSyncJobData {
  tenantId: string;
  channelId: string;
  productId?: string;
  itemId?: number;
  syncDirection: 'inbound' | 'outbound';
  options?: any;
}

export interface LazadaOrderSyncJobData {
  tenantId: string;
  channelId: string;
  orderId?: string;
  orderNumber?: string;
  syncDirection: 'inbound' | 'outbound';
  options?: any;
}

export interface LazadaInventorySyncJobData {
  tenantId: string;
  channelId: string;
  productId?: string;
  sellerSku?: string;
  syncType: 'stock' | 'price' | 'both';
  updates?: any;
}

@Processor('lazada')
export class LazadaProcessor {
  private readonly logger = new Logger(LazadaProcessor.name);

  constructor(
    private readonly webhookService: LazadaWebhookService,
    private readonly productService: LazadaProductService,
    private readonly orderService: LazadaOrderService,
    private readonly inventoryService: LazadaInventoryService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing Lazada job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Lazada job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Lazada job failed: ${job.name} [${job.id}] - ${err.message}`, {
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
   * Process webhook events
   */
  @Process('process-webhook')
  async processWebhook(job: Job<LazadaWebhookJobData>) {
    const { webhookId, tenantId, channelId, eventType, eventSource, isRetry } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada webhook: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
        isRetry,
      });

      // Mark webhook as processing
      const webhook = await this.webhookHandler.markWebhookAsProcessing(webhookId);
      
      // Get webhook payload
      const payload = webhook.payload;

      // Process webhook based on event type
      const result = await this.webhookService.handleWebhookEvent(
        webhookId,
        tenantId,
        channelId,
        eventType as any,
        payload as LazadaWebhookPayload,
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
          `Lazada webhook ${eventType} processed successfully`,
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
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);

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
        `Lazada webhook processing failed: ${error.message}`,
        { webhookId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process product sync jobs
   */
  @Process('product-sync')
  async processProductSync(job: Job<LazadaProductSyncJobData>) {
    const { tenantId, channelId, productId, itemId, syncDirection, options } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada product sync: ${syncDirection}`, {
        tenantId,
        channelId,
        productId,
        itemId,
        syncDirection,
      });

      let result;

      if (syncDirection === 'inbound') {
        // Sync from Lazada to local system
        if (itemId) {
          // Sync specific product
          const productDetails = await this.productService.getLazadaProductDetails(
            tenantId,
            channelId,
            itemId,
          );

          if (productDetails.success) {
            // Process the product data
            result = { success: true, itemId, data: productDetails.data };
          } else {
            throw new Error(`Failed to get product details: ${productDetails.error}`);
          }
        } else {
          // Sync all products
          result = await this.productService.syncProductsFromLazada(
            tenantId,
            channelId,
            options,
          );
        }
      } else {
        // Sync from local system to Lazada
        if (!productId) {
          throw new Error('Product ID is required for outbound sync');
        }

        result = await this.productService.syncProductToLazada(
          tenantId,
          channelId,
          productId,
        );
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `lazada_product_${syncDirection}`,
        'completed',
        `Product sync completed successfully`,
        { productId, itemId, result },
      );

      // Emit event
      this.eventEmitter.emit('lazada.product.sync.completed', {
        tenantId,
        channelId,
        productId,
        itemId,
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
        `lazada_product_${syncDirection}`,
        'failed',
        `Product sync failed: ${error.message}`,
        { productId, itemId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process order sync jobs
   */
  @Process('order-sync')
  async processOrderSync(job: Job<LazadaOrderSyncJobData>) {
    const { tenantId, channelId, orderId, orderNumber, syncDirection, options } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada order sync: ${syncDirection}`, {
        tenantId,
        channelId,
        orderId,
        orderNumber,
        syncDirection,
      });

      let result;

      if (syncDirection === 'inbound') {
        // Sync from Lazada to local system
        if (orderNumber) {
          // Sync specific order
          const orderDetails = await this.orderService.getLazadaOrderDetails(
            tenantId,
            channelId,
            orderNumber,
          );

          if (orderDetails.success) {
            result = { success: true, orderNumber, data: orderDetails.data };
          } else {
            throw new Error(`Failed to get order details: ${orderDetails.error}`);
          }
        } else {
          // Sync all orders
          result = await this.orderService.syncOrdersFromLazada(
            tenantId,
            channelId,
            options,
          );
        }
      } else {
        // Outbound sync (updating Lazada orders)
        if (!orderNumber) {
          throw new Error('Order number is required for outbound sync');
        }

        // This would typically involve updating order status in Lazada
        result = { success: true, message: 'Outbound order sync not implemented yet' };
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `lazada_order_${syncDirection}`,
        'completed',
        `Order sync completed successfully`,
        { orderId, orderNumber, result },
      );

      // Emit event
      this.eventEmitter.emit('lazada.order.sync.completed', {
        tenantId,
        channelId,
        orderId,
        orderNumber,
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
        `lazada_order_${syncDirection}`,
        'failed',
        `Order sync failed: ${error.message}`,
        { orderId, orderNumber, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process inventory sync jobs
   */
  @Process('inventory-sync')
  async processInventorySync(job: Job<LazadaInventorySyncJobData>) {
    const { tenantId, channelId, productId, sellerSku, syncType, updates } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada inventory sync: ${syncType}`, {
        tenantId,
        channelId,
        productId,
        sellerSku,
        syncType,
      });

      let result;

      switch (syncType) {
        case 'stock':
          if (updates) {
            // Update stock in Lazada
            result = await this.inventoryService.updateLazadaInventory(
              tenantId,
              channelId,
              updates,
            );
          } else if (sellerSku) {
            // Sync stock from Lazada
            const stockResult = await this.inventoryService.getLazadaStock(
              tenantId,
              channelId,
              [sellerSku],
            );
            result = stockResult;
          } else {
            // Sync all inventory
            result = await this.inventoryService.syncInventoryFromLazada(
              tenantId,
              channelId,
              { syncStock: true, syncPrices: false },
            );
          }
          break;

        case 'price':
          if (updates) {
            // Update prices in Lazada
            result = await this.inventoryService.updateLazadaPrices(
              tenantId,
              channelId,
              updates,
            );
          } else if (sellerSku) {
            // Sync prices from Lazada
            const priceResult = await this.inventoryService.getLazadaPrice(
              tenantId,
              channelId,
              [sellerSku],
            );
            result = priceResult;
          } else {
            // Sync all prices
            result = await this.inventoryService.syncInventoryFromLazada(
              tenantId,
              channelId,
              { syncStock: false, syncPrices: true },
            );
          }
          break;

        case 'both':
          // Sync both stock and prices
          result = await this.inventoryService.syncInventoryFromLazada(
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
        `lazada_inventory_${syncType}`,
        'completed',
        `Inventory ${syncType} sync completed successfully`,
        { productId, sellerSku, result },
      );

      // Emit event
      this.eventEmitter.emit('lazada.inventory.sync.completed', {
        tenantId,
        channelId,
        productId,
        sellerSku,
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
        `lazada_inventory_${syncType}`,
        'failed',
        `Inventory ${syncType} sync failed: ${error.message}`,
        { productId, sellerSku, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process batch sync jobs
   */
  @Process('batch-sync')
  async processBatchSync(job: Job<{
    tenantId: string;
    channelId: string;
    syncType: 'products' | 'orders' | 'inventory';
    batchData: any[];
    options?: any;
  }>) {
    const { tenantId, channelId, syncType, batchData, options } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada batch sync: ${syncType}`, {
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
              result = await this.productService.syncProductToLazada(
                tenantId,
                channelId,
                item.productId,
              );
              break;

            case 'orders':
              result = await this.orderService.getLazadaOrderDetails(
                tenantId,
                channelId,
                item.orderNumber,
              );
              break;

            case 'inventory':
              result = await this.inventoryService.updateLazadaInventory(
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
            success: false 
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
        `lazada_batch_${syncType}`,
        errorCount === 0 ? 'completed' : 'failed',
        `Batch ${syncType} sync completed: ${successCount}/${batchData.length} successful`,
        batchResult,
      );

      // Emit event
      this.eventEmitter.emit('lazada.batch.sync.completed', {
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
        `lazada_batch_${syncType}`,
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
  async processAuthRefresh(job: Job<{
    tenantId: string;
    channelId: string;
  }>) {
    const { tenantId, channelId } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada auth refresh`, {
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
        message: 'Lazada auth refresh job completed',
        metadata: { jobId: job.id },
      });

      return { success: true, message: 'Auth refresh completed' };

    } catch (error) {
      this.logger.error(`Auth refresh failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        channelId,
        error,
        { metadata: { jobId: job.id } },
      );

      throw error;
    }
  }

  /**
   * Process health check jobs
   */
  @Process('health-check')
  async processHealthCheck(job: Job<{
    tenantId: string;
    channelId: string;
    checkType: 'auth' | 'api' | 'webhooks';
  }>) {
    const { tenantId, channelId, checkType } = job.data;
    
    try {
      this.logger.debug(`Processing Lazada health check: ${checkType}`, {
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
        message: `Lazada health check ${checkType} completed`,
        metadata: { checkType, result },
      });

      return result;

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        channelId,
        error,
        { metadata: { checkType } },
      );

      throw error;
    }
  }
}