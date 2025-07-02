import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateSuppliers1719663000000 implements MigrationInterface {
  name = 'CreateSuppliers1719663000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create suppliers table
    await queryRunner.createTable(
      new Table({
        name: 'suppliers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'legal_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['manufacturer', 'distributor', 'wholesaler', 'retailer', 'service_provider', 'dropshipper'],
            default: "'distributor'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'suspended', 'terminated'],
            default: "'active'",
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'mobile',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'website',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'province',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'postal_code',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'country',
            type: 'varchar',
            length: '100',
            default: "'Indonesia'",
          },
          {
            name: 'tax_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'business_license',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'bank_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'bank_account_number',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'bank_account_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'payment_terms',
            type: 'enum',
            enum: ['cod', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'prepaid', 'custom'],
            default: "'net_30'",
          },
          {
            name: 'custom_payment_days',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'currency',
            type: 'enum',
            enum: ['IDR', 'USD', 'EUR', 'SGD', 'MYR'],
            default: "'IDR'",
          },
          {
            name: 'credit_limit',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'discount',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'rating',
            type: 'decimal',
            precision: 3,
            scale: 2,
            default: 0,
          },
          {
            name: 'total_orders',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_purchase_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'on_time_delivery_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'quality_score',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'lead_time_days',
            type: 'int',
            default: 0,
          },
          {
            name: 'contract_start_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'contract_end_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'last_order_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_fields',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'primary_contact_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'primary_contact_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'primary_contact_phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'primary_contact_position',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
    );

    // Create indexes for suppliers table
    await queryRunner.createIndex(
      'suppliers',
      new Index('IDX_suppliers_tenant_id_is_deleted', ['tenant_id', 'is_deleted']),
    );

    await queryRunner.createIndex(
      'suppliers',
      new Index('IDX_suppliers_tenant_id_code', ['tenant_id', 'code'], {
        unique: true,
        where: 'is_deleted = false',
      }),
    );

    await queryRunner.createIndex(
      'suppliers',
      new Index('IDX_suppliers_tenant_id_email', ['tenant_id', 'email'], {
        where: 'is_deleted = false',
      }),
    );

    await queryRunner.createIndex(
      'suppliers',
      new Index('IDX_suppliers_tenant_id_status', ['tenant_id', 'status']),
    );

    await queryRunner.createIndex(
      'suppliers',
      new Index('IDX_suppliers_tenant_id_type', ['tenant_id', 'type']),
    );

    // Add supplier_id column to products table
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "supplier_id" uuid`,
    );

    // Create index for supplier_id in products table
    await queryRunner.createIndex(
      'products',
      new Index('IDX_products_tenant_id_supplier_id', ['tenant_id', 'supplier_id']),
    );

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'products',
      new ForeignKey({
        columnNames: ['supplier_id'],
        referencedTableName: 'suppliers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Migrate existing supplier data from products table
    await queryRunner.query(`
      UPDATE products 
      SET supplier_id = NULL 
      WHERE supplier IS NOT NULL
    `);

    // Note: The old 'supplier' column (varchar) will be removed in a separate migration
    // after data migration is complete to maintain data safety
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    const table = await queryRunner.getTable('products');
    const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('supplier_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('products', foreignKey);
    }

    // Remove index
    await queryRunner.dropIndex('products', 'IDX_products_tenant_id_supplier_id');

    // Remove supplier_id column from products table
    await queryRunner.dropColumn('products', 'supplier_id');

    // Drop suppliers table (this will also drop all indexes)
    await queryRunner.dropTable('suppliers');
  }
}