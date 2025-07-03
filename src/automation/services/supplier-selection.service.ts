import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as moment from 'moment-timezone';

import { Supplier, SupplierStatus } from '../../suppliers/entities/supplier.entity';
import { Product } from '../../products/entities/product.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../../purchase-orders/entities/purchase-order.entity';
import { ReorderRule, SupplierSelectionMethod } from '../entities/reorder-rule.entity';

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
  
  evaluatedAt: Date;
  validUntil: Date;
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
  async selectSupplier(request: SupplierSelectionRequest): Promise<SupplierSelectionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Selecting supplier for product ${request.product.id}, quantity ${request.orderQuantity}`);

      // Get eligible suppliers
      const eligibleSuppliers = await this.getEligibleSuppliers(request);
      
      if (eligibleSuppliers.length === 0) {
        return this.createNoSuppliersResult(request);
      }

      // Evaluate each supplier
      const supplierScores = await Promise.all(
        eligibleSuppliers.map(supplier => this.evaluateSupplier(supplier, request))
      );

      // Apply selection method
      const selectedSupplier = this.applySelectionMethod(supplierScores, request);
      
      // Sort alternatives by score
      const alternatives = supplierScores
        .filter(score => score.supplierId !== selectedSupplier?.supplierId)
        .sort((a, b) => b.totalScore - a.totalScore);

      // Calculate insights and recommendations
      const result = this.buildSelectionResult(
        selectedSupplier,
        alternatives,
        supplierScores,
        request
      );

      const selectionTime = Date.now() - startTime;
      this.logger.debug(`Supplier selection completed in ${selectionTime}ms`);

      return result;

    } catch (error) {
      this.logger.error(`Error in supplier selection: ${error.message}`, error.stack);
      return this.createErrorResult(request, error.message);
    }
  }

  /**
   * Get suppliers eligible for the product and order
   */
  private async getEligibleSuppliers(request: SupplierSelectionRequest): Promise<Supplier[]> {
    const { product, reorderRule, orderQuantity, includeOnlySuppliers, excludeSuppliers } = request;

    let query = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.tenantId = :tenantId', { tenantId: product.tenantId })
      .andWhere('supplier.status = :status', { status: SupplierStatus.ACTIVE })
      .andWhere('supplier.isDeleted = false');

    // Filter by allowed suppliers if specified in reorder rule
    if (reorderRule.allowedSupplierIds && reorderRule.allowedSupplierIds.length > 0) {
      query = query.andWhere('supplier.id IN (:...allowedIds)', { 
        allowedIds: reorderRule.allowedSupplierIds 
      });
    }

    // Apply include/exclude filters
    if (includeOnlySuppliers && includeOnlySuppliers.length > 0) {
      query = query.andWhere('supplier.id IN (:...includeIds)', { 
        includeIds: includeOnlySuppliers 
      });
    }

    if (excludeSuppliers && excludeSuppliers.length > 0) {
      query = query.andWhere('supplier.id NOT IN (:...excludeIds)', { 
        excludeIds: excludeSuppliers 
      });
    }

    // Check if supplier can handle the order quantity (basic capacity check)
    // Note: Using creditLimit as a proxy for capacity since maxOrderQuantity is not defined
    if (orderQuantity > 0 && request.product.costPrice) {
      const estimatedOrderValue = orderQuantity * request.product.costPrice;
      query = query.andWhere(
        '(supplier.creditLimit IS NULL OR supplier.creditLimit >= :estimatedValue)',
        { estimatedValue: estimatedOrderValue }
      );
    }

    // Check budget constraints
    if (request.budgetConstraint && product.costPrice) {
      const maxQuantityByBudget = Math.floor(request.budgetConstraint / product.costPrice);
      if (maxQuantityByBudget < orderQuantity) {
        // Look for suppliers with lower costs or higher discounts
        query = query.andWhere(
          '(supplier.discount > 0 OR supplier.creditLimit >= :budgetConstraint)',
          { budgetConstraint: request.budgetConstraint }
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
    request: SupplierSelectionRequest
  ): Promise<SupplierScore> {
    const { product, orderQuantity, reorderRule } = request;

    // Get supplier performance history
    const performanceData = await this.getSupplierPerformance(supplier.id, product.tenantId);
    
    // Calculate individual scores
    const costScore = await this.calculateCostScore(supplier, product, orderQuantity);
    const qualityScore = this.calculateQualityScore(supplier, performanceData);
    const deliveryScore = this.calculateDeliveryScore(supplier, performanceData, request.urgencyLevel);
    const reliabilityScore = this.calculateReliabilityScore(supplier, performanceData);
    
    // Optional scores
    const capacityScore = this.calculateCapacityScore(supplier, orderQuantity);
    const locationScore = this.calculateLocationScore(supplier, request.deliveryDeadline);
    
    // Get evaluation criteria (from rule or defaults)
    const criteria = this.getEvaluationCriteria(reorderRule, request.evaluationCriteria);
    
    // Calculate weighted total score
    const totalScore = this.calculateWeightedScore({
      costScore,
      qualityScore,
      deliveryScore,
      reliabilityScore,
      capacityScore,
      locationScore,
    }, criteria);

    // Build evaluation details
    const evaluationDetails = {
      averageUnitCost: await this.getAverageUnitCost(supplier, product),
      onTimeDeliveryRate: supplier.onTimeDeliveryRate,
      qualityRating: supplier.rating,
      reliabilityIndex: this.calculateReliabilityIndex(supplier, performanceData),
      leadTimeDays: supplier.leadTimeDays,
      totalOrders: supplier.totalOrders,
      lastOrderDate: supplier.lastOrderDate,
      contractStatus: this.getContractStatus(supplier),
      paymentTerms: supplier.paymentTerms,
      discount: supplier.discount,
    };

    // Risk analysis
    const { riskFactors, advantages } = this.analyzeSupplierRisks(supplier, performanceData, request);
    
    // Confidence calculation
    const confidenceLevel = this.calculateConfidenceLevel(supplier, performanceData);
    
    // Financial calculations
    const estimatedCost = this.calculateEstimatedCost(supplier, product, orderQuantity);
    const potentialSavings = this.calculatePotentialSavings(estimatedCost, request);

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
      remainingCredit: Math.max(0, supplier.creditLimit - supplier.totalPurchaseAmount),
    };
  }

  /**
   * Calculate cost score (0-100, higher is better)
   */
  private async calculateCostScore(
    supplier: Supplier,
    product: Product,
    orderQuantity: number
  ): Promise<number> {
    const baseUnitCost = product.costPrice || 0;
    const supplierDiscount = supplier.discount / 100;
    const effectiveUnitCost = baseUnitCost * (1 - supplierDiscount);
    
    // Get historical pricing if available
    const historicalCost = await this.getAverageUnitCost(supplier, product);
    const finalUnitCost = historicalCost || effectiveUnitCost;
    
    // Calculate total cost including shipping and fees
    const shippingCost = this.estimateShippingCost(supplier, orderQuantity);
    const totalCost = (finalUnitCost * orderQuantity) + shippingCost;
    
    // Score based on cost competitiveness (lower cost = higher score)
    // Use industry benchmark or average as baseline
    const industryBenchmark = baseUnitCost * 0.9; // Assume 10% below retail as good
    const costRatio = industryBenchmark / finalUnitCost;
    
    return Math.min(100, Math.max(0, costRatio * 80)); // Scale to 0-100
  }

  /**
   * Calculate quality score based on ratings and performance
   */
  private calculateQualityScore(supplier: Supplier, performanceData: any): number {
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
    urgencyLevel: number
  ): number {
    const onTimeRate = supplier.onTimeDeliveryRate || 0;
    const leadTime = supplier.leadTimeDays || 30;
    
    // Base score from on-time delivery rate
    let score = onTimeRate;
    
    // Adjust for lead time (shorter is better)
    const leadTimeScore = Math.max(0, 100 - (leadTime - 1) * 5); // Penalty for longer lead times
    score = (score * 0.7) + (leadTimeScore * 0.3);
    
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
  private calculateReliabilityScore(supplier: Supplier, performanceData: any): number {
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
   * Calculate capacity score based on credit limit as proxy for capacity
   */
  private calculateCapacityScore(supplier: Supplier, orderQuantity: number): number {
    // Since maxOrderQuantity is not defined, use creditLimit as capacity proxy
    const creditLimit = supplier.creditLimit;
    
    if (!creditLimit) return 75; // Assume good capacity if not specified
    
    // Estimate order value (using a default unit cost if not available)
    const estimatedUnitCost = 100000; // IDR 100,000 as default
    const estimatedOrderValue = orderQuantity * estimatedUnitCost;
    const utilizationRatio = estimatedOrderValue / creditLimit;
    
    if (utilizationRatio > 1) return 0; // Over credit capacity
    if (utilizationRatio > 0.9) return 30; // Near credit limit
    if (utilizationRatio > 0.7) return 60; // High credit utilization
    if (utilizationRatio > 0.5) return 90; // Good credit utilization
    
    return 100; // Low credit utilization, high capacity available
  }

  /**
   * Calculate location/proximity score
   */
  private calculateLocationScore(supplier: Supplier, deliveryDeadline?: Date): number {
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
    criteria: SupplierEvaluationCriteria
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    totalScore += scores.costScore * criteria.costWeight;
    totalScore += scores.qualityScore * criteria.qualityWeight;
    totalScore += scores.deliveryScore * criteria.deliveryWeight;
    totalScore += scores.reliabilityScore * criteria.reliabilityWeight;
    
    totalWeight = criteria.costWeight + criteria.qualityWeight + 
                  criteria.deliveryWeight + criteria.reliabilityWeight;

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
    request: SupplierSelectionRequest
  ): SupplierScore | undefined {
    if (supplierScores.length === 0) return undefined;

    const method = request.selectionMethod || request.reorderRule.supplierSelectionMethod;

    switch (method) {
      case SupplierSelectionMethod.PRIMARY:
        return this.selectPrimarySupplier(supplierScores, request.reorderRule);
        
      case SupplierSelectionMethod.COST_OPTIMAL:
        return supplierScores.sort((a, b) => b.costScore - a.costScore)[0];
        
      case SupplierSelectionMethod.DELIVERY_OPTIMAL:
        return supplierScores.sort((a, b) => b.deliveryScore - a.deliveryScore)[0];
        
      case SupplierSelectionMethod.QUALITY_OPTIMAL:
        return supplierScores.sort((a, b) => b.qualityScore - a.qualityScore)[0];
        
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
    reorderRule: ReorderRule
  ): SupplierScore | undefined {
    if (!reorderRule.primarySupplierId) {
      // No primary supplier set, fall back to balanced selection
      return supplierScores.sort((a, b) => b.totalScore - a.totalScore)[0];
    }

    const primarySupplier = supplierScores.find(
      score => score.supplierId === reorderRule.primarySupplierId
    );

    if (primarySupplier && primarySupplier.totalScore >= 60) {
      // Primary supplier meets minimum threshold
      return primarySupplier;
    }

    // Primary supplier doesn't meet criteria, select best alternative
    return supplierScores.sort((a, b) => b.totalScore - a.totalScore)[0];
  }

  // Helper methods
  private async getSupplierPerformance(supplierId: string, tenantId: string): Promise<any> {
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
      onTimeDeliveries: recentOrders.filter(order => this.wasDeliveredOnTime(order)).length,
    };
  }

  private async getAverageUnitCost(supplier: Supplier, product: Product): Promise<number> {
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
      .andWhere('po.createdAt >= :since', { since: moment().subtract(6, 'months').toDate() })
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

    const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : product.costPrice || 0;
    
    // Cache for 1 hour
    await this.cacheManager.set(cacheKey, avgCost, 3600);
    
    return avgCost;
  }

  private getEvaluationCriteria(
    reorderRule: ReorderRule,
    override?: SupplierEvaluationCriteria
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
        return { costWeight: 0.6, qualityWeight: 0.15, deliveryWeight: 0.15, reliabilityWeight: 0.1 };
      case SupplierSelectionMethod.QUALITY_OPTIMAL:
        return { costWeight: 0.1, qualityWeight: 0.6, deliveryWeight: 0.15, reliabilityWeight: 0.15 };
      case SupplierSelectionMethod.DELIVERY_OPTIMAL:
        return { costWeight: 0.15, qualityWeight: 0.15, deliveryWeight: 0.6, reliabilityWeight: 0.1 };
      default:
        return { costWeight: 0.3, qualityWeight: 0.25, deliveryWeight: 0.25, reliabilityWeight: 0.2 };
    }
  }

  private calculateReliabilityIndex(supplier: Supplier, performanceData: any): number {
    // Composite reliability index
    const orderReliability = supplier.totalOrders > 0 ? supplier.onTimeDeliveryRate : 50;
    const ratingReliability = (supplier.rating / 5) * 100;
    const experienceReliability = Math.min(100, supplier.totalOrders * 5);
    
    return (orderReliability * 0.5 + ratingReliability * 0.3 + experienceReliability * 0.2);
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
    
    const daysUntilExpiry = moment(supplier.contractEndDate).diff(moment(now), 'days');
    
    if (daysUntilExpiry <= 30) {
      return 'Contract Expiring Soon';
    }
    
    return 'Active Contract';
  }

  private analyzeSupplierRisks(
    supplier: Supplier,
    performanceData: any,
    request: SupplierSelectionRequest
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
    
    if (supplier.creditLimit < request.orderQuantity * (request.product.costPrice || 0)) {
      riskFactors.push('Order may exceed credit limit');
    }

    const contractStatus = this.getContractStatus(supplier);
    if (contractStatus.includes('Expired') || contractStatus.includes('Expiring')) {
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

  private calculateConfidenceLevel(supplier: Supplier, performanceData: any): number {
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
    if (supplier.lastOrderDate && moment().diff(moment(supplier.lastOrderDate), 'months') > 6) {
      confidence *= 0.9;
    }

    return Math.max(0.3, confidence);
  }

  private calculateEstimatedCost(supplier: Supplier, product: Product, orderQuantity: number): number {
    const unitCost = product.costPrice || 0;
    const discount = supplier.discount / 100;
    const effectiveUnitCost = unitCost * (1 - discount);
    const shippingCost = this.estimateShippingCost(supplier, orderQuantity);
    
    return (effectiveUnitCost * orderQuantity) + shippingCost;
  }

  private estimateShippingCost(supplier: Supplier, orderQuantity: number): number {
    // Simple shipping cost estimation for Indonesian context
    const isLocal = supplier.country === 'Indonesia' || !supplier.country;
    const baseShipping = isLocal ? 50000 : 200000; // IDR
    const quantityMultiplier = Math.ceil(orderQuantity / 100) * 0.1;
    
    return baseShipping * (1 + quantityMultiplier);
  }

  private calculatePotentialSavings(estimatedCost: number, request: SupplierSelectionRequest): number {
    // Compare with budget or expected cost
    const baseline = request.budgetConstraint || 
                    (request.orderQuantity * (request.product.costPrice || 0));
    
    return Math.max(0, baseline - estimatedCost);
  }

  private buildSelectionResult(
    selectedSupplier: SupplierScore | undefined,
    alternatives: SupplierScore[],
    allScores: SupplierScore[],
    request: SupplierSelectionRequest
  ): SupplierSelectionResult {
    // Rank suppliers
    allScores.sort((a, b) => b.totalScore - a.totalScore);
    allScores.forEach((score, index) => { score.rank = index + 1; });

    // Find specialized alternatives
    const sortedByCost = [...allScores].sort((a, b) => b.costScore - a.costScore);
    const sortedByQuality = [...allScores].sort((a, b) => b.qualityScore - a.qualityScore);
    const sortedBySpeed = [...allScores].sort((a, b) => b.deliveryScore - a.deliveryScore);

    const result: SupplierSelectionResult = {
      success: !!selectedSupplier,
      selectedSupplier,
      alternativeSuppliers: alternatives,
      selectionMethod: request.selectionMethod || request.reorderRule.supplierSelectionMethod,
      evaluationCriteria: this.getEvaluationCriteria(request.reorderRule, request.evaluationCriteria),
      totalSuppliersEvaluated: allScores.length,
      selectionConfidence: selectedSupplier?.confidenceLevel || 0,
      selectionReason: this.generateSelectionReason(selectedSupplier, request),
      riskWarnings: selectedSupplier?.riskFactors || [],
      costBenefitAnalysis: {
        selectedSupplierCost: selectedSupplier?.estimatedCost || 0,
        averageCost: allScores.reduce((sum, s) => sum + s.estimatedCost, 0) / allScores.length,
        potentialSavings: selectedSupplier?.potentialSavings || 0,
        riskAdjustedSavings: (selectedSupplier?.potentialSavings || 0) * (selectedSupplier?.confidenceLevel || 0),
      },
      predictedDeliveryDate: this.calculatePredictedDeliveryDate(selectedSupplier),
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

  private generateSelectionReason(selectedSupplier: SupplierScore | undefined, request: SupplierSelectionRequest): string {
    if (!selectedSupplier) return 'No suitable supplier found';

    const method = request.selectionMethod || request.reorderRule.supplierSelectionMethod;
    const supplier = selectedSupplier.supplier;

    switch (method) {
      case SupplierSelectionMethod.COST_OPTIMAL:
        return `Selected for lowest cost: ${selectedSupplier.estimatedCost.toLocaleString('id-ID')} IDR`;
      case SupplierSelectionMethod.QUALITY_OPTIMAL:
        return `Selected for highest quality rating: ${supplier.rating}/5`;
      case SupplierSelectionMethod.DELIVERY_OPTIMAL:
        return `Selected for fastest delivery: ${supplier.leadTimeDays} days`;
      case SupplierSelectionMethod.PRIMARY:
        return 'Selected as designated primary supplier';
      default:
        return `Selected for best overall score: ${selectedSupplier.totalScore.toFixed(1)}/100`;
    }
  }

  private calculatePredictedDeliveryDate(selectedSupplier: SupplierScore | undefined): Date {
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
    return moment(order.firstReceivedAt).isSameOrBefore(moment(order.expectedDeliveryDate));
  }

  private createNoSuppliersResult(request: SupplierSelectionRequest): SupplierSelectionResult {
    return {
      success: false,
      alternativeSuppliers: [],
      selectionMethod: request.selectionMethod || request.reorderRule.supplierSelectionMethod,
      evaluationCriteria: this.getEvaluationCriteria(request.reorderRule, request.evaluationCriteria),
      totalSuppliersEvaluated: 0,
      selectionConfidence: 0,
      selectionReason: 'No eligible suppliers found for this product and criteria',
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

  private createErrorResult(request: SupplierSelectionRequest, errorMessage: string): SupplierSelectionResult {
    const noSuppliersResult = this.createNoSuppliersResult(request);
    return {
      ...noSuppliersResult,
      selectionReason: `Error in supplier selection: ${errorMessage}`,
      riskWarnings: ['Supplier selection failed - manual intervention required'],
    };
  }
}