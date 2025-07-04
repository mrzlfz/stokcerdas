import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PurchaseOrderStatus,
  PurchaseOrderPriority,
  PurchaseOrderType,
  ApprovalStatus,
} from '../entities/purchase-order.entity';

export class PurchaseOrderQueryDto {
  @ApiPropertyOptional({
    description: 'Halaman (pagination)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page harus berupa angka' })
  @Min(1, { message: 'Page minimal 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Jumlah data per halaman',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit harus berupa angka' })
  @Min(1, { message: 'Limit minimal 1' })
  @Max(100, { message: 'Limit maksimal 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pencarian berdasarkan PO number, supplier, atau produk',
    example: 'PO-2025',
  })
  @IsOptional()
  @IsString({ message: 'Search harus berupa string' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status PO',
    example: PurchaseOrderStatus.PENDING_APPROVAL,
    enum: PurchaseOrderStatus,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus, { message: 'Status tidak valid' })
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan prioritas PO',
    example: PurchaseOrderPriority.HIGH,
    enum: PurchaseOrderPriority,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderPriority, { message: 'Prioritas tidak valid' })
  priority?: PurchaseOrderPriority;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tipe PO',
    example: PurchaseOrderType.STANDARD,
    enum: PurchaseOrderType,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderType, { message: 'Tipe PO tidak valid' })
  type?: PurchaseOrderType;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan status approval',
    example: ApprovalStatus.PENDING,
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsEnum(ApprovalStatus, { message: 'Status approval tidak valid' })
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan supplier ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Supplier ID harus berupa UUID yang valid' })
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan nama supplier',
    example: 'PT. Supplier Indonesia',
  })
  @IsOptional()
  @IsString({ message: 'Supplier name harus berupa string' })
  supplierName?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tanggal order (dari)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date harus berupa tanggal yang valid' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tanggal order (sampai)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date harus berupa tanggal yang valid' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tanggal pengiriman (dari)',
    example: '2025-07-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Delivery start date harus berupa tanggal yang valid' },
  )
  deliveryStartDate?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tanggal pengiriman (sampai)',
    example: '2025-07-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Delivery end date harus berupa tanggal yang valid' },
  )
  deliveryEndDate?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan total amount minimal',
    example: 1000000.0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Min amount harus berupa angka dengan maksimal 2 desimal' },
  )
  @Min(0, { message: 'Min amount tidak boleh negatif' })
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan total amount maksimal',
    example: 50000000.0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Max amount harus berupa angka dengan maksimal 2 desimal' },
  )
  @Min(0, { message: 'Max amount tidak boleh negatif' })
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter PO yang urgent saja',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Is urgent harus berupa boolean' })
  isUrgent?: boolean;

  @ApiPropertyOptional({
    description: 'Filter PO yang memerlukan approval',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Requires approval harus berupa boolean' })
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Filter PO yang terlambat (overdue)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Is overdue harus berupa boolean' })
  isOverdue?: boolean;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan tag',
    example: 'urgent',
  })
  @IsOptional()
  @IsString({ message: 'Tag harus berupa string' })
  tag?: string;

  @ApiPropertyOptional({
    description: 'ID user yang membuat PO',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Created by harus berupa UUID yang valid' })
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'ID user yang meng-approve PO',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Approved by harus berupa UUID yang valid' })
  approvedBy?: string;

  @ApiPropertyOptional({
    description: 'Field untuk sorting',
    example: 'orderDate',
    enum: [
      'poNumber',
      'orderDate',
      'expectedDeliveryDate',
      'totalAmount',
      'status',
      'priority',
      'createdAt',
      'updatedAt',
      'supplierName',
      'completionPercentage',
    ],
  })
  @IsOptional()
  @IsString({ message: 'Sort by harus berupa string' })
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Urutan sorting',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'], { message: 'Sort order harus ASC atau DESC' })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'Include soft deleted records',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Include deleted harus berupa boolean' })
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include items dalam response',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Include items harus berupa boolean' })
  includeItems?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include approvals dalam response',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Include approvals harus berupa boolean' })
  includeApprovals?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include status history dalam response',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Include status history harus berupa boolean' })
  includeStatusHistory?: boolean = false;
}
