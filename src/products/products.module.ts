import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { ProductsController } from './controllers/products.controller';
import { ProductCategoriesController } from './controllers/product-categories.controller';
import { ProductVariantsController } from './controllers/product-variants.controller';

import { ProductsService } from './services/products.service';
import { ProductCategoriesService } from './services/product-categories.service';
import { ProductVariantsService } from './services/product-variants.service';
import { BarcodeService } from './services/barcode.service';

import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { ProductVariant } from './entities/product-variant.entity';

// Import Auth module for permission checking
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, ProductVariant]),
    AuthModule,
    BullModule.registerQueue({
      name: 'products',
    }),
  ],
  controllers: [
    ProductsController,
    ProductCategoriesController,
    ProductVariantsController,
  ],
  providers: [
    ProductsService,
    ProductCategoriesService,
    ProductVariantsService,
    BarcodeService,
  ],
  exports: [
    ProductsService,
    ProductCategoriesService,
    ProductVariantsService,
    TypeOrmModule,
  ],
})
export class ProductsModule {}
