import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllRemainingPurchaseOrderColumns1751630888999 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add ALL remaining camelCase columns for purchase_orders to match entity
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Financial Information columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'subtotalAmount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "subtotalAmount" numeric(15,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'subtotal_amount') THEN
                        UPDATE "purchase_orders" SET "subtotalAmount" = subtotal_amount;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'taxAmount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "taxAmount" numeric(15,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'tax_amount') THEN
                        UPDATE "purchase_orders" SET "taxAmount" = tax_amount;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shippingAmount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "shippingAmount" numeric(15,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shipping_amount') THEN
                        UPDATE "purchase_orders" SET "shippingAmount" = shipping_amount;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'discountAmount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "discountAmount" numeric(15,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'discount_amount') THEN
                        UPDATE "purchase_orders" SET "discountAmount" = discount_amount;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'totalAmount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "totalAmount" numeric(15,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'total_amount') THEN
                        UPDATE "purchase_orders" SET "totalAmount" = total_amount;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'taxRate') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "taxRate" numeric(5,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'tax_rate') THEN
                        UPDATE "purchase_orders" SET "taxRate" = tax_rate;
                    END IF;
                END IF;

                -- Payment Information columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'paymentTerms') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "paymentTerms" varchar(20) DEFAULT 'net_30';
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'payment_terms') THEN
                        UPDATE "purchase_orders" SET "paymentTerms" = payment_terms;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customPaymentDays') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "customPaymentDays" integer;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'custom_payment_days') THEN
                        UPDATE "purchase_orders" SET "customPaymentDays" = custom_payment_days;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'paymentDueDate') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "paymentDueDate" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'payment_due_date') THEN
                        UPDATE "purchase_orders" SET "paymentDueDate" = payment_due_date;
                    END IF;
                END IF;

                -- Delivery Information columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'deliveryAddress') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "deliveryAddress" jsonb;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'delivery_address') THEN
                        UPDATE "purchase_orders" SET "deliveryAddress" = delivery_address;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'deliveryLocationId') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "deliveryLocationId" varchar(100);
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'delivery_location_id') THEN
                        UPDATE "purchase_orders" SET "deliveryLocationId" = delivery_location_id;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shippingMethod') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "shippingMethod" varchar(255);
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shipping_method') THEN
                        UPDATE "purchase_orders" SET "shippingMethod" = shipping_method;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'trackingNumber') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "trackingNumber" varchar(100);
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'tracking_number') THEN
                        UPDATE "purchase_orders" SET "trackingNumber" = tracking_number;
                    END IF;
                END IF;

                -- Approval Information columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvalStatus') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "approvalStatus" varchar(20) DEFAULT 'not_required';
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approval_status') THEN
                        UPDATE "purchase_orders" SET "approvalStatus" = approval_status;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvalThreshold') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "approvalThreshold" numeric(15,2);
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approval_threshold') THEN
                        UPDATE "purchase_orders" SET "approvalThreshold" = approval_threshold;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvedBy') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "approvedBy" uuid;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approved_by') THEN
                        UPDATE "purchase_orders" SET "approvedBy" = approved_by;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvedAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "approvedAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approved_at') THEN
                        UPDATE "purchase_orders" SET "approvedAt" = approved_at;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejectedBy') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "rejectedBy" uuid;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejected_by') THEN
                        UPDATE "purchase_orders" SET "rejectedBy" = rejected_by;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejectedAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "rejectedAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejected_at') THEN
                        UPDATE "purchase_orders" SET "rejectedAt" = rejected_at;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejectionReason') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "rejectionReason" text;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejection_reason') THEN
                        UPDATE "purchase_orders" SET "rejectionReason" = rejection_reason;
                    END IF;
                END IF;

                -- Additional Information columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'internalNotes') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "internalNotes" text;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'internal_notes') THEN
                        UPDATE "purchase_orders" SET "internalNotes" = internal_notes;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierInstructions') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "supplierInstructions" text;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplier_instructions') THEN
                        UPDATE "purchase_orders" SET "supplierInstructions" = supplier_instructions;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customFields') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "customFields" jsonb;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'custom_fields') THEN
                        UPDATE "purchase_orders" SET "customFields" = custom_fields;
                    END IF;
                END IF;

                -- Status Tracking columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'isUrgent') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "isUrgent" boolean DEFAULT false;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'is_urgent') THEN
                        UPDATE "purchase_orders" SET "isUrgent" = is_urgent;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'requiresApproval') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "requiresApproval" boolean DEFAULT false;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'requires_approval') THEN
                        UPDATE "purchase_orders" SET "requiresApproval" = requires_approval;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'isActive') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "isActive" boolean DEFAULT true;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'is_active') THEN
                        UPDATE "purchase_orders" SET "isActive" = is_active;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'itemCount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "itemCount" integer DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'item_count') THEN
                        UPDATE "purchase_orders" SET "itemCount" = item_count;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'receivedItemCount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "receivedItemCount" integer DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'received_item_count') THEN
                        UPDATE "purchase_orders" SET "receivedItemCount" = received_item_count;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'completionPercentage') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "completionPercentage" numeric(5,2) DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'completion_percentage') THEN
                        UPDATE "purchase_orders" SET "completionPercentage" = completion_percentage;
                    END IF;
                END IF;

                -- PDF and Email Information columns
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'pdfFilePath') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "pdfFilePath" varchar(255);
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'pdf_file_path') THEN
                        UPDATE "purchase_orders" SET "pdfFilePath" = pdf_file_path;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'lastEmailSentAt') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "lastEmailSentAt" timestamp with time zone;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'last_email_sent_at') THEN
                        UPDATE "purchase_orders" SET "lastEmailSentAt" = last_email_sent_at;
                    END IF;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') 
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'emailSentCount') THEN
                    ALTER TABLE "purchase_orders" ADD COLUMN "emailSentCount" integer DEFAULT 0;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'email_sent_count') THEN
                        UPDATE "purchase_orders" SET "emailSentCount" = email_sent_count;
                    END IF;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove all camelCase columns that were added
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Financial Information columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'subtotalAmount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "subtotalAmount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'taxAmount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "taxAmount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shippingAmount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "shippingAmount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'discountAmount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "discountAmount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'totalAmount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "totalAmount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'taxRate') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "taxRate";
                END IF;

                -- Payment Information columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'paymentTerms') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "paymentTerms";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customPaymentDays') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "customPaymentDays";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'paymentDueDate') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "paymentDueDate";
                END IF;

                -- Delivery Information columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'deliveryAddress') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "deliveryAddress";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'deliveryLocationId') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "deliveryLocationId";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shippingMethod') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "shippingMethod";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'trackingNumber') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "trackingNumber";
                END IF;

                -- Approval Information columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvalStatus') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "approvalStatus";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvalThreshold') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "approvalThreshold";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvedBy') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "approvedBy";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'approvedAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "approvedAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejectedBy') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "rejectedBy";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejectedAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "rejectedAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejectionReason') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "rejectionReason";
                END IF;

                -- Additional Information columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'internalNotes') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "internalNotes";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'supplierInstructions') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "supplierInstructions";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'customFields') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "customFields";
                END IF;

                -- Status Tracking columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'isUrgent') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "isUrgent";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'requiresApproval') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "requiresApproval";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'isActive') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "isActive";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'itemCount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "itemCount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'receivedItemCount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "receivedItemCount";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'completionPercentage') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "completionPercentage";
                END IF;

                -- PDF and Email Information columns
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'pdfFilePath') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "pdfFilePath";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'lastEmailSentAt') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "lastEmailSentAt";
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'emailSentCount') THEN
                    ALTER TABLE "purchase_orders" DROP COLUMN "emailSentCount";
                END IF;
            END $$;
        `);
    }

}