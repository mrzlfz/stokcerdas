import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import {
  InventoryTransaction,
  TransactionType,
  TransactionStatus,
} from '../entities/inventory-transaction.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import {
  InventoryTransactionQueryDto,
  SortOrder,
} from '../dto/inventory-query.dto';
import {
  StockAdjustmentDto,
  AdjustmentReason,
} from '../dto/stock-adjustment.dto';
import {
  CreateInventoryTransferDto,
  UpdateTransferStatusDto,
  TransferReceiptDto,
  TransferStatus,
} from '../dto/inventory-transfer.dto';

@Injectable()
export class InventoryTransactionsService {
  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
  ) {}

  /**
   * Dapatkan semua transaksi dengan filter dan pagination
   */
  async findAll(
    tenantId: string,
    query: InventoryTransactionQueryDto,
  ): Promise<{
    data: InventoryTransaction[];
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
      transactionType,
      status,
      startDate,
      endDate,
      referenceNumber,
      referenceType,
      sortBy = 'transactionDate',
      sortOrder = SortOrder.DESC,
      page = 1,
      limit = 20,
    } = query;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .leftJoinAndSelect('transaction.location', 'location')
      .leftJoinAndSelect('transaction.inventoryItem', 'inventoryItem')
      .leftJoinAndSelect('transaction.sourceLocation', 'sourceLocation')
      .leftJoinAndSelect(
        'transaction.destinationLocation',
        'destinationLocation',
      )
      .where('transaction.tenantId = :tenantId', { tenantId });

    // Apply filters
    if (locationId) {
      queryBuilder.andWhere('transaction.locationId = :locationId', {
        locationId,
      });
    }

    if (productId) {
      queryBuilder.andWhere('transaction.productId = :productId', {
        productId,
      });
    }

    if (transactionType) {
      queryBuilder.andWhere('transaction.type = :transactionType', {
        transactionType,
      });
    }

    if (status) {
      queryBuilder.andWhere('transaction.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'transaction.transactionDate BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (startDate) {
      queryBuilder.andWhere('transaction.transactionDate >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      queryBuilder.andWhere('transaction.transactionDate <= :endDate', {
        endDate,
      });
    }

    if (referenceNumber) {
      queryBuilder.andWhere(
        'transaction.referenceNumber ILIKE :referenceNumber',
        {
          referenceNumber: `%${referenceNumber}%`,
        },
      );
    }

    if (referenceType) {
      queryBuilder.andWhere('transaction.referenceType = :referenceType', {
        referenceType,
      });
    }

    // Count total before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const validSortFields = [
      'transaction.transactionDate',
      'transaction.type',
      'transaction.status',
      'transaction.quantity',
      'product.name',
      'location.name',
    ];

    if (validSortFields.includes(sortBy)) {
      queryBuilder.orderBy(sortBy, sortOrder);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const transactions = await queryBuilder.getMany();

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dapatkan detail transaksi
   */
  async findOne(tenantId: string, id: string): Promise<InventoryTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, tenantId },
      relations: [
        'product',
        'location',
        'inventoryItem',
        'sourceLocation',
        'destinationLocation',
        'relatedTransaction',
      ],
    });

    if (!transaction) {
      throw new NotFoundException('Transaksi inventory tidak ditemukan');
    }

    return transaction;
  }

  /**
   * Create initial stock transaction (saat first time setup inventory item)
   */
  async createInitialStockTransaction(
    tenantId: string,
    inventoryItem: InventoryItem,
    quantity: number,
    unitCost: number,
    userId: string,
  ): Promise<InventoryTransaction> {
    const transaction = this.transactionRepository.create({
      tenantId,
      productId: inventoryItem.productId,
      locationId: inventoryItem.locationId,
      inventoryItemId: inventoryItem.id,
      type: TransactionType.RECEIPT,
      status: TransactionStatus.COMPLETED,
      quantity,
      quantityBefore: 0,
      quantityAfter: quantity,
      unitCost,
      totalCost: quantity * unitCost,
      reason: 'Stok awal',
      notes: 'Inisialisasi stok awal inventory item',
      createdBy: userId,
      processedAt: new Date(),
      processedBy: userId,
    });

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Create adjustment transaction
   */
  async createAdjustmentTransaction(
    tenantId: string,
    inventoryItem: InventoryItem,
    quantityChange: number,
    quantityBefore: number,
    quantityAfter: number,
    reason: AdjustmentReason,
    notes: string | undefined,
    userId: string,
    adjustmentDto: StockAdjustmentDto,
  ): Promise<InventoryTransaction> {
    const transactionType =
      quantityChange > 0
        ? TransactionType.ADJUSTMENT_POSITIVE
        : TransactionType.ADJUSTMENT_NEGATIVE;

    const transaction = this.transactionRepository.create({
      tenantId,
      productId: inventoryItem.productId,
      locationId: inventoryItem.locationId,
      inventoryItemId: inventoryItem.id,
      type: transactionType,
      status: TransactionStatus.COMPLETED,
      quantity: Math.abs(quantityChange),
      quantityBefore,
      quantityAfter,
      unitCost: adjustmentDto.unitCost,
      totalCost: adjustmentDto.unitCost
        ? Math.abs(quantityChange) * adjustmentDto.unitCost
        : undefined,
      reason: this.mapAdjustmentReasonToString(reason),
      notes,
      referenceType: adjustmentDto.referenceType,
      referenceId: adjustmentDto.referenceId,
      referenceNumber: adjustmentDto.referenceNumber,
      batchNumber: adjustmentDto.batchNumber,
      lotNumber: adjustmentDto.lotNumber,
      serialNumber: adjustmentDto.serialNumber,
      metadata: adjustmentDto.metadata,
      createdBy: userId,
      processedAt: new Date(),
      processedBy: userId,
    });

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Create reservation transaction
   */
  async createReservationTransaction(
    tenantId: string,
    inventoryItem: InventoryItem,
    quantity: number,
    reason: string,
    userId: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<InventoryTransaction> {
    const transaction = this.transactionRepository.create({
      tenantId,
      productId: inventoryItem.productId,
      locationId: inventoryItem.locationId,
      inventoryItemId: inventoryItem.id,
      type: TransactionType.RESERVATION,
      status: TransactionStatus.COMPLETED,
      quantity,
      quantityBefore: inventoryItem.quantityReserved - quantity,
      quantityAfter: inventoryItem.quantityReserved,
      reason,
      referenceType,
      referenceId,
      createdBy: userId,
      processedAt: new Date(),
      processedBy: userId,
    });

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Create reservation release transaction
   */
  async createReservationReleaseTransaction(
    tenantId: string,
    inventoryItem: InventoryItem,
    quantity: number,
    reason: string,
    userId: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<InventoryTransaction> {
    const transaction = this.transactionRepository.create({
      tenantId,
      productId: inventoryItem.productId,
      locationId: inventoryItem.locationId,
      inventoryItemId: inventoryItem.id,
      type: TransactionType.RESERVATION_RELEASE,
      status: TransactionStatus.COMPLETED,
      quantity,
      quantityBefore: inventoryItem.quantityReserved + quantity,
      quantityAfter: inventoryItem.quantityReserved,
      reason,
      referenceType,
      referenceId,
      createdBy: userId,
      processedAt: new Date(),
      processedBy: userId,
    });

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Create transfer transactions (pair)
   */
  async createTransferTransactions(
    tenantId: string,
    transferDto: CreateInventoryTransferDto,
    userId: string,
  ): Promise<{
    outTransactions: InventoryTransaction[];
    inTransactions: InventoryTransaction[];
  }> {
    const outTransactions: InventoryTransaction[] = [];
    const inTransactions: InventoryTransaction[] = [];

    for (const item of transferDto.items) {
      const [outTransaction, inTransaction] =
        InventoryTransaction.createTransferPair(
          item.productId,
          item.quantity,
          transferDto.sourceLocationId,
          transferDto.destinationLocationId,
          tenantId,
          userId,
          this.mapTransferReasonToString(transferDto.reason),
          transferDto.referenceType,
          transferDto.referenceId,
        );

      // Set additional properties
      outTransaction.referenceNumber = transferDto.referenceNumber;
      outTransaction.notes = transferDto.notes;
      outTransaction.unitCost = item.unitCost;
      outTransaction.totalCost = item.unitCost
        ? item.quantity * item.unitCost
        : undefined;
      outTransaction.batchNumber = item.batchNumber;
      outTransaction.lotNumber = item.lotNumber;
      outTransaction.serialNumber = item.serialNumber;
      outTransaction.metadata = {
        ...transferDto.metadata,
        priority: transferDto.priority,
        expectedDate: transferDto.expectedDate,
        itemNotes: item.notes,
      };

      inTransaction.referenceNumber = transferDto.referenceNumber;
      inTransaction.notes = transferDto.notes;
      inTransaction.unitCost = item.unitCost;
      inTransaction.totalCost = item.unitCost
        ? item.quantity * item.unitCost
        : undefined;
      inTransaction.batchNumber = item.batchNumber;
      inTransaction.lotNumber = item.lotNumber;
      inTransaction.serialNumber = item.serialNumber;
      inTransaction.metadata = {
        ...transferDto.metadata,
        priority: transferDto.priority,
        expectedDate: transferDto.expectedDate,
        itemNotes: item.notes,
      };

      // Link transactions
      const savedOutTransaction = await this.transactionRepository.save(
        outTransaction,
      );
      inTransaction.relatedTransactionId = savedOutTransaction.id;
      const savedInTransaction = await this.transactionRepository.save(
        inTransaction,
      );

      savedOutTransaction.relatedTransactionId = savedInTransaction.id;
      await this.transactionRepository.save(savedOutTransaction);

      outTransactions.push(savedOutTransaction);
      inTransactions.push(savedInTransaction);
    }

    return { outTransactions, inTransactions };
  }

  /**
   * Update status transaksi
   */
  async updateTransactionStatus(
    tenantId: string,
    transactionId: string,
    updateStatusDto: UpdateTransferStatusDto,
    userId: string,
  ): Promise<InventoryTransaction> {
    const transaction = await this.findOne(tenantId, transactionId);

    // Map TransferStatus to TransactionStatus
    const statusMapping: Record<TransferStatus, TransactionStatus> = {
      [TransferStatus.DRAFT]: TransactionStatus.PENDING,
      [TransferStatus.PENDING]: TransactionStatus.PENDING,
      [TransferStatus.IN_TRANSIT]: TransactionStatus.PENDING,
      [TransferStatus.COMPLETED]: TransactionStatus.COMPLETED,
      [TransferStatus.CANCELLED]: TransactionStatus.CANCELLED,
      [TransferStatus.REJECTED]: TransactionStatus.CANCELLED,
    };

    transaction.status = statusMapping[updateStatusDto.status];
    transaction.updatedBy = userId;

    if (updateStatusDto.status === TransferStatus.COMPLETED) {
      transaction.processedAt = new Date();
      transaction.processedBy = userId;
    } else if (
      updateStatusDto.status === TransferStatus.CANCELLED ||
      updateStatusDto.status === TransferStatus.REJECTED
    ) {
      transaction.cancelledAt = new Date();
      transaction.cancelledBy = userId;
      transaction.cancellationReason = updateStatusDto.notes;
    }

    if (updateStatusDto.notes) {
      transaction.notes = transaction.notes
        ? `${transaction.notes}
[${new Date().toISOString()}] ${updateStatusDto.notes}`
        : updateStatusDto.notes;
    }

    if (updateStatusDto.metadata) {
      transaction.metadata = {
        ...transaction.metadata,
        ...updateStatusDto.metadata,
      };
    }

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Process transfer receipt
   */
  async processTransferReceipt(
    tenantId: string,
    receiptDto: TransferReceiptDto,
    userId: string,
  ): Promise<{
    processedTransactions: InventoryTransaction[];
    discrepancies: Array<{
      productId: string;
      expectedQuantity: number;
      receivedQuantity: number;
      variance: number;
    }>;
  }> {
    const processedTransactions: InventoryTransaction[] = [];
    const discrepancies: Array<{
      productId: string;
      expectedQuantity: number;
      receivedQuantity: number;
      variance: number;
    }> = [];

    // Find all incoming transfer transactions for this transfer
    const incomingTransactions = await this.transactionRepository.find({
      where: {
        tenantId,
        type: TransactionType.TRANSFER_IN,
        referenceId: receiptDto.transferId,
        status: TransactionStatus.PENDING,
      },
    });

    for (const receivedItem of receiptDto.receivedItems) {
      const transaction = incomingTransactions.find(
        tx => tx.productId === receivedItem.productId,
      );

      if (!transaction) {
        continue;
      }

      const expectedQuantity = transaction.quantity;
      const receivedQuantity = receivedItem.quantityReceived;
      const variance = receivedQuantity - expectedQuantity;

      if (variance !== 0) {
        discrepancies.push({
          productId: receivedItem.productId,
          expectedQuantity,
          receivedQuantity,
          variance,
        });
      }

      // Update transaction with received quantity
      transaction.quantity = receivedQuantity;
      transaction.quantityAfter = transaction.quantityBefore + receivedQuantity;
      transaction.status = TransactionStatus.COMPLETED;
      transaction.processedAt = new Date();
      transaction.processedBy = userId;
      transaction.notes = receivedItem.notes || transaction.notes;

      if (receivedItem.batchNumber)
        transaction.batchNumber = receivedItem.batchNumber;
      if (receivedItem.lotNumber)
        transaction.lotNumber = receivedItem.lotNumber;
      if (receivedItem.serialNumber)
        transaction.serialNumber = receivedItem.serialNumber;

      transaction.metadata = {
        ...transaction.metadata,
        receiverName: receiptDto.receiverName,
        quantityDamaged: receivedItem.quantityDamaged || 0,
        receiptNotes: receiptDto.notes,
      };

      const savedTransaction = await this.transactionRepository.save(
        transaction,
      );
      processedTransactions.push(savedTransaction);

      // Create damage transaction if any
      if (receivedItem.quantityDamaged && receivedItem.quantityDamaged > 0) {
        const damageTransaction = this.transactionRepository.create({
          tenantId,
          productId: receivedItem.productId,
          locationId: transaction.locationId,
          type: TransactionType.DAMAGED,
          status: TransactionStatus.COMPLETED,
          quantity: receivedItem.quantityDamaged,
          quantityBefore: receivedQuantity,
          quantityAfter: receivedQuantity - receivedItem.quantityDamaged,
          reason: 'Barang rusak saat transfer',
          notes: `Barang rusak dari transfer: ${receivedItem.notes || ''}`,
          relatedTransactionId: savedTransaction.id,
          createdBy: userId,
          processedAt: new Date(),
          processedBy: userId,
        });

        await this.transactionRepository.save(damageTransaction);
      }
    }

    return { processedTransactions, discrepancies };
  }

  /**
   * Cancel transaction
   */
  async cancelTransaction(
    tenantId: string,
    transactionId: string,
    reason: string,
    userId: string,
  ): Promise<InventoryTransaction> {
    const transaction = await this.findOne(tenantId, transactionId);

    if (!transaction.canBeCancelled) {
      throw new BadRequestException('Transaksi tidak dapat dibatalkan');
    }

    transaction.cancel(userId, reason);
    return await this.transactionRepository.save(transaction);
  }

  /**
   * Dapatkan statistik transaksi
   */
  async getTransactionStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
    locationId?: string,
  ): Promise<{
    totalTransactions: number;
    totalValue: number;
    transactionsByType: Record<string, number>;
    transactionsByStatus: Record<string, number>;
    dailyTransactions: Array<{ date: string; count: number; value: number }>;
  }> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId });

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'transaction.transactionDate BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    }

    if (locationId) {
      queryBuilder.andWhere('transaction.locationId = :locationId', {
        locationId,
      });
    }

    const [
      totalTransactions,
      totalValueResult,
      transactionsByType,
      transactionsByStatus,
    ] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder
        .select('SUM(transaction.totalCost)', 'totalValue')
        .getRawOne(),
      queryBuilder
        .select('transaction.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('transaction.type')
        .getRawMany(),
      queryBuilder
        .select('transaction.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('transaction.status')
        .getRawMany(),
    ]);

    const totalValue = parseFloat(totalValueResult?.totalValue || '0');

    const transactionsByTypeMap = transactionsByType.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});

    const transactionsByStatusMap = transactionsByStatus.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count);
      return acc;
    }, {});

    // Daily transactions (last 30 days if no date range specified)
    const dailyStartDate =
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyEndDate = endDate || new Date();

    const dailyTransactions = await queryBuilder
      .select('DATE(transaction.transactionDate)', 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(COALESCE(transaction.totalCost, 0))', 'value')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere(
        'transaction.transactionDate BETWEEN :dailyStartDate AND :dailyEndDate',
        {
          dailyStartDate,
          dailyEndDate,
        },
      )
      .groupBy('DATE(transaction.transactionDate)')
      .orderBy('DATE(transaction.transactionDate)', 'ASC')
      .getRawMany();

    return {
      totalTransactions,
      totalValue,
      transactionsByType: transactionsByTypeMap,
      transactionsByStatus: transactionsByStatusMap,
      dailyTransactions: dailyTransactions.map(item => ({
        date: item.date,
        count: parseInt(item.count),
        value: parseFloat(item.value || '0'),
      })),
    };
  }

  // Private helper methods
  private mapAdjustmentReasonToString(reason: AdjustmentReason): string {
    const reasonMap = {
      [AdjustmentReason.STOCK_COUNT]: 'Stock opname',
      [AdjustmentReason.DAMAGED]: 'Barang rusak',
      [AdjustmentReason.EXPIRED]: 'Barang kadaluarsa',
      [AdjustmentReason.LOST]: 'Barang hilang',
      [AdjustmentReason.FOUND]: 'Barang ditemukan',
      [AdjustmentReason.SUPPLIER_CORRECTION]: 'Koreksi supplier',
      [AdjustmentReason.SYSTEM_CORRECTION]: 'Koreksi sistem',
      [AdjustmentReason.PRODUCTION_WASTE]: 'Waste produksi',
      [AdjustmentReason.CUSTOMER_RETURN]: 'Return customer',
      [AdjustmentReason.INTERNAL_USE]: 'Pemakaian internal',
      [AdjustmentReason.THEFT]: 'Kehilangan/pencurian',
      [AdjustmentReason.OTHER]: 'Lainnya',
    };

    return reasonMap[reason] || reason;
  }

  private mapTransferReasonToString(reason: any): string {
    const reasonMap = {
      restock: 'Restocking',
      customer_order: 'Pesanan customer',
      damaged_goods: 'Barang rusak',
      expired_goods: 'Barang kadaluarsa',
      branch_request: 'Permintaan cabang',
      consolidation: 'Konsolidasi',
      emergency: 'Emergency',
      seasonal_adjustment: 'Penyesuaian musiman',
      overflow: 'Overflow',
      other: 'Lainnya',
    };

    return reasonMap[reason] || reason;
  }
}
