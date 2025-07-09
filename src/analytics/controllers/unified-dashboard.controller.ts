import {
  Controller,
  Get,
  Query,
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
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import {
  UnifiedDashboardAggregatorService,
  UnifiedDashboardData,
  UnifiedDashboardConfiguration,
  DashboardType,
  DataPriority,
  CacheStrategy,
} from '../services/unified-dashboard-aggregator.service';

@ApiTags('Unified Analytics Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('analytics/unified-dashboard')
export class UnifiedDashboardController {
  private readonly logger = new Logger(UnifiedDashboardController.name);

  constructor(
    private readonly unifiedDashboardAggregatorService: UnifiedDashboardAggregatorService,
  ) {}

  @Get('comprehensive')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get comprehensive unified analytics dashboard',
    description:
      'Get complete unified dashboard combining all analytics services with executive summary, customer intelligence, operational analytics, predictive insights, and Indonesian market context in a single comprehensive view',
  })
  @ApiQuery({
    name: 'dataPriority',
    required: false,
    description: 'Data freshness priority (default: hourly)',
    enum: DataPriority,
  })
  @ApiQuery({
    name: 'cacheStrategy',
    required: false,
    description: 'Caching strategy (default: hybrid_cache)',
    enum: CacheStrategy,
  })
  @ApiQuery({
    name: 'includeHistoricalComparison',
    required: false,
    description: 'Include historical data comparison (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeIndonesianContext',
    required: false,
    description: 'Include Indonesian market context (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includePredictiveAnalytics',
    required: false,
    description: 'Include predictive analytics (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeCustomerSegmentation',
    required: false,
    description: 'Include customer segmentation analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeBehavioralAnalysis',
    required: false,
    description: 'Include behavioral analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includePerformanceBenchmarks',
    required: false,
    description: 'Include performance benchmarks (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'timeRangePeriods',
    required: false,
    description: 'Number of time periods to include (default: 12)',
    type: Number,
  })
  @ApiQuery({
    name: 'timeRangeGranularity',
    required: false,
    description: 'Time range granularity (default: monthly)',
    enum: ['daily', 'weekly', 'monthly', 'quarterly'],
  })
  @ApiQuery({
    name: 'churnRiskThreshold',
    required: false,
    description: 'Churn risk alert threshold (default: 70)',
    type: Number,
  })
  @ApiQuery({
    name: 'revenueDeclineThreshold',
    required: false,
    description: 'Revenue decline alert threshold (default: 15)',
    type: Number,
  })
  @ApiQuery({
    name: 'includeRamadanEffects',
    required: false,
    description: 'Include Ramadan seasonal effects (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeRegionalAnalysis',
    required: false,
    description: 'Include regional analysis for Indonesia (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comprehensive unified dashboard generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            dashboardMetadata: {
              type: 'object',
              properties: {
                tenantId: { type: 'string' },
                dashboardType: {
                  type: 'string',
                  enum: Object.values(DashboardType),
                },
                generatedAt: { type: 'string', format: 'date-time' },
                dataFreshness: {
                  type: 'string',
                  enum: Object.values(DataPriority),
                },
                executionTime: { type: 'number' },
                cacheHit: { type: 'boolean' },
                dataQuality: {
                  type: 'object',
                  properties: {
                    completeness: { type: 'number', minimum: 0, maximum: 100 },
                    accuracy: { type: 'number', minimum: 0, maximum: 100 },
                    timeliness: { type: 'number', minimum: 0, maximum: 100 },
                  },
                },
                nextRefresh: { type: 'string', format: 'date-time' },
              },
            },
            executiveSummary: { type: 'object' },
            customerIntelligence: { type: 'object' },
            operationalAnalytics: { type: 'object' },
            predictiveInsights: { type: 'object' },
            performanceMetrics: { type: 'object' },
            indonesianMarketContext: { type: 'object' },
            alertsAndNotifications: { type: 'array' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            requestType: {
              type: 'string',
              default: 'comprehensive_unified_dashboard',
            },
            configuration: { type: 'object' },
            generatedAt: { type: 'string', format: 'date-time' },
            totalExecutionTime: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid configuration parameters',
  })
  async getComprehensiveUnifiedDashboard(
    @CurrentUser() user: any,
    @Query('dataPriority', new DefaultValuePipe(DataPriority.HOURLY))
    dataPriority: DataPriority,
    @Query('cacheStrategy', new DefaultValuePipe(CacheStrategy.HYBRID_CACHE))
    cacheStrategy: CacheStrategy,
    @Query(
      'includeHistoricalComparison',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeHistoricalComparison: boolean,
    @Query(
      'includeIndonesianContext',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeIndonesianContext: boolean,
    @Query(
      'includePredictiveAnalytics',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includePredictiveAnalytics: boolean,
    @Query(
      'includeCustomerSegmentation',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeCustomerSegmentation: boolean,
    @Query(
      'includeBehavioralAnalysis',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeBehavioralAnalysis: boolean,
    @Query(
      'includePerformanceBenchmarks',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includePerformanceBenchmarks: boolean,
    @Query('timeRangePeriods', new DefaultValuePipe(12), ParseIntPipe)
    timeRangePeriods: number,
    @Query('timeRangeGranularity', new DefaultValuePipe('monthly'))
    timeRangeGranularity: 'daily' | 'weekly' | 'monthly' | 'quarterly',
    @Query('churnRiskThreshold', new DefaultValuePipe(70), ParseIntPipe)
    churnRiskThreshold: number,
    @Query('revenueDeclineThreshold', new DefaultValuePipe(15), ParseIntPipe)
    revenueDeclineThreshold: number,
    @Query('includeRamadanEffects', new DefaultValuePipe(true), ParseBoolPipe)
    includeRamadanEffects: boolean,
    @Query('includeRegionalAnalysis', new DefaultValuePipe(true), ParseBoolPipe)
    includeRegionalAnalysis: boolean,
  ): Promise<{
    success: boolean;
    data: UnifiedDashboardData;
    meta: {
      tenantId: string;
      requestType: string;
      configuration: UnifiedDashboardConfiguration;
      generatedAt: string;
      totalExecutionTime: number;
    };
  }> {
    const startTime = Date.now();
    this.logger.debug(
      `Generating comprehensive unified dashboard for tenant ${user.tenantId}`,
    );

    try {
      // Validate input parameters
      if (timeRangePeriods < 1 || timeRangePeriods > 36) {
        throw new BadRequestException(
          'Time range periods must be between 1 and 36',
        );
      }

      if (churnRiskThreshold < 0 || churnRiskThreshold > 100) {
        throw new BadRequestException(
          'Churn risk threshold must be between 0 and 100',
        );
      }

      if (revenueDeclineThreshold < 0 || revenueDeclineThreshold > 100) {
        throw new BadRequestException(
          'Revenue decline threshold must be between 0 and 100',
        );
      }

      // Build comprehensive configuration
      const configuration: UnifiedDashboardConfiguration = {
        dashboardType: DashboardType.COMPREHENSIVE_UNIFIED,
        dataPriority,
        cacheStrategy,
        includeHistoricalComparison,
        includeIndonesianContext,
        includePredictiveAnalytics,
        includeCustomerSegmentation,
        includeBehavioralAnalysis,
        includePerformanceBenchmarks,
        customMetrics: [], // Could be extended to accept custom metrics
        timeRange: {
          periods: timeRangePeriods,
          granularity: timeRangeGranularity,
        },
        alertThresholds: {
          churnRisk: churnRiskThreshold,
          revenueDecline: revenueDeclineThreshold,
          performanceDeviation: 20, // Fixed threshold
        },
        indonesianBusinessSettings: {
          includeRamadanEffects,
          includeRegionalAnalysis,
          includeCulturalFactors: includeIndonesianContext,
          includeEconomicIndicators: includeIndonesianContext,
        },
      };

      // Generate comprehensive unified dashboard
      const unifiedDashboard =
        await this.unifiedDashboardAggregatorService.generateUnifiedDashboard(
          user.tenantId,
          configuration,
        );

      const totalExecutionTime = Date.now() - startTime;

      return {
        success: true,
        data: unifiedDashboard,
        meta: {
          tenantId: user.tenantId,
          requestType: 'comprehensive_unified_dashboard',
          configuration,
          generatedAt: new Date().toISOString(),
          totalExecutionTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate comprehensive unified dashboard for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('executive-summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get executive summary dashboard',
    description:
      'Get high-level business overview dashboard optimized for executive decision making with key metrics, performance indicators, and top insights',
  })
  @ApiQuery({
    name: 'includeIndonesianContext',
    required: false,
    description: 'Include Indonesian market context (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Executive summary dashboard generated successfully',
  })
  async getExecutiveSummaryDashboard(
    @CurrentUser() user: any,
    @Query(
      'includeIndonesianContext',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeIndonesianContext: boolean,
  ): Promise<{
    success: boolean;
    data: UnifiedDashboardData['executiveSummary'];
    meta: {
      tenantId: string;
      dashboardType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating executive summary dashboard for tenant ${user.tenantId}`,
    );

    try {
      const executiveSummary =
        await this.unifiedDashboardAggregatorService.generateExecutiveSummaryDashboard(
          user.tenantId,
          { includeIndonesianContext },
        );

      return {
        success: true,
        data: executiveSummary,
        meta: {
          tenantId: user.tenantId,
          dashboardType: 'executive_summary',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate executive summary dashboard for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('customer-intelligence')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer intelligence dashboard',
    description:
      'Get comprehensive customer analytics dashboard with segmentation, behavioral insights, and churn prediction optimized for customer relationship management',
  })
  @ApiQuery({
    name: 'includeSegmentation',
    required: false,
    description: 'Include customer segmentation analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeBehavioralAnalysis',
    required: false,
    description: 'Include behavioral analysis (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includePredictiveAnalytics',
    required: false,
    description: 'Include predictive analytics (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer intelligence dashboard generated successfully',
  })
  async getCustomerIntelligenceDashboard(
    @CurrentUser() user: any,
    @Query('includeSegmentation', new DefaultValuePipe(true), ParseBoolPipe)
    includeSegmentation: boolean,
    @Query(
      'includeBehavioralAnalysis',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeBehavioralAnalysis: boolean,
    @Query(
      'includePredictiveAnalytics',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includePredictiveAnalytics: boolean,
  ): Promise<{
    success: boolean;
    data: UnifiedDashboardData['customerIntelligence'];
    meta: {
      tenantId: string;
      dashboardType: string;
      includedComponents: string[];
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating customer intelligence dashboard for tenant ${user.tenantId}`,
    );

    try {
      const customerIntelligence =
        await this.unifiedDashboardAggregatorService.generateCustomerIntelligenceDashboard(
          user.tenantId,
          {
            includeCustomerSegmentation: includeSegmentation,
            includeBehavioralAnalysis,
            includePredictiveAnalytics,
          },
        );

      const includedComponents: string[] = [];
      if (includeSegmentation) includedComponents.push('segmentation');
      if (includeBehavioralAnalysis)
        includedComponents.push('behavioral_analysis');
      if (includePredictiveAnalytics)
        includedComponents.push('predictive_analytics');

      return {
        success: true,
        data: customerIntelligence,
        meta: {
          tenantId: user.tenantId,
          dashboardType: 'customer_intelligence',
          includedComponents,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate customer intelligence dashboard for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('real-time-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get real-time performance monitoring dashboard',
    description:
      'Get live performance metrics with real-time alerts and notifications for immediate operational awareness',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Real-time performance monitoring dashboard generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            currentMetrics: { type: 'object' },
            alerts: { type: 'array' },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            dashboardType: { type: 'string', default: 'real_time_performance' },
            refreshRate: { type: 'string', default: 'real_time' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getRealTimePerformanceMonitoring(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: {
      currentMetrics: UnifiedDashboardData['performanceMetrics'];
      alerts: UnifiedDashboardData['alertsAndNotifications'];
      lastUpdated: Date;
    };
    meta: {
      tenantId: string;
      dashboardType: string;
      refreshRate: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating real-time performance monitoring for tenant ${user.tenantId}`,
    );

    try {
      const realTimePerformance =
        await this.unifiedDashboardAggregatorService.generateRealTimePerformanceMonitoring(
          user.tenantId,
        );

      return {
        success: true,
        data: realTimePerformance,
        meta: {
          tenantId: user.tenantId,
          dashboardType: 'real_time_performance',
          refreshRate: 'real_time',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate real-time performance monitoring for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('dashboard-health')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get dashboard system health and data quality metrics',
    description:
      'Get information about dashboard system health, data quality, cache performance, and service availability',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard health metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            systemHealth: {
              type: 'object',
              properties: {
                overallStatus: {
                  type: 'string',
                  enum: ['healthy', 'warning', 'critical'],
                },
                serviceAvailability: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                },
                averageResponseTime: { type: 'number' },
                errorRate: { type: 'number' },
              },
            },
            dataQuality: {
              type: 'object',
              properties: {
                overallCompleteness: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                },
                overallAccuracy: { type: 'number', minimum: 0, maximum: 100 },
                overallTimeliness: { type: 'number', minimum: 0, maximum: 100 },
                dataSourceHealth: { type: 'array' },
              },
            },
            cachePerformance: {
              type: 'object',
              properties: {
                hitRate: { type: 'number', minimum: 0, maximum: 100 },
                missRate: { type: 'number', minimum: 0, maximum: 100 },
                averageRetrievalTime: { type: 'number' },
                cacheSize: { type: 'number' },
              },
            },
            recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            checkType: { type: 'string', default: 'dashboard_health' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getDashboardHealth(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: {
      systemHealth: {
        overallStatus: 'healthy' | 'warning' | 'critical';
        serviceAvailability: number;
        averageResponseTime: number;
        errorRate: number;
      };
      dataQuality: {
        overallCompleteness: number;
        overallAccuracy: number;
        overallTimeliness: number;
        dataSourceHealth: Array<{
          source: string;
          status: 'online' | 'degraded' | 'offline';
          lastUpdate: Date;
          reliability: number;
        }>;
      };
      cachePerformance: {
        hitRate: number;
        missRate: number;
        averageRetrievalTime: number;
        cacheSize: number;
      };
      recommendations: string[];
    };
    meta: {
      tenantId: string;
      checkType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(`Checking dashboard health for tenant ${user.tenantId}`);

    try {
      // Mock implementation - in real scenario would check actual system health
      const healthData = {
        systemHealth: {
          overallStatus: 'healthy' as const,
          serviceAvailability: 99.5,
          averageResponseTime: 250, // milliseconds
          errorRate: 0.1, // percentage
        },
        dataQuality: {
          overallCompleteness: 95.8,
          overallAccuracy: 98.2,
          overallTimeliness: 92.1,
          dataSourceHealth: [
            {
              source: 'Customer Analytics Service',
              status: 'online' as const,
              lastUpdate: new Date(),
              reliability: 99.2,
            },
            {
              source: 'Business Intelligence Service',
              status: 'online' as const,
              lastUpdate: new Date(),
              reliability: 98.8,
            },
            {
              source: 'Predictive Analytics Service',
              status: 'online' as const,
              lastUpdate: new Date(),
              reliability: 97.5,
            },
          ],
        },
        cachePerformance: {
          hitRate: 85.2,
          missRate: 14.8,
          averageRetrievalTime: 45, // milliseconds
          cacheSize: 1024, // MB
        },
        recommendations: [
          'System performance is optimal',
          'Data quality metrics are within acceptable ranges',
          'Cache hit rate is performing well',
          'No immediate actions required',
        ],
      };

      return {
        success: true,
        data: healthData,
        meta: {
          tenantId: user.tenantId,
          checkType: 'dashboard_health',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to check dashboard health for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('configuration-templates')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get predefined dashboard configuration templates',
    description:
      'Get list of predefined dashboard configuration templates optimized for different use cases and user roles',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard configuration templates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  targetRole: { type: 'string' },
                  useCase: { type: 'string' },
                  configuration: { type: 'object' },
                  estimatedExecutionTime: { type: 'number' },
                  recommendedRefreshRate: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            totalTemplates: { type: 'number' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getDashboardConfigurationTemplates(): Promise<{
    success: boolean;
    data: {
      templates: Array<{
        id: string;
        name: string;
        description: string;
        targetRole: string;
        useCase: string;
        configuration: Partial<UnifiedDashboardConfiguration>;
        estimatedExecutionTime: number;
        recommendedRefreshRate: string;
      }>;
    };
    meta: {
      totalTemplates: number;
      generatedAt: string;
    };
  }> {
    this.logger.debug('Retrieving dashboard configuration templates');

    try {
      const templates = [
        {
          id: 'executive-overview',
          name: 'Executive Overview',
          description: 'High-level business overview for C-level executives',
          targetRole: 'Executive',
          useCase:
            'Strategic decision making and business performance monitoring',
          configuration: {
            dashboardType: DashboardType.EXECUTIVE_SUMMARY,
            dataPriority: DataPriority.HOURLY,
            includeHistoricalComparison: true,
            includePredictiveAnalytics: false,
            includeIndonesianContext: true,
            timeRange: { periods: 6, granularity: 'monthly' as const },
          },
          estimatedExecutionTime: 3000, // milliseconds
          recommendedRefreshRate: '4 hours',
        },
        {
          id: 'customer-manager',
          name: 'Customer Manager Dashboard',
          description:
            'Comprehensive customer analytics for customer relationship management',
          targetRole: 'Customer Manager',
          useCase:
            'Customer retention, segmentation, and relationship optimization',
          configuration: {
            dashboardType: DashboardType.CUSTOMER_INTELLIGENCE,
            dataPriority: DataPriority.NEAR_REAL_TIME,
            includeCustomerSegmentation: true,
            includeBehavioralAnalysis: true,
            includePredictiveAnalytics: true,
            timeRange: { periods: 12, granularity: 'monthly' as const },
          },
          estimatedExecutionTime: 8000,
          recommendedRefreshRate: '1 hour',
        },
        {
          id: 'operations-manager',
          name: 'Operations Manager Dashboard',
          description: 'Operational efficiency and performance monitoring',
          targetRole: 'Operations Manager',
          useCase:
            'Operational efficiency, inventory optimization, and process improvement',
          configuration: {
            dashboardType: DashboardType.OPERATIONAL_ANALYTICS,
            dataPriority: DataPriority.NEAR_REAL_TIME,
            includePerformanceBenchmarks: true,
            includeHistoricalComparison: true,
            timeRange: { periods: 3, granularity: 'monthly' as const },
          },
          estimatedExecutionTime: 5000,
          recommendedRefreshRate: '30 minutes',
        },
        {
          id: 'business-analyst',
          name: 'Business Analyst Dashboard',
          description:
            'Deep analytics with predictive insights and trend analysis',
          targetRole: 'Business Analyst',
          useCase:
            'Data analysis, trend identification, and predictive modeling',
          configuration: {
            dashboardType: DashboardType.PREDICTIVE_INSIGHTS,
            dataPriority: DataPriority.HOURLY,
            includePredictiveAnalytics: true,
            includeHistoricalComparison: true,
            includePerformanceBenchmarks: true,
            timeRange: { periods: 24, granularity: 'monthly' as const },
          },
          estimatedExecutionTime: 12000,
          recommendedRefreshRate: '2 hours',
        },
        {
          id: 'real-time-monitoring',
          name: 'Real-time Operations Monitor',
          description:
            'Live monitoring with immediate alerts and notifications',
          targetRole: 'Operations Team',
          useCase:
            'Real-time monitoring, immediate issue detection, and alert management',
          configuration: {
            dashboardType: DashboardType.PERFORMANCE_METRICS,
            dataPriority: DataPriority.REAL_TIME,
            cacheStrategy: CacheStrategy.NO_CACHE,
            includePerformanceBenchmarks: false,
            timeRange: { periods: 1, granularity: 'daily' as const },
          },
          estimatedExecutionTime: 2000,
          recommendedRefreshRate: 'Real-time',
        },
        {
          id: 'indonesian-market-focus',
          name: 'Indonesian Market Intelligence',
          description:
            'Specialized dashboard for Indonesian market context and cultural factors',
          targetRole: 'Market Manager',
          useCase:
            'Indonesian market analysis, cultural adaptation, and regional insights',
          configuration: {
            dashboardType: DashboardType.COMPREHENSIVE_UNIFIED,
            dataPriority: DataPriority.DAILY,
            includeIndonesianContext: true,
            indonesianBusinessSettings: {
              includeRamadanEffects: true,
              includeRegionalAnalysis: true,
              includeCulturalFactors: true,
              includeEconomicIndicators: true,
            },
            timeRange: { periods: 18, granularity: 'monthly' as const },
          },
          estimatedExecutionTime: 10000,
          recommendedRefreshRate: '6 hours',
        },
      ];

      return {
        success: true,
        data: { templates },
        meta: {
          totalTemplates: templates.length,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve dashboard configuration templates: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
