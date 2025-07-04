import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Import compliance sub-modules
import { SOC2ComplianceModule } from './modules/soc2-compliance.module';
import { PrivacyManagementModule } from './modules/privacy-management.module';

/**
 * Main Compliance Module
 *
 * This module provides comprehensive compliance management for StokCerdas platform,
 * including:
 *
 * 1. SOC 2 Type II Compliance
 *    - Control framework implementation
 *    - Audit trail and monitoring
 *    - Evidence collection
 *    - Risk assessment and reporting
 *
 * 2. UU PDP (Indonesian Personal Data Protection Law) Compliance
 *    - Consent management
 *    - Data subject rights (access, rectification, erasure, portability)
 *    - Data retention and lifecycle management
 *    - Privacy breach management
 *    - Data processing activity records
 *
 * Key Features:
 * - Multi-tenant compliance isolation
 * - Automated compliance monitoring
 * - Real-time audit logging
 * - Comprehensive reporting and analytics
 * - Indonesian regulatory compliance
 * - Enterprise-grade security controls
 *
 * Dependencies:
 * - ConfigModule: Configuration management
 * - EventEmitterModule: Event-driven compliance actions
 * - AuthModule: Authentication and authorization integration
 * - UsersModule: User data management integration
 */
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,

    // SOC 2 Type II Compliance
    SOC2ComplianceModule,

    // UU PDP Privacy Management
    PrivacyManagementModule,
  ],
  exports: [
    // Export sub-modules for use in other parts of the application
    SOC2ComplianceModule,
    PrivacyManagementModule,
  ],
})
export class ComplianceModule {}
