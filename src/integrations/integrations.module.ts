import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Entities
import { IntegrationLog } from './entities/integration-log.entity';
import { SyncStatus } from './entities/sync-status.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { AccountingAccount } from './entities/accounting-account.entity';

// External entities
import { Channel } from '../channels/entities/channel.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';

// Common services
import { BaseApiService } from './common/services/base-api.service';
import { WebhookHandlerService } from './common/services/webhook-handler.service';
import { RateLimiterService } from './common/services/rate-limiter.service';
import { IntegrationLogService } from './common/services/integration-log.service';

// Platform-specific modules
import { ShopeeModule } from './shopee/shopee.module';
import { LazadaModule } from './lazada/lazada.module';
import { TokopediaModule } from './tokopedia/tokopedia.module';
import { MokaModule } from './moka/moka.module';

// Accounting software modules
import { QuickBooksModule } from './quickbooks/quickbooks.module';
import { AccurateModule } from './accurate/accurate.module';

// Controllers
import { WebhookController } from './controllers/webhook.controller';
import { IntegrationController } from './controllers/integration.controller';

// Processors
import { IntegrationProcessor } from './processors/integration.processor';

@Module({
  imports: [
    EventEmitterModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
      // retries: 3, // Property doesn't exist in HttpModuleOptions
    }),
    
    // Database entities
    TypeOrmModule.forFeature([
      // Integration entities
      IntegrationLog,
      SyncStatus,
      WebhookEvent,
      AccountingAccount,
      
      // External entities
      Channel,
      Product,
      Order,
    ]),
    
    // Bull queue for async integration operations
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
    
    // Platform-specific modules
    ShopeeModule,
    LazadaModule,
    TokopediaModule,
    MokaModule,
    
    // Accounting software modules
    QuickBooksModule,
    AccurateModule,
  ],
  
  controllers: [
    WebhookController,
    IntegrationController,
  ],
  
  providers: [
    // Common services
    BaseApiService,
    WebhookHandlerService,
    RateLimiterService,
    IntegrationLogService,
    
    // Queue processors
    IntegrationProcessor,
  ],
  
  exports: [
    // Export common services for platform modules
    BaseApiService,
    WebhookHandlerService,
    RateLimiterService,
    IntegrationLogService,
    
    // Platform modules
    ShopeeModule,
    LazadaModule,
    TokopediaModule,
    MokaModule,
    
    // Accounting software modules
    QuickBooksModule,
    AccurateModule,
  ],
})
export class IntegrationsModule {}