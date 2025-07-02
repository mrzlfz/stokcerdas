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

import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { SupplierQueryDto } from '../dto/supplier-query.dto';
import {
  BulkCreateSupplierDto,
  BulkUpdateSupplierDto,
  BulkDeleteSupplierDto,
} from '../dto/bulk-supplier.dto';
import { AddSupplierNoteDto, UpdateSupplierPerformanceDto } from '../dto/supplier-note.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { PermissionAction, PermissionResource } from '../../auth/entities/permission.entity';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Buat supplier baru' })
  @ApiResponse({ status: 201, description: 'Supplier berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 409, description: 'Kode supplier atau email sudah ada' })
  async create(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createSupplierDto: CreateSupplierDto,
  ) {
    const supplier = await this.suppliersService.create(tenantId, createSupplierDto, userId);
    
    return {
      success: true,
      message: 'Supplier berhasil dibuat',
      data: supplier,
    };
  }

  @Get()
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan daftar supplier dengan filter dan pagination' })
  @ApiResponse({ status: 200, description: 'Daftar supplier berhasil didapat' })
  async findAll(
    @Tenant() tenantId: string,
    @Query() query: SupplierQueryDto,
  ) {
    const result = await this.suppliersService.findAll(tenantId, query);
    
    return {
      success: true,
      message: 'Daftar supplier berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('stats')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan statistik supplier' })
  @ApiResponse({ status: 200, description: 'Statistik supplier berhasil didapat' })
  async getStats(@Tenant() tenantId: string) {
    const stats = await this.suppliersService.getSupplierStats(tenantId);
    
    return {
      success: true,
      message: 'Statistik supplier berhasil didapat',
      data: stats,
    };
  }

  @Get('search/code/:code')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Cari supplier berdasarkan kode' })
  @ApiParam({ name: 'code', description: 'Kode supplier' })
  @ApiResponse({ status: 200, description: 'Supplier ditemukan' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  async findByCode(
    @Tenant() tenantId: string,
    @Param('code') code: string,
  ) {
    const supplier = await this.suppliersService.findByCode(tenantId, code);
    
    return {
      success: true,
      message: 'Supplier ditemukan',
      data: supplier,
    };
  }

  @Get(':id')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan detail supplier' })
  @ApiParam({ name: 'id', description: 'ID supplier' })
  @ApiResponse({ status: 200, description: 'Detail supplier berhasil didapat' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const supplier = await this.suppliersService.findOne(tenantId, id);
    
    return {
      success: true,
      message: 'Detail supplier berhasil didapat',
      data: supplier,
    };
  }

  @Patch(':id')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update supplier' })
  @ApiParam({ name: 'id', description: 'ID supplier' })
  @ApiResponse({ status: 200, description: 'Supplier berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Kode supplier atau email sudah ada' })
  async update(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    const supplier = await this.suppliersService.update(tenantId, id, updateSupplierDto, userId);
    
    return {
      success: true,
      message: 'Supplier berhasil diupdate',
      data: supplier,
    };
  }

  @Delete(':id')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.DELETE })
  @ApiOperation({ summary: 'Hapus supplier (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID supplier' })
  @ApiQuery({ name: 'hard', required: false, description: 'Hard delete (permanent)', type: Boolean })
  @ApiResponse({ status: 200, description: 'Supplier berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Supplier masih memiliki produk aktif' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hardDelete?: boolean,
  ) {
    await this.suppliersService.remove(tenantId, id, hardDelete, userId);
    
    return {
      success: true,
      message: hardDelete ? 'Supplier berhasil dihapus permanent' : 'Supplier berhasil dihapus',
    };
  }

  // Supplier Notes Management
  @Post(':id/notes')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Tambah catatan untuk supplier' })
  @ApiParam({ name: 'id', description: 'ID supplier' })
  @ApiResponse({ status: 201, description: 'Catatan berhasil ditambahkan' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  async addNote(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addNoteDto: AddSupplierNoteDto,
  ) {
    const supplier = await this.suppliersService.addNote(tenantId, id, addNoteDto, userId);
    
    return {
      success: true,
      message: 'Catatan berhasil ditambahkan',
      data: supplier,
    };
  }

  // Performance Management
  @Post(':id/performance')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update performa supplier berdasarkan order' })
  @ApiParam({ name: 'id', description: 'ID supplier' })
  @ApiResponse({ status: 200, description: 'Performa supplier berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  async updatePerformance(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() performanceDto: UpdateSupplierPerformanceDto,
  ) {
    const supplier = await this.suppliersService.updatePerformance(tenantId, id, performanceDto);
    
    return {
      success: true,
      message: 'Performa supplier berhasil diupdate',
      data: supplier,
    };
  }

  // Bulk Operations
  @Post('bulk/create')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Buat banyak supplier sekaligus' })
  @ApiResponse({ status: 201, description: 'Bulk create berhasil' })
  async bulkCreate(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkCreateDto: BulkCreateSupplierDto,
  ) {
    const result = await this.suppliersService.bulkCreate(tenantId, bulkCreateDto, userId);
    
    return {
      success: true,
      message: `Bulk create selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  @Patch('bulk/update')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update banyak supplier sekaligus' })
  @ApiResponse({ status: 200, description: 'Bulk update berhasil' })
  async bulkUpdate(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkUpdateDto: BulkUpdateSupplierDto,
  ) {
    const result = await this.suppliersService.bulkUpdate(tenantId, bulkUpdateDto, userId);
    
    return {
      success: true,
      message: `Bulk update selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  @Delete('bulk/delete')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.DELETE })
  @ApiOperation({ summary: 'Hapus banyak supplier sekaligus' })
  @ApiResponse({ status: 200, description: 'Bulk delete berhasil' })
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkDeleteDto: BulkDeleteSupplierDto,
  ) {
    const result = await this.suppliersService.bulkDelete(tenantId, bulkDeleteDto, userId);
    
    return {
      success: true,
      message: `Bulk delete selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  // Report Endpoints
  @Get('reports/performance')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Laporan performa supplier' })
  @ApiQuery({ name: 'limit', required: false, description: 'Jumlah supplier top performer', type: Number })
  @ApiResponse({ status: 200, description: 'Laporan performa berhasil didapat' })
  async getPerformanceReport(
    @Tenant() tenantId: string,
    @Query('limit') limit: number = 10,
  ) {
    const suppliers = await this.suppliersService.findAll(tenantId, {
      page: 1,
      limit,
      sortBy: 'rating',
      sortOrder: 'DESC',
    });

    const performanceData = suppliers.data.map(supplier => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      rating: supplier.rating,
      totalOrders: supplier.totalOrders,
      totalPurchaseAmount: supplier.totalPurchaseAmount,
      onTimeDeliveryRate: supplier.onTimeDeliveryRate,
      qualityScore: supplier.qualityScore,
      leadTimeDays: supplier.leadTimeDays,
    }));

    return {
      success: true,
      message: 'Laporan performa supplier berhasil didapat',
      data: performanceData,
    };
  }

  @Get('reports/contracts-expiring')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Laporan kontrak supplier yang akan berakhir' })
  @ApiQuery({ name: 'days', required: false, description: 'Jumlah hari ke depan', type: Number })
  @ApiResponse({ status: 200, description: 'Laporan kontrak berhasil didapat' })
  async getContractsExpiringReport(
    @Tenant() tenantId: string,
    @Query('days') days: number = 30,
  ) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const suppliers = await this.suppliersService.findAll(tenantId, {
      page: 1,
      limit: 100,
      contractActive: true,
    });

    const expiringContracts = suppliers.data
      .filter(supplier => supplier.contractEndDate && new Date(supplier.contractEndDate) <= endDate)
      .map(supplier => ({
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        contractEndDate: supplier.contractEndDate,
        daysUntilExpiry: Math.ceil(
          (new Date(supplier.contractEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

    return {
      success: true,
      message: 'Laporan kontrak yang akan berakhir berhasil didapat',
      data: expiringContracts,
    };
  }
}