import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
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
  CustomerMetricsCalculatorService,
  SimpleLTVMetrics,
  SimpleRetentionMetrics,
  SimpleChurnPrediction,
  SimpleCustomerScore,
} from '../services/customer-metrics-calculator.service';

// Type aliases for missing interfaces
type CustomerAOVAnalytics = {
  customerId: string;
  currentAOV: number;
  historicalAOV: {
    last30Days: number;
    last90Days: number;
    last12Months: number;
  };
  aovTrend: 'increasing' | 'stable' | 'decreasing';
  aovPercentile: number;
  recommendations: string[];
  indonesianContext: {
    seasonalAOVPattern: number;
    paymentMethodImpact: Record<string, number>;
    regionalComparison: number;
  };
};

type CohortLTVAnalysis = {
  analysisPeriod: {
    startDate: Date;
    endDate: Date;
    totalCustomers: number;
  };
  cohortMetrics: Array<{
    cohortMonth: string;
    customerCount: number;
    averageLTV: number;
    retentionRate: number;
    monthlyLTV: Array<{
      month: number;
      cumulativeLTV: number;
      incrementalLTV: number;
      retentionRate: number;
    }>;
  }>;
  ltvProjections: {
    projected12MonthLTV: number;
    projected24MonthLTV: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  };
  indonesianInsights: {
    ramadanCohortBoost: number;
    regionalLTVVariation: Record<string, number>;
    paymentMethodLTVImpact: Record<string, number>;
  };
  recommendations: string[];
};

@ApiTags('Customer Metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('customers/metrics')
export class CustomerMetricsController {
  private readonly logger = new Logger(CustomerMetricsController.name);

  constructor(
    private readonly customerMetricsCalculatorService: CustomerMetricsCalculatorService,
  ) {}

  @Get('ltv/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Calculate comprehensive customer lifetime value metrics',
    description:
      'Get detailed LTV analysis including historical, predictive, cohort-based, and segment comparisons',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer LTV metrics calculated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getCustomerLTVMetrics(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: SimpleLTVMetrics;
    meta: {
      customerId: string;
      tenantId: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Calculating LTV metrics for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const ltvMetrics =
        await this.customerMetricsCalculatorService.calculateCustomerLTV(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: ltvMetrics,
        meta: {
          customerId,
          tenantId: user.tenantId,
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate LTV metrics for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('retention/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Calculate customer retention metrics and lifecycle analysis',
    description:
      'Get comprehensive retention analysis including cohort retention, lifecycle stage, and retention probability',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer retention metrics calculated successfully',
  })
  async getCustomerRetentionMetrics(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: SimpleRetentionMetrics;
    meta: {
      customerId: string;
      tenantId: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Calculating retention metrics for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const retentionMetrics =
        await this.customerMetricsCalculatorService.calculateCustomerRetention(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: retentionMetrics,
        meta: {
          customerId,
          tenantId: user.tenantId,
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate retention metrics for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('churn-prediction/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Predict customer churn with detailed risk analysis',
    description:
      'Get comprehensive churn prediction including risk factors, behavioral indicators, and intervention recommendations',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer churn prediction calculated successfully',
  })
  async getCustomerChurnPrediction(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: SimpleChurnPrediction;
    meta: {
      customerId: string;
      tenantId: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Predicting churn for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const churnPrediction =
        await this.customerMetricsCalculatorService.predictCustomerChurn(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: churnPrediction,
        meta: {
          customerId,
          tenantId: user.tenantId,
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to predict churn for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('aov-analysis/:customerId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Analyze customer Average Order Value patterns and trends',
    description:
      'Get comprehensive AOV analysis including trends, category breakdown, channel comparison, and optimization potential',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer AOV analysis completed successfully',
  })
  async getCustomerAOVAnalysis(
    @CurrentUser() user: any,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{
    success: boolean;
    data: CustomerAOVAnalytics;
    meta: {
      customerId: string;
      tenantId: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Analyzing AOV for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const aovAnalysis =
        await this.customerMetricsCalculatorService.analyzeCustomerAOV(
          user.tenantId,
          customerId,
        );

      return {
        success: true,
        data: aovAnalysis,
        meta: {
          customerId,
          tenantId: user.tenantId,
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze AOV for customer ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('cohort-ltv-analysis')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Perform cohort LTV analysis for specified acquisition period',
    description:
      'Analyze LTV progression and projections for customers acquired in a specific time period',
  })
  @ApiQuery({
    name: 'cohortStartDate',
    required: true,
    description: 'Start date of cohort period (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'cohortEndDate',
    required: true,
    description: 'End date of cohort period (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort LTV analysis completed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid date parameters or no customers found in cohort period',
  })
  async getCohortLTVAnalysis(
    @CurrentUser() user: any,
    @Query('cohortStartDate') cohortStartDate: string,
    @Query('cohortEndDate') cohortEndDate: string,
  ): Promise<{
    success: boolean;
    data: CohortLTVAnalysis;
    meta: {
      tenantId: string;
      cohortPeriod: {
        startDate: string;
        endDate: string;
      };
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Performing cohort LTV analysis for period ${cohortStartDate} to ${cohortEndDate} for tenant ${user.tenantId}`,
    );

    try {
      // Validate date parameters
      const startDate = new Date(cohortStartDate);
      const endDate = new Date(cohortEndDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException(
          'Invalid date format. Use YYYY-MM-DD format.',
        );
      }

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date.');
      }

      const cohortAnalysis =
        await this.customerMetricsCalculatorService.performCohortLTVAnalysis(
          user.tenantId,
          startDate,
          endDate,
        );

      return {
        success: true,
        data: cohortAnalysis,
        meta: {
          tenantId: user.tenantId,
          cohortPeriod: {
            startDate: cohortStartDate,
            endDate: cohortEndDate,
          },
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to perform cohort LTV analysis: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('bulk-metrics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Calculate metrics for multiple customers in bulk',
    description:
      'Get basic metrics for multiple customers efficiently for dashboard or reporting purposes',
  })
  @ApiQuery({
    name: 'customerIds',
    required: true,
    description: 'Comma-separated list of customer IDs',
  })
  @ApiQuery({
    name: 'includeChurnPrediction',
    required: false,
    description: 'Include churn prediction (may slow down response)',
  })
  @ApiQuery({
    name: 'includeLTVMetrics',
    required: false,
    description: 'Include detailed LTV metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk customer metrics calculated successfully',
  })
  async getBulkCustomerMetrics(
    @CurrentUser() user: any,
    @Query('customerIds') customerIds: string,
    @Query('includeChurnPrediction', new DefaultValuePipe(false))
    includeChurnPrediction: boolean,
    @Query('includeLTVMetrics', new DefaultValuePipe(false))
    includeLTVMetrics: boolean,
  ): Promise<{
    success: boolean;
    data: Array<{
      customerId: string;
      basicMetrics: {
        ltvScore: number;
        retentionProbability: number;
        churnRiskScore?: number;
        lifecycleStage: string;
        currentAOV: number;
      };
      detailedMetrics?: {
        ltvMetrics?: SimpleLTVMetrics;
        churnPrediction?: SimpleChurnPrediction;
      };
    }>;
    meta: {
      tenantId: string;
      totalCustomers: number;
      includeChurnPrediction: boolean;
      includeLTVMetrics: boolean;
      calculatedAt: string;
      executionTime: number;
    };
  }> {
    const startTime = Date.now();
    this.logger.debug(
      `Calculating bulk metrics for customers: ${customerIds} for tenant ${user.tenantId}`,
    );

    try {
      const customerIdList = customerIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (customerIdList.length === 0) {
        throw new BadRequestException(
          'At least one customer ID must be provided.',
        );
      }

      if (customerIdList.length > 50) {
        throw new BadRequestException(
          'Maximum 50 customers can be processed in bulk.',
        );
      }

      // Validate UUID format for each customer ID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const invalidIds = customerIdList.filter(id => !uuidRegex.test(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Invalid customer IDs: ${invalidIds.join(', ')}`,
        );
      }

      const results = [];

      for (const customerId of customerIdList) {
        try {
          // Calculate basic metrics for all customers
          const retentionMetrics =
            await this.customerMetricsCalculatorService.calculateCustomerRetention(
              user.tenantId,
              customerId,
            );

          const aovAnalysis =
            await this.customerMetricsCalculatorService.analyzeCustomerAOV(
              user.tenantId,
              customerId,
            );

          const basicMetrics = {
            ltvScore: 0, // Will be filled if LTV metrics requested
            retentionProbability: retentionMetrics.retentionProbability,
            lifecycleStage: retentionMetrics.lifecycleStage,
            currentAOV: aovAnalysis.currentAOV,
            churnRiskScore: 0, // Will be filled if churn prediction requested
          };

          const detailedMetrics: any = {};

          // Include churn prediction if requested
          if (includeChurnPrediction) {
            const churnPrediction =
              await this.customerMetricsCalculatorService.predictCustomerChurn(
                user.tenantId,
                customerId,
              );
            basicMetrics.churnRiskScore = churnPrediction.churnRiskScore;
            detailedMetrics.churnPrediction = churnPrediction;
          }

          // Include detailed LTV metrics if requested
          if (includeLTVMetrics) {
            const ltvMetrics =
              await this.customerMetricsCalculatorService.calculateCustomerLTV(
                user.tenantId,
                customerId,
              );
            basicMetrics.ltvScore = ltvMetrics.ltvScore;
            detailedMetrics.ltvMetrics = ltvMetrics;
          }

          results.push({
            customerId,
            basicMetrics,
            detailedMetrics:
              Object.keys(detailedMetrics).length > 0
                ? detailedMetrics
                : undefined,
          });
        } catch (customerError) {
          this.logger.warn(
            `Failed to calculate metrics for customer ${customerId}: ${customerError.message}`,
          );
          // Continue with other customers
          results.push({
            customerId,
            basicMetrics: {
              ltvScore: 0,
              retentionProbability: 0,
              lifecycleStage: 'unknown',
              currentAOV: 0,
            },
            error: customerError.message,
          });
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: results,
        meta: {
          tenantId: user.tenantId,
          totalCustomers: customerIdList.length,
          includeChurnPrediction,
          includeLTVMetrics,
          calculatedAt: new Date().toISOString(),
          executionTime,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate bulk customer metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('performance-summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer metrics performance summary',
    description:
      'Get aggregated performance summary of customer metrics across the tenant',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to include in analysis (default: 30)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer metrics performance summary retrieved successfully',
  })
  async getCustomerMetricsPerformanceSummary(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<{
    success: boolean;
    data: {
      totalCustomers: number;
      averageLTV: number;
      averageRetentionRate: number;
      highRiskCustomers: number;
      topPerformingSegment: string;
      ltvDistribution: {
        low: number; // 0-25th percentile
        medium: number; // 25-75th percentile
        high: number; // 75-95th percentile
        vip: number; // 95th+ percentile
      };
      churnRiskDistribution: {
        low: number; // 0-40% risk
        medium: number; // 40-70% risk
        high: number; // 70-90% risk
        critical: number; // 90%+ risk
      };
      aovTrends: {
        increasing: number;
        stable: number;
        decreasing: number;
      };
      lifecycleDistribution: {
        new: number;
        growing: number;
        mature: number;
        declining: number;
        dormant: number;
      };
    };
    meta: {
      tenantId: string;
      analysisPeriod: string;
      calculatedAt: string;
    };
  }> {
    this.logger.debug(
      `Getting customer metrics performance summary for tenant ${user.tenantId} (${days} days)`,
    );

    try {
      // This would be a complex aggregation query
      // For now, return a structured response - in real implementation,
      // this would query the customer analytics summary views
      const summary = {
        totalCustomers: 0,
        averageLTV: 0,
        averageRetentionRate: 0,
        highRiskCustomers: 0,
        topPerformingSegment: 'high_value',
        ltvDistribution: { low: 0, medium: 0, high: 0, vip: 0 },
        churnRiskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
        aovTrends: { increasing: 0, stable: 0, decreasing: 0 },
        lifecycleDistribution: {
          new: 0,
          growing: 0,
          mature: 0,
          declining: 0,
          dormant: 0,
        },
      };

      // TODO: Implement actual aggregation queries
      this.logger.warn(
        'Customer metrics performance summary is not yet fully implemented',
      );

      return {
        success: true,
        data: summary,
        meta: {
          tenantId: user.tenantId,
          analysisPeriod: `${days} days`,
          calculatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer metrics performance summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
