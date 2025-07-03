import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAlertTables1735593900000 implements MigrationInterface {
  name = 'CreateAlertTables1735593900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create alert_configurations table
    await queryRunner.createTable(
      new Table({
        name: 'alert_configurations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'alertType',
            type: 'enum',
            enum: [
              'low_stock',
              'out_of_stock',
              'overstock',
              'expiring_soon',
              'expired',
              'reorder_needed',
              'system_maintenance',
              'order_status_update',
            ],
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'enum',
            enum: ['info', 'warning', 'critical'],
            default: "'warning'",
            isNullable: false,
          },
          {
            name: 'isEnabled',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'productId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'locationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'recipientUserIds',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
            isNullable: false,
          },
          {
            name: 'recipientRoles',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
            isNullable: false,
          },
          {
            name: 'recipientEmails',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
            isNullable: false,
          },
          {
            name: 'schedule',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create alert_instances table
    await queryRunner.createTable(
      new Table({
        name: 'alert_instances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'alertType',
            type: 'enum',
            enum: [
              'low_stock',
              'out_of_stock',
              'overstock',
              'expiring_soon',
              'expired',
              'reorder_needed',
              'system_maintenance',
              'order_status_update',
            ],
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'enum',
            enum: ['info', 'warning', 'critical'],
            isNullable: false,
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'medium', 'high', 'critical'],
            default: "'medium'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'acknowledged', 'resolved', 'snoozed', 'dismissed', 'escalated'],
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'productId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'locationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'inventoryItemId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'configurationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'acknowledgedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'acknowledgedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'acknowledgeNotes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'resolvedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'resolutionNotes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'dismissedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'dismissedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'dismissalReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'snoozedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'snoozedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'snoozeUntil',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'snoozeReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'snoozeCount',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'escalatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'escalatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'escalatedTo',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'escalationReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notificationStatus',
            type: 'jsonb',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'viewedBy',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
            isNullable: false,
          },
          {
            name: 'viewHistory',
            type: 'jsonb',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            default: 'ARRAY[]::text[]',
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes for alert_configurations
    await queryRunner.query(`
      CREATE INDEX "IDX_alert_configurations_tenant_type" ON "alert_configurations" ("tenantId", "alertType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_configurations_tenant_product_location" ON "alert_configurations" ("tenantId", "productId", "locationId")
    `);

    // Create indexes for alert_instances
    await queryRunner.query(`
      CREATE INDEX "IDX_alert_instances_tenant_status" ON "alert_instances" ("tenantId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_instances_tenant_type_status" ON "alert_instances" ("tenantId", "alertType", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_instances_tenant_severity_status" ON "alert_instances" ("tenantId", "severity", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_instances_created_at" ON "alert_instances" ("createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_instances_resolved_at" ON "alert_instances" ("resolvedAt")
    `);

    // Create foreign keys for alert_configurations
    await queryRunner.query(`
      ALTER TABLE "alert_configurations" ADD CONSTRAINT "FK_alert_configurations_product_id" 
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_configurations" ADD CONSTRAINT "FK_alert_configurations_location_id" 
      FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_configurations" ADD CONSTRAINT "FK_alert_configurations_created_by" 
      FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_configurations" ADD CONSTRAINT "FK_alert_configurations_updated_by" 
      FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    // Create foreign keys for alert_instances
    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_product_id" 
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_location_id" 
      FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_inventory_item_id" 
      FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_configuration_id" 
      FOREIGN KEY ("configurationId") REFERENCES "alert_configurations"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_acknowledged_by" 
      FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_resolved_by" 
      FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_dismissed_by" 
      FOREIGN KEY ("dismissedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_snoozed_by" 
      FOREIGN KEY ("snoozedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_escalated_by" 
      FOREIGN KEY ("escalatedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "alert_instances" ADD CONSTRAINT "FK_alert_instances_escalated_to" 
      FOREIGN KEY ("escalatedTo") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_escalated_to"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_escalated_by"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_snoozed_by"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_dismissed_by"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_resolved_by"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_acknowledged_by"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_configuration_id"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_inventory_item_id"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_location_id"`);
    await queryRunner.query(`ALTER TABLE "alert_instances" DROP CONSTRAINT IF EXISTS "FK_alert_instances_product_id"`);

    await queryRunner.query(`ALTER TABLE "alert_configurations" DROP CONSTRAINT IF EXISTS "FK_alert_configurations_updated_by"`);
    await queryRunner.query(`ALTER TABLE "alert_configurations" DROP CONSTRAINT IF EXISTS "FK_alert_configurations_created_by"`);
    await queryRunner.query(`ALTER TABLE "alert_configurations" DROP CONSTRAINT IF EXISTS "FK_alert_configurations_location_id"`);
    await queryRunner.query(`ALTER TABLE "alert_configurations" DROP CONSTRAINT IF EXISTS "FK_alert_configurations_product_id"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_instances_resolved_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_instances_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_instances_tenant_severity_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_instances_tenant_type_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_instances_tenant_status"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_configurations_tenant_product_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_configurations_tenant_type"`);

    // Drop tables
    await queryRunner.dropTable('alert_instances');
    await queryRunner.dropTable('alert_configurations');
  }
}