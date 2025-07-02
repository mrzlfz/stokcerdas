import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In, Not } from 'typeorm';
import { IntegrationLog, IntegrationLogLevel, IntegrationLogType } from '../../entities/integration-log.entity';

export interface CreateLogEntry {
  tenantId: string;
  channelId?: string;
  type: IntegrationLogType;
  level: IntegrationLogLevel;
  requestId?: string;
  message: string;
  details?: string;
  metadata?: Record<string, any>;
  httpMethod?: string;
  httpUrl?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LogQuery {
  tenantId: string;
  channelId?: string;
  type?: IntegrationLogType | IntegrationLogType[];
  level?: IntegrationLogLevel | IntegrationLogLevel[];
  requestId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'level';
  orderDirection?: 'ASC' | 'DESC';
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<IntegrationLogLevel, number>;
  logsByType: Record<IntegrationLogType, number>;
  errorRate: number;
  avgResponseTime: number;
  topErrors: Array<{
    errorCode: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

@Injectable()
export class IntegrationLogService {
  private readonly logger = new Logger(IntegrationLogService.name);

  constructor(
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
  ) {}

  /**
   * Create a new log entry
   */
  async log(entry: CreateLogEntry): Promise<IntegrationLog> {
    try {
      const logEntry = this.logRepository.create(entry);
      return await this.logRepository.save(logEntry);
    } catch (error) {
      this.logger.error(`Failed to create log entry: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Log API request
   */
  async logApiRequest(
    tenantId: string,
    channelId: string,
    requestId: string,
    method: string,
    url: string,
    metadata?: Record<string, any>,
  ): Promise<IntegrationLog> {
    return this.log({
      tenantId,
      channelId,
      type: IntegrationLogType.API_REQUEST,
      level: IntegrationLogLevel.DEBUG,
      requestId,
      message: `${method} ${url}`,
      httpMethod: method,
      httpUrl: url,
      metadata,
    });
  }

  /**
   * Log API response
   */
  async logApiResponse(
    tenantId: string,
    channelId: string,
    requestId: string,
    method: string,
    url: string,
    status: number,
    responseTimeMs: number,
    metadata?: Record<string, any>,
  ): Promise<IntegrationLog> {
    const level = status >= 400 ? IntegrationLogLevel.ERROR : IntegrationLogLevel.DEBUG;
    
    return this.log({
      tenantId,
      channelId,
      type: IntegrationLogType.API_RESPONSE,
      level,
      requestId,
      message: `${method} ${url} - ${status} (${responseTimeMs}ms)`,
      httpMethod: method,
      httpUrl: url,
      httpStatus: status,
      responseTimeMs,
      metadata,
    });
  }

  /**
   * Log webhook event
   */
  async logWebhook(
    tenantId: string,
    channelId: string,
    eventType: string,
    status: 'received' | 'processed' | 'failed',
    details?: string,
    metadata?: Record<string, any>,
  ): Promise<IntegrationLog> {
    const level = status === 'failed' ? IntegrationLogLevel.ERROR : IntegrationLogLevel.INFO;
    
    return this.log({
      tenantId,
      channelId,
      type: IntegrationLogType.WEBHOOK,
      level,
      message: `Webhook ${eventType} - ${status}`,
      details,
      metadata,
    });
  }

  /**
   * Log sync operation
   */
  async logSync(
    tenantId: string,
    channelId: string,
    syncType: string,
    status: 'started' | 'completed' | 'failed',
    details?: string,
    metadata?: Record<string, any>,
  ): Promise<IntegrationLog> {
    const level = status === 'failed' ? IntegrationLogLevel.ERROR : IntegrationLogLevel.INFO;
    
    return this.log({
      tenantId,
      channelId,
      type: IntegrationLogType.SYNC,
      level,
      message: `Sync ${syncType} - ${status}`,
      details,
      metadata,
    });
  }

  /**
   * Log authentication events
   */
  async logAuth(
    tenantId: string,
    channelId: string,
    authType: string,
    status: 'success' | 'failed',
    details?: string,
    metadata?: Record<string, any>,
  ): Promise<IntegrationLog> {
    const level = status === 'failed' ? IntegrationLogLevel.WARN : IntegrationLogLevel.INFO;
    
    return this.log({
      tenantId,
      channelId,
      type: IntegrationLogType.AUTH,
      level,
      message: `Authentication ${authType} - ${status}`,
      details,
      metadata,
    });
  }

  /**
   * Log error with full context
   */
  async logError(
    tenantId: string,
    channelId: string,
    error: Error,
    context?: {
      requestId?: string;
      httpMethod?: string;
      httpUrl?: string;
      httpStatus?: number;
      metadata?: Record<string, any>;
    },
  ): Promise<IntegrationLog> {
    return this.log({
      tenantId,
      channelId,
      type: IntegrationLogType.ERROR,
      level: IntegrationLogLevel.ERROR,
      requestId: context?.requestId,
      message: error.message,
      errorMessage: error.message,
      stackTrace: error.stack,
      httpMethod: context?.httpMethod,
      httpUrl: context?.httpUrl,
      httpStatus: context?.httpStatus,
      metadata: context?.metadata,
    });
  }

  /**
   * Query logs with filters
   */
  async queryLogs(query: LogQuery): Promise<{
    logs: IntegrationLog[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<IntegrationLog> = {
        tenantId: query.tenantId,
      };

      if (query.channelId) {
        where.channelId = query.channelId;
      }

      if (query.type) {
        where.type = Array.isArray(query.type) ? In(query.type) : query.type;
      }

      if (query.level) {
        where.level = Array.isArray(query.level) ? In(query.level) : query.level;
      }

      if (query.requestId) {
        where.requestId = query.requestId;
      }

      if (query.startDate || query.endDate) {
        where.createdAt = Between(
          query.startDate || new Date(0),
          query.endDate || new Date(),
        );
      }

      const [logs, total] = await this.logRepository.findAndCount({
        where,
        order: {
          [query.orderBy || 'createdAt']: query.orderDirection || 'DESC',
        },
        take: query.limit || 100,
        skip: query.offset || 0,
        relations: ['channel'],
      });

      return { logs, total };
    } catch (error) {
      this.logger.error(`Failed to query logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(
    tenantId: string,
    channelId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<LogStats> {
    try {
      const where: FindOptionsWhere<IntegrationLog> = {
        tenantId,
      };

      if (channelId) {
        where.channelId = channelId;
      }

      if (startDate || endDate) {
        where.createdAt = Between(
          startDate || new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          endDate || new Date(),
        );
      }

      // Get total logs
      const totalLogs = await this.logRepository.count({ where });

      // Get logs by level
      const logsByLevel = {};
      for (const level of Object.values(IntegrationLogLevel)) {
        logsByLevel[level] = await this.logRepository.count({
          where: { ...where, level },
        });
      }

      // Get logs by type
      const logsByType = {};
      for (const type of Object.values(IntegrationLogType)) {
        logsByType[type] = await this.logRepository.count({
          where: { ...where, type },
        });
      }

      // Calculate error rate
      const errorLogs = logsByLevel[IntegrationLogLevel.ERROR] || 0;
      const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

      // Calculate average response time
      const apiResponseLogs = await this.logRepository.find({
        where: {
          ...where,
          type: IntegrationLogType.API_RESPONSE,
          responseTimeMs: Not(null),
        },
        select: ['responseTimeMs'],
      });

      const avgResponseTime = apiResponseLogs.length > 0
        ? apiResponseLogs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) / apiResponseLogs.length
        : 0;

      // Get top errors
      const topErrorsQuery = await this.logRepository
        .createQueryBuilder('log')
        .select('log.errorCode', 'errorCode')
        .addSelect('COUNT(*)', 'count')
        .addSelect('MAX(log.createdAt)', 'lastOccurrence')
        .where('log.tenantId = :tenantId', { tenantId })
        .andWhere('log.level = :level', { level: IntegrationLogLevel.ERROR })
        .andWhere('log.errorCode IS NOT NULL');

      if (channelId) {
        topErrorsQuery.andWhere('log.channelId = :channelId', { channelId });
      }

      if (startDate || endDate) {
        topErrorsQuery.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
          startDate: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: endDate || new Date(),
        });
      }

      const rawTopErrors = await topErrorsQuery
        .groupBy('log.errorCode')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      const topErrors = rawTopErrors.map(error => ({
        errorCode: error.errorCode,
        count: parseInt(error.count),
        lastOccurrence: new Date(error.lastOccurrence),
      }));

      return {
        totalLogs,
        logsByLevel: logsByLevel as Record<IntegrationLogLevel, number>,
        logsByType: logsByType as Record<IntegrationLogType, number>,
        errorRate,
        avgResponseTime,
        topErrors,
      };
    } catch (error) {
      this.logger.error(`Failed to get log stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(
    tenantId: string,
    olderThanDays: number = 30,
    maxLogsToKeep: number = 100000,
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Delete logs older than cutoff date
      const deleteResult = await this.logRepository
        .createQueryBuilder()
        .delete()
        .where('tenantId = :tenantId', { tenantId })
        .andWhere('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      const deletedCount = deleteResult.affected || 0;

      // If we still have too many logs, delete oldest ones
      const remainingCount = await this.logRepository.count({
        where: { tenantId },
      });

      if (remainingCount > maxLogsToKeep) {
        const excessLogs = remainingCount - maxLogsToKeep;
        const oldestLogs = await this.logRepository.find({
          where: { tenantId },
          order: { createdAt: 'ASC' },
          take: excessLogs,
          select: ['id'],
        });

        if (oldestLogs.length > 0) {
          const idsToDelete = oldestLogs.map(log => log.id);
          await this.logRepository.delete({ id: In(idsToDelete) });
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old logs for tenant ${tenantId}`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup old logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get logs for a specific request ID
   */
  async getRequestLogs(
    tenantId: string,
    requestId: string,
  ): Promise<IntegrationLog[]> {
    return this.logRepository.find({
      where: {
        tenantId,
        requestId,
      },
      order: {
        createdAt: 'ASC',
      },
      relations: ['channel'],
    });
  }

  /**
   * Get recent error logs
   */
  async getRecentErrors(
    tenantId: string,
    channelId?: string,
    limit: number = 50,
  ): Promise<IntegrationLog[]> {
    const where: FindOptionsWhere<IntegrationLog> = {
      tenantId,
      level: IntegrationLogLevel.ERROR,
    };

    if (channelId) {
      where.channelId = channelId;
    }

    return this.logRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
      take: limit,
      relations: ['channel'],
    });
  }
}