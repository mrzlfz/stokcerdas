import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Import required entities for security
import { User } from '../users/entities/user.entity';
import { Company } from '../auth/entities/company.entity';
import { Department } from '../auth/entities/department.entity';
import { HierarchicalRole } from '../auth/entities/hierarchical-role.entity';
import { PermissionSet } from '../auth/entities/permission-set.entity';
import { ApprovalChain } from '../auth/entities/approval-chain.entity';

// Import security services
import { SecurityOrchestrationService } from './services/security-orchestration.service';
import { ZeroTrustNetworkService } from './services/zero-trust-network.service';
import { MicrosegmentationPolicyService } from './services/microsegmentation-policy.service';
import { ContinuousIdentityVerificationService } from './services/continuous-identity-verification.service';
import { ZeroTrustAccessControlService } from './services/zero-trust-access-control.service';
import { IndonesianZeroTrustComplianceService } from './services/indonesian-zero-trust-compliance.service';
import { AiThreatDetectionEngineService } from './services/ai-threat-detection-engine.service';
import { BehavioralAnalyticsAnomalyDetectionService } from './services/behavioral-analytics-anomaly-detection.service';
import { RealTimeSecurityOrchestrationResponseService } from './services/real-time-security-orchestration-response.service';

// Import security controllers
import { SecurityController } from './controllers/security.controller';

// Import security processors for async operations
import { SecurityProcessor } from './processors/security.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    HttpModule.register({
      timeout: 45000, // Extended timeout for security operations
      maxRedirects: 3,
    }),

    // Database entities for security
    TypeOrmModule.forFeature([
      // Core entities for security
      User,
      Company,
      Department,
      HierarchicalRole,
      PermissionSet,
      ApprovalChain,
    ]),

    // Bull queue for async security operations
    BullModule.registerQueue({
      name: 'security',
      defaultJobOptions: {
        removeOnComplete: 50, // Keep security operation history
        removeOnFail: 25,
        attempts: 3, // Security operations retries
        backoff: {
          type: 'exponential',
          delay: 5000, // Security operation delays
        },
      },
    }),
  ],

  controllers: [SecurityController],

  providers: [
    // Security orchestration service
    SecurityOrchestrationService,
    
    // Zero-trust network service
    ZeroTrustNetworkService,
    
    // Microsegmentation policy service
    MicrosegmentationPolicyService,
    
    // Continuous identity verification service
    ContinuousIdentityVerificationService,
    
    // Zero-trust access control service
    ZeroTrustAccessControlService,
    
    // Indonesian zero-trust compliance service
    IndonesianZeroTrustComplianceService,
    
    // AI threat detection engine service
    AiThreatDetectionEngineService,
    
    // Behavioral analytics anomaly detection service
    BehavioralAnalyticsAnomalyDetectionService,
    
    // Real-time security orchestration response service
    RealTimeSecurityOrchestrationResponseService,
    
    // Queue processors for async security
    SecurityProcessor,
  ],

  exports: [
    // Export security services for use in other modules
    SecurityOrchestrationService,
    ZeroTrustNetworkService,
    MicrosegmentationPolicyService,
    ContinuousIdentityVerificationService,
    ZeroTrustAccessControlService,
    IndonesianZeroTrustComplianceService,
    AiThreatDetectionEngineService,
    BehavioralAnalyticsAnomalyDetectionService,
    RealTimeSecurityOrchestrationResponseService,
  ],
})
export class SecurityModule {}