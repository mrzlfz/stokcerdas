import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables for testing
config({ path: join(__dirname, '../.env.test') });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/stokcerdas_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Set test timeouts
jest.setTimeout(60000);

// Mock external services for testing
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  messaging: jest.fn(() => ({
    send: jest.fn(),
    sendMulticast: jest.fn(),
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

// Mock Python shell for ML operations
jest.mock('python-shell', () => ({
  PythonShell: {
    run: jest.fn(),
    runString: jest.fn(),
  },
}));

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs-node', () => ({
  setBackend: jest.fn(),
  ready: jest.fn(),
  tensor: jest.fn(),
  sequential: jest.fn(),
  layers: {
    dense: jest.fn(),
    dropout: jest.fn(),
  },
}));

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn(),
  })),
  SES: jest.fn(() => ({
    sendEmail: jest.fn(),
  })),
}));

// Mock Bull queues
jest.mock('bull', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

// Global test utilities
global.testUtils = {
  createMockTenant: () => 'test-tenant-id',
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    tenantId: 'test-tenant-id',
  }),
  createMockProduct: () => ({
    id: 'test-product-id',
    name: 'Test Product',
    sku: 'TEST-SKU-001',
    barcode: '1234567890123',
    tenantId: 'test-tenant-id',
  }),
  createMockInventoryItem: () => ({
    id: 'test-inventory-id',
    productId: 'test-product-id',
    locationId: 'test-location-id',
    quantity: 100,
    tenantId: 'test-tenant-id',
  }),
  createMockOrder: () => ({
    id: 'test-order-id',
    orderNumber: 'ORD-001',
    status: 'pending',
    tenantId: 'test-tenant-id',
  }),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});