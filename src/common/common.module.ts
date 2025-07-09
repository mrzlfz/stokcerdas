import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@liaoliaots/nestjs-redis';

import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { RealtimeGateway } from './gateways/realtime.gateway';
import { RealtimeStateService } from './services/realtime-state.service';
import { OptimisticUpdatesService } from './services/optimistic-updates.service';
// import { DeadLetterQueueService } from './services/dead-letter-queue.service'; // Temporarily disabled
import { SyncMonitoringService } from './services/sync-monitoring.service';
import { DependencyHealthService } from './services/dependency-health.service';
import { HealthController } from './controllers/health.controller';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';

// Import entities
// import { DeadLetterJob } from './entities/dead-letter-job.entity'; // Temporarily disabled
// import { JobFailurePattern } from './entities/job-failure-pattern.entity'; // Temporarily disabled
// import { JobRecoveryLog } from './entities/job-recovery-log.entity'; // Temporarily disabled
import { SyncMetrics } from './entities/sync-metrics.entity';
import { IntegrationLog } from '../integrations/entities/integration-log.entity';

@Global()
@Module({
  imports: [
    AuthModule,
    IntegrationsModule,
    RedisModule,
    TypeOrmModule.forFeature([
      // DeadLetterJob, // Temporarily disabled
      // JobFailurePattern, // Temporarily disabled
      // JobRecoveryLog, // Temporarily disabled
      SyncMetrics,
      IntegrationLog,
    ]),
    // BullModule.registerQueue({
    //   name: 'dead-letter-queue',
    // }), // Temporarily disabled
    ScheduleModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    RealtimeGateway,
    RealtimeStateService,
    OptimisticUpdatesService,
    // DeadLetterQueueService, // Temporarily disabled due to IntegrationsModule dependency
    SyncMonitoringService,
    DependencyHealthService,
  ],
  exports: [
    RealtimeGateway,
    RealtimeStateService,
    OptimisticUpdatesService,
    // DeadLetterQueueService, // Temporarily disabled due to IntegrationsModule dependency
    SyncMonitoringService,
    DependencyHealthService,
  ],
})
export class CommonModule {}
