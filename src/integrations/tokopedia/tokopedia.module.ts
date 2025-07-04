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

// Tokopedia services
import { TokopediaApiService } from './services/tokopedia-api.service';
import { TokopediaAuthService } from './services/tokopedia-auth.service';
import { TokopediaProductService } from './services/tokopedia-product.service';
import { TokopediaOrderService } from './services/tokopedia-order.service';
import { TokopediaInventoryService } from './services/tokopedia-inventory.service';
import { TokopediaWebhookService } from './services/tokopedia-webhook.service';

// Tokopedia controllers
import { TokopediaController } from './controllers/tokopedia.controller';
import { TokopediaWebhookController } from './controllers/tokopedia-webhook.controller';

// Tokopedia processors
import { TokopediaProcessor } from './processors/tokopedia.processor';

// Entity imports
import { IntegrationLog } from '../entities/integration-log.entity';
import { SyncStatus } from '../entities/sync-status.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { ChannelMapping } from '../../channels/entities/channel-mapping.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order.entity';
// import { InventoryLevel } from '../../inventory/entities/inventory-level.entity';

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
      ChannelMapping,
      Product,
      Order,
      OrderItem,
      // InventoryLevel,
    ]),

    // HTTP client for API calls
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
      headers: {
        'User-Agent': 'StokCerdas-Tokopedia-Integration/1.0',
      },
    }),

    // Configuration
    ConfigModule,

    // Event emitter
    EventEmitterModule,

    // Bull queue for async processing
    BullModule.registerQueue(
      {
        name: 'tokopedia',
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

    // Tokopedia core services
    TokopediaApiService,
    TokopediaAuthService,
    TokopediaProductService,
    TokopediaOrderService,
    TokopediaInventoryService,
    TokopediaWebhookService,

    // Async processors
    TokopediaProcessor,
  ],

  controllers: [TokopediaController, TokopediaWebhookController],

  exports: [
    // Export services for use in other modules
    TokopediaApiService,
    TokopediaAuthService,
    TokopediaProductService,
    TokopediaOrderService,
    TokopediaInventoryService,
    TokopediaWebhookService,
  ],
})
export class TokopediaModule {}
