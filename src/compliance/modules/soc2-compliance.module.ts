import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { 
  SOC2Control, 
  SOC2ControlEvidence, 
  SOC2ControlTest 
} from '../entities/soc2-control.entity';
import { 
  SOC2AuditLog, 
  SOC2AuditLogRetentionRule, 
  SOC2AuditLogAlert 
} from '../entities/soc2-audit-log.entity';

// Services
import { SOC2ControlService } from '../services/soc2-control.service';
import { SOC2AuditLogService } from '../services/soc2-audit-log.service';

// Controllers
import { SOC2ComplianceController } from '../controllers/soc2-compliance.controller';

// External modules
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      // SOC 2 Control entities
      SOC2Control,
      SOC2ControlEvidence,
      SOC2ControlTest,
      
      // SOC 2 Audit Log entities
      SOC2AuditLog,
      SOC2AuditLogRetentionRule,
      SOC2AuditLogAlert,
    ]),
    
    // Import auth modules for dependencies
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [
    SOC2ComplianceController,
  ],
  providers: [
    SOC2ControlService,
    SOC2AuditLogService,
  ],
  exports: [
    SOC2ControlService,
    SOC2AuditLogService,
  ],
})
export class SOC2ComplianceModule {}