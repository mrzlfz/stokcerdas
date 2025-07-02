import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';

export enum ReorderRuleType {
  FIXED_QUANTITY = 'fixed_quantity',
  EOQ = 'eoq', // Economic Order Quantity
  MIN_MAX = 'min_max',
  DEMAND_BASED = 'demand_based',
  SEASONAL = 'seasonal',
}

export enum ReorderTrigger {
  STOCK_LEVEL = 'stock_level',
  DAYS_OF_SUPPLY = 'days_of_supply',
  SCHEDULED = 'scheduled',
  DEMAND_FORECAST = 'demand_forecast',
  COMBINED = 'combined',
}

export enum ReorderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
}

export enum SupplierSelectionMethod {
  PRIMARY = 'primary', // Use primary supplier
  COST_OPTIMAL = 'cost_optimal', // Lowest cost
  DELIVERY_OPTIMAL = 'delivery_optimal', // Fastest delivery
  QUALITY_OPTIMAL = 'quality_optimal', // Best quality/performance
  BALANCED = 'balanced', // Weighted scoring
}

@Entity('reorder_rules')
@Index(['tenantId', 'productId', 'locationId'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'nextReviewDate'])
export class ReorderRule extends AuditableEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  locationId?: string;

  @Column({ type: 'uuid', nullable: true })
  primarySupplierId?: string;

  // Basic Rule Configuration
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ReorderRuleType,
    default: ReorderRuleType.FIXED_QUANTITY,
  })
  ruleType: ReorderRuleType;

  @Column({
    type: 'enum',
    enum: ReorderTrigger,
    default: ReorderTrigger.STOCK_LEVEL,
  })
  trigger: ReorderTrigger;

  @Column({
    type: 'enum',
    enum: ReorderStatus,
    default: ReorderStatus.ACTIVE,
  })
  status: ReorderStatus;

  // Stock Level Parameters
  @Column({ type: 'int', default: 0 })
  reorderPoint: number;

  @Column({ type: 'int', default: 0 })
  reorderQuantity: number;

  @Column({ type: 'int', nullable: true })
  minStockLevel?: number;

  @Column({ type: 'int', nullable: true })
  maxStockLevel?: number;

  @Column({ type: 'int', nullable: true })
  safetyStockDays?: number; // Days of safety stock

  @Column({ type: 'int', nullable: true })
  leadTimeDays?: number; // Supplier lead time in days

  // EOQ Parameters
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  annualDemand?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  orderingCost?: number; // Cost per order

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  holdingCostRate?: number; // % of item value per year

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  unitCost?: number;

  // Demand-based Parameters
  @Column({ type: 'int', default: 30 })
  demandLookbackDays: number; // Days to look back for demand calculation

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.5 })
  demandMultiplier: number; // Multiplier for demand-based ordering

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.95 })
  serviceLevel: number; // Target service level (0-1)

  // Forecasting Parameters
  @Column({ type: 'boolean', default: false })
  useForecastingData: boolean;

  @Column({ type: 'int', default: 30 })
  forecastHorizonDays: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.8 })
  forecastConfidenceThreshold: number;

  // Supplier Selection
  @Column({
    type: 'enum',
    enum: SupplierSelectionMethod,
    default: SupplierSelectionMethod.PRIMARY,
  })
  supplierSelectionMethod: SupplierSelectionMethod;

  @Column({ type: 'jsonb', nullable: true })
  supplierWeights?: {
    cost: number;
    quality: number;
    delivery: number;
    reliability: number;
  };

  @Column({ type: 'simple-array', nullable: true })
  allowedSupplierIds?: string[];

  // Budget and Constraints
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxOrderValue?: number;

  @Column({ type: 'int', nullable: true })
  maxOrderQuantity?: number;

  @Column({ type: 'int', nullable: true })
  minOrderQuantity?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budgetLimit?: number; // Monthly budget limit

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  currentMonthSpend: number;

  // Approval and Automation Settings
  @Column({ type: 'boolean', default: true })
  requiresApproval: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  autoApprovalThreshold?: number; // Auto-approve if below this value

  @Column({ type: 'simple-array', nullable: true })
  approverUserIds?: string[];

  @Column({ type: 'boolean', default: true })
  isFullyAutomated: boolean; // If false, just creates draft POs

  // Scheduling
  @Column({ type: 'varchar', length: 50, nullable: true })
  cronSchedule?: string; // For scheduled reorders

  @Column({ type: 'timestamp', nullable: true })
  nextReviewDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastExecutedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt?: Date;

  // Performance Tracking
  @Column({ type: 'int', default: 0 })
  totalOrdersGenerated: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalValueOrdered: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageAccuracy?: number; // Accuracy of quantity predictions

  @Column({ type: 'int', default: 0 })
  stockoutsPrevented: number;

  @Column({ type: 'int', default: 0 })
  overstockIncidents: number;

  // Alert and Notification Settings
  @Column({ type: 'boolean', default: true })
  sendNotifications: boolean;

  @Column({ type: 'simple-array', nullable: true })
  notificationEmails?: string[];

  @Column({ type: 'boolean', default: false })
  notifyOnExecution: boolean;

  @Column({ type: 'boolean', default: true })
  notifyOnErrors: boolean;

  // Exception Handling
  @Column({ type: 'int', default: 3 })
  maxRetryAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lastErrorAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastErrorMessage?: string;

  @Column({ type: 'int', default: 0 })
  consecutiveErrors: number;

  // Seasonal and Advanced Settings
  @Column({ type: 'jsonb', nullable: true })
  seasonalFactors?: {
    [month: string]: number; // Seasonal multipliers by month
  };

  @Column({ type: 'jsonb', nullable: true })
  customParameters?: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  // Activity Flags
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPaused: boolean;

  @Column({ type: 'timestamp', nullable: true })
  pausedUntil?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pauseReason?: string;

  // Relations
  @ManyToOne(() => Product, product => product.reorderRules)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => InventoryLocation, location => location.reorderRules, { nullable: true })
  @JoinColumn({ name: 'locationId' })
  location?: InventoryLocation;

  @ManyToOne(() => Supplier, supplier => supplier.reorderRules, { nullable: true })
  @JoinColumn({ name: 'primarySupplierId' })
  primarySupplier?: Supplier;

  @OneToMany(() => ReorderExecution, execution => execution.reorderRule)
  executions?: ReorderExecution[];

  // Virtual Properties
  get isEligibleForExecution(): boolean {
    if (!this.isActive || this.isPaused) return false;
    if (this.status !== ReorderStatus.ACTIVE) return false;
    if (this.pausedUntil && this.pausedUntil > new Date()) return false;
    return true;
  }

  get isDue(): boolean {
    if (!this.nextReviewDate) return true;
    return this.nextReviewDate <= new Date();
  }

  get remainingBudget(): number {
    if (!this.budgetLimit) return Infinity;
    return Math.max(0, this.budgetLimit - this.currentMonthSpend);
  }

  get hasRecentErrors(): boolean {
    if (this.consecutiveErrors >= this.maxRetryAttempts) return true;
    if (!this.lastErrorAt) return false;
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.lastErrorAt > oneHourAgo;
  }

  get effectiveServiceLevel(): number {
    // Adjust service level based on recent performance
    let adjustedLevel = this.serviceLevel;
    
    if (this.stockoutsPrevented > 0 && this.overstockIncidents > 0) {
      const ratio = this.stockoutsPrevented / (this.stockoutsPrevented + this.overstockIncidents);
      if (ratio < 0.8) {
        adjustedLevel = Math.min(0.99, this.serviceLevel + 0.05);
      } else if (ratio > 0.95) {
        adjustedLevel = Math.max(0.8, this.serviceLevel - 0.05);
      }
    }
    
    return adjustedLevel;
  }

  // Business Methods
  calculateEOQ(): number {
    if (!this.annualDemand || !this.orderingCost || !this.holdingCostRate || !this.unitCost) {
      return this.reorderQuantity;
    }

    const holdingCost = this.unitCost * (this.holdingCostRate / 100);
    const eoq = Math.sqrt((2 * this.annualDemand * this.orderingCost) / holdingCost);
    
    return Math.round(eoq);
  }

  calculateSafetyStock(averageDemand: number, demandVariance: number): number {
    if (!this.safetyStockDays && !this.serviceLevel) return 0;

    if (this.safetyStockDays) {
      return Math.round(averageDemand * this.safetyStockDays);
    }

    // Using normal distribution approximation for service level
    const zScore = this.getZScoreForServiceLevel(this.effectiveServiceLevel);
    const leadTimeVariance = Math.pow(this.leadTimeDays || 7, 2) * demandVariance;
    const safetyStock = zScore * Math.sqrt(leadTimeVariance);
    
    return Math.round(safetyStock);
  }

  calculateReorderPoint(averageDemand: number, demandVariance: number): number {
    const leadTimeDemand = averageDemand * (this.leadTimeDays || 7);
    const safetyStock = this.calculateSafetyStock(averageDemand, demandVariance);
    
    return Math.round(leadTimeDemand + safetyStock);
  }

  getSeasonalFactor(month?: number): number {
    if (!this.seasonalFactors) return 1.0;
    
    const targetMonth = month || new Date().getMonth() + 1;
    const monthKey = targetMonth.toString();
    
    return this.seasonalFactors[monthKey] || 1.0;
  }

  updateNextReviewDate(): void {
    if (this.cronSchedule) {
      // Parse cron schedule and calculate next execution
      // For now, default to daily review
      this.nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      // Default review based on rule type
      const hours = this.ruleType === ReorderRuleType.DEMAND_BASED ? 12 : 24;
      this.nextReviewDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }

  recordExecution(success: boolean, orderValue?: number, errorMessage?: string): void {
    this.lastExecutedAt = new Date();
    
    if (success) {
      this.totalOrdersGenerated += 1;
      if (orderValue) {
        this.totalValueOrdered += orderValue;
        this.currentMonthSpend += orderValue;
      }
      this.consecutiveErrors = 0;
      this.lastErrorMessage = null;
    } else {
      this.consecutiveErrors += 1;
      this.lastErrorAt = new Date();
      this.lastErrorMessage = errorMessage || 'Unknown error';
    }
    
    this.updateNextReviewDate();
  }

  resetMonthlySpend(): void {
    this.currentMonthSpend = 0;
  }

  pause(reason?: string, durationHours?: number): void {
    this.isPaused = true;
    this.pauseReason = reason;
    
    if (durationHours) {
      this.pausedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    }
  }

  resume(): void {
    this.isPaused = false;
    this.pauseReason = null;
    this.pausedUntil = null;
    this.updateNextReviewDate();
  }

  private getZScoreForServiceLevel(serviceLevel: number): number {
    // Approximation of Z-scores for common service levels
    const zScores: { [key: string]: number } = {
      '0.50': 0.00,
      '0.80': 0.84,
      '0.85': 1.04,
      '0.90': 1.28,
      '0.95': 1.65,
      '0.97': 1.88,
      '0.98': 2.05,
      '0.99': 2.33,
      '0.995': 2.58,
    };

    const key = serviceLevel.toFixed(2);
    return zScores[key] || 1.65; // Default to 95% service level
  }
}

// Related entity for tracking reorder rule executions
@Entity('reorder_executions')
@Index(['tenantId', 'reorderRuleId'])
@Index(['tenantId', 'executedAt'])
@Index(['tenantId', 'success'])
export class ReorderExecution extends AuditableEntity {
  @Column({ type: 'uuid' })
  reorderRuleId: string;

  @Column({ type: 'uuid', nullable: true })
  purchaseOrderId?: string;

  @Column({ type: 'timestamp' })
  executedAt: Date;

  @Column({ type: 'boolean', default: false })
  success: boolean;

  @Column({ type: 'int', nullable: true })
  triggeredQuantity?: number;

  @Column({ type: 'int', nullable: true })
  recommendedQuantity?: number;

  @Column({ type: 'int', nullable: true })
  actualQuantity?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  orderValue?: number;

  @Column({ type: 'uuid', nullable: true })
  selectedSupplierId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  triggerReason?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  calculationDetails?: {
    currentStock: number;
    reorderPoint: number;
    leadTimeDemand: number;
    safetyStock: number;
    forecastDemand?: number;
    eoqCalculation?: number;
    seasonalFactor?: number;
    supplierScores?: { [supplierId: string]: number };
  };

  @Column({ type: 'int', nullable: true })
  executionTimeMs?: number;

  // Relations
  @ManyToOne(() => ReorderRule, rule => rule.executions)
  @JoinColumn({ name: 'reorderRuleId' })
  reorderRule: ReorderRule;
}