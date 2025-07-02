import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsNumber, 
  IsBoolean, 
  IsArray, 
  IsObject, 
  ValidateNested, 
  Min, 
  Max, 
  IsDateString,
  IsEmail,
  ArrayMaxSize,
  Matches
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { 
  ScheduleType, 
  ScheduleStatus,
  ExecutionStatus
} from '../entities/automation-schedule.entity';

export class JobFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan product IDs',
    example: ['uuid-product-1', 'uuid-product-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Product IDs harus berupa array' })
  @IsString({ each: true, message: 'Setiap product ID harus berupa string' })
  @ArrayMaxSize(100, { message: 'Maksimal 100 product IDs' })
  productIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter berdasarkan location IDs',
    example: ['uuid-location-1', 'uuid-location-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Location IDs harus berupa array' })
  @IsString({ each: true, message: 'Setiap location ID harus berupa string' })
  @ArrayMaxSize(50, { message: 'Maksimal 50 location IDs' })
  locationIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter berdasarkan supplier IDs',
    example: ['uuid-supplier-1', 'uuid-supplier-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Supplier IDs harus berupa array' })
  @IsString({ each: true, message: 'Setiap supplier ID harus berupa string' })
  @ArrayMaxSize(50, { message: 'Maksimal 50 supplier IDs' })
  supplierIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter berdasarkan kategori produk',
    example: ['kategori-makanan', 'kategori-minuman'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Categories harus berupa array' })
  @IsString({ each: true, message: 'Setiap category harus berupa string' })
  @ArrayMaxSize(20, { message: 'Maksimal 20 categories' })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tags',
    example: ['urgent', 'seasonal'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Tags harus berupa array' })
  @IsString({ each: true, message: 'Setiap tag harus berupa string' })
  @ArrayMaxSize(10, { message: 'Maksimal 10 tags' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Kondisi filter tambahan',
    example: [
      { field: 'urgencyLevel', operator: 'gte', value: 5 },
      { field: 'orderValue', operator: 'lte', value: 1000000 }
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Conditions harus berupa array' })
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
    value: any;
  }>;
}

export class CreateAutomationScheduleDto {
  @ApiProperty({
    description: 'Nama schedule automation',
    example: 'Daily Reorder Check - All Products',
    maxLength: 100,
  })
  @IsString({ message: 'Nama schedule harus berupa string' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi schedule automation',
    example: 'Schedule harian untuk mengecek semua reorder rules dan mengeksekusi yang diperlukan',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Tipe schedule automation',
    enum: ScheduleType,
    example: ScheduleType.REORDER_CHECK,
  })
  @IsEnum(ScheduleType, { message: 'Schedule type harus berupa nilai yang valid' })
  type: ScheduleType;

  @ApiProperty({
    description: 'Cron expression untuk scheduling',
    example: '0 8 * * *', // Daily at 8 AM
  })
  @IsString({ message: 'Cron expression harus berupa string' })
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Cron expression harus berupa format yang valid',
  })
  cronExpression: string;

  @ApiPropertyOptional({
    description: 'Timezone untuk schedule',
    example: 'Asia/Jakarta',
    default: 'Asia/Jakarta',
  })
  @IsOptional()
  @IsString({ message: 'Timezone harus berupa string' })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Tanggal mulai schedule',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date harus berupa format tanggal yang valid' })
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal berakhir schedule',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date harus berupa format tanggal yang valid' })
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Timeout eksekusi dalam detik',
    example: 3600, // 1 hour
    minimum: 60,
    maximum: 43200, // 12 hours
  })
  @IsOptional()
  @IsNumber({}, { message: 'Timeout seconds harus berupa angka' })
  @Min(60, { message: 'Timeout seconds minimal 60 detik' })
  @Max(43200, { message: 'Timeout seconds maksimal 43200 detik (12 jam)' })
  timeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Maksimal retry attempts',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max retries harus berupa angka' })
  @Min(0, { message: 'Max retries minimal 0' })
  @Max(10, { message: 'Max retries maksimal 10' })
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Delay retry dalam detik',
    example: 300, // 5 minutes
    minimum: 30,
    maximum: 3600,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Retry delay seconds harus berupa angka' })
  @Min(30, { message: 'Retry delay seconds minimal 30 detik' })
  @Max(3600, { message: 'Retry delay seconds maksimal 3600 detik' })
  retryDelaySeconds?: number;

  @ApiPropertyOptional({
    description: 'Izinkan eksekusi concurrent',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Allow concurrent execution harus berupa boolean' })
  allowConcurrentExecution?: boolean;

  @ApiPropertyOptional({
    description: 'Skip jika eksekusi sebelumnya masih berjalan',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Skip if previous running harus berupa boolean' })
  skipIfPreviousRunning?: boolean;

  @ApiProperty({
    description: 'Nama job yang akan dieksekusi',
    example: 'processReorderRules',
  })
  @IsString({ message: 'Job name harus berupa string' })
  jobName: string;

  @ApiPropertyOptional({
    description: 'Parameter untuk job',
    example: { 
      batchSize: 10,
      maxConcurrentJobs: 3,
      urgencyThreshold: 5
    },
  })
  @IsOptional()
  @IsObject({ message: 'Job parameters harus berupa objek' })
  jobParameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Filter untuk job',
    type: JobFiltersDto,
  })
  @IsOptional()
  @ValidateNested({ message: 'Filters harus berupa objek yang valid' })
  @Type(() => JobFiltersDto)
  filters?: JobFiltersDto;

  @ApiPropertyOptional({
    description: 'Kirim notifikasi',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send notifications harus berupa boolean' })
  sendNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Daftar email untuk notifikasi',
    example: ['admin@company.com', 'operations@company.com'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Notification emails harus berupa array' })
  @IsEmail({}, { each: true, message: 'Setiap notification email harus berupa email yang valid' })
  @ArrayMaxSize(10, { message: 'Maksimal 10 email notifikasi' })
  notificationEmails?: string[];

  @ApiPropertyOptional({
    description: 'Notifikasi saat job dimulai',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Notify on start harus berupa boolean' })
  notifyOnStart?: boolean;

  @ApiPropertyOptional({
    description: 'Notifikasi saat job berhasil',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Notify on success harus berupa boolean' })
  notifyOnSuccess?: boolean;

  @ApiPropertyOptional({
    description: 'Notifikasi saat job gagal',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Notify on failure harus berupa boolean' })
  notifyOnFailure?: boolean;

  @ApiPropertyOptional({
    description: 'Notifikasi saat job timeout',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Notify on timeout harus berupa boolean' })
  notifyOnTimeout?: boolean;

  @ApiPropertyOptional({
    description: 'Prioritas schedule (1-10, semakin tinggi semakin prioritas)',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Priority harus berupa angka' })
  @Min(1, { message: 'Priority minimal 1' })
  @Max(10, { message: 'Priority maksimal 10' })
  priority?: number;

  @ApiPropertyOptional({
    description: 'Resource group untuk alokasi resource',
    example: 'automation-heavy',
  })
  @IsOptional()
  @IsString({ message: 'Resource group harus berupa string' })
  resourceGroup?: string;

  @ApiPropertyOptional({
    description: 'Maksimal concurrent jobs dengan tipe yang sama',
    example: 3,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max concurrent jobs harus berupa angka' })
  @Min(1, { message: 'Max concurrent jobs minimal 1' })
  @Max(20, { message: 'Max concurrent jobs maksimal 20' })
  maxConcurrentJobs?: number;

  @ApiPropertyOptional({
    description: 'Pause pada consecutive failures',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Pause on consecutive failures harus berupa boolean' })
  pauseOnConsecutiveFailures?: boolean;

  @ApiPropertyOptional({
    description: 'Maksimal consecutive failures sebelum pause',
    example: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max consecutive failures harus berupa angka' })
  @Min(1, { message: 'Max consecutive failures minimal 1' })
  @Max(20, { message: 'Max consecutive failures maksimal 20' })
  maxConsecutiveFailures?: number;

  @ApiPropertyOptional({
    description: 'Archive setelah completion',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Archive on completion harus berupa boolean' })
  archiveOnCompletion?: boolean;

  @ApiPropertyOptional({
    description: 'Retensi data eksekusi dalam hari',
    example: 90,
    minimum: 7,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Retention days harus berupa angka' })
  @Min(7, { message: 'Retention days minimal 7 hari' })
  @Max(365, { message: 'Retention days maksimal 365 hari' })
  retentionDays?: number;

  @ApiPropertyOptional({
    description: 'Aktifkan schedule',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;
}

export class UpdateAutomationScheduleDto extends PartialType(CreateAutomationScheduleDto) {
  @ApiPropertyOptional({
    description: 'Status schedule',
    enum: ScheduleStatus,
    example: ScheduleStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ScheduleStatus, { message: 'Status harus berupa nilai yang valid' })
  status?: ScheduleStatus;
}

export class AutomationScheduleQueryDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe schedule',
    enum: ScheduleType,
    example: ScheduleType.REORDER_CHECK,
  })
  @IsOptional()
  @IsEnum(ScheduleType, { message: 'Type harus berupa nilai yang valid' })
  type?: ScheduleType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status',
    enum: ScheduleStatus,
    example: ScheduleStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ScheduleStatus, { message: 'Status harus berupa nilai yang valid' })
  status?: ScheduleStatus;

  @ApiPropertyOptional({
    description: 'Filter hanya schedule yang aktif',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter hanya schedule yang due untuk eksekusi',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is due harus berupa boolean' })
  isDue?: boolean;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan prioritas minimum',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min priority harus berupa angka' })
  @Min(1, { message: 'Min priority minimal 1' })
  @Max(10, { message: 'Min priority maksimal 10' })
  minPriority?: number;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan resource group',
    example: 'automation-heavy',
  })
  @IsOptional()
  @IsString({ message: 'Resource group harus berupa string' })
  resourceGroup?: string;

  @ApiPropertyOptional({
    description: 'Pencarian berdasarkan nama',
    example: 'Daily Reorder',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Halaman data (pagination)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page harus berupa angka' })
  @Min(1, { message: 'Page minimal 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Jumlah data per halaman',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Field untuk sorting',
    example: 'priority',
  })
  @IsOptional()
  @IsString({ message: 'Sort by harus berupa string' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Arah sorting (asc/desc)',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString({ message: 'Sort order harus berupa string' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Include executions history',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include executions harus berupa boolean' })
  includeExecutions?: boolean;
}

export class PauseScheduleDto {
  @ApiPropertyOptional({
    description: 'Alasan pause schedule',
    example: 'Maintenance sistem',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @Transform(({ value }) => value?.trim())
  reason?: string;

  @ApiPropertyOptional({
    description: 'Durasi pause dalam jam',
    example: 4,
    minimum: 1,
    maximum: 8760, // 1 year
  })
  @IsOptional()
  @IsNumber({}, { message: 'Duration hours harus berupa angka' })
  @Min(1, { message: 'Duration hours minimal 1 jam' })
  @Max(8760, { message: 'Duration hours maksimal 8760 jam (1 tahun)' })
  durationHours?: number;
}

export class ExecuteScheduleDto {
  @ApiPropertyOptional({
    description: 'Parameter override untuk eksekusi',
    example: { forceExecution: true, batchSize: 5 },
  })
  @IsOptional()
  @IsObject({ message: 'Parameters harus berupa objek' })
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Mode dry run (tidak benar-benar eksekusi)',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Dry run harus berupa boolean' })
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Timeout custom untuk eksekusi ini',
    example: 7200, // 2 hours
    minimum: 60,
    maximum: 43200,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Timeout seconds harus berupa angka' })
  @Min(60, { message: 'Timeout seconds minimal 60 detik' })
  @Max(43200, { message: 'Timeout seconds maksimal 43200 detik' })
  timeoutSeconds?: number;
}

export class BulkScheduleActionDto {
  @ApiProperty({
    description: 'Daftar ID schedule untuk bulk action',
    example: ['uuid-schedule-1', 'uuid-schedule-2'],
    type: [String],
  })
  @IsArray({ message: 'Schedule IDs harus berupa array' })
  @IsString({ each: true, message: 'Setiap schedule ID harus berupa string' })
  @ArrayMaxSize(20, { message: 'Maksimal 20 schedule IDs per batch' })
  scheduleIds: string[];

  @ApiProperty({
    description: 'Aksi yang akan dilakukan',
    example: 'activate',
    enum: ['activate', 'deactivate', 'pause', 'resume', 'execute', 'delete'],
  })
  @IsString({ message: 'Action harus berupa string' })
  @IsEnum(['activate', 'deactivate', 'pause', 'resume', 'execute', 'delete'], {
    message: 'Action harus berupa nilai yang valid',
  })
  action: 'activate' | 'deactivate' | 'pause' | 'resume' | 'execute' | 'delete';

  @ApiPropertyOptional({
    description: 'Parameter tambahan untuk action',
    example: { reason: 'Bulk maintenance', durationHours: 4 },
  })
  @IsOptional()
  @IsObject({ message: 'Parameters harus berupa objek' })
  parameters?: Record<string, any>;
}

export class ScheduleExecutionQueryDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan schedule ID',
    example: 'uuid-schedule-id',
  })
  @IsOptional()
  @IsString({ message: 'Schedule ID harus berupa string' })
  scheduleId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status eksekusi',
    enum: ExecutionStatus,
    example: ExecutionStatus.SUCCESS,
  })
  @IsOptional()
  @IsEnum(ExecutionStatus, { message: 'Status harus berupa nilai yang valid' })
  status?: ExecutionStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tanggal mulai',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'From date harus berupa format tanggal yang valid' })
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tanggal akhir',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'To date harus berupa format tanggal yang valid' })
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan durasi eksekusi minimum (ms)',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min duration harus berupa angka' })
  @Min(0, { message: 'Min duration tidak boleh negatif' })
  minDuration?: number;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan durasi eksekusi maksimum (ms)',
    example: 300000, // 5 minutes
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max duration harus berupa angka' })
  @Min(0, { message: 'Max duration tidak boleh negatif' })
  maxDuration?: number;

  @ApiPropertyOptional({
    description: 'Halaman data (pagination)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page harus berupa angka' })
  @Min(1, { message: 'Page minimal 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Jumlah data per halaman',
    example: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(200, { message: 'Limit maksimal 200' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Field untuk sorting',
    example: 'executedAt',
  })
  @IsOptional()
  @IsString({ message: 'Sort by harus berupa string' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Arah sorting (asc/desc)',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString({ message: 'Sort order harus berupa string' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Include schedule details',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include schedule harus berupa boolean' })
  includeSchedule?: boolean;
}