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
// ULTRATHINK: COMPREHENSIVE CUSTOMER API INTEGRATION TESTS
// Testing complete Customer API endpoints with Indonesian business context
// =============================================

import { CustomersController } from '../../../src/customers/controllers/customers.controller';
import { CustomersService } from '../../../src/customers/services/customers.service';
import { Customer, CustomerStatus, CustomerSegment, LoyaltyTier } from '../../../src/customers/entities/customer.entity';
import { CustomerTransaction } from '../../../src/customers/entities/customer-transaction.entity';
import { AuthModule } from '../../../src/auth/auth.module';
import { UsersModule } from '../../../src/users/users.module';
import { User } from '../../../src/users/entities/user.entity';

// =============================================
// ULTRATHINK: COMPREHENSIVE TEST DATA FOR INDONESIAN BUSINESS SCENARIOS
// =============================================

const mockTestTenant = {
  tenantId: 'tenant-integration-test-001',
  businessName: 'Toko Berkah Jaya',
  location: 'Jakarta',
  industry: 'retail',
};

const mockIndonesianCustomersData = [
  {
    fullName: 'Budi Santoso',
    firstName: 'Budi',
    lastName: 'Santoso',
    email: 'budi.santoso@gmail.com',
    phone: '+6281234567890',
    dateOfBirth: new Date('1985-05-15'),
    customerType: 'individual',
    status: CustomerStatus.ACTIVE,
    addresses: [{
      id: 'addr-001',
      type: 'shipping',
      isDefault: true,
      name: 'Rumah Utama',
      address: 'Jl. Sudirman No. 123',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      postalCode: '12190',
      country: 'Indonesia',
      phone: '+6281234567890',
    }],
    segment: CustomerSegment.FREQUENT_BUYER,
    loyaltyTier: LoyaltyTier.SILVER,
    lifetimeValue: 15750000, // 15.75M IDR
    averageOrderValue: 875000,
    totalOrders: 18,
    totalSpent: 15750000,
    preferences: {
      preferredCategories: ['electronics', 'fashion'],
      preferredBrands: ['Samsung', 'Adidas'],
      preferredPriceRange: { min: 100000, max: 2000000 },
      preferredPaymentMethods: ['qris', 'gopay', 'bank_transfer'],
      preferredDeliveryMethods: ['jne', 'gojek'],
      communicationPreferences: {
        email: true,
        sms: false,
        whatsapp: true,
        phone: false,
      },
      marketingConsent: true,
    },
    purchaseBehavior: {
      averageDaysBetweenOrders: 25,
      mostActiveTimeOfDay: '19:00',
      mostActiveDayOfWeek: 'friday',
      seasonalPurchasePattern: {
        ramadan: true,
        lebaran: true,
        christmas: false,
        newYear: true,
      },
      pricesensitivity: 'medium',
      brandLoyalty: 'high',
    },
    externalIds: {
      shopeeCustomerId: 'shopee_budi_123',
      tokopediaCustomerId: 'tokped_budi_456',
      whatsappContactId: '+6281234567890',
    },
    socialProfiles: {
      whatsapp: '+6281234567890',
      instagram: '@budi_santoso',
    },
    tags: ['vip', 'ramadan_shopper', 'mobile_user'],
    loyaltyPoints: 1575,
  },
  {
    fullName: 'Siti Nurhaliza',
    firstName: 'Siti',
    lastName: 'Nurhaliza',
    email: 'siti.nurhaliza@yahoo.com',
    phone: '+6282345678901',
    dateOfBirth: new Date('1990-08-20'),
    customerType: 'individual',
    status: CustomerStatus.ACTIVE,
    addresses: [{
      id: 'addr-002',
      type: 'shipping',
      isDefault: true,
      name: 'Rumah Keluarga',
      address: 'Jl. Diponegoro No. 45',
      city: 'Surabaya',
      state: 'Jawa Timur',
      postalCode: '60231',
      country: 'Indonesia',
      phone: '+6282345678901',
    }],
    segment: CustomerSegment.HIGH_VALUE,
    loyaltyTier: LoyaltyTier.GOLD,
    lifetimeValue: 45250000, // 45.25M IDR
    averageOrderValue: 1510000,
    totalOrders: 30,
    totalSpent: 45250000,
    preferences: {
      preferredCategories: ['fashion', 'beauty', 'home'],
      preferredBrands: ['Uniqlo', 'Wardah', 'IKEA'],
      preferredPriceRange: { min: 500000, max: 5000000 },
      preferredPaymentMethods: ['qris', 'ovo', 'dana'],
      preferredDeliveryMethods: ['jnt', 'sicepat'],
      communicationPreferences: {
        email: true,
        sms: true,
        whatsapp: true,
        phone: true,
      },
      marketingConsent: true,
    },
    purchaseBehavior: {
      averageDaysBetweenOrders: 15,
      mostActiveTimeOfDay: '14:00',
      mostActiveDayOfWeek: 'saturday',
      seasonalPurchasePattern: {
        ramadan: true,
        lebaran: true,
        christmas: true,
        newYear: true,
      },
      pricesensitivity: 'low',
      brandLoyalty: 'medium',
    },
    externalIds: {
      shopeeCustomerId: 'shopee_siti_789',
      lazadaCustomerId: 'lazada_siti_012',
      whatsappContactId: '+6282345678901',
    },
    socialProfiles: {
      whatsapp: '+6282345678901',
      instagram: '@siti_nurhal',
      facebook: 'siti.nurhaliza',
    },
    tags: ['high_value', 'frequent_buyer', 'omnichannel'],
    loyaltyPoints: 4525,
  },
  {
    fullName: 'Ahmad Wijaya',
    firstName: 'Ahmad',
    lastName: 'Wijaya',
    email: 'ahmad.wijaya@perusahaan.com',
    phone: '+6283456789012',
    dateOfBirth: new Date('1978-03-22'),
    customerType: 'business',
    status: CustomerStatus.ACTIVE,
    companyName: 'PT Berkah Mandiri',
    taxId: '01.123.456.7-890.000',
    industry: 'manufacturing',
    businessSize: 'medium',
    addresses: [{
      id: 'addr-003',
      type: 'business',
      isDefault: true,
      name: 'Kantor Pusat',
      address: 'Jl. HR Rasuna Said Kav. 10',
      city: 'Jakarta',
      state: 'DKI Jakarta',
      postalCode: '12950',
      country: 'Indonesia',
      phone: '+6283456789012',
    }],
    segment: CustomerSegment.HIGH_VALUE,
    loyaltyTier: LoyaltyTier.PLATINUM,
    lifetimeValue: 125000000, // 125M IDR
    averageOrderValue: 5000000,
    totalOrders: 25,
    totalSpent: 125000000,
    preferences: {
      preferredCategories: ['office_supplies', 'technology', 'services'],
      preferredBrands: ['Canon', 'Dell', 'Microsoft'],
      preferredPriceRange: { min: 1000000, max: 20000000 },
      preferredPaymentMethods: ['bank_transfer', 'credit_card'],
      preferredDeliveryMethods: ['courier', 'pickup'],
      communicationPreferences: {
        email: true,
        sms: false,
        whatsapp: true,
        phone: true,
      },
      marketingConsent: false,
    },
    purchaseBehavior: {
      averageDaysBetweenOrders: 30,
      mostActiveTimeOfDay: '10:00',
      mostActiveDayOfWeek: 'tuesday',
      seasonalPurchasePattern: {
        ramadan: false,
        lebaran: false,
        christmas: true,
        newYear: true,
      },
      pricesensitivity: 'low',
      brandLoyalty: 'high',
    },
    tags: ['b2b', 'corporate', 'bulk_buyer'],
    loyaltyPoints: 12500,
  },
];

const mockAtRiskCustomer = {
  fullName: 'Rina Kartika',
  firstName: 'Rina',
  lastName: 'Kartika',
  email: 'rina.kartika@email.com',
  phone: '+6284567890123',
  dateOfBirth: new Date('1992-11-10'),
  customerType: 'individual',
  status: CustomerStatus.ACTIVE,
  segment: CustomerSegment.AT_RISK,
  loyaltyTier: LoyaltyTier.BRONZE,
  lifetimeValue: 2500000,
  averageOrderValue: 250000,
  totalOrders: 10,
  totalSpent: 2500000,
  daysSinceLastOrder: 120, // 4 months ago
  churnProbability: 85,
  retentionScore: 25,
  tags: ['at_risk', 'inactive', 'needs_attention'],
  loyaltyPoints: 250,
};

const mockTestUser = {
  id: 'user-test-001',
  email: 'admin@test.com',
  username: 'testadmin',
  role: 'admin',
  tenantId: mockTestTenant.tenantId,
  isActive: true,
};

// =============================================
// ULTRATHINK: JWT TOKEN MOCK FOR AUTHENTICATION
// =============================================

const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLXRlc3QtMDAxIiwidXNlcm5hbWUiOiJ0ZXN0YWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6InRlbmFudC1pbnRlZ3JhdGlvbi10ZXN0LTAwMSIsImlhdCI6MTYzOTk0MDAwMCwiZXhwIjoxNjM5OTQzNjAwfQ.mockTokenSignature';

describe('CustomersController Integration Tests', () => {
  let app: INestApplication;
  let customerRepository: Repository<Customer>;
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
      controllers: [CustomersController],
      providers: [CustomersService],
    }).compile();

    app = moduleRef.createNestApplication();
    
    // Setup CORS, validation, and other middleware
    app.enableCors();
    
    await app.init();

    customerRepository = moduleRef.get<Repository<Customer>>(getRepositoryToken(Customer));
    userRepository = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  beforeEach(async () => {
    // Clean up database before each test
    await customerRepository.clear();
    await userRepository.clear();

    // Create test user for authentication
    const testUser = userRepository.create(mockTestUser);
    await userRepository.save(testUser);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // =============================================
  // ULTRATHINK: CUSTOMER CREATION TESTS WITH INDONESIAN CONTEXT
  // =============================================

  describe('POST /customers - Create Customer', () => {
    it('should create Indonesian individual customer successfully', async () => {
      const customerData = mockIndonesianCustomersData[0];

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(customerData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          fullName: customerData.fullName,
          email: customerData.email,
          phone: customerData.phone,
          customerType: customerData.customerType,
          status: CustomerStatus.ACTIVE,
          segment: CustomerSegment.FREQUENT_BUYER,
          loyaltyTier: LoyaltyTier.SILVER,
          customerNumber: expect.stringMatching(/^CUST-\d{8}-\d+$/),
        }),
      });

      // Verify Indonesian-specific fields
      expect(response.body.data.addresses).toHaveLength(1);
      expect(response.body.data.addresses[0]).toMatchObject({
        city: 'Jakarta',
        state: 'DKI Jakarta',
        country: 'Indonesia',
        postalCode: '12190',
      });

      expect(response.body.data.preferences.preferredPaymentMethods).toEqual(
        expect.arrayContaining(['qris', 'gopay', 'bank_transfer'])
      );

      expect(response.body.data.purchaseBehavior.seasonalPurchasePattern).toMatchObject({
        ramadan: true,
        lebaran: true,
        christmas: false,
        newYear: true,
      });
    });

    it('should create Indonesian business customer with company details', async () => {
      const businessCustomerData = mockIndonesianCustomersData[2];

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(businessCustomerData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        customerType: 'business',
        companyName: 'PT Berkah Mandiri',
        taxId: '01.123.456.7-890.000',
        industry: 'manufacturing',
        businessSize: 'medium',
        segment: CustomerSegment.HIGH_VALUE,
        loyaltyTier: LoyaltyTier.PLATINUM,
      });

      // Verify B2B payment preferences
      expect(response.body.data.preferences.preferredPaymentMethods).toEqual(
        expect.arrayContaining(['bank_transfer', 'credit_card'])
      );
    });

    it('should handle validation errors for invalid Indonesian data', async () => {
      const invalidCustomerData = {
        fullName: '', // Empty name
        email: 'invalid-email', // Invalid email format
        phone: '08123456789', // Invalid Indonesian phone format
        addresses: [{
          postalCode: '123', // Invalid Indonesian postal code
          country: 'Singapore', // Wrong country
        }],
      };

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(invalidCustomerData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('validation'),
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'fullName',
              message: expect.stringContaining('required'),
            }),
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('valid email'),
            }),
            expect.objectContaining({
              field: 'phone',
              message: expect.stringContaining('Indonesian phone'),
            }),
          ]),
        }),
      });
    });

    it('should prevent duplicate customers with same email/phone', async () => {
      const customerData = mockIndonesianCustomersData[0];

      // Create first customer
      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(customerData)
        .expect(201);

      // Try to create duplicate customer
      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          ...customerData,
          fullName: 'Different Name', // Different name but same email/phone
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('already exists'),
          code: 'DUPLICATE_CUSTOMER',
        }),
      });
    });

    it('should enforce tenant isolation in customer creation', async () => {
      const customerData = mockIndonesianCustomersData[0];

      // Create customer with one tenant
      await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(customerData)
        .expect(201);

      // Try to create same customer with different tenant
      const differentTenantToken = mockJwtToken.replace(
        mockTestTenant.tenantId, 
        'tenant-different-001'
      );

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${differentTenantToken}`)
        .send(customerData)
        .expect(201); // Should succeed because different tenant

      expect(response.body.data.tenantId).toBe('tenant-different-001');
    });
  });

  // =============================================
  // ULTRATHINK: CUSTOMER RETRIEVAL TESTS WITH FILTERING
  // =============================================

  describe('GET /customers - Retrieve Customers', () => {
    beforeEach(async () => {
      // Create test customers
      for (const customerData of mockIndonesianCustomersData) {
        const customer = customerRepository.create({
          ...customerData,
          tenantId: mockTestTenant.tenantId,
          customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        await customerRepository.save(customer);
      }

      // Create at-risk customer
      const atRiskCustomer = customerRepository.create({
        ...mockAtRiskCustomer,
        tenantId: mockTestTenant.tenantId,
        customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      await customerRepository.save(atRiskCustomer);
    });

    it('should retrieve all customers with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            fullName: expect.any(String),
            email: expect.any(String),
            segment: expect.any(String),
            loyaltyTier: expect.any(String),
            lifetimeValue: expect.any(Number),
          }),
        ]),
        meta: expect.objectContaining({
          total: 4, // 3 regular + 1 at-risk
          page: 1,
          limit: 10,
          totalPages: 1,
        }),
      });
    });

    it('should filter customers by segment', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          segment: CustomerSegment.HIGH_VALUE,
        })
        .expect(200);

      expect(response.body.data).toHaveLength(2); // Siti and Ahmad
      response.body.data.forEach(customer => {
        expect(customer.segment).toBe(CustomerSegment.HIGH_VALUE);
      });
    });

    it('should filter customers by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          status: CustomerStatus.ACTIVE,
        })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(customer => {
        expect(customer.status).toBe(CustomerStatus.ACTIVE);
      });
    });

    it('should search customers by name and email', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          search: 'Budi',
        })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        fullName: 'Budi Santoso',
        email: 'budi.santoso@gmail.com',
      });
    });

    it('should sort customers by lifetime value descending', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          sortBy: 'lifetimeValue',
          sortOrder: 'DESC',
        })
        .expect(200);

      const ltValues = response.body.data.map(c => c.lifetimeValue);
      expect(ltValues).toEqual([...ltValues].sort((a, b) => b - a));
      expect(ltValues[0]).toBe(125000000); // Ahmad's LTV
    });

    it('should include analytics data when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          includeAnalytics: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toMatchObject({
        totalCustomers: expect.any(Number),
        totalRevenue: expect.any(Number),
        averageLifetimeValue: expect.any(Number),
        topSegments: expect.any(Array),
        indonesianInsights: expect.objectContaining({
          topRegions: expect.any(Array),
          paymentMethodDistribution: expect.any(Object),
          mobileUsageRate: expect.any(Number),
        }),
      });
    });

    it('should enforce tenant isolation in customer retrieval', async () => {
      // Get customers with original tenant
      const response1 = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      const customerCount1 = response1.body.data.length;
      expect(customerCount1).toBe(4);

      // Get customers with different tenant (should be empty)
      const differentTenantToken = mockJwtToken.replace(
        mockTestTenant.tenantId, 
        'tenant-different-001'
      );

      const response2 = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${differentTenantToken}`)
        .expect(200);

      expect(response2.body.data).toHaveLength(0);
      expect(response2.body.meta.total).toBe(0);
    });
  });

  // =============================================
  // ULTRATHINK: SPECIALIZED ENDPOINT TESTS
  // =============================================

  describe('GET /customers/high-value - High-Value Customers', () => {
    beforeEach(async () => {
      // Create test customers
      for (const customerData of mockIndonesianCustomersData) {
        const customer = customerRepository.create({
          ...customerData,
          tenantId: mockTestTenant.tenantId,
          customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        await customerRepository.save(customer);
      }
    });

    it('should retrieve only high-value customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/high-value')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2); // Siti and Ahmad
      response.body.data.forEach(customer => {
        expect([CustomerSegment.HIGH_VALUE]).toContain(customer.segment);
        expect(customer.lifetimeValue).toBeGreaterThanOrEqual(10000000); // 10M IDR
      });

      // Should be sorted by LTV descending
      const ltvValues = response.body.data.map(c => c.lifetimeValue);
      expect(ltvValues).toEqual([...ltvValues].sort((a, b) => b - a));
    });

    it('should limit high-value customers results', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/high-value')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({ limit: 1 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].lifetimeValue).toBe(125000000); // Ahmad (highest)
    });

    it('should include analytics for high-value customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/high-value')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      response.body.data.forEach(customer => {
        expect(customer).toHaveProperty('customerNumber');
        expect(customer).toHaveProperty('segment');
        expect(customer).toHaveProperty('loyaltyTier');
        expect(customer).toHaveProperty('totalOrders');
        expect(customer).toHaveProperty('averageOrderValue');
        expect(customer).toHaveProperty('lastOrderDate');
      });
    });
  });

  describe('GET /customers/at-risk - At-Risk Customers', () => {
    beforeEach(async () => {
      // Create at-risk customer
      const atRiskCustomer = customerRepository.create({
        ...mockAtRiskCustomer,
        tenantId: mockTestTenant.tenantId,
        customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      await customerRepository.save(atRiskCustomer);

      // Create another at-risk customer
      const anotherAtRiskCustomer = customerRepository.create({
        ...mockAtRiskCustomer,
        fullName: 'Joko Widodo',
        email: 'joko.widodo@email.com',
        phone: '+6285678901234',
        churnProbability: 75,
        daysSinceLastOrder: 90,
        tenantId: mockTestTenant.tenantId,
        customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      await customerRepository.save(anotherAtRiskCustomer);
    });

    it('should retrieve only at-risk customers', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/at-risk')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach(customer => {
        expect(customer.churnProbability).toBeGreaterThanOrEqual(70);
        expect(customer.segment).toBe(CustomerSegment.AT_RISK);
      });

      // Should be sorted by churn probability descending
      const churnValues = response.body.data.map(c => c.churnProbability);
      expect(churnValues).toEqual([...churnValues].sort((a, b) => b - a));
    });

    it('should prioritize customers with highest churn risk', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/at-risk')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({ limit: 1 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        fullName: 'Rina Kartika',
        churnProbability: 85,
      });
    });
  });

  // =============================================
  // ULTRATHINK: SEARCH AND ANALYTICS TESTS
  // =============================================

  describe('GET /customers/search - Advanced Search', () => {
    beforeEach(async () => {
      // Create test customers
      for (const customerData of mockIndonesianCustomersData) {
        const customer = customerRepository.create({
          ...customerData,
          tenantId: mockTestTenant.tenantId,
          customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        await customerRepository.save(customer);
      }
    });

    it('should search customers by multiple criteria', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/search')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          q: 'jakarta',
          includeAnalytics: true,
        })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach(customer => {
        const hasJakarta = 
          customer.fullName.toLowerCase().includes('jakarta') ||
          customer.email.toLowerCase().includes('jakarta') ||
          customer.addresses?.some(addr => addr.city.toLowerCase().includes('jakarta'));
        expect(hasJakarta).toBe(true);
      });
    });

    it('should search Indonesian companies by tax ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/search')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          q: '01.123.456',
        })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        companyName: 'PT Berkah Mandiri',
        taxId: '01.123.456.7-890.000',
      });
    });

    it('should search by Indonesian phone number format', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/search')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          q: '+6281234567890',
        })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        fullName: 'Budi Santoso',
        phone: '+6281234567890',
      });
    });

    it('should limit search results appropriately', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/search')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({
          q: 'gmail', // Should match multiple customers
        })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(50); // Default limit
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('limit', 50);
    });
  });

  describe('GET /customers/analytics/summary - Analytics Summary', () => {
    beforeEach(async () => {
      // Create test customers with varying analytics data
      for (const customerData of mockIndonesianCustomersData) {
        const customer = customerRepository.create({
          ...customerData,
          tenantId: mockTestTenant.tenantId,
          customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        await customerRepository.save(customer);
      }
    });

    it('should return comprehensive analytics summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          totalCustomers: 3,
          totalRevenue: expect.any(Number),
          averageLifetimeValue: expect.any(Number),
          averageOrderValue: expect.any(Number),
          topSegments: expect.arrayContaining([
            expect.objectContaining({
              segment: expect.any(String),
              count: expect.any(Number),
              percentage: expect.any(Number),
            }),
          ]),
          indonesianInsights: expect.objectContaining({
            topRegions: expect.arrayContaining([
              expect.objectContaining({
                region: expect.any(String),
                customerCount: expect.any(Number),
                revenueContribution: expect.any(Number),
              }),
            ]),
            paymentMethodDistribution: expect.any(Object),
            mobileUsageRate: expect.any(Number),
            whatsappEngagementRate: expect.any(Number),
            culturalSegmentation: expect.objectContaining({
              ramadanShoppers: expect.any(Number),
              lebaranShoppers: expect.any(Number),
              culturalAdaptationScore: expect.any(Number),
            }),
          }),
        }),
        meta: expect.objectContaining({
          generatedAt: expect.any(String),
          tenantId: mockTestTenant.tenantId,
        }),
      });
    });

    it('should include Indonesian market insights', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      const indonesianInsights = response.body.data.indonesianInsights;
      
      expect(indonesianInsights).toHaveProperty('topRegions');
      expect(indonesianInsights).toHaveProperty('paymentMethodDistribution');
      expect(indonesianInsights.paymentMethodDistribution).toHaveProperty('qris');
      expect(indonesianInsights.paymentMethodDistribution).toHaveProperty('gopay');
      expect(indonesianInsights.paymentMethodDistribution).toHaveProperty('bank_transfer');
      
      expect(indonesianInsights).toHaveProperty('culturalSegmentation');
      expect(indonesianInsights.culturalSegmentation).toHaveProperty('ramadanShoppers');
      expect(indonesianInsights.culturalSegmentation).toHaveProperty('lebaranShoppers');
    });
  });

  // =============================================
  // ULTRATHINK: CUSTOMER UPDATE AND DELETE TESTS
  // =============================================

  describe('PUT /customers/:id - Update Customer', () => {
    let testCustomerId: string;

    beforeEach(async () => {
      // Create a test customer
      const customer = customerRepository.create({
        ...mockIndonesianCustomersData[0],
        tenantId: mockTestTenant.tenantId,
        customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      const savedCustomer = await customerRepository.save(customer);
      testCustomerId = savedCustomer.id;
    });

    it('should update customer basic information', async () => {
      const updateData = {
        fullName: 'Budi Santoso Updated',
        email: 'budi.updated@gmail.com',
        preferences: {
          preferredPaymentMethods: ['qris', 'ovo', 'dana'],
          marketingConsent: false,
        },
      };

      const response = await request(app.getHttpServer())
        .put(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testCustomerId,
          fullName: 'Budi Santoso Updated',
          email: 'budi.updated@gmail.com',
          preferences: expect.objectContaining({
            preferredPaymentMethods: ['qris', 'ovo', 'dana'],
            marketingConsent: false,
          }),
        }),
      });
    });

    it('should update Indonesian address information', async () => {
      const updateData = {
        addresses: [{
          id: 'addr-001',
          type: 'shipping',
          isDefault: true,
          name: 'Rumah Baru',
          address: 'Jl. Thamrin No. 456',
          city: 'Jakarta',
          state: 'DKI Jakarta',
          postalCode: '10230',
          country: 'Indonesia',
          phone: '+6281234567890',
        }],
      };

      const response = await request(app.getHttpServer())
        .put(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.addresses[0]).toMatchObject({
        address: 'Jl. Thamrin No. 456',
        postalCode: '10230',
      });
    });

    it('should not update customer from different tenant', async () => {
      const differentTenantToken = mockJwtToken.replace(
        mockTestTenant.tenantId, 
        'tenant-different-001'
      );

      const response = await request(app.getHttpServer())
        .put(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${differentTenantToken}`)
        .send({ fullName: 'Hacker Update' })
        .expect(404); // Should not find customer

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('not found'),
        }),
      });
    });

    it('should validate updated data according to Indonesian standards', async () => {
      const invalidUpdateData = {
        email: 'invalid-email-format',
        phone: '08123456789', // Invalid format for Indonesian phone
        addresses: [{
          postalCode: '123', // Invalid Indonesian postal code
          country: 'Malaysia', // Should be Indonesia
        }],
      };

      const response = await request(app.getHttpServer())
        .put(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('validation'),
        }),
      });
    });
  });

  describe('DELETE /customers/:id - Delete Customer', () => {
    let testCustomerId: string;

    beforeEach(async () => {
      // Create a test customer
      const customer = customerRepository.create({
        ...mockIndonesianCustomersData[0],
        tenantId: mockTestTenant.tenantId,
        customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      const savedCustomer = await customerRepository.save(customer);
      testCustomerId = savedCustomer.id;
    });

    it('should soft delete customer successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(204);

      expect(response.body).toEqual({});

      // Verify customer is soft deleted
      const deletedCustomer = await customerRepository.findOne({
        where: { id: testCustomerId },
        withDeleted: true,
      });
      expect(deletedCustomer.isDeleted).toBe(true);
      expect(deletedCustomer.status).toBe(CustomerStatus.INACTIVE);
    });

    it('should not delete customer from different tenant', async () => {
      const differentTenantToken = mockJwtToken.replace(
        mockTestTenant.tenantId, 
        'tenant-different-001'
      );

      const response = await request(app.getHttpServer())
        .delete(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${differentTenantToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('not found'),
        }),
      });

      // Verify customer is not deleted
      const customer = await customerRepository.findOne({
        where: { id: testCustomerId },
      });
      expect(customer).toBeTruthy();
      expect(customer.isDeleted).toBe(false);
    });

    it('should allow reactivation of soft deleted customer', async () => {
      // First delete the customer
      await request(app.getHttpServer())
        .delete(`/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(204);

      // Then reactivate
      const response = await request(app.getHttpServer())
        .post(`/customers/${testCustomerId}/reactivate`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testCustomerId,
          status: CustomerStatus.ACTIVE,
        }),
      });

      // Verify customer is reactivated
      const reactivatedCustomer = await customerRepository.findOne({
        where: { id: testCustomerId },
      });
      expect(reactivatedCustomer.status).toBe(CustomerStatus.ACTIVE);
      expect(reactivatedCustomer.isDeleted).toBe(false);
    });
  });

  // =============================================
  // ULTRATHINK: BULK OPERATIONS TESTS
  // =============================================

  describe('POST /customers/bulk/import - Bulk Import', () => {
    it('should import multiple Indonesian customers successfully', async () => {
      const bulkCustomerData = mockIndonesianCustomersData.map(customer => ({
        ...customer,
        // Remove conflicting fields for bulk import
        customerNumber: undefined,
        id: undefined,
      }));

      const response = await request(app.getHttpServer())
        .post('/customers/bulk/import')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(bulkCustomerData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          imported: 3,
          failed: 0,
          total: 3,
          results: expect.arrayContaining([
            expect.objectContaining({
              success: true,
              customer: expect.objectContaining({
                fullName: expect.any(String),
                customerNumber: expect.any(String),
              }),
            }),
          ]),
          errors: [],
        }),
      });
    });

    it('should handle partial failures in bulk import', async () => {
      const mixedData = [
        // Valid customer
        {
          ...mockIndonesianCustomersData[0],
          customerNumber: undefined,
          id: undefined,
        },
        // Invalid customer (missing required fields)
        {
          fullName: '', // Empty name
          email: 'invalid', // Invalid email
        },
        // Another valid customer
        {
          ...mockIndonesianCustomersData[1],
          customerNumber: undefined,
          id: undefined,
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/customers/bulk/import')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(mixedData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          imported: 2, // 2 successful
          failed: 1, // 1 failed
          total: 3,
          errors: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              success: false,
              error: expect.any(String),
            }),
          ]),
        }),
      });
    });

    it('should enforce tenant isolation in bulk import', async () => {
      const bulkData = [mockIndonesianCustomersData[0]];

      const response = await request(app.getHttpServer())
        .post('/customers/bulk/import')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(bulkData)
        .expect(201);

      expect(response.body.data.results[0].customer.tenantId).toBe(mockTestTenant.tenantId);
    });
  });

  describe('GET /customers/export/csv - Export to CSV', () => {
    beforeEach(async () => {
      // Create test customers
      for (const customerData of mockIndonesianCustomersData) {
        const customer = customerRepository.create({
          ...customerData,
          tenantId: mockTestTenant.tenantId,
          customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        await customerRepository.save(customer);
      }
    });

    it('should export customer data for CSV download', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/export/csv')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            fullName: expect.any(String),
            email: expect.any(String),
            phone: expect.any(String),
            segment: expect.any(String),
            lifetimeValue: expect.any(Number),
          }),
        ]),
        meta: expect.objectContaining({
          total: 3,
          format: 'csv',
          exportedAt: expect.any(String),
        }),
      });

      expect(response.body.data).toHaveLength(3);
    });

    it('should include analytics data in export when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/export/csv')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({ includeAnalytics: true })
        .expect(200);

      response.body.data.forEach(customer => {
        expect(customer).toHaveProperty('totalOrders');
        expect(customer).toHaveProperty('averageOrderValue');
        expect(customer).toHaveProperty('churnProbability');
        expect(customer).toHaveProperty('lastOrderDate');
      });
    });

    it('should export only tenant-specific data', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/export/csv')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      response.body.data.forEach(customer => {
        expect(customer.tenantId).toBe(mockTestTenant.tenantId);
      });
    });
  });

  // =============================================
  // ULTRATHINK: AUTHENTICATION AND AUTHORIZATION TESTS
  // =============================================

  describe('Authentication and Authorization', () => {
    beforeEach(async () => {
      // Create a test customer
      const customer = customerRepository.create({
        ...mockIndonesianCustomersData[0],
        tenantId: mockTestTenant.tenantId,
        customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      await customerRepository.save(customer);
    });

    it('should reject requests without authentication token', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Unauthorized'),
        }),
      });
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Unauthorized'),
        }),
      });
    });

    it('should reject staff role from accessing admin endpoints', async () => {
      const staffToken = mockJwtToken.replace('"role":"admin"', '"role":"staff"');

      const response = await request(app.getHttpServer())
        .delete('/customers/some-id')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('Forbidden'),
        }),
      });
    });

    it('should allow manager role to access most endpoints', async () => {
      const managerToken = mockJwtToken.replace('"role":"admin"', '"role":"manager"');

      // Manager should be able to view customers
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // =============================================
  // ULTRATHINK: PERFORMANCE AND EDGE CASE TESTS
  // =============================================

  describe('Performance and Edge Cases', () => {
    it('should handle large page sizes appropriately', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .query({ limit: 10000 }) // Very large limit
        .expect(200);

      expect(response.body.meta.limit).toBeLessThanOrEqual(1000); // Should be capped
    });

    it('should handle invalid UUID in customer ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/customers/invalid-uuid')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('invalid'),
        }),
      });
    });

    it('should handle concurrent customer creation requests', async () => {
      const customerData = mockIndonesianCustomersData[0];
      const createPromises = Array.from({ length: 5 }, (_, index) => 
        request(app.getHttpServer())
          .post('/customers')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .send({
            ...customerData,
            email: `concurrent-${index}@test.com`,
            phone: `+628123456789${index}`,
          })
      );

      const responses = await Promise.all(createPromises);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // All should have unique customer numbers
      const customerNumbers = responses.map(r => r.body.data.customerNumber);
      const uniqueNumbers = new Set(customerNumbers);
      expect(uniqueNumbers.size).toBe(5);
    });

    it('should handle database connection issues gracefully', async () => {
      // This test would normally require mocking database failures
      // For now, we'll test the structure of error handling
      const response = await request(app.getHttpServer())
        .get('/customers/non-existent-customer-id')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });
  });

  // =============================================
  // ULTRATHINK: INDONESIAN BUSINESS CONTEXT TESTS
  // =============================================

  describe('Indonesian Business Context Validation', () => {
    it('should validate Indonesian phone number formats', async () => {
      const validPhoneNumbers = [
        '+6281234567890',
        '+6287654321098',
        '+6285123456789',
      ];

      const invalidPhoneNumbers = [
        '081234567890', // Missing country code
        '+1234567890', // Wrong country code
        '+6281234', // Too short
        '+628123456789012345', // Too long
      ];

      // Test valid phone numbers
      for (const phone of validPhoneNumbers) {
        const response = await request(app.getHttpServer())
          .post('/customers')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .send({
            ...mockIndonesianCustomersData[0],
            email: `test-${Date.now()}@example.com`,
            phone,
          })
          .expect(201);

        expect(response.body.data.phone).toBe(phone);
      }

      // Test invalid phone numbers
      for (const phone of invalidPhoneNumbers) {
        const response = await request(app.getHttpServer())
          .post('/customers')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .send({
            ...mockIndonesianCustomersData[0],
            email: `test-invalid-${Date.now()}@example.com`,
            phone,
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    it('should validate Indonesian postal codes', async () => {
      const validPostalCodes = ['12190', '60231', '40123', '50241'];
      const invalidPostalCodes = ['123', '1234567', 'ABCDE'];

      // Test valid postal codes
      for (const postalCode of validPostalCodes) {
        const response = await request(app.getHttpServer())
          .post('/customers')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .send({
            ...mockIndonesianCustomersData[0],
            email: `postal-${Date.now()}@example.com`,
            phone: `+6281234567${Math.random().toString().substr(2, 3)}`,
            addresses: [{
              ...mockIndonesianCustomersData[0].addresses[0],
              postalCode,
            }],
          })
          .expect(201);

        expect(response.body.data.addresses[0].postalCode).toBe(postalCode);
      }
    });

    it('should validate Indonesian business tax IDs (NPWP)', async () => {
      const validTaxIds = [
        '01.123.456.7-890.000',
        '02.987.654.3-210.000',
        '03.555.666.7-888.000',
      ];

      for (const taxId of validTaxIds) {
        const response = await request(app.getHttpServer())
          .post('/customers')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .send({
            ...mockIndonesianCustomersData[2], // Business customer
            email: `business-${Date.now()}@company.com`,
            phone: `+6281234567${Math.random().toString().substr(2, 3)}`,
            companyName: `PT Test Company ${Date.now()}`,
            taxId,
          })
          .expect(201);

        expect(response.body.data.taxId).toBe(taxId);
      }
    });

    it('should support Indonesian cultural events in purchase behavior', async () => {
      const customerWithCulturalEvents = {
        ...mockIndonesianCustomersData[0],
        email: `cultural-${Date.now()}@example.com`,
        phone: `+6281234567${Math.random().toString().substr(2, 3)}`,
        purchaseBehavior: {
          seasonalPurchasePattern: {
            ramadan: true,
            lebaran: true,
            christmas: false,
            newYear: true,
            independenceDay: true, // Indonesian Independence Day
            kartini: true, // Kartini Day
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(customerWithCulturalEvents)
        .expect(201);

      expect(response.body.data.purchaseBehavior.seasonalPurchasePattern).toMatchObject({
        ramadan: true,
        lebaran: true,
        christmas: false,
        newYear: true,
      });
    });

    it('should support Indonesian payment method preferences', async () => {
      const indonesianPaymentMethods = [
        'qris', 'gopay', 'ovo', 'dana', 'linkaja', 'shopeepay',
        'bank_transfer', 'bca', 'mandiri', 'bni', 'bri',
        'credit_card', 'debit_card', 'cod'
      ];

      const customerWithPaymentMethods = {
        ...mockIndonesianCustomersData[0],
        email: `payment-${Date.now()}@example.com`,
        phone: `+6281234567${Math.random().toString().substr(2, 3)}`,
        preferences: {
          ...mockIndonesianCustomersData[0].preferences,
          preferredPaymentMethods: indonesianPaymentMethods.slice(0, 5),
        },
      };

      const response = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(customerWithPaymentMethods)
        .expect(201);

      expect(response.body.data.preferences.preferredPaymentMethods).toEqual(
        expect.arrayContaining(['qris', 'gopay', 'ovo', 'dana', 'linkaja'])
      );
    });

    it('should generate analytics with Indonesian market insights', async () => {
      // Create customers from different Indonesian regions
      const regionalCustomers = [
        { ...mockIndonesianCustomersData[0], addresses: [{ ...mockIndonesianCustomersData[0].addresses[0], city: 'Jakarta', state: 'DKI Jakarta' }] },
        { ...mockIndonesianCustomersData[1], addresses: [{ ...mockIndonesianCustomersData[1].addresses[0], city: 'Surabaya', state: 'Jawa Timur' }] },
        { ...mockIndonesianCustomersData[2], addresses: [{ ...mockIndonesianCustomersData[2].addresses[0], city: 'Bandung', state: 'Jawa Barat' }] },
      ];

      for (let i = 0; i < regionalCustomers.length; i++) {
        const customer = customerRepository.create({
          ...regionalCustomers[i],
          email: `region-${i}-${Date.now()}@example.com`,
          phone: `+6281234567${i}${Math.random().toString().substr(2, 2)}`,
          tenantId: mockTestTenant.tenantId,
          customerNumber: `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
        await customerRepository.save(customer);
      }

      const response = await request(app.getHttpServer())
        .get('/customers/analytics/summary')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      const indonesianInsights = response.body.data.indonesianInsights;
      
      expect(indonesianInsights).toHaveProperty('topRegions');
      expect(indonesianInsights.topRegions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            region: expect.stringMatching(/Jakarta|Surabaya|Bandung/),
            customerCount: expect.any(Number),
            revenueContribution: expect.any(Number),
          }),
        ])
      );

      expect(indonesianInsights.paymentMethodDistribution).toHaveProperty('qris');
      expect(indonesianInsights.paymentMethodDistribution).toHaveProperty('gopay');
      expect(indonesianInsights.paymentMethodDistribution).toHaveProperty('bank_transfer');

      expect(indonesianInsights).toHaveProperty('mobileUsageRate');
      expect(indonesianInsights.mobileUsageRate).toBeGreaterThan(80); // High mobile usage in Indonesia

      expect(indonesianInsights).toHaveProperty('whatsappEngagementRate');
      expect(indonesianInsights.whatsappEngagementRate).toBeGreaterThan(70); // High WhatsApp usage
    });
  });
});