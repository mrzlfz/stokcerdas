import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissionsSchema1703875400000 implements MigrationInterface {
  name = 'AddPermissionsSchema1703875400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types for permissions
    await queryRunner.query(`
      CREATE TYPE "permission_resource_enum" AS ENUM(
        'users', 'products', 'inventory', 'reports', 'settings', 
        'analytics', 'integrations', 'suppliers', 'locations', 'transactions'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "permission_action_enum" AS ENUM(
        'create', 'read', 'update', 'delete', 'export', 'import', 
        'approve', 'cancel', 'transfer', 'adjust', 'view_all', 'manage_system'
      )
    `);

    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resource" "permission_resource_enum" NOT NULL,
        "action" "permission_action_enum" NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "isSystemPermission" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
      )
    `);

    // Create role_permissions table
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role" "user_role_enum" NOT NULL,
        "permission_id" uuid NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "granted_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("id")
      )
    `);

    // Add unique indexes
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_permissions_resource_action" 
      ON "permissions" ("resource", "action")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_role_permissions_role_permission" 
      ON "role_permissions" ("role", "permission_id")
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "role_permissions" 
      ADD CONSTRAINT "FK_role_permissions_permission" 
      FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
    `);

    // Add performance indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_permissions_resource" 
      ON "permissions" ("resource")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_permissions_action" 
      ON "permissions" ("action")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_permissions_active" 
      ON "permissions" ("isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_role" 
      ON "role_permissions" ("role")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_role_permissions_active" 
      ON "role_permissions" ("isActive")
    `);

    // Add triggers for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_permissions_updated_at 
      BEFORE UPDATE ON "permissions" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_role_permissions_updated_at 
      BEFORE UPDATE ON "role_permissions" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON "role_permissions"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_permissions_updated_at ON "permissions"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_role_permissions_active"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_permissions_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permissions_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permissions_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permissions_resource"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_role_permissions_role_permission"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_permissions_resource_action"`,
    );

    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "FK_role_permissions_permission"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "permissions"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "permission_action_enum"`);
    await queryRunner.query(`DROP TYPE "permission_resource_enum"`);
  }
}
