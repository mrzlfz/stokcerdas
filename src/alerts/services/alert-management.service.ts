import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AlertInstance, AlertStatus, AlertPriority } from '../entities/alert-instance.entity';
import { AlertConfiguration, AlertType, AlertSeverity } from '../entities/alert-configuration.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { 
  AcknowledgeAlertDto, 
  ResolveAlertDto, 
  DismissAlertDto, 
  SnoozeAlertDto, 
  EscalateAlertDto,
  UpdateAlertPriorityDto,
  BulkAlertActionDto,
  AlertQueryDto,
  CreateSystemMaintenanceAlertDto 
} from '../dto/alert-management.dto';

@Injectable()
export class AlertManagementService {
  private readonly logger = new Logger(AlertManagementService.name);

  constructor(
    @InjectRepository(AlertInstance)
    private readonly alertInstanceRepository: Repository<AlertInstance>,
    @InjectRepository(AlertConfiguration)
    private readonly alertConfigRepository: Repository<AlertConfiguration>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create new alert instance
   */
  async createAlert(
    tenantId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    data?: any,
    productId?: string,
    locationId?: string,
    inventoryItemId?: string,
    configurationId?: string,
  ): Promise<AlertInstance> {
    const priority = this.mapSeverityToPriority(severity);

    const alertInstance = this.alertInstanceRepository.create({
      tenantId,
      alertType,
      severity,
      priority,
      title,
      message,
      productId,
      locationId,
      inventoryItemId,
      configurationId,
      data: data || {},
      status: AlertStatus.ACTIVE,
      notificationStatus: {},
      viewedBy: [],
      viewHistory: {},
      tags: [],
    });

    const savedAlert = await this.alertInstanceRepository.save(alertInstance);

    // Emit event for real-time notifications
    this.eventEmitter.emit('alert.created', {
      tenantId,
      alert: savedAlert,
    });

    this.logger.log(`Alert created: ${alertType} for tenant ${tenantId} - ${title}`);

    return savedAlert;
  }

  /**
   * Find alerts with filtering and pagination
   */
  async findAll(
    tenantId: string,
    query: AlertQueryDto,
  ): Promise<{
    data: AlertInstance[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      stats: {
        active: number;
        acknowledged: number;
        resolved: number;
        snoozed: number;
      };
    };
  }> {
    const {
      status,
      alertType,
      severity,
      priority,
      productId,
      locationId,
      createdFrom,
      createdTo,
      acknowledged,
      resolved,
      activeOnly,
      unviewedOnly,
      tags,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.alertInstanceRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.product', 'product')
      .leftJoinAndSelect('alert.location', 'location')
      .leftJoinAndSelect('alert.inventoryItem', 'inventoryItem')
      .leftJoinAndSelect('alert.configuration', 'configuration')
      .leftJoinAndSelect('alert.acknowledger', 'acknowledger')
      .leftJoinAndSelect('alert.resolver', 'resolver')
      .where('alert.tenantId = :tenantId', { tenantId });

    // Apply filters
    if (status) {
      queryBuilder.andWhere('alert.status = :status', { status });
    }

    if (alertType) {
      queryBuilder.andWhere('alert.alertType = :alertType', { alertType });
    }

    if (severity) {
      queryBuilder.andWhere('alert.severity = :severity', { severity });
    }

    if (priority) {
      queryBuilder.andWhere('alert.priority = :priority', { priority });
    }

    if (productId) {
      queryBuilder.andWhere('alert.productId = :productId', { productId });
    }

    if (locationId) {
      queryBuilder.andWhere('alert.locationId = :locationId', { locationId });
    }

    if (createdFrom) {
      queryBuilder.andWhere('alert.createdAt >= :createdFrom', { 
        createdFrom: new Date(createdFrom) 
      });
    }

    if (createdTo) {
      queryBuilder.andWhere('alert.createdAt <= :createdTo', { 
        createdTo: new Date(createdTo) 
      });
    }

    if (acknowledged === true) {
      queryBuilder.andWhere('alert.acknowledgedAt IS NOT NULL');
    } else if (acknowledged === false) {
      queryBuilder.andWhere('alert.acknowledgedAt IS NULL');
    }

    if (resolved === true) {
      queryBuilder.andWhere('alert.resolvedAt IS NOT NULL');
    } else if (resolved === false) {
      queryBuilder.andWhere('alert.resolvedAt IS NULL');
    }

    if (activeOnly) {
      queryBuilder.andWhere('alert.status = :activeStatus', { 
        activeStatus: AlertStatus.ACTIVE 
      });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('alert.tags && :tags', { tags });
    }

    if (search) {
      queryBuilder.andWhere(
        '(alert.title ILIKE :search OR alert.message ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Get stats before pagination
    const statsQueryBuilder = queryBuilder.clone();
    const statsResults = await statsQueryBuilder
      .select('alert.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('alert.status')
      .getRawMany();

    const stats = {
      active: 0,
      acknowledged: 0,
      resolved: 0,
      snoozed: 0,
    };

    statsResults.forEach(stat => {
      if (stat.status in stats) {
        stats[stat.status] = parseInt(stat.count);
      }
    });

    // Count total
    const total = await queryBuilder.getCount();

    // Apply sorting
    const validSortFields = [
      'alert.createdAt',
      'alert.updatedAt',
      'alert.severity',
      'alert.priority',
      'alert.status',
      'alert.title',
      'product.name',
      'location.name',
    ];

    if (validSortFields.includes(`alert.${sortBy}`) || validSortFields.includes(sortBy)) {
      const sortField = sortBy.includes('.') ? sortBy : `alert.${sortBy}`;
      queryBuilder.orderBy(sortField, sortOrder);
    } else {
      queryBuilder.orderBy('alert.createdAt', 'DESC');
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const data = await queryBuilder.getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats,
      },
    };
  }

  /**
   * Find alert by ID
   */
  async findOne(tenantId: string, id: string): Promise<AlertInstance> {
    const alert = await this.alertInstanceRepository.findOne({
      where: { id, tenantId },
      relations: [
        'product', 
        'location', 
        'inventoryItem', 
        'configuration',
        'acknowledger',
        'resolver',
        'dismisser',
        'snoozer',
        'escalator',
        'escalatee',
      ],
    });

    if (!alert) {
      throw new NotFoundException('Alert tidak ditemukan');
    }

    return alert;
  }

  /**
   * Mark alert as viewed by user
   */
  async markAsViewed(tenantId: string, id: string, userId: string): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);
    
    alert.markAsViewed(userId);
    await this.alertInstanceRepository.save(alert);

    return alert;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(
    tenantId: string,
    id: string,
    acknowledgeDto: AcknowledgeAlertDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);

    if (!alert.canBeAcknowledged()) {
      throw new BadRequestException('Alert tidak dapat di-acknowledge dalam status ini');
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    alert.acknowledgeNotes = acknowledgeDto.notes;

    const savedAlert = await this.alertInstanceRepository.save(alert);

    // Emit event
    this.eventEmitter.emit('alert.acknowledged', {
      tenantId,
      alert: savedAlert,
      userId,
    });

    this.logger.log(`Alert acknowledged: ${id} by user ${userId}`);

    return savedAlert;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(
    tenantId: string,
    id: string,
    resolveDto: ResolveAlertDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);

    if (!alert.canBeResolved()) {
      throw new BadRequestException('Alert tidak dapat di-resolve dalam status ini');
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = resolveDto.resolutionNotes;

    const savedAlert = await this.alertInstanceRepository.save(alert);

    // Emit event
    this.eventEmitter.emit('alert.resolved', {
      tenantId,
      alert: savedAlert,
      userId,
    });

    this.logger.log(`Alert resolved: ${id} by user ${userId}`);

    return savedAlert;
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(
    tenantId: string,
    id: string,
    dismissDto: DismissAlertDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);

    if (!alert.canBeDismissed()) {
      throw new BadRequestException('Alert tidak dapat di-dismiss');
    }

    alert.status = AlertStatus.DISMISSED;
    alert.dismissedBy = userId;
    alert.dismissedAt = new Date();
    alert.dismissalReason = dismissDto.dismissalReason;

    const savedAlert = await this.alertInstanceRepository.save(alert);

    // Emit event
    this.eventEmitter.emit('alert.dismissed', {
      tenantId,
      alert: savedAlert,
      userId,
    });

    this.logger.log(`Alert dismissed: ${id} by user ${userId}`);

    return savedAlert;
  }

  /**
   * Snooze alert
   */
  async snoozeAlert(
    tenantId: string,
    id: string,
    snoozeDto: SnoozeAlertDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);

    if (!alert.canBeSnoozed()) {
      throw new BadRequestException('Alert tidak dapat di-snooze dalam status ini');
    }

    // Check if alert configuration allows snoozing
    if (alert.configuration && !alert.configuration.canSnooze()) {
      throw new BadRequestException('Alert ini tidak dapat di-snooze berdasarkan konfigurasi');
    }

    // Check snooze duration limits
    const maxSnoozeHours = alert.configuration?.getMaxSnoozeHours() || 24;
    if (snoozeDto.snoozeHours > maxSnoozeHours) {
      throw new BadRequestException(`Maksimum snooze adalah ${maxSnoozeHours} jam`);
    }

    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + snoozeDto.snoozeHours);

    alert.status = AlertStatus.SNOOZED;
    alert.snoozedBy = userId;
    alert.snoozedAt = new Date();
    alert.snoozeUntil = snoozeUntil;
    alert.snoozeReason = snoozeDto.reason;
    alert.snoozeCount += 1;

    const savedAlert = await this.alertInstanceRepository.save(alert);

    // Emit event
    this.eventEmitter.emit('alert.snoozed', {
      tenantId,
      alert: savedAlert,
      userId,
      snoozeUntil,
    });

    this.logger.log(`Alert snoozed: ${id} by user ${userId} until ${snoozeUntil}`);

    return savedAlert;
  }

  /**
   * Escalate alert
   */
  async escalateAlert(
    tenantId: string,
    id: string,
    escalateDto: EscalateAlertDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);

    alert.status = AlertStatus.ESCALATED;
    alert.escalatedBy = userId;
    alert.escalatedAt = new Date();
    alert.escalatedTo = escalateDto.escalateTo;
    alert.escalationReason = escalateDto.reason;

    // Increase priority if not already critical
    if (alert.priority !== AlertPriority.CRITICAL) {
      const priorities = Object.values(AlertPriority);
      const currentIndex = priorities.indexOf(alert.priority);
      alert.priority = priorities[Math.min(currentIndex + 1, priorities.length - 1)];
    }

    const savedAlert = await this.alertInstanceRepository.save(alert);

    // Emit event
    this.eventEmitter.emit('alert.escalated', {
      tenantId,
      alert: savedAlert,
      userId,
      escalatedTo: escalateDto.escalateTo,
    });

    this.logger.log(`Alert escalated: ${id} by user ${userId} to user ${escalateDto.escalateTo}`);

    return savedAlert;
  }

  /**
   * Update alert priority
   */
  async updatePriority(
    tenantId: string,
    id: string,
    updateDto: UpdateAlertPriorityDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);

    const oldPriority = alert.priority;
    alert.priority = updateDto.priority;
    
    if (updateDto.reason) {
      alert.notes = alert.notes 
        ? `${alert.notes}\n\nPriority changed from ${oldPriority} to ${updateDto.priority}: ${updateDto.reason}`
        : `Priority changed from ${oldPriority} to ${updateDto.priority}: ${updateDto.reason}`;
    }

    const savedAlert = await this.alertInstanceRepository.save(alert);

    // Emit event
    this.eventEmitter.emit('alert.priority.updated', {
      tenantId,
      alert: savedAlert,
      userId,
      oldPriority,
      newPriority: updateDto.priority,
    });

    return savedAlert;
  }

  /**
   * Add tag to alert
   */
  async addTag(tenantId: string, id: string, tag: string): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);
    alert.addTag(tag);
    return await this.alertInstanceRepository.save(alert);
  }

  /**
   * Remove tag from alert
   */
  async removeTag(tenantId: string, id: string, tag: string): Promise<AlertInstance> {
    const alert = await this.findOne(tenantId, id);
    alert.removeTag(tag);
    return await this.alertInstanceRepository.save(alert);
  }

  /**
   * Bulk actions on alerts
   */
  async bulkAction(
    tenantId: string,
    bulkActionDto: BulkAlertActionDto,
    userId: string,
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const alertId of bulkActionDto.alertIds) {
      try {
        switch (bulkActionDto.action) {
          case 'acknowledge':
            await this.acknowledgeAlert(tenantId, alertId, { 
              notes: bulkActionDto.actionData?.notes 
            }, userId);
            break;
          
          case 'resolve':
            await this.resolveAlert(tenantId, alertId, { 
              resolutionNotes: bulkActionDto.actionData?.resolutionNotes || 'Bulk resolved' 
            }, userId);
            break;
          
          case 'dismiss':
            await this.dismissAlert(tenantId, alertId, { 
              dismissalReason: bulkActionDto.actionData?.dismissalReason || 'Bulk dismissed' 
            }, userId);
            break;
          
          case 'snooze':
            await this.snoozeAlert(tenantId, alertId, { 
              snoozeHours: bulkActionDto.actionData?.snoozeHours || 1,
              reason: bulkActionDto.actionData?.reason 
            }, userId);
            break;
        }
        
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: alertId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Create system maintenance alert
   */
  async createSystemMaintenanceAlert(
    tenantId: string,
    maintenanceDto: CreateSystemMaintenanceAlertDto,
    userId: string,
  ): Promise<AlertInstance> {
    const alert = await this.createAlert(
      tenantId,
      AlertType.SYSTEM_MAINTENANCE,
      maintenanceDto.severity as AlertSeverity || AlertSeverity.WARNING,
      maintenanceDto.title,
      maintenanceDto.message,
      {
        maintenanceWindow: {
          start: maintenanceDto.scheduledStart,
          end: maintenanceDto.scheduledEnd,
        },
        affectedServices: maintenanceDto.affectedServices || [],
      },
    );

    if (maintenanceDto.sendImmediately) {
      // Emit event for immediate notification
      this.eventEmitter.emit('alert.maintenance.immediate', {
        tenantId,
        alert,
      });
    }

    return alert;
  }

  /**
   * Get alert statistics
   */
  async getStatistics(tenantId: string, days: number = 30): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    averageResolutionTime: number;
    alertsByType: Record<string, number>;
    alertsBySeverity: Record<string, number>;
    trendData: Array<{ date: string; count: number }>;
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const queryBuilder = this.alertInstanceRepository
      .createQueryBuilder('alert')
      .where('alert.tenantId = :tenantId', { tenantId })
      .andWhere('alert.createdAt >= :fromDate', { fromDate });

    const [
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      alertsByType,
      alertsBySeverity,
      resolutionTimes,
    ] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere('alert.status = :status', { status: AlertStatus.ACTIVE }).getCount(),
      queryBuilder.clone().andWhere('alert.status = :status', { status: AlertStatus.RESOLVED }).getCount(),
      queryBuilder
        .clone()
        .select('alert.alertType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('alert.alertType')
        .getRawMany(),
      queryBuilder
        .clone()
        .select('alert.severity', 'severity')
        .addSelect('COUNT(*)', 'count')
        .groupBy('alert.severity')
        .getRawMany(),
      queryBuilder
        .clone()
        .select('EXTRACT(EPOCH FROM (alert.resolvedAt - alert.createdAt))/3600', 'hours')
        .where('alert.resolvedAt IS NOT NULL')
        .getRawMany(),
    ]);

    // Calculate average resolution time
    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, item) => sum + parseFloat(item.hours), 0) / resolutionTimes.length
      : 0;

    // Format data
    const alertsByTypeFormatted = alertsByType.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});

    const alertsBySeverityFormatted = alertsBySeverity.reduce((acc, item) => {
      acc[item.severity] = parseInt(item.count);
      return acc;
    }, {});

    // Generate trend data (daily counts)
    const trendData = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await this.alertInstanceRepository.count({
        where: {
          tenantId,
          createdAt: Between(dayStart, dayEnd),
        },
      });

      trendData.push({ date: dateStr, count });
    }

    return {
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      averageResolutionTime: Math.round(avgResolutionTime * 100) / 100,
      alertsByType: alertsByTypeFormatted,
      alertsBySeverity: alertsBySeverityFormatted,
      trendData,
    };
  }

  /**
   * Check for snoozed alerts that should be reactivated
   */
  async reactivateSnoozedAlerts(): Promise<void> {
    const snoozedAlerts = await this.alertInstanceRepository.find({
      where: {
        status: AlertStatus.SNOOZED,
        snoozeUntil: Between(new Date(0), new Date()), // snoozeUntil <= now
      },
    });

    for (const alert of snoozedAlerts) {
      alert.status = AlertStatus.ACTIVE;
      await this.alertInstanceRepository.save(alert);

      // Emit reactivation event
      this.eventEmitter.emit('alert.reactivated', {
        tenantId: alert.tenantId,
        alert,
      });
    }

    if (snoozedAlerts.length > 0) {
      this.logger.log(`Reactivated ${snoozedAlerts.length} snoozed alerts`);
    }
  }

  // Private helper methods
  private mapSeverityToPriority(severity: AlertSeverity): AlertPriority {
    switch (severity) {
      case AlertSeverity.INFO:
        return AlertPriority.LOW;
      case AlertSeverity.WARNING:
        return AlertPriority.MEDIUM;
      case AlertSeverity.CRITICAL:
        return AlertPriority.CRITICAL;
      default:
        return AlertPriority.MEDIUM;
    }
  }
}