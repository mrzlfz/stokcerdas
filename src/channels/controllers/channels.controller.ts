import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsDateString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities and Enums
import { ChannelType, ChannelStatus, SyncStrategy } from '../entities/channel.entity';

// Services
import { ChannelsService } from '../services/channels.service';
import { ChannelSyncService, SyncType } from '../services/channel-sync.service';

// DTOs
export class CreateChannelDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ChannelType)
  channelType: ChannelType;

  @IsString()
  platformId: string;

  @IsString()
  platformName: string;

  @IsOptional()
  @IsString()
  platformUrl?: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsEnum(SyncStrategy)
  syncStrategy?: SyncStrategy;

  @IsOptional()
  @IsString()
  syncFrequency?: string;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsObject()
  apiCredentials?: any;

  @IsOptional()
  @IsObject()
  apiConfig?: any;

  @IsOptional()
  @IsObject()
  settings?: any;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ChannelType)
  channelType?: ChannelType;

  @IsOptional()
  @IsEnum(ChannelStatus)
  status?: ChannelStatus;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsEnum(SyncStrategy)
  syncStrategy?: SyncStrategy;

  @IsOptional()
  @IsString()
  syncFrequency?: string;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsObject()
  apiCredentials?: any;

  @IsOptional()
  @IsObject()
  apiConfig?: any;

  @IsOptional()
  @IsObject()
  settings?: any;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateChannelCredentialsDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  sandbox?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  testConnection?: boolean = true;
}

export class ChannelSyncDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelIds?: string[];

  @IsArray()
  @IsEnum(SyncType, { each: true })
  syncTypes: SyncType[];

  @IsEnum(['inbound', 'outbound', 'bidirectional'])
  direction: 'inbound' | 'outbound' | 'bidirectional';

  @IsOptional()
  @IsEnum(['high', 'normal', 'low'])
  priority?: 'high' | 'normal' | 'low';

  @IsOptional()
  @IsDateString()
  scheduleAt?: string;

  @IsOptional()
  @IsObject()
  options?: {
    forceSync?: boolean;
    batchSize?: number;
    dryRun?: boolean;
    filters?: Record<string, any>;
  };
}

export class ChannelsQueryDto {
  @IsOptional()
  @IsEnum(ChannelType)
  channelType?: ChannelType;

  @IsOptional()
  @IsEnum(ChannelStatus)
  status?: ChannelStatus;

  @IsOptional()
  @IsString()
  platformId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeMetrics?: boolean = false;
}

@ApiTags('Channel Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('channels')
export class ChannelsController {
  private readonly logger = new Logger(ChannelsController.name);

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly syncService: ChannelSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all channels' })
  @ApiResponse({ status: 200, description: 'Channels retrieved successfully' })
  @ApiQuery({ name: 'channelType', enum: ChannelType, required: false })
  @ApiQuery({ name: 'status', enum: ChannelStatus, required: false })
  @ApiQuery({ name: 'platformId', type: 'string', required: false })
  @ApiQuery({ name: 'search', type: 'string', required: false })
  @ApiQuery({ name: 'tags', type: 'string', isArray: true, required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiQuery({ name: 'offset', type: 'number', required: false })
  @ApiQuery({ name: 'includeMetrics', type: 'boolean', required: false })
  @Roles('admin', 'manager', 'staff')
  async getChannels(
    @CurrentUser() user: any,
    @Query() query: ChannelsQueryDto,
  ) {
    try {
      const result = await this.channelsService.getChannels(user.tenantId, query);
      
      return {
        success: true,
        data: result.channels,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get channels: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':channelId')
  @ApiOperation({ summary: 'Get channel by ID' })
  @ApiResponse({ status: 200, description: 'Channel retrieved successfully' })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles('admin', 'manager', 'staff')
  async getChannelById(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const channel = await this.channelsService.getChannelById(user.tenantId, channelId);
      
      return {
        success: true,
        data: channel,
      };
    } catch (error) {
      this.logger.error(`Failed to get channel: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create new channel' })
  @ApiResponse({ status: 201, description: 'Channel created successfully' })
  @Roles('admin', 'manager')
  async createChannel(
    @CurrentUser() user: any,
    @Body() createDto: CreateChannelDto,
  ) {
    try {
      const channel = await this.channelsService.createChannel(user.tenantId, createDto);
      
      return {
        success: true,
        data: channel,
      };
    } catch (error) {
      this.logger.error(`Failed to create channel: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':channelId')
  @ApiOperation({ summary: 'Update channel' })
  @ApiResponse({ status: 200, description: 'Channel updated successfully' })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles('admin', 'manager')
  async updateChannel(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() updateDto: UpdateChannelDto,
  ) {
    try {
      const channel = await this.channelsService.updateChannel(
        user.tenantId,
        channelId,
        updateDto,
      );
      
      return {
        success: true,
        data: channel,
      };
    } catch (error) {
      this.logger.error(`Failed to update channel: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':channelId')
  @ApiOperation({ summary: 'Delete channel' })
  @ApiResponse({ status: 200, description: 'Channel deleted successfully' })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles('admin', 'manager')
  async deleteChannel(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      await this.channelsService.deleteChannel(user.tenantId, channelId);
      
      return {
        success: true,
        message: 'Channel deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete channel: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':channelId/test-connection')
  @ApiOperation({ summary: 'Test channel connection' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles('admin', 'manager')
  async testConnection(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.channelsService.testChannelConnection(
        user.tenantId,
        channelId,
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to test connection: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':channelId/credentials')
  @ApiOperation({ summary: 'Update channel credentials' })
  @ApiResponse({ status: 200, description: 'Credentials updated successfully' })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles('admin', 'manager')
  async updateCredentials(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() credentialsDto: UpdateChannelCredentialsDto,
  ) {
    try {
      const { testConnection, ...credentials } = credentialsDto;
      
      const result = await this.channelsService.updateChannelCredentials(
        user.tenantId,
        channelId,
        credentials,
        testConnection,
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to update credentials: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('platform/:platformId')
  @ApiOperation({ summary: 'Get channels by platform' })
  @ApiResponse({ status: 200, description: 'Platform channels retrieved successfully' })
  @ApiParam({ name: 'platformId', type: 'string' })
  @Roles('admin', 'manager', 'staff')
  async getChannelsByPlatform(
    @CurrentUser() user: any,
    @Param('platformId') platformId: string,
  ) {
    try {
      const channels = await this.channelsService.getChannelsByPlatform(
        user.tenantId,
        platformId,
      );
      
      return {
        success: true,
        data: channels,
      };
    } catch (error) {
      this.logger.error(`Failed to get platform channels: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status/active')
  @ApiOperation({ summary: 'Get all active channels' })
  @ApiResponse({ status: 200, description: 'Active channels retrieved successfully' })
  @Roles('admin', 'manager', 'staff')
  async getActiveChannels(
    @CurrentUser() user: any,
  ) {
    try {
      const channels = await this.channelsService.getActiveChannels(user.tenantId);
      
      return {
        success: true,
        data: channels,
      };
    } catch (error) {
      this.logger.error(`Failed to get active channels: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Start channel synchronization' })
  @ApiResponse({ status: 200, description: 'Sync started successfully' })
  @Roles('admin', 'manager')
  async startSync(
    @CurrentUser() user: any,
    @Body() syncDto: ChannelSyncDto,
  ) {
    try {
      const scheduleAt = syncDto.scheduleAt ? new Date(syncDto.scheduleAt) : undefined;
      
      const syncId = await this.syncService.startSync(user.tenantId, {
        ...syncDto,
        scheduleAt,
      });
      
      return {
        success: true,
        data: {
          syncId,
          message: scheduleAt ? 'Sync scheduled successfully' : 'Sync started successfully',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to start sync: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':channelId/sync')
  @ApiOperation({ summary: 'Sync specific channel' })
  @ApiResponse({ status: 200, description: 'Channel sync completed' })
  @ApiParam({ name: 'channelId', type: 'string' })
  @Roles('admin', 'manager')
  async syncChannel(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() syncDto: {
      syncType: SyncType;
      direction: 'inbound' | 'outbound' | 'bidirectional';
      options?: any;
    },
  ) {
    try {
      const result = await this.syncService.syncChannel(
        user.tenantId,
        channelId,
        syncDto.syncType,
        syncDto.direction,
        syncDto.options,
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to sync channel: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sync/:syncId/status')
  @ApiOperation({ summary: 'Get sync status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved successfully' })
  @ApiParam({ name: 'syncId', type: 'string' })
  @Roles('admin', 'manager', 'staff')
  async getSyncStatus(
    @CurrentUser() user: any,
    @Param('syncId') syncId: string,
  ) {
    try {
      const status = await this.syncService.getSyncStatus(syncId);
      
      if (!status) {
        throw new HttpException(
          {
            success: false,
            error: 'Sync not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync status: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('sync/:syncId')
  @ApiOperation({ summary: 'Cancel sync' })
  @ApiResponse({ status: 200, description: 'Sync cancelled successfully' })
  @ApiParam({ name: 'syncId', type: 'string' })
  @Roles('admin', 'manager')
  async cancelSync(
    @CurrentUser() user: any,
    @Param('syncId') syncId: string,
  ) {
    try {
      await this.syncService.cancelSync(user.tenantId, syncId);
      
      return {
        success: true,
        message: 'Sync cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel sync: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sync/history')
  @ApiOperation({ summary: 'Get sync history' })
  @ApiResponse({ status: 200, description: 'Sync history retrieved successfully' })
  @ApiQuery({ name: 'channelId', type: 'string', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @Roles('admin', 'manager', 'staff')
  async getSyncHistory(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: number,
  ) {
    try {
      const history = await this.syncService.getSyncHistory(
        user.tenantId,
        channelId,
        limit || 50,
      );
      
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error(`Failed to get sync history: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}