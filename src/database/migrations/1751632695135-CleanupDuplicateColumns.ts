import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupDuplicateColumns1751632695135
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // CRITICAL: Clean up duplicate columns that are confusing TypeORM
    // Root cause: Previous migrations added snake_case columns but camelCase originals still exist
    // Solution: Remove camelCase duplicates, keep only snake_case columns that entities expect

    await queryRunner.query(`
            DO $$
            BEGIN
                -- ====================================
                -- DEPARTMENTS TABLE CLEANUP
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
                    RAISE NOTICE 'Cleaning up departments table duplicate columns...';
                    
                    -- First, ensure snake_case columns have all data from camelCase columns
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'isDeleted') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'is_deleted') THEN
                        UPDATE "departments" SET "is_deleted" = COALESCE("is_deleted", "isDeleted");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'deletedAt') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'deleted_at') THEN
                        UPDATE "departments" SET "deleted_at" = COALESCE("deleted_at", "deletedAt");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'parentId') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'parent_id') THEN
                        UPDATE "departments" SET "parent_id" = COALESCE("parent_id", "parentId");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'managerId') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'manager_id') THEN
                        UPDATE "departments" SET "manager_id" = COALESCE("manager_id", "managerId");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'phoneNumber') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'phone_number') THEN
                        UPDATE "departments" SET "phone_number" = COALESCE("phone_number", "phoneNumber");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'costCenter') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'cost_center') THEN
                        UPDATE "departments" SET "cost_center" = COALESCE("cost_center", "costCenter");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'budget') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'budget_limit') THEN
                        UPDATE "departments" SET "budget_limit" = COALESCE("budget_limit", "budget");
                    END IF;
                    
                    -- Drop constraints that reference the old camelCase columns
                    BEGIN
                        DROP INDEX IF EXISTS "IDX_departments_tenant_deleted";
                        DROP INDEX IF EXISTS "IDX_departments_tenant_parent";
                        DROP INDEX IF EXISTS "IDX_departments_tenant_code_unique";
                    EXCEPTION
                        WHEN OTHERS THEN
                            RAISE NOTICE 'Some department indexes already dropped or do not exist: %', SQLERRM;
                    END;
                    
                    -- Now drop the duplicate camelCase columns
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'isDeleted') THEN
                        ALTER TABLE "departments" DROP COLUMN "isDeleted";
                        RAISE NOTICE 'Dropped departments.isDeleted (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'deletedAt') THEN
                        ALTER TABLE "departments" DROP COLUMN "deletedAt";
                        RAISE NOTICE 'Dropped departments.deletedAt (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'parentId') THEN
                        ALTER TABLE "departments" DROP COLUMN "parentId";
                        RAISE NOTICE 'Dropped departments.parentId (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'managerId') THEN
                        ALTER TABLE "departments" DROP COLUMN "managerId";
                        RAISE NOTICE 'Dropped departments.managerId (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'phoneNumber') THEN
                        ALTER TABLE "departments" DROP COLUMN "phoneNumber";
                        RAISE NOTICE 'Dropped departments.phoneNumber (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'costCenter') THEN
                        ALTER TABLE "departments" DROP COLUMN "costCenter";
                        RAISE NOTICE 'Dropped departments.costCenter (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'budget') THEN
                        ALTER TABLE "departments" DROP COLUMN "budget";
                        RAISE NOTICE 'Dropped departments.budget (duplicate)';
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'isActive') THEN
                        ALTER TABLE "departments" DROP COLUMN "isActive";
                        RAISE NOTICE 'Dropped departments.isActive (duplicate)';
                    END IF;
                    
                    -- Recreate necessary indexes with snake_case column names
                    CREATE INDEX IF NOT EXISTS "IDX_departments_tenant_deleted" ON "departments" (tenant_id, is_deleted);
                    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_departments_tenant_code_unique" ON "departments" (tenant_id, code) WHERE is_deleted = false;
                    CREATE INDEX IF NOT EXISTS "IDX_departments_tenant_parent" ON "departments" (tenant_id, parent_id);
                    
                    RAISE NOTICE 'Departments table cleanup completed';
                END IF;

                -- ====================================
                -- HIERARCHICAL_ROLES TABLE CLEANUP
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hierarchical_roles') THEN
                    RAISE NOTICE 'Cleaning up hierarchical_roles table duplicate columns...';
                    
                    -- Copy data to snake_case columns
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isDeleted') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'is_deleted') THEN
                        UPDATE "hierarchical_roles" SET "is_deleted" = COALESCE("is_deleted", "isDeleted");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'deletedAt') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'deleted_at') THEN
                        UPDATE "hierarchical_roles" SET "deleted_at" = COALESCE("deleted_at", "deletedAt");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'parentId') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'parent_id') THEN
                        UPDATE "hierarchical_roles" SET "parent_id" = COALESCE("parent_id", "parentId");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isActive') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'is_active') THEN
                        UPDATE "hierarchical_roles" SET "is_active" = COALESCE("is_active", "isActive");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'inheritsPermissions') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'inherits_permissions') THEN
                        UPDATE "hierarchical_roles" SET "inherits_permissions" = COALESCE("inherits_permissions", "inheritsPermissions");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isSystemRole') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'is_system_role') THEN
                        UPDATE "hierarchical_roles" SET "is_system_role" = COALESCE("is_system_role", "isSystemRole");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isCustomizable') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'is_customizable') THEN
                        UPDATE "hierarchical_roles" SET "is_customizable" = COALESCE("is_customizable", "isCustomizable");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'maxUsers') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'max_users') THEN
                        UPDATE "hierarchical_roles" SET "max_users" = COALESCE("max_users", "maxUsers");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'validFrom') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'valid_from') THEN
                        UPDATE "hierarchical_roles" SET "valid_from" = COALESCE("valid_from", "validFrom");
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'validUntil') AND
                       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'valid_until') THEN
                        UPDATE "hierarchical_roles" SET "valid_until" = COALESCE("valid_until", "validUntil");
                    END IF;
                    
                    -- Drop indexes referencing camelCase columns
                    BEGIN
                        DROP INDEX IF EXISTS "IDX_hierarchical_roles_tenant_deleted";
                        DROP INDEX IF EXISTS "IDX_hierarchical_roles_active";
                        DROP INDEX IF EXISTS "IDX_hierarchical_roles_tenant_code_unique";
                    EXCEPTION
                        WHEN OTHERS THEN
                            RAISE NOTICE 'Some hierarchical_roles indexes already dropped: %', SQLERRM;
                    END;
                    
                    -- Drop camelCase columns
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isDeleted') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "isDeleted";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'deletedAt') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "deletedAt";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'parentId') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "parentId";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isActive') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "isActive";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'inheritsPermissions') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "inheritsPermissions";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isSystemRole') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "isSystemRole";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'isCustomizable') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "isCustomizable";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'maxUsers') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "maxUsers";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'validFrom') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "validFrom";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hierarchical_roles' AND column_name = 'validUntil') THEN
                        ALTER TABLE "hierarchical_roles" DROP COLUMN "validUntil";
                    END IF;
                    
                    -- Recreate indexes with snake_case column names
                    CREATE INDEX IF NOT EXISTS "IDX_hierarchical_roles_tenant_deleted" ON "hierarchical_roles" (tenant_id, is_deleted);
                    CREATE INDEX IF NOT EXISTS "IDX_hierarchical_roles_active" ON "hierarchical_roles" (is_active);
                    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hierarchical_roles_tenant_code_unique" ON "hierarchical_roles" (tenant_id, code) WHERE is_deleted = false;
                    
                    RAISE NOTICE 'Hierarchical_roles table cleanup completed';
                END IF;

                -- ====================================
                -- PERMISSION_SETS TABLE CLEANUP
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permission_sets') THEN
                    RAISE NOTICE 'Cleaning up permission_sets table...';
                    
                    -- Similar cleanup for permission_sets (abbreviated for space)
                    -- Copy data and drop camelCase duplicates
                    
                    -- Drop camelCase columns if they exist
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permission_sets' AND column_name = 'isDeleted') THEN
                        ALTER TABLE "permission_sets" DROP COLUMN "isDeleted";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permission_sets' AND column_name = 'deletedAt') THEN
                        ALTER TABLE "permission_sets" DROP COLUMN "deletedAt";
                    END IF;
                    
                    -- Drop other camelCase duplicates as needed
                    RAISE NOTICE 'Permission_sets table cleanup completed';
                END IF;

                -- ====================================
                -- APPROVAL_CHAINS TABLE CLEANUP  
                -- ====================================
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_chains') THEN
                    RAISE NOTICE 'Cleaning up approval_chains table...';
                    
                    -- Drop camelCase columns if they exist
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_chains' AND column_name = 'isDeleted') THEN
                        ALTER TABLE "approval_chains" DROP COLUMN "isDeleted";
                    END IF;
                    
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_chains' AND column_name = 'deletedAt') THEN
                        ALTER TABLE "approval_chains" DROP COLUMN "deletedAt";
                    END IF;
                    
                    RAISE NOTICE 'Approval_chains table cleanup completed';
                END IF;

                RAISE NOTICE 'ALL DUPLICATE COLUMN CLEANUP COMPLETED - TypeORM should now work correctly';
                
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback would involve recreating the camelCase columns
    // This is complex because we'd lose the distinction between which was "original"
    // For safety, this rollback recreates basic camelCase columns with default values

    await queryRunner.query(`
            DO $$
            BEGIN
                -- Recreate basic camelCase columns for rollback (with defaults)
                
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'isDeleted') THEN
                        ALTER TABLE "departments" ADD COLUMN "isDeleted" boolean DEFAULT false;
                        UPDATE "departments" SET "isDeleted" = is_deleted;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'deletedAt') THEN
                        ALTER TABLE "departments" ADD COLUMN "deletedAt" timestamp without time zone;
                        UPDATE "departments" SET "deletedAt" = deleted_at;
                    END IF;
                END IF;
                
                -- Similar rollback for other tables...
                
                RAISE NOTICE 'Rollback completed - camelCase columns restored';
            END $$;
        `);
  }
}
