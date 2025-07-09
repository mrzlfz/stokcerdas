import { OrderStatus } from '../../../orders/entities/order.entity';

/**
 * Standardized interface for order synchronization across all platforms
 * This interface ensures consistency in method signatures and return types
 */
export interface OrderSyncService {
  /**
   * Synchronize order status bidirectionally between platform and local system
   */
  syncOrderStatus(
    tenantId: string,
    channelId: string,
    orderIds?: string[],
    options?: OrderSyncOptions
  ): Promise<StandardSyncResult>;

  /**
   * Get order details from external platform
   */
  getOrderDetails(
    tenantId: string,
    channelId: string,
    externalOrderId: string
  ): Promise<StandardOrderResult>;

  /**
   * Update order status on external platform
   */
  updateOrderStatus(
    tenantId: string,
    channelId: string,
    externalOrderId: string,
    action: StandardOrderAction
  ): Promise<StandardResult>;

  /**
   * Bulk update order statuses
   */
  bulkUpdateOrderStatus(
    tenantId: string,
    channelId: string,
    updates: Array<{
      externalOrderId: string;
      action: StandardOrderAction;
    }>
  ): Promise<StandardBulkResult>;
}

/**
 * Standardized sync options for all platforms
 */
export interface OrderSyncOptions {
  batchSize?: number;
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
  includeOrderDetails?: boolean;
  timeWindow?: {
    start: Date;
    end: Date;
  };
  businessContext?: {
    respectBusinessHours?: boolean;
    isRamadanSensitive?: boolean;
    isHolidaySensitive?: boolean;
    timezone?: string;
  };
  retryPolicy?: {
    maxAttempts?: number;
    exponentialBackoff?: boolean;
    respectRateLimits?: boolean;
  };
}

/**
 * Standardized sync result structure
 */
export interface StandardSyncResult {
  success: boolean;
  summary: {
    totalOrders: number;
    syncedOrders: number;
    failedOrders: number;
    skippedOrders: number;
    conflictedOrders: number;
  };
  orders: {
    synced: Array<{
      orderId: string;
      externalOrderId: string;
      externalOrderNumber?: string;
      localStatus: OrderStatus;
      externalStatus: string;
      platformId: string;
      syncDirection: 'inbound' | 'outbound';
      syncedAt: Date;
    }>;
    failed: Array<{
      orderId: string;
      externalOrderId: string;
      error: string;
      errorCode?: string;
      retryable: boolean;
      platformId: string;
    }>;
    skipped: Array<{
      orderId: string;
      externalOrderId: string;
      reason: string;
      platformId: string;
    }>;
  };
  conflicts: StandardConflictObject[];
  performance: {
    totalDuration: number;
    averageOrderProcessingTime: number;
    apiCallCount: number;
    rateLimitHits: number;
    retryCount: number;
    circuitBreakerTriggered: boolean;
  };
  businessContext: {
    isBusinessHours: boolean;
    ramadanPeriod: boolean;
    holidayPeriod: boolean;
    timezone: string;
    syncOptimized: boolean;
  };
  error?: string;
  correlationId: string;
  timestamp: Date;
}

/**
 * Standardized conflict object structure
 */
export interface StandardConflictObject {
  orderId: string;
  externalOrderId: string;
  externalOrderNumber?: string;
  localStatus: OrderStatus;
  externalStatus: string;
  platformId: string;
  conflictType: ConflictType;
  resolution: ConflictResolution;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionStrategy: string;
  businessImpact: {
    critical: boolean;
    customerFacing: boolean;
    affectsShipping: boolean;
    affectsPayment: boolean;
  };
  indonesianContext: {
    isDuringBusinessHours: boolean;
    requiresImmediateAttention: boolean;
    culturalConsiderations: string[];
  };
}

/**
 * Conflict types for better categorization
 */
export enum ConflictType {
  STATUS_MISMATCH = 'status_mismatch',
  PAYMENT_INCONSISTENCY = 'payment_inconsistency',
  SHIPPING_DISCREPANCY = 'shipping_discrepancy',
  INVENTORY_CONFLICT = 'inventory_conflict',
  CUSTOMER_DATA_MISMATCH = 'customer_data_mismatch',
  PRICING_DISCREPANCY = 'pricing_discrepancy',
  TIMING_CONFLICT = 'timing_conflict',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolution {
  PLATFORM_WINS = 'platform_wins',
  LOCAL_WINS = 'local_wins',
  MANUAL_REVIEW = 'manual_review',
  AUTOMATIC_MERGE = 'automatic_merge',
  CUSTOMER_PRIORITY = 'customer_priority',
  BUSINESS_RULE_BASED = 'business_rule_based',
  ESCALATE = 'escalate',
  DEFER = 'defer',
}

/**
 * Standardized order result structure
 */
export interface StandardOrderResult {
  success: boolean;
  order?: {
    orderId: string;
    externalOrderId: string;
    externalOrderNumber?: string;
    status: OrderStatus;
    externalStatus: string;
    platformId: string;
    customerInfo: {
      name: string;
      email?: string;
      phone?: string;
      address?: any;
    };
    orderItems: Array<{
      productId: string;
      externalProductId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      sku: string;
      externalSku?: string;
    }>;
    payment: {
      method: string;
      status: string;
      amount: number;
      currency: string;
      paidAt?: Date;
      isDuringBusinessHours?: boolean;
    };
    shipping: {
      method: string;
      status: string;
      trackingNumber?: string;
      carrier?: string;
      estimatedDelivery?: Date;
      actualDelivery?: Date;
      codAmount?: number;
      indonesianLogistics?: {
        isJNE: boolean;
        isJNT: boolean;
        isSiCepat: boolean;
        isAnterAja: boolean;
        supportsCOD: boolean;
        deliveryZone: string;
      };
    };
    timestamps: {
      orderCreated: Date;
      orderUpdated: Date;
      lastSyncAt: Date;
      platformTimezone: string;
    };
    businessContext: {
      isBusinessHours: boolean;
      ramadanPeriod: boolean;
      holidayPeriod: boolean;
      isWeekend: boolean;
      peakSeason: boolean;
    };
    metadata: {
      platform: string;
      channel: string;
      source: string;
      tags: string[];
      notes?: string;
    };
  };
  error?: string;
  correlationId: string;
  timestamp: Date;
}

/**
 * Standardized order action types
 */
export interface StandardOrderAction {
  type: OrderActionType;
  data: any;
  reason?: string;
  metadata?: {
    triggeredBy: string;
    businessJustification?: string;
    customerNotification?: boolean;
    indonesianCompliance?: {
      requiresCustomerConsent: boolean;
      affectsDeliverySchedule: boolean;
      culturalConsiderations: string[];
    };
  };
}

/**
 * Order action types
 */
export enum OrderActionType {
  CANCEL = 'cancel',
  CONFIRM = 'confirm',
  SHIP = 'ship',
  DELIVER = 'deliver',
  RETURN = 'return',
  REFUND = 'refund',
  UPDATE_SHIPPING = 'update_shipping',
  UPDATE_PAYMENT = 'update_payment',
  UPDATE_CUSTOMER_INFO = 'update_customer_info',
  ADD_NOTES = 'add_notes',
  ESCALATE = 'escalate',
}

/**
 * Standardized result structure
 */
export interface StandardResult {
  success: boolean;
  data?: any;
  error?: string;
  correlationId: string;
  timestamp: Date;
  performance?: {
    duration: number;
    apiCalls: number;
    retryCount: number;
  };
}

/**
 * Standardized bulk result structure
 */
export interface StandardBulkResult {
  success: boolean;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    partialFailures: number;
  };
  results: StandardResult[];
  failedItems: Array<{
    itemId: string;
    error: string;
    retryable: boolean;
  }>;
  error?: string;
  correlationId: string;
  timestamp: Date;
}

/**
 * Indonesian business context helpers
 */
export interface IndonesianBusinessContext {
  timezone: 'WIB' | 'WITA' | 'WIT';
  isBusinessHours: boolean;
  isRamadanPeriod: boolean;
  isHolidayPeriod: boolean;
  isWeekend: boolean;
  isPeakSeason: boolean;
  deliveryZone: string;
  supportedPaymentMethods: string[];
  supportedShippingMethods: string[];
  culturalConsiderations: string[];
  complianceRequirements: string[];
}

/**
 * Platform-specific configuration
 */
export interface PlatformSyncConfig {
  platformId: string;
  displayName: string;
  batchSize: number;
  requestDelay: number;
  batchDelay: number;
  maxRetries: number;
  timeout: number;
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
  };
  businessRules: {
    respectBusinessHours: boolean;
    optimizeForIndonesianMarket: boolean;
    supportsCOD: boolean;
    requiresManualReview: string[];
  };
  errorHandling: {
    retryableErrors: string[];
    nonRetryableErrors: string[];
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
  };
}

/**
 * Sync monitoring integration
 */
export interface SyncMonitoringIntegration {
  startMonitoring(
    tenantId: string,
    platformId: string,
    channelId: string,
    operationId: string,
    metadata?: any
  ): Promise<void>;
  
  updateMetrics(
    operationId: string,
    metrics: {
      recordsProcessed?: number;
      recordsSuccessful?: number;
      recordsFailed?: number;
      responseTime?: number;
      error?: any;
    }
  ): Promise<void>;
  
  completeMonitoring(
    operationId: string,
    status: 'completed' | 'failed' | 'timeout',
    finalMetrics?: any
  ): Promise<void>;
}

/**
 * Dead letter queue integration
 */
export interface DeadLetterQueueIntegration {
  sendToDeadLetter(
    tenantId: string,
    failedJob: any,
    error: any,
    options?: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      requiresManualReview?: boolean;
      isBusinessHoursOnly?: boolean;
      maxRetries?: number;
    }
  ): Promise<void>;
}

/**
 * Complete platform service interface
 */
export interface CompletePlatformOrderService extends OrderSyncService {
  // Base service methods
  syncOrderStatus(tenantId: string, channelId: string, orderIds?: string[], options?: OrderSyncOptions): Promise<StandardSyncResult>;
  getOrderDetails(tenantId: string, channelId: string, externalOrderId: string): Promise<StandardOrderResult>;
  updateOrderStatus(tenantId: string, channelId: string, externalOrderId: string, action: StandardOrderAction): Promise<StandardResult>;
  bulkUpdateOrderStatus(tenantId: string, channelId: string, updates: Array<{ externalOrderId: string; action: StandardOrderAction; }>): Promise<StandardBulkResult>;
  
  // Monitoring integration
  monitoring: SyncMonitoringIntegration;
  
  // Dead letter queue integration
  deadLetterQueue: DeadLetterQueueIntegration;
  
  // Platform configuration
  config: PlatformSyncConfig;
  
  // Indonesian business context
  businessContext: IndonesianBusinessContext;
}