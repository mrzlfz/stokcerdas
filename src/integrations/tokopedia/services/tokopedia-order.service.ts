import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Order } from '../../../orders/entities/order.entity';
import { OrderItem } from '../../../orders/entities/order-item.entity';
import { Channel } from '../../../channels/entities/channel.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { TokopediaApiService, TokopediaConfig } from './tokopedia-api.service';
import { TokopediaAuthService } from './tokopedia-auth.service';

export interface OrderSyncOptions {
  offset?: number;
  limit?: number;
  status?: 'all' | 'new' | 'processed' | 'shipped' | 'delivered' | 'cancelled';
  sortBy?: 'created_at' | 'updated_at';
  sortDirection?: 'ASC' | 'DESC';
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface TokopediaOrder {
  order_id: number;
  invoice_number: string;
  order_status: string;
  buyer: {
    user_id: number;
    name: string;
    email: string;
    phone: string;
  };
  shop: {
    shop_id: number;
    shop_name: string;
  };
  payment: {
    payment_method: string;
    payment_status: string;
    total_amount: number;
    payment_date: string;
  };
  shipping: {
    shipping_service: string;
    shipping_cost: number;
    recipient_name: string;
    recipient_phone: string;
    address: {
      street: string;
      city: string;
      province: string;
      postal_code: string;
      country: string;
    };
    tracking_number?: string;
    estimated_delivery?: string;
  };
  order_items: TokopediaOrderItem[];
  created_at: string;
  updated_at: string;
  total_weight: number;
  total_amount: number;
  notes?: string;
  voucher_info?: {
    voucher_code: string;
    discount_amount: number;
  };
  cashback_info?: {
    cashback_amount: number;
  };
}

export interface TokopediaOrderItem {
  order_item_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  variant_id?: number;
  variant_name?: string;
  quantity: number;
  price_per_item: number;
  total_price: number;
  weight_per_item: number;
  total_weight: number;
  notes?: string;
  insurance_required: boolean;
}

export interface TokopediaOrderStatusMapping {
  [key: string]: string;
}

export interface ShipmentRequest {
  order_item_ids: number[];
  shipping_service: string;
  tracking_number?: string;
  shipping_date?: Date;
  notes?: string;
}

@Injectable()
export class TokopediaOrderService {
  private readonly logger = new Logger(TokopediaOrderService.name);

  // Tokopedia order status mapping to local status
  private readonly statusMapping: TokopediaOrderStatusMapping = {
    'waiting_payment': 'pending',
    'payment_verified': 'confirmed',
    'processing': 'processing',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'cancelled',
    'return_requested': 'return_requested',
    'returned': 'returned',
    'refunded': 'refunded',
  };

  constructor(
    private readonly apiService: TokopediaApiService,
    private readonly authService: TokopediaAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
  ) {}

  /**
   * Sync orders from Tokopedia to local system
   */
  async syncOrdersFromTokopedia(
    tenantId: string,
    channelId: string,
    options: OrderSyncOptions = {},
  ): Promise<{
    success: boolean;
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      this.logger.log(`Starting Tokopedia order sync`, {
        tenantId,
        channelId,
        options,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      // Build API parameters
      const params: Record<string, any> = {
        page: Math.floor((options.offset || 0) / (options.limit || 20)) + 1,
        per_page: options.limit || 20,
        sort_by: options.sortBy || 'created_at',
        sort_direction: options.sortDirection || 'DESC',
      };

      if (options.status && options.status !== 'all') {
        params.status = options.status;
      }

      if (options.createdAfter) {
        params.created_after = options.createdAfter.toISOString();
      }

      if (options.createdBefore) {
        params.created_before = options.createdBefore.toISOString();
      }

      if (options.updatedAfter) {
        params.updated_after = options.updatedAfter.toISOString();
      }

      if (options.updatedBefore) {
        params.updated_before = options.updatedBefore.toISOString();
      }

      // Fetch orders from Tokopedia
      const result = await this.apiService.makeRequest<{
        orders: TokopediaOrder[];
        pagination: {
          current_page: number;
          total_pages: number;
          total_orders: number;
        };
      }>(
        tenantId,
        channelId,
        config,
        {
          method: 'GET',
          endpoint: '/v1/orders',
          params,
          requiresAuth: true,
        },
      );

      if (!result.success || !result.data?.orders) {
        throw new Error(result.error || 'Failed to fetch orders from Tokopedia');
      }

      const orders = result.data.orders;

      this.logger.log(`Fetched ${orders.length} orders from Tokopedia`, {
        tenantId,
        channelId,
        totalOrders: result.data.pagination?.total_orders,
      });

      // Process each order
      for (const tokopediaOrder of orders) {
        try {
          await this.processInboundOrder(tenantId, channelId, tokopediaOrder);
          syncedCount++;
        } catch (error) {
          this.logger.error(`Failed to process order ${tokopediaOrder.order_id}: ${error.message}`, error.stack);
          errors.push(`Order ${tokopediaOrder.order_id}: ${error.message}`);
          errorCount++;
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(`Tokopedia order sync completed`, {
        tenantId,
        channelId,
        syncedCount,
        errorCount,
        processingTime,
      });

      // Log sync result
      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_order_inbound',
        errorCount === 0 ? 'completed' : 'partial',
        `Synced ${syncedCount} orders from Tokopedia`,
        {
          syncedCount,
          errorCount,
          processingTime,
          options,
        },
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.order.sync.completed', {
        tenantId,
        channelId,
        syncedCount,
        errorCount,
        processingTime,
      });

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Tokopedia order sync failed: ${error.message}`, error.stack);

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_order_inbound',
        'failed',
        `Order sync failed: ${error.message}`,
        { error: error.message, processingTime },
      );

      return {
        success: false,
        syncedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Get Tokopedia order details
   */
  async getTokopediaOrderDetails(
    tenantId: string,
    channelId: string,
    orderId: number,
  ): Promise<{
    success: boolean;
    data?: TokopediaOrder;
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      const result = await this.apiService.makeRequest<TokopediaOrder>(
        tenantId,
        channelId,
        config,
        {
          method: 'GET',
          endpoint: `/v1/orders/${orderId}`,
          requiresAuth: true,
        },
      );

      return result;

    } catch (error) {
      this.logger.error(`Failed to get Tokopedia order details: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Ship Tokopedia order items
   */
  async shipTokopediaOrder(
    tenantId: string,
    channelId: string,
    shipmentRequest: ShipmentRequest,
  ): Promise<{
    success: boolean;
    shipment_id?: string;
    error?: string;
  }> {
    try {
      this.logger.log(`Shipping Tokopedia order items`, {
        tenantId,
        channelId,
        orderItemIds: shipmentRequest.order_item_ids,
      });

      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      const shipmentData = {
        order_item_ids: shipmentRequest.order_item_ids,
        shipping_service: shipmentRequest.shipping_service,
        shipping_date: shipmentRequest.shipping_date?.toISOString() || new Date().toISOString(),
        ...(shipmentRequest.tracking_number && { tracking_number: shipmentRequest.tracking_number }),
        ...(shipmentRequest.notes && { notes: shipmentRequest.notes }),
      };

      const result = await this.apiService.makeRequest<{ shipment_id: string }>(
        tenantId,
        channelId,
        config,
        {
          method: 'POST',
          endpoint: '/v1/orders/ship',
          data: shipmentData,
          requiresAuth: true,
        },
      );

      if (result.success) {
        this.logger.log(`Order items shipped successfully`, {
          tenantId,
          channelId,
          orderItemIds: shipmentRequest.order_item_ids,
          shipmentId: result.data?.shipment_id,
        });

        await this.logService.log({
          tenantId,
          channelId,
          type: 'ORDER',
          level: 'INFO',
          message: 'Tokopedia order items shipped',
          metadata: {
            orderItemIds: shipmentRequest.order_item_ids,
            shipmentId: result.data?.shipment_id,
            trackingNumber: shipmentRequest.tracking_number,
          },
        });

        return {
          success: true,
          shipment_id: result.data?.shipment_id,
        };
      } else {
        throw new Error(result.error || 'Failed to ship order items');
      }

    } catch (error) {
      this.logger.error(`Failed to ship Tokopedia order: ${error.message}`, error.stack);

      await this.logService.logError(
        tenantId,
        channelId,
        error,
        { context: 'ship_order', orderItemIds: shipmentRequest.order_item_ids },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel Tokopedia order items
   */
  async cancelTokopediaOrder(
    tenantId: string,
    channelId: string,
    orderItemIds: number[],
    cancelReason: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      this.logger.log(`Cancelling Tokopedia order items`, {
        tenantId,
        channelId,
        orderItemIds,
        cancelReason,
      });

      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      const result = await this.apiService.makeRequest(
        tenantId,
        channelId,
        config,
        {
          method: 'POST',
          endpoint: '/v1/orders/cancel',
          data: {
            order_item_ids: orderItemIds,
            cancel_reason: cancelReason,
          },
          requiresAuth: true,
        },
      );

      if (result.success) {
        this.logger.log(`Order items cancelled successfully`, {
          tenantId,
          channelId,
          orderItemIds,
        });

        await this.logService.log({
          tenantId,
          channelId,
          type: 'ORDER',
          level: 'INFO',
          message: 'Tokopedia order items cancelled',
          metadata: {
            orderItemIds,
            cancelReason,
          },
        });

        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to cancel order items');
      }

    } catch (error) {
      this.logger.error(`Failed to cancel Tokopedia order: ${error.message}`, error.stack);

      await this.logService.logError(
        tenantId,
        channelId,
        error,
        { context: 'cancel_order', orderItemIds },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update order tracking information
   */
  async updateOrderTracking(
    tenantId: string,
    channelId: string,
    orderItemIds: number[],
    trackingNumber: string,
    shippingService: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      const result = await this.apiService.makeRequest(
        tenantId,
        channelId,
        config,
        {
          method: 'PUT',
          endpoint: '/v1/orders/tracking',
          data: {
            order_item_ids: orderItemIds,
            tracking_number: trackingNumber,
            shipping_service: shippingService,
          },
          requiresAuth: true,
        },
      );

      return result;

    } catch (error) {
      this.logger.error(`Failed to update order tracking: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async processInboundOrder(
    tenantId: string,
    channelId: string,
    tokopediaOrder: TokopediaOrder,
  ): Promise<void> {
    // Check if we already have a mapping for this order
    let mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'order',
        externalId: tokopediaOrder.order_id.toString(),
      },
    });

    let order: Order;

    if (mapping) {
      // Update existing order
      order = await this.orderRepository.findOne({
        where: { id: mapping.internalId, tenantId },
        relations: ['items'],
      });

      if (!order) {
        throw new Error(`Mapped order ${mapping.internalId} not found`);
      }
    } else {
      // Create new order
      order = new Order();
      order.tenantId = tenantId;
    }

    // Map Tokopedia order data to local order
    order.orderNumber = tokopediaOrder.invoice_number;
    order.channelId = channelId;
    order.status = this.statusMapping[tokopediaOrder.order_status] || 'pending';
    order.totalAmount = tokopediaOrder.total_amount;
    order.shippingCost = tokopediaOrder.shipping.shipping_cost;
    order.orderDate = new Date(tokopediaOrder.created_at);
    order.paymentMethod = tokopediaOrder.payment.payment_method;
    order.paymentStatus = tokopediaOrder.payment.payment_status === 'paid' ? 'paid' : 'pending';

    // Customer information
    order.customerName = tokopediaOrder.buyer.name;
    order.customerEmail = tokopediaOrder.buyer.email;
    order.customerPhone = tokopediaOrder.buyer.phone;

    // Shipping information
    order.shippingAddress = {
      recipientName: tokopediaOrder.shipping.recipient_name,
      recipientPhone: tokopediaOrder.shipping.recipient_phone,
      street: tokopediaOrder.shipping.address.street,
      city: tokopediaOrder.shipping.address.city,
      province: tokopediaOrder.shipping.address.province,
      postalCode: tokopediaOrder.shipping.address.postal_code,
      country: tokopediaOrder.shipping.address.country,
    };

    order.trackingNumber = tokopediaOrder.shipping.tracking_number;
    order.metadata = {
      tokopedia: {
        orderId: tokopediaOrder.order_id,
        invoiceNumber: tokopediaOrder.invoice_number,
        shippingService: tokopediaOrder.shipping.shipping_service,
        totalWeight: tokopediaOrder.total_weight,
        lastSyncAt: new Date(),
      },
    };

    // Save order
    const savedOrder = await this.orderRepository.save(order);

    // Process order items
    if (tokopediaOrder.order_items) {
      for (const tokopediaItem of tokopediaOrder.order_items) {
        await this.processOrderItem(tenantId, savedOrder.id, tokopediaItem);
      }
    }

    // Create or update mapping
    if (!mapping) {
      await this.mappingRepository.save({
        tenantId,
        channelId,
        entityType: 'order',
        internalId: savedOrder.id,
        externalId: tokopediaOrder.order_id.toString(),
        metadata: {
          syncedAt: new Date(),
          invoiceNumber: tokopediaOrder.invoice_number,
        },
      });
    } else {
      mapping.metadata = {
        ...mapping.metadata,
        syncedAt: new Date(),
        invoiceNumber: tokopediaOrder.invoice_number,
      };
      await this.mappingRepository.save(mapping);
    }
  }

  private async processOrderItem(
    tenantId: string,
    orderId: string,
    tokopediaItem: TokopediaOrderItem,
  ): Promise<void> {
    // Check if order item already exists
    let orderItem = await this.orderItemRepository.findOne({
      where: {
        orderId,
        metadata: {
          tokopedia: {
            orderItemId: tokopediaItem.order_item_id,
          },
        } as any,
      },
    });

    if (!orderItem) {
      orderItem = new OrderItem();
      orderItem.orderId = orderId;
    }

    orderItem.productName = tokopediaItem.product_name;
    orderItem.productSku = tokopediaItem.product_sku;
    orderItem.quantity = tokopediaItem.quantity;
    orderItem.unitPrice = tokopediaItem.price_per_item;
    orderItem.totalPrice = tokopediaItem.total_price;
    orderItem.weight = tokopediaItem.weight_per_item;

    orderItem.metadata = {
      tokopedia: {
        orderItemId: tokopediaItem.order_item_id,
        productId: tokopediaItem.product_id,
        variantId: tokopediaItem.variant_id,
        variantName: tokopediaItem.variant_name,
        totalWeight: tokopediaItem.total_weight,
        insuranceRequired: tokopediaItem.insurance_required,
        notes: tokopediaItem.notes,
      },
    };

    await this.orderItemRepository.save(orderItem);
  }
}