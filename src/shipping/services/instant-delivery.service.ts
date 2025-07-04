import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Services
import {
  GojekShippingService,
  GojekShippingQuote,
  GojekShipmentRequest,
} from '../integrations/gojek/services/gojek-shipping.service';
import {
  GrabShippingService,
  GrabShippingQuote,
  GrabShipmentRequest,
} from '../integrations/grab/services/grab-shipping.service';
import { ShippingService } from './shipping.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../integrations/entities/integration-log.entity';

// Entities
import {
  ShippingLabel,
  ShippingServiceType,
} from '../entities/shipping-label.entity';

// Interfaces
export interface InstantDeliveryQuoteRequest {
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
  };
  delivery: {
    latitude: number;
    longitude: number;
    address: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
  };
  package: {
    weight: number; // in grams
    length: number; // in cm
    width: number; // in cm
    height: number; // in cm
    value: number; // in IDR
    description: string;
  };
  serviceTypes?: ('instant' | 'same_day' | 'express')[];
  providers?: ('gojek' | 'grab')[];
}

export interface InstantDeliveryQuote {
  provider: 'gojek' | 'grab';
  carrierId: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  serviceType: ShippingServiceType;
  cost: {
    baseCost: number;
    serviceFee: number;
    insuranceFee?: number;
    totalCost: number;
  };
  timeframe: {
    estimatedMinutes: number;
    estimatedPickupTime?: Date;
    estimatedDeliveryTime: Date;
  };
  features: {
    isInstant: boolean;
    isInsured: boolean;
    trackingAvailable: boolean;
    codAvailable: boolean;
    scheduledDelivery?: boolean;
  };
  distance?: number;
  availability: {
    isServiceable: boolean;
    reason?: string;
  };
}

export interface InstantDeliveryRequest {
  orderId: string;
  provider: 'gojek' | 'grab';
  serviceType: 'instant' | 'same_day' | 'express';
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
    quantity?: number;
  };
  paymentMethod: 'cash' | 'cashless' | 'gopay' | 'corporate';
  isCod?: boolean;
  codAmount?: number;
  scheduledAt?: Date;
  specialInstructions?: string[];
}

@Injectable()
export class InstantDeliveryService {
  private readonly logger = new Logger(InstantDeliveryService.name);

  constructor(
    @InjectQueue('instant-delivery')
    private readonly instantDeliveryQueue: Queue,

    // Services
    private readonly gojekShippingService: GojekShippingService,
    private readonly grabShippingService: GrabShippingService,
    private readonly shippingService: ShippingService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get instant delivery quotes from all providers
   */
  async getInstantDeliveryQuotes(
    tenantId: string,
    request: InstantDeliveryQuoteRequest,
  ): Promise<InstantDeliveryQuote[]> {
    try {
      this.logger.debug(
        `Getting instant delivery quotes for tenant ${tenantId}`,
      );

      const allQuotes: InstantDeliveryQuote[] = [];
      const providers = request.providers || ['gojek', 'grab'];
      const serviceTypes = request.serviceTypes || ['instant', 'same_day'];

      // Get quotes from each provider in parallel
      const quotePromises = providers.map(async provider => {
        try {
          if (provider === 'gojek') {
            return await this.getGojekQuotes(tenantId, request, serviceTypes);
          } else if (provider === 'grab') {
            return await this.getGrabQuotes(tenantId, request, serviceTypes);
          }
          return [];
        } catch (error) {
          this.logger.warn(
            `Failed to get quotes from ${provider}: ${error.message}`,
          );
          return [];
        }
      });

      const providerQuotes = await Promise.all(quotePromises);

      // Flatten all quotes
      for (const quotes of providerQuotes) {
        allQuotes.push(...quotes);
      }

      // Sort quotes by total cost and availability
      allQuotes.sort((a, b) => {
        // Prioritize available services
        if (a.availability.isServiceable && !b.availability.isServiceable)
          return -1;
        if (!a.availability.isServiceable && b.availability.isServiceable)
          return 1;

        // Then sort by cost
        return a.cost.totalCost - b.cost.totalCost;
      });

      // Log the request
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY,
        level: IntegrationLogLevel.INFO,
        message: `Retrieved ${allQuotes.length} instant delivery quotes`,
        metadata: {
          providers,
          serviceTypes,
          quotesCount: allQuotes.length,
          availableQuotes: allQuotes.filter(q => q.availability.isServiceable)
            .length,
        },
      });

      return allQuotes;
    } catch (error) {
      this.logger.error(
        `Failed to get instant delivery quotes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create instant delivery shipment
   */
  async createInstantDelivery(
    tenantId: string,
    request: InstantDeliveryRequest,
  ): Promise<ShippingLabel> {
    try {
      this.logger.debug(
        `Creating instant delivery for order ${request.orderId} with ${request.provider}`,
      );

      let shippingLabel: ShippingLabel;

      if (request.provider === 'gojek') {
        shippingLabel = await this.createGojekDelivery(tenantId, request);
      } else if (request.provider === 'grab') {
        shippingLabel = await this.createGrabDelivery(tenantId, request);
      } else {
        throw new BadRequestException(
          `Unsupported instant delivery provider: ${request.provider}`,
        );
      }

      // Schedule tracking updates
      await this.scheduleTrackingUpdates(
        tenantId,
        shippingLabel.trackingNumber,
        request.provider,
      );

      // Log the creation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY,
        level: IntegrationLogLevel.INFO,
        message: `Instant delivery created for order ${request.orderId}`,
        metadata: {
          orderId: request.orderId,
          provider: request.provider,
          serviceType: request.serviceType,
          shippingLabelId: shippingLabel.id,
          trackingNumber: shippingLabel.trackingNumber,
          totalCost: shippingLabel.totalCost,
        },
      });

      // Emit event
      this.eventEmitter.emit('instant.delivery.created', {
        tenantId,
        shippingLabel,
        provider: request.provider,
        request,
      });

      return shippingLabel;
    } catch (error) {
      this.logger.error(
        `Failed to create instant delivery: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update tracking for instant delivery
   */
  async updateInstantDeliveryTracking(
    tenantId: string,
    trackingNumber: string,
    provider: 'gojek' | 'grab',
  ): Promise<void> {
    try {
      this.logger.debug(
        `Updating instant delivery tracking: ${trackingNumber} (${provider})`,
      );

      if (provider === 'gojek') {
        await this.gojekShippingService.updateTracking(
          tenantId,
          trackingNumber,
        );
      } else if (provider === 'grab') {
        await this.grabShippingService.updateTracking(tenantId, trackingNumber);
      } else {
        throw new BadRequestException(`Unsupported provider: ${provider}`);
      }

      // Emit tracking update event
      this.eventEmitter.emit('instant.delivery.tracking.updated', {
        tenantId,
        trackingNumber,
        provider,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update instant delivery tracking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cancel instant delivery
   */
  async cancelInstantDelivery(
    tenantId: string,
    trackingNumber: string,
    provider: 'gojek' | 'grab',
    reason: string,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Cancelling instant delivery: ${trackingNumber} (${provider})`,
      );

      if (provider === 'gojek') {
        await this.gojekShippingService.cancelDelivery(
          tenantId,
          trackingNumber,
          reason,
        );
      } else if (provider === 'grab') {
        await this.grabShippingService.cancelDelivery(
          tenantId,
          trackingNumber,
          reason,
        );
      } else {
        throw new BadRequestException(`Unsupported provider: ${provider}`);
      }

      // Emit cancellation event
      this.eventEmitter.emit('instant.delivery.cancelled', {
        tenantId,
        trackingNumber,
        provider,
        reason,
      });
    } catch (error) {
      this.logger.error(
        `Failed to cancel instant delivery: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private async getGojekQuotes(
    tenantId: string,
    request: InstantDeliveryQuoteRequest,
    serviceTypes: string[],
  ): Promise<InstantDeliveryQuote[]> {
    const gojekQuotes = await this.gojekShippingService.getShippingQuotes(
      tenantId,
      {
        pickup: {
          latitude: request.pickup.latitude,
          longitude: request.pickup.longitude,
        },
        delivery: {
          latitude: request.delivery.latitude,
          longitude: request.delivery.longitude,
        },
        package: {
          weight: request.package.weight,
          value: request.package.value,
        },
        serviceTypes,
      },
    );

    return gojekQuotes.map(
      (quote: GojekShippingQuote): InstantDeliveryQuote => ({
        provider: 'gojek',
        carrierId: quote.carrierId,
        carrierName: quote.carrierName,
        serviceCode: quote.serviceCode,
        serviceName: quote.serviceName,
        serviceType: quote.serviceType,
        cost: quote.cost,
        timeframe: {
          estimatedMinutes: quote.timeframe.estimatedMinutes,
          estimatedDeliveryTime: quote.timeframe.estimatedDeliveryTime,
        },
        features: quote.features,
        availability: {
          isServiceable: true, // Gojek service check would be done in the shipping service
        },
      }),
    );
  }

  private async getGrabQuotes(
    tenantId: string,
    request: InstantDeliveryQuoteRequest,
    serviceTypes: string[],
  ): Promise<InstantDeliveryQuote[]> {
    const grabQuotes = await this.grabShippingService.getShippingQuotes(
      tenantId,
      {
        origin: {
          latitude: request.pickup.latitude,
          longitude: request.pickup.longitude,
        },
        destination: {
          latitude: request.delivery.latitude,
          longitude: request.delivery.longitude,
        },
        packages: [
          {
            weight: request.package.weight,
            dimensions: {
              length: request.package.length,
              width: request.package.width,
              height: request.package.height,
            },
          },
        ],
        serviceTypes,
      },
    );

    return grabQuotes.map(
      (quote: GrabShippingQuote): InstantDeliveryQuote => ({
        provider: 'grab',
        carrierId: quote.carrierId,
        carrierName: quote.carrierName,
        serviceCode: quote.serviceCode,
        serviceName: quote.serviceName,
        serviceType: quote.serviceType,
        cost: quote.cost,
        timeframe: {
          estimatedMinutes: quote.timeframe.estimatedMinutes,
          estimatedPickupTime: quote.timeframe.estimatedPickupTime,
          estimatedDeliveryTime: quote.timeframe.estimatedDeliveryTime,
        },
        features: quote.features,
        distance: quote.distance,
        availability: {
          isServiceable: true, // Grab service check would be done in the shipping service
        },
      }),
    );
  }

  private async createGojekDelivery(
    tenantId: string,
    request: InstantDeliveryRequest,
  ): Promise<ShippingLabel> {
    const gojekRequest: GojekShipmentRequest = {
      orderId: request.orderId,
      pickup: request.pickup,
      delivery: request.delivery,
      package: {
        ...request.package,
        quantity: request.package.quantity || 1,
      },
      serviceType: this.mapServiceTypeForGojek(request.serviceType),
      paymentMethod: this.mapPaymentMethodForGojek(request.paymentMethod),
      isCod: request.isCod,
      codAmount: request.codAmount,
      scheduledPickupTime: request.scheduledAt,
      specialInstructions: request.specialInstructions,
    };

    return this.gojekShippingService.createShipment(tenantId, gojekRequest);
  }

  private async createGrabDelivery(
    tenantId: string,
    request: InstantDeliveryRequest,
  ): Promise<ShippingLabel> {
    const grabRequest: GrabShipmentRequest = {
      orderId: request.orderId,
      serviceType: request.serviceType,
      origin: {
        address: request.pickup.address,
        keywords: `${request.pickup.district}, ${request.pickup.city}`,
        coordinates: {
          latitude: request.pickup.latitude,
          longitude: request.pickup.longitude,
        },
        contactPerson: {
          name: request.pickup.name,
          phoneNumber: request.pickup.phone,
        },
        note: request.pickup.notes,
      },
      destination: {
        address: request.delivery.address,
        keywords: `${request.delivery.district}, ${request.delivery.city}`,
        coordinates: {
          latitude: request.delivery.latitude,
          longitude: request.delivery.longitude,
        },
        contactPerson: {
          name: request.delivery.name,
          phoneNumber: request.delivery.phone,
        },
        note: request.delivery.notes,
      },
      packages: [
        {
          name: request.package.description,
          description: request.package.description,
          quantity: request.package.quantity || 1,
          weight: request.package.weight,
          dimensions: {
            length: request.package.length,
            width: request.package.width,
            height: request.package.height,
          },
          value: request.package.value,
        },
      ],
      paymentMethod: this.mapPaymentMethodForGrab(request.paymentMethod),
      codAmount: request.codAmount,
      scheduledAt: request.scheduledAt,
      specialRequests: request.specialInstructions,
    };

    return this.grabShippingService.createShipment(tenantId, grabRequest);
  }

  private mapServiceTypeForGojek(
    serviceType: string,
  ): 'instant' | 'same_day' | 'next_day' {
    const mapping = {
      instant: 'instant',
      same_day: 'same_day',
      next_day: 'next_day',
      express: 'instant', // Map express to instant for Gojek
    };
    return mapping[serviceType] || 'instant';
  }

  private mapPaymentMethodForGojek(
    paymentMethod: string,
  ): 'cash' | 'gopay' | 'corporate' {
    const mapping = {
      cash: 'cash',
      cashless: 'gopay',
      gopay: 'gopay',
      corporate: 'corporate',
    };
    return mapping[paymentMethod] || 'cash';
  }

  private mapPaymentMethodForGrab(paymentMethod: string): 'CASHLESS' | 'CASH' {
    return paymentMethod === 'cash' ? 'CASH' : 'CASHLESS';
  }

  private async scheduleTrackingUpdates(
    tenantId: string,
    trackingNumber: string,
    provider: 'gojek' | 'grab',
  ): Promise<void> {
    // Schedule periodic tracking updates
    const trackingUpdateJob = {
      tenantId,
      trackingNumber,
      provider,
    };

    // Schedule immediate update
    await this.instantDeliveryQueue.add('update-tracking', trackingUpdateJob, {
      delay: 30000, // 30 seconds
    });

    // Schedule periodic updates every 2 minutes for the first hour
    for (let i = 1; i <= 30; i++) {
      await this.instantDeliveryQueue.add(
        'update-tracking',
        trackingUpdateJob,
        {
          delay: i * 2 * 60 * 1000, // Every 2 minutes
        },
      );
    }

    // Then every 10 minutes for the next 4 hours
    for (let i = 1; i <= 24; i++) {
      await this.instantDeliveryQueue.add(
        'update-tracking',
        trackingUpdateJob,
        {
          delay: 30 * 2 * 60 * 1000 + i * 10 * 60 * 1000, // After first hour, every 10 minutes
        },
      );
    }
  }
}
