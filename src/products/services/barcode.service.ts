import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';

@Injectable()
export class BarcodeService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
  ) {}

  /**
   * Generate barcode untuk product
   */
  async generateProductBarcode(
    tenantId: string,
    productId: string,
  ): Promise<string> {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new Error('Product tidak ditemukan');
    }

    // Jika sudah ada barcode, return yang existing
    if (product.barcode) {
      return product.barcode;
    }

    // Generate barcode baru
    const barcode = await this.generateUniqueBarcode(tenantId, 'product');

    // Update product dengan barcode baru
    await this.productRepository.update(productId, { barcode });

    return barcode;
  }

  /**
   * Generate barcode untuk product variant
   */
  async generateVariantBarcode(
    tenantId: string,
    variantId: string,
  ): Promise<string> {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId, tenantId },
    });

    if (!variant) {
      throw new Error('Product variant tidak ditemukan');
    }

    // Jika sudah ada barcode, return yang existing
    if (variant.barcode) {
      return variant.barcode;
    }

    // Generate barcode baru
    const barcode = await this.generateUniqueBarcode(tenantId, 'variant');

    // Update variant dengan barcode baru
    await this.variantRepository.update(variantId, { barcode });

    return barcode;
  }

  /**
   * Validate format barcode
   */
  validateBarcodeFormat(barcode: string): {
    isValid: boolean;
    format?: string;
    error?: string;
  } {
    // Remove spaces and convert to string
    const cleanBarcode = barcode.toString().replace(/\s/g, '');

    // EAN-13 (13 digits)
    if (/^\d{13}$/.test(cleanBarcode)) {
      const isValidEAN13 = this.validateEAN13Checksum(cleanBarcode);
      return {
        isValid: isValidEAN13,
        format: 'EAN-13',
        error: isValidEAN13 ? undefined : 'Checksum EAN-13 tidak valid',
      };
    }

    // EAN-8 (8 digits)
    if (/^\d{8}$/.test(cleanBarcode)) {
      const isValidEAN8 = this.validateEAN8Checksum(cleanBarcode);
      return {
        isValid: isValidEAN8,
        format: 'EAN-8',
        error: isValidEAN8 ? undefined : 'Checksum EAN-8 tidak valid',
      };
    }

    // UPC-A (12 digits)
    if (/^\d{12}$/.test(cleanBarcode)) {
      const isValidUPC = this.validateUPCAChecksum(cleanBarcode);
      return {
        isValid: isValidUPC,
        format: 'UPC-A',
        error: isValidUPC ? undefined : 'Checksum UPC-A tidak valid',
      };
    }

    // Code 128 (alphanumeric)
    if (
      /^[A-Z0-9\-\.\$\/\+%\s]+$/i.test(cleanBarcode) &&
      cleanBarcode.length >= 1 &&
      cleanBarcode.length <= 48
    ) {
      return {
        isValid: true,
        format: 'Code 128',
      };
    }

    // Custom format (untuk internal use)
    if (/^SC\d{10}$/.test(cleanBarcode)) {
      return {
        isValid: true,
        format: 'StokCerdas Internal',
      };
    }

    return {
      isValid: false,
      error:
        'Format barcode tidak dikenali. Mendukung: EAN-13, EAN-8, UPC-A, Code 128, atau format internal',
    };
  }

  /**
   * Search product by barcode
   */
  async findProductByBarcode(
    tenantId: string,
    barcode: string,
  ): Promise<{
    product?: Product;
    variant?: ProductVariant;
    type: 'product' | 'variant' | null;
  }> {
    // Cari di products table
    const product = await this.productRepository.findOne({
      where: { barcode, tenantId, isDeleted: false },
      relations: ['category'],
    });

    if (product) {
      return { product, type: 'product' };
    }

    // Cari di product variants table
    const variant = await this.variantRepository.findOne({
      where: { barcode, tenantId, isActive: true },
      relations: ['product', 'product.category'],
    });

    if (variant) {
      return { variant, type: 'variant' };
    }

    return { type: null };
  }

  /**
   * Generate bulk barcodes untuk products tanpa barcode
   */
  async generateBulkBarcodes(
    tenantId: string,
    limit: number = 100,
  ): Promise<{
    productsUpdated: number;
    variantsUpdated: number;
    errors: string[];
  }> {
    const result = {
      productsUpdated: 0,
      variantsUpdated: 0,
      errors: [],
    };

    // Generate untuk products
    const productsWithoutBarcode = await this.productRepository.find({
      where: { tenantId, barcode: null, isDeleted: false },
      take: limit,
    });

    for (const product of productsWithoutBarcode) {
      try {
        await this.generateProductBarcode(tenantId, product.id);
        result.productsUpdated++;
      } catch (error) {
        result.errors.push(`Product ${product.sku}: ${error.message}`);
      }
    }

    // Generate untuk variants
    const variantsWithoutBarcode = await this.variantRepository.find({
      where: { tenantId, barcode: null, isActive: true },
      take: limit - result.productsUpdated,
    });

    for (const variant of variantsWithoutBarcode) {
      try {
        await this.generateVariantBarcode(tenantId, variant.id);
        result.variantsUpdated++;
      } catch (error) {
        result.errors.push(`Variant ${variant.sku}: ${error.message}`);
      }
    }

    return result;
  }

  // Private helper methods
  private async generateUniqueBarcode(
    tenantId: string,
    type: 'product' | 'variant',
    maxAttempts: number = 10,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const barcode = this.generateInternalBarcode();

      // Check uniqueness across both products and variants
      const existingProduct = await this.productRepository.findOne({
        where: { barcode, tenantId },
      });

      const existingVariant = await this.variantRepository.findOne({
        where: { barcode, tenantId },
      });

      if (!existingProduct && !existingVariant) {
        return barcode;
      }
    }

    throw new Error(
      `Gagal generate barcode unik setelah ${maxAttempts} percobaan`,
    );
  }

  private generateInternalBarcode(): string {
    // Format: SC + 10 digit random number
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = crypto.randomInt(1000, 9999).toString(); // 4 digit random
    return `SC${timestamp}${random}`;
  }

  private validateEAN13Checksum(barcode: string): boolean {
    if (barcode.length !== 13) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(barcode[12]);
  }

  private validateEAN8Checksum(barcode: string): boolean {
    if (barcode.length !== 8) return false;

    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(barcode[7]);
  }

  private validateUPCAChecksum(barcode: string): boolean {
    if (barcode.length !== 12) return false;

    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(barcode[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(barcode[11]);
  }
}
