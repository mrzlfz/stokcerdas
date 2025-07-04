import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AlertManagementService } from './alert-management.service';
import { AlertConfigurationService } from './alert-configuration.service';
import {
  AlertType,
  AlertSeverity,
} from '../entities/alert-configuration.entity';
import {
  AlertInstance,
  AlertStatus,
  AlertPriority,
} from '../entities/alert-instance.entity';
import {
  InventoryUpdateEvent,
  StockAlert,
} from '../../inventory/services/inventory-realtime.service';

@Injectable()
export class AlertIntegrationService {
  private readonly logger = new Logger(AlertIntegrationService.name);

  constructor(
    private readonly alertManagementService: AlertManagementService,
    private readonly alertConfigurationService: AlertConfigurationService,
    @InjectRepository(AlertInstance)
    private readonly alertInstanceRepository: Repository<AlertInstance>,
  ) {}

  /**
   * Handle inventory alert events and create persistent alert instances
   */
  @OnEvent('inventory.alert')
  async handleInventoryAlert(event: InventoryUpdateEvent): Promise<void> {
    try {
      const alert = event.data as StockAlert;
      const { tenantId } = event;

      // Check if there's a configuration for this alert type
      const configuration =
        await this.alertConfigurationService.getConfigurationForAlert(
          tenantId,
          this.mapStockAlertTypeToAlertType(alert.type),
          alert.inventoryItem.productId,
          alert.inventoryItem.locationId,
        );

      // Skip if alert type is disabled
      if (configuration && !configuration.isEnabled) {
        this.logger.debug(
          `Alert type ${alert.type} disabled for tenant ${tenantId}`,
        );
        return;
      }

      // Check if similar alert already exists and is active
      const existingAlert = await this.findSimilarActiveAlert(
        tenantId,
        alert.type,
        alert.inventoryItem.productId,
        alert.inventoryItem.locationId,
      );

      if (existingAlert) {
        // Update existing alert with new data
        await this.updateExistingAlert(existingAlert, alert);
        this.logger.debug(
          `Updated existing alert ${existingAlert.id} for ${alert.type}`,
        );
        return;
      }

      // Create new alert instance
      const alertInstance = await this.createAlertInstance(
        tenantId,
        alert,
        configuration?.id,
      );

      this.logger.log(
        `Created alert instance ${alertInstance.id} for ${alert.type} - ${
          alert.inventoryItem.product?.name || 'Unknown'
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling inventory alert: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle inventory updates to auto-resolve alerts
   */
  @OnEvent('inventory.updated')
  async handleInventoryUpdate(event: InventoryUpdateEvent): Promise<void> {
    try {
      const { tenantId, data } = event;

      // Check if this update resolves any active alerts
      await this.checkAndResolveAlerts(tenantId, data);
    } catch (error) {
      this.logger.error(
        `Error handling inventory update for alerts: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create new alert instance from stock alert
   */
  private async createAlertInstance(
    tenantId: string,
    stockAlert: StockAlert,
    configurationId?: string,
  ): Promise<AlertInstance> {
    const alertType = this.mapStockAlertTypeToAlertType(stockAlert.type);
    const severity = stockAlert.severity as AlertSeverity;

    const title = this.generateAlertTitle(stockAlert);
    const message = stockAlert.message;

    const alertData = {
      currentQuantity: stockAlert.currentValue,
      threshold: stockAlert.threshold,
      reorderPoint:
        stockAlert.inventoryItem.reorderPoint ||
        stockAlert.inventoryItem.product?.reorderPoint,
      availableQuantity: stockAlert.inventoryItem.quantityAvailable,
    };

    // Add expiry-specific data
    if (stockAlert.type === 'expiring_soon' || stockAlert.type === 'expired') {
      alertData['expiryDate'] =
        stockAlert.inventoryItem.expiryDate?.toISOString();
      alertData['daysUntilExpiry'] = stockAlert.currentValue;
    }

    return await this.alertManagementService.createAlert(
      tenantId,
      alertType,
      severity,
      title,
      message,
      alertData,
      stockAlert.inventoryItem.productId,
      stockAlert.inventoryItem.locationId,
      stockAlert.inventoryItem.id,
      configurationId,
    );
  }

  /**
   * Update existing alert with new data
   */
  private async updateExistingAlert(
    existingAlert: AlertInstance,
    stockAlert: StockAlert,
  ): Promise<void> {
    // Update alert data
    existingAlert.data = {
      ...existingAlert.data,
      currentQuantity: stockAlert.currentValue,
      threshold: stockAlert.threshold,
      availableQuantity: stockAlert.inventoryItem.quantityAvailable,
      previousValues: {
        quantity: existingAlert.data?.currentQuantity,
      },
    };

    // Update message if condition worsened
    if (this.isConditionWorsening(existingAlert, stockAlert)) {
      existingAlert.message = stockAlert.message;
      existingAlert.priority = this.escalatePriority(existingAlert.priority);
    }

    await this.alertInstanceRepository.save(existingAlert);
  }

  /**
   * Find similar active alert
   */
  private async findSimilarActiveAlert(
    tenantId: string,
    alertType: string,
    productId: string,
    locationId: string,
  ): Promise<AlertInstance | null> {
    return await this.alertInstanceRepository.findOne({
      where: {
        tenantId,
        alertType: this.mapStockAlertTypeToAlertType(alertType),
        productId,
        locationId,
        status: AlertStatus.ACTIVE,
      },
      relations: ['product', 'location'],
    });
  }

  /**
   * Check and resolve alerts when inventory conditions improve
   */
  private async checkAndResolveAlerts(
    tenantId: string,
    inventoryData: any,
  ): Promise<void> {
    const {
      id: inventoryItemId,
      quantityAvailable,
      expiryDate,
    } = inventoryData;

    // Find active alerts for this inventory item
    const activeAlerts = await this.alertInstanceRepository.find({
      where: {
        tenantId,
        inventoryItemId,
        status: AlertStatus.ACTIVE,
      },
    });

    for (const alert of activeAlerts) {
      let shouldResolve = false;
      const resolutionNotes = [];

      // Check stock-related alerts
      if (
        ['low_stock', 'out_of_stock', 'reorder_needed'].includes(
          alert.alertType,
        )
      ) {
        const threshold = alert.data?.threshold || 0;
        if (quantityAvailable > threshold) {
          shouldResolve = true;
          resolutionNotes.push(
            `Stok kembali tersedia: ${quantityAvailable} > ${threshold}`,
          );
        }
      }

      // Check expiry alerts
      if (alert.alertType === 'expiring_soon' && expiryDate) {
        const daysUntilExpiry = Math.ceil(
          (new Date(expiryDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const warningDays = alert.data?.daysUntilExpiry || 30;

        if (daysUntilExpiry > warningDays) {
          shouldResolve = true;
          resolutionNotes.push(
            `Tanggal kadaluarsa diperpanjang: ${daysUntilExpiry} hari`,
          );
        }
      }

      if (shouldResolve) {
        await this.alertManagementService.resolveAlert(
          tenantId,
          alert.id,
          { resolutionNotes: `Auto-resolved: ${resolutionNotes.join(', ')}` },
          'system',
        );

        this.logger.log(
          `Auto-resolved alert ${alert.id}: ${resolutionNotes.join(', ')}`,
        );
      }
    }
  }

  /**
   * Map stock alert type to alert type enum
   */
  private mapStockAlertTypeToAlertType(stockAlertType: string): AlertType {
    const mapping = {
      low_stock: AlertType.LOW_STOCK,
      out_of_stock: AlertType.OUT_OF_STOCK,
      overstock: AlertType.OVERSTOCK,
      expiring_soon: AlertType.EXPIRING_SOON,
      expired: AlertType.EXPIRED,
      reorder_needed: AlertType.REORDER_NEEDED,
    };

    return mapping[stockAlertType] || AlertType.LOW_STOCK;
  }

  /**
   * Generate alert title
   */
  private generateAlertTitle(stockAlert: StockAlert): string {
    const productName =
      stockAlert.inventoryItem.product?.name || 'Unknown Product';
    const locationName =
      stockAlert.inventoryItem.location?.name || 'Unknown Location';

    const titles = {
      low_stock: `Stok Rendah: ${productName}`,
      out_of_stock: `Stok Habis: ${productName}`,
      overstock: `Stok Berlebih: ${productName}`,
      expiring_soon: `Segera Kadaluarsa: ${productName}`,
      expired: `Sudah Kadaluarsa: ${productName}`,
      reorder_needed: `Perlu Reorder: ${productName}`,
    };

    return titles[stockAlert.type] || `Alert: ${productName}`;
  }

  /**
   * Check if condition is worsening
   */
  private isConditionWorsening(
    existingAlert: AlertInstance,
    newStockAlert: StockAlert,
  ): boolean {
    const previousValue = existingAlert.data?.currentQuantity || 0;
    const currentValue = newStockAlert.currentValue || 0;

    // For stock alerts, lower is worse
    if (['low_stock', 'out_of_stock'].includes(newStockAlert.type)) {
      return currentValue < previousValue;
    }

    // For expiry alerts, fewer days is worse
    if (['expiring_soon', 'expired'].includes(newStockAlert.type)) {
      return currentValue < previousValue;
    }

    return false;
  }

  /**
   * Escalate priority
   */
  private escalatePriority(currentPriority: AlertPriority): AlertPriority {
    const priorities = [
      AlertPriority.LOW,
      AlertPriority.MEDIUM,
      AlertPriority.HIGH,
      AlertPriority.CRITICAL,
    ];
    const currentIndex = priorities.indexOf(currentPriority);
    return priorities[Math.min(currentIndex + 1, priorities.length - 1)];
  }

  /**
   * Handle system events for maintenance alerts
   */
  @OnEvent('system.maintenance.scheduled')
  async handleSystemMaintenance(event: {
    tenantId: string;
    title: string;
    message: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    affectedServices?: string[];
  }): Promise<void> {
    try {
      await this.alertManagementService.createSystemMaintenanceAlert(
        event.tenantId,
        {
          title: event.title,
          message: event.message,
          scheduledStart: event.scheduledStart,
          scheduledEnd: event.scheduledEnd,
          affectedServices: event.affectedServices,
          sendImmediately: true,
        },
        'system',
      );

      this.logger.log(
        `Created system maintenance alert for tenant ${event.tenantId}: ${event.title}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating system maintenance alert: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Cleanup old resolved alerts
   */
  async cleanupOldAlerts(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.alertInstanceRepository
      .createQueryBuilder()
      .delete()
      .where('status IN (:...statuses)', {
        statuses: ['resolved', 'dismissed'],
      })
      .andWhere('updatedAt < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = result.affected || 0;

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} old alert instances`);
    }

    return deletedCount;
  }
}
