import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { performance } from 'perf_hooks';
import * as moment from 'moment-timezone';

import { PerformanceCacheService } from '../../src/common/services/performance-cache.service';
import { IndonesianBusinessCalendarService } from '../../src/ml-forecasting/services/indonesian-business-calendar.service';
import { ProductsOptimizedService } from '../../src/products/services/products-optimized.service';

/**
 * PHASE 4.2.3: Cache Performance Testing Suite
 * 
 * Comprehensive testing of multi-level caching strategy implemented in Phase 3:
 * - Level 1: In-Memory Cache (Hot Data) - 30 seconds TTL
 * - Level 2: Redis Cache (Warm Data) - 15-30 minutes TTL  
 * - Level 3: Application Cache (Cold Data) - 1-24 hours TTL
 * 
 * Tests include:
 * - Cache hit ratio validation (target: >85%)
 * - Cache performance across all levels
 * - Indonesian business context caching
 * - Event-driven cache invalidation
 * - Multi-tenant cache isolation
 * - Cache warming strategies
 * - Performance degradation detection
 */

describe('Cache Performance Testing Suite', () => {
  let moduleRef: TestingModule;
  let performanceCacheService: PerformanceCacheService;
  let indonesianBusinessCalendarService: IndonesianBusinessCalendarService;
  let productsOptimizedService: ProductsOptimizedService;

  const testTenantId = 'test-tenant-cache-performance';
  const CACHE_PERFORMANCE_THRESHOLDS = {
    HIT_RATIO_THRESHOLD: 0.85, // 85% cache hit ratio
    HOT_CACHE_RESPONSE_TIME: 5, // 5ms for hot cache
    WARM_CACHE_RESPONSE_TIME: 50, // 50ms for warm cache
    COLD_CACHE_RESPONSE_TIME: 200, // 200ms for cold cache
    CACHE_INVALIDATION_TIME: 100, // 100ms for cache invalidation
    CACHE_WARMING_TIME: 1000, // 1 second for cache warming
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        CacheModule.register({
          ttl: 5,
          max: 1000, // Increased cache size for testing
        }),
      ],
      providers: [
        PerformanceCacheService,
        IndonesianBusinessCalendarService,
        {
          provide: ProductsOptimizedService,
          useValue: {
            findOptimizedProducts: jest.fn(),
            getProductAnalytics: jest.fn(),
            getCategoryAnalytics: jest.fn(),
          },
        },
      ],
    }).compile();

    performanceCacheService = moduleRef.get<PerformanceCacheService>(PerformanceCacheService);
    indonesianBusinessCalendarService = moduleRef.get<IndonesianBusinessCalendarService>(
      IndonesianBusinessCalendarService
    );
    productsOptimizedService = moduleRef.get<ProductsOptimizedService>(ProductsOptimizedService);

    // Setup test data
    await setupCacheTestData();
  });

  afterAll(async () => {
    await cleanupCacheTestData();
    await moduleRef.close();
  });

  beforeEach(async () => {
    // Clear all caches before each test
    await performanceCacheService.clearAll();
  });

  describe('Multi-Level Cache Strategy Testing', () => {
    describe('Level 1: Hot Cache (In-Memory, 30s TTL)', () => {
      it('should efficiently cache and retrieve tenant configuration', async () => {
        const tenantConfig = {
          id: testTenantId,
          name: 'Test Tenant',
          settings: {
            timezone: 'Asia/Jakarta',
            language: 'id',
            currency: 'IDR',
          },
          features: ['ANALYTICS', 'ML_FORECASTING', 'MULTI_CHANNEL'],
        };

        // First call - cache miss
        const startTime1 = performance.now();
        await performanceCacheService.setTenantConfig(testTenantId, tenantConfig);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Second call - cache hit
        const startTime2 = performance.now();
        const cachedConfig = await performanceCacheService.getTenantConfig(testTenantId);
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedConfig).toEqual(tenantConfig);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
      });

      it('should efficiently cache user profiles with 1-minute TTL', async () => {
        const userProfile = {
          id: 'test-user-id',
          tenantId: testTenantId,
          email: 'test@example.com',
          role: 'MANAGER',
          preferences: {
            language: 'id',
            timezone: 'Asia/Jakarta',
            notifications: true,
          },
          lastLoginAt: new Date().toISOString(),
        };

        // Cache user profile
        const startTime1 = performance.now();
        await performanceCacheService.setUserProfile('test-user-id', userProfile);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached user profile
        const startTime2 = performance.now();
        const cachedProfile = await performanceCacheService.getUserProfile('test-user-id');
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedProfile).toEqual(userProfile);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
      });

      it('should efficiently cache active products with 2-minute TTL', async () => {
        const activeProducts = Array.from({ length: 50 }, (_, i) => ({
          id: `product-${i}`,
          tenantId: testTenantId,
          sku: `ACTIVE-${i.toString().padStart(3, '0')}`,
          name: `Active Product ${i}`,
          status: 'active',
          quantityOnHand: Math.floor(Math.random() * 1000),
          sellingPrice: Math.floor(Math.random() * 100000) + 10000,
        }));

        // Cache active products
        const startTime1 = performance.now();
        await performanceCacheService.setActiveProducts(testTenantId, activeProducts);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached active products
        const startTime2 = performance.now();
        const cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedProducts).toEqual(activeProducts);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
      });

      it('should handle hot cache TTL expiration correctly', async () => {
        const testData = { key: 'test-value', timestamp: Date.now() };
        const cacheKey = 'test-hot-cache-expiry';

        // Cache with very short TTL (1 second)
        await performanceCacheService.setCacheLevel('hot', cacheKey, testData, 1);

        // Immediate retrieval should work
        const immediateResult = await performanceCacheService.getCacheLevel('hot', cacheKey);
        expect(immediateResult).toEqual(testData);

        // Wait for TTL expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Should return null after TTL expiration
        const expiredResult = await performanceCacheService.getCacheLevel('hot', cacheKey);
        expect(expiredResult).toBeNull();
      });
    });

    describe('Level 2: Warm Cache (Redis, 15-30 minutes TTL)', () => {
      it('should efficiently cache product lists with 15-minute TTL', async () => {
        const productList = {
          tenantId: testTenantId,
          category: 'electronics',
          products: Array.from({ length: 100 }, (_, i) => ({
            id: `product-${i}`,
            name: `Product ${i}`,
            price: Math.floor(Math.random() * 500000) + 50000,
          })),
          pagination: {
            page: 1,
            limit: 100,
            total: 100,
          },
        };

        // Cache product list
        const startTime1 = performance.now();
        await performanceCacheService.setProductList(testTenantId, 'electronics', productList);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached product list
        const startTime2 = performance.now();
        const cachedList = await performanceCacheService.getProductList(testTenantId, 'electronics');
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedList).toEqual(productList);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      });

      it('should efficiently cache inventory levels with 30-minute TTL', async () => {
        const inventoryLevels = {
          tenantId: testTenantId,
          location: 'warehouse-1',
          items: Array.from({ length: 200 }, (_, i) => ({
            productId: `product-${i}`,
            quantityOnHand: Math.floor(Math.random() * 1000),
            quantityReserved: Math.floor(Math.random() * 50),
            reorderPoint: Math.floor(Math.random() * 100) + 10,
            lastMovementDate: new Date().toISOString(),
          })),
          lastUpdated: new Date().toISOString(),
        };

        // Cache inventory levels
        const startTime1 = performance.now();
        await performanceCacheService.setInventoryLevels(testTenantId, 'warehouse-1', inventoryLevels);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached inventory levels
        const startTime2 = performance.now();
        const cachedLevels = await performanceCacheService.getInventoryLevels(testTenantId, 'warehouse-1');
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedLevels).toEqual(inventoryLevels);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      });

      it('should efficiently cache supplier data with 30-minute TTL', async () => {
        const supplierData = {
          tenantId: testTenantId,
          suppliers: Array.from({ length: 50 }, (_, i) => ({
            id: `supplier-${i}`,
            name: `Supplier ${i}`,
            contactInfo: {
              email: `supplier${i}@example.com`,
              phone: `+62-21-${Math.floor(Math.random() * 10000000)}`,
            },
            products: Math.floor(Math.random() * 100) + 10,
            lastOrderDate: new Date().toISOString(),
            performance: {
              onTimeDelivery: Math.random() * 100,
              qualityScore: Math.random() * 100,
            },
          })),
          lastUpdated: new Date().toISOString(),
        };

        // Cache supplier data
        const startTime1 = performance.now();
        await performanceCacheService.setSupplierData(testTenantId, supplierData);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached supplier data
        const startTime2 = performance.now();
        const cachedData = await performanceCacheService.getSupplierData(testTenantId);
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedData).toEqual(supplierData);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      });

      it('should handle warm cache concurrent access efficiently', async () => {
        const cacheKey = 'concurrent-test-warm';
        const testData = { value: 'concurrent-access-test', timestamp: Date.now() };

        // Concurrent set operations
        const setPromises = Array.from({ length: 10 }, (_, i) => 
          performanceCacheService.setCacheLevel('warm', `${cacheKey}-${i}`, { ...testData, id: i }, 900)
        );

        const startTime1 = performance.now();
        await Promise.all(setPromises);
        const endTime1 = performance.now();
        const concurrentSetTime = endTime1 - startTime1;

        // Concurrent get operations
        const getPromises = Array.from({ length: 10 }, (_, i) => 
          performanceCacheService.getCacheLevel('warm', `${cacheKey}-${i}`)
        );

        const startTime2 = performance.now();
        const results = await Promise.all(getPromises);
        const endTime2 = performance.now();
        const concurrentGetTime = endTime2 - startTime2;

        expect(results).toHaveLength(10);
        results.forEach((result, index) => {
          expect(result).toEqual({ ...testData, id: index });
        });
        expect(concurrentSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME * 2);
        expect(concurrentGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      });
    });

    describe('Level 3: Cold Cache (Application, 1-24 hours TTL)', () => {
      it('should efficiently cache analytics data with 1-hour TTL', async () => {
        const analyticsData = {
          tenantId: testTenantId,
          period: 'monthly',
          data: {
            revenue: {
              current: 150000000, // 150 million IDR
              previous: 120000000, // 120 million IDR
              growth: 25.0,
            },
            orders: {
              current: 1250,
              previous: 1000,
              growth: 25.0,
            },
            products: {
              topSelling: Array.from({ length: 10 }, (_, i) => ({
                id: `product-${i}`,
                name: `Top Product ${i}`,
                quantity: Math.floor(Math.random() * 100) + 50,
                revenue: Math.floor(Math.random() * 5000000) + 1000000,
              })),
            },
            customers: {
              new: 75,
              returning: 320,
              ltv: 2500000, // 2.5 million IDR
            },
          },
          generatedAt: new Date().toISOString(),
        };

        // Cache analytics data
        const startTime1 = performance.now();
        await performanceCacheService.setAnalyticsData(testTenantId, 'monthly', analyticsData);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached analytics data
        const startTime2 = performance.now();
        const cachedData = await performanceCacheService.getAnalyticsData(testTenantId, 'monthly');
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedData).toEqual(analyticsData);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE_TIME);
      });

      it('should efficiently cache historical data with 24-hour TTL', async () => {
        const historicalData = {
          tenantId: testTenantId,
          dataType: 'sales_history',
          period: 'last_year',
          data: Array.from({ length: 365 }, (_, i) => ({
            date: moment().subtract(i, 'days').format('YYYY-MM-DD'),
            sales: Math.floor(Math.random() * 5000000) + 1000000,
            orders: Math.floor(Math.random() * 50) + 10,
            customers: Math.floor(Math.random() * 30) + 5,
          })),
          aggregations: {
            totalSales: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            bestDay: null,
            worstDay: null,
          },
          generatedAt: new Date().toISOString(),
        };

        // Calculate aggregations
        historicalData.aggregations.totalSales = historicalData.data.reduce((sum, day) => sum + day.sales, 0);
        historicalData.aggregations.totalOrders = historicalData.data.reduce((sum, day) => sum + day.orders, 0);
        historicalData.aggregations.avgOrderValue = historicalData.aggregations.totalSales / historicalData.aggregations.totalOrders;

        // Cache historical data
        const startTime1 = performance.now();
        await performanceCacheService.setHistoricalData(testTenantId, 'sales_history', historicalData);
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve cached historical data
        const startTime2 = performance.now();
        const cachedData = await performanceCacheService.getHistoricalData(testTenantId, 'sales_history');
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedData).toEqual(historicalData);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE_TIME);
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE_TIME);
      });

      it('should handle large cold cache data efficiently', async () => {
        const largeData = {
          tenantId: testTenantId,
          dataType: 'product_catalog',
          products: Array.from({ length: 5000 }, (_, i) => ({
            id: `product-${i}`,
            sku: `LARGE-${i.toString().padStart(5, '0')}`,
            name: `Large Catalog Product ${i}`,
            description: `This is a detailed description for product ${i} with extensive information about features, specifications, and usage instructions.`,
            category: `category-${i % 50}`,
            price: Math.floor(Math.random() * 1000000) + 10000,
            attributes: {
              color: ['Red', 'Blue', 'Green', 'Yellow'][Math.floor(Math.random() * 4)],
              size: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
              material: ['Cotton', 'Polyester', 'Wool', 'Silk'][Math.floor(Math.random() * 4)],
              weight: Math.floor(Math.random() * 5000) + 100,
            },
            variants: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, j) => ({
              id: `variant-${i}-${j}`,
              sku: `${i}-${j}`,
              attributes: { variant: j },
              price: Math.floor(Math.random() * 1000000) + 10000,
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          metadata: {
            totalProducts: 5000,
            totalCategories: 50,
            generatedAt: new Date().toISOString(),
          },
        };

        // Cache large data
        const startTime1 = performance.now();
        await performanceCacheService.setCacheLevel('cold', 'large-product-catalog', largeData, 86400); // 24 hours
        const endTime1 = performance.now();
        const cacheSetTime = endTime1 - startTime1;

        // Retrieve large cached data
        const startTime2 = performance.now();
        const cachedData = await performanceCacheService.getCacheLevel('cold', 'large-product-catalog');
        const endTime2 = performance.now();
        const cacheGetTime = endTime2 - startTime2;

        expect(cachedData).toEqual(largeData);
        expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE_TIME * 2); // Allow 2x for large data
        expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE_TIME * 2); // Allow 2x for large data
      });
    });
  });

  describe('Indonesian Business Context Caching', () => {
    it('should efficiently cache Indonesian business hours optimization', async () => {
      const businessHoursData = {
        tenantId: testTenantId,
        timezone: 'Asia/Jakarta',
        businessHours: {
          monday: { start: '08:00', end: '17:00' },
          tuesday: { start: '08:00', end: '17:00' },
          wednesday: { start: '08:00', end: '17:00' },
          thursday: { start: '08:00', end: '17:00' },
          friday: { start: '08:00', end: '17:00' },
          saturday: { start: '08:00', end: '13:00' },
          sunday: { closed: true },
        },
        peakHours: {
          morning: { start: '09:00', end: '11:00' },
          afternoon: { start: '13:00', end: '15:00' },
        },
        ramadanHours: {
          start: '08:00',
          end: '15:00',
          breakFasting: '18:00',
        },
        cacheOptimization: {
          peakHoursTTL: 300, // 5 minutes during peak hours
          offPeakTTL: 1800, // 30 minutes during off-peak
          ramadanTTL: 600, // 10 minutes during Ramadan
        },
      };

      // Cache business hours data
      const startTime1 = performance.now();
      await performanceCacheService.setIndonesianBusinessHours(testTenantId, businessHoursData);
      const endTime1 = performance.now();
      const cacheSetTime = endTime1 - startTime1;

      // Retrieve cached business hours data
      const startTime2 = performance.now();
      const cachedData = await performanceCacheService.getIndonesianBusinessHours(testTenantId);
      const endTime2 = performance.now();
      const cacheGetTime = endTime2 - startTime2;

      expect(cachedData).toEqual(businessHoursData);
      expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
    });

    it('should efficiently cache Indonesian holiday calendar data', async () => {
      const holidayData = {
        tenantId: testTenantId,
        year: 2025,
        holidays: [
          { date: '2025-01-01', name: 'Tahun Baru Masehi', type: 'national' },
          { date: '2025-01-29', name: 'Tahun Baru Imlek', type: 'national' },
          { date: '2025-02-28', name: 'Isra Miraj', type: 'religious' },
          { date: '2025-03-20', name: 'Hari Raya Nyepi', type: 'religious' },
          { date: '2025-03-30', name: 'Hari Raya Idul Fitri', type: 'religious' },
          { date: '2025-03-31', name: 'Hari Raya Idul Fitri', type: 'religious' },
          { date: '2025-05-01', name: 'Hari Buruh', type: 'national' },
          { date: '2025-05-08', name: 'Kenaikan Isa Al-Masih', type: 'religious' },
          { date: '2025-05-29', name: 'Waisak', type: 'religious' },
          { date: '2025-06-05', name: 'Hari Raya Idul Adha', type: 'religious' },
          { date: '2025-06-26', name: 'Tahun Baru Hijriyah', type: 'religious' },
          { date: '2025-08-17', name: 'Hari Kemerdekaan', type: 'national' },
          { date: '2025-09-04', name: 'Maulid Nabi Muhammad', type: 'religious' },
          { date: '2025-12-25', name: 'Hari Raya Natal', type: 'religious' },
        ],
        businessImpact: {
          ramadanPeriod: { start: '2025-02-28', end: '2025-03-29' },
          lebaranPeriod: { start: '2025-03-30', end: '2025-04-06' },
          longWeekends: [
            { start: '2025-03-29', end: '2025-04-06', name: 'Lebaran Long Weekend' },
            { start: '2025-08-15', end: '2025-08-18', name: 'Independence Day Long Weekend' },
          ],
        },
      };

      // Cache holiday data
      const startTime1 = performance.now();
      await performanceCacheService.setIndonesianHolidays(testTenantId, 2025, holidayData);
      const endTime1 = performance.now();
      const cacheSetTime = endTime1 - startTime1;

      // Retrieve cached holiday data
      const startTime2 = performance.now();
      const cachedData = await performanceCacheService.getIndonesianHolidays(testTenantId, 2025);
      const endTime2 = performance.now();
      const cacheGetTime = endTime2 - startTime2;

      expect(cachedData).toEqual(holidayData);
      expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
    });

    it('should efficiently cache Indonesian payment method preferences', async () => {
      const paymentMethodData = {
        tenantId: testTenantId,
        preferences: {
          qris: { usage: 35.2, avgAmount: 125000 },
          gopay: { usage: 22.1, avgAmount: 87500 },
          ovo: { usage: 18.5, avgAmount: 95000 },
          dana: { usage: 12.3, avgAmount: 110000 },
          shopeepay: { usage: 8.7, avgAmount: 75000 },
          bankTransfer: { usage: 2.8, avgAmount: 850000 },
          cod: { usage: 0.4, avgAmount: 45000 },
        },
        trends: {
          digitalPayments: 96.8,
          cashOnDelivery: 3.2,
          monthlyGrowth: {
            qris: 15.2,
            gopay: 8.5,
            ovo: 5.3,
            dana: 12.1,
            shopeepay: 18.7,
          },
        },
        regional: {
          jakarta: { qris: 40.1, gopay: 25.3, ovo: 20.2 },
          surabaya: { qris: 32.5, gopay: 28.1, ovo: 18.9 },
          bandung: { qris: 38.7, gopay: 22.4, ovo: 19.5 },
          medan: { qris: 29.8, gopay: 24.6, ovo: 21.3 },
        },
      };

      // Cache payment method data
      const startTime1 = performance.now();
      await performanceCacheService.setIndonesianPaymentMethods(testTenantId, paymentMethodData);
      const endTime1 = performance.now();
      const cacheSetTime = endTime1 - startTime1;

      // Retrieve cached payment method data
      const startTime2 = performance.now();
      const cachedData = await performanceCacheService.getIndonesianPaymentMethods(testTenantId);
      const endTime2 = performance.now();
      const cacheGetTime = endTime2 - startTime2;

      expect(cachedData).toEqual(paymentMethodData);
      expect(cacheGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      expect(cacheSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
    });
  });

  describe('Event-Driven Cache Invalidation', () => {
    it('should efficiently invalidate related caches when product data changes', async () => {
      const productData = {
        id: 'product-123',
        tenantId: testTenantId,
        name: 'Test Product',
        price: 100000,
        categoryId: 'category-1',
      };

      // Cache product data and related caches
      await performanceCacheService.setActiveProducts(testTenantId, [productData]);
      await performanceCacheService.setProductList(testTenantId, 'category-1', { products: [productData] });
      await performanceCacheService.setAnalyticsData(testTenantId, 'daily', { products: [productData] });

      // Verify data is cached
      let cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);
      let cachedList = await performanceCacheService.getProductList(testTenantId, 'category-1');
      let cachedAnalytics = await performanceCacheService.getAnalyticsData(testTenantId, 'daily');

      expect(cachedProducts).toEqual([productData]);
      expect(cachedList).toEqual({ products: [productData] });
      expect(cachedAnalytics).toEqual({ products: [productData] });

      // Invalidate product-related caches
      const startTime = performance.now();
      await performanceCacheService.invalidateProductCaches(testTenantId, 'product-123');
      const endTime = performance.now();
      const invalidationTime = endTime - startTime;

      // Verify caches are invalidated
      cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);
      cachedList = await performanceCacheService.getProductList(testTenantId, 'category-1');
      cachedAnalytics = await performanceCacheService.getAnalyticsData(testTenantId, 'daily');

      expect(cachedProducts).toBeNull();
      expect(cachedList).toBeNull();
      expect(cachedAnalytics).toBeNull();
      expect(invalidationTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.CACHE_INVALIDATION_TIME);
    });

    it('should efficiently invalidate inventory-related caches when inventory changes', async () => {
      const inventoryData = {
        productId: 'product-123',
        tenantId: testTenantId,
        locationId: 'location-1',
        quantityOnHand: 100,
        reorderPoint: 20,
      };

      // Cache inventory data and related caches
      await performanceCacheService.setInventoryLevels(testTenantId, 'location-1', [inventoryData]);
      await performanceCacheService.setActiveProducts(testTenantId, [{ id: 'product-123', quantity: 100 }]);

      // Verify data is cached
      let cachedInventory = await performanceCacheService.getInventoryLevels(testTenantId, 'location-1');
      let cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);

      expect(cachedInventory).toEqual([inventoryData]);
      expect(cachedProducts).toEqual([{ id: 'product-123', quantity: 100 }]);

      // Invalidate inventory-related caches
      const startTime = performance.now();
      await performanceCacheService.invalidateInventoryCaches(testTenantId, 'product-123', 'location-1');
      const endTime = performance.now();
      const invalidationTime = endTime - startTime;

      // Verify caches are invalidated
      cachedInventory = await performanceCacheService.getInventoryLevels(testTenantId, 'location-1');
      cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);

      expect(cachedInventory).toBeNull();
      expect(cachedProducts).toBeNull();
      expect(invalidationTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.CACHE_INVALIDATION_TIME);
    });

    it('should efficiently handle tenant-wide cache invalidation', async () => {
      // Cache multiple types of data
      await performanceCacheService.setTenantConfig(testTenantId, { name: 'Test Tenant' });
      await performanceCacheService.setActiveProducts(testTenantId, [{ id: 'product-1' }]);
      await performanceCacheService.setAnalyticsData(testTenantId, 'daily', { revenue: 1000000 });
      await performanceCacheService.setInventoryLevels(testTenantId, 'location-1', [{ productId: 'product-1' }]);

      // Verify data is cached
      let cachedConfig = await performanceCacheService.getTenantConfig(testTenantId);
      let cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);
      let cachedAnalytics = await performanceCacheService.getAnalyticsData(testTenantId, 'daily');
      let cachedInventory = await performanceCacheService.getInventoryLevels(testTenantId, 'location-1');

      expect(cachedConfig).toEqual({ name: 'Test Tenant' });
      expect(cachedProducts).toEqual([{ id: 'product-1' }]);
      expect(cachedAnalytics).toEqual({ revenue: 1000000 });
      expect(cachedInventory).toEqual([{ productId: 'product-1' }]);

      // Invalidate all tenant caches
      const startTime = performance.now();
      await performanceCacheService.invalidateTenantCaches(testTenantId);
      const endTime = performance.now();
      const invalidationTime = endTime - startTime;

      // Verify all caches are invalidated
      cachedConfig = await performanceCacheService.getTenantConfig(testTenantId);
      cachedProducts = await performanceCacheService.getActiveProducts(testTenantId);
      cachedAnalytics = await performanceCacheService.getAnalyticsData(testTenantId, 'daily');
      cachedInventory = await performanceCacheService.getInventoryLevels(testTenantId, 'location-1');

      expect(cachedConfig).toBeNull();
      expect(cachedProducts).toBeNull();
      expect(cachedAnalytics).toBeNull();
      expect(cachedInventory).toBeNull();
      expect(invalidationTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.CACHE_INVALIDATION_TIME * 2); // Allow 2x for tenant-wide
    });
  });

  describe('Multi-Tenant Cache Isolation', () => {
    it('should maintain cache isolation between tenants', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';
      const tenant3 = 'tenant-3';

      const tenant1Data = { name: 'Tenant 1', products: ['product-1-1', 'product-1-2'] };
      const tenant2Data = { name: 'Tenant 2', products: ['product-2-1', 'product-2-2'] };
      const tenant3Data = { name: 'Tenant 3', products: ['product-3-1', 'product-3-2'] };

      // Cache data for different tenants
      await performanceCacheService.setTenantConfig(tenant1, tenant1Data);
      await performanceCacheService.setTenantConfig(tenant2, tenant2Data);
      await performanceCacheService.setTenantConfig(tenant3, tenant3Data);

      // Verify each tenant gets their own data
      const cachedTenant1 = await performanceCacheService.getTenantConfig(tenant1);
      const cachedTenant2 = await performanceCacheService.getTenantConfig(tenant2);
      const cachedTenant3 = await performanceCacheService.getTenantConfig(tenant3);

      expect(cachedTenant1).toEqual(tenant1Data);
      expect(cachedTenant2).toEqual(tenant2Data);
      expect(cachedTenant3).toEqual(tenant3Data);

      // Invalidate one tenant's cache
      await performanceCacheService.invalidateTenantCaches(tenant2);

      // Verify only tenant2's cache is invalidated
      const cachedTenant1After = await performanceCacheService.getTenantConfig(tenant1);
      const cachedTenant2After = await performanceCacheService.getTenantConfig(tenant2);
      const cachedTenant3After = await performanceCacheService.getTenantConfig(tenant3);

      expect(cachedTenant1After).toEqual(tenant1Data);
      expect(cachedTenant2After).toBeNull();
      expect(cachedTenant3After).toEqual(tenant3Data);
    });

    it('should handle concurrent cache operations across tenants', async () => {
      const tenants = ['tenant-1', 'tenant-2', 'tenant-3', 'tenant-4', 'tenant-5'];
      const testData = tenants.map(tenant => ({ tenant, data: { name: tenant, value: Math.random() } }));

      // Concurrent cache operations
      const startTime = performance.now();
      await Promise.all(testData.map(({ tenant, data }) => 
        performanceCacheService.setTenantConfig(tenant, data)
      ));
      const endTime = performance.now();
      const concurrentSetTime = endTime - startTime;

      // Concurrent cache retrieval
      const startTime2 = performance.now();
      const results = await Promise.all(tenants.map(tenant => 
        performanceCacheService.getTenantConfig(tenant)
      ));
      const endTime2 = performance.now();
      const concurrentGetTime = endTime2 - startTime2;

      // Verify results
      results.forEach((result, index) => {
        expect(result).toEqual(testData[index].data);
      });

      expect(concurrentSetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
      expect(concurrentGetTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE_TIME);
    });
  });

  describe('Cache Performance Monitoring', () => {
    it('should track cache hit ratios across all levels', async () => {
      const testKey = 'performance-monitoring-test';
      const testData = { value: 'cache-hit-test', timestamp: Date.now() };

      // Clear cache monitoring metrics
      await performanceCacheService.clearMetrics();

      // Generate cache misses and hits
      for (let i = 0; i < 10; i++) {
        await performanceCacheService.getCacheLevel('hot', `${testKey}-${i}`); // Cache miss
        await performanceCacheService.setCacheLevel('hot', `${testKey}-${i}`, testData, 300);
        await performanceCacheService.getCacheLevel('hot', `${testKey}-${i}`); // Cache hit
      }

      // Get cache metrics
      const metrics = await performanceCacheService.getCacheMetrics();

      expect(metrics.hot.hits).toBe(10);
      expect(metrics.hot.misses).toBe(10);
      expect(metrics.hot.hitRatio).toBe(0.5);
      expect(metrics.hot.totalRequests).toBe(20);
    });

    it('should track cache performance across different levels', async () => {
      const testData = { value: 'multi-level-test', timestamp: Date.now() };
      
      // Clear metrics
      await performanceCacheService.clearMetrics();

      // Test all cache levels
      const levels = ['hot', 'warm', 'cold'];
      for (const level of levels) {
        // Generate cache operations
        for (let i = 0; i < 5; i++) {
          await performanceCacheService.getCacheLevel(level, `test-${i}`); // Miss
          await performanceCacheService.setCacheLevel(level, `test-${i}`, testData, 300);
          await performanceCacheService.getCacheLevel(level, `test-${i}`); // Hit
          await performanceCacheService.getCacheLevel(level, `test-${i}`); // Hit
        }
      }

      const metrics = await performanceCacheService.getCacheMetrics();

      // Verify metrics for each level
      levels.forEach(level => {
        expect(metrics[level].hits).toBe(10); // 2 hits per iteration * 5 iterations
        expect(metrics[level].misses).toBe(5); // 1 miss per iteration * 5 iterations
        expect(metrics[level].hitRatio).toBeCloseTo(0.67, 2); // 10/15 = 0.67
        expect(metrics[level].totalRequests).toBe(15);
      });
    });

    it('should track cache response times and identify slow operations', async () => {
      const testData = { value: 'response-time-test', timestamp: Date.now() };
      
      // Clear metrics
      await performanceCacheService.clearMetrics();

      // Perform cache operations and measure response times
      for (let i = 0; i < 20; i++) {
        await performanceCacheService.setCacheLevel('hot', `response-test-${i}`, testData, 300);
        await performanceCacheService.getCacheLevel('hot', `response-test-${i}`);
      }

      const metrics = await performanceCacheService.getCacheMetrics();

      expect(metrics.hot.avgResponseTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME);
      expect(metrics.hot.maxResponseTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE_TIME * 2);
      expect(metrics.hot.minResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Cache Warming Strategies', () => {
    it('should efficiently warm up tenant configuration cache', async () => {
      const tenantIds = ['tenant-1', 'tenant-2', 'tenant-3', 'tenant-4', 'tenant-5'];
      const tenantConfigs = tenantIds.map(id => ({
        id,
        name: `Tenant ${id}`,
        settings: { timezone: 'Asia/Jakarta', currency: 'IDR' }
      }));

      // Clear all caches
      await performanceCacheService.clearAll();

      // Warm up caches
      const startTime = performance.now();
      await performanceCacheService.warmUpTenantConfigs(tenantConfigs);
      const endTime = performance.now();
      const warmUpTime = endTime - startTime;

      // Verify caches are warmed
      for (const config of tenantConfigs) {
        const cachedConfig = await performanceCacheService.getTenantConfig(config.id);
        expect(cachedConfig).toEqual(config);
      }

      expect(warmUpTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.CACHE_WARMING_TIME);
    });

    it('should efficiently warm up product catalog cache', async () => {
      const productCatalog = Array.from({ length: 100 }, (_, i) => ({
        id: `product-${i}`,
        tenantId: testTenantId,
        name: `Product ${i}`,
        price: Math.floor(Math.random() * 100000) + 10000,
        category: `category-${i % 10}`,
      }));

      // Clear all caches
      await performanceCacheService.clearAll();

      // Warm up product catalog cache
      const startTime = performance.now();
      await performanceCacheService.warmUpProductCatalog(testTenantId, productCatalog);
      const endTime = performance.now();
      const warmUpTime = endTime - startTime;

      // Verify product catalog is cached
      const cachedCatalog = await performanceCacheService.getProductCatalog(testTenantId);
      expect(cachedCatalog).toEqual(productCatalog);

      expect(warmUpTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.CACHE_WARMING_TIME);
    });

    it('should efficiently warm up Indonesian business context cache', async () => {
      const businessContext = {
        tenantId: testTenantId,
        timezone: 'Asia/Jakarta',
        businessHours: { start: '08:00', end: '17:00' },
        holidays: [
          { date: '2025-01-01', name: 'New Year' },
          { date: '2025-08-17', name: 'Independence Day' },
        ],
        paymentMethods: ['QRIS', 'GOPAY', 'OVO', 'DANA'],
        region: 'Jakarta',
      };

      // Clear all caches
      await performanceCacheService.clearAll();

      // Warm up business context cache
      const startTime = performance.now();
      await performanceCacheService.warmUpIndonesianBusinessContext(testTenantId, businessContext);
      const endTime = performance.now();
      const warmUpTime = endTime - startTime;

      // Verify business context is cached
      const cachedContext = await performanceCacheService.getIndonesianBusinessContext(testTenantId);
      expect(cachedContext).toEqual(businessContext);

      expect(warmUpTime).toBeLessThan(CACHE_PERFORMANCE_THRESHOLDS.CACHE_WARMING_TIME);
    });
  });

  // Helper functions
  async function setupCacheTestData(): Promise<void> {
    // Setup is handled in individual test cases
    console.log('Cache test environment setup completed');
  }

  async function cleanupCacheTestData(): Promise<void> {
    // Clear all caches
    await performanceCacheService.clearAll();
    console.log('Cache test environment cleanup completed');
  }
});