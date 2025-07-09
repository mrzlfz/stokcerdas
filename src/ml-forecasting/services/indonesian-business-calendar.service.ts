import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import moment from 'moment-timezone';
import {
  INDONESIAN_BUSINESS_CALENDAR_CONFIG,
  IndonesianBusinessCalendarHelper,
  IndonesianHoliday as ConfigHoliday,
  IndonesianBusinessPeriod,
} from '../../config/indonesian-business-calendar.config';
import {
  INDONESIAN_GEOGRAPHY_CONFIG,
  IndonesianGeographyHelper,
  IndonesianProvince,
} from '../../config/indonesian-geography.config';
import {
  INDONESIAN_PAYMENT_CONFIG,
  IndonesianPaymentHelper,
} from '../../config/indonesian-payments.config';
import {
  INDONESIAN_BUSINESS_RULES_CONFIG,
  IndonesianBusinessRulesHelper,
} from '../../config/indonesian-business-rules.config';

/**
 * PHASE 2.3: Indonesian Business Calendar Service 📅
 *
 * Enhanced calendar service dengan comprehensive Indonesian business context,
 * regional variations, dan cultural pattern analysis untuk improved ML predictions.
 * Includes detailed holiday impacts, regional differences, dan business cycle patterns.
 */

export interface IndonesianHoliday {
  id: string;
  date: string;
  name: string;
  nameEnglish: string;
  type: 'national' | 'regional' | 'religious' | 'cultural' | 'commercial';
  impact: 'very_high' | 'high' | 'medium' | 'low' | 'minimal';
  regions: IndonesianRegion[];
  businessCategories: BusinessCategoryImpact[];
  culturalSignificance: CulturalSignificance;
  economicImpact: EconomicImpact;
  duration: HolidayDuration;
  preparation: PreparationPeriod;
  recovery: RecoveryPeriod;
}

export interface IndonesianRegion {
  code: string;
  name: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  provinces: string[];
  culturalCharacteristics: RegionalCharacteristics;
  businessPatterns: RegionalBusinessPatterns;
  economicProfile: RegionalEconomicProfile;
}

// Extended interface to use with configuration data
export interface ExtendedIndonesianRegion extends IndonesianRegion {
  configProvince?: IndonesianProvince;
}

export interface BusinessCategoryImpact {
  category: BusinessCategory;
  impact: 'boost' | 'decline' | 'neutral' | 'surge' | 'closure';
  multiplier: number;
  duration: number; // days before/after
  specificPatterns: string[];
  recommendations: string[];
}

export interface CulturalSignificance {
  religiousImportance: 'very_high' | 'high' | 'medium' | 'low';
  familyGathering: boolean;
  traditionsPracticed: string[];
  modernAdaptations: string[];
  generationalDifferences: string[];
  urbanVsRural: {
    urbanImpact: number;
    ruralImpact: number;
    differences: string[];
  };
}

export interface EconomicImpact {
  consumerSpending: {
    increase: number; // percentage
    categories: string[];
    peakDays: number[];
  };
  businessOperations: {
    closureRate: number; // percentage of businesses closed
    reducedHours: number; // percentage with reduced hours
    extendedHours: number; // percentage with extended hours
  };
  transportation: {
    volumeIncrease: number;
    priceIncrease: number;
    availabilityDecrease: number;
  };
  supplyChain: {
    disruption: 'minimal' | 'moderate' | 'significant' | 'severe';
    leadTimeIncrease: number; // days
    stockingRecommendation: number; // percentage extra stock
  };
}

export interface HolidayDuration {
  officialDays: number;
  practicalDays: number; // including weekend extensions
  schoolHolidays: number;
  workingDayImpact: number;
}

export interface PreparationPeriod {
  startDaysBefore: number;
  peakPreparationDays: number[];
  shoppingPeakDays: number[];
  businessPreparationNeeds: string[];
}

export interface RecoveryPeriod {
  returnToNormalDays: number;
  gradualRecoveryPattern: number[];
  businessResumptionRate: number[];
}

export enum BusinessCategory {
  FOOD_BEVERAGE = 'food_beverage',
  CLOTHING_FASHION = 'clothing_fashion',
  ELECTRONICS = 'electronics',
  HOME_GARDEN = 'home_garden',
  HEALTH_BEAUTY = 'health_beauty',
  AUTOMOTIVE = 'automotive',
  BOOKS_EDUCATION = 'books_education',
  SPORTS_RECREATION = 'sports_recreation',
  SERVICES = 'services',
  AGRICULTURE = 'agriculture',
  CONSTRUCTION = 'construction',
  TOURISM = 'tourism',
  FINANCE = 'finance',
  TRANSPORTATION = 'transportation',
  TELECOMMUNICATIONS = 'telecommunications',
}

export interface RegionalCharacteristics {
  predominantReligion: string[];
  ethnicGroups: string[];
  languages: string[];
  traditionalCelebrations: string[];
  modernInfluences: string[];
  businessCulture: string[];
}

export interface RegionalBusinessPatterns {
  peakBusinessHours: { start: string; end: string };
  weekendPattern: 'friday_saturday' | 'saturday_sunday' | 'flexible';
  seasonalBusiness: string[];
  majorIndustries: string[];
  smeCharacteristics: string[];
  digitalAdoption: 'high' | 'medium' | 'low';
}

export interface RegionalEconomicProfile {
  averageIncome: 'high' | 'medium_high' | 'medium' | 'medium_low' | 'low';
  costOfLiving: 'high' | 'medium' | 'low';
  mainEconomicSectors: string[];
  growthRate: number;
  unemploymentRate: number;
  smePercentage: number;
}

export interface BusinessContextData {
  date: Date;
  holiday: IndonesianHoliday | null;
  region: IndonesianRegion;
  businessImpact: BusinessImpactAnalysis;
  culturalContext: CulturalContextData;
  recommendations: BusinessRecommendations;
}

export interface BusinessImpactAnalysis {
  overallMultiplier: number;
  categorySpecificMultipliers: Map<BusinessCategory, number>;
  timeOfDayFactors: number[];
  weekdayAdjustment: number;
  seasonalAdjustment: number;
  economicCycleAdjustment: number;
}

export interface CulturalContextData {
  isRamadan: boolean;
  isLebaran: boolean;
  isNationalHoliday: boolean;
  isRegionalHoliday: boolean;
  isSchoolHoliday: boolean;
  isPaydayPeriod: boolean;
  isWeekend: boolean;
  islamicCalendarInfo: IslamicCalendarInfo;
  chineseCalendarInfo: ChineseCalendarInfo;
}

export interface IslamicCalendarInfo {
  hijriDate: string;
  monthName: string;
  islamicHolidays: string[];
  prayerTimes: PrayerTimes;
  fastingStatus: 'fasting' | 'not_fasting' | 'optional';
}

export interface ChineseCalendarInfo {
  lunarDate: string;
  zodiacYear: string;
  zodiacAnimal: string;
  chineseHolidays: string[];
  luckyNumbers: number[];
  luckyColors: string[];
}

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface BusinessRecommendations {
  inventoryAdjustments: InventoryRecommendation[];
  pricingStrategy: PricingRecommendation[];
  operationalChanges: OperationalRecommendation[];
  marketingOpportunities: MarketingRecommendation[];
  riskMitigation: RiskMitigationRecommendation[];
}

export interface InventoryRecommendation {
  category: BusinessCategory;
  action: 'increase' | 'decrease' | 'maintain' | 'special_order';
  percentage: number;
  reasoning: string;
  timing: string;
  priority: 'high' | 'medium' | 'low';
}

export interface PricingRecommendation {
  strategy: 'premium' | 'discount' | 'bundle' | 'dynamic' | 'maintain';
  adjustment: number;
  applicableCategories: BusinessCategory[];
  duration: string;
  reasoning: string;
}

export interface OperationalRecommendation {
  area: 'hours' | 'staffing' | 'logistics' | 'supplier' | 'customer_service';
  change: string;
  impact: 'positive' | 'neutral' | 'challenging';
  implementation: string;
  cost: 'low' | 'medium' | 'high';
}

export interface MarketingRecommendation {
  channel: string;
  message: string;
  timing: string;
  budget: 'low' | 'medium' | 'high';
  expectedRoi: number;
}

export interface RiskMitigationRecommendation {
  risk: string;
  mitigation: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  actions: string[];
}

@Injectable()
export class IndonesianBusinessCalendarService {
  private readonly logger = new Logger(IndonesianBusinessCalendarService.name);
  private holidays: Map<string, IndonesianHoliday> = new Map();
  private regions: Map<string, IndonesianRegion> = new Map();
  private islamicCalendar: Map<string, IslamicCalendarInfo> = new Map();
  private chineseCalendar: Map<string, ChineseCalendarInfo> = new Map();

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    this.initializeIndonesianData();
  }

  /**
   * Initialize comprehensive Indonesian business data using configuration files
   */
  private initializeIndonesianData(): void {
    this.initializeRegionsFromConfig();
    this.initializeHolidaysFromConfig();
    this.initializeIslamicCalendarFromConfig();
    this.initializeChineseCalendarFromConfig();
    this.logger.log(
      'Indonesian Business Calendar data initialized successfully from configuration files',
    );
  }

  /**
   * Initialize Indonesian regions using configuration files
   */
  private initializeRegionsFromConfig(): void {
    const timezones = INDONESIAN_GEOGRAPHY_CONFIG.timezones;
    const provinces = INDONESIAN_GEOGRAPHY_CONFIG.provinces;

    Object.entries(timezones).forEach(([timezone, timezoneInfo]) => {
      const timezoneProvinces = provinces.filter(p => p.timezone === timezone);

      const region: ExtendedIndonesianRegion = {
        code: timezone,
        name: timezoneInfo.name,
        timezone: timezone as 'WIB' | 'WITA' | 'WIT',
        provinces: timezoneProvinces.map(p => p.name),
        culturalCharacteristics:
          this.generateCulturalCharacteristics(timezoneProvinces),
        businessPatterns: this.generateBusinessPatterns(timezoneProvinces),
        economicProfile: this.generateEconomicProfile(timezoneProvinces),
      };

      this.regions.set(region.code, region);
    });

    this.logger.log(
      `Initialized ${this.regions.size} Indonesian regions from configuration`,
    );
  }

  /**
   * Initialize Indonesian holidays using configuration files
   */
  private initializeHolidaysFromConfig(): void {
    const configHolidays = INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays;

    configHolidays.forEach(configHoliday => {
      const holiday: IndonesianHoliday = {
        id: configHoliday.id,
        date: configHoliday.date,
        name: configHoliday.name,
        nameEnglish: configHoliday.englishName,
        type: this.mapHolidayType(configHoliday.type),
        impact: this.mapBusinessImpact(configHoliday.businessImpact),
        regions: Array.from(this.regions.values()),
        businessCategories: this.generateBusinessCategories(configHoliday),
        culturalSignificance: this.generateCulturalSignificance(configHoliday),
        economicImpact: this.generateEconomicImpact(configHoliday),
        duration: this.generateDuration(configHoliday),
        preparation: this.generatePreparation(configHoliday),
        recovery: this.generateRecovery(configHoliday),
      };

      this.holidays.set(holiday.date, holiday);
    });

    this.logger.log(
      `Initialized ${this.holidays.size} Indonesian holidays from configuration`,
    );
  }

  /**
   * Initialize Islamic calendar information using configuration
   */
  private initializeIslamicCalendarFromConfig(): void {
    const ramadanConfig =
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.culturalEvents.ramadan;
    const lebaranConfig =
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.culturalEvents.lebaran;

    // Generate Islamic calendar data from configuration
    Object.entries(ramadanConfig.estimatedDates).forEach(([year, dates]) => {
      const startDate = dates.start;
      const endDate = dates.end;

      // Set Ramadan period
      const ramadanStart = new Date(startDate);
      const ramadanEnd = new Date(endDate);

      for (
        let d = new Date(ramadanStart);
        d <= ramadanEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = d.toISOString().split('T')[0];
        this.islamicCalendar.set(dateStr, {
          hijriDate: this.calculateHijriDate(d),
          monthName: 'Ramadan',
          islamicHolidays:
            d.getTime() === ramadanStart.getTime() ? ['Start of Ramadan'] : [],
          prayerTimes: this.calculatePrayerTimes(d),
          fastingStatus: 'fasting',
        });
      }
    });

    // Set Lebaran/Eid dates
    Object.entries(lebaranConfig.estimatedDates).forEach(([year, dates]) => {
      const startDate = dates.start;
      const endDate = dates.end;

      this.islamicCalendar.set(startDate, {
        hijriDate: this.calculateHijriDate(new Date(startDate)),
        monthName: 'Shawwal',
        islamicHolidays: ['Eid al-Fitr'],
        prayerTimes: this.calculatePrayerTimes(new Date(startDate)),
        fastingStatus: 'not_fasting',
      });
    });

    this.logger.log(`Initialized Islamic calendar data from configuration`);
  }

  /**
   * Initialize Chinese calendar information using configuration
   */
  private initializeChineseCalendarFromConfig(): void {
    const chineseNewYearHolidays =
      INDONESIAN_BUSINESS_CALENDAR_CONFIG.holidays.filter(
        h => h.id.includes('chinese_new_year') || h.name.includes('Imlek'),
      );

    chineseNewYearHolidays.forEach(holiday => {
      const year = parseInt(holiday.date.split('-')[0]);
      const zodiacData = this.getZodiacData(year);

      this.chineseCalendar.set(holiday.date, {
        lunarDate: `${year}-01-01`,
        zodiacYear: zodiacData.zodiacYear,
        zodiacAnimal: zodiacData.zodiacAnimal,
        chineseHolidays: ['Chinese New Year'],
        luckyNumbers: zodiacData.luckyNumbers,
        luckyColors: zodiacData.luckyColors,
      });
    });

    this.logger.log(`Initialized Chinese calendar data from configuration`);
  }

  /**
   * Get comprehensive business context untuk specific date
   */
  async getBusinessContext(
    date: Date | string,
    regionCode: string = 'WIB',
    businessCategory?: BusinessCategory,
  ): Promise<BusinessContextData> {
    const cacheKey = `business_context_${date}_${regionCode}_${
      businessCategory || 'all'
    }`;

    try {
      const cached = await this.cacheManager.get<BusinessContextData>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Cache retrieval failed: ${error.message}`);
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dateStr = dateObj.toISOString().split('T')[0];

    const region = this.regions.get(regionCode) || this.regions.get('WIB')!;
    const holiday = this.holidays.get(dateStr);

    // Analyze business impact
    const businessImpact = this.analyzeBusinessImpact(
      dateObj,
      holiday,
      region,
      businessCategory,
    );

    // Get cultural context
    const culturalContext = this.getCulturalContext(dateObj, dateStr);

    // Generate recommendations
    const recommendations = this.generateBusinessRecommendations(
      dateObj,
      holiday,
      region,
      businessCategory,
      businessImpact,
      culturalContext,
    );

    const context: BusinessContextData = {
      date: dateObj,
      holiday,
      region,
      businessImpact,
      culturalContext,
      recommendations,
    };

    // Cache for 24 hours
    try {
      await this.cacheManager.set(cacheKey, context, 24 * 60 * 60 * 1000);
    } catch (error) {
      this.logger.warn(`Cache storage failed: ${error.message}`);
    }

    return context;
  }

  /**
   * Analyze comprehensive business impact
   */
  private analyzeBusinessImpact(
    date: Date,
    holiday: IndonesianHoliday | null,
    region: IndonesianRegion,
    businessCategory?: BusinessCategory,
  ): BusinessImpactAnalysis {
    let overallMultiplier = 1.0;
    const categoryMultipliers = new Map<BusinessCategory, number>();

    // Base weekend adjustment
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) {
      overallMultiplier *= 1.15;
    }

    // Holiday impact
    if (holiday) {
      switch (holiday.impact) {
        case 'very_high':
          overallMultiplier *= 2.5;
          break;
        case 'high':
          overallMultiplier *= 1.8;
          break;
        case 'medium':
          overallMultiplier *= 1.3;
          break;
        case 'low':
          overallMultiplier *= 1.1;
          break;
        default:
          overallMultiplier *= 1.0;
      }

      // Category-specific adjustments
      holiday.businessCategories.forEach(catImpact => {
        categoryMultipliers.set(catImpact.category, catImpact.multiplier);
      });
    }

    // Ramadan/Lebaran adjustments
    if (this.isRamadanPeriod(date)) {
      overallMultiplier *= 1.4;
      categoryMultipliers.set(BusinessCategory.FOOD_BEVERAGE, 1.6);
    }

    if (this.isLebaranPeriod(date)) {
      overallMultiplier *= 2.0;
      categoryMultipliers.set(BusinessCategory.CLOTHING_FASHION, 3.0);
      categoryMultipliers.set(BusinessCategory.TRANSPORTATION, 4.0);
    }

    // Payday effects
    const dayOfMonth = date.getDate();
    if (dayOfMonth <= 3 || dayOfMonth >= 28) {
      overallMultiplier *= 1.15;
    }

    // Regional adjustments
    const regionalAdjustment = this.getRegionalAdjustment(region, date);
    overallMultiplier *= regionalAdjustment;

    // Time of day factors (simplified)
    const timeOfDayFactors = [
      0.3,
      0.2,
      0.1,
      0.1,
      0.2,
      0.3, // 00-05
      0.4,
      0.6,
      0.8,
      1.0,
      1.2,
      1.3, // 06-11
      1.4,
      1.3,
      1.2,
      1.1,
      1.2,
      1.3, // 12-17
      1.4,
      1.2,
      1.0,
      0.8,
      0.6,
      0.4, // 18-23
    ];

    return {
      overallMultiplier,
      categorySpecificMultipliers: categoryMultipliers,
      timeOfDayFactors,
      weekdayAdjustment: isWeekend ? 1.15 : 1.0,
      seasonalAdjustment: this.getSeasonalAdjustment(date),
      economicCycleAdjustment: this.getEconomicCycleAdjustment(date),
    };
  }

  /**
   * Get cultural context untuk date
   */
  private getCulturalContext(date: Date, dateStr: string): CulturalContextData {
    return {
      isRamadan: this.isRamadanPeriod(date),
      isLebaran: this.isLebaranPeriod(date),
      isNationalHoliday: this.holidays.has(dateStr),
      isRegionalHoliday: this.isRegionalHoliday(date),
      isSchoolHoliday: this.isSchoolHoliday(date),
      isPaydayPeriod: this.isPaydayPeriod(date),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      islamicCalendarInfo:
        this.islamicCalendar.get(dateStr) || this.getDefaultIslamicInfo(),
      chineseCalendarInfo:
        this.chineseCalendar.get(dateStr) || this.getDefaultChineseInfo(),
    };
  }

  /**
   * Generate comprehensive business recommendations
   */
  private generateBusinessRecommendations(
    date: Date,
    holiday: IndonesianHoliday | null,
    region: IndonesianRegion,
    businessCategory: BusinessCategory | undefined,
    businessImpact: BusinessImpactAnalysis,
    culturalContext: CulturalContextData,
  ): BusinessRecommendations {
    const recommendations: BusinessRecommendations = {
      inventoryAdjustments: [],
      pricingStrategy: [],
      operationalChanges: [],
      marketingOpportunities: [],
      riskMitigation: [],
    };

    // Generate inventory recommendations
    if (businessImpact.overallMultiplier > 1.5) {
      recommendations.inventoryAdjustments.push({
        category: businessCategory || BusinessCategory.FOOD_BEVERAGE,
        action: 'increase',
        percentage: Math.round((businessImpact.overallMultiplier - 1) * 100),
        reasoning: 'High demand expected due to cultural event',
        timing: '1-2 weeks before',
        priority: 'high',
      });
    }

    // Generate pricing recommendations
    if (holiday && holiday.impact === 'very_high') {
      recommendations.pricingStrategy.push({
        strategy: 'premium',
        adjustment: 10,
        applicableCategories: [
          BusinessCategory.TRANSPORTATION,
          BusinessCategory.FOOD_BEVERAGE,
        ],
        duration: 'During holiday period',
        reasoning: 'High demand allows premium pricing',
      });
    }

    // Generate operational recommendations
    if (culturalContext.isLebaran) {
      recommendations.operationalChanges.push({
        area: 'staffing',
        change: 'Increase staff by 50% during preparation period',
        impact: 'positive',
        implementation: 'Hire temporary staff 2 weeks before',
        cost: 'medium',
      });
    }

    // Generate marketing opportunities
    if (culturalContext.isRamadan) {
      recommendations.marketingOpportunities.push({
        channel: 'Social Media',
        message: 'Ramadan special offers and sahur/iftar packages',
        timing: 'Throughout Ramadan month',
        budget: 'medium',
        expectedRoi: 2.5,
      });
    }

    // Generate risk mitigation
    if (businessImpact.overallMultiplier > 2.0) {
      recommendations.riskMitigation.push({
        risk: 'Stock shortage during peak demand',
        mitigation: 'Maintain 2x normal inventory levels',
        probability: 'high',
        impact: 'high',
        actions: [
          'Early supplier negotiations',
          'Alternative supplier identification',
          'Stock monitoring',
        ],
      });
    }

    return recommendations;
  }

  // Helper methods

  private isRegionalHoliday(date: Date): boolean {
    // Check using the public getRegionalHolidayInfo method
    const regionInfo = this.getRegionalHolidayInfo(date, 'jakarta');
    return regionInfo.isRegionalHoliday;
  }

  private isPaydayPeriod(date: Date): boolean {
    const dayOfMonth = date.getDate();
    return dayOfMonth <= 3 || dayOfMonth >= 28;
  }

  private getRegionalAdjustment(region: IndonesianRegion, date: Date): number {
    // Get regional adjustment based on economic profile from configuration
    const extendedRegion = region as ExtendedIndonesianRegion;
    if (extendedRegion.configProvince) {
      const economicProfile = extendedRegion.configProvince.economicProfile;
      const gdpFactor = economicProfile.gdp / 100; // Normalize GDP to factor
      return Math.max(0.8, Math.min(1.3, 0.9 + gdpFactor * 0.1));
    }

    // Fallback to timezone-based adjustment
    switch (region.code) {
      case 'WIB':
        return 1.1; // Higher economic activity
      case 'WITA':
        return 1.0; // Baseline
      case 'WIT':
        return 0.9; // Lower economic activity
      default:
        return 1.0;
    }
  }

  private getSeasonalAdjustment(date: Date): number {
    const month = date.getMonth();
    // Indonesian seasonal patterns
    if (month >= 5 && month <= 8) return 1.1; // Dry season, more activity
    if (month >= 11 || month <= 2) return 0.9; // Rainy season, less activity
    return 1.0;
  }

  private getEconomicCycleAdjustment(date: Date): number {
    // Simplified economic cycle adjustment
    const year = date.getFullYear();
    const baseYear = 2024;
    const yearDiff = year - baseYear;
    const growthRate = 0.05; // 5% annual growth assumption
    return 1 + yearDiff * growthRate;
  }

  private getDefaultIslamicInfo(): IslamicCalendarInfo {
    return {
      hijriDate: '',
      monthName: '',
      islamicHolidays: [],
      prayerTimes: {
        fajr: '04:30',
        sunrise: '05:45',
        dhuhr: '12:00',
        asr: '15:15',
        maghrib: '18:00',
        isha: '19:15',
      },
      fastingStatus: 'not_fasting',
    };
  }

  private getDefaultChineseInfo(): ChineseCalendarInfo {
    return {
      lunarDate: '',
      zodiacYear: '',
      zodiacAnimal: '',
      chineseHolidays: [],
      luckyNumbers: [],
      luckyColors: [],
    };
  }

  // Helper methods for configuration integration

  private generateCulturalCharacteristics(
    provinces: IndonesianProvince[],
  ): RegionalCharacteristics {
    const allBusinessCulture = provinces.flatMap(
      p => p.businessCharacteristics.culturalFactors.businessEtiquette,
    );
    const allLanguages = provinces.flatMap(p => [
      p.businessCharacteristics.culturalFactors.primaryLanguage,
    ]);

    return {
      predominantReligion: ['Islam', 'Christianity', 'Buddhism', 'Hinduism'],
      ethnicGroups: ['Javanese', 'Sundanese', 'Batak', 'Minangkabau'],
      languages: [...new Set(allLanguages)],
      traditionalCelebrations: ['Traditional Festivals', 'Cultural Events'],
      modernInfluences: ['Technology', 'Globalization', 'Business Development'],
      businessCulture: [...new Set(allBusinessCulture)],
    };
  }

  private generateBusinessPatterns(
    provinces: IndonesianProvince[],
  ): RegionalBusinessPatterns {
    const averageBusinessHours = provinces[0]?.businessCharacteristics
      .businessHours || { start: '09:00', end: '17:00' };
    const majorIndustries = provinces.flatMap(
      p => p.businessCharacteristics.majorIndustries,
    );

    return {
      peakBusinessHours: averageBusinessHours,
      weekendPattern: 'saturday_sunday',
      seasonalBusiness: ['Holiday Shopping', 'Seasonal Events', 'Tourism'],
      majorIndustries: [...new Set(majorIndustries)],
      smeCharacteristics: [
        'Family Business',
        'Traditional Markets',
        'Modern Retail',
      ],
      digitalAdoption:
        provinces[0]?.businessCharacteristics.digitalAdoption || 'medium',
    };
  }

  private generateEconomicProfile(
    provinces: IndonesianProvince[],
  ): RegionalEconomicProfile {
    const avgGdp =
      provinces.reduce((sum, p) => sum + p.gdpPerCapita, 0) / provinces.length;
    const avgUnemployment =
      provinces.reduce(
        (sum, p) => sum + p.economicProfile.unemploymentRate,
        0,
      ) / provinces.length;
    const avgSme =
      provinces.reduce(
        (sum, p) => sum + p.economicProfile.ecommercePenetration,
        0,
      ) / provinces.length;

    return {
      averageIncome:
        avgGdp > 15000 ? 'high' : avgGdp > 10000 ? 'medium_high' : 'medium',
      costOfLiving: 'medium',
      mainEconomicSectors: ['Services', 'Manufacturing', 'Agriculture'],
      growthRate: 5.0,
      unemploymentRate: avgUnemployment,
      smePercentage: avgSme,
    };
  }

  private mapHolidayType(
    configType: string,
  ): 'national' | 'regional' | 'religious' | 'cultural' | 'commercial' {
    switch (configType) {
      case 'national':
        return 'national';
      case 'religious':
        return 'religious';
      case 'cultural':
        return 'cultural';
      case 'regional':
        return 'regional';
      default:
        return 'national';
    }
  }

  private mapBusinessImpact(
    configImpact: string,
  ): 'very_high' | 'high' | 'medium' | 'low' | 'minimal' {
    switch (configImpact) {
      case 'high':
        return 'very_high';
      case 'medium':
        return 'high';
      case 'low':
        return 'medium';
      default:
        return 'high';
    }
  }

  private generateBusinessCategories(
    configHoliday: ConfigHoliday,
  ): BusinessCategoryImpact[] {
    const categories: BusinessCategoryImpact[] = [];

    if (configHoliday.ecommerceImpact === 'surge') {
      categories.push({
        category: BusinessCategory.FOOD_BEVERAGE,
        impact: 'surge',
        multiplier: 2.0,
        duration: 7,
        specificPatterns: ['Holiday food', 'Traditional dishes'],
        recommendations: ['Increase inventory', 'Extend hours'],
      });

      categories.push({
        category: BusinessCategory.CLOTHING_FASHION,
        impact: 'surge',
        multiplier: 2.5,
        duration: 14,
        specificPatterns: ['Holiday clothes', 'Traditional wear'],
        recommendations: ['Seasonal collection', 'Gift wrapping'],
      });
    }

    return categories;
  }

  private generateCulturalSignificance(
    configHoliday: ConfigHoliday,
  ): CulturalSignificance {
    const isReligious = configHoliday.religion !== 'secular';
    const hasFamily = configHoliday.culturalPractices.some(
      p => p.includes('family') || p.includes('gathering'),
    );

    return {
      religiousImportance: isReligious ? 'high' : 'low',
      familyGathering: hasFamily,
      traditionsPracticed: configHoliday.culturalPractices,
      modernAdaptations: ['Digital celebration', 'Online shopping'],
      generationalDifferences: ['Traditional vs modern approaches'],
      urbanVsRural: {
        urbanImpact: 1.5,
        ruralImpact: 1.8,
        differences: ['Different celebration styles'],
      },
    };
  }

  private generateEconomicImpact(configHoliday: ConfigHoliday): EconomicImpact {
    const multiplier = configHoliday.businessImpact === 'high' ? 200 : 100;

    return {
      consumerSpending: {
        increase: multiplier,
        categories: ['Food', 'Clothing', 'Entertainment'],
        peakDays: [-7, -3, -1, 0],
      },
      businessOperations: {
        closureRate: configHoliday.businessEffects.duringHoliday.businessClosure
          ? 80
          : 20,
        reducedHours: 15,
        extendedHours: 5,
      },
      transportation: {
        volumeIncrease: 50,
        priceIncrease: 25,
        availabilityDecrease: 20,
      },
      supplyChain: {
        disruption: 'moderate',
        leadTimeIncrease: 2,
        stockingRecommendation: 30,
      },
    };
  }

  private generateDuration(configHoliday: ConfigHoliday): HolidayDuration {
    return {
      officialDays: 1,
      practicalDays: 3,
      schoolHolidays: 7,
      workingDayImpact: 2,
    };
  }

  private generatePreparation(configHoliday: ConfigHoliday): PreparationPeriod {
    return {
      startDaysBefore: configHoliday.businessEffects.beforeHoliday.days || 7,
      peakPreparationDays: [-7, -3, -1],
      shoppingPeakDays: [-14, -7, -3],
      businessPreparationNeeds: [
        'Inventory preparation',
        'Staff planning',
        'Payment systems',
      ],
    };
  }

  private generateRecovery(configHoliday: ConfigHoliday): RecoveryPeriod {
    return {
      returnToNormalDays: configHoliday.businessEffects.afterHoliday.days || 3,
      gradualRecoveryPattern: [0.6, 0.8, 1.0],
      businessResumptionRate: [50, 75, 100],
    };
  }

  private calculateHijriDate(date: Date): string {
    // Simplified Hijri date calculation - in production would use proper Islamic calendar library
    const year = date.getFullYear();
    const hijriYear = year - 621; // Approximate conversion
    return `${hijriYear}-01-01`;
  }

  private calculatePrayerTimes(date: Date): PrayerTimes {
    // Simplified prayer times - in production would use proper calculation library
    return {
      fajr: '04:30',
      sunrise: '05:45',
      dhuhr: '12:00',
      asr: '15:15',
      maghrib: '18:00',
      isha: '19:15',
    };
  }

  private getZodiacData(year: number): {
    zodiacYear: string;
    zodiacAnimal: string;
    luckyNumbers: number[];
    luckyColors: string[];
  } {
    const zodiacAnimals = [
      'Rat',
      'Ox',
      'Tiger',
      'Rabbit',
      'Dragon',
      'Snake',
      'Horse',
      'Goat',
      'Monkey',
      'Rooster',
      'Dog',
      'Pig',
    ];
    const animalIndex = (year - 1972) % 12;
    const animal = zodiacAnimals[animalIndex];

    return {
      zodiacYear: `Year of the ${animal}`,
      zodiacAnimal: animal,
      luckyNumbers: [1, 6, 7],
      luckyColors: ['gold', 'silver', 'red'],
    };
  }

  /**
   * Get holiday information by date
   */
  async getHolidayInfo(date: Date | string): Promise<IndonesianHoliday | null> {
    const dateStr =
      typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return this.holidays.get(dateStr) || null;
  }

  /**
   * Get all holidays dalam period
   */
  async getHolidaysInPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<IndonesianHoliday[]> {
    const holidays: IndonesianHoliday[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const holiday = await this.getHolidayInfo(current);
      if (holiday) {
        holidays.push(holiday);
      }
      current.setDate(current.getDate() + 1);
    }

    return holidays;
  }

  /**
   * Get region information
   */
  getRegionInfo(regionCode: string): IndonesianRegion | null {
    return this.regions.get(regionCode) || null;
  }

  /**
   * Get business impact multiplier for specific date and category
   */
  async getBusinessImpactMultiplier(
    date: Date,
    businessCategory: BusinessCategory,
    regionCode: string = 'WIB',
  ): Promise<number> {
    const context = await this.getBusinessContext(
      date,
      regionCode,
      businessCategory,
    );

    const categoryMultiplier =
      context.businessImpact.categorySpecificMultipliers.get(businessCategory);
    return categoryMultiplier || context.businessImpact.overallMultiplier;
  }

  /**
   * Enrich time series data dengan comprehensive business context
   */
  async enrichTimeSeriesWithBusinessContext(
    timeSeriesData: Array<{ date: string; value: number }>,
    businessCategory?: BusinessCategory,
    regionCode: string = 'WIB',
  ): Promise<
    Array<{ date: string; value: number; businessContext: BusinessContextData }>
  > {
    const enrichedData = [];

    for (const point of timeSeriesData) {
      const context = await this.getBusinessContext(
        new Date(point.date),
        regionCode,
        businessCategory,
      );
      enrichedData.push({
        ...point,
        businessContext: context,
      });
    }

    return enrichedData;
  }

  // Public API methods for testing and external use

  /**
   * Check if date is within Ramadan period
   */
  isRamadanPeriod(date: Date): boolean {
    const year = date.getFullYear();
    const ramadanDates = IndonesianBusinessCalendarHelper.getRamadanDates(year);

    if (!ramadanDates) return false;

    const startDate = new Date(ramadanDates.start);
    const endDate = new Date(ramadanDates.end);
    return date >= startDate && date <= endDate;
  }

  /**
   * Check if date is within Lebaran period
   */
  isLebaranPeriod(date: Date): boolean {
    const year = date.getFullYear();
    const lebaranDates = IndonesianBusinessCalendarHelper.getLebaranDates(year);

    if (!lebaranDates) return false;

    const startDate = new Date(lebaranDates.start);
    const endDate = new Date(lebaranDates.end);
    return date >= startDate && date <= endDate;
  }

  /**
   * Check if date is a public holiday
   */
  isPublicHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return this.holidays.has(dateStr);
  }

  /**
   * Check if date is weekend
   */
  isWeekend(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6;
  }

  /**
   * Check if date is valid
   */
  isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Get Indonesian day of week (0 = Sunday, 6 = Saturday)
   */
  getIndonesianDayOfWeek(date: Date): number {
    return date.getDay();
  }

  /**
   * Get Ramadan effect multiplier for specific category
   */
  getRamadanEffectMultiplier(date: Date, categoryType: string): number {
    if (!this.isRamadanPeriod(date)) {
      return 1.0;
    }

    switch (categoryType.toLowerCase()) {
      case 'food':
      case 'food_beverage':
        return 1.6;
      case 'clothing':
      case 'clothing_fashion':
        return 1.4;
      case 'electronics':
        return 1.0;
      case 'religious':
        return 2.0;
      default:
        return 1.2;
    }
  }

  /**
   * Get Lebaran effect multiplier for specific category
   */
  getLebaranEffectMultiplier(date: Date, categoryType: string): number {
    if (!this.isLebaranPeriod(date)) {
      return 1.0;
    }

    switch (categoryType.toLowerCase()) {
      case 'food':
      case 'food_beverage':
        return 2.5;
      case 'clothing':
      case 'clothing_fashion':
        return 3.0;
      case 'gifts':
        return 2.0;
      case 'transportation':
        return 4.0;
      default:
        return 1.8;
    }
  }

  /**
   * Check if date is within Ramadan preparation period (1 week before)
   */
  isRamadanPreparationPeriod(date: Date): boolean {
    const year = date.getFullYear();
    const ramadanDates = IndonesianBusinessCalendarHelper.getRamadanDates(year);

    if (!ramadanDates) return false;

    const startDate = new Date(ramadanDates.start);
    const preparationStart = new Date(startDate);
    preparationStart.setDate(preparationStart.getDate() - 7);

    return date >= preparationStart && date < startDate;
  }

  /**
   * Check if date is within Lebaran preparation period (2 weeks before)
   */
  isLebaranPreparationPeriod(date: Date): boolean {
    const year = date.getFullYear();
    const lebaranDates = IndonesianBusinessCalendarHelper.getLebaranDates(year);

    if (!lebaranDates) return false;

    const startDate = new Date(lebaranDates.start);
    const preparationStart = new Date(startDate);
    preparationStart.setDate(preparationStart.getDate() - 14);

    return date >= preparationStart && date < startDate;
  }

  /**
   * Get holiday effect multiplier for specific category
   */
  getHolidayEffectMultiplier(date: Date, categoryType: string): number {
    const dateStr = date.toISOString().split('T')[0];
    const holiday = this.holidays.get(dateStr);

    if (!holiday) {
      return 1.0;
    }

    const baseMultiplier = this.getHolidayBaseMultiplier(holiday);
    const categoryAdjustment = this.getHolidayCategoryAdjustment(holiday, categoryType);

    return baseMultiplier * categoryAdjustment;
  }

  /**
   * Get regional holiday information
   */
  getRegionalHolidayInfo(date: Date, regionCode: string): { isRegionalHoliday: boolean; info?: any } {
    // Simplified implementation - would check region-specific holidays
    const holidayDates = {
      jakarta: ['2025-06-22'], // Jakarta Anniversary
      yogyakarta: ['2025-10-07'], // Yogyakarta Day
    };

    const dateStr = date.toISOString().split('T')[0];
    const regionalHolidays = holidayDates[regionCode.toLowerCase()] || [];

    return {
      isRegionalHoliday: regionalHolidays.includes(dateStr),
      info: regionalHolidays.includes(dateStr) ? { name: `${regionCode} Regional Holiday` } : null
    };
  }

  /**
   * Check if date is within holiday preparation period
   */
  isHolidayPreparationPeriod(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    const holiday = this.holidays.get(dateStr);

    if (holiday) {
      return true; // If it's the holiday itself
    }

    // Check if it's within 1 week before a major holiday
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(date);
      checkDate.setDate(checkDate.getDate() + i);
      const checkDateStr = checkDate.toISOString().split('T')[0];
      const futureHoliday = this.holidays.get(checkDateStr);

      if (futureHoliday && (futureHoliday.impact === 'high' || futureHoliday.impact === 'very_high')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get business hours for specific timezone
   */
  getBusinessHours(timezone: string = 'wib'): { start: string; end: string; timezone: string; breakHours?: Array<{ start: string; end: string }> } {
    const timezoneMap = {
      wib: 'Asia/Jakarta',
      wita: 'Asia/Makassar', 
      wit: 'Asia/Jayapura'
    };

    return {
      start: '08:00',
      end: '17:00',
      timezone: timezoneMap[timezone.toLowerCase()] || 'Asia/Jakarta',
      breakHours: [{ start: '12:00', end: '13:00' }]
    };
  }

  /**
   * Check if time is within business hours
   */
  isBusinessHours(date: Date, timezone: string = 'wib'): boolean {
    const hour = date.getHours();
    return hour >= 8 && hour <= 17;
  }

  /**
   * Convert between Indonesian timezones
   */
  convertTimezone(date: Date, fromTimezone: string, toTimezone: string): Date {
    const timezoneOffsets = {
      wib: 7,  // UTC+7
      wita: 8, // UTC+8
      wit: 9   // UTC+9
    };

    const fromOffset = timezoneOffsets[fromTimezone.toLowerCase()] || 7;
    const toOffset = timezoneOffsets[toTimezone.toLowerCase()] || 7;
    const hoursDiff = toOffset - fromOffset;

    const convertedDate = new Date(date);
    convertedDate.setHours(convertedDate.getHours() + hoursDiff);
    
    return convertedDate;
  }

  /**
   * Optimize time for business hours
   */
  optimizeForBusinessHours(date: Date, timezone: string = 'wib'): { isOptimal: boolean; recommendation?: string } {
    const isOptimal = this.isBusinessHours(date, timezone);
    
    return {
      isOptimal,
      recommendation: isOptimal ? undefined : 'Schedule during business hours (08:00-17:00)'
    };
  }

  /**
   * Get next business day
   */
  getNextBusinessDay(date: Date): Date {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Skip weekends
    while (this.isWeekend(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    // Skip holidays
    while (this.isPublicHoliday(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
      // Re-check for weekends after skipping holidays
      while (this.isWeekend(nextDay)) {
        nextDay.setDate(nextDay.getDate() + 1);
      }
    }

    return nextDay;
  }

  /**
   * Check if date is wet season (monsoon)
   */
  isWetSeason(date: Date): boolean {
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    return month <= 4 || month >= 10; // October to April
  }

  /**
   * Get seasonal effect multiplier
   */
  getSeasonalEffectMultiplier(date: Date, productType: string): number {
    const isWet = this.isWetSeason(date);
    
    switch (productType.toLowerCase()) {
      case 'umbrellas':
        return isWet ? 1.8 : 0.7;
      case 'fans':
        return isWet ? 0.8 : 1.5;
      case 'air_conditioner':
        return isWet ? 0.9 : 1.3;
      case 'raincoat':
        return isWet ? 2.0 : 0.5;
      default:
        return 1.0;
    }
  }

  /**
   * Check if date is rice planting season
   */
  isRicePlantingSeason(date: Date): boolean {
    const month = date.getMonth() + 1;
    return month === 11 || month === 5; // November (main season) and May (second season)
  }

  /**
   * Get agricultural effect multiplier
   */
  getAgriculturalEffectMultiplier(date: Date, productType: string): number {
    const isPlantingSeason = this.isRicePlantingSeason(date);
    const month = date.getMonth() + 1;
    const isHarvestSeason = month === 3 || month === 9; // March and September

    switch (productType.toLowerCase()) {
      case 'fertilizer':
        return isPlantingSeason ? 1.6 : 1.0;
      case 'storage_equipment':
        return isHarvestSeason ? 1.4 : 1.0;
      case 'farming_tools':
        return isPlantingSeason ? 1.3 : 1.0;
      default:
        return 1.0;
    }
  }

  /**
   * Check if date is school holiday period
   */
  isSchoolHoliday(date: Date): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // July holidays (mid-year break)
    if (month === 7) {
      return true;
    }
    
    // December holidays (end-year break)
    if (month === 12 && day >= 20) {
      return true;
    }
    
    return false;
  }

  /**
   * Get school-related effect multiplier
   */
  getSchoolRelatedEffectMultiplier(date: Date, productType: string): number {
    const isSchoolHoliday = this.isSchoolHoliday(date);
    const month = date.getMonth() + 1;
    const isBackToSchool = month === 7 && date.getDate() > 15; // Mid-July back to school
    const isExamPeriod = month === 12 && date.getDate() < 15; // Early December exams

    switch (productType.toLowerCase()) {
      case 'school_supplies':
        return isBackToSchool ? 2.2 : 1.0;
      case 'stationery':
        return isExamPeriod ? 1.5 : (isBackToSchool ? 1.8 : 1.0);
      case 'uniforms':
        return isBackToSchool ? 2.0 : 1.0;
      case 'books':
        return isBackToSchool ? 1.9 : 1.0;
      default:
        return 1.0;
    }
  }

  // Private helper methods for holiday calculations

  private getHolidayBaseMultiplier(holiday: IndonesianHoliday): number {
    switch (holiday.impact) {
      case 'very_high':
        return 2.5;
      case 'high':
        return 1.8;
      case 'medium':
        return 1.3;
      case 'low':
        return 1.1;
      default:
        return 1.0;
    }
  }

  private getHolidayCategoryAdjustment(holiday: IndonesianHoliday, categoryType: string): number {
    // Check if this holiday has specific category impacts
    const categoryImpact = holiday.businessCategories.find(cat => 
      cat.category.toString().toLowerCase() === categoryType.toLowerCase()
    );

    if (categoryImpact) {
      return categoryImpact.multiplier;
    }

    // Default category adjustments based on holiday type
    switch (holiday.type) {
      case 'religious':
        if (categoryType.toLowerCase() === 'food') return 1.5;
        if (categoryType.toLowerCase() === 'gifts') return 1.3;
        break;
      case 'national':
        if (categoryType.toLowerCase() === 'food') return 1.2;
        break;
    }

    return 1.0;
  }
}
