import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { UserRole } from '../../users/entities/user.entity';

import { WebhookHandlerService } from '../common/services/webhook-handler.service';
import { IntegrationLogService } from '../common/services/integration-log.service';

export class WebhookConfigDto {
  platform: string;
  signatureHeader: string;
  secretKey: string;
  signatureAlgorithm: 'sha256' | 'sha1';
  signatureFormat: 'hex' | 'base64';
  includeHeaders?: string[];
  maxRetries?: number;
  retryDelay?: number;
}

export class WebhookTestDto {
  platform: string;
  payload: Record<string, any>;
  signature: string;
  secretKey: string;
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
  ) {}

  // Public webhook endpoints (no auth required)

  @Post('generic/:tenantId/:channelId/:platform')
  @ApiOperation({ summary: 'Generic webhook endpoint for any platform' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'platform', description: 'Platform name (shopee, lazada, tokopedia, etc.)' })
  @ApiHeader({ name: 'x-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleGenericWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Param('platform') platform: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Get raw payload
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);
      const userAgent = headers['user-agent'] || '';

      this.logger.debug(`Generic webhook received: ${platform}`, {
        tenantId,
        channelId,
        platform,
        ipAddress,
        userAgent,
        requestId,
      });

      // Log incoming webhook
      await this.logService.logWebhook(
        tenantId,
        channelId,
        `${platform}_webhook`,
        'received',
        `${platform} webhook received`,
        {
          requestId,
          ipAddress,
          userAgent,
          headers: this.sanitizeHeaders(headers),
          payloadSize: rawPayload.length,
        },
      );

      // Prepare webhook data (generic processing)
      const webhookData = {
        tenantId,
        channelId,
        eventType: this.determineEventType(platform, body),
        eventSource: platform,
        payload: body,
        headers,
        rawPayload,
        signatureHeader: headers['x-signature'] || headers['authorization'],
        ipAddress,
        userAgent,
        webhookUrl: req.originalUrl,
        eventTimestamp: new Date(),
        externalEventId: this.generateExternalEventId(platform, body),
        priority: 2, // Normal priority
      };

      // Process webhook
      const result = await this.webhookHandler.processWebhook(webhookData);

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(`Generic webhook processed successfully: ${platform}`, {
          tenantId,
          channelId,
          platform,
          webhookId: result.webhookId,
          processingTime,
          requestId,
        });

        res.status(HttpStatus.OK).json({
          success: true,
          message: 'Webhook processed successfully',
          requestId,
          processingTime,
        });
      } else {
        this.logger.warn(`Generic webhook processing failed: ${result.error}`, {
          tenantId,
          channelId,
          platform,
          error: result.error,
          processingTime,
          requestId,
        });

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error,
          requestId,
          processingTime,
        });
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Generic webhook error: ${error.message}`, {
        tenantId,
        channelId,
        platform,
        error: error.message,
        stack: error.stack,
        processingTime,
        requestId,
      });

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        `${platform}_webhook`,
        'failed',
        `${platform} webhook processing error: ${error.message}`,
        {
          requestId,
          error: error.message,
          stack: error.stack,
          processingTime,
        },
      );

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId,
        processingTime,
      });
    }
  }

  // Authenticated webhook management endpoints

  @Get('events')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get webhook events' })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'processingStatus', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Webhook events retrieved successfully' })
  async getWebhookEvents(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('eventType') eventType?: string,
    @Query('processingStatus') processingStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      // This would require implementing a query method in WebhookHandlerService
      // For now, return placeholder data
      return {
        success: true,
        data: {
          events: [],
          total: 0,
          limit: limit || 50,
          offset: offset || 0,
        },
        message: 'Webhook events query endpoint - implementation pending',
      };
    } catch (error) {
      this.logger.error(`Failed to get webhook events: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Webhook statistics retrieved successfully' })
  async getWebhookStats(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;

      const stats = await this.webhookHandler.getWebhookStats(
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
      this.logger.error(`Failed to get webhook stats: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('test')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test webhook signature verification' })
  @ApiResponse({ status: 201, description: 'Webhook signature tested successfully' })
  async testWebhookSignature(
    @CurrentUser() user: any,
    @Body() dto: WebhookTestDto,
  ) {
    try {
      const webhookConfig = {
        platform: dto.platform || 'generic',
        signatureHeader: dto.signature,
        secretKey: dto.secretKey,
        signatureAlgorithm: 'sha256' as const,
        signatureFormat: 'hex' as const,
      };
      
      const verified = this.webhookHandler.verifyWebhookSignature(
        dto.payload ? JSON.stringify(dto.payload) : '',
        dto.signature,
        webhookConfig,
      );

      await this.logService.logWebhook(
        user.tenantId,
        '', // No specific channel for test
        'webhook_signature_test',
        verified ? 'processed' : 'failed',
        `Webhook signature test: ${verified ? 'passed' : 'failed'}`,
        {
          platform: dto.platform,
          verified,
          signatureAlgorithm: 'sha256', // Default
        },
      );

      return {
        success: true,
        data: {
          verified,
          platform: dto.platform,
          message: verified ? 'Signature verification passed' : 'Signature verification failed',
        },
      };
    } catch (error) {
      this.logger.error(`Webhook test failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put('events/:webhookId/retry')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry failed webhook event' })
  @ApiParam({ name: 'webhookId', description: 'Webhook event ID' })
  @ApiResponse({ status: 200, description: 'Webhook retry initiated successfully' })
  async retryWebhookEvent(
    @CurrentUser() user: any,
    @Param('webhookId') webhookId: string,
  ) {
    try {
      // This would require implementing a retry method in WebhookHandlerService
      // For now, return placeholder response
      return {
        success: true,
        message: 'Webhook retry initiated',
        webhookId,
      };
    } catch (error) {
      this.logger.error(`Failed to retry webhook: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('events/cleanup')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clean up old webhook events' })
  @ApiQuery({ name: 'olderThanDays', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Webhook cleanup completed successfully' })
  async cleanupWebhookEvents(
    @CurrentUser() user: any,
    @Query('olderThanDays') olderThanDays?: number,
  ) {
    try {
      const deletedCount = await this.webhookHandler.cleanupOldWebhooks(
        user.tenantId,
        olderThanDays || 30,
      );

      return {
        success: true,
        data: {
          deletedCount,
          message: `Cleaned up ${deletedCount} old webhook events`,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to cleanup webhooks: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Health check endpoint
  @Get('health')
  @ApiOperation({ summary: 'Webhook endpoint health check' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is healthy' })
  async healthCheck() {
    return {
      success: true,
      message: 'Webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  // Private helper methods

  private generateRequestId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIpAddress(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers for logging
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'x-signature',
      'cookie',
      'set-cookie',
    ];
    
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

  private determineEventType(platform: string, payload: any): any {
    // Basic event type determination based on payload structure
    // This would be enhanced based on each platform's webhook format
    
    if (payload.order || payload.ordersn || payload.order_sn) {
      return 'order_updated';
    }
    
    if (payload.item || payload.product || payload.item_id) {
      return 'product_updated';
    }
    
    if (payload.stock || payload.inventory) {
      return 'inventory_updated';
    }
    
    return 'system_notification';
  }

  private generateExternalEventId(platform: string, payload: any): string {
    // Generate unique ID based on payload content
    const timestamp = Date.now();
    const identifier = payload.id || 
                      payload.order_sn || 
                      payload.item_id || 
                      payload.event_id ||
                      'unknown';
    
    return `${platform}_${identifier}_${timestamp}`;
  }
}