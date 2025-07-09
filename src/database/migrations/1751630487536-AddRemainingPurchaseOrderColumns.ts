import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemainingPurchaseOrderColumns1751630487536
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add remaining camelCase columns for purchase_orders
    await queryRunner.query(`
            DO $$
            BEGIN
                -- Add firstReceivedAt column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'firstReceivedAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "firstReceivedAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'first_received_at') THEN
                        UPDATE "purchase_orders" SET "firstReceivedAt" = first_received_at;
                    END IF;
                END IF;

                -- Add fullyReceivedAt column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'fullyReceivedAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "fullyReceivedAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'fully_received_at') THEN
                        UPDATE "purchase_orders" SET "fullyReceivedAt" = fully_received_at;
                    END IF;
                END IF;

                -- Add closedAt column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'closedAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "closedAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'closed_at') THEN
                        UPDATE "purchase_orders" SET "closedAt" = closed_at;
                    END IF;
                END IF;

                -- Add cancelledAt column (camelCase) if missing
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'cancelledAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "cancelledAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'cancelled_at') THEN
                        UPDATE "purchase_orders" SET "cancelledAt" = cancelled_at;
                    END IF;
                END IF;
            END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'firstReceivedAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "firstReceivedAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'fullyReceivedAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "fullyReceivedAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'closedAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "closedAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'cancelledAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "cancelledAt";
                END IF;
            END $$;
        `);
  }
}
