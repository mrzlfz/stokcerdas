import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';

// Entities
import { AccountingAccount } from '../entities/accounting-account.entity';
import { Order } from '../../orders/entities/order.entity';
// import { Invoice } from '../../invoices/entities/invoice.entity'; // TODO: Create invoice entity
import { Product } from '../../products/entities/product.entity';
// import { Customer } from '../../customers/entities/customer.entity'; // TODO: Create customer entity

// Services
import { AccurateApiService } from './services/accurate-api.service';
import { AccurateTaxComplianceService } from './services/accurate-tax-compliance.service';
import { AccurateMultiCurrencyService } from './services/accurate-multi-currency.service';

// Controllers
import { AccurateController } from './controllers/accurate.controller';

// Processors
import { AccurateProcessor } from './processors/accurate.processor';

// Common Services
import { IntegrationLogService } from '../common/services/integration-log.service';
import { WebhookHandlerService } from '../common/services/webhook-handler.service';
import { RateLimiterService } from '../common/services/rate-limiter.service';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      AccountingAccount,
      Order,
      // Invoice, // TODO: Uncomment when invoice entity is created
      Product,
      // Customer, // TODO: Uncomment when customer entity is created
    ]),

    // HTTP module for API calls
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
    }),

    // Bull queue for background jobs
    BullModule.registerQueue({
      name: 'accurate',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
      },
    }),
  ],

  controllers: [
    AccurateController,
  ],

  providers: [
    // Core API service
    AccurateApiService,

    // Business logic services
    AccurateTaxComplianceService,
    AccurateMultiCurrencyService,

    // Background job processor
    AccurateProcessor,

    // Common services (if not provided globally)
    IntegrationLogService,
    WebhookHandlerService,
    RateLimiterService,
  ],

  exports: [
    // Export services for use in other modules
    AccurateApiService,
    AccurateTaxComplianceService,
    AccurateMultiCurrencyService,
    AccurateProcessor,
  ],
})
export class AccurateModule {}