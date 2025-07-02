import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { InventoryLocation } from './entities/inventory-location.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';

import { InventoryLocationsController } from './controllers/inventory-locations.controller';
import { InventoryItemsController } from './controllers/inventory-items.controller';
import { InventoryTransactionsController } from './controllers/inventory-transactions.controller';

import { InventoryLocationsService } from './services/inventory-locations.service';
import { InventoryItemsService } from './services/inventory-items.service';
import { InventoryTransactionsService } from './services/inventory-transactions.service';
import { InventoryRealtimeService } from './services/inventory-realtime.service';

import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLocation,
      InventoryItem,
      InventoryTransaction,
    ]),
    AuthModule,
    ProductsModule,
    BullModule.registerQueue({ name: 'inventory' }),
  ],
  controllers: [
    InventoryLocationsController,
    InventoryItemsController,
    InventoryTransactionsController,
  ],
  providers: [
    InventoryLocationsService,
    InventoryItemsService,
    InventoryTransactionsService,
    InventoryRealtimeService,
  ],
  exports: [
    InventoryLocationsService,
    InventoryItemsService,
    InventoryTransactionsService,
    InventoryRealtimeService,
    TypeOrmModule,
  ],
})
export class InventoryModule {}