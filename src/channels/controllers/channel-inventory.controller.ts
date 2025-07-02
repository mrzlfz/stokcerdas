import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsDateString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// Entities and Enums
import { AllocationStrategy, AllocationStatus } from '../entities/channel-inventory.entity';

// Services
import { ChannelInventoryService } from '../services/channel-inventory.service';

// DTOs
export class CreateChannelInventoryDto {
  @IsUUID()
  channelId: string;

  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsString()
  sku: string;

  @IsEnum(AllocationStrategy)
  allocationStrategy: AllocationStrategy;

  @IsNumber()
  @Min(0)
  allocationValue: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bufferStock?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  channelPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priceMarkup?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsOptional()
  @IsDateString()
  discountStartDate?: string;

  @IsOptional()
  @IsDateString()
  discountEndDate?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean = true;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean = true;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean = false;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  externalSku?: string;

  @IsOptional()
  @IsObject()
  channelData?: any;
}

export class UpdateChannelInventoryDto {
  @IsOptional()
  @IsEnum(AllocationStrategy)
  allocationStrategy?: AllocationStrategy;

  @IsOptional()
  @IsNumber()
  @Min(0)
  allocationValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bufferStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  channelPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priceMarkup?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsOptional()
  @IsDateString()
  discountStartDate?: string;

  @IsOptional()
  @IsDateString()
  discountEndDate?: string;

  @IsOptional()
  @IsEnum(AllocationStatus)
  status?: AllocationStatus;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  externalSku?: string;

  @IsOptional()
  @IsObject()
  channelData?: any;
}

export class AllocationRebalanceDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  totalStock: number;

  @IsOptional()
  @IsObject()
  channelPriorities?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  forceRebalance?: boolean = false;
}

export class InventorySyncDto {
  @IsUUID()
  channelId: string;

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  productIds?: string[];

  @IsEnum(['stock', 'price', 'both'])
  syncType: 'stock' | 'price' | 'both';

  @IsEnum(['inbound', 'outbound', 'bidirectional'])
  direction: 'inbound' | 'outbound' | 'bidirectional';
}

export class ReserveInventoryDto {
  @IsUUID()
  channelId: string;

  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsUUID()
  variantId?: string;
}

export class ChannelInventoryQueryDto {
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(AllocationStatus)
  status?: AllocationStatus;

  @IsOptional()
  @IsEnum(AllocationStrategy)
  allocationStrategy?: AllocationStrategy;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isOutOfStock?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isLowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  needsRebalancing?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeMetrics?: boolean = false;
}

@ApiTags('Channel Inventory Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('channels/inventory')
export class ChannelInventoryController {
  private readonly logger = new Logger(ChannelInventoryController.name);

  constructor(
    private readonly inventoryService: ChannelInventoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get channel inventory allocations' })
  @ApiResponse({ status: 200, description: 'Allocations retrieved successfully' })
  @ApiQuery({ name: 'channelId', type: 'string', required: false })
  @ApiQuery({ name: 'productId', type: 'string', required: false })
  @ApiQuery({ name: 'status', enum: AllocationStatus, required: false })
  @ApiQuery({ name: 'allocationStrategy', enum: AllocationStrategy, required: false })
  @ApiQuery({ name: 'isVisible', type: 'boolean', required: false })
  @ApiQuery({ name: 'isOutOfStock', type: 'boolean', required: false })
  @ApiQuery({ name: 'isLowStock', type: 'boolean', required: false })
  @ApiQuery({ name: 'needsRebalancing', type: 'boolean', required: false })
  @ApiQuery({ name: 'limit', type: 'number', required: false })
  @ApiQuery({ name: 'offset', type: 'number', required: false })
  @ApiQuery({ name: 'includeMetrics', type: 'boolean', required: false })
  @Roles('admin', 'manager', 'staff')
  async getChannelInventory(
    @CurrentUser() user: any,
    @Query() query: ChannelInventoryQueryDto,
  ) {
    try {
      const result = await this.inventoryService.getChannelInventory(user.tenantId, query);
      
      return {
        success: true,
        data: result.allocations,
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get channel inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create channel inventory allocation' })
  @ApiResponse({ status: 201, description: 'Allocation created successfully' })
  @Roles('admin', 'manager')
  async createChannelInventory(
    @CurrentUser() user: any,
    @Body() createDto: CreateChannelInventoryDto,
  ) {
    try {
      const allocation = await this.inventoryService.createChannelInventory(
        user.tenantId,
        createDto,
      );
      
      return {
        success: true,
        data: allocation,
      };
    } catch (error) {
      this.logger.error(`Failed to create channel inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':allocationId')
  @ApiOperation({ summary: 'Update channel inventory allocation' })
  @ApiResponse({ status: 200, description: 'Allocation updated successfully' })
  @ApiParam({ name: 'allocationId', type: 'string' })
  @Roles('admin', 'manager')
  async updateChannelInventory(
    @CurrentUser() user: any,
    @Param('allocationId') allocationId: string,
    @Body() updateDto: UpdateChannelInventoryDto,
  ) {
    try {
      const allocation = await this.inventoryService.updateChannelInventory(
        user.tenantId,
        allocationId,
        updateDto,
      );
      
      return {
        success: true,
        data: allocation,
      };
    } catch (error) {
      this.logger.error(`Failed to update channel inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':allocationId')
  @ApiOperation({ summary: 'Delete channel inventory allocation' })
  @ApiResponse({ status: 200, description: 'Allocation deleted successfully' })
  @ApiParam({ name: 'allocationId', type: 'string' })
  @Roles('admin', 'manager')
  async deleteChannelInventory(
    @CurrentUser() user: any,
    @Param('allocationId') allocationId: string,
  ) {
    try {
      await this.inventoryService.deleteChannelInventory(user.tenantId, allocationId);
      
      return {
        success: true,
        message: 'Allocation deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete channel inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rebalance')
  @ApiOperation({ summary: 'Rebalance inventory allocations' })
  @ApiResponse({ status: 200, description: 'Rebalancing completed successfully' })
  @Roles('admin', 'manager')
  async rebalanceAllocations(
    @CurrentUser() user: any,
    @Body() rebalanceDto: AllocationRebalanceDto,
  ) {
    try {
      const result = await this.inventoryService.rebalanceProductAllocations(
        user.tenantId,
        rebalanceDto,
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to rebalance allocations: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync channel inventory' })
  @ApiResponse({ status: 200, description: 'Inventory sync completed successfully' })
  @Roles('admin', 'manager')
  async syncInventory(
    @CurrentUser() user: any,
    @Body() syncDto: InventorySyncDto,
  ) {
    try {
      const result = await this.inventoryService.syncChannelInventory(
        user.tenantId,
        syncDto,
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to sync inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reserve')
  @ApiOperation({ summary: 'Reserve inventory for order' })
  @ApiResponse({ status: 200, description: 'Inventory reserved successfully' })
  @Roles('admin', 'manager', 'staff')
  async reserveInventory(
    @CurrentUser() user: any,
    @Body() reserveDto: ReserveInventoryDto,
  ) {
    try {
      const success = await this.inventoryService.reserveInventory(
        user.tenantId,
        reserveDto.channelId,
        reserveDto.productId,
        reserveDto.quantity,
        reserveDto.variantId,
      );
      
      return {
        success,
        message: success ? 'Inventory reserved successfully' : 'Insufficient inventory',
      };
    } catch (error) {
      this.logger.error(`Failed to reserve inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('release')
  @ApiOperation({ summary: 'Release inventory reservation' })
  @ApiResponse({ status: 200, description: 'Reservation released successfully' })
  @Roles('admin', 'manager', 'staff')
  async releaseReservation(
    @CurrentUser() user: any,
    @Body() releaseDto: ReserveInventoryDto,
  ) {
    try {
      await this.inventoryService.releaseReservation(
        user.tenantId,
        releaseDto.channelId,
        releaseDto.productId,
        releaseDto.quantity,
        releaseDto.variantId,
      );
      
      return {
        success: true,
        message: 'Reservation released successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to release reservation: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/allocation-summary')
  @ApiOperation({ summary: 'Get allocation analytics summary' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiQuery({ name: 'channelId', type: 'string', required: false })
  @ApiQuery({ name: 'productId', type: 'string', required: false })
  @Roles('admin', 'manager', 'staff')
  async getAllocationSummary(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('productId') productId?: string,
  ) {
    try {
      const { allocations } = await this.inventoryService.getChannelInventory(
        user.tenantId,
        {
          channelId,
          productId,
          includeMetrics: true,
        },
      );

      // Calculate summary analytics
      const summary = {
        totalAllocations: allocations.length,
        totalAllocatedStock: allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0),
        totalAvailableStock: allocations.reduce((sum, alloc) => sum + alloc.availableQuantity, 0),
        totalReservedStock: allocations.reduce((sum, alloc) => sum + alloc.reservedQuantity, 0),
        outOfStockCount: allocations.filter(alloc => alloc.isOutOfStock).length,
        lowStockCount: allocations.filter(alloc => alloc.isLowStock).length,
        needsRebalancingCount: allocations.filter(alloc => alloc.needsRebalancing).length,
        byStrategy: {
          percentage: allocations.filter(a => a.allocationStrategy === AllocationStrategy.PERCENTAGE).length,
          fixed: allocations.filter(a => a.allocationStrategy === AllocationStrategy.FIXED_AMOUNT).length,
          dynamic: allocations.filter(a => a.allocationStrategy === AllocationStrategy.DYNAMIC).length,
          priority: allocations.filter(a => a.allocationStrategy === AllocationStrategy.PRIORITY).length,
        },
        byStatus: {
          active: allocations.filter(a => a.status === AllocationStatus.ACTIVE).length,
          paused: allocations.filter(a => a.status === AllocationStatus.PAUSED).length,
          outOfStock: allocations.filter(a => a.status === AllocationStatus.OUT_OF_STOCK).length,
          discontinued: allocations.filter(a => a.status === AllocationStatus.DISCONTINUED).length,
        },
      };
      
      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error(`Failed to get allocation summary: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get channel inventory performance analytics' })
  @ApiResponse({ status: 200, description: 'Performance analytics retrieved successfully' })
  @ApiQuery({ name: 'channelId', type: 'string', required: false })
  @ApiQuery({ name: 'days', type: 'number', required: false })
  @Roles('admin', 'manager', 'staff')
  async getPerformanceAnalytics(
    @CurrentUser() user: any,
    @Query('channelId') channelId?: string,
    @Query('days') days?: number,
  ) {
    try {
      const { allocations } = await this.inventoryService.getChannelInventory(
        user.tenantId,
        {
          channelId,
          includeMetrics: true,
        },
      );

      // Calculate performance metrics
      const analytics = {
        totalSales: allocations.reduce((sum, alloc) => sum + (alloc.metrics?.totalSales || 0), 0),
        totalRevenue: allocations.reduce((sum, alloc) => sum + (alloc.metrics?.totalRevenue || 0), 0),
        averageConversionRate: allocations.length > 0
          ? allocations.reduce((sum, alloc) => sum + (alloc.metrics?.conversionRate || 0), 0) / allocations.length
          : 0,
        topPerformingProducts: allocations
          .filter(alloc => alloc.metrics?.totalRevenue)
          .sort((a, b) => (b.metrics?.totalRevenue || 0) - (a.metrics?.totalRevenue || 0))
          .slice(0, 10)
          .map(alloc => ({
            productId: alloc.productId,
            sku: alloc.sku,
            totalSales: alloc.metrics?.totalSales || 0,
            totalRevenue: alloc.metrics?.totalRevenue || 0,
            conversionRate: alloc.metrics?.conversionRate || 0,
          })),
        lowPerformingProducts: allocations
          .filter(alloc => alloc.metrics?.stockTurnover !== undefined)
          .sort((a, b) => (a.metrics?.stockTurnover || 0) - (b.metrics?.stockTurnover || 0))
          .slice(0, 10)
          .map(alloc => ({
            productId: alloc.productId,
            sku: alloc.sku,
            stockTurnover: alloc.metrics?.stockTurnover || 0,
            outOfStockDays: alloc.metrics?.outOfStockDays || 0,
          })),
      };
      
      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance analytics: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}