/**
 * Indonesian Telecom Providers Configuration
 * Configuration file for Indonesian telecom providers, phone validation, and SMS routing
 * This replaces hardcoded values from SMS service and enables easy updates
 * Now integrated with NestJS ConfigService for environment variable support
 */

import { registerAs } from '@nestjs/config';

export interface IndonesianTelecomProvider {
  name: string;
  code: string;
  prefixes: string[];
  isActive: boolean;
  businessType: 'postpaid' | 'prepaid' | 'both';
  coverage: 'national' | 'regional';
  smsSupported: boolean;
  ussdSupported: boolean;
  apiEndpoint?: string;
  rateLimit?: number;
  priority: number; // 1-5, 1 being highest priority
  regionFocus?: string[];
  marketShare?: number; // percentage
  signalQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  lastUpdated: string;
}

export interface IndonesianTelecomConfig {
  providers: IndonesianTelecomProvider[];
  phoneValidation: {
    countryCode: string;
    minLength: number;
    maxLength: number;
    allowedFormats: string[];
  };
  smsRouting: {
    defaultProvider: string;
    fallbackProvider: string;
    routingRules: {
      [key: string]: string; // prefix -> provider code
    };
  };
  businessRules: {
    peakHours: {
      start: string;
      end: string;
    };
    offPeakHours: {
      start: string;
      end: string;
    };
    smsRateLimits: {
      perMinute: number;
      perHour: number;
      perDay: number;
    };
  };
  emergencyNumbers: {
    police: string;
    fire: string;
    ambulance: string;
    search_rescue: string;
    cyber_crime: string;
  };
  lastUpdated: string;
}

/**
 * Indonesian Telecom Providers Configuration
 * Updated: 2025-01-08
 * Source: Indonesian telecommunications regulatory data
 */
export const INDONESIAN_TELECOM_CONFIG: IndonesianTelecomConfig = {
  providers: [
    {
      name: 'Telkomsel',
      code: 'TSEL',
      prefixes: [
        '0811',
        '0812',
        '0813',
        '0821',
        '0822',
        '0823',
        '0851',
        '0852',
        '0853',
      ],
      isActive: true,
      businessType: 'both',
      coverage: 'national',
      smsSupported: true,
      ussdSupported: true,
      priority: 1,
      regionFocus: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang'],
      marketShare: 47.5,
      signalQuality: 'excellent',
      lastUpdated: '2025-01-08',
    },
    {
      name: 'Indosat Ooredoo Hutchison',
      code: 'ISAT',
      prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'],
      isActive: true,
      businessType: 'both',
      coverage: 'national',
      smsSupported: true,
      ussdSupported: true,
      priority: 2,
      regionFocus: ['Jakarta', 'Surabaya', 'Bandung'],
      marketShare: 20.8,
      signalQuality: 'good',
      lastUpdated: '2025-01-08',
    },
    {
      name: 'XL Axiata',
      code: 'XL',
      prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'],
      isActive: true,
      businessType: 'both',
      coverage: 'national',
      smsSupported: true,
      ussdSupported: true,
      priority: 3,
      regionFocus: ['Jakarta', 'Surabaya', 'Bandung'],
      marketShare: 13.2,
      signalQuality: 'good',
      lastUpdated: '2025-01-08',
    },
    {
      name: 'Tri (3)',
      code: 'TRI',
      prefixes: ['0895', '0896', '0897', '0898', '0899'],
      isActive: true,
      businessType: 'both',
      coverage: 'national',
      smsSupported: true,
      ussdSupported: true,
      priority: 4,
      regionFocus: ['Jakarta', 'Bandung', 'Surabaya'],
      marketShare: 8.5,
      signalQuality: 'good',
      lastUpdated: '2025-01-08',
    },
    {
      name: 'Smartfren',
      code: 'SMART',
      prefixes: [
        '0881',
        '0882',
        '0883',
        '0884',
        '0885',
        '0886',
        '0887',
        '0888',
      ],
      isActive: true,
      businessType: 'both',
      coverage: 'national',
      smsSupported: true,
      ussdSupported: true,
      priority: 5,
      regionFocus: ['Jakarta', 'Surabaya', 'Bandung'],
      marketShare: 6.2,
      signalQuality: 'fair',
      lastUpdated: '2025-01-08',
    },
    {
      name: 'Axis',
      code: 'AXIS',
      prefixes: ['0831', '0832', '0833', '0838'],
      isActive: true,
      businessType: 'both',
      coverage: 'national',
      smsSupported: true,
      ussdSupported: true,
      priority: 6,
      regionFocus: ['Jakarta', 'Surabaya'],
      marketShare: 3.8,
      signalQuality: 'fair',
      lastUpdated: '2025-01-08',
    },
  ],
  phoneValidation: {
    countryCode: '+62',
    minLength: 10,
    maxLength: 13,
    allowedFormats: [
      '+62XXXXXXXXXX',
      '62XXXXXXXXXX',
      '0XXXXXXXXXX',
      'XXXXXXXXXX',
    ],
  },
  smsRouting: {
    defaultProvider: 'TSEL',
    fallbackProvider: 'ISAT',
    routingRules: {
      '0811': 'TSEL',
      '0812': 'TSEL',
      '0813': 'TSEL',
      '0821': 'TSEL',
      '0822': 'TSEL',
      '0823': 'TSEL',
      '0851': 'TSEL',
      '0852': 'TSEL',
      '0853': 'TSEL',
      '0814': 'ISAT',
      '0815': 'ISAT',
      '0816': 'ISAT',
      '0855': 'ISAT',
      '0856': 'ISAT',
      '0857': 'ISAT',
      '0858': 'ISAT',
      '0817': 'XL',
      '0818': 'XL',
      '0819': 'XL',
      '0859': 'XL',
      '0877': 'XL',
      '0878': 'XL',
      '0895': 'TRI',
      '0896': 'TRI',
      '0897': 'TRI',
      '0898': 'TRI',
      '0899': 'TRI',
      '0881': 'SMART',
      '0882': 'SMART',
      '0883': 'SMART',
      '0884': 'SMART',
      '0885': 'SMART',
      '0886': 'SMART',
      '0887': 'SMART',
      '0888': 'SMART',
      '0831': 'AXIS',
      '0832': 'AXIS',
      '0833': 'AXIS',
      '0838': 'AXIS',
    },
  },
  businessRules: {
    peakHours: {
      start: '08:00',
      end: '17:00',
    },
    offPeakHours: {
      start: '17:00',
      end: '08:00',
    },
    smsRateLimits: {
      perMinute: 20,
      perHour: 100,
      perDay: 1000,
    },
  },
  emergencyNumbers: {
    police: '110',
    fire: '113',
    ambulance: '118',
    search_rescue: '115',
    cyber_crime: '176',
  },
  lastUpdated: '2025-01-08',
};

/**
 * Helper functions for Indonesian telecom operations
 */
export class IndonesianTelecomHelper {
  static getProviderByPrefix(prefix: string): IndonesianTelecomProvider | null {
    return (
      INDONESIAN_TELECOM_CONFIG.providers.find(provider =>
        provider.prefixes.includes(prefix),
      ) || null
    );
  }

  static getProviderByCode(code: string): IndonesianTelecomProvider | null {
    return (
      INDONESIAN_TELECOM_CONFIG.providers.find(
        provider => provider.code === code,
      ) || null
    );
  }

  static getActiveProviders(): IndonesianTelecomProvider[] {
    return INDONESIAN_TELECOM_CONFIG.providers.filter(
      provider => provider.isActive,
    );
  }

  static getProvidersByPriority(): IndonesianTelecomProvider[] {
    return INDONESIAN_TELECOM_CONFIG.providers
      .filter(provider => provider.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  static validateIndonesianPhoneNumber(phoneNumber: string): boolean {
    const cleanNumber = phoneNumber.replace(/\s|-/g, '');
    const { minLength, maxLength, allowedFormats } =
      INDONESIAN_TELECOM_CONFIG.phoneValidation;

    // Check length
    if (cleanNumber.length < minLength || cleanNumber.length > maxLength) {
      return false;
    }

    // Check format
    const formatMatches = allowedFormats.some(format => {
      const regex = new RegExp(format.replace(/X/g, '\\d'));
      return regex.test(cleanNumber);
    });

    if (!formatMatches) {
      return false;
    }

    // Check if prefix is valid
    const prefix = cleanNumber.startsWith('+62')
      ? cleanNumber.substring(3, 7)
      : cleanNumber.startsWith('62')
      ? cleanNumber.substring(2, 6)
      : cleanNumber.startsWith('0')
      ? cleanNumber.substring(0, 4)
      : cleanNumber.substring(0, 4);

    return INDONESIAN_TELECOM_CONFIG.providers.some(provider =>
      provider.prefixes.some(p => prefix.startsWith(p.substring(1))),
    );
  }

  static formatPhoneNumber(phoneNumber: string): string {
    let formatted = phoneNumber.replace(/\s|-/g, '');

    if (formatted.startsWith('0')) {
      formatted = '+62' + formatted.substring(1);
    } else if (formatted.startsWith('62')) {
      formatted = '+' + formatted;
    } else if (!formatted.startsWith('+62')) {
      formatted = '+62' + formatted;
    }

    return formatted;
  }

  static getOptimalProvider(
    phoneNumber: string,
  ): IndonesianTelecomProvider | null {
    const formatted = this.formatPhoneNumber(phoneNumber);
    const prefix = formatted.substring(3, 7);

    const provider = this.getProviderByPrefix('0' + prefix.substring(0, 3));
    if (provider && provider.isActive) {
      return provider;
    }

    // Fallback to default provider
    return this.getProviderByCode(
      INDONESIAN_TELECOM_CONFIG.smsRouting.defaultProvider,
    );
  }

  static isBusinessHours(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const { peakHours } = INDONESIAN_TELECOM_CONFIG.businessRules;

    const startHour = parseInt(peakHours.start.split(':')[0]);
    const endHour = parseInt(peakHours.end.split(':')[0]);

    return currentHour >= startHour && currentHour < endHour;
  }

  static getRateLimitForTime(): number {
    const isBusinessHours = this.isBusinessHours();
    const { smsRateLimits } = INDONESIAN_TELECOM_CONFIG.businessRules;

    return isBusinessHours
      ? smsRateLimits.perMinute
      : Math.floor(smsRateLimits.perMinute * 0.5);
  }
}

// NestJS ConfigService integration
export const indonesianTelecomConfig = registerAs('indonesianTelecom', () => ({
  defaultProvider: INDONESIAN_TELECOM_CONFIG.smsRouting.defaultProvider,
  fallbackProvider: INDONESIAN_TELECOM_CONFIG.smsRouting.fallbackProvider,
  countryCode: INDONESIAN_TELECOM_CONFIG.phoneValidation.countryCode,
  peakHoursStart: INDONESIAN_TELECOM_CONFIG.businessRules.peakHours.start,
  peakHoursEnd: INDONESIAN_TELECOM_CONFIG.businessRules.peakHours.end,
  smsRateLimitPerMinute:
    INDONESIAN_TELECOM_CONFIG.businessRules.smsRateLimits.perMinute,
  smsRateLimitPerHour:
    INDONESIAN_TELECOM_CONFIG.businessRules.smsRateLimits.perHour,
  smsRateLimitPerDay:
    INDONESIAN_TELECOM_CONFIG.businessRules.smsRateLimits.perDay,
  staticConfig: INDONESIAN_TELECOM_CONFIG,
}));

export default INDONESIAN_TELECOM_CONFIG;
