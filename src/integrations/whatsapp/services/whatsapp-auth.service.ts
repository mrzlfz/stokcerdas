import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Channel } from '../../../channels/entities/channel.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WhatsAppApiService, WhatsAppConfig, WhatsAppApiResponse } from './whatsapp-api.service';

export interface WhatsAppAuthConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
  verifyToken: string;
  webhookUrl?: string;
  sandbox?: boolean;
  version?: string;
}

export interface WhatsAppCredentials {
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
  appId: string;
  appSecret: string;
  verifyToken: string;
  expiresAt?: Date;
  isActive: boolean;
  lastVerified: Date;
}

export interface WhatsAppAccountValidation {
  isValid: boolean;
  accountInfo?: any;
  phoneNumberInfo?: any;
  errors?: string[];
  warnings?: string[];
}

@Injectable()
export class WhatsAppAuthService {
  private readonly logger = new Logger(WhatsAppAuthService.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMapping)
    private readonly channelMappingRepository: Repository<ChannelMapping>,
    private readonly configService: ConfigService,
    private readonly apiService: WhatsAppApiService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Store WhatsApp credentials securely
   */
  async storeCredentials(
    tenantId: string,
    channelId: string,
    credentials: WhatsAppAuthConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Storing WhatsApp credentials for channel ${channelId}`, {
        tenantId,
        channelId,
        phoneNumberId: credentials.phoneNumberId,
      });

      // Find the channel
      const channel = await this.channelRepository.findOne({
        where: {
          id: channelId,
          tenantId,
          platform: 'whatsapp',
        },
      });

      if (!channel) {
        return {
          success: false,
          error: 'WhatsApp channel not found',
        };
      }

      // Validate credentials before storing
      const validation = await this.validateCredentials(tenantId, channelId, credentials);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors?.join(', ') || 'Invalid credentials',
        };
      }

      // Store credentials in channel config
      const secureCredentials: WhatsAppCredentials = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
        isActive: true,
        lastVerified: new Date(),
      };

      // Update channel configuration
      await this.channelRepository.update(
        { id: channelId, tenantId },
        {
          configuration: secureCredentials,
          status: 'active',
          lastSyncAt: new Date(),
        },
      );

      // Store additional mapping information
      await this.channelMappingRepository.upsert(
        {
          tenantId,
          channelId,
          internalField: 'phone_number_id',
          externalField: 'phone_number_id',
          externalValue: credentials.phoneNumberId,
          mappingType: 'identifier',
        },
        ['tenantId', 'channelId', 'internalField'],
      );

      await this.channelMappingRepository.upsert(
        {
          tenantId,
          channelId,
          internalField: 'business_account_id',
          externalField: 'business_account_id',
          externalValue: credentials.businessAccountId,
          mappingType: 'identifier',
        },
        ['tenantId', 'channelId', 'internalField'],
      );

      // Log successful credential storage
      await this.logService.log({
        tenantId,
        channelId,
        type: 'AUTH',
        level: 'INFO',
        message: 'WhatsApp credentials stored successfully',
        metadata: {
          phoneNumberId: credentials.phoneNumberId,
          businessAccountId: credentials.businessAccountId,
          accountInfo: validation.accountInfo,
          phoneNumberInfo: validation.phoneNumberInfo,
        },
      });

      // Emit event for successful authentication
      this.eventEmitter.emit('whatsapp.auth.success', {
        tenantId,
        channelId,
        phoneNumberId: credentials.phoneNumberId,
        accountInfo: validation.accountInfo,
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to store WhatsApp credentials: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
        stack: error.stack,
      });

      await this.logService.logError(tenantId, channelId, error, {
        context: 'store_credentials',
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get stored WhatsApp credentials
   */
  async getCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<WhatsAppCredentials | null> {
    try {
      const channel = await this.channelRepository.findOne({
        where: {
          id: channelId,
          tenantId,
          platform: 'whatsapp',
        },
      });

      if (!channel || !channel.configuration) {
        return null;
      }

      const credentials = channel.configuration as WhatsAppCredentials;

      // Check if credentials are still valid (if we have expiration)
      if (credentials.expiresAt && credentials.expiresAt < new Date()) {
        this.logger.warn(`WhatsApp credentials expired for channel ${channelId}`, {
          tenantId,
          channelId,
          expiresAt: credentials.expiresAt,
        });
        return null;
      }

      return credentials;

    } catch (error) {
      this.logger.error(`Failed to get WhatsApp credentials: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Validate WhatsApp credentials
   */
  async validateCredentials(
    tenantId: string,
    channelId: string,
    config: WhatsAppAuthConfig,
  ): Promise<WhatsAppAccountValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.debug(`Validating WhatsApp credentials for channel ${channelId}`, {
        tenantId,
        channelId,
        phoneNumberId: config.phoneNumberId,
      });

      // Basic validation
      if (!config.accessToken) {
        errors.push('Access token is required');
      }
      if (!config.businessAccountId) {
        errors.push('Business Account ID is required');
      }
      if (!config.phoneNumberId) {
        errors.push('Phone Number ID is required');
      }
      if (!config.appId) {
        errors.push('App ID is required');
      }
      if (!config.appSecret) {
        errors.push('App Secret is required');
      }
      if (!config.verifyToken) {
        errors.push('Verify Token is required');
      }

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      // Test API connection
      const whatsappConfig: WhatsAppConfig = {
        accessToken: config.accessToken,
        businessAccountId: config.businessAccountId,
        phoneNumberId: config.phoneNumberId,
        appId: config.appId,
        appSecret: config.appSecret,
        verifyToken: config.verifyToken,
        sandbox: config.sandbox,
        version: config.version,
      };

      // Get account information
      const accountResult = await this.apiService.getAccountInfo(
        tenantId,
        channelId,
        whatsappConfig,
      );

      if (!accountResult.success) {
        errors.push(`Account validation failed: ${accountResult.error?.message}`);
        return { isValid: false, errors };
      }

      // Get phone number information
      const phoneResult = await this.apiService.getPhoneNumberInfo(
        tenantId,
        channelId,
        whatsappConfig,
      );

      if (!phoneResult.success) {
        errors.push(`Phone number validation failed: ${phoneResult.error?.message}`);
        return { isValid: false, errors };
      }

      // Check phone number status
      const phoneStatus = phoneResult.data?.status;
      if (phoneStatus !== 'CONNECTED') {
        if (phoneStatus === 'PENDING') {
          warnings.push('Phone number verification is pending');
        } else if (phoneStatus === 'RESTRICTED') {
          errors.push('Phone number is restricted');
        } else if (phoneStatus === 'FLAGGED') {
          warnings.push('Phone number is flagged - monitor messaging quality');
        } else {
          warnings.push(`Phone number status: ${phoneStatus}`);
        }
      }

      // Check quality rating
      const qualityRating = phoneResult.data?.quality_rating;
      if (qualityRating === 'RED') {
        warnings.push('Phone number has RED quality rating - messaging may be limited');
      } else if (qualityRating === 'YELLOW') {
        warnings.push('Phone number has YELLOW quality rating - monitor message quality');
      }

      // Check business verification
      const accountInfo = accountResult.data;
      if (accountInfo?.business_verification_status !== 'verified') {
        warnings.push('Business account is not verified - some features may be limited');
      }

      return {
        isValid: errors.length === 0,
        accountInfo: accountResult.data,
        phoneNumberInfo: phoneResult.data,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error) {
      this.logger.error(`WhatsApp credential validation error: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
        stack: error.stack,
      });

      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Test authentication with current credentials
   */
  async testAuthentication(
    tenantId: string,
    channelId: string,
  ): Promise<{ success: boolean; error?: string; accountInfo?: any; phoneNumberInfo?: any }> {
    try {
      const credentials = await this.getCredentials(tenantId, channelId);
      if (!credentials) {
        return {
          success: false,
          error: 'No credentials found for this channel',
        };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const testResult = await this.apiService.testConnection(tenantId, channelId, config);

      if (testResult.success) {
        // Update last verified timestamp
        await this.channelRepository.update(
          { id: channelId, tenantId },
          {
            configuration: {
              ...credentials,
              lastVerified: new Date(),
            },
            lastSyncAt: new Date(),
          },
        );

        // Get detailed info for response
        const accountResult = await this.apiService.getAccountInfo(tenantId, channelId, config);
        const phoneResult = await this.apiService.getPhoneNumberInfo(tenantId, channelId, config);

        return {
          success: true,
          accountInfo: accountResult.data,
          phoneNumberInfo: phoneResult.data,
        };
      } else {
        return {
          success: false,
          error: testResult.error?.message || 'Authentication test failed',
        };
      }

    } catch (error) {
      this.logger.error(`WhatsApp authentication test failed: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Revoke authentication
   */
  async revokeAuthentication(
    tenantId: string,
    channelId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.log(`Revoking WhatsApp authentication for channel ${channelId}`, {
        tenantId,
        channelId,
      });

      // Update channel to inactive
      await this.channelRepository.update(
        { id: channelId, tenantId },
        {
          status: 'inactive',
          configuration: null,
        },
      );

      // Clear channel mappings
      await this.channelMappingRepository.delete({
        tenantId,
        channelId,
      });

      // Log revocation
      await this.logService.log({
        tenantId,
        channelId,
        type: 'AUTH',
        level: 'INFO',
        message: 'WhatsApp authentication revoked',
        metadata: { reason: 'manual_revocation' },
      });

      // Emit event
      this.eventEmitter.emit('whatsapp.auth.revoked', {
        tenantId,
        channelId,
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to revoke WhatsApp authentication: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update webhook URL
   */
  async updateWebhookUrl(
    tenantId: string,
    channelId: string,
    webhookUrl: string,
    verifyToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.getCredentials(tenantId, channelId);
      if (!credentials) {
        return {
          success: false,
          error: 'No credentials found for this channel',
        };
      }

      // Update credentials with new webhook URL and verify token
      const updatedCredentials: WhatsAppCredentials = {
        ...credentials,
        verifyToken,
      };

      await this.channelRepository.update(
        { id: channelId, tenantId },
        {
          configuration: updatedCredentials,
        },
      );

      // Log webhook update
      await this.logService.log({
        tenantId,
        channelId,
        type: 'SYSTEM',
        level: 'INFO',
        message: 'WhatsApp webhook URL updated',
        metadata: {
          webhookUrl,
          verifyToken: '[REDACTED]',
        },
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to update webhook URL: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get channel status and health information
   */
  async getChannelStatus(
    tenantId: string,
    channelId: string,
  ): Promise<{
    isActive: boolean;
    lastVerified?: Date;
    accountInfo?: any;
    phoneNumberInfo?: any;
    healthStatus: 'healthy' | 'warning' | 'error';
    issues?: string[];
  }> {
    try {
      const credentials = await this.getCredentials(tenantId, channelId);
      if (!credentials) {
        return {
          isActive: false,
          healthStatus: 'error',
          issues: ['No credentials configured'],
        };
      }

      if (!credentials.isActive) {
        return {
          isActive: false,
          lastVerified: credentials.lastVerified,
          healthStatus: 'error',
          issues: ['Channel is inactive'],
        };
      }

      // Test current authentication
      const testResult = await this.testAuthentication(tenantId, channelId);
      
      const issues: string[] = [];
      let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy';

      if (!testResult.success) {
        healthStatus = 'error';
        issues.push(`Authentication failed: ${testResult.error}`);
      } else {
        // Check for potential issues
        const phoneInfo = testResult.phoneNumberInfo;
        if (phoneInfo) {
          if (phoneInfo.quality_rating === 'RED') {
            healthStatus = 'error';
            issues.push('Phone number has RED quality rating');
          } else if (phoneInfo.quality_rating === 'YELLOW') {
            healthStatus = 'warning';
            issues.push('Phone number has YELLOW quality rating');
          }

          if (phoneInfo.status !== 'CONNECTED') {
            if (phoneInfo.status === 'RESTRICTED' || phoneInfo.status === 'FLAGGED') {
              healthStatus = 'error';
            } else {
              healthStatus = 'warning';
            }
            issues.push(`Phone number status: ${phoneInfo.status}`);
          }
        }

        const accountInfo = testResult.accountInfo;
        if (accountInfo && accountInfo.business_verification_status !== 'verified') {
          if (healthStatus !== 'error') {
            healthStatus = 'warning';
          }
          issues.push('Business account not verified');
        }
      }

      return {
        isActive: credentials.isActive && testResult.success,
        lastVerified: credentials.lastVerified,
        accountInfo: testResult.accountInfo,
        phoneNumberInfo: testResult.phoneNumberInfo,
        healthStatus,
        issues: issues.length > 0 ? issues : undefined,
      };

    } catch (error) {
      this.logger.error(`Failed to get channel status: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });

      return {
        isActive: false,
        healthStatus: 'error',
        issues: [`Status check failed: ${error.message}`],
      };
    }
  }
}