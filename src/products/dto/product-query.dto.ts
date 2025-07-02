import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus, ProductType } from '../entities/product.entity';

export class ProductQueryDto {
  @ApiPropertyOptional({
    description: 'Halaman (untuk pagination)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Page harus berupa angka' })
  @Min(1, { message: 'Page minimal 1' })
  @Transform(({ value }) => parseInt(value) || 1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Jumlah item per halaman',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  @Transform(({ value }) => parseInt(value) || 20)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pencarian berdasarkan nama, SKU, atau barcode',
    example: 'laptop',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status',
    enum: ProductStatus,
  })
  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Status produk tidak valid' })
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe produk',
    enum: ProductType,
  })
  @IsOptional()
  @IsEnum(ProductType, { message: 'Tipe produk tidak valid' })
  type?: ProductType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan kategori',
    example: 'uuid-kategori',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan brand',
    example: 'ASUS',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan supplier',
    example: 'PT Supplier Indonesia',
  })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({
    description: 'Harga minimum',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Harga minimum harus berupa angka' })
  @Min(0, { message: 'Harga minimum tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Harga maksimum',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Harga maksimum harus berupa angka' })
  @Min(0, { message: 'Harga maksimum tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Filter produk dengan stok rendah',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Low stock harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  lowStock?: boolean;

  @ApiPropertyOptional({
    description: 'Filter produk yang habis',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Out of stock harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  outOfStock?: boolean;

  @ApiPropertyOptional({
    description: 'Filter produk yang akan expired',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Expiring soon harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  expiringSoon?: boolean;

  @ApiPropertyOptional({
    description: 'Urutkan berdasarkan field',
    enum: ['name', 'sku', 'sellingPrice', 'costPrice', 'createdAt', 'salesCount'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Arah pengurutan',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'Sort order hanya boleh ASC atau DESC' })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'Tampilkan produk yang dihapus',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include deleted harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean = false;
}