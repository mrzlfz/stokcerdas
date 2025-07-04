import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@stokcerdas.test',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email harus berupa alamat email yang valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'admin123',
    minLength: 6,
    maxLength: 100,
  })
  @IsString({ message: 'Password harus berupa string' })
  @MinLength(6, { message: 'Password harus minimal 6 karakter' })
  @MaxLength(100, { message: 'Password maksimal 100 karakter' })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password: string;

  @ApiProperty({
    description: 'Remember me option for extended session',
    example: false,
    required: false,
  })
  rememberMe?: boolean;
}
