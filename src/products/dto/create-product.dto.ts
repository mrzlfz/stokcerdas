import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @ApiProperty({
    description: 'SKU produk (harus unik per tenant)',
    example: 'SKU-001',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3, { message: 'SKU minimal 3 karakter' })
  @MaxLength(100, { message: 'SKU maksimal 100 karakter' })
  sku: string;

  @ApiProperty({
    description: 'Nama produk',
    example: 'Laptop ASUS ROG Strix',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @MinLength(2, { message: 'Nama produk minimal 2 karakter' })
  @MaxLength(255, { message: 'Nama produk maksimal 255 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi produk',
    example: 'Laptop gaming dengan spesifikasi tinggi',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Barcode produk',
    example: '1234567890123',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Barcode maksimal 50 karakter' })
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Tipe produk',
    enum: ProductType,
    default: ProductType.SIMPLE,
  })
  @IsOptional()
  @IsEnum(ProductType, { message: 'Tipe produk tidak valid' })
  type?: ProductType = ProductType.SIMPLE;

  @ApiPropertyOptional({
    description: 'Status produk',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Status produk tidak valid' })
  status?: ProductStatus = ProductStatus.ACTIVE;

  @ApiPropertyOptional({
    description: 'ID kategori produk',
    example: 'uuid-kategori',
  })
  @IsOptional()
  @IsUUID(4, { message: 'ID kategori harus berformat UUID' })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Brand/merek produk',
    example: 'ASUS',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Brand maksimal 100 karakter' })
  brand?: string;

  @ApiPropertyOptional({
    description: 'Satuan produk',
    example: 'pcs',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Satuan maksimal 50 karakter' })
  unit?: string;

  @ApiProperty({
    description: 'Harga modal/pokok (dalam Rupiah)',
    example: 8000000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Harga modal harus berupa angka' })
  @Min(0, { message: 'Harga modal tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  costPrice: number;

  @ApiProperty({
    description: 'Harga jual (dalam Rupiah)',
    example: 10000000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Harga jual harus berupa angka' })
  @Min(0, { message: 'Harga jual tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  sellingPrice: number;

  @ApiPropertyOptional({
    description: 'Harga grosir (dalam Rupiah)',
    example: 9500000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Harga grosir harus berupa angka' })
  @Min(0, { message: 'Harga grosir tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  wholesalePrice?: number;

  @ApiPropertyOptional({
    description: 'Berat produk (dalam kg)',
    example: 2.5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Berat harus berupa angka' })
  @Min(0, { message: 'Berat tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  weight?: number;

  @ApiPropertyOptional({
    description: 'Dimensi produk (PxLxT dalam cm)',
    example: '30x20x5',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Dimensi maksimal 50 karakter' })
  dimensions?: string;

  @ApiPropertyOptional({
    description: 'URL gambar utama produk',
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'Array URL gambar produk',
    type: [String],
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Stok minimum',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Stok minimum harus berupa angka' })
  @Min(0, { message: 'Stok minimum tidak boleh negatif' })
  @Transform(({ value }) => parseInt(value))
  minStock?: number = 0;

  @ApiPropertyOptional({
    description: 'Stok maksimum',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Stok maksimum harus berupa angka' })
  @Min(0, { message: 'Stok maksimum tidak boleh negatif' })
  @Transform(({ value }) => parseInt(value))
  maxStock?: number = 0;

  @ApiPropertyOptional({
    description: 'Titik reorder stok',
    example: 20,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Titik reorder harus berupa angka' })
  @Min(0, { message: 'Titik reorder tidak boleh negatif' })
  @Transform(({ value }) => parseInt(value))
  reorderPoint?: number = 0;

  @ApiPropertyOptional({
    description: 'Jumlah reorder',
    example: 50,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Jumlah reorder harus berupa angka' })
  @Min(1, { message: 'Jumlah reorder minimal 1' })
  @Transform(({ value }) => parseInt(value))
  reorderQuantity?: number = 1;

  @ApiPropertyOptional({
    description: 'Apakah stok di-track',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Track stok harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  trackStock?: boolean = true;

  @ApiPropertyOptional({
    description: 'Izinkan backorder',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow backorder harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  allowBackorder?: boolean = false;

  @ApiPropertyOptional({
    description: 'Tanggal kadaluarsa',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal kadaluarsa tidak valid' })
  expiryDate?: Date;

  @ApiPropertyOptional({
    description: 'Umur simpan (dalam hari)',
    example: 365,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Umur simpan harus berupa angka' })
  @Min(1, { message: 'Umur simpan minimal 1 hari' })
  @Transform(({ value }) => parseInt(value))
  shelfLife?: number;

  @ApiPropertyOptional({
    description: 'ID supplier',
    example: 'uuid-supplier',
  })
  @IsOptional()
  @IsUUID(4, { message: 'ID supplier harus berformat UUID' })
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'SKU dari supplier',
    example: 'SUP-SKU-001',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'SKU supplier maksimal 100 karakter' })
  supplierSku?: string;

  @ApiPropertyOptional({
    description: 'Rate pajak (dalam persen)',
    example: 11,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Rate pajak harus berupa angka' })
  @Min(0, { message: 'Rate pajak tidak boleh negatif' })
  @Max(100, { message: 'Rate pajak maksimal 100%' })
  @Transform(({ value }) => parseFloat(value))
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Apakah produk kena pajak',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is taxable harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  isTaxable?: boolean = true;

  @ApiPropertyOptional({
    description: 'Atribut custom produk',
    example: { color: 'red', material: 'plastic' },
  })
  @IsOptional()
  @IsObject({ message: 'Atribut harus berupa object' })
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Meta SEO untuk e-commerce',
    example: {
      title: 'Laptop Gaming Terbaik',
      description: 'Laptop gaming untuk para gamer',
      keywords: ['laptop', 'gaming', 'asus'],
    },
  })
  @IsOptional()
  @IsObject({ message: 'SEO meta harus berupa object' })
  seoMeta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}
