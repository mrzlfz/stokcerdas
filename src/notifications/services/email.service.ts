import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  EmailTemplateService,
  EmailTemplateType,
  EmailTemplateData,
} from './email-template.service';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const emailEnabled = this.configService.get<boolean>('EMAIL_ENABLED', true);

    if (!emailEnabled) {
      this.logger.warn('Email service is disabled via configuration');
      return;
    }

    const config = {
      host: this.configService.get<string>('SMTP_HOST', 'localhost'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      // Force plain text connection for MailHog
      ignoreTLS: true,
      // Explicitly disable TLS for MailHog development
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      // Disable STARTTLS for plain connections
      requireTLS: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 60 seconds
    };

    // Remove auth if no credentials provided (for local development)
    if (!config.auth.user && !config.auth.pass) {
      delete config.auth;
    }

    this.transporter = nodemailer.createTransport(config);

    // Skip SMTP verification in development to avoid SSL issues with MailHog
    const environment = process.env.NODE_ENV || 'development';
    if (environment !== 'development') {
      this.verifyConnection();
    } else {
      this.logger.log(
        'SMTP connection verification skipped in development mode',
      );
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error(
        `SMTP connection verification failed: ${error.message}`,
      );
      // Don't throw error in constructor, just log it
    }
  }

  async sendEmail(options: EmailOptions, retryCount = 0): Promise<EmailResult> {
    const emailEnabled = this.configService.get<boolean>('EMAIL_ENABLED', true);

    if (!emailEnabled) {
      this.logger.debug('Email service disabled, logging email instead:', {
        to: options.to,
        subject: options.subject,
        retryCount,
      });
      return { success: true, messageId: 'disabled' };
    }

    if (!this.transporter) {
      throw new BadRequestException('Email service not properly configured');
    }

    try {
      this.logger.log(
        `Sending email to ${options.to}: ${options.subject} (attempt ${
          retryCount + 1
        })`,
      );

      const mailOptions = {
        from:
          options.from ||
          this.configService.get<string>(
            'SMTP_FROM',
            'noreply@stokcerdas.local',
          ),
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        priority: options.priority || 'normal',
        replyTo: options.replyTo,
        headers: {
          'X-Mailer': 'StokCerdas',
          'X-Priority':
            options.priority === 'high'
              ? '1'
              : options.priority === 'low'
              ? '5'
              : '3',
        },
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `Email sent successfully to ${options.to}. MessageId: ${result.messageId}`,
      );

      return {
        success: true,
        messageId: result.messageId,
        retryCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to} (attempt ${retryCount + 1}): ${
          error.message
        }`,
      );

      // Retry logic
      if (retryCount < this.maxRetries) {
        this.logger.log(`Retrying email send in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.sendEmail(options, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        retryCount,
      };
    }
  }

  async sendBulkEmail(emails: EmailOptions[]): Promise<EmailResult[]> {
    this.logger.log(`Sending ${emails.length} bulk emails`);

    const results: EmailResult[] = [];

    // Process in batches to avoid overwhelming the SMTP server
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const batchPromises = batch.map(email => this.sendEmail(email));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error(
            `Bulk email ${i + index} failed: ${result.reason.message}`,
          );
          results.push({
            success: false,
            error: result.reason.message,
          });
        }
      });

      // Small delay between batches
      if (i + batchSize < emails.length) {
        await this.delay(1000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.log(
      `Bulk email completed: ${successCount}/${emails.length} successful`,
    );

    return results;
  }

  async validateEmail(email: string): Promise<boolean> {
    // Enhanced email validation
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email)) {
      return false;
    }

    // Additional checks
    if (email.length > 254) return false; // RFC 5321 limit

    const [localPart, domain] = email.split('@');
    if (localPart.length > 64) return false; // RFC 5321 limit

    // Check for consecutive dots
    if (email.includes('..')) return false;

    // Check for starting/ending dots
    if (localPart.startsWith('.') || localPart.endsWith('.')) return false;

    return true;
  }

  async validateIndonesianEmail(email: string): Promise<boolean> {
    if (!(await this.validateEmail(email))) {
      return false;
    }

    // Check for common Indonesian email domains
    const [, domain] = email.split('@');
    const indonesianDomains = [
      'gmail.com',
      'yahoo.com',
      'yahoo.co.id',
      'hotmail.com',
      'outlook.com',
      'ymail.com',
      'rocketmail.com',
      // Indonesian domains
      'telkom.net',
      'cbn.net.id',
      'indo.net.id',
      'dnet.net.id',
      'centrin.net.id',
      'wasantara.net.id',
      'rad.net.id',
    ];

    // For Indonesian context, we're more permissive but log unusual domains
    if (
      !indonesianDomains.some(d =>
        domain.toLowerCase().includes(d.toLowerCase()),
      )
    ) {
      this.logger.debug(
        `Unusual email domain for Indonesian context: ${domain}`,
      );
    }

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        return false;
      }
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(
        `Email service connection test failed: ${error.message}`,
      );
      return false;
    }
  }

  async getConnectionInfo(): Promise<any> {
    return {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE'),
      enabled: this.configService.get<boolean>('EMAIL_ENABLED'),
      hasAuth: !!(
        this.configService.get<string>('SMTP_USER') &&
        this.configService.get<string>('SMTP_PASS')
      ),
    };
  }

  /**
   * Send templated email using predefined templates
   */
  async sendTemplatedEmail(
    templateType: EmailTemplateType,
    to: string,
    templateData: EmailTemplateData,
    options: Partial<EmailOptions> = {},
    language: 'id' | 'en' = 'id',
  ): Promise<EmailResult> {
    try {
      this.logger.log(`Sending templated email (${templateType}) to ${to}`);

      // Render template
      const renderedTemplate = await this.emailTemplateService.renderTemplate(
        templateType,
        templateData,
        language,
      );

      // Prepare email options
      const emailOptions: EmailOptions = {
        to,
        subject: renderedTemplate.subject,
        html: renderedTemplate.html,
        text: renderedTemplate.text,
        ...options,
      };

      // Send email
      return await this.sendEmail(emailOptions);
    } catch (error) {
      this.logger.error(
        `Failed to send templated email (${templateType}) to ${to}: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send bulk templated emails
   */
  async sendBulkTemplatedEmail(
    templateType: EmailTemplateType,
    recipients: Array<{
      to: string;
      templateData: EmailTemplateData;
      options?: Partial<EmailOptions>;
    }>,
    language: 'id' | 'en' = 'id',
  ): Promise<EmailResult[]> {
    this.logger.log(
      `Sending bulk templated emails (${templateType}) to ${recipients.length} recipients`,
    );

    const results: EmailResult[] = [];

    // Process in batches to avoid overwhelming the template service
    const batchSize = 5;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchPromises = batch.map(recipient =>
        this.sendTemplatedEmail(
          templateType,
          recipient.to,
          recipient.templateData,
          recipient.options || {},
          language,
        ),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error(
            `Bulk templated email ${i + index} failed: ${
              result.reason.message
            }`,
          );
          results.push({
            success: false,
            error: result.reason.message,
          });
        }
      });

      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await this.delay(2000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.log(
      `Bulk templated email completed: ${successCount}/${recipients.length} successful`,
    );

    return results;
  }

  /**
   * Send Indonesian business notification email
   */
  async sendIndonesianNotification(
    to: string,
    subject: string,
    content: string,
    options: Partial<EmailOptions> = {},
  ): Promise<EmailResult> {
    const templateData: EmailTemplateData = {
      recipientName: options.from || 'Mitra Bisnis',
      content,
    };

    return await this.sendTemplatedEmail(
      EmailTemplateType.SYSTEM_NOTIFICATION,
      to,
      templateData,
      { ...options, subject },
      'id',
    );
  }

  /**
   * Send low stock alert with Indonesian context
   */
  async sendLowStockAlert(
    to: string,
    productName: string,
    currentStock: number,
    locationName: string,
    options: Partial<EmailOptions> = {},
  ): Promise<EmailResult> {
    const templateData: EmailTemplateData = {
      recipientName: options.from || 'Mitra Bisnis',
      productName,
      currentStock,
      locationName,
    };

    return await this.sendTemplatedEmail(
      EmailTemplateType.LOW_STOCK_ALERT,
      to,
      templateData,
      options,
      'id',
    );
  }

  /**
   * Send order confirmation with Indonesian context
   */
  async sendOrderConfirmation(
    to: string,
    orderNumber: string,
    orderDetails: any,
    options: Partial<EmailOptions> = {},
  ): Promise<EmailResult> {
    const templateData: EmailTemplateData = {
      recipientName: options.from || 'Pelanggan',
      orderNumber,
      orderDetails,
    };

    return await this.sendTemplatedEmail(
      EmailTemplateType.ORDER_CONFIRMATION,
      to,
      templateData,
      options,
      'id',
    );
  }

  /**
   * Initialize default email templates
   */
  async initializeDefaultTemplates(): Promise<void> {
    try {
      await this.emailTemplateService.createDefaultTemplates();
      this.logger.log('Default email templates initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize default email templates: ${error.message}`,
      );
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
