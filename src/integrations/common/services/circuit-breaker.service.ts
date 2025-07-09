import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close in half-open
  timeout: number; // Time in ms before attempting to close
  volumeThreshold: number; // Minimum number of requests to evaluate
  errorThresholdPercentage: number; // Percentage of errors to open
  monitoringPeriod: number; // Time window for monitoring in ms
  resetTimeout: number; // Time to wait before resetting metrics
}

export interface CircuitBreakerMetrics {
  requestCount: number;
  successCount: number;
  failureCount: number;
  errorPercentage: number;
  averageResponseTime: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  stateChanges: Array<{
    from: CircuitBreakerState;
    to: CircuitBreakerState;
    timestamp: Date;
    reason: string;
  }>;
}

export interface CircuitBreakerResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  state: CircuitBreakerState;
  executionTime: number;
  circuitBreakerOpen?: boolean;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  
  // Circuit breaker states for each service
  private readonly circuitBreakers = new Map<string, {
    state: CircuitBreakerState;
    config: CircuitBreakerConfig;
    metrics: CircuitBreakerMetrics;
    lastFailureTime: number | null;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    nextAttempt: number;
  }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceName: string,
    config?: Partial<CircuitBreakerConfig>,
    operationName?: string,
  ): Promise<CircuitBreakerResult<T>> {
    const startTime = Date.now();
    const circuitBreaker = this.getOrCreateCircuitBreaker(serviceName, config);
    const currentState = circuitBreaker.state;

    // Check if circuit breaker is open
    if (currentState === CircuitBreakerState.OPEN) {
      if (Date.now() < circuitBreaker.nextAttempt) {
        // Circuit is still open, reject immediately
        const error = new Error(
          `Circuit breaker is OPEN for service: ${serviceName}. ` +
          `Next attempt in ${circuitBreaker.nextAttempt - Date.now()}ms`
        );

        this.logger.warn(
          `Circuit breaker OPEN - rejecting request for ${serviceName}`,
          {
            serviceName,
            operationName,
            nextAttempt: new Date(circuitBreaker.nextAttempt),
            failureCount: circuitBreaker.metrics.failureCount,
          }
        );

        return {
          success: false,
          error,
          state: CircuitBreakerState.OPEN,
          executionTime: Date.now() - startTime,
          circuitBreakerOpen: true,
        };
      } else {
        // Time to try half-open
        this.transitionToHalfOpen(serviceName, circuitBreaker);
      }
    }

    try {
      this.logger.debug(
        `Executing operation through circuit breaker for ${serviceName}`,
        {
          serviceName,
          operationName,
          state: circuitBreaker.state,
          consecutiveFailures: circuitBreaker.consecutiveFailures,
        }
      );

      const result = await operation();
      const executionTime = Date.now() - startTime;

      // Record success
      this.recordSuccess(serviceName, circuitBreaker, executionTime);

      return {
        success: true,
        result,
        state: circuitBreaker.state,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failure
      this.recordFailure(serviceName, circuitBreaker, error, executionTime);

      return {
        success: false,
        error,
        state: circuitBreaker.state,
        executionTime,
      };
    }
  }

  /**
   * Get or create circuit breaker for a service
   */
  private getOrCreateCircuitBreaker(
    serviceName: string,
    configOverride?: Partial<CircuitBreakerConfig>,
  ) {
    if (!this.circuitBreakers.has(serviceName)) {
      const config = {
        ...this.getDefaultConfig(serviceName),
        ...configOverride,
      };

      this.circuitBreakers.set(serviceName, {
        state: CircuitBreakerState.CLOSED,
        config,
        metrics: {
          requestCount: 0,
          successCount: 0,
          failureCount: 0,
          errorPercentage: 0,
          averageResponseTime: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          stateChanges: [],
        },
        lastFailureTime: null,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        nextAttempt: 0,
      });

      this.logger.debug(`Created circuit breaker for service: ${serviceName}`, {
        serviceName,
        config,
      });
    }

    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(
    serviceName: string,
    circuitBreaker: any,
    executionTime: number,
  ): void {
    const metrics = circuitBreaker.metrics;
    
    // Update metrics
    metrics.requestCount++;
    metrics.successCount++;
    metrics.lastSuccessTime = new Date();
    
    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.requestCount - 1) + executionTime) / 
      metrics.requestCount;

    // Update error percentage
    metrics.errorPercentage = 
      (metrics.failureCount / metrics.requestCount) * 100;

    // Reset consecutive failures
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.consecutiveSuccesses++;

    // Handle state transitions
    if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      if (circuitBreaker.consecutiveSuccesses >= circuitBreaker.config.successThreshold) {
        this.transitionToClosed(serviceName, circuitBreaker);
      }
    }

    this.logger.debug(
      `Recorded success for circuit breaker: ${serviceName}`,
      {
        serviceName,
        state: circuitBreaker.state,
        successCount: metrics.successCount,
        errorPercentage: metrics.errorPercentage,
        consecutiveSuccesses: circuitBreaker.consecutiveSuccesses,
      }
    );

    // Emit success event
    this.eventEmitter.emit('circuit-breaker.success', {
      serviceName,
      state: circuitBreaker.state,
      metrics: metrics,
      executionTime,
    });
  }

  /**
   * Record failed operation
   */
  private recordFailure(
    serviceName: string,
    circuitBreaker: any,
    error: Error,
    executionTime: number,
  ): void {
    const metrics = circuitBreaker.metrics;
    
    // Update metrics
    metrics.requestCount++;
    metrics.failureCount++;
    metrics.lastFailureTime = new Date();
    
    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.requestCount - 1) + executionTime) / 
      metrics.requestCount;

    // Update error percentage
    metrics.errorPercentage = 
      (metrics.failureCount / metrics.requestCount) * 100;

    // Reset consecutive successes
    circuitBreaker.consecutiveSuccesses = 0;
    circuitBreaker.consecutiveFailures++;
    circuitBreaker.lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (circuitBreaker.state === CircuitBreakerState.CLOSED) {
      if (this.shouldOpenCircuit(circuitBreaker)) {
        this.transitionToOpen(serviceName, circuitBreaker);
      }
    } else if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state should open the circuit
      this.transitionToOpen(serviceName, circuitBreaker);
    }

    this.logger.warn(
      `Recorded failure for circuit breaker: ${serviceName}`,
      {
        serviceName,
        state: circuitBreaker.state,
        failureCount: metrics.failureCount,
        errorPercentage: metrics.errorPercentage,
        consecutiveFailures: circuitBreaker.consecutiveFailures,
        error: error.message,
      }
    );

    // Emit failure event
    this.eventEmitter.emit('circuit-breaker.failure', {
      serviceName,
      state: circuitBreaker.state,
      metrics: metrics,
      error: error.message,
      executionTime,
    });
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(circuitBreaker: any): boolean {
    const config = circuitBreaker.config;
    const metrics = circuitBreaker.metrics;

    // Check if we have enough volume to make a decision
    if (metrics.requestCount < config.volumeThreshold) {
      return false;
    }

    // Check consecutive failures threshold
    if (circuitBreaker.consecutiveFailures >= config.failureThreshold) {
      return true;
    }

    // Check error percentage threshold
    if (metrics.errorPercentage >= config.errorThresholdPercentage) {
      return true;
    }

    return false;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(serviceName: string, circuitBreaker: any): void {
    const previousState = circuitBreaker.state;
    circuitBreaker.state = CircuitBreakerState.OPEN;
    circuitBreaker.nextAttempt = Date.now() + circuitBreaker.config.timeout;

    // Record state change
    circuitBreaker.metrics.stateChanges.push({
      from: previousState,
      to: CircuitBreakerState.OPEN,
      timestamp: new Date(),
      reason: `Failure threshold reached: ${circuitBreaker.consecutiveFailures} consecutive failures, ${circuitBreaker.metrics.errorPercentage}% error rate`,
    });

    this.logger.error(
      `Circuit breaker OPENED for service: ${serviceName}`,
      {
        serviceName,
        previousState,
        consecutiveFailures: circuitBreaker.consecutiveFailures,
        errorPercentage: circuitBreaker.metrics.errorPercentage,
        nextAttempt: new Date(circuitBreaker.nextAttempt),
      }
    );

    // Emit state change event
    this.eventEmitter.emit('circuit-breaker.opened', {
      serviceName,
      previousState,
      metrics: circuitBreaker.metrics,
      nextAttempt: new Date(circuitBreaker.nextAttempt),
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(serviceName: string, circuitBreaker: any): void {
    const previousState = circuitBreaker.state;
    circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
    circuitBreaker.consecutiveSuccesses = 0;

    // Record state change
    circuitBreaker.metrics.stateChanges.push({
      from: previousState,
      to: CircuitBreakerState.HALF_OPEN,
      timestamp: new Date(),
      reason: 'Timeout period elapsed, attempting to recover',
    });

    this.logger.log(
      `Circuit breaker transitioning to HALF_OPEN for service: ${serviceName}`,
      {
        serviceName,
        previousState,
        timeout: circuitBreaker.config.timeout,
      }
    );

    // Emit state change event
    this.eventEmitter.emit('circuit-breaker.half-open', {
      serviceName,
      previousState,
      metrics: circuitBreaker.metrics,
    });
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(serviceName: string, circuitBreaker: any): void {
    const previousState = circuitBreaker.state;
    circuitBreaker.state = CircuitBreakerState.CLOSED;
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.consecutiveSuccesses = 0;

    // Record state change
    circuitBreaker.metrics.stateChanges.push({
      from: previousState,
      to: CircuitBreakerState.CLOSED,
      timestamp: new Date(),
      reason: `Recovery successful: ${circuitBreaker.consecutiveSuccesses} consecutive successes`,
    });

    this.logger.log(
      `Circuit breaker CLOSED for service: ${serviceName}`,
      {
        serviceName,
        previousState,
        consecutiveSuccesses: circuitBreaker.consecutiveSuccesses,
      }
    );

    // Emit state change event
    this.eventEmitter.emit('circuit-breaker.closed', {
      serviceName,
      previousState,
      metrics: circuitBreaker.metrics,
    });
  }

  /**
   * Get current state of circuit breaker
   */
  getState(serviceName: string): CircuitBreakerState {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    return circuitBreaker ? circuitBreaker.state : CircuitBreakerState.CLOSED;
  }

  /**
   * Get metrics for a circuit breaker
   */
  getMetrics(serviceName: string): CircuitBreakerMetrics | null {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    return circuitBreaker ? circuitBreaker.metrics : null;
  }

  /**
   * Get all circuit breaker states and metrics
   */
  getAllCircuitBreakers(): Record<string, {
    state: CircuitBreakerState;
    config: CircuitBreakerConfig;
    metrics: CircuitBreakerMetrics;
  }> {
    const result: Record<string, any> = {};
    
    this.circuitBreakers.forEach((circuitBreaker, serviceName) => {
      result[serviceName] = {
        state: circuitBreaker.state,
        config: circuitBreaker.config,
        metrics: circuitBreaker.metrics,
      };
    });

    return result;
  }

  /**
   * Manually open circuit breaker
   */
  openCircuitBreaker(serviceName: string, reason: string): void {
    const circuitBreaker = this.getOrCreateCircuitBreaker(serviceName);
    
    if (circuitBreaker.state !== CircuitBreakerState.OPEN) {
      const previousState = circuitBreaker.state;
      circuitBreaker.state = CircuitBreakerState.OPEN;
      circuitBreaker.nextAttempt = Date.now() + circuitBreaker.config.timeout;

      // Record state change
      circuitBreaker.metrics.stateChanges.push({
        from: previousState,
        to: CircuitBreakerState.OPEN,
        timestamp: new Date(),
        reason: `Manually opened: ${reason}`,
      });

      this.logger.warn(
        `Circuit breaker manually OPENED for service: ${serviceName}`,
        { serviceName, reason }
      );

      // Emit state change event
      this.eventEmitter.emit('circuit-breaker.manually-opened', {
        serviceName,
        previousState,
        reason,
        metrics: circuitBreaker.metrics,
      });
    }
  }

  /**
   * Manually close circuit breaker
   */
  closeCircuitBreaker(serviceName: string, reason: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (circuitBreaker && circuitBreaker.state !== CircuitBreakerState.CLOSED) {
      const previousState = circuitBreaker.state;
      circuitBreaker.state = CircuitBreakerState.CLOSED;
      circuitBreaker.consecutiveFailures = 0;
      circuitBreaker.consecutiveSuccesses = 0;

      // Record state change
      circuitBreaker.metrics.stateChanges.push({
        from: previousState,
        to: CircuitBreakerState.CLOSED,
        timestamp: new Date(),
        reason: `Manually closed: ${reason}`,
      });

      this.logger.log(
        `Circuit breaker manually CLOSED for service: ${serviceName}`,
        { serviceName, reason }
      );

      // Emit state change event
      this.eventEmitter.emit('circuit-breaker.manually-closed', {
        serviceName,
        previousState,
        reason,
        metrics: circuitBreaker.metrics,
      });
    }
  }

  /**
   * Reset circuit breaker metrics
   */
  resetMetrics(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (circuitBreaker) {
      circuitBreaker.metrics = {
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        errorPercentage: 0,
        averageResponseTime: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        stateChanges: [],
      };
      
      circuitBreaker.consecutiveFailures = 0;
      circuitBreaker.consecutiveSuccesses = 0;

      this.logger.log(
        `Circuit breaker metrics reset for service: ${serviceName}`,
        { serviceName }
      );
    }
  }

  /**
   * Get default configuration for different services
   */
  private getDefaultConfig(serviceName: string): CircuitBreakerConfig {
    const configs: Record<string, CircuitBreakerConfig> = {
      // Shopee API - strict settings due to rate limits
      shopee: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000, // 1 minute
        volumeThreshold: 10,
        errorThresholdPercentage: 50,
        monitoringPeriod: 60000,
        resetTimeout: 300000, // 5 minutes
      },
      
      // Lazada API - moderate settings
      lazada: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 30000, // 30 seconds
        volumeThreshold: 10,
        errorThresholdPercentage: 50,
        monitoringPeriod: 60000,
        resetTimeout: 180000, // 3 minutes
      },
      
      // Tokopedia API - very strict settings
      tokopedia: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 120000, // 2 minutes
        volumeThreshold: 5,
        errorThresholdPercentage: 40,
        monitoringPeriod: 60000,
        resetTimeout: 300000, // 5 minutes
      },
      
      // Database operations - quick recovery
      database: {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 10000, // 10 seconds
        volumeThreshold: 5,
        errorThresholdPercentage: 30,
        monitoringPeriod: 30000,
        resetTimeout: 60000, // 1 minute
      },
      
      // Default configuration
      default: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 30000,
        volumeThreshold: 10,
        errorThresholdPercentage: 50,
        monitoringPeriod: 60000,
        resetTimeout: 180000,
      },
    };

    return configs[serviceName] || configs.default;
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!circuitBreaker) {
      return true; // No circuit breaker means healthy
    }

    return circuitBreaker.state === CircuitBreakerState.CLOSED ||
           circuitBreaker.state === CircuitBreakerState.HALF_OPEN;
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): Record<string, {
    healthy: boolean;
    state: CircuitBreakerState;
    errorPercentage: number;
    lastFailureTime: Date | null;
  }> {
    const result: Record<string, any> = {};
    
    this.circuitBreakers.forEach((circuitBreaker, serviceName) => {
      result[serviceName] = {
        healthy: this.isHealthy(serviceName),
        state: circuitBreaker.state,
        errorPercentage: circuitBreaker.metrics.errorPercentage,
        lastFailureTime: circuitBreaker.metrics.lastFailureTime,
      };
    });

    return result;
  }
}