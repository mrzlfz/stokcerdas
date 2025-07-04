import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseApiService,
  ApiConfig,
  ApiRequest,
  ApiResponse,
} from '../../../../integrations/common/services/base-api.service';
import { HttpService } from '@nestjs/axios';

export interface GojekCredentials {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  merchantId: string;
  isSandbox?: boolean;
}

export interface GojekApiRequest extends Omit<ApiRequest, 'headers'> {
  requiresAuth?: boolean;
}

export interface GojekDeliveryRequest {
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
  dropoff: {
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
    weight: number; // in grams
    length: number; // in cm
    width: number; // in cm
    height: number; // in cm
    description: string;
    value: number; // in IDR
    quantity: number;
  };
  serviceType: 'instant' | 'same_day' | 'next_day';
  paymentMethod: 'cash' | 'gopay' | 'corporate';
  isCod?: boolean;
  codAmount?: number;
  specialInstructions?: string[];
  scheduledPickupTime?: string; // ISO format for scheduled delivery
}

export interface GojekDeliveryResponse {
  success: boolean;
  data: {
    orderId: string;
    trackingNumber: string;
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    vehicleType: string;
    estimatedPickupTime: string;
    estimatedDeliveryTime: string;
    totalFee: number;
    currency: string;
    status: string;
    paymentStatus: string;
  };
  message: string;
}

export interface GojekTrackingResponse {
  success: boolean;
  data: {
    orderId: string;
    trackingNumber: string;
    status: string;
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    vehicleInfo?: {
      type: string;
      plateNumber: string;
      color: string;
    };
    timeline: Array<{
      timestamp: string;
      status: string;
      location: {
        name: string;
        latitude: number;
        longitude: number;
        address: string;
      };
      description: string;
      driverNotes?: string;
    }>;
    currentLocation?: {
      latitude: number;
      longitude: number;
      address: string;
      timestamp: string;
    };
    estimatedArrival?: string;
  };
  message: string;
}

export interface GojekPriceEstimateRequest {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  serviceType: 'instant' | 'same_day' | 'next_day';
  packageWeight?: number; // in grams
  packageValue?: number; // in IDR
}

export interface GojekPriceEstimateResponse {
  success: boolean;
  data: {
    serviceType: string;
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    insuranceFee: number;
    totalFee: number;
    currency: string;
    estimatedDuration: number; // in minutes
    estimatedDistance: number; // in km
    priceBreakdown: {
      baseFare: number;
      distanceFare: number;
      timeFare: number;
      weightFare: number;
      insuranceFee: number;
      serviceFee: number;
      totalFee: number;
    };
  };
  message: string;
}

@Injectable()
export class GojekApiService extends BaseApiService {
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get Gojek API configuration
   */
  private getApiConfig(credentials: GojekCredentials): ApiConfig {
    const baseUrl = credentials.isSandbox
      ? 'https://api-sandbox.gojek.com'
      : 'https://api.gojek.com';

    return {
      baseUrl,
      apiVersion: 'v1',
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 20,
      },
      authentication: {
        type: 'oauth',
        credentials: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          apiKey: credentials.apiKey,
        },
      },
    };
  }

  /**
   * Make authenticated request to Gojek API
   */
  async makeGojekRequest<T = any>(
    credentials: GojekCredentials,
    request: GojekApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);

    const gojekRequest: ApiRequest = {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': credentials.apiKey,
        'X-Merchant-ID': credentials.merchantId,
      },
    };

    // Add OAuth token if required
    if (request.requiresAuth !== false) {
      const accessToken = await this.getAccessToken(credentials);
      gojekRequest.headers = {
        ...gojekRequest.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    return this.makeRequest<T>(config, gojekRequest, tenantId, channelId);
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(credentials: GojekCredentials): Promise<string> {
    // Implementation would depend on Gojek OAuth flow
    // This is a simplified version
    const tokenRequest: ApiRequest = {
      method: 'POST',
      endpoint: '/oauth/token',
      data: {
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: 'delivery.read delivery.write',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const config = this.getApiConfig(credentials);
    const response = await this.makeRequest<{ access_token: string }>(
      config,
      tokenRequest,
      'system',
      'oauth',
    );

    if (response.success && response.data?.access_token) {
      return response.data.access_token;
    }

    throw new Error('Failed to obtain Gojek access token');
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: GojekCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      const request: GojekApiRequest = {
        method: 'GET',
        endpoint: '/delivery/v1/merchant/profile',
        requiresAuth: true,
      };

      return await this.makeGojekRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`Gojek connection test failed: ${error.message}`);
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
   * Get price estimate for delivery
   */
  async getPriceEstimate(
    credentials: GojekCredentials,
    request: GojekPriceEstimateRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<GojekPriceEstimateResponse>> {
    const apiRequest: GojekApiRequest = {
      method: 'POST',
      endpoint: '/delivery/v1/estimate',
      data: {
        pickup_latitude: request.pickupLatitude,
        pickup_longitude: request.pickupLongitude,
        dropoff_latitude: request.dropoffLatitude,
        dropoff_longitude: request.dropoffLongitude,
        service_type: request.serviceType,
        package_weight: request.packageWeight,
        package_value: request.packageValue,
      },
      requiresAuth: true,
    };

    return this.makeGojekRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Create delivery order
   */
  async createDelivery(
    credentials: GojekCredentials,
    deliveryData: GojekDeliveryRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<GojekDeliveryResponse>> {
    const apiRequest: GojekApiRequest = {
      method: 'POST',
      endpoint: '/delivery/v1/orders',
      data: {
        pickup: {
          name: deliveryData.pickup.name,
          phone: this.formatPhoneNumber(deliveryData.pickup.phone),
          address: deliveryData.pickup.address,
          district: deliveryData.pickup.district,
          city: deliveryData.pickup.city,
          state: deliveryData.pickup.state,
          postal_code: deliveryData.pickup.postalCode,
          latitude: deliveryData.pickup.latitude,
          longitude: deliveryData.pickup.longitude,
          notes: deliveryData.pickup.notes,
        },
        dropoff: {
          name: deliveryData.dropoff.name,
          phone: this.formatPhoneNumber(deliveryData.dropoff.phone),
          address: deliveryData.dropoff.address,
          district: deliveryData.dropoff.district,
          city: deliveryData.dropoff.city,
          state: deliveryData.dropoff.state,
          postal_code: deliveryData.dropoff.postalCode,
          latitude: deliveryData.dropoff.latitude,
          longitude: deliveryData.dropoff.longitude,
          notes: deliveryData.dropoff.notes,
        },
        package: {
          weight: deliveryData.package.weight,
          dimensions: {
            length: deliveryData.package.length,
            width: deliveryData.package.width,
            height: deliveryData.package.height,
          },
          description: deliveryData.package.description,
          value: deliveryData.package.value,
          quantity: deliveryData.package.quantity,
        },
        service_type: deliveryData.serviceType,
        payment_method: deliveryData.paymentMethod,
        is_cod: deliveryData.isCod || false,
        cod_amount: deliveryData.codAmount || 0,
        special_instructions: deliveryData.specialInstructions || [],
        scheduled_pickup_time: deliveryData.scheduledPickupTime,
      },
      requiresAuth: true,
    };

    return this.makeGojekRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Track delivery order
   */
  async trackDelivery(
    credentials: GojekCredentials,
    orderId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<GojekTrackingResponse>> {
    const apiRequest: GojekApiRequest = {
      method: 'GET',
      endpoint: `/delivery/v1/orders/${orderId}/track`,
      requiresAuth: true,
    };

    return this.makeGojekRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Cancel delivery order
   */
  async cancelDelivery(
    credentials: GojekCredentials,
    orderId: string,
    reason: string,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      cancellationFee?: number;
    }>
  > {
    const apiRequest: GojekApiRequest = {
      method: 'POST',
      endpoint: `/delivery/v1/orders/${orderId}/cancel`,
      data: {
        reason: reason,
      },
      requiresAuth: true,
    };

    return this.makeGojekRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Get available service types
   */
  async getServiceTypes(
    credentials: GojekCredentials,
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
          scheduledPickup: boolean;
        };
      }>
    >
  > {
    const apiRequest: GojekApiRequest = {
      method: 'GET',
      endpoint: '/delivery/v1/services',
      requiresAuth: true,
    };

    return this.makeGojekRequest(credentials, apiRequest, tenantId, channelId);
  }

  /**
   * Handle API errors specific to Gojek
   */
  handleGojekError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorCode = error.error_code || error.code || error.status;
    const errorMessage =
      error.error_description || error.message || 'Unknown Gojek API error';

    // Map common Gojek error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      INVALID_TOKEN: {
        message: 'Invalid or expired access token',
        retryable: true,
      },
      INSUFFICIENT_BALANCE: {
        message: 'Insufficient merchant balance',
        retryable: false,
      },
      INVALID_LOCATION: {
        message: 'Invalid pickup or dropoff location',
        retryable: false,
      },
      SERVICE_UNAVAILABLE: {
        message: 'Delivery service not available in this area',
        retryable: false,
      },
      DRIVER_NOT_FOUND: {
        message: 'No driver available at this time',
        retryable: true,
      },
      ORDER_NOT_FOUND: { message: 'Order not found', retryable: false },
      ORDER_ALREADY_CANCELLED: {
        message: 'Order already cancelled',
        retryable: false,
      },
      INVALID_PACKAGE_SIZE: {
        message: 'Package size exceeds limits',
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
      INVALID_COD_AMOUNT: { message: 'Invalid COD amount', retryable: false },
    };

    const mappedError = errorMap[errorCode];

    return {
      code: errorCode || 'GOJEK_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }

  /**
   * Convert Gojek status to our standard tracking status
   */
  mapGojekStatusToTrackingStatus(gojekStatus: string): string {
    const statusMap: Record<string, string> = {
      ORDER_CREATED: 'order_confirmed',
      DRIVER_ASSIGNED: 'assigned_to_driver',
      DRIVER_EN_ROUTE_TO_PICKUP: 'driver_heading_to_pickup',
      DRIVER_ARRIVED_AT_PICKUP: 'driver_arrived_pickup',
      PACKAGE_PICKED_UP: 'picked_up',
      DRIVER_EN_ROUTE_TO_DROPOFF: 'in_transit',
      DRIVER_ARRIVED_AT_DROPOFF: 'driver_arrived_dropoff',
      PACKAGE_DELIVERED: 'delivered',
      ORDER_CANCELLED: 'cancelled',
      DELIVERY_FAILED: 'delivery_failed',
      RETURNED_TO_SENDER: 'returned_to_sender',
    };

    return statusMap[gojekStatus.toUpperCase()] || 'in_transit';
  }

  /**
   * Format tracking data to our standard format
   */
  formatTrackingData(gojekTrackingData: any): any {
    return {
      orderId: gojekTrackingData.orderId,
      trackingNumber: gojekTrackingData.trackingNumber,
      status: this.mapGojekStatusToTrackingStatus(gojekTrackingData.status),
      driverInfo: gojekTrackingData.driverId
        ? {
            id: gojekTrackingData.driverId,
            name: gojekTrackingData.driverName,
            phone: gojekTrackingData.driverPhone,
            vehicle: gojekTrackingData.vehicleInfo,
          }
        : null,
      currentLocation: gojekTrackingData.currentLocation,
      estimatedArrival: gojekTrackingData.estimatedArrival,
      timeline:
        gojekTrackingData.timeline?.map((event: any) => ({
          timestamp: event.timestamp,
          status: this.mapGojekStatusToTrackingStatus(event.status),
          description: event.description,
          location: event.location,
          driverNotes: event.driverNotes,
        })) || [],
    };
  }

  /**
   * Format Indonesian phone number for Gojek API
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
   * Calculate distance between two coordinates (Haversine formula)
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
    credentials: GojekCredentials,
    latitude: number,
    longitude: number,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      isServiceable: boolean;
      availableServices: string[];
      nearestHub?: {
        name: string;
        latitude: number;
        longitude: number;
        distance: number;
      };
    }>
  > {
    const apiRequest: GojekApiRequest = {
      method: 'GET',
      endpoint: `/delivery/v1/coverage?latitude=${latitude}&longitude=${longitude}`,
      requiresAuth: true,
    };

    return this.makeGojekRequest(credentials, apiRequest, tenantId, channelId);
  }
}
