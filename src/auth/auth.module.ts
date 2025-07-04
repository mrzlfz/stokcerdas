import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

// Core auth services and controllers
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

// Enterprise auth services and controllers
import { DepartmentService } from './services/department.service';
import { DepartmentController } from './controllers/department.controller';
import { HierarchicalRoleService } from './services/hierarchical-role.service';
import { HierarchicalRoleController } from './controllers/hierarchical-role.controller';
import { PermissionSetService } from './services/permission-set.service';
import { PermissionSetController } from './controllers/permission-set.controller';
import { ApprovalChainService } from './services/approval-chain.service';
import { ApprovalChainController } from './controllers/approval-chain.controller';
import { EnterpriseAuthService } from './services/enterprise-auth.service';
import { EnterpriseAuthController } from './controllers/enterprise-auth.controller';

// Core entities
import { User } from '../users/entities/user.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';

// Enterprise entities
import { Department } from './entities/department.entity';
import { HierarchicalRole } from './entities/hierarchical-role.entity';
import { PermissionSet } from './entities/permission-set.entity';
import { UserRole } from './entities/user-role.entity';
import { RoleHierarchy } from './entities/role-hierarchy.entity';
import { ApprovalChain } from './entities/approval-chain.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { ApprovalAction } from './entities/approval-action.entity';
import { Company } from './entities/company.entity';
import { CompanyRelationship } from './entities/company-relationship.entity';
import { CompanyBilling } from './entities/company-billing.entity';
import { ConsolidatedReport } from './entities/consolidated-report.entity';
import { InterCompanyTransfer } from './entities/inter-company-transfer.entity';

// Guards and middleware
import { EnterprisePermissionsGuard } from './guards/enterprise-permissions.guard';
import { EnterpriseContextMiddleware } from './middleware/enterprise-context.middleware';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Core entities
      User,
      Permission,
      RolePermission,
      // Enterprise entities
      Department,
      HierarchicalRole,
      PermissionSet,
      UserRole,
      RoleHierarchy,
      ApprovalChain,
      ApprovalStep,
      ApprovalInstance,
      ApprovalAction,
      // Multi-entity support entities
      Company,
      CompanyRelationship,
      CompanyBilling,
      ConsolidatedReport,
      InterCompanyTransfer,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('auth.jwt.expiresIn'),
          issuer: configService.get<string>('auth.jwt.issuer'),
          audience: configService.get<string>('auth.jwt.audience'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'approval-processing',
    }),
    UsersModule,
  ],
  controllers: [
    // Core controllers
    AuthController,
    // Enterprise controllers
    DepartmentController,
    HierarchicalRoleController,
    PermissionSetController,
    ApprovalChainController,
    EnterpriseAuthController,
  ],
  providers: [
    // Core providers
    AuthService,
    JwtStrategy,
    LocalStrategy,
    // Enterprise services
    DepartmentService,
    HierarchicalRoleService,
    PermissionSetService,
    ApprovalChainService,
    EnterpriseAuthService,
    // Guards and middleware
    EnterprisePermissionsGuard,
    EnterpriseContextMiddleware,
  ],
  exports: [
    // Core exports
    AuthService,
    JwtModule,
    PassportModule,
    // Enterprise exports
    DepartmentService,
    HierarchicalRoleService,
    PermissionSetService,
    ApprovalChainService,
    EnterpriseAuthService,
    EnterprisePermissionsGuard,
    EnterpriseContextMiddleware,
  ],
})
export class AuthModule {}
