import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, IsNull, Not, In, QueryRunner } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Supplier, SupplierStatus } from '../entities/supplier.entity';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { SupplierQueryDto } from '../dto/supplier-query.dto';
import {
  BulkCreateSupplierDto,
  BulkUpdateSupplierDto,
  BulkDeleteSupplierDto,
  BulkSupplierResponseDto,
} from '../dto/bulk-supplier.dto';
import { AddSupplierNoteDto, UpdateSupplierPerformanceDto } from '../dto/supplier-note.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectQueue('suppliers')
    private readonly supplierQueue: Queue,
  ) {}

  async create(tenantId: string, createSupplierDto: CreateSupplierDto, userId?: string): Promise<Supplier> {
    // Validasi kode supplier unik per tenant
    await this.validateCodeUnique(tenantId, createSupplierDto.code);

    // Validasi email jika ada
    if (createSupplierDto.email) {
      await this.validateEmailUnique(tenantId, createSupplierDto.email);
    }

    // Validasi kontrak
    if (createSupplierDto.contractStartDate && createSupplierDto.contractEndDate) {
      this.validateContractDates(createSupplierDto.contractStartDate, createSupplierDto.contractEndDate);
    }

    // Validasi payment terms custom
    if (createSupplierDto.paymentTerms === 'custom' && !createSupplierDto.customPaymentDays) {
      throw new BadRequestException('Custom payment days wajib diisi untuk payment terms CUSTOM');
    }

    const supplier = this.supplierRepository.create({
      ...createSupplierDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedSupplier = await this.supplierRepository.save(supplier);

    // Queue untuk indexing ke Elasticsearch
    await this.supplierQueue.add('indexSupplier', {
      supplierId: savedSupplier.id,
      action: 'create',
    });

    // Queue untuk welcome email jika ada email
    if (savedSupplier.email) {
      await this.supplierQueue.add('sendWelcomeEmail', {
        supplierId: savedSupplier.id,
        tenantId,
      });
    }

    return savedSupplier;
  }

  async findAll(tenantId: string, query: SupplierQueryDto): Promise<{
    data: Supplier[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page,
      limit,
      search,
      status,
      type,
      paymentTerms,
      currency,
      city,
      province,
      country,
      minRating,
      maxRating,
      maxLeadTime,
      contractActive,
      hasOrders,
      tags,
      sortBy,
      sortOrder,
      includeDeleted,
      includeProducts,
    } = query;

    const queryBuilder = this.supplierRepository.createQueryBuilder('supplier');

    // Include products if requested
    if (includeProducts) {
      queryBuilder.leftJoinAndSelect('supplier.products', 'products');
    }

    queryBuilder.where('supplier.tenantId = :tenantId', { tenantId });

    // Filter soft delete
    if (!includeDeleted) {
      queryBuilder.andWhere('supplier.isDeleted = :isDeleted', { isDeleted: false });
    }

    // Search across multiple fields
    if (search) {
      queryBuilder.andWhere(
        `(supplier.name ILIKE :search OR 
          supplier.code ILIKE :search OR 
          supplier.email ILIKE :search OR 
          supplier.phone ILIKE :search OR 
          supplier.mobile ILIKE :search OR
          supplier.description ILIKE :search OR
          supplier.primaryContactName ILIKE :search OR
          supplier.primaryContactEmail ILIKE :search)`,
        { search: `%${search}%` }
      );
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere('supplier.status = :status', { status });
    }

    // Type filter
    if (type) {
      queryBuilder.andWhere('supplier.type = :type', { type });
    }

    // Payment terms filter
    if (paymentTerms) {
      queryBuilder.andWhere('supplier.paymentTerms = :paymentTerms', { paymentTerms });
    }

    // Currency filter
    if (currency) {
      queryBuilder.andWhere('supplier.currency = :currency', { currency });
    }

    // Location filters
    if (city) {
      queryBuilder.andWhere('supplier.city ILIKE :city', { city: `%${city}%` });
    }
    if (province) {
      queryBuilder.andWhere('supplier.province ILIKE :province', { province: `%${province}%` });
    }
    if (country) {
      queryBuilder.andWhere('supplier.country ILIKE :country', { country: `%${country}%` });
    }

    // Rating filters
    if (minRating !== undefined) {
      queryBuilder.andWhere('supplier.rating >= :minRating', { minRating });
    }
    if (maxRating !== undefined) {
      queryBuilder.andWhere('supplier.rating <= :maxRating', { maxRating });
    }

    // Lead time filter
    if (maxLeadTime !== undefined) {
      queryBuilder.andWhere('supplier.leadTimeDays <= :maxLeadTime', { maxLeadTime });
    }

    // Contract active filter
    if (contractActive !== undefined) {
      if (contractActive) {
        queryBuilder.andWhere(
          `(supplier.contractStartDate IS NULL OR supplier.contractStartDate <= :now) AND
           (supplier.contractEndDate IS NULL OR supplier.contractEndDate >= :now)`,
          { now: new Date() }
        );
      } else {
        queryBuilder.andWhere(
          `supplier.contractEndDate IS NOT NULL AND supplier.contractEndDate < :now`,
          { now: new Date() }
        );
      }
    }

    // Has orders filter
    if (hasOrders !== undefined) {
      if (hasOrders) {
        queryBuilder.andWhere('supplier.totalOrders > 0');
      } else {
        queryBuilder.andWhere('supplier.totalOrders = 0');
      }
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      queryBuilder.andWhere('supplier.tags && :tags', { tags: tagArray });
    }

    // Sorting
    const validSortFields = [
      'name',
      'code',
      'rating',
      'totalOrders',
      'totalPurchaseAmount',
      'onTimeDeliveryRate',
      'qualityScore',
      'leadTimeDays',
      'createdAt',
      'lastOrderDate',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    queryBuilder.orderBy(`supplier.${sortField}`, sortOrder);

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

  async findOne(tenantId: string, id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['products'],
    });

    if (!supplier) {
      throw new NotFoundException('Supplier tidak ditemukan');
    }

    return supplier;
  }

  async findByCode(tenantId: string, code: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { code, tenantId, isDeleted: false },
      relations: ['products'],
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier dengan kode "${code}" tidak ditemukan`);
    }

    return supplier;
  }

  async update(tenantId: string, id: string, updateSupplierDto: UpdateSupplierDto, userId?: string): Promise<Supplier> {
    const supplier = await this.findOne(tenantId, id);

    // Validasi kode supplier jika berubah
    if (updateSupplierDto.code && updateSupplierDto.code !== supplier.code) {
      await this.validateCodeUnique(tenantId, updateSupplierDto.code, id);
    }

    // Validasi email jika berubah
    if (updateSupplierDto.email && updateSupplierDto.email !== supplier.email) {
      await this.validateEmailUnique(tenantId, updateSupplierDto.email, id);
    }

    // Validasi kontrak jika berubah
    if (updateSupplierDto.contractStartDate || updateSupplierDto.contractEndDate) {
      const startDate = updateSupplierDto.contractStartDate ?? supplier.contractStartDate;
      const endDate = updateSupplierDto.contractEndDate ?? supplier.contractEndDate;
      
      if (startDate && endDate) {
        this.validateContractDates(startDate, endDate);
      }
    }

    // Validasi payment terms custom
    if (updateSupplierDto.paymentTerms === 'custom' && !updateSupplierDto.customPaymentDays) {
      throw new BadRequestException('Custom payment days wajib diisi untuk payment terms CUSTOM');
    }

    // Update timestamps
    updateSupplierDto.updatedBy = userId;

    await this.supplierRepository.update(id, updateSupplierDto);

    // Queue untuk update index di Elasticsearch
    await this.supplierQueue.add('indexSupplier', {
      supplierId: id,
      action: 'update',
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, hardDelete: boolean = false, userId?: string): Promise<void> {
    const supplier = await this.findOne(tenantId, id);

    // Check if supplier has active products
    if (supplier.products && supplier.products.length > 0 && !hardDelete) {
      throw new BadRequestException(
        'Tidak dapat menghapus supplier yang masih memiliki produk aktif. Gunakan hard delete jika yakin.'
      );
    }

    if (hardDelete) {
      // Hard delete - hapus permanent
      await this.supplierRepository.delete(id);
    } else {
      // Soft delete
      await this.supplierRepository.update(id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      });
    }

    // Queue untuk remove index dari Elasticsearch
    await this.supplierQueue.add('indexSupplier', {
      supplierId: id,
      action: hardDelete ? 'delete' : 'softDelete',
    });
  }

  async addNote(tenantId: string, id: string, addNoteDto: AddSupplierNoteDto, userId: string): Promise<Supplier> {
    const supplier = await this.findOne(tenantId, id);
    
    supplier.addNote(addNoteDto.note, userId);
    
    await this.supplierRepository.save(supplier);
    
    return supplier;
  }

  async updatePerformance(
    tenantId: string,
    id: string,
    performanceDto: UpdateSupplierPerformanceDto
  ): Promise<Supplier> {
    const supplier = await this.findOne(tenantId, id);
    
    supplier.updatePerformance({
      amount: performanceDto.amount,
      onTime: performanceDto.onTime,
      qualityScore: performanceDto.qualityScore,
      leadTime: performanceDto.leadTime,
    });
    
    await this.supplierRepository.save(supplier);
    
    return supplier;
  }

  async bulkCreate(tenantId: string, bulkCreateDto: BulkCreateSupplierDto, userId?: string): Promise<BulkSupplierResponseDto> {
    const result: BulkSupplierResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
    };

    const queryRunner = this.supplierRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();

    for (let i = 0; i < bulkCreateDto.suppliers.length; i++) {
      const supplierDto = bulkCreateDto.suppliers[i];
      
      try {
        await queryRunner.startTransaction();
        
        const supplier = await this.create(tenantId, supplierDto, userId);
        result.successful++;
        result.successfulIds.push(supplier.id);
        
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        result.failed++;
        result.errors.push({
          code: supplierDto.code,
          index: i,
          error: error.message,
        });
      }
    }

    await queryRunner.release();
    return result;
  }

  async bulkUpdate(tenantId: string, bulkUpdateDto: BulkUpdateSupplierDto, userId?: string): Promise<BulkSupplierResponseDto> {
    const result: BulkSupplierResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
    };

    for (const supplierId of bulkUpdateDto.supplierIds) {
      try {
        await this.update(tenantId, supplierId, bulkUpdateDto.updateData, userId);
        result.successful++;
        result.successfulIds.push(supplierId);
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: result.failed - 1,
          error: error.message,
        });
      }
    }

    return result;
  }

  async bulkDelete(tenantId: string, bulkDeleteDto: BulkDeleteSupplierDto, userId?: string): Promise<BulkSupplierResponseDto> {
    const result: BulkSupplierResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
    };

    for (const supplierId of bulkDeleteDto.supplierIds) {
      try {
        await this.remove(tenantId, supplierId, bulkDeleteDto.hardDelete, userId);
        result.successful++;
        result.successfulIds.push(supplierId);
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: result.failed - 1,
          error: error.message,
        });
      }
    }

    return result;
  }

  async getSupplierStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    topPerformers: Supplier[];
    contractExpiring: number;
  }> {
    const total = await this.supplierRepository.count({
      where: { tenantId, isDeleted: false },
    });

    const active = await this.supplierRepository.count({
      where: { tenantId, status: SupplierStatus.ACTIVE, isDeleted: false },
    });

    const inactive = await this.supplierRepository.count({
      where: { tenantId, status: SupplierStatus.INACTIVE, isDeleted: false },
    });

    const suspended = await this.supplierRepository.count({
      where: { tenantId, status: SupplierStatus.SUSPENDED, isDeleted: false },
    });

    // Top performers (rating >= 4.0, sorted by rating desc)
    const topPerformers = await this.supplierRepository.find({
      where: {
        tenantId,
        isDeleted: false,
        status: SupplierStatus.ACTIVE,
      },
      order: { rating: 'DESC' },
      take: 5,
    });

    // Contracts expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const contractExpiring = await this.supplierRepository.count({
      where: {
        tenantId,
        isDeleted: false,
        contractEndDate: Between(new Date(), thirtyDaysFromNow),
      },
    });

    return {
      total,
      active,
      inactive,
      suspended,
      topPerformers,
      contractExpiring,
    };
  }

  // Private helper methods
  private async validateCodeUnique(tenantId: string, code: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, code, isDeleted: false };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingSupplier = await this.supplierRepository.findOne({
      where: whereCondition,
    });

    if (existingSupplier) {
      throw new ConflictException(`Kode supplier "${code}" sudah digunakan`);
    }
  }

  private async validateEmailUnique(tenantId: string, email: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, email, isDeleted: false };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingSupplier = await this.supplierRepository.findOne({
      where: whereCondition,
    });

    if (existingSupplier) {
      throw new ConflictException(`Email "${email}" sudah digunakan oleh supplier lain`);
    }
  }

  private validateContractDates(startDate: Date, endDate: Date): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      throw new BadRequestException('Tanggal mulai kontrak harus lebih awal dari tanggal akhir');
    }
  }
}