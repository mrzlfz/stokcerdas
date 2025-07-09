import {
  IsOptional,
  IsEnum,
  IsEmail,
  IsString,
  IsPhoneNumber,
  IsDateString,
  IsArray,
  IsBoolean,
  IsNumber,
  ValidateNested,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerType,
  CustomerStatus,
  LoyaltyTier,
  CustomerSegmentType,
} from '../entities/customer.entity';

export class CustomerAddressDto {
  @ApiProperty({ description: 'Address identifier' })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Address type',
    enum: ['billing', 'shipping', 'business'],
  })
  @IsEnum(['billing', 'shipping', 'business'])
  type: 'billing' | 'shipping' | 'business';

  @ApiProperty({ description: 'Is this the default address' })
  @IsBoolean()
  isDefault: boolean;

  @ApiProperty({ description: 'Address recipient name' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ description: 'Street address' })
  @IsString()
  @Length(1, 500)
  address: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiProperty({ description: 'State/Province' })
  @IsString()
  @Length(1, 100)
  state: string;

  @ApiProperty({ description: 'Postal code' })
  @IsString()
  @Length(1, 20)
  postalCode: string;

  @ApiProperty({ description: 'Country', default: 'Indonesia' })
  @IsString()
  @Length(1, 100)
  country: string;

  @ApiPropertyOptional({ description: 'Phone number for this address' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Additional address notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CustomerPreferencesDto {
  @ApiPropertyOptional({
    description: 'Preferred product categories',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCategories?: string[];

  @ApiPropertyOptional({
    description: 'Preferred brands',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredBrands?: string[];

  @ApiPropertyOptional({
    description: 'Preferred price range',
    type: 'object',
    properties: {
      min: { type: 'number' },
      max: { type: 'number' },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  preferredPriceRange?: { min: number; max: number };

  @ApiPropertyOptional({
    description: 'Preferred payment methods',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredPaymentMethods?: string[];

  @ApiPropertyOptional({
    description: 'Preferred delivery methods',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDeliveryMethods?: string[];

  @ApiPropertyOptional({
    description: 'Communication preferences',
    type: 'object',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  communicationPreferences?: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    phone: boolean;
  };

  @ApiPropertyOptional({ description: 'Marketing consent' })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}

export class CustomerSocialProfilesDto {
  @ApiPropertyOptional({ description: 'Instagram handle' })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional({ description: 'Facebook profile' })
  @IsOptional()
  @IsString()
  facebook?: string;

  @ApiPropertyOptional({ description: 'WhatsApp number' })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional({ description: 'Telegram handle' })
  @IsOptional()
  @IsString()
  telegram?: string;
}

export class CreateCustomerDto {
  // Basic Information
  @ApiProperty({
    description: 'Customer full name',
    example: 'Siti Nurhaliza Binti Abdullah',
  })
  @IsString()
  @Length(2, 255)
  fullName: string;

  @ApiPropertyOptional({
    description: 'Customer first name',
    example: 'Siti',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Customer last name',
    example: 'Nurhaliza',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Customer email address',
    example: 'siti.nurhaliza@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Customer phone number (Indonesian format)',
    example: '+6281234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Customer date of birth',
    example: '1990-05-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Customer type',
    enum: CustomerType,
    default: CustomerType.INDIVIDUAL,
  })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType = CustomerType.INDIVIDUAL;

  @ApiPropertyOptional({
    description: 'Customer status',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus = CustomerStatus.ACTIVE;

  // Business Information (for business customers)
  @ApiPropertyOptional({
    description: 'Company name (for business customers)',
    example: 'PT Teknologi Maju Indonesia',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Tax ID/NPWP (for business customers)',
    example: '12.345.678.9-012.000',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Industry sector',
    example: 'Technology',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  industry?: string;

  @ApiPropertyOptional({
    description: 'Business size',
    example: 'Small',
    enum: ['Micro', 'Small', 'Medium', 'Large'],
  })
  @IsOptional()
  @IsString()
  businessSize?: string;

  // Address Information
  @ApiPropertyOptional({
    description: 'Customer addresses',
    type: [CustomerAddressDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerAddressDto)
  addresses?: CustomerAddressDto[];

  // Customer Preferences
  @ApiPropertyOptional({
    description: 'Customer preferences',
    type: CustomerPreferencesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerPreferencesDto)
  preferences?: CustomerPreferencesDto;

  // Social Profiles
  @ApiPropertyOptional({
    description: 'Social media profiles',
    type: CustomerSocialProfilesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerSocialProfilesDto)
  socialProfiles?: CustomerSocialProfilesDto;

  // External IDs
  @ApiPropertyOptional({
    description: 'External system IDs',
    type: 'object',
  })
  @IsOptional()
  externalIds?: {
    shopeeCustomerId?: string;
    tokopediaCustomerId?: string;
    lazadaCustomerId?: string;
    whatsappContactId?: string;
    mokaCustomerId?: string;
  };

  // Assignment
  @ApiPropertyOptional({ description: 'Assigned sales representative ID' })
  @IsOptional()
  @IsUUID()
  assignedSalesRepId?: string;

  @ApiPropertyOptional({ description: 'Account manager ID' })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  // Metadata
  @ApiPropertyOptional({
    description: 'Customer tags',
    type: [String],
    example: ['vip', 'enterprise', 'loyal'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Public notes about customer',
    example: 'Prefers WhatsApp communication',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Internal notes (not visible to customer)',
    example: 'High-value customer, requires special attention',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({
    description: 'Custom fields for additional data',
    type: 'object',
  })
  @IsOptional()
  customFields?: Record<string, any>;

  // Initial Analytics (optional, usually auto-calculated)
  @ApiPropertyOptional({
    description: 'Initial customer segment',
    enum: CustomerSegmentType,
    default: CustomerSegmentType.NEW_CUSTOMER,
  })
  @IsOptional()
  @IsEnum(CustomerSegmentType)
  segment?: CustomerSegmentType = CustomerSegmentType.NEW_CUSTOMER;

  @ApiPropertyOptional({
    description: 'Initial loyalty tier',
    enum: LoyaltyTier,
    default: LoyaltyTier.BRONZE,
  })
  @IsOptional()
  @IsEnum(LoyaltyTier)
  loyaltyTier?: LoyaltyTier = LoyaltyTier.BRONZE;

  @ApiPropertyOptional({
    description: 'Initial loyalty points',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyPoints?: number = 0;
}
