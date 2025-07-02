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

import { InventoryTransactionsService } from '../services/inventory-transactions.service';
import { InventoryItemsService } from '../services/inventory-items.service';
import { InventoryTransactionQueryDto } from '../dto/inventory-query.dto';
import {
  CreateInventoryTransferDto,
  UpdateTransferStatusDto,
  TransferReceiptDto,
} from '../dto/inventory-transfer.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { PermissionAction, PermissionResource } from '../../auth/entities/permission.entity';

@ApiTags('Inventory Transactions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory/transactions')
export class InventoryTransactionsController {
  constructor(
    private readonly transactionsService: InventoryTransactionsService,
    private readonly inventoryItemsService: InventoryItemsService,
  ) {}

  @Get()
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan daftar transaksi inventory dengan filter dan pagination' })
  @ApiResponse({ status: 200, description: 'Daftar transaksi berhasil didapat' })
  async findAll(
    @Tenant() tenantId: string,
    @Query() query: InventoryTransactionQueryDto,
  ) {
    const result = await this.transactionsService.findAll(tenantId, query);
    
    return {
      success: true,
      message: 'Daftar transaksi inventory berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('stats')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan statistik transaksi inventory' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Tanggal mulai periode' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Tanggal akhir periode' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter untuk lokasi spesifik' })
  @ApiResponse({ status: 200, description: 'Statistik transaksi berhasil didapat' })
  async getStats(
    @Tenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
  ) {
    const stats = await this.transactionsService.getTransactionStats(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      locationId,
    );
    
    return {
      success: true,
      message: 'Statistik transaksi inventory berhasil didapat',
      data: stats,
    };
  }

  @Get(':id')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan detail transaksi inventory' })
  @ApiParam({ name: 'id', description: 'ID transaksi' })
  @ApiResponse({ status: 200, description: 'Detail transaksi berhasil didapat' })
  @ApiResponse({ status: 404, description: 'Transaksi tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const transaction = await this.transactionsService.findOne(tenantId, id);
    
    return {
      success: true,
      message: 'Detail transaksi inventory berhasil didapat',
      data: transaction,
    };
  }

  @Patch(':id/status')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update status transaksi' })
  @ApiParam({ name: 'id', description: 'ID transaksi' })
  @ApiResponse({ status: 200, description: 'Status transaksi berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Transaksi tidak ditemukan' })
  async updateStatus(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateTransferStatusDto,
  ) {
    const transaction = await this.transactionsService.updateTransactionStatus(
      tenantId,
      id,
      updateStatusDto,
      userId,
    );
    
    return {
      success: true,
      message: 'Status transaksi berhasil diupdate',
      data: transaction,
    };
  }

  @Post(':id/cancel')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Cancel transaksi' })
  @ApiParam({ name: 'id', description: 'ID transaksi' })
  @ApiResponse({ status: 200, description: 'Transaksi berhasil dibatalkan' })
  @ApiResponse({ status: 400, description: 'Transaksi tidak dapat dibatalkan' })
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelData: { reason: string },
  ) {
    const transaction = await this.transactionsService.cancelTransaction(
      tenantId,
      id,
      cancelData.reason,
      userId,
    );
    
    return {
      success: true,
      message: 'Transaksi berhasil dibatalkan',
      data: transaction,
    };
  }

  // Transfer Operations
  @Post('transfers')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Buat transfer inventory antar lokasi' })
  @ApiResponse({ status: 201, description: 'Transfer berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 404, description: 'Produk atau lokasi tidak ditemukan' })
  async createTransfer(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createTransferDto: CreateInventoryTransferDto,
  ) {
    const result = await this.transactionsService.createTransferTransactions(
      tenantId,
      createTransferDto,
      userId,
    );
    
    return {
      success: true,
      message: 'Transfer inventory berhasil dibuat',
      data: {
        outTransactions: result.outTransactions,
        inTransactions: result.inTransactions,
        totalItems: createTransferDto.items.length,
      },
    };
  }

  @Post('transfers/receipt')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Process penerimaan transfer inventory' })
  @ApiResponse({ status: 200, description: 'Penerimaan transfer berhasil diproses' })
  @ApiResponse({ status: 404, description: 'Transfer tidak ditemukan' })
  async processTransferReceipt(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() receiptDto: TransferReceiptDto,
  ) {
    const result = await this.transactionsService.processTransferReceipt(
      tenantId,
      receiptDto,
      userId,
    );
    
    return {
      success: true,
      message: 'Penerimaan transfer berhasil diproses',
      data: {
        processedTransactions: result.processedTransactions,
        discrepancies: result.discrepancies,
        hasDiscrepancies: result.discrepancies.length > 0,
      },
    };
  }

  // Advanced Transfer Operations
  @Post('transfers/inter-location')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Transfer produk individual antar lokasi (quick transfer)' })
  @ApiResponse({ status: 200, description: 'Transfer berhasil dilakukan' })
  async quickTransfer(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() transferData: {
      productId: string;
      sourceLocationId: string;
      destinationLocationId: string;
      quantity: number;
      reason: string;
      notes?: string;
    },
  ) {
    // Create a quick transfer DTO
    const transferDto: CreateInventoryTransferDto = {
      sourceLocationId: transferData.sourceLocationId,
      destinationLocationId: transferData.destinationLocationId,
      items: [{
        productId: transferData.productId,
        quantity: transferData.quantity,
      }],
      reason: transferData.reason as any,
      notes: transferData.notes,
    };

    const result = await this.transactionsService.createTransferTransactions(
      tenantId,
      transferDto,
      userId,
    );

    // Get source inventory item to deduct
    const sourceItem = await this.inventoryItemsService.findByProductAndLocation(
      tenantId,
      transferData.productId,
      transferData.sourceLocationId,
    );

    if (!sourceItem) {
      throw new Error('Source inventory item tidak ditemukan');
    }

    if (sourceItem.quantityAvailable < transferData.quantity) {
      throw new Error('Stok tersedia tidak mencukupi untuk transfer');
    }

    // Deduct from source
    await this.inventoryItemsService.adjustStock(
      tenantId,
      {
        productId: transferData.productId,
        locationId: transferData.sourceLocationId,
        adjustmentType: 'negative' as any,
        quantity: transferData.quantity,
        reason: 'other' as any,
        notes: `Transfer ke ${transferData.destinationLocationId}: ${transferData.notes}`,
        referenceType: 'transfer',
        referenceId: result.outTransactions[0].id,
      },
      userId,
    );

    // Add to destination (or create new inventory item)
    let destinationItem = await this.inventoryItemsService.findByProductAndLocation(
      tenantId,
      transferData.productId,
      transferData.destinationLocationId,
    );

    if (!destinationItem) {
      // Create new inventory item at destination
      destinationItem = await this.inventoryItemsService.create(
        tenantId,
        {
          productId: transferData.productId,
          locationId: transferData.destinationLocationId,
          quantityOnHand: 0,
          averageCost: sourceItem.averageCost,
        },
        userId,
      );
    }

    // Add to destination
    await this.inventoryItemsService.adjustStock(
      tenantId,
      {
        productId: transferData.productId,
        locationId: transferData.destinationLocationId,
        adjustmentType: 'positive' as any,
        quantity: transferData.quantity,
        reason: 'other' as any,
        notes: `Transfer dari ${transferData.sourceLocationId}: ${transferData.notes}`,
        referenceType: 'transfer',
        referenceId: result.inTransactions[0].id,
        unitCost: sourceItem.averageCost,
      },
      userId,
    );

    return {
      success: true,
      message: 'Transfer antar lokasi berhasil dilakukan',
      data: {
        sourceTransaction: result.outTransactions[0],
        destinationTransaction: result.inTransactions[0],
        transferredQuantity: transferData.quantity,
      },
    };
  }

  @Get('transfers/pending')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan daftar transfer yang pending' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter untuk lokasi tertentu' })
  @ApiResponse({ status: 200, description: 'Daftar transfer pending berhasil didapat' })
  async getPendingTransfers(
    @Tenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    const query: InventoryTransactionQueryDto = {
      transactionType: 'transfer_in',
      status: 'pending',
      locationId,
      sortBy: 'transactionDate',
      sortOrder: 'DESC',
      limit: 100,
    };

    const result = await this.transactionsService.findAll(tenantId, query);
    
    return {
      success: true,
      message: 'Daftar transfer pending berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('movements/product/:productId')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan riwayat pergerakan stok untuk produk tertentu' })
  @ApiParam({ name: 'productId', description: 'ID produk' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter untuk lokasi tertentu' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Tanggal mulai filter' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Tanggal akhir filter' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit hasil', type: Number })
  @ApiResponse({ status: 200, description: 'Riwayat pergerakan stok berhasil didapat' })
  async getProductMovements(
    @Tenant() tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    const query: InventoryTransactionQueryDto = {
      productId,
      locationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy: 'transactionDate',
      sortOrder: 'DESC',
      limit: limit || 50,
    };

    const result = await this.transactionsService.findAll(tenantId, query);
    
    return {
      success: true,
      message: 'Riwayat pergerakan stok berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('audit-trail/location/:locationId')
  @Permissions({ resource: PermissionResource.INVENTORY, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan audit trail untuk lokasi tertentu' })
  @ApiParam({ name: 'locationId', description: 'ID lokasi' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Tanggal mulai filter' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Tanggal akhir filter' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit hasil', type: Number })
  @ApiResponse({ status: 200, description: 'Audit trail berhasil didapat' })
  async getLocationAuditTrail(
    @Tenant() tenantId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    const query: InventoryTransactionQueryDto = {
      locationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy: 'transactionDate',
      sortOrder: 'DESC',
      limit: limit || 100,
    };

    const result = await this.transactionsService.findAll(tenantId, query);
    
    return {
      success: true,
      message: 'Audit trail lokasi berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }
}