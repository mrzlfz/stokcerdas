import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { LazadaApiService, LazadaConfig } from './lazada-api.service';
import { ApiConfig } from '../../common/services/base-api.service';
import { LazadaAuthService } from './lazada-auth.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../entities/integration-log.entity';
import { InventoryItem } from '../../../inventory/entities/inventory-item.entity';

export interface LazadaInventoryItem {
  seller_sku: string;
  shop_sku: string;
  quantity: number;
  price: string;
  special_price?: string;
  special_from_date?: string;
  special_to_date?: string;
  available: number;
  reserved: number;
  item_id: number;
  sku_id: number;
}

export interface StockUpdateRequest {
  seller_sku: string;
  quantity: number;
}

export interface PriceUpdateRequest {
  seller_sku: string;
  price: number;
  special_price?: number;
  special_from_date?: string;
  special_to_date?: string;
}

export interface InventorySyncOptions {
  syncStock?: boolean;
  syncPrices?: boolean;
  sellerSkus?: string[];
  offset?: number;
  limit?: number;
}

export interface LazadaPriceResponse {
  seller_sku: string;
  price: string;
  special_price?: string;
  special_from_date?: string;
  special_to_date?: string;
}

export interface LazadaStockResponse {
  seller_sku: string;
  quantity: number;
  available: number;
  reserved: number;
}

@Injectable()
export class LazadaInventoryService {
  private readonly logger = new Logger(LazadaInventoryService.name);

  constructor(
    private readonly lazadaApi: LazadaApiService,
    private readonly authService: LazadaAuthService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
  ) {}

  /**
   * Sync inventory from Lazada to local system
   */
  async syncInventoryFromLazada(
    tenantId: string,
    channelId: string,
    options: InventorySyncOptions = {},
  ): Promise<{
    success: boolean;
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      this.logger.debug(`Starting Lazada inventory sync`, {
        tenantId,
        channelId,
        options,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Sync stock if requested
      if (options.syncStock !== false) {
        const stockResult = await this.syncStockFromLazada(
          tenantId,
          channelId,
          lazadaConfig,
          options,
        );
        syncedCount += stockResult.syncedCount;
        errorCount += stockResult.errorCount;
        errors.push(...stockResult.errors);
      }

      // Sync prices if requested
      if (options.syncPrices !== false) {
        const priceResult = await this.syncPricesFromLazada(
          tenantId,
          channelId,
          lazadaConfig,
          options,
        );
        syncedCount += priceResult.syncedCount;
        errorCount += priceResult.errorCount;
        errors.push(...priceResult.errors);
      }

      // Log sync summary
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_inventory_inbound',
        errorCount === 0 ? 'completed' : 'failed',
        `Inventory sync completed: ${syncedCount} synced, ${errorCount} errors`,
        {
          syncedCount,
          errorCount,
          syncStock: options.syncStock,
          syncPrices: options.syncPrices,
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
      this.logger.error(`Inventory sync failed: ${error.message}`, error.stack);

      // Log sync failure
      await this.logService.logSync(
        tenantId,
        channelId,
        'lazada_inventory_inbound',
        'failed',
        `Inventory sync failed: ${error.message}`,
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
   * Update stock quantities in Lazada
   */
  async updateLazadaInventory(
    tenantId: string,
    channelId: string,
    updates: StockUpdateRequest[],
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    try {
      this.logger.debug(`Updating Lazada inventory`, {
        tenantId,
        channelId,
        updateCount: updates.length,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Process updates in batches of 50 (Lazada limit)
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        try {
          // Update stock for batch
          const result = await this.lazadaApi.makeLazadaRequest(
            tenantId,
            channelId,
            lazadaConfig,
            {
              method: 'POST',
              path: '/product/price_quantity/update',
              body: { skus: batch },
              requiresAuth: true,
              rateLimitKey: 'inventory_update',
            },
          );

          if (result.success) {
            updatedCount += batch.length;

            // Log successful batch update
            await this.logService.log({
              tenantId,
              channelId,
              type: IntegrationLogType.SYNC,
              level: IntegrationLogLevel.INFO,
              message: `Lazada inventory batch updated successfully`,
              metadata: {
                batchSize: batch.length,
                skus: batch.map(u => u.seller_sku),
              },
            });
          } else {
            throw new Error(result.error || 'Batch update failed');
          }
        } catch (error) {
          this.logger.error(
            `Batch inventory update failed: ${error.message}`,
            error.stack,
          );
          errors.push(
            `Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`,
          );
          errorCount += batch.length;
        }
      }

      return {
        success: errorCount === 0,
        updatedCount,
        errorCount,
        errors,
      };
    } catch (error) {
      this.logger.error(
        `Inventory update failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        updatedCount,
        errorCount: errorCount + updates.length,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Update prices in Lazada
   */
  async updateLazadaPrices(
    tenantId: string,
    channelId: string,
    updates: PriceUpdateRequest[],
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    try {
      this.logger.debug(`Updating Lazada prices`, {
        tenantId,
        channelId,
        updateCount: updates.length,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Process updates in batches of 50 (Lazada limit)
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        try {
          // Update prices for batch
          const result = await this.lazadaApi.makeLazadaRequest(
            tenantId,
            channelId,
            lazadaConfig,
            {
              method: 'POST',
              path: '/product/price_quantity/update',
              body: { skus: batch },
              requiresAuth: true,
              rateLimitKey: 'price_update',
            },
          );

          if (result.success) {
            updatedCount += batch.length;

            // Log successful batch update
            await this.logService.log({
              tenantId,
              channelId,
              type: IntegrationLogType.SYNC,
              level: IntegrationLogLevel.INFO,
              message: `Lazada prices batch updated successfully`,
              metadata: {
                batchSize: batch.length,
                skus: batch.map(u => u.seller_sku),
              },
            });
          } else {
            throw new Error(result.error || 'Batch price update failed');
          }
        } catch (error) {
          this.logger.error(
            `Batch price update failed: ${error.message}`,
            error.stack,
          );
          errors.push(
            `Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`,
          );
          errorCount += batch.length;
        }
      }

      return {
        success: errorCount === 0,
        updatedCount,
        errorCount,
        errors,
      };
    } catch (error) {
      this.logger.error(`Price update failed: ${error.message}`, error.stack);
      return {
        success: false,
        updatedCount,
        errorCount: errorCount + updates.length,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Get stock levels from Lazada
   */
  async getLazadaStock(
    tenantId: string,
    channelId: string,
    sellerSkus: string[],
  ): Promise<{
    success: boolean;
    data?: LazadaStockResponse[];
    error?: string;
  }> {
    try {
      this.logger.debug(`Getting Lazada stock levels`, {
        tenantId,
        channelId,
        skuCount: sellerSkus.length,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Get stock levels from Lazada
      const result = await this.lazadaApi.makeLazadaRequest<
        LazadaStockResponse[]
      >(tenantId, channelId, lazadaConfig, {
        method: 'GET',
        path: '/product/quantity/get',
        params: {
          seller_sku: sellerSkus.join(','),
        },
        requiresAuth: true,
        rateLimitKey: 'stock_get',
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to fetch stock from Lazada',
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get stock levels: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get prices from Lazada
   */
  async getLazadaPrice(
    tenantId: string,
    channelId: string,
    sellerSkus: string[],
  ): Promise<{
    success: boolean;
    data?: LazadaPriceResponse[];
    error?: string;
  }> {
    try {
      this.logger.debug(`Getting Lazada prices`, {
        tenantId,
        channelId,
        skuCount: sellerSkus.length,
      });

      // Get valid credentials
      const credentials = await this.authService.getValidCredentials(
        tenantId,
        channelId,
      );

      const lazadaConfig: LazadaConfig = {
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        accessToken: credentials.accessToken,
        region: credentials.region as any,
      };

      // Get prices from Lazada
      const result = await this.lazadaApi.makeLazadaRequest<
        LazadaPriceResponse[]
      >(tenantId, channelId, lazadaConfig, {
        method: 'GET',
        path: '/product/price/get',
        params: {
          seller_sku: sellerSkus.join(','),
        },
        requiresAuth: true,
        rateLimitKey: 'price_get',
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to fetch stock from Lazada',
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get prices: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sync single SKU inventory from Lazada
   */
  async syncSingleSkuInventory(
    tenantId: string,
    channelId: string,
    sellerSku: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.debug(`Syncing single SKU inventory from Lazada`, {
        tenantId,
        channelId,
        sellerSku,
      });

      // Get stock and price data
      const stockResult = await this.getLazadaStock(tenantId, channelId, [
        sellerSku,
      ]);
      const priceResult = await this.getLazadaPrice(tenantId, channelId, [
        sellerSku,
      ]);

      if (!stockResult.success) {
        throw new Error(`Failed to get stock: ${stockResult.error}`);
      }

      if (!priceResult.success) {
        throw new Error(`Failed to get price: ${priceResult.error}`);
      }

      const stockData = stockResult.data?.[0];
      const priceData = priceResult.data?.[0];

      if (!stockData || !priceData) {
        throw new Error(`No data found for SKU: ${sellerSku}`);
      }

      // Update local inventory
      await this.updateLocalInventoryFromLazada(
        tenantId,
        channelId,
        stockData,
        priceData,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to sync single SKU inventory: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async syncStockFromLazada(
    tenantId: string,
    channelId: string,
    lazadaConfig: LazadaConfig,
    options: InventorySyncOptions,
  ): Promise<{ syncedCount: number; errorCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      // Prepare parameters
      const params: any = {
        offset: options.offset || 0,
        limit: Math.min(options.limit || 500, 500),
      };

      if (options.sellerSkus && options.sellerSkus.length > 0) {
        params.seller_sku = options.sellerSkus.join(',');
      }

      // Get stock data from Lazada
      const apiConfig = this.createApiConfig(lazadaConfig);
      const result = await this.lazadaApi.makeRequest<LazadaStockResponse[]>(
        apiConfig,
        {
          method: 'GET',
          endpoint: '/product/quantity/get',
          params,
        },
        tenantId,
        channelId,
      );

      if (!result.success || !result.data) {
        throw new Error(
          result.error?.message || 'Failed to fetch stock from Lazada',
        );
      }

      const stockData = result.data;

      // Sync each stock item
      for (const stockItem of stockData) {
        try {
          await this.updateLocalStockFromLazada(tenantId, channelId, stockItem);
          syncedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to sync stock for ${stockItem.seller_sku}: ${error.message}`,
            error.stack,
          );
          errors.push(`Stock ${stockItem.seller_sku}: ${error.message}`);
          errorCount++;
        }
      }
    } catch (error) {
      this.logger.error(`Stock sync failed: ${error.message}`, error.stack);
      errors.push(error.message);
      errorCount++;
    }

    return { syncedCount, errorCount, errors };
  }

  private async syncPricesFromLazada(
    tenantId: string,
    channelId: string,
    lazadaConfig: LazadaConfig,
    options: InventorySyncOptions,
  ): Promise<{ syncedCount: number; errorCount: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;
    let errorCount = 0;

    try {
      // Prepare parameters
      const params: any = {
        offset: options.offset || 0,
        limit: Math.min(options.limit || 500, 500),
      };

      if (options.sellerSkus && options.sellerSkus.length > 0) {
        params.seller_sku = options.sellerSkus.join(',');
      }

      // Get price data from Lazada
      const apiConfig = this.createApiConfig(lazadaConfig);
      const result = await this.lazadaApi.makeRequest<LazadaPriceResponse[]>(
        apiConfig,
        {
          method: 'GET',
          endpoint: '/product/price/get',
          params,
        },
        tenantId,
        channelId,
      );

      if (!result.success || !result.data) {
        throw new Error(
          result.error?.message || 'Failed to fetch prices from Lazada',
        );
      }

      const priceData = result.data;

      // Sync each price item
      for (const priceItem of priceData) {
        try {
          await this.updateLocalPriceFromLazada(tenantId, channelId, priceItem);
          syncedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to sync price for ${priceItem.seller_sku}: ${error.message}`,
            error.stack,
          );
          errors.push(`Price ${priceItem.seller_sku}: ${error.message}`);
          errorCount++;
        }
      }
    } catch (error) {
      this.logger.error(`Price sync failed: ${error.message}`, error.stack);
      errors.push(error.message);
      errorCount++;
    }

    return { syncedCount, errorCount, errors };
  }

  private async updateLocalStockFromLazada(
    tenantId: string,
    channelId: string,
    stockData: LazadaStockResponse,
  ): Promise<void> {
    // Find local inventory record by SKU
    // This would need proper mapping implementation
    this.logger.debug(`Updating local stock for SKU: ${stockData.seller_sku}`, {
      tenantId,
      channelId,
      quantity: stockData.quantity,
      available: stockData.available,
      reserved: stockData.reserved,
    });

    // Implementation would update local inventory records
    // For now, just log the update
  }

  private async updateLocalPriceFromLazada(
    tenantId: string,
    channelId: string,
    priceData: LazadaPriceResponse,
  ): Promise<void> {
    // Find local product record by SKU
    // This would need proper mapping implementation
    this.logger.debug(`Updating local price for SKU: ${priceData.seller_sku}`, {
      tenantId,
      channelId,
      price: priceData.price,
      specialPrice: priceData.special_price,
    });

    // Implementation would update local product pricing
    // For now, just log the update
  }

  private async updateLocalInventoryFromLazada(
    tenantId: string,
    channelId: string,
    stockData: LazadaStockResponse,
    priceData: LazadaPriceResponse,
  ): Promise<void> {
    // Combined update for both stock and price
    this.logger.debug(
      `Updating local inventory for SKU: ${stockData.seller_sku}`,
      {
        tenantId,
        channelId,
        stock: stockData,
        price: priceData,
      },
    );

    // Implementation would update both inventory levels and pricing
    // For now, just log the update
  }

  private createApiConfig(lazadaConfig: LazadaConfig): ApiConfig {
    const baseUrls = {
      MY: 'https://api.lazada.com.my/rest',
      SG: 'https://api.lazada.sg/rest',
      TH: 'https://api.lazada.co.th/rest',
      ID: 'https://api.lazada.co.id/rest',
      PH: 'https://api.lazada.com.ph/rest',
      VN: 'https://api.lazada.vn/rest',
    };

    return {
      baseUrl: baseUrls[lazadaConfig.region] || baseUrls.ID,
      timeout: 30000,
      retries: 3,
      authentication: {
        type: 'oauth',
        credentials: {
          appKey: lazadaConfig.appKey,
          appSecret: lazadaConfig.appSecret,
          accessToken: lazadaConfig.accessToken,
          refreshToken: lazadaConfig.refreshToken,
          region: lazadaConfig.region,
          sandbox: lazadaConfig.sandbox,
        },
      },
    };
  }
}
