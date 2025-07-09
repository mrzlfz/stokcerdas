/**
 * Indonesian Business Calendar Configuration
 * Configuration file for Indonesian holidays, cultural events, and business calendar patterns
 * This replaces hardcoded holiday values and enables dynamic calendar management
 * Now integrated with NestJS ConfigService for environment variable support
 */

import { registerAs } from '@nestjs/config';

export interface IndonesianHoliday {
  id: string;
  name: string;
  englishName: string;
  date: string; // YYYY-MM-DD format
  type: 'national' | 'religious' | 'cultural' | 'regional';
  religion: 'islam' | 'christian' | 'hindu' | 'buddhist' | 'secular' | 'all';
  isFixed: boolean; // true for fixed dates, false for lunar/calculated dates
  businessImpact: 'high' | 'medium' | 'low';
  ecommerceImpact: 'surge' | 'normal' | 'decline';
  culturalPractices: string[];
  affectedRegions: string[]; // province codes, empty array means all Indonesia
  businessEffects: {
    beforeHoliday: {
      days: number;
      salesPattern: 'increase' | 'decrease' | 'normal';
      inventoryPattern: 'increase' | 'decrease' | 'normal';
      logisticsPattern: 'busy' | 'normal' | 'slow';
    };
    duringHoliday: {
      businessClosure: boolean;
      salesPattern: 'increase' | 'decrease' | 'normal';
      logisticsPattern: 'busy' | 'normal' | 'slow';
    };
    afterHoliday: {
      days: number;
      salesPattern: 'increase' | 'decrease' | 'normal';
      inventoryPattern: 'increase' | 'decrease' | 'normal';
      logisticsPattern: 'busy' | 'normal' | 'slow';
    };
  };
  lastUpdated: string;
}

export interface IndonesianBusinessPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: 'religious' | 'cultural' | 'economic' | 'seasonal';
  description: string;
  businessCharacteristics: {
    consumerBehavior: string[];
    preferredPaymentMethods: string[];
    popularProducts: string[];
    marketingApproach: string[];
    logisticsConsiderations: string[];
  };
  recommendations: {
    inventory: string[];
    marketing: string[];
    operations: string[];
    customerService: string[];
  };
  lastUpdated: string;
}

export interface IndonesianBusinessCalendarConfig {
  holidays: IndonesianHoliday[];
  businessPeriods: IndonesianBusinessPeriod[];
  culturalEvents: {
    ramadan: {
      estimatedDates: {
        [year: string]: {
          start: string;
          end: string;
        };
      };
      businessImpact: {
        fasting: {
          workingHours: string;
          productivity: string;
          consumerPattern: string;
        };
        breakingFast: {
          peakHours: string;
          popularProducts: string[];
          deliveryPattern: string;
        };
        lateNight: {
          ecommerceActivity: string;
          socialMediaEngagement: string;
          deliveryRequests: string;
        };
      };
    };
    lebaran: {
      estimatedDates: {
        [year: string]: {
          start: string;
          end: string;
        };
      };
      businessImpact: {
        mudik: {
          logisticsImpact: string;
          regionalShifts: string[];
          deliveryDelays: string;
        };
        shopping: {
          peakPeriod: string;
          popularCategories: string[];
          paymentPreferences: string[];
        };
        gifts: {
          popularItems: string[];
          packaging: string[];
          deliveryTiming: string;
        };
      };
    };
    christmas: {
      businessImpact: {
        shopping: {
          peakPeriod: string;
          popularCategories: string[];
          giftGiving: string[];
        };
        vacation: {
          period: string;
          businessClosure: string;
          logisticsImpact: string;
        };
      };
    };
  };
  businessRules: {
    workingDays: string[];
    weekendDays: string[];
    standardWorkingHours: {
      start: string;
      end: string;
    };
    ramadanWorkingHours: {
      start: string;
      end: string;
    };
    holidayCompensation: {
      beforeHoliday: boolean;
      afterHoliday: boolean;
      compensationDays: number;
    };
  };
  lastUpdated: string;
}

/**
 * Indonesian Business Calendar Configuration
 * Updated: 2025-01-08
 * Source: Ministry of Religion, Ministry of Manpower, Regional governments
 */
export const INDONESIAN_BUSINESS_CALENDAR_CONFIG: IndonesianBusinessCalendarConfig =
  {
    holidays: [
      {
        id: 'new_year',
        name: 'Tahun Baru Masehi',
        englishName: 'New Year',
        date: '2025-01-01',
        type: 'national',
        religion: 'secular',
        isFixed: true,
        businessImpact: 'medium',
        ecommerceImpact: 'normal',
        culturalPractices: [
          'Family gathering',
          'Celebration parties',
          'Resolution making',
        ],
        affectedRegions: [],
        businessEffects: {
          beforeHoliday: {
            days: 7,
            salesPattern: 'increase',
            inventoryPattern: 'increase',
            logisticsPattern: 'busy',
          },
          duringHoliday: {
            businessClosure: true,
            salesPattern: 'decrease',
            logisticsPattern: 'slow',
          },
          afterHoliday: {
            days: 3,
            salesPattern: 'normal',
            inventoryPattern: 'normal',
            logisticsPattern: 'normal',
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'chinese_new_year',
        name: 'Tahun Baru Imlek',
        englishName: 'Chinese New Year',
        date: '2025-01-29',
        type: 'national',
        religion: 'secular',
        isFixed: false,
        businessImpact: 'medium',
        ecommerceImpact: 'surge',
        culturalPractices: [
          'Family reunion',
          'Red envelopes',
          'Dragon dance',
          'Ancestor worship',
        ],
        affectedRegions: [],
        businessEffects: {
          beforeHoliday: {
            days: 14,
            salesPattern: 'increase',
            inventoryPattern: 'increase',
            logisticsPattern: 'busy',
          },
          duringHoliday: {
            businessClosure: true,
            salesPattern: 'decrease',
            logisticsPattern: 'slow',
          },
          afterHoliday: {
            days: 7,
            salesPattern: 'normal',
            inventoryPattern: 'normal',
            logisticsPattern: 'normal',
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'eid_fitr',
        name: 'Hari Raya Idul Fitri',
        englishName: 'Eid al-Fitr',
        date: '2025-03-30', // Estimated based on lunar calendar
        type: 'national',
        religion: 'islam',
        isFixed: false,
        businessImpact: 'high',
        ecommerceImpact: 'surge',
        culturalPractices: [
          'Mudik',
          'Silaturahmi',
          'Zakat Fitrah',
          'Takbiran',
          'Halal Bihalal',
        ],
        affectedRegions: [],
        businessEffects: {
          beforeHoliday: {
            days: 30,
            salesPattern: 'increase',
            inventoryPattern: 'increase',
            logisticsPattern: 'busy',
          },
          duringHoliday: {
            businessClosure: true,
            salesPattern: 'decrease',
            logisticsPattern: 'slow',
          },
          afterHoliday: {
            days: 14,
            salesPattern: 'normal',
            inventoryPattern: 'decrease',
            logisticsPattern: 'busy',
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'independence_day',
        name: 'Hari Kemerdekaan Republik Indonesia',
        englishName: 'Indonesian Independence Day',
        date: '2025-08-17',
        type: 'national',
        religion: 'secular',
        isFixed: true,
        businessImpact: 'high',
        ecommerceImpact: 'normal',
        culturalPractices: [
          'Flag ceremony',
          'Traditional competitions',
          'Patriotic displays',
        ],
        affectedRegions: [],
        businessEffects: {
          beforeHoliday: {
            days: 7,
            salesPattern: 'increase',
            inventoryPattern: 'normal',
            logisticsPattern: 'normal',
          },
          duringHoliday: {
            businessClosure: true,
            salesPattern: 'decrease',
            logisticsPattern: 'slow',
          },
          afterHoliday: {
            days: 1,
            salesPattern: 'normal',
            inventoryPattern: 'normal',
            logisticsPattern: 'normal',
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'christmas',
        name: 'Hari Raya Natal',
        englishName: 'Christmas',
        date: '2025-12-25',
        type: 'national',
        religion: 'christian',
        isFixed: true,
        businessImpact: 'high',
        ecommerceImpact: 'surge',
        culturalPractices: [
          'Church service',
          'Family gathering',
          'Gift giving',
          'Christmas tree',
        ],
        affectedRegions: [],
        businessEffects: {
          beforeHoliday: {
            days: 30,
            salesPattern: 'increase',
            inventoryPattern: 'increase',
            logisticsPattern: 'busy',
          },
          duringHoliday: {
            businessClosure: true,
            salesPattern: 'decrease',
            logisticsPattern: 'slow',
          },
          afterHoliday: {
            days: 7,
            salesPattern: 'normal',
            inventoryPattern: 'decrease',
            logisticsPattern: 'normal',
          },
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'nyepi',
        name: 'Hari Raya Nyepi',
        englishName: 'Nyepi (Day of Silence)',
        date: '2025-03-20',
        type: 'national',
        religion: 'hindu',
        isFixed: false,
        businessImpact: 'medium',
        ecommerceImpact: 'decline',
        culturalPractices: [
          'Silence',
          'Fasting',
          'Meditation',
          'No activities',
        ],
        affectedRegions: ['BALI'],
        businessEffects: {
          beforeHoliday: {
            days: 3,
            salesPattern: 'increase',
            inventoryPattern: 'increase',
            logisticsPattern: 'busy',
          },
          duringHoliday: {
            businessClosure: true,
            salesPattern: 'decrease',
            logisticsPattern: 'slow',
          },
          afterHoliday: {
            days: 1,
            salesPattern: 'normal',
            inventoryPattern: 'normal',
            logisticsPattern: 'normal',
          },
        },
        lastUpdated: '2025-01-08',
      },
    ],
    businessPeriods: [
      {
        id: 'ramadan_2025',
        name: 'Bulan Ramadan 2025',
        startDate: '2025-02-28',
        endDate: '2025-03-29',
        type: 'religious',
        description: 'Islamic holy month of fasting',
        businessCharacteristics: {
          consumerBehavior: [
            'Evening shopping surge',
            'Sahur food demand',
            'Iftar preparation',
          ],
          preferredPaymentMethods: ['qris', 'gopay', 'ovo', 'dana'],
          popularProducts: [
            'Food and beverages',
            'Religious items',
            'Dates',
            'Traditional wear',
          ],
          marketingApproach: [
            'Spiritual messaging',
            'Community focus',
            'Charity emphasis',
          ],
          logisticsConsiderations: [
            'Adjusted delivery hours',
            'Iftar time sensitivity',
            'Sahur deliveries',
          ],
        },
        recommendations: {
          inventory: [
            'Stock up on dates and traditional food',
            'Prepare religious merchandise',
            'Adjust beverage inventory',
          ],
          marketing: [
            'Ramadan-themed campaigns',
            'Charity partnerships',
            'Community engagement',
          ],
          operations: [
            'Flexible working hours',
            'Iftar break scheduling',
            'Delivery timing adjustment',
          ],
          customerService: [
            'Cultural sensitivity training',
            'Ramadan greetings',
            'Understanding fasting impact',
          ],
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'lebaran_2025',
        name: 'Lebaran 2025',
        startDate: '2025-03-30',
        endDate: '2025-04-05',
        type: 'religious',
        description: 'Eid al-Fitr celebration period',
        businessCharacteristics: {
          consumerBehavior: [
            'Mudik travel',
            'Gift purchasing',
            'New clothing',
            'Food preparation',
          ],
          preferredPaymentMethods: ['qris', 'bank_transfer', 'cod'],
          popularProducts: [
            'Clothing',
            'Food packages',
            'Travel items',
            'Gifts',
          ],
          marketingApproach: [
            'Family values',
            'Tradition emphasis',
            'Gratitude messaging',
          ],
          logisticsConsiderations: [
            'Mudik logistics',
            'Rural delivery surge',
            'Extended delivery times',
          ],
        },
        recommendations: {
          inventory: [
            'Prepare traditional clothing',
            'Stock gift items',
            'Food and snack packages',
          ],
          marketing: [
            'Lebaran promotions',
            'Family-oriented campaigns',
            'Traditional values',
          ],
          operations: [
            'Extended holiday closure',
            'Mudik logistics planning',
            'Rural delivery preparation',
          ],
          customerService: [
            'Holiday greetings',
            'Mudik support',
            'Extended response times',
          ],
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'back_to_school_2025',
        name: 'Tahun Ajaran Baru 2025',
        startDate: '2025-07-01',
        endDate: '2025-07-31',
        type: 'seasonal',
        description: 'Back to school period',
        businessCharacteristics: {
          consumerBehavior: [
            'School supply shopping',
            'Uniform purchasing',
            'Book buying',
          ],
          preferredPaymentMethods: ['qris', 'bank_transfer', 'credit_card'],
          popularProducts: [
            'School supplies',
            'Uniforms',
            'Books',
            'Electronics',
          ],
          marketingApproach: [
            'Educational focus',
            'Parent targeting',
            'Bulk discounts',
          ],
          logisticsConsiderations: [
            'High volume deliveries',
            'School address deliveries',
            'Bulk orders',
          ],
        },
        recommendations: {
          inventory: [
            'School supplies stock up',
            'Educational materials',
            'Uniform inventory',
          ],
          marketing: [
            'Back to school campaigns',
            'Parent-focused ads',
            'Educational partnerships',
          ],
          operations: [
            'Bulk delivery preparation',
            'School partnership',
            'Volume discount setup',
          ],
          customerService: [
            'Educational support',
            'Parent assistance',
            'Bulk order handling',
          ],
        },
        lastUpdated: '2025-01-08',
      },
      {
        id: 'christmas_season_2025',
        name: 'Musim Natal 2025',
        startDate: '2025-12-01',
        endDate: '2025-12-31',
        type: 'religious',
        description: 'Christmas season and New Year preparation',
        businessCharacteristics: {
          consumerBehavior: [
            'Gift shopping',
            'Decoration purchasing',
            'Party preparation',
          ],
          preferredPaymentMethods: ['credit_card', 'qris', 'bank_transfer'],
          popularProducts: [
            'Gifts',
            'Decorations',
            'Party supplies',
            'Food and beverages',
          ],
          marketingApproach: [
            'Festive messaging',
            'Gift-giving focus',
            'Joy and celebration',
          ],
          logisticsConsiderations: [
            'High volume period',
            'Gift packaging',
            'Time-sensitive deliveries',
          ],
        },
        recommendations: {
          inventory: [
            'Gift item preparation',
            'Decoration stock',
            'Party supplies',
          ],
          marketing: [
            'Christmas campaigns',
            'Gift guide creation',
            'Festive promotions',
          ],
          operations: [
            'Extended hours',
            'Gift wrapping services',
            'Express delivery options',
          ],
          customerService: [
            'Festive greetings',
            'Gift assistance',
            'Holiday support',
          ],
        },
        lastUpdated: '2025-01-08',
      },
    ],
    culturalEvents: {
      ramadan: {
        estimatedDates: {
          '2025': { start: '2025-02-28', end: '2025-03-29' },
          '2026': { start: '2026-02-17', end: '2026-03-18' },
          '2027': { start: '2027-02-06', end: '2027-03-07' },
        },
        businessImpact: {
          fasting: {
            workingHours:
              'Reduced productivity during day, increased evening activity',
            productivity: 'Lower during fasting hours, higher after iftar',
            consumerPattern: 'Minimal daytime shopping, surge before iftar',
          },
          breakingFast: {
            peakHours: '17:00-19:00 local time',
            popularProducts: [
              'Dates',
              'Traditional drinks',
              'Iftar food',
              'Fruits',
            ],
            deliveryPattern: 'High demand for fast delivery before iftar',
          },
          lateNight: {
            ecommerceActivity: 'Increased activity 20:00-24:00',
            socialMediaEngagement: 'Higher engagement post-iftar',
            deliveryRequests: 'Surge in late-night orders',
          },
        },
      },
      lebaran: {
        estimatedDates: {
          '2025': { start: '2025-03-30', end: '2025-04-05' },
          '2026': { start: '2026-03-19', end: '2026-03-25' },
          '2027': { start: '2027-03-08', end: '2027-03-14' },
        },
        businessImpact: {
          mudik: {
            logisticsImpact: 'Major logistics disruption, rural delivery surge',
            regionalShifts: [
              'Urban to rural migration',
              'Increased rural demand',
              'Logistics bottlenecks',
            ],
            deliveryDelays: 'Extended delivery times nationwide',
          },
          shopping: {
            peakPeriod: '2 weeks before lebaran',
            popularCategories: ['Clothing', 'Food', 'Gifts', 'Travel items'],
            paymentPreferences: ['Bank transfer', 'QRIS', 'Cash on delivery'],
          },
          gifts: {
            popularItems: [
              'Clothing',
              'Food packages',
              'Money envelopes',
              'Religious items',
            ],
            packaging: [
              'Traditional wrapping',
              'Religious themes',
              'Cultural colors',
            ],
            deliveryTiming: 'Critical timing for arrival before lebaran',
          },
        },
      },
      christmas: {
        businessImpact: {
          shopping: {
            peakPeriod: 'December 1-24',
            popularCategories: ['Gifts', 'Decorations', 'Food', 'Clothing'],
            giftGiving: ['Family gifts', 'Children focus', 'Religious items'],
          },
          vacation: {
            period: 'December 25 - January 2',
            businessClosure: 'Most businesses closed',
            logisticsImpact: 'Reduced logistics operations',
          },
        },
      },
    },
    businessRules: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      weekendDays: ['Saturday', 'Sunday'],
      standardWorkingHours: {
        start: '09:00',
        end: '17:00',
      },
      ramadanWorkingHours: {
        start: '09:00',
        end: '15:00',
      },
      holidayCompensation: {
        beforeHoliday: true,
        afterHoliday: true,
        compensationDays: 1,
      },
    },
    lastUpdated: '2025-01-08',
  };

/**
 * Helper functions for Indonesian business calendar operations
 */
export class IndonesianBusinessCalendarHelper {
  static getHolidayByDate(date: string): IndonesianHoliday | null {
    return (
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays.find(
        holiday => holiday.date === date,
      ) || null
    );
  }

  static getHolidaysByMonth(year: number, month: number): IndonesianHoliday[] {
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();

    return INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays.filter(holiday =>
      holiday.date.startsWith(`${yearStr}-${monthStr}`),
    );
  }

  static getHolidaysByType(
    type: 'national' | 'religious' | 'cultural' | 'regional',
  ): IndonesianHoliday[] {
    return INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays.filter(
      holiday => holiday.type === type,
    );
  }

  static getHolidaysByReligion(religion: string): IndonesianHoliday[] {
    return INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays.filter(
      holiday => holiday.religion === religion || holiday.religion === 'all',
    );
  }

  static isHoliday(date: string): boolean {
    return INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays.some(
      holiday => holiday.date === date,
    );
  }

  static isBusinessDay(date: string): boolean {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

    return !isWeekend && !this.isHoliday(date);
  }

  static getBusinessPeriodByDate(
    date: string,
  ): IndonesianBusinessPeriod | null {
    return (
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.businessPeriods.find(
        period => date >= period.startDate && date <= period.endDate,
      ) || null
    );
  }

  static getRamadanDates(year: number): { start: string; end: string } | null {
    const yearStr = year.toString();
    return (
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.culturalEvents.ramadan.estimatedDates[
        yearStr
      ] || null
    );
  }

  static getLebaranDates(year: number): { start: string; end: string } | null {
    const yearStr = year.toString();
    return (
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.culturalEvents.lebaran.estimatedDates[
        yearStr
      ] || null
    );
  }

  static isRamadanPeriod(date: string): boolean {
    const year = new Date(date).getFullYear();
    const ramadanDates = this.getRamadanDates(year);

    if (!ramadanDates) return false;

    return date >= ramadanDates.start && date <= ramadanDates.end;
  }

  static isLebaranPeriod(date: string): boolean {
    const year = new Date(date).getFullYear();
    const lebaranDates = this.getLebaranDates(year);

    if (!lebaranDates) return false;

    return date >= lebaranDates.start && date <= lebaranDates.end;
  }

  static getBusinessImpactForDate(date: string): any {
    const holiday = this.getHolidayByDate(date);
    if (holiday) {
      return {
        type: 'holiday',
        impact: holiday.businessImpact,
        ecommerceImpact: holiday.ecommerceImpact,
        effects: holiday.businessEffects,
      };
    }

    const businessPeriod = this.getBusinessPeriodByDate(date);
    if (businessPeriod) {
      return {
        type: 'business_period',
        impact: businessPeriod.type,
        characteristics: businessPeriod.businessCharacteristics,
        recommendations: businessPeriod.recommendations,
      };
    }

    return {
      type: 'normal',
      impact: 'low',
      ecommerceImpact: 'normal',
    };
  }

  static getWorkingHours(date: string): { start: string; end: string } {
    if (this.isRamadanPeriod(date)) {
      return INDONESIAN_BUSINESS_CALENDAR_CONFIG.businessRules
        .ramadanWorkingHours;
    }

    return INDONESIAN_BUSINESS_CALENDAR_CONFIG.businessRules
      .standardWorkingHours;
  }

  static getUpcomingHolidays(fromDate: string, limit = 5): IndonesianHoliday[] {
    return INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays
      .filter(holiday => holiday.date >= fromDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, limit);
  }

  static getHolidayRecommendations(date: string): string[] {
    const holiday = this.getHolidayByDate(date);
    if (!holiday) return [];

    const recommendations = [];

    if (holiday.businessImpact === 'high') {
      recommendations.push('Prepare for significant business impact');
      recommendations.push('Adjust inventory levels accordingly');
    }

    if (holiday.ecommerceImpact === 'surge') {
      recommendations.push('Increase server capacity');
      recommendations.push('Prepare for higher order volumes');
    }

    if (holiday.culturalPractices.includes('Mudik')) {
      recommendations.push('Prepare for logistics challenges');
      recommendations.push('Adjust delivery expectations');
    }

    return recommendations;
  }

  static formatIndonesianDate(date: string): string {
    const dateObj = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat('id-ID', options).format(dateObj);
  }

  static getBusinessDaysUntilDate(fromDate: string, toDate: string): number {
    const current = new Date(fromDate);
    const end = new Date(toDate);
    let businessDays = 0;

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (this.isBusinessDay(dateStr)) {
        businessDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return businessDays;
  }
}

// NestJS ConfigService integration
export const indonesianBusinessCalendarConfig = registerAs(
  'indonesianBusinessCalendar',
  () => ({
    enabled: process.env.INDONESIAN_CALENDAR_ENABLED === 'true',
    holidayImpactEnabled:
      process.env.INDONESIAN_HOLIDAY_IMPACT_ENABLED === 'true',
    seasonalAdjustmentEnabled:
      process.env.INDONESIAN_SEASONAL_ADJUSTMENT_ENABLED === 'true',
    ramadanAdjustmentEnabled:
      process.env.INDONESIAN_RAMADAN_ADJUSTMENT_ENABLED === 'true',
    lebaranMultiplier:
      parseFloat(process.env.INDONESIAN_LEBARAN_MULTIPLIER) || 3.2,
    ramadanMultiplier:
      parseFloat(process.env.INDONESIAN_RAMADAN_MULTIPLIER) || 0.6,
    staticConfig: INDONESIAN_BUSINESS_CALENDAR_CONFIG,
  }),
);

export default INDONESIAN_BUSINESS_CALENDAR_CONFIG;
