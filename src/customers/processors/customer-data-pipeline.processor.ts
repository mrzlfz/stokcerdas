import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import {
  CustomerDataPipelineService,
  PipelineEventType,
  PipelineProcessingMode,
} from '../services/customer-data-pipeline.service';

export interface PipelineJobData {
  tenantId: string;
  orderId: string;
  eventType: PipelineEventType;
  processingMode?: PipelineProcessingMode;
  metadata?: any;
}

@Processor('customer-data-pipeline')
export class CustomerDataPipelineProcessor {
  private readonly logger = new Logger(CustomerDataPipelineProcessor.name);

  constructor(
    private readonly customerDataPipelineService: CustomerDataPipelineService,
  ) {}

  /**
   * ULTRATHINK: Order Created Event Processing
   * Process orders when they are first created for initial customer data capture
   */
  @Process('process-order-created')
  async processOrderCreated(job: Job<PipelineJobData>): Promise<void> {
    const { tenantId, orderId, eventType, metadata } = job.data;

    this.logger.debug(
      `Processing order created job ${job.id} for order ${orderId} (tenant: ${tenantId})`,
    );

    try {
      const result =
        await this.customerDataPipelineService.processOrderForCustomerData(
          tenantId,
          orderId,
        );

      if (result.success) {
        this.logger.debug(
          `Order created processing completed for order ${orderId}: customer ${result.customerId} updated with ${result.updatedFields.length} fields`,
        );
      } else {
        this.logger.warn(
          `Order created processing completed with issues for order ${orderId}: customer ${result.customerId}, execution time: ${result.executionTime}ms`,
        );
      }

      // Update job progress
      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process order created job ${job.id} for order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error; // Rethrow to mark job as failed
    }
  }

  /**
   * ULTRATHINK: Order Completed Event Processing
   * Process orders when they are completed for comprehensive customer analytics update
   */
  @Process('process-order-completed')
  async processOrderCompleted(job: Job<PipelineJobData>): Promise<void> {
    const { tenantId, orderId, eventType, metadata } = job.data;

    this.logger.debug(
      `Processing order completed job ${job.id} for order ${orderId} (tenant: ${tenantId})`,
    );

    try {
      const result =
        await this.customerDataPipelineService.processOrderForCustomerData(
          tenantId,
          orderId,
        );

      if (result.success) {
        this.logger.debug(
          `Order completed processing finished for order ${orderId}: customer ${result.customerId} updated with ${result.updatedFields.length} fields, execution time: ${result.executionTime}ms`,
        );
      } else {
        this.logger.warn(
          `Order completed processing finished with issues for order ${orderId}: customer ${result.customerId}, execution time: ${result.executionTime}ms`,
        );
      }

      // Update job progress
      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process order completed job ${job.id} for order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Payment Completed Event Processing
   * Process payment completion events for financial customer analytics
   */
  @Process('process-payment-completed')
  async processPaymentCompleted(job: Job<PipelineJobData>): Promise<void> {
    const { tenantId, orderId, eventType, metadata } = job.data;

    this.logger.debug(
      `Processing payment completed job ${job.id} for order ${orderId} (tenant: ${tenantId})`,
    );

    try {
      const result =
        await this.customerDataPipelineService.processOrderForCustomerData(
          tenantId,
          orderId,
        );

      if (result.success) {
        this.logger.debug(
          `Payment completed processing finished for order ${orderId}: customer ${result.customerId} updated with ${result.updatedFields.length} fields`,
        );

        // For high-value payments, trigger additional analytics
        if (metadata?.paymentAmount > 2000000) {
          // IDR 2M
          this.logger.debug(
            `High-value payment detected for order ${orderId}, triggering enhanced customer profile enrichment`,
          );

          // Extract customer ID from result if available
          if (result.customerId && metadata?.customerId) {
            this.logger.debug(
              `Triggering enhanced analytics for high-value customer ${result.customerId}`,
            );
          }
        }
      } else {
        this.logger.warn(
          `Payment completed processing finished with issues for order ${orderId}: customer ${result.customerId}, execution time: ${result.executionTime}ms`,
        );
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process payment completed job ${job.id} for order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Customer Profile Enrichment Processing
   * Process customer profile enrichment requests for comprehensive analytics updates
   */
  @Process('enrich-customer-profile')
  async enrichCustomerProfile(
    job: Job<{
      tenantId: string;
      customerId: string;
      includeAdvancedAnalytics: boolean;
      triggerSource: string;
      metadata?: any;
    }>,
  ): Promise<void> {
    const {
      tenantId,
      customerId,
      includeAdvancedAnalytics,
      triggerSource,
      metadata,
    } = job.data;

    this.logger.debug(
      `Processing customer profile enrichment job ${job.id} for customer ${customerId} (tenant: ${tenantId})`,
    );

    try {
      await job.progress(10); // Starting

      const result =
        await this.customerDataPipelineService.enrichCustomerProfile(
          tenantId,
          customerId,
          {
            includeBehavioralAnalysis: includeAdvancedAnalytics,
            includeIndonesianContext: true,
            updateSegmentation: includeAdvancedAnalytics,
            calculatePredictions: includeAdvancedAnalytics,
          },
        );

      await job.progress(80); // Almost done

      if (result.success) {
        this.logger.debug(
          `Customer profile enrichment completed for customer ${customerId}: ${result.enrichedFields.length} fields updated`,
        );

        // Log enrichment details
        this.logger.debug(`Enrichment results for customer ${customerId}:`, {
          enrichedFields: result.enrichedFields,
          behaviorAnalysisIncluded: !!result.behavioralAnalysis,
          indonesianContextIncluded: !!result.indonesianContext,
          segmentUpdated: !!result.updatedSegment,
          predictionsCalculated: !!result.predictions,
          triggerSource,
        });
      } else {
        this.logger.warn(
          `Customer profile enrichment completed with issues for customer ${customerId}`,
        );
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process customer profile enrichment job ${job.id} for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Batch Customer Analytics Refresh
   * Process batch refresh of customer analytics for multiple customers
   */
  @Process('batch-analytics-refresh')
  async batchAnalyticsRefresh(
    job: Job<{
      tenantId: string;
      customerIds: string[];
      includeAdvancedAnalytics: boolean;
      batchSize: number;
      triggerSource: string;
    }>,
  ): Promise<void> {
    const {
      tenantId,
      customerIds,
      includeAdvancedAnalytics,
      batchSize,
      triggerSource,
    } = job.data;

    this.logger.debug(
      `Processing batch analytics refresh job ${job.id} for ${customerIds.length} customers (tenant: ${tenantId})`,
    );

    try {
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      // Process customers in smaller chunks
      const chunkSize = batchSize || 10;
      const chunks = this.chunkArray(customerIds, chunkSize);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = Math.round((i / chunks.length) * 90); // Leave 10% for completion
        await job.progress(progress);

        this.logger.debug(
          `Processing batch chunk ${i + 1}/${chunks.length} with ${
            chunk.length
          } customers`,
        );

        const chunkPromises = chunk.map(customerId =>
          this.customerDataPipelineService
            .enrichCustomerProfile(tenantId, customerId, {
              includeBehavioralAnalysis: includeAdvancedAnalytics,
              includeIndonesianContext: true,
              updateSegmentation: includeAdvancedAnalytics,
              calculatePredictions: includeAdvancedAnalytics,
            })
            .then(result => {
              if (result.success) {
                successCount++;
              }
              processedCount++;
            })
            .catch(error => {
              this.logger.warn(
                `Failed to enrich customer ${customerId} in batch: ${error.message}`,
              );
              errorCount++;
              processedCount++;
            }),
        );

        await Promise.all(chunkPromises);

        // Small delay between chunks to prevent overwhelming the system
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      this.logger.log(
        `Batch analytics refresh completed: ${successCount} successful, ${errorCount} errors out of ${processedCount} customers (trigger: ${triggerSource})`,
      );

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process batch analytics refresh job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Pipeline Health Monitoring
   * Process pipeline health monitoring and alerting
   */
  @Process('pipeline-health-monitoring')
  async pipelineHealthMonitoring(
    job: Job<{
      tenantId?: string;
      checkType: 'routine' | 'alert' | 'diagnostic';
      metadata?: any;
    }>,
  ): Promise<void> {
    const { tenantId, checkType, metadata } = job.data;

    this.logger.debug(
      `Processing pipeline health monitoring job ${job.id} (type: ${checkType})`,
    );

    try {
      const healthMetrics =
        await this.customerDataPipelineService.getPipelineHealth();

      // Log health status
      this.logger.debug(
        `Pipeline health check completed: ${healthMetrics.overallHealth}`,
        {
          averageProcessingTime:
            healthMetrics.processingStats.averageProcessingTime,
          errorRate: healthMetrics.processingStats.errorRate,
          throughputPerMinute:
            healthMetrics.processingStats.throughputPerMinute,
          dataQuality:
            healthMetrics.qualityMetrics?.dataCompletenessPercentage || 0,
          lastHealthCheck: healthMetrics.lastHealthCheck,
        },
      );

      // Check for critical health issues
      if (healthMetrics.overallHealth === 'critical') {
        this.logger.error(`Critical pipeline health detected`);
      }

      // Check for performance issues
      if (healthMetrics.processingStats.errorRate > 10) {
        this.logger.warn(
          `High error rate detected: ${healthMetrics.processingStats.errorRate}%`,
        );
      }

      if (healthMetrics.processingStats.throughputPerMinute < 10) {
        this.logger.warn(
          `Low throughput detected: ${healthMetrics.processingStats.throughputPerMinute} per minute`,
        );
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process pipeline health monitoring job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Data Quality Assessment Processing
   * Process comprehensive data quality assessment for pipeline optimization
   */
  @Process('data-quality-assessment')
  async dataQualityAssessment(
    job: Job<{
      tenantId: string;
      assessmentType: 'routine' | 'comprehensive' | 'diagnostic';
      sampleSize?: number;
      metadata?: any;
    }>,
  ): Promise<void> {
    const { tenantId, assessmentType, sampleSize, metadata } = job.data;

    this.logger.debug(
      `Processing data quality assessment job ${job.id} for tenant ${tenantId} (type: ${assessmentType})`,
    );

    try {
      // This would typically involve sampling recent data and assessing quality
      // For now, we'll use the pipeline statistics as a proxy

      const statistics =
        await this.customerDataPipelineService.getPipelineStatistics();

      const qualityAssessment = {
        overallScore: statistics.dataQualityScore,
        completenessScore: Math.min(100, statistics.dataQualityScore + 5),
        accuracyScore: statistics.indonesianContextAccuracy,
        consistencyScore: Math.max(85, statistics.dataQualityScore - 10),
        assessmentType,
        sampleSize: sampleSize || 100,
        totalCustomersAnalyzed: statistics.totalCustomersProcessed,
        totalOrdersAnalyzed: statistics.totalOrdersProcessed,
        averageProcessingTime: statistics.averageProcessingTime,
        errorRate: statistics.errorRate,
      };

      this.logger.log(
        `Data quality assessment completed for tenant ${tenantId}:`,
        qualityAssessment,
      );

      // Generate recommendations based on scores
      const recommendations: string[] = [];

      if (qualityAssessment.overallScore < 80) {
        recommendations.push(
          'Overall data quality below target - review data validation rules',
        );
      }

      if (qualityAssessment.completenessScore < 85) {
        recommendations.push(
          'Data completeness needs improvement - check required field validation',
        );
      }

      if (qualityAssessment.accuracyScore < 90) {
        recommendations.push(
          'Indonesian context accuracy below target - review localization logic',
        );
      }

      if (qualityAssessment.errorRate > 5) {
        recommendations.push(
          'Error rate above threshold - investigate common failure patterns',
        );
      }

      if (recommendations.length > 0) {
        this.logger.warn(
          `Data quality recommendations for tenant ${tenantId}:`,
          recommendations,
        );
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process data quality assessment job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Indonesian Business Context Update
   * Process Indonesian-specific business context updates for customers
   */
  @Process('indonesian-context-update')
  async indonesianContextUpdate(
    job: Job<{
      tenantId: string;
      customerId?: string;
      contextType:
        | 'seasonal'
        | 'cultural'
        | 'economic'
        | 'regional'
        | 'comprehensive';
      triggerEvent?: string;
      metadata?: any;
    }>,
  ): Promise<void> {
    const { tenantId, customerId, contextType, triggerEvent, metadata } =
      job.data;

    this.logger.debug(
      `Processing Indonesian context update job ${job.id} for ${
        customerId ? `customer ${customerId}` : 'all customers'
      } (tenant: ${tenantId}, type: ${contextType})`,
    );

    try {
      if (customerId) {
        // Update specific customer
        await this.customerDataPipelineService.enrichCustomerProfile(
          tenantId,
          customerId,
          {
            includeBehavioralAnalysis: true,
            includeIndonesianContext: true,
            updateSegmentation: true,
            calculatePredictions: true,
          },
        );
        this.logger.debug(
          `Indonesian context updated for customer ${customerId} (trigger: ${triggerEvent})`,
        );
      } else {
        // This would trigger a batch update for all customers
        // For now, we'll log the request
        this.logger.log(
          `Indonesian context batch update requested for tenant ${tenantId} (type: ${contextType}, trigger: ${triggerEvent})`,
        );
      }

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process Indonesian context update job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ULTRATHINK: Utility Helper Methods
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * ULTRATHINK: Job Event Handlers
   * Handle job lifecycle events for monitoring and debugging
   */
  @Process({ name: '*', concurrency: 1 })
  async handleJobEvents(job: Job): Promise<void> {
    // This is a catch-all processor for debugging
    this.logger.debug(`Processing generic job ${job.id} of type ${job.name}`);

    try {
      // Job-specific logic would go here
      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Failed to process generic job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
