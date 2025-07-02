import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  HttpStatus,
  HttpCode,
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

import { LazadaWebhookService } from '../services/lazada-webhook.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

@ApiTags('Lazada Webhooks')
@Controller('webhooks/lazada')
export class LazadaWebhookController {
  private readonly logger = new Logger(LazadaWebhookController.name);

  constructor(
    private readonly webhookService: LazadaWebhookService,
    private readonly logService: IntegrationLogService,
  ) {}

  @Post(':tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada webhook notifications' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiHeader({ name: 'x-lazada-hmac-sha256', description: 'Alternative webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleLazadaWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
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

      this.logger.debug(`Lazada webhook received`, {
        tenantId,
        channelId,
        ipAddress,
        userAgent,
        requestId,
        payloadSize: rawPayload.length,
      });

      // Log incoming webhook
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'lazada_webhook',
        'received',
        'Lazada webhook received',
        {
          requestId,
          ipAddress,
          userAgent,
          headers: this.sanitizeHeaders(headers),
          payloadSize: rawPayload.length,
        },
      );

      // Process webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'generic',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(`Lazada webhook processed successfully`, {
          tenantId,
          channelId,
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
        this.logger.warn(`Lazada webhook processing failed: ${result.error}`, {
          tenantId,
          channelId,
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
      
      this.logger.error(`Lazada webhook error: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
        stack: error.stack,
        processingTime,
        requestId,
      });

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'lazada_webhook',
        'failed',
        `Lazada webhook processing error: ${error.message}`,
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

  @Post('order-status/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada order status webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Order status webhook processed successfully' })
  async handleOrderStatusWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);

      this.logger.debug(`Lazada order status webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process order status webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'order_status',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Order status webhook processed' : result.error,
        requestId,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Order status webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('order-tracking/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada order tracking webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Order tracking webhook processed successfully' })
  async handleOrderTrackingWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);

      this.logger.debug(`Lazada order tracking webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process order tracking webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'order_tracking',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Order tracking webhook processed' : result.error,
        requestId,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Order tracking webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('product-updated/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada product update webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Product update webhook processed successfully' })
  async handleProductUpdateWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);

      this.logger.debug(`Lazada product update webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process product update webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'product_updated',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Product update webhook processed' : result.error,
        requestId,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Product update webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('inventory-updated/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada inventory update webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Inventory update webhook processed successfully' })
  async handleInventoryUpdateWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);

      this.logger.debug(`Lazada inventory update webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process inventory update webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'inventory_updated',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Inventory update webhook processed' : result.error,
        requestId,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Inventory update webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('price-updated/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada price update webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Price update webhook processed successfully' })
  async handlePriceUpdateWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);

      this.logger.debug(`Lazada price update webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process price update webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'price_updated',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Price update webhook processed' : result.error,
        requestId,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Price update webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('system-notification/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Lazada system notification webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-lazada-signature', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'System notification webhook processed successfully' })
  async handleSystemNotificationWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const rawPayload = JSON.stringify(body);
      const ipAddress = this.getClientIpAddress(req);

      this.logger.debug(`Lazada system notification webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process system notification webhook
      const result = await this.webhookService.processLazadaWebhook(
        tenantId,
        channelId,
        'system_notification',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'System notification webhook processed' : result.error,
        requestId,
        processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`System notification webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  // Health check endpoint
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lazada webhook endpoint health check' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is healthy' })
  async healthCheck(@Res() res: Response) {
    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Lazada webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  // Private helper methods

  private generateRequestId(): string {
    return `lazada_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      'x-lazada-signature',
      'x-lazada-hmac-sha256',
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
}