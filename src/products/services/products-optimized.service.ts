import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Like,
  Between,
  IsNull,
  Not,
  In,
  QueryRunner,
  SelectQueryBuilder,
} from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import {
  Product,
  ProductStatus,
  ProductType,
} from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import {
  BulkCreateProductDto,
  BulkUpdateProductDto,
  BulkDeleteProductDto,
  BulkProductResponseDto,
} from '../dto/bulk-product.dto';

// Import cache decorators
import {
  TenantCache,
  CacheEvict,
  InventoryCache,
  IndonesianBusinessCache,
  AutoRefreshCache,
} from '../../common/decorators/cacheable.decorator';

/**
 * Optimized Products Service
 *
 * Performance improvements:
 * 1. Selective relation loading based on needs
 * 2. Query result caching with intelligent invalidation
 * 3. Optimized search with full-text search indexes
 * 4. Bulk operations optimization
 * 5. Indonesian business context awareness
 * 6. Multi-level caching strategy
 *
 * Target Performance:
 * - Product list queries: 70-80% faster
 * - Search operations: 90%+ faster (with full-text search)
 * - Cache hit ratio: >85%
 * - API response time: <200ms (p95)
 */

export interface ProductSearchOptions {
  includeRelations?: (
    | 'category'
    | 'supplier'
    | 'variants'
    | 'inventoryItems'
  )[];
  useFullTextSearch?: boolean;
  cacheLevel?: 'hot' | 'warm' | 'cold';
  skipCache?: boolean;
}

export interface ProductListResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    searchTime?: number;
    cacheHit?: boolean;
  };
}

@Injectable()
export class ProductsOptimizedService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectQueue('products')
    private readonly productQueue: Queue,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Create product with optimized validation and caching
   */
  @CacheEvict(['products:list', 'products:search', 'products:count'])
  async create(
    tenantId: string,
    createProductDto: CreateProductDto,
    userId?: string,
  ): Promise<Product> {
    // Batch validation untuk performance
    await this.batchValidation(tenantId, createProductDto);

    const product = this.productRepository.create({
      ...createProductDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedProduct = await this.productRepository.save(product);

    // Async queue operations (non-blocking)
    setImmediate(async () => {
      if (!createProductDto.barcode) {
        await this.productQueue.add('generateBarcode', {
          productId: savedProduct.id,
          tenantId,
        });
      }

      await this.productQueue.add('indexProduct', {
        productId: savedProduct.id,
        action: 'create',
      });
    });

    return savedProduct;
  }

  /**
   * Optimized product listing with intelligent caching and selective loading
   */
  @TenantCache('products:list', {
    level: 'warm',
    ttl: 900, // 15 minutes
    tags: ['products', 'inventory'],
  })
  async findAll(
    tenantId: string,
    query: ProductQueryDto,
    options: ProductSearchOptions = {},
  ): Promise<ProductListResponse> {
    const startTime = Date.now();
    const { includeRelations = [], useFullTextSearch = true } = options;

    try {
      // Build optimized query with selective relation loading
      const queryBuilder = this.buildOptimizedQuery(
        tenantId,
        query,
        includeRelations,
      );

      // Use full-text search for better performance if enabled and search exists
      if (query.search && useFullTextSearch) {
        this.applyFullTextSearch(queryBuilder, query.search);
      } else if (query.search) {
        this.applyTraditionalSearch(queryBuilder, query.search);
      }

      // Apply filters
      this.applyFilters(queryBuilder, query);

      // Apply sorting with optimized fields
      this.applySorting(queryBuilder, query.sortBy, query.sortOrder);

      // Apply pagination
      const skip = ((query.page || 1) - 1) * (query.limit || 50);
      queryBuilder.skip(skip).take(query.limit || 50);

      // Execute optimized query
      const [data, total] = await queryBuilder.getManyAndCount();

      const searchTime = Date.now() - startTime;

      return {
        data,
        meta: {
          total,
          page: query.page || 1,
          limit: query.limit || 50,
          totalPages: Math.ceil(total / (query.limit || 50)),
          searchTime,
          cacheHit: false, // Will be set by cache interceptor
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Error in product search: ${error.message}`,
      );
    }
  }

  /**
   * Optimized single product retrieval with smart relation loading
   */
  @TenantCache('products:detail', {
    level: 'hot',
    ttl: 300, // 5 minutes for hot data
    tags: ['products'],
  })
  async findOne(
    tenantId: string,
    id: string,
    includeRelations: (
      | 'category'
      | 'supplier'
      | 'variants'
      | 'inventoryItems'
    )[] = ['category', 'supplier'],
  ): Promise<Product> {
    try {
      // Build query with only required relations
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')
        .where('product.id = :id', { id })
        .andWhere('product.tenantId = :tenantId', { tenantId })
        .andWhere('product.isDeleted = :isDeleted', { isDeleted: false });

      // Add relations selectively
      includeRelations.forEach(relation => {
        switch (relation) {
          case 'category':
            queryBuilder.leftJoinAndSelect('product.category', 'category');
            break;
          case 'supplier':
            queryBuilder.leftJoinAndSelect('product.supplier', 'supplier');
            break;
          case 'variants':
            queryBuilder.leftJoinAndSelect('product.variants', 'variants');
            break;
          case 'inventoryItems':
            queryBuilder.leftJoinAndSelect(
              'product.inventoryItems',
              'inventoryItems',
            );
            break;
        }
      });

      const product = await queryBuilder.getOne();

      if (!product) {
        throw new NotFoundException('Produk tidak ditemukan');
      }

      // Async increment view count (non-blocking)
      setImmediate(async () => {
        await this.productRepository.increment({ id }, 'viewCount', 1);
      });

      return product;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving product: ${error.message}`,
      );
    }
  }

  /**
   * Optimized SKU lookup with caching
   */
  @TenantCache('products:sku', {
    level: 'hot',
    ttl: 600, // 10 minutes
    tags: ['products'],
  })
  async findBySku(tenantId: string, sku: string): Promise<Product> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .where('product.sku = :sku', { sku })
      .andWhere('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
      .getOne();

    if (!product) {
      throw new NotFoundException(`Produk dengan SKU "${sku}" tidak ditemukan`);
    }

    return product;
  }

  /**
   * Optimized barcode lookup with caching
   */
  @TenantCache('products:barcode', {
    level: 'hot',
    ttl: 600, // 10 minutes
    tags: ['products'],
  })
  async findByBarcode(tenantId: string, barcode: string): Promise<Product> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .where('product.barcode = :barcode', { barcode })
      .andWhere('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
      .getOne();

    if (!product) {
      throw new NotFoundException(
        `Produk dengan barcode "${barcode}" tidak ditemukan`,
      );
    }

    return product;
  }

  /**
   * Update product with intelligent cache invalidation
   */
  @CacheEvict([
    'products:list',
    'products:search',
    'products:detail',
    'products:sku',
    'products:barcode',
  ])
  async update(
    tenantId: string,
    id: string,
    updateProductDto: UpdateProductDto,
    userId?: string,
  ): Promise<Product> {
    const product = await this.findOne(tenantId, id, []); // No relations needed for validation

    // Batch validation untuk performance
    await this.batchValidationForUpdate(tenantId, updateProductDto, product);

    // Update timestamps
    updateProductDto.updatedBy = userId;

    await this.productRepository.update(id, updateProductDto);

    // Async index update (non-blocking)
    setImmediate(async () => {
      await this.productQueue.add('indexProduct', {
        productId: id,
        action: 'update',
      });
    });

    return this.findOne(tenantId, id);
  }

  /**
   * Remove product with cache invalidation
   */
  @CacheEvict([
    'products:list',
    'products:search',
    'products:detail',
    'products:sku',
    'products:barcode',
  ])
  async remove(
    tenantId: string,
    id: string,
    hardDelete: boolean = false,
    userId?: string,
  ): Promise<void> {
    const product = await this.findOne(tenantId, id, []);

    if (hardDelete) {
      await this.productRepository.delete(id);
    } else {
      await this.productRepository.update(id, {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      });
    }

    // Async index update (non-blocking)
    setImmediate(async () => {
      await this.productQueue.add('indexProduct', {
        productId: id,
        action: hardDelete ? 'delete' : 'softDelete',
      });
    });
  }

  /**
   * High-performance product search with full-text search
   */
  @IndonesianBusinessCache('products:search', {
    province: 'WIB',
    peakHoursTTL: 180, // 3 minutes during peak hours
    normalTTL: 600, // 10 minutes normally
    tags: ['products', 'search'],
  })
  async searchProducts(
    tenantId: string,
    searchQuery: string,
    limit: number = 20,
  ): Promise<Product[]> {
    try {
      // Use PostgreSQL full-text search for optimal performance
      const products = await this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.tenantId = :tenantId', { tenantId })
        .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere(
          `
          to_tsvector('indonesian', 
            COALESCE(product.name, '') || ' ' || 
            COALESCE(product.description, '') || ' ' || 
            COALESCE(product.sku, '') || ' ' ||
            COALESCE(product.barcode, '')
          ) @@ plainto_tsquery('indonesian', :searchQuery)
        `,
          { searchQuery },
        )
        .orderBy(
          `
          ts_rank(
            to_tsvector('indonesian', 
              COALESCE(product.name, '') || ' ' || 
              COALESCE(product.description, '') || ' ' || 
              COALESCE(product.sku, '') || ' ' ||
              COALESCE(product.barcode, '')
            ), 
            plainto_tsquery('indonesian', :searchQuery)
          )
        `,
          'DESC',
        )
        .limit(limit)
        .getMany();

      return products;
    } catch (error) {
      // Fallback to traditional ILIKE search if full-text search fails
      return this.fallbackSearch(tenantId, searchQuery, limit);
    }
  }

  /**
   * Get low stock products with caching
   */
  @InventoryCache('products:lowstock', {
    ttl: 300,
    tags: ['products', 'inventory', 'alerts'],
  })
  async getLowStockProducts(
    tenantId: string,
    threshold?: number,
  ): Promise<Product[]> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.inventoryItems', 'inventoryItems')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('product.trackStock = :trackStock', { trackStock: true });

    if (threshold) {
      query
        .andWhere('product.minStock > 0')
        .andWhere('inventoryItems.quantityOnHand <= :threshold', { threshold });
    } else {
      query
        .andWhere('product.minStock > 0')
        .andWhere('inventoryItems.quantityOnHand <= product.minStock');
    }

    return query.getMany();
  }

  /**
   * Get product analytics with caching
   */
  @TenantCache('products:analytics', {
    level: 'cold',
    ttl: 3600, // 1 hour
    tags: ['products', 'analytics'],
  })
  async getProductAnalytics(tenantId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    lowStockProducts: number;
    totalCategories: number;
    avgPrice: number;
    topSellingProducts: Product[];
  }> {
    const [
      totalProducts,
      activeProducts,
      lowStockCount,
      categoryCount,
      avgPriceResult,
      topSelling,
    ] = await Promise.all([
      // Total products
      this.productRepository.count({
        where: { tenantId, isDeleted: false },
      }),

      // Active products
      this.productRepository.count({
        where: { tenantId, isDeleted: false, status: ProductStatus.ACTIVE },
      }),

      // Low stock products count
      this.getLowStockProducts(tenantId).then(products => products.length),

      // Total categories (placeholder - would need category service)
      this.productRepository
        .createQueryBuilder('product')
        .select('COUNT(DISTINCT product.categoryId)', 'count')
        .where('product.tenantId = :tenantId', { tenantId })
        .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
        .getRawOne(),

      // Average price
      this.productRepository
        .createQueryBuilder('product')
        .select('AVG(product.sellingPrice)', 'avgPrice')
        .where('product.tenantId = :tenantId', { tenantId })
        .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere('product.sellingPrice > 0')
        .getRawOne(),

      // Top selling products
      this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.tenantId = :tenantId', { tenantId })
        .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
        .orderBy('product.salesCount', 'DESC')
        .limit(10)
        .getMany(),
    ]);

    return {
      totalProducts,
      activeProducts,
      lowStockProducts: lowStockCount,
      totalCategories: parseInt(categoryCount?.count || '0'),
      avgPrice: parseFloat(avgPriceResult?.avgPrice || '0'),
      topSellingProducts: topSelling,
    };
  }

  // ===== PRIVATE OPTIMIZATION METHODS =====

  private buildOptimizedQuery(
    tenantId: string,
    query: ProductQueryDto,
    includeRelations: string[],
  ): SelectQueryBuilder<Product> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .where('product.tenantId = :tenantId', { tenantId });

    // Add relations only if requested
    if (includeRelations.includes('category')) {
      queryBuilder.leftJoinAndSelect('product.category', 'category');
    }
    if (includeRelations.includes('supplier')) {
      queryBuilder.leftJoinAndSelect('product.supplier', 'supplier');
    }
    if (includeRelations.includes('variants')) {
      queryBuilder.leftJoinAndSelect('product.variants', 'variants');
    }
    if (includeRelations.includes('inventoryItems')) {
      queryBuilder.leftJoinAndSelect(
        'product.inventoryItems',
        'inventoryItems',
      );
    }

    // Filter soft delete
    if (!query.includeDeleted) {
      queryBuilder.andWhere('product.isDeleted = :isDeleted', {
        isDeleted: false,
      });
    }

    return queryBuilder;
  }

  private applyFullTextSearch(
    queryBuilder: SelectQueryBuilder<Product>,
    search: string,
  ): void {
    queryBuilder.andWhere(
      `
      to_tsvector('indonesian', 
        COALESCE(product.name, '') || ' ' || 
        COALESCE(product.description, '') || ' ' || 
        COALESCE(product.sku, '') || ' ' ||
        COALESCE(product.barcode, '')
      ) @@ plainto_tsquery('indonesian', :search)
    `,
      { search },
    );

    // Add ranking for better results
    queryBuilder.addSelect(
      `
      ts_rank(
        to_tsvector('indonesian', 
          COALESCE(product.name, '') || ' ' || 
          COALESCE(product.description, '') || ' ' || 
          COALESCE(product.sku, '') || ' ' ||
          COALESCE(product.barcode, '')
        ), 
        plainto_tsquery('indonesian', :search)
      )
    `,
      'search_rank',
    );
  }

  private applyTraditionalSearch(
    queryBuilder: SelectQueryBuilder<Product>,
    search: string,
  ): void {
    queryBuilder.andWhere(
      '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search OR product.description ILIKE :search)',
      { search: `%${search}%` },
    );
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Product>,
    query: ProductQueryDto,
  ): void {
    const {
      status,
      type,
      categoryId,
      brand,
      supplier,
      minPrice,
      maxPrice,
      lowStock,
      outOfStock,
      expiringSoon,
    } = query;

    if (status) {
      queryBuilder.andWhere('product.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('product.type = :type', { type });
    }

    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    if (brand) {
      queryBuilder.andWhere('product.brand ILIKE :brand', {
        brand: `%${brand}%`,
      });
    }

    if (supplier) {
      queryBuilder.andWhere(
        'supplier.name ILIKE :supplier OR supplier.code ILIKE :supplier',
        {
          supplier: `%${supplier}%`,
        },
      );
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.sellingPrice >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.sellingPrice <= :maxPrice', { maxPrice });
    }

    if (lowStock) {
      queryBuilder.andWhere('product.minStock > 0');
    }

    if (outOfStock) {
      queryBuilder.andWhere('product.trackStock = :trackStock', {
        trackStock: true,
      });
    }

    if (expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      queryBuilder
        .andWhere('product.expiryDate IS NOT NULL')
        .andWhere('product.expiryDate <= :thirtyDaysFromNow', {
          thirtyDaysFromNow,
        })
        .andWhere('product.expiryDate > :now', { now: new Date() });
    }
  }

  private applySorting(
    queryBuilder: SelectQueryBuilder<Product>,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): void {
    const validSortFields = [
      'name',
      'sku',
      'sellingPrice',
      'costPrice',
      'createdAt',
      'salesCount',
    ];
    const sortField = validSortFields.includes(sortBy || '')
      ? sortBy
      : 'createdAt';
    const order = sortOrder || 'DESC';

    // Add search ranking if available
    if (
      queryBuilder.expressionMap.selects.some(
        select => select.aliasName === 'search_rank',
      )
    ) {
      queryBuilder
        .orderBy('search_rank', 'DESC')
        .addOrderBy(`product.${sortField}`, order);
    } else {
      queryBuilder.orderBy(`product.${sortField}`, order);
    }
  }

  private async fallbackSearch(
    tenantId: string,
    searchQuery: string,
    limit: number,
  ): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${searchQuery}%` },
      )
      .orderBy('product.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  private async batchValidation(
    tenantId: string,
    createProductDto: CreateProductDto,
  ): Promise<void> {
    const validationPromises: Promise<void>[] = [
      this.validateSkuUnique(tenantId, createProductDto.sku),
    ];

    if (createProductDto.barcode) {
      validationPromises.push(
        this.validateBarcodeUnique(tenantId, createProductDto.barcode),
      );
    }

    await Promise.all(validationPromises);
    this.validatePricing(
      createProductDto.costPrice,
      createProductDto.sellingPrice,
      createProductDto.wholesalePrice,
    );
  }

  private async batchValidationForUpdate(
    tenantId: string,
    updateProductDto: UpdateProductDto,
    existingProduct: Product,
  ): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      validationPromises.push(
        this.validateSkuUnique(
          tenantId,
          updateProductDto.sku,
          existingProduct.id,
        ),
      );
    }

    if (
      updateProductDto.barcode &&
      updateProductDto.barcode !== existingProduct.barcode
    ) {
      validationPromises.push(
        this.validateBarcodeUnique(
          tenantId,
          updateProductDto.barcode,
          existingProduct.id,
        ),
      );
    }

    await Promise.all(validationPromises);

    if (
      updateProductDto.costPrice !== undefined ||
      updateProductDto.sellingPrice !== undefined ||
      updateProductDto.wholesalePrice !== undefined
    ) {
      const costPrice = updateProductDto.costPrice ?? existingProduct.costPrice;
      const sellingPrice =
        updateProductDto.sellingPrice ?? existingProduct.sellingPrice;
      const wholesalePrice =
        updateProductDto.wholesalePrice ?? existingProduct.wholesalePrice;

      this.validatePricing(costPrice, sellingPrice, wholesalePrice);
    }
  }

  private async validateSkuUnique(
    tenantId: string,
    sku: string,
    excludeId?: string,
  ): Promise<void> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.sku = :sku', { sku })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false });

    if (excludeId) {
      query.andWhere('product.id != :excludeId', { excludeId });
    }

    const existingProduct = await query.getOne();
    if (existingProduct) {
      throw new ConflictException(`SKU "${sku}" sudah digunakan`);
    }
  }

  private async validateBarcodeUnique(
    tenantId: string,
    barcode: string,
    excludeId?: string,
  ): Promise<void> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.barcode = :barcode', { barcode })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false });

    if (excludeId) {
      query.andWhere('product.id != :excludeId', { excludeId });
    }

    const existingProduct = await query.getOne();
    if (existingProduct) {
      throw new ConflictException(`Barcode "${barcode}" sudah digunakan`);
    }
  }

  private validatePricing(
    costPrice: number,
    sellingPrice: number,
    wholesalePrice?: number,
  ): void {
    if (costPrice < 0 || sellingPrice < 0) {
      throw new BadRequestException('Harga tidak boleh negatif');
    }

    if (sellingPrice < costPrice) {
      throw new BadRequestException(
        'Harga jual tidak boleh lebih kecil dari harga pokok',
      );
    }

    if (
      wholesalePrice &&
      (wholesalePrice < costPrice || wholesalePrice > sellingPrice)
    ) {
      throw new BadRequestException(
        'Harga grosir harus berada di antara harga pokok dan harga jual',
      );
    }
  }
}
