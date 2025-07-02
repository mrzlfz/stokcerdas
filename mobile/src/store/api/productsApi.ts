/**
 * Products API - RTK Query untuk product management endpoints
 * Handles CRUD operations, search, dan barcode functionality
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { 
  ApiResponse, 
  Product, 
  ProductCategory, 
  ProductVariant,
  CreateProductRequest,
  UpdateProductRequest,
  BulkProductRequest,
  ProductSearchFilters,
} from '@/types';
import { API_CONFIG, STORAGE_KEYS } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base query dengan authentication
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_CONFIG.BASE_URL}/products`,
  timeout: API_CONFIG.TIMEOUT,
  prepareHeaders: async (headers, { getState }) => {
    const state = getState() as any;
    const tenantId = state.auth?.tenantId || await AsyncStorage.getItem(STORAGE_KEYS.TENANT_ID);
    const token = state.auth?.tokens?.accessToken || await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    
    if (tenantId) {
      headers.set('x-tenant-id', tenantId);
    }
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    
    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');
    
    return headers;
  },
});

export const productsApi = createApi({
  reducerPath: 'productsApi',
  baseQuery,
  tagTypes: ['Product', 'ProductCategory', 'ProductVariant', 'ProductStats'],
  endpoints: (builder) => ({
    // Get Products List dengan pagination dan filtering
    getProducts: builder.query<ApiResponse<{ 
      products: Product[], 
      total: number,
      totalPages: number,
      currentPage: number 
    }>, {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (result) =>
        result?.data?.products
          ? [
              ...result.data.products.map(({ id }) => ({ type: 'Product' as const, id })),
              { type: 'Product', id: 'LIST' },
            ]
          : [{ type: 'Product', id: 'LIST' }],
    }),

    // Get Product by ID
    getProduct: builder.query<ApiResponse<Product>, string>({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Product', id }],
    }),

    // Search Product by SKU
    getProductBySku: builder.query<ApiResponse<Product>, string>({
      query: (sku) => `/search/sku/${sku}`,
      providesTags: (result, error, sku) => [{ type: 'Product', id: `sku-${sku}` }],
    }),

    // Search Product by Barcode
    getProductByBarcode: builder.query<ApiResponse<Product | ProductVariant>, string>({
      query: (barcode) => `/search/barcode/${barcode}`,
      providesTags: (result, error, barcode) => [{ type: 'Product', id: `barcode-${barcode}` }],
    }),

    // Get Product Statistics
    getProductStats: builder.query<ApiResponse<{
      totalProducts: number;
      activeProducts: number;
      inactiveProducts: number;
      lowStockProducts: number;
      categoriesCount: number;
      variantsCount: number;
    }>, void>({
      query: () => '/stats',
      providesTags: ['ProductStats'],
    }),

    // Create Product
    createProduct: builder.mutation<ApiResponse<Product>, CreateProductRequest>({
      query: (productData) => ({
        url: '',
        method: 'POST',
        body: productData,
      }),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, 'ProductStats'],
    }),

    // Update Product
    updateProduct: builder.mutation<ApiResponse<Product>, { id: string; data: UpdateProductRequest }>({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        'ProductStats',
      ],
    }),

    // Delete Product (Soft Delete)
    deleteProduct: builder.mutation<ApiResponse<{ message: string }>, string>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        'ProductStats',
      ],
    }),

    // Bulk Create Products
    bulkCreateProducts: builder.mutation<ApiResponse<{ 
      created: Product[],
      errors: any[] 
    }>, BulkProductRequest[]>({
      query: (products) => ({
        url: '/bulk/create',
        method: 'POST',
        body: { products },
      }),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, 'ProductStats'],
    }),

    // Bulk Update Products
    bulkUpdateProducts: builder.mutation<ApiResponse<{ 
      updated: Product[],
      errors: any[] 
    }>, { updates: { id: string; data: UpdateProductRequest }[] }>({
      query: ({ updates }) => ({
        url: '/bulk/update',
        method: 'PATCH',
        body: { updates },
      }),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, 'ProductStats'],
    }),

    // Generate Barcode for Product
    generateBarcode: builder.mutation<ApiResponse<{ barcode: string }>, string>({
      query: (productId) => ({
        url: `/${productId}/barcode/generate`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Product', id }],
    }),

    // Validate Barcode Format
    validateBarcode: builder.mutation<ApiResponse<{ 
      valid: boolean,
      format: string | null,
      message: string 
    }>, { barcode: string }>({
      query: ({ barcode }) => ({
        url: '/barcode/validate',
        method: 'POST',
        body: { barcode },
      }),
    }),

    // ===== PRODUCT CATEGORIES =====

    // Get Categories
    getCategories: builder.query<ApiResponse<ProductCategory[]>, {
      search?: string;
      parentId?: string;
      includeCount?: boolean;
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/categories?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['ProductCategory'],
    }),

    // Get Category Tree
    getCategoryTree: builder.query<ApiResponse<ProductCategory[]>, void>({
      query: () => '/categories/tree',
      providesTags: ['ProductCategory'],
    }),

    // Get Categories with Product Count
    getCategoriesWithCount: builder.query<ApiResponse<(ProductCategory & { productCount: number })[]>, void>({
      query: () => '/categories/with-count',
      providesTags: ['ProductCategory'],
    }),

    // Create Category
    createCategory: builder.mutation<ApiResponse<ProductCategory>, {
      name: string;
      description?: string;
      parentId?: string;
      isActive?: boolean;
    }>({
      query: (categoryData) => ({
        url: '/categories',
        method: 'POST',
        body: categoryData,
      }),
      invalidatesTags: ['ProductCategory'],
    }),

    // Update Category
    updateCategory: builder.mutation<ApiResponse<ProductCategory>, {
      id: string;
      data: {
        name?: string;
        description?: string;
        parentId?: string;
        isActive?: boolean;
      };
    }>({
      query: ({ id, data }) => ({
        url: `/categories/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['ProductCategory'],
    }),

    // Delete Category
    deleteCategory: builder.mutation<ApiResponse<{ message: string }>, string>({
      query: (id) => ({
        url: `/categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ProductCategory'],
    }),

    // Reorder Categories
    reorderCategories: builder.mutation<ApiResponse<{ message: string }>, {
      categoryOrders: { id: string; order: number }[]
    }>({
      query: ({ categoryOrders }) => ({
        url: '/categories/reorder',
        method: 'PATCH',
        body: { categoryOrders },
      }),
      invalidatesTags: ['ProductCategory'],
    }),

    // ===== PRODUCT VARIANTS =====

    // Get Variants by Product
    getProductVariants: builder.query<ApiResponse<ProductVariant[]>, string>({
      query: (productId) => `/variants/product/${productId}`,
      providesTags: (result, error, productId) => [
        { type: 'ProductVariant', id: `product-${productId}` }
      ],
    }),

    // Get Variant Matrix
    getVariantMatrix: builder.query<ApiResponse<{
      attributes: string[];
      variants: ProductVariant[];
      matrix: any[][];
    }>, string>({
      query: (productId) => `/variants/product/${productId}/matrix`,
      providesTags: (result, error, productId) => [
        { type: 'ProductVariant', id: `matrix-${productId}` }
      ],
    }),

    // Search Variant by SKU
    getVariantBySku: builder.query<ApiResponse<ProductVariant>, string>({
      query: (sku) => `/variants/search/sku/${sku}`,
      providesTags: (result, error, sku) => [{ type: 'ProductVariant', id: `sku-${sku}` }],
    }),

    // Search Variant by Barcode
    getVariantByBarcode: builder.query<ApiResponse<ProductVariant>, string>({
      query: (barcode) => `/variants/search/barcode/${barcode}`,
      providesTags: (result, error, barcode) => [{ type: 'ProductVariant', id: `barcode-${barcode}` }],
    }),

    // Create Variant
    createVariant: builder.mutation<ApiResponse<ProductVariant>, {
      productId: string;
      sku: string;
      attributes: Record<string, string>;
      price?: number;
      costPrice?: number;
      barcode?: string;
      isActive?: boolean;
    }>({
      query: (variantData) => ({
        url: '/variants',
        method: 'POST',
        body: variantData,
      }),
      invalidatesTags: (result, error, { productId }) => [
        { type: 'ProductVariant', id: `product-${productId}` },
        { type: 'ProductVariant', id: `matrix-${productId}` },
      ],
    }),

    // Update Variant
    updateVariant: builder.mutation<ApiResponse<ProductVariant>, {
      id: string;
      data: {
        sku?: string;
        attributes?: Record<string, string>;
        price?: number;
        costPrice?: number;
        barcode?: string;
        isActive?: boolean;
      };
    }>({
      query: ({ id, data }) => ({
        url: `/variants/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'ProductVariant', id },
        // Note: We'd need the productId to invalidate specific product variants
      ],
    }),

    // Delete Variant
    deleteVariant: builder.mutation<ApiResponse<{ message: string }>, string>({
      query: (id) => ({
        url: `/variants/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'ProductVariant', id },
        // Note: We'd need the productId to invalidate specific product variants
      ],
    }),

    // Bulk Update Variant Prices
    bulkUpdateVariantPrices: builder.mutation<ApiResponse<{ updated: ProductVariant[] }>, {
      updates: { id: string; price: number; costPrice?: number }[]
    }>({
      query: ({ updates }) => ({
        url: '/variants/bulk/update-prices',
        method: 'PATCH',
        body: { updates },
      }),
      invalidatesTags: ['ProductVariant'],
    }),
  }),
});

export const {
  // Products
  useGetProductsQuery,
  useGetProductQuery,
  useGetProductBySkuQuery,
  useGetProductByBarcodeQuery,
  useGetProductStatsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useBulkCreateProductsMutation,
  useBulkUpdateProductsMutation,
  useGenerateBarcodeMutation,
  useValidateBarcodeMutation,
  
  // Categories
  useGetCategoriesQuery,
  useGetCategoryTreeQuery,
  useGetCategoriesWithCountQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useReorderCategoriesMutation,
  
  // Variants
  useGetProductVariantsQuery,
  useGetVariantMatrixQuery,
  useGetVariantBySkuQuery,
  useGetVariantByBarcodeQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
  useBulkUpdateVariantPricesMutation,
} = productsApi;