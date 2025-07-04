import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'stokcerdas',
  password: process.env.DB_PASSWORD || 'stokcerdas_password',
  name: process.env.DB_NAME || 'stokcerdas_dev',
  synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
  logging: process.env.DB_LOGGING === 'true' || false,
  ssl: process.env.DB_SSL === 'true' || false,
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 100,
  timezone: process.env.DB_TIMEZONE || 'Asia/Jakarta',
}));

export const databaseConfig = registerAs('database', () => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'stokcerdas',
  password: process.env.DB_PASSWORD || 'stokcerdas_password',
  name: process.env.DB_NAME || 'stokcerdas_dev',
  synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
  logging: process.env.DB_LOGGING === 'true' || false,
  ssl: process.env.DB_SSL === 'true' || false,
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 100,
  timezone: process.env.DB_TIMEZONE || 'Asia/Jakarta',
}));
