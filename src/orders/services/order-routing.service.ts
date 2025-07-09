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

      const appliedChanges: string[] = [];
      const affectedChannels: string[] = [];

      // Parse conflict ID to extract order ID and conflict type
      const [orderId, conflictType] = conflictId.split('_');
      
      if (!orderId || !conflictType) {
        throw new Error('Invalid conflict ID format');
      }

      const order = await this.ordersService.getOrderById(tenantId, orderId);
      
      // Handle different conflict types
      switch (conflictType) {
        case 'status':
          await this.resolveStatusConflict(
            tenantId,
            order,
            resolution,
            appliedChanges,
            affectedChannels,
          );
          break;

        case 'inventory':
          await this.resolveInventoryConflict(
            tenantId,
            order,
            resolution,
            appliedChanges,
            affectedChannels,
          );
          break;

        case 'fulfillment':
          await this.resolveFulfillmentConflict(
            tenantId,
            order,
            resolution,
            appliedChanges,
            affectedChannels,
          );
          break;

        default:
          throw new Error(`Unsupported conflict type: ${conflictType}`);
      }

      // Log resolution
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.CONFLICT,
        level: IntegrationLogLevel.INFO,
        message: `Conflict resolved: ${conflictId}`,
        metadata: {
          conflictId,
          resolution,
          appliedChanges,
          affectedChannels,
          userId: resolution.userId,
        },
      });

      // Emit conflict resolution event
      this.eventEmitter.emit('conflict.resolved', {
        tenantId,
        conflictId,
        orderId,
        conflictType,
        resolution,
        appliedChanges,
        affectedChannels,
      });

      return {
        success: true,
        appliedChanges,
        affectedChannels,
      };
    } catch (error) {
      this.logger.error(
        `Failed to resolve conflict: ${error.message}`,
        error.stack,
      );
      
      // Log error
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.CONFLICT,
        level: IntegrationLogLevel.ERROR,
        message: `Conflict resolution failed: ${conflictId}`,
        metadata: {
          conflictId,
          resolution,
          error: error.message,
        },
      });

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
    const conflicts: CrossChannelConflict[] = [];
    
    try {
      // Get all active channels for this tenant
      const activeChannels = await this.channelsService.getActiveChannels(tenantId);
      
      if (activeChannels.length <= 1) {
        return conflicts; // No conflicts possible with single channel
      }

      // Check inventory allocation conflicts across channels
      for (const item of order.items || []) {
        const channelAllocations = [];
        
        // Get inventory allocations for this product across all channels
        for (const channel of activeChannels) {
          const hasAllocation = await this.checkChannelInventoryAllocation(
            tenantId,
            order,
            channel.id,
          );
          
          if (hasAllocation) {
            channelAllocations.push({
              channelId: channel.id,
              channelName: channel.name,
              conflictingData: {
                productId: item.productId,
                sku: item.sku,
                allocatedQuantity: item.quantity,
                availableQuantity: 0, // Would be fetched from inventory service
              },
            });
          }
        }

        // If product is allocated to multiple channels, it's a potential conflict
        if (channelAllocations.length > 1) {
          conflicts.push({
            type: 'inventory',
            orderId: order.id,
            channels: channelAllocations,
            severity: 'high',
            autoResolvable: false,
            recommendedAction: 'Reallocate inventory based on channel priority',
            created: new Date(),
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error detecting inventory conflicts: ${error.message}`);
    }

    return conflicts;
  }

  private async detectStatusConflicts(
    tenantId: string,
    order: Order,
  ): Promise<CrossChannelConflict[]> {
    const conflicts: CrossChannelConflict[] = [];
    
    try {
      if (!order.channelId) {
        return conflicts; // No external channel to sync with
      }

      const channel = await this.channelsService.getChannelById(tenantId, order.channelId);
      const platformStatuses = [];
      
      // Get current status from each platform
      const localStatus = order.status;
      let externalStatus: string | undefined;
      let externalPlatform: string;

      switch (channel.platformId.toLowerCase()) {
        case 'shopee':
          try {
            const shopeeOrderId = order.channelMetadata?.shopee?.orderSn;
            if (shopeeOrderId) {
              const shopeeDetails = await this.shopeeOrderService.getShopeeOrderDetails(
                tenantId,
                channel.id,
                shopeeOrderId,
              );
              if (shopeeDetails.success && shopeeDetails.data) {
                externalStatus = shopeeDetails.data.order_status;
                externalPlatform = 'shopee';
              }
            }
          } catch (error) {
            this.logger.warn(`Failed to get Shopee order status: ${error.message}`);
          }
          break;

        case 'lazada':
          try {
            const lazadaOrderId = order.channelMetadata?.lazada?.orderId;
            if (lazadaOrderId) {
              // Would call lazada order details method
              // For now, use metadata if available
              externalStatus = order.channelMetadata?.lazada?.lastExternalStatus;
              externalPlatform = 'lazada';
            }
          } catch (error) {
            this.logger.warn(`Failed to get Lazada order status: ${error.message}`);
          }
          break;

        case 'tokopedia':
          try {
            const tokopediaOrderId = order.channelMetadata?.tokopedia?.orderId;
            if (tokopediaOrderId) {
              const tokopediaDetails = await this.tokopediaOrderService.getTokopediaOrderDetails(
                tenantId,
                channel.id,
                tokopediaOrderId,
              );
              if (tokopediaDetails.success && tokopediaDetails.data) {
                externalStatus = tokopediaDetails.data.order_status;
                externalPlatform = 'tokopedia';
              }
            }
          } catch (error) {
            this.logger.warn(`Failed to get Tokopedia order status: ${error.message}`);
          }
          break;
      }

      // Compare local vs external status
      if (externalStatus && localStatus) {
        const statusMapping = this.getStatusMapping(channel.platformId);
        const expectedLocalStatus = statusMapping[externalStatus];
        
        if (expectedLocalStatus && expectedLocalStatus !== localStatus) {
          // Check if this is a critical conflict
          const severity = this.assessStatusConflictSeverity(
            localStatus,
            expectedLocalStatus,
            externalStatus,
          );

          conflicts.push({
            type: 'status',
            orderId: order.id,
            channels: [
              {
                channelId: 'local',
                channelName: 'Local System',
                conflictingData: {
                  status: localStatus,
                  lastUpdated: order.updatedAt,
                },
              },
              {
                channelId: channel.id,
                channelName: channel.name,
                conflictingData: {
                  status: externalStatus,
                  expectedLocalStatus,
                  lastUpdated: order.channelMetadata?.[externalPlatform]?.lastSyncAt || new Date(),
                },
              },
            ],
            severity,
            autoResolvable: severity === 'low' || severity === 'medium',
            recommendedAction: this.getStatusConflictRecommendation(
              localStatus,
              expectedLocalStatus,
              externalStatus,
            ),
            created: new Date(),
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error detecting status conflicts: ${error.message}`);
    }

    return conflicts;
  }

  private async detectFulfillmentConflicts(
    tenantId: string,
    order: Order,
  ): Promise<CrossChannelConflict[]> {
    const conflicts: CrossChannelConflict[] = [];
    
    try {
      // Get fulfillment options for this order
      const fulfillmentOptions = await this.fulfillmentService.getFulfillmentOptions(
        tenantId,
        order.id,
      );

      if (fulfillmentOptions.options.length <= 1) {
        return conflicts; // No conflicts possible with single option
      }

      // Check for conflicting fulfillment assignments
      const activeAssignments = fulfillmentOptions.options.filter(
        option => option.availability.canFulfill && option.priority > 0
      );

      if (activeAssignments.length > 1) {
        // Check if multiple locations have similar priority (potential conflict)
        const topPriority = Math.min(...activeAssignments.map(opt => opt.priority));
        const tiedOptions = activeAssignments.filter(opt => opt.priority === topPriority);
        
        if (tiedOptions.length > 1) {
          conflicts.push({
            type: 'fulfillment',
            orderId: order.id,
            channels: tiedOptions.map(assignment => ({
              channelId: assignment.locationId,
              channelName: assignment.location?.locationName || assignment.locationId,
              conflictingData: {
                locationId: assignment.locationId,
                priority: assignment.priority,
                estimatedCost: assignment.cost.total,
                estimatedTime: assignment.timeframe.total,
              },
            })),
            severity: 'high',
            autoResolvable: true,
            recommendedAction: 'Choose location with lowest cost or fastest delivery',
            created: new Date(),
          });
        }
      }

      // Check for capacity conflicts (simplified - would need actual capacity data)
      for (const option of fulfillmentOptions.options) {
        if (!option.availability.canFulfill) {
          conflicts.push({
            type: 'fulfillment',
            orderId: order.id,
            channels: [{
              channelId: option.locationId,
              channelName: option.location?.locationName || option.locationId,
              conflictingData: {
                locationId: option.locationId,
                canFulfill: option.availability.canFulfill,
                reason: option.reason.join(', ') || 'Capacity unavailable',
                missingItems: option.availability.missingItems.length,
              },
            }],
            severity: 'medium',
            autoResolvable: true,
            recommendedAction: 'Reassign to location with available capacity',
            created: new Date(),
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error detecting fulfillment conflicts: ${error.message}`);
    }

    return conflicts;
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
      let error: string | undefined;

      // Sync based on platform using implemented syncOrderStatus methods
      switch (channel.platformId.toLowerCase()) {
        case 'shopee':
          try {
            const shopeeResult = await this.shopeeOrderService.syncOrderStatus(
              tenantId,
              channel.id,
              [order.id],
            );
            success = shopeeResult.success;
            syncedFields = ['status', 'metadata'];
            
            if (shopeeResult.conflictCount > 0) {
              error = `${shopeeResult.conflictCount} conflicts detected`;
            }
            if (shopeeResult.errorCount > 0) {
              error = shopeeResult.errors[0] || 'Sync errors occurred';
            }
          } catch (syncError) {
            success = false;
            error = syncError.message;
          }
          break;

        case 'lazada':
          try {
            const lazadaResult = await this.lazadaOrderService.syncOrderStatus(
              tenantId,
              channel.id,
              [order.id],
            );
            success = lazadaResult.success;
            syncedFields = ['status', 'metadata'];
            
            if (lazadaResult.conflictCount > 0) {
              error = `${lazadaResult.conflictCount} conflicts detected`;
            }
            if (lazadaResult.errorCount > 0) {
              error = lazadaResult.errors[0] || 'Sync errors occurred';
            }
          } catch (syncError) {
            success = false;
            error = syncError.message;
          }
          break;

        case 'tokopedia':
          try {
            const tokopediaResult = await this.tokopediaOrderService.syncOrderStatus(
              tenantId,
              channel.id,
              [order.id],
            );
            success = tokopediaResult.success;
            syncedFields = ['status', 'metadata'];
            
            if (tokopediaResult.conflictCount > 0) {
              error = `${tokopediaResult.conflictCount} conflicts detected`;
            }
            if (tokopediaResult.errorCount > 0) {
              error = tokopediaResult.errors[0] || 'Sync errors occurred';
            }
          } catch (syncError) {
            success = false;
            error = syncError.message;
          }
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
        error,
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

  // Helper methods for conflict detection and resolution

  private getStatusMapping(platformId: string): Record<string, OrderStatus> {
    switch (platformId.toLowerCase()) {
      case 'shopee':
        return {
          'UNPAID': OrderStatus.PENDING,
          'TO_SHIP': OrderStatus.CONFIRMED,
          'SHIPPED': OrderStatus.SHIPPED,
          'TO_CONFIRM_RECEIVE': OrderStatus.SHIPPED,
          'COMPLETED': OrderStatus.DELIVERED,
          'CANCELLED': OrderStatus.CANCELLED,
          'IN_CANCEL': OrderStatus.CANCELLED,
          'INVOICE_PENDING': OrderStatus.PENDING,
        };
      case 'lazada':
        return {
          'pending': OrderStatus.PENDING,
          'shipped': OrderStatus.SHIPPED,
          'delivered': OrderStatus.DELIVERED,
          'canceled': OrderStatus.CANCELLED,
          'returned': OrderStatus.RETURNED,
          'failed': OrderStatus.CANCELLED,
        };
      case 'tokopedia':
        return {
          'waiting_payment': OrderStatus.PENDING,
          'payment_verified': OrderStatus.CONFIRMED,
          'processing': OrderStatus.PROCESSING,
          'shipped': OrderStatus.SHIPPED,
          'delivered': OrderStatus.DELIVERED,
          'cancelled': OrderStatus.CANCELLED,
          'return_requested': OrderStatus.RETURNED,
          'returned': OrderStatus.RETURNED,
          'refunded': OrderStatus.REFUNDED,
        };
      default:
        return {};
    }
  }

  private assessStatusConflictSeverity(
    localStatus: OrderStatus,
    expectedLocalStatus: OrderStatus,
    externalStatus: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical conflicts - cannot resolve automatically
    const criticalConflicts = [
      [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.CANCELLED, OrderStatus.DELIVERED],
      [OrderStatus.REFUNDED, OrderStatus.DELIVERED],
    ];

    for (const [status1, status2] of criticalConflicts) {
      if ((localStatus === status1 && expectedLocalStatus === status2) ||
          (localStatus === status2 && expectedLocalStatus === status1)) {
        return 'critical';
      }
    }

    // High severity conflicts - require careful handling
    const highSeverityConflicts = [
      [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED, OrderStatus.PROCESSING],
    ];

    for (const [status1, status2] of highSeverityConflicts) {
      if ((localStatus === status1 && expectedLocalStatus === status2) ||
          (localStatus === status2 && expectedLocalStatus === status1)) {
        return 'high';
      }
    }

    // Medium severity - normal business flow conflicts
    const mediumSeverityConflicts = [
      [OrderStatus.PENDING, OrderStatus.PROCESSING],
      [OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
      [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
    ];

    for (const [status1, status2] of mediumSeverityConflicts) {
      if ((localStatus === status1 && expectedLocalStatus === status2) ||
          (localStatus === status2 && expectedLocalStatus === status1)) {
        return 'medium';
      }
    }

    // Low severity - minor timing differences
    return 'low';
  }

  private getStatusConflictRecommendation(
    localStatus: OrderStatus,
    expectedLocalStatus: OrderStatus,
    externalStatus: string,
  ): string {
    // Indonesian business logic for status conflict recommendations
    const recommendations = {
      // Customer-facing statuses should be prioritized
      [`${OrderStatus.DELIVERED}_${OrderStatus.SHIPPED}`]: 'Keep local DELIVERED status - customer has confirmed receipt',
      [`${OrderStatus.CANCELLED}_${OrderStatus.PROCESSING}`]: 'Keep local CANCELLED status - customer request priority',
      [`${OrderStatus.SHIPPED}_${OrderStatus.PROCESSING}`]: 'Sync external platform to SHIPPED status',
      [`${OrderStatus.PROCESSING}_${OrderStatus.PENDING}`]: 'Update local to PROCESSING - order is being prepared',
      [`${OrderStatus.CONFIRMED}_${OrderStatus.PENDING}`]: 'Update local to CONFIRMED - payment verified',
      
      // Critical conflicts
      [`${OrderStatus.DELIVERED}_${OrderStatus.CANCELLED}`]: 'ESCALATE - Cannot cancel delivered order',
      [`${OrderStatus.CANCELLED}_${OrderStatus.DELIVERED}`]: 'ESCALATE - Cannot deliver cancelled order',
      [`${OrderStatus.REFUNDED}_${OrderStatus.DELIVERED}`]: 'ESCALATE - Status mismatch requires manual review',
    };

    const key = `${localStatus}_${expectedLocalStatus}`;
    return recommendations[key] || 'Update to most recent status based on timestamp';
  }

  // Specific conflict resolution methods

  private async resolveStatusConflict(
    tenantId: string,
    order: Order,
    resolution: any,
    appliedChanges: string[],
    affectedChannels: string[],
  ): Promise<void> {
    const channel = await this.channelsService.getChannelById(tenantId, order.channelId);
    
    switch (resolution.action) {
      case 'use_source':
        // Keep local status, update external platform
        await this.synchronizeOrderStatus(tenantId, order.id, true);
        appliedChanges.push('Updated external platform to match local status');
        affectedChannels.push(channel.id);
        break;

      case 'use_target':
        // Use external platform status, update local
        if (resolution.data?.targetStatus) {
          await this.ordersService.updateOrder(tenantId, order.id, {
            status: resolution.data.targetStatus,
            notes: `Status updated via conflict resolution: ${resolution.reason || 'Auto-resolved'}`,
          });
          appliedChanges.push('Updated local status to match external platform');
          affectedChannels.push('local');
        }
        break;

      case 'manual_override':
        // Use manually specified status
        if (resolution.data?.overrideStatus) {
          await this.ordersService.updateOrder(tenantId, order.id, {
            status: resolution.data.overrideStatus,
            notes: `Status manually overridden: ${resolution.reason || 'Manual resolution'}`,
          });
          
          // Also update external platform
          await this.synchronizeOrderStatus(tenantId, order.id, true);
          
          appliedChanges.push('Applied manual status override');
          affectedChannels.push('local', channel.id);
        }
        break;

      default:
        throw new Error(`Invalid resolution action for status conflict: ${resolution.action}`);
    }
  }

  private async resolveInventoryConflict(
    tenantId: string,
    order: Order,
    resolution: any,
    appliedChanges: string[],
    affectedChannels: string[],
  ): Promise<void> {
    switch (resolution.action) {
      case 'use_source':
        // Prioritize source channel inventory allocation
        // Implementation would reallocate inventory from other channels
        appliedChanges.push('Reallocated inventory to source channel');
        affectedChannels.push(order.channelId);
        break;

      case 'split_fulfillment':
        // Split fulfillment across multiple channels
        if (resolution.data?.splitRules) {
          for (const rule of resolution.data.splitRules) {
            // Implementation would split order items across channels
            appliedChanges.push(`Split fulfillment: ${rule.quantity} units to ${rule.channelId}`);
            affectedChannels.push(rule.channelId);
          }
        }
        break;

      case 'manual_override':
        // Manual inventory reallocation
        if (resolution.data?.allocations) {
          for (const allocation of resolution.data.allocations) {
            // Implementation would update inventory allocations
            appliedChanges.push(`Allocated ${allocation.quantity} units to ${allocation.channelId}`);
            affectedChannels.push(allocation.channelId);
          }
        }
        break;

      default:
        throw new Error(`Invalid resolution action for inventory conflict: ${resolution.action}`);
    }
  }

  private async resolveFulfillmentConflict(
    tenantId: string,
    order: Order,
    resolution: any,
    appliedChanges: string[],
    affectedChannels: string[],
  ): Promise<void> {
    switch (resolution.action) {
      case 'use_source':
        // Use primary fulfillment location
        if (resolution.data?.primaryLocationId) {
          await this.fulfillmentService.assignOrderFulfillment(
            tenantId,
            order.id,
            resolution.data.primaryLocationId,
          );
          appliedChanges.push('Assigned to primary fulfillment location');
          affectedChannels.push(resolution.data.primaryLocationId);
        }
        break;

      case 'split_fulfillment':
        // Split fulfillment across multiple locations
        if (resolution.data?.locationSplits) {
          for (const split of resolution.data.locationSplits) {
            await this.fulfillmentService.assignOrderFulfillment(
              tenantId,
              order.id,
              split.locationId,
            );
            appliedChanges.push(`Split fulfillment to ${split.locationId}`);
            affectedChannels.push(split.locationId);
          }
        }
        break;

      case 'manual_override':
        // Manual fulfillment assignment
        if (resolution.data?.assignedLocationId) {
          await this.fulfillmentService.assignOrderFulfillment(
            tenantId,
            order.id,
            resolution.data.assignedLocationId,
          );
          appliedChanges.push('Manual fulfillment assignment applied');
          affectedChannels.push(resolution.data.assignedLocationId);
        }
        break;

      default:
        throw new Error(`Invalid resolution action for fulfillment conflict: ${resolution.action}`);
    }
  }
}
