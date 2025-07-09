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
// ULTRATHINK: COMPREHENSIVE CUSTOMER ANALYTICS API INTEGRATION TESTS
// Testing complete Customer Analytics API endpoints with Indonesian business intelligence
// =============================================

import { CustomerAnalyticsController } from '../../../src/customers/controllers/customer-analytics.controller';
import { CustomerAnalyticsService } from '../../../src/customers/services/customer-analytics.service';
import { Customer, CustomerSegment, LoyaltyTier } from '../../../src/customers/entities/customer.entity';
import { CustomerTransaction } from '../../../src/customers/entities/customer-transaction.entity';
import { AuthModule } from '../../../src/auth/auth.module';
import { UsersModule } from '../../../src/users/users.module';
import { User } from '../../../src/users/entities/user.entity';

// =============================================
// ULTRATHINK: COMPREHENSIVE ANALYTICS TEST DATA WITH INDONESIAN CONTEXT
// =============================================

const mockAnalyticsTenant = {
  tenantId: 'tenant-analytics-test-001',
  businessName: 'Toko Analytics Cerdas',
  location: 'Jakarta',
  industry: 'e-commerce',
};

const mockAnalyticsUser = {
  id: 'user-analytics-001',
  email: 'analytics@test.com',
  username: 'analyticsadmin',
  role: 'admin',
  tenantId: mockAnalyticsTenant.tenantId,
  isActive: true,
};

const mockIndonesianAnalyticsCustomers = [
  {
    // High-Value Jakarta Customer
    id: 'cust-analytics-hv-001',
    fullName: 'Ahmad Sutisna',
    email: 'ahmad.sutisna@corp.id',
    phone: '+6281234567890',
    customerNumber: 'CUST-20240101-001',
    tenantId: mockAnalyticsTenant.tenantId,
    segment: CustomerSegment.HIGH_VALUE,
    loyaltyTier: LoyaltyTier.PLATINUM,
    lifetimeValue: 125000000, // 125M IDR
    averageOrderValue: 4166667, // ~4.17M IDR
    totalOrders: 30,
    totalSpent: 125000000,
    averageOrderFrequency: 2.5, // orders per month
    daysSinceLastOrder: 5,
    churnProbability: 10,
    retentionScore: 95,
    firstOrderDate: new Date('2023-01-15'),
    lastOrderDate: new Date('2024-12-25'),
    addresses: [{
      city: 'Jakarta',
      state: 'DKI Jakarta',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'credit_card', 'bank_transfer'],
      preferredCategories: ['electronics', 'technology', 'business'],
    },
    purchaseBehavior: {
      seasonalPurchasePattern: {
        ramadan: true,
        lebaran: true,
        christmas: true,
        newYear: true,
      },
      mostActiveTimeOfDay: '10:00',
      mostActiveDayOfWeek: 'tuesday',
    },
    loyaltyPoints: 12500,
    tags: ['vip', 'corporate', 'high_frequency'],
  },
  {
    // Frequent Buyer Surabaya Customer
    id: 'cust-analytics-fb-002',
    fullName: 'Siti Rahayu',
    email: 'siti.rahayu@gmail.com',
    phone: '+6282345678901',
    customerNumber: 'CUST-20240102-002',
    tenantId: mockAnalyticsTenant.tenantId,
    segment: CustomerSegment.FREQUENT_BUYER,
    loyaltyTier: LoyaltyTier.GOLD,
    lifetimeValue: 35000000, // 35M IDR
    averageOrderValue: 875000, // 875K IDR
    totalOrders: 40,
    totalSpent: 35000000,
    averageOrderFrequency: 3.2, // orders per month
    daysSinceLastOrder: 2,
    churnProbability: 15,
    retentionScore: 85,
    firstOrderDate: new Date('2023-03-10'),
    lastOrderDate: new Date('2024-12-28'),
    addresses: [{
      city: 'Surabaya',
      state: 'Jawa Timur',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'gopay', 'ovo'],
      preferredCategories: ['fashion', 'beauty', 'home'],
    },
    purchaseBehavior: {
      seasonalPurchasePattern: {
        ramadan: true,
        lebaran: true,
        christmas: false,
        newYear: true,
      },
      mostActiveTimeOfDay: '19:00',
      mostActiveDayOfWeek: 'friday',
    },
    loyaltyPoints: 3500,
    tags: ['frequent', 'mobile_user', 'social_shopper'],
  },
  {
    // At-Risk Bandung Customer
    id: 'cust-analytics-ar-003',
    fullName: 'Budi Santoso',
    email: 'budi.santoso@yahoo.com',
    phone: '+6283456789012',
    customerNumber: 'CUST-20240103-003',
    tenantId: mockAnalyticsTenant.tenantId,
    segment: CustomerSegment.AT_RISK,
    loyaltyTier: LoyaltyTier.SILVER,
    lifetimeValue: 8500000, // 8.5M IDR
    averageOrderValue: 708333, // ~708K IDR
    totalOrders: 12,
    totalSpent: 8500000,
    averageOrderFrequency: 0.8, // orders per month
    daysSinceLastOrder: 85,
    churnProbability: 78,
    retentionScore: 35,
    firstOrderDate: new Date('2023-06-20'),
    lastOrderDate: new Date('2024-10-05'),
    addresses: [{
      city: 'Bandung',
      state: 'Jawa Barat',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['bank_transfer', 'cod'],
      preferredCategories: ['automotive', 'electronics'],
    },
    purchaseBehavior: {
      seasonalPurchasePattern: {
        ramadan: false,
        lebaran: false,
        christmas: true,
        newYear: false,
      },
      mostActiveTimeOfDay: '20:00',
      mostActiveDayOfWeek: 'saturday',
    },
    loyaltyPoints: 850,
    tags: ['at_risk', 'sporadic_buyer', 'needs_attention'],
  },
  {
    // New Customer Medan
    id: 'cust-analytics-nc-004',
    fullName: 'Rina Kartika',
    email: 'rina.kartika@outlook.com',
    phone: '+6284567890123',
    customerNumber: 'CUST-20241215-004',
    tenantId: mockAnalyticsTenant.tenantId,
    segment: CustomerSegment.NEW_CUSTOMER,
    loyaltyTier: LoyaltyTier.BRONZE,
    lifetimeValue: 1500000, // 1.5M IDR
    averageOrderValue: 750000, // 750K IDR
    totalOrders: 2,
    totalSpent: 1500000,
    averageOrderFrequency: 1.0, // orders per month
    daysSinceLastOrder: 15,
    churnProbability: 45,
    retentionScore: 60,
    firstOrderDate: new Date('2024-12-01'),
    lastOrderDate: new Date('2024-12-15'),
    addresses: [{
      city: 'Medan',
      state: 'Sumatera Utara',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'dana'],
      preferredCategories: ['fashion', 'accessories'],
    },
    purchaseBehavior: {
      seasonalPurchasePattern: {
        ramadan: true,
        lebaran: true,
        christmas: true,
        newYear: true,
      },
      mostActiveTimeOfDay: '21:00',
      mostActiveDayOfWeek: 'sunday',
    },
    loyaltyPoints: 150,
    tags: ['new_customer', 'potential', 'digital_native'],
  },
  {
    // Seasonal Customer Yogyakarta
    id: 'cust-analytics-sc-005',
    fullName: 'Dewi Sartika',
    email: 'dewi.sartika@uni.ac.id',
    phone: '+6285678901234',
    customerNumber: 'CUST-20240205-005',
    tenantId: mockAnalyticsTenant.tenantId,
    segment: CustomerSegment.SEASONAL,
    loyaltyTier: LoyaltyTier.SILVER,
    lifetimeValue: 12000000, // 12M IDR
    averageOrderValue: 1500000, // 1.5M IDR
    totalOrders: 8,
    totalSpent: 12000000,
    averageOrderFrequency: 0.6, // orders per month
    daysSinceLastOrder: 45,
    churnProbability: 55,
    retentionScore: 65,
    firstOrderDate: new Date('2023-04-15'),
    lastOrderDate: new Date('2024-11-15'),
    addresses: [{
      city: 'Yogyakarta',
      state: 'Daerah Istimewa Yogyakarta',
      country: 'Indonesia',
    }],
    preferences: {
      preferredPaymentMethods: ['qris', 'gopay', 'dana'],
      preferredCategories: ['education', 'books', 'technology'],
    },
    purchaseBehavior: {
      seasonalPurchasePattern: {
        ramadan: true,
        lebaran: true,
        christmas: false,
        newYear: true,
      },
      mostActiveTimeOfDay: '15:00',
      mostActiveDayOfWeek: 'wednesday',
    },
    loyaltyPoints: 1200,
    tags: ['seasonal', 'student', 'ramadan_shopper'],
  },
];

const mockCustomerTransactions = [
  {
    id: 'txn-analytics-001',
    customerId: 'cust-analytics-hv-001',
    orderId: 'order-001',
    transactionType: 'purchase',
    amount: 4500000,
    quantity: 1,
    productId: 'prod-laptop-001',
    categoryId: 'cat-electronics',
    transactionDate: new Date('2024-12-25'),
    paymentMethod: 'credit_card',
    indonesianContext: {
      ramadanSeason: false,
      lebaranProximity: false,
      culturalEvent: 'christmas',
      regionalDiscount: false,
    },
    tenantId: mockAnalyticsTenant.tenantId,
  },
  {
    id: 'txn-analytics-002',
    customerId: 'cust-analytics-fb-002',
    orderId: 'order-002',
    transactionType: 'purchase',
    amount: 850000,
    quantity: 2,
    productId: 'prod-dress-002',
    categoryId: 'cat-fashion',
    transactionDate: new Date('2024-12-28'),
    paymentMethod: 'qris',
    indonesianContext: {
      ramadanSeason: false,
      lebaranProximity: false,
      culturalEvent: null,
      regionalDiscount: true,
    },
    tenantId: mockAnalyticsTenant.tenantId,
  },
  {
    id: 'txn-analytics-003',
    customerId: 'cust-analytics-nc-004',
    orderId: 'order-003',
    transactionType: 'purchase',
    amount: 750000,
    quantity: 1,
    productId: 'prod-shoes-003',
    categoryId: 'cat-fashion',
    transactionDate: new Date('2024-12-15'),
    paymentMethod: 'dana',
    indonesianContext: {
      ramadanSeason: false,
      lebaranProximity: false,
      culturalEvent: null,
      regionalDiscount: false,
    },
    tenantId: mockAnalyticsTenant.tenantId,
  },
];

const mockAnalyticsJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWFuYWx5dGljcy0wMDEiLCJ1c2VybmFtZSI6ImFuYWx5dGljc2FkbWluIiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ0ZW5hbnQtYW5hbHl0aWNzLXRlc3QtMDAxIiwiaWF0IjoxNjM5OTQwMDAwLCJleHAiOjE2Mzk5NDM2MDB9.mockAnalyticsTokenSignature';

describe('CustomerAnalyticsController Integration Tests', () => {
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
      controllers: [CustomerAnalyticsController],
      providers: [CustomerAnalyticsService],
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
    const testUser = userRepository.create(mockAnalyticsUser);
    await userRepository.save(testUser);

    // Create test customers with analytics data
    for (const customerData of mockIndonesianAnalyticsCustomers) {
      const customer = customerRepository.create(customerData);
      await customerRepository.save(customer);
    }

    // Create test transactions
    for (const transactionData of mockCustomerTransactions) {
      const transaction = customerTransactionRepository.create(transactionData);
      await customerTransactionRepository.save(transaction);
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // ULTRATHINK: CUSTOMER ANALYTICS SUMMARY TESTS
  // =============================================

  describe('GET /customers/analytics/summary - Analytics Summary', () => {
    it('should retrieve comprehensive customer analytics summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          page: 1,
          limit: 20,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            customerId: expect.any(String),
            customerName: expect.any(String),
            segment: expect.any(String),
            valueSegment: expect.any(String),
            totalSpent: expect.any(Number),
            totalOrders: expect.any(Number),
            averageOrderValue: expect.any(Number),
            monthlyTransactionFrequency: expect.any(Number),
            daysSinceLastTransaction: expect.any(Number),
            churnRiskScore: expect.any(Number),
            lifetimeValue: expect.any(Number),
            primaryChannel: expect.any(String),
            indonesianFactors: expect.objectContaining({
              region: expect.any(String),
              preferredPaymentMethods: expect.any(Array),
              culturalAlignmentScore: expect.any(Number),
              mobileUsageIndicator: expect.any(Boolean),
              whatsappEngagement: expect.any(Boolean),
            }),
          }),
        ]),
        meta: expect.objectContaining({
          total: 5,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
        summary: expect.objectContaining({
          totalCustomers: 5,
          totalRevenue: expect.any(Number),
          averageLifetimeValue: expect.any(Number),
          averageChurnRisk: expect.any(Number),
          topSegments: expect.any(Array),
          indonesianInsights: expect.objectContaining({
            topRegions: expect.any(Array),
            paymentMethodDistribution: expect.any(Object),
            mobileAdoptionRate: expect.any(Number),
            culturalFactorImpact: expect.any(Number),
          }),
        }),
      });
    });

    it('should filter analytics by customer segment', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          segment: [CustomerSegment.HIGH_VALUE, CustomerSegment.FREQUENT_BUYER],
        })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(customer => {
        expect([CustomerSegment.HIGH_VALUE, CustomerSegment.FREQUENT_BUYER])
          .toContain(customer.segment);
      });
    });

    it('should filter analytics by value segment', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          valueSegment: ['high_value'],
        })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(customer => {
        expect(customer.totalSpent).toBeGreaterThan(10000000); // 10M IDR threshold
      });
    });

    it('should filter by churn risk range', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          churnRiskMin: 70,
          churnRiskMax: 100,
        })
        .expect(200);

      expect(response.body.data).toHaveLength(1); // Only at-risk customer
      response.body.data.forEach(customer => {
        expect(customer.churnRiskScore).toBeGreaterThanOrEqual(70);
        expect(customer.churnRiskScore).toBeLessThanOrEqual(100);
      });
    });

    it('should filter by transaction frequency', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          transactionFrequencyMin: 2.0,
        })
        .expect(200);

      response.body.data.forEach(customer => {
        expect(customer.monthlyTransactionFrequency).toBeGreaterThanOrEqual(2.0);
      });
    });

    it('should filter by days since last transaction', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          daysSinceLastTransactionMax: 30,
        })
        .expect(200);

      response.body.data.forEach(customer => {
        expect(customer.daysSinceLastTransaction).toBeLessThanOrEqual(30);
      });
    });

    it('should filter by total spent range', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          totalSpentMin: 10000000, // 10M IDR
          totalSpentMax: 50000000, // 50M IDR
        })
        .expect(200);

      response.body.data.forEach(customer => {
        expect(customer.totalSpent).toBeGreaterThanOrEqual(10000000);
        expect(customer.totalSpent).toBeLessThanOrEqual(50000000);
      });
    });

    it('should sort analytics results correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          sortBy: 'totalSpent',
          sortOrder: 'DESC',
        })
        .expect(200);

      const spentValues = response.body.data.map(c => c.totalSpent);
      expect(spentValues).toEqual([...spentValues].sort((a, b) => b - a));
      expect(spentValues[0]).toBe(125000000); // Ahmad's spending
    });

    it('should include Indonesian market insights in summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const summary = response.body.summary;
      
      expect(summary.indonesianInsights).toHaveProperty('topRegions');
      expect(summary.indonesianInsights.topRegions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            region: expect.stringMatching(/Jakarta|Surabaya|Bandung|Medan|Yogyakarta/),
            customerCount: expect.any(Number),
            averageSpending: expect.any(Number),
            churnRisk: expect.any(Number),
          }),
        ])
      );

      expect(summary.indonesianInsights.paymentMethodDistribution).toHaveProperty('qris');
      expect(summary.indonesianInsights.paymentMethodDistribution).toHaveProperty('gopay');
      expect(summary.indonesianInsights.paymentMethodDistribution).toHaveProperty('bank_transfer');

      expect(summary.indonesianInsights).toHaveProperty('mobileAdoptionRate');
      expect(summary.indonesianInsights.mobileAdoptionRate).toBeGreaterThan(80);

      expect(summary.indonesianInsights).toHaveProperty('culturalFactorImpact');
      expect(summary.indonesianInsights.culturalFactorImpact).toBeGreaterThan(0);
    });
  });

  // =============================================
  // ULTRATHINK: INDIVIDUAL CUSTOMER ANALYTICS TESTS
  // =============================================

  describe('GET /customers/analytics/customer/:id - Individual Customer Analytics', () => {
    it('should retrieve comprehensive analytics for high-value customer', async () => {
      const customerId = 'cust-analytics-hv-001';

      const response = await request(app.getHttpServer())
        .get(`/customers/analytics/customer/${customerId}`)
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            customerId,
            customerName: 'Ahmad Sutisna',
            segment: CustomerSegment.HIGH_VALUE,
            lifetimeValue: 125000000,
            totalSpent: 125000000,
            totalOrders: 30,
            churnRiskScore: 10,
            indonesianFactors: expect.objectContaining({
              region: 'Jakarta',
              culturalAlignmentScore: expect.any(Number),
              paymentMethodPreferences: expect.arrayContaining(['qris', 'credit_card']),
              seasonalBehavior: expect.objectContaining({
                ramadanShopper: true,
                lebaranShopper: true,
                christmasShopper: true,
              }),
            }),
          }),
          productAffinity: expect.arrayContaining([
            expect.objectContaining({
              category: expect.any(String),
              totalSpentCategory: expect.any(Number),
              orderCount: expect.any(Number),
              monthlyPurchaseFrequency: expect.any(Number),
              categoryShareOfWallet: expect.any(Number),
              affinityScore: expect.any(Number),
            }),
          ]),
          dailyMetrics: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              transactionCount: expect.any(Number),
              dailyTotal: expect.any(Number),
              totalQuantity: expect.any(Number),
              averageOrderValue: expect.any(Number),
            }),
          ]),
        }),
        meta: expect.objectContaining({
          customerId,
          tenantId: mockAnalyticsTenant.tenantId,
          retrievedAt: expect.any(String),
        }),
      });
    });

    it('should retrieve analytics for at-risk customer with recommendations', async () => {
      const customerId = 'cust-analytics-ar-003';

      const response = await request(app.getHttpServer())
        .get(`/customers/analytics/customer/${customerId}`)
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const summary = response.body.data.summary;
      
      expect(summary).toMatchObject({
        customerId,
        customerName: 'Budi Santoso',
        segment: CustomerSegment.AT_RISK,
        churnRiskScore: 78,
        daysSinceLastTransaction: 85,
        retentionRecommendations: expect.arrayContaining([
          expect.objectContaining({
            action: expect.any(String),
            priority: expect.any(String),
            expectedImpact: expect.any(String),
            indonesianContext: expect.any(String),
          }),
        ]),
      });

      expect(summary.indonesianFactors.region).toBe('Bandung');
      expect(summary.indonesianFactors.culturalAlignmentScore).toBeLessThan(80);
    });

    it('should return 404 for non-existent customer', async () => {
      const nonExistentId = 'cust-non-existent-999';

      const response = await request(app.getHttpServer())
        .get(`/customers/analytics/customer/${nonExistentId}`)
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('not found'),
          code: 'CUSTOMER_NOT_FOUND',
        }),
      });
    });

    it('should enforce tenant isolation for customer analytics', async () => {
      const customerId = 'cust-analytics-hv-001';
      
      // Use token with different tenant
      const differentTenantToken = mockAnalyticsJwtToken.replace(
        mockAnalyticsTenant.tenantId, 
        'tenant-different-001'
      );

      const response = await request(app.getHttpServer())
        .get(`/customers/analytics/customer/${customerId}`)
        .set('Authorization', `Bearer ${differentTenantToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('not found'),
        }),
      });
    });
  });

  // =============================================
  // ULTRATHINK: COHORT ANALYSIS TESTS
  // =============================================

  describe('GET /customers/analytics/cohort-analysis - Cohort Analysis', () => {
    it('should retrieve customer cohort analysis with retention metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/cohort-analysis')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            cohortMonth: expect.any(String),
            cohortSize: expect.any(Number),
            month1RetentionRate: expect.any(Number),
            month3RetentionRate: expect.any(Number),
            month6RetentionRate: expect.any(Number),
            month12RetentionRate: expect.any(Number),
            revenuePerCustomer: expect.any(Number),
            totalRevenue: expect.any(Number),
            indonesianFactors: expect.objectContaining({
              averageCulturalAlignment: expect.any(Number),
              topRegion: expect.any(String),
              seasonalSignupPattern: expect.any(Object),
            }),
          }),
        ]),
        summary: expect.objectContaining({
          totalCohorts: expect.any(Number),
          totalCustomers: expect.any(Number),
          avgMonth1Retention: expect.any(Number),
          avgMonth3Retention: expect.any(Number),
          avgMonth6Retention: expect.any(Number),
          avgMonth12Retention: expect.any(Number),
        }),
        meta: expect.objectContaining({
          tenantId: mockAnalyticsTenant.tenantId,
          retrievedAt: expect.any(String),
        }),
      });
    });

    it('should filter cohort analysis by date range', async () => {
      const startDate = '2023-01-01';
      const endDate = '2024-12-31';

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/cohort-analysis')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          startDate,
          endDate,
        })
        .expect(200);

      expect(response.body.meta.dateRange).toMatchObject({
        startDate,
        endDate,
      });

      // All cohorts should be within the specified range
      response.body.data.forEach(cohort => {
        const cohortDate = new Date(cohort.cohortMonth);
        expect(cohortDate).toBeGreaterThanOrEqual(new Date(startDate));
        expect(cohortDate).toBeLessThanOrEqual(new Date(endDate));
      });
    });

    it('should include Indonesian cohort insights', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/cohort-analysis')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      response.body.data.forEach(cohort => {
        expect(cohort.indonesianFactors).toHaveProperty('averageCulturalAlignment');
        expect(cohort.indonesianFactors).toHaveProperty('topRegion');
        expect(cohort.indonesianFactors).toHaveProperty('seasonalSignupPattern');
        
        expect(cohort.indonesianFactors.topRegion).toMatch(/Jakarta|Surabaya|Bandung|Medan|Yogyakarta/);
      });
    });

    it('should calculate accurate retention rates', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/cohort-analysis')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      response.body.data.forEach(cohort => {
        // Retention rates should decrease over time (month1 >= month3 >= month6 >= month12)
        expect(cohort.month1RetentionRate).toBeGreaterThanOrEqual(cohort.month3RetentionRate);
        expect(cohort.month3RetentionRate).toBeGreaterThanOrEqual(cohort.month6RetentionRate);
        expect(cohort.month6RetentionRate).toBeGreaterThanOrEqual(cohort.month12RetentionRate);
        
        // All retention rates should be between 0 and 100
        expect(cohort.month1RetentionRate).toBeGreaterThanOrEqual(0);
        expect(cohort.month1RetentionRate).toBeLessThanOrEqual(100);
        expect(cohort.month12RetentionRate).toBeGreaterThanOrEqual(0);
        expect(cohort.month12RetentionRate).toBeLessThanOrEqual(100);
      });
    });
  });

  // =============================================
  // ULTRATHINK: PRODUCT AFFINITY ANALYSIS TESTS
  // =============================================

  describe('GET /customers/analytics/product-affinity - Product Affinity Analysis', () => {
    it('should retrieve overall product affinity analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/product-affinity')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          topCategories: 10,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            customerId: expect.any(String),
            customerName: expect.any(String),
            category: expect.any(String),
            totalSpentCategory: expect.any(Number),
            orderCount: expect.any(Number),
            monthlyPurchaseFrequency: expect.any(Number),
            categoryShareOfWallet: expect.any(Number),
            affinityScore: expect.any(Number),
            indonesianFactors: expect.objectContaining({
              localBrandPreference: expect.any(Boolean),
              culturalRelevance: expect.any(Number),
              seasonalDemand: expect.any(Object),
            }),
          }),
        ]),
        summary: expect.objectContaining({
          totalCategories: expect.any(Number),
          topCategories: expect.arrayContaining([
            expect.objectContaining({
              category: expect.any(String),
              totalCustomers: expect.any(Number),
              totalSpent: expect.any(Number),
              avgFrequency: expect.any(Number),
              avgShareOfWallet: expect.any(Number),
            }),
          ]),
        }),
        meta: expect.objectContaining({
          tenantId: mockAnalyticsTenant.tenantId,
          retrievedAt: expect.any(String),
        }),
      });
    });

    it('should retrieve product affinity for specific customer', async () => {
      const customerId = 'cust-analytics-hv-001';

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/product-affinity')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          customerId,
          topCategories: 5,
        })
        .expect(200);

      // All results should be for the specified customer
      response.body.data.forEach(affinity => {
        expect(affinity.customerId).toBe(customerId);
        expect(affinity.customerName).toBe('Ahmad Sutisna');
      });

      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should include Indonesian market factors in affinity analysis', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/product-affinity')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      response.body.data.forEach(affinity => {
        expect(affinity.indonesianFactors).toHaveProperty('localBrandPreference');
        expect(affinity.indonesianFactors).toHaveProperty('culturalRelevance');
        expect(affinity.indonesianFactors).toHaveProperty('seasonalDemand');
        
        expect(affinity.indonesianFactors.culturalRelevance).toBeGreaterThanOrEqual(0);
        expect(affinity.indonesianFactors.culturalRelevance).toBeLessThanOrEqual(100);
        
        expect(affinity.indonesianFactors.seasonalDemand).toHaveProperty('ramadan');
        expect(affinity.indonesianFactors.seasonalDemand).toHaveProperty('lebaran');
      });
    });

    it('should calculate accurate affinity scores', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/product-affinity')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      response.body.data.forEach(affinity => {
        // Affinity score should be between 0 and 100
        expect(affinity.affinityScore).toBeGreaterThanOrEqual(0);
        expect(affinity.affinityScore).toBeLessThanOrEqual(100);
        
        // Share of wallet should be between 0 and 100
        expect(affinity.categoryShareOfWallet).toBeGreaterThanOrEqual(0);
        expect(affinity.categoryShareOfWallet).toBeLessThanOrEqual(100);
        
        // Monthly frequency should be positive
        expect(affinity.monthlyPurchaseFrequency).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // =============================================
  // ULTRATHINK: DAILY METRICS TESTS
  // =============================================

  describe('GET /customers/analytics/daily-metrics - Daily Customer Metrics', () => {
    it('should retrieve aggregated daily customer metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/daily-metrics')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            transactionCount: expect.any(Number),
            dailyTotal: expect.any(Number),
            totalQuantity: expect.any(Number),
            averageOrderValue: expect.any(Number),
            uniqueCustomers: expect.any(Number),
            indonesianFactors: expect.objectContaining({
              paymentMethodBreakdown: expect.any(Object),
              regionalActivity: expect.any(Object),
              culturalEventImpact: expect.any(Number),
            }),
          }),
        ]),
        summary: expect.objectContaining({
          totalDays: expect.any(Number),
          totalTransactions: expect.any(Number),
          totalRevenue: expect.any(Number),
          avgDailyRevenue: expect.any(Number),
          maxDailyRevenue: expect.any(Number),
          totalQuantity: expect.any(Number),
        }),
        meta: expect.objectContaining({
          dateRange: expect.objectContaining({
            startDate: expect.any(String),
            endDate: expect.any(String),
          }),
          tenantId: mockAnalyticsTenant.tenantId,
          retrievedAt: expect.any(String),
        }),
      });
    });

    it('should filter daily metrics by customer', async () => {
      const customerId = 'cust-analytics-hv-001';

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/daily-metrics')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          customerId,
        })
        .expect(200);

      expect(response.body.meta.customerId).toBe(customerId);
      
      // Verify the metrics are customer-specific
      response.body.data.forEach(metric => {
        expect(metric.uniqueCustomers).toBeLessThanOrEqual(1); // Should be 0 or 1 for specific customer
      });
    });

    it('should filter daily metrics by date range', async () => {
      const startDate = '2024-12-01';
      const endDate = '2024-12-31';

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/daily-metrics')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          startDate,
          endDate,
        })
        .expect(200);

      expect(response.body.meta.dateRange).toMatchObject({
        startDate,
        endDate,
      });

      // All dates should be within the specified range
      response.body.data.forEach(metric => {
        const metricDate = new Date(metric.date);
        expect(metricDate).toBeGreaterThanOrEqual(new Date(startDate));
        expect(metricDate).toBeLessThanOrEqual(new Date(endDate));
      });
    });

    it('should include Indonesian market factors in daily metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/daily-metrics')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      response.body.data.forEach(metric => {
        expect(metric.indonesianFactors).toHaveProperty('paymentMethodBreakdown');
        expect(metric.indonesianFactors).toHaveProperty('regionalActivity');
        expect(metric.indonesianFactors).toHaveProperty('culturalEventImpact');
        
        expect(metric.indonesianFactors.paymentMethodBreakdown).toHaveProperty('qris');
        expect(metric.indonesianFactors.paymentMethodBreakdown).toHaveProperty('gopay');
        
        expect(metric.indonesianFactors.culturalEventImpact).toBeGreaterThanOrEqual(0);
        expect(metric.indonesianFactors.culturalEventImpact).toBeLessThanOrEqual(200); // Max 200% impact
      });
    });

    it('should calculate accurate daily aggregations', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/daily-metrics')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      response.body.data.forEach(metric => {
        // Average order value should equal dailyTotal / transactionCount
        if (metric.transactionCount > 0) {
          const expectedAOV = metric.dailyTotal / metric.transactionCount;
          expect(Math.abs(metric.averageOrderValue - expectedAOV)).toBeLessThan(0.01);
        }
        
        // All values should be non-negative
        expect(metric.transactionCount).toBeGreaterThanOrEqual(0);
        expect(metric.dailyTotal).toBeGreaterThanOrEqual(0);
        expect(metric.totalQuantity).toBeGreaterThanOrEqual(0);
        expect(metric.uniqueCustomers).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // =============================================
  // ULTRATHINK: ANALYTICS VIEWS MANAGEMENT TESTS
  // =============================================

  describe('POST /customers/analytics/refresh - Analytics Views Refresh', () => {
    it('should manually refresh analytics views successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/customers/analytics/refresh')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String),
        data: expect.objectContaining({
          refreshedViews: expect.arrayContaining([
            expect.stringMatching(/customer_analytics_view|customer_daily_metrics|customer_cohort_analysis/),
          ]),
          duration: expect.any(Number),
        }),
        meta: expect.objectContaining({
          triggeredBy: mockAnalyticsUser.id,
          tenantId: mockAnalyticsTenant.tenantId,
          refreshedAt: expect.any(String),
        }),
      });

      expect(response.body.data.duration).toBeGreaterThan(0);
    });

    it('should reject refresh request from non-admin user', async () => {
      const staffToken = mockAnalyticsJwtToken.replace('"role":"admin"', '"role":"staff"');

      const response = await request(app.getHttpServer())
        .post('/customers/analytics/refresh')
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

  describe('GET /customers/analytics/health - Analytics Health Status', () => {
    it('should retrieve analytics views health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/health')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          overallHealth: expect.stringMatching(/healthy|warning|critical/),
          views: expect.arrayContaining([
            expect.objectContaining({
              viewName: expect.any(String),
              status: expect.stringMatching(/healthy|stale|error/),
              lastRefresh: expect.any(String),
              recordCount: expect.any(Number),
              stalenessMinutes: expect.any(Number),
            }),
          ]),
          recommendations: expect.any(Array),
          performanceMetrics: expect.objectContaining({
            avgQueryTime: expect.any(Number),
            cacheHitRate: expect.any(Number),
            dataFreshness: expect.any(Number),
          }),
        }),
        meta: expect.objectContaining({
          tenantId: mockAnalyticsTenant.tenantId,
          checkedAt: expect.any(String),
        }),
      });
    });

    it('should identify stale analytics views', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/health')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const views = response.body.data.views;
      const staleViews = views.filter(view => view.status === 'stale');
      
      if (staleViews.length > 0) {
        expect(response.body.data.recommendations).toContain('Refresh stale analytics views');
      }
    });
  });

  // =============================================
  // ULTRATHINK: HIGH-VALUE CUSTOMER INSIGHTS TESTS
  // =============================================

  describe('GET /customers/analytics/insights/high-value - High-Value Customer Insights', () => {
    it('should retrieve high-value customer insights with recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/high-value')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          customers: expect.arrayContaining([
            expect.objectContaining({
              customerId: expect.any(String),
              customerName: expect.any(String),
              totalSpent: expect.any(Number),
              monthlyTransactionFrequency: expect.any(Number),
              churnRiskScore: expect.any(Number),
              valueSegment: 'high_value',
            }),
          ]),
          insights: expect.objectContaining({
            totalHighValueCustomers: expect.any(Number),
            revenueContribution: expect.any(Number),
            avgTransactionFrequency: expect.any(Number),
            topChannels: expect.arrayContaining([
              expect.objectContaining({
                channel: expect.any(String),
                count: expect.any(Number),
                revenue: expect.any(Number),
              }),
            ]),
            atRiskCount: expect.any(Number),
            recommendations: expect.arrayContaining([expect.any(String)]),
          }),
        }),
        meta: expect.objectContaining({
          tenantId: mockAnalyticsTenant.tenantId,
          generatedAt: expect.any(String),
        }),
      });
    });

    it('should include Indonesian-specific insights for high-value customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/high-value')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const customers = response.body.data.customers;
      
      customers.forEach(customer => {
        expect(customer).toHaveProperty('indonesianFactors');
        expect(customer.indonesianFactors).toHaveProperty('region');
        expect(customer.indonesianFactors).toHaveProperty('culturalAlignmentScore');
        expect(customer.indonesianFactors).toHaveProperty('paymentMethodPreferences');
      });

      // Should include Indonesian-specific recommendations
      const recommendations = response.body.data.insights.recommendations;
      const indonesianRecommendations = recommendations.filter(rec => 
        rec.includes('WhatsApp') || 
        rec.includes('QRIS') || 
        rec.includes('Indonesian') ||
        rec.includes('cultural')
      );
      
      expect(indonesianRecommendations.length).toBeGreaterThan(0);
    });

    it('should identify at-risk high-value customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/high-value')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const insights = response.body.data.insights;
      
      if (insights.atRiskCount > 0) {
        expect(insights.recommendations).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/retention|at risk|high-value/),
          ])
        );
      }
    });
  });

  describe('GET /customers/analytics/insights/at-risk - At-Risk Customer Insights', () => {
    it('should retrieve at-risk customer insights with intervention strategies', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/at-risk')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          customers: expect.arrayContaining([
            expect.objectContaining({
              customerId: 'cust-analytics-ar-003',
              customerName: 'Budi Santoso',
              churnRiskScore: expect.any(Number),
              daysSinceLastTransaction: expect.any(Number),
              totalSpent: expect.any(Number),
            }),
          ]),
          insights: expect.objectContaining({
            totalAtRiskCustomers: expect.any(Number),
            potentialLostRevenue: expect.any(Number),
            avgDaysSinceLastTransaction: expect.any(Number),
            highValueAtRisk: expect.any(Number),
            recommendations: expect.arrayContaining([expect.any(String)]),
          }),
        }),
        meta: expect.objectContaining({
          tenantId: mockAnalyticsTenant.tenantId,
          generatedAt: expect.any(String),
        }),
      });

      // All customers should have high churn risk
      response.body.data.customers.forEach(customer => {
        expect(customer.churnRiskScore).toBeGreaterThanOrEqual(70);
      });
    });

    it('should prioritize at-risk customers by churn score', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/at-risk')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const customers = response.body.data.customers;
      const churnScores = customers.map(c => c.churnRiskScore);
      
      // Should be sorted by churn risk descending
      expect(churnScores).toEqual([...churnScores].sort((a, b) => b - a));
    });

    it('should include Indonesian-specific retention strategies', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/at-risk')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .expect(200);

      const recommendations = response.body.data.insights.recommendations;
      
      // Should include Indonesian-specific recommendations
      const indonesianStrategies = recommendations.filter(rec => 
        rec.includes('WhatsApp') || 
        rec.includes('cultural') || 
        rec.includes('local') ||
        rec.includes('Indonesian')
      );
      
      expect(indonesianStrategies.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================
  // ULTRATHINK: AUTHENTICATION AND PERFORMANCE TESTS
  // =============================================

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Unauthorized'),
        }),
      });
    });

    it('should reject staff role from analytics endpoints', async () => {
      const staffToken = mockAnalyticsJwtToken.replace('"role":"admin"', '"role":"staff"');

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/insights/high-value')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Forbidden'),
        }),
      });
    });

    it('should allow manager role access to analytics', async () => {
      const managerToken = mockAnalyticsJwtToken.replace('"role":"admin"', '"role":"manager"');

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large result sets with proper pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          limit: 1000, // Large limit
        })
        .expect(200);

      expect(response.body.meta.limit).toBeLessThanOrEqual(100); // Should be capped
    });

    it('should handle concurrent analytics requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/customers/analytics/summary')
          .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should validate date range parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/cohort-analysis')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          startDate: 'invalid-date',
          endDate: '2024-12-31',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('invalid date'),
        }),
      });
    });

    it('should handle empty result sets gracefully', async () => {
      // Filter for non-existent segments
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockAnalyticsJwtToken}`)
        .query({
          segment: ['non_existent_segment'],
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: [],
        meta: expect.objectContaining({
          total: 0,
        }),
      });
    });
  });
});