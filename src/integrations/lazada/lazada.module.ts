import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Common integration imports
import { IntegrationLogService } from '../common/services/integration-log.service';
import { RateLimiterService } from '../common/services/rate-limiter.service';
import { WebhookHandlerService } from '../common/services/webhook-handler.service';

// Lazada services
import { LazadaApiService } from './services/lazada-api.service';
import { LazadaAuthService } from './services/lazada-auth.service';
import { LazadaProductService } from './services/lazada-product.service';
import { LazadaOrderService } from './services/lazada-order.service';
import { LazadaInventoryService } from './services/lazada-inventory.service';
import { LazadaWebhookService } from './services/lazada-webhook.service';

// Lazada controllers
import { LazadaController } from './controllers/lazada.controller';
import { LazadaWebhookController } from './controllers/lazada-webhook.controller';

// Lazada processors
import { LazadaProcessor } from './processors/lazada.processor';

// Entity imports
import { IntegrationLog } from '../entities/integration-log.entity';
import { SyncStatus } from '../entities/sync-status.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      // Integration entities
      IntegrationLog,
      SyncStatus,
      WebhookEvent,
      // Business entities
      Channel,
      Product,
      Order,
      OrderItem,
      InventoryItem,
    ]),

    // HTTP client for API calls
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
      headers: {
        'User-Agent': 'StokCerdas-Lazada-Integration/1.0',
      },
    }),

    // Configuration
    ConfigModule,

    // Event emitter
    EventEmitterModule,

    // Bull queue for async processing
    BullModule.registerQueue(
      {
        name: 'lazada',
        defaultJobOptions: {
          attempts: 3,
          delay: 1000, // 1 second delay
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 50, // Keep last 50 completed jobs
          removeOnFail: 100, // Keep last 100 failed jobs
        },
      },
      {
        name: 'integrations',
        defaultJobOptions: {
          attempts: 2,
          delay: 5000, // 5 seconds delay
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: 25,
          removeOnFail: 50,
        },
      },
    ),
  ],

  providers: [
    // Common integration services
    IntegrationLogService,
    RateLimiterService,
    WebhookHandlerService,

    // Lazada core services
    LazadaApiService,
    LazadaAuthService,
    LazadaProductService,
    LazadaOrderService,
    LazadaInventoryService,
    LazadaWebhookService,

    // Async processors
    LazadaProcessor,
  ],

  controllers: [
    LazadaController,
    LazadaWebhookController,
  ],

  exports: [
    // Export services for use in other modules
    LazadaApiService,
    LazadaAuthService,
    LazadaProductService,
    LazadaOrderService,
    LazadaInventoryService,
    LazadaWebhookService,
  ],
})
export class LazadaModule {}