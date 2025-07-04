import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { QuickBooksApiService } from '../services/quickbooks-api.service';
import { QuickBooksItemSyncService } from '../services/quickbooks-item-sync.service';
import { QuickBooksCOGSService } from '../services/quickbooks-cogs.service';
import { QuickBooksInvoiceService } from '../services/quickbooks-invoice.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';

export interface QuickBooksWebhookJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  realmId: string;
  isRetry?: boolean;
}

export interface QuickBooksItemSyncJobData {
  tenantId: string;
  accountingAccountId: string;
  itemId?: string;
  quickBooksItemId?: string;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  options?: any;
}

export interface QuickBooksCOGSJobData {
  tenantId: string;
  accountingAccountId: string;
  startDate: string;
  endDate: string;
  config: any;
  autoPost?: boolean;
}

export interface QuickBooksInvoiceJobData {
  tenantId: string;
  accountingAccountId: string;
  orderId?: string;
  orderIds?: string[];
  invoiceId?: string;
  operation: 'generate' | 'batch_generate' | 'sync_status' | 'update';
  options?: any;
}

export interface QuickBooksAuthJobData {
  tenantId: string;
  accountingAccountId: string;
  operation: 'refresh_token' | 'validate_connection' | 'reconnect';
  credentials?: any;
}

export interface QuickBooksReportJobData {
  tenantId: string;
  accountingAccountId: string;
  reportType: 'cogs' | 'inventory_valuation' | 'profit_loss' | 'balance_sheet';
  startDate?: string;
  endDate?: string;
  parameters?: any;
}

@Processor('quickbooks')
export class QuickBooksProcessor {
  private readonly logger = new Logger(QuickBooksProcessor.name);

  constructor(
    private readonly quickBooksApiService: QuickBooksApiService,
    private readonly quickBooksItemSyncService: QuickBooksItemSyncService,
    private readonly quickBooksCOGSService: QuickBooksCOGSService,
    private readonly quickBooksInvoiceService: QuickBooksInvoiceService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing QuickBooks job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`QuickBooks job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `QuickBooks job failed: ${job.name} [${job.id}] - ${err.message}`,
      {
        jobId: job.id,
        jobName: job.name,
        error: err.message,
        stack: err.stack,
        data: job.data,
        attemptsMade: job.attemptsMade,
        attemptsLeft: job.opts.attempts - job.attemptsMade,
      },
    );
  }

  /**
   * Process QuickBooks webhook events
   */
  @Process('process-webhook')
  async processWebhook(job: Job<QuickBooksWebhookJobData>) {
    const { webhookId, tenantId, channelId, eventType, realmId, isRetry } =
      job.data;

    try {
      this.logger.debug(`Processing QuickBooks webhook: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
        realmId,
        isRetry,
      });

      // Mark webhook as processing
      const webhook = await this.webhookHandler.markWebhookAsProcessing(
        webhookId,
      );

      if (!webhook) {
        throw new Error(`Webhook not found: ${webhookId}`);
      }

      // Get webhook payload
      const payload = webhook.payload;

      // Process webhook based on event type
      let result;
      switch (eventType) {
        case 'Item':
          result = await this.processItemWebhook(tenantId, channelId, payload);
          break;
        case 'Invoice':
          result = await this.processInvoiceWebhook(
            tenantId,
            channelId,
            payload,
          );
          break;
        case 'Customer':
          result = await this.processCustomerWebhook(
            tenantId,
            channelId,
            payload,
          );
          break;
        case 'Account':
          result = await this.processAccountWebhook(
            tenantId,
            channelId,
            payload,
          );
          break;
        default:
          this.logger.warn(
            `Unhandled QuickBooks webhook event type: ${eventType}`,
          );
          result = {
            success: true,
            message: `Event type ${eventType} acknowledged but not processed`,
          };
      }

      if (result.success) {
        // Mark webhook as processed
        await this.webhookHandler.markWebhookAsProcessed(webhookId, {
          processedAt: new Date(),
          processingResult: result,
        });

        // Log success
        await this.logService.logWebhook(
          tenantId,
          channelId,
          eventType,
          'processed',
          `QuickBooks webhook ${eventType} processed successfully`,
          { webhookId, realmId, result },
        );

        return {
          success: true,
          webhookId,
          eventType,
          realmId,
          result,
        };
      } else {
        // Mark webhook as failed
        await this.webhookHandler.markWebhookAsFailed(
          webhookId,
          result.error || 'Processing failed',
          true, // Schedule retry
        );

        throw new Error(result.error || 'Webhook processing failed');
      }
    } catch (error) {
      this.logger.error(
        `QuickBooks webhook processing failed: ${error.message}`,
        error.stack,
      );

      // Mark webhook as failed
      await this.webhookHandler.markWebhookAsFailed(
        webhookId,
        error.message,
        !isRetry, // Don't retry if this is already a retry
      );

      // Log error
      await this.logService.logWebhook(
        tenantId,
        channelId,
        eventType,
        'failed',
        `QuickBooks webhook processing failed: ${error.message}`,
        { webhookId, realmId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process item synchronization jobs
   */
  @Process('item-sync')
  async processItemSync(job: Job<QuickBooksItemSyncJobData>) {
    const {
      tenantId,
      accountingAccountId,
      itemId,
      quickBooksItemId,
      syncDirection,
      options,
    } = job.data;

    try {
      this.logger.debug(`Processing QuickBooks item sync: ${syncDirection}`, {
        tenantId,
        accountingAccountId,
        itemId,
        quickBooksItemId,
        syncDirection,
      });

      let result;

      switch (syncDirection) {
        case 'inbound':
          result = await this.quickBooksItemSyncService.syncFromQuickBooks(
            accountingAccountId,
            tenantId,
            options || {
              itemIds: quickBooksItemId ? [quickBooksItemId] : undefined,
            },
          );
          break;

        case 'outbound':
          result = await this.quickBooksItemSyncService.syncToQuickBooks(
            accountingAccountId,
            tenantId,
            options || { productIds: itemId ? [itemId] : undefined },
          );
          break;

        case 'bidirectional':
          result = await this.quickBooksItemSyncService.bidirectionalSync(
            accountingAccountId,
            tenantId,
            options || {},
          );
          break;

        default:
          throw new Error(`Unsupported sync direction: ${syncDirection}`);
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        '', // channelId not applicable for accounting
        `quickbooks_item_${syncDirection}`,
        'completed',
        `QuickBooks item sync completed successfully`,
        { itemId, quickBooksItemId, result },
      );

      // Emit event
      this.eventEmitter.emit('quickbooks.item.sync.completed', {
        tenantId,
        accountingAccountId,
        itemId,
        quickBooksItemId,
        syncDirection,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `QuickBooks item sync failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logSync(
        tenantId,
        '',
        `quickbooks_item_${syncDirection}`,
        'failed',
        `QuickBooks item sync failed: ${error.message}`,
        { itemId, quickBooksItemId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process COGS calculation jobs
   */
  @Process('cogs-calculation')
  async processCOGSCalculation(job: Job<QuickBooksCOGSJobData>) {
    const {
      tenantId,
      accountingAccountId,
      startDate,
      endDate,
      config,
      autoPost,
    } = job.data;

    try {
      this.logger.debug(`Processing QuickBooks COGS calculation`, {
        tenantId,
        accountingAccountId,
        startDate,
        endDate,
        autoPost,
      });

      const result = await this.quickBooksCOGSService.calculateAndPostCOGS(
        accountingAccountId,
        tenantId,
        new Date(startDate),
        new Date(endDate),
        config,
      );

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `QuickBooks COGS calculation completed`,
        metadata: {
          accountingAccountId,
          startDate,
          endDate,
          result,
          entriesPosted: result.entriesPosted,
          totalCOGS: result.totalCOGS,
        },
      });

      // Emit event
      this.eventEmitter.emit('quickbooks.cogs.calculated', {
        tenantId,
        accountingAccountId,
        startDate,
        endDate,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `QuickBooks COGS calculation failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, '', error, {
        metadata: { accountingAccountId, startDate, endDate },
      });

      throw error;
    }
  }

  /**
   * Process invoice operations
   */
  @Process('invoice-operation')
  async processInvoiceOperation(job: Job<QuickBooksInvoiceJobData>) {
    const {
      tenantId,
      accountingAccountId,
      orderId,
      orderIds,
      invoiceId,
      operation,
      options,
    } = job.data;

    try {
      this.logger.debug(
        `Processing QuickBooks invoice operation: ${operation}`,
        {
          tenantId,
          accountingAccountId,
          orderId,
          orderIds,
          invoiceId,
          operation,
        },
      );

      let result;

      switch (operation) {
        case 'generate':
          if (!orderId) {
            throw new Error('Order ID is required for invoice generation');
          }
          result = await this.quickBooksInvoiceService.generateInvoiceFromOrder(
            accountingAccountId,
            orderId,
            tenantId,
            options || {},
          );
          break;

        case 'batch_generate':
          if (!orderIds || orderIds.length === 0) {
            throw new Error(
              'Order IDs are required for batch invoice generation',
            );
          }
          result = await this.quickBooksInvoiceService.generateInvoiceBatch(
            accountingAccountId,
            orderIds,
            tenantId,
            options || {},
          );
          break;

        case 'sync_status':
          if (!invoiceId) {
            throw new Error('Invoice ID is required for status sync');
          }
          result = await this.quickBooksInvoiceService.syncInvoiceStatus(
            accountingAccountId,
            invoiceId,
            tenantId,
          );
          break;

        case 'update':
          if (!invoiceId) {
            throw new Error('Invoice ID is required for update');
          }
          // TODO: Implement updateInvoiceInQuickBooks method
          throw new Error('Invoice update not yet implemented');
          break;

        default:
          throw new Error(`Unsupported invoice operation: ${operation}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `QuickBooks invoice ${operation} completed successfully`,
        metadata: {
          accountingAccountId,
          orderId,
          orderIds,
          invoiceId,
          operation,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('quickbooks.invoice.operation.completed', {
        tenantId,
        accountingAccountId,
        orderId,
        orderIds,
        invoiceId,
        operation,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `QuickBooks invoice operation failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, '', error, {
        metadata: {
          accountingAccountId,
          orderId,
          orderIds,
          invoiceId,
          operation,
        },
      });

      throw error;
    }
  }

  /**
   * Process authentication operations
   */
  @Process('auth-operation')
  async processAuthOperation(job: Job<QuickBooksAuthJobData>) {
    const { tenantId, accountingAccountId, operation, credentials } = job.data;

    try {
      this.logger.debug(`Processing QuickBooks auth operation: ${operation}`, {
        tenantId,
        accountingAccountId,
        operation,
      });

      let result;

      switch (operation) {
        case 'refresh_token':
          result = await this.quickBooksApiService.refreshAccessToken(
            credentials,
            tenantId,
          );
          break;

        case 'validate_connection':
          result = await this.quickBooksApiService.testConnection(
            credentials,
            tenantId,
            accountingAccountId, // Use as channelId
          );
          break;

        case 'reconnect':
          // This would involve re-authenticating the user
          result = { success: true, message: 'Reconnection initiated' };
          break;

        default:
          throw new Error(`Unsupported auth operation: ${operation}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `QuickBooks auth ${operation} completed successfully`,
        metadata: {
          accountingAccountId,
          operation,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('quickbooks.auth.operation.completed', {
        tenantId,
        accountingAccountId,
        operation,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `QuickBooks auth operation failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, '', error, {
        metadata: { accountingAccountId, operation },
      });

      throw error;
    }
  }

  /**
   * Process report generation
   */
  @Process('report-generation')
  async processReportGeneration(job: Job<QuickBooksReportJobData>) {
    const {
      tenantId,
      accountingAccountId,
      reportType,
      startDate,
      endDate,
      parameters,
    } = job.data;

    try {
      this.logger.debug(
        `Processing QuickBooks report generation: ${reportType}`,
        {
          tenantId,
          accountingAccountId,
          reportType,
          startDate,
          endDate,
        },
      );

      let result;

      switch (reportType) {
        case 'cogs':
          if (!startDate || !endDate) {
            throw new Error(
              'Start date and end date are required for COGS report',
            );
          }
          result = await this.quickBooksCOGSService.generateCOGSReport(
            tenantId,
            new Date(startDate),
            new Date(endDate),
            parameters || {},
          );
          break;

        case 'inventory_valuation':
        case 'profit_loss':
        case 'balance_sheet':
          // These would be implemented with QuickBooks reporting API
          result = {
            success: true,
            message: `${reportType} report generation not yet implemented`,
            reportType,
            startDate,
            endDate,
          };
          break;

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `QuickBooks ${reportType} report generated successfully`,
        metadata: {
          accountingAccountId,
          reportType,
          startDate,
          endDate,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('quickbooks.report.generated', {
        tenantId,
        accountingAccountId,
        reportType,
        startDate,
        endDate,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `QuickBooks report generation failed: ${error.message}`,
        error.stack,
      );

      // Log error
      await this.logService.logError(tenantId, '', error, {
        metadata: {
          accountingAccountId,
          reportType,
          startDate,
          endDate,
        },
      });

      throw error;
    }
  }

  // Private helper methods for webhook processing

  private async processItemWebhook(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    this.logger.debug(`Processing QuickBooks Item webhook`, {
      tenantId,
      payload,
    });

    // Process item change notification
    // This could trigger a sync or update local item data
    return {
      success: true,
      message: 'Item webhook processed',
      itemId: payload.id,
      operation: payload.operation,
    };
  }

  private async processInvoiceWebhook(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    this.logger.debug(`Processing QuickBooks Invoice webhook`, {
      tenantId,
      payload,
    });

    // Process invoice change notification
    // This could trigger status updates in local system
    return {
      success: true,
      message: 'Invoice webhook processed',
      invoiceId: payload.id,
      operation: payload.operation,
    };
  }

  private async processCustomerWebhook(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    this.logger.debug(`Processing QuickBooks Customer webhook`, {
      tenantId,
      payload,
    });

    // Process customer change notification
    return {
      success: true,
      message: 'Customer webhook processed',
      customerId: payload.id,
      operation: payload.operation,
    };
  }

  private async processAccountWebhook(
    tenantId: string,
    channelId: string,
    payload: any,
  ): Promise<any> {
    this.logger.debug(`Processing QuickBooks Account webhook`, {
      tenantId,
      payload,
    });

    // Process account change notification
    return {
      success: true,
      message: 'Account webhook processed',
      accountId: payload.id,
      operation: payload.operation,
    };
  }
}
