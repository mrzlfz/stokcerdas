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
  BadRequestException,
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
import { ApprovalChainService } from '../services/approval-chain.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CurrentTenant } from '../decorators/current-tenant.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  PermissionResource,
  PermissionAction,
} from '../entities/permission.entity';
import {
  ApprovalType,
  ApprovalStatus,
  ApprovalMode,
} from '../entities/approval-chain.entity';
import {
  CreateApprovalChainDto,
  UpdateApprovalChainDto,
  ApprovalChainQueryDto,
  CloneApprovalChainDto,
  BulkUpdateApprovalChainStatusDto,
  TestApprovalChainDto,
  ApprovalExecutionDto,
  ApprovalResponseDto,
  ApprovalChainResponseDto,
  ApprovalChainStatsDto,
  ApprovalChainValidationDto,
  ApprovalChainTestResultDto,
} from '../dto/approval-chain.dto';
import { StandardResponse } from '../../common/dto/standard-response.dto';

@ApiTags('Approval Chains')
@ApiBearerAuth()
@Controller('approval-chains')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalChainController {
  constructor(private readonly approvalChainService: ApprovalChainService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat approval chain baru',
    description: 'Membuat approval chain baru dengan konfigurasi custom',
  })
  @ApiCreatedResponse({
    description: 'Approval chain berhasil dibuat',
    type: ApprovalChainResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Data tidak valid atau kode sudah ada',
  })
  @ApiForbiddenResponse({
    description: 'Tidak memiliki izin untuk membuat approval chain',
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.CREATE,
  })
  async create(
    @Body() createApprovalChainDto: CreateApprovalChainDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<ApprovalChainResponseDto>> {
    const approvalChain = await this.approvalChainService.create(
      createApprovalChainDto,
      tenantId,
      userId,
    );

    return StandardResponse.created(
      approvalChain as ApprovalChainResponseDto,
      'Approval chain berhasil dibuat',
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Dapatkan daftar approval chain',
    description: 'Mengambil daftar approval chain dengan filter opsional',
  })
  @ApiOkResponse({
    description: 'Daftar approval chain berhasil diambil',
    type: [ApprovalChainResponseDto],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter berdasarkan jenis',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter berdasarkan status',
  })
  @ApiQuery({
    name: 'mode',
    required: false,
    description: 'Filter berdasarkan mode',
  })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    description: 'Filter berdasarkan departemen',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Kata kunci pencarian',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Sertakan chain tidak aktif',
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.READ,
  })
  async findAll(
    @Query() query: ApprovalChainQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<ApprovalChainResponseDto[]>> {
    let approvalChains;

    if (query.search) {
      approvalChains = await this.approvalChainService.search(
        query.search,
        tenantId,
        query.limit || 20,
      );
    } else if (query.type) {
      approvalChains = await this.approvalChainService.findByType(
        query.type,
        tenantId,
      );
    } else if (query.departmentId) {
      approvalChains = await this.approvalChainService.findByDepartment(
        query.departmentId,
        tenantId,
      );
    } else {
      approvalChains = await this.approvalChainService.findAll(
        tenantId,
        query.includeInactive,
        query.type,
      );
    }

    return {
      success: true,
      message: 'Daftar approval chain berhasil diambil',
      data: approvalChains as ApprovalChainResponseDto[],
      meta: {
        total: approvalChains.length,
        query,
      },
    };
  }

  @Get('types')
  @ApiOperation({
    summary: 'Dapatkan daftar jenis approval',
    description: 'Mengambil semua jenis approval yang tersedia',
  })
  @ApiOkResponse({
    description: 'Daftar jenis approval berhasil diambil',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.READ,
  })
  async getApprovalTypes(): Promise<StandardResponse<any[]>> {
    const types = [
      {
        key: ApprovalType.ROLE_ASSIGNMENT,
        label: 'Role Assignment',
        description: 'Approval untuk penugasan role ke user',
      },
      {
        key: ApprovalType.PERMISSION_GRANT,
        label: 'Permission Grant',
        description: 'Approval untuk pemberian permission',
      },
      {
        key: ApprovalType.ACCESS_REQUEST,
        label: 'Access Request',
        description: 'Approval untuk permintaan akses sistem',
      },
      {
        key: ApprovalType.DEPARTMENT_TRANSFER,
        label: 'Department Transfer',
        description: 'Approval untuk transfer antar departemen',
      },
      {
        key: ApprovalType.SYSTEM_ACCESS,
        label: 'System Access',
        description: 'Approval untuk akses sistem khusus',
      },
      {
        key: ApprovalType.DATA_ACCESS,
        label: 'Data Access',
        description: 'Approval untuk akses data sensitif',
      },
      {
        key: ApprovalType.BUDGET_APPROVAL,
        label: 'Budget Approval',
        description: 'Approval untuk anggaran dan budget',
      },
      {
        key: ApprovalType.PURCHASE_ORDER,
        label: 'Purchase Order',
        description: 'Approval untuk purchase order',
      },
      {
        key: ApprovalType.EXPENSE_APPROVAL,
        label: 'Expense Approval',
        description: 'Approval untuk expense claims',
      },
      {
        key: ApprovalType.CUSTOM,
        label: 'Custom',
        description: 'Approval kustom untuk kebutuhan khusus',
      },
    ];

    return {
      success: true,
      message: 'Daftar jenis approval berhasil diambil',
      data: types,
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Dapatkan statistik approval chain',
    description:
      'Mengambil statistik approval chain termasuk jumlah per jenis dan usage',
  })
  @ApiOkResponse({
    description: 'Statistik approval chain berhasil diambil',
    type: ApprovalChainStatsDto,
  })
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  async getStats(
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<ApprovalChainStatsDto>> {
    const stats = await this.approvalChainService.getApprovalChainStats(
      tenantId,
    );

    return {
      success: true,
      message: 'Statistik approval chain berhasil diambil',
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Dapatkan detail approval chain',
    description: 'Mengambil detail approval chain berdasarkan ID',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain' })
  @ApiOkResponse({
    description: 'Detail approval chain berhasil diambil',
    type: ApprovalChainResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Approval chain tidak ditemukan' })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.READ,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<ApprovalChainResponseDto>> {
    const approvalChain = await this.approvalChainService.findById(
      id,
      tenantId,
    );

    return {
      success: true,
      message: 'Detail approval chain berhasil diambil',
      data: approvalChain as ApprovalChainResponseDto,
    };
  }

  @Get(':id/validate')
  @ApiOperation({
    summary: 'Validasi konfigurasi approval chain',
    description:
      'Memvalidasi konfigurasi approval chain dan memberikan warning/error',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain' })
  @ApiOkResponse({
    description: 'Validasi approval chain berhasil',
    type: ApprovalChainValidationDto,
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.READ,
  })
  async validate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<ApprovalChainValidationDto>> {
    const validation =
      await this.approvalChainService.validateChainConfiguration(id, tenantId);

    return {
      success: true,
      message: 'Validasi approval chain selesai',
      data: validation,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Perbarui approval chain',
    description: 'Memperbarui informasi approval chain',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain' })
  @ApiOkResponse({
    description: 'Approval chain berhasil diperbarui',
    type: ApprovalChainResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Approval chain tidak ditemukan' })
  @ApiBadRequestResponse({ description: 'Data tidak valid' })
  @ApiForbiddenResponse({
    description:
      'Tidak memiliki izin atau approval chain adalah system-defined',
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.UPDATE,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateApprovalChainDto: UpdateApprovalChainDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<ApprovalChainResponseDto>> {
    const approvalChain = await this.approvalChainService.update(
      id,
      updateApprovalChainDto,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Approval chain berhasil diperbarui',
      data: approvalChain as ApprovalChainResponseDto,
    };
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Ubah status approval chain',
    description: 'Mengubah status aktif/tidak aktif approval chain',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain' })
  @ApiOkResponse({
    description: 'Status approval chain berhasil diubah',
    type: ApprovalChainResponseDto,
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.UPDATE,
  })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ApprovalStatus,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<ApprovalChainResponseDto>> {
    const approvalChain = await this.approvalChainService.changeStatus(
      id,
      status,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Status approval chain berhasil diubah',
      data: approvalChain as ApprovalChainResponseDto,
    };
  }

  @Post(':id/clone')
  @ApiOperation({
    summary: 'Clone approval chain',
    description: 'Membuat salinan approval chain dengan kode dan nama baru',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain yang akan di-clone' })
  @ApiCreatedResponse({
    description: 'Approval chain berhasil di-clone',
    type: ApprovalChainResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Kode approval chain baru sudah ada' })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.CREATE,
  })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cloneApprovalChainDto: CloneApprovalChainDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<ApprovalChainResponseDto>> {
    const clonedApprovalChain = await this.approvalChainService.clone(
      id,
      cloneApprovalChainDto.newCode,
      cloneApprovalChainDto.newName,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: 'Approval chain berhasil di-clone',
      data: clonedApprovalChain as ApprovalChainResponseDto,
    };
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Test approval chain',
    description: 'Menguji approval chain dengan data simulasi',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain yang akan ditest' })
  @ApiOkResponse({
    description: 'Test approval chain berhasil',
    type: ApprovalChainTestResultDto,
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.READ,
  })
  async test(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() testDto: TestApprovalChainDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<ApprovalChainTestResultDto>> {
    const testResult = await this.approvalChainService.testApprovalChain(
      id,
      {
        ...testDto.testRequest,
        id: `test-${Date.now()}`,
        submittedAt: new Date(),
      },
      tenantId,
    );

    return {
      success: true,
      message: 'Test approval chain selesai',
      data: testResult,
    };
  }

  @Post('execute')
  @ApiOperation({
    summary: 'Eksekusi approval workflow',
    description: 'Memulai proses approval untuk request tertentu',
  })
  @ApiCreatedResponse({
    description: 'Approval workflow berhasil dimulai',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            executionId: { type: 'string' },
            chainId: { type: 'string' },
            status: { type: 'string' },
            currentStepOrder: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Request tidak valid atau tidak ada chain yang sesuai',
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.CREATE,
  })
  async executeApproval(
    @Body() executionDto: ApprovalExecutionDto,
    @CurrentTenant() tenantId: string,
  ): Promise<
    StandardResponse<{
      executionId: string;
      chainId: string;
      status: string;
      currentStepOrder: number;
    }>
  > {
    const execution = await this.approvalChainService.executeApproval(
      {
        id: executionDto.requestId,
        type: executionDto.type,
        requesterId: executionDto.requestId, // This should come from context
        requestData: executionDto.requestData,
        context: executionDto.context,
        submittedAt: new Date(),
      },
      tenantId,
    );

    return {
      success: true,
      message: 'Approval workflow berhasil dimulai',
      data: {
        executionId: execution.id,
        chainId: execution.chainId,
        status: execution.status,
        currentStepOrder: execution.currentStepOrder,
      },
    };
  }

  @Post('respond')
  @ApiOperation({
    summary: 'Berikan respon approval',
    description: 'Memberikan approval atau rejection untuk step tertentu',
  })
  @ApiOkResponse({
    description: 'Respon approval berhasil diproses',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            executionId: { type: 'string' },
            stepOrder: { type: 'number' },
            status: { type: 'string' },
            nextStepOrder: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Respon tidak valid' })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.UPDATE,
  })
  async respondToApproval(
    @Body() responseDto: ApprovalResponseDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<
    StandardResponse<{
      executionId: string;
      stepOrder: number;
      status: string;
      nextStepOrder?: number;
    }>
  > {
    try {
      const execution = await this.approvalChainService.processApprovalResponse(
        responseDto.executionId,
        responseDto.stepOrder,
        userId,
        responseDto.approved,
        responseDto.comments,
        tenantId,
      );

      return {
        success: true,
        message: responseDto.approved
          ? 'Approval berhasil diberikan'
          : 'Rejection berhasil diberikan',
        data: {
          executionId: execution.id,
          stepOrder: responseDto.stepOrder,
          status: execution.status,
          nextStepOrder: execution.currentStepOrder,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        'Fitur ini memerlukan implementasi storage untuk execution data',
      );
    }
  }

  @Patch('bulk/status')
  @ApiOperation({
    summary: 'Ubah status multiple approval chain',
    description: 'Mengubah status beberapa approval chain sekaligus',
  })
  @ApiOkResponse({ description: 'Status approval chain berhasil diubah' })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.UPDATE,
  })
  async bulkUpdateStatus(
    @Body() bulkUpdateDto: BulkUpdateApprovalChainStatusDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.approvalChainService.bulkUpdateStatus(
      bulkUpdateDto.chainIds,
      bulkUpdateDto.status,
      tenantId,
      userId,
    );

    return {
      success: true,
      message: `Status ${bulkUpdateDto.chainIds.length} approval chain berhasil diubah`,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus approval chain',
    description:
      'Menghapus approval chain (soft delete). Approval chain sistem tidak dapat dihapus.',
  })
  @ApiParam({ name: 'id', description: 'ID approval chain' })
  @ApiNoContentResponse({ description: 'Approval chain berhasil dihapus' })
  @ApiNotFoundResponse({ description: 'Approval chain tidak ditemukan' })
  @ApiBadRequestResponse({
    description: 'Approval chain masih digunakan atau adalah system-defined',
  })
  @ApiForbiddenResponse({
    description: 'Tidak memiliki izin untuk menghapus approval chain',
  })
  @Permissions({
    resource: PermissionResource.SETTINGS,
    action: PermissionAction.DELETE,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<StandardResponse<void>> {
    await this.approvalChainService.remove(id, tenantId, userId);

    return {
      success: true,
      message: 'Approval chain berhasil dihapus',
    };
  }
}
