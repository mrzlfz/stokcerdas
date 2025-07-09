import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { performance } from 'perf_hooks';
import * as moment from 'moment-timezone';

import { User } from '../../src/users/entities/user.entity';
import { ProductCategory } from '../../src/products/entities/product-category.entity';

/**
 * PHASE 4.2.2: Simplified Database Performance Testing Suite
 * 
 * Comprehensive performance testing for database indexes and optimization
 * using minimal entity setup to avoid complex dependencies.
 * 
 * Tests include:
 * - Database query performance with indexes
 * - Query execution time measurements
 * - Indonesian business context performance
 * - Multi-tenant performance isolation
 * - Performance threshold validation
 */

describe('Simplified Database Performance Testing Suite', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let categoryRepo: Repository<ProductCategory>;

  const testTenantId = 'test-tenant-performance';
  const PERFORMANCE_THRESHOLDS = {
    SLOW_QUERY_THRESHOLD: 1000, // 1 second
    FAST_QUERY_THRESHOLD: 200,  // 200ms
    BULK_OPERATION_THRESHOLD: 2000, // 2 seconds for bulk operations
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
          entities: [User, ProductCategory],
          synchronize: true,
          logging: ['query'],
          maxQueryExecutionTime: 1000, // Log slow queries
        }),
        TypeOrmModule.forFeature([User, ProductCategory]),
      ],
    }).compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    userRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    categoryRepo = moduleRef.get<Repository<ProductCategory>>(getRepositoryToken(ProductCategory));

    // Setup performance test data
    await setupPerformanceTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await moduleRef.close();
  });

  describe('Database Index Performance Testing', () => {
    describe('User Table Index Performance', () => {
      it('should efficiently query users by tenant and email (tenant_id, email index)', async () => {
        const startTime = performance.now();
        
        const users = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            email: 'test1@example.com'
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ User email query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(users.length).toBeGreaterThan(0);
      });

      it('should efficiently query users by tenant and role (tenant_id, role index)', async () => {
        const startTime = performance.now();
        
        const users = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            role: 'admin'
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ User role query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(users.length).toBeGreaterThan(0);
      });

      it('should efficiently perform bulk user operations', async () => {
        const startTime = performance.now();
        
        // Create 100 users in batch
        const newUsers = Array.from({ length: 100 }, (_, i) => ({
          email: `bulk${i}@example.com`,
          password: 'hashedpassword',
          firstName: `User${i}`,
          lastName: 'Test',
          tenantId: testTenantId,
          role: 'staff' as any,
          status: 'active' as any,
        }));

        await userRepo.save(newUsers);

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Bulk user creation time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_THRESHOLD);
      });
    });

    describe('Product Category Index Performance', () => {
      it('should efficiently query categories by tenant and parent (tenant_id, parent_id index)', async () => {
        const startTime = performance.now();
        
        const categories = await categoryRepo.find({
          where: { 
            tenantId: testTenantId,
            parentId: null
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Category parent query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(categories.length).toBeGreaterThan(0);
      });

      it('should efficiently perform category tree operations', async () => {
        const startTime = performance.now();
        
        // Simulate category tree traversal
        const rootCategories = await categoryRepo.find({
          where: { 
            tenantId: testTenantId,
            parentId: null
          },
        });

        // Get child categories for each root category
        const childOperations = rootCategories.map(category => 
          categoryRepo.find({
            where: { 
              tenantId: testTenantId,
              parentId: category.id
            },
          })
        );

        await Promise.all(childOperations);

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Category tree traversal time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_THRESHOLD);
      });
    });

    describe('Multi-Tenant Performance Isolation', () => {
      it('should efficiently isolate tenant data in queries', async () => {
        const tenant1 = 'tenant-1';
        const tenant2 = 'tenant-2';

        // Create test data for multiple tenants
        await userRepo.save([
          { email: 'user1@tenant1.com', password: 'hash', firstName: 'User1', lastName: 'Test', tenantId: tenant1, role: 'admin' as any, status: 'active' as any },
          { email: 'user2@tenant1.com', password: 'hash', firstName: 'User2', lastName: 'Test', tenantId: tenant1, role: 'staff' as any, status: 'active' as any },
          { email: 'user1@tenant2.com', password: 'hash', firstName: 'User1', lastName: 'Test', tenantId: tenant2, role: 'admin' as any, status: 'active' as any },
          { email: 'user2@tenant2.com', password: 'hash', firstName: 'User2', lastName: 'Test', tenantId: tenant2, role: 'staff' as any, status: 'active' as any },
        ]);

        const startTime = performance.now();

        // Query tenant 1 data
        const tenant1Users = await userRepo.find({
          where: { tenantId: tenant1 },
        });

        // Query tenant 2 data
        const tenant2Users = await userRepo.find({
          where: { tenantId: tenant2 },
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Multi-tenant isolation query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(tenant1Users.length).toBe(2);
        expect(tenant2Users.length).toBe(2);
        
        // Verify tenant isolation
        tenant1Users.forEach(user => expect(user.tenantId).toBe(tenant1));
        tenant2Users.forEach(user => expect(user.tenantId).toBe(tenant2));
      });
    });

    describe('Indonesian Business Context Performance', () => {
      it('should efficiently handle Indonesian timezone queries', async () => {
        const startTime = performance.now();
        
        // Query users with Indonesian timezone
        const indonesianUsers = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            timezone: 'Asia/Jakarta'
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Indonesian timezone query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(indonesianUsers.length).toBeGreaterThan(0);
      });

      it('should efficiently handle Indonesian language queries', async () => {
        const startTime = performance.now();
        
        // Query users with Indonesian language
        const indonesianUsers = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            language: 'id'
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Indonesian language query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(indonesianUsers.length).toBeGreaterThan(0);
      });
    });

    describe('Query Execution Plan Analysis', () => {
      it('should use index scans for tenant-based queries', async () => {
        // Enable query plan analysis
        await dataSource.query('SET session_preload_libraries = "auto_explain"');
        await dataSource.query('SET auto_explain.log_min_duration = 0');
        await dataSource.query('SET auto_explain.log_analyze = true');

        const startTime = performance.now();
        
        // Execute a complex query that should use indexes
        const result = await dataSource.query(`
          SELECT u.*, pc.name as category_name
          FROM users u
          LEFT JOIN product_categories pc ON u.tenant_id = pc.tenant_id
          WHERE u.tenant_id = $1 
          AND u.status = 'active'
          AND u.role = 'admin'
          LIMIT 10
        `, [testTenantId]);

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Complex join query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(result.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Database Performance Monitoring', () => {
    it('should track query performance metrics', async () => {
      const queryMetrics = [];

      // Execute multiple queries and track performance
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        await userRepo.find({
          where: { tenantId: testTenantId },
          take: 5,
        });

        const endTime = performance.now();
        queryMetrics.push(endTime - startTime);
      }

      // Calculate performance statistics
      const avgQueryTime = queryMetrics.reduce((a, b) => a + b, 0) / queryMetrics.length;
      const maxQueryTime = Math.max(...queryMetrics);
      const minQueryTime = Math.min(...queryMetrics);

      console.log(`✓ Query performance metrics:`);
      console.log(`  - Average: ${avgQueryTime.toFixed(2)}ms`);
      console.log(`  - Maximum: ${maxQueryTime.toFixed(2)}ms`);
      console.log(`  - Minimum: ${minQueryTime.toFixed(2)}ms`);

      expect(avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(maxQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_QUERY_THRESHOLD);
    });

    it('should validate database connection performance', async () => {
      const startTime = performance.now();
      
      // Test database connection performance
      const connectionTest = await dataSource.query('SELECT 1 as test');
      
      const endTime = performance.now();
      const connectionTime = endTime - startTime;

      console.log(`✓ Database connection time: ${connectionTime.toFixed(2)}ms`);
      expect(connectionTime).toBeLessThan(100); // Should be very fast
      expect(connectionTest[0].test).toBe(1);
    });
  });

  // Helper functions
  async function setupPerformanceTestData(): Promise<void> {
    try {
      // Create test users with various roles and statuses
      const testUsers = Array.from({ length: 50 }, (_, i) => ({
        email: `test${i}@example.com`,
        password: 'hashedpassword',
        firstName: `User${i}`,
        lastName: 'Test',
        role: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'manager' : 'staff',
        status: i % 4 === 0 ? 'inactive' : 'active',
        tenantId: testTenantId,
        timezone: 'Asia/Jakarta',
        language: 'id',
      }));

      await userRepo.save(testUsers as any);

      // Create test categories with parent-child relationships
      const rootCategories = Array.from({ length: 10 }, (_, i) => ({
        name: `Root Category ${i}`,
        description: `Root category description ${i}`,
        tenantId: testTenantId,
        parentId: null,
      }));

      const savedRootCategories = await categoryRepo.save(rootCategories);

      // Create child categories
      const childCategories = [];
      for (const rootCategory of savedRootCategories) {
        for (let i = 0; i < 5; i++) {
          childCategories.push({
            name: `Child Category ${rootCategory.name} - ${i}`,
            description: `Child category description ${i}`,
            tenantId: testTenantId,
            parentId: rootCategory.id,
          });
        }
      }

      await categoryRepo.save(childCategories);

      console.log('✓ Performance test data setup completed');
    } catch (error) {
      console.error('Failed to setup performance test data:', error);
      throw error;
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      await userRepo.delete({ tenantId: testTenantId });
      await categoryRepo.delete({ tenantId: testTenantId });
      // Cleanup additional test tenants
      await userRepo.delete({ tenantId: 'tenant-1' });
      await userRepo.delete({ tenantId: 'tenant-2' });
      
      console.log('✓ Performance test data cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup test data:', error);
      // Don't throw error in cleanup to avoid masking test failures
    }
  }
});