import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as os from 'os';
import * as v8 from 'v8';

/**
 * Performance Monitoring Service for StokCerdas
 * 
 * Comprehensive system performance tracking and analysis:
 * 1. Database query performance monitoring
 * 2. Cache hit ratio tracking
 * 3. API response time analytics
 * 4. Memory and CPU usage monitoring
 * 5. Business metrics tracking
 * 6. Indonesian business context awareness
 * 7. Real-time alerting for performance issues
 * 
 * Key Features:
 * - Automatic slow query detection
 * - Performance regression analysis
 * - Business hour performance optimization
 * - Multi-tenant performance isolation
 * - Indonesian SMB usage pattern analysis
 */

export interface PerformanceMetrics {
  timestamp: Date;
  tenantId?: string;
  
  // Database Performance
  database: {
    slowQueries: number;
    averageQueryTime: number;
    connectionPoolUsage: number;
    deadlockCount: number;
    queryCount: number;
    topSlowQueries: SlowQueryInfo[];
  };
  
  // Cache Performance
  cache: {
    hitRatio: number;
    missRatio: number;
    totalRequests: number;
    averageResponseTime: number;
    memoryUsage: number;
    evictionCount: number;
  };
  
  // API Performance
  api: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestCount: number;
    errorRate: number;
    slowEndpoints: EndpointPerformance[];
  };
  
  // System Performance
  system: {
    cpuUsage: number;
    memoryUsage: number;
    heapUsage: number;
    gcMetrics: GCMetrics;
    diskUsage: number;
    networkUsage: number;
  };
  
  // Business Metrics
  business: {
    activeUsers: number;
    inventoryOperationsPerMinute: number;
    productSearches: number;
    orderProcessingTime: number;
    realtimeConnections: number;
  };
}

export interface SlowQueryInfo {
  sql: string;
  duration: number;
  tenantId?: string;
  timestamp: Date;
  parameters?: any[];
  stackTrace?: string;
}

export interface EndpointPerformance {
  path: string;
  method: string;
  averageResponseTime: number;
  requestCount: number;
  errorCount: number;
  slowestResponse: number;
}

export interface GCMetrics {
  totalHeapSize: number;
  usedHeapSize: number;
  heapSizeLimit: number;
  mallocedMemory: number;
  peakMallocedMemory: number;
  numberOfNativeContexts: number;
  numberOfDetachedContexts: number;
}

export interface PerformanceAlert {
  type: 'critical' | 'warning' | 'info';
  category: 'database' | 'cache' | 'api' | 'system' | 'business';
  message: string;
  metrics: any;
  timestamp: Date;
  tenantId?: string;
  recommendations: string[];
}

export interface PerformanceReport {
  period: { start: Date; end: Date };
  summary: {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    performanceScore: number; // 0-100
    keyIssues: string[];
    improvements: string[];
  };
  metrics: PerformanceMetrics[];
  trends: {
    responseTimetrend: 'improving' | 'stable' | 'degrading';
    cacheEfficiency: 'improving' | 'stable' | 'degrading';
    errorRatetrend: 'improving' | 'stable' | 'degrading';
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private readonly performanceData = new Map<string, PerformanceMetrics[]>();
  private readonly alertThresholds = {
    slowQueryThreshold: 1000, // 1 second
    apiResponseThreshold: 2000, // 2 seconds
    cacheHitRatioThreshold: 70, // 70%
    errorRateThreshold: 5, // 5%
    cpuUsageThreshold: 80, // 80%
    memoryUsageThreshold: 85, // 85%
  };

  // Indonesian business context
  private readonly businessHours = {
    start: 9, // 9 AM WIB
    end: 18, // 6 PM WIB
    timezone: 'Asia/Jakarta',
  };

  private currentMetrics: Partial<PerformanceMetrics> = {};
  private alertHistory: PerformanceAlert[] = [];
  private performanceBaseline: PerformanceMetrics | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeMonitoring();
  }

  /**
   * Record database query performance
   */
  @OnEvent('query.executed')
  async recordQueryPerformance(event: {
    sql: string;
    duration: number;
    parameters?: any[];
    tenantId?: string;
  }): Promise<void> {
    try {
      if (!this.currentMetrics.database) {
        this.currentMetrics.database = {
          slowQueries: 0,
          averageQueryTime: 0,
          connectionPoolUsage: 0,
          deadlockCount: 0,
          queryCount: 0,
          topSlowQueries: [],
        };
      }

      this.currentMetrics.database.queryCount++;
      
      // Update average query time (running average)
      const currentAvg = this.currentMetrics.database.averageQueryTime;
      const count = this.currentMetrics.database.queryCount;
      this.currentMetrics.database.averageQueryTime = 
        ((currentAvg * (count - 1)) + event.duration) / count;

      // Track slow queries
      if (event.duration > this.alertThresholds.slowQueryThreshold) {
        this.currentMetrics.database.slowQueries++;
        
        const slowQueryInfo: SlowQueryInfo = {
          sql: event.sql.substring(0, 500), // Limit SQL length
          duration: event.duration,
          tenantId: event.tenantId,
          timestamp: new Date(),
          parameters: event.parameters,
        };

        this.currentMetrics.database.topSlowQueries.push(slowQueryInfo);
        
        // Keep only top 10 slow queries
        this.currentMetrics.database.topSlowQueries = 
          this.currentMetrics.database.topSlowQueries
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10);

        // Emit alert for very slow queries
        if (event.duration > this.alertThresholds.slowQueryThreshold * 2) {
          await this.emitPerformanceAlert({
            type: 'warning',
            category: 'database',
            message: `Very slow query detected: ${event.duration}ms`,
            metrics: slowQueryInfo,
            timestamp: new Date(),
            tenantId: event.tenantId,
            recommendations: [
              'Review query execution plan',
              'Check if proper indexes are in place',
              'Consider query optimization',
              'Monitor database load'
            ],
          });
        }
      }

    } catch (error) {
      this.logger.error('Error recording query performance:', error);
    }
  }

  /**
   * Record API request performance
   */
  @OnEvent('api.request.completed')
  async recordAPIPerformance(event: {
    path: string;
    method: string;
    responseTime: number;
    statusCode: number;
    tenantId?: string;
  }): Promise<void> {
    try {
      if (!this.currentMetrics.api) {
        this.currentMetrics.api = {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestCount: 0,
          errorRate: 0,
          slowEndpoints: [],
        };
      }

      this.currentMetrics.api.requestCount++;
      
      // Update average response time
      const currentAvg = this.currentMetrics.api.averageResponseTime;
      const count = this.currentMetrics.api.requestCount;
      this.currentMetrics.api.averageResponseTime = 
        ((currentAvg * (count - 1)) + event.responseTime) / count;

      // Track error rate
      if (event.statusCode >= 400) {
        const errorCount = (this.currentMetrics.api.errorRate / 100) * (count - 1) + 1;
        this.currentMetrics.api.errorRate = (errorCount / count) * 100;
      }

      // Track slow endpoints
      if (event.responseTime > this.alertThresholds.apiResponseThreshold) {
        const endpoint = `${event.method} ${event.path}`;
        let endpointMetrics = this.currentMetrics.api.slowEndpoints.find(
          e => e.path === event.path && e.method === event.method
        );

        if (!endpointMetrics) {
          endpointMetrics = {
            path: event.path,
            method: event.method,
            averageResponseTime: event.responseTime,
            requestCount: 1,
            errorCount: event.statusCode >= 400 ? 1 : 0,
            slowestResponse: event.responseTime,
          };
          this.currentMetrics.api.slowEndpoints.push(endpointMetrics);
        } else {
          const reqCount = endpointMetrics.requestCount + 1;
          endpointMetrics.averageResponseTime = 
            ((endpointMetrics.averageResponseTime * endpointMetrics.requestCount) + event.responseTime) / reqCount;
          endpointMetrics.requestCount = reqCount;
          endpointMetrics.slowestResponse = Math.max(endpointMetrics.slowestResponse, event.responseTime);
          if (event.statusCode >= 400) {
            endpointMetrics.errorCount++;
          }
        }

        // Alert for very slow API responses
        if (event.responseTime > this.alertThresholds.apiResponseThreshold * 2) {
          await this.emitPerformanceAlert({
            type: 'warning',
            category: 'api',
            message: `Slow API response: ${endpoint} took ${event.responseTime}ms`,
            metrics: { endpoint, responseTime: event.responseTime },
            timestamp: new Date(),
            tenantId: event.tenantId,
            recommendations: [
              'Check database query performance',
              'Review caching strategies',
              'Optimize business logic',
              'Consider async processing'
            ],
          });
        }
      }

    } catch (error) {
      this.logger.error('Error recording API performance:', error);
    }
  }

  /**
   * Record cache performance
   */
  @OnEvent('cache.operation')
  async recordCachePerformance(event: {
    operation: 'hit' | 'miss' | 'set' | 'evict';
    pattern: string;
    responseTime: number;
    tenantId?: string;
  }): Promise<void> {
    try {
      if (!this.currentMetrics.cache) {
        this.currentMetrics.cache = {
          hitRatio: 0,
          missRatio: 0,
          totalRequests: 0,
          averageResponseTime: 0,
          memoryUsage: 0,
          evictionCount: 0,
        };
      }

      if (event.operation === 'hit' || event.operation === 'miss') {
        this.currentMetrics.cache.totalRequests++;
        
        const hits = (this.currentMetrics.cache.hitRatio / 100) * (this.currentMetrics.cache.totalRequests - 1);
        const newHits = event.operation === 'hit' ? hits + 1 : hits;
        
        this.currentMetrics.cache.hitRatio = (newHits / this.currentMetrics.cache.totalRequests) * 100;
        this.currentMetrics.cache.missRatio = 100 - this.currentMetrics.cache.hitRatio;

        // Update average response time
        const currentAvg = this.currentMetrics.cache.averageResponseTime;
        const count = this.currentMetrics.cache.totalRequests;
        this.currentMetrics.cache.averageResponseTime = 
          ((currentAvg * (count - 1)) + event.responseTime) / count;
      }

      if (event.operation === 'evict') {
        this.currentMetrics.cache.evictionCount++;
      }

      // Alert for low cache hit ratio
      if (this.currentMetrics.cache.totalRequests > 100 && 
          this.currentMetrics.cache.hitRatio < this.alertThresholds.cacheHitRatioThreshold) {
        await this.emitPerformanceAlert({
          type: 'warning',
          category: 'cache',
          message: `Low cache hit ratio: ${this.currentMetrics.cache.hitRatio.toFixed(1)}%`,
          metrics: { hitRatio: this.currentMetrics.cache.hitRatio },
          timestamp: new Date(),
          tenantId: event.tenantId,
          recommendations: [
            'Review cache TTL settings',
            'Optimize cache key strategies',
            'Increase cache memory allocation',
            'Review cache invalidation patterns'
          ],
        });
      }

    } catch (error) {
      this.logger.error('Error recording cache performance:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(tenantId?: string): PerformanceMetrics {
    return {
      timestamp: new Date(),
      tenantId,
      database: this.currentMetrics.database || this.getDefaultDatabaseMetrics(),
      cache: this.currentMetrics.cache || this.getDefaultCacheMetrics(),
      api: this.currentMetrics.api || this.getDefaultAPIMetrics(),
      system: this.collectSystemMetrics(),
      business: this.collectBusinessMetrics(),
    };
  }

  /**
   * Get performance report for a specific period
   */
  async getPerformanceReport(
    tenantId?: string,
    period: { start: Date; end: Date } = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date(),
    }
  ): Promise<PerformanceReport> {
    try {
      const key = tenantId || 'global';
      const metricsHistory = this.performanceData.get(key) || [];
      
      const periodMetrics = metricsHistory.filter(
        m => m.timestamp >= period.start && m.timestamp <= period.end
      );

      if (periodMetrics.length === 0) {
        throw new Error('No performance data available for the specified period');
      }

      const summary = this.calculatePerformanceSummary(periodMetrics);
      const trends = this.calculatePerformanceTrends(periodMetrics);
      const recommendations = this.generateRecommendations(periodMetrics, summary);

      return {
        period,
        summary,
        metrics: periodMetrics,
        trends,
        recommendations,
      };

    } catch (error) {
      this.logger.error('Error generating performance report:', error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Record<string, { status: 'pass' | 'warning' | 'fail'; message: string; value?: number }>;
    lastChecked: Date;
  } {
    const currentMetrics = this.getCurrentMetrics();
    const checks: Record<string, { status: 'pass' | 'warning' | 'fail'; message: string; value?: number }> = {};

    // Database health
    checks.database = {
      status: currentMetrics.database.averageQueryTime < this.alertThresholds.slowQueryThreshold ? 'pass' : 'warning',
      message: `Average query time: ${currentMetrics.database.averageQueryTime.toFixed(2)}ms`,
      value: currentMetrics.database.averageQueryTime,
    };

    // Cache health
    checks.cache = {
      status: currentMetrics.cache.hitRatio > this.alertThresholds.cacheHitRatioThreshold ? 'pass' : 'warning',
      message: `Cache hit ratio: ${currentMetrics.cache.hitRatio.toFixed(1)}%`,
      value: currentMetrics.cache.hitRatio,
    };

    // API health
    checks.api = {
      status: currentMetrics.api.averageResponseTime < this.alertThresholds.apiResponseThreshold ? 'pass' : 'warning',
      message: `Average response time: ${currentMetrics.api.averageResponseTime.toFixed(2)}ms`,
      value: currentMetrics.api.averageResponseTime,
    };

    // System health
    checks.system = {
      status: currentMetrics.system.cpuUsage < this.alertThresholds.cpuUsageThreshold ? 'pass' : 'warning',
      message: `CPU usage: ${currentMetrics.system.cpuUsage.toFixed(1)}%`,
      value: currentMetrics.system.cpuUsage,
    };

    // Memory health
    checks.memory = {
      status: currentMetrics.system.memoryUsage < this.alertThresholds.memoryUsageThreshold ? 'pass' : 'warning',
      message: `Memory usage: ${currentMetrics.system.memoryUsage.toFixed(1)}%`,
      value: currentMetrics.system.memoryUsage,
    };

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;
    const warningChecks = Object.values(checks).filter(check => check.status === 'warning').length;

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (failedChecks > 0) {
      overallStatus = 'critical';
    } else if (warningChecks > 0) {
      overallStatus = 'warning';
    }

    return {
      status: overallStatus,
      checks,
      lastChecked: new Date(),
    };
  }

  /**
   * Set performance baseline for comparison
   */
  async setPerformanceBaseline(): Promise<void> {
    this.performanceBaseline = this.getCurrentMetrics();
    this.logger.log('Performance baseline set successfully');
  }

  /**
   * Compare current performance with baseline
   */
  compareWithBaseline(): {
    comparison: 'better' | 'similar' | 'worse';
    differences: Record<string, { current: number; baseline: number; change: number; changePercent: number }>;
  } | null {
    if (!this.performanceBaseline) {
      return null;
    }

    const current = this.getCurrentMetrics();
    const baseline = this.performanceBaseline;

    const differences: Record<string, { current: number; baseline: number; change: number; changePercent: number }> = {};

    // Compare key metrics
    const metrics = [
      { key: 'databaseQueryTime', current: current.database.averageQueryTime, baseline: baseline.database.averageQueryTime },
      { key: 'apiResponseTime', current: current.api.averageResponseTime, baseline: baseline.api.averageResponseTime },
      { key: 'cacheHitRatio', current: current.cache.hitRatio, baseline: baseline.cache.hitRatio },
      { key: 'cpuUsage', current: current.system.cpuUsage, baseline: baseline.system.cpuUsage },
      { key: 'memoryUsage', current: current.system.memoryUsage, baseline: baseline.system.memoryUsage },
    ];

    let totalChangePercent = 0;
    metrics.forEach(metric => {
      const change = metric.current - metric.baseline;
      const changePercent = (change / metric.baseline) * 100;
      
      differences[metric.key] = {
        current: metric.current,
        baseline: metric.baseline,
        change,
        changePercent,
      };

      // For cache hit ratio, higher is better; for others, lower is better
      if (metric.key === 'cacheHitRatio') {
        totalChangePercent += changePercent;
      } else {
        totalChangePercent -= changePercent;
      }
    });

    const avgChangePercent = totalChangePercent / metrics.length;
    let comparison: 'better' | 'similar' | 'worse' = 'similar';
    
    if (avgChangePercent > 5) {
      comparison = 'better';
    } else if (avgChangePercent < -5) {
      comparison = 'worse';
    }

    return { comparison, differences };
  }

  // ===== CRON JOBS =====

  /**
   * Collect and store performance metrics every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics = this.getCurrentMetrics();
      
      // Store in global metrics
      const globalKey = 'global';
      if (!this.performanceData.has(globalKey)) {
        this.performanceData.set(globalKey, []);
      }
      
      const globalMetrics = this.performanceData.get(globalKey)!;
      globalMetrics.push(metrics);
      
      // Keep only last 24 hours of data
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.performanceData.set(
        globalKey,
        globalMetrics.filter(m => m.timestamp > oneDayAgo)
      );

      // Reset current metrics for next collection
      this.resetCurrentMetrics();

    } catch (error) {
      this.logger.error('Error collecting performance metrics:', error);
    }
  }

  /**
   * Generate daily performance report
   */
  @Cron('0 9 * * *', { timeZone: 'Asia/Jakarta' }) // 9 AM WIB daily
  async generateDailyReport(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);

      const report = await this.getPerformanceReport(undefined, {
        start: yesterday,
        end: endOfYesterday,
      });

      // Emit event for report generation (could be sent via email, Slack, etc.)
      this.eventEmitter.emit('performance.daily_report', {
        report,
        date: yesterday,
      });

      this.logger.log(`Daily performance report generated for ${yesterday.toDateString()}`);

    } catch (error) {
      this.logger.error('Error generating daily performance report:', error);
    }
  }

  // ===== PRIVATE METHODS =====

  private initializeMonitoring(): void {
    this.logger.log('Performance monitoring service initialized');
    
    // Set initial baseline after 5 minutes of operation
    setTimeout(() => {
      this.setPerformanceBaseline();
    }, 5 * 60 * 1000);
  }

  private collectSystemMetrics(): PerformanceMetrics['system'] {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const heapStats = v8.getHeapStatistics();

    return {
      cpuUsage: this.calculateCPUPercentage(cpuUsage),
      memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
      heapUsage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      gcMetrics: {
        totalHeapSize: heapStats.total_heap_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory,
        peakMallocedMemory: heapStats.peak_malloced_memory,
        numberOfNativeContexts: heapStats.number_of_native_contexts,
        numberOfDetachedContexts: heapStats.number_of_detached_contexts,
      },
      diskUsage: 0, // Would need disk usage calculation
      networkUsage: 0, // Would need network usage calculation
    };
  }

  private collectBusinessMetrics(): PerformanceMetrics['business'] {
    // These would typically come from your business logic services
    return {
      activeUsers: 0,
      inventoryOperationsPerMinute: 0,
      productSearches: 0,
      orderProcessingTime: 0,
      realtimeConnections: 0,
    };
  }

  private calculateCPUPercentage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified CPU calculation
    // In production, you'd want a more sophisticated approach
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    return Math.min((totalCpuTime / 1000000) * 100, 100); // Convert microseconds to percentage
  }

  private async emitPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    this.alertHistory.push(alert);
    
    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }

    // Emit event for external handling (email, Slack, etc.)
    this.eventEmitter.emit('performance.alert', alert);
    
    this.logger.warn(`Performance alert: ${alert.message}`, {
      type: alert.type,
      category: alert.category,
      tenantId: alert.tenantId,
    });
  }

  private calculatePerformanceSummary(metrics: PerformanceMetrics[]): PerformanceReport['summary'] {
    if (metrics.length === 0) {
      return {
        overallHealth: 'poor',
        performanceScore: 0,
        keyIssues: ['No performance data available'],
        improvements: [],
      };
    }

    // Calculate averages
    const avgDbQueryTime = metrics.reduce((sum, m) => sum + m.database.averageQueryTime, 0) / metrics.length;
    const avgApiResponseTime = metrics.reduce((sum, m) => sum + m.api.averageResponseTime, 0) / metrics.length;
    const avgCacheHitRatio = metrics.reduce((sum, m) => sum + m.cache.hitRatio, 0) / metrics.length;
    const avgCpuUsage = metrics.reduce((sum, m) => sum + m.system.cpuUsage, 0) / metrics.length;

    // Calculate performance score (0-100)
    let score = 100;
    
    if (avgDbQueryTime > this.alertThresholds.slowQueryThreshold) score -= 20;
    if (avgApiResponseTime > this.alertThresholds.apiResponseThreshold) score -= 20;
    if (avgCacheHitRatio < this.alertThresholds.cacheHitRatioThreshold) score -= 15;
    if (avgCpuUsage > this.alertThresholds.cpuUsageThreshold) score -= 15;

    const keyIssues: string[] = [];
    const improvements: string[] = [];

    if (avgDbQueryTime > this.alertThresholds.slowQueryThreshold) {
      keyIssues.push('Slow database queries detected');
      improvements.push('Optimize database queries and add indexes');
    }

    if (avgCacheHitRatio < this.alertThresholds.cacheHitRatioThreshold) {
      keyIssues.push('Low cache hit ratio');
      improvements.push('Improve caching strategy and TTL settings');
    }

    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (score < 60) overallHealth = 'poor';
    else if (score < 75) overallHealth = 'fair';
    else if (score < 90) overallHealth = 'good';

    return {
      overallHealth,
      performanceScore: Math.max(0, score),
      keyIssues,
      improvements,
    };
  }

  private calculatePerformanceTrends(metrics: PerformanceMetrics[]): PerformanceReport['trends'] {
    if (metrics.length < 2) {
      return {
        responseTimetrend: 'stable',
        cacheEfficiency: 'stable',
        errorRatetrend: 'stable',
      };
    }

    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

    const firstHalfAvgResponse = firstHalf.reduce((sum, m) => sum + m.api.averageResponseTime, 0) / firstHalf.length;
    const secondHalfAvgResponse = secondHalf.reduce((sum, m) => sum + m.api.averageResponseTime, 0) / secondHalf.length;

    const firstHalfCacheHit = firstHalf.reduce((sum, m) => sum + m.cache.hitRatio, 0) / firstHalf.length;
    const secondHalfCacheHit = secondHalf.reduce((sum, m) => sum + m.cache.hitRatio, 0) / secondHalf.length;

    return {
      responseTimetrend: this.calculateTrend(firstHalfAvgResponse, secondHalfAvgResponse, true),
      cacheEfficiency: this.calculateTrend(firstHalfCacheHit, secondHalfCacheHit, false),
      errorRatetrend: 'stable', // Simplified for now
    };
  }

  private calculateTrend(firstValue: number, secondValue: number, lowerIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const changePercent = ((secondValue - firstValue) / firstValue) * 100;
    const threshold = 5; // 5% change threshold

    if (Math.abs(changePercent) < threshold) return 'stable';
    
    if (lowerIsBetter) {
      return changePercent < 0 ? 'improving' : 'degrading';
    } else {
      return changePercent > 0 ? 'improving' : 'degrading';
    }
  }

  private generateRecommendations(metrics: PerformanceMetrics[], summary: PerformanceReport['summary']): PerformanceReport['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    if (summary.performanceScore < 70) {
      immediate.push('Review and optimize slow database queries');
      immediate.push('Increase cache memory allocation');
      shortTerm.push('Implement database query monitoring');
      longTerm.push('Consider database scaling or read replicas');
    }

    if (summary.keyIssues.includes('Low cache hit ratio')) {
      immediate.push('Review cache invalidation strategy');
      shortTerm.push('Implement intelligent cache warming');
      longTerm.push('Consider distributed caching solution');
    }

    return { immediate, shortTerm, longTerm };
  }

  private resetCurrentMetrics(): void {
    this.currentMetrics = {};
  }

  private getDefaultDatabaseMetrics(): PerformanceMetrics['database'] {
    return {
      slowQueries: 0,
      averageQueryTime: 0,
      connectionPoolUsage: 0,
      deadlockCount: 0,
      queryCount: 0,
      topSlowQueries: [],
    };
  }

  private getDefaultCacheMetrics(): PerformanceMetrics['cache'] {
    return {
      hitRatio: 0,
      missRatio: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      evictionCount: 0,
    };
  }

  private getDefaultAPIMetrics(): PerformanceMetrics['api'] {
    return {
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestCount: 0,
      errorRate: 0,
      slowEndpoints: [],
    };
  }
}