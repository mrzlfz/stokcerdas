import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { BusinessIntelligenceService } from '../services/business-intelligence.service';
import { CustomMetricsService } from '../services/custom-metrics.service';
import { BenchmarkingService } from '../services/benchmarking.service';

export interface AnalyticsJobData {
  tenantId: string;
  jobType: 'revenue_analytics' | 'inventory_turnover' | 'product_performance' | 'custom_metric' | 'benchmarking' | 'scheduled_report';
  parameters: any;
  userId?: string;
  scheduledBy?: string;
  notificationEmail?: string;
}

export interface ScheduledReportJobData extends AnalyticsJobData {
  reportType: 'daily' | 'weekly' | 'monthly';
  reportConfig: {
    includeRevenue: boolean;
    includeInventory: boolean;
    includeProducts: boolean;
    recipients: string[];
    format: 'pdf' | 'excel' | 'csv';
  };
}

@Processor('analytics')
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    private readonly businessIntelligenceService: BusinessIntelligenceService,
    private readonly customMetricsService: CustomMetricsService,
    private readonly benchmarkingService: BenchmarkingService,
  ) {}

  /**
   * Process revenue analytics job
   */
  @Process('revenue_analytics')
  async processRevenueAnalytics(job: Job<AnalyticsJobData>) {
    const { tenantId, parameters } = job.data;
    
    try {
      this.logger.debug(`Processing revenue analytics job for tenant ${tenantId}`);
      
      // Update job progress
      await job.progress(10);
      
      // Generate revenue analytics
      const result = await this.businessIntelligenceService.generateRevenueAnalytics(
        tenantId,
        parameters,
      );
      
      await job.progress(80);
      
      // Store results or send notifications if needed
      await this.handleJobCompletion(job, result);
      
      await job.progress(100);
      
      this.logger.log(`Revenue analytics job completed for tenant ${tenantId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Revenue analytics job failed for tenant ${tenantId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process inventory turnover analytics job
   */
  @Process('inventory_turnover')
  async processInventoryTurnover(job: Job<AnalyticsJobData>) {
    const { tenantId, parameters } = job.data;
    
    try {
      this.logger.debug(`Processing inventory turnover job for tenant ${tenantId}`);
      
      await job.progress(10);
      
      const result = await this.businessIntelligenceService.generateInventoryTurnoverAnalysis(
        tenantId,
        parameters,
      );
      
      await job.progress(80);
      await this.handleJobCompletion(job, result);
      await job.progress(100);
      
      this.logger.log(`Inventory turnover job completed for tenant ${tenantId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Inventory turnover job failed for tenant ${tenantId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process product performance analytics job
   */
  @Process('product_performance')
  async processProductPerformance(job: Job<AnalyticsJobData>) {
    const { tenantId, parameters } = job.data;
    
    try {
      this.logger.debug(`Processing product performance job for tenant ${tenantId}`);
      
      await job.progress(10);
      
      const result = await this.businessIntelligenceService.generateProductPerformanceAnalytics(
        tenantId,
        parameters,
      );
      
      await job.progress(80);
      await this.handleJobCompletion(job, result);
      await job.progress(100);
      
      this.logger.log(`Product performance job completed for tenant ${tenantId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Product performance job failed for tenant ${tenantId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process custom metric calculation job
   */
  @Process('custom_metric')
  async processCustomMetric(job: Job<AnalyticsJobData>) {
    const { tenantId, parameters } = job.data;
    
    try {
      this.logger.debug(`Processing custom metric job for tenant ${tenantId}`);
      
      await job.progress(10);
      
      const result = await this.customMetricsService.calculateCustomMetric(
        tenantId,
        parameters,
      );
      
      await job.progress(80);
      await this.handleJobCompletion(job, result);
      await job.progress(100);
      
      this.logger.log(`Custom metric job completed for tenant ${tenantId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Custom metric job failed for tenant ${tenantId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process benchmarking analysis job
   */
  @Process('benchmarking')
  async processBenchmarking(job: Job<AnalyticsJobData>) {
    const { tenantId, parameters } = job.data;
    
    try {
      this.logger.debug(`Processing benchmarking job for tenant ${tenantId}`);
      
      await job.progress(10);
      
      const result = await this.benchmarkingService.generateBenchmarkingAnalysis(
        tenantId,
        parameters,
      );
      
      await job.progress(80);
      await this.handleJobCompletion(job, result);
      await job.progress(100);
      
      this.logger.log(`Benchmarking job completed for tenant ${tenantId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Benchmarking job failed for tenant ${tenantId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process scheduled report generation
   */
  @Process('scheduled_report')
  async processScheduledReport(job: Job<ScheduledReportJobData>) {
    const { tenantId, reportConfig, reportType } = job.data;
    
    try {
      this.logger.debug(`Processing scheduled ${reportType} report for tenant ${tenantId}`);
      
      await job.progress(5);
      
      const reportData: any = {
        reportType,
        generatedAt: new Date().toISOString(),
        tenantId,
        data: {},
      };

      // Generate revenue analytics if requested
      if (reportConfig.includeRevenue) {
        await job.progress(20);
        reportData.data.revenue = await this.businessIntelligenceService.generateRevenueAnalytics(
          tenantId,
          this.getDateRangeForReportType(reportType),
        );
      }

      // Generate inventory analytics if requested
      if (reportConfig.includeInventory) {
        await job.progress(50);
        reportData.data.inventory = await this.businessIntelligenceService.generateInventoryTurnoverAnalysis(
          tenantId,
          this.getDateRangeForReportType(reportType),
        );
      }

      // Generate product analytics if requested
      if (reportConfig.includeProducts) {
        await job.progress(70);
        reportData.data.products = await this.businessIntelligenceService.generateProductPerformanceAnalytics(
          tenantId,
          this.getDateRangeForReportType(reportType),
        );
      }

      await job.progress(90);

      // Send report to recipients
      await this.sendScheduledReport(reportData, reportConfig);

      await job.progress(100);
      
      this.logger.log(`Scheduled ${reportType} report completed for tenant ${tenantId}`);
      return reportData;
      
    } catch (error) {
      this.logger.error(`Scheduled report job failed for tenant ${tenantId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle job completion - store results, send notifications, etc.
   */
  private async handleJobCompletion(job: Job<AnalyticsJobData>, result: any) {
    const { tenantId, userId, notificationEmail } = job.data;
    
    try {
      // Store analytics results in cache or database if needed
      // This could be implemented to store results for dashboard caching
      
      // Send email notification if requested
      if (notificationEmail) {
        await this.sendNotificationEmail(notificationEmail, job.data.jobType, result);
      }
      
      // Log analytics event for audit trail
      this.logger.log(`Analytics job ${job.data.jobType} completed for tenant ${tenantId}, user ${userId}`);
      
    } catch (error) {
      this.logger.warn(`Failed to handle job completion: ${error.message}`);
      // Don't throw here as the main job succeeded
    }
  }

  /**
   * Get appropriate date range for scheduled report type
   */
  private getDateRangeForReportType(reportType: 'daily' | 'weekly' | 'monthly'): any {
    const endDate = new Date();
    let startDate: Date;

    switch (reportType) {
      case 'daily':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Yesterday
        break;
      case 'weekly':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last week
        break;
      case 'monthly':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1); // Last month
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      granularity: reportType === 'daily' ? 'daily' : reportType === 'weekly' ? 'weekly' : 'monthly',
    };
  }

  /**
   * Send scheduled report to recipients
   */
  private async sendScheduledReport(reportData: any, reportConfig: any) {
    try {
      // This would integrate with an email service
      // For now, just log the action
      this.logger.log(`Scheduled report prepared for ${reportConfig.recipients.length} recipients`);
      this.logger.debug(`Report data summary: ${JSON.stringify({
        reportType: reportData.reportType,
        generatedAt: reportData.generatedAt,
        sections: Object.keys(reportData.data),
      })}`);
      
      // TODO: Implement actual email sending with PDF/Excel generation
      // await this.emailService.sendScheduledReport(reportData, reportConfig);
      
    } catch (error) {
      this.logger.error(`Failed to send scheduled report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification email for completed analytics job
   */
  private async sendNotificationEmail(email: string, jobType: string, result: any) {
    try {
      // This would integrate with an email service
      this.logger.log(`Notification email prepared for ${email} - ${jobType} completed`);
      
      // TODO: Implement actual email sending
      // await this.emailService.sendAnalyticsNotification(email, jobType, result);
      
    } catch (error) {
      this.logger.error(`Failed to send notification email: ${error.message}`);
      // Don't throw as this is not critical
    }
  }

  /**
   * Handle job failure
   */
  @Process('failed')
  async handleFailedJob(job: Job<AnalyticsJobData>) {
    const { tenantId, jobType, notificationEmail } = job.data;
    
    this.logger.error(`Analytics job failed: ${jobType} for tenant ${tenantId}`);
    
    // Send failure notification if email is provided
    if (notificationEmail) {
      try {
        // TODO: Implement failure notification email
        this.logger.log(`Failure notification sent to ${notificationEmail}`);
      } catch (error) {
        this.logger.error(`Failed to send failure notification: ${error.message}`);
      }
    }
  }
}