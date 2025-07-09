import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { MLForecastingModule } from '../../src/ml-forecasting/ml-forecasting.module';
import { ModelServingService } from '../../src/ml-forecasting/services/model-serving.service';
import { ModelTrainingService } from '../../src/ml-forecasting/services/model-training.service';
import { DataPipelineService } from '../../src/ml-forecasting/services/data-pipeline.service';
import { RealMLService } from '../../src/ml-forecasting/services/real-ml.service';
import { IndonesianBusinessCalendarService } from '../../src/ml-forecasting/services/indonesian-business-calendar.service';

import { MLModel, ModelType, ModelStatus } from '../../src/ml-forecasting/entities/ml-model.entity';
import { Prediction, PredictionType, PredictionStatus } from '../../src/ml-forecasting/entities/prediction.entity';
import { TrainingJob, TrainingJobStatus } from '../../src/ml-forecasting/entities/training-job.entity';
import { Product } from '../../src/products/entities/product.entity';
import { InventoryItem } from '../../src/inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../../src/inventory/entities/inventory-transaction.entity';
import { User, UserRole } from '../../src/users/entities/user.entity';

import { AuthModule } from '../../src/auth/auth.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';

/**
 * Comprehensive ML Forecasting Integration Test Suite
 * 
 * Tests:
 * - ML model serving with real prediction algorithms
 * - Indonesian business calendar integration
 * - Multi-model prediction coordination
 * - Error handling and fallback mechanisms
 * - Performance benchmarking
 * - Data pipeline integration
 * - Real-time prediction updates
 * - Comprehensive business context validation
 */

describe('ML Forecasting Integration Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  // Service instances
  let modelServingService: ModelServingService;
  let modelTrainingService: ModelTrainingService;
  let dataPipelineService: DataPipelineService;
  let realMLService: RealMLService;
  let indonesianBusinessCalendarService: IndonesianBusinessCalendarService;

  // Test data
  let testTenantId: string;
  let testUserId: string;
  let testProducts: Product[];
  let testInventoryItems: InventoryItem[];
  let testModels: MLModel[];
  let testPredictions: Prediction[];
  let testJwtToken: string;

  beforeAll(async () => {
    // Setup test database and application
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
            User,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        CacheModule.register({
          ttl: 5, // Short TTL for testing
          max: 100,
        }),
        AuthModule,
        MLForecastingModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Get service instances
    modelServingService = moduleRef.get<ModelServingService>(ModelServingService);
    modelTrainingService = moduleRef.get<ModelTrainingService>(ModelTrainingService);
    dataPipelineService = moduleRef.get<DataPipelineService>(DataPipelineService);
    realMLService = moduleRef.get<RealMLService>(RealMLService);
    indonesianBusinessCalendarService = moduleRef.get<IndonesianBusinessCalendarService>(IndonesianBusinessCalendarService);

    // Get database connection
    dataSource = moduleRef.get<DataSource>(DataSource);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Reset any cached data between tests
    jest.clearAllMocks();
  });

  describe('ML Model Serving Integration', () => {
    describe('Basic Prediction Generation', () => {
      it('should generate demand forecast prediction with high confidence', async () => {
        const predictionRequest = {
          productId: testProducts[0].id,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
          includeConfidenceInterval: true,
          features: {
            historicalSales: 100,
            seasonalFactor: 1.2,
            marketTrend: 0.1,
          },
        };

        const result = await modelServingService.predict(testTenantId, predictionRequest);

        expect(result.success).toBe(true);
        expect(result.predictionId).toBeDefined();
        expect(result.predictedValue).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.lowerBound).toBeLessThan(result.predictedValue);
        expect(result.upperBound).toBeGreaterThan(result.predictedValue);
        expect(result.actionableInsights).toBeDefined();
        expect(result.actionableInsights?.recommendations).toHaveLength(
          expect.any(Number)
        );
      });

      it('should generate stockout risk analysis with business context', async () => {
        const predictionRequest = {
          productId: testProducts[0].id,
          predictionType: PredictionType.STOCKOUT_RISK,
          forecastDays: 7,
          features: {
            currentStock: 50,
            dailyDemand: 10,
            leadTime: 3,
            safetyStock: 15,
          },
        };

        const result = await modelServingService.predict(testTenantId, predictionRequest);

        expect(result.success).toBe(true);
        expect(result.predictedValue).toBeGreaterThanOrEqual(0);
        expect(result.predictedValue).toBeLessThanOrEqual(1);
        expect(result.actionableInsights?.alerts).toBeDefined();
        
        // Verify Indonesian localization
        const recommendations = result.actionableInsights?.recommendations || [];
        expect(recommendations.some(r => r.includes('stok') || r.includes('prediksi'))).toBe(true);
      });

      it('should generate optimal reorder recommendations', async () => {
        const predictionRequest = {
          productId: testProducts[0].id,
          predictionType: PredictionType.OPTIMAL_REORDER,
          features: {
            currentStock: 20,
            demandForecast: 150,
            leadTime: 5,
            orderCost: 50,
            holdingCost: 2,
          },
        };

        const result = await modelServingService.predict(testTenantId, predictionRequest);

        expect(result.success).toBe(true);
        expect(result.predictedValue).toBeGreaterThan(0);
        expect(result.actionableInsights?.recommendations).toBeDefined();
        
        // Verify business impact calculation
        expect(result.actionableInsights?.recommendations.some(r => 
          r.includes('optimal') || r.includes('pemesanan')
        )).toBe(true);
      });
    });

    describe('Multi-Model Coordination', () => {
      it('should use best performing model for predictions', async () => {
        // Create multiple models with different performance scores
        const models = await Promise.all([
          createTestModel(ModelType.ARIMA, { mape: 15 }),
          createTestModel(ModelType.PROPHET, { mape: 12 }),
          createTestModel(ModelType.XGBOOST, { mape: 8 }),
        ]);

        const predictionRequest = {
          productId: testProducts[0].id,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
        };

        const result = await modelServingService.predict(testTenantId, predictionRequest);

        expect(result.success).toBe(true);
        
        // Verify it used the best performing model (XGBoost with lowest MAPE)
        const prediction = await dataSource.getRepository(Prediction).findOne({
          where: { id: result.predictionId },
          relations: ['model'],
        });
        
        expect(prediction?.model?.modelType).toBe(ModelType.XGBOOST);
      });

      it('should handle model fallback when preferred model fails', async () => {
        const predictionRequest = {
          modelId: 'non-existent-model-id',
          productId: testProducts[0].id,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
        };

        const result = await modelServingService.predict(testTenantId, predictionRequest);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.actionableInsights?.recommendations).toContain(
          expect.stringMatching(/data input|produk terdaftar|administrator/)
        );
      });
    });

    describe('Batch Processing', () => {
      it('should process batch predictions efficiently', async () => {
        const productIds = testProducts.slice(0, 3).map(p => p.id);
        const batchRequest = {
          productIds,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
        };

        const results = await modelServingService.batchPredict(testTenantId, batchRequest);

        expect(Object.keys(results)).toHaveLength(3);
        
        productIds.forEach(productId => {
          expect(results[productId]).toBeDefined();
          expect(results[productId].success).toBe(true);
          expect(results[productId].predictedValue).toBeGreaterThan(0);
        });
      });

      it('should handle partial batch failures gracefully', async () => {
        const productIds = [
          testProducts[0].id,
          'non-existent-product-id',
          testProducts[1].id,
        ];
        
        const batchRequest = {
          productIds,
          predictionType: PredictionType.DEMAND_FORECAST,
          forecastDays: 30,
        };

        const results = await modelServingService.batchPredict(testTenantId, batchRequest);

        expect(Object.keys(results)).toHaveLength(3);
        expect(results[testProducts[0].id].success).toBe(true);
        expect(results['non-existent-product-id'].success).toBe(false);
        expect(results[testProducts[1].id].success).toBe(true);
      });
    });
  });

  describe('Indonesian Business Calendar Integration', () => {
    it('should consider Ramadan effects in demand forecasting', async () => {
      // Mock Ramadan period
      jest.spyOn(indonesianBusinessCalendarService, 'isRamadanPeriod').mockReturnValue(true);
      jest.spyOn(indonesianBusinessCalendarService, 'getRamadanEffectMultiplier').mockReturnValue(1.8);

      const predictionRequest = {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
        features: {
          categoryType: 'food',
          isRamadanSensitive: true,
        },
      };

      const result = await modelServingService.predict(testTenantId, predictionRequest);

      expect(result.success).toBe(true);
      expect(result.predictedValue).toBeGreaterThan(0);
      
      // Verify Ramadan context is considered
      expect(result.actionableInsights?.recommendations).toContain(
        expect.stringMatching(/ramadan|lebaran|puasa/i)
      );
    });

    it('should handle Indonesian public holidays in forecasting', async () => {
      const lebaranDate = new Date('2024-04-10');
      jest.spyOn(indonesianBusinessCalendarService, 'isPublicHoliday').mockReturnValue(true);
      jest.spyOn(indonesianBusinessCalendarService, 'getHolidayInfo').mockReturnValue({
        name: 'Hari Raya Idul Fitri',
        type: 'religious',
        effectMultiplier: 2.5,
        preparationDays: 7,
      });

      const predictionRequest = {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        targetDate: lebaranDate,
        forecastDays: 14,
      };

      const result = await modelServingService.predict(testTenantId, predictionRequest);

      expect(result.success).toBe(true);
      expect(result.predictedValue).toBeGreaterThan(0);
      
      // Verify holiday effects are considered
      expect(result.actionableInsights?.recommendations).toContain(
        expect.stringMatching(/lebaran|idul fitri|hari raya/i)
      );
    });

    it('should apply Indonesian business hours optimization', async () => {
      // Mock business hours
      jest.spyOn(indonesianBusinessCalendarService, 'getBusinessHours').mockReturnValue({
        start: '08:00',
        end: '17:00',
        timezone: 'Asia/Jakarta',
        breakHours: [{ start: '12:00', end: '13:00' }],
      });

      const predictionRequest = {
        productId: testProducts[0].id,
        predictionType: PredictionType.STOCKOUT_RISK,
        forecastDays: 7,
        features: {
          businessHoursOnly: true,
        },
      };

      const result = await modelServingService.predict(testTenantId, predictionRequest);

      expect(result.success).toBe(true);
      expect(result.predictedValue).toBeGreaterThanOrEqual(0);
      expect(result.predictedValue).toBeLessThanOrEqual(1);
    });
  });

  describe('Real ML Algorithm Integration', () => {
    describe('ARIMA Model Integration', () => {
      it('should execute real ARIMA predictions with sufficient data', async () => {
        const historicalData = generateHistoricalData(30);
        const mockModel = {
          type: 'arima',
          historicalData,
          performance: { mape: 12 },
        };

        jest.spyOn(realMLService, 'predictRealARIMA').mockResolvedValue({
          success: true,
          predictedValue: 125.5,
          confidence: 0.85,
          modelType: 'Real_ARIMA',
          timeSeries: [
            { date: '2024-01-01', value: 125.5, confidence: 0.85 },
            { date: '2024-01-02', value: 127.2, confidence: 0.84 },
          ],
        });

        const result = await modelServingService['predictRealARIMA'](mockModel, {}, 2);

        expect(result).toBe(125.5);
        expect(realMLService.predictRealARIMA).toHaveBeenCalledWith(
          historicalData,
          2
        );
      });

      it('should fallback to linear regression when ARIMA fails', async () => {
        const mockModel = {
          type: 'arima',
          historicalData: [1, 2, 3], // Insufficient data
          lastValues: [10, 12, 15],
        };

        jest.spyOn(realMLService, 'predictRealARIMA').mockRejectedValue(
          new Error('Insufficient data for ARIMA')
        );

        const result = await modelServingService['predictRealARIMA'](mockModel, {}, 7);

        expect(result).toBe(17); // 15 + (15-12) trend
      });
    });

    describe('Prophet Model Integration', () => {
      it('should execute real Prophet predictions with seasonality', async () => {
        const historicalData = generateHistoricalData(60);
        const dates = generateDateSeries(60);
        const mockModel = {
          type: 'prophet',
          historicalData,
          dates,
          config: {
            yearly_seasonality: true,
            weekly_seasonality: true,
            seasonality_mode: 'multiplicative',
          },
        };

        jest.spyOn(realMLService, 'predictRealProphet').mockResolvedValue({
          success: true,
          predictedValue: 98.7,
          confidence: 0.92,
          modelType: 'Real_Prophet',
          seasonalComponents: {
            trend: 0.1,
            seasonal: 0.3,
            yearly: 0.05,
          },
        });

        const result = await modelServingService['predictRealProphet'](mockModel, {}, 7);

        expect(result).toBe(98.7);
        expect(realMLService.predictRealProphet).toHaveBeenCalledWith(
          historicalData,
          7,
          dates,
          expect.objectContaining({
            yearly_seasonality: true,
            weekly_seasonality: true,
            seasonality_mode: 'multiplicative',
          })
        );
      });
    });

    describe('XGBoost Model Integration', () => {
      it('should execute real XGBoost predictions with external features', async () => {
        const historicalData = generateHistoricalData(45);
        const mockModel = {
          type: 'xgboost',
          historicalData,
          config: {
            hyperparameters: {
              n_estimators: 100,
              max_depth: 6,
              learning_rate: 0.1,
            },
          },
        };

        const externalFeatures = {
          price: 25.5,
          promotion: 1,
          competitor_price: 27.0,
        };

        jest.spyOn(realMLService, 'predictRealXGBoost').mockResolvedValue({
          success: true,
          predictedValue: 142.3,
          confidence: 0.88,
          modelType: 'Real_XGBoost',
          featureImportance: {
            price: 0.45,
            promotion: 0.30,
            competitor_price: 0.25,
          },
        });

        const result = await modelServingService['predictRealXGBoost'](mockModel, externalFeatures, 14);

        expect(result).toBe(142.3);
        expect(realMLService.predictRealXGBoost).toHaveBeenCalledWith(
          historicalData,
          14,
          null,
          expect.objectContaining({
            price: expect.arrayContaining([25.5]),
            promotion: expect.arrayContaining([1]),
            competitor_price: expect.arrayContaining([27.0]),
          }),
          expect.objectContaining({
            n_estimators: 100,
            max_depth: 6,
            learning_rate: 0.1,
          })
        );
      });
    });
  });

  describe('Data Pipeline Integration', () => {
    it('should extract and transform historical data correctly', async () => {
      const config = {
        dateRange: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
        aggregation: 'daily' as const,
        features: ['sales', 'price', 'promotion'],
        target: 'quantity',
      };

      const timeSeriesData = await dataPipelineService.extractTimeSeries(
        testTenantId,
        config
      );

      expect(timeSeriesData).toHaveLength(expect.any(Number));
      expect(timeSeriesData[0]).toMatchObject({
        date: expect.any(String),
        value: expect.any(Number),
        productId: expect.any(String),
      });
    });

    it('should extract product features for ML models', async () => {
      const productIds = [testProducts[0].id];
      const config = {
        dateRange: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
        aggregation: 'daily' as const,
        features: ['price', 'cost', 'category'],
        target: 'quantity',
      };

      const features = await dataPipelineService.extractFeatures(
        testTenantId,
        productIds,
        config
      );

      expect(features).toHaveLength(1);
      expect(features[0]).toMatchObject({
        productFeatures: expect.any(Object),
        temporalFeatures: expect.any(Object),
        inventoryFeatures: expect.any(Object),
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle concurrent predictions efficiently', async () => {
      const concurrentRequests = 10;
      const predictions = await Promise.all(
        Array.from({ length: concurrentRequests }, (_, i) => 
          modelServingService.predict(testTenantId, {
            productId: testProducts[i % testProducts.length].id,
            predictionType: PredictionType.DEMAND_FORECAST,
            forecastDays: 30,
          })
        )
      );

      expect(predictions).toHaveLength(concurrentRequests);
      predictions.forEach(prediction => {
        expect(prediction.success).toBe(true);
        expect(prediction.predictedValue).toBeGreaterThan(0);
      });
    });

    it('should meet performance benchmarks for prediction generation', async () => {
      const startTime = Date.now();
      
      const result = await modelServingService.predict(testTenantId, {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // < 2 seconds
    });

    it('should handle large batch predictions within time limits', async () => {
      const largeProductBatch = testProducts.map(p => p.id);
      const startTime = Date.now();

      const results = await modelServingService.batchPredict(testTenantId, {
        productIds: largeProductBatch,
        predictionType: PredictionType.STOCKOUT_RISK,
        forecastDays: 7,
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(Object.keys(results)).toHaveLength(largeProductBatch.length);
      expect(executionTime).toBeLessThan(10000); // < 10 seconds for batch
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle invalid prediction requests gracefully', async () => {
      const invalidRequest = {
        productId: 'invalid-product-id',
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      };

      const result = await modelServingService.predict(testTenantId, invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.actionableInsights?.recommendations).toBeDefined();
    });

    it('should validate prediction accuracy against actual values', async () => {
      // Create test predictions
      const testPrediction = await createTestPrediction(testProducts[0].id, 100, 0.85);
      
      // Mock actual values
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const validation = await modelServingService.validatePredictions(
        testTenantId,
        startDate,
        endDate
      );

      expect(validation.totalPredictions).toBeGreaterThan(0);
      expect(validation.accuracyRate).toBeGreaterThanOrEqual(0);
      expect(validation.averageErrorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API Integration Tests', () => {
    it('should handle POST /api/v1/ml/predictions/predict', async () => {
      const predictionDto = {
        productId: testProducts[0].id,
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
        includeConfidenceInterval: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/ml/predictions/predict')
        .set('Authorization', `Bearer ${testJwtToken}`)
        .send(predictionDto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.predictionId).toBeDefined();
      expect(response.body.predictedValue).toBeGreaterThan(0);
      expect(response.body.confidence).toBeGreaterThan(0);
      expect(response.body.confidenceLevel).toBeDefined();
    });

    it('should handle POST /api/v1/ml/predictions/batch-predict', async () => {
      const batchDto = {
        productIds: testProducts.slice(0, 3).map(p => p.id),
        predictionType: PredictionType.DEMAND_FORECAST,
        forecastDays: 30,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/ml/predictions/batch-predict')
        .set('Authorization', `Bearer ${testJwtToken}`)
        .send(batchDto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.summary.total).toBe(3);
      expect(response.body.summary.successful).toBeGreaterThan(0);
    });

    it('should handle POST /api/v1/ml/predictions/demand-forecast', async () => {
      const forecastDto = {
        productId: testProducts[0].id,
        days: 30,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/ml/predictions/demand-forecast')
        .set('Authorization', `Bearer ${testJwtToken}`)
        .send(forecastDto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.productId).toBe(testProducts[0].id);
      expect(response.body.predictedDemand).toBeGreaterThan(0);
    });
  });

  // Helper functions
  async function setupTestData() {
    testTenantId = 'test-tenant-id';
    testUserId = 'test-user-id';
    
    // Create test products
    testProducts = await Promise.all([
      createTestProduct('Product A', 'Electronics'),
      createTestProduct('Product B', 'Food'),
      createTestProduct('Product C', 'Clothing'),
    ]);

    // Create test inventory items
    testInventoryItems = await Promise.all(
      testProducts.map(product => 
        createTestInventoryItem(product.id, 100)
      )
    );

    // Create test models
    testModels = await Promise.all([
      createTestModel(ModelType.ARIMA, { mape: 12 }),
      createTestModel(ModelType.PROPHET, { mape: 15 }),
      createTestModel(ModelType.XGBOOST, { mape: 8 }),
    ]);

    // Create test JWT token
    testJwtToken = 'test-jwt-token';
  }

  async function cleanupTestData() {
    await dataSource.getRepository(Prediction).delete({});
    await dataSource.getRepository(MLModel).delete({});
    await dataSource.getRepository(InventoryItem).delete({});
    await dataSource.getRepository(Product).delete({});
  }

  async function createTestProduct(name: string, category: string): Promise<Product> {
    const product = new Product();
    product.tenantId = testTenantId;
    product.name = name;
    product.category = category;
    product.sku = `SKU-${Date.now()}`;
    product.sellingPrice = 100;
    product.costPrice = 70;
    
    return await dataSource.getRepository(Product).save(product);
  }

  async function createTestInventoryItem(productId: string, quantity: number): Promise<InventoryItem> {
    const item = new InventoryItem();
    item.tenantId = testTenantId;
    item.productId = productId;
    item.quantityOnHand = quantity;
    item.locationId = 'test-location';
    
    return await dataSource.getRepository(InventoryItem).save(item);
  }

  async function createTestModel(type: ModelType, performance: any): Promise<MLModel> {
    const model = new MLModel();
    model.tenantId = testTenantId;
    model.modelType = type;
    model.modelName = `Test ${type} Model`;
    model.status = ModelStatus.DEPLOYED;
    model.isActive = true;
    model.performance = performance;
    model.modelPath = `/tmp/test-model-${type}.json`;
    
    return await dataSource.getRepository(MLModel).save(model);
  }

  async function createTestPrediction(productId: string, predictedValue: number, confidence: number): Promise<Prediction> {
    const prediction = new Prediction();
    prediction.tenantId = testTenantId;
    prediction.productId = productId;
    prediction.predictionType = PredictionType.DEMAND_FORECAST;
    prediction.predictedValue = predictedValue;
    prediction.confidence = confidence;
    prediction.targetDate = new Date();
    prediction.status = PredictionStatus.COMPLETED;
    
    return await dataSource.getRepository(Prediction).save(prediction);
  }

  function generateHistoricalData(days: number): number[] {
    return Array.from({ length: days }, (_, i) => {
      const base = 100;
      const trend = i * 0.5;
      const seasonal = Math.sin((i * 2 * Math.PI) / 7) * 10;
      const noise = (Math.random() - 0.5) * 5;
      return Math.max(0, base + trend + seasonal + noise);
    });
  }

  function generateDateSeries(days: number): string[] {
    const dates = [];
    const startDate = new Date('2024-01-01');
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  }
});