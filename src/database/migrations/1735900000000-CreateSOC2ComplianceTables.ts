import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSOC2ComplianceTables1735900000000
  implements MigrationInterface
{
  name = 'CreateSOC2ComplianceTables1735900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE "trust_service_criteria_enum" AS ENUM(
        'security',
        'availability', 
        'processing_integrity',
        'confidentiality',
        'privacy'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "control_type_enum" AS ENUM(
        'preventive',
        'detective',
        'corrective'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "control_frequency_enum" AS ENUM(
        'continuous',
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'annually'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "control_status_enum" AS ENUM(
        'active',
        'inactive',
        'under_review',
        'remediation_required'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "risk_level_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'critical'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "audit_event_type_enum" AS ENUM(
        'login_success',
        'login_failure',
        'logout',
        'password_change',
        'mfa_enabled',
        'mfa_disabled',
        'account_locked',
        'account_unlocked',
        'permission_granted',
        'permission_revoked',
        'role_assigned',
        'role_removed',
        'data_access',
        'data_create',
        'data_update',
        'data_delete',
        'data_export',
        'data_import',
        'bulk_operation',
        'user_created',
        'user_updated',
        'user_deleted',
        'system_config_change',
        'integration_config_change',
        'suspicious_activity',
        'brute_force_attempt',
        'unauthorized_access_attempt',
        'security_violation',
        'control_test',
        'exception_created',
        'exception_resolved',
        'evidence_collected',
        'audit_log_access',
        'inventory_adjustment',
        'order_created',
        'order_fulfilled',
        'product_updated',
        'price_change',
        'api_call',
        'webhook_received',
        'sync_operation',
        'external_auth'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "audit_event_severity_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'critical'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "audit_event_outcome_enum" AS ENUM(
        'success',
        'failure',
        'warning',
        'error'
      );
    `);

    // Create SOC2 Controls table
    await queryRunner.createTable(
      new Table({
        name: 'soc2_controls',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'control_id',
            type: 'varchar',
            length: '20',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'control_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'control_description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'criteria',
            type: 'trust_service_criteria_enum',
            isNullable: false,
          },
          {
            name: 'control_type',
            type: 'control_type_enum',
            isNullable: false,
          },
          {
            name: 'frequency',
            type: 'control_frequency_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'control_status_enum',
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'risk_level',
            type: 'risk_level_enum',
            isNullable: false,
          },
          {
            name: 'control_objective',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'control_activity',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'implementation_guidance',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'automation_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'control_owner',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'control_owner_backup',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'last_test_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_test_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'test_results',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'exceptions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'related_controls',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'additional_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create SOC2 Control Evidence table
    await queryRunner.createTable(
      new Table({
        name: 'soc2_control_evidence',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'control_id',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'evidence_type',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'evidence_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'file_path',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'file_hash',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'file_size',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'collection_date',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'collected_by',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'period_start',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'period_end',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create SOC2 Control Tests table
    await queryRunner.createTable(
      new Table({
        name: 'soc2_control_tests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'control_id',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'test_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'test_description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'test_method',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'test_date',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'tester',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'test_result',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'test_procedure',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'findings',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sample_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'deficiencies',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'workpaper_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'review_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reviewer',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'review_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create SOC2 Audit Logs table
    await queryRunner.createTable(
      new Table({
        name: 'soc2_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'audit_event_type_enum',
            isNullable: false,
          },
          {
            name: 'event_description',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'audit_event_severity_enum',
            default: "'low'",
            isNullable: false,
          },
          {
            name: 'outcome',
            type: 'audit_event_outcome_enum',
            isNullable: false,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'user_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'user_role',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'inet',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'session_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'correlation_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'resource_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'resource_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'http_method',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'http_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'http_status_code',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'response_time_ms',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'source_system',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'source_module',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'previous_values',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'new_values',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'additional_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error_code',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'stack_trace',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'department',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'location',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'compliance_flags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'retention_class',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'retention_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create SOC2 Audit Log Retention Rules table
    await queryRunner.createTable(
      new Table({
        name: 'soc2_audit_log_retention_rules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'audit_event_type_enum',
            isNullable: false,
          },
          {
            name: 'retention_days',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'archive_days',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'requires_legal_hold',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'conditions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'justification',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'regulatory_basis',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create SOC2 Audit Log Alerts table
    await queryRunner.createTable(
      new Table({
        name: 'soc2_audit_log_alerts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'alert_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'alert_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'conditions',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'actions',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'alert_severity',
            type: 'audit_event_severity_enum',
            default: "'medium'",
            isNullable: false,
          },
          {
            name: 'trigger_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'last_triggered',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for SOC2 Controls
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_controls_tenant_id_is_deleted" ON "soc2_controls" ("tenant_id", "is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_controls_control_id" ON "soc2_controls" ("control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_controls_criteria_status" ON "soc2_controls" ("criteria", "status")`,
    );

    // Create indexes for SOC2 Control Evidence
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_control_evidence_tenant_id_control_id" ON "soc2_control_evidence" ("tenant_id", "control_id")`,
    );

    // Create indexes for SOC2 Control Tests
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_control_tests_tenant_id_control_id_test_date" ON "soc2_control_tests" ("tenant_id", "control_id", "test_date")`,
    );

    // Create indexes for SOC2 Audit Logs
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_logs_tenant_id_event_type_timestamp" ON "soc2_audit_logs" ("tenant_id", "event_type", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_logs_tenant_id_user_id_timestamp" ON "soc2_audit_logs" ("tenant_id", "user_id", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_logs_tenant_id_ip_address_timestamp" ON "soc2_audit_logs" ("tenant_id", "ip_address", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_logs_tenant_id_severity_timestamp" ON "soc2_audit_logs" ("tenant_id", "severity", "timestamp")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_logs_session_id" ON "soc2_audit_logs" ("session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_logs_correlation_id" ON "soc2_audit_logs" ("correlation_id")`,
    );

    // Create indexes for SOC2 Audit Log Retention Rules
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_log_retention_rules_tenant_id_event_type" ON "soc2_audit_log_retention_rules" ("tenant_id", "event_type")`,
    );

    // Create indexes for SOC2 Audit Log Alerts
    await queryRunner.query(
      `CREATE INDEX "IDX_soc2_audit_log_alerts_tenant_id_alert_type_is_active" ON "soc2_audit_log_alerts" ("tenant_id", "alert_type", "is_active")`,
    );

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "soc2_audit_logs" 
      ADD CONSTRAINT "FK_soc2_audit_logs_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    console.log('SOC 2 compliance tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const auditLogsTable = await queryRunner.getTable('soc2_audit_logs');
    const userForeignKey = auditLogsTable.foreignKeys.find(
      fk => fk.columnNames.indexOf('user_id') !== -1,
    );
    if (userForeignKey) {
      await queryRunner.dropForeignKey('soc2_audit_logs', userForeignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex(
      'soc2_controls',
      'IDX_soc2_controls_tenant_id_is_deleted',
    );
    await queryRunner.dropIndex(
      'soc2_controls',
      'IDX_soc2_controls_control_id',
    );
    await queryRunner.dropIndex(
      'soc2_controls',
      'IDX_soc2_controls_criteria_status',
    );
    await queryRunner.dropIndex(
      'soc2_control_evidence',
      'IDX_soc2_control_evidence_tenant_id_control_id',
    );
    await queryRunner.dropIndex(
      'soc2_control_tests',
      'IDX_soc2_control_tests_tenant_id_control_id_test_date',
    );
    await queryRunner.dropIndex(
      'soc2_audit_logs',
      'IDX_soc2_audit_logs_tenant_id_event_type_timestamp',
    );
    await queryRunner.dropIndex(
      'soc2_audit_logs',
      'IDX_soc2_audit_logs_tenant_id_user_id_timestamp',
    );
    await queryRunner.dropIndex(
      'soc2_audit_logs',
      'IDX_soc2_audit_logs_tenant_id_ip_address_timestamp',
    );
    await queryRunner.dropIndex(
      'soc2_audit_logs',
      'IDX_soc2_audit_logs_tenant_id_severity_timestamp',
    );
    await queryRunner.dropIndex(
      'soc2_audit_logs',
      'IDX_soc2_audit_logs_session_id',
    );
    await queryRunner.dropIndex(
      'soc2_audit_logs',
      'IDX_soc2_audit_logs_correlation_id',
    );
    await queryRunner.dropIndex(
      'soc2_audit_log_retention_rules',
      'IDX_soc2_audit_log_retention_rules_tenant_id_event_type',
    );
    await queryRunner.dropIndex(
      'soc2_audit_log_alerts',
      'IDX_soc2_audit_log_alerts_tenant_id_alert_type_is_active',
    );

    // Drop tables
    await queryRunner.dropTable('soc2_audit_log_alerts');
    await queryRunner.dropTable('soc2_audit_log_retention_rules');
    await queryRunner.dropTable('soc2_audit_logs');
    await queryRunner.dropTable('soc2_control_tests');
    await queryRunner.dropTable('soc2_control_evidence');
    await queryRunner.dropTable('soc2_controls');

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "audit_event_outcome_enum"`);
    await queryRunner.query(`DROP TYPE "audit_event_severity_enum"`);
    await queryRunner.query(`DROP TYPE "audit_event_type_enum"`);
    await queryRunner.query(`DROP TYPE "risk_level_enum"`);
    await queryRunner.query(`DROP TYPE "control_status_enum"`);
    await queryRunner.query(`DROP TYPE "control_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "control_type_enum"`);
    await queryRunner.query(`DROP TYPE "trust_service_criteria_enum"`);
  }
}
