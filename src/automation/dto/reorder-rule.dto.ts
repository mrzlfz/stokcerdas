import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsNumber, 
  IsBoolean, 
  IsUUID, 
  IsArray, 
  IsObject, 
  ValidateNested, 
  Min, 
  Max, 
  IsDateString,
  IsEmail,
  ArrayMinSize,
  ArrayMaxSize
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { 
  ReorderRuleType, 
  ReorderTrigger, 
  ReorderStatus, 
  SupplierSelectionMethod 
} from '../entities/reorder-rule.entity';

export class SupplierWeightsDto {
  @ApiProperty({
    description: 'Weight untuk faktor biaya dalam seleksi supplier',
    example: 0.3,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber({}, { message: 'Cost weight harus berupa angka' })
  @Min(0, { message: 'Cost weight tidak boleh kurang dari 0' })
  @Max(1, { message: 'Cost weight tidak boleh lebih dari 1' })
  cost: number;

  @ApiProperty({
    description: 'Weight untuk faktor kualitas dalam seleksi supplier',
    example: 0.25,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber({}, { message: 'Quality weight harus berupa angka' })
  @Min(0, { message: 'Quality weight tidak boleh kurang dari 0' })
  @Max(1, { message: 'Quality weight tidak boleh lebih dari 1' })
  quality: number;

  @ApiProperty({
    description: 'Weight untuk faktor pengiriman dalam seleksi supplier',
    example: 0.25,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber({}, { message: 'Delivery weight harus berupa angka' })
  @Min(0, { message: 'Delivery weight tidak boleh kurang dari 0' })
  @Max(1, { message: 'Delivery weight tidak boleh lebih dari 1' })
  delivery: number;

  @ApiProperty({
    description: 'Weight untuk faktor reliabilitas dalam seleksi supplier',
    example: 0.2,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber({}, { message: 'Reliability weight harus berupa angka' })
  @Min(0, { message: 'Reliability weight tidak boleh kurang dari 0' })
  @Max(1, { message: 'Reliability weight tidak boleh lebih dari 1' })
  reliability: number;
}

export class SeasonalFactorsDto {
  @ApiPropertyOptional({
    description: 'Faktor seasonal untuk bulan Januari',
    example: 1.2,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Januari harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '1'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Februari' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Februari harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '2'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Maret' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Maret harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '3'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan April' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk April harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '4'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Mei' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Mei harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '5'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Juni' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Juni harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '6'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Juli' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Juli harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '7'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Agustus' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Agustus harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '8'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan September' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk September harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '9'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Oktober' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Oktober harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '10'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan November' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk November harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '11'?: number;

  @ApiPropertyOptional({ description: 'Faktor seasonal untuk bulan Desember' })
  @IsOptional()
  @IsNumber({}, { message: 'Seasonal factor untuk Desember harus berupa angka' })
  @Min(0.1, { message: 'Seasonal factor tidak boleh kurang dari 0.1' })
  @Max(5, { message: 'Seasonal factor tidak boleh lebih dari 5' })
  '12'?: number;
}

export class CreateReorderRuleDto {
  @ApiProperty({
    description: 'ID produk yang akan diatur reorder rule',
    example: 'uuid-product-id',
  })
  @IsUUID(4, { message: 'Product ID harus berupa UUID yang valid' })
  productId: string;

  @ApiPropertyOptional({
    description: 'ID lokasi inventory (opsional untuk global rule)',
    example: 'uuid-location-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Location ID harus berupa UUID yang valid' })
  locationId?: string;

  @ApiPropertyOptional({
    description: 'ID supplier utama untuk reorder',
    example: 'uuid-supplier-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Primary Supplier ID harus berupa UUID yang valid' })
  primarySupplierId?: string;

  @ApiProperty({
    description: 'Nama aturan reorder',
    example: 'Reorder Rule - Beras Premium 5kg',
    maxLength: 100,
  })
  @IsString({ message: 'Nama rule harus berupa string' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi aturan reorder',
    example: 'Aturan otomatis untuk reorder beras premium ketika stok menipis',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Tipe aturan reorder',
    enum: ReorderRuleType,
    example: ReorderRuleType.FIXED_QUANTITY,
  })
  @IsEnum(ReorderRuleType, { message: 'Rule type harus berupa nilai yang valid' })
  ruleType: ReorderRuleType;

  @ApiProperty({
    description: 'Trigger untuk aktivasi reorder',
    enum: ReorderTrigger,
    example: ReorderTrigger.STOCK_LEVEL,
  })
  @IsEnum(ReorderTrigger, { message: 'Trigger harus berupa nilai yang valid' })
  trigger: ReorderTrigger;

  // Stock Level Parameters
  @ApiProperty({
    description: 'Titik reorder - stok minimum sebelum melakukan reorder',
    example: 100,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Reorder point harus berupa angka' })
  @Min(0, { message: 'Reorder point tidak boleh negatif' })
  reorderPoint: number;

  @ApiProperty({
    description: 'Jumlah quantity yang akan di-order ketika reorder',
    example: 500,
    minimum: 1,
  })
  @IsNumber({}, { message: 'Reorder quantity harus berupa angka' })
  @Min(1, { message: 'Reorder quantity minimal 1' })
  reorderQuantity: number;

  @ApiPropertyOptional({
    description: 'Level stok minimum yang diizinkan',
    example: 50,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min stock level harus berupa angka' })
  @Min(0, { message: 'Min stock level tidak boleh negatif' })
  minStockLevel?: number;

  @ApiPropertyOptional({
    description: 'Level stok maksimum yang diizinkan',
    example: 1000,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max stock level harus berupa angka' })
  @Min(1, { message: 'Max stock level minimal 1' })
  maxStockLevel?: number;

  @ApiPropertyOptional({
    description: 'Jumlah hari safety stock',
    example: 7,
    minimum: 0,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Safety stock days harus berupa angka' })
  @Min(0, { message: 'Safety stock days tidak boleh negatif' })
  @Max(365, { message: 'Safety stock days maksimal 365 hari' })
  safetyStockDays?: number;

  @ApiPropertyOptional({
    description: 'Lead time supplier dalam hari',
    example: 3,
    minimum: 0,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Lead time days harus berupa angka' })
  @Min(0, { message: 'Lead time days tidak boleh negatif' })
  @Max(365, { message: 'Lead time days maksimal 365 hari' })
  leadTimeDays?: number;

  // EOQ Parameters
  @ApiPropertyOptional({
    description: 'Perkiraan demand tahunan untuk perhitungan EOQ',
    example: 12000,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Annual demand harus berupa angka' })
  @Min(1, { message: 'Annual demand minimal 1' })
  annualDemand?: number;

  @ApiPropertyOptional({
    description: 'Biaya pemesanan per order (dalam IDR)',
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Ordering cost harus berupa angka' })
  @Min(0, { message: 'Ordering cost tidak boleh negatif' })
  orderingCost?: number;

  @ApiPropertyOptional({
    description: 'Tingkat biaya penyimpanan per tahun (persen)',
    example: 25,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Holding cost rate harus berupa angka' })
  @Min(0, { message: 'Holding cost rate tidak boleh negatif' })
  @Max(100, { message: 'Holding cost rate maksimal 100%' })
  holdingCostRate?: number;

  @ApiPropertyOptional({
    description: 'Biaya per unit produk (dalam IDR)',
    example: 25000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Unit cost harus berupa angka' })
  @Min(0, { message: 'Unit cost tidak boleh negatif' })
  unitCost?: number;

  // Demand-based Parameters
  @ApiPropertyOptional({
    description: 'Jumlah hari lookback untuk analisis demand',
    example: 30,
    minimum: 7,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Demand lookback days harus berupa angka' })
  @Min(7, { message: 'Demand lookback days minimal 7 hari' })
  @Max(365, { message: 'Demand lookback days maksimal 365 hari' })
  demandLookbackDays?: number;

  @ApiPropertyOptional({
    description: 'Multiplier untuk demand-based ordering',
    example: 1.5,
    minimum: 0.1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Demand multiplier harus berupa angka' })
  @Min(0.1, { message: 'Demand multiplier minimal 0.1' })
  @Max(10, { message: 'Demand multiplier maksimal 10' })
  demandMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Target service level (0-1)',
    example: 0.95,
    minimum: 0.5,
    maximum: 0.999,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Service level harus berupa angka' })
  @Min(0.5, { message: 'Service level minimal 0.5' })
  @Max(0.999, { message: 'Service level maksimal 0.999' })
  serviceLevel?: number;

  // Forecasting Parameters
  @ApiPropertyOptional({
    description: 'Gunakan data forecasting untuk perhitungan',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Use forecasting data harus berupa boolean' })
  useForecastingData?: boolean;

  @ApiPropertyOptional({
    description: 'Horizon forecasting dalam hari',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Forecast horizon days harus berupa angka' })
  @Min(1, { message: 'Forecast horizon days minimal 1 hari' })
  @Max(365, { message: 'Forecast horizon days maksimal 365 hari' })
  forecastHorizonDays?: number;

  @ApiPropertyOptional({
    description: 'Threshold confidence untuk forecasting (0-1)',
    example: 0.8,
    minimum: 0.1,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Forecast confidence threshold harus berupa angka' })
  @Min(0.1, { message: 'Forecast confidence threshold minimal 0.1' })
  @Max(1, { message: 'Forecast confidence threshold maksimal 1' })
  forecastConfidenceThreshold?: number;

  // Supplier Selection
  @ApiProperty({
    description: 'Metode seleksi supplier',
    enum: SupplierSelectionMethod,
    example: SupplierSelectionMethod.BALANCED,
  })
  @IsEnum(SupplierSelectionMethod, { message: 'Supplier selection method harus berupa nilai yang valid' })
  supplierSelectionMethod: SupplierSelectionMethod;

  @ApiPropertyOptional({
    description: 'Weight untuk berbagai faktor dalam seleksi supplier',
    type: SupplierWeightsDto,
  })
  @IsOptional()
  @ValidateNested({ message: 'Supplier weights harus berupa objek yang valid' })
  @Type(() => SupplierWeightsDto)
  supplierWeights?: SupplierWeightsDto;

  @ApiPropertyOptional({
    description: 'Daftar ID supplier yang diizinkan',
    example: ['uuid-supplier-1', 'uuid-supplier-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Allowed supplier IDs harus berupa array' })
  @IsUUID(4, { each: true, message: 'Setiap allowed supplier ID harus berupa UUID yang valid' })
  @ArrayMaxSize(20, { message: 'Maksimal 20 supplier yang diizinkan' })
  allowedSupplierIds?: string[];

  // Budget and Constraints
  @ApiPropertyOptional({
    description: 'Nilai maksimum per order (dalam IDR)',
    example: 10000000,
    minimum: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max order value harus berupa angka' })
  @Min(1000, { message: 'Max order value minimal IDR 1,000' })
  maxOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Quantity maksimum per order',
    example: 1000,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max order quantity harus berupa angka' })
  @Min(1, { message: 'Max order quantity minimal 1' })
  maxOrderQuantity?: number;

  @ApiPropertyOptional({
    description: 'Quantity minimum per order',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min order quantity harus berupa angka' })
  @Min(1, { message: 'Min order quantity minimal 1' })
  minOrderQuantity?: number;

  @ApiPropertyOptional({
    description: 'Limit budget bulanan (dalam IDR)',
    example: 50000000,
    minimum: 10000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Budget limit harus berupa angka' })
  @Min(10000, { message: 'Budget limit minimal IDR 10,000' })
  budgetLimit?: number;

  // Approval Settings
  @ApiPropertyOptional({
    description: 'Apakah memerlukan approval manual',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires approval harus berupa boolean' })
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Threshold untuk auto-approval (dalam IDR)',
    example: 5000000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Auto approval threshold harus berupa angka' })
  @Min(0, { message: 'Auto approval threshold tidak boleh negatif' })
  autoApprovalThreshold?: number;

  @ApiPropertyOptional({
    description: 'Daftar ID user yang bisa approve',
    example: ['uuid-user-1', 'uuid-user-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Approver user IDs harus berupa array' })
  @IsUUID(4, { each: true, message: 'Setiap approver user ID harus berupa UUID yang valid' })
  @ArrayMaxSize(10, { message: 'Maksimal 10 approver' })
  approverUserIds?: string[];

  @ApiPropertyOptional({
    description: 'Apakah proses sepenuhnya otomatis',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is fully automated harus berupa boolean' })
  isFullyAutomated?: boolean;

  // Scheduling
  @ApiPropertyOptional({
    description: 'Cron expression untuk scheduling',
    example: '0 8 * * *', // Daily at 8 AM
  })
  @IsOptional()
  @IsString({ message: 'Cron schedule harus berupa string' })
  cronSchedule?: string;

  // Notification Settings
  @ApiPropertyOptional({
    description: 'Kirim notifikasi',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Send notifications harus berupa boolean' })
  sendNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Daftar email untuk notifikasi',
    example: ['purchasing@company.com', 'manager@company.com'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Notification emails harus berupa array' })
  @IsEmail({}, { each: true, message: 'Setiap notification email harus berupa email yang valid' })
  @ArrayMaxSize(10, { message: 'Maksimal 10 email notifikasi' })
  notificationEmails?: string[];

  @ApiPropertyOptional({
    description: 'Notifikasi saat eksekusi',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Notify on execution harus berupa boolean' })
  notifyOnExecution?: boolean;

  @ApiPropertyOptional({
    description: 'Notifikasi saat error',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Notify on errors harus berupa boolean' })
  notifyOnErrors?: boolean;

  // Advanced Settings
  @ApiPropertyOptional({
    description: 'Faktor seasonal per bulan',
    type: SeasonalFactorsDto,
  })
  @IsOptional()
  @ValidateNested({ message: 'Seasonal factors harus berupa objek yang valid' })
  @Type(() => SeasonalFactorsDto)
  seasonalFactors?: SeasonalFactorsDto;

  @ApiPropertyOptional({
    description: 'Parameter custom tambahan',
    example: { customKey: 'customValue' },
  })
  @IsOptional()
  @IsObject({ message: 'Custom parameters harus berupa objek' })
  customParameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Tags untuk kategorisasi',
    example: ['urgent', 'bulk-order', 'seasonal'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Tags harus berupa array' })
  @IsString({ each: true, message: 'Setiap tag harus berupa string' })
  @ArrayMaxSize(10, { message: 'Maksimal 10 tags' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Aktifkan rule',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;
}

export class UpdateReorderRuleDto extends PartialType(CreateReorderRuleDto) {
  @ApiPropertyOptional({
    description: 'Status aturan reorder',
    enum: ReorderStatus,
    example: ReorderStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ReorderStatus, { message: 'Status harus berupa nilai yang valid' })
  status?: ReorderStatus;
}

export class ReorderRuleQueryDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan ID produk',
    example: 'uuid-product-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Product ID harus berupa UUID yang valid' })
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan ID lokasi',
    example: 'uuid-location-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Location ID harus berupa UUID yang valid' })
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan ID supplier',
    example: 'uuid-supplier-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Supplier ID harus berupa UUID yang valid' })
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status',
    enum: ReorderStatus,
    example: ReorderStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ReorderStatus, { message: 'Status harus berupa nilai yang valid' })
  status?: ReorderStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe rule',
    enum: ReorderRuleType,
    example: ReorderRuleType.EOQ,
  })
  @IsOptional()
  @IsEnum(ReorderRuleType, { message: 'Rule type harus berupa nilai yang valid' })
  ruleType?: ReorderRuleType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan trigger',
    enum: ReorderTrigger,
    example: ReorderTrigger.STOCK_LEVEL,
  })
  @IsOptional()
  @IsEnum(ReorderTrigger, { message: 'Trigger harus berupa nilai yang valid' })
  trigger?: ReorderTrigger;

  @ApiPropertyOptional({
    description: 'Filter hanya rule yang aktif',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter hanya rule yang eligible untuk eksekusi',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is eligible harus berupa boolean' })
  isEligible?: boolean;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan urgency level minimum',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Min urgency level harus berupa angka' })
  @Min(1, { message: 'Min urgency level minimal 1' })
  @Max(10, { message: 'Min urgency level maksimal 10' })
  minUrgencyLevel?: number;

  @ApiPropertyOptional({
    description: 'Pencarian berdasarkan nama rule',
    example: 'Beras Premium',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tags',
    example: 'urgent,seasonal',
  })
  @IsOptional()
  @IsString({ message: 'Tags harus berupa string' })
  tags?: string;

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
    example: 'name',
  })
  @IsOptional()
  @IsString({ message: 'Sort by harus berupa string' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Arah sorting (asc/desc)',
    example: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString({ message: 'Sort order harus berupa string' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Include relasi (product, location, supplier)',
    example: 'product,location',
  })
  @IsOptional()
  @IsString({ message: 'Include harus berupa string' })
  include?: string;
}

export class PauseReorderRuleDto {
  @ApiPropertyOptional({
    description: 'Alasan pause rule',
    example: 'Maintenance inventory',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @Transform(({ value }) => value?.trim())
  reason?: string;

  @ApiPropertyOptional({
    description: 'Durasi pause dalam jam',
    example: 24,
    minimum: 1,
    maximum: 8760, // 1 year
  })
  @IsOptional()
  @IsNumber({}, { message: 'Duration hours harus berupa angka' })
  @Min(1, { message: 'Duration hours minimal 1 jam' })
  @Max(8760, { message: 'Duration hours maksimal 8760 jam (1 tahun)' })
  durationHours?: number;
}

export class TestReorderRuleDto {
  @ApiPropertyOptional({
    description: 'Paksa eksekusi meskipun tidak memenuhi trigger',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Force execution harus berupa boolean' })
  forceExecution?: boolean;

  @ApiPropertyOptional({
    description: 'Mode dry run (tidak benar-benar create PO)',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Dry run harus berupa boolean' })
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Override quantity untuk testing',
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Override quantity harus berupa angka' })
  @Min(1, { message: 'Override quantity minimal 1' })
  overrideQuantity?: number;

  @ApiPropertyOptional({
    description: 'Override supplier untuk testing',
    example: 'uuid-supplier-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Override supplier ID harus berupa UUID yang valid' })
  overrideSupplierId?: string;

  @ApiPropertyOptional({
    description: 'Override urgency level untuk testing',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Override urgency level harus berupa angka' })
  @Min(1, { message: 'Override urgency level minimal 1' })
  @Max(10, { message: 'Override urgency level maksimal 10' })
  overrideUrgencyLevel?: number;
}

export class BulkActionReorderRuleDto {
  @ApiProperty({
    description: 'Daftar ID reorder rules untuk bulk action',
    example: ['uuid-rule-1', 'uuid-rule-2'],
    type: [String],
  })
  @IsArray({ message: 'Rule IDs harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal 1 rule ID diperlukan' })
  @ArrayMaxSize(50, { message: 'Maksimal 50 rule IDs per batch' })
  @IsUUID(4, { each: true, message: 'Setiap rule ID harus berupa UUID yang valid' })
  ruleIds: string[];

  @ApiProperty({
    description: 'Aksi yang akan dilakukan',
    example: 'activate',
    enum: ['activate', 'deactivate', 'pause', 'resume', 'delete', 'test'],
  })
  @IsString({ message: 'Action harus berupa string' })
  @IsEnum(['activate', 'deactivate', 'pause', 'resume', 'delete', 'test'], {
    message: 'Action harus berupa nilai yang valid',
  })
  action: 'activate' | 'deactivate' | 'pause' | 'resume' | 'delete' | 'test';

  @ApiPropertyOptional({
    description: 'Parameter tambahan untuk action',
    example: { reason: 'Bulk maintenance', durationHours: 24 },
  })
  @IsOptional()
  @IsObject({ message: 'Parameters harus berupa objek' })
  parameters?: Record<string, any>;
}