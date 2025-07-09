/**
 * Indonesian Geography and Regional Configuration
 * Configuration file for Indonesian provinces, cities, regions, and business characteristics
 * This replaces hardcoded geographic values and enables easy regional management
 * Now integrated with NestJS ConfigService for environment variable support
 */

import { registerAs } from '@nestjs/config';

export interface IndonesianProvince {
  code: string;
  name: string;
  englishName: string;
  capital: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  island: string;
  region: 'Western' | 'Central' | 'Eastern';
  population: number;
  area: number; // in km²
  gdpPerCapita: number; // in USD
  businessCharacteristics: {
    majorIndustries: string[];
    smbDensity: 'high' | 'medium' | 'low';
    digitalAdoption: 'high' | 'medium' | 'low';
    logisticsAccessibility: 'excellent' | 'good' | 'fair' | 'poor';
    infrastructureQuality: 'excellent' | 'good' | 'fair' | 'poor';
    businessHours: {
      start: string;
      end: string;
      weekendPattern: 'friday_saturday' | 'saturday_sunday' | 'sunday_only';
    };
    culturalFactors: {
      primaryLanguage: string;
      religiousMajority: string;
      businessEtiquette: string[];
      holidayObservance: 'strict' | 'moderate' | 'flexible';
    };
  };
  economicProfile: {
    gdp: number; // in billion USD
    unemploymentRate: number; // percentage
    povertyRate: number; // percentage
    literacyRate: number; // percentage
    internetPenetration: number; // percentage
    bankingPenetration: number; // percentage
    ecommercePenetration: number; // percentage
  };
  logisticsProfile: {
    mainPorts: string[];
    airports: string[];
    logisticsProviders: string[];
    averageDeliveryTime: number; // in days
    codAvailability: boolean;
    lastMileQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  isActive: boolean;
  lastUpdated: string;
}

export interface IndonesianCity {
  code: string;
  name: string;
  provinceCode: string;
  type: 'metropolitan' | 'city' | 'regency' | 'municipality';
  population: number;
  isCapital: boolean;
  businessImportance: 'high' | 'medium' | 'low';
  coordinates: {
    latitude: number;
    longitude: number;
  };
  economicZone: string;
  specialCharacteristics: string[];
  lastUpdated: string;
}

export interface IndonesianGeographyConfig {
  provinces: IndonesianProvince[];
  cities: IndonesianCity[];
  timezones: {
    WIB: {
      name: string;
      offset: string;
      provinces: string[];
    };
    WITA: {
      name: string;
      offset: string;
      provinces: string[];
    };
    WIT: {
      name: string;
      offset: string;
      provinces: string[];
    };
  };
  businessRegions: {
    [key: string]: {
      name: string;
      provinces: string[];
      characteristics: string[];
      businessPotential: 'high' | 'medium' | 'low';
    };
  };
  lastUpdated: string;
}

/**
 * Indonesian Geography and Regional Configuration
 * Updated: 2025-01-08
 * Source: BPS (Badan Pusat Statistik), Regional government data
 */
export const INDONESIAN_GEOGRAPHY_CONFIG: IndonesianGeographyConfig = {
  provinces: [
    {
      code: 'DKI',
      name: 'DKI Jakarta',
      englishName: 'Jakarta Capital City',
      capital: 'Jakarta',
      timezone: 'WIB',
      island: 'Java',
      region: 'Western',
      population: 10770487,
      area: 664.01,
      gdpPerCapita: 19000,
      businessCharacteristics: {
        majorIndustries: [
          'Finance',
          'Technology',
          'Manufacturing',
          'Trade',
          'Services',
        ],
        smbDensity: 'high',
        digitalAdoption: 'high',
        logisticsAccessibility: 'excellent',
        infrastructureQuality: 'excellent',
        businessHours: {
          start: '09:00',
          end: '17:00',
          weekendPattern: 'saturday_sunday',
        },
        culturalFactors: {
          primaryLanguage: 'Indonesian',
          religiousMajority: 'Islam',
          businessEtiquette: [
            'Punctuality valued',
            'Formal attire',
            'Networking important',
          ],
          holidayObservance: 'moderate',
        },
      },
      economicProfile: {
        gdp: 180.5,
        unemploymentRate: 5.28,
        povertyRate: 4.63,
        literacyRate: 99.2,
        internetPenetration: 87.5,
        bankingPenetration: 78.3,
        ecommercePenetration: 65.2,
      },
      logisticsProfile: {
        mainPorts: ['Tanjung Priok', 'Muara Baru'],
        airports: ['Soekarno-Hatta', 'Halim Perdanakusuma'],
        logisticsProviders: [
          'JNE',
          'J&T',
          'Pos Indonesia',
          'Sicepat',
          'Anteraja',
        ],
        averageDeliveryTime: 1,
        codAvailability: true,
        lastMileQuality: 'excellent',
      },
      isActive: true,
      lastUpdated: '2025-01-08',
    },
    {
      code: 'JABAR',
      name: 'Jawa Barat',
      englishName: 'West Java',
      capital: 'Bandung',
      timezone: 'WIB',
      island: 'Java',
      region: 'Western',
      population: 48274162,
      area: 35377.76,
      gdpPerCapita: 8200,
      businessCharacteristics: {
        majorIndustries: [
          'Manufacturing',
          'Agriculture',
          'Textiles',
          'Automotive',
          'Food Processing',
        ],
        smbDensity: 'high',
        digitalAdoption: 'medium',
        logisticsAccessibility: 'good',
        infrastructureQuality: 'good',
        businessHours: {
          start: '09:00',
          end: '17:00',
          weekendPattern: 'saturday_sunday',
        },
        culturalFactors: {
          primaryLanguage: 'Sundanese',
          religiousMajority: 'Islam',
          businessEtiquette: [
            'Respect for elders',
            'Collaborative approach',
            'Relationship building',
          ],
          holidayObservance: 'moderate',
        },
      },
      economicProfile: {
        gdp: 395.8,
        unemploymentRate: 7.86,
        povertyRate: 7.25,
        literacyRate: 97.8,
        internetPenetration: 68.4,
        bankingPenetration: 55.2,
        ecommercePenetration: 42.3,
      },
      logisticsProfile: {
        mainPorts: ['Cirebon', 'Indramayu'],
        airports: ['Husein Sastranegara', 'Kertajati'],
        logisticsProviders: ['JNE', 'J&T', 'Pos Indonesia', 'Sicepat'],
        averageDeliveryTime: 2,
        codAvailability: true,
        lastMileQuality: 'good',
      },
      isActive: true,
      lastUpdated: '2025-01-08',
    },
    {
      code: 'JATENG',
      name: 'Jawa Tengah',
      englishName: 'Central Java',
      capital: 'Semarang',
      timezone: 'WIB',
      island: 'Java',
      region: 'Western',
      population: 36516035,
      area: 32800.69,
      gdpPerCapita: 6800,
      businessCharacteristics: {
        majorIndustries: [
          'Manufacturing',
          'Agriculture',
          'Textiles',
          'Food Processing',
          'Furniture',
        ],
        smbDensity: 'high',
        digitalAdoption: 'medium',
        logisticsAccessibility: 'good',
        infrastructureQuality: 'good',
        businessHours: {
          start: '09:00',
          end: '17:00',
          weekendPattern: 'saturday_sunday',
        },
        culturalFactors: {
          primaryLanguage: 'Javanese',
          religiousMajority: 'Islam',
          businessEtiquette: [
            'Patience valued',
            'Consensus building',
            'Respectful communication',
          ],
          holidayObservance: 'moderate',
        },
      },
      economicProfile: {
        gdp: 248.5,
        unemploymentRate: 4.42,
        povertyRate: 10.64,
        literacyRate: 96.7,
        internetPenetration: 64.2,
        bankingPenetration: 52.8,
        ecommercePenetration: 38.9,
      },
      logisticsProfile: {
        mainPorts: ['Tanjung Emas', 'Cilacap'],
        airports: ['Ahmad Yani', 'Yogyakarta'],
        logisticsProviders: ['JNE', 'J&T', 'Pos Indonesia', 'Sicepat'],
        averageDeliveryTime: 2,
        codAvailability: true,
        lastMileQuality: 'good',
      },
      isActive: true,
      lastUpdated: '2025-01-08',
    },
    {
      code: 'JATIM',
      name: 'Jawa Timur',
      englishName: 'East Java',
      capital: 'Surabaya',
      timezone: 'WIB',
      island: 'Java',
      region: 'Western',
      population: 40665696,
      area: 47799.75,
      gdpPerCapita: 7500,
      businessCharacteristics: {
        majorIndustries: [
          'Manufacturing',
          'Agriculture',
          'Shipping',
          'Petrochemical',
          'Food Processing',
        ],
        smbDensity: 'high',
        digitalAdoption: 'medium',
        logisticsAccessibility: 'excellent',
        infrastructureQuality: 'good',
        businessHours: {
          start: '09:00',
          end: '17:00',
          weekendPattern: 'saturday_sunday',
        },
        culturalFactors: {
          primaryLanguage: 'Javanese',
          religiousMajority: 'Islam',
          businessEtiquette: [
            'Direct communication',
            'Entrepreneurial spirit',
            'Hard work ethic',
          ],
          holidayObservance: 'moderate',
        },
      },
      economicProfile: {
        gdp: 305.2,
        unemploymentRate: 3.99,
        povertyRate: 10.37,
        literacyRate: 96.9,
        internetPenetration: 66.8,
        bankingPenetration: 54.6,
        ecommercePenetration: 41.2,
      },
      logisticsProfile: {
        mainPorts: ['Tanjung Perak', 'Gresik'],
        airports: ['Juanda', 'Abdul Rachman Saleh'],
        logisticsProviders: [
          'JNE',
          'J&T',
          'Pos Indonesia',
          'Sicepat',
          'Anteraja',
        ],
        averageDeliveryTime: 2,
        codAvailability: true,
        lastMileQuality: 'good',
      },
      isActive: true,
      lastUpdated: '2025-01-08',
    },
    {
      code: 'BALI',
      name: 'Bali',
      englishName: 'Bali',
      capital: 'Denpasar',
      timezone: 'WITA',
      island: 'Bali',
      region: 'Central',
      population: 4317404,
      area: 5780.06,
      gdpPerCapita: 9200,
      businessCharacteristics: {
        majorIndustries: [
          'Tourism',
          'Agriculture',
          'Handicrafts',
          'Services',
          'Creative Economy',
        ],
        smbDensity: 'medium',
        digitalAdoption: 'medium',
        logisticsAccessibility: 'good',
        infrastructureQuality: 'good',
        businessHours: {
          start: '09:00',
          end: '17:00',
          weekendPattern: 'saturday_sunday',
        },
        culturalFactors: {
          primaryLanguage: 'Balinese',
          religiousMajority: 'Hindu',
          businessEtiquette: [
            'Respect for ceremonies',
            'Harmony valued',
            'Tourism focused',
          ],
          holidayObservance: 'strict',
        },
      },
      economicProfile: {
        gdp: 39.7,
        unemploymentRate: 2.65,
        povertyRate: 4.14,
        literacyRate: 98.2,
        internetPenetration: 71.3,
        bankingPenetration: 62.4,
        ecommercePenetration: 48.7,
      },
      logisticsProfile: {
        mainPorts: ['Benoa', 'Padangbai'],
        airports: ['Ngurah Rai'],
        logisticsProviders: ['JNE', 'J&T', 'Pos Indonesia', 'Sicepat'],
        averageDeliveryTime: 2,
        codAvailability: true,
        lastMileQuality: 'good',
      },
      isActive: true,
      lastUpdated: '2025-01-08',
    },
    // Add more provinces as needed for comprehensive coverage
  ],
  cities: [
    {
      code: 'JKT',
      name: 'Jakarta',
      provinceCode: 'DKI',
      type: 'metropolitan',
      population: 10770487,
      isCapital: true,
      businessImportance: 'high',
      coordinates: {
        latitude: -6.2,
        longitude: 106.816666,
      },
      economicZone: 'Jakarta Metropolitan Area',
      specialCharacteristics: [
        'Financial Center',
        'Government Center',
        'Technology Hub',
      ],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'SBY',
      name: 'Surabaya',
      provinceCode: 'JATIM',
      type: 'metropolitan',
      population: 2874699,
      isCapital: false,
      businessImportance: 'high',
      coordinates: {
        latitude: -7.250445,
        longitude: 112.768845,
      },
      economicZone: 'Gerbangkertosusilo',
      specialCharacteristics: [
        'Industrial Center',
        'Port City',
        'Manufacturing Hub',
      ],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'BDG',
      name: 'Bandung',
      provinceCode: 'JABAR',
      type: 'metropolitan',
      population: 2444160,
      isCapital: true,
      businessImportance: 'high',
      coordinates: {
        latitude: -6.917464,
        longitude: 107.619123,
      },
      economicZone: 'Bandung Raya',
      specialCharacteristics: [
        'Creative Economy',
        'Education Center',
        'Fashion Industry',
      ],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'MDN',
      name: 'Medan',
      provinceCode: 'SUMUT',
      type: 'metropolitan',
      population: 2210624,
      isCapital: true,
      businessImportance: 'high',
      coordinates: {
        latitude: 3.595196,
        longitude: 98.672226,
      },
      economicZone: 'Mebidangro',
      specialCharacteristics: [
        'Agricultural Center',
        'Palm Oil Industry',
        'Trade Hub',
      ],
      lastUpdated: '2025-01-08',
    },
    {
      code: 'SMG',
      name: 'Semarang',
      provinceCode: 'JATENG',
      type: 'metropolitan',
      population: 1653524,
      isCapital: true,
      businessImportance: 'medium',
      coordinates: {
        latitude: -6.966667,
        longitude: 110.416664,
      },
      economicZone: 'Kedungsepur',
      specialCharacteristics: ['Port City', 'Manufacturing', 'Logistics Hub'],
      lastUpdated: '2025-01-08',
    },
  ],
  timezones: {
    WIB: {
      name: 'Western Indonesia Time',
      offset: '+07:00',
      provinces: [
        'DKI',
        'JABAR',
        'JATENG',
        'JATIM',
        'BANTEN',
        'YOGYA',
        'SUMUT',
        'SUMBAR',
        'RIAU',
        'JAMBI',
        'SUMSEL',
        'BENGKULU',
        'LAMPUNG',
        'BABEL',
        'KEPRI',
        'ACEH',
      ],
    },
    WITA: {
      name: 'Central Indonesia Time',
      offset: '+08:00',
      provinces: [
        'KALBAR',
        'KALTENG',
        'KALSEL',
        'KALTIM',
        'KALUT',
        'BALI',
        'NTB',
        'NTT',
        'SULUT',
        'SULTENG',
        'SULSEL',
        'SULTRA',
        'GORONTALO',
        'SULBAR',
      ],
    },
    WIT: {
      name: 'Eastern Indonesia Time',
      offset: '+09:00',
      provinces: [
        'MALUKU',
        'MALUT',
        'PABAR',
        'PAPUA',
        'PAPSEL',
        'PAPTENG',
        'PAPGUNG',
        'PAPBARDAYA',
      ],
    },
  },
  businessRegions: {
    jabodetabek: {
      name: 'Jakarta Metropolitan Area',
      provinces: ['DKI', 'JABAR', 'BANTEN'],
      characteristics: [
        'High business density',
        'Financial center',
        'Technology hub',
      ],
      businessPotential: 'high',
    },
    gerbangkertosusilo: {
      name: 'Gerbangkertosusilo',
      provinces: ['JATIM'],
      characteristics: [
        'Industrial center',
        'Port access',
        'Manufacturing hub',
      ],
      businessPotential: 'high',
    },
    bandung_raya: {
      name: 'Bandung Raya',
      provinces: ['JABAR'],
      characteristics: ['Creative economy', 'Education center', 'Tourism'],
      businessPotential: 'medium',
    },
    kedungsepur: {
      name: 'Kedungsepur',
      provinces: ['JATENG'],
      characteristics: ['Manufacturing', 'Agriculture', 'Trade'],
      businessPotential: 'medium',
    },
    mebidangro: {
      name: 'Mebidangro',
      provinces: ['SUMUT'],
      characteristics: ['Agriculture', 'Palm oil', 'Trade'],
      businessPotential: 'medium',
    },
  },
  lastUpdated: '2025-01-08',
};

/**
 * Helper functions for Indonesian geography operations
 */
export class IndonesianGeographyHelper {
  static getProvinceByCode(code: string): IndonesianProvince | null {
    return (
      INDONESIAN_GEOGRAPHY_CONFIG.provinces.find(
        province => province.code === code,
      ) || null
    );
  }

  static getCityByCode(code: string): IndonesianCity | null {
    return (
      INDONESIAN_GEOGRAPHY_CONFIG.cities.find(city => city.code === code) ||
      null
    );
  }

  static getProvincesByTimezone(
    timezone: 'WIB' | 'WITA' | 'WIT',
  ): IndonesianProvince[] {
    return INDONESIAN_GEOGRAPHY_CONFIG.provinces.filter(
      province => province.timezone === timezone,
    );
  }

  static getBusinessImportantCities(): IndonesianCity[] {
    return INDONESIAN_GEOGRAPHY_CONFIG.cities.filter(
      city => city.businessImportance === 'high',
    );
  }

  static getProvincesByRegion(
    region: 'Western' | 'Central' | 'Eastern',
  ): IndonesianProvince[] {
    return INDONESIAN_GEOGRAPHY_CONFIG.provinces.filter(
      province => province.region === region,
    );
  }

  static getTimezoneInfo(timezone: 'WIB' | 'WITA' | 'WIT') {
    return INDONESIAN_GEOGRAPHY_CONFIG.timezones[timezone];
  }

  static getBusinessHours(
    provinceCode: string,
  ): { start: string; end: string; weekendPattern: string } | null {
    const province = this.getProvinceByCode(provinceCode);
    return province?.businessCharacteristics.businessHours || null;
  }

  static getOptimalLogisticsProviders(provinceCode: string): string[] {
    const province = this.getProvinceByCode(provinceCode);
    return province?.logisticsProfile.logisticsProviders || [];
  }

  static calculateDistance(city1Code: string, city2Code: string): number {
    const city1 = this.getCityByCode(city1Code);
    const city2 = this.getCityByCode(city2Code);

    if (!city1 || !city2) return 0;

    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(
      city2.coordinates.latitude - city1.coordinates.latitude,
    );
    const dLon = this.deg2rad(
      city2.coordinates.longitude - city1.coordinates.longitude,
    );

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(city1.coordinates.latitude)) *
        Math.cos(this.deg2rad(city2.coordinates.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return Math.round(distance);
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  static estimateDeliveryTime(
    fromCityCode: string,
    toCityCode: string,
  ): number {
    const distance = this.calculateDistance(fromCityCode, toCityCode);
    const fromCity = this.getCityByCode(fromCityCode);
    const toCity = this.getCityByCode(toCityCode);

    if (!fromCity || !toCity) return 3; // Default 3 days

    const fromProvince = this.getProvinceByCode(fromCity.provinceCode);
    const toProvince = this.getProvinceByCode(toCity.provinceCode);

    if (!fromProvince || !toProvince) return 3;

    // Same city: 1 day
    if (fromCityCode === toCityCode) return 1;

    // Same province: 1-2 days
    if (fromCity.provinceCode === toCity.provinceCode) return 2;

    // Different timezone: 3-5 days
    if (fromProvince.timezone !== toProvince.timezone)
      return Math.min(5, Math.max(3, Math.ceil(distance / 500)));

    // Same timezone, different province: 2-3 days
    return Math.min(3, Math.max(2, Math.ceil(distance / 800)));
  }

  static isBusinessHours(provinceCode: string): boolean {
    const businessHours = this.getBusinessHours(provinceCode);
    if (!businessHours) return false;

    const now = new Date();
    const currentHour = now.getHours();

    const startHour = parseInt(businessHours.start.split(':')[0]);
    const endHour = parseInt(businessHours.end.split(':')[0]);

    return currentHour >= startHour && currentHour < endHour;
  }

  static getRegionalBusinessCharacteristics(provinceCode: string): any {
    const province = this.getProvinceByCode(provinceCode);
    return province?.businessCharacteristics || null;
  }

  static getCODAvailability(provinceCode: string): boolean {
    const province = this.getProvinceByCode(provinceCode);
    return province?.logisticsProfile.codAvailability || false;
  }

  static getProvincesByLogisticsQuality(
    quality: 'excellent' | 'good' | 'fair' | 'poor',
  ): IndonesianProvince[] {
    return INDONESIAN_GEOGRAPHY_CONFIG.provinces.filter(
      province => province.logisticsProfile.lastMileQuality === quality,
    );
  }

  static getHighPotentialBusinessRegions(): string[] {
    return Object.keys(INDONESIAN_GEOGRAPHY_CONFIG.businessRegions).filter(
      key =>
        INDONESIAN_GEOGRAPHY_CONFIG.businessRegions[key].businessPotential ===
        'high',
    );
  }
}

// NestJS ConfigService integration
export const indonesianGeographyConfig = registerAs(
  'indonesianGeography',
  () => ({
    defaultTimezone: process.env.INDONESIAN_DEFAULT_TIMEZONE || 'WIB',
    defaultProvince: process.env.INDONESIAN_DEFAULT_PROVINCE || 'DKI',
    defaultCity: process.env.INDONESIAN_DEFAULT_CITY || 'Jakarta',
    businessHoursStart: process.env.INDONESIAN_BUSINESS_HOURS_START || '09:00',
    businessHoursEnd: process.env.INDONESIAN_BUSINESS_HOURS_END || '17:00',
    workingDays: process.env.INDONESIAN_WORKING_DAYS?.split(',') || [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ],
    tier1Cities: process.env.INDONESIAN_TIER_1_CITIES?.split(',') || [
      'jakarta',
      'surabaya',
      'bandung',
      'medan',
      'makassar',
    ],
    tier2Cities: process.env.INDONESIAN_TIER_2_CITIES?.split(',') || [
      'palembang',
      'semarang',
      'yogyakarta',
      'malang',
      'denpasar',
    ],
    urbanClassificationEnabled:
      process.env.INDONESIAN_URBAN_CLASSIFICATION_ENABLED === 'true',
    logisticsOptimizationEnabled:
      process.env.INDONESIAN_LOGISTICS_OPTIMIZATION_ENABLED === 'true',
    staticConfig: INDONESIAN_GEOGRAPHY_CONFIG,
  }),
);

export default INDONESIAN_GEOGRAPHY_CONFIG;
