import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';

// Controllers
import { ShippingController } from './controllers/shipping.controller';
import { InstantDeliveryController } from './controllers/instant-delivery.controller';

// Services
import { ShippingService } from './services/shipping.service';
import { InstantDeliveryService } from './services/instant-delivery.service';

// Entities
import { ShippingLabel } from './entities/shipping-label.entity';
import { ShippingRate } from './entities/shipping-rate.entity';
import { ShippingTracking } from './entities/shipping-tracking.entity';
import { Order } from '../orders/entities/order.entity';

// Integration Services
import { JneShippingService } from './integrations/jne/services/jne-shipping.service';
import { JneApiService } from './integrations/jne/services/jne-api.service';
import { JntShippingService } from './integrations/jnt/services/jnt-shipping.service';
import { JntApiService } from './integrations/jnt/services/jnt-api.service';
import { GojekShippingService } from './integrations/gojek/services/gojek-shipping.service';
import { GojekApiService } from './integrations/gojek/services/gojek-api.service';
import { GrabShippingService } from './integrations/grab/services/grab-shipping.service';
import { GrabApiService } from './integrations/grab/services/grab-api.service';

// External modules
import { OrdersModule } from '../orders/orders.module';
import { IntegrationsModule } from '../integrations/integrations.module';

// Processors
import { InstantDeliveryProcessor } from './processors/instant-delivery.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShippingLabel,
      ShippingRate,
      ShippingTracking,
      Order,
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
    forwardRef(() => OrdersModule),
    IntegrationsModule,
  ],
  controllers: [
    ShippingController,
    InstantDeliveryController,
  ],
  providers: [
    // Core services
    ShippingService,
    InstantDeliveryService,
    
    // Integration services - JNE
    JneShippingService,
    JneApiService,
    
    // Integration services - J&T Express  
    JntShippingService,
    JntApiService,
    
    // Integration services - Gojek (instant delivery)
    GojekShippingService,
    GojekApiService,
    
    // Integration services - Grab (instant delivery)
    GrabShippingService,
    GrabApiService,
    
    // Background processors
    InstantDeliveryProcessor,
  ],
  exports: [
    ShippingService,
    InstantDeliveryService,
    JneShippingService,
    JntShippingService,
    GojekShippingService,
    GrabShippingService,
    GojekApiService,
    GrabApiService,
  ],
})
export class ShippingModule {}