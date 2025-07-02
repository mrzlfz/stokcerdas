import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { WhatsAppApiService } from './whatsapp-api.service';
import { WhatsAppAuthService } from './whatsapp-auth.service';
import { WebhookEvent } from '../../entities/webhook-event.entity';

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: 'messages' | 'message_template_status_update' | 'account_alerts' | 'account_update' | 'phone_number_name_update' | 'phone_number_quality_update' | 'template_category_update';
}

export interface WhatsAppWebhookValue {
  messaging_product: 'whatsapp';
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppMessageStatus[];
  errors?: WhatsAppWebhookError[];
  // Template status updates
  message_template_id?: string;
  message_template_name?: string;
  message_template_language?: string;
  event_type?: string;
  reason?: string;
  // Account updates
  account_update_type?: string;
  ban_info?: any;
  restrictions_info?: any;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppIncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'button' | 'order' | 'system';
  context?: {
    from: string;
    id: string;
    referred_product?: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
  text?: {
    body: string;
  };
  image?: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  audio?: {
    mime_type: string;
    sha256: string;
    id: string;
    voice?: boolean;
  };
  video?: {
    caption?: string;
    filename?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  document?: {
    caption?: string;
    filename?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
  sticker?: {
    mime_type: string;
    sha256: string;
    id: string;
    animated?: boolean;
  };
  location?: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  };
  contacts?: any[];
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    payload?: string;
    text: string;
  };
  order?: {
    catalog_id: string;
    product_items: Array<{
      product_retailer_id: string;
      quantity: number;
      item_price: number;
      currency: string;
    }>;
  };
  system?: {
    body: string;
    type: string;
    new_wa_id?: string;
    wa_id?: string;
    customer?: string;
  };
  errors?: WhatsAppWebhookError[];
}

export interface WhatsAppMessageStatus {
  id: string;
  recipient_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin: {
      type: 'marketing' | 'utility' | 'authentication' | 'service';
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: 'CBP' | 'NBP';
    category: 'marketing' | 'utility' | 'authentication' | 'service';
  };
  errors?: WhatsAppWebhookError[];
}

export interface WhatsAppWebhookError {
  code: number;
  title: string;
  message: string;
  error_data: {
    details: string;
  };
}

export interface ProcessedWebhookResult {
  success: boolean;
  processed: number;
  errors: string[];
  webhookId?: string;
}

export interface MessageHandlerOptions {
  autoReply?: boolean;
  markAsRead?: boolean;
  forwardToAgent?: boolean;
  storeMessage?: boolean;
}

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    @InjectQueue('whatsapp')
    private readonly whatsappQueue: Queue,
    private readonly apiService: WhatsAppApiService,
    private readonly authService: WhatsAppAuthService,
    private readonly logService: IntegrationLogService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Process WhatsApp webhook payload
   */
  async processWhatsAppWebhook(
    tenantId: string,
    channelId: string,
    webhookType: string,
    payload: string,
    headers: Record<string, string>,
  ): Promise<ProcessedWebhookResult> {
    const startTime = Date.now();
    let webhookId: string;

    try {
      this.logger.debug(`Processing WhatsApp webhook: ${webhookType}`, {
        tenantId,
        channelId,
        webhookType,
        payloadSize: payload.length,
      });

      // Parse webhook payload
      const webhookData: WhatsAppWebhookPayload = JSON.parse(payload);

      // Verify webhook signature
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        throw new Error('No WhatsApp credentials found for signature verification');
      }

      const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
      if (signature) {
        const isValid = this.apiService.verifyWebhookSignature(payload, signature, credentials.appSecret);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Store webhook event
      const webhookEvent = await this.webhookEventRepository.save({
        tenantId,
        channelId,
        platform: 'whatsapp',
        eventType: webhookType,
        eventSource: webhookData.object,
        payload: webhookData,
        headers,
        status: 'processing',
        receivedAt: new Date(),
      });

      webhookId = webhookEvent.id;

      let processedCount = 0;
      const errors: string[] = [];

      // Process each entry in the webhook
      for (const entry of webhookData.entry) {
        try {
          for (const change of entry.changes) {
            await this.processWebhookChange(
              tenantId,
              channelId,
              webhookId,
              entry.id,
              change,
            );
            processedCount++;
          }
        } catch (error) {
          this.logger.error(`Failed to process webhook entry ${entry.id}: ${error.message}`, error.stack);
          errors.push(`Entry ${entry.id}: ${error.message}`);
        }
      }

      // Update webhook status
      await this.webhookEventRepository.update(webhookId, {
        status: errors.length === 0 ? 'processed' : 'partial',
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        metadata: {
          processedCount,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });

      // Log webhook processing completion
      await this.logService.logWebhook(
        tenantId,
        channelId,
        webhookType,
        errors.length === 0 ? 'processed' : 'partial',
        `WhatsApp webhook processed: ${processedCount} changes, ${errors.length} errors`,
        {
          webhookId,
          processedCount,
          errorCount: errors.length,
          processingTime: Date.now() - startTime,
        },
      );

      return {
        success: errors.length === 0,
        processed: processedCount,
        errors,
        webhookId,
      };

    } catch (error) {
      this.logger.error(`WhatsApp webhook processing failed: ${error.message}`, {
        tenantId,
        channelId,
        webhookType,
        error: error.message,
        stack: error.stack,
      });

      // Update webhook status if we have an ID
      if (webhookId) {
        await this.webhookEventRepository.update(webhookId, {
          status: 'failed',
          processedAt: new Date(),
          processingTime: Date.now() - startTime,
          metadata: {
            error: error.message,
            stack: error.stack,
          },
        });
      }

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        webhookType,
        'failed',
        `WhatsApp webhook processing failed: ${error.message}`,
        {
          webhookId,
          error: error.message,
          processingTime: Date.now() - startTime,
        },
      );

      return {
        success: false,
        processed: 0,
        errors: [error.message],
        webhookId,
      };
    }
  }

  /**
   * Process individual webhook change
   */
  private async processWebhookChange(
    tenantId: string,
    channelId: string,
    webhookId: string,
    entryId: string,
    change: WhatsAppWebhookChange,
  ): Promise<void> {
    const value = change.value;

    switch (change.field) {
      case 'messages':
        await this.processMessagesChange(tenantId, channelId, webhookId, value);
        break;

      case 'message_template_status_update':
        await this.processTemplateStatusUpdate(tenantId, channelId, webhookId, value);
        break;

      case 'account_alerts':
        await this.processAccountAlerts(tenantId, channelId, webhookId, value);
        break;

      case 'account_update':
        await this.processAccountUpdate(tenantId, channelId, webhookId, value);
        break;

      case 'phone_number_name_update':
      case 'phone_number_quality_update':
        await this.processPhoneNumberUpdate(tenantId, channelId, webhookId, change.field, value);
        break;

      case 'template_category_update':
        await this.processTemplateCategoryUpdate(tenantId, channelId, webhookId, value);
        break;

      default:
        this.logger.warn(`Unknown webhook field: ${change.field}`, {
          tenantId,
          channelId,
          webhookId,
          field: change.field,
        });
    }
  }

  /**
   * Process messages webhook change
   */
  private async processMessagesChange(
    tenantId: string,
    channelId: string,
    webhookId: string,
    value: WhatsAppWebhookValue,
  ): Promise<void> {
    // Process incoming messages
    if (value.messages) {
      for (const message of value.messages) {
        await this.processIncomingMessage(tenantId, channelId, webhookId, message, value.contacts);
      }
    }

    // Process message statuses
    if (value.statuses) {
      for (const status of value.statuses) {
        await this.processMessageStatus(tenantId, channelId, webhookId, status);
      }
    }

    // Process errors
    if (value.errors) {
      for (const error of value.errors) {
        await this.processWebhookError(tenantId, channelId, webhookId, error);
      }
    }
  }

  /**
   * Process incoming message
   */
  private async processIncomingMessage(
    tenantId: string,
    channelId: string,
    webhookId: string,
    message: WhatsAppIncomingMessage,
    contacts?: WhatsAppContact[],
  ): Promise<void> {
    try {
      this.logger.debug(`Processing incoming WhatsApp message: ${message.type}`, {
        tenantId,
        channelId,
        messageId: message.id,
        from: message.from,
        type: message.type,
      });

      // Find contact info
      const contact = contacts?.find(c => c.wa_id === message.from);

      // Mark message as read (optional, based on configuration)
      const options: MessageHandlerOptions = {
        markAsRead: true,
        storeMessage: true,
      };

      if (options.markAsRead) {
        // Queue mark as read operation
        await this.whatsappQueue.add('mark-as-read', {
          tenantId,
          channelId,
          messageId: message.id,
        }, {
          delay: 1000, // Small delay to avoid rate limits
        });
      }

      // Store message in database (if enabled)
      if (options.storeMessage) {
        // TODO: Implement message storage in database
        // This could involve creating a messages table
      }

      // Emit event for incoming message
      this.eventEmitter.emit('whatsapp.message.received', {
        tenantId,
        channelId,
        webhookId,
        message,
        contact,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
      });

      // Handle specific message types
      switch (message.type) {
        case 'text':
          await this.handleTextMessage(tenantId, channelId, message, contact);
          break;

        case 'interactive':
          await this.handleInteractiveMessage(tenantId, channelId, message, contact);
          break;

        case 'button':
          await this.handleButtonMessage(tenantId, channelId, message, contact);
          break;

        case 'order':
          await this.handleOrderMessage(tenantId, channelId, message, contact);
          break;

        case 'image':
        case 'audio':
        case 'video':
        case 'document':
        case 'sticker':
          await this.handleMediaMessage(tenantId, channelId, message, contact);
          break;

        case 'location':
          await this.handleLocationMessage(tenantId, channelId, message, contact);
          break;

        case 'contacts':
          await this.handleContactsMessage(tenantId, channelId, message, contact);
          break;

        case 'system':
          await this.handleSystemMessage(tenantId, channelId, message, contact);
          break;

        default:
          this.logger.warn(`Unhandled message type: ${message.type}`, {
            tenantId,
            channelId,
            messageId: message.id,
            type: message.type,
          });
      }

      // Log message processing
      await this.logService.log({
        tenantId,
        channelId,
        type: 'WEBHOOK',
        level: 'INFO',
        message: 'WhatsApp incoming message processed',
        metadata: {
          webhookId,
          messageId: message.id,
          messageType: message.type,
          from: message.from,
          contactName: contact?.profile?.name,
        },
      });

    } catch (error) {
      this.logger.error(`Failed to process incoming message: ${error.message}`, {
        tenantId,
        channelId,
        messageId: message.id,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Process message status update
   */
  private async processMessageStatus(
    tenantId: string,
    channelId: string,
    webhookId: string,
    status: WhatsAppMessageStatus,
  ): Promise<void> {
    try {
      this.logger.debug(`Processing message status: ${status.status}`, {
        tenantId,
        channelId,
        messageId: status.id,
        status: status.status,
        recipientId: status.recipient_id,
      });

      // Emit event for message status
      this.eventEmitter.emit('whatsapp.message.status', {
        tenantId,
        channelId,
        webhookId,
        messageId: status.id,
        recipientId: status.recipient_id,
        status: status.status,
        timestamp: new Date(parseInt(status.timestamp) * 1000),
        conversation: status.conversation,
        pricing: status.pricing,
      });

      // Log status update
      await this.logService.log({
        tenantId,
        channelId,
        type: 'WEBHOOK',
        level: 'INFO',
        message: `WhatsApp message status updated: ${status.status}`,
        metadata: {
          webhookId,
          messageId: status.id,
          status: status.status,
          recipientId: status.recipient_id,
          conversation: status.conversation,
          pricing: status.pricing,
        },
      });

    } catch (error) {
      this.logger.error(`Failed to process message status: ${error.message}`, {
        tenantId,
        channelId,
        messageId: status.id,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Process template status update
   */
  private async processTemplateStatusUpdate(
    tenantId: string,
    channelId: string,
    webhookId: string,
    value: WhatsAppWebhookValue,
  ): Promise<void> {
    try {
      this.logger.debug(`Processing template status update`, {
        tenantId,
        channelId,
        templateId: value.message_template_id,
        templateName: value.message_template_name,
        eventType: value.event_type,
      });

      // Emit event for template status update
      this.eventEmitter.emit('whatsapp.template.status', {
        tenantId,
        channelId,
        webhookId,
        templateId: value.message_template_id,
        templateName: value.message_template_name,
        templateLanguage: value.message_template_language,
        eventType: value.event_type,
        reason: value.reason,
      });

      // Log template status update
      await this.logService.log({
        tenantId,
        channelId,
        type: 'WEBHOOK',
        level: 'INFO',
        message: `WhatsApp template status updated: ${value.event_type}`,
        metadata: {
          webhookId,
          templateId: value.message_template_id,
          templateName: value.message_template_name,
          eventType: value.event_type,
          reason: value.reason,
        },
      });

    } catch (error) {
      this.logger.error(`Failed to process template status update: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process account alerts
   */
  private async processAccountAlerts(
    tenantId: string,
    channelId: string,
    webhookId: string,
    value: WhatsAppWebhookValue,
  ): Promise<void> {
    // Implementation for account alerts
    this.logger.warn('Account alerts processing not implemented yet', {
      tenantId,
      channelId,
      webhookId,
    });
  }

  /**
   * Process account updates
   */
  private async processAccountUpdate(
    tenantId: string,
    channelId: string,
    webhookId: string,
    value: WhatsAppWebhookValue,
  ): Promise<void> {
    // Implementation for account updates
    this.logger.warn('Account update processing not implemented yet', {
      tenantId,
      channelId,
      webhookId,
    });
  }

  /**
   * Process phone number updates
   */
  private async processPhoneNumberUpdate(
    tenantId: string,
    channelId: string,
    webhookId: string,
    updateType: string,
    value: WhatsAppWebhookValue,
  ): Promise<void> {
    // Implementation for phone number updates
    this.logger.warn(`Phone number update processing not implemented yet: ${updateType}`, {
      tenantId,
      channelId,
      webhookId,
    });
  }

  /**
   * Process template category updates
   */
  private async processTemplateCategoryUpdate(
    tenantId: string,
    channelId: string,
    webhookId: string,
    value: WhatsAppWebhookValue,
  ): Promise<void> {
    // Implementation for template category updates
    this.logger.warn('Template category update processing not implemented yet', {
      tenantId,
      channelId,
      webhookId,
    });
  }

  /**
   * Process webhook errors
   */
  private async processWebhookError(
    tenantId: string,
    channelId: string,
    webhookId: string,
    error: WhatsAppWebhookError,
  ): Promise<void> {
    this.logger.error(`WhatsApp webhook error: ${error.title}`, {
      tenantId,
      channelId,
      webhookId,
      code: error.code,
      title: error.title,
      message: error.message,
      details: error.error_data?.details,
    });

    // Log webhook error
    await this.logService.logError(tenantId, channelId, new Error(error.message), {
      context: 'webhook_error',
      webhookId,
      errorCode: error.code,
      errorTitle: error.title,
      errorDetails: error.error_data?.details,
    });
  }

  // Message type handlers

  private async handleTextMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle text message - could integrate with chatbot, customer service, etc.
    this.eventEmitter.emit('whatsapp.text.received', {
      tenantId,
      channelId,
      message,
      contact,
      text: message.text?.body,
    });
  }

  private async handleInteractiveMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle interactive message response
    this.eventEmitter.emit('whatsapp.interactive.received', {
      tenantId,
      channelId,
      message,
      contact,
      interactive: message.interactive,
    });
  }

  private async handleButtonMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle button press
    this.eventEmitter.emit('whatsapp.button.received', {
      tenantId,
      channelId,
      message,
      contact,
      button: message.button,
    });
  }

  private async handleOrderMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle order placement
    this.eventEmitter.emit('whatsapp.order.received', {
      tenantId,
      channelId,
      message,
      contact,
      order: message.order,
    });
  }

  private async handleMediaMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle media message - could download and store media
    this.eventEmitter.emit('whatsapp.media.received', {
      tenantId,
      channelId,
      message,
      contact,
      mediaType: message.type,
      mediaId: message.image?.id || message.audio?.id || message.video?.id || message.document?.id || message.sticker?.id,
    });
  }

  private async handleLocationMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle location sharing
    this.eventEmitter.emit('whatsapp.location.received', {
      tenantId,
      channelId,
      message,
      contact,
      location: message.location,
    });
  }

  private async handleContactsMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle contact sharing
    this.eventEmitter.emit('whatsapp.contacts.received', {
      tenantId,
      channelId,
      message,
      contact,
      contacts: message.contacts,
    });
  }

  private async handleSystemMessage(
    tenantId: string,
    channelId: string,
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact,
  ): Promise<void> {
    // Handle system messages (user changes, etc.)
    this.eventEmitter.emit('whatsapp.system.received', {
      tenantId,
      channelId,
      message,
      contact,
      system: message.system,
    });
  }
}