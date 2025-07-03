import { Injectable, Logger } from '@nestjs/common';

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
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(options: EmailOptions): Promise<void> {
    this.logger.log(`Sending email to ${options.to}: ${options.subject}`);
    
    // TODO: Implement actual email sending
    // This could use NodeMailer, SendGrid, or other email service
    
    // For now, just log the email
    this.logger.debug('Email content:', {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  async sendBulkEmail(emails: EmailOptions[]): Promise<void> {
    this.logger.log(`Sending ${emails.length} bulk emails`);
    
    for (const email of emails) {
      await this.sendEmail(email);
    }
  }

  async validateEmail(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}