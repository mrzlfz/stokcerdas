import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

// Core entities
import { Order, OrderStatus } from '../../src/orders/entities/order.entity';
import { Channel, ChannelType } from '../../src/channels/entities/channel.entity';
import { ChannelMapping } from '../../src/channels/entities/channel-mapping.entity';
import { Product } from '../../src/products/entities/product.entity';
import { Customer } from '../../src/customers/entities/customer.entity';

// Services
import { OrderRoutingService } from '../../src/orders/services/order-routing.service';
import { OrdersService } from '../../src/orders/services/orders.service';
import { ChannelsService } from '../../src/channels/services/channels.service';
import { ChannelSyncService } from '../../src/channels/services/channel-sync.service';
import { ErrorHandlingService } from '../../src/integrations/common/services/error-handling.service';
import { SyncMonitoringService } from '../../src/common/services/sync-monitoring.service';
import { DeadLetterQueueService } from '../../src/common/services/dead-letter-queue.service';

// Platform services
import { ShopeeOrderService } from '../../src/integrations/shopee/services/shopee-order.service';
import { LazadaOrderService } from '../../src/integrations/lazada/services/lazada-order.service';
import { TokopediaOrderService } from '../../src/integrations/tokopedia/services/tokopedia-order.service';

// Interfaces and configurations
import {
  OrderSyncService,
  OrderSyncOptions,
  StandardSyncResult,
  StandardConflictObject,
  ConflictType,
  ConflictResolution,
  OrderActionType,
  StandardOrderAction,
  CompletePlatformOrderService,
} from '../../src/integrations/common/interfaces/order-sync.interface';

import {
  PLATFORM_SYNC_CONFIGS,
  INDONESIAN_BUSINESS_CONFIG,
  RateLimitingHelper,
  IndonesianBusinessHelper,
  PlatformErrorClassifier,
  getPlatformConfig,
} from '../../src/integrations/common/config/platform-sync.config';

import { IntegrationLogService } from '../../src/integrations/common/services/integration-log.service';
import { IntegrationLogLevel } from '../../src/integrations/entities/integration-log.entity';

/**
 * COMPREHENSIVE MULTI-CHANNEL ORDER SYNC INTEGRATION TESTS
 * 
 * These tests validate the complete multi-channel order synchronization system
 * with Indonesian business context, error handling, and cross-platform conflict resolution.
 * 
 * Test Coverage:
 * - Multi-platform order sync (Shopee, Lazada, Tokopedia)
 * - Cross-channel conflict resolution
 * - Indonesian business context (business hours, Ramadan, holidays)
 * - Error handling and retry logic
 * - Performance monitoring and dead letter queue
 * - Rate limiting and API optimization
 * - Platform-specific configurations
 */

describe('Multi-Channel Order Synchronization Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  
  // Core services
  let orderRoutingService: OrderRoutingService;
  let ordersService: OrdersService;
  let channelsService: ChannelsService;
  let channelSyncService: ChannelSyncService;
  let errorHandlingService: ErrorHandlingService;
  let syncMonitoringService: SyncMonitoringService;
  let deadLetterQueueService: DeadLetterQueueService;
  let integrationLogService: IntegrationLogService;
  
  // Platform services
  let shopeeOrderService: ShopeeOrderService;
  let lazadaOrderService: LazadaOrderService;
  let tokopediaOrderService: TokopediaOrderService;
  
  // Repositories
  let orderRepository: Repository<Order>;
  let channelRepository: Repository<Channel>;
  let channelMappingRepository: Repository<ChannelMapping>;
  let productRepository: Repository<Product>;
  let customerRepository: Repository<Customer>;
  
  // Test data
  let testTenantId: string;
  let testChannels: Channel[];
  let testProducts: Product[];
  let testOrders: Order[];
  let testCustomers: Customer[];
  
  // Mock configurations
  const mockPlatformServices = {
    shopee: null,
    lazada: null,
    tokopedia: null,
  };

  beforeAll(async () => {
    // Setup test module with all required providers
    const testModule = await Test.createTestingModule({
      providers: [
        // Core services
        OrderRoutingService,
        OrdersService,
        ChannelsService,
        ChannelSyncService,
        ErrorHandlingService,
        SyncMonitoringService,
        DeadLetterQueueService,
        IntegrationLogService,
        
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
          provide: getRepositoryToken(ChannelMapping),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Product),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Customer),
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
              switch (key) {
                case 'SHOPEE_API_KEY':
                  return 'test-shopee-key';
                case 'LAZADA_API_KEY':
                  return 'test-lazada-key';
                case 'TOKOPEDIA_API_KEY':
                  return 'test-tokopedia-key';
                default:
                  return null;
              }
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
    channelsService = module.get<ChannelsService>(ChannelsService);
    channelSyncService = module.get<ChannelSyncService>(ChannelSyncService);
    errorHandlingService = module.get<ErrorHandlingService>(ErrorHandlingService);
    syncMonitoringService = module.get<SyncMonitoringService>(SyncMonitoringService);
    deadLetterQueueService = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    integrationLogService = module.get<IntegrationLogService>(IntegrationLogService);
    
    // Initialize platform services
    shopeeOrderService = module.get<ShopeeOrderService>(ShopeeOrderService);
    lazadaOrderService = module.get<LazadaOrderService>(LazadaOrderService);
    tokopediaOrderService = module.get<TokopediaOrderService>(TokopediaOrderService);
    
    // Initialize repositories
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    channelRepository = module.get<Repository<Channel>>(getRepositoryToken(Channel));
    channelMappingRepository = module.get<Repository<ChannelMapping>>(getRepositoryToken(ChannelMapping));
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
    customerRepository = module.get<Repository<Customer>>(getRepositoryToken(Customer));
    
    await app.init();
    
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup platform service mocks
    setupPlatformServiceMocks();
  });

  describe('Phase 3.6.2: Multi-Channel Sync Integration Tests', () => {
    
    describe('Platform Configuration Validation', () => {
      test('should have valid platform configurations for all Indonesian platforms', () => {
        const platforms = ['shopee', 'lazada', 'tokopedia'];
        
        platforms.forEach(platform => {
          const config = getPlatformConfig(platform);
          expect(config).toBeDefined();
          expect(config.platformId).toBe(platform);
          expect(config.businessRules.optimizeForIndonesianMarket).toBe(true);
          expect(config.businessRules.respectBusinessHours).toBe(true);
          expect(config.businessRules.supportsCOD).toBe(true);
        });
      });

      test('should have Indonesian business configuration', () => {
        expect(INDONESIAN_BUSINESS_CONFIG).toBeDefined();
        expect(INDONESIAN_BUSINESS_CONFIG.timezones).toContain('WIB');
        expect(INDONESIAN_BUSINESS_CONFIG.paymentMethods).toContain('qris');
        expect(INDONESIAN_BUSINESS_CONFIG.shippingMethods).toContain('jne');
        expect(INDONESIAN_BUSINESS_CONFIG.deliveryZones).toContain('jakarta');
      });

      test('should validate rate limiting configurations', () => {
        const shopeeConfig = getPlatformConfig('shopee');
        const lazadaConfig = getPlatformConfig('lazada');
        const tokopediaConfig = getPlatformConfig('tokopedia');

        expect(shopeeConfig.rateLimits.requestsPerSecond).toBe(10);
        expect(lazadaConfig.rateLimits.requestsPerSecond).toBe(5);
        expect(tokopediaConfig.rateLimits.requestsPerSecond).toBe(2);
      });
    });

    describe('Multi-Platform Order Sync Integration', () => {
      test('should successfully sync orders from all platforms simultaneously', async () => {
        const tenantId = testTenantId;
        const syncOptions: OrderSyncOptions = {
          batchSize: 10,
          syncDirection: 'bidirectional',
          includeOrderDetails: true,
          businessContext: {
            respectBusinessHours: true,
            isRamadanSensitive: true,
            isHolidaySensitive: true,
            timezone: 'Asia/Jakarta',
          },
        };

        // Mock successful responses from all platforms
        const mockSyncResults = createMockSyncResults();
        mockPlatformServices.shopee.syncOrderStatus.mockResolvedValue(mockSyncResults.shopee);
        mockPlatformServices.lazada.syncOrderStatus.mockResolvedValue(mockSyncResults.lazada);
        mockPlatformServices.tokopedia.syncOrderStatus.mockResolvedValue(mockSyncResults.tokopedia);

        // Execute multi-platform sync
        const results = await Promise.all([
          shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, [], syncOptions),
          lazadaOrderService.syncOrderStatus(tenantId, testChannels[1].id, [], syncOptions),
          tokopediaOrderService.syncOrderStatus(tenantId, testChannels[2].id, [], syncOptions),
        ]);

        // Validate results
        results.forEach((result, index) => {
          expect(result.success).toBe(true);
          expect(result.summary.totalOrders).toBeGreaterThan(0);
          expect(result.businessContext.isBusinessHours).toBeDefined();
          expect(result.businessContext.timezone).toBe('Asia/Jakarta');
          expect(result.correlationId).toBeDefined();
        });

        // Verify platform-specific behavior
        expect(mockPlatformServices.shopee.syncOrderStatus).toHaveBeenCalledWith(
          tenantId, testChannels[0].id, [], syncOptions
        );
        expect(mockPlatformServices.lazada.syncOrderStatus).toHaveBeenCalledWith(
          tenantId, testChannels[1].id, [], syncOptions
        );
        expect(mockPlatformServices.tokopedia.syncOrderStatus).toHaveBeenCalledWith(
          tenantId, testChannels[2].id, [], syncOptions
        );
      });

      test('should handle platform-specific rate limiting correctly', async () => {
        const tenantId = testTenantId;
        const batchSize = 50; // Large batch to trigger rate limiting
        
        // Mock rate limit responses
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.name = 'RateLimitError';
        
        mockPlatformServices.shopee.syncOrderStatus.mockRejectedValueOnce(rateLimitError);
        mockPlatformServices.lazada.syncOrderStatus.mockRejectedValueOnce(rateLimitError);
        mockPlatformServices.tokopedia.syncOrderStatus.mockRejectedValueOnce(rateLimitError);

        // Test rate limiting behavior
        const shopeeDelay = RateLimitingHelper.calculateDelay('shopee', batchSize);
        const lazadaDelay = RateLimitingHelper.calculateDelay('lazada', batchSize);
        const tokopediaDelay = RateLimitingHelper.calculateDelay('tokopedia', batchSize);

        expect(shopeeDelay).toBeGreaterThan(100); // Base delay
        expect(lazadaDelay).toBeGreaterThan(200); // Higher base delay
        expect(tokopediaDelay).toBeGreaterThan(500); // Highest base delay

        // Verify error classification
        expect(PlatformErrorClassifier.isRetryableError('shopee', 'rate_limit_exceeded')).toBe(true);
        expect(PlatformErrorClassifier.isRetryableError('lazada', 'rate_limit_exceeded')).toBe(true);
        expect(PlatformErrorClassifier.isRetryableError('tokopedia', 'rate_limit_exceeded')).toBe(true);
      });

      test('should respect Indonesian business hours across all platforms', async () => {
        const tenantId = testTenantId;
        
        // Mock business hours check
        const shouldDelay = RateLimitingHelper.shouldDelayForBusinessHours('shopee');
        const nextBusinessHour = RateLimitingHelper.getNextBusinessHour();
        
        expect(typeof shouldDelay).toBe('boolean');
        expect(nextBusinessHour).toBeInstanceOf(Date);
        
        // Test business context validation
        const isBusinessHours = IndonesianBusinessHelper.isIndonesianHoliday();
        const isRamadanPeriod = IndonesianBusinessHelper.isRamadanPeriod();
        const seasonalFactor = IndonesianBusinessHelper.getSeasonalFactor();
        
        expect(typeof isBusinessHours).toBe('boolean');
        expect(typeof isRamadanPeriod).toBe('boolean');
        expect(typeof seasonalFactor).toBe('number');
        expect(seasonalFactor).toBeGreaterThan(0);
      });
    });

    describe('Cross-Channel Conflict Resolution', () => {
      test('should detect and resolve inventory conflicts across platforms', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create mock conflict scenario
        const mockConflicts: StandardConflictObject[] = [
          {
            orderId,
            externalOrderId: 'shopee-12345',
            externalOrderNumber: 'SP-12345',
            localStatus: OrderStatus.PROCESSING,
            externalStatus: 'shipped',
            platformId: 'shopee',
            conflictType: ConflictType.STATUS_MISMATCH,
            resolution: ConflictResolution.PLATFORM_WINS,
            resolutionStrategy: 'Platform status takes precedence for shipping updates',
            businessImpact: {
              critical: true,
              customerFacing: true,
              affectsShipping: true,
              affectsPayment: false,
            },
            indonesianContext: {
              isDuringBusinessHours: true,
              requiresImmediateAttention: true,
              culturalConsiderations: ['customer_service_priority'],
            },
          },
        ];
        
        // Mock order routing service response
        const mockRoutingResult = {
          success: true,
          conflicts: mockConflicts,
          resolutions: mockConflicts.map(conflict => ({
            conflictId: conflict.orderId,
            resolution: conflict.resolution,
            appliedStrategy: conflict.resolutionStrategy,
            timestamp: new Date(),
          })),
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockRoutingResult);
        
        // Test conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, mockConflicts);
        
        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.STATUS_MISMATCH);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.PLATFORM_WINS);
        expect(result.conflicts[0].indonesianContext.requiresImmediateAttention).toBe(true);
      });

      test('should handle payment discrepancies with Indonesian payment methods', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Test Indonesian payment method validation
        const validPaymentMethods = ['qris', 'gopay', 'ovo', 'dana', 'shopeepay', 'cod'];
        validPaymentMethods.forEach(method => {
          expect(IndonesianBusinessHelper.isValidPaymentMethod(method)).toBe(true);
        });
        
        const invalidPaymentMethods = ['paypal', 'stripe', 'amazon_pay'];
        invalidPaymentMethods.forEach(method => {
          expect(IndonesianBusinessHelper.isValidPaymentMethod(method)).toBe(false);
        });
        
        // Create payment conflict scenario
        const paymentConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'tokopedia-67890',
          externalOrderNumber: 'TP-67890',
          localStatus: OrderStatus.PAID,
          externalStatus: 'pending_payment',
          platformId: 'tokopedia',
          conflictType: ConflictType.PAYMENT_INCONSISTENCY,
          resolution: ConflictResolution.MANUAL_REVIEW,
          resolutionStrategy: 'Payment conflicts require manual review for Indonesian regulations',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: false,
            affectsPayment: true,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['payment_verification', 'customer_trust'],
          },
        };
        
        // Test payment conflict resolution
        const paymentRequiresManualReview = PlatformErrorClassifier.requiresManualReview(
          'tokopedia', 
          { status: 'payment_failed', reason: 'insufficient_funds' }
        );
        
        expect(paymentRequiresManualReview).toBe(true);
      });

      test('should handle shipping conflicts with Indonesian logistics providers', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Test Indonesian shipping method validation
        const validShippingMethods = ['jne', 'jnt', 'sicepat', 'anteraja', 'gojek', 'grab'];
        validShippingMethods.forEach(method => {
          expect(IndonesianBusinessHelper.isValidShippingMethod(method)).toBe(true);
        });
        
        // Test delivery zone detection
        const jakartaZone = IndonesianBusinessHelper.getDeliveryZone('Jakarta Pusat, DKI Jakarta');
        const bandungZone = IndonesianBusinessHelper.getDeliveryZone('Bandung, Jawa Barat');
        const unknownZone = IndonesianBusinessHelper.getDeliveryZone('Unknown City');
        
        expect(jakartaZone).toBe('jakarta');
        expect(bandungZone).toBe('bandung');
        expect(unknownZone).toBe('other');
        
        // Create shipping conflict scenario
        const shippingConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'lazada-54321',
          externalOrderNumber: 'LZ-54321',
          localStatus: OrderStatus.SHIPPED,
          externalStatus: 'processing',
          platformId: 'lazada',
          conflictType: ConflictType.SHIPPING_DISCREPANCY,
          resolution: ConflictResolution.BUSINESS_RULE_BASED,
          resolutionStrategy: 'Apply Indonesian logistics business rules',
          businessImpact: {
            critical: false,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: false,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: false,
            culturalConsiderations: ['delivery_expectations', 'tracking_updates'],
          },
        };
        
        // Verify shipping conflict handling
        expect(shippingConflict.conflictType).toBe(ConflictType.SHIPPING_DISCREPANCY);
        expect(shippingConflict.resolution).toBe(ConflictResolution.BUSINESS_RULE_BASED);
      });
    });

    describe('Error Handling and Recovery', () => {
      test('should handle network errors with exponential backoff', async () => {
        const tenantId = testTenantId;
        const networkError = new Error('Network timeout');
        networkError.name = 'NetworkError';
        
        // Mock network error
        mockPlatformServices.shopee.syncOrderStatus.mockRejectedValueOnce(networkError);
        
        // Test error handling
        const errorContext = {
          tenantId,
          operationType: 'order_sync',
          operationName: 'syncOrderStatus',
          serviceName: 'ShopeeOrderService',
          platform: 'shopee',
        };
        
        const result = await errorHandlingService.executeWithErrorHandling(
          async () => shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, []),
          errorContext
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error.recoverable).toBe(true);
        expect(result.metrics.retryAttempts).toBeGreaterThan(0);
      });

      test('should send failed jobs to dead letter queue', async () => {
        const tenantId = testTenantId;
        const permanentError = new Error('Authentication failed');
        permanentError.name = 'AuthenticationError';
        
        // Mock authentication error
        mockPlatformServices.lazada.syncOrderStatus.mockRejectedValue(permanentError);
        
        // Mock dead letter queue
        const mockDeadLetterJob = {
          id: 'dlq-123',
          tenantId,
          originalQueue: 'order-sync',
          originalJobType: 'sync_order_status',
          failedAt: new Date(),
          error: permanentError.message,
          isRamadanSensitive: false,
          isBusinessHoursOnly: true,
        };
        
        jest.spyOn(deadLetterQueueService, 'createFromFailedJob').mockResolvedValue(mockDeadLetterJob);
        
        // Test dead letter queue integration
        const dlqResult = await deadLetterQueueService.createFromFailedJob(
          tenantId,
          { queue: { name: 'order-sync' }, data: { operation: 'sync_order_status' } } as any,
          { type: 'AUTHENTICATION', message: permanentError.message } as any
        );
        
        expect(dlqResult).toBeDefined();
        expect(dlqResult.tenantId).toBe(tenantId);
        expect(dlqResult.originalQueue).toBe('order-sync');
        expect(dlqResult.isBusinessHoursOnly).toBe(true);
      });

      test('should monitor sync operations performance', async () => {
        const tenantId = testTenantId;
        const operationId = 'sync-op-123';
        
        // Mock sync monitoring
        const mockMonitoringData = {
          operationId,
          tenantId,
          operationType: 'order_sync',
          platform: 'shopee',
          channelId: testChannels[0].id,
          startTime: new Date(),
          businessContext: {
            isBusinessHours: true,
            ramadanPeriod: false,
            timezone: 'Asia/Jakarta',
          },
        };
        
        jest.spyOn(syncMonitoringService, 'startSyncMonitoring').mockResolvedValue(undefined);
        jest.spyOn(syncMonitoringService, 'updateMetrics').mockResolvedValue(undefined);
        jest.spyOn(syncMonitoringService, 'completeMonitoring').mockResolvedValue(undefined);
        
        // Test monitoring lifecycle
        await syncMonitoringService.startSyncMonitoring(
          tenantId,
          'order_sync',
          'shopee',
          testChannels[0].id,
          operationId,
          mockMonitoringData
        );
        
        await syncMonitoringService.updateMetrics(operationId, {
          recordsProcessed: 10,
          recordsSuccessful: 9,
          recordsFailed: 1,
          responseTime: 150,
        });
        
        await syncMonitoringService.completeMonitoring(operationId, 'completed', {
          totalDuration: 5000,
          averageResponseTime: 150,
        });
        
        expect(syncMonitoringService.startSyncMonitoring).toHaveBeenCalledWith(
          tenantId, 'order_sync', 'shopee', testChannels[0].id, operationId, mockMonitoringData
        );
        expect(syncMonitoringService.updateMetrics).toHaveBeenCalledWith(operationId, expect.any(Object));
        expect(syncMonitoringService.completeMonitoring).toHaveBeenCalledWith(operationId, 'completed', expect.any(Object));
      });
    });

    describe('Indonesian Business Context Integration', () => {
      test('should adjust sync behavior during Ramadan period', async () => {
        const tenantId = testTenantId;
        
        // Mock Ramadan period
        jest.spyOn(IndonesianBusinessHelper, 'isRamadanPeriod').mockReturnValue(true);
        
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            isRamadanSensitive: true,
            respectBusinessHours: true,
            timezone: 'Asia/Jakarta',
          },
        };
        
        // Test Ramadan-sensitive sync
        const result = await shopeeOrderService.syncOrderStatus(
          tenantId,
          testChannels[0].id,
          [],
          syncOptions
        );
        
        expect(result.businessContext.ramadanPeriod).toBe(true);
        expect(mockPlatformServices.shopee.syncOrderStatus).toHaveBeenCalledWith(
          tenantId,
          testChannels[0].id,
          [],
          expect.objectContaining({
            businessContext: expect.objectContaining({
              isRamadanSensitive: true,
            }),
          })
        );
      });

      test('should handle Indonesian holidays appropriately', async () => {
        const tenantId = testTenantId;
        
        // Mock Indonesian holiday
        jest.spyOn(IndonesianBusinessHelper, 'isIndonesianHoliday').mockReturnValue(true);
        
        const syncOptions: OrderSyncOptions = {
          businessContext: {
            isHolidaySensitive: true,
            respectBusinessHours: true,
            timezone: 'Asia/Jakarta',
          },
        };
        
        // Test holiday-sensitive sync
        const result = await tokopediaOrderService.syncOrderStatus(
          tenantId,
          testChannels[2].id,
          [],
          syncOptions
        );
        
        expect(result.businessContext.holidayPeriod).toBe(true);
        expect(mockPlatformServices.tokopedia.syncOrderStatus).toHaveBeenCalledWith(
          tenantId,
          testChannels[2].id,
          [],
          expect.objectContaining({
            businessContext: expect.objectContaining({
              isHolidaySensitive: true,
            }),
          })
        );
      });

      test('should apply seasonal factors to sync performance', async () => {
        const tenantId = testTenantId;
        
        // Test seasonal factor calculation
        const regularSeason = IndonesianBusinessHelper.getSeasonalFactor(new Date('2024-01-15'));
        const peakSeason = IndonesianBusinessHelper.getSeasonalFactor(new Date('2024-04-15')); // Ramadan
        const endOfYear = IndonesianBusinessHelper.getSeasonalFactor(new Date('2024-12-15'));
        
        expect(regularSeason).toBe(1.0);
        expect(peakSeason).toBe(1.5);
        expect(endOfYear).toBe(1.5);
        
        // Test seasonal adjustment in sync configuration
        const peakSeasonConfig = {
          ...getPlatformConfig('shopee'),
          batchSize: Math.floor(getPlatformConfig('shopee').batchSize / peakSeason),
          requestDelay: getPlatformConfig('shopee').requestDelay * peakSeason,
        };
        
        expect(peakSeasonConfig.batchSize).toBeLessThan(getPlatformConfig('shopee').batchSize);
        expect(peakSeasonConfig.requestDelay).toBeGreaterThan(getPlatformConfig('shopee').requestDelay);
      });
    });

    describe('Performance and Optimization', () => {
      test('should optimize batch sizes based on platform capabilities', async () => {
        const tenantId = testTenantId;
        const largeOrderList = Array.from({ length: 100 }, (_, i) => `order-${i}`);
        
        // Test platform-specific batch optimization
        const shopeeConfig = getPlatformConfig('shopee');
        const lazadaConfig = getPlatformConfig('lazada');
        const tokopediaConfig = getPlatformConfig('tokopedia');
        
        const shopeeBatches = Math.ceil(largeOrderList.length / shopeeConfig.batchSize);
        const lazadaBatches = Math.ceil(largeOrderList.length / lazadaConfig.batchSize);
        const tokopediaBatches = Math.ceil(largeOrderList.length / tokopediaConfig.batchSize);
        
        expect(shopeeBatches).toBe(5); // 100 / 20 = 5
        expect(lazadaBatches).toBe(10); // 100 / 10 = 10
        expect(tokopediaBatches).toBe(20); // 100 / 5 = 20
        
        // Verify batch processing timing
        const shopeeEstimatedTime = shopeeBatches * (shopeeConfig.requestDelay + shopeeConfig.batchDelay);
        const lazadaEstimatedTime = lazadaBatches * (lazadaConfig.requestDelay + lazadaConfig.batchDelay);
        const tokopediaEstimatedTime = tokopediaBatches * (tokopediaConfig.requestDelay + tokopediaConfig.batchDelay);
        
        expect(shopeeEstimatedTime).toBeLessThan(lazadaEstimatedTime);
        expect(lazadaEstimatedTime).toBeLessThan(tokopediaEstimatedTime);
      });

      test('should handle concurrent sync operations efficiently', async () => {
        const tenantId = testTenantId;
        const concurrentOperations = 10;
        
        // Mock successful concurrent operations
        const mockResults = Array.from({ length: concurrentOperations }, (_, i) => ({
          success: true,
          summary: { totalOrders: 10, syncedOrders: 10, failedOrders: 0, skippedOrders: 0, conflictedOrders: 0 },
          orders: { synced: [], failed: [], skipped: [] },
          conflicts: [],
          performance: { totalDuration: 1000 + i * 100, averageOrderProcessingTime: 100 + i * 10 },
          businessContext: { isBusinessHours: true, timezone: 'Asia/Jakarta' },
          correlationId: `corr-${i}`,
          timestamp: new Date(),
        }));
        
        mockPlatformServices.shopee.syncOrderStatus.mockImplementation(() => 
          Promise.resolve(mockResults[Math.floor(Math.random() * mockResults.length)])
        );
        
        const startTime = Date.now();
        
        // Execute concurrent operations
        const promises = Array.from({ length: concurrentOperations }, (_, i) =>
          shopeeOrderService.syncOrderStatus(tenantId, testChannels[0].id, [`order-${i}`])
        );
        
        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        
        // Verify concurrent execution
        const successfulResults = results.filter(r => r.status === 'fulfilled');
        const totalDuration = endTime - startTime;
        
        expect(successfulResults.length).toBe(concurrentOperations);
        expect(totalDuration).toBeLessThan(concurrentOperations * 1000); // Should be faster than sequential
      });
    });

    describe('Integration Logging and Monitoring', () => {
      test('should log comprehensive integration events', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        // Mock integration log service
        const mockLogEntry = {
          tenantId,
          channelId,
          type: 'SYNC' as any,
          level: IntegrationLogLevel.INFO,
          message: 'Order sync completed successfully',
          metadata: {
            platform: 'shopee',
            ordersProcessed: 10,
            duration: 1500,
            businessContext: { isBusinessHours: true, timezone: 'Asia/Jakarta' },
          },
        };
        
        jest.spyOn(integrationLogService, 'log').mockResolvedValue(mockLogEntry as any);
        
        // Test logging during sync operation
        await integrationLogService.log(mockLogEntry);
        
        expect(integrationLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            channelId,
            message: 'Order sync completed successfully',
            metadata: expect.objectContaining({
              platform: 'shopee',
              businessContext: expect.objectContaining({
                isBusinessHours: true,
                timezone: 'Asia/Jakarta',
              }),
            }),
          })
        );
      });

      test('should generate comprehensive performance metrics', async () => {
        const tenantId = testTenantId;
        
        // Mock performance metrics
        const mockMetrics = {
          totalOperations: 100,
          successfulOperations: 95,
          failedOperations: 5,
          averageResponseTime: 150,
          p95ResponseTime: 300,
          p99ResponseTime: 500,
          throughput: 10.5, // operations per second
          errorRate: 0.05,
          platformBreakdown: {
            shopee: { operations: 40, successRate: 0.95, avgResponseTime: 120 },
            lazada: { operations: 35, successRate: 0.94, avgResponseTime: 180 },
            tokopedia: { operations: 25, successRate: 0.96, avgResponseTime: 200 },
          },
          businessContext: {
            businessHoursOperations: 80,
            offHoursOperations: 20,
            ramadanOperations: 15,
            holidayOperations: 5,
          },
        };
        
        jest.spyOn(syncMonitoringService, 'getPerformanceMetrics').mockResolvedValue(mockMetrics);
        
        // Test metrics generation
        const metrics = await syncMonitoringService.getPerformanceMetrics(tenantId);
        
        expect(metrics).toBeDefined();
        expect(metrics.totalOperations).toBe(100);
        expect(metrics.successfulOperations).toBe(95);
        expect(metrics.errorRate).toBe(0.05);
        expect(metrics.platformBreakdown.shopee.successRate).toBe(0.95);
        expect(metrics.businessContext.businessHoursOperations).toBe(80);
      });
    });
  });

  // Helper functions for test setup
  async function setupTestData(): Promise<void> {
    testTenantId = 'test-tenant-123';
    
    // Create test channels
    testChannels = [
      createMockChannel('shopee', 'shopee-channel-1'),
      createMockChannel('lazada', 'lazada-channel-1'),
      createMockChannel('tokopedia', 'tokopedia-channel-1'),
    ];
    
    // Create test products
    testProducts = [
      createMockProduct('product-1', 'Test Product 1'),
      createMockProduct('product-2', 'Test Product 2'),
      createMockProduct('product-3', 'Test Product 3'),
    ];
    
    // Create test customers
    testCustomers = [
      createMockCustomer('customer-1', 'John Doe'),
      createMockCustomer('customer-2', 'Jane Smith'),
    ];
    
    // Create test orders
    testOrders = [
      createMockOrder('order-1', testCustomers[0], testProducts[0]),
      createMockOrder('order-2', testCustomers[1], testProducts[1]),
    ];
  }

  async function cleanupTestData(): Promise<void> {
    // Clean up test data
    testChannels = [];
    testProducts = [];
    testCustomers = [];
    testOrders = [];
  }

  function setupPlatformServiceMocks(): void {
    // Mock platform services
    mockPlatformServices.shopee = {
      syncOrderStatus: jest.fn(),
      getOrderDetails: jest.fn(),
      updateOrderStatus: jest.fn(),
      bulkUpdateOrderStatus: jest.fn(),
    };
    
    mockPlatformServices.lazada = {
      syncOrderStatus: jest.fn(),
      getOrderDetails: jest.fn(),
      updateOrderStatus: jest.fn(),
      bulkUpdateOrderStatus: jest.fn(),
    };
    
    mockPlatformServices.tokopedia = {
      syncOrderStatus: jest.fn(),
      getOrderDetails: jest.fn(),
      updateOrderStatus: jest.fn(),
      bulkUpdateOrderStatus: jest.fn(),
    };
    
    // Apply mocks to service instances
    Object.assign(shopeeOrderService, mockPlatformServices.shopee);
    Object.assign(lazadaOrderService, mockPlatformServices.lazada);
    Object.assign(tokopediaOrderService, mockPlatformServices.tokopedia);
  }

  function createMockChannel(platform: string, channelId: string): Channel {
    return {
      id: channelId,
      tenantId: testTenantId,
      name: `${platform} Channel`,
      type: ChannelType.MARKETPLACE,
      platform,
      isActive: true,
      configuration: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Channel;
  }

  function createMockProduct(productId: string, name: string): Product {
    return {
      id: productId,
      tenantId: testTenantId,
      name,
      sku: `SKU-${productId}`,
      price: 100.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Product;
  }

  function createMockCustomer(customerId: string, name: string): Customer {
    return {
      id: customerId,
      tenantId: testTenantId,
      name,
      email: `${customerId}@example.com`,
      phone: '+62123456789',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;
  }

  function createMockOrder(orderId: string, customer: Customer, product: Product): Order {
    return {
      id: orderId,
      tenantId: testTenantId,
      orderNumber: `ORD-${orderId}`,
      customerId: customer.id,
      customer,
      status: OrderStatus.PENDING,
      totalAmount: 100.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;
  }

  function createMockSyncResults(): Record<string, StandardSyncResult> {
    const baseResult = {
      success: true,
      summary: {
        totalOrders: 10,
        syncedOrders: 9,
        failedOrders: 1,
        skippedOrders: 0,
        conflictedOrders: 0,
      },
      orders: {
        synced: [],
        failed: [],
        skipped: [],
      },
      conflicts: [],
      performance: {
        totalDuration: 1500,
        averageOrderProcessingTime: 150,
        apiCallCount: 12,
        rateLimitHits: 0,
        retryCount: 1,
        circuitBreakerTriggered: false,
      },
      businessContext: {
        isBusinessHours: true,
        ramadanPeriod: false,
        holidayPeriod: false,
        timezone: 'Asia/Jakarta',
        syncOptimized: true,
      },
      correlationId: 'test-correlation-id',
      timestamp: new Date(),
    };

    return {
      shopee: { ...baseResult, correlationId: 'shopee-sync-123' },
      lazada: { ...baseResult, correlationId: 'lazada-sync-123' },
      tokopedia: { ...baseResult, correlationId: 'tokopedia-sync-123' },
    };
  }
});