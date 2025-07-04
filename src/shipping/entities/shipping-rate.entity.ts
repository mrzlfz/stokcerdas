import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum RateType {
  STANDARD = 'standard',
  EXPRESS = 'express',
  ECONOMY = 'economy',
  PREMIUM = 'premium',
  SAME_DAY = 'same_day',
  NEXT_DAY = 'next_day',
  INSTANT = 'instant',
}

export enum WeightUnit {
  GRAM = 'gram',
  KILOGRAM = 'kilogram',
}

export enum DimensionUnit {
  CENTIMETER = 'centimeter',
  METER = 'meter',
}

@Entity('shipping_rates')
@Index(['tenantId', 'carrierId'])
@Index(['tenantId', 'isActive'])
@Index(['carrierId', 'serviceCode'])
@Index(['originPostalCode', 'destinationPostalCode', 'carrierId'])
export class ShippingRate extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  carrierId: string; // JNE, JT, SICEPAT, etc.

  @Column({ type: 'varchar', length: 100 })
  carrierName: string;

  @Column({ type: 'varchar', length: 50 })
  serviceCode: string; // REG, YES, OKE, etc.

  @Column({ type: 'varchar', length: 100 })
  serviceName: string; // Regular Service, Yakin Esok Sampai, etc.

  @Column({
    type: 'enum',
    enum: RateType,
    default: RateType.STANDARD,
  })
  rateType: RateType;

  // Geographic Coverage
  @Column({ type: 'varchar', length: 10 })
  originPostalCode: string;

  @Column({ type: 'varchar', length: 10 })
  destinationPostalCode: string;

  @Column({ type: 'varchar', length: 100 })
  originCity: string;

  @Column({ type: 'varchar', length: 100 })
  destinationCity: string;

  @Column({ type: 'varchar', length: 100 })
  originState: string; // province

  @Column({ type: 'varchar', length: 100 })
  destinationState: string; // province

  @Column({ type: 'varchar', length: 50, default: 'ID' })
  country: string;

  // Weight and Dimension Limits
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  minWeight: number; // in grams

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  maxWeight: number; // in grams

  @Column({
    type: 'enum',
    enum: WeightUnit,
    default: WeightUnit.GRAM,
  })
  weightUnit: WeightUnit;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxLength?: number; // in cm

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxWidth?: number; // in cm

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxHeight?: number; // in cm

  @Column({
    type: 'enum',
    enum: DimensionUnit,
    default: DimensionUnit.CENTIMETER,
  })
  dimensionUnit: DimensionUnit;

  // Pricing Information
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  baseCost: number; // Base shipping cost

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  perKgCost: number; // Additional cost per kg

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  perKmCost: number; // Additional cost per kilometer

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fuelSurcharge: number; // Fuel surcharge

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  insuranceRate: number; // Insurance rate (percentage)

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  codFee: number; // Cash on Delivery fee

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  adminFee: number; // Administrative fee

  @Column({ type: 'varchar', length: 10, default: 'IDR' })
  currency: string;

  // Service Information
  @Column({ type: 'integer' })
  estimatedDays: number; // Estimated delivery days

  @Column({ type: 'integer', nullable: true })
  minDays?: number; // Minimum delivery days

  @Column({ type: 'integer', nullable: true })
  maxDays?: number; // Maximum delivery days

  @Column({ type: 'boolean', default: false })
  isCodAvailable: boolean; // Cash on Delivery available

  @Column({ type: 'boolean', default: false })
  isInsuranceAvailable: boolean; // Insurance available

  @Column({ type: 'boolean', default: false })
  isInsuranceRequired: boolean; // Insurance required

  @Column({ type: 'boolean', default: false })
  requiresSignature: boolean; // Signature required

  @Column({ type: 'boolean', default: false })
  allowsFragile: boolean; // Fragile items allowed

  @Column({ type: 'boolean', default: false })
  allowsHazardous: boolean; // Hazardous items allowed

  @Column({ type: 'boolean', default: true })
  isResidential: boolean; // Residential delivery

  @Column({ type: 'boolean', default: true })
  isCommercial: boolean; // Commercial delivery

  // Availability
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  effectiveFrom?: Date;

  @Column({ type: 'timestamp', nullable: true })
  effectiveUntil?: Date;

  @Column({ type: 'jsonb', nullable: true })
  operatingDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  operatingHours?: {
    pickupStart: string; // HH:mm format
    pickupEnd: string;
    deliveryStart: string;
    deliveryEnd: string;
  };

  // Additional Service Features
  @Column({ type: 'jsonb', nullable: true })
  features?: {
    sameDay?: boolean;
    nextDay?: boolean;
    pickupService?: boolean;
    dropoffPoints?: boolean;
    trackingAvailable?: boolean;
    proofOfDelivery?: boolean;
    smsNotification?: boolean;
    emailNotification?: boolean;
    whatsappNotification?: boolean;
    temperatureControlled?: boolean;
    specialHandling?: string[];
  };

  // Zone and Hub Information
  @Column({ type: 'varchar', length: 50, nullable: true })
  originZone?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  destinationZone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  originHub?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  destinationHub?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanceKm?: number; // Distance in kilometers

  // Rate Validity
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  rateDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUpdated?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  rateSource?: string; // 'api' | 'manual' | 'contracted'

  @Column({ type: 'text', nullable: true })
  rateNotes?: string;

  // Carrier-specific data
  @Column({ type: 'jsonb', nullable: true })
  carrierData?: {
    serviceId?: string;
    packageType?: string;
    routeCode?: string;
    transitTime?: string;
    specialInstructions?: string[];
    restrictions?: string[];
    [key: string]: any;
  };

  // API Integration
  @Column({ type: 'jsonb', nullable: true })
  apiData?: {
    requestId?: string;
    responseId?: string;
    rateId?: string;
    lastSyncAt?: string;
    syncStatus?: 'pending' | 'synced' | 'failed';
    rawResponse?: any;
  };

  // Additional fields
  @Column({ type: 'integer', default: 1 })
  priority: number; // 1 = highest priority for display

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  terms?: string; // Terms and conditions

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  // Virtual fields
  get isCurrentlyActive(): boolean {
    if (!this.isActive) return false;

    const now = new Date();

    if (this.effectiveFrom && now < this.effectiveFrom) return false;
    if (this.effectiveUntil && now > this.effectiveUntil) return false;

    return true;
  }

  get totalBaseCost(): number {
    return this.baseCost + this.fuelSurcharge + this.adminFee;
  }

  get isExpressService(): boolean {
    return [
      RateType.EXPRESS,
      RateType.SAME_DAY,
      RateType.NEXT_DAY,
      RateType.INSTANT,
    ].includes(this.rateType);
  }

  get maxInsuranceValue(): number {
    // Most Indonesian carriers have insurance limits
    const limits: Record<string, number> = {
      JNE: 10000000, // 10 million IDR
      JT: 5000000, // 5 million IDR
      SICEPAT: 10000000,
      ANTERAJA: 5000000,
      NINJA: 2000000,
    };

    return limits[this.carrierId.toUpperCase()] || 1000000; // Default 1 million IDR
  }

  get deliveryTimeDescription(): string {
    if (this.minDays && this.maxDays) {
      if (this.minDays === this.maxDays) {
        return `${this.minDays} hari`;
      }
      return `${this.minDays}-${this.maxDays} hari`;
    }

    return `${this.estimatedDays} hari`;
  }

  // Methods
  calculateShippingCost(
    weight: number,
    distance?: number,
    insuranceValue?: number,
  ): {
    baseCost: number;
    weightCost: number;
    distanceCost: number;
    insuranceCost: number;
    codFee: number;
    adminFee: number;
    totalCost: number;
  } {
    const weightInKg = weight / 1000; // Convert grams to kg

    const weightCost = weightInKg > 1 ? (weightInKg - 1) * this.perKgCost : 0;
    const distanceCost = distance ? distance * this.perKmCost : 0;

    let insuranceCost = 0;
    if (insuranceValue && this.isInsuranceAvailable) {
      insuranceCost = (insuranceValue * this.insuranceRate) / 100;
    }

    const totalCost =
      this.baseCost +
      weightCost +
      distanceCost +
      insuranceCost +
      this.fuelSurcharge +
      this.adminFee;

    return {
      baseCost: this.baseCost,
      weightCost,
      distanceCost,
      insuranceCost,
      codFee: this.codFee,
      adminFee: this.adminFee + this.fuelSurcharge,
      totalCost,
    };
  }

  isValidForPackage(packageInfo: {
    weight: number;
    length: number;
    width: number;
    height: number;
    value?: number;
    isFragile?: boolean;
    isHazardous?: boolean;
  }): {
    valid: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Check weight limits
    if (packageInfo.weight < this.minWeight) {
      reasons.push(`Weight too low (min: ${this.minWeight}g)`);
    }
    if (packageInfo.weight > this.maxWeight) {
      reasons.push(`Weight too high (max: ${this.maxWeight}g)`);
    }

    // Check dimension limits
    if (this.maxLength && packageInfo.length > this.maxLength) {
      reasons.push(`Length too long (max: ${this.maxLength}cm)`);
    }
    if (this.maxWidth && packageInfo.width > this.maxWidth) {
      reasons.push(`Width too wide (max: ${this.maxWidth}cm)`);
    }
    if (this.maxHeight && packageInfo.height > this.maxHeight) {
      reasons.push(`Height too tall (max: ${this.maxHeight}cm)`);
    }

    // Check special requirements
    if (packageInfo.isFragile && !this.allowsFragile) {
      reasons.push('Fragile items not allowed');
    }
    if (packageInfo.isHazardous && !this.allowsHazardous) {
      reasons.push('Hazardous items not allowed');
    }

    // Check insurance requirements
    if (this.isInsuranceRequired && !this.isInsuranceAvailable) {
      reasons.push('Insurance required but not available');
    }

    return {
      valid: reasons.length === 0,
      reasons,
    };
  }

  isAvailableForPickup(pickupDate: Date): boolean {
    if (!this.isCurrentlyActive) return false;
    if (!this.operatingDays) return true; // Assume available if not specified

    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayOfWeek = dayNames[pickupDate.getDay()];

    return this.operatingDays[dayOfWeek] || false;
  }

  getEstimatedDeliveryDate(pickupDate: Date): Date {
    const deliveryDate = new Date(pickupDate);
    deliveryDate.setDate(deliveryDate.getDate() + this.estimatedDays);

    // Skip weekends for non-express services (simplified logic)
    if (!this.isExpressService) {
      while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
      }
    }

    return deliveryDate;
  }

  comparePriority(other: ShippingRate): number {
    // Lower priority number = higher priority
    return this.priority - other.priority;
  }

  updateFromApiResponse(apiResponse: any): void {
    this.lastUpdated = new Date();
    this.apiData = {
      ...this.apiData,
      lastSyncAt: new Date().toISOString(),
      syncStatus: 'synced',
      rawResponse: apiResponse,
    };
  }
}
