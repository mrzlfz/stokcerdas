import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

// Entities
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderApproval,
  PurchaseOrderStatusHistory,
} from './entities/purchase-order.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';

// Controllers
import { PurchaseOrdersController } from './controllers/purchase-orders.controller';

// Services
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { PurchaseOrderPdfService } from './services/purchase-order-pdf.service';
import { PurchaseOrderEmailService } from './services/purchase-order-email.service';

// Processors
import { PurchaseOrderProcessor } from './processors/purchase-order.processor';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      PurchaseOrderApproval,
      PurchaseOrderStatusHistory,
      Supplier,
      Product,
      User,
    ]),

    // Bull queues
    BullModule.registerQueue({
      name: 'purchase-orders',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [
    PurchaseOrdersController,
  ],
  providers: [
    PurchaseOrdersService,
    PurchaseOrderPdfService,
    PurchaseOrderEmailService,
    PurchaseOrderProcessor,
  ],
  exports: [
    PurchaseOrdersService,
    PurchaseOrderPdfService,
    PurchaseOrderEmailService,
  ],
})
export class PurchaseOrdersModule {}