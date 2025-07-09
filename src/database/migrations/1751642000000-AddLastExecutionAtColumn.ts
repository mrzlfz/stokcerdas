import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastExecutionAtColumn1751642000000
  implements MigrationInterface
{
  name = 'AddLastExecutionAtColumn1751642000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the missing lastExecutionAt column that's causing AI testing failures
    const hasLastExecutionAt = await queryRunner.hasColumn(
      'workflows',
      'lastExecutionAt',
    );
    if (!hasLastExecutionAt) {
      await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "lastExecutionAt" timestamp with time zone
            `);
      console.log('✅ Added missing lastExecutionAt column to workflows table');
    } else {
      console.log(
        '✅ lastExecutionAt column already exists in workflows table',
      );
    }

    // Also add missing lastExecutionStatus column if it doesn't exist
    const hasLastExecutionStatus = await queryRunner.hasColumn(
      'workflows',
      'lastExecutionStatus',
    );
    if (!hasLastExecutionStatus) {
      await queryRunner.query(`
                ALTER TABLE "workflows" 
                ADD COLUMN "lastExecutionStatus" text
            `);
      console.log(
        '✅ Added missing lastExecutionStatus column to workflows table',
      );
    } else {
      console.log(
        '✅ lastExecutionStatus column already exists in workflows table',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflows" DROP COLUMN IF EXISTS "lastExecutionStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflows" DROP COLUMN IF EXISTS "lastExecutionAt"`,
    );
  }
}
