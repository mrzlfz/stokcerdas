import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class CreatePurchaseOrderTables1735593000000
  implements MigrationInterface
{
  name = 'CreatePurchaseOrderTables1735593000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create purchase_orders table
    await queryRunner.createTable(
      new Table({
        name: 'purchase_orders',
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
          // Basic Information
          {
            name: 'po_number',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'supplier_reference',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'supplier_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'standard',
              'drop_ship',
              'consignment',
              'service',
              'emergency',
            ],
            default: "'standard'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'draft',
              'pending_approval',
              'approved',
              'rejected',
              'sent_to_supplier',
              'acknowledged',
              'partially_received',
              'received',
              'closed',
              'cancelled',
            ],
            default: "'draft'",
          },
          {
            name: 'priority',
            type: 'enum',
            enum: ['low', 'normal', 'high', 'urgent'],
            default: "'normal'",
          },
          // Dates
          {
            name: 'order_date',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'expected_delivery_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'requested_delivery_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'sent_to_supplier_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'acknowledged_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'first_received_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'fully_received_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'closed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          // Financial Information
          {
            name: 'subtotal_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'tax_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'shipping_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'discount_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'tax_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            default: "'IDR'",
          },
          // Payment Information
          {
            name: 'payment_terms',
            type: 'enum',
            enum: [
              'cod',
              'net_7',
              'net_15',
              'net_30',
              'net_45',
              'net_60',
              'prepaid',
              'custom',
            ],
            default: "'net_30'",
          },
          {
            name: 'custom_payment_days',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'payment_due_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          // Delivery Information
          {
            name: 'delivery_address',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'delivery_location_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'shipping_method',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tracking_number',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          // Approval Information
          {
            name: 'approval_status',
            type: 'enum',
            enum: [
              'not_required',
              'pending',
              'approved',
              'rejected',
              'escalated',
            ],
            default: "'not_required'",
          },
          {
            name: 'approval_threshold',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'approved_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'rejected_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'rejected_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          // Additional Information
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
            name: 'internal_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'supplier_instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'custom_fields',
            type: 'jsonb',
            isNullable: true,
          },
          // Status Tracking
          {
            name: 'is_urgent',
            type: 'boolean',
            default: false,
          },
          {
            name: 'requires_approval',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'item_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'received_item_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'completion_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          // PDF and Email Information
          {
            name: 'pdf_file_path',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'last_email_sent_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'email_sent_count',
            type: 'int',
            default: 0,
          },
          // Audit fields
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

    // Create purchase_order_items table
    await queryRunner.createTable(
      new Table({
        name: 'purchase_order_items',
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
            name: 'purchase_order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'sku',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'product_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'supplier_sku',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'unit',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'ordered_quantity',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'received_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'rejected_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'total_price',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'discount_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'discount_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'tax_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'tax_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'expected_delivery_date',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'last_received_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'custom_fields',
            type: 'jsonb',
            isNullable: true,
          },
          // Audit fields
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

    // Create purchase_order_approvals table
    await queryRunner.createTable(
      new Table({
        name: 'purchase_order_approvals',
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
            name: 'purchase_order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'approver_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'escalated'],
            default: "'pending'",
          },
          {
            name: 'level',
            type: 'int',
            default: 1,
          },
          {
            name: 'reviewed_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'comments',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_required',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_escalated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'escalated_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'escalated_to',
            type: 'uuid',
            isNullable: true,
          },
          // Audit fields
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

    // Create purchase_order_status_history table
    await queryRunner.createTable(
      new Table({
        name: 'purchase_order_status_history',
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
            name: 'purchase_order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'draft',
              'pending_approval',
              'approved',
              'rejected',
              'sent_to_supplier',
              'acknowledged',
              'partially_received',
              'received',
              'closed',
              'cancelled',
            ],
            isNullable: false,
          },
          {
            name: 'previous_status',
            type: 'enum',
            enum: [
              'draft',
              'pending_approval',
              'approved',
              'rejected',
              'sent_to_supplier',
              'acknowledged',
              'partially_received',
              'received',
              'closed',
              'cancelled',
            ],
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'changed_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'changed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          // Audit fields
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

    // Create indexes for purchase_orders table
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_purchase_orders_tenant_id_po_number" ON "purchase_orders" ("tenant_id", "po_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_id_supplier_id" ON "purchase_orders" ("tenant_id", "supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_id_status" ON "purchase_orders" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_id_priority" ON "purchase_orders" ("tenant_id", "priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_id_order_date" ON "purchase_orders" ("tenant_id", "order_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_id_expected_delivery_date" ON "purchase_orders" ("tenant_id", "expected_delivery_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_id_approval_status" ON "purchase_orders" ("tenant_id", "approval_status")`,
    );

    // Create indexes for purchase_order_items table
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_items_tenant_id_purchase_order_id" ON "purchase_order_items" ("tenant_id", "purchase_order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_items_tenant_id_product_id" ON "purchase_order_items" ("tenant_id", "product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_items_tenant_id_sku" ON "purchase_order_items" ("tenant_id", "sku")`,
    );

    // Create indexes for purchase_order_approvals table
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_approvals_tenant_id_purchase_order_id" ON "purchase_order_approvals" ("tenant_id", "purchase_order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_approvals_tenant_id_approver_id" ON "purchase_order_approvals" ("tenant_id", "approver_id")`,
    );

    // Create indexes for purchase_order_status_history table
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_status_history_tenant_id_purchase_order_id" ON "purchase_order_status_history" ("tenant_id", "purchase_order_id")`,
    );

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "purchase_orders" 
      ADD CONSTRAINT "FK_purchase_orders_supplier_id" 
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_order_items" 
      ADD CONSTRAINT "FK_purchase_order_items_purchase_order_id" 
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_order_items" 
      ADD CONSTRAINT "FK_purchase_order_items_product_id" 
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_order_approvals" 
      ADD CONSTRAINT "FK_purchase_order_approvals_purchase_order_id" 
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_order_status_history" 
      ADD CONSTRAINT "FK_purchase_order_status_history_purchase_order_id" 
      FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Note: Purchase order permissions will be added in a separate migration
    // due to PostgreSQL enum value transaction limitations
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    const purchaseOrdersTable = await queryRunner.getTable('purchase_orders');
    const supplierFK = purchaseOrdersTable?.foreignKeys.find(
      fk => fk.columnNames.indexOf('supplier_id') !== -1,
    );
    if (supplierFK) {
      await queryRunner.dropForeignKey('purchase_orders', supplierFK);
    }

    const purchaseOrderItemsTable = await queryRunner.getTable(
      'purchase_order_items',
    );
    const purchaseOrderFK = purchaseOrderItemsTable?.foreignKeys.find(
      fk => fk.columnNames.indexOf('purchase_order_id') !== -1,
    );
    if (purchaseOrderFK) {
      await queryRunner.dropForeignKey('purchase_order_items', purchaseOrderFK);
    }

    const productFK = purchaseOrderItemsTable?.foreignKeys.find(
      fk => fk.columnNames.indexOf('product_id') !== -1,
    );
    if (productFK) {
      await queryRunner.dropForeignKey('purchase_order_items', productFK);
    }

    const purchaseOrderApprovalsTable = await queryRunner.getTable(
      'purchase_order_approvals',
    );
    const approvalPurchaseOrderFK =
      purchaseOrderApprovalsTable?.foreignKeys.find(
        fk => fk.columnNames.indexOf('purchase_order_id') !== -1,
      );
    if (approvalPurchaseOrderFK) {
      await queryRunner.dropForeignKey(
        'purchase_order_approvals',
        approvalPurchaseOrderFK,
      );
    }

    const purchaseOrderStatusHistoryTable = await queryRunner.getTable(
      'purchase_order_status_history',
    );
    const historyPurchaseOrderFK =
      purchaseOrderStatusHistoryTable?.foreignKeys.find(
        fk => fk.columnNames.indexOf('purchase_order_id') !== -1,
      );
    if (historyPurchaseOrderFK) {
      await queryRunner.dropForeignKey(
        'purchase_order_status_history',
        historyPurchaseOrderFK,
      );
    }

    // Drop tables (this will also drop all indexes)
    await queryRunner.dropTable('purchase_order_status_history');
    await queryRunner.dropTable('purchase_order_approvals');
    await queryRunner.dropTable('purchase_order_items');
    await queryRunner.dropTable('purchase_orders');

    // Remove permissions
    await queryRunner.query(`
      DELETE FROM permissions WHERE resource = 'purchase_orders';
    `);
  }
}
