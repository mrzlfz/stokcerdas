import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map, catchError } from 'rxjs';
import { throwError } from 'rxjs';
import * as crypto from 'crypto';

import { BaseApiService, ApiConfig, ApiRequest, ApiResponse } from '../../common/services/base-api.service';
import { RateLimiterService } from '../../common/services/rate-limiter.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export enum LazadaRegion {
  MY = 'MY',
  SG = 'SG',
  TH = 'TH',
  ID = 'ID',
  PH = 'PH',
  VN = 'VN',
}

export interface LazadaConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
  region: LazadaRegion;
  sandbox?: boolean;
}

export interface LazadaRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  params?: Record<string, any>;
  body?: Record<string, any>;
  requiresAuth?: boolean;
  rateLimitKey?: string;
  headers?: Record<string, string>;
}

export interface LazadaApiResponse<T = any> {
  code: string;
  type: string;
  message: string;
  data?: T;
  request_id: string;
}

@Injectable()
export class LazadaApiService extends BaseApiService {
  protected readonly logger = new Logger(LazadaApiService.name);
  private readonly baseUrls = {
    // Production URLs
    MY: 'https://api.lazada.com.my/rest',
    SG: 'https://api.lazada.sg/rest',
    TH: 'https://api.lazada.co.th/rest',
    ID: 'https://api.lazada.co.id/rest',
    PH: 'https://api.lazada.com.ph/rest',
    VN: 'https://api.lazada.vn/rest',
    // Auth URL (same for all regions)
    AUTH: 'https://auth.lazada.com/rest',
  };

  private readonly sandboxUrls = {
    MY: 'https://api.lazada.com.my/rest',
    SG: 'https://api.lazada.sg/rest', 
    TH: 'https://api.lazada.co.th/rest',
    ID: 'https://api.lazada.co.id/rest',
    PH: 'https://api.lazada.com.ph/rest',
    VN: 'https://api.lazada.vn/rest',
    AUTH: 'https://auth.lazada.com/rest',
  };

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    protected readonly rateLimiter: RateLimiterService,
    protected readonly logService: IntegrationLogService,
  ) {
    super(httpService, configService);
  }

  /**
   * Implement base class makeRequest method
   */
  async makeRequest<T = any>(
    config: ApiConfig,
    request: ApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    // Extract Lazada-specific config from authentication credentials
    const auth = config.authentication?.credentials || {};
    const lazadaConfig: LazadaConfig = {
      appKey: auth.appKey || '',
      appSecret: auth.appSecret || '',
      region: (auth.region as LazadaRegion) || LazadaRegion.ID,
      sandbox: auth.sandbox || false,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    };

    // Map method type (handle PATCH which Lazada doesn't support)
    const method = request.method === 'PATCH' ? 'PUT' : request.method;

    const lazadaRequest: LazadaRequestConfig = {
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: request.endpoint,
      params: request.params,
      body: request.data,
      requiresAuth: request.headers?.['Authorization'] ? true : false,
      headers: request.headers,
    };

    const result = await this.makeLazadaRequest(tenantId, channelId, lazadaConfig, lazadaRequest);
    
    return {
      success: result.success,
      data: result.data,
      error: result.error ? { message: result.error, code: 'LAZADA_ERROR' } : undefined,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date(),
        duration: 0,
      },
    };
  }

  /**
   * Make authenticated API request to Lazada (Lazada-specific)
   */
  async makeLazadaRequest<T = any>(
    tenantId: string,
    channelId: string,
    config: LazadaConfig,
    requestConfig: LazadaRequestConfig,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const requestId = this.generateRequestId();

    try {
      // Check rate limits
      const rateLimitKey = `${tenantId}:${channelId}:${requestConfig.rateLimitKey || 'default'}`;
      const rateLimitConfig = this.getRateLimitConfig();
      
      const rateLimitResult = await this.rateLimiter.checkRateLimit(rateLimitKey, rateLimitConfig);
      if (!rateLimitResult.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}ms`);
      }

      // Get base URL
      const baseUrl = config.sandbox ? this.sandboxUrls[config.region] : this.baseUrls[config.region];
      const authUrl = config.sandbox ? this.sandboxUrls.AUTH : this.baseUrls.AUTH;
      
      // Determine API URL
      const apiUrl = requestConfig.path.startsWith('/auth/') ? authUrl : baseUrl;
      const fullUrl = `${apiUrl}${requestConfig.path}`;

      // Prepare request parameters
      const params: Record<string, any> = {
        app_key: config.appKey,
        timestamp: Date.now().toString(),
        sign_method: 'sha256',
        ...requestConfig.params,
      };

      // Add access token if required and available
      if (requestConfig.requiresAuth && config.accessToken) {
        params.access_token = config.accessToken;
      }

      // Generate API signature
      const signature = this.generateSignature(requestConfig.method, requestConfig.path, params, config.appSecret);
      params.sign = signature;

      // Log API request
      await this.logService.logApiRequest(
        tenantId,
        channelId,
        requestId,
        requestConfig.method,
        fullUrl,
      );

      const startTime = Date.now();
      let response;

      // Make HTTP request
      if (requestConfig.method === 'GET') {
        response = await lastValueFrom(
          this.httpService.get(fullUrl, { 
            params,
            headers: this.getDefaultHeaders(),
          }).pipe(
            map(res => res.data),
            catchError(err => {
              this.logger.error(`Lazada API request failed: ${err.message}`, err.stack);
              return throwError(() => err);
            })
          )
        );
      } else {
        response = await lastValueFrom(
          this.httpService.request({
            method: requestConfig.method,
            url: fullUrl,
            params,
            data: requestConfig.body,
            headers: this.getDefaultHeaders(),
          }).pipe(
            map(res => res.data),
            catchError(err => {
              this.logger.error(`Lazada API request failed: ${err.message}`, err.stack);
              return throwError(() => err);
            })
          )
        );
      }

      const responseTime = Date.now() - startTime;

      // Log API response
      await this.logService.logApiResponse(
        tenantId,
        channelId,
        requestId,
        requestConfig.method,
        fullUrl,
        200,
        responseTime,
      );

      // Handle Lazada API response format
      const lazadaResponse: LazadaApiResponse<T> = response;

      if (lazadaResponse.code === '0' || lazadaResponse.code === 'Success') {
        return {
          success: true,
          data: lazadaResponse.data,
        };
      } else {
        this.logger.warn(`Lazada API error: ${lazadaResponse.message}`, {
          code: lazadaResponse.code,
          type: lazadaResponse.type,
          requestId: lazadaResponse.request_id,
        });

        return {
          success: false,
          error: `${lazadaResponse.type}: ${lazadaResponse.message}`,
        };
      }

    } catch (error) {
      this.logger.error(`Lazada API request failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        channelId,
        error,
        {
          requestId,
          metadata: {
            path: requestConfig.path,
            method: requestConfig.method,
          },
        },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate Lazada API signature
   */
  generateSignature(
    method: string,
    endpoint: string,
    params: Record<string, any>,
    secret: string,
    timestamp?: number,
  ): string {
    try {
      // Sort parameters by key
      const sortedKeys = Object.keys(params).sort();
      
      // Build query string
      const queryString = sortedKeys
        .map(key => `${key}${params[key]}`)
        .join('');

      // Create string to sign
      const stringToSign = `${method}${endpoint}${queryString}`;

      // Generate HMAC-SHA256 signature
      const signature = crypto
        .createHmac('sha256', secret)
        .update(stringToSign)
        .digest('hex')
        .toUpperCase();

      return signature;

    } catch (error) {
      this.logger.error(`Failed to generate Lazada signature: ${error.message}`, error.stack);
      throw new Error(`Signature generation failed: ${error.message}`);
    }
  }

  /**
   * Get rate limit configuration for Lazada
   */
  private getRateLimitConfig() {
    return {
      windowSizeMs: 60 * 1000, // 1 minute
      maxRequests: 500, // 500 requests per minute
      keyPrefix: 'lazada_api',
    };
  }

  /**
   * Get default headers for Lazada requests
   */
  private getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'StokCerdas-Lazada-Integration/1.0',
    };
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `lazada_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method to get shop info
   */
  async getShopInfo(
    tenantId: string,
    channelId: string,
    config: LazadaConfig,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const result = await this.makeRequest({
      baseUrl: config.sandbox ? this.sandboxUrls[config.region] : this.baseUrls[config.region],
      authentication: {
        type: 'signature',
        credentials: config,
      },
    }, {
      method: 'GET',
      endpoint: '/seller/get',
    }, tenantId, channelId);
    
    return {
      success: result.success,
      data: result.data,
      error: result.error?.message,
    };
  }

  /**
   * Helper method to test API connection
   */
  async testConnection(
    tenantId: string,
    channelId: string,
    config: LazadaConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.getShopInfo(tenantId, channelId, config);
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}