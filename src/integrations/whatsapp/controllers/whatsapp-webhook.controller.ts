import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Query,
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
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { WhatsAppWebhookService } from '../services/whatsapp-webhook.service';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';

@ApiTags('WhatsApp Webhooks')
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly webhookService: WhatsAppWebhookService,
    private readonly apiService: WhatsAppApiService,
    private readonly logService: IntegrationLogService,
  ) {}

  /**
   * Webhook verification endpoint (GET)
   * WhatsApp will call this to verify the webhook URL during setup
   */
  @Get(':tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify WhatsApp webhook URL' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiQuery({ name: 'hub.mode', description: 'Verification mode' })
  @ApiQuery({ name: 'hub.verify_token', description: 'Verification token' })
  @ApiQuery({ name: 'hub.challenge', description: 'Challenge string' })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  @ApiResponse({ status: 403, description: 'Webhook verification failed' })
  async verifyWebhook(
    @Param('tenantId') tenantId: string,
    @Param('channelId') channelId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const ipAddress = this.getClientIpAddress(req);
      const userAgent = req.headers['user-agent'] || '';

      this.logger.debug(`WhatsApp webhook verification request`, {
        tenantId,
        channelId,
        mode,
        token: '[REDACTED]',
        ipAddress,
        userAgent,
        requestId,
      });

      // Log incoming verification request
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'whatsapp_verification',
        'received',
        'WhatsApp webhook verification request received',
        {
          requestId,
          mode,
          ipAddress,
          userAgent,
          headers: this.sanitizeHeaders(req.headers as Record<string, string>),
        },
      );

      // Get the expected verify token from channel configuration
      // This should match the verifyToken stored during setup
      const expectedToken = await this.getVerifyToken(tenantId, channelId);

      if (!expectedToken) {
        this.logger.warn(`No verify token found for channel`, {
          tenantId,
          channelId,
          requestId,
        });

        res.status(HttpStatus.FORBIDDEN).send('Webhook verification failed: No verify token configured');
        return;
      }

      // Verify the webhook challenge
      const challengeResult = this.apiService.verifyWebhookChallenge(mode, token, challenge, expectedToken);

      const processingTime = Date.now() - startTime;

      if (challengeResult) {
        this.logger.log(`WhatsApp webhook verification successful`, {
          tenantId,
          channelId,
          requestId,
          processingTime,
        });

        // Log successful verification
        await this.logService.logWebhook(
          tenantId,
          channelId,
          'whatsapp_verification',
          'processed',
          'WhatsApp webhook verification successful',
          {
            requestId,
            processingTime,
            challenge: '[REDACTED]',
          },
        );

        res.status(HttpStatus.OK).send(challengeResult);
      } else {
        this.logger.warn(`WhatsApp webhook verification failed`, {
          tenantId,
          channelId,
          mode,
          token: '[REDACTED]',
          expectedToken: '[REDACTED]',
          requestId,
          processingTime,
        });

        // Log failed verification
        await this.logService.logWebhook(
          tenantId,
          channelId,
          'whatsapp_verification',
          'failed',
          'WhatsApp webhook verification failed: Invalid token or mode',
          {
            requestId,
            mode,
            processingTime,
          },
        );

        res.status(HttpStatus.FORBIDDEN).send('Webhook verification failed');
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`WhatsApp webhook verification error: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
        stack: error.stack,
        requestId,
        processingTime,
      });

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'whatsapp_verification',
        'failed',
        `WhatsApp webhook verification error: ${error.message}`,
        {
          requestId,
          error: error.message,
          stack: error.stack,
          processingTime,
        },
      );

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal server error');
    }
  }

  /**
   * Main webhook endpoint (POST)
   * WhatsApp will send events to this endpoint
   */
  @Post(':tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive WhatsApp webhook events' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook data' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleWhatsAppWebhook(
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

      this.logger.debug(`WhatsApp webhook received`, {
        tenantId,
        channelId,
        ipAddress,
        userAgent,
        requestId,
        payloadSize: rawPayload.length,
        webhookObject: body.object,
        entryCount: body.entry?.length || 0,
      });

      // Log incoming webhook
      await this.logService.logWebhook(
        tenantId,
        channelId,
        'whatsapp_webhook',
        'received',
        'WhatsApp webhook received',
        {
          requestId,
          ipAddress,
          userAgent,
          headers: this.sanitizeHeaders(headers),
          payloadSize: rawPayload.length,
          webhookObject: body.object,
          entryCount: body.entry?.length || 0,
        },
      );

      // Process webhook
      const result = await this.webhookService.processWhatsAppWebhook(
        tenantId,
        channelId,
        'webhook',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.log(`WhatsApp webhook processed successfully`, {
          tenantId,
          channelId,
          webhookId: result.webhookId,
          processedCount: result.processed,
          processingTime,
          requestId,
        });

        res.status(HttpStatus.OK).json({
          success: true,
          message: 'Webhook processed successfully',
          requestId,
          processingTime,
          processed: result.processed,
          webhookId: result.webhookId,
        });
      } else {
        this.logger.warn(`WhatsApp webhook processing failed`, {
          tenantId,
          channelId,
          errors: result.errors,
          processedCount: result.processed,
          processingTime,
          requestId,
        });

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          errors: result.errors,
          requestId,
          processingTime,
          processed: result.processed,
          webhookId: result.webhookId,
        });
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`WhatsApp webhook error: ${error.message}`, {
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
        'whatsapp_webhook',
        'failed',
        `WhatsApp webhook processing error: ${error.message}`,
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

  /**
   * Webhook endpoint for incoming messages
   */
  @Post('messages/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive WhatsApp message webhooks' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Message webhook processed successfully' })
  async handleMessageWebhook(
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

      this.logger.debug(`WhatsApp message webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process message webhook specifically
      const result = await this.webhookService.processWhatsAppWebhook(
        tenantId,
        channelId,
        'messages',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Message webhook processed' : 'Message webhook processing failed',
        requestId,
        processingTime,
        processed: result.processed,
        errors: result.errors,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Message webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId,
        processingTime,
      });
    }
  }

  /**
   * Webhook endpoint for message status updates
   */
  @Post('status/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive WhatsApp message status webhooks' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Status webhook processed successfully' })
  async handleStatusWebhook(
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

      this.logger.debug(`WhatsApp status webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process status webhook specifically
      const result = await this.webhookService.processWhatsAppWebhook(
        tenantId,
        channelId,
        'status',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Status webhook processed' : 'Status webhook processing failed',
        requestId,
        processingTime,
        processed: result.processed,
        errors: result.errors,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Status webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId,
        processingTime,
      });
    }
  }

  /**
   * Webhook endpoint for template status updates
   */
  @Post('templates/:tenantId/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive WhatsApp template status webhooks' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'Webhook signature', required: false })
  @ApiResponse({ status: 200, description: 'Template webhook processed successfully' })
  async handleTemplateWebhook(
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

      this.logger.debug(`WhatsApp template webhook received`, {
        tenantId,
        channelId,
        requestId,
        ipAddress,
      });

      // Process template webhook specifically
      const result = await this.webhookService.processWhatsAppWebhook(
        tenantId,
        channelId,
        'template',
        rawPayload,
        headers,
      );

      const processingTime = Date.now() - startTime;

      res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success ? 'Template webhook processed' : 'Template webhook processing failed',
        requestId,
        processingTime,
        processed: result.processed,
        errors: result.errors,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Template webhook error: ${error.message}`, error.stack);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        requestId,
        processingTime,
      });
    }
  }

  // Health check endpoint
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp webhook endpoint health check' })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is healthy' })
  async healthCheck(@Res() res: Response) {
    res.status(HttpStatus.OK).json({
      success: true,
      message: 'WhatsApp webhook endpoint is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'whatsapp-webhook',
    });
  }

  // Private helper methods

  private generateRequestId(): string {
    return `whatsapp_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      'x-hub-signature-256',
      'x-api-key',
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

  /**
   * Get verify token from channel configuration
   */
  private async getVerifyToken(tenantId: string, channelId: string): Promise<string | null> {
    try {
      // This should fetch the verify token from the channel configuration
      // Implementation would involve calling the auth service or directly querying the database
      // For now, we'll return a placeholder
      
      // TODO: Implement actual token retrieval
      // const credentials = await this.authService.getCredentials(tenantId, channelId);
      // return credentials?.verifyToken || null;
      
      // Temporary implementation - in production this should come from database
      return 'your_verify_token_here';
      
    } catch (error) {
      this.logger.error(`Failed to get verify token: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });
      return null;
    }
  }
}