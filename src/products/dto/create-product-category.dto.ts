import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductCategoryDto {
  @ApiProperty({
    description: 'Nama kategori produk',
    example: 'Elektronik',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Nama kategori minimal 2 karakter' })
  @MaxLength(100, { message: 'Nama kategori maksimal 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    description: 'Deskripsi kategori',
    example: 'Kategori untuk semua produk elektronik',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL gambar kategori',
    example: 'https://example.com/category-image.jpg',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'ID kategori parent (untuk sub-kategori)',
    example: 'uuid-parent-kategori',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Parent ID harus berformat UUID' })
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Urutan tampilan kategori',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Sort order harus berupa angka' })
  @Min(0, { message: 'Sort order tidak boleh negatif' })
  @Transform(({ value }) => parseInt(value))
  sortOrder?: number = 0;

  @ApiPropertyOptional({
    description: 'Apakah kategori aktif',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is active harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean = true;
}
