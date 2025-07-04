import { MigrationInterface, QueryRunner } from "typeorm";

export class FixWorkflowTriggerType1751637187092 implements MigrationInterface {
    name = 'FixWorkflowTriggerType1751637187092';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // =============================================
        // FIX WORKFLOW TRIGGER TYPE SCHEMA MISMATCH
        // =============================================
        
        // Step 1: Create new enum type with correct values matching entity
        await queryRunner.query(`
            CREATE TYPE "workflow_trigger_type_enum_new" AS ENUM(
                'manual', 
                'scheduled', 
                'event_based', 
                'webhook', 
                'api_trigger', 
                'condition_based'
            )
        `);

        // Step 2: Add temporary column with new enum type
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "triggerType" "workflow_trigger_type_enum_new" DEFAULT 'manual'
        `);

        // Step 3: Migrate existing data from old column to new column (handle case conversion)
        await queryRunner.query(`
            UPDATE "workflows" SET "triggerType" = 
            CASE 
                WHEN "trigger_type" = 'MANUAL' THEN 'manual'::workflow_trigger_type_enum_new
                WHEN "trigger_type" = 'SCHEDULED' THEN 'scheduled'::workflow_trigger_type_enum_new  
                WHEN "trigger_type" = 'EVENT_BASED' THEN 'event_based'::workflow_trigger_type_enum_new
                WHEN "trigger_type" = 'WEBHOOK' THEN 'webhook'::workflow_trigger_type_enum_new
                WHEN "trigger_type" = 'API' THEN 'api_trigger'::workflow_trigger_type_enum_new
                ELSE 'manual'::workflow_trigger_type_enum_new
            END
        `);

        // Step 4: Drop the old trigger_type column
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN "trigger_type"`);

        // Step 5: Drop the old enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "workflows_trigger_type_enum"`);

        // Step 6: Rename the new enum type to match what the entity expects
        await queryRunner.query(`ALTER TYPE "workflow_trigger_type_enum_new" RENAME TO "workflow_trigger_type_enum"`);

        // Step 7: Update column to be NOT NULL since entity expects it
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "triggerType" SET NOT NULL
        `);

        // Step 8: Recreate the index with correct column name
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_trigger_type"`);
        await queryRunner.query(`
            CREATE INDEX "IDX_workflows_triggerType" ON "workflows" ("tenant_id", "triggerType")
        `);

        // =============================================
        // FIX OTHER POTENTIAL ENTITY MISMATCHES
        // =============================================

        // Check if we need to fix other enum values and column names
        // Fix category enum to match entity (add missing values)
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'inventory_management'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'purchase_order'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'supplier_management'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'alert_notification'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'reporting'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'data_sync'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'maintenance'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_category_enum" ADD VALUE IF NOT EXISTS 'custom'
        `);

        // Fix status enum to match entity
        await queryRunner.query(`
            ALTER TYPE "workflows_status_enum" ADD VALUE IF NOT EXISTS 'draft'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_status_enum" ADD VALUE IF NOT EXISTS 'active'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_status_enum" ADD VALUE IF NOT EXISTS 'inactive'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_status_enum" ADD VALUE IF NOT EXISTS 'archived'
        `);
        await queryRunner.query(`
            ALTER TYPE "workflows_status_enum" ADD VALUE IF NOT EXISTS 'error'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // =============================================
        // ROLLBACK WORKFLOW TRIGGER TYPE CHANGES
        // =============================================

        // Step 1: Drop the new index
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflows_triggerType"`);

        // Step 2: Create old enum type
        await queryRunner.query(`
            CREATE TYPE "workflows_trigger_type_enum_old" AS ENUM(
                'MANUAL', 
                'SCHEDULED', 
                'EVENT_BASED', 
                'WEBHOOK', 
                'API'
            )
        `);

        // Step 3: Add old column back
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ADD COLUMN "trigger_type" "workflows_trigger_type_enum_old" DEFAULT 'MANUAL'
        `);

        // Step 4: Migrate data back (reverse conversion)
        await queryRunner.query(`
            UPDATE "workflows" SET "trigger_type" = 
            CASE 
                WHEN "triggerType" = 'manual' THEN 'MANUAL'::workflows_trigger_type_enum_old
                WHEN "triggerType" = 'scheduled' THEN 'SCHEDULED'::workflows_trigger_type_enum_old
                WHEN "triggerType" = 'event_based' THEN 'EVENT_BASED'::workflows_trigger_type_enum_old
                WHEN "triggerType" = 'webhook' THEN 'WEBHOOK'::workflows_trigger_type_enum_old
                WHEN "triggerType" = 'api_trigger' THEN 'API'::workflows_trigger_type_enum_old
                WHEN "triggerType" = 'condition_based' THEN 'MANUAL'::workflows_trigger_type_enum_old
                ELSE 'MANUAL'::workflows_trigger_type_enum_old
            END
        `);

        // Step 5: Drop the new column
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN "triggerType"`);

        // Step 6: Drop new enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "workflow_trigger_type_enum"`);

        // Step 7: Rename old enum type back
        await queryRunner.query(`ALTER TYPE "workflows_trigger_type_enum_old" RENAME TO "workflows_trigger_type_enum"`);

        // Step 8: Make trigger_type NOT NULL
        await queryRunner.query(`
            ALTER TABLE "workflows" 
            ALTER COLUMN "trigger_type" SET NOT NULL
        `);

        // Step 9: Recreate old index
        await queryRunner.query(`
            CREATE INDEX "IDX_workflows_trigger_type" ON "workflows" ("trigger_type")
        `);
    }
}
