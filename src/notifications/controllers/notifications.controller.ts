import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';

import { NotificationsService, CreateNotificationDto } from '../services/notifications.service';
import { Notification } from '../entities/notification.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create notification',
    description: 'Creates a new notification',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  async create(
    @Body() createDto: CreateNotificationDto,
    @CurrentTenant() tenantId: string,
  ): Promise<Notification> {
    return this.notificationsService.create({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description: 'Gets notifications for the current user',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of notifications to return' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getUserNotifications(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit: number = 50,
  ): Promise<Notification[]> {
    return this.notificationsService.findByUser(userId, tenantId, limit);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Gets the count of unread notifications for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount(
    @CurrentUser('id') userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(userId, tenantId);
    return { count };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get notification by ID',
    description: 'Gets a specific notification by ID',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Notification> {
    return this.notificationsService.findById(id, tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Marks a notification as read',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ success: boolean }> {
    await this.notificationsService.markAsRead(id, tenantId);
    return { success: true };
  }
}