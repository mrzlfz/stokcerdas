import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEmail,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DepartmentType, DepartmentStatus } from '../entities/department.entity';

// Base department DTO
export class BaseDepartmentDto {
  @ApiProperty({
    description: 'Nama departemen',
    example: 'Sales Regional Jakarta',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama departemen harus berupa teks' })
  @MinLength(1, { message: 'Nama departemen tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama departemen maksimal 100 karakter' })
  name: string;

  @ApiProperty({
    description: 'Kode unik departemen',
    example: 'SALES_JKT',
    minLength: 2,
    maxLength: 20,
  })
  @IsString({ message: 'Kode departemen harus berupa teks' })
  @MinLength(2, { message: 'Kode departemen minimal 2 karakter' })
  @MaxLength(20, { message: 'Kode departemen maksimal 20 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiPropertyOptional({
    description: 'Deskripsi departemen',
    example: 'Departemen penjualan untuk wilayah Jakarta dan sekitarnya',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Jenis departemen',
    enum: DepartmentType,
    example: DepartmentType.DEPARTMENT,
  })
  @IsEnum(DepartmentType, { message: 'Jenis departemen tidak valid' })
  type: DepartmentType;

  @ApiPropertyOptional({
    description: 'ID manajer departemen',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID manajer harus berupa UUID yang valid' })
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Kode cost center',
    example: 'CC001',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'Cost center harus berupa teks' })
  @MaxLength(50, { message: 'Cost center maksimal 50 karakter' })
  costCenter?: string;

  @ApiPropertyOptional({
    description: 'Batas anggaran departemen',
    example: 1000000000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Batas anggaran harus berupa angka' })
  @Min(0, { message: 'Batas anggaran tidak boleh negatif' })
  budgetLimit?: number;

  @ApiPropertyOptional({
    description: 'Lokasi departemen',
    example: 'Jakarta Pusat',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Lokasi harus berupa teks' })
  @MaxLength(100, { message: 'Lokasi maksimal 100 karakter' })
  location?: string;

  @ApiPropertyOptional({
    description: 'Zona waktu departemen',
    example: 'Asia/Jakarta',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'Zona waktu harus berupa teks' })
  @MaxLength(20, { message: 'Zona waktu maksimal 20 karakter' })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Email departemen',
    example: 'sales.jakarta@company.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Nomor telepon departemen',
    example: '+6221-555-0123',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa teks' })
  @MaxLength(20, { message: 'Nomor telepon maksimal 20 karakter' })
  phoneNumber?: string;
}

// Create department DTO
export class CreateDepartmentDto extends BaseDepartmentDto {
  @ApiPropertyOptional({
    description: 'ID departemen induk',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID departemen induk harus berupa UUID yang valid' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Jam operasional departemen',
    example: {
      monday: { start: '08:00', end: '17:00' },
      tuesday: { start: '08:00', end: '17:00' },
      wednesday: { start: '08:00', end: '17:00' },
      thursday: { start: '08:00', end: '17:00' },
      friday: { start: '08:00', end: '17:00' },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Jam operasional harus berupa objek' })
  businessHours?: {
    monday?: { start: string; end: string; };
    tuesday?: { start: string; end: string; };
    wednesday?: { start: string; end: string; };
    thursday?: { start: string; end: string; };
    friday?: { start: string; end: string; };
    saturday?: { start: string; end: string; };
    sunday?: { start: string; end: string; };
  };

  @ApiPropertyOptional({
    description: 'Metadata tambahan',
    example: { region: 'DKI Jakarta', area: 'Pusat' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata harus berupa objek' })
  metadata?: Record<string, any>;
}

// Update department DTO
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiPropertyOptional({
    description: 'Status departemen',
    enum: DepartmentStatus,
    example: DepartmentStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(DepartmentStatus, { message: 'Status departemen tidak valid' })
  status?: DepartmentStatus;
}

// Department query DTO
export class DepartmentQueryDto {
  @ApiPropertyOptional({
    description: 'Jenis departemen',
    enum: DepartmentType,
  })
  @IsOptional()
  @IsEnum(DepartmentType, { message: 'Jenis departemen tidak valid' })
  type?: DepartmentType;

  @ApiPropertyOptional({
    description: 'Status departemen',
    enum: DepartmentStatus,
  })
  @IsOptional()
  @IsEnum(DepartmentStatus, { message: 'Status departemen tidak valid' })
  status?: DepartmentStatus;

  @ApiPropertyOptional({
    description: 'ID departemen induk',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID departemen induk harus berupa UUID yang valid' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'ID manajer',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID manajer harus berupa UUID yang valid' })
  managerId?: string;

  @ApiPropertyOptional({
    description: 'Lokasi',
  })
  @IsOptional()
  @IsString({ message: 'Lokasi harus berupa teks' })
  location?: string;

  @ApiPropertyOptional({
    description: 'Kata kunci pencarian',
  })
  @IsOptional()
  @IsString({ message: 'Kata kunci harus berupa teks' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Sertakan departemen tidak aktif',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include inactive harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;

  @ApiPropertyOptional({
    description: 'Level maksimal departemen',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Level maksimal harus berupa angka' })
  @Min(0, { message: 'Level maksimal minimal 0' })
  @Max(10, { message: 'Level maksimal maksimal 10' })
  @Type(() => Number)
  maxLevel?: number;

  @ApiPropertyOptional({
    description: 'Batas hasil pencarian',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  @Type(() => Number)
  limit?: number;
}

// Department move DTO
export class MoveDepartmentDto {
  @ApiPropertyOptional({
    description: 'ID departemen induk baru (null untuk root level)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID departemen induk harus berupa UUID yang valid' })
  newParentId?: string | null;

  @ApiPropertyOptional({
    description: 'Alasan pemindahan',
    example: 'Restrukturisasi organisasi',
  })
  @IsOptional()
  @IsString({ message: 'Alasan harus berupa teks' })
  @MaxLength(200, { message: 'Alasan maksimal 200 karakter' })
  reason?: string;
}

// Bulk status update DTO
export class BulkUpdateStatusDto {
  @ApiProperty({
    description: 'Array ID departemen',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-9f4e-123456789abc'],
  })
  @IsArray({ message: 'Department IDs harus berupa array' })
  @IsUUID('4', { each: true, message: 'Setiap ID harus berupa UUID yang valid' })
  departmentIds: string[];

  @ApiProperty({
    description: 'Status baru',
    enum: DepartmentStatus,
    example: DepartmentStatus.INACTIVE,
  })
  @IsEnum(DepartmentStatus, { message: 'Status tidak valid' })
  status: DepartmentStatus;

  @ApiPropertyOptional({
    description: 'Alasan perubahan status',
    example: 'Reorganisasi departemen',
  })
  @IsOptional()
  @IsString({ message: 'Alasan harus berupa teks' })
  @MaxLength(200, { message: 'Alasan maksimal 200 karakter' })
  reason?: string;
}

// Department response DTO
export class DepartmentResponseDto {
  @ApiProperty({ description: 'ID departemen' })
  id: string;

  @ApiProperty({ description: 'Nama departemen' })
  name: string;

  @ApiProperty({ description: 'Kode departemen' })
  code: string;

  @ApiPropertyOptional({ description: 'Deskripsi departemen' })
  description?: string;

  @ApiProperty({ description: 'Jenis departemen', enum: DepartmentType })
  type: DepartmentType;

  @ApiProperty({ description: 'Status departemen', enum: DepartmentStatus })
  status: DepartmentStatus;

  @ApiPropertyOptional({ description: 'ID departemen induk' })
  parentId?: string;

  @ApiPropertyOptional({ description: 'Informasi departemen induk' })
  parent?: Partial<DepartmentResponseDto>;

  @ApiPropertyOptional({ description: 'Sub-departemen', type: [DepartmentResponseDto] })
  children?: DepartmentResponseDto[];

  @ApiProperty({ description: 'Level dalam hierarki' })
  level: number;

  @ApiPropertyOptional({ description: 'Path hierarki' })
  path?: string;

  @ApiPropertyOptional({ description: 'ID manajer' })
  managerId?: string;

  @ApiPropertyOptional({ description: 'Cost center' })
  costCenter?: string;

  @ApiPropertyOptional({ description: 'Batas anggaran' })
  budgetLimit?: number;

  @ApiPropertyOptional({ description: 'Lokasi' })
  location?: string;

  @ApiPropertyOptional({ description: 'Zona waktu' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Email departemen' })
  email?: string;

  @ApiPropertyOptional({ description: 'Nomor telepon' })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Jam operasional' })
  businessHours?: Record<string, { start: string; end: string; }>;

  @ApiPropertyOptional({ description: 'Metadata tambahan' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;

  @ApiProperty({ description: 'Tanggal diperbarui' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'ID pembuat' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'ID yang memperbarui' })
  updatedBy?: string;
}

// Department tree response DTO
export class DepartmentTreeResponseDto extends DepartmentResponseDto {
  @ApiPropertyOptional({
    description: 'Sub-departemen dalam struktur tree',
    type: [DepartmentTreeResponseDto],
  })
  children?: DepartmentTreeResponseDto[];
}

// Department statistics DTO
export class DepartmentStatsDto {
  @ApiProperty({ description: 'Total departemen' })
  total: number;

  @ApiProperty({ description: 'Departemen aktif' })
  active: number;

  @ApiProperty({ description: 'Departemen tidak aktif' })
  inactive: number;

  @ApiProperty({ description: 'Departemen yang diarsipkan' })
  archived: number;

  @ApiProperty({
    description: 'Statistik berdasarkan jenis',
    example: {
      root: 1,
      division: 5,
      department: 15,
      team: 25,
      group: 50,
    },
  })
  byType: Record<string, number>;

  @ApiProperty({
    description: 'Statistik berdasarkan level',
    example: { '0': 1, '1': 5, '2': 15, '3': 30 },
  })
  byLevel: Record<number, number>;
}

// Department access check DTO
export class DepartmentAccessDto {
  @ApiProperty({
    description: 'ID departemen',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID departemen harus berupa UUID yang valid' })
  departmentId: string;

  @ApiPropertyOptional({
    description: 'Jenis akses yang diminta',
    example: 'read',
    enum: ['read', 'write', 'delete', 'manage'],
  })
  @IsOptional()
  @IsString({ message: 'Jenis akses harus berupa teks' })
  accessType?: string;
}