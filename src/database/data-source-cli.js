const { DataSource } = require('typeorm');
const path = require('path');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'stokcerdas',
  password: process.env.DB_PASSWORD || 'stokcerdas_password',
  database: process.env.DB_NAME || 'stokcerdas_dev',
  entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: (process.env.DB_SYNCHRONIZE || 'false') === 'true',
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