import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllMissingColumns1751629333467 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix Products table missing columns
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add metadata column if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'metadata') THEN
                    ALTER TABLE "products" ADD COLUMN "metadata" jsonb;
                END IF;

                -- Add isDeleted column if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "products" ADD COLUMN "isDeleted" boolean DEFAULT false;
                END IF;

                -- Add deletedAt column if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "products" ADD COLUMN "deletedAt" timestamp;
                END IF;
            END $$;
        `);

    // Fix other tables' is_deleted columns
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add isDeleted to department table if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "department" ADD COLUMN "isDeleted" boolean DEFAULT false;
                END IF;

                -- Add deletedAt to department table if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "department" ADD COLUMN "deletedAt" timestamp;
                END IF;
            END $$;
        `);

    // Fix automation tables if they exist
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add isDeleted to automation_schedule table if it exists and column missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_schedule') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_schedule' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "automation_schedule" ADD COLUMN "isDeleted" boolean DEFAULT false;
                END IF;

                -- Add deletedAt to automation_schedule table if it exists and column missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_schedule') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_schedule' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "automation_schedule" ADD COLUMN "deletedAt" timestamp;
                END IF;
            END $$;
        `);

    // Fix notification table take parameter issue
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Make sure notification table has proper structure if it exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification') THEN
                    -- Add any missing columns for notifications
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'isDeleted') THEN
                        ALTER TABLE "notification" ADD COLUMN "isDeleted" boolean DEFAULT false;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'deletedAt') THEN
                        ALTER TABLE "notification" ADD COLUMN "deletedAt" timestamp;
                    END IF;
                END IF;
            END $$;
        `);

    // Add indexes for better performance
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add index on products.isDeleted if table exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
                   AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'products' AND indexname = 'IDX_products_isDeleted') THEN
                    CREATE INDEX "IDX_products_isDeleted" ON "products" ("isDeleted");
                END IF;

                -- Add index on products.metadata if table exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
                   AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'products' AND indexname = 'IDX_products_metadata') THEN
                    CREATE INDEX "IDX_products_metadata" ON "products" USING gin ("metadata");
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove added columns in reverse order
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Remove indexes
                DROP INDEX IF EXISTS "IDX_products_isDeleted";
                DROP INDEX IF EXISTS "IDX_products_metadata";

                -- Remove columns from products table
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'metadata') THEN
                    ALTER TABLE "products" DROP COLUMN "metadata";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "products" DROP COLUMN "isDeleted";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "products" DROP COLUMN "deletedAt";
                END IF;

                -- Remove columns from other tables
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "department" DROP COLUMN "isDeleted";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "department" DROP COLUMN "deletedAt";
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_schedule' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "automation_schedule" DROP COLUMN "isDeleted";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'automation_schedule' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "automation_schedule" DROP COLUMN "deletedAt";
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'isDeleted') THEN
                    ALTER TABLE "notification" DROP COLUMN "isDeleted";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification' AND column_name = 'deletedAt') THEN
                    ALTER TABLE "notification" DROP COLUMN "deletedAt";
                END IF;
            END $$;
        `);
  }
}
