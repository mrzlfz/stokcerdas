/**
 * PHASE 4.3.3: Indonesian SMB Performance Testing Scenarios
 * 
 * ULTRATHINK APPROACH: Comprehensive performance testing tanpa simplifikasi
 * - Real-world Indonesian SMB load patterns (1000+ products, 500+ orders/day)
 * - Multi-platform concurrent operations
 * - Indonesian business context performance impact
 * - Cultural considerations dalam performance testing
 * - Peak shopping hours simulation (Harbolnas, 12.12, Ramadan)
 * 
 * Performance Targets:
 * - API Response Time: < 200ms (p95)
 * - Throughput: > 100 orders/minute
 * - Cache Hit Ratio: > 85%
 * - Error Rate: < 1%
 * - Indonesian Business Context Compliance: 100%
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ComplexSystemTestFactory, OrderSyncTestSystem } from '../factories/complex-system-test.factory';
import { 
  StandardSyncResult,
  IndonesianBusinessContext,
  OrderSyncTestOptions
} from '../factories/complex-system-test.factory';

describe('Phase 4.3.3: Indonesian SMB Performance Testing', () => {
  let app: INestApplication;
  let testSystem: OrderSyncTestSystem;
  let tenantId: string;

  // Performance thresholds untuk Indonesian SMB context
  const PERFORMANCE_THRESHOLDS = {
    API_RESPONSE_TIME: 200,        // < 200ms (p95)
    CACHE_HIT_RATIO: 0.85,         // > 85% cache hits
    HOT_CACHE_RESPONSE: 5,         // < 5ms untuk hot cache
    WARM_CACHE_RESPONSE: 50,       // < 50ms untuk warm cache
    COLD_CACHE_RESPONSE: 200,      // < 200ms untuk cold cache
    THROUGHPUT: 100,               // > 100 orders/minute
    ERROR_RATE: 0.01,              // < 1% error rate
    CONCURRENT_USERS: 50,          // Support 50 concurrent users
    INDONESIAN_COMPLIANCE: 1.0,    // 100% Indonesian business compliance
    RAMADAN_ADJUSTMENT: 1.2,       // 20% longer processing during Ramadan
    PEAK_HOUR_DEGRADATION: 1.5,   // Max 50% degradation during peak hours
  };

  beforeAll(async () => {
    const testOptions: OrderSyncTestOptions = {
      includeShopeeSync: true,
      includeLazadaSync: true,
      includeTokopediaSync: true,
      includeErrorHandling: true,
      includeConflictResolution: true,
      includeIndonesianBusinessContext: true,
      includeDeadLetterQueue: true,
      includePerformanceMetrics: true,
      includeBulkOperations: true,
      includeRealTimeSync: true,
    };

    testSystem = await ComplexSystemTestFactory.createCompleteOrderSyncTest(testOptions);
    app = testSystem.moduleRef.createNestApplication();
    await app.init();
    
    tenantId = 'performance-test-tenant';
    
    // Setup large-scale test data untuk Indonesian SMB simulation
    await testSystem.testHelpers.createComplexTestData({
      orderCount: 1000,        // 1000 orders
      channelCount: 3,         // 3 platforms
      productCount: 2000,      // 2000 products
      userCount: 100,          // 100 users
      includeFailedOrders: true,
      includeConflictingOrders: true,
      includeIndonesianBusinessContext: true,
    });
  });

  afterAll(async () => {
    await testSystem.testHelpers.cleanupComplexData();
    await app.close();
  });

  describe('Indonesian SMB Scale Load Testing', () => {
    test('should handle typical Indonesian SMB daily load (500+ orders/day)', async () => {
      const dailyOrderCount = 500;
      const simulatedDayDuration = 8 * 60 * 60 * 1000; // 8 hours business day
      const batchSize = 50; // Process 50 orders per batch
      const batchCount = Math.ceil(dailyOrderCount / batchSize);

      const performanceMetrics = {
        totalOrders: 0,
        successfulOrders: 0,
        failedOrders: 0,
        totalDuration: 0,
        averageResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        cacheHitRatio: 0,
        platformDistribution: { shopee: 0, lazada: 0, tokopedia: 0 },
        businessHourCompliance: 0,
      };

      const startTime = Date.now();

      // Process orders in batches untuk simulate real-world load
      for (let batch = 0; batch < batchCount; batch++) {
        const currentBatchSize = Math.min(batchSize, dailyOrderCount - (batch * batchSize));
        const batchOrders = [];

        // Generate batch orders dengan Indonesian business patterns
        for (let i = 0; i < currentBatchSize; i++) {
          const orderIndex = (batch * batchSize) + i;
          const platform = ['shopee', 'lazada', 'tokopedia'][orderIndex % 3];
          
          batchOrders.push({
            tenantId,
            orderId: `daily-load-${orderIndex + 1}`,
            platform,
            channelId: `channel-${platform}`,
            totalAmount: 75000 + (Math.random() * 425000), // IDR 75K - 500K
            currency: 'IDR',
            paymentMethod: ['qris', 'gopay', 'ovo', 'dana', 'cod'][Math.floor(Math.random() * 5)],
            shippingMethod: ['jne_reg', 'jnt_reg', 'sicepat_reg', 'anteraja_reg'][Math.floor(Math.random() * 4)],
            businessContext: {
              timezone: 'Asia/Jakarta',
              businessHours: true,
              indonesianSMB: true,
              batchNumber: batch + 1,
              orderInBatch: i + 1,
            },
          });
        }

        // Process batch concurrently
        const batchStartTime = Date.now();
        const batchResults = await Promise.all(
          batchOrders.map(order =>
            testSystem.testHelpers.performComplexSync(order.channelId, order)
          )
        );
        const batchDuration = Date.now() - batchStartTime;

        // Collect batch metrics
        const batchSuccessful = batchResults.filter(r => r.success).length;
        const batchFailed = batchResults.filter(r => !r.success).length;
        const batchAvgResponseTime = batchResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / batchResults.length;

        performanceMetrics.totalOrders += currentBatchSize;
        performanceMetrics.successfulOrders += batchSuccessful;
        performanceMetrics.failedOrders += batchFailed;
        performanceMetrics.totalDuration += batchDuration;
        performanceMetrics.averageResponseTime = (performanceMetrics.averageResponseTime * batch + batchAvgResponseTime) / (batch + 1);

        // Update platform distribution
        batchResults.forEach(result => {
          if (result.success) {
            performanceMetrics.platformDistribution[result.platform]++;
          }
        });

        console.log(`Batch ${batch + 1}/${batchCount} completed: ${batchSuccessful}/${currentBatchSize} successful, ${batchAvgResponseTime.toFixed(2)}ms avg response time`);
      }

      const totalTestDuration = Date.now() - startTime;
      
      // Calculate final performance metrics
      performanceMetrics.throughput = (performanceMetrics.successfulOrders / totalTestDuration) * 1000 * 60; // orders per minute
      performanceMetrics.errorRate = performanceMetrics.failedOrders / performanceMetrics.totalOrders;
      performanceMetrics.businessHourCompliance = performanceMetrics.successfulOrders / performanceMetrics.totalOrders;

      // COMPLEX VALIDATION: Indonesian SMB performance requirements
      expect(performanceMetrics.successfulOrders).toBeGreaterThan(475); // > 95% success rate
      expect(performanceMetrics.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      expect(performanceMetrics.throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT);
      expect(performanceMetrics.errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.ERROR_RATE);
      expect(performanceMetrics.businessHourCompliance).toBeGreaterThan(0.95);

      // Validate platform distribution (should be roughly equal)
      const totalPlatformOrders = Object.values(performanceMetrics.platformDistribution).reduce((sum, count) => sum + count, 0);
      expect(totalPlatformOrders).toBe(performanceMetrics.successfulOrders);
      
      Object.values(performanceMetrics.platformDistribution).forEach(count => {
        expect(count).toBeGreaterThan(totalPlatformOrders * 0.25); // At least 25% per platform
      });

      console.log('Indonesian SMB Daily Load Test Results:', performanceMetrics);
    });

    test('should handle peak Indonesian shopping events (Harbolnas, 12.12)', async () => {
      const peakEventScenarios = [
        {
          eventName: 'Harbolnas (National Online Shopping Day)',
          loadMultiplier: 10,
          duration: 4 * 60 * 60 * 1000, // 4 hours
          expectedDegradation: 2.0, // 100% degradation acceptable
          peakHours: [10, 14, 20], // 10 AM, 2 PM, 8 PM
        },
        {
          eventName: '12.12 Shopping Festival',
          loadMultiplier: 8,
          duration: 6 * 60 * 60 * 1000, // 6 hours
          expectedDegradation: 1.5, // 50% degradation acceptable
          peakHours: [12, 15, 21], // 12 PM, 3 PM, 9 PM
        },
        {
          eventName: 'Flash Sale Event',
          loadMultiplier: 15,
          duration: 2 * 60 * 60 * 1000, // 2 hours
          expectedDegradation: 3.0, // 200% degradation acceptable
          peakHours: [19, 20], // 7 PM, 8 PM
        },
      ];

      for (const scenario of peakEventScenarios) {
        console.log(`\\nTesting peak event: ${scenario.eventName}`);
        
        const normalLoad = 100; // Normal order count
        const peakLoad = normalLoad * scenario.loadMultiplier;
        const peakOrders = [];

        // Generate peak load orders
        for (let i = 0; i < peakLoad; i++) {
          const platform = ['shopee', 'lazada', 'tokopedia'][i % 3];
          const peakHour = scenario.peakHours[Math.floor(Math.random() * scenario.peakHours.length)];
          
          peakOrders.push({
            tenantId,
            orderId: `peak-${scenario.eventName.replace(/\\s+/g, '-').toLowerCase()}-${i + 1}`,
            platform,
            channelId: `channel-${platform}`,
            totalAmount: 50000 + (Math.random() * 950000), // IDR 50K - 1M (higher during events)
            currency: 'IDR',
            peakEvent: scenario.eventName,
            peakHour,
            priority: i < peakLoad * 0.1 ? 'urgent' : 'normal', // 10% urgent orders
            businessContext: {
              timezone: 'Asia/Jakarta',
              peakShoppingEvent: true,
              expectedHighLoad: true,
              loadMultiplier: scenario.loadMultiplier,
              indonesianShoppingPattern: {
                flashSale: scenario.eventName.includes('Flash'),
                nationalEvent: scenario.eventName.includes('Harbolnas'),
                seasonalEvent: scenario.eventName.includes('12.12'),
              },
            },
          });
        }

        // Process peak load dengan chunking untuk avoid overwhelming
        const chunkSize = 25; // Process 25 orders at a time
        const chunks = [];
        for (let i = 0; i < peakOrders.length; i += chunkSize) {
          chunks.push(peakOrders.slice(i, i + chunkSize));
        }

        const peakStartTime = Date.now();
        const peakResults = [];

        for (const chunk of chunks) {
          const chunkResults = await Promise.all(
            chunk.map(order =>
              testSystem.testHelpers.performComplexSync(order.channelId, order)
            )
          );
          peakResults.push(...chunkResults);
        }

        const peakDuration = Date.now() - peakStartTime;

        // Calculate peak performance metrics
        const peakSuccessful = peakResults.filter(r => r.success).length;
        const peakFailed = peakResults.filter(r => !r.success).length;
        const peakAvgResponseTime = peakResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / peakResults.length;
        const peakThroughput = (peakSuccessful / peakDuration) * 1000 * 60; // orders per minute
        const peakErrorRate = peakFailed / peakLoad;

        const peakMetrics = {
          eventName: scenario.eventName,
          loadMultiplier: scenario.loadMultiplier,
          totalOrders: peakLoad,
          successfulOrders: peakSuccessful,
          failedOrders: peakFailed,
          successRate: (peakSuccessful / peakLoad) * 100,
          averageResponseTime: peakAvgResponseTime,
          throughput: peakThroughput,
          errorRate: peakErrorRate,
          duration: peakDuration,
          acceptableDegradation: scenario.expectedDegradation,
          actualDegradation: peakAvgResponseTime / PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME,
        };

        // COMPLEX VALIDATION: Peak event performance requirements
        expect(peakMetrics.successRate).toBeGreaterThan(85); // > 85% success during peak
        expect(peakMetrics.actualDegradation).toBeLessThan(scenario.expectedDegradation);
        expect(peakMetrics.errorRate).toBeLessThan(0.05); // < 5% error rate during peak
        expect(peakMetrics.throughput).toBeGreaterThan(50); // > 50 orders/minute minimum

        console.log(`Peak Event Results for ${scenario.eventName}:`, peakMetrics);
      }
    });

    test('should maintain performance during Ramadan with cultural adjustments', async () => {
      const ramadanContext: IndonesianBusinessContext = {
        timezone: 'WIB',
        businessHours: { start: 10, end: 16 }, // Adjusted for Ramadan
        culturalConsiderations: [
          'respect_fasting_hours',
          'avoid_food_promotions',
          'adjust_customer_service_hours',
          'respect_prayer_times',
          'cultural_sensitivity_messaging'
        ],
        paymentMethods: ['qris', 'gopay', 'ovo', 'dana', 'cod'],
        shippingRegions: ['Jakarta', 'Surabaya', 'Bandung', 'Medan'],
        ramadanSchedule: {
          adjustedHours: { start: 10, end: 16 },
          culturalPractices: [
            'sahur_time_consideration',
            'iftar_time_respect',
            'prayer_time_awareness',
            'reduced_operational_hours'
          ]
        }
      };

      await testSystem.testHelpers.setupIndonesianBusinessContext(ramadanContext);

      const ramadanOrderCount = 300;
      const ramadanOrders = [];

      // Generate Ramadan-sensitive orders
      for (let i = 0; i < ramadanOrderCount; i++) {
        const platform = ['shopee', 'lazada', 'tokopedia'][i % 3];
        const orderHour = 10 + Math.floor(Math.random() * 6); // 10 AM - 4 PM
        
        ramadanOrders.push({
          tenantId,
          orderId: `ramadan-order-${i + 1}`,
          platform,
          channelId: `channel-${platform}`,
          totalAmount: 100000 + (Math.random() * 300000), // IDR 100K - 400K
          currency: 'IDR',
          productCategory: ['fashion', 'electronics', 'home', 'books'][Math.floor(Math.random() * 4)], // Non-food items
          orderHour,
          isRamadanSensitive: true,
          businessContext: ramadanContext,
          culturalContext: {
            respectFastingHours: true,
            avoidFoodPromotions: true,
            adjustedProcessingTime: true,
            culturalSensitivity: 'high',
          },
        });
      }

      const ramadanStartTime = Date.now();
      const ramadanResults = await Promise.all(
        ramadanOrders.map(order =>
          testSystem.testHelpers.performComplexSync(order.channelId, order)
        )
      );
      const ramadanDuration = Date.now() - ramadanStartTime;

      // Calculate Ramadan performance metrics
      const ramadanSuccessful = ramadanResults.filter(r => r.success).length;
      const ramadanFailed = ramadanResults.filter(r => !r.success).length;
      const ramadanAvgResponseTime = ramadanResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / ramadanResults.length;
      const ramadanThroughput = (ramadanSuccessful / ramadanDuration) * 1000 * 60;

      const ramadanMetrics = {
        totalOrders: ramadanOrderCount,
        successfulOrders: ramadanSuccessful,
        failedOrders: ramadanFailed,
        successRate: (ramadanSuccessful / ramadanOrderCount) * 100,
        averageResponseTime: ramadanAvgResponseTime,
        throughput: ramadanThroughput,
        culturalCompliance: ramadanResults.filter(r => r.culturalConsiderations?.respectFastingHours).length,
        adjustedProcessingTime: ramadanAvgResponseTime / PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME,
        ramadanAdjustmentFactor: PERFORMANCE_THRESHOLDS.RAMADAN_ADJUSTMENT,
      };

      // COMPLEX VALIDATION: Ramadan performance requirements
      expect(ramadanMetrics.successRate).toBeGreaterThan(90); // > 90% success during Ramadan
      expect(ramadanMetrics.adjustedProcessingTime).toBeLessThan(ramadanMetrics.ramadanAdjustmentFactor);
      expect(ramadanMetrics.culturalCompliance / ramadanOrderCount).toBeGreaterThan(0.95); // > 95% cultural compliance
      expect(ramadanMetrics.throughput).toBeGreaterThan(80); // > 80 orders/minute during Ramadan

      // Validate cultural considerations
      const culturalWarnings = ramadanResults.filter(r => r.warnings?.some(w => w.includes('cultural')));
      expect(culturalWarnings.length).toBe(0); // No cultural warnings

      console.log('Ramadan Performance Results:', ramadanMetrics);
    });
  });

  describe('Cache Performance and Optimization', () => {
    test('should achieve target cache hit ratios across all cache levels', async () => {
      const cacheTestOrders = [];
      const cacheTestCount = 200;

      // Generate orders dengan cache patterns
      for (let i = 0; i < cacheTestCount; i++) {
        const platform = ['shopee', 'lazada', 'tokopedia'][i % 3];
        
        cacheTestOrders.push({
          tenantId,
          orderId: `cache-test-${i + 1}`,
          platform,
          channelId: `channel-${platform}`,
          productId: `product-${(i % 20) + 1}`, // 20 products for cache reuse
          totalAmount: 100000 + (Math.random() * 200000),
          currency: 'IDR',
          enableCacheValidation: true,
          cachePattern: i < 50 ? 'hot' : i < 150 ? 'warm' : 'cold',
        });
      }

      const cacheStartTime = Date.now();
      const cacheResults = await Promise.all(
        cacheTestOrders.map(order =>
          testSystem.testHelpers.performComplexSync(order.channelId, order)
        )
      );
      const cacheDuration = Date.now() - cacheStartTime;

      // Get cache metrics
      const cacheMetrics = await testSystem.testHelpers.getComplexQueueMetrics();

      // Calculate cache performance
      const cacheStats = cacheMetrics.cache;
      const hotCacheHits = cacheResults.filter(r => r.cacheLevel === 'hot').length;
      const warmCacheHits = cacheResults.filter(r => r.cacheLevel === 'warm').length;
      const coldCacheHits = cacheResults.filter(r => r.cacheLevel === 'cold').length;
      const cacheMisses = cacheResults.filter(r => r.cacheLevel === 'miss').length;

      const cachePerformance = {
        totalRequests: cacheTestCount,
        hotCacheHits,
        warmCacheHits,
        coldCacheHits,
        cacheMisses,
        overallHitRatio: (hotCacheHits + warmCacheHits + coldCacheHits) / cacheTestCount,
        hotCacheRatio: hotCacheHits / cacheTestCount,
        avgResponseTime: cacheResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / cacheResults.length,
        cacheStats,
      };

      // COMPLEX VALIDATION: Cache performance requirements
      expect(cachePerformance.overallHitRatio).toBeGreaterThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_RATIO);
      expect(cachePerformance.hotCacheRatio).toBeGreaterThan(0.2); // > 20% hot cache hits
      expect(cachePerformance.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);

      // Validate cache level response times
      const hotCacheResponseTime = cacheResults
        .filter(r => r.cacheLevel === 'hot')
        .reduce((sum, r) => sum + r.metrics.syncDuration, 0) / hotCacheHits;
      const warmCacheResponseTime = cacheResults
        .filter(r => r.cacheLevel === 'warm')
        .reduce((sum, r) => sum + r.metrics.syncDuration, 0) / warmCacheHits;
      const coldCacheResponseTime = cacheResults
        .filter(r => r.cacheLevel === 'cold')
        .reduce((sum, r) => sum + r.metrics.syncDuration, 0) / coldCacheHits;

      expect(hotCacheResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.HOT_CACHE_RESPONSE);
      expect(warmCacheResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.WARM_CACHE_RESPONSE);
      expect(coldCacheResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COLD_CACHE_RESPONSE);

      console.log('Cache Performance Results:', cachePerformance);
    });

    test('should optimize database query performance with proper indexing', async () => {
      const dbTestOrders = [];
      const dbTestCount = 150;

      // Generate database-intensive queries
      for (let i = 0; i < dbTestCount; i++) {
        const platform = ['shopee', 'lazada', 'tokopedia'][i % 3];
        
        dbTestOrders.push({
          tenantId,
          orderId: `db-test-${i + 1}`,
          platform,
          channelId: `channel-${platform}`,
          totalAmount: 150000 + (Math.random() * 250000),
          currency: 'IDR',
          dbIntensiveQuery: true,
          queryType: ['product_lookup', 'inventory_check', 'order_history', 'customer_data'][i % 4],
          enableQueryOptimization: true,
        });
      }

      const dbStartTime = Date.now();
      const dbResults = await Promise.all(
        dbTestOrders.map(order =>
          testSystem.testHelpers.performComplexSync(order.channelId, order)
        )
      );
      const dbDuration = Date.now() - dbStartTime;

      // Analyze database performance
      const dbMetrics = {
        totalQueries: dbTestCount,
        successfulQueries: dbResults.filter(r => r.success).length,
        averageQueryTime: dbResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / dbResults.length,
        slowQueries: dbResults.filter(r => r.metrics.syncDuration > 1000).length, // > 1 second
        optimizedQueries: dbResults.filter(r => r.queryOptimized).length,
        indexUtilization: dbResults.filter(r => r.indexUsed).length,
        totalDuration: dbDuration,
        throughput: (dbResults.filter(r => r.success).length / dbDuration) * 1000,
      };

      // COMPLEX VALIDATION: Database performance requirements
      expect(dbMetrics.averageQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      expect(dbMetrics.slowQueries / dbTestCount).toBeLessThan(0.05); // < 5% slow queries
      expect(dbMetrics.optimizedQueries / dbTestCount).toBeGreaterThan(0.9); // > 90% query optimization
      expect(dbMetrics.indexUtilization / dbTestCount).toBeGreaterThan(0.85); // > 85% index utilization
      expect(dbMetrics.throughput).toBeGreaterThan(100); // > 100 queries/second

      console.log('Database Performance Results:', dbMetrics);
    });
  });

  describe('Concurrent User Performance Testing', () => {
    test('should support 50+ concurrent Indonesian SMB users', async () => {
      const concurrentUsers = 50;
      const ordersPerUser = 5;
      const totalOrders = concurrentUsers * ordersPerUser;

      // Generate concurrent user sessions
      const userSessions = Array.from({ length: concurrentUsers }, (_, userIndex) => {
        const userId = `concurrent-user-${userIndex + 1}`;
        const userOrders = [];

        for (let orderIndex = 0; orderIndex < ordersPerUser; orderIndex++) {
          const platform = ['shopee', 'lazada', 'tokopedia'][orderIndex % 3];
          
          userOrders.push({
            tenantId,
            userId,
            orderId: `${userId}-order-${orderIndex + 1}`,
            platform,
            channelId: `channel-${platform}`,
            totalAmount: 100000 + (Math.random() * 300000),
            currency: 'IDR',
            userSession: userIndex + 1,
            orderInSession: orderIndex + 1,
            businessContext: {
              timezone: 'Asia/Jakarta',
              concurrentUser: true,
              userIndex,
              indonesianSMB: true,
            },
          });
        }

        return userOrders;
      });

      const concurrentStartTime = Date.now();
      
      // Execute concurrent user sessions
      const concurrentResults = await Promise.all(
        userSessions.map(async (userOrders) => {
          const userResults = await Promise.all(
            userOrders.map(order =>
              testSystem.testHelpers.performComplexSync(order.channelId, order)
            )
          );
          return userResults;
        })
      );

      const concurrentDuration = Date.now() - concurrentStartTime;
      const flatResults = concurrentResults.flat();

      // Calculate concurrent user performance
      const concurrentMetrics = {
        totalUsers: concurrentUsers,
        ordersPerUser,
        totalOrders,
        successfulOrders: flatResults.filter(r => r.success).length,
        failedOrders: flatResults.filter(r => !r.success).length,
        averageResponseTime: flatResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / flatResults.length,
        maxResponseTime: Math.max(...flatResults.map(r => r.metrics.syncDuration)),
        minResponseTime: Math.min(...flatResults.map(r => r.metrics.syncDuration)),
        throughput: (flatResults.filter(r => r.success).length / concurrentDuration) * 1000,
        concurrentThroughput: (flatResults.filter(r => r.success).length / concurrentDuration) * 1000 * 60, // orders/minute
        errorRate: flatResults.filter(r => !r.success).length / totalOrders,
        duration: concurrentDuration,
      };

      // COMPLEX VALIDATION: Concurrent user performance requirements
      expect(concurrentMetrics.successfulOrders / totalOrders).toBeGreaterThan(0.95); // > 95% success
      expect(concurrentMetrics.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 1.5); // 50% degradation acceptable
      expect(concurrentMetrics.maxResponseTime).toBeLessThan(5000); // < 5 seconds max
      expect(concurrentMetrics.throughput).toBeGreaterThan(50); // > 50 orders/second
      expect(concurrentMetrics.errorRate).toBeLessThan(0.02); // < 2% error rate

      // Validate user session distribution
      const userSessionMetrics = userSessions.map((userOrders, userIndex) => {
        const userResults = concurrentResults[userIndex];
        const userSuccessful = userResults.filter(r => r.success).length;
        const userAvgResponseTime = userResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / userResults.length;
        
        return {
          userId: userIndex + 1,
          successfulOrders: userSuccessful,
          averageResponseTime: userAvgResponseTime,
          successRate: (userSuccessful / ordersPerUser) * 100,
        };
      });

      // Validate consistent performance across users
      const avgUserSuccessRate = userSessionMetrics.reduce((sum, u) => sum + u.successRate, 0) / concurrentUsers;
      const avgUserResponseTime = userSessionMetrics.reduce((sum, u) => sum + u.averageResponseTime, 0) / concurrentUsers;

      expect(avgUserSuccessRate).toBeGreaterThan(95); // > 95% average success rate
      expect(avgUserResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 1.3); // 30% degradation

      console.log('Concurrent User Performance Results:', concurrentMetrics);
      console.log('User Session Distribution:', userSessionMetrics.slice(0, 5)); // Show first 5 users
    });
  });

  describe('Performance Regression Testing', () => {
    test('should maintain performance baselines across Indonesian business scenarios', async () => {
      const baselineScenarios = [
        {
          name: 'Normal Business Hours',
          orders: 100,
          expectedResponseTime: PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME,
          expectedThroughput: PERFORMANCE_THRESHOLDS.THROUGHPUT,
          businessContext: { timezone: 'Asia/Jakarta', businessHours: true },
        },
        {
          name: 'Evening Rush (7-9 PM)',
          orders: 150,
          expectedResponseTime: PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 1.2,
          expectedThroughput: PERFORMANCE_THRESHOLDS.THROUGHPUT * 0.9,
          businessContext: { timezone: 'Asia/Jakarta', eveningRush: true },
        },
        {
          name: 'Weekend Shopping',
          orders: 200,
          expectedResponseTime: PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 1.3,
          expectedThroughput: PERFORMANCE_THRESHOLDS.THROUGHPUT * 0.8,
          businessContext: { timezone: 'Asia/Jakarta', weekendShopping: true },
        },
        {
          name: 'Holiday Period',
          orders: 80,
          expectedResponseTime: PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 1.5,
          expectedThroughput: PERFORMANCE_THRESHOLDS.THROUGHPUT * 0.7,
          businessContext: { timezone: 'Asia/Jakarta', holidayPeriod: true },
        },
      ];

      const baselineResults = [];

      for (const scenario of baselineScenarios) {
        const scenarioOrders = [];
        
        for (let i = 0; i < scenario.orders; i++) {
          const platform = ['shopee', 'lazada', 'tokopedia'][i % 3];
          
          scenarioOrders.push({
            tenantId,
            orderId: `baseline-${scenario.name.toLowerCase().replace(/\\s+/g, '-')}-${i + 1}`,
            platform,
            channelId: `channel-${platform}`,
            totalAmount: 120000 + (Math.random() * 280000),
            currency: 'IDR',
            businessContext: scenario.businessContext,
            scenarioName: scenario.name,
          });
        }

        const scenarioStartTime = Date.now();
        const scenarioResults = await Promise.all(
          scenarioOrders.map(order =>
            testSystem.testHelpers.performComplexSync(order.channelId, order)
          )
        );
        const scenarioDuration = Date.now() - scenarioStartTime;

        const scenarioMetrics = {
          name: scenario.name,
          orders: scenario.orders,
          successfulOrders: scenarioResults.filter(r => r.success).length,
          averageResponseTime: scenarioResults.reduce((sum, r) => sum + r.metrics.syncDuration, 0) / scenarioResults.length,
          throughput: (scenarioResults.filter(r => r.success).length / scenarioDuration) * 1000 * 60, // orders/minute
          errorRate: scenarioResults.filter(r => !r.success).length / scenario.orders,
          expectedResponseTime: scenario.expectedResponseTime,
          expectedThroughput: scenario.expectedThroughput,
          meetResponseTimeTarget: false,
          meetThroughputTarget: false,
        };

        // Validate baseline performance
        scenarioMetrics.meetResponseTimeTarget = scenarioMetrics.averageResponseTime <= scenario.expectedResponseTime;
        scenarioMetrics.meetThroughputTarget = scenarioMetrics.throughput >= scenario.expectedThroughput;

        expect(scenarioMetrics.meetResponseTimeTarget).toBe(true);
        expect(scenarioMetrics.meetThroughputTarget).toBe(true);
        expect(scenarioMetrics.errorRate).toBeLessThan(0.02); // < 2% error rate

        baselineResults.push(scenarioMetrics);
      }

      // Validate overall baseline performance
      const overallAvgResponseTime = baselineResults.reduce((sum, s) => sum + s.averageResponseTime, 0) / baselineResults.length;
      const overallAvgThroughput = baselineResults.reduce((sum, s) => sum + s.throughput, 0) / baselineResults.length;

      expect(overallAvgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 1.3);
      expect(overallAvgThroughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT * 0.8);

      console.log('Performance Baseline Results:', baselineResults);
    });
  });
});