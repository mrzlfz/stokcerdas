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
  HttpStatus,
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
import { DepartmentService } from '../services/department.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CurrentTenant } from '../decorators/current-tenant.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { PermissionResource, PermissionAction } from '../entities/permission.entity';
import { DepartmentStatus } from '../entities/department.entity';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  DepartmentQueryDto,
  MoveDepartmentDto,
  BulkUpdateStatusDto,
  DepartmentResponseDto,
  DepartmentTreeResponseDto,
  DepartmentStatsDto,
  DepartmentAccessDto,
} from '../dto/department.dto';
import { StandardResponse } from '../../common/dto/standard-response.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat departemen baru',
    description: 'Membuat departemen baru dalam hierarki organisasi',
  })
  @ApiCreatedResponse({
    description: 'Departemen berhasil dibuat',
    type: DepartmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Data tidak valid atau kode departemen sudah ada' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin untuk membuat departemen' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.CREATE })
  async create(
    @Body() createDepartmentDto: CreateDepartmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto>> {
    const department = await this.departmentService.create(
      createDepartmentDto,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Departemen berhasil dibuat',
      data: department as DepartmentResponseDto,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Dapatkan daftar departemen',
    description: 'Mengambil daftar departemen dengan filter opsional',
  })
  @ApiOkResponse({
    description: 'Daftar departemen berhasil diambil',
    type: [DepartmentResponseDto],
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filter berdasarkan jenis departemen' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter berdasarkan status' })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter berdasarkan departemen induk' })
  @ApiQuery({ name: 'managerId', required: false, description: 'Filter berdasarkan manajer' })
  @ApiQuery({ name: 'location', required: false, description: 'Filter berdasarkan lokasi' })
  @ApiQuery({ name: 'search', required: false, description: 'Kata kunci pencarian' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Sertakan departemen tidak aktif' })
  @ApiQuery({ name: 'limit', required: false, description: 'Batas hasil' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async findAll(
    @Query() query: DepartmentQueryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto[]>> {
    let departments;

    if (query.search) {
      departments = await this.departmentService.search(
        query.search,
        tenantId,
        query.limit || 20,
      );
    } else if (query.type) {
      departments = await this.departmentService.findByType(query.type, tenantId);
    } else if (query.managerId) {
      departments = await this.departmentService.findByManager(query.managerId, tenantId);
    } else {
      departments = await this.departmentService.findAll(tenantId, query.includeInactive);
    }

    // Filter by department access
    const accessibleDepartments = await this.departmentService.filterByDepartmentAccess(
      departments.map(d => ({ ...d, departmentId: d.id })),
      userId,
      tenantId,
    );

    return {
      success: true,
      message: 'Daftar departemen berhasil diambil',
      data: accessibleDepartments as DepartmentResponseDto[],
      meta: {
        total: accessibleDepartments.length,
        query,
      },
    };
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Dapatkan struktur hierarki departemen',
    description: 'Mengambil struktur tree lengkap dari hierarki departemen',
  })
  @ApiOkResponse({
    description: 'Struktur hierarki departemen berhasil diambil',
    type: [DepartmentTreeResponseDto],
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getDepartmentTree(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<DepartmentTreeResponseDto[]>> {
    const tree = await this.departmentService.getDepartmentTree(tenantId);

    return {
      success: true,
      message: 'Struktur hierarki departemen berhasil diambil',
      data: tree as DepartmentTreeResponseDto[],
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Dapatkan statistik departemen',
    description: 'Mengambil statistik departemen termasuk jumlah per jenis dan level',
  })
  @ApiOkResponse({
    description: 'Statistik departemen berhasil diambil',
    type: DepartmentStatsDto,
  })
  @Permissions({ resource: PermissionResource.ANALYTICS, action: PermissionAction.READ })
  async getStats(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<DepartmentStatsDto>> {
    const stats = await this.departmentService.getDepartmentStats(tenantId);

    return {
      success: true,
      message: 'Statistik departemen berhasil diambil',
      data: stats,
    };
  }

  @Get('accessible')
  @ApiOperation({
    summary: 'Dapatkan departemen yang dapat diakses user',
    description: 'Mengambil daftar departemen yang dapat diakses oleh user saat ini',
  })
  @ApiOkResponse({
    description: 'Departemen yang dapat diakses berhasil diambil',
    type: [DepartmentResponseDto],
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getAccessibleDepartments(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto[]>> {
    const departments = await this.departmentService.getUserAccessibleDepartments(
      userId,
      tenantId,
    );

    return {
      success: true,
      message: 'Departemen yang dapat diakses berhasil diambil',
      data: departments as DepartmentResponseDto[],
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Dapatkan detail departemen',
    description: 'Mengambil detail departemen berdasarkan ID',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Detail departemen berhasil diambil',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Departemen tidak ditemukan' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki akses ke departemen ini' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    const department = await this.departmentService.findById(id, tenantId);

    return {
      success: true,
      message: 'Detail departemen berhasil diambil',
      data: department as DepartmentResponseDto,
    };
  }

  @Get(':id/ancestors')
  @ApiOperation({
    summary: 'Dapatkan hierarki atas departemen',
    description: 'Mengambil departemen dengan semua departemen induknya',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Hierarki atas departemen berhasil diambil',
    type: DepartmentTreeResponseDto,
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getAncestors(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentTreeResponseDto>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    const department = await this.departmentService.getDepartmentWithAncestors(id, tenantId);

    return {
      success: true,
      message: 'Hierarki atas departemen berhasil diambil',
      data: department as DepartmentTreeResponseDto,
    };
  }

  @Get(':id/descendants')
  @ApiOperation({
    summary: 'Dapatkan hierarki bawah departemen',
    description: 'Mengambil departemen dengan semua sub-departemennya',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Hierarki bawah departemen berhasil diambil',
    type: DepartmentTreeResponseDto,
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getDescendants(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentTreeResponseDto>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    const department = await this.departmentService.getDepartmentWithDescendants(id, tenantId);

    return {
      success: true,
      message: 'Hierarki bawah departemen berhasil diambil',
      data: department as DepartmentTreeResponseDto,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Perbarui departemen',
    description: 'Memperbarui informasi departemen',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Departemen berhasil diperbarui',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Departemen tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Data tidak valid' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin untuk memperbarui departemen' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    const department = await this.departmentService.update(
      id,
      updateDepartmentDto,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Departemen berhasil diperbarui',
      data: department as DepartmentResponseDto,
    };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Ubah status departemen',
    description: 'Mengubah status aktif/tidak aktif departemen',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Status departemen berhasil diubah',
    type: DepartmentResponseDto,
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DepartmentStatus,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    const department = await this.departmentService.changeStatus(id, status, tenantId, userId);

    return {
      success: true,
      message: 'Status departemen berhasil diubah',
      data: department as DepartmentResponseDto,
    };
  }

  @Patch(':id/move')
  @ApiOperation({
    summary: 'Pindahkan departemen',
    description: 'Memindahkan departemen ke departemen induk yang baru',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Departemen berhasil dipindahkan',
    type: DepartmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Tidak dapat memindahkan ke departemen anak' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async moveDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() moveDepartmentDto: MoveDepartmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    const department = await this.departmentService.moveDepartment(
      id,
      moveDepartmentDto.newParentId,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Departemen berhasil dipindahkan',
      data: department as DepartmentResponseDto,
    };
  }

  @Patch('bulk/status')
  @ApiOperation({
    summary: 'Ubah status multiple departemen',
    description: 'Mengubah status beberapa departemen sekaligus',
  })
  @ApiOkResponse({ description: 'Status departemen berhasil diubah' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async bulkUpdateStatus(
    @Body() bulkUpdateDto: BulkUpdateStatusDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    // Check access to all departments
    for (const departmentId of bulkUpdateDto.departmentIds) {
      await this.departmentService.enforceDepartmentAccess(departmentId, userId, tenantId);
    }

    await this.departmentService.bulkUpdateStatus(
      bulkUpdateDto.departmentIds,
      bulkUpdateDto.status,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: `Status ${bulkUpdateDto.departmentIds.length} departemen berhasil diubah`,
    };
  }

  @Post(':id/restore')
  @ApiOperation({
    summary: 'Pulihkan departemen yang dihapus',
    description: 'Memulihkan departemen yang telah dihapus (soft delete)',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiOkResponse({
    description: 'Departemen berhasil dipulihkan',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Departemen yang dihapus tidak ditemukan' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<DepartmentResponseDto>> {
    const department = await this.departmentService.restore(id, tenantId, userId);

    return {
      success: true,
      message: 'Departemen berhasil dipulihkan',
      data: department as DepartmentResponseDto,
    };
  }

  @Post('check-access')
  @ApiOperation({
    summary: 'Periksa akses departemen',
    description: 'Memeriksa apakah user memiliki akses ke departemen tertentu',
  })
  @ApiOkResponse({
    description: 'Hasil pemeriksaan akses',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            hasAccess: { type: 'boolean' },
            departmentId: { type: 'string' },
          },
        },
      },
    },
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async checkAccess(
    @Body() accessDto: DepartmentAccessDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<{ hasAccess: boolean; departmentId: string }>> {
    const hasAccess = await this.departmentService.checkDepartmentAccess(
      userId,
      accessDto.departmentId,
      tenantId,
    );

    return {
      success: true,
      message: 'Pemeriksaan akses selesai',
      data: {
        hasAccess,
        departmentId: accessDto.departmentId,
      },
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus departemen',
    description: 'Menghapus departemen (soft delete). Departemen dengan sub-departemen atau user aktif tidak dapat dihapus.',
  })
  @ApiParam({ name: 'id', description: 'ID departemen' })
  @ApiNoContentResponse({ description: 'Departemen berhasil dihapus' })
  @ApiNotFoundResponse({ description: 'Departemen tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Departemen memiliki sub-departemen atau user aktif' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin untuk menghapus departemen' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.DELETE })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.departmentService.enforceDepartmentAccess(id, userId, tenantId);
    await this.departmentService.remove(id, tenantId, userId);

    return {
      success: true,
      message: 'Departemen berhasil dihapus',
    };
  }
}