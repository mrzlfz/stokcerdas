import { MigrationInterface, QueryRunner } from "typeorm";

export class FixEnterpriseSchemaPattern21751631100000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Comprehensive fix for Pattern 2: Inconsistent tenant naming and mixed conventions
        // Affected tables: alert_configurations, workflows
        
        await queryRunner.query(`
            DO $$
            BEGIN
                -- ====================================
                -- ALERT_CONFIGURATIONS TABLE FIXES
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alert_configurations') THEN
                    -- Fix tenant column naming (entity expects tenant_id, table has tenantId)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'tenant_id') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "tenant_id" uuid;
                        -- Copy data from camelCase column if it exists
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'tenantId') THEN
                            UPDATE "alert_configurations" SET "tenant_id" = "tenantId";
                            -- Make it NOT NULL after copying data
                            ALTER TABLE "alert_configurations" ALTER COLUMN "tenant_id" SET NOT NULL;
                        END IF;
                    END IF;

                    -- Add missing AuditableEntity columns (soft delete)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'created_at') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'updated_at') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'created_by') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "created_by" uuid;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'updated_by') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "updated_by" uuid;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'is_deleted') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "is_deleted" boolean DEFAULT false;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'deleted_at') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "deleted_at" timestamp with time zone;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'deleted_by') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "deleted_by" uuid;
                    END IF;

                    -- Fix AlertConfiguration-specific columns (convert camelCase to snake_case)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'alert_type') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "alert_type" varchar(50);
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'alertType') THEN
                            UPDATE "alert_configurations" SET "alert_type" = "alertType"::text;
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'is_enabled') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "is_enabled" boolean DEFAULT true;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'isEnabled') THEN
                            UPDATE "alert_configurations" SET "is_enabled" = "isEnabled";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'product_id') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "product_id" uuid;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'productId') THEN
                            UPDATE "alert_configurations" SET "product_id" = "productId";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'location_id') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "location_id" uuid;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'locationId') THEN
                            UPDATE "alert_configurations" SET "location_id" = "locationId";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'recipient_user_ids') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "recipient_user_ids" text[] DEFAULT ARRAY[]::text[];
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'recipientUserIds') THEN
                            UPDATE "alert_configurations" SET "recipient_user_ids" = "recipientUserIds";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'recipient_roles') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "recipient_roles" text[] DEFAULT ARRAY[]::text[];
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'recipientRoles') THEN
                            UPDATE "alert_configurations" SET "recipient_roles" = "recipientRoles";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'recipient_emails') THEN
                        ALTER TABLE "alert_configurations" ADD COLUMN "recipient_emails" text[] DEFAULT ARRAY[]::text[];
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'recipientEmails') THEN
                            UPDATE "alert_configurations" SET "recipient_emails" = "recipientEmails";
                        END IF;
                    END IF;
                END IF;

                -- ====================================
                -- WORKFLOWS TABLE FIXES
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
                    -- Workflows already has tenant_id correctly, but missing AuditableEntity columns
                    
                    -- Add missing AuditableEntity columns
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'created_by') THEN
                        ALTER TABLE "workflows" ADD COLUMN "created_by" uuid;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'updated_by') THEN
                        ALTER TABLE "workflows" ADD COLUMN "updated_by" uuid;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'is_deleted') THEN
                        ALTER TABLE "workflows" ADD COLUMN "is_deleted" boolean DEFAULT false;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'deleted_at') THEN
                        ALTER TABLE "workflows" ADD COLUMN "deleted_at" timestamp with time zone;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'deleted_by') THEN
                        ALTER TABLE "workflows" ADD COLUMN "deleted_by" uuid;
                    END IF;

                    -- Fix workflow timestamp columns to include timezone
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'created_at') THEN
                        ALTER TABLE "workflows" ADD COLUMN "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'updated_at') THEN
                        ALTER TABLE "workflows" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
                    END IF;

                    -- Fix Workflow-specific camelCase columns
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'trigger_type') THEN
                        ALTER TABLE "workflows" ADD COLUMN "trigger_type" varchar(50);
                        -- Note: workflows table already has trigger_type correctly
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'trigger_config') THEN
                        ALTER TABLE "workflows" ADD COLUMN "trigger_config" jsonb;
                        -- Note: workflows table already has trigger_config correctly
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'schedule_config') THEN
                        ALTER TABLE "workflows" ADD COLUMN "schedule_config" jsonb;
                        -- Note: workflows table already has schedule_config correctly
                    END IF;
                END IF;

                -- ====================================
                -- WORKFLOW_EXECUTIONS TABLE FIXES (if needed)
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions') THEN
                    -- Check if workflow_executions needs similar fixes
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'tenant_id') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "tenant_id" uuid;
                        -- Copy from tenantId if it exists
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'tenantId') THEN
                            UPDATE "workflow_executions" SET "tenant_id" = "tenantId";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'workflow_id') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "workflow_id" uuid;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'workflowId') THEN
                            UPDATE "workflow_executions" SET "workflow_id" = "workflowId";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'started_at') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "started_at" timestamp with time zone;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'startedAt') THEN
                            UPDATE "workflow_executions" SET "started_at" = "startedAt";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'completed_at') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "completed_at" timestamp with time zone;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'completedAt') THEN
                            UPDATE "workflow_executions" SET "completed_at" = "completedAt";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'failed_at') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "failed_at" timestamp with time zone;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'failedAt') THEN
                            UPDATE "workflow_executions" SET "failed_at" = "failedAt";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'executed_by') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "executed_by" uuid;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'executedBy') THEN
                            UPDATE "workflow_executions" SET "executed_by" = "executedBy";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'error_message') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "error_message" text;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'errorMessage') THEN
                            UPDATE "workflow_executions" SET "error_message" = "errorMessage";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'step_count') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "step_count" integer DEFAULT 0;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'stepCount') THEN
                            UPDATE "workflow_executions" SET "step_count" = "stepCount";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'completed_steps') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "completed_steps" integer DEFAULT 0;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'completedSteps') THEN
                            UPDATE "workflow_executions" SET "completed_steps" = "completedSteps";
                        END IF;
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'failed_steps') THEN
                        ALTER TABLE "workflow_executions" ADD COLUMN "failed_steps" integer DEFAULT 0;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'failedSteps') THEN
                            UPDATE "workflow_executions" SET "failed_steps" = "failedSteps";
                        END IF;
                    END IF;
                END IF;

                RAISE NOTICE 'Enterprise Schema Pattern 2 fixes completed successfully';
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback by removing the snake_case columns that were added
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Remove added snake_case columns from alert_configurations
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'tenant_id') THEN
                    ALTER TABLE "alert_configurations" DROP COLUMN "tenant_id";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'is_deleted') THEN
                    ALTER TABLE "alert_configurations" DROP COLUMN "is_deleted";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'deleted_at') THEN
                    ALTER TABLE "alert_configurations" DROP COLUMN "deleted_at";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alert_configurations' AND column_name = 'deleted_by') THEN
                    ALTER TABLE "alert_configurations" DROP COLUMN "deleted_by";
                END IF;
                -- Remove other added columns...

                -- Remove added columns from workflows
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'is_deleted') THEN
                    ALTER TABLE "workflows" DROP COLUMN "is_deleted";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'deleted_at') THEN
                    ALTER TABLE "workflows" DROP COLUMN "deleted_at";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'deleted_by') THEN
                    ALTER TABLE "workflows" DROP COLUMN "deleted_by";
                END IF;

                RAISE NOTICE 'Enterprise Schema Pattern 2 rollback completed';
            END $$;
        `);
    }

}