import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { ShopeeApiService, ShopeeCredentials } from './shopee-api.service';
import { Channel } from '../../../channels/entities/channel.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface ShopeeAuthConfig {
  partnerId: string;
  partnerKey: string;
  redirectUri: string;
  isSandbox?: boolean;
}

export interface ShopeeTokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  shopId: string;
  merchantId: string;
  expiresAt: Date;
}

@Injectable()
export class ShopeeAuthService {
  private readonly logger = new Logger(ShopeeAuthService.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    private readonly shopeeApiService: ShopeeApiService,
    private readonly logService: IntegrationLogService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get authorization URL for Shopee OAuth flow
   */
  async getAuthorizationUrl(
    tenantId: string,
    channelId: string,
    config: ShopeeAuthConfig,
    state?: string,
  ): Promise<{ authUrl: string; state: string }> {
    try {
      // Generate state if not provided
      const authState = state || this.generateState(tenantId, channelId);
      
      const authUrl = this.shopeeApiService.getAuthorizationUrl(
        config.partnerId,
        config.redirectUri,
        authState,
        config.isSandbox,
      );

      await this.logService.logAuth(
        tenantId,
        channelId,
        'authorization_url_generated',
        'success',
        `Authorization URL generated for Shopee`,
        { authUrl, state: authState },
      );

      return { authUrl, state: authState };

    } catch (error) {
      this.logger.error(`Failed to generate Shopee auth URL: ${error.message}`, error.stack);
      
      await this.logService.logAuth(
        tenantId,
        channelId,
        'authorization_url_generation',
        'failed',
        error.message,
      );

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
    shopId: string,
    config: ShopeeAuthConfig,
  ): Promise<ShopeeTokenInfo> {
    try {
      const credentials: Omit<ShopeeCredentials, 'accessToken' | 'shopId'> = {
        partnerId: config.partnerId,
        partnerKey: config.partnerKey,
        isSandbox: config.isSandbox,
      };

      const response = await this.shopeeApiService.getAccessToken(
        credentials,
        authCode,
        shopId,
        tenantId,
        channelId,
      );

      if (!response.success || !response.data) {
        throw new Error(`Token exchange failed: ${response.error?.message}`);
      }

      const tokenData = response.data;
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      const tokenInfo: ShopeeTokenInfo = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        shopId: tokenData.shop_id,
        merchantId: tokenData.merchant_id,
        expiresAt,
      };

      // Save credentials to channel
      await this.saveCredentialsToChannel(
        tenantId,
        channelId,
        tokenInfo,
        config,
      );

      await this.logService.logAuth(
        tenantId,
        channelId,
        'token_exchange',
        'success',
        `Access token obtained for Shopee shop ${shopId}`,
        { shopId, merchantId: tokenData.merchant_id, expiresAt },
      );

      return tokenInfo;

    } catch (error) {
      this.logger.error(`Token exchange failed: ${error.message}`, error.stack);
      
      await this.logService.logAuth(
        tenantId,
        channelId,
        'token_exchange',
        'failed',
        error.message,
        { authCode: authCode.substring(0, 10) + '...', shopId },
      );

      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    tenantId: string,
    channelId: string,
  ): Promise<ShopeeTokenInfo> {
    try {
      const channel = await this.getChannelWithCredentials(tenantId, channelId);
      const credentials = this.extractCredentialsFromChannel(channel);

      if (!credentials.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.shopeeApiService.refreshAccessToken(
        credentials,
        tenantId,
        channelId,
      );

      if (!response.success || !response.data) {
        throw new Error(`Token refresh failed: ${response.error?.message}`);
      }

      const tokenData = response.data;
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      const tokenInfo: ShopeeTokenInfo = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        shopId: tokenData.shop_id,
        merchantId: tokenData.merchant_id,
        expiresAt,
      };

      // Update credentials in channel
      await this.updateChannelCredentials(channel, tokenInfo);

      await this.logService.logAuth(
        tenantId,
        channelId,
        'token_refresh',
        'success',
        `Access token refreshed for Shopee shop ${tokenData.shop_id}`,
        { shopId: tokenData.shop_id, expiresAt },
      );

      return tokenInfo;

    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
      
      await this.logService.logAuth(
        tenantId,
        channelId,
        'token_refresh',
        'failed',
        error.message,
      );

      throw error;
    }
  }

  /**
   * Get valid credentials (refresh if necessary)
   */
  async getValidCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<ShopeeCredentials> {
    try {
      const channel = await this.getChannelWithCredentials(tenantId, channelId);
      const credentials = this.extractCredentialsFromChannel(channel);

      // Check if token is expired or will expire soon (5 minutes buffer)
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes
      const isExpired = credentials.expiresAt && 
        credentials.expiresAt.getTime() <= Date.now() + expiryBuffer;

      if (isExpired && credentials.refreshToken) {
        this.logger.debug(`Token expired for channel ${channelId}, refreshing...`);
        const refreshedTokens = await this.refreshAccessToken(tenantId, channelId);
        
        return this.extractCredentialsFromChannel(
          await this.getChannelWithCredentials(tenantId, channelId)
        );
      }

      return credentials;

    } catch (error) {
      this.logger.error(`Failed to get valid credentials: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Test authentication status
   */
  async testAuthentication(
    tenantId: string,
    channelId: string,
  ): Promise<{ valid: boolean; shopInfo?: any; error?: string }> {
    try {
      const credentials = await this.getValidCredentials(tenantId, channelId);
      
      const response = await this.shopeeApiService.getShopInfo(
        credentials,
        tenantId,
        channelId,
      );

      if (response.success) {
        await this.logService.logAuth(
          tenantId,
          channelId,
          'authentication_test',
          'success',
          `Authentication test passed for Shopee shop ${response.data?.shop_id}`,
          { shopInfo: response.data },
        );

        return {
          valid: true,
          shopInfo: response.data,
        };
      } else {
        await this.logService.logAuth(
          tenantId,
          channelId,
          'authentication_test',
          'failed',
          `Authentication test failed: ${response.error?.message}`,
        );

        return {
          valid: false,
          error: response.error?.message,
        };
      }

    } catch (error) {
      this.logger.error(`Authentication test failed: ${error.message}`, error.stack);
      
      await this.logService.logAuth(
        tenantId,
        channelId,
        'authentication_test',
        'failed',
        error.message,
      );

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
  ): Promise<void> {
    try {
      const channel = await this.getChannelWithCredentials(tenantId, channelId);
      
      // Clear credentials from channel
      channel.config = {
        ...channel.config,
        credentials: null,
      };

      await this.channelRepository.save(channel);

      await this.logService.logAuth(
        tenantId,
        channelId,
        'authentication_revoked',
        'success',
        'Shopee authentication revoked',
      );

    } catch (error) {
      this.logger.error(`Failed to revoke authentication: ${error.message}`, error.stack);
      
      await this.logService.logAuth(
        tenantId,
        channelId,
        'authentication_revoked',
        'failed',
        error.message,
      );

      throw error;
    }
  }

  /**
   * Get channel authentication status
   */
  async getAuthenticationStatus(
    tenantId: string,
    channelId: string,
  ): Promise<{
    isAuthenticated: boolean;
    expiresAt?: Date;
    shopId?: string;
    shopName?: string;
    needsRefresh: boolean;
  }> {
    try {
      const channel = await this.getChannelWithCredentials(tenantId, channelId);
      const credentials = this.extractCredentialsFromChannel(channel);

      if (!credentials.accessToken) {
        return {
          isAuthenticated: false,
          needsRefresh: false,
        };
      }

      // Check if token needs refresh (30 minutes buffer)
      const refreshBuffer = 30 * 60 * 1000; // 30 minutes
      const needsRefresh = credentials.expiresAt &&
        credentials.expiresAt.getTime() <= Date.now() + refreshBuffer;

      // Get shop info if authenticated
      let shopInfo;
      if (credentials.accessToken) {
        try {
          const response = await this.shopeeApiService.getShopInfo(
            credentials,
            tenantId,
            channelId,
          );
          shopInfo = response.success ? response.data : null;
        } catch (error) {
          // If shop info fails, token might be invalid
        }
      }

      return {
        isAuthenticated: !!credentials.accessToken,
        expiresAt: credentials.expiresAt,
        shopId: credentials.shopId,
        shopName: shopInfo?.shop_name,
        needsRefresh: !!needsRefresh,
      };

    } catch (error) {
      this.logger.error(`Failed to get auth status: ${error.message}`, error.stack);
      return {
        isAuthenticated: false,
        needsRefresh: false,
      };
    }
  }

  // Private helper methods

  private generateState(tenantId: string, channelId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return Buffer.from(`${tenantId}:${channelId}:${timestamp}:${random}`)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  private async getChannelWithCredentials(
    tenantId: string,
    channelId: string,
  ): Promise<Channel> {
    const channel = await this.channelRepository.findOne({
      where: {
        id: channelId,
        tenantId,
        platform: 'shopee',
      },
    });

    if (!channel) {
      throw new Error(`Shopee channel not found: ${channelId}`);
    }

    return channel;
  }

  private extractCredentialsFromChannel(channel: Channel): ShopeeCredentials {
    const config = channel.config as any;
    const credentials = config?.credentials || {};

    return {
      partnerId: credentials.partnerId || '',
      partnerKey: credentials.partnerKey || '',
      shopId: credentials.shopId || '',
      accessToken: credentials.accessToken || '',
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : undefined,
      isSandbox: credentials.isSandbox || false,
    };
  }

  private async saveCredentialsToChannel(
    tenantId: string,
    channelId: string,
    tokenInfo: ShopeeTokenInfo,
    config: ShopeeAuthConfig,
  ): Promise<void> {
    const channel = await this.getChannelWithCredentials(tenantId, channelId);

    channel.config = {
      ...channel.config,
      credentials: {
        partnerId: config.partnerId,
        partnerKey: config.partnerKey,
        shopId: tokenInfo.shopId,
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken,
        expiresAt: tokenInfo.expiresAt,
        isSandbox: config.isSandbox,
      },
    };

    // Update channel status
    channel.status = 'active';
    channel.lastSyncAt = new Date();

    await this.channelRepository.save(channel);
  }

  private async updateChannelCredentials(
    channel: Channel,
    tokenInfo: ShopeeTokenInfo,
  ): Promise<void> {
    const config = channel.config as any;
    const existingCredentials = config?.credentials || {};

    channel.config = {
      ...channel.config,
      credentials: {
        ...existingCredentials,
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken,
        expiresAt: tokenInfo.expiresAt,
        shopId: tokenInfo.shopId,
      },
    };

    channel.lastSyncAt = new Date();
    await this.channelRepository.save(channel);
  }
}