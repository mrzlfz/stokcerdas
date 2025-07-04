import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumns1751628867303 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add supplierId column to products table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
                    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplierId" uuid;
                END IF;
            END $$;
        `);

        // Add is_deleted column to automation_schedule table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_schedule') THEN
                    ALTER TABLE "automation_schedule" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;
                END IF;
            END $$;
        `);

        // Add is_deleted column to department table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department') THEN
                    ALTER TABLE "department" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;
                END IF;
            END $$;
        `);

        // Add foreign key constraint for supplierId if suppliers table exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')
                   AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_products_supplier') THEN
                    ALTER TABLE "products" ADD CONSTRAINT "FK_products_supplier" 
                    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id");
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key constraint if products table exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
                    ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_supplier";
                END IF;
            END $$;
        `);

        // Remove supplierId column from products table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
                    ALTER TABLE "products" DROP COLUMN IF EXISTS "supplierId";
                END IF;
            END $$;
        `);

        // Remove is_deleted column from automation_schedule table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_schedule') THEN
                    ALTER TABLE "automation_schedule" DROP COLUMN IF EXISTS "is_deleted";
                END IF;
            END $$;
        `);

        // Remove is_deleted column from department table if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department') THEN
                    ALTER TABLE "department" DROP COLUMN IF EXISTS "is_deleted";
                END IF;
            END $$;
        `);
    }

}
