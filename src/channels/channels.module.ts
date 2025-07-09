import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Channel } from './entities/channel.entity';
import { ChannelConfig } from './entities/channel-config.entity';
import { ChannelInventory } from './entities/channel-inventory.entity';
import { ChannelMapping } from './entities/channel-mapping.entity';

// External entities
import { Product } from '../products/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';

// Integration entities
import { IntegrationLog } from '../integrations/entities/integration-log.entity';
import { WebhookEvent } from '../integrations/entities/webhook-event.entity';
import { SyncStatus } from '../integrations/entities/sync-status.entity';

// Services
import { ChannelsService } from './services/channels.service';
import { ChannelInventoryService } from './services/channel-inventory.service';
import { ChannelMappingService } from './services/channel-mapping.service';
import { ChannelSyncService } from './services/channel-sync.service';

// Controllers
import { ChannelsController } from './controllers/channels.controller';
import { ChannelInventoryController } from './controllers/channel-inventory.controller';

// Processors
import { ChannelSyncProcessor } from './processors/channel-sync.processor';

// Integration services - Shopee
import { ShopeeApiService } from '../integrations/shopee/services/shopee-api.service';
import { ShopeeAuthService } from '../integrations/shopee/services/shopee-auth.service';
import { ShopeeProductService } from '../integrations/shopee/services/shopee-product.service';
import { ShopeeOrderService } from '../integrations/shopee/services/shopee-order.service';
import { ShopeeInventoryService } from '../integrations/shopee/services/shopee-inventory.service';

// Integration services - Lazada
import { LazadaApiService } from '../integrations/lazada/services/lazada-api.service';
import { LazadaAuthService } from '../integrations/lazada/services/lazada-auth.service';
import { LazadaProductService } from '../integrations/lazada/services/lazada-product.service';
import { LazadaOrderService } from '../integrations/lazada/services/lazada-order.service';
import { LazadaInventoryService } from '../integrations/lazada/services/lazada-inventory.service';

// Integration services - Tokopedia
import { TokopediaApiService } from '../integrations/tokopedia/services/tokopedia-api.service';
import { TokopediaAuthService } from '../integrations/tokopedia/services/tokopedia-auth.service';
import { TokopediaProductService } from '../integrations/tokopedia/services/tokopedia-product.service';
import { TokopediaOrderService } from '../integrations/tokopedia/services/tokopedia-order.service';
import { TokopediaInventoryService } from '../integrations/tokopedia/services/tokopedia-inventory.service';

// Integration services - WhatsApp
import { WhatsAppApiService } from '../integrations/whatsapp/services/whatsapp-api.service';
import { WhatsAppAuthService } from '../integrations/whatsapp/services/whatsapp-auth.service';

// Common integration services
import { IntegrationLogService } from '../integrations/common/services/integration-log.service';
import { RateLimiterService } from '../integrations/common/services/rate-limiter.service';
import { WebhookHandlerService } from '../integrations/common/services/webhook-handler.service';
import { ErrorHandlingService } from '../integrations/common/services/error-handling.service';
import { RetryService } from '../integrations/common/services/retry.service';
import { CircuitBreakerService } from '../integrations/common/services/circuit-breaker.service';

@Module({
  imports: [
    // Event emitter for real-time updates
    EventEmitterModule,

    // HTTP client for external API calls
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
      headers: {
        'User-Agent': 'StokCerdas-Channel-Management/1.0',
      },
    }),

    // Database entities
    TypeOrmModule.forFeature([
      // Channel entities
      Channel,
      ChannelConfig,
      ChannelInventory,
      ChannelMapping,

      // External entities
      Product,
      InventoryItem,
      InventoryTransaction,
      InventoryLocation,
      Order,
      OrderItem,

      // Integration entities
      IntegrationLog,
      WebhookEvent,
      SyncStatus,
    ]),

    // Bull queue for async channel operations
    BullModule.registerQueue({
      name: 'channel-sync',
      defaultJobOptions: {
        removeOnComplete: 50, // Keep last 50 completed jobs
        removeOnFail: 100, // Keep last 100 failed jobs
        attempts: 3, // 3 retry attempts
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
      },
    }),

    // Bull queue for integrations (needed by WebhookHandlerService)
    BullModule.registerQueue({
      name: 'integrations',
      defaultJobOptions: {
        removeOnComplete: 25,
        removeOnFail: 15,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    }),
  ],

  controllers: [ChannelsController, ChannelInventoryController],

  providers: [
    // Core channel services
    ChannelsService,
    ChannelInventoryService,
    ChannelMappingService,
    ChannelSyncService,

    // Queue processors
    ChannelSyncProcessor,

    // Integration services - Shopee
    ShopeeApiService,
    ShopeeAuthService,
    ShopeeProductService,
    ShopeeOrderService,
    ShopeeInventoryService,

    // Integration services - Lazada
    LazadaApiService,
    LazadaAuthService,
    LazadaProductService,
    LazadaOrderService,
    LazadaInventoryService,

    // Integration services - Tokopedia
    TokopediaApiService,
    TokopediaAuthService,
    TokopediaProductService,
    TokopediaOrderService,
    TokopediaInventoryService,

    // Integration services - WhatsApp
    WhatsAppApiService,
    WhatsAppAuthService,

    // Common integration services
    IntegrationLogService,
    RateLimiterService,
    WebhookHandlerService,
    ErrorHandlingService,
    RetryService,
    CircuitBreakerService,
  ],

  exports: [
    // Export core services for use by other modules
    ChannelsService,
    ChannelInventoryService,
    ChannelMappingService,
    ChannelSyncService,

    // Export for integration modules
    IntegrationLogService,
    RateLimiterService,
    WebhookHandlerService,
    ErrorHandlingService,
    RetryService,
    CircuitBreakerService,
  ],
})
export class ChannelsModule {}
