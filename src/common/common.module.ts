import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { RealtimeGateway } from './gateways/realtime.gateway';
import { RealtimeStateService } from './services/realtime-state.service';
import { OptimisticUpdatesService } from './services/optimistic-updates.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
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
  ],
  exports: [RealtimeGateway, RealtimeStateService, OptimisticUpdatesService],
})
export class CommonModule {}
