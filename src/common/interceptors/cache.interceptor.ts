import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { PerformanceCacheService, CacheOptions } from '../services/performance-cache.service';
import { CACHEABLE_KEY, CACHE_EVICT_KEY, CacheableOptions, CacheEvictOptions } from '../decorators/cacheable.decorator';

/**
 * Cache Interceptor
 * 
 * Automatically handles caching logic for methods decorated with cache decorators.
 * Supports:
 * - Intelligent cache key generation
 * - Multi-level caching strategy
 * - Cache invalidation
 * - Performance metrics
 * - Error handling and fallback
 * 
 * Integration with StokCerdas business logic:
 * - Multi-tenant aware caching
 * - Indonesian business context
 * - Real-time inventory updates
 * - Performance optimization for high-traffic operations
 */

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: PerformanceCacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get cache metadata
    const cacheableMetadata = this.reflector.get<{
      pattern: string;
      options: CacheableOptions;
    }>(CACHEABLE_KEY, handler);

    const cacheEvictMetadata = this.reflector.get<CacheEvictOptions>(CACHE_EVICT_KEY, handler);

    // Handle cache eviction before method execution
    if (cacheEvictMetadata && cacheEvictMetadata.timing === 'before') {
      await this.handleCacheEviction(cacheEvictMetadata, context);
    }

    // Handle cacheable operations
    if (cacheableMetadata) {
      return this.handleCacheableOperation(cacheableMetadata, context, next, request);
    }

    // Execute method and handle cache eviction after
    return next.handle().pipe(
      tap(async (result) => {
        if (cacheEvictMetadata && cacheEvictMetadata.timing === 'after') {
          await this.handleCacheEviction(cacheEvictMetadata, context, result);
        }
      }),
      catchError((error) => {
        this.logger.error(`Method execution error in ${controller.name}.${handler.name}:`, error);
        return throwError(() => error);
      }),
    );
  }

  private handleCacheableOperation(
    metadata: { pattern: string; options: CacheableOptions },
    context: ExecutionContext,
    next: CallHandler,
    request: any,
  ): Observable<any> {
    try {
      const { pattern, options } = metadata;
      const args = context.getArgs();
      
      // Generate cache parameters
      const cacheParams = this.generateCacheParams(args, options, request);
      
      // Check condition if specified
      if (options.condition && !options.condition(...args)) {
        return next.handle();
      }

      // Extract tenant context for multi-tenant isolation
      const tenantId = this.extractTenantId(args, request);
      const cacheOptions: CacheOptions = {
        ...options,
        tenantId,
      };

      // Use cache-aside pattern
      return new Observable(observer => {
        this.cacheService
          .getOrSet(
            pattern,
            cacheParams,
            () => next.handle().toPromise(),
            cacheOptions,
          )
          .then(result => {
            // Don't cache null values unless explicitly allowed
            if (result === null && !options.cacheNullValues) {
              return next.handle().subscribe(observer);
            }

            observer.next(result);
            observer.complete();
          })
          .catch(error => {
            this.logger.error(`Cache operation error for pattern ${pattern}:`, error);
            // Fallback to executing the method without cache
            next.handle().subscribe(observer);
          });
      });

    } catch (error) {
      this.logger.error('Cache interceptor error:', error);
      // Fallback to normal execution
      return next.handle();
    }
  }

  private async handleCacheEviction(
    metadata: CacheEvictOptions,
    context: ExecutionContext,
    result?: any,
  ): Promise<void> {
    try {
      const args = context.getArgs();
      const request = context.switchToHttp().getRequest();
      
      // Check condition if specified
      if (metadata.condition && !metadata.condition(...args)) {
        return;
      }

      const tenantId = this.extractTenantId(args, request);

      // Handle pattern-based invalidation
      if (metadata.patterns && metadata.patterns.length > 0) {
        await this.cacheService.invalidate(metadata.patterns, tenantId);
        this.logger.debug(`Cache invalidated by patterns: ${metadata.patterns.join(', ')}`);
      }

      // Handle tag-based invalidation
      if (metadata.tags && metadata.tags.length > 0) {
        // Add tenant-specific tags if tenantId is available
        const tagsToInvalidate = tenantId 
          ? [...metadata.tags, `tenant:${tenantId}`]
          : metadata.tags;
          
        await this.cacheService.invalidateByTags(tagsToInvalidate);
        this.logger.debug(`Cache invalidated by tags: ${tagsToInvalidate.join(', ')}`);
      }

      // Handle all entries eviction for tenant
      if (metadata.allEntries && tenantId) {
        await this.cacheService.invalidateByTags([`tenant:${tenantId}`]);
        this.logger.debug(`All cache entries invalidated for tenant: ${tenantId}`);
      }

    } catch (error) {
      this.logger.error('Cache eviction error:', error);
      // Don't throw error - eviction failure shouldn't break the application
    }
  }

  private generateCacheParams(
    args: any[],
    options: CacheableOptions,
    request: any,
  ): Record<string, any> {
    try {
      // Use custom key generator if provided
      if (options.keyGenerator) {
        return options.keyGenerator(...args);
      }

      // Auto-generate cache key from method arguments
      const params: Record<string, any> = {};

      // Include common request parameters
      if (request?.user?.tenantId) {
        params.tenantId = request.user.tenantId;
      }
      if (request?.user?.id) {
        params.userId = request.user.id;
      }

      // Process method arguments
      args.forEach((arg, index) => {
        if (arg !== null && arg !== undefined) {
          if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
            params[`arg${index}`] = arg;
          } else if (typeof arg === 'object') {
            // For complex objects, create a hash or include key properties
            if (arg.id) params[`arg${index}_id`] = arg.id;
            if (arg.tenantId) params[`arg${index}_tenantId`] = arg.tenantId;
            if (arg.limit) params[`arg${index}_limit`] = arg.limit;
            if (arg.offset) params[`arg${index}_offset`] = arg.offset;
            
            // Include filters or query parameters
            if (arg.filters) {
              params[`arg${index}_filters`] = JSON.stringify(arg.filters);
            }
            if (arg.search) {
              params[`arg${index}_search`] = arg.search;
            }
            if (arg.sortBy) {
              params[`arg${index}_sortBy`] = arg.sortBy;
            }
          }
        }
      });

      // Include cache version for schema changes
      if (options.version) {
        params.version = options.version;
      }

      return params;

    } catch (error) {
      this.logger.warn('Error generating cache params, using fallback:', error);
      
      // Fallback: use a simple hash of all arguments
      return {
        argsHash: this.createArgumentsHash(args),
        timestamp: Math.floor(Date.now() / 60000), // 1-minute precision for time-based keys
      };
    }
  }

  private extractTenantId(args: any[], request: any): string | undefined {
    // Try to extract tenant ID from various sources
    
    // 1. From request user context (most common)
    if (request?.user?.tenantId) {
      return request.user.tenantId;
    }

    // 2. From method arguments (first string that looks like a UUID)
    for (const arg of args) {
      if (typeof arg === 'string' && this.isUUID(arg)) {
        return arg;
      }
    }

    // 3. From nested objects in arguments
    for (const arg of args) {
      if (arg && typeof arg === 'object' && arg.tenantId) {
        return arg.tenantId;
      }
    }

    return undefined;
  }

  private isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private createArgumentsHash(args: any[]): string {
    try {
      const argsString = JSON.stringify(args, (key, value) => {
        // Handle circular references and functions
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Date) return value.toISOString();
        return value;
      });

      // Create a simple hash
      let hash = 0;
      for (let i = 0; i < argsString.length; i++) {
        const char = argsString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(16);
    } catch (error) {
      // Ultimate fallback
      return Date.now().toString();
    }
  }
}

/**
 * Cache Warming Service
 * 
 * Proactively warms up cache for critical operations during off-peak hours.
 * Particularly useful for Indonesian SMB context where business hours are predictable.
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(private readonly cacheService: PerformanceCacheService) {}

  /**
   * Warm up critical caches for a tenant
   */
  async warmupTenantCache(tenantId: string): Promise<void> {
    try {
      this.logger.log(`Starting cache warmup for tenant: ${tenantId}`);

      // Common cache warmup operations for StokCerdas
      const warmupOperations = [
        // Product-related caches
        this.warmupProductCache(tenantId),
        
        // Inventory-related caches
        this.warmupInventoryCache(tenantId),
        
        // Analytics caches
        this.warmupAnalyticsCache(tenantId),
        
        // Configuration caches
        this.warmupConfigCache(tenantId),
      ];

      await Promise.allSettled(warmupOperations);
      
      this.logger.log(`Cache warmup completed for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Cache warmup failed for tenant ${tenantId}:`, error);
    }
  }

  private async warmupProductCache(tenantId: string): Promise<void> {
    // This would typically call the actual service methods to populate cache
    // For now, we'll create placeholder cache entries
    
    const commonProductQueries = [
      { pattern: 'products:list', params: { tenantId, limit: 50, offset: 0 } },
      { pattern: 'products:active', params: { tenantId, status: 'active' } },
      { pattern: 'products:categories', params: { tenantId } },
    ];

    for (const query of commonProductQueries) {
      try {
        // Placeholder: In real implementation, this would call the actual service
        await this.cacheService.set(
          query.pattern,
          query.params,
          { warmup: true, timestamp: new Date() },
          { level: 'warm', ttl: 1800, tenantId },
        );
      } catch (error) {
        this.logger.warn(`Failed to warmup cache for ${query.pattern}:`, error);
      }
    }
  }

  private async warmupInventoryCache(tenantId: string): Promise<void> {
    const commonInventoryQueries = [
      { pattern: 'inventory:levels', params: { tenantId } },
      { pattern: 'inventory:lowstock', params: { tenantId } },
      { pattern: 'inventory:locations', params: { tenantId } },
    ];

    for (const query of commonInventoryQueries) {
      try {
        await this.cacheService.set(
          query.pattern,
          query.params,
          { warmup: true, timestamp: new Date() },
          { level: 'warm', ttl: 900, tenantId },
        );
      } catch (error) {
        this.logger.warn(`Failed to warmup cache for ${query.pattern}:`, error);
      }
    }
  }

  private async warmupAnalyticsCache(tenantId: string): Promise<void> {
    const commonAnalyticsQueries = [
      { pattern: 'analytics:dashboard', params: { tenantId } },
      { pattern: 'analytics:inventory:summary', params: { tenantId } },
      { pattern: 'analytics:sales:daily', params: { tenantId, date: new Date().toISOString().split('T')[0] } },
    ];

    for (const query of commonAnalyticsQueries) {
      try {
        await this.cacheService.set(
          query.pattern,
          query.params,
          { warmup: true, timestamp: new Date() },
          { level: 'cold', ttl: 3600, tenantId },
        );
      } catch (error) {
        this.logger.warn(`Failed to warmup cache for ${query.pattern}:`, error);
      }
    }
  }

  private async warmupConfigCache(tenantId: string): Promise<void> {
    const configQueries = [
      { pattern: 'config:tenant', params: { tenantId } },
      { pattern: 'config:permissions', params: { tenantId } },
      { pattern: 'config:settings', params: { tenantId } },
    ];

    for (const query of configQueries) {
      try {
        await this.cacheService.set(
          query.pattern,
          query.params,
          { warmup: true, timestamp: new Date() },
          { level: 'hot', ttl: 300, tenantId },
        );
      } catch (error) {
        this.logger.warn(`Failed to warmup cache for ${query.pattern}:`, error);
      }
    }
  }

  /**
   * Schedule cache warmup during Indonesian off-peak hours
   */
  scheduleWarmup(): void {
    // Schedule warmup at 3 AM WIB (Indonesian time)
    const warmupHour = 3;
    
    setInterval(() => {
      const now = new Date();
      const jakartaTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric',
        hour12: false,
      }).format(now);
      
      if (parseInt(jakartaTime) === warmupHour) {
        this.logger.log('Starting scheduled cache warmup...');
        // In real implementation, this would get all active tenants and warm their caches
        // this.warmupAllTenants();
      }
    }, 60 * 60 * 1000); // Check every hour
  }
}