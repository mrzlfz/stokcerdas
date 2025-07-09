import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  ShopeeApiService,
  ShopeeCredentials,
  ShopeeApiRequest,
} from './shopee-api.service';
import { ShopeeAuthService } from './shopee-auth.service';
import { Order, OrderStatus } from '../../../orders/entities/order.entity';
import { OrderItem } from '../../../orders/entities/order.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { 
  ErrorHandlingService, 
  ErrorHandlingContext, 
  ErrorHandlingConfig 
} from '../../common/services/error-handling.service';
import { 
  RetryService, 
  RetryConfig, 
  ErrorType 
} from '../../common/services/retry.service';
import { 
  CircuitBreakerService, 
  CircuitBreakerState 
} from '../../common/services/circuit-breaker.service';

export interface ShopeeOrder {
  order_sn: string;
  order_status: string;
  update_time: number;
  create_time: number;
  days_to_ship: number;
  ship_by_date: number;
  buyer_user_id: number;
  buyer_username: string;
  estimated_shipping_fee: number;
  recipient_address: {
    name: string;
    phone: string;
    town: string;
    district: string;
    city: string;
    state: string;
    region: string;
    zipcode: string;
    full_address: string;
  };
  actual_shipping_fee: number;
  goods_to_declare: boolean;
  note: string;
  note_update_time: number;
  item_list: Array<{
    item_id: number;
    item_name: string;
    item_sku: string;
    model_id: number;
    model_name: string;
    model_sku: string;
    model_quantity_purchased: number;
    model_original_price: number;
    model_discounted_price: number;
    wholesale: boolean;
    weight: number;
    add_on_deal: boolean;
    main_item: boolean;
    add_on_deal_id: number;
    promotion_type: string;
    promotion_id: number;
    order_item_id: number;
    promotion_group_id: number;
    image_info: {
      image_url: string;
    };
  }>;
  pay_time: number;
  dropshipper: string;
  dropshipper_phone: string;
  split_up: boolean;
  buyer_cancel_reason: string;
  cancel_by: string;
  cancel_reason: string;
  actual_shipping_fee_confirmed: boolean;
  buyer_cpf_id: string;
  fulfillment_flag: string;
  pickup_done_time: number;
  package_list: Array<{
    package_number: string;
    logistics_status: string;
    shipping_carrier: string;
    item_list: Array<{
      item_id: number;
      model_id: number;
      order_item_id: number;
      promotion_group_id: number;
    }>;
  }>;
  invoice_data: {
    number: string;
    series_number: string;
    access_key: string;
    issue_date: number;
    total_value: number;
    products_total_value: number;
    tax_code: string;
  };
  checkout_shipping_carrier: string;
  reverse_shipping_fee: number;
  order_chargeable_weight_gram: number;
  edt: number;
}

export interface OrderSyncOptions {
  orderStatus?: string[];
  timeFrom?: Date;
  timeTo?: Date;
  batchSize?: number;
  includeOrderItems?: boolean;
  syncDirection?: 'inbound' | 'outbound';
}

@Injectable()
export class ShopeeOrderService {
  private readonly logger = new Logger(ShopeeOrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    private readonly shopeeApiService: ShopeeApiService,
    private readonly authService: ShopeeAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly retryService: RetryService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * Sync orders from Shopee to local system
   */
  async syncOrdersFromShopee(
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
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_orders_inbound',
        'started',
        'Starting order sync from Shopee',
        { options },
      );

      // Get order list from Shopee
      const orderList = await this.getShopeeOrderList(
        credentials,
        tenantId,
        channelId,
        options,
      );

      if (!orderList.success || !orderList.data) {
        throw new Error(
          `Failed to get order list: ${orderList.error?.message}`,
        );
      }

      const orderSns = orderList.data.order_list.map(
        (order: any) => order.order_sn,
      );
      const batchSize = options.batchSize || 20;

      // Process orders in batches
      for (let i = 0; i < orderSns.length; i += batchSize) {
        const batch = orderSns.slice(i, i + batchSize);

        try {
          const batchResult = await this.syncOrderBatch(
            credentials,
            tenantId,
            channelId,
            batch,
            options,
          );

          syncedCount += batchResult.syncedCount;
          errorCount += batchResult.errorCount;
          errors.push(...batchResult.errors);
        } catch (error) {
          this.logger.error(
            `Order batch sync failed: ${error.message}`,
            error.stack,
          );
          errorCount += batch.length;
          errors.push(`Batch sync failed: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_orders_inbound',
        'completed',
        `Order sync completed: ${syncedCount} synced, ${errorCount} errors`,
        { syncedCount, errorCount, duration, totalOrders: orderSns.length },
      );

      return {
        success: true,
        syncedCount,
        errorCount,
        errors,
      };
    } catch (error) {
      this.logger.error(`Order sync failed: ${error.message}`, error.stack);

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_orders_inbound',
        'failed',
        error.message,
        { syncedCount, errorCount },
      );

      return {
        success: false,
        syncedCount,
        errorCount,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Get order details from Shopee
   */
  async getShopeeOrderDetails(
    tenantId: string,
    channelId: string,
    orderSn: string,
  ): Promise<{ success: boolean; data?: ShopeeOrder; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/order/get_order_detail',
        params: {
          order_sn_list: [orderSn],
          response_optional_fields: [
            'buyer_user_id',
            'buyer_username',
            'estimated_shipping_fee',
            'recipient_address',
            'actual_shipping_fee',
            'goods_to_declare',
            'note',
            'note_update_time',
            'item_list',
            'pay_time',
            'dropshipper',
            'dropshipper_phone',
            'split_up',
            'buyer_cancel_reason',
            'cancel_by',
            'cancel_reason',
            'actual_shipping_fee_confirmed',
            'buyer_cpf_id',
            'fulfillment_flag',
            'pickup_done_time',
            'package_list',
            'invoice_data',
            'checkout_shipping_carrier',
            'reverse_shipping_fee',
            'order_chargeable_weight_gram',
            'edt',
          ],
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success && response.data?.order_list?.[0]) {
        return {
          success: true,
          data: response.data.order_list[0],
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Order not found',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Shopee order details: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update order status in Shopee
   */
  async updateShopeeOrderStatus(
    tenantId: string,
    channelId: string,
    orderSn: string,
    action: 'ship' | 'cancel',
    params?: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      let endpoint: string;
      let data: Record<string, any>;

      switch (action) {
        case 'ship':
          endpoint = '/logistics/ship_order';
          data = {
            order_sn: orderSn,
            package_number: params?.packageNumber || '',
            ...params,
          };
          break;
        case 'cancel':
          endpoint = '/order/cancel_order';
          data = {
            order_sn: orderSn,
            cancel_reason: params?.cancelReason || 'OUT_OF_STOCK',
            item_list: params?.itemList || [],
          };
          break;
        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      const request: ShopeeApiRequest = {
        method: 'POST',
        endpoint,
        data,
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success) {
        await this.logService.logSync(
          tenantId,
          channelId,
          'shopee_order_status_update',
          'completed',
          `Order ${orderSn} ${action} action completed`,
          { orderSn, action, params },
        );

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Status update failed',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to update Shopee order status: ${error.message}`,
        error.stack,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_order_status_update',
        'failed',
        error.message,
        { orderSn, action },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get order shipment info from Shopee
   */
  async getShopeeOrderShipment(
    tenantId: string,
    channelId: string,
    orderSn: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/logistics/get_tracking_number',
        params: {
          order_sn: orderSn,
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Shipment info not found',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Shopee order shipment: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bidirectional order status synchronization between local system and Shopee
   * Handles conflicts and ensures consistent order status across systems
   * Uses comprehensive error handling with retry and circuit breaker
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
      orderSn: string;
      localStatus: OrderStatus;
      shopeeStatus: string;
      resolution: string;
    }>;
  }> {
    const startTime = Date.now();
    const correlationId = `sync-${tenantId}-${channelId}-${Date.now()}`;
    
    // Create error handling context for Indonesian business environment
    const errorContext: ErrorHandlingContext = {
      tenantId,
      channelId,
      operationType: 'order_sync',
      operationName: 'syncOrderStatus',
      serviceName: 'shopee-order-service',
      platform: 'shopee',
      correlationId,
      businessContext: {
        batchSize: 20,
        orderIds: orderIds?.length || 'all',
        indonesianBusiness: true,
      },
    };

    // Execute with comprehensive error handling
    const result = await this.errorHandlingService.executeWithErrorHandling(
      async () => {
        let syncedCount = 0;
        let conflictCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const conflicts: Array<{
          orderId: string;
          orderSn: string;
          localStatus: OrderStatus;
          shopeeStatus: string;
          resolution: string;
        }> = [];

        await this.logService.logSync(
          tenantId,
          channelId,
          'shopee_order_status_sync',
          'started',
          'Starting bidirectional order status synchronization with error handling',
          { 
            orderIds: orderIds?.length || 'all',
            correlationId,
            errorHandling: {
              retryEnabled: true,
              circuitBreakerEnabled: true,
              platform: 'shopee',
            },
          },
        );

        // Get orders to sync with error handling
        const orders = await this.errorHandlingService.executeWithErrorHandling(
          () => this.getOrdersForStatusSync(tenantId, channelId, orderIds),
          {
            ...errorContext,
            operationName: 'getOrdersForStatusSync',
          },
        );

        if (!orders.success || !orders.result || orders.result.length === 0) {
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

        const ordersToSync = orders.result;

        // Process orders in batches for better performance with Indonesian rate limits
        const batchSize = 20; // Shopee-friendly batch size for Indonesian market
        for (let i = 0; i < ordersToSync.length; i += batchSize) {
          const batch = ordersToSync.slice(i, i + batchSize);
          
          // Execute each batch with error handling and retry logic
          const batchContext: ErrorHandlingContext = {
            ...errorContext,
            operationName: `syncOrderStatusBatch-${i / batchSize + 1}`,
            businessContext: {
              ...errorContext.businessContext,
              batchIndex: i / batchSize + 1,
              batchSize: batch.length,
              remainingOrders: ordersToSync.length - i,
            },
          };

          const batchResult = await this.errorHandlingService.executeWithErrorHandling(
            () => this.syncOrderStatusBatch(tenantId, channelId, batch),
            batchContext,
            {
              retry: {
                maxAttempts: 3,
                initialDelayMs: 2000,
                maxDelayMs: 30000,
                backoffMultiplier: 1.5,
                jitterMaxMs: 1000,
                retryableErrors: [
                  ErrorType.TRANSIENT,
                  ErrorType.NETWORK,
                  ErrorType.TIMEOUT,
                  ErrorType.RATE_LIMIT,
                ],
              },
              circuitBreaker: {
                failureThreshold: 5,
                successThreshold: 3,
                timeout: 60000,
                volumeThreshold: 10,
                errorThresholdPercentage: 50,
                monitoringPeriod: 60000,
                resetTimeout: 300000,
              },
              enableCircuitBreaker: true,
              enableRetry: true,
              operationTimeout: 45000, // 45 seconds for batch operations
            },
          );

          if (batchResult.success && batchResult.result) {
            syncedCount += batchResult.result.syncedCount;
            conflictCount += batchResult.result.conflictCount;
            errorCount += batchResult.result.errorCount;
            errors.push(...batchResult.result.errors);
            conflicts.push(...batchResult.result.conflicts);
          } else {
            // Handle batch failure
            errorCount += batch.length;
            const batchError = `Batch ${i / batchSize + 1} failed: ${
              batchResult.error?.message || 'Unknown error'
            }`;
            errors.push(batchError);
            
            this.logger.error(
              `Order status sync batch failed: ${batchError}`,
              {
                batchIndex: i / batchSize + 1,
                batchSize: batch.length,
                error: batchResult.error,
                correlationId,
              },
            );
          }
        }

        const duration = Date.now() - startTime;

        await this.logService.logSync(
          tenantId,
          channelId,
          'shopee_order_status_sync',
          'completed',
          `Status sync completed with error handling: ${syncedCount} synced, ${conflictCount} conflicts, ${errorCount} errors`,
          { 
            syncedCount, 
            conflictCount, 
            errorCount, 
            duration, 
            totalOrders: ordersToSync.length,
            correlationId,
            errorHandlingMetrics: {
              retryAttempts: result?.metrics?.retryAttempts || 0,
              circuitBreakerState: result?.metrics?.circuitBreakerState || CircuitBreakerState.CLOSED,
            },
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
      },
      errorContext,
      {
        retry: {
          maxAttempts: 2, // Limited retries for main operation
          initialDelayMs: 5000,
          maxDelayMs: 60000,
          backoffMultiplier: 2,
          jitterMaxMs: 2000,
        },
        circuitBreaker: {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 120000, // 2 minutes for full sync operation
          volumeThreshold: 5,
          errorThresholdPercentage: 40,
          monitoringPeriod: 60000,
          resetTimeout: 300000,
        },
        enableCircuitBreaker: true,
        enableRetry: true,
        operationTimeout: 300000, // 5 minutes for complete order sync
      },
    );

    // Handle final result with comprehensive error information
    if (result.success && result.result) {
      return result.result;
    } else {
      // Log comprehensive error details
      const errorMessage = result.error?.message || 'Order status sync failed';
      const duration = Date.now() - startTime;
      
      this.logger.error(
        `Order status sync failed with error handling: ${errorMessage}`,
        {
          error: result.error,
          metrics: result.metrics,
          correlationId,
          duration,
          recoverable: result.error?.recoverable,
          recommendations: result.error?.recommendations,
        },
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_order_status_sync',
        'failed',
        errorMessage,
        { 
          correlationId,
          duration,
          errorType: result.error?.type,
          retryAttempts: result.metrics?.retryAttempts || 0,
          circuitBreakerState: result.metrics?.circuitBreakerState,
          recoverable: result.error?.recoverable,
          recommendations: result.error?.recommendations,
        },
      );

      return {
        success: false,
        syncedCount: 0,
        conflictCount: 0,
        errorCount: 1,
        errors: [errorMessage, ...(result.error?.recommendations || [])],
        conflicts: [],
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

    // Focus on orders that haven't been synced recently (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    query.andWhere(
      '(mapping.last_sync_at IS NULL OR mapping.last_sync_at < :oneHourAgo)',
      { oneHourAgo },
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
      orderSn: string;
      localStatus: OrderStatus;
      shopeeStatus: string;
      resolution: string;
    }>;
  }> {
    let syncedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const conflicts: Array<{
      orderId: string;
      orderSn: string;
      localStatus: OrderStatus;
      shopeeStatus: string;
      resolution: string;
    }> = [];

    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      // Get current status from Shopee for all orders in batch
      const orderSns = orders.map(order => order.mapping.externalId);
      const shopeeOrdersResult = await this.getShopeeOrdersBatch(
        credentials,
        tenantId,
        channelId,
        orderSns,
      );

      if (!shopeeOrdersResult.success) {
        throw new Error(`Failed to get Shopee orders: ${shopeeOrdersResult.error}`);
      }

      const shopeeOrders = shopeeOrdersResult.data || [];

      // Process each order for status synchronization
      for (const order of orders) {
        try {
          const shopeeOrder = shopeeOrders.find(
            so => so.order_sn === order.mapping.externalId,
          );

          if (!shopeeOrder) {
            errors.push(
              `Order ${order.mapping.externalId} not found in Shopee`,
            );
            errorCount++;
            continue;
          }

          const syncResult = await this.syncSingleOrderStatus(
            tenantId,
            channelId,
            order,
            shopeeOrder,
            credentials,
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
   * Get Shopee orders in batch for status checking with comprehensive error handling
   */
  private async getShopeeOrdersBatch(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    orderSns: string[],
  ): Promise<{ success: boolean; data?: ShopeeOrder[]; error?: string }> {
    const correlationId = `batch-orders-${tenantId}-${channelId}-${Date.now()}`;
    
    // Create error handling context for Shopee API call
    const errorContext: ErrorHandlingContext = {
      tenantId,
      channelId,
      operationType: 'api_call',
      operationName: 'getShopeeOrdersBatch',
      serviceName: 'shopee-api-service',
      platform: 'shopee',
      correlationId,
      businessContext: {
        orderSnsCount: orderSns.length,
        endpoint: '/order/get_order_detail',
        indonesianBusiness: true,
        rateLimit: {
          perSecond: 10,
          perMinute: 1000,
        },
      },
    };

    // Execute API call with comprehensive error handling
    const result = await this.errorHandlingService.executeWithErrorHandling(
      async () => {
        const request: ShopeeApiRequest = {
          method: 'GET',
          endpoint: '/order/get_order_detail',
          params: {
            order_sn_list: orderSns,
            response_optional_fields: ['order_status', 'update_time'],
          },
        };

        const response = await this.shopeeApiService.makeShopeeRequest(
          credentials,
          request,
          tenantId,
          channelId,
        );

        if (response.success && response.data?.order_list) {
          return {
            success: true,
            data: response.data.order_list,
          };
        } else {
          throw new Error(response.error?.message || 'Failed to get orders from Shopee API');
        }
      },
      errorContext,
      {
        retry: {
          maxAttempts: 4, // Higher retries for API calls due to Shopee rate limits
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 1.5,
          jitterMaxMs: 1000,
          retryableErrors: [
            ErrorType.TRANSIENT,
            ErrorType.NETWORK,
            ErrorType.TIMEOUT,
            ErrorType.RATE_LIMIT,
          ],
        },
        circuitBreaker: {
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 60000, // 1 minute timeout for Shopee API
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          monitoringPeriod: 60000,
          resetTimeout: 300000, // 5 minutes reset for Shopee
        },
        enableCircuitBreaker: true,
        enableRetry: true,
        operationTimeout: 30000, // 30 seconds for API call
      },
    );

    // Handle result
    if (result.success && result.result) {
      this.logger.debug(
        `Successfully retrieved ${result.result.data?.length || 0} orders from Shopee`,
        {
          correlationId,
          orderSnsCount: orderSns.length,
          retryAttempts: result.metrics?.retryAttempts,
          circuitBreakerState: result.metrics?.circuitBreakerState,
        },
      );
      return result.result;
    } else {
      // Log comprehensive error details for Indonesian business context
      const errorMessage = result.error?.message || 'Failed to get Shopee orders batch';
      
      this.logger.error(
        `Shopee orders batch API call failed: ${errorMessage}`,
        {
          correlationId,
          orderSnsCount: orderSns.length,
          error: result.error,
          metrics: result.metrics,
          recoverable: result.error?.recoverable,
          recommendations: result.error?.recommendations,
          indonesianBusinessContext: {
            timezone: 'Asia/Jakarta',
            businessHours: errorContext.businessContext?.indonesianBusiness,
          },
        },
      );

      return {
        success: false,
        error: `${errorMessage}${result.error?.recommendations ? 
          ` - Recommendations: ${result.error.recommendations.join(', ')}` : ''}`,
      };
    }
  }

  /**
   * Sync status for a single order with conflict resolution
   */
  private async syncSingleOrderStatus(
    tenantId: string,
    channelId: string,
    order: Order & { mapping: ChannelMapping },
    shopeeOrder: ShopeeOrder,
    credentials: ShopeeCredentials,
  ): Promise<{
    success: boolean;
    conflict?: {
      orderId: string;
      orderSn: string;
      localStatus: OrderStatus;
      shopeeStatus: string;
      resolution: string;
    };
    error?: string;
  }> {
    const localStatus = order.status;
    const shopeeStatus = shopeeOrder.order_status;
    const mappedShopeeStatus = this.mapShopeeOrderStatus(shopeeStatus);

    // Check if statuses are already in sync
    if (localStatus === mappedShopeeStatus) {
      await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);
      return { success: true };
    }

    // Determine sync direction based on Indonesian business rules
    const syncDirection = this.determineSyncDirection(
      order,
      shopeeOrder,
      localStatus,
      mappedShopeeStatus,
    );

    try {
      switch (syncDirection) {
        case 'local_to_shopee':
          // Update Shopee with local status
          const shopeeAction = this.getShopeeActionFromStatus(localStatus);
          if (shopeeAction) {
            const updateResult = await this.updateShopeeOrderStatus(
              tenantId,
              channelId,
              shopeeOrder.order_sn,
              shopeeAction,
            );

            if (updateResult.success) {
              await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);
              return { success: true };
            } else {
              return { success: false, error: updateResult.error };
            }
          }
          break;

        case 'shopee_to_local':
          // Update local with Shopee status
          await this.orderRepository.update(
            { id: order.id },
            { 
              status: mappedShopeeStatus,
              updatedAt: new Date(),
            },
          );

          await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);

          // Emit status change event
          this.eventEmitter.emit('order.status.changed', {
            tenantId,
            channelId,
            orderId: order.id,
            orderSn: shopeeOrder.order_sn,
            oldStatus: localStatus,
            newStatus: mappedShopeeStatus,
            source: 'shopee',
          });

          return { success: true };

        case 'conflict':
          // Handle conflict with Indonesian business logic
          const resolution = await this.resolveStatusConflict(
            tenantId,
            channelId,
            order,
            shopeeOrder,
            localStatus,
            mappedShopeeStatus,
          );

          return {
            success: false,
            conflict: {
              orderId: order.id,
              orderSn: shopeeOrder.order_sn,
              localStatus,
              shopeeStatus,
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
    shopeeOrder: ShopeeOrder,
    localStatus: OrderStatus,
    mappedShopeeStatus: OrderStatus,
  ): 'local_to_shopee' | 'shopee_to_local' | 'conflict' {
    const localUpdateTime = order.updatedAt;
    const shopeeUpdateTime = new Date(shopeeOrder.update_time * 1000);

    // Rule 1: If one side is in final state, don't override
    const finalStatuses = [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED];
    if (finalStatuses.includes(localStatus) && !finalStatuses.includes(mappedShopeeStatus)) {
      return 'local_to_shopee';
    }
    if (finalStatuses.includes(mappedShopeeStatus) && !finalStatuses.includes(localStatus)) {
      return 'shopee_to_local';
    }

    // Rule 2: For Indonesian business context, prioritize customer-facing status
    const customerFacingStatuses = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];
    if (customerFacingStatuses.includes(mappedShopeeStatus) && 
        !customerFacingStatuses.includes(localStatus)) {
      return 'shopee_to_local';
    }

    // Rule 3: If timestamps are available, use most recent
    if (localUpdateTime && shopeeUpdateTime) {
      const timeDiff = Math.abs(localUpdateTime.getTime() - shopeeUpdateTime.getTime());
      // Only consider time difference if it's more than 5 minutes
      if (timeDiff > 5 * 60 * 1000) {
        return localUpdateTime > shopeeUpdateTime ? 'local_to_shopee' : 'shopee_to_local';
      }
    }

    // Rule 4: Default to conflict for manual resolution
    return 'conflict';
  }

  /**
   * Get Shopee action from local order status
   */
  private getShopeeActionFromStatus(status: OrderStatus): 'ship' | 'cancel' | null {
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
    shopeeOrder: ShopeeOrder,
    localStatus: OrderStatus,
    mappedShopeeStatus: OrderStatus,
  ): Promise<string> {
    // For Indonesian SMBs, prioritize customer satisfaction
    const customerPriorityStatuses = [
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ];

    if (customerPriorityStatuses.includes(mappedShopeeStatus)) {
      // Update local to match Shopee (customer-facing)
      await this.orderRepository.update(
        { id: order.id },
        { 
          status: mappedShopeeStatus,
          updatedAt: new Date(),
        },
      );

      await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);

      return `Resolved to Shopee status (${mappedShopeeStatus}) - customer-facing priority`;
    }

    // Default: Keep local status and try to sync to Shopee
    const shopeeAction = this.getShopeeActionFromStatus(localStatus);
    if (shopeeAction) {
      const updateResult = await this.updateShopeeOrderStatus(
        tenantId,
        channelId,
        shopeeOrder.order_sn,
        shopeeAction,
      );

      if (updateResult.success) {
        await this.updateMappingLastSync(tenantId, channelId, order.mapping.externalId);
        return `Resolved to local status (${localStatus}) - successfully synced to Shopee`;
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

  private async getShopeeOrderList(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    options: OrderSyncOptions,
    cursor: string = '',
    pageSize: number = 100,
  ): Promise<any> {
    const timeFrom =
      options.timeFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const timeTo = options.timeTo || new Date();

    const request: ShopeeApiRequest = {
      method: 'GET',
      endpoint: '/order/get_order_list',
      params: {
        time_range_field: 'update_time',
        time_from: Math.floor(timeFrom.getTime() / 1000),
        time_to: Math.floor(timeTo.getTime() / 1000),
        page_size: pageSize,
        cursor: cursor,
        order_status: options.orderStatus || [
          'UNPAID',
          'TO_SHIP',
          'SHIPPED',
          'TO_CONFIRM_RECEIVE',
          'IN_CANCEL',
          'CANCELLED',
          'TO_RETURN',
          'COMPLETED',
        ],
        response_optional_fields: ['order_status'],
      },
    };

    return await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  private async syncOrderBatch(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    orderSns: string[],
    options: OrderSyncOptions,
  ): Promise<{
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Get order details in batch
    const request: ShopeeApiRequest = {
      method: 'GET',
      endpoint: '/order/get_order_detail',
      params: {
        order_sn_list: orderSns,
        response_optional_fields: [
          'buyer_user_id',
          'buyer_username',
          'estimated_shipping_fee',
          'recipient_address',
          'actual_shipping_fee',
          'goods_to_declare',
          'note',
          'note_update_time',
          'item_list',
          'pay_time',
          'dropshipper',
          'dropshipper_phone',
          'split_up',
          'buyer_cancel_reason',
          'cancel_by',
          'cancel_reason',
          'actual_shipping_fee_confirmed',
          'buyer_cpf_id',
          'fulfillment_flag',
          'pickup_done_time',
          'package_list',
          'invoice_data',
          'checkout_shipping_carrier',
          'reverse_shipping_fee',
          'order_chargeable_weight_gram',
          'edt',
        ],
      },
    };

    const response = await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );

    if (!response.success || !response.data?.order_list) {
      throw new Error(`Failed to get order batch: ${response.error?.message}`);
    }

    // Process each order
    for (const shopeeOrder of response.data.order_list) {
      try {
        await this.syncSingleOrder(tenantId, channelId, shopeeOrder, options);
        syncedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to sync order ${shopeeOrder.order_sn}: ${error.message}`,
        );
        errors.push(`Order ${shopeeOrder.order_sn}: ${error.message}`);
        errorCount++;
      }
    }

    return { syncedCount, errorCount, errors };
  }

  private async syncSingleOrder(
    tenantId: string,
    channelId: string,
    shopeeOrder: ShopeeOrder,
    options: OrderSyncOptions,
  ): Promise<void> {
    // Check if order mapping exists
    let mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'order',
        externalId: shopeeOrder.order_sn,
      },
    });

    let order: Order;

    if (mapping) {
      // Update existing order
      order = await this.orderRepository.findOne({
        where: { id: mapping.internalId, tenantId },
        relations: ['items'],
      });

      if (order) {
        this.updateOrderFromShopee(order, shopeeOrder);
        await this.orderRepository.save(order);
      }
    } else {
      // Create new order
      order = await this.createOrderFromShopee(
        tenantId,
        channelId,
        shopeeOrder,
      );
      await this.orderRepository.save(order);

      // Create mapping
      mapping = await this.saveOrderMapping(
        tenantId,
        channelId,
        order.id,
        shopeeOrder.order_sn,
        shopeeOrder,
      );
    }

    // Sync order items if enabled
    if (options.includeOrderItems) {
      await this.syncOrderItems(order, shopeeOrder);
    }

    // Emit sync event
    this.eventEmitter.emit('order.synced.shopee', {
      tenantId,
      channelId,
      orderId: order.id,
      externalId: shopeeOrder.order_sn,
      syncDirection: 'inbound',
    });
  }

  private async createOrderFromShopee(
    tenantId: string,
    channelId: string,
    shopeeOrder: ShopeeOrder,
  ): Promise<Order> {
    const order = this.orderRepository.create({
      tenantId,
      channelId,
      orderNumber: shopeeOrder.order_sn,
      status: this.mapShopeeOrderStatus(shopeeOrder.order_status),
      totalAmount: 0, // Will be calculated from items
      currency: 'IDR', // Default for Indonesia
      customerName:
        shopeeOrder.recipient_address?.name || shopeeOrder.buyer_username,
      customerEmail: '', // Not provided by Shopee
      customerPhone: shopeeOrder.recipient_address?.phone || '',
      shippingAddress: {
        name: shopeeOrder.recipient_address?.name || '',
        phone: shopeeOrder.recipient_address?.phone || '',
        address: shopeeOrder.recipient_address?.full_address || '',
        city: shopeeOrder.recipient_address?.city || '',
        state: shopeeOrder.recipient_address?.state || '',
        postalCode: shopeeOrder.recipient_address?.zipcode || '',
        country: 'Indonesia',
      },
      notes: shopeeOrder.note || '',
      createdAt: new Date(shopeeOrder.create_time * 1000),
      channelMetadata: {
        shopee: {
          buyerUserId: shopeeOrder.buyer_user_id,
          buyerUsername: shopeeOrder.buyer_username,
          payTime: shopeeOrder.pay_time,
          shipByDate: shopeeOrder.ship_by_date,
          daysToShip: shopeeOrder.days_to_ship,
          estimatedShippingFee: shopeeOrder.estimated_shipping_fee,
          actualShippingFee: shopeeOrder.actual_shipping_fee,
          dropshipper: shopeeOrder.dropshipper,
          dropshipperPhone: shopeeOrder.dropshipper_phone,
          packageList: shopeeOrder.package_list,
        },
      },
    });

    return order;
  }

  private updateOrderFromShopee(order: Order, shopeeOrder: ShopeeOrder): void {
    order.status = this.mapShopeeOrderStatus(shopeeOrder.order_status);
    order.notes = shopeeOrder.note || '';

    order.channelMetadata = {
      ...order.channelMetadata,
      shopee: {
        ...order.channelMetadata?.shopee,
        payTime: shopeeOrder.pay_time,
        actualShippingFee: shopeeOrder.actual_shipping_fee,
        packageList: shopeeOrder.package_list,
        lastSyncAt: new Date(),
      },
    };
  }

  private async syncOrderItems(
    order: Order,
    shopeeOrder: ShopeeOrder,
  ): Promise<void> {
    // Remove existing items
    if (order.items?.length) {
      await this.orderItemRepository.remove(order.items);
    }

    // Create new items
    const orderItems: OrderItem[] = [];

    for (const shopeeItem of shopeeOrder.item_list) {
      const orderItem = this.orderItemRepository.create({
        orderId: order.id,
        productName: shopeeItem.item_name,
        sku: shopeeItem.item_sku,
        variantName: shopeeItem.model_name,
        // variantSku: shopeeItem.model_sku,
        quantity: shopeeItem.model_quantity_purchased,
        unitPrice: shopeeItem.model_discounted_price,
        totalPrice:
          shopeeItem.model_discounted_price *
          shopeeItem.model_quantity_purchased,
        attributes: {
          shopee: {
            itemId: shopeeItem.item_id,
            modelId: shopeeItem.model_id,
            orderItemId: shopeeItem.order_item_id,
            originalPrice: shopeeItem.model_original_price,
            weight: shopeeItem.weight,
            wholesale: shopeeItem.wholesale,
            promotionType: shopeeItem.promotion_type,
            promotionId: shopeeItem.promotion_id,
            variantSku: shopeeItem.model_sku,
          },
        },
      });

      orderItems.push(orderItem);
    }

    await this.orderItemRepository.save(orderItems);

    // Update order total
    order.totalAmount = orderItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    await this.orderRepository.save(order);
  }

  private async saveOrderMapping(
    tenantId: string,
    channelId: string,
    internalId: string,
    externalId: string,
    externalData: any,
  ): Promise<ChannelMapping> {
    const mapping = this.mappingRepository.create({
      tenantId,
      channelId,
      entityType: 'order',
      internalId,
      externalId,
      externalData,
      lastSyncAt: new Date(),
    });

    return await this.mappingRepository.save(mapping);
  }

  private mapShopeeOrderStatus(shopeeStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      UNPAID: OrderStatus.PENDING,
      TO_SHIP: OrderStatus.CONFIRMED,
      SHIPPED: OrderStatus.SHIPPED,
      TO_CONFIRM_RECEIVE: OrderStatus.DELIVERED,
      IN_CANCEL: OrderStatus.CANCELLED,
      CANCELLED: OrderStatus.CANCELLED,
      TO_RETURN: OrderStatus.RETURNED,
      COMPLETED: OrderStatus.DELIVERED,
    };

    return statusMap[shopeeStatus] || OrderStatus.PENDING;
  }
}
