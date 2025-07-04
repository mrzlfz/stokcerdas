import {
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsDecimal,
  IsNotEmpty,
  ArrayMinSize,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PurchaseOrderType,
  PurchaseOrderPriority,
  PaymentTerms,
} from '../entities/purchase-order.entity';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    description: 'ID produk yang akan dipesan',
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
    example: 15000000.0,
    minimum: 0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Harga satuan harus berupa angka dengan maksimal 2 desimal' },
  )
  @Min(0, { message: 'Harga satuan tidak boleh negatif' })
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Persentase diskon (0-100)',
    example: 5.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'Persentase diskon harus berupa angka dengan maksimal 2 desimal',
    },
  )
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
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'Persentase pajak harus berupa angka dengan maksimal 2 desimal',
    },
  )
  @Min(0, { message: 'Persentase pajak tidak boleh negatif' })
  @Max(100, { message: 'Persentase pajak maksimal 100%' })
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Tanggal pengiriman yang diharapkan',
    example: '2025-07-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Expected delivery date harus berupa tanggal yang valid' },
  )
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

export class DeliveryAddressDto {
  @ApiProperty({
    description: 'Nama penerima',
    example: 'PT. Stokcerdas Indonesia',
  })
  @IsString({ message: 'Nama penerima harus berupa string' })
  @MinLength(1, { message: 'Nama penerima tidak boleh kosong' })
  @MaxLength(255, { message: 'Nama penerima maksimal 255 karakter' })
  name: string;

  @ApiProperty({
    description: 'Alamat lengkap',
    example: 'Jl. Sudirman No. 123, Gedung ABC Lt. 5',
  })
  @IsString({ message: 'Alamat harus berupa string' })
  @MinLength(1, { message: 'Alamat tidak boleh kosong' })
  @MaxLength(500, { message: 'Alamat maksimal 500 karakter' })
  address: string;

  @ApiProperty({
    description: 'Nama kota',
    example: 'Jakarta Selatan',
  })
  @IsString({ message: 'Kota harus berupa string' })
  @MinLength(1, { message: 'Kota tidak boleh kosong' })
  @MaxLength(100, { message: 'Kota maksimal 100 karakter' })
  city: string;

  @ApiProperty({
    description: 'Nama provinsi',
    example: 'DKI Jakarta',
  })
  @IsString({ message: 'Provinsi harus berupa string' })
  @MinLength(1, { message: 'Provinsi tidak boleh kosong' })
  @MaxLength(100, { message: 'Provinsi maksimal 100 karakter' })
  state: string;

  @ApiProperty({
    description: 'Kode pos',
    example: '12190',
  })
  @IsString({ message: 'Kode pos harus berupa string' })
  @MinLength(5, { message: 'Kode pos minimal 5 karakter' })
  @MaxLength(10, { message: 'Kode pos maksimal 10 karakter' })
  postalCode: string;

  @ApiPropertyOptional({
    description: 'Nama negara',
    example: 'Indonesia',
    default: 'Indonesia',
  })
  @IsOptional()
  @IsString({ message: 'Negara harus berupa string' })
  @MaxLength(100, { message: 'Negara maksimal 100 karakter' })
  country?: string;

  @ApiPropertyOptional({
    description: 'Nomor telepon lokasi pengiriman',
    example: '+62-21-12345678',
  })
  @IsOptional()
  @IsString({ message: 'Telepon harus berupa string' })
  @MaxLength(20, { message: 'Telepon maksimal 20 karakter' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Nama contact person di lokasi pengiriman',
    example: 'Budi Santoso',
  })
  @IsOptional()
  @IsString({ message: 'Contact person harus berupa string' })
  @MaxLength(255, { message: 'Contact person maksimal 255 karakter' })
  contactPerson?: string;

  @ApiPropertyOptional({
    description: 'Catatan tambahan untuk pengiriman',
    example: 'Kirim ke loading dock lantai basement',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(500, { message: 'Notes maksimal 500 karakter' })
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @ApiPropertyOptional({
    description: 'Nomor PO (akan di-generate otomatis jika tidak diisi)',
    example: 'PO-2025-001',
  })
  @IsOptional()
  @IsString({ message: 'PO Number harus berupa string' })
  @MinLength(3, { message: 'PO Number minimal 3 karakter' })
  @MaxLength(50, { message: 'PO Number maksimal 50 karakter' })
  poNumber?: string;

  @ApiPropertyOptional({
    description: 'Nomor referensi dari supplier',
    example: 'REF-SUP-2025-001',
  })
  @IsOptional()
  @IsString({ message: 'Supplier reference harus berupa string' })
  @MaxLength(100, { message: 'Supplier reference maksimal 100 karakter' })
  supplierReference?: string;

  @ApiProperty({
    description: 'ID supplier yang akan digunakan',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Supplier ID harus berupa UUID yang valid' })
  supplierId: string;

  @ApiPropertyOptional({
    description: 'Tipe purchase order',
    example: PurchaseOrderType.STANDARD,
    enum: PurchaseOrderType,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderType, { message: 'Tipe PO tidak valid' })
  type?: PurchaseOrderType;

  @ApiPropertyOptional({
    description: 'Prioritas purchase order',
    example: PurchaseOrderPriority.NORMAL,
    enum: PurchaseOrderPriority,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority, { message: 'Prioritas PO tidak valid' })
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional({
    description: 'Tanggal order (default: hari ini)',
    example: '2025-06-30T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Order date harus berupa tanggal yang valid' })
  orderDate?: string;

  @ApiPropertyOptional({
    description: 'Tanggal pengiriman yang diharapkan',
    example: '2025-07-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Expected delivery date harus berupa tanggal yang valid' },
  )
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Tanggal pengiriman yang diminta',
    example: '2025-07-10T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Requested delivery date harus berupa tanggal yang valid' },
  )
  requestedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Biaya pengiriman',
    example: 150000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'Biaya pengiriman harus berupa angka dengan maksimal 2 desimal',
    },
  )
  @Min(0, { message: 'Biaya pengiriman tidak boleh negatif' })
  shippingAmount?: number;

  @ApiPropertyOptional({
    description: 'Total diskon dalam nilai rupiah',
    example: 500000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Diskon harus berupa angka dengan maksimal 2 desimal' },
  )
  @Min(0, { message: 'Diskon tidak boleh negatif' })
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Persentase pajak keseluruhan (0-100)',
    example: 11,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'Persentase pajak harus berupa angka dengan maksimal 2 desimal',
    },
  )
  @Min(0, { message: 'Persentase pajak tidak boleh negatif' })
  @Max(100, { message: 'Persentase pajak maksimal 100%' })
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Kode mata uang',
    example: 'IDR',
    default: 'IDR',
  })
  @IsOptional()
  @IsString({ message: 'Currency harus berupa string' })
  @MaxLength(10, { message: 'Currency maksimal 10 karakter' })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Terms of payment',
    example: PaymentTerms.NET_30,
    enum: PaymentTerms,
  })
  @IsOptional()
  @IsEnum(PaymentTerms, { message: 'Payment terms tidak valid' })
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({
    description: 'Jumlah hari pembayaran custom (untuk payment terms CUSTOM)',
    example: 45,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Custom payment days harus berupa angka' })
  @Min(1, { message: 'Custom payment days minimal 1' })
  @Max(365, { message: 'Custom payment days maksimal 365' })
  customPaymentDays?: number;

  @ApiPropertyOptional({
    description: 'Alamat pengiriman',
    type: DeliveryAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @ApiPropertyOptional({
    description: 'ID lokasi inventori untuk pengiriman',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Delivery location ID harus berupa UUID yang valid' })
  deliveryLocationId?: string;

  @ApiPropertyOptional({
    description: 'Metode pengiriman',
    example: 'JNE Regular',
  })
  @IsOptional()
  @IsString({ message: 'Shipping method harus berupa string' })
  @MaxLength(255, { message: 'Shipping method maksimal 255 karakter' })
  shippingMethod?: string;

  @ApiPropertyOptional({
    description:
      'Batas nilai untuk otomatis approval (dalam mata uang yang dipilih)',
    example: 10000000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Approval threshold harus berupa angka dengan maksimal 2 desimal',
    },
  )
  @Min(0, { message: 'Approval threshold tidak boleh negatif' })
  approvalThreshold?: number;

  @ApiPropertyOptional({
    description: 'Deskripsi purchase order',
    example: 'Purchase order untuk restocking laptop kantor Q2 2025',
  })
  @IsOptional()
  @IsString({ message: 'Deskripsi harus berupa string' })
  @MaxLength(1000, { message: 'Deskripsi maksimal 1000 karakter' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Catatan untuk purchase order',
    example: 'Mohon konfirmasi ketersediaan stok sebelum pengiriman',
  })
  @IsOptional()
  @IsString({ message: 'Notes harus berupa string' })
  @MaxLength(1000, { message: 'Notes maksimal 1000 karakter' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Catatan internal (tidak terlihat oleh supplier)',
    example: 'Budget dari departemen IT untuk Q2 2025',
  })
  @IsOptional()
  @IsString({ message: 'Internal notes harus berupa string' })
  @MaxLength(1000, { message: 'Internal notes maksimal 1000 karakter' })
  internalNotes?: string;

  @ApiPropertyOptional({
    description: 'Instruksi khusus untuk supplier',
    example: 'Harap konfirmasi lead time dan jadwal pengiriman',
  })
  @IsOptional()
  @IsString({ message: 'Supplier instructions harus berupa string' })
  @MaxLength(1000, { message: 'Supplier instructions maksimal 1000 karakter' })
  supplierInstructions?: string;

  @ApiPropertyOptional({
    description: 'Tags untuk kategorisasi',
    example: ['urgent', 'IT equipment', 'Q2-2025'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Tags harus berupa array' })
  @IsString({ each: true, message: 'Setiap tag harus berupa string' })
  @MaxLength(50, { each: true, message: 'Setiap tag maksimal 50 karakter' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Menandai sebagai urgent',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is urgent harus berupa boolean' })
  isUrgent?: boolean;

  @ApiPropertyOptional({
    description: 'Custom fields untuk data tambahan',
    example: { department: 'IT', budgetCode: 'IT-Q2-2025' },
  })
  @IsOptional()
  @IsObject({ message: 'Custom fields harus berupa object' })
  customFields?: Record<string, any>;

  @ApiProperty({
    description: 'Daftar item yang akan dipesan',
    type: [CreatePurchaseOrderItemDto],
    isArray: true,
  })
  @IsArray({ message: 'Items harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal harus ada 1 item' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
