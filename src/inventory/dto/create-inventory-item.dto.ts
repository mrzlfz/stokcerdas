import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDate,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInventoryItemDto {
  @ApiProperty({
    description: 'ID produk',
    example: 'uuid-product-id',
  })
  @IsUUID(4, { message: 'Product ID harus berformat UUID yang valid' })
  productId: string;

  @ApiProperty({
    description: 'ID lokasi inventori',
    example: 'uuid-location-id',
  })
  @IsUUID(4, { message: 'Location ID harus berformat UUID yang valid' })
  locationId: string;

  @ApiProperty({
    description: 'Jumlah stok awal',
    example: 100,
  })
  @IsNumber({}, { message: 'Quantity on hand harus berupa angka' })
  @Min(0, { message: 'Quantity on hand tidak boleh negatif' })
  quantityOnHand: number;

  @ApiPropertyOptional({
    description: 'Jumlah stok yang dipesan',
    example: 50,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Quantity on order harus berupa angka' })
  @Min(0, { message: 'Quantity on order tidak boleh negatif' })
  quantityOnOrder?: number;

  @ApiPropertyOptional({
    description: 'Harga rata-rata pembelian',
    example: 15000.50,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Average cost harus berupa angka' })
  @Min(0, { message: 'Average cost tidak boleh negatif' })
  averageCost?: number;

  @ApiPropertyOptional({
    description: 'Stok minimum untuk lokasi ini',
    example: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min stock harus berupa angka' })
  @Min(0, { message: 'Min stock tidak boleh negatif' })
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Stok maksimum untuk lokasi ini',
    example: 500,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max stock harus berupa angka' })
  @Min(0, { message: 'Max stock tidak boleh negatif' })
  maxStock?: number;

  @ApiPropertyOptional({
    description: 'Titik reorder untuk lokasi ini',
    example: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Reorder point harus berupa angka' })
  @Min(0, { message: 'Reorder point tidak boleh negatif' })
  reorderPoint?: number;

  @ApiPropertyOptional({
    description: 'Jumlah reorder untuk lokasi ini',
    example: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Reorder quantity harus berupa angka' })
  @Min(1, { message: 'Reorder quantity minimal 1' })
  reorderQuantity?: number;

  @ApiPropertyOptional({
    description: 'Lokasi bin/rak spesifik',
    example: 'A1-B2-C3',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Bin location maksimal 50 karakter' })
  binLocation?: string;

  @ApiPropertyOptional({
    description: 'Nomor lot',
    example: 'LOT20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Lot number maksimal 100 karakter' })
  lotNumber?: string;

  @ApiPropertyOptional({
    description: 'Nomor serial',
    example: 'SN20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Serial number maksimal 100 karakter' })
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Tanggal kadaluarsa',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDate({ message: 'Expiry date harus berupa tanggal yang valid' })
  @Type(() => Date)
  expiryDate?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal produksi',
    example: '2024-06-01',
  })
  @IsOptional()
  @IsDate({ message: 'Manufacturing date harus berupa tanggal yang valid' })
  @Type(() => Date)
  manufacturingDate?: Date;

  @ApiPropertyOptional({
    description: 'Atribut tambahan item inventori',
    example: { temperature: '2-8°C', humidity: '40-60%' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Status aktif item inventori',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;
}