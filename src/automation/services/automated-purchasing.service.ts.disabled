import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ReorderRule } from '../entities/reorder-rule.entity';
import { ReorderExecution } from '../entities/reorder-rule.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Product } from '../../products/entities/product.entity';
import {
  PurchaseOrder,
  PurchaseOrderType,
  PurchaseOrderPriority,
} from '../../purchase-orders/entities/purchase-order.entity';
import { CreatePurchaseOrderDto } from '../../purchase-orders/dto/create-purchase-order.dto';

import {
  ReorderCalculationService,
  ReorderCalculationResult,
} from './reorder-calculation.service';
import {
  SupplierSelectionService,
  SupplierSelectionResult,
} from './supplier-selection.service';
import { PurchaseOrdersService } from '../../purchase-orders/services/purchase-orders.service';
import { AlertManagementService } from '../../alerts/services/alert-management.service';
import {
  AlertType,
  AlertSeverity,
} from '../../alerts/entities/alert-configuration.entity';

export interface AutomatedPurchaseRequest {
  reorderRuleId?: string;
  tenantId: string;
  productId?: string;
  locationId?: string;
  forceExecution?: boolean;
  dryRun?: boolean;
  overrides?: {
    orderQuantity?: number;
    selectedSupplierId?: string;
    urgencyLevel?: number;
    skipApproval?: boolean;
  };
}

export interface AutomatedPurchaseResult {
  success: boolean;
  executionId: string;

  // Execution metadata
  tenantId: string;
  reorderRuleId: string;
  productId: string;
  locationId?: string;
  executedAt: Date;

  // Analysis results
  reorderCalculation: ReorderCalculationResult;
  supplierSelection: SupplierSelectionResult;

  // Decision and action
  shouldCreatePurchaseOrder: boolean;
  purchaseOrderId?: string;
  purchaseOrder?: PurchaseOrder;

  // Execution details
  actualQuantity: number;
  estimatedValue: number;
  selectedSupplierId?: string;
  urgencyLevel: number;

  // Status and workflow
  requiresApproval: boolean;
  isAutomaticallyApproved: boolean;
  approvalRequired: boolean;

  // Recommendations and insights
  recommendations: string[];
  warnings: string[];
  errors: string[];

  // Performance metrics
  executionTimeMs: number;
  calculationConfidence: number;
  selectionConfidence: number;

  // Next actions
  nextReviewDate?: Date;
  followUpActions: string[];

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  mitigationActions: string[];
}

export interface BulkAutomatedPurchaseRequest {
  tenantId: string;
  reorderRuleIds?: string[];
  productIds?: string[];
  locationIds?: string[];
  filters?: {
    minUrgencyLevel?: number;
    maxOrderValue?: number;
    requiresApproval?: boolean;
    supplierIds?: string[];
  };
  options?: {
    dryRun?: boolean;
    maxConcurrentOrders?: number;
    batchSize?: number;
    delayBetweenOrdersMs?: number;
  };
}

export interface BulkAutomatedPurchaseResult {
  success: boolean;
  totalProcessed: number;
  successfulOrders: number;
  failedOrders: number;
  skippedOrders: number;

  // Detailed results
  results: AutomatedPurchaseResult[];
  summary: {
    totalValue: number;
    averageOrderValue: number;
    uniqueSuppliers: number;
    ordersRequiringApproval: number;
    highRiskOrders: number;
  };

  // Execution metadata
  executedAt: Date;
  executionTimeMs: number;
  batchId: string;

  // Errors and warnings
  errors: string[];
  warnings: string[];
}

@Injectable()
export class AutomatedPurchasingService {
  private readonly logger = new Logger(AutomatedPurchasingService.name);

  constructor(
    @InjectRepository(ReorderRule)
    private readonly reorderRuleRepository: Repository<ReorderRule>,
    @InjectRepository(ReorderExecution)
    private readonly reorderExecutionRepository: Repository<ReorderExecution>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectQueue('automation')
    private readonly automationQueue: Queue,
    private readonly reorderCalculationService: ReorderCalculationService,
    private readonly supplierSelectionService: SupplierSelectionService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly alertManagementService: AlertManagementService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute automated purchasing for a single reorder rule
   */
  async executeAutomatedPurchase(
    request: AutomatedPurchaseRequest,
  ): Promise<AutomatedPurchaseResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting automated purchase execution for tenant ${request.tenantId}`,
      );

      // Get reorder rule
      const reorderRule = await this.getReorderRule(request);
      if (!reorderRule) {
        throw new Error('Reorder rule not found or not eligible for execution');
      }

      // Get inventory item and product
      const { inventoryItem, product } = await this.getInventoryAndProduct(
        reorderRule,
      );

      // Create execution record
      const execution = await this.createExecutionRecord(reorderRule);

      try {
        // Step 1: Calculate reorder recommendation
        const reorderCalculation =
          await this.reorderCalculationService.calculateReorderRecommendation({
            reorderRule,
            inventoryItem,
            product,
            currentDate: new Date(),
            overrides: {
              budgetConstraint: request.overrides?.orderQuantity
                ? request.overrides.orderQuantity * (product.costPrice || 0)
                : undefined,
            },
          });

        if (!reorderCalculation.isValid) {
          throw new Error(
            `Reorder calculation failed: ${reorderCalculation.validationErrors.join(
              ', ',
            )}`,
          );
        }

        // Check if reorder is needed
        if (!reorderCalculation.shouldReorderNow && !request.forceExecution) {
          return this.createSkippedResult(
            execution,
            reorderCalculation,
            'Reorder not needed at this time',
          );
        }

        // Step 2: Select supplier
        const supplierSelection =
          await this.supplierSelectionService.selectSupplier({
            product,
            reorderRule,
            orderQuantity:
              request.overrides?.orderQuantity ||
              reorderCalculation.recommendedOrderQuantity,
            urgencyLevel:
              request.overrides?.urgencyLevel ||
              reorderCalculation.urgencyScore,
            budgetConstraint:
              reorderRule.remainingBudget < Infinity
                ? reorderRule.remainingBudget
                : undefined,
            deliveryDeadline:
              this.calculateDeliveryDeadline(reorderCalculation),
            excludeSuppliers: [],
            includeOnlySuppliers: request.overrides?.selectedSupplierId
              ? [request.overrides.selectedSupplierId]
              : undefined,
          });

        if (!supplierSelection.success || !supplierSelection.selectedSupplier) {
          throw new Error('No suitable supplier found for automated purchase');
        }

        // Step 3: Determine if purchase order should be created
        const shouldCreatePO = this.shouldCreatePurchaseOrder(
          reorderCalculation,
          supplierSelection,
          reorderRule,
        );

        let purchaseOrder: PurchaseOrder | undefined;
        let purchaseOrderId: string | undefined;

        if (shouldCreatePO && !request.dryRun) {
          // Step 4: Create purchase order
          const createPODto = this.buildPurchaseOrderDto(
            reorderRule,
            reorderCalculation,
            supplierSelection,
            request.overrides,
          );

          purchaseOrder = await this.purchaseOrdersService.create(
            reorderRule.tenantId,
            createPODto,
            execution.createdBy,
          );
          purchaseOrderId = purchaseOrder.id;

          // Step 5: Handle approval workflow
          await this.handleApprovalWorkflow(
            purchaseOrder,
            reorderRule,
            reorderCalculation,
          );
        }

        // Step 6: Update execution record
        const finalQuantity =
          request.overrides?.orderQuantity ||
          reorderCalculation.recommendedOrderQuantity;
        const finalValue = supplierSelection.selectedSupplier.estimatedCost;

        await this.updateExecutionRecord(execution, {
          success: true,
          purchaseOrderId,
          triggeredQuantity: inventoryItem.quantityAvailable,
          recommendedQuantity: reorderCalculation.recommendedOrderQuantity,
          actualQuantity: finalQuantity,
          orderValue: finalValue,
          selectedSupplierId: supplierSelection.selectedSupplier.supplierId,
          triggerReason: this.generateTriggerReason(reorderCalculation),
          calculationDetails: {
            currentStock: reorderCalculation.currentStock,
            reorderPoint: reorderCalculation.recommendedReorderPoint,
            leadTimeDemand:
              reorderCalculation.safetyStockCalculation.leadTimeDemand,
            safetyStock: reorderCalculation.safetyStockCalculation.safetyStock,
            forecastDemand: reorderCalculation.demandAnalysis.forecastDemand,
            eoqCalculation:
              reorderCalculation.eoqCalculation?.economicOrderQuantity,
            seasonalFactor: reorderCalculation.demandAnalysis.seasonalityFactor,
            supplierScores: {
              [supplierSelection.selectedSupplier.supplierId]:
                supplierSelection.selectedSupplier.totalScore,
            },
          },
        });

        // Step 7: Update reorder rule performance
        reorderRule.recordExecution(true, finalValue);
        await this.reorderRuleRepository.save(reorderRule);

        // Step 8: Send notifications
        await this.sendNotifications(
          reorderRule,
          reorderCalculation,
          supplierSelection,
          purchaseOrder,
        );

        // Step 9: Emit events
        this.emitAutomationEvents(
          reorderRule,
          purchaseOrder,
          reorderCalculation,
        );

        const executionTime = Date.now() - startTime;

        return {
          success: true,
          executionId: execution.id,
          tenantId: reorderRule.tenantId,
          reorderRuleId: reorderRule.id,
          productId: product.id,
          locationId: inventoryItem.locationId,
          executedAt: new Date(),
          reorderCalculation,
          supplierSelection,
          shouldCreatePurchaseOrder: shouldCreatePO,
          purchaseOrderId,
          purchaseOrder,
          actualQuantity: finalQuantity,
          estimatedValue: finalValue,
          selectedSupplierId: supplierSelection.selectedSupplier.supplierId,
          urgencyLevel: reorderCalculation.urgencyScore,
          requiresApproval: this.requiresApproval(reorderRule, finalValue),
          isAutomaticallyApproved: this.isAutomaticallyApproved(
            reorderRule,
            finalValue,
          ),
          approvalRequired: purchaseOrder
            ? purchaseOrder.requiresApproval
            : false,
          recommendations: this.generateRecommendations(
            reorderCalculation,
            supplierSelection,
          ),
          warnings: this.generateWarnings(
            reorderCalculation,
            supplierSelection,
          ),
          errors: [],
          executionTimeMs: executionTime,
          calculationConfidence: reorderCalculation.confidenceLevel,
          selectionConfidence: supplierSelection.selectionConfidence,
          nextReviewDate: reorderRule.nextReviewDate,
          followUpActions: this.generateFollowUpActions(
            reorderCalculation,
            supplierSelection,
          ),
          riskLevel: this.assessRiskLevel(
            reorderCalculation,
            supplierSelection,
          ),
          riskFactors: [
            ...reorderCalculation.riskMitigationSuggestions,
            ...supplierSelection.riskWarnings,
          ],
          mitigationActions: this.generateMitigationActions(
            reorderCalculation,
            supplierSelection,
          ),
        };
      } catch (error) {
        // Update execution record with error
        await this.updateExecutionRecord(execution, {
          success: false,
          errorMessage: error.message,
        });

        // Update reorder rule with error
        reorderRule.recordExecution(false, 0, error.message);
        await this.reorderRuleRepository.save(reorderRule);

        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Automated purchase execution failed: ${error.message}`,
        error.stack,
      );

      const executionTime = Date.now() - startTime;

      return {
        success: false,
        executionId: 'failed',
        tenantId: request.tenantId,
        reorderRuleId: request.reorderRuleId || 'unknown',
        productId: request.productId || 'unknown',
        locationId: request.locationId,
        executedAt: new Date(),
        reorderCalculation: {} as any,
        supplierSelection: {} as any,
        shouldCreatePurchaseOrder: false,
        actualQuantity: 0,
        estimatedValue: 0,
        urgencyLevel: 0,
        requiresApproval: false,
        isAutomaticallyApproved: false,
        approvalRequired: false,
        recommendations: [],
        warnings: [],
        errors: [error.message],
        executionTimeMs: executionTime,
        calculationConfidence: 0,
        selectionConfidence: 0,
        followUpActions: ['Manual intervention required'],
        riskLevel: 'critical',
        riskFactors: [error.message],
        mitigationActions: [
          'Review automation configuration',
          'Manual purchase order creation may be needed',
        ],
      };
    }
  }

  /**
   * Execute automated purchasing for multiple items
   */
  async executeBulkAutomatedPurchase(
    request: BulkAutomatedPurchaseRequest,
  ): Promise<BulkAutomatedPurchaseResult> {
    const startTime = Date.now();
    const batchId = `batch_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      this.logger.log(
        `Starting bulk automated purchase for tenant ${request.tenantId}`,
      );

      // Get eligible reorder rules
      const reorderRules = await this.getEligibleReorderRules(request);

      const results: AutomatedPurchaseResult[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      // Process in batches to avoid overwhelming the system
      const batchSize = request.options?.batchSize || 10;
      const delayMs = request.options?.delayBetweenOrdersMs || 1000;

      for (let i = 0; i < reorderRules.length; i += batchSize) {
        const batch = reorderRules.slice(i, i + batchSize);

        // Process batch in parallel (but limited concurrency)
        const batchPromises = batch.map(async (rule, index) => {
          try {
            // Add delay between orders
            if (delayMs > 0 && index > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            const result = await this.executeAutomatedPurchase({
              reorderRuleId: rule.id,
              tenantId: rule.tenantId,
              dryRun: request.options?.dryRun,
            });

            if (result.success) {
              if (result.shouldCreatePurchaseOrder) {
                successCount++;
              } else {
                skippedCount++;
              }
            } else {
              failureCount++;
            }

            return result;
          } catch (error) {
            failureCount++;
            errors.push(`Rule ${rule.id}: ${error.message}`);

            return {
              success: false,
              executionId: 'failed',
              tenantId: rule.tenantId,
              reorderRuleId: rule.id,
              productId: rule.productId,
              locationId: rule.locationId,
              executedAt: new Date(),
              errors: [error.message],
              riskLevel: 'critical',
            } as AutomatedPurchaseResult;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Calculate summary
      const summary = this.calculateBulkSummary(results);
      const executionTime = Date.now() - startTime;

      return {
        success: errors.length === 0,
        totalProcessed: results.length,
        successfulOrders: successCount,
        failedOrders: failureCount,
        skippedOrders: skippedCount,
        results,
        summary,
        executedAt: new Date(),
        executionTimeMs: executionTime,
        batchId,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(
        `Bulk automated purchase failed: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        totalProcessed: 0,
        successfulOrders: 0,
        failedOrders: 0,
        skippedOrders: 0,
        results: [],
        summary: {
          totalValue: 0,
          averageOrderValue: 0,
          uniqueSuppliers: 0,
          ordersRequiringApproval: 0,
          highRiskOrders: 0,
        },
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
        batchId,
        errors: [error.message],
        warnings: [],
      };
    }
  }

  /**
   * Check which reorder rules are eligible for execution
   */
  async getEligibleReorderRulesForExecution(
    tenantId: string,
  ): Promise<ReorderRule[]> {
    return this.reorderRuleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.product', 'product')
      .leftJoinAndSelect('rule.location', 'location')
      .where('rule.tenantId = :tenantId', { tenantId })
      .andWhere('rule.isEligibleForExecution = true')
      .andWhere('rule.isDue = true')
      .andWhere('rule.hasRecentErrors = false')
      .orderBy('rule.priority', 'DESC')
      .addOrderBy('rule.urgencyScore', 'DESC')
      .getMany();
  }

  // Helper methods
  private async getReorderRule(
    request: AutomatedPurchaseRequest,
  ): Promise<ReorderRule | null> {
    if (request.reorderRuleId) {
      return this.reorderRuleRepository.findOne({
        where: { id: request.reorderRuleId, tenantId: request.tenantId },
        relations: ['product', 'location', 'primarySupplier'],
      });
    }

    // Find by product and location
    return this.reorderRuleRepository.findOne({
      where: {
        tenantId: request.tenantId,
        productId: request.productId,
        locationId: request.locationId,
        isActive: true,
      },
      relations: ['product', 'location', 'primarySupplier'],
    });
  }

  private async getInventoryAndProduct(reorderRule: ReorderRule): Promise<{
    inventoryItem: InventoryItem;
    product: Product;
  }> {
    const inventoryItem = await this.inventoryItemRepository.findOne({
      where: {
        tenantId: reorderRule.tenantId,
        productId: reorderRule.productId,
        locationId: reorderRule.locationId,
      },
    });

    if (!inventoryItem) {
      throw new Error('Inventory item not found');
    }

    const product =
      reorderRule.product ||
      (await this.productRepository.findOne({
        where: { id: reorderRule.productId, tenantId: reorderRule.tenantId },
      }));

    if (!product) {
      throw new Error('Product not found');
    }

    return { inventoryItem, product };
  }

  private async createExecutionRecord(
    reorderRule: ReorderRule,
  ): Promise<ReorderExecution> {
    const execution = this.reorderExecutionRepository.create({
      reorderRuleId: reorderRule.id,
      executedAt: new Date(),
      success: false, // Will be updated
    });

    return this.reorderExecutionRepository.save(execution);
  }

  private async updateExecutionRecord(
    execution: ReorderExecution,
    updates: Partial<ReorderExecution> & { success: boolean },
  ): Promise<void> {
    Object.assign(execution, updates);
    execution.success = updates.success;
    await this.reorderExecutionRepository.save(execution);
  }

  private calculateDeliveryDeadline(
    reorderCalculation: ReorderCalculationResult,
  ): Date | undefined {
    if (reorderCalculation.daysUntilStockout < 14) {
      // Urgent delivery needed
      return new Date(
        Date.now() + reorderCalculation.daysUntilStockout * 24 * 60 * 60 * 1000,
      );
    }
    return undefined;
  }

  private shouldCreatePurchaseOrder(
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
    reorderRule: ReorderRule,
  ): boolean {
    // Check various conditions
    if (!reorderCalculation.shouldReorderNow) return false;
    if (!supplierSelection.success) return false;
    if (reorderCalculation.recommendedOrderQuantity <= 0) return false;
    if (supplierSelection.selectedSupplier!.totalScore < 50) return false; // Minimum quality threshold

    // Budget check
    if (reorderRule.remainingBudget < Infinity) {
      if (
        supplierSelection.selectedSupplier!.estimatedCost >
        reorderRule.remainingBudget
      ) {
        return false;
      }
    }

    return true;
  }

  private buildPurchaseOrderDto(
    reorderRule: ReorderRule,
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
    overrides?: AutomatedPurchaseRequest['overrides'],
  ): CreatePurchaseOrderDto {
    const selectedSupplier = supplierSelection.selectedSupplier!;
    const quantity =
      overrides?.orderQuantity || reorderCalculation.recommendedOrderQuantity;

    return {
      supplierId: selectedSupplier.supplierId,
      type: PurchaseOrderType.STANDARD,
      priority:
        reorderCalculation.urgencyScore >= 8
          ? PurchaseOrderPriority.URGENT
          : PurchaseOrderPriority.NORMAL,
      description: `Automated reorder for ${reorderRule.product.name}`,
      notes: `Generated by automation rule: ${reorderRule.name}`,
      internalNotes: `Calculation confidence: ${(
        reorderCalculation.confidenceLevel * 100
      ).toFixed(1)}%, Selection confidence: ${(
        supplierSelection.selectionConfidence * 100
      ).toFixed(1)}%`,
      items: [
        {
          productId: reorderRule.productId,
          sku: reorderRule.product.sku || 'AUTO-GENERATED',
          productName: reorderRule.product.name,
          orderedQuantity: quantity,
          unitPrice: selectedSupplier.evaluationDetails.averageUnitCost,
          notes: `Reorder point: ${reorderCalculation.recommendedReorderPoint}, Current stock: ${reorderCalculation.currentStock}`,
        },
      ],
      expectedDeliveryDate:
        supplierSelection.predictedDeliveryDate?.toISOString(),
      requestedDeliveryDate:
        supplierSelection.predictedDeliveryDate?.toISOString(),
      paymentTerms: selectedSupplier.evaluationDetails.paymentTerms as any,
      // requiresApproval: overrides?.skipApproval ? false : this.requiresApproval(reorderRule, selectedSupplier.estimatedCost),
    };
  }

  private requiresApproval(
    reorderRule: ReorderRule,
    orderValue: number,
  ): boolean {
    if (!reorderRule.requiresApproval) return false;
    if (
      reorderRule.autoApprovalThreshold &&
      orderValue <= reorderRule.autoApprovalThreshold
    )
      return false;
    return true;
  }

  private isAutomaticallyApproved(
    reorderRule: ReorderRule,
    orderValue: number,
  ): boolean {
    if (!reorderRule.isFullyAutomated) return false;
    if (
      reorderRule.autoApprovalThreshold &&
      orderValue <= reorderRule.autoApprovalThreshold
    )
      return true;
    return false;
  }

  private async handleApprovalWorkflow(
    purchaseOrder: PurchaseOrder,
    reorderRule: ReorderRule,
    reorderCalculation: ReorderCalculationResult,
  ): Promise<void> {
    if (this.isAutomaticallyApproved(reorderRule, purchaseOrder.totalAmount)) {
      // Auto-approve the order
      await this.purchaseOrdersService.approve(
        reorderRule.tenantId,
        purchaseOrder.id,
        {
          comments: 'Automatically approved by automation system',
        },
        'automation-system',
      );
    }
  }

  private generateTriggerReason(
    reorderCalculation: ReorderCalculationResult,
  ): string {
    const reasons = [];

    if (
      reorderCalculation.currentStock <=
      reorderCalculation.recommendedReorderPoint
    ) {
      reasons.push('Stock below reorder point');
    }

    if (reorderCalculation.urgencyScore >= 8) {
      reasons.push('Critical stock level detected');
    }

    if (reorderCalculation.daysUntilStockout <= 7) {
      reasons.push(
        `Stockout predicted in ${Math.round(
          reorderCalculation.daysUntilStockout,
        )} days`,
      );
    }

    return reasons.join(', ') || 'Automated reorder trigger';
  }

  private generateRecommendations(
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
  ): string[] {
    const recommendations = [];

    // Add insights from calculations
    reorderCalculation.insights
      .filter(insight => insight.type === 'info' || insight.type === 'success')
      .forEach(insight => recommendations.push(insight.message));

    // Add supplier advantages
    if (supplierSelection.selectedSupplier?.advantages) {
      supplierSelection.selectedSupplier.advantages.forEach(advantage =>
        recommendations.push(`Supplier advantage: ${advantage}`),
      );
    }

    return recommendations;
  }

  private generateWarnings(
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
  ): string[] {
    const warnings = [];

    // Add insights as warnings
    reorderCalculation.insights
      .filter(insight => insight.type === 'warning')
      .forEach(insight => warnings.push(insight.message));

    // Add supplier risk warnings
    warnings.push(...supplierSelection.riskWarnings);

    return warnings;
  }

  private generateFollowUpActions(
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
  ): string[] {
    const actions = [];

    if (reorderCalculation.urgencyScore >= 8) {
      actions.push('Monitor delivery closely due to urgency');
    }

    if (reorderCalculation.confidenceLevel < 0.7) {
      actions.push('Review and improve demand data quality');
    }

    if (supplierSelection.selectionConfidence < 0.7) {
      actions.push('Consider establishing stronger supplier relationships');
    }

    return actions;
  }

  private assessRiskLevel(
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (
      reorderCalculation.urgencyScore >= 9 ||
      reorderCalculation.stockoutRisk > 0.8
    ) {
      return 'critical';
    }

    if (
      reorderCalculation.urgencyScore >= 7 ||
      reorderCalculation.stockoutRisk > 0.5
    ) {
      return 'high';
    }

    if (
      reorderCalculation.urgencyScore >= 5 ||
      reorderCalculation.confidenceLevel < 0.6
    ) {
      return 'medium';
    }

    return 'low';
  }

  private generateMitigationActions(
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
  ): string[] {
    const actions = [];

    if (reorderCalculation.stockoutRisk > 0.5) {
      actions.push('Consider expedited shipping');
      actions.push('Identify alternative suppliers for emergency orders');
    }

    if (reorderCalculation.overstockRisk > 0.5) {
      actions.push('Review demand forecasting accuracy');
      actions.push('Consider reducing future order quantities');
    }

    return actions;
  }

  private async sendNotifications(
    reorderRule: ReorderRule,
    reorderCalculation: ReorderCalculationResult,
    supplierSelection: SupplierSelectionResult,
    purchaseOrder?: PurchaseOrder,
  ): Promise<void> {
    if (!reorderRule.sendNotifications) return;

    const severity =
      reorderCalculation.urgencyScore >= 8
        ? AlertSeverity.CRITICAL
        : AlertSeverity.WARNING;
    const title = purchaseOrder
      ? `Automated Purchase Order Created: ${purchaseOrder.poNumber}`
      : 'Automated Reorder Analysis Complete';

    const message = purchaseOrder
      ? `Purchase order ${purchaseOrder.poNumber} created automatically for ${reorderRule.product.name}. Quantity: ${reorderCalculation.recommendedOrderQuantity}, Supplier: ${supplierSelection.selectedSupplier?.supplier.name}`
      : `Reorder analysis completed for ${reorderRule.product.name}. ${
          reorderCalculation.shouldReorderNow
            ? 'Reorder recommended'
            : 'No action needed'
        }.`;

    await this.alertManagementService.createAlert(
      reorderRule.tenantId,
      AlertType.REORDER_NEEDED,
      severity,
      title,
      message,
      {
        reorderRuleId: reorderRule.id,
        productId: reorderRule.productId,
        purchaseOrderId: purchaseOrder?.id,
        urgencyScore: reorderCalculation.urgencyScore,
        recommendedQuantity: reorderCalculation.recommendedOrderQuantity,
      },
      reorderRule.productId,
      reorderRule.locationId,
    );
  }

  private emitAutomationEvents(
    reorderRule: ReorderRule,
    purchaseOrder: PurchaseOrder | undefined,
    reorderCalculation: ReorderCalculationResult,
  ): void {
    if (purchaseOrder) {
      this.eventEmitter.emit('automation.purchase-order.created', {
        tenantId: reorderRule.tenantId,
        reorderRuleId: reorderRule.id,
        purchaseOrderId: purchaseOrder.id,
        productId: reorderRule.productId,
        urgencyScore: reorderCalculation.urgencyScore,
      });
    }

    this.eventEmitter.emit('automation.reorder.executed', {
      tenantId: reorderRule.tenantId,
      reorderRuleId: reorderRule.id,
      productId: reorderRule.productId,
      success: !!purchaseOrder,
      urgencyScore: reorderCalculation.urgencyScore,
    });
  }

  private createSkippedResult(
    execution: ReorderExecution,
    reorderCalculation: ReorderCalculationResult,
    reason: string,
  ): AutomatedPurchaseResult {
    return {
      success: true,
      executionId: execution.id,
      tenantId: execution.tenantId,
      reorderRuleId: execution.reorderRuleId,
      productId: 'unknown',
      executedAt: new Date(),
      reorderCalculation,
      supplierSelection: {} as any,
      shouldCreatePurchaseOrder: false,
      actualQuantity: 0,
      estimatedValue: 0,
      urgencyLevel: reorderCalculation.urgencyScore,
      requiresApproval: false,
      isAutomaticallyApproved: false,
      approvalRequired: false,
      recommendations: [reason],
      warnings: [],
      errors: [],
      executionTimeMs: 0,
      calculationConfidence: reorderCalculation.confidenceLevel,
      selectionConfidence: 0,
      followUpActions: [],
      riskLevel: 'low',
      riskFactors: [],
      mitigationActions: [],
    };
  }

  private async getEligibleReorderRules(
    request: BulkAutomatedPurchaseRequest,
  ): Promise<ReorderRule[]> {
    let query = this.reorderRuleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.product', 'product')
      .leftJoinAndSelect('rule.location', 'location')
      .where('rule.tenantId = :tenantId', { tenantId: request.tenantId })
      .andWhere('rule.isActive = true')
      .andWhere('rule.isPaused = false');

    if (request.reorderRuleIds?.length) {
      query = query.andWhere('rule.id IN (:...ids)', {
        ids: request.reorderRuleIds,
      });
    }

    if (request.productIds?.length) {
      query = query.andWhere('rule.productId IN (:...productIds)', {
        productIds: request.productIds,
      });
    }

    if (request.locationIds?.length) {
      query = query.andWhere('rule.locationId IN (:...locationIds)', {
        locationIds: request.locationIds,
      });
    }

    return query.getMany();
  }

  private calculateBulkSummary(
    results: AutomatedPurchaseResult[],
  ): BulkAutomatedPurchaseResult['summary'] {
    const successfulResults = results.filter(
      r => r.success && r.shouldCreatePurchaseOrder,
    );

    const totalValue = successfulResults.reduce(
      (sum, r) => sum + r.estimatedValue,
      0,
    );
    const averageOrderValue =
      successfulResults.length > 0 ? totalValue / successfulResults.length : 0;

    const uniqueSuppliers = new Set(
      successfulResults.map(r => r.selectedSupplierId),
    ).size;
    const ordersRequiringApproval = successfulResults.filter(
      r => r.requiresApproval,
    ).length;
    const highRiskOrders = results.filter(
      r => r.riskLevel === 'high' || r.riskLevel === 'critical',
    ).length;

    return {
      totalValue,
      averageOrderValue,
      uniqueSuppliers,
      ordersRequiringApproval,
      highRiskOrders,
    };
  }
}
