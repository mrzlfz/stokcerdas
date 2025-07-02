import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import { BaseApiService } from '../../common/services/base-api.service';
import { RateLimiterService } from '../../common/services/rate-limiter.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  appId: string;
  appSecret: string;
  verifyToken: string;
  webhookUrl?: string;
  sandbox?: boolean;
  version?: string;
}

export interface WhatsAppRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  params?: Record<string, any>;
  data?: any;
  requiresAuth?: boolean;
  retryCount?: number;
}

export interface WhatsAppApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId?: string;
  processingTime?: number;
}

export interface WhatsAppAccountInfo {
  id: string;
  name: string;
  account_review_status: string;
  business_verification_status: string;
  country: string;
  currency: string;
  message_template_namespace: string;
  primary_business_location: string;
  timezone_id: string;
  phone_numbers: WhatsAppPhoneNumber[];
}

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  verified_name: string;
  code_verification_status: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'FLAGGED' | 'MIGRATED' | 'PENDING' | 'RESTRICTED';
  throughput: {
    level: string;
    optin_phone_numbers: number;
  };
}

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template' | 'interactive' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts';
  text?: {
    preview_url?: boolean;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  interactive?: {
    type: 'button' | 'list' | 'product' | 'product_list';
    header?: any;
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: any;
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  audio?: {
    id?: string;
    link?: string;
  };
  video?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  sticker?: {
    id?: string;
    link?: string;
  };
  location?: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  };
  contacts?: any[];
}

@Injectable()
export class WhatsAppApiService extends BaseApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);
  private readonly baseUrls = {
    production: 'https://graph.facebook.com',
    sandbox: 'https://graph.facebook.com', // Same endpoint, different phone numbers
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
   * Make API request to WhatsApp Cloud API with proper authentication and rate limiting
   */
  async makeRequest<T = any>(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
    requestConfig: WhatsAppRequestConfig,
  ): Promise<WhatsAppApiResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('whatsapp');

    try {
      // Check rate limits (WhatsApp: 80 messages/second by default, upgradeable to 1000/second)
      await this.rateLimiter.checkLimit(
        tenantId,
        channelId,
        'whatsapp',
        80, // Default rate limit
        1000, // 1 second window
      );

      const version = config.version || 'v18.0';
      const baseUrl = config.sandbox ? this.baseUrls.sandbox : this.baseUrls.production;
      const url = `${baseUrl}/${version}${requestConfig.endpoint}`;

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'StokCerdas-WhatsApp-Integration/1.0',
        'Authorization': `Bearer ${config.accessToken}`,
      };

      // Log request
      await this.logService.logApiRequest(
        tenantId,
        channelId,
        requestConfig.method,
        url,
        requestConfig.data,
        headers,
        requestId,
      );

      // Make HTTP request
      const response = await firstValueFrom(
        this.httpService.request({
          method: requestConfig.method,
          url,
          headers,
          data: requestConfig.data,
          params: requestConfig.params,
          timeout: 30000,
        }),
      );

      const processingTime = Date.now() - startTime;

      // Log successful response
      await this.logService.logApiResponse(
        tenantId,
        channelId,
        response.status,
        response.data,
        processingTime,
        requestId,
      );

      this.logger.debug(`WhatsApp API request successful: ${requestConfig.method} ${url}`, {
        tenantId,
        channelId,
        requestId,
        status: response.status,
        processingTime,
      });

      return {
        success: true,
        data: response.data,
        requestId,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`WhatsApp API request failed: ${error.message}`, {
        tenantId,
        channelId,
        requestId,
        error: error.message,
        status: error.response?.status,
        processingTime,
        stack: error.stack,
      });

      // Log error
      await this.logService.logApiError(
        tenantId,
        channelId,
        error,
        requestId,
        processingTime,
      );

      return {
        success: false,
        error: {
          code: error.response?.status?.toString() || 'UNKNOWN_ERROR',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data,
        },
        requestId,
        processingTime,
      };
    }
  }

  /**
   * Get WhatsApp Business Account information
   */
  async getAccountInfo(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
  ): Promise<WhatsAppApiResponse<WhatsAppAccountInfo>> {
    return this.makeRequest<WhatsAppAccountInfo>(
      tenantId,
      channelId,
      config,
      {
        method: 'GET',
        endpoint: `/${config.businessAccountId}`,
        params: {
          fields: 'id,name,account_review_status,business_verification_status,country,currency,message_template_namespace,primary_business_location,timezone_id,phone_numbers{id,display_phone_number,quality_rating,verified_name,code_verification_status,status,throughput}',
        },
        requiresAuth: true,
      },
    );
  }

  /**
   * Get phone number information
   */
  async getPhoneNumberInfo(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
  ): Promise<WhatsAppApiResponse<WhatsAppPhoneNumber>> {
    return this.makeRequest<WhatsAppPhoneNumber>(
      tenantId,
      channelId,
      config,
      {
        method: 'GET',
        endpoint: `/${config.phoneNumberId}`,
        params: {
          fields: 'id,display_phone_number,quality_rating,verified_name,code_verification_status,status,throughput',
        },
        requiresAuth: true,
      },
    );
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
    message: WhatsAppMessage,
  ): Promise<WhatsAppApiResponse<{ messages: Array<{ id: string; message_status: string }> }>> {
    return this.makeRequest(
      tenantId,
      channelId,
      config,
      {
        method: 'POST',
        endpoint: `/${config.phoneNumberId}/messages`,
        data: message,
        requiresAuth: true,
      },
    );
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
    mediaData: Buffer | string,
    mimeType: string,
    filename?: string,
  ): Promise<WhatsAppApiResponse<{ id: string }>> {
    // Create form data for media upload
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', new Blob([mediaData], { type: mimeType }), filename);
    formData.append('type', mimeType);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.accessToken}`,
      'User-Agent': 'StokCerdas-WhatsApp-Integration/1.0',
    };

    const version = config.version || 'v18.0';
    const baseUrl = config.sandbox ? this.baseUrls.sandbox : this.baseUrls.production;
    const url = `${baseUrl}/${version}/${config.phoneNumberId}/media`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: 'POST',
          url,
          headers,
          data: formData,
          timeout: 60000, // Longer timeout for media upload
        }),
      );

      return {
        success: true,
        data: response.data,
      };

    } catch (error) {
      this.logger.error(`WhatsApp media upload failed: ${error.message}`, error.stack);

      return {
        success: false,
        error: {
          code: error.response?.status?.toString() || 'UPLOAD_ERROR',
          message: error.response?.data?.error?.message || error.message,
          details: error.response?.data,
        },
      };
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
    mediaId: string,
  ): Promise<WhatsAppApiResponse<{ url: string; mime_type: string; sha256: string; file_size: number }>> {
    return this.makeRequest(
      tenantId,
      channelId,
      config,
      {
        method: 'GET',
        endpoint: `/${mediaId}`,
        requiresAuth: true,
      },
    );
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
    messageId: string,
  ): Promise<WhatsAppApiResponse<{ success: boolean }>> {
    return this.makeRequest(
      tenantId,
      channelId,
      config,
      {
        method: 'POST',
        endpoint: `/${config.phoneNumberId}/messages`,
        data: {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        requiresAuth: true,
      },
    );
  }

  /**
   * Test connection to WhatsApp API
   */
  async testConnection(
    tenantId: string,
    channelId: string,
    config: WhatsAppConfig,
  ): Promise<WhatsAppApiResponse<{ status: string; message: string }>> {
    try {
      const result = await this.getPhoneNumberInfo(tenantId, channelId, config);
      
      if (result.success) {
        return {
          success: true,
          data: {
            status: 'connected',
            message: `Successfully connected to WhatsApp Business API. Phone number: ${result.data.display_phone_number}`,
          },
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: `Connection test failed: ${error.message}`,
          details: error,
        },
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string,
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');

      // Remove 'sha256=' prefix if present
      const receivedSignature = signature.replace(/^sha256=/, '');

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
   * Verify webhook challenge (for initial webhook setup)
   */
  verifyWebhookChallenge(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string,
  ): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook challenge verified successfully');
      return challenge;
    }
    
    this.logger.warn('Webhook challenge verification failed', {
      mode,
      token,
      expectedToken: verifyToken,
    });
    
    return null;
  }

  // Private helper methods

  private generateRequestId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}