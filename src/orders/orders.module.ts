import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Entities
import { Order, OrderItem, OrderStatusHistory } from './entities/order.entity';

// External entities
import { Product } from '../products/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';

// Shipping entities
import { ShippingLabel } from '../shipping/entities/shipping-label.entity';
import { ShippingTracking } from '../shipping/entities/shipping-tracking.entity';
import { ShippingRate } from '../shipping/entities/shipping-rate.entity';

// Services
import { OrdersService } from './services/orders.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderRoutingService } from './services/order-routing.service';
import { OrderFulfillmentShippingService } from './services/order-fulfillment-shipping.service';
// Note: OrderSyncService to be implemented
// import { OrderSyncService } from './services/order-sync.service';

// Note: Shipping services are now provided by ShippingModule to avoid circular dependency

// Controllers
import { OrdersController } from './controllers/orders.controller';
import { OrderRoutingController } from './controllers/order-routing.controller';

// Processors
// Note: OrderProcessor to be implemented
// import { OrderProcessor } from './processors/order.processor';

// External modules
import { ChannelsModule } from '../channels/channels.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [
    EventEmitterModule,

    // HTTP module for API calls
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),

    // Database entities
    TypeOrmModule.forFeature([
      // Order entities
      Order,
      OrderItem,
      OrderStatusHistory,

      // External entities
      Product,
      InventoryItem,
      InventoryLocation,
      User,
      Channel,

      // Shipping entities
      ShippingLabel,
      ShippingTracking,
      ShippingRate,
    ]),

    // Bull queue for async order processing
    BullModule.registerQueue({
      name: 'orders',
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    }),

    // External modules
    forwardRef(() => ChannelsModule),
    forwardRef(() => ShippingModule),
    IntegrationsModule,
  ],

  controllers: [OrdersController, OrderRoutingController],

  providers: [
    // Core services
    OrdersService,
    OrderFulfillmentService,
    OrderRoutingService,
    OrderFulfillmentShippingService,
    // OrderSyncService,

    // Note: Shipping services are now provided by ShippingModule

    // Queue processors
    // OrderProcessor,
  ],

  exports: [
    // Export services for use by other modules
    OrdersService,
    OrderFulfillmentService,
    OrderRoutingService,
    OrderFulfillmentShippingService,
    // OrderSyncService,
    TypeOrmModule, // Export TypeORM for Order entities
  ],
})
export class OrdersModule {}
