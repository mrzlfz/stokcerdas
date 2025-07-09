import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  DefaultValuePipe,
  ParseBoolPipe,
  ParseIntPipe,
  BadRequestException,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import {
  CustomerDataPipelineService,
  CustomerDataPipelineResult,
  CustomerDataPipelineHealth,
  CustomerDataPipelineConfiguration,
  PipelineEventType,
  PipelineProcessingMode,
  DataQualityLevel,
} from '../services/customer-data-pipeline.service';

@ApiTags('Customer Data Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('customers/data-pipeline')
export class CustomerDataPipelineController {
  private readonly logger = new Logger(CustomerDataPipelineController.name);

  constructor(
    private readonly customerDataPipelineService: CustomerDataPipelineService,
  ) {}

  @Post('process-order/:orderId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process order for customer data pipeline',
    description:
      'Process a specific order through the customer data pipeline for real-time customer analytics and insights generation with comprehensive Indonesian business context',
  })
  @ApiParam({
    name: 'orderId',
    description: 'ID of the order to process',
    type: String,
  })
  @ApiQuery({
    name: 'eventType',
    required: false,
    description: 'Type of pipeline event (default: order.completed)',
    enum: PipelineEventType,
  })
  @ApiQuery({
    name: 'processingMode',
    required: false,
    description: 'Processing mode (default: real_time)',
    enum: PipelineProcessingMode,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order processed successfully through customer data pipeline',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            executionId: { type: 'string' },
            processedOrders: { type: 'number' },
            updatedCustomers: { type: 'number' },
            errorsEncountered: { type: 'number' },
            warningsGenerated: { type: 'number' },
            executionTime: { type: 'number' },
            pipelineStages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  stage: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['success', 'warning', 'error', 'skipped'],
                  },
                  executionTime: { type: 'number' },
                  recordsProcessed: { type: 'number' },
                  errorMessage: { type: 'string' },
                },
              },
            },
            dataQualityAssessment: {
              type: 'object',
              properties: {
                overallScore: { type: 'number', minimum: 0, maximum: 100 },
                completeness: { type: 'number', minimum: 0, maximum: 100 },
                accuracy: { type: 'number', minimum: 0, maximum: 100 },
                consistency: { type: 'number', minimum: 0, maximum: 100 },
                issues: { type: 'array', items: { type: 'string' } },
              },
            },
            businessImpact: {
              type: 'object',
              properties: {
                customersAffected: { type: 'number' },
                segmentChanges: { type: 'number' },
                metricsUpdated: { type: 'array', items: { type: 'string' } },
                analyticsRefreshed: { type: 'boolean' },
              },
            },
            recommendedActions: { type: 'array', items: { type: 'string' } },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            processingType: {
              type: 'string',
              default: 'single_order_processing',
            },
            orderId: { type: 'string' },
            eventType: { type: 'string' },
            processingMode: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid order ID or processing parameters',
  })
  async processOrderForCustomerData(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Query('eventType', new DefaultValuePipe(PipelineEventType.ORDER_COMPLETED))
    eventType: PipelineEventType,
    @Query(
      'processingMode',
      new DefaultValuePipe(PipelineProcessingMode.REAL_TIME),
    )
    processingMode: PipelineProcessingMode,
  ): Promise<{
    success: boolean;
    data: CustomerDataPipelineResult;
    meta: {
      tenantId: string;
      processingType: string;
      orderId: string;
      eventType: PipelineEventType;
      processingMode: PipelineProcessingMode;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Processing order ${orderId} for customer data pipeline (tenant: ${user.tenantId})`,
    );

    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      const result =
        await this.customerDataPipelineService.processOrderForCustomerData(
          user.tenantId,
          orderId,
        );

      return {
        success: true,
        data: result,
        meta: {
          tenantId: user.tenantId,
          processingType: 'single_order_processing',
          orderId,
          eventType,
          processingMode,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to process order ${orderId} for customer data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('process-batch')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process batch of orders for customer data pipeline',
    description:
      'Process multiple orders in batch through the customer data pipeline for bulk customer analytics updates with optimized performance and comprehensive error handling',
  })
  @ApiBody({
    description: 'Batch processing request',
    schema: {
      type: 'object',
      properties: {
        orderIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of order IDs to process',
          minItems: 1,
          maxItems: 200,
        },
        processingMode: {
          type: 'string',
          enum: Object.values(PipelineProcessingMode),
          default: PipelineProcessingMode.BATCH,
          description: 'Processing mode for batch operation',
        },
      },
      required: ['orderIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Batch processing completed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid batch processing parameters',
  })
  async processBatchOrdersForCustomerData(
    @CurrentUser() user: any,
    @Body()
    batchRequest: {
      orderIds: string[];
      processingMode?: PipelineProcessingMode;
    },
  ): Promise<{
    success: boolean;
    data: CustomerDataPipelineResult[];
    meta: {
      tenantId: string;
      processingType: string;
      batchSize: number;
      processingMode: PipelineProcessingMode;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Processing batch of ${batchRequest.orderIds.length} orders for customer data pipeline (tenant: ${user.tenantId})`,
    );

    try {
      if (!batchRequest.orderIds || batchRequest.orderIds.length === 0) {
        throw new BadRequestException('At least one order ID is required');
      }

      if (batchRequest.orderIds.length > 200) {
        throw new BadRequestException('Maximum batch size is 200 orders');
      }

      const processingMode =
        batchRequest.processingMode || PipelineProcessingMode.BATCH;

      const result =
        await this.customerDataPipelineService.processBatchOrdersForCustomerData(
          user.tenantId,
          batchRequest.orderIds,
        );

      return {
        success: true,
        data: result,
        meta: {
          tenantId: user.tenantId,
          processingType: 'batch_order_processing',
          batchSize: batchRequest.orderIds.length,
          processingMode,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to process batch orders for customer data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('enrich-customer/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enrich customer profile with comprehensive analytics',
    description:
      'Enrich specific customer profile with advanced analytics including segmentation, behavior analysis, Indonesian cultural context, and predictive metrics',
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID of the customer to enrich',
    type: String,
  })
  @ApiQuery({
    name: 'includeAdvancedAnalytics',
    required: false,
    description: 'Include advanced analytics (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer profile enriched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            customerId: { type: 'string' },
            enrichmentResults: {
              type: 'object',
              properties: {
                basicMetricsUpdated: { type: 'boolean' },
                segmentationUpdated: { type: 'boolean' },
                behaviorAnalysisUpdated: { type: 'boolean' },
                indonesianContextUpdated: { type: 'boolean' },
                predictiveMetricsUpdated: { type: 'boolean' },
              },
            },
            updatedMetrics: { type: 'array', items: { type: 'string' } },
            executionTime: { type: 'number' },
            dataQuality: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            enrichmentType: {
              type: 'string',
              default: 'customer_profile_enrichment',
            },
            customerId: { type: 'string' },
            includeAdvancedAnalytics: { type: 'boolean' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async enrichCustomerProfile(
    @CurrentUser() user: any,
    @Param('customerId') customerId: string,
    @Query(
      'includeAdvancedAnalytics',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeAdvancedAnalytics: boolean,
  ): Promise<{
    success: boolean;
    data: {
      success: boolean;
      customerId: string;
      enrichmentResults: {
        basicMetricsUpdated: boolean;
        segmentationUpdated: boolean;
        behaviorAnalysisUpdated: boolean;
        indonesianContextUpdated: boolean;
        predictiveMetricsUpdated: boolean;
      };
      updatedMetrics: string[];
      executionTime: number;
      dataQuality: number;
    };
    meta: {
      tenantId: string;
      enrichmentType: string;
      customerId: string;
      includeAdvancedAnalytics: boolean;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Enriching customer profile ${customerId} (tenant: ${user.tenantId})`,
    );

    try {
      if (!customerId || customerId.trim() === '') {
        throw new BadRequestException('Customer ID is required');
      }

      const result =
        await this.customerDataPipelineService.enrichCustomerProfile(
          user.tenantId,
          customerId,
          {
            includeBehavioralAnalysis: includeAdvancedAnalytics,
            includeIndonesianContext: includeAdvancedAnalytics,
            updateSegmentation: true,
            calculatePredictions: includeAdvancedAnalytics,
          },
        );

      // Transform service result to match expected interface
      const transformedData = {
        success: result.success,
        customerId: result.customerId,
        enrichmentResults: {
          basicMetricsUpdated: result.enrichedFields.includes('metrics'),
          segmentationUpdated: result.enrichedFields.includes('segment'),
          behaviorAnalysisUpdated:
            result.enrichedFields.includes('behavioralAnalysis'),
          indonesianContextUpdated:
            result.enrichedFields.includes('indonesianContext'),
          predictiveMetricsUpdated:
            result.enrichedFields.includes('predictions'),
        },
        updatedMetrics: result.enrichedFields,
        executionTime: 1500, // Default execution time
        dataQuality: 85, // Default data quality score
      };

      return {
        success: true,
        data: transformedData,
        meta: {
          tenantId: user.tenantId,
          enrichmentType: 'customer_profile_enrichment',
          customerId,
          includeAdvancedAnalytics,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to enrich customer profile ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer data pipeline health metrics',
    description:
      'Get comprehensive health metrics of the customer data pipeline including processing stats, resource utilization, data quality metrics, and business performance indicators',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pipeline health metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            overallHealth: {
              type: 'string',
              enum: ['healthy', 'warning', 'critical'],
            },
            processingStats: {
              type: 'object',
              properties: {
                averageProcessingTime: { type: 'number' },
                throughputPerSecond: { type: 'number' },
                errorRate: { type: 'number' },
                queueBacklog: { type: 'number' },
              },
            },
            resourceUtilization: {
              type: 'object',
              properties: {
                memoryUsage: { type: 'number' },
                cpuUsage: { type: 'number' },
                databaseConnections: { type: 'number' },
                queueConnections: { type: 'number' },
              },
            },
            dataQualityMetrics: {
              type: 'object',
              properties: {
                overallDataQuality: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                },
                recentDataCompleteness: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                },
                accuracyScore: { type: 'number', minimum: 0, maximum: 100 },
                consistencyScore: { type: 'number', minimum: 0, maximum: 100 },
              },
            },
            businessMetrics: {
              type: 'object',
              properties: {
                customersProcessedToday: { type: 'number' },
                ordersProcessedToday: { type: 'number' },
                segmentationAccuracy: { type: 'number' },
                predictiveModelPerformance: { type: 'number' },
              },
            },
            alerts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  severity: {
                    type: 'string',
                    enum: ['critical', 'high', 'medium', 'low'],
                  },
                  category: {
                    type: 'string',
                    enum: [
                      'performance',
                      'data_quality',
                      'business_logic',
                      'system',
                    ],
                  },
                  message: { type: 'string' },
                  firstDetected: { type: 'string', format: 'date-time' },
                  recommendation: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            healthCheckType: {
              type: 'string',
              default: 'pipeline_health_check',
            },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getPipelineHealth(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: CustomerDataPipelineHealth;
    meta: {
      tenantId: string;
      healthCheckType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Getting pipeline health metrics (tenant: ${user.tenantId})`,
    );

    try {
      const healthMetrics =
        await this.customerDataPipelineService.getPipelineHealth();

      return {
        success: true,
        data: healthMetrics,
        meta: {
          tenantId: user.tenantId,
          healthCheckType: 'pipeline_health_check',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get pipeline health metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer data pipeline statistics',
    description:
      'Get comprehensive statistics and performance metrics of the customer data pipeline for monitoring and optimization purposes',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pipeline statistics retrieved successfully',
  })
  async getPipelineStatistics(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: {
      totalCustomersProcessed: number;
      totalOrdersProcessed: number;
      averageProcessingTime: number;
      errorRate: number;
      dataQualityScore: number;
      indonesianContextAccuracy: number;
    };
    meta: {
      tenantId: string;
      statisticsType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(`Getting pipeline statistics (tenant: ${user.tenantId})`);

    try {
      const statistics =
        await this.customerDataPipelineService.getPipelineStatistics();

      // Transform service result to match expected interface
      const transformedData = {
        totalCustomersProcessed: statistics.performance.totalProcessed,
        totalOrdersProcessed: statistics.performance.totalProcessed, // Same as customers for now
        averageProcessingTime: statistics.performance.averageExecutionTime,
        errorRate: statistics.health.errorRate,
        dataQualityScore: statistics.indonesianMetrics.culturalAccuracyScore,
        indonesianContextAccuracy:
          statistics.indonesianMetrics.culturalAccuracyScore,
      };

      return {
        success: true,
        data: transformedData,
        meta: {
          tenantId: user.tenantId,
          statisticsType: 'pipeline_performance_statistics',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get pipeline statistics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('force-refresh')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force refresh customer analytics for all customers',
    description:
      'Force refresh of customer analytics for all customers in the tenant for comprehensive data synchronization and analytics recalculation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics refresh initiated successfully',
  })
  async forceRefreshCustomerAnalytics(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: {
      success: boolean;
      customersRefreshed: number;
      executionTime: number;
    };
    meta: {
      tenantId: string;
      refreshType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Force refreshing customer analytics (tenant: ${user.tenantId})`,
    );

    try {
      const result =
        await this.customerDataPipelineService.forceRefreshCustomerAnalytics(
          user.tenantId,
        );

      // Transform service result to match expected interface
      const transformedData = {
        success: result.customersUpdated > 0,
        customersRefreshed: result.customersUpdated,
        executionTime: result.executionTime,
      };

      return {
        success: true,
        data: transformedData,
        meta: {
          tenantId: user.tenantId,
          refreshType: 'force_analytics_refresh',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to force refresh customer analytics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('configuration')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get current pipeline configuration',
    description:
      'Get the current configuration settings of the customer data pipeline',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pipeline configuration retrieved successfully',
  })
  async getPipelineConfiguration(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: CustomerDataPipelineConfiguration;
    meta: {
      tenantId: string;
      configType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Getting pipeline configuration (tenant: ${user.tenantId})`,
    );

    try {
      const configuration = this.customerDataPipelineService.getConfiguration();

      return {
        success: true,
        data: configuration,
        meta: {
          tenantId: user.tenantId,
          configType: 'pipeline_configuration',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get pipeline configuration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('configuration')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update pipeline configuration',
    description:
      'Update the configuration settings of the customer data pipeline for optimization and customization',
  })
  @ApiBody({
    description: 'Pipeline configuration update',
    schema: {
      type: 'object',
      properties: {
        processingMode: {
          type: 'string',
          enum: Object.values(PipelineProcessingMode),
        },
        enableRealTimeProcessing: { type: 'boolean' },
        enableBatchProcessing: { type: 'boolean' },
        batchSize: { type: 'number', minimum: 10, maximum: 500 },
        maxRetryAttempts: { type: 'number', minimum: 1, maximum: 10 },
        retryBackoffMs: { type: 'number', minimum: 1000, maximum: 30000 },
        enableDeadLetterQueue: { type: 'boolean' },
        enableIndonesianBusinessLogic: { type: 'boolean' },
        enableAdvancedSegmentation: { type: 'boolean' },
        enableBehaviorAnalysis: { type: 'boolean' },
        enablePredictiveUpdates: { type: 'boolean' },
        dataQualityThreshold: {
          type: 'string',
          enum: Object.values(DataQualityLevel),
        },
        performanceTargets: {
          type: 'object',
          properties: {
            maxProcessingTimeMs: {
              type: 'number',
              minimum: 1000,
              maximum: 60000,
            },
            maxQueueWaitTimeMs: {
              type: 'number',
              minimum: 5000,
              maximum: 300000,
            },
            minThroughputPerSecond: {
              type: 'number',
              minimum: 1,
              maximum: 100,
            },
          },
        },
        indonesianBusinessSettings: {
          type: 'object',
          properties: {
            enableRamadanProcessing: { type: 'boolean' },
            enableRegionalProcessing: { type: 'boolean' },
            enableCulturalSegmentation: { type: 'boolean' },
            enableSeasonalAdjustments: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pipeline configuration updated successfully',
  })
  async updatePipelineConfiguration(
    @CurrentUser() user: any,
    @Body() configUpdate: Partial<CustomerDataPipelineConfiguration>,
  ): Promise<{
    success: boolean;
    data: {
      configurationUpdated: boolean;
      updatedFields: string[];
    };
    meta: {
      tenantId: string;
      updateType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Updating pipeline configuration (tenant: ${user.tenantId})`,
    );

    try {
      const updatedFields = Object.keys(configUpdate);

      this.customerDataPipelineService.updateConfiguration(configUpdate);

      return {
        success: true,
        data: {
          configurationUpdated: true,
          updatedFields,
        },
        meta: {
          tenantId: user.tenantId,
          updateType: 'pipeline_configuration_update',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to update pipeline configuration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
