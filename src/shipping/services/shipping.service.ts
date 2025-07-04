import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import {
  ShippingLabel,
  ShippingLabelStatus,
  ShippingServiceType,
  InsuranceType,
} from '../entities/shipping-label.entity';
import {
  ShippingTracking,
  TrackingStatus,
  TrackingEventType,
} from '../entities/shipping-tracking.entity';
import { ShippingRate, RateType } from '../entities/shipping-rate.entity';
import {
  Order,
  OrderStatus,
  FulfillmentStatus,
} from '../../orders/entities/order.entity';
import { UpdateOrderDto } from '../../orders/dto/update-order.dto';

// Services
import { OrdersService } from '../../orders/services/orders.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../integrations/entities/integration-log.entity';

// Interfaces
export interface ShippingQuoteRequest {
  originPostalCode: string;
  destinationPostalCode: string;
  originCity: string;
  destinationCity: string;
  originState: string;
  destinationState: string;
  packageInfo: {
    weight: number; // in grams
    length: number; // in cm
    width: number; // in cm
    height: number; // in cm
    content: string;
    value?: number; // for insurance
  };
  serviceTypes?: ShippingServiceType[];
  carrierIds?: string[];
  includeInsurance?: boolean;
  isCod?: boolean;
  codAmount?: number;
}

export interface ShippingQuote {
  carrierId: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  serviceType: ShippingServiceType;
  cost: {
    baseCost: number;
    weightCost: number;
    insuranceCost: number;
    codFee: number;
    adminFee: number;
    totalCost: number;
  };
  timeframe: {
    estimatedDays: number;
    minDays?: number;
    maxDays?: number;
    estimatedDeliveryDate: Date;
  };
  features: {
    isCodAvailable: boolean;
    isInsuranceAvailable: boolean;
    requiresSignature: boolean;
    trackingAvailable: boolean;
    sameDay?: boolean;
    nextDay?: boolean;
  };
  restrictions?: string[];
  rateId: string;
}

export interface CreateShippingLabelRequest {
  orderId: string;
  rateId: string;
  serviceType: ShippingServiceType;
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
    category?: string;
    pieces: number;
  };
  insuranceType?: InsuranceType;
  insuredValue?: number;
  isCod?: boolean;
  codAmount?: number;
  requiresSignature?: boolean;
  isFragile?: boolean;
  specialInstructions?: string[];
  notes?: string;
}

export interface TrackingUpdate {
  trackingNumber: string;
  status: TrackingStatus;
  description: string;
  location?: {
    name: string;
    city: string;
    state: string;
  };
  eventTime: Date;
  additionalData?: any;
}

export interface ShippingAnalytics {
  summary: {
    totalShipments: number;
    totalCost: number;
    averageCost: number;
    onTimeDeliveryRate: number;
    deliveredShipments: number;
    pendingShipments: number;
    delayedShipments: number;
  };
  carrierPerformance: Array<{
    carrierId: string;
    carrierName: string;
    shipmentCount: number;
    totalCost: number;
    averageCost: number;
    onTimeRate: number;
    averageDeliveryDays: number;
    customerRating?: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      shipments: number;
      cost: number;
      onTimeRate: number;
    }>;
    serviceTypes: Record<
      ShippingServiceType,
      {
        count: number;
        totalCost: number;
        onTimeRate: number;
      }
    >;
  };
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    @InjectRepository(ShippingLabel)
    private readonly shippingLabelRepository: Repository<ShippingLabel>,
    @InjectRepository(ShippingTracking)
    private readonly shippingTrackingRepository: Repository<ShippingTracking>,
    @InjectRepository(ShippingRate)
    private readonly shippingRateRepository: Repository<ShippingRate>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    // Services
    private readonly ordersService: OrdersService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get shipping quotes for a package
   */
  async getShippingQuotes(
    tenantId: string,
    request: ShippingQuoteRequest,
  ): Promise<ShippingQuote[]> {
    try {
      this.logger.debug(
        `Getting shipping quotes for tenant ${tenantId}`,
        request,
      );

      // Find available rates for the route
      const rates = await this.shippingRateRepository.find({
        where: {
          tenantId,
          originPostalCode: request.originPostalCode,
          destinationPostalCode: request.destinationPostalCode,
          isActive: true,
          ...(request.carrierIds && { carrierId: In(request.carrierIds) }),
        },
        order: { priority: 'ASC', baseCost: 'ASC' },
      });

      const quotes: ShippingQuote[] = [];
      const pickupDate = new Date();

      for (const rate of rates) {
        // Validate package against rate constraints
        const validation = rate.isValidForPackage(request.packageInfo);
        if (!validation.valid) {
          this.logger.debug(
            `Rate ${rate.id} invalid for package: ${validation.reasons.join(
              ', ',
            )}`,
          );
          continue;
        }

        // Filter by service type if specified
        if (
          request.serviceTypes &&
          !request.serviceTypes.includes(
            this.convertRateTypeToServiceType(rate.rateType),
          )
        ) {
          continue;
        }

        // Calculate costs
        const costCalculation = rate.calculateShippingCost(
          request.packageInfo.weight,
          rate.distanceKm,
          request.includeInsurance ? request.packageInfo.value : undefined,
        );

        // Add COD fee if requested
        if (request.isCod && rate.isCodAvailable) {
          costCalculation.totalCost += rate.codFee;
        }

        const quote: ShippingQuote = {
          carrierId: rate.carrierId,
          carrierName: rate.carrierName,
          serviceCode: rate.serviceCode,
          serviceName: rate.serviceName,
          serviceType: this.convertRateTypeToServiceType(rate.rateType),
          cost: costCalculation,
          timeframe: {
            estimatedDays: rate.estimatedDays,
            minDays: rate.minDays,
            maxDays: rate.maxDays,
            estimatedDeliveryDate: rate.getEstimatedDeliveryDate(pickupDate),
          },
          features: {
            isCodAvailable: rate.isCodAvailable && !!request.isCod,
            isInsuranceAvailable: rate.isInsuranceAvailable,
            requiresSignature: rate.requiresSignature,
            trackingAvailable: rate.features?.trackingAvailable || true,
            sameDay: rate.features?.sameDay,
            nextDay: rate.features?.nextDay,
          },
          restrictions:
            validation.reasons.length > 0 ? validation.reasons : undefined,
          rateId: rate.id,
        };

        quotes.push(quote);
      }

      // Sort quotes by total cost
      quotes.sort((a, b) => a.cost.totalCost - b.cost.totalCost);

      this.logger.debug(`Found ${quotes.length} shipping quotes`);
      return quotes;
    } catch (error) {
      this.logger.error(
        `Failed to get shipping quotes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create shipping label for an order
   */
  async createShippingLabel(
    tenantId: string,
    request: CreateShippingLabelRequest,
  ): Promise<ShippingLabel> {
    try {
      this.logger.debug(`Creating shipping label for order ${request.orderId}`);

      // Validate order exists and can be shipped
      const order = await this.ordersService.getOrderById(
        tenantId,
        request.orderId,
      );
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (
        ![OrderStatus.CONFIRMED, OrderStatus.PROCESSING].includes(order.status)
      ) {
        throw new BadRequestException('Order is not ready for shipping');
      }

      // Check if shipping label already exists
      const existingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, orderId: request.orderId },
      });

      if (existingLabel && existingLabel.isActive) {
        throw new BadRequestException(
          'Shipping label already exists for this order',
        );
      }

      // Get shipping rate
      const rate = await this.shippingRateRepository.findOne({
        where: { tenantId, id: request.rateId },
      });

      if (!rate) {
        throw new NotFoundException('Shipping rate not found');
      }

      // Create shipping label
      const shippingLabel = new ShippingLabel();
      shippingLabel.tenantId = tenantId;
      shippingLabel.orderId = request.orderId;
      shippingLabel.carrierId = rate.carrierId;
      shippingLabel.carrierName = rate.carrierName;
      shippingLabel.serviceType = request.serviceType;
      shippingLabel.serviceCode = rate.serviceCode;
      shippingLabel.serviceName = rate.serviceName;
      shippingLabel.status = ShippingLabelStatus.DRAFT;

      // Set addresses
      shippingLabel.senderAddress = request.senderAddress;
      shippingLabel.recipientAddress = {
        name: order.customerName,
        address: order.shippingAddress.address,
        district: order.shippingAddress.address, // Extract district if available
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        postalCode: order.shippingAddress.postalCode,
        phone: order.customerPhone || order.shippingAddress.phone,
        email: order.customerEmail,
        notes: order.shippingAddress.notes,
      };

      // Set package information
      shippingLabel.packageInfo = request.packageInfo;

      // Calculate costs
      const costCalculation = rate.calculateShippingCost(
        request.packageInfo.weight,
        rate.distanceKm,
        request.insuredValue,
      );

      shippingLabel.shippingCost =
        costCalculation.baseCost +
        costCalculation.weightCost +
        costCalculation.distanceCost;
      shippingLabel.insuranceCost = costCalculation.insuranceCost;
      shippingLabel.adminFee = costCalculation.adminFee;
      shippingLabel.codAmount = request.codAmount || 0;
      shippingLabel.totalCost = costCalculation.totalCost;

      // Set insurance
      shippingLabel.insuranceType = request.insuranceType || InsuranceType.NONE;
      shippingLabel.insuredValue = request.insuredValue;

      // Set service features
      shippingLabel.isCod = request.isCod || false;
      shippingLabel.requiresSignature =
        request.requiresSignature || rate.requiresSignature;
      shippingLabel.isFragile = request.isFragile || false;

      // Set delivery estimates
      const pickupDate = new Date();
      shippingLabel.estimatedPickupDate = pickupDate;
      shippingLabel.estimatedDeliveryDate =
        rate.getEstimatedDeliveryDate(pickupDate);

      // Additional fields
      shippingLabel.notes = request.notes;
      shippingLabel.createdBy = tenantId; // TODO: Get actual user ID

      // Save shipping label
      const savedLabel = await this.shippingLabelRepository.save(shippingLabel);

      // Update order with shipping information
      await this.ordersService.updateOrder(tenantId, request.orderId, {
        shippingCarrier: rate.carrierName,
        shippingMethod: rate.serviceName,
        shippingAmount: costCalculation.totalCost,
        estimatedDeliveryDate: shippingLabel.estimatedDeliveryDate,
        fulfillmentStatus: FulfillmentStatus.PROCESSING,
      });

      // Log the creation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SHIPPING,
        level: IntegrationLogLevel.INFO,
        message: `Shipping label created for order ${order.orderNumber}`,
        metadata: {
          orderId: request.orderId,
          shippingLabelId: savedLabel.id,
          carrier: rate.carrierName,
          service: rate.serviceName,
          totalCost: costCalculation.totalCost,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.label.created', {
        tenantId,
        order,
        shippingLabel: savedLabel,
      });

      return savedLabel;
    } catch (error) {
      this.logger.error(
        `Failed to create shipping label: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate shipping label (call carrier API)
   */
  async generateShippingLabel(
    tenantId: string,
    shippingLabelId: string,
  ): Promise<ShippingLabel> {
    try {
      this.logger.debug(`Generating shipping label ${shippingLabelId}`);

      const shippingLabel = await this.getShippingLabelById(
        tenantId,
        shippingLabelId,
      );

      if (shippingLabel.status !== ShippingLabelStatus.DRAFT) {
        throw new BadRequestException('Shipping label is not in draft status');
      }

      // TODO: Call carrier API to generate label and get tracking number
      // This would be implemented in carrier-specific services (JNE, J&T, etc.)

      // For now, simulate label generation
      const trackingNumber = this.generateTrackingNumber(
        shippingLabel.carrierId,
      );

      shippingLabel.trackingNumber = trackingNumber;
      shippingLabel.status = ShippingLabelStatus.GENERATED;
      shippingLabel.generatedAt = new Date();

      // Simulate label URL (would be returned by carrier API)
      shippingLabel.labelUrl = `https://api.carrier.com/labels/${trackingNumber}.pdf`;
      shippingLabel.labelFormat = 'PDF';

      const updatedLabel = await this.shippingLabelRepository.save(
        shippingLabel,
      );

      // Create initial tracking entry
      await this.createTrackingEntry(tenantId, {
        shippingLabelId,
        trackingNumber,
        status: TrackingStatus.ORDER_CONFIRMED,
        description: 'Shipping label generated and order confirmed',
        eventTime: new Date(),
      });

      // Update order with tracking number
      await this.ordersService.updateOrder(tenantId, shippingLabel.orderId, {
        trackingNumber,
      });

      // Log generation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SHIPPING,
        level: IntegrationLogLevel.INFO,
        message: `Shipping label generated: ${trackingNumber}`,
        metadata: {
          shippingLabelId,
          trackingNumber,
          carrier: shippingLabel.carrierName,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.label.generated', {
        tenantId,
        shippingLabel: updatedLabel,
      });

      return updatedLabel;
    } catch (error) {
      this.logger.error(
        `Failed to generate shipping label: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get shipping label by ID
   */
  async getShippingLabelById(
    tenantId: string,
    shippingLabelId: string,
  ): Promise<ShippingLabel> {
    const shippingLabel = await this.shippingLabelRepository.findOne({
      where: { tenantId, id: shippingLabelId },
      relations: ['order'],
    });

    if (!shippingLabel) {
      throw new NotFoundException('Shipping label not found');
    }

    return shippingLabel;
  }

  /**
   * Get shipping labels for an order
   */
  async getShippingLabelsByOrder(
    tenantId: string,
    orderId: string,
  ): Promise<ShippingLabel[]> {
    return this.shippingLabelRepository.find({
      where: { tenantId, orderId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update tracking information
   */
  async updateTracking(
    tenantId: string,
    updates: TrackingUpdate[],
  ): Promise<void> {
    try {
      this.logger.debug(`Updating tracking for ${updates.length} packages`);

      for (const update of updates) {
        await this.createTrackingEntry(tenantId, {
          trackingNumber: update.trackingNumber,
          status: update.status,
          description: update.description,
          location: update.location,
          eventTime: update.eventTime,
          additionalData: update.additionalData,
        });

        // Update shipping label status if needed
        await this.updateShippingLabelFromTracking(tenantId, update);
      }
    } catch (error) {
      this.logger.error(
        `Failed to update tracking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get tracking history for a package
   */
  async getTrackingHistory(
    tenantId: string,
    trackingNumber: string,
  ): Promise<ShippingTracking[]> {
    return this.shippingTrackingRepository.find({
      where: { tenantId, trackingNumber },
      order: { eventTime: 'DESC', sequence: 'DESC' },
    });
  }

  /**
   * Get shipping analytics
   */
  async getShippingAnalytics(
    tenantId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<ShippingAnalytics> {
    try {
      this.logger.debug(`Getting shipping analytics for tenant ${tenantId}`);

      const whereClause: any = { tenantId };
      if (dateRange) {
        whereClause.createdAt = Between(dateRange.from, dateRange.to);
      }

      const shipments = await this.shippingLabelRepository.find({
        where: whereClause,
        relations: ['order'],
      });

      // Calculate summary metrics
      const totalShipments = shipments.length;
      const totalCost = shipments.reduce(
        (sum, s) => sum + Number(s.totalCost),
        0,
      );
      const averageCost = totalShipments > 0 ? totalCost / totalShipments : 0;

      const deliveredShipments = shipments.filter(
        s => s.status === ShippingLabelStatus.SHIPPED,
      ).length;
      const pendingShipments = shipments.filter(s =>
        [
          ShippingLabelStatus.DRAFT,
          ShippingLabelStatus.GENERATED,
          ShippingLabelStatus.PRINTED,
        ].includes(s.status),
      ).length;

      // On-time delivery calculation (simplified)
      const onTimeDeliveryRate =
        deliveredShipments > 0
          ? ((deliveredShipments * 0.95) / deliveredShipments) * 100
          : 0; // Simulate 95% on-time rate

      // Carrier performance
      const carrierPerformance = this.calculateCarrierPerformance(shipments);

      // Trends (simplified)
      const trends = {
        daily: this.calculateDailyTrends(shipments),
        serviceTypes: this.calculateServiceTypeTrends(shipments),
      };

      return {
        summary: {
          totalShipments,
          totalCost,
          averageCost,
          onTimeDeliveryRate,
          deliveredShipments,
          pendingShipments,
          delayedShipments: 0, // Would calculate from tracking data
        },
        carrierPerformance,
        trends,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get shipping analytics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private async createTrackingEntry(
    tenantId: string,
    data: {
      shippingLabelId?: string;
      trackingNumber: string;
      status: TrackingStatus;
      description: string;
      location?: any;
      eventTime: Date;
      additionalData?: any;
    },
  ): Promise<ShippingTracking> {
    let shippingLabelId = data.shippingLabelId;

    // Find shipping label if not provided
    if (!shippingLabelId) {
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber: data.trackingNumber },
      });
      shippingLabelId = shippingLabel?.id;
    }

    if (!shippingLabelId) {
      throw new NotFoundException(
        `Shipping label not found for tracking number: ${data.trackingNumber}`,
      );
    }

    // Get sequence number
    const lastTracking = await this.shippingTrackingRepository.findOne({
      where: { tenantId, trackingNumber: data.trackingNumber },
      order: { sequence: 'DESC' },
    });

    const tracking = new ShippingTracking();
    tracking.tenantId = tenantId;
    tracking.shippingLabelId = shippingLabelId;
    tracking.trackingNumber = data.trackingNumber;
    tracking.status = data.status;
    tracking.description = data.description;
    tracking.eventTime = data.eventTime;
    tracking.location = data.location;
    tracking.additionalData = data.additionalData;
    tracking.sequence = (lastTracking?.sequence || 0) + 1;

    // Set carrier info
    const shippingLabel = await this.shippingLabelRepository.findOne({
      where: { id: shippingLabelId },
    });
    if (shippingLabel) {
      tracking.carrierId = shippingLabel.carrierId;
      tracking.carrierName = shippingLabel.carrierName;
    }

    return this.shippingTrackingRepository.save(tracking);
  }

  private async updateShippingLabelFromTracking(
    tenantId: string,
    update: TrackingUpdate,
  ): Promise<void> {
    const shippingLabel = await this.shippingLabelRepository.findOne({
      where: { tenantId, trackingNumber: update.trackingNumber },
    });

    if (!shippingLabel) return;

    // Update shipping label status based on tracking status
    let newStatus: ShippingLabelStatus | undefined;
    let statusTimestamp: Date | undefined;

    switch (update.status) {
      case TrackingStatus.PICKED_UP:
        newStatus = ShippingLabelStatus.SHIPPED;
        statusTimestamp = update.eventTime;
        shippingLabel.actualPickupDate = update.eventTime;
        break;
      case TrackingStatus.DELIVERED:
      case TrackingStatus.SUDAH_DITERIMA:
        shippingLabel.actualDeliveryDate = update.eventTime;
        break;
    }

    if (newStatus) {
      shippingLabel.updateStatus(newStatus, undefined);
    }

    await this.shippingLabelRepository.save(shippingLabel);

    // Update order status if delivered
    if (update.status === TrackingStatus.DELIVERED) {
      await this.ordersService.updateOrder(tenantId, shippingLabel.orderId, {
        status: OrderStatus.DELIVERED,
        fulfillmentStatus: FulfillmentStatus.DELIVERED,
        deliveredAt: update.eventTime,
      });
    }
  }

  private generateTrackingNumber(carrierId: string): string {
    // Generate a mock tracking number
    const prefix = carrierId.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  private calculateCarrierPerformance(
    shipments: ShippingLabel[],
  ): ShippingAnalytics['carrierPerformance'] {
    const carrierStats = shipments.reduce((acc, shipment) => {
      const carrierId = shipment.carrierId;
      if (!acc[carrierId]) {
        acc[carrierId] = {
          carrierId,
          carrierName: shipment.carrierName,
          shipments: [],
          totalCost: 0,
        };
      }
      acc[carrierId].shipments.push(shipment);
      acc[carrierId].totalCost += Number(shipment.totalCost);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(carrierStats).map(stats => ({
      carrierId: stats.carrierId,
      carrierName: stats.carrierName,
      shipmentCount: stats.shipments.length,
      totalCost: stats.totalCost,
      averageCost: stats.totalCost / stats.shipments.length,
      onTimeRate: 95, // Simplified
      averageDeliveryDays: 3, // Simplified
    }));
  }

  private calculateDailyTrends(
    shipments: ShippingLabel[],
  ): ShippingAnalytics['trends']['daily'] {
    // Simplified daily trends calculation
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      date,
      shipments: Math.floor(Math.random() * 20), // Mock data
      cost: Math.floor(Math.random() * 1000000),
      onTimeRate: 90 + Math.random() * 10,
    }));
  }

  private calculateServiceTypeTrends(
    shipments: ShippingLabel[],
  ): ShippingAnalytics['trends']['serviceTypes'] {
    return shipments.reduce((acc, shipment) => {
      const serviceType = shipment.serviceType;
      if (!acc[serviceType]) {
        acc[serviceType] = { count: 0, totalCost: 0, onTimeRate: 95 };
      }
      acc[serviceType].count++;
      acc[serviceType].totalCost += Number(shipment.totalCost);
      return acc;
    }, {} as Record<ShippingServiceType, any>);
  }

  /**
   * Convert RateType to ShippingServiceType
   */
  private convertRateTypeToServiceType(
    rateType: RateType,
  ): ShippingServiceType {
    const mapping: Record<RateType, ShippingServiceType> = {
      [RateType.STANDARD]: ShippingServiceType.REGULAR,
      [RateType.EXPRESS]: ShippingServiceType.EXPRESS,
      [RateType.ECONOMY]: ShippingServiceType.REGULAR,
      [RateType.PREMIUM]: ShippingServiceType.EXPRESS,
      [RateType.SAME_DAY]: ShippingServiceType.SAME_DAY,
      [RateType.NEXT_DAY]: ShippingServiceType.NEXT_DAY,
      [RateType.INSTANT]: ShippingServiceType.INSTANT,
    };

    return mapping[rateType] || ShippingServiceType.REGULAR;
  }
}
