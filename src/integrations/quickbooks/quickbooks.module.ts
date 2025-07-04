import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';

// Entities
import { AccountingAccount } from '../entities/accounting-account.entity';
import { IntegrationLog } from '../entities/integration-log.entity';
import { SyncStatus } from '../entities/sync-status.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { Order, OrderItem } from '../../orders/entities/order.entity';
// import { Invoice } from '../../invoices/entities/invoice.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';
// import { Customer } from '../../customers/entities/customer.entity';

// Services
import { QuickBooksApiService } from './services/quickbooks-api.service';
import { QuickBooksItemSyncService } from './services/quickbooks-item-sync.service';
import { QuickBooksCOGSService } from './services/quickbooks-cogs.service';
import { QuickBooksInvoiceService } from './services/quickbooks-invoice.service';

// Controllers
import { QuickBooksController } from './controllers/quickbooks.controller';

// Processors
import { QuickBooksProcessor } from './processors/quickbooks.processor';

// Common Services
import { IntegrationLogService } from '../common/services/integration-log.service';
import { RateLimiterService } from '../common/services/rate-limiter.service';
import { WebhookHandlerService } from '../common/services/webhook-handler.service';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      AccountingAccount,
      IntegrationLog,
      SyncStatus,
      WebhookEvent,
      Order,
      OrderItem,
      // Invoice,
      Product,
      InventoryTransaction,
      // Customer,
    ]),

    // HTTP module for API calls
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
    }),

    // Bull queue for background jobs
    BullModule.registerQueue(
      {
        name: 'quickbooks',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50, // Keep last 50 failed jobs
        },
      },
      {
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
      },
    ),
  ],

  controllers: [QuickBooksController],

  providers: [
    // Core API service
    QuickBooksApiService,

    // Business logic services
    QuickBooksItemSyncService,
    QuickBooksCOGSService,
    QuickBooksInvoiceService,

    // Background job processor
    QuickBooksProcessor,

    // Common services (if not provided globally)
    IntegrationLogService,
    RateLimiterService,
    WebhookHandlerService,
  ],

  exports: [
    // Export services for use in other modules
    QuickBooksApiService,
    QuickBooksItemSyncService,
    QuickBooksCOGSService,
    QuickBooksInvoiceService,
    QuickBooksProcessor,
  ],
})
export class QuickBooksModule {}
