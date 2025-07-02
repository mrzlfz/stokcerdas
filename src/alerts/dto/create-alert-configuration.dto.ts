import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AlertType, AlertSeverity } from '../entities/alert-configuration.entity';

class AlertConfigurationData {
  @ApiPropertyOptional({ description: 'Reorder point untuk stock alerts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Warning days before expiry' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiryWarningDays?: number;

  @ApiPropertyOptional({ description: 'Maintenance message' })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiPropertyOptional({ description: 'Scheduled maintenance time (ISO string)' })
  @IsOptional()
  @IsString()
  scheduledMaintenanceAt?: string;

  @ApiPropertyOptional({ description: 'Enable push notifications', default: true })
  @IsOptional()
  @IsBoolean()
  enablePushNotification?: boolean;

  @ApiPropertyOptional({ description: 'Enable email notifications', default: false })
  @IsOptional()
  @IsBoolean()
  enableEmailNotification?: boolean;

  @ApiPropertyOptional({ description: 'Enable SMS notifications', default: false })
  @IsOptional()
  @IsBoolean()
  enableSmsNotification?: boolean;

  @ApiPropertyOptional({ description: 'Allow snoozing this alert', default: true })
  @IsOptional()
  @IsBoolean()
  allowSnooze?: boolean;

  @ApiPropertyOptional({ description: 'Maximum snooze hours', default: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168) // 1 week
  maxSnoozeHours?: number;

  @ApiPropertyOptional({ description: 'Hours before escalation' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  escalateAfterHours?: number;

  @ApiPropertyOptional({ description: 'User ID to escalate to' })
  @IsOptional()
  @IsString()
  escalateToUserId?: string;
}

class QuietHours {
  @ApiProperty({ description: 'Start time in HH:mm format', example: '22:00' })
  @IsString()
  start: string;

  @ApiProperty({ description: 'End time in HH:mm format', example: '08:00' })
  @IsString()
  end: string;
}

class ScheduleConfiguration {
  @ApiProperty({ description: 'Enable scheduled alerts', default: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Cron expression for recurring alerts' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ description: 'Timezone for schedule', default: 'Asia/Jakarta' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Quiet hours configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHours)
  quietHours?: QuietHours;

  @ApiPropertyOptional({ description: 'Days of week (0-6, Sunday-Saturday)', example: [1, 2, 3, 4, 5] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  days?: number[];
}

export class CreateAlertConfigurationDto {
  @ApiProperty({ 
    description: 'Alert type',
    enum: AlertType,
    example: AlertType.LOW_STOCK
  })
  @IsEnum(AlertType)
  alertType: AlertType;

  @ApiProperty({ 
    description: 'Alert severity',
    enum: AlertSeverity,
    default: AlertSeverity.WARNING
  })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiPropertyOptional({ description: 'Enable this alert configuration', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Product ID untuk product-specific configuration' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Location ID untuk location-specific configuration' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Alert configuration data' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AlertConfigurationData)
  configuration?: AlertConfigurationData;

  @ApiPropertyOptional({ description: 'User IDs yang akan menerima alert' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientUserIds?: string[];

  @ApiPropertyOptional({ description: 'Roles yang akan menerima alert' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientRoles?: string[];

  @ApiPropertyOptional({ description: 'Email addresses untuk external notifications' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientEmails?: string[];

  @ApiPropertyOptional({ description: 'Schedule configuration untuk recurring alerts' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleConfiguration)
  schedule?: ScheduleConfiguration;

  @ApiPropertyOptional({ description: 'Description of alert configuration' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}