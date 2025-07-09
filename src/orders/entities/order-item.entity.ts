import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from './order.entity';

@Entity('order_items')
@Index(['tenantId', 'orderId'])
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'sku'])
export class OrderItem extends BaseEntity {
  // Order relationship
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // Product Information
  @Column({ type: 'uuid', nullable: true })
  productId?: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'text', nullable: true })
  productDescription?: string;

  // Variant Information
  @Column({ type: 'varchar', length: 100, nullable: true })
  variantId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  variantName?: string;

  @Column({ type: 'jsonb', nullable: true })
  variantAttributes?: {
    color?: string;
    size?: string;
    weight?: string;
    [key: string]: any;
  };

  // Quantity and Pricing
  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  // Product Details
  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  weight?: number; // in kg

  @Column({ type: 'jsonb', nullable: true })
  dimensions?: {
    length: number; // in cm
    width: number;
    height: number;
  };

  // Fulfillment Information
  @Column({ type: 'varchar', length: 50, nullable: true })
  warehouseId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  warehouseName?: string;

  @Column({ type: 'integer', default: 0 })
  fulfilledQuantity: number;

  @Column({ type: 'integer', default: 0 })
  canceledQuantity: number;

  @Column({ type: 'integer', default: 0 })
  returnedQuantity: number;

  // External References
  @Column({ type: 'varchar', length: 100, nullable: true })
  externalItemId?: string; // Item ID from external platform

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalProductId?: string; // Product ID from external platform

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalVariantId?: string; // Variant ID from external platform

  // Additional Information
  @Column({ type: 'jsonb', nullable: true })
  customizations?: {
    personalizedText?: string;
    giftMessage?: string;
    specialInstructions?: string;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  attributes?: {
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    categoryId?: string;
    categoryName?: string;
    brandId?: string;
    brandName?: string;
    supplierInfo?: any;
    promotionIds?: string[];
    [key: string]: any;
  };

  // Indonesian Business Context
  @Column({ type: 'jsonb', nullable: true })
  indonesianContext?: {
    halalStatus?: 'halal' | 'non_halal' | 'unknown';
    localTaxes?: {
      ppn?: number; // Pajak Pertambahan Nilai
      pph?: number; // Pajak Penghasilan
    };
    shippingZone?: string; // Indonesia shipping zone
    customsInfo?: {
      hsCode?: string;
      countryOfOrigin?: string;
      declarationValue?: number;
    };
  };

  // Notes and Comments
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  // Calculated Properties
  get netPrice(): number {
    return this.totalPrice - this.discountAmount;
  }

  get grossPrice(): number {
    return this.netPrice + this.taxAmount;
  }

  get availableQuantity(): number {
    return (
      this.quantity -
      this.fulfilledQuantity -
      this.canceledQuantity -
      this.returnedQuantity
    );
  }

  get isFullyFulfilled(): boolean {
    return this.fulfilledQuantity >= this.quantity;
  }

  get isPartiallyCanceled(): boolean {
    return this.canceledQuantity > 0 && this.canceledQuantity < this.quantity;
  }

  get isFullyCanceled(): boolean {
    return this.canceledQuantity >= this.quantity;
  }

  get hasReturns(): boolean {
    return this.returnedQuantity > 0;
  }

  // Indonesian Business Methods
  calculatePPN(rate: number = 0.11): number {
    return this.netPrice * rate;
  }

  getTotalWeightKg(): number {
    return (this.weight || 0) * this.quantity;
  }

  getShippingVolumeM3(): number {
    if (!this.dimensions) return 0;

    const { length, width, height } = this.dimensions;
    // Convert cm³ to m³ and multiply by quantity
    return (length * width * height * this.quantity) / 1000000;
  }

  // Validation Methods
  validateQuantities(): string[] {
    const errors: string[] = [];

    if (this.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (this.fulfilledQuantity < 0) {
      errors.push('Fulfilled quantity cannot be negative');
    }

    if (this.canceledQuantity < 0) {
      errors.push('Canceled quantity cannot be negative');
    }

    if (this.returnedQuantity < 0) {
      errors.push('Returned quantity cannot be negative');
    }

    const totalProcessed =
      this.fulfilledQuantity + this.canceledQuantity + this.returnedQuantity;
    if (totalProcessed > this.quantity) {
      errors.push('Total processed quantity cannot exceed ordered quantity');
    }

    return errors;
  }

  validatePricing(): string[] {
    const errors: string[] = [];

    if (this.unitPrice < 0) {
      errors.push('Unit price cannot be negative');
    }

    if (this.totalPrice < 0) {
      errors.push('Total price cannot be negative');
    }

    if (this.discountAmount < 0) {
      errors.push('Discount amount cannot be negative');
    }

    if (this.taxAmount < 0) {
      errors.push('Tax amount cannot be negative');
    }

    if (this.discountAmount > this.totalPrice) {
      errors.push('Discount amount cannot exceed total price');
    }

    // Check if total price calculation is correct
    const expectedTotal = this.unitPrice * this.quantity;
    if (Math.abs(this.totalPrice - expectedTotal) > 0.01) {
      errors.push('Total price calculation mismatch');
    }

    return errors;
  }

  // Utility Methods
  toSummary(): any {
    return {
      id: this.id,
      sku: this.sku,
      productName: this.productName,
      variantName: this.variantName,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalPrice: this.totalPrice,
      netPrice: this.netPrice,
      grossPrice: this.grossPrice,
      fulfilledQuantity: this.fulfilledQuantity,
      availableQuantity: this.availableQuantity,
      isFullyFulfilled: this.isFullyFulfilled,
    };
  }

  clone(): Partial<OrderItem> {
    return {
      productId: this.productId,
      sku: this.sku,
      productName: this.productName,
      productDescription: this.productDescription,
      variantId: this.variantId,
      variantName: this.variantName,
      variantAttributes: this.variantAttributes
        ? { ...this.variantAttributes }
        : undefined,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalPrice: this.totalPrice,
      discountAmount: this.discountAmount,
      taxAmount: this.taxAmount,
      weight: this.weight,
      dimensions: this.dimensions ? { ...this.dimensions } : undefined,
      customizations: this.customizations
        ? { ...this.customizations }
        : undefined,
      metadata: this.metadata ? { ...this.metadata } : undefined,
      indonesianContext: this.indonesianContext
        ? { ...this.indonesianContext }
        : undefined,
      notes: this.notes,
    };
  }
}
