import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from './customer.entity';

export enum SegmentationType {
  BEHAVIORAL = 'behavioral',
  DEMOGRAPHIC = 'demographic',
  TRANSACTIONAL = 'transactional',
  PSYCHOGRAPHIC = 'psychographic',
  GEOGRAPHIC = 'geographic',
  LIFECYCLE = 'lifecycle',
  VALUE_BASED = 'value_based',
}

export enum SegmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Entity('customer_segments')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'segmentType'])
@Index(['tenantId', 'segmentName'])
@Index(['tenantId', 'isActive'])
export class CustomerSegment extends BaseEntity {
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar', length: 100 })
  segmentName: string;

  @Column({ type: 'text', nullable: true })
  segmentDescription?: string;

  @Column({
    type: 'enum',
    enum: SegmentationType,
  })
  segmentType: SegmentationType;

  @Column({
    type: 'enum',
    enum: SegmentStatus,
    default: SegmentStatus.ACTIVE,
  })
  status: SegmentStatus;

  // Segmentation criteria
  @Column({ type: 'jsonb' })
  criteria: {
    rules: Array<{
      field: string;
      operator:
        | 'eq'
        | 'ne'
        | 'gt'
        | 'gte'
        | 'lt'
        | 'lte'
        | 'in'
        | 'not_in'
        | 'contains'
        | 'not_contains';
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>;
    conditions: {
      minimumOrderValue?: number;
      maximumOrderValue?: number;
      minimumOrders?: number;
      maximumOrders?: number;
      timeframe?: string; // '30d', '90d', '1y', etc.
      geographicArea?: string[];
      ageRange?: { min: number; max: number };
      customerType?: string[];
      loyaltyTier?: string[];
    };
  };

  // Segment metrics
  @Column({ type: 'integer', default: 0 })
  customerCount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRevenue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  averageOrderValue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageLifetimeValue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  retentionRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  churnRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  conversionRate: number;

  // Campaign performance
  @Column({ type: 'jsonb', nullable: true })
  campaignPerformance?: {
    emailOpenRate: number;
    emailClickRate: number;
    smsResponseRate: number;
    whatsappResponseRate: number;
    averageResponseTime: number; // in hours
    lastCampaignDate?: string;
    bestPerformingChannel?: string;
  };

  // Auto-assignment rules
  @Column({ type: 'boolean', default: false })
  isAutoAssigned: boolean;

  @Column({ type: 'jsonb', nullable: true })
  autoAssignmentRules?: {
    enabled: boolean;
    frequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
    lastRunAt?: string;
    nextRunAt?: string;
  };

  // Segment insights
  @Column({ type: 'jsonb', nullable: true })
  insights?: {
    topProducts: Array<{
      productId: string;
      productName: string;
      purchaseCount: number;
      revenue: number;
    }>;
    topCategories: Array<{
      categoryId: string;
      categoryName: string;
      purchaseCount: number;
      revenue: number;
    }>;
    peakPurchaseTimes: {
      hour: number;
      dayOfWeek: number;
      month: number;
    };
    seasonalTrends: Record<string, number>;
    geographicDistribution: Record<string, number>;
  };

  // Business impact
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  projectedValue: number; // Projected revenue from this segment

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  growthRate: number; // Month-over-month growth rate

  @Column({ type: 'jsonb', nullable: true })
  targetingRecommendations?: {
    recommendedChannels: string[];
    recommendedProducts: string[];
    recommendedCampaignTypes: string[];
    optimalContactFrequency: string;
    personalizedOffers: Array<{
      type: string;
      discount: number;
      products: string[];
      validUntil: string;
    }>;
  };

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastAnalyzedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextAnalysisDate?: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  // Virtual fields
  get averageRevenuePerCustomer(): number {
    return this.customerCount > 0 ? this.totalRevenue / this.customerCount : 0;
  }

  get segmentHealth(): 'healthy' | 'warning' | 'critical' {
    if (this.churnRate > 30) return 'critical';
    if (this.churnRate > 15 || this.growthRate < 0) return 'warning';
    return 'healthy';
  }

  get segmentProfitability(): 'high' | 'medium' | 'low' {
    const avgRevenue = this.averageRevenuePerCustomer;
    if (avgRevenue > 10000000) return 'high'; // 10M IDR
    if (avgRevenue > 2000000) return 'medium'; // 2M IDR
    return 'low';
  }

  // Methods
  calculateMetrics(customers: Customer[]): void {
    this.customerCount = customers.length;

    if (customers.length === 0) {
      this.totalRevenue = 0;
      this.averageOrderValue = 0;
      this.averageLifetimeValue = 0;
      this.retentionRate = 0;
      this.churnRate = 0;
      return;
    }

    // Calculate total metrics
    this.totalRevenue = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
    this.averageOrderValue =
      customers.reduce((sum, c) => sum + c.averageOrderValue, 0) /
      customers.length;
    this.averageLifetimeValue = this.totalRevenue / customers.length;

    // Calculate retention and churn rates
    const activeCustomers = customers.filter(
      c => c.daysSinceLastOrder <= 90,
    ).length;
    this.retentionRate = (activeCustomers / customers.length) * 100;
    this.churnRate = 100 - this.retentionRate;
  }

  generateInsights(customers: Customer[]): void {
    if (customers.length === 0) return;

    // This would typically involve complex analytics
    // For now, we'll create a placeholder structure
    this.insights = {
      topProducts: [],
      topCategories: [],
      peakPurchaseTimes: {
        hour: 14, // 2 PM average
        dayOfWeek: 3, // Wednesday
        month: 6, // June
      },
      seasonalTrends: {},
      geographicDistribution: {},
    };

    this.lastAnalyzedAt = new Date();
    this.nextAnalysisDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Next week
  }

  generateTargetingRecommendations(): void {
    const recommendations: any = {
      recommendedChannels: [],
      recommendedProducts: [],
      recommendedCampaignTypes: [],
      optimalContactFrequency: 'weekly',
      personalizedOffers: [],
    };

    // Generate recommendations based on segment type and performance
    switch (this.segmentType) {
      case SegmentationType.VALUE_BASED:
        if (this.averageLifetimeValue > 50000000) {
          // High value
          recommendations.recommendedChannels = ['email', 'phone', 'whatsapp'];
          recommendations.recommendedCampaignTypes = [
            'premium_offers',
            'early_access',
            'vip_events',
          ];
          recommendations.optimalContactFrequency = 'bi-weekly';
        }
        break;

      case SegmentationType.BEHAVIORAL:
        if (this.churnRate > 20) {
          recommendations.recommendedChannels = ['whatsapp', 'email'];
          recommendations.recommendedCampaignTypes = [
            'retention',
            'win_back',
            'loyalty_rewards',
          ];
          recommendations.optimalContactFrequency = 'weekly';
        }
        break;

      default:
        recommendations.recommendedChannels = ['email', 'whatsapp'];
        recommendations.recommendedCampaignTypes = [
          'promotional',
          'educational',
        ];
        recommendations.optimalContactFrequency = 'monthly';
    }

    this.targetingRecommendations = recommendations;
  }

  updateAutoAssignment(): void {
    if (!this.isAutoAssigned || !this.autoAssignmentRules?.enabled) return;

    const now = new Date();
    const nextRun = this.autoAssignmentRules.nextRunAt
      ? new Date(this.autoAssignmentRules.nextRunAt)
      : now;

    if (now >= nextRun) {
      // Mark for re-assignment
      this.autoAssignmentRules.lastRunAt = now.toISOString();

      // Calculate next run time based on frequency
      const nextRunTime = new Date(now);
      switch (this.autoAssignmentRules.frequency) {
        case 'daily':
          nextRunTime.setDate(nextRunTime.getDate() + 1);
          break;
        case 'weekly':
          nextRunTime.setDate(nextRunTime.getDate() + 7);
          break;
        case 'monthly':
          nextRunTime.setMonth(nextRunTime.getMonth() + 1);
          break;
      }

      this.autoAssignmentRules.nextRunAt = nextRunTime.toISOString();
    }
  }
}
