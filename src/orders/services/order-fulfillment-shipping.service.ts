import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import {
  Order,
  FulfillmentStatus,
  OrderStatus,
} from '../entities/order.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';

// Services
import { OrderFulfillmentService } from './order-fulfillment.service';
import {
  ShippingService,
  ShippingQuoteRequest,
  CreateShippingLabelRequest,
} from '../../shipping/services/shipping.service';
import { JneShippingService } from '../../shipping/integrations/jne/services/jne-shipping.service';
import { JntShippingService } from '../../shipping/integrations/jnt/services/jnt-shipping.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';

// Interfaces
export interface FulfillmentWithShipping {
  orderId: string;
  fulfillment: {
    locationId: string;
    locationName: string;
    estimatedProcessingTime: number;
    cost: number;
  };
  shipping: {
    quotes: Array<{
      carrierId: string;
      carrierName: string;
      serviceName: string;
      cost: number;
      estimatedDays: number;
      features: any;
    }>;
    recommended: {
      carrierId: string;
      serviceName: string;
      totalCost: number;
      totalTime: number;
    };
  };
  totalCost: number;
  totalTime: number;
  estimatedDeliveryDate: Date;
}

export interface CompleteOrderFulfillmentRequest {
  orderId: string;
  locationId?: string;
  carrierId: string;
  serviceCode: string;
  senderAddress: {
    name: string;
    company?: string;
    address: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
    email?: string;
  };
  packageInfo: {
    weight: number;
    length: number;
    width: number;
    height: number;
    content: string;
    pieces: number;
  };
  insuranceType?: string;
  insuredValue?: number;
  isCod?: boolean;
  codAmount?: number;
  specialInstructions?: string[];
}

@Injectable()
export class OrderFulfillmentShippingService {
  private readonly logger = new Logger(OrderFulfillmentShippingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,

    // Services
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly shippingService: ShippingService,
    private readonly jneShippingService: JneShippingService,
    private readonly jntShippingService: JntShippingService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get complete fulfillment options including shipping quotes
   */
  async getCompleteFulfillmentOptions(
    tenantId: string,
    orderId: string,
  ): Promise<FulfillmentWithShipping> {
    try {
      this.logger.debug(
        `Getting complete fulfillment options for order ${orderId}`,
      );

      // Get order details
      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
        relations: ['items'],
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      if (!order.shippingAddress) {
        throw new BadRequestException('Order must have shipping address');
      }

      // Get fulfillment options from existing service
      const fulfillmentOptions =
        await this.fulfillmentService.getFulfillmentOptions(tenantId, orderId);
      const recommendedFulfillment = fulfillmentOptions.recommended;

      // Get location details for sender address
      const location = await this.locationRepository.findOne({
        where: { tenantId, id: recommendedFulfillment.locationId },
      });

      if (!location) {
        throw new BadRequestException('Fulfillment location not found');
      }

      // Prepare shipping quote request
      const packageInfo = await this.calculatePackageInfo(order);
      const shippingQuoteRequest: ShippingQuoteRequest = {
        originPostalCode: location.postalCode,
        destinationPostalCode: order.shippingAddress.postalCode,
        originCity: location.city,
        destinationCity: order.shippingAddress.city,
        originState: location.state,
        destinationState: order.shippingAddress.state,
        packageInfo,
        includeInsurance: true,
        isCod: order.paymentMethod === 'cod',
        codAmount:
          order.paymentMethod === 'cod' ? order.totalAmount : undefined,
      };

      // Get shipping quotes
      const shippingQuotes = await this.shippingService.getShippingQuotes(
        tenantId,
        shippingQuoteRequest,
      );

      // Find recommended shipping option (lowest cost with reasonable time)
      const recommendedShipping =
        this.selectRecommendedShipping(shippingQuotes);

      // Calculate total estimates
      const totalCost =
        recommendedFulfillment.cost.total + recommendedShipping.cost.totalCost;
      const totalTime =
        recommendedFulfillment.timeframe.total +
        recommendedShipping.timeframe.estimatedDays * 24;

      const estimatedDeliveryDate = new Date();
      estimatedDeliveryDate.setHours(
        estimatedDeliveryDate.getHours() + totalTime,
      );

      return {
        orderId,
        fulfillment: {
          locationId: recommendedFulfillment.locationId,
          locationName: location.name,
          estimatedProcessingTime: recommendedFulfillment.timeframe.processing,
          cost: recommendedFulfillment.cost.total,
        },
        shipping: {
          quotes: shippingQuotes.map(quote => ({
            carrierId: quote.carrierId,
            carrierName: quote.carrierName,
            serviceName: quote.serviceName,
            cost: quote.cost.totalCost,
            estimatedDays: quote.timeframe.estimatedDays,
            features: quote.features,
          })),
          recommended: {
            carrierId: recommendedShipping.carrierId,
            serviceName: recommendedShipping.serviceName,
            totalCost: recommendedShipping.cost.totalCost,
            totalTime: recommendedShipping.timeframe.estimatedDays * 24,
          },
        },
        totalCost,
        totalTime,
        estimatedDeliveryDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get complete fulfillment options: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Complete order fulfillment with shipping label creation
   */
  async completeOrderFulfillment(
    tenantId: string,
    request: CompleteOrderFulfillmentRequest,
  ): Promise<{
    success: boolean;
    fulfillment: {
      assignment: any;
      location: string;
    };
    shipping: {
      labelId: string;
      trackingNumber?: string;
      labelUrl?: string;
      totalCost: number;
    };
    estimatedDeliveryDate: Date;
  }> {
    try {
      this.logger.debug(`Completing fulfillment for order ${request.orderId}`);

      // Step 1: Assign order to fulfillment location
      const fulfillmentAssignment =
        await this.fulfillmentService.assignOrderFulfillment(
          tenantId,
          request.orderId,
          request.locationId,
        );

      if (!fulfillmentAssignment.success) {
        throw new BadRequestException('Failed to assign order fulfillment');
      }

      // Step 2: Get shipping rate for label creation
      const shippingQuotes = await this.getShippingQuotesForOrder(
        tenantId,
        request.orderId,
        request.carrierId,
      );
      const selectedRate = shippingQuotes.find(
        quote =>
          quote.carrierId === request.carrierId &&
          quote.serviceCode === request.serviceCode,
      );

      if (!selectedRate) {
        throw new BadRequestException('Selected shipping rate not found');
      }

      // Step 3: Create shipping label
      const labelRequest: CreateShippingLabelRequest = {
        orderId: request.orderId,
        rateId: selectedRate.rateId,
        serviceType: this.mapServiceCodeToServiceType(request.serviceCode),
        senderAddress: request.senderAddress,
        packageInfo: request.packageInfo,
        insuranceType: request.insuranceType as any,
        insuredValue: request.insuredValue,
        isCod: request.isCod,
        codAmount: request.codAmount,
        specialInstructions: request.specialInstructions,
      };

      const shippingLabel = await this.shippingService.createShippingLabel(
        tenantId,
        labelRequest,
      );

      // Step 4: Generate shipping label with carrier
      const generatedLabel = await this.shippingService.generateShippingLabel(
        tenantId,
        shippingLabel.id,
      );

      // Step 5: Update order status to ready for shipping
      await this.updateOrderForShipping(
        tenantId,
        request.orderId,
        generatedLabel,
      );

      // Step 6: Calculate final delivery estimate
      const estimatedDeliveryDate = new Date();
      estimatedDeliveryDate.setHours(
        estimatedDeliveryDate.getHours() +
          fulfillmentAssignment.assignment.estimatedTime +
          selectedRate.timeframe.estimatedDays * 24,
      );

      // Get location name
      const location = await this.locationRepository.findOne({
        where: { tenantId, id: fulfillmentAssignment.assignment.locationId },
      });

      const result = {
        success: true,
        fulfillment: {
          assignment: fulfillmentAssignment.assignment,
          location: location?.name || 'Unknown Location',
        },
        shipping: {
          labelId: generatedLabel.id,
          trackingNumber: generatedLabel.trackingNumber,
          labelUrl: generatedLabel.labelUrl,
          totalCost: generatedLabel.totalCost,
        },
        estimatedDeliveryDate,
      };

      // Log complete fulfillment
      await this.logService.log({
        tenantId,
        type: 'fulfillment' as any,
        level: 'info' as any,
        message: `Order fulfillment completed with shipping`,
        metadata: {
          orderId: request.orderId,
          locationId: fulfillmentAssignment.assignment.locationId,
          carrierId: request.carrierId,
          trackingNumber: generatedLabel.trackingNumber,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.fulfillment.completed', {
        tenantId,
        orderId: request.orderId,
        fulfillment: result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to complete order fulfillment: ${error.message}`,
        error.stack,
      );

      // Log failure
      await this.logService.logError(tenantId, 'fulfillment-shipping', error, {
        metadata: {
          action: 'complete_order_fulfillment',
          orderId: request.orderId,
          carrierId: request.carrierId,
        },
      });

      throw error;
    }
  }

  /**
   * Mark order as shipped and update tracking
   */
  async markOrderShipped(
    tenantId: string,
    orderId: string,
    trackingDetails?: {
      actualPickupDate?: Date;
      courierName?: string;
      estimatedDeliveryDate?: Date;
    },
  ): Promise<{
    success: boolean;
    order: Order;
  }> {
    try {
      this.logger.debug(`Marking order ${orderId} as shipped`);

      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      if (order.fulfillmentStatus !== FulfillmentStatus.READY) {
        throw new BadRequestException('Order is not ready for shipping');
      }

      // Update order status
      order.status = OrderStatus.SHIPPED;
      order.fulfillmentStatus = FulfillmentStatus.SHIPPED;
      order.shippedAt = trackingDetails?.actualPickupDate || new Date();

      if (trackingDetails?.estimatedDeliveryDate) {
        order.estimatedDeliveryDate = trackingDetails.estimatedDeliveryDate;
      }

      await this.orderRepository.save(order);

      // Log shipping
      await this.logService.log({
        tenantId,
        type: 'shipping' as any,
        level: 'info' as any,
        message: `Order marked as shipped: ${order.orderNumber}`,
        metadata: {
          orderId,
          shippedAt: order.shippedAt,
          trackingNumber: order.trackingNumber,
          estimatedDeliveryDate: order.estimatedDeliveryDate,
          trackingDetails,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.shipped', {
        tenantId,
        order,
        trackingDetails,
      });

      return {
        success: true,
        order,
      };
    } catch (error) {
      this.logger.error(
        `Failed to mark order as shipped: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark order as delivered
   */
  async markOrderDelivered(
    tenantId: string,
    orderId: string,
    deliveryDetails: {
      actualDeliveryDate: Date;
      recipientName?: string;
      signedBy?: string;
      deliveryNotes?: string;
      proofOfDelivery?: {
        photoUrl?: string;
        signatureUrl?: string;
      };
    },
  ): Promise<{
    success: boolean;
    order: Order;
  }> {
    try {
      this.logger.debug(`Marking order ${orderId} as delivered`);

      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      // Update order status
      order.status = OrderStatus.DELIVERED;
      order.fulfillmentStatus = FulfillmentStatus.DELIVERED;
      order.deliveredAt = deliveryDetails.actualDeliveryDate;
      order.actualDeliveryDate = deliveryDetails.actualDeliveryDate;

      await this.orderRepository.save(order);

      // Log delivery
      await this.logService.log({
        tenantId,
        type: 'delivery' as any,
        level: 'info' as any,
        message: `Order delivered: ${order.orderNumber}`,
        metadata: {
          orderId,
          deliveredAt: order.deliveredAt,
          trackingNumber: order.trackingNumber,
          deliveryDetails,
        },
      });

      // Emit event
      this.eventEmitter.emit('order.delivered', {
        tenantId,
        order,
        deliveryDetails,
      });

      return {
        success: true,
        order,
      };
    } catch (error) {
      this.logger.error(
        `Failed to mark order as delivered: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get order fulfillment timeline
   */
  async getOrderFulfillmentTimeline(
    tenantId: string,
    orderId: string,
  ): Promise<{
    order: {
      orderNumber: string;
      status: string;
      fulfillmentStatus: string;
    };
    timeline: Array<{
      stage: string;
      status: 'completed' | 'in_progress' | 'pending';
      timestamp?: Date;
      estimatedTime?: Date;
      description: string;
      details?: any;
    }>;
    currentStage: string;
    nextStage?: string;
    estimatedCompletion?: Date;
  }> {
    try {
      this.logger.debug(`Getting fulfillment timeline for order ${orderId}`);

      const order = await this.orderRepository.findOne({
        where: { tenantId, id: orderId },
        relations: ['items'],
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      // Build timeline based on order status
      const timeline: Array<{
        stage: string;
        status: 'completed' | 'in_progress' | 'pending';
        timestamp?: Date;
        estimatedTime?: Date;
        description: string;
        details?: any;
      }> = [
        {
          stage: 'order_confirmed',
          status: order.confirmedAt ? 'completed' : 'pending',
          timestamp: order.confirmedAt,
          description: 'Order confirmed and payment received',
        },
        {
          stage: 'fulfillment_assigned',
          status: order.processingLocationId ? 'completed' : 'pending',
          timestamp: order.processingLocationId ? new Date() : undefined, // Would track actual assignment time
          description: 'Order assigned to fulfillment location',
          details: {
            locationId: order.processingLocationId,
          },
        },
        {
          stage: 'preparing',
          status:
            order.fulfillmentStatus === FulfillmentStatus.PROCESSING
              ? 'in_progress'
              : [
                  FulfillmentStatus.READY,
                  FulfillmentStatus.SHIPPED,
                  FulfillmentStatus.DELIVERED,
                ].includes(order.fulfillmentStatus)
              ? 'completed'
              : 'pending',
          timestamp: undefined,
          description: 'Order being prepared for shipping',
        },
        {
          stage: 'ready_for_shipping',
          status:
            order.fulfillmentStatus === FulfillmentStatus.READY
              ? 'in_progress'
              : [
                  FulfillmentStatus.SHIPPED,
                  FulfillmentStatus.DELIVERED,
                ].includes(order.fulfillmentStatus)
              ? 'completed'
              : 'pending',
          timestamp: undefined,
          description: 'Order ready for pickup/shipping',
        },
        {
          stage: 'shipped',
          status: order.shippedAt
            ? 'completed'
            : ('pending' as 'completed' | 'in_progress' | 'pending'),
          timestamp: order.shippedAt,
          description: 'Order shipped and in transit',
          details: {
            trackingNumber: order.trackingNumber,
            carrier: order.shippingCarrier,
          },
        },
        {
          stage: 'delivered',
          status: order.deliveredAt
            ? 'completed'
            : ('pending' as 'completed' | 'in_progress' | 'pending'),
          timestamp: order.deliveredAt,
          description: 'Order delivered to customer',
        },
      ];

      // Determine current and next stage
      const currentStageIndex = timeline.findIndex(
        stage => stage.status === 'in_progress',
      );
      const currentStage =
        currentStageIndex >= 0
          ? timeline[currentStageIndex].stage
          : 'completed';
      const nextStage =
        currentStageIndex >= 0 && currentStageIndex < timeline.length - 1
          ? timeline[currentStageIndex + 1].stage
          : undefined;

      return {
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          fulfillmentStatus: order.fulfillmentStatus,
        },
        timeline,
        currentStage,
        nextStage,
        estimatedCompletion: order.estimatedDeliveryDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get fulfillment timeline: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private async calculatePackageInfo(order: Order): Promise<{
    weight: number;
    length: number;
    width: number;
    height: number;
    content: string;
    value: number;
  }> {
    // Calculate total weight based on order items
    // This is simplified - in production, you'd have product dimensions and weights
    const itemCount = order.items?.length || 1;
    const estimatedWeight = itemCount * 500; // 500g per item (simplified)

    // Estimate package dimensions based on item count
    const baseLength = 20; // cm
    const baseWidth = 15; // cm
    const baseHeight = 5; // cm

    const length = baseLength + Math.floor(itemCount / 3) * 5;
    const width = baseWidth + Math.floor(itemCount / 5) * 3;
    const height = baseHeight + Math.floor(itemCount / 2) * 2;

    // Generate content description
    const content =
      order.items?.map(item => item.productName).join(', ') ||
      'General Merchandise';

    return {
      weight: estimatedWeight,
      length,
      width,
      height,
      content: content.substring(0, 100), // Limit length
      value: order.totalAmount,
    };
  }

  private selectRecommendedShipping(quotes: any[]): any {
    if (quotes.length === 0) {
      throw new BadRequestException('No shipping quotes available');
    }

    // Score quotes based on cost and time (balanced approach)
    const scoredQuotes = quotes.map(quote => {
      const costScore = 1 / (quote.cost.totalCost / 10000); // Lower cost = higher score
      const timeScore = 1 / quote.timeframe.estimatedDays; // Faster = higher score
      const balancedScore = costScore * 0.6 + timeScore * 0.4; // Favor cost slightly

      return {
        ...quote,
        score: balancedScore,
      };
    });

    // Return highest scored quote
    return scoredQuotes.sort((a, b) => b.score - a.score)[0];
  }

  private async getShippingQuotesForOrder(
    tenantId: string,
    orderId: string,
    carrierId: string,
  ): Promise<any[]> {
    // This would get actual quotes - simplified for now
    return [
      {
        carrierId,
        rateId: `rate-${carrierId}-${Date.now()}`,
        serviceCode: 'REG',
        timeframe: { estimatedDays: 2 },
      },
    ];
  }

  private mapServiceCodeToServiceType(serviceCode: string): any {
    const mapping: Record<string, any> = {
      REG: 'regular',
      YES: 'express',
      OKE: 'economy',
      STANDARD: 'regular',
      EXPRESS: 'express',
    };

    return mapping[serviceCode.toUpperCase()] || 'regular';
  }

  private async updateOrderForShipping(
    tenantId: string,
    orderId: string,
    shippingLabel: any,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { tenantId, id: orderId },
    });

    if (order) {
      order.trackingNumber = shippingLabel.trackingNumber;
      order.shippingCarrier = shippingLabel.carrierName;
      order.shippingMethod = shippingLabel.serviceName;
      order.shippingAmount = shippingLabel.totalCost;
      order.estimatedDeliveryDate = shippingLabel.estimatedDeliveryDate;
      order.fulfillmentStatus = FulfillmentStatus.READY;

      await this.orderRepository.save(order);
    }
  }
}
