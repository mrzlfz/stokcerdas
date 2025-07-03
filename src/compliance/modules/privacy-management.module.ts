import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Privacy Management Entities
import {
  DataClassification,
  PrivacyConsent,
  DataRetentionPolicy,
  DataSubjectRequest,
  PrivacyBreachLog,
  DataProcessingActivity,
} from '../entities/privacy-management.entity';

// Privacy Management Services
import { PrivacyConsentService } from '../services/privacy-consent.service';
import { DataSubjectRightsService } from '../services/data-subject-rights.service';
import { DataRetentionService } from '../services/data-retention.service';

// Privacy Management Controllers
import { PrivacyManagementController } from '../controllers/privacy-management.controller';

// External modules and dependencies
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { SOC2ComplianceModule } from './soc2-compliance.module';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      // Data Privacy entities
      DataClassification,
      PrivacyConsent,
      DataRetentionPolicy,
      DataSubjectRequest,
      PrivacyBreachLog,
      DataProcessingActivity,
    ]),
    
    // Import required modules with forward references to avoid circular dependencies
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => SOC2ComplianceModule),
  ],
  controllers: [
    PrivacyManagementController,
  ],
  providers: [
    PrivacyConsentService,
    DataSubjectRightsService,
    DataRetentionService,
  ],
  exports: [
    PrivacyConsentService,
    DataSubjectRightsService,
    DataRetentionService,
  ],
})
export class PrivacyManagementModule {}