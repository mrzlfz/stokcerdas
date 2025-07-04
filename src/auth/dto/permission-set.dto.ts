import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PermissionSetType,
  PermissionSetStatus,
  PermissionSetScope,
} from '../entities/permission-set.entity';

// Base permission set DTO
export class BasePermissionSetDto {
  @ApiProperty({
    description: 'Nama permission set',
    example: 'Sales Manager Permissions',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama permission set harus berupa teks' })
  @MinLength(1, { message: 'Nama permission set tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama permission set maksimal 100 karakter' })
  name: string;

  @ApiProperty({
    description: 'Kode unik permission set',
    example: 'SALES_MANAGER_PERMS',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Kode permission set harus berupa teks' })
  @MinLength(2, { message: 'Kode permission set minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode permission set maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiPropertyOptional({
    description: 'Deskripsi permission set',
    example:
      'Set permission untuk manager penjualan dengan akses lengkap ke modul sales',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Jenis permission set',
    enum: PermissionSetType,
    example: PermissionSetType.DEPARTMENT,
  })
  @IsEnum(PermissionSetType, { message: 'Jenis permission set tidak valid' })
  type: PermissionSetType;

  @ApiProperty({
    description: 'Scope permission set',
    enum: PermissionSetScope,
    example: PermissionSetScope.DEPARTMENT,
  })
  @IsEnum(PermissionSetScope, { message: 'Scope permission set tidak valid' })
  scope: PermissionSetScope;

  @ApiPropertyOptional({
    description: 'Kategori permission set',
    example: 'Sales',
  })
  @IsOptional()
  @IsString({ message: 'Kategori harus berupa teks' })
  @MaxLength(100, { message: 'Kategori maksimal 100 karakter' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Sub-kategori permission set',
    example: 'Regional Sales',
  })
  @IsOptional()
  @IsString({ message: 'Sub-kategori harus berupa teks' })
  @MaxLength(100, { message: 'Sub-kategori maksimal 100 karakter' })
  subcategory?: string;

  @ApiPropertyOptional({
    description: 'Prioritas tampilan (higher = more important)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Prioritas harus berupa angka' })
  @Min(0, { message: 'Prioritas minimal 0' })
  @Max(100, { message: 'Prioritas maksimal 100' })
  priority?: number;

  @ApiPropertyOptional({
    description: 'Apakah dapat digunakan sebagai template',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is template harus berupa boolean' })
  isTemplate?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah dapat digunakan berulang kali',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is reusable harus berupa boolean' })
  isReusable?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah assignment memerlukan approval',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires approval harus berupa boolean' })
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Kode departemen terkait',
    example: 'SALES',
  })
  @IsOptional()
  @IsString({ message: 'Department code harus berupa teks' })
  @MaxLength(100, { message: 'Department code maksimal 100 karakter' })
  departmentCode?: string;

  @ApiPropertyOptional({
    description: 'Lokasi geografis',
    example: 'Jakarta',
  })
  @IsOptional()
  @IsString({ message: 'Location harus berupa teks' })
  @MaxLength(100, { message: 'Location maksimal 100 karakter' })
  location?: string;
}

// Create permission set DTO
export class CreatePermissionSetDto extends BasePermissionSetDto {
  @ApiPropertyOptional({
    description: 'Array ID permission yang akan disertakan',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '987fcdeb-51a2-43d1-9f4e-123456789abc',
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Permission IDs harus berupa array' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap permission ID harus berupa UUID yang valid',
  })
  permissionIds?: string[];

  @ApiPropertyOptional({
    description: 'ID permission set yang akan di-inherit',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Inherits from ID harus berupa UUID yang valid' })
  inheritsFromId?: string;

  @ApiPropertyOptional({
    description: 'ID role yang dapat melakukan approval assignment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Approval role ID harus berupa UUID yang valid' })
  approvalRoleId?: string;

  @ApiPropertyOptional({
    description: 'Timeout approval dalam jam',
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Approval timeout harus berupa angka' })
  @Min(1, { message: 'Approval timeout minimal 1 jam' })
  @Max(168, { message: 'Approval timeout maksimal 168 jam' })
  approvalTimeout?: number;

  @ApiPropertyOptional({
    description: 'Kondisi dan pembatasan untuk permission set',
    example: {
      timeRestriction: {
        validFrom: '2024-01-01',
        validUntil: '2024-12-31',
        allowedHours: {
          monday: { start: '08:00', end: '17:00' },
        },
      },
      ipRestriction: {
        allowedIps: ['192.168.1.0/24'],
        blockedIps: ['10.0.0.100'],
      },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Conditions harus berupa objek' })
  conditions?: {
    timeRestriction?: {
      validFrom?: string;
      validUntil?: string;
      allowedHours?: Record<string, { start: string; end: string }>;
    };
    ipRestriction?: {
      allowedIps?: string[];
      blockedIps?: string[];
    };
    resourceRestriction?: {
      allowedResources?: string[];
      maxRecords?: number;
    };
  };

  @ApiPropertyOptional({
    description: 'Tags untuk pencarian',
    example: ['sales', 'manager', 'regional'],
  })
  @IsOptional()
  @IsArray({ message: 'Tags harus berupa array' })
  @IsString({ each: true, message: 'Setiap tag harus berupa string' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Metadata tambahan',
    example: { businessUnit: 'Sales', region: 'Asia', level: 'manager' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata harus berupa objek' })
  metadata?: Record<string, any>;
}

// Update permission set DTO
export class UpdatePermissionSetDto extends PartialType(
  CreatePermissionSetDto,
) {
  @ApiPropertyOptional({
    description: 'Status permission set',
    enum: PermissionSetStatus,
    example: PermissionSetStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(PermissionSetStatus, { message: 'Status permission set tidak valid' })
  status?: PermissionSetStatus;
}

// Permission set query DTO
export class PermissionSetQueryDto {
  @ApiPropertyOptional({
    description: 'Jenis permission set',
    enum: PermissionSetType,
  })
  @IsOptional()
  @IsEnum(PermissionSetType, { message: 'Jenis permission set tidak valid' })
  type?: PermissionSetType;

  @ApiPropertyOptional({
    description: 'Status permission set',
    enum: PermissionSetStatus,
  })
  @IsOptional()
  @IsEnum(PermissionSetStatus, { message: 'Status permission set tidak valid' })
  status?: PermissionSetStatus;

  @ApiPropertyOptional({
    description: 'Scope permission set',
    enum: PermissionSetScope,
  })
  @IsOptional()
  @IsEnum(PermissionSetScope, { message: 'Scope permission set tidak valid' })
  scope?: PermissionSetScope;

  @ApiPropertyOptional({
    description: 'Kategori',
  })
  @IsOptional()
  @IsString({ message: 'Kategori harus berupa teks' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Sub-kategori',
  })
  @IsOptional()
  @IsString({ message: 'Sub-kategori harus berupa teks' })
  subcategory?: string;

  @ApiPropertyOptional({
    description: 'Kode departemen',
  })
  @IsOptional()
  @IsString({ message: 'Department code harus berupa teks' })
  departmentCode?: string;

  @ApiPropertyOptional({
    description: 'Lokasi',
  })
  @IsOptional()
  @IsString({ message: 'Location harus berupa teks' })
  location?: string;

  @ApiPropertyOptional({
    description: 'Kata kunci pencarian',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa teks' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Sertakan permission set tidak aktif',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include inactive harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;

  @ApiPropertyOptional({
    description: 'Hanya tampilkan templates',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Templates only harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  templatesOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Batas hasil',
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

// Clone permission set DTO
export class ClonePermissionSetDto {
  @ApiProperty({
    description: 'Kode permission set baru',
    example: 'SALES_MANAGER_PERMS_V2',
  })
  @IsString({ message: 'Kode permission set baru harus berupa teks' })
  @MinLength(2, { message: 'Kode permission set minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode permission set maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  newCode: string;

  @ApiProperty({
    description: 'Nama permission set baru',
    example: 'Sales Manager Permissions V2',
  })
  @IsString({ message: 'Nama permission set baru harus berupa teks' })
  @MinLength(1, { message: 'Nama permission set tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama permission set maksimal 100 karakter' })
  newName: string;

  @ApiPropertyOptional({
    description: 'Alasan cloning',
    example: 'Template untuk role manager di region berbeda',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Create template DTO
export class CreateTemplateDto {
  @ApiProperty({
    description: 'Kode template',
    example: 'TEMPLATE_SALES_MANAGER',
  })
  @IsString({ message: 'Kode template harus berupa teks' })
  @MinLength(2, { message: 'Kode template minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode template maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  templateCode: string;

  @ApiProperty({
    description: 'Nama template',
    example: 'Template Sales Manager',
  })
  @IsString({ message: 'Nama template harus berupa teks' })
  @MinLength(1, { message: 'Nama template tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama template maksimal 100 karakter' })
  templateName: string;

  @ApiPropertyOptional({
    description: 'Deskripsi template',
    example: 'Template reusable untuk role sales manager',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi template harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi template maksimal 500 karakter' })
  description?: string;
}

// Apply template DTO
export class ApplyTemplateDto {
  @ApiProperty({
    description: 'Kode permission set baru',
    example: 'SALES_MANAGER_JAKARTA',
  })
  @IsString({ message: 'Kode permission set baru harus berupa teks' })
  @MinLength(2, { message: 'Kode permission set minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode permission set maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  newCode: string;

  @ApiProperty({
    description: 'Nama permission set baru',
    example: 'Sales Manager Jakarta',
  })
  @IsString({ message: 'Nama permission set baru harus berupa teks' })
  @MinLength(1, { message: 'Nama permission set tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama permission set maksimal 100 karakter' })
  newName: string;

  @ApiPropertyOptional({
    description: 'Permission tambahan yang akan ditambahkan',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray({ message: 'Add permissions harus berupa array' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap permission ID harus berupa UUID yang valid',
  })
  addPermissions?: string[];

  @ApiPropertyOptional({
    description: 'Permission yang akan dihapus dari template',
    example: ['987fcdeb-51a2-43d1-9f4e-123456789abc'],
  })
  @IsOptional()
  @IsArray({ message: 'Remove permissions harus berupa array' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap permission ID harus berupa UUID yang valid',
  })
  removePermissions?: string[];

  @ApiPropertyOptional({
    description: 'Kondisi kustom untuk permission set',
  })
  @IsOptional()
  @IsObject({ message: 'Conditions harus berupa objek' })
  conditions?: any;
}

// Add/Remove permission DTO
export class ManagePermissionDto {
  @ApiProperty({
    description: 'ID permission',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Permission ID harus berupa UUID yang valid' })
  permissionId: string;

  @ApiPropertyOptional({
    description: 'Alasan penambahan/penghapusan',
    example: 'Penambahan akses untuk project khusus',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Bulk update status DTO
export class BulkUpdatePermissionSetStatusDto {
  @ApiProperty({
    description: 'Array ID permission set',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '987fcdeb-51a2-43d1-9f4e-123456789abc',
    ],
  })
  @IsArray({ message: 'Permission set IDs harus berupa array' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap ID harus berupa UUID yang valid',
  })
  permissionSetIds: string[];

  @ApiProperty({
    description: 'Status baru',
    enum: PermissionSetStatus,
    example: PermissionSetStatus.INACTIVE,
  })
  @IsEnum(PermissionSetStatus, { message: 'Status tidak valid' })
  status: PermissionSetStatus;

  @ApiPropertyOptional({
    description: 'Alasan perubahan status',
    example: 'Reorganisasi permission sets',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Check permission DTO
export class CheckPermissionDto {
  @ApiProperty({
    description: 'Key permission yang akan dicek',
    example: 'products:create',
  })
  @IsString({ message: 'Permission key harus berupa teks' })
  permissionKey: string;

  @ApiPropertyOptional({
    description: 'Context untuk pemeriksaan permission',
    example: {
      departmentId: '123e4567-e89b-12d3-a456-426614174000',
      ipAddress: '192.168.1.100',
    },
  })
  @IsOptional()
  @IsObject({ message: 'Context harus berupa objek' })
  context?: {
    departmentId?: string;
    userId?: string;
    ipAddress?: string;
    timestamp?: string;
  };
}

// Compare permission sets DTO
export class ComparePermissionSetsDto {
  @ApiProperty({
    description: 'ID permission set pertama',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', {
    message: 'First permission set ID harus berupa UUID yang valid',
  })
  firstPermissionSetId: string;

  @ApiProperty({
    description: 'ID permission set kedua',
    example: '987fcdeb-51a2-43d1-9f4e-123456789abc',
  })
  @IsUUID('4', {
    message: 'Second permission set ID harus berupa UUID yang valid',
  })
  secondPermissionSetId: string;
}

// Import permission set DTO
export class ImportPermissionSetDto {
  @ApiProperty({
    description: 'Data permission set yang akan diimport',
    example: {
      name: 'Imported Permission Set',
      code: 'IMPORTED_PERMS',
      type: 'custom',
      scope: 'tenant',
      permissions: ['products:read', 'inventory:update'],
    },
  })
  @IsObject({ message: 'Import data harus berupa objek' })
  importData: any;

  @ApiPropertyOptional({
    description: 'Apakah akan menimpa jika kode sudah ada',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Overwrite existing harus berupa boolean' })
  overwriteExisting?: boolean;
}

// Response DTOs
export class PermissionSetResponseDto {
  @ApiProperty({ description: 'ID permission set' })
  id: string;

  @ApiProperty({ description: 'Nama permission set' })
  name: string;

  @ApiProperty({ description: 'Kode permission set' })
  code: string;

  @ApiPropertyOptional({ description: 'Deskripsi permission set' })
  description?: string;

  @ApiProperty({ description: 'Jenis permission set', enum: PermissionSetType })
  type: PermissionSetType;

  @ApiProperty({
    description: 'Status permission set',
    enum: PermissionSetStatus,
  })
  status: PermissionSetStatus;

  @ApiProperty({
    description: 'Scope permission set',
    enum: PermissionSetScope,
  })
  scope: PermissionSetScope;

  @ApiPropertyOptional({ description: 'Kategori' })
  category?: string;

  @ApiPropertyOptional({ description: 'Sub-kategori' })
  subcategory?: string;

  @ApiProperty({ description: 'Prioritas' })
  priority: number;

  @ApiProperty({ description: 'Apakah template' })
  isTemplate: boolean;

  @ApiProperty({ description: 'Apakah reusable' })
  isReusable: boolean;

  @ApiProperty({ description: 'Jumlah permission' })
  permissionCount: number;

  @ApiProperty({ description: 'Jumlah penggunaan' })
  usageCount: number;

  @ApiPropertyOptional({ description: 'Terakhir digunakan' })
  lastUsedAt?: Date;

  @ApiPropertyOptional({ description: 'Kondisi dan pembatasan' })
  conditions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Versi' })
  version: string;

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;

  @ApiProperty({ description: 'Tanggal diperbarui' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Daftar permission', type: [String] })
  permissions?: string[];
}

export class PermissionSetStatsDto {
  @ApiProperty({ description: 'Total permission set' })
  total: number;

  @ApiProperty({ description: 'Permission set aktif' })
  active: number;

  @ApiProperty({ description: 'Permission set tidak aktif' })
  inactive: number;

  @ApiProperty({ description: 'Permission set draft' })
  draft: number;

  @ApiProperty({ description: 'Permission set archived' })
  archived: number;

  @ApiProperty({
    description: 'Statistik berdasarkan jenis',
    example: {
      system: 5,
      template: 10,
      custom: 25,
      department: 15,
      function: 20,
      project: 10,
    },
  })
  byType: Record<string, number>;

  @ApiProperty({
    description: 'Statistik berdasarkan scope',
    example: {
      global: 5,
      tenant: 30,
      department: 25,
      team: 15,
      user: 10,
    },
  })
  byScope: Record<string, number>;

  @ApiProperty({ description: 'Jumlah template' })
  templates: number;

  @ApiProperty({ description: 'Total penggunaan' })
  totalUsage: number;

  @ApiProperty({ description: 'Rata-rata permission per set' })
  averagePermissions: number;
}

export class PermissionSetComparisonDto {
  @ApiProperty({ description: 'Permission yang sama' })
  common: string[];

  @ApiProperty({ description: 'Permission hanya di set pertama' })
  onlyInFirst: string[];

  @ApiProperty({ description: 'Permission hanya di set kedua' })
  onlyInSecond: string[];

  @ApiProperty({ description: 'Permission set pertama' })
  firstSet: PermissionSetResponseDto;

  @ApiProperty({ description: 'Permission set kedua' })
  secondSet: PermissionSetResponseDto;
}
