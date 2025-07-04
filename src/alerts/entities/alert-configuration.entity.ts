import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { Product } from '../../products/entities/product.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { User } from '../../users/entities/user.entity';

export enum AlertType {
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  OVERSTOCK = 'overstock',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  REORDER_NEEDED = 'reorder_needed',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  ORDER_STATUS_UPDATE = 'order_status_update',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('alert_configurations')
@Index(['tenantId', 'alertType'])
@Index(['tenantId', 'productId', 'locationId'])
export class AlertConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: AlertType,
  })
  alertType: AlertType;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.WARNING,
  })
  severity: AlertSeverity;

  @Column({ default: true })
  isEnabled: boolean;

  // Product-specific configuration (optional)
  @Column({ nullable: true })
  productId?: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  // Location-specific configuration (optional)
  @Column({ nullable: true })
  locationId?: string;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'locationId' })
  location?: InventoryLocation;

  // Alert-specific configuration (JSON)
  @Column({ type: 'jsonb', nullable: true })
  configuration?: {
    // For stock alerts
    reorderPoint?: number;
    maxStock?: number;
    reorderQuantity?: number;

    // For expiry alerts
    expiryWarningDays?: number;

    // For system alerts
    maintenanceMessage?: string;
    scheduledMaintenanceAt?: string;

    // Notification settings
    enablePushNotification?: boolean;
    enableEmailNotification?: boolean;
    enableSmsNotification?: boolean;

    // Snooze settings
    allowSnooze?: boolean;
    maxSnoozeHours?: number;

    // Escalation settings
    escalateAfterHours?: number;
    escalateToUserId?: string;
  };

  // Recipients configuration
  @Column({ type: 'text', array: true, default: [] })
  recipientUserIds: string[];

  @Column({ type: 'text', array: true, default: [] })
  recipientRoles: string[];

  @Column({ type: 'text', array: true, default: [] })
  recipientEmails: string[];

  // Schedule configuration for recurring alerts
  @Column({ type: 'jsonb', nullable: true })
  schedule?: {
    enabled: boolean;
    cronExpression?: string;
    timezone?: string;
    quietHours?: {
      start: string; // HH:mm format
      end: string; // HH:mm format
    };
    days?: number[]; // 0-6 (Sunday-Saturday)
  };

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column()
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column()
  updatedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updater: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isGlobalConfiguration(): boolean {
    return !this.productId && !this.locationId;
  }

  isProductSpecific(): boolean {
    return !!this.productId && !this.locationId;
  }

  isLocationSpecific(): boolean {
    return !this.productId && !!this.locationId;
  }

  isProductLocationSpecific(): boolean {
    return !!this.productId && !!this.locationId;
  }

  getReorderPoint(): number | null {
    return this.configuration?.reorderPoint || null;
  }

  getMaxStock(): number | null {
    return this.configuration?.maxStock || null;
  }

  getExpiryWarningDays(): number {
    return this.configuration?.expiryWarningDays || 30;
  }

  isInQuietHours(date: Date = new Date()): boolean {
    if (!this.schedule?.quietHours) return false;

    const timeString = date.toTimeString().slice(0, 5); // HH:mm
    const { start, end } = this.schedule.quietHours;

    if (start <= end) {
      return timeString >= start && timeString <= end;
    } else {
      // Crosses midnight
      return timeString >= start || timeString <= end;
    }
  }

  shouldSendOnDay(date: Date = new Date()): boolean {
    if (!this.schedule?.days?.length) return true;
    return this.schedule.days.includes(date.getDay());
  }

  canSnooze(): boolean {
    return this.configuration?.allowSnooze ?? true;
  }

  getMaxSnoozeHours(): number {
    return this.configuration?.maxSnoozeHours || 24;
  }
}
