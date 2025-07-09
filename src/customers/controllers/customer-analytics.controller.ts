import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  ParseArrayPipe,
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
  CustomerAnalyticsService,
  CustomerInsightsQuery,
} from '../services/customer-analytics.service';

@ApiTags('Customer Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('customers/analytics')
export class CustomerAnalyticsController {
  private readonly logger = new Logger(CustomerAnalyticsController.name);

  constructor(
    private readonly customerAnalyticsService: CustomerAnalyticsService,
  ) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer analytics summary',
    description:
      'Get paginated customer analytics with advanced filtering and insights',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({
    name: 'segment',
    required: false,
    description: 'Filter by segments',
  })
  @ApiQuery({
    name: 'valueSegment',
    required: false,
    description: 'Filter by value segments',
  })
  @ApiQuery({
    name: 'churnRiskMin',
    required: false,
    description: 'Minimum churn risk score',
  })
  @ApiQuery({
    name: 'churnRiskMax',
    required: false,
    description: 'Maximum churn risk score',
  })
  @ApiQuery({
    name: 'transactionFrequencyMin',
    required: false,
    description: 'Minimum monthly transaction frequency',
  })
  @ApiQuery({
    name: 'daysSinceLastTransactionMax',
    required: false,
    description: 'Maximum days since last transaction',
  })
  @ApiQuery({
    name: 'totalSpentMin',
    required: false,
    description: 'Minimum total spent',
  })
  @ApiQuery({
    name: 'totalSpentMax',
    required: false,
    description: 'Maximum total spent',
  })
  @ApiQuery({
    name: 'primaryChannel',
    required: false,
    description: 'Filter by primary channels',
  })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field' })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (ASC/DESC)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer analytics retrieved successfully',
  })
  async getCustomerAnalyticsSummary(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('segment', new DefaultValuePipe([]), ParseArrayPipe)
    segment: string[],
    @Query('valueSegment', new DefaultValuePipe([]), ParseArrayPipe)
    valueSegment: string[],
    @Query('churnRiskMin') churnRiskMin?: number,
    @Query('churnRiskMax') churnRiskMax?: number,
    @Query('transactionFrequencyMin') transactionFrequencyMin?: number,
    @Query('daysSinceLastTransactionMax') daysSinceLastTransactionMax?: number,
    @Query('totalSpentMin') totalSpentMin?: number,
    @Query('totalSpentMax') totalSpentMax?: number,
    @Query('primaryChannel', new DefaultValuePipe([]), ParseArrayPipe)
    primaryChannel?: string[],
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    this.logger.debug(
      `Getting customer analytics summary for tenant ${user.tenantId}`,
    );

    try {
      const query: CustomerInsightsQuery = {
        limit,
        offset: (page - 1) * limit,
        segment: segment.length > 0 ? segment : undefined,
        valueSegment: valueSegment.length > 0 ? valueSegment : undefined,
        churnRiskMin,
        churnRiskMax,
        transactionFrequencyMin,
        daysSinceLastTransactionMax,
        totalSpentMin,
        totalSpentMax,
        primaryChannel: primaryChannel.length > 0 ? primaryChannel : undefined,
        sortBy,
        sortOrder,
      };

      const result =
        await this.customerAnalyticsService.getCustomerAnalyticsList(
          user.tenantId,
          query,
        );

      return {
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
        summary: result.summary,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer analytics summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('customer/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get individual customer analytics',
    description: 'Get comprehensive analytics for a specific customer',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer analytics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getIndividualCustomerAnalytics(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) customerId: string,
  ) {
    this.logger.debug(
      `Getting analytics for customer ${customerId} for tenant ${user.tenantId}`,
    );

    try {
      const customerAnalytics =
        await this.customerAnalyticsService.getCustomerAnalyticsSummary(
          user.tenantId,
          customerId,
        );

      const productAffinity =
        await this.customerAnalyticsService.getCustomerProductAffinity(
          user.tenantId,
          customerId,
          10, // Top 10 categories
        );

      const dailyMetrics =
        await this.customerAnalyticsService.getDailyCustomerMetrics(
          user.tenantId,
          customerId,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          new Date(),
        );

      return {
        success: true,
        data: {
          summary: customerAnalytics,
          productAffinity,
          dailyMetrics,
        },
        meta: {
          customerId,
          tenantId: user.tenantId,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get customer analytics for ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('cohort-analysis')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer cohort analysis',
    description: 'Analyze customer retention and revenue by cohort',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for cohort analysis',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for cohort analysis',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cohort analysis retrieved successfully',
  })
  async getCohortAnalysis(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.debug(`Getting cohort analysis for tenant ${user.tenantId}`);

    try {
      const cohortAnalysis =
        await this.customerAnalyticsService.getCustomerCohortAnalysis(
          user.tenantId,
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined,
        );

      // Calculate overall retention metrics
      const overallMetrics = cohortAnalysis.reduce(
        (acc, cohort) => {
          acc.totalCohorts++;
          acc.totalCustomers += cohort.cohortSize;
          acc.avgMonth1Retention += cohort.month1RetentionRate;
          acc.avgMonth3Retention += cohort.month3RetentionRate;
          acc.avgMonth6Retention += cohort.month6RetentionRate;
          acc.avgMonth12Retention += cohort.month12RetentionRate;
          return acc;
        },
        {
          totalCohorts: 0,
          totalCustomers: 0,
          avgMonth1Retention: 0,
          avgMonth3Retention: 0,
          avgMonth6Retention: 0,
          avgMonth12Retention: 0,
        },
      );

      if (overallMetrics.totalCohorts > 0) {
        overallMetrics.avgMonth1Retention /= overallMetrics.totalCohorts;
        overallMetrics.avgMonth3Retention /= overallMetrics.totalCohorts;
        overallMetrics.avgMonth6Retention /= overallMetrics.totalCohorts;
        overallMetrics.avgMonth12Retention /= overallMetrics.totalCohorts;
      }

      return {
        success: true,
        data: cohortAnalysis,
        summary: overallMetrics,
        meta: {
          tenantId: user.tenantId,
          dateRange: {
            startDate,
            endDate,
          },
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cohort analysis: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('product-affinity')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer product affinity analysis',
    description: 'Analyze customer preferences and product affinity patterns',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    description: 'Specific customer ID',
  })
  @ApiQuery({
    name: 'topCategories',
    required: false,
    description: 'Number of top categories to return',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product affinity analysis retrieved successfully',
  })
  async getProductAffinityAnalysis(
    @CurrentUser() user: any,
    @Query('customerId') customerId?: string,
    @Query('topCategories', new DefaultValuePipe(20), ParseIntPipe)
    categoryLimit?: number,
  ) {
    this.logger.debug(
      `Getting product affinity analysis for tenant ${user.tenantId}`,
    );

    try {
      const affinityData =
        await this.customerAnalyticsService.getCustomerProductAffinity(
          user.tenantId,
          customerId,
          categoryLimit,
        );

      // Calculate summary statistics
      const categoryStats = affinityData.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = {
            category: item.category,
            totalCustomers: 0,
            totalSpent: 0,
            avgFrequency: 0,
            avgShareOfWallet: 0,
          };
        }

        acc[item.category].totalCustomers++;
        acc[item.category].totalSpent += item.totalSpentCategory;
        acc[item.category].avgFrequency += item.monthlyPurchaseFrequency;
        acc[item.category].avgShareOfWallet += item.categoryShareOfWallet;

        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      Object.values(categoryStats).forEach((stat: any) => {
        stat.avgFrequency /= stat.totalCustomers;
        stat.avgShareOfWallet /= stat.totalCustomers;
      });

      const topCategories = Object.values(categoryStats)
        .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      return {
        success: true,
        data: affinityData,
        summary: {
          totalCategories: Object.keys(categoryStats).length,
          topCategories,
        },
        meta: {
          customerId,
          tenantId: user.tenantId,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get product affinity analysis: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('daily-metrics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get daily customer metrics',
    description: 'Get aggregated daily customer transaction metrics',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    description: 'Specific customer ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for metrics',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daily metrics retrieved successfully',
  })
  async getDailyCustomerMetrics(
    @CurrentUser() user: any,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.debug(
      `Getting daily customer metrics for tenant ${user.tenantId}`,
    );

    try {
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const defaultEndDate = new Date();

      const dailyMetrics =
        await this.customerAnalyticsService.getDailyCustomerMetrics(
          user.tenantId,
          customerId,
          startDate ? new Date(startDate) : defaultStartDate,
          endDate ? new Date(endDate) : defaultEndDate,
        );

      // Calculate summary statistics
      const summary = dailyMetrics.reduce(
        (acc, day) => {
          acc.totalDays++;
          acc.totalTransactions += day.transactionCount;
          acc.totalRevenue += day.dailyTotal;
          acc.avgDailyRevenue += day.dailyTotal;
          acc.maxDailyRevenue = Math.max(acc.maxDailyRevenue, day.dailyTotal);
          acc.totalQuantity += day.totalQuantity;
          return acc;
        },
        {
          totalDays: 0,
          totalTransactions: 0,
          totalRevenue: 0,
          avgDailyRevenue: 0,
          maxDailyRevenue: 0,
          totalQuantity: 0,
        },
      );

      if (summary.totalDays > 0) {
        summary.avgDailyRevenue /= summary.totalDays;
      }

      return {
        success: true,
        data: dailyMetrics,
        summary,
        meta: {
          customerId,
          dateRange: {
            startDate: startDate || defaultStartDate.toISOString(),
            endDate: endDate || defaultEndDate.toISOString(),
          },
          tenantId: user.tenantId,
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get daily customer metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('refresh')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh analytics views',
    description:
      'Manually trigger refresh of customer analytics materialized views',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics views refresh initiated successfully',
  })
  async refreshAnalyticsViews(@CurrentUser() user: any) {
    this.logger.log(
      `Manual analytics refresh triggered by user ${user.userId} for tenant ${user.tenantId}`,
    );

    try {
      const result =
        await this.customerAnalyticsService.refreshAnalyticsViews();

      return {
        success: result.success,
        message: result.message,
        data: {
          refreshedViews: result.refreshedViews,
          duration: result.duration,
        },
        meta: {
          triggeredBy: user.userId,
          tenantId: user.tenantId,
          refreshedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh analytics views: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get analytics views health status',
    description: 'Check the health and freshness of customer analytics views',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics health status retrieved successfully',
  })
  async getAnalyticsHealth(@CurrentUser() user: any) {
    this.logger.debug(
      `Getting analytics health status for tenant ${user.tenantId}`,
    );

    try {
      const health =
        await this.customerAnalyticsService.getAnalyticsViewsHealth(
          user.tenantId,
        );

      return {
        success: true,
        data: health,
        meta: {
          tenantId: user.tenantId,
          checkedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get analytics health: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('insights/high-value')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get high-value customer insights',
    description: 'Get insights and recommendations for high-value customers',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'High-value customer insights retrieved successfully',
  })
  async getHighValueCustomerInsights(@CurrentUser() user: any) {
    this.logger.debug(
      `Getting high-value customer insights for tenant ${user.tenantId}`,
    );

    try {
      const highValueCustomers =
        await this.customerAnalyticsService.getCustomerAnalyticsList(
          user.tenantId,
          {
            valueSegment: ['high_value'],
            sortBy: 'totalSpent',
            sortOrder: 'DESC',
            limit: 50,
          },
        );

      // Calculate insights
      const insights = {
        totalHighValueCustomers: highValueCustomers.total,
        revenueContribution: highValueCustomers.data.reduce(
          (sum, c) => sum + c.totalSpent,
          0,
        ),
        avgTransactionFrequency:
          highValueCustomers.data.reduce(
            (sum, c) => sum + c.monthlyTransactionFrequency,
            0,
          ) / Math.max(1, highValueCustomers.data.length),
        topChannels: this.aggregateChannels(highValueCustomers.data),
        atRiskCount: highValueCustomers.data.filter(c => c.churnRiskScore >= 70)
          .length,
        recommendations: this.generateHighValueRecommendations(
          highValueCustomers.data,
        ),
      };

      return {
        success: true,
        data: {
          customers: highValueCustomers.data,
          insights,
        },
        meta: {
          tenantId: user.tenantId,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get high-value customer insights: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('insights/at-risk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get at-risk customer insights',
    description:
      'Get insights and recommendations for customers at risk of churning',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'At-risk customer insights retrieved successfully',
  })
  async getAtRiskCustomerInsights(@CurrentUser() user: any) {
    this.logger.debug(
      `Getting at-risk customer insights for tenant ${user.tenantId}`,
    );

    try {
      const atRiskCustomers =
        await this.customerAnalyticsService.getCustomerAnalyticsList(
          user.tenantId,
          {
            churnRiskMin: 70,
            sortBy: 'churnRiskScore',
            sortOrder: 'DESC',
            limit: 100,
          },
        );

      // Calculate insights
      const insights = {
        totalAtRiskCustomers: atRiskCustomers.total,
        potentialLostRevenue: atRiskCustomers.data.reduce(
          (sum, c) => sum + c.totalSpent,
          0,
        ),
        avgDaysSinceLastTransaction:
          atRiskCustomers.data.reduce(
            (sum, c) => sum + c.daysSinceLastTransaction,
            0,
          ) / Math.max(1, atRiskCustomers.data.length),
        highValueAtRisk: atRiskCustomers.data.filter(
          c => c.valueSegment === 'high_value',
        ).length,
        recommendations: this.generateAtRiskRecommendations(
          atRiskCustomers.data,
        ),
      };

      return {
        success: true,
        data: {
          customers: atRiskCustomers.data,
          insights,
        },
        meta: {
          tenantId: user.tenantId,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get at-risk customer insights: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Private helper methods

  private aggregateChannels(
    customers: any[],
  ): Array<{ channel: string; count: number; revenue: number }> {
    const channelMap = new Map<string, { count: number; revenue: number }>();

    customers.forEach(customer => {
      if (customer.primaryChannel) {
        const existing = channelMap.get(customer.primaryChannel) || {
          count: 0,
          revenue: 0,
        };
        existing.count++;
        existing.revenue += customer.totalSpent;
        channelMap.set(customer.primaryChannel, existing);
      }
    });

    return Array.from(channelMap.entries())
      .map(([channel, data]) => ({ channel, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private generateHighValueRecommendations(customers: any[]): string[] {
    const recommendations = [];

    const atRiskHighValue = customers.filter(c => c.churnRiskScore >= 70);
    if (atRiskHighValue.length > 0) {
      recommendations.push(
        `${atRiskHighValue.length} high-value customers are at risk - implement retention campaigns`,
      );
    }

    const lowFrequency = customers.filter(
      c => c.monthlyTransactionFrequency < 1,
    );
    if (lowFrequency.length > customers.length * 0.3) {
      recommendations.push(
        '30%+ high-value customers have low transaction frequency - consider engagement programs',
      );
    }

    const longTimeSinceLastTransaction = customers.filter(
      c => c.daysSinceLastTransaction > 60,
    );
    if (longTimeSinceLastTransaction.length > 0) {
      recommendations.push(
        `${longTimeSinceLastTransaction.length} high-value customers haven't transacted in 60+ days`,
      );
    }

    return recommendations;
  }

  private generateAtRiskRecommendations(customers: any[]): string[] {
    const recommendations = [];

    const veryHighRisk = customers.filter(c => c.churnRiskScore >= 90);
    if (veryHighRisk.length > 0) {
      recommendations.push(
        `${veryHighRisk.length} customers have 90%+ churn risk - immediate intervention needed`,
      );
    }

    const longInactive = customers.filter(
      c => c.daysSinceLastTransaction > 180,
    );
    if (longInactive.length > 0) {
      recommendations.push(
        `${longInactive.length} customers inactive for 180+ days - consider win-back campaigns`,
      );
    }

    const lowEngagement = customers.filter(
      c => c.monthlyTransactionFrequency < 0.5,
    );
    if (lowEngagement.length > customers.length * 0.5) {
      recommendations.push(
        '50%+ at-risk customers have very low engagement - review product-market fit',
      );
    }

    return recommendations;
  }
}
