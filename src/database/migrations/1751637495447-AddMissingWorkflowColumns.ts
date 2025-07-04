import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingWorkflowColumns1751637495447 implements MigrationInterface {
    name = 'AddMissingWorkflowColumns1751637495447';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // =============================================
        // ADD ALL MISSING WORKFLOW COLUMNS
        // =============================================

        // Create priority enum type
        await queryRunner.query(`
            CREATE TYPE "workflow_priority_enum" AS ENUM('1', '5', '8', '10')
        `);

        // Add missing core columns (with existence checks)
        
        // CRITICAL: Add triggerConfig column that's causing the error
        const hasTriggerConfig = await queryRunner.hasColumn("workflows", "triggerConfig");
        if (!hasTriggerConfig) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "triggerConfig" jsonb
            `);
        }

        const hasPriority = await queryRunner.hasColumn("workflows", "priority");
        if (!hasPriority) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "priority" "workflow_priority_enum" DEFAULT '5'
            `);
        }

        const hasWorkflowConfig = await queryRunner.hasColumn("workflows", "workflowConfig");
        if (!hasWorkflowConfig) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "workflowConfig" jsonb
            `);
        }

        const hasNotificationConfig = await queryRunner.hasColumn("workflows", "notificationConfig");
        if (!hasNotificationConfig) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "notificationConfig" jsonb
            `);
        }

        const hasVariables = await queryRunner.hasColumn("workflows", "variables");
        if (!hasVariables) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "variables" jsonb
            `);
        }

        // Add missing tags and metadata columns
        const hasTags = await queryRunner.hasColumn("workflows", "tags");
        if (!hasTags) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "tags" jsonb
            `);
        }

        const hasMetadata = await queryRunner.hasColumn("workflows", "metadata");
        if (!hasMetadata) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "metadata" jsonb
            `);
        }

        // Add missing state columns
        const hasIsActive = await queryRunner.hasColumn("workflows", "isActive");
        if (!hasIsActive) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "isActive" boolean DEFAULT true
            `);
        }

        const hasIsTemplate = await queryRunner.hasColumn("workflows", "isTemplate");
        if (!hasIsTemplate) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "isTemplate" boolean DEFAULT false
            `);
        }

        // Add state management columns (with existence checks)
        const hasIsPaused = await queryRunner.hasColumn("workflows", "isPaused");
        if (!hasIsPaused) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "isPaused" boolean DEFAULT false
            `);
        }

        const hasPausedUntil = await queryRunner.hasColumn("workflows", "pausedUntil");
        if (!hasPausedUntil) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "pausedUntil" timestamp with time zone
            `);
        }

        const hasPauseReason = await queryRunner.hasColumn("workflows", "pauseReason");
        if (!hasPauseReason) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "pauseReason" text
            `);
        }

        // Add versioning columns (check if they don't exist first)
        const hasVersion = await queryRunner.hasColumn("workflows", "version");
        if (!hasVersion) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "version" integer DEFAULT 1
            `);
        }

        const hasPreviousVersionId = await queryRunner.hasColumn("workflows", "previousVersionId");
        if (!hasPreviousVersionId) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "previousVersionId" uuid
            `);
        }

        const hasTemplateId = await queryRunner.hasColumn("workflows", "templateId");
        if (!hasTemplateId) {
            await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "templateId" uuid
            `);
        }

        // Add ownership columns
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "ownerId" uuid
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "permissions" jsonb
        `);

        // Add execution statistics columns
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "totalExecutions" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "successfulExecutions" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "failedExecutions" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "timeoutExecutions" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "cancelledExecutions" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "averageExecutionTime" decimal(8,2)
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "successRate" decimal(5,3)
        `);

        // Add scheduling columns
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "nextExecutionAt" timestamp with time zone
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "lastExecutionDuration" integer
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "lastErrorMessage" text
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "lastErrorAt" timestamp with time zone
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "consecutiveFailures" integer DEFAULT 0
        `);

        // Add performance metrics columns
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "totalProcessingTime" decimal(10,2) DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "totalStepsExecuted" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "totalDataProcessed" integer DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "estimatedCostPerExecution" decimal(12,2) DEFAULT 0
        `);

        // =============================================
        // UPDATE NOT NULL CONSTRAINTS AND DEFAULTS
        // =============================================
        
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "priority" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "isPaused" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "version" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "totalExecutions" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "successfulExecutions" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "failedExecutions" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "timeoutExecutions" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "cancelledExecutions" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "consecutiveFailures" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "totalProcessingTime" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "totalStepsExecuted" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "totalDataProcessed" SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "estimatedCostPerExecution" SET NOT NULL
        `);

        // =============================================
        // CREATE INDEXES FOR NEW COLUMNS (with existence checks)
        // =============================================

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_priority" ON "workflows" ("tenant_id", "priority")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_owner" ON "workflows" ("ownerId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_template" ON "workflows" ("templateId")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_version" ON "workflows" ("version")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_paused" ON "workflows" ("isPaused")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_next_execution" ON "workflows" ("nextExecutionAt")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_success_rate" ON "workflows" ("successRate")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_workflows_consecutive_failures" ON "workflows" ("consecutiveFailures")
        `);

        // =============================================
        // ADD FOREIGN KEY CONSTRAINTS
        // =============================================

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD CONSTRAINT "FK_workflows_previousVersionId" 
            FOREIGN KEY ("previousVersionId") REFERENCES "workflows"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD CONSTRAINT "FK_workflows_templateId" 
            FOREIGN KEY ("templateId") REFERENCES "workflows"("id") ON DELETE SET NULL
        `);

        // Foreign key for ownerId will be added when users table relationship is established
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // =============================================
        // ROLLBACK: DROP FOREIGN KEYS, INDEXES, AND COLUMNS
        // =============================================

        // Drop foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "FK_workflows_templateId"
        `);
        await queryRunner.query(`
            ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "FK_workflows_previousVersionId"
        `);

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_consecutive_failures"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_success_rate"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_next_execution"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_paused"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_version"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_template"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_owner"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_priority"`);

        // Drop columns
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "estimatedCostPerExecution"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "totalDataProcessed"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "totalStepsExecuted"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "totalProcessingTime"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "consecutiveFailures"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "lastErrorAt"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "lastErrorMessage"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "lastExecutionDuration"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "nextExecutionAt"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "successRate"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "averageExecutionTime"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "cancelledExecutions"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "timeoutExecutions"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "failedExecutions"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "successfulExecutions"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "totalExecutions"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "permissions"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "ownerId"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "templateId"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "previousVersionId"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "version"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "pauseReason"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "pausedUntil"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "isPaused"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "isTemplate"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "isActive"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "metadata"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "tags"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "variables"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "notificationConfig"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "workflowConfig"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "triggerConfig"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN IF EXISTS "priority"`);

        // Drop enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "workflow_priority_enum"`);
    }
}
