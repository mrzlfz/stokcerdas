const { DataSource } = require('typeorm');
const path = require('path');
require('dotenv').config({ path: '.env.development' });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'stokcerdas',
  password: process.env.DB_PASSWORD || 'stokcerdas_password',
  database: process.env.DB_NAME || 'stokcerdas_dev',
  entities: [],
  migrations: [
    // Only load the JS enterprise migration for now
    path.join(__dirname, 'src/database/migrations/1735600000000-CreateEnterprisePermissions.js')
  ],
  synchronize: false,
  logging: true,
});

async function runMigrations() {
  try {
    console.log('Initializing data source...');
    await AppDataSource.initialize();
    
    console.log('Running enterprise permissions migration...');
    const migrations = await AppDataSource.runMigrations();
    
    console.log('Migrations completed successfully!');
    console.log('Executed migrations:', migrations.map(m => m.name));
    
    await AppDataSource.destroy();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error running migrations:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

runMigrations();