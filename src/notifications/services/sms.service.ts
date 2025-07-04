import { Injectable, Logger } from '@nestjs/common';

export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendSms(options: SmsOptions): Promise<void> {
    this.logger.log(`Sending SMS to ${options.to}`);

    // TODO: Implement actual SMS sending
    // This could use Twilio, AWS SNS, or other SMS service

    // For now, just log the SMS
    this.logger.debug('SMS content:', {
      to: options.to,
      message: options.message,
      from: options.from,
    });
  }

  async sendBulkSms(messages: SmsOptions[]): Promise<void> {
    this.logger.log(`Sending ${messages.length} SMS messages`);

    for (const message of messages) {
      await this.sendSms(message);
    }
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // Basic Indonesian phone number validation
    const phoneRegex = /^(\+62|62|0)[0-9]{8,11}$/;
    return phoneRegex.test(phoneNumber.replace(/\s|-/g, ''));
  }

  formatPhoneNumber(phoneNumber: string): string {
    // Format to Indonesian standard
    let formatted = phoneNumber.replace(/\s|-/g, '');

    if (formatted.startsWith('0')) {
      formatted = '+62' + formatted.substring(1);
    } else if (formatted.startsWith('62')) {
      formatted = '+' + formatted;
    } else if (!formatted.startsWith('+62')) {
      formatted = '+62' + formatted;
    }

    return formatted;
  }
}
