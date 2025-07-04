import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import {
  WebhookEvent,
  WebhookEventType,
  WebhookProcessingStatus,
} from '../../entities/webhook-event.entity';
import { Channel } from '../../../channels/entities/channel.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { TokopediaApiService } from './tokopedia-api.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export type TokopediaWebhookEventType =
  | 'order_created'
  | 'order_updated'
  | 'order_cancelled'
  | 'order_shipped'
  | 'order_delivered'
  | 'product_updated'
  | 'inventory_updated'
  | 'price_updated'
  | 'payment_confirmed'
  | 'system_notification';

export interface TokopediaWebhookPayload {
  event_type: TokopediaWebhookEventType;
  timestamp: string;
  shop_id: string;
  data: {
    order?: {
      order_id: number;
      invoice_number: string;
      status: string;
      payment_status: string;
      total_amount: number;
      items: Array<{
        product_id: number;
        sku: string;
        quantity: number;
        price: number;
      }>;
    };
    product?: {
      product_id: number;
      sku: string;
      name: string;
      status: string;
      price: number;
      stock: number;
    };
    inventory?: {
      product_id: number;
      sku: string;
      old_stock: number;
      new_stock: number;
      change_reason: string;
    };
    price?: {
      product_id: number;
      sku: string;
      old_price: number;
      new_price: number;
      effective_date: string;
    };
    payment?: {
      order_id: number;
      payment_method: string;
      amount: number;
      status: string;
      transaction_id: string;
    };
    notification?: {
      type: string;
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
    };
  };
}

@Injectable()
export class TokopediaWebhookService {
  private readonly logger = new Logger(TokopediaWebhookService.name);

  constructor(
    private readonly apiService: TokopediaApiService,
    private readonly logService: IntegrationLogService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(WebhookEvent)
    private readonly webhookRepository: Repository<WebhookEvent>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectQueue('tokopedia')
    private readonly tokopediaQueue: Queue,
  ) {}

  /**
   * Process incoming Tokopedia webhook
   */
  async processTokopediaWebhook(
    tenantId: string,
    channelId: string,
    webhookType: string,
    payload: string,
    headers: Record<string, string>,
  ): Promise<{
    success: boolean;
    webhookId?: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing Tokopedia webhook', {
        tenantId,
        channelId,
        webhookType,
        payloadSize: payload.length,
      });

      // Parse webhook payload
      let parsedPayload: TokopediaWebhookPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (error) {
        throw new Error(`Invalid JSON payload: ${error.message}`);
      }

      // Verify webhook signature
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      const signature =
        headers['x-tokopedia-signature'] || headers['x-signature'];
      if (signature) {
        const isValid = this.apiService.verifyWebhookSignature(
          payload,
          signature,
          channel.config?.clientSecret || '',
        );

        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Create webhook event record
      const webhookEvent = await this.webhookRepository.save({
        tenantId,
        channelId,
        eventType: parsedPayload.event_type as any,
        eventSource: 'webhook',
        payload: parsedPayload,
        headers,
        processingStatus: WebhookProcessingStatus.PENDING,
        createdAt: new Date(),
        processingDetails: {
          webhookType,
          shopId: parsedPayload.shop_id,
          timestamp: parsedPayload.timestamp,
        },
      });

      // Queue webhook for processing
      await this.tokopediaQueue.add(
        'process-webhook',
        {
          webhookId: webhookEvent.id,
          tenantId,
          channelId,
          eventType: parsedPayload.event_type,
          eventSource: 'webhook',
        },
        {
          attempts: 3,
          delay: 1000,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      const processingTime = Date.now() - startTime;

      this.logger.log('Tokopedia webhook queued for processing', {
        tenantId,
        channelId,
        webhookId: webhookEvent.id,
        eventType: parsedPayload.event_type,
        processingTime,
      });

      return {
        success: true,
        webhookId: webhookEvent.id,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Tokopedia webhook processing failed: ${error.message}`,
        {
          tenantId,
          channelId,
          error: error.message,
          processingTime,
        },
      );

      await this.logService.logWebhook(
        tenantId,
        channelId,
        'tokopedia_webhook',
        'failed',
        `Webhook processing failed: ${error.message}`,
        {
          webhookType,
          error: error.message,
          processingTime,
        },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle webhook event processing
   */
  async handleWebhookEvent(
    webhookId: string,
    tenantId: string,
    channelId: string,
    eventType: TokopediaWebhookEventType,
    payload: TokopediaWebhookPayload,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      this.logger.debug(`Handling Tokopedia webhook event: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
      });

      let result: { success: boolean; error?: string };

      switch (eventType) {
        case 'order_created':
          result = await this.handleOrderCreated(tenantId, channelId, payload);
          break;

        case 'order_updated':
          result = await this.handleOrderUpdated(tenantId, channelId, payload);
          break;

        case 'order_cancelled':
          result = await this.handleOrderCancelled(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'order_shipped':
          result = await this.handleOrderShipped(tenantId, channelId, payload);
          break;

        case 'order_delivered':
          result = await this.handleOrderDelivered(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'product_updated':
          result = await this.handleProductUpdated(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'inventory_updated':
          result = await this.handleInventoryUpdated(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'price_updated':
          result = await this.handlePriceUpdated(tenantId, channelId, payload);
          break;

        case 'payment_confirmed':
          result = await this.handlePaymentConfirmed(
            tenantId,
            channelId,
            payload,
          );
          break;

        case 'system_notification':
          result = await this.handleSystemNotification(
            tenantId,
            channelId,
            payload,
          );
          break;

        default:
          result = {
            success: false,
            error: `Unsupported event type: ${eventType}`,
          };
      }

      if (result.success) {
        this.logger.log(`Webhook event processed successfully: ${eventType}`, {
          webhookId,
          tenantId,
          channelId,
          eventType,
        });

        // Emit internal event
        this.eventEmitter.emit(`tokopedia.webhook.${eventType}`, {
          tenantId,
          channelId,
          webhookId,
          payload,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Webhook event handling failed: ${error.message}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    clientSecret: string,
  ): boolean {
    return this.apiService.verifyWebhookSignature(
      payload,
      signature,
      clientSecret,
    );
  }

  // Private event handlers

  private async handleOrderCreated(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.order) {
        throw new Error('Order data missing from webhook payload');
      }

      const orderData = payload.data.order;

      this.logger.log(
        `New Tokopedia order created: ${orderData.invoice_number}`,
        {
          tenantId,
          channelId,
          orderId: orderData.order_id,
          invoiceNumber: orderData.invoice_number,
          totalAmount: orderData.total_amount,
        },
      );

      // Queue order sync job
      await this.tokopediaQueue.add(
        'order-sync',
        {
          tenantId,
          channelId,
          orderId: orderData.order_id.toString(),
          syncDirection: 'inbound',
        },
        {
          attempts: 3,
          delay: 2000,
        },
      );

      // Log order webhook
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'tokopedia_order_created',
        'processed',
        `New order ${orderData.invoice_number} created`,
        {
          orderId: orderData.order_id,
          invoiceNumber: orderData.invoice_number,
          totalAmount: orderData.total_amount,
        },
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleOrderUpdated(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.order) {
        throw new Error('Order data missing from webhook payload');
      }

      const orderData = payload.data.order;

      this.logger.log(`Tokopedia order updated: ${orderData.invoice_number}`, {
        tenantId,
        channelId,
        orderId: orderData.order_id,
        status: orderData.status,
      });

      // Queue order sync job
      await this.tokopediaQueue.add(
        'order-sync',
        {
          tenantId,
          channelId,
          orderId: orderData.order_id.toString(),
          syncDirection: 'inbound',
        },
        {
          attempts: 3,
          delay: 1000,
        },
      );

      await this.logService.logWebhook(
        tenantId,
        channelId,
        'tokopedia_order_updated',
        'processed',
        `Order ${orderData.invoice_number} updated`,
        {
          orderId: orderData.order_id,
          status: orderData.status,
        },
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleOrderCancelled(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.order) {
        throw new Error('Order data missing from webhook payload');
      }

      const orderData = payload.data.order;

      this.logger.log(
        `Tokopedia order cancelled: ${orderData.invoice_number}`,
        {
          tenantId,
          channelId,
          orderId: orderData.order_id,
        },
      );

      // Queue order sync job to update status
      await this.tokopediaQueue.add(
        'order-sync',
        {
          tenantId,
          channelId,
          orderId: orderData.order_id.toString(),
          syncDirection: 'inbound',
        },
        {
          attempts: 3,
          delay: 1000,
        },
      );

      await this.logService.logWebhook(
        tenantId,
        channelId,
        'tokopedia_order_cancelled',
        'processed',
        `Order ${orderData.invoice_number} cancelled`,
        { orderId: orderData.order_id },
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleOrderShipped(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.order) {
        throw new Error('Order data missing from webhook payload');
      }

      const orderData = payload.data.order;

      this.logger.log(`Tokopedia order shipped: ${orderData.invoice_number}`, {
        tenantId,
        channelId,
        orderId: orderData.order_id,
      });

      // Queue order sync job
      await this.tokopediaQueue.add('order-sync', {
        tenantId,
        channelId,
        orderId: orderData.order_id.toString(),
        syncDirection: 'inbound',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleOrderDelivered(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.order) {
        throw new Error('Order data missing from webhook payload');
      }

      const orderData = payload.data.order;

      this.logger.log(
        `Tokopedia order delivered: ${orderData.invoice_number}`,
        {
          tenantId,
          channelId,
          orderId: orderData.order_id,
        },
      );

      // Queue order sync job
      await this.tokopediaQueue.add('order-sync', {
        tenantId,
        channelId,
        orderId: orderData.order_id.toString(),
        syncDirection: 'inbound',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleProductUpdated(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.product) {
        throw new Error('Product data missing from webhook payload');
      }

      const productData = payload.data.product;

      this.logger.log(`Tokopedia product updated: ${productData.sku}`, {
        tenantId,
        channelId,
        productId: productData.product_id,
        sku: productData.sku,
      });

      // Queue product sync job
      await this.tokopediaQueue.add('product-sync', {
        tenantId,
        channelId,
        productId: productData.product_id.toString(),
        syncDirection: 'inbound',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleInventoryUpdated(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.inventory) {
        throw new Error('Inventory data missing from webhook payload');
      }

      const inventoryData = payload.data.inventory;

      this.logger.log(`Tokopedia inventory updated: ${inventoryData.sku}`, {
        tenantId,
        channelId,
        sku: inventoryData.sku,
        oldStock: inventoryData.old_stock,
        newStock: inventoryData.new_stock,
      });

      // Queue inventory sync job
      await this.tokopediaQueue.add('inventory-sync', {
        tenantId,
        channelId,
        productId: inventoryData.product_id.toString(),
        syncType: 'stock',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handlePriceUpdated(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.price) {
        throw new Error('Price data missing from webhook payload');
      }

      const priceData = payload.data.price;

      this.logger.log(`Tokopedia price updated: ${priceData.sku}`, {
        tenantId,
        channelId,
        sku: priceData.sku,
        oldPrice: priceData.old_price,
        newPrice: priceData.new_price,
      });

      // Queue inventory sync job for price update
      await this.tokopediaQueue.add('inventory-sync', {
        tenantId,
        channelId,
        productId: priceData.product_id.toString(),
        syncType: 'price',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handlePaymentConfirmed(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.payment) {
        throw new Error('Payment data missing from webhook payload');
      }

      const paymentData = payload.data.payment;

      this.logger.log(
        `Tokopedia payment confirmed for order: ${paymentData.order_id}`,
        {
          tenantId,
          channelId,
          orderId: paymentData.order_id,
          amount: paymentData.amount,
          paymentMethod: paymentData.payment_method,
        },
      );

      // Queue order sync job to update payment status
      await this.tokopediaQueue.add('order-sync', {
        tenantId,
        channelId,
        orderId: paymentData.order_id.toString(),
        syncDirection: 'inbound',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async handleSystemNotification(
    tenantId: string,
    channelId: string,
    payload: TokopediaWebhookPayload,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!payload.data.notification) {
        throw new Error('Notification data missing from webhook payload');
      }

      const notificationData = payload.data.notification;

      this.logger.log(
        `Tokopedia system notification: ${notificationData.title}`,
        {
          tenantId,
          channelId,
          type: notificationData.type,
          severity: notificationData.severity,
          message: notificationData.message,
        },
      );

      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level:
          notificationData.severity === 'error'
            ? IntegrationLogLevel.ERROR
            : IntegrationLogLevel.INFO,
        message: `Tokopedia: ${notificationData.title}`,
        metadata: {
          type: notificationData.type,
          message: notificationData.message,
          severity: notificationData.severity,
        },
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
