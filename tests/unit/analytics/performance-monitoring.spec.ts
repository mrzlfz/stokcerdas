import { Test, TestingModule } from '@nestjs/testing';
import { performance } from 'perf_hooks';

import { PredictiveAnalyticsController } from '../../../src/analytics/controllers/predictive-analytics.controller';
import { AnalyticsController } from '../../../src/analytics/controllers/analytics.controller';
import { BaseAnalyticsController } from '../../../src/analytics/controllers/base-analytics.controller';

import {
  PredictiveAnalysisType,
  TimeHorizon,
  PredictiveAnalyticsQueryDto,
} from '../../../src/analytics/dto/predictive-analytics-query.dto';

// Performance test utilities
class PerformanceTestUtils {
  static measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    return new Promise(async (resolve, reject) => {
      const startTime = performance.now();
      try {
        const result = await fn();
        const endTime = performance.now();
        resolve({
          result,
          executionTime: Math.round(endTime - startTime),
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static async runLoadTest<T>(
    fn: () => Promise<T>,
    concurrentRequests: number,
    iterations: number = 1
  ): Promise<{
    totalExecutions: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    p95Time: number;
    p99Time: number;
    successRate: number;
    errors: any[];
  }> {
    const results: number[] = [];
    const errors: any[] = [];

    for (let iteration = 0; iteration < iterations; iteration++) {
      const promises = Array(concurrentRequests).fill(null).map(async () => {
        try {
          const { executionTime } = await this.measureExecutionTime(fn);
          return executionTime;
        } catch (error) {
          errors.push(error);
          return null;
        }
      });

      const iterationResults = await Promise.all(promises);
      results.push(...iterationResults.filter(time => time !== null) as number[]);
    }

    if (results.length === 0) {
      throw new Error('All requests failed during load test');
    }

    results.sort((a, b) => a - b);
    
    const totalExecutions = concurrentRequests * iterations;
    const successfulExecutions = results.length;
    const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const minTime = results[0];
    const maxTime = results[results.length - 1];
    const p95Index = Math.floor(results.length * 0.95);
    const p99Index = Math.floor(results.length * 0.99);
    const p95Time = results[p95Index];
    const p99Time = results[p99Index];
    const successRate = (successfulExecutions / totalExecutions) * 100;

    return {
      totalExecutions,
      averageTime: Math.round(averageTime),
      minTime,
      maxTime,
      p95Time,
      p99Time,
      successRate: Math.round(successRate * 100) / 100,
      errors,
    };
  }
}

// Test controller class
class TestAnalyticsController extends BaseAnalyticsController {
  public testCreateMetaObject(total?: number, page?: number, limit?: number, executionTime?: number) {
    return this.createMetaObject(total, page, limit, executionTime);
  }

  public testLogAnalyticsOperation(tenantId: string, operation: string, duration?: number, additionalData?: any) {
    return this.logAnalyticsOperation(tenantId, operation, duration, additionalData);
  }
}

describe('Performance Monitoring Test Framework - Indonesian SMB SLA Validation', () => {
  let predictiveController: PredictiveAnalyticsController;
  let analyticsController: AnalyticsController;
  let testController: TestAnalyticsController;

  // Performance mock services that simulate realistic response times
  const createPerformanceMockService = (baseResponseTime: number) => ({
    generateStockoutPredictions: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, baseResponseTime + Math.random() * 50));
      return {
        data: Array(50).fill(null).map((_, i) => ({ id: `product-${i}`, risk: 0.3 })),
        summary: { totalProducts: 50, highRiskProducts: 5 },
        insights: { keyFindings: ['Test insight'] },
        meta: { executionTime: baseResponseTime },
      };
    }),
    detectSlowMovingItems: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, baseResponseTime + Math.random() * 30));
      return {
        data: Array(20).fill(null).map((_, i) => ({ id: `slow-${i}`, turnover: 0.5 })),
        summary: { slowMovingItems: 20 },
        insights: { actionPriorities: ['Test action'] },
        meta: { executionTime: baseResponseTime },
      };
    }),
    generateOptimalReorders: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, baseResponseTime + Math.random() * 40));
      return {
        data: Array(30).fill(null).map((_, i) => ({ id: `reorder-${i}`, quantity: 100 })),
        summary: { needsReordering: 30 },
        insights: { inventoryOptimization: ['Test optimization'] },
        meta: { executionTime: baseResponseTime },
      };
    }),
    generateDashboardMetrics: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, baseResponseTime + Math.random() * 20));
      return {
        data: { revenue: 1000000, orders: 150, products: 500 },
        summary: { period: '30d', growth: 15 },
        insights: { kpis: ['Revenue up 15%'] },
        meta: { executionTime: baseResponseTime },
      };
    }),
    generateRevenueAnalytics: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, baseResponseTime + Math.random() * 60));
      return {
        data: Array(100).fill(null).map((_, i) => ({ date: `2025-07-${i}`, revenue: 50000 })),
        summary: { totalRevenue: 5000000, growth: 12 },
        insights: { trends: ['Steady growth'] },
        meta: { executionTime: baseResponseTime },
      };
    }),
  });

  // Indonesian SMB Performance Requirements
  const PERFORMANCE_SLA = {
    API_RESPONSE_TIME_P95: 200, // <200ms for 95% of requests
    API_RESPONSE_TIME_P99: 500, // <500ms for 99% of requests
    DASHBOARD_LOAD_TIME: 1000,  // <1 second for dashboard
    REAL_TIME_UPDATE_LATENCY: 100, // <100ms for real-time updates
    CONCURRENT_USER_SUPPORT: 50, // Support 50 concurrent users
    SUCCESS_RATE_MINIMUM: 99.9, // 99.9% success rate
    MEMORY_USAGE_LIMIT: 512, // MB
  };

  const mockUser = {
    id: 'performance-test-user',
    tenantId: 'performance-test-tenant',
    email: 'performance@stokcerdas.com',
    role: 'manager',
  };

  beforeEach(async () => {
    // Create performance-optimized mock services
    const performanceMocks = createPerformanceMockService(50); // Base 50ms response

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictiveAnalyticsController, AnalyticsController, TestAnalyticsController],
      providers: [
        { provide: 'PredictiveAnalyticsService', useValue: performanceMocks },
        { provide: 'PriceOptimizationService', useValue: performanceMocks },
        { provide: 'DemandAnomalyService', useValue: performanceMocks },
        { provide: 'ModelServingService', useValue: performanceMocks },
        { provide: 'BusinessIntelligenceService', useValue: performanceMocks },
        { provide: 'CustomMetricsService', useValue: performanceMocks },
        { provide: 'BenchmarkingService', useValue: performanceMocks },
      ],
    }).compile();

    predictiveController = module.get<PredictiveAnalyticsController>(PredictiveAnalyticsController);
    analyticsController = module.get<AnalyticsController>(AnalyticsController);
    testController = module.get<TestAnalyticsController>(TestAnalyticsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Response Time SLA Validation', () => {
    describe('Predictive Analytics Performance', () => {
      it('should meet P95 response time SLA for stockout predictions', async () => {
        const query: PredictiveAnalyticsQueryDto = {
          analysisType: PredictiveAnalysisType.STOCKOUT_PREDICTION,
          includeConfidenceInterval: true,
          includeRecommendations: true,
          limit: 50,
          page: 1,
        };

        const loadTestResults = await PerformanceTestUtils.runLoadTest(
          () => predictiveController.performPredictiveAnalysis(mockUser, query),
          10, // 10 concurrent requests
          5   // 5 iterations
        );

        expect(loadTestResults.p95Time).toBeLessThanOrEqual(PERFORMANCE_SLA.API_RESPONSE_TIME_P95);
        expect(loadTestResults.p99Time).toBeLessThanOrEqual(PERFORMANCE_SLA.API_RESPONSE_TIME_P99);
        expect(loadTestResults.successRate).toBeGreaterThanOrEqual(PERFORMANCE_SLA.SUCCESS_RATE_MINIMUM);
        expect(loadTestResults.averageTime).toBeLessThan(150); // Average should be well under P95

        console.log('Stockout Prediction Performance:', {
          averageTime: `${loadTestResults.averageTime}ms`,
          p95Time: `${loadTestResults.p95Time}ms`,
          p99Time: `${loadTestResults.p99Time}ms`,
          successRate: `${loadTestResults.successRate}%`,
        });
      });

      it('should handle high concurrent load for all predictive analytics endpoints', async () => {
        const endpoints = [
          {
            name: 'Stockout Risk',
            fn: () => predictiveController.predictStockoutRisk(mockUser, { timeHorizon: TimeHorizon.NEXT_30_DAYS }),
          },
          {
            name: 'Slow Moving Detection',
            fn: () => predictiveController.detectSlowMovingItems(mockUser, { lookbackDays: 90 }),
          },
          {
            name: 'Optimal Reorders',
            fn: () => predictiveController.generateOptimalReorders(mockUser, { forecastHorizon: TimeHorizon.NEXT_30_DAYS }),
          },
        ];

        for (const endpoint of endpoints) {
          const results = await PerformanceTestUtils.runLoadTest(
            endpoint.fn,
            PERFORMANCE_SLA.CONCURRENT_USER_SUPPORT, // 50 concurrent users
            1
          );

          expect(results.p95Time).toBeLessThanOrEqual(PERFORMANCE_SLA.API_RESPONSE_TIME_P95);
          expect(results.successRate).toBeGreaterThanOrEqual(PERFORMANCE_SLA.SUCCESS_RATE_MINIMUM);

          console.log(`${endpoint.name} Load Test:`, {
            averageTime: `${results.averageTime}ms`,
            p95Time: `${results.p95Time}ms`,
            successRate: `${results.successRate}%`,
            totalRequests: results.totalExecutions,
          });
        }
      });
    });

    describe('Business Intelligence Performance', () => {
      it('should meet dashboard load time SLA', async () => {
        const dashboardQuery = {
          granularity: 'monthly',
          includeRealTime: true,
          includeTrends: true,
          includeAlerts: true,
        };

        const loadTestResults = await PerformanceTestUtils.runLoadTest(
          () => analyticsController.getDashboardMetrics(mockUser, dashboardQuery as any),
          20, // 20 concurrent dashboard loads
          3   // 3 iterations
        );

        expect(loadTestResults.p95Time).toBeLessThanOrEqual(PERFORMANCE_SLA.DASHBOARD_LOAD_TIME);
        expect(loadTestResults.averageTime).toBeLessThan(500); // Should be much faster on average
        expect(loadTestResults.successRate).toBeGreaterThanOrEqual(PERFORMANCE_SLA.SUCCESS_RATE_MINIMUM);

        console.log('Dashboard Performance:', {
          averageTime: `${loadTestResults.averageTime}ms`,
          p95Time: `${loadTestResults.p95Time}ms`,
          successRate: `${loadTestResults.successRate}%`,
        });
      });

      it('should handle complex revenue analytics within SLA', async () => {
        const revenueQuery = {
          granularity: 'daily',
          includeComparison: true,
          includeTrends: true,
          includeCOGS: true,
          includeProfitMargin: true,
        };

        const { result, executionTime } = await PerformanceTestUtils.measureExecutionTime(
          () => analyticsController.getRevenueAnalytics(mockUser, revenueQuery as any)
        );

        expect(executionTime).toBeLessThanOrEqual(PERFORMANCE_SLA.API_RESPONSE_TIME_P95);
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();

        console.log('Revenue Analytics Performance:', {
          executionTime: `${executionTime}ms`,
          dataPoints: Array.isArray(result.data) ? result.data.length : 'N/A',
        });
      });
    });
  });

  describe('Real-time Performance Requirements', () => {
    describe('Performance Monitoring System', () => {
      it('should track execution time with minimal overhead', async () => {
        const iterations = 1000;
        const operations = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          
          testController.testLogAnalyticsOperation(
            'performance-test',
            'Performance Monitoring Test',
            100,
            { iteration: i, testData: 'sample' }
          );
          
          const endTime = performance.now();
          operations.push(endTime - startTime);
        }

        const averageOverhead = operations.reduce((sum, time) => sum + time, 0) / operations.length;
        const maxOverhead = Math.max(...operations);

        // Logging overhead should be minimal (<1ms average, <5ms max)
        expect(averageOverhead).toBeLessThan(1);
        expect(maxOverhead).toBeLessThan(5);

        console.log('Performance Monitoring Overhead:', {
          averageOverhead: `${averageOverhead.toFixed(3)}ms`,
          maxOverhead: `${maxOverhead.toFixed(3)}ms`,
          iterations,
        });
      });

      it('should create meta objects efficiently for large datasets', async () => {
        const largeDataseSizes = [1000, 10000, 100000, 1000000];
        
        for (const size of largeDataseSizes) {
          const { executionTime } = await PerformanceTestUtils.measureExecutionTime(
            () => Promise.resolve(testController.testCreateMetaObject(size, 1, 100, 1500))
          );

          // Meta object creation should be O(1) - constant time regardless of dataset size
          expect(executionTime).toBeLessThan(10); // <10ms even for 1M records

          console.log(`Meta Object Creation (${size} records):`, `${executionTime}ms`);
        }
      });
    });

    describe('Real-time Update Latency', () => {
      it('should process real-time analytics updates within SLA', async () => {
        const realTimeUpdates = Array(100).fill(null).map((_, i) => ({
          tenantId: `tenant-${i % 10}`,
          operation: 'Real-time Inventory Update',
          data: {
            productId: `product-${i}`,
            stockChange: Math.floor(Math.random() * 100),
            timestamp: new Date().toISOString(),
          },
        }));

        const updateTimes = [];

        for (const update of realTimeUpdates) {
          const { executionTime } = await PerformanceTestUtils.measureExecutionTime(
            () => Promise.resolve(testController.testLogAnalyticsOperation(
              update.tenantId,
              update.operation,
              undefined,
              update.data
            ))
          );
          
          updateTimes.push(executionTime);
        }

        const averageLatency = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
        const maxLatency = Math.max(...updateTimes);
        const p95Latency = updateTimes.sort((a, b) => a - b)[Math.floor(updateTimes.length * 0.95)];

        expect(averageLatency).toBeLessThan(PERFORMANCE_SLA.REAL_TIME_UPDATE_LATENCY);
        expect(p95Latency).toBeLessThan(PERFORMANCE_SLA.REAL_TIME_UPDATE_LATENCY);
        expect(maxLatency).toBeLessThan(PERFORMANCE_SLA.REAL_TIME_UPDATE_LATENCY * 2); // Max can be 2x the SLA

        console.log('Real-time Update Performance:', {
          averageLatency: `${averageLatency.toFixed(2)}ms`,
          p95Latency: `${p95Latency}ms`,
          maxLatency: `${maxLatency}ms`,
          totalUpdates: updateTimes.length,
        });
      });
    });
  });

  describe('Scalability & Resource Efficiency', () => {
    describe('Memory Usage Optimization', () => {
      it('should handle large analytics responses without memory bloat', async () => {
        const initialMemory = process.memoryUsage();

        // Simulate processing large analytics datasets
        const largeDatasetSizes = [1000, 5000, 10000];
        
        for (const size of largeDatasetSizes) {
          const largeResponse = {
            data: Array(size).fill(null).map((_, i) => ({
              id: `item-${i}`,
              name: `Product ${i}`,
              value: Math.random() * 1000000,
              details: {
                category: `Category ${i % 100}`,
                supplier: `Supplier ${i % 50}`,
                history: Array(30).fill(null).map((_, j) => ({
                  date: `2025-${String(j % 12 + 1).padStart(2, '0')}-01`,
                  sales: Math.floor(Math.random() * 1000),
                })),
              },
            })),
            meta: testController.testCreateMetaObject(size, 1, size, 1000),
          };

          // Process the large response
          const jsonString = JSON.stringify(largeResponse);
          const parsedResponse = JSON.parse(jsonString);
          
          expect(parsedResponse.data.length).toBe(size);
          expect(parsedResponse.meta.total).toBe(size);
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

        // Memory increase should be reasonable (<100MB for test data)
        expect(memoryIncrease).toBeLessThan(100);

        console.log('Memory Usage Analysis:', {
          initialHeap: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          finalHeap: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          memoryIncrease: `${memoryIncrease.toFixed(2)}MB`,
        });
      });
    });

    describe('Concurrent Request Handling', () => {
      it('should maintain performance under concurrent Indonesian SMB load patterns', async () => {
        // Simulate Indonesian SMB usage patterns
        const indonesianSMBPatterns = [
          { name: 'Morning Rush (9-11 AM)', concurrent: 30, operations: 'mixed' },
          { name: 'Lunch Break (12-1 PM)', concurrent: 10, operations: 'light' },
          { name: 'Afternoon Peak (2-4 PM)', concurrent: 50, operations: 'heavy' },
          { name: 'Evening Reports (5-7 PM)', concurrent: 25, operations: 'reporting' },
        ];

        for (const pattern of indonesianSMBPatterns) {
          const operations = [];

          // Create operations based on pattern
          for (let i = 0; i < pattern.concurrent; i++) {
            if (pattern.operations === 'heavy') {
              operations.push(() => predictiveController.performPredictiveAnalysis(mockUser, {
                analysisType: PredictiveAnalysisType.STOCKOUT_PREDICTION,
                limit: 100,
                page: 1,
              }));
            } else if (pattern.operations === 'reporting') {
              operations.push(() => analyticsController.getDashboardMetrics(mockUser, {
                granularity: 'daily',
                includeRealTime: true,
              } as any));
            } else {
              operations.push(() => predictiveController.predictStockoutRisk(mockUser, {
                timeHorizon: TimeHorizon.NEXT_30_DAYS,
              }));
            }
          }

          // Execute concurrent operations
          const startTime = performance.now();
          const results = await Promise.allSettled(operations.map(op => op()));
          const endTime = performance.now();

          const successful = results.filter(r => r.status === 'fulfilled').length;
          const successRate = (successful / results.length) * 100;
          const totalTime = endTime - startTime;

          expect(successRate).toBeGreaterThanOrEqual(PERFORMANCE_SLA.SUCCESS_RATE_MINIMUM);
          expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

          console.log(`${pattern.name} Performance:`, {
            concurrent: pattern.concurrent,
            successRate: `${successRate.toFixed(1)}%`,
            totalTime: `${totalTime.toFixed(0)}ms`,
            avgTimePerRequest: `${(totalTime / pattern.concurrent).toFixed(0)}ms`,
          });
        }
      });
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance degradation in core analytics operations', async () => {
      const baselinePerformance = {
        stockoutPrediction: 150, // ms
        slowMovingDetection: 120, // ms
        optimalReorders: 180,    // ms
        dashboardMetrics: 80,    // ms
        revenueAnalytics: 200,   // ms
      };

      const operations = [
        {
          name: 'stockoutPrediction',
          fn: () => predictiveController.predictStockoutRisk(mockUser, { timeHorizon: TimeHorizon.NEXT_30_DAYS }),
          baseline: baselinePerformance.stockoutPrediction,
        },
        {
          name: 'slowMovingDetection',
          fn: () => predictiveController.detectSlowMovingItems(mockUser, { lookbackDays: 90 }),
          baseline: baselinePerformance.slowMovingDetection,
        },
        {
          name: 'optimalReorders',
          fn: () => predictiveController.generateOptimalReorders(mockUser, { forecastHorizon: TimeHorizon.NEXT_30_DAYS }),
          baseline: baselinePerformance.optimalReorders,
        },
        {
          name: 'dashboardMetrics',
          fn: () => analyticsController.getDashboardMetrics(mockUser, { granularity: 'monthly' } as any),
          baseline: baselinePerformance.dashboardMetrics,
        },
        {
          name: 'revenueAnalytics',
          fn: () => analyticsController.getRevenueAnalytics(mockUser, { includeTrends: true } as any),
          baseline: baselinePerformance.revenueAnalytics,
        },
      ];

      const performanceResults = [];

      for (const operation of operations) {
        const results = await PerformanceTestUtils.runLoadTest(operation.fn, 5, 10);
        
        const regressionThreshold = operation.baseline * 1.2; // 20% degradation threshold
        const improvementThreshold = operation.baseline * 0.8; // 20% improvement detection

        performanceResults.push({
          operation: operation.name,
          baseline: operation.baseline,
          current: results.averageTime,
          p95: results.p95Time,
          regression: results.averageTime > regressionThreshold,
          improvement: results.averageTime < improvementThreshold,
          changePercent: ((results.averageTime - operation.baseline) / operation.baseline * 100).toFixed(1),
        });

        // Fail test if significant regression detected
        expect(results.averageTime).toBeLessThan(regressionThreshold);
        expect(results.p95Time).toBeLessThan(PERFORMANCE_SLA.API_RESPONSE_TIME_P95);
      }

      console.log('Performance Regression Analysis:');
      console.table(performanceResults);
    });
  });

  describe('Indonesian SMB Specific Performance Patterns', () => {
    it('should handle Indonesian business hour traffic patterns efficiently', async () => {
      // Indonesian business hours: 8 AM - 6 PM WIB (UTC+7)
      const businessHourPatterns = [
        { hour: 8, load: 'light', concurrent: 15 },    // Opening
        { hour: 10, load: 'medium', concurrent: 35 },  // Morning peak
        { hour: 12, load: 'light', concurrent: 20 },   // Lunch
        { hour: 14, load: 'heavy', concurrent: 50 },   // Afternoon peak
        { hour: 16, load: 'medium', concurrent: 30 },  // Pre-closing
        { hour: 18, load: 'light', concurrent: 10 },   // Closing
      ];

      for (const pattern of businessHourPatterns) {
        const startTime = performance.now();
        
        // Simulate mixed operations typical during Indonesian business hours
        const operations = Array(pattern.concurrent).fill(null).map((_, i) => {
          const operationType = i % 4;
          switch (operationType) {
            case 0: return () => predictiveController.predictStockoutRisk(mockUser, { timeHorizon: TimeHorizon.NEXT_7_DAYS });
            case 1: return () => analyticsController.getDashboardMetrics(mockUser, { includeRealTime: true } as any);
            case 2: return () => predictiveController.detectSlowMovingItems(mockUser, { lookbackDays: 30 });
            default: return () => predictiveController.generateOptimalReorders(mockUser, { forecastHorizon: TimeHorizon.NEXT_30_DAYS });
          }
        });

        const results = await Promise.allSettled(operations.map(op => op()));
        const endTime = performance.now();

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const successRate = (successful / results.length) * 100;
        const totalTime = endTime - startTime;
        const avgTimePerRequest = totalTime / pattern.concurrent;

        expect(successRate).toBeGreaterThanOrEqual(PERFORMANCE_SLA.SUCCESS_RATE_MINIMUM);
        expect(avgTimePerRequest).toBeLessThan(PERFORMANCE_SLA.API_RESPONSE_TIME_P95);

        console.log(`${pattern.hour}:00 WIB (${pattern.load} load):`, {
          concurrent: pattern.concurrent,
          successRate: `${successRate.toFixed(1)}%`,
          avgResponse: `${avgTimePerRequest.toFixed(0)}ms`,
          totalTime: `${totalTime.toFixed(0)}ms`,
        });
      }
    });

    it('should maintain performance during Indonesian seasonal events', async () => {
      // Simulate high-load scenarios during Indonesian business seasons
      const seasonalEvents = [
        { event: 'Ramadan (High demand forecasting)', loadMultiplier: 2.5 },
        { event: 'Hari Raya (Inventory preparation)', loadMultiplier: 3.0 },
        { event: 'Christmas (Year-end analytics)', loadMultiplier: 2.0 },
        { event: 'New Year (Business planning)', loadMultiplier: 1.8 },
      ];

      for (const season of seasonalEvents) {
        const baseLoad = 20;
        const seasonalLoad = Math.floor(baseLoad * season.loadMultiplier);

        // Simulate seasonal-specific analytics operations
        const seasonalOperations = Array(seasonalLoad).fill(null).map(() => 
          () => predictiveController.performPredictiveAnalysis(mockUser, {
            analysisType: PredictiveAnalysisType.SEASONAL_ANALYSIS,
            includeConfidenceInterval: true,
            includeRecommendations: true,
            limit: 100,
            page: 1,
          })
        );

        const results = await PerformanceTestUtils.runLoadTest(
          () => Promise.all(seasonalOperations.map(op => op())),
          1, // One batch of seasonal load
          1
        );

        expect(results.successRate).toBeGreaterThanOrEqual(95); // Slightly relaxed for high load
        expect(results.averageTime).toBeLessThan(PERFORMANCE_SLA.API_RESPONSE_TIME_P95 * 2); // 2x SLA for seasonal peaks

        console.log(`${season.event}:`, {
          loadMultiplier: `${season.loadMultiplier}x`,
          concurrentOperations: seasonalLoad,
          avgTime: `${results.averageTime}ms`,
          successRate: `${results.successRate}%`,
        });
      }
    });
  });
});