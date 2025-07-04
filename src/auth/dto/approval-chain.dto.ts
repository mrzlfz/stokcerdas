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
  ApprovalType,
  ApprovalStatus,
  ApprovalMode,
  EscalationTrigger,
} from '../entities/approval-chain.entity';

// Base approval step DTO
export class BaseApprovalStepDto {
  @ApiProperty({
    description: 'Urutan step dalam approval chain',
    example: 1,
    minimum: 1,
  })
  @IsNumber({}, { message: 'Step order harus berupa angka' })
  @Min(1, { message: 'Step order minimal 1' })
  stepOrder: number;

  @ApiProperty({
    description: 'Nama step',
    example: 'Manager Approval',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama step harus berupa teks' })
  @MinLength(1, { message: 'Nama step tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama step maksimal 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi step',
    example: 'Persetujuan dari manager departemen',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;

  @ApiPropertyOptional({
    description: 'ID role yang dapat melakukan approval',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Approver role ID harus berupa UUID yang valid' })
  approverRoleId?: string;

  @ApiPropertyOptional({
    description: 'ID user spesifik yang dapat melakukan approval',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Approver user ID harus berupa UUID yang valid' })
  approverUserId?: string;

  @ApiPropertyOptional({
    description: 'Departemen yang dapat melakukan approval',
    example: 'SALES',
  })
  @IsOptional()
  @IsString({ message: 'Approver department harus berupa teks' })
  @MaxLength(100, { message: 'Approver department maksimal 100 karakter' })
  approverDepartment?: string;

  @ApiPropertyOptional({
    description: 'Apakah step ini wajib',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is required harus berupa boolean' })
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah approver dapat mendelegasikan',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow delegation harus berupa boolean' })
  allowDelegation?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah wajib memberikan komentar',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires comments harus berupa boolean' })
  requiresComments?: boolean;

  @ApiPropertyOptional({
    description: 'Timeout untuk step ini dalam jam',
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Timeout hours harus berupa angka' })
  @Min(1, { message: 'Timeout minimal 1 jam' })
  @Max(168, { message: 'Timeout maksimal 168 jam' })
  timeoutHours?: number;

  @ApiPropertyOptional({
    description: 'Apakah auto-approve dalam kondisi tertentu',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Auto approve harus berupa boolean' })
  autoApprove?: boolean;

  @ApiPropertyOptional({
    description: 'ID role untuk escalation step ini',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Escalation role ID harus berupa UUID yang valid' })
  escalationRoleId?: string;

  @ApiPropertyOptional({
    description: 'Timeout escalation untuk step ini dalam jam',
    minimum: 1,
    maximum: 72,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Escalation timeout harus berupa angka' })
  @Min(1, { message: 'Escalation timeout minimal 1 jam' })
  @Max(72, { message: 'Escalation timeout maksimal 72 jam' })
  escalationTimeoutHours?: number;

  @ApiPropertyOptional({
    description: 'Kondisi untuk skip, require, atau auto-approve',
    example: {
      skipIf: {
        amountBelow: 1000000,
        departmentMatches: ['SALES'],
      },
      autoApproveIf: {
        amountBelow: 500000,
        previouslyApproved: true,
      },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Conditions harus berupa objek' })
  conditions?: {
    skipIf?: {
      amountBelow?: number;
      departmentMatches?: string[];
      roleMatches?: string[];
      timeCondition?: string;
    };
    requireIf?: {
      amountAbove?: number;
      riskLevel?: string;
      departmentMatches?: string[];
    };
    autoApproveIf?: {
      amountBelow?: number;
      previouslyApproved?: boolean;
      trustLevel?: string;
    };
  };

  @ApiPropertyOptional({
    description: 'Metadata tambahan untuk step',
  })
  @IsOptional()
  @IsObject({ message: 'Metadata harus berupa objek' })
  metadata?: Record<string, any>;
}

// Base approval chain DTO
export class BaseApprovalChainDto {
  @ApiProperty({
    description: 'Nama approval chain',
    example: 'Purchase Order Approval',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Nama approval chain harus berupa teks' })
  @MinLength(1, { message: 'Nama approval chain tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama approval chain maksimal 100 karakter' })
  name: string;

  @ApiProperty({
    description: 'Kode unik approval chain',
    example: 'PO_APPROVAL',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Kode approval chain harus berupa teks' })
  @MinLength(2, { message: 'Kode approval chain minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode approval chain maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiPropertyOptional({
    description: 'Deskripsi approval chain',
    example:
      'Chain approval untuk purchase order berdasarkan amount dan departemen',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa teks' })
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;

  @ApiProperty({
    description: 'Jenis approval',
    enum: ApprovalType,
    example: ApprovalType.PURCHASE_ORDER,
  })
  @IsEnum(ApprovalType, { message: 'Jenis approval tidak valid' })
  type: ApprovalType;

  @ApiProperty({
    description: 'Mode approval',
    enum: ApprovalMode,
    example: ApprovalMode.SEQUENTIAL,
  })
  @IsEnum(ApprovalMode, { message: 'Mode approval tidak valid' })
  mode: ApprovalMode;

  @ApiPropertyOptional({
    description: 'ID departemen terkait',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Department ID harus berupa UUID yang valid' })
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Apakah boleh skip step tertentu',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow skipping harus berupa boolean' })
  allowSkipping?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah boleh delegasi approval',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow delegation harus berupa boolean' })
  allowDelegation?: boolean;

  @ApiPropertyOptional({
    description: 'Apakah wajib memberikan komentar',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires comments harus berupa boolean' })
  requiresComments?: boolean;

  @ApiPropertyOptional({
    description: 'Default timeout untuk setiap step dalam jam',
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Default timeout harus berupa angka' })
  @Min(1, { message: 'Default timeout minimal 1 jam' })
  @Max(168, { message: 'Default timeout maksimal 168 jam' })
  defaultTimeoutHours?: number;

  @ApiPropertyOptional({
    description: 'Maksimal total waktu untuk seluruh chain dalam jam',
    minimum: 1,
    maximum: 720,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max total time harus berupa angka' })
  @Min(1, { message: 'Max total time minimal 1 jam' })
  @Max(720, { message: 'Max total time maksimal 720 jam (30 hari)' })
  maxTotalTimeHours?: number;

  @ApiPropertyOptional({
    description: 'Apakah escalation diaktifkan',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Enable escalation harus berupa boolean' })
  enableEscalation?: boolean;

  @ApiPropertyOptional({
    description: 'Trigger untuk escalation',
    enum: EscalationTrigger,
  })
  @IsOptional()
  @IsEnum(EscalationTrigger, { message: 'Escalation trigger tidak valid' })
  escalationTrigger?: EscalationTrigger;

  @ApiPropertyOptional({
    description: 'Timeout escalation dalam jam',
    minimum: 1,
    maximum: 72,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Escalation timeout harus berupa angka' })
  @Min(1, { message: 'Escalation timeout minimal 1 jam' })
  @Max(72, { message: 'Escalation timeout maksimal 72 jam' })
  escalationTimeoutHours?: number;

  @ApiPropertyOptional({
    description: 'ID role untuk escalation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Escalation role ID harus berupa UUID yang valid' })
  escalationRoleId?: string;
}

// Create approval chain DTO
export class CreateApprovalChainDto extends BaseApprovalChainDto {
  @ApiPropertyOptional({
    description: 'Array step untuk approval chain',
    type: [BaseApprovalStepDto],
  })
  @IsOptional()
  @IsArray({ message: 'Steps harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => BaseApprovalStepDto)
  steps?: BaseApprovalStepDto[];

  @ApiPropertyOptional({
    description: 'Kondisi dan aturan bisnis',
    example: {
      amountThresholds: {
        step1: 1000000,
        step2: 5000000,
        step3: 10000000,
      },
      departmentRules: {
        SALES: {
          skipSteps: [1],
          additionalApprovers: ['user-id-1'],
        },
      },
      timeBasedRules: {
        businessHoursOnly: true,
        weekdaysOnly: false,
      },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Conditions harus berupa objek' })
  conditions?: {
    amountThresholds?: {
      step1?: number;
      step2?: number;
      step3?: number;
    };
    departmentRules?: {
      [departmentId: string]: {
        skipSteps?: number[];
        additionalApprovers?: string[];
      };
    };
    userRules?: {
      [userId: string]: {
        skipSteps?: number[];
        requireAdditionalApproval?: boolean;
      };
    };
    timeBasedRules?: {
      businessHoursOnly?: boolean;
      weekdaysOnly?: boolean;
      excludeHolidays?: boolean;
    };
  };

  @ApiPropertyOptional({
    description: 'Pengaturan notifikasi',
    example: {
      onSubmission: {
        email: true,
        sms: false,
        inApp: true,
      },
      onApproval: {
        email: true,
        sms: false,
        inApp: true,
      },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Notification settings harus berupa objek' })
  notificationSettings?: {
    onSubmission?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onApproval?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onRejection?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onTimeout?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    onEscalation?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
  };

  @ApiPropertyOptional({
    description: 'Metadata tambahan',
  })
  @IsOptional()
  @IsObject({ message: 'Metadata harus berupa objek' })
  metadata?: Record<string, any>;
}

// Update approval chain DTO
export class UpdateApprovalChainDto extends PartialType(
  CreateApprovalChainDto,
) {
  @ApiPropertyOptional({
    description: 'Status approval chain',
    enum: ApprovalStatus,
    example: ApprovalStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ApprovalStatus, { message: 'Status approval chain tidak valid' })
  status?: ApprovalStatus;
}

// Approval chain query DTO
export class ApprovalChainQueryDto {
  @ApiPropertyOptional({
    description: 'Jenis approval',
    enum: ApprovalType,
  })
  @IsOptional()
  @IsEnum(ApprovalType, { message: 'Jenis approval tidak valid' })
  type?: ApprovalType;

  @ApiPropertyOptional({
    description: 'Status approval chain',
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsEnum(ApprovalStatus, { message: 'Status approval chain tidak valid' })
  status?: ApprovalStatus;

  @ApiPropertyOptional({
    description: 'Mode approval',
    enum: ApprovalMode,
  })
  @IsOptional()
  @IsEnum(ApprovalMode, { message: 'Mode approval tidak valid' })
  mode?: ApprovalMode;

  @ApiPropertyOptional({
    description: 'ID departemen',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Department ID harus berupa UUID yang valid' })
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Kata kunci pencarian',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa teks' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Sertakan chain tidak aktif',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include inactive harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;

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

// Clone approval chain DTO
export class CloneApprovalChainDto {
  @ApiProperty({
    description: 'Kode approval chain baru',
    example: 'PO_APPROVAL_V2',
  })
  @IsString({ message: 'Kode approval chain baru harus berupa teks' })
  @MinLength(2, { message: 'Kode approval chain minimal 2 karakter' })
  @MaxLength(50, { message: 'Kode approval chain maksimal 50 karakter' })
  @Transform(({ value }) => value?.toUpperCase())
  newCode: string;

  @ApiProperty({
    description: 'Nama approval chain baru',
    example: 'Purchase Order Approval V2',
  })
  @IsString({ message: 'Nama approval chain baru harus berupa teks' })
  @MinLength(1, { message: 'Nama approval chain tidak boleh kosong' })
  @MaxLength(100, { message: 'Nama approval chain maksimal 100 karakter' })
  newName: string;

  @ApiPropertyOptional({
    description: 'Alasan cloning',
    example: 'Template untuk departemen berbeda',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Bulk update status DTO
export class BulkUpdateApprovalChainStatusDto {
  @ApiProperty({
    description: 'Array ID approval chain',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '987fcdeb-51a2-43d1-9f4e-123456789abc',
    ],
  })
  @IsArray({ message: 'Chain IDs harus berupa array' })
  @IsUUID('4', {
    each: true,
    message: 'Setiap ID harus berupa UUID yang valid',
  })
  chainIds: string[];

  @ApiProperty({
    description: 'Status baru',
    enum: ApprovalStatus,
    example: ApprovalStatus.INACTIVE,
  })
  @IsEnum(ApprovalStatus, { message: 'Status tidak valid' })
  status: ApprovalStatus;

  @ApiPropertyOptional({
    description: 'Alasan perubahan status',
    example: 'Reorganisasi approval process',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa teks' })
  @MaxLength(200, { message: 'Reason maksimal 200 karakter' })
  reason?: string;
}

// Test approval chain DTO
export class TestApprovalChainDto {
  @ApiProperty({
    description: 'Data request untuk testing',
    example: {
      type: 'purchase_order',
      amount: 5000000,
      department: 'SALES',
      requesterId: 'user-123',
    },
  })
  @IsObject({ message: 'Test request harus berupa objek' })
  testRequest: {
    type: ApprovalType;
    requesterId: string;
    requestData: any;
    context: {
      amount?: number;
      department?: string;
      role?: string;
      [key: string]: any;
    };
  };
}

// Approval execution DTO
export class ApprovalExecutionDto {
  @ApiProperty({
    description: 'ID request yang akan diproses',
    example: 'req_123456789',
  })
  @IsString({ message: 'Request ID harus berupa teks' })
  requestId: string;

  @ApiProperty({
    description: 'Jenis approval',
    enum: ApprovalType,
    example: ApprovalType.PURCHASE_ORDER,
  })
  @IsEnum(ApprovalType, { message: 'Jenis approval tidak valid' })
  type: ApprovalType;

  @ApiProperty({
    description: 'Data request',
    example: {
      purchaseOrderId: 'po-12345',
      amount: 5000000,
      vendor: 'PT ABC',
    },
  })
  @IsObject({ message: 'Request data harus berupa objek' })
  requestData: any;

  @ApiProperty({
    description: 'Context untuk approval',
    example: {
      amount: 5000000,
      department: 'SALES',
      role: 'MANAGER',
    },
  })
  @IsObject({ message: 'Context harus berupa objek' })
  context: {
    amount?: number;
    department?: string;
    role?: string;
    [key: string]: any;
  };
}

// Approval response DTO
export class ApprovalResponseDto {
  @ApiProperty({
    description: 'ID execution',
    example: 'exec_123456789',
  })
  @IsString({ message: 'Execution ID harus berupa teks' })
  executionId: string;

  @ApiProperty({
    description: 'Urutan step',
    example: 1,
  })
  @IsNumber({}, { message: 'Step order harus berupa angka' })
  @Min(1, { message: 'Step order minimal 1' })
  stepOrder: number;

  @ApiProperty({
    description: 'Apakah disetujui',
    example: true,
  })
  @IsBoolean({ message: 'Approved harus berupa boolean' })
  approved: boolean;

  @ApiPropertyOptional({
    description: 'Komentar approval',
    example: 'Approved with additional monitoring required',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa teks' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;

  @ApiPropertyOptional({
    description: 'ID user untuk delegasi (jika applicable)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Delegate to harus berupa UUID yang valid' })
  delegateTo?: string;
}

// Response DTOs
export class ApprovalStepResponseDto {
  @ApiProperty({ description: 'ID step' })
  id: string;

  @ApiProperty({ description: 'Urutan step' })
  stepOrder: number;

  @ApiProperty({ description: 'Nama step' })
  name: string;

  @ApiPropertyOptional({ description: 'Deskripsi step' })
  description?: string;

  @ApiPropertyOptional({ description: 'ID approver role' })
  approverRoleId?: string;

  @ApiPropertyOptional({ description: 'ID approver user' })
  approverUserId?: string;

  @ApiPropertyOptional({ description: 'Approver department' })
  approverDepartment?: string;

  @ApiProperty({ description: 'Apakah step wajib' })
  isRequired: boolean;

  @ApiProperty({ description: 'Apakah boleh delegasi' })
  allowDelegation: boolean;

  @ApiProperty({ description: 'Apakah wajib komentar' })
  requiresComments: boolean;

  @ApiPropertyOptional({ description: 'Timeout dalam jam' })
  timeoutHours?: number;

  @ApiProperty({ description: 'Apakah auto approve' })
  autoApprove: boolean;

  @ApiPropertyOptional({ description: 'Kondisi step' })
  conditions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Metadata step' })
  metadata?: Record<string, any>;
}

export class ApprovalChainResponseDto {
  @ApiProperty({ description: 'ID approval chain' })
  id: string;

  @ApiProperty({ description: 'Nama approval chain' })
  name: string;

  @ApiProperty({ description: 'Kode approval chain' })
  code: string;

  @ApiPropertyOptional({ description: 'Deskripsi approval chain' })
  description?: string;

  @ApiProperty({ description: 'Jenis approval', enum: ApprovalType })
  type: ApprovalType;

  @ApiProperty({ description: 'Status approval chain', enum: ApprovalStatus })
  status: ApprovalStatus;

  @ApiProperty({ description: 'Mode approval', enum: ApprovalMode })
  mode: ApprovalMode;

  @ApiPropertyOptional({ description: 'ID departemen' })
  departmentId?: string;

  @ApiProperty({ description: 'Jumlah step' })
  stepCount: number;

  @ApiProperty({ description: 'Apakah system defined' })
  isSystemDefined: boolean;

  @ApiProperty({ description: 'Apakah aktif' })
  isActive: boolean;

  @ApiProperty({ description: 'Jumlah penggunaan' })
  usageCount: number;

  @ApiPropertyOptional({ description: 'Terakhir digunakan' })
  lastUsedAt?: Date;

  @ApiPropertyOptional({ description: 'Default timeout dalam jam' })
  defaultTimeoutHours?: number;

  @ApiProperty({ description: 'Apakah escalation aktif' })
  enableEscalation: boolean;

  @ApiPropertyOptional({ description: 'Kondisi dan aturan' })
  conditions?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Pengaturan notifikasi' })
  notificationSettings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Statistik penggunaan' })
  usageStats?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Array step',
    type: [ApprovalStepResponseDto],
  })
  steps?: ApprovalStepResponseDto[];

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;

  @ApiProperty({ description: 'Tanggal diperbarui' })
  updatedAt: Date;
}

export class ApprovalChainStatsDto {
  @ApiProperty({ description: 'Total approval chain' })
  total: number;

  @ApiProperty({ description: 'Chain aktif' })
  active: number;

  @ApiProperty({ description: 'Chain tidak aktif' })
  inactive: number;

  @ApiProperty({ description: 'Chain draft' })
  draft: number;

  @ApiProperty({ description: 'Chain archived' })
  archived: number;

  @ApiProperty({
    description: 'Statistik berdasarkan jenis',
    example: {
      roleAssignment: 5,
      permissionGrant: 3,
      accessRequest: 8,
      purchaseOrder: 10,
      custom: 15,
    },
  })
  byType: Record<string, number>;

  @ApiProperty({
    description: 'Statistik berdasarkan mode',
    example: {
      sequential: 25,
      parallel: 8,
      majority: 5,
      unanimous: 2,
      firstResponse: 1,
    },
  })
  byMode: Record<string, number>;

  @ApiProperty({ description: 'Total penggunaan' })
  totalUsage: number;

  @ApiProperty({ description: 'Rata-rata step per chain' })
  averageSteps: number;

  @ApiProperty({ description: 'Chain dengan escalation' })
  escalationEnabled: number;
}

export class ApprovalChainValidationDto {
  @ApiProperty({ description: 'Apakah konfigurasi valid' })
  isValid: boolean;

  @ApiProperty({ description: 'Array error', type: [String] })
  errors: string[];

  @ApiProperty({ description: 'Array warning', type: [String] })
  warnings: string[];
}

export class ApprovalChainTestResultDto {
  @ApiProperty({ description: 'ID chain yang ditest' })
  chainId: string;

  @ApiProperty({ description: 'Hasil test', enum: ['success', 'error'] })
  testResult: 'success' | 'error';

  @ApiProperty({ description: 'Simulasi execution' })
  simulatedExecution: any;

  @ApiPropertyOptional({ description: 'Array error jika ada', type: [String] })
  errors?: string[];
}
