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
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { UserRole } from '../../users/entities/user.entity';

import { IntegrationLogService } from '../common/services/integration-log.service';
import { RateLimiterService } from '../common/services/rate-limiter.service';
import { WebhookHandlerService } from '../common/services/webhook-handler.service';

export class LogQueryDto {
  channelId?: string;
  type?: string | string[];
  level?: string | string[];
  requestId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'level';
  orderDirection?: 'ASC' | 'DESC';
}

export class RateLimitTestDto {
  key: string;
  platform: string;
  windowSizeMs?: number;
  maxRequests?: number;
}

export class LogCleanupDto {
  channelId?: string;
  olderThanDays?: number;
  maxLogsToKeep?: number;
}

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('integrations')
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(
    private readonly logService: IntegrationLogService,
    private readonly rateLimiter: RateLimiterService,
    private readonly webhookHandler: WebhookHandlerService,
  ) {}

  // Integration logs endpoints

  @Get('logs')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get integration logs' })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'level', required: false })
  @ApiQuery({ name: 'requestId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'orderBy', required: false, enum: ['createdAt', 'level'] })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getLogs(@CurrentUser() user: any, @Query() query: LogQueryDto) {
    try {
      const logQuery: any = {
        tenantId: user.tenantId,
        channelId: query.channelId,
        type: query.type,
        level: query.level,
        requestId: query.requestId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit || 50,
        offset: query.offset || 0,
        orderBy: query.orderBy || 'createdAt',
        orderDirection: query.orderDirection || 'DESC',
      };

      const result = await this.logService.queryLogs(logQuery);

      return {
        success: true,
        data: {
          logs: result.logs,
          total: result.total,
          limit: logQuery.limit,
          offset: logQuery.offset,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get logs: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('logs/stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get integration log statistics' })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({
    status: 200,
    description: 'Log statistics retrieved successfully',
  })
  async getLogStats(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const stats = await this.logService.getLogStats(
        user.tenantId,
        channelId,
        start,
        end,
      );

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get log stats: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('logs/request/:requestId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get logs for specific request' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Request logs retrieved successfully',
  })
  async getRequestLogs(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    try {
      const logs = await this.logService.getRequestLogs(
        user.tenantId,
        requestId,
      );

      return {
        success: true,
        data: {
          logs,
          requestId,
          total: logs.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get request logs: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('logs/errors')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get recent error logs' })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Error logs retrieved successfully',
  })
  async getRecentErrors(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: number,
  ) {
    try {
      const errors = await this.logService.getRecentErrors(
        user.tenantId,
        channelId,
        limit || 50,
      );

      return {
        success: true,
        data: {
          errors,
          total: errors.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recent errors: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('logs/cleanup')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Clean up old integration logs' })
  @ApiResponse({
    status: 200,
    description: 'Log cleanup completed successfully',
  })
  async cleanupLogs(@CurrentUser() user: any, @Body() dto: LogCleanupDto) {
    try {
      const deletedCount = await this.logService.cleanupOldLogs(
        user.tenantId,
        dto.olderThanDays || 30,
        dto.maxLogsToKeep || 100000,
      );

      return {
        success: true,
        data: {
          deletedCount,
          message: `Cleaned up ${deletedCount} old logs`,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup logs: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Rate limiting endpoints

  @Get('rate-limit/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get rate limit status' })
  @ApiQuery({ name: 'key', required: true })
  @ApiQuery({ name: 'platform', required: true })
  @ApiResponse({
    status: 200,
    description: 'Rate limit status retrieved successfully',
  })
  async getRateLimitStatus(
    @CurrentUser() user: any,
    @Query('key') key: string,
    @Query('platform') platform: string,
  ) {
    try {
      const configs = this.rateLimiter.getPlatformRateLimitConfig(platform);
      const results: Record<string, any> = {};

      for (const config of configs) {
        const rateLimitKey = `${user.tenantId}:${key}`;
        const status = await this.rateLimiter.getRateLimitStatus(
          rateLimitKey,
          config,
        );
        results[config.keyPrefix || 'default'] = status;
      }

      return {
        success: true,
        data: {
          key,
          platform,
          rateLimits: results,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get rate limit status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rate-limit/test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Test rate limiting' })
  @ApiResponse({
    status: 201,
    description: 'Rate limit test completed successfully',
  })
  async testRateLimit(@CurrentUser() user: any, @Body() dto: RateLimitTestDto) {
    try {
      const config = {
        windowSizeMs: dto.windowSizeMs || 60000, // 1 minute
        maxRequests: dto.maxRequests || 10,
        keyPrefix: `test_${dto.platform}`,
      };

      const rateLimitKey = `${user.tenantId}:${dto.key}`;
      const result = await this.rateLimiter.checkRateLimit(
        rateLimitKey,
        config,
      );

      return {
        success: true,
        data: {
          key: dto.key,
          platform: dto.platform,
          config,
          result,
          message: result.allowed ? 'Request allowed' : 'Rate limit exceeded',
        },
      };
    } catch (error) {
      this.logger.error(
        `Rate limit test failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('rate-limit/reset')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reset rate limit for specific key' })
  @ApiQuery({ name: 'key', required: true })
  @ApiQuery({ name: 'platform', required: true })
  @ApiResponse({ status: 200, description: 'Rate limit reset successfully' })
  async resetRateLimit(
    @CurrentUser() user: any,
    @Query('key') key: string,
    @Query('platform') platform: string,
  ) {
    try {
      const configs = this.rateLimiter.getPlatformRateLimitConfig(platform);
      const rateLimitKey = `${user.tenantId}:${key}`;

      for (const config of configs) {
        await this.rateLimiter.resetRateLimit(rateLimitKey, config.keyPrefix);
      }

      return {
        success: true,
        data: {
          key,
          platform,
          message: 'Rate limit reset successfully',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to reset rate limit: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Integration status and health endpoints

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get integration health status' })
  @ApiResponse({
    status: 200,
    description: 'Integration health status retrieved successfully',
  })
  async getIntegrationHealth(@CurrentUser() user: any) {
    try {
      // Get basic health metrics
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

      const logStats = await this.logService.getLogStats(
        user.tenantId,
        undefined,
        startTime,
        endTime,
      );

      const webhookStats = await this.webhookHandler.getWebhookStats(
        user.tenantId,
        undefined,
        startTime,
        endTime,
      );

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
          logs: {
            total: logStats.totalLogs,
            errorRate: logStats.errorRate,
            avgResponseTime: logStats.avgResponseTime,
          },
          webhooks: {
            total: webhookStats.totalWebhooks,
            processed: webhookStats.processed,
            failed: webhookStats.failed,
            pending: webhookStats.pending,
            successRate: webhookStats.successRate,
          },
        },
        checks: {
          logging: logStats.totalLogs >= 0,
          webhooks: webhookStats.totalWebhooks >= 0,
          errorRate: logStats.errorRate < 10, // Less than 10% error rate
          responseTime: logStats.avgResponseTime < 5000, // Less than 5 seconds
        },
      };

      // Determine overall health status
      const allChecksPass = Object.values(health.checks).every(Boolean);
      health.status = allChecksPass ? 'healthy' : 'degraded';

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get integration health: ${error.message}`,
        error.stack,
      );

      return {
        success: true,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
      };
    }
  }

  @Get('platforms')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get supported integration platforms' })
  @ApiResponse({
    status: 200,
    description: 'Supported platforms retrieved successfully',
  })
  async getSupportedPlatforms() {
    try {
      const platforms = [
        {
          name: 'shopee',
          displayName: 'Shopee',
          description: 'E-commerce platform integration for Southeast Asia',
          features: ['products', 'orders', 'inventory', 'webhooks'],
          status: 'active',
          region: 'SEA',
        },
        {
          name: 'lazada',
          displayName: 'Lazada',
          description: 'E-commerce platform integration for Southeast Asia',
          features: ['products', 'orders', 'inventory', 'webhooks'],
          status: 'development',
          region: 'SEA',
        },
        {
          name: 'tokopedia',
          displayName: 'Tokopedia',
          description: 'Indonesian e-commerce platform integration',
          features: ['products', 'orders', 'inventory'],
          status: 'development',
          region: 'Indonesia',
        },
        {
          name: 'tiktok_shop',
          displayName: 'TikTok Shop',
          description: 'Social commerce platform integration',
          features: ['products', 'orders', 'inventory'],
          status: 'planned',
          region: 'Global',
        },
      ];

      return {
        success: true,
        data: {
          platforms,
          total: platforms.length,
          active: platforms.filter(p => p.status === 'active').length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get platforms: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sync-status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get integration sync status' })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiResponse({
    status: 200,
    description: 'Sync status retrieved successfully',
  })
  async getSyncStatus(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('entityType') entityType?: string,
  ) {
    try {
      // This would require implementing a sync status query in a SyncStatusService
      // For now, return placeholder data
      return {
        success: true,
        data: {
          syncs: [],
          summary: {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            failed: 0,
          },
        },
        message: 'Sync status query endpoint - implementation pending',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get sync status: ${error.message}`,
        error.stack,
      );
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
