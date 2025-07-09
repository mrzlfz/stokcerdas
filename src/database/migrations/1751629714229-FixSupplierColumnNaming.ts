import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSupplierColumnNaming1751629714229
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add camelCase columns that match entity property names
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add legalName column (camelCase) if suppliers table exists and column missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'legalName') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "legalName" varchar(255);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'legal_name') THEN
                        UPDATE "suppliers" SET "legalName" = legal_name;
                    END IF;
                END IF;

                -- Add postalCode column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'postalCode') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "postalCode" varchar(10);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'postal_code') THEN
                        UPDATE "suppliers" SET "postalCode" = postal_code;
                    END IF;
                END IF;

                -- Add taxId column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'taxId') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "taxId" varchar(50);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'tax_id') THEN
                        UPDATE "suppliers" SET "taxId" = tax_id;
                    END IF;
                END IF;

                -- Add businessLicense column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'businessLicense') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "businessLicense" varchar(50);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'business_license') THEN
                        UPDATE "suppliers" SET "businessLicense" = business_license;
                    END IF;
                END IF;

                -- Add bankName column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bankName') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "bankName" varchar(100);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bank_name') THEN
                        UPDATE "suppliers" SET "bankName" = bank_name;
                    END IF;
                END IF;

                -- Add bankAccountNumber column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bankAccountNumber') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "bankAccountNumber" varchar(50);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bank_account_number') THEN
                        UPDATE "suppliers" SET "bankAccountNumber" = bank_account_number;
                    END IF;
                END IF;

                -- Add bankAccountName column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bankAccountName') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "bankAccountName" varchar(255);
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bank_account_name') THEN
                        UPDATE "suppliers" SET "bankAccountName" = bank_account_name;
                    END IF;
                END IF;

                -- Add paymentTerms column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'paymentTerms') THEN
                    -- First create enum type if it doesn't exist
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_payment_terms_enum') THEN
                        CREATE TYPE supplier_payment_terms_enum AS ENUM ('cod', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'prepaid', 'custom');
                    END IF;
                    ALTER TABLE "suppliers" ADD COLUMN "paymentTerms" supplier_payment_terms_enum DEFAULT 'net_30';
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'payment_terms') THEN
                        UPDATE "suppliers" SET "paymentTerms" = payment_terms::text::supplier_payment_terms_enum;
                    END IF;
                END IF;

                -- Add customPaymentDays column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'customPaymentDays') THEN
                    ALTER TABLE "suppliers" ADD COLUMN "customPaymentDays" integer;
                    -- Copy data from snake_case column if it exists
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'custom_payment_days') THEN
                        UPDATE "suppliers" SET "customPaymentDays" = custom_payment_days;
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
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'legalName') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "legalName";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'postalCode') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "postalCode";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'taxId') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "taxId";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'businessLicense') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "businessLicense";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bankName') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "bankName";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bankAccountNumber') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "bankAccountNumber";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'bankAccountName') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "bankAccountName";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'paymentTerms') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "paymentTerms";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'customPaymentDays') THEN
                    ALTER TABLE "suppliers" DROP COLUMN "customPaymentDays";
                END IF;

                -- Remove enum type if it exists
                DROP TYPE IF EXISTS supplier_payment_terms_enum;
            END $$;
        `);
  }
}
