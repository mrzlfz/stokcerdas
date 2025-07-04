import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';

import { AlertInstance, AlertStatus } from '../entities/alert-instance.entity';
import {
  AlertConfiguration,
  AlertType,
  AlertSeverity,
} from '../entities/alert-configuration.entity';
import { User, UserStatus } from '../../users/entities/user.entity';

export interface EmailNotificationData {
  tenantId: string;
  alert: AlertInstance;
  recipients?: string[];
  customSubject?: string;
  customMessage?: string;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private emailTransporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AlertConfiguration)
    private readonly alertConfigRepository: Repository<AlertConfiguration>,
    private readonly configService: ConfigService,
  ) {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    try {
      this.emailTransporter = createTransport({
        host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
        port: this.configService.get('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASSWORD'),
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.logger.log('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error.stack);
    }
  }

  /**
   * Send alert notification email
   */
  async sendAlertNotification(data: EmailNotificationData): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        this.logger.warn('Email transporter not available');
        return false;
      }

      // Get alert configuration to check if email notifications are enabled
      const config = await this.getAlertConfiguration(data.alert);
      if (!config || !config.configuration?.enableEmailNotification) {
        this.logger.debug(
          `Email notifications disabled for alert ${data.alert.id}`,
        );
        return true; // Not an error, just disabled
      }

      // Get recipients
      const recipients = await this.getRecipients(data);
      if (!recipients.length) {
        this.logger.warn(`No recipients found for alert ${data.alert.id}`);
        return false;
      }

      // Generate email template
      const template = await this.generateEmailTemplate(
        data.alert,
        data.customSubject,
        data.customMessage,
      );

      // Send email to each recipient
      const emailPromises = recipients.map(email =>
        this.sendSingleEmail(email, template, data.alert),
      );

      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(
        result => result.status === 'fulfilled',
      ).length;
      const failed = results.filter(
        result => result.status === 'rejected',
      ).length;

      this.logger.log(
        `Alert email notification sent: ${successful} successful, ${failed} failed for alert ${data.alert.id}`,
      );

      return successful > 0;
    } catch (error) {
      this.logger.error(
        `Failed to send alert notification for alert ${data.alert.id}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Send bulk alert notifications
   */
  async sendBulkAlertNotifications(alerts: AlertInstance[]): Promise<{
    successful: number;
    failed: number;
    total: number;
  }> {
    let successful = 0;
    let failed = 0;

    for (const alert of alerts) {
      try {
        const sent = await this.sendAlertNotification({
          tenantId: alert.tenantId,
          alert,
        });

        if (sent) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to send notification for alert ${alert.id}`,
          error.stack,
        );
      }
    }

    return {
      successful,
      failed,
      total: alerts.length,
    };
  }

  /**
   * Send custom email notification
   */
  async sendCustomNotification(
    tenantId: string,
    recipients: string[],
    subject: string,
    message: string,
    alertType?: AlertType,
  ): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        this.logger.warn('Email transporter not available');
        return false;
      }

      const template = this.generateCustomEmailTemplate(
        subject,
        message,
        alertType,
      );

      const emailPromises = recipients.map(email =>
        this.sendSingleEmail(email, template),
      );

      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(
        result => result.status === 'fulfilled',
      ).length;

      this.logger.log(
        `Custom notification sent to ${successful}/${recipients.length} recipients`,
      );

      return successful > 0;
    } catch (error) {
      this.logger.error('Failed to send custom notification', error.stack);
      return false;
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(testEmail: string): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        this.logger.warn('Email transporter not available');
        return false;
      }

      const template = this.generateTestEmailTemplate();

      await this.sendSingleEmail(testEmail, template);

      this.logger.log(`Test email sent successfully to ${testEmail}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send test email to ${testEmail}`,
        error.stack,
      );
      return false;
    }
  }

  // Private helper methods

  private async getAlertConfiguration(
    alert: AlertInstance,
  ): Promise<AlertConfiguration | null> {
    if (alert.configurationId) {
      return await this.alertConfigRepository.findOne({
        where: { id: alert.configurationId, tenantId: alert.tenantId },
      });
    }

    // Find configuration by alert type and context
    return await this.alertConfigRepository.findOne({
      where: {
        tenantId: alert.tenantId,
        alertType: alert.alertType,
        productId: alert.productId || null,
        locationId: alert.locationId || null,
        isEnabled: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async getRecipients(data: EmailNotificationData): Promise<string[]> {
    const recipients = new Set<string>();

    // Add custom recipients
    if (data.recipients?.length) {
      data.recipients.forEach(email => recipients.add(email));
    }

    // Get recipients from alert configuration
    const config = await this.getAlertConfiguration(data.alert);
    if (config) {
      // Add configured email recipients
      config.recipientEmails.forEach(email => recipients.add(email));

      // Add user emails based on user IDs
      if (config.recipientUserIds.length > 0) {
        const users = await this.userRepository.find({
          where: {
            id: config.recipientUserIds as any,
            tenantId: data.tenantId,
            status: UserStatus.ACTIVE,
          },
          select: ['email'],
        });
        users.forEach(user => user.email && recipients.add(user.email));
      }

      // Add user emails based on roles
      if (config.recipientRoles.length > 0) {
        const users = await this.userRepository.find({
          where: {
            tenantId: data.tenantId,
            role: config.recipientRoles as any,
            status: UserStatus.ACTIVE,
          },
          select: ['email'],
        });
        users.forEach(user => user.email && recipients.add(user.email));
      }
    }

    return Array.from(recipients);
  }

  private async generateEmailTemplate(
    alert: AlertInstance,
    customSubject?: string,
    customMessage?: string,
  ): Promise<EmailTemplate> {
    const severity = this.getSeverityDisplayName(alert.severity);
    const alertType = this.getAlertTypeDisplayName(alert.alertType);

    // Generate subject
    let subject = customSubject;
    if (!subject) {
      subject = `[${severity}] ${alertType} - StokCerdas`;
    }

    // Generate content
    const message = customMessage || alert.message;

    const htmlContent = this.generateHtmlTemplate(
      alert,
      alertType,
      severity,
      message,
    );
    const textContent = this.generateTextTemplate(
      alert,
      alertType,
      severity,
      message,
    );

    return {
      subject,
      htmlContent,
      textContent,
    };
  }

  private generateCustomEmailTemplate(
    subject: string,
    message: string,
    alertType?: AlertType,
  ): EmailTemplate {
    const typeDisplay = alertType
      ? this.getAlertTypeDisplayName(alertType)
      : 'Pemberitahuan';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; padding: 15px; background: #e2e8f0; border-radius: 8px; font-size: 12px; color: #64748b; text-align: center; }
        .message { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 ${typeDisplay}</h1>
            <p>StokCerdas - Sistem Manajemen Inventori</p>
        </div>
        <div class="content">
            <div class="message">
                <h2>${subject}</h2>
                <p style="white-space: pre-wrap;">${message}</p>
            </div>
        </div>
        <div class="footer">
            <p>Email ini dikirim secara otomatis oleh sistem StokCerdas.</p>
            <p>Tanggal: ${new Date().toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
            })}</p>
        </div>
    </div>
</body>
</html>`;

    const textContent = `
${typeDisplay} - StokCerdas

${subject}

${message}

---
Email ini dikirim secara otomatis oleh sistem StokCerdas.
Tanggal: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
`;

    return {
      subject,
      htmlContent,
      textContent,
    };
  }

  private generateHtmlTemplate(
    alert: AlertInstance,
    alertType: string,
    severity: string,
    message: string,
  ): string {
    const severityColor = this.getSeverityColor(alert.severity);
    const severityIcon = this.getSeverityIcon(alert.severity);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alert Notification - StokCerdas</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-info { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${severityColor}; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .details-table th, .details-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .details-table th { background: #f1f5f9; font-weight: bold; }
        .footer { margin-top: 20px; padding: 15px; background: #e2e8f0; border-radius: 8px; font-size: 12px; color: #64748b; text-align: center; }
        .action-needed { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${severityIcon} ${severity} Alert</h1>
            <p>StokCerdas - Sistem Manajemen Inventori</p>
        </div>
        <div class="content">
            <div class="alert-info">
                <h2>${alert.title}</h2>
                <p style="font-size: 16px; margin-bottom: 20px;">${message}</p>
                
                <table class="details-table">
                    <tr>
                        <th>Jenis Alert</th>
                        <td>${alertType}</td>
                    </tr>
                    <tr>
                        <th>Tingkat Keparahan</th>
                        <td>${severity}</td>
                    </tr>
                    <tr>
                        <th>Status</th>
                        <td>${this.getStatusDisplayName(alert.status)}</td>
                    </tr>
                    <tr>
                        <th>Waktu Dibuat</th>
                        <td>${alert.createdAt.toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                        })}</td>
                    </tr>
                    ${
                      alert.product
                        ? `<tr><th>Produk</th><td>${alert.product.name}</td></tr>`
                        : ''
                    }
                    ${
                      alert.location
                        ? `<tr><th>Lokasi</th><td>${alert.location.name}</td></tr>`
                        : ''
                    }
                </table>
            </div>
            
            ${
              alert.severity === AlertSeverity.CRITICAL
                ? `
            <div class="action-needed">
                <strong>⚠️ Tindakan Segera Diperlukan</strong>
                <p>Alert ini memerlukan perhatian segera. Silakan login ke sistem StokCerdas untuk menangani alert ini.</p>
            </div>
            `
                : ''
            }
        </div>
        <div class="footer">
            <p>Email ini dikirim secara otomatis oleh sistem StokCerdas.</p>
            <p>Alert ID: ${alert.id}</p>
            <p>Untuk mengelola alert ini, silakan login ke dashboard StokCerdas.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateTextTemplate(
    alert: AlertInstance,
    alertType: string,
    severity: string,
    message: string,
  ): string {
    return `
=== ALERT NOTIFICATION - STOKCERDAS ===

${severity} ALERT: ${alert.title}

${message}

DETAIL ALERT:
- Jenis Alert: ${alertType}
- Tingkat Keparahan: ${severity}
- Status: ${this.getStatusDisplayName(alert.status)}
- Waktu Dibuat: ${alert.createdAt.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}
${alert.product ? `- Produk: ${alert.product.name}` : ''}
${alert.location ? `- Lokasi: ${alert.location.name}` : ''}

${
  alert.severity === AlertSeverity.CRITICAL
    ? `
⚠️ TINDAKAN SEGERA DIPERLUKAN
Alert ini memerlukan perhatian segera. Silakan login ke sistem StokCerdas untuk menangani alert ini.
`
    : ''
}

---
Email ini dikirim secara otomatis oleh sistem StokCerdas.
Alert ID: ${alert.id}
Untuk mengelola alert ini, silakan login ke dashboard StokCerdas.
`;
  }

  private generateTestEmailTemplate(): EmailTemplate {
    const subject = 'Test Email - StokCerdas Notification System';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Email - StokCerdas</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; padding: 15px; background: #e2e8f0; border-radius: 8px; font-size: 12px; color: #64748b; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Test Email Berhasil</h1>
            <p>StokCerdas - Sistem Manajemen Inventori</p>
        </div>
        <div class="content">
            <h2>Konfigurasi Email Berhasil!</h2>
            <p>Selamat! Sistem notifikasi email StokCerdas telah dikonfigurasi dengan benar dan siap digunakan.</p>
            <p>Anda akan menerima notifikasi email untuk:</p>
            <ul>
                <li>Alert stok rendah</li>
                <li>Alert stok habis</li>
                <li>Alert produk akan expired</li>
                <li>Alert produk expired</li>
                <li>Alert maintenance sistem</li>
                <li>Update status order</li>
            </ul>
        </div>
        <div class="footer">
            <p>Email test dikirim pada: ${new Date().toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
            })}</p>
        </div>
    </div>
</body>
</html>`;

    const textContent = `
TEST EMAIL - STOKCERDAS NOTIFICATION SYSTEM

Konfigurasi Email Berhasil!

Selamat! Sistem notifikasi email StokCerdas telah dikonfigurasi dengan benar dan siap digunakan.

Anda akan menerima notifikasi email untuk:
- Alert stok rendah
- Alert stok habis  
- Alert produk akan expired
- Alert produk expired
- Alert maintenance sistem
- Update status order

---
Email test dikirim pada: ${new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}
`;

    return {
      subject,
      htmlContent,
      textContent,
    };
  }

  private async sendSingleEmail(
    email: string,
    template: EmailTemplate,
    alert?: AlertInstance,
  ): Promise<void> {
    const mailOptions = {
      from: `"StokCerdas Alert System" <${this.configService.get(
        'SMTP_USER',
      )}>`,
      to: email,
      subject: template.subject,
      text: template.textContent,
      html: template.htmlContent,
    };

    await this.emailTransporter.sendMail(mailOptions);

    if (alert) {
      this.logger.debug(`Alert email sent to ${email} for alert ${alert.id}`);
    } else {
      this.logger.debug(`Email sent to ${email}`);
    }
  }

  // Display name helpers
  private getAlertTypeDisplayName(alertType: AlertType): string {
    const displayNames = {
      [AlertType.LOW_STOCK]: 'Stok Rendah',
      [AlertType.OUT_OF_STOCK]: 'Stok Habis',
      [AlertType.OVERSTOCK]: 'Stok Berlebih',
      [AlertType.EXPIRING_SOON]: 'Akan Expired',
      [AlertType.EXPIRED]: 'Sudah Expired',
      [AlertType.REORDER_NEEDED]: 'Perlu Reorder',
      [AlertType.SYSTEM_MAINTENANCE]: 'Maintenance Sistem',
      [AlertType.ORDER_STATUS_UPDATE]: 'Update Status Order',
    };
    return displayNames[alertType] || alertType;
  }

  private getSeverityDisplayName(severity: AlertSeverity): string {
    const displayNames = {
      [AlertSeverity.INFO]: 'INFO',
      [AlertSeverity.WARNING]: 'PERINGATAN',
      [AlertSeverity.CRITICAL]: 'KRITIS',
    };
    return displayNames[severity] || severity;
  }

  private getStatusDisplayName(status: AlertStatus): string {
    const displayNames = {
      [AlertStatus.ACTIVE]: 'Aktif',
      [AlertStatus.ACKNOWLEDGED]: 'Sudah Dilihat',
      [AlertStatus.RESOLVED]: 'Selesai',
      [AlertStatus.DISMISSED]: 'Diabaikan',
      [AlertStatus.SNOOZED]: 'Ditunda',
      [AlertStatus.ESCALATED]: 'Dieskalasi',
    };
    return displayNames[status] || status;
  }

  private getSeverityColor(severity: AlertSeverity): string {
    const colors = {
      [AlertSeverity.INFO]: '#2563eb',
      [AlertSeverity.WARNING]: '#f59e0b',
      [AlertSeverity.CRITICAL]: '#dc2626',
    };
    return colors[severity] || '#6b7280';
  }

  private getSeverityIcon(severity: AlertSeverity): string {
    const icons = {
      [AlertSeverity.INFO]: '📢',
      [AlertSeverity.WARNING]: '⚠️',
      [AlertSeverity.CRITICAL]: '🚨',
    };
    return icons[severity] || '📢';
  }
}
