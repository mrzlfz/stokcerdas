import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import { BaseApiService } from '../../common/services/base-api.service';
import { RateLimiterService } from '../../common/services/rate-limiter.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface TokopediaConfig {
  clientId: string;
  clientSecret: string;
  fsId: string; // Fulfillment Service ID
  shopId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  sandbox?: boolean;
  region?: 'ID'; // Tokopedia is primarily Indonesia
}

export interface TokopediaRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  params?: Record<string, any>;
  data?: any;
  requiresAuth?: boolean;
  retryCount?: number;
}

export interface TokopediaApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
  processingTime?: number;
}

export interface TokopediaShopInfo {
  shop_id: number;
  shop_name: string;
  shop_domain: string;
  shop_avatar: string;
  shop_status: string;
  shop_tier: number;
  shop_location: string;
  shop_created: string;
  is_gold_merchant: boolean;
  is_official_store: boolean;
}

@Injectable()
export class TokopediaApiService extends BaseApiService {
  private readonly logger = new Logger(TokopediaApiService.name);
  private readonly baseUrls = {
    sandbox: 'https://fs.tokopedia.net',
    production: 'https://fs.tokopedia.net',
  };

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    protected readonly rateLimiter: RateLimiterService,
    protected readonly logService: IntegrationLogService,
  ) {
    super(httpService, configService, rateLimiter, logService);
  }

  /**
   * Make API request to Tokopedia with proper authentication and rate limiting
   */
  async makeRequest<T = any>(
    tenantId: string,
    channelId: string,
    config: TokopediaConfig,
    requestConfig: TokopediaRequestConfig,
  ): Promise<TokopediaApiResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('tokopedia');

    try {
      // Check rate limits (Tokopedia: 1000 requests per minute)
      await this.rateLimiter.checkLimit(
        tenantId,
        channelId,
        'tokopedia',
        1000,
        60000, // 1 minute window
      );

      const baseUrl = config.sandbox ? this.baseUrls.sandbox : this.baseUrls.production;
      const url = `${baseUrl}${requestConfig.endpoint}`;

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'StokCerdas-Tokopedia-Integration/1.0',
      };

      // Add authentication if required
      if (requestConfig.requiresAuth !== false && config.accessToken) {
        headers['Authorization'] = `Bearer ${config.accessToken}`;
      }

      // Add shop context headers
      if (config.fsId) {
        headers['X-Tokopedia-Fs-Id'] = config.fsId;
      }

      if (config.shopId) {
        headers['X-Tokopedia-Shop-Id'] = config.shopId;
      }

      // Make the API request
      const axiosConfig = {
        method: requestConfig.method,
        url,
        headers,
        params: requestConfig.params,
        data: requestConfig.data,
        timeout: 30000, // 30 seconds
        validateStatus: (status: number) => status < 500, // Don't throw on 4xx errors
      };

      this.logger.debug('Making Tokopedia API request', {
        tenantId,
        channelId,
        method: requestConfig.method,
        endpoint: requestConfig.endpoint,
        requestId,
      });

      const response = await firstValueFrom(this.httpService.request(axiosConfig));
      const processingTime = Date.now() - startTime;

      // Log the request
      await this.logService.logApiRequest(
        tenantId,
        channelId,
        'tokopedia',
        requestConfig.method,
        requestConfig.endpoint,
        response.status,
        processingTime,
        {
          requestId,
          headers: this.sanitizeHeaders(headers),
          params: requestConfig.params,
          responseHeaders: this.sanitizeHeaders(response.headers),
          success: response.status < 400,
        },
      );

      // Handle response
      if (response.status >= 400) {
        const errorMessage = this.extractErrorMessage(response.data);
        return {
          success: false,
          error: errorMessage,
          requestId,
          processingTime,
        };
      }

      return {
        success: true,
        data: response.data,
        requestId,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Tokopedia API error: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
        stack: error.stack,
        requestId,
        processingTime,
      });

      // Log error
      await this.logService.logApiRequest(
        tenantId,
        channelId,
        'tokopedia',
        requestConfig.method,
        requestConfig.endpoint,
        error.response?.status || 0,
        processingTime,
        {
          requestId,
          error: error.message,
          success: false,
        },
      );

      return {
        success: false,
        error: error.message,
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Get shop information
   */
  async getShopInfo(
    tenantId: string,
    channelId: string,
    config: TokopediaConfig,
  ): Promise<TokopediaApiResponse<TokopediaShopInfo>> {
    return this.makeRequest<TokopediaShopInfo>(
      tenantId,
      channelId,
      config,
      {
        method: 'GET',
        endpoint: '/v1/shop/info',
        requiresAuth: true,
      },
    );
  }

  /**
   * Test API connection and authentication
   */
  async testConnection(
    tenantId: string,
    channelId: string,
    config: TokopediaConfig,
  ): Promise<TokopediaApiResponse<{ status: string; shop_id: string }>> {
    try {
      const shopInfo = await this.getShopInfo(tenantId, channelId, config);
      
      if (shopInfo.success) {
        return {
          success: true,
          data: {
            status: 'connected',
            shop_id: shopInfo.data.shop_id.toString(),
          },
        };
      } else {
        return {
          success: false,
          error: shopInfo.error || 'Connection test failed',
        };
      }

    } catch (error) {
      this.logger.error(`Tokopedia connection test failed: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: `Connection test failed: ${error.message}`,
      };
    }
  }

  /**
   * Get available categories
   */
  async getCategories(
    tenantId: string,
    channelId: string,
    config: TokopediaConfig,
  ): Promise<TokopediaApiResponse<any[]>> {
    return this.makeRequest(
      tenantId,
      channelId,
      config,
      {
        method: 'GET',
        endpoint: '/v1/products/categories',
        requiresAuth: true,
      },
    );
  }

  /**
   * Get webhook events for testing
   */
  async getWebhookEvents(
    tenantId: string,
    channelId: string,
    config: TokopediaConfig,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TokopediaApiResponse<any[]>> {
    const params: Record<string, any> = {};
    
    if (startDate) {
      params.start_date = startDate.toISOString();
    }
    
    if (endDate) {
      params.end_date = endDate.toISOString();
    }

    return this.makeRequest(
      tenantId,
      channelId,
      config,
      {
        method: 'GET',
        endpoint: '/v1/webhook/events',
        params,
        requiresAuth: true,
      },
    );
  }

  // Private helper methods

  private generateRequestId(platform: string): string {
    return `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'x-tokopedia-client-secret',
      'x-api-key',
      'cookie',
      'set-cookie',
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
      if (sanitized[header.toLowerCase()]) {
        sanitized[header.toLowerCase()] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private extractErrorMessage(errorData: any): string {
    if (typeof errorData === 'string') {
      return errorData;
    }

    if (errorData?.message) {
      return errorData.message;
    }

    if (errorData?.error) {
      return typeof errorData.error === 'string' ? errorData.error : errorData.error.message;
    }

    if (errorData?.errors && Array.isArray(errorData.errors)) {
      return errorData.errors.map(err => err.message || err).join(', ');
    }

    return 'Unknown API error';
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  generateWebhookSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}