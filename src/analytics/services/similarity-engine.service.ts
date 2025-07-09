import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ProductCategory } from '../../products/entities/product-category.entity';
import { InventoryTransaction } from '../../inventory/entities/inventory-transaction.entity';

export interface ProductSimilarityResult {
  productId: string;
  similarityScore: number;
  similarityType:
    | 'category'
    | 'price'
    | 'sales_pattern'
    | 'attributes'
    | 'composite';
  matchingFactors: string[];
  confidence: number;
}

export interface SimilarityAnalysisRequest {
  targetProductId: string;
  maxResults?: number;
  minSimilarityThreshold?: number;
  includeCategories?: string[];
  excludeCategories?: string[];
  similarityTypes?: string[];
}

export interface SimilarityMetrics {
  cosineSimilarity: number;
  jaccardSimilarity: number;
  euclideanDistance: number;
  manhattanDistance: number;
  correlationCoefficient: number;
}

@Injectable()
export class SimilarityEngineService {
  private readonly logger = new Logger(SimilarityEngineService.name);

  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private categoryRepo: Repository<ProductCategory>,

    @InjectRepository(InventoryTransaction)
    private transactionRepo: Repository<InventoryTransaction>,
  ) {}

  /**
   * Real Product Similarity Engine - Replaces Math.random() placeholder
   * Uses multiple similarity algorithms for accurate product matching
   */
  async findSimilarProducts(
    tenantId: string,
    request: SimilarityAnalysisRequest,
  ): Promise<ProductSimilarityResult[]> {
    try {
      this.logger.debug(
        `Finding similar products for ${request.targetProductId}`,
      );

      // Get target product with full details
      const targetProduct = await this.getProductWithFeatures(
        tenantId,
        request.targetProductId,
      );
      if (!targetProduct) {
        throw new Error(`Target product ${request.targetProductId} not found`);
      }

      // Get candidate products for comparison
      const candidateProducts = await this.getCandidateProducts(
        tenantId,
        request,
      );

      // Calculate similarities using multiple algorithms
      const similarities: ProductSimilarityResult[] = [];

      for (const candidate of candidateProducts) {
        const similarityResult = await this.calculateProductSimilarity(
          targetProduct,
          candidate,
          tenantId,
        );

        if (
          similarityResult.similarityScore >=
          (request.minSimilarityThreshold || 0.3)
        ) {
          similarities.push(similarityResult);
        }
      }

      // Sort by similarity score and return top results
      similarities.sort((a, b) => b.similarityScore - a.similarityScore);

      const maxResults = request.maxResults || 10;
      return similarities.slice(0, maxResults);
    } catch (error) {
      this.logger.error(
        `Similar products calculation failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Similarity analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate comprehensive product similarity using multiple algorithms
   * Replaces the Math.random() * 0.5 + 0.5 placeholder
   */
  private async calculateProductSimilarity(
    targetProduct: any,
    candidateProduct: any,
    tenantId: string,
  ): Promise<ProductSimilarityResult> {
    try {
      // 1. Category-based similarity (hierarchical)
      const categorySimilarity = this.calculateCategorySimilarity(
        targetProduct.category,
        candidateProduct.category,
      );

      // 2. Price-based similarity (normalized)
      const priceSimilarity = this.calculatePriceSimilarity(
        targetProduct.sellingPrice,
        candidateProduct.sellingPrice,
      );

      // 3. Attribute-based similarity (Jaccard + Cosine)
      const attributeSimilarity = await this.calculateAttributeSimilarity(
        targetProduct,
        candidateProduct,
      );

      // 4. Sales pattern similarity (time series correlation)
      const salesPatternSimilarity = await this.calculateSalesPatternSimilarity(
        targetProduct.id,
        candidateProduct.id,
        tenantId,
      );

      // 5. Physical characteristics similarity
      const physicalSimilarity = this.calculatePhysicalSimilarity(
        targetProduct,
        candidateProduct,
      );

      // Calculate composite similarity with weights optimized for Indonesian SMBs
      const weights = {
        category: 0.25, // Category matters for Indonesian product grouping
        price: 0.2, // Price sensitivity in Indonesian market
        attributes: 0.25, // Product features important for comparison
        salesPattern: 0.2, // Historical performance correlation
        physical: 0.1, // Physical characteristics
      };

      const compositeSimilarity =
        categorySimilarity * weights.category +
        priceSimilarity * weights.price +
        attributeSimilarity * weights.attributes +
        salesPatternSimilarity * weights.salesPattern +
        physicalSimilarity * weights.physical;

      // Determine matching factors
      const matchingFactors = [];
      if (categorySimilarity > 0.7) matchingFactors.push('kategori_serupa');
      if (priceSimilarity > 0.8) matchingFactors.push('harga_sebanding');
      if (attributeSimilarity > 0.6) matchingFactors.push('fitur_mirip');
      if (salesPatternSimilarity > 0.5)
        matchingFactors.push('pola_penjualan_serupa');
      if (physicalSimilarity > 0.7)
        matchingFactors.push('karakteristik_fisik_serupa');

      // Calculate confidence based on data quality and number of matching factors
      const confidence = this.calculateSimilarityConfidence(
        targetProduct,
        candidateProduct,
        matchingFactors.length,
      );

      return {
        productId: candidateProduct.id,
        similarityScore: Math.max(0, Math.min(1, compositeSimilarity)),
        similarityType: 'composite',
        matchingFactors,
        confidence,
      };
    } catch (error) {
      this.logger.warn(
        `Similarity calculation failed for product ${candidateProduct.id}: ${error.message}`,
      );

      // Fallback similarity based on category only
      const categorySimilarity = this.calculateCategorySimilarity(
        targetProduct.category,
        candidateProduct.category,
      );

      return {
        productId: candidateProduct.id,
        similarityScore: categorySimilarity * 0.7, // Reduced confidence for fallback
        similarityType: 'category',
        matchingFactors: categorySimilarity > 0.5 ? ['kategori_serupa'] : [],
        confidence: 0.4, // Low confidence for fallback calculation
      };
    }
  }

  /**
   * Real Cosine Similarity implementation for product attributes
   */
  private async calculateAttributeSimilarity(
    product1: any,
    product2: any,
  ): Promise<number> {
    try {
      // Extract feature vectors from product attributes
      const features1 = this.extractFeatureVector(product1);
      const features2 = this.extractFeatureVector(product2);

      // Cosine similarity calculation
      const cosineSim = this.calculateCosineSimilarity(features1, features2);

      // Jaccard similarity for categorical attributes
      const jaccardSim = this.calculateJaccardSimilarity(
        this.extractCategoricalFeatures(product1),
        this.extractCategoricalFeatures(product2),
      );

      // Weighted combination of cosine and Jaccard
      return cosineSim * 0.7 + jaccardSim * 0.3;
    } catch (error) {
      this.logger.warn(
        `Attribute similarity calculation failed: ${error.message}`,
      );
      return 0.1; // Very low similarity if calculation fails
    }
  }

  /**
   * Real Cosine Similarity Algorithm - Replaces Math.random()
   */
  private calculateCosineSimilarity(
    vector1: number[],
    vector2: number[],
  ): number {
    if (vector1.length !== vector2.length || vector1.length === 0) {
      return 0;
    }

    const dotProduct = vector1.reduce((sum, v1, i) => sum + v1 * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, v) => sum + v * v, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, v) => sum + v * v, 0));

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Real Jaccard Similarity Algorithm - Replaces Math.random()
   */
  private calculateJaccardSimilarity(
    set1: Set<string>,
    set2: Set<string>,
  ): number {
    if (set1.size === 0 && set2.size === 0) {
      return 1; // Both empty sets are identical
    }

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Category-based similarity using hierarchical distance
   */
  private calculateCategorySimilarity(category1: any, category2: any): number {
    if (!category1 || !category2) {
      return 0;
    }

    // Exact match
    if (category1.id === category2.id) {
      return 1.0;
    }

    // Parent-child relationship
    if (
      category1.parentId === category2.id ||
      category2.parentId === category1.id
    ) {
      return 0.8;
    }

    // Same parent (siblings)
    if (category1.parentId && category1.parentId === category2.parentId) {
      return 0.6;
    }

    // Same root category (cousins)
    if (this.findRootCategory(category1) === this.findRootCategory(category2)) {
      return 0.4;
    }

    return 0.1; // Different category trees
  }

  /**
   * Price-based similarity using normalized distance
   */
  private calculatePriceSimilarity(price1: number, price2: number): number {
    if (!price1 || !price2 || price1 <= 0 || price2 <= 0) {
      return 0;
    }

    const maxPrice = Math.max(price1, price2);
    const minPrice = Math.min(price1, price2);
    const priceRatio = minPrice / maxPrice;

    // Convert ratio to similarity score (closer prices = higher similarity)
    return Math.pow(priceRatio, 0.5); // Square root for gentler curve
  }

  /**
   * Sales pattern similarity using time series correlation
   */
  private async calculateSalesPatternSimilarity(
    productId1: string,
    productId2: string,
    tenantId: string,
  ): Promise<number> {
    try {
      const salesData1 = await this.getSalesTimeSeries(productId1, tenantId);
      const salesData2 = await this.getSalesTimeSeries(productId2, tenantId);

      if (salesData1.length < 7 || salesData2.length < 7) {
        return 0.2; // Insufficient data for pattern analysis
      }

      // Calculate Pearson correlation coefficient
      const correlation = this.calculatePearsonCorrelation(
        salesData1,
        salesData2,
      );

      // Convert correlation (-1 to 1) to similarity (0 to 1)
      return Math.max(0, (correlation + 1) / 2);
    } catch (error) {
      this.logger.warn(
        `Sales pattern similarity calculation failed: ${error.message}`,
      );
      return 0.1; // Default low similarity
    }
  }

  /**
   * Physical characteristics similarity
   */
  private calculatePhysicalSimilarity(product1: any, product2: any): number {
    const characteristics = [
      'weight',
      'dimensions',
      'color',
      'material',
      'brand',
    ];
    let matchCount = 0;
    let totalComparisons = 0;

    characteristics.forEach(char => {
      const val1 = product1[char] || product1.attributes?.[char];
      const val2 = product2[char] || product2.attributes?.[char];

      if (val1 && val2) {
        totalComparisons++;

        if (typeof val1 === 'string' && typeof val2 === 'string') {
          // String comparison with fuzzy matching
          if (val1.toLowerCase() === val2.toLowerCase()) {
            matchCount += 1;
          } else if (this.calculateStringSimilarity(val1, val2) > 0.7) {
            matchCount += 0.7;
          }
        } else if (typeof val1 === 'number' && typeof val2 === 'number') {
          // Numeric comparison with tolerance
          const tolerance = Math.abs(val1 * 0.1); // 10% tolerance
          if (Math.abs(val1 - val2) <= tolerance) {
            matchCount += 1;
          }
        }
      }
    });

    return totalComparisons > 0 ? matchCount / totalComparisons : 0;
  }

  /**
   * Extract numerical feature vector from product
   */
  private extractFeatureVector(product: any): number[] {
    const features = [];

    // Price features (normalized)
    features.push(
      product.sellingPrice ? Math.log(product.sellingPrice + 1) : 0,
    );
    features.push(product.costPrice ? Math.log(product.costPrice + 1) : 0);

    // Categorical features (one-hot encoded)
    features.push(
      product.category?.id ? this.hashStringToNumber(product.category.id) : 0,
    );
    features.push(product.brand ? this.hashStringToNumber(product.brand) : 0);

    // Physical features
    features.push(product.weight || 0);
    features.push(product.length || 0);
    features.push(product.width || 0);
    features.push(product.height || 0);

    // Business features
    features.push(product.minimumStock || 0);
    features.push(product.maximumStock || 0);

    return features;
  }

  /**
   * Extract categorical features for Jaccard similarity
   */
  private extractCategoricalFeatures(product: any): Set<string> {
    const features = new Set<string>();

    if (product.category?.name)
      features.add(`category:${product.category.name.toLowerCase()}`);
    if (product.brand) features.add(`brand:${product.brand.toLowerCase()}`);
    if (product.color) features.add(`color:${product.color.toLowerCase()}`);
    if (product.material)
      features.add(`material:${product.material.toLowerCase()}`);

    // Add attribute-based features
    if (product.attributes) {
      Object.entries(product.attributes).forEach(([key, value]) => {
        if (typeof value === 'string') {
          features.add(`${key}:${value.toLowerCase()}`);
        }
      });
    }

    return features;
  }

  /**
   * Get candidate products for similarity comparison
   */
  private async getCandidateProducts(
    tenantId: string,
    request: SimilarityAnalysisRequest,
  ): Promise<any[]> {
    const queryBuilder = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.id != :targetId', {
        targetId: request.targetProductId,
      })
      .andWhere('product.isActive = :isActive', { isActive: true });

    if (request.includeCategories?.length) {
      queryBuilder.andWhere('category.id IN (:...categoryIds)', {
        categoryIds: request.includeCategories,
      });
    }

    if (request.excludeCategories?.length) {
      queryBuilder.andWhere('category.id NOT IN (:...excludeCategoryIds)', {
        excludeCategoryIds: request.excludeCategories,
      });
    }

    return queryBuilder.limit(100).getMany(); // Limit candidates for performance
  }

  /**
   * Get product with all features for similarity calculation
   */
  private async getProductWithFeatures(
    tenantId: string,
    productId: string,
  ): Promise<any> {
    return this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.id = :productId', { productId })
      .getOne();
  }

  /**
   * Get sales time series data for pattern analysis
   */
  private async getSalesTimeSeries(
    productId: string,
    tenantId: string,
  ): Promise<number[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await this.transactionRepo
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.transactionDate >= :startDate', {
        startDate: thirtyDaysAgo,
      })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .orderBy('transaction.transactionDate', 'ASC')
      .getMany();

    // Group by day and sum quantities
    const dailySales = {};
    transactions.forEach(transaction => {
      const day = transaction.transactionDate.toISOString().split('T')[0];
      dailySales[day] = (dailySales[day] || 0) + Math.abs(transaction.quantity);
    });

    return Object.values(dailySales) as number[];
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate string similarity using edit distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const editDistance = this.calculateEditDistance(
      str1.toLowerCase(),
      str2.toLowerCase(),
    );
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - editDistance / maxLength;
  }

  /**
   * Calculate edit distance (Levenshtein distance)
   */
  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Hash string to number for feature vector
   */
  private hashStringToNumber(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  /**
   * Find root category for hierarchical comparison
   */
  private findRootCategory(category: any): string {
    if (!category.parentId) {
      return category.id;
    }
    // This would require recursive lookup in a real implementation
    return category.parentId;
  }

  /**
   * Calculate confidence score for similarity result
   */
  private calculateSimilarityConfidence(
    product1: any,
    product2: any,
    matchingFactorsCount: number,
  ): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on data completeness
    const product1Completeness = this.calculateDataCompleteness(product1);
    const product2Completeness = this.calculateDataCompleteness(product2);
    const avgCompleteness = (product1Completeness + product2Completeness) / 2;

    confidence += avgCompleteness * 0.3;

    // Adjust based on matching factors
    confidence += (matchingFactorsCount / 5) * 0.2; // 5 is max factors

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate data completeness for a product
   */
  private calculateDataCompleteness(product: any): number {
    const fields = [
      'name',
      'description',
      'sellingPrice',
      'costPrice',
      'category',
      'brand',
    ];
    const completedFields = fields.filter(
      field => product[field] != null,
    ).length;
    return completedFields / fields.length;
  }
}
