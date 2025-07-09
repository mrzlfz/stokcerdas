/**
 * Configuration Administrative DTOs
 * Enhanced DTOs for administrative configuration management operations
 * Supports templates, migrations, audits, and system management
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
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConfigurationType,
  ConfigurationScope,
  ConfigurationStatus,
} from '../entities/configuration-mapping.entity';
import { ConfigurationChangeReason } from '../entities/configuration-history.entity';

// ======================= TEMPLATE MANAGEMENT =======================

export class ConfigurationTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Template description' })
  @IsString()
  @Length(0, 500)
  description: string;

  @ApiProperty({
    enum: ConfigurationType,
    description: 'Configuration type for this template',
  })
  @IsEnum(ConfigurationType)
  type: ConfigurationType;

  @ApiProperty({ description: 'Template configuration structure' })
  @IsObject()
  template: any;

  @ApiPropertyOptional({ description: 'Default values for template' })
  @IsOptional()
  @IsObject()
  defaultValues?: any;

  @ApiPropertyOptional({ description: 'Template category' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  category?: string;

  @ApiPropertyOptional({ description: 'Template tags for search' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Template version' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ description: 'Indonesian regions this template applies to' })
  @IsArray()
  @IsString({ each: true })
  applicableRegions: string[];
}

export class CreateTemplateFromConfigDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @Length(1, 100)
  templateName: string;

  @ApiProperty({ description: 'Configuration IDs to include in template' })
  @IsArray()
  @IsUUID(4, { each: true })
  configurationIds: string[];

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ description: 'Template category' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class ApplyTemplateDto {
  @ApiProperty({ description: 'Template ID to apply' })
  @IsUUID(4)
  templateId: string;

  @ApiPropertyOptional({ description: 'Target tenant ID' })
  @IsOptional()
  @IsUUID(4)
  targetTenantId?: string;

  @ApiPropertyOptional({ description: 'Target region code' })
  @IsOptional()
  @IsString()
  targetRegionCode?: string;

  @ApiPropertyOptional({ description: 'Override values for template' })
  @IsOptional()
  @IsObject()
  overrideValues?: any;

  @ApiPropertyOptional({ description: 'Whether to validate before applying' })
  @IsOptional()
  @IsBoolean()
  validateFirst?: boolean = true;

  @ApiProperty({
    enum: ConfigurationChangeReason,
    description: 'Reason for applying template',
  })
  @IsEnum(ConfigurationChangeReason)
  changeReason: ConfigurationChangeReason;
}

// ======================= MIGRATION MANAGEMENT =======================

export class ConfigurationMigrationDto {
  @ApiProperty({ description: 'Migration name' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Migration description' })
  @IsString()
  @Length(0, 500)
  description: string;

  @ApiProperty({ description: 'Source environment' })
  @IsEnum(['development', 'staging', 'production'])
  sourceEnvironment: 'development' | 'staging' | 'production';

  @ApiProperty({ description: 'Target environment' })
  @IsEnum(['development', 'staging', 'production'])
  targetEnvironment: 'development' | 'staging' | 'production';

  @ApiProperty({ description: 'Configuration filters for migration' })
  @IsObject()
  filters: {
    types?: ConfigurationType[];
    tenantIds?: string[];
    regionCodes?: string[];
    createdAfter?: string;
    createdBefore?: string;
  };

  @ApiPropertyOptional({ description: 'Migration strategy' })
  @IsOptional()
  @IsEnum(['merge', 'replace', 'append'])
  strategy?: 'merge' | 'replace' | 'append' = 'merge';

  @ApiPropertyOptional({
    description: 'Whether to create backup before migration',
  })
  @IsOptional()
  @IsBoolean()
  createBackup?: boolean = true;
}

export class ExecuteMigrationDto {
  @ApiProperty({ description: 'Migration plan ID' })
  @IsUUID(4)
  migrationId: string;

  @ApiPropertyOptional({ description: 'Dry run mode (simulate only)' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;

  @ApiPropertyOptional({ description: 'Force migration even with conflicts' })
  @IsOptional()
  @IsBoolean()
  force?: boolean = false;

  @ApiProperty({
    enum: ConfigurationChangeReason,
    description: 'Reason for migration',
  })
  @IsEnum(ConfigurationChangeReason)
  changeReason: ConfigurationChangeReason;
}

// ======================= BACKUP & RESTORE =======================

export class CreateBackupDto {
  @ApiProperty({ description: 'Backup name' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ description: 'Backup description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({ description: 'Backup scope filters' })
  @IsOptional()
  @IsObject()
  filters?: {
    types?: ConfigurationType[];
    tenantIds?: string[];
    regionCodes?: string[];
    includeHistory?: boolean;
  };

  @ApiPropertyOptional({ description: 'Compression level (1-9)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(9)
  compressionLevel?: number = 6;
}

export class RestoreBackupDto {
  @ApiProperty({ description: 'Backup ID to restore' })
  @IsUUID(4)
  backupId: string;

  @ApiPropertyOptional({ description: 'Target tenant ID for restore' })
  @IsOptional()
  @IsUUID(4)
  targetTenantId?: string;

  @ApiPropertyOptional({ description: 'Restore strategy' })
  @IsOptional()
  @IsEnum(['full', 'selective', 'merge'])
  strategy?: 'full' | 'selective' | 'merge' = 'merge';

  @ApiPropertyOptional({ description: 'Configuration types to restore' })
  @IsOptional()
  @IsArray()
  @IsEnum(ConfigurationType, { each: true })
  typesToRestore?: ConfigurationType[];

  @ApiProperty({
    enum: ConfigurationChangeReason,
    description: 'Reason for restore',
  })
  @IsEnum(ConfigurationChangeReason)
  changeReason: ConfigurationChangeReason;
}

// ======================= ADMINISTRATIVE DASHBOARD =======================

export class AdminDashboardQueryDto {
  @ApiPropertyOptional({ description: 'Date range start' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date range end' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Specific tenant ID' })
  @IsOptional()
  @IsUUID(4)
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Specific region code' })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional({ description: 'Configuration types to include' })
  @IsOptional()
  @IsArray()
  @IsEnum(ConfigurationType, { each: true })
  types?: ConfigurationType[];

  @ApiPropertyOptional({ description: 'Include performance metrics' })
  @IsOptional()
  @IsBoolean()
  includePerformance?: boolean = true;

  @ApiPropertyOptional({ description: 'Include usage statistics' })
  @IsOptional()
  @IsBoolean()
  includeUsage?: boolean = true;
}

export class AdminDashboardResponseDto {
  @ApiProperty({ description: 'Configuration statistics' })
  statistics: {
    totalConfigurations: number;
    activeConfigurations: number;
    pendingConfigurations: number;
    recentChanges: number;
    configurationsByType: Record<ConfigurationType, number>;
    configurationsByRegion: Record<string, number>;
    configurationsByTenant: Record<string, number>;
  };

  @ApiProperty({ description: 'Performance metrics' })
  performanceMetrics: {
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    fallbackUsage: number;
    topAccessedConfigurations: Array<{
      key: string;
      type: ConfigurationType;
      accessCount: number;
    }>;
  };

  @ApiProperty({ description: 'System health indicators' })
  healthIndicators: {
    databaseStatus: 'healthy' | 'degraded' | 'unhealthy';
    cacheStatus: 'healthy' | 'degraded' | 'unhealthy';
    validationStatus: 'healthy' | 'degraded' | 'unhealthy';
    fallbackStatus: 'healthy' | 'degraded' | 'unhealthy';
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  };

  @ApiProperty({ description: 'Recent activities' })
  recentActivities: Array<{
    id: string;
    type: string;
    description: string;
    user: string;
    timestamp: Date;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }>;

  @ApiProperty({ description: 'Alerts and warnings' })
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    category: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
}

// ======================= AUDIT & COMPLIANCE =======================

export class ComplianceAuditQueryDto {
  @ApiPropertyOptional({ description: 'Audit start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Audit end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Compliance framework' })
  @IsOptional()
  @IsEnum(['SOC2', 'UU_PDP', 'OJK', 'ALL'])
  framework?: 'SOC2' | 'UU_PDP' | 'OJK' | 'ALL' = 'ALL';

  @ApiPropertyOptional({ description: 'Audit scope' })
  @IsOptional()
  @IsEnum(['tenant', 'regional', 'global'])
  scope?: 'tenant' | 'regional' | 'global' = 'global';

  @ApiPropertyOptional({ description: 'Include detailed findings' })
  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean = true;
}

export class PerformanceAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Analysis period in days' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  periodDays?: number = 30;

  @ApiPropertyOptional({ description: 'Specific configuration types' })
  @IsOptional()
  @IsArray()
  @IsEnum(ConfigurationType, { each: true })
  types?: ConfigurationType[];

  @ApiPropertyOptional({ description: 'Group by dimension' })
  @IsOptional()
  @IsEnum(['type', 'tenant', 'region', 'hour', 'day'])
  groupBy?: 'type' | 'tenant' | 'region' | 'hour' | 'day' = 'day';

  @ApiPropertyOptional({ description: 'Include performance trends' })
  @IsOptional()
  @IsBoolean()
  includeTrends?: boolean = true;
}

// ======================= TENANT MANAGEMENT =======================

export class TenantConfigurationQueryDto {
  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID(4)
  tenantId: string;

  @ApiPropertyOptional({ description: 'Include inherited configurations' })
  @IsOptional()
  @IsBoolean()
  includeInherited?: boolean = true;

  @ApiPropertyOptional({ description: 'Include fallback configurations' })
  @IsOptional()
  @IsBoolean()
  includeFallbacks?: boolean = false;

  @ApiPropertyOptional({ description: 'Configuration status filter' })
  @IsOptional()
  @IsEnum(ConfigurationStatus)
  status?: ConfigurationStatus;
}

export class BulkTenantOperationDto {
  @ApiProperty({ description: 'Target tenant IDs' })
  @IsArray()
  @IsUUID(4, { each: true })
  tenantIds: string[];

  @ApiProperty({ description: 'Operation type' })
  @IsEnum(['apply_template', 'update_config', 'migrate', 'backup'])
  operation: 'apply_template' | 'update_config' | 'migrate' | 'backup';

  @ApiProperty({ description: 'Operation parameters' })
  @IsObject()
  parameters: any;

  @ApiProperty({
    enum: ConfigurationChangeReason,
    description: 'Reason for bulk operation',
  })
  @IsEnum(ConfigurationChangeReason)
  changeReason: ConfigurationChangeReason;

  @ApiPropertyOptional({ description: 'Execute in parallel' })
  @IsOptional()
  @IsBoolean()
  parallel?: boolean = true;

  @ApiPropertyOptional({ description: 'Stop on first error' })
  @IsOptional()
  @IsBoolean()
  stopOnError?: boolean = true;
}

// ======================= SYSTEM OPERATIONS =======================

export class SystemMaintenanceDto {
  @ApiProperty({ description: 'Maintenance type' })
  @IsEnum([
    'cache_clear',
    'index_rebuild',
    'orphan_cleanup',
    'performance_optimization',
  ])
  type:
    | 'cache_clear'
    | 'index_rebuild'
    | 'orphan_cleanup'
    | 'performance_optimization';

  @ApiPropertyOptional({ description: 'Maintenance scope' })
  @IsOptional()
  @IsEnum(['global', 'tenant', 'regional'])
  scope?: 'global' | 'tenant' | 'regional' = 'global';

  @ApiPropertyOptional({
    description: 'Target tenant ID for scoped maintenance',
  })
  @IsOptional()
  @IsUUID(4)
  targetTenantId?: string;

  @ApiPropertyOptional({ description: 'Target region for scoped maintenance' })
  @IsOptional()
  @IsString()
  targetRegion?: string;

  @ApiPropertyOptional({
    description: 'Force maintenance even during business hours',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean = false;

  @ApiPropertyOptional({ description: 'Maintenance description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
