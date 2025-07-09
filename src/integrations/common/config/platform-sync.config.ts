import { PlatformSyncConfig } from '../interfaces/order-sync.interface';

/**
 * Standardized platform synchronization configurations
 * This configuration addresses hardcoded values and ensures consistent behavior
 */
export const PLATFORM_SYNC_CONFIGS: Record<string, PlatformSyncConfig> = {
  shopee: {
    platformId: 'shopee',
    displayName: 'Shopee Indonesia',
    batchSize: 20,
    requestDelay: 100, // 100ms between requests
    batchDelay: 1000, // 1s between batches
    maxRetries: 3,
    timeout: 30000, // 30 seconds
    rateLimits: {
      requestsPerSecond: 10,
      requestsPerMinute: 600,
      requestsPerHour: 36000,
      burstLimit: 50,
    },
    businessRules: {
      respectBusinessHours: true,
      optimizeForIndonesianMarket: true,
      supportsCOD: true,
      requiresManualReview: ['cancelled_by_customer', 'payment_failed', 'delivery_failed'],
    },
    errorHandling: {
      retryableErrors: [
        'rate_limit_exceeded',
        'network_timeout',
        'server_error',
        'temporary_unavailable',
        'connection_reset',
        'read_timeout',
      ],
      nonRetryableErrors: [
        'invalid_credentials',
        'permission_denied',
        'invalid_request',
        'not_found',
        'bad_request',
        'account_suspended',
      ],
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1 minute
    },
  },
  
  lazada: {
    platformId: 'lazada',
    displayName: 'Lazada Indonesia',
    batchSize: 10,
    requestDelay: 200, // 200ms between requests (stricter)
    batchDelay: 1500, // 1.5s between batches
    maxRetries: 3,
    timeout: 45000, // 45 seconds (longer timeout)
    rateLimits: {
      requestsPerSecond: 5,
      requestsPerMinute: 300,
      requestsPerHour: 18000,
      burstLimit: 20,
    },
    businessRules: {
      respectBusinessHours: true,
      optimizeForIndonesianMarket: true,
      supportsCOD: true,
      requiresManualReview: ['cancelled_by_customer', 'payment_failed', 'delivery_failed', 'return_requested'],
    },
    errorHandling: {
      retryableErrors: [
        'rate_limit_exceeded',
        'network_timeout',
        'server_error',
        'temporary_unavailable',
        'connection_reset',
        'read_timeout',
        'service_unavailable',
      ],
      nonRetryableErrors: [
        'invalid_credentials',
        'permission_denied',
        'invalid_request',
        'not_found',
        'bad_request',
        'account_suspended',
        'invalid_signature',
      ],
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 90000, // 1.5 minutes
    },
  },
  
  tokopedia: {
    platformId: 'tokopedia',
    displayName: 'Tokopedia Indonesia',
    batchSize: 5,
    requestDelay: 500, // 500ms between requests (very strict)
    batchDelay: 2000, // 2s between batches
    maxRetries: 2,
    timeout: 60000, // 60 seconds (longest timeout)
    rateLimits: {
      requestsPerSecond: 2,
      requestsPerMinute: 120,
      requestsPerHour: 7200,
      burstLimit: 10,
    },
    businessRules: {
      respectBusinessHours: true,
      optimizeForIndonesianMarket: true,
      supportsCOD: true,
      requiresManualReview: [
        'cancelled_by_customer',
        'payment_failed',
        'delivery_failed',
        'return_requested',
        'dispute_raised',
        'refund_requested',
      ],
    },
    errorHandling: {
      retryableErrors: [
        'rate_limit_exceeded',
        'network_timeout',
        'server_error',
        'temporary_unavailable',
        'connection_reset',
        'read_timeout',
        'service_unavailable',
        'quota_exceeded',
      ],
      nonRetryableErrors: [
        'invalid_credentials',
        'permission_denied',
        'invalid_request',
        'not_found',
        'bad_request',
        'account_suspended',
        'invalid_signature',
        'malformed_request',
      ],
      circuitBreakerThreshold: 2,
      circuitBreakerTimeout: 120000, // 2 minutes
    },
  },
  
  whatsapp: {
    platformId: 'whatsapp',
    displayName: 'WhatsApp Business',
    batchSize: 30,
    requestDelay: 50, // 50ms between requests
    batchDelay: 1000, // 1s between batches
    maxRetries: 3,
    timeout: 20000, // 20 seconds
    rateLimits: {
      requestsPerSecond: 20,
      requestsPerMinute: 1200,
      requestsPerHour: 72000,
      burstLimit: 80,
    },
    businessRules: {
      respectBusinessHours: true,
      optimizeForIndonesianMarket: true,
      supportsCOD: false,
      requiresManualReview: ['customer_complaint', 'delivery_issue'],
    },
    errorHandling: {
      retryableErrors: [
        'rate_limit_exceeded',
        'network_timeout',
        'server_error',
        'temporary_unavailable',
        'connection_reset',
        'read_timeout',
      ],
      nonRetryableErrors: [
        'invalid_credentials',
        'permission_denied',
        'invalid_request',
        'not_found',
        'bad_request',
        'account_suspended',
        'invalid_phone_number',
      ],
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 30000, // 30 seconds
    },
  },
};

/**
 * Indonesian business context configuration
 */
export const INDONESIAN_BUSINESS_CONFIG = {
  timezones: ['WIB', 'WITA', 'WIT'],
  businessHours: {
    start: 9, // 9 AM
    end: 17, // 5 PM
    workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  },
  peakSeasons: [
    { name: 'Ramadan', months: [3, 4] }, // March-April (approximate)
    { name: 'Lebaran', months: [4, 5] }, // April-May
    { name: 'End of Year', months: [11, 12] }, // November-December
    { name: 'Back to School', months: [6, 7] }, // June-July
  ],
  majorHolidays: [
    { name: 'New Year', date: '01-01' },
    { name: 'Independence Day', date: '08-17' },
    { name: 'Christmas', date: '12-25' },
    // Dynamic holidays (Ramadan, Lebaran, etc.) would be calculated
  ],
  paymentMethods: [
    'bank_transfer',
    'credit_card',
    'debit_card',
    'cod',
    'gopay',
    'ovo',
    'dana',
    'shopeepay',
    'linkaja',
    'qris',
  ],
  shippingMethods: [
    'jne',
    'jnt',
    'sicepat',
    'anteraja',
    'gojek',
    'grab',
    'ninja_xpress',
    'pos_indonesia',
    'tiki',
    'wahana',
  ],
  deliveryZones: [
    'jakarta',
    'bandung',
    'surabaya',
    'medan',
    'semarang',
    'palembang',
    'makassar',
    'yogyakarta',
    'denpasar',
    'manado',
    'banjarmasin',
    'pekanbaru',
    'padang',
    'balikpapan',
    'samarinda',
    'pontianak',
    'lampung',
    'jambi',
    'bengkulu',
    'other',
  ],
  culturalConsiderations: [
    'respect_ramadan_fasting_hours',
    'avoid_friday_prayer_time',
    'consider_local_customs',
    'use_indonesian_language',
    'respect_religious_holidays',
    'consider_regional_differences',
  ],
  complianceRequirements: [
    'gdpr_compliance',
    'pdp_law_compliance',
    'consumer_protection',
    'halal_certification',
    'tax_compliance',
    'data_localization',
  ],
};

/**
 * Rate limiting configuration helpers
 */
export class RateLimitingHelper {
  /**
   * Calculate optimal delay based on platform configuration
   */
  static calculateDelay(platformId: string, requestCount: number): number {
    const config = PLATFORM_SYNC_CONFIGS[platformId];
    if (!config) return 1000; // Default 1 second
    
    const baseDelay = config.requestDelay;
    const batchDelay = config.batchDelay;
    
    // Add exponential backoff if approaching rate limits
    const rateLimitFactor = Math.min(requestCount / config.rateLimits.requestsPerMinute, 1);
    const exponentialFactor = Math.pow(2, Math.floor(rateLimitFactor * 3));
    
    return baseDelay * exponentialFactor;
  }
  
  /**
   * Check if request should be delayed for business hours
   */
  static shouldDelayForBusinessHours(platformId: string): boolean {
    const config = PLATFORM_SYNC_CONFIGS[platformId];
    if (!config?.businessRules.respectBusinessHours) return false;
    
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    const day = jakartaTime.getDay();
    
    return !(INDONESIAN_BUSINESS_CONFIG.businessHours.workingDays.includes(day) &&
             hour >= INDONESIAN_BUSINESS_CONFIG.businessHours.start &&
             hour <= INDONESIAN_BUSINESS_CONFIG.businessHours.end);
  }
  
  /**
   * Get next business hour for delayed processing
   */
  static getNextBusinessHour(): Date {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    
    // Set to next business day 9 AM
    const nextBusinessDay = new Date(jakartaTime);
    nextBusinessDay.setHours(INDONESIAN_BUSINESS_CONFIG.businessHours.start, 0, 0, 0);
    
    const currentDay = nextBusinessDay.getDay();
    
    // If weekend, move to Monday
    if (currentDay === 0) { // Sunday
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
    } else if (currentDay === 6) { // Saturday
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 2);
    } else if (jakartaTime.getHours() >= INDONESIAN_BUSINESS_CONFIG.businessHours.end) {
      // After business hours, move to next business day
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
    }
    
    return nextBusinessDay;
  }
}

/**
 * Indonesian business context helper
 */
export class IndonesianBusinessHelper {
  /**
   * Check if current time is during Ramadan period
   */
  static isRamadanPeriod(): boolean {
    // Simplified check - in production, use proper Islamic calendar
    const now = new Date();
    const month = now.getMonth();
    return month >= 2 && month <= 4; // March to May (approximate)
  }
  
  /**
   * Check if current date is Indonesian holiday
   */
  static isIndonesianHoliday(date: Date = new Date()): boolean {
    const monthDay = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    return INDONESIAN_BUSINESS_CONFIG.majorHolidays.some(holiday => holiday.date === monthDay);
  }
  
  /**
   * Get seasonal factor for business optimization
   */
  static getSeasonalFactor(date: Date = new Date()): number {
    const month = date.getMonth();
    
    // Higher demand during peak seasons
    const peakSeason = INDONESIAN_BUSINESS_CONFIG.peakSeasons.find(season => 
      season.months.includes(month)
    );
    
    return peakSeason ? 1.5 : 1.0;
  }
  
  /**
   * Get appropriate delivery zone based on address
   */
  static getDeliveryZone(address: string): string {
    const addressLower = address.toLowerCase();
    
    for (const zone of INDONESIAN_BUSINESS_CONFIG.deliveryZones) {
      if (addressLower.includes(zone)) {
        return zone;
      }
    }
    
    return 'other';
  }
  
  /**
   * Validate payment method for Indonesian market
   */
  static isValidPaymentMethod(paymentMethod: string): boolean {
    return INDONESIAN_BUSINESS_CONFIG.paymentMethods.includes(paymentMethod.toLowerCase());
  }
  
  /**
   * Validate shipping method for Indonesian market
   */
  static isValidShippingMethod(shippingMethod: string): boolean {
    return INDONESIAN_BUSINESS_CONFIG.shippingMethods.includes(shippingMethod.toLowerCase());
  }
}

/**
 * Platform-specific error classification
 */
export class PlatformErrorClassifier {
  /**
   * Check if error is retryable based on platform configuration
   */
  static isRetryableError(platformId: string, error: string): boolean {
    const config = PLATFORM_SYNC_CONFIGS[platformId];
    if (!config) return false;
    
    const errorCode = error.toLowerCase();
    return config.errorHandling.retryableErrors.some(retryableError => 
      errorCode.includes(retryableError)
    );
  }
  
  /**
   * Check if error requires manual review
   */
  static requiresManualReview(platformId: string, errorContext: any): boolean {
    const config = PLATFORM_SYNC_CONFIGS[platformId];
    if (!config) return true;
    
    return config.businessRules.requiresManualReview.some(reviewCondition => 
      errorContext.status === reviewCondition ||
      errorContext.reason === reviewCondition
    );
  }
  
  /**
   * Get suggested retry delay based on error type
   */
  static getSuggestedRetryDelay(platformId: string, error: string, retryCount: number): number {
    const config = PLATFORM_SYNC_CONFIGS[platformId];
    if (!config) return 5000; // Default 5 seconds
    
    let baseDelay = config.requestDelay;
    
    // Rate limit errors need longer delays
    if (error.toLowerCase().includes('rate_limit')) {
      baseDelay = Math.max(baseDelay, 10000); // At least 10 seconds
    }
    
    // Exponential backoff
    return baseDelay * Math.pow(2, retryCount);
  }
}

/**
 * Export configuration getter
 */
export function getPlatformConfig(platformId: string): PlatformSyncConfig | undefined {
  return PLATFORM_SYNC_CONFIGS[platformId];
}

/**
 * Export all configurations
 */
export const PlatformSyncConfiguration = {
  configs: PLATFORM_SYNC_CONFIGS,
  indonesianBusiness: INDONESIAN_BUSINESS_CONFIG,
  rateLimitingHelper: RateLimitingHelper,
  businessHelper: IndonesianBusinessHelper,
  errorClassifier: PlatformErrorClassifier,
  getPlatformConfig,
};