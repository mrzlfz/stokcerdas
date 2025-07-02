import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatus } from './entities/order-status.entity';

// External entities
import { Product } from '../products/entities/product.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User } from '../users/entities/user.entity';

// Services
import { OrdersService } from './services/orders.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderSyncService } from './services/order-sync.service';

// Controllers
import { OrdersController } from './controllers/orders.controller';

// Processors
import { OrderProcessor } from './processors/order.processor';

@Module({
  imports: [
    EventEmitterModule,
    
    // Database entities
    TypeOrmModule.forFeature([
      // Order entities
      Order,
      OrderItem,
      OrderStatus,
      
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
    OrderSyncService,
    
    // Queue processors
    OrderProcessor,
  ],
  
  exports: [
    // Export services for use by other modules
    OrdersService,
    OrderFulfillmentService,
    OrderSyncService,
  ],
})
export class OrdersModule {}