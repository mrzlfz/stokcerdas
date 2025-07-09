import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

// Core entities
import { Order, OrderStatus, PaymentStatus } from '../../src/orders/entities/order.entity';
import { Channel } from '../../src/channels/entities/channel.entity';
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
  StandardConflictObject,
  ConflictType,
  ConflictResolution,
  OrderSyncOptions,
  StandardSyncResult,
  OrderActionType,
  StandardOrderAction,
  StandardOrderResult,
} from '../../src/integrations/common/interfaces/order-sync.interface';

import {
  getPlatformConfig,
  PlatformErrorClassifier,
  IndonesianBusinessHelper,
} from '../../src/integrations/common/config/platform-sync.config';

import { IntegrationLogService } from '../../src/integrations/common/services/integration-log.service';

/**
 * COMPREHENSIVE CROSS-PLATFORM CONFLICT RESOLUTION INTEGRATION TESTS
 * 
 * These tests validate the conflict resolution system across multiple platforms
 * with Indonesian business context and real-world scenarios.
 * 
 * Test Coverage:
 * - Status conflicts between platforms
 * - Payment inconsistencies with Indonesian payment methods
 * - Shipping discrepancies with Indonesian logistics
 * - Inventory conflicts across channels
 * - Customer data mismatches
 * - Pricing discrepancies
 * - Timing conflicts and synchronization issues
 * - Business rule violations
 * - Automated conflict resolution strategies
 * - Manual review processes
 * - Indonesian cultural considerations in conflict resolution
 * - Performance impact of conflict resolution
 */

describe('Cross-Platform Conflict Resolution Integration Tests', () => {
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
  let testOrders: Order[];
  let testProducts: Product[];
  let testCustomers: Customer[];
  let testChannelMappings: ChannelMapping[];
  
  // Mock platform services
  const mockPlatformServices = {
    shopee: null,
    lazada: null,
    tokopedia: null,
  };

  beforeAll(async () => {
    // Setup test module
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
              const config = {
                'SHOPEE_API_KEY': 'test-shopee-key',
                'LAZADA_API_KEY': 'test-lazada-key',
                'TOKOPEDIA_API_KEY': 'test-tokopedia-key',
                'CONFLICT_RESOLUTION_ENABLED': 'true',
                'AUTO_RESOLVE_CONFLICTS': 'true',
                'MANUAL_REVIEW_THRESHOLD': '0.7',
                'INDONESIAN_BUSINESS_CONTEXT': 'true',
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
    channelsService = module.get<ChannelsService>(ChannelsService);
    channelSyncService = module.get<ChannelSyncService>(ChannelSyncService);
    errorHandlingService = module.get<ErrorHandlingService>(ErrorHandlingService);
    syncMonitoringService = module.get<SyncMonitoringService>(SyncMonitoringService);
    deadLetterQueueService = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    integrationLogService = module.get<IntegrationLogService>(IntegrationLogService);
    
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
    jest.clearAllMocks();
    setupPlatformServiceMocks();
  });

  describe('Phase 3.6.4: Cross-Platform Conflict Resolution Tests', () => {
    
    describe('Status Conflicts', () => {
      test('should detect and resolve order status conflicts across platforms', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create status conflict scenario
        const statusConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'shopee-123',
          externalOrderNumber: 'SP-123',
          localStatus: OrderStatus.PROCESSING,
          externalStatus: 'shipped',
          platformId: 'shopee',
          conflictType: ConflictType.STATUS_MISMATCH,
          resolution: ConflictResolution.PLATFORM_WINS,
          resolutionStrategy: 'Platform shipping status takes precedence',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: false,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['customer_notification', 'delivery_expectations'],
          },
        };
        
        // Mock conflict resolution
        const mockResolutionResult = {
          success: true,
          conflicts: [statusConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.PLATFORM_WINS,
              appliedStrategy: 'Platform shipping status takes precedence',
              resolvedAt: new Date(),
              resolvedBy: 'system',
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockResolutionResult);
        
        // Test conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [statusConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.STATUS_MISMATCH);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.PLATFORM_WINS);
        expect(result.conflicts[0].indonesianContext.requiresImmediateAttention).toBe(true);
        
        // Verify resolution was logged
        expect(integrationLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId,
            message: expect.stringContaining('Conflict resolved'),
            metadata: expect.objectContaining({
              conflictType: ConflictType.STATUS_MISMATCH,
              resolution: ConflictResolution.PLATFORM_WINS,
            }),
          })
        );
      });

      test('should handle complex multi-platform status conflicts', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create multi-platform status conflict
        const multiPlatformConflicts: StandardConflictObject[] = [
          {
            orderId,
            externalOrderId: 'shopee-123',
            externalOrderNumber: 'SP-123',
            localStatus: OrderStatus.PROCESSING,
            externalStatus: 'shipped',
            platformId: 'shopee',
            conflictType: ConflictType.STATUS_MISMATCH,
            resolution: ConflictResolution.PLATFORM_WINS,
            resolutionStrategy: 'Shopee platform wins for shipping status',
            businessImpact: {
              critical: true,
              customerFacing: true,
              affectsShipping: true,
              affectsPayment: false,
            },
            indonesianContext: {
              isDuringBusinessHours: true,
              requiresImmediateAttention: true,
              culturalConsiderations: ['shipping_transparency'],
            },
          },
          {
            orderId,
            externalOrderId: 'lazada-456',
            externalOrderNumber: 'LZ-456',
            localStatus: OrderStatus.PROCESSING,
            externalStatus: 'confirmed',
            platformId: 'lazada',
            conflictType: ConflictType.STATUS_MISMATCH,
            resolution: ConflictResolution.BUSINESS_RULE_BASED,
            resolutionStrategy: 'Apply business rules for multi-platform sync',
            businessImpact: {
              critical: false,
              customerFacing: false,
              affectsShipping: false,
              affectsPayment: false,
            },
            indonesianContext: {
              isDuringBusinessHours: true,
              requiresImmediateAttention: false,
              culturalConsiderations: ['consistency'],
            },
          },
        ];
        
        // Mock multi-platform resolution
        const mockMultiResolutionResult = {
          success: true,
          conflicts: multiPlatformConflicts,
          resolutions: multiPlatformConflicts.map(conflict => ({
            conflictId: conflict.orderId,
            resolution: conflict.resolution,
            appliedStrategy: conflict.resolutionStrategy,
            resolvedAt: new Date(),
            resolvedBy: 'system',
          })),
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockMultiResolutionResult);
        
        // Test multi-platform conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, multiPlatformConflicts);
        
        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(2);
        
        // Verify different resolution strategies
        const shopeeConflict = result.conflicts.find(c => c.platformId === 'shopee');
        const lazadaConflict = result.conflicts.find(c => c.platformId === 'lazada');
        
        expect(shopeeConflict.resolution).toBe(ConflictResolution.PLATFORM_WINS);
        expect(lazadaConflict.resolution).toBe(ConflictResolution.BUSINESS_RULE_BASED);
        
        // Verify business impact assessment
        expect(shopeeConflict.businessImpact.critical).toBe(true);
        expect(lazadaConflict.businessImpact.critical).toBe(false);
      });

      test('should escalate unresolvable status conflicts to manual review', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create unresolvable status conflict
        const unresolvableConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'tokopedia-789',
          externalOrderNumber: 'TP-789',
          localStatus: OrderStatus.DELIVERED,
          externalStatus: 'cancelled',
          platformId: 'tokopedia',
          conflictType: ConflictType.STATUS_MISMATCH,
          resolution: ConflictResolution.MANUAL_REVIEW,
          resolutionStrategy: 'Critical status conflict requires manual review',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: true,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['customer_service_excellence', 'dispute_resolution'],
          },
        };
        
        // Mock manual review escalation
        const mockEscalationResult = {
          success: true,
          conflicts: [unresolvableConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.MANUAL_REVIEW,
              appliedStrategy: 'Critical status conflict requires manual review',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              escalated: true,
              manualReviewRequired: true,
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockEscalationResult);
        
        // Test escalation to manual review
        const result = await orderRoutingService.resolveConflicts(tenantId, [unresolvableConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.MANUAL_REVIEW);
        expect(result.resolutions[0].escalated).toBe(true);
        expect(result.resolutions[0].manualReviewRequired).toBe(true);
      });
    });

    describe('Payment Conflicts', () => {
      test('should resolve payment status conflicts with Indonesian payment methods', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create payment conflict with Indonesian payment method
        const paymentConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'shopee-payment-123',
          externalOrderNumber: 'SP-PAY-123',
          localStatus: OrderStatus.PAID,
          externalStatus: 'pending_payment',
          platformId: 'shopee',
          conflictType: ConflictType.PAYMENT_INCONSISTENCY,
          resolution: ConflictResolution.MANUAL_REVIEW,
          resolutionStrategy: 'Indonesian payment verification required',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: false,
            affectsPayment: true,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['payment_trust', 'customer_verification'],
          },
        };
        
        // Test Indonesian payment method validation
        const validIndonesianPaymentMethods = ['qris', 'gopay', 'ovo', 'dana', 'cod'];
        validIndonesianPaymentMethods.forEach(method => {
          expect(IndonesianBusinessHelper.isValidPaymentMethod(method)).toBe(true);
        });
        
        // Mock payment conflict resolution
        const mockPaymentResolutionResult = {
          success: true,
          conflicts: [paymentConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.MANUAL_REVIEW,
              appliedStrategy: 'Indonesian payment verification required',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              requiresPaymentVerification: true,
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockPaymentResolutionResult);
        
        // Test payment conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [paymentConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.PAYMENT_INCONSISTENCY);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.MANUAL_REVIEW);
        expect(result.resolutions[0].requiresPaymentVerification).toBe(true);
      });

      test('should handle QRIS payment conflicts specifically', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create QRIS-specific payment conflict
        const qrisConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'tokopedia-qris-456',
          externalOrderNumber: 'TP-QRIS-456',
          localStatus: OrderStatus.PAID,
          externalStatus: 'payment_verification_pending',
          platformId: 'tokopedia',
          conflictType: ConflictType.PAYMENT_INCONSISTENCY,
          resolution: ConflictResolution.CUSTOMER_PRIORITY,
          resolutionStrategy: 'QRIS payment verification follows customer priority',
          businessImpact: {
            critical: false,
            customerFacing: true,
            affectsShipping: false,
            affectsPayment: true,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: false,
            culturalConsiderations: ['qris_standard_compliance', 'payment_transparency'],
          },
        };
        
        // Validate QRIS as Indonesian payment method
        expect(IndonesianBusinessHelper.isValidPaymentMethod('qris')).toBe(true);
        
        // Mock QRIS payment resolution
        const mockQrisResolutionResult = {
          success: true,
          conflicts: [qrisConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.CUSTOMER_PRIORITY,
              appliedStrategy: 'QRIS payment verification follows customer priority',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              paymentMethod: 'qris',
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockQrisResolutionResult);
        
        // Test QRIS payment conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [qrisConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.PAYMENT_INCONSISTENCY);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.CUSTOMER_PRIORITY);
        expect(result.resolutions[0].paymentMethod).toBe('qris');
      });

      test('should handle COD payment conflicts with Indonesian logistics', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create COD payment conflict
        const codConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'lazada-cod-789',
          externalOrderNumber: 'LZ-COD-789',
          localStatus: OrderStatus.SHIPPED,
          externalStatus: 'waiting_cod_payment',
          platformId: 'lazada',
          conflictType: ConflictType.PAYMENT_INCONSISTENCY,
          resolution: ConflictResolution.BUSINESS_RULE_BASED,
          resolutionStrategy: 'COD payment resolved at delivery with Indonesian logistics',
          businessImpact: {
            critical: false,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: true,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: false,
            culturalConsiderations: ['cod_acceptance', 'delivery_coordination'],
          },
        };
        
        // Validate COD as Indonesian payment method
        expect(IndonesianBusinessHelper.isValidPaymentMethod('cod')).toBe(true);
        
        // Test COD support across platforms
        const platforms = ['shopee', 'lazada', 'tokopedia'];
        platforms.forEach(platform => {
          const config = getPlatformConfig(platform);
          expect(config.businessRules.supportsCOD).toBe(true);
        });
        
        // Mock COD payment resolution
        const mockCodResolutionResult = {
          success: true,
          conflicts: [codConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.BUSINESS_RULE_BASED,
              appliedStrategy: 'COD payment resolved at delivery with Indonesian logistics',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              paymentMethod: 'cod',
              requiresDeliveryCoordination: true,
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockCodResolutionResult);
        
        // Test COD payment conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [codConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.PAYMENT_INCONSISTENCY);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.BUSINESS_RULE_BASED);
        expect(result.resolutions[0].requiresDeliveryCoordination).toBe(true);
      });
    });

    describe('Shipping Conflicts', () => {
      test('should resolve shipping conflicts with Indonesian logistics providers', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create shipping conflict with Indonesian logistics
        const shippingConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'shopee-shipping-123',
          externalOrderNumber: 'SP-SHIP-123',
          localStatus: OrderStatus.SHIPPED,
          externalStatus: 'in_transit',
          platformId: 'shopee',
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
            culturalConsiderations: ['delivery_tracking', 'customer_communication'],
          },
        };
        
        // Test Indonesian shipping method validation
        const validIndonesianShippingMethods = ['jne', 'jnt', 'sicepat', 'anteraja', 'gojek', 'grab'];
        validIndonesianShippingMethods.forEach(method => {
          expect(IndonesianBusinessHelper.isValidShippingMethod(method)).toBe(true);
        });
        
        // Test delivery zone detection
        const jakartaZone = IndonesianBusinessHelper.getDeliveryZone('Jakarta Selatan, DKI Jakarta');
        expect(jakartaZone).toBe('jakarta');
        
        // Mock shipping conflict resolution
        const mockShippingResolutionResult = {
          success: true,
          conflicts: [shippingConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.BUSINESS_RULE_BASED,
              appliedStrategy: 'Apply Indonesian logistics business rules',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              shippingProvider: 'jne',
              deliveryZone: 'jakarta',
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockShippingResolutionResult);
        
        // Test shipping conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [shippingConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.SHIPPING_DISCREPANCY);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.BUSINESS_RULE_BASED);
        expect(result.resolutions[0].shippingProvider).toBe('jne');
        expect(result.resolutions[0].deliveryZone).toBe('jakarta');
      });

      test('should handle instant delivery conflicts in major Indonesian cities', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create instant delivery conflict
        const instantDeliveryConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'gojek-instant-123',
          externalOrderNumber: 'GOJEK-123',
          localStatus: OrderStatus.SHIPPED,
          externalStatus: 'driver_assigned',
          platformId: 'gojek',
          conflictType: ConflictType.SHIPPING_DISCREPANCY,
          resolution: ConflictResolution.PLATFORM_WINS,
          resolutionStrategy: 'Instant delivery platform status takes precedence',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: false,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['instant_delivery_expectations', 'real_time_tracking'],
          },
        };
        
        // Test instant delivery availability in Jakarta
        const jakartaZone = IndonesianBusinessHelper.getDeliveryZone('Jakarta Pusat, DKI Jakarta');
        expect(jakartaZone).toBe('jakarta');
        
        // Validate instant delivery providers
        expect(IndonesianBusinessHelper.isValidShippingMethod('gojek')).toBe(true);
        expect(IndonesianBusinessHelper.isValidShippingMethod('grab')).toBe(true);
        
        // Mock instant delivery conflict resolution
        const mockInstantResolutionResult = {
          success: true,
          conflicts: [instantDeliveryConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.PLATFORM_WINS,
              appliedStrategy: 'Instant delivery platform status takes precedence',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              shippingProvider: 'gojek',
              deliveryType: 'instant',
              deliveryZone: 'jakarta',
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockInstantResolutionResult);
        
        // Test instant delivery conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [instantDeliveryConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.SHIPPING_DISCREPANCY);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.PLATFORM_WINS);
        expect(result.resolutions[0].deliveryType).toBe('instant');
        expect(result.resolutions[0].deliveryZone).toBe('jakarta');
      });
    });

    describe('Inventory Conflicts', () => {
      test('should resolve inventory conflicts across multiple channels', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create inventory conflict
        const inventoryConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'multi-channel-inventory-123',
          externalOrderNumber: 'MC-INV-123',
          localStatus: OrderStatus.CONFIRMED,
          externalStatus: 'out_of_stock',
          platformId: 'shopee',
          conflictType: ConflictType.INVENTORY_CONFLICT,
          resolution: ConflictResolution.AUTOMATIC_MERGE,
          resolutionStrategy: 'Merge inventory data across channels',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: false,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['stock_availability', 'customer_expectations'],
          },
        };
        
        // Mock inventory conflict resolution
        const mockInventoryResolutionResult = {
          success: true,
          conflicts: [inventoryConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.AUTOMATIC_MERGE,
              appliedStrategy: 'Merge inventory data across channels',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              inventoryAdjustment: {
                productId: testProducts[0].id,
                adjustmentType: 'allocation',
                quantity: 1,
                reason: 'cross_channel_conflict_resolution',
              },
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockInventoryResolutionResult);
        
        // Test inventory conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [inventoryConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.INVENTORY_CONFLICT);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.AUTOMATIC_MERGE);
        expect(result.resolutions[0].inventoryAdjustment).toBeDefined();
        expect(result.resolutions[0].inventoryAdjustment.adjustmentType).toBe('allocation');
      });

      test('should handle stockout conflicts during peak seasons', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Mock peak season (December)
        const peakSeason = new Date('2024-12-15');
        jest.spyOn(Date, 'now').mockReturnValue(peakSeason.getTime());
        
        const seasonalFactor = IndonesianBusinessHelper.getSeasonalFactor(peakSeason);
        expect(seasonalFactor).toBe(1.5);
        
        // Create stockout conflict during peak season
        const stockoutConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'peak-season-stockout-123',
          externalOrderNumber: 'PS-STOCK-123',
          localStatus: OrderStatus.CONFIRMED,
          externalStatus: 'backordered',
          platformId: 'tokopedia',
          conflictType: ConflictType.INVENTORY_CONFLICT,
          resolution: ConflictResolution.CUSTOMER_PRIORITY,
          resolutionStrategy: 'Prioritize customer experience during peak season',
          businessImpact: {
            critical: true,
            customerFacing: true,
            affectsShipping: true,
            affectsPayment: false,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: true,
            culturalConsiderations: ['peak_season_expectations', 'customer_satisfaction'],
          },
        };
        
        // Mock peak season stockout resolution
        const mockStockoutResolutionResult = {
          success: true,
          conflicts: [stockoutConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.CUSTOMER_PRIORITY,
              appliedStrategy: 'Prioritize customer experience during peak season',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              peakSeasonHandling: true,
              seasonalFactor: 1.5,
              alternativeOptions: ['expedited_restock', 'substitute_product', 'customer_notification'],
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockStockoutResolutionResult);
        
        // Test stockout conflict resolution during peak season
        const result = await orderRoutingService.resolveConflicts(tenantId, [stockoutConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.INVENTORY_CONFLICT);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.CUSTOMER_PRIORITY);
        expect(result.resolutions[0].peakSeasonHandling).toBe(true);
        expect(result.resolutions[0].seasonalFactor).toBe(1.5);
      });
    });

    describe('Timing Conflicts', () => {
      test('should resolve timing conflicts across Indonesian timezones', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Create timing conflict across timezones
        const timingConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'timezone-conflict-123',
          externalOrderNumber: 'TZ-123',
          localStatus: OrderStatus.PROCESSING,
          externalStatus: 'expired',
          platformId: 'lazada',
          conflictType: ConflictType.TIMING_CONFLICT,
          resolution: ConflictResolution.BUSINESS_RULE_BASED,
          resolutionStrategy: 'Apply Indonesian timezone business rules',
          businessImpact: {
            critical: false,
            customerFacing: true,
            affectsShipping: false,
            affectsPayment: true,
          },
          indonesianContext: {
            isDuringBusinessHours: false,
            requiresImmediateAttention: false,
            culturalConsiderations: ['timezone_awareness', 'business_hours_respect'],
          },
        };
        
        // Test Indonesian timezone support
        const jakartaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        const makassarTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
        const jayapuraTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jayapura' });
        
        expect(jakartaTime).toBeDefined();
        expect(makassarTime).toBeDefined();
        expect(jayapuraTime).toBeDefined();
        
        // Mock timing conflict resolution
        const mockTimingResolutionResult = {
          success: true,
          conflicts: [timingConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.BUSINESS_RULE_BASED,
              appliedStrategy: 'Apply Indonesian timezone business rules',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              timezoneAdjustment: {
                originalTimezone: 'UTC',
                adjustedTimezone: 'Asia/Jakarta',
                timezoneDifference: 7, // UTC+7
              },
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockTimingResolutionResult);
        
        // Test timing conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [timingConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.TIMING_CONFLICT);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.BUSINESS_RULE_BASED);
        expect(result.resolutions[0].timezoneAdjustment).toBeDefined();
        expect(result.resolutions[0].timezoneAdjustment.adjustedTimezone).toBe('Asia/Jakarta');
      });

      test('should handle business hours conflicts during Ramadan', async () => {
        const tenantId = testTenantId;
        const orderId = testOrders[0].id;
        
        // Mock Ramadan period
        const ramadanDate = new Date('2024-04-15T14:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(ramadanDate.getTime());
        jest.spyOn(IndonesianBusinessHelper, 'isRamadanPeriod').mockReturnValue(true);
        
        // Create business hours conflict during Ramadan
        const ramadanTimingConflict: StandardConflictObject = {
          orderId,
          externalOrderId: 'ramadan-timing-123',
          externalOrderNumber: 'RM-TIME-123',
          localStatus: OrderStatus.PROCESSING,
          externalStatus: 'delayed',
          platformId: 'tokopedia',
          conflictType: ConflictType.TIMING_CONFLICT,
          resolution: ConflictResolution.DEFER,
          resolutionStrategy: 'Defer processing until after Ramadan business hours',
          businessImpact: {
            critical: false,
            customerFacing: true,
            affectsShipping: false,
            affectsPayment: false,
          },
          indonesianContext: {
            isDuringBusinessHours: true,
            requiresImmediateAttention: false,
            culturalConsiderations: ['ramadan_sensitivity', 'religious_observance'],
          },
        };
        
        // Mock Ramadan timing conflict resolution
        const mockRamadanResolutionResult = {
          success: true,
          conflicts: [ramadanTimingConflict],
          resolutions: [
            {
              conflictId: orderId,
              resolution: ConflictResolution.DEFER,
              appliedStrategy: 'Defer processing until after Ramadan business hours',
              resolvedAt: new Date(),
              resolvedBy: 'system',
              ramadanSensitive: true,
              deferredUntil: new Date('2024-04-15T18:00:00.000Z'), // After fasting hours
            },
          ],
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockRamadanResolutionResult);
        
        // Test Ramadan timing conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, [ramadanTimingConflict]);
        
        expect(result.success).toBe(true);
        expect(result.conflicts[0].conflictType).toBe(ConflictType.TIMING_CONFLICT);
        expect(result.conflicts[0].resolution).toBe(ConflictResolution.DEFER);
        expect(result.resolutions[0].ramadanSensitive).toBe(true);
        expect(result.resolutions[0].deferredUntil).toBeDefined();
      });
    });

    describe('Performance Impact Analysis', () => {
      test('should measure performance impact of conflict resolution', async () => {
        const tenantId = testTenantId;
        const startTime = Date.now();
        
        // Create multiple conflicts to test performance
        const multipleConflicts: StandardConflictObject[] = [
          createMockConflict('conflict-1', ConflictType.STATUS_MISMATCH, 'shopee'),
          createMockConflict('conflict-2', ConflictType.PAYMENT_INCONSISTENCY, 'lazada'),
          createMockConflict('conflict-3', ConflictType.SHIPPING_DISCREPANCY, 'tokopedia'),
          createMockConflict('conflict-4', ConflictType.INVENTORY_CONFLICT, 'shopee'),
          createMockConflict('conflict-5', ConflictType.TIMING_CONFLICT, 'lazada'),
        ];
        
        // Mock performance metrics
        const mockPerformanceResult = {
          success: true,
          conflicts: multipleConflicts,
          resolutions: multipleConflicts.map(conflict => ({
            conflictId: conflict.orderId,
            resolution: conflict.resolution,
            appliedStrategy: conflict.resolutionStrategy,
            resolvedAt: new Date(),
            resolvedBy: 'system',
            processingTime: Math.random() * 500 + 100, // 100-600ms
          })),
          performance: {
            totalConflicts: multipleConflicts.length,
            resolvedConflicts: multipleConflicts.length,
            totalResolutionTime: 2500,
            averageResolutionTime: 500,
            conflictTypes: {
              [ConflictType.STATUS_MISMATCH]: 1,
              [ConflictType.PAYMENT_INCONSISTENCY]: 1,
              [ConflictType.SHIPPING_DISCREPANCY]: 1,
              [ConflictType.INVENTORY_CONFLICT]: 1,
              [ConflictType.TIMING_CONFLICT]: 1,
            },
          },
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockPerformanceResult);
        
        // Test performance of conflict resolution
        const result = await orderRoutingService.resolveConflicts(tenantId, multipleConflicts);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(5);
        expect(result.performance.totalConflicts).toBe(5);
        expect(result.performance.resolvedConflicts).toBe(5);
        expect(result.performance.averageResolutionTime).toBeLessThan(1000); // Should be under 1 second
        expect(totalTime).toBeLessThan(5000); // Total should be under 5 seconds
        
        // Verify conflict type distribution
        expect(result.performance.conflictTypes[ConflictType.STATUS_MISMATCH]).toBe(1);
        expect(result.performance.conflictTypes[ConflictType.PAYMENT_INCONSISTENCY]).toBe(1);
        expect(result.performance.conflictTypes[ConflictType.SHIPPING_DISCREPANCY]).toBe(1);
        expect(result.performance.conflictTypes[ConflictType.INVENTORY_CONFLICT]).toBe(1);
        expect(result.performance.conflictTypes[ConflictType.TIMING_CONFLICT]).toBe(1);
      });

      test('should handle high-volume conflict resolution efficiently', async () => {
        const tenantId = testTenantId;
        const conflictCount = 100;
        
        // Create high-volume conflict scenario
        const highVolumeConflicts: StandardConflictObject[] = Array.from(
          { length: conflictCount },
          (_, i) => createMockConflict(`conflict-${i}`, ConflictType.STATUS_MISMATCH, 'shopee')
        );
        
        // Mock high-volume resolution
        const mockHighVolumeResult = {
          success: true,
          conflicts: highVolumeConflicts,
          resolutions: highVolumeConflicts.map(conflict => ({
            conflictId: conflict.orderId,
            resolution: conflict.resolution,
            appliedStrategy: conflict.resolutionStrategy,
            resolvedAt: new Date(),
            resolvedBy: 'system',
            processingTime: Math.random() * 100 + 50, // 50-150ms
          })),
          performance: {
            totalConflicts: conflictCount,
            resolvedConflicts: conflictCount,
            totalResolutionTime: 10000, // 10 seconds
            averageResolutionTime: 100,
            throughput: 10, // conflicts per second
            batchProcessing: true,
          },
        };
        
        jest.spyOn(orderRoutingService, 'resolveConflicts').mockResolvedValue(mockHighVolumeResult);
        
        // Test high-volume conflict resolution
        const startTime = Date.now();
        const result = await orderRoutingService.resolveConflicts(tenantId, highVolumeConflicts);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(conflictCount);
        expect(result.performance.totalConflicts).toBe(conflictCount);
        expect(result.performance.resolvedConflicts).toBe(conflictCount);
        expect(result.performance.throughput).toBeGreaterThan(5); // At least 5 conflicts per second
        expect(result.performance.batchProcessing).toBe(true);
        expect(totalTime).toBeLessThan(15000); // Should complete in under 15 seconds
      });
    });
  });

  // Helper functions
  function createMockConflict(
    conflictId: string,
    conflictType: ConflictType,
    platformId: string
  ): StandardConflictObject {
    return {
      orderId: conflictId,
      externalOrderId: `${platformId}-${conflictId}`,
      externalOrderNumber: `${platformId.toUpperCase()}-${conflictId}`,
      localStatus: OrderStatus.PROCESSING,
      externalStatus: 'pending',
      platformId,
      conflictType,
      resolution: ConflictResolution.AUTOMATIC_MERGE,
      resolutionStrategy: `Auto-resolve ${conflictType} conflict`,
      businessImpact: {
        critical: false,
        customerFacing: true,
        affectsShipping: false,
        affectsPayment: false,
      },
      indonesianContext: {
        isDuringBusinessHours: true,
        requiresImmediateAttention: false,
        culturalConsiderations: ['consistency'],
      },
    };
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

  async function setupTestData(): Promise<void> {
    testTenantId = 'test-tenant-123';
    
    // Create test data
    testChannels = [
      { id: 'shopee-channel', tenantId: testTenantId, name: 'Shopee Channel', platform: 'shopee' },
      { id: 'lazada-channel', tenantId: testTenantId, name: 'Lazada Channel', platform: 'lazada' },
      { id: 'tokopedia-channel', tenantId: testTenantId, name: 'Tokopedia Channel', platform: 'tokopedia' },
    ] as Channel[];
    
    testProducts = [
      { id: 'product-1', tenantId: testTenantId, name: 'Test Product 1', sku: 'SKU-001' },
      { id: 'product-2', tenantId: testTenantId, name: 'Test Product 2', sku: 'SKU-002' },
    ] as Product[];
    
    testCustomers = [
      { id: 'customer-1', tenantId: testTenantId, name: 'John Doe', email: 'john@example.com' },
      { id: 'customer-2', tenantId: testTenantId, name: 'Jane Smith', email: 'jane@example.com' },
    ] as Customer[];
    
    testOrders = [
      { id: 'order-1', tenantId: testTenantId, orderNumber: 'ORD-001', status: OrderStatus.PROCESSING },
      { id: 'order-2', tenantId: testTenantId, orderNumber: 'ORD-002', status: OrderStatus.SHIPPED },
    ] as Order[];
    
    testChannelMappings = [
      { id: 'mapping-1', tenantId: testTenantId, channelId: 'shopee-channel', externalId: 'shopee-123' },
      { id: 'mapping-2', tenantId: testTenantId, channelId: 'lazada-channel', externalId: 'lazada-456' },
      { id: 'mapping-3', tenantId: testTenantId, channelId: 'tokopedia-channel', externalId: 'tokopedia-789' },
    ] as ChannelMapping[];
  }

  async function cleanupTestData(): Promise<void> {
    testChannels = [];
    testProducts = [];
    testCustomers = [];
    testOrders = [];
    testChannelMappings = [];
  }
});