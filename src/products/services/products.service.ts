import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, IsNull, Not, In, QueryRunner } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Product, ProductStatus, ProductType } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { BulkCreateProductDto, BulkUpdateProductDto, BulkDeleteProductDto, BulkProductResponseDto } from '../dto/bulk-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectQueue('products')
    private readonly productQueue: Queue,
  ) {}

  async create(tenantId: string, createProductDto: CreateProductDto, userId?: string): Promise<Product> {
    // Validasi SKU unik per tenant
    await this.validateSkuUnique(tenantId, createProductDto.sku);

    // Validasi barcode jika ada
    if (createProductDto.barcode) {
      await this.validateBarcodeUnique(tenantId, createProductDto.barcode);
    }

    // Validasi harga
    this.validatePricing(createProductDto.costPrice, createProductDto.sellingPrice, createProductDto.wholesalePrice);

    const product = this.productRepository.create({
      ...createProductDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedProduct = await this.productRepository.save(product);

    // Queue untuk generate barcode jika tidak ada
    if (!createProductDto.barcode) {
      await this.productQueue.add('generateBarcode', {
        productId: savedProduct.id,
        tenantId,
      });
    }

    // Queue untuk indexing ke Elasticsearch
    await this.productQueue.add('indexProduct', {
      productId: savedProduct.id,
      action: 'create',
    });

    return savedProduct;
  }

  async findAll(tenantId: string, query: ProductQueryDto): Promise<{
    data: Product[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { page, limit, search, status, type, categoryId, brand, supplier, 
            minPrice, maxPrice, lowStock, outOfStock, expiringSoon, 
            sortBy, sortOrder, includeDeleted } = query;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('product.variants', 'variants')
      .where('product.tenantId = :tenantId', { tenantId });

    // Filter soft delete
    if (!includeDeleted) {
      queryBuilder.andWhere('product.isDeleted = :isDeleted', { isDeleted: false });
    }

    // Search
    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search OR product.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere('product.status = :status', { status });
    }

    // Type filter
    if (type) {
      queryBuilder.andWhere('product.type = :type', { type });
    }

    // Category filter
    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    // Brand filter
    if (brand) {
      queryBuilder.andWhere('product.brand ILIKE :brand', { brand: `%${brand}%` });
    }

    // Supplier filter
    if (supplier) {
      queryBuilder.andWhere('supplier.name ILIKE :supplier OR supplier.code ILIKE :supplier', { supplier: `%${supplier}%` });
    }

    // Price range filter
    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.sellingPrice >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.sellingPrice <= :maxPrice', { maxPrice });
    }

    // Stock filters (would need inventory data - placeholder logic)
    if (lowStock) {
      // This would need inventory integration
      queryBuilder.andWhere('product.minStock > 0'); // Placeholder
    }
    if (outOfStock) {
      // This would need inventory integration
      queryBuilder.andWhere('product.trackStock = :trackStock', { trackStock: true }); // Placeholder
    }

    // Expiring soon filter
    if (expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      queryBuilder.andWhere('product.expiryDate IS NOT NULL')
                  .andWhere('product.expiryDate <= :thirtyDaysFromNow', { thirtyDaysFromNow })
                  .andWhere('product.expiryDate > :now', { now: new Date() });
    }

    // Sorting
    const validSortFields = ['name', 'sku', 'sellingPrice', 'costPrice', 'createdAt', 'salesCount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`product.${sortField}`, sortOrder);

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

  async findOne(tenantId: string, id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['category', 'supplier', 'variants', 'inventoryItems'],
    });

    if (!product) {
      throw new NotFoundException('Produk tidak ditemukan');
    }

    // Increment view count
    await this.productRepository.update(id, { 
      viewCount: () => 'viewCount + 1',
    });

    return product;
  }

  async findBySku(tenantId: string, sku: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { sku, tenantId, isDeleted: false },
      relations: ['category', 'supplier', 'variants'],
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan SKU "${sku}" tidak ditemukan`);
    }

    return product;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { barcode, tenantId, isDeleted: false },
      relations: ['category', 'supplier', 'variants'],
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan barcode "${barcode}" tidak ditemukan`);
    }

    return product;
  }

  async update(tenantId: string, id: string, updateProductDto: UpdateProductDto, userId?: string): Promise<Product> {
    const product = await this.findOne(tenantId, id);

    // Validasi SKU jika berubah
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      await this.validateSkuUnique(tenantId, updateProductDto.sku, id);
    }

    // Validasi barcode jika berubah
    if (updateProductDto.barcode && updateProductDto.barcode !== product.barcode) {
      await this.validateBarcodeUnique(tenantId, updateProductDto.barcode, id);
    }

    // Validasi harga jika berubah
    if (updateProductDto.costPrice !== undefined || updateProductDto.sellingPrice !== undefined || updateProductDto.wholesalePrice !== undefined) {
      const costPrice = updateProductDto.costPrice ?? product.costPrice;
      const sellingPrice = updateProductDto.sellingPrice ?? product.sellingPrice;
      const wholesalePrice = updateProductDto.wholesalePrice ?? product.wholesalePrice;
      
      this.validatePricing(costPrice, sellingPrice, wholesalePrice);
    }

    // Update timestamps
    updateProductDto.updatedBy = userId;

    await this.productRepository.update(id, updateProductDto);

    // Queue untuk update index di Elasticsearch
    await this.productQueue.add('indexProduct', {
      productId: id,
      action: 'update',
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, hardDelete: boolean = false, userId?: string): Promise<void> {
    const product = await this.findOne(tenantId, id);

    if (hardDelete) {
      // Hard delete - hapus permanent
      await this.productRepository.delete(id);
    } else {
      // Soft delete
      await this.productRepository.update(id, {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      });
    }

    // Queue untuk remove index dari Elasticsearch
    await this.productQueue.add('indexProduct', {
      productId: id,
      action: hardDelete ? 'delete' : 'softDelete',
    });
  }

  async bulkCreate(tenantId: string, bulkCreateDto: BulkCreateProductDto, userId?: string): Promise<BulkProductResponseDto> {
    const result: BulkProductResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
    };

    const queryRunner = this.productRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();

    for (let i = 0; i < bulkCreateDto.products.length; i++) {
      const productDto = bulkCreateDto.products[i];
      
      try {
        await queryRunner.startTransaction();
        
        const product = await this.create(tenantId, productDto, userId);
        result.successful++;
        result.successfulIds.push(product.id);
        
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        result.failed++;
        result.errors.push({
          sku: productDto.sku,
          index: i,
          error: error.message,
        });
      }
    }

    await queryRunner.release();
    return result;
  }

  async bulkUpdate(tenantId: string, bulkUpdateDto: BulkUpdateProductDto, userId?: string): Promise<BulkProductResponseDto> {
    const result: BulkProductResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
    };

    for (const productId of bulkUpdateDto.productIds) {
      try {
        await this.update(tenantId, productId, bulkUpdateDto.updateData, userId);
        result.successful++;
        result.successfulIds.push(productId);
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

  async bulkDelete(tenantId: string, bulkDeleteDto: BulkDeleteProductDto, userId?: string): Promise<BulkProductResponseDto> {
    const result: BulkProductResponseDto = {
      successful: 0,
      failed: 0,
      errors: [],
      successfulIds: [],
    };

    for (const productId of bulkDeleteDto.productIds) {
      try {
        await this.remove(tenantId, productId, bulkDeleteDto.hardDelete, userId);
        result.successful++;
        result.successfulIds.push(productId);
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

  async getProductStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
  }> {
    const total = await this.productRepository.count({
      where: { tenantId, isDeleted: false },
    });

    const active = await this.productRepository.count({
      where: { tenantId, status: ProductStatus.ACTIVE, isDeleted: false },
    });

    const inactive = await this.productRepository.count({
      where: { tenantId, status: ProductStatus.INACTIVE, isDeleted: false },
    });

    // For low stock and out of stock, we'd need inventory integration
    // For now, returning placeholder values
    const lowStock = 0;
    const outOfStock = 0;

    // Expiring soon calculation
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringSoon = await this.productRepository.count({
      where: {
        tenantId,
        isDeleted: false,
        expiryDate: Between(new Date(), thirtyDaysFromNow),
      },
    });

    return {
      total,
      active,
      inactive,
      lowStock,
      outOfStock,
      expiringSoon,
    };
  }

  // Private helper methods
  private async validateSkuUnique(tenantId: string, sku: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, sku, isDeleted: false };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingProduct = await this.productRepository.findOne({
      where: whereCondition,
    });

    if (existingProduct) {
      throw new ConflictException(`SKU "${sku}" sudah digunakan`);
    }
  }

  private async validateBarcodeUnique(tenantId: string, barcode: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, barcode, isDeleted: false };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingProduct = await this.productRepository.findOne({
      where: whereCondition,
    });

    if (existingProduct) {
      throw new ConflictException(`Barcode "${barcode}" sudah digunakan`);
    }
  }

  private validatePricing(costPrice: number, sellingPrice: number, wholesalePrice?: number): void {
    if (sellingPrice < costPrice) {
      throw new BadRequestException('Harga jual tidak boleh lebih rendah dari harga modal');
    }

    if (wholesalePrice !== undefined && wholesalePrice < costPrice) {
      throw new BadRequestException('Harga grosir tidak boleh lebih rendah dari harga modal');
    }

    if (wholesalePrice !== undefined && wholesalePrice > sellingPrice) {
      throw new BadRequestException('Harga grosir tidak boleh lebih tinggi dari harga jual');
    }
  }
}