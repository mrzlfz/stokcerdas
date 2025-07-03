import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { InjectRedis } from '@nestjs-modules/ioredis'; // Package not found
import Redis from 'ioredis';

export interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  keyPrefix?: string;
  blockDuration?: number; // in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  private readonly redis: Redis | null = null; // Placeholder
  
  constructor(
    // @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if request is within rate limit using sliding window
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const redisKey = `${config.keyPrefix || 'rate_limit'}:${key}`;
    const now = Date.now();
    const windowStart = now - config.windowSizeMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      
      // Count current requests in window
      pipeline.zcard(redisKey);
      
      // Add current request
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(redisKey, Math.ceil(config.windowSizeMs / 1000));
      
      const results = await pipeline.exec();

      if (!results || results.some(([err]) => err)) {
        this.logger.error(`Rate limit check failed for key: ${key}`);
        // Fail open - allow request if Redis fails
        return {
          allowed: true,
          limit: config.maxRequests,
          remaining: config.maxRequests - 1,
          resetTime: now + config.windowSizeMs,
        };
      }

      const currentCount = results[1][1] as number;
      const allowed = currentCount <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount);
      const resetTime = now + config.windowSizeMs;

      if (!allowed) {
        // Remove the request we just added since it's not allowed
        await this.redis.zrem(redisKey, `${now}-${Math.random()}`);
        
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetTime,
          retryAfter: config.blockDuration || config.windowSizeMs,
        };
      }

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: remaining - 1, // Account for current request
        resetTime,
      };

    } catch (error) {
      this.logger.error(`Rate limit check error: ${error.message}`, error.stack);
      
      // Fail open - allow request if there's an error
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowSizeMs,
      };
    }
  }

  /**
   * Check multiple rate limits (e.g., per-second, per-minute, per-hour)
   */
  async checkMultipleRateLimits(
    key: string,
    configs: Array<RateLimitConfig & { name: string }>,
  ): Promise<{ allowed: boolean; limitedBy?: string; results: Record<string, RateLimitResult> }> {
    const results: Record<string, RateLimitResult> = {};
    let allowed = true;
    let limitedBy: string | undefined;

    for (const config of configs) {
      const result = await this.checkRateLimit(key, config);
      results[config.name] = result;

      if (!result.allowed && allowed) {
        allowed = false;
        limitedBy = config.name;
      }
    }

    return { allowed, limitedBy, results };
  }

  /**
   * Get current rate limit status without consuming a request
   */
  async getRateLimitStatus(
    key: string,
    config: RateLimitConfig,
  ): Promise<Omit<RateLimitResult, 'allowed'>> {
    const redisKey = `${config.keyPrefix || 'rate_limit'}:${key}`;
    const now = Date.now();
    const windowStart = now - config.windowSizeMs;

    try {
      // Clean up expired entries and count
      await this.redis.zremrangebyscore(redisKey, 0, windowStart);
      const currentCount = await this.redis.zcard(redisKey);

      const remaining = Math.max(0, config.maxRequests - currentCount);
      const resetTime = now + config.windowSizeMs;

      return {
        limit: config.maxRequests,
        remaining,
        resetTime,
      };

    } catch (error) {
      this.logger.error(`Rate limit status check error: ${error.message}`);
      
      return {
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: now + config.windowSizeMs,
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(key: string, keyPrefix?: string): Promise<void> {
    const redisKey = `${keyPrefix || 'rate_limit'}:${key}`;
    
    try {
      await this.redis.del(redisKey);
      this.logger.debug(`Rate limit reset for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to reset rate limit for key: ${key}`, error.stack);
    }
  }

  /**
   * Get rate limit configurations for different platforms
   */
  getPlatformRateLimitConfig(platform: string): RateLimitConfig[] {
    const configs: Record<string, RateLimitConfig[]> = {
      shopee: [
        {
          windowSizeMs: 1000, // 1 second
          maxRequests: 10,
          keyPrefix: 'shopee_per_second',
        },
        {
          windowSizeMs: 60000, // 1 minute
          maxRequests: 1000,
          keyPrefix: 'shopee_per_minute',
        },
      ],
      lazada: [
        {
          windowSizeMs: 1000, // 1 second
          maxRequests: 5,
          keyPrefix: 'lazada_per_second',
        },
        {
          windowSizeMs: 60000, // 1 minute
          maxRequests: 500,
          keyPrefix: 'lazada_per_minute',
        },
      ],
      tokopedia: [
        {
          windowSizeMs: 1000, // 1 second
          maxRequests: 8,
          keyPrefix: 'tokopedia_per_second',
        },
        {
          windowSizeMs: 60000, // 1 minute
          maxRequests: 600,
          keyPrefix: 'tokopedia_per_minute',
        },
      ],
      default: [
        {
          windowSizeMs: 1000, // 1 second
          maxRequests: 10,
          keyPrefix: 'default_per_second',
        },
        {
          windowSizeMs: 60000, // 1 minute
          maxRequests: 500,
          keyPrefix: 'default_per_minute',
        },
      ],
    };

    return configs[platform] || configs.default;
  }

  /**
   * Create a delay for rate limiting
   */
  async waitForRateLimit(retryAfter: number): Promise<void> {
    if (retryAfter > 0) {
      this.logger.debug(`Rate limited, waiting ${retryAfter}ms`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
    }
  }

  /**
   * Check and wait for rate limit if necessary
   */
  async checkAndWait(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const result = await this.checkRateLimit(key, config);
    
    if (!result.allowed && result.retryAfter) {
      await this.waitForRateLimit(result.retryAfter);
      // Try again after waiting
      return await this.checkRateLimit(key, config);
    }
    
    return result;
  }

  /**
   * Bulk check rate limits for multiple keys
   */
  async bulkCheckRateLimit(
    keys: string[],
    config: RateLimitConfig,
  ): Promise<Record<string, RateLimitResult>> {
    const results: Record<string, RateLimitResult> = {};
    
    // Use Promise.all for concurrent checks
    const promises = keys.map(async (key) => {
      const result = await this.checkRateLimit(key, config);
      return { key, result };
    });

    const resolvedResults = await Promise.all(promises);
    
    resolvedResults.forEach(({ key, result }) => {
      results[key] = result;
    });

    return results;
  }
}