import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { PermissionSetService } from '../services/permission-set.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CurrentTenant } from '../decorators/current-tenant.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { PermissionResource, PermissionAction } from '../entities/permission.entity';
import { PermissionSetStatus, PermissionSetType, PermissionSetScope } from '../entities/permission-set.entity';
import {
  CreatePermissionSetDto,
  UpdatePermissionSetDto,
  PermissionSetQueryDto,
  ClonePermissionSetDto,
  CreateTemplateDto,
  ApplyTemplateDto,
  ManagePermissionDto,
  BulkUpdatePermissionSetStatusDto,
  CheckPermissionDto,
  ComparePermissionSetsDto,
  ImportPermissionSetDto,
  PermissionSetResponseDto,
  PermissionSetStatsDto,
  PermissionSetComparisonDto,
} from '../dto/permission-set.dto';
import { StandardResponse } from '../../common/dto/standard-response.dto';

@ApiTags('Permission Sets')
@ApiBearerAuth()
@Controller('permission-sets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionSetController {
  constructor(private readonly permissionSetService: PermissionSetService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat permission set baru',
    description: 'Membuat permission set baru dengan konfigurasi custom',
  })
  @ApiCreatedResponse({
    description: 'Permission set berhasil dibuat',
    type: PermissionSetResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Data tidak valid atau kode sudah ada' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin untuk membuat permission set' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.CREATE })
  async create(
    @Body() createPermissionSetDto: CreatePermissionSetDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.create(
      createPermissionSetDto,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Permission set berhasil dibuat',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Dapatkan daftar permission set',
    description: 'Mengambil daftar permission set dengan filter opsional',
  })
  @ApiOkResponse({
    description: 'Daftar permission set berhasil diambil',
    type: [PermissionSetResponseDto],
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filter berdasarkan jenis' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter berdasarkan status' })
  @ApiQuery({ name: 'scope', required: false, description: 'Filter berdasarkan scope' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter berdasarkan kategori' })
  @ApiQuery({ name: 'search', required: false, description: 'Kata kunci pencarian' })
  @ApiQuery({ name: 'templatesOnly', required: false, description: 'Hanya tampilkan template' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.READ })
  async findAll(
    @Query() query: PermissionSetQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto[]>> {
    let permissionSets;

    if (query.search) {
      permissionSets = await this.permissionSetService.search(
        query.search,
        tenantId,
        query.limit || 20,
      );
    } else if (query.templatesOnly) {
      permissionSets = await this.permissionSetService.getTemplates(tenantId);
    } else if (query.type) {
      permissionSets = await this.permissionSetService.findByType(query.type, tenantId);
    } else if (query.category) {
      permissionSets = await this.permissionSetService.findByCategory(
        query.category,
        tenantId,
        query.subcategory,
      );
    } else {
      permissionSets = await this.permissionSetService.findAll(
        tenantId,
        query.includeInactive,
        query.scope,
      );
    }

    return {
      success: true,
      message: 'Daftar permission set berhasil diambil',
      data: permissionSets as PermissionSetResponseDto[],
      meta: {
        total: permissionSets.length,
        query,
      },
    };
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Dapatkan daftar template permission set',
    description: 'Mengambil daftar template yang dapat digunakan untuk membuat permission set baru',
  })
  @ApiOkResponse({
    description: 'Daftar template berhasil diambil',
    type: [PermissionSetResponseDto],
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.READ })
  async getTemplates(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto[]>> {
    const templates = await this.permissionSetService.getTemplates(tenantId);

    return {
      success: true,
      message: 'Daftar template permission set berhasil diambil',
      data: templates.map(template => ({
        ...template,
        permissions: template.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: template.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      })) as PermissionSetResponseDto[],
    };
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Dapatkan permission set populer',
    description: 'Mengambil daftar permission set yang paling sering digunakan',
  })
  @ApiOkResponse({
    description: 'Permission set populer berhasil diambil',
    type: [PermissionSetResponseDto],
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Batas hasil', example: 10 })
  @Permissions({ resource: PermissionResource.ANALYTICS, action: PermissionAction.READ })
  async getPopular(
    @Query('limit') limit: number = 10,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto[]>> {
    const popularSets = await this.permissionSetService.getPopularPermissionSets(tenantId, limit);

    return {
      success: true,
      message: 'Permission set populer berhasil diambil',
      data: popularSets.map(set => ({
        ...set,
        permissions: set.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: set.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      })) as PermissionSetResponseDto[],
    };
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Dapatkan permission set yang baru digunakan',
    description: 'Mengambil daftar permission set yang baru-baru ini digunakan',
  })
  @ApiOkResponse({
    description: 'Permission set terbaru berhasil diambil',
    type: [PermissionSetResponseDto],
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Batas hasil', example: 10 })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.READ })
  async getRecent(
    @Query('limit') limit: number = 10,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto[]>> {
    const recentSets = await this.permissionSetService.getRecentlyUsedPermissionSets(tenantId, limit);

    return {
      success: true,
      message: 'Permission set yang baru digunakan berhasil diambil',
      data: recentSets.map(set => ({
        ...set,
        permissions: set.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: set.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      })) as PermissionSetResponseDto[],
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Dapatkan statistik permission set',
    description: 'Mengambil statistik permission set termasuk jumlah per jenis dan usage',
  })
  @ApiOkResponse({
    description: 'Statistik permission set berhasil diambil',
    type: PermissionSetStatsDto,
  })
  @Permissions({ resource: PermissionResource.ANALYTICS, action: PermissionAction.READ })
  async getStats(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetStatsDto>> {
    const stats = await this.permissionSetService.getPermissionSetStats(tenantId);

    return {
      success: true,
      message: 'Statistik permission set berhasil diambil',
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Dapatkan detail permission set',
    description: 'Mengambil detail permission set berdasarkan ID',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Detail permission set berhasil diambil',
    type: PermissionSetResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Permission set tidak ditemukan' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.READ })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.findById(id, tenantId);

    return {
      success: true,
      message: 'Detail permission set berhasil diambil',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Get(':id/effective-permissions')
  @ApiOperation({
    summary: 'Dapatkan effective permissions',
    description: 'Mengambil semua permission efektif untuk permission set dengan konteks tertentu',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Context departemen' })
  @ApiQuery({ name: 'ipAddress', required: false, description: 'IP address untuk validasi' })
  @ApiOkResponse({
    description: 'Effective permissions berhasil diambil',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            permissionSetId: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
            effectiveAt: { type: 'string' },
          },
        },
      },
    },
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.READ })
  async getEffectivePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('departmentId') departmentId: string,
    @Query('ipAddress') ipAddress: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<{
    permissionSetId: string;
    permissions: string[];
    effectiveAt: string;
  }>> {
    const context = {
      departmentId,
      userId,
      ipAddress,
      timestamp: new Date(),
    };

    const permissions = await this.permissionSetService.getEffectivePermissions(
      id,
      tenantId,
      context,
    );

    return {
      success: true,
      message: 'Effective permissions berhasil diambil',
      data: {
        permissionSetId: id,
        permissions,
        effectiveAt: new Date().toISOString(),
      },
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Perbarui permission set',
    description: 'Memperbarui informasi permission set',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Permission set berhasil diperbarui',
    type: PermissionSetResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Permission set tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Data tidak valid' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin atau permission set adalah system-defined' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePermissionSetDto: UpdatePermissionSetDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.update(
      id,
      updatePermissionSetDto,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Permission set berhasil diperbarui',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Ubah status permission set',
    description: 'Mengubah status aktif/tidak aktif permission set',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Status permission set berhasil diubah',
    type: PermissionSetResponseDto,
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PermissionSetStatus,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.changeStatus(
      id,
      status,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Status permission set berhasil diubah',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Post(':id/add-permission')
  @ApiOperation({
    summary: 'Tambah permission ke set',
    description: 'Menambahkan permission ke permission set',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Permission berhasil ditambahkan',
    type: PermissionSetResponseDto,
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE })
  async addPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() managePermissionDto: ManagePermissionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.addPermission(
      id,
      managePermissionDto.permissionId,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Permission berhasil ditambahkan ke permission set',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Delete(':id/remove-permission')
  @ApiOperation({
    summary: 'Hapus permission dari set',
    description: 'Menghapus permission dari permission set',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Permission berhasil dihapus',
    type: PermissionSetResponseDto,
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE })
  async removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() managePermissionDto: ManagePermissionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.removePermission(
      id,
      managePermissionDto.permissionId,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Permission berhasil dihapus dari permission set',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Post(':id/clone')
  @ApiOperation({
    summary: 'Clone permission set',
    description: 'Membuat salinan permission set dengan kode dan nama baru',
  })
  @ApiParam({ name: 'id', description: 'ID permission set yang akan di-clone' })
  @ApiCreatedResponse({
    description: 'Permission set berhasil di-clone',
    type: PermissionSetResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Kode permission set baru sudah ada' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.CREATE })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() clonePermissionSetDto: ClonePermissionSetDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const clonedPermissionSet = await this.permissionSetService.clone(
      id,
      clonePermissionSetDto.newCode,
      clonePermissionSetDto.newName,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Permission set berhasil di-clone',
      data: {
        ...clonedPermissionSet,
        permissions: clonedPermissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: clonedPermissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Post(':id/create-template')
  @ApiOperation({
    summary: 'Buat template dari permission set',
    description: 'Membuat template yang dapat digunakan berulang kali dari permission set existing',
  })
  @ApiParam({ name: 'id', description: 'ID permission set sumber' })
  @ApiCreatedResponse({
    description: 'Template berhasil dibuat',
    type: PermissionSetResponseDto,
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.CREATE })
  async createTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createTemplateDto: CreateTemplateDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const template = await this.permissionSetService.createTemplate(
      id,
      createTemplateDto.templateCode,
      createTemplateDto.templateName,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Template permission set berhasil dibuat',
      data: {
        ...template,
        permissions: template.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: template.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Post(':id/apply-template')
  @ApiOperation({
    summary: 'Terapkan template untuk membuat permission set',
    description: 'Menggunakan template untuk membuat permission set baru dengan customization',
  })
  @ApiParam({ name: 'id', description: 'ID template yang akan diterapkan' })
  @ApiCreatedResponse({
    description: 'Permission set dari template berhasil dibuat',
    type: PermissionSetResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Template tidak valid atau kode sudah ada' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.CREATE })
  async applyTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() applyTemplateDto: ApplyTemplateDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const newPermissionSet = await this.permissionSetService.applyTemplate(
      id,
      applyTemplateDto.newCode,
      applyTemplateDto.newName,
      tenantId,
      userId,
      {
        addPermissions: applyTemplateDto.addPermissions,
        removePermissions: applyTemplateDto.removePermissions,
        conditions: applyTemplateDto.conditions,
      },
    );

    return {
      success: true,
      message: 'Permission set dari template berhasil dibuat',
      data: {
        ...newPermissionSet,
        permissions: newPermissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: newPermissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Post('check-permission')
  @ApiOperation({
    summary: 'Periksa permission dalam set',
    description: 'Memeriksa apakah permission set memiliki permission tertentu',
  })
  @ApiOkResponse({
    description: 'Hasil pemeriksaan permission',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            hasPermission: { type: 'boolean' },
            permissionKey: { type: 'string' },
            checkedAt: { type: 'string' },
          },
        },
      },
    },
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.READ })
  async checkPermission(
    @Query('permissionSetId', ParseUUIDPipe) permissionSetId: string,
    @Body() checkPermissionDto: CheckPermissionDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<{
    hasPermission: boolean;
    permissionKey: string;
    checkedAt: string;
  }>> {
    const hasPermission = await this.permissionSetService.hasPermission(
      permissionSetId,
      checkPermissionDto.permissionKey,
      tenantId,
      checkPermissionDto.context,
    );

    return {
      success: true,
      message: 'Pemeriksaan permission selesai',
      data: {
        hasPermission,
        permissionKey: checkPermissionDto.permissionKey,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  @Post('compare')
  @ApiOperation({
    summary: 'Bandingkan permission set',
    description: 'Membandingkan dua permission set untuk melihat perbedaan permission',
  })
  @ApiOkResponse({
    description: 'Perbandingan permission set berhasil',
    type: PermissionSetComparisonDto,
  })
  @Permissions({ resource: PermissionResource.ANALYTICS, action: PermissionAction.READ })
  async compare(
    @Body() compareDto: ComparePermissionSetsDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionSetComparisonDto>> {
    const comparison = await this.permissionSetService.comparePermissionSets(
      compareDto.firstPermissionSetId,
      compareDto.secondPermissionSetId,
      tenantId,
    );

    return {
      success: true,
      message: 'Perbandingan permission set berhasil',
      data: comparison as unknown as PermissionSetComparisonDto,
    };
  }

  @Get(':id/export')
  @ApiOperation({
    summary: 'Export permission set',
    description: 'Mengexport permission set dalam format JSON',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Permission set berhasil diexport',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.EXPORT })
  async exportPermissionSet(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<any>> {
    const exportData = await this.permissionSetService.exportPermissionSet(id, tenantId);

    return {
      success: true,
      message: 'Permission set berhasil diexport',
      data: exportData,
    };
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import permission set',
    description: 'Mengimport permission set dari data JSON',
  })
  @ApiCreatedResponse({
    description: 'Permission set berhasil diimport',
    type: PermissionSetResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Data import tidak valid' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.IMPORT })
  async importPermissionSet(
    @Body() importDto: ImportPermissionSetDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const importedPermissionSet = await this.permissionSetService.importPermissionSet(
      importDto.importData,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Permission set berhasil diimport',
      data: {
        ...importedPermissionSet,
        permissions: importedPermissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: importedPermissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Patch('bulk/status')
  @ApiOperation({
    summary: 'Ubah status multiple permission set',
    description: 'Mengubah status beberapa permission set sekaligus',
  })
  @ApiOkResponse({ description: 'Status permission set berhasil diubah' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE })
  async bulkUpdateStatus(
    @Body() bulkUpdateDto: BulkUpdatePermissionSetStatusDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.permissionSetService.bulkUpdateStatus(
      bulkUpdateDto.permissionSetIds,
      bulkUpdateDto.status,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: `Status ${bulkUpdateDto.permissionSetIds.length} permission set berhasil diubah`,
    };
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Pulihkan permission set yang dihapus',
    description: 'Memulihkan permission set yang telah dihapus (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiOkResponse({
    description: 'Permission set berhasil dipulihkan',
    type: PermissionSetResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Permission set yang dihapus tidak ditemukan' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<PermissionSetResponseDto>> {
    const permissionSet = await this.permissionSetService.restore(id, tenantId, userId);

    return {
      success: true,
      message: 'Permission set berhasil dipulihkan',
      data: {
        ...permissionSet,
        permissions: permissionSet.permissions?.map(p => `${p.resource}:${p.action}`) || [],
        permissionCount: permissionSet.permissions?.length || 0,
        usageCount: 0, // This would be tracked separately
      } as PermissionSetResponseDto,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus permission set',
    description: 'Menghapus permission set (soft delete). Permission set sistem tidak dapat dihapus.',
  })
  @ApiParam({ name: 'id', description: 'ID permission set' })
  @ApiNoContentResponse({ description: 'Permission set berhasil dihapus' })
  @ApiNotFoundResponse({ description: 'Permission set tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Permission set masih digunakan atau adalah system-defined' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin untuk menghapus permission set' })
  @Permissions({ resource: PermissionResource.SETTINGS, action: PermissionAction.DELETE })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.permissionSetService.remove(id, tenantId, userId);

    return {
      success: true,
      message: 'Permission set berhasil dihapus',
    };
  }
}