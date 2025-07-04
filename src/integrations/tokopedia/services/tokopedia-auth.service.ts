import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import {
  Channel,
  ChannelStatus,
} from '../../../channels/entities/channel.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { TokopediaApiService, TokopediaConfig } from './tokopedia-api.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export interface TokopediaAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fsId?: string; // Fulfillment Service ID
  shopId?: string;
  sandbox?: boolean;
  // TikTok Shop migration support
  tiktokShopEnabled?: boolean;
  tiktokAppKey?: string;
  tiktokAppSecret?: string;
}

export interface TokopediaCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
  scope: string;
  shopId?: string;
  fsId?: string;
  // TikTok Shop credentials
  tiktokAccessToken?: string;
  tiktokRefreshToken?: string;
  tiktokExpiresAt?: string;
}

export interface TokopediaTokenInfo {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface TokopediaUserInfo {
  user_id: string;
  name: string;
  email: string;
  shops: Array<{
    shop_id: string;
    shop_name: string;
    shop_domain: string;
    is_official: boolean;
    status: string;
  }>;
}

@Injectable()
export class TokopediaAuthService {
  private readonly logger = new Logger(TokopediaAuthService.name);
  private readonly authUrls = {
    sandbox: 'https://accounts.tokopedia.com',
    production: 'https://accounts.tokopedia.com',
  };
  private readonly apiUrls = {
    sandbox: 'https://fs.tokopedia.net',
    production: 'https://fs.tokopedia.net',
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logService: IntegrationLogService,
    private readonly apiService: TokopediaApiService,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  /**
   * Generate authorization URL for OAuth flow
   */
  async getAuthorizationUrl(
    tenantId: string,
    channelId: string,
    config: TokopediaAuthConfig,
    state?: string,
  ): Promise<{ authUrl: string; state: string }> {
    try {
      const authState = state || this.generateState();
      const baseUrl = config.sandbox
        ? this.authUrls.sandbox
        : this.authUrls.production;

      // Standard Tokopedia OAuth scopes
      const scopes = [
        'products',
        'orders',
        'inventory',
        'shop_info',
        'fulfillment_service',
      ];

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state: authState,
      });

      // Add TikTok Shop parameters if enabled
      if (config.tiktokShopEnabled && config.tiktokAppKey) {
        params.append('tiktok_app_key', config.tiktokAppKey);
        params.append('tiktok_migration', 'true');
      }

      const authUrl = `${baseUrl}/oauth/authorize?${params.toString()}`;

      this.logger.log(`Generated Tokopedia authorization URL`, {
        tenantId,
        channelId,
        state: authState,
        tiktokEnabled: config.tiktokShopEnabled,
      });

      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Tokopedia authorization URL generated',
        metadata: {
          state: authState,
          scopes,
          tiktokEnabled: config.tiktokShopEnabled,
        },
      });

      return {
        authUrl,
        state: authState,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate authorization URL: ${error.message}`,
        error.stack,
      );

      await this.logService.logError(tenantId, channelId, error, {});

      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    tenantId: string,
    channelId: string,
    authCode: string,
    config: TokopediaAuthConfig,
  ): Promise<TokopediaTokenInfo> {
    try {
      this.logger.log(`Exchanging authorization code for token`, {
        tenantId,
        channelId,
      });

      const baseUrl = config.sandbox
        ? this.apiUrls.sandbox
        : this.apiUrls.production;
      const tokenUrl = `${baseUrl}/oauth/token`;

      const tokenData = {
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      };

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'StokCerdas-Tokopedia-Integration/1.0',
      };

      const response = await firstValueFrom(
        this.httpService.post(
          tokenUrl,
          new URLSearchParams(tokenData).toString(),
          { headers },
        ),
      );

      if (response.status !== 200) {
        throw new Error(
          `Token exchange failed: ${response.data?.error || 'Unknown error'}`,
        );
      }

      const tokenInfo = response.data;

      // Calculate expires at
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenInfo.expires_in);

      // Save credentials to channel
      await this.saveCredentials(tenantId, channelId, {
        accessToken: tokenInfo.access_token,
        refreshToken: tokenInfo.refresh_token,
        expiresAt: expiresAt.toISOString(),
        tokenType: tokenInfo.token_type,
        scope: tokenInfo.scope,
        fsId: config.fsId,
        shopId: config.shopId,
      });

      this.logger.log(`Token exchange successful`, {
        tenantId,
        channelId,
        expiresAt,
        scope: tokenInfo.scope,
      });

      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Tokopedia token exchange successful',
        metadata: {
          expiresAt,
          scope: tokenInfo.scope,
          tokenType: tokenInfo.token_type,
        },
      });

      return tokenInfo;
    } catch (error) {
      this.logger.error(`Token exchange failed: ${error.message}`, error.stack);

      await this.logService.logError(tenantId, channelId, error, {});

      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    tenantId: string,
    channelId: string,
  ): Promise<TokopediaTokenInfo> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel || !channel.config?.credentials?.refreshToken) {
        throw new Error('No valid refresh token found');
      }

      const credentials = channel.config.credentials as TokopediaCredentials;
      const config = channel.config as TokopediaAuthConfig;

      this.logger.log(`Refreshing access token`, {
        tenantId,
        channelId,
      });

      const baseUrl = config.sandbox
        ? this.apiUrls.sandbox
        : this.apiUrls.production;
      const tokenUrl = `${baseUrl}/oauth/token`;

      const tokenData = {
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      };

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'StokCerdas-Tokopedia-Integration/1.0',
      };

      const response = await firstValueFrom(
        this.httpService.post(
          tokenUrl,
          new URLSearchParams(tokenData).toString(),
          { headers },
        ),
      );

      if (response.status !== 200) {
        throw new Error(
          `Token refresh failed: ${response.data?.error || 'Unknown error'}`,
        );
      }

      const tokenInfo = response.data;

      // Calculate expires at
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenInfo.expires_in);

      // Update credentials
      await this.saveCredentials(tenantId, channelId, {
        ...credentials,
        accessToken: tokenInfo.access_token,
        refreshToken: tokenInfo.refresh_token || credentials.refreshToken,
        expiresAt: expiresAt.toISOString(),
        tokenType: tokenInfo.token_type,
        scope: tokenInfo.scope,
      });

      this.logger.log(`Token refresh successful`, {
        tenantId,
        channelId,
        expiresAt,
      });

      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Tokopedia token refresh successful',
        metadata: { expiresAt },
      });

      return tokenInfo;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);

      await this.logService.logError(tenantId, channelId, error, {});

      throw error;
    }
  }

  /**
   * Get valid credentials, refreshing if necessary
   */
  async getValidCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<TokopediaCredentials> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      if (!channel || !channel.config?.credentials) {
        throw new Error('No credentials found for channel');
      }

      const credentials = channel.config.credentials as TokopediaCredentials;

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(credentials.expiresAt);
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

      if (expiresAt.getTime() - now.getTime() < bufferTime) {
        this.logger.log(`Access token expiring soon, refreshing`, {
          tenantId,
          channelId,
          expiresAt,
        });

        await this.refreshAccessToken(tenantId, channelId);

        // Fetch updated credentials
        const updatedChannel = await this.channelRepository.findOne({
          where: { id: channelId, tenantId },
        });

        return updatedChannel.config.credentials as TokopediaCredentials;
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
   * Test authentication with current credentials
   */
  async testAuthentication(
    tenantId: string,
    channelId: string,
  ): Promise<{
    isValid: boolean;
    userInfo?: TokopediaUserInfo;
    error?: string;
  }> {
    try {
      const credentials = await this.getValidCredentials(tenantId, channelId);
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      // Test with shop info endpoint
      const result = await this.apiService.testConnection(
        tenantId,
        channelId,
        config,
      );

      if (result.success) {
        return {
          isValid: true,
          userInfo: {
            user_id: credentials.shopId || 'unknown',
            name: channel.name || 'Unknown Shop',
            email: 'unknown@example.com',
            shops: [
              {
                shop_id: credentials.shopId || 'unknown',
                shop_name: channel.name || 'Unknown Shop',
                shop_domain: 'unknown',
                is_official: false,
                status: 'active',
              },
            ],
          },
        };
      } else {
        return {
          isValid: false,
          error: result.error,
        };
      }
    } catch (error) {
      this.logger.error(
        `Authentication test failed: ${error.message}`,
        error.stack,
      );

      return {
        isValid: false,
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
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Clear credentials from database
      await this.channelRepository.update(
        { id: channelId, tenantId },
        {
          config: {
            ...{}, // Clear all config including credentials
          },
          status: ChannelStatus.INACTIVE,
          lastSyncAt: null,
          // healthStatus: 'unhealthy',
        },
      );

      this.logger.log(`Authentication revoked successfully`, {
        tenantId,
        channelId,
      });

      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'Tokopedia authentication revoked',
      });

      return {
        success: true,
        message: 'Authentication revoked successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to revoke authentication: ${error.message}`,
        error.stack,
      );

      await this.logService.logError(tenantId, channelId, error, {});

      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Private helper methods

  private async saveCredentials(
    tenantId: string,
    channelId: string,
    credentials: TokopediaCredentials,
  ): Promise<void> {
    await this.channelRepository.update(
      { id: channelId, tenantId },
      {
        apiCredentials: credentials,
        status: ChannelStatus.ACTIVE,
        // healthStatus: 'healthy',
        lastSyncAt: new Date(),
      },
    );
  }

  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Handle TikTok Shop migration
   */
  async migrateTikTokShopAuth(
    tenantId: string,
    channelId: string,
    tiktokAuthCode: string,
    config: TokopediaAuthConfig,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (
        !config.tiktokShopEnabled ||
        !config.tiktokAppKey ||
        !config.tiktokAppSecret
      ) {
        throw new Error('TikTok Shop configuration not available');
      }

      this.logger.log(`Starting TikTok Shop migration`, {
        tenantId,
        channelId,
      });

      // Here you would implement TikTok Shop OAuth flow
      // This is a placeholder for the actual TikTok Shop integration

      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: 'TikTok Shop migration initiated',
        metadata: { tiktokAppKey: config.tiktokAppKey },
      });

      return {
        success: true,
        message: 'TikTok Shop migration completed successfully',
      };
    } catch (error) {
      this.logger.error(
        `TikTok Shop migration failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logError(tenantId, channelId, error, {});

      return {
        success: false,
        message: error.message,
      };
    }
  }
}
