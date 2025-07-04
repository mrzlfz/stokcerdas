import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EmailNotificationService } from '../services/email-notification.service';
import { AlertInstance } from '../entities/alert-instance.entity';
import {
  AlertType,
  AlertSeverity,
} from '../entities/alert-configuration.entity';

export interface AlertEventData {
  tenantId: string;
  alert: AlertInstance;
  userId?: string;
}

export interface AlertCreatedEventData extends AlertEventData {}

export interface AlertAcknowledgedEventData extends AlertEventData {
  userId: string;
}

export interface AlertResolvedEventData extends AlertEventData {
  userId: string;
}

export interface AlertEscalatedEventData extends AlertEventData {
  userId: string;
  escalatedTo: string;
}

export interface AlertReactivatedEventData extends AlertEventData {}

export interface MaintenanceAlertEventData extends AlertEventData {}

@Injectable()
export class AlertEmailListener {
  private readonly logger = new Logger(AlertEmailListener.name);

  constructor(
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  /**
   * Handle alert created events
   */
  @OnEvent('alert.created')
  async handleAlertCreated(data: AlertCreatedEventData): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.created event for alert ${data.alert.id}`,
      );

      // Send immediate email notification for critical alerts
      if (data.alert.severity === AlertSeverity.CRITICAL) {
        await this.emailNotificationService.sendAlertNotification({
          tenantId: data.tenantId,
          alert: data.alert,
        });

        this.logger.log(`Critical alert email sent for alert ${data.alert.id}`);
        return;
      }

      // Send email for specific alert types that require immediate attention
      const immediateNotificationTypes = [
        AlertType.OUT_OF_STOCK,
        AlertType.EXPIRED,
        AlertType.SYSTEM_MAINTENANCE,
      ];

      if (immediateNotificationTypes.includes(data.alert.alertType)) {
        await this.emailNotificationService.sendAlertNotification({
          tenantId: data.tenantId,
          alert: data.alert,
        });

        this.logger.log(
          `Immediate alert email sent for ${data.alert.alertType} alert ${data.alert.id}`,
        );
        return;
      }

      // For other alerts, check configuration before sending
      await this.emailNotificationService.sendAlertNotification({
        tenantId: data.tenantId,
        alert: data.alert,
      });

      this.logger.debug(
        `Alert email notification processed for alert ${data.alert.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process alert.created event for alert ${data.alert.id}`,
        error.stack,
      );
    }
  }

  /**
   * Handle alert acknowledged events
   */
  @OnEvent('alert.acknowledged')
  async handleAlertAcknowledged(
    data: AlertAcknowledgedEventData,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.acknowledged event for alert ${data.alert.id}`,
      );

      // Send acknowledgment notification only for critical alerts or if configured
      if (data.alert.severity === AlertSeverity.CRITICAL) {
        await this.emailNotificationService.sendAlertNotification({
          tenantId: data.tenantId,
          alert: data.alert,
          customSubject: `[ACKNOWLEDGED] ${data.alert.title} - StokCerdas`,
          customMessage: `Alert telah di-acknowledge oleh pengguna pada ${new Date().toLocaleString(
            'id-ID',
            { timeZone: 'Asia/Jakarta' },
          )}.

Alert: ${data.alert.message}`,
        });

        this.logger.log(
          `Acknowledgment email sent for critical alert ${data.alert.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process alert.acknowledged event for alert ${data.alert.id}`,
        error.stack,
      );
    }
  }

  /**
   * Handle alert resolved events
   */
  @OnEvent('alert.resolved')
  async handleAlertResolved(data: AlertResolvedEventData): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.resolved event for alert ${data.alert.id}`,
      );

      // Send resolution notification for critical alerts or if configured
      if (data.alert.severity === AlertSeverity.CRITICAL) {
        await this.emailNotificationService.sendAlertNotification({
          tenantId: data.tenantId,
          alert: data.alert,
          customSubject: `[RESOLVED] ${data.alert.title} - StokCerdas`,
          customMessage: `Alert telah diselesaikan pada ${new Date().toLocaleString(
            'id-ID',
            { timeZone: 'Asia/Jakarta' },
          )}.

Alert: ${data.alert.message}

Catatan Penyelesaian: ${data.alert.resolutionNotes || 'Tidak ada catatan'}`,
        });

        this.logger.log(
          `Resolution email sent for critical alert ${data.alert.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process alert.resolved event for alert ${data.alert.id}`,
        error.stack,
      );
    }
  }

  /**
   * Handle alert escalated events
   */
  @OnEvent('alert.escalated')
  async handleAlertEscalated(data: AlertEscalatedEventData): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.escalated event for alert ${data.alert.id}`,
      );

      // Always send email notification for escalated alerts
      await this.emailNotificationService.sendAlertNotification({
        tenantId: data.tenantId,
        alert: data.alert,
        customSubject: `[ESCALATED] ${data.alert.title} - StokCerdas`,
        customMessage: `Alert telah dieskalasi pada ${new Date().toLocaleString(
          'id-ID',
          { timeZone: 'Asia/Jakarta' },
        )}.

Alert: ${data.alert.message}

Alasan Eskalasi: ${data.alert.escalationReason || 'Tidak disebutkan'}

Tindakan segera diperlukan.`,
      });

      this.logger.log(`Escalation email sent for alert ${data.alert.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process alert.escalated event for alert ${data.alert.id}`,
        error.stack,
      );
    }
  }

  /**
   * Handle alert reactivated from snooze events
   */
  @OnEvent('alert.reactivated')
  async handleAlertReactivated(data: AlertReactivatedEventData): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.reactivated event for alert ${data.alert.id}`,
      );

      // Send reactivation notification for critical and warning alerts
      if (
        [AlertSeverity.CRITICAL, AlertSeverity.WARNING].includes(
          data.alert.severity,
        )
      ) {
        await this.emailNotificationService.sendAlertNotification({
          tenantId: data.tenantId,
          alert: data.alert,
          customSubject: `[REACTIVATED] ${data.alert.title} - StokCerdas`,
          customMessage: `Alert yang sebelumnya di-snooze telah aktif kembali pada ${new Date().toLocaleString(
            'id-ID',
            { timeZone: 'Asia/Jakarta' },
          )}.

Alert: ${data.alert.message}

Perhatian diperlukan.`,
        });

        this.logger.log(`Reactivation email sent for alert ${data.alert.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process alert.reactivated event for alert ${data.alert.id}`,
        error.stack,
      );
    }
  }

  /**
   * Handle immediate maintenance alerts
   */
  @OnEvent('alert.maintenance.immediate')
  async handleMaintenanceImmediate(
    data: MaintenanceAlertEventData,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.maintenance.immediate event for alert ${data.alert.id}`,
      );

      // Always send immediate notification for maintenance alerts
      await this.emailNotificationService.sendAlertNotification({
        tenantId: data.tenantId,
        alert: data.alert,
        customSubject: `[MAINTENANCE] ${data.alert.title} - StokCerdas`,
        customMessage: `Pemberitahuan maintenance sistem darurat.

${data.alert.message}

Sistem mungkin akan mengalami gangguan. Mohon maaf atas ketidaknyamanannya.`,
      });

      this.logger.log(
        `Immediate maintenance email sent for alert ${data.alert.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process alert.maintenance.immediate event for alert ${data.alert.id}`,
        error.stack,
      );
    }
  }

  /**
   * Handle daily digest events (if implemented)
   */
  @OnEvent('alert.daily.digest')
  async handleDailyDigest(data: {
    tenantId: string;
    alerts: AlertInstance[];
    recipients: string[];
  }): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.daily.digest event for tenant ${data.tenantId}`,
      );

      if (!data.alerts.length) {
        this.logger.debug(
          `No alerts for daily digest for tenant ${data.tenantId}`,
        );
        return;
      }

      // Group alerts by severity
      const criticalAlerts = data.alerts.filter(
        a => a.severity === AlertSeverity.CRITICAL,
      );
      const warningAlerts = data.alerts.filter(
        a => a.severity === AlertSeverity.WARNING,
      );
      const infoAlerts = data.alerts.filter(
        a => a.severity === AlertSeverity.INFO,
      );

      const subject = `Ringkasan Alert Harian - ${new Date().toLocaleDateString(
        'id-ID',
      )} - StokCerdas`;

      let message = `Ringkasan alert untuk tanggal ${new Date().toLocaleDateString(
        'id-ID',
      )}:

`;

      if (criticalAlerts.length > 0) {
        message += `🚨 KRITIS (${criticalAlerts.length}):\n`;
        criticalAlerts.forEach(alert => {
          message += `- ${alert.title}: ${alert.message}\n`;
        });
        message += '\n';
      }

      if (warningAlerts.length > 0) {
        message += `⚠️ PERINGATAN (${warningAlerts.length}):\n`;
        warningAlerts.forEach(alert => {
          message += `- ${alert.title}: ${alert.message}\n`;
        });
        message += '\n';
      }

      if (infoAlerts.length > 0) {
        message += `📢 INFORMASI (${infoAlerts.length}):\n`;
        infoAlerts.forEach(alert => {
          message += `- ${alert.title}: ${alert.message}\n`;
        });
        message += '\n';
      }

      message +=
        'Silakan login ke dashboard StokCerdas untuk mengelola alert-alert ini.';

      await this.emailNotificationService.sendCustomNotification(
        data.tenantId,
        data.recipients,
        subject,
        message,
        AlertType.SYSTEM_MAINTENANCE, // Use system maintenance type for styling
      );

      this.logger.log(
        `Daily digest email sent for tenant ${data.tenantId} to ${data.recipients.length} recipients`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process alert.daily.digest event for tenant ${data.tenantId}`,
        error.stack,
      );
    }
  }

  /**
   * Handle bulk alert notifications
   */
  @OnEvent('alert.bulk.created')
  async handleBulkAlertsCreated(data: {
    tenantId: string;
    alerts: AlertInstance[];
  }): Promise<void> {
    try {
      this.logger.debug(
        `Processing alert.bulk.created event for ${data.alerts.length} alerts`,
      );

      // Send bulk notifications efficiently
      const result =
        await this.emailNotificationService.sendBulkAlertNotifications(
          data.alerts,
        );

      this.logger.log(
        `Bulk alert notifications: ${result.successful} sent, ${result.failed} failed of ${result.total} total`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process alert.bulk.created event`,
        error.stack,
      );
    }
  }

  /**
   * Handle email configuration test events
   */
  @OnEvent('email.test')
  async handleEmailTest(data: { email: string }): Promise<void> {
    try {
      this.logger.debug(`Processing email.test event for ${data.email}`);

      const result = await this.emailNotificationService.testEmailConfiguration(
        data.email,
      );

      if (result) {
        this.logger.log(`Test email sent successfully to ${data.email}`);
      } else {
        this.logger.warn(`Test email failed to send to ${data.email}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process email.test event for ${data.email}`,
        error.stack,
      );
    }
  }
}
