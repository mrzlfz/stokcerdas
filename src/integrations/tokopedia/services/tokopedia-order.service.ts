import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  Order,
  OrderStatus,
  PaymentStatus,
} from '../../../orders/entities/order.entity';
import { OrderItem } from '../../../orders/entities/order.entity';
import { Channel } from '../../../channels/entities/channel.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { TokopediaApiService, TokopediaConfig } from './tokopedia-api.service';
import { TokopediaAuthService } from './tokopedia-auth.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

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
  [key: string]: OrderStatus;
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
    waiting_payment: OrderStatus.PENDING,
    payment_verified: OrderStatus.CONFIRMED,
    processing: OrderStatus.PROCESSING,
    shipped: OrderStatus.SHIPPED,
    delivered: OrderStatus.DELIVERED,
    cancelled: OrderStatus.CANCELLED,
    return_requested: OrderStatus.RETURNED,
    returned: OrderStatus.RETURNED,
    refunded: OrderStatus.REFUNDED,
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
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
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
      const result = await this.apiService.makeTokopediaRequest<{
        orders: TokopediaOrder[];
        pagination: {
          current_page: number;
          total_pages: number;
          total_orders: number;
        };
      }>(tenantId, channelId, config, {
        method: 'GET',
        endpoint: '/v1/orders',
        params,
        requiresAuth: true,
      });

      if (!result.success || !result.data?.orders) {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : this.extractErrorMessage(result.error) ||
              'Failed to fetch orders from Tokopedia';
        throw new Error(errorMessage);
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
          this.logger.error(
            `Failed to process order ${tokopediaOrder.order_id}: ${error.message}`,
            error.stack,
          );
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
        errorCount === 0 ? 'completed' : 'failed',
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

      this.logger.error(
        `Tokopedia order sync failed: ${error.message}`,
        error.stack,
      );

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
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
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

      const result = await this.apiService.makeTokopediaRequest<TokopediaOrder>(
        tenantId,
        channelId,
        config,
        {
          method: 'GET',
          endpoint: `/v1/orders/${orderId}`,
          requiresAuth: true,
        },
      );

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error:
            typeof result.error === 'string'
              ? result.error
              : this.extractErrorMessage(result.error) ||
                'Failed to get order details',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Tokopedia order details: ${error.message}`,
        error.stack,
      );

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

      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
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
        shipping_date:
          shipmentRequest.shipping_date?.toISOString() ||
          new Date().toISOString(),
        ...(shipmentRequest.tracking_number && {
          tracking_number: shipmentRequest.tracking_number,
        }),
        ...(shipmentRequest.notes && { notes: shipmentRequest.notes }),
      };

      const result = await this.apiService.makeTokopediaRequest<{
        shipment_id: string;
      }>(tenantId, channelId, config, {
        method: 'POST',
        endpoint: '/v1/orders/ship',
        data: shipmentData,
        requiresAuth: true,
      });

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
          type: IntegrationLogType.SYNC,
          level: IntegrationLogLevel.INFO,
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
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : this.extractErrorMessage(result.error) ||
              'Failed to ship order items';
        throw new Error(errorMessage);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ship Tokopedia order: ${error.message}`,
        error.stack,
      );

      await this.logService.logError(tenantId, channelId, error, {
        metadata: { orderItemIds: shipmentRequest.order_item_ids },
      });

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

      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
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

      const result = await this.apiService.makeTokopediaRequest(
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
          type: IntegrationLogType.SYNC,
          level: IntegrationLogLevel.INFO,
          message: 'Tokopedia order items cancelled',
          metadata: {
            orderItemIds,
            cancelReason,
          },
        });

        return { success: true };
      } else {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : this.extractErrorMessage(result.error) ||
              'Failed to cancel order items';
        throw new Error(errorMessage);
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel Tokopedia order: ${error.message}`,
        error.stack,
      );

      await this.logService.logError(tenantId, channelId, error, {
        metadata: { orderItemIds },
      });

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
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
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

      const result = await this.apiService.makeTokopediaRequest(
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

      if (result.success) {
        return {
          success: true,
        };
      } else {
        return {
          success: false,
          error:
            typeof result.error === 'string'
              ? result.error
              : this.extractErrorMessage(result.error) ||
                'Failed to update tracking',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to update order tracking: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bidirectional order status synchronization between local system and Tokopedia
   * Handles conflicts and ensures consistent order status across systems
   */
  async syncOrderStatus(
    tenantId: string,
    channelId: string,
    orderIds?: string[],
  ): Promise<{
    success: boolean;
    syncedCount: number;
    conflictCount: number;
    errorCount: number;
    errors: string[];
    conflicts: Array<{
      orderId: string;
      invoiceNumber: string;
      localStatus: OrderStatus;
      tokopediaStatus: string;
      resolution: string;
    }>;
  }> {
    const startTime = Date.now();
    let syncedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const conflicts: Array<{
      orderId: string;
      invoiceNumber: string;
      localStatus: OrderStatus;
      tokopediaStatus: string;
      resolution: string;
    }> = [];

    try {
      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_order_status_sync',
        'started',
        'Starting bidirectional order status synchronization',
        { orderIds: orderIds?.length || 'all' },
      );

      // Get orders to sync
      const orders = await this.getOrdersForStatusSync(
        tenantId,
        channelId,
        orderIds,
      );

      if (orders.length === 0) {
        this.logger.log('No orders found for status synchronization');
        return {
          success: true,
          syncedCount: 0,
          conflictCount: 0,
          errorCount: 0,
          errors: [],
          conflicts: [],
        };
      }

      // Process orders in batches for better performance
      const batchSize = 5; // Tokopedia has very strict rate limits
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        
        const batchResult = await this.syncOrderStatusBatch(
          tenantId,
          channelId,
          batch,
        );

        syncedCount += batchResult.syncedCount;
        conflictCount += batchResult.conflictCount;
        errorCount += batchResult.errorCount;
        errors.push(...batchResult.errors);
        conflicts.push(...batchResult.conflicts);

        // Add longer delay between batches for Tokopedia
        if (i + batchSize < orders.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const duration = Date.now() - startTime;

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_order_status_sync',
        'completed',
        `Status sync completed: ${syncedCount} synced, ${conflictCount} conflicts, ${errorCount} errors`,
        { 
          syncedCount, 
          conflictCount, 
          errorCount, 
          duration, 
          totalOrders: orders.length 
        },
      );

      return {
        success: true,
        syncedCount,
        conflictCount,
        errorCount,
        errors,
        conflicts,
      };
    } catch (error) {
      this.logger.error(
        `Order status sync failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_order_status_sync',
        'failed',
        error.message,
        { syncedCount, conflictCount, errorCount },
      );

      return {
        success: false,
        syncedCount,
        conflictCount,
        errorCount,
        errors: [...errors, error.message],
        conflicts,
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
    const mapping = await this.mappingRepository.findOne({
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
    order.status =
      this.statusMapping[tokopediaOrder.order_status] || OrderStatus.PENDING;
    order.totalAmount = tokopediaOrder.total_amount;
    order.shippingAmount = tokopediaOrder.shipping.shipping_cost;
    order.orderDate = new Date(tokopediaOrder.created_at);
    order.paymentMethod = tokopediaOrder.payment.payment_method;
    order.paymentStatus =
      tokopediaOrder.payment.payment_status === 'paid'
        ? PaymentStatus.PAID
        : PaymentStatus.PENDING;

    // Customer information
    order.customerName = tokopediaOrder.buyer.name;
    order.customerEmail = tokopediaOrder.buyer.email;
    order.customerPhone = tokopediaOrder.buyer.phone;

    // Shipping information
    order.shippingAddress = {
      name: tokopediaOrder.shipping.recipient_name,
      phone: tokopediaOrder.shipping.recipient_phone,
      address: tokopediaOrder.shipping.address.street,
      city: tokopediaOrder.shipping.address.city,
      state: tokopediaOrder.shipping.address.province,
      postalCode: tokopediaOrder.shipping.address.postal_code,
      country: tokopediaOrder.shipping.address.country,
    };

    order.trackingNumber = tokopediaOrder.shipping.tracking_number;
    order.channelMetadata = {
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
      mapping.lastSyncAt = new Date();
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
        externalItemId: tokopediaItem.order_item_id.toString(),
      },
    });

    if (!orderItem) {
      orderItem = new OrderItem();
      orderItem.orderId = orderId;
    }

    orderItem.productName = tokopediaItem.product_name;
    orderItem.sku = tokopediaItem.product_sku;
    orderItem.quantity = tokopediaItem.quantity;
    orderItem.unitPrice = tokopediaItem.price_per_item;
    orderItem.totalPrice = tokopediaItem.total_price;
    // orderItem.weight = tokopediaItem.weight_per_item;

    orderItem.attributes = {
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

  /**
   * Get orders that need status synchronization
   */
  private async getOrdersForStatusSync(
    tenantId: string,
    channelId: string,
    orderIds?: string[],
  ): Promise<Order[]> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.channel', 'channel')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.channelId = :channelId', { channelId })
      .andWhere('order.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .andWhere('order.status != :refundedStatus', { refundedStatus: OrderStatus.REFUNDED });

    // Filter by specific order IDs if provided
    if (orderIds && orderIds.length > 0) {
      queryBuilder.andWhere('order.id IN (:...orderIds)', { orderIds });
    } else {
      // Only sync orders that haven't been synced in last 30 minutes
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      
      queryBuilder.andWhere(
        '(order.channelMetadata->\'tokopedia\'->\'lastSyncAt\' IS NULL OR order.channelMetadata->\'tokopedia\'->\'lastSyncAt\'::timestamp < :thirtyMinutesAgo)',
        { thirtyMinutesAgo }
      );
    }

    return await queryBuilder
      .orderBy('order.updatedAt', 'DESC')
      .limit(100) // Limit to avoid overwhelming Tokopedia API
      .getMany();
  }

  /**
   * Process a batch of orders for status synchronization
   */
  private async syncOrderStatusBatch(
    tenantId: string,
    channelId: string,
    orders: Order[],
  ): Promise<{
    syncedCount: number;
    conflictCount: number;
    errorCount: number;
    errors: string[];
    conflicts: Array<{
      orderId: string;
      invoiceNumber: string;
      localStatus: OrderStatus;
      tokopediaStatus: string;
      resolution: string;
    }>;
  }> {
    let syncedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const conflicts: Array<{
      orderId: string;
      invoiceNumber: string;
      localStatus: OrderStatus;
      tokopediaStatus: string;
      resolution: string;
    }> = [];

    // Process orders one by one with delays for Tokopedia's strict rate limits
    for (const order of orders) {
      try {
        const result = await this.syncSingleOrderStatus(
          tenantId,
          channelId,
          order,
        );

        if (result.success) {
          syncedCount++;
        } else if (result.hasConflict) {
          conflictCount++;
          conflicts.push(result.conflict);
        } else {
          errorCount++;
          errors.push(result.error);
        }

        // Add delay between each order for Tokopedia rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        errors.push(`Order ${order.id}: ${error.message}`);
      }
    }

    return {
      syncedCount,
      conflictCount,
      errorCount,
      errors,
      conflicts,
    };
  }

  /**
   * Synchronize status for a single order
   */
  private async syncSingleOrderStatus(
    tenantId: string,
    channelId: string,
    order: Order,
  ): Promise<{
    success: boolean;
    hasConflict: boolean;
    conflict?: {
      orderId: string;
      invoiceNumber: string;
      localStatus: OrderStatus;
      tokopediaStatus: string;
      resolution: string;
    };
    error?: string;
  }> {
    try {
      // Get Tokopedia order details
      const tokopediaOrderId = order.channelMetadata?.tokopedia?.orderId;
      if (!tokopediaOrderId) {
        return {
          success: false,
          hasConflict: false,
          error: 'No Tokopedia order ID found in metadata',
        };
      }

      const orderDetails = await this.getTokopediaOrderDetails(
        tenantId,
        channelId,
        tokopediaOrderId,
      );

      if (!orderDetails.success || !orderDetails.data) {
        return {
          success: false,
          hasConflict: false,
          error: orderDetails.error || 'Failed to fetch Tokopedia order details',
        };
      }

      const tokopediaOrder = orderDetails.data;
      const tokopediaStatus = tokopediaOrder.order_status;
      const localStatus = order.status;

      // Map Tokopedia status to local status
      const expectedLocalStatus = this.statusMapping[tokopediaStatus];
      
      // Determine sync direction and resolve conflicts
      const syncDirection = this.determineSyncDirection(
        localStatus,
        tokopediaStatus,
        order.updatedAt,
        new Date(tokopediaOrder.updated_at),
      );

      if (syncDirection === 'conflict') {
        // Handle conflict with Indonesian business logic
        const resolution = await this.resolveStatusConflict(
          tenantId,
          channelId,
          order,
          tokopediaOrder,
        );

        return {
          success: false,
          hasConflict: true,
          conflict: {
            orderId: order.id,
            invoiceNumber: order.orderNumber,
            localStatus,
            tokopediaStatus,
            resolution,
          },
        };
      }

      // Update based on sync direction
      if (syncDirection === 'local-to-tokopedia') {
        // Update Tokopedia with local status
        const tokopediaAction = this.getTokopediaActionFromStatus(localStatus);
        
        if (tokopediaAction) {
          // Execute action on Tokopedia (ship, cancel, etc.)
          await this.executeTokopediaAction(
            tenantId,
            channelId,
            tokopediaOrderId,
            tokopediaAction,
            order,
          );
        }
      } else if (syncDirection === 'tokopedia-to-local') {
        // Update local order with Tokopedia status
        if (expectedLocalStatus && expectedLocalStatus !== localStatus) {
          order.status = expectedLocalStatus;
          
          // Update channel metadata
          order.channelMetadata = {
            ...order.channelMetadata,
            tokopedia: {
              ...order.channelMetadata?.tokopedia,
              lastSyncAt: new Date(),
              lastTokopediaStatus: tokopediaStatus,
            },
          };

          await this.orderRepository.save(order);

          // Emit status change event
          this.eventEmitter.emit('order.status.changed', {
            orderId: order.id,
            tenantId,
            channelId,
            previousStatus: localStatus,
            newStatus: expectedLocalStatus,
            source: 'tokopedia',
          });
        }
      }

      // Update mapping sync timestamp
      await this.updateMappingLastSync(
        tenantId,
        channelId,
        order.id,
        tokopediaOrderId.toString(),
      );

      return { success: true, hasConflict: false };
    } catch (error) {
      this.logger.error(
        `Failed to sync order status for order ${order.id}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        hasConflict: false,
        error: error.message,
      };
    }
  }

  /**
   * Determine sync direction based on update timestamps and business logic
   */
  private determineSyncDirection(
    localStatus: OrderStatus,
    tokopediaStatus: string,
    localUpdatedAt: Date,
    tokopediaUpdatedAt: Date,
  ): 'local-to-tokopedia' | 'tokopedia-to-local' | 'no-sync' | 'conflict' {
    const expectedLocalStatus = this.statusMapping[tokopediaStatus];
    
    // If statuses match, no sync needed
    if (localStatus === expectedLocalStatus) {
      return 'no-sync';
    }

    // Indonesian business logic: Customer-facing statuses take priority
    const customerFacingStatuses = [
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED,
      OrderStatus.RETURNED,
      OrderStatus.REFUNDED,
    ];

    // If local status is customer-facing, prioritize it
    if (customerFacingStatuses.includes(localStatus)) {
      return 'local-to-tokopedia';
    }

    // If Tokopedia status is customer-facing, prioritize it
    if (tokopediaStatus === 'delivered' || tokopediaStatus === 'cancelled') {
      return 'tokopedia-to-local';
    }

    // Check timestamps with 5-minute buffer for clock skew
    const timeDiff = Math.abs(localUpdatedAt.getTime() - tokopediaUpdatedAt.getTime());
    const fiveMinutes = 5 * 60 * 1000;

    if (timeDiff <= fiveMinutes) {
      // Close timestamps - use business logic
      if (localStatus === OrderStatus.PROCESSING || localStatus === OrderStatus.SHIPPED) {
        return 'local-to-tokopedia';
      }
      return 'tokopedia-to-local';
    }

    // Use most recent timestamp
    if (localUpdatedAt > tokopediaUpdatedAt) {
      return 'local-to-tokopedia';
    } else if (tokopediaUpdatedAt > localUpdatedAt) {
      return 'tokopedia-to-local';
    }

    // If we can't determine, it's a conflict
    return 'conflict';
  }

  /**
   * Get Tokopedia action from local order status
   */
  private getTokopediaActionFromStatus(
    localStatus: OrderStatus,
  ): string | null {
    switch (localStatus) {
      case OrderStatus.SHIPPED:
        return 'ship';
      case OrderStatus.CANCELLED:
        return 'cancel';
      case OrderStatus.PROCESSING:
        return 'process';
      default:
        return null;
    }
  }

  /**
   * Execute action on Tokopedia based on local status
   */
  private async executeTokopediaAction(
    tenantId: string,
    channelId: string,
    tokopediaOrderId: number,
    action: string,
    order: Order,
  ): Promise<void> {
    switch (action) {
      case 'ship':
        // Get order items for shipping
        const orderItems = order.items?.map(item => 
          item.attributes?.tokopedia?.orderItemId
        ).filter(Boolean) || [];

        if (orderItems.length > 0) {
          await this.shipTokopediaOrder(tenantId, channelId, {
            order_item_ids: orderItems,
            shipping_service: order.shippingMethod || 'Regular',
            tracking_number: order.trackingNumber,
          });
        }
        break;

      case 'cancel':
        // Cancel order with reason
        const cancelReason = order.notes || 'Cancelled by seller';
        const orderItemIds = order.items?.map(item => 
          item.attributes?.tokopedia?.orderItemId
        ).filter(Boolean) || [];

        if (orderItemIds.length > 0) {
          await this.cancelTokopediaOrder(
            tenantId,
            channelId,
            orderItemIds,
            cancelReason,
          );
        }
        break;

      case 'process':
        // No specific action needed for processing status
        break;

      default:
        this.logger.warn(`Unknown Tokopedia action: ${action}`);
    }
  }

  /**
   * Resolve status conflict using Indonesian business logic
   */
  private async resolveStatusConflict(
    tenantId: string,
    channelId: string,
    order: Order,
    tokopediaOrder: TokopediaOrder,
  ): Promise<string> {
    const localStatus = order.status;
    const tokopediaStatus = tokopediaOrder.order_status;

    // Indonesian business priority rules
    const priorityMatrix = {
      // Local status -> Tokopedia status -> Resolution
      [OrderStatus.DELIVERED]: {
        'shipped': 'keep_local', // Customer already received
        'processing': 'keep_local', // Customer already received
        'cancelled': 'escalate', // Major conflict
      },
      [OrderStatus.CANCELLED]: {
        'shipped': 'escalate', // Cannot cancel shipped order
        'processing': 'keep_local', // Can cancel processing
        'delivered': 'escalate', // Cannot cancel delivered order
      },
      [OrderStatus.SHIPPED]: {
        'cancelled': 'escalate', // Cannot cancel shipped order
        'processing': 'update_tokopedia', // Update Tokopedia to shipped
        'delivered': 'update_local', // Customer feedback wins
      },
      [OrderStatus.PROCESSING]: {
        'cancelled': 'update_local', // Marketplace cancellation wins
        'shipped': 'update_local', // Marketplace shipping wins
        'delivered': 'update_local', // Marketplace delivery wins
      },
    };

    const resolution = priorityMatrix[localStatus]?.[tokopediaStatus] || 'manual_review';

    // Log conflict for monitoring
    await this.logService.logSync(
      tenantId,
      channelId,
      'tokopedia_order_conflict',
      'failed',
      `Order status conflict: Local ${localStatus} vs Tokopedia ${tokopediaStatus}`,
      {
        orderId: order.id,
        invoiceNumber: order.orderNumber,
        localStatus,
        tokopediaStatus,
        resolution,
        localUpdatedAt: order.updatedAt,
        tokopediaUpdatedAt: tokopediaOrder.updated_at,
      },
    );

    return resolution;
  }

  /**
   * Update mapping last sync timestamp
   */
  private async updateMappingLastSync(
    tenantId: string,
    channelId: string,
    orderId: string,
    externalOrderId: string,
  ): Promise<void> {
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'order',
        internalId: orderId,
        externalId: externalOrderId,
      },
    });

    if (mapping) {
      mapping.lastSyncAt = new Date();
      mapping.recordSync(true);
      await this.mappingRepository.save(mapping);
    }
  }

  // Helper method to extract error messages from API responses
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as any).message;
    }
    return 'Unknown error';
  }
}
