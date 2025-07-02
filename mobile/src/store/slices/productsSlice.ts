/**
 * Products Slice - Redux State Management untuk Products
 * Mengelola state produk, kategori, dan varian
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unitOfMeasure: string;
  price: number;
  cost?: number;
  barcode?: string;
  images: string[];
  isActive: boolean;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  supplier?: {
    id: string;
    name: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  attributes: Record<string, string>; // e.g., { color: 'red', size: 'L' }
  price?: number;
  cost?: number;
  barcode?: string;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsState {
  // Products
  products: Record<string, Product>;
  isLoading: boolean;
  error: string | null;
  
  // Categories
  categories: Record<string, ProductCategory>;
  categoriesLoading: boolean;
  
  // Variants
  variants: Record<string, ProductVariant>;
  variantsLoading: boolean;
  
  // Filters and search
  filters: {
    categoryId?: string;
    isActive?: boolean;
    searchQuery: string;
    priceRange?: {
      min: number;
      max: number;
    };
    tags: string[];
  };
  
  // Pagination
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  
  // Selected items
  selectedProducts: string[];
  
  // Cache and sync
  lastSyncTime: string | null;
  cachedSearches: Record<string, {
    results: string[];
    timestamp: string;
  }>;
}

const initialState: ProductsState = {
  // Products
  products: {},
  isLoading: false,
  error: null,
  
  // Categories
  categories: {},
  categoriesLoading: false,
  
  // Variants
  variants: {},
  variantsLoading: false,
  
  // Filters and search
  filters: {
    searchQuery: '',
    tags: [],
  },
  
  // Pagination
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    hasMore: true,
  },
  
  // Selected items
  selectedProducts: [],
  
  // Cache and sync
  lastSyncTime: null,
  cachedSearches: {},
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setCategoriesLoading: (state, action: PayloadAction<boolean>) => {
      state.categoriesLoading = action.payload;
    },
    
    setVariantsLoading: (state, action: PayloadAction<boolean>) => {
      state.variantsLoading = action.payload;
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Products management
    setProducts: (state, action: PayloadAction<Product[]>) => {
      state.products = {};
      action.payload.forEach(product => {
        state.products[product.id] = product;
      });
      state.lastSyncTime = new Date().toISOString();
    },
    
    addProducts: (state, action: PayloadAction<Product[]>) => {
      action.payload.forEach(product => {
        state.products[product.id] = product;
      });
    },
    
    addProduct: (state, action: PayloadAction<Product>) => {
      state.products[action.payload.id] = action.payload;
    },
    
    updateProduct: (state, action: PayloadAction<Partial<Product> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.products[id]) {
        state.products[id] = { 
          ...state.products[id], 
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },
    
    removeProduct: (state, action: PayloadAction<string>) => {
      delete state.products[action.payload];
      // Also remove from selected products
      state.selectedProducts = state.selectedProducts.filter(id => id !== action.payload);
    },
    
    // Categories management
    setCategories: (state, action: PayloadAction<ProductCategory[]>) => {
      state.categories = {};
      action.payload.forEach(category => {
        state.categories[category.id] = category;
      });
    },
    
    addCategory: (state, action: PayloadAction<ProductCategory>) => {
      state.categories[action.payload.id] = action.payload;
    },
    
    updateCategory: (state, action: PayloadAction<Partial<ProductCategory> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.categories[id]) {
        state.categories[id] = { 
          ...state.categories[id], 
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },
    
    removeCategory: (state, action: PayloadAction<string>) => {
      delete state.categories[action.payload];
    },
    
    // Variants management
    setVariants: (state, action: PayloadAction<ProductVariant[]>) => {
      state.variants = {};
      action.payload.forEach(variant => {
        state.variants[variant.id] = variant;
      });
    },
    
    addVariant: (state, action: PayloadAction<ProductVariant>) => {
      state.variants[action.payload.id] = action.payload;
    },
    
    updateVariant: (state, action: PayloadAction<Partial<ProductVariant> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.variants[id]) {
        state.variants[id] = { 
          ...state.variants[id], 
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },
    
    removeVariant: (state, action: PayloadAction<string>) => {
      delete state.variants[action.payload];
    },
    
    // Filters and search
    updateFilters: (state, action: PayloadAction<Partial<ProductsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      
      // Reset pagination when filters change
      state.pagination.page = 1;
      state.pagination.hasMore = true;
    },
    
    clearFilters: (state) => {
      state.filters = {
        searchQuery: '',
        tags: [],
      };
      state.pagination.page = 1;
      state.pagination.hasMore = true;
    },
    
    addFilterTag: (state, action: PayloadAction<string>) => {
      if (!state.filters.tags.includes(action.payload)) {
        state.filters.tags.push(action.payload);
      }
    },
    
    removeFilterTag: (state, action: PayloadAction<string>) => {
      state.filters.tags = state.filters.tags.filter(tag => tag !== action.payload);
    },
    
    // Pagination
    updatePagination: (state, action: PayloadAction<Partial<ProductsState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    
    resetPagination: (state) => {
      state.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: true,
      };
    },
    
    // Selection
    selectProduct: (state, action: PayloadAction<string>) => {
      if (!state.selectedProducts.includes(action.payload)) {
        state.selectedProducts.push(action.payload);
      }
    },
    
    deselectProduct: (state, action: PayloadAction<string>) => {
      state.selectedProducts = state.selectedProducts.filter(id => id !== action.payload);
    },
    
    selectAllProducts: (state) => {
      state.selectedProducts = Object.keys(state.products);
    },
    
    clearSelection: (state) => {
      state.selectedProducts = [];
    },
    
    toggleProductSelection: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      if (state.selectedProducts.includes(productId)) {
        state.selectedProducts = state.selectedProducts.filter(id => id !== productId);
      } else {
        state.selectedProducts.push(productId);
      }
    },
    
    // Cache management
    cacheSearchResults: (state, action: PayloadAction<{
      query: string;
      results: string[];
    }>) => {
      state.cachedSearches[action.payload.query] = {
        results: action.payload.results,
        timestamp: new Date().toISOString(),
      };
      
      // Keep only last 10 search caches
      const cacheKeys = Object.keys(state.cachedSearches);
      if (cacheKeys.length > 10) {
        const oldestKey = cacheKeys.reduce((oldest, current) => {
          return state.cachedSearches[current].timestamp < state.cachedSearches[oldest].timestamp 
            ? current : oldest;
        });
        delete state.cachedSearches[oldestKey];
      }
    },
    
    clearSearchCache: (state) => {
      state.cachedSearches = {};
    },
    
    // Bulk operations
    bulkUpdateProducts: (state, action: PayloadAction<{
      productIds: string[];
      updates: Partial<Product>;
    }>) => {
      const { productIds, updates } = action.payload;
      const timestamp = new Date().toISOString();
      
      productIds.forEach(id => {
        if (state.products[id]) {
          state.products[id] = {
            ...state.products[id],
            ...updates,
            updatedAt: timestamp,
          };
        }
      });
    },
    
    bulkDeleteProducts: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(id => {
        delete state.products[id];
      });
      
      // Remove from selection
      state.selectedProducts = state.selectedProducts.filter(
        id => !action.payload.includes(id)
      );
    },
    
    // Reset
    resetProductsState: () => initialState,
  },
});

// Export actions
export const {
  // Loading states
  setLoading,
  setCategoriesLoading,
  setVariantsLoading,
  
  // Error handling
  setError,
  clearError,
  
  // Products management
  setProducts,
  addProducts,
  addProduct,
  updateProduct,
  removeProduct,
  
  // Categories management
  setCategories,
  addCategory,
  updateCategory,
  removeCategory,
  
  // Variants management
  setVariants,
  addVariant,
  updateVariant,
  removeVariant,
  
  // Filters and search
  updateFilters,
  clearFilters,
  addFilterTag,
  removeFilterTag,
  
  // Pagination
  updatePagination,
  resetPagination,
  
  // Selection
  selectProduct,
  deselectProduct,
  selectAllProducts,
  clearSelection,
  toggleProductSelection,
  
  // Cache management
  cacheSearchResults,
  clearSearchCache,
  
  // Bulk operations
  bulkUpdateProducts,
  bulkDeleteProducts,
  
  // Reset
  resetProductsState,
} = productsSlice.actions;

// Selectors
export const selectProducts = (state: { products: ProductsState }) => 
  Object.values(state.products.products);

export const selectProductById = (id: string) => 
  (state: { products: ProductsState }) => state.products.products[id];

export const selectCategories = (state: { products: ProductsState }) => 
  Object.values(state.products.categories);

export const selectVariants = (state: { products: ProductsState }) => 
  Object.values(state.products.variants);

export const selectProductFilters = (state: { products: ProductsState }) => 
  state.products.filters;

export const selectProductPagination = (state: { products: ProductsState }) => 
  state.products.pagination;

export const selectSelectedProducts = (state: { products: ProductsState }) => 
  state.products.selectedProducts;

export const selectProductsLoading = (state: { products: ProductsState }) => 
  state.products.isLoading;

export const selectProductsError = (state: { products: ProductsState }) => 
  state.products.error;

// Complex selectors
export const selectActiveProducts = (state: { products: ProductsState }) => 
  Object.values(state.products.products).filter(product => product.isActive);

export const selectProductsByCategory = (categoryId: string) => 
  (state: { products: ProductsState }) => 
    Object.values(state.products.products).filter(product => product.categoryId === categoryId);

export const selectProductVariants = (productId: string) => 
  (state: { products: ProductsState }) => 
    Object.values(state.products.variants).filter(variant => variant.productId === productId);

export const selectFilteredProducts = (state: { products: ProductsState }) => {
  const { products, filters } = state.products;
  let filteredProducts = Object.values(products);
  
  if (filters.categoryId) {
    filteredProducts = filteredProducts.filter(product => product.categoryId === filters.categoryId);
  }
  
  if (filters.isActive !== undefined) {
    filteredProducts = filteredProducts.filter(product => product.isActive === filters.isActive);
  }
  
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredProducts = filteredProducts.filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
  }
  
  if (filters.tags.length > 0) {
    filteredProducts = filteredProducts.filter(product => 
      filters.tags.some(tag => product.tags.includes(tag))
    );
  }
  
  if (filters.priceRange) {
    filteredProducts = filteredProducts.filter(product => 
      product.price >= filters.priceRange!.min && 
      product.price <= filters.priceRange!.max
    );
  }
  
  return filteredProducts;
};

export const selectCategoryTree = (state: { products: ProductsState }) => {
  const categories = Object.values(state.products.categories);
  const categoryMap = new Map();
  
  // Build category tree
  categories.forEach(category => {
    categoryMap.set(category.id, { ...category, children: [] });
  });
  
  const tree: any[] = [];
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id);
    if (category.parentCategoryId) {
      const parent = categoryMap.get(category.parentCategoryId);
      if (parent) {
        parent.children.push(categoryNode);
      }
    } else {
      tree.push(categoryNode);
    }
  });
  
  return tree;
};

// Export reducer
export default productsSlice.reducer;