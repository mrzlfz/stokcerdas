import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
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
  ApiHeader,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { ShopeeWebhookService } from '../services/shopee-webhook.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

@ApiTags('Shopee Webhooks')
@Controller('webhooks/shopee')
export class ShopeeWebhookController {
  private readonly logger = new Logger(ShopeeWebhookController.name);

  constructor(
    private readonly webhookService: ShopeeWebhookService,
    private readonly logService: IntegrationLogService,
  ) {}

  @Post(':tenantId/:channelId/:webhookType')
  @ApiOperation({ summary: 'Handle Shopee webhook events' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({
    name: 'webhookType',
    description: 'Webhook type (e.g., order_status_update)',
  })
  @ApiHeader({ name: 'authorization', description: 'Shopee webhook signature' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleShopeeWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Param('webhookType') webhookType: string,
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

      this.logger.debug(`Shopee webhook received: ${webhookType}`, {
        tenantId,
        channelId,
        webhookType,
        ipAddress,
        userAgent,
        requestId,
      });

      // Log incoming webhook
      await this.logService.logWebhook(
        tenantId,
        channelId,
        `shopee_webhook_${webhookType}`,
        'received',
        `Shopee webhook ${webhookType} received`,
        {
          requestId,
          ipAddress,
          userAgent,
          headers: this.sanitizeHeaders(headers),
          payloadSize: rawPayload.length,
        },
      );

      // Process webhook
      const result = await this.webhookService.processShopeeWebhook(
        tenantId,
        channelId,
        webhookType,
        rawPayload,
        headers,
        ipAddress,
        userAgent,
      );

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(
          `Shopee webhook processed successfully: ${webhookType}`,
          {
            tenantId,
            channelId,
            webhookType,
            webhookId: result.webhookId,
            processingTime,
            requestId,
          },
        );

        // Return success response
        res.status(HttpStatus.OK).json({
          success: true,
          message: 'Webhook processed successfully',
          requestId,
          processingTime,
        });
      } else {
        this.logger.warn(`Shopee webhook processing failed: ${result.error}`, {
          tenantId,
          channelId,
          webhookType,
          error: result.error,
          processingTime,
          requestId,
        });

        // Return error response
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error,
          requestId,
          processingTime,
        });
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Shopee webhook error: ${error.message}`, {
        tenantId,
        channelId,
        webhookType,
        error: error.message,
        stack: error.stack,
        processingTime,
        requestId,
      });

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        `shopee_webhook_${webhookType}`,
        'failed',
        `Shopee webhook processing error: ${error.message}`,
        {
          requestId,
          error: error.message,
          stack: error.stack,
          processingTime,
        },
      );

      // Return error response
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId,
        processingTime,
      });
    }
  }

  @Post(':tenantId/:channelId/order-status')
  @ApiOperation({ summary: 'Handle Shopee order status webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'authorization', description: 'Shopee webhook signature' })
  @ApiResponse({ status: 200, description: 'Order status webhook processed' })
  async handleOrderStatusWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleShopeeWebhook(
      tenantId,
      channelId,
      'order_status_update',
      body,
      headers,
      req,
      res,
    );
  }

  @Post(':tenantId/:channelId/order-tracking')
  @ApiOperation({ summary: 'Handle Shopee order tracking webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'authorization', description: 'Shopee webhook signature' })
  @ApiResponse({ status: 200, description: 'Order tracking webhook processed' })
  async handleOrderTrackingWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleShopeeWebhook(
      tenantId,
      channelId,
      'order_trackingno_update',
      body,
      headers,
      req,
      res,
    );
  }

  @Post(':tenantId/:channelId/item-banned')
  @ApiOperation({ summary: 'Handle Shopee item banned webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'authorization', description: 'Shopee webhook signature' })
  @ApiResponse({ status: 200, description: 'Item banned webhook processed' })
  async handleItemBannedWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleShopeeWebhook(
      tenantId,
      channelId,
      'banned_item',
      body,
      headers,
      req,
      res,
    );
  }

  @Post(':tenantId/:channelId/item-promotion')
  @ApiOperation({ summary: 'Handle Shopee item promotion webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'authorization', description: 'Shopee webhook signature' })
  @ApiResponse({ status: 200, description: 'Item promotion webhook processed' })
  async handleItemPromotionWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleShopeeWebhook(
      tenantId,
      channelId,
      'item_promotion_update',
      body,
      headers,
      req,
      res,
    );
  }

  @Post(':tenantId/:channelId/stock-change')
  @ApiOperation({ summary: 'Handle Shopee stock change webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'authorization', description: 'Shopee webhook signature' })
  @ApiResponse({ status: 200, description: 'Stock change webhook processed' })
  async handleStockChangeWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleShopeeWebhook(
      tenantId,
      channelId,
      'reserved_stock_change',
      body,
      headers,
      req,
      res,
    );
  }

  // Health check endpoint for Shopee webhook validation
  @Post(':tenantId/:channelId/health')
  @ApiOperation({ summary: 'Webhook health check endpoint' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is healthy' })
  async healthCheck(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const requestId = this.generateRequestId();

    try {
      this.logger.log(`Shopee webhook health check`, {
        tenantId,
        channelId,
        requestId,
        ipAddress: this.getClientIpAddress(req),
      });

      // Log health check
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'shopee_webhook_health',
        'received',
        'Shopee webhook health check',
        {
          requestId,
          ipAddress: this.getClientIpAddress(req),
          userAgent: headers['user-agent'],
        },
      );

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Shopee webhook endpoint is healthy',
        timestamp: new Date().toISOString(),
        requestId,
      });
    } catch (error) {
      this.logger.error(`Shopee webhook health check error: ${error.message}`, {
        tenantId,
        channelId,
        requestId,
        error: error.message,
      });

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Health check failed',
        requestId,
      });
    }
  }

  // Private helper methods

  private generateRequestId(): string {
    return `shopee_webhook_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
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

  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const sanitized = { ...headers };

    // Remove sensitive headers for logging
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'cookie',
      'set-cookie',
      'x-shopee-signature',
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
}
