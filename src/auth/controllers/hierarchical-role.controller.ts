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
import { HierarchicalRoleService } from '../services/hierarchical-role.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CurrentTenant } from '../decorators/current-tenant.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { PermissionResource, PermissionAction } from '../entities/permission.entity';
import { RoleStatus, RoleType, RoleLevel } from '../entities/hierarchical-role.entity';
import { InheritanceType } from '../entities/role-hierarchy.entity';
import {
  CreateHierarchicalRoleDto,
  UpdateHierarchicalRoleDto,
  CreateRoleHierarchyDto,
  HierarchicalRoleQueryDto,
  CloneRoleDto,
  BulkUpdateRoleStatusDto,
  PermissionGrantDto,
  HierarchicalRoleResponseDto,
  RoleHierarchyResponseDto,
  RoleStatsDto,
} from '../dto/hierarchical-role.dto';
import { StandardResponse } from '../../common/dto/standard-response.dto';

@ApiTags('Hierarchical Roles')
@ApiBearerAuth()
@Controller('hierarchical-roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HierarchicalRoleController {
  constructor(private readonly roleService: HierarchicalRoleService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat role hierarki baru',
    description: 'Membuat role baru dalam sistem hierarki dengan inheritance capability',
  })
  @ApiCreatedResponse({
    description: 'Role berhasil dibuat',
    type: HierarchicalRoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Data tidak valid atau kode role sudah ada' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin untuk membuat role' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.CREATE })
  async create(
    @Body() createRoleDto: CreateHierarchicalRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const role = await this.roleService.create(createRoleDto, tenantId, userId);

    return {
      success: true,
      message: 'Role hierarki berhasil dibuat',
      data: role as HierarchicalRoleResponseDto,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Dapatkan daftar role hierarki',
    description: 'Mengambil daftar role hierarki dengan filter opsional',
  })
  @ApiOkResponse({
    description: 'Daftar role hierarki berhasil diambil',
    type: [HierarchicalRoleResponseDto],
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filter berdasarkan jenis role' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter berdasarkan status' })
  @ApiQuery({ name: 'level', required: false, description: 'Filter berdasarkan level' })
  @ApiQuery({ name: 'department', required: false, description: 'Filter berdasarkan departemen' })
  @ApiQuery({ name: 'search', required: false, description: 'Kata kunci pencarian' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async findAll(
    @Query() query: HierarchicalRoleQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto[]>> {
    let roles;

    if (query.search) {
      roles = await this.roleService.search(query.search, tenantId, query.limit || 20);
    } else if (query.type) {
      roles = await this.roleService.findByType(query.type, tenantId);
    } else if (query.level) {
      roles = await this.roleService.findByLevel(query.level, tenantId);
    } else {
      roles = await this.roleService.findAll(tenantId, query.includeInactive);
    }

    return {
      success: true,
      message: 'Daftar role hierarki berhasil diambil',
      data: roles as HierarchicalRoleResponseDto[],
      meta: {
        total: roles.length,
        query,
      },
    };
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Dapatkan struktur tree role hierarki',
    description: 'Mengambil struktur tree lengkap dari hierarki role',
  })
  @ApiOkResponse({
    description: 'Struktur tree role hierarki berhasil diambil',
    type: [HierarchicalRoleResponseDto],
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getRoleTree(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto[]>> {
    const tree = await this.roleService.getRoleTree(tenantId);

    return {
      success: true,
      message: 'Struktur tree role hierarki berhasil diambil',
      data: tree as HierarchicalRoleResponseDto[],
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Dapatkan statistik role hierarki',
    description: 'Mengambil statistik role termasuk jumlah per jenis, level, dan user',
  })
  @ApiOkResponse({
    description: 'Statistik role hierarki berhasil diambil',
    type: RoleStatsDto,
  })
  @Permissions({ resource: PermissionResource.ANALYTICS, action: PermissionAction.READ })
  async getStats(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<RoleStatsDto>> {
    const stats = await this.roleService.getRoleStats(tenantId);

    return {
      success: true,
      message: 'Statistik role hierarki berhasil diambil',
      data: stats,
    };
  }

  @Get('hierarchies')
  @ApiOperation({
    summary: 'Dapatkan relationship hierarki role',
    description: 'Mengambil daftar relationship inheritance antar role',
  })
  @ApiOkResponse({
    description: 'Relationship hierarki role berhasil diambil',
    type: [RoleHierarchyResponseDto],
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getHierarchies(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<RoleHierarchyResponseDto[]>> {
    const hierarchies = await this.roleService.getHierarchies(tenantId);

    return {
      success: true,
      message: 'Relationship hierarki role berhasil diambil',
      data: hierarchies as RoleHierarchyResponseDto[],
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Dapatkan detail role hierarki',
    description: 'Mengambil detail role hierarki berdasarkan ID',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Detail role hierarki berhasil diambil',
    type: HierarchicalRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role tidak ditemukan' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const role = await this.roleService.findById(id, tenantId);

    return {
      success: true,
      message: 'Detail role hierarki berhasil diambil',
      data: role as HierarchicalRoleResponseDto,
    };
  }

  @Get(':id/ancestors')
  @ApiOperation({
    summary: 'Dapatkan hierarki atas role',
    description: 'Mengambil role dengan semua role parentnya',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Hierarki atas role berhasil diambil',
    type: HierarchicalRoleResponseDto,
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getAncestors(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const role = await this.roleService.getRoleWithAncestors(id, tenantId);

    return {
      success: true,
      message: 'Hierarki atas role berhasil diambil',
      data: role as HierarchicalRoleResponseDto,
    };
  }

  @Get(':id/descendants')
  @ApiOperation({
    summary: 'Dapatkan hierarki bawah role',
    description: 'Mengambil role dengan semua sub-rolenya',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Hierarki bawah role berhasil diambil',
    type: HierarchicalRoleResponseDto,
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getDescendants(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const role = await this.roleService.getRoleWithDescendants(id, tenantId);

    return {
      success: true,
      message: 'Hierarki bawah role berhasil diambil',
      data: role as HierarchicalRoleResponseDto,
    };
  }

  @Get(':id/parents')
  @ApiOperation({
    summary: 'Dapatkan parent roles',
    description: 'Mengambil daftar role parent untuk role tertentu',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Parent roles berhasil diambil',
    type: [HierarchicalRoleResponseDto],
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getParentRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto[]>> {
    const parentRoles = await this.roleService.getParentRoles(id, tenantId);

    return {
      success: true,
      message: 'Parent roles berhasil diambil',
      data: parentRoles as HierarchicalRoleResponseDto[],
    };
  }

  @Get(':id/children')
  @ApiOperation({
    summary: 'Dapatkan child roles',
    description: 'Mengambil daftar role child untuk role tertentu',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Child roles berhasil diambil',
    type: [HierarchicalRoleResponseDto],
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getChildRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto[]>> {
    const childRoles = await this.roleService.getChildRoles(id, tenantId);

    return {
      success: true,
      message: 'Child roles berhasil diambil',
      data: childRoles as HierarchicalRoleResponseDto[],
    };
  }

  @Get(':id/effective-permissions')
  @ApiOperation({
    summary: 'Dapatkan effective permissions',
    description: 'Mengambil semua permission efektif untuk role (termasuk inherited)',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Context departemen' })
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
            roleId: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
            inheritedFrom: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async getEffectivePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('departmentId') departmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<{
    roleId: string;
    permissions: string[];
    inheritedFrom: string[];
  }>> {
    const context = {
      departmentId,
      userId,
    };

    const permissions = await this.roleService.getEffectivePermissions(id, tenantId, context);
    const parentRoles = await this.roleService.getParentRoles(id, tenantId);

    return {
      success: true,
      message: 'Effective permissions berhasil diambil',
      data: {
        roleId: id,
        permissions,
        inheritedFrom: parentRoles.map(role => role.id),
      },
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Perbarui role hierarki',
    description: 'Memperbarui informasi role hierarki',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Role berhasil diperbarui',
    type: HierarchicalRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Role tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Data tidak valid' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin atau role adalah system role' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateHierarchicalRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const role = await this.roleService.update(id, updateRoleDto, tenantId, userId);

    return {
      success: true,
      message: 'Role hierarki berhasil diperbarui',
      data: role as HierarchicalRoleResponseDto,
    };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Ubah status role',
    description: 'Mengubah status aktif/tidak aktif role',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiOkResponse({
    description: 'Status role berhasil diubah',
    type: HierarchicalRoleResponseDto,
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: RoleStatus,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const role = await this.roleService.changeStatus(id, status, tenantId, userId);

    return {
      success: true,
      message: 'Status role berhasil diubah',
      data: role as HierarchicalRoleResponseDto,
    };
  }

  @Post('hierarchies')
  @ApiOperation({
    summary: 'Buat relationship hierarki role',
    description: 'Membuat relationship inheritance antara parent dan child role',
  })
  @ApiCreatedResponse({
    description: 'Relationship hierarki berhasil dibuat',
    type: RoleHierarchyResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Data tidak valid atau akan menyebabkan circular reference' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.CREATE })
  async createHierarchy(
    @Body() createHierarchyDto: CreateRoleHierarchyDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<RoleHierarchyResponseDto>> {
    const hierarchy = await this.roleService.createHierarchy(
      createHierarchyDto.parentRoleId,
      createHierarchyDto.childRoleId,
      createHierarchyDto.inheritanceType,
      tenantId,
      userId,
      {
        includedPermissions: createHierarchyDto.includedPermissions,
        excludedPermissions: createHierarchyDto.excludedPermissions,
        conditions: createHierarchyDto.conditions,
      },
    );

    return {
      success: true,
      message: 'Relationship hierarki role berhasil dibuat',
      data: hierarchy as RoleHierarchyResponseDto,
    };
  }

  @Post(':id/clone')
  @ApiOperation({
    summary: 'Clone role',
    description: 'Membuat salinan role dengan kode dan nama baru',
  })
  @ApiParam({ name: 'id', description: 'ID role yang akan di-clone' })
  @ApiCreatedResponse({
    description: 'Role berhasil di-clone',
    type: HierarchicalRoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Kode role baru sudah ada' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.CREATE })
  async cloneRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cloneRoleDto: CloneRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<HierarchicalRoleResponseDto>> {
    const clonedRole = await this.roleService.cloneRole(
      id,
      cloneRoleDto.newCode,
      cloneRoleDto.newName,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Role berhasil di-clone',
      data: clonedRole as HierarchicalRoleResponseDto,
    };
  }

  @Patch('bulk/status')
  @ApiOperation({
    summary: 'Ubah status multiple role',
    description: 'Mengubah status beberapa role sekaligus',
  })
  @ApiOkResponse({ description: 'Status role berhasil diubah' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.UPDATE })
  async bulkUpdateStatus(
    @Body() bulkUpdateDto: BulkUpdateRoleStatusDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.roleService.bulkUpdateStatus(
      bulkUpdateDto.roleIds,
      bulkUpdateDto.status,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: `Status ${bulkUpdateDto.roleIds.length} role berhasil diubah`,
    };
  }

  @Post('check-permission-grant')
  @ApiOperation({
    summary: 'Periksa kemampuan grant permission',
    description: 'Memeriksa apakah role dapat memberikan permission ke role lain',
  })
  @ApiOkResponse({
    description: 'Hasil pemeriksaan grant permission',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            canGrant: { type: 'boolean' },
            grantingRoleId: { type: 'string' },
            receivingRoleId: { type: 'string' },
            permissionKey: { type: 'string' },
          },
        },
      },
    },
  })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.READ })
  async checkPermissionGrant(
    @Body() permissionGrantDto: PermissionGrantDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<{
    canGrant: boolean;
    grantingRoleId: string;
    receivingRoleId: string;
    permissionKey: string;
  }>> {
    const canGrant = await this.roleService.canGrantPermission(
      permissionGrantDto.grantingRoleId,
      permissionGrantDto.receivingRoleId,
      permissionGrantDto.permissionKey,
      tenantId,
    );

    return {
      success: true,
      message: 'Pemeriksaan grant permission selesai',
      data: {
        canGrant,
        grantingRoleId: permissionGrantDto.grantingRoleId,
        receivingRoleId: permissionGrantDto.receivingRoleId,
        permissionKey: permissionGrantDto.permissionKey,
      },
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus role hierarki',
    description: 'Menghapus role hierarki (soft delete). Role sistem dan role dengan user aktif tidak dapat dihapus.',
  })
  @ApiParam({ name: 'id', description: 'ID role' })
  @ApiNoContentResponse({ description: 'Role berhasil dihapus' })
  @ApiNotFoundResponse({ description: 'Role tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Role memiliki sub-role atau user aktif' })
  @ApiForbiddenResponse({ description: 'Tidak memiliki izin atau role adalah system role' })
  @Permissions({ resource: PermissionResource.USERS, action: PermissionAction.DELETE })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.roleService.remove(id, tenantId, userId);

    return {
      success: true,
      message: 'Role hierarki berhasil dihapus',
    };
  }
}