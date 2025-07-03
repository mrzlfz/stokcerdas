import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class AddPurchaseOrderItemDto {
  @ApiProperty({
    description: 'ID produk yang akan ditambahkan',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Product ID harus berupa UUID yang valid' })
  productId: string;

  @ApiProperty({
    description: 'SKU produk',
    example: 'PROD-001',
  })
  @IsString({ message: 'SKU harus berupa string' })
  @MinLength(1, { message: 'SKU tidak boleh kosong' })
  @MaxLength(100, { message: 'SKU maksimal 100 karakter' })
  sku: string;

  @ApiProperty({
    description: 'Nama produk',
    example: 'Laptop ASUS VivoBook',
  })
  @IsString({ message: 'Nama produk harus berupa string' })
  @MinLength(1, { message: 'Nama produk tidak boleh kosong' })
  @MaxLength(255, { message: 'Nama produk maksimal 255 karakter' })
  productName: string;

  @ApiPropertyOptional({
    description: 'Deskripsi tambahan produk',
    example: 'Laptop untuk kebutuhan kantor dengan spesifikasi Intel Core i5',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa string' })
  @MaxLength(1000, { message: 'Deskripsi maksimal 1000 karakter' })
  description?: string;

  @ApiPropertyOptional({
    description: 'SKU produk dari supplier',
    example: 'SUP-LAPTOP-001',
  })
  @IsOptional()
  @IsString({ message: 'Supplier SKU harus berupa string' })
  @MaxLength(100, { message: 'Supplier SKU maksimal 100 karakter' })
  supplierSku?: string;

  @ApiPropertyOptional({
    description: 'Unit satuan produk',
    example: 'pcs',
  })
  @IsOptional()
  @IsString({ message: 'Unit harus berupa string' })
  @MaxLength(50, { message: 'Unit maksimal 50 karakter' })
  unit?: string;

  @ApiProperty({
    description: 'Jumlah yang dipesan',
    example: 10,
    minimum: 1,
  })
  @IsNumber({}, { message: 'Quantity harus berupa angka' })
  @Min(1, { message: 'Quantity minimal 1' })
  @Max(999999, { message: 'Quantity maksimal 999999' })
  orderedQuantity: number;

  @ApiProperty({
    description: 'Harga satuan dalam mata uang yang dipilih',
    example: 15000000.00,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Harga satuan harus berupa angka dengan maksimal 2 desimal' })
  @Min(0, { message: 'Harga satuan tidak boleh negatif' })
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Persentase diskon (0-100)',
    example: 5.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Persentase diskon harus berupa angka dengan maksimal 2 desimal' })
  @Min(0, { message: 'Persentase diskon tidak boleh negatif' })
  @Max(100, { message: 'Persentase diskon maksimal 100%' })
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Persentase pajak (0-100)',
    example: 11,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Persentase pajak harus berupa angka dengan maksimal 2 desimal' })
  @Min(0, { message: 'Persentase pajak tidak boleh negatif' })
  @Max(100, { message: 'Persentase pajak maksimal 100%' })
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Tanggal pengiriman yang diharapkan',
    example: '2025-07-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Expected delivery date harus berupa tanggal yang valid' })
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Catatan untuk item ini',
    example: 'Mohon pastikan kondisi packaging aman',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Custom fields untuk data tambahan',
    example: { warranty: '2 years', color: 'black' },
  })
  @IsOptional()
  @IsObject({ message: 'Custom fields harus berupa object' })
  customFields?: Record<string, any>;
}

export class UpdatePurchaseOrderItemDto extends PartialType(AddPurchaseOrderItemDto) {
  // All fields from AddPurchaseOrderItemDto are optional for updates
  
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class ReceiveItemDto {
  @ApiProperty({
    description: 'Jumlah yang diterima',
    example: 8,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Received quantity harus berupa angka' })
  @Min(0, { message: 'Received quantity tidak boleh negatif' })
  receivedQuantity: number;

  @ApiPropertyOptional({
    description: 'Jumlah yang ditolak/rusak',
    example: 2,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Rejected quantity harus berupa angka' })
  @Min(0, { message: 'Rejected quantity tidak boleh negatif' })
  rejectedQuantity?: number;

  @ApiPropertyOptional({
    description: 'Catatan untuk penerimaan item',
    example: '2 unit rusak packaging, kondisi barang masih baik',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tanggal actual penerimaan (default: sekarang)',
    example: '2025-07-10T14:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Received date harus berupa tanggal yang valid' })
  receivedDate?: string;
}

export class BulkReceiveItemsDto {
  @ApiProperty({
    description: 'Daftar item yang diterima dengan detailnya',
    type: [Object],
    example: [
      {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        receivedQuantity: 8,
        rejectedQuantity: 2,
        notes: 'Beberapa unit packaging rusak'
      }
    ],
  })
  items: Array<{
    itemId: string;
    receivedQuantity: number;
    rejectedQuantity?: number;
    notes?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Catatan umum untuk penerimaan batch',
    example: 'Penerimaan batch pertama dari PO-2025-001',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  generalNotes?: string;

  @ApiPropertyOptional({
    description: 'Tanggal penerimaan untuk semua item (default: sekarang)',
    example: '2025-07-10T14:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Received date harus berupa tanggal yang valid' })
  receivedDate?: string;
}

// Response DTOs
export class PurchaseOrderItemResponseDto {
  @ApiProperty({ description: 'ID item' })
  id: string;

  @ApiProperty({ description: 'ID purchase order' })
  purchaseOrderId: string;

  @ApiProperty({ description: 'ID produk' })
  productId: string;

  @ApiProperty({ description: 'SKU produk' })
  sku: string;

  @ApiProperty({ description: 'Nama produk' })
  productName: string;

  @ApiPropertyOptional({ description: 'Deskripsi produk' })
  description?: string;

  @ApiPropertyOptional({ description: 'SKU supplier' })
  supplierSku?: string;

  @ApiPropertyOptional({ description: 'Unit satuan' })
  unit?: string;

  @ApiProperty({ description: 'Jumlah yang dipesan' })
  orderedQuantity: number;

  @ApiProperty({ description: 'Jumlah yang sudah diterima' })
  receivedQuantity: number;

  @ApiProperty({ description: 'Jumlah yang ditolak' })
  rejectedQuantity: number;

  @ApiProperty({ description: 'Harga satuan' })
  unitPrice: number;

  @ApiProperty({ description: 'Total harga sebelum diskon dan pajak' })
  totalPrice: number;

  @ApiProperty({ description: 'Jumlah diskon' })
  discountAmount: number;

  @ApiProperty({ description: 'Persentase diskon' })
  discountPercentage: number;

  @ApiPropertyOptional({ description: 'Persentase pajak' })
  taxRate?: number;

  @ApiProperty({ description: 'Jumlah pajak' })
  taxAmount: number;

  @ApiPropertyOptional({ description: 'Catatan' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Tanggal pengiriman yang diharapkan' })
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ description: 'Tanggal terakhir diterima' })
  lastReceivedAt?: Date;

  @ApiPropertyOptional({ description: 'Custom fields' })
  customFields?: Record<string, any>;

  @ApiProperty({ description: 'Harga final setelah diskon dan pajak' })
  finalPrice: number;

  @ApiProperty({ description: 'Status apakah sudah fully received' })
  isFullyReceived: boolean;

  @ApiProperty({ description: 'Status apakah partially received' })
  isPartiallyReceived: boolean;

  @ApiProperty({ description: 'Sisa quantity yang belum diterima' })
  remainingQuantity: number;

  @ApiProperty({ description: 'Persentase yang sudah diterima' })
  receivedPercentage: number;

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;

  @ApiProperty({ description: 'Tanggal diupdate' })
  updatedAt: Date;
}

export class BulkItemActionResponseDto {
  @ApiProperty({ description: 'Jumlah item yang berhasil diproses' })
  successful: number;

  @ApiProperty({ description: 'Jumlah item yang gagal diproses' })
  failed: number;

  @ApiProperty({ description: 'Daftar ID item yang berhasil diproses', type: [String] })
  successfulIds: string[];

  @ApiProperty({ description: 'Daftar error yang terjadi', type: [Object] })
  errors: Array<{
    itemId: string;
    error: string;
  }>;

  @ApiProperty({ description: 'Total item yang diproses' })
  total: number;
}