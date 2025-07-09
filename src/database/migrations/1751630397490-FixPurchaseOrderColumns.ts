import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPurchaseOrderColumns1751630397490
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add camelCase columns that match entity property names for purchase_orders
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add supplierId column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierId') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "supplierId" uuid;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_id') THEN
                        UPDATE "purchase_orders" SET "supplierId" = supplier_id;
                        -- Make it NOT NULL if original column is NOT NULL
                        ALTER TABLE "purchase_orders" ALTER COLUMN "supplierId" SET NOT NULL;
                    END IF;
                END IF;

                -- Add poNumber column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'poNumber') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "poNumber" varchar(50);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'po_number') THEN
                        UPDATE "purchase_orders" SET "poNumber" = po_number;
                        -- Make it NOT NULL if original column is NOT NULL
                        ALTER TABLE "purchase_orders" ALTER COLUMN "poNumber" SET NOT NULL;
                    END IF;
                END IF;

                -- Add supplierReference column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierReference') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "supplierReference" varchar(100);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_reference') THEN
                        UPDATE "purchase_orders" SET "supplierReference" = supplier_reference;
                    END IF;
                END IF;

                -- Add orderDate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'orderDate') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "orderDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'order_date') THEN
                        UPDATE "purchase_orders" SET "orderDate" = order_date;
                        -- Make it NOT NULL if original column is NOT NULL
                        ALTER TABLE "purchase_orders" ALTER COLUMN "orderDate" SET NOT NULL;
                    END IF;
                END IF;

                -- Add expectedDeliveryDate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'expectedDeliveryDate') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "expectedDeliveryDate" timestamp with time zone;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'expected_delivery_date') THEN
                        UPDATE "purchase_orders" SET "expectedDeliveryDate" = expected_delivery_date;
                    END IF;
                END IF;

                -- Add requestedDeliveryDate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'requestedDeliveryDate') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "requestedDeliveryDate" timestamp with time zone;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'requested_delivery_date') THEN
                        UPDATE "purchase_orders" SET "requestedDeliveryDate" = requested_delivery_date;
                    END IF;
                END IF;

                -- Add sentToSupplierAt column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'sentToSupplierAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "sentToSupplierAt" timestamp with time zone;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'sent_to_supplier_at') THEN
                        UPDATE "purchase_orders" SET "sentToSupplierAt" = sent_to_supplier_at;
                    END IF;
                END IF;

                -- Add acknowledgedAt column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'acknowledgedAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "acknowledgedAt" timestamp with time zone;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'acknowledged_at') THEN
                        UPDATE "purchase_orders" SET "acknowledgedAt" = acknowledged_at;
                    END IF;
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove camelCase columns that were added
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Remove camelCase columns from purchase_orders table
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierId') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "supplierId";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'poNumber') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "poNumber";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierReference') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "supplierReference";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'orderDate') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "orderDate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'expectedDeliveryDate') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "expectedDeliveryDate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'requestedDeliveryDate') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "requestedDeliveryDate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'sentToSupplierAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "sentToSupplierAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'acknowledgedAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "acknowledgedAt";
                END IF;
            END $$;
        `);
  }
}
