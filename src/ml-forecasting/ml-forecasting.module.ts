import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { MLModel } from './entities/ml-model.entity';
import { TrainingJob } from './entities/training-job.entity';
import { Prediction } from './entities/prediction.entity';

// External entities
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User } from '../users/entities/user.entity';

// Services
import { DataPipelineService } from './services/data-pipeline.service';
import { ModelTrainingService } from './services/model-training.service';
import { ModelServingService } from './services/model-serving.service';
import { ForecastingService } from './services/forecasting.service';
import { AccuracyTrackingService } from './services/accuracy-tracking.service';
import { ModelRetrainingService } from './services/model-retraining.service';

// Controllers
import { MLTrainingController } from './controllers/ml-training.controller';
import { MLPredictionsController } from './controllers/ml-predictions.controller';
import { ForecastingController } from './controllers/forecasting.controller';

// Processors
import { MLTrainingProcessor } from './processors/ml-training.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,

    // Database entities
    TypeOrmModule.forFeature([
      // ML-specific entities
      MLModel,
      TrainingJob,
      Prediction,

      // External entities needed for ML operations
      Product,
      ProductCategory,
      InventoryTransaction,
      InventoryItem,
      User,
    ]),

    // Bull queue for async ML training
    BullModule.registerQueue({
      name: 'ml-training',
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],

  controllers: [
    MLTrainingController,
    MLPredictionsController,
    ForecastingController,
  ],

  providers: [
    // Core services
    DataPipelineService,
    ModelTrainingService,
    ModelServingService,
    ForecastingService,
    AccuracyTrackingService,
    ModelRetrainingService,

    // Queue processors
    MLTrainingProcessor,
  ],

  exports: [
    // Export services for use by other modules
    DataPipelineService,
    ModelTrainingService,
    ModelServingService,
    ForecastingService,
    AccuracyTrackingService,
    ModelRetrainingService,
  ],
})
export class MLForecastingModule {}
