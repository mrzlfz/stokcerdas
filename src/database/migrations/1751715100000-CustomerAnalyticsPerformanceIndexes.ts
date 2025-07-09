import { MigrationInterface, QueryRunner } from 'typeorm';

// =============================================
// ULTRATHINK: COMPREHENSIVE CUSTOMER ANALYTICS PERFORMANCE OPTIMIZATION
// Database indexes untuk customer queries dan analytics dengan Indonesian business intelligence
// =============================================

export class CustomerAnalyticsPerformanceIndexes1751715100000
  implements MigrationInterface
{
  name = 'CustomerAnalyticsPerformanceIndexes1751715100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // ULTRATHINK: CUSTOMER ANALYTICS CORE INDEXES
    // Optimizing primary customer analytics queries
    // =============================================

    // Customer Analytics Primary Composite Index
    // Optimizes: tenant_id + segment + status + created_at queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_analytics_primary" 
      ON "customers" ("tenant_id", "segment", "status", "created_at" DESC)
    `);

    // Customer Lifetime Value Analytics Index
    // Optimizes: LTV calculations, high-value customer identification
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_ltv_analytics" 
      ON "customers" ("tenant_id", "lifetime_value" DESC, "loyalty_tier", "status")
      WHERE "lifetime_value" > 0
    `);

    // Customer Churn Risk Analytics Index
    // Optimizes: churn prediction, at-risk customer identification
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_churn_risk" 
      ON "customers" ("tenant_id", "churn_probability" DESC, "days_since_last_order", "retention_score")
      WHERE "churn_probability" >= 70
    `);

    // Customer Segmentation Performance Index
    // Optimizes: segment-based queries, behavioral analysis
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_segmentation" 
      ON "customers" ("tenant_id", "segment", "loyalty_tier", "average_order_frequency")
    `);

    // Customer Location Analytics Index (Indonesian Geographic Intelligence)
    // Optimizes: regional customer analysis, Indonesian market insights
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_location_analytics" 
      ON "customers" USING GIN ("tenant_id", "addresses")
    `);

    // Customer Preferences Analytics Index (Indonesian Business Context)
    // Optimizes: payment method preferences, channel preferences analysis
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_preferences_analytics" 
      ON "customers" USING GIN ("tenant_id", "preferences")
    `);

    // Customer Purchase Behavior Index (Indonesian Shopping Patterns)
    // Optimizes: purchase behavior analysis, seasonal patterns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_purchase_behavior" 
      ON "customers" USING GIN ("tenant_id", "purchase_behavior")
    `);

    // Customer Tags Performance Index (Business Intelligence Tagging)
    // Optimizes: tag-based customer queries, marketing segmentation
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_tags_performance" 
      ON "customers" USING GIN ("tenant_id", "tags")
    `);

    // =============================================
    // ULTRATHINK: CUSTOMER TRANSACTION ANALYTICS INDEXES
    // Optimizing transaction-based customer analytics
    // =============================================

    // Customer Transaction Analytics Primary Index
    // Optimizes: customer transaction history, revenue analytics
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_analytics" 
      ON "customer_transactions" ("tenant_id", "customer_id", "transaction_date" DESC, "total_amount")
    `);

    // Customer Transaction Frequency Analysis Index
    // Optimizes: purchase frequency calculations, RFM analysis
    // Note: Date filtering moved to query level for immutability compliance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_frequency" 
      ON "customer_transactions" ("tenant_id", "customer_id", "transaction_date" DESC)
    `);

    // Customer Transaction Channel Analytics Index
    // Optimizes: channel performance analysis, omnichannel insights
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_channel" 
      ON "customer_transactions" ("tenant_id", "channel", "transaction_date" DESC, "total_amount")
    `);

    // Customer Transaction Product Category Index
    // Optimizes: product affinity analysis, category preferences using array column
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_category" 
      ON "customer_transactions" USING GIN ("tenant_id", "categories")
    `);

    // Customer Transaction Payment Method Index (Indonesian Payment Intelligence)
    // Optimizes: payment method analytics, Indonesian payment behavior
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_payment" 
      ON "customer_transactions" ("tenant_id", "payment_method", "transaction_date" DESC, "total_amount")
    `);

    // Customer Transaction Seasonal Analytics Index (Indonesian Seasonal Patterns)
    // Optimizes: seasonal analysis (Ramadan, Lebaran, Christmas, etc.)
    // Note: Month extraction moved to query level for immutability compliance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_seasonal" 
      ON "customer_transactions" ("tenant_id", "transaction_date", "total_amount")
    `);

    // =============================================
    // ULTRATHINK: CUSTOMER COHORT ANALYTICS INDEXES
    // Optimizing cohort analysis and retention calculations
    // =============================================

    // Customer Cohort Base Index
    // Optimizes: cohort creation based on first order date
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_cohort_base" 
      ON "customers" ("tenant_id", "first_order_date", "status")
      WHERE "first_order_date" IS NOT NULL
    `);

    // Customer Retention Analytics Index
    // Optimizes: retention rate calculations, customer lifecycle analysis
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_retention_analytics" 
      ON "customers" ("tenant_id", "first_order_date", "last_order_date", "retention_score")
      WHERE "first_order_date" IS NOT NULL AND "last_order_date" IS NOT NULL
    `);

    // =============================================
    // ULTRATHINK: CUSTOMER SEARCH AND FILTER INDEXES
    // Optimizing customer search and advanced filtering
    // =============================================

    // Customer Full-Text Search Index (Indonesian Language Support)
    // Optimizes: customer name search, email search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_fulltext_search" 
      ON "customers" 
      USING GIN (to_tsvector('indonesian', COALESCE("full_name", '') || ' ' || COALESCE("email", '')))
    `);

    // Customer Phone Search Index (Indonesian Phone Numbers)
    // Optimizes: phone number search, contact management
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_phone_search" 
      ON "customers" ("tenant_id", "phone")
      WHERE "phone" IS NOT NULL
    `);

    // Customer External ID Index (Platform Integration)
    // Optimizes: external platform customer mapping (Shopee, Tokopedia, etc.)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_external_ids" 
      ON "customers" USING GIN ("tenant_id", "external_ids")
      WHERE "external_ids" IS NOT NULL
    `);

    // =============================================
    // ULTRATHINK: CUSTOMER ANALYTICS MATERIALIZED VIEW INDEXES
    // Optimizing materialized views for fast analytics
    // =============================================

    // Customer Monthly Analytics Index
    // Optimizes: monthly customer metrics aggregation
    // Note: Date truncation moved to query level for immutability compliance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_monthly_analytics" 
      ON "customer_transactions" ("tenant_id", "transaction_date", "customer_id")
    `);

    // Customer Product Affinity Index
    // Optimizes: product recommendation engine, cross-sell analytics using JSONB column
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_product_affinity" 
      ON "customer_transactions" USING GIN ("tenant_id", "products")
    `);

    // Customer Geographic Analytics Index (Indonesian Regional Intelligence)
    // Optimizes: regional performance analysis, Indonesian market segmentation
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_geographic_analytics" 
      ON "customers" ("tenant_id", (("addresses"->0)->>'city'), (("addresses"->0)->>'state'))
      WHERE "addresses" IS NOT NULL AND jsonb_array_length("addresses") > 0
    `);

    // =============================================
    // ULTRATHINK: PERFORMANCE MONITORING INDEXES
    // Indexes untuk monitoring database performance
    // =============================================

    // Customer Query Performance Monitoring Index
    // Optimizes: database performance monitoring, slow query identification
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_performance_monitoring" 
      ON "customers" ("tenant_id", "updated_at" DESC)
    `);

    // Customer Transaction Performance Monitoring Index
    // Optimizes: transaction query performance monitoring
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customer_transactions_performance" 
      ON "customer_transactions" ("tenant_id", "created_at" DESC)
    `);

    // =============================================
    // ULTRATHINK: SPECIALIZED INDONESIAN BUSINESS INDEXES
    // Business-specific indexes untuk Indonesian market
    // =============================================

    // Indonesian Cultural Context Index
    // Optimizes: cultural adaptation scoring, Indonesian market insights using custom_fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_indonesian_context" 
      ON "customers" USING GIN ("tenant_id", "custom_fields")
      WHERE "custom_fields" IS NOT NULL
    `);

    // Indonesian Payment Method Preference Index
    // Optimizes: payment method analytics (QRIS, GoPay, OVO, DANA, etc.)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_indonesian_payments" 
      ON "customers" USING GIN ("tenant_id", ("preferences"->'preferredPaymentMethods'))
    `);

    // Indonesian Religious Observance Index (Ramadan, Lebaran Analytics)
    // Optimizes: religious-based segmentation and seasonal marketing
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_religious_observance" 
      ON "customers" USING GIN ("tenant_id", ("purchase_behavior"->'seasonalPurchasePattern'))
    `);

    // Indonesian Regional Distribution Index
    // Optimizes: regional customer distribution analysis
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_regional_distribution" 
      ON "customers" ("tenant_id", (("addresses"->0)->>'state'), "segment")
      WHERE "addresses" IS NOT NULL AND jsonb_array_length("addresses") > 0
    `);

    // =============================================
    // ULTRATHINK: CUSTOMER ANALYTICS PERFORMANCE STATISTICS
    // Update table statistics untuk optimal query planning
    // =============================================

    // Update table statistics for optimal query planning
    await queryRunner.query(`ANALYZE "customers"`);
    await queryRunner.query(`ANALYZE "customer_transactions"`);

    // Set statistics targets for high-cardinality columns
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "tenant_id" SET STATISTICS 1000`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "segment" SET STATISTICS 1000`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "loyalty_tier" SET STATISTICS 1000`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_transactions" ALTER COLUMN "customer_id" SET STATISTICS 1000`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_transactions" ALTER COLUMN "channel" SET STATISTICS 1000`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // =============================================
    // ULTRATHINK: ROLLBACK CUSTOMER ANALYTICS INDEXES
    // Remove all performance indexes in reverse order
    // =============================================

    // Reset statistics targets
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "tenant_id" SET STATISTICS -1`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "segment" SET STATISTICS -1`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "loyalty_tier" SET STATISTICS -1`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_transactions" ALTER COLUMN "customer_id" SET STATISTICS -1`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_transactions" ALTER COLUMN "channel" SET STATISTICS -1`,
    );

    // Drop specialized Indonesian business indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_regional_distribution"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_religious_observance"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_indonesian_payments"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_indonesian_context"`,
    );

    // Drop performance monitoring indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_performance"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_performance_monitoring"`,
    );

    // Drop materialized view indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_geographic_analytics"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_product_affinity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_monthly_analytics"`,
    );

    // Drop search and filter indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_external_ids"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_phone_search"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_fulltext_search"`,
    );

    // Drop cohort analytics indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_retention_analytics"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_cohort_base"`);

    // Drop transaction analytics indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_seasonal"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_payment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_frequency"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_transactions_analytics"`,
    );

    // Drop core customer analytics indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_tags_performance"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_purchase_behavior"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_preferences_analytics"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_location_analytics"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_segmentation"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_churn_risk"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_ltv_analytics"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customers_analytics_primary"`,
    );
  }
}
