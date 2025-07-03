import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { ShippingLabel, ShippingServiceType, ShippingLabelStatus } from '../../../entities/shipping-label.entity';
import { ShippingTracking, TrackingStatus } from '../../../entities/shipping-tracking.entity';
import { ShippingRate, RateType } from '../../../entities/shipping-rate.entity';

// Services
import { GrabApiService, GrabCredentials, GrabDeliveryRequest, GrabQuoteRequest } from './grab-api.service';
import { IntegrationLogService } from '../../../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../../../integrations/entities/integration-log.entity';

// Interfaces
export interface GrabShippingQuote {
  carrierId: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  serviceType: ShippingServiceType;
  cost: {
    baseCost: number;
    serviceFee: number;
    totalCost: number;
  };
  timeframe: {
    estimatedMinutes: number;
    estimatedPickupTime: Date;
    estimatedDeliveryTime: Date;
  };
  features: {
    isInstant: boolean;
    isInsured: boolean;
    trackingAvailable: boolean;
    codAvailable: boolean;
    scheduledDelivery: boolean;
  };
  distance: number;
}

export interface GrabShipmentRequest {
  orderId: string;
  serviceType: 'instant' | 'same_day' | 'express';
  origin: {
    address: string;
    keywords: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    contactPerson: {
      name: string;
      phoneNumber: string;
    };
    note?: string;
  };
  destination: {
    address: string;
    keywords: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    contactPerson: {
      name: string;
      phoneNumber: string;
    };
    note?: string;
  };
  packages: Array<{
    name: string;
    description: string;
    quantity: number;
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    value: number;
  }>;
  paymentMethod: 'CASHLESS' | 'CASH';
  codAmount?: number;
  scheduledAt?: Date;
  specialRequests?: string[];
}

@Injectable()
export class GrabShippingService {
  private readonly logger = new Logger(GrabShippingService.name);

  constructor(
    @InjectRepository(ShippingLabel)
    private readonly shippingLabelRepository: Repository<ShippingLabel>,
    @InjectRepository(ShippingTracking)
    private readonly shippingTrackingRepository: Repository<ShippingTracking>,
    @InjectRepository(ShippingRate)
    private readonly shippingRateRepository: Repository<ShippingRate>,

    // Services
    private readonly grabApiService: GrabApiService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get Grab credentials for tenant
   */
  private async getGrabCredentials(tenantId: string): Promise<GrabCredentials> {
    // In a real implementation, this would fetch from tenant configuration
    // For now, return mock credentials
    return {
      clientId: process.env.GRAB_CLIENT_ID || 'test_client_id',
      clientSecret: process.env.GRAB_CLIENT_SECRET || 'test_client_secret',
      merchantId: process.env.GRAB_MERCHANT_ID || 'test_merchant_id',
      isSandbox: process.env.NODE_ENV !== 'production',
    };
  }

  /**
   * Test Grab API connection
   */
  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      const credentials = await this.getGrabCredentials(tenantId);
      const response = await this.grabApiService.testConnection(
        credentials,
        tenantId,
        'grab_test',
      );

      if (response.success) {
        await this.logService.log({
          tenantId,
          type: IntegrationLogType.INSTANT_DELIVERY,
          level: IntegrationLogLevel.INFO,
          message: 'Grab API connection test successful',
          metadata: { response: response.data },
        });

        return { success: true, message: 'Grab API connection successful' };
      } else {
        throw new Error(response.error?.message || 'Connection test failed');
      }
    } catch (error) {
      this.logger.error(`Grab connection test failed: ${error.message}`, error.stack);
      
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY,
        level: IntegrationLogLevel.ERROR,
        message: `Grab API connection test failed: ${error.message}`,
        metadata: { error: error.message },
      });

      return { success: false, message: error.message };
    }
  }

  /**
   * Get shipping quotes from Grab
   */
  async getShippingQuotes(
    tenantId: string,
    request: {
      origin: { latitude: number; longitude: number };
      destination: { latitude: number; longitude: number };
      packages: Array<{
        weight: number;
        dimensions: { length: number; width: number; height: number };
      }>;
      serviceTypes?: string[];
    }
  ): Promise<GrabShippingQuote[]> {
    try {
      this.logger.debug(`Getting Grab shipping quotes for tenant ${tenantId}`);

      const credentials = await this.getGrabCredentials(tenantId);
      const quotes: GrabShippingQuote[] = [];

      // Get quotes for different service types
      const serviceTypes = request.serviceTypes || ['instant', 'same_day', 'express'];

      for (const serviceType of serviceTypes) {
        try {
          const quoteRequest: GrabQuoteRequest = {
            origin: request.origin,
            destination: request.destination,
            serviceType: serviceType as 'instant' | 'same_day' | 'express',
            packages: request.packages,
          };

          const response = await this.grabApiService.getDeliveryQuote(
            credentials,
            quoteRequest,
            tenantId,
            'grab_quotes',
          );

          if (response.success && response.data?.quotes) {
            for (const quoteData of response.data.quotes) {
              const estimatedPickupTime = new Date(quoteData.estimatedPickupTime);
              const estimatedDeliveryTime = new Date(quoteData.estimatedDeliveryTime);
              const estimatedMinutes = Math.round(
                (estimatedDeliveryTime.getTime() - estimatedPickupTime.getTime()) / (1000 * 60)
              );

              const quote: GrabShippingQuote = {
                carrierId: 'grab',
                carrierName: 'Grab',
                serviceCode: serviceType.toUpperCase(),
                serviceName: this.getServiceName(serviceType),
                serviceType: this.mapServiceTypeToShippingServiceType(serviceType),
                cost: {
                  baseCost: quoteData.amount,
                  serviceFee: Math.round(quoteData.amount * 0.1), // Estimate 10% service fee
                  totalCost: quoteData.amount,
                },
                timeframe: {
                  estimatedMinutes,
                  estimatedPickupTime,
                  estimatedDeliveryTime,
                },
                features: {
                  isInstant: serviceType === 'instant',
                  isInsured: true,
                  trackingAvailable: true,
                  codAvailable: serviceType !== 'instant',
                  scheduledDelivery: serviceType !== 'instant',
                },
                distance: quoteData.distance,
              };

              quotes.push(quote);
            }
          }
        } catch (serviceError) {
          this.logger.warn(`Failed to get quote for service type ${serviceType}: ${serviceError.message}`);
        }
      }

      // Sort quotes by total cost
      quotes.sort((a, b) => a.cost.totalCost - b.cost.totalCost);

      this.logger.debug(`Found ${quotes.length} Grab shipping quotes`);
      return quotes;

    } catch (error) {
      this.logger.error(`Failed to get Grab shipping quotes: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create shipping shipment with Grab
   */
  async createShipment(
    tenantId: string,
    request: GrabShipmentRequest
  ): Promise<ShippingLabel> {
    try {
      this.logger.debug(`Creating Grab shipment for order ${request.orderId}`);

      const credentials = await this.getGrabCredentials(tenantId);

      // Prepare delivery request
      const deliveryRequest: GrabDeliveryRequest = {
        serviceType: request.serviceType,
        origin: request.origin,
        destination: request.destination,
        packages: request.packages,
        paymentMethod: request.paymentMethod,
        cashOnDelivery: request.codAmount ? {
          amount: request.codAmount,
        } : undefined,
        scheduledAt: request.scheduledAt?.toISOString(),
        specialRequests: request.specialRequests,
      };

      // Call Grab API to create delivery
      const response = await this.grabApiService.createDelivery(
        credentials,
        deliveryRequest,
        tenantId,
        'grab_shipment',
      );

      if (!response.success || !response.data) {
        throw new BadRequestException(
          response.error?.message || 'Failed to create Grab delivery'
        );
      }

      // Create shipping label in our system
      const shippingLabel = new ShippingLabel();
      shippingLabel.tenantId = tenantId;
      shippingLabel.orderId = request.orderId;
      shippingLabel.carrierId = 'grab';
      shippingLabel.carrierName = 'Grab';
      shippingLabel.serviceType = this.mapServiceTypeToShippingServiceType(request.serviceType);
      shippingLabel.serviceCode = request.serviceType.toUpperCase();
      shippingLabel.serviceName = this.getServiceName(request.serviceType);
      shippingLabel.status = ShippingLabelStatus.GENERATED;

      // Set external tracking info
      shippingLabel.trackingNumber = response.data.deliveryID;
      shippingLabel.labelUrl = response.data.trackingURL;
      shippingLabel.apiData = {
        externalId: response.data.deliveryID,
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'synced',
        rawResponse: response.data,
      };

      // Set addresses
      shippingLabel.senderAddress = {
        name: request.origin.contactPerson.name,
        address: request.origin.address,
        district: 'Unknown', // Grab doesn't provide district
        city: 'Jakarta', // Default city
        state: 'DKI Jakarta', // Default province
        postalCode: '10000', // Default postal code
        phone: request.origin.contactPerson.phoneNumber,
        email: undefined,
      };
      shippingLabel.recipientAddress = {
        name: request.destination.contactPerson.name,
        address: request.destination.address,
        district: 'Unknown', // Grab doesn't provide district
        city: 'Jakarta', // Default city
        state: 'DKI Jakarta', // Default province
        postalCode: '10000', // Default postal code
        phone: request.destination.contactPerson.phoneNumber,
        email: undefined,
        notes: request.destination.note,
      };

      // Set package info (combine all packages)
      const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
      const totalValue = request.packages.reduce((sum, pkg) => sum + pkg.value, 0);
      const totalQuantity = request.packages.reduce((sum, pkg) => sum + pkg.quantity, 0);

      shippingLabel.packageInfo = {
        weight: totalWeight,
        length: Math.max(...request.packages.map(p => p.dimensions.length)),
        width: Math.max(...request.packages.map(p => p.dimensions.width)),
        height: Math.max(...request.packages.map(p => p.dimensions.height)),
        content: request.packages.map(p => p.description).join(', '),
        pieces: totalQuantity,
      };

      // Set costs
      shippingLabel.shippingCost = response.data.fare.amount;
      shippingLabel.totalCost = response.data.fare.amount;
      shippingLabel.codAmount = request.codAmount || 0;

      // Set delivery estimates
      const now = new Date();
      shippingLabel.estimatedPickupDate = now;
      shippingLabel.estimatedDeliveryDate = now; // Will be updated when we get actual estimates
      shippingLabel.generatedAt = now;

      // Additional Grab-specific fields
      shippingLabel.carrierData = {
        grabDeliveryId: response.data.deliveryID,
        status: response.data.status,
        trackingUrl: response.data.trackingURL,
        driverDetails: response.data.driverDetails,
        quotes: response.data.quotes,
        fare: response.data.fare,
      };

      // Save shipping label
      const savedLabel = await this.shippingLabelRepository.save(shippingLabel);

      // Create initial tracking entry
      await this.createTrackingEntry(tenantId, {
        shippingLabelId: savedLabel.id,
        trackingNumber: response.data.deliveryID,
        status: TrackingStatus.ORDER_CONFIRMED,
        description: 'Grab delivery order created and confirmed',
        eventTime: now,
        additionalData: {
          grabDeliveryId: response.data.deliveryID,
          status: response.data.status,
          fare: response.data.fare,
        },
      });

      // Log the creation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY,
        level: IntegrationLogLevel.INFO,
        message: `Grab shipment created for order ${request.orderId}`,
        metadata: {
          orderId: request.orderId,
          shippingLabelId: savedLabel.id,
          grabDeliveryId: response.data.deliveryID,
          totalCost: response.data.fare.amount,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.grab.shipment.created', {
        tenantId,
        shippingLabel: savedLabel,
        grabResponse: response.data,
      });

      return savedLabel;

    } catch (error) {
      this.logger.error(`Failed to create Grab shipment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update tracking information from Grab
   */
  async updateTracking(tenantId: string, deliveryId: string): Promise<void> {
    try {
      this.logger.debug(`Updating Grab tracking for ${deliveryId}`);

      const credentials = await this.getGrabCredentials(tenantId);
      
      // Find shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber: deliveryId, carrierId: 'grab' },
      });

      if (!shippingLabel) {
        throw new NotFoundException(`Shipping label not found for delivery ID: ${deliveryId}`);
      }

      // Get tracking info from Grab
      const response = await this.grabApiService.trackDelivery(
        credentials,
        deliveryId,
        tenantId,
        'grab_tracking',
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to get Grab tracking info');
      }

      const trackingData = this.grabApiService.formatTrackingData(response.data);

      // Update shipping label with latest info
      if (trackingData.driverInfo) {
        shippingLabel.carrierData = {
          ...shippingLabel.carrierData,
          driverDetails: trackingData.driverInfo,
          currentLocation: trackingData.driverInfo.currentLocation,
        };
      }

      // Update schedule info
      if (trackingData.schedule) {
        shippingLabel.carrierData = {
          ...shippingLabel.carrierData,
          schedule: trackingData.schedule,
        };
      }

      // Update status if needed
      const latestStatus = this.mapGrabStatusToLabelStatus(response.data.status);
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
              trackingNumber: deliveryId,
              eventTime: new Date(event.timestamp),
              description: event.description,
            },
          });

          if (!existingTracking) {
            await this.createTrackingEntry(tenantId, {
              shippingLabelId: shippingLabel.id,
              trackingNumber: deliveryId,
              status: event.status,
              description: event.description,
              location: event.location,
              eventTime: new Date(event.timestamp),
              additionalData: {
                grabStatus: response.data.status,
                driverDetails: trackingData.driverInfo,
              },
            });
          }
        }
      }

      // Emit tracking update event
      this.eventEmitter.emit('shipping.grab.tracking.updated', {
        tenantId,
        shippingLabel,
        trackingData,
      });

    } catch (error) {
      this.logger.error(`Failed to update Grab tracking: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel Grab delivery
   */
  async cancelDelivery(
    tenantId: string,
    deliveryId: string,
    reason: string
  ): Promise<void> {
    try {
      this.logger.debug(`Cancelling Grab delivery ${deliveryId}`);

      const credentials = await this.getGrabCredentials(tenantId);
      
      // Find shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber: deliveryId, carrierId: 'grab' },
      });

      if (!shippingLabel) {
        throw new NotFoundException(`Shipping label not found for delivery ID: ${deliveryId}`);
      }

      // Cancel with Grab
      const response = await this.grabApiService.cancelDelivery(
        credentials,
        deliveryId,
        reason,
        tenantId,
        'grab_cancel',
      );

      if (!response.success) {
        throw new BadRequestException(
          response.error?.message || 'Failed to cancel Grab delivery'
        );
      }

      // Update shipping label
      shippingLabel.updateStatus(ShippingLabelStatus.CANCELLED, undefined);
      shippingLabel.carrierData = {
        ...shippingLabel.carrierData,
        cancellationReason: response.data?.cancellationReason,
        cancellationFee: response.data?.cancellationFee,
        cancelledAt: new Date().toISOString(),
      };

      await this.shippingLabelRepository.save(shippingLabel);

      // Create tracking entry
      await this.createTrackingEntry(tenantId, {
        shippingLabelId: shippingLabel.id,
        trackingNumber: deliveryId,
        status: TrackingStatus.CANCELLED,
        description: `Delivery cancelled: ${reason}`,
        eventTime: new Date(),
        additionalData: {
          cancellationReason: reason,
          cancellationFee: response.data?.cancellationFee,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.grab.delivery.cancelled', {
        tenantId,
        shippingLabel,
        reason,
        cancellationFee: response.data?.cancellationFee,
      });

    } catch (error) {
      this.logger.error(`Failed to cancel Grab delivery: ${error.message}`, error.stack);
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
    tracking.carrierId = 'grab';
    tracking.carrierName = 'Grab';
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
      instant: 'GrabExpress Instant',
      same_day: 'GrabExpress Same Day',
      express: 'GrabExpress Express',
    };
    return serviceNames[serviceType] || `Grab ${serviceType}`;
  }

  private mapServiceTypeToShippingServiceType(serviceType: string): ShippingServiceType {
    const mapping = {
      instant: ShippingServiceType.INSTANT,
      same_day: ShippingServiceType.SAME_DAY,
      express: ShippingServiceType.EXPRESS,
    };
    return mapping[serviceType] || ShippingServiceType.REGULAR;
  }

  private mapGrabStatusToLabelStatus(grabStatus: string): ShippingLabelStatus {
    const statusMapping = {
      ALLOCATING: ShippingLabelStatus.GENERATED,
      FINDING_DRIVER: ShippingLabelStatus.GENERATED,
      DRIVER_ASSIGNED: ShippingLabelStatus.PRINTED,
      PICKED_UP: ShippingLabelStatus.SHIPPED,
      DELIVERED: ShippingLabelStatus.SHIPPED,
      CANCELLED: ShippingLabelStatus.CANCELLED,
      FAILED: ShippingLabelStatus.CANCELLED,
    };
    return statusMapping[grabStatus.toUpperCase()] || ShippingLabelStatus.GENERATED;
  }
}