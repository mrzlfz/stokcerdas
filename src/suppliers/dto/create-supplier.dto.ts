import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsEmail,
  IsArray,
  IsDateString,
  IsObject,
  IsPhoneNumber,
  IsUrl,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsPostalCode,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SupplierStatus,
  SupplierType,
  PaymentTerms,
  CurrencyCode,
} from '../entities/supplier.entity';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Kode supplier (harus unik per tenant)',
    example: 'SUP-001',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @MinLength(3, { message: 'Kode supplier minimal 3 karakter' })
  @MaxLength(50, { message: 'Kode supplier maksimal 50 karakter' })
  @Matches(/^[A-Z0-9\-_]+$/, {
    message:
      'Kode supplier hanya boleh mengandung huruf besar, angka, dash, dan underscore',
  })
  code: string;

  @ApiProperty({
    description: 'Nama supplier',
    example: 'PT Distributor Indonesia',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @MinLength(2, { message: 'Nama supplier minimal 2 karakter' })
  @MaxLength(255, { message: 'Nama supplier maksimal 255 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Nama legal/resmi supplier',
    example: 'PT Distributor Indonesia Tbk.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Nama legal maksimal 255 karakter' })
  legalName?: string;

  @ApiPropertyOptional({
    description: 'Deskripsi supplier',
    example: 'Supplier utama untuk produk elektronik dan gadget',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Tipe supplier',
    enum: SupplierType,
    default: SupplierType.DISTRIBUTOR,
  })
  @IsOptional()
  @IsEnum(SupplierType, { message: 'Tipe supplier tidak valid' })
  type?: SupplierType = SupplierType.DISTRIBUTOR;

  @ApiPropertyOptional({
    description: 'Status supplier',
    enum: SupplierStatus,
    default: SupplierStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SupplierStatus, { message: 'Status supplier tidak valid' })
  status?: SupplierStatus = SupplierStatus.ACTIVE;

  // Contact Information
  @ApiPropertyOptional({
    description: 'Email supplier',
    example: 'supplier@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255, { message: 'Email maksimal 255 karakter' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Nomor telepon supplier',
    example: '+6221-1234567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Nomor telepon maksimal 20 karakter' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Nomor HP supplier',
    example: '+62812-3456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Nomor HP maksimal 20 karakter' })
  mobile?: string;

  @ApiPropertyOptional({
    description: 'Website supplier',
    example: 'https://www.supplier.com',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Format URL website tidak valid' })
  @MaxLength(100, { message: 'URL website maksimal 100 karakter' })
  website?: string;

  // Address Information
  @ApiPropertyOptional({
    description: 'Alamat lengkap supplier',
    example: 'Jl. Sudirman No. 123, Jakarta Selatan',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Kota',
    example: 'Jakarta',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Nama kota maksimal 100 karakter' })
  city?: string;

  @ApiPropertyOptional({
    description: 'Provinsi',
    example: 'DKI Jakarta',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Nama provinsi maksimal 100 karakter' })
  province?: string;

  @ApiPropertyOptional({
    description: 'Kode pos',
    example: '12190',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'Kode pos harus 5 digit angka' })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Negara',
    example: 'Indonesia',
    default: 'Indonesia',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Nama negara maksimal 100 karakter' })
  country?: string = 'Indonesia';

  // Business Information
  @ApiPropertyOptional({
    description: 'NPWP/Tax ID',
    example: '12.345.678.9-012.000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Tax ID maksimal 50 karakter' })
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Nomor izin usaha',
    example: 'SIUP-001/2024',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Nomor izin usaha maksimal 50 karakter' })
  businessLicense?: string;

  @ApiPropertyOptional({
    description: 'Nama bank',
    example: 'Bank Mandiri',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Nama bank maksimal 100 karakter' })
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Nomor rekening bank',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Nomor rekening maksimal 50 karakter' })
  bankAccountNumber?: string;

  @ApiPropertyOptional({
    description: 'Nama pemilik rekening',
    example: 'PT Distributor Indonesia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Nama pemilik rekening maksimal 255 karakter' })
  bankAccountName?: string;

  // Payment Terms
  @ApiPropertyOptional({
    description: 'Syarat pembayaran',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  @IsOptional()
  @IsEnum(PaymentTerms, { message: 'Syarat pembayaran tidak valid' })
  paymentTerms?: PaymentTerms = PaymentTerms.NET_30;

  @ApiPropertyOptional({
    description: 'Hari pembayaran custom (untuk payment terms CUSTOM)',
    example: 45,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Hari pembayaran custom harus berupa angka' })
  @Min(1, { message: 'Hari pembayaran custom minimal 1 hari' })
  @Max(365, { message: 'Hari pembayaran custom maksimal 365 hari' })
  @Transform(({ value }) => parseInt(value))
  customPaymentDays?: number;

  @ApiPropertyOptional({
    description: 'Mata uang',
    enum: CurrencyCode,
    default: CurrencyCode.IDR,
  })
  @IsOptional()
  @IsEnum(CurrencyCode, { message: 'Mata uang tidak valid' })
  currency?: CurrencyCode = CurrencyCode.IDR;

  @ApiPropertyOptional({
    description: 'Limit kredit (dalam mata uang yang dipilih)',
    example: 100000000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Limit kredit harus berupa angka' })
  @Min(0, { message: 'Limit kredit tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  creditLimit?: number = 0;

  @ApiPropertyOptional({
    description: 'Diskon default (dalam persen)',
    example: 5.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Diskon harus berupa angka' })
  @Min(0, { message: 'Diskon tidak boleh negatif' })
  @Max(100, { message: 'Diskon maksimal 100%' })
  @Transform(({ value }) => parseFloat(value))
  discount?: number = 0;

  // Performance Metrics (optional untuk supplier baru)
  @ApiPropertyOptional({
    description: 'Rating supplier (0-5)',
    example: 4.5,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Rating harus berupa angka' })
  @Min(0, { message: 'Rating minimal 0' })
  @Max(5, { message: 'Rating maksimal 5' })
  @Transform(({ value }) => parseFloat(value))
  rating?: number = 0;

  @ApiPropertyOptional({
    description: 'Lead time rata-rata (dalam hari)',
    example: 7,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Lead time harus berupa angka' })
  @Min(0, { message: 'Lead time tidak boleh negatif' })
  @Transform(({ value }) => parseInt(value))
  leadTimeDays?: number = 0;

  // Contract Information
  @ApiPropertyOptional({
    description: 'Tanggal mulai kontrak',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal mulai kontrak tidak valid' })
  contractStartDate?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal akhir kontrak',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal akhir kontrak tidak valid' })
  contractEndDate?: Date;

  // Additional Information
  @ApiPropertyOptional({
    description: 'Tags untuk pencarian dan kategorisasi',
    type: [String],
    example: ['elektronik', 'trusted', 'fast-delivery'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Custom fields untuk kebutuhan spesifik',
    example: { industry: 'Electronics', certification: 'ISO 9001' },
  })
  @IsOptional()
  @IsObject({ message: 'Custom fields harus berupa object' })
  customFields?: Record<string, any>;

  // Primary Contact
  @ApiPropertyOptional({
    description: 'Nama kontak utama',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Nama kontak utama maksimal 255 karakter' })
  primaryContactName?: string;

  @ApiPropertyOptional({
    description: 'Email kontak utama',
    example: 'john.doe@supplier.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email kontak utama tidak valid' })
  @MaxLength(255, { message: 'Email kontak utama maksimal 255 karakter' })
  primaryContactEmail?: string;

  @ApiPropertyOptional({
    description: 'Nomor HP kontak utama',
    example: '+62812-3456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Nomor HP kontak utama maksimal 20 karakter' })
  primaryContactPhone?: string;

  @ApiPropertyOptional({
    description: 'Jabatan kontak utama',
    example: 'Sales Manager',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Jabatan kontak utama maksimal 100 karakter' })
  primaryContactPosition?: string;
}
