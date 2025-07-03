import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ShopeeApiService, ShopeeCredentials, ShopeeApiRequest } from './shopee-api.service';
import { ShopeeAuthService } from './shopee-auth.service';
import { InventoryTransaction } from '../../../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../../../inventory/entities/inventory-location.entity';
import { ChannelMapping } from '../../../channels/entities/channel-mapping.entity';
import { ChannelInventory, AllocationStrategy } from '../../../channels/entities/channel-inventory.entity';
import { IntegrationLogService } from '../../common/services/integration-log.service';

export interface ShopeeStock {
  item_id: number;
  stock_info_list: Array<{
    stock_type: number;
    current_stock: number;
    reserved_stock: number;
    normal_stock: number;
  }>;
  model?: Array<{
    model_id: number;
    stock_info_list: Array<{
      stock_type: number;
      current_stock: number;
      reserved_stock: number;
      normal_stock: number;
    }>;
  }>;
}

export interface ShopeePrice {
  item_id: number;
  price_info: Array<{
    current_price: number;
    original_price: number;
    inflated_price_of_current_price: number;
    inflated_price_of_original_price: number;
    sip_item_price: number;
    sip_item_price_source: string;
  }>;
  model?: Array<{
    model_id: number;
    price_info: Array<{
      current_price: number;
      original_price: number;
      inflated_price_of_current_price: number;
      inflated_price_of_original_price: number;
      sip_item_price: number;
      sip_item_price_source: string;
    }>;
  }>;
}

export interface InventorySyncOptions {
  syncStock?: boolean;
  syncPrices?: boolean;
  batchSize?: number;
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
  locationId?: string;
}

export interface StockUpdateRequest {
  itemId: number;
  modelId?: number;
  stock: number;
  stockType?: number; // 0: normal stock, 1: reserved stock
}

export interface PriceUpdateRequest {
  itemId: number;
  modelId?: number;
  originalPrice: number;
  currentPrice?: number;
}

@Injectable()
export class ShopeeInventoryService {
  private readonly logger = new Logger(ShopeeInventoryService.name);

  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly inventoryRepository: Repository<InventoryTransaction>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    @InjectRepository(ChannelInventory)
    private readonly channelInventoryRepository: Repository<ChannelInventory>,
    private readonly shopeeApiService: ShopeeApiService,
    private readonly authService: ShopeeAuthService,
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Sync inventory from Shopee to local system
   */
  async syncInventoryFromShopee(
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
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_inventory_inbound',
        'started',
        'Starting inventory sync from Shopee',
        { options },
      );

      // Get product mappings to know which items to sync
      const productMappings = await this.mappingRepository.find({
        where: {
          tenantId,
          channelId,
          entityType: 'product',
        },
      });

      if (productMappings.length === 0) {
        this.logger.warn(`No product mappings found for channel ${channelId}`);
        return {
          success: true,
          syncedCount: 0,
          errorCount: 0,
          errors: [],
        };
      }

      const itemIds = productMappings.map(m => parseInt(m.externalId));
      const batchSize = options.batchSize || 50;

      // Process items in batches
      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batch = itemIds.slice(i, i + batchSize);
        
        try {
          const batchResult = await this.syncInventoryBatch(
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
          this.logger.error(`Inventory batch sync failed: ${error.message}`, error.stack);
          errorCount += batch.length;
          errors.push(`Batch sync failed: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_inventory_inbound',
        'completed',
        `Inventory sync completed: ${syncedCount} synced, ${errorCount} errors`,
        { syncedCount, errorCount, duration, totalItems: itemIds.length },
      );

      return {
        success: true,
        syncedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Inventory sync failed: ${error.message}`, error.stack);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_inventory_inbound',
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
   * Update inventory in Shopee
   */
  async updateShopeeInventory(
    tenantId: string,
    channelId: string,
    updates: StockUpdateRequest[],
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_inventory_outbound',
        'started',
        'Starting inventory update to Shopee',
        { updateCount: updates.length },
      );

      // Process updates in batches
      const batchSize = 20;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        try {
          const batchResult = await this.updateStockBatch(
            credentials,
            tenantId,
            channelId,
            batch,
          );

          updatedCount += batchResult.updatedCount;
          errorCount += batchResult.errorCount;
          errors.push(...batchResult.errors);

        } catch (error) {
          this.logger.error(`Stock update batch failed: ${error.message}`, error.stack);
          errorCount += batch.length;
          errors.push(`Batch update failed: ${error.message}`);
        }
      }

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_inventory_outbound',
        'completed',
        `Inventory update completed: ${updatedCount} updated, ${errorCount} errors`,
        { updatedCount, errorCount },
      );

      return {
        success: true,
        updatedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Inventory update failed: ${error.message}`, error.stack);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_inventory_outbound',
        'failed',
        error.message,
        { updatedCount, errorCount },
      );

      return {
        success: false,
        updatedCount,
        errorCount,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Update prices in Shopee
   */
  async updateShopeePrices(
    tenantId: string,
    channelId: string,
    updates: PriceUpdateRequest[],
  ): Promise<{
    success: boolean;
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_prices_outbound',
        'started',
        'Starting price update to Shopee',
        { updateCount: updates.length },
      );

      // Process updates individually (Shopee API requires individual calls)
      for (const update of updates) {
        try {
          const result = await this.updateSinglePrice(
            credentials,
            tenantId,
            channelId,
            update,
          );

          if (result.success) {
            updatedCount++;
          } else {
            errorCount++;
            errors.push(`Item ${update.itemId}: ${result.error}`);
          }

        } catch (error) {
          this.logger.error(`Price update failed for item ${update.itemId}: ${error.message}`);
          errorCount++;
          errors.push(`Item ${update.itemId}: ${error.message}`);
        }
      }

      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_prices_outbound',
        'completed',
        `Price update completed: ${updatedCount} updated, ${errorCount} errors`,
        { updatedCount, errorCount },
      );

      return {
        success: true,
        updatedCount,
        errorCount,
        errors,
      };

    } catch (error) {
      this.logger.error(`Price update failed: ${error.message}`, error.stack);
      
      await this.logService.logSync(
        tenantId,
        channelId,
        'shopee_prices_outbound',
        'failed',
        error.message,
        { updatedCount, errorCount },
      );

      return {
        success: false,
        updatedCount,
        errorCount,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Get stock info from Shopee
   */
  async getShopeeStock(
    tenantId: string,
    channelId: string,
    itemIds: number[],
  ): Promise<{ success: boolean; data?: ShopeeStock[]; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/product/get_stock_info',
        params: {
          item_id_list: itemIds,
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success && response.data?.stock_info_list) {
        return {
          success: true,
          data: response.data.stock_info_list,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to get stock info',
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get Shopee stock: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get price info from Shopee
   */
  async getShopeePrice(
    tenantId: string,
    channelId: string,
    itemIds: number[],
  ): Promise<{ success: boolean; data?: ShopeePrice[]; error?: string }> {
    try {
      const credentials = await this.authService.getValidCredentials(tenantId, channelId);

      const request: ShopeeApiRequest = {
        method: 'GET',
        endpoint: '/product/get_price_info',
        params: {
          item_id_list: itemIds,
        },
      };

      const response = await this.shopeeApiService.makeShopeeRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );

      if (response.success && response.data?.price_info) {
        return {
          success: true,
          data: response.data.price_info,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to get price info',
        };
      }

    } catch (error) {
      this.logger.error(`Failed to get Shopee price: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Private helper methods

  private async syncInventoryBatch(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    itemIds: number[],
    options: InventorySyncOptions,
  ): Promise<{
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Sync stock if enabled
    if (options.syncStock !== false) {
      try {
        const stockResult = await this.getShopeeStock(tenantId, channelId, itemIds);
        
        if (stockResult.success && stockResult.data) {
          for (const stockInfo of stockResult.data) {
            try {
              await this.syncSingleItemStock(
                tenantId,
                channelId,
                stockInfo,
                options.locationId,
              );
              syncedCount++;
            } catch (error) {
              errors.push(`Stock sync for item ${stockInfo.item_id}: ${error.message}`);
              errorCount++;
            }
          }
        } else {
          errors.push(`Failed to get stock batch: ${stockResult.error}`);
          errorCount += itemIds.length;
        }
      } catch (error) {
        errors.push(`Stock batch failed: ${error.message}`);
        errorCount += itemIds.length;
      }
    }

    // Sync prices if enabled
    if (options.syncPrices) {
      try {
        const priceResult = await this.getShopeePrice(tenantId, channelId, itemIds);
        
        if (priceResult.success && priceResult.data) {
          for (const priceInfo of priceResult.data) {
            try {
              await this.syncSingleItemPrice(
                tenantId,
                channelId,
                priceInfo,
              );
              // Don't increment syncedCount here to avoid double counting
            } catch (error) {
              errors.push(`Price sync for item ${priceInfo.item_id}: ${error.message}`);
              // Don't increment errorCount here to avoid double counting
            }
          }
        } else {
          errors.push(`Failed to get price batch: ${priceResult.error}`);
        }
      } catch (error) {
        errors.push(`Price batch failed: ${error.message}`);
      }
    }

    return { syncedCount, errorCount, errors };
  }

  private async syncSingleItemStock(
    tenantId: string,
    channelId: string,
    stockInfo: ShopeeStock,
    locationId?: string,
  ): Promise<void> {
    // Find product mapping
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: stockInfo.item_id.toString(),
      },
    });

    if (!mapping) {
      this.logger.warn(`No product mapping found for Shopee item ${stockInfo.item_id}`);
      return;
    }

    // Update channel inventory
    for (const stockDetail of stockInfo.stock_info_list) {
      let channelInventory = await this.channelInventoryRepository.findOne({
        where: {
          tenantId,
          channelId,
          productId: mapping.internalId,
          // Add variant mapping if needed
        },
      });

      if (!channelInventory) {
        channelInventory = this.channelInventoryRepository.create({
          tenantId,
          channelId,
          productId: mapping.internalId,
          allocatedQuantity: stockDetail.current_stock,
          availableQuantity: stockDetail.current_stock - stockDetail.reserved_stock,
          reservedQuantity: stockDetail.reserved_stock,
          allocationStrategy: AllocationStrategy.FIXED_AMOUNT,
          allocationValue: stockDetail.current_stock,
          priority: 1,
        });
      } else {
        channelInventory.allocatedQuantity = stockDetail.current_stock;
        channelInventory.availableQuantity = stockDetail.current_stock - stockDetail.reserved_stock;
        channelInventory.reservedQuantity = stockDetail.reserved_stock;
        channelInventory.lastSyncAt = new Date();
      }

      await this.channelInventoryRepository.save(channelInventory);
    }

    // Handle variants if present
    if (stockInfo.model && stockInfo.model.length > 0) {
      for (const modelStock of stockInfo.model) {
        // Find variant mapping
        const variantMapping = await this.mappingRepository.findOne({
          where: {
            tenantId,
            channelId,
            entityType: 'product_variant',
            externalId: modelStock.model_id.toString(),
          },
        });

        if (variantMapping) {
          for (const stockDetail of modelStock.stock_info_list) {
            let channelInventory = await this.channelInventoryRepository.findOne({
              where: {
                tenantId,
                channelId,
                productId: mapping.internalId,
                variantId: variantMapping.internalId,
              },
            });

            if (!channelInventory) {
              channelInventory = this.channelInventoryRepository.create({
                tenantId,
                channelId,
                productId: mapping.internalId,
                variantId: variantMapping.internalId,
                allocatedQuantity: stockDetail.current_stock,
                availableQuantity: stockDetail.current_stock - stockDetail.reserved_stock,
                reservedQuantity: stockDetail.reserved_stock,
                allocationStrategy: AllocationStrategy.FIXED_AMOUNT,
          allocationValue: stockDetail.current_stock,
                priority: 1,
              });
            } else {
              channelInventory.allocatedQuantity = stockDetail.current_stock;
              channelInventory.availableQuantity = stockDetail.current_stock - stockDetail.reserved_stock;
              channelInventory.reservedQuantity = stockDetail.reserved_stock;
              channelInventory.lastSyncAt = new Date();
            }

            await this.channelInventoryRepository.save(channelInventory);
          }
        }
      }
    }

    // Emit inventory sync event
    this.eventEmitter.emit('inventory.synced.shopee', {
      tenantId,
      channelId,
      productId: mapping.internalId,
      externalId: stockInfo.item_id,
      syncDirection: 'inbound',
    });
  }

  private async syncSingleItemPrice(
    tenantId: string,
    channelId: string,
    priceInfo: ShopeePrice,
  ): Promise<void> {
    // Find product mapping
    const mapping = await this.mappingRepository.findOne({
      where: {
        tenantId,
        channelId,
        entityType: 'product',
        externalId: priceInfo.item_id.toString(),
      },
    });

    if (!mapping) {
      this.logger.warn(`No product mapping found for Shopee item ${priceInfo.item_id}`);
      return;
    }

    // Update price information in metadata or separate price entity
    // This would depend on your pricing model architecture
    // For now, we'll just emit an event

    this.eventEmitter.emit('price.synced.shopee', {
      tenantId,
      channelId,
      productId: mapping.internalId,
      externalId: priceInfo.item_id,
      priceInfo: priceInfo.price_info[0], // Take first price info
      syncDirection: 'inbound',
    });
  }

  private async updateStockBatch(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    updates: StockUpdateRequest[],
  ): Promise<{
    updatedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Group updates by item (Shopee API can handle multiple stock updates per item)
    const itemUpdates = new Map<number, StockUpdateRequest[]>();
    
    for (const update of updates) {
      if (!itemUpdates.has(update.itemId)) {
        itemUpdates.set(update.itemId, []);
      }
      itemUpdates.get(update.itemId)!.push(update);
    }

    // Process each item
    for (const [itemId, itemStockUpdates] of itemUpdates) {
      try {
        const result = await this.updateSingleItemStock(
          credentials,
          tenantId,
          channelId,
          itemId,
          itemStockUpdates,
        );

        if (result.success) {
          updatedCount += itemStockUpdates.length;
        } else {
          errorCount += itemStockUpdates.length;
          errors.push(`Item ${itemId}: ${result.error}`);
        }

      } catch (error) {
        this.logger.error(`Stock update failed for item ${itemId}: ${error.message}`);
        errorCount += itemStockUpdates.length;
        errors.push(`Item ${itemId}: ${error.message}`);
      }
    }

    return { updatedCount, errorCount, errors };
  }

  private async updateSingleItemStock(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    itemId: number,
    updates: StockUpdateRequest[],
  ): Promise<{ success: boolean; error?: string }> {
    const stockList: any[] = [];

    for (const update of updates) {
      if (update.modelId) {
        // Variant stock update
        stockList.push({
          model_id: update.modelId,
          normal_stock: update.stock,
        });
      } else {
        // Main product stock update
        stockList.push({
          normal_stock: update.stock,
        });
      }
    }

    const request: ShopeeApiRequest = {
      method: 'POST',
      endpoint: '/product/update_stock',
      data: {
        item_id: itemId,
        stock_list: stockList,
      },
    };

    const response = await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );

    if (response.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: response.error?.message || 'Stock update failed',
      };
    }
  }

  private async updateSinglePrice(
    credentials: ShopeeCredentials,
    tenantId: string,
    channelId: string,
    update: PriceUpdateRequest,
  ): Promise<{ success: boolean; error?: string }> {
    const priceList: any[] = [];

    if (update.modelId) {
      // Variant price update
      priceList.push({
        model_id: update.modelId,
        original_price: update.originalPrice,
        current_price: update.currentPrice || update.originalPrice,
      });
    } else {
      // Main product price update
      priceList.push({
        original_price: update.originalPrice,
        current_price: update.currentPrice || update.originalPrice,
      });
    }

    const request: ShopeeApiRequest = {
      method: 'POST',
      endpoint: '/product/update_price',
      data: {
        item_id: update.itemId,
        price_list: priceList,
      },
    };

    const response = await this.shopeeApiService.makeShopeeRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );

    if (response.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: response.error?.message || 'Price update failed',
      };
    }
  }
}