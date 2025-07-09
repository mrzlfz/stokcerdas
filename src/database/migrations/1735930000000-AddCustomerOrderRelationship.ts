import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  Index,
} from 'typeorm';

export class AddCustomerOrderRelationship1735930000000
  implements MigrationInterface
{
  name = 'AddCustomerOrderRelationship1735930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if orders table exists first
    const ordersTableExists = await queryRunner.hasTable('orders');
    if (!ordersTableExists) {
      console.log(
        'Orders table does not exist yet, skipping customer relationship migration',
      );
      return;
    }

    // Add customer_id column to orders table
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'customer_id',
        type: 'uuid',
        isNullable: true, // Allow null initially for existing orders
      }),
    );

    // Create index for customer_id for better query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_tenant_id_customer_id" ON "orders" ("tenant_id", "customer_id") WHERE "customer_id" IS NOT NULL AND "is_deleted" = false`,
    );

    // Create index for better customer order lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_customer_id_order_date" ON "orders" ("customer_id", "order_date") WHERE "customer_id" IS NOT NULL AND "is_deleted" = false`,
    );

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'SET NULL', // If customer is deleted, set customer_id to null but keep the order
        onUpdate: 'CASCADE',
        name: 'FK_orders_customer_id',
      }),
    );

    // Update orders with customer references where customerInfo.customerId exists
    await queryRunner.query(`
      UPDATE orders 
      SET customer_id = (customer_info->>'customerId')::uuid
      WHERE customer_info->>'customerId' IS NOT NULL 
        AND customer_info->>'customerId' != ''
        AND EXISTS (
          SELECT 1 FROM customers 
          WHERE customers.id = (orders.customer_info->>'customerId')::uuid
            AND customers.tenant_id = orders.tenant_id
            AND customers.is_deleted = false
        )
    `);

    // Add statistics for migration tracking
    await queryRunner.query(`
      INSERT INTO migration_statistics (migration_name, table_name, action, records_affected, created_at)
      SELECT 
        'AddCustomerOrderRelationship1735930000000' as migration_name,
        'orders' as table_name,
        'customer_relationship_added' as action,
        COUNT(*) as records_affected,
        CURRENT_TIMESTAMP as created_at
      FROM orders 
      WHERE customer_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    console.log('Customer-Order relationship established successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if orders table exists first
    const ordersTableExists = await queryRunner.hasTable('orders');
    if (!ordersTableExists) {
      console.log(
        'Orders table does not exist, skipping customer relationship rollback',
      );
      return;
    }

    // Drop foreign key constraint
    const table = await queryRunner.getTable('orders');
    const foreignKey = table.foreignKeys.find(
      fk => fk.name === 'FK_orders_customer_id',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('orders', foreignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex('orders', 'IDX_orders_customer_id_order_date');
    await queryRunner.dropIndex('orders', 'IDX_orders_tenant_id_customer_id');

    // Drop customer_id column
    await queryRunner.dropColumn('orders', 'customer_id');

    // Remove migration statistics
    await queryRunner.query(`
      DELETE FROM migration_statistics 
      WHERE migration_name = 'AddCustomerOrderRelationship1735930000000'
    `);

    console.log('Customer-Order relationship rollback completed');
  }
}
