import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSupplierIdColumn1751629080975 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add correct supplierId column if it doesn't exist
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'supplierId') THEN
                    ALTER TABLE "products" ADD COLUMN "supplierId" uuid;
                END IF;
            END $$;
        `);

    // Remove incorrect supplier_id column if it exists
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'supplier_id') THEN
                    ALTER TABLE "products" DROP COLUMN "supplier_id";
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'supplierId') THEN
                    ALTER TABLE "products" DROP COLUMN "supplierId";
                END IF;
            END $$;
        `);
  }
}
