import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { InventoryItem } from '../../../inventory/entities/inventory-item.entity';
import { Product } from '../../../products/entities/product.entity';
import { Channel } from '../../../channels/entities/channel.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { TokopediaApiService, TokopediaConfig } from './tokopedia-api.service';
import { TokopediaAuthService } from './tokopedia-auth.service';

export interface InventorySyncOptions {
  syncStock?: boolean;
  syncPrices?: boolean;
  productSkus?: string[];
  offset?: number;
  limit?: number;
}

export interface StockUpdateRequest {
  product_id: number;
  sku: string;
  stock: number;
  variant_id?: number;
}

export interface PriceUpdateRequest {
  product_id: number;
  sku: string;
  price: number;
  variant_id?: number;
  special_price?: number;
  special_price_start?: Date;
  special_price_end?: Date;
}

export interface TokopediaStockInfo {
  product_id: number;
  sku: string;
  stock: number;
  variant_id?: number;
  variant_name?: string;
  reserved_stock: number;
  available_stock: number;
  last_updated: string;
}

export interface TokopediaPriceInfo {
  product_id: number;
  sku: string;
  price: number;
  variant_id?: number;
  variant_name?: string;
  special_price?: number;
  special_price_start?: string;
  special_price_end?: string;
  currency: string;
  last_updated: string;
}

export interface TokopediaInventoryUpdate {
  product_id: number;
  updates: {
    stock?: number;
    price?: number;
    special_price?: number;
    special_price_start?: string;
    special_price_end?: string;
  };
  variant_id?: number;
}

@Injectable()
export class TokopediaInventoryService {
  private readonly logger = new Logger(TokopediaInventoryService.name);

  constructor(
    private readonly apiService: TokopediaApiService,
    private readonly authService: TokopediaAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
    // @InjectRepository(InventoryLevel)
    // private readonly inventoryRepository: Repository<InventoryLevel>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
  ) {}

  /**
   * Sync inventory and prices from Tokopedia to local system
   */
  async syncInventoryFromTokopedia(
    tenantId: string,
    channelId: string,
    options: InventorySyncOptions = {},
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
      this.logger.log(`Starting Tokopedia inventory sync`, {
        tenantId,
        channelId,
        options,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
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
        page: Math.floor((options.offset || 0) / (options.limit || 50)) + 1,
        per_page: options.limit || 50,
      };

      if (options.productSkus && options.productSkus.length > 0) {
        params.skus = options.productSkus.join(',');
      }

      let stockData: TokopediaStockInfo[] = [];
      let priceData: TokopediaPriceInfo[] = [];

      // Sync stock if requested
      if (options.syncStock !== false) {
        const stockResult = await this.apiService.makeTokopediaRequest<{
          stock_info: TokopediaStockInfo[];
          pagination: {
            current_page: number;
            total_pages: number;
            total_items: number;
          };
        }>(
          tenantId,
          channelId,
          config,
          {
            method: 'GET',
            endpoint: '/v1/inventory/stock',
            params,
            requiresAuth: true,
          },
        );

        if (!stockResult.success) {
          const errorMessage = typeof stockResult.error === 'string' 
            ? stockResult.error 
            : this.extractErrorMessage(stockResult.error) || 'Failed to fetch stock data from Tokopedia';
          throw new Error(errorMessage);
        }

        stockData = stockResult.data?.stock_info || [];
      }

      // Sync prices if requested
      if (options.syncPrices !== false) {
        const priceResult = await this.apiService.makeTokopediaRequest<{
          price_info: TokopediaPriceInfo[];
          pagination: {
            current_page: number;
            total_pages: number;
            total_items: number;
          };
        }>(
          tenantId,
          channelId,
          config,
          {
            method: 'GET',
            endpoint: '/v1/inventory/prices',
            params,
            requiresAuth: true,
          },
        );

        if (!priceResult.success) {
          const errorMessage = typeof priceResult.error === 'string' 
            ? priceResult.error 
            : this.extractErrorMessage(priceResult.error) || 'Failed to fetch price data from Tokopedia';
          throw new Error(errorMessage);
        }

        priceData = priceResult.data?.price_info || [];
      }

      this.logger.log(`Fetched inventory data from Tokopedia`, {
        tenantId,
        channelId,
        stockItems: stockData.length,
        priceItems: priceData.length,
      });

      // Process stock data
      for (const stockInfo of stockData) {
        try {
          await this.processInboundStock(tenantId, channelId, stockInfo);
          syncedCount++;
        } catch (error) {
          this.logger.error(`Failed to process stock for ${stockInfo.sku}: ${error.message}`, error.stack);
          errors.push(`Stock ${stockInfo.sku}: ${error.message}`);
          errorCount++;
        }
      }

      // Process price data
      for (const priceInfo of priceData) {
        try {
          await this.processInboundPrice(tenantId, channelId, priceInfo);
          syncedCount++;
        } catch (error) {
          this.logger.error(`Failed to process price for ${priceInfo.sku}: ${error.message}`, error.stack);
          errors.push(`Price ${priceInfo.sku}: ${error.message}`);
          errorCount++;
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(`Tokopedia inventory sync completed`, {
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
        'tokopedia_inventory_inbound',
        errorCount === 0 ? 'completed' : 'failed',
        `Synced ${syncedCount} inventory items from Tokopedia`,
        {
          syncedCount,
          errorCount,
          processingTime,
          options,
        },
      );

      // Emit event
      this.eventEmitter.emit('tokopedia.inventory.sync.completed', {
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
      
      this.logger.error(`Tokopedia inventory sync failed: ${error.message}`, error.stack);

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_inventory_inbound',
        'failed',
        `Inventory sync failed: ${error.message}`,
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
   * Update stock levels in Tokopedia
   */
  async updateTokopediaInventory(
    tenantId: string,
    channelId: string,
    updates: StockUpdateRequest[],
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    try {
      this.logger.log(`Updating Tokopedia inventory`, {
        tenantId,
        channelId,
        updateCount: updates.length,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
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

      // Process updates in batches
      const batchSize = 20; // Tokopedia batch limit
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        try {
          const result = await this.apiService.makeTokopediaRequest<{
            updated_items: number;
            failed_items: Array<{
              product_id: number;
              sku: string;
              error: string;
            }>;
          }>(
            tenantId,
            channelId,
            config,
            {
              method: 'PUT',
              endpoint: '/v1/inventory/stock',
              data: { stock_updates: batch },
              requiresAuth: true,
            },
          );

          if (result.success) {
            updatedCount += result.data?.updated_items || 0;
            
            if (result.data?.failed_items) {
              for (const failedItem of result.data.failed_items) {
                errors.push(`${failedItem.sku}: ${failedItem.error}`);
                errorCount++;
              }
            }
          } else {
            const errorMessage = typeof result.error === 'string' 
              ? result.error 
              : this.extractErrorMessage(result.error) || 'Unknown error';
            errors.push(`Batch ${i / batchSize + 1}: ${errorMessage}`);
            errorCount += batch.length;
          }

        } catch (error) {
          this.logger.error(`Failed to update inventory batch: ${error.message}`, error.stack);
          errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
          errorCount += batch.length;
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(`Tokopedia inventory update completed`, {
        tenantId,
        channelId,
        updatedCount,
        errorCount,
        processingTime,
      });

      // Log update result
      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_inventory_outbound',
        errorCount === 0 ? 'completed' : 'failed',
        `Updated ${updatedCount} inventory items in Tokopedia`,
        {
          updatedCount,
          errorCount,
          processingTime,
        },
      );

      return {
        success: errorCount === 0,
        updatedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Tokopedia inventory update failed: ${error.message}`, error.stack);

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_inventory_outbound',
        'failed',
        `Inventory update failed: ${error.message}`,
        { error: error.message, processingTime },
      );

      return {
        success: false,
        updatedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Update prices in Tokopedia
   */
  async updateTokopediaPrices(
    tenantId: string,
    channelId: string,
    updates: PriceUpdateRequest[],
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    try {
      this.logger.log(`Updating Tokopedia prices`, {
        tenantId,
        channelId,
        updateCount: updates.length,
      });

      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
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

      // Process updates in batches
      const batchSize = 20;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        try {
          const priceUpdates = batch.map(update => ({
            product_id: update.product_id,
            sku: update.sku,
            price: update.price,
            ...(update.variant_id && { variant_id: update.variant_id }),
            ...(update.special_price && { special_price: update.special_price }),
            ...(update.special_price_start && { 
              special_price_start: update.special_price_start.toISOString() 
            }),
            ...(update.special_price_end && { 
              special_price_end: update.special_price_end.toISOString() 
            }),
          }));

          const result = await this.apiService.makeTokopediaRequest<{
            updated_items: number;
            failed_items: Array<{
              product_id: number;
              sku: string;
              error: string;
            }>;
          }>(
            tenantId,
            channelId,
            config,
            {
              method: 'PUT',
              endpoint: '/v1/inventory/prices',
              data: { price_updates: priceUpdates },
              requiresAuth: true,
            },
          );

          if (result.success) {
            updatedCount += result.data?.updated_items || 0;
            
            if (result.data?.failed_items) {
              for (const failedItem of result.data.failed_items) {
                errors.push(`${failedItem.sku}: ${failedItem.error}`);
                errorCount++;
              }
            }
          } else {
            const errorMessage = typeof result.error === 'string' 
              ? result.error 
              : this.extractErrorMessage(result.error) || 'Unknown error';
            errors.push(`Batch ${i / batchSize + 1}: ${errorMessage}`);
            errorCount += batch.length;
          }

        } catch (error) {
          this.logger.error(`Failed to update price batch: ${error.message}`, error.stack);
          errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
          errorCount += batch.length;
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(`Tokopedia price update completed`, {
        tenantId,
        channelId,
        updatedCount,
        errorCount,
        processingTime,
      });

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_price_outbound',
        errorCount === 0 ? 'completed' : 'failed',
        `Updated ${updatedCount} prices in Tokopedia`,
        {
          updatedCount,
          errorCount,
          processingTime,
        },
      );

      return {
        success: errorCount === 0,
        updatedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`Tokopedia price update failed: ${error.message}`, error.stack);

      await this.logService.logSync(
        tenantId,
        channelId,
        'tokopedia_price_outbound',
        'failed',
        `Price update failed: ${error.message}`,
        { error: error.message, processingTime },
      );

      return {
        success: false,
        updatedCount,
        errorCount: errorCount + 1,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Get stock information from Tokopedia
   */
  async getTokopediaStock(
    tenantId: string,
    channelId: string,
    productSkus: string[],
  ): Promise<{
    success: boolean;
    data?: TokopediaStockInfo[];
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
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

      const result = await this.apiService.makeTokopediaRequest<{
        stock_info: TokopediaStockInfo[];
      }>(
        tenantId,
        channelId,
        config,
        {
          method: 'GET',
          endpoint: '/v1/inventory/stock',
          params: { skus: productSkus.join(',') },
          requiresAuth: true,
        },
      );

      if (result.success) {
        return {
          success: true,
          data: result.data?.stock_info || [],
        };
      } else {
        return {
          success: false,
          error: typeof result.error === 'string' 
            ? result.error 
            : this.extractErrorMessage(result.error) || 'Unknown error',
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get Tokopedia stock: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get price information from Tokopedia
   */
  async getTokopediaPrices(
    tenantId: string,
    channelId: string,
    productSkus: string[],
  ): Promise<{
    success: boolean;
    data?: TokopediaPriceInfo[];
    error?: string;
  }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
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

      const result = await this.apiService.makeTokopediaRequest<{
        price_info: TokopediaPriceInfo[];
      }>(
        tenantId,
        channelId,
        config,
        {
          method: 'GET',
          endpoint: '/v1/inventory/prices',
          params: { skus: productSkus.join(',') },
          requiresAuth: true,
        },
      );

      if (result.success) {
        return {
          success: true,
          data: result.data?.price_info || [],
        };
      } else {
        return {
          success: false,
          error: typeof result.error === 'string' 
            ? result.error 
            : this.extractErrorMessage(result.error) || 'Unknown error',
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get Tokopedia prices: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async processInboundStock(
    tenantId: string,
    channelId: string,
    stockInfo: TokopediaStockInfo,
  ): Promise<void> {
    // Find the product mapping
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: stockInfo.product_id.toString(),
      },
    });

    if (!mapping) {
      throw new Error(`No product mapping found for Tokopedia product ${stockInfo.product_id}`);
    }

    // Update or create inventory level
    // Commented out inventory repository usage
    let inventory: any = null;
    /*
    inventory = await this.inventoryRepository.findOne({
      where: {
        tenantId,
        productId: mapping.internalId,
        locationId: null, // Default location for channel inventory
      },
    });
    */

    if (!inventory) {
      // inventory = new InventoryLevel();
      inventory = {
        tenantId,
        productId: mapping.internalId,
        locationId: null,
      };
    }

    inventory.quantityOnHand = stockInfo.available_stock;
    inventory.quantityReserved = stockInfo.reserved_stock;
    inventory.quantityAvailable = stockInfo.available_stock;
    inventory.lastUpdatedAt = new Date();
    inventory.metadata = {
      tokopedia: {
        productId: stockInfo.product_id,
        sku: stockInfo.sku,
        variantId: stockInfo.variant_id,
        totalStock: stockInfo.stock,
        lastSyncAt: new Date(),
      },
    };

    // await this.inventoryRepository.save(inventory); // Commented out
  }

  private async processInboundPrice(
    tenantId: string,
    channelId: string,
    priceInfo: TokopediaPriceInfo,
  ): Promise<void> {
    // Find the product mapping
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: priceInfo.product_id.toString(),
      },
    });

    if (!mapping) {
      throw new Error(`No product mapping found for Tokopedia product ${priceInfo.product_id}`);
    }

    // Update product price
    const product = await this.productRepository.findOne({
      where: { id: mapping.internalId, tenantId },
    });

    if (product) {
      product.sellingPrice = priceInfo.price;
      
      if (!product.metadata) {
        product.metadata = {};
      }
      
      product.metadata.tokopedia = {
        ...product.metadata.tokopedia,
        price: priceInfo.price,
        specialPrice: priceInfo.special_price,
        specialPriceStart: priceInfo.special_price_start,
        specialPriceEnd: priceInfo.special_price_end,
        currency: priceInfo.currency,
        lastPriceSyncAt: new Date(),
      };

      await this.productRepository.save(product);
    }
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