import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In, Between, Like } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { Order, OrderStatus, OrderType, PaymentStatus, FulfillmentStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

// Common services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';

// Channel services
import { ChannelsService } from '../../channels/services/channels.service';
import { ChannelInventoryService } from '../../channels/services/channel-inventory.service';

export interface CreateOrderDto {
  orderNumber?: string;
  externalOrderId?: string;
  channelId?: string;
  channelName?: string;
  type?: OrderType;
  orderDate?: Date;
  
  // Customer information
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerInfo?: any;
  
  // Shipping information
  shippingAddress?: any;
  billingAddress?: any;
  shippingMethod?: string;
  shippingCarrier?: string;
  
  // Payment information
  paymentMethod?: string;
  paymentReference?: string;
  currency?: string;
  
  // Order details
  items: CreateOrderItemDto[];
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  
  // Additional information
  notes?: string;
  internalNotes?: string;
  tags?: string[];
  priority?: number;
  channelMetadata?: any;
  externalData?: any;
}

export interface CreateOrderItemDto {
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
  image?: string;
  attributes?: any;
  notes?: string;
  externalItemId?: string;
  externalData?: any;
}

export interface UpdateOrderDto {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  
  // Customer information
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerInfo?: any;
  
  // Shipping information
  shippingAddress?: any;
  billingAddress?: any;
  shippingMethod?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  
  // Payment information
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: Date;
  
  // Processing information
  processingLocationId?: string;
  
  // Additional information
  notes?: string;
  internalNotes?: string;
  tags?: string[];
  priority?: number;
  channelMetadata?: any;
  externalData?: any;
}

export interface OrderListQuery {
  status?: OrderStatus | OrderStatus[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  fulfillmentStatus?: FulfillmentStatus | FulfillmentStatus[];
  orderType?: OrderType;
  channelId?: string;
  channelName?: string;
  externalOrderId?: string;
  
  // Date filters
  orderDateFrom?: Date;
  orderDateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
  
  // Customer filters
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  
  // Search
  search?: string;
  orderNumber?: string;
  
  // Financial filters
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  
  // Tags and priority
  tags?: string[];
  priority?: number;
  
  // External platform filters
  hasExternalOrderId?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
  
  // Pagination and sorting
  limit?: number;
  offset?: number;
  sortBy?: 'orderDate' | 'createdAt' | 'totalAmount' | 'status' | 'priority';
  sortOrder?: 'ASC' | 'DESC';
  
  // Include relations
  includeItems?: boolean;
  includeStatusHistory?: boolean;
  includeMetrics?: boolean;
}

export interface OrderSummary {
  totalOrders: number;
  totalAmount: number;
  statusBreakdown: Record<OrderStatus, number>;
  paymentStatusBreakdown: Record<PaymentStatus, number>;
  fulfillmentStatusBreakdown: Record<FulfillmentStatus, number>;
  channelBreakdown: Record<string, number>;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface BulkOrderAction {
  orderIds: string[];
  action: 'update_status' | 'assign_location' | 'add_tags' | 'export' | 'sync';
  params?: any;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepository: Repository<OrderStatusHistory>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    
    // Channel services
    private readonly channelsService: ChannelsService,
    private readonly channelInventoryService: ChannelInventoryService,
    
    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new order
   */
  async createOrder(tenantId: string, createDto: CreateOrderDto): Promise<Order> {
    try {
      this.logger.debug(`Creating order for tenant ${tenantId}`, { createDto });

      // Generate order number if not provided
      const orderNumber = createDto.orderNumber || await this.generateOrderNumber(tenantId);

      // Validate order data
      await this.validateOrderData(tenantId, createDto);

      // Check product availability
      await this.validateProductAvailability(tenantId, createDto.items);

      // Create order entity
      const order = this.orderRepository.create({
        ...createDto,
        tenantId,
        orderNumber,
        orderDate: createDto.orderDate || new Date(),
        currency: createDto.currency || 'IDR',
        priority: createDto.priority || 3, // Default to medium priority
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.PENDING,
      });

      // Create order items
      order.items = createDto.items.map(itemDto => 
        this.orderItemRepository.create({
          ...itemDto,
          tenantId,
          totalPrice: itemDto.unitPrice * itemDto.quantity,
          taxAmount: (itemDto.unitPrice * itemDto.quantity * (itemDto.taxRate || 0)) / 100,
        })
      );

      // Calculate totals
      order.calculateTotals();

      // Save order with items
      const savedOrder = await this.orderRepository.save(order);

      // Create initial status history
      await this.createStatusHistory(tenantId, savedOrder.id, OrderStatus.PENDING, null, 'Order created');

      // Reserve inventory if needed
      if (createDto.channelId) {
        await this.reserveInventoryForOrder(tenantId, savedOrder);
      }

      // Log creation
      await this.logService.log({
        tenantId,
        type: 'ORDER',
        level: 'INFO',
        message: `Order created: ${orderNumber}`,
        metadata: { 
          orderId: savedOrder.id,
          orderNumber,
          totalAmount: savedOrder.totalAmount,
          itemCount: savedOrder.itemCount,
          channelId: createDto.channelId,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.created', {
        tenantId,
        order: savedOrder,
      });

      return savedOrder;

    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'create_order', createDto },
      });
      throw error;
    }
  }

  /**
   * Get all orders for a tenant
   */
  async getOrders(tenantId: string, query: OrderListQuery = {}): Promise<{
    orders: Order[];
    total: number;
    summary?: OrderSummary;
  }> {
    try {
      const where: FindOptionsWhere<Order> = { tenantId };

      // Status filters
      if (query.status) {
        where.status = Array.isArray(query.status) ? In(query.status) : query.status;
      }
      if (query.paymentStatus) {
        where.paymentStatus = Array.isArray(query.paymentStatus) ? In(query.paymentStatus) : query.paymentStatus;
      }
      if (query.fulfillmentStatus) {
        where.fulfillmentStatus = Array.isArray(query.fulfillmentStatus) ? In(query.fulfillmentStatus) : query.fulfillmentStatus;
      }

      // Basic filters
      if (query.orderType) {
        where.type = query.orderType;
      }
      if (query.channelId) {
        where.channelId = query.channelId;
      }
      if (query.externalOrderId) {
        where.externalOrderId = query.externalOrderId;
      }
      if (query.orderNumber) {
        where.orderNumber = query.orderNumber;
      }

      const queryBuilder = this.orderRepository.createQueryBuilder('order')
        .where(where);

      // Date range filters
      if (query.orderDateFrom || query.orderDateTo) {
        queryBuilder.andWhere('order.orderDate BETWEEN :dateFrom AND :dateTo', {
          dateFrom: query.orderDateFrom || new Date('1900-01-01'),
          dateTo: query.orderDateTo || new Date(),
        });
      }

      if (query.createdFrom || query.createdTo) {
        queryBuilder.andWhere('order.createdAt BETWEEN :createdFrom AND :createdTo', {
          createdFrom: query.createdFrom || new Date('1900-01-01'),
          createdTo: query.createdTo || new Date(),
        });
      }

      // Customer filters
      if (query.customerName) {
        queryBuilder.andWhere('order.customerName ILIKE :customerName', {
          customerName: `%${query.customerName}%`,
        });
      }
      if (query.customerEmail) {
        queryBuilder.andWhere('order.customerEmail ILIKE :customerEmail', {
          customerEmail: `%${query.customerEmail}%`,
        });
      }
      if (query.customerPhone) {
        queryBuilder.andWhere('order.customerPhone ILIKE :customerPhone', {
          customerPhone: `%${query.customerPhone}%`,
        });
      }

      // Channel name filter
      if (query.channelName) {
        queryBuilder.andWhere('order.channelName ILIKE :channelName', {
          channelName: `%${query.channelName}%`,
        });
      }

      // Financial filters
      if (query.minAmount || query.maxAmount) {
        queryBuilder.andWhere('order.totalAmount BETWEEN :minAmount AND :maxAmount', {
          minAmount: query.minAmount || 0,
          maxAmount: query.maxAmount || Number.MAX_SAFE_INTEGER,
        });
      }

      if (query.currency) {
        queryBuilder.andWhere('order.currency = :currency', { currency: query.currency });
      }

      // Search filter
      if (query.search) {
        queryBuilder.andWhere(
          '(order.orderNumber ILIKE :search OR order.customerName ILIKE :search OR order.customerEmail ILIKE :search OR order.notes ILIKE :search)',
          { search: `%${query.search}%` }
        );
      }

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        queryBuilder.andWhere('order.tags && :tags', { tags: query.tags });
      }

      // Priority filter
      if (query.priority !== undefined) {
        queryBuilder.andWhere('order.priority = :priority', { priority: query.priority });
      }

      // External order ID existence filter
      if (query.hasExternalOrderId !== undefined) {
        if (query.hasExternalOrderId) {
          queryBuilder.andWhere('order.externalOrderId IS NOT NULL');
        } else {
          queryBuilder.andWhere('order.externalOrderId IS NULL');
        }
      }

      // Sync status filter
      if (query.syncStatus) {
        queryBuilder.andWhere(`order.externalData->>'syncStatus' = :syncStatus`, {
          syncStatus: query.syncStatus,
        });
      }

      // Include relations
      if (query.includeItems) {
        queryBuilder.leftJoinAndSelect('order.items', 'items');
      }
      if (query.includeStatusHistory) {
        queryBuilder.leftJoinAndSelect('order.statusHistory', 'statusHistory');
      }

      // Sorting
      const sortBy = query.sortBy || 'orderDate';
      const sortOrder = query.sortOrder || 'DESC';
      queryBuilder.orderBy(`order.${sortBy}`, sortOrder);

      // Add secondary sort for consistency
      if (sortBy !== 'createdAt') {
        queryBuilder.addOrderBy('order.createdAt', 'DESC');
      }

      // Pagination
      if (query.limit) {
        queryBuilder.take(query.limit);
      }
      if (query.offset) {
        queryBuilder.skip(query.offset);
      }

      const [orders, total] = await queryBuilder.getManyAndCount();

      const result: any = { orders, total };

      // Include summary if requested
      if (query.includeMetrics) {
        result.summary = await this.getOrderSummary(tenantId, query);
      }

      return result;

    } catch (error) {
      this.logger.error(`Failed to get orders: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a specific order by ID
   */
  async getOrderById(tenantId: string, orderId: string, includeRelations = true): Promise<Order> {
    try {
      const relations = [];
      if (includeRelations) {
        relations.push('items', 'statusHistory');
      }

      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
        relations,
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      return order;

    } catch (error) {
      this.logger.error(`Failed to get order: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(tenantId: string, orderNumber: string): Promise<Order> {
    try {
      const order = await this.orderRepository.findOne({
        where: { tenantId, orderNumber },
        relations: ['items', 'statusHistory'],
      });

      if (!order) {
        throw new NotFoundException(`Order with number ${orderNumber} not found`);
      }

      return order;

    } catch (error) {
      this.logger.error(`Failed to get order by number: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get order by external order ID
   */
  async getOrderByExternalId(tenantId: string, externalOrderId: string): Promise<Order | null> {
    try {
      const order = await this.orderRepository.findOne({
        where: { tenantId, externalOrderId },
        relations: ['items', 'statusHistory'],
      });

      return order;

    } catch (error) {
      this.logger.error(`Failed to get order by external ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an order
   */
  async updateOrder(tenantId: string, orderId: string, updateDto: UpdateOrderDto, userId?: string): Promise<Order> {
    try {
      const order = await this.getOrderById(tenantId, orderId);
      const originalStatus = order.status;

      // Update order properties
      Object.assign(order, updateDto);

      // Handle status changes
      if (updateDto.status && updateDto.status !== originalStatus) {
        order.updateStatus(updateDto.status, userId);
        
        // Create status history record
        await this.createStatusHistory(
          tenantId,
          orderId,
          updateDto.status,
          originalStatus,
          'Status updated via API',
          userId,
        );
      }

      // Recalculate totals if amounts changed
      if (updateDto.taxAmount !== undefined || updateDto.shippingAmount !== undefined || updateDto.discountAmount !== undefined) {
        order.calculateTotals();
      }

      const updatedOrder = await this.orderRepository.save(order);

      // Log update
      await this.logService.log({
        tenantId,
        type: 'ORDER',
        level: 'INFO',
        message: `Order updated: ${order.orderNumber}`,
        metadata: { 
          orderId,
          updates: updateDto,
          originalStatus,
          newStatus: order.status,
        },
      });

      // Emit events
      this.eventEmitter.emit('order.updated', {
        tenantId,
        orderId,
        order: updatedOrder,
        changes: updateDto,
        originalStatus,
      });

      if (updateDto.status && updateDto.status !== originalStatus) {
        this.eventEmitter.emit('order.status.changed', {
          tenantId,
          orderId,
          order: updatedOrder,
          oldStatus: originalStatus,
          newStatus: updateDto.status,
        });
      }

      return updatedOrder;

    } catch (error) {
      this.logger.error(`Failed to update order: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'update_order', orderId, updateDto },
      });
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(tenantId: string, orderId: string, reason: string, userId?: string): Promise<Order> {
    try {
      const order = await this.getOrderById(tenantId, orderId);

      if (!order.canBeCancelled) {
        throw new BadRequestException(`Order ${order.orderNumber} cannot be cancelled in its current status: ${order.status}`);
      }

      // Update order status
      const originalStatus = order.status;
      order.updateStatus(OrderStatus.CANCELLED, userId, reason);

      // Release reserved inventory
      await this.releaseInventoryForOrder(tenantId, order);

      const updatedOrder = await this.orderRepository.save(order);

      // Create status history
      await this.createStatusHistory(
        tenantId,
        orderId,
        OrderStatus.CANCELLED,
        originalStatus,
        reason,
        userId,
      );

      // Log cancellation
      await this.logService.log({
        tenantId,
        type: 'ORDER',
        level: 'INFO',
        message: `Order cancelled: ${order.orderNumber}`,
        metadata: { 
          orderId,
          reason,
          originalStatus,
          userId,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.cancelled', {
        tenantId,
        orderId,
        order: updatedOrder,
        reason,
        originalStatus,
      });

      return updatedOrder;

    } catch (error) {
      this.logger.error(`Failed to cancel order: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'cancel_order', orderId, reason },
      });
      throw error;
    }
  }

  /**
   * Get orders by channel
   */
  async getOrdersByChannel(tenantId: string, channelId: string, query: OrderListQuery = {}): Promise<Order[]> {
    const channelQuery = { ...query, channelId };
    const result = await this.getOrders(tenantId, channelQuery);
    return result.orders;
  }

  /**
   * Get order summary statistics
   */
  async getOrderSummary(tenantId: string, filters: OrderListQuery = {}): Promise<OrderSummary> {
    try {
      const baseQuery = this.orderRepository.createQueryBuilder('order')
        .where('order.tenantId = :tenantId', { tenantId });

      // Apply same filters as getOrders
      this.applyFiltersToQuery(baseQuery, filters);

      // Get basic metrics
      const [totalOrders, orders] = await baseQuery.getManyAndCount();
      
      const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

      // Status breakdowns
      const statusBreakdown = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<OrderStatus, number>);

      const paymentStatusBreakdown = orders.reduce((acc, order) => {
        acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1;
        return acc;
      }, {} as Record<PaymentStatus, number>);

      const fulfillmentStatusBreakdown = orders.reduce((acc, order) => {
        acc[order.fulfillmentStatus] = (acc[order.fulfillmentStatus] || 0) + 1;
        return acc;
      }, {} as Record<FulfillmentStatus, number>);

      const channelBreakdown = orders.reduce((acc, order) => {
        const key = order.channelName || 'Direct';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top products (simplified - would need more complex query in production)
      const topProducts = [];

      return {
        totalOrders,
        totalAmount,
        statusBreakdown,
        paymentStatusBreakdown,
        fulfillmentStatusBreakdown,
        channelBreakdown,
        averageOrderValue,
        topProducts,
      };

    } catch (error) {
      this.logger.error(`Failed to get order summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Perform bulk operations on orders
   */
  async bulkAction(tenantId: string, action: BulkOrderAction, userId?: string): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    try {
      this.logger.debug(`Performing bulk action: ${action.action} on ${action.orderIds.length} orders`);

      let processedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const orderId of action.orderIds) {
        try {
          switch (action.action) {
            case 'update_status':
              await this.updateOrder(tenantId, orderId, { status: action.params.status }, userId);
              break;

            case 'assign_location':
              await this.updateOrder(tenantId, orderId, { processingLocationId: action.params.locationId }, userId);
              break;

            case 'add_tags':
              const order = await this.getOrderById(tenantId, orderId, false);
              const currentTags = order.tags || [];
              const newTags = [...new Set([...currentTags, ...action.params.tags])];
              await this.updateOrder(tenantId, orderId, { tags: newTags }, userId);
              break;

            default:
              throw new BadRequestException(`Unsupported bulk action: ${action.action}`);
          }

          processedCount++;

        } catch (error) {
          failedCount++;
          errors.push(`Order ${orderId}: ${error.message}`);
        }
      }

      // Log bulk action
      await this.logService.log({
        tenantId,
        type: 'ORDER',
        level: failedCount > 0 ? 'WARN' : 'INFO',
        message: `Bulk action completed: ${action.action}`,
        metadata: { 
          action: action.action,
          totalOrders: action.orderIds.length,
          processedCount,
          failedCount,
        },
      });

      return {
        success: failedCount === 0,
        processedCount,
        failedCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Failed to perform bulk action: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const count = await this.orderRepository.count({
      where: {
        tenantId,
        orderNumber: Like(`${datePrefix}%`),
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${datePrefix}${sequence}`;
  }

  private async validateOrderData(tenantId: string, createDto: CreateOrderDto): Promise<void> {
    // Validate channel exists if provided
    if (createDto.channelId) {
      try {
        await this.channelsService.getChannelById(tenantId, createDto.channelId);
      } catch (error) {
        throw new BadRequestException(`Invalid channel ID: ${createDto.channelId}`);
      }
    }

    // Validate order items
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException('Order must have at least one item');
    }

    // Validate customer information
    if (!createDto.customerName || createDto.customerName.trim().length === 0) {
      throw new BadRequestException('Customer name is required');
    }
  }

  private async validateProductAvailability(tenantId: string, items: CreateOrderItemDto[]): Promise<void> {
    for (const item of items) {
      // Check if product exists
      const product = await this.productRepository.findOne({
        where: { tenantId, id: item.productId },
      });

      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }

      // Check inventory availability (basic check)
      const inventory = await this.inventoryRepository.findOne({
        where: { tenantId, productId: item.productId, variantId: item.variantId },
      });

      if (inventory && inventory.quantityAvailable < item.quantity) {
        throw new BadRequestException(
          `Insufficient inventory for product ${item.productName}: ${inventory.quantityAvailable} available, ${item.quantity} requested`
        );
      }
    }
  }

  private async createStatusHistory(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    previousStatus: OrderStatus | null,
    reason?: string,
    userId?: string,
  ): Promise<void> {
    const statusHistory = this.statusHistoryRepository.create({
      tenantId,
      orderId,
      status,
      previousStatus,
      reason,
      notes: reason,
      changedAt: new Date(),
      createdBy: userId,
    });

    await this.statusHistoryRepository.save(statusHistory);
  }

  private async reserveInventoryForOrder(tenantId: string, order: Order): Promise<void> {
    // This would integrate with inventory service to reserve items
    // For now, just emit an event
    this.eventEmitter.emit('order.inventory.reserve', {
      tenantId,
      orderId: order.id,
      channelId: order.channelId,
      items: order.items,
    });
  }

  private async releaseInventoryForOrder(tenantId: string, order: Order): Promise<void> {
    // This would integrate with inventory service to release reserved items
    // For now, just emit an event
    this.eventEmitter.emit('order.inventory.release', {
      tenantId,
      orderId: order.id,
      channelId: order.channelId,
      items: order.items,
    });
  }

  private applyFiltersToQuery(queryBuilder: any, filters: OrderListQuery): void {
    // Apply various filters to the query builder
    // This is a helper method to avoid code duplication
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      queryBuilder.andWhere('order.status IN (:...statuses)', { statuses });
    }

    if (filters.orderDateFrom || filters.orderDateTo) {
      queryBuilder.andWhere('order.orderDate BETWEEN :dateFrom AND :dateTo', {
        dateFrom: filters.orderDateFrom || new Date('1900-01-01'),
        dateTo: filters.orderDateTo || new Date(),
      });
    }

    // Add other filters as needed
  }
}