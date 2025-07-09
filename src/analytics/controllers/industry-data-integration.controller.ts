import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import {
  PermissionResource,
  PermissionAction,
} from '../../auth/entities/permission.entity';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';

import {
  IndustryDataIntegrationService,
  IndustryDataIntegrationRequest,
  IndustryDataIntegrationResult,
} from '../services/industry-data-integration.service';
import {
  IndustryType,
  BenchmarkSource,
  DataQuality,
  RegionScope,
} from '../entities/industry-benchmark.entity';

// DTOs for API requests
export class IntegrateIndustryDataDto {
  industries?: IndustryType[];
  metrics?: string[];
  sources?: BenchmarkSource[];
  regions?: RegionScope[];
  reportingPeriods?: string[];
  forceRefresh?: boolean;
  dataQualityThreshold?: DataQuality;
  includeIndonesianContext?: boolean;
}

export class BenchmarkQueryDto {
  industries?: string; // comma-separated
  metrics?: string; // comma-separated
  sources?: string; // comma-separated
  regions?: string; // comma-separated
  reportingPeriods?: string; // comma-separated
  minDataQuality?: DataQuality;
  minSampleSize?: number;
  includeExpired?: boolean;
  sortBy?: 'value' | 'reportingPeriod' | 'dataQuality' | 'sampleSize';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export class DataQualityAnalysisDto {
  analyzeOutliers?: boolean;
  performCrossValidation?: boolean;
  generateRecommendations?: boolean;
  includeSourceComparison?: boolean;
  timeframeDays?: number;
}

export class BenchmarkComparisonDto {
  targetIndustry: IndustryType;
  comparisonIndustries: IndustryType[];
  metrics: string[];
  regions?: RegionScope[];
  reportingPeriod?: string;
  includePercentiles?: boolean;
  includeTrends?: boolean;
}

@ApiTags('Industry Data Integration')
@Controller('api/v1/analytics/industry-data')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class IndustryDataIntegrationController {
  private readonly logger = new Logger(IndustryDataIntegrationController.name);

  constructor(
    private readonly industryDataIntegrationService: IndustryDataIntegrationService,
  ) {}

  @Post('integrate')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.CREATE,
  })
  @ApiOperation({
    summary: 'Integrate real industry data from Indonesian sources',
    description:
      'Pull and process industry benchmarks from Bank Indonesia, BPS, KADIN, and other authoritative sources',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Industry data integration completed successfully',
    type: Object,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid integration configuration',
  })
  @ApiBody({ type: IntegrateIndustryDataDto })
  async integrateIndustryData(
    @CurrentTenant() tenantId: string,
    @Body(ValidationPipe) integrateDto: IntegrateIndustryDataDto,
  ): Promise<IndustryDataIntegrationResult> {
    try {
      this.logger.log(
        `Starting industry data integration for tenant: ${tenantId}`,
      );

      const request: IndustryDataIntegrationRequest = {
        ...integrateDto,
      };

      const result =
        await this.industryDataIntegrationService.integrateIndustryData(
          request,
        );

      this.logger.log(
        `Industry data integration completed: ${result.integrationId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Industry data integration failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Integration failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('benchmarks')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get industry benchmarks',
    description:
      'Retrieve industry benchmark data with filtering and sorting options',
  })
  @ApiQuery({
    name: 'industries',
    required: false,
    description: 'Comma-separated industry types',
  })
  @ApiQuery({
    name: 'metrics',
    required: false,
    description: 'Comma-separated metric names',
  })
  @ApiQuery({
    name: 'sources',
    required: false,
    description: 'Comma-separated benchmark sources',
  })
  @ApiQuery({
    name: 'regions',
    required: false,
    description: 'Comma-separated regions',
  })
  @ApiQuery({
    name: 'reportingPeriods',
    required: false,
    description: 'Comma-separated reporting periods',
  })
  @ApiQuery({ name: 'minDataQuality', required: false, enum: DataQuality })
  @ApiQuery({ name: 'minSampleSize', required: false, type: Number })
  @ApiQuery({ name: 'includeExpired', required: false, type: Boolean })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['value', 'reportingPeriod', 'dataQuality', 'sampleSize'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Industry benchmarks retrieved successfully',
  })
  async getIndustryBenchmarks(
    @CurrentTenant() tenantId: string,
    @Query() query: BenchmarkQueryDto,
  ) {
    try {
      const industries = query.industries
        ? (query.industries.split(',') as IndustryType[])
        : undefined;
      const metrics = query.metrics ? query.metrics.split(',') : undefined;
      const sources = query.sources
        ? (query.sources.split(',') as BenchmarkSource[])
        : undefined;
      const regions = query.regions
        ? (query.regions.split(',') as RegionScope[])
        : undefined;
      const reportingPeriods = query.reportingPeriods
        ? query.reportingPeriods.split(',')
        : undefined;

      const page = Math.max(1, query.page || 1);
      const limit = Math.min(100, Math.max(1, query.limit || 20));

      const benchmarks =
        await this.industryDataIntegrationService.getBenchmarks({
          industries,
          metrics,
          sources,
          regions,
          reportingPeriods,
          minDataQuality: query.minDataQuality,
          minSampleSize: query.minSampleSize,
          includeExpired: query.includeExpired || false,
          sortBy: query.sortBy || 'reportingPeriod',
          sortOrder: query.sortOrder || 'DESC',
          page,
          limit,
        });

      return {
        success: true,
        data: benchmarks.data,
        pagination: {
          page,
          limit,
          total: benchmarks.total,
          totalPages: Math.ceil(benchmarks.total / limit),
        },
        metadata: {
          filtersApplied: Object.keys(query).length,
          dataFreshness: benchmarks.dataFreshness,
          averageQuality: benchmarks.averageQuality,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get industry benchmarks: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to retrieve benchmarks: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('benchmarks/:benchmarkId')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get specific industry benchmark',
    description: 'Retrieve detailed information for a specific benchmark',
  })
  @ApiParam({ name: 'benchmarkId', description: 'Industry benchmark ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Benchmark details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Benchmark not found',
  })
  async getBenchmarkDetails(
    @CurrentTenant() tenantId: string,
    @Param('benchmarkId', ParseUUIDPipe) benchmarkId: string,
  ) {
    try {
      const benchmark =
        await this.industryDataIntegrationService.getBenchmarkById(benchmarkId);

      if (!benchmark) {
        throw new HttpException('Benchmark not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: benchmark,
        metadata: {
          benchmarkId,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get benchmark details: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to retrieve benchmark details: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('benchmarks/compare')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Compare industry benchmarks',
    description:
      'Compare benchmarks across different industries, regions, or time periods',
  })
  @ApiBody({ type: BenchmarkComparisonDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Benchmark comparison completed successfully',
  })
  async compareBenchmarks(
    @CurrentTenant() tenantId: string,
    @Body(ValidationPipe) comparisonDto: BenchmarkComparisonDto,
  ) {
    try {
      const comparison =
        await this.industryDataIntegrationService.compareBenchmarks(
          comparisonDto,
        );

      return {
        success: true,
        data: comparison,
        metadata: {
          targetIndustry: comparisonDto.targetIndustry,
          comparisonIndustries: comparisonDto.comparisonIndustries,
          metricsCompared: comparisonDto.metrics.length,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to compare benchmarks: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to compare benchmarks: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('data-quality')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get data quality metrics',
    description:
      'Retrieve comprehensive data quality metrics for industry benchmarks',
  })
  @ApiQuery({ name: 'analyzeOutliers', required: false, type: Boolean })
  @ApiQuery({ name: 'performCrossValidation', required: false, type: Boolean })
  @ApiQuery({ name: 'generateRecommendations', required: false, type: Boolean })
  @ApiQuery({ name: 'includeSourceComparison', required: false, type: Boolean })
  @ApiQuery({ name: 'timeframeDays', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data quality metrics retrieved successfully',
  })
  async getDataQualityMetrics(
    @CurrentTenant() tenantId: string,
    @Query() query: DataQualityAnalysisDto,
  ) {
    try {
      const qualityMetrics =
        await this.industryDataIntegrationService.getDataQualityMetrics({
          analyzeOutliers: query.analyzeOutliers || false,
          performCrossValidation: query.performCrossValidation || false,
          generateRecommendations: query.generateRecommendations || false,
          includeSourceComparison: query.includeSourceComparison || false,
          timeframeDays: query.timeframeDays || 30,
        });

      return {
        success: true,
        data: qualityMetrics,
        metadata: {
          analysisType: 'comprehensive_quality_assessment',
          timeframeDays: query.timeframeDays || 30,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get data quality metrics: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to retrieve data quality metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sources/status')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get data sources status',
    description: 'Check the status and health of all industry data sources',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data sources status retrieved successfully',
  })
  async getDataSourcesStatus(@CurrentTenant() tenantId: string) {
    try {
      const sourcesStatus =
        await this.industryDataIntegrationService.getDataSourcesStatus();

      return {
        success: true,
        data: sourcesStatus,
        metadata: {
          totalSources: sourcesStatus.length,
          healthySources: sourcesStatus.filter(s => s.status === 'healthy')
            .length,
          checkedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get data sources status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to retrieve data sources status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sources/refresh')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.CREATE,
  })
  @ApiOperation({
    summary: 'Refresh data from all sources',
    description:
      'Manually trigger refresh of data from all industry data sources',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          items: { type: 'string', enum: Object.values(BenchmarkSource) },
        },
        forceRefresh: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data refresh initiated successfully',
  })
  async refreshDataSources(
    @CurrentTenant() tenantId: string,
    @Body()
    refreshConfig: {
      sources?: BenchmarkSource[];
      forceRefresh?: boolean;
    },
  ) {
    try {
      const refreshResult =
        await this.industryDataIntegrationService.refreshDataSources({
          sources: refreshConfig.sources,
          forceRefresh: refreshConfig.forceRefresh || false,
        });

      return {
        success: true,
        data: refreshResult,
        metadata: {
          sourcesRefreshed: refreshConfig.sources?.length || 'all',
          forceRefresh: refreshConfig.forceRefresh || false,
          refreshedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh data sources: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to refresh data sources: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('integration-history')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get integration history',
    description: 'Retrieve history of data integration processes',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['success', 'partial', 'failed'],
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: Object.values(BenchmarkSource),
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Integration history retrieved successfully',
  })
  async getIntegrationHistory(
    @CurrentTenant() tenantId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: 'success' | 'partial' | 'failed',
    @Query('source') source?: BenchmarkSource,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    try {
      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));

      const history =
        await this.industryDataIntegrationService.getIntegrationHistory({
          fromDate,
          toDate,
          status,
          source,
          page: pageNum,
          limit: limitNum,
        });

      return {
        success: true,
        data: history.data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: history.total,
          totalPages: Math.ceil(history.total / limitNum),
        },
        metadata: {
          filtersApplied: !!(fromDate || toDate || status || source),
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get integration history: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to retrieve integration history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('recommendations')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get data improvement recommendations',
    description:
      'Get AI-powered recommendations for improving data quality and coverage',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: [
      'data_source',
      'quality_improvement',
      'coverage_expansion',
      'frequency_adjustment',
    ],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['critical', 'high', 'medium', 'low'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Recommendations retrieved successfully',
  })
  async getRecommendations(
    @CurrentTenant() tenantId: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
  ) {
    try {
      const recommendations =
        await this.industryDataIntegrationService.getRecommendations({
          category: category as any,
          priority: priority as any,
        });

      return {
        success: true,
        data: recommendations,
        metadata: {
          category,
          priority,
          recommendationsCount: recommendations.length,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get recommendations: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to retrieve recommendations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('coverage/analysis')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Get coverage analysis',
    description:
      'Analyze the coverage of industry benchmarks across different dimensions',
  })
  @ApiQuery({
    name: 'analysisType',
    required: false,
    enum: ['industry', 'region', 'metric', 'source', 'comprehensive'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coverage analysis retrieved successfully',
  })
  async getCoverageAnalysis(
    @CurrentTenant() tenantId: string,
    @Query('analysisType') analysisType = 'comprehensive',
  ) {
    try {
      const coverageAnalysis =
        await this.industryDataIntegrationService.getCoverageAnalysis(
          analysisType as any,
        );

      return {
        success: true,
        data: coverageAnalysis,
        metadata: {
          analysisType,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get coverage analysis: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to retrieve coverage analysis: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate')
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.CREATE,
  })
  @ApiOperation({
    summary: 'Validate benchmark data',
    description:
      'Perform comprehensive validation of benchmark data quality and consistency',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        benchmarkIds: {
          type: 'array',
          items: { type: 'string' },
        },
        validationType: {
          type: 'string',
          enum: ['quick', 'standard', 'comprehensive', 'expert'],
        },
        includeRecommendations: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation completed successfully',
  })
  async validateBenchmarks(
    @CurrentTenant() tenantId: string,
    @Body()
    validationConfig: {
      benchmarkIds?: string[];
      validationType?: 'quick' | 'standard' | 'comprehensive' | 'expert';
      includeRecommendations?: boolean;
    },
  ) {
    try {
      const validationResult =
        await this.industryDataIntegrationService.validateBenchmarks(
          validationConfig,
        );

      return {
        success: true,
        data: validationResult,
        metadata: {
          benchmarksValidated: validationConfig.benchmarkIds?.length || 'all',
          validationType: validationConfig.validationType || 'standard',
          validatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to validate benchmarks: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to validate benchmarks: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
