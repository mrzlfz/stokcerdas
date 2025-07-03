import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePrivacyManagementTables1735910000000 implements MigrationInterface {
  name = 'CreatePrivacyManagementTables1735910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for UU PDP compliance
    await queryRunner.query(`
      CREATE TYPE "legal_basis_uudp_enum" AS ENUM(
        'consent',
        'contract',
        'legal_obligation',
        'vital_interest',
        'public_task',
        'legitimate_interest'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "personal_data_category_enum" AS ENUM(
        'general',
        'specific',
        'biometric',
        'health',
        'financial',
        'location',
        'behavioral'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "processing_purpose_enum" AS ENUM(
        'user_account',
        'inventory_management',
        'order_processing',
        'customer_service',
        'analytics',
        'marketing',
        'legal_compliance',
        'security'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "consent_status_enum" AS ENUM(
        'given',
        'withdrawn',
        'expired',
        'pending',
        'refused'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "data_subject_right_enum" AS ENUM(
        'access',
        'rectification',
        'erasure',
        'restrict_processing',
        'data_portability',
        'object',
        'withdraw_consent'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "request_status_enum" AS ENUM(
        'pending',
        'in_progress',
        'completed',
        'rejected',
        'partially_completed'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "breach_severity_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'critical'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "breach_status_enum" AS ENUM(
        'detected',
        'investigating',
        'contained',
        'resolved',
        'reported_to_authority'
      );
    `);

    // Create Data Classification table
    await queryRunner.createTable(
      new Table({
        name: 'privacy_data_classification',
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
            name: 'data_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'entity_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'field_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'category',
            type: 'personal_data_category_enum',
            isNullable: false,
          },
          {
            name: 'legal_basis',
            type: 'legal_basis_uudp_enum',
            isNullable: false,
          },
          {
            name: 'processing_purposes',
            type: 'processing_purpose_enum',
            isArray: true,
            isNullable: false,
          },
          {
            name: 'requires_consent',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'retention_days',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'processing_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'risk_assessment',
            type: 'jsonb',
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
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Privacy Consent table
    await queryRunner.createTable(
      new Table({
        name: 'privacy_consent',
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
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'purpose',
            type: 'processing_purpose_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'consent_status_enum',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'consent_text',
            type: 'varchar',
            length: '1000',
            isNullable: false,
          },
          {
            name: 'consent_text_en',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'given_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'withdrawn_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'expiry_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'version',
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
            name: 'withdrawal_reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'consent_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'audit_trail',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_minor',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'legal_guardian',
            type: 'varchar',
            length: '255',
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
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Data Retention Policy table
    await queryRunner.createTable(
      new Table({
        name: 'privacy_data_retention_policy',
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
            name: 'policy_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'data_category',
            type: 'personal_data_category_enum',
            isNullable: false,
          },
          {
            name: 'processing_purpose',
            type: 'processing_purpose_enum',
            isNullable: false,
          },
          {
            name: 'legal_basis',
            type: 'legal_basis_uudp_enum',
            isNullable: false,
          },
          {
            name: 'retention_days',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'archival_days',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'requires_user_action',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'automatic_deletion',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'anonymization_allowed',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'retention_reason',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'deletion_criteria',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'policy_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'effective_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'expiry_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '50',
            default: "'1.0'",
            isNullable: false,
          },
          {
            name: 'regulatory_basis',
            type: 'varchar',
            length: '255',
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
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Data Subject Request table
    await queryRunner.createTable(
      new Table({
        name: 'privacy_data_subject_request',
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
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'request_id',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'request_type',
            type: 'data_subject_right_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'request_status_enum',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'request_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'request_reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'due_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'response_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'request_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'processing_log',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'fulfillment_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'requestor_ip',
            type: 'inet',
            isNullable: true,
          },
          {
            name: 'requestor_user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'assigned_to',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'priority',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'reference_number',
            type: 'varchar',
            length: '255',
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
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Privacy Breach Log table
    await queryRunner.createTable(
      new Table({
        name: 'privacy_breach_log',
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
            name: 'breach_id',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'breach_title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'breach_description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'breach_severity_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'breach_status_enum',
            default: "'detected'",
            isNullable: false,
          },
          {
            name: 'detected_at',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'reported_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'contained_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'resolved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'affected_data',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'breach_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'response_actions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notifications',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'lessons_learned',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'improvement_actions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'investigation_lead',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'external_reference',
            type: 'varchar',
            length: '100',
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
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Data Processing Activity table
    await queryRunner.createTable(
      new Table({
        name: 'privacy_processing_activity',
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
            name: 'activity_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'activity_description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'processing_purposes',
            type: 'processing_purpose_enum',
            isArray: true,
            isNullable: false,
          },
          {
            name: 'legal_basis',
            type: 'legal_basis_uudp_enum',
            isNullable: false,
          },
          {
            name: 'data_categories',
            type: 'personal_data_category_enum',
            isArray: true,
            isNullable: false,
          },
          {
            name: 'data_controller',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'data_processor',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'joint_controllers',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'data_subjects',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'processing_details',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'third_parties',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'last_review_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'next_review_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'dpo_contact',
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
            name: 'version',
            type: 'varchar',
            length: '50',
            default: "'1.0'",
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
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for Privacy Data Classification
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_classification_tenant_id_is_deleted" ON "privacy_data_classification" ("tenant_id", "is_deleted")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_classification_category_purpose" ON "privacy_data_classification" ("category", "processing_purposes")`);

    // Create indexes for Privacy Consent
    await queryRunner.query(`CREATE INDEX "IDX_privacy_consent_tenant_id_user_id_is_deleted" ON "privacy_consent" ("tenant_id", "user_id", "is_deleted")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_consent_tenant_id_status_expiry_date" ON "privacy_consent" ("tenant_id", "status", "expiry_date")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_consent_tenant_id_purpose_status" ON "privacy_consent" ("tenant_id", "purpose", "status")`);

    // Create indexes for Data Retention Policy
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_retention_policy_tenant_id_is_active_is_deleted" ON "privacy_data_retention_policy" ("tenant_id", "is_active", "is_deleted")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_retention_policy_category_purpose" ON "privacy_data_retention_policy" ("data_category", "processing_purpose")`);

    // Create indexes for Data Subject Request
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_subject_request_tenant_id_user_id_status_is_deleted" ON "privacy_data_subject_request" ("tenant_id", "user_id", "status", "is_deleted")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_subject_request_tenant_id_request_type_created_at" ON "privacy_data_subject_request" ("tenant_id", "request_type", "created_at")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_subject_request_request_id" ON "privacy_data_subject_request" ("request_id")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_data_subject_request_due_date_status" ON "privacy_data_subject_request" ("due_date", "status")`);

    // Create indexes for Privacy Breach Log
    await queryRunner.query(`CREATE INDEX "IDX_privacy_breach_log_tenant_id_severity_reported_at" ON "privacy_breach_log" ("tenant_id", "severity", "reported_at")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_breach_log_tenant_id_status_is_deleted" ON "privacy_breach_log" ("tenant_id", "status", "is_deleted")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_breach_log_breach_id" ON "privacy_breach_log" ("breach_id")`);

    // Create indexes for Data Processing Activity
    await queryRunner.query(`CREATE INDEX "IDX_privacy_processing_activity_tenant_id_is_active_is_deleted" ON "privacy_processing_activity" ("tenant_id", "is_active", "is_deleted")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_privacy_processing_activity_legal_basis_data_categories" ON "privacy_processing_activity" ("legal_basis", "data_categories")`);

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "privacy_consent" 
      ADD CONSTRAINT "FK_privacy_consent_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "privacy_data_subject_request" 
      ADD CONSTRAINT "FK_privacy_data_subject_request_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "privacy_data_subject_request" 
      ADD CONSTRAINT "FK_privacy_data_subject_request_assigned_to" 
      FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "privacy_breach_log" 
      ADD CONSTRAINT "FK_privacy_breach_log_investigation_lead" 
      FOREIGN KEY ("investigation_lead") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    console.log('Privacy management tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const consentTable = await queryRunner.getTable('privacy_consent');
    const consentUserForeignKey = consentTable.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
    if (consentUserForeignKey) {
      await queryRunner.dropForeignKey('privacy_consent', consentUserForeignKey);
    }

    const requestTable = await queryRunner.getTable('privacy_data_subject_request');
    const requestUserForeignKey = requestTable.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
    if (requestUserForeignKey) {
      await queryRunner.dropForeignKey('privacy_data_subject_request', requestUserForeignKey);
    }

    const requestAssignedForeignKey = requestTable.foreignKeys.find(fk => fk.columnNames.indexOf('assigned_to') !== -1);
    if (requestAssignedForeignKey) {
      await queryRunner.dropForeignKey('privacy_data_subject_request', requestAssignedForeignKey);
    }

    const breachTable = await queryRunner.getTable('privacy_breach_log');
    const breachLeadForeignKey = breachTable.foreignKeys.find(fk => fk.columnNames.indexOf('investigation_lead') !== -1);
    if (breachLeadForeignKey) {
      await queryRunner.dropForeignKey('privacy_breach_log', breachLeadForeignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex('privacy_data_classification', 'IDX_privacy_data_classification_tenant_id_is_deleted');
    await queryRunner.dropIndex('privacy_data_classification', 'IDX_privacy_data_classification_category_purpose');
    await queryRunner.dropIndex('privacy_consent', 'IDX_privacy_consent_tenant_id_user_id_is_deleted');
    await queryRunner.dropIndex('privacy_consent', 'IDX_privacy_consent_tenant_id_status_expiry_date');
    await queryRunner.dropIndex('privacy_consent', 'IDX_privacy_consent_tenant_id_purpose_status');
    await queryRunner.dropIndex('privacy_data_retention_policy', 'IDX_privacy_data_retention_policy_tenant_id_is_active_is_deleted');
    await queryRunner.dropIndex('privacy_data_retention_policy', 'IDX_privacy_data_retention_policy_category_purpose');
    await queryRunner.dropIndex('privacy_data_subject_request', 'IDX_privacy_data_subject_request_tenant_id_user_id_status_is_deleted');
    await queryRunner.dropIndex('privacy_data_subject_request', 'IDX_privacy_data_subject_request_tenant_id_request_type_created_at');
    await queryRunner.dropIndex('privacy_data_subject_request', 'IDX_privacy_data_subject_request_request_id');
    await queryRunner.dropIndex('privacy_data_subject_request', 'IDX_privacy_data_subject_request_due_date_status');
    await queryRunner.dropIndex('privacy_breach_log', 'IDX_privacy_breach_log_tenant_id_severity_reported_at');
    await queryRunner.dropIndex('privacy_breach_log', 'IDX_privacy_breach_log_tenant_id_status_is_deleted');
    await queryRunner.dropIndex('privacy_breach_log', 'IDX_privacy_breach_log_breach_id');
    await queryRunner.dropIndex('privacy_processing_activity', 'IDX_privacy_processing_activity_tenant_id_is_active_is_deleted');
    await queryRunner.dropIndex('privacy_processing_activity', 'IDX_privacy_processing_activity_legal_basis_data_categories');

    // Drop tables
    await queryRunner.dropTable('privacy_processing_activity');
    await queryRunner.dropTable('privacy_breach_log');
    await queryRunner.dropTable('privacy_data_subject_request');
    await queryRunner.dropTable('privacy_data_retention_policy');
    await queryRunner.dropTable('privacy_consent');
    await queryRunner.dropTable('privacy_data_classification');

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "breach_status_enum"`);
    await queryRunner.query(`DROP TYPE "breach_severity_enum"`);
    await queryRunner.query(`DROP TYPE "request_status_enum"`);
    await queryRunner.query(`DROP TYPE "data_subject_right_enum"`);
    await queryRunner.query(`DROP TYPE "consent_status_enum"`);
    await queryRunner.query(`DROP TYPE "processing_purpose_enum"`);
    await queryRunner.query(`DROP TYPE "personal_data_category_enum"`);
    await queryRunner.query(`DROP TYPE "legal_basis_uudp_enum"`);
  }
}