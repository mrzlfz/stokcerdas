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

import { TokopediaWebhookService } from '../services/tokopedia-webhook.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

@ApiTags('Tokopedia Webhooks')
@Controller('webhooks/tokopedia')
export class TokopediaWebhookController {
  private readonly logger = new Logger(TokopediaWebhookController.name);

  constructor(
    private readonly webhookService: TokopediaWebhookService,
    private readonly logService: IntegrationLogService,
  ) {}

  @Post(':tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Tokopedia webhook notifications' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiHeader({
    name: 'x-signature',
    description: 'Alternative webhook signature',
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleTokopediaWebhook(
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

      this.logger.debug(`Tokopedia webhook received`, {
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
        'tokopedia_webhook',
        'received',
        'Tokopedia webhook received',
        {
          requestId,
          ipAddress,
          userAgent,
          headers: this.sanitizeHeaders(headers),
          payloadSize: rawPayload.length,
        },
      );

      // Process webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'generic',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(`Tokopedia webhook processed successfully`, {
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
        this.logger.warn(
          `Tokopedia webhook processing failed: ${result.error}`,
          {
            tenantId,
            channelId,
            error: result.error,
            processingTime,
            requestId,
          },
        );

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: result.error,
          requestId,
          processingTime,
        });
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Tokopedia webhook error: ${error.message}`, {
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
        'tokopedia_webhook',
        'failed',
        `Tokopedia webhook processing error: ${error.message}`,
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

  @Post('order-created/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Tokopedia order created webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Order created webhook processed successfully',
  })
  async handleOrderCreatedWebhook(
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

      this.logger.debug(`Tokopedia order created webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process order created webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'order_created',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Order created webhook processed'
          : result.error,
        requestId,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Order created webhook error: ${error.message}`,
        error.stack,
      );

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('order-updated/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Tokopedia order updated webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Order updated webhook processed successfully',
  })
  async handleOrderUpdatedWebhook(
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

      this.logger.debug(`Tokopedia order updated webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process order updated webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'order_updated',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Order updated webhook processed'
          : result.error,
        requestId,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Order updated webhook error: ${error.message}`,
        error.stack,
      );

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
  @ApiOperation({ summary: 'Receive Tokopedia product updated webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Product updated webhook processed successfully',
  })
  async handleProductUpdatedWebhook(
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

      this.logger.debug(`Tokopedia product updated webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process product updated webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'product_updated',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Product updated webhook processed'
          : result.error,
        requestId,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Product updated webhook error: ${error.message}`,
        error.stack,
      );

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
  @ApiOperation({ summary: 'Receive Tokopedia inventory updated webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory updated webhook processed successfully',
  })
  async handleInventoryUpdatedWebhook(
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

      this.logger.debug(`Tokopedia inventory updated webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process inventory updated webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'inventory_updated',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Inventory updated webhook processed'
          : result.error,
        requestId,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Inventory updated webhook error: ${error.message}`,
        error.stack,
      );

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId: this.generateRequestId(),
        processingTime,
      });
    }
  }

  @Post('payment-confirmed/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Tokopedia payment confirmed webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed webhook processed successfully',
  })
  async handlePaymentConfirmedWebhook(
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

      this.logger.debug(`Tokopedia payment confirmed webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process payment confirmed webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'payment_confirmed',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Payment confirmed webhook processed'
          : result.error,
        requestId,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Payment confirmed webhook error: ${error.message}`,
        error.stack,
      );

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
  @ApiOperation({ summary: 'Receive Tokopedia system notification webhook' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({
    name: 'x-tokopedia-signature',
    description: 'Webhook signature',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'System notification webhook processed successfully',
  })
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

      this.logger.debug(`Tokopedia system notification webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process system notification webhook
      const result = await this.webhookService.processTokopediaWebhook(
        tenantId,
        channelId,
        'system_notification',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'System notification webhook processed'
          : result.error,
        requestId,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `System notification webhook error: ${error.message}`,
        error.stack,
      );

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
  @ApiOperation({ summary: 'Tokopedia webhook endpoint health check' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is healthy' })
  async healthCheck(@Res() res: Response) {
    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Tokopedia webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  // Private helper methods

  private generateRequestId(): string {
    return `tokopedia_webhook_${Date.now()}_${Math.random()
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
      'x-tokopedia-signature',
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
}
