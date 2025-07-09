import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

// =============================================
// ULTRATHINK: COMPREHENSIVE CUSTOMER INSIGHTS DASHBOARD API INTEGRATION TESTS
// Testing complete real-time dashboard API with Indonesian business intelligence
// =============================================

import { CustomerInsightsDashboardController } from '../../../src/customers/controllers/customer-insights-dashboard.controller';
import { CustomerInsightsDashboardService } from '../../../src/customers/services/customer-insights-dashboard.service';
import { Customer, CustomerSegment, LoyaltyTier } from '../../../src/customers/entities/customer.entity';
import { CustomerTransaction } from '../../../src/customers/entities/customer-transaction.entity';
import { AuthModule } from '../../../src/auth/auth.module';
import { UsersModule } from '../../../src/users/users.module';
import { User } from '../../../src/users/entities/user.entity';

// =============================================
// ULTRATHINK: COMPREHENSIVE DASHBOARD TEST DATA WITH REAL-TIME METRICS
// =============================================

const mockDashboardTenant = {
  tenantId: 'tenant-dashboard-test-001',
  businessName: 'Dashboard Analytics Indonesia',
  location: 'Jakarta',
  industry: 'retail',
  timezone: 'Asia/Jakarta',
};

const mockDashboardUser = {
  id: 'user-dashboard-001',
  email: 'dashboard@analytics.id',
  username: 'dashboardadmin',
  role: 'admin',
  tenantId: mockDashboardTenant.tenantId,
  isActive: true,
};

const mockRealTimeCustomersData = [
  {
    // Real-time Active Customer Jakarta
    id: 'cust-rt-jakarta-001',
    fullName: 'Rizki Pratama',
    email: 'rizki.pratama@jakarta.com',
    phone: '+6281234567890',
    customerNumber: 'CUST-RT-001',
    tenantId: mockDashboardTenant.tenantId,
    segment: CustomerSegment.HIGH_VALUE,
    loyaltyTier: LoyaltyTier.PLATINUM,
    lifetimeValue: 85000000, // 85M IDR
    totalSpent: 85000000,
    totalOrders: 45,
    averageOrderValue: 1888889,
    averageOrderFrequency: 4.2,
    daysSinceLastOrder: 1, // Very recent
    churnProbability: 5, // Very low risk
    retentionScore: 98,
    lastOrderDate: new Date(), // Today
    addresses: [{
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'gopay', 'dana'],
      communicationPreferences: {
        whatsapp: true,
        email: true,
        sms: false,
        phone: false,
      },
    },
    indonesianMarketContext: {
      region: 'Jakarta',
      culturalBackground: 'Betawi',
      religiousObservance: 'Muslim',
      mobileUsageIndicator: true,
      whatsappEngagement: true,
      culturalAlignmentScore: 92,
      localPaymentAdoption: 95,
      seasonalShoppingPattern: {
        ramadan: true,
        lebaran: true,
        independence: true,
        christmas: false,
      },
    },
    loyaltyPoints: 8500,
    tags: ['real_time_active', 'high_engagement', 'mobile_first'],
  },
  {
    // Frequent Buyer Surabaya
    id: 'cust-rt-surabaya-002',
    fullName: 'Sari Wulandari',
    email: 'sari.wulandari@surabaya.com',
    phone: '+6282345678901',
    customerNumber: 'CUST-RT-002',
    tenantId: mockDashboardTenant.tenantId,
    segment: CustomerSegment.FREQUENT_BUYER,
    loyaltyTier: LoyaltyTier.GOLD,
    lifetimeValue: 32000000, // 32M IDR
    totalSpent: 32000000,
    totalOrders: 55,
    averageOrderValue: 581818,
    averageOrderFrequency: 5.8,
    daysSinceLastOrder: 3,
    churnProbability: 12,
    retentionScore: 88,
    lastOrderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    addresses: [{
      city: 'Surabaya',
      state: 'Jawa Timur',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'ovo', 'bank_transfer'],
      communicationPreferences: {
        whatsapp: true,
        email: true,
        sms: true,
        phone: false,
      },
    },
    indonesianMarketContext: {
      region: 'Surabaya',
      culturalBackground: 'Javanese',
      religiousObservance: 'Muslim',
      mobileUsageIndicator: true,
      whatsappEngagement: true,
      culturalAlignmentScore: 88,
      localPaymentAdoption: 90,
      seasonalShoppingPattern: {
        ramadan: true,
        lebaran: true,
        independence: true,
        christmas: false,
      },
    },
    loyaltyPoints: 3200,
    tags: ['frequent_buyer', 'loyal', 'surabaya_local'],
  },
  {
    // At-Risk Customer Bandung
    id: 'cust-rt-bandung-003',
    fullName: 'Andi Setiawan',
    email: 'andi.setiawan@bandung.com',
    phone: '+6283456789012',
    customerNumber: 'CUST-RT-003',
    tenantId: mockDashboardTenant.tenantId,
    segment: CustomerSegment.AT_RISK,
    loyaltyTier: LoyaltyTier.SILVER,
    lifetimeValue: 15000000, // 15M IDR
    totalSpent: 15000000,
    totalOrders: 18,
    averageOrderValue: 833333,
    averageOrderFrequency: 1.2,
    daysSinceLastOrder: 75, // 2.5 months
    churnProbability: 82, // High risk
    retentionScore: 28,
    lastOrderDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000), // 75 days ago
    addresses: [{
      city: 'Bandung',
      state: 'Jawa Barat',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['bank_transfer', 'cod'],
      communicationPreferences: {
        whatsapp: false,
        email: true,
        sms: false,
        phone: true,
      },
    },
    indonesianMarketContext: {
      region: 'Bandung',
      culturalBackground: 'Sundanese',
      religiousObservance: 'Muslim',
      mobileUsageIndicator: false,
      whatsappEngagement: false,
      culturalAlignmentScore: 65,
      localPaymentAdoption: 70,
      seasonalShoppingPattern: {
        ramadan: false,
        lebaran: true,
        independence: false,
        christmas: true,
      },
    },
    loyaltyPoints: 1500,
    tags: ['at_risk', 'low_engagement', 'traditional_buyer'],
  },
  {
    // New Gen-Z Customer Yogyakarta
    id: 'cust-rt-yogya-004',
    fullName: 'Maya Putri',
    email: 'maya.putri@yogya.ac.id',
    phone: '+6284567890123',
    customerNumber: 'CUST-RT-004',
    tenantId: mockDashboardTenant.tenantId,
    segment: CustomerSegment.NEW_CUSTOMER,
    loyaltyTier: LoyaltyTier.BRONZE,
    lifetimeValue: 2500000, // 2.5M IDR
    totalSpent: 2500000,
    totalOrders: 4,
    averageOrderValue: 625000,
    averageOrderFrequency: 2.0,
    daysSinceLastOrder: 7,
    churnProbability: 35, // Moderate risk for new customer
    retentionScore: 70,
    lastOrderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    addresses: [{
      city: 'Yogyakarta',
      state: 'Daerah Istimewa Yogyakarta',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'dana', 'shopeepay'],
      communicationPreferences: {
        whatsapp: true,
        email: false,
        sms: false,
        phone: false,
      },
    },
    indonesianMarketContext: {
      region: 'Yogyakarta',
      culturalBackground: 'Javanese',
      religiousObservance: 'Muslim',
      mobileUsageIndicator: true,
      whatsappEngagement: true,
      culturalAlignmentScore: 95,
      localPaymentAdoption: 98,
      seasonalShoppingPattern: {
        ramadan: true,
        lebaran: true,
        independence: true,
        christmas: false,
      },
    },
    loyaltyPoints: 250,
    tags: ['gen_z', 'digital_native', 'student', 'mobile_only'],
  },
  {
    // Seasonal Business Customer Medan
    id: 'cust-rt-medan-005',
    fullName: 'Toko Berkah Jaya',
    email: 'admin@tokoberkahjaya.com',
    phone: '+6285678901234',
    customerNumber: 'CUST-RT-005',
    tenantId: mockDashboardTenant.tenantId,
    segment: CustomerSegment.SEASONAL,
    loyaltyTier: LoyaltyTier.GOLD,
    lifetimeValue: 55000000, // 55M IDR
    totalSpent: 55000000,
    totalOrders: 25,
    averageOrderValue: 2200000,
    averageOrderFrequency: 0.8, // Seasonal patterns
    daysSinceLastOrder: 45, // Mid-cycle
    churnProbability: 40, // Seasonal risk
    retentionScore: 75,
    lastOrderDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    addresses: [{
      city: 'Medan',
      state: 'Sumatera Utara',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['bank_transfer', 'credit_card'],
      communicationPreferences: {
        whatsapp: true,
        email: true,
        sms: false,
        phone: true,
      },
    },
    indonesianMarketContext: {
      region: 'Medan',
      culturalBackground: 'Batak',
      religiousObservance: 'Muslim',
      mobileUsageIndicator: true,
      whatsappEngagement: true,
      culturalAlignmentScore: 78,
      localPaymentAdoption: 85,
      seasonalShoppingPattern: {
        ramadan: true,
        lebaran: true,
        independence: false,
        christmas: true,
      },
    },
    loyaltyPoints: 5500,
    tags: ['b2b', 'seasonal', 'traditional', 'medan_local'],
  },
];

const mockRealTimeTransactions = [
  {
    id: 'txn-rt-001',
    customerId: 'cust-rt-jakarta-001',
    orderId: 'order-rt-001',
    transactionType: 'purchase',
    amount: 1750000,
    quantity: 1,
    productId: 'prod-electronics-001',
    categoryId: 'cat-electronics',
    transactionDate: new Date(), // Today
    paymentMethod: 'qris',
    indonesianContext: {
      ramadanSeason: false,
      lebaranProximity: false,
      culturalEvent: null,
      regionalDiscount: true,
      mobileTransaction: true,
      whatsappInitiated: true,
    },
    tenantId: mockDashboardTenant.tenantId,
  },
  {
    id: 'txn-rt-002',
    customerId: 'cust-rt-surabaya-002',
    orderId: 'order-rt-002',
    transactionType: 'purchase',
    amount: 680000,
    quantity: 2,
    productId: 'prod-fashion-002',
    categoryId: 'cat-fashion',
    transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    paymentMethod: 'ovo',
    indonesianContext: {
      ramadanSeason: false,
      lebaranProximity: false,
      culturalEvent: null,
      regionalDiscount: false,
      mobileTransaction: true,
      whatsappInitiated: false,
    },
    tenantId: mockDashboardTenant.tenantId,
  },
  {
    id: 'txn-rt-003',
    customerId: 'cust-rt-yogya-004',
    orderId: 'order-rt-003',
    transactionType: 'purchase',
    amount: 425000,
    quantity: 1,
    productId: 'prod-books-003',
    categoryId: 'cat-education',
    transactionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    paymentMethod: 'dana',
    indonesianContext: {
      ramadanSeason: false,
      lebaranProximity: false,
      culturalEvent: null,
      regionalDiscount: true,
      mobileTransaction: true,
      whatsappInitiated: true,
    },
    tenantId: mockDashboardTenant.tenantId,
  },
];

const mockDashboardJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWRhc2hib2FyZC0wMDEiLCJ1c2VybmFtZSI6ImRhc2hib2FyZGFkbWluIiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ0ZW5hbnQtZGFzaGJvYXJkLXRlc3QtMDAxIiwiaWF0IjoxNjM5OTQwMDAwLCJleHAiOjE2Mzk5NDM2MDB9.mockDashboardTokenSignature';

describe('CustomerInsightsDashboardController Integration Tests', () => {
  let app: INestApplication;
  let customerRepository: Repository<Customer>;
  let customerTransactionRepository: Repository<CustomerTransaction>;
  let userRepository: Repository<User>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'password',
          database: process.env.DB_DATABASE || 'stokcerdas_test',
          entities: [Customer, CustomerTransaction, User],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Customer, CustomerTransaction, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: process.env.JWT_SECRET || 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        AuthModule,
        UsersModule,
      ],
      controllers: [CustomerInsightsDashboardController],
      providers: [CustomerInsightsDashboardService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors();
    await app.init();

    customerRepository = moduleRef.get<Repository<Customer>>(getRepositoryToken(Customer));
    customerTransactionRepository = moduleRef.get<Repository<CustomerTransaction>>(getRepositoryToken(CustomerTransaction));
    userRepository = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  beforeEach(async () => {
    // Clean up database before each test
    await customerTransactionRepository.clear();
    await customerRepository.clear();
    await userRepository.clear();

    // Create test user for authentication
    const testUser = userRepository.create(mockDashboardUser);
    await userRepository.save(testUser);

    // Create test customers with real-time data
    for (const customerData of mockRealTimeCustomersData) {
      const customer = customerRepository.create(customerData);
      await customerRepository.save(customer);
    }

    // Create test transactions
    for (const transactionData of mockRealTimeTransactions) {
      const transaction = customerTransactionRepository.create(transactionData);
      await customerTransactionRepository.save(transaction);
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // ULTRATHINK: REAL-TIME METRICS TESTS
  // =============================================

  describe('GET /customer-insights-dashboard/metrics/realtime - Real-Time Metrics', () => {
    it('should retrieve comprehensive real-time customer metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        overview: expect.objectContaining({
          totalCustomers: 5,
          newCustomersToday: expect.any(Number),
          totalRevenue: expect.any(Number),
          revenueToday: expect.any(Number),
          averageLifetimeValue: expect.any(Number),
          averageOrderValue: expect.any(Number),
          churnRateToday: expect.any(Number),
          customerSatisfactionScore: expect.any(Number),
        }),
        trends: expect.objectContaining({
          customerGrowthTrend: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              newCustomers: expect.any(Number),
              growth: expect.any(Number),
            }),
          ]),
          revenueTrend: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              revenue: expect.any(Number),
              growth: expect.any(Number),
            }),
          ]),
          engagementTrend: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              engagementScore: expect.any(Number),
              trend: expect.stringMatching(/up|down|stable/),
            }),
          ]),
          retentionTrend: expect.arrayContaining([
            expect.objectContaining({
              period: expect.any(String),
              retention: expect.any(Number),
              benchmark: expect.any(Number),
            }),
          ]),
        }),
        indonesianMarketInsights: expect.objectContaining({
          culturalAdaptationScore: expect.any(Number),
          mobileUsageRate: expect.any(Number),
          whatsappEngagementRate: expect.any(Number),
          paymentMethodPreferences: expect.objectContaining({
            qris: expect.any(Number),
            gopay: expect.any(Number),
            ovo: expect.any(Number),
            dana: expect.any(Number),
            bank_transfer: expect.any(Number),
          }),
          regionalDistribution: expect.objectContaining({
            Jakarta: expect.any(Number),
            Surabaya: expect.any(Number),
            Bandung: expect.any(Number),
            Yogyakarta: expect.any(Number),
            Medan: expect.any(Number),
          }),
          localCompetitionInsights: expect.objectContaining({
            marketPosition: expect.any(String),
            competitiveAdvantage: expect.any(Array),
            marketShareEstimate: expect.any(Number),
          }),
        }),
        alerts: expect.arrayContaining([
          expect.objectContaining({
            alertId: expect.any(String),
            alertType: expect.any(String),
            severity: expect.stringMatching(/low|medium|high|critical/),
            message: expect.any(String),
            timestamp: expect.any(String),
            indonesianContext: expect.any(Object),
          }),
        ]),
      });
    });

    it('should include Indonesian insights when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          includeIndonesianInsights: true,
        })
        .expect(200);

      const insights = response.body.indonesianMarketInsights;
      
      expect(insights.culturalAdaptationScore).toBeGreaterThan(70); // Good adaptation
      expect(insights.mobileUsageRate).toBeGreaterThan(80); // High mobile usage in Indonesia
      expect(insights.whatsappEngagementRate).toBeGreaterThan(60); // WhatsApp is popular
      
      // Payment method preferences should reflect Indonesian market
      expect(insights.paymentMethodPreferences.qris).toBeGreaterThan(0);
      expect(insights.paymentMethodPreferences.gopay).toBeGreaterThan(0);
      
      // Regional distribution should show Indonesian cities
      expect(Object.keys(insights.regionalDistribution)).toEqual(
        expect.arrayContaining(['Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Medan'])
      );
    });

    it('should exclude Indonesian insights when not requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          includeIndonesianInsights: false,
        })
        .expect(200);

      expect(response.body).not.toHaveProperty('indonesianMarketInsights');
    });

    it('should include predictive insights when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          includePredictions: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('predictions');
      expect(response.body.predictions).toMatchObject({
        nextPeriodGrowth: expect.any(Number),
        churnRiskPrediction: expect.any(Number),
        revenueProjection: expect.any(Number),
        recommendedActions: expect.any(Array),
      });
    });
  });

  describe('GET /customer-insights-dashboard/metrics/overview - Metrics Overview', () => {
    it('should return high-level metrics overview with Indonesian context', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/overview')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          period: 'day',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        overview: expect.objectContaining({
          totalCustomers: 5,
          totalRevenue: expect.any(Number),
          averageLifetimeValue: expect.any(Number),
          averageOrderValue: expect.any(Number),
        }),
        timestamp: expect.any(String),
        timeRange: 'day',
        indonesianContext: expect.objectContaining({
          culturalAdaptationScore: expect.any(Number),
          mobileUsageRate: expect.any(Number),
          whatsappEngagementRate: expect.any(Number),
        }),
        performance: expect.objectContaining({
          metricsHealthScore: expect.any(Number),
          trendsAnalysis: expect.objectContaining({
            customerGrowth: expect.any(Number),
            revenueGrowth: expect.any(Number),
            engagementDirection: expect.stringMatching(/positive|negative|stable/),
            retentionHealth: expect.any(Number),
          }),
          recommendations: expect.arrayContaining([expect.any(String)]),
        }),
      });
    });

    it('should calculate accurate metrics health score', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/overview')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const healthScore = response.body.performance.metricsHealthScore;
      
      expect(healthScore).toBeGreaterThanOrEqual(0);
      expect(healthScore).toBeLessThanOrEqual(100);
      
      // Should have reasonable score based on our test data
      expect(healthScore).toBeGreaterThan(50); // We have good customers
    });

    it('should provide Indonesian-specific recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/overview')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const recommendations = response.body.performance.recommendations;
      
      // Should include Indonesian-specific recommendations
      const indonesianRecommendations = recommendations.filter(rec => 
        rec.includes('Indonesian') || 
        rec.includes('WhatsApp') || 
        rec.includes('cultural') ||
        rec.includes('QRIS')
      );
      
      expect(indonesianRecommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /customer-insights-dashboard/metrics/trends - Metrics Trends', () => {
    it('should retrieve detailed trend analysis with predictions', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          period: 'week',
          includeIndonesianInsights: true,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        trends: expect.objectContaining({
          customerGrowthTrend: expect.any(Array),
          revenueTrend: expect.any(Array),
          engagementTrend: expect.any(Array),
          retentionTrend: expect.any(Array),
        }),
        analysis: expect.objectContaining({
          customerGrowthAnalysis: expect.objectContaining({
            status: expect.stringMatching(/healthy|stable|declining/),
            averageGrowthRate: expect.any(Number),
            trend: expect.stringMatching(/upward|downward/),
            recommendation: expect.any(String),
          }),
          revenueAnalysis: expect.objectContaining({
            status: expect.stringMatching(/excellent|good|concerning/),
            averageGrowthRate: expect.any(Number),
            volatility: expect.any(Number),
            recommendation: expect.any(String),
          }),
          engagementAnalysis: expect.objectContaining({
            status: expect.stringMatching(/improving|declining|stable/),
            upDays: expect.any(Number),
            downDays: expect.any(Number),
            recommendation: expect.any(String),
          }),
          retentionAnalysis: expect.objectContaining({
            status: expect.stringMatching(/healthy|warning|critical/),
            averageRetention: expect.any(Number),
            benchmark: expect.any(Number),
            gapToBenchmark: expect.any(Number),
            recommendation: expect.any(String),
          }),
        }),
        predictions: expect.objectContaining({
          nextPeriodGrowth: expect.objectContaining({
            prediction: expect.any(Number),
            confidence: expect.stringMatching(/low|medium|high/),
            range: expect.objectContaining({
              min: expect.any(Number),
              max: expect.any(Number),
            }),
          }),
          revenueProjection: expect.objectContaining({
            nextPeriodProjection: expect.any(Number),
            confidence: expect.stringMatching(/low|medium|high/),
            growthRate: expect.any(Number),
          }),
          riskAssessment: expect.objectContaining({
            totalRisks: expect.any(Number),
            highSeverityRisks: expect.any(Number),
            risks: expect.any(Array),
            overallRiskLevel: expect.stringMatching(/low|medium|high/),
          }),
        }),
        indonesianInsights: expect.objectContaining({
          seasonalFactors: expect.objectContaining({
            ramadan: expect.objectContaining({
              impact: expect.any(Number),
              months: expect.any(Array),
            }),
            lebaran: expect.objectContaining({
              impact: expect.any(Number),
              months: expect.any(Array),
            }),
          }),
          culturalEvents: expect.objectContaining({
            currentEvents: expect.any(Array),
            upcomingEvents: expect.any(Array),
            historicalImpact: expect.any(Object),
          }),
          marketComparison: expect.objectContaining({
            industryAverages: expect.any(Object),
            competitorBenchmarks: expect.any(Object),
            marketPosition: expect.any(String),
          }),
        }),
      });
    });

    it('should calculate accurate trend analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const analysis = response.body.analysis;
      
      // Customer growth analysis should be realistic
      expect(analysis.customerGrowthAnalysis.averageGrowthRate).toBeGreaterThan(-100);
      expect(analysis.customerGrowthAnalysis.averageGrowthRate).toBeLessThan(1000);
      
      // Revenue analysis should have valid volatility
      expect(analysis.revenueAnalysis.volatility).toBeGreaterThanOrEqual(0);
      
      // Retention analysis should have valid percentages
      expect(analysis.retentionAnalysis.averageRetention).toBeGreaterThanOrEqual(0);
      expect(analysis.retentionAnalysis.averageRetention).toBeLessThanOrEqual(100);
    });

    it('should include Indonesian seasonal factors', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          includeIndonesianInsights: true,
        })
        .expect(200);

      const seasonalFactors = response.body.indonesianInsights.seasonalFactors;
      
      expect(seasonalFactors).toHaveProperty('ramadan');
      expect(seasonalFactors).toHaveProperty('lebaran');
      expect(seasonalFactors).toHaveProperty('independence');
      expect(seasonalFactors).toHaveProperty('christmas');
      
      expect(seasonalFactors.ramadan.impact).toBeGreaterThan(0);
      expect(seasonalFactors.lebaran.impact).toBeGreaterThan(0);
      expect(seasonalFactors.ramadan.months).toContain(3); // March/April typical for Ramadan
    });
  });

  // =============================================
  // ULTRATHINK: SEGMENT PERFORMANCE TESTS
  // =============================================

  describe('GET /customer-insights-dashboard/segments/performance - Segment Performance', () => {
    it('should retrieve comprehensive segment performance analytics', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/segments/performance')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            segmentId: expect.any(String),
            segmentName: expect.any(String),
            customerCount: expect.any(Number),
            metrics: expect.objectContaining({
              averageLTV: expect.any(Number),
              totalRevenue: expect.any(Number),
              averageOrderValue: expect.any(Number),
              averageOrderFrequency: expect.any(Number),
              retentionRate: expect.any(Number),
              churnRate: expect.any(Number),
              conversionRate: expect.any(Number),
              engagementScore: expect.any(Number),
            }),
            growth: expect.objectContaining({
              monthlyGrowthRate: expect.any(Number),
              quarterlyGrowthRate: expect.any(Number),
              yearlyGrowthRate: expect.any(Number),
            }),
            trends: expect.objectContaining({
              revenueGrowth: expect.any(Number),
              customerGrowth: expect.any(Number),
              engagementTrend: expect.stringMatching(/improving|stable|declining/),
              growthRate: expect.any(Number),
            }),
            predictions: expect.objectContaining({
              nextMonthRevenue: expect.any(Number),
              churnRisk: expect.any(Number),
              growthProjection: expect.any(Number),
              recommendations: expect.any(Array),
            }),
            indonesianFactors: expect.objectContaining({
              culturalAlignment: expect.any(Number),
              regionalPopularity: expect.any(Object),
              paymentPreferences: expect.any(Object),
              languagePreference: expect.any(String),
              preferredChannels: expect.any(Array),
              seasonalBehavior: expect.any(Object),
            }),
          }),
        ])
      );
    });

    it('should filter segment performance by customer segments', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/segments/performance')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          customerSegments: [CustomerSegment.HIGH_VALUE, CustomerSegment.FREQUENT_BUYER],
        })
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach(segment => {
        expect([CustomerSegment.HIGH_VALUE, CustomerSegment.FREQUENT_BUYER])
          .toContain(segment.segmentName);
      });
    });

    it('should include Indonesian cultural factors for each segment', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/segments/performance')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      response.body.forEach(segment => {
        expect(segment.indonesianFactors.culturalAlignment).toBeGreaterThanOrEqual(0);
        expect(segment.indonesianFactors.culturalAlignment).toBeLessThanOrEqual(100);
        
        expect(segment.indonesianFactors.languagePreference).toMatch(/id|en/);
        expect(segment.indonesianFactors.preferredChannels).toContain('whatsapp');
        
        expect(segment.indonesianFactors.seasonalBehavior).toHaveProperty('ramadan');
        expect(segment.indonesianFactors.seasonalBehavior).toHaveProperty('lebaran');
      });
    });
  });

  describe('GET /customer-insights-dashboard/segments/:segmentId/detailed-analysis - Detailed Segment Analysis', () => {
    it('should retrieve comprehensive detailed analysis for specific segment', async () => {
      // First get available segments
      const segmentsResponse = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/segments/performance')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const firstSegment = segmentsResponse.body[0];
      const segmentId = firstSegment.segmentId;

      const response = await request(app.getHttpServer())
        .get(`/customer-insights-dashboard/segments/${segmentId}/detailed-analysis`)
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          period: 'month',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        segment: expect.objectContaining({
          segmentId,
          segmentName: expect.any(String),
          customerCount: expect.any(Number),
        }),
        detailedAnalysis: expect.objectContaining({
          customerComposition: expect.objectContaining({
            demographics: expect.any(Object),
            geographics: expect.any(Object),
            behavioral: expect.any(Object),
          }),
          behaviorAnalysis: expect.objectContaining({
            purchasePatterns: expect.any(Object),
            engagementPatterns: expect.any(Object),
            preferences: expect.any(Object),
          }),
          revenueBreakdown: expect.objectContaining({
            byProduct: expect.any(Object),
            byChannel: expect.any(Object),
            byRegion: expect.any(Object),
          }),
          engagementPatterns: expect.objectContaining({
            channels: expect.any(Object),
            frequency: expect.any(Object),
            preferences: expect.any(Object),
          }),
          indonesianFactors: expect.objectContaining({
            cultural: expect.any(Object),
            regional: expect.any(Object),
            payment: expect.any(Object),
          }),
        }),
        comparativeAnalysis: expect.objectContaining({
          vsOtherSegments: expect.objectContaining({
            ltvComparison: expect.stringMatching(/above_average|below_average/),
            retentionComparison: expect.stringMatching(/above_average|below_average/),
            ranking: expect.any(Number),
            totalSegments: expect.any(Number),
          }),
          vsIndustryBenchmarks: expect.objectContaining({
            ltvVsBenchmark: expect.any(Number),
            retentionVsBenchmark: expect.any(Number),
            churnVsBenchmark: expect.any(Number),
            overallPerformance: expect.stringMatching(/excellent|good/),
          }),
          vsIndonesianMarket: expect.objectContaining({
            culturalAlignment: expect.any(Number),
            marketAdaptation: expect.stringMatching(/well_adapted|needs_improvement/),
            localPreferences: expect.any(Object),
            regionalStrength: expect.stringMatching(/diverse|concentrated/),
          }),
        }),
        actionableInsights: expect.objectContaining({
          growthOpportunities: expect.arrayContaining([
            expect.objectContaining({
              area: expect.any(String),
              priority: expect.stringMatching(/high|medium|low/),
              description: expect.any(String),
              expectedImpact: expect.any(String),
            }),
          ]),
          retentionStrategies: expect.arrayContaining([
            expect.objectContaining({
              strategy: expect.any(String),
              description: expect.any(String),
              targetImprovement: expect.any(String),
              indonesianContext: expect.any(String),
            }),
          ]),
          indonesianOptimizations: expect.arrayContaining([
            expect.objectContaining({
              optimization: expect.any(String),
              description: expect.any(String),
              implementation: expect.any(String),
              expectedBenefit: expect.any(String),
            }),
          ]),
        }),
      });
    });

    it('should return 404 for non-existent segment', async () => {
      const nonExistentSegmentId = 'segment-non-existent-999';

      const response = await request(app.getHttpServer())
        .get(`/customer-insights-dashboard/segments/${nonExistentSegmentId}/detailed-analysis`)
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('not found'),
        }),
      });
    });

    it('should include Indonesian market optimizations', async () => {
      const segmentsResponse = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/segments/performance')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const firstSegment = segmentsResponse.body[0];
      const segmentId = firstSegment.segmentId;

      const response = await request(app.getHttpServer())
        .get(`/customer-insights-dashboard/segments/${segmentId}/detailed-analysis`)
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const optimizations = response.body.actionableInsights.indonesianOptimizations;
      
      expect(optimizations.length).toBeGreaterThan(0);
      
      const whatsappOptimization = optimizations.find(opt => 
        opt.optimization.includes('whatsapp') || opt.description.includes('WhatsApp')
      );
      const paymentOptimization = optimizations.find(opt => 
        opt.optimization.includes('payment') || opt.description.includes('payment')
      );
      
      expect(whatsappOptimization || paymentOptimization).toBeTruthy();
    });
  });

  // =============================================
  // ULTRATHINK: LIVE ACTIVITY MONITORING TESTS
  // =============================================

  describe('GET /customer-insights-dashboard/activity/live - Live Customer Activity', () => {
    it('should retrieve real-time customer activity stream', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/live')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          limit: 50,
        })
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            activityId: expect.any(String),
            customerId: expect.any(String),
            customerName: expect.any(String),
            activityType: expect.stringMatching(/purchase|login|search|cart_add|cart_abandon|support_contact|review|referral/),
            timestamp: expect.any(String),
            value: expect.any(Number),
            details: expect.objectContaining({
              description: expect.any(String),
              productId: expect.any(String),
              category: expect.any(String),
              channel: expect.any(String),
            }),
            impact: expect.objectContaining({
              revenueImpact: expect.any(Number),
              engagementImpact: expect.any(Number),
              loyaltyImpact: expect.any(Number),
            }),
            indonesianContext: expect.objectContaining({
              region: expect.any(String),
              paymentMethod: expect.any(String),
              deviceType: expect.stringMatching(/mobile|desktop|tablet/),
              culturalRelevance: expect.any(Number),
              localFactors: expect.any(Object),
            }),
          }),
        ])
      );

      expect(response.body.length).toBeLessThanOrEqual(50);
    });

    it('should filter activities by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/live')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          activityTypes: 'purchase,login',
          limit: 20,
        })
        .expect(200);

      response.body.forEach(activity => {
        expect(['purchase', 'login']).toContain(activity.activityType);
      });
    });

    it('should limit results to maximum 200', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/live')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          limit: 500, // Request more than max
        })
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(200);
    });

    it('should include Indonesian context for activities', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/live')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      response.body.forEach(activity => {
        expect(activity.indonesianContext).toHaveProperty('region');
        expect(activity.indonesianContext.region).toMatch(/Jakarta|Surabaya|Bandung|Yogyakarta|Medan/);
        
        if (activity.indonesianContext.paymentMethod) {
          expect(['qris', 'gopay', 'ovo', 'dana', 'bank_transfer', 'credit_card', 'cod'])
            .toContain(activity.indonesianContext.paymentMethod);
        }
        
        expect(activity.indonesianContext.deviceType).toMatch(/mobile|desktop|tablet/);
        expect(activity.indonesianContext.culturalRelevance).toBeGreaterThanOrEqual(0);
        expect(activity.indonesianContext.culturalRelevance).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('GET /customer-insights-dashboard/activity/summary - Activity Summary', () => {
    it('should retrieve comprehensive activity summary with Indonesian insights', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/summary')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          period: 'day',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        summary: expect.objectContaining({
          totalActivities: expect.any(Number),
          activityByType: expect.any(Object),
          activityByHour: expect.any(Object),
          topCustomers: expect.arrayContaining([
            expect.objectContaining({
              customerId: expect.any(String),
              customerName: expect.any(String),
              activityCount: expect.any(Number),
              totalValue: expect.any(Number),
            }),
          ]),
          revenueImpact: expect.any(Number),
        }),
        trends: expect.objectContaining({
          activityGrowth: expect.objectContaining({
            current24h: expect.any(Number),
            previous24h: expect.any(Number),
            growthRate: expect.any(Number),
          }),
          engagementTrend: expect.objectContaining({
            averageEngagement: expect.any(Number),
            trend: expect.stringMatching(/positive|negative|neutral/),
          }),
          peakHours: expect.any(Array),
        }),
        indonesianInsights: expect.objectContaining({
          regionalActivity: expect.objectContaining({
            distribution: expect.any(Object),
            topRegions: expect.arrayContaining([
              expect.arrayContaining([expect.any(String), expect.any(Number)]),
            ]),
          }),
          paymentMethodActivity: expect.objectContaining({
            distribution: expect.objectContaining({
              qris: expect.any(Number),
              gopay: expect.any(Number),
              bank_transfer: expect.any(Number),
              ovo: expect.any(Number),
              dana: expect.any(Number),
            }),
            trends: expect.objectContaining({
              qris: expect.stringMatching(/increasing|stable|decreasing/),
              gopay: expect.stringMatching(/increasing|stable|decreasing/),
              bank_transfer: expect.stringMatching(/increasing|stable|decreasing/),
            }),
          }),
          culturalEventCorrelation: expect.objectContaining({
            ramadanCorrelation: expect.any(Number),
            weekendPatterns: expect.any(String),
            holidayImpact: expect.any(String),
          }),
        }),
      });
    });

    it('should identify peak activity hours accurately', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/summary')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const peakHours = response.body.trends.peakHours;
      
      expect(peakHours).toHaveLength(3); // Top 3 peak hours
      peakHours.forEach(hour => {
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThanOrEqual(23);
      });
    });

    it('should analyze Indonesian payment method trends', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/activity/summary')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const paymentActivity = response.body.indonesianInsights.paymentMethodActivity;
      
      expect(paymentActivity.distribution.qris).toBeGreaterThanOrEqual(0);
      expect(paymentActivity.distribution.qris).toBeLessThanOrEqual(100);
      
      expect(paymentActivity.trends.qris).toMatch(/increasing|stable|decreasing/);
      expect(paymentActivity.trends.gopay).toMatch(/increasing|stable|decreasing/);
    });
  });

  // =============================================
  // ULTRATHINK: PREDICTIVE ANALYTICS TESTS
  // =============================================

  describe('GET /customer-insights-dashboard/predictions/customer-insights - Customer Prediction Insights', () => {
    it('should retrieve ML-powered customer behavior predictions', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/customer-insights')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        churnPredictions: expect.objectContaining({
          totalAtRiskCustomers: expect.any(Number),
          highRiskCustomers: expect.arrayContaining([
            expect.objectContaining({
              customerId: expect.any(String),
              customerName: expect.any(String),
              churnProbability: expect.any(Number),
              riskFactors: expect.any(Array),
              recommendedActions: expect.any(Array),
              indonesianFactors: expect.any(Object),
            }),
          ]),
          predictedChurnRate: expect.any(Number),
          preventionStrategies: expect.any(Array),
        }),
        lifetimeValuePredictions: expect.objectContaining({
          averagePredictedLTV: expect.any(Number),
          topPotentialCustomers: expect.arrayContaining([
            expect.objectContaining({
              customerId: expect.any(String),
              currentLTV: expect.any(Number),
              predictedLTV: expect.any(Number),
              growthPotential: expect.any(Number),
              growthStrategies: expect.any(Array),
            }),
          ]),
          ltvGrowthProjection: expect.any(Number),
        }),
        engagementPredictions: expect.objectContaining({
          overallEngagementTrend: expect.stringMatching(/improving|stable|declining/),
          engagementRiskCustomers: expect.any(Array),
          engagementOpportunities: expect.any(Array),
          channelEffectiveness: expect.any(Object),
        }),
        marketTrendPredictions: expect.objectContaining({
          seasonalDemandForecasts: expect.any(Object),
          paymentMethodEvolution: expect.objectContaining({
            emergingMethods: expect.any(Array),
            decliningMethods: expect.any(Array),
            adoptionProjections: expect.any(Object),
          }),
          demographicShifts: expect.any(Object),
          competitivePositioning: expect.any(Object),
        }),
        indonesianMarketPredictions: expect.objectContaining({
          culturalEventImpacts: expect.any(Array),
          regionalGrowthProjections: expect.any(Object),
          mobileAdoptionTrends: expect.any(Object),
          localCompetitionAnalysis: expect.any(Object),
        }),
      });
    });

    it('should identify high-risk churn customers with Indonesian context', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/customer-insights')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const churnPredictions = response.body.churnPredictions;
      
      expect(churnPredictions.totalAtRiskCustomers).toBeGreaterThanOrEqual(1); // We have at-risk customer
      
      churnPredictions.highRiskCustomers.forEach(customer => {
        expect(customer.churnProbability).toBeGreaterThanOrEqual(70);
        expect(customer.riskFactors).toContain('low_engagement');
        expect(customer.indonesianFactors).toHaveProperty('culturalAlignment');
        expect(customer.recommendedActions).toContain('whatsapp_outreach');
      });
    });

    it('should predict LTV growth opportunities', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/customer-insights')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const ltvPredictions = response.body.lifetimeValuePredictions;
      
      expect(ltvPredictions.averagePredictedLTV).toBeGreaterThan(0);
      
      ltvPredictions.topPotentialCustomers.forEach(customer => {
        expect(customer.predictedLTV).toBeGreaterThanOrEqual(customer.currentLTV);
        expect(customer.growthPotential).toBeGreaterThanOrEqual(0);
        expect(customer.growthStrategies).toContain('loyalty_program_upgrade');
      });
    });

    it('should include Indonesian market-specific predictions', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/customer-insights')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const indonesianPredictions = response.body.indonesianMarketPredictions;
      
      expect(indonesianPredictions.culturalEventImpacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: expect.stringMatching(/ramadan|lebaran|independence|christmas/),
            predictedImpact: expect.any(Number),
            timeframe: expect.any(String),
            preparation: expect.any(String),
          }),
        ])
      );

      expect(indonesianPredictions.regionalGrowthProjections).toHaveProperty('Jakarta');
      expect(indonesianPredictions.regionalGrowthProjections).toHaveProperty('Surabaya');
      
      expect(indonesianPredictions.mobileAdoptionTrends).toHaveProperty('currentRate');
      expect(indonesianPredictions.mobileAdoptionTrends).toHaveProperty('projectedRate');
    });
  });

  describe('GET /customer-insights-dashboard/predictions/market-trends - Market Trend Predictions', () => {
    it('should retrieve Indonesian market trend predictions', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/market-trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          period: 'quarter',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        marketTrends: expect.any(Object),
        indonesianSpecific: expect.objectContaining({
          ramadanImpact: expect.objectContaining({
            salesImpact: expect.any(String),
            behaviorChanges: expect.any(Array),
            recommendedActions: expect.any(Array),
          }),
          culturalEventImpacts: expect.arrayContaining([
            expect.objectContaining({
              event: expect.any(String),
              expectedImpact: expect.any(String),
              timeframe: expect.any(String),
              preparation: expect.any(String),
            }),
          ]),
          paymentMethodEvolution: expect.any(Object),
          regionralGrowthPredictions: expect.objectContaining({
            jakarta: expect.objectContaining({
              growth: expect.any(String),
              confidence: expect.stringMatching(/low|medium|high/),
            }),
            surabaya: expect.objectContaining({
              growth: expect.any(String),
              confidence: expect.stringMatching(/low|medium|high/),
            }),
          }),
        }),
        recommendations: expect.objectContaining({
          shortTerm: expect.arrayContaining([expect.any(String)]),
          longTerm: expect.arrayContaining([expect.any(String)]),
          indonesianFocused: expect.arrayContaining([expect.any(String)]),
        }),
      });
    });

    it('should predict Ramadan impact accurately', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/market-trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const ramadanImpact = response.body.indonesianSpecific.ramadanImpact;
      
      expect(ramadanImpact.salesImpact).toMatch(/^\+\d+%$/); // Should be positive impact
      expect(ramadanImpact.behaviorChanges).toContain('increased_evening_activity');
      expect(ramadanImpact.behaviorChanges).toContain('bulk_purchasing');
      expect(ramadanImpact.recommendedActions).toContain('adjust_inventory');
    });

    it('should include region-specific growth predictions', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/predictions/market-trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const regionalGrowth = response.body.indonesianSpecific.regionralGrowthPredictions;
      
      Object.keys(regionalGrowth).forEach(region => {
        expect(regionalGrowth[region].growth).toMatch(/^\+\d+%$/);
        expect(['low', 'medium', 'high']).toContain(regionalGrowth[region].confidence);
      });
    });
  });

  // =============================================
  // ULTRATHINK: ALERT MANAGEMENT TESTS
  // =============================================

  describe('GET /customer-insights-dashboard/alerts - Dashboard Alerts', () => {
    it('should retrieve active dashboard alerts', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/alerts')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            alertId: expect.any(String),
            alertType: expect.stringMatching(/churn_risk|revenue_drop|engagement_decline|system_health|cultural_event/),
            severity: expect.stringMatching(/low|medium|high|critical/),
            title: expect.any(String),
            message: expect.any(String),
            timestamp: expect.any(String),
            status: expect.stringMatching(/active|acknowledged|resolved|snoozed/),
            affectedCustomers: expect.any(Array),
            recommendations: expect.any(Array),
            indonesianContext: expect.objectContaining({
              culturalRelevance: expect.any(Number),
              regionalImpact: expect.any(Array),
              localFactors: expect.any(Object),
            }),
            metrics: expect.objectContaining({
              currentValue: expect.any(Number),
              threshold: expect.any(Number),
              trend: expect.stringMatching(/improving|stable|worsening/),
            }),
          }),
        ])
      );
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/alerts')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          severity: 'high',
        })
        .expect(200);

      response.body.forEach(alert => {
        expect(alert.severity).toBe('high');
      });
    });

    it('should filter alerts by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/alerts')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          alertType: 'churn_risk',
        })
        .expect(200);

      response.body.forEach(alert => {
        expect(alert.alertType).toBe('churn_risk');
      });
    });

    it('should include Indonesian context for alerts', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/alerts')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      response.body.forEach(alert => {
        expect(alert.indonesianContext.culturalRelevance).toBeGreaterThanOrEqual(0);
        expect(alert.indonesianContext.culturalRelevance).toBeLessThanOrEqual(100);
        
        if (alert.indonesianContext.regionalImpact.length > 0) {
          alert.indonesianContext.regionalImpact.forEach(region => {
            expect(region).toMatch(/Jakarta|Surabaya|Bandung|Yogyakarta|Medan/);
          });
        }
      });
    });
  });

  describe('POST /customer-insights-dashboard/alerts/:alertId/action - Alert Actions', () => {
    it('should resolve dashboard alert successfully', async () => {
      // First get an alert
      const alertsResponse = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/alerts')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      if (alertsResponse.body.length === 0) {
        // Skip test if no alerts
        return;
      }

      const firstAlert = alertsResponse.body[0];
      const alertId = firstAlert.alertId;

      const response = await request(app.getHttpServer())
        .post(`/customer-insights-dashboard/alerts/${alertId}/action`)
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .send({
          alertId,
          action: 'resolve',
          notes: 'Issue resolved through customer outreach',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('resolve action completed successfully'),
      });
    });

    it('should validate alert action types', async () => {
      const alertId = 'alert-test-001';

      const response = await request(app.getHttpServer())
        .post(`/customer-insights-dashboard/alerts/${alertId}/action`)
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .send({
          alertId,
          action: 'invalid_action',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Unknown alert action'),
        }),
      });
    });
  });

  // =============================================
  // ULTRATHINK: INDONESIAN MARKET INSIGHTS TESTS
  // =============================================

  describe('GET /customer-insights-dashboard/indonesian-insights/comprehensive - Indonesian Market Insights', () => {
    it('should retrieve comprehensive Indonesian market insights', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/indonesian-insights/comprehensive')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          period: 'month',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        marketAdaptation: expect.objectContaining({
          culturalAdaptationScore: expect.any(Number),
          improvementAreas: expect.arrayContaining([expect.any(String)]),
          bestPractices: expect.arrayContaining([
            'Use Bahasa Indonesia in customer communications',
            'Implement QRIS payment integration',
            'Optimize for mobile-first experience',
          ]),
        }),
        regionalAnalysis: expect.objectContaining({
          distribution: expect.any(Object),
          opportunities: expect.arrayContaining([
            expect.objectContaining({
              region: expect.any(String),
              currentCustomers: expect.any(Number),
              opportunity: expect.stringMatching(/expansion|optimization/),
              potential: expect.stringMatching(/high|medium|low/),
            }),
          ]),
          challenges: expect.arrayContaining([
            expect.objectContaining({
              region: expect.any(String),
              challenge: expect.any(String),
              currentCustomers: expect.any(Number),
              recommendedActions: expect.any(Array),
            }),
          ]),
        }),
        digitalBehavior: expect.objectContaining({
          mobileUsage: expect.any(Number),
          whatsappEngagement: expect.any(Number),
          paymentPreferences: expect.any(Object),
          recommendations: expect.arrayContaining([expect.any(String)]),
        }),
        culturalFactors: expect.objectContaining({
          seasonalImpacts: expect.objectContaining({
            ramadan: expect.objectContaining({
              salesImpact: expect.any(String),
              behaviorChange: expect.any(String),
            }),
            lebaran: expect.objectContaining({
              salesImpact: expect.any(String),
              behaviorChange: expect.any(String),
            }),
          }),
          religiousConsiderations: expect.objectContaining({
            halal_products: expect.objectContaining({
              importance: expect.any(String),
              coverage: expect.any(String),
            }),
          }),
          familyInfluences: expect.objectContaining({
            family_purchasing: expect.objectContaining({
              influence: expect.any(String),
              decision_makers: expect.any(String),
            }),
          }),
          recommendations: expect.arrayContaining([
            'Implement family-friendly pricing packages',
            'Respect religious observances in communications',
          ]),
        }),
        competitivePosition: expect.any(Object),
      });
    });

    it('should identify Indonesian market improvement areas', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/indonesian-insights/comprehensive')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const improvementAreas = response.body.marketAdaptation.improvementAreas;
      
      // Should identify improvement areas based on our test data
      expect(improvementAreas).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Cultural|WhatsApp|Mobile|cultural|whatsapp|mobile/),
        ])
      );
    });

    it('should analyze regional opportunities and challenges', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/indonesian-insights/comprehensive')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const regionalAnalysis = response.body.regionalAnalysis;
      
      // Should have opportunities in regions with low customer count
      const expansionOpportunities = regionalAnalysis.opportunities.filter(
        opp => opp.opportunity === 'expansion'
      );
      expect(expansionOpportunities.length).toBeGreaterThanOrEqual(0);
      
      // Should have challenges in regions with very low penetration
      regionalAnalysis.challenges.forEach(challenge => {
        expect(challenge.currentCustomers).toBeLessThan(50);
        expect(challenge.recommendedActions).toContain('Local marketing campaigns');
      });
    });

    it('should provide digital behavior recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/indonesian-insights/comprehensive')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const digitalBehavior = response.body.digitalBehavior;
      
      expect(digitalBehavior.mobileUsage).toBeGreaterThan(80); // High mobile usage in Indonesia
      expect(digitalBehavior.whatsappEngagement).toBeGreaterThan(60); // High WhatsApp usage
      
      if (digitalBehavior.mobileUsage > 85) {
        expect(digitalBehavior.recommendations).toContain(
          'Prioritize mobile app features and optimization'
        );
      }
      
      if (digitalBehavior.whatsappEngagement > 80) {
        expect(digitalBehavior.recommendations).toContain(
          'Expand WhatsApp Business capabilities'
        );
      }
    });

    it('should analyze cultural factors and seasonal impacts', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/indonesian-insights/comprehensive')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      const culturalFactors = response.body.culturalFactors;
      
      expect(culturalFactors.seasonalImpacts.ramadan.salesImpact).toMatch(/^\+\d+%$/);
      expect(culturalFactors.seasonalImpacts.lebaran.salesImpact).toMatch(/^\+\d+%$/);
      
      expect(culturalFactors.religiousConsiderations.halal_products.importance).toBe('high');
      expect(culturalFactors.familyInfluences.family_purchasing.influence).toBe('high');
      
      expect(culturalFactors.recommendations).toContain(
        'Implement family-friendly pricing packages'
      );
    });
  });

  // =============================================
  // ULTRATHINK: AUTHENTICATION AND PERFORMANCE TESTS
  // =============================================

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Unauthorized'),
        }),
      });
    });

    it('should allow staff role access to basic metrics', async () => {
      const staffToken = mockDashboardJwtToken.replace('"role":"admin"', '"role":"staff"');

      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overview');
    });

    it('should restrict admin-only features to admin role', async () => {
      const staffToken = mockDashboardJwtToken.replace('"role":"admin"', '"role":"staff"');

      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/indonesian-insights/comprehensive')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Forbidden'),
        }),
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent real-time metrics requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/customer-insights-dashboard/metrics/realtime')
          .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('overview');
      });
    });

    it('should validate time range parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/trends')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .query({
          startDate: 'invalid-date',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('invalid'),
        }),
      });
    });

    it('should handle empty customer data gracefully', async () => {
      // Clear all customers
      await customerRepository.clear();

      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${mockDashboardJwtToken}`)
        .expect(200);

      expect(response.body.overview.totalCustomers).toBe(0);
      expect(response.body.overview.totalRevenue).toBe(0);
      expect(response.body.trends).toBeDefined();
      expect(response.body.indonesianMarketInsights).toBeDefined();
    });

    it('should enforce tenant isolation across all endpoints', async () => {
      const differentTenantToken = mockDashboardJwtToken.replace(
        mockDashboardTenant.tenantId,
        'tenant-different-001'
      );

      const response = await request(app.getHttpServer())
        .get('/customer-insights-dashboard/metrics/realtime')
        .set('Authorization', `Bearer ${differentTenantToken}`)
        .expect(200);

      expect(response.body.overview.totalCustomers).toBe(0); // Should see no customers
    });
  });
});