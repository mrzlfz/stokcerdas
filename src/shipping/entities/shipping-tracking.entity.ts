import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ShippingLabel } from './shipping-label.entity';

export enum TrackingStatus {
  CREATED = 'created',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
  PICKED_UP = 'picked_up',
  SUDAH_DITERIMA = 'sudah_diterima',
  ORDER_CONFIRMED = 'order_confirmed',
}

export enum TrackingEventType {
  PICKUP = 'pickup',
  IN_TRANSIT = 'in_transit',
  SORTING = 'sorting',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERY_ATTEMPT = 'delivery_attempt',
  DELIVERED = 'delivered',
  EXCEPTION = 'exception',
  RETURNED = 'returned',
}

@Entity('shipping_tracking')
@Index(['tenantId', 'trackingNumber'])
@Index(['tenantId', 'shippingLabelId'])
export class ShippingTracking extends BaseEntity {
  @Column({ type: 'uuid' })
  shippingLabelId: string;

  @Column({ type: 'varchar', length: 100 })
  trackingNumber: string;

  @Column({
    type: 'enum',
    enum: TrackingStatus,
    default: TrackingStatus.CREATED,
  })
  status: TrackingStatus;

  @Column({
    type: 'enum',
    enum: TrackingEventType,
  })
  eventType: TrackingEventType;

  @Column({ type: 'varchar', length: 255 })
  eventDescription: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'integer', default: 0 })
  sequence: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'timestamp' })
  eventTime: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  courierName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  courierPhone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  carrierId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  carrierName?: string;

  @Column({ type: 'jsonb', nullable: true })
  additionalData?: {
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    photos?: string[];
    signature?: string;
    notes?: string;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalTrackingId?: string;

  @Column({ type: 'jsonb', nullable: true })
  rawData?: Record<string, any>;

  // Relations
  @ManyToOne(() => ShippingLabel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shippingLabelId' })
  shippingLabel: ShippingLabel;

  // Virtual fields
  get isDelivered(): boolean {
    return this.status === TrackingStatus.DELIVERED;
  }

  get isFailed(): boolean {
    return [
      TrackingStatus.FAILED,
      TrackingStatus.RETURNED,
      TrackingStatus.CANCELLED,
    ].includes(this.status);
  }

  get isInTransit(): boolean {
    return [
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.OUT_FOR_DELIVERY,
    ].includes(this.status);
  }
}
