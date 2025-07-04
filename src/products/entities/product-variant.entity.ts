import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_variants')
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'sku'], { unique: true })
@Index(['tenantId', 'barcode'], { unique: true, where: 'barcode IS NOT NULL' })
@Index(['tenantId', 'isActive'])
export class ProductVariant extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  barcode?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  sellingPrice: number;

  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  weight?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image?: string;

  @Column({ type: 'jsonb' })
  attributes: Record<string, any>; // color: red, size: L, etc.

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Product, product => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Virtual fields
  get attributeString(): string {
    return Object.entries(this.attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  get isAvailable(): boolean {
    return this.isActive;
  }

  // Methods
  updatePrice(costPrice: number, sellingPrice: number): void {
    this.costPrice = costPrice;
    this.sellingPrice = sellingPrice;
  }

  toggleActive(): void {
    this.isActive = !this.isActive;
  }
}