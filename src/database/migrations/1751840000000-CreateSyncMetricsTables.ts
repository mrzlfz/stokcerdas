import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSyncMetricsTables1751840000000 implements MigrationInterface {
  name = 'CreateSyncMetricsTables1751840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for sync metrics
    await queryRunner.query(`
      CREATE TYPE "sync_operation_status_enum" AS ENUM(
        'started',
        'in_progress',
        'completed',
        'failed',
        'timeout',
        'cancelled'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "sync_operation_type_enum" AS ENUM(
        'product_sync',
        'inventory_sync',
        'order_sync',
        'price_sync',
        'customer_sync',
        'promotion_sync',
        'category_sync',
        'full_sync'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "sync_direction_enum" AS ENUM(
        'inbound',
        'outbound',
        'bidirectional'
      );
    `);

    // Create sync_metrics table
    await queryRunner.query(`
      CREATE TABLE "sync_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        "operation_id" character varying(100) NOT NULL,
        "operation_type" "sync_operation_type_enum" NOT NULL,
        "sync_direction" "sync_direction_enum" NOT NULL DEFAULT 'bidirectional',
        "platform" character varying(50) NOT NULL,
        "channel_id" character varying(100) NOT NULL,
        "status" "sync_operation_status_enum" NOT NULL DEFAULT 'started',
        "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_time" TIMESTAMP WITH TIME ZONE,
        "duration_ms" integer NOT NULL DEFAULT 0,
        "records_processed" integer NOT NULL DEFAULT 0,
        "records_successful" integer NOT NULL DEFAULT 0,
        "records_failed" integer NOT NULL DEFAULT 0,
        "records_skipped" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "success_rate" decimal(10,2) NOT NULL DEFAULT 0,
        "throughput_per_second" decimal(10,2) NOT NULL DEFAULT 0,
        "average_response_time_ms" integer NOT NULL DEFAULT 0,
        "peak_response_time_ms" integer NOT NULL DEFAULT 0,
        "memory_usage_bytes" bigint NOT NULL DEFAULT 0,
        "cpu_usage_microseconds" bigint NOT NULL DEFAULT 0,
        "last_error" jsonb,
        "business_context" jsonb NOT NULL,
        "performance_metrics" jsonb NOT NULL,
        "data_quality_metrics" jsonb NOT NULL,
        "platform_specific_metrics" jsonb NOT NULL,
        "sync_configuration" jsonb NOT NULL,
        "alerts_generated" jsonb NOT NULL DEFAULT '[]',
        "correlation_id" character varying(100),
        "parent_operation_id" character varying(100),
        "metadata" jsonb,
        "notes" text,
        "is_manual_trigger" boolean NOT NULL DEFAULT false,
        "is_scheduled_trigger" boolean NOT NULL DEFAULT false,
        "is_webhook_trigger" boolean NOT NULL DEFAULT false,
        "is_event_trigger" boolean NOT NULL DEFAULT false,
        "requires_manual_review" boolean NOT NULL DEFAULT false,
        "has_data_quality_issues" boolean NOT NULL DEFAULT false,
        "has_performance_issues" boolean NOT NULL DEFAULT false,
        "Indonesian_business_hours_only" boolean NOT NULL DEFAULT false,
        "ramadan_sensitive" boolean NOT NULL DEFAULT false,
        "holiday_sensitive" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_sync_metrics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sync_metrics_operation_id" UNIQUE ("operation_id")
      );
    `);

    // Create indexes for sync_metrics table
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_tenant_platform_operation_created" ON "sync_metrics" ("tenant_id", "platform", "operation_type", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_tenant_operation_id" ON "sync_metrics" ("tenant_id", "operation_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_tenant_status_created" ON "sync_metrics" ("tenant_id", "status", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_platform_channel_status" ON "sync_metrics" ("platform", "channel_id", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_created_at" ON "sync_metrics" ("created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_start_time" ON "sync_metrics" ("start_time");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_end_time" ON "sync_metrics" ("end_time");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_duration_ms" ON "sync_metrics" ("duration_ms");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_success_rate" ON "sync_metrics" ("success_rate");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_throughput" ON "sync_metrics" ("throughput_per_second");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_response_time" ON "sync_metrics" ("average_response_time_ms");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_error_count" ON "sync_metrics" ("error_count");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_correlation_id" ON "sync_metrics" ("correlation_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_parent_operation_id" ON "sync_metrics" ("parent_operation_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_manual_trigger" ON "sync_metrics" ("is_manual_trigger", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_scheduled_trigger" ON "sync_metrics" ("is_scheduled_trigger", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_webhook_trigger" ON "sync_metrics" ("is_webhook_trigger", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_event_trigger" ON "sync_metrics" ("is_event_trigger", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_manual_review" ON "sync_metrics" ("requires_manual_review", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_data_quality_issues" ON "sync_metrics" ("has_data_quality_issues", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_performance_issues" ON "sync_metrics" ("has_performance_issues", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_business_hours_only" ON "sync_metrics" ("Indonesian_business_hours_only", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_ramadan_sensitive" ON "sync_metrics" ("ramadan_sensitive", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_holiday_sensitive" ON "sync_metrics" ("holiday_sensitive", "created_at");
    `);

    // Create GIN indexes for JSONB fields for efficient queries
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_business_context_gin" ON "sync_metrics" USING GIN ("business_context");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_performance_metrics_gin" ON "sync_metrics" USING GIN ("performance_metrics");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_data_quality_metrics_gin" ON "sync_metrics" USING GIN ("data_quality_metrics");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_platform_metrics_gin" ON "sync_metrics" USING GIN ("platform_specific_metrics");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_sync_configuration_gin" ON "sync_metrics" USING GIN ("sync_configuration");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_alerts_generated_gin" ON "sync_metrics" USING GIN ("alerts_generated");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_metadata_gin" ON "sync_metrics" USING GIN ("metadata");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_last_error_gin" ON "sync_metrics" USING GIN ("last_error");
    `);

    // Create partial indexes for efficient queries on Indonesian business context
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_business_hours_true" ON "sync_metrics" ("tenant_id", "created_at") 
      WHERE (business_context->>'isBusinessHours')::boolean = true;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_ramadan_period_true" ON "sync_metrics" ("tenant_id", "created_at") 
      WHERE (business_context->>'ramadanPeriod')::boolean = true;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_holiday_period_true" ON "sync_metrics" ("tenant_id", "created_at") 
      WHERE (business_context->>'holidayPeriod')::boolean = true;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_peak_traffic_true" ON "sync_metrics" ("tenant_id", "created_at") 
      WHERE (business_context->>'peakTrafficPeriod')::boolean = true;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_working_day_true" ON "sync_metrics" ("tenant_id", "created_at") 
      WHERE (business_context->>'workingDay')::boolean = true;
    `);

    // Create performance-optimized indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_high_performance" ON "sync_metrics" ("tenant_id", "platform", "success_rate", "average_response_time_ms") 
      WHERE success_rate >= 95 AND average_response_time_ms < 5000;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_low_performance" ON "sync_metrics" ("tenant_id", "platform", "success_rate", "average_response_time_ms") 
      WHERE success_rate < 90 OR average_response_time_ms > 5000;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_failed_operations" ON "sync_metrics" ("tenant_id", "platform", "status", "created_at") 
      WHERE status = 'failed';
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_timeout_operations" ON "sync_metrics" ("tenant_id", "platform", "status", "created_at") 
      WHERE status = 'timeout';
    `);

    // Create composite indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_platform_performance" ON "sync_metrics" ("platform", "success_rate", "throughput_per_second", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_tenant_platform_date" ON "sync_metrics" ("tenant_id", "platform", "created_at" DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_operation_type_status" ON "sync_metrics" ("operation_type", "status", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_metrics_channel_performance" ON "sync_metrics" ("channel_id", "success_rate", "average_response_time_ms", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table
    await queryRunner.query(`DROP TABLE "sync_metrics"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "sync_direction_enum"`);
    await queryRunner.query(`DROP TYPE "sync_operation_type_enum"`);
    await queryRunner.query(`DROP TYPE "sync_operation_status_enum"`);
  }
}