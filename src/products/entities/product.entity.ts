import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ProductCategory } from './product-category.entity';
import { ProductVariant } from './product-variant.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
}

export enum ProductType {
  SIMPLE = 'simple',
  VARIANT = 'variant',
  BUNDLE = 'bundle',
}

@Entity('products')
@Index(['tenantId', 'sku'], { unique: true })
@Index(['tenantId', 'barcode'], { unique: true, where: 'barcode IS NOT NULL' })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'categoryId'])
@Index(['tenantId', 'supplierId'])
@Index(['tenantId', 'isDeleted'])
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  barcode?: string;

  @Column({
    type: 'enum',
    enum: ProductType,
    default: ProductType.SIMPLE,
  })
  type: ProductType;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string; // pcs, kg, liter, etc.

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  wholesalePrice?: number;

  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  weight?: number; // in kg

  @Column({ type: 'varchar', length: 50, nullable: true })
  dimensions?: string; // LxWxH in cm

  @Column({ type: 'varchar', length: 255, nullable: true })
  image?: string;

  @Column({ type: 'json', nullable: true })
  images?: string[]; // Array of image URLs

  @Column({ type: 'int', default: 0 })
  minStock: number;

  @Column({ type: 'int', default: 0 })
  maxStock: number;

  @Column({ type: 'int', default: 0 })
  reorderPoint: number;

  @Column({ type: 'int', default: 1 })
  reorderQuantity: number;

  @Column({ type: 'boolean', default: true })
  trackStock: boolean;

  @Column({ type: 'boolean', default: false })
  allowBackorder: boolean;

  @Column({ type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ type: 'int', nullable: true })
  shelfLife?: number; // in days

  @Column({ type: 'uuid', nullable: true })
  supplierId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierSku?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  taxRate?: number; // percentage

  @Column({ type: 'boolean', default: true })
  isTaxable: boolean;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, any>; // Custom attributes

  @Column({ type: 'jsonb', nullable: true })
  seoMeta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  salesCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRevenue: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSoldAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastRestockedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Relations
  @ManyToOne(() => ProductCategory, category => category.products, {
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category?: ProductCategory;

  @ManyToOne(() => Supplier, supplier => supplier.products, { nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

  @OneToMany(() => ProductVariant, variant => variant.product)
  variants?: ProductVariant[];

  @OneToMany('InventoryItem', 'product')
  inventoryItems?: any[];

  // @OneToMany(() => ReorderRule, rule => rule.product)
  // reorderRules?: ReorderRule[];

  // Virtual fields
  get isActive(): boolean {
    return this.status === ProductStatus.ACTIVE && !this.isDeleted;
  }

  get hasVariants(): boolean {
    return (
      this.type === ProductType.VARIANT && (this.variants?.length || 0) > 0
    );
  }

  get isLowStock(): boolean {
    // This would need to be calculated based on current inventory
    // Implementation would depend on inventory tracking logic
    return false;
  }

  get profitMargin(): number {
    if (this.costPrice === 0) return 0;
    return ((this.sellingPrice - this.costPrice) / this.costPrice) * 100;
  }

  // Methods
  incrementViewCount(): void {
    this.viewCount += 1;
  }

  recordSale(quantity: number, amount: number): void {
    this.salesCount += quantity;
    this.totalRevenue += amount;
    this.lastSoldAt = new Date();
  }

  updateReorderPoint(newPoint: number): void {
    this.reorderPoint = newPoint;
  }
}

// Supporting entities are now imported from separate files
// ProductCategory is imported from ./product-category.entity.ts
// ProductVariant is imported from ./product-variant.entity.ts
