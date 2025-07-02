import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ShippingLabel } from './shipping-label.entity';

export enum TrackingStatus {
  // Order Processing
  ORDER_RECEIVED = 'order_received',
  ORDER_CONFIRMED = 'order_confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  
  // Pickup & Collection
  PICKUP_SCHEDULED = 'pickup_scheduled',
  PICKUP_ATTEMPTED = 'pickup_attempted',
  PICKED_UP = 'picked_up',
  COLLECTED = 'collected',
  
  // In Transit
  IN_TRANSIT = 'in_transit',
  DEPARTED_ORIGIN = 'departed_origin',
  ARRIVED_AT_HUB = 'arrived_at_hub',
  DEPARTED_HUB = 'departed_hub',
  IN_TRANSIT_TO_DESTINATION = 'in_transit_to_destination',
  ARRIVED_AT_DESTINATION_HUB = 'arrived_at_destination_hub',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  
  // Delivery
  DELIVERY_ATTEMPTED = 'delivery_attempted',
  DELIVERED = 'delivered',
  PARTIALLY_DELIVERED = 'partially_delivered',
  
  // Exceptions
  DELAYED = 'delayed',
  ON_HOLD = 'on_hold',
  EXCEPTION = 'exception',
  DAMAGED = 'damaged',
  LOST = 'lost',
  RETURNED_TO_SENDER = 'returned_to_sender',
  CANCELLED = 'cancelled',
  
  // Indonesian Specific
  BARANG_DITERIMA = 'barang_diterima', // Package received
  DALAM_PERJALANAN = 'dalam_perjalanan', // On the way
  TIBA_DI_KOTA_TUJUAN = 'tiba_di_kota_tujuan', // Arrived at destination city
  SEDANG_DIANTAR = 'sedang_diantar', // Being delivered
  SUDAH_DITERIMA = 'sudah_diterima', // Already received
}

export enum TrackingEventType {
  STATUS_UPDATE = 'status_update',
  LOCATION_UPDATE = 'location_update',
  DELAY_NOTIFICATION = 'delay_notification',
  EXCEPTION_ALERT = 'exception_alert',
  DELIVERY_ATTEMPT = 'delivery_attempt',
  CUSTOMER_NOTIFICATION = 'customer_notification',
  MILESTONE = 'milestone',
}

@Entity('shipping_tracking')
@Index(['tenantId', 'shippingLabelId'])
@Index(['tenantId', 'trackingNumber'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'eventTime'])
@Index(['trackingNumber', 'eventTime'])
export class ShippingTracking extends BaseEntity {
  @Column({ type: 'uuid' })
  shippingLabelId: string;

  @Column({ type: 'varchar', length: 100 })
  trackingNumber: string;

  @Column({ type: 'varchar', length: 100 })
  carrierId: string;

  @Column({ type: 'varchar', length: 100 })
  carrierName: string;

  @Column({
    type: 'enum',
    enum: TrackingStatus,
  })
  status: TrackingStatus;

  @Column({
    type: 'enum',
    enum: TrackingEventType,
    default: TrackingEventType.STATUS_UPDATE,
  })
  eventType: TrackingEventType;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })\n  eventTime: Date;

  @Column({ type: 'varchar', length: 255 })\n  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descriptionEn?: string; // English description

  @Column({ type: 'varchar', length: 255, nullable: true })
  descriptionId?: string; // Indonesian description

  // Location Information
  @Column({ type: 'jsonb', nullable: true })
  location?: {
    name: string;\n    address?: string;\n    city: string;\n    state: string; // province\n    country: string;\n    postalCode?: string;\n    hubCode?: string;\n    facilityType?: 'warehouse' | 'hub' | 'store' | 'delivery_point';\n    coordinates?: {\n      latitude: number;\n      longitude: number;\n    };\n  };

  // Delivery Information
  @Column({ type: 'jsonb', nullable: true })
  deliveryInfo?: {
    attemptNumber?: number;\n    deliveryMethod?: string; // 'home_delivery' | 'pickup_point' | 'locker'\n    recipientName?: string;\n    signedBy?: string;\n    deliveryNotes?: string;\n    photoUrl?: string; // Delivery proof photo\n    signatureUrl?: string; // Signature image\n    failureReason?: string;\n    nextAttemptDate?: string;\n  };

  // Exception Information
  @Column({ type: 'jsonb', nullable: true })
  exceptionInfo?: {
    code: string;\n    type: 'delay' | 'damage' | 'lost' | 'address_issue' | 'customer_unavailable' | 'weather' | 'other';\n    reason: string;\n    resolution?: string;\n    estimatedResolutionDate?: string;\n    actionRequired?: boolean;\n    contactRequired?: boolean;\n  };

  // Timing Information
  @Column({ type: 'timestamp', nullable: true })
  estimatedDeliveryDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  originalEstimatedDeliveryDate?: Date;

  @Column({ type: 'integer', nullable: true })
  delayHours?: number; // Hours delayed from original estimate

  // Additional Data
  @Column({ type: 'jsonb', nullable: true })
  additionalData?: {
    vehicleType?: string;\n    courierName?: string;\n    courierPhone?: string;\n    weight?: number;\n    pieces?: number;\n    temperature?: number; // For temperature-sensitive items\n    humidity?: number;\n    specialInstructions?: string[];\n    [key: string]: any;\n  };

  // Carrier-specific data
  @Column({ type: 'jsonb', nullable: true })
  carrierData?: {
    eventCode?: string;\n    eventDescription?: string;\n    facilityCode?: string;\n    routeCode?: string;\n    manifestNumber?: string;\n    scanType?: string;\n    rawData?: any;\n    [key: string]: any;\n  };

  // API Integration
  @Column({ type: 'jsonb', nullable: true })
  apiData?: {
    source: 'webhook' | 'polling' | 'manual';\n    requestId?: string;\n    webhookId?: string;\n    pullTime?: string;\n    rawResponse?: any;\n  };

  // Customer Communication
  @Column({ type: 'boolean', default: false })
  customerNotified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  customerNotifiedAt?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  notificationMethod?: string; // 'email' | 'sms' | 'whatsapp' | 'push'

  @Column({ type: 'boolean', default: true })
  isVisible: boolean; // Show to customer or internal only

  @Column({ type: 'integer', default: 1 })
  sequence: number; // Order of events

  // Additional fields
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  // Relations
  @ManyToOne(() => ShippingLabel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shippingLabelId' })
  shippingLabel?: ShippingLabel;

  // Virtual fields
  get isDelivered(): boolean {
    return [
      TrackingStatus.DELIVERED,
      TrackingStatus.PARTIALLY_DELIVERED,
      TrackingStatus.SUDAH_DITERIMA
    ].includes(this.status);
  }

  get isInTransit(): boolean {
    return [
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.DEPARTED_ORIGIN,
      TrackingStatus.ARRIVED_AT_HUB,
      TrackingStatus.DEPARTED_HUB,
      TrackingStatus.IN_TRANSIT_TO_DESTINATION,
      TrackingStatus.ARRIVED_AT_DESTINATION_HUB,
      TrackingStatus.DALAM_PERJALANAN
    ].includes(this.status);
  }

  get isException(): boolean {
    return [
      TrackingStatus.DELAYED,
      TrackingStatus.ON_HOLD,
      TrackingStatus.EXCEPTION,
      TrackingStatus.DAMAGED,
      TrackingStatus.LOST,
      TrackingStatus.DELIVERY_ATTEMPTED
    ].includes(this.status);
  }

  get isOutForDelivery(): boolean {
    return [
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.SEDANG_DIANTAR
    ].includes(this.status);
  }

  get statusInIndonesian(): string {
    const indonesianMap: Record<TrackingStatus, string> = {
      [TrackingStatus.ORDER_RECEIVED]: 'Pesanan Diterima',
      [TrackingStatus.ORDER_CONFIRMED]: 'Pesanan Dikonfirmasi',
      [TrackingStatus.PREPARING]: 'Sedang Disiapkan',
      [TrackingStatus.READY_FOR_PICKUP]: 'Siap Dijemput',
      [TrackingStatus.PICKUP_SCHEDULED]: 'Penjemputan Dijadwalkan',
      [TrackingStatus.PICKUP_ATTEMPTED]: 'Percobaan Penjemputan',
      [TrackingStatus.PICKED_UP]: 'Sudah Dijemput',
      [TrackingStatus.COLLECTED]: 'Sudah Dikumpulkan',
      [TrackingStatus.IN_TRANSIT]: 'Dalam Perjalanan',
      [TrackingStatus.DEPARTED_ORIGIN]: 'Berangkat dari Asal',
      [TrackingStatus.ARRIVED_AT_HUB]: 'Tiba di Hub',
      [TrackingStatus.DEPARTED_HUB]: 'Berangkat dari Hub',
      [TrackingStatus.IN_TRANSIT_TO_DESTINATION]: 'Menuju Tujuan',
      [TrackingStatus.ARRIVED_AT_DESTINATION_HUB]: 'Tiba di Hub Tujuan',
      [TrackingStatus.OUT_FOR_DELIVERY]: 'Dalam Pengiriman',
      [TrackingStatus.DELIVERY_ATTEMPTED]: 'Percobaan Pengiriman',
      [TrackingStatus.DELIVERED]: 'Sudah Diterima',
      [TrackingStatus.PARTIALLY_DELIVERED]: 'Sebagian Diterima',
      [TrackingStatus.DELAYED]: 'Tertunda',
      [TrackingStatus.ON_HOLD]: 'Ditahan',
      [TrackingStatus.EXCEPTION]: 'Pengecualian',
      [TrackingStatus.DAMAGED]: 'Rusak',
      [TrackingStatus.LOST]: 'Hilang',
      [TrackingStatus.RETURNED_TO_SENDER]: 'Dikembalikan ke Pengirim',
      [TrackingStatus.CANCELLED]: 'Dibatalkan',
      [TrackingStatus.BARANG_DITERIMA]: 'Barang Diterima',
      [TrackingStatus.DALAM_PERJALANAN]: 'Dalam Perjalanan',
      [TrackingStatus.TIBA_DI_KOTA_TUJUAN]: 'Tiba di Kota Tujuan',
      [TrackingStatus.SEDANG_DIANTAR]: 'Sedang Diantar',
      [TrackingStatus.SUDAH_DITERIMA]: 'Sudah Diterima',
    };

    return indonesianMap[this.status] || this.status;
  }

  get progressPercentage(): number {
    const progressMap: Record<TrackingStatus, number> = {
      [TrackingStatus.ORDER_RECEIVED]: 5,
      [TrackingStatus.ORDER_CONFIRMED]: 10,
      [TrackingStatus.PREPARING]: 15,
      [TrackingStatus.READY_FOR_PICKUP]: 20,
      [TrackingStatus.PICKUP_SCHEDULED]: 25,
      [TrackingStatus.PICKED_UP]: 30,
      [TrackingStatus.COLLECTED]: 35,
      [TrackingStatus.IN_TRANSIT]: 50,
      [TrackingStatus.DEPARTED_ORIGIN]: 40,
      [TrackingStatus.ARRIVED_AT_HUB]: 60,
      [TrackingStatus.DEPARTED_HUB]: 70,
      [TrackingStatus.IN_TRANSIT_TO_DESTINATION]: 75,
      [TrackingStatus.ARRIVED_AT_DESTINATION_HUB]: 80,
      [TrackingStatus.OUT_FOR_DELIVERY]: 90,
      [TrackingStatus.DELIVERED]: 100,
      [TrackingStatus.SUDAH_DITERIMA]: 100,
      // Exceptions and issues
      [TrackingStatus.DELAYED]: 50,
      [TrackingStatus.ON_HOLD]: 50,
      [TrackingStatus.EXCEPTION]: 50,
      [TrackingStatus.DELIVERY_ATTEMPTED]: 95,
      [TrackingStatus.DAMAGED]: 0,
      [TrackingStatus.LOST]: 0,
      [TrackingStatus.CANCELLED]: 0,
      [TrackingStatus.RETURNED_TO_SENDER]: 0,
    };

    return progressMap[this.status] || 0;
  }

  // Methods
  isMoreRecentThan(otherEvent: ShippingTracking): boolean {
    return this.eventTime > otherEvent.eventTime;
  }

  getTimeFromPrevious(previousEvent: ShippingTracking): number {
    // Returns time difference in hours
    const diffInMs = this.eventTime.getTime() - previousEvent.eventTime.getTime();
    return diffInMs / (1000 * 60 * 60);
  }

  shouldNotifyCustomer(): boolean {
    // Define which events should trigger customer notifications
    const notificationEvents = [
      TrackingStatus.ORDER_CONFIRMED,
      TrackingStatus.PICKED_UP,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.DELIVERED,
      TrackingStatus.DELIVERY_ATTEMPTED,
      TrackingStatus.DELAYED,
      TrackingStatus.EXCEPTION,
    ];

    return this.isVisible && notificationEvents.includes(this.status);
  }

  getDisplayDescription(language: 'id' | 'en' = 'id'): string {
    if (language === 'id' && this.descriptionId) {
      return this.descriptionId;
    }
    if (language === 'en' && this.descriptionEn) {
      return this.descriptionEn;
    }
    return this.description;
  }

  setDeliveryProof(deliveryData: {
    recipientName: string;
    signedBy?: string;
    deliveryNotes?: string;
    photoUrl?: string;
    signatureUrl?: string;
  }): void {
    this.deliveryInfo = {
      ...this.deliveryInfo,
      ...deliveryData,
      deliveryMethod: 'home_delivery',
    };
  }

  setException(exceptionData: {
    code: string;
    type: 'delay' | 'damage' | 'lost' | 'address_issue' | 'customer_unavailable' | 'weather' | 'other';
    reason: string;
    resolution?: string;
    estimatedResolutionDate?: string;
    actionRequired?: boolean;
    contactRequired?: boolean;
  }): void {
    this.exceptionInfo = exceptionData;
    this.eventType = TrackingEventType.EXCEPTION_ALERT;
  }

  markAsCustomerNotified(method: string): void {
    this.customerNotified = true;
    this.customerNotifiedAt = new Date();
    this.notificationMethod = method;
  }
}