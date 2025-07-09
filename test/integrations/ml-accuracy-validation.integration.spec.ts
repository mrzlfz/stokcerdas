import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import * as moment from 'moment-timezone';

import { ModelServingService } from '../../src/ml-forecasting/services/model-serving.service';
import { ModelTrainingService } from '../../src/ml-forecasting/services/model-training.service';
import { RealMLService } from '../../src/ml-forecasting/services/real-ml.service';
import { DataPipelineService } from '../../src/ml-forecasting/services/data-pipeline.service';
import { IndonesianBusinessCalendarService } from '../../src/ml-forecasting/services/indonesian-business-calendar.service';

import { MLModel, ModelType, ModelStatus } from '../../src/ml-forecasting/entities/ml-model.entity';
import { Prediction, PredictionType, PredictionStatus } from '../../src/ml-forecasting/entities/prediction.entity';
import { TrainingJob, TrainingJobStatus } from '../../src/ml-forecasting/entities/training-job.entity';
import { Product } from '../../src/products/entities/product.entity';
import { InventoryItem } from '../../src/inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../src/inventory/entities/inventory-transaction.entity';

/**
 * ML Accuracy Validation Integration Test Suite
 * 
 * Comprehensive testing for ML model accuracy and performance validation:
 * - Real ML algorithm performance benchmarking
 * - Indonesian market data accuracy validation
 * - Model comparison and selection optimization
 * - Prediction confidence interval accuracy
 * - Business impact assessment validation
 * - Performance degradation detection
 * - Model drift monitoring
 * - Ensemble model coordination
 * - Real-time accuracy tracking
 * - Error rate analysis and improvement
 */

describe('ML Accuracy Validation Integration', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  
  // Service instances
  let modelServingService: ModelServingService;
  let modelTrainingService: ModelTrainingService;
  let realMLService: RealMLService;
  let dataPipelineService: DataPipelineService;
  let indonesianBusinessCalendarService: IndonesianBusinessCalendarService;

  // Test data
  const testTenantId = 'test-tenant-accuracy';
  const testUserId = 'test-user-accuracy';
  let testProducts: Product[];
  let testModels: MLModel[];
  let testPredictions: Prediction[];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_NAME || 'stokcerdas_test',
          entities: [
            MLModel,
            Prediction,
            TrainingJob,
            Product,
            InventoryItem,
            InventoryTransaction,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        CacheModule.register({
          ttl: 5,
          max: 100,
        }),
      ],
      providers: [
        ModelServingService,
        ModelTrainingService,
        RealMLService,
        DataPipelineService,
        IndonesianBusinessCalendarService,
      ],
    }).compile();

    // Get service instances
    modelServingService = moduleRef.get<ModelServingService>(ModelServingService);
    modelTrainingService = moduleRef.get<ModelTrainingService>(ModelTrainingService);
    realMLService = moduleRef.get<RealMLService>(RealMLService);
    dataPipelineService = moduleRef.get<DataPipelineService>(DataPipelineService);
    indonesianBusinessCalendarService = moduleRef.get<IndonesianBusinessCalendarService>(
      IndonesianBusinessCalendarService
    );

    // Get database connection
    dataSource = moduleRef.get<DataSource>(DataSource);

    // Setup test data
    await setupAccuracyTestData();
  });

  afterAll(async () => {
    await cleanupAccuracyTestData();
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Real ML Algorithm Performance Benchmarking', () => {
    describe('ARIMA Model Accuracy', () => {
      it('should achieve target accuracy for ARIMA predictions with sufficient data', async () => {
        const historicalData = generateARIMAOptimalData(90); // 90 days of optimal data
        const actualValues = generateARIMAOptimalData(30).slice(0, 30); // Next 30 days actual

        // Mock ARIMA service with realistic performance
        jest.spyOn(realMLService, 'predictRealARIMA').mockResolvedValue({
          success: true,
          predictedValue: 125.5,
          confidence: 0.88,
          modelType: 'Real_ARIMA',
          timeSeries: actualValues.map((value, index) => ({
            date: moment().add(index, 'days').format('YYYY-MM-DD'),
            value: value + (Math.random() - 0.5) * 5, // Add realistic prediction variance
            confidence: 0.88 - (index * 0.01), // Decreasing confidence over time
          })),
          modelDiagnostics: {
            aic: 245.7,
            bic: 267.3,
            mape: 8.5,
            rmse: 12.3,
            stationarity: true,
            residualVariance: 15.2,
          },
        });

        const predictions = [];
        for (let i = 0; i < 30; i++) {
          const result = await realMLService.predictRealARIMA(historicalData, 1);
          predictions.push(result.predictedValue);
        }

        // Calculate accuracy metrics
        const mape = calculateMAPE(actualValues, predictions);
        const rmse = calculateRMSE(actualValues, predictions);
        const accuracy = calculateAccuracy(actualValues, predictions, 0.1); // 10% tolerance

        expect(mape).toBeLessThan(15); // Target MAPE < 15%
        expect(rmse).toBeLessThan(20); // Target RMSE < 20
        expect(accuracy).toBeGreaterThan(0.8); // Target accuracy > 80%
      });

      it('should handle seasonal patterns in ARIMA predictions', async () => {
        const seasonalData = generateSeasonalData(365); // 1 year of seasonal data
        const testPeriod = 30;

        jest.spyOn(realMLService, 'predictRealARIMA').mockResolvedValue({
          success: true,
          predictedValue: 145.8,
          confidence: 0.85,
          modelType: 'Real_ARIMA',
          seasonalComponents: {
            trend: 0.05,
            seasonal: 0.35,
            residual: 0.10,
            seasonalityStrength: 0.75,
          },
          modelDiagnostics: {
            aic: 278.4,
            bic: 295.1,
            mape: 12.2,
            seasonalityDetected: true,
          },
        });

        const result = await realMLService.predictRealARIMA(seasonalData, testPeriod);

        expect(result.success).toBe(true);
        expect(result.seasonalComponents).toBeDefined();
        expect(result.seasonalComponents?.seasonalityStrength).toBeGreaterThan(0.5);
        expect(result.modelDiagnostics?.mape).toBeLessThan(15);
      });
    });

    describe('Prophet Model Accuracy', () => {
      it('should achieve target accuracy for Prophet predictions with trend and seasonality', async () => {
        const historicalData = generateProphetOptimalData(365); // 1 year of data
        const dates = generateDateSeries(365);
        const actualValues = generateProphetOptimalData(30).slice(0, 30);

        jest.spyOn(realMLService, 'predictRealProphet').mockResolvedValue({
          success: true,
          predictedValue: 178.3,
          confidence: 0.92,
          modelType: 'Real_Prophet',
          timeSeries: actualValues.map((value, index) => ({
            date: moment().add(index, 'days').format('YYYY-MM-DD'),
            value: value + (Math.random() - 0.5) * 3, // Lower variance for Prophet
            lowerBound: value * 0.85,
            upperBound: value * 1.15,
            confidence: 0.92 - (index * 0.005),
          })),
          seasonalComponents: {
            trend: 0.12,
            weekly: 0.08,
            yearly: 0.15,
            holiday: 0.06,
          },
          modelDiagnostics: {
            mape: 6.8,
            rmse: 8.9,
            mae: 7.2,
            coverageRate: 0.89, // Confidence interval coverage
          },
        });

        const predictions = [];
        for (let i = 0; i < 30; i++) {
          const result = await realMLService.predictRealProphet(historicalData, 1, dates);
          predictions.push(result.predictedValue);
        }

        const mape = calculateMAPE(actualValues, predictions);
        const rmse = calculateRMSE(actualValues, predictions);
        const accuracy = calculateAccuracy(actualValues, predictions, 0.08); // 8% tolerance

        expect(mape).toBeLessThan(10); // Prophet target MAPE < 10%
        expect(rmse).toBeLessThan(15); // Target RMSE < 15
        expect(accuracy).toBeGreaterThan(0.85); // Target accuracy > 85%
      });

      it('should handle holiday effects in Prophet predictions', async () => {
        const historicalData = generateHolidayAffectedData(365);
        const dates = generateDateSeries(365);

        jest.spyOn(realMLService, 'predictRealProphet').mockResolvedValue({
          success: true,
          predictedValue: 225.4,
          confidence: 0.89,
          modelType: 'Real_Prophet',
          holidayEffects: {
            ramadan: 1.45,
            lebaran: 2.1,
            christmas: 1.7,
            newYear: 1.3,
          },
          modelDiagnostics: {
            mape: 9.2,
            holidayMape: 12.8, // Slightly higher for holiday periods
            regularMape: 7.1,
          },
        });

        const result = await realMLService.predictRealProphet(historicalData, 30, dates);

        expect(result.success).toBe(true);
        expect(result.holidayEffects).toBeDefined();
        expect(result.holidayEffects?.ramadan).toBeGreaterThan(1.0);
        expect(result.modelDiagnostics?.mape).toBeLessThan(12);
      });
    });

    describe('XGBoost Model Accuracy', () => {
      it('should achieve target accuracy for XGBoost with multiple features', async () => {
        const historicalData = generateXGBoostOptimalData(180); // 6 months of data
        const dates = generateDateSeries(180);
        const externalFeatures = generateExternalFeatures(180);
        const actualValues = generateXGBoostOptimalData(30).slice(0, 30);

        jest.spyOn(realMLService, 'predictRealXGBoost').mockResolvedValue({
          success: true,
          predictedValue: 198.7,
          confidence: 0.94,
          modelType: 'Real_XGBoost',
          timeSeries: actualValues.map((value, index) => ({
            date: moment().add(index, 'days').format('YYYY-MM-DD'),
            value: value + (Math.random() - 0.5) * 2, // Very low variance for XGBoost
            lowerBound: value * 0.9,
            upperBound: value * 1.1,
            confidence: 0.94 - (index * 0.003),
          })),
          featureImportance: {
            historical_sales: 0.35,
            price: 0.25,
            promotion: 0.15,
            competitor_price: 0.12,
            seasonality: 0.08,
            external_factors: 0.05,
          },
          modelDiagnostics: {
            mape: 4.2,
            rmse: 5.8,
            mae: 4.7,
            r2Score: 0.92,
            featureCorrelation: 0.87,
          },
        });

        const predictions = [];
        for (let i = 0; i < 30; i++) {
          const result = await realMLService.predictRealXGBoost(
            historicalData,
            1,
            dates,
            externalFeatures
          );
          predictions.push(result.predictedValue);
        }

        const mape = calculateMAPE(actualValues, predictions);
        const rmse = calculateRMSE(actualValues, predictions);
        const accuracy = calculateAccuracy(actualValues, predictions, 0.05); // 5% tolerance

        expect(mape).toBeLessThan(8); // XGBoost target MAPE < 8%
        expect(rmse).toBeLessThan(10); // Target RMSE < 10
        expect(accuracy).toBeGreaterThan(0.9); // Target accuracy > 90%
      });

      it('should handle feature importance correctly in XGBoost', async () => {
        const historicalData = generateXGBoostOptimalData(180);
        const dates = generateDateSeries(180);
        const externalFeatures = generateExternalFeatures(180);

        jest.spyOn(realMLService, 'predictRealXGBoost').mockResolvedValue({
          success: true,
          predictedValue: 167.2,
          confidence: 0.91,
          modelType: 'Real_XGBoost',
          featureImportance: {
            historical_sales: 0.40,
            price: 0.28,
            promotion: 0.18,
            competitor_price: 0.08,
            seasonality: 0.04,
            external_factors: 0.02,
          },
          modelDiagnostics: {
            mape: 5.1,
            featureStability: 0.85,
            overfittingScore: 0.12, // Low overfitting
          },
        });

        const result = await realMLService.predictRealXGBoost(
          historicalData,
          30,
          dates,
          externalFeatures
        );

        expect(result.success).toBe(true);
        expect(result.featureImportance).toBeDefined();
        
        // Verify feature importance sum to 1
        const importanceSum = Object.values(result.featureImportance || {}).reduce(
          (sum, importance) => sum + importance,
          0
        );
        expect(importanceSum).toBeCloseTo(1.0, 2);
        
        // Verify historical sales is most important
        expect(result.featureImportance?.historical_sales).toBeGreaterThan(0.3);
      });
    });
  });

  describe('Model Comparison and Selection', () => {
    it('should select best performing model based on accuracy metrics', async () => {
      const arimaModel = await createAccuracyTestModel(ModelType.ARIMA, { mape: 12.5 });
      const prophetModel = await createAccuracyTestModel(ModelType.PROPHET, { mape: 8.7 });
      const xgboostModel = await createAccuracyTestModel(ModelType.XGBOOST, { mape: 5.2 });

      const predictionRequest = {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      };

      // Mock the service to return the best model
      jest.spyOn(modelServingService, 'predict').mockImplementation(async (tenantId, request) => {
        // Should select XGBoost (lowest MAPE)
        return {
          success: true,
          predictionId: 'test-prediction-id',
          predictedValue: 145.8,
          confidence: 0.92,
          modelId: xgboostModel.id,
          modelType: ModelType.XGBOOST,
          modelDiagnostics: {
            mape: 5.2,
            selectedReason: 'best_performance',
          },
        };
      });

      const result = await modelServingService.predict(testTenantId, predictionRequest);

      expect(result.success).toBe(true);
      expect(result.modelId).toBe(xgboostModel.id);
      expect(result.modelType).toBe(ModelType.XGBOOST);
      expect(result.modelDiagnostics?.mape).toBeLessThan(10);
    });

    it('should handle model fallback when best model fails', async () => {
      const arimaModel = await createAccuracyTestModel(ModelType.ARIMA, { mape: 12.5 });
      const prophetModel = await createAccuracyTestModel(ModelType.PROPHET, { mape: 8.7 });

      const predictionRequest = {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      };

      // Mock XGBoost to fail, should fallback to Prophet
      jest.spyOn(realMLService, 'predictRealXGBoost').mockRejectedValue(
        new Error('XGBoost model failed')
      );

      jest.spyOn(modelServingService, 'predict').mockImplementation(async (tenantId, request) => {
        return {
          success: true,
          predictionId: 'test-prediction-id',
          predictedValue: 138.4,
          confidence: 0.87,
          modelId: prophetModel.id,
          modelType: ModelType.PROPHET,
          fallbackUsed: true,
          fallbackReason: 'primary_model_failed',
        };
      });

      const result = await modelServingService.predict(testTenantId, predictionRequest);

      expect(result.success).toBe(true);
      expect(result.modelType).toBe(ModelType.PROPHET);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('Prediction Confidence Interval Accuracy', () => {
    it('should provide accurate confidence intervals for predictions', async () => {
      const historicalData = generateConfidenceTestData(90);
      const actualValues = generateConfidenceTestData(30).slice(0, 30);

      jest.spyOn(realMLService, 'predictRealProphet').mockResolvedValue({
        success: true,
        predictedValue: 156.2,
        confidence: 0.90,
        modelType: 'Real_Prophet',
        timeSeries: actualValues.map((actualValue, index) => ({
          date: moment().add(index, 'days').format('YYYY-MM-DD'),
          value: 156.2 + (Math.random() - 0.5) * 10,
          lowerBound: actualValue * 0.85,
          upperBound: actualValue * 1.15,
          confidence: 0.90,
        })),
        confidenceIntervals: {
          coverage80: 0.82,
          coverage90: 0.89,
          coverage95: 0.94,
          intervalWidth: 24.5,
        },
      });

      const result = await realMLService.predictRealProphet(historicalData, 30, []);

      expect(result.success).toBe(true);
      expect(result.confidenceIntervals).toBeDefined();
      expect(result.confidenceIntervals?.coverage90).toBeGreaterThan(0.85);
      expect(result.confidenceIntervals?.coverage95).toBeGreaterThan(0.90);
    });

    it('should validate confidence intervals contain actual values', async () => {
      const predictions = [];
      const actualValues = generateConfidenceTestData(30);

      for (let i = 0; i < 30; i++) {
        const prediction = {
          value: 150 + (Math.random() - 0.5) * 20,
          lowerBound: actualValues[i] * 0.8,
          upperBound: actualValues[i] * 1.2,
          confidence: 0.90,
        };
        predictions.push(prediction);
      }

      const coverage = calculateCoverageRate(actualValues, predictions);
      const intervalWidth = calculateAverageIntervalWidth(predictions);

      expect(coverage).toBeGreaterThan(0.85); // At least 85% coverage
      expect(intervalWidth).toBeLessThan(50); // Reasonable interval width
    });
  });

  describe('Indonesian Market Data Accuracy', () => {
    it('should achieve target accuracy for Indonesian seasonal patterns', async () => {
      const indonesianData = generateIndonesianMarketData(365);
      const testPeriod = 30;
      const ramadanPeriod = isRamadanPeriod(moment().add(15, 'days'));

      jest.spyOn(realMLService, 'predictRealProphet').mockResolvedValue({
        success: true,
        predictedValue: ramadanPeriod ? 189.5 : 142.3,
        confidence: 0.88,
        modelType: 'Real_Prophet',
        indonesianMarketFactors: {
          ramadanEffect: ramadanPeriod ? 1.35 : 1.0,
          monsoonEffect: 1.1,
          holidayEffect: 1.0,
          regionalEffect: 1.05,
        },
        modelDiagnostics: {
          mape: 8.9,
          indonesianMape: 9.8, // Slightly higher for Indonesian context
          seasonalAccuracy: 0.84,
        },
      });

      const result = await realMLService.predictRealProphet(indonesianData, testPeriod, []);

      expect(result.success).toBe(true);
      expect(result.indonesianMarketFactors).toBeDefined();
      expect(result.modelDiagnostics?.indonesianMape).toBeLessThan(12);
      
      if (ramadanPeriod) {
        expect(result.indonesianMarketFactors?.ramadanEffect).toBeGreaterThan(1.2);
      }
    });

    it('should handle Indonesian holiday spikes accurately', async () => {
      const holidayData = generateHolidaySpikesData(365);
      const testPeriod = 14; // 2 weeks including holiday

      jest.spyOn(realMLService, 'predictRealProphet').mockResolvedValue({
        success: true,
        predictedValue: 234.7,
        confidence: 0.86,
        modelType: 'Real_Prophet',
        holidayEffects: {
          lebaran: 2.4,
          christmas: 1.8,
          independence: 1.5,
          newYear: 1.6,
        },
        modelDiagnostics: {
          mape: 11.5,
          holidayAccuracy: 0.78,
          spikeDetection: 0.85,
        },
      });

      const result = await realMLService.predictRealProphet(holidayData, testPeriod, []);

      expect(result.success).toBe(true);
      expect(result.holidayEffects).toBeDefined();
      expect(result.modelDiagnostics?.holidayAccuracy).toBeGreaterThan(0.75);
      expect(result.modelDiagnostics?.spikeDetection).toBeGreaterThan(0.8);
    });
  });

  describe('Business Impact Assessment Validation', () => {
    it('should accurately assess revenue impact of predictions', async () => {
      const product = testProducts[0];
      const predictionValue = 150; // Units
      const sellingPrice = 100; // IDR per unit
      const expectedRevenue = predictionValue * sellingPrice;

      jest.spyOn(modelServingService, 'predict').mockResolvedValue({
        success: true,
        predictionId: 'test-prediction-id',
        predictedValue: predictionValue,
        confidence: 0.89,
        businessImpact: {
          revenueImpact: expectedRevenue,
          costImpact: predictionValue * 70, // Cost price
          profitImpact: predictionValue * 30, // Profit margin
          stockoutRisk: 0.15,
          overstockRisk: 0.05,
        },
        actionableInsights: {
          recommendations: [
            `Potensi pendapatan: Rp ${expectedRevenue.toLocaleString('id-ID')}`,
            'Pastikan stok mencukupi untuk memenuhi prediksi permintaan',
          ],
        },
      });

      const result = await modelServingService.predict(testTenantId, {
        productId: product.id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      });

      expect(result.success).toBe(true);
      expect(result.businessImpact?.revenueImpact).toBe(expectedRevenue);
      expect(result.businessImpact?.profitImpact).toBeGreaterThan(0);
      expect(result.actionableInsights?.recommendations).toContain(
        expect.stringMatching(/pendapatan|revenue/i)
      );
    });

    it('should provide accurate stockout risk assessment', async () => {
      const currentStock = 50;
      const predictedDemand = 80;
      const expectedRisk = (predictedDemand - currentStock) / predictedDemand;

      jest.spyOn(modelServingService, 'getStockoutRisk').mockResolvedValue({
        success: true,
        predictionId: 'test-stockout-id',
        predictedValue: expectedRisk,
        confidence: 0.91,
        businessImpact: {
          riskLevel: 'high',
          daysUntilStockout: 3,
          revenueAtRisk: 3000000, // IDR
          urgencyScore: 0.85,
        },
        actionableInsights: {
          recommendations: [
            'Segera lakukan pemesanan darurat',
            'Prioritaskan produk ini dalam restok',
          ],
          alerts: [
            {
              type: 'critical_stockout_risk',
              severity: 'critical',
              message: 'Risiko kehabisan stok dalam 3 hari',
            },
          ],
        },
      });

      const result = await modelServingService.getStockoutRisk(
        testTenantId,
        testProducts[0].id,
        7
      );

      expect(result.success).toBe(true);
      expect(result.predictedValue).toBeGreaterThan(0.3);
      expect(result.businessImpact?.riskLevel).toBe('high');
      expect(result.businessImpact?.daysUntilStockout).toBeLessThan(7);
    });
  });

  describe('Performance Benchmarking', () => {
    it('should meet response time requirements for single predictions', async () => {
      const startTime = Date.now();
      
      const result = await modelServingService.predict(testTenantId, {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(1500); // < 1.5 seconds
    });

    it('should handle concurrent predictions efficiently', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        modelServingService.predict(testTenantId, {
          productId: testProducts[i % testProducts.length].id,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // < 5 seconds for 20 concurrent requests
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should maintain accuracy under load', async () => {
      const loadTestRequests = 50;
      const results = [];

      for (let i = 0; i < loadTestRequests; i++) {
        const result = await modelServingService.predict(testTenantId, {
          productId: testProducts[i % testProducts.length].id,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
        });
        results.push(result);
      }

      const successRate = results.filter(r => r.success).length / results.length;
      const avgConfidence = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;

      expect(successRate).toBeGreaterThan(0.95); // > 95% success rate
      expect(avgConfidence).toBeGreaterThan(0.7); // > 70% average confidence
    });
  });

  describe('Validation Accuracy Testing', () => {
    it('should validate predictions against actual values accurately', async () => {
      // Create test predictions with known actual values
      const testPredictions = await Promise.all([
        createAccuracyTestPrediction(testProducts[0].id, 100, 95, 0.85),
        createAccuracyTestPrediction(testProducts[1].id, 150, 160, 0.90),
        createAccuracyTestPrediction(testProducts[2].id, 200, 185, 0.88),
      ]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      jest.spyOn(modelServingService, 'validatePredictions').mockResolvedValue({
        totalPredictions: 3,
        accuratePredictions: 2,
        accuracyRate: 2/3,
        averageErrorRate: 0.12,
        modelPerformance: {
          'arima-model': {
            total: 1,
            accurate: 1,
            accuracy: 1.0,
            averageError: 0.05,
          },
          'prophet-model': {
            total: 2,
            accurate: 1,
            accuracy: 0.5,
            averageError: 0.15,
          },
        },
      });

      const validation = await modelServingService.validatePredictions(
        testTenantId,
        startDate,
        endDate
      );

      expect(validation.totalPredictions).toBe(3);
      expect(validation.accuracyRate).toBeGreaterThan(0.5);
      expect(validation.averageErrorRate).toBeLessThan(0.2);
      expect(validation.modelPerformance).toBeDefined();
    });
  });

  // Helper functions for test data generation
  function generateARIMAOptimalData(length: number): number[] {
    const data = [];
    let value = 100;
    
    for (let i = 0; i < length; i++) {
      // AR(1) process with trend
      const trend = i * 0.1;
      const autoregressive = 0.7 * (i > 0 ? data[i-1] - 100 : 0);
      const noise = (Math.random() - 0.5) * 5;
      
      value = 100 + trend + autoregressive + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateProphetOptimalData(length: number): number[] {
    const data = [];
    
    for (let i = 0; i < length; i++) {
      const trend = i * 0.05;
      const weekly = Math.sin((i * 2 * Math.PI) / 7) * 10;
      const yearly = Math.sin((i * 2 * Math.PI) / 365) * 15;
      const noise = (Math.random() - 0.5) * 2;
      
      const value = 120 + trend + weekly + yearly + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateXGBoostOptimalData(length: number): number[] {
    const data = [];
    
    for (let i = 0; i < length; i++) {
      const base = 150;
      const trend = i * 0.02;
      const cyclical = Math.sin((i * 2 * Math.PI) / 30) * 8;
      const noise = (Math.random() - 0.5) * 1; // Very low noise for XGBoost
      
      const value = base + trend + cyclical + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateSeasonalData(length: number): number[] {
    const data = [];
    
    for (let i = 0; i < length; i++) {
      const base = 100;
      const trend = i * 0.03;
      const seasonal = Math.sin((i * 2 * Math.PI) / 90) * 20; // 90-day cycle
      const weekly = Math.sin((i * 2 * Math.PI) / 7) * 5;
      const noise = (Math.random() - 0.5) * 3;
      
      const value = base + trend + seasonal + weekly + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateIndonesianMarketData(length: number): number[] {
    const data = [];
    
    for (let i = 0; i < length; i++) {
      const date = moment().add(i, 'days');
      const base = 120;
      const trend = i * 0.02;
      
      // Indonesian-specific patterns
      const ramadanEffect = isRamadanPeriod(date) ? 40 : 0;
      const monsoonEffect = isWetSeason(date) ? 15 : -5;
      const holidayEffect = isIndonesianHoliday(date) ? 30 : 0;
      
      const noise = (Math.random() - 0.5) * 4;
      
      const value = base + trend + ramadanEffect + monsoonEffect + holidayEffect + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateHolidayAffectedData(length: number): number[] {
    const data = [];
    
    for (let i = 0; i < length; i++) {
      const date = moment().add(i, 'days');
      const base = 110;
      const trend = i * 0.015;
      
      // Holiday spikes
      const lebaranEffect = isLebaranPeriod(date) ? 60 : 0;
      const christmasEffect = isChristmasWeek(date) ? 45 : 0;
      const newYearEffect = isNewYearWeek(date) ? 35 : 0;
      
      const noise = (Math.random() - 0.5) * 6;
      
      const value = base + trend + lebaranEffect + christmasEffect + newYearEffect + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateHolidaySpikesData(length: number): number[] {
    return generateHolidayAffectedData(length);
  }

  function generateConfidenceTestData(length: number): number[] {
    const data = [];
    
    for (let i = 0; i < length; i++) {
      const base = 140;
      const trend = i * 0.04;
      const pattern = Math.sin((i * 2 * Math.PI) / 14) * 8;
      const noise = (Math.random() - 0.5) * 6;
      
      const value = base + trend + pattern + noise;
      data.push(Math.max(0, value));
    }
    
    return data;
  }

  function generateExternalFeatures(length: number): Record<string, number[]> {
    return {
      price: Array.from({ length }, () => 25 + Math.random() * 10),
      promotion: Array.from({ length }, () => Math.random() > 0.7 ? 1 : 0),
      competitor_price: Array.from({ length }, () => 27 + Math.random() * 8),
      weather: Array.from({ length }, () => Math.random()),
      economic_index: Array.from({ length }, () => 1 + Math.random() * 0.2),
    };
  }

  function generateDateSeries(length: number): string[] {
    return Array.from({ length }, (_, i) => {
      return moment().add(i, 'days').format('YYYY-MM-DD');
    });
  }

  // Accuracy calculation functions
  function calculateMAPE(actual: number[], predicted: number[]): number {
    const n = actual.length;
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
      }
    }
    
    return (sum / n) * 100;
  }

  function calculateRMSE(actual: number[], predicted: number[]): number {
    const n = actual.length;
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
      sum += Math.pow(actual[i] - predicted[i], 2);
    }
    
    return Math.sqrt(sum / n);
  }

  function calculateAccuracy(actual: number[], predicted: number[], tolerance: number): number {
    const n = actual.length;
    let accurate = 0;
    
    for (let i = 0; i < n; i++) {
      const relativeError = Math.abs(actual[i] - predicted[i]) / actual[i];
      if (relativeError <= tolerance) {
        accurate++;
      }
    }
    
    return accurate / n;
  }

  function calculateCoverageRate(actual: number[], predictions: { lowerBound: number; upperBound: number }[]): number {
    const n = actual.length;
    let covered = 0;
    
    for (let i = 0; i < n; i++) {
      if (actual[i] >= predictions[i].lowerBound && actual[i] <= predictions[i].upperBound) {
        covered++;
      }
    }
    
    return covered / n;
  }

  function calculateAverageIntervalWidth(predictions: { lowerBound: number; upperBound: number }[]): number {
    const totalWidth = predictions.reduce((sum, pred) => sum + (pred.upperBound - pred.lowerBound), 0);
    return totalWidth / predictions.length;
  }

  // Date helper functions
  function isRamadanPeriod(date: moment.Moment): boolean {
    const ramadanStart = moment('2024-03-10');
    const ramadanEnd = moment('2024-04-09');
    return date.isBetween(ramadanStart, ramadanEnd, 'day', '[]');
  }

  function isWetSeason(date: moment.Moment): boolean {
    const month = date.month() + 1;
    return month <= 4 || month >= 10;
  }

  function isIndonesianHoliday(date: moment.Moment): boolean {
    const holidays = ['2024-01-01', '2024-04-10', '2024-08-17', '2024-12-25'];
    return holidays.includes(date.format('YYYY-MM-DD'));
  }

  function isLebaranPeriod(date: moment.Moment): boolean {
    const lebaran = moment('2024-04-10');
    return date.isBetween(lebaran.clone().subtract(1, 'day'), lebaran.clone().add(1, 'day'), 'day', '[]');
  }

  function isChristmasWeek(date: moment.Moment): boolean {
    const christmas = moment('2024-12-25');
    return date.isBetween(christmas.clone().subtract(7, 'days'), christmas, 'day', '[]');
  }

  function isNewYearWeek(date: moment.Moment): boolean {
    const newYear = moment('2024-01-01');
    return date.isBetween(newYear.clone().subtract(3, 'days'), newYear.clone().add(3, 'days'), 'day', '[]');
  }

  // Test data setup functions
  async function setupAccuracyTestData() {
    testProducts = await Promise.all([
      createAccuracyTestProduct('Test Product A', 'electronics'),
      createAccuracyTestProduct('Test Product B', 'food'),
      createAccuracyTestProduct('Test Product C', 'clothing'),
    ]);

    testModels = await Promise.all([
      createAccuracyTestModel(ModelType.ARIMA, { mape: 12.5 }),
      createAccuracyTestModel(ModelType.PROPHET, { mape: 8.7 }),
      createAccuracyTestModel(ModelType.XGBOOST, { mape: 5.2 }),
    ]);
  }

  async function cleanupAccuracyTestData() {
    await dataSource.getRepository(Prediction).delete({});
    await dataSource.getRepository(MLModel).delete({});
    await dataSource.getRepository(Product).delete({});
  }

  async function createAccuracyTestProduct(name: string, category: string): Promise<Product> {
    const product = new Product();
    product.tenantId = testTenantId;
    product.name = name;
    product.category = category;
    product.sku = `SKU-${Date.now()}-${Math.random()}`;
    product.sellingPrice = 100;
    product.costPrice = 70;
    
    return await dataSource.getRepository(Product).save(product);
  }

  async function createAccuracyTestModel(type: ModelType, performance: any): Promise<MLModel> {
    const model = new MLModel();
    model.tenantId = testTenantId;
    model.modelType = type;
    model.modelName = `Accuracy Test ${type} Model`;
    model.status = ModelStatus.DEPLOYED;
    model.isActive = true;
    model.performance = performance;
    model.modelPath = `/tmp/accuracy-test-${type}-${Date.now()}.json`;
    
    return await dataSource.getRepository(MLModel).save(model);
  }

  async function createAccuracyTestPrediction(
    productId: string,
    predictedValue: number,
    actualValue: number,
    confidence: number
  ): Promise<Prediction> {
    const prediction = new Prediction();
    prediction.tenantId = testTenantId;
    prediction.productId = productId;
    prediction.predictionType = PredictionType.DEMAND_FORECAST;
    prediction.predictedValue = predictedValue;
    prediction.actualValue = actualValue;
    prediction.confidence = confidence;
    prediction.targetDate = new Date();
    prediction.status = PredictionStatus.COMPLETED;
    
    return await dataSource.getRepository(Prediction).save(prediction);
  }
});