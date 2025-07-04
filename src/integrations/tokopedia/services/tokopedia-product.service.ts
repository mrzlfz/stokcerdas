import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  Product,
  ProductStatus,
} from '../../../products/entities/product.entity';
import { Channel } from '../../../channels/entities/channel.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { TokopediaApiService, TokopediaConfig } from './tokopedia-api.service';
import { TokopediaAuthService } from './tokopedia-auth.service';

export interface ProductSyncOptions {
  offset?: number;
  limit?: number;
  filter?: 'all' | 'active' | 'inactive' | 'banned';
  search?: string;
  categoryId?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  sku?: string;
}

export interface TokopediaProduct {
  product_id: number;
  name: string;
  sku: string;
  description: string;
  category_id: number;
  category_name: string;
  price: number;
  stock: number;
  weight: number;
  status: 'active' | 'inactive' | 'banned';
  images: string[];
  variants: TokopediaProductVariant[];
  specifications: Array<{
    name: string;
    value: string;
  }>;
  created_at: string;
  updated_at: string;
  shop_id: string;
  minimum_order: number;
  condition: 'new' | 'used';
  insurance: boolean;
  must_insurance: boolean;
  preorder: boolean;
  is_free_return: boolean;
  is_wholesale: boolean;
  wholesale_prices: Array<{
    min_qty: number;
    price: number;
  }>;
}

export interface TokopediaProductVariant {
  variant_id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  status: string;
  pictures: string[];
  combination: Array<{
    option_id: number;
    option_name: string;
    unit_value_id: number;
    unit_value: string;
  }>;
}

export interface TokopediaProductRequest {
  name: string;
  description: string;
  category_id: number;
  price: number;
  stock: number;
  weight: number;
  sku?: string;
  condition: 'new' | 'used';
  minimum_order?: number;
  images: string[];
  variants?: Array<{
    sku: string;
    price: number;
    stock: number;
    combination: Array<{
      option_id: number;
      unit_value_id: number;
    }>;
  }>;
  specifications?: Array<{
    spec_id: number;
    value: string;
  }>;
  preorder?: boolean;
  is_free_return?: boolean;
  is_wholesale?: boolean;
  wholesale_prices?: Array<{
    min_qty: number;
    price: number;
  }>;
}

@Injectable()
export class TokopediaProductService {
  private readonly logger = new Logger(TokopediaProductService.name);

  constructor(
    private readonly apiService: TokopediaApiService,
    private readonly authService: TokopediaAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
  ) {}

  /**
   * Sync products from Tokopedia to local system
   */
  async syncProductsFromTokopedia(
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
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      this.logger.log(`Starting Tokopedia product sync`, {
        tenantId,
        channelId,
        options,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      // Build API parameters
      const params: Record<string, any> = {
        page: Math.floor((options.offset || 0) / (options.limit || 20)) + 1,
        per_page: options.limit || 20,
      };

      if (options.filter && options.filter !== 'all') {
        params.status = options.filter;
      }

      if (options.search) {
        params.search = options.search;
      }

      if (options.categoryId) {
        params.category_id = options.categoryId;
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

      // Fetch products from Tokopedia
      const result = await this.apiService.makeTokopediaRequest<{
        products: TokopediaProduct[];
        pagination: {
          current_page: number;
          total_pages: number;
          total_products: number;
        };
      }>(tenantId, channelId, config, {
        method: 'GET',
        endpoint: '/v1/products',
        params,
        requiresAuth: true,
      });

      if (!result.success || !result.data?.products) {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : this.extractErrorMessage(result.error) ||
              'Failed to fetch products from Tokopedia';
        throw new Error(errorMessage);
      }

      const products = result.data.products;

      this.logger.log(`Fetched ${products.length} products from Tokopedia`, {
        tenantId,
        channelId,
        totalProducts: result.data.pagination?.total_products,
      });

      // Process each product
      for (const tokopediaProduct of products) {
        try {
          await this.processInboundProduct(
            tenantId,
            channelId,
            tokopediaProduct,
          );
          syncedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to process product ${tokopediaProduct.product_id}: ${error.message}`,
            error.stack,
          );
          errors.push(
            `Product ${tokopediaProduct.product_id}: ${error.message}`,
          );
          errorCount++;
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(`Tokopedia product sync completed`, {
        tenantId,
        channelId,
        syncedCount,
        errorCount,
        processingTime,
      });

      // Log sync result
      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_product_inbound',
        errorCount === 0 ? 'completed' : 'failed',
        `Synced ${syncedCount} products from Tokopedia`,
        {
          syncedCount,
          errorCount,
          processingTime,
          options,
        },
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.product.sync.completed', {
        tenantId,
        channelId,
        syncedCount,
        errorCount,
        processingTime,
      });

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
        errors,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Tokopedia product sync failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_product_inbound',
        'failed',
        `Product sync failed: ${error.message}`,
        { error: error.message, processingTime },
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
   * Sync single product from local system to Tokopedia
   */
  async syncProductToTokopedia(
    tenantId: string,
    channelId: string,
    productId: string,
  ): Promise<{
    success: boolean;
    externalId?: string;
    error?: string;
  }> {
    try {
      this.logger.log(`Syncing product to Tokopedia`, {
        tenantId,
        channelId,
        productId,
      });

      // Get local product
      const product = await this.productRepository.findOne({
        where: { id: productId, tenantId },
        relations: ['variants', 'categories'],
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      // Check if product already exists on Tokopedia
      const existingMapping = await this.mappingRepository.findOne({
        where: {
          tenantId,
          channelId,
          entityType: 'product',
          internalId: productId,
        },
      });

      const tokopediaProductData = this.buildTokopediaProductData(product);

      let result;
      let isUpdate = false;

      if (existingMapping?.externalId) {
        // Update existing product
        isUpdate = true;
        result = await this.apiService.makeTokopediaRequest(
          tenantId,
          channelId,
          config,
          {
            method: 'PUT',
            endpoint: `/v1/products/${existingMapping.externalId}`,
            data: tokopediaProductData,
            requiresAuth: true,
          },
        );
      } else {
        // Create new product
        result = await this.apiService.makeTokopediaRequest<{
          product_id: number;
        }>(tenantId, channelId, config, {
          method: 'POST',
          endpoint: '/v1/products',
          data: tokopediaProductData,
          requiresAuth: true,
        });
      }

      if (!result.success) {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : this.extractErrorMessage(result.error) ||
              'Failed to sync product to Tokopedia';
        throw new Error(errorMessage);
      }

      const externalId = isUpdate
        ? existingMapping.externalId
        : result.data?.product_id?.toString();

      if (!isUpdate && externalId) {
        // Create mapping for new product
        await this.mappingRepository.save({
          tenantId,
          channelId,
          entityType: 'product',
          internalId: productId,
          externalId,
          metadata: {
            syncedAt: new Date(),
            productName: product.name,
          },
        });
      }

      this.logger.log(`Product synced to Tokopedia successfully`, {
        tenantId,
        channelId,
        productId,
        externalId,
        isUpdate,
      });

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_product_outbound',
        'completed',
        `Product ${product.name} synced to Tokopedia`,
        {
          productId,
          externalId,
          isUpdate,
        },
      );

      return {
        success: true,
        externalId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync product to Tokopedia: ${error.message}`,
        error.stack,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_product_outbound',
        'failed',
        `Failed to sync product: ${error.message}`,
        { productId, error: error.message },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get Tokopedia product details
   */
  async getTokopediaProductDetails(
    tenantId: string,
    channelId: string,
    productId: number,
  ): Promise<{
    success: boolean;
    data?: TokopediaProduct;
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      const result =
        await this.apiService.makeTokopediaRequest<TokopediaProduct>(
          tenantId,
          channelId,
          config,
          {
            method: 'GET',
            endpoint: `/v1/products/${productId}`,
            requiresAuth: true,
          },
        );

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error:
            typeof result.error === 'string'
              ? result.error
              : this.extractErrorMessage(result.error) ||
                'Failed to get product details',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Tokopedia product details: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update product images in Tokopedia
   */
  async updateTokopediaProductImages(
    tenantId: string,
    channelId: string,
    productId: number,
    images: string[],
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
      const channel = await this.channelRepository.findOne({
        where: { id: channelId, tenantId },
      });

      const config: TokopediaConfig = {
        clientId: channel.config.clientId,
        clientSecret: channel.config.clientSecret,
        fsId: credentials.fsId,
        shopId: credentials.shopId,
        accessToken: credentials.accessToken,
        sandbox: channel.config.sandbox || false,
      };

      const result = await this.apiService.makeTokopediaRequest(
        tenantId,
        channelId,
        config,
        {
          method: 'PUT',
          endpoint: `/v1/products/${productId}/images`,
          data: { images },
          requiresAuth: true,
        },
      );

      if (result.success) {
        this.logger.log(`Product images updated successfully`, {
          tenantId,
          channelId,
          productId,
          imageCount: images.length,
        });
      }

      if (result.success) {
        return {
          success: true,
        };
      } else {
        return {
          success: false,
          error:
            typeof result.error === 'string'
              ? result.error
              : this.extractErrorMessage(result.error) ||
                'Failed to update product images',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to update product images: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async processInboundProduct(
    tenantId: string,
    channelId: string,
    tokopediaProduct: TokopediaProduct,
  ): Promise<void> {
    // Check if we already have a mapping for this product
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: tokopediaProduct.product_id.toString(),
      },
    });

    let product: Product;

    if (mapping) {
      // Update existing product
      product = await this.productRepository.findOne({
        where: { id: mapping.internalId, tenantId },
      });

      if (!product) {
        throw new Error(`Mapped product ${mapping.internalId} not found`);
      }
    } else {
      // Create new product
      product = new Product();
      product.tenantId = tenantId;
    }

    // Map Tokopedia product data to local product
    product.name = tokopediaProduct.name;
    product.description = tokopediaProduct.description;
    product.sku = tokopediaProduct.sku;
    product.sellingPrice = tokopediaProduct.price;
    product.weight = tokopediaProduct.weight;
    product.status =
      tokopediaProduct.status === 'active'
        ? ProductStatus.ACTIVE
        : ProductStatus.INACTIVE;
    product.images = tokopediaProduct.images;
    // Store tokopedia-specific data in attributes
    product.attributes = {
      tokopedia: {
        productId: tokopediaProduct.product_id,
        categoryId: tokopediaProduct.category_id,
        categoryName: tokopediaProduct.category_name,
        minimumOrder: tokopediaProduct.minimum_order,
        condition: tokopediaProduct.condition,
        lastSyncAt: new Date(),
      },
    };

    // Save product
    const savedProduct = await this.productRepository.save(product);

    // Create or update mapping
    if (!mapping) {
      await this.mappingRepository.save({
        tenantId,
        channelId,
        entityType: 'product',
        internalId: savedProduct.id,
        externalId: tokopediaProduct.product_id.toString(),
        externalData: {
          syncedAt: new Date(),
          productName: tokopediaProduct.name,
        },
      });
    } else {
      mapping.lastSyncAt = new Date();
      await this.mappingRepository.save(mapping);
    }
  }

  private buildTokopediaProductData(product: Product): TokopediaProductRequest {
    return {
      name: product.name,
      description: product.description || '',
      category_id: product.attributes?.tokopedia?.categoryId || 1, // Default category
      price: product.sellingPrice,
      stock: 0, // Will be handled by inventory service
      weight: product.weight || 100, // Default 100g
      sku: product.sku,
      condition:
        (product.attributes?.tokopedia?.condition as 'new' | 'used') || 'new',
      minimum_order: product.attributes?.tokopedia?.minimumOrder || 1,
      images: product.images || [],
      preorder: false,
      is_free_return: false,
      is_wholesale: false,
    };
  }

  // Helper method to extract error messages from API responses
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as any).message;
    }
    return 'Unknown error';
  }
}
