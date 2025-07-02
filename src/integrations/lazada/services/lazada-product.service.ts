import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { LazadaApiService, LazadaConfig } from './lazada-api.service';
import { LazadaAuthService } from './lazada-auth.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { Product } from '../../../products/entities/product.entity';
import { Channel } from '../../../channels/entities/channel.entity';

export interface LazadaProduct {
  item_id: number;
  primary_category: number;
  attributes: Record<string, any>;
  skus: LazadaSku[];
  item_sku?: string;
  status: string;
  created_time: string;
  updated_time: string;
  package_height?: number;
  package_length?: number;
  package_weight?: number;
  package_width?: number;
  short_description?: string;
}

export interface LazadaSku {
  seller_sku: string;
  shop_sku: string;
  sku_id: number;
  status: string;
  quantity: number;
  available: number;
  price: number;
  special_price?: number;
  special_from_date?: string;
  special_to_date?: string;
  package_height?: number;
  package_length?: number;
  package_weight?: number;
  package_width?: number;
  images: string[];
}

export interface ProductSyncOptions {
  offset?: number;
  limit?: number;
  filter?: 'all' | 'live' | 'inactive' | 'deleted';
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  sku?: string;
}

export interface ProductCreateRequest {
  primary_category: number;
  attributes: Record<string, any>;
  skus: Array<{
    seller_sku: string;
    quantity: number;
    price: number;
    special_price?: number;
    special_from_date?: string;
    special_to_date?: string;
    package_height?: number;
    package_length?: number;
    package_weight?: number;
    package_width?: number;
    images?: string[];
  }>;
}

export interface ProductUpdateRequest {
  item_id: number;
  attributes?: Record<string, any>;
  skus?: Array<{
    seller_sku: string;
    quantity?: number;
    price?: number;
    special_price?: number;
    special_from_date?: string;
    special_to_date?: string;
    package_height?: number;
    package_length?: number;
    package_weight?: number;
    package_width?: number;
    images?: string[];
  }>;
}

@Injectable()
export class LazadaProductService {
  private readonly logger = new Logger(LazadaProductService.name);

  constructor(
    private readonly lazadaApi: LazadaApiService,
    private readonly authService: LazadaAuthService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  /**
   * Sync products from Lazada to local system
   */
  async syncProductsFromLazada(
    tenantId: string,
    channelId: string,
    options: ProductSyncOptions = {},
  ): Promise<{ success: boolean; syncedCount: number; errorCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      this.logger.debug(`Starting Lazada product sync`, {
        tenantId,
        channelId,
        options,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Prepare API parameters
      const params: any = {
        offset: options.offset || 0,
        limit: Math.min(options.limit || 100, 500), // Lazada max limit is 500
        filter: options.filter || 'all',
      };

      if (options.search) {
        params.search = options.search;
      }

      if (options.sku) {
        params.sku = options.sku;
      }

      if (options.createdAfter) {
        params.created_after = options.createdAfter.toISOString();
      }

      if (options.createdBefore) {
        params.created_before = options.createdBefore.toISOString();
      }

      if (options.updatedAfter) {
        params.updated_after = options.updatedAfter.toISOString();
      }

      if (options.updatedBefore) {
        params.updated_before = options.updatedBefore.toISOString();
      }

      // Get products from Lazada
      const result = await this.lazadaApi.makeRequest<{ products: LazadaProduct[]; total_products: number }>(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'GET',
          path: '/products/get',
          params,
          requiresAuth: true,
          rateLimitKey: 'products_get',
        },
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch products from Lazada');
      }

      const lazadaProducts = result.data.products || [];

      this.logger.debug(`Fetched ${lazadaProducts.length} products from Lazada`, {
        tenantId,
        channelId,
        total: result.data.total_products,
      });

      // Sync each product
      for (const lazadaProduct of lazadaProducts) {
        try {
          await this.syncSingleProductFromLazada(tenantId, channelId, lazadaProduct);
          syncedCount++;
        } catch (error) {
          this.logger.error(`Failed to sync product ${lazadaProduct.item_id}: ${error.message}`, error.stack);
          errors.push(`Product ${lazadaProduct.item_id}: ${error.message}`);
          errorCount++;
        }
      }

      // Log sync summary
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_products_inbound',
        errorCount === 0 ? 'completed' : 'partial',
        `Product sync completed: ${syncedCount} synced, ${errorCount} errors`,
        {
          syncedCount,
          errorCount,
          totalFetched: lazadaProducts.length,
          errors: errors.slice(0, 10), // Log first 10 errors
        },
      );

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Product sync failed: ${error.message}`, error.stack);

      // Log sync failure
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_products_inbound',
        'failed',
        `Product sync failed: ${error.message}`,
        { error: error.message },
      );

      return {
        success: false,
        syncedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Sync single product to Lazada
   */
  async syncProductToLazada(
    tenantId: string,
    channelId: string,
    productId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      this.logger.debug(`Syncing product to Lazada`, {
        tenantId,
        channelId,
        productId,
      });

      // Get local product
      const product = await this.productRepository.findOne({
        where: { id: productId, tenantId },
        relations: ['variants'],
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Check if product already exists in Lazada
      const existingMapping = await this.findProductMapping(tenantId, channelId, productId);

      if (existingMapping) {
        // Update existing product
        return this.updateLazadaProduct(tenantId, channelId, lazadaConfig, product, existingMapping.externalId);
      } else {
        // Create new product
        return this.createLazadaProduct(tenantId, channelId, lazadaConfig, product);
      }

    } catch (error) {
      this.logger.error(`Failed to sync product to Lazada: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get Lazada product details
   */
  async getLazadaProductDetails(
    tenantId: string,
    channelId: string,
    itemId: number,
  ): Promise<{ success: boolean; data?: LazadaProduct; error?: string }> {
    try {
      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Get product details from Lazada
      const result = await this.lazadaApi.makeRequest<LazadaProduct>(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'GET',
          path: '/product/item/get',
          params: { item_id: itemId },
          requiresAuth: true,
          rateLimitKey: 'product_details',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        data: result.data,
      };

    } catch (error) {
      this.logger.error(`Failed to get product details: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update product images in Lazada
   */
  async updateLazadaProductImages(
    tenantId: string,
    channelId: string,
    itemId: number,
    images: string[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Upload images to Lazada
      const result = await this.lazadaApi.makeRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/image/upload',
          body: { images },
          requiresAuth: true,
          rateLimitKey: 'image_upload',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Log successful image update
      await this.logService.log({
        tenantId,
        channelId,
        type: 'SYNC',
        level: 'INFO',
        message: `Lazada product images updated successfully`,
        metadata: { itemId, imageCount: images.length },
      });

      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to update product images: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async syncSingleProductFromLazada(
    tenantId: string,
    channelId: string,
    lazadaProduct: LazadaProduct,
  ): Promise<void> {
    // Find or create local product
    let localProduct = await this.findLocalProductByExternalId(tenantId, lazadaProduct.item_id.toString());

    if (!localProduct) {
      // Create new local product
      localProduct = await this.createLocalProductFromLazada(tenantId, channelId, lazadaProduct);
    } else {
      // Update existing local product
      await this.updateLocalProductFromLazada(localProduct, lazadaProduct);
    }

    // Store mapping if not exists
    await this.ensureProductMapping(tenantId, channelId, localProduct.id, lazadaProduct.item_id.toString());
  }

  private async findLocalProductByExternalId(tenantId: string, externalId: string): Promise<Product | null> {
    // This would need to query through channel mappings
    // For now, return null to always create new products
    return null;
  }

  private async createLocalProductFromLazada(
    tenantId: string,
    channelId: string,
    lazadaProduct: LazadaProduct,
  ): Promise<Product> {
    // Extract product information from Lazada product
    const productData = {
      tenantId,
      name: lazadaProduct.attributes?.name || `Lazada Product ${lazadaProduct.item_id}`,
      description: lazadaProduct.short_description || '',
      sku: lazadaProduct.item_sku || `LAZ-${lazadaProduct.item_id}`,
      status: lazadaProduct.status === 'active' ? 'active' : 'inactive',
      category: lazadaProduct.primary_category?.toString(),
      // Add other fields as needed
    };

    const product = this.productRepository.create(productData);
    return this.productRepository.save(product);
  }

  private async updateLocalProductFromLazada(
    localProduct: Product,
    lazadaProduct: LazadaProduct,
  ): Promise<void> {
    // Update local product with Lazada data
    localProduct.name = lazadaProduct.attributes?.name || localProduct.name;
    localProduct.description = lazadaProduct.short_description || localProduct.description;
    localProduct.status = lazadaProduct.status === 'active' ? 'active' : 'inactive';
    
    await this.productRepository.save(localProduct);
  }

  private async createLazadaProduct(
    tenantId: string,
    channelId: string,
    lazadaConfig: LazadaConfig,
    product: Product,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      // Prepare product data for Lazada
      const createRequest: ProductCreateRequest = {
        primary_category: parseInt(product.category || '1'),
        attributes: {
          name: product.name,
          description: product.description,
          short_description: product.description?.substring(0, 255),
          brand: product.brand || 'Generic',
        },
        skus: [{
          seller_sku: product.sku,
          quantity: 0, // Will be updated separately
          price: 0, // Will be updated separately
        }],
      };

      // Create product in Lazada
      const result = await this.lazadaApi.makeRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/product/create',
          body: createRequest,
          requiresAuth: true,
          rateLimitKey: 'product_create',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      const itemId = result.data?.item_id?.toString();
      if (!itemId) {
        return {
          success: false,
          error: 'No item ID returned from Lazada',
        };
      }

      // Store product mapping
      await this.ensureProductMapping(tenantId, channelId, product.id, itemId);

      return {
        success: true,
        externalId: itemId,
      };

    } catch (error) {
      this.logger.error(`Failed to create Lazada product: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async updateLazadaProduct(
    tenantId: string,
    channelId: string,
    lazadaConfig: LazadaConfig,
    product: Product,
    externalId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      // Prepare update data
      const updateRequest: ProductUpdateRequest = {
        item_id: parseInt(externalId),
        attributes: {
          name: product.name,
          description: product.description,
          short_description: product.description?.substring(0, 255),
        },
      };

      // Update product in Lazada
      const result = await this.lazadaApi.makeRequest(
        tenantId,
        channelId,
        lazadaConfig,
        {
          method: 'POST',
          path: '/product/update',
          body: updateRequest,
          requiresAuth: true,
          rateLimitKey: 'product_update',
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        externalId,
      };

    } catch (error) {
      this.logger.error(`Failed to update Lazada product: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async findProductMapping(
    tenantId: string,
    channelId: string,
    productId: string,
  ): Promise<{ externalId: string } | null> {
    // This would query channel mapping table
    // For now, return null
    return null;
  }

  private async ensureProductMapping(
    tenantId: string,
    channelId: string,
    productId: string,
    externalId: string,
  ): Promise<void> {
    // This would create/update channel mapping
    // Implementation depends on your channel mapping structure
    this.logger.debug(`Product mapping: ${productId} -> ${externalId}`, {
      tenantId,
      channelId,
    });
  }
}