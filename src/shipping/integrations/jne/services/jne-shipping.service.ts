import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { ShippingLabel, ShippingLabelStatus } from '../../../entities/shipping-label.entity';
import { ShippingTracking, TrackingStatus } from '../../../entities/shipping-tracking.entity';
import { ShippingRate } from '../../../entities/shipping-rate.entity';

// Services
import { JneApiService, JneCredentials } from './jne-api.service';
import { IntegrationLogService } from '../../../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../../../integrations/entities/integration-log.entity';

// Interfaces
export interface JneShipmentRequest {
  shippingLabelId: string;
  credentials: JneCredentials;
  serviceCode: string; // REG, YES, OKE, etc.
}

export interface JneTrackingUpdate {
  trackingNumber: string;
  status: string;
  description: string;
  location?: string;
  eventTime: Date;
  rawData?: any;
}

@Injectable()
export class JneShippingService {
  private readonly logger = new Logger(JneShippingService.name);

  constructor(
    @InjectRepository(ShippingLabel)
    private readonly shippingLabelRepository: Repository<ShippingLabel>,
    @InjectRepository(ShippingTracking)
    private readonly shippingTrackingRepository: Repository<ShippingTracking>,
    @InjectRepository(ShippingRate)
    private readonly shippingRateRepository: Repository<ShippingRate>,

    // Services
    private readonly jneApiService: JneApiService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create shipment with JNE
   */
  async createShipment(tenantId: string, request: JneShipmentRequest): Promise<{
    success: boolean;
    trackingNumber?: string;
    airwayBill?: string;
    labelUrl?: string;
    totalCost?: number;
    error?: string;
  }> {
    try {
      this.logger.debug(`Creating JNE shipment for label ${request.shippingLabelId}`);

      // Get shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, id: request.shippingLabelId },
        relations: ['order'],
      });

      if (!shippingLabel) {
        throw new BadRequestException('Shipping label not found');
      }

      if (shippingLabel.status !== ShippingLabelStatus.DRAFT) {
        throw new BadRequestException('Shipping label is not in draft status');
      }

      // Validate addresses
      if (!shippingLabel.validateAddresses()) {
        throw new BadRequestException('Invalid sender or recipient address');
      }

      if (!shippingLabel.validatePackageInfo()) {
        throw new BadRequestException('Invalid package information');
      }

      // Prepare shipment data for JNE API
      const shipmentData = {
        from: {
          name: shippingLabel.senderAddress.name,
          address: shippingLabel.senderAddress.address,
          city: shippingLabel.senderAddress.city,
          postal_code: shippingLabel.senderAddress.postalCode,
          phone: this.jneApiService.formatPhoneNumber(shippingLabel.senderAddress.phone),
        },
        to: {
          name: shippingLabel.recipientAddress.name,
          address: shippingLabel.recipientAddress.address,
          city: shippingLabel.recipientAddress.city,
          postal_code: shippingLabel.recipientAddress.postalCode,
          phone: this.jneApiService.formatPhoneNumber(shippingLabel.recipientAddress.phone),
        },
        package: {
          weight: shippingLabel.packageInfo.weight / 1000, // Convert grams to kg
          length: shippingLabel.packageInfo.length,
          width: shippingLabel.packageInfo.width,
          height: shippingLabel.packageInfo.height,
          content: shippingLabel.packageInfo.content,
          value: shippingLabel.insuredValue || 0,
        },
        service: request.serviceCode,
        insurance: shippingLabel.insuranceType !== 'none',
      };

      // Add COD if applicable
      if (shippingLabel.isCod && shippingLabel.codAmount > 0) {
        shipmentData['cod'] = {
          amount: shippingLabel.codAmount,
        };
      }

      // Call JNE API to create shipment
      const response = await this.jneApiService.createShipment(
        request.credentials,
        shipmentData,
        tenantId,
        'jne-shipping'
      );

      if (!response.success) {
        const errorInfo = this.jneApiService.handleJneError(response.error);
        
        await this.logService.logError(tenantId, 'jne-shipping', new Error(errorInfo.message), {
          metadata: {
            action: 'create_shipment',
            shippingLabelId: request.shippingLabelId,
            errorCode: errorInfo.code,
            retryable: errorInfo.retryable,
          },
        });

        return {
          success: false,
          error: errorInfo.message,
        };
      }

      // Update shipping label with JNE response
      shippingLabel.trackingNumber = response.data.tracking_number;
      shippingLabel.airwayBill = response.data.airway_bill;
      shippingLabel.labelUrl = response.data.label_url;
      shippingLabel.totalCost = response.data.total_cost;
      shippingLabel.shippingCost = response.data.service_cost;
      shippingLabel.insuranceCost = response.data.insurance_cost || 0;
      shippingLabel.codAmount = response.data.cod_fee || 0;
      shippingLabel.status = ShippingLabelStatus.GENERATED;
      shippingLabel.generatedAt = new Date();

      // Store JNE-specific data
      shippingLabel.carrierData = {
        ...shippingLabel.carrierData,
        jneTrackingNumber: response.data.tracking_number,
        jneAirwayBill: response.data.airway_bill,
        jneServiceCode: request.serviceCode,
        jneLabelUrl: response.data.label_url,
      };

      shippingLabel.apiData = {
        ...shippingLabel.apiData,
        lastSyncAt: new Date().toISOString(),
        syncStatus: 'synced',
        rawResponse: response.data,
      };

      await this.shippingLabelRepository.save(shippingLabel);

      // Create initial tracking entry
      await this.createTrackingEntry(tenantId, {
        shippingLabelId: request.shippingLabelId,
        trackingNumber: response.data.tracking_number,
        status: TrackingStatus.ORDER_CONFIRMED,
        description: 'Shipment created with JNE',
        eventTime: new Date(),
        carrierData: {
          serviceCode: request.serviceCode,
          awbNumber: response.data.airway_bill,
        },
      });

      // Log successful creation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SHIPPING,
        level: IntegrationLogLevel.INFO,
        message: `JNE shipment created: ${response.data.tracking_number}`,
        metadata: {
          shippingLabelId: request.shippingLabelId,
          trackingNumber: response.data.tracking_number,
          airwayBill: response.data.airway_bill,
          serviceCode: request.serviceCode,
          totalCost: response.data.total_cost,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.jne.shipment.created', {
        tenantId,
        shippingLabel,
        trackingNumber: response.data.tracking_number,
      });

      return {
        success: true,
        trackingNumber: response.data.tracking_number,
        airwayBill: response.data.airway_bill,
        labelUrl: response.data.label_url,
        totalCost: response.data.total_cost,
      };

    } catch (error) {
      this.logger.error(`Failed to create JNE shipment: ${error.message}`, error.stack);
      
      await this.logService.logError(tenantId, 'jne-shipping', error, {
        metadata: {
          action: 'create_shipment',
          shippingLabelId: request.shippingLabelId,
        },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Track shipment with JNE
   */
  async trackShipment(tenantId: string, trackingNumber: string, credentials: JneCredentials): Promise<{
    success: boolean;
    trackingData?: any;
    error?: string;
  }> {
    try {
      this.logger.debug(`Tracking JNE shipment: ${trackingNumber}`);

      // Call JNE tracking API
      const response = await this.jneApiService.trackShipment(
        credentials,
        trackingNumber,
        tenantId,
        'jne-shipping'
      );

      if (!response.success) {
        const errorInfo = this.jneApiService.handleJneError(response.error);
        return {
          success: false,
          error: errorInfo.message,
        };
      }

      // Format tracking data
      const trackingData = this.jneApiService.formatTrackingData(response.data);

      return {
        success: true,
        trackingData,
      };

    } catch (error) {
      this.logger.error(`Failed to track JNE shipment: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update tracking information from JNE webhook or polling
   */
  async updateTracking(tenantId: string, trackingUpdates: JneTrackingUpdate[]): Promise<void> {
    try {
      this.logger.debug(`Updating JNE tracking for ${trackingUpdates.length} packages`);

      for (const update of trackingUpdates) {
        // Find shipping label
        const shippingLabel = await this.shippingLabelRepository.findOne({
          where: { tenantId, trackingNumber: update.trackingNumber },
        });

        if (!shippingLabel) {
          this.logger.warn(`Shipping label not found for tracking number: ${update.trackingNumber}`);
          continue;
        }

        // Convert JNE status to our tracking status
        const trackingStatus = this.jneApiService.mapJneStatusToTrackingStatus(update.status);

        // Create tracking entry
        await this.createTrackingEntry(tenantId, {
          shippingLabelId: shippingLabel.id,
          trackingNumber: update.trackingNumber,
          status: trackingStatus as TrackingStatus,
          description: update.description,
          location: update.location,
          eventTime: update.eventTime,
          carrierData: {
            jneStatus: update.status,
            rawData: update.rawData,
          },
        });

        // Update shipping label status if needed
        await this.updateShippingLabelFromTracking(tenantId, shippingLabel, trackingStatus, update);

        // Log tracking update
        await this.logService.log({
          tenantId,
          type: IntegrationLogType.TRACKING,
          level: IntegrationLogLevel.INFO,
          message: `JNE tracking updated: ${update.trackingNumber} - ${update.status}`,
          metadata: {
            trackingNumber: update.trackingNumber,
            status: update.status,
            description: update.description,
            location: update.location,
          },
        });
      }

    } catch (error) {
      this.logger.error(`Failed to update JNE tracking: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel shipment with JNE
   */
  async cancelShipment(tenantId: string, trackingNumber: string, reason: string, credentials: JneCredentials): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      this.logger.debug(`Cancelling JNE shipment: ${trackingNumber}`);

      // Find shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber },
      });

      if (!shippingLabel) {
        throw new BadRequestException('Shipping label not found');
      }

      if (!shippingLabel.canBeCancelled) {
        throw new BadRequestException('Shipment cannot be cancelled in current status');
      }

      // Call JNE API to cancel shipment
      const response = await this.jneApiService.cancelShipment(
        credentials,
        trackingNumber,
        reason,
        tenantId,
        'jne-shipping'
      );

      if (!response.success) {
        const errorInfo = this.jneApiService.handleJneError(response.error);
        return {
          success: false,
          error: errorInfo.message,
        };
      }

      // Update shipping label status
      shippingLabel.updateStatus(ShippingLabelStatus.CANCELLED, undefined, reason);
      await this.shippingLabelRepository.save(shippingLabel);

      // Create tracking entry for cancellation
      await this.createTrackingEntry(tenantId, {
        shippingLabelId: shippingLabel.id,
        trackingNumber,
        status: TrackingStatus.CANCELLED,
        description: `Shipment cancelled: ${reason}`,
        eventTime: new Date(),
        carrierData: {
          cancellationReason: reason,
        },
      });

      // Log cancellation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SHIPPING,
        level: IntegrationLogLevel.INFO,
        message: `JNE shipment cancelled: ${trackingNumber}`,
        metadata: {
          trackingNumber,
          reason,
          status: response.data.status,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.jne.shipment.cancelled', {
        tenantId,
        shippingLabel,
        reason,
      });

      return {
        success: true,
        message: response.data.message,
      };

    } catch (error) {
      this.logger.error(`Failed to cancel JNE shipment: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sync shipping rates from JNE
   */
  async syncShippingRates(tenantId: string, credentials: JneCredentials, routes: Array<{
    originCode: string;
    destinationCode: string;
    originCity: string;
    destinationCity: string;
    originState: string;
    destinationState: string;
  }>): Promise<{
    success: boolean;
    synced: number;
    errors: string[];
  }> {
    try {
      this.logger.debug(`Syncing JNE shipping rates for ${routes.length} routes`);

      let synced = 0;
      const errors: string[] = [];

      // Get JNE services first
      const servicesResponse = await this.jneApiService.getServices(
        credentials,
        tenantId,
        'jne-shipping'
      );

      if (!servicesResponse.success) {
        throw new Error('Failed to get JNE services');
      }

      const jneServices = servicesResponse.data;

      for (const route of routes) {
        try {
          // Get rates for different weight tiers
          const weightTiers = [1, 5, 10, 20, 50]; // kg

          for (const weight of weightTiers) {
            const ratesResponse = await this.jneApiService.getShippingRates(
              credentials,
              {
                from: route.originCode,
                to: route.destinationCode,
                weight,
              },
              tenantId,
              'jne-shipping'
            );

            if (!ratesResponse.success) {
              errors.push(`Failed to get rates for ${route.originCity} -> ${route.destinationCity}, weight: ${weight}kg`);
              continue;
            }

            // Process each service in the response
            for (const rateData of ratesResponse.data) {
              for (const cost of rateData.costs) {
                for (const service of cost.cost) {
                  // Create or update shipping rate
                  const existingRate = await this.shippingRateRepository.findOne({
                    where: {
                      tenantId,
                      carrierId: 'JNE',
                      serviceCode: cost.service,
                      originPostalCode: route.originCode,
                      destinationPostalCode: route.destinationCode,
                    },
                  });

                  const shippingRate = existingRate || new ShippingRate();
                  shippingRate.tenantId = tenantId;
                  shippingRate.carrierId = 'JNE';
                  shippingRate.carrierName = 'JNE (Jalur Nugraha Ekakurir)';
                  shippingRate.serviceCode = cost.service;
                  shippingRate.serviceName = cost.description;
                  shippingRate.rateType = this.jneApiService.mapJneServiceToServiceType(cost.service) as any;

                  // Geographic info
                  shippingRate.originPostalCode = route.originCode;
                  shippingRate.destinationPostalCode = route.destinationCode;
                  shippingRate.originCity = route.originCity;
                  shippingRate.destinationCity = route.destinationCity;
                  shippingRate.originState = route.originState;
                  shippingRate.destinationState = route.destinationState;

                  // Weight limits (get from service info)
                  const serviceInfo = jneServices.find(s => s.service_code === cost.service);
                  shippingRate.minWeight = 1000; // 1kg minimum in grams
                  shippingRate.maxWeight = serviceInfo?.max_weight ? serviceInfo.max_weight * 1000 : 30000; // Convert to grams

                  // Dimensions
                  if (serviceInfo?.max_dimension) {
                    shippingRate.maxLength = serviceInfo.max_dimension.length;
                    shippingRate.maxWidth = serviceInfo.max_dimension.width;
                    shippingRate.maxHeight = serviceInfo.max_dimension.height;
                  }

                  // Pricing
                  shippingRate.baseCost = service.value;
                  shippingRate.currency = 'IDR';

                  // Service info
                  const etdParts = service.etd.split('-');
                  shippingRate.estimatedDays = parseInt(etdParts[0]) || 1;
                  if (etdParts.length > 1) {
                    shippingRate.maxDays = parseInt(etdParts[1]);
                  }

                  // Features
                  shippingRate.isCodAvailable = serviceInfo?.features?.cod || false;
                  shippingRate.isInsuranceAvailable = serviceInfo?.features?.insurance || false;

                  // Rate metadata
                  shippingRate.rateDate = new Date();
                  shippingRate.lastUpdated = new Date();
                  shippingRate.rateSource = 'api';
                  shippingRate.isActive = true;

                  // Carrier data
                  shippingRate.carrierData = {
                    jneServiceCode: cost.service,
                    jneServiceName: cost.description,
                    jneEtd: service.etd,
                    jneNote: service.note,
                    serviceInfo,
                  };

                  // API data
                  shippingRate.apiData = {
                    lastSyncAt: new Date().toISOString(),
                    syncStatus: 'synced',
                    rawResponse: { rateData, cost, service },
                  };

                  await this.shippingRateRepository.save(shippingRate);
                  synced++;
                }
              }
            }
          }

        } catch (error) {
          errors.push(`Failed to sync rates for ${route.originCity} -> ${route.destinationCity}: ${error.message}`);
        }
      }

      this.logger.debug(`JNE rate sync completed: ${synced} rates synced, ${errors.length} errors`);

      return {
        success: errors.length < routes.length,
        synced,
        errors,
      };

    } catch (error) {
      this.logger.error(`Failed to sync JNE shipping rates: ${error.message}`, error.stack);
      return {
        success: false,
        synced: 0,
        errors: [error.message],
      };
    }
  }

  // Private helper methods

  private async createTrackingEntry(tenantId: string, data: {
    shippingLabelId: string;
    trackingNumber: string;
    status: TrackingStatus;
    description: string;
    location?: string;
    eventTime: Date;
    carrierData?: any;
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
    tracking.carrierId = 'JNE';
    tracking.carrierName = 'JNE (Jalur Nugraha Ekakurir)';
    tracking.status = data.status;
    tracking.description = data.description;
    tracking.eventTime = data.eventTime;
    tracking.sequence = (lastTracking?.sequence || 0) + 1;

    if (data.location) {
      tracking.location = data.location;
    }

    if (data.carrierData) {
      tracking.carrierId = data.carrierData.id;
      tracking.carrierName = data.carrierData.name;
    }

    return this.shippingTrackingRepository.save(tracking);
  }

  private async updateShippingLabelFromTracking(
    tenantId: string,
    shippingLabel: ShippingLabel,
    trackingStatus: string,
    update: JneTrackingUpdate
  ): Promise<void> {
    let statusChanged = false;

    switch (trackingStatus) {
      case 'picked_up':
        if (shippingLabel.status === ShippingLabelStatus.GENERATED) {
          shippingLabel.updateStatus(ShippingLabelStatus.SHIPPED);
          shippingLabel.actualPickupDate = update.eventTime;
          statusChanged = true;
        }
        break;
      case 'delivered':
        if (shippingLabel.status !== ShippingLabelStatus.CANCELLED) {
          shippingLabel.actualDeliveryDate = update.eventTime;
          statusChanged = true;
        }
        break;
    }

    if (statusChanged) {
      await this.shippingLabelRepository.save(shippingLabel);

      // Emit status change event
      this.eventEmitter.emit('shipping.status.changed', {
        tenantId,
        shippingLabel,
        newStatus: shippingLabel.status,
        trackingStatus,
      });
    }
  }
}