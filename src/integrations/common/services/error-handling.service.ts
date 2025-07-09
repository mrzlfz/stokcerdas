import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RetryService, RetryConfig, RetryResult, ErrorType } from './retry.service';
import { 
  CircuitBreakerService, 
  CircuitBreakerConfig, 
  CircuitBreakerState,
  CircuitBreakerResult 
} from './circuit-breaker.service';
import { IntegrationLogService } from './integration-log.service';
import { 
  IntegrationLogType, 
  IntegrationLogLevel 
} from '../../entities/integration-log.entity';

export interface ErrorHandlingConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
  operationTimeout: number;
  logLevel: IntegrationLogLevel;
  enableMetrics: boolean;
  enableEvents: boolean;
}

export interface ErrorHandlingContext {
  tenantId: string;
  channelId?: string;
  operationType: string;
  operationName: string;
  serviceName: string;
  platform?: string;
  userId?: string;
  correlationId?: string;
  requestId?: string;
  businessContext?: Record<string, any>;
}

export interface ErrorHandlingResult<T> {
  success: boolean;
  result?: T;
  error?: {
    type: ErrorType;
    code: string;
    message: string;
    originalError: Error;
    context: ErrorHandlingContext;
    retryAttempts: number;
    circuitBreakerState: CircuitBreakerState;
    totalDuration: number;
    recoverable: boolean;
    recommendations: string[];
  };
  metrics: {
    totalDuration: number;
    retryAttempts: number;
    circuitBreakerState: CircuitBreakerState;
    circuitBreakerOpen: boolean;
    operationTimestamp: Date;
  };
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'circuit_breaker' | 'fallback' | 'escalate' | 'ignore';
  config?: Record<string, any>;
  description: string;
  priority: number;
}

@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);

  constructor(
    private readonly retryService: RetryService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly logService: IntegrationLogService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute operation with comprehensive error handling
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorHandlingContext,
    config?: Partial<ErrorHandlingConfig>,
  ): Promise<ErrorHandlingResult<T>> {
    const startTime = Date.now();
    const operationConfig = this.getOperationConfig(context.operationType, config);
    
    this.logger.debug(`Starting error-handled operation: ${context.operationName}`, {
      context,
      config: operationConfig,
    });

    // Log operation start
    await this.logOperationStart(context, operationConfig);

    // Emit operation start event
    if (operationConfig.enableEvents) {
      this.eventEmitter.emit('error-handling.operation.start', {
        context,
        timestamp: new Date(),
      });
    }

    try {
      let result: T;
      let retryResult: RetryResult<T> | null = null;
      let circuitBreakerResult: CircuitBreakerResult<T> | null = null;
      let circuitBreakerState = CircuitBreakerState.CLOSED;
      let retryAttempts = 0;

      // Wrap operation with timeout
      const timeoutOperation = this.wrapWithTimeout(
        operation,
        operationConfig.operationTimeout,
        context
      );

      if (operationConfig.enableCircuitBreaker) {
        // Execute with circuit breaker
        circuitBreakerResult = await this.circuitBreakerService.executeWithCircuitBreaker(
          operationConfig.enableRetry 
            ? () => this.executeWithRetry(timeoutOperation, context, operationConfig)
            : timeoutOperation,
          context.serviceName,
          operationConfig.circuitBreaker,
          context.operationName,
        );

        circuitBreakerState = circuitBreakerResult.state;

        if (circuitBreakerResult.success) {
          result = circuitBreakerResult.result as T;
          
          // If we used retry, extract retry info
          if (operationConfig.enableRetry && typeof circuitBreakerResult.result === 'object' && 
              circuitBreakerResult.result && 'totalAttempts' in (circuitBreakerResult.result as any)) {
            retryResult = circuitBreakerResult.result as unknown as RetryResult<T>;
            result = retryResult.result as T;
            retryAttempts = retryResult.totalAttempts;
          }
        } else {
          throw circuitBreakerResult.error || new Error('Circuit breaker failed');
        }
      } else if (operationConfig.enableRetry) {
        // Execute with retry only
        retryResult = await this.retryService.executeWithRetry(
          timeoutOperation,
          operationConfig.retry,
          context.operationName,
          context,
        );

        retryAttempts = retryResult.totalAttempts;

        if (retryResult.success) {
          result = retryResult.result as T;
        } else {
          throw retryResult.error?.originalError || new Error('Retry failed');
        }
      } else {
        // Execute without error handling
        result = await timeoutOperation();
      }

      const totalDuration = Date.now() - startTime;

      // Log successful operation
      await this.logOperationSuccess(context, totalDuration, retryAttempts);

      // Emit success event
      if (operationConfig.enableEvents) {
        this.eventEmitter.emit('error-handling.operation.success', {
          context,
          result,
          totalDuration,
          retryAttempts,
          circuitBreakerState,
        });
      }

      return {
        success: true,
        result,
        metrics: {
          totalDuration,
          retryAttempts,
          circuitBreakerState,
          circuitBreakerOpen: circuitBreakerState === CircuitBreakerState.OPEN,
          operationTimestamp: new Date(),
        },
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      // Get circuit breaker state
      const circuitBreakerState = this.circuitBreakerService.getState(context.serviceName);
      
      // Classify error
      const errorClassification = this.classifyOperationError(error, context);
      
      // Generate recovery strategies
      const recoveryStrategies = this.generateRecoveryStrategies(
        errorClassification,
        context,
        operationConfig
      );

      // Log error
      await this.logOperationError(context, error, totalDuration, recoveryStrategies);

      // Emit error event
      if (operationConfig.enableEvents) {
        this.eventEmitter.emit('error-handling.operation.error', {
          context,
          error: errorClassification,
          totalDuration,
          circuitBreakerState,
          recoveryStrategies,
        });
      }

      return {
        success: false,
        error: {
          type: errorClassification.type,
          code: errorClassification.code,
          message: errorClassification.message,
          originalError: error,
          context,
          retryAttempts: 0, // Will be updated if retry info is available
          circuitBreakerState,
          totalDuration,
          recoverable: errorClassification.retryable,
          recommendations: recoveryStrategies.map(s => s.description),
        },
        metrics: {
          totalDuration,
          retryAttempts: 0,
          circuitBreakerState,
          circuitBreakerOpen: circuitBreakerState === CircuitBreakerState.OPEN,
          operationTimestamp: new Date(),
        },
      };
    }
  }

  /**
   * Execute operation with retry wrapper
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorHandlingContext,
    config: ErrorHandlingConfig,
  ): Promise<T> {
    const result = await this.retryService.executeWithRetry(
      operation,
      config.retry,
      context.operationName,
      context,
    );

    if (result.success) {
      return result.result as T;
    } else {
      throw result.error?.originalError || new Error('Retry failed');
    }
  }

  /**
   * Wrap operation with timeout
   */
  private wrapWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    context: ErrorHandlingContext,
  ): () => Promise<T> {
    return async (): Promise<T> => {
      return Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          setTimeout(() => {
            reject(new Error(
              `Operation timeout after ${timeoutMs}ms: ${context.operationName}`
            ));
          }, timeoutMs);
        }),
      ]);
    };
  }

  /**
   * Classify operation error with business context
   */
  private classifyOperationError(
    error: any,
    context: ErrorHandlingContext,
  ): ReturnType<RetryService['classifyError']> {
    // Use retry service classification as base
    const baseClassification = (this.retryService as any).classifyError(
      error,
      context.operationName,
      context,
    );

    // Add Indonesian business context classification
    if (context.platform && this.isIndonesianPlatformError(error, context.platform)) {
      return this.enhanceWithIndonesianBusinessContext(baseClassification, context);
    }

    return baseClassification;
  }

  /**
   * Check if error is specific to Indonesian platforms
   */
  private isIndonesianPlatformError(error: any, platform: string): boolean {
    const message = error.message?.toLowerCase() || '';
    const indonesianPlatforms = ['shopee', 'lazada', 'tokopedia'];
    
    return indonesianPlatforms.includes(platform.toLowerCase()) &&
           (message.includes('indonesia') || 
            message.includes('rupiah') ||
            message.includes('jakarta') ||
            message.includes('id locale'));
  }

  /**
   * Enhance error classification with Indonesian business context
   */
  private enhanceWithIndonesianBusinessContext(
    classification: any,
    context: ErrorHandlingContext,
  ): any {
    const enhanced = { ...classification };

    // Add Indonesian business context
    enhanced.context = {
      ...enhanced.context,
      indonesianBusiness: true,
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      businessHours: this.isIndonesianBusinessHours(),
      ramadanPeriod: this.isRamadanPeriod(),
      publicHoliday: this.isIndonesianPublicHoliday(),
    };

    // Adjust retry behavior for Indonesian context
    if (enhanced.context.businessHours === false) {
      enhanced.retryable = false;
      enhanced.message += ' (Outside Indonesian business hours)';
    }

    if (enhanced.context.ramadanPeriod) {
      enhanced.message += ' (During Ramadan period - expect slower response)';
    }

    return enhanced;
  }

  /**
   * Check if current time is within Indonesian business hours
   */
  private isIndonesianBusinessHours(): boolean {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    const day = jakartaTime.getDay();

    // Monday to Friday, 9 AM to 5 PM Jakarta time
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  /**
   * Check if current time is during Ramadan period
   */
  private isRamadanPeriod(): boolean {
    // Simplified check - in production, use Islamic calendar library
    const now = new Date();
    const month = now.getMonth();
    
    // Approximate Ramadan period (varies each year)
    // This is a simplified check - real implementation should use proper Islamic calendar
    return month === 2 || month === 3; // March-April approximate
  }

  /**
   * Check if current date is Indonesian public holiday
   */
  private isIndonesianPublicHoliday(): boolean {
    // Simplified check - in production, use comprehensive holiday calendar
    const now = new Date();
    const month = now.getMonth();
    const date = now.getDate();
    
    // Check for major Indonesian holidays
    const holidays = [
      { month: 0, date: 1 },   // New Year
      { month: 7, date: 17 },  // Independence Day
      { month: 11, date: 25 }, // Christmas
    ];

    return holidays.some(holiday => 
      holiday.month === month && holiday.date === date
    );
  }

  /**
   * Generate recovery strategies for errors
   */
  private generateRecoveryStrategies(
    error: any,
    context: ErrorHandlingContext,
    config: ErrorHandlingConfig,
  ): ErrorRecoveryStrategy[] {
    const strategies: ErrorRecoveryStrategy[] = [];

    switch (error.type) {
      case ErrorType.RATE_LIMIT:
        strategies.push({
          type: 'retry',
          config: { 
            delayMs: error.retryAfter || 60000,
            exponentialBackoff: true,
          },
          description: `Wait ${error.retryAfter || 60000}ms before retrying due to rate limit`,
          priority: 1,
        });
        break;

      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
        strategies.push({
          type: 'circuit_breaker',
          config: { 
            openDuration: 30000,
            halfOpenAttempts: 1,
          },
          description: 'Use circuit breaker to prevent cascading failures',
          priority: 1,
        });
        strategies.push({
          type: 'retry',
          config: { 
            maxAttempts: 3,
            exponentialBackoff: true,
          },
          description: 'Retry with exponential backoff for network issues',
          priority: 2,
        });
        break;

      case ErrorType.AUTHENTICATION:
        strategies.push({
          type: 'escalate',
          config: { 
            notifyAdmins: true,
            requireManualIntervention: true,
          },
          description: 'Escalate to admin for authentication issues',
          priority: 1,
        });
        break;

      case ErrorType.BUSINESS_LOGIC:
        strategies.push({
          type: 'fallback',
          config: { 
            useDefaultBehavior: true,
            logForReview: true,
          },
          description: 'Use fallback behavior for business logic errors',
          priority: 1,
        });
        break;

      case ErrorType.TRANSIENT:
        strategies.push({
          type: 'retry',
          config: { 
            maxAttempts: 2,
            delayMs: 5000,
          },
          description: 'Retry immediately for transient errors',
          priority: 1,
        });
        break;

      default:
        strategies.push({
          type: 'escalate',
          config: { 
            requireInvestigation: true,
          },
          description: 'Unknown error type requires investigation',
          priority: 1,
        });
    }

    // Add Indonesian business context strategies
    if (context.platform && ['shopee', 'lazada', 'tokopedia'].includes(context.platform)) {
      strategies.push({
        type: 'retry',
        config: { 
          respectBusinessHours: true,
          delayUntilBusinessHours: true,
        },
        description: 'Retry during Indonesian business hours for better success rate',
        priority: 3,
      });
    }

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get operation configuration
   */
  private getOperationConfig(
    operationType: string,
    override?: Partial<ErrorHandlingConfig>,
  ): ErrorHandlingConfig {
    const baseConfig = this.getDefaultErrorHandlingConfig(operationType);
    
    return {
      ...baseConfig,
      ...override,
      retry: {
        ...baseConfig.retry,
        ...override?.retry,
      },
      circuitBreaker: {
        ...baseConfig.circuitBreaker,
        ...override?.circuitBreaker,
      },
    };
  }

  /**
   * Get default error handling configuration for operation types
   */
  private getDefaultErrorHandlingConfig(operationType: string): ErrorHandlingConfig {
    const configs: Record<string, ErrorHandlingConfig> = {
      order_sync: {
        retry: this.retryService.getDefaultRetryConfig('order_sync'),
        circuitBreaker: {
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 60000,
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          monitoringPeriod: 60000,
          resetTimeout: 300000,
        },
        enableCircuitBreaker: true,
        enableRetry: true,
        operationTimeout: 30000,
        logLevel: IntegrationLogLevel.INFO,
        enableMetrics: true,
        enableEvents: true,
      },
      
      api_call: {
        retry: this.retryService.getDefaultRetryConfig('api_call'),
        circuitBreaker: {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 30000,
          volumeThreshold: 5,
          errorThresholdPercentage: 40,
          monitoringPeriod: 30000,
          resetTimeout: 180000,
        },
        enableCircuitBreaker: true,
        enableRetry: true,
        operationTimeout: 15000,
        logLevel: IntegrationLogLevel.INFO,
        enableMetrics: true,
        enableEvents: true,
      },
      
      database: {
        retry: this.retryService.getDefaultRetryConfig('database'),
        circuitBreaker: {
          failureThreshold: 2,
          successThreshold: 1,
          timeout: 10000,
          volumeThreshold: 5,
          errorThresholdPercentage: 30,
          monitoringPeriod: 30000,
          resetTimeout: 60000,
        },
        enableCircuitBreaker: true,
        enableRetry: true,
        operationTimeout: 10000,
        logLevel: IntegrationLogLevel.WARN,
        enableMetrics: true,
        enableEvents: false,
      },
      
      default: {
        retry: this.retryService.getDefaultRetryConfig('default'),
        circuitBreaker: {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 30000,
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          monitoringPeriod: 60000,
          resetTimeout: 180000,
        },
        enableCircuitBreaker: true,
        enableRetry: true,
        operationTimeout: 30000,
        logLevel: IntegrationLogLevel.INFO,
        enableMetrics: true,
        enableEvents: true,
      },
    };

    return configs[operationType] || configs.default;
  }

  /**
   * Log operation start
   */
  private async logOperationStart(
    context: ErrorHandlingContext,
    config: ErrorHandlingConfig,
  ): Promise<void> {
    if (config.logLevel === IntegrationLogLevel.ERROR) {
      return; // Skip logging for error-only level
    }

    await this.logService.log({
      tenantId: context.tenantId,
      channelId: context.channelId,
      type: IntegrationLogType.SYSTEM,
      level: IntegrationLogLevel.INFO,
      message: `Starting operation: ${context.operationName}`,
      metadata: {
        operationType: context.operationType,
        serviceName: context.serviceName,
        platform: context.platform,
        correlationId: context.correlationId,
        requestId: context.requestId,
        enableRetry: config.enableRetry,
        enableCircuitBreaker: config.enableCircuitBreaker,
      },
    });
  }

  /**
   * Log operation success
   */
  private async logOperationSuccess(
    context: ErrorHandlingContext,
    duration: number,
    retryAttempts: number,
  ): Promise<void> {
    await this.logService.log({
      tenantId: context.tenantId,
      channelId: context.channelId,
      type: IntegrationLogType.SYSTEM,
      level: IntegrationLogLevel.INFO,
      message: `Operation completed successfully: ${context.operationName}`,
      metadata: {
        operationType: context.operationType,
        serviceName: context.serviceName,
        platform: context.platform,
        duration,
        retryAttempts,
        correlationId: context.correlationId,
        requestId: context.requestId,
      },
    });
  }

  /**
   * Log operation error
   */
  private async logOperationError(
    context: ErrorHandlingContext,
    error: any,
    duration: number,
    recoveryStrategies: ErrorRecoveryStrategy[],
  ): Promise<void> {
    await this.logService.log({
      tenantId: context.tenantId,
      channelId: context.channelId,
      type: IntegrationLogType.ERROR,
      level: IntegrationLogLevel.ERROR,
      message: `Operation failed: ${context.operationName}`,
      metadata: {
        operationType: context.operationType,
        serviceName: context.serviceName,
        platform: context.platform,
        error: error.message,
        errorType: error.type,
        duration,
        recoveryStrategies: recoveryStrategies.map(s => s.description),
        correlationId: context.correlationId,
        requestId: context.requestId,
      },
    });
  }

  /**
   * Get comprehensive error handling metrics
   */
  async getMetrics(): Promise<{
    retry: Record<string, any>;
    circuitBreaker: Record<string, any>;
    combined: {
      totalOperations: number;
      successRate: number;
      averageRetryAttempts: number;
      circuitBreakerOpenServices: string[];
    };
  }> {
    const retryMetrics = this.retryService.getAllMetrics();
    const circuitBreakerMetrics = this.circuitBreakerService.getAllCircuitBreakers();
    
    // Calculate combined metrics
    const totalOperations = Object.values(retryMetrics)
      .reduce((sum, metric) => sum + metric.totalAttempts, 0);
    
    const successfulOperations = Object.values(retryMetrics)
      .reduce((sum, metric) => sum + metric.successCount, 0);
    
    const successRate = totalOperations > 0 ? 
      (successfulOperations / totalOperations) * 100 : 0;
    
    const averageRetryAttempts = Object.values(retryMetrics)
      .reduce((sum, metric) => sum + metric.averageAttempts, 0) / 
      Object.keys(retryMetrics).length || 0;
    
    const circuitBreakerOpenServices = Object.entries(circuitBreakerMetrics)
      .filter(([_, cb]) => cb.state === CircuitBreakerState.OPEN)
      .map(([serviceName]) => serviceName);

    return {
      retry: retryMetrics,
      circuitBreaker: circuitBreakerMetrics,
      combined: {
        totalOperations,
        successRate,
        averageRetryAttempts,
        circuitBreakerOpenServices,
      },
    };
  }

  /**
   * Health check for error handling service
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    issues: string[];
  }> {
    const circuitBreakerHealth = this.circuitBreakerService.getHealthStatus();
    const services: Record<string, boolean> = {};
    const issues: string[] = [];

    Object.entries(circuitBreakerHealth).forEach(([serviceName, health]) => {
      services[serviceName] = health.healthy;
      
      if (!health.healthy) {
        issues.push(
          `Service ${serviceName} is unhealthy: ${health.state} state with ${health.errorPercentage}% error rate`
        );
      }
    });

    const healthy = Object.values(services).every(s => s);

    return {
      healthy,
      services,
      issues,
    };
  }
}