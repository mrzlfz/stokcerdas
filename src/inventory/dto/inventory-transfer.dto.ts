import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  ValidateNested,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransferStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export enum TransferReason {
  RESTOCK = 'restock',
  CUSTOMER_ORDER = 'customer_order',
  DAMAGED_GOODS = 'damaged_goods',
  EXPIRED_GOODS = 'expired_goods',
  BRANCH_REQUEST = 'branch_request',
  CONSOLIDATION = 'consolidation',
  EMERGENCY = 'emergency',
  SEASONAL_ADJUSTMENT = 'seasonal_adjustment',
  OVERFLOW = 'overflow',
  OTHER = 'other',
}

export class TransferItemDto {
  @ApiProperty({
    description: 'ID produk yang akan ditransfer',
    example: 'uuid-product-id',
  })
  @IsUUID(4, { message: 'Product ID harus berformat UUID yang valid' })
  productId: string;

  @ApiProperty({
    description: 'Jumlah yang akan ditransfer',
    example: 50,
  })
  @IsNumber({}, { message: 'Quantity harus berupa angka' })
  @Min(1, { message: 'Quantity minimal 1' })
  quantity: number;

  @ApiPropertyOptional({
    description: 'Catatan untuk item ini',
    example: 'Kondisi baik, kemasan utuh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Notes maksimal 255 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Nomor batch/lot untuk item ini',
    example: 'BATCH20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Batch number maksimal 100 karakter' })
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Nomor lot untuk item ini',
    example: 'LOT20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Lot number maksimal 100 karakter' })
  lotNumber?: string;

  @ApiPropertyOptional({
    description: 'Nomor serial untuk item ini',
    example: 'SN20241201001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Serial number maksimal 100 karakter' })
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Unit cost untuk item ini',
    example: 15000.5,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Unit cost harus berupa angka' })
  @Min(0, { message: 'Unit cost tidak boleh negatif' })
  unitCost?: number;
}

export class CreateInventoryTransferDto {
  @ApiProperty({
    description: 'ID lokasi asal',
    example: 'uuid-source-location-id',
  })
  @IsUUID(4, { message: 'Source location ID harus berformat UUID yang valid' })
  sourceLocationId: string;

  @ApiProperty({
    description: 'ID lokasi tujuan',
    example: 'uuid-destination-location-id',
  })
  @IsUUID(4, {
    message: 'Destination location ID harus berformat UUID yang valid',
  })
  destinationLocationId: string;

  @ApiProperty({
    description: 'Daftar item yang akan ditransfer',
    type: [TransferItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @ApiProperty({
    description: 'Alasan transfer',
    enum: TransferReason,
    example: TransferReason.RESTOCK,
  })
  @IsEnum(TransferReason, { message: 'Alasan transfer tidak valid' })
  reason: TransferReason;

  @ApiPropertyOptional({
    description: 'Catatan untuk transfer ini',
    example: 'Transfer untuk restocking cabang Bekasi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes maksimal 500 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Nomor referensi eksternal',
    example: 'TRF-2024-06-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Reference number maksimal 100 karakter' })
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Tipe referensi dokumen',
    example: 'sales_order',
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
    description: 'Prioritas transfer',
    example: 'normal',
    enum: ['low', 'normal', 'high', 'urgent'],
  })
  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'urgent'], {
    message: 'Priority tidak valid',
  })
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @ApiPropertyOptional({
    description: 'Tanggal yang diinginkan untuk transfer',
    example: '2024-07-01T10:00:00Z',
  })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiPropertyOptional({
    description: 'Metadata tambahan untuk transfer',
    example: { shippingMethod: 'truck', driver: 'John Doe' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateTransferStatusDto {
  @ApiProperty({
    description: 'Status baru untuk transfer',
    enum: TransferStatus,
    example: TransferStatus.IN_TRANSIT,
  })
  @IsEnum(TransferStatus, { message: 'Status transfer tidak valid' })
  status: TransferStatus;

  @ApiPropertyOptional({
    description: 'Catatan untuk perubahan status',
    example: 'Barang sudah dikirim dengan truck B1234XY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes maksimal 500 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Metadata tambahan untuk status update',
    example: {
      trackingNumber: 'TRK123456789',
      estimatedArrival: '2024-07-02T15:00:00Z',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TransferReceiptDto {
  @ApiProperty({
    description: 'ID transfer yang akan diterima',
    example: 'uuid-transfer-id',
  })
  @IsUUID(4, { message: 'Transfer ID harus berformat UUID yang valid' })
  transferId: string;

  @ApiProperty({
    description: 'Daftar item yang diterima dengan quantity actual',
    type: [Object],
    example: [
      {
        productId: 'uuid-product-id',
        quantityReceived: 48,
        quantityDamaged: 2,
        notes: 'Ada 2 unit rusak saat pengiriman',
      },
    ],
  })
  @IsArray()
  receivedItems: Array<{
    productId: string;
    quantityReceived: number;
    quantityDamaged?: number;
    notes?: string;
    batchNumber?: string;
    lotNumber?: string;
    serialNumber?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Catatan penerimaan',
    example: 'Semua barang diterima dalam kondisi baik kecuali 2 unit rusak',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes maksimal 500 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Nama penerima',
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Receiver name maksimal 255 karakter' })
  receiverName?: string;
}
