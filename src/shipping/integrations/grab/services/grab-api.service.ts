import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseApiService,
  ApiConfig,
  ApiRequest,
  ApiResponse,
} from '../../../../integrations/common/services/base-api.service';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';

export interface GrabCredentials {
  clientId: string;
  clientSecret: string;
  merchantId: string;
  isSandbox?: boolean;
}

export interface GrabApiRequest extends Omit<ApiRequest, 'headers'> {
  requiresAuth?: boolean;
}

export interface GrabDeliveryRequest {
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
    weight: number; // in grams
    dimensions: {
      length: number; // in cm
      width: number; // in cm
      height: number; // in cm
    };
    value: number; // in IDR
  }>;
  paymentMethod: 'CASHLESS' | 'CASH';
  cashOnDelivery?: {
    amount: number;
  };
  scheduledAt?: string; // ISO format for scheduled delivery
  specialRequests?: string[];
}

export interface GrabDeliveryResponse {
  deliveryID: string;
  status: string;
  trackingURL: string;
  fare: {
    amount: number;
    currency: string;
    currencyExponent: number;
  };
  driverDetails?: {
    name: string;
    phoneNumber: string;
    photoURL: string;
    plateNumber: string;
  };
  quotes: {
    amount: number;
    currency: string;
    currencyExponent: number;
    distance: number;
    estimatedTimeline: string;
  };
}

export interface GrabTrackingResponse {
  deliveryID: string;
  status: string;
  driverDetails?: {
    name: string;
    phoneNumber: string;
    photoURL: string;
    plateNumber: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  waypoints: Array<{
    coordinates: {
      latitude: number;
      longitude: number;
    };
    address: string;
    contactPerson: {
      name: string;
      phoneNumber: string;
    };
  }>;
  schedule: {
    pickupTimeFrom: string;
    pickupTimeTo: string;
    dropoffTimeFrom: string;
    dropoffTimeTo: string;
  };
  trackingHistory: Array<{
    timestamp: string;
    status: string;
    description: string;
    location?: {
      latitude: number;
      longitude: number;
      address: string;
    };
  }>;
}

export interface GrabQuoteRequest {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  serviceType: 'instant' | 'same_day' | 'express';
  packages: Array<{
    weight: number; // in grams
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
  }>;
}

export interface GrabQuoteResponse {
  quotes: Array<{
    serviceType: string;
    amount: number;
    currency: string;
    currencyExponent: number;
    distance: number;
    estimatedTimeline: string;
    estimatedPickupTime: string;
    estimatedDeliveryTime: string;
  }>;
}

@Injectable()
export class GrabApiService extends BaseApiService {
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get Grab API configuration
   */
  private getApiConfig(credentials: GrabCredentials): ApiConfig {
    const baseUrl = credentials.isSandbox
      ? 'https://partner-api.stg-myteksi.com'
      : 'https://partner-api.grab.com';

    return {
      baseUrl,
      apiVersion: 'grabexpress/v1',
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 120,
        burstLimit: 30,
      },
      authentication: {
        type: 'oauth',
        credentials: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
        },
      },
    };
  }

  /**
   * Make authenticated request to Grab API
   */
  async makeGrabRequest<T = any>(
    credentials: GrabCredentials,
    request: GrabApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const grabRequest: ApiRequest = {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Date: new Date().toUTCString(),
        'X-Grab-Merchant-ID': credentials.merchantId,
      },
    };

    // Add OAuth token if required
    if (request.requiresAuth !== false) {
      const accessToken = await this.getAccessToken(credentials);
      const authSignature = this.generateGrabAuthSignature(
        credentials,
        request,
        accessToken,
        timestamp,
        nonce,
      );

      grabRequest.headers = {
        ...grabRequest.headers,
        Authorization: `Bearer ${accessToken}`,
        'X-Grab-Signature': authSignature,
        'X-Grab-Timestamp': timestamp,
        'X-Grab-Nonce': nonce,
      };
    }

    return this.makeRequest<T>(config, grabRequest, tenantId, channelId);
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(credentials: GrabCredentials): Promise<string> {
    const tokenRequest: ApiRequest = {
      method: 'POST',
      endpoint: '/grabid/v1/oauth2/token',
      data: {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'client_credentials',
        scope: 'grabexpress.partner_api',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const config = this.getApiConfig(credentials);
    const response = await this.makeRequest<{
      access_token: string;
      expires_in: number;
    }>(config, tokenRequest, 'system', 'oauth');

    if (response.success && response.data?.access_token) {
      return response.data.access_token;
    }

    throw new Error('Failed to obtain Grab access token');
  }

  /**
   * Generate Grab API signature
   */
  private generateGrabAuthSignature(
    credentials: GrabCredentials,
    request: GrabApiRequest,
    accessToken: string,
    timestamp: string,
    nonce: string,
  ): string {
    const method = request.method.toUpperCase();
    const url = request.endpoint;
    const body = request.data ? JSON.stringify(request.data) : '';

    const stringToSign = `${method}
${url}
${body}
${accessToken}
${timestamp}
${nonce}`;

    return crypto
      .createHmac('sha256', credentials.clientSecret)
      .update(stringToSign)
      .digest('hex');
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: GrabCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      const request: GrabApiRequest = {
        method: 'GET',
        endpoint: '/grabexpress/v1/deliveries/quotes',
        data: {
          origin: {
            latitude: -6.2088,
            longitude: 106.8456,
          },
          destination: {
            latitude: -6.1944,
            longitude: 106.8229,
          },
          serviceType: 'instant',
          packages: [
            {
              weight: 1000,
              dimensions: {
                length: 10,
                width: 10,
                height: 10,
              },
            },
          ],
        },
        requiresAuth: true,
      };

      return await this.makeGrabRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`Grab connection test failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: error.message,
        },
        metadata: {
          requestId: 'test_connection',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }
  }

  /**
   * Get delivery quote
   */
  async getDeliveryQuote(
    credentials: GrabCredentials,
    quoteRequest: GrabQuoteRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<GrabQuoteResponse>> {
    const apiRequest: GrabApiRequest = {
      method: 'POST',
      endpoint: '/grabexpress/v1/deliveries/quotes',
      data: {
        origin: quoteRequest.origin,
        destination: quoteRequest.destination,
        serviceType: quoteRequest.serviceType,
        packages: quoteRequest.packages,
      },
      requiresAuth: true,
    };

    return this.makeGrabRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Create delivery order
   */
  async createDelivery(
    credentials: GrabCredentials,
    deliveryData: GrabDeliveryRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<GrabDeliveryResponse>> {
    const apiRequest: GrabApiRequest = {
      method: 'POST',
      endpoint: '/grabexpress/v1/deliveries',
      data: {
        merchantOrderID: `ORDER_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`,
        serviceType: deliveryData.serviceType,
        origin: {
          address: deliveryData.origin.address,
          keywords: deliveryData.origin.keywords,
          coordinates: deliveryData.origin.coordinates,
          contactPerson: {
            name: deliveryData.origin.contactPerson.name,
            phoneNumber: this.formatPhoneNumber(
              deliveryData.origin.contactPerson.phoneNumber,
            ),
          },
          note: deliveryData.origin.note,
        },
        destination: {
          address: deliveryData.destination.address,
          keywords: deliveryData.destination.keywords,
          coordinates: deliveryData.destination.coordinates,
          contactPerson: {
            name: deliveryData.destination.contactPerson.name,
            phoneNumber: this.formatPhoneNumber(
              deliveryData.destination.contactPerson.phoneNumber,
            ),
          },
          note: deliveryData.destination.note,
        },
        packages: deliveryData.packages.map(pkg => ({
          name: pkg.name,
          description: pkg.description,
          quantity: pkg.quantity,
          weight: pkg.weight,
          dimensions: pkg.dimensions,
          value: {
            amount: pkg.value,
            currency: 'IDR',
            currencyExponent: 2,
          },
        })),
        paymentMethod: deliveryData.paymentMethod,
        cashOnDelivery: deliveryData.cashOnDelivery
          ? {
              amount: deliveryData.cashOnDelivery.amount,
              currency: 'IDR',
              currencyExponent: 2,
            }
          : undefined,
        scheduledAt: deliveryData.scheduledAt,
        specialRequests: deliveryData.specialRequests,
      },
      requiresAuth: true,
    };

    return this.makeGrabRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Get delivery tracking information
   */
  async trackDelivery(
    credentials: GrabCredentials,
    deliveryId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<GrabTrackingResponse>> {
    const apiRequest: GrabApiRequest = {
      method: 'GET',
      endpoint: `/grabexpress/v1/deliveries/${deliveryId}`,
      requiresAuth: true,
    };

    return this.makeGrabRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Cancel delivery order
   */
  async cancelDelivery(
    credentials: GrabCredentials,
    deliveryId: string,
    reason: string,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      deliveryID: string;
      status: string;
      cancellationReason: string;
      cancellationFee?: {
        amount: number;
        currency: string;
        currencyExponent: number;
      };
    }>
  > {
    const apiRequest: GrabApiRequest = {
      method: 'PUT',
      endpoint: `/grabexpress/v1/deliveries/${deliveryId}/cancel`,
      data: {
        reason: reason,
      },
      requiresAuth: true,
    };

    return this.makeGrabRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Get available service types
   */
  async getServiceTypes(
    credentials: GrabCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<
      Array<{
        serviceType: string;
        serviceName: string;
        description: string;
        isInstant: boolean;
        maxWeight: number;
        maxDimensions: {
          length: number;
          width: number;
          height: number;
        };
        features: {
          cod: boolean;
          insurance: boolean;
          tracking: boolean;
          scheduledDelivery: boolean;
        };
      }>
    >
  > {
    // Grab doesn't have a specific endpoint for service types
    // Return static configuration based on known Grab services
    return {
      success: true,
      data: [
        {
          serviceType: 'instant',
          serviceName: 'GrabExpress Instant',
          description: 'Same-hour delivery for urgent items',
          isInstant: true,
          maxWeight: 20000, // 20kg
          maxDimensions: {
            length: 60,
            width: 45,
            height: 45,
          },
          features: {
            cod: true,
            insurance: true,
            tracking: true,
            scheduledDelivery: false,
          },
        },
        {
          serviceType: 'same_day',
          serviceName: 'GrabExpress Same Day',
          description: 'Same-day delivery with flexible timing',
          isInstant: false,
          maxWeight: 30000, // 30kg
          maxDimensions: {
            length: 80,
            width: 60,
            height: 60,
          },
          features: {
            cod: true,
            insurance: true,
            tracking: true,
            scheduledDelivery: true,
          },
        },
        {
          serviceType: 'express',
          serviceName: 'GrabExpress Express',
          description: 'Express delivery for time-sensitive items',
          isInstant: false,
          maxWeight: 50000, // 50kg
          maxDimensions: {
            length: 100,
            width: 80,
            height: 80,
          },
          features: {
            cod: true,
            insurance: true,
            tracking: true,
            scheduledDelivery: true,
          },
        },
      ],
      metadata: {
        requestId: 'static_service_types',
        timestamp: new Date(),
        duration: 0,
      },
    };
  }

  /**
   * Handle API errors specific to Grab
   */
  handleGrabError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorCode = error.code || error.errorCode || error.status;
    const errorMessage =
      error.message || error.errorMessage || 'Unknown Grab API error';

    // Map common Grab error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      UNAUTHORIZED: {
        message: 'Invalid or expired access token',
        retryable: true,
      },
      FORBIDDEN: {
        message: 'Access forbidden - check permissions',
        retryable: false,
      },
      INVALID_LOCATION: {
        message: 'Invalid pickup or delivery location',
        retryable: false,
      },
      SERVICE_UNAVAILABLE: {
        message: 'Delivery service not available in this area',
        retryable: false,
      },
      NO_DRIVER_AVAILABLE: {
        message: 'No driver available at this time',
        retryable: true,
      },
      ORDER_NOT_FOUND: {
        message: 'Delivery order not found',
        retryable: false,
      },
      ORDER_ALREADY_CANCELLED: {
        message: 'Order already cancelled',
        retryable: false,
      },
      INVALID_PACKAGE_SIZE: {
        message: 'Package size exceeds service limits',
        retryable: false,
      },
      RATE_LIMIT_EXCEEDED: {
        message: 'API rate limit exceeded',
        retryable: true,
      },
      MERCHANT_SUSPENDED: {
        message: 'Merchant account suspended',
        retryable: false,
      },
      PAYMENT_FAILED: {
        message: 'Payment processing failed',
        retryable: false,
      },
      INVALID_COD_AMOUNT: {
        message: 'Invalid cash on delivery amount',
        retryable: false,
      },
      INSUFFICIENT_BALANCE: {
        message: 'Insufficient merchant balance',
        retryable: false,
      },
      DUPLICATE_ORDER: {
        message: 'Duplicate merchant order ID',
        retryable: false,
      },
    };

    const mappedError = errorMap[errorCode];

    return {
      code: errorCode || 'GRAB_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }

  /**
   * Convert Grab status to our standard tracking status
   */
  mapGrabStatusToTrackingStatus(grabStatus: string): string {
    const statusMap: Record<string, string> = {
      ALLOCATING: 'order_confirmed',
      FINDING_DRIVER: 'searching_driver',
      DRIVER_ASSIGNED: 'assigned_to_driver',
      DRIVER_EN_ROUTE_TO_PICKUP: 'driver_heading_to_pickup',
      DRIVER_ARRIVED_PICKUP: 'driver_arrived_pickup',
      PICKED_UP: 'picked_up',
      DRIVER_EN_ROUTE_TO_DROPOFF: 'in_transit',
      DRIVER_ARRIVED_DROPOFF: 'driver_arrived_dropoff',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
      FAILED: 'delivery_failed',
      RETURNED: 'returned_to_sender',
    };

    return statusMap[grabStatus.toUpperCase()] || 'in_transit';
  }

  /**
   * Format tracking data to our standard format
   */
  formatTrackingData(grabTrackingData: any): any {
    return {
      deliveryId: grabTrackingData.deliveryID,
      trackingNumber: grabTrackingData.deliveryID,
      status: this.mapGrabStatusToTrackingStatus(grabTrackingData.status),
      driverInfo: grabTrackingData.driverDetails
        ? {
            name: grabTrackingData.driverDetails.name,
            phone: grabTrackingData.driverDetails.phoneNumber,
            photo: grabTrackingData.driverDetails.photoURL,
            plateNumber: grabTrackingData.driverDetails.plateNumber,
            currentLocation: grabTrackingData.driverDetails.location,
          }
        : null,
      schedule: grabTrackingData.schedule,
      waypoints: grabTrackingData.waypoints,
      timeline:
        grabTrackingData.trackingHistory?.map((event: any) => ({
          timestamp: event.timestamp,
          status: this.mapGrabStatusToTrackingStatus(event.status),
          description: event.description,
          location: event.location,
        })) || [],
    };
  }

  /**
   * Format Indonesian phone number for Grab API
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // Add +62 country code if not present
    if (cleaned.startsWith('62')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+62${cleaned.substring(1)}`;
    } else {
      return `+62${cleaned}`;
    }
  }

  /**
   * Validate Indonesian postal code format
   */
  validatePostalCode(postalCode: string): boolean {
    // Indonesian postal codes are 5 digits
    const indonesianPostalRegex = /^[0-9]{5}$/;
    return indonesianPostalRegex.test(postalCode);
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get service area coverage
   */
  async getServiceArea(
    credentials: GrabCredentials,
    latitude: number,
    longitude: number,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      isServiceable: boolean;
      availableServices: string[];
      estimatedPickupTime?: string;
    }>
  > {
    // Grab doesn't have a specific coverage endpoint
    // We'll determine coverage based on major Indonesian cities
    const majorCities = [
      { name: 'Jakarta', lat: -6.2088, lng: 106.8456, radius: 50 },
      { name: 'Surabaya', lat: -7.2575, lng: 112.7521, radius: 30 },
      { name: 'Bandung', lat: -6.9175, lng: 107.6191, radius: 25 },
      { name: 'Medan', lat: 3.5952, lng: 98.6722, radius: 25 },
      { name: 'Semarang', lat: -6.9665, lng: 110.4203, radius: 20 },
      { name: 'Makassar', lat: -5.1477, lng: 119.4327, radius: 20 },
      { name: 'Palembang', lat: -2.9761, lng: 104.7754, radius: 15 },
    ];

    let isServiceable = false;
    let nearestCity = null;
    let minDistance = Infinity;

    for (const city of majorCities) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        city.lat,
        city.lng,
      );
      if (distance <= city.radius) {
        isServiceable = true;
      }
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = city;
      }
    }

    const availableServices = isServiceable
      ? ['instant', 'same_day', 'express']
      : [];

    return {
      success: true,
      data: {
        isServiceable,
        availableServices,
        estimatedPickupTime: isServiceable ? '15-30 minutes' : undefined,
      },
      metadata: {
        requestId: 'service_area_check',
        timestamp: new Date(),
        duration: 0,
      },
    };
  }
}
