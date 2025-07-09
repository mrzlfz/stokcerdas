import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { BaseAnalyticsController } from '../../../src/analytics/controllers/base-analytics.controller';

// Concrete implementation for testing abstract class
class TestAnalyticsController extends BaseAnalyticsController {
  constructor() {
    super();
  }

  // Expose protected methods for testing
  public testHandleServiceError(error: any, context: string): never {
    return this.handleServiceError(error, context);
  }

  public testHandleValidationError(message: string): never {
    return this.handleValidationError(message);
  }

  public testCreateSuccessResponse<T>(data: T, meta?: any, message?: string) {
    return this.createSuccessResponse(data, meta, message);
  }

  public testLogAnalyticsOperation(
    tenantId: string,
    operation: string,
    duration?: number,
    additionalData?: any,
  ): void {
    return this.logAnalyticsOperation(tenantId, operation, duration, additionalData);
  }

  public testCreateMetaObject(
    total?: number,
    page?: number,
    limit?: number,
    executionTime?: number,
  ): any {
    return this.createMetaObject(total, page, limit, executionTime);
  }
}

describe('BaseAnalyticsController - Indonesian Localization & Error Handling', () => {
  let controller: TestAnalyticsController;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestAnalyticsController],
    }).compile();

    controller = module.get<TestAnalyticsController>(TestAnalyticsController);
    
    // Spy on logger methods
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Indonesian Error Handling', () => {
    describe('handleServiceError', () => {
      it('should use existing Indonesian error message when detected', () => {
        const indonesianError = new Error('Model prediksi tidak tersedia untuk analisis');
        
        expect(() => {
          controller.testHandleServiceError(indonesianError, 'Test Context');
        }).toThrow(HttpException);

        try {
          controller.testHandleServiceError(indonesianError, 'Test Context');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.getResponse()).toMatchObject({
            success: false,
            error: 'Model prediksi tidak tersedia untuk analisis',
            timestamp: expect.any(String),
          });
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }
      });

      it('should translate common database errors to Indonesian', () => {
        const testCases = [
          {
            input: new Error('Database connection error'),
            expected: 'Koneksi database bermasalah',
          },
          {
            input: new Error('Query failed'),
            expected: 'Query database gagal',
          },
          {
            input: new Error('Connection timeout'),
            expected: 'Koneksi database timeout',
          },
          {
            input: new Error('Transaction failed'),
            expected: 'Transaksi database gagal',
          },
        ];

        testCases.forEach(({ input, expected }) => {
          try {
            controller.testHandleServiceError(input, 'Database Test');
          } catch (error) {
            expect(error.getResponse()).toMatchObject({
              success: false,
              error: expected,
              context: 'Database Test',
              timestamp: expect.any(String),
            });
          }
        });
      });

      it('should translate authentication errors to Indonesian', () => {
        const testCases = [
          {
            input: new Error('Unauthorized'),
            expected: 'Tidak memiliki akses',
            status: HttpStatus.UNAUTHORIZED,
          },
          {
            input: new Error('Forbidden'),
            expected: 'Akses ditolak',
            status: HttpStatus.FORBIDDEN,
          },
          {
            input: new Error('Token expired'),
            expected: 'Token akses sudah kedaluwarsa',
          },
          {
            input: new Error('Invalid token'),
            expected: 'Token akses tidak valid',
          },
        ];

        testCases.forEach(({ input, expected, status }) => {
          try {
            controller.testHandleServiceError(input, 'Auth Test');
          } catch (error) {
            expect(error.getResponse()).toMatchObject({
              success: false,
              error: expected,
            });
            if (status) {
              expect(error.getStatus()).toBe(status);
            }
          }
        });
      });

      it('should translate business logic errors to Indonesian', () => {
        const testCases = [
          {
            input: new Error('Product not found'),
            expected: 'Produk tidak ditemukan',
            status: HttpStatus.NOT_FOUND,
          },
          {
            input: new Error('Insufficient data'),
            expected: 'Data tidak mencukupi untuk analisis',
          },
          {
            input: new Error('No data available'),
            expected: 'Data tidak tersedia',
          },
          {
            input: new Error('Analysis failed'),
            expected: 'Analisis gagal dilakukan',
          },
          {
            input: new Error('Prediction failed'),
            expected: 'Prediksi gagal dibuat',
          },
          {
            input: new Error('Model not available'),
            expected: 'Model prediksi tidak tersedia',
          },
        ];

        testCases.forEach(({ input, expected, status }) => {
          try {
            controller.testHandleServiceError(input, 'Business Logic Test');
          } catch (error) {
            expect(error.getResponse()).toMatchObject({
              success: false,
              error: expected,
            });
            if (status) {
              expect(error.getStatus()).toBe(status);
            }
          }
        });
      });

      it('should handle unknown errors with generic Indonesian message', () => {
        const unknownError = new Error('Something completely unexpected happened');
        
        try {
          controller.testHandleServiceError(unknownError, 'Unknown Test');
        } catch (error) {
          expect(error.getResponse()).toMatchObject({
            success: false,
            error: 'Terjadi kesalahan dalam sistem: Something completely unexpected happened',
            context: 'Unknown Test',
            timestamp: expect.any(String),
          });
        }
      });

      it('should detect mixed Indonesian-English content appropriately', () => {
        const mixedContentError = new Error('Failed to process data untuk analisis produk');
        
        try {
          controller.testHandleServiceError(mixedContentError, 'Mixed Content Test');
        } catch (error) {
          // Should detect as Indonesian due to keywords "untuk", "analisis", "produk"
          expect(error.getResponse()).toMatchObject({
            success: false,
            error: 'Failed to process data untuk analisis produk',
            timestamp: expect.any(String),
          });
        }
      });
    });

    describe('handleValidationError', () => {
      it('should translate validation errors to Indonesian', () => {
        const testCases = [
          {
            input: 'Product IDs are required',
            expected: 'ID produk wajib diisi',
          },
          {
            input: 'Invalid product ID',
            expected: 'ID produk tidak valid',
          },
          {
            input: 'Invalid date format',
            expected: 'Format tanggal tidak valid',
          },
          {
            input: 'Date range is invalid',
            expected: 'Rentang tanggal tidak valid',
          },
          {
            input: 'Maximum 50 products allowed',
            expected: 'Maksimal 50 produk diperbolehkan',
          },
        ];

        testCases.forEach(({ input, expected }) => {
          try {
            controller.testHandleValidationError(input);
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect(error.getResponse()).toMatchObject({
              success: false,
              error: expected,
              timestamp: expect.any(String),
            });
          }
        });
      });

      it('should handle unknown validation errors with generic Indonesian message', () => {
        const unknownValidation = 'Some completely unknown validation error';
        
        try {
          controller.testHandleValidationError(unknownValidation);
        } catch (error) {
          expect(error.getResponse()).toMatchObject({
            success: false,
            error: 'Data input tidak valid: Some completely unknown validation error',
            timestamp: expect.any(String),
          });
        }
      });
    });
  });

  describe('Performance Monitoring & Logging', () => {
    describe('logAnalyticsOperation', () => {
      it('should log analytics operations with proper format', () => {
        const testTenantId = 'test-tenant-123';
        const operation = 'Predictive Analysis';
        const duration = 1500; // 1.5 seconds
        const additionalData = { analysisType: 'stockout_prediction' };

        controller.testLogAnalyticsOperation(testTenantId, operation, duration, additionalData);

        expect(loggerSpy).toHaveBeenCalledWith(
          'Analytics Operation: Predictive Analysis | Tenant: test-tenant-123 | Duration: 1500ms',
          JSON.stringify(additionalData)
        );
      });

      it('should log operations without duration and additional data', () => {
        const testTenantId = 'test-tenant-456';
        const operation = 'Dashboard Metrics Generation';

        controller.testLogAnalyticsOperation(testTenantId, operation);

        expect(loggerSpy).toHaveBeenCalledWith(
          'Analytics Operation: Dashboard Metrics Generation | Tenant: test-tenant-456 | Duration: undefinedms',
          undefined
        );
      });

      it('should handle complex additional data objects', () => {
        const complexData = {
          analysisType: 'revenue_analytics',
          timeframe: '30d',
          filters: {
            categories: ['electronics', 'fashion'],
            locations: ['jakarta', 'surabaya'],
          },
          userRole: 'manager',
        };

        controller.testLogAnalyticsOperation('tenant-789', 'Complex Analysis', 2500, complexData);

        expect(loggerSpy).toHaveBeenCalledWith(
          'Analytics Operation: Complex Analysis | Tenant: tenant-789 | Duration: 2500ms',
          JSON.stringify(complexData)
        );
      });
    });
  });

  describe('Standardized Response Creation', () => {
    describe('createSuccessResponse', () => {
      it('should create basic success response', () => {
        const testData = { products: [], count: 0 };
        
        const response = controller.testCreateSuccessResponse(testData);

        expect(response).toMatchObject({
          success: true,
          data: testData,
          timestamp: expect.any(String),
        });

        // Validate timestamp format (ISO string)
        expect(new Date(response.timestamp)).toBeInstanceOf(Date);
      });

      it('should create success response with meta and message', () => {
        const testData = { analytics: 'completed' };
        const testMeta = { executionTime: 1200, total: 5 };
        const testMessage = 'Analytics completed successfully';
        
        const response = controller.testCreateSuccessResponse(testData, testMeta, testMessage);

        expect(response).toMatchObject({
          success: true,
          data: testData,
          meta: testMeta,
          message: testMessage,
          timestamp: expect.any(String),
        });
      });

      it('should create success response without optional fields', () => {
        const testData = 'simple string data';
        
        const response = controller.testCreateSuccessResponse(testData);

        expect(response).toEqual({
          success: true,
          data: testData,
          timestamp: expect.any(String),
        });

        // Should not have meta or message fields
        expect(response.meta).toBeUndefined();
        expect(response.message).toBeUndefined();
      });
    });

    describe('createMetaObject', () => {
      it('should create basic meta object with timestamp only', () => {
        const meta = controller.testCreateMetaObject();

        expect(meta).toMatchObject({
          generatedAt: expect.any(String),
        });

        // Should only have generatedAt
        expect(Object.keys(meta)).toEqual(['generatedAt']);
      });

      it('should create complete meta object with pagination', () => {
        const meta = controller.testCreateMetaObject(100, 2, 25, 1500);

        expect(meta).toMatchObject({
          total: 100,
          page: 2,
          limit: 25,
          executionTime: 1500,
          totalPages: 4, // Math.ceil(100 / 25)
          generatedAt: expect.any(String),
        });
      });

      it('should create meta object with partial parameters', () => {
        const meta = controller.testCreateMetaObject(50, undefined, 10);

        expect(meta).toMatchObject({
          total: 50,
          limit: 10,
          totalPages: 5, // Math.ceil(50 / 10)
          generatedAt: expect.any(String),
        });

        // Should not have page or executionTime
        expect(meta.page).toBeUndefined();
        expect(meta.executionTime).toBeUndefined();
      });

      it('should handle edge cases in pagination calculation', () => {
        // Test with 0 total
        const meta1 = controller.testCreateMetaObject(0, 1, 10);
        expect(meta1.totalPages).toBe(0);

        // Test with exact division
        const meta2 = controller.testCreateMetaObject(30, 1, 15);
        expect(meta2.totalPages).toBe(2);

        // Test with remainder
        const meta3 = controller.testCreateMetaObject(31, 1, 15);
        expect(meta3.totalPages).toBe(3);
      });
    });
  });

  describe('Indonesian Business Context', () => {
    it('should detect Indonesian keywords accurately', () => {
      const indonesianMessages = [
        'Model untuk prediksi tidak dapat ditemukan',
        'Data produk dengan kategori ini belum tersedia',
        'Analisis gagal karena sistem bermasalah',
        'Stok inventori sudah habis dan perlu diisi ulang',
      ];

      const englishMessages = [
        'Model for prediction could not be found',
        'Product data with this category is not available yet',
        'Analysis failed because system is having issues',
        'Inventory stock is empty and needs to be refilled',
      ];

      // Test Indonesian messages (should be used as-is)
      indonesianMessages.forEach(message => {
        const error = new Error(message);
        try {
          controller.testHandleServiceError(error, 'Indonesian Test');
        } catch (thrownError) {
          expect(thrownError.getResponse().error).toBe(message);
        }
      });

      // Test English messages (should be translated)
      englishMessages.forEach(message => {
        const error = new Error(message);
        try {
          controller.testHandleServiceError(error, 'English Test');
        } catch (thrownError) {
          // Should start with "Terjadi kesalahan dalam sistem:" for unknown errors
          expect(thrownError.getResponse().error).toContain('Terjadi kesalahan dalam sistem:');
        }
      });
    });

    it('should prioritize Indonesian business terminology', () => {
      const businessTermErrors = [
        new Error('Insufficient data untuk analisis produk'),
        new Error('Model tidak tersedia for this prediction'),
        new Error('Database connection bermasalah during query'),
      ];

      businessTermErrors.forEach(error => {
        try {
          controller.testHandleServiceError(error, 'Business Term Test');
        } catch (thrownError) {
          // Should use original message due to Indonesian keywords
          expect(thrownError.getResponse().error).toBe(error.message);
        }
      });
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large data objects in logging efficiently', () => {
      const largeData = {
        products: Array(1000).fill(null).map((_, i) => ({ id: `product-${i}`, name: `Product ${i}` })),
        analytics: {
          complex: true,
          nested: {
            deep: {
              data: 'structure',
              with: ['many', 'elements'],
            },
          },
        },
      };

      const startTime = Date.now();
      controller.testLogAnalyticsOperation('performance-test', 'Large Data Test', 500, largeData);
      const endTime = Date.now();

      // Should complete quickly (less than 100ms for serialization)
      expect(endTime - startTime).toBeLessThan(100);
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should create meta objects efficiently for large datasets', () => {
      const startTime = Date.now();
      const meta = controller.testCreateMetaObject(1000000, 5000, 20, 15000);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
      expect(meta).toMatchObject({
        total: 1000000,
        page: 5000,
        limit: 20,
        totalPages: 50000,
        executionTime: 15000,
      });
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle null and undefined errors gracefully', () => {
      const testCases = [null, undefined, '', 0, false];

      testCases.forEach(testCase => {
        try {
          controller.testHandleServiceError(testCase as any, 'Edge Case Test');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.getResponse()).toHaveProperty('success', false);
          expect(error.getResponse()).toHaveProperty('error');
          expect(error.getResponse()).toHaveProperty('timestamp');
        }
      });
    });

    it('should handle circular reference objects in additional data', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData; // Create circular reference

      // Should not throw error and should handle gracefully
      expect(() => {
        controller.testLogAnalyticsOperation('circular-test', 'Circular Data Test', 100, circularData);
      }).not.toThrow();
    });
  });
});