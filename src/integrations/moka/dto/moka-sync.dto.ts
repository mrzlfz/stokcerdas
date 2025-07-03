import { IsString, IsOptional, IsBoolean, IsNotEmpty, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MokaProductSyncDto {
  @ApiProperty({ description: 'Moka channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiPropertyOptional({ description: 'Include product variants' })
  @IsBoolean()
  @IsOptional()
  includeVariants?: boolean;

  @ApiPropertyOptional({ description: 'Include product categories' })
  @IsBoolean()
  @IsOptional()
  includeCategories?: boolean;

  @ApiPropertyOptional({ description: 'Batch size for sync' })
  @IsNumber()
  @IsOptional()
  batchSize?: number;

  @ApiPropertyOptional({ 
    description: 'Sync direction',
    enum: ['inbound', 'outbound', 'bidirectional'],
  })
  @IsEnum(['inbound', 'outbound', 'bidirectional'])
  @IsOptional()
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
}

export class MokaSalesImportDto {
  @ApiProperty({ description: 'Moka channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiPropertyOptional({ description: 'Import sales from date (ISO date string)' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Import sales to date (ISO date string)' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Batch size for import' })
  @IsNumber()
  @IsOptional()
  batchSize?: number;

  @ApiPropertyOptional({ description: 'Include detailed line items' })
  @IsBoolean()
  @IsOptional()
  includeLineItems?: boolean;
}

export class MokaInventorySyncDto {
  @ApiProperty({ description: 'Moka channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiPropertyOptional({ description: 'Batch size for sync' })
  @IsNumber()
  @IsOptional()
  batchSize?: number;

  @ApiPropertyOptional({ 
    description: 'Sync direction',
    enum: ['inbound', 'outbound', 'bidirectional'],
  })
  @IsEnum(['inbound', 'outbound', 'bidirectional'])
  @IsOptional()
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';

  @ApiPropertyOptional({ description: 'Include out of stock items' })
  @IsBoolean()
  @IsOptional()
  includeOutOfStock?: boolean;

  @ApiPropertyOptional({ description: 'Sync from date (ISO date string)' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Sync to date (ISO date string)' })
  @IsDateString()
  @IsOptional()
  toDate?: string;
}