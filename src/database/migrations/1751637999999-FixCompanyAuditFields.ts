import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCompanyAuditFields1751637999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix column naming inconsistency for companies table
    // Entity expects snake_case but migration created camelCase

    // Check if the old columns exist first
    const checkIsDeleted = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'isDeleted'
    `);

    const checkDeletedAt = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'deletedAt'
    `);

    // Rename columns to match entity expectations
    if (checkIsDeleted.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "companies" 
        RENAME COLUMN "isDeleted" TO "is_deleted"
      `);
    }

    if (checkDeletedAt.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "companies" 
        RENAME COLUMN "deletedAt" TO "deleted_at"
      `);
    }

    // Add deleted_by column if it doesn't exist
    const checkDeletedBy = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'deleted_by'
    `);

    if (checkDeletedBy.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "companies" 
        ADD COLUMN "deleted_by" uuid
      `);
    }

    // Update indexes to use correct column names
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_companies_tenant_deleted"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_companies_tenant_deleted" 
      ON "companies" ("tenant_id", "is_deleted")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the changes
    const checkIsDeleted = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'is_deleted'
    `);

    const checkDeletedAt = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'deleted_at'
    `);

    if (checkIsDeleted.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "companies" 
        RENAME COLUMN "is_deleted" TO "isDeleted"
      `);
    }

    if (checkDeletedAt.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "companies" 
        RENAME COLUMN "deleted_at" TO "deletedAt"
      `);
    }

    // Remove deleted_by column
    await queryRunner.query(`
      ALTER TABLE "companies" 
      DROP COLUMN IF EXISTS "deleted_by"
    `);

    // Restore original index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_companies_tenant_deleted"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_companies_tenant_deleted" 
      ON "companies" ("tenant_id", "isDeleted")
    `);
  }
}
