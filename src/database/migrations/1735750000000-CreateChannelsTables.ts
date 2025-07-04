import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChannelsTables1735750000000 implements MigrationInterface {
  name = 'CreateChannelsTables1735750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create channel enums
    await queryRunner.query(`
      CREATE TYPE "channel_type_enum" AS ENUM(
        'online_marketplace',
        'social_commerce', 
        'direct_online',
        'offline_store',
        'wholesale',
        'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "channel_status_enum" AS ENUM(
        'active',
        'inactive',
        'setup_pending',
        'suspended',
        'error'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "sync_strategy_enum" AS ENUM(
        'real_time',
        'scheduled',
        'manual',
        'webhook'
      )
    `);

    // Create channels table
    await queryRunner.query(`
      CREATE TABLE "channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "channel_type" "channel_type_enum" NOT NULL,
        "status" "channel_status_enum" NOT NULL DEFAULT 'setup_pending',
        "platform_id" varchar(50) NOT NULL,
        "platform_name" varchar(100) NOT NULL,
        "platform_url" varchar(255),
        "store_name" varchar(255),
        "store_id" varchar(100),
        "sync_strategy" "sync_strategy_enum" NOT NULL DEFAULT 'scheduled',
        "sync_frequency" varchar(50),
        "last_sync_at" timestamp,
        "next_sync_at" timestamp,
        "auto_sync" boolean NOT NULL DEFAULT true,
        "api_credentials" jsonb,
        "api_config" jsonb,
        "settings" jsonb,
        "metrics" jsonb,
        "last_error" text,
        "last_error_at" timestamp,
        "consecutive_errors" integer NOT NULL DEFAULT 0,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "enabled_at" timestamp,
        "disabled_at" timestamp,
        "disabled_reason" text,
        "logo" varchar(255),
        "color" varchar(20),
        "sort_order" integer NOT NULL DEFAULT 0,
        "tags" jsonb,
        "created_by" varchar NOT NULL,
        "updated_by" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channels" PRIMARY KEY ("id")
      )
    `);

    // Create channel_configs table
    await queryRunner.query(`
      CREATE TABLE "channel_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "channel_id" uuid NOT NULL,
        "webhook_config" jsonb,
        "sync_config" jsonb,
        "notification_config" jsonb,
        "advanced_settings" jsonb,
        "created_by" varchar NOT NULL,
        "updated_by" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_configs" PRIMARY KEY ("id")
      )
    `);

    // Create allocation strategy and status enums for channel_inventory
    await queryRunner.query(`
      CREATE TYPE "allocation_strategy_enum" AS ENUM(
        'percentage',
        'fixed_amount',
        'dynamic',
        'priority'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "allocation_status_enum" AS ENUM(
        'active',
        'paused',
        'out_of_stock',
        'discontinued'
      )
    `);

    // Create channel_inventory table
    await queryRunner.query(`
      CREATE TABLE "channel_inventory" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "channel_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "sku" varchar(100) NOT NULL,
        "allocation_strategy" "allocation_strategy_enum" NOT NULL DEFAULT 'percentage',
        "allocation_value" decimal(10,3) NOT NULL DEFAULT 0,
        "priority" integer NOT NULL DEFAULT 1,
        "allocated_quantity" integer NOT NULL DEFAULT 0,
        "reserved_quantity" integer NOT NULL DEFAULT 0,
        "available_quantity" integer NOT NULL DEFAULT 0,
        "buffer_stock" integer NOT NULL DEFAULT 0,
        "min_stock" integer NOT NULL DEFAULT 0,
        "max_stock" integer NOT NULL DEFAULT 0,
        "channel_price" decimal(15,2),
        "price_markup" decimal(5,2) NOT NULL DEFAULT 0,
        "discount_price" decimal(15,2),
        "discount_start_date" timestamp,
        "discount_end_date" timestamp,
        "status" "allocation_status_enum" NOT NULL DEFAULT 'active',
        "is_visible" boolean NOT NULL DEFAULT true,
        "auto_sync" boolean NOT NULL DEFAULT true,
        "allow_backorder" boolean NOT NULL DEFAULT false,
        "external_id" varchar(100),
        "external_sku" varchar(100),
        "channel_data" jsonb,
        "last_sync_at" timestamp,
        "last_price_sync_at" timestamp,
        "last_inventory_sync_at" timestamp,
        "sync_status" varchar(50),
        "sync_error" text,
        "sync_retry_count" integer NOT NULL DEFAULT 0,
        "metrics" jsonb,
        "last_stock_update_at" timestamp,
        "previous_quantity" integer,
        "notes" text,
        "created_by" varchar NOT NULL,
        "updated_by" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_inventory" PRIMARY KEY ("id")
      )
    `);

    // Create mapping enums for channel_mappings
    await queryRunner.query(`
      CREATE TYPE "mapping_type_enum" AS ENUM(
        'product',
        'category',
        'attribute',
        'order_status',
        'payment_method',
        'shipping_method',
        'customer',
        'location'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "mapping_direction_enum" AS ENUM(
        'bidirectional',
        'import_only',
        'export_only'
      )
    `);

    // Create channel_mappings table
    await queryRunner.query(`
      CREATE TABLE "channel_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "channel_id" uuid NOT NULL,
        "mapping_type" "mapping_type_enum" NOT NULL,
        "direction" "mapping_direction_enum" NOT NULL DEFAULT 'bidirectional',
        "internal_id" varchar(255) NOT NULL,
        "internal_value" varchar(255),
        "internal_data" jsonb,
        "external_id" varchar(255) NOT NULL,
        "external_value" varchar(255),
        "external_data" jsonb,
        "mapping_rules" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_verified" boolean NOT NULL DEFAULT false,
        "last_sync_at" timestamp,
        "last_verified_at" timestamp,
        "sync_status" varchar(50),
        "sync_error" text,
        "sync_count" integer NOT NULL DEFAULT 0,
        "error_count" integer NOT NULL DEFAULT 0,
        "internal_last_modified" timestamp,
        "external_last_modified" timestamp,
        "change_log" jsonb,
        "notes" text,
        "tags" jsonb,
        "priority" integer NOT NULL DEFAULT 0,
        "metrics" jsonb,
        "created_by" varchar NOT NULL,
        "updated_by" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_mappings" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for channels
    await queryRunner.query(`
      CREATE INDEX "IDX_channels_tenant_channel_type" 
      ON "channels" ("tenant_id", "channel_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channels_tenant_status" 
      ON "channels" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_channels_tenant_platform" 
      ON "channels" ("tenant_id", "platform_id") 
      WHERE "platform_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channels_sync_schedule" 
      ON "channels" ("next_sync_at") 
      WHERE "auto_sync" = true AND "status" = 'active'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channels_enabled" 
      ON "channels" ("is_enabled", "status")
    `);

    // Create indexes for channel_configs
    await queryRunner.query(`
      CREATE INDEX "IDX_channel_configs_tenant_id" 
      ON "channel_configs" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_configs_channel_id" 
      ON "channel_configs" ("channel_id")
    `);

    // Create indexes for channel_inventory
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_channel_inventory_tenant_channel_product" 
      ON "channel_inventory" ("tenant_id", "channel_id", "product_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_inventory_tenant_product" 
      ON "channel_inventory" ("tenant_id", "product_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_inventory_tenant_channel" 
      ON "channel_inventory" ("tenant_id", "channel_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_inventory_tenant_status" 
      ON "channel_inventory" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_inventory_sync_status" 
      ON "channel_inventory" ("sync_status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_inventory_auto_sync" 
      ON "channel_inventory" ("auto_sync", "status") 
      WHERE "auto_sync" = true AND "status" = 'active'
    `);

    // Create indexes for channel_mappings
    await queryRunner.query(`
      CREATE INDEX "IDX_channel_mappings_tenant_channel_type" 
      ON "channel_mappings" ("tenant_id", "channel_id", "mapping_type")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_channel_mappings_tenant_channel_internal" 
      ON "channel_mappings" ("tenant_id", "channel_id", "internal_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_channel_mappings_tenant_channel_external" 
      ON "channel_mappings" ("tenant_id", "channel_id", "external_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_mappings_sync_status" 
      ON "channel_mappings" ("sync_status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_channel_mappings_active" 
      ON "channel_mappings" ("is_active", "mapping_type")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "channel_configs" 
      ADD CONSTRAINT "FK_channel_configs_channel" 
      FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "channel_inventory" 
      ADD CONSTRAINT "FK_channel_inventory_channel" 
      FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "channel_mappings" 
      ADD CONSTRAINT "FK_channel_mappings_channel" 
      FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "channel_mappings" 
      DROP CONSTRAINT "FK_channel_mappings_channel"
    `);

    await queryRunner.query(`
      ALTER TABLE "channel_inventory" 
      DROP CONSTRAINT "FK_channel_inventory_channel"
    `);

    await queryRunner.query(`
      ALTER TABLE "channel_configs" 
      DROP CONSTRAINT "FK_channel_configs_channel"
    `);

    // Drop indexes for channel_mappings
    await queryRunner.query(`DROP INDEX "IDX_channel_mappings_active"`);
    await queryRunner.query(`DROP INDEX "IDX_channel_mappings_sync_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_channel_mappings_tenant_channel_external"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_channel_mappings_tenant_channel_internal"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_channel_mappings_tenant_channel_type"`,
    );

    // Drop indexes for channel_inventory
    await queryRunner.query(`DROP INDEX "IDX_channel_inventory_auto_sync"`);
    await queryRunner.query(`DROP INDEX "IDX_channel_inventory_sync_status"`);
    await queryRunner.query(`DROP INDEX "IDX_channel_inventory_tenant_status"`);
    await queryRunner.query(
      `DROP INDEX "IDX_channel_inventory_tenant_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_channel_inventory_tenant_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_channel_inventory_tenant_channel_product"`,
    );

    // Drop indexes for channel_configs
    await queryRunner.query(`DROP INDEX "IDX_channel_configs_channel_id"`);
    await queryRunner.query(`DROP INDEX "IDX_channel_configs_tenant_id"`);

    // Drop indexes for channels
    await queryRunner.query(`DROP INDEX "IDX_channels_enabled"`);
    await queryRunner.query(`DROP INDEX "IDX_channels_sync_schedule"`);
    await queryRunner.query(`DROP INDEX "IDX_channels_tenant_platform"`);
    await queryRunner.query(`DROP INDEX "IDX_channels_tenant_status"`);
    await queryRunner.query(`DROP INDEX "IDX_channels_tenant_channel_type"`);

    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE "channel_mappings"`);
    await queryRunner.query(`DROP TABLE "channel_inventory"`);
    await queryRunner.query(`DROP TABLE "channel_configs"`);
    await queryRunner.query(`DROP TABLE "channels"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "mapping_direction_enum"`);
    await queryRunner.query(`DROP TYPE "mapping_type_enum"`);
    await queryRunner.query(`DROP TYPE "allocation_status_enum"`);
    await queryRunner.query(`DROP TYPE "allocation_strategy_enum"`);
    await queryRunner.query(`DROP TYPE "sync_strategy_enum"`);
    await queryRunner.query(`DROP TYPE "channel_status_enum"`);
    await queryRunner.query(`DROP TYPE "channel_type_enum"`);
  }
}
