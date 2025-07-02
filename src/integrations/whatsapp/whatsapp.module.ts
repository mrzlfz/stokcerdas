import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Common integration imports
import { IntegrationLogService } from '../common/services/integration-log.service';
import { RateLimiterService } from '../common/services/rate-limiter.service';
import { WebhookHandlerService } from '../common/services/webhook-handler.service';

// WhatsApp services
import { WhatsAppApiService } from './services/whatsapp-api.service';
import { WhatsAppAuthService } from './services/whatsapp-auth.service';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { WhatsAppTemplateService } from './services/whatsapp-template.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';

// WhatsApp controllers
import { WhatsAppController } from './controllers/whatsapp.controller';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';

// WhatsApp processors
import { WhatsAppProcessor } from './processors/whatsapp.processor';

// Entity imports
import { IntegrationLog } from '../entities/integration-log.entity';
import { SyncStatus } from '../entities/sync-status.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { ChannelMapping } from '../../channels/entities/channel-mapping.entity';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      // Integration entities
      IntegrationLog,
      SyncStatus,
      WebhookEvent,
      // Business entities
      Channel,
      ChannelMapping,
    ]),

    // HTTP client for API calls
    HttpModule.register({
      timeout: 60000, // 60 seconds for media uploads
      maxRedirects: 5,
      headers: {
        'User-Agent': 'StokCerdas-WhatsApp-Integration/1.0',
      },
    }),

    // Configuration
    ConfigModule,

    // Event emitter
    EventEmitterModule,

    // Bull queue for async processing
    BullModule.registerQueue(
      {
        name: 'whatsapp',
        defaultJobOptions: {
          attempts: 3,
          delay: 1000, // 1 second delay
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 200, // Keep last 200 failed jobs
        },
      },
      {
        name: 'whatsapp-bulk',
        defaultJobOptions: {
          attempts: 2,
          delay: 5000, // 5 seconds delay for bulk operations
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
      {
        name: 'whatsapp-webhooks',
        defaultJobOptions: {
          attempts: 5, // More attempts for webhook processing
          delay: 500, // Quick processing for webhooks
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 200,
          removeOnFail: 300,
        },
      },
      {
        name: 'whatsapp-media',
        defaultJobOptions: {
          attempts: 3,
          delay: 2000, // Delay for media operations
          timeout: 120000, // 2 minutes timeout for media processing
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
    ),
  ],

  providers: [
    // Common integration services
    IntegrationLogService,
    RateLimiterService,
    WebhookHandlerService,

    // WhatsApp core services
    WhatsAppApiService,
    WhatsAppAuthService,
    WhatsAppMessageService,
    WhatsAppTemplateService,
    WhatsAppWebhookService,

    // Async processors
    WhatsAppProcessor,
  ],

  controllers: [
    WhatsAppController,
    WhatsAppWebhookController,
  ],

  exports: [
    // Export services for use in other modules
    WhatsAppApiService,
    WhatsAppAuthService,
    WhatsAppMessageService,
    WhatsAppTemplateService,
    WhatsAppWebhookService,
  ],
})
export class WhatsAppModule {}