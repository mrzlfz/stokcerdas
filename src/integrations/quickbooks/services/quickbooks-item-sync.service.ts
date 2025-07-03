import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuickBooksApiService, QuickBooksCredentials, QuickBooksItem } from './quickbooks-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { Product, ProductType, ProductStatus } from '../../../products/entities/product.entity';
import { AccountingAccount, AccountingDataType } from '../../entities/accounting-account.entity';
import { SyncStatus, SyncEntityType, SyncDirection, SyncStatusEnum } from '../../entities/sync-status.entity';

export interface ItemSyncOptions {
  direction?: 'inbound' | 'outbound' | 'bidirectional';
  syncInventoryQuantities?: boolean;
  syncPrices?: boolean;
  createMissingAccounts?: boolean;
  defaultIncomeAccountId?: string;
  defaultExpenseAccountId?: string;
  defaultAssetAccountId?: string;
  batchSize?: number;
}

export interface SyncResult {
  success: boolean;
  totalItems: number;
  syncedItems: number;
  failedItems: number;
  errors: Array<{
    itemId?: string;
    error: string;
    details?: any;
  }>;
  duration: number;
}

@Injectable()
export class QuickBooksItemSyncService {
  private readonly logger = new Logger(QuickBooksItemSyncService.name);

  constructor(
    private readonly quickBooksApiService: QuickBooksApiService,
    private readonly integrationLogService: IntegrationLogService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(SyncStatus)
    private readonly syncStatusRepository: Repository<SyncStatus>,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
  ) {}

  /**
   * Sync products from StokCerdas to QuickBooks
   */
  async syncToQuickBooks(
    accountingAccountId: string,
    tenantId: string,
    options: ItemSyncOptions = {},
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      totalItems: 0,
      syncedItems: 0,
      failedItems: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.logger.log(`Starting QuickBooks item sync for tenant ${tenantId}`);

      // Get accounting account with credentials
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const credentials: QuickBooksCredentials = {
        clientId: accountingAccount.clientId!,
        clientSecret: accountingAccount.clientSecret!,
        accessToken: accountingAccount.accessToken!,
        refreshToken: accountingAccount.refreshToken!,
        realmId: accountingAccount.platformConfig?.realmId!,
        environment: accountingAccount.platformConfig?.environment || 'production',
        expiresAt: accountingAccount.tokenExpiresAt,
      };

      // Get products to sync
      const products = await this.getProductsToSync(tenantId, options);
      result.totalItems = products.length;

      this.logger.log(`Found ${products.length} products to sync`);

      // Create sync status record
      const syncStatus = await this.createSyncStatus(
        tenantId,
        accountingAccount.channelId!,
        result.totalItems,
      );

      // Sync products in batches
      const batchSize = options.batchSize || 10;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        
        for (const product of batch) {
          try {
            await this.syncProductToQuickBooks(product, credentials, tenantId, accountingAccount.channelId!, options);
            result.syncedItems++;
            
            // Update sync status progress
            await this.updateSyncProgress(syncStatus.id, result.syncedItems, result.failedItems);
            
          } catch (error) {
            result.failedItems++;
            result.errors.push({
              itemId: product.id,
              error: error.message,
              details: error,
            });

            this.logger.error(`Failed to sync product ${product.id}: ${error.message}`);
            
            // Update sync status progress
            await this.updateSyncProgress(syncStatus.id, result.syncedItems, result.failedItems);
          }
        }

        // Small delay between batches to respect rate limits
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Complete sync status
      await this.completeSyncStatus(syncStatus.id, result);

      result.success = result.failedItems === 0;
      result.duration = Date.now() - startTime;

      this.logger.log(`QuickBooks item sync completed: ${result.syncedItems}/${result.totalItems} items synced`);

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      this.logger.error(`QuickBooks item sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync items from QuickBooks to StokCerdas
   */
  async syncFromQuickBooks(
    accountingAccountId: string,
    tenantId: string,
    options: ItemSyncOptions = {},
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      totalItems: 0,
      syncedItems: 0,
      failedItems: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.logger.log(`Starting QuickBooks item import for tenant ${tenantId}`);

      // Get accounting account with credentials
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const credentials: QuickBooksCredentials = {
        clientId: accountingAccount.clientId!,
        clientSecret: accountingAccount.clientSecret!,
        accessToken: accountingAccount.accessToken!,
        refreshToken: accountingAccount.refreshToken!,
        realmId: accountingAccount.platformConfig?.realmId!,
        environment: accountingAccount.platformConfig?.environment || 'production',
        expiresAt: accountingAccount.tokenExpiresAt,
      };

      // Get items from QuickBooks
      const response = await this.quickBooksApiService.queryItems(
        credentials,
        "SELECT * FROM Item WHERE Active = true",
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to fetch items from QuickBooks: ${response.error?.message}`);
      }

      const quickBooksItems = response.data?.QueryResponse?.Item || [];
      result.totalItems = quickBooksItems.length;

      this.logger.log(`Found ${quickBooksItems.length} items in QuickBooks`);

      // Create sync status record
      const syncStatus = await this.createSyncStatus(
        tenantId,
        accountingAccount.channelId!,
        result.totalItems,
      );

      // Sync items
      for (const qbItem of quickBooksItems) {
        try {
          await this.syncItemFromQuickBooks(qbItem, tenantId, options);
          result.syncedItems++;
          
          // Update sync status progress
          await this.updateSyncProgress(syncStatus.id, result.syncedItems, result.failedItems);
          
        } catch (error) {
          result.failedItems++;
          result.errors.push({
            itemId: qbItem.Id,
            error: error.message,
            details: error,
          });

          this.logger.error(`Failed to import QuickBooks item ${qbItem.Id}: ${error.message}`);
          
          // Update sync status progress
          await this.updateSyncProgress(syncStatus.id, result.syncedItems, result.failedItems);
        }
      }

      // Complete sync status
      await this.completeSyncStatus(syncStatus.id, result);

      result.success = result.failedItems === 0;
      result.duration = Date.now() - startTime;

      this.logger.log(`QuickBooks item import completed: ${result.syncedItems}/${result.totalItems} items imported`);

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      this.logger.error(`QuickBooks item import failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bidirectional sync
   */
  async bidirectionalSync(
    accountingAccountId: string,
    tenantId: string,
    options: ItemSyncOptions = {},
  ): Promise<{
    outbound: SyncResult;
    inbound: SyncResult;
  }> {
    this.logger.log(`Starting bidirectional sync for tenant ${tenantId}`);

    // First sync outbound (StokCerdas -> QuickBooks)
    const outbound = await this.syncToQuickBooks(accountingAccountId, tenantId, {
      ...options,
      direction: 'outbound',
    });

    // Then sync inbound (QuickBooks -> StokCerdas)
    const inbound = await this.syncFromQuickBooks(accountingAccountId, tenantId, {
      ...options,
      direction: 'inbound',
    });

    return { outbound, inbound };
  }

  /**
   * Get products that need to be synced
   */
  private async getProductsToSync(tenantId: string, options: ItemSyncOptions): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false });

    // Only sync active products by default
    queryBuilder.andWhere('product.status = :status', { status: 'active' });

    return queryBuilder.getMany();
  }

  /**
   * Sync a single product to QuickBooks
   */
  private async syncProductToQuickBooks(
    product: Product,
    credentials: QuickBooksCredentials,
    tenantId: string,
    channelId: string,
    options: ItemSyncOptions,
  ): Promise<void> {
    // Check if product already exists in QuickBooks
    const existingMapping = await this.getQuickBooksMapping(product.id, tenantId);

    // Always sync product as single item for now
    // TODO: Implement variant support when ProductVariant entity is available
    const quickBooksItem = this.mapProductToQuickBooksItem(product, null, options);
    
    if (existingMapping?.externalId) {
      // Update existing item
      quickBooksItem.Id = existingMapping.externalId;
      const response = await this.quickBooksApiService.updateItem(
        credentials,
        quickBooksItem,
        tenantId,
        channelId,
      );

      if (!response.success) {
        throw new Error(`Failed to update QuickBooks item: ${response.error?.message}`);
      }
    } else {
      // Create new item
      const response = await this.quickBooksApiService.createItem(
        credentials,
        quickBooksItem,
        tenantId,
        channelId,
      );

      if (!response.success) {
        throw new Error(`Failed to create QuickBooks item: ${response.error?.message}`);
      }

      // Save mapping
      await this.saveQuickBooksMapping(
        product.id,
        response.data?.Item?.Id!,
        tenantId,
        channelId,
      );
    }
  }

  /**
   * Sync a product variant to QuickBooks
   * TODO: Implement when ProductVariant entity is available
   */
  private async syncVariantToQuickBooks(
    product: Product,
    variant: any, // Using any until ProductVariant entity is implemented
    credentials: QuickBooksCredentials,
    tenantId: string,
    channelId: string,
    options: ItemSyncOptions,
  ): Promise<void> {
    // Placeholder implementation
    throw new Error('Variant sync not yet implemented');
  }

  /**
   * Map StokCerdas product to QuickBooks item
   */
  private mapProductToQuickBooksItem(
    product: Product,
    variant: any | null, // Using any until ProductVariant entity is implemented
    options: ItemSyncOptions,
  ): QuickBooksItem {
    const item: QuickBooksItem = {
      Name: variant ? `${product.name} - ${variant.name}` : product.name,
      Description: product.description || undefined,
      Type: 'NonInventory', // Default to NonInventory for now
      Active: product.status === 'active',
      Sku: product.sku || undefined,
      TrackQtyOnHand: false,
    };

    // Set price
    if (options.syncPrices) {
      item.UnitPrice = product.sellingPrice || 0;
    }

    // Set quantity for inventory items - commented out for now
    // if (options.syncInventoryQuantities && product.type === 'inventory') {
    //   item.QtyOnHand = 0; // TODO: Calculate from inventory items
    // }

    // Set accounts if provided
    if (options.defaultIncomeAccountId) {
      item.IncomeAccountRef = { value: options.defaultIncomeAccountId };
    }
    if (options.defaultExpenseAccountId) {
      item.ExpenseAccountRef = { value: options.defaultExpenseAccountId };
    }
    if (options.defaultAssetAccountId) {
      item.AssetAccountRef = { value: options.defaultAssetAccountId };
    }

    // Set tax information
    item.Taxable = true; // Default to taxable for Indonesian context

    return item;
  }

  /**
   * Sync QuickBooks item to StokCerdas
   */
  private async syncItemFromQuickBooks(
    qbItem: QuickBooksItem,
    tenantId: string,
    options: ItemSyncOptions,
  ): Promise<void> {
    // Check if item already exists
    const existingProduct = await this.findProductByQuickBooksId(qbItem.Id!, tenantId);

    if (existingProduct) {
      // Update existing product
      await this.updateProductFromQuickBooksItem(existingProduct, qbItem, options);
    } else {
      // Create new product
      await this.createProductFromQuickBooksItem(qbItem, tenantId, options);
    }
  }

  /**
   * Create StokCerdas product from QuickBooks item
   */
  private async createProductFromQuickBooksItem(
    qbItem: QuickBooksItem,
    tenantId: string,
    options: ItemSyncOptions,
  ): Promise<Product> {
    const product = this.productRepository.create({
      tenantId,
      name: qbItem.Name,
      description: qbItem.Description,
      sku: qbItem.Sku || `QB_${qbItem.Id}`,
      type: ProductType.SIMPLE,
      status: qbItem.Active ? ProductStatus.ACTIVE : ProductStatus.INACTIVE,
      sellingPrice: options.syncPrices ? qbItem.UnitPrice || 0 : 0,
      costPrice: 0,
      unit: 'pcs',
      minStock: 0,
      maxStock: 0,
      reorderPoint: 0,
      reorderQuantity: 1,
      trackStock: true,
      allowBackorder: false,
      isTaxable: true,
      viewCount: 0,
      salesCount: 0,
      totalRevenue: 0,
      createdBy: 'quickbooks_sync',
      updatedBy: 'quickbooks_sync',
    });

    const savedProduct = await this.productRepository.save(product);

    // Save mapping
    await this.saveQuickBooksMapping(savedProduct.id, qbItem.Id!, tenantId, 'quickbooks');

    return savedProduct;
  }

  /**
   * Update StokCerdas product from QuickBooks item
   */
  private async updateProductFromQuickBooksItem(
    product: Product,
    qbItem: QuickBooksItem,
    options: ItemSyncOptions,
  ): Promise<void> {
    // Update product fields
    product.name = qbItem.Name;
    if (qbItem.Description) {
      product.description = qbItem.Description;
    }
    if (qbItem.Sku) {
      product.sku = qbItem.Sku;
    }
    product.status = qbItem.Active ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;

    if (options.syncPrices && qbItem.UnitPrice !== undefined) {
      product.sellingPrice = qbItem.UnitPrice;
    }

    // TODO: Implement inventory quantity sync with proper inventory management
    // if (options.syncInventoryQuantities && qbItem.QtyOnHand !== undefined) {
    //   // Would need to update inventory items, not just product
    // }

    product.updatedBy = 'quickbooks_sync';
    product.updatedAt = new Date();

    await this.productRepository.save(product);
  }

  // Helper methods for mapping management
  private async getQuickBooksMapping(entityId: string, tenantId: string): Promise<SyncStatus | null> {
    return this.syncStatusRepository.findOne({
      where: {
        tenantId,
        entityId,
        entityType: SyncEntityType.PRODUCT,
      },
    });
  }

  private async saveQuickBooksMapping(
    entityId: string,
    externalId: string,
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    const syncStatus = this.syncStatusRepository.create({
      tenantId,
      channelId,
      entityType: SyncEntityType.PRODUCT,
      entityId,
      externalId,
      direction: SyncDirection.BIDIRECTIONAL,
      status: SyncStatusEnum.COMPLETED,
      totalRecords: 1,
      processedRecords: 1,
      successfulRecords: 1,
      failedRecords: 0,
    });

    await this.syncStatusRepository.save(syncStatus);
  }

  private async findProductByQuickBooksId(quickBooksId: string, tenantId: string): Promise<Product | null> {
    const syncStatus = await this.syncStatusRepository.findOne({
      where: {
        tenantId,
        externalId: quickBooksId,
        entityType: SyncEntityType.PRODUCT,
      },
    });

    if (!syncStatus) {
      return null;
    }

    return this.productRepository.findOne({
      where: {
        id: syncStatus.entityId,
        tenantId,
        isDeleted: false,
      },
    });
  }

  private async createSyncStatus(
    tenantId: string,
    channelId: string,
    totalRecords: number,
  ): Promise<SyncStatus> {
    const syncStatus = this.syncStatusRepository.create({
      tenantId,
      channelId,
      entityType: SyncEntityType.PRODUCT,
      direction: SyncDirection.OUTBOUND,
      status: SyncStatusEnum.IN_PROGRESS,
      totalRecords,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      startedAt: new Date(),
    });

    return this.syncStatusRepository.save(syncStatus);
  }

  private async updateSyncProgress(
    syncStatusId: string,
    successful: number,
    failed: number,
  ): Promise<void> {
    await this.syncStatusRepository.update(syncStatusId, {
      processedRecords: successful + failed,
      successfulRecords: successful,
      failedRecords: failed,
    });
  }

  private async completeSyncStatus(syncStatusId: string, result: SyncResult): Promise<void> {
    await this.syncStatusRepository.update(syncStatusId, {
      status: result.success ? SyncStatusEnum.COMPLETED : SyncStatusEnum.PARTIAL,
      completedAt: new Date(),
      processedRecords: result.syncedItems + result.failedItems,
      successfulRecords: result.syncedItems,
      failedRecords: result.failedItems,
      errorMessage: result.errors.length > 0 ? result.errors[0].error : undefined,
      errorDetails: result.errors.length > 0 ? { errors: result.errors } : undefined,
    });
  }
}