import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum AuditEventType {
  // Authentication & Authorization
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',

  // Data Access & Modification
  DATA_ACCESS = 'data_access',
  DATA_CREATE = 'data_create',
  DATA_UPDATE = 'data_update',
  DATA_DELETE = 'data_delete',
  DATA_EXPORT = 'data_export',
  DATA_IMPORT = 'data_import',
  BULK_OPERATION = 'bulk_operation',

  // System Administration
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  SYSTEM_CONFIG_CHANGE = 'system_config_change',
  INTEGRATION_CONFIG_CHANGE = 'integration_config_change',

  // Security Events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  SECURITY_VIOLATION = 'security_violation',

  // Compliance Events
  CONTROL_TEST = 'control_test',
  EXCEPTION_CREATED = 'exception_created',
  EXCEPTION_RESOLVED = 'exception_resolved',
  EVIDENCE_COLLECTED = 'evidence_collected',
  AUDIT_LOG_ACCESS = 'audit_log_access',

  // Business Process Events
  INVENTORY_ADJUSTMENT = 'inventory_adjustment',
  ORDER_CREATED = 'order_created',
  ORDER_FULFILLED = 'order_fulfilled',
  PRODUCT_UPDATED = 'product_updated',
  PRICE_CHANGE = 'price_change',

  // Integration Events
  API_CALL = 'api_call',
  WEBHOOK_RECEIVED = 'webhook_received',
  SYNC_OPERATION = 'sync_operation',
  EXTERNAL_AUTH = 'external_auth',
}

export enum AuditEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AuditEventOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  WARNING = 'warning',
  ERROR = 'error',
}

@Entity('soc2_audit_logs')
@Index(['tenantId', 'eventType', 'timestamp'])
@Index(['tenantId', 'userId', 'timestamp'])
@Index(['tenantId', 'ipAddress', 'timestamp'])
@Index(['tenantId', 'severity', 'timestamp'])
@Index(['sessionId'])
@Index(['correlationId'])
export class SOC2AuditLog extends BaseEntity {
  @Column({
    type: 'enum',
    enum: AuditEventType,
  })
  eventType: AuditEventType;

  @Column({ type: 'varchar', length: 255 })
  eventDescription: string;

  @Column({
    type: 'enum',
    enum: AuditEventSeverity,
    default: AuditEventSeverity.LOW,
  })
  severity: AuditEventSeverity;

  @Column({
    type: 'enum',
    enum: AuditEventOutcome,
  })
  outcome: AuditEventOutcome;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  userRole?: string;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId?: string; // Links related events together

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceType?: string; // Product, User, Order, etc.

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  httpMethod?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  httpUrl?: string;

  @Column({ type: 'int', nullable: true })
  httpStatusCode?: number;

  @Column({ type: 'int', nullable: true })
  responseTimeMs?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceSystem?: string; // API, Web, Mobile, System

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceModule?: string; // Auth, Inventory, Orders, etc.

  @Column({ type: 'jsonb', nullable: true })
  previousValues?: Record<string, any>; // For data change events

  @Column({ type: 'jsonb', nullable: true })
  newValues?: Record<string, any>; // For data change events

  @Column({ type: 'jsonb', nullable: true })
  additionalData?: {
    requestPayload?: any;
    responsePayload?: any;
    errorDetails?: any;
    riskIndicators?: string[];
    controlsTriggered?: string[];
    businessContext?: any;
  };

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorCode?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string; // Geographic location or office

  @Column({ type: 'jsonb', nullable: true })
  complianceFlags?: {
    sox: boolean;
    gdpr: boolean;
    uuPdp: boolean; // Indonesian data protection law
    pci: boolean;
    hipaa: boolean;
  };

  @Column({ type: 'varchar', length: 50, nullable: true })
  retentionClass?: string; // Determines how long to keep this log

  @Column({ type: 'timestamp', nullable: true })
  retentionDate?: Date; // When this log can be purged

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Virtual fields for analysis
  get isSecurityEvent(): boolean {
    const securityEvents = [
      AuditEventType.LOGIN_FAILURE,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.BRUTE_FORCE_ATTEMPT,
      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      AuditEventType.SECURITY_VIOLATION,
    ];
    return securityEvents.includes(this.eventType);
  }

  get isDataChangeEvent(): boolean {
    const dataChangeEvents = [
      AuditEventType.DATA_CREATE,
      AuditEventType.DATA_UPDATE,
      AuditEventType.DATA_DELETE,
    ];
    return dataChangeEvents.includes(this.eventType);
  }

  get isPrivilegedAction(): boolean {
    const privilegedEvents = [
      AuditEventType.USER_CREATED,
      AuditEventType.USER_DELETED,
      AuditEventType.PERMISSION_GRANTED,
      AuditEventType.PERMISSION_REVOKED,
      AuditEventType.ROLE_ASSIGNED,
      AuditEventType.ROLE_REMOVED,
      AuditEventType.SYSTEM_CONFIG_CHANGE,
    ];
    return privilegedEvents.includes(this.eventType);
  }

  get riskScore(): number {
    let score = 0;

    // Base severity score
    switch (this.severity) {
      case AuditEventSeverity.CRITICAL:
        score += 40;
        break;
      case AuditEventSeverity.HIGH:
        score += 30;
        break;
      case AuditEventSeverity.MEDIUM:
        score += 20;
        break;
      case AuditEventSeverity.LOW:
        score += 10;
        break;
    }

    // Event type multipliers
    if (this.isSecurityEvent) score *= 1.5;
    if (this.isPrivilegedAction) score *= 1.3;
    if (this.outcome === AuditEventOutcome.FAILURE) score *= 1.4;

    // Time-based factors (recent events are higher risk)
    const hoursSinceEvent =
      (Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60);
    if (hoursSinceEvent < 1) score *= 1.2;
    else if (hoursSinceEvent < 24) score *= 1.1;

    return Math.min(score, 100);
  }
}

@Entity('soc2_audit_log_retention_rules')
@Index(['tenantId', 'eventType'])
export class SOC2AuditLogRetentionRule extends BaseEntity {
  @Column({
    type: 'enum',
    enum: AuditEventType,
  })
  eventType: AuditEventType;

  @Column({ type: 'int' })
  retentionDays: number; // How long to keep logs

  @Column({ type: 'int', nullable: true })
  archiveDays?: number; // After how many days to archive (vs delete)

  @Column({ type: 'boolean', default: false })
  requiresLegalHold: boolean; // Cannot be deleted if true

  @Column({ type: 'jsonb', nullable: true })
  conditions?: {
    severity?: AuditEventSeverity[];
    outcome?: AuditEventOutcome[];
    complianceFlags?: string[];
    additionalCriteria?: Record<string, any>;
  };

  @Column({ type: 'text', nullable: true })
  justification?: string; // Why this retention period

  @Column({ type: 'varchar', length: 255, nullable: true })
  regulatoryBasis?: string; // Legal requirement driving retention

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;
}

@Entity('soc2_audit_log_alerts')
@Index(['tenantId', 'alertType', 'isActive'])
export class SOC2AuditLogAlert extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  alertName: string;

  @Column({ type: 'varchar', length: 100 })
  alertType: string; // Threshold, Pattern, Anomaly, etc.

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  conditions: {
    eventTypes?: AuditEventType[];
    severity?: AuditEventSeverity[];
    timeWindow?: number; // minutes
    threshold?: number;
    pattern?: string;
    riskScoreThreshold?: number;
    userRoles?: string[];
    ipAddressPatterns?: string[];
    customQuery?: string;
  };

  @Column({ type: 'jsonb' })
  actions: {
    emailRecipients?: string[];
    webhookUrl?: string;
    slackChannel?: string;
    createIncident?: boolean;
    lockAccount?: boolean;
    requireMfaReset?: boolean;
  };

  @Column({
    type: 'enum',
    enum: AuditEventSeverity,
    default: AuditEventSeverity.MEDIUM,
  })
  alertSeverity: AuditEventSeverity;

  @Column({ type: 'int', default: 0 })
  triggerCount: number; // How many times this alert has fired

  @Column({ type: 'timestamp', nullable: true })
  lastTriggered?: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;
}
