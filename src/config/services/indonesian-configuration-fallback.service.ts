/**
 * Indonesian Configuration Fallback Service
 * Provides sophisticated multi-layer fallback strategies for Indonesian business configurations
 * Implements resilient configuration resolution with context awareness
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ConfigurationType,
  ConfigurationScope,
  ConfigurationMapping,
} from '../entities/configuration-mapping.entity';

// Import static configurations for fallback
import { INDONESIAN_BUSINESS_RULES_CONFIG } from '../indonesian-business-rules.config';
import { INDONESIAN_PAYMENT_CONFIG } from '../indonesian-payments.config';
import { INDONESIAN_GEOGRAPHY_CONFIG } from '../indonesian-geography.config';
import { INDONESIAN_TELECOM_CONFIG } from '../indonesian-telecom.config';
import { INDONESIAN_BUSINESS_CALENDAR_CONFIG } from '../indonesian-business-calendar.config';

export interface FallbackContext {
  tenantId?: string;
  regionCode?: string;
  businessType?: string;
  culturalContext?: {
    language?: string;
    religiousContext?: string;
    socialContext?: string;
  };
  emergencyMode?: boolean;
  failureReason?: string;
}

export interface FallbackResult {
  value: any;
  source: FallbackSource;
  confidence: 'low' | 'medium' | 'high';
  metadata: {
    strategy: FallbackStrategy;
    fallbackChain: string[];
    lastResort: boolean;
    warnings: string[];
    culturalAdjustments: string[];
  };
}

export enum FallbackStrategy {
  DATABASE_TENANT = 'database_tenant',
  DATABASE_REGIONAL = 'database_regional',
  DATABASE_GLOBAL = 'database_global',
  STATIC_REGIONAL = 'static_regional',
  STATIC_NATIONAL = 'static_national',
  COMPUTED_DEFAULT = 'computed_default',
  EMERGENCY_SAFE = 'emergency_safe',
}

export enum FallbackSource {
  DATABASE = 'database',
  STATIC_CONFIG = 'static_config',
  COMPUTED = 'computed',
  EMERGENCY = 'emergency',
  CACHE = 'cache',
}

export interface RegionalOverride {
  regionCode: string;
  overrides: Record<string, any>;
  culturalAdjustments: Record<string, any>;
  businessAdjustments: Record<string, any>;
}

@Injectable()
export class IndonesianConfigurationFallbackService {
  private readonly logger = new Logger(
    IndonesianConfigurationFallbackService.name,
  );

  // Static configuration registry
  private readonly staticConfigurations = {
    [ConfigurationType.BUSINESS_RULES]: INDONESIAN_BUSINESS_RULES_CONFIG,
    [ConfigurationType.PAYMENT_METHODS]: INDONESIAN_PAYMENT_CONFIG,
    [ConfigurationType.GEOGRAPHY]: INDONESIAN_GEOGRAPHY_CONFIG,
    [ConfigurationType.TELECOM_PROVIDERS]: INDONESIAN_TELECOM_CONFIG,
    [ConfigurationType.BUSINESS_CALENDAR]: INDONESIAN_BUSINESS_CALENDAR_CONFIG,
  };

  // Regional overrides for different Indonesian regions
  private readonly regionalOverrides: RegionalOverride[] = [
    {
      regionCode: 'DKI',
      overrides: {
        'laborCompliance.minimumWage.local': 4901798, // Jakarta 2024
        'businessHours.standard': '08:00-17:00',
        'businessHours.ramadan': '08:00-15:00',
        'shipping.zones.local.rate': 15000,
      },
      culturalAdjustments: {
        'language.preference': ['id', 'en'],
        'business.formality': 'high',
        'communication.style': 'direct',
      },
      businessAdjustments: {
        'payment.preferredMethods': ['qris', 'bank_transfer', 'e_wallet'],
        'delivery.expectations': 'same_day',
      },
    },
    {
      regionCode: 'JABAR',
      overrides: {
        'laborCompliance.minimumWage.local': 1986670, // West Java 2024
        'businessHours.standard': '07:30-16:30',
        'businessHours.ramadan': '07:30-14:30',
        'shipping.zones.local.rate': 12000,
      },
      culturalAdjustments: {
        'language.preference': ['su', 'id', 'en'], // Sundanese first
        'business.formality': 'medium',
        'communication.style': 'polite',
      },
      businessAdjustments: {
        'payment.preferredMethods': ['cash', 'qris', 'bank_transfer'],
        'delivery.expectations': 'next_day',
      },
    },
    {
      regionCode: 'JATENG',
      overrides: {
        'laborCompliance.minimumWage.local': 1958169, // Central Java 2024
        'businessHours.standard': '07:00-16:00',
        'businessHours.ramadan': '07:00-14:00',
        'shipping.zones.local.rate': 10000,
      },
      culturalAdjustments: {
        'language.preference': ['jv', 'id', 'en'], // Javanese first
        'business.formality': 'high',
        'communication.style': 'indirect',
      },
      businessAdjustments: {
        'payment.preferredMethods': ['cash', 'bank_transfer', 'qris'],
        'delivery.expectations': 'next_day',
      },
    },
    {
      regionCode: 'JATIM',
      overrides: {
        'laborCompliance.minimumWage.local': 2040321, // East Java 2024
        'businessHours.standard': '07:00-16:00',
        'businessHours.ramadan': '07:00-14:00',
        'shipping.zones.local.rate': 11000,
      },
      culturalAdjustments: {
        'language.preference': ['jv', 'id', 'en'],
        'business.formality': 'medium',
        'communication.style': 'direct',
      },
      businessAdjustments: {
        'payment.preferredMethods': ['cash', 'qris', 'bank_transfer'],
        'delivery.expectations': 'next_day',
      },
    },
    {
      regionCode: 'SUMUT',
      overrides: {
        'laborCompliance.minimumWage.local': 2710493, // North Sumatra 2024
        'businessHours.standard': '08:00-17:00',
        'businessHours.ramadan': '08:00-15:00',
        'shipping.zones.local.rate': 13000,
      },
      culturalAdjustments: {
        'language.preference': ['btk', 'id', 'en'], // Batak languages
        'business.formality': 'medium',
        'communication.style': 'direct',
      },
      businessAdjustments: {
        'payment.preferredMethods': ['bank_transfer', 'cash', 'qris'],
        'delivery.expectations': '2_day',
      },
    },
  ];

  // Emergency safe defaults for critical systems
  private readonly emergencyDefaults = {
    currency: 'IDR',
    language: 'id',
    timezone: 'Asia/Jakarta',
    businessHours: '09:00-17:00',
    paymentMethods: ['cash'],
    shippingRate: 20000,
    taxRate: 11, // PPN 11%
    minimumWage: 2500000, // Safe national average
  };

  constructor(
    @InjectRepository(ConfigurationMapping)
    private readonly configurationRepository: Repository<ConfigurationMapping>,
    private readonly configService: ConfigService,
  ) {
    this.initializeFallbackService();
  }

  private initializeFallbackService(): void {
    this.logger.log(
      'Initializing Indonesian Configuration Fallback Service...',
    );
    this.logger.log('Indonesian Configuration Fallback Service initialized');
  }

  /**
   * Resolve configuration value with multi-layer fallback strategy
   */
  async resolveConfiguration(
    type: ConfigurationType,
    key: string,
    context: FallbackContext,
  ): Promise<FallbackResult> {
    const fallbackChain: string[] = [];
    let value: any = null;
    let source: FallbackSource;
    let strategy: FallbackStrategy;
    let confidence: 'low' | 'medium' | 'high' = 'low';
    const warnings: string[] = [];
    const culturalAdjustments: string[] = [];

    this.logger.debug(
      `Resolving configuration: ${type}.${key} with context: ${JSON.stringify(
        context,
      )}`,
    );

    try {
      // Layer 1: Tenant-specific database configuration
      if (context.tenantId) {
        const tenantResult = await this.tryTenantDatabase(
          type,
          key,
          context.tenantId,
        );
        if (tenantResult) {
          value = tenantResult;
          source = FallbackSource.DATABASE;
          strategy = FallbackStrategy.DATABASE_TENANT;
          confidence = 'high';
          fallbackChain.push('tenant_database');
          this.logger.debug(
            `Found tenant-specific configuration for ${type}.${key}`,
          );
        }
      }

      // Layer 2: Regional database configuration
      if (!value && context.regionCode) {
        const regionalResult = await this.tryRegionalDatabase(
          type,
          key,
          context.regionCode,
        );
        if (regionalResult) {
          value = regionalResult;
          source = FallbackSource.DATABASE;
          strategy = FallbackStrategy.DATABASE_REGIONAL;
          confidence = 'high';
          fallbackChain.push('regional_database');
          this.logger.debug(`Found regional configuration for ${type}.${key}`);
        }
      }

      // Layer 3: Global database configuration
      if (!value) {
        const globalResult = await this.tryGlobalDatabase(type, key);
        if (globalResult) {
          value = globalResult;
          source = FallbackSource.DATABASE;
          strategy = FallbackStrategy.DATABASE_GLOBAL;
          confidence = 'high';
          fallbackChain.push('global_database');
          this.logger.debug(`Found global configuration for ${type}.${key}`);
        }
      }

      // Layer 4: Regional static configuration with overrides
      if (!value && context.regionCode) {
        const regionalStaticResult = await this.tryRegionalStatic(
          type,
          key,
          context,
        );
        if (regionalStaticResult) {
          value = regionalStaticResult.value;
          source = FallbackSource.STATIC_CONFIG;
          strategy = FallbackStrategy.STATIC_REGIONAL;
          confidence = 'medium';
          fallbackChain.push('regional_static');
          culturalAdjustments.push(...regionalStaticResult.culturalAdjustments);
          this.logger.debug(
            `Found regional static configuration for ${type}.${key}`,
          );
        }
      }

      // Layer 5: National static configuration
      if (!value) {
        const nationalStaticResult = await this.tryNationalStatic(type, key);
        if (nationalStaticResult) {
          value = nationalStaticResult;
          source = FallbackSource.STATIC_CONFIG;
          strategy = FallbackStrategy.STATIC_NATIONAL;
          confidence = 'medium';
          fallbackChain.push('national_static');
          this.logger.debug(
            `Found national static configuration for ${type}.${key}`,
          );
        }
      }

      // Layer 6: Computed defaults based on context
      if (!value) {
        const computedResult = await this.tryComputedDefault(
          type,
          key,
          context,
        );
        if (computedResult) {
          value = computedResult.value;
          source = FallbackSource.COMPUTED;
          strategy = FallbackStrategy.COMPUTED_DEFAULT;
          confidence = 'low';
          fallbackChain.push('computed_default');
          warnings.push(...computedResult.warnings);
          this.logger.debug(`Generated computed default for ${type}.${key}`);
        }
      }

      // Layer 7: Emergency safe defaults (last resort)
      if (!value || context.emergencyMode) {
        const emergencyResult = this.getEmergencyDefault(type, key);
        if (emergencyResult) {
          value = emergencyResult;
          source = FallbackSource.EMERGENCY;
          strategy = FallbackStrategy.EMERGENCY_SAFE;
          confidence = 'low';
          fallbackChain.push('emergency_safe');
          warnings.push(
            'Using emergency safe default - configuration may not be optimal',
          );
          this.logger.warn(`Using emergency default for ${type}.${key}`);
        }
      }

      // Apply cultural adjustments if available
      if (value && context.culturalContext) {
        value = await this.applyCulturalAdjustments(
          value,
          type,
          key,
          context.culturalContext,
        );
        culturalAdjustments.push('Applied cultural context adjustments');
      }
    } catch (error) {
      this.logger.error(
        `Error in fallback resolution for ${type}.${key}: ${error.message}`,
        error.stack,
      );

      // Force emergency mode
      const emergencyResult = this.getEmergencyDefault(type, key);
      if (emergencyResult) {
        value = emergencyResult;
        source = FallbackSource.EMERGENCY;
        strategy = FallbackStrategy.EMERGENCY_SAFE;
        confidence = 'low';
        fallbackChain.push('error_emergency');
        warnings.push(`Fallback error occurred: ${error.message}`);
      }
    }

    const result: FallbackResult = {
      value,
      source,
      confidence,
      metadata: {
        strategy,
        fallbackChain,
        lastResort: strategy === FallbackStrategy.EMERGENCY_SAFE,
        warnings,
        culturalAdjustments,
      },
    };

    this.logger.debug(
      `Configuration resolved: ${type}.${key} -> ${JSON.stringify(
        result.metadata,
      )}`,
    );
    return result;
  }

  // ============= LAYER IMPLEMENTATIONS =============

  private async tryTenantDatabase(
    type: ConfigurationType,
    key: string,
    tenantId: string,
  ): Promise<any> {
    try {
      const config = await this.configurationRepository.findOne({
        where: {
          type,
          key,
          tenantId,
          isActive: true,
        },
        order: { version: 'DESC' },
      });

      return config?.value || null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch tenant configuration: ${error.message}`,
      );
      return null;
    }
  }

  private async tryRegionalDatabase(
    type: ConfigurationType,
    key: string,
    regionCode: string,
  ): Promise<any> {
    try {
      const config = await this.configurationRepository.findOne({
        where: {
          type,
          key,
          regionCode,
          tenantId: null, // Global but region-specific
          isActive: true,
        },
        order: { version: 'DESC' },
      });

      return config?.value || null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch regional configuration: ${error.message}`,
      );
      return null;
    }
  }

  private async tryGlobalDatabase(
    type: ConfigurationType,
    key: string,
  ): Promise<any> {
    try {
      const config = await this.configurationRepository.findOne({
        where: {
          type,
          key,
          tenantId: null,
          regionCode: null,
          isActive: true,
        },
        order: { version: 'DESC' },
      });

      return config?.value || null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch global configuration: ${error.message}`,
      );
      return null;
    }
  }

  private async tryRegionalStatic(
    type: ConfigurationType,
    key: string,
    context: FallbackContext,
  ): Promise<{ value: any; culturalAdjustments: string[] } | null> {
    const staticConfig = this.staticConfigurations[type];
    if (!staticConfig) return null;

    let value = this.getNestedValue(staticConfig, key);
    const culturalAdjustments: string[] = [];

    // Apply regional overrides
    if (context.regionCode) {
      const regionalOverride = this.regionalOverrides.find(
        override => override.regionCode === context.regionCode,
      );

      if (regionalOverride) {
        // Check for direct overrides
        const overrideValue = regionalOverride.overrides[key];
        if (overrideValue !== undefined) {
          value = overrideValue;
          culturalAdjustments.push(
            `Applied ${context.regionCode} regional override`,
          );
        }

        // Apply cultural adjustments
        if (context.culturalContext) {
          const culturalValue = this.applyCulturalOverrides(
            value,
            regionalOverride.culturalAdjustments,
            context.culturalContext,
          );
          if (culturalValue !== value) {
            value = culturalValue;
            culturalAdjustments.push(
              `Applied ${context.regionCode} cultural adjustments`,
            );
          }
        }

        // Apply business adjustments
        if (context.businessType) {
          const businessValue = this.applyBusinessOverrides(
            value,
            regionalOverride.businessAdjustments,
            context.businessType,
          );
          if (businessValue !== value) {
            value = businessValue;
            culturalAdjustments.push(
              `Applied ${context.regionCode} business adjustments`,
            );
          }
        }
      }
    }

    return value !== null ? { value, culturalAdjustments } : null;
  }

  private async tryNationalStatic(
    type: ConfigurationType,
    key: string,
  ): Promise<any> {
    const staticConfig = this.staticConfigurations[type];
    if (!staticConfig) return null;

    return this.getNestedValue(staticConfig, key);
  }

  private async tryComputedDefault(
    type: ConfigurationType,
    key: string,
    context: FallbackContext,
  ): Promise<{ value: any; warnings: string[] } | null> {
    const warnings: string[] = [];
    let value: any = null;

    // Compute defaults based on configuration type and context
    switch (type) {
      case ConfigurationType.BUSINESS_RULES:
        value = this.computeBusinessRuleDefault(key, context);
        warnings.push('Using computed business rule - verify compliance');
        break;

      case ConfigurationType.PAYMENT_METHODS:
        value = this.computePaymentMethodDefault(key, context);
        warnings.push(
          'Using computed payment method - verify with payment providers',
        );
        break;

      case ConfigurationType.GEOGRAPHY:
        value = this.computeGeographyDefault(key, context);
        warnings.push('Using computed geographic data - verify accuracy');
        break;

      case ConfigurationType.TELECOM_PROVIDERS:
        value = this.computeTelecomDefault(key, context);
        warnings.push('Using computed telecom data - verify provider status');
        break;

      case ConfigurationType.BUSINESS_CALENDAR:
        value = this.computeCalendarDefault(key, context);
        warnings.push('Using computed calendar data - verify holiday accuracy');
        break;

      default:
        return null;
    }

    return value !== null ? { value, warnings } : null;
  }

  private getEmergencyDefault(type: ConfigurationType, key: string): any {
    // Emergency defaults for critical operations
    const emergencyMap = {
      currency: this.emergencyDefaults.currency,
      language: this.emergencyDefaults.language,
      timezone: this.emergencyDefaults.timezone,
      businessHours: this.emergencyDefaults.businessHours,
      paymentMethods: this.emergencyDefaults.paymentMethods,
      shippingRate: this.emergencyDefaults.shippingRate,
      taxRate: this.emergencyDefaults.taxRate,
      minimumWage: this.emergencyDefaults.minimumWage,
    };

    // Try to match the key with emergency defaults
    for (const [pattern, value] of Object.entries(emergencyMap)) {
      if (key.includes(pattern) || key === pattern) {
        return value;
      }
    }

    // Last resort: return null and let caller handle
    return null;
  }

  // ============= HELPER METHODS =============

  private getNestedValue(obj: any, key: string): any {
    const keys = key.split('.');
    let current = obj;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }

    return current;
  }

  private async applyCulturalAdjustments(
    value: any,
    type: ConfigurationType,
    key: string,
    culturalContext: any,
  ): Promise<any> {
    // Apply cultural context adjustments
    if (culturalContext.language && typeof value === 'string') {
      // Localize string values if needed
      return value; // Placeholder - implement localization
    }

    if (
      culturalContext.religiousContext === 'islamic' &&
      key.includes('businessHours')
    ) {
      // Adjust for Islamic practices (e.g., Friday prayers)
      return this.adjustForIslamicPractices(value);
    }

    return value;
  }

  private applyCulturalOverrides(
    value: any,
    culturalAdjustments: Record<string, any>,
    culturalContext: any,
  ): any {
    // Apply cultural overrides based on context
    return value; // Placeholder implementation
  }

  private applyBusinessOverrides(
    value: any,
    businessAdjustments: Record<string, any>,
    businessType: string,
  ): any {
    // Apply business type specific overrides
    return value; // Placeholder implementation
  }

  private adjustForIslamicPractices(businessHours: any): any {
    // Adjust business hours for Friday prayers, etc.
    if (typeof businessHours === 'string' && businessHours.includes('-')) {
      const [start, end] = businessHours.split('-');
      // Add Friday prayer break or adjust hours
      return `${start}-12:00,13:30-${end}`; // Example: lunch + prayer break
    }
    return businessHours;
  }

  // ============= COMPUTED DEFAULTS =============

  private computeBusinessRuleDefault(
    key: string,
    context: FallbackContext,
  ): any {
    if (key.includes('minimumWage')) {
      // Use regional minimum wage if available
      const regional = this.regionalOverrides.find(
        r => r.regionCode === context.regionCode,
      );
      return (
        regional?.overrides['laborCompliance.minimumWage.local'] ||
        this.emergencyDefaults.minimumWage
      );
    }

    if (key.includes('taxRate')) {
      return this.emergencyDefaults.taxRate;
    }

    return null;
  }

  private computePaymentMethodDefault(
    key: string,
    context: FallbackContext,
  ): any {
    if (key.includes('preferredMethods')) {
      const regional = this.regionalOverrides.find(
        r => r.regionCode === context.regionCode,
      );
      return (
        regional?.businessAdjustments['payment.preferredMethods'] ||
        this.emergencyDefaults.paymentMethods
      );
    }

    return null;
  }

  private computeGeographyDefault(key: string, context: FallbackContext): any {
    if (key.includes('timezone')) {
      // Indonesia has 3 time zones, default to WIB
      return this.emergencyDefaults.timezone;
    }

    return null;
  }

  private computeTelecomDefault(key: string, context: FallbackContext): any {
    // Compute telecom defaults based on region
    return null;
  }

  private computeCalendarDefault(key: string, context: FallbackContext): any {
    if (key.includes('businessHours')) {
      const regional = this.regionalOverrides.find(
        r => r.regionCode === context.regionCode,
      );
      return (
        regional?.overrides['businessHours.standard'] ||
        this.emergencyDefaults.businessHours
      );
    }

    return null;
  }
}
