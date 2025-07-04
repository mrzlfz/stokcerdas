import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteAutomatedPurchaseDto {
  @ApiPropertyOptional({
    description: 'ID reorder rule yang akan dieksekusi',
    example: 'uuid-reorder-rule-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Reorder rule ID harus berupa UUID yang valid' })
  reorderRuleId?: string;

  @ApiPropertyOptional({
    description: 'ID produk (jika tidak menggunakan reorder rule ID)',
    example: 'uuid-product-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Product ID harus berupa UUID yang valid' })
  productId?: string;

  @ApiPropertyOptional({
    description: 'ID lokasi (jika tidak menggunakan reorder rule ID)',
    example: 'uuid-location-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Location ID harus berupa UUID yang valid' })
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Paksa eksekusi meskipun tidak memenuhi trigger',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Force execution harus berupa boolean' })
  forceExecution?: boolean;

  @ApiPropertyOptional({
    description: 'Mode dry run (tidak benar-benar create PO)',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Dry run harus berupa boolean' })
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Override quantity untuk order',
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Override quantity harus berupa angka' })
  @Min(1, { message: 'Override quantity minimal 1' })
  overrideQuantity?: number;

  @ApiPropertyOptional({
    description: 'Override supplier yang dipilih',
    example: 'uuid-supplier-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Override supplier ID harus berupa UUID yang valid' })
  overrideSelectedSupplierId?: string;

  @ApiPropertyOptional({
    description: 'Override urgency level',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Override urgency level harus berupa angka' })
  @Min(1, { message: 'Override urgency level minimal 1' })
  @Max(10, { message: 'Override urgency level maksimal 10' })
  overrideUrgencyLevel?: number;

  @ApiPropertyOptional({
    description: 'Skip approval workflow',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Skip approval harus berupa boolean' })
  skipApproval?: boolean;
}

export class BulkAutomatedPurchaseFiltersDto {
  @ApiPropertyOptional({
    description: 'Urgency level minimum untuk filter',
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
    description: 'Nilai order maksimum untuk filter',
    example: 10000000,
    minimum: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max order value harus berupa angka' })
  @Min(1000, { message: 'Max order value minimal IDR 1,000' })
  maxOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Filter hanya rule yang memerlukan approval',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Requires approval harus berupa boolean' })
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan supplier IDs',
    example: ['uuid-supplier-1', 'uuid-supplier-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Supplier IDs harus berupa array' })
  @IsUUID(4, {
    each: true,
    message: 'Setiap supplier ID harus berupa UUID yang valid',
  })
  @ArrayMaxSize(20, { message: 'Maksimal 20 supplier IDs' })
  supplierIds?: string[];
}

export class BulkAutomatedPurchaseOptionsDto {
  @ApiPropertyOptional({
    description: 'Mode dry run untuk semua executions',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Dry run harus berupa boolean' })
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Maksimal concurrent orders',
    example: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Max concurrent orders harus berupa angka' })
  @Min(1, { message: 'Max concurrent orders minimal 1' })
  @Max(20, { message: 'Max concurrent orders maksimal 20' })
  maxConcurrentOrders?: number;

  @ApiPropertyOptional({
    description: 'Ukuran batch untuk processing',
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Batch size harus berupa angka' })
  @Min(1, { message: 'Batch size minimal 1' })
  @Max(50, { message: 'Batch size maksimal 50' })
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Delay antara orders dalam milliseconds',
    example: 1000,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Delay between orders harus berupa angka' })
  @Min(0, { message: 'Delay between orders tidak boleh negatif' })
  @Max(60000, { message: 'Delay between orders maksimal 60000ms (1 menit)' })
  delayBetweenOrdersMs?: number;
}

export class ExecuteBulkAutomatedPurchaseDto {
  @ApiPropertyOptional({
    description: 'Daftar ID reorder rules untuk bulk execution',
    example: ['uuid-rule-1', 'uuid-rule-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Reorder rule IDs harus berupa array' })
  @IsUUID(4, {
    each: true,
    message: 'Setiap reorder rule ID harus berupa UUID yang valid',
  })
  @ArrayMaxSize(100, { message: 'Maksimal 100 reorder rules per batch' })
  reorderRuleIds?: string[];

  @ApiPropertyOptional({
    description: 'Daftar ID produk untuk bulk execution',
    example: ['uuid-product-1', 'uuid-product-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Product IDs harus berupa array' })
  @IsUUID(4, {
    each: true,
    message: 'Setiap product ID harus berupa UUID yang valid',
  })
  @ArrayMaxSize(200, { message: 'Maksimal 200 products per batch' })
  productIds?: string[];

  @ApiPropertyOptional({
    description: 'Daftar ID lokasi untuk bulk execution',
    example: ['uuid-location-1', 'uuid-location-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Location IDs harus berupa array' })
  @IsUUID(4, {
    each: true,
    message: 'Setiap location ID harus berupa UUID yang valid',
  })
  @ArrayMaxSize(50, { message: 'Maksimal 50 locations per batch' })
  locationIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter untuk bulk execution',
    type: BulkAutomatedPurchaseFiltersDto,
  })
  @IsOptional()
  @ValidateNested({ message: 'Filters harus berupa objek yang valid' })
  @Type(() => BulkAutomatedPurchaseFiltersDto)
  filters?: BulkAutomatedPurchaseFiltersDto;

  @ApiPropertyOptional({
    description: 'Opsi untuk bulk execution',
    type: BulkAutomatedPurchaseOptionsDto,
  })
  @IsOptional()
  @ValidateNested({ message: 'Options harus berupa objek yang valid' })
  @Type(() => BulkAutomatedPurchaseOptionsDto)
  options?: BulkAutomatedPurchaseOptionsDto;
}

export class ProcessAutomationRulesDto {
  @ApiPropertyOptional({
    description: 'Threshold inventory untuk trigger (critical level %)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Critical level harus berupa angka' })
  @Min(0, { message: 'Critical level tidak boleh negatif' })
  @Max(100, { message: 'Critical level maksimal 100%' })
  criticalLevel?: number;

  @ApiPropertyOptional({
    description: 'Threshold inventory untuk warning (warning level %)',
    example: 25,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Warning level harus berupa angka' })
  @Min(0, { message: 'Warning level tidak boleh negatif' })
  @Max(100, { message: 'Warning level maksimal 100%' })
  warningLevel?: number;

  @ApiPropertyOptional({
    description: 'Budget constraint untuk execution',
    example: 50000000,
    minimum: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Budget constraint harus berupa angka' })
  @Min(1000, { message: 'Budget constraint minimal IDR 1,000' })
  budgetConstraint?: number;

  @ApiPropertyOptional({
    description: 'Daily budget limit',
    example: 10000000,
    minimum: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Daily limit harus berupa angka' })
  @Min(1000, { message: 'Daily limit minimal IDR 1,000' })
  dailyLimit?: number;

  @ApiPropertyOptional({
    description: 'Monthly budget limit',
    example: 100000000,
    minimum: 10000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Monthly limit harus berupa angka' })
  @Min(10000, { message: 'Monthly limit minimal IDR 10,000' })
  monthlyLimit?: number;
}

// Response DTOs
export class ReorderCalculationResponseDto {
  @ApiProperty({ description: 'Apakah kalkulasi valid' })
  isValid: boolean;

  @ApiProperty({ description: 'Error validasi jika ada', type: [String] })
  validationErrors: string[];

  @ApiProperty({ description: 'Reorder point yang direkomendasikan' })
  recommendedReorderPoint: number;

  @ApiProperty({ description: 'Quantity order yang direkomendasikan' })
  recommendedOrderQuantity: number;

  @ApiProperty({ description: 'Stok saat ini' })
  currentStock: number;

  @ApiProperty({ description: 'Stok yang tersedia' })
  availableStock: number;

  @ApiProperty({ description: 'Skor urgency (0-10)' })
  urgencyScore: number;

  @ApiProperty({ description: 'Hari sampai stockout' })
  daysUntilStockout: number;

  @ApiProperty({ description: 'Apakah harus reorder sekarang' })
  shouldReorderNow: boolean;

  @ApiProperty({ description: 'Estimasi nilai order' })
  estimatedOrderValue: number;

  @ApiProperty({ description: 'Impact terhadap budget (%)' })
  budgetImpact: number;

  @ApiProperty({ description: 'Biaya per hari stok' })
  costPerDayOfStock: number;

  @ApiProperty({ description: 'Risiko stockout (0-1)' })
  stockoutRisk: number;

  @ApiProperty({ description: 'Risiko overstock (0-1)' })
  overstockRisk: number;

  @ApiProperty({ description: 'Saran mitigasi risiko', type: [String] })
  riskMitigationSuggestions: string[];

  @ApiProperty({ description: 'Tanggal kalkulasi' })
  calculatedAt: Date;

  @ApiProperty({ description: 'Metode kalkulasi yang digunakan' })
  calculationMethod: string;

  @ApiProperty({ description: 'Level confidence (0-1)' })
  confidenceLevel: number;

  @ApiProperty({ description: 'Kualitas data (0-1)' })
  dataQuality: number;

  @ApiProperty({ description: 'Insights dan rekomendasi' })
  insights: Array<{
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    priority: number;
  }>;
}

export class SupplierSelectionResponseDto {
  @ApiProperty({ description: 'Apakah seleksi berhasil' })
  success: boolean;

  @ApiProperty({ description: 'Supplier yang terpilih' })
  selectedSupplier?: {
    supplierId: string;
    totalScore: number;
    costScore: number;
    qualityScore: number;
    deliveryScore: number;
    reliabilityScore: number;
    estimatedCost: number;
    potentialSavings: number;
    rank: number;
    isRecommended: boolean;
    confidenceLevel: number;
    riskFactors: string[];
    advantages: string[];
  };

  @ApiProperty({ description: 'Supplier alternatif', type: [Object] })
  alternativeSuppliers: any[];

  @ApiProperty({ description: 'Metode seleksi yang digunakan' })
  selectionMethod: string;

  @ApiProperty({ description: 'Total supplier yang dievaluasi' })
  totalSuppliersEvaluated: number;

  @ApiProperty({ description: 'Confidence seleksi (0-1)' })
  selectionConfidence: number;

  @ApiProperty({ description: 'Alasan pemilihan supplier' })
  selectionReason: string;

  @ApiProperty({ description: 'Warning risiko', type: [String] })
  riskWarnings: string[];

  @ApiProperty({ description: 'Analisis cost-benefit' })
  costBenefitAnalysis: {
    selectedSupplierCost: number;
    averageCost: number;
    potentialSavings: number;
    riskAdjustedSavings: number;
  };

  @ApiProperty({ description: 'Prediksi tanggal pengiriman' })
  predictedDeliveryDate: Date;

  @ApiProperty({ description: 'Prediksi kualitas (0-100)' })
  predictedQuality: number;

  @ApiProperty({ description: 'Prediksi reliabilitas (0-100)' })
  predictedReliability: number;

  @ApiProperty({ description: 'Tanggal evaluasi' })
  evaluatedAt: Date;

  @ApiProperty({ description: 'Valid sampai' })
  validUntil: Date;
}

export class AutomatedPurchaseResultDto {
  @ApiProperty({ description: 'Apakah eksekusi berhasil' })
  success: boolean;

  @ApiProperty({ description: 'ID eksekusi' })
  executionId: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Reorder rule ID' })
  reorderRuleId: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Location ID' })
  locationId?: string;

  @ApiProperty({ description: 'Tanggal eksekusi' })
  executedAt: Date;

  @ApiProperty({ description: 'Hasil kalkulasi reorder' })
  reorderCalculation: ReorderCalculationResponseDto;

  @ApiProperty({ description: 'Hasil seleksi supplier' })
  supplierSelection: SupplierSelectionResponseDto;

  @ApiProperty({ description: 'Apakah harus membuat PO' })
  shouldCreatePurchaseOrder: boolean;

  @ApiProperty({ description: 'ID Purchase Order yang dibuat' })
  purchaseOrderId?: string;

  @ApiProperty({ description: 'Quantity aktual yang dipesan' })
  actualQuantity: number;

  @ApiProperty({ description: 'Estimasi nilai order' })
  estimatedValue: number;

  @ApiProperty({ description: 'Supplier yang dipilih' })
  selectedSupplierId?: string;

  @ApiProperty({ description: 'Level urgency (0-10)' })
  urgencyLevel: number;

  @ApiProperty({ description: 'Apakah memerlukan approval' })
  requiresApproval: boolean;

  @ApiProperty({ description: 'Apakah otomatis diapprove' })
  isAutomaticallyApproved: boolean;

  @ApiProperty({ description: 'Apakah approval diperlukan' })
  approvalRequired: boolean;

  @ApiProperty({ description: 'Rekomendasi', type: [String] })
  recommendations: string[];

  @ApiProperty({ description: 'Warning', type: [String] })
  warnings: string[];

  @ApiProperty({ description: 'Error', type: [String] })
  errors: string[];

  @ApiProperty({ description: 'Waktu eksekusi (ms)' })
  executionTimeMs: number;

  @ApiProperty({ description: 'Confidence kalkulasi (0-1)' })
  calculationConfidence: number;

  @ApiProperty({ description: 'Confidence seleksi (0-1)' })
  selectionConfidence: number;

  @ApiProperty({ description: 'Tanggal review berikutnya' })
  nextReviewDate?: Date;

  @ApiProperty({ description: 'Aksi follow-up', type: [String] })
  followUpActions: string[];

  @ApiProperty({ description: 'Level risiko' })
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ description: 'Faktor risiko', type: [String] })
  riskFactors: string[];

  @ApiProperty({ description: 'Aksi mitigasi', type: [String] })
  mitigationActions: string[];
}

export class BulkAutomatedPurchaseResultDto {
  @ApiProperty({ description: 'Apakah bulk execution berhasil' })
  success: boolean;

  @ApiProperty({ description: 'Total rules yang diproses' })
  totalProcessed: number;

  @ApiProperty({ description: 'Jumlah order yang berhasil' })
  successfulOrders: number;

  @ApiProperty({ description: 'Jumlah order yang gagal' })
  failedOrders: number;

  @ApiProperty({ description: 'Jumlah order yang di-skip' })
  skippedOrders: number;

  @ApiProperty({
    description: 'Hasil detail',
    type: [AutomatedPurchaseResultDto],
  })
  results: AutomatedPurchaseResultDto[];

  @ApiProperty({ description: 'Ringkasan eksekusi' })
  summary: {
    totalValue: number;
    averageOrderValue: number;
    uniqueSuppliers: number;
    ordersRequiringApproval: number;
    highRiskOrders: number;
  };

  @ApiProperty({ description: 'Tanggal eksekusi' })
  executedAt: Date;

  @ApiProperty({ description: 'Waktu eksekusi total (ms)' })
  executionTimeMs: number;

  @ApiProperty({ description: 'Batch ID' })
  batchId: string;

  @ApiProperty({ description: 'Error yang terjadi', type: [String] })
  errors: string[];

  @ApiProperty({ description: 'Warning yang terjadi', type: [String] })
  warnings: string[];
}

export class RuleEngineMetricsDto {
  @ApiProperty({ description: 'Total rules yang diproses' })
  totalRulesProcessed: number;

  @ApiProperty({ description: 'Rules yang triggered' })
  triggeredRules: number;

  @ApiProperty({ description: 'Eksekusi yang berhasil' })
  successfulExecutions: number;

  @ApiProperty({ description: 'Eksekusi yang gagal' })
  failedExecutions: number;

  @ApiProperty({ description: 'Rules yang di-skip' })
  skippedRules: number;

  @ApiProperty({ description: 'Rata-rata waktu processing (ms)' })
  averageProcessingTime: number;

  @ApiProperty({ description: 'Total nilai yang dihasilkan' })
  totalValueGenerated: number;

  @ApiProperty({ description: 'Efisiensi sistem (0-1)' })
  systemEfficiency: number;
}
