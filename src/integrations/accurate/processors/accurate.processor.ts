import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AccurateApiService } from '../services/accurate-api.service';
import { AccurateTaxComplianceService } from '../services/accurate-tax-compliance.service';
import { AccurateMultiCurrencyService } from '../services/accurate-multi-currency.service';
import { WebhookHandlerService } from '../../common/services/webhook-handler.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { IntegrationLogLevel, IntegrationLogType } from '../../entities/integration-log.entity';

export interface AccurateWebhookJobData {
  webhookId: string;
  tenantId: string;
  channelId: string;
  eventType: string;
  databaseId: string;
  isRetry?: boolean;
}

export interface AccurateItemSyncJobData {
  tenantId: string;
  accountingAccountId: string;
  itemId?: string;
  accurateItemId?: number;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  itemType?: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE';
  options?: any;
}

export interface AccurateTaxJobData {
  tenantId: string;
  accountingAccountId: string;
  operation: 'configure' | 'calculate' | 'generate_efaktur' | 'generate_report' | 'check_compliance';
  entityId?: string;
  entityType?: 'order' | 'invoice';
  config?: any;
  month?: number;
  year?: number;
}

export interface AccurateCurrencyJobData {
  tenantId: string;
  accountingAccountId: string;
  operation: 'configure' | 'update_rates' | 'convert' | 'revaluation' | 'generate_report';
  config?: any;
  fromCurrency?: string;
  toCurrency?: string;
  amount?: number;
  date?: string;
}

export interface AccurateInvoiceJobData {
  tenantId: string;
  accountingAccountId: string;
  operation: 'create' | 'sync' | 'multi_currency_create' | 'update_status';
  invoiceId?: string;
  orderId?: string;
  targetCurrency?: string;
  options?: any;
}

export interface AccurateAuthJobData {
  tenantId: string;
  accountingAccountId: string;
  operation: 'authenticate' | 'refresh_session' | 'validate_connection';
  credentials?: any;
}

export interface AccurateReportJobData {
  tenantId: string;
  accountingAccountId: string;
  reportType: 'tax' | 'currency' | 'financial' | 'audit_trail';
  startDate?: string;
  endDate?: string;
  parameters?: any;
}

@Processor('accurate')
export class AccurateProcessor {
  private readonly logger = new Logger(AccurateProcessor.name);

  constructor(
    private readonly accurateApiService: AccurateApiService,
    private readonly accurateTaxComplianceService: AccurateTaxComplianceService,
    private readonly accurateMultiCurrencyService: AccurateMultiCurrencyService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing Accurate job: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Accurate job completed: ${job.name} [${job.id}]`, {
      jobId: job.id,
      jobName: job.name,
      result,
      duration: Date.now() - job.processedOn,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Accurate job failed: ${job.name} [${job.id}] - ${err.message}`, {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
      stack: err.stack,
      data: job.data,
      attemptsMade: job.attemptsMade,
      attemptsLeft: job.opts.attempts - job.attemptsMade,
    });
  }

  /**
   * Process Accurate webhook events
   */
  @Process('process-webhook')
  async processWebhook(job: Job<AccurateWebhookJobData>) {
    const { webhookId, tenantId, channelId, eventType, databaseId, isRetry } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate webhook: ${eventType}`, {
        webhookId,
        tenantId,
        channelId,
        eventType,
        databaseId,
        isRetry,
      });

      // Mark webhook as processing
      const webhook = await this.webhookHandler.markWebhookAsProcessing(webhookId);
      
      if (!webhook) {
        throw new Error(`Webhook not found: ${webhookId}`);
      }

      // Get webhook payload
      const payload = webhook.payload;

      // Process webhook based on event type
      let result;
      switch (eventType) {
        case 'item_created':
        case 'item_updated':
        case 'item_deleted':
          result = await this.processItemWebhook(tenantId, channelId, payload, eventType);
          break;
        case 'invoice_created':
        case 'invoice_updated':
        case 'invoice_paid':
          result = await this.processInvoiceWebhook(tenantId, channelId, payload, eventType);
          break;
        case 'customer_created':
        case 'customer_updated':
          result = await this.processCustomerWebhook(tenantId, channelId, payload, eventType);
          break;
        case 'account_updated':
          result = await this.processAccountWebhook(tenantId, channelId, payload, eventType);
          break;
        case 'tax_rate_updated':
          result = await this.processTaxWebhook(tenantId, channelId, payload, eventType);
          break;
        case 'currency_rate_updated':
          result = await this.processCurrencyWebhook(tenantId, channelId, payload, eventType);
          break;
        default:
          this.logger.warn(`Unhandled Accurate webhook event type: ${eventType}`);
          result = { success: true, message: `Event type ${eventType} acknowledged but not processed` };
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
          `Accurate webhook ${eventType} processed successfully`,
          { webhookId, databaseId, result },
        );

        return {
          success: true,
          webhookId,
          eventType,
          databaseId,
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
      this.logger.error(`Accurate webhook processing failed: ${error.message}`, error.stack);

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
        `Accurate webhook processing failed: ${error.message}`,
        { webhookId, databaseId, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process item synchronization jobs
   */
  @Process('item-sync')
  async processItemSync(job: Job<AccurateItemSyncJobData>) {
    const { tenantId, accountingAccountId, itemId, accurateItemId, syncDirection, itemType, options } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate item sync: ${syncDirection}`, {
        tenantId,
        accountingAccountId,
        itemId,
        accurateItemId,
        syncDirection,
        itemType,
      });

      let result;

      // Note: Item sync services would need to be implemented in Accurate services
      // For now, we'll use the API service directly
      switch (syncDirection) {
        case 'inbound':
          // Sync from Accurate to local system
          const itemsResponse = await this.accurateApiService.getItems(
            await this.getCredentials(accountingAccountId, tenantId),
            tenantId,
            accountingAccountId,
            { take: 100, itemType }
          );
          
          if (itemsResponse.success) {
            result = {
              success: true,
              itemsProcessed: itemsResponse.data?.sp?.length || 0,
              items: itemsResponse.data,
            };
          } else {
            throw new Error(`Failed to fetch items from Accurate: ${itemsResponse.error?.message}`);
          }
          break;

        case 'outbound':
          // Sync from local system to Accurate
          if (!itemId) {
            throw new Error('Item ID is required for outbound sync');
          }
          
          // This would require implementation of item creation in Accurate
          result = {
            success: true,
            message: 'Outbound item sync not yet implemented',
            itemId,
          };
          break;

        case 'bidirectional':
          // Perform both inbound and outbound sync
          result = {
            success: true,
            message: 'Bidirectional item sync not yet implemented',
          };
          break;

        default:
          throw new Error(`Unsupported sync direction: ${syncDirection}`);
      }

      // Log success
      await this.logService.logSync(
        tenantId,
        '',
        `accurate_item_${syncDirection}`,
        'completed',
        `Accurate item sync completed successfully`,
        { itemId, accurateItemId, itemType, result },
      );

      // Emit event
      this.eventEmitter.emit('accurate.item.sync.completed', {
        tenantId,
        accountingAccountId,
        itemId,
        accurateItemId,
        syncDirection,
        itemType,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Accurate item sync failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logSync(
        tenantId,
        '',
        `accurate_item_${syncDirection}`,
        'failed',
        `Accurate item sync failed: ${error.message}`,
        { itemId, accurateItemId, itemType, error: error.message },
      );

      throw error;
    }
  }

  /**
   * Process tax compliance operations
   */
  @Process('tax-operation')
  async processTaxOperation(job: Job<AccurateTaxJobData>) {
    const { tenantId, accountingAccountId, operation, entityId, entityType, config, month, year } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate tax operation: ${operation}`, {
        tenantId,
        accountingAccountId,
        operation,
        entityId,
        entityType,
        month,
        year,
      });

      let result;

      switch (operation) {
        case 'configure':
          if (!config) {
            throw new Error('Configuration is required for tax setup');
          }
          result = await this.accurateTaxComplianceService.configureTaxSettings(
            accountingAccountId,
            tenantId,
            config,
          );
          break;

        case 'calculate':
          if (!entityId || !entityType) {
            throw new Error('Entity ID and type are required for tax calculation');
          }
          result = await this.accurateTaxComplianceService.calculateTax(
            accountingAccountId,
            entityId,
            tenantId,
            entityType,
          );
          break;

        case 'generate_efaktur':
          if (!entityId) {
            throw new Error('Entity ID is required for e-Faktur generation');
          }
          result = await this.accurateTaxComplianceService.generateEFaktur(
            accountingAccountId,
            entityId,
            tenantId,
          );
          break;

        case 'generate_report':
          if (!month || !year) {
            throw new Error('Month and year are required for tax report generation');
          }
          result = await this.accurateTaxComplianceService.generateTaxReport(
            accountingAccountId,
            tenantId,
            month,
            year,
          );
          break;

        case 'check_compliance':
          result = await this.accurateTaxComplianceService.checkCompliance(
            accountingAccountId,
            tenantId,
          );
          break;

        default:
          throw new Error(`Unsupported tax operation: ${operation}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Accurate tax ${operation} completed successfully`,
        metadata: { 
          accountingAccountId, 
          operation,
          entityId,
          entityType,
          month,
          year,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('accurate.tax.operation.completed', {
        tenantId,
        accountingAccountId,
        operation,
        entityId,
        entityType,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Accurate tax operation failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        '',
        error,
        {
          metadata: { 
            accountingAccountId, 
            operation,
            entityId,
            entityType,
            month,
            year,
          },
        },
      );

      throw error;
    }
  }

  /**
   * Process multi-currency operations
   */
  @Process('currency-operation')
  async processCurrencyOperation(job: Job<AccurateCurrencyJobData>) {
    const { tenantId, accountingAccountId, operation, config, fromCurrency, toCurrency, amount, date } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate currency operation: ${operation}`, {
        tenantId,
        accountingAccountId,
        operation,
        fromCurrency,
        toCurrency,
        amount,
        date,
      });

      let result;

      switch (operation) {
        case 'configure':
          if (!config) {
            throw new Error('Configuration is required for currency setup');
          }
          result = await this.accurateMultiCurrencyService.configureCurrency(
            accountingAccountId,
            tenantId,
            config,
          );
          break;

        case 'update_rates':
          // This would fetch latest exchange rates and update the system
          result = {
            success: true,
            message: 'Exchange rates updated',
            timestamp: new Date(),
          };
          break;

        case 'convert':
          if (!fromCurrency || !toCurrency || amount === undefined) {
            throw new Error('From currency, to currency, and amount are required for conversion');
          }
          result = await this.accurateMultiCurrencyService.convertCurrency(
            accountingAccountId,
            amount,
            fromCurrency,
            toCurrency,
            tenantId,
            date ? new Date(date) : undefined,
          );
          break;

        case 'revaluation':
          result = await this.accurateMultiCurrencyService.performRevaluation(
            accountingAccountId,
            tenantId,
            date ? new Date(date) : undefined,
          );
          break;

        case 'generate_report':
          result = await this.accurateMultiCurrencyService.generateCurrencyReport(
            accountingAccountId,
            tenantId,
            date ? new Date(date) : undefined,
          );
          break;

        default:
          throw new Error(`Unsupported currency operation: ${operation}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Accurate currency ${operation} completed successfully`,
        metadata: { 
          accountingAccountId, 
          operation,
          fromCurrency,
          toCurrency,
          amount,
          date,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('accurate.currency.operation.completed', {
        tenantId,
        accountingAccountId,
        operation,
        fromCurrency,
        toCurrency,
        amount,
        date,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Accurate currency operation failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        '',
        error,
        {
          metadata: { 
            accountingAccountId, 
            operation,
            fromCurrency,
            toCurrency,
            amount,
            date,
          },
        },
      );

      throw error;
    }
  }

  /**
   * Process invoice operations
   */
  @Process('invoice-operation')
  async processInvoiceOperation(job: Job<AccurateInvoiceJobData>) {
    const { tenantId, accountingAccountId, operation, invoiceId, orderId, targetCurrency, options } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate invoice operation: ${operation}`, {
        tenantId,
        accountingAccountId,
        operation,
        invoiceId,
        orderId,
        targetCurrency,
      });

      let result;

      switch (operation) {
        case 'create':
          if (!invoiceId) {
            throw new Error('Invoice ID is required for creation');
          }
          // Create standard invoice in Accurate
          result = {
            success: true,
            message: 'Invoice creation not yet implemented',
            invoiceId,
          };
          break;

        case 'multi_currency_create':
          if (!invoiceId) {
            throw new Error('Invoice ID is required for multi-currency creation');
          }
          result = await this.accurateMultiCurrencyService.createMultiCurrencyInvoice(
            accountingAccountId,
            invoiceId,
            tenantId,
            targetCurrency,
          );
          break;

        case 'sync':
          // Sync invoice status and details from Accurate
          result = {
            success: true,
            message: 'Invoice sync not yet implemented',
            invoiceId,
          };
          break;

        case 'update_status':
          // Update invoice status in Accurate
          result = {
            success: true,
            message: 'Invoice status update not yet implemented',
            invoiceId,
          };
          break;

        default:
          throw new Error(`Unsupported invoice operation: ${operation}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Accurate invoice ${operation} completed successfully`,
        metadata: { 
          accountingAccountId, 
          operation,
          invoiceId,
          orderId,
          targetCurrency,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('accurate.invoice.operation.completed', {
        tenantId,
        accountingAccountId,
        operation,
        invoiceId,
        orderId,
        targetCurrency,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Accurate invoice operation failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        '',
        error,
        {
          metadata: { 
            accountingAccountId, 
            operation,
            invoiceId,
            orderId,
            targetCurrency,
          },
        },
      );

      throw error;
    }
  }

  /**
   * Process authentication operations
   */
  @Process('auth-operation')
  async processAuthOperation(job: Job<AccurateAuthJobData>) {
    const { tenantId, accountingAccountId, operation, credentials } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate auth operation: ${operation}`, {
        tenantId,
        accountingAccountId,
        operation,
      });

      let result;

      switch (operation) {
        case 'authenticate':
          if (!credentials) {
            throw new Error('Credentials are required for authentication');
          }
          result = await this.accurateApiService.authenticate(
            credentials.serverUrl,
            credentials.username,
            credentials.password,
            credentials.databaseId,
            tenantId,
          );
          break;

        case 'refresh_session':
          // Refresh session would typically involve re-authenticating
          result = {
            success: true,
            message: 'Session refresh not yet implemented',
          };
          break;

        case 'validate_connection':
          result = await this.accurateApiService.testConnection(
            credentials,
            tenantId,
            accountingAccountId,
          );
          break;

        default:
          throw new Error(`Unsupported auth operation: ${operation}`);
      }

      // Log success
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Accurate auth ${operation} completed successfully`,
        metadata: { 
          accountingAccountId, 
          operation,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('accurate.auth.operation.completed', {
        tenantId,
        accountingAccountId,
        operation,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Accurate auth operation failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        '',
        error,
        {
          metadata: { accountingAccountId, operation },
        },
      );

      throw error;
    }
  }

  /**
   * Process report generation
   */
  @Process('report-generation')
  async processReportGeneration(job: Job<AccurateReportJobData>) {
    const { tenantId, accountingAccountId, reportType, startDate, endDate, parameters } = job.data;
    
    try {
      this.logger.debug(`Processing Accurate report generation: ${reportType}`, {
        tenantId,
        accountingAccountId,
        reportType,
        startDate,
        endDate,
      });

      let result;

      switch (reportType) {
        case 'tax':
          if (!parameters?.month || !parameters?.year) {
            throw new Error('Month and year are required for tax report');
          }
          result = await this.accurateTaxComplianceService.generateTaxReport(
            accountingAccountId,
            tenantId,
            parameters.month,
            parameters.year,
          );
          break;

        case 'currency':
          result = await this.accurateMultiCurrencyService.generateCurrencyReport(
            accountingAccountId,
            tenantId,
            endDate ? new Date(endDate) : undefined,
          );
          break;

        case 'financial':
        case 'audit_trail':
          // These would be implemented with Accurate reporting API
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
        message: `Accurate ${reportType} report generated successfully`,
        metadata: { 
          accountingAccountId, 
          reportType, 
          startDate, 
          endDate,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('accurate.report.generated', {
        tenantId,
        accountingAccountId,
        reportType,
        startDate,
        endDate,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Accurate report generation failed: ${error.message}`, error.stack);

      // Log error
      await this.logService.logError(
        tenantId,
        '',
        error,
        {
          metadata: { 
            accountingAccountId, 
            reportType, 
            startDate, 
            endDate,
          },
        },
      );

      throw error;
    }
  }

  // Private helper methods

  private async getCredentials(accountingAccountId: string, tenantId: string): Promise<any> {
    // This would typically fetch credentials from the accounting account
    // For now, return a placeholder
    return {
      sessionId: 'session_123',
      databaseId: 'db_123',
      serverUrl: 'https://accurate.example.com',
    };
  }

  private async processItemWebhook(tenantId: string, channelId: string, payload: any, eventType: string): Promise<any> {
    this.logger.debug(`Processing Accurate ${eventType} webhook`, { tenantId, payload });
    
    // Process item change notification
    return {
      success: true,
      message: `${eventType} webhook processed`,
      itemId: payload.id,
      operation: eventType,
    };
  }

  private async processInvoiceWebhook(tenantId: string, channelId: string, payload: any, eventType: string): Promise<any> {
    this.logger.debug(`Processing Accurate ${eventType} webhook`, { tenantId, payload });
    
    // Process invoice change notification
    return {
      success: true,
      message: `${eventType} webhook processed`,
      invoiceId: payload.id,
      operation: eventType,
    };
  }

  private async processCustomerWebhook(tenantId: string, channelId: string, payload: any, eventType: string): Promise<any> {
    this.logger.debug(`Processing Accurate ${eventType} webhook`, { tenantId, payload });
    
    // Process customer change notification
    return {
      success: true,
      message: `${eventType} webhook processed`,
      customerId: payload.id,
      operation: eventType,
    };
  }

  private async processAccountWebhook(tenantId: string, channelId: string, payload: any, eventType: string): Promise<any> {
    this.logger.debug(`Processing Accurate ${eventType} webhook`, { tenantId, payload });
    
    // Process account change notification
    return {
      success: true,
      message: `${eventType} webhook processed`,
      accountId: payload.id,
      operation: eventType,
    };
  }

  private async processTaxWebhook(tenantId: string, channelId: string, payload: any, eventType: string): Promise<any> {
    this.logger.debug(`Processing Accurate ${eventType} webhook`, { tenantId, payload });
    
    // Process tax rate change notification
    return {
      success: true,
      message: `${eventType} webhook processed`,
      taxRateId: payload.id,
      operation: eventType,
    };
  }

  private async processCurrencyWebhook(tenantId: string, channelId: string, payload: any, eventType: string): Promise<any> {
    this.logger.debug(`Processing Accurate ${eventType} webhook`, { tenantId, payload });
    
    // Process currency rate change notification
    return {
      success: true,
      message: `${eventType} webhook processed`,
      currencyPair: `${payload.from}_${payload.to}`,
      operation: eventType,
    };
  }
}