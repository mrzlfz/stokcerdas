import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1703875200000 implements MigrationInterface {
  name = 'InitialSchema1703875200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM('super_admin', 'admin', 'manager', 'staff')
    `);

    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM('active', 'inactive', 'suspended', 'pending')
    `);

    await queryRunner.query(`
      CREATE TYPE "product_status_enum" AS ENUM('active', 'inactive', 'discontinued')
    `);

    await queryRunner.query(`
      CREATE TYPE "product_type_enum" AS ENUM('simple', 'variant', 'bundle')
    `);

    await queryRunner.query(`
      CREATE TYPE "location_type_enum" AS ENUM('warehouse', 'store', 'virtual', 'transit')
    `);

    await queryRunner.query(`
      CREATE TYPE "location_status_enum" AS ENUM('active', 'inactive', 'maintenance')
    `);

    await queryRunner.query(`
      CREATE TYPE "transaction_type_enum" AS ENUM(
        'receipt', 'issue', 'transfer_out', 'transfer_in', 
        'adjustment_positive', 'adjustment_negative', 'sale', 'return',
        'production_input', 'production_output', 'damaged', 'expired',
        'lost', 'found', 'reservation', 'reservation_release',
        'allocation', 'allocation_release'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM('pending', 'completed', 'cancelled', 'failed')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        "firstName" varchar(100) NOT NULL,
        "lastName" varchar(100) NOT NULL,
        "phoneNumber" varchar(20),
        "role" "user_role_enum" NOT NULL DEFAULT 'staff',
        "status" "user_status_enum" NOT NULL DEFAULT 'pending',
        "avatar" varchar(255),
        "language" varchar(10) NOT NULL DEFAULT 'id',
        "timezone" varchar(50) NOT NULL DEFAULT 'Asia/Jakarta',
        "lastLoginAt" TIMESTAMP,
        "lastLoginIp" inet,
        "loginAttempts" integer NOT NULL DEFAULT '0',
        "lockedUntil" TIMESTAMP,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "emailVerificationToken" varchar(255),
        "resetPasswordToken" varchar(255),
        "resetPasswordExpires" TIMESTAMP,
        "mfaEnabled" boolean NOT NULL DEFAULT false,
        "mfaSecret" varchar(255),
        "preferences" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create product_categories table
    await queryRunner.query(`
      CREATE TABLE "product_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "image" varchar(255),
        "parentId" uuid,
        "sortOrder" integer NOT NULL DEFAULT '0',
        "isActive" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_product_categories" PRIMARY KEY ("id")
      )
    `);

    // Create products table
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "sku" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "barcode" varchar(50),
        "type" "product_type_enum" NOT NULL DEFAULT 'simple',
        "status" "product_status_enum" NOT NULL DEFAULT 'active',
        "categoryId" uuid,
        "brand" varchar(100),
        "unit" varchar(50),
        "costPrice" decimal(15,2) NOT NULL DEFAULT '0',
        "sellingPrice" decimal(15,2) NOT NULL DEFAULT '0',
        "wholesalePrice" decimal(15,2),
        "weight" decimal(8,3),
        "dimensions" varchar(50),
        "image" varchar(255),
        "images" json,
        "minStock" integer NOT NULL DEFAULT '0',
        "maxStock" integer NOT NULL DEFAULT '0',
        "reorderPoint" integer NOT NULL DEFAULT '0',
        "reorderQuantity" integer NOT NULL DEFAULT '1',
        "trackStock" boolean NOT NULL DEFAULT true,
        "allowBackorder" boolean NOT NULL DEFAULT false,
        "expiryDate" date,
        "shelfLife" integer,
        "supplier" varchar(100),
        "supplierSku" varchar(100),
        "taxRate" decimal(5,2),
        "isTaxable" boolean NOT NULL DEFAULT true,
        "attributes" jsonb,
        "seoMeta" jsonb,
        "viewCount" integer NOT NULL DEFAULT '0',
        "salesCount" integer NOT NULL DEFAULT '0',
        "totalRevenue" decimal(15,2) NOT NULL DEFAULT '0',
        "lastSoldAt" TIMESTAMP,
        "lastRestockedAt" TIMESTAMP,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);

    // Create product_variants table
    await queryRunner.query(`
      CREATE TABLE "product_variants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "sku" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "barcode" varchar(50),
        "costPrice" decimal(15,2) NOT NULL,
        "sellingPrice" decimal(15,2) NOT NULL,
        "weight" decimal(8,3),
        "image" varchar(255),
        "attributes" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_product_variants" PRIMARY KEY ("id")
      )
    `);

    // Create inventory_locations table
    await queryRunner.query(`
      CREATE TABLE "inventory_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "type" "location_type_enum" NOT NULL DEFAULT 'warehouse',
        "status" "location_status_enum" NOT NULL DEFAULT 'active',
        "parentId" uuid,
        "address" varchar(255),
        "city" varchar(100),
        "state" varchar(100),
        "postalCode" varchar(20),
        "country" varchar(100),
        "latitude" decimal(10,8),
        "longitude" decimal(11,8),
        "phoneNumber" varchar(20),
        "email" varchar(255),
        "contactPerson" varchar(255),
        "totalArea" decimal(10,2),
        "usableArea" decimal(10,2),
        "maxCapacity" integer,
        "isPickupLocation" boolean NOT NULL DEFAULT true,
        "isDropoffLocation" boolean NOT NULL DEFAULT true,
        "allowNegativeStock" boolean NOT NULL DEFAULT true,
        "operatingHours" jsonb,
        "settings" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_inventory_locations" PRIMARY KEY ("id")
      )
    `);

    // Create inventory_items table
    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "locationId" uuid NOT NULL,
        "quantityOnHand" integer NOT NULL DEFAULT '0',
        "quantityReserved" integer NOT NULL DEFAULT '0',
        "quantityOnOrder" integer NOT NULL DEFAULT '0',
        "quantityAllocated" integer NOT NULL DEFAULT '0',
        "averageCost" decimal(15,2) NOT NULL DEFAULT '0',
        "totalValue" decimal(15,2) NOT NULL DEFAULT '0',
        "lastMovementAt" TIMESTAMP,
        "lastCountAt" TIMESTAMP,
        "minStock" integer,
        "maxStock" integer,
        "reorderPoint" integer,
        "reorderQuantity" integer,
        "binLocation" varchar(50),
        "lotNumber" varchar(100),
        "serialNumber" varchar(100),
        "expiryDate" date,
        "manufacturingDate" date,
        "attributes" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_inventory_items" PRIMARY KEY ("id")
      )
    `);

    // Create inventory_transactions table
    await queryRunner.query(`
      CREATE TABLE "inventory_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "locationId" uuid NOT NULL,
        "inventoryItemId" uuid,
        "type" "transaction_type_enum" NOT NULL,
        "status" "transaction_status_enum" NOT NULL DEFAULT 'pending',
        "quantity" integer NOT NULL,
        "quantityBefore" integer NOT NULL,
        "quantityAfter" integer NOT NULL,
        "unitCost" decimal(15,2),
        "totalCost" decimal(15,2),
        "transactionDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "batchNumber" varchar(100),
        "lotNumber" varchar(100),
        "serialNumber" varchar(100),
        "expiryDate" date,
        "reason" text,
        "notes" text,
        "referenceType" varchar(50),
        "referenceId" varchar(100),
        "referenceNumber" varchar(100),
        "relatedTransactionId" uuid,
        "sourceLocationId" uuid,
        "destinationLocationId" uuid,
        "metadata" jsonb,
        "ipAddress" inet,
        "userAgent" varchar(255),
        "processedAt" TIMESTAMP,
        "processedBy" uuid,
        "cancelledAt" TIMESTAMP,
        "cancelledBy" uuid,
        "cancellationReason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "inventory_transactions"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
    await queryRunner.query(`DROP TABLE "inventory_locations"`);
    await queryRunner.query(`DROP TABLE "product_variants"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "product_categories"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE "location_status_enum"`);
    await queryRunner.query(`DROP TYPE "location_type_enum"`);
    await queryRunner.query(`DROP TYPE "product_type_enum"`);
    await queryRunner.query(`DROP TYPE "product_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
