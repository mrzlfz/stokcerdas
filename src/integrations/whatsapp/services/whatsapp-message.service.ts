import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WhatsAppApiService, WhatsAppConfig, WhatsAppMessage, WhatsAppApiResponse } from './whatsapp-api.service';
import { WhatsAppAuthService } from './whatsapp-auth.service';
import { IntegrationLog } from '../../entities/integration-log.entity';

export interface WhatsAppTextMessage {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    id?: string;
    link?: string;
  };
  document?: {
    id?: string;
    link?: string;
    filename?: string;
  };
  video?: {
    id?: string;
    link?: string;
  };
}

export interface WhatsAppInteractiveMessage {
  to: string;
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    image?: { id?: string; link?: string };
    video?: { id?: string; link?: string };
    document?: { id?: string; link?: string; filename?: string };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: WhatsAppInteractiveAction;
}

export interface WhatsAppInteractiveAction {
  buttons?: Array<{
    type: 'reply';
    reply: {
      id: string;
      title: string;
    };
  }>;
  button?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
  catalog_id?: string;
  product_retailer_id?: string;
}

export interface WhatsAppMediaMessage {
  to: string;
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  media: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
}

export interface WhatsAppLocationMessage {
  to: string;
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppContactMessage {
  to: string;
  contacts: WhatsAppContact[];
}

export interface WhatsAppContact {
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    country_code?: string;
    type?: 'HOME' | 'WORK';
  }>;
  birthday?: string;
  emails?: Array<{
    email?: string;
    type?: 'HOME' | 'WORK';
  }>;
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    prefix?: string;
  };
  org?: {
    company?: string;
    department?: string;
    title?: string;
  };
  phones?: Array<{
    phone?: string;
    wa_id?: string;
    type?: 'HOME' | 'WORK';
  }>;
  urls?: Array<{
    url?: string;
    type?: 'HOME' | 'WORK';
  }>;
}

export interface WhatsAppMessageStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface BulkMessageRequest {
  recipients: string[];
  message: WhatsAppTextMessage | WhatsAppTemplateMessage | WhatsAppInteractiveMessage;
  sendDelay?: number; // Delay between messages in milliseconds
}

export interface BulkMessageResult {
  success: boolean;
  totalMessages: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    recipient: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

@Injectable()
export class WhatsAppMessageService {
  private readonly logger = new Logger(WhatsAppMessageService.name);

  constructor(
    @InjectRepository(IntegrationLog)
    private readonly integrationLogRepository: Repository<IntegrationLog>,
    private readonly apiService: WhatsAppApiService,
    private readonly authService: WhatsAppAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Send text message
   */
  async sendTextMessage(
    tenantId: string,
    channelId: string,
    messageData: WhatsAppTextMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(messageData.to),
        type: 'text',
        text: {
          preview_url: messageData.previewUrl || false,
          body: messageData.text,
        },
      };

      const result = await this.apiService.sendMessage(tenantId, channelId, config, message);

      if (result.success && result.data?.messages?.[0]) {
        const messageId = result.data.messages[0].id;

        // Log successful message
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp text message sent successfully',
          metadata: {
            messageId,
            recipient: messageData.to,
            textLength: messageData.text.length,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.message.sent', {
          tenantId,
          channelId,
          messageId,
          type: 'text',
          recipient: messageData.to,
        });

        return { success: true, messageId };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to send message' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to send text message: ${error.message}`, {
        tenantId,
        channelId,
        recipient: messageData.to,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    tenantId: string,
    channelId: string,
    messageData: WhatsAppTemplateMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(messageData.to),
        type: 'template',
        template: {
          name: messageData.templateName,
          language: {
            code: messageData.languageCode,
          },
          components: messageData.components || [],
        },
      };

      const result = await this.apiService.sendMessage(tenantId, channelId, config, message);

      if (result.success && result.data?.messages?.[0]) {
        const messageId = result.data.messages[0].id;

        // Log successful message
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp template message sent successfully',
          metadata: {
            messageId,
            recipient: messageData.to,
            templateName: messageData.templateName,
            languageCode: messageData.languageCode,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.message.sent', {
          tenantId,
          channelId,
          messageId,
          type: 'template',
          recipient: messageData.to,
          templateName: messageData.templateName,
        });

        return { success: true, messageId };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to send template message' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to send template message: ${error.message}`, {
        tenantId,
        channelId,
        recipient: messageData.to,
        templateName: messageData.templateName,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send interactive message (buttons, lists, etc.)
   */
  async sendInteractiveMessage(
    tenantId: string,
    channelId: string,
    messageData: WhatsAppInteractiveMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(messageData.to),
        type: 'interactive',
        interactive: {
          type: messageData.type,
          header: messageData.header,
          body: messageData.body,
          footer: messageData.footer,
          action: messageData.action,
        },
      };

      const result = await this.apiService.sendMessage(tenantId, channelId, config, message);

      if (result.success && result.data?.messages?.[0]) {
        const messageId = result.data.messages[0].id;

        // Log successful message
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp interactive message sent successfully',
          metadata: {
            messageId,
            recipient: messageData.to,
            interactiveType: messageData.type,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.message.sent', {
          tenantId,
          channelId,
          messageId,
          type: 'interactive',
          recipient: messageData.to,
          interactiveType: messageData.type,
        });

        return { success: true, messageId };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to send interactive message' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to send interactive message: ${error.message}`, {
        tenantId,
        channelId,
        recipient: messageData.to,
        interactiveType: messageData.type,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send media message (image, video, document, audio, sticker)
   */
  async sendMediaMessage(
    tenantId: string,
    channelId: string,
    messageData: WhatsAppMediaMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(messageData.to),
        type: messageData.type,
      };

      // Set media-specific fields
      switch (messageData.type) {
        case 'image':
          message.image = messageData.media;
          break;
        case 'video':
          message.video = messageData.media;
          break;
        case 'audio':
          message.audio = messageData.media;
          break;
        case 'document':
          message.document = messageData.media;
          break;
        case 'sticker':
          message.sticker = messageData.media;
          break;
      }

      const result = await this.apiService.sendMessage(tenantId, channelId, config, message);

      if (result.success && result.data?.messages?.[0]) {
        const messageId = result.data.messages[0].id;

        // Log successful message
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp media message sent successfully',
          metadata: {
            messageId,
            recipient: messageData.to,
            mediaType: messageData.type,
            mediaId: messageData.media.id,
            mediaLink: messageData.media.link,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.message.sent', {
          tenantId,
          channelId,
          messageId,
          type: 'media',
          recipient: messageData.to,
          mediaType: messageData.type,
        });

        return { success: true, messageId };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to send media message' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to send media message: ${error.message}`, {
        tenantId,
        channelId,
        recipient: messageData.to,
        mediaType: messageData.type,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send location message
   */
  async sendLocationMessage(
    tenantId: string,
    channelId: string,
    messageData: WhatsAppLocationMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(messageData.to),
        type: 'location',
        location: {
          longitude: messageData.longitude,
          latitude: messageData.latitude,
          name: messageData.name,
          address: messageData.address,
        },
      };

      const result = await this.apiService.sendMessage(tenantId, channelId, config, message);

      if (result.success && result.data?.messages?.[0]) {
        const messageId = result.data.messages[0].id;

        // Log successful message
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp location message sent successfully',
          metadata: {
            messageId,
            recipient: messageData.to,
            longitude: messageData.longitude,
            latitude: messageData.latitude,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.message.sent', {
          tenantId,
          channelId,
          messageId,
          type: 'location',
          recipient: messageData.to,
        });

        return { success: true, messageId };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to send location message' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to send location message: ${error.message}`, {
        tenantId,
        channelId,
        recipient: messageData.to,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send contact message
   */
  async sendContactMessage(
    tenantId: string,
    channelId: string,
    messageData: WhatsAppContactMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const message: WhatsAppMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(messageData.to),
        type: 'contacts',
        contacts: messageData.contacts,
      };

      const result = await this.apiService.sendMessage(tenantId, channelId, config, message);

      if (result.success && result.data?.messages?.[0]) {
        const messageId = result.data.messages[0].id;

        // Log successful message
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp contact message sent successfully',
          metadata: {
            messageId,
            recipient: messageData.to,
            contactCount: messageData.contacts.length,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.message.sent', {
          tenantId,
          channelId,
          messageId,
          type: 'contacts',
          recipient: messageData.to,
        });

        return { success: true, messageId };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to send contact message' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to send contact message: ${error.message}`, {
        tenantId,
        channelId,
        recipient: messageData.to,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk messages to multiple recipients
   */
  async sendBulkMessages(
    tenantId: string,
    channelId: string,
    bulkRequest: BulkMessageRequest,
  ): Promise<BulkMessageResult> {
    const results: BulkMessageResult['results'] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      this.logger.log(`Starting bulk message send to ${bulkRequest.recipients.length} recipients`, {
        tenantId,
        channelId,
        recipientCount: bulkRequest.recipients.length,
      });

      for (const recipient of bulkRequest.recipients) {
        try {
          let result: { success: boolean; messageId?: string; error?: string };

          // Determine message type and send accordingly
          if ('text' in bulkRequest.message) {
            result = await this.sendTextMessage(tenantId, channelId, {
              ...bulkRequest.message as WhatsAppTextMessage,
              to: recipient,
            });
          } else if ('templateName' in bulkRequest.message) {
            result = await this.sendTemplateMessage(tenantId, channelId, {
              ...bulkRequest.message as WhatsAppTemplateMessage,
              to: recipient,
            });
          } else if ('type' in bulkRequest.message) {
            result = await this.sendInteractiveMessage(tenantId, channelId, {
              ...bulkRequest.message as WhatsAppInteractiveMessage,
              to: recipient,
            });
          } else {
            result = { success: false, error: 'Unsupported message type for bulk sending' };
          }

          if (result.success) {
            successCount++;
            results.push({
              recipient,
              success: true,
              messageId: result.messageId,
            });
          } else {
            failureCount++;
            results.push({
              recipient,
              success: false,
              error: result.error,
            });
          }

          // Add delay between messages if specified
          if (bulkRequest.sendDelay && bulkRequest.sendDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, bulkRequest.sendDelay));
          }

        } catch (error) {
          failureCount++;
          results.push({
            recipient,
            success: false,
            error: error.message,
          });

          this.logger.error(`Bulk message failed for recipient ${recipient}: ${error.message}`);
        }
      }

      // Log bulk send completion
      await this.logService.log({
        tenantId,
        channelId,
        type: 'SYSTEM',
        level: 'INFO',
        message: 'WhatsApp bulk message send completed',
        metadata: {
          totalMessages: bulkRequest.recipients.length,
          successCount,
          failureCount,
          successRate: (successCount / bulkRequest.recipients.length) * 100,
        },
      });

      return {
        success: failureCount === 0,
        totalMessages: bulkRequest.recipients.length,
        successCount,
        failureCount,
        results,
      };

    } catch (error) {
      this.logger.error(`Bulk message send failed: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });

      return {
        success: false,
        totalMessages: bulkRequest.recipients.length,
        successCount,
        failureCount: bulkRequest.recipients.length - successCount,
        results,
      };
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    tenantId: string,
    channelId: string,
    messageId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(tenantId, channelId);
      if (!credentials) {
        return { success: false, error: 'No WhatsApp credentials found' };
      }

      const config: WhatsAppConfig = {
        accessToken: credentials.accessToken,
        businessAccountId: credentials.businessAccountId,
        phoneNumberId: credentials.phoneNumberId,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        verifyToken: credentials.verifyToken,
      };

      const result = await this.apiService.markMessageAsRead(tenantId, channelId, config, messageId);

      if (result.success) {
        // Log read status
        await this.logService.log({
          tenantId,
          channelId,
          type: 'SYSTEM',
          level: 'INFO',
          message: 'WhatsApp message marked as read',
          metadata: { messageId },
        });

        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Failed to mark message as read' 
        };
      }

    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${error.message}`, {
        tenantId,
        channelId,
        messageId,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  // Private helper methods

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('62') && cleaned.length <= 12) {
      // Indonesian phone number
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else {
        cleaned = '62' + cleaned;
      }
    }
    
    return cleaned;
  }
}