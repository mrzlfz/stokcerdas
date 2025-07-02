import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { User } from '../../users/entities/user.entity';

import { AlertManagementService } from '../services/alert-management.service';
import {
  AcknowledgeAlertDto,
  ResolveAlertDto,
  DismissAlertDto,
  SnoozeAlertDto,
  EscalateAlertDto,
  UpdateAlertPriorityDto,
  AddAlertTagDto,
  RemoveAlertTagDto,
  BulkAlertActionDto,
  AlertQueryDto,
  CreateSystemMaintenanceAlertDto,
} from '../dto/alert-management.dto';

@ApiTags('Alert Management')
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant ID untuk multi-tenant API',
  required: true,
})
export class AlertManagementController {
  constructor(
    private readonly alertManagementService: AlertManagementService,
  ) {}

  @Get()
  @RequirePermissions('inventory:read')
  @ApiOperation({ 
    summary: 'Get alerts',
    description: 'Dapatkan daftar alert dengan filter dan pagination' 
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar alert berhasil diambil',
  })
  async findAll(
    @Query() query: AlertQueryDto,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const result = await this.alertManagementService.findAll(tenantId, query);

    return {
      success: true,
      data: result.data,
      meta: {
        ...result.meta,
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Get('statistics')
  @RequirePermissions('inventory:read')
  @ApiOperation({ 
    summary: 'Get alert statistics',
    description: 'Dapatkan statistik alert untuk tenant' 
  })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Jumlah hari untuk statistik (default: 30)' })
  @ApiResponse({
    status: 200,
    description: 'Statistik alert berhasil diambil',
  })
  async getStatistics(
    @Query('days') days: number = 30,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const statistics = await this.alertManagementService.getStatistics(tenantId, days);

    return {
      success: true,
      data: statistics,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Get(':id')
  @RequirePermissions('inventory:read')
  @ApiOperation({ 
    summary: 'Get alert by ID',
    description: 'Dapatkan detail alert berdasarkan ID' 
  })
  @ApiResponse({
    status: 200,
    description: 'Detail alert berhasil diambil',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert tidak ditemukan',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    // Mark as viewed when user accesses alert detail
    const alert = await this.alertManagementService.markAsViewed(tenantId, id, user.id);

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/acknowledge')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Acknowledge alert',
    description: 'Acknowledge alert untuk menandai bahwa alert sudah dilihat dan akan ditangani' 
  })
  @ApiResponse({
    status: 200,
    description: 'Alert berhasil di-acknowledge',
  })
  @ApiResponse({
    status: 400,
    description: 'Alert tidak dapat di-acknowledge',
  })
  async acknowledgeAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() acknowledgeDto: AcknowledgeAlertDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.acknowledgeAlert(
      tenantId,
      id,
      acknowledgeDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/resolve')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Resolve alert',
    description: 'Resolve alert setelah masalah selesai ditangani' 
  })
  @ApiResponse({
    status: 200,
    description: 'Alert berhasil di-resolve',
  })
  @ApiResponse({
    status: 400,
    description: 'Alert tidak dapat di-resolve',
  })
  async resolveAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() resolveDto: ResolveAlertDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.resolveAlert(
      tenantId,
      id,
      resolveDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/dismiss')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Dismiss alert',
    description: 'Dismiss alert jika alert tidak relevan atau tidak memerlukan tindakan' 
  })
  @ApiResponse({
    status: 200,
    description: 'Alert berhasil di-dismiss',
  })
  async dismissAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dismissDto: DismissAlertDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.dismissAlert(
      tenantId,
      id,
      dismissDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/snooze')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Snooze alert',
    description: 'Snooze alert untuk menyembunyikan sementara dan muncul lagi setelah durasi tertentu' 
  })
  @ApiResponse({
    status: 200,
    description: 'Alert berhasil di-snooze',
  })
  @ApiResponse({
    status: 400,
    description: 'Alert tidak dapat di-snooze',
  })
  async snoozeAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() snoozeDto: SnoozeAlertDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.snoozeAlert(
      tenantId,
      id,
      snoozeDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/escalate')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Escalate alert',
    description: 'Escalate alert ke user lain atau manager' 
  })
  @ApiResponse({
    status: 200,
    description: 'Alert berhasil di-escalate',
  })
  async escalateAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() escalateDto: EscalateAlertDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.escalateAlert(
      tenantId,
      id,
      escalateDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/priority')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update alert priority',
    description: 'Update prioritas alert' 
  })
  @ApiResponse({
    status: 200,
    description: 'Prioritas alert berhasil diupdate',
  })
  async updatePriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAlertPriorityDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.updatePriority(
      tenantId,
      id,
      updateDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Post(':id/tags')
  @RequirePermissions('inventory:update')
  @ApiOperation({ 
    summary: 'Add tag to alert',
    description: 'Tambahkan tag ke alert untuk kategorisasi' 
  })
  @ApiResponse({
    status: 200,
    description: 'Tag berhasil ditambahkan',
  })
  async addTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addTagDto: AddAlertTagDto,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.addTag(tenantId, id, addTagDto.tag);

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Delete(':id/tags')
  @RequirePermissions('inventory:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Remove tag from alert',
    description: 'Hapus tag dari alert' 
  })
  @ApiResponse({
    status: 200,
    description: 'Tag berhasil dihapus',
  })
  async removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() removeTagDto: RemoveAlertTagDto,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.removeTag(tenantId, id, removeTagDto.tag);

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Post('bulk-actions')
  @RequirePermissions('inventory:update')
  @ApiOperation({ 
    summary: 'Bulk actions on alerts',
    description: 'Lakukan action secara bulk pada multiple alerts' 
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk action berhasil dijalankan',
  })
  async bulkAction(
    @Body() bulkActionDto: BulkAlertActionDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const result = await this.alertManagementService.bulkAction(
      tenantId,
      bulkActionDto,
      user.id,
    );

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Post('system-maintenance')
  @RequirePermissions('settings:update')
  @ApiOperation({ 
    summary: 'Create system maintenance alert',
    description: 'Buat alert untuk system maintenance' 
  })
  @ApiResponse({
    status: 201,
    description: 'System maintenance alert berhasil dibuat',
  })
  async createSystemMaintenanceAlert(
    @Body() maintenanceDto: CreateSystemMaintenanceAlertDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const alert = await this.alertManagementService.createSystemMaintenanceAlert(
      tenantId,
      maintenanceDto,
      user.id,
    );

    return {
      success: true,
      data: alert,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Post('reactivate-snoozed')
  @RequirePermissions('settings:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Reactivate snoozed alerts',
    description: 'Reaktivasi alert yang sudah melewati waktu snooze (biasanya dijalankan oleh cron job)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Snoozed alerts berhasil direaktivasi',
  })
  async reactivateSnoozedAlerts(@Req() req: Request) {
    await this.alertManagementService.reactivateSnoozedAlerts();

    return {
      success: true,
      data: {
        message: 'Snoozed alerts berhasil direaktivasi',
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }
}