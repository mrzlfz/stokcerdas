/**
 * Configuration Module
 * Provides comprehensive Indonesian configuration management with validation and fallback
 * Registers all configuration-related services and controllers
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { ConfigurationMapping } from './entities/configuration-mapping.entity';
import { ConfigurationHistory } from './entities/configuration-history.entity';

// Services
import { IndonesianConfigurationMappingService } from './services/indonesian-configuration-mapping.service';
import { IndonesianConfigurationValidatorService } from './services/indonesian-configuration-validator.service';
import { IndonesianConfigurationFallbackService } from './services/indonesian-configuration-fallback.service';
import { IndonesianConfigurationAdminService } from './services/indonesian-configuration-admin.service';
import { IndonesianConfigurationCacheService } from './services/indonesian-configuration-cache.service';

// Controllers
import { ConfigurationMappingController } from './controllers/configuration-mapping.controller';

@Module({
  imports: [
    // TypeORM for database entities
    TypeOrmModule.forFeature([ConfigurationMapping, ConfigurationHistory]),

    // NestJS Config Module for environment variables
    NestConfigModule,

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Event emitter for configuration events
    EventEmitterModule.forRoot(),
  ],

  providers: [
    // Enhanced multi-tier cache service
    IndonesianConfigurationCacheService,

    // Core configuration mapping service
    IndonesianConfigurationMappingService,

    // Enhanced validation service
    IndonesianConfigurationValidatorService,

    // Enhanced fallback service
    IndonesianConfigurationFallbackService,

    // Administrative service
    IndonesianConfigurationAdminService,
  ],

  controllers: [
    // REST API controller for configuration management
    ConfigurationMappingController,
  ],

  exports: [
    // Export services for use in other modules
    IndonesianConfigurationCacheService,
    IndonesianConfigurationMappingService,
    IndonesianConfigurationValidatorService,
    IndonesianConfigurationFallbackService,
    IndonesianConfigurationAdminService,
  ],
})
export class ConfigModule {}
