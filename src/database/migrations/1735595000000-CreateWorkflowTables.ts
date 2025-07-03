import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWorkflowTables1735595000000 implements MigrationInterface {
  name = 'CreateWorkflowTables1735595000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // CREATE ENUM TYPES FIRST
    // =============================================
    await queryRunner.query(`
      CREATE TYPE "workflows_category_enum" AS ENUM('INVENTORY_MANAGEMENT', 'PURCHASE_ORDER', 'ALERT_NOTIFICATION', 'SUPPLIER_MANAGEMENT', 'REPORT_GENERATION', 'DATA_SYNC', 'CUSTOM')
    `);

    await queryRunner.query(`
      CREATE TYPE "workflows_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED', 'ERROR')
    `);

    await queryRunner.query(`
      CREATE TYPE "workflows_trigger_type_enum" AS ENUM('MANUAL', 'SCHEDULED', 'EVENT_BASED', 'WEBHOOK', 'API')
    `);

    // =============================================
    // CREATE WORKFLOWS TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'workflows',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          // Basic Configuration
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['INVENTORY_MANAGEMENT', 'PURCHASE_ORDER', 'ALERT_NOTIFICATION', 'SUPPLIER_MANAGEMENT', 'REPORT_GENERATION', 'DATA_SYNC', 'CUSTOM'],
            default: "'CUSTOM'",
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            default: "'1.0.0'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED', 'ERROR'],
            default: "'DRAFT'",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_template',
            type: 'boolean',
            default: false,
          },
          // Trigger Configuration
          {
            name: 'trigger_type',
            type: 'enum',
            enum: ['MANUAL', 'SCHEDULED', 'EVENT_BASED', 'WEBHOOK', 'API'],
            default: "'MANUAL'",
          },
          {
            name: 'trigger_config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'schedule_config',
            type: 'jsonb',
            isNullable: true,
          },
          // Execution Configuration
          {
            name: 'max_concurrent_executions',
            type: 'integer',
            default: 1,
          },
          {
            name: 'timeout_seconds',
            type: 'integer',
            default: 3600,
          },
          {
            name: 'retry_config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'environment',
            type: 'varchar',
            length: '50',
            default: "'production'",
          },
          // Statistics and Monitoring
          {
            name: 'execution_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'success_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failure_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'success_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'avg_execution_time_seconds',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'last_execution_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_execution_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_execution_status',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          // Metadata
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          // Audit fields
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // =============================================
    // CREATE WORKFLOW_STEPS TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'workflow_steps',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workflow_id',
            type: 'uuid',
            isNullable: false,
          },
          // Step Configuration
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'step_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'execution_order',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_required',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_parallel',
            type: 'boolean',
            default: false,
          },
          // Step Flow Control
          {
            name: 'parent_step_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'next_step_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'success_step_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'failure_step_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'error_step_id',
            type: 'uuid',
            isNullable: true,
          },
          // Execution Configuration
          {
            name: 'timeout_seconds',
            type: 'integer',
            default: 300,
          },
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'retry_delay_seconds',
            type: 'integer',
            default: 60,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'input_schema',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output_schema',
            type: 'jsonb',
            isNullable: true,
          },
          // Conditions
          {
            name: 'conditions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'skip_conditions',
            type: 'jsonb',
            isNullable: true,
          },
          // Audit fields
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // =============================================
    // CREATE WORKFLOW_EXECUTIONS TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'workflow_executions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workflow_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'execution_id',
            type: 'varchar',
            length: '100',
            isUnique: true,
            isNullable: false,
          },
          // Execution Details
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
          },
          {
            name: 'trigger',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'trigger_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'input_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_details',
            type: 'jsonb',
            isNullable: true,
          },
          // Progress Tracking
          {
            name: 'current_step_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'completed_steps',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_steps',
            type: 'integer',
            default: 0,
          },
          {
            name: 'progress_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          // Timing
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'duration_seconds',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          // Relationships
          {
            name: 'triggered_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'parent_execution_id',
            type: 'uuid',
            isNullable: true,
          },
          // Additional fields
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'priority',
            type: 'integer',
            default: 5,
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          // Audit fields
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // =============================================
    // CREATE WORKFLOW_STEP_EXECUTIONS TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'workflow_step_executions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workflow_execution_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workflow_step_id',
            type: 'uuid',
            isNullable: false,
          },
          // Execution Details
          {
            name: 'execution_order',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
          },
          {
            name: 'input_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output_data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_details',
            type: 'jsonb',
            isNullable: true,
          },
          // Timing
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'duration_seconds',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          // External Integration
          {
            name: 'external_job_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'external_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          // Retry Logic
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'max_retries',
            type: 'integer',
            default: 3,
          },
          {
            name: 'retry_delay_seconds',
            type: 'integer',
            default: 60,
          },
          {
            name: 'next_retry_at',
            type: 'timestamp',
            isNullable: true,
          },
          // Metadata
          {
            name: 'logs',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'metrics',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          // Audit fields
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // =============================================
    // CREATE INDEXES
    // =============================================

    // Workflows indexes
    await queryRunner.query(`CREATE INDEX "IDX_workflows_tenant_id" ON "workflows" ("tenant_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_workflows_tenant_name" ON "workflows" ("tenant_id", "name")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_category" ON "workflows" ("category")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_status" ON "workflows" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_trigger_type" ON "workflows" ("trigger_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_active" ON "workflows" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_next_execution" ON "workflows" ("next_execution_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_last_execution" ON "workflows" ("last_execution_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_success_rate" ON "workflows" ("success_rate")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_created_at" ON "workflows" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflows_environment" ON "workflows" ("environment")`);

    // Workflow Steps indexes
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_tenant_id" ON "workflow_steps" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_workflow_id" ON "workflow_steps" ("workflow_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_execution_order" ON "workflow_steps" ("workflow_id", "execution_order")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_step_type" ON "workflow_steps" ("step_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_active" ON "workflow_steps" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_parent" ON "workflow_steps" ("parent_step_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_next" ON "workflow_steps" ("next_step_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_created_at" ON "workflow_steps" ("created_at")`);

    // Workflow Executions indexes
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_tenant_id" ON "workflow_executions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_workflow_id" ON "workflow_executions" ("workflow_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_workflow_executions_execution_id" ON "workflow_executions" ("execution_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_status" ON "workflow_executions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_trigger" ON "workflow_executions" ("trigger")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_started_at" ON "workflow_executions" ("started_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_completed_at" ON "workflow_executions" ("completed_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_current_step" ON "workflow_executions" ("current_step_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_triggered_by" ON "workflow_executions" ("triggered_by_user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_parent" ON "workflow_executions" ("parent_execution_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_executions_recent" ON "workflow_executions" ("tenant_id", "started_at")`);

    // Workflow Step Executions indexes
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_tenant_id" ON "workflow_step_executions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_workflow_execution" ON "workflow_step_executions" ("workflow_execution_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_workflow_step" ON "workflow_step_executions" ("workflow_step_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_execution_order" ON "workflow_step_executions" ("workflow_execution_id", "execution_order")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_status" ON "workflow_step_executions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_started_at" ON "workflow_step_executions" ("started_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_completed_at" ON "workflow_step_executions" ("completed_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_external_job" ON "workflow_step_executions" ("external_job_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_step_executions_retry_count" ON "workflow_step_executions" ("retry_count")`);

    // =============================================
    // CREATE FOREIGN KEY CONSTRAINTS
    // =============================================

    // Workflow Steps foreign keys
    await queryRunner.query(`
      ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_workflow_steps_workflow_id" 
      FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_workflow_steps_next_step_id" 
      FOREIGN KEY ("next_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_workflow_steps_success_step_id" 
      FOREIGN KEY ("success_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_workflow_steps_failure_step_id" 
      FOREIGN KEY ("failure_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_workflow_steps_parent_step_id" 
      FOREIGN KEY ("parent_step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_workflow_steps_error_step_id" 
      FOREIGN KEY ("error_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL
    `);

    // Workflow Executions foreign keys
    await queryRunner.query(`
      ALTER TABLE "workflow_executions" ADD CONSTRAINT "FK_workflow_executions_workflow_id" 
      FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_executions" ADD CONSTRAINT "FK_workflow_executions_current_step_id" 
      FOREIGN KEY ("current_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_executions" ADD CONSTRAINT "FK_workflow_executions_parent_execution_id" 
      FOREIGN KEY ("parent_execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL
    `);

    // Workflow Step Executions foreign keys
    await queryRunner.query(`
      ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "FK_workflow_step_executions_workflow_execution_id" 
      FOREIGN KEY ("workflow_execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "FK_workflow_step_executions_workflow_step_id" 
      FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE
    `);

    // =============================================
    // CREATE UPDATED_AT TRIGGERS
    // =============================================
    await queryRunner.query(`
      CREATE TRIGGER update_workflows_updated_at 
        BEFORE UPDATE ON workflows 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_workflow_steps_updated_at 
        BEFORE UPDATE ON workflow_steps 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_workflow_executions_updated_at 
        BEFORE UPDATE ON workflow_executions 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_workflow_step_executions_updated_at 
        BEFORE UPDATE ON workflow_step_executions 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers first
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflow_step_executions_updated_at ON workflow_step_executions`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON workflow_executions`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows`);

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "workflow_step_executions" DROP CONSTRAINT IF EXISTS "FK_workflow_step_executions_workflow_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_step_executions" DROP CONSTRAINT IF EXISTS "FK_workflow_step_executions_workflow_execution_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_executions" DROP CONSTRAINT IF EXISTS "FK_workflow_executions_parent_execution_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_executions" DROP CONSTRAINT IF EXISTS "FK_workflow_executions_current_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_executions" DROP CONSTRAINT IF EXISTS "FK_workflow_executions_workflow_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "FK_workflow_steps_error_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "FK_workflow_steps_parent_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "FK_workflow_steps_failure_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "FK_workflow_steps_success_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "FK_workflow_steps_next_step_id"`);
    await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "FK_workflow_steps_workflow_id"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_retry_count"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_external_job"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_completed_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_started_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_execution_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_workflow_step"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_workflow_execution"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_step_executions_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_recent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_triggered_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_current_step"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_completed_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_started_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_trigger"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_execution_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_workflow_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_executions_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_next"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_step_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_execution_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_workflow_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflow_steps_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_environment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_success_rate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_last_execution"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_next_execution"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_trigger_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_tenant_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_tenant_id"`);

    // Drop tables
    await queryRunner.dropTable('workflow_step_executions');
    await queryRunner.dropTable('workflow_executions');
    await queryRunner.dropTable('workflow_steps');
    await queryRunner.dropTable('workflows');

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE IF EXISTS "workflows_trigger_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "workflows_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "workflows_category_enum"`);
  }
}