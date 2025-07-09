import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import moment from 'moment-timezone';

import {
  Supplier,
  SupplierStatus,
} from '../../suppliers/entities/supplier.entity';
import { Product } from '../../products/entities/product.entity';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../../purchase-orders/entities/purchase-order.entity';
import {
  ReorderRule,
  SupplierSelectionMethod,
} from '../entities/reorder-rule.entity';

export interface SupplierEvaluationCriteria {
  costWeight: number; // 0-1
  qualityWeight: number; // 0-1
  deliveryWeight: number; // 0-1
  reliabilityWeight: number; // 0-1
  capacityWeight?: number; // 0-1
  locationWeight?: number; // 0-1
  sustainabilityWeight?: number; // 0-1
}

export interface SupplierScore {
  supplierId: string;
  supplier: Supplier;
  totalScore: number; // 0-100

  // Individual scores
  costScore: number;
  qualityScore: number;
  deliveryScore: number;
  reliabilityScore: number;
  capacityScore?: number;
  locationScore?: number;
  sustainabilityScore?: number;

  // Supporting data
  evaluationDetails: {
    averageUnitCost: number;
    onTimeDeliveryRate: number;
    qualityRating: number;
    reliabilityIndex: number;
    leadTimeDays: number;
    totalOrders: number;
    lastOrderDate?: Date;
    contractStatus: string;
    paymentTerms: string;
    discount: number;
  };

  // Ranking and recommendation
  rank: number;
  isRecommended: boolean;
  confidenceLevel: number; // 0-1
  riskFactors: string[];
  advantages: string[];

  // Financial metrics
  estimatedCost: number;
  potentialSavings: number;
  creditLimit: number;
  remainingCredit: number;
}

export interface SupplierSelectionRequest {
  product: Product;
  reorderRule: ReorderRule;
  orderQuantity: number;
  urgencyLevel: number; // 0-10
  budgetConstraint?: number;
  deliveryDeadline?: Date;
  qualityRequirements?: {
    minimumRating: number;
    certificationRequired?: string[];
  };
  excludeSuppliers?: string[];
  includeOnlySuppliers?: string[];
  selectionMethod?: SupplierSelectionMethod;
  evaluationCriteria?: SupplierEvaluationCriteria;
  riskAssessmentLevel?: 'basic' | 'comprehensive' | 'enterprise';
  considerDisruptionFactors?: boolean;
}

export interface SupplierSelectionResult {
  success: boolean;
  selectedSupplier?: SupplierScore;
  alternativeSuppliers: SupplierScore[];

  // Selection metadata
  selectionMethod: SupplierSelectionMethod;
  evaluationCriteria: SupplierEvaluationCriteria;
  totalSuppliersEvaluated: number;
  selectionConfidence: number; // 0-1

  // Recommendation insights
  selectionReason: string;
  riskWarnings: string[];
  costBenefitAnalysis: {
    selectedSupplierCost: number;
    averageCost: number;
    potentialSavings: number;
    riskAdjustedSavings: number;
  };

  // Performance predictions
  predictedDeliveryDate: Date;
  predictedQuality: number;
  predictedReliability: number;

  // Next best alternatives
  secondChoice?: SupplierScore;
  budgetAlternative?: SupplierScore;
  qualityAlternative?: SupplierScore;
  speedAlternative?: SupplierScore;

  // Supply chain risk assessment
  supplyChainRiskAssessment?: SupplyChainRiskAssessment;

  evaluatedAt: Date;
  validUntil: Date;
}

export interface SupplyChainRiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  overallRiskScore: number; // 0-100
  riskFactors: RiskFactor[];
  disruptionProbability: number; // 0-1
  potentialImpact: DisruptionImpact;
  mitigationStrategies: MitigationStrategy[];
  contingencyPlans: ContingencyPlan[];
  riskTrends: RiskTrend[];
  lastAssessmentDate: Date;
  nextReviewDate: Date;
  assessmentLevel: 'basic' | 'comprehensive' | 'enterprise';
}

export interface RiskFactor {
  type: RiskFactorType;
  category: RiskCategory;
  description: string;
  probability: number; // 0-1
  impact: number; // 0-10
  riskScore: number; // probability * impact
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  detectedAt: Date;
  estimatedDuration?: number; // in days
  geographicScope: 'local' | 'regional' | 'national' | 'global';
  sources: string[];
  confidence: number; // 0-1
}

export enum RiskFactorType {
  NATURAL_DISASTER = 'natural_disaster',
  POLITICAL_INSTABILITY = 'political_instability',
  ECONOMIC_DISRUPTION = 'economic_disruption',
  TRANSPORTATION_DISRUPTION = 'transportation_disruption',
  SUPPLIER_DEPENDENCY = 'supplier_dependency',
  GEOGRAPHIC_CONCENTRATION = 'geographic_concentration',
  SEASONAL_DISRUPTION = 'seasonal_disruption',
  PANDEMIC_IMPACT = 'pandemic_impact',
  INFRASTRUCTURE_FAILURE = 'infrastructure_failure',
  CURRENCY_FLUCTUATION = 'currency_fluctuation',
  REGULATORY_CHANGE = 'regulatory_change',
  CYBER_SECURITY = 'cyber_security',
  QUALITY_ISSUES = 'quality_issues',
  FINANCIAL_DISTRESS = 'financial_distress',
  LABOR_DISRUPTION = 'labor_disruption',
}

export enum RiskCategory {
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  STRATEGIC = 'strategic',
  COMPLIANCE = 'compliance',
  REPUTATIONAL = 'reputational',
  ENVIRONMENTAL = 'environmental',
  TECHNOLOGICAL = 'technological',
}

export interface DisruptionImpact {
  supplyContinuity: number; // 0-10
  costIncrease: number; // percentage
  deliveryDelay: number; // days
  qualityReduction: number; // 0-10
  reputationDamage: number; // 0-10
  customerSatisfaction: number; // 0-10
  financialLoss: number; // IDR
  operationalDisruption: number; // 0-10
}

export interface MitigationStrategy {
  id: string;
  name: string;
  description: string;
  applicableRisks: RiskFactorType[];
  effectiveness: number; // 0-1
  implementationCost: number; // IDR
  implementationTime: number; // days
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'planned' | 'implementing' | 'active' | 'completed';
  responsibility: string;
  deadlineDate?: Date;
  resources: string[];
}

export interface ContingencyPlan {
  id: string;
  name: string;
  triggerConditions: string[];
  activationThreshold: number; // risk score threshold
  actionSteps: ActionStep[];
  alternativeSuppliers: string[];
  estimatedActivationTime: number; // hours
  requiredResources: string[];
  communicationPlan: string;
  testingSchedule: string;
  lastTestedDate?: Date;
  effectiveness: number; // 0-1
}

export interface ActionStep {
  sequence: number;
  description: string;
  responsibility: string;
  estimatedDuration: number; // hours
  dependencies: string[];
  resources: string[];
  successCriteria: string;
}

export interface RiskTrend {
  riskType: RiskFactorType;
  historicalData: RiskDataPoint[];
  currentLevel: number; // 0-10
  trend: 'increasing' | 'decreasing' | 'stable';
  predictedLevel: number; // 0-10
  predictionConfidence: number; // 0-1
  seasonalPattern?: SeasonalPattern;
  keyDrivers: string[];
  recommendations: string[];
}

export interface RiskDataPoint {
  date: Date;
  riskLevel: number; // 0-10
  incidents: number;
  severity: number; // 0-10
  impact: number; // 0-10
  source: string;
}

export interface SeasonalPattern {
  monthlyRiskLevels: { [month: number]: number };
  peakRiskPeriods: { startMonth: number; endMonth: number; description: string }[];
  historicalPatterns: string[];
}

@Injectable()
export class SupplierSelectionService {
  private readonly logger = new Logger(SupplierSelectionService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Select optimal supplier based on criteria and method
   */
  async selectSupplier(
    request: SupplierSelectionRequest,
  ): Promise<SupplierSelectionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Selecting supplier for product ${request.product.id}, quantity ${request.orderQuantity}`,
      );

      // Get eligible suppliers
      const eligibleSuppliers = await this.getEligibleSuppliers(request);

      if (eligibleSuppliers.length === 0) {
        return this.createNoSuppliersResult(request);
      }

      // Evaluate each supplier
      const supplierScores = await Promise.all(
        eligibleSuppliers.map(supplier =>
          this.evaluateSupplier(supplier, request),
        ),
      );

      // Apply selection method
      const selectedSupplier = this.applySelectionMethod(
        supplierScores,
        request,
      );

      // Sort alternatives by score
      const alternatives = supplierScores
        .filter(score => score.supplierId !== selectedSupplier?.supplierId)
        .sort((a, b) => b.totalScore - a.totalScore);

      // Calculate insights and recommendations
      const result = this.buildSelectionResult(
        selectedSupplier,
        alternatives,
        supplierScores,
        request,
      );

      // Add supply chain risk assessment if requested
      if (request.considerDisruptionFactors || request.riskAssessmentLevel) {
        result.supplyChainRiskAssessment = await this.performSupplyChainRiskAssessment(
          selectedSupplier,
          alternatives,
          request,
        );
      }

      const selectionTime = Date.now() - startTime;
      this.logger.debug(`Supplier selection completed in ${selectionTime}ms`);

      return result;
    } catch (error) {
      this.logger.error(
        `Error in supplier selection: ${error.message}`,
        error.stack,
      );
      return this.createErrorResult(request, error.message);
    }
  }

  /**
   * Get suppliers eligible for the product and order
   */
  private async getEligibleSuppliers(
    request: SupplierSelectionRequest,
  ): Promise<Supplier[]> {
    const {
      product,
      reorderRule,
      orderQuantity,
      includeOnlySuppliers,
      excludeSuppliers,
    } = request;

    let query = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.tenantId = :tenantId', { tenantId: product.tenantId })
      .andWhere('supplier.status = :status', { status: SupplierStatus.ACTIVE })
      .andWhere('supplier.isDeleted = false');

    // Filter by allowed suppliers if specified in reorder rule
    if (
      reorderRule.allowedSupplierIds &&
      reorderRule.allowedSupplierIds.length > 0
    ) {
      query = query.andWhere('supplier.id IN (:...allowedIds)', {
        allowedIds: reorderRule.allowedSupplierIds,
      });
    }

    // Apply include/exclude filters
    if (includeOnlySuppliers && includeOnlySuppliers.length > 0) {
      query = query.andWhere('supplier.id IN (:...includeIds)', {
        includeIds: includeOnlySuppliers,
      });
    }

    if (excludeSuppliers && excludeSuppliers.length > 0) {
      query = query.andWhere('supplier.id NOT IN (:...excludeIds)', {
        excludeIds: excludeSuppliers,
      });
    }

    // Check if supplier can handle the order quantity (basic capacity check)
    // Note: Using creditLimit as a proxy for capacity since maxOrderQuantity is not defined
    if (orderQuantity > 0 && request.product.costPrice) {
      const estimatedOrderValue = orderQuantity * request.product.costPrice;
      query = query.andWhere(
        '(supplier.creditLimit IS NULL OR supplier.creditLimit >= :estimatedValue)',
        { estimatedValue: estimatedOrderValue },
      );
    }

    // Check budget constraints
    if (request.budgetConstraint && product.costPrice) {
      const maxQuantityByBudget = Math.floor(
        request.budgetConstraint / product.costPrice,
      );
      if (maxQuantityByBudget < orderQuantity) {
        // Look for suppliers with lower costs or higher discounts
        query = query.andWhere(
          '(supplier.discount > 0 OR supplier.creditLimit >= :budgetConstraint)',
          { budgetConstraint: request.budgetConstraint },
        );
      }
    }

    return query.getMany();
  }

  /**
   * Evaluate a single supplier against the criteria
   */
  private async evaluateSupplier(
    supplier: Supplier,
    request: SupplierSelectionRequest,
  ): Promise<SupplierScore> {
    const { product, orderQuantity, reorderRule } = request;

    // Get supplier performance history
    const performanceData = await this.getSupplierPerformance(
      supplier.id,
      product.tenantId,
    );

    // Calculate individual scores
    const costScore = await this.calculateCostScore(
      supplier,
      product,
      orderQuantity,
    );
    const qualityScore = this.calculateQualityScore(supplier, performanceData);
    const deliveryScore = this.calculateDeliveryScore(
      supplier,
      performanceData,
      request.urgencyLevel,
    );
    const reliabilityScore = this.calculateReliabilityScore(
      supplier,
      performanceData,
    );

    // Optional scores
    const capacityScore = await this.calculateCapacityScore(supplier, orderQuantity, product);
    const locationScore = this.calculateLocationScore(
      supplier,
      request.deliveryDeadline,
    );

    // Get evaluation criteria (from rule or defaults)
    const criteria = this.getEvaluationCriteria(
      reorderRule,
      request.evaluationCriteria,
    );

    // Calculate weighted total score
    const totalScore = this.calculateWeightedScore(
      {
        costScore,
        qualityScore,
        deliveryScore,
        reliabilityScore,
        capacityScore,
        locationScore,
      },
      criteria,
    );

    // Build evaluation details
    const evaluationDetails = {
      averageUnitCost: await this.getAverageUnitCost(supplier, product),
      onTimeDeliveryRate: supplier.onTimeDeliveryRate,
      qualityRating: supplier.rating,
      reliabilityIndex: this.calculateReliabilityIndex(
        supplier,
        performanceData,
      ),
      leadTimeDays: supplier.leadTimeDays,
      totalOrders: supplier.totalOrders,
      lastOrderDate: supplier.lastOrderDate,
      contractStatus: this.getContractStatus(supplier),
      paymentTerms: supplier.paymentTerms,
      discount: supplier.discount,
    };

    // Risk analysis
    const { riskFactors, advantages } = this.analyzeSupplierRisks(
      supplier,
      performanceData,
      request,
    );

    // Confidence calculation
    const confidenceLevel = this.calculateConfidenceLevel(
      supplier,
      performanceData,
    );

    // Financial calculations
    const estimatedCost = this.calculateEstimatedCost(
      supplier,
      product,
      orderQuantity,
    );
    const potentialSavings = this.calculatePotentialSavings(
      estimatedCost,
      request,
    );

    return {
      supplierId: supplier.id,
      supplier,
      totalScore,
      costScore,
      qualityScore,
      deliveryScore,
      reliabilityScore,
      capacityScore,
      locationScore,
      evaluationDetails,
      rank: 0, // Will be set later
      isRecommended: totalScore >= 70, // Threshold for recommendation
      confidenceLevel,
      riskFactors,
      advantages,
      estimatedCost,
      potentialSavings,
      creditLimit: supplier.creditLimit,
      remainingCredit: Math.max(
        0,
        supplier.creditLimit - supplier.totalPurchaseAmount,
      ),
    };
  }

  /**
   * Calculate cost score (0-100, higher is better)
   */
  private async calculateCostScore(
    supplier: Supplier,
    product: Product,
    orderQuantity: number,
  ): Promise<number> {
    const baseUnitCost = product.costPrice || 0;
    const supplierDiscount = supplier.discount / 100;
    const effectiveUnitCost = baseUnitCost * (1 - supplierDiscount);

    // Get historical pricing if available
    const historicalCost = await this.getAverageUnitCost(supplier, product);
    const finalUnitCost = historicalCost || effectiveUnitCost;

    // Calculate total cost including shipping and fees
    const shippingCost = this.estimateShippingCost(supplier, orderQuantity, product);
    const totalCost = finalUnitCost * orderQuantity + shippingCost;

    // Score based on cost competitiveness (lower cost = higher score)
    // Use industry benchmark or average as baseline
    const industryBenchmark = baseUnitCost * 0.9; // Assume 10% below retail as good
    const costRatio = industryBenchmark / finalUnitCost;

    return Math.min(100, Math.max(0, costRatio * 80)); // Scale to 0-100
  }

  /**
   * Calculate quality score based on ratings and performance
   */
  private calculateQualityScore(
    supplier: Supplier,
    performanceData: any,
  ): number {
    const rating = supplier.rating || 0; // 0-5 scale
    const qualityScore = supplier.qualityScore || 0; // 0-100 scale

    // Combine rating and quality score
    const ratingScore = (rating / 5) * 50; // Convert to 0-50
    const qualityComponent = qualityScore * 0.5; // Convert to 0-50

    return Math.min(100, ratingScore + qualityComponent);
  }

  /**
   * Calculate delivery performance score
   */
  private calculateDeliveryScore(
    supplier: Supplier,
    performanceData: any,
    urgencyLevel: number,
  ): number {
    const onTimeRate = supplier.onTimeDeliveryRate || 0;
    const leadTime = supplier.leadTimeDays || 30;

    // Base score from on-time delivery rate
    let score = onTimeRate;

    // Adjust for lead time (shorter is better)
    const leadTimeScore = Math.max(0, 100 - (leadTime - 1) * 5); // Penalty for longer lead times
    score = score * 0.7 + leadTimeScore * 0.3;

    // Urgency adjustment
    if (urgencyLevel >= 7) {
      // High urgency - prioritize speed
      const speedBonus = Math.max(0, (14 - leadTime) * 3);
      score += speedBonus;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(
    supplier: Supplier,
    performanceData: any,
  ): number {
    const totalOrders = supplier.totalOrders || 0;
    const onTimeRate = supplier.onTimeDeliveryRate || 0;
    const rating = supplier.rating || 0;

    // Experience score (more orders = more reliable)
    const experienceScore = Math.min(50, totalOrders * 2);

    // Performance consistency score
    const consistencyScore = onTimeRate * 0.3;

    // Overall rating score
    const ratingScore = (rating / 5) * 20;

    return Math.min(100, experienceScore + consistencyScore + ratingScore);
  }

  /**
   * Calculate comprehensive capacity score based on multiple capacity metrics
   */
  private async calculateCapacityScore(
    supplier: Supplier,
    orderQuantity: number,
    product?: Product,
  ): Promise<number> {
    const capacityFactors = {
      financial: 0,
      volume: 0,
      operational: 0,
      quality: 0,
      temporal: 0,
      risk: 0,
    };

    // 1. Financial Capacity (25% weight)
    capacityFactors.financial = await this.calculateFinancialCapacity(
      supplier,
      orderQuantity,
      product,
    );

    // 2. Volume Capacity (30% weight)
    capacityFactors.volume = await this.calculateVolumeCapacity(
      supplier,
      orderQuantity,
    );

    // 3. Operational Capacity (20% weight)
    capacityFactors.operational = this.calculateOperationalCapacity(supplier);

    // 4. Quality Capacity (15% weight)
    capacityFactors.quality = this.calculateQualityCapacity(supplier);

    // 5. Temporal Capacity (10% weight)
    capacityFactors.temporal = this.calculateTemporalCapacity(supplier);

    // 6. Risk-Adjusted Capacity (applied as multiplier)
    capacityFactors.risk = this.calculateCapacityRiskFactor(supplier);

    // Calculate weighted capacity score
    const baseScore =
      capacityFactors.financial * 0.25 +
      capacityFactors.volume * 0.3 +
      capacityFactors.operational * 0.2 +
      capacityFactors.quality * 0.15 +
      capacityFactors.temporal * 0.1;

    // Apply risk adjustment
    const riskAdjustedScore = baseScore * capacityFactors.risk;

    // Indonesian market context adjustments
    let contextScore = riskAdjustedScore;

    // Local suppliers get capacity bonus for Indonesian market
    if (supplier.country === 'Indonesia' || !supplier.country) {
      contextScore *= 1.1; // 10% bonus for local suppliers
    }

    // Ramadan/Lebaran season capacity adjustment
    if (this.isRamadanSeason()) {
      contextScore *= 0.9; // 10% capacity reduction during Ramadan
    }

    // Indonesian business hours efficiency
    if (supplier.country === 'Indonesia') {
      contextScore *= 1.05; // 5% efficiency bonus for timezone alignment
    }

    return Math.min(100, Math.max(0, contextScore));
  }

  /**
   * Calculate financial capacity based on credit limits, payment terms, and financial health
   */
  private async calculateFinancialCapacity(
    supplier: Supplier,
    orderQuantity: number,
    product?: Product,
  ): Promise<number> {
    const creditLimit = supplier.creditLimit || 0;
    const totalPurchaseAmount = supplier.totalPurchaseAmount || 0;
    const estimatedUnitCost = product?.costPrice || 100000; // IDR 100,000 default
    const estimatedOrderValue = orderQuantity * estimatedUnitCost;

    // Available credit capacity
    const availableCredit = Math.max(0, creditLimit - totalPurchaseAmount);
    const creditUtilization = creditLimit > 0 ? totalPurchaseAmount / creditLimit : 0;

    let financialScore = 0;

    // Credit availability score (0-40 points)
    if (creditLimit === 0) {
      financialScore += 30; // No credit limit restrictions
    } else if (availableCredit >= estimatedOrderValue * 2) {
      financialScore += 40; // Excellent credit capacity
    } else if (availableCredit >= estimatedOrderValue) {
      financialScore += 35; // Good credit capacity
    } else if (availableCredit >= estimatedOrderValue * 0.5) {
      financialScore += 20; // Limited credit capacity
    } else {
      financialScore += 5; // Poor credit capacity
    }

    // Credit utilization score (0-30 points)
    if (creditUtilization <= 0.3) {
      financialScore += 30; // Low utilization
    } else if (creditUtilization <= 0.5) {
      financialScore += 25; // Moderate utilization
    } else if (creditUtilization <= 0.7) {
      financialScore += 15; // High utilization
    } else if (creditUtilization <= 0.9) {
      financialScore += 10; // Very high utilization
    } else {
      financialScore += 0; // Over-utilized
    }

    // Payment terms flexibility score (0-20 points)
    const paymentDays = supplier.getPaymentDueDays();
    if (paymentDays === -1) {
      financialScore += 5; // Prepaid reduces capacity
    } else if (paymentDays === 0) {
      financialScore += 10; // COD neutral
    } else if (paymentDays <= 30) {
      financialScore += 20; // Good payment terms
    } else if (paymentDays <= 60) {
      financialScore += 15; // Extended payment terms
    } else {
      financialScore += 10; // Very extended payment terms
    }

    // Financial stability score (0-10 points)
    const totalOrders = supplier.totalOrders || 0;
    if (totalOrders > 100) {
      financialScore += 10; // High order volume indicates financial stability
    } else if (totalOrders > 50) {
      financialScore += 8;
    } else if (totalOrders > 20) {
      financialScore += 6;
    } else if (totalOrders > 5) {
      financialScore += 4;
    } else {
      financialScore += 2;
    }

    return Math.min(100, financialScore);
  }

  /**
   * Calculate volume capacity based on historical order patterns
   */
  private async calculateVolumeCapacity(
    supplier: Supplier,
    orderQuantity: number,
  ): Promise<number> {
    const totalOrders = supplier.totalOrders || 0;
    const totalPurchaseAmount = supplier.totalPurchaseAmount || 0;

    let volumeScore = 0;

    // Historical volume experience (0-40 points)
    if (totalOrders === 0) {
      volumeScore += 15; // New supplier, limited data
    } else {
      const averageOrderValue = totalPurchaseAmount / totalOrders;
      const currentOrderValue = orderQuantity * 100000; // Estimated value

      if (currentOrderValue <= averageOrderValue * 0.5) {
        volumeScore += 40; // Small order relative to history
      } else if (currentOrderValue <= averageOrderValue) {
        volumeScore += 35; // Normal order size
      } else if (currentOrderValue <= averageOrderValue * 2) {
        volumeScore += 30; // Larger than usual
      } else if (currentOrderValue <= averageOrderValue * 5) {
        volumeScore += 20; // Significantly larger
      } else {
        volumeScore += 10; // Much larger than historical
      }
    }

    // Order frequency capacity (0-25 points)
    if (totalOrders > 200) {
      volumeScore += 25; // Very high order frequency
    } else if (totalOrders > 100) {
      volumeScore += 22; // High order frequency
    } else if (totalOrders > 50) {
      volumeScore += 18; // Moderate order frequency
    } else if (totalOrders > 20) {
      volumeScore += 15; // Low order frequency
    } else if (totalOrders > 5) {
      volumeScore += 10; // Very low order frequency
    } else {
      volumeScore += 5; // Minimal order history
    }

    // Growth capacity assessment (0-25 points)
    const monthsSinceLastOrder = supplier.lastOrderDate
      ? moment().diff(moment(supplier.lastOrderDate), 'months')
      : 12;

    if (monthsSinceLastOrder <= 1) {
      volumeScore += 25; // Recent orders indicate active capacity
    } else if (monthsSinceLastOrder <= 3) {
      volumeScore += 20; // Fairly recent
    } else if (monthsSinceLastOrder <= 6) {
      volumeScore += 15; // Moderate recency
    } else if (monthsSinceLastOrder <= 12) {
      volumeScore += 10; // Older relationship
    } else {
      volumeScore += 5; // Very old or no recent orders
    }

    // Quantity handling capacity (0-10 points)
    if (orderQuantity <= 100) {
      volumeScore += 10; // Small quantity, easy to handle
    } else if (orderQuantity <= 500) {
      volumeScore += 8; // Medium quantity
    } else if (orderQuantity <= 1000) {
      volumeScore += 6; // Large quantity
    } else if (orderQuantity <= 5000) {
      volumeScore += 4; // Very large quantity
    } else {
      volumeScore += 2; // Extremely large quantity
    }

    return Math.min(100, volumeScore);
  }

  /**
   * Calculate operational capacity based on delivery performance
   */
  private calculateOperationalCapacity(supplier: Supplier): number {
    let operationalScore = 0;

    // On-time delivery capacity (0-40 points)
    const onTimeRate = supplier.onTimeDeliveryRate || 0;
    if (onTimeRate >= 95) {
      operationalScore += 40; // Excellent delivery performance
    } else if (onTimeRate >= 90) {
      operationalScore += 35; // Very good performance
    } else if (onTimeRate >= 85) {
      operationalScore += 30; // Good performance
    } else if (onTimeRate >= 80) {
      operationalScore += 25; // Acceptable performance
    } else if (onTimeRate >= 70) {
      operationalScore += 15; // Below average
    } else if (onTimeRate >= 60) {
      operationalScore += 10; // Poor performance
    } else {
      operationalScore += 5; // Very poor performance
    }

    // Lead time efficiency (0-30 points)
    const leadTimeDays = supplier.leadTimeDays || 30;
    if (leadTimeDays <= 1) {
      operationalScore += 30; // Same day delivery
    } else if (leadTimeDays <= 3) {
      operationalScore += 28; // Very fast delivery
    } else if (leadTimeDays <= 7) {
      operationalScore += 25; // Fast delivery
    } else if (leadTimeDays <= 14) {
      operationalScore += 20; // Standard delivery
    } else if (leadTimeDays <= 30) {
      operationalScore += 15; // Slow delivery
    } else {
      operationalScore += 10; // Very slow delivery
    }

    // Operational stability (0-20 points)
    const totalOrders = supplier.totalOrders || 0;
    if (totalOrders > 100) {
      operationalScore += 20; // High operational experience
    } else if (totalOrders > 50) {
      operationalScore += 15; // Good operational experience
    } else if (totalOrders > 20) {
      operationalScore += 12; // Moderate operational experience
    } else if (totalOrders > 5) {
      operationalScore += 8; // Limited operational experience
    } else {
      operationalScore += 4; // Minimal operational experience
    }

    // Contract stability (0-10 points)
    const contractStatus = this.getContractStatus(supplier);
    if (contractStatus === 'Active Contract') {
      operationalScore += 10; // Stable contract
    } else if (contractStatus === 'Contract Expiring Soon') {
      operationalScore += 6; // Some uncertainty
    } else if (contractStatus === 'No Contract') {
      operationalScore += 8; // Flexible but no guarantees
    } else {
      operationalScore += 2; // Unstable contract situation
    }

    return Math.min(100, operationalScore);
  }

  /**
   * Calculate quality capacity based on quality ratings and performance
   */
  private calculateQualityCapacity(supplier: Supplier): number {
    let qualityScore = 0;

    // Quality rating capacity (0-50 points)
    const rating = supplier.rating || 0;
    if (rating >= 4.5) {
      qualityScore += 50; // Excellent quality
    } else if (rating >= 4.0) {
      qualityScore += 45; // Very good quality
    } else if (rating >= 3.5) {
      qualityScore += 40; // Good quality
    } else if (rating >= 3.0) {
      qualityScore += 30; // Acceptable quality
    } else if (rating >= 2.5) {
      qualityScore += 20; // Below average quality
    } else if (rating >= 2.0) {
      qualityScore += 10; // Poor quality
    } else {
      qualityScore += 5; // Very poor quality
    }

    // Quality consistency (0-30 points)
    const qualityScoreValue = supplier.qualityScore || 0;
    if (qualityScoreValue >= 90) {
      qualityScore += 30; // Very consistent quality
    } else if (qualityScoreValue >= 80) {
      qualityScore += 25; // Good consistency
    } else if (qualityScoreValue >= 70) {
      qualityScore += 20; // Acceptable consistency
    } else if (qualityScoreValue >= 60) {
      qualityScore += 15; // Below average consistency
    } else if (qualityScoreValue >= 50) {
      qualityScore += 10; // Poor consistency
    } else {
      qualityScore += 5; // Very poor consistency
    }

    // Quality scalability (0-20 points)
    const totalOrders = supplier.totalOrders || 0;
    if (totalOrders > 100 && rating >= 4.0) {
      qualityScore += 20; // Proven ability to maintain quality at scale
    } else if (totalOrders > 50 && rating >= 3.5) {
      qualityScore += 15; // Good quality at moderate scale
    } else if (totalOrders > 20 && rating >= 3.0) {
      qualityScore += 12; // Acceptable quality at small scale
    } else if (totalOrders > 5) {
      qualityScore += 8; // Limited quality history
    } else {
      qualityScore += 4; // Minimal quality data
    }

    return Math.min(100, qualityScore);
  }

  /**
   * Calculate temporal capacity based on time-related performance
   */
  private calculateTemporalCapacity(supplier: Supplier): number {
    let temporalScore = 0;

    // Response time capacity (0-40 points)
    const leadTimeDays = supplier.leadTimeDays || 30;
    const responseTimeScore = Math.max(0, 40 - leadTimeDays * 2);
    temporalScore += Math.min(40, responseTimeScore);

    // Delivery predictability (0-30 points)
    const onTimeRate = supplier.onTimeDeliveryRate || 0;
    const predictabilityScore = (onTimeRate / 100) * 30;
    temporalScore += predictabilityScore;

    // Seasonal reliability (0-20 points)
    const totalOrders = supplier.totalOrders || 0;
    if (totalOrders > 50) {
      temporalScore += 20; // Likely has seasonal experience
    } else if (totalOrders > 20) {
      temporalScore += 15; // Some seasonal experience
    } else if (totalOrders > 5) {
      temporalScore += 10; // Limited seasonal experience
    } else {
      temporalScore += 5; // Minimal seasonal data
    }

    // Relationship longevity (0-10 points)
    const monthsSinceLastOrder = supplier.lastOrderDate
      ? moment().diff(moment(supplier.lastOrderDate), 'months')
      : 12;

    if (monthsSinceLastOrder <= 1) {
      temporalScore += 10; // Very recent relationship
    } else if (monthsSinceLastOrder <= 3) {
      temporalScore += 8; // Recent relationship
    } else if (monthsSinceLastOrder <= 6) {
      temporalScore += 6; // Moderate relationship
    } else if (monthsSinceLastOrder <= 12) {
      temporalScore += 4; // Older relationship
    } else {
      temporalScore += 2; // Very old relationship
    }

    return Math.min(100, temporalScore);
  }

  /**
   * Calculate capacity risk factor as a multiplier (0.5-1.0)
   */
  private calculateCapacityRiskFactor(supplier: Supplier): number {
    let riskFactor = 1.0;

    // Financial risk
    const creditLimit = supplier.creditLimit || 0;
    const totalPurchaseAmount = supplier.totalPurchaseAmount || 0;
    const creditUtilization = creditLimit > 0 ? totalPurchaseAmount / creditLimit : 0;

    if (creditUtilization > 0.9) {
      riskFactor *= 0.8; // High financial risk
    } else if (creditUtilization > 0.7) {
      riskFactor *= 0.9; // Moderate financial risk
    }

    // Performance risk
    const onTimeRate = supplier.onTimeDeliveryRate || 0;
    if (onTimeRate < 70) {
      riskFactor *= 0.75; // High performance risk
    } else if (onTimeRate < 85) {
      riskFactor *= 0.9; // Moderate performance risk
    }

    // Experience risk
    const totalOrders = supplier.totalOrders || 0;
    if (totalOrders < 5) {
      riskFactor *= 0.8; // High experience risk
    } else if (totalOrders < 20) {
      riskFactor *= 0.9; // Moderate experience risk
    }

    // Contract risk
    const contractStatus = this.getContractStatus(supplier);
    if (contractStatus.includes('Expired') || contractStatus.includes('Future')) {
      riskFactor *= 0.7; // High contract risk
    } else if (contractStatus.includes('Expiring')) {
      riskFactor *= 0.85; // Moderate contract risk
    }

    // Quality risk
    const rating = supplier.rating || 0;
    if (rating < 2.5) {
      riskFactor *= 0.7; // High quality risk
    } else if (rating < 3.5) {
      riskFactor *= 0.85; // Moderate quality risk
    }

    // Recency risk
    const monthsSinceLastOrder = supplier.lastOrderDate
      ? moment().diff(moment(supplier.lastOrderDate), 'months')
      : 12;

    if (monthsSinceLastOrder > 12) {
      riskFactor *= 0.8; // High recency risk
    } else if (monthsSinceLastOrder > 6) {
      riskFactor *= 0.9; // Moderate recency risk
    }

    return Math.max(0.5, riskFactor); // Minimum 50% capacity due to risk
  }

  /**
   * Check if current period is Ramadan season (affects Indonesian supplier capacity)
   */
  private isRamadanSeason(): boolean {
    const now = moment().tz('Asia/Jakarta');
    const currentMonth = now.month() + 1; // moment() months are 0-indexed
    
    // Ramadan typically falls in different months each year, but generally around March-May
    // This is a simplified check - in production, you'd want to use Islamic calendar calculations
    return currentMonth >= 3 && currentMonth <= 5;
  }

  /**
   * Calculate location/proximity score
   */
  private calculateLocationScore(
    supplier: Supplier,
    deliveryDeadline?: Date,
  ): number {
    // For Indonesian context, prioritize local suppliers
    const isLocal = supplier.country === 'Indonesia' || !supplier.country;
    let score = isLocal ? 80 : 40;

    // Time zone advantage for local suppliers
    if (isLocal) score += 20;

    return Math.min(100, score);
  }

  /**
   * Apply weighted scoring to calculate total score
   */
  private calculateWeightedScore(
    scores: {
      costScore: number;
      qualityScore: number;
      deliveryScore: number;
      reliabilityScore: number;
      capacityScore?: number;
      locationScore?: number;
    },
    criteria: SupplierEvaluationCriteria,
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    totalScore += scores.costScore * criteria.costWeight;
    totalScore += scores.qualityScore * criteria.qualityWeight;
    totalScore += scores.deliveryScore * criteria.deliveryWeight;
    totalScore += scores.reliabilityScore * criteria.reliabilityWeight;

    totalWeight =
      criteria.costWeight +
      criteria.qualityWeight +
      criteria.deliveryWeight +
      criteria.reliabilityWeight;

    if (scores.capacityScore && criteria.capacityWeight) {
      totalScore += scores.capacityScore * criteria.capacityWeight;
      totalWeight += criteria.capacityWeight;
    }

    if (scores.locationScore && criteria.locationWeight) {
      totalScore += scores.locationScore * criteria.locationWeight;
      totalWeight += criteria.locationWeight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Apply selection method to choose best supplier
   */
  private applySelectionMethod(
    supplierScores: SupplierScore[],
    request: SupplierSelectionRequest,
  ): SupplierScore | undefined {
    if (supplierScores.length === 0) return undefined;

    const method =
      request.selectionMethod || request.reorderRule.supplierSelectionMethod;

    switch (method) {
      case SupplierSelectionMethod.PRIMARY:
        return this.selectPrimarySupplier(supplierScores, request.reorderRule);

      case SupplierSelectionMethod.COST_OPTIMAL:
        return supplierScores.sort((a, b) => b.costScore - a.costScore)[0];

      case SupplierSelectionMethod.DELIVERY_OPTIMAL:
        return supplierScores.sort(
          (a, b) => b.deliveryScore - a.deliveryScore,
        )[0];

      case SupplierSelectionMethod.QUALITY_OPTIMAL:
        return supplierScores.sort(
          (a, b) => b.qualityScore - a.qualityScore,
        )[0];

      case SupplierSelectionMethod.BALANCED:
      default:
        return supplierScores.sort((a, b) => b.totalScore - a.totalScore)[0];
    }
  }

  /**
   * Select primary supplier if available and meets criteria
   */
  private selectPrimarySupplier(
    supplierScores: SupplierScore[],
    reorderRule: ReorderRule,
  ): SupplierScore | undefined {
    if (!reorderRule.primarySupplierId) {
      // No primary supplier set, fall back to balanced selection
      return supplierScores.sort((a, b) => b.totalScore - a.totalScore)[0];
    }

    const primarySupplier = supplierScores.find(
      score => score.supplierId === reorderRule.primarySupplierId,
    );

    if (primarySupplier && primarySupplier.totalScore >= 60) {
      // Primary supplier meets minimum threshold
      return primarySupplier;
    }

    // Primary supplier doesn't meet criteria, select best alternative
    return supplierScores.sort((a, b) => b.totalScore - a.totalScore)[0];
  }

  // Helper methods
  private async getSupplierPerformance(
    supplierId: string,
    tenantId: string,
  ): Promise<any> {
    // Get recent purchase order performance
    const recentOrders = await this.purchaseOrderRepository.find({
      where: {
        tenantId,
        supplierId,
        status: PurchaseOrderStatus.RECEIVED,
      },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      recentOrders: recentOrders.length,
      averageLeadTime: this.calculateAverageLeadTime(recentOrders),
      onTimeDeliveries: recentOrders.filter(order =>
        this.wasDeliveredOnTime(order),
      ).length,
    };
  }

  private async getAverageUnitCost(
    supplier: Supplier,
    product: Product,
  ): Promise<number> {
    // Calculate from recent purchase orders
    const cacheKey = `avg_cost_${supplier.id}_${product.id}`;
    const cached = await this.cacheManager.get<number>(cacheKey);

    if (cached) return cached;

    // Query recent orders for pricing data
    const recentOrders = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'item')
      .where('po.supplierId = :supplierId', { supplierId: supplier.id })
      .andWhere('item.productId = :productId', { productId: product.id })
      .andWhere('po.createdAt >= :since', {
        since: moment().subtract(6, 'months').toDate(),
      })
      .take(10)
      .getMany();

    if (recentOrders.length === 0) {
      return product.costPrice || 0;
    }

    // Calculate weighted average
    let totalCost = 0;
    let totalQuantity = 0;

    recentOrders.forEach(order => {
      order.items?.forEach(item => {
        if (item.productId === product.id) {
          totalCost += item.totalPrice;
          totalQuantity += item.orderedQuantity;
        }
      });
    });

    const avgCost =
      totalQuantity > 0 ? totalCost / totalQuantity : product.costPrice || 0;

    // Cache for 1 hour
    await this.cacheManager.set(cacheKey, avgCost, 3600);

    return avgCost;
  }

  private getEvaluationCriteria(
    reorderRule: ReorderRule,
    override?: SupplierEvaluationCriteria,
  ): SupplierEvaluationCriteria {
    if (override) return override;

    if (reorderRule.supplierWeights) {
      return {
        costWeight: reorderRule.supplierWeights.cost || 0.3,
        qualityWeight: reorderRule.supplierWeights.quality || 0.25,
        deliveryWeight: reorderRule.supplierWeights.delivery || 0.25,
        reliabilityWeight: reorderRule.supplierWeights.reliability || 0.2,
      };
    }

    // Default weights based on selection method
    switch (reorderRule.supplierSelectionMethod) {
      case SupplierSelectionMethod.COST_OPTIMAL:
        return {
          costWeight: 0.6,
          qualityWeight: 0.15,
          deliveryWeight: 0.15,
          reliabilityWeight: 0.1,
        };
      case SupplierSelectionMethod.QUALITY_OPTIMAL:
        return {
          costWeight: 0.1,
          qualityWeight: 0.6,
          deliveryWeight: 0.15,
          reliabilityWeight: 0.15,
        };
      case SupplierSelectionMethod.DELIVERY_OPTIMAL:
        return {
          costWeight: 0.15,
          qualityWeight: 0.15,
          deliveryWeight: 0.6,
          reliabilityWeight: 0.1,
        };
      default:
        return {
          costWeight: 0.3,
          qualityWeight: 0.25,
          deliveryWeight: 0.25,
          reliabilityWeight: 0.2,
        };
    }
  }

  private calculateReliabilityIndex(
    supplier: Supplier,
    performanceData: any,
  ): number {
    // Composite reliability index
    const orderReliability =
      supplier.totalOrders > 0 ? supplier.onTimeDeliveryRate : 50;
    const ratingReliability = (supplier.rating / 5) * 100;
    const experienceReliability = Math.min(100, supplier.totalOrders * 5);

    return (
      orderReliability * 0.5 +
      ratingReliability * 0.3 +
      experienceReliability * 0.2
    );
  }

  private getContractStatus(supplier: Supplier): string {
    const now = new Date();

    if (!supplier.contractStartDate || !supplier.contractEndDate) {
      return 'No Contract';
    }

    if (supplier.contractStartDate > now) {
      return 'Future Contract';
    }

    if (supplier.contractEndDate < now) {
      return 'Expired Contract';
    }

    const daysUntilExpiry = moment(supplier.contractEndDate).diff(
      moment(now),
      'days',
    );

    if (daysUntilExpiry <= 30) {
      return 'Contract Expiring Soon';
    }

    return 'Active Contract';
  }

  private analyzeSupplierRisks(
    supplier: Supplier,
    performanceData: any,
    request: SupplierSelectionRequest,
  ): { riskFactors: string[]; advantages: string[] } {
    const riskFactors: string[] = [];
    const advantages: string[] = [];

    // Risk analysis
    if (supplier.onTimeDeliveryRate < 80) {
      riskFactors.push('Below average on-time delivery performance');
    }

    if (supplier.rating < 3) {
      riskFactors.push('Low quality rating');
    }

    if (supplier.totalOrders < 5) {
      riskFactors.push('Limited order history with this supplier');
    }

    if (
      supplier.creditLimit <
      request.orderQuantity * (request.product.costPrice || 0)
    ) {
      riskFactors.push('Order may exceed credit limit');
    }

    const contractStatus = this.getContractStatus(supplier);
    if (
      contractStatus.includes('Expired') ||
      contractStatus.includes('Expiring')
    ) {
      riskFactors.push('Contract issues may affect order processing');
    }

    // Advantage analysis
    if (supplier.onTimeDeliveryRate > 95) {
      advantages.push('Excellent delivery performance');
    }

    if (supplier.rating >= 4.5) {
      advantages.push('High quality rating');
    }

    if (supplier.discount > 5) {
      advantages.push(`${supplier.discount}% supplier discount available`);
    }

    if (supplier.leadTimeDays <= 3) {
      advantages.push('Fast delivery times');
    }

    if (supplier.totalOrders > 50) {
      advantages.push('Established relationship with extensive order history');
    }

    return { riskFactors, advantages };
  }

  private calculateConfidenceLevel(
    supplier: Supplier,
    performanceData: any,
  ): number {
    let confidence = 1.0;

    // Reduce confidence for limited data
    if (supplier.totalOrders < 10) {
      confidence *= 0.7;
    }

    // Reduce confidence for inconsistent performance
    if (supplier.onTimeDeliveryRate < 90 && supplier.onTimeDeliveryRate > 0) {
      confidence *= 0.8;
    }

    // Reduce confidence for old data
    if (
      supplier.lastOrderDate &&
      moment().diff(moment(supplier.lastOrderDate), 'months') > 6
    ) {
      confidence *= 0.9;
    }

    return Math.max(0.3, confidence);
  }

  private calculateEstimatedCost(
    supplier: Supplier,
    product: Product,
    orderQuantity: number,
  ): number {
    const unitCost = product.costPrice || 0;
    const discount = supplier.discount / 100;
    const effectiveUnitCost = unitCost * (1 - discount);
    const shippingCost = this.estimateShippingCost(supplier, orderQuantity, product);

    return effectiveUnitCost * orderQuantity + shippingCost;
  }

  private estimateShippingCost(
    supplier: Supplier,
    orderQuantity: number,
    product?: Product,
  ): number {
    // Enhanced Indonesian shipping cost calculation
    const isLocal = supplier.country === 'Indonesia' || !supplier.country;
    
    if (!isLocal) {
      // International shipping - basic estimation
      return this.calculateInternationalShipping(orderQuantity, product);
    }

    // Domestic Indonesian shipping calculation
    const shippingComponents = {
      baseRate: 0,
      weightCost: 0,
      volumeAdjustment: 0,
      distanceMultiplier: 1,
      zoneSurcharge: 0,
      serviceFee: 0,
      insuranceCost: 0,
      fuelSurcharge: 0,
      codFee: 0,
      seasonalAdjustment: 1,
    };

    // 1. Calculate base shipping rate by zone
    const supplierZone = this.getIndonesianShippingZone(supplier);
    const destinationZone = this.getDestinationZone(); // Assume Jakarta as default
    
    shippingComponents.baseRate = this.getBaseShippingRate(supplierZone, destinationZone);
    shippingComponents.zoneSurcharge = this.getZoneSurcharge(supplierZone, destinationZone);

    // 2. Calculate weight-based costs
    const estimatedWeight = this.estimateShipmentWeight(orderQuantity, product);
    shippingComponents.weightCost = this.calculateWeightBasedCost(estimatedWeight);

    // 3. Calculate volume adjustments
    const estimatedVolume = this.estimateShipmentVolume(orderQuantity, product);
    shippingComponents.volumeAdjustment = this.calculateVolumeAdjustment(estimatedVolume, estimatedWeight);

    // 4. Distance multiplier
    shippingComponents.distanceMultiplier = this.calculateDistanceMultiplier(supplierZone, destinationZone);

    // 5. Service fees (handling, packaging, etc.)
    shippingComponents.serviceFee = this.calculateServiceFees(orderQuantity, product);

    // 6. Insurance cost (for high-value shipments)
    const orderValue = orderQuantity * (product?.costPrice || 100000);
    shippingComponents.insuranceCost = this.calculateInsuranceCost(orderValue);

    // 7. Fuel surcharge (current Indonesian fuel price adjustment)
    shippingComponents.fuelSurcharge = this.calculateFuelSurcharge(shippingComponents.baseRate);

    // 8. COD (Cash on Delivery) fee if applicable
    if (this.isCODShipment(supplier)) {
      shippingComponents.codFee = this.calculateCODFee(orderValue);
    }

    // 9. Seasonal adjustments
    shippingComponents.seasonalAdjustment = this.getSeasonalShippingAdjustment();

    // Calculate total shipping cost
    const baseCost = (
      shippingComponents.baseRate +
      shippingComponents.weightCost +
      shippingComponents.volumeAdjustment +
      shippingComponents.zoneSurcharge +
      shippingComponents.serviceFee +
      shippingComponents.insuranceCost +
      shippingComponents.fuelSurcharge +
      shippingComponents.codFee
    ) * shippingComponents.distanceMultiplier;

    const finalCost = baseCost * shippingComponents.seasonalAdjustment;

    // Apply Indonesian market context adjustments
    return this.applyIndonesianShippingContextAdjustments(finalCost, supplier, orderQuantity);
  }

  /**
   * Calculate international shipping costs
   */
  private calculateInternationalShipping(orderQuantity: number, product?: Product): number {
    const baseInternationalRate = 500000; // IDR 500,000 base for international
    const weightMultiplier = Math.ceil(orderQuantity / 50) * 0.2;
    const customsClearance = 150000; // IDR 150,000 for customs
    const insuranceRate = 0.02; // 2% of order value
    
    const orderValue = orderQuantity * (product?.costPrice || 100000);
    const insurance = orderValue * insuranceRate;
    
    return baseInternationalRate * (1 + weightMultiplier) + customsClearance + insurance;
  }

  /**
   * Determine Indonesian shipping zone based on supplier location
   */
  private getIndonesianShippingZone(supplier: Supplier): string {
    const province = supplier.province?.toLowerCase() || '';
    const city = supplier.city?.toLowerCase() || '';

    // Jakarta & Surrounding (Zone 1 - Metropolitan)
    if (city.includes('jakarta') || city.includes('tangerang') || 
        city.includes('bekasi') || city.includes('depok') || 
        city.includes('bogor')) {
      return 'jakarta_metro';
    }

    // Java Island (Zone 2 - Main Island)
    if (province.includes('jawa') || province.includes('jakarta') || 
        province.includes('banten') || province.includes('yogyakarta')) {
      return 'java_island';
    }

    // Sumatra (Zone 3 - Major Island)
    if (province.includes('sumatra') || province.includes('sumatera') ||
        province.includes('aceh') || province.includes('riau') ||
        province.includes('lampung') || province.includes('bengkulu') ||
        province.includes('jambi') || province.includes('palembang')) {
      return 'sumatra_island';
    }

    // Kalimantan (Zone 4 - Major Island)
    if (province.includes('kalimantan') || province.includes('borneo')) {
      return 'kalimantan_island';
    }

    // Sulawesi (Zone 5 - Major Island)
    if (province.includes('sulawesi') || province.includes('celebes')) {
      return 'sulawesi_island';
    }

    // Eastern Indonesia (Zone 6 - Remote Islands)
    if (province.includes('papua') || province.includes('maluku') ||
        province.includes('nusa tenggara') || province.includes('timor')) {
      return 'eastern_islands';
    }

    // Bali & Lombok (Zone 7 - Tourist Islands)
    if (province.includes('bali') || province.includes('lombok')) {
      return 'bali_lombok';
    }

    // Default to Java if unknown
    return 'java_island';
  }

  /**
   * Get destination zone (default to Jakarta for calculation)
   */
  private getDestinationZone(): string {
    // In production, this would be determined by the buyer's location
    // For now, assume Jakarta as the main distribution center
    return 'jakarta_metro';
  }

  /**
   * Get base shipping rate between zones
   */
  private getBaseShippingRate(supplierZone: string, destinationZone: string): number {
    // Shipping rate matrix for Indonesian zones (IDR)
    const shippingMatrix: { [key: string]: { [key: string]: number } } = {
      'jakarta_metro': {
        'jakarta_metro': 25000,
        'java_island': 35000,
        'sumatra_island': 45000,
        'kalimantan_island': 55000,
        'sulawesi_island': 65000,
        'eastern_islands': 85000,
        'bali_lombok': 50000,
      },
      'java_island': {
        'jakarta_metro': 35000,
        'java_island': 30000,
        'sumatra_island': 50000,
        'kalimantan_island': 60000,
        'sulawesi_island': 70000,
        'eastern_islands': 90000,
        'bali_lombok': 40000,
      },
      'sumatra_island': {
        'jakarta_metro': 45000,
        'java_island': 50000,
        'sumatra_island': 35000,
        'kalimantan_island': 65000,
        'sulawesi_island': 75000,
        'eastern_islands': 95000,
        'bali_lombok': 60000,
      },
      'kalimantan_island': {
        'jakarta_metro': 55000,
        'java_island': 60000,
        'sumatra_island': 65000,
        'kalimantan_island': 40000,
        'sulawesi_island': 70000,
        'eastern_islands': 80000,
        'bali_lombok': 65000,
      },
      'sulawesi_island': {
        'jakarta_metro': 65000,
        'java_island': 70000,
        'sumatra_island': 75000,
        'kalimantan_island': 70000,
        'sulawesi_island': 45000,
        'eastern_islands': 70000,
        'bali_lombok': 70000,
      },
      'eastern_islands': {
        'jakarta_metro': 85000,
        'java_island': 90000,
        'sumatra_island': 95000,
        'kalimantan_island': 80000,
        'sulawesi_island': 70000,
        'eastern_islands': 60000,
        'bali_lombok': 80000,
      },
      'bali_lombok': {
        'jakarta_metro': 50000,
        'java_island': 40000,
        'sumatra_island': 60000,
        'kalimantan_island': 65000,
        'sulawesi_island': 70000,
        'eastern_islands': 80000,
        'bali_lombok': 30000,
      },
    };

    return shippingMatrix[supplierZone]?.[destinationZone] || 60000; // Default rate
  }

  /**
   * Calculate zone surcharge for difficult-to-reach areas
   */
  private getZoneSurcharge(supplierZone: string, destinationZone: string): number {
    // Additional surcharge for remote areas
    const remoteSurcharge: { [key: string]: number } = {
      'eastern_islands': 25000,
      'kalimantan_island': 15000,
      'sulawesi_island': 10000,
      'sumatra_island': 8000,
      'bali_lombok': 5000,
      'java_island': 0,
      'jakarta_metro': 0,
    };

    return (remoteSurcharge[supplierZone] || 0) + (remoteSurcharge[destinationZone] || 0);
  }

  /**
   * Estimate shipment weight based on order quantity and product
   */
  private estimateShipmentWeight(orderQuantity: number, product?: Product): number {
    // Default weight per item in kg
    const defaultWeightPerItem = 1.0; // 1 kg
    const productWeight = product?.weight || defaultWeightPerItem;
    const totalWeight = orderQuantity * productWeight;
    
    // Add packaging weight (10% of product weight)
    const packagingWeight = totalWeight * 0.1;
    
    return totalWeight + packagingWeight;
  }

  /**
   * Calculate weight-based shipping cost
   */
  private calculateWeightBasedCost(weight: number): number {
    // Weight-based pricing tiers (per kg)
    if (weight <= 1) return 0; // First kg included in base rate
    if (weight <= 5) return (weight - 1) * 3000; // IDR 3,000 per kg
    if (weight <= 20) return 12000 + (weight - 5) * 2500; // IDR 2,500 per kg
    if (weight <= 50) return 49500 + (weight - 20) * 2000; // IDR 2,000 per kg
    
    return 109500 + (weight - 50) * 1500; // IDR 1,500 per kg for bulk
  }

  /**
   * Estimate shipment volume
   */
  private estimateShipmentVolume(orderQuantity: number, product?: Product): number {
    // Default volume per item in cubic meters
    const defaultVolumePerItem = 0.001; // 1 liter
    const productVolume = product?.attributes?.volume || defaultVolumePerItem;
    const totalVolume = orderQuantity * productVolume;
    
    // Add packaging volume (15% of product volume)
    const packagingVolume = totalVolume * 0.15;
    
    return totalVolume + packagingVolume;
  }

  /**
   * Calculate volume-based adjustment (for light but bulky items)
   */
  private calculateVolumeAdjustment(volume: number, weight: number): number {
    // Volumetric weight calculation (standard: 1 cubic meter = 167 kg)
    const volumetricWeight = volume * 167;
    
    // If volumetric weight exceeds actual weight, charge additional
    if (volumetricWeight > weight) {
      const additionalWeight = volumetricWeight - weight;
      return additionalWeight * 2000; // IDR 2,000 per kg volumetric surcharge
    }
    
    return 0;
  }

  /**
   * Calculate distance multiplier based on zones
   */
  private calculateDistanceMultiplier(supplierZone: string, destinationZone: string): number {
    // Distance-based multipliers
    const distanceMultipliers: { [key: string]: { [key: string]: number } } = {
      'jakarta_metro': {
        'jakarta_metro': 1.0,
        'java_island': 1.1,
        'sumatra_island': 1.2,
        'kalimantan_island': 1.3,
        'sulawesi_island': 1.4,
        'eastern_islands': 1.6,
        'bali_lombok': 1.2,
      },
      'eastern_islands': {
        'jakarta_metro': 1.6,
        'java_island': 1.5,
        'sumatra_island': 1.4,
        'kalimantan_island': 1.3,
        'sulawesi_island': 1.2,
        'eastern_islands': 1.0,
        'bali_lombok': 1.3,
      },
    };

    return distanceMultipliers[supplierZone]?.[destinationZone] || 1.2;
  }

  /**
   * Calculate service fees (handling, packaging, etc.)
   */
  private calculateServiceFees(orderQuantity: number, product?: Product): number {
    // Base handling fee
    let serviceFee = 15000; // IDR 15,000 base handling
    
    // Packaging fee based on quantity
    if (orderQuantity > 100) {
      serviceFee += 25000; // Additional packaging for large orders
    } else if (orderQuantity > 50) {
      serviceFee += 15000;
    } else if (orderQuantity > 20) {
      serviceFee += 10000;
    }
    
    // Special handling for fragile items
    if (product?.attributes?.fragile) {
      serviceFee += 20000; // IDR 20,000 for fragile handling
    }
    
    return serviceFee;
  }

  /**
   * Calculate insurance cost for high-value shipments
   */
  private calculateInsuranceCost(orderValue: number): number {
    // Insurance rate: 0.1% of order value, minimum IDR 5,000
    const insuranceRate = 0.001;
    const calculatedInsurance = orderValue * insuranceRate;
    
    return Math.max(5000, calculatedInsurance);
  }

  /**
   * Calculate fuel surcharge based on current fuel prices
   */
  private calculateFuelSurcharge(baseRate: number): number {
    // Current fuel surcharge rate (typically 5-10% of base rate)
    const fuelSurchargeRate = 0.08; // 8% surcharge
    
    return baseRate * fuelSurchargeRate;
  }

  /**
   * Check if shipment requires COD (Cash on Delivery)
   */
  private isCODShipment(supplier: Supplier): boolean {
    // COD is common for Indonesian B2B transactions
    return supplier.paymentTerms === 'cod' || 
           supplier.notes?.some(note => note.note.toLowerCase().includes('cod')) === true;
  }

  /**
   * Calculate COD fee
   */
  private calculateCODFee(orderValue: number): number {
    // COD fee is typically 1-2% of order value
    const codFeeRate = 0.015; // 1.5%
    const minCODFee = 10000; // IDR 10,000 minimum
    
    return Math.max(minCODFee, orderValue * codFeeRate);
  }

  /**
   * Get seasonal shipping adjustment
   */
  private getSeasonalShippingAdjustment(): number {
    const now = moment().tz('Asia/Jakarta');
    const currentMonth = now.month() + 1;
    
    // Ramadan season (slower delivery, higher costs)
    if (currentMonth >= 3 && currentMonth <= 5) {
      return 1.15; // 15% increase during Ramadan
    }
    
    // Christmas/New Year season
    if (currentMonth === 12 || currentMonth === 1) {
      return 1.20; // 20% increase during holiday season
    }
    
    // Chinese New Year (affects supply chains)
    if (currentMonth === 1 || currentMonth === 2) {
      return 1.10; // 10% increase during Chinese New Year
    }
    
    // Regular season
    return 1.0;
  }

  /**
   * Apply Indonesian market context adjustments
   */
  private applyIndonesianShippingContextAdjustments(
    baseCost: number,
    supplier: Supplier,
    orderQuantity: number,
  ): number {
    let adjustedCost = baseCost;
    
    // Traffic congestion adjustment for Jakarta suppliers
    if (supplier.city?.toLowerCase().includes('jakarta')) {
      adjustedCost *= 1.05; // 5% increase for Jakarta traffic
    }
    
    // Island geography adjustment
    const supplierZone = this.getIndonesianShippingZone(supplier);
    if (supplierZone === 'eastern_islands') {
      adjustedCost *= 1.25; // 25% increase for eastern islands
    }
    
    // Bulk order discount
    if (orderQuantity > 1000) {
      adjustedCost *= 0.90; // 10% discount for very large orders
    } else if (orderQuantity > 500) {
      adjustedCost *= 0.95; // 5% discount for large orders
    }
    
    // Supplier relationship discount
    if (supplier.totalOrders > 100) {
      adjustedCost *= 0.95; // 5% discount for established suppliers
    }
    
    // Minimum shipping cost
    const minimumShipping = 20000; // IDR 20,000 minimum
    
    return Math.max(minimumShipping, Math.round(adjustedCost));
  }

  private calculatePotentialSavings(
    estimatedCost: number,
    request: SupplierSelectionRequest,
  ): number {
    // Compare with budget or expected cost
    const baseline =
      request.budgetConstraint ||
      request.orderQuantity * (request.product.costPrice || 0);

    return Math.max(0, baseline - estimatedCost);
  }

  /**
   * Perform comprehensive supply chain risk assessment
   */
  private async performSupplyChainRiskAssessment(
    selectedSupplier: SupplierScore | undefined,
    alternatives: SupplierScore[],
    request: SupplierSelectionRequest,
  ): Promise<SupplyChainRiskAssessment> {
    const assessmentLevel = request.riskAssessmentLevel || 'basic';
    const now = new Date();

    try {
      // Identify risk factors
      const riskFactors = await this.identifyRiskFactors(
        selectedSupplier,
        alternatives,
        request,
        assessmentLevel,
      );

      // Calculate disruption probability
      const disruptionProbability = this.calculateDisruptionProbability(riskFactors);

      // Assess potential impact
      const potentialImpact = this.assessDisruptionImpact(
        selectedSupplier,
        riskFactors,
        request,
      );

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore(
        riskFactors,
        disruptionProbability,
        potentialImpact,
      );

      // Determine risk level
      const overallRiskLevel = this.determineRiskLevel(overallRiskScore);

      // Generate mitigation strategies
      const mitigationStrategies = this.generateMitigationStrategies(
        riskFactors,
        assessmentLevel,
      );

      // Create contingency plans
      const contingencyPlans = this.createContingencyPlans(
        riskFactors,
        alternatives,
        assessmentLevel,
      );

      // Analyze risk trends
      const riskTrends = await this.analyzeRiskTrends(
        selectedSupplier,
        riskFactors,
        assessmentLevel,
      );

      return {
        overallRiskLevel,
        overallRiskScore,
        riskFactors,
        disruptionProbability,
        potentialImpact,
        mitigationStrategies,
        contingencyPlans,
        riskTrends,
        lastAssessmentDate: now,
        nextReviewDate: moment(now).add(1, 'month').toDate(),
        assessmentLevel,
      };
    } catch (error) {
      this.logger.error(
        `Error in supply chain risk assessment: ${error.message}`,
        error.stack,
      );
      
      // Return basic risk assessment on error
      return this.createBasicRiskAssessment();
    }
  }

  /**
   * Identify risk factors for supplier and supply chain
   */
  private async identifyRiskFactors(
    selectedSupplier: SupplierScore | undefined,
    alternatives: SupplierScore[],
    request: SupplierSelectionRequest,
    assessmentLevel: string,
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    if (!selectedSupplier) {
      return riskFactors;
    }

    const supplier = selectedSupplier.supplier;
    const supplierZone = this.getIndonesianShippingZone(supplier);

    // 1. Geographic and Natural Disaster Risks
    riskFactors.push(...this.assessGeographicRisks(supplier, supplierZone));

    // 2. Supplier Dependency Risks
    riskFactors.push(...this.assessSupplierDependencyRisks(selectedSupplier, alternatives));

    // 3. Financial and Economic Risks
    riskFactors.push(...this.assessFinancialRisks(supplier));

    // 4. Operational and Infrastructure Risks
    riskFactors.push(...this.assessOperationalRisks(supplier, supplierZone));

    // 5. Seasonal and Cultural Risks
    riskFactors.push(...this.assessSeasonalRisks(supplier, supplierZone));

    // 6. Quality and Compliance Risks
    riskFactors.push(...this.assessQualityRisks(supplier));

    // 7. Transportation and Logistics Risks
    riskFactors.push(...this.assessLogisticsRisks(supplier, supplierZone));

    // Advanced risk factors for comprehensive and enterprise levels
    if (assessmentLevel === 'comprehensive' || assessmentLevel === 'enterprise') {
      riskFactors.push(...this.assessAdvancedRisks(supplier, supplierZone));
    }

    return riskFactors.filter(rf => rf.riskScore > 0.1); // Filter out negligible risks
  }

  /**
   * Assess geographic and natural disaster risks
   */
  private assessGeographicRisks(supplier: Supplier, supplierZone: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Natural disaster risks based on Indonesian geography
    const naturalDisasterRisks = this.getIndonesianNaturalDisasterRisks(supplierZone);
    
    naturalDisasterRisks.forEach(risk => {
      risks.push({
        type: RiskFactorType.NATURAL_DISASTER,
        category: RiskCategory.OPERATIONAL,
        description: risk.description,
        probability: risk.probability,
        impact: risk.impact,
        riskScore: risk.probability * risk.impact,
        severity: this.calculateSeverity(risk.probability * risk.impact),
        isActive: true,
        detectedAt: new Date(),
        estimatedDuration: risk.duration,
        geographicScope: risk.scope,
        sources: ['Indonesian Meteorology Agency', 'Disaster Management Agency'],
        confidence: 0.8,
      });
    });

    // Geographic concentration risk
    if (supplierZone === 'eastern_islands') {
      risks.push({
        type: RiskFactorType.GEOGRAPHIC_CONCENTRATION,
        category: RiskCategory.STRATEGIC,
        description: 'Supplier located in remote Eastern Indonesia with limited alternative access',
        probability: 0.3,
        impact: 8,
        riskScore: 2.4,
        severity: 'medium',
        isActive: true,
        detectedAt: new Date(),
        estimatedDuration: 365, // Year-round concern
        geographicScope: 'regional',
        sources: ['Geographic Analysis'],
        confidence: 0.9,
      });
    }

    return risks;
  }

  /**
   * Get Indonesian natural disaster risk profiles by zone
   */
  private getIndonesianNaturalDisasterRisks(zone: string): any[] {
    const riskProfiles: { [key: string]: any[] } = {
      'jakarta_metro': [
        {
          description: 'Flooding during rainy season (Dec-Feb)',
          probability: 0.6,
          impact: 6,
          duration: 7,
          scope: 'local',
        },
        {
          description: 'Earthquake risk (on active fault lines)',
          probability: 0.2,
          impact: 9,
          duration: 30,
          scope: 'regional',
        },
      ],
      'java_island': [
        {
          description: 'Volcanic activity affecting transportation',
          probability: 0.3,
          impact: 7,
          duration: 14,
          scope: 'regional',
        },
        {
          description: 'Monsoon flooding',
          probability: 0.4,
          impact: 5,
          duration: 5,
          scope: 'local',
        },
      ],
      'sumatra_island': [
        {
          description: 'Tsunami risk (west coast)',
          probability: 0.1,
          impact: 10,
          duration: 60,
          scope: 'regional',
        },
        {
          description: 'Forest fires and haze',
          probability: 0.5,
          impact: 6,
          duration: 30,
          scope: 'regional',
        },
      ],
      'kalimantan_island': [
        {
          description: 'Peat fires and smoke haze',
          probability: 0.7,
          impact: 7,
          duration: 45,
          scope: 'regional',
        },
        {
          description: 'Flooding from deforestation',
          probability: 0.4,
          impact: 5,
          duration: 10,
          scope: 'local',
        },
      ],
      'sulawesi_island': [
        {
          description: 'Earthquake and tsunami risk',
          probability: 0.3,
          impact: 9,
          duration: 45,
          scope: 'regional',
        },
        {
          description: 'Typhoon and cyclone activity',
          probability: 0.2,
          impact: 7,
          duration: 7,
          scope: 'regional',
        },
      ],
      'eastern_islands': [
        {
          description: 'Extreme weather and isolation',
          probability: 0.4,
          impact: 8,
          duration: 21,
          scope: 'regional',
        },
        {
          description: 'Volcanic activity',
          probability: 0.3,
          impact: 8,
          duration: 30,
          scope: 'local',
        },
      ],
      'bali_lombok': [
        {
          description: 'Volcanic activity (Mt. Agung, Mt. Rinjani)',
          probability: 0.4,
          impact: 7,
          duration: 14,
          scope: 'local',
        },
        {
          description: 'Earthquake activity',
          probability: 0.3,
          impact: 8,
          duration: 30,
          scope: 'regional',
        },
      ],
    };

    return riskProfiles[zone] || [];
  }

  /**
   * Assess supplier dependency risks
   */
  private assessSupplierDependencyRisks(
    selectedSupplier: SupplierScore,
    alternatives: SupplierScore[],
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Single supplier dependency
    if (alternatives.length < 2) {
      risks.push({
        type: RiskFactorType.SUPPLIER_DEPENDENCY,
        category: RiskCategory.STRATEGIC,
        description: 'Limited alternative suppliers available',
        probability: 0.8,
        impact: 8,
        riskScore: 6.4,
        severity: 'high',
        isActive: true,
        detectedAt: new Date(),
        geographicScope: 'local',
        sources: ['Supplier Analysis'],
        confidence: 0.9,
      });
    }

    // Financial dependency risk
    const supplier = selectedSupplier.supplier;
    const creditUtilization = supplier.creditLimit > 0 
      ? supplier.totalPurchaseAmount / supplier.creditLimit 
      : 0;

    if (creditUtilization > 0.8) {
      risks.push({
        type: RiskFactorType.FINANCIAL_DISTRESS,
        category: RiskCategory.FINANCIAL,
        description: 'High credit utilization may indicate financial stress',
        probability: 0.4,
        impact: 7,
        riskScore: 2.8,
        severity: 'medium',
        isActive: true,
        detectedAt: new Date(),
        geographicScope: 'local',
        sources: ['Financial Analysis'],
        confidence: 0.7,
      });
    }

    return risks;
  }

  /**
   * Assess financial and economic risks
   */
  private assessFinancialRisks(supplier: Supplier): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Currency fluctuation risk (IDR volatility)
    risks.push({
      type: RiskFactorType.CURRENCY_FLUCTUATION,
      category: RiskCategory.FINANCIAL,
      description: 'Indonesian Rupiah exchange rate volatility',
      probability: 0.6,
      impact: 5,
      riskScore: 3.0,
      severity: 'medium',
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'national',
      sources: ['Bank Indonesia', 'Economic Indicators'],
      confidence: 0.8,
    });

    // Inflation risk
    risks.push({
      type: RiskFactorType.ECONOMIC_DISRUPTION,
      category: RiskCategory.FINANCIAL,
      description: 'Indonesian inflation affecting costs',
      probability: 0.5,
      impact: 4,
      riskScore: 2.0,
      severity: 'low',
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'national',
      sources: ['Indonesian Central Bank', 'Economic Data'],
      confidence: 0.7,
    });

    return risks;
  }

  /**
   * Assess operational and infrastructure risks
   */
  private assessOperationalRisks(supplier: Supplier, supplierZone: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Infrastructure reliability
    const infrastructureRisk = this.getInfrastructureRisk(supplierZone);
    risks.push({
      type: RiskFactorType.INFRASTRUCTURE_FAILURE,
      category: RiskCategory.OPERATIONAL,
      description: `Infrastructure reliability concerns in ${supplierZone}`,
      probability: infrastructureRisk.probability,
      impact: infrastructureRisk.impact,
      riskScore: infrastructureRisk.probability * infrastructureRisk.impact,
      severity: this.calculateSeverity(infrastructureRisk.probability * infrastructureRisk.impact),
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'regional',
      sources: ['Infrastructure Analysis'],
      confidence: 0.7,
    });

    // Labor disruption risk
    if (supplier.totalOrders > 50) {
      risks.push({
        type: RiskFactorType.LABOR_DISRUPTION,
        category: RiskCategory.OPERATIONAL,
        description: 'Potential labor disputes or strikes',
        probability: 0.2,
        impact: 6,
        riskScore: 1.2,
        severity: 'low',
        isActive: true,
        detectedAt: new Date(),
        geographicScope: 'local',
        sources: ['Labor Market Analysis'],
        confidence: 0.6,
      });
    }

    return risks;
  }

  /**
   * Get infrastructure risk by zone
   */
  private getInfrastructureRisk(zone: string): { probability: number; impact: number } {
    const infrastructureRisks: { [key: string]: { probability: number; impact: number } } = {
      'jakarta_metro': { probability: 0.3, impact: 4 },
      'java_island': { probability: 0.4, impact: 5 },
      'sumatra_island': { probability: 0.5, impact: 6 },
      'kalimantan_island': { probability: 0.6, impact: 7 },
      'sulawesi_island': { probability: 0.7, impact: 7 },
      'eastern_islands': { probability: 0.8, impact: 8 },
      'bali_lombok': { probability: 0.3, impact: 5 },
    };

    return infrastructureRisks[zone] || { probability: 0.5, impact: 6 };
  }

  /**
   * Assess seasonal and cultural risks
   */
  private assessSeasonalRisks(supplier: Supplier, supplierZone: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Ramadan impact
    risks.push({
      type: RiskFactorType.SEASONAL_DISRUPTION,
      category: RiskCategory.OPERATIONAL,
      description: 'Ramadan season productivity and delivery impact',
      probability: 1.0, // Annual certainty
      impact: 4,
      riskScore: 4.0,
      severity: 'medium',
      isActive: this.isRamadanSeason(),
      detectedAt: new Date(),
      estimatedDuration: 30,
      geographicScope: 'national',
      sources: ['Indonesian Business Calendar'],
      confidence: 0.9,
    });

    // Chinese New Year impact
    risks.push({
      type: RiskFactorType.SEASONAL_DISRUPTION,
      category: RiskCategory.OPERATIONAL,
      description: 'Chinese New Year supply chain disruption',
      probability: 0.8,
      impact: 5,
      riskScore: 4.0,
      severity: 'medium',
      isActive: this.isChineseNewYearSeason(),
      detectedAt: new Date(),
      estimatedDuration: 14,
      geographicScope: 'global',
      sources: ['Supply Chain Analysis'],
      confidence: 0.8,
    });

    return risks;
  }

  /**
   * Check if it's Chinese New Year season
   */
  private isChineseNewYearSeason(): boolean {
    const now = moment().tz('Asia/Jakarta');
    const currentMonth = now.month() + 1;
    return currentMonth === 1 || currentMonth === 2;
  }

  /**
   * Assess quality and compliance risks
   */
  private assessQualityRisks(supplier: Supplier): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Quality consistency risk
    if (supplier.qualityScore < 80) {
      risks.push({
        type: RiskFactorType.QUALITY_ISSUES,
        category: RiskCategory.OPERATIONAL,
        description: 'Below-average quality score indicating potential issues',
        probability: 0.6,
        impact: 6,
        riskScore: 3.6,
        severity: 'medium',
        isActive: true,
        detectedAt: new Date(),
        geographicScope: 'local',
        sources: ['Quality Assessment'],
        confidence: 0.8,
      });
    }

    // Regulatory compliance risk
    risks.push({
      type: RiskFactorType.REGULATORY_CHANGE,
      category: RiskCategory.COMPLIANCE,
      description: 'Indonesian regulatory changes affecting supply chain',
      probability: 0.3,
      impact: 5,
      riskScore: 1.5,
      severity: 'low',
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'national',
      sources: ['Regulatory Monitoring'],
      confidence: 0.6,
    });

    return risks;
  }

  /**
   * Assess logistics and transportation risks
   */
  private assessLogisticsRisks(supplier: Supplier, supplierZone: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Transportation disruption risk
    const transportRisk = this.getTransportationRisk(supplierZone);
    risks.push({
      type: RiskFactorType.TRANSPORTATION_DISRUPTION,
      category: RiskCategory.OPERATIONAL,
      description: `Transportation challenges in ${supplierZone}`,
      probability: transportRisk.probability,
      impact: transportRisk.impact,
      riskScore: transportRisk.probability * transportRisk.impact,
      severity: this.calculateSeverity(transportRisk.probability * transportRisk.impact),
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'regional',
      sources: ['Transportation Analysis'],
      confidence: 0.7,
    });

    return risks;
  }

  /**
   * Get transportation risk by zone
   */
  private getTransportationRisk(zone: string): { probability: number; impact: number } {
    const transportRisks: { [key: string]: { probability: number; impact: number } } = {
      'jakarta_metro': { probability: 0.6, impact: 4 }, // High traffic, but good infrastructure
      'java_island': { probability: 0.4, impact: 5 },   // Good roads, moderate traffic
      'sumatra_island': { probability: 0.5, impact: 6 }, // Mixed infrastructure
      'kalimantan_island': { probability: 0.7, impact: 7 }, // Limited roads, river transport
      'sulawesi_island': { probability: 0.6, impact: 7 }, // Island challenges
      'eastern_islands': { probability: 0.8, impact: 8 }, // Remote, limited access
      'bali_lombok': { probability: 0.3, impact: 5 },   // Tourist infrastructure
    };

    return transportRisks[zone] || { probability: 0.5, impact: 6 };
  }

  /**
   * Assess advanced risks for comprehensive/enterprise levels
   */
  private assessAdvancedRisks(supplier: Supplier, supplierZone: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Cyber security risk
    risks.push({
      type: RiskFactorType.CYBER_SECURITY,
      category: RiskCategory.TECHNOLOGICAL,
      description: 'Cybersecurity vulnerabilities in supply chain systems',
      probability: 0.4,
      impact: 6,
      riskScore: 2.4,
      severity: 'medium',
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'global',
      sources: ['Cybersecurity Assessment'],
      confidence: 0.6,
    });

    // Pandemic impact
    risks.push({
      type: RiskFactorType.PANDEMIC_IMPACT,
      category: RiskCategory.OPERATIONAL,
      description: 'Potential pandemic-related disruptions',
      probability: 0.3,
      impact: 7,
      riskScore: 2.1,
      severity: 'medium',
      isActive: true,
      detectedAt: new Date(),
      geographicScope: 'global',
      sources: ['Health Authority Monitoring'],
      confidence: 0.7,
    });

    return risks;
  }

  /**
   * Calculate severity level from risk score
   */
  private calculateSeverity(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 7) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate disruption probability
   */
  private calculateDisruptionProbability(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0;

    // Calculate combined probability using complement method
    let combinedProbability = 1;
    riskFactors.forEach(rf => {
      combinedProbability *= (1 - rf.probability);
    });

    return 1 - combinedProbability;
  }

  /**
   * Assess potential disruption impact
   */
  private assessDisruptionImpact(
    selectedSupplier: SupplierScore | undefined,
    riskFactors: RiskFactor[],
    request: SupplierSelectionRequest,
  ): DisruptionImpact {
    const orderValue = request.orderQuantity * (request.product.costPrice || 0);
    const maxImpact = Math.max(...riskFactors.map(rf => rf.impact));
    const avgImpact = riskFactors.reduce((sum, rf) => sum + rf.impact, 0) / riskFactors.length;

    return {
      supplyContinuity: maxImpact,
      costIncrease: avgImpact * 2, // Percentage increase
      deliveryDelay: avgImpact * 3, // Days
      qualityReduction: avgImpact * 0.8,
      reputationDamage: avgImpact * 0.6,
      customerSatisfaction: avgImpact * 0.7,
      financialLoss: orderValue * (avgImpact / 100), // IDR
      operationalDisruption: avgImpact,
    };
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(
    riskFactors: RiskFactor[],
    disruptionProbability: number,
    potentialImpact: DisruptionImpact,
  ): number {
    const avgRiskScore = riskFactors.reduce((sum, rf) => sum + rf.riskScore, 0) / riskFactors.length;
    const probabilityScore = disruptionProbability * 100;
    const impactScore = potentialImpact.supplyContinuity * 10;

    return Math.min(100, (avgRiskScore * 30 + probabilityScore * 40 + impactScore * 30) / 100);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Generate mitigation strategies
   */
  private generateMitigationStrategies(
    riskFactors: RiskFactor[],
    assessmentLevel: string,
  ): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];

    // Diversification strategy
    if (riskFactors.some(rf => rf.type === RiskFactorType.SUPPLIER_DEPENDENCY)) {
      strategies.push({
        id: 'diversification',
        name: 'Supplier Diversification',
        description: 'Develop relationships with multiple suppliers across different regions',
        applicableRisks: [RiskFactorType.SUPPLIER_DEPENDENCY, RiskFactorType.GEOGRAPHIC_CONCENTRATION],
        effectiveness: 0.8,
        implementationCost: 500000, // IDR
        implementationTime: 60, // days
        priority: 'high',
        status: 'planned',
        responsibility: 'Procurement Team',
        resources: ['Supplier Database', 'Evaluation Framework'],
      });
    }

    // Inventory buffer strategy
    if (riskFactors.some(rf => rf.type === RiskFactorType.NATURAL_DISASTER)) {
      strategies.push({
        id: 'inventory_buffer',
        name: 'Strategic Inventory Buffer',
        description: 'Maintain additional safety stock for critical items',
        applicableRisks: [RiskFactorType.NATURAL_DISASTER, RiskFactorType.TRANSPORTATION_DISRUPTION],
        effectiveness: 0.6,
        implementationCost: 1000000, // IDR
        implementationTime: 30, // days
        priority: 'medium',
        status: 'planned',
        responsibility: 'Inventory Manager',
        resources: ['Warehouse Space', 'Inventory Management System'],
      });
    }

    // Insurance strategy
    if (riskFactors.some(rf => rf.severity === 'high' || rf.severity === 'critical')) {
      strategies.push({
        id: 'supply_chain_insurance',
        name: 'Supply Chain Insurance',
        description: 'Obtain comprehensive supply chain disruption insurance',
        applicableRisks: [RiskFactorType.NATURAL_DISASTER, RiskFactorType.TRANSPORTATION_DISRUPTION],
        effectiveness: 0.7,
        implementationCost: 200000, // IDR
        implementationTime: 14, // days
        priority: 'medium',
        status: 'planned',
        responsibility: 'Risk Manager',
        resources: ['Insurance Broker', 'Risk Assessment Data'],
      });
    }

    return strategies;
  }

  /**
   * Create contingency plans
   */
  private createContingencyPlans(
    riskFactors: RiskFactor[],
    alternatives: SupplierScore[],
    assessmentLevel: string,
  ): ContingencyPlan[] {
    const plans: ContingencyPlan[] = [];

    // Supplier substitution plan
    if (alternatives.length > 0) {
      plans.push({
        id: 'supplier_substitution',
        name: 'Emergency Supplier Substitution',
        triggerConditions: [
          'Primary supplier unavailable for >3 days',
          'Quality issues detected',
          'Delivery delay >7 days',
        ],
        activationThreshold: 6.0,
        actionSteps: [
          {
            sequence: 1,
            description: 'Assess supplier availability',
            responsibility: 'Procurement Manager',
            estimatedDuration: 2,
            dependencies: [],
            resources: ['Supplier Database', 'Communication System'],
            successCriteria: 'Alternative supplier confirmed',
          },
          {
            sequence: 2,
            description: 'Negotiate emergency terms',
            responsibility: 'Procurement Team',
            estimatedDuration: 4,
            dependencies: ['Assess supplier availability'],
            resources: ['Negotiation Framework', 'Legal Support'],
            successCriteria: 'Terms agreed and documented',
          },
        ],
        alternativeSuppliers: alternatives.slice(0, 3).map(alt => alt.supplierId),
        estimatedActivationTime: 8,
        requiredResources: ['Procurement Team', 'Legal Support', 'Finance Approval'],
        communicationPlan: 'Notify all stakeholders within 1 hour',
        testingSchedule: 'Quarterly',
        effectiveness: 0.8,
      });
    }

    // Emergency procurement plan
    plans.push({
      id: 'emergency_procurement',
      name: 'Emergency Procurement Protocol',
      triggerConditions: [
        'All primary suppliers unavailable',
        'Natural disaster in supplier region',
        'Transportation completely disrupted',
      ],
      activationThreshold: 8.0,
      actionSteps: [
        {
          sequence: 1,
          description: 'Activate emergency sourcing team',
          responsibility: 'Chief Procurement Officer',
          estimatedDuration: 1,
          dependencies: [],
          resources: ['Emergency Contact List', 'Crisis Management Team'],
          successCriteria: 'Team assembled and briefed',
        },
        {
          sequence: 2,
          description: 'Source from spot market',
          responsibility: 'Emergency Sourcing Team',
          estimatedDuration: 12,
          dependencies: ['Activate emergency sourcing team'],
          resources: ['Market Intelligence', 'Procurement Budget'],
          successCriteria: 'Alternative source identified',
        },
      ],
      alternativeSuppliers: [],
      estimatedActivationTime: 4,
      requiredResources: ['Emergency Budget', 'Cross-functional Team'],
      communicationPlan: 'Immediate executive notification',
      testingSchedule: 'Annually',
      effectiveness: 0.6,
    });

    return plans;
  }

  /**
   * Analyze risk trends
   */
  private async analyzeRiskTrends(
    selectedSupplier: SupplierScore | undefined,
    riskFactors: RiskFactor[],
    assessmentLevel: string,
  ): Promise<RiskTrend[]> {
    const trends: RiskTrend[] = [];

    // Analyze trends for each risk type
    const riskTypes = [...new Set(riskFactors.map(rf => rf.type))];
    
    for (const riskType of riskTypes) {
      const historicalData = await this.getHistoricalRiskData(riskType);
      const currentLevel = this.getCurrentRiskLevel(riskType, riskFactors);
      const trend = this.calculateRiskTrend(historicalData);
      
      trends.push({
        riskType,
        historicalData,
        currentLevel,
        trend,
        predictedLevel: this.predictFutureRiskLevel(historicalData, trend),
        predictionConfidence: 0.7,
        seasonalPattern: this.getSeasonalPattern(riskType),
        keyDrivers: this.getKeyDrivers(riskType),
        recommendations: this.getRiskRecommendations(riskType, trend),
      });
    }

    return trends;
  }

  /**
   * Get historical risk data (simulated for demo)
   */
  private async getHistoricalRiskData(riskType: RiskFactorType): Promise<RiskDataPoint[]> {
    // In production, this would query actual historical data
    const data: RiskDataPoint[] = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = moment(now).subtract(i, 'months').toDate();
      data.push({
        date,
        riskLevel: Math.random() * 10,
        incidents: Math.floor(Math.random() * 5),
        severity: Math.random() * 10,
        impact: Math.random() * 10,
        source: 'Historical Database',
      });
    }
    
    return data.reverse();
  }

  /**
   * Get current risk level for a specific risk type
   */
  private getCurrentRiskLevel(riskType: RiskFactorType, riskFactors: RiskFactor[]): number {
    const relevantFactors = riskFactors.filter(rf => rf.type === riskType);
    if (relevantFactors.length === 0) return 0;
    
    return relevantFactors.reduce((sum, rf) => sum + rf.riskScore, 0) / relevantFactors.length;
  }

  /**
   * Calculate risk trend
   */
  private calculateRiskTrend(historicalData: RiskDataPoint[]): 'increasing' | 'decreasing' | 'stable' {
    if (historicalData.length < 2) return 'stable';
    
    const recent = historicalData.slice(-3);
    const earlier = historicalData.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.riskLevel, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, d) => sum + d.riskLevel, 0) / earlier.length;
    
    if (recentAvg > earlierAvg * 1.1) return 'increasing';
    if (recentAvg < earlierAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  /**
   * Predict future risk level
   */
  private predictFutureRiskLevel(historicalData: RiskDataPoint[], trend: string): number {
    const currentLevel = historicalData[historicalData.length - 1]?.riskLevel || 0;
    
    switch (trend) {
      case 'increasing':
        return Math.min(10, currentLevel * 1.2);
      case 'decreasing':
        return Math.max(0, currentLevel * 0.8);
      default:
        return currentLevel;
    }
  }

  /**
   * Get seasonal pattern for risk type
   */
  private getSeasonalPattern(riskType: RiskFactorType): SeasonalPattern | undefined {
    const patterns: { [key: string]: SeasonalPattern } = {
      [RiskFactorType.NATURAL_DISASTER]: {
        monthlyRiskLevels: {
          1: 7, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3,
          7: 3, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7,
        },
        peakRiskPeriods: [
          { startMonth: 12, endMonth: 2, description: 'Rainy season flooding' },
          { startMonth: 6, endMonth: 8, description: 'Dry season fires' },
        ],
        historicalPatterns: ['Higher risk during monsoon', 'Earthquake clusters'],
      },
      [RiskFactorType.SEASONAL_DISRUPTION]: {
        monthlyRiskLevels: {
          1: 8, 2: 9, 3: 7, 4: 6, 5: 5, 6: 4,
          7: 4, 8: 4, 9: 5, 10: 6, 11: 7, 12: 8,
        },
        peakRiskPeriods: [
          { startMonth: 1, endMonth: 2, description: 'Chinese New Year' },
          { startMonth: 3, endMonth: 5, description: 'Ramadan period' },
        ],
        historicalPatterns: ['Predictable cultural patterns', 'Supply chain slowdowns'],
      },
    };

    return patterns[riskType];
  }

  /**
   * Get key drivers for risk type
   */
  private getKeyDrivers(riskType: RiskFactorType): string[] {
    const drivers: { [key: string]: string[] } = {
      [RiskFactorType.NATURAL_DISASTER]: [
        'Climate change effects',
        'Geological activity',
        'Seasonal weather patterns',
        'Deforestation impact',
      ],
      [RiskFactorType.TRANSPORTATION_DISRUPTION]: [
        'Infrastructure quality',
        'Traffic congestion',
        'Fuel price volatility',
        'Government regulations',
      ],
      [RiskFactorType.ECONOMIC_DISRUPTION]: [
        'Global economic conditions',
        'Currency exchange rates',
        'Inflation trends',
        'Government policy changes',
      ],
    };

    return drivers[riskType] || ['General market conditions'];
  }

  /**
   * Get risk recommendations
   */
  private getRiskRecommendations(riskType: RiskFactorType, trend: string): string[] {
    const baseRecommendations: { [key: string]: string[] } = {
      [RiskFactorType.NATURAL_DISASTER]: [
        'Develop disaster response protocols',
        'Consider insurance coverage',
        'Diversify supplier locations',
      ],
      [RiskFactorType.SUPPLIER_DEPENDENCY]: [
        'Identify alternative suppliers',
        'Negotiate flexible contracts',
        'Build strategic partnerships',
      ],
      [RiskFactorType.TRANSPORTATION_DISRUPTION]: [
        'Evaluate multiple logistics providers',
        'Consider inventory positioning',
        'Develop route alternatives',
      ],
    };

    const recommendations = baseRecommendations[riskType] || ['Monitor risk closely'];

    if (trend === 'increasing') {
      recommendations.push('Implement immediate risk mitigation measures');
      recommendations.push('Increase monitoring frequency');
    }

    return recommendations;
  }

  /**
   * Create basic risk assessment fallback
   */
  private createBasicRiskAssessment(): SupplyChainRiskAssessment {
    return {
      overallRiskLevel: 'medium',
      overallRiskScore: 50,
      riskFactors: [],
      disruptionProbability: 0.3,
      potentialImpact: {
        supplyContinuity: 5,
        costIncrease: 10,
        deliveryDelay: 7,
        qualityReduction: 3,
        reputationDamage: 2,
        customerSatisfaction: 4,
        financialLoss: 0,
        operationalDisruption: 4,
      },
      mitigationStrategies: [],
      contingencyPlans: [],
      riskTrends: [],
      lastAssessmentDate: new Date(),
      nextReviewDate: moment().add(1, 'month').toDate(),
      assessmentLevel: 'basic',
    };
  }

  private buildSelectionResult(
    selectedSupplier: SupplierScore | undefined,
    alternatives: SupplierScore[],
    allScores: SupplierScore[],
    request: SupplierSelectionRequest,
  ): SupplierSelectionResult {
    // Rank suppliers
    allScores.sort((a, b) => b.totalScore - a.totalScore);
    allScores.forEach((score, index) => {
      score.rank = index + 1;
    });

    // Find specialized alternatives
    const sortedByCost = [...allScores].sort(
      (a, b) => b.costScore - a.costScore,
    );
    const sortedByQuality = [...allScores].sort(
      (a, b) => b.qualityScore - a.qualityScore,
    );
    const sortedBySpeed = [...allScores].sort(
      (a, b) => b.deliveryScore - a.deliveryScore,
    );

    const result: SupplierSelectionResult = {
      success: !!selectedSupplier,
      selectedSupplier,
      alternativeSuppliers: alternatives,
      selectionMethod:
        request.selectionMethod || request.reorderRule.supplierSelectionMethod,
      evaluationCriteria: this.getEvaluationCriteria(
        request.reorderRule,
        request.evaluationCriteria,
      ),
      totalSuppliersEvaluated: allScores.length,
      selectionConfidence: selectedSupplier?.confidenceLevel || 0,
      selectionReason: this.generateSelectionReason(selectedSupplier, request),
      riskWarnings: selectedSupplier?.riskFactors || [],
      costBenefitAnalysis: {
        selectedSupplierCost: selectedSupplier?.estimatedCost || 0,
        averageCost:
          allScores.reduce((sum, s) => sum + s.estimatedCost, 0) /
          allScores.length,
        potentialSavings: selectedSupplier?.potentialSavings || 0,
        riskAdjustedSavings:
          (selectedSupplier?.potentialSavings || 0) *
          (selectedSupplier?.confidenceLevel || 0),
      },
      predictedDeliveryDate:
        this.calculatePredictedDeliveryDate(selectedSupplier),
      predictedQuality: selectedSupplier?.qualityScore || 0,
      predictedReliability: selectedSupplier?.reliabilityScore || 0,
      secondChoice: alternatives[0],
      budgetAlternative: sortedByCost[0],
      qualityAlternative: sortedByQuality[0],
      speedAlternative: sortedBySpeed[0],
      evaluatedAt: new Date(),
      validUntil: moment().add(24, 'hours').toDate(),
    };

    return result;
  }

  private generateSelectionReason(
    selectedSupplier: SupplierScore | undefined,
    request: SupplierSelectionRequest,
  ): string {
    if (!selectedSupplier) return 'No suitable supplier found';

    const method =
      request.selectionMethod || request.reorderRule.supplierSelectionMethod;
    const supplier = selectedSupplier.supplier;

    switch (method) {
      case SupplierSelectionMethod.COST_OPTIMAL:
        return `Selected for lowest cost: ${selectedSupplier.estimatedCost.toLocaleString(
          'id-ID',
        )} IDR`;
      case SupplierSelectionMethod.QUALITY_OPTIMAL:
        return `Selected for highest quality rating: ${supplier.rating}/5`;
      case SupplierSelectionMethod.DELIVERY_OPTIMAL:
        return `Selected for fastest delivery: ${supplier.leadTimeDays} days`;
      case SupplierSelectionMethod.PRIMARY:
        return 'Selected as designated primary supplier';
      default:
        return `Selected for best overall score: ${selectedSupplier.totalScore.toFixed(
          1,
        )}/100`;
    }
  }

  private calculatePredictedDeliveryDate(
    selectedSupplier: SupplierScore | undefined,
  ): Date {
    const leadTimeDays = selectedSupplier?.supplier.leadTimeDays || 7;
    return moment().add(leadTimeDays, 'days').toDate();
  }

  private calculateAverageLeadTime(orders: PurchaseOrder[]): number {
    if (orders.length === 0) return 0;

    const leadTimes = orders
      .filter(order => order.sentToSupplierAt && order.firstReceivedAt)
      .map(order => {
        const sent = moment(order.sentToSupplierAt);
        const received = moment(order.firstReceivedAt);
        return received.diff(sent, 'days');
      });

    return leadTimes.length > 0
      ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length
      : 0;
  }

  private wasDeliveredOnTime(order: PurchaseOrder): boolean {
    if (!order.expectedDeliveryDate || !order.firstReceivedAt) return false;
    return moment(order.firstReceivedAt).isSameOrBefore(
      moment(order.expectedDeliveryDate),
    );
  }

  private createNoSuppliersResult(
    request: SupplierSelectionRequest,
  ): SupplierSelectionResult {
    return {
      success: false,
      alternativeSuppliers: [],
      selectionMethod:
        request.selectionMethod || request.reorderRule.supplierSelectionMethod,
      evaluationCriteria: this.getEvaluationCriteria(
        request.reorderRule,
        request.evaluationCriteria,
      ),
      totalSuppliersEvaluated: 0,
      selectionConfidence: 0,
      selectionReason:
        'No eligible suppliers found for this product and criteria',
      riskWarnings: ['No suppliers available - manual intervention required'],
      costBenefitAnalysis: {
        selectedSupplierCost: 0,
        averageCost: 0,
        potentialSavings: 0,
        riskAdjustedSavings: 0,
      },
      predictedDeliveryDate: moment().add(30, 'days').toDate(),
      predictedQuality: 0,
      predictedReliability: 0,
      evaluatedAt: new Date(),
      validUntil: moment().add(1, 'hour').toDate(),
    };
  }

  private createErrorResult(
    request: SupplierSelectionRequest,
    errorMessage: string,
  ): SupplierSelectionResult {
    const noSuppliersResult = this.createNoSuppliersResult(request);
    return {
      ...noSuppliersResult,
      selectionReason: `Error in supplier selection: ${errorMessage}`,
      riskWarnings: [
        'Supplier selection failed - manual intervention required',
      ],
    };
  }
}
