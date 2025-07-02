import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables
config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'stokcerdas'),
  password: configService.get('DB_PASSWORD', 'stokcerdas_password'),
  database: configService.get('DB_NAME', 'stokcerdas_dev'),
  entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: configService.get('DB_SYNCHRONIZE', 'false') === 'true',
  logging: configService.get('DB_LOGGING', 'false') === 'true',
  ssl: configService.get('DB_SSL', 'false') === 'true',
  extra: {
    max: configService.get('DB_MAX_CONNECTIONS', 100),
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  timezone: configService.get('DB_TIMEZONE', 'Asia/Jakarta'),
});