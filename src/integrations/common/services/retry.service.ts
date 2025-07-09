import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum ErrorType {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent', 
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  BUSINESS_LOGIC = 'business_logic',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export interface ClassifiedError {
  type: ErrorType;
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
  context?: Record<string, any>;
  originalError: Error;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMaxMs?: number;
  retryableErrors?: ErrorType[];
  onRetry?: (error: ClassifiedError, attempt: number) => void;
  onSuccess?: (result: any, totalAttempts: number) => void;
  onFailure?: (error: ClassifiedError, totalAttempts: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: ClassifiedError;
  totalAttempts: number;
  totalDuration: number;
  attemptResults: Array<{
    attempt: number;
    success: boolean;
    duration: number;
    error?: ClassifiedError;
  }>;
}

export interface RetryMetrics {
  operationType: string;
  totalAttempts: number;
  successCount: number;
  errorCounts: Record<ErrorType, number>;
  averageAttempts: number;
  averageDuration: number;
  successRate: number;
  retryRate: number;
  lastUpdated: Date;
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly metrics = new Map<string, RetryMetrics>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    operationName: string,
    context?: Record<string, any>,
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const attemptResults: RetryResult<T>['attemptResults'] = [];
    let lastError: ClassifiedError | undefined;

    this.logger.debug(`Starting retry operation: ${operationName}`, {
      maxAttempts: config.maxAttempts,
      initialDelay: config.initialDelayMs,
      context,
    });

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        this.logger.debug(`Attempt ${attempt}/${config.maxAttempts} for ${operationName}`);
        
        const result = await operation();
        const attemptDuration = Date.now() - attemptStartTime;
        
        attemptResults.push({
          attempt,
          success: true,
          duration: attemptDuration,
        });

        const totalDuration = Date.now() - startTime;
        
        // Success callback
        if (config.onSuccess) {
          config.onSuccess(result, attempt);
        }

        // Update metrics
        this.updateMetrics(operationName, {
          totalAttempts: attempt,
          success: true,
          duration: totalDuration,
        });

        // Emit success event
        this.eventEmitter.emit('retry.success', {
          operationName,
          attempt,
          totalDuration,
          context,
        });

        this.logger.debug(`Operation ${operationName} succeeded on attempt ${attempt}`);
        
        return {
          success: true,
          result,
          totalAttempts: attempt,
          totalDuration,
          attemptResults,
        };

      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        const classifiedError = this.classifyError(error, operationName, context);
        
        attemptResults.push({
          attempt,
          success: false,
          duration: attemptDuration,
          error: classifiedError,
        });

        lastError = classifiedError;

        this.logger.warn(
          `Attempt ${attempt}/${config.maxAttempts} failed for ${operationName}`,
          {
            errorType: classifiedError.type,
            errorCode: classifiedError.code,
            message: classifiedError.message,
            retryable: classifiedError.retryable,
            context,
          }
        );

        // Check if error is retryable
        if (!this.isRetryable(classifiedError, config)) {
          this.logger.error(
            `Non-retryable error for ${operationName}: ${classifiedError.message}`,
            {
              errorType: classifiedError.type,
              errorCode: classifiedError.code,
              context,
            }
          );
          break;
        }

        // Don't retry on last attempt
        if (attempt === config.maxAttempts) {
          this.logger.error(
            `Max attempts reached for ${operationName}: ${classifiedError.message}`,
            {
              maxAttempts: config.maxAttempts,
              errorType: classifiedError.type,
              context,
            }
          );
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(
          config,
          attempt,
          classifiedError.retryAfter,
        );

        // Retry callback
        if (config.onRetry) {
          config.onRetry(classifiedError, attempt);
        }

        // Emit retry event
        this.eventEmitter.emit('retry.attempt', {
          operationName,
          attempt,
          error: classifiedError,
          nextDelay: delay,
          context,
        });

        this.logger.debug(
          `Retrying ${operationName} in ${delay}ms (attempt ${attempt + 1}/${config.maxAttempts})`,
          {
            errorType: classifiedError.type,
            backoffDelay: delay,
          }
        );

        await this.wait(delay);
      }
    }

    const totalDuration = Date.now() - startTime;

    // Failure callback
    if (config.onFailure && lastError) {
      config.onFailure(lastError, config.maxAttempts);
    }

    // Update metrics
    this.updateMetrics(operationName, {
      totalAttempts: config.maxAttempts,
      success: false,
      duration: totalDuration,
      error: lastError,
    });

    // Emit failure event
    this.eventEmitter.emit('retry.failure', {
      operationName,
      totalAttempts: config.maxAttempts,
      totalDuration,
      lastError,
      context,
    });

    this.logger.error(
      `Operation ${operationName} failed after ${config.maxAttempts} attempts`,
      {
        totalDuration,
        lastError: lastError?.message,
        context,
      }
    );

    return {
      success: false,
      error: lastError,
      totalAttempts: config.maxAttempts,
      totalDuration,
      attemptResults,
    };
  }

  /**
   * Classify error for retry decisions
   */
  private classifyError(
    error: any,
    operationName: string,
    context?: Record<string, any>,
  ): ClassifiedError {
    // Default classification
    let errorType: ErrorType = ErrorType.UNKNOWN;
    let retryable = false;
    let retryAfter: number | undefined;
    let code = 'UNKNOWN_ERROR';

    // Extract error details
    const message = error.message || error.toString();
    const statusCode = error.status || error.statusCode || error.code;

    // Network and timeout errors
    if (this.isNetworkError(error)) {
      errorType = ErrorType.NETWORK;
      retryable = true;
      code = 'NETWORK_ERROR';
    } else if (this.isTimeoutError(error)) {
      errorType = ErrorType.TIMEOUT;
      retryable = true;
      code = 'TIMEOUT_ERROR';
    }
    // HTTP status code classification
    else if (statusCode) {
      if (statusCode >= 500 && statusCode < 600) {
        // Server errors - typically retryable
        errorType = ErrorType.TRANSIENT;
        retryable = true;
        code = `HTTP_${statusCode}`;
      } else if (statusCode === 429) {
        // Rate limiting
        errorType = ErrorType.RATE_LIMIT;
        retryable = true;
        code = 'RATE_LIMIT_EXCEEDED';
        retryAfter = this.extractRetryAfter(error);
      } else if (statusCode === 401 || statusCode === 403) {
        // Authentication errors
        errorType = ErrorType.AUTHENTICATION;
        retryable = false; // Usually need manual intervention
        code = 'AUTHENTICATION_ERROR';
      } else if (statusCode >= 400 && statusCode < 500) {
        // Client errors - typically not retryable
        errorType = ErrorType.PERMANENT;
        retryable = false;
        code = `HTTP_${statusCode}`;
      }
    }
    // Platform-specific error patterns
    else if (this.isPlatformError(error, message)) {
      const platformError = this.classifyPlatformError(error, message);
      errorType = platformError.type;
      retryable = platformError.retryable;
      code = platformError.code;
      retryAfter = platformError.retryAfter;
    }
    // Business logic errors
    else if (this.isBusinessLogicError(message)) {
      errorType = ErrorType.BUSINESS_LOGIC;
      retryable = false;
      code = 'BUSINESS_LOGIC_ERROR';
    }

    return {
      type: errorType,
      code,
      message,
      retryable,
      retryAfter,
      context: {
        operationName,
        statusCode,
        ...context,
      },
      originalError: error,
    };
  }

  /**
   * Check if error is retryable based on configuration
   */
  private isRetryable(error: ClassifiedError, config: RetryConfig): boolean {
    if (!error.retryable) {
      return false;
    }

    // Check if error type is in the retryable list
    if (config.retryableErrors) {
      return config.retryableErrors.includes(error.type);
    }

    // Default retryable error types
    const defaultRetryableTypes = [
      ErrorType.TRANSIENT,
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.RATE_LIMIT,
    ];

    return defaultRetryableTypes.includes(error.type);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(
    config: RetryConfig,
    attempt: number,
    retryAfter?: number,
  ): number {
    // Use retryAfter if provided by the server
    if (retryAfter && retryAfter > 0) {
      return Math.min(retryAfter, config.maxDelayMs);
    }

    // Exponential backoff: initialDelay * (backoffMultiplier ^ (attempt - 1))
    const exponentialDelay = config.initialDelayMs * 
      Math.pow(config.backoffMultiplier, attempt - 1);

    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = config.jitterMaxMs 
      ? Math.random() * config.jitterMaxMs 
      : 0;

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Wait for specified duration
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    const networkCodes = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ENOTFOUND',
      'ECONNABORTED',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'ENETUNREACH',
    ];

    return networkCodes.includes(error.code) || 
           error.message?.includes('network') ||
           error.message?.includes('connection');
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: any): boolean {
    return error.code === 'ETIMEDOUT' ||
           error.message?.includes('timeout') ||
           error.message?.includes('timed out');
  }

  /**
   * Check if error is platform-specific
   */
  private isPlatformError(error: any, message: string): boolean {
    const platformKeywords = [
      'shopee', 'lazada', 'tokopedia',
      'rate limit', 'quota', 'throttle',
      'signature', 'authorization',
      'order not found', 'invalid order',
    ];

    return platformKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Classify platform-specific errors
   */
  private classifyPlatformError(
    error: any,
    message: string,
  ): { type: ErrorType; retryable: boolean; code: string; retryAfter?: number } {
    const lowerMessage = message.toLowerCase();

    // Rate limiting patterns
    if (lowerMessage.includes('rate limit') || 
        lowerMessage.includes('quota') ||
        lowerMessage.includes('throttle')) {
      return {
        type: ErrorType.RATE_LIMIT,
        retryable: true,
        code: 'PLATFORM_RATE_LIMIT',
        retryAfter: this.extractRetryAfter(error),
      };
    }

    // Authentication patterns
    if (lowerMessage.includes('signature') ||
        lowerMessage.includes('authorization') ||
        lowerMessage.includes('invalid token')) {
      return {
        type: ErrorType.AUTHENTICATION,
        retryable: false,
        code: 'PLATFORM_AUTH_ERROR',
      };
    }

    // Business logic patterns
    if (lowerMessage.includes('order not found') ||
        lowerMessage.includes('invalid order') ||
        lowerMessage.includes('status cannot be changed')) {
      return {
        type: ErrorType.BUSINESS_LOGIC,
        retryable: false,
        code: 'PLATFORM_BUSINESS_ERROR',
      };
    }

    // Default to transient
    return {
      type: ErrorType.TRANSIENT,
      retryable: true,
      code: 'PLATFORM_ERROR',
    };
  }

  /**
   * Check if error is a business logic error
   */
  private isBusinessLogicError(message: string): boolean {
    const businessLogicKeywords = [
      'validation',
      'invalid status',
      'conflict',
      'not allowed',
      'permission denied',
      'business rule',
    ];

    return businessLogicKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Extract retry-after value from error
   */
  private extractRetryAfter(error: any): number | undefined {
    // Check headers for Retry-After
    if (error.response?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'], 10);
      return isNaN(retryAfter) ? undefined : retryAfter * 1000; // Convert to ms
    }

    // Check error message for retry patterns
    const retryPattern = /retry.*?(\d+)\s*(second|minute|hour)/i;
    const match = error.message?.match(retryPattern);
    
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      
      switch (unit) {
        case 'second':
          return value * 1000;
        case 'minute':
          return value * 60 * 1000;
        case 'hour':
          return value * 60 * 60 * 1000;
        default:
          return value * 1000;
      }
    }

    return undefined;
  }

  /**
   * Update operation metrics
   */
  private updateMetrics(
    operationName: string,
    result: {
      totalAttempts: number;
      success: boolean;
      duration: number;
      error?: ClassifiedError;
    },
  ): void {
    const existing = this.metrics.get(operationName) || {
      operationType: operationName,
      totalAttempts: 0,
      successCount: 0,
      errorCounts: {} as Record<ErrorType, number>,
      averageAttempts: 0,
      averageDuration: 0,
      successRate: 0,
      retryRate: 0,
      lastUpdated: new Date(),
    };

    // Update counters
    existing.totalAttempts += result.totalAttempts;
    if (result.success) {
      existing.successCount++;
    }

    // Update error counts
    if (result.error) {
      existing.errorCounts[result.error.type] = 
        (existing.errorCounts[result.error.type] || 0) + 1;
    }

    // Calculate averages
    const totalOperations = existing.successCount + 
      Object.values(existing.errorCounts).reduce((a, b) => a + b, 0);
    
    existing.averageAttempts = existing.totalAttempts / totalOperations;
    existing.successRate = (existing.successCount / totalOperations) * 100;
    existing.retryRate = ((existing.totalAttempts - totalOperations) / existing.totalAttempts) * 100;
    existing.lastUpdated = new Date();

    this.metrics.set(operationName, existing);
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(operationName: string): RetryMetrics | undefined {
    return this.metrics.get(operationName);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, RetryMetrics> {
    const result: Record<string, RetryMetrics> = {};
    this.metrics.forEach((metrics, operationName) => {
      result[operationName] = metrics;
    });
    return result;
  }

  /**
   * Clear metrics for an operation
   */
  clearMetrics(operationName: string): void {
    this.metrics.delete(operationName);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get default retry configuration for different operation types
   */
  getDefaultRetryConfig(operationType: string): RetryConfig {
    const configs: Record<string, RetryConfig> = {
      // API calls with moderate retry
      api_call: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitterMaxMs: 1000,
        retryableErrors: [
          ErrorType.TRANSIENT,
          ErrorType.NETWORK,
          ErrorType.TIMEOUT,
          ErrorType.RATE_LIMIT,
        ],
      },
      
      // Order sync operations with aggressive retry
      order_sync: {
        maxAttempts: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 1.5,
        jitterMaxMs: 2000,
        retryableErrors: [
          ErrorType.TRANSIENT,
          ErrorType.NETWORK,
          ErrorType.TIMEOUT,
          ErrorType.RATE_LIMIT,
        ],
      },
      
      // Database operations with quick retry
      database: {
        maxAttempts: 2,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        jitterMaxMs: 500,
        retryableErrors: [
          ErrorType.TRANSIENT,
          ErrorType.NETWORK,
          ErrorType.TIMEOUT,
        ],
      },
      
      // Default configuration
      default: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitterMaxMs: 1000,
        retryableErrors: [
          ErrorType.TRANSIENT,
          ErrorType.NETWORK,
          ErrorType.TIMEOUT,
        ],
      },
    };

    return configs[operationType] || configs.default;
  }
}