import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  In,
  IsNull,
  Not,
  SelectQueryBuilder,
} from 'typeorm';

import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import {
  InventoryTransaction,
  TransactionType,
} from '../../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { Product } from '../../products/entities/product.entity';

import {
  BaseReportQueryDto,
  InventoryValuationQueryDto,
  StockMovementQueryDto,
  LowStockQueryDto,
  ProductPerformanceQueryDto,
  StockMovementType,
  GroupByOption,
} from '../dto/report-query.dto';

import {
  InventoryValuationResponseDto,
  InventoryValuationItemDto,
  StockMovementResponseDto,
  StockMovementItemDto,
  LowStockResponseDto,
  LowStockItemDto,
  ProductPerformanceResponseDto,
  ProductPerformanceItemDto,
  ReportMetaDto,
} from '../dto/report-response.dto';

@Injectable()
export class ReportGenerationService {
  private readonly logger = new Logger(ReportGenerationService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Generate Inventory Valuation Report
   */
  async generateInventoryValuationReport(
    tenantId: string,
    query: InventoryValuationQueryDto,
  ): Promise<InventoryValuationResponseDto> {
    const startTime = Date.now();

    try {
      const queryBuilder = this.inventoryItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .leftJoinAndSelect('item.location', 'location')
        .leftJoinAndSelect('product.category', 'category')
        .where('item.tenantId = :tenantId', { tenantId })
        .andWhere('item.isActive = true');

      // Apply filters
      this.applyCommonFilters(queryBuilder, query, 'item');

      if (query.activeProductsOnly) {
        queryBuilder.andWhere('product.status = :status', { status: 'active' });
      }

      if (!query.includeZeroValue) {
        queryBuilder.andWhere(
          '(item.quantityOnHand > 0 OR item.totalValue > 0)',
        );
      }

      // Apply pagination
      const offset = (query.page - 1) * query.limit;
      queryBuilder.skip(offset).take(query.limit);

      // Execute query
      const [items, total] = await queryBuilder.getManyAndCount();

      // Transform to response format
      const data: InventoryValuationItemDto[] = items.map(item => ({
        productId: item.productId,
        sku: item.product?.sku || '',
        productName: item.product?.name || '',
        category: item.product?.category?.name,
        locationId: item.locationId,
        locationName: item.location?.name || '',
        quantityOnHand: item.quantityOnHand,
        quantityAvailable: item.quantityAvailable,
        averageCost: Number(item.averageCost),
        sellingPrice: Number(item.product?.sellingPrice || 0),
        totalCostValue: Number(item.totalValue),
        totalSellingValue:
          item.quantityOnHand * Number(item.product?.sellingPrice || 0),
        potentialProfit:
          item.quantityOnHand * Number(item.product?.sellingPrice || 0) -
          Number(item.totalValue),
        lastMovementAt: item.lastMovementAt?.toISOString(),
        daysSinceLastMovement: item.lastMovementAt
          ? Math.floor(
              (Date.now() - item.lastMovementAt.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : undefined,
      }));

      // Calculate summary
      const summary = {
        totalItems: total,
        totalCostValue: data.reduce(
          (sum, item) => sum + item.totalCostValue,
          0,
        ),
        totalSellingValue: data.reduce(
          (sum, item) => sum + item.totalSellingValue,
          0,
        ),
        totalPotentialProfit: data.reduce(
          (sum, item) => sum + item.potentialProfit,
          0,
        ),
        averageDaysSinceMovement: data
          .filter(item => item.daysSinceLastMovement !== undefined)
          .reduce(
            (sum, item, _, arr) =>
              sum + item.daysSinceLastMovement! / arr.length,
            0,
          ),
      };

      const meta: ReportMetaDto = {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
      };

      return { data, meta, summary };
    } catch (error) {
      this.logger.error(
        `Error generating inventory valuation report: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Failed to generate inventory valuation report',
      );
    }
  }

  /**
   * Generate Stock Movement Report
   */
  async generateStockMovementReport(
    tenantId: string,
    query: StockMovementQueryDto,
  ): Promise<StockMovementResponseDto> {
    const startTime = Date.now();

    try {
      const queryBuilder = this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoinAndSelect('transaction.product', 'product')
        .leftJoinAndSelect('transaction.location', 'location')
        .leftJoinAndSelect('transaction.processor', 'processor')
        .where('transaction.tenantId = :tenantId', { tenantId });

      // Apply filters
      this.applyCommonFilters(queryBuilder, query, 'transaction');

      // Apply date range
      if (query.startDate || query.endDate) {
        const startDate = query.startDate
          ? new Date(query.startDate)
          : new Date('1900-01-01');
        const endDate = query.endDate ? new Date(query.endDate) : new Date();
        queryBuilder.andWhere(
          'transaction.transactionDate BETWEEN :startDate AND :endDate',
          {
            startDate,
            endDate,
          },
        );
      }

      // Filter by movement type
      if (query.movementType && query.movementType !== StockMovementType.ALL) {
        const transactionTypes = this.getTransactionTypesByMovementType(
          query.movementType,
        );
        queryBuilder.andWhere('transaction.type IN (:...types)', {
          types: transactionTypes,
        });
      }

      // Filter cancelled transactions
      if (!query.includeCancelled) {
        queryBuilder.andWhere('transaction.status != :cancelledStatus', {
          cancelledStatus: 'cancelled',
        });
      }

      // Apply pagination and ordering
      const offset = (query.page - 1) * query.limit;
      queryBuilder
        .orderBy('transaction.transactionDate', 'DESC')
        .skip(offset)
        .take(query.limit);

      // Execute query
      const [transactions, total] = await queryBuilder.getManyAndCount();

      // Transform to response format
      const data: StockMovementItemDto[] = transactions.map(transaction => ({
        transactionId: transaction.id,
        transactionDate: transaction.transactionDate.toISOString(),
        productId: transaction.productId,
        sku: transaction.product?.sku || '',
        productName: transaction.product?.name || '',
        locationId: transaction.locationId,
        locationName: transaction.location?.name || '',
        transactionType: transaction.type,
        quantity: transaction.quantity,
        quantityBefore: transaction.quantityBefore,
        quantityAfter: transaction.quantityAfter,
        unitCost: transaction.unitCost
          ? Number(transaction.unitCost)
          : undefined,
        totalCost: transaction.totalCost
          ? Number(transaction.totalCost)
          : undefined,
        reason: transaction.reason,
        referenceNumber: transaction.referenceNumber,
        createdBy: transaction.createdBy,
      }));

      // Calculate summary
      const summary = await this.calculateStockMovementSummary(tenantId, query);

      const meta: ReportMetaDto = {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
      };

      return { data, meta, summary };
    } catch (error) {
      this.logger.error(
        `Error generating stock movement report: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to generate stock movement report');
    }
  }

  /**
   * Generate Low Stock Report
   */
  async generateLowStockReport(
    tenantId: string,
    query: LowStockQueryDto,
  ): Promise<LowStockResponseDto> {
    const startTime = Date.now();

    try {
      const queryBuilder = this.inventoryItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .leftJoinAndSelect('item.location', 'location')
        .leftJoinAndSelect('product.category', 'category')
        .where('item.tenantId = :tenantId', { tenantId })
        .andWhere('item.isActive = true')
        .andWhere('product.trackStock = true');

      // Apply filters
      this.applyCommonFilters(queryBuilder, query, 'item');

      // Build low stock conditions
      const conditions = [];

      if (query.includeOutOfStock) {
        conditions.push(
          '(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= 0',
        );
      }

      if (query.includeReorderNeeded) {
        conditions.push(
          '(item.reorderPoint IS NOT NULL AND item.quantityOnHand <= item.reorderPoint)',
        );
        conditions.push(
          '(item.reorderPoint IS NULL AND product.reorderPoint IS NOT NULL AND item.quantityOnHand <= product.reorderPoint)',
        );
      }

      if (conditions.length > 0) {
        queryBuilder.andWhere(`(${conditions.join(' OR ')})`);
      }

      // Apply pagination
      const offset = (query.page - 1) * query.limit;
      queryBuilder
        .orderBy(
          '(item.quantityOnHand - item.quantityReserved - item.quantityAllocated)',
          'ASC',
        )
        .skip(offset)
        .take(query.limit);

      // Execute query
      const [items, total] = await queryBuilder.getManyAndCount();

      // Transform to response format with additional calculations
      const data: LowStockItemDto[] = await Promise.all(
        items.map(async item => {
          const reorderPoint =
            item.reorderPoint || item.product?.reorderPoint || 0;
          const reorderQuantity =
            item.reorderQuantity || item.product?.reorderQuantity || 0;
          const maxStock = item.maxStock || item.product?.maxStock;

          // Calculate average daily sales and days of stock
          const dailySales = await this.calculateAverageDailySales(
            tenantId,
            item.productId,
            item.locationId,
          );
          const daysOfStock =
            dailySales > 0
              ? Math.floor(item.quantityAvailable / dailySales)
              : undefined;

          // Determine stock status
          const stockStatus = this.determineStockStatus(
            item.quantityAvailable,
            reorderPoint,
          );

          // Calculate suggested reorder quantity
          const suggestedReorderQuantity =
            this.calculateSuggestedReorderQuantity(
              item.quantityAvailable,
              reorderPoint,
              reorderQuantity,
              maxStock,
              dailySales,
            );

          // Get last sale information
          const lastSaleInfo = await this.getLastSaleInfo(
            tenantId,
            item.productId,
            item.locationId,
          );

          return {
            productId: item.productId,
            sku: item.product?.sku || '',
            productName: item.product?.name || '',
            category: item.product?.category?.name,
            locationId: item.locationId,
            locationName: item.location?.name || '',
            quantityAvailable: item.quantityAvailable,
            reorderPoint,
            reorderQuantity,
            maxStock,
            averageDailySales: dailySales,
            daysOfStockRemaining: daysOfStock,
            stockStatus,
            suggestedReorderQuantity,
            lastSaleDate: lastSaleInfo?.lastSaleDate,
            daysSinceLastSale: lastSaleInfo?.daysSinceLastSale,
          };
        }),
      );

      // Calculate summary
      const summary = {
        totalItems: total,
        outOfStock: data.filter(item => item.stockStatus === 'out_of_stock')
          .length,
        critical: data.filter(item => item.stockStatus === 'critical').length,
        low: data.filter(item => item.stockStatus === 'low').length,
        reorderNeeded: data.filter(
          item => item.stockStatus === 'reorder_needed',
        ).length,
        totalReorderValue: data.reduce((sum, item) => {
          const product = items.find(
            i => i.productId === item.productId,
          )?.product;
          return (
            sum +
            item.suggestedReorderQuantity * Number(product?.costPrice || 0)
          );
        }, 0),
      };

      const meta: ReportMetaDto = {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
      };

      return { data, meta, summary };
    } catch (error) {
      this.logger.error(
        `Error generating low stock report: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to generate low stock report');
    }
  }

  /**
   * Generate Product Performance Report
   */
  async generateProductPerformanceReport(
    tenantId: string,
    query: ProductPerformanceQueryDto,
  ): Promise<ProductPerformanceResponseDto> {
    const startTime = Date.now();

    try {
      // Build complex query for product performance
      const performanceQuery = `
        WITH product_sales AS (
          SELECT 
            p.id as product_id,
            p.sku,
            p.name as product_name,
            pc.name as category,
            COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.quantity ELSE 0 END), 0) as total_quantity_sold,
            COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.total_cost ELSE 0 END), 0) as total_sales_value,
            COALESCE(SUM(CASE WHEN t.type IN ('receipt', 'transfer_in', 'adjustment_positive') THEN t.quantity ELSE 0 END), 0) as total_quantity_received,
            COALESCE(SUM(CASE WHEN t.type IN ('receipt', 'transfer_in', 'adjustment_positive') THEN t.total_cost ELSE 0 END), 0) as total_purchase_cost,
            COUNT(CASE WHEN t.type = 'sale' THEN 1 END) as transaction_count,
            MIN(CASE WHEN t.type = 'sale' THEN t.transaction_date END) as first_sale_date,
            MAX(CASE WHEN t.type = 'sale' THEN t.transaction_date END) as last_sale_date
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          LEFT JOIN inventory_transactions t ON p.id = t.product_id AND t.tenant_id = :tenantId
          WHERE p.tenant_id = :tenantId
            ${
              query.startDate
                ? 'AND (t.transaction_date IS NULL OR t.transaction_date >= :startDate)'
                : ''
            }
            ${
              query.endDate
                ? 'AND (t.transaction_date IS NULL OR t.transaction_date <= :endDate)'
                : ''
            }
            ${query.productIds?.length ? 'AND p.id IN (:...productIds)' : ''}
            ${
              query.categoryIds?.length
                ? 'AND p.category_id IN (:...categoryIds)'
                : ''
            }
            ${!query.includeInactive ? "AND p.status = 'active'" : ''}
          GROUP BY p.id, p.sku, p.name, pc.name
          HAVING COUNT(CASE WHEN t.type = 'sale' THEN 1 END) >= :minTransactions
        ),
        product_inventory AS (
          SELECT 
            product_id,
            SUM(quantity_on_hand) as current_stock_level
          FROM inventory_items
          WHERE tenant_id = :tenantId AND is_active = true
          GROUP BY product_id
        )
        SELECT 
          ps.*,
          COALESCE(pi.current_stock_level, 0) as current_stock_level
        FROM product_sales ps
        LEFT JOIN product_inventory pi ON ps.product_id = pi.product_id
        ORDER BY ps.total_sales_value DESC
        LIMIT :limit OFFSET :offset
      `;

      const parameters = {
        tenantId,
        minTransactions: query.minTransactions,
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        ...(query.startDate && { startDate: new Date(query.startDate) }),
        ...(query.endDate && { endDate: new Date(query.endDate) }),
        ...(query.productIds?.length && { productIds: query.productIds }),
        ...(query.categoryIds?.length && { categoryIds: query.categoryIds }),
      };

      const rawResults = await this.productRepository.query(
        performanceQuery,
        Object.values(parameters),
      );

      // Transform to response format
      const data: ProductPerformanceItemDto[] = rawResults.map(
        (row: any, index: number) => {
          const totalSalesValue = Number(row.total_sales_value);
          const totalPurchaseCost = Number(row.total_purchase_cost);
          const grossProfit = totalSalesValue - totalPurchaseCost;
          const grossProfitMargin =
            totalSalesValue > 0 ? (grossProfit / totalSalesValue) * 100 : 0;

          // Calculate inventory turnover (COGS / Average Inventory)
          const cogs = totalPurchaseCost;
          const averageInventory = Number(row.current_stock_level) * 0.5; // Simplified calculation
          const inventoryTurnover =
            averageInventory > 0 ? cogs / averageInventory : 0;
          const daysInInventory =
            inventoryTurnover > 0 ? 365 / inventoryTurnover : 0;

          // Determine performance category
          const performanceCategory = this.categorizePerformance(
            totalSalesValue,
            grossProfitMargin,
            inventoryTurnover,
          );

          return {
            productId: row.product_id,
            sku: row.sku,
            productName: row.product_name,
            category: row.category,
            totalQuantitySold: Number(row.total_quantity_sold),
            totalSalesValue,
            totalQuantityReceived: Number(row.total_quantity_received),
            totalPurchaseCost,
            grossProfit,
            grossProfitMargin,
            transactionCount: Number(row.transaction_count),
            currentStockLevel: Number(row.current_stock_level),
            inventoryTurnover,
            daysInInventory,
            firstSaleDate: row.first_sale_date?.toISOString(),
            lastSaleDate: row.last_sale_date?.toISOString(),
            averageSalePrice:
              Number(row.total_quantity_sold) > 0
                ? totalSalesValue / Number(row.total_quantity_sold)
                : 0,
            averageSaleQuantity:
              Number(row.transaction_count) > 0
                ? Number(row.total_quantity_sold) /
                  Number(row.transaction_count)
                : 0,
            performanceRank: index + 1,
            performanceCategory,
          };
        },
      );

      // Get total count
      const countQuery = performanceQuery.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM',
      );
      const totalResult = await this.productRepository.query(
        countQuery,
        Object.values(parameters),
      );
      const total = Number(totalResult[0]?.total || 0);

      // Calculate summary
      const summary = {
        totalProducts: total,
        highPerformers: data.filter(item => item.performanceCategory === 'high')
          .length,
        mediumPerformers: data.filter(
          item => item.performanceCategory === 'medium',
        ).length,
        lowPerformers: data.filter(item => item.performanceCategory === 'low')
          .length,
        slowMoving: data.filter(
          item => item.performanceCategory === 'slow_moving',
        ).length,
        totalSalesValue: data.reduce(
          (sum, item) => sum + item.totalSalesValue,
          0,
        ),
        totalGrossProfit: data.reduce((sum, item) => sum + item.grossProfit, 0),
        averageGrossProfitMargin:
          data.length > 0
            ? data.reduce((sum, item) => sum + item.grossProfitMargin, 0) /
              data.length
            : 0,
        averageInventoryTurnover:
          data.length > 0
            ? data.reduce((sum, item) => sum + item.inventoryTurnover, 0) /
              data.length
            : 0,
      };

      const meta: ReportMetaDto = {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        generatedAt: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        parameters: query,
      };

      return { data, meta, summary };
    } catch (error) {
      this.logger.error(
        `Error generating product performance report: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Failed to generate product performance report',
      );
    }
  }

  // Helper methods

  private applyCommonFilters(
    queryBuilder: SelectQueryBuilder<any>,
    query: BaseReportQueryDto,
    alias: string,
  ): void {
    if (query.locationIds?.length) {
      queryBuilder.andWhere(`${alias}.locationId IN (:...locationIds)`, {
        locationIds: query.locationIds,
      });
    }

    if (query.productIds?.length) {
      queryBuilder.andWhere(`${alias}.productId IN (:...productIds)`, {
        productIds: query.productIds,
      });
    }

    if (query.categoryIds?.length) {
      queryBuilder.andWhere('product.categoryId IN (:...categoryIds)', {
        categoryIds: query.categoryIds,
      });
    }
  }

  private getTransactionTypesByMovementType(
    movementType: StockMovementType,
  ): TransactionType[] {
    switch (movementType) {
      case StockMovementType.RECEIPTS:
        return [
          TransactionType.RECEIPT,
          TransactionType.TRANSFER_IN,
          TransactionType.ADJUSTMENT_POSITIVE,
        ];
      case StockMovementType.ISSUES:
        return [
          TransactionType.ISSUE,
          TransactionType.SALE,
          TransactionType.TRANSFER_OUT,
          TransactionType.ADJUSTMENT_NEGATIVE,
        ];
      case StockMovementType.TRANSFERS:
        return [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT];
      case StockMovementType.ADJUSTMENTS:
        return [
          TransactionType.ADJUSTMENT_POSITIVE,
          TransactionType.ADJUSTMENT_NEGATIVE,
        ];
      default:
        return Object.values(TransactionType);
    }
  }

  private async calculateStockMovementSummary(
    tenantId: string,
    query: StockMovementQueryDto,
  ): Promise<any> {
    const summaryQuery = this.transactionRepository
      .createQueryBuilder('transaction')
      .select([
        'transaction.type',
        'COUNT(*) as count',
        'SUM(transaction.quantity) as total_quantity',
        'SUM(transaction.totalCost) as total_value',
      ])
      .where('transaction.tenantId = :tenantId', { tenantId })
      .groupBy('transaction.type');

    if (query.startDate || query.endDate) {
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date('1900-01-01');
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      summaryQuery.andWhere(
        'transaction.transactionDate BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    }

    const results = await summaryQuery.getRawMany();

    const receipts = { count: 0, totalQuantity: 0, totalValue: 0 };
    const issues = { count: 0, totalQuantity: 0, totalValue: 0 };
    const transfers = { count: 0, totalQuantity: 0 };
    const adjustments = { count: 0, totalQuantity: 0 };

    results.forEach(result => {
      const count = Number(result.count);
      const quantity = Number(result.total_quantity);
      const value = Number(result.total_value || 0);

      if (
        [
          TransactionType.RECEIPT,
          TransactionType.TRANSFER_IN,
          TransactionType.ADJUSTMENT_POSITIVE,
        ].includes(result.transaction_type)
      ) {
        receipts.count += count;
        receipts.totalQuantity += quantity;
        receipts.totalValue += value;
      } else if (
        [
          TransactionType.ISSUE,
          TransactionType.SALE,
          TransactionType.TRANSFER_OUT,
          TransactionType.ADJUSTMENT_NEGATIVE,
        ].includes(result.transaction_type)
      ) {
        issues.count += count;
        issues.totalQuantity += quantity;
        issues.totalValue += value;
      }

      if (
        [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT].includes(
          result.transaction_type,
        )
      ) {
        transfers.count += count;
        transfers.totalQuantity += quantity;
      }

      if (
        [
          TransactionType.ADJUSTMENT_POSITIVE,
          TransactionType.ADJUSTMENT_NEGATIVE,
        ].includes(result.transaction_type)
      ) {
        adjustments.count += count;
        adjustments.totalQuantity += quantity;
      }
    });

    return {
      totalMovements: results.reduce((sum, r) => sum + Number(r.count), 0),
      receipts,
      issues,
      transfers,
      adjustments,
    };
  }

  private async calculateAverageDailySales(
    tenantId: string,
    productId: string,
    locationId: string,
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.quantity)', 'total_sales')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.locationId = :locationId', { locationId })
      .andWhere('transaction.type = :type', { type: TransactionType.SALE })
      .andWhere('transaction.transactionDate >= :startDate', {
        startDate: thirtyDaysAgo,
      })
      .getRawOne();

    const totalSales = Number(result?.total_sales || 0);
    return totalSales / 30; // Average daily sales over 30 days
  }

  private determineStockStatus(
    quantityAvailable: number,
    reorderPoint: number,
  ): 'out_of_stock' | 'critical' | 'low' | 'reorder_needed' {
    if (quantityAvailable <= 0) {
      return 'out_of_stock';
    } else if (quantityAvailable <= reorderPoint * 0.25) {
      return 'critical';
    } else if (quantityAvailable <= reorderPoint * 0.5) {
      return 'low';
    } else {
      return 'reorder_needed';
    }
  }

  private calculateSuggestedReorderQuantity(
    currentQuantity: number,
    reorderPoint: number,
    reorderQuantity: number,
    maxStock?: number,
    dailySales?: number,
  ): number {
    // If we have daily sales data, use EOQ-like calculation
    if (dailySales && dailySales > 0) {
      const leadTimeDays = 7; // Assume 7 days lead time
      const safetyStock = dailySales * 3; // 3 days safety stock
      const optimalQuantity =
        dailySales * leadTimeDays + safetyStock - currentQuantity;

      if (maxStock) {
        return Math.min(
          Math.max(optimalQuantity, 0),
          maxStock - currentQuantity,
        );
      }

      return Math.max(optimalQuantity, 0);
    }

    // Fallback to simple reorder quantity
    if (reorderQuantity > 0) {
      const neededQuantity = reorderPoint - currentQuantity + reorderQuantity;

      if (maxStock) {
        return Math.min(
          Math.max(neededQuantity, 0),
          maxStock - currentQuantity,
        );
      }

      return Math.max(neededQuantity, 0);
    }

    // Default minimum reorder
    return Math.max(reorderPoint - currentQuantity, 0);
  }

  private async getLastSaleInfo(
    tenantId: string,
    productId: string,
    locationId: string,
  ): Promise<{ lastSaleDate?: string; daysSinceLastSale?: number }> {
    const lastSale = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.locationId = :locationId', { locationId })
      .andWhere('transaction.type = :type', { type: TransactionType.SALE })
      .orderBy('transaction.transactionDate', 'DESC')
      .getOne();

    if (lastSale) {
      const daysSince = Math.floor(
        (Date.now() - lastSale.transactionDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        lastSaleDate: lastSale.transactionDate.toISOString(),
        daysSinceLastSale: daysSince,
      };
    }

    return {};
  }

  private categorizePerformance(
    salesValue: number,
    profitMargin: number,
    turnover: number,
  ): 'high' | 'medium' | 'low' | 'slow_moving' {
    // High performers: High sales, good margin, good turnover
    if (salesValue > 1000000 && profitMargin > 20 && turnover > 6) {
      return 'high';
    }

    // Slow moving: Low turnover regardless of other metrics
    if (turnover < 2) {
      return 'slow_moving';
    }

    // Medium performers: Decent metrics
    if (salesValue > 100000 || profitMargin > 15 || turnover > 4) {
      return 'medium';
    }

    // Low performers: Below average metrics
    return 'low';
  }
}
