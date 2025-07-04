import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportFormat } from './report-query.dto';

export enum EmailReportType {
  INVENTORY_VALUATION = 'inventory_valuation',
  STOCK_MOVEMENT = 'stock_movement',
  LOW_STOCK = 'low_stock',
  PRODUCT_PERFORMANCE = 'product_performance',
}

export class EmailReportRequestDto {
  @ApiProperty({
    description: 'Email address to send the report to',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: EmailReportType,
    description: 'Type of report to send',
    example: EmailReportType.INVENTORY_VALUATION,
  })
  @IsEnum(EmailReportType)
  reportType: EmailReportType;

  @ApiProperty({
    enum: ReportFormat,
    description: 'Format of the report attachment',
    example: ReportFormat.PDF,
  })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiPropertyOptional({
    description: 'Custom subject for the email',
    example: 'Laporan Inventori - StokCerdas',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Custom filename for the report attachment',
    example: 'inventory-report-2025-06-30',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    description: 'Report query parameters as JSON string',
    example: '{"startDate":"2025-01-01","endDate":"2025-06-30"}',
  })
  @IsOptional()
  @IsString()
  queryParams?: string;
}

export class EmailReportResponseDto {
  @ApiProperty({
    description: 'Success status of email sending',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Status message',
    example: 'Report sent successfully to user@example.com',
  })
  message: string;

  @ApiProperty({
    description: 'Email address the report was sent to',
    example: 'user@example.com',
  })
  sentTo: string;

  @ApiProperty({
    description: 'Report type that was sent',
    example: 'inventory_valuation',
  })
  reportType: string;

  @ApiProperty({
    description: 'Format of the report that was sent',
    example: 'PDF',
  })
  format: string;

  @ApiProperty({
    description: 'Timestamp when email was sent',
    example: '2025-06-30T10:30:00.000Z',
  })
  sentAt: string;
}
