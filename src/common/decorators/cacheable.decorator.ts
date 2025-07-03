import { SetMetadata, applyDecorators } from '@nestjs/common';
import { CacheOptions } from '../services/performance-cache.service';

export const CACHEABLE_KEY = 'cacheable';
export const CACHE_EVICT_KEY = 'cache_evict';

/**
 * Cacheable Decorator
 * 
 * Automatically caches method results using the PerformanceCacheService.
 * Supports intelligent cache key generation and multi-level caching.
 * 
 * Usage Examples:
 * 
 * @Cacheable('products:list', { level: 'warm', ttl: 900 })
 * async findAllProducts(tenantId: string, filters: any) {
 *   // This method's result will be cached for 15 minutes
 * }
 * 
 * @Cacheable('inventory:item', { level: 'hot', ttl: 60, tags: ['inventory'] })
 * async getInventoryItem(tenantId: string, productId: string) {
 *   // Hot cache with 1 minute TTL and inventory tag
 * }
 */
export interface CacheableOptions extends CacheOptions {
  // Cache key generation strategy
  keyStrategy?: 'auto' | 'custom';
  
  // Custom key generator function
  keyGenerator?: (...args: any[]) => Record<string, any>;
  
  // Conditional caching - cache only if this returns true
  condition?: (...args: any[]) => boolean;
  
  // Whether to cache null/undefined results
  cacheNullValues?: boolean;
  
  // Async cache warming - continue execution while updating cache in background
  asyncRefresh?: boolean;
  
  // Cache version for schema changes
  version?: string;
}

/**
 * Marks a method as cacheable
 */
export function Cacheable(pattern: string, options: CacheableOptions = {}) {
  return applyDecorators(
    SetMetadata(CACHEABLE_KEY, {
      pattern,
      options: {
        level: 'warm',
        ttl: 900, // 15 minutes default
        keyStrategy: 'auto',
        cacheNullValues: false,
        asyncRefresh: false,
        ...options,
      },
    }),
  );
}

/**
 * Cache Evict Decorator
 * 
 * Automatically invalidates cache when method is called.
 * Supports pattern-based and tag-based invalidation.
 * 
 * Usage Examples:
 * 
 * @CacheEvict(['products:list', 'products:search'])
 * async updateProduct(tenantId: string, productId: string, data: any) {
 *   // Will invalidate product list and search caches
 * }
 * 
 * @CacheEvict({ tags: ['inventory'], patterns: ['inventory:*'] })
 * async updateInventory(data: any) {
 *   // Will invalidate all inventory-related caches
 * }
 */
export interface CacheEvictOptions {
  // Cache patterns to invalidate
  patterns?: string[];
  
  // Cache tags to invalidate
  tags?: string[];
  
  // Whether to invalidate before or after method execution
  timing?: 'before' | 'after';
  
  // Conditional eviction - evict only if this returns true
  condition?: (...args: any[]) => boolean;
  
  // Whether to evict all tenant data
  allEntries?: boolean;
}

/**
 * Marks a method to evict cache entries
 */
export function CacheEvict(
  patternsOrOptions: string[] | CacheEvictOptions,
) {
  const options: CacheEvictOptions = Array.isArray(patternsOrOptions)
    ? { patterns: patternsOrOptions, timing: 'after' }
    : { timing: 'after', ...patternsOrOptions };

  return applyDecorators(
    SetMetadata(CACHE_EVICT_KEY, options),
  );
}

/**
 * Cache Put Decorator
 * 
 * Always executes the method and updates the cache with the result.
 * Useful for methods that should always refresh cache data.
 */
export function CachePut(pattern: string, options: CacheableOptions = {}) {
  return applyDecorators(
    SetMetadata('cache_put', {
      pattern,
      options: {
        level: 'warm',
        ttl: 900,
        keyStrategy: 'auto',
        ...options,
      },
    }),
  );
}

/**
 * Conditional Cache Decorator
 * 
 * Caches result only if condition is met.
 * Useful for caching expensive operations selectively.
 */
export function CacheableIf(
  pattern: string,
  condition: (...args: any[]) => boolean,
  options: CacheableOptions = {},
) {
  return Cacheable(pattern, {
    ...options,
    condition,
  });
}

/**
 * Time-based Cache Decorator
 * 
 * Caches with different TTLs based on time of day or business hours.
 * Useful for Indonesian business context.
 */
export function TimeBasedCache(
  pattern: string,
  options: CacheableOptions & {
    businessHoursTTL?: number; // TTL during business hours (9 AM - 6 PM WIB)
    offHoursTTL?: number; // TTL during off hours
    timezone?: string; // Default: 'Asia/Jakarta'
  } = {},
) {
  const timezone = options.timezone || 'Asia/Jakarta';
  
  // Determine TTL based on current time in Indonesian timezone
  const getCurrentTTL = () => {
    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    
    const hour = parseInt(jakartaTime);
    const isBusinessHours = hour >= 9 && hour < 18;
    
    return isBusinessHours 
      ? (options.businessHoursTTL || 300) // 5 minutes during business hours
      : (options.offHoursTTL || 1800); // 30 minutes during off hours
  };
  
  return Cacheable(pattern, {
    ...options,
    ttl: getCurrentTTL(),
  });
}

/**
 * Indonesian Business Cache Decorator
 * 
 * Optimized for Indonesian SMB usage patterns:
 * - Higher cache during Ramadan (reduced business activity)
 * - Different TTLs for different provinces (timezone consideration)
 * - Cache warming during peak hours (10 AM - 2 PM WIB)
 */
export function IndonesianBusinessCache(
  pattern: string,
  options: CacheableOptions & {
    province?: 'WIB' | 'WITA' | 'WIT'; // Indonesian time zones
    considerHolidays?: boolean;
    peakHoursTTL?: number;
    normalTTL?: number;
  } = {},
) {
  const getBusinessContextTTL = () => {
    const now = new Date();
    
    // Get hour in appropriate Indonesian timezone
    let timezone = 'Asia/Jakarta'; // WIB
    if (options.province === 'WITA') timezone = 'Asia/Makassar';
    if (options.province === 'WIT') timezone = 'Asia/Jayapura';
    
    const localHour = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    
    const hour = parseInt(localHour);
    const isPeakHours = hour >= 10 && hour <= 14; // 10 AM - 2 PM
    
    return isPeakHours
      ? (options.peakHoursTTL || 180) // 3 minutes during peak
      : (options.normalTTL || 600); // 10 minutes normal
  };
  
  return Cacheable(pattern, {
    level: 'warm',
    ...options,
    ttl: getBusinessContextTTL(),
    tags: [...(options.tags || []), `province:${options.province || 'WIB'}`],
  });
}

/**
 * Auto-Refresh Cache Decorator
 * 
 * Automatically refreshes cache in background before expiry.
 * Ensures users never experience cache misses for critical data.
 */
export function AutoRefreshCache(
  pattern: string,
  options: CacheableOptions & {
    refreshThreshold?: number; // Percentage of TTL when to start background refresh (0.8 = 80%)
    refreshMethod?: string; // Method name to call for refresh
  } = {},
) {
  return Cacheable(pattern, {
    ...options,
    asyncRefresh: true,
    tags: [...(options.tags || []), 'auto-refresh'],
  });
}

/**
 * Multi-Tenant Cache Decorator
 * 
 * Automatically includes tenant context in cache keys and tags.
 * Ensures proper tenant isolation in cached data.
 */
export function TenantCache(
  pattern: string,
  options: CacheableOptions = {},
) {
  return Cacheable(`tenant:${pattern}`, {
    ...options,
    keyGenerator: (...args: any[]) => {
      // Extract tenantId from first argument (common pattern)
      const tenantId = args[0];
      return {
        tenantId,
        ...((options.keyGenerator && options.keyGenerator(...args)) || {}),
      };
    },
    tags: [...(options.tags || []), 'tenant-data'],
  });
}

/**
 * Inventory Specific Cache Decorator
 * 
 * Optimized for inventory operations with business-specific caching strategy.
 */
export function InventoryCache(
  pattern: string,
  options: CacheableOptions = {},
) {
  return Cacheable(`inventory:${pattern}`, {
    level: 'warm',
    ttl: 300, // 5 minutes for inventory data
    ...options,
    tags: [...(options.tags || []), 'inventory', 'business-critical'],
  });
}

/**
 * Analytics Cache Decorator
 * 
 * Long-term caching for analytics and reporting data.
 */
export function AnalyticsCache(
  pattern: string,
  options: CacheableOptions = {},
) {
  return Cacheable(`analytics:${pattern}`, {
    level: 'cold',
    ttl: 3600, // 1 hour for analytics
    ...options,
    tags: [...(options.tags || []), 'analytics', 'reports'],
  });
}