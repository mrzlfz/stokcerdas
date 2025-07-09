import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateCustomerTables1735920000000 implements MigrationInterface {
  name = 'CreateCustomerTables1735920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for Customer management
    await queryRunner.query(`
      CREATE TYPE "customer_status_enum" AS ENUM(
        'active',
        'inactive',
        'pending',
        'suspended',
        'dormant'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "customer_type_enum" AS ENUM(
        'individual',
        'business',
        'reseller',
        'wholesale',
        'enterprise'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "customer_segment_enum" AS ENUM(
        'new_customer',
        'loyal_customer',
        'high_value',
        'at_risk',
        'price_sensitive',
        'seasonal',
        'bulk_buyer',
        'vip',
        'enterprise'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "loyalty_tier_enum" AS ENUM(
        'bronze',
        'silver',
        'gold',
        'platinum',
        'diamond'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "customer_lifecycle_stage_enum" AS ENUM(
        'new',
        'growing',
        'mature',
        'declining',
        'dormant'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "segment_type_enum" AS ENUM(
        'demographic',
        'behavioral',
        'geographic',
        'psychographic',
        'value_based',
        'lifecycle',
        'engagement',
        'purchase_pattern'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "customer_transaction_type_enum" AS ENUM(
        'purchase',
        'return',
        'refund',
        'exchange',
        'credit',
        'loyalty_redemption',
        'loyalty_earn',
        'adjustment'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "customer_transaction_status_enum" AS ENUM(
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'refunded'
      );
    `);

    // Create Customers table
    await queryRunner.createTable(
      new Table({
        name: 'customers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'customer_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'full_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'date_of_birth',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'customer_type',
            type: 'customer_type_enum',
            default: "'individual'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'customer_status_enum',
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'company_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tax_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'industry',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'business_size',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'addresses',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'segment',
            type: 'customer_segment_enum',
            default: "'new_customer'",
            isNullable: false,
          },
          {
            name: 'loyalty_tier',
            type: 'loyalty_tier_enum',
            default: "'bronze'",
            isNullable: false,
          },
          {
            name: 'preferences',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'purchase_behavior',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'social_profiles',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'external_ids',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'communication_history',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'marketing_campaigns',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_fields',
            type: 'jsonb',
            isNullable: true,
          },
          // Analytics fields
          {
            name: 'lifetime_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'predicted_lifetime_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'average_order_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'total_orders',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'total_spent',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'average_order_frequency',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'first_order_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'last_order_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'days_since_last_order',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'days_since_first_order',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'churn_probability',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'retention_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 100,
            isNullable: false,
          },
          {
            name: 'customer_lifecycle_stage',
            type: 'customer_lifecycle_stage_enum',
            default: "'new'",
            isNullable: false,
          },
          {
            name: 'recent_order_frequency',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          // Support fields
          {
            name: 'support_tickets_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'average_satisfaction_rating',
            type: 'decimal',
            precision: 3,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'complaints_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'returns_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'total_returns_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          // Loyalty fields
          {
            name: 'loyalty_points',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'referrals_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'referral_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'referred_by',
            type: 'uuid',
            isNullable: true,
          },
          // Risk assessment fields
          {
            name: 'credit_score',
            type: 'int',
            default: 50,
            isNullable: false,
          },
          {
            name: 'is_high_risk',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'risk_factors',
            type: 'jsonb',
            isNullable: true,
          },
          // Tags and assignment
          {
            name: 'tags',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'assigned_sales_rep_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'account_manager_id',
            type: 'uuid',
            isNullable: true,
          },
          // Verification fields
          {
            name: 'is_email_verified',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'is_phone_verified',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'last_login_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'email_verified_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'phone_verified_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          // Standard audit fields
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Customer Segments table
    await queryRunner.createTable(
      new Table({
        name: 'customer_segments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'segment_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'segment_type',
            type: 'segment_type_enum',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'criteria',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'is_auto_assignment',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'priority',
            type: 'int',
            default: 1,
            isNullable: false,
          },
          {
            name: 'color_code',
            type: 'varchar',
            length: '7',
            isNullable: true,
          },
          {
            name: 'target_actions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'marketing_strategies',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'pricing_rules',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'customer_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'last_calculated_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'calculation_frequency',
            type: 'varchar',
            length: '50',
            default: "'daily'",
            isNullable: false,
          },
          {
            name: 'tags',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create Customer Transactions table
    await queryRunner.createTable(
      new Table({
        name: 'customer_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'transaction_number',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'transaction_type',
            type: 'customer_transaction_type_enum',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'customer_transaction_status_enum',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'transaction_date',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'IDR'",
            isNullable: false,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'channel',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'location',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'products',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'categories',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'quantity',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'discount_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'tax_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'shipping_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'profit_margin',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'cost_of_goods',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'seasonality_factor',
            type: 'decimal',
            precision: 3,
            scale: 2,
            default: 1.0,
            isNullable: false,
          },
          {
            name: 'day_of_week',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'hour_of_day',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'is_weekend',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'is_holiday',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'loyalty_points_earned',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'loyalty_points_redeemed',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'referral_code_used',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'promotion_codes',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'transaction_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'customer_feedback',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'external_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for Customers table
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customers_tenant_id_customer_number" ON "customers" ("tenant_id", "customer_number") WHERE "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customers_tenant_id_email" ON "customers" ("tenant_id", "email") WHERE "email" IS NOT NULL AND "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_phone" ON "customers" ("tenant_id", "phone") WHERE "phone" IS NOT NULL AND "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_status_segment" ON "customers" ("tenant_id", "status", "segment", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_loyalty_tier" ON "customers" ("tenant_id", "loyalty_tier", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_lifecycle_stage" ON "customers" ("tenant_id", "customer_lifecycle_stage", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_created_at" ON "customers" ("tenant_id", "created_at", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_last_order_date" ON "customers" ("tenant_id", "last_order_date", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_lifetime_value" ON "customers" ("tenant_id", "lifetime_value", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_churn_probability" ON "customers" ("tenant_id", "churn_probability", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_assigned_sales_rep" ON "customers" ("tenant_id", "assigned_sales_rep_id", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_account_manager" ON "customers" ("tenant_id", "account_manager_id", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_tenant_id_tags" ON "customers" USING GIN ("tenant_id", "tags") WHERE "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customers_full_text_search" ON "customers" USING GIN (to_tsvector('indonesian', "full_name" || ' ' || COALESCE("email", '') || ' ' || COALESCE("phone", '') || ' ' || COALESCE("company_name", ''))) WHERE "is_deleted" = false`,
    );

    // Create indexes for Customer Segments table
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customer_segments_tenant_id_segment_name" ON "customer_segments" ("tenant_id", "segment_name") WHERE "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_segments_tenant_id_segment_type" ON "customer_segments" ("tenant_id", "segment_type", "is_active", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_segments_tenant_id_auto_assignment" ON "customer_segments" ("tenant_id", "is_auto_assignment", "priority", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_segments_tenant_id_last_calculated" ON "customer_segments" ("tenant_id", "last_calculated_at", "is_deleted")`,
    );

    // Create indexes for Customer Transactions table
    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_customer_id" ON "customer_transactions" ("tenant_id", "customer_id", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_order_id" ON "customer_transactions" ("tenant_id", "order_id", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customer_transactions_tenant_id_transaction_number" ON "customer_transactions" ("tenant_id", "transaction_number") WHERE "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_transaction_date" ON "customer_transactions" ("tenant_id", "transaction_date", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_type_status" ON "customer_transactions" ("tenant_id", "transaction_type", "status", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_channel" ON "customer_transactions" ("tenant_id", "channel", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_payment_method" ON "customer_transactions" ("tenant_id", "payment_method", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_tenant_id_total_amount" ON "customer_transactions" ("tenant_id", "total_amount", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_customer_id_transaction_date" ON "customer_transactions" ("customer_id", "transaction_date", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_transaction_date_day_hour" ON "customer_transactions" ("transaction_date", "day_of_week", "hour_of_day", "is_deleted")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_categories" ON "customer_transactions" USING GIN ("categories") WHERE "is_deleted" = false`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_customer_transactions_promotion_codes" ON "customer_transactions" USING GIN ("promotion_codes") WHERE "is_deleted" = false`,
    );

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "customers" 
      ADD CONSTRAINT "FK_customers_referred_by" 
      FOREIGN KEY ("referred_by") REFERENCES "customers"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_transactions" 
      ADD CONSTRAINT "FK_customer_transactions_customer_id" 
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
    `);

    // Note: Order relationship will be added when orders table is available
    // await queryRunner.query(`
    //   ALTER TABLE "customer_transactions"
    //   ADD CONSTRAINT "FK_customer_transactions_order_id"
    //   FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL
    // `);

    // Create computed fields functions
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_customer_computed_fields()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update is_active
        NEW.is_active = CASE 
          WHEN NEW.status = 'active' AND NEW.is_deleted = false THEN true
          ELSE false
        END;
        
        -- Update is_high_value (customers with LTV > 10M IDR or high_value segment)
        NEW.is_high_value = CASE 
          WHEN NEW.lifetime_value > 10000000 OR NEW.segment = 'high_value' THEN true
          ELSE false
        END;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_update_customer_computed_fields
      BEFORE INSERT OR UPDATE ON customers
      FOR EACH ROW
      EXECUTE FUNCTION update_customer_computed_fields();
    `);

    // Create customer analytics update function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_customer_analytics_from_transaction()
      RETURNS TRIGGER AS $$
      DECLARE
        customer_record RECORD;
        first_order_date DATE;
        last_order_date DATE;
        total_orders_count INT;
        total_spent_amount DECIMAL(15,2);
        avg_order_value DECIMAL(15,2);
        days_since_last_order INT;
        days_since_first_order INT;
      BEGIN
        -- Get customer analytics data
        SELECT 
          MIN(transaction_date) as first_order,
          MAX(transaction_date) as last_order,
          COUNT(*) as order_count,
          SUM(total_amount) as total_amount,
          AVG(total_amount) as avg_amount
        INTO 
          first_order_date, last_order_date, total_orders_count, total_spent_amount, avg_order_value
        FROM customer_transactions 
        WHERE customer_id = NEW.customer_id 
          AND transaction_type = 'purchase' 
          AND status = 'completed'
          AND is_deleted = false;
        
        -- Calculate days since orders
        days_since_last_order = COALESCE(EXTRACT(DAY FROM (CURRENT_TIMESTAMP - last_order_date)), 0);
        days_since_first_order = COALESCE(EXTRACT(DAY FROM (CURRENT_TIMESTAMP - first_order_date)), 0);
        
        -- Update customer analytics
        UPDATE customers SET
          first_order_date = first_order_date,
          last_order_date = last_order_date,
          total_orders = COALESCE(total_orders_count, 0),
          total_spent = COALESCE(total_spent_amount, 0),
          average_order_value = COALESCE(avg_order_value, 0),
          lifetime_value = COALESCE(total_spent_amount, 0),
          days_since_last_order = days_since_last_order,
          days_since_first_order = days_since_first_order,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.customer_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_update_customer_analytics
      AFTER INSERT OR UPDATE ON customer_transactions
      FOR EACH ROW
      WHEN (NEW.transaction_type = 'purchase' AND NEW.status = 'completed')
      EXECUTE FUNCTION update_customer_analytics_from_transaction();
    `);

    console.log('Customer tables created successfully with analytics triggers');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_update_customer_analytics ON customer_transactions`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_update_customer_computed_fields ON customers`,
    );

    // Drop functions
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_customer_analytics_from_transaction()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_customer_computed_fields()`,
    );

    // Drop foreign keys
    const customersTable = await queryRunner.getTable('customers');
    const referredByForeignKey = customersTable.foreignKeys.find(
      fk => fk.columnNames.indexOf('referred_by') !== -1,
    );
    if (referredByForeignKey) {
      await queryRunner.dropForeignKey('customers', referredByForeignKey);
    }

    const transactionsTable = await queryRunner.getTable(
      'customer_transactions',
    );
    const customerForeignKey = transactionsTable.foreignKeys.find(
      fk => fk.columnNames.indexOf('customer_id') !== -1,
    );
    if (customerForeignKey) {
      await queryRunner.dropForeignKey(
        'customer_transactions',
        customerForeignKey,
      );
    }

    // Drop indexes for Customer Transactions
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_promotion_codes',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_categories',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_transaction_date_day_hour',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_customer_id_transaction_date',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_total_amount',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_payment_method',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_channel',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_type_status',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_transaction_date',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_transaction_number',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_order_id',
    );
    await queryRunner.dropIndex(
      'customer_transactions',
      'IDX_customer_transactions_tenant_id_customer_id',
    );

    // Drop indexes for Customer Segments
    await queryRunner.dropIndex(
      'customer_segments',
      'IDX_customer_segments_tenant_id_last_calculated',
    );
    await queryRunner.dropIndex(
      'customer_segments',
      'IDX_customer_segments_tenant_id_auto_assignment',
    );
    await queryRunner.dropIndex(
      'customer_segments',
      'IDX_customer_segments_tenant_id_segment_type',
    );
    await queryRunner.dropIndex(
      'customer_segments',
      'IDX_customer_segments_tenant_id_segment_name',
    );

    // Drop indexes for Customers
    await queryRunner.dropIndex('customers', 'IDX_customers_full_text_search');
    await queryRunner.dropIndex('customers', 'IDX_customers_tenant_id_tags');
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_account_manager',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_assigned_sales_rep',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_churn_probability',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_lifetime_value',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_last_order_date',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_created_at',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_lifecycle_stage',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_loyalty_tier',
    );
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_status_segment',
    );
    await queryRunner.dropIndex('customers', 'IDX_customers_tenant_id_phone');
    await queryRunner.dropIndex('customers', 'IDX_customers_tenant_id_email');
    await queryRunner.dropIndex(
      'customers',
      'IDX_customers_tenant_id_customer_number',
    );

    // Drop tables
    await queryRunner.dropTable('customer_transactions');
    await queryRunner.dropTable('customer_segments');
    await queryRunner.dropTable('customers');

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "customer_transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "customer_transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE "segment_type_enum"`);
    await queryRunner.query(`DROP TYPE "customer_lifecycle_stage_enum"`);
    await queryRunner.query(`DROP TYPE "loyalty_tier_enum"`);
    await queryRunner.query(`DROP TYPE "customer_segment_enum"`);
    await queryRunner.query(`DROP TYPE "customer_type_enum"`);
    await queryRunner.query(`DROP TYPE "customer_status_enum"`);
  }
}
