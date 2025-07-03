import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantSubscriber } from './subscribers/tenant.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [TenantSubscriber],
  exports: [TenantSubscriber],
})
export class DatabaseModule {}