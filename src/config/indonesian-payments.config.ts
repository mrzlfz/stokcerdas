/**
 * Indonesian Payment Methods Configuration
 * Configuration file for Indonesian payment methods, e-wallets, and financial services
 * This replaces hardcoded payment values and enables easy updates
 * Now integrated with NestJS ConfigService for environment variable support
 */

import { registerAs } from '@nestjs/config';

export interface IndonesianPaymentMethod {
  code: string;
  name: string;
  displayName: string;
  type:
    | 'digital_wallet'
    | 'qr_code'
    | 'bank_transfer'
    | 'credit_card'
    | 'debit_card'
    | 'cash'
    | 'crypto';
  provider: string;
  isActive: boolean;
  popularity: number; // 1-100 scale
  adoption: number; // percentage of Indonesian population
  transactionFee: {
    percentage: number;
    fixed: number; // in IDR
    minimum: number; // in IDR
    maximum: number; // in IDR
  };
  limits: {
    daily: number; // in IDR
    monthly: number; // in IDR
    perTransaction: number; // in IDR
  };
  features: {
    instantTransfer: boolean;
    offlinePayment: boolean;
    merchantPayment: boolean;
    p2pTransfer: boolean;
    billPayment: boolean;
    topUp: boolean;
    withdrawal: boolean;
    qrCodePayment: boolean;
  };
  targetAudience: string[];
  businessIntegration: {
    apiAvailable: boolean;
    webhookSupport: boolean;
    sdkAvailable: boolean;
    documentationQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  regions: string[]; // Indonesian regions where available
  lastUpdated: string;
}

export interface IndonesianPaymentConfig {
  methods: IndonesianPaymentMethod[];
  businessRules: {
    defaultMethod: string;
    fallbackMethod: string;
    smbPreferences: string[]; // Most preferred by SMBs
    customerPreferences: string[]; // Most preferred by customers
    lowValueTransactions: string[]; // Best for small amounts
    highValueTransactions: string[]; // Best for large amounts
  };
  taxConfiguration: {
    ppn: number; // PPN percentage
    pph: number; // PPh percentage
    minimumTaxableAmount: number; // in IDR
    digitalTaxEnabled: boolean;
  };
  compliance: {
    ojkRegulated: boolean;
    biRegulated: boolean;
    kycRequired: boolean;
    amlCompliance: boolean;
    dataProtectionCompliance: boolean;
  };
  conversionRates: {
    usdToIdr: number;
    lastUpdated: string;
  };
  lastUpdated: string;
}

/**
 * Indonesian Payment Methods Configuration
 * Updated: 2025-01-08
 * Source: Bank Indonesia, OJK, and Indonesian fintech market data
 */
export const INDONESIAN_PAYMENT_CONFIG: IndonesianPaymentConfig = {
  methods: [
    {
      code: 'qris',
      name: 'QRIS',
      displayName: 'QRIS (Quick Response Code Indonesian Standard)',
      type: 'qr_code',
      provider: 'Bank Indonesia',
      isActive: true,
      popularity: 95,
      adoption: 78.5,
      transactionFee: {
        percentage: 0.7,
        fixed: 0,
        minimum: 0,
        maximum: 2500,
      },
      limits: {
        daily: 20000000, // 20 million IDR
        monthly: 200000000, // 200 million IDR
        perTransaction: 10000000, // 10 million IDR
      },
      features: {
        instantTransfer: true,
        offlinePayment: false,
        merchantPayment: true,
        p2pTransfer: true,
        billPayment: true,
        topUp: false,
        withdrawal: false,
        qrCodePayment: true,
      },
      targetAudience: ['sme', 'merchants', 'consumers'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'excellent',
      },
      regions: ['All Indonesia'],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'gopay',
      name: 'GoPay',
      displayName: 'GoPay',
      type: 'digital_wallet',
      provider: 'PT Dompet Anak Bangsa',
      isActive: true,
      popularity: 88,
      adoption: 65.2,
      transactionFee: {
        percentage: 0.5,
        fixed: 0,
        minimum: 0,
        maximum: 2000,
      },
      limits: {
        daily: 20000000, // 20 million IDR
        monthly: 200000000, // 200 million IDR
        perTransaction: 10000000, // 10 million IDR
      },
      features: {
        instantTransfer: true,
        offlinePayment: false,
        merchantPayment: true,
        p2pTransfer: true,
        billPayment: true,
        topUp: true,
        withdrawal: true,
        qrCodePayment: true,
      },
      targetAudience: ['urban', 'millennials', 'sme'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'excellent',
      },
      regions: [
        'Jakarta',
        'Surabaya',
        'Bandung',
        'Medan',
        'Semarang',
        'Makassar',
        'Palembang',
      ],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'ovo',
      name: 'OVO',
      displayName: 'OVO',
      type: 'digital_wallet',
      provider: 'PT Visionet Internasional',
      isActive: true,
      popularity: 85,
      adoption: 58.7,
      transactionFee: {
        percentage: 0.5,
        fixed: 0,
        minimum: 0,
        maximum: 2000,
      },
      limits: {
        daily: 20000000,
        monthly: 200000000,
        perTransaction: 10000000,
      },
      features: {
        instantTransfer: true,
        offlinePayment: false,
        merchantPayment: true,
        p2pTransfer: true,
        billPayment: true,
        topUp: true,
        withdrawal: true,
        qrCodePayment: true,
      },
      targetAudience: ['urban', 'millennials', 'professionals'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'good',
      },
      regions: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang'],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'dana',
      name: 'DANA',
      displayName: 'DANA',
      type: 'digital_wallet',
      provider: 'PT Espay Debit Indonesia Koe',
      isActive: true,
      popularity: 82,
      adoption: 52.3,
      transactionFee: {
        percentage: 0.5,
        fixed: 0,
        minimum: 0,
        maximum: 2000,
      },
      limits: {
        daily: 20000000,
        monthly: 200000000,
        perTransaction: 10000000,
      },
      features: {
        instantTransfer: true,
        offlinePayment: false,
        merchantPayment: true,
        p2pTransfer: true,
        billPayment: true,
        topUp: true,
        withdrawal: true,
        qrCodePayment: true,
      },
      targetAudience: ['millennials', 'gen_z', 'sme'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'good',
      },
      regions: ['All Indonesia'],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'shopeepay',
      name: 'ShopeePay',
      displayName: 'ShopeePay',
      type: 'digital_wallet',
      provider: 'PT Airpay International',
      isActive: true,
      popularity: 75,
      adoption: 45.6,
      transactionFee: {
        percentage: 0.5,
        fixed: 0,
        minimum: 0,
        maximum: 2000,
      },
      limits: {
        daily: 20000000,
        monthly: 200000000,
        perTransaction: 10000000,
      },
      features: {
        instantTransfer: true,
        offlinePayment: false,
        merchantPayment: true,
        p2pTransfer: true,
        billPayment: true,
        topUp: true,
        withdrawal: true,
        qrCodePayment: true,
      },
      targetAudience: ['shoppers', 'millennials', 'sme'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'fair',
      },
      regions: ['All Indonesia'],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'credit_card',
      name: 'Credit Card',
      displayName: 'Kartu Kredit',
      type: 'credit_card',
      provider: 'Various Banks',
      isActive: true,
      popularity: 65,
      adoption: 15.2,
      transactionFee: {
        percentage: 2.5,
        fixed: 0,
        minimum: 5000,
        maximum: 100000,
      },
      limits: {
        daily: 100000000,
        monthly: 1000000000,
        perTransaction: 50000000,
      },
      features: {
        instantTransfer: false,
        offlinePayment: true,
        merchantPayment: true,
        p2pTransfer: false,
        billPayment: true,
        topUp: false,
        withdrawal: false,
        qrCodePayment: false,
      },
      targetAudience: ['high_income', 'professionals', 'businesses'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'excellent',
      },
      regions: ['All Indonesia'],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'bank_transfer',
      name: 'Bank Transfer',
      displayName: 'Transfer Bank',
      type: 'bank_transfer',
      provider: 'Various Banks',
      isActive: true,
      popularity: 90,
      adoption: 85.5,
      transactionFee: {
        percentage: 0,
        fixed: 6500,
        minimum: 6500,
        maximum: 25000,
      },
      limits: {
        daily: 500000000,
        monthly: 2000000000,
        perTransaction: 100000000,
      },
      features: {
        instantTransfer: true,
        offlinePayment: true,
        merchantPayment: true,
        p2pTransfer: true,
        billPayment: true,
        topUp: false,
        withdrawal: false,
        qrCodePayment: false,
      },
      targetAudience: ['all_segments'],
      businessIntegration: {
        apiAvailable: true,
        webhookSupport: true,
        sdkAvailable: true,
        documentationQuality: 'good',
      },
      regions: ['All Indonesia'],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'cod',
      name: 'Cash on Delivery',
      displayName: 'Bayar di Tempat (COD)',
      type: 'cash',
      provider: 'Various Logistics',
      isActive: true,
      popularity: 70,
      adoption: 62.3,
      transactionFee: {
        percentage: 0,
        fixed: 5000,
        minimum: 5000,
        maximum: 15000,
      },
      limits: {
        daily: 10000000,
        monthly: 100000000,
        perTransaction: 5000000,
      },
      features: {
        instantTransfer: false,
        offlinePayment: true,
        merchantPayment: true,
        p2pTransfer: false,
        billPayment: false,
        topUp: false,
        withdrawal: false,
        qrCodePayment: false,
      },
      targetAudience: ['rural', 'unbanked', 'conservative'],
      businessIntegration: {
        apiAvailable: false,
        webhookSupport: false,
        sdkAvailable: false,
        documentationQuality: 'poor',
      },
      regions: ['All Indonesia'],
      lastUpdated: '2025-01-08',
    },
  ],
  businessRules: {
    defaultMethod: 'qris',
    fallbackMethod: 'bank_transfer',
    smbPreferences: ['qris', 'gopay', 'ovo', 'dana', 'bank_transfer'],
    customerPreferences: ['qris', 'gopay', 'ovo', 'dana', 'shopeepay', 'cod'],
    lowValueTransactions: ['qris', 'gopay', 'ovo', 'dana'],
    highValueTransactions: ['bank_transfer', 'credit_card'],
  },
  taxConfiguration: {
    ppn: 11, // PPN 11%
    pph: 0.5, // PPh 0.5% for certain transactions
    minimumTaxableAmount: 4800000, // PTKP per month
    digitalTaxEnabled: true,
  },
  compliance: {
    ojkRegulated: true,
    biRegulated: true,
    kycRequired: true,
    amlCompliance: true,
    dataProtectionCompliance: true,
  },
  conversionRates: {
    usdToIdr: 15450,
    lastUpdated: '2025-01-08',
  },
  lastUpdated: '2025-01-08',
};

/**
 * Helper functions for Indonesian payment operations
 */
export class IndonesianPaymentHelper {
  static getPaymentMethodByCode(code: string): IndonesianPaymentMethod | null {
    return (
      INDONESIAN_PAYMENT_CONFIG.methods.find(method => method.code === code) ||
      null
    );
  }

  static getActivePaymentMethods(): IndonesianPaymentMethod[] {
    return INDONESIAN_PAYMENT_CONFIG.methods.filter(method => method.isActive);
  }

  static getPaymentMethodsByType(type: string): IndonesianPaymentMethod[] {
    return INDONESIAN_PAYMENT_CONFIG.methods.filter(
      method => method.isActive && method.type === type,
    );
  }

  static getPopularPaymentMethods(limit = 5): IndonesianPaymentMethod[] {
    return INDONESIAN_PAYMENT_CONFIG.methods
      .filter(method => method.isActive)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  static getOptimalPaymentMethod(
    amount: number,
    audience: string,
  ): IndonesianPaymentMethod | null {
    const { businessRules } = INDONESIAN_PAYMENT_CONFIG;

    // For low value transactions
    if (amount < 100000) {
      const methods = businessRules.lowValueTransactions;
      return this.getPaymentMethodByCode(methods[0]);
    }

    // For high value transactions
    if (amount > 10000000) {
      const methods = businessRules.highValueTransactions;
      return this.getPaymentMethodByCode(methods[0]);
    }

    // For SMB preferences
    if (audience === 'sme') {
      const methods = businessRules.smbPreferences;
      return this.getPaymentMethodByCode(methods[0]);
    }

    // Default to most popular
    return this.getPopularPaymentMethods(1)[0];
  }

  static calculateTransactionFee(amount: number, paymentCode: string): number {
    const method = this.getPaymentMethodByCode(paymentCode);
    if (!method) return 0;

    const fee = method.transactionFee;
    let totalFee = (amount * fee.percentage) / 100 + fee.fixed;

    // Apply minimum and maximum
    totalFee = Math.max(totalFee, fee.minimum);
    totalFee = Math.min(totalFee, fee.maximum);

    return Math.round(totalFee);
  }

  static validateTransactionAmount(
    amount: number,
    paymentCode: string,
  ): boolean {
    const method = this.getPaymentMethodByCode(paymentCode);
    if (!method) return false;

    return amount <= method.limits.perTransaction;
  }

  static getIndonesianDigitalWallets(): IndonesianPaymentMethod[] {
    return this.getPaymentMethodsByType('digital_wallet');
  }

  static getQRISCompatibleMethods(): IndonesianPaymentMethod[] {
    return INDONESIAN_PAYMENT_CONFIG.methods.filter(
      method => method.isActive && method.features.qrCodePayment,
    );
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  static convertUSDToIDR(usdAmount: number): number {
    const rate = INDONESIAN_PAYMENT_CONFIG.conversionRates.usdToIdr;
    return Math.round(usdAmount * rate);
  }

  static calculateTax(amount: number, taxType: 'ppn' | 'pph' = 'ppn'): number {
    const { taxConfiguration } = INDONESIAN_PAYMENT_CONFIG;

    if (amount < taxConfiguration.minimumTaxableAmount) {
      return 0;
    }

    const taxRate =
      taxType === 'ppn' ? taxConfiguration.ppn : taxConfiguration.pph;
    return Math.round((amount * taxRate) / 100);
  }

  static isPaymentMethodAvailableInRegion(
    paymentCode: string,
    region: string,
  ): boolean {
    const method = this.getPaymentMethodByCode(paymentCode);
    if (!method) return false;

    return (
      method.regions.includes('All Indonesia') ||
      method.regions.includes(region)
    );
  }

  static getRecommendedPaymentMethods(
    amount: number,
    audience: string,
    region: string,
  ): IndonesianPaymentMethod[] {
    return INDONESIAN_PAYMENT_CONFIG.methods
      .filter(
        method =>
          method.isActive &&
          this.validateTransactionAmount(amount, method.code) &&
          this.isPaymentMethodAvailableInRegion(method.code, region) &&
          method.targetAudience.includes(audience),
      )
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 3);
  }
}

// NestJS ConfigService integration
export const indonesianPaymentConfig = registerAs('indonesianPayment', () => ({
  enabled: process.env.INDONESIAN_PAYMENT_METHODS_ENABLED?.split(',') || [
    'qris',
    'gopay',
    'ovo',
    'dana',
    'shopeepay',
    'bank_transfer',
    'credit_card',
    'cod',
  ],
  defaultMethod: process.env.INDONESIAN_DEFAULT_PAYMENT_METHOD || 'qris',
  currencyCode: process.env.INDONESIAN_CURRENCY_CODE || 'IDR',
  currencySymbol: process.env.INDONESIAN_CURRENCY_SYMBOL || 'Rp',
  usdToIdrRate: parseFloat(process.env.INDONESIAN_USD_TO_IDR_RATE) || 15450,
  taxRatePPN: parseFloat(process.env.INDONESIAN_TAX_RATE_PPN) || 11,
  taxRatePPH: parseFloat(process.env.INDONESIAN_TAX_RATE_PPH) || 0.5,
  staticConfig: INDONESIAN_PAYMENT_CONFIG,
}));

export default INDONESIAN_PAYMENT_CONFIG;
