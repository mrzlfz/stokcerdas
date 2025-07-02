import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '../entities/purchase-order.entity';

export class ApprovePurchaseOrderDto {
  @ApiPropertyOptional({
    description: 'Komentar untuk approval',
    example: 'Approved sesuai dengan budget yang disetujui',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa string' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;
}

export class RejectPurchaseOrderDto {
  @ApiProperty({
    description: 'Alasan penolakan (wajib)',
    example: 'Budget tidak mencukupi untuk periode ini',
  })
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(1000, { message: 'Reason maksimal 1000 karakter' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Komentar tambahan untuk penolakan',
    example: 'Mohon ajukan kembali pada periode budget berikutnya',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa string' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;
}

export class EscalateApprovalDto {
  @ApiProperty({
    description: 'ID user yang akan menerima escalation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Escalated to harus berupa UUID yang valid' })
  escalatedTo: string;

  @ApiPropertyOptional({
    description: 'Alasan escalation',
    example: 'Memerlukan approval dari level yang lebih tinggi',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(1000, { message: 'Reason maksimal 1000 karakter' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Komentar tambahan untuk escalation',
    example: 'Nilai PO melebihi batas approval manager',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa string' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;
}

export class CreateApprovalWorkflowDto {
  @ApiProperty({
    description: 'ID purchase order',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Purchase order ID harus berupa UUID yang valid' })
  purchaseOrderId: string;

  @ApiProperty({
    description: 'ID approver',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID(4, { message: 'Approver ID harus berupa UUID yang valid' })
  approverId: string;

  @ApiPropertyOptional({
    description: 'Level approval (untuk multi-level approval)',
    example: 1,
    minimum: 1,
    maximum: 10,
    default: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Level harus berupa angka' })
  @Min(1, { message: 'Level minimal 1' })
  @Max(10, { message: 'Level maksimal 10' })
  level?: number;

  @ApiPropertyOptional({
    description: 'Apakah approval ini wajib',
    example: true,
    default: true,
  })
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Komentar untuk setup approval',
    example: 'Approval dari finance manager diperlukan untuk PO > 10 juta',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa string' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;
}

export class UpdateApprovalStatusDto {
  @ApiProperty({
    description: 'Status approval baru',
    example: ApprovalStatus.APPROVED,
    enum: ApprovalStatus,
  })
  @IsEnum(ApprovalStatus, { message: 'Status approval tidak valid' })
  status: ApprovalStatus;

  @ApiPropertyOptional({
    description: 'Komentar untuk perubahan status',
    example: 'Approved dengan catatan tambahan',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa string' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;

  @ApiPropertyOptional({
    description: 'Alasan penolakan (wajib jika status REJECTED)',
    example: 'Budget tidak mencukupi',
  })
  @IsOptional()
  @IsString({ message: 'Rejection reason harus berupa string' })
  @MaxLength(1000, { message: 'Rejection reason maksimal 1000 karakter' })
  rejectionReason?: string;
}

export class BulkApprovalDto {
  @ApiProperty({
    description: 'Daftar ID purchase orders yang akan di-approve/reject',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d7-b789-123456789abc'],
    type: [String],
  })
  @IsUUID(4, { each: true, message: 'Setiap PO ID harus berupa UUID yang valid' })
  purchaseOrderIds: string[];

  @ApiProperty({
    description: 'Action yang akan dilakukan',
    example: 'approve',
    enum: ['approve', 'reject'],
  })
  @IsEnum(['approve', 'reject'], { message: 'Action harus approve atau reject' })
  action: 'approve' | 'reject';

  @ApiPropertyOptional({
    description: 'Komentar untuk bulk action',
    example: 'Bulk approval untuk PO periode Q2 2025',
  })
  @IsOptional()
  @IsString({ message: 'Comments harus berupa string' })
  @MaxLength(1000, { message: 'Comments maksimal 1000 karakter' })
  comments?: string;

  @ApiPropertyOptional({
    description: 'Alasan penolakan (wajib jika action adalah reject)',
    example: 'Budget periode ini sudah habis',
  })
  @IsOptional()
  @IsString({ message: 'Reason harus berupa string' })
  @MaxLength(1000, { message: 'Reason maksimal 1000 karakter' })
  reason?: string;
}

// Response DTOs
export class ApprovalResponseDto {
  @ApiProperty({ description: 'ID approval' })
  id: string;

  @ApiProperty({ description: 'ID purchase order' })
  purchaseOrderId: string;

  @ApiProperty({ description: 'ID approver' })
  approverId: string;

  @ApiProperty({ description: 'Status approval', enum: ApprovalStatus })
  status: ApprovalStatus;

  @ApiProperty({ description: 'Level approval' })
  level: number;

  @ApiPropertyOptional({ description: 'Tanggal review' })
  reviewedAt?: Date;

  @ApiPropertyOptional({ description: 'Komentar' })
  comments?: string;

  @ApiPropertyOptional({ description: 'Alasan penolakan' })
  rejectionReason?: string;

  @ApiProperty({ description: 'Apakah approval wajib' })
  isRequired: boolean;

  @ApiProperty({ description: 'Apakah di-escalate' })
  isEscalated: boolean;

  @ApiPropertyOptional({ description: 'Tanggal escalation' })
  escalatedAt?: Date;

  @ApiPropertyOptional({ description: 'ID user yang menerima escalation' })
  escalatedTo?: string;

  @ApiProperty({ description: 'Tanggal dibuat' })
  createdAt: Date;

  @ApiProperty({ description: 'Tanggal diupdate' })
  updatedAt: Date;
}

export class BulkApprovalResponseDto {
  @ApiProperty({ description: 'Jumlah PO yang berhasil diproses' })
  successful: number;

  @ApiProperty({ description: 'Jumlah PO yang gagal diproses' })
  failed: number;

  @ApiProperty({ description: 'Daftar ID PO yang berhasil diproses', type: [String] })
  successfulIds: string[];

  @ApiProperty({ description: 'Daftar error yang terjadi', type: [Object] })
  errors: Array<{
    purchaseOrderId: string;
    error: string;
  }>;

  @ApiProperty({ description: 'Total PO yang diproses' })
  total: number;
}