import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan, IsNull, Between } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BaseService } from './base.service';
import { 
  DeadLetterJob, 
  DeadLetterJobStatus, 
  DeadLetterJobPriority, 
  FailureType, 
  RecoveryStrategy 
} from '../entities/dead-letter-job.entity';
import { 
  JobFailurePattern, 
  PatternType, 
  PatternSeverity, 
  PatternStatus 
} from '../entities/job-failure-pattern.entity';
import { 
  JobRecoveryLog, 
  RecoveryStatus, 
  RecoveryMethod, 
  RecoveryTrigger 
} from '../entities/job-recovery-log.entity';
import { 
  ErrorHandlingService, 
  ErrorHandlingContext 
} from '../../integrations/common/services/error-handling.service';
import { 
  ErrorType,
  ClassifiedError 
} from '../../integrations/common/services/retry.service';
import { 
  CircuitBreakerState 
} from '../../integrations/common/services/circuit-breaker.service';
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';

export interface DeadLetterJobCreateDto {
  originalQueue: string;
  originalJobType: string;
  originalJobId: string;
  originalJobData: any;
  originalJobOptions?: any;
  failureType: FailureType;
  failureReason: string;
  stackTrace?: string;
  errorDetails?: string;
  channelId?: string;
  platform?: string;
  correlationId?: string;
  requestId?: string;
  businessContext?: any;
  maxRetries?: number;
  priority?: DeadLetterJobPriority;
  isCritical?: boolean;
  requiresManualIntervention?: boolean;
  isBusinessHoursOnly?: boolean;
  isRamadanSensitive?: boolean;
  isHolidaySensitive?: boolean;
  metrics?: any;
}

export interface DeadLetterJobStats {
  totalJobs: number;
  byStatus: Record<DeadLetterJobStatus, number>;
  byPriority: Record<DeadLetterJobPriority, number>;
  byFailureType: Record<FailureType, number>;
  byPlatform: Record<string, number>;
  recoveryRate: number;
  averageRecoveryTime: number;
  criticalJobs: number;
  overdueJobs: number;
  businessHoursOnly: number;
  ramadanSensitive: number;
  recentTrends: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

export interface BulkRecoveryOptions {
  status?: DeadLetterJobStatus;
  failureType?: FailureType;
  platform?: string;
  channelId?: string;
  priority?: DeadLetterJobPriority;
  createdBefore?: Date;
  createdAfter?: Date;
  maxRetries?: number;
  requiresApproval?: boolean;
  dryRun?: boolean;
  batchSize?: number;
  respectBusinessHours?: boolean;
}

@Injectable()
export class DeadLetterQueueService extends BaseService<DeadLetterJob> {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  constructor(
    @InjectRepository(DeadLetterJob)
    protected readonly repository: Repository<DeadLetterJob>,
    @InjectRepository(JobFailurePattern)
    private readonly patternRepository: Repository<JobFailurePattern>,
    @InjectRepository(JobRecoveryLog)
    private readonly recoveryLogRepository: Repository<JobRecoveryLog>,
    @InjectQueue('dead-letter-queue')
    private readonly deadLetterQueue: Queue,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Create a new dead letter job from a failed job
   */
  async createFromFailedJob(
    tenantId: string,
    failedJob: Job,
    error: ClassifiedError,
    userId?: string,
  ): Promise<DeadLetterJob> {
    const correlationId = `dlq-${tenantId}-${Date.now()}`;
    
    // Create error handling context
    const errorContext: ErrorHandlingContext = {
      tenantId,
      operationType: 'dead_letter_creation',
      operationName: 'createFromFailedJob',
      serviceName: 'dead-letter-queue-service',
      correlationId,
      businessContext: {
        originalQueue: failedJob.queue.name,
        originalJobType: failedJob.name,
        originalJobId: failedJob.id.toString(),
        failureType: this.mapErrorTypeToFailureType(error.type),
        indonesianBusiness: true,
      },
    };

    // Execute with error handling
    const result = await this.errorHandlingService.executeWithErrorHandling(
      async () => {
        const deadLetterJobData: DeadLetterJobCreateDto = {
          originalQueue: failedJob.queue.name,
          originalJobType: failedJob.name,
          originalJobId: failedJob.id.toString(),
          originalJobData: failedJob.data,
          originalJobOptions: failedJob.opts,
          failureType: this.mapErrorTypeToFailureType(error.type),
          failureReason: error.message,
          stackTrace: error.originalError?.stack,
          errorDetails: JSON.stringify(error.context),
          correlationId,
          businessContext: {
            originalAttempts: failedJob.attemptsMade,
            failedAt: new Date(),
            indonesianBusiness: true,
          },
          maxRetries: this.calculateMaxRetries(error.type),
          priority: this.calculatePriority(error.type, failedJob.data),
          isCritical: this.isCriticalError(error.type, failedJob.data),
          requiresManualIntervention: this.requiresManualIntervention(error.type),
          isBusinessHoursOnly: this.isBusinessHoursOnly(error.type),
          isRamadanSensitive: this.isRamadanSensitive(failedJob.data),
          isHolidaySensitive: this.isHolidaySensitive(failedJob.data),
          metrics: {
            originalAttempts: failedJob.attemptsMade,
            totalDuration: failedJob.finishedOn - failedJob.processedOn,
            errorType: error.type,
            retryable: error.retryable,
          },
        };

        // Extract channel and platform info if available
        if (failedJob.data.tenantId) {
          deadLetterJobData.channelId = failedJob.data.channelId;
          deadLetterJobData.platform = failedJob.data.platform;
        }

        const deadLetterJob = await this.create(tenantId, deadLetterJobData, userId);

        // Analyze for patterns
        await this.analyzeForPatterns(tenantId, deadLetterJob);

        // Log creation
        await this.logService.log({
          tenantId,
          channelId: deadLetterJobData.channelId,
          type: 'system' as any,
          level: 'info' as any,
          message: `Dead letter job created for failed job ${failedJob.id}`,
          metadata: {
            deadLetterJobId: deadLetterJob.id,
            originalQueue: deadLetterJob.originalQueue,
            originalJobType: deadLetterJob.originalJobType,
            failureType: deadLetterJob.failureType,
            priority: deadLetterJob.priority,
            correlationId,
          },
        });

        // Emit event
        this.eventEmitter.emit('dead-letter-job.created', {
          tenantId,
          deadLetterJob,
          originalJob: failedJob,
          error,
        });

        return deadLetterJob;
      },
      errorContext,
    );

    if (!result.success) {
      this.logger.error(`Failed to create dead letter job: ${result.error?.message}`, {
        tenantId,
        failedJobId: failedJob.id,
        error: result.error,
      });
      throw new BadRequestException(
        `Failed to create dead letter job: ${result.error?.message}`
      );
    }

    return result.result!;
  }

  /**
   * Get dead letter jobs with filtering and pagination
   */
  async getDeadLetterJobs(
    tenantId: string,
    options: {
      status?: DeadLetterJobStatus | DeadLetterJobStatus[];
      priority?: DeadLetterJobPriority | DeadLetterJobPriority[];
      failureType?: FailureType | FailureType[];
      platform?: string | string[];
      channelId?: string | string[];
      assigned?: boolean;
      assignedTo?: string;
      createdAfter?: Date;
      createdBefore?: Date;
      nextRetryAfter?: Date;
      nextRetryBefore?: Date;
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'priority' | 'next_retry_at' | 'failure_type';
      orderDirection?: 'ASC' | 'DESC';
    } = {},
  ): Promise<{
    jobs: DeadLetterJob[];
    total: number;
    stats: DeadLetterJobStats;
  }> {
    const queryBuilder = this.createQueryBuilder('dlj', tenantId);

    // Apply filters
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      queryBuilder.andWhere('dlj.status IN (:...statuses)', { statuses });
    }

    if (options.priority) {
      const priorities = Array.isArray(options.priority) ? options.priority : [options.priority];
      queryBuilder.andWhere('dlj.priority IN (:...priorities)', { priorities });
    }

    if (options.failureType) {
      const failureTypes = Array.isArray(options.failureType) ? options.failureType : [options.failureType];
      queryBuilder.andWhere('dlj.failure_type IN (:...failureTypes)', { failureTypes });
    }

    if (options.platform) {
      const platforms = Array.isArray(options.platform) ? options.platform : [options.platform];
      queryBuilder.andWhere('dlj.platform IN (:...platforms)', { platforms });
    }

    if (options.channelId) {
      const channelIds = Array.isArray(options.channelId) ? options.channelId : [options.channelId];
      queryBuilder.andWhere('dlj.channel_id IN (:...channelIds)', { channelIds });
    }

    if (options.assigned !== undefined) {
      if (options.assigned) {
        queryBuilder.andWhere('dlj.assigned_to IS NOT NULL');
      } else {
        queryBuilder.andWhere('dlj.assigned_to IS NULL');
      }
    }

    if (options.assignedTo) {
      queryBuilder.andWhere('dlj.assigned_to = :assignedTo', { assignedTo: options.assignedTo });
    }

    if (options.createdAfter) {
      queryBuilder.andWhere('dlj.created_at >= :createdAfter', { createdAfter: options.createdAfter });
    }

    if (options.createdBefore) {
      queryBuilder.andWhere('dlj.created_at <= :createdBefore', { createdBefore: options.createdBefore });
    }

    if (options.nextRetryAfter) {
      queryBuilder.andWhere('dlj.next_retry_at >= :nextRetryAfter', { nextRetryAfter: options.nextRetryAfter });
    }

    if (options.nextRetryBefore) {
      queryBuilder.andWhere('dlj.next_retry_at <= :nextRetryBefore', { nextRetryBefore: options.nextRetryBefore });
    }

    // Apply ordering
    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'DESC';
    queryBuilder.orderBy(`dlj.${orderBy}`, orderDirection);

    // Count total
    const total = await queryBuilder.getCount();

    // Apply pagination
    if (options.offset) {
      queryBuilder.offset(options.offset);
    }
    if (options.limit) {
      queryBuilder.limit(options.limit);
    }

    const jobs = await queryBuilder.getMany();

    // Get stats
    const stats = await this.getStats(tenantId);

    return { jobs, total, stats };
  }

  /**
   * Schedule job for retry
   */
  async scheduleRetry(
    tenantId: string,
    jobId: string,
    options: {
      strategy?: RecoveryStrategy;
      delay?: number;
      modifiedData?: any;
      notes?: string;
      userId?: string;
      requiresApproval?: boolean;
    } = {},
  ): Promise<JobRecoveryLog> {
    const deadLetterJob = await this.findOne(tenantId, jobId);

    if (!deadLetterJob.canRetry()) {
      throw new BadRequestException('Job cannot be retried');
    }

    const strategy = options.strategy || RecoveryStrategy.DELAYED_RETRY;
    const correlationId = `retry-${tenantId}-${jobId}-${Date.now()}`;

    // Create error handling context
    const errorContext: ErrorHandlingContext = {
      tenantId,
      operationType: 'job_recovery',
      operationName: 'scheduleRetry',
      serviceName: 'dead-letter-queue-service',
      correlationId,
      businessContext: {
        deadLetterJobId: jobId,
        recoveryStrategy: strategy,
        indonesianBusiness: true,
      },
    };

    // Execute with error handling
    const result = await this.errorHandlingService.executeWithErrorHandling(
      async () => {
        // Create recovery log
        const recoveryLog = this.recoveryLogRepository.create({
          tenantId,
          deadLetterJobId: jobId,
          status: RecoveryStatus.INITIATED,
          recoveryMethod: this.getRecoveryMethod(strategy),
          recoveryStrategy: strategy,
          recoveryTrigger: RecoveryTrigger.MANUAL,
          recoveryStartedAt: new Date(),
          recoveryConfiguration: {
            originalJobData: deadLetterJob.originalJobData,
            modifiedJobData: options.modifiedData,
            retryOptions: {
              maxAttempts: deadLetterJob.maxRetries,
              backoffMultiplier: 2,
              respectBusinessHours: deadLetterJob.isBusinessHoursOnly,
              customDelay: options.delay,
            },
            businessRules: {
              requireBusinessHours: deadLetterJob.isBusinessHoursOnly,
              isRamadanSensitive: deadLetterJob.isRamadanSensitive,
              isHolidaySensitive: deadLetterJob.isHolidaySensitive,
              timezone: deadLetterJob.timezone || 'Asia/Jakarta',
            },
          },
          initiatedBy: options.userId,
          correlationId,
          isBusinessHoursOnly: deadLetterJob.isBusinessHoursOnly,
          requiresApproval: options.requiresApproval || deadLetterJob.isCritical,
          isCriticalRecovery: deadLetterJob.isCritical,
          ramadanConsideration: deadLetterJob.isRamadanSensitive,
          holidayConsideration: deadLetterJob.isHolidaySensitive,
          recoveryNotes: options.notes,
        });

        await this.recoveryLogRepository.save(recoveryLog);

        // Update dead letter job
        deadLetterJob.scheduleRetry(strategy, {
          recoveryLogId: recoveryLog.id,
          customDelay: options.delay,
          modifiedData: options.modifiedData,
        });

        if (options.delay) {
          deadLetterJob.nextRetryAt = new Date(Date.now() + options.delay);
        }

        await this.repository.save(deadLetterJob);

        // Schedule retry job if not requires approval
        if (!recoveryLog.requiresApproval) {
          await this.scheduleRetryJob(deadLetterJob, recoveryLog);
        }

        // Log the retry scheduling
        await this.logService.log({
          tenantId,
          channelId: deadLetterJob.channelId,
          type: 'system' as any,
          level: 'info' as any,
          message: `Dead letter job scheduled for retry: ${strategy}`,
          metadata: {
            deadLetterJobId: jobId,
            recoveryLogId: recoveryLog.id,
            strategy,
            requiresApproval: recoveryLog.requiresApproval,
            nextRetryAt: deadLetterJob.nextRetryAt,
            correlationId,
          },
        });

        // Emit event
        this.eventEmitter.emit('dead-letter-job.retry-scheduled', {
          tenantId,
          deadLetterJob,
          recoveryLog,
          strategy,
        });

        return recoveryLog;
      },
      errorContext,
    );

    if (!result.success) {
      this.logger.error(`Failed to schedule retry: ${result.error?.message}`, {
        tenantId,
        jobId,
        error: result.error,
      });
      throw new BadRequestException(
        `Failed to schedule retry: ${result.error?.message}`
      );
    }

    return result.result!;
  }

  /**
   * Get dead letter job statistics
   */
  async getStats(tenantId: string): Promise<DeadLetterJobStats> {
    const queryBuilder = this.createQueryBuilder('dlj', tenantId);

    // Get total count
    const totalJobs = await queryBuilder.getCount();

    // Get counts by status
    const statusCounts = await this.repository
      .createQueryBuilder('dlj')
      .select('dlj.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('dlj.tenant_id = :tenantId', { tenantId })
      .groupBy('dlj.status')
      .getRawMany();

    const byStatus = {} as Record<DeadLetterJobStatus, number>;
    Object.values(DeadLetterJobStatus).forEach(status => {
      byStatus[status] = 0;
    });
    statusCounts.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });

    // Get counts by priority
    const priorityCounts = await this.repository
      .createQueryBuilder('dlj')
      .select('dlj.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('dlj.tenant_id = :tenantId', { tenantId })
      .groupBy('dlj.priority')
      .getRawMany();

    const byPriority = {} as Record<DeadLetterJobPriority, number>;
    Object.values(DeadLetterJobPriority).forEach(priority => {
      byPriority[priority] = 0;
    });
    priorityCounts.forEach(row => {
      byPriority[row.priority] = parseInt(row.count);
    });

    // Get counts by failure type
    const failureTypeCounts = await this.repository
      .createQueryBuilder('dlj')
      .select('dlj.failure_type', 'failureType')
      .addSelect('COUNT(*)', 'count')
      .where('dlj.tenant_id = :tenantId', { tenantId })
      .groupBy('dlj.failure_type')
      .getRawMany();

    const byFailureType = {} as Record<FailureType, number>;
    Object.values(FailureType).forEach(type => {
      byFailureType[type] = 0;
    });
    failureTypeCounts.forEach(row => {
      byFailureType[row.failureType] = parseInt(row.count);
    });

    // Get counts by platform
    const platformCounts = await this.repository
      .createQueryBuilder('dlj')
      .select('dlj.platform', 'platform')
      .addSelect('COUNT(*)', 'count')
      .where('dlj.tenant_id = :tenantId', { tenantId })
      .andWhere('dlj.platform IS NOT NULL')
      .groupBy('dlj.platform')
      .getRawMany();

    const byPlatform = {} as Record<string, number>;
    platformCounts.forEach(row => {
      byPlatform[row.platform] = parseInt(row.count);
    });

    // Calculate recovery rate
    const recoveredCount = byStatus[DeadLetterJobStatus.RECOVERED] || 0;
    const recoveryRate = totalJobs > 0 ? (recoveredCount / totalJobs) * 100 : 0;

    // Get average recovery time
    const avgRecoveryTime = await this.recoveryLogRepository
      .createQueryBuilder('rlog')
      .select('AVG(rlog.recovery_duration_ms)', 'avgTime')
      .where('rlog.tenant_id = :tenantId', { tenantId })
      .andWhere('rlog.status = :status', { status: RecoveryStatus.COMPLETED })
      .getRawOne();

    const averageRecoveryTime = avgRecoveryTime?.avgTime ? 
      parseInt(avgRecoveryTime.avgTime) : 0;

    // Get critical jobs count
    const criticalJobs = await this.repository.count({
      where: this.addTenantFilter(tenantId, { isCritical: true }),
    });

    // Get overdue jobs count (next retry time passed)
    const now = new Date();
    const overdueJobs = await this.repository.count({
      where: this.addTenantFilter(tenantId, {
        nextRetryAt: LessThan(now),
        status: In([
          DeadLetterJobStatus.RETRY_SCHEDULED,
          DeadLetterJobStatus.QUARANTINED,
        ]),
      }),
    });

    // Get business hours only jobs
    const businessHoursOnly = await this.repository.count({
      where: this.addTenantFilter(tenantId, { isBusinessHoursOnly: true }),
    });

    // Get ramadan sensitive jobs
    const ramadanSensitive = await this.repository.count({
      where: this.addTenantFilter(tenantId, { isRamadanSensitive: true }),
    });

    // Get recent trends
    const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [last24Hours, last7Days, last30Days] = await Promise.all([
      this.repository.count({
        where: this.addTenantFilter(tenantId, { createdAt: MoreThan(now24h) }),
      }),
      this.repository.count({
        where: this.addTenantFilter(tenantId, { createdAt: MoreThan(now7d) }),
      }),
      this.repository.count({
        where: this.addTenantFilter(tenantId, { createdAt: MoreThan(now30d) }),
      }),
    ]);

    return {
      totalJobs,
      byStatus,
      byPriority,
      byFailureType,
      byPlatform,
      recoveryRate,
      averageRecoveryTime,
      criticalJobs,
      overdueJobs,
      businessHoursOnly,
      ramadanSensitive,
      recentTrends: {
        last24Hours,
        last7Days,
        last30Days,
      },
    };
  }

  /**
   * Process scheduled retries
   */
  async processScheduledRetries(tenantId: string): Promise<void> {
    const now = new Date();
    const scheduledJobs = await this.repository.find({
      where: this.addTenantFilter(tenantId, {
        status: DeadLetterJobStatus.RETRY_SCHEDULED,
        nextRetryAt: LessThan(now),
      }),
      order: { priority: 'DESC', nextRetryAt: 'ASC' },
      take: 50, // Process in batches
    });

    this.logger.debug(`Processing ${scheduledJobs.length} scheduled retries for tenant ${tenantId}`);

    for (const job of scheduledJobs) {
      try {
        await this.executeRetry(tenantId, job);
      } catch (error) {
        this.logger.error(`Failed to execute retry for job ${job.id}`, {
          tenantId,
          jobId: job.id,
          error: error.message,
        });
      }
    }
  }

  // Private helper methods

  /**
   * Map error type to failure type
   */
  private mapErrorTypeToFailureType(errorType: ErrorType): FailureType {
    switch (errorType) {
      case ErrorType.AUTHENTICATION:
        return FailureType.AUTHENTICATION;
      case ErrorType.NETWORK:
        return FailureType.NETWORK;
      case ErrorType.RATE_LIMIT:
        return FailureType.RATE_LIMIT;
      case ErrorType.BUSINESS_LOGIC:
        return FailureType.BUSINESS_LOGIC;
      case ErrorType.TIMEOUT:
        return FailureType.TIMEOUT;
      case ErrorType.TRANSIENT:
        return FailureType.NETWORK;
      default:
        return FailureType.UNKNOWN;
    }
  }

  /**
   * Calculate max retries based on error type
   */
  private calculateMaxRetries(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.RATE_LIMIT:
        return 5;
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
        return 3;
      case ErrorType.TRANSIENT:
        return 3;
      case ErrorType.BUSINESS_LOGIC:
        return 1;
      case ErrorType.AUTHENTICATION:
        return 1;
      default:
        return 2;
    }
  }

  /**
   * Calculate priority based on error type and job data
   */
  private calculatePriority(errorType: ErrorType, jobData: any): DeadLetterJobPriority {
    // Critical business operations
    if (jobData.priority === 'critical' || jobData.isCritical) {
      return DeadLetterJobPriority.CRITICAL;
    }

    // Order-related operations are high priority
    if (jobData.orderId || jobData.orderIds) {
      return DeadLetterJobPriority.HIGH;
    }

    // Authentication errors are high priority
    if (errorType === ErrorType.AUTHENTICATION) {
      return DeadLetterJobPriority.HIGH;
    }

    // Rate limit errors are medium priority
    if (errorType === ErrorType.RATE_LIMIT) {
      return DeadLetterJobPriority.MEDIUM;
    }

    return DeadLetterJobPriority.MEDIUM;
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(errorType: ErrorType, jobData: any): boolean {
    return jobData.isCritical || 
           jobData.priority === 'critical' ||
           errorType === ErrorType.AUTHENTICATION;
  }

  /**
   * Check if error requires manual intervention
   */
  private requiresManualIntervention(errorType: ErrorType): boolean {
    return errorType === ErrorType.AUTHENTICATION ||
           errorType === ErrorType.BUSINESS_LOGIC;
  }

  /**
   * Check if should only retry during business hours
   */
  private isBusinessHoursOnly(errorType: ErrorType): boolean {
    return errorType === ErrorType.AUTHENTICATION ||
           errorType === ErrorType.BUSINESS_LOGIC;
  }

  /**
   * Check if sensitive to Ramadan period
   */
  private isRamadanSensitive(jobData: any): boolean {
    return jobData.isRamadanSensitive || 
           jobData.businessContext?.isRamadanSensitive || 
           false;
  }

  /**
   * Check if sensitive to holidays
   */
  private isHolidaySensitive(jobData: any): boolean {
    return jobData.isHolidaySensitive || 
           jobData.businessContext?.isHolidaySensitive || 
           false;
  }

  /**
   * Get recovery method from strategy
   */
  private getRecoveryMethod(strategy: RecoveryStrategy): RecoveryMethod {
    switch (strategy) {
      case RecoveryStrategy.MANUAL_RETRY:
        return RecoveryMethod.MANUAL_RETRY;
      case RecoveryStrategy.DELAYED_RETRY:
        return RecoveryMethod.AUTOMATIC_RETRY;
      case RecoveryStrategy.MODIFIED_RETRY:
        return RecoveryMethod.MODIFIED_RETRY;
      case RecoveryStrategy.ESCALATE:
        return RecoveryMethod.ESCALATION;
      default:
        return RecoveryMethod.MANUAL_RETRY;
    }
  }

  /**
   * Schedule retry job in queue
   */
  private async scheduleRetryJob(
    deadLetterJob: DeadLetterJob,
    recoveryLog: JobRecoveryLog,
  ): Promise<void> {
    const delay = deadLetterJob.nextRetryAt ? 
      Math.max(0, deadLetterJob.nextRetryAt.getTime() - Date.now()) : 
      0;

    await this.deadLetterQueue.add(
      'retry-job',
      {
        tenantId: deadLetterJob.tenantId,
        deadLetterJobId: deadLetterJob.id,
        recoveryLogId: recoveryLog.id,
        originalQueue: deadLetterJob.originalQueue,
        originalJobType: deadLetterJob.originalJobType,
        originalJobData: deadLetterJob.originalJobData,
        recoveryConfiguration: recoveryLog.recoveryConfiguration,
      },
      {
        delay,
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  /**
   * Execute retry for a dead letter job
   */
  private async executeRetry(tenantId: string, deadLetterJob: DeadLetterJob): Promise<void> {
    const correlationId = `retry-exec-${tenantId}-${deadLetterJob.id}-${Date.now()}`;
    
    // Create error handling context
    const errorContext: ErrorHandlingContext = {
      tenantId,
      operationType: 'job_retry_execution',
      operationName: 'executeRetry',
      serviceName: 'dead-letter-queue-service',
      correlationId,
      businessContext: {
        deadLetterJobId: deadLetterJob.id,
        originalQueue: deadLetterJob.originalQueue,
        originalJobType: deadLetterJob.originalJobType,
        retryAttempt: deadLetterJob.retryCount + 1,
        indonesianBusiness: true,
      },
    };

    try {
      // Get the latest recovery log
      const recoveryLog = await this.recoveryLogRepository.findOne({
        where: this.addTenantFilter(tenantId, {
          deadLetterJobId: deadLetterJob.id,
          status: In([RecoveryStatus.INITIATED, RecoveryStatus.IN_PROGRESS]),
        }),
        order: { createdAt: 'DESC' },
      });

      if (!recoveryLog) {
        throw new Error('No active recovery log found for dead letter job');
      }

      // Check if we should delay for business hours
      if (deadLetterJob.isBusinessHoursOnly && !this.isWithinIndonesianBusinessHours()) {
        const nextBusinessHour = this.getNextIndonesianBusinessHour();
        deadLetterJob.nextRetryAt = nextBusinessHour;
        await this.repository.save(deadLetterJob);
        
        this.logger.log(`Delaying retry for business hours`, {
          tenantId,
          deadLetterJobId: deadLetterJob.id,
          nextRetryAt: nextBusinessHour,
          correlationId,
        });
        return;
      }

      // Update dead letter job status
      deadLetterJob.status = DeadLetterJobStatus.RETRYING;
      deadLetterJob.lastRetryAt = new Date();
      deadLetterJob.retryCount += 1;
      await this.repository.save(deadLetterJob);

      // Update recovery log status
      recoveryLog.status = RecoveryStatus.IN_PROGRESS;
      await this.recoveryLogRepository.save(recoveryLog);

      // Execute with error handling
      const result = await this.errorHandlingService.executeWithErrorHandling(
        async () => {
          // Prepare job data for retry
          const jobData = recoveryLog.recoveryConfiguration.modifiedJobData || 
                         recoveryLog.recoveryConfiguration.originalJobData;
          
          // Add Indonesian business context
          const enrichedJobData = {
            ...jobData,
            tenantId,
            retryAttempt: deadLetterJob.retryCount,
            recoveryContext: {
              deadLetterJobId: deadLetterJob.id,
              recoveryLogId: recoveryLog.id,
              isRecovery: true,
              businessHours: this.isWithinIndonesianBusinessHours(),
              ramadanSensitive: deadLetterJob.isRamadanSensitive,
              holidaySensitive: deadLetterJob.isHolidaySensitive,
              correlationId,
            },
          };

          // Apply overrides if specified
          const overrides = recoveryLog.recoveryConfiguration.overrides || {};
          const jobOptions = {
            ...deadLetterJob.originalJobOptions,
            attempts: 1, // Single attempt for recovery
            backoff: false, // No backoff for recovery
            priority: overrides.priority || deadLetterJob.priority === DeadLetterJobPriority.CRITICAL ? 10 : 5,
            timeout: overrides.timeout || 300000, // 5 minutes default
            ...overrides,
          };

          // Re-queue the job
          const targetQueue = overrides.queue || deadLetterJob.originalQueue;
          
          // Note: This would typically use Bull Queue to re-queue the job
          // For this implementation, we'll simulate the retry execution
          const retryJob = await this.deadLetterQueue.add(
            deadLetterJob.originalJobType,
            enrichedJobData,
            jobOptions,
          );

          // Update recovery log with job details
          recoveryLog.recoveryJobId = retryJob.id?.toString();
          recoveryLog.recoveryQueue = targetQueue;
          await this.recoveryLogRepository.save(recoveryLog);

          // Monitor job execution (simplified)
          // In a real implementation, you'd set up job event listeners
          
          return {
            retryJobId: retryJob.id,
            queue: targetQueue,
            jobType: deadLetterJob.originalJobType,
          };
        },
        errorContext,
      );

      if (result.success) {
        // Mark as recovered
        deadLetterJob.status = DeadLetterJobStatus.RECOVERED;
        deadLetterJob.recoveredAt = new Date();
        deadLetterJob.recoveryMetadata = {
          retryJobId: result.result?.retryJobId,
          recoveryMethod: recoveryLog.recoveryMethod,
          businessHoursExecution: this.isWithinIndonesianBusinessHours(),
          totalRetries: deadLetterJob.retryCount,
        };
        
        await this.repository.save(deadLetterJob);
        
        // Update recovery log
        recoveryLog.markAsCompleted(result.result, {
          executionTime: Date.now() - recoveryLog.recoveryStartedAt.getTime(),
          businessHoursExecution: this.isWithinIndonesianBusinessHours(),
        });
        await this.recoveryLogRepository.save(recoveryLog);

        // Log success
        await this.logService.log({
          tenantId,
          channelId: deadLetterJob.channelId,
          type: 'system' as any,
          level: 'info' as any,
          message: `Dead letter job successfully recovered: ${deadLetterJob.id}`,
          metadata: {
            deadLetterJobId: deadLetterJob.id,
            recoveryLogId: recoveryLog.id,
            retryJobId: result.result?.retryJobId,
            totalRetries: deadLetterJob.retryCount,
            recoveryDuration: recoveryLog.recoveryDurationMs,
            correlationId,
          },
        });

        // Emit success event
        this.eventEmitter.emit('dead-letter-job.recovered', {
          tenantId,
          deadLetterJob,
          recoveryLog,
          result: result.result,
        });

      } else {
        // Handle retry failure
        const error = result.error!;
        
        if (deadLetterJob.retryCount >= deadLetterJob.maxRetries) {
          // Mark as permanently failed
          deadLetterJob.status = DeadLetterJobStatus.PERMANENTLY_FAILED;
          deadLetterJob.notes = `Maximum retries exceeded: ${error.message}`;
          
          // Update recovery log
          const errorForRecovery = new Error(error.message);
          errorForRecovery.name = error.type || 'UnknownError';
          errorForRecovery.stack = error.originalError?.stack || error.context?.toString();
          recoveryLog.markAsFailed(errorForRecovery, {
            maxRetriesExceeded: true,
            totalRetries: deadLetterJob.retryCount,
          });
          
          // Log permanent failure
          await this.logService.log({
            tenantId,
            channelId: deadLetterJob.channelId,
            type: 'system' as any,
            level: 'error' as any,
            message: `Dead letter job permanently failed: ${deadLetterJob.id}`,
            metadata: {
              deadLetterJobId: deadLetterJob.id,
              recoveryLogId: recoveryLog.id,
              error: error.message,
              totalRetries: deadLetterJob.retryCount,
              maxRetries: deadLetterJob.maxRetries,
              correlationId,
            },
          });

          // Emit failure event
          this.eventEmitter.emit('dead-letter-job.permanently-failed', {
            tenantId,
            deadLetterJob,
            recoveryLog,
            error,
          });
        } else {
          // Schedule next retry
          deadLetterJob.status = DeadLetterJobStatus.RETRY_SCHEDULED;
          const nextRetryDelay = this.calculateNextRetryDelay(deadLetterJob.retryCount);
          deadLetterJob.nextRetryAt = new Date(Date.now() + nextRetryDelay);
          
          // Update recovery log
          recoveryLog.status = RecoveryStatus.FAILED;
          recoveryLog.recoveryFailedAt = new Date();
          recoveryLog.recoveryDurationMs = recoveryLog.recoveryFailedAt.getTime() - 
                                         recoveryLog.recoveryStartedAt.getTime();
          recoveryLog.recoveryResult = {
            success: false,
            error: {
              message: error.message,
              code: error.type || 'UnknownError',
              stack: error.originalError?.stack || error.context?.toString(),
            },
          };
        }
        
        await this.repository.save(deadLetterJob);
        await this.recoveryLogRepository.save(recoveryLog);
      }

    } catch (error) {
      this.logger.error(`Failed to execute retry for dead letter job ${deadLetterJob.id}`, {
        tenantId,
        deadLetterJobId: deadLetterJob.id,
        error: error.message,
        stack: error.stack,
        correlationId,
      });
      
      // Mark job as failed
      deadLetterJob.status = DeadLetterJobStatus.PERMANENTLY_FAILED;
      deadLetterJob.notes = `Retry execution failed: ${error.message}`;
      await this.repository.save(deadLetterJob);
      
      throw error;
    }
  }

  /**
   * Analyze job for failure patterns
   */
  private async analyzeForPatterns(tenantId: string, deadLetterJob: DeadLetterJob): Promise<void> {
    const correlationId = `pattern-analysis-${tenantId}-${deadLetterJob.id}-${Date.now()}`;
    
    try {
      // Find similar jobs in the last 24 hours
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const similarJobs = await this.repository.find({
        where: this.addTenantFilter(tenantId, {
          originalQueue: deadLetterJob.originalQueue,
          originalJobType: deadLetterJob.originalJobType,
          failureType: deadLetterJob.failureType,
          createdAt: MoreThan(last24Hours),
        }),
        order: { createdAt: 'DESC' },
        take: 50,
      });

      if (similarJobs.length < 3) {
        this.logger.debug(`Not enough similar jobs for pattern analysis`, {
          tenantId,
          deadLetterJobId: deadLetterJob.id,
          similarJobsCount: similarJobs.length,
        });
        return;
      }

      // Analyze time-based patterns
      const timePatterns = this.analyzeTimePatterns(similarJobs);
      
      // Analyze platform-specific patterns
      const platformPatterns = this.analyzePlatformPatterns(similarJobs);
      
      // Analyze Indonesian business context patterns
      const businessPatterns = this.analyzeBusinessContextPatterns(similarJobs);
      
      // Create or update patterns
      await this.createOrUpdatePatterns(tenantId, deadLetterJob, {
        timePatterns,
        platformPatterns,
        businessPatterns,
        similarJobs,
      });

      this.logger.debug(`Pattern analysis completed for dead letter job ${deadLetterJob.id}`, {
        tenantId,
        deadLetterJobId: deadLetterJob.id,
        similarJobsCount: similarJobs.length,
        patternsFound: timePatterns.length + platformPatterns.length + businessPatterns.length,
        correlationId,
      });

    } catch (error) {
      this.logger.error(`Failed to analyze patterns for dead letter job ${deadLetterJob.id}`, {
        tenantId,
        deadLetterJobId: deadLetterJob.id,
        error: error.message,
        correlationId,
      });
    }
  }

  // Additional helper methods for pattern analysis

  /**
   * Analyze time-based failure patterns
   */
  private analyzeTimePatterns(jobs: DeadLetterJob[]): Array<{
    type: string;
    description: string;
    jobs: DeadLetterJob[];
    severity: string;
  }> {
    const patterns: Array<{
      type: string;
      description: string;
      jobs: DeadLetterJob[];
      severity: string;
    }> = [];

    // Group jobs by hour
    const hourlyGroups = jobs.reduce((acc, job) => {
      const hour = new Date(job.createdAt).getHours();
      acc[hour] = acc[hour] || [];
      acc[hour].push(job);
      return acc;
    }, {} as Record<number, DeadLetterJob[]>);

    // Find peak failure hours
    const peakHours = Object.entries(hourlyGroups)
      .filter(([_, jobs]) => jobs.length >= 3)
      .sort(([_, a], [__, b]) => b.length - a.length);

    if (peakHours.length > 0) {
      const [peakHour, peakJobs] = peakHours[0];
      patterns.push({
        type: 'time_based_failure',
        description: `High failure rate at ${peakHour}:00 Jakarta time`,
        jobs: peakJobs,
        severity: peakJobs.length > 10 ? 'critical' : peakJobs.length > 5 ? 'high' : 'medium',
      });
    }

    // Check for business hours vs non-business hours patterns
    const businessHoursJobs = jobs.filter(job => {
      const hour = new Date(job.createdAt).getHours();
      return hour >= 9 && hour <= 17;
    });

    const nonBusinessHoursJobs = jobs.filter(job => {
      const hour = new Date(job.createdAt).getHours();
      return hour < 9 || hour > 17;
    });

    if (nonBusinessHoursJobs.length > businessHoursJobs.length * 2) {
      patterns.push({
        type: 'business_hours',
        description: 'Higher failure rate outside Indonesian business hours',
        jobs: nonBusinessHoursJobs,
        severity: 'medium',
      });
    }

    return patterns;
  }

  /**
   * Analyze platform-specific failure patterns
   */
  private analyzePlatformPatterns(jobs: DeadLetterJob[]): Array<{
    type: string;
    description: string;
    jobs: DeadLetterJob[];
    severity: string;
  }> {
    const patterns: Array<{
      type: string;
      description: string;
      jobs: DeadLetterJob[];
      severity: string;
    }> = [];

    // Group jobs by platform
    const platformGroups = jobs.reduce((acc, job) => {
      const platform = job.platform || 'unknown';
      acc[platform] = acc[platform] || [];
      acc[platform].push(job);
      return acc;
    }, {} as Record<string, DeadLetterJob[]>);

    // Find problematic platforms
    const problematicPlatforms = Object.entries(platformGroups)
      .filter(([_, jobs]) => jobs.length >= 3)
      .sort(([_, a], [__, b]) => b.length - a.length);

    for (const [platform, platformJobs] of problematicPlatforms) {
      // Check for rate limiting patterns
      const rateLimitJobs = platformJobs.filter(job => 
        job.failureType === FailureType.RATE_LIMIT
      );

      if (rateLimitJobs.length >= 3) {
        patterns.push({
          type: 'rate_limit_pattern',
          description: `Frequent rate limiting from ${platform}`,
          jobs: rateLimitJobs,
          severity: 'high',
        });
      }

      // Check for authentication patterns
      const authJobs = platformJobs.filter(job => 
        job.failureType === FailureType.AUTHENTICATION
      );

      if (authJobs.length >= 2) {
        patterns.push({
          type: 'authentication_pattern',
          description: `Authentication failures with ${platform}`,
          jobs: authJobs,
          severity: 'critical',
        });
      }

      // Check for network patterns
      const networkJobs = platformJobs.filter(job => 
        job.failureType === FailureType.NETWORK
      );

      if (networkJobs.length >= 5) {
        patterns.push({
          type: 'platform_specific',
          description: `Network connectivity issues with ${platform}`,
          jobs: networkJobs,
          severity: 'medium',
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze Indonesian business context patterns
   */
  private analyzeBusinessContextPatterns(jobs: DeadLetterJob[]): Array<{
    type: string;
    description: string;
    jobs: DeadLetterJob[];
    severity: string;
  }> {
    const patterns: Array<{
      type: string;
      description: string;
      jobs: DeadLetterJob[];
      severity: string;
    }> = [];

    // Check for Ramadan-related patterns
    const ramadanJobs = jobs.filter(job => job.isRamadanSensitive);
    if (ramadanJobs.length >= 3) {
      patterns.push({
        type: 'seasonal_pattern',
        description: 'Ramadan-sensitive job failures',
        jobs: ramadanJobs,
        severity: 'medium',
      });
    }

    // Check for holiday-related patterns
    const holidayJobs = jobs.filter(job => job.isHolidaySensitive);
    if (holidayJobs.length >= 2) {
      patterns.push({
        type: 'seasonal_pattern',
        description: 'Holiday-sensitive job failures',
        jobs: holidayJobs,
        severity: 'medium',
      });
    }

    // Check for critical job patterns
    const criticalJobs = jobs.filter(job => job.isCritical);
    if (criticalJobs.length >= 2) {
      patterns.push({
        type: 'escalation_pattern',
        description: 'Critical job failures requiring immediate attention',
        jobs: criticalJobs,
        severity: 'critical',
      });
    }

    return patterns;
  }

  /**
   * Create or update failure patterns
   */
  private async createOrUpdatePatterns(
    tenantId: string,
    deadLetterJob: DeadLetterJob,
    analysis: {
      timePatterns: Array<{ type: string; description: string; jobs: DeadLetterJob[]; severity: string; }>;
      platformPatterns: Array<{ type: string; description: string; jobs: DeadLetterJob[]; severity: string; }>;
      businessPatterns: Array<{ type: string; description: string; jobs: DeadLetterJob[]; severity: string; }>;
      similarJobs: DeadLetterJob[];
    }
  ): Promise<void> {
    const allPatterns = [
      ...analysis.timePatterns,
      ...analysis.platformPatterns,
      ...analysis.businessPatterns,
    ];

    for (const pattern of allPatterns) {
      const patternKey = `${tenantId}_${pattern.type}_${deadLetterJob.originalQueue}_${deadLetterJob.failureType}`;
      
      // Check if pattern already exists
      let existingPattern = await this.patternRepository.findOne({
        where: this.addTenantFilter(tenantId, { patternKey }),
      });

      if (existingPattern) {
        // Update existing pattern
        existingPattern.occurrenceCount += 1;
        existingPattern.affectedJobsCount += pattern.jobs.length;
        existingPattern.lastOccurrenceAt = new Date();
        
        // Update severity if needed
        if (pattern.severity === 'critical' && existingPattern.severity !== PatternSeverity.CRITICAL) {
          existingPattern.severity = PatternSeverity.CRITICAL;
        }
        
        await this.patternRepository.save(existingPattern);
      } else {
        // Create new pattern
        const newPattern = this.patternRepository.create({
          tenantId,
          patternKey,
          patternName: pattern.description,
          patternDescription: `Pattern detected: ${pattern.description}`,
          patternType: this.mapPatternType(pattern.type),
          severity: this.mapPatternSeverity(pattern.severity),
          status: PatternStatus.ACTIVE,
          failureType: deadLetterJob.failureType,
          originalQueue: deadLetterJob.originalQueue,
          originalJobType: deadLetterJob.originalJobType,
          channelId: deadLetterJob.channelId,
          platform: deadLetterJob.platform,
          occurrenceCount: 1,
          affectedJobsCount: pattern.jobs.length,
          firstOccurrenceAt: new Date(),
          lastOccurrenceAt: new Date(),
          patternConditions: this.generatePatternConditions(pattern),
          patternMetadata: {
            averageFailureRate: pattern.jobs.length / analysis.similarJobs.length,
            peakFailureHours: [new Date().getHours()],
            commonErrorCodes: [deadLetterJob.failureType],
            affectedPlatforms: [deadLetterJob.platform || 'unknown'],
            recoverySuccessRate: 0,
            averageRecoveryTime: 0,
            businessImpact: {
              severity: pattern.severity,
              affectedTenants: 1,
              estimatedLoss: 0,
            },
            recommendations: [
              ...this.generateMitigationStrategies(pattern).preventionActions,
              ...this.generateMitigationStrategies(pattern).recoveryActions,
            ],
          },
          detectionRules: this.generateDetectionRules(pattern),
          mitigationStrategies: this.generateMitigationStrategies(pattern),
          isActive: true,
          isAutoDetected: true,
          requiresImmediateAttention: pattern.severity === 'critical',
          timezone: 'Asia/Jakarta',
          affectsIndonesianBusinessHours: pattern.type === 'business_hours',
          ramadanPattern: pattern.type === 'seasonal_pattern' && pattern.description.includes('Ramadan'),
          holidayPattern: pattern.type === 'seasonal_pattern' && pattern.description.includes('Holiday'),
          exampleJobId: deadLetterJob.id,
        });
        
        await this.patternRepository.save(newPattern);
      }
    }
  }

  /**
   * Indonesian business hours helper methods
   */
  private isWithinIndonesianBusinessHours(): boolean {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    const day = jakartaTime.getDay();

    // Monday to Friday, 9 AM to 5 PM Jakarta time
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  private getNextIndonesianBusinessHour(): Date {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const nextBusinessHour = new Date(jakartaTime);
    
    nextBusinessHour.setHours(9, 0, 0, 0);
    
    const currentDay = nextBusinessHour.getDay();
    
    // If weekend, move to Monday
    if (currentDay === 0) { // Sunday
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 1);
    } else if (currentDay === 6) { // Saturday
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 2);
    } else if (jakartaTime.getHours() >= 17) { // After business hours
      nextBusinessHour.setDate(nextBusinessHour.getDate() + 1);
    }
    
    return nextBusinessHour;
  }

  private calculateNextRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter for Indonesian business context
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes
    const backoffMultiplier = 2;
    
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(backoffMultiplier, retryCount),
      maxDelay
    );
    
    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    return Math.max(1000, exponentialDelay + jitter);
  }

  // Pattern mapping helper methods
  private mapPatternType(type: string): PatternType {
    switch (type) {
      case 'time_based_failure':
        return PatternType.TIME_BASED_FAILURE;
      case 'platform_specific':
        return PatternType.PLATFORM_SPECIFIC;
      case 'business_hours':
        return PatternType.BUSINESS_HOURS;
      case 'rate_limit_pattern':
        return PatternType.RATE_LIMIT_PATTERN;
      case 'authentication_pattern':
        return PatternType.AUTHENTICATION_PATTERN;
      case 'seasonal_pattern':
        return PatternType.SEASONAL_PATTERN;
      case 'escalation_pattern':
        return PatternType.ESCALATION_PATTERN;
      default:
        return PatternType.RECURRING_FAILURE;
    }
  }

  private mapPatternSeverity(severity: string): PatternSeverity {
    switch (severity) {
      case 'critical':
        return PatternSeverity.CRITICAL;
      case 'high':
        return PatternSeverity.HIGH;
      case 'medium':
        return PatternSeverity.MEDIUM;
      default:
        return PatternSeverity.LOW;
    }
  }

  private generatePatternConditions(pattern: any): any {
    return {
      patternType: pattern.type,
      minimumOccurrences: 3,
      timeWindow: {
        hours: 24,
        timezoneSensitive: true,
        timezone: 'Asia/Jakarta',
      },
      businessContext: {
        isIndonesianBusiness: true,
        respectsBusinessHours: true,
        ramadanSensitive: pattern.type === 'seasonal_pattern' && pattern.description.includes('Ramadan'),
        holidaySensitive: pattern.type === 'seasonal_pattern' && pattern.description.includes('Holiday'),
      },
    };
  }

  private generateDetectionRules(pattern: any): any {
    return {
      minOccurrences: 3,
      timeWindowMinutes: 1440, // 24 hours
      similarityThreshold: 0.8,
      excludePatterns: ['maintenance_window'],
      includePatterns: [pattern.type],
    };
  }

  private generateMitigationStrategies(pattern: any): any {
    const preventionActions = [];
    const recoveryActions = [];
    
    if (pattern.type === 'rate_limit_pattern') {
      preventionActions.push('Implement exponential backoff for rate limited requests');
      recoveryActions.push('Use circuit breaker pattern to prevent cascading failures');
    }
    
    if (pattern.type === 'authentication_pattern') {
      preventionActions.push('Automatically refresh authentication credentials');
      recoveryActions.push('Escalate to manual credential verification');
    }
    
    if (pattern.type === 'business_hours') {
      preventionActions.push('Schedule retry operations during Indonesian business hours');
      recoveryActions.push('Queue operations for next business day');
    }
    
    return {
      preventionActions,
      recoveryActions,
      escalationRules: [{
        condition: 'failure_count_exceeds_threshold',
        action: 'notify_admin',
        delay: 300000, // 5 minutes
      }],
      automaticRetryStrategy: {
        enabled: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        respectBusinessHours: pattern.type === 'business_hours',
      },
    };
  }

  private calculatePatternStrength(patternJobs: number, totalJobs: number): number {
    return Math.min(1, patternJobs / totalJobs);
  }
}