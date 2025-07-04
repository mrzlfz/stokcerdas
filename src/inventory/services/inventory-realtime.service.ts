import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryLocation } from '../entities/inventory-location.entity';

export interface InventoryUpdateEvent {
  tenantId: string;
  type: 'inventory_update' | 'stock_alert' | 'location_update';
  data: any;
  timestamp: Date;
}

export interface StockAlert {
  type:
    | 'low_stock'
    | 'out_of_stock'
    | 'overstock'
    | 'expiring_soon'
    | 'expired'
    | 'reorder_needed';
  severity: 'info' | 'warning' | 'critical';
  inventoryItem: InventoryItem;
  message: string;
  threshold?: number;
  currentValue?: number;
}

@Injectable()
export class InventoryRealtimeService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit real-time inventory update
   */
  async emitInventoryUpdate(
    tenantId: string,
    inventoryItem: InventoryItem,
  ): Promise<void> {
    const event: InventoryUpdateEvent = {
      tenantId,
      type: 'inventory_update',
      data: {
        id: inventoryItem.id,
        productId: inventoryItem.productId,
        locationId: inventoryItem.locationId,
        quantityOnHand: inventoryItem.quantityOnHand,
        quantityReserved: inventoryItem.quantityReserved,
        quantityAllocated: inventoryItem.quantityAllocated,
        quantityAvailable: inventoryItem.quantityAvailable,
        totalValue: inventoryItem.totalValue,
        averageCost: inventoryItem.averageCost,
        lastMovementAt: inventoryItem.lastMovementAt,
        // Include product and location info for context
        product: inventoryItem.product
          ? {
              id: inventoryItem.product.id,
              name: inventoryItem.product.name,
              sku: inventoryItem.product.sku,
              barcode: inventoryItem.product.barcode,
            }
          : undefined,
        location: inventoryItem.location
          ? {
              id: inventoryItem.location.id,
              name: inventoryItem.location.name,
              code: inventoryItem.location.code,
            }
          : undefined,
      },
      timestamp: new Date(),
    };

    // Emit event for WebSocket clients
    this.eventEmitter.emit('inventory.updated', event);

    // Emit tenant-specific event
    this.eventEmitter.emit(`inventory.updated.${tenantId}`, event);
  }

  /**
   * Emit location update
   */
  async emitLocationUpdate(
    tenantId: string,
    location: InventoryLocation,
  ): Promise<void> {
    const event: InventoryUpdateEvent = {
      tenantId,
      type: 'location_update',
      data: {
        id: location.id,
        code: location.code,
        name: location.name,
        type: location.type,
        status: location.status,
        parentId: location.parentId,
        isActive: location.isActive,
      },
      timestamp: new Date(),
    };

    // Emit event for WebSocket clients
    this.eventEmitter.emit('location.updated', event);

    // Emit tenant-specific event
    this.eventEmitter.emit(`location.updated.${tenantId}`, event);
  }

  /**
   * Check and emit alerts for inventory item
   */
  async checkAndEmitAlerts(
    tenantId: string,
    inventoryItem: InventoryItem,
  ): Promise<StockAlert[]> {
    const alerts: StockAlert[] = [];

    // Check low stock
    const lowStockAlert = this.checkLowStock(inventoryItem);
    if (lowStockAlert) {
      alerts.push(lowStockAlert);
    }

    // Check out of stock
    const outOfStockAlert = this.checkOutOfStock(inventoryItem);
    if (outOfStockAlert) {
      alerts.push(outOfStockAlert);
    }

    // Check overstock
    const overstockAlert = this.checkOverstock(inventoryItem);
    if (overstockAlert) {
      alerts.push(overstockAlert);
    }

    // Check expiring soon
    const expiringSoonAlert = this.checkExpiringSoon(inventoryItem);
    if (expiringSoonAlert) {
      alerts.push(expiringSoonAlert);
    }

    // Check expired
    const expiredAlert = this.checkExpired(inventoryItem);
    if (expiredAlert) {
      alerts.push(expiredAlert);
    }

    // Check reorder needed
    const reorderAlert = this.checkReorderNeeded(inventoryItem);
    if (reorderAlert) {
      alerts.push(reorderAlert);
    }

    // Emit alerts
    for (const alert of alerts) {
      await this.emitStockAlert(tenantId, alert);
    }

    return alerts;
  }

  /**
   * Emit stock alert
   */
  private async emitStockAlert(
    tenantId: string,
    alert: StockAlert,
  ): Promise<void> {
    const event: InventoryUpdateEvent = {
      tenantId,
      type: 'stock_alert',
      data: alert,
      timestamp: new Date(),
    };

    // Emit general alert event
    this.eventEmitter.emit('inventory.alert', event);

    // Emit tenant-specific alert event
    this.eventEmitter.emit(`inventory.alert.${tenantId}`, event);

    // Emit alert type specific event
    this.eventEmitter.emit(`inventory.alert.${alert.type}`, event);
    this.eventEmitter.emit(`inventory.alert.${alert.type}.${tenantId}`, event);
  }

  /**
   * Calculate real-time inventory metrics
   */
  async calculateInventoryMetrics(inventoryItem: InventoryItem): Promise<{
    quantityAvailable: number;
    stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock';
    daysOfStock: number | null;
    turnoverRate: number | null;
    reorderSuggestion: {
      shouldReorder: boolean;
      suggestedQuantity: number;
      urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    };
  }> {
    const quantityAvailable = inventoryItem.quantityAvailable;

    // Determine stock status
    let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock' =
      'in_stock';

    if (quantityAvailable <= 0) {
      stockStatus = 'out_of_stock';
    } else if (inventoryItem.isLowStock) {
      stockStatus = 'low_stock';
    } else if (inventoryItem.isOverStock) {
      stockStatus = 'overstock';
    }

    // Calculate days of stock (simplified - would need sales data for accurate calculation)
    let daysOfStock: number | null = null;
    if (
      inventoryItem.product?.salesCount &&
      inventoryItem.product.salesCount > 0
    ) {
      // Assume average daily sales based on total sales count (this is simplified)
      const averageDailySales = inventoryItem.product.salesCount / 365; // Very rough estimate
      if (averageDailySales > 0) {
        daysOfStock = Math.floor(quantityAvailable / averageDailySales);
      }
    }

    // Calculate turnover rate (simplified)
    let turnoverRate: number | null = null;
    if (inventoryItem.product?.totalRevenue && inventoryItem.totalValue > 0) {
      turnoverRate =
        inventoryItem.product.totalRevenue / inventoryItem.totalValue;
    }

    // Reorder suggestion
    const reorderSuggestion = this.calculateReorderSuggestion(inventoryItem);

    return {
      quantityAvailable,
      stockStatus,
      daysOfStock,
      turnoverRate,
      reorderSuggestion,
    };
  }

  /**
   * Get real-time stock levels for multiple items
   */
  async getRealtimeStockLevels(inventoryItems: InventoryItem[]): Promise<
    Array<{
      inventoryItemId: string;
      productId: string;
      locationId: string;
      quantityOnHand: number;
      quantityAvailable: number;
      metrics: any;
      alerts: StockAlert[];
    }>
  > {
    const results = [];

    for (const item of inventoryItems) {
      const metrics = await this.calculateInventoryMetrics(item);
      const alerts = await this.checkAndEmitAlerts(item.tenantId, item);

      results.push({
        inventoryItemId: item.id,
        productId: item.productId,
        locationId: item.locationId,
        quantityOnHand: item.quantityOnHand,
        quantityAvailable: item.quantityAvailable,
        metrics,
        alerts,
      });
    }

    return results;
  }

  // Private alert check methods
  private checkLowStock(inventoryItem: InventoryItem): StockAlert | null {
    if (!inventoryItem.isLowStock) return null;

    const reorderPoint =
      inventoryItem.reorderPoint || inventoryItem.product?.reorderPoint || 0;

    return {
      type: 'low_stock',
      severity: 'warning',
      inventoryItem,
      message: `Stok produk ${
        inventoryItem.product?.name || 'Unknown'
      } di lokasi ${inventoryItem.location?.name || 'Unknown'} sudah rendah`,
      threshold: reorderPoint,
      currentValue: inventoryItem.quantityAvailable,
    };
  }

  private checkOutOfStock(inventoryItem: InventoryItem): StockAlert | null {
    if (!inventoryItem.isOutOfStock) return null;

    return {
      type: 'out_of_stock',
      severity: 'critical',
      inventoryItem,
      message: `Stok produk ${
        inventoryItem.product?.name || 'Unknown'
      } di lokasi ${inventoryItem.location?.name || 'Unknown'} habis`,
      threshold: 0,
      currentValue: inventoryItem.quantityAvailable,
    };
  }

  private checkOverstock(inventoryItem: InventoryItem): StockAlert | null {
    if (!inventoryItem.isOverStock) return null;

    const maxStock =
      inventoryItem.maxStock || inventoryItem.product?.maxStock || 0;

    return {
      type: 'overstock',
      severity: 'info',
      inventoryItem,
      message: `Stok produk ${
        inventoryItem.product?.name || 'Unknown'
      } di lokasi ${
        inventoryItem.location?.name || 'Unknown'
      } melebihi batas maksimum`,
      threshold: maxStock,
      currentValue: inventoryItem.quantityOnHand,
    };
  }

  private checkExpiringSoon(inventoryItem: InventoryItem): StockAlert | null {
    if (!inventoryItem.isExpiringSoon) return null;

    return {
      type: 'expiring_soon',
      severity: 'warning',
      inventoryItem,
      message: `Produk ${inventoryItem.product?.name || 'Unknown'} di lokasi ${
        inventoryItem.location?.name || 'Unknown'
      } akan segera kadaluarsa`,
      threshold: 30, // days
      currentValue: inventoryItem.expiryDate
        ? Math.ceil(
            (inventoryItem.expiryDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : undefined,
    };
  }

  private checkExpired(inventoryItem: InventoryItem): StockAlert | null {
    if (!inventoryItem.isExpired) return null;

    return {
      type: 'expired',
      severity: 'critical',
      inventoryItem,
      message: `Produk ${inventoryItem.product?.name || 'Unknown'} di lokasi ${
        inventoryItem.location?.name || 'Unknown'
      } sudah kadaluarsa`,
      threshold: 0,
      currentValue: inventoryItem.expiryDate
        ? Math.ceil(
            (inventoryItem.expiryDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : undefined,
    };
  }

  private checkReorderNeeded(inventoryItem: InventoryItem): StockAlert | null {
    if (!inventoryItem.needsReorder) return null;

    return {
      type: 'reorder_needed',
      severity: 'warning',
      inventoryItem,
      message: `Perlu reorder produk ${
        inventoryItem.product?.name || 'Unknown'
      } di lokasi ${inventoryItem.location?.name || 'Unknown'}`,
      threshold:
        inventoryItem.reorderPoint || inventoryItem.product?.reorderPoint || 0,
      currentValue: inventoryItem.quantityOnHand,
    };
  }

  private calculateReorderSuggestion(inventoryItem: InventoryItem): {
    shouldReorder: boolean;
    suggestedQuantity: number;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const quantityAvailable = inventoryItem.quantityAvailable;
    const reorderPoint =
      inventoryItem.reorderPoint || inventoryItem.product?.reorderPoint || 0;
    const reorderQuantity =
      inventoryItem.reorderQuantity ||
      inventoryItem.product?.reorderQuantity ||
      0;
    const maxStock =
      inventoryItem.maxStock || inventoryItem.product?.maxStock || 0;

    let shouldReorder = false;
    let suggestedQuantity = 0;
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (quantityAvailable <= 0) {
      shouldReorder = true;
      urgencyLevel = 'critical';
      suggestedQuantity = Math.max(
        reorderQuantity,
        maxStock || reorderQuantity,
      );
    } else if (quantityAvailable <= reorderPoint) {
      shouldReorder = true;
      urgencyLevel =
        quantityAvailable <= reorderPoint * 0.5 ? 'high' : 'medium';

      if (maxStock > 0) {
        suggestedQuantity = maxStock - quantityAvailable;
      } else {
        suggestedQuantity = reorderQuantity;
      }
    }

    return {
      shouldReorder,
      suggestedQuantity: Math.max(0, suggestedQuantity),
      urgencyLevel,
    };
  }
}
