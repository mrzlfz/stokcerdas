import {
  IsOptional,
  IsUUID,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export enum InventoryReportType {
  STOCK_LEVELS = 'stock_levels',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  OVERSTOCK = 'overstock',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  STOCK_MOVEMENTS = 'stock_movements',
  STOCK_VALUATION = 'stock_valuation',
  ABC_ANALYSIS = 'abc_analysis',
  SLOW_MOVING = 'slow_moving',
  FAST_MOVING = 'fast_moving',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class InventoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan lokasi',
    example: 'uuid-location-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Location ID harus berformat UUID yang valid' })
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan produk',
    example: 'uuid-product-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Product ID harus berformat UUID yang valid' })
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan kategori produk',
    example: 'uuid-category-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Category ID harus berformat UUID yang valid' })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Pencarian berdasarkan nama produk atau SKU',
    example: 'laptop',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter stok minimum',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Min quantity harus berupa angka' })
  @Min(0, { message: 'Min quantity tidak boleh negatif' })
  minQuantity?: number;

  @ApiPropertyOptional({
    description: 'Filter stok maksimum',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Max quantity harus berupa angka' })
  @Min(0, { message: 'Max quantity tidak boleh negatif' })
  maxQuantity?: number;

  @ApiPropertyOptional({
    description: 'Tampilkan hanya stok rendah',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Low stock harus berupa boolean' })
  lowStock?: boolean;

  @ApiPropertyOptional({
    description: 'Tampilkan hanya stok habis',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Out of stock harus berupa boolean' })
  outOfStock?: boolean;

  @ApiPropertyOptional({
    description: 'Tampilkan hanya item yang akan expired',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Expiring soon harus berupa boolean' })
  expiringSoon?: boolean;

  @ApiPropertyOptional({
    description: 'Tampilkan hanya item expired',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Expired harus berupa boolean' })
  expired?: boolean;

  @ApiPropertyOptional({
    description: 'Tampilkan hanya item aktif',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan lot number',
    example: 'LOT20241201001',
  })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan batch number',
    example: 'BATCH20241201001',
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Urutkan berdasarkan field',
    example: 'quantityOnHand',
    enum: ['quantityOnHand', 'quantityAvailable', 'totalValue', 'lastMovementAt', 'product.name', 'location.name'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Urutan sorting',
    enum: SortOrder,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'Sort order tidak valid' })
  sortOrder?: SortOrder;

  @ApiPropertyOptional({
    description: 'Halaman (untuk pagination)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page harus berupa angka' })
  @Min(1, { message: 'Page minimal 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Jumlah item per halaman',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  limit?: number;
}

export class InventoryTransactionQueryDto {
  @ApiPropertyOptional({
    description: 'Filter berdasarkan lokasi',
    example: 'uuid-location-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Location ID harus berformat UUID yang valid' })
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan produk',
    example: 'uuid-product-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Product ID harus berformat UUID yang valid' })
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe transaksi',
    example: 'receipt',
  })
  @IsOptional()
  @IsString()
  transactionType?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status transaksi',
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Tanggal mulai filter',
    example: '2024-06-01',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Start date harus berupa tanggal yang valid' })
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal akhir filter',
    example: '2024-06-30',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'End date harus berupa tanggal yang valid' })
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan reference number',
    example: 'PO-2024-06-001',
  })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan reference type',
    example: 'purchase_order',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({
    description: 'Urutkan berdasarkan field',
    example: 'transactionDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Urutan sorting',
    enum: SortOrder,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'Sort order tidak valid' })
  sortOrder?: SortOrder;

  @ApiPropertyOptional({
    description: 'Halaman (untuk pagination)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page harus berupa angka' })
  @Min(1, { message: 'Page minimal 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Jumlah item per halaman',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  limit?: number;
}

export class InventoryReportDto {
  @ApiProperty({
    description: 'Jenis laporan yang diinginkan',
    enum: InventoryReportType,
    example: InventoryReportType.STOCK_LEVELS,
  })
  @IsEnum(InventoryReportType, { message: 'Jenis report tidak valid' })
  reportType: InventoryReportType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan lokasi',
    example: 'uuid-location-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Location ID harus berformat UUID yang valid' })
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan kategori',
    example: 'uuid-category-id',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Category ID harus berformat UUID yang valid' })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Tanggal mulai periode laporan',
    example: '2024-06-01',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Start date harus berupa tanggal yang valid' })
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Tanggal akhir periode laporan',
    example: '2024-06-30',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'End date harus berupa tanggal yang valid' })
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Format export laporan',
    example: 'pdf',
    enum: ['json', 'csv', 'xlsx', 'pdf'],
  })
  @IsOptional()
  @IsEnum(['json', 'csv', 'xlsx', 'pdf'], { message: 'Format tidak valid' })
  format?: 'json' | 'csv' | 'xlsx' | 'pdf';
}