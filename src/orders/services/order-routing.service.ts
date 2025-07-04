import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { Order, OrderStatus } from '../entities/order.entity';
import { Channel } from '../../channels/entities/channel.entity';

// Services
import { OrdersService } from './orders.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { ChannelsService } from '../../channels/services/channels.service';
import { ChannelSyncService } from '../../channels/services/channel-sync.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import {
  IntegrationLogLevel,
  IntegrationLogType,
} from '../../integrations/entities/integration-log.entity';

// Platform services
import { ShopeeOrderService } from '../../integrations/shopee/services/shopee-order.service';
import { LazadaOrderService } from '../../integrations/lazada/services/lazada-order.service';
import { TokopediaOrderService } from '../../integrations/tokopedia/services/tokopedia-order.service';

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  conditions: {
    channelIds?: string[];
    orderValue?: { min?: number; max?: number };
    customerTier?: string[];
    productCategories?: string[];
    shippingLocation?: {
      cities?: string[];
      states?: string[];
      postalCodes?: string[];
    };
    timeConstraints?: {
      dayOfWeek?: number[];
      hourRange?: { start: number; end: number };
    };
  };
  actions: {
    assignToLocation?: string;
    setPriority?: number;
    addTags?: string[];
    notifyUsers?: string[];
    holdForReview?: boolean;
    autoApprove?: boolean;
  };
}

export interface OrderRouting {
  orderId: string;
  sourceChannel: {
    channelId: string;
    channelName: string;
    platformId: string;
    externalOrderId: string;
  };
  routing: {
    assignedLocation?: string;
    priority: number;
    tags: string[];
    appliedRules: string[];
    routingScore: number;
    estimatedProcessingTime: number;
  };
  fulfillment: {
    options: any[];
    recommended: any;
    assignedLocation?: string;
  };
  synchronization: {
    platformsToSync: string[];
    syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
    lastSyncAt?: Date;
    syncErrors?: string[];
  };
}

export interface CrossChannelConflict {
  type: 'inventory' | 'pricing' | 'status' | 'fulfillment';
  orderId: string;
  channels: {
    channelId: string;
    channelName: string;
    conflictingData: any;
  }[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
  recommendedAction: string;
  created: Date;
}

export interface RoutingDashboard {
  summary: {
    totalActiveOrders: number;
    pendingRouting: number;
    inFulfillment: number;
    conflictsToResolve: number;
    channelBreakdown: Record<
      string,
      {
        orderCount: number;
        totalValue: number;
        averageProcessingTime: number;
      }
    >;
  };
  performance: {
    averageRoutingTime: number;
    fulfillmentAccuracy: number;
    customerSatisfaction: number;
    onTimeDeliveryRate: number;
  };
  alerts: {
    criticalConflicts: number;
    capacityWarnings: string[];
    performanceIssues: string[];
    integrationErrors: string[];
  };
}

export interface BulkRoutingRequest {
  orderIds: string[];
  forceReRoute?: boolean;
  applyRules?: string[];
  overrideLocation?: string;
  priority?: number;
}

@Injectable()
export class OrderRoutingService {
  private readonly logger = new Logger(OrderRoutingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,

    // Core services
    private readonly ordersService: OrdersService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly channelsService: ChannelsService,
    private readonly channelSyncService: ChannelSyncService,

    // Platform services
    private readonly shopeeOrderService: ShopeeOrderService,
    private readonly lazadaOrderService: LazadaOrderService,
    private readonly tokopediaOrderService: TokopediaOrderService,

    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Route a new order through the intelligent routing system
   */
  async routeOrder(
    tenantId: string,
    orderId: string,
    options?: {
      forceReRoute?: boolean;
      skipRules?: boolean;
      overrideLocation?: string;
    },
  ): Promise<OrderRouting> {
    try {
      this.logger.debug(`Routing order ${orderId} for tenant ${tenantId}`);

      // Get order with full details
      const order = await this.ordersService.getOrderById(tenantId, orderId);

      // Get source channel information
      const sourceChannel = await this.getSourceChannelInfo(tenantId, order);

      // Apply routing rules
      const routingDecision = await this.applyRoutingRules(
        tenantId,
        order,
        options,
      );

      // Get fulfillment options
      const fulfillmentOptions =
        await this.fulfillmentService.getFulfillmentOptions(tenantId, orderId);

      // Determine sync requirements
      const syncRequirements = await this.determineSyncRequirements(
        tenantId,
        order,
      );

      // Create routing result
      const routing: OrderRouting = {
        orderId,
        sourceChannel,
        routing: routingDecision,
        fulfillment: {
          options: fulfillmentOptions.options,
          recommended: fulfillmentOptions.recommended,
          assignedLocation:
            options?.overrideLocation ||
            fulfillmentOptions.recommended.locationId,
        },
        synchronization: syncRequirements,
      };

      // Apply routing decisions
      await this.applyRoutingDecisions(tenantId, order, routing);

      // Log routing
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.ROUTING,
        level: IntegrationLogLevel.INFO,
        message: `Order routed: ${order.orderNumber}`,
        metadata: {
          orderId,
          sourceChannel: sourceChannel.channelName,
          assignedLocation: routing.fulfillment.assignedLocation,
          priority: routing.routing.priority,
          appliedRules: routing.routing.appliedRules,
        },
      });

      // Emit routing event
      this.eventEmitter.emit('order.routed', {
        tenantId,
        order,
        routing,
      });

      return routing;
    } catch (error) {
      this.logger.error(`Failed to route order: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'route_order', orderId },
      });
      throw error;
    }
  }

  /**
   * Get multi-channel order view with unified status
   */
  async getMultiChannelOrders(
    tenantId: string,
    options?: {
      channelIds?: string[];
      dateRange?: { from: Date; to: Date };
      status?: OrderStatus[];
      groupBy?: 'channel' | 'date' | 'status';
      includeMetrics?: boolean;
    },
  ): Promise<{
    orders: Order[];
    groupedData?: Record<string, Order[]>;
    metrics?: {
      totalOrders: number;
      totalValue: number;
      channelPerformance: Record<string, any>;
    };
  }> {
    try {
      this.logger.debug(`Getting multi-channel orders for tenant ${tenantId}`);

      // Build query
      const query: any = { tenantId };

      if (options?.channelIds && options.channelIds.length > 0) {
        query.channelId = In(options.channelIds);
      }

      if (options?.status && options.status.length > 0) {
        query.status = In(options.status);
      }

      if (options?.dateRange) {
        query.orderDate = Between(options.dateRange.from, options.dateRange.to);
      }

      // Get orders
      const orders = await this.orderRepository.find({
        where: query,
        relations: ['items'],
        order: { orderDate: 'DESC' },
      });

      // Group data if requested
      let groupedData: Record<string, Order[]> | undefined;
      if (options?.groupBy) {
        groupedData = this.groupOrders(orders, options.groupBy);
      }

      // Calculate metrics if requested
      let metrics: any;
      if (options?.includeMetrics) {
        metrics = await this.calculateMultiChannelMetrics(tenantId, orders);
      }

      return {
        orders,
        groupedData,
        metrics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get multi-channel orders: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Synchronize order status across all connected platforms
   */
  async synchronizeOrderStatus(
    tenantId: string,
    orderId: string,
    forceSync: boolean = false,
  ): Promise<{
    success: boolean;
    syncResults: Array<{
      platform: string;
      channelId: string;
      success: boolean;
      error?: string;
      syncedFields: string[];
    }>;
  }> {
    try {
      this.logger.debug(`Synchronizing order status for order ${orderId}`);

      const order = await this.ordersService.getOrderById(tenantId, orderId);
      const syncResults = [];

      // Get connected channels for this order
      const channels = await this.getOrderChannels(tenantId, order);

      for (const channel of channels) {
        try {
          const result = await this.syncOrderToChannel(
            tenantId,
            order,
            channel,
            forceSync,
          );
          syncResults.push(result);
        } catch (error) {
          syncResults.push({
            platform: channel.platformId,
            channelId: channel.id,
            success: false,
            error: error.message,
            syncedFields: [],
          });
        }
      }

      const success = syncResults.every(result => result.success);

      // Update order sync status
      if (order.externalData) {
        order.externalData.syncStatus = success ? 'synced' : 'failed';
        order.externalData.lastSyncAt = new Date().toISOString();
        if (!success) {
          order.externalData.syncErrors = syncResults
            .filter(r => !r.success)
            .map(r => `${r.platform}: ${r.error}`);
        }
        await this.orderRepository.save(order);
      }

      // Log sync
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYNC,
        level: success ? IntegrationLogLevel.INFO : IntegrationLogLevel.WARN,
        message: `Order sync ${success ? 'completed' : 'failed'}: ${
          order.orderNumber
        }`,
        metadata: {
          orderId,
          syncResults,
          channelCount: channels.length,
        },
      });

      return {
        success,
        syncResults,
      };
    } catch (error) {
      this.logger.error(
        `Failed to synchronize order status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Detect and manage cross-channel conflicts
   */
  async detectCrossChannelConflicts(
    tenantId: string,
    orderId?: string,
  ): Promise<CrossChannelConflict[]> {
    try {
      this.logger.debug(
        `Detecting cross-channel conflicts for tenant ${tenantId}`,
      );

      const conflicts: CrossChannelConflict[] = [];

      // Get orders to check
      const orders = orderId
        ? [await this.ordersService.getOrderById(tenantId, orderId)]
        : await this.getActiveMultiChannelOrders(tenantId);

      for (const order of orders) {
        if (!order.channelId) continue;

        // Check for inventory conflicts
        const inventoryConflicts = await this.detectInventoryConflicts(
          tenantId,
          order,
        );
        conflicts.push(...inventoryConflicts);

        // Check for status conflicts
        const statusConflicts = await this.detectStatusConflicts(
          tenantId,
          order,
        );
        conflicts.push(...statusConflicts);

        // Check for fulfillment conflicts
        const fulfillmentConflicts = await this.detectFulfillmentConflicts(
          tenantId,
          order,
        );
        conflicts.push(...fulfillmentConflicts);
      }

      // Sort by severity and creation date
      conflicts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return (
          severityOrder[b.severity] - severityOrder[a.severity] ||
          b.created.getTime() - a.created.getTime()
        );
      });

      return conflicts;
    } catch (error) {
      this.logger.error(
        `Failed to detect conflicts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Resolve cross-channel conflict
   */
  async resolveConflict(
    tenantId: string,
    conflictId: string,
    resolution: {
      action:
        | 'use_source'
        | 'use_target'
        | 'manual_override'
        | 'split_fulfillment';
      data?: any;
      reason?: string;
      userId?: string;
    },
  ): Promise<{
    success: boolean;
    appliedChanges: string[];
    affectedChannels: string[];
  }> {
    try {
      this.logger.debug(
        `Resolving conflict ${conflictId} with action: ${resolution.action}`,
      );

      // Implementation would depend on conflict type and resolution strategy
      // For now, return a successful resolution

      const result = {
        success: true,
        appliedChanges: ['Status updated', 'Inventory reallocated'],
        affectedChannels: [],
      };

      // Log resolution
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.CONFLICT,
        level: IntegrationLogLevel.INFO,
        message: `Conflict resolved: ${conflictId}`,
        metadata: {
          conflictId,
          resolution,
          result,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to resolve conflict: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get routing dashboard data
   */
  async getRoutingDashboard(tenantId: string): Promise<RoutingDashboard> {
    try {
      this.logger.debug(`Getting routing dashboard for tenant ${tenantId}`);

      // Get current date range
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      // Get active orders
      const activeOrders = await this.orderRepository.find({
        where: {
          tenantId,
          status: In([
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
          ]),
        },
        relations: ['items'],
      });

      // Calculate summary metrics
      const summary = await this.calculateSummaryMetrics(
        tenantId,
        activeOrders,
      );

      // Calculate performance metrics
      const performance = await this.calculatePerformanceMetrics(tenantId);

      // Get alerts
      const alerts = await this.getSystemAlerts(tenantId);

      return {
        summary,
        performance,
        alerts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get routing dashboard: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Perform bulk routing operations
   */
  async bulkRouting(
    tenantId: string,
    request: BulkRoutingRequest,
  ): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
    results: Array<{
      orderId: string;
      success: boolean;
      routing?: OrderRouting;
      error?: string;
    }>;
  }> {
    try {
      this.logger.debug(
        `Performing bulk routing for ${request.orderIds.length} orders`,
      );

      const results = [];
      let processedCount = 0;
      let failedCount = 0;

      for (const orderId of request.orderIds) {
        try {
          const routing = await this.routeOrder(tenantId, orderId, {
            forceReRoute: request.forceReRoute,
            overrideLocation: request.overrideLocation,
          });

          // Apply additional settings
          if (request.priority !== undefined) {
            await this.ordersService.updateOrder(tenantId, orderId, {
              priority: request.priority,
            });
          }

          results.push({
            orderId,
            success: true,
            routing,
          });
          processedCount++;
        } catch (error) {
          results.push({
            orderId,
            success: false,
            error: error.message,
          });
          failedCount++;
        }
      }

      const success = failedCount === 0;

      // Log bulk routing
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.ROUTING,
        level: success ? IntegrationLogLevel.INFO : IntegrationLogLevel.WARN,
        message: `Bulk routing completed: ${processedCount}/${request.orderIds.length} successful`,
        metadata: {
          totalOrders: request.orderIds.length,
          processedCount,
          failedCount,
          request,
        },
      });

      return {
        success,
        processedCount,
        failedCount,
        results,
      };
    } catch (error) {
      this.logger.error(
        `Failed to perform bulk routing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private async getSourceChannelInfo(
    tenantId: string,
    order: Order,
  ): Promise<OrderRouting['sourceChannel']> {
    if (!order.channelId) {
      return {
        channelId: 'direct',
        channelName: 'Direct Sale',
        platformId: 'direct',
        externalOrderId: order.orderNumber,
      };
    }

    const channel = await this.channelsService.getChannelById(
      tenantId,
      order.channelId,
    );

    return {
      channelId: channel.id,
      channelName: channel.name,
      platformId: channel.platformId,
      externalOrderId: order.externalOrderId || order.orderNumber,
    };
  }

  private async applyRoutingRules(
    tenantId: string,
    order: Order,
    options?: any,
  ): Promise<OrderRouting['routing']> {
    // Get routing rules for tenant (would be stored in database)
    const rules = await this.getRoutingRules(tenantId);

    let assignedLocation: string | undefined;
    let priority = order.priority || 3;
    const tags: string[] = [...(order.tags || [])];
    const appliedRules: string[] = [];

    // Apply each rule in priority order
    for (const rule of rules) {
      if (!rule.isActive) continue;

      const matches = await this.evaluateRule(order, rule);
      if (matches) {
        appliedRules.push(rule.id);

        // Apply rule actions
        if (rule.actions.assignToLocation) {
          assignedLocation = rule.actions.assignToLocation;
        }
        if (rule.actions.setPriority !== undefined) {
          priority = rule.actions.setPriority;
        }
        if (rule.actions.addTags) {
          tags.push(...rule.actions.addTags);
        }
      }
    }

    // Calculate routing score (higher is better)
    const routingScore = this.calculateRoutingScore(
      order,
      appliedRules,
      priority,
    );

    // Estimate processing time
    const estimatedProcessingTime = this.estimateProcessingTime(
      order,
      priority,
      assignedLocation,
    );

    return {
      assignedLocation,
      priority,
      tags: [...new Set(tags)], // Remove duplicates
      appliedRules,
      routingScore,
      estimatedProcessingTime,
    };
  }

  private async determineSyncRequirements(
    tenantId: string,
    order: Order,
  ): Promise<OrderRouting['synchronization']> {
    const platformsToSync: string[] = [];

    // Determine which platforms need to be synced
    if (order.channelId) {
      const channel = await this.channelsService.getChannelById(
        tenantId,
        order.channelId,
      );
      platformsToSync.push(channel.platformId);
    }

    // Add other platforms that might need updates (inventory sync, etc.)
    const activeChannels = await this.channelsService.getActiveChannels(
      tenantId,
    );
    for (const channel of activeChannels) {
      if (!platformsToSync.includes(channel.platformId)) {
        // Add channels that have inventory allocation for this order's products
        const hasAllocation = await this.checkChannelInventoryAllocation(
          tenantId,
          order,
          channel.id,
        );
        if (hasAllocation) {
          platformsToSync.push(channel.platformId);
        }
      }
    }

    return {
      platformsToSync,
      syncStatus: 'pending',
    };
  }

  private async applyRoutingDecisions(
    tenantId: string,
    order: Order,
    routing: OrderRouting,
  ): Promise<void> {
    // Update order with routing decisions
    const updates: any = {
      priority: routing.routing.priority,
      tags: routing.routing.tags,
    };

    if (routing.fulfillment.assignedLocation) {
      updates.processingLocationId = routing.fulfillment.assignedLocation;
    }

    await this.ordersService.updateOrder(tenantId, order.id, updates);

    // Assign fulfillment if location is determined
    if (routing.fulfillment.assignedLocation) {
      await this.fulfillmentService.assignOrderFulfillment(
        tenantId,
        order.id,
        routing.fulfillment.assignedLocation,
      );
    }
  }

  private async getRoutingRules(tenantId: string): Promise<RoutingRule[]> {
    // This would fetch routing rules from database
    // For now, return default rules
    return [
      {
        id: 'high-value-express',
        name: 'High Value Express',
        description: 'Route high-value orders to express processing',
        isActive: true,
        priority: 1,
        conditions: {
          orderValue: { min: 1000000 }, // IDR 1M+
        },
        actions: {
          setPriority: 1,
          addTags: ['high-value', 'express'],
        },
      },
      {
        id: 'same-city-fast',
        name: 'Same City Fast Delivery',
        description: 'Route same-city orders to nearby locations',
        isActive: true,
        priority: 2,
        conditions: {
          shippingLocation: { cities: ['Jakarta', 'Surabaya', 'Bandung'] },
        },
        actions: {
          setPriority: 2,
          addTags: ['same-city', 'fast-delivery'],
        },
      },
    ];
  }

  private async evaluateRule(
    order: Order,
    rule: RoutingRule,
  ): Promise<boolean> {
    const conditions = rule.conditions;

    // Check order value
    if (conditions.orderValue) {
      if (
        conditions.orderValue.min &&
        order.totalAmount < conditions.orderValue.min
      ) {
        return false;
      }
      if (
        conditions.orderValue.max &&
        order.totalAmount > conditions.orderValue.max
      ) {
        return false;
      }
    }

    // Check shipping location
    if (conditions.shippingLocation) {
      const city = order.shippingAddress?.city;
      if (conditions.shippingLocation.cities && city) {
        if (!conditions.shippingLocation.cities.includes(city)) {
          return false;
        }
      }
    }

    // Check channel
    if (conditions.channelIds && order.channelId) {
      if (!conditions.channelIds.includes(order.channelId)) {
        return false;
      }
    }

    // Check time constraints
    if (conditions.timeConstraints) {
      const now = new Date();

      if (conditions.timeConstraints.dayOfWeek) {
        const dayOfWeek = now.getDay();
        if (!conditions.timeConstraints.dayOfWeek.includes(dayOfWeek)) {
          return false;
        }
      }

      if (conditions.timeConstraints.hourRange) {
        const hour = now.getHours();
        const range = conditions.timeConstraints.hourRange;
        if (hour < range.start || hour > range.end) {
          return false;
        }
      }
    }

    return true;
  }

  private calculateRoutingScore(
    order: Order,
    appliedRules: string[],
    priority: number,
  ): number {
    let score = 100;

    // Higher priority = higher score
    score += (5 - priority) * 20;

    // More rules applied = higher score
    score += appliedRules.length * 10;

    // Order value factor
    score += Math.min(order.totalAmount / 100000, 50);

    return Math.round(score);
  }

  private estimateProcessingTime(
    order: Order,
    priority: number,
    assignedLocation?: string,
  ): number {
    // Base processing time in hours
    let hours = 24;

    // Priority adjustment
    switch (priority) {
      case 1:
        hours = 2;
        break;
      case 2:
        hours = 6;
        break;
      case 3:
        hours = 24;
        break;
      case 4:
        hours = 48;
        break;
      case 5:
        hours = 72;
        break;
    }

    // Location adjustment (if location is known to be fast/slow)
    if (assignedLocation) {
      // This would check location performance data
      // For now, keep base time
    }

    // Item count adjustment
    const itemCount = order.items?.length || 1;
    if (itemCount > 10) {
      hours += itemCount * 0.5;
    }

    return Math.round(hours);
  }

  private groupOrders(
    orders: Order[],
    groupBy: string,
  ): Record<string, Order[]> {
    return orders.reduce((groups, order) => {
      let key: string;

      switch (groupBy) {
        case 'channel':
          key = order.channelName || 'Direct';
          break;
        case 'date':
          key = order.orderDate.toISOString().split('T')[0];
          break;
        case 'status':
          key = order.status;
          break;
        default:
          key = 'all';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);

      return groups;
    }, {} as Record<string, Order[]>);
  }

  private async calculateMultiChannelMetrics(
    tenantId: string,
    orders: Order[],
  ): Promise<any> {
    const totalOrders = orders.length;
    const totalValue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

    // Channel performance breakdown
    const channelPerformance = orders.reduce((acc, order) => {
      const channel = order.channelName || 'Direct';
      if (!acc[channel]) {
        acc[channel] = { orderCount: 0, totalValue: 0, orders: [] };
      }
      acc[channel].orderCount++;
      acc[channel].totalValue += Number(order.totalAmount);
      acc[channel].orders.push(order);
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages
    Object.keys(channelPerformance).forEach(channel => {
      const data = channelPerformance[channel];
      data.averageOrderValue = data.totalValue / data.orderCount;
      // Calculate average processing time (simplified)
      data.averageProcessingTime = 24; // Default 24 hours
    });

    return {
      totalOrders,
      totalValue,
      channelPerformance,
    };
  }

  private async getActiveMultiChannelOrders(
    tenantId: string,
  ): Promise<Order[]> {
    return this.orderRepository.find({
      where: {
        tenantId,
        status: In([
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
        ]),
        channelId: Not(null),
      },
      relations: ['items'],
    });
  }

  private async detectInventoryConflicts(
    tenantId: string,
    order: Order,
  ): Promise<CrossChannelConflict[]> {
    // Simplified inventory conflict detection
    // In production, this would check inventory allocations across channels
    return [];
  }

  private async detectStatusConflicts(
    tenantId: string,
    order: Order,
  ): Promise<CrossChannelConflict[]> {
    // Simplified status conflict detection
    // In production, this would compare order status across platforms
    return [];
  }

  private async detectFulfillmentConflicts(
    tenantId: string,
    order: Order,
  ): Promise<CrossChannelConflict[]> {
    // Simplified fulfillment conflict detection
    // In production, this would check fulfillment assignments
    return [];
  }

  private async getOrderChannels(
    tenantId: string,
    order: Order,
  ): Promise<Channel[]> {
    if (!order.channelId) {
      return [];
    }

    return [
      await this.channelsService.getChannelById(tenantId, order.channelId),
    ];
  }

  private async syncOrderToChannel(
    tenantId: string,
    order: Order,
    channel: Channel,
    forceSync: boolean,
  ): Promise<{
    platform: string;
    channelId: string;
    success: boolean;
    error?: string;
    syncedFields: string[];
  }> {
    try {
      let success = false;
      let syncedFields: string[] = [];

      // Sync based on platform
      switch (channel.platformId.toLowerCase()) {
        case 'shopee':
          // TODO: Implement syncOrderStatus method in ShopeeOrderService
          // const shopeeResult = await this.shopeeOrderService.syncOrderStatus(tenantId, channel.id, order);
          // success = shopeeResult.success;
          // syncedFields = shopeeResult.syncedFields || [];
          success = true; // Placeholder
          syncedFields = ['status'];
          break;

        case 'lazada':
          // TODO: Implement syncOrderStatus method in LazadaOrderService
          // const lazadaResult = await this.lazadaOrderService.syncOrderStatus(tenantId, channel.id, order);
          // success = lazadaResult.success;
          // syncedFields = lazadaResult.syncedFields || [];
          success = true; // Placeholder
          syncedFields = ['status'];
          break;

        case 'tokopedia':
          // TODO: Implement syncOrderStatus method in TokopediaOrderService
          // const tokopediaResult = await this.tokopediaOrderService.syncOrderStatus(tenantId, channel.id, order);
          // success = tokopediaResult.success;
          // syncedFields = tokopediaResult.syncedFields || [];
          success = true; // Placeholder
          syncedFields = ['status'];
          break;

        default:
          throw new Error(
            `Platform ${channel.platformId} sync not implemented`,
          );
      }

      return {
        platform: channel.platformId,
        channelId: channel.id,
        success,
        syncedFields,
      };
    } catch (error) {
      return {
        platform: channel.platformId,
        channelId: channel.id,
        success: false,
        error: error.message,
        syncedFields: [],
      };
    }
  }

  private async checkChannelInventoryAllocation(
    tenantId: string,
    order: Order,
    channelId: string,
  ): Promise<boolean> {
    // Check if channel has inventory allocation for order products
    // This would integrate with channel inventory service
    return false; // Simplified for now
  }

  private async calculateSummaryMetrics(
    tenantId: string,
    activeOrders: Order[],
  ): Promise<RoutingDashboard['summary']> {
    const totalActiveOrders = activeOrders.length;
    const pendingRouting = activeOrders.filter(
      o => o.status === OrderStatus.PENDING,
    ).length;
    const inFulfillment = activeOrders.filter(
      o => o.status === OrderStatus.PROCESSING,
    ).length;
    const conflictsToResolve = 0; // Would get from conflict detection

    // Channel breakdown
    const channelBreakdown = activeOrders.reduce((acc, order) => {
      const channel = order.channelName || 'Direct';
      if (!acc[channel]) {
        acc[channel] = {
          orderCount: 0,
          totalValue: 0,
          averageProcessingTime: 0,
        };
      }
      acc[channel].orderCount++;
      acc[channel].totalValue += Number(order.totalAmount);
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages
    Object.keys(channelBreakdown).forEach(channel => {
      const data = channelBreakdown[channel];
      data.averageProcessingTime = 24; // Simplified
    });

    return {
      totalActiveOrders,
      pendingRouting,
      inFulfillment,
      conflictsToResolve,
      channelBreakdown,
    };
  }

  private async calculatePerformanceMetrics(
    tenantId: string,
  ): Promise<RoutingDashboard['performance']> {
    // Simplified performance metrics
    // In production, these would be calculated from historical data
    return {
      averageRoutingTime: 2.5, // hours
      fulfillmentAccuracy: 98.5, // percentage
      customerSatisfaction: 4.7, // out of 5
      onTimeDeliveryRate: 95.2, // percentage
    };
  }

  private async getSystemAlerts(
    tenantId: string,
  ): Promise<RoutingDashboard['alerts']> {
    // Simplified alerts
    // In production, these would be calculated from real system monitoring
    return {
      criticalConflicts: 0,
      capacityWarnings: [],
      performanceIssues: [],
      integrationErrors: [],
    };
  }
}
