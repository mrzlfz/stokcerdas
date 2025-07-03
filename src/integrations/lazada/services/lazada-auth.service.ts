import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { LazadaApiService, LazadaConfig, LazadaRegion } from './lazada-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { Channel } from '../../../channels/entities/channel.entity';
import { IntegrationLogType, IntegrationLogLevel } from '../../entities/integration-log.entity';

export interface LazadaAuthConfig {
  appKey: string;
  appSecret: string;
  region: 'MY' | 'SG' | 'TH' | 'ID' | 'PH' | 'VN';
  redirectUri: string;
  sandbox?: boolean;
}

export interface LazadaTokenInfo {
  accessToken: string;
  refreshToken: string;
  accessTokenType: string;
  expiresIn: number;
  refreshTokenExpiresIn: number;
  countryUserInfo: Array<{
    country: string;
    userId: string;
    sellerId: string;
    shortCode: string;
  }>;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface LazadaCredentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
  region: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

@Injectable()
export class LazadaAuthService {
  private readonly logger = new Logger(LazadaAuthService.name);

  private readonly authUrls = {
    MY: 'https://auth.lazada.com.my/oauth/authorize',
    SG: 'https://auth.lazada.sg/oauth/authorize',
    TH: 'https://auth.lazada.co.th/oauth/authorize',
    ID: 'https://auth.lazada.co.id/oauth/authorize',
    PH: 'https://auth.lazada.com.ph/oauth/authorize',
    VN: 'https://auth.lazada.vn/oauth/authorize',
  };

  constructor(
    private readonly lazadaApi: LazadaApiService,
    private readonly logService: IntegrationLogService,
    private readonly configService: ConfigService,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  /**
   * Generate authorization URL for Lazada OAuth
   */
  async getAuthorizationUrl(
    tenantId: string,
    channelId: string,
    config: LazadaAuthConfig,
    state?: string,
  ): Promise<{ authUrl: string; state: string }> {
    try {
      // Generate state if not provided
      const authState = state || this.generateState();

      // Build authorization URL
      const authUrl = this.authUrls[config.region];
      const params = new URLSearchParams({
        response_type: 'code',
        force_auth: 'true',
        redirect_uri: config.redirectUri,
        client_id: config.appKey,
        state: authState,
      });

      const fullAuthUrl = `${authUrl}?${params.toString()}`;

      // Log authorization attempt
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Lazada authorization URL generated',
        metadata: {
          region: config.region as LazadaRegion,
          redirectUri: config.redirectUri,
          state: authState,
        },
      });

      return {
        authUrl: fullAuthUrl,
        state: authState,
      };

    } catch (error) {
      this.logger.error(`Failed to generate authorization URL: ${error.message}`, error.stack);
      throw new Error(`Authorization URL generation failed: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    tenantId: string,
    channelId: string,
    authCode: string,
    config: LazadaAuthConfig,
  ): Promise<LazadaTokenInfo> {
    try {
      this.logger.debug(`Exchanging authorization code for token`, {
        tenantId,
        channelId,
        region: config.region as LazadaRegion,
      });

      const lazadaConfig: LazadaConfig = {
        appKey: config.appKey,
        appSecret: config.appSecret,
        region: config.region as LazadaRegion,
        sandbox: config.sandbox,
      };

      // Exchange code for token
      const result = await this.lazadaApi.makeLazadaRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/auth/token/create',
          params: {
            code: authCode,
          },
          requiresAuth: false,
          rateLimitKey: 'auth_token',
        },
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get access token');
      }

      const tokenData = result.data;

      // Calculate expiration dates
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
      const refreshExpiresAt = new Date(now.getTime() + (tokenData.refresh_expires_in * 1000));

      const tokenInfo: LazadaTokenInfo = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        accessTokenType: tokenData.access_token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        refreshTokenExpiresIn: tokenData.refresh_expires_in,
        countryUserInfo: tokenData.country_user_info || [],
        expiresAt,
        refreshExpiresAt,
      };

      // Store credentials in channel config
      await this.storeCredentials(tenantId, channelId, config, tokenInfo);

      // Log successful authentication
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Lazada access token obtained successfully',
        metadata: {
          region: config.region as LazadaRegion,
          expiresAt: expiresAt.toISOString(),
          refreshExpiresAt: refreshExpiresAt.toISOString(),
          countryUserInfo: tokenInfo.countryUserInfo,
        },
      });

      return tokenInfo;

    } catch (error) {
      this.logger.error(`Token exchange failed: ${error.message}`, error.stack);

      // Log authentication failure
      await this.logService.logError(
        tenantId,
        channelId,
        error,
        {
          metadata: {
            tokenExchange: true,
            region: config.region as LazadaRegion,
          },
        },
      );

      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    tenantId: string,
    channelId: string,
  ): Promise<LazadaTokenInfo> {
    try {
      this.logger.debug(`Refreshing Lazada access token`, {
        tenantId,
        channelId,
      });

      // Get current credentials
      const credentials = await this.getValidCredentials(tenantId, channelId);
      
      if (!credentials.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Check if refresh token is still valid
      if (new Date() >= credentials.refreshExpiresAt) {
        throw new Error('Refresh token has expired');
      }

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        region: credentials.region as any,
        refreshToken: credentials.refreshToken,
      };

      // Refresh token
      const result = await this.lazadaApi.makeLazadaRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/auth/token/refresh',
          params: {
            refresh_token: credentials.refreshToken,
          },
          requiresAuth: false,
          rateLimitKey: 'auth_refresh',
        },
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to refresh token');
      }

      const tokenData = result.data;

      // Calculate new expiration dates
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
      const refreshExpiresAt = new Date(now.getTime() + (tokenData.refresh_expires_in * 1000));

      const tokenInfo: LazadaTokenInfo = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        accessTokenType: tokenData.access_token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        refreshTokenExpiresIn: tokenData.refresh_expires_in,
        countryUserInfo: tokenData.country_user_info || [],
        expiresAt,
        refreshExpiresAt,
      };

      // Update stored credentials
      const authConfig: LazadaAuthConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        region: credentials.region as any,
        redirectUri: '', // Not needed for refresh
      };

      await this.storeCredentials(tenantId, channelId, authConfig, tokenInfo);

      // Log successful refresh
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Lazada access token refreshed successfully',
        metadata: {
          expiresAt: expiresAt.toISOString(),
          refreshExpiresAt: refreshExpiresAt.toISOString(),
        },
      });

      return tokenInfo;

    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);

      // Log refresh failure
      await this.logService.logError(
        tenantId,
        channelId,
        error,
        {
          metadata: {
            tokenRefresh: true,
          },
        },
      );

      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Get valid credentials with automatic refresh
   */
  async getValidCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<LazadaCredentials> {
    try {
      // Get channel with config
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId, name: 'lazada' },
      });

      if (!channel || !channel.config) {
        throw new Error('Lazada channel not found or not configured');
      }

      const config = channel.config as any;

      if (!config.auth || !config.auth.accessToken) {
        throw new Error('No access token found in channel configuration');
      }

      const credentials: LazadaCredentials = {
        appKey: config.auth.appKey,
        appSecret: config.auth.appSecret,
        accessToken: config.auth.accessToken,
        refreshToken: config.auth.refreshToken,
        region: config.auth.region,
        expiresAt: new Date(config.auth.expiresAt),
        refreshExpiresAt: new Date(config.auth.refreshExpiresAt),
      };

      // Check if access token is still valid
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

      if (now.getTime() + bufferTime >= credentials.expiresAt.getTime()) {
        // Token is expired or will expire soon, refresh it
        this.logger.debug('Access token expired or expiring soon, refreshing...', {
          tenantId,
          channelId,
          expiresAt: credentials.expiresAt.toISOString(),
        });

        const refreshedToken = await this.refreshAccessToken(tenantId, channelId);
        
        return {
          ...credentials,
          accessToken: refreshedToken.accessToken,
          refreshToken: refreshedToken.refreshToken,
          expiresAt: refreshedToken.expiresAt,
          refreshExpiresAt: refreshedToken.refreshExpiresAt,
        };
      }

      return credentials;

    } catch (error) {
      this.logger.error(`Failed to get valid credentials: ${error.message}`, error.stack);
      throw new Error(`Credential validation failed: ${error.message}`);
    }
  }

  /**
   * Test authentication with current credentials
   */
  async testAuthentication(
    tenantId: string,
    channelId: string,
  ): Promise<{ valid: boolean; shopInfo?: any; error?: string }> {
    try {
      const credentials = await this.getValidCredentials(tenantId, channelId);

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Test with shop info endpoint
      const result = await this.lazadaApi.getShopInfo(tenantId, channelId, lazadaConfig);

      if (result.success) {
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.AUTH,
          level: IntegrationLogLevel.INFO,
          message: 'Lazada authentication test successful',
          metadata: { shopInfo: result.data },
        });

        return {
          valid: true,
          shopInfo: result.data,
        };
      } else {
        return {
          valid: false,
          error: result.error,
        };
      }

    } catch (error) {
      this.logger.error(`Authentication test failed: ${error.message}`, error.stack);
      return {
        valid: false,
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
      // Clear stored credentials
      await this.clearStoredCredentials(tenantId, channelId);

      // Log revocation
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Lazada authentication revoked',
        metadata: {},
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to revoke authentication: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private generateState(): string {
    return `lazada_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeCredentials(
    tenantId: string,
    channelId: string,
    config: LazadaAuthConfig,
    tokenInfo: LazadaTokenInfo,
  ): Promise<void> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new Error('Channel not found');
      }

      // Update channel config with authentication info
      const updatedConfig = {
        ...channel.config,
        auth: {
          appKey: config.appKey,
          appSecret: config.appSecret,
          accessToken: tokenInfo.accessToken,
          refreshToken: tokenInfo.refreshToken,
          accessTokenType: tokenInfo.accessTokenType,
          region: config.region as LazadaRegion,
          expiresAt: tokenInfo.expiresAt.toISOString(),
          refreshExpiresAt: tokenInfo.refreshExpiresAt.toISOString(),
          countryUserInfo: tokenInfo.countryUserInfo,
          lastUpdated: new Date().toISOString(),
        },
      };

      await this.channelRepository.update(
        { id: channelId, tenantId },
        { config: updatedConfig },
      );

    } catch (error) {
      this.logger.error(`Failed to store credentials: ${error.message}`, error.stack);
      throw new Error(`Credential storage failed: ${error.message}`);
    }
  }

  private async clearStoredCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel) {
        throw new Error('Channel not found');
      }

      // Clear auth section from config
      const updatedConfig = {
        ...channel.config,
        auth: null,
      };

      await this.channelRepository.update(
        { id: channelId, tenantId },
        { config: updatedConfig },
      );

    } catch (error) {
      this.logger.error(`Failed to clear credentials: ${error.message}`, error.stack);
      throw new Error(`Credential clearing failed: ${error.message}`);
    }
  }
}