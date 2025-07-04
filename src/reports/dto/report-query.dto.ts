import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsUUID,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportType {
  INVENTORY_VALUATION = 'inventory_valuation',
  STOCK_MOVEMENT = 'stock_movement',
  LOW_STOCK = 'low_stock',
  PRODUCT_PERFORMANCE = 'product_performance',
}

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
  EXCEL = 'excel',
}

export enum StockMovementType {
  ALL = 'all',
  RECEIPTS = 'receipts',
  ISSUES = 'issues',
  TRANSFERS = 'transfers',
  ADJUSTMENTS = 'adjustments',
}

export enum GroupByOption {
  NONE = 'none',
  PRODUCT = 'product',
  CATEGORY = 'category',
  LOCATION = 'location',
  DATE = 'date',
}

export class BaseReportQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for report period',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for report period',
    example: '2025-06-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific location IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  locationIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by specific product IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by category IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    enum: ReportFormat,
    default: ReportFormat.JSON,
    description: 'Output format for the report',
  })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat = ReportFormat.JSON;

  @ApiPropertyOptional({
    enum: GroupByOption,
    default: GroupByOption.NONE,
    description: 'Group results by specific field',
  })
  @IsOptional()
  @IsEnum(GroupByOption)
  groupBy?: GroupByOption = GroupByOption.NONE;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 1000,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}

export class InventoryValuationQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({
    description: 'Include only active products',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  activeProductsOnly?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include zero-value items',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeZeroValue?: boolean = false;
}

export class StockMovementQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({
    enum: StockMovementType,
    default: StockMovementType.ALL,
    description: 'Filter by movement type',
  })
  @IsOptional()
  @IsEnum(StockMovementType)
  movementType?: StockMovementType = StockMovementType.ALL;

  @ApiPropertyOptional({
    description: 'Include cancelled transactions',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeCancelled?: boolean = false;
}

export class LowStockQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({
    description: 'Include out of stock items',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeOutOfStock?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include items approaching reorder point',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeReorderNeeded?: boolean = true;
}

export class ProductPerformanceQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({
    description: 'Minimum number of transactions to include',
    minimum: 0,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTransactions?: number = 1;

  @ApiPropertyOptional({
    description: 'Include inactive products',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean = false;
}
