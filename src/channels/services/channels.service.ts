import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { Channel, ChannelStatus, ChannelType, SyncStrategy } from '../entities/channel.entity';
import { ChannelConfig } from '../entities/channel-config.entity';

// Integration services
import { ShopeeApiService } from '../../integrations/shopee/services/shopee-api.service';
import { ShopeeAuthService } from '../../integrations/shopee/services/shopee-auth.service';
import { LazadaApiService } from '../../integrations/lazada/services/lazada-api.service';
import { LazadaAuthService } from '../../integrations/lazada/services/lazada-auth.service';
import { TokopediaApiService } from '../../integrations/tokopedia/services/tokopedia-api.service';
import { TokopediaAuthService } from '../../integrations/tokopedia/services/tokopedia-auth.service';
import { WhatsAppApiService } from '../../integrations/whatsapp/services/whatsapp-api.service';
import { WhatsAppAuthService } from '../../integrations/whatsapp/services/whatsapp-auth.service';

// Common services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../integrations/entities/integration-log.entity';

export interface CreateChannelDto {
  name: string;
  description?: string;
  channelType: ChannelType;
  platformId: string;
  platformName: string;
  platformUrl?: string;
  storeName?: string;
  storeId?: string;
  syncStrategy?: SyncStrategy;
  syncFrequency?: string;
  autoSync?: boolean;
  apiCredentials?: any;
  apiConfig?: any;
  settings?: any;
  logo?: string;
  color?: string;
  tags?: string[];
}

export interface UpdateChannelDto {
  name?: string;
  description?: string;
  channelType?: ChannelType;
  status?: ChannelStatus;
  storeName?: string;
  storeId?: string;
  syncStrategy?: SyncStrategy;
  syncFrequency?: string;
  autoSync?: boolean;
  apiCredentials?: any;
  apiConfig?: any;
  settings?: any;
  logo?: string;
  color?: string;
  tags?: string[];
}

export interface ChannelConnectionResult {
  success: boolean;
  channel?: Channel;
  error?: string;
  connectionData?: {
    isAuthenticated: boolean;
    storeInfo?: any;
    apiHealth?: boolean;
    lastConnectionTest?: Date;
  };
}

export interface ChannelListQuery {
  channelType?: ChannelType;
  status?: ChannelStatus;
  platformId?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  includeMetrics?: boolean;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelConfig)
    private readonly configRepository: Repository<ChannelConfig>,
    
    // Integration services
    private readonly shopeeApiService: ShopeeApiService,
    private readonly shopeeAuthService: ShopeeAuthService,
    private readonly lazadaApiService: LazadaApiService,
    private readonly lazadaAuthService: LazadaAuthService,
    private readonly tokopediaApiService: TokopediaApiService,
    private readonly tokopediaAuthService: TokopediaAuthService,
    private readonly whatsappApiService: WhatsAppApiService,
    private readonly whatsappAuthService: WhatsAppAuthService,
    
    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new channel
   */
  async createChannel(tenantId: string, createDto: CreateChannelDto): Promise<Channel> {
    try {
      this.logger.debug(`Creating channel for tenant ${tenantId}`, { createDto });

      // Validate platform support
      await this.validatePlatformSupport(createDto.platformId);

      // Check for duplicate platform connection
      await this.checkDuplicateConnection(tenantId, createDto.platformId, createDto.storeId);

      // Create channel entity
      const channel = this.channelRepository.create({
        ...createDto,
        tenantId,
        status: ChannelStatus.SETUP_PENDING,
        syncStrategy: createDto.syncStrategy || SyncStrategy.SCHEDULED,
        autoSync: createDto.autoSync !== undefined ? createDto.autoSync : true,
        consecutiveErrors: 0,
        isEnabled: true,
        sortOrder: await this.getNextSortOrder(tenantId),
      });

      const savedChannel = await this.channelRepository.save(channel);

      // Create default channel config
      if (createDto.apiCredentials || createDto.settings) {
        await this.createDefaultConfig(savedChannel.id);
      }

      // Log creation
      await this.logService.log({
        tenantId,
        channelId: savedChannel.id,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel created: ${createDto.name} (${createDto.platformId})`,
        metadata: { channelId: savedChannel.id, platformId: createDto.platformId },
      });

      // Emit event
      this.eventEmitter.emit('channel.created', {
        tenantId,
        channel: savedChannel,
      });

      return savedChannel;

    } catch (error) {
      this.logger.error(`Failed to create channel: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'create_channel', createDto },
      });
      throw error;
    }
  }

  /**
   * Get all channels for a tenant
   */
  async getChannels(tenantId: string, query: ChannelListQuery = {}): Promise<{
    channels: Channel[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<Channel> = { tenantId };

      if (query.channelType) {
        where.channelType = query.channelType;
      }

      if (query.status) {
        where.status = query.status;
      }

      if (query.platformId) {
        where.platformId = query.platformId;
      }

      const queryBuilder = this.channelRepository.createQueryBuilder('channel')
        .where(where);

      // Search filter
      if (query.search) {
        queryBuilder.andWhere(
          '(channel.name ILIKE :search OR channel.description ILIKE :search OR channel.storeName ILIKE :search)',
          { search: `%${query.search}%` }
        );
      }

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        queryBuilder.andWhere('channel.tags && :tags', { tags: query.tags });
      }

      // Include relations
      queryBuilder.leftJoinAndSelect('channel.config', 'config');

      if (query.includeMetrics) {
        queryBuilder.leftJoinAndSelect('channel.inventoryAllocations', 'inventory');
        queryBuilder.leftJoinAndSelect('channel.mappings', 'mappings');
      }

      // Pagination
      if (query.limit) {
        queryBuilder.take(query.limit);
      }
      if (query.offset) {
        queryBuilder.skip(query.offset);
      }

      // Ordering
      queryBuilder.orderBy('channel.sortOrder', 'ASC')
        .addOrderBy('channel.createdAt', 'DESC');

      const [channels, total] = await queryBuilder.getManyAndCount();

      return { channels, total };

    } catch (error) {
      this.logger.error(`Failed to get channels: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a specific channel by ID
   */
  async getChannelById(tenantId: string, channelId: string): Promise<Channel> {
    try {
      const channel = await this.channelRepository.findOne({
        where: { tenantId, id: channelId },
        relations: ['config', 'inventoryAllocations', 'mappings'],
      });

      if (!channel) {
        throw new NotFoundException(`Channel with ID ${channelId} not found`);
      }

      return channel;

    } catch (error) {
      this.logger.error(`Failed to get channel: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a channel
   */
  async updateChannel(tenantId: string, channelId: string, updateDto: UpdateChannelDto): Promise<Channel> {
    try {
      const channel = await this.getChannelById(tenantId, channelId);

      // Update channel properties
      Object.assign(channel, updateDto);

      // Handle status changes
      if (updateDto.status && updateDto.status !== channel.status) {
        channel.updateStatus(updateDto.status);
      }

      const updatedChannel = await this.channelRepository.save(channel);

      // Log update
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel updated: ${channel.name}`,
        metadata: { updates: updateDto },
      });

      // Emit event
      this.eventEmitter.emit('channel.updated', {
        tenantId,
        channelId,
        channel: updatedChannel,
        changes: updateDto,
      });

      return updatedChannel;

    } catch (error) {
      this.logger.error(`Failed to update channel: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'update_channel', updateDto },
      });
      throw error;
    }
  }

  /**
   * Delete a channel
   */
  async deleteChannel(tenantId: string, channelId: string): Promise<void> {
    try {
      const channel = await this.getChannelById(tenantId, channelId);

      // Soft delete by disabling
      channel.updateStatus(ChannelStatus.INACTIVE, 'Channel deleted');
      channel.isEnabled = false;
      
      await this.channelRepository.save(channel);

      // Log deletion
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel deleted: ${channel.name}`,
        metadata: { channelId },
      });

      // Emit event
      this.eventEmitter.emit('channel.deleted', {
        tenantId,
        channelId,
        channel,
      });

    } catch (error) {
      this.logger.error(`Failed to delete channel: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'delete_channel' },
      });
      throw error;
    }
  }

  /**
   * Test channel connection
   */
  async testChannelConnection(tenantId: string, channelId: string): Promise<ChannelConnectionResult> {
    try {
      const channel = await this.getChannelById(tenantId, channelId);

      this.logger.debug(`Testing connection for channel ${channelId} (${channel.platformId})`);

      let connectionResult: ChannelConnectionResult = {
        success: false,
        channel,
      };

      // Test connection based on platform
      switch (channel.platformId.toLowerCase()) {
        case 'shopee':
          connectionResult = await this.testShopeeConnection(tenantId, channelId, channel);
          break;

        case 'lazada':
          connectionResult = await this.testLazadaConnection(tenantId, channelId, channel);
          break;

        case 'tokopedia':
          connectionResult = await this.testTokopediaConnection(tenantId, channelId, channel);
          break;

        case 'whatsapp':
          connectionResult = await this.testWhatsAppConnection(tenantId, channelId, channel);
          break;

        default:
          throw new BadRequestException(`Platform ${channel.platformId} is not supported`);
      }

      // Update channel status based on connection result
      if (connectionResult.success) {
        channel.clearErrors();
        if (channel.status === ChannelStatus.ERROR) {
          channel.updateStatus(ChannelStatus.ACTIVE);
        }
      } else {
        channel.recordError(connectionResult.error || 'Connection test failed');
      }

      await this.channelRepository.save(channel);

      // Log connection test
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: connectionResult.success ? IntegrationLogLevel.INFO : IntegrationLogLevel.ERROR,
        message: `Connection test ${connectionResult.success ? 'passed' : 'failed'}: ${channel.platformId}`,
        metadata: { 
          platformId: channel.platformId,
          connectionData: connectionResult.connectionData,
          error: connectionResult.error,
        },
      });

      return connectionResult;

    } catch (error) {
      this.logger.error(`Failed to test channel connection: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'test_connection' },
      });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update channel credentials
   */
  async updateChannelCredentials(
    tenantId: string,
    channelId: string,
    credentials: any,
    testConnection: boolean = true,
  ): Promise<ChannelConnectionResult> {
    try {
      const channel = await this.getChannelById(tenantId, channelId);

      // Update credentials
      channel.updateCredentials(credentials);
      await this.channelRepository.save(channel);

      // Test connection if requested
      if (testConnection) {
        return await this.testChannelConnection(tenantId, channelId);
      }

      // Log credential update
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.AUTH,
        level: IntegrationLogLevel.INFO,
        message: `Credentials updated for ${channel.platformId}`,
        metadata: { platformId: channel.platformId },
      });

      return {
        success: true,
        channel,
      };

    } catch (error) {
      this.logger.error(`Failed to update credentials: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, channelId, error, {
        metadata: { action: 'update_credentials' },
      });
      throw error;
    }
  }

  /**
   * Get channels by platform
   */
  async getChannelsByPlatform(tenantId: string, platformId: string): Promise<Channel[]> {
    return this.channelRepository.find({
      where: {
        tenantId,
        platformId: platformId.toLowerCase(),
        isEnabled: true,
      },
      relations: ['config'],
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * Get active channels
   */
  async getActiveChannels(tenantId: string): Promise<Channel[]> {
    return this.channelRepository.find({
      where: {
        tenantId,
        status: ChannelStatus.ACTIVE,
        isEnabled: true,
      },
      relations: ['config'],
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * Update channel sync timestamp
   */
  async updateSyncTimestamp(tenantId: string, channelId: string): Promise<void> {
    const channel = await this.getChannelById(tenantId, channelId);
    channel.updateSyncTimestamp();
    await this.channelRepository.save(channel);
  }

  /**
   * Update channel metrics
   */
  async updateChannelMetrics(tenantId: string, channelId: string, metrics: any): Promise<void> {
    const channel = await this.getChannelById(tenantId, channelId);
    channel.updateMetrics(metrics);
    await this.channelRepository.save(channel);
  }

  // Private helper methods

  private async validatePlatformSupport(platformId: string): Promise<void> {
    const supportedPlatforms = ['shopee', 'lazada', 'tokopedia', 'whatsapp'];
    if (!supportedPlatforms.includes(platformId.toLowerCase())) {
      throw new BadRequestException(`Platform ${platformId} is not supported`);
    }
  }

  private async checkDuplicateConnection(
    tenantId: string,
    platformId: string,
    storeId?: string,
  ): Promise<void> {
    const existingChannel = await this.channelRepository.findOne({
      where: {
        tenantId,
        platformId: platformId.toLowerCase(),
        ...(storeId && { storeId }),
        isEnabled: true,
      },
    });

    if (existingChannel) {
      throw new BadRequestException(
        `Channel for ${platformId}${storeId ? ` (Store: ${storeId})` : ''} already exists`
      );
    }
  }

  private async getNextSortOrder(tenantId: string): Promise<number> {
    const maxSortOrder = await this.channelRepository
      .createQueryBuilder('channel')
      .select('MAX(channel.sortOrder)', 'maxSort')
      .where('channel.tenantId = :tenantId', { tenantId })
      .getRawOne();

    return (maxSortOrder?.maxSort || 0) + 1;
  }

  private async createDefaultConfig(channelId: string): Promise<void> {
    const config = this.configRepository.create({
      channelId,
      syncConfig: {
        batchSize: 100,
        concurrency: 3,
        conflictResolution: 'manual',
      },
      notificationConfig: {
        email: { enabled: false, events: [], recipients: [] },
        webhook: { enabled: false, url: '', events: [] },
        inApp: { enabled: true, events: ['sync_failed', 'auth_expired'] },
      },
    });

    await this.configRepository.save(config);
  }

  // Platform-specific connection tests

  private async testShopeeConnection(
    tenantId: string,
    channelId: string,
    channel: Channel,
  ): Promise<ChannelConnectionResult> {
    try {
      // Test authentication
      const authResult = await this.shopeeAuthService.testAuthentication(tenantId, channelId);
      if (!authResult.valid) {
        return {
          success: false,
          error: authResult.error || 'Shopee authentication failed',
        };
      }

      // Get store info
      const storeInfo = await this.shopeeApiService.getShopInfo(
        channel.apiCredentials as any,
        tenantId,
        channelId,
      );

      return {
        success: true,
        channel,
        connectionData: {
          isAuthenticated: true,
          storeInfo: storeInfo.success ? storeInfo.data : null,
          apiHealth: true,
          lastConnectionTest: new Date(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Shopee connection failed: ${error.message}`,
      };
    }
  }

  private async testLazadaConnection(
    tenantId: string,
    channelId: string,
    channel: Channel,
  ): Promise<ChannelConnectionResult> {
    try {
      // Test authentication
      const authResult = await this.lazadaAuthService.testAuthentication(tenantId, channelId);
      if (!authResult.valid) {
        return {
          success: false,
          error: authResult.error || 'Lazada authentication failed',
        };
      }

      // Get seller info
      const sellerInfo = await this.lazadaApiService.getShopInfo(
        tenantId,
        channelId,
        channel.apiCredentials as any,
      );

      return {
        success: true,
        channel,
        connectionData: {
          isAuthenticated: true,
          storeInfo: sellerInfo.success ? sellerInfo.data : null,
          apiHealth: true,
          lastConnectionTest: new Date(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Lazada connection failed: ${error.message}`,
      };
    }
  }

  private async testTokopediaConnection(
    tenantId: string,
    channelId: string,
    channel: Channel,
  ): Promise<ChannelConnectionResult> {
    try {
      // Test authentication
      const authResult = await this.tokopediaAuthService.testAuthentication(tenantId, channelId);
      if (!authResult.isValid) {
        return {
          success: false,
          error: authResult.error || 'Tokopedia authentication failed',
        };
      }

      // Get shop info
      const shopInfo = await this.tokopediaApiService.getShopInfo(
        tenantId,
        channelId,
        channel.apiCredentials as any,
      );

      return {
        success: true,
        channel,
        connectionData: {
          isAuthenticated: true,
          storeInfo: shopInfo.success ? shopInfo.data : null,
          apiHealth: true,
          lastConnectionTest: new Date(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `Tokopedia connection failed: ${error.message}`,
      };
    }
  }

  private async testWhatsAppConnection(
    tenantId: string,
    channelId: string,
    channel: Channel,
  ): Promise<ChannelConnectionResult> {
    try {
      // Test authentication
      const authResult = await this.whatsappAuthService.testAuthentication(tenantId, channelId);
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'WhatsApp authentication failed',
        };
      }

      // Get account info
      const accountInfo = await this.whatsappApiService.getAccountInfo(
        tenantId,
        channelId,
        channel.apiCredentials as any,
      );

      return {
        success: true,
        channel,
        connectionData: {
          isAuthenticated: true,
          storeInfo: accountInfo.success ? accountInfo.data : null,
          apiHealth: true,
          lastConnectionTest: new Date(),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: `WhatsApp connection failed: ${error.message}`,
      };
    }
  }
}