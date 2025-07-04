import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, In, Like } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  SOC2AuditLog,
  SOC2AuditLogRetentionRule,
  SOC2AuditLogAlert,
  AuditEventType,
  AuditEventSeverity,
  AuditEventOutcome,
} from '../entities/soc2-audit-log.entity';
import { User } from '../../users/entities/user.entity';

export interface AuditLogEntry {
  eventType: AuditEventType;
  eventDescription: string;
  severity?: AuditEventSeverity;
  outcome: AuditEventOutcome;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  correlationId?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  httpMethod?: string;
  httpUrl?: string;
  httpStatusCode?: number;
  responseTimeMs?: number;
  sourceSystem?: string;
  sourceModule?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  additionalData?: any;
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  department?: string;
  location?: string;
}

export interface AuditLogQuery {
  tenantId: string;
  eventTypes?: AuditEventType[];
  severity?: AuditEventSeverity[];
  outcome?: AuditEventOutcome[];
  userId?: string;
  ipAddress?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'severity' | 'riskScore';
  orderDirection?: 'ASC' | 'DESC';
}

export interface SecurityAnalysis {
  timeRange: {
    start: Date;
    end: Date;
  };
  totalEvents: number;
  securityEvents: number;
  privilegedActions: number;
  failedAttempts: number;
  suspiciousActivity: number;
  topUsers: {
    userId: string;
    userEmail: string;
    eventCount: number;
    riskScore: number;
  }[];
  topIpAddresses: {
    ipAddress: string;
    eventCount: number;
    uniqueUsers: number;
    riskScore: number;
  }[];
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditEventSeverity, number>;
  riskTrends: {
    hour: number;
    riskScore: number;
    eventCount: number;
  }[];
  alerts: {
    alertType: string;
    description: string;
    severity: AuditEventSeverity;
    triggerCount: number;
    lastTriggered: Date;
  }[];
}

@Injectable()
export class SOC2AuditLogService {
  private readonly logger = new Logger(SOC2AuditLogService.name);

  constructor(
    @InjectRepository(SOC2AuditLog)
    private readonly auditLogRepository: Repository<SOC2AuditLog>,
    @InjectRepository(SOC2AuditLogRetentionRule)
    private readonly retentionRuleRepository: Repository<SOC2AuditLogRetentionRule>,
    @InjectRepository(SOC2AuditLogAlert)
    private readonly alertRepository: Repository<SOC2AuditLogAlert>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Log an audit event
   */
  async logEvent(
    tenantId: string,
    logEntry: AuditLogEntry,
  ): Promise<SOC2AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        tenantId,
        ...logEntry,
        severity: logEntry.severity || AuditEventSeverity.LOW,
        timestamp: new Date(),
      });

      const savedLog = await this.auditLogRepository.save(auditLog);

      // Emit event for real-time monitoring
      this.eventEmitter.emit('soc2.audit.event_logged', {
        tenantId,
        eventType: logEntry.eventType,
        severity: auditLog.severity,
        riskScore: savedLog.riskScore,
        timestamp: savedLog.timestamp,
      });

      // Check for alerts
      await this.checkAlerts(tenantId, savedLog);

      return savedLog;
    } catch (error) {
      this.logger.error(
        `Error logging audit event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    tenantId: string,
    eventType: AuditEventType,
    outcome: AuditEventOutcome,
    user?: User,
    ipAddress?: string,
    userAgent?: string,
    additionalData?: any,
  ): Promise<SOC2AuditLog> {
    const severity = this.determineAuthEventSeverity(eventType, outcome);
    const description = this.generateAuthEventDescription(
      eventType,
      outcome,
      user?.email,
    );

    return this.logEvent(tenantId, {
      eventType,
      eventDescription: description,
      severity,
      outcome,
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      ipAddress,
      userAgent,
      sourceSystem: 'API',
      sourceModule: 'Authentication',
      additionalData,
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    tenantId: string,
    eventType: AuditEventType,
    user: User,
    resourceType: string,
    resourceId: string,
    resourceName?: string,
    httpMethod?: string,
    httpUrl?: string,
    outcome: AuditEventOutcome = AuditEventOutcome.SUCCESS,
    additionalData?: any,
  ): Promise<SOC2AuditLog> {
    const description = `${user.email} ${this.getActionDescription(
      eventType,
    )} ${resourceType} ${resourceName || resourceId}`;

    return this.logEvent(tenantId, {
      eventType,
      eventDescription: description,
      severity: AuditEventSeverity.LOW,
      outcome,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      resourceType,
      resourceId,
      resourceName,
      httpMethod,
      httpUrl,
      sourceSystem: 'API',
      sourceModule: 'Data Access',
      additionalData,
    });
  }

  /**
   * Log privileged actions
   */
  async logPrivilegedAction(
    tenantId: string,
    eventType: AuditEventType,
    user: User,
    description: string,
    outcome: AuditEventOutcome,
    previousValues?: Record<string, any>,
    newValues?: Record<string, any>,
    additionalData?: any,
  ): Promise<SOC2AuditLog> {
    return this.logEvent(tenantId, {
      eventType,
      eventDescription: description,
      severity: AuditEventSeverity.HIGH,
      outcome,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      sourceSystem: 'API',
      sourceModule: 'Administration',
      previousValues,
      newValues,
      additionalData,
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    tenantId: string,
    eventType: AuditEventType,
    description: string,
    severity: AuditEventSeverity,
    ipAddress?: string,
    userId?: string,
    additionalData?: any,
  ): Promise<SOC2AuditLog> {
    return this.logEvent(tenantId, {
      eventType,
      eventDescription: description,
      severity,
      outcome: AuditEventOutcome.WARNING,
      userId,
      ipAddress,
      sourceSystem: 'Security Monitoring',
      sourceModule: 'Threat Detection',
      additionalData,
    });
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditLogQuery): Promise<{
    logs: SOC2AuditLog[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<SOC2AuditLog> = {
        tenantId: query.tenantId,
        isDeleted: false,
      };

      if (query.eventTypes?.length) {
        where.eventType = In(query.eventTypes);
      }

      if (query.severity?.length) {
        where.severity = In(query.severity);
      }

      if (query.outcome?.length) {
        where.outcome = In(query.outcome);
      }

      if (query.userId) {
        where.userId = query.userId;
      }

      if (query.ipAddress) {
        where.ipAddress = query.ipAddress;
      }

      if (query.resourceType) {
        where.resourceType = query.resourceType;
      }

      if (query.startDate || query.endDate) {
        where.timestamp = Between(
          query.startDate || new Date(0),
          query.endDate || new Date(),
        );
      }

      // Handle search term
      if (query.searchTerm) {
        where.eventDescription = Like(`%${query.searchTerm}%`);
      }

      const [logs, total] = await this.auditLogRepository.findAndCount({
        where,
        relations: ['user'],
        order: {
          [query.orderBy || 'timestamp']: query.orderDirection || 'DESC',
        },
        take: query.limit || 100,
        skip: query.offset || 0,
      });

      return { logs, total };
    } catch (error) {
      this.logger.error(
        `Error querying audit logs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate security analysis report
   */
  async generateSecurityAnalysis(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SecurityAnalysis> {
    try {
      const logs = await this.auditLogRepository.find({
        where: {
          tenantId,
          timestamp: Between(startDate, endDate),
          isDeleted: false,
        },
        relations: ['user'],
      });

      const totalEvents = logs.length;
      const securityEvents = logs.filter(log => log.isSecurityEvent).length;
      const privilegedActions = logs.filter(
        log => log.isPrivilegedAction,
      ).length;
      const failedAttempts = logs.filter(
        log => log.outcome === AuditEventOutcome.FAILURE,
      ).length;
      const suspiciousActivity = logs.filter(
        log =>
          log.eventType === AuditEventType.SUSPICIOUS_ACTIVITY ||
          log.eventType === AuditEventType.BRUTE_FORCE_ATTEMPT ||
          log.eventType === AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      ).length;

      // Analyze users
      const userStats = new Map<
        string,
        {
          userId: string;
          userEmail: string;
          eventCount: number;
          riskScore: number;
        }
      >();

      // Analyze IP addresses
      const ipStats = new Map<
        string,
        {
          ipAddress: string;
          eventCount: number;
          uniqueUsers: Set<string>;
          riskScore: number;
        }
      >();

      // Event type and severity counters
      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};

      // Risk trends by hour
      const riskTrends: Map<number, { riskScore: number; eventCount: number }> =
        new Map();

      for (const log of logs) {
        // User statistics
        if (log.userId && log.userEmail) {
          const userStat = userStats.get(log.userId) || {
            userId: log.userId,
            userEmail: log.userEmail,
            eventCount: 0,
            riskScore: 0,
          };
          userStat.eventCount++;
          userStat.riskScore += log.riskScore;
          userStats.set(log.userId, userStat);
        }

        // IP address statistics
        if (log.ipAddress) {
          const ipStat = ipStats.get(log.ipAddress) || {
            ipAddress: log.ipAddress,
            eventCount: 0,
            uniqueUsers: new Set<string>(),
            riskScore: 0,
          };
          ipStat.eventCount++;
          if (log.userId) ipStat.uniqueUsers.add(log.userId);
          ipStat.riskScore += log.riskScore;
          ipStats.set(log.ipAddress, ipStat);
        }

        // Event type counting
        eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;
        eventsBySeverity[log.severity] =
          (eventsBySeverity[log.severity] || 0) + 1;

        // Risk trends by hour
        const hour = log.timestamp.getHours();
        const trend = riskTrends.get(hour) || { riskScore: 0, eventCount: 0 };
        trend.riskScore += log.riskScore;
        trend.eventCount++;
        riskTrends.set(hour, trend);
      }

      // Get top users by risk score
      const topUsers = Array.from(userStats.values())
        .map(user => ({
          ...user,
          riskScore: user.riskScore / user.eventCount, // Average risk score
        }))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10);

      // Get top IP addresses by risk score
      const topIpAddresses = Array.from(ipStats.values())
        .map(ip => ({
          ipAddress: ip.ipAddress,
          eventCount: ip.eventCount,
          uniqueUsers: ip.uniqueUsers.size,
          riskScore: ip.riskScore / ip.eventCount, // Average risk score
        }))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10);

      // Format risk trends
      const riskTrendsArray = Array.from(riskTrends.entries())
        .map(([hour, data]) => ({
          hour,
          riskScore: data.riskScore / data.eventCount,
          eventCount: data.eventCount,
        }))
        .sort((a, b) => a.hour - b.hour);

      // Get recent alerts
      const alerts = await this.getRecentAlerts(tenantId, startDate, endDate);

      return {
        timeRange: { start: startDate, end: endDate },
        totalEvents,
        securityEvents,
        privilegedActions,
        failedAttempts,
        suspiciousActivity,
        topUsers,
        topIpAddresses,
        eventsByType: eventsByType as Record<AuditEventType, number>,
        eventsBySeverity: eventsBySeverity as Record<
          AuditEventSeverity,
          number
        >,
        riskTrends: riskTrendsArray,
        alerts,
      };
    } catch (error) {
      this.logger.error(
        `Error generating security analysis: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clean up old audit logs based on retention rules
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldLogs(): Promise<void> {
    try {
      this.logger.log('Starting audit log cleanup...');

      const retentionRules = await this.retentionRuleRepository.find({
        where: { isActive: true, isDeleted: false },
      });

      for (const rule of retentionRules) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - rule.retentionDays);

        const deleteResult = await this.auditLogRepository
          .createQueryBuilder()
          .delete()
          .where('eventType = :eventType', { eventType: rule.eventType })
          .andWhere('timestamp < :cutoffDate', { cutoffDate })
          .andWhere('NOT requiresLegalHold', {
            requiresLegalHold: rule.requiresLegalHold,
          })
          .execute();

        const deletedCount = deleteResult.affected || 0;
        if (deletedCount > 0) {
          this.logger.log(
            `Deleted ${deletedCount} logs for event type: ${rule.eventType}`,
          );
        }
      }

      this.logger.log('Audit log cleanup completed');
    } catch (error) {
      this.logger.error(
        `Error during audit log cleanup: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check for security alerts based on audit log patterns
   */
  private async checkAlerts(
    tenantId: string,
    log: SOC2AuditLog,
  ): Promise<void> {
    try {
      const alerts = await this.alertRepository.find({
        where: {
          tenantId,
          isActive: true,
          isDeleted: false,
        },
      });

      for (const alert of alerts) {
        const shouldTrigger = await this.evaluateAlertConditions(alert, log);

        if (shouldTrigger) {
          await this.triggerAlert(alert, log);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking alerts: ${error.message}`, error.stack);
    }
  }

  private async evaluateAlertConditions(
    alert: SOC2AuditLogAlert,
    log: SOC2AuditLog,
  ): Promise<boolean> {
    const conditions = alert.conditions;

    // Check event types
    if (
      conditions.eventTypes &&
      !conditions.eventTypes.includes(log.eventType)
    ) {
      return false;
    }

    // Check severity
    if (conditions.severity && !conditions.severity.includes(log.severity)) {
      return false;
    }

    // Check risk score threshold
    if (
      conditions.riskScoreThreshold &&
      log.riskScore < conditions.riskScoreThreshold
    ) {
      return false;
    }

    // Check time window and threshold for frequency-based alerts
    if (conditions.timeWindow && conditions.threshold) {
      const windowStart = new Date(
        Date.now() - conditions.timeWindow * 60 * 1000,
      );
      const recentEvents = await this.auditLogRepository.count({
        where: {
          tenantId: log.tenantId,
          eventType: In(conditions.eventTypes || [log.eventType]),
          timestamp: Between(windowStart, new Date()),
          isDeleted: false,
        },
      });

      if (recentEvents < conditions.threshold) {
        return false;
      }
    }

    return true;
  }

  private async triggerAlert(
    alert: SOC2AuditLogAlert,
    log: SOC2AuditLog,
  ): Promise<void> {
    try {
      // Update alert statistics
      alert.triggerCount++;
      alert.lastTriggered = new Date();
      await this.alertRepository.save(alert);

      // Emit alert event
      this.eventEmitter.emit('soc2.audit.alert_triggered', {
        alertId: alert.id,
        alertName: alert.alertName,
        alertType: alert.alertType,
        severity: alert.alertSeverity,
        tenantId: log.tenantId,
        triggeringEvent: {
          eventType: log.eventType,
          eventDescription: log.eventDescription,
          userId: log.userId,
          userEmail: log.userEmail,
          ipAddress: log.ipAddress,
          timestamp: log.timestamp,
        },
        actions: alert.actions,
      });

      this.logger.warn(
        `Alert triggered: ${alert.alertName} for event: ${log.eventType}`,
      );
    } catch (error) {
      this.logger.error(
        `Error triggering alert: ${error.message}`,
        error.stack,
      );
    }
  }

  private async getRecentAlerts(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const alerts = await this.alertRepository.find({
      where: {
        tenantId,
        lastTriggered: Between(startDate, endDate),
        isDeleted: false,
      },
      order: { lastTriggered: 'DESC' },
      take: 50,
    });

    return alerts.map(alert => ({
      alertType: alert.alertType,
      description: alert.description,
      severity: alert.alertSeverity,
      triggerCount: alert.triggerCount,
      lastTriggered: alert.lastTriggered,
    }));
  }

  // Event listeners for automatic audit logging

  @OnEvent('auth.login.success')
  async handleLoginSuccess(payload: any): Promise<void> {
    await this.logAuthEvent(
      payload.tenantId,
      AuditEventType.LOGIN_SUCCESS,
      AuditEventOutcome.SUCCESS,
      payload.user,
      payload.ipAddress,
      payload.userAgent,
    );
  }

  @OnEvent('auth.login.failure')
  async handleLoginFailure(payload: any): Promise<void> {
    await this.logAuthEvent(
      payload.tenantId,
      AuditEventType.LOGIN_FAILURE,
      AuditEventOutcome.FAILURE,
      payload.user,
      payload.ipAddress,
      payload.userAgent,
      { reason: payload.reason },
    );
  }

  @OnEvent('user.created')
  async handleUserCreated(payload: any): Promise<void> {
    await this.logPrivilegedAction(
      payload.tenantId,
      AuditEventType.USER_CREATED,
      payload.createdBy,
      `User created: ${payload.user.email}`,
      AuditEventOutcome.SUCCESS,
      {},
      payload.user,
    );
  }

  @OnEvent('inventory.adjustment')
  async handleInventoryAdjustment(payload: any): Promise<void> {
    await this.logDataAccess(
      payload.tenantId,
      AuditEventType.INVENTORY_ADJUSTMENT,
      payload.user,
      'inventory',
      payload.inventoryId,
      payload.productName,
      'POST',
      '/api/v1/inventory/adjustments',
      AuditEventOutcome.SUCCESS,
      {
        previousQuantity: payload.previousQuantity,
        newQuantity: payload.newQuantity,
        reason: payload.reason,
      },
    );
  }

  // Helper methods

  private determineAuthEventSeverity(
    eventType: AuditEventType,
    outcome: AuditEventOutcome,
  ): AuditEventSeverity {
    if (outcome === AuditEventOutcome.FAILURE) {
      switch (eventType) {
        case AuditEventType.LOGIN_FAILURE:
        case AuditEventType.BRUTE_FORCE_ATTEMPT:
          return AuditEventSeverity.HIGH;
        default:
          return AuditEventSeverity.MEDIUM;
      }
    }

    return AuditEventSeverity.LOW;
  }

  private generateAuthEventDescription(
    eventType: AuditEventType,
    outcome: AuditEventOutcome,
    userEmail?: string,
  ): string {
    const action = eventType.replace('_', ' ').toLowerCase();
    const status =
      outcome === AuditEventOutcome.SUCCESS ? 'successful' : 'failed';
    const user = userEmail ? ` for ${userEmail}` : '';

    return `${status} ${action}${user}`;
  }

  private getActionDescription(eventType: AuditEventType): string {
    switch (eventType) {
      case AuditEventType.DATA_ACCESS:
        return 'accessed';
      case AuditEventType.DATA_CREATE:
        return 'created';
      case AuditEventType.DATA_UPDATE:
        return 'updated';
      case AuditEventType.DATA_DELETE:
        return 'deleted';
      case AuditEventType.DATA_EXPORT:
        return 'exported';
      case AuditEventType.DATA_IMPORT:
        return 'imported';
      default:
        return 'performed action on';
    }
  }
}
