/**
 * Indonesian Configuration Mapping Service
 * Provides runtime configuration updates and management for Indonesian business context
 * Integrates with existing caching, event system, and configuration infrastructure
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  ConfigurationMapping,
  ConfigurationType,
  ConfigurationScope,
  ConfigurationStatus,
} from '../entities/configuration-mapping.entity';
import {
  ConfigurationHistory,
  ConfigurationChangeType,
  ConfigurationChangeReason,
} from '../entities/configuration-history.entity';
import {
  CreateConfigurationMappingDto,
  UpdateConfigurationMappingDto,
  ConfigurationQueryDto,
  ConfigurationMappingResponseDto,
  ConfigurationBulkUpdateDto,
} from '../dto/configuration-mapping.dto';

// Import existing Indonesian configurations for integration
import { INDONESIAN_BUSINESS_RULES_CONFIG } from '../indonesian-business-rules.config';
import { INDONESIAN_PAYMENT_CONFIG } from '../indonesian-payments.config';
import { INDONESIAN_GEOGRAPHY_CONFIG } from '../indonesian-geography.config';
import { INDONESIAN_TELECOM_CONFIG } from '../indonesian-telecom.config';
import { INDONESIAN_BUSINESS_CALENDAR_CONFIG } from '../indonesian-business-calendar.config';

// Import enhanced validation and fallback services
import {
  IndonesianConfigurationValidatorService,
  EnhancedValidationResult,
  ValidationContext,
} from './indonesian-configuration-validator.service';
import {
  IndonesianConfigurationFallbackService,
  FallbackContext,
  FallbackResult,
} from './indonesian-configuration-fallback.service';
import {
  IndonesianConfigurationCacheService,
  CachePriority,
} from './indonesian-configuration-cache.service';

export interface ConfigurationCacheEntry {
  value: any;
  version: number;
  cachedAt: Date;
  expiresAt: Date;
  usageCount: number;
}

export interface ConfigurationUpdateEvent {
  tenantId?: string;
  configurationType: ConfigurationType;
  key: string;
  oldValue: any;
  newValue: any;
  version: number;
  changeReason: ConfigurationChangeReason;
  updatedBy?: string;
  timestamp: Date;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  impactAssessment: {
    affectedServices: string[];
    cacheInvalidations: number;
    estimatedDowntime: number; // milliseconds
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
  };
}

@Injectable()
export class IndonesianConfigurationMappingService {
  private readonly logger = new Logger(
    IndonesianConfigurationMappingService.name,
  );

  // In-memory configuration cache for high-performance access
  private configurationCache: Map<string, ConfigurationCacheEntry> = new Map();

  // Configuration type mappings to static configurations
  private readonly staticConfigMappings = {
    [ConfigurationType.BUSINESS_RULES]: INDONESIAN_BUSINESS_RULES_CONFIG,
    [ConfigurationType.PAYMENT_METHODS]: INDONESIAN_PAYMENT_CONFIG,
    [ConfigurationType.GEOGRAPHY]: INDONESIAN_GEOGRAPHY_CONFIG,
    [ConfigurationType.TELECOM_PROVIDERS]: INDONESIAN_TELECOM_CONFIG,
    [ConfigurationType.BUSINESS_CALENDAR]: INDONESIAN_BUSINESS_CALENDAR_CONFIG,
  };

  constructor(
    @InjectRepository(ConfigurationMapping)
    private readonly configurationRepository: Repository<ConfigurationMapping>,
    @InjectRepository(ConfigurationHistory)
    private readonly historyRepository: Repository<ConfigurationHistory>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly validatorService: IndonesianConfigurationValidatorService,
    private readonly fallbackService: IndonesianConfigurationFallbackService,
    private readonly enhancedCacheService: IndonesianConfigurationCacheService,
  ) {
    this.initializeService();
  }

  /**
   * Initialize the configuration mapping service
   */
  private async initializeService(): Promise<void> {
    try {
      this.logger.log(
        'Initializing Indonesian Configuration Mapping Service...',
      );

      // Load all active configurations into cache
      await this.loadActiveConfigurations();

      // Set up event listeners
      this.setupEventListeners();

      this.logger.log(
        'Indonesian Configuration Mapping Service initialized successfully',
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize service: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Load all active configurations into memory cache
   */
  private async loadActiveConfigurations(): Promise<void> {
    try {
      const activeConfigs = await this.configurationRepository.find({
        where: {
          isActive: true,
          status: ConfigurationStatus.ACTIVE,
        },
        order: { updatedAt: 'DESC' },
      });

      for (const config of activeConfigs) {
        const cacheKey = this.buildCacheKey(
          config.tenantId,
          config.type,
          config.key,
        );
        const expiresAt = new Date(Date.now() + config.cacheTtl * 1000);

        this.configurationCache.set(cacheKey, {
          value: config.value,
          version: config.version,
          cachedAt: new Date(),
          expiresAt,
          usageCount: 0,
        });
      }

      this.logger.log(
        `Loaded ${activeConfigs.length} configurations into cache`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load configurations: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Set up event listeners for configuration changes
   */
  private setupEventListeners(): void {
    // Listen for configuration reload requests
    this.eventEmitter.on(
      'configuration.reload.request',
      async (data: { tenantId?: string; type?: ConfigurationType }) => {
        await this.reloadConfigurations(data.tenantId, data.type);
      },
    );

    // Listen for cache invalidation requests
    this.eventEmitter.on(
      'configuration.cache.invalidate',
      (data: {
        cacheKey?: string;
        tenantId?: string;
        type?: ConfigurationType;
      }) => {
        this.invalidateCache(data.cacheKey, data.tenantId, data.type);
      },
    );
  }

  /**
   * Create a new configuration mapping
   */
  async createConfiguration(
    dto: CreateConfigurationMappingDto,
    createdBy?: string,
  ): Promise<ConfigurationMappingResponseDto> {
    try {
      // Validate configuration doesn't already exist
      const existing = await this.configurationRepository.findOne({
        where: {
          type: dto.type,
          key: dto.key,
          scope: dto.scope,
          tenantId: dto.tenantId || null,
          isActive: true,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Configuration '${dto.key}' already exists for type '${dto.type}' and scope '${dto.scope}'`,
        );
      }

      // Validate configuration value with enhanced validation
      const validation = await this.validateConfiguration(
        dto.type,
        dto.key,
        dto.value,
        dto.tenantId,
        dto.regionCode,
        dto.culturalContext,
      );
      if (!validation.isValid) {
        const errorMessages = validation.errors.map(e => e.message).join(', ');
        throw new BadRequestException(
          `Configuration validation failed: ${errorMessages}`,
        );
      }

      // Create configuration mapping
      const configuration = this.configurationRepository.create({
        ...dto,
        version: 1,
        createdBy,
        isActive: true,
        status: dto.metadata?.approvalRequired
          ? ConfigurationStatus.PENDING
          : ConfigurationStatus.ACTIVE,
        usageCount: 0,
        cacheKey: this.buildCacheKey(dto.tenantId, dto.type, dto.key),
      });

      const savedConfig = await this.configurationRepository.save(
        configuration,
      );

      // Create history record
      await this.createHistoryRecord(
        savedConfig,
        ConfigurationChangeType.CREATE,
        {
          changeReason: ConfigurationChangeReason.ADMIN_UPDATE,
          newValue: dto.value,
          createdBy,
        },
      );

      // Update cache
      await this.updateConfigurationCache(savedConfig);

      // Emit configuration created event
      this.eventEmitter.emit('configuration.created', {
        tenantId: dto.tenantId,
        configurationType: dto.type,
        key: dto.key,
        newValue: dto.value,
        version: savedConfig.version,
        changeReason: ConfigurationChangeReason.ADMIN_UPDATE,
        updatedBy: createdBy,
        timestamp: new Date(),
      } as ConfigurationUpdateEvent);

      this.logger.log(`Created configuration: ${dto.type}.${dto.key}`);

      return this.mapToResponseDto(savedConfig);
    } catch (error) {
      this.logger.error(
        `Failed to create configuration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update an existing configuration
   */
  async updateConfiguration(
    id: string,
    dto: UpdateConfigurationMappingDto,
    updatedBy?: string,
  ): Promise<ConfigurationMappingResponseDto> {
    try {
      const configuration = await this.configurationRepository.findOne({
        where: { id, isActive: true },
      });

      if (!configuration) {
        throw new NotFoundException(`Configuration with ID '${id}' not found`);
      }

      // Validate new value if provided with enhanced validation
      if (dto.value !== undefined) {
        const validation = await this.validateConfiguration(
          configuration.type,
          configuration.key,
          dto.value,
          configuration.tenantId,
          configuration.regionCode,
          configuration.culturalContext,
        );
        if (!validation.isValid) {
          const errorMessages = validation.errors
            .map(e => e.message)
            .join(', ');
          throw new BadRequestException(
            `Configuration validation failed: ${errorMessages}`,
          );
        }
      }

      // Store previous value for history
      const previousValue = configuration.value;
      const previousVersion = configuration.version;

      // Update configuration
      const updatedConfig = await this.configurationRepository.save({
        ...configuration,
        ...dto,
        version: configuration.version + 1,
        updatedBy,
        previousValue,
        updatedAt: new Date(),
      });

      // Create history record
      await this.createHistoryRecord(
        updatedConfig,
        ConfigurationChangeType.UPDATE,
        {
          changeReason: dto.changeReason,
          oldValue: previousValue,
          newValue: dto.value || configuration.value,
          description: dto.changeDescription,
          createdBy: updatedBy,
          versionFrom: previousVersion,
          versionTo: updatedConfig.version,
        },
      );

      // Update cache
      await this.updateConfigurationCache(updatedConfig);

      // Emit configuration updated event
      this.eventEmitter.emit('configuration.updated', {
        tenantId: configuration.tenantId,
        configurationType: configuration.type,
        key: configuration.key,
        oldValue: previousValue,
        newValue: dto.value || configuration.value,
        version: updatedConfig.version,
        changeReason: dto.changeReason,
        updatedBy,
        timestamp: new Date(),
      } as ConfigurationUpdateEvent);

      this.logger.log(
        `Updated configuration: ${configuration.type}.${configuration.key} (v${updatedConfig.version})`,
      );

      return this.mapToResponseDto(updatedConfig);
    } catch (error) {
      this.logger.error(
        `Failed to update configuration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get configuration value with enhanced multi-tier caching and fallback
   */
  async getConfiguration(
    tenantId: string | undefined,
    type: ConfigurationType,
    key: string,
    useCache: boolean = true,
    regionCode?: string,
    culturalContext?: any,
  ): Promise<any> {
    try {
      // Try enhanced cache service first
      if (useCache) {
        const cachedValue = await this.enhancedCacheService.get(
          key,
          tenantId,
          type,
        );
        if (cachedValue !== null) {
          await this.updateUsageStatistics(tenantId, type, key);
          return cachedValue;
        }
      }

      // Load from database
      const configuration = await this.configurationRepository.findOne({
        where: {
          type,
          key,
          tenantId: tenantId || null,
          isActive: true,
          status: ConfigurationStatus.ACTIVE,
        },
        order: { version: 'DESC' }, // Get latest version
      });

      if (configuration) {
        // Store in enhanced cache with intelligent priority
        const priority = this.determineCachePriority(configuration);
        await this.enhancedCacheService.set(key, configuration.value, {
          tenantId,
          type,
          priority,
          tags: ['database-loaded'],
          ttlSeconds: configuration.cacheTtl,
        });

        await this.updateUsageStatistics(tenantId, type, key);
        return configuration.value;
      }

      // Use enhanced fallback service for comprehensive fallback strategy
      const fallbackContext: FallbackContext = {
        tenantId,
        regionCode,
        culturalContext,
        failureReason: 'configuration_not_found',
      };

      const fallbackResult = await this.fallbackService.resolveConfiguration(
        type,
        key,
        fallbackContext,
      );

      if (fallbackResult && fallbackResult.value !== null) {
        // Log fallback usage for monitoring
        this.logger.log(
          `Using fallback for ${type}.${key}: ${fallbackResult.source} (${fallbackResult.confidence} confidence)`,
        );

        // Cache fallback value with lower priority
        await this.enhancedCacheService.set(key, fallbackResult.value, {
          tenantId,
          type,
          priority: CachePriority.LOW,
          tags: ['fallback', fallbackResult.source],
          ttlSeconds: 300, // Shorter TTL for fallback values
        });

        // Update usage statistics for monitoring
        await this.updateUsageStatistics(tenantId, type, key);

        return fallbackResult.value;
      }

      // Final fallback to static configuration (legacy support)
      const staticValue = this.getStaticConfigurationValue(type, key);
      if (staticValue !== null) {
        this.logger.debug(`Using static fallback for ${type}.${key}`);

        // Cache static value with lowest priority
        await this.enhancedCacheService.set(key, staticValue, {
          tenantId,
          type,
          priority: CachePriority.LOW,
          tags: ['static-fallback'],
          ttlSeconds: 600, // Medium TTL for static values
        });

        return staticValue;
      }

      // No configuration found anywhere
      this.logger.warn(
        `No configuration found for ${type}.${key} with any fallback strategy`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get configuration: ${error.message}`,
        error.stack,
      );

      // Emergency fallback with enhanced service
      try {
        const emergencyContext: FallbackContext = {
          tenantId,
          regionCode,
          culturalContext,
          emergencyMode: true,
          failureReason: error.message,
        };

        const emergencyResult = await this.fallbackService.resolveConfiguration(
          type,
          key,
          emergencyContext,
        );

        if (emergencyResult && emergencyResult.value !== null) {
          this.logger.warn(
            `Using emergency fallback for ${type}.${key}: ${emergencyResult.source}`,
          );
          return emergencyResult.value;
        }
      } catch (fallbackError) {
        this.logger.error(
          `Emergency fallback failed: ${fallbackError.message}`,
        );
      }

      // Last resort: static configuration
      return this.getStaticConfigurationValue(type, key);
    }
  }

  /**
   * Get multiple configurations by query
   */
  async getConfigurations(query: ConfigurationQueryDto): Promise<{
    configurations: ConfigurationMappingResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const whereConditions: any = {
        isActive: true,
        status: query.status || ConfigurationStatus.ACTIVE,
      };

      if (query.type) whereConditions.type = query.type;
      if (query.scope) whereConditions.scope = query.scope;
      if (query.tenantId) whereConditions.tenantId = query.tenantId;
      if (query.regionCode) whereConditions.regionCode = query.regionCode;
      if (query.keySearch) whereConditions.key = Like(`%${query.keySearch}%`);

      const [configurations, total] =
        await this.configurationRepository.findAndCount({
          where: whereConditions,
          order: { updatedAt: 'DESC' },
          skip: ((query.page || 1) - 1) * (query.limit || 20),
          take: query.limit || 20,
        });

      const mappedConfigurations = configurations.map(config =>
        this.mapToResponseDto(config),
      );

      return {
        configurations: mappedConfigurations,
        total,
        page: query.page || 1,
        limit: query.limit || 20,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get configurations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Bulk update configurations
   */
  async bulkUpdateConfigurations(
    dto: ConfigurationBulkUpdateDto,
    updatedBy?: string,
  ): Promise<{
    successfulUpdates: ConfigurationMappingResponseDto[];
    failedUpdates: { id: string; error: string }[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const successfulUpdates: ConfigurationMappingResponseDto[] = [];
      const failedUpdates: { id: string; error: string }[] = [];

      for (const update of dto.updates) {
        try {
          const result = await this.updateConfiguration(
            update.id,
            {
              ...update,
              changeReason: dto.changeReason,
              changeDescription: dto.changeDescription,
            },
            updatedBy,
          );
          successfulUpdates.push(result);
        } catch (error) {
          failedUpdates.push({
            id: update.id,
            error: error.message,
          });

          if (dto.rollbackOnFailure) {
            throw new BadRequestException(
              `Bulk update failed on configuration ${update.id}: ${error.message}`,
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Bulk update completed: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`,
      );

      return { successfulUpdates, failedUpdates };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Bulk update failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rollback configuration to previous version
   */
  async rollbackConfiguration(
    id: string,
    targetVersion: number,
    rolledBackBy?: string,
  ): Promise<ConfigurationMappingResponseDto> {
    try {
      const configuration = await this.configurationRepository.findOne({
        where: { id, isActive: true },
      });

      if (!configuration) {
        throw new NotFoundException(`Configuration with ID '${id}' not found`);
      }

      // Find target version in history
      const targetHistory = await this.historyRepository.findOne({
        where: {
          configurationId: id,
          versionTo: targetVersion,
        },
      });

      if (!targetHistory) {
        throw new NotFoundException(
          `Version ${targetVersion} not found for configuration`,
        );
      }

      // Update configuration with target version value
      const rolledBackConfig = await this.configurationRepository.save({
        ...configuration,
        value: targetHistory.newValue,
        version: configuration.version + 1,
        previousValue: configuration.value,
        updatedBy: rolledBackBy,
        updatedAt: new Date(),
      });

      // Create history record for rollback
      await this.createHistoryRecord(
        rolledBackConfig,
        ConfigurationChangeType.ROLLBACK,
        {
          changeReason: ConfigurationChangeReason.ADMIN_UPDATE,
          oldValue: configuration.value,
          newValue: targetHistory.newValue,
          description: `Rolled back to version ${targetVersion}`,
          createdBy: rolledBackBy,
          versionFrom: configuration.version,
          versionTo: rolledBackConfig.version,
        },
      );

      // Update cache
      await this.updateConfigurationCache(rolledBackConfig);

      // Emit rollback event
      this.eventEmitter.emit('configuration.rollback', {
        tenantId: configuration.tenantId,
        configurationType: configuration.type,
        key: configuration.key,
        oldValue: configuration.value,
        newValue: targetHistory.newValue,
        version: rolledBackConfig.version,
        changeReason: ConfigurationChangeReason.ADMIN_UPDATE,
        updatedBy: rolledBackBy,
        timestamp: new Date(),
      } as ConfigurationUpdateEvent);

      this.logger.log(
        `Rolled back configuration ${configuration.type}.${configuration.key} to version ${targetVersion}`,
      );

      return this.mapToResponseDto(rolledBackConfig);
    } catch (error) {
      this.logger.error(
        `Failed to rollback configuration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate configuration value using enhanced validation service
   */
  private async validateConfiguration(
    type: ConfigurationType,
    key: string,
    value: any,
    tenantId?: string,
    regionCode?: string,
    culturalContext?: any,
  ): Promise<EnhancedValidationResult> {
    try {
      const validationContext: ValidationContext = {
        tenantId,
        regionCode,
        culturalContext,
        configurationScope: tenantId
          ? ConfigurationScope.TENANT_SPECIFIC
          : regionCode
          ? ConfigurationScope.REGIONAL
          : ConfigurationScope.GLOBAL,
      };

      const result = await this.validatorService.validateConfiguration(
        type,
        key,
        value,
        validationContext,
      );

      this.logger.debug(
        `Enhanced validation completed for ${type}.${key}: ${
          result.isValid ? 'VALID' : 'INVALID'
        }`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Enhanced validation failed for ${type}.${key}: ${error.message}`,
        error.stack,
      );

      // Fallback to basic validation result
      return {
        isValid: false,
        errors: [
          {
            field: key,
            message: `Validation error: ${error.message}`,
            code: 'validation_failed',
          },
        ],
        warnings: [],
        infos: [],
        businessImpactAssessment: {
          level: 'medium',
          affectedSystems: [],
          affectedRegions: [],
          estimatedUsers: 0,
          downtime: 0,
          revenueImpact: { estimated: 0, confidence: 'low' },
          complianceRisk: { level: 'none', regulations: [] },
          culturalSensitivity: { level: 'none', concerns: [] },
        },
        fallbackRecommendations: [],
        dependencyValidation: {
          isValid: true,
          circularDependencies: [],
          missingDependencies: [],
          conflictingDependencies: [],
        },
      };
    }
  }

  // Legacy validation methods removed - now using IndonesianConfigurationValidatorService

  /**
   * Helper methods
   */
  private buildCacheKey(
    tenantId: string | undefined,
    type: ConfigurationType,
    key: string,
  ): string {
    return `config:${tenantId || 'global'}:${type}:${key}`;
  }

  private async updateConfigurationCache(
    configuration: ConfigurationMapping,
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(
      configuration.tenantId,
      configuration.type,
      configuration.key,
    );
    const expiresAt = new Date(Date.now() + configuration.cacheTtl * 1000);

    this.configurationCache.set(cacheKey, {
      value: configuration.value,
      version: configuration.version,
      cachedAt: new Date(),
      expiresAt,
      usageCount: 0,
    });
  }

  private async createHistoryRecord(
    configuration: ConfigurationMapping,
    changeType: ConfigurationChangeType,
    additionalData: any,
  ): Promise<void> {
    const history = this.historyRepository.create({
      configurationId: configuration.id,
      tenantId: configuration.tenantId,
      configurationType: configuration.type,
      key: configuration.key,
      changeType,
      ...additionalData,
    });

    await this.historyRepository.save(history);
  }

  private getStaticConfigurationValue(
    type: ConfigurationType,
    key: string,
  ): any {
    const staticConfig = this.staticConfigMappings[type];
    if (!staticConfig) return null;

    // Navigate through the key path (e.g., 'businessRules.defaultMethod')
    const keyParts = key.split('.');
    let value = staticConfig;

    for (const part of keyParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  private mapToResponseDto(
    configuration: ConfigurationMapping,
  ): ConfigurationMappingResponseDto {
    return {
      id: configuration.id,
      tenantId: configuration.tenantId,
      type: configuration.type,
      key: configuration.key,
      scope: configuration.scope,
      status: configuration.status,
      value: configuration.value,
      defaultValue: configuration.defaultValue,
      metadata: configuration.metadata,
      version: configuration.version,
      isActive: configuration.isActive,
      cacheTtl: configuration.cacheTtl,
      regionCode: configuration.regionCode,
      culturalContext: configuration.culturalContext,
      dependsOn: configuration.dependsOn,
      affects: configuration.affects,
      usageCount: configuration.usageCount,
      lastAccessedAt: configuration.lastAccessedAt,
      createdAt: configuration.createdAt,
      updatedAt: configuration.updatedAt,
    };
  }

  private async updateUsageStatistics(
    tenantId: string | undefined,
    type: ConfigurationType,
    key: string,
  ): Promise<void> {
    try {
      await this.configurationRepository.update(
        {
          type,
          key,
          tenantId: tenantId || null,
          isActive: true,
        },
        {
          usageCount: () => 'usage_count + 1',
          lastAccessedAt: new Date(),
        },
      );
    } catch (error) {
      // Don't throw for usage statistics updates
      this.logger.warn(`Failed to update usage statistics: ${error.message}`);
    }
  }

  /**
   * Determine cache priority based on configuration characteristics
   */
  private determineCachePriority(
    configuration: ConfigurationMapping,
  ): CachePriority {
    // Indonesian business critical configurations get high priority
    const criticalTypes = [
      ConfigurationType.BUSINESS_RULES,
      ConfigurationType.PAYMENT_METHODS,
    ];

    if (criticalTypes.includes(configuration.type)) {
      return CachePriority.CRITICAL;
    }

    // High usage configurations get higher priority
    if (configuration.usageCount && configuration.usageCount > 100) {
      return CachePriority.HIGH;
    }

    if (configuration.usageCount && configuration.usageCount > 10) {
      return CachePriority.MEDIUM;
    }

    // Regional and geography configs for priority regions
    if (
      configuration.type === ConfigurationType.GEOGRAPHY &&
      configuration.regionCode &&
      ['DKI', 'JABAR', 'JATENG', 'JATIM'].includes(configuration.regionCode)
    ) {
      return CachePriority.MEDIUM;
    }

    return CachePriority.LOW;
  }

  // Legacy impact assessment methods removed - now using IndonesianConfigurationValidatorService

  private async reloadConfigurations(
    tenantId?: string,
    type?: ConfigurationType,
  ): Promise<void> {
    try {
      this.logger.log(
        `Reloading configurations for tenant: ${tenantId}, type: ${type}`,
      );

      // Use enhanced cache service for invalidation and reload
      await this.enhancedCacheService.refresh(tenantId, type);

      // Clear legacy cache entries as well
      this.invalidateCache(undefined, tenantId, type);

      // Reload active configurations into legacy cache (for backward compatibility)
      await this.loadActiveConfigurations();

      this.logger.log('Configuration reload completed');
    } catch (error) {
      this.logger.error(
        `Failed to reload configurations: ${error.message}`,
        error.stack,
      );
    }
  }

  private invalidateCache(
    cacheKey?: string,
    tenantId?: string,
    type?: ConfigurationType,
  ): void {
    if (cacheKey) {
      this.configurationCache.delete(cacheKey);
      return;
    }

    // Invalidate by criteria (legacy cache)
    for (const [key, _] of this.configurationCache.entries()) {
      const shouldInvalidate =
        (!tenantId || key.includes(tenantId)) && (!type || key.includes(type));

      if (shouldInvalidate) {
        this.configurationCache.delete(key);
      }
    }
  }

  /**
   * Scheduled task to clean up expired cache entries
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private cleanupExpiredCache(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.configurationCache.entries()) {
      if (entry.expiresAt <= now) {
        this.configurationCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Scheduled task to update usage statistics
   */
  @Cron(CronExpression.EVERY_HOUR)
  private async syncCacheStatistics(): Promise<void> {
    try {
      for (const [cacheKey, entry] of this.configurationCache.entries()) {
        if (entry.usageCount > 0) {
          // Parse cache key to extract configuration details
          const keyParts = cacheKey.split(':');
          if (keyParts.length >= 4) {
            const tenantId = keyParts[1] === 'global' ? undefined : keyParts[1];
            const type = keyParts[2] as ConfigurationType;
            const key = keyParts.slice(3).join(':');

            await this.configurationRepository.update(
              {
                type,
                key,
                tenantId: tenantId || null,
                isActive: true,
              },
              {
                usageCount: () => `usage_count + ${entry.usageCount}`,
                lastAccessedAt: new Date(),
              },
            );

            // Reset cache usage count
            entry.usageCount = 0;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync cache statistics: ${error.message}`,
        error.stack,
      );
    }
  }
}
