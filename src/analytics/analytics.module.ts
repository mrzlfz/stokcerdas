import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Import required entities for analytics
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

// Import ML forecasting entities for advanced analytics
import { Prediction } from '../ml-forecasting/entities/prediction.entity';
import { MLModel } from '../ml-forecasting/entities/ml-model.entity';

// Import services
import { BusinessIntelligenceService } from './services/business-intelligence.service';
import { CustomMetricsService } from './services/custom-metrics.service';
import { BenchmarkingService } from './services/benchmarking.service';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';
import { PriceOptimizationService } from './services/price-optimization.service';
import { DemandAnomalyService } from './services/demand-anomaly.service';

// Import ML Forecasting services for integration
import { ForecastingService } from '../ml-forecasting/services/forecasting.service';
import { ModelServingService } from '../ml-forecasting/services/model-serving.service';

// Import controllers
import { AnalyticsController } from './controllers/analytics.controller';
import { PredictiveAnalyticsController } from './controllers/predictive-analytics.controller';

// Import processors for async analytics
import { AnalyticsProcessor } from './processors/analytics.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    
    // Database entities for analytics
    TypeOrmModule.forFeature([
      // Core inventory and product entities
      InventoryItem,
      InventoryTransaction,
      InventoryLocation,
      Product,
      ProductCategory,
      
      // ML entities for advanced analytics
      Prediction,
      MLModel,
    ]),
    
    // Bull queue for async analytics processing
    BullModule.registerQueue({
      name: 'analytics',
      defaultJobOptions: {
        removeOnComplete: 50, // Keep more completed jobs for analytics history
        removeOnFail: 25,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  
  controllers: [
    AnalyticsController,
    PredictiveAnalyticsController,
  ],
  
  providers: [
    // Core analytics services
    BusinessIntelligenceService,
    CustomMetricsService,
    BenchmarkingService,
    
    // Predictive analytics services
    PredictiveAnalyticsService,
    PriceOptimizationService,
    DemandAnomalyService,
    
    // ML Forecasting services (imported for integration)
    ForecastingService,
    ModelServingService,
    
    // Queue processors
    AnalyticsProcessor,
  ],
  
  exports: [
    // Export analytics services for use in other modules
    BusinessIntelligenceService,
    CustomMetricsService,
    BenchmarkingService,
    PredictiveAnalyticsService,
    PriceOptimizationService,
    DemandAnomalyService,
  ],
})
export class AnalyticsModule {}