import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Import Analytics module for SimilarityEngineService
import { AnalyticsModule } from '../analytics/analytics.module';

// Entities
import { MLModel } from './entities/ml-model.entity';
import { TrainingJob } from './entities/training-job.entity';
import { Prediction } from './entities/prediction.entity';

// External entities
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';

// Controllers
import { MLTrainingController } from './controllers/ml-training.controller';
import { MLPredictionsController } from './controllers/ml-predictions.controller';
import { EnsembleOptimizationController } from './controllers/ensemble-optimization.controller';
import { ModelDeploymentController } from './controllers/model-deployment.controller';
import { ProductionMonitoringController } from './controllers/production-monitoring.controller';
// import { RamadanForecastingIntegrationController } from './controllers/ramadan-forecasting-integration.controller';

// Services
import { ModelTrainingService } from './services/model-training.service';
import { ModelServingService } from './services/model-serving.service';
import { ForecastingService } from './services/forecasting.service';
import { DataPipelineService } from './services/data-pipeline.service';
import { PythonBridgeService } from './services/python-bridge.service';
import { DataPreprocessingService } from './services/data-preprocessing.service';
import { ModelSelectionService } from './services/model-selection.service';
import { RealtimePerformanceMonitoringService } from './services/realtime-performance-monitoring.service';
import { IndonesianBusinessCalendarService } from './services/indonesian-business-calendar.service';
import { MarketIntelligenceIntegrationService } from './services/market-intelligence-integration.service';
import { BusinessContextEnrichmentService } from './services/business-context-enrichment.service';
import { CulturalPatternLearningService } from './services/cultural-pattern-learning.service';
import { IndonesianGeographicClassificationService } from './services/indonesian-geographic-classification.service';
import { RamadanTimePatternService } from './services/ramadan-time-pattern.service';
import { EnsembleModelService } from './services/ensemble-model.service';
import { HyperparameterOptimizationService } from './services/hyperparameter-optimization.service';
import { ModelDeploymentService } from './services/model-deployment.service';
import { ProductionMonitoringService } from './services/production-monitoring.service';
import { RealMLService } from './services/real-ml.service';
import { EnhancedMLFallbackService } from './services/enhanced-ml-fallback.service';
import { AccuracyTrackingService } from './services/accuracy-tracking.service';

// Processors
import { MLTrainingProcessor } from './processors/ml-training.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,

    // Analytics module for SimilarityEngineService (using forwardRef to avoid circular dependency)
    forwardRef(() => AnalyticsModule),

    // HTTP module for external API calls (required by MarketIntelligenceIntegrationService)
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),

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
      Order,
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
          delay: 2000,
        },
      },
    }),
  ],

  controllers: [
    MLTrainingController,
    MLPredictionsController,
    EnsembleOptimizationController, // Phase 3 Production Optimization
    ModelDeploymentController, // Phase 3 Week 9: Production Deployment
    ProductionMonitoringController, // Phase 3 Week 9: Production Monitoring
    // RamadanForecastingIntegrationController, // Disabled - missing ramadan-forecasting-integration.service
  ],

  providers: [
    // Core ML services
    ModelTrainingService,
    ModelServingService,
    ForecastingService,
    DataPipelineService,

    // Python integration services
    PythonBridgeService,
    DataPreprocessingService,
    RealMLService,
    EnhancedMLFallbackService,
    AccuracyTrackingService,

    // Phase 2 Advanced ML services
    ModelSelectionService,
    RealtimePerformanceMonitoringService,
    IndonesianBusinessCalendarService,
    MarketIntelligenceIntegrationService,
    BusinessContextEnrichmentService,
    CulturalPatternLearningService,
    IndonesianGeographicClassificationService,
    RamadanTimePatternService,

    // Phase 3 Production Optimization services
    EnsembleModelService,
    HyperparameterOptimizationService,
    ModelDeploymentService, // Phase 3 Week 9: Production Deployment
    ProductionMonitoringService, // Phase 3 Week 9: Production Monitoring

    // Queue processors
    MLTrainingProcessor, // Enabled - dependencies now available

    // Note: Additional ML services are temporarily disabled due to missing service dependencies
    // They can be re-enabled once service implementations are created
  ],

  exports: [
    // Export core ML services for use in other modules
    ModelTrainingService,
    ModelServingService,
    ForecastingService,
    DataPipelineService,

    // Export Python integration services
    PythonBridgeService,
    DataPreprocessingService,
    RealMLService,
    EnhancedMLFallbackService,
    AccuracyTrackingService,

    // Export Phase 2 Advanced ML services
    ModelSelectionService,
    RealtimePerformanceMonitoringService,
    IndonesianBusinessCalendarService,
    MarketIntelligenceIntegrationService,
    BusinessContextEnrichmentService,
    CulturalPatternLearningService,
    IndonesianGeographicClassificationService,
    RamadanTimePatternService,

    // Export Phase 3 Production Optimization services
    EnsembleModelService,
    HyperparameterOptimizationService,
    ModelDeploymentService, // Phase 3 Week 9: Production Deployment
    ProductionMonitoringService, // Phase 3 Week 9: Production Monitoring

    // Note: Additional ML services are temporarily disabled due to interface dependencies
    // They can be re-enabled once type definitions are properly resolved
  ],
})
export class MLForecastingModule {}
