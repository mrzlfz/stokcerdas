import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdjustmentType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  COUNT = 'count',
}

export enum AdjustmentReason {
  STOCK_COUNT = 'stock_count',
  DAMAGED = 'damaged',
  EXPIRED = 'expired',
  LOST = 'lost',
  FOUND = 'found',
  SUPPLIER_CORRECTION = 'supplier_correction',
  SYSTEM_CORRECTION = 'system_correction',
  PRODUCTION_WASTE = 'production_waste',
  CUSTOMER_RETURN = 'customer_return',
  INTERNAL_USE = 'internal_use',
  THEFT = 'theft',
  OTHER = 'other',
}

export class StockAdjustmentDto {
  @ApiProperty({
    description: 'ID produk yang akan disesuaikan',
    example: 'uuid-product-id',
  })
  @IsUUID(4, { message: 'Product ID harus berformat UUID yang valid' })
  productId: string;

  @ApiProperty({
    description: 'ID lokasi inventori',
    example: 'uuid-location-id',
  })
  @IsUUID(4, { message: 'Location ID harus berformat UUID yang valid' })
  locationId: string;

  @ApiProperty({
    description: 'Jenis penyesuaian stok',
    enum: AdjustmentType,
    example: AdjustmentType.POSITIVE,
  })
  @IsEnum(AdjustmentType, { message: 'Jenis adjustment tidak valid' })
  adjustmentType: AdjustmentType;

  @ApiProperty({
    description: 'Jumlah penyesuaian (untuk positive/negative) atau jumlah hasil hitung (untuk count)',
    example: 10,
  })
  @IsNumber({}, { message: 'Quantity harus berupa angka' })
  @Min(0, { message: 'Quantity tidak boleh negatif' })
  quantity: number;

  @ApiProperty({
    description: 'Alasan penyesuaian stok',
    enum: AdjustmentReason,
    example: AdjustmentReason.STOCK_COUNT,
  })
  @IsEnum(AdjustmentReason, { message: 'Alasan adjustment tidak valid' })
  reason: AdjustmentReason;

  @ApiPropertyOptional({
    description: 'Catatan tambahan',
    example: 'Stock opname rutin bulanan',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes maksimal 500 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Nomor referensi (nomor dokumen, PO, dll)',
    example: 'SO-2024-06-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Reference number maksimal 100 karakter' })
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Tipe referensi dokumen',
    example: 'stock_opname',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Reference type maksimal 50 karakter' })
  referenceType?: string;

  @ApiPropertyOptional({
    description: 'ID referensi dokumen',
    example: 'uuid-document-id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Reference ID maksimal 100 karakter' })
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'Cost per unit untuk adjustment (jika ada)',
    example: 15000.50,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Unit cost harus berupa angka' })
  @Min(0, { message: 'Unit cost tidak boleh negatif' })
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'Nomor batch/lot',
    example: 'BATCH20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Batch number maksimal 100 karakter' })
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Nomor lot',
    example: 'LOT20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Lot number maksimal 100 karakter' })
  lotNumber?: string;

  @ApiPropertyOptional({
    description: 'Nomor serial',
    example: 'SN20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Serial number maksimal 100 karakter' })
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Metadata tambahan untuk adjustment',
    example: { temperature: '2-8°C', inspector: 'John Doe' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BulkStockAdjustmentDto {
  @ApiProperty({
    description: 'Array adjustments yang akan dilakukan',
    type: [StockAdjustmentDto],
  })
  adjustments: StockAdjustmentDto[];

  @ApiPropertyOptional({
    description: 'Catatan untuk seluruh batch adjustment',
    example: 'Stock opname bulanan periode Juni 2024',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Batch notes maksimal 500 karakter' })
  batchNotes?: string;

  @ApiPropertyOptional({
    description: 'Nomor referensi batch',
    example: 'SO-BATCH-2024-06-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Batch reference maksimal 100 karakter' })
  batchReference?: string;
}