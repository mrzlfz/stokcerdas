import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between, LessThanOrEqual, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';

import { WebhookEvent, WebhookEventType, WebhookProcessingStatus, WebhookPriority } from '../../entities/webhook-event.entity';
import { IntegrationLogService } from './integration-log.service';
import { RateLimiterService } from './rate-limiter.service';

export interface WebhookPayload {
  tenantId: string;
  channelId: string;
  eventType: WebhookEventType;
  eventSource: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  rawPayload?: string;
  signatureHeader?: string;
  ipAddress?: string;
  userAgent?: string;
  webhookUrl?: string;
  eventTimestamp?: Date;
  externalEventId?: string;
  priority?: WebhookPriority;
}

export interface WebhookConfig {
  platform: string;
  signatureHeader: string;
  secretKey: string;
  signatureAlgorithm: 'sha256' | 'sha1';
  signatureFormat: 'hex' | 'base64';
  includeHeaders?: string[];
  maxRetries?: number;
  retryDelay?: number;
}

export interface WebhookVerificationResult {
  verified: boolean;
  error?: string;
}

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookRepository: Repository<WebhookEvent>,
    private readonly logService: IntegrationLogService,
    private readonly rateLimiter: RateLimiterService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('integrations') private readonly integrationQueue: Queue,
  ) {}

  /**
   * Process incoming webhook
   */
  async processWebhook(
    webhookData: WebhookPayload,
    config?: WebhookConfig,
  ): Promise<{ success: boolean; webhookId?: string; error?: string }> {
    const startTime = Date.now();
    let webhookEvent: WebhookEvent;

    try {
      // Check rate limits for webhook processing
      const rateLimitKey = `webhook:${webhookData.channelId}`;
      const rateLimit = await this.rateLimiter.checkRateLimit(rateLimitKey, {
        windowSizeMs: 60000, // 1 minute
        maxRequests: 100,
        keyPrefix: 'webhook_rate_limit',
      });

      if (!rateLimit.allowed) {
        await this.logService.logWebhook(
          webhookData.tenantId,
          webhookData.channelId,
          webhookData.eventType,
          'failed',
          'Rate limit exceeded',
          { rateLimitInfo: rateLimit },
        );

        return {
          success: false,
          error: 'Rate limit exceeded',
        };
      }

      // Verify webhook signature if config provided
      if (config) {
        const verification = await this.verifyWebhookSignature(
          webhookData.rawPayload || JSON.stringify(webhookData.payload),
          webhookData.signatureHeader || '',
          config,
        );

        if (!verification.verified) {
          await this.logService.logWebhook(
            webhookData.tenantId,
            webhookData.channelId,
            webhookData.eventType,
            'failed',
            `Signature verification failed: ${verification.error}`,
          );

          return {
            success: false,
            error: 'Invalid webhook signature',
          };
        }
      }

      // Check for duplicate webhooks
      const existingWebhook = await this.findDuplicateWebhook(webhookData);
      if (existingWebhook) {
        existingWebhook.markAsDuplicate();
        await this.webhookRepository.save(existingWebhook);

        return {
          success: true,
          webhookId: existingWebhook.id,
        };
      }

      // Create webhook event record
      webhookEvent = await this.createWebhookEvent(webhookData, config);

      // Log webhook received
      await this.logService.logWebhook(
        webhookData.tenantId,
        webhookData.channelId,
        webhookData.eventType,
        'received',
        `Webhook received from ${webhookData.eventSource}`,
        {
          webhookId: webhookEvent.id,
          eventType: webhookData.eventType,
          payload: webhookData.payload,
        },
      );

      // Emit event for real-time processing
      this.eventEmitter.emit('webhook.received', {
        webhookId: webhookEvent.id,
        tenantId: webhookData.tenantId,
        channelId: webhookData.channelId,
        eventType: webhookData.eventType,
        eventSource: webhookData.eventSource,
        payload: webhookData.payload,
      });

      // Queue webhook for processing
      await this.queueWebhookProcessing(webhookEvent);

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        webhookId: webhookEvent.id,
      };

    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);

      if (webhookEvent) {
        webhookEvent.markAsFailed(error.message);
        await this.webhookRepository.save(webhookEvent);
      }

      await this.logService.logWebhook(
        webhookData.tenantId,
        webhookData.channelId,
        webhookData.eventType,
        'failed',
        error.message,
        { error: error.stack },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string,
    config: WebhookConfig,
  ): Promise<WebhookVerificationResult> {
    try {
      if (!signature) {
        return {
          verified: false,
          error: 'Missing signature header',
        };
      }

      // Generate expected signature
      const hmac = crypto.createHmac(config.signatureAlgorithm, config.secretKey);
      hmac.update(payload);
      
      const expectedSignature = config.signatureFormat === 'base64'
        ? hmac.digest('base64')
        : hmac.digest('hex');

      // Extract actual signature (remove prefix if present)
      const actualSignature = signature.replace(/^(sha256=|sha1=)/, '');

      // Use timing-safe comparison
      const verified = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(actualSignature),
      );

      return { verified };

    } catch (error) {
      this.logger.error(`Webhook signature verification error: ${error.message}`);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Create webhook event record
   */
  private async createWebhookEvent(
    webhookData: WebhookPayload,
    config?: WebhookConfig,
  ): Promise<WebhookEvent> {
    const webhookEvent = this.webhookRepository.create({
      tenantId: webhookData.tenantId,
      channelId: webhookData.channelId,
      eventType: webhookData.eventType,
      eventSource: webhookData.eventSource,
      externalEventId: webhookData.externalEventId,
      payload: webhookData.payload,
      headers: webhookData.headers,
      rawPayload: webhookData.rawPayload,
      signatureHeader: webhookData.signatureHeader,
      signatureVerified: !!config,
      priority: webhookData.priority || WebhookPriority.NORMAL,
      webhookUrl: webhookData.webhookUrl,
      ipAddress: webhookData.ipAddress,
      userAgent: webhookData.userAgent,
      eventTimestamp: webhookData.eventTimestamp,
      maxAttempts: config?.maxRetries || 5,
    });

    return await this.webhookRepository.save(webhookEvent);
  }

  /**
   * Find duplicate webhook
   */
  private async findDuplicateWebhook(
    webhookData: WebhookPayload,
  ): Promise<WebhookEvent | null> {
    if (!webhookData.externalEventId) {
      return null;
    }

    // Look for webhooks with same external event ID in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return await this.webhookRepository.findOne({
      where: {
        tenantId: webhookData.tenantId,
        channelId: webhookData.channelId,
        externalEventId: webhookData.externalEventId,
        eventType: webhookData.eventType,
        createdAt: MoreThan(oneHourAgo),
      },
    });
  }

  /**
   * Queue webhook for processing
   */
  private async queueWebhookProcessing(webhookEvent: WebhookEvent): Promise<void> {
    const jobData = {
      webhookId: webhookEvent.id,
      tenantId: webhookEvent.tenantId,
      channelId: webhookEvent.channelId,
      eventType: webhookEvent.eventType,
      eventSource: webhookEvent.eventSource,
    };

    const jobOptions = {
      priority: this.getPriorityValue(webhookEvent.priority),
      attempts: webhookEvent.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 25,
      removeOnFail: 10,
    };

    await this.integrationQueue.add('process-webhook', jobData, jobOptions);
  }

  /**
   * Mark webhook as processing
   */
  async markWebhookAsProcessing(webhookId: string): Promise<WebhookEvent> {
    const webhook = await this.webhookRepository.findOne({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    webhook.markAsProcessing();
    return await this.webhookRepository.save(webhook);
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookAsProcessed(
    webhookId: string,
    processingDetails?: Record<string, any>,
  ): Promise<WebhookEvent> {
    const webhook = await this.webhookRepository.findOne({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    webhook.markAsProcessed(processingDetails);
    webhook.processingDurationMs = Date.now() - webhook.createdAt.getTime();
    
    return await this.webhookRepository.save(webhook);
  }

  /**
   * Mark webhook as failed
   */
  async markWebhookAsFailed(
    webhookId: string,
    error: string,
    scheduleRetry: boolean = true,
  ): Promise<WebhookEvent> {
    const webhook = await this.webhookRepository.findOne({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    let nextRetryAt: Date | undefined;
    
    if (scheduleRetry && webhook.canRetry) {
      nextRetryAt = webhook.calculateNextRetryTime();
    }

    webhook.markAsFailed(error, nextRetryAt);
    
    const savedWebhook = await this.webhookRepository.save(webhook);

    // Schedule retry if applicable
    if (nextRetryAt) {
      await this.scheduleWebhookRetry(webhook, nextRetryAt);
    }

    return savedWebhook;
  }

  /**
   * Schedule webhook retry
   */
  private async scheduleWebhookRetry(
    webhook: WebhookEvent,
    retryAt: Date,
  ): Promise<void> {
    const delay = retryAt.getTime() - Date.now();
    
    if (delay > 0) {
      const jobData = {
        webhookId: webhook.id,
        tenantId: webhook.tenantId,
        channelId: webhook.channelId,
        eventType: webhook.eventType,
        eventSource: webhook.eventSource,
        isRetry: true,
      };

      await this.integrationQueue.add('process-webhook', jobData, {
        delay,
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 5,
      });
    }
  }

  /**
   * Get webhook processing statistics
   */
  async getWebhookStats(
    tenantId: string,
    channelId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalWebhooks: number;
    processed: number;
    failed: number;
    pending: number;
    avgProcessingTime: number;
    successRate: number;
  }> {
    const whereCondition: any = { tenantId };
    
    if (channelId) {
      whereCondition.channelId = channelId;
    }

    if (startDate || endDate) {
      whereCondition.createdAt = Between(
        startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate || new Date(),
      );
    }

    const totalWebhooks = await this.webhookRepository.count({
      where: whereCondition,
    });

    const processed = await this.webhookRepository.count({
      where: {
        ...whereCondition,
        processingStatus: WebhookProcessingStatus.PROCESSED,
      },
    });

    const failed = await this.webhookRepository.count({
      where: {
        ...whereCondition,
        processingStatus: WebhookProcessingStatus.FAILED,
      },
    });

    const pending = await this.webhookRepository.count({
      where: {
        ...whereCondition,
        processingStatus: WebhookProcessingStatus.PENDING,
      },
    });

    // Calculate average processing time
    const processedWebhooks = await this.webhookRepository.find({
      where: {
        ...whereCondition,
        processingStatus: WebhookProcessingStatus.PROCESSED,
        processingDurationMs: Not(null),
      },
      select: ['processingDurationMs'],
    });

    const avgProcessingTime = processedWebhooks.length > 0
      ? processedWebhooks.reduce((sum, webhook) => sum + (webhook.processingDurationMs || 0), 0) / processedWebhooks.length
      : 0;

    const successRate = totalWebhooks > 0 ? (processed / totalWebhooks) * 100 : 0;

    return {
      totalWebhooks,
      processed,
      failed,
      pending,
      avgProcessingTime,
      successRate,
    };
  }

  /**
   * Get failed webhooks for retry
   */
  async getFailedWebhooksForRetry(limit: number = 100): Promise<WebhookEvent[]> {
    const now = new Date();
    
    return await this.webhookRepository.find({
      where: {
        processingStatus: WebhookProcessingStatus.FAILED,
        nextRetryAt: LessThanOrEqual(now),
      },
      order: {
        nextRetryAt: 'ASC',
        priority: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Clean up old webhook events
   */
  async cleanupOldWebhooks(
    tenantId: string,
    olderThanDays: number = 30,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deleteResult = await this.webhookRepository
      .createQueryBuilder()
      .delete()
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('processingStatus IN (:...statuses)', {
        statuses: [
          WebhookProcessingStatus.PROCESSED,
          WebhookProcessingStatus.IGNORED,
          WebhookProcessingStatus.DUPLICATE,
        ],
      })
      .execute();

    const deletedCount = deleteResult.affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} old webhooks for tenant ${tenantId}`);
    
    return deletedCount;
  }

  /**
   * Convert priority enum to numeric value for Bull queue
   */
  private getPriorityValue(priority: WebhookPriority): number {
    const priorityMap = {
      [WebhookPriority.LOW]: 1,
      [WebhookPriority.NORMAL]: 2,
      [WebhookPriority.HIGH]: 3,
      [WebhookPriority.URGENT]: 4,
      [WebhookPriority.CRITICAL]: 5,
    };

    return priorityMap[priority] || 2;
  }
}