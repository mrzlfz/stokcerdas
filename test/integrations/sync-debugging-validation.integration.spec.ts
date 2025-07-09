import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

// Core entities
import { Order, OrderStatus } from '../../src/orders/entities/order.entity';
import { Channel } from '../../src/channels/entities/channel.entity';
import { ChannelMapping } from '../../src/channels/entities/channel-mapping.entity';
import { Product } from '../../src/products/entities/product.entity';
import { IntegrationLog } from '../../src/integrations/entities/integration-log.entity';

// Services
import { SyncValidationService } from '../../src/integrations/common/services/sync-validation.service';
import { IntegrationLogService } from '../../src/integrations/common/services/integration-log.service';
import { ErrorHandlingService } from '../../src/integrations/common/services/error-handling.service';
import { SyncMonitoringService } from '../../src/common/services/sync-monitoring.service';

// Platform services
import { ShopeeOrderService } from '../../src/integrations/shopee/services/shopee-order.service';
import { LazadaOrderService } from '../../src/integrations/lazada/services/lazada-order.service';
import { TokopediaOrderService } from '../../src/integrations/tokopedia/services/tokopedia-order.service';

// Interfaces and types
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SyncValidationOptions,
  BusinessContextValidation,
  PlatformValidationResult,
} from '../../src/integrations/common/services/sync-validation.service';

import {
  StandardSyncResult,
  StandardConflictObject,
  ConflictType,
  ConflictResolution,
  OrderSyncOptions,
} from '../../src/integrations/common/interfaces/order-sync.interface';

import {
  getPlatformConfig,
  IndonesianBusinessHelper,
} from '../../src/integrations/common/config/platform-sync.config';

import { 
  IntegrationLogType, 
  IntegrationLogLevel 
} from '../../src/integrations/entities/integration-log.entity';

/**
 * COMPREHENSIVE SYNC DEBUGGING AND VALIDATION INTEGRATION TESTS
 * 
 * These tests validate the debugging and error validation capabilities
 * of the multi-channel order synchronization system with Indonesian business context.
 * 
 * Test Coverage:
 * - Pre-sync validation with comprehensive error detection
 * - Post-sync validation with result verification
 * - Indonesian business context validation
 * - Platform configuration validation
 * - Data integrity checks
 * - Performance validation
 * - Security validation
 * - Conflict resolution validation
 * - Error classification and handling
 * - Performance monitoring and analysis
 * - Health check validation
 * - Comprehensive error reporting
 * - Recommendation generation
 * - Real-world error scenarios
 * - Edge case handling
 */

describe('Sync Debugging and Validation Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  
  // Core services
  let syncValidationService: SyncValidationService;
  let integrationLogService: IntegrationLogService;
  let errorHandlingService: ErrorHandlingService;
  let syncMonitoringService: SyncMonitoringService;
  
  // Platform services
  let shopeeOrderService: ShopeeOrderService;
  let lazadaOrderService: LazadaOrderService;
  let tokopediaOrderService: TokopediaOrderService;
  
  // Repositories
  let orderRepository: Repository<Order>;
  let channelRepository: Repository<Channel>;
  let channelMappingRepository: Repository<ChannelMapping>;
  let productRepository: Repository<Product>;
  let integrationLogRepository: Repository<IntegrationLog>;
  
  // Test data
  let testTenantId: string;
  let testChannels: Channel[];
  let testOrders: Order[];
  let testProducts: Product[];
  let testChannelMappings: ChannelMapping[];
  
  // Mock event emitter
  let mockEventEmitter: EventEmitter2;

  beforeAll(async () => {
    // Setup test module
    const testModule = await Test.createTestingModule({
      providers: [
        // Core services
        SyncValidationService,
        IntegrationLogService,
        ErrorHandlingService,
        SyncMonitoringService,
        
        // Platform services
        ShopeeOrderService,
        LazadaOrderService,
        TokopediaOrderService,
        
        // Repositories
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Channel),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ChannelMapping),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(IntegrationLog),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
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
                'VALIDATION_ENABLED': 'true',
                'STRICT_VALIDATION': 'true',
                'INDONESIAN_BUSINESS_CONTEXT': 'true',
                'DEBUG_MODE': 'true',
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
    syncValidationService = module.get<SyncValidationService>(SyncValidationService);
    integrationLogService = module.get<IntegrationLogService>(IntegrationLogService);
    errorHandlingService = module.get<ErrorHandlingService>(ErrorHandlingService);
    syncMonitoringService = module.get<SyncMonitoringService>(SyncMonitoringService);
    
    shopeeOrderService = module.get<ShopeeOrderService>(ShopeeOrderService);
    lazadaOrderService = module.get<LazadaOrderService>(LazadaOrderService);
    tokopediaOrderService = module.get<TokopediaOrderService>(TokopediaOrderService);
    
    // Initialize repositories
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    channelRepository = module.get<Repository<Channel>>(getRepositoryToken(Channel));
    channelMappingRepository = module.get<Repository<ChannelMapping>>(getRepositoryToken(ChannelMapping));
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
    integrationLogRepository = module.get<Repository<IntegrationLog>>(getRepositoryToken(IntegrationLog));
    
    // Initialize event emitter
    mockEventEmitter = module.get<EventEmitter2>(EventEmitter2);
    
    await app.init();
    
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    setupRepositoryMocks();
  });

  describe('Phase 3.6.5: Debugging and Error Validation Tests', () => {
    
    describe('Pre-Sync Validation', () => {
      test('should validate successful pre-sync conditions', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const orderIds = testOrders.map(order => order.id);
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
          validatePlatformConfig: true,
          validateData: true,
          validatePerformance: true,
          validateSecurity: true,
          platforms: ['shopee'],
          businessRules: {
            respectBusinessHours: true,
            ramadanSensitive: true,
            holidaySensitive: true,
          },
        };
        
        // Mock successful validation conditions
        setupSuccessfulValidationMocks();
        
        // Test pre-sync validation
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.businessContext).toBeDefined();
        expect(result.businessContext.timezone).toBe('Asia/Jakarta');
        expect(result.businessContext.complianceChecks.pdpCompliance).toBe(true);
        expect(result.platformValidation).toHaveLength(1);
        expect(result.platformValidation[0].platformId).toBe('shopee');
        expect(result.platformValidation[0].isValid).toBe(true);
        expect(result.performance).toBeDefined();
        expect(result.performance.totalChecks).toBeGreaterThan(0);
        expect(result.performance.passedChecks).toBeGreaterThan(0);
        expect(result.performance.failedChecks).toBe(0);
        expect(result.recommendations).toHaveLength(0);
        
        // Verify logging
        expect(integrationLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            channelId,
            type: IntegrationLogType.VALIDATION,
            level: IntegrationLogLevel.INFO,
            message: 'pre_sync validation passed',
          })
        );
        
        // Verify event emission
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          'sync.validation.completed',
          expect.objectContaining({
            tenantId,
            channelId,
            type: 'pre_sync',
            result: expect.objectContaining({
              isValid: true,
            }),
          })
        );
      });

      test('should detect and report critical pre-sync errors', async () => {
        const tenantId = testTenantId;
        const channelId = 'non-existent-channel';
        const orderIds = ['non-existent-order'];
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
          validatePlatformConfig: true,
          validateData: true,
          validatePerformance: true,
          validateSecurity: true,
        };
        
        // Mock error conditions
        setupErrorValidationMocks();
        
        // Test pre-sync validation with errors
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Check for specific error types
        const channelError = result.errors.find(e => e.code === 'CHANNEL_NOT_FOUND');
        expect(channelError).toBeDefined();
        expect(channelError.severity).toBe('critical');
        expect(channelError.category).toBe('data');
        expect(channelError.field).toBe('channelId');
        expect(channelError.value).toBe(channelId);
        
        const orderError = result.errors.find(e => e.code === 'ORDERS_NOT_FOUND');
        expect(orderError).toBeDefined();
        expect(orderError.severity).toBe('high');
        expect(orderError.category).toBe('data');
        expect(orderError.field).toBe('orderIds');
        
        // Verify performance metrics
        expect(result.performance).toBeDefined();
        expect(result.performance.failedChecks).toBe(result.errors.length);
        
        // Verify recommendations
        expect(result.recommendations).toContain('Address critical errors before proceeding with sync operation');
        
        // Verify error logging
        expect(integrationLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            channelId,
            type: IntegrationLogType.VALIDATION,
            level: IntegrationLogLevel.ERROR,
            message: 'pre_sync validation failed',
          })
        );
      });

      test('should validate Indonesian business context thoroughly', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const orderIds = testOrders.map(order => order.id);
        
        // Mock Ramadan period
        const ramadanDate = new Date('2024-04-15T14:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(ramadanDate.getTime());
        jest.spyOn(IndonesianBusinessHelper, 'isRamadanPeriod').mockReturnValue(true);
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
          businessRules: {
            respectBusinessHours: true,
            ramadanSensitive: true,
            holidaySensitive: true,
          },
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test business context validation
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        expect(result.businessContext).toBeDefined();
        expect(result.businessContext.isRamadanPeriod).toBe(true);
        expect(result.businessContext.timezone).toBe('Asia/Jakarta');
        expect(result.businessContext.seasonalFactor).toBe(1.5);
        expect(result.businessContext.culturalConsiderations).toContain('respect_ramadan_fasting_hours');
        expect(result.businessContext.complianceChecks.pdpCompliance).toBe(true);
        expect(result.businessContext.complianceChecks.dataLocalization).toBe(true);
        
        // Verify Indonesian business context is considered in validation
        expect(result.warnings.some(w => w.indonesianContext)).toBe(false); // No Indonesian context warnings
      });

      test('should validate platform configurations comprehensively', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const orderIds = testOrders.map(order => order.id);
        
        const validationOptions: SyncValidationOptions = {
          validatePlatformConfig: true,
          platforms: ['shopee', 'lazada', 'tokopedia'],
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test platform configuration validation
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        expect(result.platformValidation).toHaveLength(1);
        
        const platformValidation = result.platformValidation[0];
        expect(platformValidation.platformId).toBe('shopee');
        expect(platformValidation.isValid).toBe(true);
        expect(platformValidation.configuration.rateLimits).toBe(true);
        expect(platformValidation.configuration.authentication).toBe(true);
        expect(platformValidation.configuration.businessRules).toBe(true);
        expect(platformValidation.configuration.errorHandling).toBe(true);
        
        // Verify platform-specific Indonesian market optimization
        const shopeeConfig = getPlatformConfig('shopee');
        expect(shopeeConfig.businessRules.optimizeForIndonesianMarket).toBe(true);
        expect(shopeeConfig.businessRules.supportsCOD).toBe(true);
        expect(shopeeConfig.businessRules.respectBusinessHours).toBe(true);
      });

      test('should validate data integrity thoroughly', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const orderIds = testOrders.map(order => order.id);
        
        const validationOptions: SyncValidationOptions = {
          validateData: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test data integrity validation
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        
        // Verify repository calls for data validation
        expect(orderRepository.find).toHaveBeenCalledWith({
          where: { 
            id: expect.any(Object), // In clause
            tenantId,
            deletedAt: null,
          },
        });
        
        expect(channelRepository.findOne).toHaveBeenCalledWith({
          where: { id: channelId, tenantId },
        });
        
        expect(channelMappingRepository.find).toHaveBeenCalledWith({
          where: {
            channelId,
            tenantId,
            localId: expect.any(Object), // In clause
          },
        });
      });

      test('should validate performance constraints', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const largeOrderBatch = Array.from({ length: 100 }, (_, i) => `order-${i}`);
        
        const validationOptions: SyncValidationOptions = {
          validatePerformance: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test performance validation with large batch
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          largeOrderBatch,
          validationOptions
        );
        
        // Should have warnings about batch size
        const batchSizeWarning = result.warnings.find(w => w.code === 'BATCH_SIZE_EXCEEDED');
        expect(batchSizeWarning).toBeDefined();
        expect(batchSizeWarning.category).toBe('performance');
        expect(batchSizeWarning.recommendation).toContain('Split into smaller batches');
        
        // Should have warnings about sync duration
        const durationWarning = result.warnings.find(w => w.code === 'SYNC_DURATION_HIGH');
        expect(durationWarning).toBeDefined();
        expect(durationWarning.category).toBe('performance');
        expect(durationWarning.recommendation).toContain('Consider reducing batch size');
      });

      test('should validate security requirements', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const orderIds = testOrders.map(order => order.id);
        
        const validationOptions: SyncValidationOptions = {
          validateSecurity: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test security validation
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        
        // Should have Indonesian data protection warning
        const dataProtectionWarning = result.warnings.find(w => w.code === 'DATA_PROTECTION_COMPLIANCE');
        expect(dataProtectionWarning).toBeDefined();
        expect(dataProtectionWarning.category).toBe('data');
        expect(dataProtectionWarning.indonesianContext).toBe(true);
        expect(dataProtectionWarning.recommendation).toContain('Indonesian Personal Data Protection Law');
      });

      test('should handle validation system errors gracefully', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        const orderIds = testOrders.map(order => order.id);
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
        };
        
        // Mock system error
        jest.spyOn(IndonesianBusinessHelper, 'isRamadanPeriod').mockImplementation(() => {
          throw new Error('System error in business context validation');
        });
        
        // Test validation with system error
        const result = await syncValidationService.validatePreSync(
          tenantId,
          channelId,
          orderIds,
          validationOptions
        );
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        const systemError = result.errors.find(e => e.code === 'VALIDATION_SYSTEM_ERROR');
        expect(systemError).toBeDefined();
        expect(systemError.severity).toBe('critical');
        expect(systemError.category).toBe('platform');
        expect(systemError.message).toContain('System error in business context validation');
      });
    });

    describe('Post-Sync Validation', () => {
      test('should validate successful post-sync results', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: {
            totalOrders: 10,
            syncedOrders: 9,
            failedOrders: 1,
            skippedOrders: 0,
            conflictedOrders: 0,
          },
          orders: {
            synced: [
              {
                orderId: 'order-1',
                externalOrderId: 'shopee-123',
                localStatus: OrderStatus.PROCESSING,
                externalStatus: 'confirmed',
                platformId: 'shopee',
                syncDirection: 'bidirectional',
                syncedAt: new Date(),
              },
            ],
            failed: [
              {
                orderId: 'order-2',
                externalOrderId: 'shopee-456',
                error: 'Network timeout',
                errorCode: 'NETWORK_ERROR',
                retryable: true,
                platformId: 'shopee',
              },
            ],
            skipped: [],
          },
          conflicts: [],
          performance: {
            totalDuration: 5000,
            averageOrderProcessingTime: 500,
            apiCallCount: 20,
            rateLimitHits: 0,
            retryCount: 2,
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
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
          validateData: true,
          validatePerformance: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test post-sync validation
        const result = await syncValidationService.validatePostSync(
          tenantId,
          channelId,
          mockSyncResult,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.businessContext).toBeDefined();
        expect(result.businessContext.timezone).toBe('Asia/Jakarta');
        expect(result.performance).toBeDefined();
        expect(result.performance.totalChecks).toBeGreaterThan(0);
        expect(result.performance.passedChecks).toBeGreaterThan(0);
        expect(result.performance.failedChecks).toBe(0);
        
        // Verify post-sync specific recommendations
        expect(result.recommendations).toHaveLength(0); // No issues, no recommendations
        
        // Verify logging
        expect(integrationLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            channelId,
            type: IntegrationLogType.VALIDATION,
            level: IntegrationLogLevel.INFO,
            message: 'post_sync validation passed',
          })
        );
      });

      test('should validate sync result structure thoroughly', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        // Create invalid sync result
        const invalidSyncResult: any = {
          success: 'true', // Should be boolean
          summary: {
            totalOrders: 10,
            syncedOrders: 5,
            failedOrders: 2,
            skippedOrders: 2,
            // Missing conflictedOrders
          },
          orders: {
            synced: [],
            failed: [],
            skipped: [],
          },
          conflicts: [],
          performance: {
            totalDuration: 5000,
            averageOrderProcessingTime: 500,
            apiCallCount: 20,
            rateLimitHits: 0,
            retryCount: 2,
            circuitBreakerTriggered: false,
          },
          // Missing businessContext
          correlationId: 'test-correlation-id',
          timestamp: new Date(),
        };
        
        const validationOptions: SyncValidationOptions = {
          validateData: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test structure validation
        const result = await syncValidationService.validatePostSync(
          tenantId,
          channelId,
          invalidSyncResult,
          validationOptions
        );
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Check for specific structure errors
        const successFieldError = result.errors.find(e => e.code === 'SYNC_RESULT_MISSING_SUCCESS');
        expect(successFieldError).toBeDefined();
        expect(successFieldError.severity).toBe('high');
        expect(successFieldError.category).toBe('data');
        expect(successFieldError.field).toBe('success');
        
        // Check for warnings
        const businessContextWarning = result.warnings.find(w => w.code === 'SYNC_RESULT_MISSING_BUSINESS_CONTEXT');
        expect(businessContextWarning).toBeDefined();
        expect(businessContextWarning.category).toBe('business');
        expect(businessContextWarning.indonesianContext).toBe(true);
      });

      test('should validate sync performance metrics', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        const slowSyncResult: StandardSyncResult = {
          success: true,
          summary: {
            totalOrders: 5,
            syncedOrders: 5,
            failedOrders: 0,
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
            totalDuration: 45000, // 45 seconds - very slow
            averageOrderProcessingTime: 9000, // 9 seconds per order - very slow
            apiCallCount: 50,
            rateLimitHits: 5, // Rate limit hits
            retryCount: 10,
            circuitBreakerTriggered: true, // Circuit breaker triggered
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
        
        const validationOptions: SyncValidationOptions = {
          validatePerformance: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test performance validation
        const result = await syncValidationService.validatePostSync(
          tenantId,
          channelId,
          slowSyncResult,
          validationOptions
        );
        
        expect(result.isValid).toBe(true); // Performance issues are warnings, not errors
        expect(result.warnings.length).toBeGreaterThan(0);
        
        // Check for specific performance warnings
        const slowSyncWarning = result.warnings.find(w => w.code === 'SYNC_PERFORMANCE_SLOW');
        expect(slowSyncWarning).toBeDefined();
        expect(slowSyncWarning.category).toBe('performance');
        expect(slowSyncWarning.recommendation).toContain('Optimize sync operation');
        
        const slowProcessingWarning = result.warnings.find(w => w.code === 'SYNC_PERFORMANCE_ORDER_PROCESSING_SLOW');
        expect(slowProcessingWarning).toBeDefined();
        expect(slowProcessingWarning.category).toBe('performance');
        expect(slowProcessingWarning.recommendation).toContain('Optimize order processing logic');
        
        const rateLimitWarning = result.warnings.find(w => w.code === 'SYNC_PERFORMANCE_RATE_LIMIT_HITS');
        expect(rateLimitWarning).toBeDefined();
        expect(rateLimitWarning.category).toBe('performance');
        expect(rateLimitWarning.recommendation).toContain('better rate limiting strategy');
        
        const circuitBreakerWarning = result.warnings.find(w => w.code === 'SYNC_PERFORMANCE_CIRCUIT_BREAKER');
        expect(circuitBreakerWarning).toBeDefined();
        expect(circuitBreakerWarning.category).toBe('performance');
        expect(circuitBreakerWarning.recommendation).toContain('Investigate underlying issues');
      });

      test('should validate conflict resolution thoroughly', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        const conflictSyncResult: StandardSyncResult = {
          success: true,
          summary: {
            totalOrders: 3,
            syncedOrders: 1,
            failedOrders: 0,
            skippedOrders: 0,
            conflictedOrders: 2,
          },
          orders: {
            synced: [],
            failed: [],
            skipped: [],
          },
          conflicts: [
            {
              orderId: 'order-1',
              externalOrderId: 'shopee-123',
              localStatus: OrderStatus.PROCESSING,
              externalStatus: 'shipped',
              platformId: 'shopee',
              conflictType: ConflictType.STATUS_MISMATCH,
              resolution: ConflictResolution.PLATFORM_WINS,
              resolutionStrategy: 'Platform status takes precedence',
              businessImpact: {
                critical: true,
                customerFacing: true,
                affectsShipping: true,
                affectsPayment: false,
              },
              indonesianContext: {
                isDuringBusinessHours: true,
                requiresImmediateAttention: true,
                culturalConsiderations: ['customer_notification'],
              },
            },
            {
              orderId: 'order-2',
              externalOrderId: 'shopee-456',
              localStatus: OrderStatus.DELIVERED,
              externalStatus: 'cancelled',
              platformId: 'shopee',
              conflictType: ConflictType.STATUS_MISMATCH,
              resolution: ConflictResolution.DEFER,
              resolutionStrategy: 'Defer critical conflict for manual review',
              businessImpact: {
                critical: true,
                customerFacing: true,
                affectsShipping: true,
                affectsPayment: true,
              },
              // Missing indonesianContext
            },
          ],
          performance: {
            totalDuration: 5000,
            averageOrderProcessingTime: 500,
            apiCallCount: 20,
            rateLimitHits: 0,
            retryCount: 2,
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
        
        const validationOptions: SyncValidationOptions = {
          validateData: true,
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test conflict resolution validation
        const result = await syncValidationService.validatePostSync(
          tenantId,
          channelId,
          conflictSyncResult,
          validationOptions
        );
        
        expect(result.isValid).toBe(true); // Conflicts are warnings, not errors
        expect(result.warnings.length).toBeGreaterThan(0);
        
        // Check for specific conflict warnings
        const indonesianContextWarning = result.warnings.find(w => w.code === 'CONFLICT_MISSING_INDONESIAN_CONTEXT');
        expect(indonesianContextWarning).toBeDefined();
        expect(indonesianContextWarning.category).toBe('business');
        expect(indonesianContextWarning.indonesianContext).toBe(true);
        
        const criticalConflictWarning = result.warnings.find(w => w.code === 'CRITICAL_CONFLICT_DEFERRED');
        expect(criticalConflictWarning).toBeDefined();
        expect(criticalConflictWarning.category).toBe('business');
        expect(criticalConflictWarning.recommendation).toContain('Critical conflicts should be resolved immediately');
      });

      test('should validate Indonesian business rules in sync results', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        // Mock Ramadan period
        const ramadanDate = new Date('2024-04-15T14:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(ramadanDate.getTime());
        jest.spyOn(IndonesianBusinessHelper, 'isRamadanPeriod').mockReturnValue(true);
        
        const ramadanSyncResult: StandardSyncResult = {
          success: true,
          summary: {
            totalOrders: 5,
            syncedOrders: 5,
            failedOrders: 0,
            skippedOrders: 0,
            conflictedOrders: 0,
          },
          orders: {
            synced: [
              {
                orderId: 'order-1',
                externalOrderId: 'shopee-123',
                localStatus: OrderStatus.PROCESSING,
                externalStatus: 'confirmed',
                platformId: 'shopee',
                syncDirection: 'bidirectional',
                syncedAt: new Date(),
              },
            ],
            failed: [],
            skipped: [],
          },
          conflicts: [],
          performance: {
            totalDuration: 5000,
            averageOrderProcessingTime: 500,
            apiCallCount: 20,
            rateLimitHits: 0,
            retryCount: 2,
            circuitBreakerTriggered: false,
          },
          businessContext: {
            isBusinessHours: true,
            ramadanPeriod: true,
            holidayPeriod: false,
            timezone: 'Asia/Jakarta',
            syncOptimized: false, // Not optimized during Ramadan
          },
          correlationId: 'test-correlation-id',
          timestamp: new Date(),
        };
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
          businessRules: {
            ramadanSensitive: true,
          },
        };
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test Indonesian business rules validation
        const result = await syncValidationService.validatePostSync(
          tenantId,
          channelId,
          ramadanSyncResult,
          validationOptions
        );
        
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        
        // Check for Ramadan-specific warnings
        const ramadanOptimizationWarning = result.warnings.find(w => w.code === 'RAMADAN_SYNC_NOT_OPTIMIZED');
        expect(ramadanOptimizationWarning).toBeDefined();
        expect(ramadanOptimizationWarning.category).toBe('business');
        expect(ramadanOptimizationWarning.indonesianContext).toBe(true);
        expect(ramadanOptimizationWarning.recommendation).toContain('Optimize sync operations during Ramadan');
      });

      test('should handle post-sync validation system errors gracefully', async () => {
        const tenantId = testTenantId;
        const channelId = testChannels[0].id;
        
        const mockSyncResult: StandardSyncResult = {
          success: true,
          summary: {
            totalOrders: 5,
            syncedOrders: 5,
            failedOrders: 0,
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
            totalDuration: 5000,
            averageOrderProcessingTime: 500,
            apiCallCount: 20,
            rateLimitHits: 0,
            retryCount: 2,
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
        
        const validationOptions: SyncValidationOptions = {
          validateBusinessContext: true,
        };
        
        // Mock system error
        jest.spyOn(IndonesianBusinessHelper, 'isIndonesianHoliday').mockImplementation(() => {
          throw new Error('System error in holiday validation');
        });
        
        // Test validation with system error
        const result = await syncValidationService.validatePostSync(
          tenantId,
          channelId,
          mockSyncResult,
          validationOptions
        );
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        const systemError = result.errors.find(e => e.code === 'VALIDATION_SYSTEM_ERROR');
        expect(systemError).toBeDefined();
        expect(systemError.severity).toBe('critical');
        expect(systemError.category).toBe('platform');
        expect(systemError.message).toContain('System error in holiday validation');
      });
    });

    describe('Health Check Validation', () => {
      test('should provide comprehensive health check', async () => {
        const tenantId = testTenantId;
        
        // Mock successful conditions
        setupSuccessfulValidationMocks();
        
        // Test health check
        const healthCheck = await syncValidationService.getValidationHealthCheck(tenantId);
        
        expect(healthCheck.healthy).toBe(true);
        expect(healthCheck.validationServices).toBeDefined();
        expect(healthCheck.validationServices.businessContext).toBe(true);
        expect(healthCheck.validationServices.platformConfig).toBe(true);
        expect(healthCheck.validationServices.dataIntegrity).toBe(true);
        expect(healthCheck.validationServices.performance).toBe(true);
        expect(healthCheck.validationServices.security).toBe(true);
        
        expect(healthCheck.platformValidation).toBeDefined();
        expect(healthCheck.platformValidation.shopee).toBe(true);
        expect(healthCheck.platformValidation.lazada).toBe(true);
        expect(healthCheck.platformValidation.tokopedia).toBe(true);
        
        expect(healthCheck.businessContext).toBe(true);
        expect(healthCheck.recommendations).toHaveLength(0);
      });

      test('should detect unhealthy conditions in health check', async () => {
        const tenantId = testTenantId;
        
        // Mock unhealthy conditions
        setupErrorValidationMocks();
        
        // Test health check with errors
        const healthCheck = await syncValidationService.getValidationHealthCheck(tenantId);
        
        expect(healthCheck.healthy).toBe(false);
        expect(healthCheck.recommendations.length).toBeGreaterThan(0);
        expect(healthCheck.recommendations).toContain('Address validation service issues for optimal sync performance');
      });
    });
  });

  // Helper functions
  function setupSuccessfulValidationMocks(): void {
    // Mock successful order repository calls
    (orderRepository.find as jest.Mock).mockResolvedValue(testOrders);
    
    // Mock successful channel repository calls
    (channelRepository.findOne as jest.Mock).mockResolvedValue(testChannels[0]);
    
    // Mock successful channel mapping repository calls
    (channelMappingRepository.find as jest.Mock).mockResolvedValue(testChannelMappings);
    
    // Mock successful integration log repository calls
    (integrationLogRepository.count as jest.Mock).mockResolvedValue(2);
    
    // Mock successful integration log service
    (integrationLogService.log as jest.Mock).mockResolvedValue(undefined);
  }

  function setupErrorValidationMocks(): void {
    // Mock failed order repository calls
    (orderRepository.find as jest.Mock).mockResolvedValue([]); // No orders found
    
    // Mock failed channel repository calls
    (channelRepository.findOne as jest.Mock).mockResolvedValue(null); // Channel not found
    
    // Mock failed channel mapping repository calls
    (channelMappingRepository.find as jest.Mock).mockResolvedValue([]); // No mappings found
    
    // Mock high load
    (integrationLogRepository.count as jest.Mock).mockResolvedValue(15); // High load
    
    // Mock successful integration log service
    (integrationLogService.log as jest.Mock).mockResolvedValue(undefined);
  }

  function setupRepositoryMocks(): void {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default successful mocks
    setupSuccessfulValidationMocks();
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
        status: OrderStatus.PROCESSING,
        totalAmount: 100000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'order-2',
        tenantId: testTenantId,
        orderNumber: 'ORD-002',
        status: OrderStatus.SHIPPED,
        totalAmount: 250000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Order[];
    
    // Create test products
    testProducts = [
      {
        id: 'product-1',
        tenantId: testTenantId,
        name: 'Test Product 1',
        sku: 'SKU-001',
        price: 50000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'product-2',
        tenantId: testTenantId,
        name: 'Test Product 2',
        sku: 'SKU-002',
        price: 100000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Product[];
    
    // Create test channel mappings
    testChannelMappings = [
      {
        id: 'mapping-1',
        tenantId: testTenantId,
        channelId: 'shopee-channel-1',
        localId: 'order-1',
        externalId: 'shopee-123',
        entityType: 'order',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mapping-2',
        tenantId: testTenantId,
        channelId: 'shopee-channel-1',
        localId: 'order-2',
        externalId: 'shopee-456',
        entityType: 'order',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as ChannelMapping[];
  }

  async function cleanupTestData(): Promise<void> {
    testChannels = [];
    testOrders = [];
    testProducts = [];
    testChannelMappings = [];
  }
});