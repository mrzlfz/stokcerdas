import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsEmail,
  IsObject,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LocationType,
  LocationStatus,
} from '../entities/inventory-location.entity';

class OperatingHoursDto {
  @ApiPropertyOptional({
    description: 'Jam operasional hari ini',
    example: { open: '08:00', close: '17:00' },
  })
  @IsOptional()
  @IsObject()
  monday?: { open: string; close: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  tuesday?: { open: string; close: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  wednesday?: { open: string; close: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  thursday?: { open: string; close: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  friday?: { open: string; close: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  saturday?: { open: string; close: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sunday?: { open: string; close: string };
}

export class CreateInventoryLocationDto {
  @ApiProperty({
    description: 'Kode lokasi (harus unik per tenant)',
    example: 'WH001',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2, { message: 'Kode lokasi minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode lokasi maksimal 50 karakter' })
  code: string;

  @ApiProperty({
    description: 'Nama lokasi',
    example: 'Gudang Pusat Jakarta',
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @MinLength(3, { message: 'Nama lokasi minimal 3 karakter' })
  @MaxLength(255, { message: 'Nama lokasi maksimal 255 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi lokasi',
    example: 'Gudang utama untuk distribusi wilayah Jakarta dan sekitarnya',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Deskripsi maksimal 1000 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Jenis lokasi',
    enum: LocationType,
    example: LocationType.WAREHOUSE,
  })
  @IsEnum(LocationType, { message: 'Jenis lokasi tidak valid' })
  type: LocationType;

  @ApiPropertyOptional({
    description: 'Status lokasi',
    enum: LocationStatus,
    example: LocationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LocationStatus, { message: 'Status lokasi tidak valid' })
  status?: LocationStatus;

  @ApiPropertyOptional({
    description: 'ID lokasi parent (untuk hierarki)',
    example: 'uuid-parent-location',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Parent ID harus berformat UUID yang valid' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Alamat lengkap',
    example: 'Jl. Raya Bekasi No. 123, Cakung',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Alamat maksimal 255 karakter' })
  address?: string;

  @ApiPropertyOptional({
    description: 'Kota',
    example: 'Jakarta Timur',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Kota maksimal 100 karakter' })
  city?: string;

  @ApiPropertyOptional({
    description: 'Provinsi',
    example: 'DKI Jakarta',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Provinsi maksimal 100 karakter' })
  state?: string;

  @ApiPropertyOptional({
    description: 'Kode pos',
    example: '13910',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Kode pos maksimal 20 karakter' })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Negara',
    example: 'Indonesia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Negara maksimal 100 karakter' })
  country?: string;

  @ApiPropertyOptional({
    description: 'Latitude koordinat',
    example: -6.2088,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Latitude harus berupa angka' })
  @Min(-90, { message: 'Latitude minimal -90' })
  @Max(90, { message: 'Latitude maksimal 90' })
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude koordinat',
    example: 106.8456,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Longitude harus berupa angka' })
  @Min(-180, { message: 'Longitude minimal -180' })
  @Max(180, { message: 'Longitude maksimal 180' })
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Nomor telepon',
    example: '+6221-12345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Nomor telepon maksimal 20 karakter' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Email kontak',
    example: 'admin@gudang-jakarta.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255, { message: 'Email maksimal 255 karakter' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Nama kontak person',
    example: 'Budi Santoso',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Nama kontak maksimal 255 karakter' })
  contactPerson?: string;

  @ApiPropertyOptional({
    description: 'Total area (meter persegi)',
    example: 500.5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Total area harus berupa angka' })
  @Min(0, { message: 'Total area tidak boleh negatif' })
  totalArea?: number;

  @ApiPropertyOptional({
    description: 'Area yang bisa digunakan (meter persegi)',
    example: 450.0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Area yang bisa digunakan harus berupa angka' })
  @Min(0, { message: 'Area yang bisa digunakan tidak boleh negatif' })
  usableArea?: number;

  @ApiPropertyOptional({
    description: 'Kapasitas maksimal (jumlah item)',
    example: 10000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Kapasitas maksimal harus berupa angka' })
  @Min(0, { message: 'Kapasitas maksimal tidak boleh negatif' })
  maxCapacity?: number;

  @ApiPropertyOptional({
    description: 'Apakah lokasi pickup',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Pickup location harus berupa boolean' })
  isPickupLocation?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah lokasi dropoff',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Dropoff location harus berupa boolean' })
  isDropoffLocation?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah mengizinkan stok negatif',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow negative stock harus berupa boolean' })
  allowNegativeStock?: boolean;

  @ApiPropertyOptional({
    description: 'Jam operasional per hari',
    type: OperatingHoursDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours?: OperatingHoursDto;

  @ApiPropertyOptional({
    description: 'Pengaturan tambahan untuk lokasi',
    example: { temperatureControlled: true, securityLevel: 'high' },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
