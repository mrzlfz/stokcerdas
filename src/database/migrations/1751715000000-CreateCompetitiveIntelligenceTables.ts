import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompetitiveIntelligenceTables1751715000000
  implements MigrationInterface
{
  name = 'CreateCompetitiveIntelligenceTables1751715000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUMs for competitive intelligence
    await queryRunner.query(`
      CREATE TYPE "marketplace_type_enum" AS ENUM(
        'tokopedia',
        'shopee', 
        'lazada',
        'bukalapak',
        'blibli',
        'orami',
        'zalora',
        'offline_store',
        'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "competitive_product_status_enum" AS ENUM(
        'active',
        'inactive',
        'out_of_stock',
        'discontinued',
        'restricted',
        'unknown'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "data_quality_enum" AS ENUM(
        'high',
        'medium',
        'low',
        'unreliable'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "price_change_reason_enum" AS ENUM(
        'promotion',
        'discount',
        'flash_sale',
        'price_adjustment',
        'seasonal_change',
        'competition_response',
        'stock_clearance',
        'new_product_launch',
        'supply_chain_impact',
        'market_fluctuation',
        'automatic_repricing',
        'unknown'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "price_event_type_enum" AS ENUM(
        'price_increase',
        'price_decrease',
        'discount_applied',
        'discount_removed',
        'out_of_stock',
        'back_in_stock',
        'new_variant_added',
        'variant_removed',
        'shipping_change',
        'promotion_start',
        'promotion_end'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "analysis_type_enum" AS ENUM(
        'price_analysis',
        'market_share_analysis',
        'performance_analysis',
        'trend_analysis',
        'competitor_positioning',
        'promotional_analysis',
        'seasonal_analysis',
        'product_feature_comparison',
        'brand_sentiment_analysis',
        'supply_chain_analysis'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "analysis_status_enum" AS ENUM(
        'pending',
        'in_progress',
        'completed',
        'failed',
        'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "competitive_advantage_enum" AS ENUM(
        'price_advantage',
        'quality_advantage',
        'brand_advantage',
        'availability_advantage',
        'service_advantage',
        'feature_advantage',
        'shipping_advantage',
        'rating_advantage',
        'no_clear_advantage',
        'multiple_advantages'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "competitive_risk_level_enum" AS ENUM(
        'low',
        'medium',
        'high',
        'critical'
      )
    `);

    // Create competitive_products table
    await queryRunner.query(`
      CREATE TABLE "competitive_products" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "ourProductId" uuid,
        "externalProductId" varchar(255) NOT NULL,
        "externalSku" varchar(255),
        "marketplace" "marketplace_type_enum" NOT NULL,
        "sellerId" varchar(255),
        "sellerName" varchar(500),
        "sellerRating" decimal(5,2),
        "sellerReviewCount" integer,
        "name" varchar(1000) NOT NULL,
        "description" text,
        "brand" varchar(255),
        "category" varchar(500),
        "subcategory" varchar(500),
        "tags" jsonb,
        "currentPrice" decimal(15,2) NOT NULL,
        "originalPrice" decimal(15,2),
        "discountPercent" decimal(5,2),
        "minOrderQty" integer DEFAULT 1,
        "currency" varchar(3) DEFAULT 'IDR',
        "status" "competitive_product_status_enum" DEFAULT 'active',
        "stockQuantity" integer,
        "stockLocation" varchar(255),
        "unlimitedStock" boolean DEFAULT false,
        "soldCount" integer,
        "viewCount" integer,
        "likeCount" integer,
        "rating" decimal(3,2),
        "reviewCount" integer,
        "shippingCost" decimal(10,2),
        "freeShippingThreshold" decimal(15,2),
        "deliveryTimeDays" integer,
        "shippingMethods" jsonb,
        "primaryImageUrl" text,
        "imageUrls" jsonb,
        "videoUrls" jsonb,
        "attributes" jsonb,
        "variants" jsonb,
        "isDirectCompetitor" boolean DEFAULT false,
        "threatLevel" integer,
        "marketRanking" integer,
        "marketShare" decimal(5,2),
        "dataQuality" "data_quality_enum" DEFAULT 'medium',
        "lastUpdated" timestamp,
        "lastChecked" timestamp,
        "failedChecks" integer DEFAULT 0,
        "lastError" text,
        "checkInterval" integer DEFAULT 1440,
        "monitoringEnabled" boolean DEFAULT true,
        "monitoringPriority" integer DEFAULT 5,
        "region" varchar(100),
        "availableCities" jsonb,
        "businessLicense" jsonb,
        "metadata" jsonb,
        "notes" text,
        "internalTags" jsonb,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create competitive_price_history table
    await queryRunner.query(`
      CREATE TABLE "competitive_price_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "competitiveProductId" uuid NOT NULL,
        "currentPrice" decimal(15,2) NOT NULL,
        "previousPrice" decimal(15,2),
        "originalPrice" decimal(15,2),
        "priceChange" decimal(15,2),
        "priceChangePercent" decimal(8,4),
        "discountPercent" decimal(5,2),
        "currency" varchar(3) DEFAULT 'IDR',
        "stockQuantity" integer,
        "previousStockQuantity" integer,
        "stockChange" integer,
        "inStock" boolean DEFAULT true,
        "unlimitedStock" boolean DEFAULT false,
        "eventType" "price_event_type_enum",
        "priceChangeReason" "price_change_reason_enum" DEFAULT 'unknown',
        "isPromotion" boolean DEFAULT false,
        "promotionName" varchar(500),
        "promotionStart" timestamp,
        "promotionEnd" timestamp,
        "rating" decimal(3,2),
        "reviewCount" integer,
        "soldCount" integer,
        "viewCount" integer,
        "performanceChanges" jsonb,
        "shippingCost" decimal(10,2),
        "previousShippingCost" decimal(10,2),
        "freeShippingThreshold" decimal(15,2),
        "deliveryTimeDays" integer,
        "competitorPriceRange" jsonb,
        "marketPosition" integer,
        "pricePercentile" decimal(5,2),
        "autoDetected" boolean DEFAULT true,
        "detectionConfidence" decimal(3,2) DEFAULT 1.0,
        "detectionMethod" varchar(100),
        "detectionLatency" integer,
        "dataReliability" decimal(3,2) DEFAULT 1.0,
        "dataQualityIssues" jsonb,
        "rawDataSnapshot" jsonb,
        "isBusinessDay" boolean DEFAULT true,
        "timezone" varchar(50) DEFAULT 'Asia/Jakarta',
        "hourOfDay" integer NOT NULL,
        "dayOfWeek" integer NOT NULL,
        "holidayContext" varchar(255),
        "isRamadanPeriod" boolean DEFAULT false,
        "shortTermTrend" varchar(20),
        "mediumTermTrend" varchar(20),
        "longTermTrend" varchar(20),
        "volatilityScore" decimal(3,2),
        "metadata" jsonb,
        "notes" text,
        "recordedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create competitive_analyses table
    await queryRunner.query(`
      CREATE TABLE "competitive_analyses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "competitiveProductId" uuid NOT NULL,
        "analysisType" "analysis_type_enum" NOT NULL,
        "analysisStatus" "analysis_status_enum" DEFAULT 'pending',
        "analysisDate" timestamp DEFAULT CURRENT_TIMESTAMP,
        "dataStartDate" timestamp,
        "dataEndDate" timestamp,
        "nextAnalysisDate" timestamp,
        "competitiveAdvantage" "competitive_advantage_enum",
        "overallThreatLevel" integer,
        "riskLevel" "competitive_risk_level_enum",
        "marketRanking" integer,
        "marketShare" decimal(5,2),
        "priceAnalysis" jsonb,
        "performanceAnalysis" jsonb,
        "marketAnalysis" jsonb,
        "featureAnalysis" jsonb,
        "promotionalAnalysis" jsonb,
        "sentimentAnalysis" jsonb,
        "supplyChainAnalysis" jsonb,
        "trendAnalysis" jsonb,
        "strategicInsights" jsonb,
        "indonesianMarketContext" jsonb,
        "confidenceScore" integer DEFAULT 80,
        "dataCompleteness" decimal(5,2) DEFAULT 100.0,
        "dataSources" jsonb,
        "methodology" varchar(255),
        "limitations" jsonb,
        "processingTime" integer,
        "algorithmVersion" varchar(50),
        "analysisErrors" jsonb,
        "analysisWarnings" jsonb,
        "actionItems" jsonb,
        "kpisToMonitor" jsonb,
        "isAutomated" boolean DEFAULT true,
        "analysisSchedule" varchar(100),
        "analysisTriggers" jsonb,
        "metadata" jsonb,
        "notes" text,
        "tags" jsonb,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for competitive_products
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_competitive_products_tenant_marketplace_external" ON "competitive_products" ("tenantId", "marketplace", "externalProductId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_tenant_our_product" ON "competitive_products" ("tenantId", "ourProductId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_tenant_marketplace_status" ON "competitive_products" ("tenantId", "marketplace", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_tenant_category_marketplace" ON "competitive_products" ("tenantId", "category", "marketplace")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_tenant_brand_marketplace" ON "competitive_products" ("tenantId", "brand", "marketplace")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_price_marketplace" ON "competitive_products" ("currentPrice", "marketplace")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_last_updated" ON "competitive_products" ("lastUpdated")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_data_quality_status" ON "competitive_products" ("dataQuality", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_products_tenant_id" ON "competitive_products" ("tenantId")`,
    );

    // Create indexes for competitive_price_history
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_tenant_product_recorded" ON "competitive_price_history" ("tenantId", "competitiveProductId", "recordedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_tenant_product_change" ON "competitive_price_history" ("tenantId", "competitiveProductId", "priceChange")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_recorded_at" ON "competitive_price_history" ("recordedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_price_change_percent" ON "competitive_price_history" ("priceChangePercent")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_event_type" ON "competitive_price_history" ("eventType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_price_change_reason" ON "competitive_price_history" ("priceChangeReason")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_price_history_tenant_id" ON "competitive_price_history" ("tenantId")`,
    );

    // Create indexes for competitive_analyses
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_tenant_product_type" ON "competitive_analyses" ("tenantId", "competitiveProductId", "analysisType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_tenant_status" ON "competitive_analyses" ("tenantId", "analysisStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_tenant_threat_level" ON "competitive_analyses" ("tenantId", "overallThreatLevel")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_analysis_date" ON "competitive_analyses" ("analysisDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_next_analysis_date" ON "competitive_analyses" ("nextAnalysisDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_competitive_advantage" ON "competitive_analyses" ("competitiveAdvantage")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_competitive_analyses_tenant_id" ON "competitive_analyses" ("tenantId")`,
    );

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "competitive_products" 
      ADD CONSTRAINT "FK_competitive_products_our_product" 
      FOREIGN KEY ("ourProductId") REFERENCES "products"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_price_history" 
      ADD CONSTRAINT "FK_competitive_price_history_competitive_product" 
      FOREIGN KEY ("competitiveProductId") REFERENCES "competitive_products"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_analyses" 
      ADD CONSTRAINT "FK_competitive_analyses_competitive_product" 
      FOREIGN KEY ("competitiveProductId") REFERENCES "competitive_products"("id") ON DELETE CASCADE
    `);

    // Add check constraints for data integrity
    await queryRunner.query(`
      ALTER TABLE "competitive_products" 
      ADD CONSTRAINT "CHK_competitive_products_current_price_positive" 
      CHECK ("currentPrice" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_products" 
      ADD CONSTRAINT "CHK_competitive_products_threat_level_range" 
      CHECK ("threatLevel" IS NULL OR ("threatLevel" >= 1 AND "threatLevel" <= 10))
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_products" 
      ADD CONSTRAINT "CHK_competitive_products_market_ranking_positive" 
      CHECK ("marketRanking" IS NULL OR "marketRanking" >= 1)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_products" 
      ADD CONSTRAINT "CHK_competitive_products_rating_range" 
      CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5))
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_products" 
      ADD CONSTRAINT "CHK_competitive_products_monitoring_priority_range" 
      CHECK ("monitoringPriority" >= 1 AND "monitoringPriority" <= 10)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_price_history" 
      ADD CONSTRAINT "CHK_competitive_price_history_current_price_positive" 
      CHECK ("currentPrice" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_price_history" 
      ADD CONSTRAINT "CHK_competitive_price_history_hour_range" 
      CHECK ("hourOfDay" >= 0 AND "hourOfDay" <= 23)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_price_history" 
      ADD CONSTRAINT "CHK_competitive_price_history_day_range" 
      CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_analyses" 
      ADD CONSTRAINT "CHK_competitive_analyses_threat_level_range" 
      CHECK ("overallThreatLevel" IS NULL OR ("overallThreatLevel" >= 0 AND "overallThreatLevel" <= 100))
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_analyses" 
      ADD CONSTRAINT "CHK_competitive_analyses_confidence_score_range" 
      CHECK ("confidenceScore" >= 0 AND "confidenceScore" <= 100)
    `);

    await queryRunner.query(`
      ALTER TABLE "competitive_analyses" 
      ADD CONSTRAINT "CHK_competitive_analyses_data_completeness_range" 
      CHECK ("dataCompleteness" >= 0 AND "dataCompleteness" <= 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "competitive_analyses" DROP CONSTRAINT "FK_competitive_analyses_competitive_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "competitive_price_history" DROP CONSTRAINT "FK_competitive_price_history_competitive_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "competitive_products" DROP CONSTRAINT "FK_competitive_products_our_product"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "competitive_analyses"`);
    await queryRunner.query(`DROP TABLE "competitive_price_history"`);
    await queryRunner.query(`DROP TABLE "competitive_products"`);

    // Drop ENUMs
    await queryRunner.query(`DROP TYPE "competitive_risk_level_enum"`);
    await queryRunner.query(`DROP TYPE "competitive_advantage_enum"`);
    await queryRunner.query(`DROP TYPE "analysis_status_enum"`);
    await queryRunner.query(`DROP TYPE "analysis_type_enum"`);
    await queryRunner.query(`DROP TYPE "price_event_type_enum"`);
    await queryRunner.query(`DROP TYPE "price_change_reason_enum"`);
    await queryRunner.query(`DROP TYPE "data_quality_enum"`);
    await queryRunner.query(`DROP TYPE "competitive_product_status_enum"`);
    await queryRunner.query(`DROP TYPE "marketplace_type_enum"`);
  }
}
