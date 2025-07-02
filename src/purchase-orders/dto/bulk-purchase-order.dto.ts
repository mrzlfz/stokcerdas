import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './update-purchase-order.dto';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';

export class BulkCreatePurchaseOrderDto {
  @ApiProperty({
    description: 'Daftar purchase orders yang akan dibuat',
    type: [CreatePurchaseOrderDto],
    isArray: true,
  })
  @IsArray({ message: 'Purchase orders harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 purchase order' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderDto)
  purchaseOrders: CreatePurchaseOrderDto[];

  @ApiPropertyOptional({
    description: 'Apakah akan stop jika ada error pada salah satu PO',
    example: false,
    default: false,
  })
  @IsOptional()
  stopOnError?: boolean = false;

  @ApiPropertyOptional({
    description: 'Catatan untuk bulk creation',
    example: 'Bulk creation untuk restocking Q2 2025',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  notes?: string;
}

export class BulkUpdatePurchaseOrderDto {
  @ApiProperty({
    description: 'Daftar ID purchase orders yang akan diupdate',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d7-b789-123456789abc'],
    type: [String],
  })
  @IsArray({ message: 'Purchase order IDs harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 purchase order ID' })
  @IsUUID(4, { each: true, message: 'Setiap PO ID harus berupa UUID yang valid' })
  purchaseOrderIds: string[];

  @ApiProperty({
    description: 'Data yang akan diupdate untuk semua PO',
    type: UpdatePurchaseOrderDto,
  })
  @ValidateNested()
  @Type(() => UpdatePurchaseOrderDto)
  updateData: UpdatePurchaseOrderDto;

  @ApiPropertyOptional({
    description: 'Catatan untuk bulk update',
    example: 'Bulk update delivery date untuk periode Q2 2025',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  notes?: string;
}

export class BulkDeletePurchaseOrderDto {
  @ApiProperty({
    description: 'Daftar ID purchase orders yang akan dihapus',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d7-b789-123456789abc'],
    type: [String],
  })
  @IsArray({ message: 'Purchase order IDs harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 purchase order ID' })
  @IsUUID(4, { each: true, message: 'Setiap PO ID harus berupa UUID yang valid' })
  purchaseOrderIds: string[];

  @ApiPropertyOptional({
    description: 'Apakah akan melakukan hard delete (permanent)',
    example: false,
    default: false,
  })
  @IsOptional()
  hardDelete?: boolean = false;

  @ApiPropertyOptional({
    description: 'Alasan penghapusan',
    example: 'Cancelled due to budget constraints',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(1000, { message: 'Reason maksimal 1000 karakter' })
  reason?: string;
}

export class BulkStatusUpdateDto {
  @ApiProperty({
    description: 'Daftar ID purchase orders yang akan diupdate statusnya',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d7-b789-123456789abc'],
    type: [String],
  })
  @IsArray({ message: 'Purchase order IDs harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 purchase order ID' })
  @IsUUID(4, { each: true, message: 'Setiap PO ID harus berupa UUID yang valid' })
  purchaseOrderIds: string[];

  @ApiProperty({
    description: 'Status baru untuk semua PO',
    example: PurchaseOrderStatus.SENT_TO_SUPPLIER,
    enum: PurchaseOrderStatus,
  })
  @IsEnum(PurchaseOrderStatus, { message: 'Status tidak valid' })
  status: PurchaseOrderStatus;

  @ApiPropertyOptional({
    description: 'Alasan perubahan status',
    example: 'Bulk sending to suppliers for Q2 2025 orders',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(1000, { message: 'Reason maksimal 1000 karakter' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Catatan tambahan',
    example: 'All suppliers have been notified via email',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  notes?: string;
}

export class BulkSendToSupplierDto {
  @ApiProperty({
    description: 'Daftar ID purchase orders yang akan dikirim ke supplier',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d7-b789-123456789abc'],
    type: [String],
  })
  @IsArray({ message: 'Purchase order IDs harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 purchase order ID' })
  @IsUUID(4, { each: true, message: 'Setiap PO ID harus berupa UUID yang valid' })
  purchaseOrderIds: string[];

  @ApiPropertyOptional({
    description: 'Apakah akan mengirim email ke supplier',
    example: true,
    default: true,
  })
  @IsOptional()
  sendEmail?: boolean = true;

  @ApiPropertyOptional({
    description: 'Apakah akan generate PDF untuk setiap PO',
    example: true,
    default: true,
  })
  @IsOptional()
  generatePdf?: boolean = true;

  @ApiPropertyOptional({
    description: 'Pesan tambahan untuk supplier',
    example: 'Mohon konfirmasi penerimaan PO dan estimasi waktu pengiriman',
  })
  @IsOptional()
  @IsString({ message: 'Supplier message harus berupa string' })
  @MaxLength(1000, { message: 'Supplier message maksimal 1000 karakter' })
  supplierMessage?: string;

  @ApiPropertyOptional({
    description: 'Catatan internal untuk bulk sending',
    example: 'Bulk sending untuk PO periode Q2 2025',
  })
  @IsOptional()
  @IsString({ message: 'Internal notes harus berupa string' })
  @MaxLength(1000, { message: 'Internal notes maksimal 1000 karakter' })
  internalNotes?: string;
}

// Response DTOs
export class BulkPurchaseOrderResponseDto {
  @ApiProperty({ description: 'Jumlah PO yang berhasil diproses' })
  successful: number;

  @ApiProperty({ description: 'Jumlah PO yang gagal diproses' })
  failed: number;

  @ApiProperty({ description: 'Daftar ID PO yang berhasil diproses', type: [String] })
  successfulIds: string[];

  @ApiProperty({ description: 'Daftar error yang terjadi', type: [Object] })
  errors: Array<{
    index?: number;
    purchaseOrderId?: string;
    poNumber?: string;
    error: string;
  }>;

  @ApiProperty({ description: 'Total PO yang diproses' })
  total: number;

  @ApiPropertyOptional({ description: 'Waktu mulai proses' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Waktu selesai proses' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Durasi proses dalam milidetik' })
  duration?: number;
}

export class BulkActionSummaryDto {
  @ApiProperty({ description: 'Jenis aksi yang dilakukan' })
  action: string;

  @ApiProperty({ description: 'Jumlah total item yang diproses' })
  totalProcessed: number;

  @ApiProperty({ description: 'Jumlah yang berhasil' })
  successful: number;

  @ApiProperty({ description: 'Jumlah yang gagal' })
  failed: number;

  @ApiProperty({ description: 'Persentase keberhasilan' })
  successRate: number;

  @ApiProperty({ description: 'Daftar pesan error', type: [String] })
  errorMessages: string[];

  @ApiProperty({ description: 'User yang melakukan aksi' })
  performedBy?: string;

  @ApiProperty({ description: 'Waktu proses' })
  performedAt: Date;

  @ApiPropertyOptional({ description: 'Catatan tambahan' })
  notes?: string;
}

// Export/Import DTOs
export class ExportPurchaseOrdersDto {
  @ApiPropertyOptional({
    description: 'Format export (excel, csv, pdf)',
    example: 'excel',
    enum: ['excel', 'csv', 'pdf'],
    default: 'excel',
  })
  @IsOptional()
  @IsEnum(['excel', 'csv', 'pdf'], { message: 'Format harus excel, csv, atau pdf' })
  format?: 'excel' | 'csv' | 'pdf' = 'excel';

  @ApiPropertyOptional({
    description: 'Daftar ID PO yang akan di-export (kosong = export semua)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Purchase order IDs harus berupa array' })
  @IsUUID(4, { each: true, message: 'Setiap PO ID harus berupa UUID yang valid' })
  purchaseOrderIds?: string[];

  @ApiPropertyOptional({
    description: 'Include items dalam export',
    example: true,
    default: true,
  })
  @IsOptional()
  includeItems?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include approvals dalam export',
    example: false,
    default: false,
  })
  @IsOptional()
  includeApprovals?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include status history dalam export',
    example: false,
    default: false,
  })
  @IsOptional()
  includeStatusHistory?: boolean = false;
}

export class ImportPurchaseOrdersDto {
  @ApiProperty({
    description: 'File path atau base64 content untuk import',
    example: '/uploads/purchase-orders-import.xlsx',
  })
  @IsString({ message: 'File content harus berupa string' })
  fileContent: string;

  @ApiPropertyOptional({
    description: 'Format file (excel, csv)',
    example: 'excel',
    enum: ['excel', 'csv'],
    default: 'excel',
  })
  @IsOptional()
  @IsEnum(['excel', 'csv'], { message: 'Format harus excel atau csv' })
  format?: 'excel' | 'csv' = 'excel';

  @ApiPropertyOptional({
    description: 'Apakah akan skip row yang error',
    example: true,
    default: true,
  })
  @IsOptional()
  skipErrors?: boolean = true;

  @ApiPropertyOptional({
    description: 'Apakah akan validate data sebelum import',
    example: true,
    default: true,
  })
  @IsOptional()
  validateBeforeImport?: boolean = true;
}