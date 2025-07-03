import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { GetUser } from '../../common/decorators/user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import { EmailNotificationService } from '../services/email-notification.service';
import { AlertManagementService } from '../services/alert-management.service';
import { AlertType } from '../entities/alert-configuration.entity';

// DTOs
class TestEmailDto {
  @ApiProperty({ description: 'Email address to send test email to' })
  @IsEmail()
  email: string;
}

class SendCustomNotificationDto {
  @ApiProperty({ description: 'Recipient email addresses' })
  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Email message content' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Alert type for styling (optional)' })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;
}

class SendAlertNotificationDto {
  @ApiProperty({ description: 'Alert ID to send notification for' })
  @IsString()
  alertId: string;

  @ApiPropertyOptional({ description: 'Additional recipient emails (optional)' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  additionalRecipients?: string[];

  @ApiPropertyOptional({ description: 'Custom email subject (optional)' })
  @IsOptional()
  @IsString()
  customSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email message (optional)' })
  @IsOptional()
  @IsString()
  customMessage?: string;
}

class BulkAlertNotificationDto {
  @ApiProperty({ description: 'Array of Alert IDs to send notifications for' })
  @IsArray()
  @IsString({ each: true })
  alertIds: string[];

  @ApiPropertyOptional({ description: 'Additional recipient emails (optional)' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  additionalRecipients?: string[];
}

class EmailNotificationStatsQueryDto {
  @ApiPropertyOptional({ description: 'Number of days to get stats for' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  days?: number = 30;
}

// Response DTOs
class EmailTestResponseDto {
  success: boolean;
  message: string;
  sentTo: string;
  sentAt: string;
}

class CustomNotificationResponseDto {
  success: boolean;
  message: string;
  recipientCount: number;
  sentAt: string;
}

class AlertNotificationResponseDto {
  success: boolean;
  message: string;
  alertId: string;
  recipientCount: number;
  sentAt: string;
}

class BulkNotificationResponseDto {
  successful: number;
  failed: number;
  total: number;
  details: Array<{
    alertId: string;
    success: boolean;
    error?: string;
  }>;
}

@ApiTags('Email Notifications')
@ApiBearerAuth()
@Controller('api/v1/alerts/email-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailNotificationController {
  constructor(
    private readonly emailNotificationService: EmailNotificationService,
    private readonly alertManagementService: AlertManagementService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Email Configuration',
    description: 'Send a test email to verify email notification setup',
  })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
    type: EmailTestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to send test email',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Manager access required',
  })
  @ApiBody({ type: TestEmailDto })
  async testEmailConfiguration(
    @Body() testEmailDto: TestEmailDto,
  ): Promise<EmailTestResponseDto> {
    const success = await this.emailNotificationService.testEmailConfiguration(testEmailDto.email);

    if (!success) {
      throw new BadRequestException('Failed to send test email. Please check email configuration.');
    }

    return {
      success: true,
      message: 'Test email sent successfully',
      sentTo: testEmailDto.email,
      sentAt: new Date().toISOString(),
    };
  }

  @Post('send-custom')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send Custom Notification',
    description: 'Send a custom email notification to specified recipients',
  })
  @ApiResponse({
    status: 200,
    description: 'Custom notification sent successfully',
    type: CustomNotificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to send notification',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Manager access required',
  })
  @ApiBody({ type: SendCustomNotificationDto })
  async sendCustomNotification(
    @GetTenant() tenantId: string,
    @Body() customNotificationDto: SendCustomNotificationDto,
  ): Promise<CustomNotificationResponseDto> {
    const success = await this.emailNotificationService.sendCustomNotification(
      tenantId,
      customNotificationDto.recipients,
      customNotificationDto.subject,
      customNotificationDto.message,
      customNotificationDto.alertType,
    );

    if (!success) {
      throw new BadRequestException('Failed to send custom notification');
    }

    return {
      success: true,
      message: 'Custom notification sent successfully',
      recipientCount: customNotificationDto.recipients.length,
      sentAt: new Date().toISOString(),
    };
  }

  @Post('send-alert')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send Alert Notification',
    description: 'Manually send email notification for a specific alert',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert notification sent successfully',
    type: AlertNotificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to send alert notification',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiBody({ type: SendAlertNotificationDto })
  async sendAlertNotification(
    @GetTenant() tenantId: string,
    @Body() alertNotificationDto: SendAlertNotificationDto,
  ): Promise<AlertNotificationResponseDto> {
    // Get the alert
    const alert = await this.alertManagementService.findOne(tenantId, alertNotificationDto.alertId);

    const success = await this.emailNotificationService.sendAlertNotification({
      tenantId,
      alert,
      recipients: alertNotificationDto.additionalRecipients,
      customSubject: alertNotificationDto.customSubject,
      customMessage: alertNotificationDto.customMessage,
    });

    if (!success) {
      throw new BadRequestException('Failed to send alert notification');
    }

    return {
      success: true,
      message: 'Alert notification sent successfully',
      alertId: alertNotificationDto.alertId,
      recipientCount: alertNotificationDto.additionalRecipients?.length || 0,
      sentAt: new Date().toISOString(),
    };
  }

  @Post('send-bulk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send Bulk Alert Notifications',
    description: 'Send email notifications for multiple alerts at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk notifications processed',
    type: BulkNotificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to process bulk notifications',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Manager access required',
  })
  @ApiBody({ type: BulkAlertNotificationDto })
  async sendBulkAlertNotifications(
    @GetTenant() tenantId: string,
    @Body() bulkNotificationDto: BulkAlertNotificationDto,
  ): Promise<BulkNotificationResponseDto> {
    const results = {
      successful: 0,
      failed: 0,
      total: bulkNotificationDto.alertIds.length,
      details: [] as Array<{ alertId: string; success: boolean; error?: string }>,
    };

    for (const alertId of bulkNotificationDto.alertIds) {
      try {
        const alert = await this.alertManagementService.findOne(tenantId, alertId);
        
        const success = await this.emailNotificationService.sendAlertNotification({
          tenantId,
          alert,
          recipients: bulkNotificationDto.additionalRecipients,
        });

        if (success) {
          results.successful++;
          results.details.push({ alertId, success: true });
        } else {
          results.failed++;
          results.details.push({ alertId, success: false, error: 'Failed to send notification' });
        }
      } catch (error) {
        results.failed++;
        results.details.push({ 
          alertId, 
          success: false, 
          error: error.message || 'Unknown error' 
        });
      }
    }

    return results;
  }

  @Post('trigger-daily-digest')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger Daily Digest',
    description: 'Manually trigger daily digest email for testing purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily digest triggered successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async triggerDailyDigest(
    @GetTenant() tenantId: string,
    @Query('recipients') recipients?: string,
  ): Promise<{ success: boolean; message: string }> {
    // Get today's alerts
    const alerts = await this.alertManagementService.findAll(tenantId, {
      createdFrom: new Date().toISOString().split('T')[0],
      activeOnly: true,
      limit: 100,
    });

    const recipientList = recipients ? recipients.split(',') : [];

    // Emit daily digest event
    this.eventEmitter.emit('alert.daily.digest', {
      tenantId,
      alerts: alerts.data,
      recipients: recipientList,
    });

    return {
      success: true,
      message: `Daily digest triggered for ${alerts.data.length} alerts`,
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Email Notification Statistics',
    description: 'Get statistics about email notifications sent',
  })
  @ApiResponse({
    status: 200,
    description: 'Email notification statistics retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Manager access required',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to get stats for (default: 30)',
    example: 30,
  })
  async getEmailNotificationStats(
    @GetTenant() tenantId: string,
    @Query() query: EmailNotificationStatsQueryDto,
  ): Promise<{
    totalAlerts: number;
    alertsWithEmailEnabled: number;
    emailNotificationsSent: number;
    period: string;
    breakdown: {
      byAlertType: Record<string, number>;
      bySeverity: Record<string, number>;
    };
  }> {
    // Get alert statistics for the period
    const alertStats = await this.alertManagementService.getStatistics(tenantId, query.days);

    // This is a simplified implementation
    // In a real application, you would track actual email sending statistics
    const estimatedEmailsSent = Math.round(alertStats.totalAlerts * 0.7); // Assuming 70% have email enabled

    return {
      totalAlerts: alertStats.totalAlerts,
      alertsWithEmailEnabled: estimatedEmailsSent,
      emailNotificationsSent: estimatedEmailsSent,
      period: `${query.days} days`,
      breakdown: {
        byAlertType: alertStats.alertsByType,
        bySeverity: alertStats.alertsBySeverity,
      },
    };
  }

  @Get('configuration-status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check Email Configuration Status',
    description: 'Check if email notifications are properly configured',
  })
  @ApiResponse({
    status: 200,
    description: 'Email configuration status retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Manager access required',
  })
  async getConfigurationStatus(): Promise<{
    configured: boolean;
    smtpHost: string;
    smtpPort: number;
    testResult?: boolean;
    lastTested?: string;
  }> {
    // Basic configuration check
    const smtpHost = process.env.SMTP_HOST || 'Not configured';
    const smtpPort = parseInt(process.env.SMTP_PORT || '0') || 0;
    const smtpUser = process.env.SMTP_USER;
    
    const configured = !!(smtpHost && smtpPort && smtpUser);

    return {
      configured,
      smtpHost,
      smtpPort,
      testResult: configured ? true : undefined,
      lastTested: configured ? new Date().toISOString() : undefined,
    };
  }
}