import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRemainingSupplierColumns1751629807071 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add remaining camelCase columns that match entity property names
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Add creditLimit column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'creditLimit') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "creditLimit" numeric(15,2) DEFAULT 0;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'credit_limit') THEN
                        UPDATE "suppliers" SET "creditLimit" = credit_limit;
                    END IF;
                END IF;

                -- Add totalOrders column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'totalOrders') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "totalOrders" integer DEFAULT 0;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'total_orders') THEN
                        UPDATE "suppliers" SET "totalOrders" = total_orders;
                    END IF;
                END IF;

                -- Add totalPurchaseAmount column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'totalPurchaseAmount') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "totalPurchaseAmount" numeric(15,2) DEFAULT 0;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'total_purchase_amount') THEN
                        UPDATE "suppliers" SET "totalPurchaseAmount" = total_purchase_amount;
                    END IF;
                END IF;

                -- Add onTimeDeliveryRate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'onTimeDeliveryRate') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "onTimeDeliveryRate" numeric(5,2) DEFAULT 0;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'on_time_delivery_rate') THEN
                        UPDATE "suppliers" SET "onTimeDeliveryRate" = on_time_delivery_rate;
                    END IF;
                END IF;

                -- Add qualityScore column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'qualityScore') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "qualityScore" numeric(5,2) DEFAULT 0;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'quality_score') THEN
                        UPDATE "suppliers" SET "qualityScore" = quality_score;
                    END IF;
                END IF;

                -- Add leadTimeDays column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'leadTimeDays') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "leadTimeDays" integer DEFAULT 0;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'lead_time_days') THEN
                        UPDATE "suppliers" SET "leadTimeDays" = lead_time_days;
                    END IF;
                END IF;

                -- Add contractStartDate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contractStartDate') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "contractStartDate" date;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contract_start_date') THEN
                        UPDATE "suppliers" SET "contractStartDate" = contract_start_date;
                    END IF;
                END IF;

                -- Add contractEndDate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contractEndDate') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "contractEndDate" date;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contract_end_date') THEN
                        UPDATE "suppliers" SET "contractEndDate" = contract_end_date;
                    END IF;
                END IF;

                -- Add lastOrderDate column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'lastOrderDate') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "lastOrderDate" timestamp with time zone;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'last_order_date') THEN
                        UPDATE "suppliers" SET "lastOrderDate" = last_order_date;
                    END IF;
                END IF;

                -- Add customFields column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'customFields') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "customFields" jsonb;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'custom_fields') THEN
                        UPDATE "suppliers" SET "customFields" = custom_fields;
                    END IF;
                END IF;

                -- Add primaryContactName column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactName') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "primaryContactName" varchar(255);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primary_contact_name') THEN
                        UPDATE "suppliers" SET "primaryContactName" = primary_contact_name;
                    END IF;
                END IF;

                -- Add primaryContactEmail column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactEmail') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "primaryContactEmail" varchar(255);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primary_contact_email') THEN
                        UPDATE "suppliers" SET "primaryContactEmail" = primary_contact_email;
                    END IF;
                END IF;

                -- Add primaryContactPhone column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactPhone') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "primaryContactPhone" varchar(20);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primary_contact_phone') THEN
                        UPDATE "suppliers" SET "primaryContactPhone" = primary_contact_phone;
                    END IF;
                END IF;

                -- Add primaryContactPosition column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactPosition') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "primaryContactPosition" varchar(100);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primary_contact_position') THEN
                        UPDATE "suppliers" SET "primaryContactPosition" = primary_contact_position;
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
                -- Remove camelCase columns from suppliers table
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'creditLimit') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "creditLimit";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'totalOrders') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "totalOrders";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'totalPurchaseAmount') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "totalPurchaseAmount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'onTimeDeliveryRate') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "onTimeDeliveryRate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'qualityScore') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "qualityScore";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'leadTimeDays') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "leadTimeDays";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contractStartDate') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "contractStartDate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contractEndDate') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "contractEndDate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'lastOrderDate') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "lastOrderDate";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'customFields') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "customFields";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactName') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "primaryContactName";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactEmail') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "primaryContactEmail";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactPhone') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "primaryContactPhone";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'primaryContactPosition') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "primaryContactPosition";
                END IF;
            END $$;
        `);
    }

}
