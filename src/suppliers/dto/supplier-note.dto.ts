import {
  IsString,
  IsNumber,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddSupplierNoteDto {
  @ApiProperty({
    description: 'Catatan untuk supplier',
    example:
      'Supplier ini selalu mengirim barang tepat waktu dan kualitas bagus',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10, { message: 'Catatan minimal 10 karakter' })
  @MaxLength(1000, { message: 'Catatan maksimal 1000 karakter' })
  note: string;
}

export class UpdateSupplierPerformanceDto {
  @ApiProperty({
    description: 'Jumlah pembelian dalam mata uang supplier',
    example: 50000000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Jumlah pembelian harus berupa angka' })
  @Min(0, { message: 'Jumlah pembelian tidak boleh negatif' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Apakah pengiriman tepat waktu',
    example: true,
  })
  @IsBoolean({ message: 'On time harus berupa boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  onTime: boolean;

  @ApiProperty({
    description: 'Skor kualitas (0-100)',
    example: 95,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({}, { message: 'Skor kualitas harus berupa angka' })
  @Min(0, { message: 'Skor kualitas minimal 0' })
  @Max(100, { message: 'Skor kualitas maksimal 100' })
  @Transform(({ value }) => parseFloat(value))
  qualityScore: number;

  @ApiProperty({
    description: 'Lead time untuk order ini (dalam hari)',
    example: 7,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Lead time harus berupa angka' })
  @Min(0, { message: 'Lead time tidak boleh negatif' })
  @Transform(({ value }) => parseInt(value))
  leadTime: number;
}
