import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { ShippingLabel, ShippingServiceType, ShippingLabelStatus } from '../../../entities/shipping-label.entity';
import { ShippingTracking, TrackingStatus } from '../../../entities/shipping-tracking.entity';
import { ShippingRate, RateType } from '../../../entities/shipping-rate.entity';

// Services
import { GojekApiService, GojekCredentials, GojekDeliveryRequest, GojekPriceEstimateRequest } from './gojek-api.service';
import { IntegrationLogService } from '../../../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../../../integrations/entities/integration-log.entity';

// Interfaces
export interface GojekShippingQuote {
  carrierId: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  serviceType: ShippingServiceType;
  cost: {
    baseCost: number;
    serviceFee: number;
    insuranceFee: number;
    totalCost: number;
  };
  timeframe: {
    estimatedMinutes: number;
    estimatedDeliveryTime: Date;
  };
  features: {
    isInstant: boolean;
    isInsured: boolean;
    trackingAvailable: boolean;
    codAvailable: boolean;
  };
}

export interface GojekShipmentRequest {
  orderId: string;
  pickup: {
    name: string;
    phone: string;
    address: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  };
  delivery: {
    name: string;
    phone: string;
    address: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  };
  package: {
    weight: number;
    length: number;
    width: number;
    height: number;
    description: string;
    value: number;
    quantity: number;
  };
  serviceType: 'instant' | 'same_day' | 'next_day';
  paymentMethod: 'cash' | 'gopay' | 'corporate';
  isCod?: boolean;
  codAmount?: number;
  scheduledPickupTime?: Date;
  specialInstructions?: string[];
}

@Injectable()
export class GojekShippingService {
  private readonly logger = new Logger(GojekShippingService.name);

  constructor(
    @InjectRepository(ShippingLabel)
    private readonly shippingLabelRepository: Repository<ShippingLabel>,
    @InjectRepository(ShippingTracking)
    private readonly shippingTrackingRepository: Repository<ShippingTracking>,
    @InjectRepository(ShippingRate)
    private readonly shippingRateRepository: Repository<ShippingRate>,

    // Services
    private readonly gojekApiService: GojekApiService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get Gojek credentials for tenant
   */
  private async getGojekCredentials(tenantId: string): Promise<GojekCredentials> {
    // In a real implementation, this would fetch from tenant configuration
    // For now, return mock credentials
    return {
      clientId: process.env.GOJEK_CLIENT_ID || 'test_client_id',
      clientSecret: process.env.GOJEK_CLIENT_SECRET || 'test_client_secret',
      apiKey: process.env.GOJEK_API_KEY || 'test_api_key',
      merchantId: process.env.GOJEK_MERCHANT_ID || 'test_merchant_id',
      isSandbox: process.env.NODE_ENV !== 'production',
    };
  }

  /**
   * Test Gojek API connection
   */
  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      const credentials = await this.getGojekCredentials(tenantId);
      const response = await this.gojekApiService.testConnection(
        credentials,
        tenantId,
        'gojek_test',
      );

      if (response.success) {
        await this.logService.log({
          tenantId,
          type: IntegrationLogType.INSTANT_DELIVERY,
          level: IntegrationLogLevel.INFO,
          message: 'Gojek API connection test successful',
          metadata: { response: response.data },
        });

        return { success: true, message: 'Gojek API connection successful' };
      } else {
        throw new Error(response.error?.message || 'Connection test failed');
      }
    } catch (error) {
      this.logger.error(`Gojek connection test failed: ${error.message}`, error.stack);
      
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY,
        level: IntegrationLogLevel.ERROR,
        message: `Gojek API connection test failed: ${error.message}`,
        metadata: { error: error.message },
      });

      return { success: false, message: error.message };
    }
  }

  /**
   * Get shipping quotes from Gojek
   */
  async getShippingQuotes(
    tenantId: string,
    request: {
      pickup: { latitude: number; longitude: number };
      delivery: { latitude: number; longitude: number };
      package: { weight: number; value: number };
      serviceTypes?: string[];
    }
  ): Promise<GojekShippingQuote[]> {
    try {
      this.logger.debug(`Getting Gojek shipping quotes for tenant ${tenantId}`);

      const credentials = await this.getGojekCredentials(tenantId);
      const quotes: GojekShippingQuote[] = [];

      // Get price estimates for different service types
      const serviceTypes = request.serviceTypes || ['instant', 'same_day', 'next_day'];

      for (const serviceType of serviceTypes) {
        try {
          const priceRequest: GojekPriceEstimateRequest = {
            pickupLatitude: request.pickup.latitude,
            pickupLongitude: request.pickup.longitude,
            dropoffLatitude: request.delivery.latitude,
            dropoffLongitude: request.delivery.longitude,
            serviceType: serviceType as 'instant' | 'same_day' | 'next_day',
            packageWeight: request.package.weight,
            packageValue: request.package.value,
          };

          const response = await this.gojekApiService.getPriceEstimate(
            credentials,
            priceRequest,
            tenantId,
            'gojek_quotes',
          );

          if (response.success && response.data) {
            const estimatedDeliveryTime = new Date();
            estimatedDeliveryTime.setMinutes(
              estimatedDeliveryTime.getMinutes() + response.data.data.estimatedDuration
            );

            const quote: GojekShippingQuote = {
              carrierId: 'gojek',
              carrierName: 'Gojek',
              serviceCode: serviceType.toUpperCase(),
              serviceName: this.getServiceName(serviceType),
              serviceType: this.mapServiceTypeToShippingServiceType(serviceType),
              cost: {
                baseCost: response.data.data.priceBreakdown.baseFare,
                serviceFee: response.data.data.priceBreakdown.serviceFee,
                insuranceFee: response.data.data.priceBreakdown.insuranceFee,
                totalCost: response.data.data.totalFee,
              },
              timeframe: {
                estimatedMinutes: response.data.data.estimatedDuration,
                estimatedDeliveryTime,
              },
              features: {
                isInstant: serviceType === 'instant',
                isInsured: true,
                trackingAvailable: true,
                codAvailable: serviceType !== 'instant', // Instant usually doesn't support COD
              },
            };

            quotes.push(quote);
          }
        } catch (serviceError) {
          this.logger.warn(`Failed to get quote for service type ${serviceType}: ${serviceError.message}`);
        }
      }

      // Sort quotes by total cost
      quotes.sort((a, b) => a.cost.totalCost - b.cost.totalCost);

      this.logger.debug(`Found ${quotes.length} Gojek shipping quotes`);
      return quotes;

    } catch (error) {
      this.logger.error(`Failed to get Gojek shipping quotes: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create shipping shipment with Gojek
   */
  async createShipment(
    tenantId: string,
    request: GojekShipmentRequest
  ): Promise<ShippingLabel> {
    try {
      this.logger.debug(`Creating Gojek shipment for order ${request.orderId}`);

      const credentials = await this.getGojekCredentials(tenantId);

      // Prepare delivery request
      const deliveryRequest: GojekDeliveryRequest = {
        pickup: {
          name: request.pickup.name,
          phone: request.pickup.phone,
          address: request.pickup.address,
          district: request.pickup.district,
          city: request.pickup.city,
          state: request.pickup.state,
          postalCode: request.pickup.postalCode,
          latitude: request.pickup.latitude,
          longitude: request.pickup.longitude,
          notes: request.pickup.notes,
        },
        dropoff: {
          name: request.delivery.name,
          phone: request.delivery.phone,
          address: request.delivery.address,
          district: request.delivery.district,
          city: request.delivery.city,
          state: request.delivery.state,
          postalCode: request.delivery.postalCode,
          latitude: request.delivery.latitude,
          longitude: request.delivery.longitude,
          notes: request.delivery.notes,
        },
        package: request.package,
        serviceType: request.serviceType,
        paymentMethod: request.paymentMethod,
        isCod: request.isCod,
        codAmount: request.codAmount,
        scheduledPickupTime: request.scheduledPickupTime?.toISOString(),
        specialInstructions: request.specialInstructions,
      };

      // Call Gojek API to create delivery
      const response = await this.gojekApiService.createDelivery(
        credentials,
        deliveryRequest,
        tenantId,
        'gojek_shipment',
      );

      if (!response.success || !response.data) {
        throw new BadRequestException(
          response.error?.message || 'Failed to create Gojek delivery'
        );
      }

      // Create shipping label in our system
      const shippingLabel = new ShippingLabel();
      shippingLabel.tenantId = tenantId;
      shippingLabel.orderId = request.orderId;
      shippingLabel.carrierId = 'gojek';
      shippingLabel.carrierName = 'Gojek';
      shippingLabel.serviceType = this.mapServiceTypeToShippingServiceType(request.serviceType);
      shippingLabel.serviceCode = request.serviceType.toUpperCase();
      shippingLabel.serviceName = this.getServiceName(request.serviceType);
      shippingLabel.status = ShippingLabelStatus.GENERATED;

      // Set external tracking info
      shippingLabel.trackingNumber = response.data.data.trackingNumber;
      shippingLabel.apiData = {
        externalId: response.data.data.orderId,
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'synced',
        rawResponse: response.data,
      };
      shippingLabel.labelUrl = `gojek://track/${response.data.data.trackingNumber}`;

      // Set addresses
      shippingLabel.senderAddress = request.pickup;
      shippingLabel.recipientAddress = request.delivery;

      // Set package info
      shippingLabel.packageInfo = {
        weight: request.package.weight,
        length: request.package.length,
        width: request.package.width,
        height: request.package.height,
        content: request.package.description,
        pieces: request.package.quantity,
      };

      // Set costs
      shippingLabel.shippingCost = response.data.data.totalFee;
      shippingLabel.totalCost = response.data.data.totalFee;
      shippingLabel.codAmount = request.codAmount || 0;

      // Set delivery estimates
      const now = new Date();
      shippingLabel.estimatedPickupDate = new Date(response.data.data.estimatedPickupTime);
      shippingLabel.estimatedDeliveryDate = new Date(response.data.data.estimatedDeliveryTime);
      shippingLabel.generatedAt = now;

      // Additional Gojek-specific fields
      shippingLabel.carrierData = {
        gojekOrderId: response.data.data.orderId,
        driverId: response.data.data.driverId,
        driverName: response.data.data.driverName,
        driverPhone: response.data.data.driverPhone,
        vehicleType: response.data.data.vehicleType,
        paymentStatus: response.data.data.paymentStatus,
      };

      // Save shipping label
      const savedLabel = await this.shippingLabelRepository.save(shippingLabel);

      // Create initial tracking entry
      await this.createTrackingEntry(tenantId, {
        shippingLabelId: savedLabel.id,
        trackingNumber: response.data.data.trackingNumber,
        status: TrackingStatus.ORDER_CONFIRMED,
        description: 'Gojek delivery order created and confirmed',
        eventTime: now,
        additionalData: {
          gojekOrderId: response.data.data.orderId,
          status: response.data.data.status,
        },
      });

      // Log the creation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY,
        level: IntegrationLogLevel.INFO,
        message: `Gojek shipment created for order ${request.orderId}`,
        metadata: {
          orderId: request.orderId,
          shippingLabelId: savedLabel.id,
          gojekOrderId: response.data.data.orderId,
          trackingNumber: response.data.data.trackingNumber,
          totalCost: response.data.data.totalFee,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.gojek.shipment.created', {
        tenantId,
        shippingLabel: savedLabel,
        gojekResponse: response.data,
      });

      return savedLabel;

    } catch (error) {
      this.logger.error(`Failed to create Gojek shipment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update tracking information from Gojek
   */
  async updateTracking(tenantId: string, trackingNumber: string): Promise<void> {
    try {
      this.logger.debug(`Updating Gojek tracking for ${trackingNumber}`);

      const credentials = await this.getGojekCredentials(tenantId);
      
      // Find shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber, carrierId: 'gojek' },
      });

      if (!shippingLabel) {
        throw new NotFoundException(`Shipping label not found for tracking number: ${trackingNumber}`);
      }

      // Get tracking info from Gojek
      const response = await this.gojekApiService.trackDelivery(
        credentials,
        shippingLabel.apiData?.externalId,
        tenantId,
        'gojek_tracking',
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to get Gojek tracking info');
      }

      const trackingData = this.gojekApiService.formatTrackingData(response.data);

      // Update shipping label with latest info
      if (trackingData.driverInfo) {
        shippingLabel.carrierData = {
          ...shippingLabel.carrierData,
          driverId: trackingData.driverInfo.id,
          driverName: trackingData.driverInfo.name,
          driverPhone: trackingData.driverInfo.phone,
          vehicleInfo: trackingData.driverInfo.vehicle,
          currentLocation: trackingData.currentLocation,
          estimatedArrival: trackingData.estimatedArrival,
        };
      }

      // Update status if needed
      const latestStatus = this.mapGojekStatusToLabelStatus(response.data.data.status);
      if (latestStatus !== shippingLabel.status) {
        shippingLabel.updateStatus(latestStatus, undefined);
      }

      await this.shippingLabelRepository.save(shippingLabel);

      // Create tracking entries for new events
      if (trackingData.timeline && trackingData.timeline.length > 0) {
        for (const event of trackingData.timeline) {
          // Check if this event already exists
          const existingTracking = await this.shippingTrackingRepository.findOne({
            where: {
              tenantId,
              trackingNumber,
              eventTime: new Date(event.timestamp),
              description: event.description,
            },
          });

          if (!existingTracking) {
            await this.createTrackingEntry(tenantId, {
              shippingLabelId: shippingLabel.id,
              trackingNumber,
              status: event.status,
              description: event.description,
              location: event.location,
              eventTime: new Date(event.timestamp),
              additionalData: {
                driverNotes: event.driverNotes,
                gojekStatus: response.data.data.status,
              },
            });
          }
        }
      }

      // Emit tracking update event
      this.eventEmitter.emit('shipping.gojek.tracking.updated', {
        tenantId,
        shippingLabel,
        trackingData,
      });

    } catch (error) {
      this.logger.error(`Failed to update Gojek tracking: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel Gojek delivery
   */
  async cancelDelivery(
    tenantId: string,
    trackingNumber: string,
    reason: string
  ): Promise<void> {
    try {
      this.logger.debug(`Cancelling Gojek delivery ${trackingNumber}`);

      const credentials = await this.getGojekCredentials(tenantId);
      
      // Find shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber, carrierId: 'gojek' },
      });

      if (!shippingLabel) {
        throw new NotFoundException(`Shipping label not found for tracking number: ${trackingNumber}`);
      }

      // Cancel with Gojek
      const response = await this.gojekApiService.cancelDelivery(
        credentials,
        shippingLabel.apiData?.externalId,
        reason,
        tenantId,
        'gojek_cancel',
      );

      if (!response.success) {
        throw new BadRequestException(
          response.error?.message || 'Failed to cancel Gojek delivery'
        );
      }

      // Update shipping label
      shippingLabel.updateStatus(ShippingLabelStatus.CANCELLED, undefined);
      shippingLabel.carrierData = {
        ...shippingLabel.carrierData,
        cancellationReason: reason,
        cancellationFee: response.data?.cancellationFee,
        cancelledAt: new Date().toISOString(),
      };

      await this.shippingLabelRepository.save(shippingLabel);

      // Create tracking entry
      await this.createTrackingEntry(tenantId, {
        shippingLabelId: shippingLabel.id,
        trackingNumber,
        status: TrackingStatus.CANCELLED,
        description: `Delivery cancelled: ${reason}`,
        eventTime: new Date(),
        additionalData: {
          cancellationReason: reason,
          cancellationFee: response.data?.cancellationFee,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.gojek.delivery.cancelled', {
        tenantId,
        shippingLabel,
        reason,
        cancellationFee: response.data?.cancellationFee,
      });

    } catch (error) {
      this.logger.error(`Failed to cancel Gojek delivery: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private async createTrackingEntry(tenantId: string, data: {
    shippingLabelId: string;
    trackingNumber: string;
    status: TrackingStatus | string;
    description: string;
    location?: any;
    eventTime: Date;
    additionalData?: any;
  }): Promise<ShippingTracking> {
    // Get sequence number
    const lastTracking = await this.shippingTrackingRepository.findOne({
      where: { tenantId, trackingNumber: data.trackingNumber },
      order: { sequence: 'DESC' },
    });

    const tracking = new ShippingTracking();
    tracking.tenantId = tenantId;
    tracking.shippingLabelId = data.shippingLabelId;
    tracking.trackingNumber = data.trackingNumber;
    tracking.carrierId = 'gojek';
    tracking.carrierName = 'Gojek';
    tracking.status = data.status as TrackingStatus;
    tracking.description = data.description;
    tracking.eventTime = data.eventTime;
    tracking.location = data.location;
    tracking.additionalData = data.additionalData;
    tracking.sequence = (lastTracking?.sequence || 0) + 1;

    return this.shippingTrackingRepository.save(tracking);
  }

  private getServiceName(serviceType: string): string {
    const serviceNames = {
      instant: 'Gojek Instant',
      same_day: 'Gojek Same Day',
      next_day: 'Gojek Next Day',
    };
    return serviceNames[serviceType] || `Gojek ${serviceType}`;
  }

  private mapServiceTypeToShippingServiceType(serviceType: string): ShippingServiceType {
    const mapping = {
      instant: ShippingServiceType.INSTANT,
      same_day: ShippingServiceType.SAME_DAY,
      next_day: ShippingServiceType.REGULAR,
    };
    return mapping[serviceType] || ShippingServiceType.REGULAR;
  }

  private mapGojekStatusToLabelStatus(gojekStatus: string): ShippingLabelStatus {
    const statusMapping = {
      ORDER_CREATED: ShippingLabelStatus.GENERATED,
      DRIVER_ASSIGNED: ShippingLabelStatus.PRINTED,
      PACKAGE_PICKED_UP: ShippingLabelStatus.SHIPPED,
      PACKAGE_DELIVERED: ShippingLabelStatus.SHIPPED,
      ORDER_CANCELLED: ShippingLabelStatus.CANCELLED,
    };
    return statusMapping[gojekStatus.toUpperCase()] || ShippingLabelStatus.GENERATED;
  }
}