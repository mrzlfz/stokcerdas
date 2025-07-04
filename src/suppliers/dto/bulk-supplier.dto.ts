import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';
import { UpdateSupplierDto } from './update-supplier.dto';

export class BulkCreateSupplierDto {
  @ApiProperty({
    description: 'Array supplier yang akan dibuat',
    type: [CreateSupplierDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 supplier untuk bulk create' })
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierDto)
  suppliers: CreateSupplierDto[];
}

export class BulkUpdateSupplierDto {
  @ApiProperty({
    description: 'Array ID supplier yang akan diupdate',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 supplier ID untuk bulk update' })
  @IsUUID(4, { each: true, message: 'Setiap ID harus berformat UUID' })
  supplierIds: string[];

  @ApiProperty({
    description: 'Data yang akan diupdate ke semua supplier',
    type: UpdateSupplierDto,
  })
  @ValidateNested()
  @Type(() => UpdateSupplierDto)
  updateData: UpdateSupplierDto;
}

export class BulkDeleteSupplierDto {
  @ApiProperty({
    description: 'Array ID supplier yang akan dihapus',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 supplier ID untuk bulk delete' })
  @IsUUID(4, { each: true, message: 'Setiap ID harus berformat UUID' })
  supplierIds: string[];

  @ApiPropertyOptional({
    description: 'Hard delete (hapus permanent)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Hard delete harus berupa boolean' })
  hardDelete?: boolean = false;
}

export class BulkSupplierResponseDto {
  @ApiProperty({
    description: 'Jumlah supplier yang berhasil diproses',
    example: 3,
  })
  successful: number;

  @ApiProperty({
    description: 'Jumlah supplier yang gagal diproses',
    example: 1,
  })
  failed: number;

  @ApiPropertyOptional({
    description: 'Array ID supplier yang berhasil diproses',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  successfulIds?: string[];

  @ApiPropertyOptional({
    description: 'Array error yang terjadi',
    type: [Object],
    example: [
      {
        code: 'SUP-001',
        index: 0,
        error: 'Kode supplier sudah ada',
      },
    ],
  })
  errors?: {
    code?: string;
    index: number;
    error: string;
  }[];
}
