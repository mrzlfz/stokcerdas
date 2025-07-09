// Export all product-related entities
export { Product, ProductStatus, ProductType } from './product.entity';
export { ProductCategory } from './product-category.entity';
export { ProductVariant } from './product-variant.entity';

// Export types and interfaces
export type {
  ProductCategoryTreeNode,
  ProductCategoryBreadcrumb,
} from './product-category.entity';
