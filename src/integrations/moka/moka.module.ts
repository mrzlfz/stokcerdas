import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

// Controllers
import { MokaController } from './controllers/moka.controller';

// Services
import { MokaApiService } from './services/moka-api.service';
import { MokaAuthService } from './services/moka-auth.service';
import { MokaProductService } from './services/moka-product.service';
import { MokaSalesService } from './services/moka-sales.service';

// Entities
import { Channel } from '../../channels/entities/channel.entity';
import { ChannelMapping } from '../../channels/entities/channel-mapping.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

// Common services
import { IntegrationLogService } from '../common/services/integration-log.service';

@Module({
  imports: [
    // HTTP module for API calls
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    
    // TypeORM entities
    TypeOrmModule.forFeature([
      Channel,
      ChannelMapping,
      Product,
      Order,
      OrderItem,
      InventoryItem,
    ]),
  ],
  controllers: [
    MokaController,
  ],
  providers: [
    // API services
    MokaApiService,
    
    // Business logic services
    MokaAuthService,
    MokaProductService,
    MokaSalesService,
    
    // Common services
    IntegrationLogService,
  ],
  exports: [
    // Export services for use in other modules
    MokaApiService,
    MokaAuthService,
    MokaProductService,
    MokaSalesService,
  ],
})
export class MokaModule {}