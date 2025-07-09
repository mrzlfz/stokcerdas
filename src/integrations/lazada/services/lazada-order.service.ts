import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { LazadaApiService, LazadaConfig } from './lazada-api.service';
import { LazadaAuthService } from './lazada-auth.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';
import {
  Order,
  OrderType,
  OrderStatus,
} from '../../../orders/entities/order.entity';
import { OrderItem } from '../../../orders/entities/order.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';

export interface LazadaOrder {
  order_id: number;
  order_number: string;
  status: string;
  order_flag: string;
  created_at: string;
  updated_at: string;
  customer_id: number;
  customer_first_name: string;
  customer_last_name: string;
  price: string;
  payment_method: string;
  remarks: string;
  delivery_info: string;
  shipping_fee: string;
  wallet_credits: string;
  items_count: number;
  promised_shipping_times: string;
  order_items: LazadaOrderItem[];
  address_billing: LazadaAddress;
  address_shipping: LazadaAddress;
}

export interface LazadaOrderItem {
  order_item_id: number;
  order_flag: string;
  status: string;
  name: string;
  sku: string;
  variation: string;
  shop_sku: string;
  digital_delivery_info: string;
  purchase_order_id: number;
  purchase_order_number: string;
  package_id: string;
  order_type: string;
  stage_pay_status: string;
  tracking_code: string;
  tracking_code_pre: string;
  reason: string;
  reason_detail: string;
  promised_shipping_time: string;
  shipping_type: string;
  shipping_fee_original: string;
  is_digital: number;
  item_price: string;
  paid_price: string;
  wallet_credits: string;
  shipping_amount: string;
  shipping_service_cost: string;
  voucher_amount: string;
  voucher_code: string;
  voucher_code_seller: string;
  currency: string;
  extra_attributes: string;
  product_main_image: string;
  product_detail_url: string;
  return_status: string;
  shipment_provider: string;
  delivery_option_sof: number;
}

export interface LazadaAddress {
  first_name: string;
  last_name: string;
  phone: string;
  phone2: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  address5: string;
  customer_email: string;
  city: string;
  ward: string;
  region: string;
  post_code: string;
  country: string;
}

export interface OrderSyncOptions {
  offset?: number;
  limit?: number;
  status?: string;
  sortBy?: 'created_at' | 'updated_at';
  sortDirection?: 'ASC' | 'DESC';
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface OrderFulfillmentRequest {
  order_item_ids: number[];
  delivery_type: 'dropship' | 'send_to_warehouse';
  shipping_provider?: string;
  tracking_number?: string;
}

@Injectable()
export class LazadaOrderService {
  private readonly logger = new Logger(LazadaOrderService.name);

  // Lazada order status mapping
  private readonly statusMapping = {
    // Lazada -> Local
    pending: 'pending',
    unpaid: 'awaiting_payment',
    paid: 'confirmed',
    ready_to_ship: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    canceled: 'cancelled',
    returned: 'returned',
    failed_delivery: 'failed',
    pending_cancel: 'pending_cancellation',
  };

  constructor(
    private readonly lazadaApi: LazadaApiService,
    private readonly authService: LazadaAuthService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Sync orders from Lazada to local system
   */
  async syncOrdersFromLazada(
    tenantId: string,
    channelId: string,
    options: OrderSyncOptions = {},
  ): Promise<{
    success: boolean;
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      this.logger.debug(`Starting Lazada order sync`, {
        tenantId,
        channelId,
        options,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Prepare API parameters
      const params: any = {
        offset: options.offset || 0,
        limit: Math.min(options.limit || 100, 500), // Lazada max limit is 500
        sort_by: options.sortBy || 'updated_at',
        sort_direction: options.sortDirection || 'DESC',
      };

      if (options.status) {
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

      // Get orders from Lazada
      const result = await this.lazadaApi.makeLazadaRequest<{
        orders: LazadaOrder[];
        count_total: number;
      }>(tenantId, channelId, lazadaConfig, {
        method: 'GET',
        path: '/orders/get',
        params,
        requiresAuth: true,
        rateLimitKey: 'orders_get',
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch orders from Lazada');
      }

      const lazadaOrders = result.data.orders || [];

      this.logger.debug(`Fetched ${lazadaOrders.length} orders from Lazada`, {
        tenantId,
        channelId,
        total: result.data.count_total,
      });

      // Sync each order
      for (const lazadaOrder of lazadaOrders) {
        try {
          await this.syncSingleOrderFromLazada(
            tenantId,
            channelId,
            lazadaOrder,
          );
          syncedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to sync order ${lazadaOrder.order_number}: ${error.message}`,
            error.stack,
          );
          errors.push(`Order ${lazadaOrder.order_number}: ${error.message}`);
          errorCount++;
        }
      }

      // Log sync summary
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_orders_inbound',
        errorCount === 0 ? 'completed' : 'failed',
        `Order sync completed: ${syncedCount} synced, ${errorCount} errors`,
        {
          syncedCount,
          errorCount,
          totalFetched: lazadaOrders.length,
          errors: errors.slice(0, 10), // Log first 10 errors
        },
      );

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
        errors,
      };
    } catch (error) {
      this.logger.error(`Order sync failed: ${error.message}`, error.stack);

      // Log sync failure
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_orders_inbound',
        'failed',
        `Order sync failed: ${error.message}`,
        { error: error.message },
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
   * Get Lazada order details
   */
  async getLazadaOrderDetails(
    tenantId: string,
    channelId: string,
    orderNumber: string,
  ): Promise<{ success: boolean; data?: LazadaOrder; error?: string }> {
    try {
      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Get order details from Lazada
      const result = await this.lazadaApi.makeLazadaRequest<LazadaOrder>(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'GET',
          path: '/order/get',
          params: { order_id: orderNumber },
          requiresAuth: true,
          rateLimitKey: 'order_details',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order details: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Ship order items in Lazada
   */
  async shipLazadaOrder(
    tenantId: string,
    channelId: string,
    orderItemIds: number[],
    deliveryType: 'dropship' | 'send_to_warehouse',
    trackingNumber?: string,
    shippingProvider?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Shipping Lazada order items`, {
        tenantId,
        channelId,
        orderItemIds,
        deliveryType,
        trackingNumber,
        shippingProvider,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      const fulfillmentRequest: OrderFulfillmentRequest = {
        order_item_ids: orderItemIds,
        delivery_type: deliveryType,
      };

      if (trackingNumber) {
        fulfillmentRequest.tracking_number = trackingNumber;
      }

      if (shippingProvider) {
        fulfillmentRequest.shipping_provider = shippingProvider;
      }

      // Ship order items
      const result = await this.lazadaApi.makeLazadaRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/order/fulfillment/ship',
          body: fulfillmentRequest,
          requiresAuth: true,
          rateLimitKey: 'order_ship',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Log successful shipment
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYNC,
        level: IntegrationLogLevel.INFO,
        message: `Lazada order items shipped successfully`,
        metadata: {
          orderItemIds,
          deliveryType,
          trackingNumber,
          shippingProvider,
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to ship Lazada order: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel order items in Lazada
   */
  async cancelLazadaOrder(
    tenantId: string,
    channelId: string,
    orderItemIds: number[],
    cancelReason: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Cancelling Lazada order items`, {
        tenantId,
        channelId,
        orderItemIds,
        cancelReason,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Cancel order items
      const result = await this.lazadaApi.makeLazadaRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/order/cancel',
          body: {
            order_item_ids: orderItemIds,
            reason: cancelReason,
          },
          requiresAuth: true,
          rateLimitKey: 'order_cancel',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Log successful cancellation
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYNC,
        level: IntegrationLogLevel.INFO,
        message: `Lazada order items cancelled successfully`,
        metadata: {
          orderItemIds,
          cancelReason,
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to cancel Lazada order: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get order items tracking info
   */
  async getOrderItemsTracking(
    tenantId: string,
    channelId: string,
    orderItemIds: number[],
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Get tracking info
      const result = await this.lazadaApi.makeLazadaRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'GET',
          path: '/order/fulfillment/get',
          params: {
            order_item_ids: orderItemIds.join(','),
          },
          requiresAuth: true,
          rateLimitKey: 'order_tracking',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get tracking info: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bidirectional order status synchronization between local system and Lazada
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
      orderNumber: string;
      localStatus: OrderStatus;
      lazadaStatus: string;
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
      orderNumber: string;
      localStatus: OrderStatus;
      lazadaStatus: string;
      resolution: string;
    }> = [];

    try {
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_order_status_sync',
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
      const batchSize = 10; // Lazada has stricter rate limits
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

        // Add delay between batches to respect Lazada rate limits
        if (i + batchSize < orders.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const duration = Date.now() - startTime;

      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_order_status_sync',
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
        'lazada_order_status_sync',
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

  /**
   * Get orders that need status synchronization
   */
  private async getOrdersForStatusSync(
    tenantId: string,
    channelId: string,
    orderIds?: string[],
  ): Promise<Array<Order & { mapping: ChannelMapping }>> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .innerJoin(
        'channel_mappings',
        'mapping',
        'mapping.internal_id = order.id AND mapping.entity_type = :entityType',
        { entityType: 'order' },
      )
      .where('order.tenant_id = :tenantId', { tenantId })
      .andWhere('mapping.channel_id = :channelId', { channelId })
      .andWhere('order.status NOT IN (:...finalStatuses)', {
        finalStatuses: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED],
      })
      .select([
        'order.id',
        'order.orderNumber',
        'order.status',
        'order.updatedAt',
        'order.channelMetadata',
      ])
      .addSelect([
        'mapping.external_id as external_id',
        'mapping.external_data as external_data',
        'mapping.last_sync_at as last_sync_at',
      ]);

    if (orderIds && orderIds.length > 0) {
      query.andWhere('order.id IN (:...orderIds)', { orderIds });
    }

    // Focus on orders that haven't been synced recently (last 2 hours for Lazada)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    query.andWhere(
      '(mapping.last_sync_at IS NULL OR mapping.last_sync_at < :twoHoursAgo)',
      { twoHoursAgo },
    );

    const rawResults = await query.getRawMany();

    return rawResults.map((raw) => ({
      id: raw.order_id,
      orderNumber: raw.order_orderNumber,
      status: raw.order_status,
      updatedAt: raw.order_updatedAt,
      channelMetadata: raw.order_channelMetadata,
      mapping: {
        externalId: raw.external_id,
        externalData: raw.external_data,
        lastSyncAt: raw.last_sync_at,
      },
    })) as Array<Order & { mapping: ChannelMapping }>;
  }

  /**
   * Sync order status for a batch of orders
   */
  private async syncOrderStatusBatch(
    tenantId: string,
    channelId: string,
    orders: Array<Order & { mapping: ChannelMapping }>,
  ): Promise<{
    syncedCount: number;
    conflictCount: number;
    errorCount: number;
    errors: string[];
    conflicts: Array<{
      orderId: string;
      orderNumber: string;
      localStatus: OrderStatus;
      lazadaStatus: string;
      resolution: string;
    }>;
  }> {
    let syncedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const conflicts: Array<{
      orderId: string;
      orderNumber: string;
      localStatus: OrderStatus;
      lazadaStatus: string;
      resolution: string;
    }> = [];

    try {
      // Process each order individually for Lazada (more reliable)
      for (const order of orders) {
        try {
          const syncResult = await this.syncSingleOrderStatus(
            tenantId,
            channelId,
            order,
          );

          if (syncResult.success) {
            syncedCount++;
          } else if (syncResult.conflict) {
            conflictCount++;
            conflicts.push(syncResult.conflict);
          } else {
            errorCount++;
            errors.push(syncResult.error || 'Unknown error');
          }

          // Add delay between individual order requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          this.logger.error(
            `Failed to sync status for order ${order.id}: ${error.message}`,
          );
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
    } catch (error) {
      this.logger.error(
        `Batch status sync failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Sync status for a single order with conflict resolution
   */
  private async syncSingleOrderStatus(
    tenantId: string,
    channelId: string,
    order: Order & { mapping: ChannelMapping },
  ): Promise<{
    success: boolean;
    conflict?: {
      orderId: string;
      orderNumber: string;
      localStatus: OrderStatus;
      lazadaStatus: string;
      resolution: string;
    };
    error?: string;
  }> {
    try {
      // Get current status from Lazada
      const lazadaOrderResult = await this.getLazadaOrderDetails(
        tenantId,
        channelId,
        order.mapping.externalId,
      );

      if (!lazadaOrderResult.success || !lazadaOrderResult.data) {
        return {
          success: false,
          error: lazadaOrderResult.error || 'Failed to get Lazada order details',
        };
      }

      const lazadaOrder = lazadaOrderResult.data;
      const localStatus = order.status;
      const lazadaStatus = lazadaOrder.status;
      const mappedLazadaStatus = this.mapOrderStatus(lazadaStatus);

      // Check if statuses are already in sync
      if (localStatus === mappedLazadaStatus) {
        await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);
        return { success: true };
      }

      // Determine sync direction based on Indonesian business rules
      const syncDirection = this.determineSyncDirection(
        order,
        lazadaOrder,
        localStatus,
        mappedLazadaStatus,
      );

      switch (syncDirection) {
        case 'local_to_lazada':
          // Update Lazada with local status
          const lazadaAction = this.getLazadaActionFromStatus(localStatus);
          if (lazadaAction) {
            let updateResult;
            if (lazadaAction === 'ship') {
              // Get order items for shipping
              const orderItems = lazadaOrder.order_items || [];
              if (orderItems.length > 0) {
                const orderItemIds = orderItems.map(item => item.order_item_id);
                updateResult = await this.shipLazadaOrder(
                  tenantId,
                  channelId,
                  orderItemIds,
                  'dropship',
                );
              }
            } else if (lazadaAction === 'cancel') {
              // Get order items for cancellation
              const orderItems = lazadaOrder.order_items || [];
              if (orderItems.length > 0) {
                const orderItemIds = orderItems.map(item => item.order_item_id);
                updateResult = await this.cancelLazadaOrder(
                  tenantId,
                  channelId,
                  orderItemIds,
                  'Stock not available',
                );
              }
            }

            if (updateResult?.success) {
              await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);
              return { success: true };
            } else {
              return { success: false, error: updateResult?.error };
            }
          }
          break;

        case 'lazada_to_local':
          // Update local with Lazada status
          await this.orderRepository.update(
            { id: order.id },
            { 
              status: mappedLazadaStatus,
              updatedAt: new Date(),
            },
          );

          await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);

          // Emit status change event
          this.eventEmitter.emit('order.status.changed', {
            tenantId,
            channelId,
            orderId: order.id,
            orderNumber: lazadaOrder.order_number,
            oldStatus: localStatus,
            newStatus: mappedLazadaStatus,
            source: 'lazada',
          });

          return { success: true };

        case 'conflict':
          // Handle conflict with Indonesian business logic
          const resolution = await this.resolveStatusConflict(
            tenantId,
            channelId,
            order,
            lazadaOrder,
            localStatus,
            mappedLazadaStatus,
          );

          return {
            success: false,
            conflict: {
              orderId: order.id,
              orderNumber: lazadaOrder.order_number,
              localStatus,
              lazadaStatus,
              resolution,
            },
          };

        default:
          return { success: false, error: 'Unknown sync direction' };
      }
    } catch (error) {
      this.logger.error(
        `Status sync failed for order ${order.id}: ${error.message}`,
        error.stack,
      );
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Determine sync direction based on Indonesian business rules
   */
  private determineSyncDirection(
    order: Order & { mapping: ChannelMapping },
    lazadaOrder: LazadaOrder,
    localStatus: OrderStatus,
    mappedLazadaStatus: OrderStatus,
  ): 'local_to_lazada' | 'lazada_to_local' | 'conflict' {
    const localUpdateTime = order.updatedAt;
    const lazadaUpdateTime = new Date(lazadaOrder.updated_at);

    // Rule 1: If one side is in final state, don't override
    const finalStatuses = [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED];
    if (finalStatuses.includes(localStatus) && !finalStatuses.includes(mappedLazadaStatus)) {
      return 'local_to_lazada';
    }
    if (finalStatuses.includes(mappedLazadaStatus) && !finalStatuses.includes(localStatus)) {
      return 'lazada_to_local';
    }

    // Rule 2: For Indonesian business context, prioritize customer-facing status
    const customerFacingStatuses = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];
    if (customerFacingStatuses.includes(mappedLazadaStatus) && 
        !customerFacingStatuses.includes(localStatus)) {
      return 'lazada_to_local';
    }

    // Rule 3: If timestamps are available, use most recent
    if (localUpdateTime && lazadaUpdateTime) {
      const timeDiff = Math.abs(localUpdateTime.getTime() - lazadaUpdateTime.getTime());
      // Only consider time difference if it's more than 10 minutes (Lazada updates slower)
      if (timeDiff > 10 * 60 * 1000) {
        return localUpdateTime > lazadaUpdateTime ? 'local_to_lazada' : 'lazada_to_local';
      }
    }

    // Rule 4: Default to conflict for manual resolution
    return 'conflict';
  }

  /**
   * Get Lazada action from local order status
   */
  private getLazadaActionFromStatus(status: OrderStatus): 'ship' | 'cancel' | null {
    switch (status) {
      case OrderStatus.SHIPPED:
        return 'ship';
      case OrderStatus.CANCELLED:
        return 'cancel';
      default:
        return null;
    }
  }

  /**
   * Resolve status conflict with Indonesian business logic
   */
  private async resolveStatusConflict(
    tenantId: string,
    channelId: string,
    order: Order & { mapping: ChannelMapping },
    lazadaOrder: LazadaOrder,
    localStatus: OrderStatus,
    mappedLazadaStatus: OrderStatus,
  ): Promise<string> {
    // For Indonesian SMBs, prioritize customer satisfaction
    const customerPriorityStatuses = [
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ];

    if (customerPriorityStatuses.includes(mappedLazadaStatus)) {
      // Update local to match Lazada (customer-facing)
      await this.orderRepository.update(
        { id: order.id },
        { 
          status: mappedLazadaStatus,
          updatedAt: new Date(),
        },
      );

      await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);

      return `Resolved to Lazada status (${mappedLazadaStatus}) - customer-facing priority`;
    }

    // Default: Keep local status and try to sync to Lazada
    const lazadaAction = this.getLazadaActionFromStatus(localStatus);
    if (lazadaAction) {
      let updateResult;
      if (lazadaAction === 'ship') {
        const orderItems = lazadaOrder.order_items || [];
        if (orderItems.length > 0) {
          const orderItemIds = orderItems.map(item => item.order_item_id);
          updateResult = await this.shipLazadaOrder(
            tenantId,
            channelId,
            orderItemIds,
            'dropship',
          );
        }
      } else if (lazadaAction === 'cancel') {
        const orderItems = lazadaOrder.order_items || [];
        if (orderItems.length > 0) {
          const orderItemIds = orderItems.map(item => item.order_item_id);
          updateResult = await this.cancelLazadaOrder(
            tenantId,
            channelId,
            orderItemIds,
            'Stock not available',
          );
        }
      }

      if (updateResult?.success) {
        await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);
        return `Resolved to local status (${localStatus}) - successfully synced to Lazada`;
      }
    }

    return `Unresolved conflict - manual intervention required`;
  }

  /**
   * Update mapping last sync timestamp
   */
  private async updateMappingLastSync(
    tenantId: string,
    channelId: string,
    externalId: string,
  ): Promise<void> {
    await this.mappingRepository.update(
      {
        tenantId,
        channelId,
        entityType: 'order',
        externalId,
      },
      { lastSyncAt: new Date() },
    );
  }

  private async syncSingleOrderFromLazada(
    tenantId: string,
    channelId: string,
    lazadaOrder: LazadaOrder,
  ): Promise<void> {
    // Find or create local order
    let localOrder = await this.findLocalOrderByExternalId(
      tenantId,
      lazadaOrder.order_number,
    );

    if (!localOrder) {
      // Create new local order
      localOrder = await this.createLocalOrderFromLazada(
        tenantId,
        channelId,
        lazadaOrder,
      );
    } else {
      // Update existing local order
      await this.updateLocalOrderFromLazada(localOrder, lazadaOrder);
    }

    // Sync order items
    await this.syncOrderItemsFromLazada(
      tenantId,
      localOrder,
      lazadaOrder.order_items,
    );

    // Store mapping if not exists
    await this.ensureOrderMapping(
      tenantId,
      channelId,
      localOrder.id,
      lazadaOrder.order_number,
    );
  }

  private async findLocalOrderByExternalId(
    tenantId: string,
    externalId: string,
  ): Promise<Order | null> {
    // This would query through channel mappings
    // For now, return null to always create new orders
    return null;
  }

  private async createLocalOrderFromLazada(
    tenantId: string,
    channelId: string,
    lazadaOrder: LazadaOrder,
  ): Promise<Order> {
    // Map Lazada order data to local order format
    const orderData = {
      tenantId,
      channelId,
      orderNumber: `LZ-${lazadaOrder.order_number}`,
      externalOrderId: lazadaOrder.order_number,
      externalOrderNumber: lazadaOrder.order_number,
      type: OrderType.SALE,
      status: this.mapOrderStatus(lazadaOrder.status),
      totalAmount: parseFloat(lazadaOrder.price) || 0,
      currency: 'MYR', // Default, would be determined by region
      paymentMethod: lazadaOrder.payment_method,
      customerEmail: lazadaOrder.address_billing?.customer_email || '',
      customerFirstName: lazadaOrder.customer_first_name,
      customerLastName: lazadaOrder.customer_last_name,
      customerPhone: lazadaOrder.address_billing?.phone || '',
      shippingAmount: parseFloat(lazadaOrder.shipping_fee) || 0,
      orderDate: new Date(lazadaOrder.created_at),
      shippingAddress: this.formatAddress(lazadaOrder.address_shipping),
      billingAddress: this.formatAddress(lazadaOrder.address_billing),
      notes: lazadaOrder.remarks,
      // Add other fields as needed
    };

    const order = this.orderRepository.create(orderData);
    return this.orderRepository.save(order);
  }

  private async updateLocalOrderFromLazada(
    localOrder: Order,
    lazadaOrder: LazadaOrder,
  ): Promise<void> {
    // Update local order with Lazada data
    localOrder.status = this.mapOrderStatus(lazadaOrder.status);
    localOrder.totalAmount = parseFloat(lazadaOrder.price) || 0;
    localOrder.notes = lazadaOrder.remarks;

    await this.orderRepository.save(localOrder);
  }

  private async syncOrderItemsFromLazada(
    tenantId: string,
    localOrder: Order,
    lazadaOrderItems: LazadaOrderItem[],
  ): Promise<void> {
    for (const lazadaItem of lazadaOrderItems) {
      // Find or create local order item
      let localItem = await this.orderItemRepository.findOne({
        where: {
          orderId: localOrder.id,
          externalItemId: lazadaItem.order_item_id.toString(),
        },
      });

      if (!localItem) {
        // Create new order item
        const itemData = {
          tenantId,
          orderId: localOrder.id,
          externalItemId: lazadaItem.order_item_id.toString(),
          sku: lazadaItem.sku,
          productName: lazadaItem.name,
          quantity: 1, // Lazada order items are typically 1 quantity each
          unitPrice: parseFloat(lazadaItem.item_price) || 0,
          totalPrice: parseFloat(lazadaItem.paid_price) || 0,
          status: this.mapOrderItemStatus(lazadaItem.status),
          trackingNumber: lazadaItem.tracking_code,
          shippingProvider: lazadaItem.shipment_provider,
          // Add other fields as needed
        };

        localItem = this.orderItemRepository.create(itemData);
        await this.orderItemRepository.save(localItem);
      } else {
        // Update existing order item
        // TODO: Add status, trackingNumber, shippingProvider to OrderItem entity
        // localItem.status = this.mapOrderItemStatus(lazadaItem.status);
        // localItem.trackingNumber = lazadaItem.tracking_code;
        // localItem.shippingProvider = lazadaItem.shipment_provider;

        await this.orderItemRepository.save(localItem);
      }
    }
  }

  private mapOrderStatus(lazadaStatus: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      pending: OrderStatus.PENDING,
      confirmed: OrderStatus.CONFIRMED,
      processing: OrderStatus.PROCESSING,
      shipped: OrderStatus.SHIPPED,
      delivered: OrderStatus.DELIVERED,
      cancelled: OrderStatus.CANCELLED,
      refunded: OrderStatus.REFUNDED,
      returned: OrderStatus.RETURNED,
    };
    return mapping[lazadaStatus] || OrderStatus.PENDING;
  }

  private mapOrderItemStatus(lazadaStatus: string): string {
    return this.statusMapping[lazadaStatus] || 'unknown';
  }

  private formatAddress(address: LazadaAddress): any {
    if (!address) {
      return {
        name: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        phone: '',
      };
    }

    const fullAddress = [address.address1, address.address2, address.address3]
      .filter(Boolean)
      .join(' ');

    return {
      name:
        `${address.first_name || ''} ${address.last_name || ''}`.trim() ||
        'Customer',
      address: fullAddress || '',
      city: address.city || '',
      state: address.region || '',
      postalCode: address.post_code || '',
      country: address.country || '',
      phone: address.phone || '',
    };
  }

  private async ensureOrderMapping(
    tenantId: string,
    channelId: string,
    orderId: string,
    externalId: string,
  ): Promise<void> {
    // This would create/update channel mapping
    // Implementation depends on your channel mapping structure
    this.logger.debug(`Order mapping: ${orderId} -> ${externalId}`, {
      tenantId,
      channelId,
    });
  }
}
