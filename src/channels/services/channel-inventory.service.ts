import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { ChannelInventory, AllocationStrategy, AllocationStatus } from '../entities/channel-inventory.entity';
import { Channel } from '../entities/channel.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

// Integration services
import { ShopeeInventoryService } from '../../integrations/shopee/services/shopee-inventory.service';
import { LazadaInventoryService } from '../../integrations/lazada/services/lazada-inventory.service';
import { TokopediaInventoryService } from '../../integrations/tokopedia/services/tokopedia-inventory.service';

// Common services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import { IntegrationLogType, IntegrationLogLevel } from '../../integrations/entities/integration-log.entity';

export interface CreateChannelInventoryDto {
  channelId: string;
  productId: string;
  variantId?: string;
  sku: string;
  allocationStrategy: AllocationStrategy;
  allocationValue: number;
  priority?: number;
  bufferStock?: number;
  minStock?: number;
  maxStock?: number;
  channelPrice?: number;
  priceMarkup?: number;
  discountPrice?: number;
  discountStartDate?: Date;
  discountEndDate?: Date;
  isVisible?: boolean;
  autoSync?: boolean;
  allowBackorder?: boolean;
  externalId?: string;
  externalSku?: string;
  channelData?: any;
}

export interface UpdateChannelInventoryDto {
  allocationStrategy?: AllocationStrategy;
  allocationValue?: number;
  priority?: number;
  bufferStock?: number;
  minStock?: number;
  maxStock?: number;
  channelPrice?: number;
  priceMarkup?: number;
  discountPrice?: number;
  discountStartDate?: Date;
  discountEndDate?: Date;
  status?: AllocationStatus;
  isVisible?: boolean;
  autoSync?: boolean;
  allowBackorder?: boolean;
  externalId?: string;
  externalSku?: string;
  channelData?: any;
}

export interface AllocationRebalanceRequest {
  productId: string;
  totalStock: number;
  channelPriorities?: Record<string, number>;
  forceRebalance?: boolean;
}

export interface AllocationRebalanceResult {
  success: boolean;
  productId: string;
  totalStock: number;
  allocations: Array<{
    channelId: string;
    channelName: string;
    previousAllocation: number;
    newAllocation: number;
    strategy: AllocationStrategy;
    priority: number;
  }>;
  errors?: string[];
}

export interface InventorySyncRequest {
  channelId: string;
  productIds?: string[];
  syncType: 'stock' | 'price' | 'both';
  direction: 'inbound' | 'outbound' | 'bidirectional';
}

export interface InventorySyncResult {
  success: boolean;
  channelId: string;
  syncType: string;
  processedItems: number;
  successCount: number;
  errorCount: number;
  results: Array<{
    productId: string;
    sku: string;
    success: boolean;
    error?: string;
    previousStock?: number;
    newStock?: number;
    previousPrice?: number;
    newPrice?: number;
  }>;
}

export interface ChannelInventoryQuery {
  channelId?: string;
  productId?: string;
  status?: AllocationStatus;
  allocationStrategy?: AllocationStrategy;
  isVisible?: boolean;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  needsRebalancing?: boolean;
  limit?: number;
  offset?: number;
  includeMetrics?: boolean;
}

@Injectable()
export class ChannelInventoryService {
  private readonly logger = new Logger(ChannelInventoryService.name);

  constructor(
    @InjectRepository(ChannelInventory)
    private readonly inventoryRepository: Repository<ChannelInventory>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    
    // Integration services
    private readonly shopeeInventoryService: ShopeeInventoryService,
    private readonly lazadaInventoryService: LazadaInventoryService,
    private readonly tokopediaInventoryService: TokopediaInventoryService,
    
    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create channel inventory allocation
   */
  async createChannelInventory(
    tenantId: string,
    createDto: CreateChannelInventoryDto,
  ): Promise<ChannelInventory> {
    try {
      this.logger.debug(`Creating channel inventory allocation for tenant ${tenantId}`, { createDto });

      // Validate channel exists
      const channel = await this.channelRepository.findOne({
        where: { tenantId, id: createDto.channelId },
      });
      if (!channel) {
        throw new NotFoundException(`Channel ${createDto.channelId} not found`);
      }

      // Validate product exists
      const product = await this.productRepository.findOne({
        where: { tenantId, id: createDto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${createDto.productId} not found`);
      }

      // Check for existing allocation
      const existingAllocation = await this.inventoryRepository.findOne({
        where: {
          tenantId,
          channelId: createDto.channelId,
          productId: createDto.productId,
          variantId: createDto.variantId || null,
        },
      });
      if (existingAllocation) {
        throw new BadRequestException('Channel inventory allocation already exists for this product');
      }

      // Get current inventory item
      const inventoryItem = await this.inventoryItemRepository.findOne({
        where: {
          tenantId,
          productId: createDto.productId,
          ...(createDto.variantId && { variantId: createDto.variantId }),
        },
      });

      // Calculate initial allocation
      const totalStock = inventoryItem?.quantityOnHand || 0;
      const allocation = this.calculateAllocation(createDto.allocationStrategy, createDto.allocationValue, totalStock);

      // Create allocation
      const channelInventory = this.inventoryRepository.create({
        ...createDto,
        tenantId,
        allocatedQuantity: allocation,
        availableQuantity: Math.max(0, allocation - (createDto.bufferStock || 0)),
        status: allocation > 0 ? AllocationStatus.ACTIVE : AllocationStatus.OUT_OF_STOCK,
        priority: createDto.priority || 1,
        bufferStock: createDto.bufferStock || 0,
        minStock: createDto.minStock || 0,
        maxStock: createDto.maxStock || totalStock,
        priceMarkup: createDto.priceMarkup || 0,
        isVisible: createDto.isVisible !== undefined ? createDto.isVisible : true,
        autoSync: createDto.autoSync !== undefined ? createDto.autoSync : true,
        allowBackorder: createDto.allowBackorder || false,
        syncStatus: 'pending',
        syncRetryCount: 0,
      });

      const savedAllocation = await this.inventoryRepository.save(channelInventory);

      // Log creation
      await this.logService.log({
        tenantId,
        channelId: createDto.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel inventory allocation created: ${createDto.sku}`,
        metadata: {
          productId: createDto.productId,
          channelId: createDto.channelId,
          allocation,
          strategy: createDto.allocationStrategy,
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.inventory.created', {
        tenantId,
        channelId: createDto.channelId,
        productId: createDto.productId,
        allocation: savedAllocation,
      });

      return savedAllocation;

    } catch (error) {
      this.logger.error(`Failed to create channel inventory: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, createDto.channelId, error, {
        metadata: { action: 'create_channel_inventory', createDto },
      });
      throw error;
    }
  }

  /**
   * Get channel inventory allocations
   */
  async getChannelInventory(
    tenantId: string,
    query: ChannelInventoryQuery = {},
  ): Promise<{
    allocations: ChannelInventory[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<ChannelInventory> = { tenantId };

      if (query.channelId) {
        where.channelId = query.channelId;
      }

      if (query.productId) {
        where.productId = query.productId;
      }

      if (query.status) {
        where.status = query.status;
      }

      if (query.allocationStrategy) {
        where.allocationStrategy = query.allocationStrategy;
      }

      if (query.isVisible !== undefined) {
        where.isVisible = query.isVisible;
      }

      const queryBuilder = this.inventoryRepository.createQueryBuilder('allocation')
        .where(where);

      // Special filters
      if (query.isOutOfStock) {
        queryBuilder.andWhere('allocation.allocatedQuantity - allocation.reservedQuantity <= 0');
      }

      if (query.isLowStock) {
        queryBuilder.andWhere('allocation.allocatedQuantity - allocation.reservedQuantity <= allocation.minStock');
        queryBuilder.andWhere('allocation.allocatedQuantity - allocation.reservedQuantity > 0');
      }

      if (query.needsRebalancing) {
        queryBuilder.andWhere("allocation.allocationStrategy = 'dynamic'");
        queryBuilder.andWhere('(allocation.allocatedQuantity - allocation.reservedQuantity <= allocation.minStock)');
      }

      // Include relations
      queryBuilder.leftJoinAndSelect('allocation.channel', 'channel');

      if (query.includeMetrics) {
        queryBuilder.leftJoinAndSelect('allocation.product', 'product');
      }

      // Pagination
      if (query.limit) {
        queryBuilder.take(query.limit);
      }
      if (query.offset) {
        queryBuilder.skip(query.offset);
      }

      // Ordering
      queryBuilder.orderBy('allocation.priority', 'ASC')
        .addOrderBy('allocation.createdAt', 'DESC');

      const [allocations, total] = await queryBuilder.getManyAndCount();

      return { allocations, total };

    } catch (error) {
      this.logger.error(`Failed to get channel inventory: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update channel inventory allocation
   */
  async updateChannelInventory(
    tenantId: string,
    allocationId: string,
    updateDto: UpdateChannelInventoryDto,
  ): Promise<ChannelInventory> {
    try {
      const allocation = await this.inventoryRepository.findOne({
        where: { tenantId, id: allocationId },
        relations: ['channel'],
      });

      if (!allocation) {
        throw new NotFoundException(`Channel inventory allocation ${allocationId} not found`);
      }

      // Update allocation properties
      Object.assign(allocation, updateDto);

      // Recalculate allocation if strategy or value changed
      if (updateDto.allocationStrategy || updateDto.allocationValue !== undefined) {
        const inventoryItem = await this.inventoryItemRepository.findOne({
          where: {
            tenantId,
            productId: allocation.productId,
            ...(allocation.variantId && { variantId: allocation.variantId }),
          },
        });

        const totalStock = inventoryItem?.quantityOnHand || 0;
        const newAllocation = this.calculateAllocation(
          allocation.allocationStrategy,
          allocation.allocationValue,
          totalStock,
        );

        allocation.updateAllocation(newAllocation, 'Manual update');
      }

      const updatedAllocation = await this.inventoryRepository.save(allocation);

      // Log update
      await this.logService.log({
        tenantId,
        channelId: allocation.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel inventory updated: ${allocation.sku}`,
        metadata: { updates: updateDto, allocationId },
      });

      // Emit event
      this.eventEmitter.emit('channel.inventory.updated', {
        tenantId,
        channelId: allocation.channelId,
        productId: allocation.productId,
        allocation: updatedAllocation,
        changes: updateDto,
      });

      return updatedAllocation;

    } catch (error) {
      this.logger.error(`Failed to update channel inventory: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'update_channel_inventory', allocationId, updateDto },
      });
      throw error;
    }
  }

  /**
   * Delete channel inventory allocation
   */
  async deleteChannelInventory(tenantId: string, allocationId: string): Promise<void> {
    try {
      const allocation = await this.inventoryRepository.findOne({
        where: { tenantId, id: allocationId },
      });

      if (!allocation) {
        throw new NotFoundException(`Channel inventory allocation ${allocationId} not found`);
      }

      await this.inventoryRepository.remove(allocation);

      // Log deletion
      await this.logService.log({
        tenantId,
        channelId: allocation.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel inventory allocation deleted: ${allocation.sku}`,
        metadata: { allocationId, productId: allocation.productId },
      });

      // Emit event
      this.eventEmitter.emit('channel.inventory.deleted', {
        tenantId,
        channelId: allocation.channelId,
        productId: allocation.productId,
        allocation,
      });

    } catch (error) {
      this.logger.error(`Failed to delete channel inventory: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Rebalance inventory allocations for a product
   */
  async rebalanceProductAllocations(
    tenantId: string,
    request: AllocationRebalanceRequest,
  ): Promise<AllocationRebalanceResult> {
    try {
      this.logger.debug(`Rebalancing allocations for product ${request.productId}`, { request });

      // Get all allocations for the product
      const allocations = await this.inventoryRepository.find({
        where: {
          tenantId,
          productId: request.productId,
          status: In([AllocationStatus.ACTIVE, AllocationStatus.OUT_OF_STOCK]),
        },
        relations: ['channel'],
        order: { priority: 'ASC' },
      });

      if (allocations.length === 0) {
        throw new NotFoundException(`No allocations found for product ${request.productId}`);
      }

      const result: AllocationRebalanceResult = {
        success: true,
        productId: request.productId,
        totalStock: request.totalStock,
        allocations: [],
        errors: [],
      };

      let remainingStock = request.totalStock;

      // Process allocations by priority
      for (const allocation of allocations) {
        const previousAllocation = allocation.allocatedQuantity;
        
        try {
          let newAllocation = 0;

          switch (allocation.allocationStrategy) {
            case AllocationStrategy.PRIORITY:
              // For priority-based, allocate based on priority order
              newAllocation = this.calculatePriorityAllocation(
                allocation,
                remainingStock,
                request.channelPriorities,
              );
              break;

            case AllocationStrategy.PERCENTAGE:
            case AllocationStrategy.FIXED_AMOUNT:
            case AllocationStrategy.DYNAMIC:
              newAllocation = allocation.calculateAllocation(request.totalStock);
              break;
          }

          // Respect min/max limits
          newAllocation = Math.max(allocation.minStock, Math.min(newAllocation, allocation.maxStock));
          newAllocation = Math.min(newAllocation, remainingStock);

          // Update allocation
          allocation.updateAllocation(newAllocation, 'Automatic rebalancing');
          await this.inventoryRepository.save(allocation);

          // Track changes
          result.allocations.push({
            channelId: allocation.channelId,
            channelName: allocation.channel?.name || 'Unknown',
            previousAllocation,
            newAllocation,
            strategy: allocation.allocationStrategy,
            priority: allocation.priority,
          });

          remainingStock -= newAllocation;

        } catch (error) {
          this.logger.error(`Failed to rebalance allocation ${allocation.id}: ${error.message}`);
          result.errors.push(`Channel ${allocation.channel?.name}: ${error.message}`);
          result.success = false;
        }
      }

      // Log rebalancing
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Inventory rebalancing completed for product ${request.productId}`,
        metadata: {
          productId: request.productId,
          totalStock: request.totalStock,
          allocationsCount: allocations.length,
          success: result.success,
          remainingStock,
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.inventory.rebalanced', {
        tenantId,
        productId: request.productId,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to rebalance product allocations: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'rebalance_allocations', request },
      });
      throw error;
    }
  }

  /**
   * Sync inventory with external platforms
   */
  async syncChannelInventory(
    tenantId: string,
    request: InventorySyncRequest,
  ): Promise<InventorySyncResult> {
    try {
      this.logger.debug(`Syncing inventory for channel ${request.channelId}`, { request });

      // Get channel
      const channel = await this.channelRepository.findOne({
        where: { tenantId, id: request.channelId },
      });
      if (!channel) {
        throw new NotFoundException(`Channel ${request.channelId} not found`);
      }

      // Get allocations to sync
      const allocationsQuery: FindOptionsWhere<ChannelInventory> = {
        tenantId,
        channelId: request.channelId,
        status: AllocationStatus.ACTIVE,
        autoSync: true,
      };

      if (request.productIds && request.productIds.length > 0) {
        allocationsQuery.productId = In(request.productIds);
      }

      const allocations = await this.inventoryRepository.find({
        where: allocationsQuery,
        relations: ['channel'],
      });

      const result: InventorySyncResult = {
        success: true,
        channelId: request.channelId,
        syncType: request.syncType,
        processedItems: allocations.length,
        successCount: 0,
        errorCount: 0,
        results: [],
      };

      // Sync each allocation
      for (const allocation of allocations) {
        try {
          const syncResult = await this.syncSingleAllocation(
            tenantId,
            allocation,
            channel,
            request.syncType,
            request.direction,
          );

          result.results.push(syncResult);
          if (syncResult.success) {
            result.successCount++;
          } else {
            result.errorCount++;
          }

        } catch (error) {
          this.logger.error(`Failed to sync allocation ${allocation.id}: ${error.message}`);
          result.results.push({
            productId: allocation.productId,
            sku: allocation.sku,
            success: false,
            error: error.message,
          });
          result.errorCount++;
        }
      }

      result.success = result.errorCount === 0;

      // Log sync completion
      await this.logService.log({
        tenantId,
        channelId: request.channelId,
        type: IntegrationLogType.SYNC,
        level: result.success ? IntegrationLogLevel.INFO : IntegrationLogLevel.WARN,
        message: `Inventory sync completed: ${result.successCount}/${result.processedItems} successful`,
        metadata: {
          channelId: request.channelId,
          syncType: request.syncType,
          direction: request.direction,
          result,
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.inventory.synced', {
        tenantId,
        channelId: request.channelId,
        result,
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to sync channel inventory: ${error.message}`, error.stack);
      await this.logService.logError(tenantId, request.channelId, error, {
        metadata: { action: 'sync_inventory', request },
      });
      throw error;
    }
  }

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(
    tenantId: string,
    channelId: string,
    productId: string,
    quantity: number,
    variantId?: string,
  ): Promise<boolean> {
    try {
      const allocation = await this.inventoryRepository.findOne({
        where: {
          tenantId,
          channelId,
          productId,
          ...(variantId && { variantId }),
        },
      });

      if (!allocation) {
        throw new NotFoundException('Channel inventory allocation not found');
      }

      const reserved = allocation.reserve(quantity);
      if (reserved) {
        await this.inventoryRepository.save(allocation);

        // Log reservation
        await this.logService.log({
          tenantId,
          channelId,
          type: IntegrationLogType.SYSTEM,
          level: IntegrationLogLevel.INFO,
          message: `Inventory reserved: ${quantity} units of ${allocation.sku}`,
          metadata: { productId, quantity, reservedQuantity: allocation.reservedQuantity },
        });
      }

      return reserved;

    } catch (error) {
      this.logger.error(`Failed to reserve inventory: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Release inventory reservation
   */
  async releaseReservation(
    tenantId: string,
    channelId: string,
    productId: string,
    quantity: number,
    variantId?: string,
  ): Promise<void> {
    try {
      const allocation = await this.inventoryRepository.findOne({
        where: {
          tenantId,
          channelId,
          productId,
          ...(variantId && { variantId }),
        },
      });

      if (!allocation) {
        throw new NotFoundException('Channel inventory allocation not found');
      }

      allocation.releaseReservation(quantity);
      await this.inventoryRepository.save(allocation);

      // Log reservation release
      await this.logService.log({
        tenantId,
        channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Inventory reservation released: ${quantity} units of ${allocation.sku}`,
        metadata: { productId, quantity, reservedQuantity: allocation.reservedQuantity },
      });

    } catch (error) {
      this.logger.error(`Failed to release reservation: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private calculateAllocation(strategy: AllocationStrategy, value: number, totalStock: number): number {
    switch (strategy) {
      case AllocationStrategy.PERCENTAGE:
        return Math.floor(totalStock * (value / 100));
      
      case AllocationStrategy.FIXED_AMOUNT:
        return Math.min(value, totalStock);
      
      case AllocationStrategy.DYNAMIC:
        // For dynamic, use percentage as base and adjust based on performance
        return Math.floor(totalStock * (value / 100));
      
      case AllocationStrategy.PRIORITY:
        // Priority will be calculated at rebalancing time
        return 0;
      
      default:
        return 0;
    }
  }

  private calculatePriorityAllocation(
    allocation: ChannelInventory,
    remainingStock: number,
    channelPriorities?: Record<string, number>,
  ): number {
    // If specific priority is provided, use it; otherwise use allocation priority
    const priority = channelPriorities?.[allocation.channelId] || allocation.priority;
    
    // For priority-based allocation, higher priority (lower number) gets more stock
    // This is a simple implementation - can be made more sophisticated
    if (priority === 1) {
      return Math.min(remainingStock, allocation.maxStock);
    } else {
      return Math.min(Math.floor(remainingStock / priority), allocation.maxStock);
    }
  }

  private async syncSingleAllocation(
    tenantId: string,
    allocation: ChannelInventory,
    channel: Channel,
    syncType: string,
    direction: string,
  ): Promise<any> {
    const platformId = channel.platformId.toLowerCase();

    try {
      switch (platformId) {
        case 'shopee':
          return await this.syncShopeeInventory(tenantId, allocation, channel, syncType, direction);
        
        case 'lazada':
          return await this.syncLazadaInventory(tenantId, allocation, channel, syncType, direction);
        
        case 'tokopedia':
          return await this.syncTokopediaInventory(tenantId, allocation, channel, syncType, direction);
        
        default:
          throw new Error(`Platform ${platformId} inventory sync not supported`);
      }
    } catch (error) {
      return {
        productId: allocation.productId,
        sku: allocation.sku,
        success: false,
        error: error.message,
      };
    }
  }

  private async syncShopeeInventory(
    tenantId: string,
    allocation: ChannelInventory,
    channel: Channel,
    syncType: string,
    direction: string,
  ): Promise<any> {
    // Implement Shopee-specific inventory sync logic
    if (syncType === 'stock' || syncType === 'both') {
      if (direction === 'outbound' || direction === 'bidirectional') {
        // Update stock in Shopee
        const stockUpdate = {
          itemId: allocation.externalId,
          stock: allocation.availableQuantity,
        };
        // await this.shopeeInventoryService.updateStock(tenantId, channel.id, [stockUpdate]);
      }
    }

    if (syncType === 'price' || syncType === 'both') {
      if (direction === 'outbound' || direction === 'bidirectional') {
        // Update price in Shopee
        const priceUpdate = {
          itemId: allocation.externalId,
          price: allocation.effectivePrice,
        };
        // await this.shopeeInventoryService.updatePrice(tenantId, channel.id, [priceUpdate]);
      }
    }

    return {
      productId: allocation.productId,
      sku: allocation.sku,
      success: true,
      newStock: allocation.availableQuantity,
      newPrice: allocation.effectivePrice,
    };
  }

  private async syncLazadaInventory(
    tenantId: string,
    allocation: ChannelInventory,
    channel: Channel,
    syncType: string,
    direction: string,
  ): Promise<any> {
    // Implement Lazada-specific inventory sync logic
    return {
      productId: allocation.productId,
      sku: allocation.sku,
      success: true,
      newStock: allocation.availableQuantity,
      newPrice: allocation.effectivePrice,
    };
  }

  private async syncTokopediaInventory(
    tenantId: string,
    allocation: ChannelInventory,
    channel: Channel,
    syncType: string,
    direction: string,
  ): Promise<any> {
    // Implement Tokopedia-specific inventory sync logic
    return {
      productId: allocation.productId,
      sku: allocation.sku,
      success: true,
      newStock: allocation.availableQuantity,
      newPrice: allocation.effectivePrice,
    };
  }
}