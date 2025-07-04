import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  ShopeeApiService,
  ShopeeCredentials,
  ShopeeApiRequest,
} from './shopee-api.service';
import { ShopeeAuthService } from './shopee-auth.service';
import {
  Product,
  ProductStatus,
} from '../../../products/entities/product.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface ShopeeProduct {
  item_id: number;
  item_sku: string;
  status: string;
  item_name: string;
  description: string;
  images: string[];
  videos?: string[];
  weight: number;
  dimension: {
    package_length: number;
    package_width: number;
    package_height: number;
  };
  logistic_info: Array<{
    logistic_id: number;
    logistic_name: string;
    enabled: boolean;
  }>;
  pre_order: {
    is_pre_order: boolean;
    days_to_ship: number;
  };
  wholesales: Array<{
    min_count: number;
    max_count: number;
    unit_price: number;
  }>;
  condition: string;
  size_chart: string;
  item_dangerous: number;
  brand: {
    brand_id: number;
    original_brand_name: string;
  };
  category_id: number;
  item_status: string;
  has_model: boolean;
  promotion_id: number;
  tier_variation: Array<{
    name: string;
    options: string[];
    images: string[];
  }>;
  attribute_list: Array<{
    attribute_id: number;
    attribute_name: string;
    attribute_value_list: Array<{
      value_id: number;
      original_value_name: string;
      translate_value_name: string;
    }>;
  }>;
}

export interface ShopeeVariant {
  model_id: number;
  model_sku: string;
  status: string;
  stock_info: Array<{
    stock_type: number;
    current_stock: number;
    reserved_stock: number;
    normal_stock: number;
  }>;
  price_info: Array<{
    current_price: number;
    original_price: number;
    inflated_price_of_current_price: number;
    inflated_price_of_original_price: number;
    sip_item_price: number;
    sip_item_price_source: string;
  }>;
  tier_index: number[];
  model_name: string;
  images: string[];
}

export interface ProductSyncOptions {
  includeVariants?: boolean;
  includeImages?: boolean;
  includeInventory?: boolean;
  batchSize?: number;
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
}

@Injectable()
export class ShopeeProductService {
  private readonly logger = new Logger(ShopeeProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    private readonly shopeeApiService: ShopeeApiService,
    private readonly authService: ShopeeAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Sync products from Shopee to local system
   */
  async syncProductsFromShopee(
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
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_products_inbound',
        'started',
        'Starting product sync from Shopee',
        { options },
      );

      // Get product list from Shopee
      const productList = await this.getShopeeProductList(
        credentials,
        tenantId,
        channelId,
      );

      if (!productList.success || !productList.data) {
        throw new Error(
          `Failed to get product list: ${productList.error?.message}`,
        );
      }

      const productIds = productList.data.item_list.map(
        (item: any) => item.item_id,
      );
      const batchSize = options.batchSize || 20;

      // Process products in batches
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);

        try {
          const batchResult = await this.syncProductBatch(
            credentials,
            tenantId,
            channelId,
            batch,
            options,
          );

          syncedCount += batchResult.syncedCount;
          errorCount += batchResult.errorCount;
          errors.push(...batchResult.errors);
        } catch (error) {
          this.logger.error(
            `Product batch sync failed: ${error.message}`,
            error.stack,
          );
          errorCount += batch.length;
          errors.push(`Batch sync failed: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_products_inbound',
        'completed',
        `Product sync completed: ${syncedCount} synced, ${errorCount} errors`,
        { syncedCount, errorCount, duration, totalProducts: productIds.length },
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
        'shopee_products_inbound',
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
   * Sync single product to Shopee
   */
  async syncProductToShopee(
    tenantId: string,
    channelId: string,
    productId: string,
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );
      const product = await this.getProductWithVariants(tenantId, productId);

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Check if product already exists on Shopee
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
        result = await this.updateShopeeProduct(
          credentials,
          tenantId,
          channelId,
          parseInt(mapping.externalId),
          product,
        );
      } else {
        // Create new product
        result = await this.createShopeeProduct(
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
          result.data.item_id.toString(),
          result.data,
        );

        await this.logService.logSync(
          tenantId,
          channelId,
          'shopee_product_outbound',
          'completed',
          `Product ${product.name} synced to Shopee`,
          { productId, externalId: result.data.item_id },
        );

        return {
          success: true,
          externalId: result.data.item_id.toString(),
        };
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (error) {
      this.logger.error(
        `Product sync to Shopee failed: ${error.message}`,
        error.stack,
      );

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_product_outbound',
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
   * Get product details from Shopee
   */
  async getShopeeProductDetails(
    tenantId: string,
    channelId: string,
    itemId: number,
  ): Promise<{ success: boolean; data?: ShopeeProduct; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/product/get_item_base_info',
        params: {
          item_id_list: [itemId],
          need_tax_info: false,
          need_complaint_policy: false,
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success && response.data?.item_list?.[0]) {
        return {
          success: true,
          data: response.data.item_list[0],
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Product not found',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Shopee product details: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get product variants from Shopee
   */
  async getShopeeProductVariants(
    tenantId: string,
    channelId: string,
    itemId: number,
  ): Promise<{ success: boolean; data?: ShopeeVariant[]; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/product/get_model_list',
        params: {
          item_id: itemId,
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success && response.data?.model) {
        return {
          success: true,
          data: response.data.model,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Variants not found',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Shopee product variants: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete product from Shopee
   */
  async deleteShopeeProduct(
    tenantId: string,
    channelId: string,
    itemId: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const request: ShopeeApiRequest = {
        method: 'POST',
        endpoint: '/product/delete_item',
        data: {
          item_id: itemId,
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success) {
        // Remove mapping
        await this.mappingRepository.delete({
          tenantId,
          channelId,
          entityType: 'product',
          externalId: itemId.toString(),
        });

        await this.logService.logSync(
          tenantId,
          channelId,
          'shopee_product_delete',
          'completed',
          `Product ${itemId} deleted from Shopee`,
          { itemId },
        );

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Delete failed',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete Shopee product: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async getShopeeProductList(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    offset: number = 0,
    pageSize: number = 100,
  ): Promise<any> {
    const request: ShopeeApiRequest = {
      method: 'GET',
      endpoint: '/product/get_item_list',
      params: {
        offset,
        page_size: pageSize,
        item_status: ['NORMAL', 'BANNED', 'DELETED', 'UNLIST'],
      },
    };

    return await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  private async syncProductBatch(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    itemIds: number[],
    options: ProductSyncOptions,
  ): Promise<{
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Get product details in batch
    const request: ShopeeApiRequest = {
      method: 'GET',
      endpoint: '/product/get_item_base_info',
      params: {
        item_id_list: itemIds,
        need_tax_info: false,
        need_complaint_policy: false,
      },
    };

    const response = await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );

    if (!response.success || !response.data?.item_list) {
      throw new Error(
        `Failed to get product batch: ${response.error?.message}`,
      );
    }

    // Process each product
    for (const shopeeProduct of response.data.item_list) {
      try {
        await this.syncSingleProduct(
          tenantId,
          channelId,
          shopeeProduct,
          options,
        );
        syncedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to sync product ${shopeeProduct.item_id}: ${error.message}`,
        );
        errors.push(`Product ${shopeeProduct.item_id}: ${error.message}`);
        errorCount++;
      }
    }

    return { syncedCount, errorCount, errors };
  }

  private async syncSingleProduct(
    tenantId: string,
    channelId: string,
    shopeeProduct: ShopeeProduct,
    options: ProductSyncOptions,
  ): Promise<void> {
    // Check if product mapping exists
    let mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: shopeeProduct.item_id.toString(),
      },
    });

    let product: Product;

    if (mapping) {
      // Update existing product
      product = await this.productRepository.findOne({
        where: { id: mapping.internalId, tenantId },
      });

      if (product) {
        this.updateProductFromShopee(product, shopeeProduct);
        await this.productRepository.save(product);
      }
    } else {
      // Create new product
      product = await this.createProductFromShopee(tenantId, shopeeProduct);
      await this.productRepository.save(product);

      // Create mapping
      mapping = await this.saveProductMapping(
        tenantId,
        channelId,
        product.id,
        shopeeProduct.item_id.toString(),
        shopeeProduct,
      );
    }

    // Sync variants if enabled
    if (options.includeVariants && shopeeProduct.has_model) {
      await this.syncProductVariants(
        tenantId,
        channelId,
        product.id,
        shopeeProduct.item_id,
      );
    }

    // Emit sync event
    this.eventEmitter.emit('product.synced.shopee', {
      tenantId,
      channelId,
      productId: product.id,
      externalId: shopeeProduct.item_id,
      syncDirection: 'inbound',
    });
  }

  private async createProductFromShopee(
    tenantId: string,
    shopeeProduct: ShopeeProduct,
  ): Promise<Product> {
    const product = this.productRepository.create({
      tenantId,
      name: shopeeProduct.item_name,
      description: shopeeProduct.description,
      sku: shopeeProduct.item_sku,
      status: this.mapShopeeStatus(shopeeProduct.status) as ProductStatus,
      weight: shopeeProduct.weight,
      metadata: {
        shopee: {
          categoryId: shopeeProduct.category_id,
          condition: shopeeProduct.condition,
          brand: shopeeProduct.brand,
          attributes: shopeeProduct.attribute_list,
          logistics: shopeeProduct.logistic_info,
        },
      },
    });

    return product;
  }

  private updateProductFromShopee(
    product: Product,
    shopeeProduct: ShopeeProduct,
  ): void {
    product.name = shopeeProduct.item_name;
    product.description = shopeeProduct.description;
    product.sku = shopeeProduct.item_sku;
    product.status = this.mapShopeeStatus(
      shopeeProduct.status,
    ) as ProductStatus;
    product.weight = shopeeProduct.weight;

    product.metadata = {
      ...product.metadata,
      shopee: {
        categoryId: shopeeProduct.category_id,
        condition: shopeeProduct.condition,
        brand: shopeeProduct.brand,
        attributes: shopeeProduct.attribute_list,
        logistics: shopeeProduct.logistic_info,
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

  private mapShopeeStatus(shopeeStatus: string): ProductStatus {
    const statusMap: Record<string, ProductStatus> = {
      NORMAL: ProductStatus.ACTIVE,
      BANNED: ProductStatus.INACTIVE,
      DELETED: ProductStatus.DISCONTINUED,
      UNLIST: ProductStatus.INACTIVE,
    };

    return statusMap[shopeeStatus] || ProductStatus.INACTIVE;
  }

  private async getProductWithVariants(
    tenantId: string,
    productId: string,
  ): Promise<Product | null> {
    return await this.productRepository.findOne({
      where: { id: productId, tenantId },
      relations: ['variants'],
    });
  }

  private async createShopeeProduct(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    product: Product,
  ): Promise<any> {
    const request: ShopeeApiRequest = {
      method: 'POST',
      endpoint: '/product/add_item',
      data: {
        item_name: product.name,
        description: product.description,
        item_sku: product.sku,
        category_id: 100017, // Default category - should be configurable
        weight: product.weight || 0.1,
        dimension: {
          package_length: 10,
          package_width: 10,
          package_height: 10,
        },
        logistic_info: [
          {
            logistic_id: 8003, // Regular shipping
            enabled: true,
          },
        ],
        attribute_list: [],
        item_status: 'UNLIST',
      },
    };

    return await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  private async updateShopeeProduct(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    itemId: number,
    product: Product,
  ): Promise<any> {
    const request: ShopeeApiRequest = {
      method: 'POST',
      endpoint: '/product/update_item',
      data: {
        item_id: itemId,
        item_name: product.name,
        description: product.description,
        item_sku: product.sku,
        weight: product.weight || 0.1,
      },
    };

    return await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  private async syncProductVariants(
    tenantId: string,
    channelId: string,
    productId: string,
    itemId: number,
  ): Promise<void> {
    // Implementation for syncing product variants
    // This would involve getting variants from Shopee and syncing with local ProductVariant entities
    // Omitted for brevity but would follow similar pattern
  }
}
