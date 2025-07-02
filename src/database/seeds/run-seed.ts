import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { InitialDataSeed } from './initial-data.seed';
import { PermissionsSeed } from './permissions.seed';

async function runSeeds() {
  try {
    console.log('🚀 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    console.log('🌱 Starting database seeding...');
    
    // Run permissions seed first
    await PermissionsSeed.run(AppDataSource);
    
    // Then run initial data seed
    await InitialDataSeed.run(AppDataSource);
    
    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('📴 Database connection closed');
    }
  }
}

runSeeds();