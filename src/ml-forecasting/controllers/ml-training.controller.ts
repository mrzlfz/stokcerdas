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
} from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { GetUser } from '../../common/decorators/user.decorator';

import { ModelTrainingService, TrainingRequest } from '../services/model-training.service';
import { ModelType } from '../entities/ml-model.entity';

// DTOs
class StartTrainingDto {
  @ApiOperation({ description: 'Model name' })
  @IsString()
  modelName: string;

  @ApiOperation({ description: 'Model type to train' })
  @IsEnum(ModelType)
  modelType: ModelType;

  @ApiOperation({ description: 'Product ID for product-specific models (optional)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiOperation({ description: 'Category ID for category-level models (optional)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiOperation({ description: 'Location ID for location-specific models (optional)' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiOperation({ description: 'Training data start date' })
  @IsDateString()
  trainingDataFrom: string;

  @ApiOperation({ description: 'Training data end date' })
  @IsDateString()
  trainingDataTo: string;

  @ApiOperation({ description: 'Product IDs to include in training (optional)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiOperation({ description: 'Category IDs to include in training (optional)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiOperation({ description: 'Location IDs to include in training (optional)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationIds?: string[];

  @ApiOperation({ description: 'Validation split ratio (0.1-0.9)' })
  @IsNumber()
  @Min(0.1)
  @Max(0.9)
  validationSplit: number = 0.8;

  @ApiOperation({ description: 'Validation method' })
  @IsEnum(['time_series', 'random'])
  validationMethod: 'time_series' | 'random' = 'time_series';

  @ApiOperation({ description: 'Feature list for training' })
  @IsArray()
  @IsString({ each: true })
  features: string[];

  @ApiOperation({ description: 'Target variable for prediction' })
  @IsString()
  target: string;

  @ApiOperation({ description: 'Model hyperparameters' })
  @IsObject()
  hyperparameters: Record<string, any>;
}

class RetrainModelDto {
  @ApiOperation({ description: 'New training data start date (optional)' })
  @IsOptional()
  @IsDateString()
  trainingDataFrom?: string;

  @ApiOperation({ description: 'New training data end date (optional)' })
  @IsOptional()
  @IsDateString()
  trainingDataTo?: string;

  @ApiOperation({ description: 'Updated hyperparameters (optional)' })
  @IsOptional()
  @IsObject()
  hyperparameters?: Record<string, any>;

  @ApiOperation({ description: 'Updated feature list (optional)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

class TrainingJobQueryDto {
  @ApiOperation({ description: 'Filter by model ID' })
  @IsOptional()
  @IsString()
  modelId?: string;

  @ApiOperation({ description: 'Filter by job status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiOperation({ description: 'Number of results to return' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiOperation({ description: 'Number of results to skip' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

@ApiTags('ML Training')
@ApiBearerAuth()
@Controller('api/v1/ml/training')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MLTrainingController {
  constructor(
    private readonly modelTrainingService: ModelTrainingService,
  ) {}

  @Post('start')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start Model Training',
    description: 'Start training a new machine learning model for demand forecasting',
  })
  @ApiResponse({
    status: 202,
    description: 'Training job started successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        modelId: { type: 'string' },
        jobId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid training configuration',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Manager access required',
  })
  @ApiBody({ type: StartTrainingDto })
  async startTraining(
    @GetTenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() trainingDto: StartTrainingDto,
  ): Promise<{
    success: boolean;
    modelId: string;
    jobId: string;
    message: string;
  }> {
    // Validate training configuration
    const trainingFrom = new Date(trainingDto.trainingDataFrom);
    const trainingTo = new Date(trainingDto.trainingDataTo);
    
    if (trainingFrom >= trainingTo) {
      throw new BadRequestException('Training start date must be before end date');
    }

    // Check if enough training data timespan
    const daysDiff = Math.ceil((trainingTo.getTime() - trainingFrom.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 30) {
      throw new BadRequestException('Training data must span at least 30 days');
    }

    const trainingRequest: TrainingRequest = {
      modelType: trainingDto.modelType,
      modelName: trainingDto.modelName,
      productId: trainingDto.productId,
      categoryId: trainingDto.categoryId,
      locationId: trainingDto.locationId,
      trainingConfig: {
        dataSource: {
          from: trainingDto.trainingDataFrom,
          to: trainingDto.trainingDataTo,
          productIds: trainingDto.productIds,
          categoryIds: trainingDto.categoryIds,
          locationIds: trainingDto.locationIds,
        },
        hyperparameters: trainingDto.hyperparameters,
        validation: {
          splitRatio: trainingDto.validationSplit,
          method: trainingDto.validationMethod,
        },
        features: trainingDto.features,
        target: trainingDto.target,
      },
      userId,
    };

    const result = await this.modelTrainingService.startTraining(tenantId, trainingRequest);

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return {
      success: true,
      modelId: result.modelId,
      jobId: result.jobId,
      message: 'Model training started successfully. Check job status for progress.',
    };
  }

  @Post(':modelId/retrain')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Retrain Existing Model',
    description: 'Retrain an existing model with new data or parameters',
  })
  @ApiResponse({
    status: 202,
    description: 'Retraining job started successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found',
  })
  @ApiParam({
    name: 'modelId',
    description: 'Model ID to retrain',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: RetrainModelDto })
  async retrainModel(
    @GetTenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('modelId') modelId: string,
    @Body() retrainDto: RetrainModelDto,
  ): Promise<{
    success: boolean;
    modelId: string;
    jobId: string;
    message: string;
  }> {
    // This would implement retraining logic
    // For now, return a placeholder response
    throw new BadRequestException('Retraining functionality will be implemented in Phase 2');
  }

  @Get('jobs')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({
    summary: 'Get Training Jobs',
    description: 'Retrieve list of training jobs with their status',
  })
  @ApiResponse({
    status: 200,
    description: 'Training jobs retrieved successfully',
    schema: {
      properties: {
        jobs: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'string' },
              modelId: { type: 'string' },
              modelName: { type: 'string' },
              modelType: { type: 'string' },
              status: { type: 'string' },
              progress: { type: 'number' },
              currentStep: { type: 'string' },
              startedAt: { type: 'string' },
              completedAt: { type: 'string' },
              duration: { type: 'number' },
              performance: { type: 'object' },
              errorMessage: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
  })
  @ApiQuery({
    name: 'modelId',
    required: false,
    description: 'Filter by model ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by job status',
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
  async getTrainingJobs(
    @GetTenant() tenantId: string,
    @Query() query: TrainingJobQueryDto,
  ): Promise<{
    jobs: any[];
    total: number;
    hasMore: boolean;
  }> {
    // This would query training jobs from database
    // For now, return a placeholder response
    return {
      jobs: [],
      total: 0,
      hasMore: false,
    };
  }

  @Get('jobs/:jobId')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({
    summary: 'Get Training Job Details',
    description: 'Retrieve detailed information about a specific training job',
  })
  @ApiResponse({
    status: 200,
    description: 'Training job details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Training job not found',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Training job ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async getTrainingJobDetails(
    @GetTenant() tenantId: string,
    @Param('jobId') jobId: string,
  ): Promise<{
    id: string;
    modelId: string;
    modelName: string;
    modelType: string;
    status: string;
    progress: number;
    currentStep: string;
    startedAt: string;
    completedAt: string;
    duration: number;
    trainingConfig: any;
    performance: any;
    logs: string[];
    errorMessage: string;
    resourceUsage: any;
  }> {
    // This would query specific training job from database
    // For now, return a placeholder response
    throw new NotFoundException('Training job not found');
  }

  @Post('jobs/:jobId/cancel')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel Training Job',
    description: 'Cancel a running training job',
  })
  @ApiResponse({
    status: 200,
    description: 'Training job cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Training job not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Training job cannot be cancelled',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Training job ID to cancel',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async cancelTrainingJob(
    @GetTenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('jobId') jobId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // This would implement job cancellation logic
    // For now, return a placeholder response
    throw new BadRequestException('Job cancellation functionality will be implemented in Phase 2');
  }

  @Get('models')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({
    summary: 'Get Trained Models',
    description: 'Retrieve list of trained ML models',
  })
  @ApiResponse({
    status: 200,
    description: 'Models retrieved successfully',
    schema: {
      properties: {
        models: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              modelType: { type: 'string' },
              status: { type: 'string' },
              productId: { type: 'string' },
              categoryId: { type: 'string' },
              locationId: { type: 'string' },
              performance: { type: 'object' },
              trainedAt: { type: 'string' },
              deployedAt: { type: 'string' },
              lastPredictionAt: { type: 'string' },
              isActive: { type: 'boolean' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  async getTrainedModels(
    @GetTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('modelType') modelType?: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0,
  ): Promise<{
    models: any[];
    total: number;
  }> {
    // This would query models from database
    // For now, return a placeholder response
    return {
      models: [],
      total: 0,
    };
  }

  @Get('models/:modelId')
  @Roles('admin', 'manager', 'staff')
  @ApiOperation({
    summary: 'Get Model Details',
    description: 'Retrieve detailed information about a specific ML model',
  })
  @ApiResponse({
    status: 200,
    description: 'Model details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found',
  })
  @ApiParam({
    name: 'modelId',
    description: 'Model ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async getModelDetails(
    @GetTenant() tenantId: string,
    @Param('modelId') modelId: string,
  ): Promise<{
    id: string;
    name: string;
    description: string;
    modelType: string;
    status: string;
    productId: string;
    categoryId: string;
    locationId: string;
    hyperparameters: any;
    trainingConfig: any;
    performance: any;
    featureImportance: any;
    trainedAt: string;
    deployedAt: string;
    lastPredictionAt: string;
    nextRetrainingAt: string;
    isActive: boolean;
  }> {
    // This would query specific model from database
    // For now, return a placeholder response
    throw new NotFoundException('Model not found');
  }

  @Post('models/:modelId/deploy')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deploy Model',
    description: 'Deploy a trained model for predictions',
  })
  @ApiResponse({
    status: 200,
    description: 'Model deployed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Model cannot be deployed',
  })
  @ApiParam({
    name: 'modelId',
    description: 'Model ID to deploy',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async deployModel(
    @GetTenant() tenantId: string,
    @Param('modelId') modelId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // This would implement model deployment logic
    // For now, return a placeholder response
    throw new BadRequestException('Model deployment functionality will be implemented in Phase 2');
  }

  @Post('models/:modelId/deprecate')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deprecate Model',
    description: 'Deprecate a deployed model',
  })
  @ApiResponse({
    status: 200,
    description: 'Model deprecated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Model not found',
  })
  @ApiParam({
    name: 'modelId',
    description: 'Model ID to deprecate',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async deprecateModel(
    @GetTenant() tenantId: string,
    @Param('modelId') modelId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // This would implement model deprecation logic
    // For now, return a placeholder response
    throw new BadRequestException('Model deprecation functionality will be implemented in Phase 2');
  }
}