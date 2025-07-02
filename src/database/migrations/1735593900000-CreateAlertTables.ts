import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

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
    await queryRunner.createIndex(
      'alert_configurations',
      new Index('IDX_alert_configurations_tenant_type', ['tenantId', 'alertType']),
    );

    await queryRunner.createIndex(
      'alert_configurations',
      new Index('IDX_alert_configurations_tenant_product_location', ['tenantId', 'productId', 'locationId']),
    );

    // Create indexes for alert_instances
    await queryRunner.createIndex(
      'alert_instances',
      new Index('IDX_alert_instances_tenant_status', ['tenantId', 'status']),
    );

    await queryRunner.createIndex(
      'alert_instances',
      new Index('IDX_alert_instances_tenant_type_status', ['tenantId', 'alertType', 'status']),
    );

    await queryRunner.createIndex(
      'alert_instances',
      new Index('IDX_alert_instances_tenant_severity_status', ['tenantId', 'severity', 'status']),
    );

    await queryRunner.createIndex(
      'alert_instances',
      new Index('IDX_alert_instances_created_at', ['createdAt']),
    );

    await queryRunner.createIndex(
      'alert_instances',
      new Index('IDX_alert_instances_resolved_at', ['resolvedAt']),
    );

    // Create foreign keys for alert_configurations
    await queryRunner.createForeignKey(
      'alert_configurations',
      new ForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_configurations',
      new ForeignKey({
        columnNames: ['locationId'],
        referencedTableName: 'inventory_locations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_configurations',
      new ForeignKey({
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_configurations',
      new ForeignKey({
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Create foreign keys for alert_instances
    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['locationId'],
        referencedTableName: 'inventory_locations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['inventoryItemId'],
        referencedTableName: 'inventory_items',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['configurationId'],
        referencedTableName: 'alert_configurations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['acknowledgedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['resolvedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['dismissedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['snoozedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['escalatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'alert_instances',
      new ForeignKey({
        columnNames: ['escalatedTo'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const alertInstancesTable = await queryRunner.getTable('alert_instances');
    if (alertInstancesTable) {
      const foreignKeys = alertInstancesTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('alert_instances', foreignKey);
      }
    }

    const alertConfigurationsTable = await queryRunner.getTable('alert_configurations');
    if (alertConfigurationsTable) {
      const foreignKeys = alertConfigurationsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('alert_configurations', foreignKey);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('alert_instances', 'IDX_alert_instances_escalated_to');
    await queryRunner.dropIndex('alert_instances', 'IDX_alert_instances_resolved_at');
    await queryRunner.dropIndex('alert_instances', 'IDX_alert_instances_created_at');
    await queryRunner.dropIndex('alert_instances', 'IDX_alert_instances_tenant_severity_status');
    await queryRunner.dropIndex('alert_instances', 'IDX_alert_instances_tenant_type_status');
    await queryRunner.dropIndex('alert_instances', 'IDX_alert_instances_tenant_status');

    await queryRunner.dropIndex('alert_configurations', 'IDX_alert_configurations_tenant_product_location');
    await queryRunner.dropIndex('alert_configurations', 'IDX_alert_configurations_tenant_type');

    // Drop tables
    await queryRunner.dropTable('alert_instances');
    await queryRunner.dropTable('alert_configurations');
  }
}