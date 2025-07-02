import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'staff@stokcerdas.test',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email harus berupa alamat email yang valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Staff123!',
    minLength: 8,
    maxLength: 100,
  })
  @IsString({ message: 'Password harus berupa string' })
  @MinLength(8, { message: 'Password harus minimal 8 karakter' })
  @MaxLength(100, { message: 'Password maksimal 100 karakter' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password harus mengandung minimal 1 huruf kecil, 1 huruf besar, 1 angka, dan 1 karakter khusus',
  })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    maxLength: 100,
  })
  @IsString({ message: 'Nama depan harus berupa string' })
  @MaxLength(100, { message: 'Nama depan maksimal 100 karakter' })
  @IsNotEmpty({ message: 'Nama depan tidak boleh kosong' })
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    maxLength: 100,
  })
  @IsString({ message: 'Nama belakang harus berupa string' })
  @MaxLength(100, { message: 'Nama belakang maksimal 100 karakter' })
  @IsNotEmpty({ message: 'Nama belakang tidak boleh kosong' })
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({
    description: 'User phone number (Indonesian format)',
    example: '+62812345678901',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber('ID', { message: 'Nomor telepon harus berupa nomor telepon Indonesia yang valid' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.STAFF,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role harus salah satu dari: admin, manager, staff' })
  role?: UserRole;
}