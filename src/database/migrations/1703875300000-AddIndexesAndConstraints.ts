import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesAndConstraints1703875300000
  implements MigrationInterface
{
  name = 'AddIndexesAndConstraints1703875300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "product_categories" 
      ADD CONSTRAINT "FK_product_categories_parent" 
      FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD CONSTRAINT "FK_products_category" 
      FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "product_variants" 
      ADD CONSTRAINT "FK_product_variants_product" 
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_locations" 
      ADD CONSTRAINT "FK_inventory_locations_parent" 
      FOREIGN KEY ("parentId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD CONSTRAINT "FK_inventory_items_product" 
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD CONSTRAINT "FK_inventory_items_location" 
      FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_product" 
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_location" 
      FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_inventory_item" 
      FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_source_location" 
      FOREIGN KEY ("sourceLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_destination_location" 
      FOREIGN KEY ("destinationLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_processed_by" 
      FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_cancelled_by" 
      FOREIGN KEY ("cancelledBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_transactions" 
      ADD CONSTRAINT "FK_inventory_transactions_related_transaction" 
      FOREIGN KEY ("relatedTransactionId") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL
    `);

    // Add unique constraints
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_tenant_email" 
      ON "users" ("tenant_id", "email") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_product_categories_tenant_name" 
      ON "product_categories" ("tenant_id", "name")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_products_tenant_sku" 
      ON "products" ("tenant_id", "sku") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_products_tenant_barcode" 
      ON "products" ("tenant_id", "barcode") 
      WHERE "barcode" IS NOT NULL AND "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_product_variants_tenant_sku" 
      ON "product_variants" ("tenant_id", "sku")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_inventory_locations_tenant_code" 
      ON "inventory_locations" ("tenant_id", "code") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_inventory_items_tenant_product_location" 
      ON "inventory_items" ("tenant_id", "productId", "locationId")
    `);

    // Add performance indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_users_tenant_status" 
      ON "users" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_tenant_role" 
      ON "users" ("tenant_id", "role")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_tenant_deleted" 
      ON "users" ("tenant_id", "isDeleted")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_products_tenant_status" 
      ON "products" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_products_tenant_category" 
      ON "products" ("tenant_id", "categoryId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_products_tenant_deleted" 
      ON "products" ("tenant_id", "isDeleted")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_product_variants_tenant_product" 
      ON "product_variants" ("tenant_id", "productId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_locations_tenant_type" 
      ON "inventory_locations" ("tenant_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_locations_tenant_status" 
      ON "inventory_locations" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_locations_tenant_deleted" 
      ON "inventory_locations" ("tenant_id", "isDeleted")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_items_tenant_location" 
      ON "inventory_items" ("tenant_id", "locationId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_items_tenant_product" 
      ON "inventory_items" ("tenant_id", "productId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_items_tenant_quantity" 
      ON "inventory_items" ("tenant_id", "quantityOnHand")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_transactions_tenant_product" 
      ON "inventory_transactions" ("tenant_id", "productId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_transactions_tenant_location" 
      ON "inventory_transactions" ("tenant_id", "locationId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_transactions_tenant_type" 
      ON "inventory_transactions" ("tenant_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_transactions_tenant_status" 
      ON "inventory_transactions" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_transactions_tenant_date" 
      ON "inventory_transactions" ("tenant_id", "transactionDate")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inventory_transactions_tenant_reference" 
      ON "inventory_transactions" ("tenant_id", "referenceType", "referenceId")
    `);

    // Add trigger to automatically update updated_at timestamp
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Apply trigger to all tables
    const tables = [
      'users',
      'product_categories',
      'products',
      'product_variants',
      'inventory_locations',
      'inventory_items',
      'inventory_transactions',
    ];

    for (const table of tables) {
      await queryRunner.query(`
        CREATE TRIGGER update_${table}_updated_at 
        BEFORE UPDATE ON "${table}" 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    const tables = [
      'users',
      'product_categories',
      'products',
      'product_variants',
      'inventory_locations',
      'inventory_items',
      'inventory_transactions',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS update_${table}_updated_at ON "${table}"`,
      );
    }

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_updated_at_column()`,
    );

    // Drop all indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_transactions_tenant_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_transactions_tenant_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_transactions_tenant_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_transactions_tenant_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_transactions_tenant_location"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_transactions_tenant_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_items_tenant_quantity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_items_tenant_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_items_tenant_location"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_locations_tenant_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_locations_tenant_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_locations_tenant_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_variants_tenant_product"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_products_tenant_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_products_tenant_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_products_tenant_status"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_items_tenant_product_location"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_locations_tenant_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_variants_tenant_sku"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_products_tenant_barcode"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_sku"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_categories_tenant_name"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenant_email"`);

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_related_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_cancelled_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_processed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_destination_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_source_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_inventory_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT IF EXISTS "FK_inventory_transactions_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "FK_inventory_items_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "FK_inventory_items_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_locations" DROP CONSTRAINT IF EXISTS "FK_inventory_locations_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "FK_product_variants_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_categories" DROP CONSTRAINT IF EXISTS "FK_product_categories_parent"`,
    );
  }
}
