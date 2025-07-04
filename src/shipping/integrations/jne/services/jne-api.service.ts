import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseApiService,
  ApiConfig,
  ApiRequest,
  ApiResponse,
} from '../../../../integrations/common/services/base-api.service';
import { HttpService } from '@nestjs/axios';

export interface JneCredentials {
  username: string;
  apiKey: string;
  isSandbox?: boolean;
}

export interface JneApiRequest extends Omit<ApiRequest, 'headers'> {
  requiresAuth?: boolean;
}

export interface JneOriginDestination {
  origin: string; // City code
  destination: string; // City code
}

export interface JnePackage {
  weight: number; // in kg
  length?: number; // in cm
  width?: number; // in cm
  height?: number; // in cm
}

export interface JneRateResponse {
  code: string;
  name: string;
  costs: Array<{
    service: string;
    description: string;
    cost: Array<{
      value: number;
      etd: string;
      note: string;
    }>;
  }>;
}

export interface JneTrackingResponse {
  code: string;
  status: string;
  result: {
    delivered: boolean;
    detail: Array<{
      date: string;
      time: string;
      desc: string;
      city: string;
    }>;
  };
}

@Injectable()
export class JneApiService extends BaseApiService {
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get JNE API configuration
   */
  private getApiConfig(credentials: JneCredentials): ApiConfig {
    const baseUrl = credentials.isSandbox
      ? 'https://api-sandbox.jne.co.id'
      : 'https://api.jne.co.id';

    return {
      baseUrl,
      apiVersion: 'api',
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 100,
        burstLimit: 20,
      },
      authentication: {
        type: 'apikey',
        credentials: {
          username: credentials.username,
          apiKey: credentials.apiKey,
        },
      },
    };
  }

  /**
   * Make authenticated request to JNE API
   */
  async makeJneRequest<T = any>(
    credentials: JneCredentials,
    request: JneApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);

    const jneRequest: ApiRequest = {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    // Add authentication
    if (request.requiresAuth !== false) {
      jneRequest.headers = {
        ...jneRequest.headers,
        username: credentials.username,
        api_key: credentials.apiKey,
      };
    }

    return this.makeRequest<T>(config, jneRequest, tenantId, channelId);
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: JneCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      const request: JneApiRequest = {
        method: 'GET',
        endpoint: '/tarif/v1/city',
        requiresAuth: true,
      };

      return await this.makeJneRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`JNE connection test failed: ${error.message}`);
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
   * Get list of cities
   */
  async getCities(
    credentials: JneCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<
      Array<{
        city_code: string;
        city_name: string;
        province: string;
        type: string;
      }>
    >
  > {
    const request: JneApiRequest = {
      method: 'GET',
      endpoint: '/tarif/v1/city',
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Get shipping rates
   */
  async getShippingRates(
    credentials: JneCredentials,
    params: {
      from: string; // origin city code
      to: string; // destination city code
      weight: number; // in kg
    },
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<JneRateResponse[]>> {
    const request: JneApiRequest = {
      method: 'POST',
      endpoint: '/tarif/v1/rates',
      data: {
        from: params.from,
        to: params.to,
        weight: params.weight,
      },
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Create shipping label (book shipment)
   */
  async createShipment(
    credentials: JneCredentials,
    shipmentData: {
      from: {
        name: string;
        address: string;
        city: string;
        postal_code: string;
        phone: string;
      };
      to: {
        name: string;
        address: string;
        city: string;
        postal_code: string;
        phone: string;
      };
      package: {
        weight: number; // in kg
        length: number; // in cm
        width: number; // in cm
        height: number; // in cm
        content: string;
        value: number; // in IDR
      };
      service: string; // JNE service code (REG, YES, OKE, etc.)
      insurance?: boolean;
      cod?: {
        amount: number;
      };
    },
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      tracking_number: string;
      airway_bill: string;
      label_url: string;
      total_cost: number;
      service_cost: number;
      insurance_cost?: number;
      cod_fee?: number;
    }>
  > {
    const request: JneApiRequest = {
      method: 'POST',
      endpoint: '/booking/v1/create',
      data: shipmentData,
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Track shipment
   */
  async trackShipment(
    credentials: JneCredentials,
    trackingNumber: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<JneTrackingResponse>> {
    const request: JneApiRequest = {
      method: 'GET',
      endpoint: `/tracking/v1/trace/${trackingNumber}`,
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Get tracking history
   */
  async getTrackingHistory(
    credentials: JneCredentials,
    trackingNumber: string,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      tracking_number: string;
      service: string;
      status: string;
      tracking_detail: Array<{
        date: string;
        time: string;
        description: string;
        location: string;
        status: string;
      }>;
    }>
  > {
    const request: JneApiRequest = {
      method: 'GET',
      endpoint: `/tracking/v1/history/${trackingNumber}`,
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(
    credentials: JneCredentials,
    trackingNumber: string,
    reason: string,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<{
      tracking_number: string;
      status: string;
      message: string;
    }>
  > {
    const request: JneApiRequest = {
      method: 'POST',
      endpoint: '/booking/v1/cancel',
      data: {
        tracking_number: trackingNumber,
        reason: reason,
      },
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Get service types
   */
  async getServices(
    credentials: JneCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<
    ApiResponse<
      Array<{
        service_code: string;
        service_name: string;
        service_display_name: string;
        description: string;
        max_weight: number;
        max_dimension: {
          length: number;
          width: number;
          height: number;
        };
        features: {
          cod: boolean;
          insurance: boolean;
          same_day: boolean;
          next_day: boolean;
        };
      }>
    >
  > {
    const request: JneApiRequest = {
      method: 'GET',
      endpoint: '/info/v1/services',
      requiresAuth: true,
    };

    return this.makeJneRequest(credentials, request, tenantId, channelId);
  }

  /**
   * Handle API errors specific to JNE
   */
  handleJneError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    const errorCode = error.error_code || error.code;
    const errorMessage =
      error.error_description || error.message || 'Unknown JNE API error';

    // Map common JNE error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      J001: { message: 'Invalid API credentials', retryable: false },
      J002: { message: 'Rate limit exceeded', retryable: true },
      J003: { message: 'Invalid origin city', retryable: false },
      J004: { message: 'Invalid destination city', retryable: false },
      J005: { message: 'Weight exceeds limit', retryable: false },
      J006: { message: 'Service not available for route', retryable: false },
      J007: { message: 'Invalid shipment data', retryable: false },
      J008: { message: 'Tracking number not found', retryable: false },
      J009: { message: 'Shipment already cancelled', retryable: false },
      J010: { message: 'Service temporarily unavailable', retryable: true },
      J011: { message: 'Insufficient balance', retryable: false },
      J012: { message: 'Booking expired', retryable: false },
    };

    const mappedError = errorMap[errorCode];

    return {
      code: errorCode || 'JNE_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }

  /**
   * Convert JNE service codes to our standard service types
   */
  mapJneServiceToServiceType(jneServiceCode: string): string {
    const serviceMap: Record<string, string> = {
      REG: 'regular',
      YES: 'express', // Yakin Esok Sampai
      OKE: 'economy',
      SS: 'same_day', // Super Speed
      SPS: 'express', // Super Priority Service
      JTR: 'regular', // JNE Trucking Regular
      CTCYES: 'express', // City Courier YES
      CTCREG: 'regular', // City Courier Regular
    };

    return serviceMap[jneServiceCode.toUpperCase()] || 'regular';
  }

  /**
   * Convert JNE tracking status to our standard tracking status
   */
  mapJneStatusToTrackingStatus(jneStatus: string): string {
    const statusMap: Record<string, string> = {
      BOOKED: 'order_confirmed',
      MANIFESTED: 'picked_up',
      'ON TRANSIT': 'in_transit',
      RECEIVED: 'arrived_at_hub',
      'WITH DELIVERY COURIER': 'out_for_delivery',
      DELIVERED: 'delivered',
      'RETURNED TO SHIPPER': 'returned_to_sender',
      CANCELLED: 'cancelled',
      'ON HOLD': 'on_hold',
      EXCEPTION: 'exception',
    };

    return statusMap[jneStatus.toUpperCase()] || 'in_transit';
  }

  /**
   * Format JNE tracking data to our standard format
   */
  formatTrackingData(jneTrackingData: any): any {
    return {
      trackingNumber: jneTrackingData.tracking_number,
      status: this.mapJneStatusToTrackingStatus(jneTrackingData.status),
      isDelivered: jneTrackingData.result?.delivered || false,
      events:
        jneTrackingData.result?.detail?.map((event: any) => ({
          date: event.date,
          time: event.time,
          description: event.desc,
          location: event.city,
          status: this.mapJneStatusToTrackingStatus(event.desc),
        })) || [],
    };
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
   * Format Indonesian phone number for JNE API
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
   * Calculate volumetric weight for JNE (formula: L x W x H / 6000)
   */
  calculateVolumetricWeight(
    length: number,
    width: number,
    height: number,
  ): number {
    return (length * width * height) / 6000; // JNE formula
  }

  /**
   * Get chargeable weight (higher of actual or volumetric weight)
   */
  getChargeableWeight(
    actualWeight: number,
    length: number,
    width: number,
    height: number,
  ): number {
    const volumetricWeight = this.calculateVolumetricWeight(
      length,
      width,
      height,
    );
    return Math.max(actualWeight, volumetricWeight);
  }
}
