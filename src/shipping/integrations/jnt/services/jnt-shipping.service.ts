import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { ShippingLabel, ShippingLabelStatus } from '../../../entities/shipping-label.entity';
import { ShippingTracking, TrackingStatus } from '../../../entities/shipping-tracking.entity';
import { ShippingRate } from '../../../entities/shipping-rate.entity';

// Services
import { JntApiService, JntCredentials, JntBookingRequest } from './jnt-api.service';
import { IntegrationLogService } from '../../../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../../../integrations/entities/integration-log.entity';

// Interfaces
export interface JntShipmentRequest {
  shippingLabelId: string;
  credentials: JntCredentials;
  expressType: string; // Standard Express, Special Goods Express
  deliveryType: string; // COD, PREPAID
}

export interface JntTrackingUpdate {
  awbNo: string;
  scanType: string;
  description: string;
  city?: string;
  scanTime: Date;
  rawData?: any;
}

@Injectable()
export class JntShippingService {
  private readonly logger = new Logger(JntShippingService.name);

  constructor(
    @InjectRepository(ShippingLabel)
    private readonly shippingLabelRepository: Repository<ShippingLabel>,
    @InjectRepository(ShippingTracking)
    private readonly shippingTrackingRepository: Repository<ShippingTracking>,
    @InjectRepository(ShippingRate)
    private readonly shippingRateRepository: Repository<ShippingRate>,

    // Services
    private readonly jntApiService: JntApiService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create shipment with J&T Express
   */
  async createShipment(tenantId: string, request: JntShipmentRequest): Promise<{
    success: boolean;
    trackingNumber?: string;
    txLogisticId?: string;
    labelUrl?: string;
    totalCost?: number;
    error?: string;
  }> {
    try {
      this.logger.debug(`Creating J&T shipment for label ${request.shippingLabelId}`);

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

      // Determine item type based on package info
      const itemType = this.jntApiService.determineItemType({
        weight: shippingLabel.packageInfo.weight,
        length: shippingLabel.packageInfo.length,
        width: shippingLabel.packageInfo.width,
        height: shippingLabel.packageInfo.height,
        isFragile: shippingLabel.isFragile,
        content: shippingLabel.packageInfo.content,
      });

      // Prepare booking data for J&T API
      const bookingData: JntBookingRequest = {
        expressType: request.expressType,
        serviceType: 'pickup', // or 'deliver' if drop-off
        deliveryType: request.deliveryType,
        payType: request.deliveryType === 'PREPAID' ? 'PP_PM' : 'CC_CASH',
        sender: {
          name: shippingLabel.senderAddress.name,
          mobile: this.jntApiService.formatPhoneNumber(shippingLabel.senderAddress.phone),
          company: shippingLabel.senderAddress.company || '',
          countryCode: 'ID',
          province: shippingLabel.senderAddress.state,
          city: shippingLabel.senderAddress.city,
          area: shippingLabel.senderAddress.district,
          address: shippingLabel.senderAddress.address,
          postCode: shippingLabel.senderAddress.postalCode,
        },
        receiver: {
          name: shippingLabel.recipientAddress.name,
          mobile: this.jntApiService.formatPhoneNumber(shippingLabel.recipientAddress.phone),
          company: shippingLabel.recipientAddress.company || '',
          countryCode: 'ID',
          province: shippingLabel.recipientAddress.state,
          city: shippingLabel.recipientAddress.city,
          area: shippingLabel.recipientAddress.district,
          address: shippingLabel.recipientAddress.address,
          postCode: shippingLabel.recipientAddress.postalCode,
        },
        items: [{
          itemName: shippingLabel.packageInfo.content,
          itemType: itemType,
          weight: shippingLabel.packageInfo.weight / 1000, // Convert to kg
          length: shippingLabel.packageInfo.length,
          width: shippingLabel.packageInfo.width,
          height: shippingLabel.packageInfo.height,
          quantity: shippingLabel.packageInfo.pieces,
          itemValue: shippingLabel.insuredValue || 0,
          currency: 'IDR',
        }],
        totalWeight: shippingLabel.packageInfo.weight / 1000, // Convert to kg
        totalQuantity: shippingLabel.packageInfo.pieces,
        goodsValue: shippingLabel.insuredValue || 0,
        remark: shippingLabel.notes,
      };

      // Add COD amount if applicable
      if (shippingLabel.isCod && shippingLabel.codAmount > 0) {
        bookingData.codAmount = shippingLabel.codAmount;
      }

      // Call J&T API to create booking
      const response = await this.jntApiService.createBooking(
        request.credentials,
        bookingData,
        tenantId,
        'jnt-shipping'
      );

      if (!response.success) {
        const errorInfo = this.jntApiService.handleJntError(response.error);
        
        await this.logService.logError(tenantId, 'jnt-shipping', new Error(errorInfo.message), {
          metadata: {
            action: 'create_booking',
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

      // Update shipping label with J&T response
      shippingLabel.trackingNumber = response.data.data.awbNo;
      shippingLabel.airwayBill = response.data.data.awbNo;
      shippingLabel.labelUrl = response.data.data.pdfUrl;
      shippingLabel.totalCost = response.data.data.feeAmount;
      shippingLabel.shippingCost = response.data.data.feeAmount;
      shippingLabel.status = ShippingLabelStatus.GENERATED;
      shippingLabel.generatedAt = new Date();

      // Store J&T-specific data
      shippingLabel.carrierData = {
        ...shippingLabel.carrierData,
        jntTxLogisticId: response.data.data.txLogisticId,
        jntAwbNo: response.data.data.awbNo,
        jntExpressType: request.expressType,
        jntDeliveryType: request.deliveryType,
        jntCustomerCode: response.data.data.customerCode,
        jntOrderStatus: response.data.data.orderStatus,
        jntPdfUrl: response.data.data.pdfUrl,
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
        trackingNumber: response.data.data.awbNo,
        status: TrackingStatus.ORDER_CONFIRMED,
        description: 'Booking created with J&T Express',
        eventTime: new Date(),
        carrierData: {
          txLogisticId: response.data.data.txLogisticId,
          expressType: request.expressType,
          deliveryType: request.deliveryType,
          orderStatus: response.data.data.orderStatus,
        },
      });

      // Log successful creation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SHIPPING,
        level: IntegrationLogLevel.INFO,
        message: `J&T booking created: ${response.data.data.awbNo}`,
        metadata: {
          shippingLabelId: request.shippingLabelId,
          trackingNumber: response.data.data.awbNo,
          txLogisticId: response.data.data.txLogisticId,
          expressType: request.expressType,
          deliveryType: request.deliveryType,
          totalCost: response.data.data.feeAmount,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.jnt.booking.created', {
        tenantId,
        shippingLabel,
        trackingNumber: response.data.data.awbNo,
        txLogisticId: response.data.data.txLogisticId,
      });

      return {
        success: true,
        trackingNumber: response.data.data.awbNo,
        txLogisticId: response.data.data.txLogisticId,
        labelUrl: response.data.data.pdfUrl,
        totalCost: response.data.data.feeAmount,
      };

    } catch (error) {
      this.logger.error(`Failed to create J&T booking: ${error.message}`, error.stack);
      
      await this.logService.logError(tenantId, 'jnt-shipping', error, {
        metadata: {
          action: 'create_booking',
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
   * Track shipment with J&T Express
   */
  async trackShipment(tenantId: string, trackingNumbers: string[], credentials: JntCredentials): Promise<{
    success: boolean;
    trackingData?: any[];
    error?: string;
  }> {
    try {
      this.logger.debug(`Tracking J&T shipments: ${trackingNumbers.join(', ')}`);

      // Call J&T tracking API
      const response = await this.jntApiService.trackShipment(
        credentials,
        trackingNumbers,
        tenantId,
        'jnt-shipping'
      );

      if (!response.success) {
        const errorInfo = this.jntApiService.handleJntError(response.error);
        return {
          success: false,
          error: errorInfo.message,
        };
      }

      // Format tracking data
      const trackingData = response.data.data.map((item: any) => 
        this.jntApiService.formatTrackingData(item)
      );

      return {
        success: true,
        trackingData,
      };

    } catch (error) {
      this.logger.error(`Failed to track J&T shipments: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update tracking information from J&T webhook or polling
   */
  async updateTracking(tenantId: string, trackingUpdates: JntTrackingUpdate[]): Promise<void> {
    try {
      this.logger.debug(`Updating J&T tracking for ${trackingUpdates.length} packages`);

      for (const update of trackingUpdates) {
        // Find shipping label
        const shippingLabel = await this.shippingLabelRepository.findOne({
          where: { tenantId, trackingNumber: update.awbNo },
        });

        if (!shippingLabel) {
          this.logger.warn(`Shipping label not found for AWB: ${update.awbNo}`);
          continue;
        }

        // Convert J&T scan type to our tracking status
        const trackingStatus = this.jntApiService.mapJntScanTypeToTrackingStatus(update.scanType);

        // Create tracking entry
        await this.createTrackingEntry(tenantId, {
          shippingLabelId: shippingLabel.id,
          trackingNumber: update.awbNo,
          status: trackingStatus as TrackingStatus,
          description: update.description,
          location: update.city,
          eventTime: update.scanTime,
          carrierData: {
            jntScanType: update.scanType,
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
          message: `J&T tracking updated: ${update.awbNo} - ${update.scanType}`,
          metadata: {
            awbNo: update.awbNo,
            scanType: update.scanType,
            description: update.description,
            city: update.city,
          },
        });
      }

    } catch (error) {
      this.logger.error(`Failed to update J&T tracking: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel booking with J&T Express
   */
  async cancelBooking(tenantId: string, trackingNumber: string, reason: string, credentials: JntCredentials): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      this.logger.debug(`Cancelling J&T booking: ${trackingNumber}`);

      // Find shipping label
      const shippingLabel = await this.shippingLabelRepository.findOne({
        where: { tenantId, trackingNumber },
      });

      if (!shippingLabel) {
        throw new BadRequestException('Shipping label not found');
      }

      if (!shippingLabel.canBeCancelled) {
        throw new BadRequestException('Booking cannot be cancelled in current status');
      }

      // Get txLogisticId from carrier data
      const txLogisticId = shippingLabel.carrierData?.jntTxLogisticId;
      if (!txLogisticId) {
        throw new BadRequestException('J&T transaction ID not found');
      }

      // Call J&T API to cancel booking
      const response = await this.jntApiService.cancelBooking(
        credentials,
        txLogisticId,
        reason,
        tenantId,
        'jnt-shipping'
      );

      if (!response.success) {
        const errorInfo = this.jntApiService.handleJntError(response.error);
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
        description: `Booking cancelled: ${reason}`,
        eventTime: new Date(),
        carrierData: {
          cancellationReason: reason,
          txLogisticId,
        },
      });

      // Log cancellation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SHIPPING,
        level: IntegrationLogLevel.INFO,
        message: `J&T booking cancelled: ${trackingNumber}`,
        metadata: {
          trackingNumber,
          txLogisticId,
          reason,
          message: response.data.msg,
        },
      });

      // Emit event
      this.eventEmitter.emit('shipping.jnt.booking.cancelled', {
        tenantId,
        shippingLabel,
        reason,
        txLogisticId,
      });

      return {
        success: true,
        message: response.data.msg,
      };

    } catch (error) {
      this.logger.error(`Failed to cancel J&T booking: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sync shipping rates from J&T Express
   */
  async syncShippingRates(tenantId: string, credentials: JntCredentials, routes: Array<{
    senderProvince: string;
    senderCity: string;
    senderArea: string;
    receiverProvince: string;
    receiverCity: string;
    receiverArea: string;
  }>): Promise<{
    success: boolean;
    synced: number;
    errors: string[];
  }> {
    try {
      this.logger.debug(`Syncing J&T shipping rates for ${routes.length} routes`);

      let synced = 0;
      const errors: string[] = [];

      // Get J&T service types
      const serviceTypes = this.jntApiService.getServiceTypes();

      for (const route of routes) {
        try {
          // Get rates for different weight tiers and item types
          const weightTiers = [1, 2, 5, 10, 20]; // kg
          const itemTypes = ['DOC', 'SPX', 'MPX', 'LPX'];

          for (const weight of weightTiers) {
            for (const itemType of itemTypes) {
              const rateRequest = {
                sender: {
                  province: route.senderProvince,
                  city: route.senderCity,
                  area: route.senderArea,
                },
                receiver: {
                  province: route.receiverProvince,
                  city: route.receiverCity,
                  area: route.receiverArea,
                },
                weight,
                itemType,
              };

              const ratesResponse = await this.jntApiService.getShippingRates(
                credentials,
                rateRequest,
                tenantId,
                'jnt-shipping'
              );

              if (!ratesResponse.success) {
                errors.push(`Failed to get rates for ${route.senderCity} -> ${route.receiverCity}, weight: ${weight}kg, type: ${itemType}`);
                continue;
              }

              const rateData = ratesResponse.data;

              // Create or update shipping rate for each service type
              for (const serviceType of serviceTypes) {
                const existingRate = await this.shippingRateRepository.findOne({
                  where: {
                    tenantId,
                    carrierId: 'JNT',
                    serviceCode: serviceType.code,
                    originCity: route.senderCity,
                    destinationCity: route.receiverCity,
                  },
                });

                const shippingRate = existingRate || new ShippingRate();
                shippingRate.tenantId = tenantId;
                shippingRate.carrierId = 'JNT';
                shippingRate.carrierName = 'J&T Express';
                shippingRate.serviceCode = serviceType.code;
                shippingRate.serviceName = serviceType.name;
                shippingRate.rateType = this.jntApiService.mapJntExpressTypeToServiceType(serviceType.name) as any;

                // Geographic info
                shippingRate.originCity = route.senderCity;
                shippingRate.destinationCity = route.receiverCity;
                shippingRate.originState = route.senderProvince;
                shippingRate.destinationState = route.receiverProvince;

                // Weight limits
                shippingRate.minWeight = 100; // 100g minimum
                shippingRate.maxWeight = serviceType.maxWeight * 1000; // Convert to grams

                // Pricing (adjust based on actual rate from API)
                const baseMultiplier = {
                  'STANDARD': 1.0,
                  'SPECIAL': 1.3,
                  'ECONOMY': 0.8,
                }[serviceType.code] || 1.0;

                shippingRate.baseCost = Math.round(rateData.data.fee * baseMultiplier);
                shippingRate.currency = 'IDR';

                // Service info
                const etdMatch = rateData.data.timeLimit.match(/(\d+)/);
                shippingRate.estimatedDays = etdMatch ? parseInt(etdMatch[1]) : 3;

                // Features
                shippingRate.isCodAvailable = serviceType.features.cod;
                shippingRate.isInsuranceAvailable = serviceType.features.insurance;

                // Rate metadata
                shippingRate.rateDate = new Date();
                shippingRate.lastUpdated = new Date();
                shippingRate.rateSource = 'api';
                shippingRate.isActive = true;

                // Carrier data
                shippingRate.carrierData = {
                  jntServiceCode: serviceType.code,
                  jntServiceName: serviceType.name,
                  jntExpressType: serviceType.name,
                  jntTimeLimit: rateData.data.timeLimit,
                  jntDeliveryType: rateData.data.deliveryType,
                  jntItemType: itemType,
                  serviceFeatures: serviceType.features,
                };

                // API data
                shippingRate.apiData = {
                  lastSyncAt: new Date().toISOString(),
                  syncStatus: 'synced',
                  rawResponse: rateData,
                };

                await this.shippingRateRepository.save(shippingRate);
                synced++;
              }
            }
          }

        } catch (error) {
          errors.push(`Failed to sync rates for ${route.senderCity} -> ${route.receiverCity}: ${error.message}`);
        }
      }

      this.logger.debug(`J&T rate sync completed: ${synced} rates synced, ${errors.length} errors`);

      return {
        success: errors.length < routes.length,
        synced,
        errors,
      };

    } catch (error) {
      this.logger.error(`Failed to sync J&T shipping rates: ${error.message}`, error.stack);
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
    tracking.carrierId = 'JNT';
    tracking.carrierName = 'J&T Express';
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
    update: JntTrackingUpdate
  ): Promise<void> {
    let statusChanged = false;

    switch (trackingStatus) {
      case 'picked_up':
        if (shippingLabel.status === ShippingLabelStatus.GENERATED) {
          shippingLabel.updateStatus(ShippingLabelStatus.SHIPPED);
          shippingLabel.actualPickupDate = update.scanTime;
          statusChanged = true;
        }
        break;
      case 'delivered':
        if (shippingLabel.status !== ShippingLabelStatus.CANCELLED) {
          shippingLabel.actualDeliveryDate = update.scanTime;
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