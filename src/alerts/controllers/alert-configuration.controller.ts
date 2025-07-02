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

import { AlertConfigurationService } from '../services/alert-configuration.service';
import { CreateAlertConfigurationDto } from '../dto/create-alert-configuration.dto';
import { UpdateAlertConfigurationDto } from '../dto/update-alert-configuration.dto';
import { AlertType } from '../entities/alert-configuration.entity';

@ApiTags('Alert Configuration')
@Controller('alert-configurations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'x-tenant-id',
  description: 'Tenant ID untuk multi-tenant API',
  required: true,
})
export class AlertConfigurationController {
  constructor(
    private readonly alertConfigService: AlertConfigurationService,
  ) {}

  @Post()
  @RequirePermissions('settings:update')
  @ApiOperation({ 
    summary: 'Create alert configuration',
    description: 'Buat konfigurasi alert baru untuk tenant' 
  })
  @ApiResponse({
    status: 201,
    description: 'Alert configuration berhasil dibuat',
  })
  @ApiResponse({
    status: 409,
    description: 'Konfigurasi alert sudah ada',
  })
  async create(
    @Body() createDto: CreateAlertConfigurationDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const configuration = await this.alertConfigService.create(
      tenantId,
      createDto,
      user.id,
    );

    return {
      success: true,
      data: configuration,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Get()
  @RequirePermissions('settings:read')
  @ApiOperation({ 
    summary: 'Get alert configurations',
    description: 'Dapatkan daftar konfigurasi alert dengan filter dan pagination' 
  })
  @ApiQuery({ name: 'alertType', required: false, enum: AlertType })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'isEnabled', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Daftar konfigurasi alert berhasil diambil',
  })
  async findAll(
    @Query('alertType') alertType?: AlertType,
    @Query('productId') productId?: string,
    @Query('locationId') locationId?: string,
    @Query('isEnabled') isEnabled?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const result = await this.alertConfigService.findAll(tenantId, {
      alertType,
      productId,
      locationId,
      isEnabled,
      page,
      limit,
    });

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
  @RequirePermissions('settings:read')
  @ApiOperation({ 
    summary: 'Get alert configuration statistics',
    description: 'Dapatkan statistik konfigurasi alert untuk tenant' 
  })
  @ApiResponse({
    status: 200,
    description: 'Statistik konfigurasi alert berhasil diambil',
  })
  async getStatistics(
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const statistics = await this.alertConfigService.getStatistics(tenantId);

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
  @RequirePermissions('settings:read')
  @ApiOperation({ 
    summary: 'Get alert configuration by ID',
    description: 'Dapatkan detail konfigurasi alert berdasarkan ID' 
  })
  @ApiResponse({
    status: 200,
    description: 'Detail konfigurasi alert berhasil diambil',
  })
  @ApiResponse({
    status: 404,
    description: 'Konfigurasi alert tidak ditemukan',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const configuration = await this.alertConfigService.findOne(tenantId, id);

    return {
      success: true,
      data: configuration,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id')
  @RequirePermissions('settings:update')
  @ApiOperation({ 
    summary: 'Update alert configuration',
    description: 'Update konfigurasi alert berdasarkan ID' 
  })
  @ApiResponse({
    status: 200,
    description: 'Konfigurasi alert berhasil diupdate',
  })
  @ApiResponse({
    status: 404,
    description: 'Konfigurasi alert tidak ditemukan',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAlertConfigurationDto,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const configuration = await this.alertConfigService.update(
      tenantId,
      id,
      updateDto,
      user.id,
    );

    return {
      success: true,
      data: configuration,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Patch(':id/toggle')
  @RequirePermissions('settings:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Toggle alert configuration enabled status',
    description: 'Toggle status enabled/disabled untuk konfigurasi alert' 
  })
  @ApiResponse({
    status: 200,
    description: 'Status konfigurasi alert berhasil di-toggle',
  })
  async toggleEnabled(
    @Param('id', ParseUUIDPipe) id: string,
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const configuration = await this.alertConfigService.toggleEnabled(
      tenantId,
      id,
      user.id,
    );

    return {
      success: true,
      data: configuration,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Delete(':id')
  @RequirePermissions('settings:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete alert configuration',
    description: 'Hapus konfigurasi alert berdasarkan ID' 
  })
  @ApiResponse({
    status: 204,
    description: 'Konfigurasi alert berhasil dihapus',
  })
  @ApiResponse({
    status: 404,
    description: 'Konfigurasi alert tidak ditemukan',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetTenant() tenantId: string,
  ) {
    await this.alertConfigService.remove(tenantId, id);
  }

  @Post('initialize-defaults')
  @RequirePermissions('settings:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Initialize default alert configurations',
    description: 'Inisialisasi konfigurasi alert default untuk tenant' 
  })
  @ApiResponse({
    status: 200,
    description: 'Konfigurasi alert default berhasil diinisialisasi',
  })
  async initializeDefaults(
    @GetTenant() tenantId: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    await this.alertConfigService.initializeDefaultConfigurations(tenantId, user.id);

    return {
      success: true,
      data: {
        message: 'Konfigurasi alert default berhasil diinisialisasi',
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Get('for-alert/:alertType')
  @RequirePermissions('inventory:read')
  @ApiOperation({ 
    summary: 'Get configuration for specific alert',
    description: 'Dapatkan konfigurasi untuk alert type, product, dan location tertentu' 
  })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Konfigurasi alert berhasil diambil',
  })
  async getConfigurationForAlert(
    @Param('alertType') alertType: AlertType,
    @Query('productId') productId?: string,
    @Query('locationId') locationId?: string,
    @GetTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const configuration = await this.alertConfigService.getConfigurationForAlert(
      tenantId,
      alertType,
      productId,
      locationId,
    );

    return {
      success: true,
      data: configuration,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }
}