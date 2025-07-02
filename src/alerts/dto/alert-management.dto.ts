import { IsString, IsOptional, IsNumber, IsArray, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AlertStatus, AlertPriority } from '../entities/alert-instance.entity';

export class AcknowledgeAlertDto {
  @ApiPropertyOptional({ description: 'Notes tentang acknowledgment' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveAlertDto {
  @ApiProperty({ description: 'Notes tentang resolution' })
  @IsString()
  resolutionNotes: string;
}

export class DismissAlertDto {
  @ApiProperty({ description: 'Reason untuk dismiss alert' })
  @IsString()
  dismissalReason: string;
}

export class SnoozeAlertDto {
  @ApiProperty({ description: 'Durasi snooze dalam hours' })
  @IsNumber()
  @Min(0.5) // 30 minutes minimum
  @Max(168) // 1 week maximum
  snoozeHours: number;

  @ApiPropertyOptional({ description: 'Reason untuk snooze' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class EscalateAlertDto {
  @ApiProperty({ description: 'User ID untuk escalate alert' })
  @IsString()
  escalateTo: string;

  @ApiPropertyOptional({ description: 'Reason untuk escalation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateAlertPriorityDto {
  @ApiProperty({ 
    description: 'New alert priority',
    enum: AlertPriority
  })
  @IsEnum(AlertPriority)
  priority: AlertPriority;

  @ApiPropertyOptional({ description: 'Reason untuk priority change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddAlertTagDto {
  @ApiProperty({ description: 'Tag to add' })
  @IsString()
  tag: string;
}

export class RemoveAlertTagDto {
  @ApiProperty({ description: 'Tag to remove' })
  @IsString()
  tag: string;
}

export class BulkAlertActionDto {
  @ApiProperty({ description: 'Array of alert IDs' })
  @IsArray()
  @IsString({ each: true })
  alertIds: string[];

  @ApiProperty({ 
    description: 'Action to perform',
    enum: ['acknowledge', 'resolve', 'dismiss', 'snooze']
  })
  @IsEnum(['acknowledge', 'resolve', 'dismiss', 'snooze'])
  action: string;

  @ApiPropertyOptional({ description: 'Action-specific data' })
  @IsOptional()
  actionData?: {
    notes?: string;
    resolutionNotes?: string;
    dismissalReason?: string;
    snoozeHours?: number;
    reason?: string;
  };
}

export class AlertQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({ description: 'Filter by alert type' })
  @IsOptional()
  @IsString()
  alertType?: string;

  @ApiPropertyOptional({ description: 'Filter by severity' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(AlertPriority)
  priority?: AlertPriority;

  @ApiPropertyOptional({ description: 'Filter by product ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by location ID' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filter by created date (from)' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by created date (to)' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({ description: 'Filter by acknowledged status' })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;

  @ApiPropertyOptional({ description: 'Filter by resolved status' })
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;

  @ApiPropertyOptional({ description: 'Show only active alerts', default: false })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Show only unviewed alerts', default: false })
  @IsOptional()
  @IsBoolean()
  unviewedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Search in title and message' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateSystemMaintenanceAlertDto {
  @ApiProperty({ description: 'Maintenance title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Maintenance message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Scheduled start time (ISO string)' })
  @IsOptional()
  @IsString()
  scheduledStart?: string;

  @ApiPropertyOptional({ description: 'Scheduled end time (ISO string)' })
  @IsOptional()
  @IsString()
  scheduledEnd?: string;

  @ApiPropertyOptional({ description: 'Affected services' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedServices?: string[];

  @ApiPropertyOptional({ description: 'Severity level', default: 'warning' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ description: 'Send immediate notification', default: true })
  @IsOptional()
  @IsBoolean()
  sendImmediately?: boolean;
}