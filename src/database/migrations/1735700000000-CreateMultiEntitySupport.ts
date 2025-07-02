import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMultiEntitySupport1735700000000 implements MigrationInterface {
  name = 'CreateMultiEntitySupport1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for multi-entity features
    await queryRunner.query(`
      CREATE TYPE "company_type_enum" AS ENUM(
        'holding', 'subsidiary', 'division', 'branch', 'representative_office', 
        'joint_venture', 'partnership'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "company_status_enum" AS ENUM(
        'active', 'inactive', 'suspended', 'under_review', 'dissolved'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "business_type_enum" AS ENUM(
        'manufacture', 'trading', 'service', 'retail', 'wholesale', 
        'distribution', 'ecommerce', 'restaurant', 'agriculture', 
        'technology', 'logistics', 'consulting', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "company_size_enum" AS ENUM(
        'micro', 'small', 'medium', 'large'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "relationship_type_enum" AS ENUM(
        'parent_subsidiary', 'joint_venture', 'sister_company', 'partner', 
        'supplier', 'customer', 'distributor', 'franchise', 'licensing', 
        'merger', 'acquisition', 'strategic_alliance', 'consortium', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "relationship_status_enum" AS ENUM(
        'active', 'inactive', 'pending_approval', 'suspended', 
        'terminated', 'under_review'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "trading_terms_enum" AS ENUM(
        'cash_on_delivery', 'net_30', 'net_60', 'net_90', 'credit_card', 
        'bank_transfer', 'letter_of_credit', 'advance_payment', 
        'consignment', 'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "transfer_type_enum" AS ENUM(
        'inventory', 'financial', 'asset', 'service', 
        'intellectual_property', 'employee', 'contract', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "transfer_status_enum" AS ENUM(
        'draft', 'pending_approval', 'approved', 'in_transit', 'received', 
        'completed', 'rejected', 'cancelled', 'returned', 'failed'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "transfer_priority_enum" AS ENUM(
        'low', 'normal', 'high', 'urgent', 'critical'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "transfer_reason_enum" AS ENUM(
        'operational_need', 'cost_optimization', 'capacity_balancing', 
        'maintenance', 'emergency', 'strategic', 'regulatory', 'seasonal', 
        'project_allocation', 'restructuring', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_terms_enum" AS ENUM(
        'immediate', 'net_30', 'net_60', 'net_90', 'inter_company_account', 
        'no_payment', 'cost_allocation', 'shared_service'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "report_type_enum" AS ENUM(
        'financial_statement', 'profit_loss', 'balance_sheet', 'cash_flow', 
        'inventory_summary', 'sales_summary', 'purchase_summary', 
        'inter_company_transactions', 'performance_metrics', 'compliance_report', 
        'tax_report', 'operational_report', 'strategic_report', 'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "report_status_enum" AS ENUM(
        'draft', 'generating', 'completed', 'failed', 'approved', 
        'published', 'archived'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "report_period_enum" AS ENUM(
        'daily', 'weekly', 'monthly', 'quarterly', 
        'semi_annually', 'annually', 'custom_range'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "consolidation_method_enum" AS ENUM(
        'full', 'proportional', 'equity', 'cost', 'elimination'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "data_aggregation_enum" AS ENUM(
        'sum', 'average', 'weighted_average', 'minimum', 
        'maximum', 'count', 'median', 'first', 'last'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "billing_plan_enum" AS ENUM(
        'free', 'basic', 'professional', 'enterprise', 'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "billing_cycle_enum" AS ENUM(
        'monthly', 'quarterly', 'semi_annually', 'annually', 'pay_as_you_go'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "billing_status_enum" AS ENUM(
        'active', 'pending', 'overdue', 'suspended', 'cancelled', 'churned'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_status_enum" AS ENUM(
        'pending', 'processing', 'paid', 'failed', 'refunded', 'disputed', 'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "payment_method_enum" AS ENUM(
        'credit_card', 'bank_transfer', 'virtual_account', 'e_wallet', 
        'qris', 'invoice', 'check', 'cash'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "usage_metric_type_enum" AS ENUM(
        'user_count', 'transaction_count', 'storage_gb', 'api_calls', 
        'products', 'locations', 'integrations', 'reports', 'custom'
      )
    `);

    // Create companies table with closure table support
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "legal_name" varchar(200),
        "code" varchar(20) NOT NULL,
        "display_name" varchar(100),
        "type" "company_type_enum" NOT NULL DEFAULT 'subsidiary',
        "status" "company_status_enum" NOT NULL DEFAULT 'active',
        "business_type" "business_type_enum" NOT NULL DEFAULT 'trading',
        "company_size" "company_size_enum" NOT NULL DEFAULT 'small',
        "description" text,
        "parent_company_id" uuid,
        "level" integer NOT NULL DEFAULT 0,
        "path" varchar(500),
        "tax_id" varchar(50),
        "business_license" varchar(100),
        "siup_number" varchar(50),
        "tdp_number" varchar(50),
        "nib_number" varchar(50),
        "established_date" date,
        "incorporation_date" date,
        "phone_number" varchar(20),
        "email" varchar(255),
        "website" varchar(255),
        "fax_number" varchar(20),
        "address_line_1" varchar(255),
        "address_line_2" varchar(255),
        "city" varchar(100),
        "province" varchar(100),
        "postal_code" varchar(10),
        "country" varchar(100) NOT NULL DEFAULT 'Indonesia',
        "timezone" varchar(50) NOT NULL DEFAULT 'Asia/Jakarta',
        "ceo_id" uuid,
        "finance_manager_id" uuid,
        "hr_manager_id" uuid,
        "currency" varchar(3) NOT NULL DEFAULT 'IDR',
        "initial_capital" decimal(20,2),
        "paid_up_capital" decimal(20,2),
        "authorized_capital" decimal(20,2),
        "annual_revenue" decimal(20,2),
        "fiscal_year_start" integer NOT NULL DEFAULT 1,
        "fiscal_year_end" integer NOT NULL DEFAULT 12,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_holding_company" boolean NOT NULL DEFAULT false,
        "allows_inter_company_transfers" boolean NOT NULL DEFAULT true,
        "requires_approval_for_transfers" boolean NOT NULL DEFAULT true,
        "consolidation_enabled" boolean NOT NULL DEFAULT true,
        "separate_billing" boolean NOT NULL DEFAULT false,
        "employee_count" integer,
        "max_employees" integer,
        "business_hours" jsonb,
        "financial_settings" jsonb,
        "business_settings" jsonb,
        "integration_settings" jsonb,
        "compliance_settings" jsonb,
        "performance_metrics" jsonb,
        "subscription_plan" varchar(50),
        "billing_cycle" varchar(20) NOT NULL DEFAULT 'monthly',
        "billing_address" jsonb,
        "billing_contact" jsonb,
        "custom_fields" jsonb,
        "metadata" jsonb,
        "tags" text[],
        "notes" text,
        "logo_url" text,
        "brand_colors" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_companies" PRIMARY KEY ("id")
      )
    `);

    // Create companies closure table
    await queryRunner.query(`
      CREATE TABLE "companies_closure" (
        "id_ancestor" uuid NOT NULL,
        "id_descendant" uuid NOT NULL,
        PRIMARY KEY ("id_ancestor", "id_descendant")
      )
    `);

    // Create company_relationships table
    await queryRunner.query(`
      CREATE TABLE "company_relationships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "from_company_id" uuid NOT NULL,
        "to_company_id" uuid NOT NULL,
        "relationship_type" "relationship_type_enum" NOT NULL,
        "status" "relationship_status_enum" NOT NULL DEFAULT 'active',
        "relationship_name" varchar(200),
        "description" text,
        "ownership_percentage" decimal(5,2),
        "voting_rights_percentage" decimal(5,2),
        "is_controlling_interest" boolean NOT NULL DEFAULT false,
        "board_representation" integer,
        "legal_structure" varchar(100),
        "regulatory_approval_required" boolean NOT NULL DEFAULT false,
        "regulatory_approval_status" varchar(50),
        "contract_reference" varchar(100),
        "legal_agreement_date" date,
        "contract_expiry_date" date,
        "trading_terms" "trading_terms_enum",
        "credit_limit" decimal(15,2),
        "payment_terms_days" integer,
        "currency" varchar(3) NOT NULL DEFAULT 'IDR',
        "settlement_terms" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "allows_inter_company_transfers" boolean NOT NULL DEFAULT true,
        "requires_approval_for_transfers" boolean NOT NULL DEFAULT true,
        "auto_approve_transfers_under" decimal(15,2),
        "consolidated_reporting" boolean NOT NULL DEFAULT false,
        "shared_services" text[],
        "primary_contact_from_id" uuid,
        "primary_contact_to_id" uuid,
        "relationship_manager_id" uuid,
        "effective_from" date NOT NULL,
        "effective_until" date,
        "auto_renew" boolean NOT NULL DEFAULT false,
        "renewal_period_months" integer,
        "notice_period_days" integer NOT NULL DEFAULT 30,
        "transaction_volume" decimal(20,2) NOT NULL DEFAULT 0,
        "transaction_count" integer NOT NULL DEFAULT 0,
        "last_transaction_date" timestamp,
        "relationship_score" decimal(3,2),
        "performance_rating" varchar(20),
        "risk_level" varchar(20) NOT NULL DEFAULT 'medium',
        "risk_factors" text[],
        "compliance_status" varchar(50) NOT NULL DEFAULT 'compliant',
        "last_compliance_check" date,
        "next_review_date" date,
        "business_terms" jsonb,
        "integration_settings" jsonb,
        "approval_workflow_id" uuid,
        "notification_settings" jsonb,
        "custom_fields" jsonb,
        "metadata" jsonb,
        "tags" text[],
        "notes" text,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_company_relationships" PRIMARY KEY ("id")
      )
    `);

    // Create inter_company_transfers table
    await queryRunner.query(`
      CREATE TABLE "inter_company_transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "transfer_number" varchar(50) NOT NULL UNIQUE,
        "reference_number" varchar(100),
        "external_reference" varchar(100),
        "from_company_id" uuid NOT NULL,
        "to_company_id" uuid NOT NULL,
        "transfer_type" "transfer_type_enum" NOT NULL,
        "status" "transfer_status_enum" NOT NULL DEFAULT 'draft',
        "priority" "transfer_priority_enum" NOT NULL DEFAULT 'normal',
        "reason" "transfer_reason_enum" NOT NULL DEFAULT 'operational_need',
        "description" text,
        "business_justification" text,
        "transfer_date" date NOT NULL,
        "requested_date" date,
        "approved_date" timestamp,
        "shipped_date" timestamp,
        "received_date" timestamp,
        "completed_date" timestamp,
        "due_date" date,
        "requested_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "shipped_by_id" uuid,
        "received_by_id" uuid,
        "responsible_person_from_id" uuid,
        "responsible_person_to_id" uuid,
        "total_value" decimal(20,2),
        "currency" varchar(3) NOT NULL DEFAULT 'IDR',
        "exchange_rate" decimal(10,6),
        "total_value_base_currency" decimal(20,2),
        "payment_terms" "payment_terms_enum" NOT NULL DEFAULT 'inter_company_account',
        "payment_due_date" date,
        "payment_completed" boolean NOT NULL DEFAULT false,
        "payment_reference" varchar(100),
        "transfer_items" jsonb NOT NULL,
        "shipping_method" varchar(100),
        "shipping_carrier" varchar(100),
        "tracking_number" varchar(100),
        "shipping_cost" decimal(10,2),
        "insurance_cost" decimal(10,2),
        "estimated_delivery_date" date,
        "actual_delivery_date" date,
        "from_location" jsonb,
        "to_location" jsonb,
        "requires_inspection" boolean NOT NULL DEFAULT false,
        "inspection_completed" boolean NOT NULL DEFAULT false,
        "inspection_date" timestamp,
        "inspection_notes" text,
        "quality_rating" varchar(20),
        "required_documents" text[],
        "attached_documents" text[],
        "delivery_receipt_url" text,
        "invoice_number" varchar(100),
        "packing_list_url" text,
        "requires_approval" boolean NOT NULL DEFAULT true,
        "approval_instance_id" uuid,
        "approval_notes" text,
        "regulatory_compliance" jsonb,
        "processing_time_hours" decimal(10,2),
        "delivery_time_hours" decimal(10,2),
        "is_on_time" boolean,
        "delay_reason" text,
        "cost_breakdown" jsonb,
        "risk_assessment" jsonb,
        "notification_settings" jsonb,
        "custom_fields" jsonb,
        "metadata" jsonb,
        "tags" text[],
        "notes" text,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_inter_company_transfers" PRIMARY KEY ("id")
      )
    `);

    // Create consolidated_reports table
    await queryRunner.query(`
      CREATE TABLE "consolidated_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "report_number" varchar(50) NOT NULL UNIQUE,
        "report_name" varchar(200) NOT NULL,
        "report_title" varchar(300),
        "report_type" "report_type_enum" NOT NULL,
        "status" "report_status_enum" NOT NULL DEFAULT 'draft',
        "description" text,
        "parent_company_id" uuid NOT NULL,
        "included_companies" text[] NOT NULL,
        "excluded_companies" text[],
        "company_filter_criteria" jsonb,
        "consolidation_method" "consolidation_method_enum" NOT NULL DEFAULT 'full',
        "eliminate_inter_company" boolean NOT NULL DEFAULT true,
        "apply_ownership_percentage" boolean NOT NULL DEFAULT false,
        "currency_conversion" boolean NOT NULL DEFAULT true,
        "base_currency" varchar(3) NOT NULL DEFAULT 'IDR',
        "exchange_rate_date" date,
        "report_period" "report_period_enum" NOT NULL DEFAULT 'monthly',
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "fiscal_year" integer,
        "fiscal_quarter" integer,
        "fiscal_month" integer,
        "comparison_period_start" date,
        "comparison_period_end" date,
        "generated_date" timestamp,
        "generated_by_id" uuid,
        "generation_time_seconds" integer,
        "data_source_count" integer,
        "total_records_processed" integer,
        "report_structure" jsonb,
        "report_data" jsonb,
        "consolidation_adjustments" jsonb,
        "calculation_formulas" jsonb,
        "derived_metrics" jsonb,
        "benchmarks" jsonb,
        "data_quality_score" decimal(5,2),
        "validation_rules" jsonb,
        "validation_errors" jsonb,
        "data_completeness" decimal(5,2),
        "requires_approval" boolean NOT NULL DEFAULT false,
        "approved_by_id" uuid,
        "approved_date" timestamp,
        "approval_notes" text,
        "is_confidential" boolean NOT NULL DEFAULT false,
        "access_level" varchar(50) NOT NULL DEFAULT 'internal',
        "authorized_viewers" text[],
        "distribution_list" text[],
        "published_date" timestamp,
        "published_by_id" uuid,
        "report_file_url" text,
        "report_file_format" varchar(10),
        "report_file_size" integer,
        "alternative_formats" jsonb,
        "is_automated" boolean NOT NULL DEFAULT false,
        "schedule_cron" varchar(100),
        "next_generation_date" timestamp,
        "auto_distribute" boolean NOT NULL DEFAULT false,
        "generation_count" integer NOT NULL DEFAULT 1,
        "last_auto_generated" timestamp,
        "custom_fields" jsonb,
        "metadata" jsonb,
        "tags" text[],
        "notes" text,
        "template_id" uuid,
        "is_template" boolean NOT NULL DEFAULT false,
        "template_name" varchar(200),
        "configuration" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_consolidated_reports" PRIMARY KEY ("id")
      )
    `);

    // Create company_billing table
    await queryRunner.query(`
      CREATE TABLE "company_billing" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "billing_account_number" varchar(50) NOT NULL UNIQUE,
        "billing_email" varchar(255) NOT NULL,
        "billing_contact_name" varchar(200),
        "billing_contact_phone" varchar(20),
        "billing_plan" "billing_plan_enum" NOT NULL DEFAULT 'basic',
        "billing_cycle" "billing_cycle_enum" NOT NULL DEFAULT 'monthly',
        "billing_status" "billing_status_enum" NOT NULL DEFAULT 'active',
        "subscription_start_date" date NOT NULL,
        "subscription_end_date" date,
        "trial_end_date" date,
        "is_trial" boolean NOT NULL DEFAULT false,
        "auto_renew" boolean NOT NULL DEFAULT true,
        "base_price" decimal(10,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'IDR',
        "discount_percentage" decimal(5,2) NOT NULL DEFAULT 0,
        "discount_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "tax_rate" decimal(5,2) NOT NULL DEFAULT 11,
        "tax_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "total_amount" decimal(10,2) NOT NULL,
        "usage_based_billing" boolean NOT NULL DEFAULT false,
        "usage_pricing" jsonb,
        "current_usage" jsonb,
        "billing_day" integer NOT NULL DEFAULT 1,
        "last_billing_date" date,
        "next_billing_date" date NOT NULL,
        "billing_timezone" varchar(50) NOT NULL DEFAULT 'Asia/Jakarta',
        "proration_enabled" boolean NOT NULL DEFAULT true,
        "preferred_payment_method" "payment_method_enum" NOT NULL DEFAULT 'bank_transfer',
        "payment_terms_days" integer NOT NULL DEFAULT 30,
        "credit_limit" decimal(15,2),
        "outstanding_balance" decimal(15,2) NOT NULL DEFAULT 0,
        "last_payment_date" date,
        "last_payment_amount" decimal(10,2),
        "credit_score" integer,
        "payment_history_score" decimal(3,2),
        "days_past_due" integer NOT NULL DEFAULT 0,
        "overdue_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "collection_status" varchar(50),
        "collection_notes" text,
        "billing_address" jsonb NOT NULL,
        "tax_information" jsonb,
        "subscription_limits" jsonb,
        "enabled_features" text[],
        "disabled_features" text[],
        "addon_features" jsonb,
        "notification_settings" jsonb,
        "communication_preferences" jsonb,
        "account_manager_id" uuid,
        "customer_success_manager_id" uuid,
        "support_tier" varchar(50) NOT NULL DEFAULT 'standard',
        "lifetime_value" decimal(15,2) NOT NULL DEFAULT 0,
        "total_payments" decimal(15,2) NOT NULL DEFAULT 0,
        "average_monthly_revenue" decimal(10,2),
        "churn_risk_score" decimal(3,2),
        "expansion_opportunity_score" decimal(3,2),
        "customer_health_score" decimal(3,2),
        "contract_start_date" date,
        "contract_end_date" date,
        "contract_value" decimal(15,2),
        "minimum_commitment" decimal(15,2),
        "early_termination_fee" decimal(10,2),
        "referral_code" varchar(50),
        "referred_by" varchar(50),
        "partner_id" uuid,
        "partner_commission_rate" decimal(5,2),
        "custom_fields" jsonb,
        "metadata" jsonb,
        "tags" text[],
        "notes" text,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_company_billing" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "companies_closure" 
      ADD CONSTRAINT "FK_companies_closure_ancestor" 
      FOREIGN KEY ("id_ancestor") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "companies_closure" 
      ADD CONSTRAINT "FK_companies_closure_descendant" 
      FOREIGN KEY ("id_descendant") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "companies" 
      ADD CONSTRAINT "FK_companies_parent" 
      FOREIGN KEY ("parent_company_id") REFERENCES "companies"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "companies" 
      ADD CONSTRAINT "FK_companies_ceo" 
      FOREIGN KEY ("ceo_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "companies" 
      ADD CONSTRAINT "FK_companies_finance_manager" 
      FOREIGN KEY ("finance_manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "companies" 
      ADD CONSTRAINT "FK_companies_hr_manager" 
      FOREIGN KEY ("hr_manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "company_relationships" 
      ADD CONSTRAINT "FK_company_relationships_from" 
      FOREIGN KEY ("from_company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "company_relationships" 
      ADD CONSTRAINT "FK_company_relationships_to" 
      FOREIGN KEY ("to_company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "company_relationships" 
      ADD CONSTRAINT "FK_company_relationships_contact_from" 
      FOREIGN KEY ("primary_contact_from_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "company_relationships" 
      ADD CONSTRAINT "FK_company_relationships_contact_to" 
      FOREIGN KEY ("primary_contact_to_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "company_relationships" 
      ADD CONSTRAINT "FK_company_relationships_manager" 
      FOREIGN KEY ("relationship_manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_from" 
      FOREIGN KEY ("from_company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_to" 
      FOREIGN KEY ("to_company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_requested_by" 
      FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_approved_by" 
      FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_shipped_by" 
      FOREIGN KEY ("shipped_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_received_by" 
      FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inter_company_transfers" 
      ADD CONSTRAINT "FK_inter_company_transfers_approval_instance" 
      FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "consolidated_reports" 
      ADD CONSTRAINT "FK_consolidated_reports_parent_company" 
      FOREIGN KEY ("parent_company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "consolidated_reports" 
      ADD CONSTRAINT "FK_consolidated_reports_generated_by" 
      FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "consolidated_reports" 
      ADD CONSTRAINT "FK_consolidated_reports_approved_by" 
      FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "consolidated_reports" 
      ADD CONSTRAINT "FK_consolidated_reports_published_by" 
      FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "company_billing" 
      ADD CONSTRAINT "FK_company_billing_company" 
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "company_billing" 
      ADD CONSTRAINT "FK_company_billing_account_manager" 
      FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "company_billing" 
      ADD CONSTRAINT "FK_company_billing_customer_success_manager" 
      FOREIGN KEY ("customer_success_manager_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Add company_id to departments table
    await queryRunner.query(`
      ALTER TABLE "departments" 
      ADD COLUMN "company_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'
    `);

    await queryRunner.query(`
      ALTER TABLE "departments" 
      ADD CONSTRAINT "FK_departments_company" 
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX "IDX_companies_tenant_deleted" ON "companies" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_tenant_code" ON "companies" ("tenant_id", "code")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_tenant_status" ON "companies" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_tenant_type" ON "companies" ("tenant_id", "type")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_tenant_business_type" ON "companies" ("tenant_id", "business_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_status_active" ON "companies" ("status", "is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_companies_parent" ON "companies" ("parent_company_id", "status")`);

    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_tenant_deleted" ON "company_relationships" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_tenant_from" ON "company_relationships" ("tenant_id", "from_company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_tenant_to" ON "company_relationships" ("tenant_id", "to_company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_tenant_type" ON "company_relationships" ("tenant_id", "relationship_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_tenant_status" ON "company_relationships" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_status_active" ON "company_relationships" ("status", "is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_relationships_from_to_status" ON "company_relationships" ("from_company_id", "to_company_id", "status")`);

    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_deleted" ON "inter_company_transfers" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_number" ON "inter_company_transfers" ("tenant_id", "transfer_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_from" ON "inter_company_transfers" ("tenant_id", "from_company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_to" ON "inter_company_transfers" ("tenant_id", "to_company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_type" ON "inter_company_transfers" ("tenant_id", "transfer_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_status" ON "inter_company_transfers" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_priority" ON "inter_company_transfers" ("tenant_id", "priority")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_tenant_date" ON "inter_company_transfers" ("tenant_id", "transfer_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_status_date" ON "inter_company_transfers" ("status", "transfer_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_inter_company_transfers_from_to_status" ON "inter_company_transfers" ("from_company_id", "to_company_id", "status")`);

    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_deleted" ON "consolidated_reports" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_number" ON "consolidated_reports" ("tenant_id", "report_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_type" ON "consolidated_reports" ("tenant_id", "report_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_status" ON "consolidated_reports" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_parent" ON "consolidated_reports" ("tenant_id", "parent_company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_period" ON "consolidated_reports" ("tenant_id", "report_period")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_tenant_period_range" ON "consolidated_reports" ("tenant_id", "period_start", "period_end")`);
    await queryRunner.query(`CREATE INDEX "IDX_consolidated_reports_status_generated" ON "consolidated_reports" ("status", "generated_date")`);

    await queryRunner.query(`CREATE INDEX "IDX_company_billing_tenant_deleted" ON "company_billing" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_billing_tenant_company" ON "company_billing" ("tenant_id", "company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_billing_tenant_status" ON "company_billing" ("tenant_id", "billing_status")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_billing_tenant_plan" ON "company_billing" ("tenant_id", "billing_plan")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_billing_tenant_next_billing" ON "company_billing" ("tenant_id", "next_billing_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_company_billing_status_next_billing" ON "company_billing" ("billing_status", "next_billing_date")`);

    await queryRunner.query(`CREATE INDEX "IDX_departments_tenant_company" ON "departments" ("tenant_id", "company_id")`);

    // Create unique constraints
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_companies_tenant_code_unique" 
      ON "companies" ("tenant_id", "code") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_company_relationships_unique" 
      ON "company_relationships" ("tenant_id", "from_company_id", "to_company_id", "relationship_type") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_company_billing_company_unique" 
      ON "company_billing" ("company_id") 
      WHERE "isDeleted" = false
    `);

    // Add triggers for updated_at columns
    await queryRunner.query(`
      CREATE TRIGGER update_companies_updated_at 
      BEFORE UPDATE ON "companies" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_company_relationships_updated_at 
      BEFORE UPDATE ON "company_relationships" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_inter_company_transfers_updated_at 
      BEFORE UPDATE ON "inter_company_transfers" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_consolidated_reports_updated_at 
      BEFORE UPDATE ON "consolidated_reports" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_company_billing_updated_at 
      BEFORE UPDATE ON "company_billing" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_company_billing_updated_at ON "company_billing"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_consolidated_reports_updated_at ON "consolidated_reports"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_inter_company_transfers_updated_at ON "inter_company_transfers"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_company_relationships_updated_at ON "company_relationships"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_companies_updated_at ON "companies"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_tenant_company"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_status_next_billing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_tenant_next_billing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_tenant_plan"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_tenant_company"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_status_generated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_period_range"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_period"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_consolidated_reports_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_from_to_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_status_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_from"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inter_company_transfers_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_from_to_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_status_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_tenant_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_tenant_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_tenant_from"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_status_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_tenant_business_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_tenant_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_tenant_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_tenant_deleted"`);

    // Drop unique constraints
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_billing_company_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_relationships_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_tenant_code_unique"`);

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "FK_departments_company"`);
    await queryRunner.query(`ALTER TABLE "company_billing" DROP CONSTRAINT IF EXISTS "FK_company_billing_customer_success_manager"`);
    await queryRunner.query(`ALTER TABLE "company_billing" DROP CONSTRAINT IF EXISTS "FK_company_billing_account_manager"`);
    await queryRunner.query(`ALTER TABLE "company_billing" DROP CONSTRAINT IF EXISTS "FK_company_billing_company"`);
    await queryRunner.query(`ALTER TABLE "consolidated_reports" DROP CONSTRAINT IF EXISTS "FK_consolidated_reports_published_by"`);
    await queryRunner.query(`ALTER TABLE "consolidated_reports" DROP CONSTRAINT IF EXISTS "FK_consolidated_reports_approved_by"`);
    await queryRunner.query(`ALTER TABLE "consolidated_reports" DROP CONSTRAINT IF EXISTS "FK_consolidated_reports_generated_by"`);
    await queryRunner.query(`ALTER TABLE "consolidated_reports" DROP CONSTRAINT IF EXISTS "FK_consolidated_reports_parent_company"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_approval_instance"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_received_by"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_shipped_by"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_approved_by"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_requested_by"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_to"`);
    await queryRunner.query(`ALTER TABLE "inter_company_transfers" DROP CONSTRAINT IF EXISTS "FK_inter_company_transfers_from"`);
    await queryRunner.query(`ALTER TABLE "company_relationships" DROP CONSTRAINT IF EXISTS "FK_company_relationships_manager"`);
    await queryRunner.query(`ALTER TABLE "company_relationships" DROP CONSTRAINT IF EXISTS "FK_company_relationships_contact_to"`);
    await queryRunner.query(`ALTER TABLE "company_relationships" DROP CONSTRAINT IF EXISTS "FK_company_relationships_contact_from"`);
    await queryRunner.query(`ALTER TABLE "company_relationships" DROP CONSTRAINT IF EXISTS "FK_company_relationships_to"`);
    await queryRunner.query(`ALTER TABLE "company_relationships" DROP CONSTRAINT IF EXISTS "FK_company_relationships_from"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "FK_companies_hr_manager"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "FK_companies_finance_manager"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "FK_companies_ceo"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "FK_companies_parent"`);
    await queryRunner.query(`ALTER TABLE "companies_closure" DROP CONSTRAINT IF EXISTS "FK_companies_closure_descendant"`);
    await queryRunner.query(`ALTER TABLE "companies_closure" DROP CONSTRAINT IF EXISTS "FK_companies_closure_ancestor"`);

    // Remove company_id column from departments
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "company_id"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "company_billing"`);
    await queryRunner.query(`DROP TABLE "consolidated_reports"`);
    await queryRunner.query(`DROP TABLE "inter_company_transfers"`);
    await queryRunner.query(`DROP TABLE "company_relationships"`);
    await queryRunner.query(`DROP TABLE "companies_closure"`);
    await queryRunner.query(`DROP TABLE "companies"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "usage_metric_type_enum"`);
    await queryRunner.query(`DROP TYPE "payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "billing_status_enum"`);
    await queryRunner.query(`DROP TYPE "billing_cycle_enum"`);
    await queryRunner.query(`DROP TYPE "billing_plan_enum"`);
    await queryRunner.query(`DROP TYPE "data_aggregation_enum"`);
    await queryRunner.query(`DROP TYPE "consolidation_method_enum"`);
    await queryRunner.query(`DROP TYPE "report_period_enum"`);
    await queryRunner.query(`DROP TYPE "report_status_enum"`);
    await queryRunner.query(`DROP TYPE "report_type_enum"`);
    await queryRunner.query(`DROP TYPE "payment_terms_enum"`);
    await queryRunner.query(`DROP TYPE "transfer_reason_enum"`);
    await queryRunner.query(`DROP TYPE "transfer_priority_enum"`);
    await queryRunner.query(`DROP TYPE "transfer_status_enum"`);
    await queryRunner.query(`DROP TYPE "transfer_type_enum"`);
    await queryRunner.query(`DROP TYPE "trading_terms_enum"`);
    await queryRunner.query(`DROP TYPE "relationship_status_enum"`);
    await queryRunner.query(`DROP TYPE "relationship_type_enum"`);
    await queryRunner.query(`DROP TYPE "company_size_enum"`);
    await queryRunner.query(`DROP TYPE "business_type_enum"`);
    await queryRunner.query(`DROP TYPE "company_status_enum"`);
    await queryRunner.query(`DROP TYPE "company_type_enum"`);
  }
}