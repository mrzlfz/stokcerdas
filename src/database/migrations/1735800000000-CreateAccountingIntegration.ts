import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountingIntegration1735800000000 implements MigrationInterface {
  name = 'CreateAccountingIntegration1735800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for accounting integration
    await queryRunner.query(`
      CREATE TYPE "accounting_platform_enum" AS ENUM(
        'quickbooks', 'accurate', 'xero', 'jurnal', 'kledo'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "accounting_connection_status_enum" AS ENUM(
        'disconnected', 'connecting', 'connected', 'error', 'expired', 'suspended'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "accounting_data_type_enum" AS ENUM(
        'item', 'customer', 'vendor', 'invoice', 'bill', 'payment', 
        'journal_entry', 'account', 'tax_code', 'purchase_order'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "sync_frequency_enum" AS ENUM(
        'real_time', 'every_15_minutes', 'hourly', 'daily', 'weekly', 'manual'
      )
    `);

    // Create accounting_accounts table
    await queryRunner.query(`
      CREATE TABLE "accounting_accounts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" varchar NOT NULL,
        "channel_id" varchar NULL,
        "platform" accounting_platform_enum NOT NULL,
        "status" accounting_connection_status_enum NOT NULL DEFAULT 'disconnected',
        
        -- Company Information
        "company_id" varchar NULL,
        "company_name" varchar(200) NULL,
        "company_legal_name" varchar(200) NULL,
        "company_country" varchar(3) NULL,
        "company_currency" varchar(3) NULL,
        "fiscal_year_start_month" integer NULL CHECK ("fiscal_year_start_month" >= 1 AND "fiscal_year_start_month" <= 12),
        
        -- Authentication credentials (encrypted in production)
        "access_token" text NULL,
        "refresh_token" text NULL,
        "token_expires_at" timestamp NULL,
        "client_id" varchar(255) NULL,
        "client_secret" text NULL,
        "api_base_url" text NULL,
        "webhook_url" text NULL,
        "webhook_secret" text NULL,
        
        -- Platform-specific configuration
        "platform_config" jsonb NULL,
        
        -- Sync configuration
        "auto_sync_enabled" boolean NOT NULL DEFAULT true,
        "default_sync_frequency" sync_frequency_enum NOT NULL DEFAULT 'hourly',
        "last_sync_at" timestamp NULL,
        "next_sync_at" timestamp NULL,
        "sync_error_count" integer NOT NULL DEFAULT 0,
        "last_sync_error" text NULL,
        
        -- Account mapping configuration
        "account_mappings" jsonb NULL,
        
        -- Indonesian tax and compliance settings
        "indonesian_settings" jsonb NULL,
        
        -- Feature capabilities
        "capabilities" jsonb NULL,
        
        -- Statistics and monitoring
        "sync_statistics" jsonb NULL,
        "connection_health_score" decimal(3,2) NOT NULL DEFAULT 100.00 CHECK ("connection_health_score" >= 0 AND "connection_health_score" <= 100),
        
        -- Audit fields
        "created_by" varchar NOT NULL,
        "updated_by" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create indexes for accounting_accounts
    await queryRunner.query(`CREATE INDEX "IDX_accounting_accounts_tenant_platform" ON "accounting_accounts" ("tenant_id", "platform")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_accounts_tenant_status" ON "accounting_accounts" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_accounts_company_id" ON "accounting_accounts" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_accounts_sync_schedule" ON "accounting_accounts" ("next_sync_at") WHERE "auto_sync_enabled" = true`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_accounts_health_score" ON "accounting_accounts" ("connection_health_score")`);

    // Add foreign key constraint to channels table if it exists
    await queryRunner.query(`
      ALTER TABLE "accounting_accounts" 
      ADD CONSTRAINT "FK_accounting_accounts_channel" 
      FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL
    `);

    // Update existing integration tables to support accounting integration
    
    // Add accounting-specific fields to sync_status table
    await queryRunner.query(`
      ALTER TABLE "sync_status" 
      ADD COLUMN "accounting_account_id" varchar NULL,
      ADD COLUMN "external_reference_id" varchar NULL,
      ADD COLUMN "sync_direction" varchar NULL DEFAULT 'bidirectional',
      ADD COLUMN "data_transformation" jsonb NULL,
      ADD COLUMN "conflict_resolution" varchar NULL DEFAULT 'latest_wins'
    `);

    await queryRunner.query(`CREATE INDEX "IDX_sync_status_accounting_account" ON "sync_status" ("accounting_account_id")`);

    // Add accounting-specific fields to integration_logs table
    await queryRunner.query(`
      ALTER TABLE "integration_logs" 
      ADD COLUMN "accounting_account_id" varchar NULL,
      ADD COLUMN "operation_type" varchar NULL,
      ADD COLUMN "entity_type" varchar NULL,
      ADD COLUMN "entity_id" varchar NULL,
      ADD COLUMN "external_entity_id" varchar NULL,
      ADD COLUMN "transformation_details" jsonb NULL
    `);

    await queryRunner.query(`CREATE INDEX "IDX_integration_logs_accounting_account" ON "integration_logs" ("accounting_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_integration_logs_operation_entity" ON "integration_logs" ("operation_type", "entity_type")`);

    // Create table for storing accounting entity mappings
    await queryRunner.query(`
      CREATE TABLE "accounting_entity_mappings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" varchar NOT NULL,
        "accounting_account_id" varchar NOT NULL,
        "internal_entity_type" varchar NOT NULL,
        "internal_entity_id" varchar NOT NULL,
        "external_entity_type" varchar NOT NULL,
        "external_entity_id" varchar NOT NULL,
        "mapping_data" jsonb NULL,
        "sync_direction" varchar NOT NULL DEFAULT 'bidirectional',
        "last_synced_at" timestamp NULL,
        "sync_version" integer NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_accounting_entity_mappings_tenant" ON "accounting_entity_mappings" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_entity_mappings_account" ON "accounting_entity_mappings" ("accounting_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_entity_mappings_internal" ON "accounting_entity_mappings" ("internal_entity_type", "internal_entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_entity_mappings_external" ON "accounting_entity_mappings" ("external_entity_type", "external_entity_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_accounting_entity_mappings_unique" ON "accounting_entity_mappings" ("tenant_id", "accounting_account_id", "internal_entity_type", "internal_entity_id", "external_entity_type")`);

    // Create table for storing accounting sync jobs
    await queryRunner.query(`
      CREATE TABLE "accounting_sync_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" varchar NOT NULL,
        "accounting_account_id" varchar NOT NULL,
        "job_type" varchar NOT NULL,
        "job_name" varchar NOT NULL,
        "job_parameters" jsonb NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "priority" integer NOT NULL DEFAULT 5,
        "scheduled_at" timestamp NULL,
        "started_at" timestamp NULL,
        "completed_at" timestamp NULL,
        "failed_at" timestamp NULL,
        "retry_count" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 3,
        "error_message" text NULL,
        "error_details" jsonb NULL,
        "result_data" jsonb NULL,
        "processing_node" varchar NULL,
        "parent_job_id" varchar NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_accounting_sync_jobs_tenant" ON "accounting_sync_jobs" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_sync_jobs_account" ON "accounting_sync_jobs" ("accounting_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_sync_jobs_status" ON "accounting_sync_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_sync_jobs_scheduled" ON "accounting_sync_jobs" ("scheduled_at") WHERE "status" = 'pending'`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_sync_jobs_type" ON "accounting_sync_jobs" ("job_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_accounting_sync_jobs_parent" ON "accounting_sync_jobs" ("parent_job_id")`);

    // Create table for storing exchange rates (for multi-currency support)
    await queryRunner.query(`
      CREATE TABLE "exchange_rates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" varchar NOT NULL,
        "accounting_account_id" varchar NULL,
        "from_currency" varchar(3) NOT NULL,
        "to_currency" varchar(3) NOT NULL,
        "rate" decimal(20,10) NOT NULL,
        "bid_rate" decimal(20,10) NULL,
        "ask_rate" decimal(20,10) NULL,
        "mid_rate" decimal(20,10) NULL,
        "rate_date" date NOT NULL,
        "source" varchar NOT NULL DEFAULT 'manual',
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_exchange_rates_tenant" ON "exchange_rates" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_exchange_rates_account" ON "exchange_rates" ("accounting_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_exchange_rates_currencies_date" ON "exchange_rates" ("from_currency", "to_currency", "rate_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_exchange_rates_date" ON "exchange_rates" ("rate_date")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_exchange_rates_unique" ON "exchange_rates" ("tenant_id", "from_currency", "to_currency", "rate_date", "source") WHERE "is_active" = true`);

    // Create table for storing tax compliance data
    await queryRunner.query(`
      CREATE TABLE "tax_compliance_records" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" varchar NOT NULL,
        "accounting_account_id" varchar NOT NULL,
        "record_type" varchar NOT NULL,
        "reference_id" varchar NOT NULL,
        "reference_type" varchar NOT NULL,
        "tax_period_start" date NOT NULL,
        "tax_period_end" date NOT NULL,
        "tax_data" jsonb NOT NULL,
        "compliance_status" varchar NOT NULL DEFAULT 'pending',
        "submission_status" varchar NULL,
        "submission_date" timestamp NULL,
        "submission_reference" varchar NULL,
        "validation_errors" jsonb NULL,
        "government_response" jsonb NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tax_compliance_records_tenant" ON "tax_compliance_records" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tax_compliance_records_account" ON "tax_compliance_records" ("accounting_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tax_compliance_records_reference" ON "tax_compliance_records" ("reference_type", "reference_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tax_compliance_records_period" ON "tax_compliance_records" ("tax_period_start", "tax_period_end")`);
    await queryRunner.query(`CREATE INDEX "IDX_tax_compliance_records_status" ON "tax_compliance_records" ("compliance_status")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "accounting_entity_mappings" 
      ADD CONSTRAINT "FK_accounting_entity_mappings_account" 
      FOREIGN KEY ("accounting_account_id") REFERENCES "accounting_accounts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "accounting_sync_jobs" 
      ADD CONSTRAINT "FK_accounting_sync_jobs_account" 
      FOREIGN KEY ("accounting_account_id") REFERENCES "accounting_accounts"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "exchange_rates" 
      ADD CONSTRAINT "FK_exchange_rates_account" 
      FOREIGN KEY ("accounting_account_id") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "tax_compliance_records" 
      ADD CONSTRAINT "FK_tax_compliance_records_account" 
      FOREIGN KEY ("accounting_account_id") REFERENCES "accounting_accounts"("id") ON DELETE CASCADE
    `);

    // Add accounting-related fields to existing order and invoice tables
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD COLUMN "external_invoice_id" varchar NULL,
      ADD COLUMN "external_invoice_number" varchar NULL,
      ADD COLUMN "external_payment_id" varchar NULL,
      ADD COLUMN "external_customer_id" varchar NULL,
      ADD COLUMN "tax_calculation_data" jsonb NULL,
      ADD COLUMN "currency" varchar(3) NULL DEFAULT 'IDR',
      ADD COLUMN "exchange_rate" decimal(20,10) NULL DEFAULT 1.0,
      ADD COLUMN "base_currency_total" decimal(15,2) NULL
    `);

    await queryRunner.query(`CREATE INDEX "IDX_orders_external_invoice" ON "orders" ("external_invoice_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_external_customer" ON "orders" ("external_customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_currency" ON "orders" ("currency")`);

    -- Add fields to products table for accounting integration
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD COLUMN "external_item_id" varchar NULL,
      ADD COLUMN "accounting_item_mappings" jsonb NULL,
      ADD COLUMN "tax_category" varchar NULL DEFAULT 'standard',
      ADD COLUMN "tax_exempt" boolean NOT NULL DEFAULT false,
      ADD COLUMN "cogs_account_id" varchar NULL,
      ADD COLUMN "income_account_id" varchar NULL,
      ADD COLUMN "asset_account_id" varchar NULL
    `);

    await queryRunner.query(`CREATE INDEX "IDX_products_external_item" ON "products" ("external_item_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_products_tax_category" ON "products" ("tax_category")`);
    await queryRunner.query(`CREATE INDEX "IDX_products_tax_exempt" ON "products" ("tax_exempt")`);

    -- Add fields to customers table for accounting integration
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD COLUMN "external_customer_id" varchar NULL,
      ADD COLUMN "accounting_customer_mappings" jsonb NULL,
      ADD COLUMN "npwp" varchar(20) NULL,
      ADD COLUMN "tax_exempt" boolean NOT NULL DEFAULT false,
      ADD COLUMN "payment_terms" varchar NULL,
      ADD COLUMN "credit_limit" decimal(15,2) NULL DEFAULT 0
    `);

    await queryRunner.query(`CREATE INDEX "IDX_customers_external_customer" ON "customers" ("external_customer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_customers_npwp" ON "customers" ("npwp")`);
    await queryRunner.query(`CREATE INDEX "IDX_customers_tax_exempt" ON "customers" ("tax_exempt")`);

    -- Create view for accounting integration overview
    await queryRunner.query(`
      CREATE VIEW "accounting_integration_overview" AS
      SELECT 
        aa.id as account_id,
        aa.tenant_id,
        aa.platform,
        aa.status,
        aa.company_name,
        aa.company_currency,
        aa.connection_health_score,
        aa.last_sync_at,
        aa.sync_error_count,
        COUNT(aem.id) as mapped_entities_count,
        COUNT(asj.id) FILTER (WHERE asj.status = 'pending') as pending_jobs_count,
        COUNT(asj.id) FILTER (WHERE asj.status = 'running') as running_jobs_count,
        COUNT(asj.id) FILTER (WHERE asj.status = 'failed') as failed_jobs_count,
        aa.created_at,
        aa.updated_at
      FROM accounting_accounts aa
      LEFT JOIN accounting_entity_mappings aem ON aa.id = aem.accounting_account_id AND aem.is_active = true
      LEFT JOIN accounting_sync_jobs asj ON aa.id = asj.accounting_account_id AND asj.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY aa.id, aa.tenant_id, aa.platform, aa.status, aa.company_name, aa.company_currency, 
               aa.connection_health_score, aa.last_sync_at, aa.sync_error_count, aa.created_at, aa.updated_at
    `);

    -- Create function to update accounting account health score
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_accounting_account_health_score(account_id uuid)
      RETURNS decimal(3,2) AS $$
      DECLARE
        health_score decimal(3,2) := 100.00;
        sync_error_count integer;
        days_since_last_sync integer;
        failed_jobs_count integer;
      BEGIN
        SELECT 
          aa.sync_error_count,
          COALESCE(EXTRACT(days FROM now() - aa.last_sync_at), 999),
          COUNT(asj.id) FILTER (WHERE asj.status = 'failed' AND asj.created_at >= CURRENT_DATE - INTERVAL '7 days')
        INTO sync_error_count, days_since_last_sync, failed_jobs_count
        FROM accounting_accounts aa
        LEFT JOIN accounting_sync_jobs asj ON aa.id = asj.accounting_account_id
        WHERE aa.id = account_id
        GROUP BY aa.sync_error_count, aa.last_sync_at;
        
        -- Deduct points for sync errors
        health_score := health_score - LEAST(sync_error_count * 5, 30);
        
        -- Deduct points for stale data
        IF days_since_last_sync > 7 THEN
          health_score := health_score - LEAST(days_since_last_sync - 7, 20);
        END IF;
        
        -- Deduct points for failed jobs
        health_score := health_score - LEAST(failed_jobs_count * 2, 15);
        
        -- Ensure score is between 0 and 100
        health_score := GREATEST(0, LEAST(100, health_score));
        
        -- Update the account
        UPDATE accounting_accounts 
        SET connection_health_score = health_score, updated_at = now()
        WHERE id = account_id;
        
        RETURN health_score;
      END;
      $$ LANGUAGE plpgsql;
    `);

    -- Create trigger to automatically update health scores
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trigger_update_health_score()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
          PERFORM update_accounting_account_health_score(NEW.accounting_account_id);
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM update_accounting_account_health_score(OLD.accounting_account_id);
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_accounting_sync_jobs_health_score
      AFTER INSERT OR UPDATE OR DELETE ON accounting_sync_jobs
      FOR EACH ROW EXECUTE FUNCTION trigger_update_health_score()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers and functions
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_accounting_sync_jobs_health_score ON accounting_sync_jobs`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS trigger_update_health_score()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_accounting_account_health_score(uuid)`);

    // Drop view
    await queryRunner.query(`DROP VIEW IF EXISTS "accounting_integration_overview"`);

    // Remove added columns from existing tables
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "external_customer_id"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "accounting_customer_mappings"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "npwp"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "tax_exempt"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "payment_terms"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "credit_limit"`);

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "external_item_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "accounting_item_mappings"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "tax_category"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "tax_exempt"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "cogs_account_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "income_account_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "asset_account_id"`);

    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "external_invoice_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "external_invoice_number"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "external_payment_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "external_customer_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "tax_calculation_data"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "currency"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "exchange_rate"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "base_currency_total"`);

    await queryRunner.query(`ALTER TABLE "integration_logs" DROP COLUMN IF EXISTS "accounting_account_id"`);
    await queryRunner.query(`ALTER TABLE "integration_logs" DROP COLUMN IF EXISTS "operation_type"`);
    await queryRunner.query(`ALTER TABLE "integration_logs" DROP COLUMN IF EXISTS "entity_type"`);
    await queryRunner.query(`ALTER TABLE "integration_logs" DROP COLUMN IF EXISTS "entity_id"`);
    await queryRunner.query(`ALTER TABLE "integration_logs" DROP COLUMN IF EXISTS "external_entity_id"`);
    await queryRunner.query(`ALTER TABLE "integration_logs" DROP COLUMN IF EXISTS "transformation_details"`);

    await queryRunner.query(`ALTER TABLE "sync_status" DROP COLUMN IF EXISTS "accounting_account_id"`);
    await queryRunner.query(`ALTER TABLE "sync_status" DROP COLUMN IF EXISTS "external_reference_id"`);
    await queryRunner.query(`ALTER TABLE "sync_status" DROP COLUMN IF EXISTS "sync_direction"`);
    await queryRunner.query(`ALTER TABLE "sync_status" DROP COLUMN IF EXISTS "data_transformation"`);
    await queryRunner.query(`ALTER TABLE "sync_status" DROP COLUMN IF EXISTS "conflict_resolution"`);

    // Drop accounting tables
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_compliance_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exchange_rates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_sync_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_entity_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounting_accounts"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE IF EXISTS "sync_frequency_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "accounting_data_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "accounting_connection_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "accounting_platform_enum"`);
  }
}