import { MigrationInterface, QueryRunner } from "typeorm";

export class FixWorkflowTriggerConfig1751641000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                -- ========================================
                -- CRITICAL FIX: Add missing triggerConfig column
                -- ========================================
                RAISE NOTICE 'Starting Workflow triggerConfig fix...';
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
                    -- Check and add triggerConfig column (camelCase as expected by entity)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'triggerConfig') THEN
                        ALTER TABLE "workflows" ADD COLUMN "triggerConfig" jsonb;
                        RAISE NOTICE 'Added triggerConfig column';
                        
                        -- Copy data from snake_case column if it exists
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'trigger_config') THEN
                            UPDATE "workflows" SET "triggerConfig" = "trigger_config";
                            RAISE NOTICE 'Copied data from trigger_config to triggerConfig';
                        END IF;
                    ELSE
                        RAISE NOTICE 'triggerConfig column already exists';
                    END IF;

                    -- Check and add workflowConfig column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'workflowConfig') THEN
                        ALTER TABLE "workflows" ADD COLUMN "workflowConfig" jsonb;
                        RAISE NOTICE 'Added workflowConfig column';
                    ELSE
                        RAISE NOTICE 'workflowConfig column already exists';
                    END IF;

                    -- Check and add notificationConfig column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'notificationConfig') THEN
                        ALTER TABLE "workflows" ADD COLUMN "notificationConfig" jsonb;
                        RAISE NOTICE 'Added notificationConfig column';
                    ELSE
                        RAISE NOTICE 'notificationConfig column already exists';
                    END IF;

                    -- Check and add variables column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'variables') THEN
                        ALTER TABLE "workflows" ADD COLUMN "variables" jsonb;
                        RAISE NOTICE 'Added variables column';
                    ELSE
                        RAISE NOTICE 'variables column already exists';
                    END IF;

                    -- Check and add tags column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'tags') THEN
                        ALTER TABLE "workflows" ADD COLUMN "tags" jsonb;
                        RAISE NOTICE 'Added tags column';
                    ELSE
                        RAISE NOTICE 'tags column already exists';
                    END IF;

                    -- Check and add metadata column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'metadata') THEN
                        ALTER TABLE "workflows" ADD COLUMN "metadata" jsonb;
                        RAISE NOTICE 'Added metadata column';
                    ELSE
                        RAISE NOTICE 'metadata column already exists';
                    END IF;

                    -- Check and add isActive column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'isActive') THEN
                        ALTER TABLE "workflows" ADD COLUMN "isActive" boolean DEFAULT true;
                        RAISE NOTICE 'Added isActive column';
                        
                        -- Copy from snake_case if exists
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'is_active') THEN
                            UPDATE "workflows" SET "isActive" = "is_active";
                            RAISE NOTICE 'Copied data from is_active to isActive';
                        END IF;
                    ELSE
                        RAISE NOTICE 'isActive column already exists';
                    END IF;

                    -- Check and add isPaused column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'isPaused') THEN
                        ALTER TABLE "workflows" ADD COLUMN "isPaused" boolean DEFAULT false;
                        RAISE NOTICE 'Added isPaused column';
                    ELSE
                        RAISE NOTICE 'isPaused column already exists';
                    END IF;

                    -- Check and add isTemplate column
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'isTemplate') THEN
                        ALTER TABLE "workflows" ADD COLUMN "isTemplate" boolean DEFAULT false;
                        RAISE NOTICE 'Added isTemplate column';
                        
                        -- Copy from snake_case if exists
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'is_template') THEN
                            UPDATE "workflows" SET "isTemplate" = "is_template";
                            RAISE NOTICE 'Copied data from is_template to isTemplate';
                        END IF;
                    ELSE
                        RAISE NOTICE 'isTemplate column already exists';
                    END IF;

                    -- Ensure nextExecutionAt column exists (critical for scheduler)
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'nextExecutionAt') THEN
                        ALTER TABLE "workflows" ADD COLUMN "nextExecutionAt" timestamp with time zone;
                        RAISE NOTICE 'Added nextExecutionAt column';
                        
                        -- Copy from snake_case if exists
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'next_execution_at') THEN
                            UPDATE "workflows" SET "nextExecutionAt" = "next_execution_at";
                            RAISE NOTICE 'Copied data from next_execution_at to nextExecutionAt';
                        END IF;
                    ELSE
                        RAISE NOTICE 'nextExecutionAt column already exists';
                    END IF;

                    RAISE NOTICE 'Workflow schema fix completed successfully!';
                ELSE
                    RAISE NOTICE 'Workflows table does not exist';
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Remove the camelCase columns that were added
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows') THEN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'triggerConfig') THEN
                        ALTER TABLE "workflows" DROP COLUMN "triggerConfig";
                        RAISE NOTICE 'Removed triggerConfig column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'workflowConfig') THEN
                        ALTER TABLE "workflows" DROP COLUMN "workflowConfig";
                        RAISE NOTICE 'Removed workflowConfig column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'notificationConfig') THEN
                        ALTER TABLE "workflows" DROP COLUMN "notificationConfig";
                        RAISE NOTICE 'Removed notificationConfig column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'variables') THEN
                        ALTER TABLE "workflows" DROP COLUMN "variables";
                        RAISE NOTICE 'Removed variables column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'tags') THEN
                        ALTER TABLE "workflows" DROP COLUMN "tags";
                        RAISE NOTICE 'Removed tags column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'metadata') THEN
                        ALTER TABLE "workflows" DROP COLUMN "metadata";
                        RAISE NOTICE 'Removed metadata column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'isActive') THEN
                        ALTER TABLE "workflows" DROP COLUMN "isActive";
                        RAISE NOTICE 'Removed isActive column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'isPaused') THEN
                        ALTER TABLE "workflows" DROP COLUMN "isPaused";
                        RAISE NOTICE 'Removed isPaused column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'isTemplate') THEN
                        ALTER TABLE "workflows" DROP COLUMN "isTemplate";
                        RAISE NOTICE 'Removed isTemplate column';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'nextExecutionAt') THEN
                        ALTER TABLE "workflows" DROP COLUMN "nextExecutionAt";
                        RAISE NOTICE 'Removed nextExecutionAt column';
                    END IF;
                    
                    RAISE NOTICE 'Workflow schema rollback completed';
                END IF;
            END $$;
        `);
    }

}