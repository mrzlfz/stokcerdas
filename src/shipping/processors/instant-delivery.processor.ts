import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Services
import { InstantDeliveryService } from '../services/instant-delivery.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../integrations/entities/integration-log.entity';

// Job Interfaces
interface UpdateTrackingJob {
  tenantId: string;
  trackingNumber: string;
  provider: 'gojek' | 'grab';
}

interface SyncDeliveryStatusJob {
  tenantId: string;
  deliveryIds: string[];
  provider: 'gojek' | 'grab';
}

interface NotifyDeliveryUpdateJob {
  tenantId: string;
  trackingNumber: string;
  provider: 'gojek' | 'grab';
  status: string;
  customerPhone?: string;
  customerEmail?: string;
}

interface CleanupOldTrackingJob {
  tenantId: string;
  olderThanDays: number;
}

interface GenerateDeliveryReportJob {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  provider?: 'gojek' | 'grab';
  reportType: 'summary' | 'detailed' | 'analytics';
}

@Processor('instant-delivery')
export class InstantDeliveryProcessor {
  private readonly logger = new Logger(InstantDeliveryProcessor.name);

  constructor(
    private readonly instantDeliveryService: InstantDeliveryService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('update-tracking')
  async handleUpdateTracking(job: Job<UpdateTrackingJob>) {
    const { tenantId, trackingNumber, provider } = job.data;

    try {
      this.logger.debug(
        `Processing tracking update for ${trackingNumber} (${provider})`,
      );

      await this.instantDeliveryService.updateInstantDeliveryTracking(
        tenantId,
        trackingNumber,
        provider,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `Tracking updated successfully for ${trackingNumber}`,
        metadata: {
          trackingNumber,
          provider,
          jobId: job.id,
        },
      });

      return { success: true, trackingNumber, provider };
    } catch (error) {
      this.logger.error(
        `Failed to update tracking for ${trackingNumber}: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Failed to update tracking for ${trackingNumber}: ${error.message}`,
        metadata: {
          trackingNumber,
          provider,
          error: error.message,
          jobId: job.id,
        },
      });

      throw error;
    }
  }

  @Process('sync-delivery-status')
  async handleSyncDeliveryStatus(job: Job<SyncDeliveryStatusJob>) {
    const { tenantId, deliveryIds, provider } = job.data;

    try {
      this.logger.debug(
        `Processing bulk delivery status sync for ${deliveryIds.length} deliveries`,
      );

      const results = [];

      for (const deliveryId of deliveryIds) {
        try {
          await this.instantDeliveryService.updateInstantDeliveryTracking(
            tenantId,
            deliveryId,
            provider,
          );
          results.push({ deliveryId, success: true });
        } catch (error) {
          this.logger.warn(
            `Failed to sync delivery ${deliveryId}: ${error.message}`,
          );
          results.push({ deliveryId, success: false, error: error.message });
        }
      }

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `Bulk delivery status sync completed for ${provider}`,
        metadata: {
          provider,
          totalDeliveries: deliveryIds.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
          jobId: job.id,
        },
      });

      return { success: true, results };
    } catch (error) {
      this.logger.error(
        `Failed to sync delivery status: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Failed to sync delivery status: ${error.message}`,
        metadata: {
          provider,
          deliveryIds,
          error: error.message,
          jobId: job.id,
        },
      });

      throw error;
    }
  }

  @Process('notify-delivery-update')
  async handleNotifyDeliveryUpdate(job: Job<NotifyDeliveryUpdateJob>) {
    const {
      tenantId,
      trackingNumber,
      provider,
      status,
      customerPhone,
      customerEmail,
    } = job.data;

    try {
      this.logger.debug(
        `Processing delivery update notification for ${trackingNumber}`,
      );

      // Emit event for notification services to handle
      this.eventEmitter.emit('instant.delivery.notification.requested', {
        tenantId,
        trackingNumber,
        provider,
        status,
        customerPhone,
        customerEmail,
        channels: ['sms', 'email', 'push'], // Send via multiple channels
      });

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `Delivery update notification sent for ${trackingNumber}`,
        metadata: {
          trackingNumber,
          provider,
          status,
          hasPhone: !!customerPhone,
          hasEmail: !!customerEmail,
          jobId: job.id,
        },
      });

      return { success: true, trackingNumber, status };
    } catch (error) {
      this.logger.error(
        `Failed to send delivery notification: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Failed to send delivery notification: ${error.message}`,
        metadata: {
          trackingNumber,
          provider,
          status,
          error: error.message,
          jobId: job.id,
        },
      });

      throw error;
    }
  }

  @Process('cleanup-old-tracking')
  async handleCleanupOldTracking(job: Job<CleanupOldTrackingJob>) {
    const { tenantId, olderThanDays } = job.data;

    try {
      this.logger.debug(
        `Processing cleanup of tracking data older than ${olderThanDays} days`,
      );

      // This would be implemented in the instant delivery service
      // For now, we'll just log the cleanup request
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `Cleanup job executed for tracking data older than ${olderThanDays} days`,
        metadata: {
          olderThanDays,
          cutoffDate: cutoffDate.toISOString(),
          jobId: job.id,
        },
      });

      return { success: true, cutoffDate, olderThanDays };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old tracking data: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Failed to cleanup old tracking data: ${error.message}`,
        metadata: {
          olderThanDays,
          error: error.message,
          jobId: job.id,
        },
      });

      throw error;
    }
  }

  @Process('generate-delivery-report')
  async handleGenerateDeliveryReport(job: Job<GenerateDeliveryReportJob>) {
    const { tenantId, dateFrom, dateTo, provider, reportType } = job.data;

    try {
      this.logger.debug(
        `Processing delivery report generation: ${reportType} for ${
          provider || 'all providers'
        }`,
      );

      // This would generate actual reports - for now we'll emit an event
      this.eventEmitter.emit('instant.delivery.report.requested', {
        tenantId,
        dateFrom,
        dateTo,
        provider,
        reportType,
        jobId: job.id,
      });

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `Delivery report generation requested: ${reportType}`,
        metadata: {
          dateFrom,
          dateTo,
          provider: provider || 'all',
          reportType,
          jobId: job.id,
        },
      });

      return { success: true, reportType, provider, dateFrom, dateTo };
    } catch (error) {
      this.logger.error(
        `Failed to generate delivery report: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Failed to generate delivery report: ${error.message}`,
        metadata: {
          reportType,
          provider,
          dateFrom,
          dateTo,
          error: error.message,
          jobId: job.id,
        },
      });

      throw error;
    }
  }

  @Process('webhook-processing')
  async handleWebhookProcessing(
    job: Job<{
      tenantId: string;
      provider: 'gojek' | 'grab';
      webhookData: any;
      signature?: string;
    }>,
  ) {
    const { tenantId, provider, webhookData, signature } = job.data;

    try {
      this.logger.debug(
        `Processing ${provider} webhook for tenant ${tenantId}`,
      );

      // Verify webhook signature if provided
      if (signature) {
        // Implement signature verification logic here
        this.logger.debug(`Webhook signature verification for ${provider}`);
      }

      // Process webhook data based on provider
      let trackingNumber: string;
      let status: string;

      if (provider === 'gojek') {
        trackingNumber = webhookData.trackingNumber || webhookData.orderId;
        status = webhookData.status;
      } else if (provider === 'grab') {
        trackingNumber = webhookData.deliveryID;
        status = webhookData.status;
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      if (trackingNumber) {
        // Update tracking information
        await this.instantDeliveryService.updateInstantDeliveryTracking(
          tenantId,
          trackingNumber,
          provider,
        );

        // Emit webhook event
        this.eventEmitter.emit('instant.delivery.webhook.processed', {
          tenantId,
          provider,
          trackingNumber,
          status,
          webhookData,
        });
      }

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `${provider} webhook processed successfully`,
        metadata: {
          provider,
          trackingNumber,
          status,
          hasSignature: !!signature,
          jobId: job.id,
        },
      });

      return { success: true, provider, trackingNumber, status };
    } catch (error) {
      this.logger.error(
        `Failed to process ${provider} webhook: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Failed to process ${provider} webhook: ${error.message}`,
        metadata: {
          provider,
          webhookData,
          error: error.message,
          jobId: job.id,
        },
      });

      throw error;
    }
  }

  @Process('retry-failed-operation')
  async handleRetryFailedOperation(
    job: Job<{
      tenantId: string;
      operation: 'create' | 'update' | 'cancel';
      operationData: any;
      provider: 'gojek' | 'grab';
      originalJobId?: string;
      retryCount: number;
    }>,
  ) {
    const {
      tenantId,
      operation,
      operationData,
      provider,
      originalJobId,
      retryCount,
    } = job.data;

    try {
      this.logger.debug(
        `Retrying failed ${operation} operation for ${provider} (attempt ${retryCount})`,
      );

      let result;

      switch (operation) {
        case 'create':
          result = await this.instantDeliveryService.createInstantDelivery(
            tenantId,
            operationData,
          );
          break;
        case 'update':
          result =
            await this.instantDeliveryService.updateInstantDeliveryTracking(
              tenantId,
              operationData.trackingNumber,
              provider,
            );
          break;
        case 'cancel':
          result = await this.instantDeliveryService.cancelInstantDelivery(
            tenantId,
            operationData.trackingNumber,
            provider,
            operationData.reason,
          );
          break;
        default:
          throw new Error(`Unsupported retry operation: ${operation}`);
      }

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.INFO,
        message: `Failed ${operation} operation retried successfully`,
        metadata: {
          operation,
          provider,
          retryCount,
          originalJobId,
          jobId: job.id,
        },
      });

      // Emit success event
      this.eventEmitter.emit('instant.delivery.retry.succeeded', {
        tenantId,
        operation,
        provider,
        retryCount,
        result,
      });

      return { success: true, operation, provider, retryCount, result };
    } catch (error) {
      this.logger.error(
        `Retry attempt ${retryCount} failed for ${operation}: ${error.message}`,
        error.stack,
      );

      await this.logService.log({
        tenantId,
        type: IntegrationLogType.INSTANT_DELIVERY_PROCESSOR,
        level: IntegrationLogLevel.ERROR,
        message: `Retry attempt ${retryCount} failed for ${operation}: ${error.message}`,
        metadata: {
          operation,
          provider,
          retryCount,
          originalJobId,
          error: error.message,
          jobId: job.id,
        },
      });

      // Emit failure event if this was the final retry
      if (retryCount >= 3) {
        this.eventEmitter.emit('instant.delivery.retry.exhausted', {
          tenantId,
          operation,
          provider,
          retryCount,
          finalError: error.message,
        });
      }

      throw error;
    }
  }
}
