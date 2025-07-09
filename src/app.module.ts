import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
// Fix for cache-manager-redis-store type compatibility
const redisStore = require('cache-manager-redis-store');

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { authConfig } from './config/auth.config';
import { storageConfig } from './config/storage.config';

// Indonesian Business Context Configuration
import { indonesianBusinessRulesConfig } from './config/indonesian-business-rules.config';
import { indonesianPaymentConfig } from './config/indonesian-payments.config';
import { indonesianGeographyConfig } from './config/indonesian-geography.config';
import { indonesianTelecomConfig } from './config/indonesian-telecom.config';
import { indonesianBusinessCalendarConfig } from './config/indonesian-business-calendar.config';

// Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { AlertsModule } from './alerts/alerts.module';
import { MLForecastingModule } from './ml-forecasting/ml-forecasting.module';
import { OrdersModule } from './orders/orders.module';
import { ChannelsModule } from './channels/channels.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AutomationModule } from './automation/automation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ShippingModule } from './shipping/shipping.module';
import { CustomersModule } from './customers/customers.module';
// import { TestingModule } from './testing/testing.module';
// import { DeploymentModule } from './deployment/deployment.module';

// Common modules
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        redisConfig,
        authConfig,
        storageConfig,
        // Indonesian Business Context Configuration
        indonesianBusinessRulesConfig,
        indonesianPaymentConfig,
        indonesianGeographyConfig,
        indonesianTelecomConfig,
        indonesianBusinessCalendarConfig,
      ],
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
    }),

    // Event System
    EventEmitterModule.forRoot({
      // Set this to `true` to use wildcards
      wildcard: false,
      // The delimiter used to segment namespaces
      delimiter: '.',
      // Set this to `true` if you want to emit the newListener event
      newListener: false,
      // Set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // The maximum amount of listeners that can be assigned to an event
      maxListeners: 50,
      // Show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: false,
      // Disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get('database.synchronize', false),
        logging: configService.get('database.logging', false),
        ssl: configService.get('database.ssl', false),
        extra: {
          max: configService.get('database.maxConnections', 100),
          connectionTimeoutMillis: 30000,
          idleTimeoutMillis: 30000,
        },
      }),
      inject: [ConfigService],
    }),

    // Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore as any,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        password: configService.get('redis.password'),
        db: configService.get('redis.db', 0),
        ttl: configService.get('redis.ttl', 3600),
      }),
      inject: [ConfigService],
    }),

    // Bull Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),

    // Application modules
    DatabaseModule,
    CommonModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    InventoryModule,
    OrdersModule,
    CustomersModule,
    ChannelsModule,
    // IntegrationsModule, // Temporarily disabled for health monitoring testing
    AutomationModule,
    ReportsModule,
    AlertsModule,
    MLForecastingModule, // Re-enabled - no circular dependencies found
    AnalyticsModule, // Re-enabled - duplicate service provision fixed
    NotificationsModule,
    ComplianceModule, // Re-enabled - EnterprisePermissionsGuard service layer fixes
    ShippingModule, // Re-enabled with forwardRef() fixes
    // TestingModule, // Integration testing infrastructure for comprehensive testing (disabled - missing module)
    // DeploymentModule, // Docker container configuration and deployment infrastructure (disabled - missing module)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
