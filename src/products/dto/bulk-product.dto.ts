import { IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

export class BulkCreateProductDto {
  @ApiProperty({
    description: 'Array produk yang akan dibuat',
    type: [CreateProductDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  products: CreateProductDto[];
}

export class BulkUpdateProductDto {
  @ApiProperty({
    description: 'Array ID produk yang akan diupdate',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @IsString({ each: true })
  productIds: string[];

  @ApiProperty({
    description: 'Data yang akan diupdate untuk semua produk',
    type: UpdateProductDto,
  })
  @ValidateNested()
  @Type(() => UpdateProductDto)
  updateData: UpdateProductDto;
}

export class BulkDeleteProductDto {
  @ApiProperty({
    description: 'Array ID produk yang akan dihapus',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @IsString({ each: true })
  productIds: string[];

  @ApiPropertyOptional({
    description: 'Apakah hard delete (permanent)',
    default: false,
  })
  @IsOptional()
  hardDelete?: boolean = false;
}

export class BulkProductResponseDto {
  @ApiProperty({
    description: 'Jumlah produk yang berhasil diproses',
    example: 5,
  })
  successful: number;

  @ApiProperty({
    description: 'Jumlah produk yang gagal diproses',
    example: 2,
  })
  failed: number;

  @ApiProperty({
    description: 'Detail error untuk produk yang gagal',
    type: [Object],
    example: [
      { sku: 'SKU-001', error: 'SKU sudah ada' },
      { sku: 'SKU-002', error: 'Validasi gagal' },
    ],
  })
  errors: Array<{
    sku?: string;
    index?: number;
    error: string;
  }>;

  @ApiProperty({
    description: 'ID produk yang berhasil dibuat/diupdate',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  successfulIds: string[];
}
