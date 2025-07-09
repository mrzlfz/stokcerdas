import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Customer } from './entities/customer.entity';
import { CustomerSegment } from './entities/customer-segment.entity';
import { CustomerTransaction } from './entities/customer-transaction.entity';
import { CustomerJourney } from './entities/customer-journey.entity';
import { CustomerTouchpoint } from './entities/customer-touchpoint.entity';
import { CustomerInteraction } from './entities/customer-interaction.entity';
import { CustomerPrediction } from './entities/customer-prediction.entity';
import { CustomerCommunication } from './entities/customer-communication.entity';
import { MarketingCampaign } from './entities/marketing-campaign.entity';
import { CommunicationTemplate } from './entities/communication-template.entity';
import {
  CustomerLoyaltyPoints,
  CustomerLoyaltyTier,
  CustomerLoyaltyReward,
  CustomerLoyaltyRedemption,
} from './entities/customer-loyalty.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

import { CustomersService } from './services/customers.service';
import { CustomerDataMigrationService } from './services/customer-data-migration.service';
import { CustomerAnalyticsService } from './services/customer-analytics.service';
import { CustomerMetricsCalculatorService } from './services/customer-metrics-calculator.service';
import { CustomerSegmentationEngineService } from './services/customer-segmentation-engine.service';
import { PurchaseBehaviorAnalyzerService } from './services/purchase-behavior-analyzer.service';
import { CustomerDataPipelineService } from './services/customer-data-pipeline.service';
import { CustomerJourneyTrackingService } from './services/customer-journey-tracking.service';
import { PredictiveCustomerAnalyticsService } from './services/predictive-customer-analytics.service';
import { CustomerCommunicationHistoryService } from './services/customer-communication-history.service';
import { CustomerInsightsDashboardService } from './services/customer-insights-dashboard.service';
import { CustomerInsightsEnhancedService } from './services/customer-insights.enhanced';
import { CustomerLoyaltyService } from './services/customer-loyalty.service';
import { CustomerAnalyticsQueryOptimizationService } from './services/customer-analytics-query-optimization.service';
import { CustomerAnalyticsCacheService } from './services/customer-analytics-cache.service';

import { CustomersController } from './controllers/customers.controller';
import { CustomerMigrationController } from './controllers/customer-migration.controller';
import { CustomerAnalyticsController } from './controllers/customer-analytics.controller';
import { CustomerMetricsController } from './controllers/customer-metrics.controller';
import { PurchaseBehaviorController } from './controllers/purchase-behavior.controller';
import { CustomerDataPipelineController } from './controllers/customer-data-pipeline.controller';
import { CustomerJourneyTrackingController } from './controllers/customer-journey-tracking.controller';
import { PredictiveCustomerAnalyticsController } from './controllers/predictive-customer-analytics.controller';
import { CustomerCommunicationHistoryController } from './controllers/customer-communication-history.controller';
import { CustomerInsightsDashboardController } from './controllers/customer-insights-dashboard.controller';
import { CustomerLoyaltyController } from './controllers/customer-loyalty.controller';

import { CustomerDataPipelineProcessor } from './processors/customer-data-pipeline.processor';

import { CustomerInsightsDashboardGateway } from './gateways/customer-insights-dashboard.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerSegment,
      CustomerTransaction,
      CustomerJourney,
      CustomerTouchpoint,
      CustomerInteraction,
      CustomerPrediction,
      CustomerCommunication,
      MarketingCampaign,
      CommunicationTemplate,
      CustomerLoyaltyPoints,
      CustomerLoyaltyTier,
      CustomerLoyaltyReward,
      CustomerLoyaltyRedemption,
      Order, // Needed for customer data migration from orders
      OrderItem, // Needed for order item analysis in pipeline
    ]),
    ScheduleModule.forRoot(), // For scheduled analytics refresh
    EventEmitterModule.forRoot(), // For real-time event processing

    // Redis configuration for customer analytics caching
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        readyLog: true,
        config: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          db: configService.get('redis.db', 0),
          keyPrefix: configService.get(
            'redis.keyPrefix',
            'stokcerdas:customers:',
          ),
          retryAttempts: configService.get('redis.retryAttempts', 3),
          retryDelay: configService.get('redis.retryDelay', 3000),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        },
      }),
      inject: [ConfigService],
    }),

    // Bull queue for customer data pipeline processing
    BullModule.registerQueue({
      name: 'customer-data-pipeline',
      defaultJobOptions: {
        removeOnComplete: 100, // Keep completed jobs for monitoring
        removeOnFail: 50, // Keep failed jobs for debugging
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  controllers: [
    CustomersController,
    CustomerMigrationController,
    CustomerAnalyticsController,
    CustomerMetricsController,
    PurchaseBehaviorController,
    CustomerDataPipelineController,
    CustomerJourneyTrackingController,
    PredictiveCustomerAnalyticsController,
    CustomerCommunicationHistoryController,
    CustomerInsightsDashboardController,
    CustomerLoyaltyController,
  ],
  providers: [
    CustomersService,
    CustomerDataMigrationService,
    CustomerAnalyticsService,
    CustomerMetricsCalculatorService,
    CustomerSegmentationEngineService,
    PurchaseBehaviorAnalyzerService,
    CustomerDataPipelineService,
    CustomerJourneyTrackingService,
    PredictiveCustomerAnalyticsService,
    CustomerCommunicationHistoryService,
    CustomerInsightsDashboardService,
    CustomerInsightsEnhancedService,
    CustomerLoyaltyService,
    CustomerAnalyticsQueryOptimizationService,
    CustomerAnalyticsCacheService,

    // WebSocket gateways
    CustomerInsightsDashboardGateway,

    // Queue processors
    CustomerDataPipelineProcessor,
  ],
  exports: [
    CustomersService,
    CustomerDataMigrationService,
    CustomerAnalyticsService,
    CustomerMetricsCalculatorService,
    CustomerSegmentationEngineService,
    PurchaseBehaviorAnalyzerService,
    CustomerDataPipelineService, // Export for use in other modules
    CustomerJourneyTrackingService, // Export for use in other modules
    PredictiveCustomerAnalyticsService, // Export for use in other modules
    CustomerCommunicationHistoryService, // Export for use in other modules
    CustomerInsightsDashboardService, // Export for use in other modules
    CustomerInsightsEnhancedService, // Export for enhanced customer insights analysis
    CustomerLoyaltyService, // Export for use in other modules
    CustomerAnalyticsQueryOptimizationService, // Export for performance optimization
    CustomerAnalyticsCacheService, // Export for caching strategy
    TypeOrmModule,
  ],
})
export class CustomersModule {}
