import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';

import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryLocation } from '../entities/inventory-location.entity';
import { Product } from '../../products/entities/product.entity';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { InventoryQueryDto, SortOrder } from '../dto/inventory-query.dto';
import { StockAdjustmentDto, BulkStockAdjustmentDto, AdjustmentType } from '../dto/stock-adjustment.dto';

import { InventoryTransactionsService } from './inventory-transactions.service';
import { InventoryRealtimeService } from './inventory-realtime.service';

@Injectable()
export class InventoryItemsService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly transactionsService: InventoryTransactionsService,
    private readonly realtimeService: InventoryRealtimeService,
  ) {}

  /**
   * Buat inventory item baru
   */
  async create(
    tenantId: string,
    createInventoryItemDto: CreateInventoryItemDto,
    userId: string,
  ): Promise<InventoryItem> {
    // Validasi produk exists
    const product = await this.validateProduct(tenantId, createInventoryItemDto.productId);

    // Validasi lokasi exists
    const location = await this.validateLocation(tenantId, createInventoryItemDto.locationId);

    // Cek apakah kombinasi product-location sudah ada
    const existingItem = await this.inventoryItemRepository.findOne({
      where: {
        tenantId,
        productId: createInventoryItemDto.productId,
        locationId: createInventoryItemDto.locationId,
      },
    });

    if (existingItem) {
      throw new ConflictException('Inventory item untuk produk di lokasi ini sudah ada');
    }

    // Calculate total value
    const averageCost = createInventoryItemDto.averageCost || product.costPrice || 0;
    const totalValue = createInventoryItemDto.quantityOnHand * averageCost;

    const inventoryItem = this.inventoryItemRepository.create({
      ...createInventoryItemDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
      averageCost,
      totalValue,
      lastMovementAt: new Date(),
    });

    const savedItem = await this.inventoryItemRepository.save(inventoryItem);

    // Create initial transaction if quantity > 0
    if (createInventoryItemDto.quantityOnHand > 0) {
      await this.transactionsService.createInitialStockTransaction(
        tenantId,
        savedItem,
        createInventoryItemDto.quantityOnHand,
        averageCost,
        userId,
      );
    }

    // Emit real-time update
    await this.realtimeService.emitInventoryUpdate(tenantId, savedItem);

    return await this.findOne(tenantId, savedItem.id);
  }

  /**
   * Dapatkan semua inventory items dengan filter dan pagination
   */
  async findAll(
    tenantId: string,
    query: InventoryQueryDto,
  ): Promise<{
    data: InventoryItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      locationId,
      productId,
      categoryId,
      search,
      minQuantity,
      maxQuantity,
      lowStock,
      outOfStock,
      expiringSoon,
      expired,
      isActive,
      lotNumber,
      batchNumber,
      sortBy = 'product.name',
      sortOrder = SortOrder.ASC,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.inventoryItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.location', 'location')
      .leftJoinAndSelect('product.category', 'category')
      .where('item.tenantId = :tenantId', { tenantId });

    // Apply filters
    if (locationId) {
      queryBuilder.andWhere('item.locationId = :locationId', { locationId });
    }

    if (productId) {
      queryBuilder.andWhere('item.productId = :productId', { productId });
    }

    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (minQuantity !== undefined) {
      queryBuilder.andWhere('(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) >= :minQuantity', {
        minQuantity,
      });
    }

    if (maxQuantity !== undefined) {
      queryBuilder.andWhere('(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= :maxQuantity', {
        maxQuantity,
      });
    }

    if (lowStock) {
      queryBuilder.andWhere(
        '(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= COALESCE(item.reorderPoint, product.reorderPoint, 0)'
      );
    }

    if (outOfStock) {
      queryBuilder.andWhere('(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= 0');
    }

    if (expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      queryBuilder.andWhere('item.expiryDate IS NOT NULL');
      queryBuilder.andWhere('item.expiryDate <= :thirtyDaysFromNow', { thirtyDaysFromNow });
      queryBuilder.andWhere('item.expiryDate > CURRENT_DATE');
    }

    if (expired) {
      queryBuilder.andWhere('item.expiryDate IS NOT NULL');
      queryBuilder.andWhere('item.expiryDate < CURRENT_DATE');
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('item.isActive = :isActive', { isActive });
    }

    if (lotNumber) {
      queryBuilder.andWhere('item.lotNumber ILIKE :lotNumber', { lotNumber: `%${lotNumber}%` });
    }

    if (batchNumber) {
      queryBuilder.andWhere('item.batchNumber ILIKE :batchNumber', { batchNumber: `%${batchNumber}%` });
    }

    // Count total before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const validSortFields = [
      'item.quantityOnHand',
      'item.quantityAvailable',
      'item.totalValue',
      'item.lastMovementAt',
      'product.name',
      'location.name',
    ];

    if (validSortFields.includes(sortBy)) {
      if (sortBy === 'item.quantityAvailable') {
        queryBuilder.addSelect(
          '(item.quantityOnHand - item.quantityReserved - item.quantityAllocated)',
          'quantityAvailable'
        );
        queryBuilder.orderBy('quantityAvailable', sortOrder);
      } else {
        queryBuilder.orderBy(sortBy, sortOrder);
      }
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const items = await queryBuilder.getMany();

    // Calculate virtual fields
    items.forEach(item => {
      (item as any).quantityAvailable = item.quantityOnHand - item.quantityReserved - item.quantityAllocated;
      (item as any).isLowStock = item.reorderPoint
        ? (item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= item.reorderPoint
        : false;
      (item as any).isOutOfStock = (item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= 0;
    });

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dapatkan detail inventory item
   */
  async findOne(tenantId: string, id: string): Promise<InventoryItem> {
    const item = await this.inventoryItemRepository.findOne({
      where: { id, tenantId },
      relations: ['product', 'product.category', 'location', 'transactions'],
    });

    if (!item) {
      throw new NotFoundException('Inventory item tidak ditemukan');
    }

    return item;
  }

  /**
   * Dapatkan inventory item berdasarkan product dan location
   */
  async findByProductAndLocation(
    tenantId: string,
    productId: string,
    locationId: string,
  ): Promise<InventoryItem | null> {
    return await this.inventoryItemRepository.findOne({
      where: { tenantId, productId, locationId },
      relations: ['product', 'location'],
    });
  }

  /**
   * Lakukan stock adjustment
   */
  async adjustStock(
    tenantId: string,
    adjustmentDto: StockAdjustmentDto,
    userId: string,
  ): Promise<InventoryItem> {
    const { productId, locationId, adjustmentType, quantity, reason, notes, unitCost } = adjustmentDto;

    // Cari atau buat inventory item
    let inventoryItem = await this.findByProductAndLocation(tenantId, productId, locationId);

    if (!inventoryItem) {
      // Buat inventory item baru jika belum ada
      const createDto: CreateInventoryItemDto = {
        productId,
        locationId,
        quantityOnHand: 0,
        averageCost: unitCost || 0,
      };
      inventoryItem = await this.create(tenantId, createDto, userId);
    }

    const quantityBefore = inventoryItem.quantityOnHand;
    let quantityAfter: number;
    let actualAdjustment: number;

    // Calculate new quantity based on adjustment type
    switch (adjustmentType) {
      case AdjustmentType.POSITIVE:
        actualAdjustment = quantity;
        quantityAfter = quantityBefore + quantity;
        break;
      case AdjustmentType.NEGATIVE:
        actualAdjustment = -quantity;
        quantityAfter = Math.max(0, quantityBefore - quantity);
        break;
      case AdjustmentType.COUNT:
        actualAdjustment = quantity - quantityBefore;
        quantityAfter = quantity;
        break;
      default:
        throw new BadRequestException('Jenis adjustment tidak valid');
    }

    // Update inventory item
    inventoryItem.quantityOnHand = quantityAfter;
    inventoryItem.lastMovementAt = new Date();
    inventoryItem.updatedBy = userId;

    // Update average cost if unit cost provided and this is incoming stock
    if (unitCost && actualAdjustment > 0) {
      inventoryItem.updateAverageCost(unitCost, actualAdjustment);
    } else {
      inventoryItem.totalValue = inventoryItem.quantityOnHand * inventoryItem.averageCost;
    }

    const savedItem = await this.inventoryItemRepository.save(inventoryItem);

    // Create transaction record
    await this.transactionsService.createAdjustmentTransaction(
      tenantId,
      savedItem,
      actualAdjustment,
      quantityBefore,
      quantityAfter,
      reason,
      notes || undefined,
      userId,
      adjustmentDto,
    );

    // Emit real-time update
    await this.realtimeService.emitInventoryUpdate(tenantId, savedItem);

    // Check for alerts (low stock, etc.)
    await this.realtimeService.checkAndEmitAlerts(tenantId, savedItem);

    return await this.findOne(tenantId, savedItem.id);
  }

  /**
   * Bulk stock adjustment
   */
  async bulkAdjustStock(
    tenantId: string,
    bulkAdjustmentDto: BulkStockAdjustmentDto,
    userId: string,
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ index: number; error: string; adjustment: StockAdjustmentDto }>;
  }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string; adjustment: StockAdjustmentDto }>,
    };

    for (let i = 0; i < bulkAdjustmentDto.adjustments.length; i++) {
      const adjustment = bulkAdjustmentDto.adjustments[i];
      try {
        await this.adjustStock(tenantId, adjustment, userId);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: i,
          error: error.message || 'Unknown error',
          adjustment,
        });
      }
    }

    return result;
  }

  /**
   * Reserve quantity untuk sales order, dll
   */
  async reserveQuantity(
    tenantId: string,
    productId: string,
    locationId: string,
    quantity: number,
    reason: string,
    userId: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<InventoryItem> {
    const inventoryItem = await this.findByProductAndLocation(tenantId, productId, locationId);

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item tidak ditemukan');
    }

    if (!inventoryItem.reserveQuantity(quantity)) {
      throw new BadRequestException('Stok tersedia tidak mencukupi untuk reservasi');
    }

    inventoryItem.updatedBy = userId;
    const savedItem = await this.inventoryItemRepository.save(inventoryItem);

    // Create transaction record
    await this.transactionsService.createReservationTransaction(
      tenantId,
      savedItem,
      quantity,
      reason,
      userId,
      referenceType,
      referenceId,
    );

    // Emit real-time update
    await this.realtimeService.emitInventoryUpdate(tenantId, savedItem);

    return await this.findOne(tenantId, savedItem.id);
  }

  /**
   * Release reservation
   */
  async releaseReservation(
    tenantId: string,
    productId: string,
    locationId: string,
    quantity: number,
    reason: string,
    userId: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<InventoryItem> {
    const inventoryItem = await this.findByProductAndLocation(tenantId, productId, locationId);

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item tidak ditemukan');
    }

    inventoryItem.releaseReservation(quantity);
    inventoryItem.updatedBy = userId;
    const savedItem = await this.inventoryItemRepository.save(inventoryItem);

    // Create transaction record
    await this.transactionsService.createReservationReleaseTransaction(
      tenantId,
      savedItem,
      quantity,
      reason,
      userId,
      referenceType,
      referenceId,
    );

    // Emit real-time update
    await this.realtimeService.emitInventoryUpdate(tenantId, savedItem);

    return await this.findOne(tenantId, savedItem.id);
  }

  /**
   * Stock count (physical count)
   */
  async performStockCount(
    tenantId: string,
    productId: string,
    locationId: string,
    countedQuantity: number,
    notes: string,
    userId: string,
  ): Promise<{
    inventoryItem: InventoryItem;
    variance: number;
  }> {
    const inventoryItem = await this.findByProductAndLocation(tenantId, productId, locationId);

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item tidak ditemukan');
    }

    const quantityBefore = inventoryItem.quantityOnHand;
    const variance = inventoryItem.performStockCount(countedQuantity, userId);

    const savedItem = await this.inventoryItemRepository.save(inventoryItem);

    // Create adjustment transaction based on variance
    if (variance !== 0) {
      const adjustmentType = variance > 0 ? AdjustmentType.POSITIVE : AdjustmentType.NEGATIVE;
      const adjustmentDto: StockAdjustmentDto = {
        productId,
        locationId,
        adjustmentType,
        quantity: Math.abs(variance),
        reason: 'stock_count' as any,
        notes: `Stock count: ${notes}`,
      };

      await this.transactionsService.createAdjustmentTransaction(
        tenantId,
        savedItem,
        variance,
        quantityBefore,
        countedQuantity,
        'stock_count' as any,
        notes,
        userId,
        adjustmentDto,
      );
    }

    // Emit real-time update
    await this.realtimeService.emitInventoryUpdate(tenantId, savedItem);

    return {
      inventoryItem: await this.findOne(tenantId, savedItem.id),
      variance,
    };
  }

  /**
   * Dapatkan statistik inventory
   */
  async getInventoryStats(tenantId: string, locationId?: string): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    expiringSoonItems: number;
    expiredItems: number;
    totalQuantity: number;
    averageValue: number;
  }> {
    const queryBuilder = this.inventoryItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.product', 'product')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.isActive = true');

    if (locationId) {
      queryBuilder.andWhere('item.locationId = :locationId', { locationId });
    }

    const [
      totalItems,
      totalValueResult,
      totalQuantityResult,
      lowStockItems,
      outOfStockItems,
      expiringSoonItems,
      expiredItems,
    ] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder
        .select('SUM(item.totalValue)', 'totalValue')
        .getRawOne(),
      queryBuilder
        .select('SUM(item.quantityOnHand)', 'totalQuantity')
        .getRawOne(),
      queryBuilder
        .clone()
        .andWhere('(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= COALESCE(item.reorderPoint, product.reorderPoint, 0)')
        .getCount(),
      queryBuilder
        .clone()
        .andWhere('(item.quantityOnHand - item.quantityReserved - item.quantityAllocated) <= 0')
        .getCount(),
      queryBuilder
        .clone()
        .andWhere('item.expiryDate IS NOT NULL')
        .andWhere('item.expiryDate <= :thirtyDaysFromNow', {
          thirtyDaysFromNow: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .andWhere('item.expiryDate > CURRENT_DATE')
        .getCount(),
      queryBuilder
        .clone()
        .andWhere('item.expiryDate IS NOT NULL')
        .andWhere('item.expiryDate < CURRENT_DATE')
        .getCount(),
    ]);

    const totalValue = parseFloat(totalValueResult?.totalValue || '0');
    const totalQuantity = parseInt(totalQuantityResult?.totalQuantity || '0');
    const averageValue = totalItems > 0 ? totalValue / totalItems : 0;

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      expiringSoonItems,
      expiredItems,
      totalQuantity,
      averageValue,
    };
  }

  // Private helper methods
  private async validateProduct(tenantId: string, productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId, isDeleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produk tidak ditemukan');
    }

    return product;
  }

  private async validateLocation(tenantId: string, locationId: string): Promise<InventoryLocation> {
    const location = await this.locationRepository.findOne({
      where: { id: locationId, tenantId, isDeleted: false },
    });

    if (!location) {
      throw new NotFoundException('Lokasi tidak ditemukan');
    }

    if (!location.isActive) {
      throw new BadRequestException('Lokasi tidak aktif');
    }

    return location;
  }

  // Alias methods for workflow execution compatibility
  async getInventoryByProduct(
    tenantId: string,
    productId: string,
    locationId?: string,
  ): Promise<InventoryItem | null> {
    if (locationId) {
      return this.findByProductAndLocation(tenantId, productId, locationId);
    }
    
    // If no locationId provided, find first available inventory for this product
    const items = await this.findAll(tenantId, { productId, limit: 1 });
    return items.data.length > 0 ? items.data[0] : null;
  }

  async createInventoryAdjustment(
    tenantId: string,
    adjustmentData: StockAdjustmentDto,
    userId: string,
  ): Promise<InventoryItem> {
    return this.adjustStock(tenantId, adjustmentData, userId);
  }
}