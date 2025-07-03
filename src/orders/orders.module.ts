import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Order } from './entities/order.entity';
// Note: OrderItem and OrderStatus entities are embedded in Order entity

// External entities
import { Product } from '../products/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User } from '../users/entities/user.entity';

// Services
import { OrdersService } from './services/orders.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
// Note: OrderSyncService and OrderRoutingService to be implemented
// import { OrderSyncService } from './services/order-sync.service';
// import { OrderRoutingService } from './services/order-routing.service';

// Controllers
import { OrdersController } from './controllers/orders.controller';

// Processors
// Note: OrderProcessor to be implemented
// import { OrderProcessor } from './processors/order.processor';

@Module({
  imports: [
    EventEmitterModule,
    
    // Database entities
    TypeOrmModule.forFeature([
      // Order entities
      Order,
      
      // External entities
      Product,
      InventoryItem,
      User,
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
  ],
  
  controllers: [
    OrdersController,
  ],
  
  providers: [
    // Core services
    OrdersService,
    OrderFulfillmentService,
    // OrderSyncService,
    // OrderRoutingService,
    
    // Queue processors
    // OrderProcessor,
  ],
  
  exports: [
    // Export services for use by other modules
    OrdersService,
    OrderFulfillmentService,
    // OrderSyncService,
    // OrderRoutingService,
  ],
})
export class OrdersModule {}