import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Import required entities for reporting
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { Product } from '../products/entities/product.entity';

// Import services
import { ReportGenerationService } from './services/report-generation.service';
import { ReportExportService } from './services/report-export.service';

// Import controllers
import { ReportsController } from './controllers/reports.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryTransaction,
      InventoryLocation,
      Product,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportGenerationService, ReportExportService],
  exports: [ReportGenerationService, ReportExportService],
})
export class ReportsModule {}
