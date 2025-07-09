/**
 * Indonesian Business Rules Configuration
 * Configuration file for Indonesian business rules, regulations, and operational guidelines
 * This replaces hardcoded business rules and enables easy compliance management
 * Now integrated with NestJS ConfigService for environment variable support
 */

import { registerAs } from '@nestjs/config';

export interface IndonesianBusinessRule {
  id: string;
  name: string;
  category:
    | 'taxation'
    | 'labor'
    | 'commerce'
    | 'finance'
    | 'logistics'
    | 'data_protection'
    | 'licensing';
  type: 'mandatory' | 'recommended' | 'optional';
  description: string;
  applicableBusinessTypes: string[]; // 'sme', 'enterprise', 'individual', 'all'
  applicableRegions: string[]; // province codes, empty array means all Indonesia
  compliance: {
    regulatoryBody: string;
    lawReference: string;
    effectiveDate: string;
    lastRevision: string;
    penaltyType: 'fine' | 'suspension' | 'revocation' | 'criminal' | 'warning';
    penaltyAmount?: {
      minimum: number;
      maximum: number;
      currency: 'IDR';
    };
  };
  implementation: {
    deadline: string;
    gracePerid: number; // in days
    reportingFrequency:
      | 'daily'
      | 'weekly'
      | 'monthly'
      | 'quarterly'
      | 'annually'
      | 'on_demand';
    documentationRequired: string[];
    automationPossible: boolean;
  };
  businessImpact: {
    operationalComplexity: 'low' | 'medium' | 'high';
    implementationCost: 'low' | 'medium' | 'high';
    ongoingCompliance: 'low' | 'medium' | 'high';
    businessRisk: 'low' | 'medium' | 'high' | 'critical';
  };
  isActive: boolean;
  lastUpdated: string;
}

export interface IndonesianOperationalGuideline {
  id: string;
  name: string;
  category:
    | 'working_hours'
    | 'holidays'
    | 'inventory'
    | 'customer_service'
    | 'logistics'
    | 'payments';
  description: string;
  recommendations: string[];
  bestPractices: string[];
  commonPitfalls: string[];
  industrySpecific: {
    [industry: string]: {
      recommendations: string[];
      specificRequirements: string[];
    };
  };
  regionalVariations: {
    [region: string]: {
      modifications: string[];
      additionalRequirements: string[];
    };
  };
  lastUpdated: string;
}

export interface IndonesianBusinessRulesConfig {
  businessRules: IndonesianBusinessRule[];
  operationalGuidelines: IndonesianOperationalGuideline[];
  complianceFramework: {
    requiredLicenses: {
      sme: string[];
      enterprise: string[];
      ecommerce: string[];
      logistics: string[];
    };
    taxObligations: {
      income: {
        smeThreshold: number; // in IDR
        corporateRate: number; // percentage
        finalTaxRate: number; // percentage for certain transactions
      };
      vat: {
        standardRate: number; // PPN percentage
        exemptionThreshold: number; // in IDR
        luxuryTaxItems: string[];
      };
      withholding: {
        professionalServices: number; // percentage
        goods: number; // percentage
        construction: number; // percentage
      };
    };
    laborCompliance: {
      minimumWage: {
        national: number; // in IDR
        jakartaProvince: number; // in IDR
        lastUpdated: string;
      };
      workingHours: {
        standardWeekly: number;
        maximumDaily: number;
        overtimeRate: number; // percentage
        mandatoryBreaks: string[];
      };
      benefits: {
        annualLeave: number; // days
        sickLeave: number; // days
        materinityLeave: number; // days
        religiousLeave: number; // days
      };
    };
  };
  regionSpecificRules: {
    [provinceCode: string]: {
      additionalRequirements: string[];
      localTaxes: {
        [taxType: string]: number; // percentage
      };
      operationalRestrictions: string[];
    };
  };
  industrySpecificRules: {
    [industry: string]: {
      additionalLicenses: string[];
      specialRequirements: string[];
      complianceChecks: string[];
    };
  };
  lastUpdated: string;
}

/**
 * Indonesian Business Rules Configuration
 * Updated: 2025-01-08
 * Source: Ministry of Law and Human Rights, Ministry of Finance, Ministry of Manpower
 */
export const INDONESIAN_BUSINESS_RULES_CONFIG: IndonesianBusinessRulesConfig = {
  businessRules: [
    {
      id: 'ppn_collection',
      name: 'PPN Collection Requirement',
      category: 'taxation',
      type: 'mandatory',
      description:
        'Businesses with annual revenue exceeding IDR 4.8 billion must collect and remit VAT',
      applicableBusinessTypes: ['sme', 'enterprise'],
      applicableRegions: [],
      compliance: {
        regulatoryBody: 'Directorate General of Taxes',
        lawReference: 'UU No. 42 Tahun 2009',
        effectiveDate: '2022-04-01',
        lastRevision: '2023-01-01',
        penaltyType: 'fine',
        penaltyAmount: {
          minimum: 500000,
          maximum: 50000000,
          currency: 'IDR',
        },
      },
      implementation: {
        deadline: '2025-04-01',
        gracePerid: 30,
        reportingFrequency: 'monthly',
        documentationRequired: [
          'Sales invoices',
          'Purchase receipts',
          'VAT calculation sheet',
        ],
        automationPossible: true,
      },
      businessImpact: {
        operationalComplexity: 'medium',
        implementationCost: 'medium',
        ongoingCompliance: 'high',
        businessRisk: 'high',
      },
      isActive: true,
      lastUpdated: '2025-01-08',
    },
    // ... other business rules
  ],
  operationalGuidelines: [
    // ... operational guidelines
  ],
  complianceFramework: {
    requiredLicenses: {
      sme: ['NIB (Business License)', 'NPWP (Tax ID)', 'Local Business Permit'],
      enterprise: [
        'NIB',
        'NPWP',
        'Company Registration',
        'Environmental Permit',
      ],
      ecommerce: [
        'NIB',
        'NPWP',
        'Trading License',
        'Consumer Protection Compliance',
      ],
      logistics: ['NIB', 'NPWP', 'Transportation License', 'Warehouse Permit'],
    },
    taxObligations: {
      income: {
        smeThreshold: 4800000000, // IDR 4.8 billion
        corporateRate: 22, // 22%
        finalTaxRate: 0.5, // 0.5% for certain SME transactions
      },
      vat: {
        standardRate: 11, // PPN 11%
        exemptionThreshold: 4800000000, // IDR 4.8 billion
        luxuryTaxItems: [
          'Luxury vehicles',
          'Jewelry',
          'Cosmetics',
          'Electronics',
        ],
      },
      withholding: {
        professionalServices: 2, // 2%
        goods: 0.3, // 0.3%
        construction: 2, // 2%
      },
    },
    laborCompliance: {
      minimumWage: {
        national: 3000000, // IDR 3 million
        jakartaProvince: 5067381, // IDR 5.067.381
        lastUpdated: '2024-01-01',
      },
      workingHours: {
        standardWeekly: 40,
        maximumDaily: 8,
        overtimeRate: 150, // 150% of regular rate
        mandatoryBreaks: [
          'Lunch break (1 hour)',
          'Prayer breaks (15 minutes each)',
        ],
      },
      benefits: {
        annualLeave: 12, // 12 days
        sickLeave: 15, // 15 days
        materinityLeave: 90, // 90 days
        religiousLeave: 3, // 3 days
      },
    },
  },
  regionSpecificRules: {
    // ... region specific rules
  },
  industrySpecificRules: {
    // ... industry specific rules
  },
  lastUpdated: '2025-01-08',
};

// Static config for backward compatibility
export const INDONESIAN_BUSINESS_RULES_CONFIG_STATIC: IndonesianBusinessRulesConfig =
  {
    businessRules: [
      {
        id: 'ppn_collection',
        name: 'PPN Collection Requirement',
        category: 'taxation',
        type: 'mandatory',
        description:
          'Businesses with annual revenue exceeding IDR 4.8 billion must collect and remit VAT',
        applicableBusinessTypes: ['sme', 'enterprise'],
        applicableRegions: [],
        compliance: {
          regulatoryBody: 'Directorate General of Taxes',
          lawReference: 'UU No. 42 Tahun 2009',
          effectiveDate: '2022-04-01',
          lastRevision: '2023-01-01',
          penaltyType: 'fine',
          penaltyAmount: {
            minimum: 500000,
            maximum: 50000000,
            currency: 'IDR',
          },
        },
        implementation: {
          deadline: '2025-04-01',
          gracePerid: 30,
          reportingFrequency: 'monthly',
          documentationRequired: [
            'Sales invoices',
            'Purchase receipts',
            'VAT calculation sheet',
          ],
          automationPossible: true,
        },
        businessImpact: {
          operationalComplexity: 'medium',
          implementationCost: 'medium',
          ongoingCompliance: 'high',
          businessRisk: 'high',
        },
        isActive: true,
        lastUpdated: '2025-01-08',
      },
      {
        id: 'financial_reporting',
        name: 'Financial Reporting for SMEs',
        category: 'finance',
        type: 'mandatory',
        description:
          'SMEs must maintain proper bookkeeping and file annual financial reports',
        applicableBusinessTypes: ['sme'],
        applicableRegions: [],
        compliance: {
          regulatoryBody: 'Ministry of Finance',
          lawReference: 'UU No. 8 Tahun 1997',
          effectiveDate: '1997-01-01',
          lastRevision: '2020-01-01',
          penaltyType: 'fine',
          penaltyAmount: {
            minimum: 1000000,
            maximum: 25000000,
            currency: 'IDR',
          },
        },
        implementation: {
          deadline: '2025-03-31',
          gracePerid: 60,
          reportingFrequency: 'annually',
          documentationRequired: [
            'Balance sheet',
            'Income statement',
            'Cash flow statement',
          ],
          automationPossible: true,
        },
        businessImpact: {
          operationalComplexity: 'medium',
          implementationCost: 'low',
          ongoingCompliance: 'medium',
          businessRisk: 'medium',
        },
        isActive: true,
        lastUpdated: '2025-01-08',
      },
      {
        id: 'data_protection_compliance',
        name: 'Personal Data Protection (UU PDP)',
        category: 'data_protection',
        type: 'mandatory',
        description:
          'All businesses processing personal data must comply with Indonesian data protection law',
        applicableBusinessTypes: ['all'],
        applicableRegions: [],
        compliance: {
          regulatoryBody: 'Ministry of Communication and Informatics',
          lawReference: 'UU No. 27 Tahun 2022',
          effectiveDate: '2024-10-01',
          lastRevision: '2024-10-01',
          penaltyType: 'fine',
          penaltyAmount: {
            minimum: 5000000,
            maximum: 50000000000,
            currency: 'IDR',
          },
        },
        implementation: {
          deadline: '2025-10-01',
          gracePerid: 180,
          reportingFrequency: 'on_demand',
          documentationRequired: [
            'Privacy policy',
            'Data processing records',
            'Consent management',
          ],
          automationPossible: true,
        },
        businessImpact: {
          operationalComplexity: 'high',
          implementationCost: 'high',
          ongoingCompliance: 'high',
          businessRisk: 'critical',
        },
        isActive: true,
        lastUpdated: '2025-01-08',
      },
      {
        id: 'minimum_wage_compliance',
        name: 'Minimum Wage Compliance',
        category: 'labor',
        type: 'mandatory',
        description: 'Employers must pay at least the provincial minimum wage',
        applicableBusinessTypes: ['sme', 'enterprise'],
        applicableRegions: [],
        compliance: {
          regulatoryBody: 'Ministry of Manpower',
          lawReference: 'UU No. 13 Tahun 2003',
          effectiveDate: '2003-01-01',
          lastRevision: '2024-01-01',
          penaltyType: 'fine',
          penaltyAmount: {
            minimum: 10000000,
            maximum: 100000000,
            currency: 'IDR',
          },
        },
        implementation: {
          deadline: 'immediate',
          gracePerid: 0,
          reportingFrequency: 'monthly',
          documentationRequired: [
            'Payroll records',
            'Employment contracts',
            'Wage calculations',
          ],
          automationPossible: true,
        },
        businessImpact: {
          operationalComplexity: 'low',
          implementationCost: 'high',
          ongoingCompliance: 'medium',
          businessRisk: 'high',
        },
        isActive: true,
        lastUpdated: '2025-01-08',
      },
      {
        id: 'halal_certification',
        name: 'Halal Certification for Food Products',
        category: 'commerce',
        type: 'mandatory',
        description: 'Food and beverage products must have halal certification',
        applicableBusinessTypes: ['sme', 'enterprise'],
        applicableRegions: [],
        compliance: {
          regulatoryBody: 'BPJPH (Halal Product Assurance Agency)',
          lawReference: 'UU No. 33 Tahun 2014',
          effectiveDate: '2024-10-17',
          lastRevision: '2024-10-17',
          penaltyType: 'suspension',
          penaltyAmount: {
            minimum: 25000000,
            maximum: 500000000,
            currency: 'IDR',
          },
        },
        implementation: {
          deadline: '2026-10-17',
          gracePerid: 365,
          reportingFrequency: 'annually',
          documentationRequired: [
            'Halal certificate',
            'Product registration',
            'Supply chain documentation',
          ],
          automationPossible: false,
        },
        businessImpact: {
          operationalComplexity: 'high',
          implementationCost: 'high',
          ongoingCompliance: 'medium',
          businessRisk: 'high',
        },
        isActive: true,
        lastUpdated: '2025-01-08',
      },
    ],
    operationalGuidelines: [
      {
        id: 'indonesian_working_hours',
        name: 'Indonesian Working Hours Guidelines',
        category: 'working_hours',
        description:
          'Best practices for managing working hours in Indonesian business context',
        recommendations: [
          'Standard working hours: 8 hours per day, 40 hours per week',
          'Friday prayer time consideration for Muslim employees',
          'Ramadan schedule adjustments',
          'Flexible hours during mudik period',
        ],
        bestPractices: [
          'Provide prayer room facilities',
          'Adjust lunch breaks during Ramadan',
          'Offer flexible start times during traffic peak hours',
          'Consider religious holiday patterns in planning',
        ],
        commonPitfalls: [
          'Not considering religious obligations',
          'Rigid scheduling during cultural events',
          'Ignoring traffic patterns in major cities',
          'Inadequate overtime compensation',
        ],
        industrySpecific: {
          retail: {
            recommendations: [
              'Extended hours during Ramadan',
              'Early closure on Fridays',
            ],
            specificRequirements: ['Customer service during prayer times'],
          },
          manufacturing: {
            recommendations: [
              'Shift rotation during religious periods',
              'Prayer break scheduling',
            ],
            specificRequirements: ['Production continuity planning'],
          },
        },
        regionalVariations: {
          DKI: {
            modifications: [
              'Traffic-adjusted schedules',
              'Flexible remote work',
            ],
            additionalRequirements: ['Air quality considerations'],
          },
          BALI: {
            modifications: [
              'Nyepi day considerations',
              'Hindu ceremonial adjustments',
            ],
            additionalRequirements: ['Religious ceremony participation'],
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'customer_service_standards',
        name: 'Indonesian Customer Service Standards',
        category: 'customer_service',
        description:
          'Guidelines for culturally appropriate customer service in Indonesia',
        recommendations: [
          'Use polite Bahasa Indonesia in all communications',
          'Provide multi-language support for diverse regions',
          'Respect for hierarchical communication styles',
          'Patient and detailed explanations',
        ],
        bestPractices: [
          'Use "Bapak/Ibu" titles appropriately',
          'Understand regional language preferences',
          'Provide WhatsApp support channels',
          'Offer COD payment options',
        ],
        commonPitfalls: [
          'Using overly casual language',
          'Ignoring regional cultural differences',
          'Inadequate payment method options',
          'Poor mobile experience',
        ],
        industrySpecific: {
          ecommerce: {
            recommendations: [
              'Mobile-first interface',
              'Local payment integration',
            ],
            specificRequirements: ['COD support', 'Regional logistics'],
          },
          fintech: {
            recommendations: ['KYC compliance', 'Security emphasis'],
            specificRequirements: ['OJK compliance', 'Consumer protection'],
          },
        },
        regionalVariations: {
          JAKARTA: {
            modifications: [
              'Fast-paced service expectations',
              'Digital-first approach',
            ],
            additionalRequirements: ['Premium service options'],
          },
          RURAL: {
            modifications: [
              'Patient explanation style',
              'Traditional payment methods',
            ],
            additionalRequirements: ['Offline support options'],
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'logistics_optimization',
        name: 'Indonesian Logistics Optimization',
        category: 'logistics',
        description:
          'Best practices for logistics operations in Indonesian archipelago',
        recommendations: [
          'Multi-carrier strategy for coverage',
          'Weather and disaster contingency planning',
          'Regional hub distribution strategy',
          'Cultural sensitivity in delivery timing',
        ],
        bestPractices: [
          'Partner with local logistics providers',
          'Implement package consolidation',
          'Use predictive analytics for demand',
          'Respect prayer times and religious holidays',
        ],
        commonPitfalls: [
          'Single carrier dependency',
          'Ignoring seasonal patterns',
          'Inadequate tracking systems',
          'Poor last-mile delivery experience',
        ],
        industrySpecific: {
          ecommerce: {
            recommendations: [
              'Same-day delivery in major cities',
              'Bulk shipping discounts',
            ],
            specificRequirements: ['COD handling', 'Return logistics'],
          },
          manufacturing: {
            recommendations: ['B2B focused delivery', 'Industrial area access'],
            specificRequirements: ['Heavy cargo capabilities'],
          },
        },
        regionalVariations: {
          JAKARTA: {
            modifications: [
              'Traffic congestion management',
              'High-frequency delivery',
            ],
            additionalRequirements: ['Motorcycle courier optimization'],
          },
          EASTERN_INDONESIA: {
            modifications: [
              'Extended delivery times',
              'Sea freight utilization',
            ],
            additionalRequirements: ['Remote area surcharges'],
          },
        },
        lastUpdated: '2025-01-08',
      },
    ],
    complianceFramework: {
      requiredLicenses: {
        sme: [
          'NIB (Business License)',
          'NPWP (Tax ID)',
          'Local Business Permit',
        ],
        enterprise: [
          'NIB',
          'NPWP',
          'Company Registration',
          'Environmental Permit',
        ],
        ecommerce: [
          'NIB',
          'NPWP',
          'Trading License',
          'Consumer Protection Compliance',
        ],
        logistics: [
          'NIB',
          'NPWP',
          'Transportation License',
          'Warehouse Permit',
        ],
      },
      taxObligations: {
        income: {
          smeThreshold: 4800000000, // IDR 4.8 billion
          corporateRate: 22, // 22%
          finalTaxRate: 0.5, // 0.5% for certain SME transactions
        },
        vat: {
          standardRate: 11, // PPN 11%
          exemptionThreshold: 4800000000, // IDR 4.8 billion
          luxuryTaxItems: [
            'Luxury vehicles',
            'Jewelry',
            'Cosmetics',
            'Electronics',
          ],
        },
        withholding: {
          professionalServices: 2, // 2%
          goods: 0.3, // 0.3%
          construction: 2, // 2%
        },
      },
      laborCompliance: {
        minimumWage: {
          national: 3000000, // IDR 3 million
          jakartaProvince: 5067381, // IDR 5.067.381
          lastUpdated: '2024-01-01',
        },
        workingHours: {
          standardWeekly: 40,
          maximumDaily: 8,
          overtimeRate: 150, // 150% of regular rate
          mandatoryBreaks: [
            'Lunch break (1 hour)',
            'Prayer breaks (15 minutes each)',
          ],
        },
        benefits: {
          annualLeave: 12, // 12 days
          sickLeave: 15, // 15 days
          materinityLeave: 90, // 90 days
          religiousLeave: 3, // 3 days
        },
      },
    },
    regionSpecificRules: {
      DKI: {
        additionalRequirements: [
          'Building Management Tax',
          'Waste Management Compliance',
        ],
        localTaxes: {
          property: 0.1, // 0.1%
          vehicle: 2, // 2%
        },
        operationalRestrictions: [
          'Odd-even vehicle restrictions',
          'Air quality compliance',
        ],
      },
      BALI: {
        additionalRequirements: ['Tourism Tax', 'Cultural Heritage Compliance'],
        localTaxes: {
          tourism: 10000, // IDR 10,000 per tourist per night
          cultural: 0.5, // 0.5%
        },
        operationalRestrictions: [
          'Nyepi day total shutdown',
          'Sacred area restrictions',
        ],
      },
      ACEH: {
        additionalRequirements: ['Sharia Compliance Certification'],
        localTaxes: {
          religious: 2.5, // 2.5% zakat for Muslim-owned businesses
        },
        operationalRestrictions: [
          'Alcohol sales prohibited',
          'Gambling prohibited',
        ],
      },
    },
    industrySpecificRules: {
      food_beverage: {
        additionalLicenses: [
          'BPOM Registration',
          'Halal Certification',
          'Food Safety Permit',
        ],
        specialRequirements: [
          'HACCP compliance',
          'Nutrition labeling',
          'Expiry date management',
        ],
        complianceChecks: [
          'Monthly BPOM inspection',
          'Halal audit',
          'Quality control testing',
        ],
      },
      fintech: {
        additionalLicenses: [
          'OJK License',
          'BI Permit',
          'Consumer Protection Compliance',
        ],
        specialRequirements: [
          'AML compliance',
          'KYC procedures',
          'Data protection',
        ],
        complianceChecks: [
          'Quarterly OJK reporting',
          'Annual audit',
          'Stress testing',
        ],
      },
      logistics: {
        additionalLicenses: [
          'Transportation Permit',
          'Warehouse License',
          'Dangerous Goods Permit',
        ],
        specialRequirements: [
          'Vehicle safety standards',
          'Driver certification',
          'Insurance coverage',
        ],
        complianceChecks: [
          'Vehicle inspection',
          'Driver health check',
          'Safety audit',
        ],
      },
      ecommerce: {
        additionalLicenses: [
          'Trading License',
          'Consumer Protection Compliance',
          'Data Processing Permit',
        ],
        specialRequirements: [
          'Consumer protection',
          'Return policy',
          'Dispute resolution',
        ],
        complianceChecks: [
          'Consumer complaint monitoring',
          'Data protection audit',
          'Platform compliance',
        ],
      },
    },
    lastUpdated: '2025-01-08',
  };

/**
 * Helper functions for Indonesian business rules operations
 */
export class IndonesianBusinessRulesHelper {
  static getBusinessRulesByCategory(
    category: string,
  ): IndonesianBusinessRule[] {
    return INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.filter(
      rule => rule.category === category && rule.isActive,
    );
  }

  static getMandatoryBusinessRules(): IndonesianBusinessRule[] {
    return INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.filter(
      rule => rule.type === 'mandatory' && rule.isActive,
    );
  }

  static getBusinessRulesForType(
    businessType: string,
  ): IndonesianBusinessRule[] {
    return INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.filter(
      rule =>
        rule.isActive &&
        (rule.applicableBusinessTypes.includes(businessType) ||
          rule.applicableBusinessTypes.includes('all')),
    );
  }

  static getBusinessRulesForRegion(
    provinceCode: string,
  ): IndonesianBusinessRule[] {
    return INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.filter(
      rule =>
        rule.isActive &&
        (rule.applicableRegions.length === 0 || // applies to all regions
          rule.applicableRegions.includes(provinceCode)),
    );
  }

  static getHighRiskBusinessRules(): IndonesianBusinessRule[] {
    return INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.filter(
      rule =>
        rule.isActive &&
        (rule.businessImpact.businessRisk === 'high' ||
          rule.businessImpact.businessRisk === 'critical'),
    );
  }

  static getRequiredLicensesForBusiness(businessType: string): string[] {
    const framework = INDONESIAN_BUSINESS_RULES_CONFIG.complianceFramework;
    return (
      framework.requiredLicenses[businessType] || framework.requiredLicenses.sme
    );
  }

  static calculateVATAmount(amount: number): number {
    const vatRate =
      INDONESIAN_BUSINESS_RULES_CONFIG.complianceFramework.taxObligations.vat
        .standardRate;
    return Math.round((amount * vatRate) / 100);
  }

  static calculateWithholdingTax(
    amount: number,
    type: 'professionalServices' | 'goods' | 'construction',
  ): number {
    const rate =
      INDONESIAN_BUSINESS_RULES_CONFIG.complianceFramework.taxObligations
        .withholding[type];
    return Math.round((amount * rate) / 100);
  }

  static isVATApplicable(annualRevenue: number): boolean {
    const threshold =
      INDONESIAN_BUSINESS_RULES_CONFIG.complianceFramework.taxObligations.vat
        .exemptionThreshold;
    return annualRevenue >= threshold;
  }

  static getMinimumWageForRegion(provinceCode: string): number {
    const { minimumWage } =
      INDONESIAN_BUSINESS_RULES_CONFIG.complianceFramework.laborCompliance;

    if (provinceCode === 'DKI') {
      return minimumWage.jakartaProvince;
    }

    // Add other province-specific minimum wages as needed
    return minimumWage.national;
  }

  static getOperationalGuidelinesByCategory(
    category: string,
  ): IndonesianOperationalGuideline[] {
    return INDONESIAN_BUSINESS_RULES_CONFIG.operationalGuidelines.filter(
      guideline => guideline.category === category,
    );
  }

  static getRegionalRequirements(provinceCode: string): any {
    return (
      INDONESIAN_BUSINESS_RULES_CONFIG.regionSpecificRules[provinceCode] || null
    );
  }

  static getIndustryRequirements(industry: string): any {
    return (
      INDONESIAN_BUSINESS_RULES_CONFIG.industrySpecificRules[industry] || null
    );
  }

  static getUpcomingDeadlines(daysAhead = 30): IndonesianBusinessRule[] {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    return INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.filter(rule => {
      if (!rule.isActive) return false;

      const deadline = new Date(rule.implementation.deadline);
      return deadline <= targetDate && deadline > new Date();
    });
  }

  static getComplianceRiskScore(
    businessType: string,
    provinceCode: string,
  ): number {
    const applicableRules = this.getBusinessRulesForType(businessType).filter(
      rule =>
        rule.applicableRegions.length === 0 ||
        rule.applicableRegions.includes(provinceCode),
    );

    let totalRisk = 0;
    applicableRules.forEach(rule => {
      const riskWeight = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
      };

      totalRisk += riskWeight[rule.businessImpact.businessRisk] || 1;
    });

    return Math.min(100, Math.round((totalRisk / applicableRules.length) * 25));
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  static getBusinessRuleById(id: string): IndonesianBusinessRule | null {
    return (
      INDONESIAN_BUSINESS_RULES_CONFIG.businessRules.find(
        rule => rule.id === id,
      ) || null
    );
  }

  static getOperationalGuidelineById(
    id: string,
  ): IndonesianOperationalGuideline | null {
    return (
      INDONESIAN_BUSINESS_RULES_CONFIG.operationalGuidelines.find(
        guideline => guideline.id === id,
      ) || null
    );
  }
}

// NestJS ConfigService integration
export const indonesianBusinessRulesConfig = registerAs(
  'indonesianBusinessRules',
  () => ({
    enabled: process.env.INDONESIAN_BUSINESS_RULES_ENABLED === 'true',
    taxRatePPN: parseInt(process.env.INDONESIAN_TAX_RATE_PPN, 10) || 11,
    taxRatePPH: parseFloat(process.env.INDONESIAN_TAX_RATE_PPH) || 0.5,
    vatThreshold:
      parseInt(process.env.INDONESIAN_VAT_THRESHOLD, 10) || 4800000000,
    smeThreshold:
      parseInt(process.env.INDONESIAN_SME_THRESHOLD, 10) || 4800000000,
    minimumWageNational:
      parseInt(process.env.INDONESIAN_MINIMUM_WAGE_NATIONAL, 10) || 3000000,
    minimumWageJakarta:
      parseInt(process.env.INDONESIAN_MINIMUM_WAGE_JAKARTA, 10) || 5067381,
    complianceEnabled: process.env.INDONESIAN_COMPLIANCE_ENABLED === 'true',
    uuPdpCompliance: process.env.INDONESIAN_UU_PDP_COMPLIANCE === 'true',
    taxComplianceEnabled:
      process.env.INDONESIAN_TAX_COMPLIANCE_ENABLED === 'true',
    laborComplianceEnabled:
      process.env.INDONESIAN_LABOR_COMPLIANCE_ENABLED === 'true',
    auditTrailEnabled: process.env.INDONESIAN_AUDIT_TRAIL_ENABLED === 'true',
    staticConfig: INDONESIAN_BUSINESS_RULES_CONFIG_STATIC,
  }),
);

export default INDONESIAN_BUSINESS_RULES_CONFIG;
