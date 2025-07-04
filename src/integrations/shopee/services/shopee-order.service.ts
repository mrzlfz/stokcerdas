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

  // Private helper methods

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
