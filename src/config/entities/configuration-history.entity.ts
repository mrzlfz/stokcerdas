/**
 * Configuration History Entity
 * Audit trail and versioning for Indonesian configuration changes
 * Tracks all configuration modifications for compliance and rollback
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  ConfigurationMapping,
  ConfigurationType,
} from './configuration-mapping.entity';

export enum ConfigurationChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  APPROVE = 'approve',
  REJECT = 'reject',
  ROLLBACK = 'rollback',
}

export enum ConfigurationChangeReason {
  ADMIN_UPDATE = 'admin_update',
  SYSTEM_UPDATE = 'system_update',
  API_UPDATE = 'api_update',
  SCHEDULED_UPDATE = 'scheduled_update',
  EMERGENCY_UPDATE = 'emergency_update',
  REGULATORY_COMPLIANCE = 'regulatory_compliance',
  BUSINESS_REQUIREMENT = 'business_requirement',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  BUG_FIX = 'bug_fix',
  SECURITY_UPDATE = 'security_update',
}

@Entity('configuration_history')
@Index(['configurationId', 'changeType', 'createdAt'])
@Index(['tenantId', 'configurationType', 'createdAt'])
@Index(['changeType', 'createdAt'])
@Index(['createdBy', 'createdAt'])
export class ConfigurationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'configuration_id' })
  @Index()
  configurationId: string;

  @ManyToOne(() => ConfigurationMapping, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configuration_id' })
  configuration: ConfigurationMapping;

  @Column({ name: 'tenant_id', nullable: true })
  @Index()
  tenantId?: string;

  @Column({
    type: 'enum',
    enum: ConfigurationType,
    name: 'configuration_type',
  })
  @Index()
  configurationType: ConfigurationType;

  @Column({ name: 'configuration_key' })
  @Index()
  key: string;

  @Column({
    type: 'enum',
    enum: ConfigurationChangeType,
    name: 'change_type',
  })
  @Index()
  changeType: ConfigurationChangeType;

  @Column({
    type: 'enum',
    enum: ConfigurationChangeReason,
    name: 'change_reason',
  })
  changeReason: ConfigurationChangeReason;

  // Configuration values
  @Column({
    type: 'jsonb',
    name: 'old_value',
    nullable: true,
  })
  oldValue?: any;

  @Column({
    type: 'jsonb',
    name: 'new_value',
    nullable: true,
  })
  newValue?: any;

  // Change metadata
  @Column({
    type: 'jsonb',
    name: 'change_metadata',
    default: {},
  })
  changeMetadata: {
    description?: string;
    impactAssessment?: string;
    rollbackPlan?: string;
    testingNotes?: string;
    approvalWorkflow?: {
      requiredApprovers?: string[];
      actualApprovers?: string[];
      approvalStatus?: 'pending' | 'approved' | 'rejected';
    };
    businessJustification?: string;
    technicalJustification?: string;
    riskAssessment?: 'low' | 'medium' | 'high' | 'critical';
    affectedSystems?: string[];
    affectedUsers?: string[];
    communicationPlan?: string;
    migrationNotes?: string;
  };

  // Version tracking
  @Column({ name: 'version_from', nullable: true })
  versionFrom?: number;

  @Column({ name: 'version_to', nullable: true })
  versionTo?: number;

  // Change tracking
  @Column({ name: 'changed_fields', type: 'jsonb', default: [] })
  changedFields: string[]; // List of fields that were changed

  @Column({
    type: 'jsonb',
    name: 'field_changes',
    default: {},
  })
  fieldChanges: {
    [fieldName: string]: {
      oldValue: any;
      newValue: any;
      changeType: 'added' | 'modified' | 'removed';
    };
  };

  // Indonesian business context
  @Column({ name: 'regional_impact', type: 'jsonb', default: {} })
  regionalImpact: {
    affectedRegions?: string[]; // Indonesian region codes
    culturalConsiderations?: string[];
    localBusinessImpact?: string;
    complianceImplications?: string[];
  };

  // User and system context
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ name: 'user_role', nullable: true })
  userRole?: string;

  @Column({ name: 'client_ip', nullable: true })
  clientIp?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  // System context
  @Column({ name: 'system_version', nullable: true })
  systemVersion?: string;

  @Column({ name: 'deployment_id', nullable: true })
  deploymentId?: string;

  @Column({ name: 'environment', nullable: true })
  environment?: string; // development, staging, production

  // Rollback information
  @Column({ name: 'can_rollback', default: true })
  canRollback: boolean;

  @Column({ name: 'rollback_configuration_id', nullable: true })
  rollbackConfigurationId?: string; // Reference to configuration this can rollback to

  @Column({ name: 'rolled_back_at', nullable: true })
  rolledBackAt?: Date;

  @Column({ name: 'rolled_back_by', nullable: true })
  rolledBackBy?: string;

  @Column({ name: 'rollback_reason', nullable: true })
  rollbackReason?: string;

  // Performance impact tracking
  @Column({ name: 'performance_impact', type: 'jsonb', default: {} })
  performanceImpact: {
    cacheInvalidations?: number;
    affectedServices?: string[];
    reloadTime?: number; // milliseconds
    downtime?: number; // milliseconds
    userImpact?: 'none' | 'minimal' | 'moderate' | 'significant';
  };

  // Validation and testing
  @Column({ name: 'validation_status', nullable: true })
  validationStatus?: 'passed' | 'failed' | 'pending' | 'skipped';

  @Column({ name: 'validation_errors', type: 'jsonb', default: [] })
  validationErrors: string[];

  @Column({ name: 'test_results', type: 'jsonb', default: {} })
  testResults: {
    unitTestsPassed?: boolean;
    integrationTestsPassed?: boolean;
    businessLogicTestsPassed?: boolean;
    performanceTestsPassed?: boolean;
    securityTestsPassed?: boolean;
    testSuite?: string;
    testDuration?: number; // milliseconds
  };

  // Compliance and audit
  @Column({ name: 'compliance_check', type: 'jsonb', default: {} })
  complianceCheck: {
    dataProtectionCompliance?: boolean; // UU PDP compliance
    businessRulesCompliance?: boolean; // Indonesian business rules
    auditTrailComplete?: boolean;
    documentationComplete?: boolean;
    approvalProcessFollowed?: boolean;
    complianceNotes?: string[];
  };

  // Notification and communication
  @Column({ name: 'notifications_sent', type: 'jsonb', default: [] })
  notificationsSent: {
    type: 'email' | 'sms' | 'push' | 'webhook';
    recipient: string;
    sentAt: string;
    status: 'sent' | 'failed' | 'pending';
    messageId?: string;
  }[];

  // Indonesian localization
  @Column({ name: 'localization_context', type: 'jsonb', default: {} })
  localizationContext: {
    language?: 'id' | 'en';
    timezone?: 'WIB' | 'WITA' | 'WIT';
    currency?: 'IDR';
    numberFormat?: 'id-ID';
    dateFormat?: 'dd/MM/yyyy' | 'MM/dd/yyyy';
    businessCalendarContext?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  // Duration tracking
  @Column({ name: 'change_duration_ms', nullable: true })
  changeDurationMs?: number; // How long the change took to execute

  @Column({ name: 'effective_at', nullable: true })
  effectiveAt?: Date; // When the change became effective

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date; // When the change expires (for temporary changes)
}
