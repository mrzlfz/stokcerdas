import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntegrationLogService } from '../../common/services/integration-log.service';
import { WhatsAppApiService, WhatsAppConfig } from './whatsapp-api.service';
import { WhatsAppAuthService } from './whatsapp-auth.service';
import { Channel } from '../../../channels/entities/channel.entity';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED' | 'PAUSED';
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: WhatsAppTemplateComponent[];
  created_time: string;
  updated_time: string;
  quality_score?: {
    score: string;
    date: string;
  };
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplateButton {
  type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL' | 'COPY_CODE';
  text: string;
  phone_number?: string;
  url?: string;
  example?: string[];
}

export interface CreateTemplateRequest {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: WhatsAppTemplateComponent[];
}

export interface TemplateUsageStats {
  templateName: string;
  totalSent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface TemplateLibrary {
  // Common business templates for Indonesian SMBs
  orderConfirmation: {
    name: string;
    category: 'UTILITY';
    components: WhatsAppTemplateComponent[];
  };
  paymentReminder: {
    name: string;
    category: 'UTILITY';
    components: WhatsAppTemplateComponent[];
  };
  deliveryUpdate: {
    name: string;
    category: 'UTILITY';
    components: WhatsAppTemplateComponent[];
  };
  welcomeMessage: {
    name: string;
    category: 'MARKETING';
    components: WhatsAppTemplateComponent[];
  };
  promotionalOffer: {
    name: string;
    category: 'MARKETING';
    components: WhatsAppTemplateComponent[];
  };
  appointmentReminder: {
    name: string;
    category: 'UTILITY';
    components: WhatsAppTemplateComponent[];
  };
}

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);

  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    private readonly apiService: WhatsAppApiService,
    private readonly authService: WhatsAppAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get all message templates for the business account
   */
  async getTemplates(
    tenantId: string,
    channelId: string,
    filters?: {
      status?: string;
      category?: string;
      language?: string;
      name?: string;
    },
  ): Promise<{
    success: boolean;
    templates?: WhatsAppTemplate[];
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getCredentials(
        tenantId,
        channelId,
      );
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

      // Build query parameters
      const params: Record<string, any> = {
        fields:
          'id,name,status,category,language,components,created_time,updated_time,quality_score',
      };

      if (filters?.status) {
        params.status = filters.status;
      }
      if (filters?.category) {
        params.category = filters.category;
      }
      if (filters?.language) {
        params.language = filters.language;
      }
      if (filters?.name) {
        params.name = filters.name;
      }

      const result = await this.apiService.makeWhatsAppRequest<{
        data: WhatsAppTemplate[];
      }>(tenantId, channelId, config, {
        method: 'GET',
        endpoint: `/${credentials.businessAccountId}/message_templates`,
        params,
        requiresAuth: true,
      });

      if (result.success) {
        const templates = result.data?.data || [];

        // Log successful retrieval
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.SYSTEM,
          level: IntegrationLogLevel.INFO,
          message: 'WhatsApp templates retrieved successfully',
          metadata: {
            templateCount: templates.length,
            filters,
          },
        });

        return { success: true, templates };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Failed to retrieve templates',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to get templates: ${error.message}`, {
        tenantId,
        channelId,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(
    tenantId: string,
    channelId: string,
    templateId: string,
  ): Promise<{
    success: boolean;
    template?: WhatsAppTemplate;
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getCredentials(
        tenantId,
        channelId,
      );
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

      const result =
        await this.apiService.makeWhatsAppRequest<WhatsAppTemplate>(
          tenantId,
          channelId,
          config,
          {
            method: 'GET',
            endpoint: `/${templateId}`,
            params: {
              fields:
                'id,name,status,category,language,components,created_time,updated_time,quality_score',
            },
            requiresAuth: true,
          },
        );

      if (result.success) {
        return { success: true, template: result.data };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Failed to retrieve template',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to get template: ${error.message}`, {
        tenantId,
        channelId,
        templateId,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new message template
   */
  async createTemplate(
    tenantId: string,
    channelId: string,
    templateRequest: CreateTemplateRequest,
  ): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(
        tenantId,
        channelId,
      );
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

      // Validate template request
      const validation = this.validateTemplateRequest(templateRequest);
      if (!validation.isValid) {
        return { success: false, error: validation.errors?.join(', ') };
      }

      const result = await this.apiService.makeWhatsAppRequest<{
        id: string;
        status: string;
      }>(tenantId, channelId, config, {
        method: 'POST',
        endpoint: `/${credentials.businessAccountId}/message_templates`,
        data: templateRequest,
        requiresAuth: true,
      });

      if (result.success && result.data?.id) {
        const templateId = result.data.id;

        // Log successful creation
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.SYSTEM,
          level: IntegrationLogLevel.INFO,
          message: 'WhatsApp template created successfully',
          metadata: {
            templateId,
            templateName: templateRequest.name,
            category: templateRequest.category,
            language: templateRequest.language,
            status: result.data.status,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.template.created', {
          tenantId,
          channelId,
          templateId,
          templateName: templateRequest.name,
          category: templateRequest.category,
          status: result.data.status,
        });

        return { success: true, templateId };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Failed to create template',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to create template: ${error.message}`, {
        tenantId,
        channelId,
        templateName: templateRequest.name,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a message template
   */
  async deleteTemplate(
    tenantId: string,
    channelId: string,
    templateId: string,
    templateName: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.authService.getCredentials(
        tenantId,
        channelId,
      );
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

      const result = await this.apiService.makeWhatsAppRequest(
        tenantId,
        channelId,
        config,
        {
          method: 'DELETE',
          endpoint: `/${credentials.businessAccountId}/message_templates`,
          params: {
            name: templateName,
          },
          requiresAuth: true,
        },
      );

      if (result.success) {
        // Log successful deletion
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.SYSTEM,
          level: IntegrationLogLevel.INFO,
          message: 'WhatsApp template deleted successfully',
          metadata: {
            templateId,
            templateName,
          },
        });

        // Emit event
        this.eventEmitter.emit('whatsapp.template.deleted', {
          tenantId,
          channelId,
          templateId,
          templateName,
        });

        return { success: true };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Failed to delete template',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to delete template: ${error.message}`, {
        tenantId,
        channelId,
        templateId,
        templateName,
        error: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Get template library with pre-defined templates for Indonesian businesses
   */
  getTemplateLibrary(): TemplateLibrary {
    return {
      orderConfirmation: {
        name: 'order_confirmation',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Konfirmasi Pesanan',
          },
          {
            type: 'BODY',
            text: 'Halo {{1}}, pesanan Anda dengan nomor {{2}} telah dikonfirmasi. Total pembayaran: Rp {{3}}. Estimasi pengiriman: {{4}}. Terima kasih telah berbelanja dengan kami!',
            example: {
              body_text: [
                ['John Doe', 'ORD-12345', '250,000', '2-3 hari kerja'],
              ],
            },
          },
          {
            type: 'FOOTER',
            text: 'Tim StokCerdas',
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'QUICK_REPLY',
                text: 'Lacak Pesanan',
              },
              {
                type: 'PHONE_NUMBER',
                text: 'Hubungi Kami',
                phone_number: '+6281234567890',
              },
            ],
          },
        ],
      },
      paymentReminder: {
        name: 'payment_reminder',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Pengingat Pembayaran',
          },
          {
            type: 'BODY',
            text: 'Halo {{1}}, pesanan {{2}} menunggu pembayaran. Total: Rp {{3}}. Batas waktu pembayaran: {{4}}. Silakan selesaikan pembayaran untuk melanjutkan proses pesanan.',
            example: {
              body_text: [['John Doe', 'ORD-12345', '250,000', '24 jam']],
            },
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'URL',
                text: 'Bayar Sekarang',
                url: 'https://payment.stokcerdas.com/{{1}}',
                example: ['ORD-12345'],
              },
            ],
          },
        ],
      },
      deliveryUpdate: {
        name: 'delivery_update',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Update Pengiriman',
          },
          {
            type: 'BODY',
            text: 'Pesanan {{1}} sedang dalam perjalanan! Paket Anda telah dikirim melalui {{2}} dengan nomor resi {{3}}. Estimasi tiba: {{4}}.',
            example: {
              body_text: [['ORD-12345', 'JNE', 'JNE123456789', 'Besok sore']],
            },
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'URL',
                text: 'Lacak Paket',
                url: 'https://tracking.jne.co.id/{{1}}',
                example: ['JNE123456789'],
              },
            ],
          },
        ],
      },
      welcomeMessage: {
        name: 'welcome_message',
        category: 'MARKETING',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Selamat Datang! 🎉',
          },
          {
            type: 'BODY',
            text: 'Halo {{1}}, selamat datang di {{2}}! Kami siap membantu mengelola stok bisnis Anda dengan lebih efisien. Dapatkan diskon 20% untuk bulan pertama dengan kode: {{3}}',
            example: {
              body_text: [['John Doe', 'StokCerdas', 'WELCOME20']],
            },
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'URL',
                text: 'Mulai Sekarang',
                url: 'https://app.stokcerdas.com/signup?code={{1}}',
                example: ['WELCOME20'],
              },
              {
                type: 'QUICK_REPLY',
                text: 'Pelajari Lebih Lanjut',
              },
            ],
          },
        ],
      },
      promotionalOffer: {
        name: 'promotional_offer',
        category: 'MARKETING',
        components: [
          {
            type: 'HEADER',
            format: 'IMAGE',
            example: {
              header_handle: ['https://example.com/promo-banner.jpg'],
            },
          },
          {
            type: 'BODY',
            text: '🔥 PROMO SPESIAL! {{1}} diskon hingga {{2}} untuk semua produk {{3}}. Berlaku hingga {{4}}. Jangan sampai terlewat!',
            example: {
              body_text: [
                ['Flash Sale', '50%', 'elektronik', '31 Desember 2024'],
              ],
            },
          },
          {
            type: 'FOOTER',
            text: 'Syarat dan ketentuan berlaku',
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'URL',
                text: 'Belanja Sekarang',
                url: 'https://shop.stokcerdas.com/promo/{{1}}',
                example: ['flash-sale'],
              },
            ],
          },
        ],
      },
      appointmentReminder: {
        name: 'appointment_reminder',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Pengingat Janji Temu',
          },
          {
            type: 'BODY',
            text: 'Halo {{1}}, ini pengingat untuk janji temu Anda besok pada {{2}} di {{3}}. Mohon datang 15 menit lebih awal. Jika ada perubahan, silakan hubungi kami.',
            example: {
              body_text: [
                ['John Doe', '14:00 WIB', 'StokCerdas Office Jakarta'],
              ],
            },
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'QUICK_REPLY',
                text: 'Konfirmasi Kehadiran',
              },
              {
                type: 'QUICK_REPLY',
                text: 'Reschedule',
              },
              {
                type: 'PHONE_NUMBER',
                text: 'Hubungi Kami',
                phone_number: '+6281234567890',
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Create template from library
   */
  async createTemplateFromLibrary(
    tenantId: string,
    channelId: string,
    templateType: keyof TemplateLibrary,
    language: string = 'id',
  ): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      const library = this.getTemplateLibrary();
      const template = library[templateType];

      if (!template) {
        return {
          success: false,
          error: `Template type '${templateType}' not found in library`,
        };
      }

      const createRequest: CreateTemplateRequest = {
        name: template.name,
        category: template.category,
        language,
        components: template.components,
      };

      const result = await this.createTemplate(
        tenantId,
        channelId,
        createRequest,
      );

      if (result.success) {
        // Log template creation from library
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.SYSTEM,
          level: IntegrationLogLevel.INFO,
          message: 'WhatsApp template created from library',
          metadata: {
            templateType,
            templateName: template.name,
            templateId: result.templateId,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to create template from library: ${error.message}`,
        {
          tenantId,
          channelId,
          templateType,
          error: error.message,
        },
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStats(
    tenantId: string,
    channelId: string,
    templateName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ success: boolean; stats?: TemplateUsageStats; error?: string }> {
    try {
      // This would typically integrate with analytics API
      // For now, we'll return mock data structure

      const stats: TemplateUsageStats = {
        templateName,
        totalSent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        deliveryRate: 0,
        readRate: 0,
        period: {
          startDate,
          endDate,
        },
      };

      // TODO: Implement actual analytics integration
      // This could involve querying webhook events, integration logs, etc.

      return { success: true, stats };
    } catch (error) {
      this.logger.error(
        `Failed to get template usage stats: ${error.message}`,
        {
          tenantId,
          channelId,
          templateName,
          error: error.message,
        },
      );

      return { success: false, error: error.message };
    }
  }

  // Private helper methods

  /**
   * Validate template request
   */
  private validateTemplateRequest(templateRequest: CreateTemplateRequest): {
    isValid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Validate name
    if (!templateRequest.name || templateRequest.name.length < 1) {
      errors.push('Template name is required');
    }
    if (templateRequest.name && !/^[a-z0-9_]+$/.test(templateRequest.name)) {
      errors.push(
        'Template name can only contain lowercase letters, numbers, and underscores',
      );
    }

    // Validate category
    if (
      !['AUTHENTICATION', 'MARKETING', 'UTILITY'].includes(
        templateRequest.category,
      )
    ) {
      errors.push('Invalid template category');
    }

    // Validate language
    if (!templateRequest.language) {
      errors.push('Language is required');
    }

    // Validate components
    if (
      !templateRequest.components ||
      templateRequest.components.length === 0
    ) {
      errors.push('At least one component is required');
    }

    // Validate component structure
    let hasBody = false;
    templateRequest.components?.forEach((component, index) => {
      if (component.type === 'BODY') {
        hasBody = true;
        if (!component.text) {
          errors.push(`Body component must have text content`);
        }
      }

      if (component.type === 'HEADER' && component.format && !component.text) {
        if (component.format === 'TEXT' && !component.text) {
          errors.push(
            `Header component with TEXT format must have text content`,
          );
        }
      }

      if (component.type === 'BUTTONS' && component.buttons) {
        if (component.buttons.length > 3) {
          errors.push(`Maximum 3 buttons allowed per template`);
        }

        component.buttons.forEach((button, buttonIndex) => {
          if (!button.text) {
            errors.push(`Button ${buttonIndex + 1} must have text`);
          }
          if (button.type === 'PHONE_NUMBER' && !button.phone_number) {
            errors.push(`Phone number button must have phone_number field`);
          }
          if (button.type === 'URL' && !button.url) {
            errors.push(`URL button must have url field`);
          }
        });
      }
    });

    if (!hasBody) {
      errors.push('Template must have a BODY component');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
