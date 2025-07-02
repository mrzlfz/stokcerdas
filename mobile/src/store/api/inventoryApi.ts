/**
 * Inventory API - RTK Query untuk inventory management endpoints
 * Handles stock levels, adjustments, transfers, dan real-time updates
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { 
  ApiResponse,
  InventoryItem,
  InventoryLocation,
  InventoryTransaction,
  StockAdjustmentRequest,
  StockTransferRequest,
  InventoryFilters,
} from '@/types';
import { API_CONFIG, STORAGE_KEYS } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base query dengan authentication
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_CONFIG.BASE_URL}/inventory`,
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

export const inventoryApi = createApi({
  reducerPath: 'inventoryApi',
  baseQuery,
  tagTypes: ['InventoryItem', 'InventoryLocation', 'InventoryTransaction', 'InventoryStats'],
  endpoints: (builder) => ({
    // ===== INVENTORY ITEMS =====

    // Get Inventory Items dengan filtering
    getInventoryItems: builder.query<ApiResponse<{
      items: InventoryItem[];
      total: number;
      totalPages: number;
      currentPage: number;
    }>, {
      page?: number;
      limit?: number;
      productId?: string;
      locationId?: string;
      search?: string;
      status?: 'in_stock' | 'low_stock' | 'out_of_stock';
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
          url: `/items?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (result) =>
        result?.data?.items
          ? [
              ...result.data.items.map(({ id }) => ({ type: 'InventoryItem' as const, id })),
              { type: 'InventoryItem', id: 'LIST' },
            ]
          : [{ type: 'InventoryItem', id: 'LIST' }],
    }),

    // Get Inventory Item by Product and Location
    getInventoryItem: builder.query<ApiResponse<InventoryItem>, {
      productId: string;
      locationId: string;
    }>({
      query: ({ productId, locationId }) => `/items/product/${productId}/location/${locationId}`,
      providesTags: (result, error, { productId, locationId }) => [
        { type: 'InventoryItem', id: `${productId}-${locationId}` }
      ],
    }),

    // Get Inventory Statistics
    getInventoryStats: builder.query<ApiResponse<{
      totalItems: number;
      totalValue: number;
      lowStockItems: number;
      outOfStockItems: number;
      locations: number;
      topMovingProducts: Array<{
        productId: string;
        productName: string;
        movements: number;
        value: number;
      }>;
    }>, void>({
      query: () => '/items/stats',
      providesTags: ['InventoryStats'],
    }),

    // Get Real-time Stock Levels
    getRealtimeStockLevels: builder.query<ApiResponse<{
      items: Array<{
        productId: string;
        locationId: string;
        quantityOnHand: number;
        quantityAvailable: number;
        quantityReserved: number;
        lastMovementAt: string;
      }>;
    }>, {
      productIds?: string[];
      locationIds?: string[];
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        if (params.productIds?.length) {
          params.productIds.forEach(id => searchParams.append('productIds', id));
        }
        if (params.locationIds?.length) {
          params.locationIds.forEach(id => searchParams.append('locationIds', id));
        }
        
        return {
          url: `/items/realtime-levels?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['InventoryItem'],
    }),

    // Get Item Metrics
    getItemMetrics: builder.query<ApiResponse<{
      turnoverRate: number;
      averageMovementValue: number;
      lastMovements: InventoryTransaction[];
      projectedStockout: string | null;
    }>, string>({
      query: (itemId) => `/items/${itemId}/metrics`,
      providesTags: (result, error, itemId) => [{ type: 'InventoryItem', id: itemId }],
    }),

    // Create Inventory Item
    createInventoryItem: builder.mutation<ApiResponse<InventoryItem>, {
      productId: string;
      locationId: string;
      quantityOnHand: number;
      costPrice?: number;
      reorderPoint?: number;
      maxStock?: number;
    }>({
      query: (itemData) => ({
        url: '/items',
        method: 'POST',
        body: itemData,
      }),
      invalidatesTags: [{ type: 'InventoryItem', id: 'LIST' }, 'InventoryStats'],
    }),

    // ===== STOCK ADJUSTMENTS =====

    // Stock Adjustment
    adjustStock: builder.mutation<ApiResponse<InventoryTransaction>, {
      productId: string;
      locationId: string;
      quantityChange: number;
      reasonCode: string;
      notes?: string;
      costPrice?: number;
    }>({
      query: (adjustmentData) => ({
        url: '/items/adjust',
        method: 'POST',
        body: adjustmentData,
      }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        'InventoryStats',
        { type: 'InventoryTransaction', id: 'LIST' },
      ],
    }),

    // Bulk Stock Adjustment
    bulkAdjustStock: builder.mutation<ApiResponse<{
      successful: InventoryTransaction[];
      failed: Array<{ error: string; data: any }>;
    }>, {
      adjustments: Array<{
        productId: string;
        locationId: string;
        quantityChange: number;
        reasonCode: string;
        notes?: string;
        costPrice?: number;
      }>;
    }>({
      query: ({ adjustments }) => ({
        url: '/items/adjust/bulk',
        method: 'POST',
        body: { adjustments },
      }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        'InventoryStats',
        { type: 'InventoryTransaction', id: 'LIST' },
      ],
    }),

    // Reserve Stock
    reserveStock: builder.mutation<ApiResponse<{ 
      reservationId: string;
      quantityReserved: number; 
    }>, {
      productId: string;
      locationId: string;
      quantity: number;
      reservationReason?: string;
      expiresAt?: string;
    }>({
      query: (reservationData) => ({
        url: '/items/reserve',
        method: 'POST',
        body: reservationData,
      }),
      invalidatesTags: (result, error, { productId, locationId }) => [
        { type: 'InventoryItem', id: `${productId}-${locationId}` },
        { type: 'InventoryItem', id: 'LIST' },
      ],
    }),

    // Release Stock Reservation
    releaseReservation: builder.mutation<ApiResponse<{ message: string }>, {
      reservationId: string;
    }>({
      query: ({ reservationId }) => ({
        url: '/items/release-reservation',
        method: 'POST',
        body: { reservationId },
      }),
      invalidatesTags: [{ type: 'InventoryItem', id: 'LIST' }],
    }),

    // Physical Stock Count
    performStockCount: builder.mutation<ApiResponse<InventoryTransaction>, {
      productId: string;
      locationId: string;
      countedQuantity: number;
      notes?: string;
    }>({
      query: (countData) => ({
        url: '/items/stock-count',
        method: 'POST',
        body: countData,
      }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        'InventoryStats',
        { type: 'InventoryTransaction', id: 'LIST' },
      ],
    }),

    // ===== INVENTORY LOCATIONS =====

    // Get Locations
    getLocations: builder.query<ApiResponse<InventoryLocation[]>, {
      search?: string;
      parentId?: string;
      type?: string;
      includeStats?: boolean;
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/locations?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['InventoryLocation'],
    }),

    // Get Location Hierarchy
    getLocationHierarchy: builder.query<ApiResponse<InventoryLocation[]>, void>({
      query: () => '/locations/hierarchy',
      providesTags: ['InventoryLocation'],
    }),

    // Get Location by Code
    getLocationByCode: builder.query<ApiResponse<InventoryLocation>, string>({
      query: (code) => `/locations/search/code/${code}`,
      providesTags: (result, error, code) => [{ type: 'InventoryLocation', id: `code-${code}` }],
    }),

    // Get Location Statistics
    getLocationStats: builder.query<ApiResponse<{
      totalLocations: number;
      activeLocations: number;
      itemsCount: number;
      totalValue: number;
      utilizationRate: number;
    }>, void>({
      query: () => '/locations/stats',
      providesTags: ['InventoryLocation'],
    }),

    // Create Location
    createLocation: builder.mutation<ApiResponse<InventoryLocation>, {
      name: string;
      code: string;
      type: 'warehouse' | 'store' | 'bin';
      parentId?: string;
      description?: string;
      isActive?: boolean;
    }>({
      query: (locationData) => ({
        url: '/locations',
        method: 'POST',
        body: locationData,
      }),
      invalidatesTags: ['InventoryLocation'],
    }),

    // Update Location
    updateLocation: builder.mutation<ApiResponse<InventoryLocation>, {
      id: string;
      data: {
        name?: string;
        code?: string;
        type?: 'warehouse' | 'store' | 'bin';
        parentId?: string;
        description?: string;
        isActive?: boolean;
      };
    }>({
      query: ({ id, data }) => ({
        url: `/locations/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['InventoryLocation'],
    }),

    // ===== INVENTORY TRANSACTIONS =====

    // Get Transactions
    getTransactions: builder.query<ApiResponse<{
      transactions: InventoryTransaction[];
      total: number;
      totalPages: number;
      currentPage: number;
    }>, {
      page?: number;
      limit?: number;
      productId?: string;
      locationId?: string;
      type?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/transactions?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (result) =>
        result?.data?.transactions
          ? [
              ...result.data.transactions.map(({ id }) => ({ type: 'InventoryTransaction' as const, id })),
              { type: 'InventoryTransaction', id: 'LIST' },
            ]
          : [{ type: 'InventoryTransaction', id: 'LIST' }],
    }),

    // Get Transaction by ID
    getTransaction: builder.query<ApiResponse<InventoryTransaction>, string>({
      query: (id) => `/transactions/${id}`,
      providesTags: (result, error, id) => [{ type: 'InventoryTransaction', id }],
    }),

    // Get Transaction Statistics
    getTransactionStats: builder.query<ApiResponse<{
      totalTransactions: number;
      adjustments: number;
      transfers: number;
      counts: number;
      totalValueMoved: number;
    }>, {
      startDate?: string;
      endDate?: string;
      locationId?: string;
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/transactions/stats?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['InventoryStats'],
    }),

    // ===== STOCK TRANSFERS =====

    // Create Transfer
    createTransfer: builder.mutation<ApiResponse<InventoryTransaction>, {
      productId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
      notes?: string;
    }>({
      query: (transferData) => ({
        url: '/transactions/transfers',
        method: 'POST',
        body: transferData,
      }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        { type: 'InventoryTransaction', id: 'LIST' },
        'InventoryStats',
      ],
    }),

    // Process Transfer Receipt
    processTransferReceipt: builder.mutation<ApiResponse<InventoryTransaction>, {
      transferId: string;
      receivedQuantity: number;
      notes?: string;
    }>({
      query: ({ transferId, receivedQuantity, notes }) => ({
        url: '/transactions/transfers/receipt',
        method: 'POST',
        body: { transferId, receivedQuantity, notes },
      }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        { type: 'InventoryTransaction', id: 'LIST' },
        'InventoryStats',
      ],
    }),

    // Quick Inter-location Transfer
    quickTransfer: builder.mutation<ApiResponse<InventoryTransaction>, {
      productId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
    }>({
      query: (transferData) => ({
        url: '/transactions/transfers/inter-location',
        method: 'POST',
        body: transferData,
      }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        { type: 'InventoryTransaction', id: 'LIST' },
        'InventoryStats',
      ],
    }),

    // Get Pending Transfers
    getPendingTransfers: builder.query<ApiResponse<InventoryTransaction[]>, {
      locationId?: string;
    }>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/transactions/transfers/pending?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: [{ type: 'InventoryTransaction', id: 'PENDING' }],
    }),

    // ===== AUDIT TRAILS =====

    // Get Product Movement History
    getProductMovements: builder.query<ApiResponse<InventoryTransaction[]>, {
      productId: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }>({
      query: ({ productId, ...params }) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/transactions/movements/product/${productId}?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (result, error, { productId }) => [
        { type: 'InventoryTransaction', id: `product-${productId}` }
      ],
    }),

    // Get Location Audit Trail
    getLocationAuditTrail: builder.query<ApiResponse<InventoryTransaction[]>, {
      locationId: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }>({
      query: ({ locationId, ...params }) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
        
        return {
          url: `/transactions/audit-trail/location/${locationId}?${searchParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (result, error, { locationId }) => [
        { type: 'InventoryTransaction', id: `location-${locationId}` }
      ],
    }),
  }),
});

export const {
  // Inventory Items
  useGetInventoryItemsQuery,
  useGetInventoryItemQuery,
  useGetInventoryStatsQuery,
  useGetRealtimeStockLevelsQuery,
  useGetItemMetricsQuery,
  useCreateInventoryItemMutation,
  
  // Stock Operations
  useAdjustStockMutation,
  useBulkAdjustStockMutation,
  useReserveStockMutation,
  useReleaseReservationMutation,
  usePerformStockCountMutation,
  
  // Locations
  useGetLocationsQuery,
  useGetLocationHierarchyQuery,
  useGetLocationByCodeQuery,
  useGetLocationStatsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  
  // Transactions
  useGetTransactionsQuery,
  useGetTransactionQuery,
  useGetTransactionStatsQuery,
  
  // Transfers
  useCreateTransferMutation,
  useProcessTransferReceiptMutation,
  useQuickTransferMutation,
  useGetPendingTransfersQuery,
  
  // Audit
  useGetProductMovementsQuery,
  useGetLocationAuditTrailQuery,
} = inventoryApi;