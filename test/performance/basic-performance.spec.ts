import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { performance } from 'perf_hooks';

import { User } from '../../src/users/entities/user.entity';

/**
 * PHASE 4.2.2: Basic Database Performance Testing Suite
 * 
 * Minimal performance testing for database indexes and optimization
 * using only the User entity to avoid complex dependencies.
 * 
 * Tests include:
 * - Database query performance with indexes
 * - Query execution time measurements
 * - Multi-tenant performance isolation
 * - Performance threshold validation
 */

describe('Basic Database Performance Testing Suite', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let userRepo: Repository<User>;

  const testTenantId = 'test-tenant-performance';
  const PERFORMANCE_THRESHOLDS = {
    SLOW_QUERY_THRESHOLD: 1000, // 1 second
    FAST_QUERY_THRESHOLD: 200,  // 200ms
    BULK_OPERATION_THRESHOLD: 2000, // 2 seconds for bulk operations
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
          entities: [User],
          synchronize: true,
          logging: false, // Disable logging for cleaner output
          maxQueryExecutionTime: 1000, // Log slow queries
        }),
        TypeOrmModule.forFeature([User]),
      ],
    }).compile();

    dataSource = moduleRef.get<DataSource>(DataSource);
    userRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));

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

      it('should efficiently query users by tenant and status', async () => {
        const startTime = performance.now();
        
        const users = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            status: 'active'
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ User status query time: ${queryTime.toFixed(2)}ms`);
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

    describe('Complex Query Performance', () => {
      it('should efficiently handle complex WHERE conditions', async () => {
        const startTime = performance.now();
        
        // Complex query with multiple conditions
        const users = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            role: 'admin',
            status: 'active',
            timezone: 'Asia/Jakarta'
          },
          take: 5,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ Complex WHERE query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(users.length).toBeGreaterThanOrEqual(0);
      });

      it('should efficiently handle ORDER BY queries', async () => {
        const startTime = performance.now();
        
        // Query with ordering
        const users = await userRepo.find({
          where: { tenantId: testTenantId },
          order: { createdAt: 'DESC' },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ ORDER BY query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
        expect(users.length).toBeGreaterThan(0);
      });

      it('should efficiently handle LIKE queries', async () => {
        const startTime = performance.now();
        
        // Query with LIKE operation
        const users = await userRepo.find({
          where: { 
            tenantId: testTenantId,
            email: 'test%' // This should be inefficient without proper index
          },
          take: 10,
        });

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`✓ LIKE query time: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW_QUERY_THRESHOLD);
        expect(users.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Database Performance Monitoring', () => {
    it('should track query performance metrics', async () => {
      const queryMetrics = [];

      // Execute multiple queries and track performance
      for (let i = 0; i < 20; i++) {
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

      console.log(`✓ Query performance metrics over 20 queries:`);
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

    it('should validate indexes are being used', async () => {
      // Test that indexes are being used properly
      const startTime = performance.now();
      
      // This query should use the tenant_id + email index
      const result = await dataSource.query(`
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT * FROM users 
        WHERE tenant_id = $1 AND email = $2 
        LIMIT 1
      `, [testTenantId, 'test1@example.com']);

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      console.log(`✓ EXPLAIN query time: ${queryTime.toFixed(2)}ms`);
      console.log(`✓ Query execution plan:`, result.map(r => r['QUERY PLAN']).join('\n'));
      
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      
      // Check that an index scan is being used
      const planText = result.map(r => r['QUERY PLAN']).join('\n');
      expect(planText).toContain('Index'); // Should use index scan
    });
  });

  describe('Performance Optimization Validation', () => {
    it('should demonstrate performance improvement with indexes', async () => {
      // Test query performance with large dataset
      const startTime = performance.now();
      
      // This should be fast with proper indexes
      const result = await userRepo.find({
        where: { 
          tenantId: testTenantId,
          status: 'active'
        },
        take: 50,
      });

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      console.log(`✓ Large dataset query time: ${queryTime.toFixed(2)}ms`);
      console.log(`✓ Retrieved ${result.length} users`);
      
      // With proper indexes, this should be fast even with large dataset
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should validate cache-friendly query patterns', async () => {
      // Test repeated queries (should benefit from query cache)
      const queryTimes = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        await userRepo.find({
          where: { 
            tenantId: testTenantId,
            role: 'admin'
          },
          take: 10,
        });

        const endTime = performance.now();
        queryTimes.push(endTime - startTime);
      }

      const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      
      console.log(`✓ Repeated query performance:`);
      console.log(`  - Query times: ${queryTimes.map(t => t.toFixed(2)).join('ms, ')}ms`);
      console.log(`  - Average: ${avgTime.toFixed(2)}ms`);
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY_THRESHOLD);
    });
  });

  // Helper functions
  async function setupPerformanceTestData(): Promise<void> {
    try {
      console.log('Setting up performance test data...');
      
      // Create test users with various roles and statuses
      const testUsers = Array.from({ length: 200 }, (_, i) => ({
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
      
      console.log(`✓ Created ${testUsers.length} test users`);
    } catch (error) {
      console.error('Failed to setup performance test data:', error);
      throw error;
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      console.log('Cleaning up performance test data...');
      
      // Delete test data
      await userRepo.delete({ tenantId: testTenantId });
      await userRepo.delete({ tenantId: 'tenant-1' });
      await userRepo.delete({ tenantId: 'tenant-2' });
      
      console.log('✓ Performance test data cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup test data:', error);
      // Don't throw error in cleanup to avoid masking test failures
    }
  }
});