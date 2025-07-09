import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import {
  INDONESIAN_TELECOM_CONFIG,
  IndonesianTelecomHelper,
  IndonesianTelecomProvider,
} from '../../config/indonesian-telecom.config';

export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
  priority?: 'high' | 'normal' | 'low';
  scheduledTime?: Date;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount?: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio;
  private readonly maxRetries = 3;
  private readonly retryDelay = 3000; // 3 seconds

  // Indonesian telecom providers from configuration
  private readonly indonesianProviders: IndonesianTelecomProvider[] =
    INDONESIAN_TELECOM_CONFIG.providers;

  constructor(private readonly configService: ConfigService) {
    this.initializeTwilio();
  }

  private initializeTwilio(): void {
    const smsEnabled = this.configService.get<boolean>('SMS_ENABLED', true);

    if (!smsEnabled) {
      this.logger.warn('SMS service is disabled via configuration');
      return;
    }

    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Twilio credentials not configured. SMS service will use fallback logging.',
      );
      return;
    }

    try {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio SMS service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Twilio: ${error.message}`);
    }
  }

  async sendSms(options: SmsOptions, retryCount = 0): Promise<SmsResult> {
    const smsEnabled = this.configService.get<boolean>('SMS_ENABLED', true);

    if (!smsEnabled) {
      this.logger.debug('SMS service disabled, logging SMS instead:', {
        to: options.to,
        message: options.message.substring(0, 100) + '...',
        retryCount,
      });
      return { success: true, messageId: 'disabled' };
    }

    if (!this.twilioClient) {
      this.logger.debug('Twilio not configured, logging SMS instead:', {
        to: options.to,
        message: options.message.substring(0, 100) + '...',
        retryCount,
      });
      return { success: true, messageId: 'logging' };
    }

    try {
      this.logger.log(
        `Sending SMS to ${options.to} (attempt ${retryCount + 1})`,
      );

      // Validate and format phone number
      const formattedNumber = this.formatPhoneNumber(options.to);
      if (!(await this.validateIndonesianPhoneNumber(formattedNumber))) {
        throw new BadRequestException('Invalid Indonesian phone number format');
      }

      const twilioOptions: any = {
        body: options.message,
        to: formattedNumber,
        from:
          options.from ||
          this.configService.get<string>('TWILIO_FROM_NUMBER', '+1234567890'),
      };

      // Handle scheduling
      if (options.scheduledTime) {
        twilioOptions.scheduleType = 'fixed';
        twilioOptions.sendAt = options.scheduledTime;
      }

      const result = await this.twilioClient.messages.create(twilioOptions);

      this.logger.log(
        `SMS sent successfully to ${options.to}. MessageId: ${result.sid}`,
      );

      return {
        success: true,
        messageId: result.sid,
        retryCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${options.to} (attempt ${retryCount + 1}): ${
          error.message
        }`,
      );

      // Retry logic
      if (retryCount < this.maxRetries) {
        this.logger.log(`Retrying SMS send in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.sendSms(options, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        retryCount,
      };
    }
  }

  async sendBulkSms(messages: SmsOptions[]): Promise<SmsResult[]> {
    this.logger.log(`Sending ${messages.length} bulk SMS messages`);

    const results: SmsResult[] = [];

    // Process in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const batchPromises = batch.map(message => this.sendSms(message));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error(
            `Bulk SMS ${i + index} failed: ${result.reason.message}`,
          );
          results.push({
            success: false,
            error: result.reason.message,
          });
        }
      });

      // Rate limiting delay between batches
      if (i + batchSize < messages.length) {
        await this.delay(1000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.log(
      `Bulk SMS completed: ${successCount}/${messages.length} successful`,
    );

    return results;
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // Use Indonesian telecom configuration for validation
    return IndonesianTelecomHelper.validateIndonesianPhoneNumber(phoneNumber);
  }

  async validateIndonesianPhoneNumber(phoneNumber: string): Promise<boolean> {
    // Enhanced Indonesian phone number validation using configuration
    return IndonesianTelecomHelper.validateIndonesianPhoneNumber(phoneNumber);
  }

  formatPhoneNumber(phoneNumber: string): string {
    // Use Indonesian telecom configuration for formatting
    return IndonesianTelecomHelper.formatPhoneNumber(phoneNumber);
  }

  getIndonesianProvider(phoneNumber: string): IndonesianTelecomProvider | null {
    // Use Indonesian telecom configuration for provider detection
    return IndonesianTelecomHelper.getOptimalProvider(phoneNumber);
  }

  async sendIndonesianBusinessNotification(
    to: string,
    message: string,
    options: Partial<SmsOptions> = {},
  ): Promise<SmsResult> {
    // Add Indonesian business context
    const provider = this.getIndonesianProvider(to);
    const providerInfo = provider ? ` (${provider.name})` : '';

    const contextualMessage = `${message}\n\n--\nStokCerdas - Solusi Inventori Cerdas\nBalas STOP untuk berhenti`;

    return await this.sendSms({
      to,
      message: contextualMessage,
      ...options,
    });
  }

  async sendLowStockAlert(
    to: string,
    productName: string,
    currentStock: number,
    locationName: string,
    options: Partial<SmsOptions> = {},
  ): Promise<SmsResult> {
    const message =
      `🚨 PERINGATAN STOK MENIPIS 🚨\n\n` +
      `Produk: ${productName}\n` +
      `Lokasi: ${locationName}\n` +
      `Stok Tersisa: ${currentStock} unit\n\n` +
      `Segera lakukan pemesanan ulang!\n\n` +
      `StokCerdas - ${new Date().toLocaleString('id-ID')}`;

    return await this.sendIndonesianBusinessNotification(to, message, {
      priority: 'high',
      ...options,
    });
  }

  async sendOrderConfirmation(
    to: string,
    orderNumber: string,
    orderDetails: any,
    options: Partial<SmsOptions> = {},
  ): Promise<SmsResult> {
    const message =
      `✅ KONFIRMASI PESANAN\n\n` +
      `Nomor Pesanan: ${orderNumber}\n` +
      `Status: Dikonfirmasi\n\n` +
      `Terima kasih telah berbelanja!\n\n` +
      `StokCerdas - ${new Date().toLocaleString('id-ID')}`;

    return await this.sendIndonesianBusinessNotification(to, message, options);
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.twilioClient) {
        return false;
      }

      // Test connection by fetching account info
      await this.twilioClient.api.accounts.list({ limit: 1 });
      return true;
    } catch (error) {
      this.logger.error(`SMS service connection test failed: ${error.message}`);
      return false;
    }
  }

  async getConnectionInfo(): Promise<any> {
    return {
      provider: 'Twilio',
      enabled: this.configService.get<boolean>('SMS_ENABLED'),
      hasCredentials: !!(
        this.configService.get<string>('TWILIO_ACCOUNT_SID') &&
        this.configService.get<string>('TWILIO_AUTH_TOKEN')
      ),
      fromNumber: this.configService.get<string>('TWILIO_FROM_NUMBER'),
      supportedProviders: IndonesianTelecomHelper.getActiveProviders().map(
        p => p.name,
      ),
      indonesianTelecomConfig: {
        totalProviders: INDONESIAN_TELECOM_CONFIG.providers.length,
        activeProviders: IndonesianTelecomHelper.getActiveProviders().length,
        lastUpdated: INDONESIAN_TELECOM_CONFIG.lastUpdated,
        rateLimit: IndonesianTelecomHelper.getRateLimitForTime(),
        isBusinessHours: IndonesianTelecomHelper.isBusinessHours(),
      },
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
