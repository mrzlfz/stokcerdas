import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { Order, FulfillmentStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';

// Services
import { ChannelInventoryService } from '../../channels/services/channel-inventory.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';

// Interfaces
export interface FulfillmentLocation {
  locationId: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  capacity: {
    maxOrders: number;
    currentOrders: number;
    utilizationRate: number;
  };
  capabilities: {
    sameDay: boolean;
    nextDay: boolean;
    packaging: string[];
    specialHandling: string[];
  };
}

export interface FulfillmentOption {
  locationId: string;
  location: FulfillmentLocation;
  cost: {
    shipping: number;
    handling: number;
    total: number;
  };
  timeframe: {
    processing: number; // hours
    shipping: number; // hours
    total: number; // hours
    estimated: Date;
  };
  availability: {
    canFulfill: boolean;
    partialFulfill: boolean;
    availableItems: number;
    missingItems: Array<{
      productId: string;
      requested: number;
      available: number;
      shortfall: number;
    }>;
  };
  priority: number; // 1 = highest priority
  reason: string[];
}

export interface FulfillmentOptimization {
  orderId: string;
  options: FulfillmentOption[];
  recommended: FulfillmentOption;
  multiLocation?: {
    canSplit: boolean;
    splitOptions: Array<{
      locations: string[];
      items: Record<string, string>; // itemId -> locationId
      totalCost: number;
      totalTime: number;
    }>;
  };
  constraints: {
    maxCost?: number;
    maxTime?: number;
    preferredLocations?: string[];
    customerPreferences?: any;
  };
}

export interface BatchFulfillmentRequest {
  orderIds: string[];
  constraints?: {
    maxProcessingTime?: number;
    preferredLocations?: string[];
    costLimit?: number;
    consolidateShipments?: boolean;
  };
  optimization?: 'cost' | 'speed' | 'balanced';
}

export interface BatchFulfillmentResult {
  success: boolean;
  assignments: Array<{
    orderId: string;
    locationId: string;
    cost: number;
    estimatedTime: number;
    items: string[];
  }>;
  summary: {
    totalOrders: number;
    totalCost: number;
    averageTime: number;
    locationUtilization: Record<string, number>;
  };
  warnings: string[];
  errors: string[];
}

export interface LocationCapacity {
  locationId: string;
  maxDailyOrders: number;
  currentDailyOrders: number;
  maxConcurrentOrders: number;
  currentConcurrentOrders: number;
  staffCount: number;
  shiftSchedule: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
    night: boolean;
  };
  specialCapabilities: {
    coldStorage: boolean;
    fragileHandling: boolean;
    bulkOrders: boolean;
    expressProcessing: boolean;
  };
}

@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    
    // Channel services
    private readonly channelInventoryService: ChannelInventoryService,
    
    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get fulfillment options for an order
   */
  async getFulfillmentOptions(tenantId: string, orderId: string): Promise<FulfillmentOptimization> {
    try {
      this.logger.debug(`Getting fulfillment options for order ${orderId}`);

      // Get order with items
      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
        relations: ['items'],
      });

      if (!order) {
        throw new BadRequestException(`Order ${orderId} not found`);
      }

      // Get available locations
      const locations = await this.getAvailableLocations(tenantId);

      // Evaluate each location
      const options: FulfillmentOption[] = [];

      for (const location of locations) {
        const option = await this.evaluateLocationForOrder(tenantId, order, location);
        if (option) {
          options.push(option);
        }
      }

      // Sort by priority (lower number = higher priority)
      options.sort((a, b) => a.priority - b.priority);

      // Get recommended option
      const recommended = this.selectRecommendedOption(options, order);

      // Check for multi-location fulfillment
      const multiLocation = await this.evaluateMultiLocationFulfillment(tenantId, order, locations);

      return {
        orderId,
        options,
        recommended,
        multiLocation,
        constraints: this.getOrderConstraints(order),
      };

    } catch (error) {
      this.logger.error(`Failed to get fulfillment options: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign order to optimal fulfillment location
   */
  async assignOrderFulfillment(
    tenantId: string,
    orderId: string,
    locationId?: string,
    force: boolean = false,
  ): Promise<{
    success: boolean;
    assignment: {
      orderId: string;
      locationId: string;
      estimatedCost: number;
      estimatedTime: number;
      processingStartTime: Date;
    };
  }> {
    try {
      this.logger.debug(`Assigning fulfillment for order ${orderId} to location ${locationId}`);

      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
        relations: ['items'],
      });

      if (!order) {
        throw new BadRequestException(`Order ${orderId} not found`);
      }

      let targetLocationId = locationId;

      // Auto-select location if not provided
      if (!targetLocationId) {
        const optimization = await this.getFulfillmentOptions(tenantId, orderId);
        targetLocationId = optimization.recommended.locationId;
      }

      // Validate assignment
      const location = await this.locationRepository.findOne({
        where: { tenantId, id: targetLocationId },
      });

      if (!location) {
        throw new BadRequestException(`Location ${targetLocationId} not found`);
      }

      // Check capacity and availability
      const canAssign = await this.validateLocationAssignment(tenantId, order, targetLocationId, force);
      
      if (!canAssign.success) {
        throw new BadRequestException(`Cannot assign to location: ${canAssign.reason}`);
      }

      // Reserve inventory
      await this.reserveInventoryAtLocation(tenantId, order, targetLocationId);

      // Update order
      order.processingLocationId = targetLocationId;
      order.fulfillmentStatus = FulfillmentStatus.PROCESSING;
      await this.orderRepository.save(order);

      // Calculate estimates
      const estimates = await this.calculateFulfillmentEstimates(tenantId, order, targetLocationId);

      const assignment = {
        orderId,
        locationId: targetLocationId,
        estimatedCost: estimates.cost,
        estimatedTime: estimates.time,
        processingStartTime: new Date(),
      };

      // Log assignment
      await this.logService.log({
        tenantId,
        type: 'FULFILLMENT',
        level: 'INFO',
        message: `Order assigned to location: ${order.orderNumber} -> ${location.name}`,
        metadata: {
          orderId,
          locationId: targetLocationId,
          assignment,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.fulfillment.assigned', {
        tenantId,
        order,
        locationId: targetLocationId,
        assignment,
      });

      return {
        success: true,
        assignment,
      };

    } catch (error) {
      this.logger.error(`Failed to assign fulfillment: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'assign_fulfillment', orderId, locationId },
      });
      throw error;
    }
  }

  /**
   * Optimize batch fulfillment for multiple orders
   */
  async optimizeBatchFulfillment(tenantId: string, request: BatchFulfillmentRequest): Promise<BatchFulfillmentResult> {
    try {
      this.logger.debug(`Optimizing batch fulfillment for ${request.orderIds.length} orders`);

      const result: BatchFulfillmentResult = {
        success: true,
        assignments: [],
        summary: {
          totalOrders: request.orderIds.length,
          totalCost: 0,
          averageTime: 0,
          locationUtilization: {},
        },
        warnings: [],
        errors: [],
      };

      // Get all orders
      const orders = await this.orderRepository.find({
        where: { tenantId, id: In(request.orderIds) },
        relations: ['items'],
      });

      if (orders.length !== request.orderIds.length) {
        result.warnings.push(`Only found ${orders.length} of ${request.orderIds.length} requested orders`);
      }

      // Get available locations
      const locations = await this.getAvailableLocations(tenantId);

      // Get location capacities
      const locationCapacities = await this.getLocationCapacities(tenantId);

      // Optimization algorithm based on request type
      const optimization = request.optimization || 'balanced';

      switch (optimization) {
        case 'cost':
          result.assignments = await this.optimizeForCost(tenantId, orders, locations, request.constraints);
          break;
          
        case 'speed':
          result.assignments = await this.optimizeForSpeed(tenantId, orders, locations, request.constraints);
          break;
          
        case 'balanced':
        default:
          result.assignments = await this.optimizeBalanced(tenantId, orders, locations, request.constraints);
          break;
      }

      // Calculate summary
      result.summary.totalCost = result.assignments.reduce((sum, a) => sum + a.cost, 0);
      result.summary.averageTime = result.assignments.reduce((sum, a) => sum + a.estimatedTime, 0) / result.assignments.length;

      // Calculate location utilization
      const locationCounts = result.assignments.reduce((acc, a) => {
        acc[a.locationId] = (acc[a.locationId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      for (const [locationId, count] of Object.entries(locationCounts)) {
        const capacity = locationCapacities.find(c => c.locationId === locationId);
        result.summary.locationUtilization[locationId] = capacity 
          ? (count / capacity.maxDailyOrders) * 100
          : 0;
      }

      // Validate assignments
      for (const assignment of result.assignments) {
        try {
          const order = orders.find(o => o.id === assignment.orderId);
          if (order) {
            const validation = await this.validateLocationAssignment(tenantId, order, assignment.locationId, false);
            if (!validation.success) {
              result.warnings.push(`Assignment may fail for order ${assignment.orderId}: ${validation.reason}`);
            }
          }
        } catch (error) {
          result.errors.push(`Validation failed for order ${assignment.orderId}: ${error.message}`);
          result.success = false;
        }
      }

      // Log batch optimization
      await this.logService.log({
        tenantId,
        type: 'FULFILLMENT',
        level: result.success ? 'INFO' : 'WARN',
        message: `Batch fulfillment optimization completed: ${result.assignments.length} assignments`,
        metadata: {
          optimization,
          orderCount: request.orderIds.length,
          assignmentCount: result.assignments.length,
          totalCost: result.summary.totalCost,
          averageTime: result.summary.averageTime,
        },
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to optimize batch fulfillment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get location capacity and utilization
   */
  async getLocationCapacities(tenantId: string): Promise<LocationCapacity[]> {
    try {
      const locations = await this.locationRepository.find({
        where: { tenantId, isActive: true },
      });

      const capacities: LocationCapacity[] = [];

      for (const location of locations) {
        // Get current order count for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const currentDailyOrders = await this.orderRepository.count({
          where: {
            tenantId,
            processingLocationId: location.id,
            createdAt: Between(today, tomorrow),
          },
        });

        const currentConcurrentOrders = await this.orderRepository.count({
          where: {
            tenantId,
            processingLocationId: location.id,
            fulfillmentStatus: In([FulfillmentStatus.PROCESSING, FulfillmentStatus.READY]),
          },
        });

        // Extract capacity info from location metadata or use defaults
        const metadata = location.metadata || {};
        
        capacities.push({
          locationId: location.id,
          maxDailyOrders: metadata.maxDailyOrders || 100,
          currentDailyOrders,
          maxConcurrentOrders: metadata.maxConcurrentOrders || 20,
          currentConcurrentOrders,
          staffCount: metadata.staffCount || 5,
          shiftSchedule: metadata.shiftSchedule || {
            morning: true,
            afternoon: true,
            evening: false,
            night: false,
          },
          specialCapabilities: metadata.specialCapabilities || {
            coldStorage: false,
            fragileHandling: true,
            bulkOrders: true,
            expressProcessing: false,
          },
        });
      }

      return capacities;

    } catch (error) {
      this.logger.error(`Failed to get location capacities: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update fulfillment status for an order
   */
  async updateFulfillmentStatus(
    tenantId: string,
    orderId: string,
    status: FulfillmentStatus,
    notes?: string,
    userId?: string,
  ): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
      });

      if (!order) {
        throw new BadRequestException(`Order ${orderId} not found`);
      }

      const previousStatus = order.fulfillmentStatus;
      order.fulfillmentStatus = status;
      order.updatedBy = userId;

      // Update timestamps based on status
      const now = new Date();
      switch (status) {
        case FulfillmentStatus.READY:
          order.estimatedDeliveryDate = this.calculateEstimatedDelivery(order);
          break;
        case FulfillmentStatus.SHIPPED:
          order.shippedAt = now;
          break;
        case FulfillmentStatus.DELIVERED:
          order.deliveredAt = now;
          order.actualDeliveryDate = now;
          break;
      }

      await this.orderRepository.save(order);

      // Log status update
      await this.logService.log({
        tenantId,
        type: 'FULFILLMENT',
        level: 'INFO',
        message: `Fulfillment status updated: ${order.orderNumber} -> ${status}`,
        metadata: {
          orderId,
          previousStatus,
          newStatus: status,
          notes,
          userId,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.fulfillment.status.updated', {
        tenantId,
        order,
        previousStatus,
        newStatus: status,
        notes,
      });

    } catch (error) {
      this.logger.error(`Failed to update fulfillment status: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private async getAvailableLocations(tenantId: string): Promise<FulfillmentLocation[]> {
    const locations = await this.locationRepository.find({
      where: { tenantId, isActive: true },
    });

    return locations.map(location => ({
      locationId: location.id,
      locationName: location.name,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      postalCode: location.postalCode || '',
      coordinates: location.coordinates,
      capacity: {
        maxOrders: location.metadata?.maxDailyOrders || 100,
        currentOrders: 0, // Would be calculated from current orders
        utilizationRate: 0, // Would be calculated
      },
      capabilities: {
        sameDay: location.metadata?.capabilities?.sameDay || false,
        nextDay: location.metadata?.capabilities?.nextDay || true,
        packaging: location.metadata?.capabilities?.packaging || ['standard'],
        specialHandling: location.metadata?.capabilities?.specialHandling || [],
      },
    }));
  }

  private async evaluateLocationForOrder(
    tenantId: string,
    order: Order,
    location: FulfillmentLocation,
  ): Promise<FulfillmentOption | null> {
    try {
      // Check inventory availability
      const availability = await this.checkInventoryAvailability(tenantId, order, location.locationId);
      
      if (!availability.canFulfill && !availability.partialFulfill) {
        return null;
      }

      // Calculate costs
      const cost = await this.calculateFulfillmentCost(tenantId, order, location);

      // Calculate timeframe
      const timeframe = await this.calculateFulfillmentTimeframe(tenantId, order, location);

      // Calculate priority score
      const priority = this.calculateLocationPriority(order, location, availability, cost, timeframe);

      // Generate reasons
      const reasons = this.generateRecommendationReasons(location, availability, cost, timeframe);

      return {
        locationId: location.locationId,
        location,
        cost,
        timeframe,
        availability,
        priority,
        reason: reasons,
      };

    } catch (error) {
      this.logger.error(`Failed to evaluate location ${location.locationId}: ${error.message}`);
      return null;
    }
  }

  private async checkInventoryAvailability(
    tenantId: string,
    order: Order,
    locationId: string,
  ): Promise<FulfillmentOption['availability']> {
    const availability = {
      canFulfill: true,
      partialFulfill: false,
      availableItems: 0,
      missingItems: [],
    };

    let totalAvailable = 0;

    for (const item of order.items || []) {
      const inventory = await this.inventoryRepository.findOne({
        where: {
          tenantId,
          productId: item.productId,
          variantId: item.variantId,
          locationId,
        },
      });

      const available = inventory?.quantityAvailable || 0;
      
      if (available >= item.quantity) {
        totalAvailable++;
      } else {
        availability.canFulfill = false;
        availability.missingItems.push({
          productId: item.productId,
          requested: item.quantity,
          available,
          shortfall: item.quantity - available,
        });
      }
    }

    availability.availableItems = totalAvailable;
    availability.partialFulfill = totalAvailable > 0 && totalAvailable < (order.items?.length || 0);

    return availability;
  }

  private async calculateFulfillmentCost(
    tenantId: string,
    order: Order,
    location: FulfillmentLocation,
  ): Promise<FulfillmentOption['cost']> {
    // Basic cost calculation - would be more sophisticated in production
    const baseShipping = this.calculateShippingCost(order, location);
    const handling = this.calculateHandlingCost(order, location);

    return {
      shipping: baseShipping,
      handling,
      total: baseShipping + handling,
    };
  }

  private async calculateFulfillmentTimeframe(
    tenantId: string,
    order: Order,
    location: FulfillmentLocation,
  ): Promise<FulfillmentOption['timeframe']> {
    // Basic timeframe calculation
    const processingHours = location.capabilities.sameDay ? 2 : 24;
    const shippingHours = this.calculateShippingTime(order, location);
    const totalHours = processingHours + shippingHours;

    const estimated = new Date();
    estimated.setHours(estimated.getHours() + totalHours);

    return {
      processing: processingHours,
      shipping: shippingHours,
      total: totalHours,
      estimated,
    };
  }

  private calculateLocationPriority(
    order: Order,
    location: FulfillmentLocation,
    availability: FulfillmentOption['availability'],
    cost: FulfillmentOption['cost'],
    timeframe: FulfillmentOption['timeframe'],
  ): number {
    let priority = 100;

    // Prefer locations that can fulfill completely
    if (availability.canFulfill) {
      priority -= 30;
    } else if (availability.partialFulfill) {
      priority -= 10;
    }

    // Factor in cost (lower cost = higher priority)
    const costScore = Math.min(cost.total / 100, 20);
    priority += costScore;

    // Factor in time (faster = higher priority)
    const timeScore = Math.min(timeframe.total / 24, 20);
    priority += timeScore;

    // Factor in location capabilities
    if (location.capabilities.sameDay && order.priority <= 2) {
      priority -= 20;
    }

    return Math.max(1, Math.round(priority));
  }

  private generateRecommendationReasons(
    location: FulfillmentLocation,
    availability: FulfillmentOption['availability'],
    cost: FulfillmentOption['cost'],
    timeframe: FulfillmentOption['timeframe'],
  ): string[] {
    const reasons: string[] = [];

    if (availability.canFulfill) {
      reasons.push('All items available');
    } else if (availability.partialFulfill) {
      reasons.push('Partial fulfillment possible');
    }

    if (cost.total < 50000) {
      reasons.push('Low cost option');
    }

    if (timeframe.total < 24) {
      reasons.push('Fast delivery');
    }

    if (location.capabilities.sameDay) {
      reasons.push('Same-day capability');
    }

    return reasons;
  }

  private calculateShippingCost(order: Order, location: FulfillmentLocation): number {
    // Simplified shipping cost calculation
    // In production, this would integrate with shipping APIs
    const baseRate = 15000; // IDR 15,000 base rate
    const distanceMultiplier = this.calculateDistanceMultiplier(order, location);
    const weightMultiplier = this.calculateWeightMultiplier(order);

    return Math.round(baseRate * distanceMultiplier * weightMultiplier);
  }

  private calculateHandlingCost(order: Order, location: FulfillmentLocation): number {
    // Basic handling cost
    const itemCount = order.items?.length || 0;
    return itemCount * 2000; // IDR 2,000 per item
  }

  private calculateShippingTime(order: Order, location: FulfillmentLocation): number {
    // Simplified shipping time calculation in hours
    const distance = this.calculateDistance(order, location);
    
    if (distance < 50) return 6; // Same city
    if (distance < 200) return 24; // Same province
    if (distance < 500) return 48; // Neighboring provinces
    return 72; // Far provinces
  }

  private calculateDistanceMultiplier(order: Order, location: FulfillmentLocation): number {
    // Simplified distance calculation
    // In production, would use actual geocoding APIs
    const distance = this.calculateDistance(order, location);
    
    if (distance < 50) return 1.0;
    if (distance < 200) return 1.5;
    if (distance < 500) return 2.0;
    return 3.0;
  }

  private calculateWeightMultiplier(order: Order): number {
    // Simplified weight calculation
    const itemCount = order.items?.length || 0;
    if (itemCount <= 3) return 1.0;
    if (itemCount <= 10) return 1.2;
    return 1.5;
  }

  private calculateDistance(order: Order, location: FulfillmentLocation): number {
    // Simplified distance calculation
    // In production, would use proper geocoding
    const customerCity = order.shippingAddress?.city?.toLowerCase() || '';
    const locationCity = location.city.toLowerCase();
    
    if (customerCity === locationCity) return 10;
    
    // Return estimated distance based on Indonesian geography
    return 200; // Default to medium distance
  }

  private selectRecommendedOption(options: FulfillmentOption[], order: Order): FulfillmentOption {
    if (options.length === 0) {
      throw new BadRequestException('No fulfillment options available');
    }

    // Return the highest priority option (lowest priority number)
    return options[0];
  }

  private async evaluateMultiLocationFulfillment(
    tenantId: string,
    order: Order,
    locations: FulfillmentLocation[],
  ): Promise<FulfillmentOptimization['multiLocation']> {
    // Simplified multi-location evaluation
    // In production, this would be a complex optimization problem
    
    return {
      canSplit: false, // Simplified - disable for now
      splitOptions: [],
    };
  }

  private getOrderConstraints(order: Order): FulfillmentOptimization['constraints'] {
    return {
      maxCost: order.channelMetadata?.maxShippingCost,
      maxTime: order.priority <= 2 ? 24 : 72, // High priority orders need fast delivery
      preferredLocations: order.channelMetadata?.preferredLocations,
      customerPreferences: order.channelMetadata?.customerPreferences,
    };
  }

  private async validateLocationAssignment(
    tenantId: string,
    order: Order,
    locationId: string,
    force: boolean,
  ): Promise<{ success: boolean; reason?: string }> {
    const location = await this.locationRepository.findOne({
      where: { tenantId, id: locationId },
    });

    if (!location) {
      return { success: false, reason: 'Location not found' };
    }

    if (!location.isActive) {
      return { success: false, reason: 'Location is not active' };
    }

    if (!force) {
      // Check capacity
      const capacity = await this.getLocationCapacities(tenantId);
      const locationCapacity = capacity.find(c => c.locationId === locationId);
      
      if (locationCapacity && locationCapacity.currentConcurrentOrders >= locationCapacity.maxConcurrentOrders) {
        return { success: false, reason: 'Location at maximum capacity' };
      }
    }

    return { success: true };
  }

  private async reserveInventoryAtLocation(tenantId: string, order: Order, locationId: string): Promise<void> {
    // This would integrate with inventory service to reserve items at specific location
    this.eventEmitter.emit('inventory.reserve.location', {
      tenantId,
      orderId: order.id,
      locationId,
      items: order.items,
    });
  }

  private async calculateFulfillmentEstimates(
    tenantId: string,
    order: Order,
    locationId: string,
  ): Promise<{ cost: number; time: number }> {
    const location = await this.locationRepository.findOne({
      where: { tenantId, id: locationId },
    });

    if (!location) {
      return { cost: 0, time: 0 };
    }

    const fulfillmentLocation: FulfillmentLocation = {
      locationId: location.id,
      locationName: location.name,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      postalCode: location.postalCode || '',
      coordinates: location.coordinates,
      capacity: { maxOrders: 100, currentOrders: 0, utilizationRate: 0 },
      capabilities: { sameDay: false, nextDay: true, packaging: [], specialHandling: [] },
    };

    const cost = await this.calculateFulfillmentCost(tenantId, order, fulfillmentLocation);
    const timeframe = await this.calculateFulfillmentTimeframe(tenantId, order, fulfillmentLocation);

    return {
      cost: cost.total,
      time: timeframe.total,
    };
  }

  private calculateEstimatedDelivery(order: Order): Date {
    const estimated = new Date();
    
    // Add processing time (1-2 days) + shipping time based on location
    const processingDays = order.priority <= 2 ? 1 : 2;
    const shippingDays = 2; // Default shipping time
    
    estimated.setDate(estimated.getDate() + processingDays + shippingDays);
    
    return estimated;
  }

  // Optimization algorithms

  private async optimizeForCost(
    tenantId: string,
    orders: Order[],
    locations: FulfillmentLocation[],
    constraints?: any,
  ): Promise<BatchFulfillmentResult['assignments']> {
    const assignments = [];

    for (const order of orders) {
      const options = [];
      
      for (const location of locations) {
        const option = await this.evaluateLocationForOrder(tenantId, order, location);
        if (option) {
          options.push(option);
        }
      }

      // Sort by cost (ascending)
      options.sort((a, b) => a.cost.total - b.cost.total);
      
      if (options.length > 0) {
        const best = options[0];
        assignments.push({
          orderId: order.id,
          locationId: best.locationId,
          cost: best.cost.total,
          estimatedTime: best.timeframe.total,
          items: order.items?.map(item => item.id) || [],
        });
      }
    }

    return assignments;
  }

  private async optimizeForSpeed(
    tenantId: string,
    orders: Order[],
    locations: FulfillmentLocation[],
    constraints?: any,
  ): Promise<BatchFulfillmentResult['assignments']> {
    const assignments = [];

    for (const order of orders) {
      const options = [];
      
      for (const location of locations) {
        const option = await this.evaluateLocationForOrder(tenantId, order, location);
        if (option) {
          options.push(option);
        }
      }

      // Sort by time (ascending)
      options.sort((a, b) => a.timeframe.total - b.timeframe.total);
      
      if (options.length > 0) {
        const best = options[0];
        assignments.push({
          orderId: order.id,
          locationId: best.locationId,
          cost: best.cost.total,
          estimatedTime: best.timeframe.total,
          items: order.items?.map(item => item.id) || [],
        });
      }
    }

    return assignments;
  }

  private async optimizeBalanced(
    tenantId: string,
    orders: Order[],
    locations: FulfillmentLocation[],
    constraints?: any,
  ): Promise<BatchFulfillmentResult['assignments']> {
    const assignments = [];

    for (const order of orders) {
      const options = [];
      
      for (const location of locations) {
        const option = await this.evaluateLocationForOrder(tenantId, order, location);
        if (option) {
          options.push(option);
        }
      }

      // Sort by priority (best overall score)
      options.sort((a, b) => a.priority - b.priority);
      
      if (options.length > 0) {
        const best = options[0];
        assignments.push({
          orderId: order.id,
          locationId: best.locationId,
          cost: best.cost.total,
          estimatedTime: best.timeframe.total,
          items: order.items?.map(item => item.id) || [],
        });
      }
    }

    return assignments;
  }
}