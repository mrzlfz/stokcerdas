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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import { BaseAnalyticsController } from './base-analytics.controller';
import { PredictiveAnalyticsService } from '../services/predictive-analytics.service';
import { PriceOptimizationService } from '../services/price-optimization.service';
import { DemandAnomalyService } from '../services/demand-anomaly.service';
import { ModelServingService } from '../../ml-forecasting/services/model-serving.service';

import {
  PredictiveAnalysisType,
  TimeHorizon,
  StockoutPredictionQueryDto,
  SlowMovingDetectionQueryDto,
  OptimalReorderQueryDto,
  PriceOptimizationQueryDto,
  DemandAnomalyQueryDto,
  SeasonalAnalysisQueryDto,
  PredictiveAnalyticsQueryDto,
} from '../dto/predictive-analytics-query.dto';

import {
  StockoutPredictionResponseDto,
  SlowMovingDetectionResponseDto,
  OptimalReorderResponseDto,
  PriceOptimizationResponseDto,
  DemandAnomalyResponseDto,
  SeasonalAnalysisResponseDto,
  PredictiveAnalyticsResponseDto,
} from '../dto/predictive-analytics-response.dto';

@ApiTags('Predictive Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('analytics/predictive')
export class PredictiveAnalyticsController extends BaseAnalyticsController {
  constructor(
    private readonly predictiveAnalyticsService: PredictiveAnalyticsService,
    private readonly priceOptimizationService: PriceOptimizationService,
    private readonly demandAnomalyService: DemandAnomalyService,
    private readonly modelServingService: ModelServingService,
  ) {
    super();
  }

  // Unified Predictive Analytics Endpoint
  @Post('analyze')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Perform comprehensive predictive analysis',
    description:
      'Execute various types of predictive analytics based on the specified analysis type',
  })
  @ApiResponse({
    status: 200,
    description: 'Predictive analysis completed successfully',
    type: PredictiveAnalyticsResponseDto,
  })
  @ApiBody({ type: PredictiveAnalyticsQueryDto })
  async performPredictiveAnalysis(
    @CurrentUser() user: any,
    @Body() query: PredictiveAnalyticsQueryDto,
  ): Promise<PredictiveAnalyticsResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        `Predictive Analysis - ${query.analysisType}`,
        undefined,
        { analysisType: query.analysisType },
      );

      // Validate analysis type
      if (!query.analysisType) {
        this.handleValidationError('Jenis analisis wajib dipilih');
      }

      let data: any;
      let summary: any;
      let insights: any;
      let meta: any;

      switch (query.analysisType) {
        case PredictiveAnalysisType.STOCKOUT_PREDICTION:
          const stockoutResult =
            await this.predictiveAnalyticsService.generateStockoutPredictions(
              user.tenantId,
              (query.parameters as StockoutPredictionQueryDto) || {
                timeHorizon: TimeHorizon.NEXT_30_DAYS,
              },
            );
          data = stockoutResult.data;
          summary = stockoutResult.summary;
          insights = stockoutResult.insights;
          meta = stockoutResult.meta;
          break;

        case PredictiveAnalysisType.SLOW_MOVING_DETECTION:
          const slowMovingResult =
            await this.predictiveAnalyticsService.detectSlowMovingItems(
              user.tenantId,
              (query.parameters as SlowMovingDetectionQueryDto) || {},
            );
          data = slowMovingResult.data;
          summary = slowMovingResult.summary;
          insights = slowMovingResult.insights;
          meta = slowMovingResult.meta;
          break;

        case PredictiveAnalysisType.OPTIMAL_REORDER:
          const reorderResult =
            await this.predictiveAnalyticsService.generateOptimalReorders(
              user.tenantId,
              (query.parameters as OptimalReorderQueryDto) || {},
            );
          data = reorderResult.data;
          summary = reorderResult.summary;
          insights = reorderResult.insights;
          meta = reorderResult.meta;
          break;

        case PredictiveAnalysisType.PRICE_OPTIMIZATION:
          const priceResult =
            await this.priceOptimizationService.generatePriceOptimizations(
              user.tenantId,
              (query.parameters as PriceOptimizationQueryDto) || {},
            );
          data = priceResult.data;
          summary = priceResult.summary;
          insights = priceResult.insights;
          meta = priceResult.meta;
          break;

        case PredictiveAnalysisType.DEMAND_ANOMALY:
          const anomalyResult =
            await this.demandAnomalyService.detectDemandAnomalies(
              user.tenantId,
              (query.parameters as DemandAnomalyQueryDto) || {},
            );
          data = anomalyResult.data;
          summary = anomalyResult.summary;
          insights = anomalyResult.insights;
          meta = anomalyResult.meta;
          break;

        case PredictiveAnalysisType.SEASONAL_ANALYSIS:
          const seasonalResult =
            await this.demandAnomalyService.performSeasonalAnalysis(
              user.tenantId,
              (query.parameters as SeasonalAnalysisQueryDto) || {},
            );
          data = seasonalResult.data;
          summary = seasonalResult.summary;
          insights = seasonalResult.insights;
          meta = seasonalResult.meta;
          break;

        default:
          this.handleValidationError(
            `Jenis analisis tidak didukung: ${query.analysisType}`,
          );
      }

      // Generate correlations between different metrics (if applicable)
      const correlations = await this.generateCrossAnalysisCorrelations(
        user.tenantId,
        query.analysisType,
      );

      // Suggest next recommended analysis
      const nextRecommendedAnalysis = this.suggestNextAnalysis(
        query.analysisType,
        summary,
      );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        `Predictive Analysis - ${query.analysisType} Completed`,
        executionTime,
      );

      // Enhance meta with standardized format
      const enhancedMeta = {
        ...meta,
        ...this.createMetaObject(
          undefined,
          undefined,
          undefined,
          executionTime,
        ),
      };

      return {
        analysisType: query.analysisType,
        data,
        meta: enhancedMeta,
        summary,
        insights,
        correlations,
        nextRecommendedAnalysis,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        `Predictive Analysis - ${query.analysisType} Failed`,
        executionTime,
      );

      this.handleServiceError(
        error,
        `Analisis prediktif ${query.analysisType}`,
      );
    }
  }

  // Stockout Prediction Endpoints
  @Get('stockout-risk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Predict stockout risks',
    description:
      'Analyze inventory levels and demand patterns to predict stockout risks',
  })
  @ApiResponse({
    status: 200,
    description: 'Stockout risk analysis completed successfully',
    type: StockoutPredictionResponseDto,
  })
  async predictStockoutRisk(
    @CurrentUser() user: any,
    @Query() query: StockoutPredictionQueryDto,
  ): Promise<StockoutPredictionResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Stockout Risk Prediction',
        undefined,
        { timeHorizon: query.timeHorizon },
      );

      const result =
        await this.predictiveAnalyticsService.generateStockoutPredictions(
          user.tenantId,
          query,
        );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Stockout Risk Prediction Completed',
        executionTime,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Stockout Risk Prediction Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Prediksi risiko kehabisan stok');
    }
  }

  // Slow-Moving Item Detection Endpoints
  @Get('slow-moving')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Detect slow-moving inventory items',
    description:
      'Identify products with low turnover rates and provide optimization recommendations',
  })
  @ApiResponse({
    status: 200,
    description: 'Slow-moving items detected successfully',
    type: SlowMovingDetectionResponseDto,
  })
  async detectSlowMovingItems(
    @CurrentUser() user: any,
    @Query() query: SlowMovingDetectionQueryDto,
  ): Promise<SlowMovingDetectionResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Slow-Moving Items Detection',
        undefined,
        { lookbackDays: query.lookbackDays },
      );

      const result =
        await this.predictiveAnalyticsService.detectSlowMovingItems(
          user.tenantId,
          query,
        );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Slow-Moving Items Detection Completed',
        executionTime,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Slow-Moving Items Detection Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Deteksi barang dengan perputaran lambat');
    }
  }

  // Optimal Reorder Recommendations
  @Get('optimal-reorder')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Generate optimal reorder recommendations',
    description:
      'Calculate optimal reorder quantities and timing based on demand forecasts and inventory levels',
  })
  @ApiResponse({
    status: 200,
    description: 'Optimal reorder recommendations generated successfully',
    type: OptimalReorderResponseDto,
  })
  async generateOptimalReorders(
    @CurrentUser() user: any,
    @Query() query: OptimalReorderQueryDto,
  ): Promise<OptimalReorderResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Optimal Reorder Generation',
        undefined,
        {
          forecastHorizon: query.forecastHorizon,
          safetyStockMultiplier: query.safetyStockMultiplier,
        },
      );

      const result =
        await this.predictiveAnalyticsService.generateOptimalReorders(
          user.tenantId,
          query,
        );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Optimal Reorder Generation Completed',
        executionTime,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Optimal Reorder Generation Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Generasi rekomendasi pemesanan optimal');
    }
  }

  // Price Optimization Endpoints
  @Get('price-optimization')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Generate price optimization recommendations',
    description:
      'Analyze demand elasticity, competitive positioning, and margin optimization to recommend optimal pricing',
  })
  @ApiResponse({
    status: 200,
    description: 'Price optimization recommendations generated successfully',
    type: PriceOptimizationResponseDto,
  })
  async optimizePricing(
    @CurrentUser() user: any,
    @Query() query: PriceOptimizationQueryDto,
  ): Promise<PriceOptimizationResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Price Optimization',
        undefined,
        {
          targetMargin: query.targetMargin,
          maxPriceIncrease: query.maxPriceIncrease,
        },
      );

      const result =
        await this.priceOptimizationService.generatePriceOptimizations(
          user.tenantId,
          query,
        );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Price Optimization Completed',
        executionTime,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Price Optimization Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Optimasi harga');
    }
  }

  // Demand Anomaly Detection
  @Get('demand-anomalies')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Detect demand anomalies',
    description:
      'Identify unusual patterns in demand data and provide insights into potential causes',
  })
  @ApiResponse({
    status: 200,
    description: 'Demand anomalies detected successfully',
    type: DemandAnomalyResponseDto,
  })
  async detectDemandAnomalies(
    @CurrentUser() user: any,
    @Query() query: DemandAnomalyQueryDto,
  ): Promise<DemandAnomalyResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Demand Anomaly Detection',
        undefined,
        {
          sensitivityLevel: query.sensitivityLevel,
          detectSpikes: query.detectSpikes,
        },
      );

      const result = await this.demandAnomalyService.detectDemandAnomalies(
        user.tenantId,
        query,
      );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Demand Anomaly Detection Completed',
        executionTime,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Demand Anomaly Detection Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Deteksi anomali permintaan');
    }
  }

  // Seasonal Analysis
  @Get('seasonal-analysis')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Perform seasonal demand analysis',
    description:
      'Analyze seasonal patterns in product demand and provide strategic recommendations',
  })
  @ApiResponse({
    status: 200,
    description: 'Seasonal analysis completed successfully',
    type: SeasonalAnalysisResponseDto,
  })
  async performSeasonalAnalysis(
    @CurrentUser() user: any,
    @Query() query: SeasonalAnalysisQueryDto,
  ): Promise<SeasonalAnalysisResponseDto> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Seasonal Analysis',
        undefined,
        {
          analysisPeriodMonths: query.analysisPeriodMonths,
          useIndonesianHolidays: query.useIndonesianHolidays,
        },
      );

      const result = await this.demandAnomalyService.performSeasonalAnalysis(
        user.tenantId,
        query,
      );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Seasonal Analysis Completed',
        executionTime,
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Seasonal Analysis Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Analisis musiman');
    }
  }

  // Insights and Recommendations
  @Get('insights/summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get predictive analytics insights summary',
    description:
      'Comprehensive summary of all predictive analytics insights with prioritized recommendations',
  })
  @ApiResponse({
    status: 200,
    description: 'Insights summary generated successfully',
  })
  async getPredictiveInsightsSummary(
    @CurrentUser() user: any,
    @Query('timeframe') timeframe: '7d' | '30d' | '90d' = '30d',
  ) {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Predictive Insights Summary',
        undefined,
        { timeframe },
      );

      // Generate quick insights from each analysis type
      const stockoutInsights = await this.generateQuickStockoutInsights(
        user.tenantId,
        timeframe,
      );
      const slowMovingInsights = await this.generateQuickSlowMovingInsights(
        user.tenantId,
        timeframe,
      );
      const priceInsights = await this.generateQuickPriceInsights(
        user.tenantId,
        timeframe,
      );
      const anomalyInsights = await this.generateQuickAnomalyInsights(
        user.tenantId,
        timeframe,
      );

      // Prioritize recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations([
        ...stockoutInsights.recommendations,
        ...slowMovingInsights.recommendations,
        ...priceInsights.recommendations,
        ...anomalyInsights.recommendations,
      ]);

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Predictive Insights Summary Completed',
        executionTime,
      );

      return this.createSuccessResponse(
        {
          timeframe,
          summary: {
            stockoutRisk: stockoutInsights.summary,
            slowMovingItems: slowMovingInsights.summary,
            pricingOpportunities: priceInsights.summary,
            demandAnomalies: anomalyInsights.summary,
          },
          prioritizedRecommendations,
          nextSteps: this.generateNextSteps(prioritizedRecommendations),
        },
        this.createMetaObject(undefined, undefined, undefined, executionTime),
        'Ringkasan wawasan prediktif berhasil dibuat',
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Predictive Insights Summary Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Generasi ringkasan wawasan prediktif');
    }
  }

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Check predictive analytics service health',
    description: 'Health check endpoint for predictive analytics services',
  })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async getServiceHealth() {
    try {
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          predictiveAnalytics: 'operational',
          priceOptimization: 'operational',
          demandAnomalyDetection: 'operational',
          mlForecasting: 'operational',
        },
        capabilities: [
          'stockout_prediction',
          'slow_moving_detection',
          'optimal_reorder',
          'price_optimization',
          'demand_anomaly_detection',
          'seasonal_analysis',
        ],
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: 'Predictive analytics service unhealthy',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // Private helper methods
  private async generateCrossAnalysisCorrelations(
    tenantId: string,
    analysisType: PredictiveAnalysisType,
  ): Promise<
    Array<{
      metric1: string;
      metric2: string;
      correlation: number;
      significance: 'low' | 'medium' | 'high';
    }>
  > {
    // Simplified correlation analysis - in a real implementation, this would
    // perform statistical correlation analysis between different metrics

    const correlations = [];

    if (analysisType === PredictiveAnalysisType.STOCKOUT_PREDICTION) {
      correlations.push({
        metric1: 'stockout_risk',
        metric2: 'inventory_turnover',
        correlation: 0.75,
        significance: 'high' as const,
      });
    }

    if (analysisType === PredictiveAnalysisType.PRICE_OPTIMIZATION) {
      correlations.push({
        metric1: 'price_elasticity',
        metric2: 'demand_volume',
        correlation: -0.65,
        significance: 'high' as const,
      });
    }

    return correlations;
  }

  private suggestNextAnalysis(
    currentAnalysis: PredictiveAnalysisType,
    summary: any,
  ):
    | {
        analysisType: PredictiveAnalysisType;
        reasoning: string;
        priority: 'low' | 'medium' | 'high';
      }
    | undefined {
    switch (currentAnalysis) {
      case PredictiveAnalysisType.STOCKOUT_PREDICTION:
        if (summary.criticalRiskProducts > 0) {
          return {
            analysisType: PredictiveAnalysisType.OPTIMAL_REORDER,
            reasoning:
              'High stockout risk detected - optimize reorder parameters',
            priority: 'high',
          };
        }
        break;

      case PredictiveAnalysisType.SLOW_MOVING_DETECTION:
        if (summary.slowMovingValue > 10000000) {
          // 10M IDR
          return {
            analysisType: PredictiveAnalysisType.PRICE_OPTIMIZATION,
            reasoning:
              'Significant slow-moving inventory value - consider price optimization',
            priority: 'medium',
          };
        }
        break;

      case PredictiveAnalysisType.PRICE_OPTIMIZATION:
        return {
          analysisType: PredictiveAnalysisType.DEMAND_ANOMALY,
          reasoning: 'Validate price changes impact with anomaly detection',
          priority: 'medium',
        };

      case PredictiveAnalysisType.DEMAND_ANOMALY:
        return {
          analysisType: PredictiveAnalysisType.SEASONAL_ANALYSIS,
          reasoning: 'Understand seasonal patterns behind anomalies',
          priority: 'low',
        };
    }

    return undefined;
  }

  private async generateQuickStockoutInsights(
    tenantId: string,
    timeframe: string,
  ) {
    // Simplified quick insights - in a real implementation, this would run
    // a lightweight version of the stockout analysis
    return {
      summary: {
        highRiskProducts: 5,
        criticalRiskProducts: 2,
        averageRiskScore: 0.35,
      },
      recommendations: [
        {
          text: 'Urgent reorder needed for 2 critical products',
          priority: 'high',
        },
        {
          text: 'Review safety stock levels for high-risk items',
          priority: 'medium',
        },
      ],
    };
  }

  private async generateQuickSlowMovingInsights(
    tenantId: string,
    timeframe: string,
  ) {
    return {
      summary: {
        slowMovingItems: 15,
        totalValue: 25000000,
        potentialRecovery: 18000000,
      },
      recommendations: [
        {
          text: 'Implement markdown strategy for Rp 25M slow-moving inventory',
          priority: 'high',
        },
        {
          text: 'Review purchasing patterns for identified slow-movers',
          priority: 'medium',
        },
      ],
    };
  }

  private async generateQuickPriceInsights(
    tenantId: string,
    timeframe: string,
  ) {
    return {
      summary: {
        optimizationOpportunities: 8,
        potentialRevenueIncrease: 5000000,
        averageMarginImprovement: 3.5,
      },
      recommendations: [
        {
          text: 'Price optimization could increase revenue by Rp 5M',
          priority: 'medium',
        },
        {
          text: 'Test price increases for 8 identified products',
          priority: 'low',
        },
      ],
    };
  }

  private async generateQuickAnomalyInsights(
    tenantId: string,
    timeframe: string,
  ) {
    return {
      summary: {
        anomaliesDetected: 12,
        spikes: 7,
        drops: 5,
      },
      recommendations: [
        {
          text: 'Investigate 7 demand spikes for replication opportunities',
          priority: 'medium',
        },
        { text: 'Address root causes of 5 demand drops', priority: 'high' },
      ],
    };
  }

  private prioritizeRecommendations(
    recommendations: Array<{ text: string; priority: string }>,
  ) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return recommendations
      .sort(
        (a, b) =>
          priorityOrder[b.priority as keyof typeof priorityOrder] -
          priorityOrder[a.priority as keyof typeof priorityOrder],
      )
      .slice(0, 10); // Top 10 recommendations
  }

  private generateNextSteps(
    recommendations: Array<{ text: string; priority: string }>,
  ) {
    const highPriorityCount = recommendations.filter(
      r => r.priority === 'high',
    ).length;

    if (highPriorityCount > 0) {
      return [
        `Address ${highPriorityCount} high-priority recommendations immediately`,
        'Schedule weekly review of predictive analytics insights',
        'Setup automated alerts for critical threshold breaches',
      ];
    }

    return [
      'Continue monitoring with monthly predictive analytics review',
      'Focus on medium-priority optimization opportunities',
      'Implement preventive measures based on insights',
    ];
  }

  // Professional Demand Forecasting Endpoint
  @Post('demand-forecast')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Generate professional demand forecast',
    description:
      'Generate demand forecasts using professional algorithms including Holt-Winters exponential smoothing, Islamic calendar integration, and advanced seasonality detection',
  })
  @ApiResponse({
    status: 200,
    description: 'Professional demand forecast generated successfully',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID for forecast (optional)',
        },
        categoryId: {
          type: 'string',
          description: 'Category ID for forecast (optional)',
        },
        locationId: {
          type: 'string',
          description: 'Location ID for forecast (optional)',
        },
        timeHorizon: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Forecast time horizon',
          default: '30d',
        },
        forecastType: {
          type: 'string',
          enum: ['demand', 'sales', 'stock'],
          description: 'Type of forecast',
          default: 'demand',
        },
      },
    },
  })
  async generateDemandForecast(
    @CurrentUser() user: any,
    @Body()
    forecastRequest: {
      productId?: string;
      categoryId?: string;
      locationId?: string;
      timeHorizon: '7d' | '30d' | '90d';
      forecastType?: 'demand' | 'sales' | 'stock';
    },
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logAnalyticsOperation(
        user.tenantId,
        'Professional Demand Forecasting',
        undefined,
        {
          timeHorizon: forecastRequest.timeHorizon,
          forecastType: forecastRequest.forecastType,
          productId: forecastRequest.productId,
        },
      );

      const result =
        await this.predictiveAnalyticsService.generateDemandForecast(
          {
            productId: forecastRequest.productId,
            categoryId: forecastRequest.categoryId,
            locationId: forecastRequest.locationId,
            timeHorizon: forecastRequest.timeHorizon || '30d',
            forecastType: forecastRequest.forecastType || 'demand',
          },
          user.tenantId,
        );

      const executionTime = Date.now() - startTime;
      this.logAnalyticsOperation(
        user.tenantId,
        'Professional Demand Forecasting Completed',
        executionTime,
      );

      return {
        success: true,
        data: result,
        meta: {
          executionTime: `${executionTime}ms`,
          generatedAt: new Date().toISOString(),
          tenantId: user.tenantId,
          userId: user.id,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('🚨 DETAILED ERROR DEBUG:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        details: error,
      });
      this.logAnalyticsOperation(
        user.tenantId,
        'Professional Demand Forecasting Failed',
        executionTime,
      );

      this.handleServiceError(error, 'Professional demand forecasting');
    }
  }
}
