import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Import required entities for deployment
import { Product } from '../products/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

// Import ML forecasting entities for deployment integration
import { Prediction } from '../ml-forecasting/entities/prediction.entity';
import { MLModel } from '../ml-forecasting/entities/ml-model.entity';

// Import User entity for deployment management
import { User } from '../users/entities/user.entity';

// Import deployment services
// import { DockerContainerConfigurationService } from './services/docker-container-configuration.service';
// import { KubernetesResourceManagementService } from './services/kubernetes-resource-management.service';
// import { ServiceMeshIntegrationService } from './services/service-mesh-integration.service';
// import { ContainerRegistryManagementService } from './services/container-registry-management.service';
// import { OrchestrationMonitoringService } from './services/orchestration-monitoring.service';

// Import deployment controllers
// import { DeploymentController } from './controllers/deployment.controller';

// Import deployment processors for async operations
// import { DeploymentProcessor } from './processors/deployment.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    HttpModule.register({
      timeout: 60000, // Extended timeout for deployment operations
      maxRedirects: 3,
    }),

    // Database entities for deployment
    TypeOrmModule.forFeature([
      // Core entities for deployment
      Product,
      InventoryItem,
      InventoryTransaction,
      InventoryLocation,
      ProductCategory,

      // ML entities for deployment
      Prediction,
      MLModel,

      // User entity for deployment management
      User,
    ]),

    // Bull queue for async deployment operations
    BullModule.registerQueue({
      name: 'deployment',
      defaultJobOptions: {
        removeOnComplete: 50, // Keep fewer completed jobs for deployment history
        removeOnFail: 25,
        attempts: 5, // More attempts for deployment operations
        backoff: {
          type: 'exponential',
          delay: 10000, // Longer delay for deployment operations
        },
      },
    }),
  ],

  controllers: [/* DeploymentController */],

  providers: [
    // Docker container configuration
    // DockerContainerConfigurationService,
    
    // Kubernetes resource management
    // KubernetesResourceManagementService,
    
    // Service mesh integration
    // ServiceMeshIntegrationService,
    
    // Container registry management
    // ContainerRegistryManagementService,
    
    // Orchestration monitoring
    // OrchestrationMonitoringService,
    
    // Queue processors for async deployment
    // DeploymentProcessor,
  ],

  exports: [
    // Export deployment services for use in other modules
    // DockerContainerConfigurationService,
    // KubernetesResourceManagementService,
    // ServiceMeshIntegrationService,
    // ContainerRegistryManagementService,
    // OrchestrationMonitoringService,
  ],
})
export class DeploymentModule {}