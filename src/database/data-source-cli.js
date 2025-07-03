// Load environment variables
require('dotenv').config({ path: '.env.development' });

// Register ts-node with transpile-only mode to skip type checking
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    skipLibCheck: true
  }
});

const { DataSource } = require('typeorm');
const path = require('path');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'stokcerdas',
  password: process.env.DB_PASSWORD || 'stokcerdas_password',
  database: process.env.DB_NAME || 'stokcerdas_dev',
  entities: [],  // Skip entities for migration only
  migrations: [path.join(__dirname, '/migrations/*.ts')],
  synchronize: false, // Always false for migrations
  logging: (process.env.DB_LOGGING || 'false') === 'true',
  ssl: (process.env.DB_SSL || 'false') === 'true',
  extra: {
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 100,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  timezone: process.env.DB_TIMEZONE || 'Asia/Jakarta',
});

module.exports = { AppDataSource };