import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerAnalyticsViews1735940000000
  implements MigrationInterface
{
  name = 'CreateCustomerAnalyticsViews1735940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Customer Analytics Summary materialized view
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW customer_analytics_summary AS
      SELECT 
        c.id as customer_id,
        c.tenant_id,
        c.customer_number,
        c.full_name,
        c.email,
        c.segment,
        c.loyalty_tier,
        c.status,
        c.created_at as customer_since,
        
        -- Transaction Analytics
        COALESCE(ta.total_transactions, 0) as total_transactions,
        COALESCE(ta.total_amount, 0) as total_spent,
        COALESCE(ta.average_order_value, 0) as average_order_value,
        COALESCE(ta.last_transaction_date, NULL) as last_transaction_date,
        COALESCE(ta.first_transaction_date, NULL) as first_transaction_date,
        
        -- Time-based Analytics
        CASE 
          WHEN ta.last_transaction_date IS NULL THEN 0
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ta.last_transaction_date))
        END as days_since_last_transaction,
        
        CASE 
          WHEN ta.first_transaction_date IS NULL THEN 0
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ta.first_transaction_date))
        END as days_since_first_transaction,
        
        -- Frequency Analytics
        CASE 
          WHEN ta.first_transaction_date IS NULL OR ta.last_transaction_date IS NULL THEN 0
          WHEN ta.first_transaction_date = ta.last_transaction_date THEN 0
          ELSE COALESCE(ta.total_transactions, 0) / GREATEST(1, 
            EXTRACT(DAY FROM (ta.last_transaction_date - ta.first_transaction_date)) / 30.0
          )
        END as monthly_transaction_frequency,
        
        -- Channel Analytics
        ta.primary_channel,
        ta.channel_count,
        
        -- Product Analytics
        ta.product_categories,
        ta.unique_products_purchased,
        
        -- Payment Analytics  
        ta.primary_payment_method,
        ta.payment_methods_used,
        
        -- Seasonal Analytics
        ta.peak_shopping_hour,
        ta.peak_shopping_day,
        ta.weekend_transaction_ratio,
        
        -- Value Analytics
        CASE 
          WHEN COALESCE(ta.total_amount, 0) > 50000000 THEN 'high_value'
          WHEN COALESCE(ta.total_amount, 0) > 10000000 THEN 'medium_value'
          ELSE 'standard_value'
        END as value_segment,
        
        -- Churn Risk Analytics
        CASE 
          WHEN ta.last_transaction_date IS NULL THEN 100
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ta.last_transaction_date)) > 365 THEN 90
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ta.last_transaction_date)) > 180 THEN 70
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ta.last_transaction_date)) > 90 THEN 40
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ta.last_transaction_date)) > 30 THEN 20
          ELSE 10
        END as churn_risk_score,
        
        -- Refresh metadata
        CURRENT_TIMESTAMP as last_updated
        
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id,
          COUNT(*) as total_transactions,
          SUM(total_amount) as total_amount,
          AVG(total_amount) as average_order_value,
          MIN(transaction_date) as first_transaction_date,
          MAX(transaction_date) as last_transaction_date,
          
          -- Channel Analytics
          MODE() WITHIN GROUP (ORDER BY channel) as primary_channel,
          COUNT(DISTINCT channel) as channel_count,
          
          -- Product Analytics
          array_to_string(array_agg(DISTINCT category_item ORDER BY category_item), ',') as product_categories,
          COUNT(DISTINCT products->>'id') as unique_products_purchased,
          
          -- Payment Analytics
          MODE() WITHIN GROUP (ORDER BY payment_method) as primary_payment_method,
          COUNT(DISTINCT payment_method) as payment_methods_used,
          
          -- Time Analytics
          MODE() WITHIN GROUP (ORDER BY hour_of_day) as peak_shopping_hour,
          MODE() WITHIN GROUP (ORDER BY day_of_week) as peak_shopping_day,
          
          -- Weekend behavior
          SUM(CASE WHEN is_weekend = true THEN 1 ELSE 0 END)::DECIMAL / 
          GREATEST(1, COUNT(*)) as weekend_transaction_ratio
          
        FROM customer_transactions ct
        LEFT JOIN LATERAL unnest(COALESCE(ct.categories, ARRAY[]::varchar[])) AS category_item ON true
        WHERE ct.transaction_type = 'purchase' 
          AND ct.status = 'completed'
          AND ct.is_deleted = false
        GROUP BY customer_id
      ) ta ON c.id = ta.customer_id
      WHERE c.is_deleted = false;
    `);

    // Create indexes on the materialized view
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_customer_analytics_summary_customer_id 
      ON customer_analytics_summary (customer_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customer_analytics_summary_tenant_segment 
      ON customer_analytics_summary (tenant_id, segment, value_segment);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customer_analytics_summary_churn_risk 
      ON customer_analytics_summary (tenant_id, churn_risk_score DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customer_analytics_summary_transaction_frequency 
      ON customer_analytics_summary (tenant_id, monthly_transaction_frequency DESC);
    `);

    // Create Customer Transaction Daily Aggregation
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW customer_transaction_daily_summary AS
      SELECT 
        ct.tenant_id,
        ct.customer_id,
        DATE(ct.transaction_date) as transaction_date,
        
        -- Transaction Metrics
        COUNT(DISTINCT ct.id) as transaction_count,
        SUM(ct.total_amount) as daily_total,
        AVG(ct.total_amount) as daily_avg_order_value,
        MAX(ct.total_amount) as daily_max_order,
        MIN(ct.total_amount) as daily_min_order,
        
        -- Product Metrics
        SUM(ct.quantity) as total_quantity,
        COUNT(DISTINCT ct.products->>'id') as unique_products,
        array_agg(DISTINCT category_item) FILTER (WHERE category_item IS NOT NULL AND category_item != '') as categories_purchased,
        
        -- Channel Metrics
        COUNT(DISTINCT ct.channel) as channels_used,
        array_agg(DISTINCT ct.channel) FILTER (WHERE ct.channel IS NOT NULL) as channels,
        
        -- Payment Metrics
        COUNT(DISTINCT ct.payment_method) as payment_methods_used,
        array_agg(DISTINCT ct.payment_method) FILTER (WHERE ct.payment_method IS NOT NULL) as payment_methods,
        
        -- Discount & Profit Analytics
        SUM(ct.discount_amount) as total_discounts,
        AVG(ct.profit_margin) as avg_profit_margin,
        SUM(ct.cost_of_goods) as total_cogs,
        
        -- Time Analytics
        array_agg(DISTINCT ct.hour_of_day ORDER BY ct.hour_of_day) as shopping_hours,
        bool_or(ct.is_weekend) as included_weekend,
        bool_or(ct.is_holiday) as included_holiday,
        
        -- Loyalty Analytics
        SUM(ct.loyalty_points_earned) as loyalty_points_earned,
        SUM(ct.loyalty_points_redeemed) as loyalty_points_redeemed,
        
        CURRENT_TIMESTAMP as last_updated
        
      FROM customer_transactions ct
      LEFT JOIN LATERAL unnest(COALESCE(ct.categories, ARRAY[]::varchar[])) AS category_item ON true
      WHERE ct.transaction_type = 'purchase' 
        AND ct.status = 'completed'
        AND ct.is_deleted = false
      GROUP BY ct.tenant_id, ct.customer_id, DATE(ct.transaction_date);
    `);

    // Create indexes for daily summary
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_customer_transaction_daily_summary_unique 
      ON customer_transaction_daily_summary (tenant_id, customer_id, transaction_date);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customer_transaction_daily_summary_date_range 
      ON customer_transaction_daily_summary (tenant_id, transaction_date DESC);
    `);

    // Create Customer Cohort Analysis View
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW customer_cohort_analysis AS
      SELECT 
        tenant_id,
        DATE_TRUNC('month', first_transaction_date) as cohort_month,
        
        -- Cohort Size
        COUNT(DISTINCT customer_id) as cohort_size,
        
        -- Retention Analysis (for each subsequent month)
        COUNT(DISTINCT CASE WHEN months_since_first = 0 THEN customer_id END) as month_0_active,
        COUNT(DISTINCT CASE WHEN months_since_first = 1 THEN customer_id END) as month_1_active,
        COUNT(DISTINCT CASE WHEN months_since_first = 2 THEN customer_id END) as month_2_active,
        COUNT(DISTINCT CASE WHEN months_since_first = 3 THEN customer_id END) as month_3_active,
        COUNT(DISTINCT CASE WHEN months_since_first = 6 THEN customer_id END) as month_6_active,
        COUNT(DISTINCT CASE WHEN months_since_first = 12 THEN customer_id END) as month_12_active,
        
        -- Revenue Analysis
        SUM(CASE WHEN months_since_first = 0 THEN total_amount ELSE 0 END) as month_0_revenue,
        SUM(CASE WHEN months_since_first = 1 THEN total_amount ELSE 0 END) as month_1_revenue,
        SUM(CASE WHEN months_since_first = 2 THEN total_amount ELSE 0 END) as month_2_revenue,
        SUM(CASE WHEN months_since_first = 3 THEN total_amount ELSE 0 END) as month_3_revenue,
        SUM(CASE WHEN months_since_first = 6 THEN total_amount ELSE 0 END) as month_6_revenue,
        SUM(CASE WHEN months_since_first = 12 THEN total_amount ELSE 0 END) as month_12_revenue,
        
        CURRENT_TIMESTAMP as last_updated
        
      FROM (
        SELECT 
          ct.tenant_id,
          ct.customer_id,
          cas.first_transaction_date,
          ct.transaction_date,
          ct.total_amount,
          EXTRACT(YEAR FROM AGE(ct.transaction_date, cas.first_transaction_date)) * 12 + 
          EXTRACT(MONTH FROM AGE(ct.transaction_date, cas.first_transaction_date)) as months_since_first
        FROM customer_transactions ct
        JOIN customer_analytics_summary cas ON ct.customer_id = cas.customer_id
        WHERE ct.transaction_type = 'purchase' 
          AND ct.status = 'completed'
          AND ct.is_deleted = false
          AND cas.first_transaction_date IS NOT NULL
      ) cohort_data
      GROUP BY tenant_id, DATE_TRUNC('month', first_transaction_date);
    `);

    // Create Product Affinity Analysis View
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW customer_product_affinity AS
      SELECT 
        ct.tenant_id,
        ct.customer_id,
        category,
        
        -- Purchase Metrics
        COUNT(DISTINCT ct.id) as purchase_count,
        SUM(ct.total_amount) as total_spent_category,
        AVG(ct.total_amount) as avg_order_value_category,
        MAX(ct.transaction_date) as last_purchase_date,
        MIN(ct.transaction_date) as first_purchase_date,
        
        -- Frequency Metrics
        COUNT(DISTINCT ct.id) / GREATEST(1, EXTRACT(DAY FROM (MAX(ct.transaction_date) - MIN(ct.transaction_date))) / 30.0) as monthly_purchase_frequency,
        
        -- Share of Wallet
        SUM(ct.total_amount) / GREATEST(1, (
          SELECT SUM(total_amount) 
          FROM customer_transactions ct2 
          WHERE ct2.customer_id = ct.customer_id 
            AND ct2.transaction_type = 'purchase' 
            AND ct2.status = 'completed'
            AND ct2.is_deleted = false
        )) as category_share_of_wallet,
        
        CURRENT_TIMESTAMP as last_updated
        
      FROM customer_transactions ct
      LEFT JOIN LATERAL unnest(COALESCE(ct.categories, ARRAY[]::varchar[])) AS category ON true
      WHERE ct.transaction_type = 'purchase' 
        AND ct.status = 'completed'
        AND ct.is_deleted = false
        AND category IS NOT NULL
        AND category != ''
      GROUP BY ct.tenant_id, ct.customer_id, category;
    `);

    // Create refresh function for materialized views
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_customer_analytics()
      RETURNS VOID AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW customer_analytics_summary;
        REFRESH MATERIALIZED VIEW customer_transaction_daily_summary;
        REFRESH MATERIALIZED VIEW customer_cohort_analysis;
        REFRESH MATERIALIZED VIEW customer_product_affinity;
        
        -- Update refresh log
        INSERT INTO analytics_refresh_log (view_name, refreshed_at, duration_ms)
        VALUES 
          ('customer_analytics_summary', CURRENT_TIMESTAMP, 0),
          ('customer_transaction_daily_summary', CURRENT_TIMESTAMP, 0),
          ('customer_cohort_analysis', CURRENT_TIMESTAMP, 0),
          ('customer_product_affinity', CURRENT_TIMESTAMP, 0);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create analytics refresh log table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics_refresh_log (
        id SERIAL PRIMARY KEY,
        view_name VARCHAR(255) NOT NULL,
        refreshed_at TIMESTAMP WITH TIME ZONE NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index for refresh log
    await queryRunner.query(`
      CREATE INDEX idx_analytics_refresh_log_view_date 
      ON analytics_refresh_log (view_name, refreshed_at DESC);
    `);

    // Create trigger for automatic view refresh on transaction changes
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trigger_refresh_customer_analytics()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Schedule async refresh (this would be handled by a background job in production)
        INSERT INTO analytics_refresh_queue (view_names, scheduled_at, priority)
        VALUES (
          ARRAY['customer_analytics_summary', 'customer_transaction_daily_summary'],
          CURRENT_TIMESTAMP + INTERVAL '5 minutes',
          CASE 
            WHEN TG_OP = 'INSERT' THEN 'high'
            WHEN TG_OP = 'UPDATE' THEN 'medium'
            ELSE 'low'
          END
        )
        ON CONFLICT (view_names, scheduled_at) DO NOTHING;
        
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create refresh queue table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analytics_refresh_queue (
        id SERIAL PRIMARY KEY,
        view_names TEXT[] NOT NULL,
        scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        processed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(view_names, scheduled_at)
      );
    `);

    // Attach trigger to customer_transactions table
    await queryRunner.query(`
      CREATE TRIGGER trigger_customer_transaction_analytics_refresh
      AFTER INSERT OR UPDATE OR DELETE ON customer_transactions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_refresh_customer_analytics();
    `);

    // Initial refresh of all views
    await queryRunner.query(`SELECT refresh_customer_analytics();`);

    console.log('Customer analytics aggregated views created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_customer_transaction_analytics_refresh ON customer_transactions;`,
    );

    // Drop functions
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS trigger_refresh_customer_analytics();`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS refresh_customer_analytics();`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_refresh_queue;`);
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_refresh_log;`);

    // Drop materialized views
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS customer_product_affinity;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS customer_cohort_analysis;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS customer_transaction_daily_summary;`,
    );
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS customer_analytics_summary;`,
    );

    console.log('Customer analytics views rollback completed');
  }
}
