import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';

/**
 * Performance Cache Service
 *
 * Implements multi-level caching strategy for StokCerdas:
 * - Level 1: In-Memory Cache (Hot Data) - 30 seconds
 * - Level 2: Redis Cache (Warm Data) - 15-30 minutes
 * - Level 3: Application Cache (Cold Data) - 1-24 hours
 *
 * Key Features:
 * - Intelligent cache key generation
 * - Event-driven cache invalidation
 * - Performance metrics tracking
 * - Indonesian business context awareness
 * - Multi-tenant isolation
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  level?: 'hot' | 'warm' | 'cold'; // Cache level
  tags?: string[]; // Cache tags for bulk invalidation
  compress?: boolean; // Compress large cache values
  tenantId?: string; // Multi-tenant context
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRatio: number;
  avgResponseTime: number;
  totalRequests: number;
  lastUpdated: Date;
}

@Injectable()
export class PerformanceCacheService {
  private readonly logger = new Logger(PerformanceCacheService.name);
  private readonly inMemoryCache = new Map<
    string,
    { value: any; expiry: number; tags: string[] }
  >();
  private readonly metrics = new Map<string, CacheMetrics>();

  // Cache TTL configurations for different data types
  private readonly cacheTTLConfig = {
    // Hot data (frequent access, short TTL)
    hot: {
      tenantConfig: 30, // 30 seconds
      userProfile: 60, // 1 minute
      activeProducts: 120, // 2 minutes
    },
    // Warm data (moderate access, medium TTL)
    warm: {
      productLists: 900, // 15 minutes
      inventoryLevels: 1800, // 30 minutes
      supplierData: 1800, // 30 minutes
      categoryData: 1800, // 30 minutes
    },
    // Cold data (infrequent access, long TTL)
    cold: {
      analytics: 3600, // 1 hour
      reports: 7200, // 2 hours
      historicalData: 86400, // 24 hours
      auditLogs: 86400, // 24 hours
    },
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.setupCacheInvalidationListeners();
    this.startMetricsCleanup();
  }

  /**
   * Set cache value with intelligent key generation and multi-level storage
   */
  async set<T>(
    pattern: string,
    params: Record<string, any>,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(pattern, params);
      const level = options.level || 'warm';
      const ttl = options.ttl || this.getDefaultTTL(pattern, level);
      const tags = options.tags || [];

      // Add tenant context to tags
      if (options.tenantId) {
        tags.push(`tenant:${options.tenantId}`);
      }

      // Store in appropriate cache level
      if (level === 'hot') {
        await this.setInMemoryCache(cacheKey, value, ttl, tags);
      } else {
        await this.setRedisCache(cacheKey, value, ttl, tags);
      }

      this.logger.debug(`Cache SET: ${cacheKey} (${level}, TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Get cache value with automatic fallback and metrics tracking
   */
  async get<T>(
    pattern: string,
    params: Record<string, any>,
    options: CacheOptions = {},
  ): Promise<T | null> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(pattern, params);
    const level = options.level || 'warm';

    try {
      let value: T | null = null;

      // Try hot cache first (in-memory)
      if (level === 'hot') {
        value = await this.getInMemoryCache<T>(cacheKey);
      }

      // Fallback to warm/cold cache (Redis)
      if (value === null) {
        value = await this.getRedisCache<T>(cacheKey);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(pattern, value !== null, responseTime);

      if (value !== null) {
        this.logger.debug(`Cache HIT: ${cacheKey} (${responseTime}ms)`);
      } else {
        this.logger.debug(`Cache MISS: ${cacheKey} (${responseTime}ms)`);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Cache-aside pattern implementation for expensive operations
   */
  async getOrSet<T>(
    pattern: string,
    params: Record<string, any>,
    fallback: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    // Try to get from cache first
    let value = await this.get<T>(pattern, params, options);

    if (value === null) {
      // Cache miss - execute fallback function
      const startTime = Date.now();
      value = await fallback();
      const executionTime = Date.now() - startTime;

      // Cache the result
      await this.set(pattern, params, value, options);

      this.logger.debug(
        `Cache MISS - Executed fallback: ${pattern} (${executionTime}ms)`,
      );
    }

    return value;
  }

  /**
   * Invalidate cache by pattern with tag support
   */
  async invalidate(
    patterns: string | string[],
    tenantId?: string,
  ): Promise<void> {
    try {
      const patternsArray = Array.isArray(patterns) ? patterns : [patterns];

      for (const pattern of patternsArray) {
        // Clear in-memory cache
        await this.clearInMemoryCacheByPattern(pattern, tenantId);

        // Clear Redis cache
        await this.clearRedisCacheByPattern(pattern, tenantId);

        this.logger.debug(
          `Cache INVALIDATED: ${pattern}${
            tenantId ? ` (tenant: ${tenantId})` : ''
          }`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Cache invalidation error for patterns ${patterns}:`,
        error,
      );
    }
  }

  /**
   * Invalidate cache by tags (bulk invalidation)
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        // Clear in-memory cache by tag
        for (const [key, item] of this.inMemoryCache.entries()) {
          if (item.tags.includes(tag)) {
            this.inMemoryCache.delete(key);
          }
        }

        // Clear Redis cache by tag pattern
        const pattern = `*:tag:${tag}:*`;
        await this.clearRedisCacheByPattern(pattern);

        this.logger.debug(`Cache INVALIDATED by tag: ${tag}`);
      }
    } catch (error) {
      this.logger.error(`Cache invalidation by tags error:`, error);
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getCacheMetrics(
    pattern?: string,
  ): CacheMetrics | Record<string, CacheMetrics> {
    if (pattern) {
      return this.metrics.get(pattern) || this.getDefaultMetrics();
    }

    // Return all metrics
    const allMetrics: Record<string, CacheMetrics> = {};
    for (const [key, value] of this.metrics.entries()) {
      allMetrics[key] = value;
    }
    return allMetrics;
  }

  /**
   * Get cache health status
   */
  getCacheHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    inMemorySize: number;
    averageHitRatio: number;
    totalRequests: number;
    issues: string[];
  } {
    const allMetrics = Object.values(
      this.getCacheMetrics() as Record<string, CacheMetrics>,
    );
    const totalRequests = allMetrics.reduce(
      (sum, m) => sum + m.totalRequests,
      0,
    );
    const averageHitRatio =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.hitRatio, 0) / allMetrics.length
        : 0;

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check hit ratio
    if (averageHitRatio < 0.7) {
      issues.push(
        `Low cache hit ratio: ${(averageHitRatio * 100).toFixed(1)}%`,
      );
      status = 'warning';
    }

    // Check memory usage
    const inMemorySize = this.inMemoryCache.size;
    if (inMemorySize > 50000) {
      issues.push(`Critical in-memory cache size: ${inMemorySize} items`);
      status = 'critical';
    } else if (inMemorySize > 10000) {
      issues.push(`High in-memory cache size: ${inMemorySize} items`);
      status = 'warning';
    }

    return {
      status,
      inMemorySize,
      averageHitRatio,
      totalRequests,
      issues,
    };
  }

  // ===== PRIVATE METHODS =====

  private generateCacheKey(
    pattern: string,
    params: Record<string, any>,
  ): string {
    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);

    // Create hash of parameters
    const paramsString = JSON.stringify(sortedParams);
    const paramsHash = createHash('sha256')
      .update(paramsString)
      .digest('hex')
      .substring(0, 16);

    return `stokcerdas:${pattern}:${paramsHash}`;
  }

  private getDefaultTTL(
    pattern: string,
    level: 'hot' | 'warm' | 'cold',
  ): number {
    // Check if pattern matches any specific TTL configuration
    for (const [key, value] of Object.entries(this.cacheTTLConfig[level])) {
      if (pattern.includes(key)) {
        return value;
      }
    }

    // Default TTL based on level
    switch (level) {
      case 'hot':
        return 60; // 1 minute
      case 'warm':
        return 900; // 15 minutes
      case 'cold':
        return 3600; // 1 hour
      default:
        return 900;
    }
  }

  private async setInMemoryCache<T>(
    key: string,
    value: T,
    ttl: number,
    tags: string[],
  ): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.inMemoryCache.set(key, { value, expiry, tags });
  }

  private async getInMemoryCache<T>(key: string): Promise<T | null> {
    const item = this.inMemoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return item.value as T;
  }

  private async setRedisCache<T>(
    key: string,
    value: T,
    ttl: number,
    tags: string[],
  ): Promise<void> {
    const cacheValue = {
      data: value,
      tags,
      cachedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(key, JSON.stringify(cacheValue), ttl * 1000);
  }

  private async getRedisCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheManager.get<string>(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      return parsed.data as T;
    } catch (error) {
      this.logger.warn(`Failed to parse cached value for key ${key}:`, error);
      await this.cacheManager.del(key); // Remove corrupted cache
      return null;
    }
  }

  private async clearInMemoryCacheByPattern(
    pattern: string,
    tenantId?: string,
  ): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, item] of this.inMemoryCache.entries()) {
      if (key.includes(pattern)) {
        if (tenantId && !item.tags.includes(`tenant:${tenantId}`)) {
          continue; // Skip if tenant doesn't match
        }
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.inMemoryCache.delete(key));
  }

  private async clearRedisCacheByPattern(
    pattern: string,
    tenantId?: string,
  ): Promise<void> {
    // This would require Redis SCAN command or custom implementation
    // For now, we'll implement a simple approach
    const searchPattern = tenantId
      ? `*${pattern}*tenant:${tenantId}*`
      : `*${pattern}*`;

    try {
      // Note: This is a simplified implementation
      // Production should use Redis SCAN for better performance
      await this.cacheManager.reset(); // Reset all for now - to be optimized
    } catch (error) {
      this.logger.warn(
        `Failed to clear Redis cache by pattern ${searchPattern}:`,
        error,
      );
    }
  }

  private updateMetrics(
    pattern: string,
    hit: boolean,
    responseTime: number,
  ): void {
    const current = this.metrics.get(pattern) || this.getDefaultMetrics();

    current.totalRequests++;
    if (hit) {
      current.hits++;
    } else {
      current.misses++;
    }
    current.hitRatio = current.hits / current.totalRequests;
    current.avgResponseTime =
      (current.avgResponseTime * (current.totalRequests - 1) + responseTime) /
      current.totalRequests;
    current.lastUpdated = new Date();

    this.metrics.set(pattern, current);
  }

  private getDefaultMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      avgResponseTime: 0,
      totalRequests: 0,
      lastUpdated: new Date(),
    };
  }

  private setupCacheInvalidationListeners(): void {
    // Listen for inventory events
    this.eventEmitter.on('inventory.updated', (event: any) => {
      this.invalidate(['inventory', 'products', 'analytics'], event.tenantId);
    });

    this.eventEmitter.on('product.updated', (event: any) => {
      this.invalidate(['products', 'inventory', 'search'], event.tenantId);
    });

    this.eventEmitter.on('transaction.created', (event: any) => {
      this.invalidate(['transactions', 'analytics', 'reports'], event.tenantId);
    });

    // Listen for user/tenant events
    this.eventEmitter.on('tenant.settings.updated', (event: any) => {
      this.invalidateByTags([`tenant:${event.tenantId}`]);
    });
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      for (const [pattern, metrics] of this.metrics.entries()) {
        if (metrics.lastUpdated < oneHourAgo && metrics.totalRequests === 0) {
          this.metrics.delete(pattern);
        }
      }

      // Clean up expired in-memory cache
      const now = Date.now();
      for (const [key, item] of this.inMemoryCache.entries()) {
        if (now > item.expiry) {
          this.inMemoryCache.delete(key);
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}
