import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  Transform,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  SupplierStatus,
  SupplierType,
  PaymentTerms,
  CurrencyCode,
} from '../entities/supplier.entity';

export class SupplierQueryDto {
  @ApiPropertyOptional({
    description: 'Halaman (pagination)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Halaman harus berupa angka' })
  @Min(1, { message: 'Halaman minimal 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Jumlah data per halaman',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pencarian berdasarkan kode, nama, email, atau kontak',
    example: 'supplier',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status',
    enum: SupplierStatus,
  })
  @IsOptional()
  @IsEnum(SupplierStatus, { message: 'Status supplier tidak valid' })
  status?: SupplierStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe supplier',
    enum: SupplierType,
  })
  @IsOptional()
  @IsEnum(SupplierType, { message: 'Tipe supplier tidak valid' })
  type?: SupplierType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan syarat pembayaran',
    enum: PaymentTerms,
  })
  @IsOptional()
  @IsEnum(PaymentTerms, { message: 'Syarat pembayaran tidak valid' })
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan mata uang',
    enum: CurrencyCode,
  })
  @IsOptional()
  @IsEnum(CurrencyCode, { message: 'Mata uang tidak valid' })
  currency?: CurrencyCode;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan kota',
    example: 'Jakarta',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan provinsi',
    example: 'DKI Jakarta',
  })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan negara',
    example: 'Indonesia',
    default: 'Indonesia',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter rating minimum',
    example: 3.0,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Rating minimum harus berupa angka' })
  @Min(0, { message: 'Rating minimum tidak boleh negatif' })
  @Max(5, { message: 'Rating minimum maksimal 5' })
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Filter rating maksimum',
    example: 5.0,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Rating maksimum harus berupa angka' })
  @Min(0, { message: 'Rating maksimum tidak boleh negatif' })
  @Max(5, { message: 'Rating maksimum maksimal 5' })
  maxRating?: number;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan lead time maksimum (hari)',
    example: 14,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Lead time maksimum harus berupa angka' })
  @Min(0, { message: 'Lead time maksimum tidak boleh negatif' })
  maxLeadTime?: number;

  @ApiPropertyOptional({
    description: 'Filter supplier dengan kontrak yang masih berlaku',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'Contract active harus berupa boolean' })
  contractActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter supplier yang pernah menerima order',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'Has orders harus berupa boolean' })
  hasOrders?: boolean;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tags',
    example: 'elektronik,trusted',
  })
  @IsOptional()
  @IsString()
  tags?: string; // Comma separated tags

  @ApiPropertyOptional({
    description: 'Field untuk sorting',
    example: 'name',
    enum: [
      'name',
      'code',
      'rating',
      'totalOrders',
      'totalPurchaseAmount',
      'onTimeDeliveryRate',
      'qualityScore',
      'leadTimeDays',
      'createdAt',
      'lastOrderDate',
    ],
    default: 'name',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiPropertyOptional({
    description: 'Urutan sorting',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'Sort order harus ASC atau DESC' })
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  @ApiPropertyOptional({
    description: 'Tampilkan data yang sudah dihapus',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'Include deleted harus berupa boolean' })
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Tampilkan relasi products',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'Include products harus berupa boolean' })
  includeProducts?: boolean = false;
}