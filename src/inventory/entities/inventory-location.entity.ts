import { Entity, Column, Index, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum LocationType {
  WAREHOUSE = 'warehouse',
  STORE = 'store',
  VIRTUAL = 'virtual',
  TRANSIT = 'transit',
}

export enum LocationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

@Entity('inventory_locations')
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'isDeleted'])
export class InventoryLocation extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: LocationType,
    default: LocationType.WAREHOUSE,
  })
  type: LocationType;

  @Column({
    type: 'enum',
    enum: LocationStatus,
    default: LocationStatus.ACTIVE,
  })
  status: LocationStatus;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactPerson?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalArea?: number; // in square meters

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  usableArea?: number; // in square meters

  @Column({ type: 'int', nullable: true })
  maxCapacity?: number; // maximum items that can be stored

  @Column({ type: 'boolean', default: true })
  isPickupLocation: boolean;

  @Column({ type: 'boolean', default: true })
  isDropoffLocation: boolean;

  @Column({ type: 'boolean', default: true })
  allowNegativeStock: boolean;

  @Column({ type: 'jsonb', nullable: true })
  operatingHours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => InventoryLocation, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: InventoryLocation;

  @OneToMany(() => InventoryLocation, location => location.parent)
  children?: InventoryLocation[];

  // @OneToMany(() => InventoryItem, item => item.location)
  // inventoryItems?: InventoryItem[];

  // @OneToMany(() => InventoryTransaction, transaction => transaction.location)
  // transactions?: InventoryTransaction[];

  // @OneToMany(() => ReorderRule, rule => rule.location)
  // reorderRules?: ReorderRule[];

  // Virtual fields
  get isActive(): boolean {
    return this.status === LocationStatus.ACTIVE && !this.isDeleted;
  }

  get hasChildren(): boolean {
    return (this.children?.length || 0) > 0;
  }

  get fullAddress(): string {
    const parts = [this.address, this.city, this.state, this.postalCode, this.country];
    return parts.filter(Boolean).join(', ');
  }

  // Methods
  calculateUtilization(currentItems: number): number {
    if (!this.maxCapacity || this.maxCapacity === 0) return 0;
    return (currentItems / this.maxCapacity) * 100;
  }

  isOperatingNow(): boolean {
    if (!this.operatingHours) return true;
    
    const now = new Date();
    const dayName = now
      .toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof this.operatingHours;
    
    const todayHours = this.operatingHours[dayName];
    if (!todayHours) return false;
    
    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  }
}

// Import for relations
declare class InventoryItem {
  location: InventoryLocation;
}

declare class InventoryTransaction {
  location: InventoryLocation;
}