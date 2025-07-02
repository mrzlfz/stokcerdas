import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Channel } from '../../channels/entities/channel.entity';
import { ChannelInventory } from '../../channels/entities/channel-inventory.entity';
import { ChannelMapping } from '../../channels/entities/channel-mapping.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { IntegrationLog } from '../entities/integration-log.entity';

// Common services
import { BaseApiService } from '../common/services/base-api.service';
import { RateLimiterService } from '../common/services/rate-limiter.service';
import { IntegrationLogService } from '../common/services/integration-log.service';

// Shopee services
import { ShopeeApiService } from './services/shopee-api.service';
import { ShopeeAuthService } from './services/shopee-auth.service';
import { ShopeeProductService } from './services/shopee-product.service';
import { ShopeeOrderService } from './services/shopee-order.service';
import { ShopeeInventoryService } from './services/shopee-inventory.service';
import { ShopeeWebhookService } from './services/shopee-webhook.service';

// Controllers
import { ShopeeController } from './controllers/shopee.controller';
import { ShopeeWebhookController } from './controllers/shopee-webhook.controller';

// Processors
import { ShopeeProcessor } from './processors/shopee.processor';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    
    // Database entities
    TypeOrmModule.forFeature([
      Channel,
      ChannelInventory,
      ChannelMapping,
      Product,
      Order,
      IntegrationLog,
    ]),
    
    // Bull queue for Shopee operations
    BullModule.registerQueue({
      name: 'shopee',
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  
  controllers: [
    ShopeeController,
    ShopeeWebhookController,
  ],
  
  providers: [
    // Common services
    BaseApiService,
    RateLimiterService,
    IntegrationLogService,
    
    // Shopee-specific services
    ShopeeApiService,
    ShopeeAuthService,
    ShopeeProductService,
    ShopeeOrderService,
    ShopeeInventoryService,
    ShopeeWebhookService,
    
    // Queue processors
    ShopeeProcessor,
  ],
  
  exports: [
    ShopeeApiService,
    ShopeeAuthService,
    ShopeeProductService,
    ShopeeOrderService,
    ShopeeInventoryService,
    ShopeeWebhookService,
  ],
})
export class ShopeeModule {}