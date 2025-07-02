import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateWorkflowTables1735595000000 implements MigrationInterface {
  name = 'CreateWorkflowTables1735595000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
            enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ERROR', 'ARCHIVED'],
            default: "'DRAFT'",
          },

          // Trigger Configuration
          {
            name: 'trigger_type',
            type: 'enum',
            enum: ['MANUAL', 'SCHEDULED', 'EVENT_BASED', 'WEBHOOK', 'CONDITION_BASED', 'API_TRIGGER'],
            default: "'MANUAL'",
          },
          {
            name: 'trigger_config',
            type: 'jsonb',
            isNullable: true,
          },

          // Execution Settings
          {
            name: 'timeout_minutes',
            type: 'integer',
            default: 30,
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
            name: 'allow_concurrent_execution',
            type: 'boolean',
            default: false,
          },
          {
            name: 'max_concurrent_executions',
            type: 'integer',
            default: 1,
          },

          // Workflow State
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_paused',
            type: 'boolean',
            default: false,
          },
          {
            name: 'paused_until',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'pause_reason',
            type: 'text',
            isNullable: true,
          },

          // Scheduling
          {
            name: 'next_execution_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'last_execution_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },

          // Performance Metrics
          {
            name: 'total_executions',
            type: 'integer',
            default: 0,
          },
          {
            name: 'successful_executions',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failed_executions',
            type: 'integer',
            default: 0,
          },
          {
            name: 'consecutive_failures',
            type: 'integer',
            default: 0,
          },
          {
            name: 'average_execution_time_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'success_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },

          // Error Handling
          {
            name: 'last_error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_error_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },

          // Validation
          {
            name: 'is_valid',
            type: 'boolean',
            default: true,
          },
          {
            name: 'validation_errors',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'last_validated_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },

          // Notification Settings
          {
            name: 'send_notifications',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notification_emails',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notify_on_start',
            type: 'boolean',
            default: false,
          },
          {
            name: 'notify_on_success',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notify_on_failure',
            type: 'boolean',
            default: true,
          },

          // Metadata
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'environment',
            type: 'varchar',
            length: '20',
            default: "'production'",
          },

          // Audit Fields
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
        indices: [
          new Index('IDX_workflows_tenant_id', ['tenant_id']),
          new Index('IDX_workflows_tenant_name', ['tenant_id', 'name'], { isUnique: true }),
          new Index('IDX_workflows_category', ['category']),
          new Index('IDX_workflows_status', ['status']),
          new Index('IDX_workflows_trigger_type', ['trigger_type']),
          new Index('IDX_workflows_active', ['is_active']),
          new Index('IDX_workflows_next_execution', ['next_execution_at']),
          new Index('IDX_workflows_last_execution', ['last_execution_at']),
          new Index('IDX_workflows_success_rate', ['success_rate']),
          new Index('IDX_workflows_created_at', ['created_at']),
          new Index('IDX_workflows_environment', ['environment']),
        ],
      }),
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
            type: 'enum',
            enum: [
              'CONDITION', 'ACTION', 'DELAY', 'LOOP', 'PARALLEL', 'API_CALL', 'DATA_TRANSFORM',
              'EMAIL_NOTIFICATION', 'SMS_NOTIFICATION', 'WEBHOOK_CALL', 'DATABASE_QUERY',
              'FILE_OPERATION', 'APPROVAL', 'USER_INPUT', 'SCRIPT_EXECUTION',
              'CHECK_STOCK_LEVEL', 'CREATE_ADJUSTMENT', 'CREATE_PURCHASE_ORDER',
              'SEND_EMAIL', 'SEND_SMS', 'UPDATE_PRODUCT', 'SYNC_INVENTORY'
            ],
            default: "'ACTION'",
          },
          {
            name: 'execution_order',
            type: 'integer',
            isNullable: false,
          },

          // Step Logic
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'input_mapping',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output_mapping',
            type: 'jsonb',
            isNullable: true,
          },

          // Conditional Execution
          {
            name: 'execution_conditions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'skip_on_condition',
            type: 'jsonb',
            isNullable: true,
          },

          // Error Handling
          {
            name: 'on_error_action',
            type: 'enum',
            enum: ['STOP', 'CONTINUE', 'RETRY', 'SKIP', 'GOTO_STEP'],
            default: "'STOP'",
          },
          {
            name: 'max_retries',
            type: 'integer',
            default: 3,
          },
          {
            name: 'retry_delay_seconds',
            type: 'integer',
            default: 30,
          },
          {
            name: 'error_step_id',
            type: 'uuid',
            isNullable: true,
          },

          // Flow Control
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
            name: 'parent_step_id',
            type: 'uuid',
            isNullable: true,
          },

          // Timing
          {
            name: 'timeout_seconds',
            type: 'integer',
            default: 300,
          },
          {
            name: 'delay_before_execution',
            type: 'integer',
            default: 0,
          },

          // State
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_optional',
            type: 'boolean',
            default: false,
          },
          {
            name: 'can_be_skipped',
            type: 'boolean',
            default: false,
          },

          // Metadata
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'validation_rules',
            type: 'jsonb',
            isNullable: true,
          },

          // Audit Fields
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
        indices: [
          new Index('IDX_workflow_steps_tenant_id', ['tenant_id']),
          new Index('IDX_workflow_steps_workflow_id', ['workflow_id']),
          new Index('IDX_workflow_steps_execution_order', ['workflow_id', 'execution_order']),
          new Index('IDX_workflow_steps_step_type', ['step_type']),
          new Index('IDX_workflow_steps_active', ['is_active']),
          new Index('IDX_workflow_steps_parent', ['parent_step_id']),
          new Index('IDX_workflow_steps_next', ['next_step_id']),
          new Index('IDX_workflow_steps_created_at', ['created_at']),
        ],
        foreignKeys: [
          new ForeignKey({
            columnNames: ['workflow_id'],
            referencedTableName: 'workflows',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new ForeignKey({
            columnNames: ['next_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new ForeignKey({
            columnNames: ['success_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new ForeignKey({
            columnNames: ['failure_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new ForeignKey({
            columnNames: ['parent_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new ForeignKey({
            columnNames: ['error_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
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
            isNullable: false,
          },

          // Execution Details
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'PAUSED', 'WAITING'],
            default: "'PENDING'",
          },
          {
            name: 'trigger',
            type: 'enum',
            enum: ['MANUAL', 'SCHEDULED', 'EVENT_TRIGGERED', 'WEBHOOK_TRIGGERED', 'CONDITION_MET', 'API_TRIGGERED'],
            default: "'MANUAL'",
          },

          // Timing
          {
            name: 'started_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },

          // Step Progress
          {
            name: 'total_steps',
            type: 'integer',
            default: 0,
          },
          {
            name: 'completed_steps',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failed_steps',
            type: 'integer',
            default: 0,
          },
          {
            name: 'skipped_steps',
            type: 'integer',
            default: 0,
          },
          {
            name: 'current_step_id',
            type: 'uuid',
            isNullable: true,
          },

          // Data
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
            name: 'variables',
            type: 'jsonb',
            isNullable: true,
          },

          // Error Information
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_stack',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_step_id',
            type: 'uuid',
            isNullable: true,
          },

          // Performance Metrics
          {
            name: 'peak_memory_usage_mb',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'cpu_time_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'api_calls_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'db_queries_count',
            type: 'integer',
            default: 0,
          },

          // Triggering Information
          {
            name: 'triggered_by_user_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'triggered_by_system',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'trigger_context',
            type: 'jsonb',
            isNullable: true,
          },

          // Execution Context
          {
            name: 'execution_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'environment',
            type: 'varchar',
            length: '20',
            default: "'production'",
          },

          // Retry Information
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'parent_execution_id',
            type: 'uuid',
            isNullable: true,
          },

          // Audit Fields
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new Index('IDX_workflow_executions_tenant_id', ['tenant_id']),
          new Index('IDX_workflow_executions_workflow_id', ['workflow_id']),
          new Index('IDX_workflow_executions_execution_id', ['execution_id'], { isUnique: true }),
          new Index('IDX_workflow_executions_status', ['status']),
          new Index('IDX_workflow_executions_trigger', ['trigger']),
          new Index('IDX_workflow_executions_started_at', ['started_at']),
          new Index('IDX_workflow_executions_completed_at', ['completed_at']),
          new Index('IDX_workflow_executions_current_step', ['current_step_id']),
          new Index('IDX_workflow_executions_triggered_by', ['triggered_by_user_id']),
          new Index('IDX_workflow_executions_parent', ['parent_execution_id']),
          new Index('IDX_workflow_executions_recent', ['tenant_id', 'started_at']),
        ],
        foreignKeys: [
          new ForeignKey({
            columnNames: ['workflow_id'],
            referencedTableName: 'workflows',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new ForeignKey({
            columnNames: ['current_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new ForeignKey({
            columnNames: ['error_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
          new ForeignKey({
            columnNames: ['parent_execution_id'],
            referencedTableName: 'workflow_executions',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
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
            type: 'enum',
            enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'TIMEOUT', 'CANCELLED'],
            default: "'PENDING'",
          },

          // Timing
          {
            name: 'started_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },

          // Data
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
            name: 'context_variables',
            type: 'jsonb',
            isNullable: true,
          },

          // Error Information
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_stack',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_code',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },

          // Performance Metrics
          {
            name: 'memory_usage_mb',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'cpu_time_ms',
            type: 'integer',
            isNullable: true,
          },

          // Retry Information
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

          // External References
          {
            name: 'external_job_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'external_transaction_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },

          // Metadata
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'logs',
            type: 'jsonb',
            isNullable: true,
          },

          // Audit Fields
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new Index('IDX_workflow_step_executions_tenant_id', ['tenant_id']),
          new Index('IDX_workflow_step_executions_workflow_execution', ['workflow_execution_id']),
          new Index('IDX_workflow_step_executions_workflow_step', ['workflow_step_id']),
          new Index('IDX_workflow_step_executions_execution_order', ['workflow_execution_id', 'execution_order']),
          new Index('IDX_workflow_step_executions_status', ['status']),
          new Index('IDX_workflow_step_executions_started_at', ['started_at']),
          new Index('IDX_workflow_step_executions_completed_at', ['completed_at']),
          new Index('IDX_workflow_step_executions_external_job', ['external_job_id']),
          new Index('IDX_workflow_step_executions_retry_count', ['retry_count']),
        ],
        foreignKeys: [
          new ForeignKey({
            columnNames: ['workflow_execution_id'],
            referencedTableName: 'workflow_executions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new ForeignKey({
            columnNames: ['workflow_step_id'],
            referencedTableName: 'workflow_steps',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );

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

    // =============================================
    // CREATE WORKFLOW-SPECIFIC FUNCTIONS
    // =============================================
    
    // Function to check if workflow can execute
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION can_workflow_execute(workflow_row workflows)
      RETURNS boolean AS $$
      DECLARE
        running_executions integer;
      BEGIN
        -- Check basic eligibility
        IF NOT (workflow_row.is_active = true 
          AND workflow_row.status = 'ACTIVE'
          AND (workflow_row.paused_until IS NULL OR workflow_row.paused_until < CURRENT_TIMESTAMP)
          AND workflow_row.consecutive_failures < 5) THEN
          RETURN false;
        END IF;

        -- Check concurrent execution limit
        IF workflow_row.allow_concurrent_execution = false THEN
          SELECT COUNT(*) INTO running_executions
          FROM workflow_executions
          WHERE workflow_id = workflow_row.id 
            AND status IN ('PENDING', 'RUNNING', 'PAUSED', 'WAITING');
          
          IF running_executions > 0 THEN
            RETURN false;
          END IF;
        ELSE
          -- Check max concurrent executions
          SELECT COUNT(*) INTO running_executions
          FROM workflow_executions
          WHERE workflow_id = workflow_row.id 
            AND status IN ('PENDING', 'RUNNING', 'PAUSED', 'WAITING');
          
          IF running_executions >= workflow_row.max_concurrent_executions THEN
            RETURN false;
          END IF;
        END IF;

        RETURN true;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function to calculate workflow success rate
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION calculate_workflow_success_rate(workflow_row workflows)
      RETURNS decimal AS $$
      BEGIN
        IF workflow_row.total_executions = 0 THEN
          RETURN NULL;
        END IF;
        
        RETURN ROUND(
          (workflow_row.successful_executions::decimal / workflow_row.total_executions::decimal) * 100, 
          2
        );
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function to check if workflow execution can be cancelled
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION can_execution_cancel(execution_row workflow_executions)
      RETURNS boolean AS $$
      BEGIN
        RETURN execution_row.status IN ('PENDING', 'RUNNING', 'PAUSED', 'WAITING');
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function to calculate execution progress percentage
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION calculate_execution_progress(execution_row workflow_executions)
      RETURNS integer AS $$
      BEGIN
        IF execution_row.total_steps = 0 THEN
          RETURN 0;
        END IF;
        
        RETURN ROUND(
          (execution_row.completed_steps::decimal / execution_row.total_steps::decimal) * 100
        )::integer;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // =============================================
    // CREATE PERFORMANCE INDEXES
    // =============================================
    
    -- Workflow eligibility index
    await queryRunner.query(`
      CREATE INDEX IDX_workflows_eligible_for_execution 
      ON workflows (tenant_id, is_active, status) 
      WHERE is_active = true AND status = 'ACTIVE';
    `);

    -- Workflow scheduled execution index
    await queryRunner.query(`
      CREATE INDEX IDX_workflows_scheduled_ready 
      ON workflows (tenant_id, trigger_type, next_execution_at) 
      WHERE trigger_type = 'SCHEDULED' AND is_active = true AND next_execution_at IS NOT NULL;
    `);

    -- Active executions index
    await queryRunner.query(`
      CREATE INDEX IDX_workflow_executions_active 
      ON workflow_executions (workflow_id, status) 
      WHERE status IN ('PENDING', 'RUNNING', 'PAUSED', 'WAITING');
    `);

    -- Recent executions for analytics
    await queryRunner.query(`
      CREATE INDEX IDX_workflow_executions_recent_completed 
      ON workflow_executions (workflow_id, completed_at DESC) 
      WHERE completed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' AND status IN ('COMPLETED', 'FAILED');
    `);

    -- Step execution performance
    await queryRunner.query(`
      CREATE INDEX IDX_workflow_step_executions_duration 
      ON workflow_step_executions (workflow_step_id, duration_ms) 
      WHERE status = 'COMPLETED';
    `);

    -- Failed step executions for debugging
    await queryRunner.query(`
      CREATE INDEX IDX_workflow_step_executions_failed 
      ON workflow_step_executions (tenant_id, status, started_at DESC) 
      WHERE status IN ('FAILED', 'TIMEOUT');
    `);

    // =============================================
    // ADD TABLE COMMENTS
    // =============================================
    await queryRunner.query(`
      COMMENT ON TABLE workflows IS 'Stores workflow definitions and configurations for automation';
      COMMENT ON TABLE workflow_steps IS 'Stores individual steps within workflows with execution logic';
      COMMENT ON TABLE workflow_executions IS 'Tracks execution instances of workflows with status and metrics';
      COMMENT ON TABLE workflow_step_executions IS 'Tracks execution of individual workflow steps with detailed metrics';
    `);

    // Add column comments
    await queryRunner.query(`
      COMMENT ON COLUMN workflows.trigger_type IS 'How the workflow is triggered: MANUAL, SCHEDULED, EVENT_BASED, WEBHOOK, CONDITION_BASED, API_TRIGGER';
      COMMENT ON COLUMN workflows.trigger_config IS 'JSON configuration for the specific trigger type';
      COMMENT ON COLUMN workflows.category IS 'Workflow category for organization: INVENTORY_MANAGEMENT, PURCHASE_ORDER, ALERT_NOTIFICATION, etc.';
      COMMENT ON COLUMN workflow_steps.step_type IS 'Type of step execution: CONDITION, ACTION, DELAY, API_CALL, etc.';
      COMMENT ON COLUMN workflow_steps.configuration IS 'JSON configuration specific to the step type';
      COMMENT ON COLUMN workflow_executions.execution_id IS 'Unique identifier for this execution instance';
      COMMENT ON COLUMN workflow_executions.trigger IS 'What triggered this execution instance';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop computed field functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS calculate_execution_progress(workflow_executions);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS can_execution_cancel(workflow_executions);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS calculate_workflow_success_rate(workflows);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS can_workflow_execute(workflows);`);

    // Drop updated_at triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflow_step_executions_updated_at ON workflow_step_executions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON workflow_executions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;`);

    // Drop tables in reverse order (respecting foreign key constraints)
    await queryRunner.dropTable('workflow_step_executions');
    await queryRunner.dropTable('workflow_executions');
    await queryRunner.dropTable('workflow_steps');
    await queryRunner.dropTable('workflows');
  }
}