import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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

import { InventoryLocationsService } from '../services/inventory-locations.service';
import { CreateInventoryLocationDto } from '../dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from '../dto/update-inventory-location.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { PermissionAction, PermissionResource } from '../../auth/entities/permission.entity';

@ApiTags('Inventory Locations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/locations')
export class InventoryLocationsController {
  constructor(
    private readonly locationsService: InventoryLocationsService,
  ) {}

  @Post()
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Buat lokasi inventori baru' })
  @ApiResponse({ status: 201, description: 'Lokasi berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 409, description: 'Kode lokasi sudah ada' })
  async create(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createLocationDto: CreateInventoryLocationDto,
  ) {
    const location = await this.locationsService.create(tenantId, createLocationDto, userId);
    
    return {
      success: true,
      message: 'Lokasi inventori berhasil dibuat',
      data: location,
    };
  }

  @Get()
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan daftar lokasi inventori' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Sertakan lokasi tidak aktif', type: Boolean })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter berdasarkan parent ID (gunakan "null" untuk root locations)' })
  @ApiResponse({ status: 200, description: 'Daftar lokasi berhasil didapat' })
  async findAll(
    @Tenant() tenantId: string,
    @Query('includeInactive') includeInactive?: boolean,
    @Query('parentId') parentId?: string,
  ) {
    const locations = await this.locationsService.findAll(tenantId, includeInactive, parentId);
    
    return {
      success: true,
      message: 'Daftar lokasi inventori berhasil didapat',
      data: locations,
    };
  }

  @Get('hierarchy')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan hierarki lokasi inventori' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Sertakan lokasi tidak aktif', type: Boolean })
  @ApiResponse({ status: 200, description: 'Hierarki lokasi berhasil didapat' })
  async findHierarchy(
    @Tenant() tenantId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const hierarchy = await this.locationsService.findHierarchy(tenantId, includeInactive);
    
    return {
      success: true,
      message: 'Hierarki lokasi inventori berhasil didapat',
      data: hierarchy,
    };
  }

  @Get('stats')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan statistik lokasi inventori' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter untuk lokasi spesifik' })
  @ApiResponse({ status: 200, description: 'Statistik lokasi berhasil didapat' })
  async getStats(
    @Tenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    const stats = await this.locationsService.getLocationStats(tenantId, locationId);
    
    return {
      success: true,
      message: 'Statistik lokasi inventori berhasil didapat',
      data: stats,
    };
  }

  @Get('search/code/:code')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Cari lokasi berdasarkan kode' })
  @ApiParam({ name: 'code', description: 'Kode lokasi' })
  @ApiResponse({ status: 200, description: 'Lokasi ditemukan' })
  @ApiResponse({ status: 404, description: 'Lokasi tidak ditemukan' })
  async findByCode(
    @Tenant() tenantId: string,
    @Param('code') code: string,
  ) {
    const location = await this.locationsService.findByCode(tenantId, code);
    
    return {
      success: true,
      message: 'Lokasi ditemukan',
      data: location,
    };
  }

  @Get('search/name')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Cari lokasi berdasarkan nama' })
  @ApiQuery({ name: 'name', required: true, description: 'Nama lokasi yang dicari' })
  @ApiResponse({ status: 200, description: 'Hasil pencarian lokasi' })
  async findByName(
    @Tenant() tenantId: string,
    @Query('name') name: string,
  ) {
    const locations = await this.locationsService.findByName(tenantId, name);
    
    return {
      success: true,
      message: 'Hasil pencarian lokasi',
      data: locations,
    };
  }

  @Get(':id')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan detail lokasi inventori' })
  @ApiParam({ name: 'id', description: 'ID lokasi' })
  @ApiResponse({ status: 200, description: 'Detail lokasi berhasil didapat' })
  @ApiResponse({ status: 404, description: 'Lokasi tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const location = await this.locationsService.findOne(tenantId, id);
    
    return {
      success: true,
      message: 'Detail lokasi inventori berhasil didapat',
      data: location,
    };
  }

  @Get(':id/path')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan path hierarki lokasi' })
  @ApiParam({ name: 'id', description: 'ID lokasi' })
  @ApiResponse({ status: 200, description: 'Path lokasi berhasil didapat' })
  async getLocationPath(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const path = await this.locationsService.getLocationPath(tenantId, id);
    
    return {
      success: true,
      message: 'Path lokasi berhasil didapat',
      data: { path },
    };
  }

  @Patch(':id')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update lokasi inventori' })
  @ApiParam({ name: 'id', description: 'ID lokasi' })
  @ApiResponse({ status: 200, description: 'Lokasi berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Lokasi tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Kode lokasi sudah ada' })
  async update(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLocationDto: UpdateInventoryLocationDto,
  ) {
    const location = await this.locationsService.update(tenantId, id, updateLocationDto, userId);
    
    return {
      success: true,
      message: 'Lokasi inventori berhasil diupdate',
      data: location,
    };
  }

  @Delete(':id')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.DELETE })
  @ApiOperation({ summary: 'Hapus lokasi inventori' })
  @ApiParam({ name: 'id', description: 'ID lokasi' })
  @ApiResponse({ status: 200, description: 'Lokasi berhasil dihapus' })
  @ApiResponse({ status: 400, description: 'Lokasi masih memiliki inventori atau sub-lokasi' })
  @ApiResponse({ status: 404, description: 'Lokasi tidak ditemukan' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.locationsService.remove(tenantId, id);
    
    return {
      success: true,
      message: 'Lokasi inventori berhasil dihapus',
    };
  }

  @Patch('reorder')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Ubah urutan lokasi dalam parent yang sama' })
  @ApiResponse({ status: 200, description: 'Urutan lokasi berhasil diubah' })
  async reorder(
    @Tenant() tenantId: string,
    @Body() reorderData: {
      parentId: string | null;
      locations: Array<{ id: string; sortOrder: number }>;
    },
  ) {
    await this.locationsService.reorderLocations(tenantId, reorderData.parentId, reorderData.locations);
    
    return {
      success: true,
      message: 'Urutan lokasi berhasil diubah',
    };
  }

  @Patch(':id/move')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Pindahkan lokasi ke parent baru' })
  @ApiParam({ name: 'id', description: 'ID lokasi yang akan dipindahkan' })
  @ApiResponse({ status: 200, description: 'Lokasi berhasil dipindahkan' })
  async moveLocation(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() moveData: { newParentId: string | null },
  ) {
    const location = await this.locationsService.moveLocation(tenantId, id, moveData.newParentId, userId);
    
    return {
      success: true,
      message: 'Lokasi berhasil dipindahkan',
      data: location,
    };
  }
}