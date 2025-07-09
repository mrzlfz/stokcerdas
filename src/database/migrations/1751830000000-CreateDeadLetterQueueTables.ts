import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeadLetterQueueTables1751830000000 implements MigrationInterface {
  name = 'CreateDeadLetterQueueTables1751830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for dead letter queue
    await queryRunner.query(`
      CREATE TYPE "dead_letter_job_status_enum" AS ENUM(
        'quarantined',
        'analyzing',
        'retry_scheduled',
        'retrying',
        'recovered',
        'permanently_failed',
        'archived'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "dead_letter_job_priority_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'critical'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "failure_type_enum" AS ENUM(
        'authentication',
        'network',
        'rate_limit',
        'business_logic',
        'timeout',
        'validation',
        'resource_exhausted',
        'unknown'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "recovery_strategy_enum" AS ENUM(
        'manual_retry',
        'delayed_retry',
        'modified_retry',
        'escalate',
        'discard'
      );
    `);

    // Create ENUM types for job failure patterns
    await queryRunner.query(`
      CREATE TYPE "pattern_type_enum" AS ENUM(
        'recurring_failure',
        'time_based_failure',
        'platform_specific',
        'business_hours',
        'rate_limit_pattern',
        'authentication_pattern',
        'seasonal_pattern',
        'escalation_pattern'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "pattern_severity_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'critical'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "pattern_status_enum" AS ENUM(
        'active',
        'resolved',
        'suppressed',
        'monitoring'
      );
    `);

    // Create ENUM types for job recovery logs
    await queryRunner.query(`
      CREATE TYPE "recovery_status_enum" AS ENUM(
        'initiated',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'timeout'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "recovery_method_enum" AS ENUM(
        'automatic_retry',
        'manual_retry',
        'modified_retry',
        'escalation',
        'manual_intervention',
        'pattern_based',
        'bulk_recovery'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "recovery_trigger_enum" AS ENUM(
        'schedule',
        'manual',
        'pattern_detection',
        'business_hours',
        'system_recovery',
        'escalation'
      );
    `);

    // Create dead_letter_jobs table
    await queryRunner.query(`
      CREATE TABLE "dead_letter_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "original_queue" character varying(100) NOT NULL,
        "original_job_type" character varying(100) NOT NULL,
        "original_job_id" character varying(100) NOT NULL,
        "original_job_data" jsonb NOT NULL,
        "original_job_options" jsonb,
        "status" "dead_letter_job_status_enum" NOT NULL DEFAULT 'quarantined',
        "priority" "dead_letter_job_priority_enum" NOT NULL DEFAULT 'medium',
        "failure_type" "failure_type_enum" NOT NULL DEFAULT 'unknown',
        "failure_reason" text NOT NULL,
        "stack_trace" text,
        "error_details" text,
        "retry_count" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 0,
        "first_failure_at" TIMESTAMP WITH TIME ZONE,
        "last_failure_at" TIMESTAMP WITH TIME ZONE,
        "last_retry_at" TIMESTAMP WITH TIME ZONE,
        "next_retry_at" TIMESTAMP WITH TIME ZONE,
        "recovered_at" TIMESTAMP WITH TIME ZONE,
        "recovery_strategy" "recovery_strategy_enum",
        "recovery_metadata" jsonb,
        "channel_id" character varying(100),
        "platform" character varying(100),
        "correlation_id" character varying(100),
        "request_id" character varying(100),
        "business_context" jsonb,
        "notes" text,
        "assigned_to" character varying(100),
        "assigned_at" TIMESTAMP WITH TIME ZONE,
        "metrics" jsonb,
        "is_critical" boolean NOT NULL DEFAULT false,
        "requires_manual_intervention" boolean NOT NULL DEFAULT false,
        "is_business_hours_only" boolean NOT NULL DEFAULT false,
        "is_ramadan_sensitive" boolean NOT NULL DEFAULT false,
        "is_holiday_sensitive" boolean NOT NULL DEFAULT false,
        "timezone" character varying(50),
        CONSTRAINT "PK_dead_letter_jobs" PRIMARY KEY ("id")
      );
    `);

    // Create job_failure_patterns table
    await queryRunner.query(`
      CREATE TABLE "job_failure_patterns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "pattern_key" character varying(200) NOT NULL,
        "pattern_name" character varying(100) NOT NULL,
        "pattern_description" text NOT NULL,
        "pattern_type" "pattern_type_enum" NOT NULL,
        "severity" "pattern_severity_enum" NOT NULL DEFAULT 'medium',
        "status" "pattern_status_enum" NOT NULL DEFAULT 'active',
        "failure_type" "failure_type_enum" NOT NULL,
        "original_queue" character varying(100) NOT NULL,
        "original_job_type" character varying(100) NOT NULL,
        "channel_id" character varying(100),
        "platform" character varying(100),
        "occurrence_count" integer NOT NULL DEFAULT 1,
        "affected_jobs_count" integer NOT NULL DEFAULT 0,
        "first_occurrence_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_occurrence_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "pattern_conditions" jsonb NOT NULL,
        "pattern_metadata" jsonb NOT NULL,
        "detection_rules" jsonb NOT NULL,
        "mitigation_strategies" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_auto_detected" boolean NOT NULL DEFAULT false,
        "requires_immediate_attention" boolean NOT NULL DEFAULT false,
        "suppressed_by" character varying(100),
        "suppressed_at" TIMESTAMP WITH TIME ZONE,
        "suppression_reason" text,
        "resolved_by" character varying(100),
        "resolution_notes" text,
        "alert_count" integer NOT NULL DEFAULT 0,
        "last_alert_at" TIMESTAMP WITH TIME ZONE,
        "timezone" character varying(50) NOT NULL DEFAULT 'Asia/Jakarta',
        "affects_indonesian_business_hours" boolean NOT NULL DEFAULT false,
        "ramadan_pattern" boolean NOT NULL DEFAULT false,
        "holiday_pattern" boolean NOT NULL DEFAULT false,
        "example_job_id" uuid,
        CONSTRAINT "PK_job_failure_patterns" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_job_failure_patterns_pattern_key" UNIQUE ("pattern_key"),
        CONSTRAINT "FK_job_failure_patterns_example_job" FOREIGN KEY ("example_job_id") REFERENCES "dead_letter_jobs"("id") ON DELETE SET NULL
      );
    `);

    // Create job_recovery_logs table
    await queryRunner.query(`
      CREATE TABLE "job_recovery_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "dead_letter_job_id" uuid NOT NULL,
        "pattern_id" uuid,
        "status" "recovery_status_enum" NOT NULL DEFAULT 'initiated',
        "recovery_method" "recovery_method_enum" NOT NULL,
        "recovery_strategy" "recovery_strategy_enum" NOT NULL,
        "recovery_trigger" "recovery_trigger_enum" NOT NULL,
        "recovery_job_id" character varying(100),
        "recovery_queue" character varying(100),
        "recovery_started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "recovery_completed_at" TIMESTAMP WITH TIME ZONE,
        "recovery_failed_at" TIMESTAMP WITH TIME ZONE,
        "recovery_duration_ms" integer NOT NULL DEFAULT 0,
        "recovery_attempt_number" integer NOT NULL DEFAULT 1,
        "recovery_configuration" jsonb NOT NULL,
        "recovery_result" jsonb,
        "recovery_notes" text,
        "initiated_by" character varying(100),
        "assigned_to" character varying(100),
        "approved_by" character varying(100),
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "approval_notes" text,
        "correlation_id" character varying(100),
        "request_id" character varying(100),
        "business_context" jsonb,
        "error_analysis" jsonb,
        "success_metrics" jsonb,
        "requires_approval" boolean NOT NULL DEFAULT false,
        "is_critical_recovery" boolean NOT NULL DEFAULT false,
        "is_bulk_recovery" boolean NOT NULL DEFAULT false,
        "has_side_effects" boolean NOT NULL DEFAULT false,
        "requires_manual_validation" boolean NOT NULL DEFAULT false,
        "is_business_hours_only" boolean NOT NULL DEFAULT false,
        "timezone" character varying(50) NOT NULL DEFAULT 'Asia/Jakarta',
        "scheduled_for_business_hours" boolean NOT NULL DEFAULT false,
        "ramadan_consideration" boolean NOT NULL DEFAULT false,
        "holiday_consideration" boolean NOT NULL DEFAULT false,
        "validation_results" jsonb,
        CONSTRAINT "PK_job_recovery_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_recovery_logs_dead_letter_job" FOREIGN KEY ("dead_letter_job_id") REFERENCES "dead_letter_jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_job_recovery_logs_pattern" FOREIGN KEY ("pattern_id") REFERENCES "job_failure_patterns"("id") ON DELETE SET NULL
      );
    `);

    // Create indexes for dead_letter_jobs table
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_tenant_status_created" ON "dead_letter_jobs" ("tenant_id", "status", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_tenant_queue_type" ON "dead_letter_jobs" ("tenant_id", "original_queue", "original_job_type");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_tenant_failure_type" ON "dead_letter_jobs" ("tenant_id", "failure_type", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_tenant_priority_status" ON "dead_letter_jobs" ("tenant_id", "priority", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_next_retry_at" ON "dead_letter_jobs" ("next_retry_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_platform" ON "dead_letter_jobs" ("tenant_id", "platform");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_channel_id" ON "dead_letter_jobs" ("tenant_id", "channel_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_correlation_id" ON "dead_letter_jobs" ("correlation_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_assigned_to" ON "dead_letter_jobs" ("assigned_to", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dead_letter_jobs_business_hours" ON "dead_letter_jobs" ("is_business_hours_only", "next_retry_at");
    `);

    // Create indexes for job_failure_patterns table
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_tenant_type_status" ON "job_failure_patterns" ("tenant_id", "pattern_type", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_tenant_severity_created" ON "job_failure_patterns" ("tenant_id", "severity", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_tenant_failure_platform" ON "job_failure_patterns" ("tenant_id", "failure_type", "platform");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_pattern_key" ON "job_failure_patterns" ("pattern_key");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_is_active" ON "job_failure_patterns" ("is_active");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_last_occurrence" ON "job_failure_patterns" ("last_occurrence_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_alert_count" ON "job_failure_patterns" ("alert_count", "last_alert_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_failure_patterns_indonesian_business" ON "job_failure_patterns" ("affects_indonesian_business_hours", "is_active");
    `);

    // Create indexes for job_recovery_logs table
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_tenant_status_created" ON "job_recovery_logs" ("tenant_id", "status", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_tenant_method_status" ON "job_recovery_logs" ("tenant_id", "recovery_method", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_dead_letter_job_id" ON "job_recovery_logs" ("dead_letter_job_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_pattern_id" ON "job_recovery_logs" ("pattern_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_recovery_started_at" ON "job_recovery_logs" ("recovery_started_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_recovery_duration" ON "job_recovery_logs" ("recovery_duration_ms");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_assigned_to" ON "job_recovery_logs" ("assigned_to", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_approved_by" ON "job_recovery_logs" ("approved_by", "approved_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_business_hours" ON "job_recovery_logs" ("scheduled_for_business_hours", "recovery_started_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_job_recovery_logs_correlation_id" ON "job_recovery_logs" ("correlation_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "job_recovery_logs"`);
    await queryRunner.query(`DROP TABLE "job_failure_patterns"`);
    await queryRunner.query(`DROP TABLE "dead_letter_jobs"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "recovery_trigger_enum"`);
    await queryRunner.query(`DROP TYPE "recovery_method_enum"`);
    await queryRunner.query(`DROP TYPE "recovery_status_enum"`);
    await queryRunner.query(`DROP TYPE "pattern_status_enum"`);
    await queryRunner.query(`DROP TYPE "pattern_severity_enum"`);
    await queryRunner.query(`DROP TYPE "pattern_type_enum"`);
    await queryRunner.query(`DROP TYPE "recovery_strategy_enum"`);
    await queryRunner.query(`DROP TYPE "failure_type_enum"`);
    await queryRunner.query(`DROP TYPE "dead_letter_job_priority_enum"`);
    await queryRunner.query(`DROP TYPE "dead_letter_job_status_enum"`);
  }
}