import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseApiService, ApiConfig, ApiRequest, ApiResponse } from '../../../../integrations/common/services/base-api.service';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';

export interface JntCredentials {
  customerCode: string;
  apiKey: string;
  secretKey: string;
  isSandbox?: boolean;
}

export interface JntApiRequest extends Omit<ApiRequest, 'headers'> {
  requiresAuth?: boolean;
  timestamp?: number;
}

export interface JntRateRequest {
  sender: {
    province: string;
    city: string;
    area: string;
  };
  receiver: {
    province: string;
    city: string;
    area: string;
  };
  weight: number; // in kg
  itemType: string; // DOC, SPX, etc.
}

export interface JntRateResponse {
  success: boolean;
  data: {
    fee: number;
    deliveryType: string;
    timeLimit: string;
    originalFee: number;
    discountFee: number;
  };
  msg: string;
}

export interface JntBookingRequest {
  expressType: string; // Standard Express, Special Goods Express
  serviceType: string; // deliver, pickup
  deliveryType: string; // COD, PREPAID
  payType: string; // PP_PM, CC_CASH, etc.
  sender: {
    name: string;
    mobile: string;
    phone?: string;
    company?: string;
    countryCode: string;
    province: string;
    city: string;
    area: string;
    address: string;
    postCode: string;
  };
  receiver: {
    name: string;
    mobile: string;
    phone?: string;
    company?: string;
    countryCode: string;
    province: string;
    city: string;
    area: string;
    address: string;
    postCode: string;
  };
  items: Array<{
    itemName: string;
    itemType: string;
    weight: number;
    length: number;
    width: number;
    height: number;
    quantity: number;
    itemValue: number;
    currency: string;
  }>;
  totalWeight: number;
  totalQuantity: number;
  goodsValue: number;
  codAmount?: number;
  remark?: string;
}

export interface JntBookingResponse {
  success: boolean;
  data: {
    customerCode: string;
    txLogisticId: string;
    awbNo: string;
    pdfUrl: string;
    orderStatus: string;
    feeAmount: number;
    currency: string;
  };
  msg: string;
}

export interface JntTrackingResponse {
  success: boolean;
  data: Array<{
    txLogisticId: string;
    awbNo: string;
    details: Array<{
      scanTime: string;
      scanType: string;
      desc: string;
      city: string;
    }>;
  }>;
  msg: string;
}

@Injectable()
export class JntApiService extends BaseApiService {
  private readonly logger = new Logger(JntApiService.name);
  
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get J&T API configuration
   */
  private getApiConfig(credentials: JntCredentials): ApiConfig {
    const baseUrl = credentials.isSandbox 
      ? 'https://openapi-uat.jtexpress.com.my'
      : 'https://openapi.jtexpress.com.my';

    return {
      baseUrl,
      apiVersion: 'webopenplatformapi',
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 200,
        burstLimit: 50,
      },
      authentication: {
        type: 'signature',
        credentials,
      },
    };
  }

  /**
   * Make authenticated request to J&T API
   */
  async makeJntRequest<T = any>(
    credentials: JntCredentials,
    request: JntApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);
    
    const timestamp = request.timestamp || Math.floor(Date.now() / 1000);
    const signature = this.generateJntSignature(
      credentials,
      request,
      timestamp,
    );

    const jntRequest: ApiRequest = {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'charset': 'utf-8',
        'apiAccount': credentials.customerCode,
        'timestamp': timestamp.toString(),
        'signature': signature,
        ...request.headers,
      },
    };

    return this.makeRequest<T>(config, jntRequest, tenantId, channelId);
  }

  /**
   * Generate J&T API signature
   */
  private generateJntSignature(
    credentials: JntCredentials,
    request: JntApiRequest,
    timestamp: number,
  ): string {
    // J&T signature format: base64(HMAC-SHA256(apiAccount + timestamp + secretKey + requestBody))
    const requestBody = request.data ? JSON.stringify(request.data) : '';
    const stringToSign = `${credentials.customerCode}${timestamp}${credentials.secretKey}${requestBody}`;
    
    return crypto
      .createHmac('sha256', credentials.secretKey)
      .update(stringToSign)
      .digest('base64');
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: JntCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      // Use getArea endpoint for connection test
      const request: JntApiRequest = {
        method: 'POST',
        endpoint: '/area/getArea',
        data: {
          lang: 'en',
          countryCode: 'ID',
        },
        requiresAuth: true,
      };

      return await this.makeJntRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`J&T connection test failed: ${error.message}`);
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
   * Get areas (cities/districts)
   */
  async getAreas(
    credentials: JntCredentials,
    countryCode: string = 'ID',
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<Array<{
    provinceName: string;
    cityName: string;
    areaName: string;
    postCode: string;
  }>>> {
    const request: JntApiRequest = {
      method: 'POST',
      endpoint: '/area/getArea',
      data: {
        lang: 'en',
        countryCode,
      },
      requiresAuth: true,
    };

    return this.makeJntRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get shipping rates
   */
  async getShippingRates(
    credentials: JntCredentials,
    rateRequest: JntRateRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<JntRateResponse>> {
    const request: JntApiRequest = {
      method: 'POST',
      endpoint: '/order/getPrice',
      data: rateRequest,
      requiresAuth: true,
    };

    return this.makeJntRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Create booking/shipment
   */
  async createBooking(
    credentials: JntCredentials,
    bookingData: JntBookingRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<JntBookingResponse>> {
    const request: JntApiRequest = {
      method: 'POST',
      endpoint: '/order/addOrder',
      data: bookingData,
      requiresAuth: true,
    };

    return this.makeJntRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Track shipment
   */
  async trackShipment(
    credentials: JntCredentials,
    trackingNumbers: string[], // J&T supports multiple tracking numbers
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<JntTrackingResponse>> {
    const request: JntApiRequest = {
      method: 'POST',
      endpoint: '/track/getTrack',
      data: {
        awbNoList: trackingNumbers,
      },
      requiresAuth: true,
    };

    return this.makeJntRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Cancel booking
   */
  async cancelBooking(
    credentials: JntCredentials,
    txLogisticId: string,
    reason: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    success: boolean;
    msg: string;
  }>> {
    const request: JntApiRequest = {
      method: 'POST',
      endpoint: '/order/cancelOrder',
      data: {
        txLogisticId,
        reason,
      },
      requiresAuth: true,
    };

    return this.makeJntRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get order status
   */
  async getOrderStatus(
    credentials: JntCredentials,
    txLogisticId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    txLogisticId: string;
    awbNo: string;
    orderStatus: string;
    expressType: string;
    deliveryType: string;
    weight: number;
    feeAmount: number;
    createTime: string;
    updateTime: string;
  }>> {
    const request: JntApiRequest = {
      method: 'POST',
      endpoint: '/order/getOrder',
      data: {
        txLogisticId,
      },
      requiresAuth: true,
    };

    return this.makeJntRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Handle API errors specific to J&T
   */
  handleJntError(error: any): { code: string; message: string; retryable: boolean } {
    const errorCode = error.error_code || error.code;
    const errorMessage = error.error_description || error.message || error.msg || 'Unknown J&T API error';

    // Map common J&T error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      'AUTH_FAILED': { message: 'Authentication failed', retryable: false },
      'INVALID_SIGNATURE': { message: 'Invalid signature', retryable: false },
      'RATE_LIMIT_EXCEEDED': { message: 'Rate limit exceeded', retryable: true },
      'INVALID_AREA': { message: 'Invalid pickup or delivery area', retryable: false },
      'WEIGHT_EXCEEDED': { message: 'Weight exceeds limit', retryable: false },
      'SERVICE_NOT_AVAILABLE': { message: 'Service not available for this route', retryable: false },
      'INVALID_ORDER_DATA': { message: 'Invalid order data', retryable: false },
      'ORDER_NOT_FOUND': { message: 'Order not found', retryable: false },
      'ORDER_ALREADY_CANCELLED': { message: 'Order already cancelled', retryable: false },
      'SYSTEM_ERROR': { message: 'System temporarily unavailable', retryable: true },
      'INSUFFICIENT_BALANCE': { message: 'Insufficient account balance', retryable: false },
      'DUPLICATE_ORDER': { message: 'Duplicate order reference', retryable: false },
    };

    const mappedError = errorMap[errorCode];
    
    return {
      code: errorCode || 'JNT_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }

  /**
   * Convert J&T express types to our standard service types
   */
  mapJntExpressTypeToServiceType(jntExpressType: string): string {
    const serviceMap: Record<string, string> = {
      'Standard Express': 'regular',
      'Special Goods Express': 'express',
      'Economy Express': 'economy',
      'Premium Express': 'premium',
      'Same Day': 'same_day',
      'Next Day': 'next_day',
    };

    return serviceMap[jntExpressType] || 'regular';
  }

  /**
   * Convert J&T scan types to our standard tracking status
   */
  mapJntScanTypeToTrackingStatus(scanType: string): string {
    const statusMap: Record<string, string> = {
      'Order Created': 'order_confirmed',
      'Picked Up': 'picked_up',
      'Departed from Origin': 'departed_origin',
      'Arrived at Hub': 'arrived_at_hub',
      'Departed from Hub': 'departed_hub',
      'In Transit': 'in_transit',
      'Arrived at Destination Hub': 'arrived_at_destination_hub',
      'Out for Delivery': 'out_for_delivery',
      'Delivered': 'delivered',
      'Delivery Failed': 'delivery_attempted',
      'Returned to Hub': 'on_hold',
      'Cancelled': 'cancelled',
      'Exception': 'exception',
      'Delayed': 'delayed',
    };

    return statusMap[scanType] || 'in_transit';
  }

  /**
   * Format J&T tracking data to our standard format
   */
  formatTrackingData(jntTrackingData: any): any {
    return {
      txLogisticId: jntTrackingData.txLogisticId,
      trackingNumber: jntTrackingData.awbNo,
      events: jntTrackingData.details?.map((event: any) => ({
        dateTime: event.scanTime,
        description: event.desc,
        location: event.city,
        scanType: event.scanType,
        status: this.mapJntScanTypeToTrackingStatus(event.scanType),
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
   * Format Indonesian phone number for J&T API
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // J&T expects format without country code for mobile
    if (cleaned.startsWith('62')) {
      return `0${cleaned.substring(2)}`;
    } else if (cleaned.startsWith('0')) {
      return cleaned;
    } else {
      return `0${cleaned}`;
    }
  }

  /**
   * Calculate volumetric weight for J&T (formula: L x W x H / 5000)
   */
  calculateVolumetricWeight(length: number, width: number, height: number): number {
    return (length * width * height) / 5000; // J&T formula
  }

  /**
   * Get chargeable weight (higher of actual or volumetric weight)
   */
  getChargeableWeight(actualWeight: number, length: number, width: number, height: number): number {
    const volumetricWeight = this.calculateVolumetricWeight(length, width, height);
    return Math.max(actualWeight, volumetricWeight);
  }

  /**
   * Get J&T service types
   */
  getServiceTypes(): Array<{
    code: string;
    name: string;
    description: string;
    features: {
      cod: boolean;
      insurance: boolean;
      sameDay: boolean;
      nextDay: boolean;
    };
    maxWeight: number; // in kg
  }> {
    return [
      {
        code: 'STANDARD',
        name: 'Standard Express',
        description: 'Regular delivery service',
        features: {
          cod: true,
          insurance: true,
          sameDay: false,
          nextDay: false,
        },
        maxWeight: 30,
      },
      {
        code: 'SPECIAL',
        name: 'Special Goods Express',
        description: 'For fragile and valuable items',
        features: {
          cod: false,
          insurance: true,
          sameDay: false,
          nextDay: false,
        },
        maxWeight: 20,
      },
      {
        code: 'ECONOMY',
        name: 'Economy Express',
        description: 'Cost-effective delivery',
        features: {
          cod: true,
          insurance: false,
          sameDay: false,
          nextDay: false,
        },
        maxWeight: 50,
      },
    ];
  }

  /**
   * Get item types for J&T API
   */
  getItemTypes(): Array<{
    code: string;
    name: string;
    description: string;
  }> {
    return [
      { code: 'DOC', name: 'Document', description: 'Documents and papers' },
      { code: 'SPX', name: 'Small Parcel', description: 'Small packages' },
      { code: 'MPX', name: 'Medium Parcel', description: 'Medium packages' },
      { code: 'LPX', name: 'Large Parcel', description: 'Large packages' },
      { code: 'BLK', name: 'Bulk', description: 'Bulk items' },
      { code: 'FRG', name: 'Fragile', description: 'Fragile items' },
      { code: 'LQD', name: 'Liquid', description: 'Liquid items' },
    ];
  }

  /**
   * Determine appropriate item type based on package info
   */
  determineItemType(packageInfo: {
    weight: number; // in grams
    length: number;
    width: number;
    height: number;
    isFragile?: boolean;
    isLiquid?: boolean;
    content?: string;
  }): string {
    if (packageInfo.isFragile) return 'FRG';
    if (packageInfo.isLiquid) return 'LQD';
    
    const weightKg = packageInfo.weight / 1000;
    const volume = packageInfo.length * packageInfo.width * packageInfo.height;
    
    if (packageInfo.content?.toLowerCase().includes('document')) return 'DOC';
    if (weightKg <= 1 && volume <= 100000) return 'SPX'; // Small parcel
    if (weightKg <= 5 && volume <= 500000) return 'MPX'; // Medium parcel
    if (weightKg <= 30) return 'LPX'; // Large parcel
    
    return 'BLK'; // Bulk
  }
}