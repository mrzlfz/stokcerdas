import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, IsNull, Not, In, QueryRunner } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderApproval,
  PurchaseOrderStatusHistory,
  PurchaseOrderStatus,
  ApprovalStatus,
  PurchaseOrderPriority,
} from '../entities/purchase-order.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/purchase-order-query.dto';
import {
  ApprovePurchaseOrderDto,
  RejectPurchaseOrderDto,
  EscalateApprovalDto,
  BulkApprovalDto,
  BulkApprovalResponseDto,
} from '../dto/purchase-order-approval.dto';
import {
  AddPurchaseOrderItemDto,
  UpdatePurchaseOrderItemDto,
  ReceiveItemDto,
  BulkReceiveItemsDto,
  BulkItemActionResponseDto,
} from '../dto/purchase-order-item.dto';
import {
  BulkCreatePurchaseOrderDto,
  BulkUpdatePurchaseOrderDto,
  BulkDeletePurchaseOrderDto,
  BulkStatusUpdateDto,
  BulkSendToSupplierDto,
  BulkPurchaseOrderResponseDto,
} from '../dto/bulk-purchase-order.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PurchaseOrderApproval)
    private readonly purchaseOrderApprovalRepository: Repository<PurchaseOrderApproval>,
    @InjectRepository(PurchaseOrderStatusHistory)
    private readonly purchaseOrderStatusHistoryRepository: Repository<PurchaseOrderStatusHistory>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectQueue('purchase-orders')
    private readonly purchaseOrderQueue: Queue,
  ) {}

  async create(
    tenantId: string,
    createPurchaseOrderDto: CreatePurchaseOrderDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    // Validate supplier exists and is active
    const supplier = await this.validateSupplier(tenantId, createPurchaseOrderDto.supplierId);

    // Generate PO number if not provided
    const poNumber = createPurchaseOrderDto.poNumber || await this.generatePoNumber(tenantId);

    // Validate PO number is unique
    await this.validatePoNumberUnique(tenantId, poNumber);

    // Validate items
    if (!createPurchaseOrderDto.items || createPurchaseOrderDto.items.length === 0) {
      throw new BadRequestException('Purchase order harus memiliki minimal 1 item');
    }

    // Create PO with transaction
    const queryRunner = this.purchaseOrderRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create purchase order
      const purchaseOrder = queryRunner.manager.create(PurchaseOrder, {
        ...createPurchaseOrderDto,
        poNumber,
        tenantId,
        createdBy: userId,
        updatedBy: userId,
        itemCount: createPurchaseOrderDto.items.length,
        orderDate: createPurchaseOrderDto.orderDate 
          ? new Date(createPurchaseOrderDto.orderDate) 
          : new Date(),
      });

      // Set default values from supplier
      purchaseOrder.paymentTerms = createPurchaseOrderDto.paymentTerms || supplier.paymentTerms;
      purchaseOrder.currency = createPurchaseOrderDto.currency || supplier.currency;

      // Generate payment due date
      purchaseOrder.generatePaymentDueDate();

      const savedPurchaseOrder = await queryRunner.manager.save(PurchaseOrder, purchaseOrder);

      // Create items
      let subtotal = 0;
      for (const itemDto of createPurchaseOrderDto.items) {
        const item = queryRunner.manager.create(PurchaseOrderItem, {
          ...itemDto,
          purchaseOrderId: savedPurchaseOrder.id,
          tenantId,
          createdBy: userId,
          updatedBy: userId,
          expectedDeliveryDate: itemDto.expectedDeliveryDate 
            ? new Date(itemDto.expectedDeliveryDate) 
            : undefined,
        });

        item.calculateTotals();
        subtotal += item.finalPrice;

        await queryRunner.manager.save(PurchaseOrderItem, item);
      }

      // Update totals
      savedPurchaseOrder.subtotalAmount = subtotal;
      savedPurchaseOrder.calculateTotals();

      // Check if requires approval
      const approvalThreshold = createPurchaseOrderDto.approvalThreshold || 10000000; // 10 million IDR
      const requiresApproval = savedPurchaseOrder.requiresApprovalCheck(approvalThreshold);

      if (requiresApproval) {
        savedPurchaseOrder.status = PurchaseOrderStatus.PENDING_APPROVAL;
      }

      await queryRunner.manager.save(PurchaseOrder, savedPurchaseOrder);

      // Create status history
      await this.createStatusHistory(
        queryRunner,
        savedPurchaseOrder.id,
        savedPurchaseOrder.status,
        null,
        'PO dibuat',
        'system',
        userId,
        tenantId,
      );

      await queryRunner.commitTransaction();

      // Queue background jobs
      await this.queueBackgroundJobs(savedPurchaseOrder.id, 'create');

      // Load with relations
      return this.findOne(tenantId, savedPurchaseOrder.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(tenantId: string, query: PurchaseOrderQueryDto): Promise<{
    data: PurchaseOrder[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      priority,
      type,
      approvalStatus,
      supplierId,
      supplierName,
      startDate,
      endDate,
      deliveryStartDate,
      deliveryEndDate,
      minAmount,
      maxAmount,
      isUrgent,
      requiresApproval,
      isOverdue,
      tag,
      createdBy,
      approvedBy,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      includeDeleted = false,
      includeItems = false,
      includeApprovals = false,
      includeStatusHistory = false,
    } = query;

    const queryBuilder = this.purchaseOrderRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .where('po.tenantId = :tenantId', { tenantId });

    // Include relations based on query params
    if (includeItems) {
      queryBuilder.leftJoinAndSelect('po.items', 'items');
    }
    if (includeApprovals) {
      queryBuilder.leftJoinAndSelect('po.approvals', 'approvals');
    }
    if (includeStatusHistory) {
      queryBuilder.leftJoinAndSelect('po.statusHistory', 'statusHistory');
    }

    // Filter soft delete
    if (!includeDeleted) {
      queryBuilder.andWhere('po.isDeleted = :isDeleted', { isDeleted: false });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(po.poNumber ILIKE :search OR po.description ILIKE :search OR po.notes ILIKE :search OR supplier.name ILIKE :search OR supplier.code ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Status filters
    if (status) {
      queryBuilder.andWhere('po.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('po.priority = :priority', { priority });
    }

    if (type) {
      queryBuilder.andWhere('po.type = :type', { type });
    }

    if (approvalStatus) {
      queryBuilder.andWhere('po.approvalStatus = :approvalStatus', { approvalStatus });
    }

    // Supplier filters
    if (supplierId) {
      queryBuilder.andWhere('po.supplierId = :supplierId', { supplierId });
    }

    if (supplierName) {
      queryBuilder.andWhere('supplier.name ILIKE :supplierName', { supplierName: `%${supplierName}%` });
    }

    // Date filters
    if (startDate && endDate) {
      queryBuilder.andWhere('po.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.andWhere('po.orderDate >= :startDate', { startDate: new Date(startDate) });
    } else if (endDate) {
      queryBuilder.andWhere('po.orderDate <= :endDate', { endDate: new Date(endDate) });
    }

    if (deliveryStartDate && deliveryEndDate) {
      queryBuilder.andWhere('po.expectedDeliveryDate BETWEEN :deliveryStartDate AND :deliveryEndDate', {
        deliveryStartDate: new Date(deliveryStartDate),
        deliveryEndDate: new Date(deliveryEndDate),
      });
    } else if (deliveryStartDate) {
      queryBuilder.andWhere('po.expectedDeliveryDate >= :deliveryStartDate', { 
        deliveryStartDate: new Date(deliveryStartDate) 
      });
    } else if (deliveryEndDate) {
      queryBuilder.andWhere('po.expectedDeliveryDate <= :deliveryEndDate', { 
        deliveryEndDate: new Date(deliveryEndDate) 
      });
    }

    // Amount filters
    if (minAmount !== undefined) {
      queryBuilder.andWhere('po.totalAmount >= :minAmount', { minAmount });
    }
    if (maxAmount !== undefined) {
      queryBuilder.andWhere('po.totalAmount <= :maxAmount', { maxAmount });
    }

    // Boolean filters
    if (isUrgent !== undefined) {
      queryBuilder.andWhere('po.isUrgent = :isUrgent', { isUrgent });
    }

    if (requiresApproval !== undefined) {
      queryBuilder.andWhere('po.requiresApproval = :requiresApproval', { requiresApproval });
    }

    if (isOverdue !== undefined && isOverdue) {
      queryBuilder.andWhere('po.expectedDeliveryDate < :now', { now: new Date() })
                  .andWhere('po.status NOT IN (:...completedStatuses)', { 
                    completedStatuses: [
                      PurchaseOrderStatus.RECEIVED,
                      PurchaseOrderStatus.CLOSED,
                      PurchaseOrderStatus.CANCELLED
                    ]
                  });
    }

    // Tag filter
    if (tag) {
      queryBuilder.andWhere('po.tags @> :tag', { tag: [tag] });
    }

    // User filters
    if (createdBy) {
      queryBuilder.andWhere('po.createdBy = :createdBy', { createdBy });
    }

    if (approvedBy) {
      queryBuilder.andWhere('po.approvedBy = :approvedBy', { approvedBy });
    }

    // Sorting
    const validSortFields = [
      'poNumber',
      'orderDate',
      'expectedDeliveryDate',
      'totalAmount',
      'status',
      'priority',
      'createdAt',
      'updatedAt',
      'supplierName',
      'completionPercentage',
    ];

    let sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    if (sortBy === 'supplierName') {
      queryBuilder.orderBy('supplier.name', sortOrder);
    } else {
      queryBuilder.orderBy(`po.${sortField}`, sortOrder);
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: [
        'supplier',
        'items',
        'approvals',
        'approvals.approver',
        'statusHistory',
        'statusHistory.user',
        'approver',
        'rejector',
      ],
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order tidak ditemukan');
    }

    return purchaseOrder;
  }

  async findByPoNumber(tenantId: string, poNumber: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { poNumber, tenantId, isDeleted: false },
      relations: ['supplier', 'items', 'approvals', 'statusHistory'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order dengan nomor "${poNumber}" tidak ditemukan`);
    }

    return purchaseOrder;
  }

  async update(
    tenantId: string,
    id: string,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(tenantId, id);

    // Check if PO is editable
    if (!purchaseOrder.isEditable) {
      throw new ForbiddenException('Purchase order tidak dapat diedit pada status ini');
    }

    // Validate PO number if changed
    if (updatePurchaseOrderDto.poNumber && updatePurchaseOrderDto.poNumber !== purchaseOrder.poNumber) {
      await this.validatePoNumberUnique(tenantId, updatePurchaseOrderDto.poNumber, id);
    }

    // Validate supplier if changed
    if (updatePurchaseOrderDto.supplierId && updatePurchaseOrderDto.supplierId !== purchaseOrder.supplierId) {
      await this.validateSupplier(tenantId, updatePurchaseOrderDto.supplierId);
    }

    // Update timestamps
    updatePurchaseOrderDto.updatedBy = userId;

    await this.purchaseOrderRepository.update(id, updatePurchaseOrderDto);

    // Queue untuk update index di Elasticsearch
    await this.purchaseOrderQueue.add('indexPurchaseOrder', {
      purchaseOrderId: id,
      action: 'update',
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, hardDelete: boolean = false, userId?: string): Promise<void> {
    const purchaseOrder = await this.findOne(tenantId, id);

    // Check if PO can be cancelled
    if (!purchaseOrder.canBeCancelled) {
      throw new ForbiddenException('Purchase order tidak dapat dibatalkan pada status ini');
    }

    if (hardDelete) {
      // Hard delete - hapus permanent
      await this.purchaseOrderRepository.delete(id);
    } else {
      // Soft delete
      await this.purchaseOrderRepository.update(id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        status: PurchaseOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        isActive: false,
      });

      // Create status history
      await this.createStatusHistory(
        null,
        id,
        PurchaseOrderStatus.CANCELLED,
        purchaseOrder.status,
        'PO dibatalkan',
        'manual',
        userId,
        tenantId,
      );
    }

    // Queue untuk remove index dari Elasticsearch
    await this.purchaseOrderQueue.add('indexPurchaseOrder', {
      purchaseOrderId: id,
      action: hardDelete ? 'delete' : 'cancel',
    });
  }

  // Approval methods
  async approve(
    tenantId: string,
    id: string,
    approveDto: ApprovePurchaseOrderDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(tenantId, id);

    if (!purchaseOrder.canBeApproved) {
      throw new ForbiddenException('Purchase order tidak dapat di-approve pada status ini');
    }

    // Update approval status
    purchaseOrder.updateApprovalStatus(ApprovalStatus.APPROVED, userId, approveDto.comments);

    await this.purchaseOrderRepository.save(purchaseOrder);

    // Create status history
    await this.createStatusHistory(
      null,
      id,
      PurchaseOrderStatus.APPROVED,
      purchaseOrder.status,
      `PO disetujui: ${approveDto.comments || ''}`,
      'approval',
      userId,
      tenantId,
    );

    // Queue notification
    await this.purchaseOrderQueue.add('sendApprovalNotification', {
      purchaseOrderId: id,
      action: 'approved',
      comments: approveDto.comments,
      approvedBy: userId,
    });

    return this.findOne(tenantId, id);
  }

  async reject(
    tenantId: string,
    id: string,
    rejectDto: RejectPurchaseOrderDto,
    userId?: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(tenantId, id);

    if (!purchaseOrder.canBeRejected) {
      throw new ForbiddenException('Purchase order tidak dapat di-reject pada status ini');
    }

    // Update approval status
    purchaseOrder.updateApprovalStatus(ApprovalStatus.REJECTED, userId, rejectDto.reason);

    await this.purchaseOrderRepository.save(purchaseOrder);

    // Create status history
    await this.createStatusHistory(
      null,
      id,
      PurchaseOrderStatus.REJECTED,
      purchaseOrder.status,
      `PO ditolak: ${rejectDto.reason}`,
      'approval',
      userId,
      tenantId,
    );

    // Queue notification
    await this.purchaseOrderQueue.add('sendApprovalNotification', {
      purchaseOrderId: id,
      action: 'rejected',
      reason: rejectDto.reason,
      comments: rejectDto.comments,
      rejectedBy: userId,
    });

    return this.findOne(tenantId, id);
  }

  async sendToSupplier(tenantId: string, id: string, userId?: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findOne(tenantId, id);

    if (!purchaseOrder.canBeSentToSupplier) {
      throw new ForbiddenException('Purchase order tidak dapat dikirim ke supplier pada status ini');
    }

    // Update status
    purchaseOrder.updateStatus(PurchaseOrderStatus.SENT_TO_SUPPLIER, userId);
    purchaseOrder.emailSentCount++;
    purchaseOrder.lastEmailSentAt = new Date();

    await this.purchaseOrderRepository.save(purchaseOrder);

    // Create status history
    await this.createStatusHistory(
      null,
      id,
      PurchaseOrderStatus.SENT_TO_SUPPLIER,
      purchaseOrder.status,
      'PO dikirim ke supplier',
      'manual',
      userId,
      tenantId,
    );

    // Queue email and PDF generation
    await this.purchaseOrderQueue.add('sendToSupplier', {
      purchaseOrderId: id,
      sendEmail: true,
      generatePdf: true,
      sentBy: userId,
    });

    return this.findOne(tenantId, id);
  }

  // Helper methods
  private async validateSupplier(tenantId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, tenantId, isDeleted: false },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier tidak ditemukan');
    }

    if (!supplier.isActive()) {
      throw new BadRequestException('Supplier tidak aktif');
    }

    return supplier;
  }

  private async validatePoNumberUnique(tenantId: string, poNumber: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, poNumber, isDeleted: false };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingPo = await this.purchaseOrderRepository.findOne({
      where: whereCondition,
    });

    if (existingPo) {
      throw new ConflictException(`Nomor PO "${poNumber}" sudah digunakan`);
    }
  }

  private async generatePoNumber(tenantId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    // Count existing POs in current month
    const count = await this.purchaseOrderRepository.count({
      where: {
        tenantId,
        orderDate: Between(
          new Date(currentYear, new Date().getMonth(), 1),
          new Date(currentYear, new Date().getMonth() + 1, 0)
        ),
        isDeleted: false,
      },
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `PO-${currentYear}${currentMonth}-${sequence}`;
  }

  private async createStatusHistory(
    queryRunner: QueryRunner | null,
    purchaseOrderId: string,
    status: PurchaseOrderStatus,
    previousStatus: PurchaseOrderStatus | null,
    reason: string,
    source: string,
    userId: string | undefined,
    tenantId: string,
  ): Promise<void> {
    const statusHistory = {
      purchaseOrderId,
      status,
      previousStatus,
      reason,
      source,
      changedBy: userId,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    };

    if (queryRunner) {
      await queryRunner.manager.save(PurchaseOrderStatusHistory, statusHistory);
    } else {
      await this.purchaseOrderStatusHistoryRepository.save(statusHistory);
    }
  }

  private async queueBackgroundJobs(purchaseOrderId: string, action: string): Promise<void> {
    // Queue untuk indexing ke Elasticsearch
    await this.purchaseOrderQueue.add('indexPurchaseOrder', {
      purchaseOrderId,
      action,
    });

    // Queue untuk notification jika diperlukan
    if (action === 'create') {
      await this.purchaseOrderQueue.add('sendCreationNotification', {
        purchaseOrderId,
      });
    }
  }

  // Item management methods
  async addItem(
    tenantId: string,
    purchaseOrderId: string,
    addItemDto: AddPurchaseOrderItemDto,
    userId?: string,
  ): Promise<PurchaseOrderItem> {
    const purchaseOrder = await this.findOne(tenantId, purchaseOrderId);

    if (!purchaseOrder.isEditable) {
      throw new ForbiddenException('Purchase order tidak dapat diedit pada status ini');
    }

    const item = this.purchaseOrderItemRepository.create({
      ...addItemDto,
      purchaseOrderId,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
      expectedDeliveryDate: addItemDto.expectedDeliveryDate 
        ? new Date(addItemDto.expectedDeliveryDate) 
        : undefined,
    });

    item.calculateTotals();
    const savedItem = await this.purchaseOrderItemRepository.save(item);

    // Update PO totals
    await this.recalculatePurchaseOrderTotals(purchaseOrderId);

    return savedItem;
  }

  async updateItem(
    tenantId: string,
    purchaseOrderId: string,
    itemId: string,
    updateItemDto: UpdatePurchaseOrderItemDto,
    userId?: string,
  ): Promise<PurchaseOrderItem> {
    const purchaseOrder = await this.findOne(tenantId, purchaseOrderId);

    if (!purchaseOrder.isEditable) {
      throw new ForbiddenException('Purchase order tidak dapat diedit pada status ini');
    }

    const item = await this.purchaseOrderItemRepository.findOne({
      where: { id: itemId, purchaseOrderId, tenantId, isDeleted: false },
    });

    if (!item) {
      throw new NotFoundException('Item tidak ditemukan');
    }

    updateItemDto.updatedBy = userId;
    
    if (updateItemDto.expectedDeliveryDate) {
      updateItemDto.expectedDeliveryDate = new Date(updateItemDto.expectedDeliveryDate) as any;
    }

    await this.purchaseOrderItemRepository.update(itemId, updateItemDto);

    // Recalculate totals
    const updatedItem = await this.purchaseOrderItemRepository.findOne({
      where: { id: itemId },
    });
    
    if (updatedItem) {
      updatedItem.calculateTotals();
      await this.purchaseOrderItemRepository.save(updatedItem);
    }

    // Update PO totals
    await this.recalculatePurchaseOrderTotals(purchaseOrderId);

    return updatedItem!;
  }

  async removeItem(
    tenantId: string,
    purchaseOrderId: string,
    itemId: string,
    userId?: string,
  ): Promise<void> {
    const purchaseOrder = await this.findOne(tenantId, purchaseOrderId);

    if (!purchaseOrder.isEditable) {
      throw new ForbiddenException('Purchase order tidak dapat diedit pada status ini');
    }

    const item = await this.purchaseOrderItemRepository.findOne({
      where: { id: itemId, purchaseOrderId, tenantId, isDeleted: false },
    });

    if (!item) {
      throw new NotFoundException('Item tidak ditemukan');
    }

    // Check if this is the last item
    const itemCount = await this.purchaseOrderItemRepository.count({
      where: { purchaseOrderId, tenantId, isDeleted: false },
    });

    if (itemCount <= 1) {
      throw new BadRequestException('Purchase order harus memiliki minimal 1 item');
    }

    // Soft delete
    await this.purchaseOrderItemRepository.update(itemId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    });

    // Update PO totals
    await this.recalculatePurchaseOrderTotals(purchaseOrderId);
  }

  async receiveItem(
    tenantId: string,
    purchaseOrderId: string,
    itemId: string,
    receiveDto: ReceiveItemDto,
    userId?: string,
  ): Promise<PurchaseOrderItem> {
    const purchaseOrder = await this.findOne(tenantId, purchaseOrderId);
    
    const item = await this.purchaseOrderItemRepository.findOne({
      where: { id: itemId, purchaseOrderId, tenantId, isDeleted: false },
    });

    if (!item) {
      throw new NotFoundException('Item tidak ditemukan');
    }

    // Validate received quantity
    const maxReceivable = item.orderedQuantity - item.receivedQuantity;
    if (receiveDto.receivedQuantity > maxReceivable) {
      throw new BadRequestException(`Quantity yang diterima tidak boleh melebihi ${maxReceivable}`);
    }

    // Update item
    item.receiveQuantity(receiveDto.receivedQuantity, receiveDto.rejectedQuantity || 0);
    
    if (receiveDto.notes) {
      item.notes = receiveDto.notes;
    }

    await this.purchaseOrderItemRepository.save(item);

    // Update PO status if needed
    await this.updatePurchaseOrderReceivingStatus(purchaseOrderId);

    return item;
  }

  // Bulk operations
  async bulkCreate(
    tenantId: string,
    bulkCreateDto: BulkCreatePurchaseOrderDto,
    userId?: string,
  ): Promise<BulkPurchaseOrderResponseDto> {
    const result: BulkPurchaseOrderResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
      total: bulkCreateDto.purchaseOrders.length,
      startedAt: new Date(),
    };

    for (let i = 0; i < bulkCreateDto.purchaseOrders.length; i++) {
      const poDto = bulkCreateDto.purchaseOrders[i];
      
      try {
        const po = await this.create(tenantId, poDto, userId);
        result.successful++;
        result.successfulIds.push(po.id);
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: i,
          poNumber: poDto.poNumber,
          error: error.message,
        });

        if (bulkCreateDto.stopOnError) {
          break;
        }
      }
    }

    result.completedAt = new Date();
    result.duration = result.completedAt.getTime() - result.startedAt.getTime();

    return result;
  }

  async bulkApprove(
    tenantId: string,
    bulkApprovalDto: BulkApprovalDto,
    userId?: string,
  ): Promise<BulkApprovalResponseDto> {
    const result: BulkApprovalResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
      total: bulkApprovalDto.purchaseOrderIds.length,
    };

    for (const purchaseOrderId of bulkApprovalDto.purchaseOrderIds) {
      try {
        if (bulkApprovalDto.action === 'approve') {
          await this.approve(tenantId, purchaseOrderId, { 
            comments: bulkApprovalDto.comments 
          }, userId);
        } else {
          await this.reject(tenantId, purchaseOrderId, { 
            reason: bulkApprovalDto.reason || 'Bulk rejection',
            comments: bulkApprovalDto.comments 
          }, userId);
        }
        
        result.successful++;
        result.successfulIds.push(purchaseOrderId);
      } catch (error) {
        result.failed++;
        result.errors.push({
          purchaseOrderId,
          error: error.message,
        });
      }
    }

    return result;
  }

  async bulkSendToSupplier(
    tenantId: string,
    bulkSendDto: BulkSendToSupplierDto,
    userId?: string,
  ): Promise<BulkPurchaseOrderResponseDto> {
    const result: BulkPurchaseOrderResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
      total: bulkSendDto.purchaseOrderIds.length,
      startedAt: new Date(),
    };

    for (const purchaseOrderId of bulkSendDto.purchaseOrderIds) {
      try {
        await this.sendToSupplier(tenantId, purchaseOrderId, userId);
        result.successful++;
        result.successfulIds.push(purchaseOrderId);
      } catch (error) {
        result.failed++;
        result.errors.push({
          purchaseOrderId,
          error: error.message,
        });
      }
    }

    result.completedAt = new Date();
    result.duration = result.completedAt.getTime() - result.startedAt.getTime();

    return result;
  }

  // Helper methods
  private async recalculatePurchaseOrderTotals(purchaseOrderId: string): Promise<void> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id: purchaseOrderId },
      relations: ['items'],
    });

    if (purchaseOrder) {
      purchaseOrder.calculateTotals();
      await this.purchaseOrderRepository.save(purchaseOrder);
    }
  }

  private async updatePurchaseOrderReceivingStatus(purchaseOrderId: string): Promise<void> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id: purchaseOrderId },
      relations: ['items'],
    });

    if (!purchaseOrder) return;

    purchaseOrder.updateCompletionPercentage();

    let newStatus = purchaseOrder.status;

    if (purchaseOrder.isFullyReceived) {
      newStatus = PurchaseOrderStatus.RECEIVED;
    } else if (purchaseOrder.isPartiallyReceived) {
      newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    if (newStatus !== purchaseOrder.status) {
      purchaseOrder.updateStatus(newStatus);
      
      await this.createStatusHistory(
        null,
        purchaseOrderId,
        newStatus,
        purchaseOrder.status,
        'Status updated berdasarkan receiving items',
        'system',
        undefined,
        purchaseOrder.tenantId,
      );
    }

    await this.purchaseOrderRepository.save(purchaseOrder);
  }

  // Statistics methods
  async getStats(tenantId: string): Promise<{
    total: number;
    byStatus: Record<PurchaseOrderStatus, number>;
    byPriority: Record<PurchaseOrderPriority, number>;
    totalAmount: number;
    averageAmount: number;
    pendingApproval: number;
    overdue: number;
  }> {
    const [
      total,
      draft,
      pendingApproval,
      approved,
      sent,
      acknowledged,
      partiallyReceived,
      received,
      closed,
      cancelled,
      rejected,
      lowPriority,
      normalPriority,
      highPriority,
      urgentPriority,
      overdueCount,
    ] = await Promise.all([
      this.purchaseOrderRepository.count({
        where: { tenantId, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.DRAFT, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.PENDING_APPROVAL, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.APPROVED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.SENT_TO_SUPPLIER, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.ACKNOWLEDGED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.PARTIALLY_RECEIVED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.RECEIVED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.CLOSED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.CANCELLED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, status: PurchaseOrderStatus.REJECTED, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, priority: PurchaseOrderPriority.LOW, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, priority: PurchaseOrderPriority.NORMAL, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, priority: PurchaseOrderPriority.HIGH, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: { tenantId, priority: PurchaseOrderPriority.URGENT, isDeleted: false },
      }),
      this.purchaseOrderRepository.count({
        where: {
          tenantId,
          isDeleted: false,
          expectedDeliveryDate: Between(new Date(0), new Date()),
          status: Not(In([
            PurchaseOrderStatus.RECEIVED,
            PurchaseOrderStatus.CLOSED,
            PurchaseOrderStatus.CANCELLED
          ])),
        },
      }),
    ]);

    // Calculate total and average amounts
    const amountResult = await this.purchaseOrderRepository
      .createQueryBuilder('po')
      .select('SUM(po.totalAmount)', 'total')
      .addSelect('AVG(po.totalAmount)', 'average')
      .where('po.tenantId = :tenantId', { tenantId })
      .andWhere('po.isDeleted = :isDeleted', { isDeleted: false })
      .getRawOne();

    return {
      total,
      byStatus: {
        [PurchaseOrderStatus.DRAFT]: draft,
        [PurchaseOrderStatus.PENDING_APPROVAL]: pendingApproval,
        [PurchaseOrderStatus.APPROVED]: approved,
        [PurchaseOrderStatus.REJECTED]: rejected,
        [PurchaseOrderStatus.SENT_TO_SUPPLIER]: sent,
        [PurchaseOrderStatus.ACKNOWLEDGED]: acknowledged,
        [PurchaseOrderStatus.PARTIALLY_RECEIVED]: partiallyReceived,
        [PurchaseOrderStatus.RECEIVED]: received,
        [PurchaseOrderStatus.CLOSED]: closed,
        [PurchaseOrderStatus.CANCELLED]: cancelled,
      },
      byPriority: {
        [PurchaseOrderPriority.LOW]: lowPriority,
        [PurchaseOrderPriority.NORMAL]: normalPriority,
        [PurchaseOrderPriority.HIGH]: highPriority,
        [PurchaseOrderPriority.URGENT]: urgentPriority,
      },
      totalAmount: parseFloat(amountResult?.total || '0'),
      averageAmount: parseFloat(amountResult?.average || '0'),
      pendingApproval,
      overdue: overdueCount,
    };
  }
}