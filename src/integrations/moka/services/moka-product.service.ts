import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { MokaApiService, MokaCredentials, MokaProduct, MokaApiRequest } from './moka-api.service';
import { MokaAuthService } from './moka-auth.service';
import { Product, ProductStatus } from '../../../products/entities/product.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface ProductSyncOptions {
  includeVariants?: boolean;
  includeCategories?: boolean;
  batchSize?: number;
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
  categoryMapping?: Record<string, string>; // Moka category ID -> Internal category ID
}

@Injectable()
export class MokaProductService {
  private readonly logger = new Logger(MokaProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    private readonly mokaApiService: MokaApiService,
    private readonly authService: MokaAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Sync products from Moka to local system
   */
  async syncProductsFromMoka(
    tenantId: string,
    channelId: string,
    options: ProductSyncOptions = {},
  ): Promise<{
    success: boolean;
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_products_inbound',
        'started',
        'Starting product sync from Moka',
        { options },
      );

      // Get categories first if needed
      let categoryMapping: Record<string, string> = {};
      if (options.includeCategories) {
        categoryMapping = await this.syncCategoriesFromMoka(tenantId, channelId, credentials);
      }

      // Get all products from Moka with pagination
      let page = 1;
      const limit = options.batchSize || 50;
      let hasMorePages = true;

      while (hasMorePages) {
        try {
          const productList = await this.mokaApiService.getProducts(
            credentials,
            tenantId,
            channelId,
            { page, limit, is_active: true },
          );

          if (!productList.success || !productList.data) {
            throw new Error(`Failed to get product list: ${productList.error?.message}`);
          }

          const products = productList.data.data;
          
          // Process products in this page
          for (const mokaProduct of products) {
            try {
              await this.syncSingleProductFromMoka(
                tenantId,
                channelId,
                mokaProduct,
                categoryMapping,
                options,
              );
              syncedCount++;
            } catch (error) {
              this.logger.error(`Failed to sync product ${mokaProduct.id}: ${error.message}`);
              errors.push(`Product ${mokaProduct.name} (${mokaProduct.id}): ${error.message}`);
              errorCount++;
            }
          }

          // Check if there are more pages
          hasMorePages = page < productList.data.pagination.total_pages;
          page++;

        } catch (error) {
          this.logger.error(`Product batch sync failed for page ${page}: ${error.message}`, error.stack);
          errorCount += limit; // Estimate failed items
          errors.push(`Page ${page} sync failed: ${error.message}`);
          break;
        }
      }

      const duration = Date.now() - startTime;
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_products_inbound',
        'completed',
        `Product sync completed: ${syncedCount} synced, ${errorCount} errors`,
        { syncedCount, errorCount, duration, totalPages: page - 1 },
      );

      return {
        success: true,
        syncedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Product sync failed: ${error.message}`, error.stack);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_products_inbound',
        'failed',
        error.message,
        { syncedCount, errorCount },
      );

      return {
        success: false,
        syncedCount,
        errorCount,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Sync single product to Moka
   */
  async syncProductToMoka(
    tenantId: string,
    channelId: string,
    productId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      const product = await this.getProductWithDetails(tenantId, productId);

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Check if product already exists on Moka
      const mapping = await this.mappingRepository.findOne({
        where: {
          tenantId,
          channelId,
          entityType: 'product',
          internalId: productId,
        },
      });

      let result;
      if (mapping?.externalId) {
        // Update existing product
        result = await this.updateMokaProduct(
          credentials,
          tenantId,
          channelId,
          mapping.externalId,
          product,
        );
      } else {
        // Create new product
        result = await this.createMokaProduct(
          credentials,
          tenantId,
          channelId,
          product,
        );
      }

      if (result.success && result.data) {
        // Save or update mapping
        await this.saveProductMapping(
          tenantId,
          channelId,
          productId,
          result.data.id,
          result.data,
        );

        await this.logService.logSync(
          tenantId,
          channelId,
          'moka_product_outbound',
          'completed',
          `Product ${product.name} synced to Moka`,
          { productId, externalId: result.data.id },
        );

        return {
          success: true,
          externalId: result.data.id,
        };
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }

    } catch (error) {
      this.logger.error(`Product sync to Moka failed: ${error.message}`, error.stack);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'moka_product_outbound',
        'failed',
        error.message,
        { productId },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get product details from Moka
   */
  async getMokaProductDetails(
    tenantId: string,
    channelId: string,
    mokaProductId: string,
  ): Promise<{ success: boolean; data?: MokaProduct; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const response = await this.mokaApiService.getProduct(
        credentials,
        mokaProductId,
        tenantId,
        channelId,
      );

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Product not found',
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get Moka product details: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete product from Moka
   */
  async deleteMokaProduct(
    tenantId: string,
    channelId: string,
    mokaProductId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const response = await this.mokaApiService.deleteProduct(
        credentials,
        mokaProductId,
        tenantId,
        channelId,
      );

      if (response.success) {
        // Remove mapping
        await this.mappingRepository.delete({
          tenantId,
          channelId,
          entityType: 'product',
          externalId: mokaProductId,
        });

        await this.logService.logSync(
          tenantId,
          channelId,
          'moka_product_delete',
          'completed',
          `Product ${mokaProductId} deleted from Moka`,
          { mokaProductId },
        );

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Delete failed',
        };
      }

    } catch (error) {
      this.logger.error(`Failed to delete Moka product: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async syncCategoriesFromMoka(
    tenantId: string,
    channelId: string,
    credentials: MokaCredentials,
  ): Promise<Record<string, string>> {
    try {
      const response = await this.mokaApiService.getCategories(
        credentials,
        tenantId,
        channelId,
      );

      if (!response.success || !response.data) {
        this.logger.warn('Failed to sync categories from Moka');
        return {};
      }

      const mapping: Record<string, string> = {};
      
      // For now, we'll just log the categories
      // In a full implementation, you'd create/update categories in your system
      for (const category of response.data) {
        this.logger.debug(`Moka category: ${category.name} (${category.id})`);
        // mapping[category.id] = internalCategoryId;
      }

      return mapping;

    } catch (error) {
      this.logger.error(`Failed to sync categories: ${error.message}`);
      return {};
    }
  }

  private async syncSingleProductFromMoka(
    tenantId: string,
    channelId: string,
    mokaProduct: MokaProduct,
    categoryMapping: Record<string, string>,
    options: ProductSyncOptions,
  ): Promise<void> {
    // Check if product mapping exists
    let mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: mokaProduct.id,
      },
    });

    let product: Product;

    if (mapping) {
      // Update existing product
      product = await this.productRepository.findOne({
        where: { id: mapping.internalId, tenantId },
      });

      if (product) {
        this.updateProductFromMoka(product, mokaProduct, categoryMapping);
        await this.productRepository.save(product);
      }
    } else {
      // Create new product
      product = await this.createProductFromMoka(tenantId, mokaProduct, categoryMapping);
      await this.productRepository.save(product);

      // Create mapping
      mapping = await this.saveProductMapping(
        tenantId,
        channelId,
        product.id,
        mokaProduct.id,
        mokaProduct,
      );
    }

    // Sync variants if enabled and product has variants
    if (options.includeVariants && mokaProduct.variants && mokaProduct.variants.length > 0) {
      await this.syncProductVariants(
        tenantId,
        channelId,
        product.id,
        mokaProduct.variants,
      );
    }

    // Emit sync event
    this.eventEmitter.emit('product.synced.moka', {
      tenantId,
      channelId,
      productId: product.id,
      externalId: mokaProduct.id,
      syncDirection: 'inbound',
    });
  }

  private async createProductFromMoka(
    tenantId: string,
    mokaProduct: MokaProduct,
    categoryMapping: Record<string, string>,
  ): Promise<Product> {
    const product = this.productRepository.create({
      tenantId,
      name: mokaProduct.name,
      description: mokaProduct.description,
      sku: mokaProduct.sku,
      status: this.mokaApiService.mapMokaProductStatus(mokaProduct.is_active) as ProductStatus,
      costPrice: mokaProduct.cost,
      sellingPrice: mokaProduct.price,
      unit: mokaProduct.unit,
      barcode: mokaProduct.barcode,
      image: mokaProduct.image_url,
      trackStock: mokaProduct.track_stock,
      allowBackorder: mokaProduct.allow_out_of_stock,
      categoryId: categoryMapping[mokaProduct.category_id] || null,
      metadata: {
        moka: {
          categoryId: mokaProduct.category_id,
          categoryName: mokaProduct.category_name,
          isActive: mokaProduct.is_active,
          trackStock: mokaProduct.track_stock,
          allowOutOfStock: mokaProduct.allow_out_of_stock,
          lastSyncAt: new Date(),
        },
      },
    });

    return product;
  }

  private updateProductFromMoka(
    product: Product,
    mokaProduct: MokaProduct,
    categoryMapping: Record<string, string>,
  ): void {
    product.name = mokaProduct.name;
    product.description = mokaProduct.description;
    product.sku = mokaProduct.sku;
    product.status = this.mokaApiService.mapMokaProductStatus(mokaProduct.is_active) as ProductStatus;
    product.costPrice = mokaProduct.cost;
    product.sellingPrice = mokaProduct.price;
    product.unit = mokaProduct.unit;
    product.barcode = mokaProduct.barcode;
    product.image = mokaProduct.image_url;
    product.trackStock = mokaProduct.track_stock;
    product.allowBackorder = mokaProduct.allow_out_of_stock;
    product.categoryId = categoryMapping[mokaProduct.category_id] || product.categoryId;
    
    product.metadata = {
      ...product.metadata,
      moka: {
        categoryId: mokaProduct.category_id,
        categoryName: mokaProduct.category_name,
        isActive: mokaProduct.is_active,
        trackStock: mokaProduct.track_stock,
        allowOutOfStock: mokaProduct.allow_out_of_stock,
        lastSyncAt: new Date(),
      },
    };
  }

  private async saveProductMapping(
    tenantId: string,
    channelId: string,
    internalId: string,
    externalId: string,
    externalData: any,
  ): Promise<ChannelMapping> {
    const mapping = this.mappingRepository.create({
      tenantId,
      channelId,
      entityType: 'product',
      internalId,
      externalId,
      externalData,
      lastSyncAt: new Date(),
    });

    return await this.mappingRepository.save(mapping);
  }

  private async getProductWithDetails(
    tenantId: string,
    productId: string,
  ): Promise<Product | null> {
    return await this.productRepository.findOne({
      where: { id: productId, tenantId },
      relations: ['variants'],
    });
  }

  private async createMokaProduct(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
    product: Product,
  ): Promise<any> {
    const productData: Partial<MokaProduct> = {
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.sellingPrice,
      cost: product.costPrice,
      unit: product.unit || 'pcs',
      barcode: product.barcode,
      is_active: this.mokaApiService.mapToMokaProductStatus(product.status),
      track_stock: product.trackStock,
      allow_out_of_stock: product.allowBackorder,
    };

    // Add category if available
    if (product.categoryId) {
      // You might need to map internal category ID to Moka category ID
      // productData.category_id = await this.mapToMokaCategoryId(product.categoryId);
    }

    return await this.mokaApiService.createProduct(
      credentials,
      productData,
      tenantId,
      channelId,
    );
  }

  private async updateMokaProduct(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
    mokaProductId: string,
    product: Product,
  ): Promise<any> {
    const productData: Partial<MokaProduct> = {
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.sellingPrice,
      cost: product.costPrice,
      unit: product.unit || 'pcs',
      barcode: product.barcode,
      is_active: this.mokaApiService.mapToMokaProductStatus(product.status),
      track_stock: product.trackStock,
      allow_out_of_stock: product.allowBackorder,
    };

    return await this.mokaApiService.updateProduct(
      credentials,
      mokaProductId,
      productData,
      tenantId,
      channelId,
    );
  }

  private async syncProductVariants(
    tenantId: string,
    channelId: string,
    productId: string,
    mokaVariants: any[],
  ): Promise<void> {
    // Implementation for syncing product variants
    // This would involve creating/updating ProductVariant entities
    // Similar to the main product sync logic but for variants
    this.logger.debug(`Syncing ${mokaVariants.length} variants for product ${productId}`);
    
    // For each variant:
    // 1. Check if mapping exists
    // 2. Create or update ProductVariant entity
    // 3. Create channel mapping
    // 4. Emit events
    
    // Omitted detailed implementation for brevity
  }
}