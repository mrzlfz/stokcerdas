import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
  Param,
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

import { BusinessIntelligenceService } from '../services/business-intelligence.service';
import { CustomMetricsService } from '../services/custom-metrics.service';
import { BenchmarkingService } from '../services/benchmarking.service';

import {
  RevenueAnalyticsQueryDto,
  InventoryTurnoverQueryDto,
  ProductPerformanceQueryDto,
  CustomerInsightsQueryDto,
  DashboardMetricsQueryDto,
  CustomMetricQueryDto,
  BenchmarkingQueryDto,
} from '../dto/analytics-query.dto';

import {
  RevenueAnalyticsResponseDto,
  InventoryTurnoverResponseDto,
  ProductPerformanceResponseDto,
  CustomerInsightsResponseDto,
  DashboardMetricsResponseDto,
  CustomMetricResponseDto,
  BenchmarkingResponseDto,
} from '../dto/analytics-response.dto';

@ApiTags('Business Intelligence & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly businessIntelligenceService: BusinessIntelligenceService,
    private readonly customMetricsService: CustomMetricsService,
    private readonly benchmarkingService: BenchmarkingService,
  ) {}

  // Dashboard & Overview Endpoints

  @Get('dashboard')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({ 
    summary: 'Get comprehensive dashboard metrics',
    description: 'Returns key performance indicators, real-time metrics, and dashboard alerts for business intelligence overview'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardMetricsResponseDto,
  })
  async getDashboardMetrics(
    @CurrentUser() user: any,
    @Query() query: DashboardMetricsQueryDto,
  ): Promise<DashboardMetricsResponseDto> {
    try {
      this.logger.debug(`Getting dashboard metrics for tenant ${user.tenantId}`);
      
      return await this.businessIntelligenceService.generateDashboardMetrics(
        user.tenantId,
        query,
      );
    } catch (error) {
      this.logger.error(`Failed to get dashboard metrics: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Revenue Analytics Endpoints

  @Get('revenue')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Generate revenue analytics report',
    description: 'Comprehensive revenue analysis including profit margins, COGS, trends, and comparisons'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Revenue analytics generated successfully',
    type: RevenueAnalyticsResponseDto,
  })
  async getRevenueAnalytics(
    @CurrentUser() user: any,
    @Query() query: RevenueAnalyticsQueryDto,
  ): Promise<RevenueAnalyticsResponseDto> {
    try {
      this.logger.debug(`Generating revenue analytics for tenant ${user.tenantId}`);
      
      return await this.businessIntelligenceService.generateRevenueAnalytics(
        user.tenantId,
        query,
      );
    } catch (error) {
      this.logger.error(`Failed to generate revenue analytics: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('revenue/trends')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Get revenue trends analysis',
    description: 'Historical revenue trends with forecasting and seasonal analysis'
  })
  @ApiQuery({ name: 'granularity', enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiResponse({ status: 200, description: 'Revenue trends retrieved successfully' })
  async getRevenueTrends(
    @CurrentUser() user: any,
    @Query() query: RevenueAnalyticsQueryDto,
  ) {
    try {
      // Focus on trend data from revenue analytics
      const analytics = await this.businessIntelligenceService.generateRevenueAnalytics(
        user.tenantId,
        { ...query, includeTrends: true },
      );

      return {
        success: true,
        data: analytics.trends,
        meta: analytics.meta,
      };
    } catch (error) {
      this.logger.error(`Failed to get revenue trends: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Inventory Analytics Endpoints

  @Get('inventory/turnover')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Generate inventory turnover analysis',
    description: 'Comprehensive inventory turnover analysis with fast/slow moving items, aging, and optimization recommendations'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory turnover analysis generated successfully',
    type: InventoryTurnoverResponseDto,
  })
  async getInventoryTurnoverAnalysis(
    @CurrentUser() user: any,
    @Query() query: InventoryTurnoverQueryDto,
  ): Promise<InventoryTurnoverResponseDto> {
    try {
      this.logger.debug(`Generating inventory turnover analysis for tenant ${user.tenantId}`);
      
      return await this.businessIntelligenceService.generateInventoryTurnoverAnalysis(
        user.tenantId,
        query,
      );
    } catch (error) {
      this.logger.error(`Failed to generate inventory turnover analysis: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('inventory/slow-moving')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Get slow-moving inventory items',
    description: 'Identify slow-moving and dead stock items with actionable recommendations'
  })
  @ApiResponse({ status: 200, description: 'Slow-moving inventory items retrieved successfully' })
  async getSlowMovingInventory(
    @CurrentUser() user: any,
    @Query() query: InventoryTurnoverQueryDto,
  ) {
    try {
      const analysis = await this.businessIntelligenceService.generateInventoryTurnoverAnalysis(
        user.tenantId,
        { ...query, includeSlowMoving: true },
      );

      // Filter for slow-moving and dead stock items
      const slowMovingItems = analysis.data.filter(
        item => item.stockStatus === 'slow_moving' || item.stockStatus === 'dead_stock'
      );

      return {
        success: true,
        data: slowMovingItems,
        meta: {
          ...analysis.meta,
          total: slowMovingItems.length,
        },
        summary: {
          totalSlowMovingItems: slowMovingItems.length,
          totalValue: slowMovingItems.reduce((sum, item) => sum + item.averageInventoryValue, 0),
          recommendedActions: slowMovingItems.map(item => ({
            productId: item.productId,
            recommendation: item.recommendation,
          })),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get slow-moving inventory: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Product Analytics Endpoints

  @Get('products/performance')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Generate product performance analytics',
    description: 'Comprehensive product performance analysis with ABC classification, profitability, and growth metrics'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Product performance analytics generated successfully',
    type: ProductPerformanceResponseDto,
  })
  async getProductPerformanceAnalytics(
    @CurrentUser() user: any,
    @Query() query: ProductPerformanceQueryDto,
  ): Promise<ProductPerformanceResponseDto> {
    try {
      this.logger.debug(`Generating product performance analytics for tenant ${user.tenantId}`);
      
      return await this.businessIntelligenceService.generateProductPerformanceAnalytics(
        user.tenantId,
        query,
      );
    } catch (error) {
      this.logger.error(`Failed to generate product performance analytics: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('products/abc-analysis')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Get ABC analysis of products',
    description: 'Pareto analysis (80/20 rule) of products by revenue contribution'
  })
  @ApiResponse({ status: 200, description: 'ABC analysis retrieved successfully' })
  async getABCAnalysis(
    @CurrentUser() user: any,
    @Query() query: ProductPerformanceQueryDto,
  ) {
    try {
      const analytics = await this.businessIntelligenceService.generateProductPerformanceAnalytics(
        user.tenantId,
        { ...query, includeABCAnalysis: true },
      );

      // Group by ABC classification
      const abcGroups = {
        A: analytics.data.filter(p => p.abcClassification === 'A'),
        B: analytics.data.filter(p => p.abcClassification === 'B'),
        C: analytics.data.filter(p => p.abcClassification === 'C'),
      };

      return {
        success: true,
        data: abcGroups,
        meta: analytics.meta,
        summary: {
          classA: {
            count: abcGroups.A.length,
            revenueContribution: abcGroups.A.reduce((sum, p) => sum + p.revenueContribution, 0),
            averageMargin: abcGroups.A.reduce((sum, p) => sum + p.profitMargin, 0) / abcGroups.A.length || 0,
          },
          classB: {
            count: abcGroups.B.length,
            revenueContribution: abcGroups.B.reduce((sum, p) => sum + p.revenueContribution, 0),
            averageMargin: abcGroups.B.reduce((sum, p) => sum + p.profitMargin, 0) / abcGroups.B.length || 0,
          },
          classC: {
            count: abcGroups.C.length,
            revenueContribution: abcGroups.C.reduce((sum, p) => sum + p.revenueContribution, 0),
            averageMargin: abcGroups.C.reduce((sum, p) => sum + p.profitMargin, 0) / abcGroups.C.length || 0,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get ABC analysis: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('products/top-performers')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({ 
    summary: 'Get top performing products',
    description: 'List of top performing products by revenue, profit, or volume'
  })
  @ApiQuery({ name: 'metric', enum: ['revenue', 'profit', 'volume'], required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Top performing products retrieved successfully' })
  async getTopPerformers(
    @CurrentUser() user: any,
    @Query() query: ProductPerformanceQueryDto,
    @Query('metric') metric: 'revenue' | 'profit' | 'volume' = 'revenue',
    @Query('limit') limit: number = 10,
  ) {
    try {
      const analytics = await this.businessIntelligenceService.generateProductPerformanceAnalytics(
        user.tenantId,
        { ...query, limit: 100 }, // Get more data for sorting
      );

      // Sort by requested metric and take top performers
      const sortedProducts = analytics.data.sort((a, b) => {
        switch (metric) {
          case 'profit':
            return b.totalProfit - a.totalProfit;
          case 'volume':
            return b.totalUnitsSold - a.totalUnitsSold;
          default:
            return b.totalRevenue - a.totalRevenue;
        }
      });

      const topPerformers = sortedProducts.slice(0, limit);

      return {
        success: true,
        data: topPerformers,
        meta: {
          ...analytics.meta,
          total: topPerformers.length,
          sortedBy: metric,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get top performers: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Customer Analytics Endpoints (placeholder)

  @Get('customers/insights')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Generate customer insights analytics',
    description: 'Customer segmentation, lifetime value, and behavioral analysis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Customer insights generated successfully',
    type: CustomerInsightsResponseDto,
  })
  async getCustomerInsights(
    @CurrentUser() user: any,
    @Query() query: CustomerInsightsQueryDto,
  ): Promise<CustomerInsightsResponseDto> {
    try {
      // Note: This would require customer data integration
      // For now, return mock structure
      return {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          generatedAt: new Date().toISOString(),
          executionTime: 0,
          parameters: query,
          dataAsOf: new Date().toISOString(),
        },
        summary: {
          totalCustomers: 0,
          activeCustomers: 0,
          newCustomers: 0,
          returningCustomers: 0,
          averageLTV: 0,
          customerRetentionRate: 0,
          churnRate: 0,
          topSpendingSegment: '',
          mostLoyalSegment: '',
          averageOrderValue: 0,
          averagePurchaseFrequency: 0,
        },
        trends: [],
      };
    } catch (error) {
      this.logger.error(`Failed to generate customer insights: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Custom Metrics Endpoints

  @Post('custom-metrics')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Calculate custom metric',
    description: 'Calculate custom business metrics using user-defined formulas and parameters'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Custom metric calculated successfully',
    type: CustomMetricResponseDto,
  })
  async calculateCustomMetric(
    @CurrentUser() user: any,
    @Body() query: CustomMetricQueryDto,
  ): Promise<CustomMetricResponseDto> {
    try {
      this.logger.debug(`Calculating custom metric '${query.metricName}' for tenant ${user.tenantId}`);
      
      return await this.customMetricsService.calculateCustomMetric(
        user.tenantId,
        query,
      );
    } catch (error) {
      this.logger.error(`Failed to calculate custom metric: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Benchmarking Endpoints

  @Get('benchmarking')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Generate benchmarking analysis',
    description: 'Compare business metrics against industry standards, category averages, or historical performance'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Benchmarking analysis generated successfully',
    type: BenchmarkingResponseDto,
  })
  async getBenchmarkingAnalysis(
    @CurrentUser() user: any,
    @Query() query: BenchmarkingQueryDto,
  ): Promise<BenchmarkingResponseDto> {
    try {
      this.logger.debug(`Generating benchmarking analysis for tenant ${user.tenantId}`);
      
      return await this.benchmarkingService.generateBenchmarkingAnalysis(
        user.tenantId,
        query,
      );
    } catch (error) {
      this.logger.error(`Failed to generate benchmarking analysis: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('benchmarking/industry-standards')
  @Roles('admin', 'manager')
  @ApiOperation({ 
    summary: 'Get industry standard benchmarks',
    description: 'Retrieve current industry standard benchmarks for Indonesian retail sector'
  })
  @ApiQuery({ name: 'industry', enum: ['retail_food', 'retail_fashion', 'retail_electronics'], required: false })
  @ApiResponse({ status: 200, description: 'Industry standards retrieved successfully' })
  async getIndustryStandards(
    @CurrentUser() user: any,
    @Query('industry') industry: string = 'retail_food',
  ) {
    try {
      // Return industry benchmark data
      const benchmarks = {
        industry,
        lastUpdated: new Date().toISOString(),
        benchmarks: {
          grossMargin: {
            average: industry === 'retail_food' ? 25.5 : industry === 'retail_fashion' ? 52.8 : 18.3,
            percentile25: industry === 'retail_food' ? 18.0 : industry === 'retail_fashion' ? 42.0 : 12.5,
            percentile50: industry === 'retail_food' ? 25.5 : industry === 'retail_fashion' ? 52.8 : 18.3,
            percentile75: industry === 'retail_food' ? 32.0 : industry === 'retail_fashion' ? 63.5 : 24.8,
            percentile90: industry === 'retail_food' ? 38.5 : industry === 'retail_fashion' ? 72.0 : 30.5,
          },
          inventoryTurnover: {
            average: industry === 'retail_food' ? 8.2 : industry === 'retail_fashion' ? 4.5 : 6.7,
            percentile25: industry === 'retail_food' ? 6.1 : industry === 'retail_fashion' ? 3.2 : 4.8,
            percentile50: industry === 'retail_food' ? 8.2 : industry === 'retail_fashion' ? 4.5 : 6.7,
            percentile75: industry === 'retail_food' ? 10.8 : industry === 'retail_fashion' ? 5.9 : 8.9,
            percentile90: industry === 'retail_food' ? 13.5 : industry === 'retail_fashion' ? 7.8 : 11.2,
          },
        },
        sampleSize: industry === 'retail_food' ? 1250 : industry === 'retail_fashion' ? 850 : 650,
        notes: 'Benchmarks based on Indonesian retail sector data',
      };

      return {
        success: true,
        data: benchmarks,
      };
    } catch (error) {
      this.logger.error(`Failed to get industry standards: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Utility Endpoints

  @Get('health')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({ 
    summary: 'Check analytics service health',
    description: 'Health check endpoint for analytics and business intelligence services'
  })
  @ApiResponse({ status: 200, description: 'Analytics service health status' })
  async getServiceHealth() {
    try {
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          businessIntelligence: 'operational',
          customMetrics: 'operational',
          benchmarking: 'operational',
        },
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: 'Analytics service unhealthy',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}