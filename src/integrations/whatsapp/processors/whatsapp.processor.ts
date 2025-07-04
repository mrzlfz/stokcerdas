import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { WhatsAppWebhookService } from '../services/whatsapp-webhook.service';
import { WhatsAppMessageService } from '../services/whatsapp-message.service';
import { WhatsAppTemplateService } from '../services/whatsapp-template.service';
import { WhatsAppAuthService } from '../services/whatsapp-auth.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export interface WhatsAppWebhookJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  eventSource: string;
  payload: any;
  isRetry?: boolean;
}

export interface WhatsAppMessageJobData {
  tenantId: string;
  channelId: string;
  messageType:
    | 'text'
    | 'template'
    | 'interactive'
    | 'media'
    | 'location'
    | 'contact';
  messageData: any;
  priority?: 'high' | 'normal' | 'low';
  scheduleAt?: Date;
}

export interface WhatsAppBulkMessageJobData {
  tenantId: string;
  channelId: string;
  recipients: string[];
  messageData: any;
  messageType: 'text' | 'template' | 'interactive';
  batchSize?: number;
  sendDelay?: number;
  priority?: 'high' | 'normal' | 'low';
}

export interface WhatsAppTemplateJobData {
  tenantId: string;
  channelId: string;
  action: 'create' | 'delete' | 'sync';
  templateData?: any;
  templateId?: string;
  templateName?: string;
}

export interface WhatsAppMediaJobData {
  tenantId: string;
  channelId: string;
  action: 'upload' | 'download';
  mediaId?: string;
  mediaData?: Buffer | string;
  mimeType?: string;
  filename?: string;
}

export interface WhatsAppHealthCheckJobData {
  tenantId: string;
  channelId: string;
  checkType: 'auth' | 'api' | 'webhook';
}

@Processor('whatsapp')
export class WhatsAppProcessor {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly webhookService: WhatsAppWebhookService,
    private readonly messageService: WhatsAppMessageService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly authService: WhatsAppAuthService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing WhatsApp job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`WhatsApp job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `WhatsApp job failed: ${job.name} [${job.id}] - ${err.message}`,
      {
        jobId: job.id,
        jobName: job.name,
        error: err.message,
        stack: err.stack,
        data: job.data,
        attemptsMade: job.attemptsMade,
        attemptsLeft: job.opts.attempts - job.attemptsMade,
      },
    );
  }

  /**
   * Process webhook events
   */
  @Process('process-webhook')
  async processWebhook(job: Job<WhatsAppWebhookJobData>) {
    const {
      webhookId,
      tenantId,
      channelId,
      eventType,
      eventSource,
      payload,
      isRetry,
    } = job.data;

    try {
      this.logger.debug(`Processing WhatsApp webhook: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
        isRetry,
      });

      // Mark webhook as processing
      const webhook = await this.webhookHandler.markWebhookAsProcessing(
        webhookId,
      );

      // Process webhook payload
      const result = await this.webhookService.processWhatsAppWebhook(
        tenantId,
        channelId,
        eventType,
        JSON.stringify(payload),
        {},
      );

      if (result.success) {
        // Mark webhook as processed
        await this.webhookHandler.markWebhookAsProcessed(webhookId, {
          processedAt: new Date(),
          processingResult: result,
        });

        // Log success
        await this.logService.logWebhook(
          tenantId,
          channelId,
          eventType,
          'processed',
          `WhatsApp webhook ${eventType} processed successfully`,
          { webhookId, result },
        );

        return {
          success: true,
          webhookId,
          eventType,
          result,
        };
      } else {
        // Mark webhook as failed
        await this.webhookHandler.markWebhookAsFailed(
          webhookId,
          result.errors?.join(', ') || 'Processing failed',
          true, // Schedule retry
        );

        throw new Error(
          result.errors?.join(', ') || 'Webhook processing failed',
        );
      }
    } catch (error) {
      this.logger.error(
        `Webhook processing failed: ${error.message}`,
        error.stack,
      );

      // Mark webhook as failed
      await this.webhookHandler.markWebhookAsFailed(
        webhookId,
        error.message,
        !isRetry, // Don't retry if this is already a retry
      );

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        eventType,
        'failed',
        `WhatsApp webhook processing failed: ${error.message}`,
        { webhookId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process single message sending
   */
  @Process('send-message')
  async processSendMessage(job: Job<WhatsAppMessageJobData>) {
    const { tenantId, channelId, messageType, messageData, priority } =
      job.data;

    try {
      this.logger.debug(`Processing WhatsApp message send: ${messageType}`, {
        tenantId,
        channelId,
        messageType,
        priority,
      });

      let result;

      switch (messageType) {
        case 'text':
          result = await this.messageService.sendTextMessage(
            tenantId,
            channelId,
            messageData,
          );
          break;

        case 'template':
          result = await this.messageService.sendTemplateMessage(
            tenantId,
            channelId,
            messageData,
          );
          break;

        case 'interactive':
          result = await this.messageService.sendInteractiveMessage(
            tenantId,
            channelId,
            messageData,
          );
          break;

        case 'media':
          result = await this.messageService.sendMediaMessage(
            tenantId,
            channelId,
            messageData,
          );
          break;

        case 'location':
          result = await this.messageService.sendLocationMessage(
            tenantId,
            channelId,
            messageData,
          );
          break;

        case 'contact':
          result = await this.messageService.sendContactMessage(
            tenantId,
            channelId,
            messageData,
          );
          break;

        default:
          throw new Error(`Unsupported message type: ${messageType}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `WhatsApp ${messageType} message sent via queue`,
        metadata: {
          messageType,
          messageId: result.messageId,
          recipient: messageData.to,
          priority,
        },
      });

      // Emit event
      this.eventEmitter.emit('whatsapp.message.queued.completed', {
        tenantId,
        channelId,
        messageType,
        messageId: result.messageId,
        recipient: messageData.to,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(`Message send failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'message_send_queue',
          messageType,
          recipient: messageData.to,
        },
      });

      throw error;
    }
  }

  /**
   * Process bulk message sending
   */
  @Process('send-bulk-messages')
  async processBulkMessages(job: Job<WhatsAppBulkMessageJobData>) {
    const {
      tenantId,
      channelId,
      recipients,
      messageData,
      messageType,
      batchSize = 10,
      sendDelay = 1000,
    } = job.data;

    try {
      this.logger.debug(
        `Processing WhatsApp bulk message send: ${messageType}`,
        {
          tenantId,
          channelId,
          messageType,
          recipientCount: recipients.length,
          batchSize,
        },
      );

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process recipients in batches
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        // Process batch
        for (const recipient of batch) {
          try {
            const individualMessageData = { ...messageData, to: recipient };

            let result;
            switch (messageType) {
              case 'text':
                result = await this.messageService.sendTextMessage(
                  tenantId,
                  channelId,
                  individualMessageData,
                );
                break;
              case 'template':
                result = await this.messageService.sendTemplateMessage(
                  tenantId,
                  channelId,
                  individualMessageData,
                );
                break;
              case 'interactive':
                result = await this.messageService.sendInteractiveMessage(
                  tenantId,
                  channelId,
                  individualMessageData,
                );
                break;
              default:
                throw new Error(
                  `Unsupported bulk message type: ${messageType}`,
                );
            }

            results.push({
              recipient,
              success: true,
              messageId: result.messageId,
            });
            successCount++;

            // Add delay between messages
            if (sendDelay > 0) {
              await new Promise(resolve => setTimeout(resolve, sendDelay));
            }
          } catch (error) {
            this.logger.error(
              `Bulk message failed for recipient ${recipient}: ${error.message}`,
            );
            results.push({ recipient, success: false, error: error.message });
            errorCount++;
          }
        }

        // Small delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const bulkResult = {
        success: errorCount === 0,
        totalMessages: recipients.length,
        successCount,
        errorCount,
        results,
      };

      // Log bulk send completion
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: 'WhatsApp bulk message send completed via queue',
        metadata: {
          messageType,
          totalMessages: recipients.length,
          successCount,
          errorCount,
          successRate: (successCount / recipients.length) * 100,
        },
      });

      // Emit event
      this.eventEmitter.emit('whatsapp.bulk.message.completed', {
        tenantId,
        channelId,
        messageType,
        result: bulkResult,
      });

      return bulkResult;
    } catch (error) {
      this.logger.error(
        `Bulk message send failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'bulk_message_queue',
          messageType,
          recipientCount: recipients.length,
        },
      });

      throw error;
    }
  }

  /**
   * Process template operations
   */
  @Process('template-operation')
  async processTemplateOperation(job: Job<WhatsAppTemplateJobData>) {
    const {
      tenantId,
      channelId,
      action,
      templateData,
      templateId,
      templateName,
    } = job.data;

    try {
      this.logger.debug(`Processing WhatsApp template operation: ${action}`, {
        tenantId,
        channelId,
        action,
        templateId,
        templateName,
      });

      let result;

      switch (action) {
        case 'create':
          result = await this.templateService.createTemplate(
            tenantId,
            channelId,
            templateData,
          );
          break;

        case 'delete':
          result = await this.templateService.deleteTemplate(
            tenantId,
            channelId,
            templateId,
            templateName,
          );
          break;

        case 'sync':
          result = await this.templateService.getTemplates(tenantId, channelId);
          break;

        default:
          throw new Error(`Unsupported template action: ${action}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `WhatsApp template ${action} operation completed via queue`,
        metadata: {
          action,
          templateId,
          templateName,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('whatsapp.template.operation.completed', {
        tenantId,
        channelId,
        action,
        templateId,
        templateName,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Template operation failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'template_operation_queue',
          action,
          templateId,
          templateName,
        },
      });

      throw error;
    }
  }

  /**
   * Process media operations
   */
  @Process('media-operation')
  async processMediaOperation(job: Job<WhatsAppMediaJobData>) {
    const {
      tenantId,
      channelId,
      action,
      mediaId,
      mediaData,
      mimeType,
      filename,
    } = job.data;

    try {
      this.logger.debug(`Processing WhatsApp media operation: ${action}`, {
        tenantId,
        channelId,
        action,
        mediaId,
        mimeType,
        filename,
      });

      let result;

      switch (action) {
        case 'upload':
          // TODO: Implement media upload via API service
          result = {
            success: true,
            message: 'Media upload not implemented yet',
          };
          break;

        case 'download':
          // TODO: Implement media download via API service
          result = {
            success: true,
            message: 'Media download not implemented yet',
          };
          break;

        default:
          throw new Error(`Unsupported media action: ${action}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `WhatsApp media ${action} operation completed via queue`,
        metadata: {
          action,
          mediaId,
          mimeType,
          filename,
          result,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Media operation failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'media_operation_queue',
          action,
          mediaId,
        },
      });

      throw error;
    }
  }

  /**
   * Process mark message as read
   */
  @Process('mark-as-read')
  async processMarkAsRead(
    job: Job<{ tenantId: string; channelId: string; messageId: string }>,
  ) {
    const { tenantId, channelId, messageId } = job.data;

    try {
      this.logger.debug(`Processing WhatsApp mark as read`, {
        tenantId,
        channelId,
        messageId,
      });

      const result = await this.messageService.markMessageAsRead(
        tenantId,
        channelId,
        messageId,
      );

      if (result.success) {
        // Log success
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.SYSTEM,
          level: IntegrationLogLevel.INFO,
          message: 'WhatsApp message marked as read via queue',
          metadata: { messageId },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Mark as read failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'mark_as_read_queue',
          messageId,
        },
      });

      throw error;
    }
  }

  /**
   * Process health check operations
   */
  @Process('health-check')
  async processHealthCheck(job: Job<WhatsAppHealthCheckJobData>) {
    const { tenantId, channelId, checkType } = job.data;

    try {
      this.logger.debug(`Processing WhatsApp health check: ${checkType}`, {
        tenantId,
        channelId,
        checkType,
      });

      let result;

      switch (checkType) {
        case 'auth':
          result = await this.authService.testAuthentication(
            tenantId,
            channelId,
          );
          break;

        case 'api':
          result = await this.authService.getChannelStatus(tenantId, channelId);
          break;

        case 'webhook':
          // TODO: Implement webhook health check
          result = {
            success: true,
            message: 'Webhook health check not implemented yet',
          };
          break;

        default:
          throw new Error(`Unsupported health check type: ${checkType}`);
      }

      // Log health check result
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `WhatsApp health check ${checkType} completed via queue`,
        metadata: { checkType, result },
      });

      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'health_check_queue',
          checkType,
        },
      });

      throw error;
    }
  }

  /**
   * Process scheduled message operations
   */
  @Process('scheduled-message')
  async processScheduledMessage(job: Job<WhatsAppMessageJobData>) {
    const { tenantId, channelId, messageType, messageData, scheduleAt } =
      job.data;

    try {
      this.logger.debug(
        `Processing scheduled WhatsApp message: ${messageType}`,
        {
          tenantId,
          channelId,
          messageType,
          scheduleAt,
        },
      );

      // Check if it's time to send the message
      if (scheduleAt && new Date() < scheduleAt) {
        // Reschedule the job
        const delay = scheduleAt.getTime() - Date.now();
        throw new Error(
          `Message scheduled for later, rescheduling with ${delay}ms delay`,
        );
      }

      // Process the message normally
      const messageJob: WhatsAppMessageJobData = {
        tenantId,
        channelId,
        messageType,
        messageData,
      };

      return await this.processSendMessage({
        data: messageJob,
      } as Job<WhatsAppMessageJobData>);
    } catch (error) {
      this.logger.error(
        `Scheduled message processing failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, channelId, error, {
        metadata: {
          operation: 'scheduled_message_queue',
          messageType,
          scheduleAt,
        },
      });

      throw error;
    }
  }
}
