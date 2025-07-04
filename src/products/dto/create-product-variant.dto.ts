import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductVariantDto {
  @ApiProperty({
    description: 'ID produk induk',
    example: 'uuid-produk',
  })
  @IsUUID(4, { message: 'Product ID harus berformat UUID' })
  productId: string;

  @ApiProperty({
    description: 'SKU variant (harus unik per tenant)',
    example: 'SKU-001-RED-L',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3, { message: 'SKU variant minimal 3 karakter' })
  @MaxLength(100, { message: 'SKU variant maksimal 100 karakter' })
  sku: string;

  @ApiProperty({
    description: 'Nama variant',
    example: 'Laptop ASUS ROG Strix - Merah - Large',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @MinLength(2, { message: 'Nama variant minimal 2 karakter' })
  @MaxLength(255, { message: 'Nama variant maksimal 255 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Barcode variant',
    example: '1234567890124',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Barcode maksimal 50 karakter' })
  barcode?: string;

  @ApiProperty({
    description: 'Harga modal variant (dalam Rupiah)',
    example: 8100000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Harga modal harus berupa angka' })
  @Min(0, { message: 'Harga modal tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  costPrice: number;

  @ApiProperty({
    description: 'Harga jual variant (dalam Rupiah)',
    example: 10200000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Harga jual harus berupa angka' })
  @Min(0, { message: 'Harga jual tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  sellingPrice: number;

  @ApiPropertyOptional({
    description: 'Berat variant (dalam kg)',
    example: 2.6,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Berat harus berupa angka' })
  @Min(0, { message: 'Berat tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  weight?: number;

  @ApiPropertyOptional({
    description: 'URL gambar variant',
    example: 'https://example.com/variant-image.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({
    description: 'Atribut variant (seperti warna, ukuran, dll)',
    example: { color: 'red', size: 'L', storage: '512GB' },
  })
  @IsObject({ message: 'Atribut harus berupa object' })
  attributes: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Apakah variant aktif',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean = true;
}
