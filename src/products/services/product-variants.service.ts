import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { ProductVariant, Product, ProductType } from '../entities/product.entity';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(tenantId: string, createVariantDto: CreateProductVariantDto, userId?: string): Promise<ProductVariant> {
    // Validasi produk parent ada dan aktif
    const product = await this.validateParentProduct(tenantId, createVariantDto.productId);

    // Validasi SKU unik per tenant
    await this.validateSkuUnique(tenantId, createVariantDto.sku);

    // Validasi barcode jika ada
    if (createVariantDto.barcode) {
      await this.validateBarcodeUnique(tenantId, createVariantDto.barcode);
    }

    // Validasi atribut variant tidak duplikasi untuk produk yang sama
    await this.validateVariantAttributes(tenantId, createVariantDto.productId, createVariantDto.attributes);

    const variant = this.variantRepository.create({
      ...createVariantDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedVariant = await this.variantRepository.save(variant);

    // Update product type menjadi VARIANT jika belum
    if (product.type !== ProductType.VARIANT) {
      await this.productRepository.update(product.id, { type: ProductType.VARIANT });
    }

    return savedVariant;
  }

  async findAll(tenantId: string, productId?: string): Promise<ProductVariant[]> {
    const whereCondition: any = { tenantId, isActive: true };
    
    if (productId) {
      whereCondition.productId = productId;
    }

    return this.variantRepository.find({
      where: whereCondition,
      relations: ['product'],
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { id, tenantId },
      relations: ['product'],
    });

    if (!variant) {
      throw new NotFoundException('Variant produk tidak ditemukan');
    }

    return variant;
  }

  async findBySku(tenantId: string, sku: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { sku, tenantId, isActive: true },
      relations: ['product'],
    });

    if (!variant) {
      throw new NotFoundException(`Variant dengan SKU "${sku}" tidak ditemukan`);
    }

    return variant;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { barcode, tenantId, isActive: true },
      relations: ['product'],
    });

    if (!variant) {
      throw new NotFoundException(`Variant dengan barcode "${barcode}" tidak ditemukan`);
    }

    return variant;
  }

  async update(tenantId: string, id: string, updateVariantDto: UpdateProductVariantDto, userId?: string): Promise<ProductVariant> {
    const variant = await this.findOne(tenantId, id);

    // Validasi SKU jika berubah
    if (updateVariantDto.sku && updateVariantDto.sku !== variant.sku) {
      await this.validateSkuUnique(tenantId, updateVariantDto.sku, id);
    }

    // Validasi barcode jika berubah
    if (updateVariantDto.barcode && updateVariantDto.barcode !== variant.barcode) {
      await this.validateBarcodeUnique(tenantId, updateVariantDto.barcode, id);
    }

    // Validasi atribut jika berubah
    if (updateVariantDto.attributes) {
      await this.validateVariantAttributes(tenantId, variant.productId, updateVariantDto.attributes, id);
    }

    // Update timestamps
    updateVariantDto.updatedBy = userId;

    await this.variantRepository.update(id, updateVariantDto);
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const variant = await this.findOne(tenantId, id);

    // Soft delete
    await this.variantRepository.update(id, {
      isActive: false,
      updatedAt: new Date(),
    });

    // Check if this was the last variant for the product
    const remainingVariants = await this.variantRepository.count({
      where: { productId: variant.productId, isActive: true },
    });

    // If no more variants, change product type back to SIMPLE
    if (remainingVariants === 0) {
      await this.productRepository.update(variant.productId, { type: ProductType.SIMPLE });
    }
  }

  async getVariantsByProduct(tenantId: string, productId: string): Promise<ProductVariant[]> {
    await this.validateParentProduct(tenantId, productId);

    return this.variantRepository.find({
      where: { productId, tenantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getVariantMatrix(tenantId: string, productId: string): Promise<{
    attributes: string[];
    attributeValues: Record<string, string[]>;
    variants: Array<ProductVariant & { attributeString: string }>;
  }> {
    const variants = await this.getVariantsByProduct(tenantId, productId);

    if (variants.length === 0) {
      return {
        attributes: [],
        attributeValues: {},
        variants: [],
      };
    }

    // Ekstrak semua atribut unik
    const attributeSet = new Set<string>();
    const attributeValues: Record<string, Set<string>> = {};

    variants.forEach(variant => {
      Object.keys(variant.attributes).forEach(attr => {
        attributeSet.add(attr);
        
        if (!attributeValues[attr]) {
          attributeValues[attr] = new Set();
        }
        
        attributeValues[attr].add(variant.attributes[attr]);
      });
    });

    const attributes = Array.from(attributeSet).sort();
    const attributeValuesMap: Record<string, string[]> = {};

    attributes.forEach(attr => {
      attributeValuesMap[attr] = Array.from(attributeValues[attr]).sort();
    });

    // Buat string atribut untuk setiap variant
    const variantsWithString = variants.map(variant => ({
      ...variant,
      attributeString: attributes
        .map(attr => `${attr}: ${variant.attributes[attr] || 'N/A'}`)
        .join(', '),
    }));

    return {
      attributes,
      attributeValues: attributeValuesMap,
      variants: variantsWithString,
    };
  }

  async bulkUpdatePrices(
    tenantId: string, 
    productId: string, 
    priceUpdate: { costPrice?: number; sellingPrice?: number; adjustment?: number; adjustmentType?: 'amount' | 'percentage' },
    userId?: string
  ): Promise<{ updated: number; errors: string[] }> {
    const variants = await this.getVariantsByProduct(tenantId, productId);
    
    if (variants.length === 0) {
      throw new NotFoundException('Tidak ada variant untuk produk ini');
    }

    const errors: string[] = [];
    let updated = 0;

    for (const variant of variants) {
      try {
        const updateData: Partial<ProductVariant> = { updatedBy: userId };

        if (priceUpdate.costPrice !== undefined) {
          updateData.costPrice = priceUpdate.costPrice;
        }

        if (priceUpdate.sellingPrice !== undefined) {
          updateData.sellingPrice = priceUpdate.sellingPrice;
        }

        if (priceUpdate.adjustment !== undefined && priceUpdate.adjustmentType) {
          if (priceUpdate.adjustmentType === 'percentage') {
            updateData.sellingPrice = variant.sellingPrice * (1 + priceUpdate.adjustment / 100);
            if (priceUpdate.costPrice === undefined) {
              updateData.costPrice = variant.costPrice * (1 + priceUpdate.adjustment / 100);
            }
          } else {
            updateData.sellingPrice = variant.sellingPrice + priceUpdate.adjustment;
            if (priceUpdate.costPrice === undefined) {
              updateData.costPrice = variant.costPrice + priceUpdate.adjustment;
            }
          }
        }

        // Validasi harga tidak negatif
        if (updateData.costPrice !== undefined && updateData.costPrice < 0) {
          errors.push(`Variant ${variant.sku}: Harga modal tidak boleh negatif`);
          continue;
        }

        if (updateData.sellingPrice !== undefined && updateData.sellingPrice < 0) {
          errors.push(`Variant ${variant.sku}: Harga jual tidak boleh negatif`);
          continue;
        }

        await this.variantRepository.update(variant.id, updateData);
        updated++;
      } catch (error) {
        errors.push(`Variant ${variant.sku}: ${error.message}`);
      }
    }

    return { updated, errors };
  }

  // Private helper methods
  private async validateParentProduct(tenantId: string, productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId, isDeleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produk parent tidak ditemukan');
    }

    if (product.status !== 'active') {
      throw new BadRequestException('Produk parent tidak aktif');
    }

    return product;
  }

  private async validateSkuUnique(tenantId: string, sku: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, sku };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingVariant = await this.variantRepository.findOne({
      where: whereCondition,
    });

    if (existingVariant) {
      throw new ConflictException(`SKU variant "${sku}" sudah digunakan`);
    }

    // Also check in products table
    const existingProduct = await this.productRepository.findOne({
      where: { tenantId, sku, isDeleted: false },
    });

    if (existingProduct) {
      throw new ConflictException(`SKU "${sku}" sudah digunakan untuk produk`);
    }
  }

  private async validateBarcodeUnique(tenantId: string, barcode: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, barcode };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingVariant = await this.variantRepository.findOne({
      where: whereCondition,
    });

    if (existingVariant) {
      throw new ConflictException(`Barcode variant "${barcode}" sudah digunakan`);
    }

    // Also check in products table
    const existingProduct = await this.productRepository.findOne({
      where: { tenantId, barcode, isDeleted: false },
    });

    if (existingProduct) {
      throw new ConflictException(`Barcode "${barcode}" sudah digunakan untuk produk`);
    }
  }

  private async validateVariantAttributes(tenantId: string, productId: string, attributes: Record<string, any>, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, productId, isActive: true };
    
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingVariants = await this.variantRepository.find({
      where: whereCondition,
      select: ['id', 'attributes'],
    });

    // Convert attributes to string for comparison
    const attributeString = JSON.stringify(this.sortObjectKeys(attributes));

    for (const variant of existingVariants) {
      const existingAttributeString = JSON.stringify(this.sortObjectKeys(variant.attributes));
      
      if (attributeString === existingAttributeString) {
        throw new ConflictException('Kombinasi atribut variant sudah ada untuk produk ini');
      }
    }
  }

  private sortObjectKeys(obj: Record<string, any>): Record<string, any> {
    const sorted: Record<string, any> = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }
}