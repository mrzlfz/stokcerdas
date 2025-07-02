import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ShopeeWebhookService } from '../services/shopee-webhook.service';
import { ShopeeProductService } from '../services/shopee-product.service';
import { ShopeeOrderService } from '../services/shopee-order.service';
import { ShopeeInventoryService } from '../services/shopee-inventory.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface ShopeeWebhookJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  eventSource: string;
  isRetry?: boolean;
}

export interface ShopeeProductSyncJobData {
  tenantId: string;
  channelId: string;
  productId?: string;
  itemId?: number;
  syncDirection: 'inbound' | 'outbound';
  options?: any;
}

export interface ShopeeOrderSyncJobData {
  tenantId: string;
  channelId: string;
  orderId?: string;
  orderSn?: string;
  syncDirection: 'inbound' | 'outbound';
  options?: any;
}

export interface ShopeeInventorySyncJobData {
  tenantId: string;
  channelId: string;
  productId?: string;
  itemId?: number;
  syncType: 'stock' | 'price' | 'both';
  updates?: any;
}

@Processor('shopee')
export class ShopeeProcessor {
  private readonly logger = new Logger(ShopeeProcessor.name);

  constructor(
    private readonly webhookService: ShopeeWebhookService,
    private readonly productService: ShopeeProductService,
    private readonly orderService: ShopeeOrderService,
    private readonly inventoryService: ShopeeInventoryService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing Shopee job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Shopee job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Shopee job failed: ${job.name} [${job.id}] - ${err.message}`, {
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
  async processWebhook(job: Job<ShopeeWebhookJobData>) {
    const { webhookId, tenantId, channelId, eventType, eventSource, isRetry } = job.data;
    
    try {
      this.logger.debug(`Processing Shopee webhook: ${eventType}`, {
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
        payload,
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
          `Shopee webhook ${eventType} processed successfully`,
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
        `Shopee webhook processing failed: ${error.message}`,
        { webhookId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process product sync jobs
   */
  @Process('product-sync')
  async processProductSync(job: Job<ShopeeProductSyncJobData>) {
    const { tenantId, channelId, productId, itemId, syncDirection, options } = job.data;
    
    try {
      this.logger.debug(`Processing Shopee product sync: ${syncDirection}`, {
        tenantId,
        channelId,
        productId,
        itemId,
        syncDirection,
      });

      let result;

      if (syncDirection === 'inbound') {
        // Sync from Shopee to local system
        if (itemId) {
          // Sync specific product
          const productDetails = await this.productService.getShopeeProductDetails(
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
          result = await this.productService.syncProductsFromShopee(
            tenantId,
            channelId,
            options,
          );
        }
      } else {
        // Sync from local system to Shopee
        if (!productId) {
          throw new Error('Product ID is required for outbound sync');
        }

        result = await this.productService.syncProductToShopee(
          tenantId,
          channelId,
          productId,
        );
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `shopee_product_${syncDirection}`,
        'completed',
        `Product sync completed successfully`,
        { productId, itemId, result },
      );

      // Emit event
      this.eventEmitter.emit('shopee.product.sync.completed', {
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
        `shopee_product_${syncDirection}`,
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
  async processOrderSync(job: Job<ShopeeOrderSyncJobData>) {
    const { tenantId, channelId, orderId, orderSn, syncDirection, options } = job.data;
    
    try {
      this.logger.debug(`Processing Shopee order sync: ${syncDirection}`, {
        tenantId,
        channelId,
        orderId,
        orderSn,
        syncDirection,
      });

      let result;

      if (syncDirection === 'inbound') {
        // Sync from Shopee to local system
        if (orderSn) {
          // Sync specific order
          const orderDetails = await this.orderService.getShopeeOrderDetails(
            tenantId,
            channelId,
            orderSn,
          );

          if (orderDetails.success) {
            result = { success: true, orderSn, data: orderDetails.data };
          } else {
            throw new Error(`Failed to get order details: ${orderDetails.error}`);
          }
        } else {
          // Sync all orders
          result = await this.orderService.syncOrdersFromShopee(
            tenantId,
            channelId,
            options,
          );
        }
      } else {
        // Outbound sync (updating Shopee orders)
        if (!orderSn) {
          throw new Error('Order SN is required for outbound sync');
        }

        // This would typically involve updating order status in Shopee
        result = { success: true, message: 'Outbound order sync not implemented yet' };
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        channelId,
        `shopee_order_${syncDirection}`,
        'completed',
        `Order sync completed successfully`,
        { orderId, orderSn, result },
      );

      // Emit event
      this.eventEmitter.emit('shopee.order.sync.completed', {
        tenantId,
        channelId,
        orderId,
        orderSn,
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
        `shopee_order_${syncDirection}`,
        'failed',
        `Order sync failed: ${error.message}`,
        { orderId, orderSn, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process inventory sync jobs
   */
  @Process('inventory-sync')
  async processInventorySync(job: Job<ShopeeInventorySyncJobData>) {
    const { tenantId, channelId, productId, itemId, syncType, updates } = job.data;
    
    try {
      this.logger.debug(`Processing Shopee inventory sync: ${syncType}`, {
        tenantId,
        channelId,
        productId,
        itemId,
        syncType,
      });

      let result;

      switch (syncType) {
        case 'stock':
          if (updates) {
            // Update stock in Shopee
            result = await this.inventoryService.updateShopeeInventory(
              tenantId,
              channelId,
              updates,
            );
          } else if (itemId) {
            // Sync stock from Shopee
            const stockResult = await this.inventoryService.getShopeeStock(
              tenantId,
              channelId,
              [itemId],
            );
            result = stockResult;
          } else {
            // Sync all inventory
            result = await this.inventoryService.syncInventoryFromShopee(
              tenantId,
              channelId,
              { syncStock: true, syncPrices: false },
            );
          }
          break;

        case 'price':
          if (updates) {
            // Update prices in Shopee
            result = await this.inventoryService.updateShopeePrices(
              tenantId,
              channelId,
              updates,
            );
          } else if (itemId) {
            // Sync prices from Shopee
            const priceResult = await this.inventoryService.getShopeePrice(
              tenantId,
              channelId,
              [itemId],
            );
            result = priceResult;
          } else {
            // Sync all prices
            result = await this.inventoryService.syncInventoryFromShopee(
              tenantId,
              channelId,
              { syncStock: false, syncPrices: true },
            );
          }
          break;

        case 'both':
          // Sync both stock and prices
          result = await this.inventoryService.syncInventoryFromShopee(
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
        `shopee_inventory_${syncType}`,
        'completed',
        `Inventory ${syncType} sync completed successfully`,
        { productId, itemId, result },
      );

      // Emit event
      this.eventEmitter.emit('shopee.inventory.sync.completed', {
        tenantId,
        channelId,
        productId,
        itemId,
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
        `shopee_inventory_${syncType}`,
        'failed',
        `Inventory ${syncType} sync failed: ${error.message}`,
        { productId, itemId, error: error.message },
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
      this.logger.debug(`Processing Shopee batch sync: ${syncType}`, {
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
              result = await this.productService.syncProductToShopee(
                tenantId,
                channelId,
                item.productId,
              );
              break;

            case 'orders':
              result = await this.orderService.getShopeeOrderDetails(
                tenantId,
                channelId,
                item.orderSn,
              );
              break;

            case 'inventory':
              result = await this.inventoryService.updateShopeeInventory(
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
        `shopee_batch_${syncType}`,
        errorCount === 0 ? 'completed' : 'partial',
        `Batch ${syncType} sync completed: ${successCount}/${batchData.length} successful`,
        batchResult,
      );

      // Emit event
      this.eventEmitter.emit('shopee.batch.sync.completed', {
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
        `shopee_batch_${syncType}`,
        'failed',
        `Batch ${syncType} sync failed: ${error.message}`,
        { error: error.message },
      );

      throw error;
    }
  }
}