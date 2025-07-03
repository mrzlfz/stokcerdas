import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { LazadaApiService } from './lazada-api.service';
import { LazadaAuthService } from './lazada-auth.service';
import { LazadaProductService } from './lazada-product.service';
import { LazadaOrderService } from './lazada-order.service';
import { LazadaInventoryService } from './lazada-inventory.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../entities/integration-log.entity';
import { WebhookEventType } from '../../entities/webhook-event.entity';

export interface LazadaWebhookPayload {
  event: string;
  seller_id: string;
  data: any;
  timestamp: number;
  signature?: string;
}

export interface OrderWebhookData {
  order_id: number;
  order_number: string;
  status: string;
  trade_order_id: string;
  seller_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductWebhookData {
  item_id: number;
  seller_sku: string;
  status: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  updated_at: string;
}

export interface InventoryWebhookData {
  seller_sku: string;
  quantity: number;
  available: number;
  reserved: number;
  updated_at: string;
}

export interface PriceWebhookData {
  seller_sku: string;
  price: string;
  special_price?: string;
  special_from_date?: string;
  special_to_date?: string;
  updated_at: string;
}

@Injectable()
export class LazadaWebhookService {
  private readonly logger = new Logger(LazadaWebhookService.name);

  constructor(
    private readonly lazadaApi: LazadaApiService,
    private readonly authService: LazadaAuthService,
    private readonly productService: LazadaProductService,
    private readonly orderService: LazadaOrderService,
    private readonly inventoryService: LazadaInventoryService,
    private readonly logService: IntegrationLogService,
    private readonly webhookHandler: WebhookHandlerService,
  ) {}

  /**
   * Process Lazada webhook event
   */
  async processLazadaWebhook(
    tenantId: string,
    channelId: string,
    webhookType: string,
    payload: string,
    headers: Record<string, string>,
  ): Promise<{ success: boolean; webhookId?: string; error?: string }> {
    try {
      this.logger.debug(`Processing Lazada webhook: ${webhookType}`, {
        tenantId,
        channelId,
        payloadSize: payload.length,
      });

      // Parse webhook payload
      let webhookData: LazadaWebhookPayload;
      try {
        webhookData = JSON.parse(payload);
      } catch (error) {
        throw new Error(`Invalid JSON payload: ${error.message}`);
      }

      // Verify webhook signature if present
      const signature = headers['x-lazada-signature'] || headers['authorization'];
      if (signature) {
        const isValid = await this.verifyWebhookSignature(tenantId, channelId, payload, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Determine event type
      const eventType = this.mapWebhookEventType(webhookData.event);

      // Create webhook record
      const webhookRecord = await this.webhookHandler.processWebhook({
        tenantId,
        channelId,
        eventType,
        eventSource: 'lazada',
        payload: webhookData,
        headers,
        rawPayload: payload,
        signatureHeader: signature,
        webhookUrl: '', // This would be filled by the caller
        eventTimestamp: new Date(webhookData.timestamp * 1000),
        externalEventId: this.generateExternalEventId(webhookData),
        priority: this.getEventPriority(eventType),
      });

      if (!webhookRecord.success) {
        throw new Error(webhookRecord.error || 'Failed to create webhook record');
      }

      // Process the webhook event
      const result = await this.handleWebhookEvent(
        webhookRecord.webhookId!,
        tenantId,
        channelId,
        eventType,
        webhookData,
      );

      return {
        success: result.success,
        webhookId: webhookRecord.webhookId,
        error: result.error,
      };

    } catch (error) {
      this.logger.error(`Lazada webhook processing failed: ${error.message}`, error.stack);

      // Log webhook error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'lazada_webhook',
        'failed',
        `Lazada webhook processing failed: ${error.message}`,
        {
          webhookType,
          error: error.message,
          payloadSize: payload.length,
        },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle specific webhook event types
   */
  async handleWebhookEvent(
    webhookId: string,
    tenantId: string,
    channelId: string,
    eventType: WebhookEventType,
    payload: LazadaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling Lazada webhook event: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
      });

      let result = { success: true };

      switch (eventType) {
        case WebhookEventType.ORDER_CREATED:
        case WebhookEventType.ORDER_UPDATED:
          result = await this.handleOrderEvent(tenantId, channelId, payload.data as OrderWebhookData);
          break;

        case WebhookEventType.ORDER_CANCELLED:
          result = await this.handleOrderCancelledEvent(tenantId, channelId, payload.data as OrderWebhookData);
          break;

        case WebhookEventType.ORDER_COMPLETED:
          result = await this.handleOrderShippingEvent(tenantId, channelId, payload.data as OrderWebhookData);
          break;

        case WebhookEventType.PRODUCT_UPDATED:
          result = await this.handleProductEvent(tenantId, channelId, payload.data as ProductWebhookData);
          break;

        case WebhookEventType.INVENTORY_UPDATED:
          result = await this.handleInventoryEvent(tenantId, channelId, payload.data as InventoryWebhookData);
          break;

        case WebhookEventType.SYSTEM_NOTIFICATION:
          result = await this.handleSystemEvent(tenantId, channelId, eventType, payload.data);
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${eventType}`, {
            webhookId,
            tenantId,
            channelId,
          });
          result = { success: true }; // Don't fail for unknown events
      }

      if (result.success) {
        // Log successful event processing
        await this.logService.logWebhook(
          tenantId,
          channelId,
          `lazada_${eventType}`,
          'processed',
          `Lazada ${eventType} webhook processed successfully`,
          { webhookId, data: payload.data },
        );
      }

      return result;

    } catch (error) {
      this.logger.error(`Webhook event handling failed: ${error.message}`, error.stack);

      // Log event processing error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        `lazada_${eventType}`,
        'failed',
        `Lazada ${eventType} webhook processing failed: ${error.message}`,
        { webhookId, error: error.message },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    tenantId: string,
    channelId: string,
    payload: string,
    signature: string,
  ): Promise<boolean> {
    try {
      // Get channel credentials to get app secret
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      return this.verifySignature(payload, signature, credentials.appSecret);

    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Verify signature with app secret
   */
  verifySignature(payload: string, signature: string, appSecret: string): boolean {
    try {
      // Remove any prefix from signature
      const cleanSignature = signature.replace(/^(sha256=|sha1=)/, '');

      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');

      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );

    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`, error.stack);
      return false;
    }
  }

  // Private event handlers

  private async handleOrderEvent(
    tenantId: string,
    channelId: string,
    orderData: OrderWebhookData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling order event`, {
        tenantId,
        channelId,
        orderNumber: orderData.order_number,
        status: orderData.status,
      });

      // Fetch latest order details and sync
      const result = await this.orderService.getLazadaOrderDetails(
        tenantId,
        channelId,
        orderData.order_number,
      );

      if (!result.success) {
        throw new Error(`Failed to fetch order details: ${result.error}`);
      }

      // The order details fetching will handle the sync automatically
      return { success: true };

    } catch (error) {
      this.logger.error(`Order event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleOrderCancelledEvent(
    tenantId: string,
    channelId: string,
    orderData: OrderWebhookData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling order cancelled event`, {
        tenantId,
        channelId,
        orderNumber: orderData.order_number,
      });

      // Update local order status to cancelled
      // This would need implementation based on your order management system
      
      return { success: true };

    } catch (error) {
      this.logger.error(`Order cancelled event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleOrderShippingEvent(
    tenantId: string,
    channelId: string,
    orderData: OrderWebhookData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling order shipping event`, {
        tenantId,
        channelId,
        orderNumber: orderData.order_number,
        status: orderData.status,
      });

      // Update local order status and get tracking info
      // This would need implementation based on your order management system
      
      return { success: true };

    } catch (error) {
      this.logger.error(`Order shipping event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleProductEvent(
    tenantId: string,
    channelId: string,
    productData: ProductWebhookData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling product event`, {
        tenantId,
        channelId,
        itemId: productData.item_id,
        action: productData.action,
      });

      // Fetch latest product details and sync
      const result = await this.productService.getLazadaProductDetails(
        tenantId,
        channelId,
        productData.item_id,
      );

      if (!result.success) {
        throw new Error(`Failed to fetch product details: ${result.error}`);
      }

      // The product details fetching will handle the sync automatically
      return { success: true };

    } catch (error) {
      this.logger.error(`Product event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleInventoryEvent(
    tenantId: string,
    channelId: string,
    inventoryData: InventoryWebhookData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling inventory event`, {
        tenantId,
        channelId,
        sellerSku: inventoryData.seller_sku,
        quantity: inventoryData.quantity,
      });

      // Sync inventory for this specific SKU
      const result = await this.inventoryService.syncSingleSkuInventory(
        tenantId,
        channelId,
        inventoryData.seller_sku,
      );

      if (!result.success) {
        throw new Error(`Failed to sync inventory: ${result.error}`);
      }

      return { success: true };

    } catch (error) {
      this.logger.error(`Inventory event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handlePriceEvent(
    tenantId: string,
    channelId: string,
    priceData: PriceWebhookData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling price event`, {
        tenantId,
        channelId,
        sellerSku: priceData.seller_sku,
        price: priceData.price,
      });

      // Sync pricing for this specific SKU
      const result = await this.inventoryService.getLazadaPrice(
        tenantId,
        channelId,
        [priceData.seller_sku],
      );

      if (!result.success) {
        throw new Error(`Failed to sync price: ${result.error}`);
      }

      return { success: true };

    } catch (error) {
      this.logger.error(`Price event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleSystemEvent(
    tenantId: string,
    channelId: string,
    eventType: WebhookEventType,
    data: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Handling system event: ${eventType}`, {
        tenantId,
        channelId,
        data,
      });

      // Log system event for monitoring
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.WEBHOOK,
        level: IntegrationLogLevel.INFO,
        message: `Lazada system event received: ${eventType}`,
        metadata: { eventType, data },
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`System event handling failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper methods

  private mapWebhookEventType(lazadaEvent: string): WebhookEventType {
    // Map Lazada event names to our internal event types
    const eventMapping: Record<string, WebhookEventType> = {
      'order_created': WebhookEventType.ORDER_CREATED,
      'order_updated': WebhookEventType.ORDER_UPDATED,
      'order_status_changed': WebhookEventType.ORDER_UPDATED,
      'order_cancelled': WebhookEventType.ORDER_CANCELLED,
      'order_shipped': WebhookEventType.ORDER_UPDATED,
      'order_delivered': WebhookEventType.ORDER_COMPLETED,
      'product_updated': WebhookEventType.PRODUCT_UPDATED,
      'product_status_changed': WebhookEventType.PRODUCT_UPDATED,
      'inventory_updated': WebhookEventType.INVENTORY_UPDATED,
      'price_updated': WebhookEventType.PRODUCT_UPDATED,
      'seller_performance': WebhookEventType.SYSTEM_NOTIFICATION,
      'promotion_updated': WebhookEventType.SYSTEM_NOTIFICATION,
      'finance_updated': WebhookEventType.SYSTEM_NOTIFICATION,
    };

    return eventMapping[lazadaEvent] || WebhookEventType.SYSTEM_NOTIFICATION;
  }

  private generateExternalEventId(webhookData: LazadaWebhookPayload): string {
    const timestamp = webhookData.timestamp || Date.now();
    const event = webhookData.event || 'unknown';
    const sellerId = webhookData.seller_id || 'unknown';
    
    return `lazada_${event}_${sellerId}_${timestamp}`;
  }

  private getEventPriority(eventType: WebhookEventType): number {
    // Assign priority levels for different event types
    const priorityMap: Record<WebhookEventType, number> = {
      [WebhookEventType.ORDER_CREATED]: 1, // High priority
      [WebhookEventType.ORDER_CANCELLED]: 1, // High priority
      [WebhookEventType.ORDER_UPDATED]: 2, // Normal priority
      [WebhookEventType.ORDER_COMPLETED]: 2, // Normal priority
      [WebhookEventType.ORDER_REFUNDED]: 2, // Normal priority
      [WebhookEventType.INVENTORY_UPDATED]: 2, // Normal priority
      [WebhookEventType.PRODUCT_UPDATED]: 3, // Low priority
      [WebhookEventType.PRODUCT_CREATED]: 3, // Low priority
      [WebhookEventType.PRODUCT_DELETED]: 3, // Low priority
      [WebhookEventType.PAYMENT_COMPLETED]: 2, // Normal priority
      [WebhookEventType.PAYMENT_FAILED]: 1, // High priority
      [WebhookEventType.CUSTOMER_CREATED]: 3, // Low priority
      [WebhookEventType.CUSTOMER_UPDATED]: 3, // Low priority
      [WebhookEventType.SHOP_UPDATED]: 3, // Low priority
      [WebhookEventType.SYSTEM_NOTIFICATION]: 3, // Low priority
    };

    return priorityMap[eventType] || 3;
  }
}