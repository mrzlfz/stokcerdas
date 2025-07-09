import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

import { PredictiveAnalyticsController } from '../../../src/analytics/controllers/predictive-analytics.controller';
import { PredictiveAnalyticsService } from '../../../src/analytics/services/predictive-analytics.service';
import { PriceOptimizationService } from '../../../src/analytics/services/price-optimization.service';
import { DemandAnomalyService } from '../../../src/analytics/services/demand-anomaly.service';
import { ModelServingService } from '../../../src/ml-forecasting/services/model-serving.service';

import {
  PredictiveAnalysisType,
  TimeHorizon,
  RiskLevel,
  PredictiveAnalyticsQueryDto,
  StockoutPredictionQueryDto,
  SlowMovingDetectionQueryDto,
  OptimalReorderQueryDto,
  PriceOptimizationQueryDto,
  DemandAnomalyQueryDto,
  SeasonalAnalysisQueryDto,
} from '../../../src/analytics/dto/predictive-analytics-query.dto';

describe('PredictiveAnalyticsController - Integration Tests with Indonesian Error Handling', () => {
  let controller: PredictiveAnalyticsController;
  let predictiveAnalyticsService: PredictiveAnalyticsService;
  let priceOptimizationService: PriceOptimizationService;
  let demandAnomalyService: DemandAnomalyService;
  let modelServingService: ModelServingService;

  // Mock services
  const mockPredictiveAnalyticsService = {
    generateStockoutPredictions: jest.fn(),
    detectSlowMovingItems: jest.fn(),
    generateOptimalReorders: jest.fn(),
  };

  const mockPriceOptimizationService = {
    generatePriceOptimizations: jest.fn(),
  };

  const mockDemandAnomalyService = {
    detectDemandAnomalies: jest.fn(),
    performSeasonalAnalysis: jest.fn(),
  };

  const mockModelServingService = {
    predict: jest.fn(),
    batchPredict: jest.fn(),
    getDemandForecast: jest.fn(),
    getStockoutRisk: jest.fn(),
    getOptimalReorder: jest.fn(),
    validatePredictions: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-456',
    email: 'test@stokcerdas.com',
    role: 'manager',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictiveAnalyticsController],
      providers: [
        {
          provide: PredictiveAnalyticsService,
          useValue: mockPredictiveAnalyticsService,
        },
        {
          provide: PriceOptimizationService,
          useValue: mockPriceOptimizationService,
        },
        {
          provide: DemandAnomalyService,
          useValue: mockDemandAnomalyService,
        },
        {
          provide: ModelServingService,
          useValue: mockModelServingService,
        },
      ],
    }).compile();

    controller = module.get<PredictiveAnalyticsController>(PredictiveAnalyticsController);
    predictiveAnalyticsService = module.get<PredictiveAnalyticsService>(PredictiveAnalyticsService);
    priceOptimizationService = module.get<PriceOptimizationService>(PriceOptimizationService);
    demandAnomalyService = module.get<DemandAnomalyService>(DemandAnomalyService);
    modelServingService = module.get<ModelServingService>(ModelServingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('performPredictiveAnalysis - Main Orchestration Endpoint', () => {
    const baseQuery: PredictiveAnalyticsQueryDto = {
      analysisType: PredictiveAnalysisType.STOCKOUT_PREDICTION,
      startDate: '2025-01-01',
      endDate: '2025-07-05',
      includeConfidenceInterval: true,
      includeRecommendations: true,
      minConfidence: 0.7,
      limit: 50,
      page: 1,
    };

    it('should successfully orchestrate stockout prediction analysis', async () => {
      const mockServiceResponse = {
        data: [
          {
            productId: 'product-1',
            productName: 'Test Product',
            riskLevel: RiskLevel.HIGH,
            confidence: 0.85,
            daysUntilStockout: 7,
          },
        ],
        summary: {
          totalProducts: 1,
          highRiskProducts: 1,
          criticalRiskProducts: 0,
          averageRiskScore: 0.85,
        },
        insights: {
          keyFindings: ['Produk dengan risiko tinggi ditemukan'],
          actionPriorities: ['Segera lakukan reorder untuk Product 1'],
        },
        meta: {
          total: 1,
          page: 1,
          limit: 50,
          executionTime: 1200,
        },
      };

      mockPredictiveAnalyticsService.generateStockoutPredictions.mockResolvedValue(mockServiceResponse);

      const result = await controller.performPredictiveAnalysis(mockUser, baseQuery);

      expect(result).toMatchObject({
        analysisType: PredictiveAnalysisType.STOCKOUT_PREDICTION,
        data: mockServiceResponse.data,
        summary: mockServiceResponse.summary,
        insights: mockServiceResponse.insights,
        meta: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 50,
          executionTime: expect.any(Number),
        }),
        correlations: expect.any(Array),
        nextRecommendedAnalysis: expect.any(Object),
      });

      // Verify service was called with correct parameters
      expect(mockPredictiveAnalyticsService.generateStockoutPredictions).toHaveBeenCalledWith(
        mockUser.tenantId,
        { timeHorizon: TimeHorizon.NEXT_30_DAYS }
      );
    });

    it('should handle validation error for missing analysis type with Indonesian message', async () => {
      const invalidQuery = { ...baseQuery };
      delete invalidQuery.analysisType;

      await expect(
        controller.performPredictiveAnalysis(mockUser, invalidQuery as any)
      ).rejects.toThrow(BadRequestException);

      try {
        await controller.performPredictiveAnalysis(mockUser, invalidQuery as any);
      } catch (error) {
        expect(error.getResponse()).toMatchObject({
          success: false,
          error: 'Jenis analisis wajib dipilih',
          timestamp: expect.any(String),
        });
      }
    });

    it('should handle service error with Indonesian localization', async () => {
      mockPredictiveAnalyticsService.generateStockoutPredictions.mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(
        controller.performPredictiveAnalysis(mockUser, baseQuery)
      ).rejects.toThrow(HttpException);

      try {
        await controller.performPredictiveAnalysis(mockUser, baseQuery);
      } catch (error) {
        expect(error.getResponse()).toMatchObject({
          success: false,
          error: 'Koneksi database bermasalah',
          context: `Analisis prediktif ${baseQuery.analysisType}`,
          timestamp: expect.any(String),
        });
      }
    });

    it('should successfully handle all analysis types', async () => {
      const analysisTypes = [
        PredictiveAnalysisType.STOCKOUT_PREDICTION,
        PredictiveAnalysisType.SLOW_MOVING_DETECTION,
        PredictiveAnalysisType.OPTIMAL_REORDER,
        PredictiveAnalysisType.PRICE_OPTIMIZATION,
        PredictiveAnalysisType.DEMAND_ANOMALY,
        PredictiveAnalysisType.SEASONAL_ANALYSIS,
      ];

      const mockResponse = {
        data: [],
        summary: {},
        insights: {},
        meta: { executionTime: 500 },
      };

      // Setup mocks for all services
      mockPredictiveAnalyticsService.generateStockoutPredictions.mockResolvedValue(mockResponse);
      mockPredictiveAnalyticsService.detectSlowMovingItems.mockResolvedValue(mockResponse);
      mockPredictiveAnalyticsService.generateOptimalReorders.mockResolvedValue(mockResponse);
      mockPriceOptimizationService.generatePriceOptimizations.mockResolvedValue(mockResponse);
      mockDemandAnomalyService.detectDemandAnomalies.mockResolvedValue(mockResponse);
      mockDemandAnomalyService.performSeasonalAnalysis.mockResolvedValue(mockResponse);

      for (const analysisType of analysisTypes) {
        const query = { ...baseQuery, analysisType };
        const result = await controller.performPredictiveAnalysis(mockUser, query);

        expect(result).toMatchObject({
          analysisType,
          data: mockResponse.data,
          meta: expect.objectContaining({
            executionTime: expect.any(Number),
          }),
        });
      }
    });

    it('should suggest appropriate next analysis based on results', async () => {
      const highRiskStockoutResponse = {
        data: [],
        summary: { criticalRiskProducts: 5 },
        insights: {},
        meta: {},
      };

      mockPredictiveAnalyticsService.generateStockoutPredictions.mockResolvedValue(highRiskStockoutResponse);

      const result = await controller.performPredictiveAnalysis(mockUser, baseQuery);

      expect(result.nextRecommendedAnalysis).toMatchObject({
        analysisType: PredictiveAnalysisType.OPTIMAL_REORDER,
        reasoning: 'High stockout risk detected - optimize reorder parameters',
        priority: 'high',
      });
    });
  });

  describe('predictStockoutRisk - Enhanced Error Handling', () => {
    const stockoutQuery: StockoutPredictionQueryDto = {
      timeHorizon: TimeHorizon.NEXT_30_DAYS,
      minRiskLevel: RiskLevel.MEDIUM,
      currentLowStockOnly: false,
      includeSeasonalFactors: true,
      considerLeadTime: true,
      productId: 'product-123',
      page: 1,
      limit: 50,
    };

    it('should successfully predict stockout risk with performance monitoring', async () => {
      const mockResponse = {
        data: [
          {
            productId: 'product-123',
            productName: 'Sample Product',
            riskLevel: RiskLevel.HIGH,
            confidence: 0.9,
            daysUntilStockout: 5,
            recommendations: ['Reorder immediately'],
          },
        ],
        meta: { executionTime: 800 },
        summary: { totalProducts: 1, highRiskProducts: 1 },
        insights: { keyFindings: ['High risk detected'] },
      };

      mockPredictiveAnalyticsService.generateStockoutPredictions.mockResolvedValue(mockResponse);

      const result = await controller.predictStockoutRisk(mockUser, stockoutQuery);

      expect(result).toEqual(mockResponse);
      expect(mockPredictiveAnalyticsService.generateStockoutPredictions).toHaveBeenCalledWith(
        mockUser.tenantId,
        stockoutQuery
      );
    });

    it('should handle Indonesian error messages from service layer', async () => {
      mockPredictiveAnalyticsService.generateStockoutPredictions.mockRejectedValue(
        new Error('Model prediksi tidak tersedia untuk analisis stok')
      );

      await expect(
        controller.predictStockoutRisk(mockUser, stockoutQuery)
      ).rejects.toThrow(HttpException);

      try {
        await controller.predictStockoutRisk(mockUser, stockoutQuery);
      } catch (error) {
        expect(error.getResponse()).toMatchObject({
          success: false,
          error: 'Model prediksi tidak tersedia untuk analisis stok',
          timestamp: expect.any(String),
        });
      }
    });
  });

  describe('detectSlowMovingItems - Business Logic Integration', () => {
    const slowMovingQuery: SlowMovingDetectionQueryDto = {
      lookbackDays: 90,
      minTurnoverRatio: 0.5,
      maxDaysWithoutSale: 60,
      includeValueAnalysis: true,
      minInventoryValue: 100000, // IDR 100K
      page: 1,
      limit: 50,
    };

    it('should successfully detect slow-moving items with Indonesian insights', async () => {
      const mockResponse = {
        data: [
          {
            productId: 'slow-product-1',
            productName: 'Slow Moving Product',
            turnoverRatio: 0.3,
            daysWithoutSale: 75,
            inventoryValue: 500000,
            category: 'electronics',
            recommendations: ['Pertimbangkan diskon untuk meningkatkan penjualan'],
          },
        ],
        summary: {
          totalItems: 1,
          slowMovingItems: 1,
          totalInventoryValue: 500000,
          potentialRecovery: 350000,
        },
        insights: {
          keyFindings: ['Ditemukan 1 item dengan perputaran lambat'],
          actionPriorities: ['Implementasikan strategi markdown'],
        },
        meta: { executionTime: 1100 },
      };

      mockPredictiveAnalyticsService.detectSlowMovingItems.mockResolvedValue(mockResponse);

      const result = await controller.detectSlowMovingItems(mockUser, slowMovingQuery);

      expect(result).toEqual(mockResponse);
      expect(mockPredictiveAnalyticsService.detectSlowMovingItems).toHaveBeenCalledWith(
        mockUser.tenantId,
        slowMovingQuery
      );
    });
  });

  describe('generateOptimalReorders - Parameter Validation', () => {
    const reorderQuery: OptimalReorderQueryDto = {
      forecastHorizon: TimeHorizon.NEXT_30_DAYS,
      safetyStockMultiplier: 1.5,
      considerSupplierLeadTime: true,
      includeEOQ: true,
      maxBudget: 10000000, // IDR 10M
      priorityProductsOnly: false,
      page: 1,
      limit: 50,
    };

    it('should successfully generate optimal reorders with correct parameter logging', async () => {
      const mockResponse = {
        data: [
          {
            productId: 'reorder-product-1',
            optimalQuantity: 100,
            reorderPoint: 50,
            estimatedCost: 2000000,
            confidence: 0.8,
          },
        ],
        summary: {
          totalProducts: 1,
          needsReordering: 1,
          totalReorderValue: 2000000,
        },
        insights: {
          inventoryOptimization: ['EOQ calculation suggests optimal batch of 100 units'],
          cashFlowManagement: ['Estimated cash outflow: IDR 2,000,000'],
        },
        meta: { executionTime: 950 },
      };

      mockPredictiveAnalyticsService.generateOptimalReorders.mockResolvedValue(mockResponse);

      const result = await controller.generateOptimalReorders(mockUser, reorderQuery);

      expect(result).toEqual(mockResponse);
      expect(mockPredictiveAnalyticsService.generateOptimalReorders).toHaveBeenCalledWith(
        mockUser.tenantId,
        reorderQuery
      );
    });

    it('should log correct parameters in analytics operation', async () => {
      const mockResponse = { data: [], summary: {}, insights: {}, meta: { executionTime: 500 } };
      mockPredictiveAnalyticsService.generateOptimalReorders.mockResolvedValue(mockResponse);

      // Spy on the logging method to verify parameters
      const logSpy = jest.spyOn(controller as any, 'logAnalyticsOperation');

      await controller.generateOptimalReorders(mockUser, reorderQuery);

      expect(logSpy).toHaveBeenCalledWith(
        mockUser.tenantId,
        'Optimal Reorder Generation',
        undefined,
        {
          forecastHorizon: reorderQuery.forecastHorizon,
          safetyStockMultiplier: reorderQuery.safetyStockMultiplier,
        }
      );
    });
  });

  describe('optimizePricing - Enhanced Error Handling', () => {
    const pricingQuery: PriceOptimizationQueryDto = {
      currentMarginThreshold: 20,
      targetMargin: 30,
      considerCompetitorPricing: true,
      includeDemandElasticity: true,
      maxPriceIncrease: 15,
      includeSeasonalPricing: true,
      minVolumeThreshold: 10,
      page: 1,
      limit: 50,
    };

    it('should successfully optimize pricing with performance tracking', async () => {
      const mockResponse = {
        data: [
          {
            productId: 'pricing-product-1',
            currentPrice: 100000,
            suggestedPrice: 110000,
            expectedMarginImprovement: 5,
            demandElasticity: -0.8,
          },
        ],
        summary: {
          optimizationOpportunities: 1,
          potentialRevenueIncrease: 1000000,
          averageMarginImprovement: 5,
        },
        insights: {
          pricingStrategy: ['Conservative 10% increase recommended'],
          marketPosition: ['Price within competitive range'],
        },
        meta: { executionTime: 1200 },
      };

      mockPriceOptimizationService.generatePriceOptimizations.mockResolvedValue(mockResponse);

      const result = await controller.optimizePricing(mockUser, pricingQuery);

      expect(result).toEqual(mockResponse);
      expect(mockPriceOptimizationService.generatePriceOptimizations).toHaveBeenCalledWith(
        mockUser.tenantId,
        pricingQuery
      );
    });

    it('should handle pricing service errors with Indonesian context', async () => {
      mockPriceOptimizationService.generatePriceOptimizations.mockRejectedValue(
        new Error('Insufficient pricing data')
      );

      await expect(
        controller.optimizePricing(mockUser, pricingQuery)
      ).rejects.toThrow(HttpException);

      try {
        await controller.optimizePricing(mockUser, pricingQuery);
      } catch (error) {
        expect(error.getResponse()).toMatchObject({
          success: false,
          error: 'Data tidak mencukupi untuk analisis', // Translated to Indonesian
          context: 'Optimasi harga',
          timestamp: expect.any(String),
        });
      }
    });
  });

  describe('detectDemandAnomalies - Sensitivity Testing', () => {
    const anomalyQuery: DemandAnomalyQueryDto = {
      sensitivityLevel: 5,
      detectSpikes: true,
      detectDrops: true,
      includeSeasonalAnomalies: true,
      minDeviationPercent: 25,
      page: 1,
      limit: 50,
    };

    it('should successfully detect demand anomalies with proper parameter logging', async () => {
      const mockResponse = {
        data: [
          {
            productId: 'anomaly-product-1',
            anomalyType: 'spike',
            deviationPercent: 150,
            anomalyDate: '2025-07-01',
            explanation: 'Unusual demand spike detected',
          },
        ],
        summary: {
          anomaliesDetected: 1,
          spikes: 1,
          drops: 0,
        },
        insights: {
          anomalyPatterns: ['Spike pattern consistent with promotional activity'],
          seasonalFactors: ['No seasonal influence detected'],
        },
        meta: { executionTime: 800 },
      };

      mockDemandAnomalyService.detectDemandAnomalies.mockResolvedValue(mockResponse);

      const result = await controller.detectDemandAnomalies(mockUser, anomalyQuery);

      expect(result).toEqual(mockResponse);
      expect(mockDemandAnomalyService.detectDemandAnomalies).toHaveBeenCalledWith(
        mockUser.tenantId,
        anomalyQuery
      );
    });
  });

  describe('performSeasonalAnalysis - Indonesian Holiday Context', () => {
    const seasonalQuery: SeasonalAnalysisQueryDto = {
      analysisPeriodMonths: 12,
      includeWeeklyPatterns: true,
      includeMonthlyPatterns: true,
      includeHolidayEffects: true,
      useIndonesianHolidays: true,
      minSeasonalityStrength: 0.3,
      page: 1,
      limit: 50,
    };

    it('should successfully perform seasonal analysis with Indonesian holiday integration', async () => {
      const mockResponse = {
        data: [
          {
            productId: 'seasonal-product-1',
            seasonalityStrength: 0.7,
            peakSeasons: ['ramadan', 'christmas'],
            holidayEffects: {
              'hari-raya': { impact: 'high', demandIncrease: '200%' },
              'christmas': { impact: 'medium', demandIncrease: '50%' },
            },
          },
        ],
        summary: {
          strongSeasonalProducts: 1,
          holidayInfluencedProducts: 1,
          recommendedStockingStrategy: 'Build inventory before major holidays',
        },
        insights: {
          seasonalPatterns: ['Strong Ramadan seasonality detected'],
          inventoryPlanning: ['Increase stock 60 days before Hari Raya'],
        },
        meta: { executionTime: 1500 },
      };

      mockDemandAnomalyService.performSeasonalAnalysis.mockResolvedValue(mockResponse);

      const result = await controller.performSeasonalAnalysis(mockUser, seasonalQuery);

      expect(result).toEqual(mockResponse);
      expect(mockDemandAnomalyService.performSeasonalAnalysis).toHaveBeenCalledWith(
        mockUser.tenantId,
        seasonalQuery
      );
    });

    it('should log Indonesian holiday parameters correctly', async () => {
      const mockResponse = { data: [], summary: {}, insights: {}, meta: { executionTime: 500 } };
      mockDemandAnomalyService.performSeasonalAnalysis.mockResolvedValue(mockResponse);

      const logSpy = jest.spyOn(controller as any, 'logAnalyticsOperation');

      await controller.performSeasonalAnalysis(mockUser, seasonalQuery);

      expect(logSpy).toHaveBeenCalledWith(
        mockUser.tenantId,
        'Seasonal Analysis',
        undefined,
        {
          analysisPeriodMonths: seasonalQuery.analysisPeriodMonths,
          useIndonesianHolidays: seasonalQuery.useIndonesianHolidays,
        }
      );
    });
  });

  describe('Performance & Execution Time Monitoring', () => {
    it('should track execution time for all enhanced methods', async () => {
      const mockResponse = { data: [], summary: {}, insights: {}, meta: {} };
      
      // Mock all services
      mockPredictiveAnalyticsService.generateStockoutPredictions.mockResolvedValue(mockResponse);
      mockPredictiveAnalyticsService.detectSlowMovingItems.mockResolvedValue(mockResponse);
      mockPredictiveAnalyticsService.generateOptimalReorders.mockResolvedValue(mockResponse);
      mockPriceOptimizationService.generatePriceOptimizations.mockResolvedValue(mockResponse);
      mockDemandAnomalyService.detectDemandAnomalies.mockResolvedValue(mockResponse);
      mockDemandAnomalyService.performSeasonalAnalysis.mockResolvedValue(mockResponse);

      const methods = [
        { method: 'predictStockoutRisk', query: { timeHorizon: TimeHorizon.NEXT_30_DAYS } },
        { method: 'detectSlowMovingItems', query: { lookbackDays: 90 } },
        { method: 'generateOptimalReorders', query: { forecastHorizon: TimeHorizon.NEXT_30_DAYS } },
        { method: 'optimizePricing', query: { targetMargin: 30 } },
        { method: 'detectDemandAnomalies', query: { sensitivityLevel: 5 } },
        { method: 'performSeasonalAnalysis', query: { analysisPeriodMonths: 12 } },
      ];

      for (const { method, query } of methods) {
        const startTime = Date.now();
        await controller[method](mockUser, query);
        const endTime = Date.now();

        // Should complete within reasonable time (< 100ms for mocked responses)
        expect(endTime - startTime).toBeLessThan(100);
      }
    });

    it('should handle long-running operations gracefully', async () => {
      const mockSlowResponse = { data: [], summary: {}, insights: {}, meta: { executionTime: 5000 } };
      
      // Simulate slow service response
      mockPredictiveAnalyticsService.generateStockoutPredictions.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSlowResponse), 50))
      );

      const logSpy = jest.spyOn(controller as any, 'logAnalyticsOperation');
      
      const result = await controller.predictStockoutRisk(mockUser, { 
        timeHorizon: TimeHorizon.NEXT_30_DAYS 
      });

      expect(result).toEqual(mockSlowResponse);
      
      // Should log both start and completion with execution time
      expect(logSpy).toHaveBeenCalledWith(
        mockUser.tenantId,
        'Stockout Risk Prediction',
        undefined,
        expect.any(Object)
      );
      expect(logSpy).toHaveBeenCalledWith(
        mockUser.tenantId,
        'Stockout Risk Prediction Completed',
        expect.any(Number)
      );
    });
  });

  describe('Error Resilience & Recovery', () => {
    it('should handle service timeout errors appropriately', async () => {
      mockPredictiveAnalyticsService.generateStockoutPredictions.mockRejectedValue(
        new Error('Service timeout')
      );

      await expect(
        controller.predictStockoutRisk(mockUser, { timeHorizon: TimeHorizon.NEXT_30_DAYS })
      ).rejects.toThrow(HttpException);

      try {
        await controller.predictStockoutRisk(mockUser, { timeHorizon: TimeHorizon.NEXT_30_DAYS });
      } catch (error) {
        expect(error.getResponse()).toMatchObject({
          success: false,
          error: 'Sistem mengalami timeout', // Indonesian translation
          context: 'Prediksi risiko kehabisan stok',
        });
      }
    });

    it('should maintain consistent error format across all methods', async () => {
      const testError = new Error('Test error message');
      const methods = [
        { service: mockPredictiveAnalyticsService, method: 'generateStockoutPredictions', controller: 'predictStockoutRisk' },
        { service: mockPredictiveAnalyticsService, method: 'detectSlowMovingItems', controller: 'detectSlowMovingItems' },
        { service: mockPredictiveAnalyticsService, method: 'generateOptimalReorders', controller: 'generateOptimalReorders' },
        { service: mockPriceOptimizationService, method: 'generatePriceOptimizations', controller: 'optimizePricing' },
        { service: mockDemandAnomalyService, method: 'detectDemandAnomalies', controller: 'detectDemandAnomalies' },
        { service: mockDemandAnomalyService, method: 'performSeasonalAnalysis', controller: 'performSeasonalAnalysis' },
      ];

      for (const { service, method, controller: controllerMethod } of methods) {
        service[method].mockRejectedValue(testError);

        try {
          await controller[controllerMethod](mockUser, {});
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.getResponse()).toMatchObject({
            success: false,
            error: expect.any(String),
            context: expect.any(String),
            timestamp: expect.any(String),
          });
        }
      }
    });
  });
});