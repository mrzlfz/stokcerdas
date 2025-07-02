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

import { AlertConfiguration, AlertType, AlertSeverity } from './alert-configuration.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { User } from '../../users/entities/user.entity';

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SNOOZED = 'snoozed',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated',
}

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('alert_instances')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'alertType', 'status'])
@Index(['tenantId', 'severity', 'status'])
@Index(['createdAt'])
@Index(['resolvedAt'])
export class AlertInstance {
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
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertPriority,
    default: AlertPriority.MEDIUM,
  })
  priority: AlertPriority;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column()
  title: string;

  @Column('text')
  message: string;

  // Related entities
  @Column({ nullable: true })
  productId?: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  @Column({ nullable: true })
  locationId?: string;

  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'locationId' })
  location?: InventoryLocation;

  @Column({ nullable: true })
  inventoryItemId?: string;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem?: InventoryItem;

  @Column({ nullable: true })
  configurationId?: string;

  @ManyToOne(() => AlertConfiguration, { nullable: true })
  @JoinColumn({ name: 'configurationId' })
  configuration?: AlertConfiguration;

  // Alert data
  @Column({ type: 'jsonb', nullable: true })
  data?: {
    // For stock alerts
    currentQuantity?: number;
    threshold?: number;
    reorderPoint?: number;
    availableQuantity?: number;
    
    // For expiry alerts
    expiryDate?: string;
    daysUntilExpiry?: number;
    
    // For system alerts
    maintenanceWindow?: {
      start: string;
      end: string;
    };
    affectedServices?: string[];
    
    // Reference data
    referenceType?: string; // 'order', 'transfer', 'adjustment', etc.
    referenceId?: string;
    
    // Previous values for tracking changes
    previousValues?: {
      quantity?: number;
      status?: string;
    };
  };

  // Action tracking
  @Column({ nullable: true })
  acknowledgedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'acknowledgedBy' })
  acknowledger?: User;

  @Column({ nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true, type: 'text' })
  acknowledgeNotes?: string;

  @Column({ nullable: true })
  resolvedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolvedBy' })
  resolver?: User;

  @Column({ nullable: true })
  resolvedAt?: Date;

  @Column({ nullable: true, type: 'text' })
  resolutionNotes?: string;

  @Column({ nullable: true })
  dismissedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'dismissedBy' })
  dismisser?: User;

  @Column({ nullable: true })
  dismissedAt?: Date;

  @Column({ nullable: true, type: 'text' })
  dismissalReason?: string;

  // Snooze functionality
  @Column({ nullable: true })
  snoozedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'snoozedBy' })
  snoozer?: User;

  @Column({ nullable: true })
  snoozedAt?: Date;

  @Column({ nullable: true })
  snoozeUntil?: Date;

  @Column({ nullable: true, type: 'text' })
  snoozeReason?: string;

  @Column({ default: 0 })
  snoozeCount: number;

  // Escalation tracking
  @Column({ nullable: true })
  escalatedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'escalatedBy' })
  escalator?: User;

  @Column({ nullable: true })
  escalatedAt?: Date;

  @Column({ nullable: true })
  escalatedTo?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'escalatedTo' })
  escalatee?: User;

  @Column({ nullable: true, type: 'text' })
  escalationReason?: string;

  // Notification tracking
  @Column({ type: 'jsonb', default: {} })
  notificationStatus: {
    pushSent?: boolean;
    pushSentAt?: string;
    emailSent?: boolean;
    emailSentAt?: string;
    smsSent?: boolean;
    smsSentAt?: string;
    lastNotificationAt?: string;
    notificationCount?: number;
    failedNotifications?: string[];
  };

  // Recipients who have seen this alert
  @Column({ type: 'text', array: true, default: [] })
  viewedBy: string[];

  @Column({ type: 'jsonb', default: {} })
  viewHistory: Record<string, string>; // userId -> timestamp

  // Tags for filtering and categorization
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ nullable: true, type: 'text' })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isActive(): boolean {
    return this.status === AlertStatus.ACTIVE && !this.isSnoozed();
  }

  isSnoozed(): boolean {
    return this.status === AlertStatus.SNOOZED && 
           this.snoozeUntil && 
           this.snoozeUntil > new Date();
  }

  isResolved(): boolean {
    return this.status === AlertStatus.RESOLVED;
  }

  isDismissed(): boolean {
    return this.status === AlertStatus.DISMISSED;
  }

  isAcknowledged(): boolean {
    return this.status === AlertStatus.ACKNOWLEDGED;
  }

  canBeAcknowledged(): boolean {
    return this.status === AlertStatus.ACTIVE;
  }

  canBeSnoozed(): boolean {
    return [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED].includes(this.status);
  }

  canBeResolved(): boolean {
    return [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.SNOOZED].includes(this.status);
  }

  canBeDismissed(): boolean {
    return this.status !== AlertStatus.DISMISSED;
  }

  getAgeDuration(): string {
    const now = new Date();
    const diffMs = now.getTime() - this.createdAt.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} hari yang lalu`;
    } else if (diffHours > 0) {
      return `${diffHours} jam yang lalu`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} menit yang lalu`;
    }
  }

  getTimeToResolve(): string | null {
    if (!this.resolvedAt) return null;
    
    const diffMs = this.resolvedAt.getTime() - this.createdAt.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} hari`;
    } else if (diffHours > 0) {
      return `${diffHours} jam`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} menit`;
    }
  }

  shouldEscalate(configuredHours: number = 24): boolean {
    if (this.status !== AlertStatus.ACTIVE) return false;
    
    const hoursAge = (new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60);
    return hoursAge >= configuredHours;
  }

  markAsViewed(userId: string): void {
    if (!this.viewedBy.includes(userId)) {
      this.viewedBy.push(userId);
    }
    this.viewHistory[userId] = new Date().toISOString();
  }

  hasBeenViewedBy(userId: string): boolean {
    return this.viewedBy.includes(userId);
  }

  getViewedByCount(): number {
    return this.viewedBy.length;
  }

  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }
}