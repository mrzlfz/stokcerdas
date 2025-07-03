import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { PermissionResource, PermissionAction } from '../../auth/entities/permission.entity';
import { User } from '../../users/entities/user.entity';

import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { 
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus 
} from '../entities/purchase-order.entity';

import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/purchase-order-query.dto';
import {
  ApprovePurchaseOrderDto,
  RejectPurchaseOrderDto,
  EscalateApprovalDto,
  BulkApprovalDto,
  BulkApprovalResponseDto,
} from '../dto/purchase-order-approval.dto';
import {
  AddPurchaseOrderItemDto,
  UpdatePurchaseOrderItemDto,
  ReceiveItemDto,
  BulkReceiveItemsDto,
  BulkItemActionResponseDto,
} from '../dto/purchase-order-item.dto';
import {
  BulkCreatePurchaseOrderDto,
  BulkUpdatePurchaseOrderDto,
  BulkDeletePurchaseOrderDto,
  BulkStatusUpdateDto,
  BulkSendToSupplierDto,
  BulkPurchaseOrderResponseDto,
  ExportPurchaseOrdersDto,
} from '../dto/bulk-purchase-order.dto';

@ApiTags('Purchase Orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  // CRUD Operations
  @Post()
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.CREATE })
  @ApiOperation({ 
    summary: 'Buat purchase order baru',
    description: 'Membuat purchase order baru dengan item-item yang diperlukan. PO akan otomatis memerlukan approval jika total melebihi threshold yang ditentukan.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Purchase order berhasil dibuat',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Data input tidak valid atau supplier tidak aktif',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Nomor PO sudah digunakan',
  })
  async create(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Body(ValidationPipe) createPurchaseOrderDto: CreatePurchaseOrderDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.create(
      tenantId,
      createPurchaseOrderDto,
      user.id,
    );

    return {
      success: true,
      message: 'Purchase order berhasil dibuat',
      data: result,
    };
  }

  @Get()
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({
    summary: 'Dapatkan daftar purchase orders',
    description: 'Mengambil daftar purchase orders dengan filtering dan pagination. Mendukung berbagai filter seperti status, supplier, tanggal, dll.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daftar purchase orders berhasil diambil',
  })
  async findAll(
    @Tenant() tenantId: string,
    @Query(ValidationPipe) query: PurchaseOrderQueryDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const result = await this.purchaseOrdersService.findAll(tenantId, query);

    return {
      success: true,
      message: 'Daftar purchase orders berhasil diambil',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('stats')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({
    summary: 'Dapatkan statistik purchase orders',
    description: 'Mengambil statistik lengkap purchase orders termasuk jumlah berdasarkan status, prioritas, dan total nilai'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistik purchase orders berhasil diambil',
  })
  async getStats(
    @Tenant() tenantId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const result = await this.purchaseOrdersService.getStats(tenantId);

    return {
      success: true,
      message: 'Statistik purchase orders berhasil diambil',
      data: result,
    };
  }

  @Get(':id')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({
    summary: 'Dapatkan detail purchase order',
    description: 'Mengambil detail lengkap purchase order termasuk items, approvals, dan status history'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detail purchase order berhasil diambil',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order tidak ditemukan',
  })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.findOne(tenantId, id);

    return {
      success: true,
      message: 'Detail purchase order berhasil diambil',
      data: result,
    };
  }

  @Get('po-number/:poNumber')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ })
  @ApiOperation({
    summary: 'Dapatkan purchase order berdasarkan nomor PO',
    description: 'Mencari purchase order berdasarkan nomor PO'
  })
  @ApiParam({
    name: 'poNumber',
    description: 'Nomor PO (contoh: PO-2025-001)',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order berhasil ditemukan',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order dengan nomor tersebut tidak ditemukan',
  })
  async findByPoNumber(
    @Tenant() tenantId: string,
    @Param('poNumber') poNumber: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.findByPoNumber(tenantId, poNumber);

    return {
      success: true,
      message: 'Purchase order berhasil ditemukan',
      data: result,
    };
  }

  @Put(':id')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Update purchase order',
    description: 'Mengupdate purchase order. Hanya bisa dilakukan jika PO masih dalam status DRAFT atau REJECTED'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order berhasil diupdate',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat diedit pada status ini',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order tidak ditemukan',
  })
  async update(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.update(
      tenantId,
      id,
      updatePurchaseOrderDto,
      user.id,
    );

    return {
      success: true,
      message: 'Purchase order berhasil diupdate',
      data: result,
    };
  }

  @Delete(':id')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.DELETE })
  @ApiOperation({
    summary: 'Hapus purchase order',
    description: 'Menghapus purchase order (soft delete) atau membatalkan PO. Hard delete hanya untuk admin'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'hardDelete',
    description: 'Apakah akan melakukan hard delete (permanent)',
    required: false,
    type: 'boolean',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order berhasil dihapus',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat dibatalkan pada status ini',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Purchase order tidak ditemukan',
  })
  async remove(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hardDelete') hardDelete?: boolean,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    await this.purchaseOrdersService.remove(tenantId, id, hardDelete || false, user.id);

    return {
      success: true,
      message: hardDelete 
        ? 'Purchase order berhasil dihapus permanent' 
        : 'Purchase order berhasil dibatalkan',
    };
  }

  // Approval Operations
  @Post(':id/approve')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.APPROVE })
  @ApiOperation({
    summary: 'Approve purchase order',
    description: 'Menyetujui purchase order yang sedang pending approval'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order berhasil di-approve',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat di-approve pada status ini',
  })
  async approve(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) approveDto: ApprovePurchaseOrderDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.approve(
      tenantId,
      id,
      approveDto,
      user.id,
    );

    return {
      success: true,
      message: 'Purchase order berhasil di-approve',
      data: result,
    };
  }

  @Post(':id/reject')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.APPROVE })
  @ApiOperation({
    summary: 'Reject purchase order',
    description: 'Menolak purchase order yang sedang pending approval'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order berhasil di-reject',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat di-reject pada status ini',
  })
  async reject(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) rejectDto: RejectPurchaseOrderDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.reject(
      tenantId,
      id,
      rejectDto,
      user.id,
    );

    return {
      success: true,
      message: 'Purchase order berhasil di-reject',
      data: result,
    };
  }

  @Post(':id/send-to-supplier')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Kirim purchase order ke supplier',
    description: 'Mengirim purchase order yang sudah approved ke supplier via email dengan PDF attachment'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order berhasil dikirim ke supplier',
    type: PurchaseOrder,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat dikirim pada status ini',
  })
  async sendToSupplier(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrder;
  }> {
    const result = await this.purchaseOrdersService.sendToSupplier(
      tenantId,
      id,
      user.id,
    );

    return {
      success: true,
      message: 'Purchase order berhasil dikirim ke supplier',
      data: result,
    };
  }

  // Item Management Operations
  @Post(':id/items')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Tambah item ke purchase order',
    description: 'Menambahkan item baru ke purchase order yang masih bisa diedit'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Item berhasil ditambahkan',
    type: PurchaseOrderItem,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat diedit pada status ini',
  })
  async addItem(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) addItemDto: AddPurchaseOrderItemDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrderItem;
  }> {
    const result = await this.purchaseOrdersService.addItem(
      tenantId,
      id,
      addItemDto,
      user.id,
    );

    return {
      success: true,
      message: 'Item berhasil ditambahkan',
      data: result,
    };
  }

  @Put(':id/items/:itemId')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Update item purchase order',
    description: 'Mengupdate item dalam purchase order yang masih bisa diedit'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'itemId',
    description: 'ID item',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item berhasil diupdate',
    type: PurchaseOrderItem,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat diedit pada status ini',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item tidak ditemukan',
  })
  async updateItem(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(ValidationPipe) updateItemDto: UpdatePurchaseOrderItemDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrderItem;
  }> {
    const result = await this.purchaseOrdersService.updateItem(
      tenantId,
      id,
      itemId,
      updateItemDto,
      user.id,
    );

    return {
      success: true,
      message: 'Item berhasil diupdate',
      data: result,
    };
  }

  @Delete(':id/items/:itemId')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Hapus item dari purchase order',
    description: 'Menghapus item dari purchase order yang masih bisa diedit. Minimal harus ada 1 item tersisa'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'itemId',
    description: 'ID item',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item berhasil dihapus',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Purchase order harus memiliki minimal 1 item',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Purchase order tidak dapat diedit pada status ini',
  })
  async removeItem(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    await this.purchaseOrdersService.removeItem(tenantId, id, itemId, user.id);

    return {
      success: true,
      message: 'Item berhasil dihapus',
    };
  }

  @Post(':id/items/:itemId/receive')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Terima item dari supplier',
    description: 'Mencatat penerimaan item dari supplier. Akan mengupdate status PO secara otomatis'
  })
  @ApiParam({
    name: 'id',
    description: 'ID purchase order',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'itemId',
    description: 'ID item',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Penerimaan item berhasil dicatat',
    type: PurchaseOrderItem,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Quantity yang diterima melebihi yang dipesan',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Item tidak ditemukan',
  })
  async receiveItem(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(ValidationPipe) receiveDto: ReceiveItemDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: PurchaseOrderItem;
  }> {
    const result = await this.purchaseOrdersService.receiveItem(
      tenantId,
      id,
      itemId,
      receiveDto,
      user.id,
    );

    return {
      success: true,
      message: 'Penerimaan item berhasil dicatat',
      data: result,
    };
  }

  // Bulk Operations
  @Post('bulk/create')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.CREATE })
  @ApiOperation({
    summary: 'Bulk create purchase orders',
    description: 'Membuat multiple purchase orders sekaligus'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bulk creation berhasil',
    type: BulkPurchaseOrderResponseDto,
  })
  async bulkCreate(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Body(ValidationPipe) bulkCreateDto: BulkCreatePurchaseOrderDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: BulkPurchaseOrderResponseDto;
  }> {
    const result = await this.purchaseOrdersService.bulkCreate(
      tenantId,
      bulkCreateDto,
      user.id,
    );

    return {
      success: true,
      message: `Bulk creation selesai: ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  @Post('bulk/approve')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.APPROVE })
  @ApiOperation({
    summary: 'Bulk approve/reject purchase orders',
    description: 'Approve atau reject multiple purchase orders sekaligus'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk approval berhasil',
    type: BulkApprovalResponseDto,
  })
  async bulkApprove(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Body(ValidationPipe) bulkApprovalDto: BulkApprovalDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: BulkApprovalResponseDto;
  }> {
    const result = await this.purchaseOrdersService.bulkApprove(
      tenantId,
      bulkApprovalDto,
      user.id,
    );

    const action = bulkApprovalDto.action === 'approve' ? 'approval' : 'rejection';

    return {
      success: true,
      message: `Bulk ${action} selesai: ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  @Post('bulk/send-to-supplier')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE })
  @ApiOperation({
    summary: 'Bulk send to supplier',
    description: 'Mengirim multiple purchase orders ke supplier sekaligus'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk sending berhasil',
    type: BulkPurchaseOrderResponseDto,
  })
  async bulkSendToSupplier(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Body(ValidationPipe) bulkSendDto: BulkSendToSupplierDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: BulkPurchaseOrderResponseDto;
  }> {
    const result = await this.purchaseOrdersService.bulkSendToSupplier(
      tenantId,
      bulkSendDto,
      user.id,
    );

    return {
      success: true,
      message: `Bulk sending selesai: ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  // Export/Import Operations
  @Post('export')
  @Permissions({ resource: PermissionResource.SUPPLIERS, action: PermissionAction.EXPORT })
  @ApiOperation({
    summary: 'Export purchase orders',
    description: 'Export purchase orders ke file Excel, CSV, atau PDF'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export berhasil, file akan dikirim via email atau download link',
  })
  async export(
    @Tenant() tenantId: string,
    @GetUser() user: User,
    @Body(ValidationPipe) exportDto: ExportPurchaseOrdersDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      downloadUrl?: string;
      emailSent?: boolean;
    };
  }> {
    // Implementation akan ditambahkan di service
    return {
      success: true,
      message: 'Export sedang diproses, file akan dikirim via email',
      data: {
        emailSent: true,
      },
    };
  }
}