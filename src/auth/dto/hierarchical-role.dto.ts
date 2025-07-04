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
  RoleType,
  RoleLevel,
  RoleStatus,
} from '../entities/hierarchical-role.entity';
import {
  InheritanceType,
  HierarchyStatus,
} from '../entities/role-hierarchy.entity';

// Base hierarchical role DTO
export class BaseHierarchicalRoleDto {
  @ApiProperty({
    description: 'Nama role',
    example: 'Manager Penjualan Regional',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama role harus berupa teks' })
  @MinLength(1, { message: 'Nama role tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama role maksimal 100 karakter' })
  name: string;

  @ApiProperty({
    description: 'Kode unik role',
    example: 'SALES_MANAGER_REG',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Kode role harus berupa teks' })
  @MinLength(2, { message: 'Kode role minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode role maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiPropertyOptional({
    description: 'Deskripsi role',
    example:
      'Manager penjualan untuk wilayah regional dengan tanggung jawab tim dan target',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Jenis role',
    enum: RoleType,
    example: RoleType.DEPARTMENTAL,
  })
  @IsEnum(RoleType, { message: 'Jenis role tidak valid' })
  type: RoleType;

  @ApiProperty({
    description: 'Level role dalam hierarki',
    enum: RoleLevel,
    example: RoleLevel.MIDDLE,
  })
  @IsEnum(RoleLevel, { message: 'Level role tidak valid' })
  level: RoleLevel;

  @ApiPropertyOptional({
    description: 'Apakah role mewarisi permission dari parent',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Inherits permissions harus berupa boolean' })
  inheritsPermissions?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah role dapat memberikan permission ke child role',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Grants permissions harus berupa boolean' })
  grantsPermissions?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah role ini adalah executive role',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is executive role harus berupa boolean' })
  isExecutiveRole?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah assignment role ini memerlukan approval',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires approval harus berupa boolean' })
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Scope role (Global, Department, Team, dll)',
    example: 'Department',
  })
  @IsOptional()
  @IsString({ message: 'Scope harus berupa teks' })
  @MaxLength(100, { message: 'Scope maksimal 100 karakter' })
  scope?: string;

  @ApiPropertyOptional({
    description: 'Maksimal user yang dapat memiliki role ini',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max users harus berupa angka' })
  @Min(1, { message: 'Max users minimal 1' })
  maxUsers?: number;

  @ApiPropertyOptional({
    description: 'Apakah role memerlukan MFA',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires MFA harus berupa boolean' })
  requiresMfa?: boolean;

  @ApiPropertyOptional({
    description: 'Departemen terkait',
    example: 'SALES',
  })
  @IsOptional()
  @IsString({ message: 'Department harus berupa teks' })
  @MaxLength(100, { message: 'Department maksimal 100 karakter' })
  department?: string;

  @ApiPropertyOptional({
    description: 'Fungsi bisnis',
    example: 'Sales',
  })
  @IsOptional()
  @IsString({ message: 'Function harus berupa teks' })
  @MaxLength(100, { message: 'Function maksimal 100 karakter' })
  function?: string;

  @ApiPropertyOptional({
    description: 'Lokasi geografis',
    example: 'Jakarta',
  })
  @IsOptional()
  @IsString({ message: 'Location harus berupa teks' })
  @MaxLength(100, { message: 'Location maksimal 100 karakter' })
  location?: string;
}

// Create hierarchical role DTO
export class CreateHierarchicalRoleDto extends BaseHierarchicalRoleDto {
  @ApiPropertyOptional({
    description: 'ID role parent',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID role parent harus berupa UUID yang valid' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'ID role yang dapat melakukan approval assignment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID approval role harus berupa UUID yang valid' })
  approvalRoleId?: string;

  @ApiPropertyOptional({
    description: 'Timeout approval dalam jam',
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Approval timeout harus berupa angka' })
  @Min(1, { message: 'Approval timeout minimal 1 jam' })
  @Max(168, { message: 'Approval timeout maksimal 168 jam (1 minggu)' })
  approvalTimeout?: number;

  @ApiPropertyOptional({
    description: 'Tanggal mulai berlaku',
  })
  @IsOptional()
  @Type(() => Date)
  validFrom?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal berakhir',
  })
  @IsOptional()
  @Type(() => Date)
  validUntil?: Date;

  @ApiPropertyOptional({
    description: 'Whitelist IP address',
    example: ['192.168.1.0/24', '10.0.0.1'],
  })
  @IsOptional()
  @IsArray({ message: 'IP whitelist harus berupa array' })
  @IsString({ each: true, message: 'Setiap IP harus berupa string' })
  ipWhitelist?: string[];

  @ApiPropertyOptional({
    description: 'Jam kerja yang diizinkan',
    example: {
      monday: { start: '08:00', end: '17:00' },
      tuesday: { start: '08:00', end: '17:00' },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Allowed hours harus berupa objek' })
  allowedHours?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };

  @ApiPropertyOptional({
    description: 'Metadata tambahan',
    example: { businessUnit: 'Sales', region: 'Asia' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata harus berupa objek' })
  metadata?: Record<string, any>;
}

// Update hierarchical role DTO
export class UpdateHierarchicalRoleDto extends PartialType(
  CreateHierarchicalRoleDto,
) {
  @ApiPropertyOptional({
    description: 'Status role',
    enum: RoleStatus,
    example: RoleStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RoleStatus, { message: 'Status role tidak valid' })
  status?: RoleStatus;
}

// Create role hierarchy DTO
export class CreateRoleHierarchyDto {
  @ApiProperty({
    description: 'ID role parent (yang memberikan permission)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID role parent harus berupa UUID yang valid' })
  parentRoleId: string;

  @ApiProperty({
    description: 'ID role child (yang menerima permission)',
    example: '987fcdeb-51a2-43d1-9f4e-123456789abc',
  })
  @IsUUID('4', { message: 'ID role child harus berupa UUID yang valid' })
  childRoleId: string;

  @ApiProperty({
    description: 'Jenis inheritance',
    enum: InheritanceType,
    example: InheritanceType.FULL,
  })
  @IsEnum(InheritanceType, { message: 'Jenis inheritance tidak valid' })
  inheritanceType: InheritanceType;

  @ApiPropertyOptional({
    description: 'Permission yang secara khusus diinclude',
    example: ['products:read', 'inventory:update'],
  })
  @IsOptional()
  @IsArray({ message: 'Included permissions harus berupa array' })
  @IsString({ each: true, message: 'Setiap permission harus berupa string' })
  includedPermissions?: string[];

  @ApiPropertyOptional({
    description: 'Permission yang secara khusus diexclude',
    example: ['users:delete', 'settings:manage_system'],
  })
  @IsOptional()
  @IsArray({ message: 'Excluded permissions harus berupa array' })
  @IsString({ each: true, message: 'Setiap permission harus berupa string' })
  excludedPermissions?: string[];

  @ApiPropertyOptional({
    description: 'Kondisi dan pembatasan inheritance',
    example: {
      departmentRestriction: {
        allowedDepartments: ['SALES', 'MARKETING'],
      },
      timeRestriction: {
        validFrom: '2024-01-01',
        validUntil: '2024-12-31',
      },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Conditions harus berupa objek' })
  conditions?: {
    departmentRestriction?: {
      allowedDepartments?: string[];
      excludedDepartments?: string[];
    };
    timeRestriction?: {
      validFrom?: string;
      validUntil?: string;
      allowedHours?: Record<string, { start: string; end: string }>;
    };
    contextRestriction?: {
      requiresSameLocation?: boolean;
      requiresSameDepartment?: boolean;
      requiresApproval?: boolean;
    };
  };

  @ApiPropertyOptional({
    description: 'Alasan pembuatan hierarki',
    example: 'Struktur organisasi baru untuk delegasi authority',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Tanggal mulai berlaku',
  })
  @IsOptional()
  @Type(() => Date)
  validFrom?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal berakhir',
  })
  @IsOptional()
  @Type(() => Date)
  validUntil?: Date;
}

// Role query DTO
export class HierarchicalRoleQueryDto {
  @ApiPropertyOptional({
    description: 'Jenis role',
    enum: RoleType,
  })
  @IsOptional()
  @IsEnum(RoleType, { message: 'Jenis role tidak valid' })
  type?: RoleType;

  @ApiPropertyOptional({
    description: 'Status role',
    enum: RoleStatus,
  })
  @IsOptional()
  @IsEnum(RoleStatus, { message: 'Status role tidak valid' })
  status?: RoleStatus;

  @ApiPropertyOptional({
    description: 'Level role',
    enum: RoleLevel,
  })
  @IsOptional()
  @IsEnum(RoleLevel, { message: 'Level role tidak valid' })
  level?: RoleLevel;

  @ApiPropertyOptional({
    description: 'ID role parent',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID role parent harus berupa UUID yang valid' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Departemen',
  })
  @IsOptional()
  @IsString({ message: 'Department harus berupa teks' })
  department?: string;

  @ApiPropertyOptional({
    description: 'Fungsi bisnis',
  })
  @IsOptional()
  @IsString({ message: 'Function harus berupa teks' })
  function?: string;

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
    description: 'Sertakan role tidak aktif',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include inactive harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;

  @ApiPropertyOptional({
    description: 'Hanya tampilkan system roles',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'System roles only harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  systemRolesOnly?: boolean;

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

// Clone role DTO
export class CloneRoleDto {
  @ApiProperty({
    description: 'Kode role baru',
    example: 'SALES_MANAGER_REG_V2',
  })
  @IsString({ message: 'Kode role baru harus berupa teks' })
  @MinLength(2, { message: 'Kode role minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode role maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  newCode: string;

  @ApiProperty({
    description: 'Nama role baru',
    example: 'Manager Penjualan Regional V2',
  })
  @IsString({ message: 'Nama role baru harus berupa teks' })
  @MinLength(1, { message: 'Nama role tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama role maksimal 100 karakter' })
  newName: string;

  @ApiPropertyOptional({
    description: 'Alasan cloning',
    example: 'Template untuk role serupa di region lain',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Bulk update status DTO
export class BulkUpdateRoleStatusDto {
  @ApiProperty({
    description: 'Array ID role',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '987fcdeb-51a2-43d1-9f4e-123456789abc',
    ],
  })
  @IsArray({ message: 'Role IDs harus berupa array' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap ID harus berupa UUID yang valid',
  })
  roleIds: string[];

  @ApiProperty({
    description: 'Status baru',
    enum: RoleStatus,
    example: RoleStatus.INACTIVE,
  })
  @IsEnum(RoleStatus, { message: 'Status tidak valid' })
  status: RoleStatus;

  @ApiPropertyOptional({
    description: 'Alasan perubahan status',
    example: 'Reorganisasi struktur role',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Permission grant/check DTO
export class PermissionGrantDto {
  @ApiProperty({
    description: 'ID role yang memberikan permission',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID granting role harus berupa UUID yang valid' })
  grantingRoleId: string;

  @ApiProperty({
    description: 'ID role yang menerima permission',
    example: '987fcdeb-51a2-43d1-9f4e-123456789abc',
  })
  @IsUUID('4', { message: 'ID receiving role harus berupa UUID yang valid' })
  receivingRoleId: string;

  @ApiProperty({
    description: 'Key permission yang akan diberikan',
    example: 'products:create',
  })
  @IsString({ message: 'Permission key harus berupa teks' })
  permissionKey: string;

  @ApiPropertyOptional({
    description: 'Alasan pemberian permission',
    example: 'Delegasi tanggung jawab untuk project khusus',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Response DTOs
export class HierarchicalRoleResponseDto {
  @ApiProperty({ description: 'ID role' })
  id: string;

  @ApiProperty({ description: 'Nama role' })
  name: string;

  @ApiProperty({ description: 'Kode role' })
  code: string;

  @ApiPropertyOptional({ description: 'Deskripsi role' })
  description?: string;

  @ApiProperty({ description: 'Jenis role', enum: RoleType })
  type: RoleType;

  @ApiProperty({ description: 'Level role', enum: RoleLevel })
  level: RoleLevel;

  @ApiProperty({ description: 'Status role', enum: RoleStatus })
  status: RoleStatus;

  @ApiPropertyOptional({ description: 'ID role parent' })
  parentId?: string;

  @ApiPropertyOptional({ description: 'Informasi role parent' })
  parent?: Partial<HierarchicalRoleResponseDto>;

  @ApiPropertyOptional({
    description: 'Child roles',
    type: [HierarchicalRoleResponseDto],
  })
  children?: HierarchicalRoleResponseDto[];

  @ApiProperty({ description: 'Kedalaman dalam hierarki' })
  depth: number;

  @ApiPropertyOptional({ description: 'Path hierarki' })
  path?: string;

  @ApiProperty({ description: 'Apakah mewarisi permission' })
  inheritsPermissions: boolean;

  @ApiProperty({ description: 'Apakah dapat memberikan permission' })
  grantsPermissions: boolean;

  @ApiProperty({ description: 'Apakah role sistem' })
  isSystemRole: boolean;

  @ApiProperty({ description: 'Apakah role executive' })
  isExecutiveRole: boolean;

  @ApiProperty({ description: 'Jumlah user saat ini' })
  currentUsers: number;

  @ApiPropertyOptional({ description: 'Maksimal user' })
  maxUsers?: number;

  @ApiPropertyOptional({ description: 'Departemen terkait' })
  department?: string;

  @ApiPropertyOptional({ description: 'Fungsi bisnis' })
  function?: string;

  @ApiPropertyOptional({ description: 'Metadata tambahan' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;

  @ApiProperty({ description: 'Tanggal diperbarui' })
  updatedAt: Date;
}

export class RoleHierarchyResponseDto {
  @ApiProperty({ description: 'ID hierarki' })
  id: string;

  @ApiProperty({ description: 'Role parent' })
  parentRole: HierarchicalRoleResponseDto;

  @ApiProperty({ description: 'Role child' })
  childRole: HierarchicalRoleResponseDto;

  @ApiProperty({ description: 'Jenis inheritance', enum: InheritanceType })
  inheritanceType: InheritanceType;

  @ApiProperty({ description: 'Status hierarki', enum: HierarchyStatus })
  status: HierarchyStatus;

  @ApiProperty({ description: 'Kedalaman hierarki' })
  depth: number;

  @ApiPropertyOptional({ description: 'Permission yang diinclude' })
  includedPermissions?: string[];

  @ApiPropertyOptional({ description: 'Permission yang diexclude' })
  excludedPermissions?: string[];

  @ApiPropertyOptional({ description: 'Kondisi inheritance' })
  conditions?: Record<string, any>;

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;
}

export class RoleStatsDto {
  @ApiProperty({ description: 'Total role' })
  total: number;

  @ApiProperty({ description: 'Role aktif' })
  active: number;

  @ApiProperty({ description: 'Role tidak aktif' })
  inactive: number;

  @ApiProperty({ description: 'Role deprecated' })
  deprecated: number;

  @ApiProperty({
    description: 'Statistik berdasarkan jenis',
    example: {
      system: 5,
      organizational: 10,
      departmental: 20,
      functional: 15,
      custom: 30,
    },
  })
  byType: Record<string, number>;

  @ApiProperty({
    description: 'Statistik berdasarkan level',
    example: {
      executive: 5,
      senior: 10,
      middle: 15,
      junior: 20,
      staff: 30,
      intern: 5,
    },
  })
  byLevel: Record<string, number>;

  @ApiProperty({ description: 'Total user dengan role' })
  totalUsers: number;

  @ApiProperty({ description: 'Jumlah relationship inheritance' })
  inheritanceRelationships: number;
}
