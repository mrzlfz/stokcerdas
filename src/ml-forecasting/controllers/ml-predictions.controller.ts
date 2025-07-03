import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { UserRole } from '../../users/entities/user.entity';

import { ModelServingService, PredictionRequest } from '../services/model-serving.service';
import { PredictionType } from '../entities/prediction.entity';

// DTOs
class CreatePredictionDto {
  @ApiProperty({ description: 'Specific model ID to use (optional)' })
  @IsOptional()
  @IsString()
  modelId?: string;

  @ApiProperty({ description: 'Product ID for prediction' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ description: 'Category ID for category-level prediction' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Location ID for location-specific prediction' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({ description: 'Type of prediction to generate' })
  @IsEnum(PredictionType)
  predictionType: PredictionType;

  @ApiProperty({ description: 'Target date for prediction (optional, defaults to today)' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiProperty({ description: 'Number of days to forecast (1-90)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  forecastDays?: number;

  @ApiProperty({ description: 'Include confidence intervals in response' })
  @IsOptional()
  @IsBoolean()
  includeConfidenceInterval?: boolean;

  @ApiProperty({ description: 'Additional features for prediction (optional)' })
  @IsOptional()
  @IsObject()
  features?: Record<string, any>;
}

class BatchPredictionDto {
  @ApiProperty({ description: 'Specific model ID to use (optional)' })
  @IsOptional()
  @IsString()
  modelId?: string;

  @ApiProperty({ description: 'Product IDs for batch prediction' })
  @IsArray()
  @IsString({ each: true })
  productIds: string[];

  @ApiProperty({ description: 'Type of prediction to generate' })
  @IsEnum(PredictionType)
  predictionType: PredictionType;

  @ApiProperty({ description: 'Target date for prediction (optional, defaults to today)' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiProperty({ description: 'Number of days to forecast (1-90)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  forecastDays?: number;
}

class DemandForecastDto {
  @ApiProperty({ description: 'Product ID for demand forecast' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Number of days to forecast (1-90)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  days?: number = 30;
}

class StockoutRiskDto {
  @ApiProperty({ description: 'Product ID for stockout risk analysis' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Number of days ahead to analyze (1-30)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  daysAhead?: number = 7;
}

class OptimalReorderDto {
  @ApiProperty({ description: 'Product ID for reorder optimization' })
  @IsString()
  productId: string;
}

class PredictionQueryDto {
  @ApiProperty({ description: 'Filter by product ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ description: 'Filter by prediction type' })
  @IsOptional()
  @IsEnum(PredictionType)
  predictionType?: PredictionType;

  @ApiProperty({ description: 'Filter by date range - start date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ description: 'Filter by date range - end date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ description: 'Number of results to return' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ description: 'Number of results to skip' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

@ApiTags('ML Predictions')
@ApiBearerAuth()
@Controller('api/v1/ml/predictions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MLPredictionsController {
  constructor(
    private readonly modelServingService: ModelServingService,
  ) {}

  @Post('predict')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Prediction',
    description: 'Generate a machine learning prediction for demand forecasting, stockout risk, or other predictions',
  })
  @ApiResponse({
    status: 200,
    description: 'Prediction generated successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        predictionId: { type: 'string' },
        predictedValue: { type: 'number' },
        confidence: { type: 'number' },
        confidenceLevel: { type: 'string' },
        lowerBound: { type: 'number' },
        upperBound: { type: 'number' },
        timeSeries: {
          type: 'array',
          items: {
            properties: {
              date: { type: 'string' },
              value: { type: 'number' },
              lowerBound: { type: 'number' },
              upperBound: { type: 'number' },
            },
          },
        },
        actionableInsights: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: { type: 'string' },
            },
            alerts: {
              type: 'array',
              items: {
                properties: {
                  type: { type: 'string' },
                  severity: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid prediction request',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiBody({ type: CreatePredictionDto })
  async createPrediction(
    @GetTenant() tenantId: string,
    @Body() predictionDto: CreatePredictionDto,
  ): Promise<{
    success: boolean;
    predictionId?: string;
    predictedValue?: number;
    confidence?: number;
    confidenceLevel?: string;
    lowerBound?: number;
    upperBound?: number;
    timeSeries?: Array<{
      date: string;
      value: number;
      lowerBound?: number;
      upperBound?: number;
    }>;
    actionableInsights?: {
      recommendations?: string[];
      alerts?: Array<{
        type: string;
        severity: string;
        message: string;
      }>;
    };
    error?: string;
  }> {
    const request: PredictionRequest = {
      modelId: predictionDto.modelId,
      productId: predictionDto.productId,
      categoryId: predictionDto.categoryId,
      locationId: predictionDto.locationId,
      predictionType: predictionDto.predictionType,
      targetDate: predictionDto.targetDate ? new Date(predictionDto.targetDate) : undefined,
      forecastDays: predictionDto.forecastDays,
      includeConfidenceInterval: predictionDto.includeConfidenceInterval,
      features: predictionDto.features,
    };

    const result = await this.modelServingService.predict(tenantId, request);

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      predictionId: result.predictionId,
      predictedValue: result.predictedValue,
      confidence: result.confidence,
      confidenceLevel: this.getConfidenceLevel(result.confidence || 0),
      lowerBound: result.lowerBound,
      upperBound: result.upperBound,
      timeSeries: result.timeSeries,
      actionableInsights: result.actionableInsights,
    };
  }

  @Post('batch-predict')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate Batch Predictions',
    description: 'Generate predictions for multiple products at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch predictions generated successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        results: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              predictedValue: { type: 'number' },
              confidence: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid batch prediction request',
  })
  @ApiBody({ type: BatchPredictionDto })
  async batchPredict(
    @GetTenant() tenantId: string,
    @Body() batchDto: BatchPredictionDto,
  ): Promise<{
    success: boolean;
    results: Record<string, any>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    if (!batchDto.productIds?.length) {
      throw new BadRequestException('Product IDs are required for batch prediction');
    }

    if (batchDto.productIds.length > 50) {
      throw new BadRequestException('Maximum 50 products allowed per batch');
    }

    const results = await this.modelServingService.batchPredict(tenantId, {
      modelId: batchDto.modelId,
      productIds: batchDto.productIds,
      predictionType: batchDto.predictionType,
      targetDate: batchDto.targetDate ? new Date(batchDto.targetDate) : undefined,
      forecastDays: batchDto.forecastDays,
    });

    const summary = {
      total: batchDto.productIds.length,
      successful: 0,
      failed: 0,
    };

    Object.values(results).forEach((result) => {
      if (result.success) {
        summary.successful++;
      } else {
        summary.failed++;
      }
    });

    return {
      success: true,
      results,
      summary,
    };
  }

  @Post('demand-forecast')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Demand Forecast',
    description: 'Get demand forecast for a specific product',
  })
  @ApiResponse({
    status: 200,
    description: 'Demand forecast generated successfully',
  })
  @ApiBody({ type: DemandForecastDto })
  async getDemandForecast(
    @GetTenant() tenantId: string,
    @Body() forecastDto: DemandForecastDto,
  ): Promise<any> {
    const result = await this.modelServingService.getDemandForecast(
      tenantId,
      forecastDto.productId,
      forecastDto.days,
    );

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      productId: forecastDto.productId,
      forecastDays: forecastDto.days,
      predictedDemand: result.predictedValue,
      confidence: result.confidence,
      confidenceLevel: this.getConfidenceLevel(result.confidence || 0),
      timeSeries: result.timeSeries,
      actionableInsights: result.actionableInsights,
    };
  }

  @Post('stockout-risk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Stockout Risk',
    description: 'Analyze stockout risk for a specific product',
  })
  @ApiResponse({
    status: 200,
    description: 'Stockout risk analysis completed successfully',
  })
  @ApiBody({ type: StockoutRiskDto })
  async getStockoutRisk(
    @GetTenant() tenantId: string,
    @Body() riskDto: StockoutRiskDto,
  ): Promise<any> {
    const result = await this.modelServingService.getStockoutRisk(
      tenantId,
      riskDto.productId,
      riskDto.daysAhead,
    );

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    const riskScore = result.predictedValue || 0;
    const riskLevel = this.getRiskLevel(riskScore);

    return {
      success: true,
      productId: riskDto.productId,
      daysAhead: riskDto.daysAhead,
      riskScore,
      riskLevel,
      riskPercentage: Math.round(riskScore * 100),
      confidence: result.confidence,
      actionableInsights: result.actionableInsights,
    };
  }

  @Post('optimal-reorder')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Optimal Reorder Recommendation',
    description: 'Get optimal reorder quantity recommendation for a product',
  })
  @ApiResponse({
    status: 200,
    description: 'Optimal reorder recommendation generated successfully',
  })
  @ApiBody({ type: OptimalReorderDto })
  async getOptimalReorder(
    @GetTenant() tenantId: string,
    @Body() reorderDto: OptimalReorderDto,
  ): Promise<any> {
    const result = await this.modelServingService.getOptimalReorder(
      tenantId,
      reorderDto.productId,
    );

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      productId: reorderDto.productId,
      optimalQuantity: Math.ceil(result.predictedValue || 0),
      confidence: result.confidence,
      businessImpact: {
        estimatedCost: (result.predictedValue || 0) * 1000, // Placeholder calculation
        estimatedRevenue: (result.predictedValue || 0) * 1500, // Placeholder calculation
      },
      actionableInsights: result.actionableInsights,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get Predictions History',
    description: 'Retrieve historical predictions with filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'Predictions retrieved successfully',
    schema: {
      properties: {
        predictions: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'string' },
              productId: { type: 'string' },
              predictionType: { type: 'string' },
              predictedValue: { type: 'number' },
              actualValue: { type: 'number' },
              confidence: { type: 'number' },
              errorRate: { type: 'number' },
              predictionDate: { type: 'string' },
              targetDate: { type: 'string' },
              isAccurate: { type: 'boolean' },
            },
          },
        },
        total: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filter by product ID',
  })
  @ApiQuery({
    name: 'predictionType',
    required: false,
    description: 'Filter by prediction type',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Filter by date range - start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Filter by date range - end date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results to return (1-100)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of results to skip',
    example: 0,
  })
  async getPredictions(
    @GetTenant() tenantId: string,
    @Query() query: PredictionQueryDto,
  ): Promise<{
    predictions: any[];
    total: number;
    hasMore: boolean;
  }> {
    // This would query predictions from database
    // For now, return a placeholder response
    return {
      predictions: [],
      total: 0,
      hasMore: false,
    };
  }

  @Get(':predictionId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get Prediction Details',
    description: 'Retrieve detailed information about a specific prediction',
  })
  @ApiResponse({
    status: 200,
    description: 'Prediction details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Prediction not found',
  })
  @ApiParam({
    name: 'predictionId',
    description: 'Prediction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async getPredictionDetails(
    @GetTenant() tenantId: string,
    @Param('predictionId') predictionId: string,
  ): Promise<any> {
    // This would query specific prediction from database
    // For now, return a placeholder response
    throw new NotFoundException('Prediction not found');
  }

  @Post('validate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate Predictions',
    description: 'Validate prediction accuracy against actual values for a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Prediction validation completed successfully',
  })
  async validatePredictions(
    @GetTenant() tenantId: string,
    @Body() body: {
      startDate: string;
      endDate: string;
    },
  ): Promise<{
    totalPredictions: number;
    accuratePredictions: number;
    accuracyRate: number;
    averageErrorRate: number;
    modelPerformance: Record<string, any>;
  }> {
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    const validation = await this.modelServingService.validatePredictions(
      tenantId,
      startDate,
      endDate,
    );

    return {
      totalPredictions: validation.totalPredictions,
      accuratePredictions: validation.accuratePredictions,
      accuracyRate: validation.totalPredictions > 0 
        ? validation.accuratePredictions / validation.totalPredictions 
        : 0,
      averageErrorRate: validation.averageErrorRate,
      modelPerformance: validation.modelPerformance,
    };
  }

  // Helper methods
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.95) return 'Sangat Tinggi';
    if (confidence >= 0.85) return 'Tinggi';
    if (confidence >= 0.70) return 'Sedang';
    return 'Rendah';
  }

  private getRiskLevel(riskScore: number): string {
    if (riskScore >= 0.8) return 'Sangat Tinggi';
    if (riskScore >= 0.6) return 'Tinggi';
    if (riskScore >= 0.4) return 'Sedang';
    if (riskScore >= 0.2) return 'Rendah';
    return 'Sangat Rendah';
  }
}