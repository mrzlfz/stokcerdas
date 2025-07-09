import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/entities/user.entity';

import { ModelTrainingService } from '../services/model-training.service';
import { ModelType } from '../entities/ml-model.entity';

@ApiTags('ML Training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('ml-forecasting/training')
export class MLTrainingController {
  private readonly logger = new Logger(MLTrainingController.name);

  constructor(private readonly modelTrainingService: ModelTrainingService) {}

  @Post('start')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Start ML model training',
    description:
      'Start training a new ML model with the specified configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Training started successfully',
  })
  async startTraining(
    @CurrentUser() user: any,
    @Body()
    trainingDto: {
      modelType: ModelType;
      modelName: string;
      productId?: string;
      categoryId?: string;
      locationId?: string;
      trainingPeriod: {
        startDate: string;
        endDate: string;
      };
      features?: string[];
      hyperparameters?: Record<string, any>;
    },
  ) {
    try {
      const request = {
        modelType: trainingDto.modelType,
        modelName: trainingDto.modelName,
        productId: trainingDto.productId,
        categoryId: trainingDto.categoryId,
        locationId: trainingDto.locationId,
        trainingConfig: {
          dataSource: {
            from: trainingDto.trainingPeriod.startDate,
            to: trainingDto.trainingPeriod.endDate,
            productIds: trainingDto.productId ? [trainingDto.productId] : undefined,
            categoryIds: trainingDto.categoryId ? [trainingDto.categoryId] : undefined,
            locationIds: trainingDto.locationId ? [trainingDto.locationId] : undefined,
          },
          hyperparameters: trainingDto.hyperparameters || {},
          validation: {
            splitRatio: 0.8,
            method: 'time_series' as const,
          },
          features: trainingDto.features || ['quantity', 'price'],
          target: 'quantity',
        },
      };

      const result = await this.modelTrainingService.startTraining(
        request,
        user.tenantId,
        user.id,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error starting training: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('jobs')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get training jobs',
    description: 'Get list of training jobs for the tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Training jobs retrieved successfully',
  })
  async getTrainingJobs(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    try {
      const jobs = await this.modelTrainingService.listTrainingJobs(
        user.tenantId,
        limit || 50,
      );

      return {
        success: true,
        data: jobs,
        total: jobs.length,
      };
    } catch (error) {
      this.logger.error(`Error getting training jobs: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  @Get('jobs/:jobId/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get training job status',
    description: 'Get the status of a specific training job',
  })
  @ApiResponse({
    status: 200,
    description: 'Training job status retrieved successfully',
  })
  async getTrainingStatus(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
  ) {
    try {
      const job = await this.modelTrainingService.getTrainingStatus(
        jobId,
        user.tenantId,
      );

      return {
        success: true,
        data: job,
      };
    } catch (error) {
      this.logger.error(`Error getting training status: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('models/trained')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get trained models',
    description: 'Get list of successfully trained models',
  })
  @ApiResponse({
    status: 200,
    description: 'Trained models retrieved successfully',
  })
  async getTrainedModels(@CurrentUser() user: any) {
    try {
      const models = await this.modelTrainingService.getTrainedModels(
        user.tenantId,
      );

      return {
        success: true,
        data: models,
        total: models.length,
      };
    } catch (error) {
      this.logger.error(`Error getting trained models: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  @Post('models/:modelId/deploy')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Deploy trained model',
    description: 'Deploy a successfully trained model for predictions',
  })
  @ApiResponse({
    status: 200,
    description: 'Model deployed successfully',
  })
  async deployModel(
    @CurrentUser() user: any,
    @Param('modelId') modelId: string,
  ) {
    try {
      const model = await this.modelTrainingService.deployModel(
        modelId,
        user.tenantId,
      );

      return {
        success: true,
        data: model,
        message: 'Model deployed successfully',
      };
    } catch (error) {
      this.logger.error(`Error deploying model: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
