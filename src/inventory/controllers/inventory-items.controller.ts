import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { InventoryItemsService } from '../services/inventory-items.service';
import { InventoryRealtimeService } from '../services/inventory-realtime.service';
import { CreateInventoryItemDto } from '../dto/create-inventory-item.dto';
import { InventoryQueryDto } from '../dto/inventory-query.dto';
import {
  StockAdjustmentDto,
  BulkStockAdjustmentDto,
} from '../dto/stock-adjustment.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import {
  PermissionAction,
  PermissionResource,
} from '../../auth/entities/permission.entity';

@ApiTags('Inventory Items')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/items')
export class InventoryItemsController {
  constructor(
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly realtimeService: InventoryRealtimeService,
  ) {}

  @Post()
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.CREATE,
  })
  @ApiOperation({ summary: 'Buat inventory item baru' })
  @ApiResponse({ status: 201, description: 'Inventory item berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({
    status: 409,
    description: 'Kombinasi produk-lokasi sudah ada',
  })
  async create(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createInventoryItemDto: CreateInventoryItemDto,
  ) {
    const inventoryItem = await this.inventoryItemsService.create(
      tenantId,
      createInventoryItemDto,
      userId,
    );

    return {
      success: true,
      message: 'Inventory item berhasil dibuat',
      data: inventoryItem,
    };
  }

  @Get()
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Dapatkan daftar inventory items dengan filter dan pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar inventory items berhasil didapat',
  })
  async findAll(@Tenant() tenantId: string, @Query() query: InventoryQueryDto) {
    const result = await this.inventoryItemsService.findAll(tenantId, query);

    return {
      success: true,
      message: 'Daftar inventory items berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('stats')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Dapatkan statistik inventory' })
  @ApiQuery({
    name: 'locationId',
    required: false,
    description: 'Filter untuk lokasi spesifik',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistik inventory berhasil didapat',
  })
  async getStats(
    @Tenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    const stats = await this.inventoryItemsService.getInventoryStats(
      tenantId,
      locationId,
    );

    return {
      success: true,
      message: 'Statistik inventory berhasil didapat',
      data: stats,
    };
  }

  @Get('realtime-levels')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Dapatkan level stok real-time untuk multiple items',
  })
  @ApiQuery({
    name: 'itemIds',
    required: true,
    description: 'Array ID inventory items (comma separated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Level stok real-time berhasil didapat',
  })
  async getRealtimeStockLevels(
    @Tenant() tenantId: string,
    @Query('itemIds') itemIds: string,
  ) {
    const itemIdArray = itemIds.split(',');
    const inventoryItems = await Promise.all(
      itemIdArray.map(id => this.inventoryItemsService.findOne(tenantId, id)),
    );

    const realtimeLevels = await this.realtimeService.getRealtimeStockLevels(
      inventoryItems,
    );

    return {
      success: true,
      message: 'Level stok real-time berhasil didapat',
      data: realtimeLevels,
    };
  }

  @Get('product/:productId/location/:locationId')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Dapatkan inventory item berdasarkan produk dan lokasi',
  })
  @ApiParam({ name: 'productId', description: 'ID produk' })
  @ApiParam({ name: 'locationId', description: 'ID lokasi' })
  @ApiResponse({ status: 200, description: 'Inventory item ditemukan' })
  @ApiResponse({ status: 404, description: 'Inventory item tidak ditemukan' })
  async findByProductAndLocation(
    @Tenant() tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    const inventoryItem =
      await this.inventoryItemsService.findByProductAndLocation(
        tenantId,
        productId,
        locationId,
      );

    if (!inventoryItem) {
      return {
        success: false,
        message: 'Inventory item tidak ditemukan',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Inventory item ditemukan',
      data: inventoryItem,
    };
  }

  @Get(':id')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Dapatkan detail inventory item' })
  @ApiParam({ name: 'id', description: 'ID inventory item' })
  @ApiResponse({
    status: 200,
    description: 'Detail inventory item berhasil didapat',
  })
  @ApiResponse({ status: 404, description: 'Inventory item tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const inventoryItem = await this.inventoryItemsService.findOne(
      tenantId,
      id,
    );

    return {
      success: true,
      message: 'Detail inventory item berhasil didapat',
      data: inventoryItem,
    };
  }

  @Get(':id/metrics')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Dapatkan metrics real-time untuk inventory item' })
  @ApiParam({ name: 'id', description: 'ID inventory item' })
  @ApiResponse({
    status: 200,
    description: 'Metrics inventory item berhasil didapat',
  })
  async getItemMetrics(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const inventoryItem = await this.inventoryItemsService.findOne(
      tenantId,
      id,
    );
    const metrics = await this.realtimeService.calculateInventoryMetrics(
      inventoryItem,
    );

    return {
      success: true,
      message: 'Metrics inventory item berhasil didapat',
      data: metrics,
    };
  }

  // Stock Adjustment Operations
  @Post('adjust')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Lakukan stock adjustment' })
  @ApiResponse({ status: 200, description: 'Stock adjustment berhasil' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({
    status: 404,
    description: 'Produk atau lokasi tidak ditemukan',
  })
  async adjustStock(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() adjustmentDto: StockAdjustmentDto,
  ) {
    const inventoryItem = await this.inventoryItemsService.adjustStock(
      tenantId,
      adjustmentDto,
      userId,
    );

    return {
      success: true,
      message: 'Stock adjustment berhasil dilakukan',
      data: inventoryItem,
    };
  }

  @Post('adjust/bulk')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Lakukan bulk stock adjustment' })
  @ApiResponse({ status: 200, description: 'Bulk stock adjustment selesai' })
  async bulkAdjustStock(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkAdjustmentDto: BulkStockAdjustmentDto,
  ) {
    const result = await this.inventoryItemsService.bulkAdjustStock(
      tenantId,
      bulkAdjustmentDto,
      userId,
    );

    return {
      success: true,
      message: `Bulk adjustment selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  // Reservation Operations
  @Post('reserve')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Reserve quantity untuk sales order, dll' })
  @ApiResponse({ status: 200, description: 'Quantity berhasil direserve' })
  @ApiResponse({ status: 400, description: 'Stok tidak mencukupi' })
  async reserveQuantity(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body()
    reservationData: {
      productId: string;
      locationId: string;
      quantity: number;
      reason: string;
      referenceType?: string;
      referenceId?: string;
    },
  ) {
    const inventoryItem = await this.inventoryItemsService.reserveQuantity(
      tenantId,
      reservationData.productId,
      reservationData.locationId,
      reservationData.quantity,
      reservationData.reason,
      userId,
      reservationData.referenceType,
      reservationData.referenceId,
    );

    return {
      success: true,
      message: 'Quantity berhasil direserve',
      data: inventoryItem,
    };
  }

  @Post('release-reservation')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Release reservation' })
  @ApiResponse({ status: 200, description: 'Reservation berhasil direlease' })
  async releaseReservation(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body()
    releaseData: {
      productId: string;
      locationId: string;
      quantity: number;
      reason: string;
      referenceType?: string;
      referenceId?: string;
    },
  ) {
    const inventoryItem = await this.inventoryItemsService.releaseReservation(
      tenantId,
      releaseData.productId,
      releaseData.locationId,
      releaseData.quantity,
      releaseData.reason,
      userId,
      releaseData.referenceType,
      releaseData.referenceId,
    );

    return {
      success: true,
      message: 'Reservation berhasil direlease',
      data: inventoryItem,
    };
  }

  // Stock Count Operations
  @Post('stock-count')
  @Permissions({
    resource: PermissionResource.INVENTORY,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Lakukan stock count (physical inventory)' })
  @ApiResponse({ status: 200, description: 'Stock count berhasil' })
  async performStockCount(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body()
    stockCountData: {
      productId: string;
      locationId: string;
      countedQuantity: number;
      notes: string;
    },
  ) {
    const result = await this.inventoryItemsService.performStockCount(
      tenantId,
      stockCountData.productId,
      stockCountData.locationId,
      stockCountData.countedQuantity,
      stockCountData.notes,
      userId,
    );

    return {
      success: true,
      message: 'Stock count berhasil dilakukan',
      data: {
        inventoryItem: result.inventoryItem,
        variance: result.variance,
        varianceType:
          result.variance > 0
            ? 'positive'
            : result.variance < 0
            ? 'negative'
            : 'none',
      },
    };
  }
}
