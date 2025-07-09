import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, BadRequestException } from '@nestjs/common';

import { BaseAnalyticsController } from '../../../src/analytics/controllers/base-analytics.controller';
import { PredictiveAnalyticsController } from '../../../src/analytics/controllers/predictive-analytics.controller';
import { AnalyticsController } from '../../../src/analytics/controllers/analytics.controller';

// Test implementation classes
class TestBaseController extends BaseAnalyticsController {
  public testErrorTranslation(error: any, context: string): never {
    return this.handleServiceError(error, context);
  }

  public testValidationTranslation(message: string): never {
    return this.handleValidationError(message);
  }
}

// Mock services for controller testing
const mockAnalyticsServices = {
  predictiveAnalyticsService: {
    generateStockoutPredictions: jest.fn(),
    detectSlowMovingItems: jest.fn(),
    generateOptimalReorders: jest.fn(),
  },
  priceOptimizationService: {
    generatePriceOptimizations: jest.fn(),
  },
  demandAnomalyService: {
    detectDemandAnomalies: jest.fn(),
    performSeasonalAnalysis: jest.fn(),
  },
  modelServingService: {
    predict: jest.fn(),
  },
  businessIntelligenceService: {
    generateDashboardMetrics: jest.fn(),
    generateRevenueAnalytics: jest.fn(),
  },
  customMetricsService: {
    calculateCustomMetric: jest.fn(),
  },
  benchmarkingService: {
    generateBenchmarkingAnalysis: jest.fn(),
  },
};

describe('Indonesian Localization Validation - Complete Business Context', () => {
  let baseController: TestBaseController;
  let predictiveController: PredictiveAnalyticsController;
  let analyticsController: AnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestBaseController, PredictiveAnalyticsController, AnalyticsController],
      providers: Object.entries(mockAnalyticsServices).map(([key, value]) => ({
        provide: key.charAt(0).toUpperCase() + key.slice(1).replace(/Service$/, 'Service'),
        useValue: value,
      })),
    }).compile();

    baseController = module.get<TestBaseController>(TestBaseController);
    predictiveController = module.get<PredictiveAnalyticsController>(PredictiveAnalyticsController);
    analyticsController = module.get<AnalyticsController>(AnalyticsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Indonesian Business Terminology Validation', () => {
    describe('Core Business Terms', () => {
      it('should correctly use Indonesian inventory management terms', () => {
        const indonesianTerms = [
          { english: 'Stock level', indonesian: 'level stok' },
          { english: 'Inventory turnover', indonesian: 'perputaran inventori' },
          { english: 'Product category', indonesian: 'kategori produk' },
          { english: 'Sales forecast', indonesian: 'prediksi penjualan' },
          { english: 'Purchase order', indonesian: 'pesanan pembelian' },
          { english: 'Supplier management', indonesian: 'manajemen supplier' },
          { english: 'Price optimization', indonesian: 'optimasi harga' },
          { english: 'Demand analysis', indonesian: 'analisis permintaan' },
        ];

        indonesianTerms.forEach(({ english, indonesian }) => {
          // Test that Indonesian terms are recognized and preserved
          const error = new Error(`Failed to process ${indonesian} correctly`);
          
          try {
            baseController.testErrorTranslation(error, 'Business Terms Test');
          } catch (translatedError) {
            // Should preserve Indonesian business terms
            expect(translatedError.getResponse().error).toContain(indonesian);
          }
        });
      });

      it('should correctly handle Indonesian financial and currency terms', () => {
        const financialTerms = [
          'Rupiah (IDR)',
          'keuntungan kotor',
          'margin profit',
          'biaya operasional',
          'pendapatan bersih',
          'arus kas',
          'modal kerja',
          'investasi inventori',
        ];

        financialTerms.forEach(term => {
          const error = new Error(`Calculation failed for ${term} analysis`);
          
          try {
            baseController.testErrorTranslation(error, 'Financial Terms Test');
          } catch (translatedError) {
            // Should preserve Indonesian financial terms
            expect(translatedError.getResponse().error).toContain(term);
          }
        });
      });
    });

    describe('Indonesian SMB Context', () => {
      it('should handle Indonesian business scale terminology', () => {
        const businessScaleTerms = [
          'usaha kecil menengah',
          'UMKM',
          'toko retail',
          'warung',
          'distributor',
          'grosir',
          'pedagang',
          'pengusaha',
        ];

        businessScaleTerms.forEach(term => {
          const error = new Error(`Analysis tidak cocok untuk ${term} context`);
          
          try {
            baseController.testErrorTranslation(error, 'SMB Context Test');
          } catch (translatedError) {
            // Should recognize as Indonesian and preserve
            expect(translatedError.getResponse().error).toBe(error.message);
          }
        });
      });

      it('should validate Indonesian location and regional terms', () => {
        const locationTerms = [
          'Jakarta Pusat',
          'Surabaya',
          'Medan',
          'Bandung',
          'gudang utama',
          'cabang toko',
          'outlet',
          'Jabodetabek',
          'Jawa Barat',
          'Sumatra Utara',
        ];

        locationTerms.forEach(location => {
          const error = new Error(`Inventory tracking untuk lokasi ${location} bermasalah`);
          
          try {
            baseController.testErrorTranslation(error, 'Location Context Test');
          } catch (translatedError) {
            // Should preserve Indonesian location names
            expect(translatedError.getResponse().error).toContain(location);
            expect(translatedError.getResponse().error).toContain('untuk');
          }
        });
      });
    });
  });

  describe('Error Message Quality & Clarity', () => {
    describe('Technical Error Translation', () => {
      it('should translate technical errors to business-friendly Indonesian', () => {
        const technicalErrors = [
          {
            input: 'Connection pool exhausted',
            expectedPattern: /koneksi.*habis|sistem.*penuh/i,
          },
          {
            input: 'Query execution timeout',
            expectedPattern: /query.*timeout|sistem.*lama/i,
          },
          {
            input: 'Memory allocation failed',
            expectedPattern: /memori.*penuh|sistem.*kehabisan/i,
          },
          {
            input: 'Index out of bounds',
            expectedPattern: /data.*tidak.*valid|sistem.*error/i,
          },
          {
            input: 'Null pointer exception',
            expectedPattern: /terjadi.*kesalahan.*sistem/i,
          },
        ];

        technicalErrors.forEach(({ input, expectedPattern }) => {
          try {
            baseController.testErrorTranslation(new Error(input), 'Technical Error Test');
          } catch (error) {
            const errorMessage = error.getResponse().error;
            expect(errorMessage).toMatch(expectedPattern);
            // Should be business-friendly (not contain technical jargon)
            expect(errorMessage).not.toMatch(/pool|execution|allocation|pointer|exception/i);
          }
        });
      });

      it('should provide actionable Indonesian error messages', () => {
        const actionableErrors = [
          {
            input: 'Database connection error',
            expected: 'Koneksi database bermasalah',
            action: 'Periksa koneksi internet atau hubungi support',
          },
          {
            input: 'Insufficient data',
            expected: 'Data tidak mencukupi untuk analisis',
            action: 'Pastikan data transaksi telah diinput dengan benar',
          },
          {
            input: 'Model not found',
            expected: 'Model prediksi tidak tersedia',
            action: 'Tunggu hingga sistem selesai training model',
          },
        ];

        actionableErrors.forEach(({ input, expected }) => {
          try {
            baseController.testErrorTranslation(new Error(input), 'Actionable Error Test');
          } catch (error) {
            const errorMessage = error.getResponse().error;
            expect(errorMessage).toBe(expected);
            // Should not contain English words
            expect(errorMessage).not.toMatch(/error|connection|database|model|data/i);
          }
        });
      });
    });

    describe('Validation Message Quality', () => {
      it('should provide clear Indonesian validation messages', () => {
        const validationCases = [
          {
            input: 'Product ID is required',
            expected: 'ID produk wajib diisi',
          },
          {
            input: 'Date format is invalid',
            expected: 'Format tanggal tidak valid',
          },
          {
            input: 'Price must be positive',
            expected: 'Data input tidak valid: Price must be positive',
          },
          {
            input: 'Maximum 100 items allowed',
            expected: 'Data input tidak valid: Maximum 100 items allowed',
          },
        ];

        validationCases.forEach(({ input, expected }) => {
          try {
            baseController.testValidationTranslation(input);
          } catch (error) {
            expect(error.getResponse().error).toBe(expected);
          }
        });
      });

      it('should handle complex validation scenarios with Indonesian context', () => {
        const complexValidations = [
          'Tanggal mulai harus sebelum tanggal selesai',
          'Jumlah produk tidak boleh melebihi stok yang tersedia',
          'Harga jual harus lebih tinggi dari harga beli',
          'Kategori produk yang dipilih tidak valid untuk toko ini',
        ];

        complexValidations.forEach(validation => {
          try {
            baseController.testValidationTranslation(validation);
          } catch (error) {
            // Should preserve Indonesian validation messages
            expect(error.getResponse().error).toBe(validation);
          }
        });
      });
    });
  });

  describe('Business Context Accuracy', () => {
    describe('Indonesian Currency and Numbers', () => {
      it('should handle Indonesian currency formatting appropriately', () => {
        const currencyScenarios = [
          'Total nilai inventori: Rp 150,000,000',
          'Keuntungan bulan ini: Rp 25,500,000',
          'Budget pembelian: Rp 500,000,000',
          'Harga per unit: Rp 75,000',
        ];

        currencyScenarios.forEach(scenario => {
          const error = new Error(`Calculation error dalam ${scenario}`);
          
          try {
            baseController.testErrorTranslation(error, 'Currency Test');
          } catch (translatedError) {
            // Should preserve Indonesian currency format
            expect(translatedError.getResponse().error).toContain('Rp');
            expect(translatedError.getResponse().error).toContain('dalam');
          }
        });
      });

      it('should validate Indonesian date and time formats', () => {
        const dateTimeFormats = [
          '05 Juli 2025',
          '15:30 WIB',
          'Senin, 7 Juli 2025',
          'Q2 2025',
          'Triwulan kedua',
          'Bulan Ramadan 1446H',
        ];

        dateTimeFormats.forEach(format => {
          const error = new Error(`Data untuk periode ${format} tidak ditemukan`);
          
          try {
            baseController.testErrorTranslation(error, 'DateTime Test');
          } catch (translatedError) {
            // Should preserve Indonesian date formats
            expect(translatedError.getResponse().error).toContain(format);
            expect(translatedError.getResponse().error).toContain('untuk');
          }
        });
      });
    });

    describe('Indonesian Holiday and Seasonal Context', () => {
      it('should properly handle Indonesian holidays in business context', () => {
        const holidays = [
          'Hari Raya Idul Fitri',
          'Natal',
          'Tahun Baru',
          'Kemerdekaan RI',
          'Nyepi',
          'Waisak',
          'Idul Adha',
          'Maulid Nabi',
        ];

        holidays.forEach(holiday => {
          const error = new Error(`Analisis seasonal untuk periode ${holiday} gagal`);
          
          try {
            baseController.testErrorTranslation(error, 'Holiday Context Test');
          } catch (translatedError) {
            // Should preserve Indonesian holiday names
            expect(translatedError.getResponse().error).toContain(holiday);
            expect(translatedError.getResponse().error).toContain('untuk');
          }
        });
      });

      it('should validate Indonesian business seasons and cycles', () => {
        const businessSeasons = [
          'musim hujan',
          'musim kemarau',
          'periode sekolah',
          'liburan sekolah',
          'bulan puasa',
          'periode pajak',
          'akhir tahun',
          'awal tahun',
        ];

        businessSeasons.forEach(season => {
          const error = new Error(`Prediksi untuk ${season} memerlukan data tambahan`);
          
          try {
            baseController.testErrorTranslation(error, 'Season Context Test');
          } catch (translatedError) {
            // Should preserve Indonesian seasonal terms
            expect(translatedError.getResponse().error).toContain(season);
            expect(translatedError.getResponse().error).toContain('untuk');
          }
        });
      });
    });
  });

  describe('User Experience & Accessibility', () => {
    describe('Message Length and Readability', () => {
      it('should provide concise yet informative Indonesian error messages', () => {
        const longErrors = [
          'The database connection has been terminated due to network connectivity issues and the system cannot establish a new connection at this time',
          'The machine learning model training process has failed due to insufficient training data and the system requires at least 1000 data points',
          'The price optimization algorithm cannot generate recommendations because the product category has insufficient historical sales data',
        ];

        longErrors.forEach(error => {
          try {
            baseController.testErrorTranslation(new Error(error), 'Readability Test');
          } catch (translatedError) {
            const message = translatedError.getResponse().error;
            
            // Should be concise (less than 100 characters for Indonesian)
            expect(message.length).toBeLessThan(150);
            
            // Should be informative
            expect(message).toMatch(/sistem|data|koneksi|tidak|dapat/);
            
            // Should not contain English technical terms
            expect(message).not.toMatch(/database|connection|network|algorithm|training/i);
          }
        });
      });

      it('should use appropriate Indonesian politeness levels', () => {
        const politeMessages = [
          'Mohon periksa kembali data yang diinput',
          'Silakan coba lagi dalam beberapa saat',
          'Pastikan koneksi internet Anda stabil',
          'Hubungi tim support jika masalah berlanjut',
        ];

        politeMessages.forEach(message => {
          const error = new Error(message);
          
          try {
            baseController.testErrorTranslation(error, 'Politeness Test');
          } catch (translatedError) {
            // Should preserve polite Indonesian language
            const response = translatedError.getResponse().error;
            expect(response).toBe(message);
            expect(response).toMatch(/mohon|silakan|pastikan|hubungi/i);
          }
        });
      });
    });

    describe('Contextual Help and Guidance', () => {
      it('should provide context-sensitive Indonesian help messages', () => {
        const contextualHelp = [
          {
            context: 'Analisis prediktif',
            error: 'Model not ready',
            expectedGuidance: /prediksi|model|tunggu|training/i,
          },
          {
            context: 'Optimasi harga',
            error: 'Insufficient pricing data',
            expectedGuidance: /harga|data|riwayat|penjualan/i,
          },
          {
            context: 'Deteksi anomali permintaan',
            error: 'No historical data',
            expectedGuidance: /data|riwayat|transaksi|permintaan/i,
          },
        ];

        contextualHelp.forEach(({ context, error, expectedGuidance }) => {
          try {
            baseController.testErrorTranslation(new Error(error), context);
          } catch (translatedError) {
            const response = translatedError.getResponse();
            
            // Should include context in response
            expect(response.context).toBe(context);
            
            // Error message should provide relevant guidance
            expect(response.error).toMatch(expectedGuidance);
          }
        });
      });
    });
  });

  describe('Integration with Indonesian Business Logic', () => {
    describe('Multi-tenant Indonesian Context', () => {
      it('should handle Indonesian business entity types correctly', () => {
        const businessTypes = [
          'PT (Perseroan Terbatas)',
          'CV (Commanditaire Vennootschap)', 
          'UD (Usaha Dagang)',
          'Firma',
          'Koperasi',
          'BUMN',
          'BUMD',
          'Perusahaan Perseorangan',
        ];

        businessTypes.forEach(type => {
          const error = new Error(`Konfigurasi untuk ${type} belum lengkap`);
          
          try {
            baseController.testErrorTranslation(error, 'Business Type Test');
          } catch (translatedError) {
            // Should preserve Indonesian business entity names
            expect(translatedError.getResponse().error).toContain(type);
            expect(translatedError.getResponse().error).toContain('untuk');
          }
        });
      });

      it('should validate Indonesian regulatory compliance terms', () => {
        const complianceTerms = [
          'NPWP',
          'NIB (Nomor Induk Berusaha)',
          'SKU (Surat Keterangan Usaha)',
          'TDP (Tanda Daftar Perusahaan)',
          'SIUP (Surat Izin Usaha Perdagangan)',
          'UU PDP (Undang-Undang Perlindungan Data Pribadi)',
          'Peraturan OJK',
          'Standar ISO 27001',
        ];

        complianceTerms.forEach(term => {
          const error = new Error(`Validasi ${term} diperlukan untuk melanjutkan`);
          
          try {
            baseController.testErrorTranslation(error, 'Compliance Test');
          } catch (translatedError) {
            // Should preserve Indonesian regulatory terms
            expect(translatedError.getResponse().error).toContain(term);
            expect(translatedError.getResponse().error).toContain('untuk');
          }
        });
      });
    });

    describe('Industry-Specific Indonesian Terminology', () => {
      it('should handle retail industry terms correctly', () => {
        const retailTerms = [
          'point of sale (POS)',
          'kasir',
          'barcode scanner',
          'struk belanja',
          'nota penjualan',
          'retur barang',
          'diskon member',
          'program loyalitas',
        ];

        retailTerms.forEach(term => {
          const error = new Error(`Integrasi dengan sistem ${term} bermasalah`);
          
          try {
            baseController.testErrorTranslation(error, 'Retail Terms Test');
          } catch (translatedError) {
            // Should preserve Indonesian retail terminology
            expect(translatedError.getResponse().error).toContain(term);
          }
        });
      });

      it('should validate e-commerce platform integration terms', () => {
        const ecommerceTerms = [
          'marketplace',
          'dropship',
          'reseller',
          'affiliate',
          'commission',
          'rating dan review',
          'flash sale',
          'voucher diskon',
        ];

        ecommerceTerms.forEach(term => {
          const error = new Error(`Sinkronisasi data dari ${term} gagal`);
          
          try {
            baseController.testErrorTranslation(error, 'E-commerce Test');
          } catch (translatedError) {
            // Should preserve e-commerce terms that are commonly used in Indonesian
            expect(translatedError.getResponse().error).toContain(term);
            expect(translatedError.getResponse().error).toContain('dari');
          }
        });
      });
    });
  });

  describe('Real-world Indonesian Business Scenarios', () => {
    it('should handle complete Indonesian business workflows', () => {
      const businessWorkflows = [
        'Proses purchase order dari supplier ke gudang utama',
        'Analisis margin keuntungan per kategori produk',
        'Laporan perputaran stok untuk periode triwulan',
        'Prediksi kebutuhan stok menjelang hari raya',
        'Optimasi harga untuk meningkatkan kompetitif di marketplace',
      ];

      businessWorkflows.forEach(workflow => {
        const error = new Error(`Gagal memproses: ${workflow}`);
        
        try {
          baseController.testErrorTranslation(error, 'Business Workflow Test');
        } catch (translatedError) {
          // Should preserve complete Indonesian business workflow descriptions
          expect(translatedError.getResponse().error).toContain(workflow);
          expect(translatedError.getResponse().error).toContain('Gagal memproses');
        }
      });
    });

    it('should maintain consistency across different Indonesian business contexts', () => {
      const businessContexts = [
        { context: 'Toko retail fashion', terms: ['ukuran', 'warna', 'model', 'musim'] },
        { context: 'Distributor makanan', terms: ['expired', 'batch', 'supplier', 'cold storage'] },
        { context: 'Toko elektronik', terms: ['garansi', 'spare part', 'service center', 'brand'] },
        { context: 'Apotek', terms: ['obat', 'resep', 'dokter', 'farmasi'] },
      ];

      businessContexts.forEach(({ context, terms }) => {
        terms.forEach(term => {
          const error = new Error(`Error dalam ${context}: masalah dengan ${term}`);
          
          try {
            baseController.testErrorTranslation(error, `${context} Test`);
          } catch (translatedError) {
            // Should preserve Indonesian business context and terminology
            expect(translatedError.getResponse().error).toContain(context);
            expect(translatedError.getResponse().error).toContain(term);
            expect(translatedError.getResponse().error).toContain('dalam');
            expect(translatedError.getResponse().error).toContain('dengan');
          }
        });
      });
    });
  });
});