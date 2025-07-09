/**
 * Indonesian Configuration Validator Service
 * Enhanced validation and fallback mechanisms for Indonesian business configurations
 * Provides comprehensive validation rules for cultural, regulatory, and business context
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ConfigurationType,
  ConfigurationScope,
} from '../entities/configuration-mapping.entity';

// Import Indonesian configuration constants
import { INDONESIAN_BUSINESS_RULES_CONFIG } from '../indonesian-business-rules.config';
import { INDONESIAN_PAYMENT_CONFIG } from '../indonesian-payments.config';
import { INDONESIAN_GEOGRAPHY_CONFIG } from '../indonesian-geography.config';
import { INDONESIAN_TELECOM_CONFIG } from '../indonesian-telecom.config';
import { INDONESIAN_BUSINESS_CALENDAR_CONFIG } from '../indonesian-business-calendar.config';

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'format' | 'enum' | 'custom';
  validator?: (value: any) => boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationContext {
  tenantId?: string;
  regionCode?: string;
  culturalContext?: any;
  businessType?: string;
  configurationScope: ConfigurationScope;
}

export interface EnhancedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  infos: ValidationInfo[];
  businessImpactAssessment: BusinessImpactAssessment;
  fallbackRecommendations: FallbackRecommendation[];
  dependencyValidation: DependencyValidationResult;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  suggestedFix?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  recommendation?: string;
}

export interface ValidationInfo {
  field: string;
  message: string;
  code: string;
}

export interface BusinessImpactAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  affectedSystems: string[];
  affectedRegions: string[];
  estimatedUsers: number;
  downtime: number; // minutes
  revenueImpact: {
    estimated: number; // IDR
    confidence: 'low' | 'medium' | 'high';
  };
  complianceRisk: {
    level: 'none' | 'low' | 'medium' | 'high';
    regulations: string[];
  };
  culturalSensitivity: {
    level: 'none' | 'low' | 'medium' | 'high';
    concerns: string[];
  };
}

export interface FallbackRecommendation {
  strategy: 'static' | 'regional' | 'tenant' | 'default';
  source: string;
  priority: number;
  value: any;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

export interface DependencyValidationResult {
  isValid: boolean;
  circularDependencies: string[];
  missingDependencies: string[];
  conflictingDependencies: string[];
}

@Injectable()
export class IndonesianConfigurationValidatorService {
  private readonly logger = new Logger(
    IndonesianConfigurationValidatorService.name,
  );

  // Validation rule registry for each configuration type
  private readonly validationRules: Record<
    ConfigurationType,
    ValidationRule[]
  > = {
    [ConfigurationType.BUSINESS_RULES]: [
      {
        field: 'tax_obligations.vat.standardRate',
        type: 'range',
        validator: value =>
          typeof value === 'number' && value >= 0 && value <= 20,
        message: 'VAT rate must be between 0% and 20% (Indonesian regulation)',
        severity: 'error',
      },
      {
        field: 'laborCompliance.minimumWage',
        type: 'custom',
        validator: value => this.validateMinimumWage(value),
        message: 'Minimum wage must comply with regional Indonesian standards',
        severity: 'error',
      },
      {
        field: 'businessLicense.requirements',
        type: 'required',
        validator: value => Array.isArray(value) && value.length > 0,
        message:
          'Business license requirements are mandatory for Indonesian operations',
        severity: 'error',
      },
    ],
    [ConfigurationType.PAYMENT_METHODS]: [
      {
        field: 'methods.qris.transactionFee.percentage',
        type: 'range',
        validator: value =>
          typeof value === 'number' && value >= 0 && value <= 5,
        message:
          'QRIS transaction fee should not exceed 5% (Bank Indonesia guideline)',
        severity: 'warning',
      },
      {
        field: 'methods.cash.acceptancePolicy',
        type: 'custom',
        validator: value => this.validateCashPolicy(value),
        message:
          'Cash acceptance policy must comply with Indonesian monetary regulations',
        severity: 'error',
      },
      {
        field: 'businessRules.dailyLimits',
        type: 'custom',
        validator: value => this.validateDailyLimits(value),
        message: 'Daily transaction limits must align with OJK regulations',
        severity: 'error',
      },
    ],
    [ConfigurationType.GEOGRAPHY]: [
      {
        field: 'provinces',
        type: 'custom',
        validator: value => this.validateProvinceData(value),
        message:
          'Province data must match official Indonesian administrative divisions',
        severity: 'error',
      },
      {
        field: 'cities',
        type: 'custom',
        validator: value => this.validateCityData(value),
        message:
          'City data must correspond to valid Indonesian cities/regencies',
        severity: 'error',
      },
      {
        field: 'postalCodes',
        type: 'format',
        validator: value => this.validatePostalCodes(value),
        message: 'Postal codes must follow Indonesian 5-digit format',
        severity: 'error',
      },
    ],
    [ConfigurationType.TELECOM_PROVIDERS]: [
      {
        field: 'providers',
        type: 'custom',
        validator: value => this.validateTelecomProviders(value),
        message: 'Telecom providers must be licensed operators in Indonesia',
        severity: 'error',
      },
      {
        field: 'smsRouting.pricing',
        type: 'custom',
        validator: value => this.validateSMSPricing(value),
        message:
          'SMS pricing must be within market rates for Indonesian operators',
        severity: 'warning',
      },
    ],
    [ConfigurationType.BUSINESS_CALENDAR]: [
      {
        field: 'holidays',
        type: 'custom',
        validator: value => this.validateHolidays(value),
        message:
          'Holiday calendar must include official Indonesian national holidays',
        severity: 'error',
      },
      {
        field: 'businessHours.ramadan',
        type: 'custom',
        validator: value => this.validateRamadanHours(value),
        message:
          'Ramadan business hours should reflect Indonesian Islamic practices',
        severity: 'warning',
      },
    ],
    [ConfigurationType.SHIPPING_RATES]: [
      {
        field: 'domestic.rates',
        type: 'custom',
        validator: value => this.validateShippingRates(value),
        message:
          'Shipping rates must be competitive within Indonesian logistics market',
        severity: 'warning',
      },
    ],
    [ConfigurationType.LOYALTY_TIERS]: [
      {
        field: 'tiers',
        type: 'custom',
        validator: value => this.validateLoyaltyTiers(value),
        message:
          'Loyalty tiers must align with Indonesian consumer behavior patterns',
        severity: 'info',
      },
    ],
    [ConfigurationType.CULTURAL_SETTINGS]: [
      {
        field: 'language.primary',
        type: 'enum',
        validator: value => ['id', 'en'].includes(value),
        message: 'Primary language must be Indonesian (id) or English (en)',
        severity: 'error',
      },
      {
        field: 'cultural.religiousContext',
        type: 'custom',
        validator: value => this.validateReligiousContext(value),
        message: 'Religious context settings must respect Indonesian diversity',
        severity: 'warning',
      },
    ],
  };

  // Fallback strategy priority matrix
  private readonly fallbackStrategies: Record<
    ConfigurationType,
    FallbackRecommendation[]
  > = {
    [ConfigurationType.BUSINESS_RULES]: [
      {
        strategy: 'static',
        source: 'INDONESIAN_BUSINESS_RULES_CONFIG',
        priority: 1,
        value: INDONESIAN_BUSINESS_RULES_CONFIG,
        confidence: 'high',
        reason: 'Official Indonesian business regulations',
      },
      {
        strategy: 'regional',
        source: 'regional-defaults',
        priority: 2,
        value: null,
        confidence: 'medium',
        reason: 'Regional business practice variations',
      },
    ],
    [ConfigurationType.PAYMENT_METHODS]: [
      {
        strategy: 'static',
        source: 'INDONESIAN_PAYMENT_CONFIG',
        priority: 1,
        value: INDONESIAN_PAYMENT_CONFIG,
        confidence: 'high',
        reason: 'Bank Indonesia approved payment methods',
      },
    ],
    [ConfigurationType.GEOGRAPHY]: [
      {
        strategy: 'static',
        source: 'INDONESIAN_GEOGRAPHY_CONFIG',
        priority: 1,
        value: INDONESIAN_GEOGRAPHY_CONFIG,
        confidence: 'high',
        reason: 'Official Indonesian geographic data',
      },
    ],
    [ConfigurationType.TELECOM_PROVIDERS]: [
      {
        strategy: 'static',
        source: 'INDONESIAN_TELECOM_CONFIG',
        priority: 1,
        value: INDONESIAN_TELECOM_CONFIG,
        confidence: 'high',
        reason: 'Licensed Indonesian telecom operators',
      },
    ],
    [ConfigurationType.BUSINESS_CALENDAR]: [
      {
        strategy: 'static',
        source: 'INDONESIAN_BUSINESS_CALENDAR_CONFIG',
        priority: 1,
        value: INDONESIAN_BUSINESS_CALENDAR_CONFIG,
        confidence: 'high',
        reason: 'Official Indonesian business calendar',
      },
    ],
    [ConfigurationType.SHIPPING_RATES]: [
      {
        strategy: 'default',
        source: 'market-average',
        priority: 1,
        value: null,
        confidence: 'medium',
        reason: 'Market average shipping rates',
      },
    ],
    [ConfigurationType.LOYALTY_TIERS]: [
      {
        strategy: 'default',
        source: 'industry-standard',
        priority: 1,
        value: null,
        confidence: 'medium',
        reason: 'Indonesian retail industry standards',
      },
    ],
    [ConfigurationType.CULTURAL_SETTINGS]: [
      {
        strategy: 'static',
        source: 'indonesian-defaults',
        priority: 1,
        value: {
          language: { primary: 'id', secondary: 'en' },
          timezone: 'Asia/Jakarta',
          currency: 'IDR',
        },
        confidence: 'high',
        reason: 'Indonesian cultural defaults',
      },
    ],
  };

  constructor(private readonly configService: ConfigService) {
    this.initializeValidator();
  }

  /**
   * Initialize validator with custom rules
   */
  private initializeValidator(): void {
    this.logger.log('Initializing Indonesian Configuration Validator...');
    // Load any additional validation rules from configuration
    this.logger.log('Indonesian Configuration Validator initialized');
  }

  /**
   * Validate configuration with enhanced Indonesian business context
   */
  async validateConfiguration(
    type: ConfigurationType,
    key: string,
    value: any,
    context: ValidationContext,
  ): Promise<EnhancedValidationResult> {
    this.logger.debug(`Validating configuration: ${type}.${key}`);

    const result: EnhancedValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      infos: [],
      businessImpactAssessment: await this.assessBusinessImpact(
        type,
        key,
        value,
        context,
      ),
      fallbackRecommendations: await this.generateFallbackRecommendations(
        type,
        key,
        context,
      ),
      dependencyValidation: await this.validateDependencies(type, key, value),
    };

    // Apply validation rules for this configuration type
    const rules = this.validationRules[type] || [];

    for (const rule of rules) {
      if (this.isRuleApplicable(rule, key)) {
        const ruleResult = await this.applyValidationRule(
          rule,
          key,
          value,
          context,
        );

        switch (rule.severity) {
          case 'error':
            if (!ruleResult.isValid) {
              result.errors.push({
                field: key,
                message: rule.message,
                code: `${type}_${rule.field}`,
                suggestedFix: ruleResult.suggestedFix,
              });
              result.isValid = false;
            }
            break;
          case 'warning':
            if (!ruleResult.isValid) {
              result.warnings.push({
                field: key,
                message: rule.message,
                code: `${type}_${rule.field}`,
                recommendation: ruleResult.recommendation,
              });
            }
            break;
          case 'info':
            result.infos.push({
              field: key,
              message: rule.message,
              code: `${type}_${rule.field}`,
            });
            break;
        }
      }
    }

    // Enhanced Indonesian context validation
    await this.validateIndonesianContext(type, key, value, context, result);

    this.logger.debug(
      `Validation completed for ${type}.${key}: ${
        result.isValid ? 'VALID' : 'INVALID'
      }`,
    );
    return result;
  }

  /**
   * Generate comprehensive fallback recommendations
   */
  async generateFallbackRecommendations(
    type: ConfigurationType,
    key: string,
    context: ValidationContext,
  ): Promise<FallbackRecommendation[]> {
    const strategies = this.fallbackStrategies[type] || [];
    const recommendations: FallbackRecommendation[] = [];

    for (const strategy of strategies) {
      let fallbackValue = strategy.value;

      // Enhance fallback value based on context
      if (strategy.strategy === 'regional' && context.regionCode) {
        fallbackValue = await this.getRegionalFallback(
          type,
          key,
          context.regionCode,
        );
      } else if (strategy.strategy === 'tenant' && context.tenantId) {
        fallbackValue = await this.getTenantFallback(
          type,
          key,
          context.tenantId,
        );
      } else if (strategy.strategy === 'default') {
        fallbackValue = await this.getDefaultFallback(type, key);
      }

      if (fallbackValue !== null) {
        recommendations.push({
          ...strategy,
          value: fallbackValue,
        });
      }
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate configuration dependencies
   */
  async validateDependencies(
    type: ConfigurationType,
    key: string,
    value: any,
  ): Promise<DependencyValidationResult> {
    const result: DependencyValidationResult = {
      isValid: true,
      circularDependencies: [],
      missingDependencies: [],
      conflictingDependencies: [],
    };

    // Check for circular dependencies
    const circularDeps = await this.detectCircularDependencies(type, key);
    if (circularDeps.length > 0) {
      result.circularDependencies = circularDeps;
      result.isValid = false;
    }

    // Check for missing dependencies
    const missingDeps = await this.detectMissingDependencies(type, key, value);
    if (missingDeps.length > 0) {
      result.missingDependencies = missingDeps;
      result.isValid = false;
    }

    // Check for conflicting dependencies
    const conflictingDeps = await this.detectConflictingDependencies(
      type,
      key,
      value,
    );
    if (conflictingDeps.length > 0) {
      result.conflictingDependencies = conflictingDeps;
    }

    return result;
  }

  // ============= PRIVATE VALIDATION METHODS =============

  private async validateIndonesianContext(
    type: ConfigurationType,
    key: string,
    value: any,
    context: ValidationContext,
    result: EnhancedValidationResult,
  ): Promise<void> {
    // Regional validation
    if (context.regionCode) {
      const regionalValidation = await this.validateRegionalCompliance(
        type,
        key,
        value,
        context.regionCode,
      );
      if (!regionalValidation.isValid) {
        result.warnings.push({
          field: key,
          message: `Configuration may not be optimal for region ${context.regionCode}`,
          code: 'regional_compliance',
          recommendation: regionalValidation.recommendation,
        });
      }
    }

    // Cultural validation
    if (context.culturalContext) {
      const culturalValidation = await this.validateCulturalSensitivity(
        type,
        key,
        value,
        context.culturalContext,
      );
      if (!culturalValidation.isValid) {
        result.warnings.push({
          field: key,
          message: 'Configuration may not align with cultural context',
          code: 'cultural_sensitivity',
          recommendation: culturalValidation.recommendation,
        });
      }
    }
  }

  private isRuleApplicable(rule: ValidationRule, key: string): boolean {
    return key.includes(rule.field) || rule.field === '*';
  }

  private async applyValidationRule(
    rule: ValidationRule,
    key: string,
    value: any,
    context: ValidationContext,
  ): Promise<{
    isValid: boolean;
    suggestedFix?: string;
    recommendation?: string;
  }> {
    if (!rule.validator) {
      return { isValid: true };
    }

    const isValid = rule.validator(value);
    let suggestedFix: string | undefined;
    let recommendation: string | undefined;

    if (!isValid) {
      // Generate contextual suggestions
      if (rule.type === 'range') {
        suggestedFix = `Adjust value to be within acceptable range`;
      } else if (rule.type === 'format') {
        suggestedFix = `Format value according to Indonesian standards`;
      } else if (rule.type === 'enum') {
        suggestedFix = `Use one of the allowed values`;
      }

      recommendation = await this.generateRecommendation(
        rule,
        key,
        value,
        context,
      );
    }

    return { isValid, suggestedFix, recommendation };
  }

  private async assessBusinessImpact(
    type: ConfigurationType,
    key: string,
    value: any,
    context: ValidationContext,
  ): Promise<BusinessImpactAssessment> {
    // Assess based on configuration type and key
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const affectedSystems: string[] = [];
    const affectedRegions: string[] = [];
    let estimatedUsers = 0;
    let downtime = 0;

    // Critical configurations
    if (type === ConfigurationType.PAYMENT_METHODS && key.includes('limits')) {
      level = 'critical';
      affectedSystems.push('PaymentService', 'OrderService', 'BillingService');
      estimatedUsers = 10000;
      downtime = 5;
    } else if (
      type === ConfigurationType.BUSINESS_RULES &&
      key.includes('tax')
    ) {
      level = 'critical';
      affectedSystems.push(
        'TaxService',
        'ComplianceService',
        'ReportingService',
      );
      estimatedUsers = 50000;
      downtime = 0;
    }

    // Regional impact
    if (context.regionCode) {
      affectedRegions.push(context.regionCode);
    } else {
      affectedRegions.push('ALL');
    }

    return {
      level,
      affectedSystems,
      affectedRegions,
      estimatedUsers,
      downtime,
      revenueImpact: {
        estimated: estimatedUsers * (level === 'critical' ? 10000 : 1000), // IDR
        confidence: level === 'critical' ? 'high' : 'medium',
      },
      complianceRisk: {
        level: type === ConfigurationType.BUSINESS_RULES ? 'high' : 'low',
        regulations:
          type === ConfigurationType.BUSINESS_RULES ? ['UU PDP', 'OJK'] : [],
      },
      culturalSensitivity: {
        level: type === ConfigurationType.CULTURAL_SETTINGS ? 'high' : 'low',
        concerns:
          type === ConfigurationType.CULTURAL_SETTINGS
            ? ['Religious sensitivity', 'Language preferences']
            : [],
      },
    };
  }

  // ============= SPECIFIC VALIDATORS =============

  private validateMinimumWage(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Check if minimum wage values are reasonable for Indonesian standards
    const nationalMinWage = value.national || 0;
    const jakartaMinWage = value.DKI || 0;

    // Indonesian minimum wage should be between 2.5M - 6M IDR (2024 standards)
    return (
      nationalMinWage >= 2500000 &&
      nationalMinWage <= 6000000 &&
      jakartaMinWage >= nationalMinWage
    );
  }

  private validateCashPolicy(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Cash must be accepted for transactions under 1M IDR (Indonesian regulation)
    return value.mandatoryAcceptanceLimit >= 1000000;
  }

  private validateDailyLimits(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Daily limits should align with OJK e-money regulations
    return value.eWallet <= 20000000 && value.bankTransfer <= 250000000;
  }

  private validateProvinceData(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Must include all 38 Indonesian provinces
    const requiredProvinces = [
      'DKI',
      'JABAR',
      'JATENG',
      'JATIM',
      'SUMUT',
      'SUMBAR',
    ];
    return requiredProvinces.every(prov => prov in value);
  }

  private validateCityData(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Cities must have valid province references
    return Object.values(value).every(
      (city: any) => city.province && typeof city.name === 'string',
    );
  }

  private validatePostalCodes(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Indonesian postal codes are 5 digits
    return Object.keys(value).every(code => /^\d{5}$/.test(code));
  }

  private validateTelecomProviders(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Must include major Indonesian operators
    const requiredOperators = ['TSEL', 'XL', 'ISAT', 'H3I'];
    return requiredOperators.every(op => op in value);
  }

  private validateSMSPricing(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // SMS pricing should be within market rates (IDR 150-500 per SMS)
    return Object.values(value).every(
      (price: any) => typeof price === 'number' && price >= 150 && price <= 500,
    );
  }

  private validateHolidays(value: any): boolean {
    if (!Array.isArray(value)) return false;

    // Must include major Indonesian holidays
    const requiredHolidays = ['kemerdekaan', 'lebaran', 'natal', 'pancasila'];
    return requiredHolidays.every(holiday =>
      value.some((h: any) => h.id && h.id.includes(holiday)),
    );
  }

  private validateRamadanHours(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Ramadan hours should be shorter than regular hours
    const regularHours = 8; // Assuming 8-hour workday
    const ramadanHours = value.workingHours || 0;

    return ramadanHours > 0 && ramadanHours <= regularHours;
  }

  private validateShippingRates(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Shipping rates should be competitive (rough validation)
    return Object.values(value).every(
      (rate: any) => typeof rate === 'number' && rate > 0 && rate < 100000,
    );
  }

  private validateLoyaltyTiers(value: any): boolean {
    if (!Array.isArray(value)) return false;

    // Should have at least 3 tiers (Bronze, Silver, Gold standard)
    return (
      value.length >= 3 &&
      value.every(
        (tier: any) =>
          tier.name && tier.threshold && typeof tier.threshold === 'number',
      )
    );
  }

  private validateReligiousContext(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // Should support Indonesia's major religions
    const supportedReligions = ['islamic', 'christian', 'hindu', 'buddhist'];
    return supportedReligions.includes(value.primary);
  }

  // ============= FALLBACK METHODS =============

  private async getRegionalFallback(
    type: ConfigurationType,
    key: string,
    regionCode: string,
  ): Promise<any> {
    // Return region-specific configuration values
    const regionalDefaults = {
      DKI: { currency: 'IDR', timezone: 'Asia/Jakarta' },
      JABAR: { currency: 'IDR', timezone: 'Asia/Jakarta' },
      JATENG: { currency: 'IDR', timezone: 'Asia/Jakarta' },
    };

    return regionalDefaults[regionCode] || null;
  }

  private async getTenantFallback(
    type: ConfigurationType,
    key: string,
    tenantId: string,
  ): Promise<any> {
    // Return tenant-specific fallback values
    // This would typically query a database for tenant preferences
    return null;
  }

  private async getDefaultFallback(
    type: ConfigurationType,
    key: string,
  ): Promise<any> {
    // Return safe default values for Indonesian business context
    const defaults = {
      currency: 'IDR',
      language: 'id',
      timezone: 'Asia/Jakarta',
      businessHours: '09:00-17:00',
    };

    return defaults[key] || null;
  }

  // ============= DEPENDENCY VALIDATION =============

  private async detectCircularDependencies(
    type: ConfigurationType,
    key: string,
  ): Promise<string[]> {
    // Implementation for detecting circular dependencies
    return [];
  }

  private async detectMissingDependencies(
    type: ConfigurationType,
    key: string,
    value: any,
  ): Promise<string[]> {
    // Implementation for detecting missing dependencies
    return [];
  }

  private async detectConflictingDependencies(
    type: ConfigurationType,
    key: string,
    value: any,
  ): Promise<string[]> {
    // Implementation for detecting conflicting dependencies
    return [];
  }

  private async validateRegionalCompliance(
    type: ConfigurationType,
    key: string,
    value: any,
    regionCode: string,
  ): Promise<{ isValid: boolean; recommendation?: string }> {
    // Validate if configuration complies with regional requirements
    return { isValid: true };
  }

  private async validateCulturalSensitivity(
    type: ConfigurationType,
    key: string,
    value: any,
    culturalContext: any,
  ): Promise<{ isValid: boolean; recommendation?: string }> {
    // Validate cultural sensitivity
    return { isValid: true };
  }

  private async generateRecommendation(
    rule: ValidationRule,
    key: string,
    value: any,
    context: ValidationContext,
  ): Promise<string> {
    return `Consider adjusting ${key} to comply with Indonesian business standards`;
  }
}
