import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import {
  ChannelMapping,
  MappingType,
  MappingDirection,
} from '../entities/channel-mapping.entity';
import { Channel } from '../entities/channel.entity';

// Common services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';
import {
  IntegrationLogType,
  IntegrationLogLevel,
} from '../../integrations/entities/integration-log.entity';

export interface CreateChannelMappingDto {
  channelId: string;
  mappingType: MappingType;
  direction?: MappingDirection;
  internalId: string;
  internalValue?: string;
  internalData?: Record<string, any>;
  externalId: string;
  externalValue?: string;
  externalData?: Record<string, any>;
  mappingRules?: any;
  isActive?: boolean;
  priority?: number;
  notes?: string;
  tags?: string[];
}

export interface UpdateChannelMappingDto {
  direction?: MappingDirection;
  internalValue?: string;
  internalData?: Record<string, any>;
  externalValue?: string;
  externalData?: Record<string, any>;
  mappingRules?: any;
  isActive?: boolean;
  priority?: number;
  notes?: string;
  tags?: string[];
}

export interface MappingTransformRequest {
  mappingId: string;
  sourceData: Record<string, any>;
  direction: 'internal_to_external' | 'external_to_internal';
  transformationType?: 'product' | 'category' | 'order' | 'custom';
}

export interface MappingTransformResult {
  success: boolean;
  mappingId: string;
  sourceData: Record<string, any>;
  transformedData: Record<string, any>;
  appliedRules: string[];
  validationErrors?: string[];
  warnings?: string[];
}

export interface MappingConflictResolution {
  mappingId: string;
  conflictType: 'data_mismatch' | 'structure_change' | 'value_conflict';
  resolution: 'internal_wins' | 'external_wins' | 'merge' | 'manual';
  mergeStrategy?: Record<string, any>;
  resolvedBy?: string;
  notes?: string;
}

export interface MappingValidationResult {
  isValid: boolean;
  mappingId: string;
  validationChecks: Array<{
    checkType: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  overallScore: number; // 0-100
  recommendations?: string[];
}

export interface ChannelMappingQuery {
  channelId?: string;
  mappingType?: MappingType;
  direction?: MappingDirection;
  isActive?: boolean;
  hasConflicts?: boolean;
  needsSync?: boolean;
  isStale?: boolean;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface BulkMappingOperation {
  operation: 'create' | 'update' | 'delete' | 'validate';
  mappings: Array<
    CreateChannelMappingDto | { id: string; updates: UpdateChannelMappingDto }
  >;
}

export interface BulkMappingResult {
  success: boolean;
  operation: string;
  totalItems: number;
  successCount: number;
  errorCount: number;
  results: Array<{
    success: boolean;
    item: any;
    result?: ChannelMapping;
    error?: string;
  }>;
}

@Injectable()
export class ChannelMappingService {
  private readonly logger = new Logger(ChannelMappingService.name);

  constructor(
    @InjectRepository(ChannelMapping)
    private readonly mappingRepository: Repository<ChannelMapping>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,

    // Common services
    private readonly logService: IntegrationLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new channel mapping
   */
  async createChannelMapping(
    tenantId: string,
    createDto: CreateChannelMappingDto,
  ): Promise<ChannelMapping> {
    try {
      this.logger.debug(`Creating channel mapping for tenant ${tenantId}`, {
        createDto,
      });

      // Validate channel exists
      const channel = await this.channelRepository.findOne({
        where: { tenantId, id: createDto.channelId },
      });
      if (!channel) {
        throw new NotFoundException(`Channel ${createDto.channelId} not found`);
      }

      // Check for existing mapping
      const existingMapping = await this.mappingRepository.findOne({
        where: {
          tenantId,
          channelId: createDto.channelId,
          mappingType: createDto.mappingType,
          internalId: createDto.internalId,
        },
      });
      if (existingMapping) {
        throw new BadRequestException(
          'Mapping already exists for this internal ID',
        );
      }

      // Create mapping
      const mapping = this.mappingRepository.create({
        ...createDto,
        tenantId,
        direction: createDto.direction || MappingDirection.BIDIRECTIONAL,
        isActive: createDto.isActive !== undefined ? createDto.isActive : true,
        isVerified: false,
        priority: createDto.priority || 0,
        syncStatus: 'pending',
        syncCount: 0,
        errorCount: 0,
        changeLog: [
          {
            timestamp: new Date().toISOString(),
            type: 'created',
            source: 'internal',
            changes: { created: true },
          },
        ],
      });

      const savedMapping = await this.mappingRepository.save(mapping);

      // Verify the mapping
      const isValid = savedMapping.verify();
      if (isValid) {
        await this.mappingRepository.save(savedMapping);
      }

      // Log creation
      await this.logService.log({
        tenantId,
        channelId: createDto.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel mapping created: ${createDto.mappingType} (${createDto.internalId} → ${createDto.externalId})`,
        metadata: {
          mappingId: savedMapping.id,
          mappingType: createDto.mappingType,
          internalId: createDto.internalId,
          externalId: createDto.externalId,
          isValid,
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.mapping.created', {
        tenantId,
        channelId: createDto.channelId,
        mapping: savedMapping,
      });

      return savedMapping;
    } catch (error) {
      this.logger.error(
        `Failed to create channel mapping: ${error.message}`,
        error.stack,
      );
      await this.logService.logError(tenantId, createDto.channelId, error, {
        metadata: { action: 'create_channel_mapping', createDto },
      });
      throw error;
    }
  }

  /**
   * Get channel mappings
   */
  async getChannelMappings(
    tenantId: string,
    query: ChannelMappingQuery = {},
  ): Promise<{
    mappings: ChannelMapping[];
    total: number;
  }> {
    try {
      const where: FindOptionsWhere<ChannelMapping> = { tenantId };

      if (query.channelId) {
        where.channelId = query.channelId;
      }

      if (query.mappingType) {
        where.mappingType = query.mappingType;
      }

      if (query.direction) {
        where.direction = query.direction;
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }

      const queryBuilder = this.mappingRepository
        .createQueryBuilder('mapping')
        .where(where);

      // Special filters
      if (query.hasConflicts) {
        queryBuilder.andWhere("mapping.syncStatus = 'conflict'");
      }

      if (query.needsSync) {
        queryBuilder.andWhere(`
          mapping.isActive = true AND (
            mapping.lastSyncAt IS NULL OR
            mapping.internalLastModified > mapping.lastSyncAt OR
            mapping.externalLastModified > mapping.lastSyncAt
          )
        `);
      }

      if (query.isStale) {
        queryBuilder.andWhere(`
          mapping.lastSyncAt IS NULL OR
          mapping.lastSyncAt < NOW() - INTERVAL '24 hours'
        `);
      }

      // Search filter
      if (query.search) {
        queryBuilder.andWhere(
          `
          (mapping.internalId ILIKE :search OR 
           mapping.internalValue ILIKE :search OR
           mapping.externalId ILIKE :search OR
           mapping.externalValue ILIKE :search OR
           mapping.notes ILIKE :search)
        `,
          { search: `%${query.search}%` },
        );
      }

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        queryBuilder.andWhere('mapping.tags && :tags', { tags: query.tags });
      }

      // Include relations
      queryBuilder.leftJoinAndSelect('mapping.channel', 'channel');

      // Pagination
      if (query.limit) {
        queryBuilder.take(query.limit);
      }
      if (query.offset) {
        queryBuilder.skip(query.offset);
      }

      // Ordering
      queryBuilder
        .orderBy('mapping.priority', 'DESC')
        .addOrderBy('mapping.createdAt', 'DESC');

      const [mappings, total] = await queryBuilder.getManyAndCount();

      return { mappings, total };
    } catch (error) {
      this.logger.error(
        `Failed to get channel mappings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a specific channel mapping by ID
   */
  async getChannelMappingById(
    tenantId: string,
    mappingId: string,
  ): Promise<ChannelMapping> {
    try {
      const mapping = await this.mappingRepository.findOne({
        where: { tenantId, id: mappingId },
        relations: ['channel'],
      });

      if (!mapping) {
        throw new NotFoundException(`Channel mapping ${mappingId} not found`);
      }

      return mapping;
    } catch (error) {
      this.logger.error(
        `Failed to get channel mapping: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a channel mapping
   */
  async updateChannelMapping(
    tenantId: string,
    mappingId: string,
    updateDto: UpdateChannelMappingDto,
    userId?: string,
  ): Promise<ChannelMapping> {
    try {
      const mapping = await this.getChannelMappingById(tenantId, mappingId);

      // Update internal data if provided
      if (updateDto.internalData) {
        mapping.updateInternalData(updateDto.internalData, userId);
      }

      // Update external data if provided
      if (updateDto.externalData) {
        mapping.updateExternalData(updateDto.externalData);
      }

      // Update other properties
      const { internalData, externalData, ...otherUpdates } = updateDto;
      Object.assign(mapping, otherUpdates);

      const updatedMapping = await this.mappingRepository.save(mapping);

      // Log update
      await this.logService.log({
        tenantId,
        channelId: mapping.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel mapping updated: ${mapping.mappingType} (${mapping.internalId})`,
        metadata: { mappingId, updates: updateDto },
      });

      // Emit event
      this.eventEmitter.emit('channel.mapping.updated', {
        tenantId,
        channelId: mapping.channelId,
        mapping: updatedMapping,
        changes: updateDto,
        userId,
      });

      return updatedMapping;
    } catch (error) {
      this.logger.error(
        `Failed to update channel mapping: ${error.message}`,
        error.stack,
      );
      await this.logService.logError(tenantId, null, error, {
        metadata: { action: 'update_channel_mapping', mappingId, updateDto },
      });
      throw error;
    }
  }

  /**
   * Delete a channel mapping
   */
  async deleteChannelMapping(
    tenantId: string,
    mappingId: string,
  ): Promise<void> {
    try {
      const mapping = await this.getChannelMappingById(tenantId, mappingId);

      await this.mappingRepository.remove(mapping);

      // Log deletion
      await this.logService.log({
        tenantId,
        channelId: mapping.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Channel mapping deleted: ${mapping.mappingType} (${mapping.internalId})`,
        metadata: { mappingId, mappingType: mapping.mappingType },
      });

      // Emit event
      this.eventEmitter.emit('channel.mapping.deleted', {
        tenantId,
        channelId: mapping.channelId,
        mapping,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete channel mapping: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Transform data using mapping rules
   */
  async transformData(
    tenantId: string,
    request: MappingTransformRequest,
  ): Promise<MappingTransformResult> {
    try {
      const mapping = await this.getChannelMappingById(
        tenantId,
        request.mappingId,
      );

      this.logger.debug(`Transforming data for mapping ${request.mappingId}`, {
        request,
      });

      const result: MappingTransformResult = {
        success: true,
        mappingId: request.mappingId,
        sourceData: request.sourceData,
        transformedData: {},
        appliedRules: [],
        validationErrors: [],
        warnings: [],
      };

      // Apply field mappings
      if (mapping.mappingRules?.fieldMappings) {
        result.transformedData = this.applyFieldMappings(
          request.sourceData,
          mapping.mappingRules.fieldMappings,
          request.direction,
        );
        result.appliedRules.push('field_mappings');
      } else {
        result.transformedData = { ...request.sourceData };
      }

      // Apply value transformations
      if (mapping.mappingRules?.valueTransformations) {
        result.transformedData = await this.applyValueTransformations(
          result.transformedData,
          mapping.mappingRules.valueTransformations,
        );
        result.appliedRules.push('value_transformations');
      }

      // Apply validations
      if (mapping.mappingRules?.validations) {
        const validationResult = this.applyValidations(
          result.transformedData,
          mapping.mappingRules.validations,
        );
        result.validationErrors = validationResult.errors;
        result.warnings = validationResult.warnings;
      }

      result.success = result.validationErrors.length === 0;

      // Log transformation
      await this.logService.log({
        tenantId,
        channelId: mapping.channelId,
        type: IntegrationLogType.SYSTEM,
        level: result.success
          ? IntegrationLogLevel.DEBUG
          : IntegrationLogLevel.WARN,
        message: `Data transformation ${
          result.success ? 'completed' : 'failed'
        }: ${mapping.mappingType}`,
        metadata: {
          mappingId: request.mappingId,
          direction: request.direction,
          appliedRules: result.appliedRules,
          validationErrors: result.validationErrors,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to transform data: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        mappingId: request.mappingId,
        sourceData: request.sourceData,
        transformedData: {},
        appliedRules: [],
        validationErrors: [error.message],
      };
    }
  }

  /**
   * Resolve mapping conflicts
   */
  async resolveConflict(
    tenantId: string,
    resolution: MappingConflictResolution,
  ): Promise<ChannelMapping> {
    try {
      const mapping = await this.getChannelMappingById(
        tenantId,
        resolution.mappingId,
      );

      if (!mapping.hasConflict) {
        throw new BadRequestException(
          'Mapping does not have any conflicts to resolve',
        );
      }

      // Apply conflict resolution
      const resolutionMap = {
        internal_wins: 'internal' as const,
        external_wins: 'external' as const,
        merge: 'merge' as const,
        manual: 'merge' as const, // Default manual to merge
      };

      const mappedResolution = resolutionMap[resolution.resolution] || 'merge';
      mapping.resolveConflict(mappedResolution, resolution.mergeStrategy);
      const resolvedMapping = await this.mappingRepository.save(mapping);

      // Log resolution
      await this.logService.log({
        tenantId,
        channelId: mapping.channelId,
        type: IntegrationLogType.SYSTEM,
        level: IntegrationLogLevel.INFO,
        message: `Mapping conflict resolved: ${resolution.resolution}`,
        metadata: {
          mappingId: resolution.mappingId,
          conflictType: resolution.conflictType,
          resolution: resolution.resolution,
          resolvedBy: resolution.resolvedBy,
        },
      });

      // Emit event
      this.eventEmitter.emit('channel.mapping.conflict.resolved', {
        tenantId,
        channelId: mapping.channelId,
        mapping: resolvedMapping,
        resolution,
      });

      return resolvedMapping;
    } catch (error) {
      this.logger.error(
        `Failed to resolve mapping conflict: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate a mapping
   */
  async validateMapping(
    tenantId: string,
    mappingId: string,
  ): Promise<MappingValidationResult> {
    try {
      const mapping = await this.getChannelMappingById(tenantId, mappingId);

      const result: MappingValidationResult = {
        isValid: true,
        mappingId,
        validationChecks: [],
        overallScore: 0,
        recommendations: [],
      };

      // Basic structure validation
      result.validationChecks.push({
        checkType: 'structure',
        passed: Boolean(mapping.internalId && mapping.externalId),
        message: 'Internal and external IDs are present',
        severity: 'error',
      });

      // Type-specific validation
      const typeValidation = this.validateMappingType(mapping);
      result.validationChecks.push(...typeValidation);

      // Data consistency validation
      if (mapping.internalData && mapping.externalData) {
        const consistencyCheck = this.validateDataConsistency(mapping);
        result.validationChecks.push(consistencyCheck);
      }

      // Sync status validation
      result.validationChecks.push({
        checkType: 'sync_status',
        passed: mapping.syncStatus !== 'failed',
        message: `Sync status: ${mapping.syncStatus}`,
        severity: mapping.syncStatus === 'failed' ? 'error' : 'info',
      });

      // Calculate overall score
      const passedChecks = result.validationChecks.filter(
        check => check.passed,
      ).length;
      const totalChecks = result.validationChecks.length;
      result.overallScore =
        totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

      // Determine overall validity
      result.isValid = !result.validationChecks.some(
        check => check.severity === 'error' && !check.passed,
      );

      // Generate recommendations
      if (result.overallScore < 100) {
        result.recommendations = this.generateMappingRecommendations(
          mapping,
          result.validationChecks,
        );
      }

      // Update mapping verification status
      if (result.isValid && !mapping.isVerified) {
        mapping.isVerified = true;
        mapping.lastVerifiedAt = new Date();
        await this.mappingRepository.save(mapping);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to validate mapping: ${error.message}`,
        error.stack,
      );
      return {
        isValid: false,
        mappingId,
        validationChecks: [
          {
            checkType: 'system_error',
            passed: false,
            message: error.message,
            severity: 'error',
          },
        ],
        overallScore: 0,
      };
    }
  }

  /**
   * Bulk operations on mappings
   */
  async bulkMappingOperation(
    tenantId: string,
    operation: BulkMappingOperation,
  ): Promise<BulkMappingResult> {
    try {
      this.logger.debug(
        `Performing bulk mapping operation: ${operation.operation}`,
        {
          itemsCount: operation.mappings.length,
        },
      );

      const result: BulkMappingResult = {
        success: true,
        operation: operation.operation,
        totalItems: operation.mappings.length,
        successCount: 0,
        errorCount: 0,
        results: [],
      };

      for (const item of operation.mappings) {
        try {
          let operationResult;

          switch (operation.operation) {
            case 'create':
              operationResult = await this.createChannelMapping(
                tenantId,
                item as CreateChannelMappingDto,
              );
              break;

            case 'update':
              const updateItem = item as {
                id: string;
                updates: UpdateChannelMappingDto;
              };
              operationResult = await this.updateChannelMapping(
                tenantId,
                updateItem.id,
                updateItem.updates,
              );
              break;

            case 'delete':
              const deleteItem = item as { id: string };
              await this.deleteChannelMapping(tenantId, deleteItem.id);
              operationResult = { deleted: true };
              break;

            case 'validate':
              const validateItem = item as { id: string };
              operationResult = await this.validateMapping(
                tenantId,
                validateItem.id,
              );
              break;

            default:
              throw new Error(`Unsupported operation: ${operation.operation}`);
          }

          result.results.push({
            success: true,
            item,
            result: operationResult,
          });
          result.successCount++;
        } catch (error) {
          result.results.push({
            success: false,
            item,
            error: error.message,
          });
          result.errorCount++;
        }
      }

      result.success = result.errorCount === 0;

      // Log bulk operation
      await this.logService.log({
        tenantId,
        type: IntegrationLogType.SYSTEM,
        level: result.success
          ? IntegrationLogLevel.INFO
          : IntegrationLogLevel.WARN,
        message: `Bulk mapping operation completed: ${result.successCount}/${result.totalItems} successful`,
        metadata: {
          operation: operation.operation,
          result,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Failed bulk mapping operation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private applyFieldMappings(
    sourceData: Record<string, any>,
    fieldMappings: Record<string, string>,
    direction: string,
  ): Record<string, any> {
    const result = {};

    if (direction === 'internal_to_external') {
      // Map internal fields to external fields
      for (const [internalField, externalField] of Object.entries(
        fieldMappings,
      )) {
        if (sourceData[internalField] !== undefined) {
          result[externalField] = sourceData[internalField];
        }
      }
    } else {
      // Map external fields to internal fields
      for (const [internalField, externalField] of Object.entries(
        fieldMappings,
      )) {
        if (sourceData[externalField] !== undefined) {
          result[internalField] = sourceData[externalField];
        }
      }
    }

    return result;
  }

  private async applyValueTransformations(
    data: Record<string, any>,
    transformations: any[],
  ): Promise<Record<string, any>> {
    const result = { ...data };

    for (const transformation of transformations) {
      const { field, type, rules } = transformation;

      if (result[field] !== undefined) {
        switch (type) {
          case 'format':
            result[field] = this.formatValue(result[field], rules);
            break;

          case 'calculate':
            result[field] = this.calculateValue(result, field, rules);
            break;

          case 'lookup':
            result[field] = this.lookupValue(result[field], rules);
            break;

          case 'conditional':
            result[field] = this.conditionalValue(result, field, rules);
            break;
        }
      }
    }

    return result;
  }

  private applyValidations(
    data: Record<string, any>,
    validations: any[],
  ): { errors: string[]; warnings: string[] } {
    const errors = [];
    const warnings = [];

    for (const validation of validations) {
      const { field, type, rules } = validation;
      const value = data[field];

      switch (type) {
        case 'required':
          if (!value) {
            errors.push(`Field ${field} is required`);
          }
          break;

        case 'format':
          if (
            value &&
            rules.pattern &&
            !new RegExp(rules.pattern).test(value)
          ) {
            errors.push(`Field ${field} format is invalid`);
          }
          break;

        case 'range':
          if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`Field ${field} is below minimum value ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`Field ${field} is above maximum value ${rules.max}`);
            }
          }
          break;
      }
    }

    return { errors, warnings };
  }

  private formatValue(value: any, rules: any): any {
    if (rules.toUpperCase) {
      return value.toString().toUpperCase();
    }
    if (rules.toLowerCase) {
      return value.toString().toLowerCase();
    }
    if (rules.trim) {
      return value.toString().trim();
    }
    if (rules.dateFormat) {
      return new Date(value).toISOString();
    }
    return value;
  }

  private calculateValue(
    data: Record<string, any>,
    field: string,
    rules: any,
  ): any {
    if (rules.formula) {
      // Simple formula evaluation - in production, use a safe formula evaluator
      try {
        return eval(
          rules.formula.replace(
            /\$(\w+)/g,
            (match, fieldName) => data[fieldName] || 0,
          ),
        );
      } catch (error) {
        this.logger.error(`Formula evaluation failed: ${error.message}`);
        return data[field];
      }
    }
    return data[field];
  }

  private lookupValue(value: any, rules: any): any {
    if (rules.mapping && rules.mapping[value]) {
      return rules.mapping[value];
    }
    return rules.defaultValue || value;
  }

  private conditionalValue(
    data: Record<string, any>,
    field: string,
    rules: any,
  ): any {
    if (rules.conditions) {
      for (const condition of rules.conditions) {
        if (this.evaluateCondition(data, condition.if)) {
          return condition.then;
        }
      }
    }
    return rules.else || data[field];
  }

  private evaluateCondition(
    data: Record<string, any>,
    condition: any,
  ): boolean {
    // Simple condition evaluation - in production, use a more sophisticated evaluator
    const { field, operator, value } = condition;
    const fieldValue = data[field];

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'contains':
        return fieldValue && fieldValue.includes(value);
      default:
        return false;
    }
  }

  private validateMappingType(mapping: ChannelMapping): any[] {
    const checks = [];

    switch (mapping.mappingType) {
      case MappingType.PRODUCT:
        checks.push({
          checkType: 'product_validation',
          passed: Boolean(
            mapping.internalData?.sku && mapping.externalData?.sku,
          ),
          message:
            'Product SKUs are present in both internal and external data',
          severity: 'warning' as const,
        });
        break;

      case MappingType.CATEGORY:
        checks.push({
          checkType: 'category_validation',
          passed: Boolean(
            mapping.internalData?.name && mapping.externalData?.name,
          ),
          message:
            'Category names are present in both internal and external data',
          severity: 'warning' as const,
        });
        break;

      // Add more type-specific validations as needed
    }

    return checks;
  }

  private validateDataConsistency(mapping: ChannelMapping): any {
    // Basic consistency check - compare common fields
    const commonFields = ['name', 'sku', 'price', 'status'];
    let consistentFields = 0;
    let totalFields = 0;

    for (const field of commonFields) {
      if (
        mapping.internalData[field] !== undefined &&
        mapping.externalData[field] !== undefined
      ) {
        totalFields++;
        if (mapping.internalData[field] === mapping.externalData[field]) {
          consistentFields++;
        }
      }
    }

    const consistencyRatio =
      totalFields > 0 ? consistentFields / totalFields : 1;

    return {
      checkType: 'data_consistency',
      passed: consistencyRatio >= 0.8, // 80% consistency threshold
      message: `Data consistency: ${Math.round(consistencyRatio * 100)}%`,
      severity:
        consistencyRatio < 0.5
          ? 'error'
          : consistencyRatio < 0.8
          ? 'warning'
          : 'info',
    };
  }

  private generateMappingRecommendations(
    mapping: ChannelMapping,
    checks: any[],
  ): string[] {
    const recommendations = [];

    if (!mapping.isVerified) {
      recommendations.push('Verify mapping by testing with real data');
    }

    if (mapping.syncStatus === 'failed') {
      recommendations.push('Check sync errors and resolve underlying issues');
    }

    if (mapping.errorCount > 5) {
      recommendations.push(
        'Consider reviewing mapping rules due to high error count',
      );
    }

    const failedChecks = checks.filter(
      check => !check.passed && check.severity === 'error',
    );
    if (failedChecks.length > 0) {
      recommendations.push(
        'Resolve critical validation errors before using this mapping',
      );
    }

    return recommendations;
  }
}
