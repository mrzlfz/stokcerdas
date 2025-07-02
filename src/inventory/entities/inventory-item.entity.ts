import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryLocation } from './inventory-location.entity';

@Entity('inventory_items')
@Index(['tenantId', 'productId', 'locationId'], { unique: true })
@Index(['tenantId', 'locationId'])
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'quantityOnHand'])
export class InventoryItem extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'int', default: 0 })
  quantityOnHand: number;

  @Column({ type: 'int', default: 0 })
  quantityReserved: number;

  @Column({ type: 'int', default: 0 })
  quantityOnOrder: number;

  @Column({ type: 'int', default: 0 })
  quantityAllocated: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  averageCost: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalValue: number;

  @Column({ type: 'timestamp', nullable: true })
  lastMovementAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastCountAt?: Date;

  @Column({ type: 'int', nullable: true })
  minStock?: number;

  @Column({ type: 'int', nullable: true })
  maxStock?: number;

  @Column({ type: 'int', nullable: true })
  reorderPoint?: number;

  @Column({ type: 'int', nullable: true })
  reorderQuantity?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  binLocation?: string; // Specific bin/shelf location

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ type: 'date', nullable: true })
  manufacturingDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Product, product => product.inventoryItems)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => InventoryLocation, location => location.inventoryItems)
  @JoinColumn({ name: 'locationId' })
  location: InventoryLocation;

  @OneToMany(() => InventoryTransaction, transaction => transaction.inventoryItem)
  transactions?: InventoryTransaction[];

  // Virtual fields
  get quantityAvailable(): number {
    return Math.max(0, this.quantityOnHand - this.quantityReserved - this.quantityAllocated);
  }

  get totalQuantity(): number {
    return this.quantityOnHand + this.quantityOnOrder;
  }

  get isLowStock(): boolean {
    if (!this.reorderPoint) return false;
    return this.quantityAvailable <= this.reorderPoint;
  }

  get isOutOfStock(): boolean {
    return this.quantityAvailable <= 0;
  }

  get isOverStock(): boolean {
    if (!this.maxStock) return false;
    return this.quantityOnHand > this.maxStock;
  }

  get needsReorder(): boolean {
    if (!this.reorderPoint) return false;
    return this.quantityOnHand <= this.reorderPoint;
  }

  get isExpired(): boolean {
    if (!this.expiryDate) return false;
    return this.expiryDate < new Date();
  }

  get isExpiringSoon(): boolean {
    if (!this.expiryDate) return false;
    const daysUntilExpiry = Math.ceil(
      (this.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }

  get stockTurnover(): number {
    // This would need sales data to calculate properly
    // Implementation would depend on sales tracking
    return 0;
  }

  // Methods
  adjustQuantity(adjustment: number, reason: string, userId?: string): void {
    this.quantityOnHand += adjustment;
    this.lastMovementAt = new Date();
    this.updatedBy = userId;
    
    // Recalculate total value
    this.totalValue = this.quantityOnHand * this.averageCost;
  }

  reserveQuantity(quantity: number): boolean {
    if (this.quantityAvailable >= quantity) {
      this.quantityReserved += quantity;
      return true;
    }
    return false;
  }

  releaseReservation(quantity: number): void {
    this.quantityReserved = Math.max(0, this.quantityReserved - quantity);
  }

  allocateQuantity(quantity: number): boolean {
    if (this.quantityAvailable >= quantity) {
      this.quantityAllocated += quantity;
      return true;
    }
    return false;
  }

  releaseAllocation(quantity: number): void {
    this.quantityAllocated = Math.max(0, this.quantityAllocated - quantity);
  }

  updateAverageCost(newCost: number, quantity: number): void {
    if (this.quantityOnHand === 0) {
      this.averageCost = newCost;
    } else {
      const totalCost = (this.averageCost * this.quantityOnHand) + (newCost * quantity);
      const totalQuantity = this.quantityOnHand + quantity;
      this.averageCost = totalCost / totalQuantity;
    }
    
    this.totalValue = this.quantityOnHand * this.averageCost;
  }

  performStockCount(countedQuantity: number, userId?: string): number {
    const variance = countedQuantity - this.quantityOnHand;
    this.quantityOnHand = countedQuantity;
    this.lastCountAt = new Date();
    this.updatedBy = userId;
    
    // Recalculate total value
    this.totalValue = this.quantityOnHand * this.averageCost;
    
    return variance;
  }
}

declare class InventoryTransaction {
  inventoryItem: InventoryItem;
}