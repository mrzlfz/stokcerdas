import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { AlertConfiguration } from './entities/alert-configuration.entity';
import { AlertInstance } from './entities/alert-instance.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User } from '../users/entities/user.entity';

// Services
import { AlertConfigurationService } from './services/alert-configuration.service';
import { AlertManagementService } from './services/alert-management.service';
import { AlertIntegrationService } from './services/alert-integration.service';
import { EmailNotificationService } from './services/email-notification.service';

// Controllers
import { AlertConfigurationController } from './controllers/alert-configuration.controller';
import { AlertManagementController } from './controllers/alert-management.controller';
import { EmailNotificationController } from './controllers/email-notification.controller';

// Listeners
import { AlertEmailListener } from './listeners/alert-email.listener';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    TypeOrmModule.forFeature([
      AlertConfiguration,
      AlertInstance,
      Product,
      InventoryLocation,
      InventoryItem,
      User,
    ]),
  ],
  controllers: [
    AlertConfigurationController,
    AlertManagementController,
    EmailNotificationController,
  ],
  providers: [
    AlertConfigurationService,
    AlertManagementService,
    AlertIntegrationService,
    EmailNotificationService,
    AlertEmailListener,
  ],
  exports: [
    AlertConfigurationService,
    AlertManagementService,
    AlertIntegrationService,
    EmailNotificationService,
  ],
})
export class AlertsModule {}
