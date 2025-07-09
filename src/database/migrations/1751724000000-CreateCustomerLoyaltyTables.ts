import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateCustomerLoyaltyTables1751724000000
  implements MigrationInterface
{
  name = 'CreateCustomerLoyaltyTables1751724000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUMs
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE loyalty_points_transaction_type AS ENUM (
          'earned_purchase',
          'earned_referral',
          'earned_review',
          'earned_social_share',
          'earned_birthday',
          'earned_welcome_bonus',
          'earned_milestone',
          'earned_challenge',
          'earned_survey',
          'earned_check_in',
          'earned_indonesian_event',
          'earned_ramadan_bonus',
          'earned_independence_day',
          'earned_lebaran_bonus',
          'redeemed_discount',
          'redeemed_cashback',
          'redeemed_free_shipping',
          'redeemed_product',
          'redeemed_voucher',
          'redeemed_experience',
          'expired',
          'adjusted',
          'transferred',
          'bonus'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE loyalty_tier AS ENUM (
          'bronze',
          'silver',
          'gold',
          'platinum',
          'diamond',
          'elite'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE reward_type AS ENUM (
          'discount_percentage',
          'discount_fixed',
          'cashback',
          'free_shipping',
          'free_product',
          'voucher',
          'experience',
          'early_access',
          'exclusive_content',
          'personal_shopper',
          'priority_support',
          'indonesian_experience',
          'local_partnership',
          'cultural_event',
          'family_package'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE reward_status AS ENUM (
          'available',
          'claimed',
          'redeemed',
          'expired',
          'cancelled',
          'pending'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create customer_loyalty_points table
    await queryRunner.createTable(
      new Table({
        name: 'customer_loyalty_points',
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
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'transaction_type',
            type: 'loyalty_points_transaction_type',
            isNullable: false,
          },
          {
            name: 'points_amount',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'points_balance_after',
            type: 'int',
            default: 0,
          },
          {
            name: 'related_order_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'related_reward_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reference_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'source_activity',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'multiplier_applied',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 1.0,
          },
          {
            name: 'tier_bonus_applied',
            type: 'int',
            default: 0,
          },
          {
            name: 'indonesian_bonus_applied',
            type: 'int',
            default: 0,
          },
          {
            name: 'calculation_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'is_expired',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_redeemed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'redeemed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create customer_loyalty_tiers table
    await queryRunner.createTable(
      new Table({
        name: 'customer_loyalty_tiers',
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
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'tier',
            type: 'loyalty_tier',
            isNullable: false,
          },
          {
            name: 'tier_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'tier_name_indonesian',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tier_description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tier_description_indonesian',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'min_points_required',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'min_spend_required',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'tier_order',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'benefits',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'tier_color',
            type: 'varchar',
            length: '7',
            isNullable: true,
          },
          {
            name: 'tier_icon',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'achievement_badge',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'valid_from',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'valid_until',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'custom_attributes',
            type: 'jsonb',
            isNullable: true,
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
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create customer_loyalty_rewards table
    await queryRunner.createTable(
      new Table({
        name: 'customer_loyalty_rewards',
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
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'reward_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'reward_name_indonesian',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reward_description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'reward_description_indonesian',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reward_type',
            type: 'reward_type',
            isNullable: false,
          },
          {
            name: 'points_required',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'monetary_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'discount_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'max_discount_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'eligible_tiers',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'min_purchase_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'max_redemptions_per_customer',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'total_redemptions_limit',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'current_redemptions',
            type: 'int',
            default: 0,
          },
          {
            name: 'reward_analytics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'terms_conditions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'terms_conditions_indonesian',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'redemption_instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'redemption_instructions_indonesian',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reward_image',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'reward_icon',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'priority_order',
            type: 'int',
            default: 100,
          },
          {
            name: 'is_featured',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'valid_from',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'valid_until',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'auto_apply',
            type: 'boolean',
            default: false,
          },
          {
            name: 'requires_approval',
            type: 'boolean',
            default: false,
          },
          {
            name: 'external_partner_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'external_partner_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'custom_attributes',
            type: 'jsonb',
            isNullable: true,
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
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create customer_loyalty_redemptions table
    await queryRunner.createTable(
      new Table({
        name: 'customer_loyalty_redemptions',
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
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reward_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'points_redeemed',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'monetary_value',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'reward_status',
            default: "'claimed'",
          },
          {
            name: 'redemption_code',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'related_order_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'applied_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'redemption_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'indonesian_context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'customer_feedback',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'fulfillment_status',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'fulfillment_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'approved_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cancelled_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for customer_loyalty_points
    await queryRunner.createIndex(
      'customer_loyalty_points',
      new TableIndex({
        name: 'IDX_loyalty_points_customer_tenant',
        columnNames: ['customer_id', 'tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_points',
      new TableIndex({
        name: 'IDX_loyalty_points_tenant_type',
        columnNames: ['tenant_id', 'transaction_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_points',
      new TableIndex({
        name: 'IDX_loyalty_points_tenant_expires',
        columnNames: ['tenant_id', 'expires_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_points',
      new TableIndex({
        name: 'IDX_loyalty_points_tenant_created',
        columnNames: ['tenant_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_points',
      new TableIndex({
        name: 'IDX_loyalty_points_tenant_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create indexes for customer_loyalty_tiers
    await queryRunner.createIndex(
      'customer_loyalty_tiers',
      new TableIndex({
        name: 'IDX_loyalty_tiers_tenant_tier',
        columnNames: ['tenant_id', 'tier'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_tiers',
      new TableIndex({
        name: 'IDX_loyalty_tiers_tenant_active',
        columnNames: ['tenant_id', 'is_active'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_tiers',
      new TableIndex({
        name: 'IDX_loyalty_tiers_tenant_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create indexes for customer_loyalty_rewards
    await queryRunner.createIndex(
      'customer_loyalty_rewards',
      new TableIndex({
        name: 'IDX_loyalty_rewards_tenant_type',
        columnNames: ['tenant_id', 'reward_type'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_rewards',
      new TableIndex({
        name: 'IDX_loyalty_rewards_tenant_active',
        columnNames: ['tenant_id', 'is_active'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_rewards',
      new TableIndex({
        name: 'IDX_loyalty_rewards_tenant_tiers',
        columnNames: ['tenant_id', 'eligible_tiers'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_rewards',
      new TableIndex({
        name: 'IDX_loyalty_rewards_tenant_validity',
        columnNames: ['tenant_id', 'valid_from', 'valid_until'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_rewards',
      new TableIndex({
        name: 'IDX_loyalty_rewards_tenant_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create indexes for customer_loyalty_redemptions
    await queryRunner.createIndex(
      'customer_loyalty_redemptions',
      new TableIndex({
        name: 'IDX_loyalty_redemptions_customer_tenant',
        columnNames: ['customer_id', 'tenant_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_redemptions',
      new TableIndex({
        name: 'IDX_loyalty_redemptions_tenant_reward',
        columnNames: ['tenant_id', 'reward_id'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_redemptions',
      new TableIndex({
        name: 'IDX_loyalty_redemptions_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_redemptions',
      new TableIndex({
        name: 'IDX_loyalty_redemptions_tenant_date',
        columnNames: ['tenant_id', 'created_at'],
      }),
    );
    await queryRunner.createIndex(
      'customer_loyalty_redemptions',
      new TableIndex({
        name: 'IDX_loyalty_redemptions_tenant_deleted',
        columnNames: ['tenant_id', 'is_deleted'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'customer_loyalty_points',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_loyalty_redemptions',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'customer_loyalty_redemptions',
      new TableForeignKey({
        columnNames: ['reward_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customer_loyalty_rewards',
        onDelete: 'CASCADE',
      }),
    );

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_timestamp_customer_loyalty_points
        BEFORE UPDATE ON customer_loyalty_points
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_timestamp_customer_loyalty_tiers
        BEFORE UPDATE ON customer_loyalty_tiers
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_timestamp_customer_loyalty_rewards
        BEFORE UPDATE ON customer_loyalty_rewards
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_timestamp_customer_loyalty_redemptions
        BEFORE UPDATE ON customer_loyalty_redemptions
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS set_timestamp_customer_loyalty_redemptions ON customer_loyalty_redemptions;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS set_timestamp_customer_loyalty_rewards ON customer_loyalty_rewards;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS set_timestamp_customer_loyalty_tiers ON customer_loyalty_tiers;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS set_timestamp_customer_loyalty_points ON customer_loyalty_points;`,
    );

    // Drop foreign keys
    const redemptionsTable = await queryRunner.getTable(
      'customer_loyalty_redemptions',
    );
    if (redemptionsTable) {
      const customerForeignKey = redemptionsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('customer_id') !== -1,
      );
      const rewardForeignKey = redemptionsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('reward_id') !== -1,
      );
      if (customerForeignKey) {
        await queryRunner.dropForeignKey(
          'customer_loyalty_redemptions',
          customerForeignKey,
        );
      }
      if (rewardForeignKey) {
        await queryRunner.dropForeignKey(
          'customer_loyalty_redemptions',
          rewardForeignKey,
        );
      }
    }

    const pointsTable = await queryRunner.getTable('customer_loyalty_points');
    if (pointsTable) {
      const customerForeignKey = pointsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('customer_id') !== -1,
      );
      if (customerForeignKey) {
        await queryRunner.dropForeignKey(
          'customer_loyalty_points',
          customerForeignKey,
        );
      }
    }

    // Drop tables
    await queryRunner.dropTable('customer_loyalty_redemptions', true);
    await queryRunner.dropTable('customer_loyalty_rewards', true);
    await queryRunner.dropTable('customer_loyalty_tiers', true);
    await queryRunner.dropTable('customer_loyalty_points', true);

    // Drop ENUMs
    await queryRunner.query(`DROP TYPE IF EXISTS reward_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS reward_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS loyalty_tier;`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS loyalty_points_transaction_type;`,
    );
  }
}
