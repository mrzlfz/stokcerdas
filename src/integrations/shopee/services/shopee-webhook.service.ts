import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  WebhookHandlerService,
  WebhookPayload,
  WebhookConfig,
} from '../../common/services/webhook-handler.service';
import { ShopeeAuthService } from './shopee-auth.service';
import { ShopeeOrderService } from './shopee-order.service';
import { ShopeeProductService } from './shopee-product.service';
import { ShopeeInventoryService } from './shopee-inventory.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WebhookEventType } from '../../entities/webhook-event.entity';

export interface ShopeeWebhookPayload {
  code: number;
  shop_id: number;
  timestamp: number;
  data: {
    ordersn?: string;
    update_time?: number;
    status?: number;
    items?: Array<{
      item_id: number;
      item_sku: string;
      variation_id: number;
      variation_sku: string;
      quantity: number;
    }>;
    // Product webhook data
    item_id?: number;
    item_sku?: string;
    variation_id?: number;
    variation_sku?: string;
    // Logistics webhook data
    tracking_number?: string;
    logistics_status?: number;
  };
}

@Injectable()
export class ShopeeWebhookService {
  private readonly logger = new Logger(ShopeeWebhookService.name);

  constructor(
    private readonly webhookHandler: WebhookHandlerService,
    private readonly authService: ShopeeAuthService,
    private readonly orderService: ShopeeOrderService,
    private readonly productService: ShopeeProductService,
    private readonly inventoryService: ShopeeInventoryService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Process incoming Shopee webhook
   */
  async processShopeeWebhook(
    tenantId: string,
    channelId: string,
    webhookType: string,
    payload: string,
    headers: Record<string, string>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; webhookId?: string; error?: string }> {
    try {
      // Parse Shopee payload
      const shopeePayload: ShopeeWebhookPayload = JSON.parse(payload);

      // Map webhook type to our event type
      const eventType = this.mapShopeeWebhookType(webhookType);

      if (!eventType) {
        throw new Error(`Unsupported Shopee webhook type: ${webhookType}`);
      }

      // Get webhook configuration
      const config = await this.getWebhookConfig(tenantId, channelId);

      // Prepare webhook data
      const webhookData: WebhookPayload = {
        tenantId,
        channelId,
        eventType,
        eventSource: 'shopee',
        payload: shopeePayload,
        headers,
        rawPayload: payload,
        signatureHeader: headers['authorization'],
        ipAddress,
        userAgent,
        webhookUrl: headers['x-original-uri'] || headers['x-forwarded-uri'],
        eventTimestamp: new Date(shopeePayload.timestamp * 1000),
        externalEventId: this.generateExternalEventId(
          shopeePayload,
          webhookType,
        ),
        priority: this.getWebhookPriority(eventType),
      };

      // Process webhook through handler
      const result = await this.webhookHandler.processWebhook(
        webhookData,
        config,
      );

      if (result.success) {
        await this.logService.logWebhook(
          tenantId,
          channelId,
          eventType,
          'received',
          `Shopee webhook ${webhookType} received successfully`,
          {
            webhookId: result.webhookId,
            shopeeCode: shopeePayload.code,
            shopId: shopeePayload.shop_id,
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Shopee webhook processing failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logWebhook(
        tenantId,
        channelId,
        'system_notification',
        'failed',
        `Shopee webhook processing failed: ${error.message}`,
        { webhookType, error: error.stack },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle processed webhook events
   */
  async handleWebhookEvent(
    webhookId: string,
    tenantId: string,
    channelId: string,
    eventType: WebhookEventType,
    payload: ShopeeWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Processing Shopee webhook event: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
      });

      switch (eventType) {
        case WebhookEventType.ORDER_CREATED:
        case WebhookEventType.ORDER_UPDATED:
          return await this.handleOrderWebhook(tenantId, channelId, payload);

        case WebhookEventType.ORDER_CANCELLED:
          return await this.handleOrderCancellation(
            tenantId,
            channelId,
            payload,
          );

        case WebhookEventType.ORDER_COMPLETED:
          return await this.handleOrderCompletion(tenantId, channelId, payload);

        case WebhookEventType.PRODUCT_UPDATED:
          return await this.handleProductUpdate(tenantId, channelId, payload);

        case WebhookEventType.INVENTORY_UPDATED:
          return await this.handleInventoryUpdate(tenantId, channelId, payload);

        default:
          this.logger.warn(`Unhandled Shopee webhook event type: ${eventType}`);
          return { success: true }; // Mark as handled but no action needed
      }
    } catch (error) {
      this.logger.error(
        `Webhook event handling failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logWebhook(
        tenantId,
        channelId,
        eventType,
        'failed',
        `Webhook event handling failed: ${error.message}`,
        { webhookId, error: error.stack },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify Shopee webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    partnerKey: string,
    webhookUrl: string,
  ): boolean {
    try {
      // Shopee webhook signature format: {webhook_url}|{request_body}
      const stringToSign = `${webhookUrl}|${payload}`;

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', partnerKey)
        .update(stringToSign)
        .digest('hex');

      // Extract signature from Authorization header
      const receivedSignature = signature.replace(/^sha256=/, '');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error(
        `Shopee webhook signature verification failed: ${error.message}`,
      );
      return false;
    }
  }

  // Private helper methods

  private mapShopeeWebhookType(webhookType: string): WebhookEventType | null {
    const typeMap: Record<string, WebhookEventType> = {
      order_status_update: WebhookEventType.ORDER_UPDATED,
      order_trackingno_update: WebhookEventType.ORDER_UPDATED,
      banned_item: WebhookEventType.PRODUCT_UPDATED,
      item_promotion_update: WebhookEventType.PRODUCT_UPDATED,
      reserved_stock_change: WebhookEventType.INVENTORY_UPDATED,
    };

    return typeMap[webhookType] || null;
  }

  private async getWebhookConfig(
    tenantId: string,
    channelId: string,
  ): Promise<WebhookConfig | undefined> {
    try {
      // Get partner key from channel credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      if (!credentials.partnerKey) {
        this.logger.warn(
          `No partner key found for Shopee channel ${channelId}`,
        );
        return undefined;
      }

      return {
        platform: 'shopee',
        signatureHeader: 'authorization',
        secretKey: credentials.partnerKey,
        signatureAlgorithm: 'sha256',
        signatureFormat: 'hex',
        maxRetries: 3,
        retryDelay: 5000,
      };
    } catch (error) {
      this.logger.error(`Failed to get webhook config: ${error.message}`);
      return undefined;
    }
  }

  private generateExternalEventId(
    payload: ShopeeWebhookPayload,
    webhookType: string,
  ): string {
    // Generate unique ID based on payload content
    const identifier =
      payload.data.ordersn ||
      payload.data.item_id?.toString() ||
      payload.shop_id.toString();

    return `shopee_${webhookType}_${identifier}_${payload.timestamp}`;
  }

  private getWebhookPriority(eventType: WebhookEventType): number {
    // Priority mapping for different event types
    const priorityMap: Record<WebhookEventType, number> = {
      [WebhookEventType.ORDER_CREATED]: 3, // High priority
      [WebhookEventType.ORDER_UPDATED]: 3, // High priority
      [WebhookEventType.ORDER_CANCELLED]: 3, // High priority
      [WebhookEventType.ORDER_COMPLETED]: 2, // Normal priority
      [WebhookEventType.PAYMENT_COMPLETED]: 3, // High priority
      [WebhookEventType.PAYMENT_FAILED]: 4, // Urgent priority
      [WebhookEventType.PRODUCT_UPDATED]: 2, // Normal priority
      [WebhookEventType.INVENTORY_UPDATED]: 2, // Normal priority
      [WebhookEventType.SYSTEM_NOTIFICATION]: 1, // Low priority
    } as any;

    return priorityMap[eventType] || 2; // Default to normal priority
  }

  private async handleOrderWebhook(
    tenantId: string,
    channelId: string,
    payload: ShopeeWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.ordersn) {
        throw new Error('Order SN not found in webhook payload');
      }

      // Sync the specific order
      const orderDetails = await this.orderService.getShopeeOrderDetails(
        tenantId,
        channelId,
        payload.data.ordersn,
      );

      if (!orderDetails.success) {
        throw new Error(`Failed to get order details: ${orderDetails.error}`);
      }

      // Emit order update event
      this.eventEmitter.emit('shopee.order.updated', {
        tenantId,
        channelId,
        orderSn: payload.data.ordersn,
        orderData: orderDetails.data,
        webhookPayload: payload,
      });

      await this.logService.logWebhook(
        tenantId,
        channelId,
        WebhookEventType.ORDER_UPDATED,
        'processed',
        `Order ${payload.data.ordersn} webhook processed successfully`,
        { orderSn: payload.data.ordersn },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Order webhook handling failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleOrderCancellation(
    tenantId: string,
    channelId: string,
    payload: ShopeeWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.ordersn) {
        throw new Error('Order SN not found in webhook payload');
      }

      // Emit order cancellation event
      this.eventEmitter.emit('shopee.order.cancelled', {
        tenantId,
        channelId,
        orderSn: payload.data.ordersn,
        webhookPayload: payload,
      });

      await this.logService.logWebhook(
        tenantId,
        channelId,
        WebhookEventType.ORDER_CANCELLED,
        'processed',
        `Order ${payload.data.ordersn} cancellation webhook processed`,
        { orderSn: payload.data.ordersn },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Order cancellation webhook handling failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleOrderCompletion(
    tenantId: string,
    channelId: string,
    payload: ShopeeWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.ordersn) {
        throw new Error('Order SN not found in webhook payload');
      }

      // Emit order completion event
      this.eventEmitter.emit('shopee.order.completed', {
        tenantId,
        channelId,
        orderSn: payload.data.ordersn,
        webhookPayload: payload,
      });

      await this.logService.logWebhook(
        tenantId,
        channelId,
        WebhookEventType.ORDER_COMPLETED,
        'processed',
        `Order ${payload.data.ordersn} completion webhook processed`,
        { orderSn: payload.data.ordersn },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Order completion webhook handling failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleProductUpdate(
    tenantId: string,
    channelId: string,
    payload: ShopeeWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.item_id) {
        throw new Error('Item ID not found in webhook payload');
      }

      // Emit product update event
      this.eventEmitter.emit('shopee.product.updated', {
        tenantId,
        channelId,
        itemId: payload.data.item_id,
        itemSku: payload.data.item_sku,
        variationId: payload.data.variation_id,
        variationSku: payload.data.variation_sku,
        webhookPayload: payload,
      });

      await this.logService.logWebhook(
        tenantId,
        channelId,
        WebhookEventType.PRODUCT_UPDATED,
        'processed',
        `Product ${payload.data.item_id} update webhook processed`,
        { itemId: payload.data.item_id },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Product update webhook handling failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async handleInventoryUpdate(
    tenantId: string,
    channelId: string,
    payload: ShopeeWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.item_id) {
        throw new Error('Item ID not found in webhook payload');
      }

      // Trigger inventory sync for the specific item
      const inventoryResult = await this.inventoryService.getShopeeStock(
        tenantId,
        channelId,
        [payload.data.item_id],
      );

      if (inventoryResult.success && inventoryResult.data?.[0]) {
        // Emit inventory update event
        this.eventEmitter.emit('shopee.inventory.updated', {
          tenantId,
          channelId,
          itemId: payload.data.item_id,
          stockInfo: inventoryResult.data[0],
          webhookPayload: payload,
        });
      }

      await this.logService.logWebhook(
        tenantId,
        channelId,
        WebhookEventType.INVENTORY_UPDATED,
        'processed',
        `Inventory ${payload.data.item_id} update webhook processed`,
        { itemId: payload.data.item_id },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Inventory update webhook handling failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
