import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MokaApiService, MokaCredentials } from './moka-api.service';
import { Channel } from '../../../channels/entities/channel.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export interface MokaAuthConfig {
  apiKey: string;
  storeId: string;
  isSandbox?: boolean;
  appId?: string;
  redirectUri?: string;
  authorizationCode?: string;
}

export interface MokaAuthStatus {
  isAuthenticated: boolean;
  storeId?: string;
  storeName?: string;
  lastTestAt?: Date;
  error?: string;
}

@Injectable()
export class MokaAuthService {
  private readonly logger = new Logger(MokaAuthService.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    private readonly mokaApiService: MokaApiService,
    private readonly logService: IntegrationLogService,
  ) {}

  /**
   * Setup Moka authentication for a channel
   */
  async setupAuthentication(
    tenantId: string,
    channelId: string,
    config: MokaAuthConfig,
  ): Promise<{
    success: boolean;
    storeInfo?: any;
    error?: string;
  }> {
    try {
      this.logger.debug(
        `Setting up Moka authentication for channel ${channelId}`,
      );

      // Validate credentials by testing connection
      const credentials: MokaCredentials = {
        apiKey: config.apiKey,
        sandbox: config.isSandbox || false,
      };

      const testResult = await this.mokaApiService.testConnection(
        credentials,
        tenantId,
        channelId,
      );

      if (!testResult.success) {
        throw new Error(
          `Authentication test failed: ${testResult.error?.message}`,
        );
      }

      // Get store information
      const storeInfoResult = await this.mokaApiService.getStoreInfo(
        credentials,
        tenantId,
        channelId,
      );

      if (!storeInfoResult.success) {
        throw new Error(
          `Failed to get store info: ${storeInfoResult.error?.message}`,
        );
      }

      const storeInfo = storeInfoResult.data;

      // Update channel with credentials
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      // Store credentials
      channel.apiCredentials = credentials;
      // channel.isActive = true; // Read-only property
      channel.lastSyncAt = new Date();

      // Update channel metadata with store info
      // TODO: Update metadata when Channel entity supports it
      // channel.metadata = {
      //   ...channel.metadata,
      //   moka: {
      //     storeId: storeInfo.id,
      //     storeName: storeInfo.name,
      //     storeAddress: storeInfo.address,
      //     storePhone: storeInfo.phone,
      //     storeEmail: storeInfo.email,
      //     timezone: storeInfo.timezone,
      //     currency: storeInfo.currency,
      //     taxRate: storeInfo.tax_rate,
      //     isActive: storeInfo.is_active,
      //     lastAuthAt: new Date(),
      //     isSandbox: config.isSandbox || false,
      //   },
      // };

      await this.channelRepository.save(channel);

      // Log successful authentication
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: `Moka authentication successful for store: ${storeInfo.name}`,
        metadata: {
          channelId,
          storeId: storeInfo.id,
          storeName: storeInfo.name,
          isSandbox: config.isSandbox,
        },
      });

      this.logger.log(
        `Moka authentication setup successful for channel ${channelId}`,
      );

      return {
        success: true,
        storeInfo,
      };
    } catch (error) {
      this.logger.error(
        `Moka authentication setup failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          action: 'setup_authentication',
          apiKey: config.apiKey,
        },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get valid credentials for API calls
   */
  async getValidCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<MokaCredentials> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new UnauthorizedException(`Channel ${channelId} not found`);
      }

      if (!channel.isActive) {
        throw new UnauthorizedException(`Channel ${channelId} is not active`);
      }

      if (!channel.apiCredentials) {
        throw new UnauthorizedException(
          `No credentials found for channel ${channelId}`,
        );
      }

      const credentials = channel.apiCredentials as MokaCredentials;

      // Validate credentials are still valid
      const testResult = await this.mokaApiService.testConnection(
        credentials,
        tenantId,
        channelId,
      );

      if (!testResult.success) {
        // Log authentication failure
        await this.logService.logError(
          tenantId,
          channelId,
          new Error('Moka credentials invalid'),
          {
            metadata: {
              action: 'validate_credentials',
              error: testResult.error?.message,
            },
          },
        );

        throw new UnauthorizedException(
          `Moka credentials are invalid: ${testResult.error?.message}`,
        );
      }

      return credentials;
    } catch (error) {
      this.logger.error(
        `Failed to get valid credentials: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Test current authentication status
   */
  async testAuthentication(
    tenantId: string,
    channelId: string,
  ): Promise<{
    success: boolean;
    storeInfo?: any;
    error?: string;
  }> {
    try {
      const credentials = await this.getValidCredentials(tenantId, channelId);

      const testResult = await this.mokaApiService.testConnection(
        credentials,
        tenantId,
        channelId,
      );

      if (testResult.success) {
        // Get store info for additional validation
        const storeInfoResult = await this.mokaApiService.getStoreInfo(
          credentials,
          tenantId,
          channelId,
        );

        await this.logService.log({
          tenantId,
          type: IntegrationLogType.AUTH,
          level: IntegrationLogLevel.INFO,
          message: 'Moka authentication test successful',
          metadata: {
            channelId,
            appId: credentials.appId || credentials.clientId,
          },
        });

        return {
          success: true,
          storeInfo: storeInfoResult.data,
        };
      } else {
        return {
          success: false,
          error: testResult.error?.message,
        };
      }
    } catch (error) {
      this.logger.error(
        `Authentication test failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get authentication status
   */
  async getAuthenticationStatus(
    tenantId: string,
    channelId: string,
  ): Promise<MokaAuthStatus> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        return {
          isAuthenticated: false,
          error: 'Channel not found',
        };
      }

      if (!channel.isActive || !channel.apiCredentials) {
        return {
          isAuthenticated: false,
          error: 'No valid credentials found',
        };
      }

      const mokaMetadata = null; // channel.metadata?.moka;

      if (!mokaMetadata) {
        return {
          isAuthenticated: false,
          error: 'No Moka metadata found',
        };
      }

      // Test if credentials are still valid
      try {
        const credentials = channel.apiCredentials as MokaCredentials;
        const testResult = await this.mokaApiService.testConnection(
          credentials,
          tenantId,
          channelId,
        );

        return {
          isAuthenticated: testResult.success,
          storeId: mokaMetadata.storeId,
          storeName: mokaMetadata.storeName,
          lastTestAt: new Date(),
          error: testResult.success ? undefined : testResult.error?.message,
        };
      } catch (error) {
        return {
          isAuthenticated: false,
          storeId: mokaMetadata.storeId,
          storeName: mokaMetadata.storeName,
          error: error.message,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get authentication status: ${error.message}`,
        error.stack,
      );
      return {
        isAuthenticated: false,
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
  ): Promise<void> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      // Clear credentials and deactivate
      channel.apiCredentials = null;
      // channel.isActive = false; // Read-only property

      // Clear Moka metadata
      // if (channel.metadata?.moka) {
      //   delete channel.metadata.moka;
      // }

      await this.channelRepository.save(channel);

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Moka authentication revoked',
        metadata: {
          channelId,
        },
      });

      this.logger.log(`Moka authentication revoked for channel ${channelId}`);
    } catch (error) {
      this.logger.error(
        `Failed to revoke authentication: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update store configuration
   */
  async updateStoreConfig(
    tenantId: string,
    channelId: string,
    config: Partial<MokaAuthConfig>,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      const currentCredentials =
        (channel.apiCredentials as MokaCredentials) || {};

      // Update credentials with new config
      const updatedCredentials: MokaCredentials = {
        ...currentCredentials,
        ...config,
      };

      // Test updated credentials
      const testResult = await this.mokaApiService.testConnection(
        updatedCredentials,
        tenantId,
        channelId,
      );

      if (!testResult.success) {
        throw new Error(
          `Updated credentials are invalid: ${testResult.error?.message}`,
        );
      }

      // Save updated credentials
      channel.apiCredentials = updatedCredentials;
      channel.lastSyncAt = new Date();

      await this.channelRepository.save(channel);

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: 'Moka store configuration updated',
        metadata: {
          channelId,
          updatedFields: Object.keys(config),
        },
      });

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to update store config: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthorizationUrl(
    tenantId: string,
    channelId: string,
    config: { appId: string; redirectUri: string; isSandbox?: boolean },
    state?: string,
  ): Promise<{
    success: boolean;
    authorizationUrl?: string;
    error?: string;
  }> {
    try {
      const credentials: MokaCredentials = {
        appId: config.appId,
        secretKey: '', // Not needed for auth URL generation
        redirectUri: config.redirectUri,
        sandbox: config.isSandbox || false,
      };

      const authUrl = this.mokaApiService.generateAuthorizationUrl(
        credentials,
        state,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'OAuth authorization URL generated',
        metadata: {
          channelId,
          appId: config.appId,
          state,
        },
      });

      return {
        success: true,
        authorizationUrl: authUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate authorization URL: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Complete OAuth flow by exchanging authorization code for tokens
   */
  async completeOAuthFlow(
    tenantId: string,
    channelId: string,
    config: MokaAuthConfig,
  ): Promise<{
    success: boolean;
    storeInfo?: any;
    error?: string;
  }> {
    try {
      if (!config.authorizationCode) {
        throw new Error(
          'Authorization code is required to complete OAuth flow',
        );
      }

      // This will be handled by setupAuthentication method
      return await this.setupAuthentication(tenantId, channelId, config);
    } catch (error) {
      this.logger.error(
        `Failed to complete OAuth flow: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(
    tenantId: string,
    channelId: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel || !channel.apiCredentials) {
        throw new Error('No credentials found for channel');
      }

      const credentials = channel.apiCredentials as MokaCredentials;

      // Check if token needs refresh (this will be handled by API service internally)
      const testResult = await this.mokaApiService.testConnection(
        credentials,
        tenantId,
        channelId,
      );

      if (testResult.success) {
        // Update stored credentials if they were refreshed
        channel.apiCredentials = credentials;
        await this.channelRepository.save(channel);
      }

      return {
        success: testResult.success,
        error: testResult.success ? undefined : testResult.error?.message,
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh token: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private encryptCredentials(credentials: MokaCredentials): string {
    // In production, use proper encryption (AES-256)
    // For now, just base64 encode (NOT SECURE for production)
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  private decryptCredentials(encryptedCredentials: string): MokaCredentials {
    try {
      // In production, use proper decryption
      // For now, just base64 decode
      const decoded = Buffer.from(encryptedCredentials, 'base64').toString();
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Failed to decrypt Moka credentials');
    }
  }
}
