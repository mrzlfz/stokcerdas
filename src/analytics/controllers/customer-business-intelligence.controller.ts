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
  CustomerBusinessIntelligenceService,
  CustomerBusinessIntelligenceDashboard,
  CustomerBusinessIntelligenceConfiguration,
  CustomerHealthScore,
  BusinessOpportunityType,
  IndonesianMarketContext,
} from '../services/customer-business-intelligence.service';

@ApiTags('Customer Business Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('analytics/customer-business-intelligence')
export class CustomerBusinessIntelligenceController {
  private readonly logger = new Logger(
    CustomerBusinessIntelligenceController.name,
  );

  constructor(
    private readonly customerBusinessIntelligenceService: CustomerBusinessIntelligenceService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get comprehensive customer business intelligence dashboard',
    description:
      'Get unified dashboard combining all customer analytics services with executive summary, behavioral insights, predictive analytics, and operational recommendations with Indonesian business context',
  })
  @ApiQuery({
    name: 'refreshFrequency',
    required: false,
    description: 'Data refresh frequency (default: hourly)',
    enum: ['real_time', 'hourly', 'daily', 'weekly'],
  })
  @ApiQuery({
    name: 'includePredictiveAnalytics',
    required: false,
    description: 'Include predictive analytics (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeIndonesianContext',
    required: false,
    description: 'Include Indonesian market context (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'segmentAnalysisDepth',
    required: false,
    description: 'Depth of segment analysis (default: comprehensive)',
    enum: ['basic', 'standard', 'comprehensive'],
  })
  @ApiQuery({
    name: 'historicalDataRange',
    required: false,
    description: 'Historical data range in months (default: 12)',
    type: Number,
  })
  @ApiQuery({
    name: 'churnRiskThreshold',
    required: false,
    description: 'Churn risk alert threshold percentage (default: 70)',
    type: Number,
  })
  @ApiQuery({
    name: 'revenueDropThreshold',
    required: false,
    description: 'Revenue drop alert threshold percentage (default: 15)',
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Customer business intelligence dashboard generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            executiveSummary: {
              type: 'object',
              properties: {
                totalCustomerValue: {
                  type: 'number',
                  description: 'Total customer value in IDR',
                },
                customerHealthDistribution: {
                  type: 'object',
                  description: 'Distribution of customers by health score',
                  additionalProperties: { type: 'number' },
                },
                predictedGrowthRate: {
                  type: 'number',
                  description: 'Predicted growth rate for next 12 months',
                },
                churnRiskAlert: {
                  type: 'object',
                  properties: {
                    highRiskCustomers: { type: 'number' },
                    estimatedRevenueLoss: { type: 'number' },
                    preventionRecommendations: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
                topBusinessOpportunities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: Object.values(BusinessOpportunityType),
                      },
                      estimatedImpact: { type: 'number' },
                      timeToRealize: { type: 'number' },
                      confidence: { type: 'number' },
                      description: { type: 'string' },
                    },
                  },
                },
                indonesianMarketInsights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      context: {
                        type: 'string',
                        enum: Object.values(IndonesianMarketContext),
                      },
                      currentRelevance: { type: 'number' },
                      actionableInsight: { type: 'string' },
                      businessImplication: { type: 'string' },
                    },
                  },
                },
              },
            },
            customerSegmentPerformance: { type: 'object' },
            behavioralInsights: { type: 'object' },
            predictiveAnalytics: { type: 'object' },
            operationalRecommendations: { type: 'object' },
            performanceMetrics: { type: 'object' },
            realTimeAlerts: { type: 'array' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            dashboardType: {
              type: 'string',
              default: 'customer_business_intelligence',
            },
            configuration: { type: 'object' },
            generatedAt: { type: 'string', format: 'date-time' },
            executionTime: { type: 'number' },
            dataFreshness: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid configuration parameters',
  })
  async getCustomerBusinessIntelligenceDashboard(
    @CurrentUser() user: any,
    @Query('refreshFrequency', new DefaultValuePipe('hourly'))
    refreshFrequency: 'real_time' | 'hourly' | 'daily' | 'weekly',
    @Query(
      'includePredictiveAnalytics',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includePredictiveAnalytics: boolean,
    @Query(
      'includeIndonesianContext',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeIndonesianContext: boolean,
    @Query('segmentAnalysisDepth', new DefaultValuePipe('comprehensive'))
    segmentAnalysisDepth: 'basic' | 'standard' | 'comprehensive',
    @Query('historicalDataRange', new DefaultValuePipe(12), ParseIntPipe)
    historicalDataRange: number,
    @Query('churnRiskThreshold', new DefaultValuePipe(70), ParseIntPipe)
    churnRiskThreshold: number,
    @Query('revenueDropThreshold', new DefaultValuePipe(15), ParseIntPipe)
    revenueDropThreshold: number,
  ): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard;
    meta: {
      tenantId: string;
      dashboardType: string;
      configuration: CustomerBusinessIntelligenceConfiguration;
      generatedAt: string;
      executionTime: number;
      dataFreshness: string;
    };
  }> {
    const startTime = Date.now();
    this.logger.debug(
      `Generating customer BI dashboard for tenant ${user.tenantId}`,
    );

    try {
      // Validate configuration parameters
      if (historicalDataRange < 1 || historicalDataRange > 36) {
        throw new BadRequestException(
          'Historical data range must be between 1 and 36 months',
        );
      }

      if (churnRiskThreshold < 0 || churnRiskThreshold > 100) {
        throw new BadRequestException(
          'Churn risk threshold must be between 0 and 100',
        );
      }

      if (revenueDropThreshold < 0 || revenueDropThreshold > 100) {
        throw new BadRequestException(
          'Revenue drop threshold must be between 0 and 100',
        );
      }

      // Build configuration
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency,
        includePredictiveAnalytics,
        includeIndonesianContext,
        alertThresholds: {
          churnRiskPercentage: churnRiskThreshold,
          revenueDrop: revenueDropThreshold,
          customerHealthDecline: 20, // Fixed threshold
        },
        segmentAnalysisDepth,
        historicalDataRange,
      };

      // Generate comprehensive dashboard
      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: dashboard,
        meta: {
          tenantId: user.tenantId,
          dashboardType: 'customer_business_intelligence',
          configuration,
          generatedAt: new Date().toISOString(),
          executionTime,
          dataFreshness: this.calculateDataFreshness(refreshFrequency),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate customer BI dashboard for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('executive-summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get executive summary of customer business intelligence',
    description:
      'Get high-level business insights for executive decision making including total customer value, health distribution, growth predictions, and top business opportunities',
  })
  @ApiQuery({
    name: 'includeIndonesianContext',
    required: false,
    description: 'Include Indonesian market context (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Executive summary generated successfully',
  })
  async getExecutiveSummary(
    @CurrentUser() user: any,
    @Query(
      'includeIndonesianContext',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeIndonesianContext: boolean,
  ): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['executiveSummary'];
    meta: {
      tenantId: string;
      summaryType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating executive summary for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: false, // Focus on current state for exec summary
        includeIndonesianContext,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'basic', // Faster for executive summary
        historicalDataRange: 6, // Last 6 months for exec view
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      return {
        success: true,
        data: dashboard.executiveSummary,
        meta: {
          tenantId: user.tenantId,
          summaryType: 'executive_customer_intelligence',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate executive summary for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('segment-performance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer segment performance analysis',
    description:
      'Get detailed analysis of customer segment performance including revenue, health scores, growth trends, and migration patterns',
  })
  @ApiQuery({
    name: 'analysisDepth',
    required: false,
    description: 'Depth of segment analysis (default: standard)',
    enum: ['basic', 'standard', 'comprehensive'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Segment performance analysis completed successfully',
  })
  async getSegmentPerformance(
    @CurrentUser() user: any,
    @Query('analysisDepth', new DefaultValuePipe('standard'))
    analysisDepth: 'basic' | 'standard' | 'comprehensive',
  ): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['customerSegmentPerformance'];
    meta: {
      tenantId: string;
      analysisType: string;
      analysisDepth: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating segment performance analysis for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: false,
        includeIndonesianContext: true,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: analysisDepth,
        historicalDataRange: 12,
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      return {
        success: true,
        data: dashboard.customerSegmentPerformance,
        meta: {
          tenantId: user.tenantId,
          analysisType: 'customer_segment_performance',
          analysisDepth,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate segment performance for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('behavioral-insights')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer behavioral insights',
    description:
      'Get advanced behavioral pattern analysis including purchase patterns, product affinity matrix, and channel effectiveness analysis',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavioral insights generated successfully',
  })
  async getBehavioralInsights(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['behavioralInsights'];
    meta: {
      tenantId: string;
      analysisType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating behavioral insights for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: false,
        includeIndonesianContext: true,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'standard',
        historicalDataRange: 12,
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      return {
        success: true,
        data: dashboard.behavioralInsights,
        meta: {
          tenantId: user.tenantId,
          analysisType: 'customer_behavioral_insights',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate behavioral insights for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('predictive-analytics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get predictive analytics for customer business intelligence',
    description:
      'Get forward-looking analytics including next month predictions, LTV forecasting, and seasonal business planning',
  })
  @ApiQuery({
    name: 'predictionHorizon',
    required: false,
    description: 'Prediction time horizon in months (default: 12)',
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Predictive analytics generated successfully',
  })
  async getPredictiveAnalytics(
    @CurrentUser() user: any,
    @Query('predictionHorizon', new DefaultValuePipe(12), ParseIntPipe)
    predictionHorizon: number,
  ): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['predictiveAnalytics'];
    meta: {
      tenantId: string;
      analysisType: string;
      predictionHorizon: number;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating predictive analytics for tenant ${user.tenantId}`,
    );

    try {
      if (predictionHorizon < 1 || predictionHorizon > 24) {
        throw new BadRequestException(
          'Prediction horizon must be between 1 and 24 months',
        );
      }

      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: true,
        includeIndonesianContext: true,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'standard',
        historicalDataRange: predictionHorizon,
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      return {
        success: true,
        data: dashboard.predictiveAnalytics,
        meta: {
          tenantId: user.tenantId,
          analysisType: 'customer_predictive_analytics',
          predictionHorizon,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate predictive analytics for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('operational-recommendations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get operational recommendations based on customer intelligence',
    description:
      'Get actionable business recommendations including high priority actions, marketing recommendations, and product development insights',
  })
  @ApiQuery({
    name: 'includeMarketingRecommendations',
    required: false,
    description: 'Include marketing recommendations (default: true)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'includeProductInsights',
    required: false,
    description: 'Include product development insights (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Operational recommendations generated successfully',
  })
  async getOperationalRecommendations(
    @CurrentUser() user: any,
    @Query(
      'includeMarketingRecommendations',
      new DefaultValuePipe(true),
      ParseBoolPipe,
    )
    includeMarketingRecommendations: boolean,
    @Query('includeProductInsights', new DefaultValuePipe(true), ParseBoolPipe)
    includeProductInsights: boolean,
  ): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['operationalRecommendations'];
    meta: {
      tenantId: string;
      analysisType: string;
      includedComponents: string[];
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating operational recommendations for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: true,
        includeIndonesianContext: true,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'comprehensive',
        historicalDataRange: 12,
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      const includedComponents: string[] = ['high_priority_actions'];
      if (includeMarketingRecommendations)
        includedComponents.push('marketing_recommendations');
      if (includeProductInsights)
        includedComponents.push('product_development_insights');

      return {
        success: true,
        data: dashboard.operationalRecommendations,
        meta: {
          tenantId: user.tenantId,
          analysisType: 'operational_recommendations',
          includedComponents,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate operational recommendations for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('performance-metrics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get comprehensive customer performance metrics',
    description:
      'Get business performance metrics including customer acquisition, retention, revenue optimization, and market positioning metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Performance metrics retrieved successfully',
  })
  async getPerformanceMetrics(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['performanceMetrics'];
    meta: {
      tenantId: string;
      analysisType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating performance metrics for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: false,
        includeIndonesianContext: true,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'standard',
        historicalDataRange: 12,
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      return {
        success: true,
        data: dashboard.performanceMetrics,
        meta: {
          tenantId: user.tenantId,
          analysisType: 'customer_performance_metrics',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate performance metrics for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('real-time-alerts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get real-time customer business alerts',
    description:
      'Get critical business alerts for immediate action including churn risk, revenue drops, and seasonal opportunities',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    description: 'Filter alerts by severity level',
    enum: ['critical', 'high', 'medium', 'low'],
  })
  @ApiQuery({
    name: 'includeSeasonalAlerts',
    required: false,
    description: 'Include Indonesian seasonal alerts (default: true)',
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Real-time alerts retrieved successfully',
  })
  async getRealTimeAlerts(
    @CurrentUser() user: any,
    @Query('severity') severity?: 'critical' | 'high' | 'medium' | 'low',
    @Query('includeSeasonalAlerts', new DefaultValuePipe(true), ParseBoolPipe)
    includeSeasonalAlerts: boolean = true,
  ): Promise<{
    success: boolean;
    data: CustomerBusinessIntelligenceDashboard['realTimeAlerts'];
    meta: {
      tenantId: string;
      alertType: string;
      severityFilter?: string;
      includeSeasonalAlerts: boolean;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating real-time alerts for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'real_time',
        includePredictiveAnalytics: false,
        includeIndonesianContext: includeSeasonalAlerts,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'basic', // Faster for real-time alerts
        historicalDataRange: 3, // Focus on recent data for alerts
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      // Filter alerts by severity if specified
      let alerts = dashboard.realTimeAlerts;
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      return {
        success: true,
        data: alerts,
        meta: {
          tenantId: user.tenantId,
          alertType: 'real_time_customer_alerts',
          severityFilter: severity,
          includeSeasonalAlerts,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate real-time alerts for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('customer-health-overview')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer health overview with distribution and trends',
    description:
      'Get overview of customer health distribution across all health score categories with trends and recommendations',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer health overview generated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            healthDistribution: {
              type: 'object',
              description: 'Distribution by health score categories',
              additionalProperties: { type: 'number' },
            },
            healthTrends: {
              type: 'object',
              properties: {
                improving: { type: 'number' },
                stable: { type: 'number' },
                declining: { type: 'number' },
              },
            },
            criticalCustomers: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                estimatedRevenueLoss: { type: 'number' },
                immediateActions: { type: 'array', items: { type: 'string' } },
              },
            },
            opportunityCustomers: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                growthPotential: { type: 'number' },
                recommendedActions: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            analysisType: {
              type: 'string',
              default: 'customer_health_overview',
            },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getCustomerHealthOverview(@CurrentUser() user: any): Promise<{
    success: boolean;
    data: {
      healthDistribution: Record<CustomerHealthScore, number>;
      healthTrends: {
        improving: number;
        stable: number;
        declining: number;
      };
      criticalCustomers: {
        count: number;
        estimatedRevenueLoss: number;
        immediateActions: string[];
      };
      opportunityCustomers: {
        count: number;
        growthPotential: number;
        recommendedActions: string[];
      };
    };
    meta: {
      tenantId: string;
      analysisType: string;
      generatedAt: string;
    };
  }> {
    this.logger.debug(
      `Generating customer health overview for tenant ${user.tenantId}`,
    );

    try {
      const configuration: CustomerBusinessIntelligenceConfiguration = {
        refreshFrequency: 'hourly',
        includePredictiveAnalytics: false,
        includeIndonesianContext: true,
        alertThresholds: {
          churnRiskPercentage: 70,
          revenueDrop: 15,
          customerHealthDecline: 20,
        },
        segmentAnalysisDepth: 'basic',
        historicalDataRange: 6,
      };

      const dashboard =
        await this.customerBusinessIntelligenceService.generateCustomerBusinessIntelligenceDashboard(
          user.tenantId,
          configuration,
        );

      // Extract health-related data from executive summary
      const healthDistribution =
        dashboard.executiveSummary.customerHealthDistribution;

      // Calculate health trends (mock implementation - would use historical data in real scenario)
      const totalCustomers = Object.values(healthDistribution).reduce(
        (sum, count) => sum + count,
        0,
      );
      const healthTrends = {
        improving: Math.round(totalCustomers * 0.25),
        stable: Math.round(totalCustomers * 0.6),
        declining: Math.round(totalCustomers * 0.15),
      };

      // Critical customers analysis
      const criticalCount =
        healthDistribution[CustomerHealthScore.CRITICAL] || 0;
      const criticalCustomers = {
        count: criticalCount,
        estimatedRevenueLoss: criticalCount * 2500000, // Average IDR per critical customer
        immediateActions: [
          'Immediate personal outreach by account manager',
          'Offer urgent retention incentives',
          'Conduct emergency satisfaction survey',
          'Expedite customer support resolution',
          'Consider special discount or loyalty program enrollment',
        ],
      };

      // Opportunity customers analysis
      const excellentCount =
        healthDistribution[CustomerHealthScore.EXCELLENT] || 0;
      const goodCount = healthDistribution[CustomerHealthScore.GOOD] || 0;
      const opportunityCount = excellentCount + goodCount;
      const opportunityCustomers = {
        count: opportunityCount,
        growthPotential: opportunityCount * 5000000, // Potential additional revenue
        recommendedActions: [
          'Identify upselling opportunities',
          'Introduce premium product lines',
          'Develop loyalty program benefits',
          'Request customer referrals',
          'Create VIP customer experiences',
        ],
      };

      return {
        success: true,
        data: {
          healthDistribution,
          healthTrends,
          criticalCustomers,
          opportunityCustomers,
        },
        meta: {
          tenantId: user.tenantId,
          analysisType: 'customer_health_overview',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate customer health overview for tenant ${user.tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private calculateDataFreshness(refreshFrequency: string): string {
    switch (refreshFrequency) {
      case 'real_time':
        return 'Real-time (updated continuously)';
      case 'hourly':
        return 'Hourly refresh (updated every hour)';
      case 'daily':
        return 'Daily refresh (updated once per day)';
      case 'weekly':
        return 'Weekly refresh (updated once per week)';
      default:
        return 'Unknown refresh frequency';
    }
  }
}
