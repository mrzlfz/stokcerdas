import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Import required entities for testing
import { Product } from '../products/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

// Import ML forecasting entities for testing integration
import { Prediction } from '../ml-forecasting/entities/prediction.entity';
import { MLModel } from '../ml-forecasting/entities/ml-model.entity';

// Import testing services
import { IntegrationTestingInfrastructureService } from './services/integration-testing-infrastructure.service';
import { MLServicesIntegrationTestingService } from './services/ml-services-integration-testing.service';
import { AnalyticsServicesIntegrationTestingService } from './services/analytics-services-integration-testing.service';
import { PerformanceValidationIntegrationTestingService } from './services/performance-validation-integration-testing.service';
import { IndonesianBusinessLogicIntegrationTestingService } from './services/indonesian-business-logic-integration-testing.service';

// Import testing controllers
import { TestingController } from './controllers/testing.controller';

// Import testing processors for async operations
import { TestingProcessor } from './processors/testing.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),

    // Database entities for testing
    TypeOrmModule.forFeature([
      // Core entities for testing
      Product,
      InventoryItem,
      InventoryTransaction,
      InventoryLocation,
      ProductCategory,

      // ML entities for testing
      Prediction,
      MLModel,
    ]),

    // Bull queue for async testing operations
    BullModule.registerQueue({
      name: 'testing',
      defaultJobOptions: {
        removeOnComplete: 100, // Keep more completed jobs for testing history
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],

  controllers: [TestingController],

  providers: [
    // Integration testing infrastructure
    IntegrationTestingInfrastructureService,
    
    // ML services integration testing
    MLServicesIntegrationTestingService,

    // Analytics services integration testing
    AnalyticsServicesIntegrationTestingService,

    // Performance validation integration testing
    PerformanceValidationIntegrationTestingService,

    // Indonesian business logic integration testing
    IndonesianBusinessLogicIntegrationTestingService,

    // Queue processors for async testing
    TestingProcessor,
  ],

  exports: [
    // Export testing services for use in other modules
    IntegrationTestingInfrastructureService,
    MLServicesIntegrationTestingService,
    AnalyticsServicesIntegrationTestingService,
    PerformanceValidationIntegrationTestingService,
    IndonesianBusinessLogicIntegrationTestingService,
  ],
})
export class TestingModule {}