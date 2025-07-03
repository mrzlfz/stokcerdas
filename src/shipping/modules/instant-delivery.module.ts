import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';

// Entities
import { ShippingLabel } from '../entities/shipping-label.entity';
import { ShippingTracking } from '../entities/shipping-tracking.entity';
import { ShippingRate } from '../entities/shipping-rate.entity';

// Gojek Integration
import { GojekApiService } from '../integrations/gojek/services/gojek-api.service';
import { GojekShippingService } from '../integrations/gojek/services/gojek-shipping.service';

// Grab Integration
import { GrabApiService } from '../integrations/grab/services/grab-api.service';
import { GrabShippingService } from '../integrations/grab/services/grab-shipping.service';

// Common Services
import { IntegrationLogService } from '../../integrations/common/services/integration-log.service';

// Controllers
import { InstantDeliveryController } from '../controllers/instant-delivery.controller';

// Services
import { InstantDeliveryService } from '../services/instant-delivery.service';

// Processors
import { InstantDeliveryProcessor } from '../processors/instant-delivery.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShippingLabel,
      ShippingTracking,
      ShippingRate,
    ]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue({
      name: 'instant-delivery',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  providers: [
    // API Services
    GojekApiService,
    GrabApiService,
    
    // Shipping Services
    GojekShippingService,
    GrabShippingService,
    
    // Main Service
    InstantDeliveryService,
    
    // Processor
    InstantDeliveryProcessor,
    
    // Common Services
    IntegrationLogService,
  ],
  controllers: [
    InstantDeliveryController,
  ],
  exports: [
    InstantDeliveryService,
    GojekShippingService,
    GrabShippingService,
    GojekApiService,
    GrabApiService,
  ],
})
export class InstantDeliveryModule {}