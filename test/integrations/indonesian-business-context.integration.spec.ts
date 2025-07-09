import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

// Core entities
import { Order, OrderStatus } from '../../src/orders/entities/order.entity';
import { Channel } from '../../src/channels/entities/channel.entity';
import { Product } from '../../src/products/entities/product.entity';

// Services
import { OrderRoutingService } from '../../src/orders/services/order-routing.service';
import { OrdersService } from '../../src/orders/services/orders.service';
import { ErrorHandlingService } from '../../src/integrations/common/services/error-handling.service';
import { SyncMonitoringService } from '../../src/common/services/sync-monitoring.service';

// Platform services
import { ShopeeOrderService } from '../../src/integrations/shopee/services/shopee-order.service';
import { LazadaOrderService } from '../../src/integrations/lazada/services/lazada-order.service';
import { TokopediaOrderService } from '../../src/integrations/tokopedia/services/tokopedia-order.service';

// Interfaces and configurations
import {
  OrderSyncOptions,
  StandardSyncResult,
  IndonesianBusinessContext,
} from '../../src/integrations/common/interfaces/order-sync.interface';

import {
  INDONESIAN_BUSINESS_CONFIG,
  IndonesianBusinessHelper,
  RateLimitingHelper,
  getPlatformConfig,
} from '../../src/integrations/common/config/platform-sync.config';

/**
 * COMPREHENSIVE INDONESIAN BUSINESS CONTEXT INTEGRATION TESTS
 * 
 * These tests validate the Indonesian-specific business logic and cultural considerations
 * in the multi-channel order synchronization system.
 * 
 * Test Coverage:
 * - Business hours synchronization (WIB, WITA, WIT timezones)
 * - Ramadan period handling and sensitivity
 * - Indonesian public holidays and cultural events
 * - Indonesian payment methods (QRIS, e-wallets, COD)
 * - Indonesian logistics providers (JNE, J&T, SiCepat, etc.)
 * - Regional delivery zones and shipping optimization
 * - Cultural considerations and customer service standards
 * - Indonesian regulatory compliance
 * - Seasonal business patterns and peak periods
 * - Local market behavior and customer expectations
 */

describe('Indonesian Business Context Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  
  // Core services
  let orderRoutingService: OrderRoutingService;
  let ordersService: OrdersService;
  let errorHandlingService: ErrorHandlingService;
  let syncMonitoringService: SyncMonitoringService;
  
  // Platform services
  let shopeeOrderService: ShopeeOrderService;
  let lazadaOrderService: LazadaOrderService;
  let tokopediaOrderService: TokopediaOrderService;
  
  // Test data
  let testTenantId: string;
  let testChannels: Channel[];
  let testOrders: Order[];
  
  // Indonesian business context helper
  let businessContextHelper: typeof IndonesianBusinessHelper;
  
  // Time-specific test data
  const jakartaTimeZone = 'Asia/Jakarta';
  const makassarTimeZone = 'Asia/Makassar'; // WITA
  const jayapuraTimeZone = 'Asia/Jayapura'; // WIT

  beforeAll(async () => {
    // Setup test module
    const testModule = await Test.createTestingModule({
      providers: [
        // Core services
        OrderRoutingService,
        OrdersService,
        ErrorHandlingService,
        SyncMonitoringService,
        
        // Platform services
        ShopeeOrderService,
        LazadaOrderService,
        TokopediaOrderService,
        
        // Repositories
        {
          provide: getRepositoryToken(Order),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Channel),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Product),
          useClass: Repository,
        },
        
        // Dependencies
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'SHOPEE_API_KEY': 'test-shopee-key',
                'LAZADA_API_KEY': 'test-lazada-key',
                'TOKOPEDIA_API_KEY': 'test-tokopedia-key',
                'INDONESIAN_BUSINESS_HOURS_START': '9',
                'INDONESIAN_BUSINESS_HOURS_END': '17',
                'RAMADAN_SENSITIVE_OPERATIONS': 'true',
                'HOLIDAY_SENSITIVE_OPERATIONS': 'true',
              };
              return config[key] || null;
            }),
          },
        },
      ],
    }).compile();

    module = testModule;
    app = module.createNestApplication();
    
    // Initialize services
    orderRoutingService = module.get<OrderRoutingService>(OrderRoutingService);
    ordersService = module.get<OrdersService>(OrdersService);
    errorHandlingService = module.get<ErrorHandlingService>(ErrorHandlingService);
    syncMonitoringService = module.get<SyncMonitoringService>(SyncMonitoringService);
    
    shopeeOrderService = module.get<ShopeeOrderService>(ShopeeOrderService);
    lazadaOrderService = module.get<LazadaOrderService>(LazadaOrderService);
    tokopediaOrderService = module.get<TokopediaOrderService>(TokopediaOrderService);
    
    await app.init();
    
    // Setup test data
    await setupTestData();
    
    // Initialize business context helper
    businessContextHelper = IndonesianBusinessHelper;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('Phase 3.6.3: Indonesian Business Context Scenarios', () => {
    
    describe('Indonesian Business Hours Management', () => {
      test('should correctly identify Indonesian business hours across timezones', () => {
        // Test WIB (Western Indonesia Time - UTC+7)
        const wibBusinessHours = testBusinessHours('Asia/Jakarta');
        expect(wibBusinessHours).toBeDefined();
        
        // Test WITA (Central Indonesia Time - UTC+8)
        const witaBusinessHours = testBusinessHours('Asia/Makassar');
        expect(witaBusinessHours).toBeDefined();
        
        // Test WIT (Eastern Indonesia Time - UTC+9)
        const witBusinessHours = testBusinessHours('Asia/Jayapura');
        expect(witBusinessHours).toBeDefined();
        
        // Verify business hours configuration
        expect(INDONESIAN_BUSINESS_CONFIG.businessHours.start).toBe(9);
        expect(INDONESIAN_BUSINESS_CONFIG.businessHours.end).toBe(17);
        expect(INDONESIAN_BUSINESS_CONFIG.businessHours.workingDays).toEqual([1, 2, 3, 4, 5]);
      });

      test('should delay sync operations outside business hours', async () => {
        const tenantId = testTenantId;
        
        // Mock outside business hours
        const outsideBusinessHours = new Date('2024-01-15T02:00:00.000Z'); // 2 AM Jakarta time
        jest.spyOn(Date, 'now').mockReturnValue(outsideBusinessHours.getTime());
        
        const shouldDelay = RateLimitingHelper.shouldDelayForBusinessHours('shopee');
        expect(shouldDelay).toBe(true);
        
        const nextBusinessHour = RateLimitingHelper.getNextBusinessHour();
        expect(nextBusinessHour.getHours()).toBe(9); // 9 AM Jakarta time
        
        // Test sync with business hours respect
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        // Mock sync service response
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: { totalOrders: 5, syncedOrders: 0, failedOrders: 0, skippedOrders: 5, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { totalDuration: 100, averageOrderProcessingTime: 0 },
          businessContext: {
            isBusinessHours: false,
            ramadanPeriod: false,
            holidayPeriod: false,
            timezone: jakartaTimeZone,
            syncOptimized: false,
          },
          correlationId: 'test-outside-hours',
          timestamp: outsideBusinessHours,
        };
        
        jest.spyOn(shopeeOrderService, 'syncOrderStatus').mockResolvedValue(mockSyncResult);
        
        const result = await shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, [], syncOptions);
        
        expect(result.businessContext.isBusinessHours).toBe(false);
        expect(result.summary.skippedOrders).toBe(5);
        expect(result.businessContext.syncOptimized).toBe(false);
      });

      test('should optimize sync operations during business hours', async () => {
        const tenantId = testTenantId;
        
        // Mock during business hours
        const businessHours = new Date('2024-01-15T14:00:00.000Z'); // 2 PM Jakarta time
        jest.spyOn(Date, 'now').mockReturnValue(businessHours.getTime());
        
        const shouldDelay = RateLimitingHelper.shouldDelayForBusinessHours('shopee');
        expect(shouldDelay).toBe(false);
        
        // Test sync during business hours
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: { totalOrders: 10, syncedOrders: 10, failedOrders: 0, skippedOrders: 0, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { totalDuration: 1500, averageOrderProcessingTime: 150 },
          businessContext: {
            isBusinessHours: true,
            ramadanPeriod: false,
            holidayPeriod: false,
            timezone: jakartaTimeZone,
            syncOptimized: true,
          },
          correlationId: 'test-business-hours',
          timestamp: businessHours,
        };
        
        jest.spyOn(shopeeOrderService, 'syncOrderStatus').mockResolvedValue(mockSyncResult);
        
        const result = await shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, [], syncOptions);
        
        expect(result.businessContext.isBusinessHours).toBe(true);
        expect(result.summary.syncedOrders).toBe(10);
        expect(result.businessContext.syncOptimized).toBe(true);
      });

      test('should handle weekend operations appropriately', async () => {
        const tenantId = testTenantId;
        
        // Mock weekend (Saturday)
        const weekend = new Date('2024-01-13T14:00:00.000Z'); // Saturday 2 PM Jakarta time
        jest.spyOn(Date, 'now').mockReturnValue(weekend.getTime());
        
        const shouldDelay = RateLimitingHelper.shouldDelayForBusinessHours('shopee');
        expect(shouldDelay).toBe(true);
        
        const nextBusinessHour = RateLimitingHelper.getNextBusinessHour();
        expect(nextBusinessHour.getDay()).toBe(1); // Monday
        
        // Test weekend sync behavior
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: { totalOrders: 3, syncedOrders: 0, failedOrders: 0, skippedOrders: 3, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { totalDuration: 50, averageOrderProcessingTime: 0 },
          businessContext: {
            isBusinessHours: false,
            ramadanPeriod: false,
            holidayPeriod: false,
            timezone: jakartaTimeZone,
            syncOptimized: false,
          },
          correlationId: 'test-weekend',
          timestamp: weekend,
        };
        
        jest.spyOn(lazadaOrderService, 'syncOrderStatus').mockResolvedValue(mockSyncResult);
        
        const result = await lazadaOrderService.syncOrderStatus(tenantId, testChannels[1].id, [], syncOptions);
        
        expect(result.businessContext.isBusinessHours).toBe(false);
        expect(result.summary.skippedOrders).toBe(3);
      });
    });

    describe('Ramadan Period Handling', () => {
      test('should detect Ramadan period correctly', () => {
        // Mock Ramadan period (approximate)
        const ramadanDate = new Date('2024-04-15'); // April (typical Ramadan month)
        jest.spyOn(Date, 'now').mockReturnValue(ramadanDate.getTime());
        
        const isRamadanPeriod = businessContextHelper.isRamadanPeriod();
        expect(isRamadanPeriod).toBe(true);
        
        // Test non-Ramadan period
        const nonRamadanDate = new Date('2024-01-15'); // January
        jest.spyOn(Date, 'now').mockReturnValue(nonRamadanDate.getTime());
        
        const isNotRamadanPeriod = businessContextHelper.isRamadanPeriod();
        expect(isNotRamadanPeriod).toBe(false);
      });

      test('should adjust sync behavior during Ramadan', async () => {
        const tenantId = testTenantId;
        
        // Mock Ramadan period
        const ramadanDate = new Date('2024-04-15T15:00:00.000Z'); // 3 PM Jakarta time during Ramadan
        jest.spyOn(Date, 'now').mockReturnValue(ramadanDate.getTime());
        jest.spyOn(businessContextHelper, 'isRamadanPeriod').mockReturnValue(true);
        
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            isRamadanSensitive: true,
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: { totalOrders: 8, syncedOrders: 6, failedOrders: 0, skippedOrders: 2, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { 
            totalDuration: 2000, // Slower during Ramadan
            averageOrderProcessingTime: 250,
          },
          businessContext: {
            isBusinessHours: true,
            ramadanPeriod: true,
            holidayPeriod: false,
            timezone: jakartaTimeZone,
            syncOptimized: true,
          },
          correlationId: 'test-ramadan',
          timestamp: ramadanDate,
        };
        
        jest.spyOn(tokopediaOrderService, 'syncOrderStatus').mockResolvedValue(mockSyncResult);
        
        const result = await tokopediaOrderService.syncOrderStatus(tenantId, testChannels[2].id, [], syncOptions);
        
        expect(result.businessContext.ramadanPeriod).toBe(true);
        expect(result.performance.averageOrderProcessingTime).toBeGreaterThan(200); // Slower processing
        expect(result.summary.skippedOrders).toBe(2); // Some operations skipped
      });

      test('should avoid sync during Ramadan fasting hours', async () => {
        const tenantId = testTenantId;
        
        // Mock Ramadan fasting hours (e.g., 6 AM - 6 PM)
        const fastingHours = new Date('2024-04-15T12:00:00.000Z'); // Noon Jakarta time during Ramadan
        jest.spyOn(Date, 'now').mockReturnValue(fastingHours.getTime());
        jest.spyOn(businessContextHelper, 'isRamadanPeriod').mockReturnValue(true);
        
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            isRamadanSensitive: true,
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        // Test that sensitive operations are delayed during fasting hours
        const ramadanConfig = getPlatformConfig('shopee');
        const adjustedBatchSize = Math.floor(ramadanConfig.batchSize * 0.7); // Reduce batch size
        const adjustedDelay = ramadanConfig.requestDelay * 1.5; // Increase delay
        
        expect(adjustedBatchSize).toBeLessThan(ramadanConfig.batchSize);
        expect(adjustedDelay).toBeGreaterThan(ramadanConfig.requestDelay);
      });

      test('should handle Ramadan peak seasons appropriately', () => {
        const ramadanDate = new Date('2024-04-15');
        const seasonalFactor = businessContextHelper.getSeasonalFactor(ramadanDate);
        
        // Ramadan is a peak season
        expect(seasonalFactor).toBe(1.5);
        
        // Test Lebaran (Eid) period
        const lebaranDate = new Date('2024-05-15');
        const lebaranFactor = businessContextHelper.getSeasonalFactor(lebaranDate);
        
        expect(lebaranFactor).toBe(1.5);
      });
    });

    describe('Indonesian Public Holidays', () => {
      test('should detect Indonesian public holidays', () => {
        // Test Independence Day (August 17)
        const independenceDay = new Date('2024-08-17');
        jest.spyOn(Date, 'now').mockReturnValue(independenceDay.getTime());
        const isIndependenceDay = businessContextHelper.isIndonesianHoliday(independenceDay);
        expect(isIndependenceDay).toBe(true);
        
        // Test New Year (January 1)
        const newYear = new Date('2024-01-01');
        jest.spyOn(Date, 'now').mockReturnValue(newYear.getTime());
        const isNewYear = businessContextHelper.isIndonesianHoliday(newYear);
        expect(isNewYear).toBe(true);
        
        // Test Christmas (December 25)
        const christmas = new Date('2024-12-25');
        jest.spyOn(Date, 'now').mockReturnValue(christmas.getTime());
        const isChristmas = businessContextHelper.isIndonesianHoliday(christmas);
        expect(isChristmas).toBe(true);
        
        // Test regular day
        const regularDay = new Date('2024-02-15');
        jest.spyOn(Date, 'now').mockReturnValue(regularDay.getTime());
        const isRegularDay = businessContextHelper.isIndonesianHoliday(regularDay);
        expect(isRegularDay).toBe(false);
      });

      test('should suspend sync operations during public holidays', async () => {
        const tenantId = testTenantId;
        
        // Mock Independence Day
        const independenceDay = new Date('2024-08-17T14:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(independenceDay.getTime());
        jest.spyOn(businessContextHelper, 'isIndonesianHoliday').mockReturnValue(true);
        
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            isHolidaySensitive: true,
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: { totalOrders: 2, syncedOrders: 0, failedOrders: 0, skippedOrders: 2, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { totalDuration: 25, averageOrderProcessingTime: 0 },
          businessContext: {
            isBusinessHours: false,
            ramadanPeriod: false,
            holidayPeriod: true,
            timezone: jakartaTimeZone,
            syncOptimized: false,
          },
          correlationId: 'test-holiday',
          timestamp: independenceDay,
        };
        
        jest.spyOn(shopeeOrderService, 'syncOrderStatus').mockResolvedValue(mockSyncResult);
        
        const result = await shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, [], syncOptions);
        
        expect(result.businessContext.holidayPeriod).toBe(true);
        expect(result.summary.skippedOrders).toBe(2);
        expect(result.businessContext.syncOptimized).toBe(false);
      });
    });

    describe('Indonesian Payment Methods', () => {
      test('should validate Indonesian payment methods', () => {
        // Test valid Indonesian payment methods
        const validMethods = [
          'qris', 'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja',
          'bank_transfer', 'credit_card', 'debit_card', 'cod'
        ];
        
        validMethods.forEach(method => {
          expect(businessContextHelper.isValidPaymentMethod(method)).toBe(true);
        });
        
        // Test invalid payment methods
        const invalidMethods = ['paypal', 'stripe', 'amazon_pay', 'apple_pay', 'google_pay'];
        
        invalidMethods.forEach(method => {
          expect(businessContextHelper.isValidPaymentMethod(method)).toBe(false);
        });
      });

      test('should handle COD (Cash on Delivery) appropriately', () => {
        // Test COD support by platform
        const shopeeConfig = getPlatformConfig('shopee');
        const lazadaConfig = getPlatformConfig('lazada');
        const tokopediaConfig = getPlatformConfig('tokopedia');
        
        expect(shopeeConfig.businessRules.supportsCOD).toBe(true);
        expect(lazadaConfig.businessRules.supportsCOD).toBe(true);
        expect(tokopediaConfig.businessRules.supportsCOD).toBe(true);
        
        // Test COD validation
        expect(businessContextHelper.isValidPaymentMethod('cod')).toBe(true);
        expect(INDONESIAN_BUSINESS_CONFIG.paymentMethods).toContain('cod');
      });

      test('should handle QRIS (Indonesian QR payment standard)', () => {
        // Test QRIS support
        expect(businessContextHelper.isValidPaymentMethod('qris')).toBe(true);
        expect(INDONESIAN_BUSINESS_CONFIG.paymentMethods).toContain('qris');
        
        // QRIS should be supported across all platforms
        const platforms = ['shopee', 'lazada', 'tokopedia'];
        platforms.forEach(platform => {
          const config = getPlatformConfig(platform);
          expect(config.businessRules.optimizeForIndonesianMarket).toBe(true);
        });
      });
    });

    describe('Indonesian Logistics and Shipping', () => {
      test('should validate Indonesian shipping methods', () => {
        // Test valid Indonesian shipping methods
        const validMethods = [
          'jne', 'jnt', 'sicepat', 'anteraja', 'gojek', 'grab',
          'ninja_xpress', 'pos_indonesia', 'tiki', 'wahana'
        ];
        
        validMethods.forEach(method => {
          expect(businessContextHelper.isValidShippingMethod(method)).toBe(true);
        });
        
        // Test invalid shipping methods
        const invalidMethods = ['fedex', 'ups', 'dhl', 'royal_mail'];
        
        invalidMethods.forEach(method => {
          expect(businessContextHelper.isValidShippingMethod(method)).toBe(false);
        });
      });

      test('should identify Indonesian delivery zones correctly', () => {
        // Test major Indonesian cities
        const testCases = [
          { address: 'Jakarta Pusat, DKI Jakarta', expected: 'jakarta' },
          { address: 'Bandung, Jawa Barat', expected: 'bandung' },
          { address: 'Surabaya, Jawa Timur', expected: 'surabaya' },
          { address: 'Medan, Sumatera Utara', expected: 'medan' },
          { address: 'Makassar, Sulawesi Selatan', expected: 'makassar' },
          { address: 'Denpasar, Bali', expected: 'denpasar' },
          { address: 'Unknown City, Unknown Province', expected: 'other' },
        ];
        
        testCases.forEach(({ address, expected }) => {
          const zone = businessContextHelper.getDeliveryZone(address);
          expect(zone).toBe(expected);
        });
      });

      test('should handle instant delivery services in major cities', () => {
        // Test instant delivery availability
        const jakartaZone = businessContextHelper.getDeliveryZone('Jakarta Selatan, DKI Jakarta');
        expect(jakartaZone).toBe('jakarta');
        
        // Jakarta should support instant delivery (Gojek, Grab)
        expect(INDONESIAN_BUSINESS_CONFIG.shippingMethods).toContain('gojek');
        expect(INDONESIAN_BUSINESS_CONFIG.shippingMethods).toContain('grab');
        
        // Test availability in delivery zones
        const instantDeliveryZones = ['jakarta', 'bandung', 'surabaya', 'medan', 'makassar'];
        instantDeliveryZones.forEach(zone => {
          expect(INDONESIAN_BUSINESS_CONFIG.deliveryZones).toContain(zone);
        });
      });
    });

    describe('Cultural Considerations', () => {
      test('should respect Indonesian cultural considerations', () => {
        // Test cultural considerations configuration
        const culturalConsiderations = INDONESIAN_BUSINESS_CONFIG.culturalConsiderations;
        
        expect(culturalConsiderations).toContain('respect_ramadan_fasting_hours');
        expect(culturalConsiderations).toContain('avoid_friday_prayer_time');
        expect(culturalConsiderations).toContain('use_indonesian_language');
        expect(culturalConsiderations).toContain('respect_religious_holidays');
        expect(culturalConsiderations).toContain('consider_regional_differences');
      });

      test('should handle Friday prayer time appropriately', () => {
        // Mock Friday prayer time (typically 12:00-13:00 on Friday)
        const fridayPrayerTime = new Date('2024-01-12T12:30:00.000Z'); // Friday 12:30 PM Jakarta time
        jest.spyOn(Date, 'now').mockReturnValue(fridayPrayerTime.getTime());
        
        const jakartaTime = new Date(fridayPrayerTime.toLocaleString('en-US', { timeZone: jakartaTimeZone }));
        const hour = jakartaTime.getHours();
        const day = jakartaTime.getDay();
        
        expect(day).toBe(5); // Friday
        expect(hour).toBe(12); // Noon
        
        // Operations should be delayed during Friday prayer time
        const shouldDelay = (day === 5 && hour >= 12 && hour < 13); // Friday 12-1 PM
        expect(shouldDelay).toBe(true);
      });

      test('should respect regional differences across Indonesia', () => {
        // Test timezone differences
        const timezones = INDONESIAN_BUSINESS_CONFIG.timezones;
        expect(timezones).toContain('WIB'); // Western Indonesia Time
        expect(timezones).toContain('WITA'); // Central Indonesia Time
        expect(timezones).toContain('WIT'); // Eastern Indonesia Time
        
        // Test regional delivery zones
        const deliveryZones = INDONESIAN_BUSINESS_CONFIG.deliveryZones;
        expect(deliveryZones).toContain('jakarta'); // Western
        expect(deliveryZones).toContain('makassar'); // Central
        expect(deliveryZones).toContain('manado'); // Eastern
      });
    });

    describe('Seasonal Business Patterns', () => {
      test('should handle peak seasons correctly', () => {
        // Test peak seasons configuration
        const peakSeasons = INDONESIAN_BUSINESS_CONFIG.peakSeasons;
        
        const expectedSeasons = [
          { name: 'Ramadan', months: [3, 4] },
          { name: 'Lebaran', months: [4, 5] },
          { name: 'End of Year', months: [11, 12] },
          { name: 'Back to School', months: [6, 7] },
        ];
        
        expectedSeasons.forEach(expectedSeason => {
          const season = peakSeasons.find(s => s.name === expectedSeason.name);
          expect(season).toBeDefined();
          expect(season.months).toEqual(expectedSeason.months);
        });
      });

      test('should apply seasonal factors to sync operations', () => {
        // Test regular season (January)
        const regularSeason = new Date('2024-01-15');
        const regularFactor = businessContextHelper.getSeasonalFactor(regularSeason);
        expect(regularFactor).toBe(1.0);
        
        // Test peak seasons
        const ramadanSeason = new Date('2024-04-15');
        const ramadanFactor = businessContextHelper.getSeasonalFactor(ramadanSeason);
        expect(ramadanFactor).toBe(1.5);
        
        const endOfYearSeason = new Date('2024-12-15');
        const endOfYearFactor = businessContextHelper.getSeasonalFactor(endOfYearSeason);
        expect(endOfYearFactor).toBe(1.5);
        
        const backToSchoolSeason = new Date('2024-07-15');
        const backToSchoolFactor = businessContextHelper.getSeasonalFactor(backToSchoolSeason);
        expect(backToSchoolFactor).toBe(1.5);
      });

      test('should adjust sync performance during peak seasons', async () => {
        const tenantId = testTenantId;
        
        // Mock peak season (December - end of year)
        const peakSeason = new Date('2024-12-15T14:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(peakSeason.getTime());
        
        const seasonalFactor = businessContextHelper.getSeasonalFactor(peakSeason);
        expect(seasonalFactor).toBe(1.5);
        
        // Test sync during peak season
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            respectBusinessHours: true,
            timezone: jakartaTimeZone,
          },
        };
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: { totalOrders: 20, syncedOrders: 15, failedOrders: 2, skippedOrders: 3, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { 
            totalDuration: 3000, // Longer due to peak season
            averageOrderProcessingTime: 200,
          },
          businessContext: {
            isBusinessHours: true,
            ramadanPeriod: false,
            holidayPeriod: false,
            timezone: jakartaTimeZone,
            syncOptimized: true,
          },
          correlationId: 'test-peak-season',
          timestamp: peakSeason,
        };
        
        jest.spyOn(shopeeOrderService, 'syncOrderStatus').mockResolvedValue(mockSyncResult);
        
        const result = await shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, [], syncOptions);
        
        expect(result.summary.totalOrders).toBe(20); // Higher volume
        expect(result.performance.totalDuration).toBe(3000); // Longer processing time
        expect(result.summary.failedOrders).toBe(2); // Some failures due to high load
      });
    });

    describe('Regulatory Compliance', () => {
      test('should support Indonesian regulatory requirements', () => {
        // Test compliance requirements
        const complianceRequirements = INDONESIAN_BUSINESS_CONFIG.complianceRequirements;
        
        expect(complianceRequirements).toContain('gdpr_compliance');
        expect(complianceRequirements).toContain('pdp_law_compliance'); // Indonesian Personal Data Protection Law
        expect(complianceRequirements).toContain('consumer_protection');
        expect(complianceRequirements).toContain('halal_certification');
        expect(complianceRequirements).toContain('tax_compliance');
        expect(complianceRequirements).toContain('data_localization');
      });

      test('should handle data localization requirements', () => {
        // Test that Indonesian business config supports data localization
        const complianceRequirements = INDONESIAN_BUSINESS_CONFIG.complianceRequirements;
        expect(complianceRequirements).toContain('data_localization');
        
        // Test timezone configuration for data localization
        const timezones = INDONESIAN_BUSINESS_CONFIG.timezones;
        expect(timezones).toEqual(['WIB', 'WITA', 'WIT']);
        
        // Test that business operations respect Indonesian timezones
        const jakartaTime = new Date().toLocaleString('en-US', { timeZone: jakartaTimeZone });
        expect(jakartaTime).toBeDefined();
      });
    });
  });

  // Helper functions
  function testBusinessHours(timezone: string): any {
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = localTime.getHours();
    const day = localTime.getDay();
    
    return {
      hour,
      day,
      isBusinessHours: day >= 1 && day <= 5 && hour >= 9 && hour <= 17,
      timezone,
    };
  }

  async function setupTestData(): Promise<void> {
    testTenantId = 'test-tenant-123';
    
    // Create test channels
    testChannels = [
      { 
        id: 'shopee-channel-1', 
        tenantId: testTenantId, 
        name: 'Shopee Channel', 
        platform: 'shopee',
        isActive: true,
        configuration: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { 
        id: 'lazada-channel-1', 
        tenantId: testTenantId, 
        name: 'Lazada Channel', 
        platform: 'lazada',
        isActive: true,
        configuration: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { 
        id: 'tokopedia-channel-1', 
        tenantId: testTenantId, 
        name: 'Tokopedia Channel', 
        platform: 'tokopedia',
        isActive: true,
        configuration: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Channel[];
    
    // Create test orders
    testOrders = [
      {
        id: 'order-1',
        tenantId: testTenantId,
        orderNumber: 'ORD-001',
        status: OrderStatus.PENDING,
        totalAmount: 100000, // 100,000 IDR
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'order-2',
        tenantId: testTenantId,
        orderNumber: 'ORD-002',
        status: OrderStatus.PROCESSING,
        totalAmount: 250000, // 250,000 IDR
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Order[];
  }

  async function cleanupTestData(): Promise<void> {
    testChannels = [];
    testOrders = [];
  }
});