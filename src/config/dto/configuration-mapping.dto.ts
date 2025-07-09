/**
 * Configuration Mapping DTOs
 * Type-safe data transfer objects for Indonesian configuration operations
 * Provides validation and transformation for configuration management
 */

import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsArray,
  IsUUID,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConfigurationType,
  ConfigurationScope,
  ConfigurationStatus,
} from '../entities/configuration-mapping.entity';
import { ConfigurationChangeReason } from '../entities/configuration-history.entity';

// ======================= BASE DTOs =======================

export class CulturalContextDto {
  @ApiPropertyOptional({
    enum: ['id', 'en', 'jv', 'su'],
    description: 'Language context for configuration',
  })
  @IsOptional()
  @IsEnum(['id', 'en', 'jv', 'su'])
  language?: 'id' | 'en' | 'jv' | 'su';

  @ApiPropertyOptional({
    enum: ['islamic', 'christian', 'hindu', 'buddhist', 'general'],
    description: 'Religious context for configuration',
  })
  @IsOptional()
  @IsEnum(['islamic', 'christian', 'hindu', 'buddhist', 'general'])
  religiousContext?: 'islamic' | 'christian' | 'hindu' | 'buddhist' | 'general';

  @ApiPropertyOptional({
    enum: ['urban', 'rural', 'suburban'],
    description: 'Social context for configuration',
  })
  @IsOptional()
  @IsEnum(['urban', 'rural', 'suburban'])
  socialContext?: 'urban' | 'rural' | 'suburban';

  @ApiPropertyOptional({
    enum: ['low', 'medium', 'high'],
    description: 'Economic context for configuration',
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  economicContext?: 'low' | 'medium' | 'high';
}

export class ConfigurationMetadataDto {
  @ApiPropertyOptional({ description: 'Configuration description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ description: 'Configuration category' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  category?: string;

  @ApiPropertyOptional({
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    description: 'Data type of configuration value',
  })
  @IsOptional()
  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array';

  @ApiPropertyOptional({
    description: 'Validation rules for the configuration',
  })
  @IsOptional()
  @IsObject()
  validationRules?: any;

  @ApiPropertyOptional({
    enum: ['admin', 'api', 'system', 'migration'],
    description: 'Source of the configuration update',
  })
  @IsOptional()
  @IsEnum(['admin', 'api', 'system', 'migration'])
  updateSource?: 'admin' | 'api' | 'system' | 'migration';

  @ApiPropertyOptional({
    description: 'Indonesian regional context (e.g., DKI, JABAR)',
    pattern: '^[A-Z]{2,6}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2,6}$/)
  regionalContext?: string;

  @ApiPropertyOptional({
    enum: ['low', 'medium', 'high', 'critical'],
    description: 'Business impact level of configuration change',
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  businessImpact?: 'low' | 'medium' | 'high' | 'critical';

  @ApiPropertyOptional({ description: 'Effective date of configuration' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Expiration date of configuration' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({
    description: 'Whether approval is required for changes',
  })
  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @ApiPropertyOptional({
    description: 'User who last approved this configuration',
  })
  @IsOptional()
  @IsString()
  lastApprovedBy?: string;

  @ApiPropertyOptional({ description: 'Tags for categorization and search' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// ======================= CREATE DTOs =======================

export class CreateConfigurationMappingDto {
  @ApiProperty({
    enum: ConfigurationType,
    description: 'Type of Indonesian configuration',
  })
  @IsEnum(ConfigurationType)
  type: ConfigurationType;

  @ApiProperty({
    description: 'Configuration key (dot notation supported)',
    example: 'payment_methods.qris.transaction_fee',
  })
  @IsString()
  @Length(1, 200)
  @Matches(/^[a-z0-9_\.]+$/, {
    message:
      'Key must contain only lowercase letters, numbers, underscores, and dots',
  })
  key: string;

  @ApiProperty({ description: 'Configuration value (flexible JSON)' })
  @IsObject()
  value: any;

  @ApiPropertyOptional({
    enum: ConfigurationScope,
    description: 'Scope of configuration application',
    default: ConfigurationScope.GLOBAL,
  })
  @IsOptional()
  @IsEnum(ConfigurationScope)
  scope?: ConfigurationScope = ConfigurationScope.GLOBAL;

  @ApiPropertyOptional({
    description: 'Tenant ID for tenant-specific configurations',
  })
  @IsOptional()
  @IsUUID(4)
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Default/fallback value' })
  @IsOptional()
  @IsObject()
  defaultValue?: any;

  @ApiPropertyOptional({ description: 'Configuration metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigurationMetadataDto)
  metadata?: ConfigurationMetadataDto;

  @ApiPropertyOptional({
    description: 'Cache TTL in seconds',
    minimum: 60,
    maximum: 86400,
    default: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(86400)
  cacheTtl?: number = 3600;

  @ApiPropertyOptional({
    description: 'Indonesian region code',
    pattern: '^[A-Z]{2,6}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2,6}$/)
  regionCode?: string;

  @ApiPropertyOptional({ description: 'Cultural context for configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CulturalContextDto)
  culturalContext?: CulturalContextDto;

  @ApiPropertyOptional({ description: 'Configuration keys this depends on' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependsOn?: string[];

  @ApiPropertyOptional({ description: 'Configuration keys affected by this' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affects?: string[];
}

// ======================= UPDATE DTOs =======================

export class UpdateConfigurationMappingDto {
  @ApiPropertyOptional({ description: 'New configuration value' })
  @IsOptional()
  @IsObject()
  value?: any;

  @ApiPropertyOptional({
    enum: ConfigurationStatus,
    description: 'Configuration status',
  })
  @IsOptional()
  @IsEnum(ConfigurationStatus)
  status?: ConfigurationStatus;

  @ApiPropertyOptional({ description: 'Updated default/fallback value' })
  @IsOptional()
  @IsObject()
  defaultValue?: any;

  @ApiPropertyOptional({ description: 'Updated configuration metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfigurationMetadataDto)
  metadata?: ConfigurationMetadataDto;

  @ApiPropertyOptional({
    description: 'Updated cache TTL in seconds',
    minimum: 60,
    maximum: 86400,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(86400)
  cacheTtl?: number;

  @ApiPropertyOptional({ description: 'Updated cultural context' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CulturalContextDto)
  culturalContext?: CulturalContextDto;

  @ApiPropertyOptional({ description: 'Updated dependencies' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependsOn?: string[];

  @ApiPropertyOptional({ description: 'Updated affected configurations' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affects?: string[];

  @ApiProperty({
    enum: ConfigurationChangeReason,
    description: 'Reason for configuration change',
  })
  @IsEnum(ConfigurationChangeReason)
  changeReason: ConfigurationChangeReason;

  @ApiPropertyOptional({ description: 'Description of the change' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  changeDescription?: string;

  @ApiPropertyOptional({ description: 'User making the change' })
  @IsOptional()
  @IsString()
  updatedBy?: string;
}

// ======================= QUERY DTOs =======================

export class ConfigurationQueryDto {
  @ApiPropertyOptional({
    enum: ConfigurationType,
    description: 'Filter by configuration type',
  })
  @IsOptional()
  @IsEnum(ConfigurationType)
  type?: ConfigurationType;

  @ApiPropertyOptional({
    enum: ConfigurationScope,
    description: 'Filter by configuration scope',
  })
  @IsOptional()
  @IsEnum(ConfigurationScope)
  scope?: ConfigurationScope;

  @ApiPropertyOptional({ description: 'Filter by tenant ID' })
  @IsOptional()
  @IsUUID(4)
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filter by region code' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2,6}$/)
  regionCode?: string;

  @ApiPropertyOptional({ description: 'Search in configuration keys' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  keySearch?: string;

  @ApiPropertyOptional({
    enum: ConfigurationStatus,
    description: 'Filter by status',
    default: ConfigurationStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ConfigurationStatus)
  status?: ConfigurationStatus = ConfigurationStatus.ACTIVE;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Only include configurations with high business impact',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  highImpactOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}

// ======================= RESPONSE DTOs =======================

export class ConfigurationMappingResponseDto {
  @ApiProperty({ description: 'Configuration ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID (null for global)' })
  tenantId?: string;

  @ApiProperty({ enum: ConfigurationType, description: 'Configuration type' })
  type: ConfigurationType;

  @ApiProperty({ description: 'Configuration key' })
  key: string;

  @ApiProperty({ enum: ConfigurationScope, description: 'Configuration scope' })
  scope: ConfigurationScope;

  @ApiProperty({
    enum: ConfigurationStatus,
    description: 'Configuration status',
  })
  status: ConfigurationStatus;

  @ApiProperty({ description: 'Configuration value' })
  value: any;

  @ApiProperty({ description: 'Default value' })
  defaultValue?: any;

  @ApiProperty({ description: 'Configuration metadata' })
  metadata: any;

  @ApiProperty({ description: 'Configuration version' })
  version: number;

  @ApiProperty({ description: 'Whether configuration is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Cache TTL in seconds' })
  cacheTtl: number;

  @ApiProperty({ description: 'Region code' })
  regionCode?: string;

  @ApiProperty({ description: 'Cultural context' })
  culturalContext: any;

  @ApiProperty({ description: 'Dependencies' })
  dependsOn: string[];

  @ApiProperty({ description: 'Affected configurations' })
  affects: string[];

  @ApiProperty({ description: 'Usage statistics' })
  usageCount: number;

  @ApiProperty({ description: 'Last accessed timestamp' })
  lastAccessedAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ConfigurationBulkUpdateDto {
  @ApiProperty({ description: 'Configuration updates to apply' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateConfigurationMappingDto)
  updates: (UpdateConfigurationMappingDto & { id: string })[];

  @ApiProperty({
    enum: ConfigurationChangeReason,
    description: 'Reason for bulk update',
  })
  @IsEnum(ConfigurationChangeReason)
  changeReason: ConfigurationChangeReason;

  @ApiPropertyOptional({ description: 'Description of bulk change' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  changeDescription?: string;

  @ApiPropertyOptional({ description: 'Whether to validate before applying' })
  @IsOptional()
  @IsBoolean()
  validateFirst?: boolean = true;

  @ApiPropertyOptional({ description: 'Whether to rollback on any failure' })
  @IsOptional()
  @IsBoolean()
  rollbackOnFailure?: boolean = true;
}
