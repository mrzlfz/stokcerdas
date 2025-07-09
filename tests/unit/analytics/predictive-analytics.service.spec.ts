import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';

import { PredictiveAnalyticsService } from '../../../src/analytics/services/predictive-analytics.service';
import { ForecastingService } from '../../../src/ml-forecasting/services/forecasting.service';
import { ModelServingService } from '../../../src/ml-forecasting/services/model-serving.service';

import { InventoryItem } from '../../../src/inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../../src/inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../../../src/inventory/entities/inventory-location.entity';
import { Product } from '../../../src/products/entities/product.entity';
import { ProductCategory } from '../../../src/products/entities/product-category.entity';
import { Prediction } from '../../../src/ml-forecasting/entities/prediction.entity';
import { MLModel } from '../../../src/ml-forecasting/entities/ml-model.entity';

import {
  TimeHorizon,
  RiskLevel,
  StockoutPredictionQueryDto,
  SlowMovingDetectionQueryDto,
  OptimalReorderQueryDto,
} from '../../../src/analytics/dto/predictive-analytics-query.dto';

describe('PredictiveAnalyticsService - Error Handling & Default Responses', () => {
  let service: PredictiveAnalyticsService;
  let productRepository: Repository<Product>;
  let inventoryItemRepository: Repository<InventoryItem>;
  let forecastingService: ForecastingService;

  // Mock repositories
  const mockProductRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };

  const mockInventoryItemRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockLocationRepository = {};
  const mockCategoryRepository = {};
  const mockPredictionRepository = {};
  const mockMLModelRepository = {};

  // Mock services
  const mockForecastingService = {
    generateDemandForecast: jest.fn(),
  };

  const mockModelServingService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictiveAnalyticsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockInventoryItemRepository,
        },
        {
          provide: getRepositoryToken(InventoryTransaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(InventoryLocation),
          useValue: mockLocationRepository,
        },
        {
          provide: getRepositoryToken(ProductCategory),
          useValue: mockCategoryRepository,
        },
        {
          provide: getRepositoryToken(Prediction),
          useValue: mockPredictionRepository,
        },
        {
          provide: getRepositoryToken(MLModel),
          useValue: mockMLModelRepository,
        },
        {
          provide: ForecastingService,
          useValue: mockForecastingService,
        },
        {
          provide: ModelServingService,
          useValue: mockModelServingService,
        },
      ],
    }).compile();

    service = module.get<PredictiveAnalyticsService>(PredictiveAnalyticsService);
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
    inventoryItemRepository = module.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem));
    forecastingService = module.get<ForecastingService>(ForecastingService);

    // Suppress logger warnings during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'info').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateStockoutPredictions', () => {
    const testTenantId = 'test-tenant-id';
    const query: StockoutPredictionQueryDto = {
      timeHorizon: TimeHorizon.NEXT_30_DAYS,
      minRiskLevel: RiskLevel.MEDIUM,
      page: 1,
      limit: 50,
    };

    it('should return empty state guidance when no products found', async () => {
      // Mock empty products query
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockProductRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.generateStockoutPredictions(testTenantId, query);

      expect(result).toMatchObject({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
        summary: {
          totalProducts: 0,
          highRiskProducts: 0,
          criticalRiskProducts: 0,
          averageRiskScore: 0,
          averageDaysToStockout: 0,
          totalPotentialLostRevenue: 0,
        },
        insights: {
          keyFindings: expect.arrayContaining([
            expect.stringContaining('Belum ada produk yang terdaftar'),
          ]),
          actionPriorities: expect.arrayContaining([
            expect.stringContaining('Priority 1: Setup master data produk'),
          ]),
        },
      });

      expect(result.meta.executionTime).toBeGreaterThan(0);
      expect(result.meta.generatedAt).toBeDefined();
    });

    it('should return guidance response when stockout calculations fail for all products', async () => {
      // Mock products query to return products
      const mockProducts = [
        { id: 'product-1', name: 'Product 1', sku: 'SKU001' },
        { id: 'product-2', name: 'Product 2', sku: 'SKU002' },
      ];
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProducts),
      };
      mockProductRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Mock inventory repository to return null (no inventory found)
      mockInventoryItemRepository.findOne.mockResolvedValue(null);

      const result = await service.generateStockoutPredictions(testTenantId, query);

      expect(result).toMatchObject({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
        summary: {
          totalProducts: 2, // Two products found but none analyzed
          highRiskProducts: 0,
          criticalRiskProducts: 0,
        },
        insights: {
          keyFindings: expect.arrayContaining([
            expect.stringContaining('Ditemukan 2 produk tetapi tidak dapat dianalisis'),
          ]),
          actionPriorities: expect.arrayContaining([
            expect.stringContaining('Priority 1: Pastikan semua produk memiliki inventory tracking'),
          ]),
        },
      });
    });

    it('should handle graceful fallback when inventory data is missing', async () => {
      const mockProduct = { 
        id: 'product-1', 
        name: 'Test Product', 
        sku: 'TEST001',
        sellingPrice: 100000,
      };

      // Mock inventory repository to return null
      mockInventoryItemRepository.findOne.mockResolvedValue(null);

      // Call the private method indirectly through reflection for testing
      const privateMethod = (service as any).calculateStockoutRisk;
      const result = await privateMethod.call(service, testTenantId, mockProduct, query);

      expect(result).toMatchObject({
        productId: 'product-1',
        productName: 'Test Product',
        sku: 'TEST001',
        currentStock: 0,
        riskLevel: RiskLevel.VERY_LOW,
        confidence: 0.1, // Low confidence due to missing data
        daysUntilStockout: 999,
        recommendations: expect.arrayContaining([
          expect.stringContaining('Data inventory tidak tersedia'),
          expect.stringContaining('Setup inventory tracking'),
        ]),
      });
    });
  });

  describe('detectSlowMovingItems', () => {
    const testTenantId = 'test-tenant-id';
    const query: SlowMovingDetectionQueryDto = {
      lookbackDays: 90,
      minTurnoverRatio: 0.5,
      maxDaysWithoutSale: 60,
      page: 1,
      limit: 50,
    };

    it('should return positive guidance when no slow-moving items found', async () => {
      // Mock the private method to return empty array
      const originalMethod = (service as any).identifySlowMovingItems;
      jest.spyOn(service as any, 'identifySlowMovingItems')
        .mockResolvedValue([]);

      const result = await service.detectSlowMovingItems(testTenantId, query);

      expect(result).toMatchObject({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
        summary: {
          totalItems: 0,
          slowMovingItems: 0,
          deadStockItems: 0,
          totalInventoryValue: 0,
        },
        insights: {
          keyFindings: expect.arrayContaining([
            expect.stringContaining('Tidak ditemukan slow-moving inventory - ini adalah tanda positif!'),
          ]),
          actionPriorities: expect.arrayContaining([
            expect.stringContaining('Pertahankan strategi inventory'),
          ]),
        },
      });
    });
  });

  describe('generateOptimalReorders', () => {
    const testTenantId = 'test-tenant-id';
    const query: OptimalReorderQueryDto = {
      forecastHorizon: TimeHorizon.NEXT_30_DAYS,
      safetyStockMultiplier: 1.5,
      page: 1,
      limit: 50,
    };

    it('should return positive guidance when no products need reordering', async () => {
      // Mock the private method to return empty array
      jest.spyOn(service as any, 'getProductsNeedingReorder')
        .mockResolvedValue([]);

      const result = await service.generateOptimalReorders(testTenantId, query);

      expect(result).toMatchObject({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
        summary: {
          totalProducts: 0,
          needsReordering: 0,
          criticalReorders: 0,
          totalReorderValue: 0,
        },
        insights: {
          inventoryOptimization: expect.arrayContaining([
            expect.stringContaining('Excellent inventory levels - no immediate reordering needed!'),
          ]),
          cashFlowManagement: expect.arrayContaining([
            expect.stringContaining('No immediate cash outflow'),
          ]),
        },
      });
    });

    it('should return guidance when reorder calculations fail for all products', async () => {
      const mockProducts = [
        { id: 'product-1', name: 'Product 1', inventoryItems: [] },
        { id: 'product-2', name: 'Product 2', inventoryItems: [] },
      ];

      // Mock to return products but empty inventory items
      jest.spyOn(service as any, 'getProductsNeedingReorder')
        .mockResolvedValue(mockProducts);

      const result = await service.generateOptimalReorders(testTenantId, query);

      expect(result).toMatchObject({
        data: [],
        meta: {
          total: 0,
        },
        summary: {
          totalProducts: 2,
          needsReordering: 0,
        },
        insights: {
          inventoryOptimization: expect.arrayContaining([
            expect.stringContaining('Ditemukan 2 produk tetapi tidak dapat dianalisis'),
          ]),
          riskMitigation: expect.arrayContaining([
            expect.stringContaining('Audit inventory data setup'),
          ]),
        },
      });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      const testTenantId = 'test-tenant-id';
      const query: StockoutPredictionQueryDto = {
        timeHorizon: TimeHorizon.NEXT_30_DAYS,
      };

      // Mock empty products
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockProductRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.generateStockoutPredictions(testTenantId, query);

      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
      expect(result.meta).toBeDefined();
      expect(result.insights).toBeDefined();
    });

    it('should provide Indonesian language insights', async () => {
      const testTenantId = 'test-tenant-id';
      const query: StockoutPredictionQueryDto = {
        timeHorizon: TimeHorizon.NEXT_30_DAYS,
      };

      // Mock empty products
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockProductRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.generateStockoutPredictions(testTenantId, query);

      // Check that insights are in Indonesian
      const allInsights = [
        ...result.insights.keyFindings,
        ...result.insights.actionPriorities,
        ...result.insights.riskMitigationStrategies,
        ...result.insights.inventoryOptimizationTips,
      ];

      const hasIndonesianText = allInsights.some(insight => 
        insight.includes('produk') || 
        insight.includes('untuk') || 
        insight.includes('dengan') ||
        insight.includes('Setup')
      );

      expect(hasIndonesianText).toBe(true);
    });
  });
});