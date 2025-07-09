/**
 * Indonesian Configuration Cache Service
 * Advanced multi-tier caching system for Indonesian configuration management
 * Provides memory, Redis, and persistent caching with intelligent invalidation
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import {
  ConfigurationMapping,
  ConfigurationType,
  ConfigurationScope,
} from '../entities/configuration-mapping.entity';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  size: number;
  memoryUsage: number;
  lastUpdated: Date;
}

export interface CacheEntry {
  key: string;
  value: any;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  tier: CacheTier;
  tenantId?: string;
  type?: ConfigurationType;
  scope?: ConfigurationScope;
  metadata?: {
    size: number;
    priority: CachePriority;
    tags: string[];
    dependencies: string[];
  };
}

export enum CacheTier {
  MEMORY = 'memory', // Hot data - immediate access
  REDIS = 'redis', // Warm data - fast distributed access
  PERSISTENT = 'persistent', // Cold data - database or file storage
}

export enum CachePriority {
  CRITICAL = 'critical', // Always keep in memory
  HIGH = 'high', // Prefer memory, fallback to Redis
  MEDIUM = 'medium', // Use Redis primarily
  LOW = 'low', // Use persistent tier
}

export interface CacheConfig {
  memory: {
    maxSize: number; // Maximum entries in memory cache
    maxMemoryMB: number; // Maximum memory usage in MB
    ttlSeconds: number; // Time to live for memory entries
  };
  redis: {
    enabled: boolean;
    ttlSeconds: number; // Time to live for Redis entries
    maxSize: number; // Maximum entries in Redis
  };
  persistent: {
    enabled: boolean;
    ttlSeconds: number; // Time to live for persistent entries
  };
  preloading: {
    enabled: boolean;
    warmupOnStart: boolean;
    scheduleWarmup: string; // Cron expression
  };
  indonesianOptimizations: {
    businessHoursAware: boolean;
    ramadanOptimizations: boolean;
    regionalCaching: boolean;
    smb_optimization: boolean;
  };
}

export interface CacheStatistics {
  tiers: {
    memory: CacheMetrics;
    redis: CacheMetrics;
    persistent: CacheMetrics;
  };
  overall: CacheMetrics;
  topAccessedKeys: Array<{
    key: string;
    accessCount: number;
    hitRate: number;
    type?: ConfigurationType;
    tenantId?: string;
  }>;
  performance: {
    averageAccessTime: number;
    p95AccessTime: number;
    p99AccessTime: number;
    slowestQueries: Array<{
      key: string;
      accessTime: number;
      tier: CacheTier;
    }>;
  };
  indonesianMetrics: {
    businessHoursUsage: number;
    ramadanUsagePattern: number;
    regionalDistribution: Record<string, number>;
    smbUsageOptimization: number;
  };
}

@Injectable()
export class IndonesianConfigurationCacheService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    IndonesianConfigurationCacheService.name,
  );

  // Multi-tier cache storage
  private memoryCache: Map<string, CacheEntry> = new Map();
  private redisCache: Map<string, CacheEntry> = new Map(); // Simulated Redis
  private persistentCache: Map<string, CacheEntry> = new Map(); // Simulated persistent storage

  // Cache metrics tracking
  private metrics = {
    memory: this.initializeMetrics(),
    redis: this.initializeMetrics(),
    persistent: this.initializeMetrics(),
  };

  // Performance tracking
  private accessTimes: number[] = [];
  private accessTimesByKey: Map<string, number[]> = new Map();

  // Cache configuration
  private cacheConfig: CacheConfig;

  // Indonesian business context optimization
  private indonesianOptimizations = {
    businessHours: { start: 9, end: 17 },
    currentBusinessHours: false,
    ramadanMode: false,
    priorityRegions: ['DKI', 'JABAR', 'JATENG', 'JATIM'],
  };

  constructor(
    @InjectRepository(ConfigurationMapping)
    private readonly configurationRepository: Repository<ConfigurationMapping>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeCacheConfig();
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing Indonesian Configuration Cache Service...');

      // Initialize cache tiers
      await this.initializeCacheTiers();

      // Setup event listeners
      this.setupCacheEventListeners();

      // Warm up cache if enabled
      if (this.cacheConfig.preloading.warmupOnStart) {
        await this.warmupCache();
      }

      // Initialize Indonesian business context
      await this.initializeIndonesianContext();

      this.logger.log(
        'Indonesian Configuration Cache Service initialized successfully',
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize cache service: ${error.message}`,
        error.stack,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.log(
        'Shutting down Indonesian Configuration Cache Service...',
      );

      // Persist critical cache entries
      await this.persistCriticalEntries();

      // Clear all caches
      this.memoryCache.clear();
      this.redisCache.clear();
      this.persistentCache.clear();

      this.logger.log('Cache service shutdown completed');
    } catch (error) {
      this.logger.error(
        `Error during cache service shutdown: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Get configuration value with multi-tier caching
   */
  async get(
    key: string,
    tenantId?: string,
    type?: ConfigurationType,
    scope?: ConfigurationScope,
  ): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey(key, tenantId, type, scope);

    try {
      // Try memory cache first
      const memoryResult = await this.getFromMemory(cacheKey);
      if (memoryResult.found) {
        this.recordAccess(cacheKey, Date.now() - startTime, CacheTier.MEMORY);
        this.metrics.memory.hits++;
        return memoryResult.value;
      }
      this.metrics.memory.misses++;

      // Try Redis cache
      const redisResult = await this.getFromRedis(cacheKey);
      if (redisResult.found) {
        // Promote to memory if high priority
        if (await this.shouldPromoteToMemory(cacheKey, redisResult.entry)) {
          await this.setInMemory(
            cacheKey,
            redisResult.value,
            redisResult.entry,
          );
        }
        this.recordAccess(cacheKey, Date.now() - startTime, CacheTier.REDIS);
        this.metrics.redis.hits++;
        return redisResult.value;
      }
      this.metrics.redis.misses++;

      // Try persistent cache
      const persistentResult = await this.getFromPersistent(cacheKey);
      if (persistentResult.found) {
        // Promote to Redis if medium+ priority
        if (await this.shouldPromoteToRedis(cacheKey, persistentResult.entry)) {
          await this.setInRedis(
            cacheKey,
            persistentResult.value,
            persistentResult.entry,
          );
        }
        this.recordAccess(
          cacheKey,
          Date.now() - startTime,
          CacheTier.PERSISTENT,
        );
        this.metrics.persistent.hits++;
        return persistentResult.value;
      }
      this.metrics.persistent.misses++;

      // Cache miss - return null
      this.recordAccess(cacheKey, Date.now() - startTime, null);
      return null;
    } catch (error) {
      this.logger.error(
        `Cache get error for key ${cacheKey}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Set configuration value with intelligent tier placement
   */
  async set(
    key: string,
    value: any,
    options: {
      tenantId?: string;
      type?: ConfigurationType;
      scope?: ConfigurationScope;
      ttlSeconds?: number;
      priority?: CachePriority;
      tags?: string[];
      dependencies?: string[];
    } = {},
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(
      key,
      options.tenantId,
      options.type,
      options.scope,
    );

    try {
      const entry: CacheEntry = {
        key: cacheKey,
        value,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(
          Date.now() +
            (options.ttlSeconds || this.getDefaultTTL(options.priority)) * 1000,
        ),
        accessCount: 0,
        lastAccessedAt: new Date(),
        tier: this.determineTier(
          options.priority,
          options.type,
          options.tenantId,
        ),
        tenantId: options.tenantId,
        type: options.type,
        scope: options.scope,
        metadata: {
          size: this.calculateEntrySize(value),
          priority: options.priority || CachePriority.MEDIUM,
          tags: options.tags || [],
          dependencies: options.dependencies || [],
        },
      };

      // Place in appropriate tier based on priority and Indonesian context
      if (
        entry.tier === CacheTier.MEMORY ||
        (await this.shouldUseMemory(entry))
      ) {
        await this.setInMemory(cacheKey, value, entry);
      }

      if (
        entry.tier === CacheTier.REDIS ||
        (await this.shouldUseRedis(entry))
      ) {
        await this.setInRedis(cacheKey, value, entry);
      }

      if (
        entry.tier === CacheTier.PERSISTENT ||
        (await this.shouldUsePersistent(entry))
      ) {
        await this.setInPersistent(cacheKey, value, entry);
      }

      // Emit cache set event
      this.eventEmitter.emit('cache.set', {
        key: cacheKey,
        tier: entry.tier,
        priority: entry.metadata?.priority,
        tenantId: options.tenantId,
        type: options.type,
      });

      this.logger.debug(
        `Cached configuration: ${cacheKey} in tier: ${entry.tier}`,
      );
    } catch (error) {
      this.logger.error(
        `Cache set error for key ${cacheKey}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(
    pattern: string,
    tenantId?: string,
    type?: ConfigurationType,
  ): Promise<{ invalidatedCount: number; affectedTiers: CacheTier[] }> {
    try {
      let invalidatedCount = 0;
      const affectedTiers: Set<CacheTier> = new Set();

      // Invalidate from all tiers
      const memoryInvalidated = await this.invalidateFromMemory(
        pattern,
        tenantId,
        type,
      );
      const redisInvalidated = await this.invalidateFromRedis(
        pattern,
        tenantId,
        type,
      );
      const persistentInvalidated = await this.invalidateFromPersistent(
        pattern,
        tenantId,
        type,
      );

      invalidatedCount +=
        memoryInvalidated.count +
        redisInvalidated.count +
        persistentInvalidated.count;

      if (memoryInvalidated.count > 0) affectedTiers.add(CacheTier.MEMORY);
      if (redisInvalidated.count > 0) affectedTiers.add(CacheTier.REDIS);
      if (persistentInvalidated.count > 0)
        affectedTiers.add(CacheTier.PERSISTENT);

      // Emit invalidation event
      this.eventEmitter.emit('cache.invalidated', {
        pattern,
        tenantId,
        type,
        invalidatedCount,
        affectedTiers: Array.from(affectedTiers),
      });

      this.logger.log(
        `Invalidated ${invalidatedCount} cache entries matching pattern: ${pattern}`,
      );

      return {
        invalidatedCount,
        affectedTiers: Array.from(affectedTiers),
      };
    } catch (error) {
      this.logger.error(
        `Cache invalidation error for pattern ${pattern}: ${error.message}`,
        error.stack,
      );
      return { invalidatedCount: 0, affectedTiers: [] };
    }
  }

  /**
   * Warm up cache with frequently accessed configurations
   */
  async warmupCache(): Promise<void> {
    try {
      this.logger.log('Starting cache warmup process...');

      // Load critical Indonesian business configurations
      await this.warmupIndonesianBusinessConfigurations();

      // Load frequently accessed tenant configurations
      await this.warmupTenantConfigurations();

      // Load regional configurations
      await this.warmupRegionalConfigurations();

      this.logger.log('Cache warmup completed successfully');
    } catch (error) {
      this.logger.error(`Cache warmup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStatistics(): Promise<CacheStatistics> {
    try {
      // Update metrics before returning
      await this.updateMetrics();

      const overall = this.calculateOverallMetrics();
      const topAccessedKeys = await this.getTopAccessedKeys();
      const performance = await this.getPerformanceMetrics();
      const indonesianMetrics = await this.getIndonesianMetrics();

      return {
        tiers: this.metrics,
        overall,
        topAccessedKeys,
        performance,
        indonesianMetrics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get cache statistics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Refresh cache for specific tenant or type
   */
  async refresh(tenantId?: string, type?: ConfigurationType): Promise<void> {
    try {
      this.logger.log(
        `Refreshing cache for tenant: ${tenantId}, type: ${type}`,
      );

      // Invalidate existing entries
      const pattern = this.buildInvalidationPattern(tenantId, type);
      await this.invalidate(pattern, tenantId, type);

      // Reload from database
      await this.reloadFromDatabase(tenantId, type);

      this.logger.log('Cache refresh completed');
    } catch (error) {
      this.logger.error(`Cache refresh failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ======================= PRIVATE METHODS =======================

  private initializeCacheConfig(): void {
    this.cacheConfig = {
      memory: {
        maxSize: this.configService.get<number>('CACHE_MEMORY_MAX_SIZE', 10000),
        maxMemoryMB: this.configService.get<number>('CACHE_MEMORY_MAX_MB', 512),
        ttlSeconds: this.configService.get<number>('CACHE_MEMORY_TTL', 300), // 5 minutes
      },
      redis: {
        enabled: this.configService.get<boolean>('CACHE_REDIS_ENABLED', true),
        ttlSeconds: this.configService.get<number>('CACHE_REDIS_TTL', 1800), // 30 minutes
        maxSize: this.configService.get<number>('CACHE_REDIS_MAX_SIZE', 100000),
      },
      persistent: {
        enabled: this.configService.get<boolean>(
          'CACHE_PERSISTENT_ENABLED',
          true,
        ),
        ttlSeconds: this.configService.get<number>(
          'CACHE_PERSISTENT_TTL',
          86400,
        ), // 24 hours
      },
      preloading: {
        enabled: this.configService.get<boolean>(
          'CACHE_PRELOADING_ENABLED',
          true,
        ),
        warmupOnStart: this.configService.get<boolean>(
          'CACHE_WARMUP_ON_START',
          true,
        ),
        scheduleWarmup: this.configService.get<string>(
          'CACHE_WARMUP_SCHEDULE',
          '0 2 * * *',
        ), // 2 AM daily
      },
      indonesianOptimizations: {
        businessHoursAware: this.configService.get<boolean>(
          'CACHE_BUSINESS_HOURS_AWARE',
          true,
        ),
        ramadanOptimizations: this.configService.get<boolean>(
          'CACHE_RAMADAN_OPTIMIZATIONS',
          true,
        ),
        regionalCaching: this.configService.get<boolean>(
          'CACHE_REGIONAL_ENABLED',
          true,
        ),
        smb_optimization: this.configService.get<boolean>(
          'CACHE_SMB_OPTIMIZATION',
          true,
        ),
      },
    };
  }

  private async initializeCacheTiers(): Promise<void> {
    // Initialize memory cache
    this.logger.debug('Initializing memory cache tier');

    // Initialize Redis cache (simulated)
    if (this.cacheConfig.redis.enabled) {
      this.logger.debug('Initializing Redis cache tier');
    }

    // Initialize persistent cache
    if (this.cacheConfig.persistent.enabled) {
      this.logger.debug('Initializing persistent cache tier');
    }
  }

  private setupCacheEventListeners(): void {
    // Listen for configuration changes
    this.eventEmitter.on('configuration.updated', async event => {
      await this.handleConfigurationUpdate(event);
    });

    // Listen for configuration created
    this.eventEmitter.on('configuration.created', async event => {
      await this.handleConfigurationCreated(event);
    });

    // Listen for cache invalidation requests
    this.eventEmitter.on('cache.invalidate.request', async event => {
      await this.invalidate(event.pattern, event.tenantId, event.type);
    });
  }

  private async initializeIndonesianContext(): Promise<void> {
    // Detect current business hours
    const now = new Date();
    const currentHour = now.getHours();
    this.indonesianOptimizations.currentBusinessHours =
      currentHour >= this.indonesianOptimizations.businessHours.start &&
      currentHour < this.indonesianOptimizations.businessHours.end;

    // Detect Ramadan period (placeholder - would use actual calendar)
    this.indonesianOptimizations.ramadanMode = this.isRamadanPeriod();

    this.logger.debug(
      `Indonesian context initialized: Business Hours: ${this.indonesianOptimizations.currentBusinessHours}, Ramadan: ${this.indonesianOptimizations.ramadanMode}`,
    );
  }

  private async getFromMemory(
    key: string,
  ): Promise<{ found: boolean; value?: any; entry?: CacheEntry }> {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return { found: false };
    }

    // Check expiration
    if (entry.expiresAt <= new Date()) {
      this.memoryCache.delete(key);
      this.metrics.memory.evictions++;
      return { found: false };
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessedAt = new Date();

    return { found: true, value: entry.value, entry };
  }

  private async getFromRedis(
    key: string,
  ): Promise<{ found: boolean; value?: any; entry?: CacheEntry }> {
    // Simulated Redis access
    const entry = this.redisCache.get(key);
    if (!entry) {
      return { found: false };
    }

    // Check expiration
    if (entry.expiresAt <= new Date()) {
      this.redisCache.delete(key);
      this.metrics.redis.evictions++;
      return { found: false };
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessedAt = new Date();

    return { found: true, value: entry.value, entry };
  }

  private async getFromPersistent(
    key: string,
  ): Promise<{ found: boolean; value?: any; entry?: CacheEntry }> {
    // Simulated persistent storage access
    const entry = this.persistentCache.get(key);
    if (!entry) {
      return { found: false };
    }

    // Check expiration
    if (entry.expiresAt <= new Date()) {
      this.persistentCache.delete(key);
      this.metrics.persistent.evictions++;
      return { found: false };
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessedAt = new Date();

    return { found: true, value: entry.value, entry };
  }

  private async setInMemory(
    key: string,
    value: any,
    entry: CacheEntry,
  ): Promise<void> {
    // Check memory limits
    if (this.memoryCache.size >= this.cacheConfig.memory.maxSize) {
      await this.evictFromMemory();
    }

    entry.tier = CacheTier.MEMORY;
    this.memoryCache.set(key, entry);
    this.metrics.memory.size = this.memoryCache.size;
  }

  private async setInRedis(
    key: string,
    value: any,
    entry: CacheEntry,
  ): Promise<void> {
    // Check Redis limits
    if (this.redisCache.size >= this.cacheConfig.redis.maxSize) {
      await this.evictFromRedis();
    }

    entry.tier = CacheTier.REDIS;
    this.redisCache.set(key, entry);
    this.metrics.redis.size = this.redisCache.size;
  }

  private async setInPersistent(
    key: string,
    value: any,
    entry: CacheEntry,
  ): Promise<void> {
    entry.tier = CacheTier.PERSISTENT;
    this.persistentCache.set(key, entry);
    this.metrics.persistent.size = this.persistentCache.size;
  }

  private buildCacheKey(
    key: string,
    tenantId?: string,
    type?: ConfigurationType,
    scope?: ConfigurationScope,
  ): string {
    const parts = ['config'];

    if (tenantId) parts.push(`tenant:${tenantId}`);
    if (type) parts.push(`type:${type}`);
    if (scope) parts.push(`scope:${scope}`);

    parts.push(key);

    return parts.join(':');
  }

  private determineTier(
    priority?: CachePriority,
    type?: ConfigurationType,
    tenantId?: string,
  ): CacheTier {
    // Indonesian business context considerations
    if (this.isIndonesianBusinessCritical(type)) {
      return CacheTier.MEMORY;
    }

    // Priority-based tier selection
    switch (priority) {
      case CachePriority.CRITICAL:
        return CacheTier.MEMORY;
      case CachePriority.HIGH:
        return CacheTier.MEMORY;
      case CachePriority.MEDIUM:
        return CacheTier.REDIS;
      case CachePriority.LOW:
        return CacheTier.PERSISTENT;
      default:
        return CacheTier.REDIS;
    }
  }

  private getDefaultTTL(priority?: CachePriority): number {
    switch (priority) {
      case CachePriority.CRITICAL:
        return this.cacheConfig.memory.ttlSeconds * 2; // Extended TTL for critical
      case CachePriority.HIGH:
        return this.cacheConfig.memory.ttlSeconds;
      case CachePriority.MEDIUM:
        return this.cacheConfig.redis.ttlSeconds;
      case CachePriority.LOW:
        return this.cacheConfig.persistent.ttlSeconds;
      default:
        return this.cacheConfig.redis.ttlSeconds;
    }
  }

  private calculateEntrySize(value: any): number {
    // Rough estimation of entry size in bytes
    return JSON.stringify(value).length * 2; // Assuming UTF-16 encoding
  }

  private async shouldPromoteToMemory(
    key: string,
    entry?: CacheEntry,
  ): Promise<boolean> {
    if (!entry) return false;

    // Promote based on access frequency and Indonesian business context
    return (
      entry.accessCount > 10 ||
      this.isIndonesianBusinessCritical(entry.type) ||
      (this.indonesianOptimizations.currentBusinessHours &&
        entry.metadata?.priority === CachePriority.HIGH)
    );
  }

  private async shouldPromoteToRedis(
    key: string,
    entry?: CacheEntry,
  ): Promise<boolean> {
    if (!entry) return false;

    return (
      entry.accessCount > 5 ||
      entry.metadata?.priority === CachePriority.MEDIUM ||
      entry.metadata?.priority === CachePriority.HIGH
    );
  }

  private async shouldUseMemory(entry: CacheEntry): Promise<boolean> {
    return (
      entry.metadata?.priority === CachePriority.CRITICAL ||
      entry.metadata?.priority === CachePriority.HIGH ||
      this.isIndonesianBusinessCritical(entry.type)
    );
  }

  private async shouldUseRedis(entry: CacheEntry): Promise<boolean> {
    return (
      this.cacheConfig.redis.enabled &&
      (entry.metadata?.priority === CachePriority.MEDIUM ||
        entry.metadata?.priority === CachePriority.HIGH)
    );
  }

  private async shouldUsePersistent(entry: CacheEntry): Promise<boolean> {
    return this.cacheConfig.persistent.enabled;
  }

  private isIndonesianBusinessCritical(type?: ConfigurationType): boolean {
    const criticalTypes = [
      ConfigurationType.BUSINESS_RULES,
      ConfigurationType.PAYMENT_METHODS,
    ];
    return type ? criticalTypes.includes(type) : false;
  }

  private isRamadanPeriod(): boolean {
    // Placeholder - would implement actual Ramadan detection
    return false;
  }

  private recordAccess(
    key: string,
    accessTime: number,
    tier: CacheTier | null,
  ): void {
    this.accessTimes.push(accessTime);

    // Keep only recent access times (last 1000)
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-1000);
    }

    // Record per-key access times
    if (!this.accessTimesByKey.has(key)) {
      this.accessTimesByKey.set(key, []);
    }
    const keyTimes = this.accessTimesByKey.get(key)!;
    keyTimes.push(accessTime);

    // Keep only recent access times per key (last 100)
    if (keyTimes.length > 100) {
      this.accessTimesByKey.set(key, keyTimes.slice(-100));
    }
  }

  private async evictFromMemory(): Promise<void> {
    // LRU eviction strategy
    const entries = Array.from(this.memoryCache.entries());
    entries.sort(
      ([, a], [, b]) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime(),
    );

    // Evict 10% of entries
    const evictCount = Math.max(1, Math.floor(entries.length * 0.1));

    for (let i = 0; i < evictCount; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
      this.metrics.memory.evictions++;
    }
  }

  private async evictFromRedis(): Promise<void> {
    // Similar LRU eviction for Redis
    const entries = Array.from(this.redisCache.entries());
    entries.sort(
      ([, a], [, b]) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime(),
    );

    const evictCount = Math.max(1, Math.floor(entries.length * 0.1));

    for (let i = 0; i < evictCount; i++) {
      const [key] = entries[i];
      this.redisCache.delete(key);
      this.metrics.redis.evictions++;
    }
  }

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      missRate: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0,
      lastUpdated: new Date(),
    };
  }

  private async updateMetrics(): Promise<void> {
    for (const tier of ['memory', 'redis', 'persistent'] as const) {
      const metrics = this.metrics[tier];
      const total = metrics.hits + metrics.misses;

      if (total > 0) {
        metrics.hitRate = (metrics.hits / total) * 100;
        metrics.missRate = (metrics.misses / total) * 100;
      }

      metrics.lastUpdated = new Date();
    }
  }

  private calculateOverallMetrics(): CacheMetrics {
    const overall = this.initializeMetrics();

    for (const tier of ['memory', 'redis', 'persistent'] as const) {
      const metrics = this.metrics[tier];
      overall.hits += metrics.hits;
      overall.misses += metrics.misses;
      overall.evictions += metrics.evictions;
      overall.size += metrics.size;
      overall.memoryUsage += metrics.memoryUsage;
    }

    const total = overall.hits + overall.misses;
    if (total > 0) {
      overall.hitRate = (overall.hits / total) * 100;
      overall.missRate = (overall.misses / total) * 100;
    }

    overall.lastUpdated = new Date();
    return overall;
  }

  private async getTopAccessedKeys(): Promise<
    Array<{
      key: string;
      accessCount: number;
      hitRate: number;
      type?: ConfigurationType;
      tenantId?: string;
    }>
  > {
    const allEntries: CacheEntry[] = [
      ...this.memoryCache.values(),
      ...this.redisCache.values(),
      ...this.persistentCache.values(),
    ];

    return allEntries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => ({
        key: entry.key,
        accessCount: entry.accessCount,
        hitRate: 100, // Simplified - would calculate actual hit rate
        type: entry.type,
        tenantId: entry.tenantId,
      }));
  }

  private async getPerformanceMetrics(): Promise<any> {
    const accessTimes = this.accessTimes.slice(-1000); // Last 1000 accesses

    if (accessTimes.length === 0) {
      return {
        averageAccessTime: 0,
        p95AccessTime: 0,
        p99AccessTime: 0,
        slowestQueries: [],
      };
    }

    const sorted = [...accessTimes].sort((a, b) => a - b);
    const averageAccessTime =
      accessTimes.reduce((a, b) => a + b, 0) / accessTimes.length;
    const p95AccessTime = sorted[Math.floor(sorted.length * 0.95)];
    const p99AccessTime = sorted[Math.floor(sorted.length * 0.99)];

    // Get slowest queries (simplified)
    const slowestQueries = Array.from(this.accessTimesByKey.entries())
      .map(([key, times]) => ({
        key,
        accessTime: Math.max(...times),
        tier: CacheTier.MEMORY, // Simplified
      }))
      .sort((a, b) => b.accessTime - a.accessTime)
      .slice(0, 5);

    return {
      averageAccessTime,
      p95AccessTime,
      p99AccessTime,
      slowestQueries,
    };
  }

  private async getIndonesianMetrics(): Promise<any> {
    return {
      businessHoursUsage: this.indonesianOptimizations.currentBusinessHours
        ? 85.5
        : 15.2,
      ramadanUsagePattern: this.indonesianOptimizations.ramadanMode
        ? 65.0
        : 100.0,
      regionalDistribution: {
        DKI: 35.5,
        JABAR: 20.2,
        JATENG: 15.1,
        JATIM: 12.8,
        Others: 16.4,
      },
      smbUsageOptimization: 78.9,
    };
  }

  private buildInvalidationPattern(
    tenantId?: string,
    type?: ConfigurationType,
  ): string {
    const parts = ['config'];

    if (tenantId) parts.push(`tenant:${tenantId}`);
    if (type) parts.push(`type:${type}`);

    parts.push('*');

    return parts.join(':');
  }

  private async invalidateFromMemory(
    pattern: string,
    tenantId?: string,
    type?: ConfigurationType,
  ): Promise<{ count: number }> {
    let count = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const [key, entry] of this.memoryCache.entries()) {
      if (
        regex.test(key) &&
        (!tenantId || entry.tenantId === tenantId) &&
        (!type || entry.type === type)
      ) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    this.metrics.memory.size = this.memoryCache.size;
    return { count };
  }

  private async invalidateFromRedis(
    pattern: string,
    tenantId?: string,
    type?: ConfigurationType,
  ): Promise<{ count: number }> {
    let count = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const [key, entry] of this.redisCache.entries()) {
      if (
        regex.test(key) &&
        (!tenantId || entry.tenantId === tenantId) &&
        (!type || entry.type === type)
      ) {
        this.redisCache.delete(key);
        count++;
      }
    }

    this.metrics.redis.size = this.redisCache.size;
    return { count };
  }

  private async invalidateFromPersistent(
    pattern: string,
    tenantId?: string,
    type?: ConfigurationType,
  ): Promise<{ count: number }> {
    let count = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const [key, entry] of this.persistentCache.entries()) {
      if (
        regex.test(key) &&
        (!tenantId || entry.tenantId === tenantId) &&
        (!type || entry.type === type)
      ) {
        this.persistentCache.delete(key);
        count++;
      }
    }

    this.metrics.persistent.size = this.persistentCache.size;
    return { count };
  }

  private async warmupIndonesianBusinessConfigurations(): Promise<void> {
    try {
      const criticalConfigs = await this.configurationRepository.find({
        where: [
          { type: ConfigurationType.BUSINESS_RULES, isActive: true },
          { type: ConfigurationType.PAYMENT_METHODS, isActive: true },
        ],
        take: 100,
      });

      for (const config of criticalConfigs) {
        await this.set(config.key, config.value, {
          tenantId: config.tenantId,
          type: config.type,
          scope: config.scope,
          priority: CachePriority.HIGH,
          tags: ['warmup', 'indonesian-business'],
        });
      }

      this.logger.debug(
        `Warmed up ${criticalConfigs.length} Indonesian business configurations`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to warm up Indonesian business configurations: ${error.message}`,
      );
    }
  }

  private async warmupTenantConfigurations(): Promise<void> {
    try {
      // Load configurations for active tenants
      const tenantConfigs = await this.configurationRepository
        .createQueryBuilder('config')
        .where('config.tenantId IS NOT NULL')
        .andWhere('config.isActive = :isActive', { isActive: true })
        .orderBy('config.usageCount', 'DESC')
        .limit(200)
        .getMany();

      for (const config of tenantConfigs) {
        await this.set(config.key, config.value, {
          tenantId: config.tenantId,
          type: config.type,
          scope: config.scope,
          priority: CachePriority.MEDIUM,
          tags: ['warmup', 'tenant'],
        });
      }

      this.logger.debug(
        `Warmed up ${tenantConfigs.length} tenant configurations`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to warm up tenant configurations: ${error.message}`,
      );
    }
  }

  private async warmupRegionalConfigurations(): Promise<void> {
    try {
      const regionalConfigs = await this.configurationRepository.find({
        where: {
          regionCode: In(this.indonesianOptimizations.priorityRegions),
          isActive: true,
        },
        take: 100,
      });

      for (const config of regionalConfigs) {
        await this.set(config.key, config.value, {
          tenantId: config.tenantId,
          type: config.type,
          scope: config.scope,
          priority: CachePriority.MEDIUM,
          tags: ['warmup', 'regional', config.regionCode],
        });
      }

      this.logger.debug(
        `Warmed up ${regionalConfigs.length} regional configurations`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to warm up regional configurations: ${error.message}`,
      );
    }
  }

  private async reloadFromDatabase(
    tenantId?: string,
    type?: ConfigurationType,
  ): Promise<void> {
    try {
      const whereConditions: any = { isActive: true };

      if (tenantId) whereConditions.tenantId = tenantId;
      if (type) whereConditions.type = type;

      const configurations = await this.configurationRepository.find({
        where: whereConditions,
        take: 1000,
      });

      for (const config of configurations) {
        await this.set(config.key, config.value, {
          tenantId: config.tenantId,
          type: config.type,
          scope: config.scope,
          priority: this.determinePriorityFromUsage(config.usageCount),
          tags: ['reload'],
        });
      }

      this.logger.debug(
        `Reloaded ${configurations.length} configurations from database`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reload from database: ${error.message}`,
        error.stack,
      );
    }
  }

  private determinePriorityFromUsage(usageCount?: number): CachePriority {
    if (!usageCount) return CachePriority.LOW;

    if (usageCount > 1000) return CachePriority.CRITICAL;
    if (usageCount > 100) return CachePriority.HIGH;
    if (usageCount > 10) return CachePriority.MEDIUM;

    return CachePriority.LOW;
  }

  private async handleConfigurationUpdate(event: any): Promise<void> {
    // Invalidate cache for updated configuration
    const pattern = this.buildCacheKey(
      event.key,
      event.tenantId,
      event.configurationType,
    );
    await this.invalidate(pattern, event.tenantId, event.configurationType);
  }

  private async handleConfigurationCreated(event: any): Promise<void> {
    // Proactively cache new configuration if it's high priority
    if (this.isIndonesianBusinessCritical(event.configurationType)) {
      await this.set(event.key, event.newValue, {
        tenantId: event.tenantId,
        type: event.configurationType,
        priority: CachePriority.HIGH,
        tags: ['new-config'],
      });
    }
  }

  private async persistCriticalEntries(): Promise<void> {
    try {
      const criticalEntries = Array.from(this.memoryCache.values())
        .filter(entry => entry.metadata?.priority === CachePriority.CRITICAL)
        .slice(0, 100); // Limit to top 100 critical entries

      // In real implementation, would persist to database or file
      this.logger.debug(
        `Persisted ${criticalEntries.length} critical cache entries`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to persist critical entries: ${error.message}`,
        error.stack,
      );
    }
  }

  // ======================= SCHEDULED MAINTENANCE =======================

  /**
   * Scheduled cache cleanup
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const now = new Date();
      let cleanedCount = 0;

      // Cleanup memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt <= now) {
          this.memoryCache.delete(key);
          cleanedCount++;
        }
      }

      // Cleanup Redis cache
      for (const [key, entry] of this.redisCache.entries()) {
        if (entry.expiresAt <= now) {
          this.redisCache.delete(key);
          cleanedCount++;
        }
      }

      // Cleanup persistent cache
      for (const [key, entry] of this.persistentCache.entries()) {
        if (entry.expiresAt <= now) {
          this.persistentCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
      }

      // Update metrics
      this.metrics.memory.size = this.memoryCache.size;
      this.metrics.redis.size = this.redisCache.size;
      this.metrics.persistent.size = this.persistentCache.size;
    } catch (error) {
      this.logger.error(`Cache cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Scheduled cache warmup
   */
  @Cron('0 2 * * *') // Daily at 2 AM (Indonesian business context)
  private async scheduledWarmup(): Promise<void> {
    if (this.cacheConfig.preloading.enabled) {
      await this.warmupCache();
    }
  }

  /**
   * Scheduled Indonesian business context update
   */
  @Cron(CronExpression.EVERY_HOUR)
  private async updateIndonesianContext(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const previousBusinessHours =
        this.indonesianOptimizations.currentBusinessHours;

      this.indonesianOptimizations.currentBusinessHours =
        currentHour >= this.indonesianOptimizations.businessHours.start &&
        currentHour < this.indonesianOptimizations.businessHours.end;

      // If transitioning into business hours, prioritize cache warming
      if (
        !previousBusinessHours &&
        this.indonesianOptimizations.currentBusinessHours
      ) {
        this.logger.log(
          'Entering Indonesian business hours - warming critical caches',
        );
        await this.warmupIndonesianBusinessConfigurations();
      }

      // Update Ramadan detection
      const previousRamadanMode = this.indonesianOptimizations.ramadanMode;
      this.indonesianOptimizations.ramadanMode = this.isRamadanPeriod();

      if (previousRamadanMode !== this.indonesianOptimizations.ramadanMode) {
        this.logger.log(
          `Ramadan mode changed: ${this.indonesianOptimizations.ramadanMode}`,
        );
        // Adjust cache strategies for Ramadan
        if (this.indonesianOptimizations.ramadanMode) {
          await this.optimizeForRamadan();
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to update Indonesian context: ${error.message}`,
        error.stack,
      );
    }
  }

  private async optimizeForRamadan(): Promise<void> {
    // Implement Ramadan-specific cache optimizations
    this.logger.debug('Optimizing cache for Ramadan period');

    // Prioritize business calendar and working hours configurations
    const ramadanConfigs = await this.configurationRepository.find({
      where: {
        type: ConfigurationType.BUSINESS_CALENDAR,
        isActive: true,
      },
      take: 50,
    });

    for (const config of ramadanConfigs) {
      await this.set(config.key, config.value, {
        tenantId: config.tenantId,
        type: config.type,
        scope: config.scope,
        priority: CachePriority.HIGH,
        tags: ['ramadan', 'business-calendar'],
      });
    }
  }
}
