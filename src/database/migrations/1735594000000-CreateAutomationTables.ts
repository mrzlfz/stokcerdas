import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class CreateAutomationTables1735594000000 implements MigrationInterface {
  name = 'CreateAutomationTables1735594000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // CREATE REORDER_RULES TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'reorder_rules',
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
            name: 'product_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'location_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'primary_supplier_id',
            type: 'uuid',
            isNullable: true,
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
            name: 'rule_type',
            type: 'enum',
            enum: ['FIXED_QUANTITY', 'EOQ', 'DEMAND_BASED', 'FORECAST_BASED'],
            default: "'FIXED_QUANTITY'",
          },
          {
            name: 'trigger',
            type: 'enum',
            enum: [
              'STOCK_LEVEL',
              'DAYS_OF_SUPPLY',
              'SCHEDULED',
              'DEMAND_FORECAST',
              'COMBINED',
            ],
            default: "'STOCK_LEVEL'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE', 'PAUSED', 'ERROR'],
            default: "'ACTIVE'",
          },

          // Stock Level Parameters
          {
            name: 'reorder_point',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'reorder_quantity',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'min_stock_level',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'max_stock_level',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'safety_stock_days',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'lead_time_days',
            type: 'integer',
            isNullable: true,
          },

          // EOQ Parameters
          {
            name: 'annual_demand',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'ordering_cost',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'holding_cost_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'unit_cost',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },

          // Demand-based Parameters
          {
            name: 'demand_lookback_days',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'demand_multiplier',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'service_level',
            type: 'decimal',
            precision: 5,
            scale: 3,
            isNullable: true,
          },

          // Forecasting Parameters
          {
            name: 'use_forecasting_data',
            type: 'boolean',
            default: false,
          },
          {
            name: 'forecast_horizon_days',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'forecast_confidence_threshold',
            type: 'decimal',
            precision: 5,
            scale: 3,
            isNullable: true,
          },

          // Supplier Selection
          {
            name: 'supplier_selection_method',
            type: 'enum',
            enum: [
              'COST_OPTIMAL',
              'QUALITY_OPTIMAL',
              'DELIVERY_OPTIMAL',
              'BALANCED',
              'RELIABILITY_OPTIMAL',
            ],
            default: "'BALANCED'",
          },
          {
            name: 'supplier_weights',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'allowed_supplier_ids',
            type: 'jsonb',
            isNullable: true,
          },

          // Budget and Constraints
          {
            name: 'max_order_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'max_order_quantity',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'min_order_quantity',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'budget_limit',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },

          // Approval Settings
          {
            name: 'requires_approval',
            type: 'boolean',
            default: true,
          },
          {
            name: 'auto_approval_threshold',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'approver_user_ids',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_fully_automated',
            type: 'boolean',
            default: false,
          },

          // Scheduling
          {
            name: 'cron_schedule',
            type: 'varchar',
            length: '50',
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
            name: 'notify_on_execution',
            type: 'boolean',
            default: false,
          },
          {
            name: 'notify_on_errors',
            type: 'boolean',
            default: true,
          },

          // Advanced Settings
          {
            name: 'seasonal_factors',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },

          // State Management
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

          // Performance Metrics
          {
            name: 'total_orders_generated',
            type: 'integer',
            default: 0,
          },
          {
            name: 'total_value_generated',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'last_order_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'average_accuracy',
            type: 'decimal',
            precision: 5,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'consecutive_errors',
            type: 'integer',
            default: 0,
          },
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

          // Execution Tracking
          {
            name: 'last_executed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'next_review_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'execution_count',
            type: 'integer',
            default: 0,
          },

          // Current Month Tracking
          {
            name: 'current_month_spend',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'current_month_orders',
            type: 'integer',
            default: 0,
          },

          // Computed Fields Cache
          {
            name: 'urgency_score',
            type: 'integer',
            default: 1,
          },
          {
            name: 'priority',
            type: 'integer',
            default: 5,
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
      }),
    );

    // Create indexes for reorder_rules table
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reorder_rules_tenant_product_location" ON "reorder_rules" ("tenant_id", "product_id", "location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_tenant_active" ON "reorder_rules" ("tenant_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_status" ON "reorder_rules" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_trigger" ON "reorder_rules" ("trigger")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_next_review" ON "reorder_rules" ("next_review_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_urgency" ON "reorder_rules" ("urgency_score")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_priority" ON "reorder_rules" ("priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_created_at" ON "reorder_rules" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_product" ON "reorder_rules" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_location" ON "reorder_rules" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_rules_supplier" ON "reorder_rules" ("primary_supplier_id")`,
    );

    // Create foreign key constraints for reorder_rules table
    await queryRunner.query(`
      ALTER TABLE "reorder_rules" 
      ADD CONSTRAINT "FK_reorder_rules_product_id" 
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "reorder_rules" 
      ADD CONSTRAINT "FK_reorder_rules_location_id" 
      FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "reorder_rules" 
      ADD CONSTRAINT "FK_reorder_rules_primary_supplier_id" 
      FOREIGN KEY ("primary_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL
    `);

    // =============================================
    // CREATE REORDER_EXECUTIONS TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'reorder_executions',
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
            name: 'reorder_rule_id',
            type: 'uuid',
            isNullable: false,
          },

          // Execution Details
          {
            name: 'executed_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'success',
            type: 'boolean',
            isNullable: false,
          },
          {
            name: 'execution_time_ms',
            type: 'integer',
            isNullable: true,
          },

          // Purchase Order Information
          {
            name: 'purchase_order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'supplier_id',
            type: 'uuid',
            isNullable: true,
          },

          // Quantities and Values
          {
            name: 'triggered_quantity',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'recommended_quantity',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'actual_quantity',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'order_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },

          // Trigger Analysis
          {
            name: 'trigger_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'urgency_score',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'confidence_score',
            type: 'decimal',
            precision: 5,
            scale: 3,
            isNullable: true,
          },

          // Detailed Calculation Results
          {
            name: 'calculation_details',
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

          // Metadata
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Create indexes for reorder_executions table
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_executions_tenant" ON "reorder_executions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_executions_rule" ON "reorder_executions" ("reorder_rule_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_executions_executed_at" ON "reorder_executions" ("executed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_executions_success" ON "reorder_executions" ("success")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_executions_purchase_order" ON "reorder_executions" ("purchase_order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reorder_executions_supplier" ON "reorder_executions" ("supplier_id")`,
    );

    // Create foreign key constraints for reorder_executions table
    await queryRunner.query(`
      ALTER TABLE "reorder_executions" 
      ADD CONSTRAINT "FK_reorder_executions_reorder_rule_id" 
      FOREIGN KEY ("reorder_rule_id") REFERENCES "reorder_rules"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "reorder_executions" 
      ADD CONSTRAINT "FK_reorder_executions_purchase_order_id" 
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "reorder_executions" 
      ADD CONSTRAINT "FK_reorder_executions_supplier_id" 
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL
    `);

    // =============================================
    // CREATE AUTOMATION_SCHEDULES TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'automation_schedules',
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
            name: 'type',
            type: 'enum',
            enum: [
              'REORDER_CHECK',
              'INVENTORY_REVIEW',
              'DEMAND_FORECAST',
              'SUPPLIER_EVALUATION',
              'SYSTEM_MAINTENANCE',
            ],
            default: "'REORDER_CHECK'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'INACTIVE', 'PAUSED', 'ERROR'],
            default: "'ACTIVE'",
          },

          // Schedule Configuration
          {
            name: 'cron_expression',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '50',
            default: "'Asia/Jakarta'",
          },
          {
            name: 'start_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'end_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },

          // Execution Settings
          {
            name: 'timeout_seconds',
            type: 'integer',
            default: 3600,
          },
          {
            name: 'max_retries',
            type: 'integer',
            default: 3,
          },
          {
            name: 'retry_delay_seconds',
            type: 'integer',
            default: 300,
          },
          {
            name: 'allow_concurrent_execution',
            type: 'boolean',
            default: false,
          },
          {
            name: 'skip_if_previous_running',
            type: 'boolean',
            default: true,
          },

          // Job Configuration
          {
            name: 'job_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'job_parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'filters',
            type: 'jsonb',
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
          {
            name: 'notify_on_timeout',
            type: 'boolean',
            default: true,
          },

          // Resource Management
          {
            name: 'priority',
            type: 'integer',
            default: 5,
          },
          {
            name: 'resource_group',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'max_concurrent_jobs',
            type: 'integer',
            default: 3,
          },

          // Error Handling
          {
            name: 'pause_on_consecutive_failures',
            type: 'boolean',
            default: true,
          },
          {
            name: 'max_consecutive_failures',
            type: 'integer',
            default: 5,
          },

          // Archival Settings
          {
            name: 'archive_on_completion',
            type: 'boolean',
            default: false,
          },
          {
            name: 'retention_days',
            type: 'integer',
            default: 90,
          },

          // State Management
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

          // Execution Statistics
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
            name: 'average_execution_time',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'last_execution',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'last_execution_duration',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'last_success',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'last_failure',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'last_error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'next_execution',
            type: 'timestamp with time zone',
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
      }),
    );

    // Create indexes for automation_schedules table
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_tenant" ON "automation_schedules" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_type" ON "automation_schedules" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_status" ON "automation_schedules" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_active" ON "automation_schedules" ("is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_next_execution" ON "automation_schedules" ("next_execution")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_priority" ON "automation_schedules" ("priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_resource_group" ON "automation_schedules" ("resource_group")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_schedules_created_at" ON "automation_schedules" ("created_at")`,
    );

    // =============================================
    // CREATE SCHEDULE_EXECUTIONS TABLE
    // =============================================
    await queryRunner.createTable(
      new Table({
        name: 'schedule_executions',
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
            name: 'schedule_id',
            type: 'uuid',
            isNullable: false,
          },

          // Execution Details
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
          {
            name: 'status',
            type: 'enum',
            enum: ['RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED'],
            default: "'RUNNING'",
          },

          // Job Information
          {
            name: 'job_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'job_parameters',
            type: 'jsonb',
            isNullable: true,
          },

          // Results and Output
          {
            name: 'result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output_summary',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'items_processed',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'items_successful',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'items_failed',
            type: 'integer',
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
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },

          // Performance Metrics
          {
            name: 'cpu_usage_percent',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'memory_usage_mb',
            type: 'integer',
            isNullable: true,
          },

          // Metadata
          {
            name: 'triggered_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'execution_context',
            type: 'jsonb',
            isNullable: true,
          },

          // Audit Fields
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Create indexes for schedule_executions table
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_executions_tenant" ON "schedule_executions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_executions_schedule" ON "schedule_executions" ("schedule_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_executions_started_at" ON "schedule_executions" ("started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_executions_status" ON "schedule_executions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_executions_job_id" ON "schedule_executions" ("job_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_executions_completed_at" ON "schedule_executions" ("completed_at")`,
    );

    // Create foreign key constraints for schedule_executions table
    await queryRunner.query(`
      ALTER TABLE "schedule_executions" 
      ADD CONSTRAINT "FK_schedule_executions_schedule_id" 
      FOREIGN KEY ("schedule_id") REFERENCES "automation_schedules"("id") ON DELETE CASCADE
    `);

    // =============================================
    // CREATE UPDATED_AT TRIGGERS
    // =============================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Add triggers for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_reorder_rules_updated_at 
        BEFORE UPDATE ON reorder_rules 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_automation_schedules_updated_at 
        BEFORE UPDATE ON automation_schedules 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // =============================================
    // CREATE COMPUTED FIELDS FUNCTIONS
    // =============================================

    // Function to check if reorder rule is eligible for execution
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION is_reorder_rule_eligible(rule_row reorder_rules)
      RETURNS boolean AS $$
      BEGIN
        RETURN rule_row.is_active = true 
          AND rule_row.is_paused = false 
          AND rule_row.status = 'ACTIVE'
          AND (rule_row.paused_until IS NULL OR rule_row.paused_until < CURRENT_TIMESTAMP)
          AND rule_row.consecutive_errors < 5;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function to check if reorder rule is due for execution
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION is_reorder_rule_due(rule_row reorder_rules)
      RETURNS boolean AS $$
      BEGIN
        RETURN rule_row.next_review_date IS NULL 
          OR rule_row.next_review_date <= CURRENT_TIMESTAMP;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function to check if automation schedule should execute
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION should_schedule_execute(schedule_row automation_schedules)
      RETURNS boolean AS $$
      BEGIN
        RETURN schedule_row.is_active = true 
          AND schedule_row.is_paused = false 
          AND schedule_row.status = 'ACTIVE'
          AND (schedule_row.paused_until IS NULL OR schedule_row.paused_until < CURRENT_TIMESTAMP)
          AND (schedule_row.next_execution IS NULL OR schedule_row.next_execution <= CURRENT_TIMESTAMP)
          AND schedule_row.consecutive_failures < schedule_row.max_consecutive_failures;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function to check if automation schedule can execute (considering concurrency)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION can_schedule_execute(schedule_row automation_schedules)
      RETURNS boolean AS $$
      DECLARE
        running_count integer;
      BEGIN
        -- Check if schedule should execute first
        IF NOT should_schedule_execute(schedule_row) THEN
          RETURN false;
        END IF;

        -- If concurrent execution is not allowed, check for running executions
        IF schedule_row.allow_concurrent_execution = false THEN
          SELECT COUNT(*) INTO running_count
          FROM schedule_executions
          WHERE schedule_id = schedule_row.id 
            AND status = 'RUNNING';
          
          IF running_count > 0 THEN
            RETURN false;
          END IF;
        END IF;

        RETURN true;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // =============================================
    // CREATE AUTOMATION-SPECIFIC INDEXES
    // =============================================

    // Composite indexes for performance
    await queryRunner.query(`
      CREATE INDEX IDX_reorder_rules_eligibility 
      ON reorder_rules (tenant_id, is_active, is_paused, status) 
      WHERE is_active = true AND is_paused = false AND status = 'ACTIVE';
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_reorder_rules_due_for_execution 
      ON reorder_rules (tenant_id, next_review_date) 
      WHERE is_active = true AND is_paused = false;
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_automation_schedules_ready_to_execute 
      ON automation_schedules (tenant_id, next_execution) 
      WHERE is_active = true AND is_paused = false AND status = 'ACTIVE';
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_schedule_executions_running 
      ON schedule_executions (schedule_id, status) 
      WHERE status = 'RUNNING';
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_reorder_executions_recent 
      ON reorder_executions (tenant_id, executed_at DESC);
    `);

    // =============================================
    // INSERT DEFAULT DATA
    // =============================================

    // Create default automation schedule types (if needed)
    await queryRunner.query(`
      COMMENT ON TABLE reorder_rules IS 'Stores automated reorder rules configuration for products and locations';
      COMMENT ON TABLE reorder_executions IS 'Tracks execution history of reorder rules';
      COMMENT ON TABLE automation_schedules IS 'Stores scheduled automation job configurations';
      COMMENT ON TABLE schedule_executions IS 'Tracks execution history of scheduled automation jobs';
    `);

    // Add comments on important columns
    await queryRunner.query(`
      COMMENT ON COLUMN reorder_rules.rule_type IS 'Type of reorder calculation: FIXED_QUANTITY, EOQ, DEMAND_BASED, FORECAST_BASED';
      COMMENT ON COLUMN reorder_rules.trigger IS 'What triggers the reorder: STOCK_LEVEL, DAYS_OF_SUPPLY, SCHEDULED, DEMAND_FORECAST, COMBINED';
      COMMENT ON COLUMN reorder_rules.supplier_selection_method IS 'Method for selecting suppliers: COST_OPTIMAL, QUALITY_OPTIMAL, DELIVERY_OPTIMAL, BALANCED, RELIABILITY_OPTIMAL';
      COMMENT ON COLUMN automation_schedules.type IS 'Type of scheduled automation: REORDER_CHECK, INVENTORY_REVIEW, DEMAND_FORECAST, SUPPLIER_EVALUATION, SYSTEM_MAINTENANCE';
      COMMENT ON COLUMN automation_schedules.cron_expression IS 'Cron expression for scheduling (supports standard 5-field format)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop computed field functions
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS can_schedule_execute(automation_schedules);`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS should_schedule_execute(automation_schedules);`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS is_reorder_rule_due(reorder_rules);`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS is_reorder_rule_eligible(reorder_rules);`,
    );

    // Drop updated_at trigger function
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_automation_schedules_updated_at ON automation_schedules;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_reorder_rules_updated_at ON reorder_rules;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_updated_at_column();`,
    );

    // Drop tables in reverse order (respecting foreign key constraints)
    await queryRunner.dropTable('schedule_executions');
    await queryRunner.dropTable('automation_schedules');
    await queryRunner.dropTable('reorder_executions');
    await queryRunner.dropTable('reorder_rules');
  }
}
