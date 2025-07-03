import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';

export interface ApiConfig {
  baseUrl: string;
  apiVersion?: string;
  timeout?: number;
  retries?: number;
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  authentication?: {
    type: 'oauth' | 'apikey' | 'bearer' | 'signature';
    credentials: Record<string, any>;
  };
}

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: Date;
    duration: number;
    rateLimit?: {
      remaining: number;
      reset: Date;
    };
  };
}

@Injectable()
export class BaseApiService {
  protected readonly logger = new Logger(BaseApiService.name);
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {}

  /**
   * Make API request with comprehensive error handling and logging
   */
  async makeRequest<T = any>(
    config: ApiConfig,
    request: ApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Check rate limits
      await this.checkRateLimit(channelId, config.rateLimit);

      // Prepare request configuration
      const axiosConfig = await this.prepareRequestConfig(config, request, requestId);

      // Log request
      this.logRequest(requestId, tenantId, channelId, request, axiosConfig);

      // Make HTTP request
      const response = await this.executeRequest<T>(axiosConfig);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Extract rate limit info
      const rateLimit = this.extractRateLimitInfo(response);

      // Log successful response
      this.logResponse(requestId, response, duration);

      return {
        success: true,
        data: response.data,
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
          rateLimit,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      this.logError(requestId, error, duration);

      return {
        success: false,
        error: this.parseError(error),
        metadata: {
          requestId,
          timestamp: new Date(),
          duration,
        },
      };
    }
  }

  /**
   * OAuth 2.0 authentication flow
   */
  async authenticateOAuth(
    config: ApiConfig,
    credentials: {
      clientId: string;
      clientSecret: string;
      scope?: string;
      redirectUri?: string;
    },
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
  }> {
    const authRequest: ApiRequest = {
      method: 'POST',
      endpoint: '/oauth/token',
      data: {
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: credentials.scope,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const response = await this.makeRequest(config, authRequest, 'system', 'auth');

    if (!response.success) {
      throw new Error(`OAuth authentication failed: ${response.error?.message}`);
    }

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type || 'Bearer',
    };
  }

  /**
   * Refresh OAuth token
   */
  async refreshOAuthToken(
    config: ApiConfig,
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const refreshRequest: ApiRequest = {
      method: 'POST',
      endpoint: '/oauth/token',
      data: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const response = await this.makeRequest(config, refreshRequest, 'system', 'auth');

    if (!response.success) {
      throw new Error(`Token refresh failed: ${response.error?.message}`);
    }

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in,
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload)
        .digest('hex');

      // Handle different signature formats
      const receivedSignature = signature.replace(/^(sha256=|sha1=)/, '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate API signature for platforms that require it
   */
  generateSignature(
    method: string,
    endpoint: string,
    params: Record<string, any>,
    secret: string,
    timestamp?: number,
  ): string {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    
    // Sort parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    // Create string to sign
    const stringToSign = `${method.toUpperCase()}&${endpoint}&${sortedParams}&${ts}`;

    // Generate HMAC signature
    return crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('hex');
  }

  // Private methods

  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkRateLimit(
    channelId: string,
    rateLimit?: ApiConfig['rateLimit'],
  ): Promise<void> {
    if (!rateLimit) return;

    const now = Date.now();
    const minuteWindow = 60 * 1000; // 1 minute in milliseconds
    const rateLimitKey = channelId;

    const current = this.requestCounts.get(rateLimitKey);
    
    if (!current || now >= current.resetTime) {
      // Reset window
      this.requestCounts.set(rateLimitKey, {
        count: 1,
        resetTime: now + minuteWindow,
      });
      return;
    }

    if (current.count >= rateLimit.requestsPerMinute) {
      const waitTime = current.resetTime - now;
      throw new Error(`Rate limit exceeded. Wait ${waitTime}ms before next request.`);
    }

    // Increment count
    current.count += 1;
    this.requestCounts.set(rateLimitKey, current);
  }

  private async prepareRequestConfig(
    config: ApiConfig,
    request: ApiRequest,
    requestId: string,
  ): Promise<AxiosRequestConfig> {
    const url = `${config.baseUrl}${config.apiVersion ? `/${config.apiVersion}` : ''}${request.endpoint}`;

    const axiosConfig: AxiosRequestConfig = {
      method: request.method,
      url,
      timeout: request.timeout || config.timeout || 30000,
      headers: {
        'User-Agent': `StokCerdas/1.0 (https://stokcerdas.com)`,
        'X-Request-ID': requestId,
        ...request.headers,
      },
    };

    // Add authentication headers
    if (config.authentication) {
      axiosConfig.headers = {
        ...axiosConfig.headers,
        ...await this.getAuthHeaders(config.authentication),
      };
    }

    // Add data/params based on method
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.data) {
      axiosConfig.data = request.data;
    }

    if (request.params) {
      axiosConfig.params = request.params;
    }

    return axiosConfig;
  }

  private async getAuthHeaders(auth: ApiConfig['authentication']): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.credentials.accessToken}`;
        break;
      
      case 'apikey':
        headers[auth.credentials.headerName || 'X-API-Key'] = auth.credentials.apiKey;
        break;
      
      case 'oauth':
        headers['Authorization'] = `Bearer ${auth.credentials.accessToken}`;
        break;
      
      case 'signature':
        // Platform-specific signature implementation
        // Will be implemented in platform-specific services
        break;
    }

    return headers;
  }

  private async executeRequest<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await firstValueFrom(this.httpService.request<T>(config));
    } catch (error) {
      // Re-throw with additional context
      throw error;
    }
  }

  private extractRateLimitInfo(response: AxiosResponse): ApiResponse['metadata']['rateLimit'] {
    const headers = response.headers;
    
    const remaining = parseInt(headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'] || '0');
    const resetTimestamp = parseInt(headers['x-ratelimit-reset'] || headers['x-rate-limit-reset'] || '0');
    
    if (remaining !== undefined && resetTimestamp) {
      return {
        remaining,
        reset: new Date(resetTimestamp * 1000),
      };
    }

    return undefined;
  }

  private parseError(error: any): ApiResponse['error'] {
    if (error.response) {
      // HTTP error response
      return {
        code: `HTTP_${error.response.status}`,
        message: error.response.data?.message || error.response.statusText || 'HTTP request failed',
        details: {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        },
      };
    } else if (error.request) {
      // Network error
      return {
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
        details: {
          code: error.code,
          message: error.message,
        },
      };
    } else {
      // Other error
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error occurred',
        details: error,
      };
    }
  }

  private logRequest(
    requestId: string,
    tenantId: string,
    channelId: string,
    request: ApiRequest,
    config: AxiosRequestConfig,
  ): void {
    this.logger.debug(`[${requestId}] ${request.method} ${config.url}`, {
      tenantId,
      channelId,
      method: request.method,
      url: config.url,
      headers: this.sanitizeHeaders(config.headers),
      params: request.params,
      dataSize: request.data ? JSON.stringify(request.data).length : 0,
    });
  }

  private logResponse(
    requestId: string,
    response: AxiosResponse,
    duration: number,
  ): void {
    this.logger.debug(`[${requestId}] Response ${response.status} (${duration}ms)`, {
      status: response.status,
      duration,
      dataSize: response.data ? JSON.stringify(response.data).length : 0,
      headers: this.sanitizeHeaders(response.headers),
    });
  }

  private logError(
    requestId: string,
    error: any,
    duration: number,
  ): void {
    this.logger.error(`[${requestId}] Request failed (${duration}ms)`, {
      error: error.message,
      status: error.response?.status,
      duration,
      code: error.code,
    });
  }

  protected sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
    
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
}