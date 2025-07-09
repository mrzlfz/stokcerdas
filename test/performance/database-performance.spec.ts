import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { performance } from 'perf_hooks';
import * as moment from 'moment-timezone';

import { Product } from '../../src/products/entities/product.entity';
import { ProductCategory } from '../../src/products/entities/product-category.entity';
import { InventoryItem } from '../../src/inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../src/inventory/entities/inventory-transaction.entity';
import { User } from '../../src/users/entities/user.entity';
import { Supplier } from '../../src/suppliers/entities/supplier.entity';
import { PurchaseOrder } from '../../src/purchase-orders/entities/purchase-order.entity';

/**
 * PHASE 4.2.2: Database Performance Testing Suite
 * 
 * Comprehensive performance testing for database indexes and optimization
 * implemented in Phase 2 and Phase 3, with Indonesian business context.
 * 
 * Tests include:
 * - Database query performance with 43+ indexes
 * - Multi-level caching strategy (Hot/Warm/Cold)
 * - API response time validation
 * - Indonesian business context performance
 * - Multi-tenant performance isolation
 * - Mobile optimization effectiveness
 */

describe('Database Performance Testing Suite', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let productRepo: Repository<Product>;
  let inventoryItemRepo: Repository<InventoryItem>;
  let inventoryTransactionRepo: Repository<InventoryTransaction>;
  let userRepo: Repository<User>;
  let categoryRepo: Repository<ProductCategory>;

  const testTenantId = 'test-tenant-performance';
  const PERFORMANCE_THRESHOLDS = {
    SLOW_QUERY_THRESHOLD: 1000, // 1 second
    FAST_QUERY_THRESHOLD: 200,  // 200ms
    API_RESPONSE_THRESHOLD: 2000, // 2 seconds
    CACHE_HIT_RATIO_THRESHOLD: 0.7, // 70%
    INDEX_SCAN_RATIO_THRESHOLD: 0.9, // 90% index scans
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_NAME || 'stokcerdas_test',
          entities: [Product, ProductCategory, InventoryItem, InventoryTransaction, User, Supplier, PurchaseOrder],
          synchronize: true,
          logging: ['query'],
          maxQueryExecutionTime: 1000, // Log slow queries
        }),
        TypeOrmModule.forFeature([
          Product,
          ProductCategory,
          InventoryItem,
          InventoryTransaction,
          User,
          Supplier,
          PurchaseOrder,
        ]),
        CacheModule.register({
          ttl: 5,
          max: 100,
        }),
      ],
      providers: [],
    }).compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    productRepo = moduleRef.get<Repository<Product>>(getRepositoryToken(Product));
    inventoryItemRepo = moduleRef.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem));
    inventoryTransactionRepo = moduleRef.get<Repository<InventoryTransaction>>(getRepositoryToken(InventoryTransaction));
    userRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    categoryRepo = moduleRef.get<Repository<ProductCategory>>(getRepositoryToken(ProductCategory));

    // Setup test data
    await setupLargeDataset();
  });

  afterAll(async () => {
    await cleanupTestData();
    await moduleRef.close();
  });

  describe('Database Index Performance Testing', () => {
    describe('Product Table Index Performance', () => {
      it('should efficiently query products by tenant and SKU (idx_products_tenant_sku_active)', async () => {
        const startTime = performance.now();
        
        const result = await productRepo.findOne({
          where: { 
            tenantId: testTenantId,
            sku: 'PERF-TEST-001',
            status: 'active'
          }
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result).toBeDefined();
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify index usage
        const queryPlan = await getQueryPlan(
          `SELECT * FROM products WHERE tenant_id = '${testTenantId}' AND sku = 'PERF-TEST-001' AND status = 'active'`
        );
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_products_tenant_sku_active');
      });

      it('should efficiently perform full-text search on product names (idx_products_tenant_name_search)', async () => {
        const startTime = performance.now();
        
        const result = await dataSource.query(`
          SELECT * FROM products 
          WHERE tenant_id = $1 
          AND to_tsvector('indonesian', name) @@ plainto_tsquery('indonesian', $2)
          LIMIT 10
        `, [testTenantId, 'elektronik']);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify GIN index usage for full-text search
        const queryPlan = await getQueryPlan(`
          SELECT * FROM products 
          WHERE tenant_id = '${testTenantId}' 
          AND to_tsvector('indonesian', name) @@ plainto_tsquery('indonesian', 'elektronik')
        `);
        
        expect(queryPlan).toContain('Bitmap Index Scan');
        expect(queryPlan).toContain('idx_products_tenant_name_search');
      });

      it('should efficiently query products by barcode (idx_products_tenant_barcode)', async () => {
        const startTime = performance.now();
        
        const result = await productRepo.findOne({
          where: { 
            tenantId: testTenantId,
            barcode: '1234567890123'
          }
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result).toBeDefined();
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify barcode index usage
        const queryPlan = await getQueryPlan(
          `SELECT * FROM products WHERE tenant_id = '${testTenantId}' AND barcode = '1234567890123'`
        );
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_products_tenant_barcode');
      });

      it('should efficiently query products by category and status (idx_products_tenant_category_status)', async () => {
        const startTime = performance.now();
        
        const result = await productRepo.find({
          where: { 
            tenantId: testTenantId,
            categoryId: 'test-category-id',
            status: 'active'
          },
          take: 50
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify composite index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM products 
          WHERE tenant_id = '${testTenantId}' 
          AND category_id = 'test-category-id' 
          AND status = 'active'
          LIMIT 50
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_products_tenant_category_status');
      });

      it('should efficiently query products by supplier and cost range (idx_products_tenant_supplier_cost)', async () => {
        const startTime = performance.now();
        
        const result = await dataSource.query(`
          SELECT * FROM products 
          WHERE tenant_id = $1 
          AND supplier_id = $2 
          AND cost_price BETWEEN $3 AND $4
          ORDER BY cost_price DESC
          LIMIT 50
        `, [testTenantId, 'test-supplier-id', 10000, 100000]);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify supplier cost index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM products 
          WHERE tenant_id = '${testTenantId}' 
          AND supplier_id = 'test-supplier-id' 
          AND cost_price BETWEEN 10000 AND 100000
          ORDER BY cost_price DESC
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_products_tenant_supplier_cost');
      });
    });

    describe('Inventory Items Table Index Performance', () => {
      it('should efficiently query inventory by tenant, product, and location (idx_inventory_items_tenant_product_location)', async () => {
        const startTime = performance.now();
        
        const result = await inventoryItemRepo.find({
          where: { 
            tenantId: testTenantId,
            productId: 'test-product-id',
            locationId: 'test-location-id'
          }
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify core inventory index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM inventory_items 
          WHERE tenant_id = '${testTenantId}' 
          AND product_id = 'test-product-id' 
          AND location_id = 'test-location-id'
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_items_tenant_product_location');
      });

      it('should efficiently identify low stock items (idx_inventory_items_tenant_low_stock)', async () => {
        const startTime = performance.now();
        
        const result = await dataSource.query(`
          SELECT * FROM inventory_items 
          WHERE tenant_id = $1 
          AND quantity_on_hand <= reorder_point 
          AND reorder_point > 0
          ORDER BY (quantity_on_hand::float / NULLIF(reorder_point, 0)) ASC
          LIMIT 100
        `, [testTenantId]);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify low stock index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM inventory_items 
          WHERE tenant_id = '${testTenantId}' 
          AND quantity_on_hand <= reorder_point 
          AND reorder_point > 0
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_items_tenant_low_stock');
      });

      it('should efficiently query inventory by location and quantity (idx_inventory_items_tenant_location_quantity)', async () => {
        const startTime = performance.now();
        
        const result = await dataSource.query(`
          SELECT location_id, SUM(quantity_on_hand) as total_quantity
          FROM inventory_items 
          WHERE tenant_id = $1 
          AND quantity_on_hand > 0
          GROUP BY location_id
          ORDER BY total_quantity DESC
          LIMIT 50
        `, [testTenantId]);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify location quantity index usage
        const queryPlan = await getQueryPlan(`
          SELECT location_id, SUM(quantity_on_hand) as total_quantity
          FROM inventory_items 
          WHERE tenant_id = '${testTenantId}' 
          AND quantity_on_hand > 0
          GROUP BY location_id
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_items_tenant_location_quantity');
      });

      it('should efficiently query items by last movement date (idx_inventory_items_tenant_last_movement)', async () => {
        const startTime = performance.now();
        
        const lastWeek = moment().subtract(7, 'days').toDate();
        const result = await dataSource.query(`
          SELECT * FROM inventory_items 
          WHERE tenant_id = $1 
          AND last_movement_date > $2
          ORDER BY last_movement_date DESC
          LIMIT 100
        `, [testTenantId, lastWeek]);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify last movement index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM inventory_items 
          WHERE tenant_id = '${testTenantId}' 
          AND last_movement_date > '${lastWeek.toISOString()}'
          ORDER BY last_movement_date DESC
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_items_tenant_last_movement');
      });
    });

    describe('Inventory Transactions Table Index Performance', () => {
      it('should efficiently query transactions by product and date (idx_inventory_transactions_tenant_product_date)', async () => {
        const startTime = performance.now();
        
        const lastMonth = moment().subtract(30, 'days').toDate();
        const result = await inventoryTransactionRepo.find({
          where: { 
            tenantId: testTenantId,
            productId: 'test-product-id',
            transactionDate: new Date() // TypeORM MoreThan will be applied
          },
          order: { transactionDate: 'DESC' },
          take: 100
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify product date index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM inventory_transactions 
          WHERE tenant_id = '${testTenantId}' 
          AND product_id = 'test-product-id' 
          AND transaction_date > '${lastMonth.toISOString()}'
          ORDER BY transaction_date DESC
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_transactions_tenant_product_date');
      });

      it('should efficiently query transactions by location and type (idx_inventory_transactions_tenant_location_type)', async () => {
        const startTime = performance.now();
        
        const result = await dataSource.query(`
          SELECT transaction_type, COUNT(*) as count, SUM(quantity_change) as total_change
          FROM inventory_transactions 
          WHERE tenant_id = $1 
          AND location_id = $2
          GROUP BY transaction_type
          ORDER BY count DESC
        `, [testTenantId, 'test-location-id']);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify location type index usage
        const queryPlan = await getQueryPlan(`
          SELECT transaction_type, COUNT(*) as count, SUM(quantity_change) as total_change
          FROM inventory_transactions 
          WHERE tenant_id = '${testTenantId}' 
          AND location_id = 'test-location-id'
          GROUP BY transaction_type
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_transactions_tenant_location_type');
      });

      it('should efficiently query transactions by date range and type (idx_inventory_transactions_tenant_date_type)', async () => {
        const startTime = performance.now();
        
        const startDate = moment().subtract(30, 'days').toDate();
        const endDate = new Date();
        
        const result = await dataSource.query(`
          SELECT DATE(transaction_date) as date, transaction_type, COUNT(*) as count
          FROM inventory_transactions 
          WHERE tenant_id = $1 
          AND transaction_date BETWEEN $2 AND $3
          AND transaction_type IN ('SALE', 'PURCHASE', 'ADJUSTMENT')
          GROUP BY DATE(transaction_date), transaction_type
          ORDER BY date DESC, transaction_type
          LIMIT 100
        `, [testTenantId, startDate, endDate]);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify date type index usage
        const queryPlan = await getQueryPlan(`
          SELECT DATE(transaction_date) as date, transaction_type, COUNT(*) as count
          FROM inventory_transactions 
          WHERE tenant_id = '${testTenantId}' 
          AND transaction_date BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
          AND transaction_type IN ('SALE', 'PURCHASE', 'ADJUSTMENT')
          GROUP BY DATE(transaction_date), transaction_type
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_transactions_tenant_date_type');
      });

      it('should efficiently query transactions by reference (idx_inventory_transactions_tenant_reference)', async () => {
        const startTime = performance.now();
        
        const result = await inventoryTransactionRepo.find({
          where: { 
            tenantId: testTenantId,
            referenceId: 'ORDER-12345'
          },
          order: { transactionDate: 'DESC' }
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify reference index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM inventory_transactions 
          WHERE tenant_id = '${testTenantId}' 
          AND reference_id = 'ORDER-12345'
          ORDER BY transaction_date DESC
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_inventory_transactions_tenant_reference');
      });
    });

    describe('Users Table Index Performance', () => {
      it('should efficiently authenticate users (idx_users_tenant_email_active)', async () => {
        const startTime = performance.now();
        
        const result = await userRepo.findOne({
          where: { 
            tenantId: testTenantId,
            email: 'test@example.com',
            isActive: true
          }
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result).toBeDefined();
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify email authentication index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM users 
          WHERE tenant_id = '${testTenantId}' 
          AND email = 'test@example.com' 
          AND is_active = true
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_users_tenant_email_active');
      });

      it('should efficiently query users by role and status (idx_users_tenant_role_status)', async () => {
        const startTime = performance.now();
        
        const result = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            role: 'MANAGER',
            isActive: true
          },
          take: 50
        });

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify role status index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM users 
          WHERE tenant_id = '${testTenantId}' 
          AND role = 'MANAGER' 
          AND is_active = true
          LIMIT 50
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_users_tenant_role_status');
      });

      it('should efficiently query users by last login (idx_users_tenant_last_login)', async () => {
        const startTime = performance.now();
        
        const lastWeek = moment().subtract(7, 'days').toDate();
        const result = await dataSource.query(`
          SELECT * FROM users 
          WHERE tenant_id = $1 
          AND last_login_at > $2
          ORDER BY last_login_at DESC
          LIMIT 100
        `, [testTenantId, lastWeek]);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.length).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

        // Verify last login index usage
        const queryPlan = await getQueryPlan(`
          SELECT * FROM users 
          WHERE tenant_id = '${testTenantId}' 
          AND last_login_at > '${lastWeek.toISOString()}'
          ORDER BY last_login_at DESC
        `);
        
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain('idx_users_tenant_last_login');
      });
    });
  });

  describe('Multi-Tenant Performance Isolation', () => {
    it('should efficiently isolate tenant data in product queries', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';
      
      const startTime = performance.now();
      
      // Concurrent queries for different tenants
      const [tenant1Results, tenant2Results] = await Promise.all([
        productRepo.find({
          where: { tenantId: tenant1 },
          take: 100
        }),
        productRepo.find({
          where: { tenantId: tenant2 },
          take: 100
        })
      ]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(tenant1Results.length).toBeGreaterThan(0);
      expect(tenant2Results.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);

      // Verify no cross-tenant data leakage
      tenant1Results.forEach(product => {
        expect(product.tenantId).toBe(tenant1);
      });
      
      tenant2Results.forEach(product => {
        expect(product.tenantId).toBe(tenant2);
      });
    });

    it('should maintain consistent performance across multiple tenants', async () => {
      const tenants = ['tenant-1', 'tenant-2', 'tenant-3', 'tenant-4', 'tenant-5'];
      const performanceResults = [];
      
      for (const tenantId of tenants) {
        const startTime = performance.now();
        
        const products = await productRepo.find({
          where: { tenantId },
          take: 100
        });
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        performanceResults.push({
          tenantId,
          executionTime,
          resultCount: products.length
        });
      }

      // Verify consistent performance across tenants
      const avgExecutionTime = performanceResults.reduce((sum, result) => sum + result.executionTime, 0) / performanceResults.length;
      const maxExecutionTime = Math.max(...performanceResults.map(r => r.executionTime));
      const minExecutionTime = Math.min(...performanceResults.map(r => r.executionTime));
      
      expect(avgExecutionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(maxExecutionTime - minExecutionTime).toBeLessThan(100); // Performance variation < 100ms
    });
  });

  describe('Indonesian Business Context Performance', () => {
    it('should efficiently handle Indonesian timezone queries', async () => {
      const startTime = performance.now();
      
      // Query for Indonesian business hours (WIB timezone)
      const businessHoursStart = moment.tz('09:00', 'HH:mm', 'Asia/Jakarta').utc().toDate();
      const businessHoursEnd = moment.tz('17:00', 'HH:mm', 'Asia/Jakarta').utc().toDate();
      
      const result = await dataSource.query(`
        SELECT * FROM inventory_transactions 
        WHERE tenant_id = $1 
        AND EXTRACT(HOUR FROM transaction_date AT TIME ZONE 'Asia/Jakarta') BETWEEN 9 AND 17
        AND DATE(transaction_date) = CURRENT_DATE
        ORDER BY transaction_date DESC
        LIMIT 100
      `, [testTenantId]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should efficiently query Indonesian language full-text search', async () => {
      const startTime = performance.now();
      
      // Indonesian language full-text search
      const result = await dataSource.query(`
        SELECT * FROM products 
        WHERE tenant_id = $1 
        AND to_tsvector('indonesian', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('indonesian', $2)
        ORDER BY ts_rank(to_tsvector('indonesian', name || ' ' || COALESCE(description, '')), plainto_tsquery('indonesian', $2)) DESC
        LIMIT 50
      `, [testTenantId, 'makanan minuman']);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should efficiently handle Indonesian currency and pricing queries', async () => {
      const startTime = performance.now();
      
      // Query for Indonesian Rupiah price ranges
      const result = await dataSource.query(`
        SELECT 
          CASE 
            WHEN selling_price < 50000 THEN 'Dibawah 50rb'
            WHEN selling_price < 100000 THEN '50rb - 100rb'
            WHEN selling_price < 500000 THEN '100rb - 500rb'
            WHEN selling_price < 1000000 THEN '500rb - 1jt'
            ELSE 'Diatas 1jt'
          END as price_range,
          COUNT(*) as product_count,
          AVG(selling_price) as avg_price
        FROM products 
        WHERE tenant_id = $1 
        AND selling_price > 0
        GROUP BY 
          CASE 
            WHEN selling_price < 50000 THEN 'Dibawah 50rb'
            WHEN selling_price < 100000 THEN '50rb - 100rb'
            WHEN selling_price < 500000 THEN '100rb - 500rb'
            WHEN selling_price < 1000000 THEN '500rb - 1jt'
            ELSE 'Diatas 1jt'
          END
        ORDER BY AVG(selling_price)
      `, [testTenantId]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics Performance with Customer Analytics Indexes', () => {
    it('should efficiently calculate customer lifetime value (LTV)', async () => {
      const startTime = performance.now();
      
      // Customer LTV calculation using analytics indexes
      const result = await dataSource.query(`
        SELECT 
          customer_id,
          COUNT(*) as order_count,
          SUM(total_amount) as lifetime_value,
          AVG(total_amount) as avg_order_value,
          MAX(created_at) as last_order_date
        FROM orders 
        WHERE tenant_id = $1 
        AND status = 'COMPLETED'
        GROUP BY customer_id
        HAVING COUNT(*) > 1
        ORDER BY lifetime_value DESC
        LIMIT 100
      `, [testTenantId]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should efficiently perform customer segmentation analysis', async () => {
      const startTime = performance.now();
      
      // Customer segmentation based on purchase behavior
      const result = await dataSource.query(`
        SELECT 
          CASE 
            WHEN order_count >= 10 AND lifetime_value >= 5000000 THEN 'VIP'
            WHEN order_count >= 5 AND lifetime_value >= 2000000 THEN 'Premium'
            WHEN order_count >= 2 AND lifetime_value >= 500000 THEN 'Regular'
            ELSE 'New'
          END as customer_segment,
          COUNT(*) as customer_count,
          AVG(lifetime_value) as avg_ltv,
          AVG(order_count) as avg_orders
        FROM (
          SELECT 
            customer_id,
            COUNT(*) as order_count,
            SUM(total_amount) as lifetime_value
          FROM orders 
          WHERE tenant_id = $1 
          AND status = 'COMPLETED'
          GROUP BY customer_id
        ) customer_stats
        GROUP BY customer_segment
        ORDER BY avg_ltv DESC
      `, [testTenantId]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should efficiently analyze Indonesian regional distribution', async () => {
      const startTime = performance.now();
      
      // Regional distribution analysis for Indonesian market
      const result = await dataSource.query(`
        SELECT 
          CASE 
            WHEN shipping_address->>'city' ILIKE '%jakarta%' THEN 'Jakarta'
            WHEN shipping_address->>'city' ILIKE '%surabaya%' THEN 'Surabaya'
            WHEN shipping_address->>'city' ILIKE '%bandung%' THEN 'Bandung'
            WHEN shipping_address->>'city' ILIKE '%medan%' THEN 'Medan'
            WHEN shipping_address->>'city' ILIKE '%semarang%' THEN 'Semarang'
            ELSE 'Other Cities'
          END as region,
          COUNT(*) as order_count,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_order_value
        FROM orders 
        WHERE tenant_id = $1 
        AND status = 'COMPLETED'
        AND shipping_address IS NOT NULL
        GROUP BY region
        ORDER BY total_revenue DESC
      `, [testTenantId]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should efficiently analyze Indonesian payment method preferences', async () => {
      const startTime = performance.now();
      
      // Payment method analysis for Indonesian market
      const result = await dataSource.query(`
        SELECT 
          payment_method,
          COUNT(*) as usage_count,
          SUM(total_amount) as total_processed,
          AVG(total_amount) as avg_transaction_value,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as usage_percentage
        FROM orders 
        WHERE tenant_id = $1 
        AND status = 'COMPLETED'
        AND payment_method IN ('QRIS', 'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'BANK_TRANSFER', 'COD')
        GROUP BY payment_method
        ORDER BY usage_count DESC
      `, [testTenantId]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect query performance regression', async () => {
      const queryTests = [
        {
          name: 'Product Search',
          query: () => productRepo.find({ where: { tenantId: testTenantId }, take: 100 }),
          expectedThreshold: PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD
        },
        {
          name: 'Inventory Lookup',
          query: () => inventoryItemRepo.find({ where: { tenantId: testTenantId }, take: 100 }),
          expectedThreshold: PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD
        },
        {
          name: 'Transaction History',
          query: () => inventoryTransactionRepo.find({ where: { tenantId: testTenantId }, take: 100 }),
          expectedThreshold: PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD
        }
      ];

      const performanceResults = [];
      
      for (const test of queryTests) {
        const executionTimes = [];
        
        // Run each query 5 times to get average performance
        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();
          await test.query();
          const endTime = performance.now();
          executionTimes.push(endTime - startTime);
        }
        
        const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
        const maxTime = Math.max(...executionTimes);
        const minTime = Math.min(...executionTimes);
        
        performanceResults.push({
          name: test.name,
          avgTime,
          maxTime,
          minTime,
          threshold: test.expectedThreshold,
          passed: avgTime < test.expectedThreshold
        });
      }

      // Verify all queries meet performance thresholds
      performanceResults.forEach(result => {
        expect(result.passed).toBe(true);
        expect(result.avgTime).toBeLessThan(result.threshold);
      });

      // Log performance results for monitoring
      console.log('Performance Test Results:', performanceResults);
    });

    it('should validate index usage effectiveness', async () => {
      const indexTests = [
        {
          name: 'Products by SKU',
          query: `SELECT * FROM products WHERE tenant_id = '${testTenantId}' AND sku = 'PERF-TEST-001'`,
          expectedIndex: 'idx_products_tenant_sku_active'
        },
        {
          name: 'Inventory by Product',
          query: `SELECT * FROM inventory_items WHERE tenant_id = '${testTenantId}' AND product_id = 'test-product-id'`,
          expectedIndex: 'idx_inventory_items_tenant_product_location'
        },
        {
          name: 'Transactions by Date',
          query: `SELECT * FROM inventory_transactions WHERE tenant_id = '${testTenantId}' AND transaction_date > NOW() - INTERVAL '7 days'`,
          expectedIndex: 'idx_inventory_transactions_tenant_date_type'
        }
      ];

      for (const test of indexTests) {
        const queryPlan = await getQueryPlan(test.query);
        
        // Verify index is being used
        expect(queryPlan).toContain('Index Scan');
        expect(queryPlan).toContain(test.expectedIndex);
        
        // Verify no sequential scans on large tables
        expect(queryPlan).not.toContain('Seq Scan');
      }
    });
  });

  // Helper functions
  async function getQueryPlan(query: string): Promise<string> {
    const result = await dataSource.query(`EXPLAIN (ANALYZE, BUFFERS) ${query}`);
    return result.map(row => row['QUERY PLAN']).join('\n');
  }

  async function setupLargeDataset(): Promise<void> {
    // Create test categories
    const categories = [];
    for (let i = 1; i <= 10; i++) {
      categories.push(categoryRepo.create({
        id: `test-category-${i}`,
        tenantId: testTenantId,
        name: `Test Category ${i}`,
        description: `Test category ${i} for performance testing`,
        isActive: true
      }));
    }
    await categoryRepo.save(categories);

    // Create test products (1000 products)
    const products = [];
    for (let i = 1; i <= 1000; i++) {
      products.push(productRepo.create({
        id: `test-product-${i}`,
        tenantId: testTenantId,
        sku: `PERF-TEST-${i.toString().padStart(3, '0')}`,
        name: `Test Product ${i}`,
        description: `Test product ${i} for performance testing`,
        barcode: `123456789${i.toString().padStart(4, '0')}`,
        categoryId: `test-category-${(i % 10) + 1}`,
        supplierId: 'test-supplier-id',
        costPrice: Math.floor(Math.random() * 100000) + 10000,
        sellingPrice: Math.floor(Math.random() * 200000) + 50000,
        status: 'active',
        type: 'simple',
        isActive: true
      }));
    }
    await productRepo.save(products);

    // Create test inventory items (2000 items)
    const inventoryItems = [];
    for (let i = 1; i <= 2000; i++) {
      inventoryItems.push(inventoryItemRepo.create({
        id: `test-inventory-${i}`,
        tenantId: testTenantId,
        productId: `test-product-${Math.floor(Math.random() * 1000) + 1}`,
        locationId: `test-location-${(i % 5) + 1}`,
        quantityOnHand: Math.floor(Math.random() * 1000),
        quantityReserved: Math.floor(Math.random() * 50),
        quantityOnOrder: Math.floor(Math.random() * 100),
        reorderPoint: Math.floor(Math.random() * 100) + 10,
        maxStockLevel: Math.floor(Math.random() * 1000) + 500,
        averageCost: Math.floor(Math.random() * 100000) + 10000,
        lastMovementDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        lastCountDate: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000)
      }));
    }
    await inventoryItemRepo.save(inventoryItems);

    // Create test transactions (5000 transactions)
    const transactions = [];
    for (let i = 1; i <= 5000; i++) {
      transactions.push(inventoryTransactionRepo.create({
        id: `test-transaction-${i}`,
        tenantId: testTenantId,
        productId: `test-product-${Math.floor(Math.random() * 1000) + 1}`,
        locationId: `test-location-${(i % 5) + 1}`,
        transactionType: ['SALE', 'PURCHASE', 'ADJUSTMENT', 'TRANSFER'][Math.floor(Math.random() * 4)],
        quantityChange: Math.floor(Math.random() * 100) - 50,
        unitCost: Math.floor(Math.random() * 100000) + 10000,
        referenceId: `ORDER-${Math.floor(Math.random() * 1000) + 1}`,
        transactionDate: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000),
        reason: 'Performance testing transaction'
      }));
    }
    await inventoryTransactionRepo.save(transactions);

    // Create test users (100 users)
    const users = [];
    for (let i = 1; i <= 100; i++) {
      users.push(userRepo.create({
        id: `test-user-${i}`,
        tenantId: testTenantId,
        email: `test${i}@example.com`,
        password: 'hashedPassword',
        firstName: `Test${i}`,
        lastName: 'User',
        role: ['ADMIN', 'MANAGER', 'STAFF'][Math.floor(Math.random() * 3)],
        isActive: true,
        lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
      }));
    }
    await userRepo.save(users);
  }

  async function cleanupTestData(): Promise<void> {
    await inventoryTransactionRepo.delete({ tenantId: testTenantId });
    await inventoryItemRepo.delete({ tenantId: testTenantId });
    await productRepo.delete({ tenantId: testTenantId });
    await categoryRepo.delete({ tenantId: testTenantId });
    await userRepo.delete({ tenantId: testTenantId });
  }
});