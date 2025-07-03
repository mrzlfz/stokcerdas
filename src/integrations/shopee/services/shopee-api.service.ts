import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseApiService, ApiConfig, ApiRequest, ApiResponse } from '../../common/services/base-api.service';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';

export interface ShopeeCredentials {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  isSandbox?: boolean;
}

export interface ShopeeApiRequest extends ApiRequest {
  shopId?: string;
  requiresAuth?: boolean;
  timestamp?: number;
}

@Injectable()
export class ShopeeApiService extends BaseApiService {
  protected readonly logger = new Logger(ShopeeApiService.name);
  
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get Shopee API configuration
   */
  private getApiConfig(credentials: ShopeeCredentials): ApiConfig {
    const baseUrl = credentials.isSandbox 
      ? 'https://partner.test-stable.shopeemobile.com'
      : 'https://partner.shopeemobile.com';

    return {
      baseUrl,
      apiVersion: 'api/v2',
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 1000,
        burstLimit: 100,
      },
      authentication: {
        type: 'signature',
        credentials,
      },
    };
  }

  /**
   * Make authenticated request to Shopee API
   */
  async makeShopeeRequest<T = any>(
    credentials: ShopeeCredentials,
    request: ShopeeApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);
    
    // Add Shopee-specific headers and signature
    const timestamp = request.timestamp || Math.floor(Date.now() / 1000);
    const signature = this.generateShopeeSignature(
      credentials,
      request,
      timestamp,
    );

    const shopeeRequest: ApiRequest = {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StokCerdas/1.0',
        ...request.headers,
      },
    };

    // Add authentication parameters
    if (request.requiresAuth !== false) {
      shopeeRequest.params = {
        ...shopeeRequest.params,
        partner_id: credentials.partnerId,
        timestamp,
        access_token: credentials.accessToken,
        shop_id: request.shopId || credentials.shopId,
        sign: signature,
      };
    } else {
      // For endpoints that don't require shop-level auth
      shopeeRequest.params = {
        ...shopeeRequest.params,
        partner_id: credentials.partnerId,
        timestamp,
        sign: signature,
      };
    }

    return this.makeRequest<T>(config, shopeeRequest, tenantId, channelId);
  }

  /**
   * Generate Shopee API signature
   */
  private generateShopeeSignature(
    credentials: ShopeeCredentials,
    request: ShopeeApiRequest,
    timestamp: number,
  ): string {
    // Shopee signature format: HMAC-SHA256 of concatenated string
    // Format: {partner_id}{api_path}{timestamp}{access_token}{shop_id}
    
    const apiPath = `/api/v2${request.endpoint}`;
    const accessToken = request.requiresAuth !== false ? credentials.accessToken : '';
    const shopId = request.requiresAuth !== false ? (request.shopId || credentials.shopId) : '';
    
    const baseString = `${credentials.partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    
    return crypto
      .createHmac('sha256', credentials.partnerKey)
      .update(baseString)
      .digest('hex');
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/shop/get_shop_info',
        requiresAuth: true,
      };

      return await this.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`Shopee connection test failed: ${error.message}`);
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
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(
    partnerId: string,
    redirectUri: string,
    state?: string,
    isSandbox: boolean = false,
  ): string {
    const baseUrl = isSandbox 
      ? 'https://partner.test-stable.shopeemobile.com'
      : 'https://partner.shopeemobile.com';

    const params = new URLSearchParams({
      partner_id: partnerId,
      redirect: redirectUri,
    });

    if (state) {
      params.append('state', state);
    }

    return `${baseUrl}/api/v2/shop/auth_partner?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(
    credentials: Omit<ShopeeCredentials, 'accessToken' | 'shopId'>,
    authCode: string,
    shopId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    merchant_id: string;
    shop_id: string;
  }>> {
    const tempCredentials: ShopeeCredentials = {
      ...credentials,
      accessToken: '', // Not needed for this endpoint
      shopId,
    };

    const request: ShopeeApiRequest = {
      method: 'POST',
      endpoint: '/auth/token/get',
      data: {
        code: authCode,
        shop_id: parseInt(shopId),
        partner_id: parseInt(credentials.partnerId),
      },
      requiresAuth: false,
    };

    return this.makeShopeeRequest(
      tempCredentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    merchant_id: string;
    shop_id: string;
  }>> {
    const request: ShopeeApiRequest = {
      method: 'POST',
      endpoint: '/auth/access_token/get',
      data: {
        refresh_token: credentials.refreshToken,
        partner_id: parseInt(credentials.partnerId),
        shop_id: parseInt(credentials.shopId),
      },
      requiresAuth: false,
    };

    return this.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get shop information
   */
  async getShopInfo(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    shop_id: number;
    shop_name: string;
    region: string;
    status: string;
    sip_affi_shops: any[];
    is_cb: boolean;
    is_cnsc: boolean;
  }>> {
    const request: ShopeeApiRequest = {
      method: 'GET',
      endpoint: '/shop/get_shop_info',
      requiresAuth: true,
    };

    return this.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get shop profile
   */
  async getShopProfile(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    shop_name: string;
    shop_logo: string;
    description: string;
    country: string;
    status: string;
  }>> {
    const request: ShopeeApiRequest = {
      method: 'GET',
      endpoint: '/shop/get_profile',
      requiresAuth: true,
    };

    return this.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Verify webhook signature from Shopee
   */
  verifyShopeeWebhook(
    payload: string,
    authorizationHeader: string,
    partnerKey: string,
  ): boolean {
    try {
      // Shopee webhook signature format: {webhook_url}|{request_body}
      const url = this.configService.get<string>('SHOPEE_WEBHOOK_URL');
      const stringToSign = `${url}|${payload}`;
      
      const expectedSignature = crypto
        .createHmac('sha256', partnerKey)
        .update(stringToSign)
        .digest('hex');

      // Extract signature from Authorization header
      const receivedSignature = authorizationHeader.replace(/^sha256=/, '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error(`Shopee webhook verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle API errors specific to Shopee
   */
  handleShopeeError(error: any): { code: string; message: string; retryable: boolean } {
    const errorCode = error.error_code || error.code;
    const errorMessage = error.error_description || error.message || 'Unknown Shopee API error';

    // Map common Shopee error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      'E1001': { message: 'Invalid partner ID', retryable: false },
      'E1002': { message: 'Invalid signature', retryable: false },
      'E1003': { message: 'Invalid timestamp', retryable: true },
      'E1004': { message: 'Invalid access token', retryable: false },
      'E1005': { message: 'Invalid shop ID', retryable: false },
      'E1006': { message: 'Permission denied', retryable: false },
      'E1007': { message: 'Rate limit exceeded', retryable: true },
      'E1008': { message: 'Invalid request format', retryable: false },
      'E1009': { message: 'Service temporarily unavailable', retryable: true },
      'E1010': { message: 'Shop not authorized', retryable: false },
    };

    const mappedError = errorMap[errorCode];
    
    return {
      code: errorCode || 'SHOPEE_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }
}