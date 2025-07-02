/**
 * Inventory Slice - Redux State Management untuk Inventory
 * Mengelola state inventory tracking, stock movements, dan locations
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface InventoryItem {
  id: string;
  productId: string;
  locationId: string;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  maxStockLevel?: number;
  lastMovement?: string;
  updatedAt: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  type: 'warehouse' | 'store' | 'bin';
  parentLocationId?: string;
  isActive: boolean;
  address?: string;
  description?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  locationId: string;
  type: 'adjustment' | 'transfer' | 'sale' | 'purchase' | 'return';
  quantityChange: number;
  reason: string;
  referenceId?: string;
  userId: string;
  timestamp: string;
}

export interface InventoryState {
  // Inventory items
  items: Record<string, InventoryItem>;
  isLoading: boolean;
  error: string | null;
  
  // Locations
  locations: Record<string, InventoryLocation>;
  locationsLoading: boolean;
  
  // Stock movements
  movements: StockMovement[];
  movementsLoading: boolean;
  
  // Filters and pagination
  filters: {
    locationId?: string;
    lowStock: boolean;
    outOfStock: boolean;
    searchQuery: string;
  };
  
  // Real-time updates
  lastSyncTime: string | null;
  pendingUpdates: string[];
}

const initialState: InventoryState = {
  // Inventory items
  items: {},
  isLoading: false,
  error: null,
  
  // Locations
  locations: {},
  locationsLoading: false,
  
  // Stock movements
  movements: [],
  movementsLoading: false,
  
  // Filters and pagination
  filters: {
    lowStock: false,
    outOfStock: false,
    searchQuery: '',
  },
  
  // Real-time updates
  lastSyncTime: null,
  pendingUpdates: [],
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setLocationsLoading: (state, action: PayloadAction<boolean>) => {
      state.locationsLoading = action.payload;
    },
    
    setMovementsLoading: (state, action: PayloadAction<boolean>) => {
      state.movementsLoading = action.payload;
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Inventory items management
    setInventoryItems: (state, action: PayloadAction<InventoryItem[]>) => {
      state.items = {};
      action.payload.forEach(item => {
        state.items[item.id] = item;
      });
      state.lastSyncTime = new Date().toISOString();
    },
    
    addInventoryItem: (state, action: PayloadAction<InventoryItem>) => {
      state.items[action.payload.id] = action.payload;
    },
    
    updateInventoryItem: (state, action: PayloadAction<Partial<InventoryItem> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.items[id]) {
        state.items[id] = { ...state.items[id], ...updates };
      }
    },
    
    removeInventoryItem: (state, action: PayloadAction<string>) => {
      delete state.items[action.payload];
    },
    
    // Real-time inventory updates
    updateInventoryQuantity: (state, action: PayloadAction<{
      itemId: string;
      quantityOnHand: number;
      reservedQuantity?: number;
    }>) => {
      const { itemId, quantityOnHand, reservedQuantity } = action.payload;
      const item = state.items[itemId];
      
      if (item) {
        item.quantityOnHand = quantityOnHand;
        if (reservedQuantity !== undefined) {
          item.reservedQuantity = reservedQuantity;
        }
        item.availableQuantity = item.quantityOnHand - item.reservedQuantity;
        item.updatedAt = new Date().toISOString();
      }
    },
    
    // Locations management
    setLocations: (state, action: PayloadAction<InventoryLocation[]>) => {
      state.locations = {};
      action.payload.forEach(location => {
        state.locations[location.id] = location;
      });
    },
    
    addLocation: (state, action: PayloadAction<InventoryLocation>) => {
      state.locations[action.payload.id] = action.payload;
    },
    
    updateLocation: (state, action: PayloadAction<Partial<InventoryLocation> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.locations[id]) {
        state.locations[id] = { ...state.locations[id], ...updates };
      }
    },
    
    removeLocation: (state, action: PayloadAction<string>) => {
      delete state.locations[action.payload];
    },
    
    // Stock movements
    setStockMovements: (state, action: PayloadAction<StockMovement[]>) => {
      state.movements = action.payload;
    },
    
    addStockMovement: (state, action: PayloadAction<StockMovement>) => {
      state.movements.unshift(action.payload);
      
      // Keep only last 100 movements in memory
      if (state.movements.length > 100) {
        state.movements = state.movements.slice(0, 100);
      }
    },
    
    // Filters
    updateFilters: (state, action: PayloadAction<Partial<InventoryState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    clearFilters: (state) => {
      state.filters = {
        lowStock: false,
        outOfStock: false,
        searchQuery: '',
      };
    },
    
    // Sync management
    addPendingUpdate: (state, action: PayloadAction<string>) => {
      if (!state.pendingUpdates.includes(action.payload)) {
        state.pendingUpdates.push(action.payload);
      }
    },
    
    removePendingUpdate: (state, action: PayloadAction<string>) => {
      state.pendingUpdates = state.pendingUpdates.filter(id => id !== action.payload);
    },
    
    clearPendingUpdates: (state) => {
      state.pendingUpdates = [];
    },
    
    // Reset
    resetInventoryState: () => initialState,
  },
});

// Export actions
export const {
  // Loading states
  setLoading,
  setLocationsLoading,
  setMovementsLoading,
  
  // Error handling
  setError,
  clearError,
  
  // Inventory items
  setInventoryItems,
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  updateInventoryQuantity,
  
  // Locations
  setLocations,
  addLocation,
  updateLocation,
  removeLocation,
  
  // Stock movements
  setStockMovements,
  addStockMovement,
  
  // Filters
  updateFilters,
  clearFilters,
  
  // Sync management
  addPendingUpdate,
  removePendingUpdate,
  clearPendingUpdates,
  
  // Reset
  resetInventoryState,
} = inventorySlice.actions;

// Selectors
export const selectInventoryItems = (state: { inventory: InventoryState }) => 
  Object.values(state.inventory.items);

export const selectInventoryLocations = (state: { inventory: InventoryState }) => 
  Object.values(state.inventory.locations);

export const selectStockMovements = (state: { inventory: InventoryState }) => 
  state.inventory.movements;

export const selectInventoryFilters = (state: { inventory: InventoryState }) => 
  state.inventory.filters;

export const selectInventoryLoading = (state: { inventory: InventoryState }) => 
  state.inventory.isLoading;

export const selectInventoryError = (state: { inventory: InventoryState }) => 
  state.inventory.error;

// Complex selectors
export const selectLowStockItems = (state: { inventory: InventoryState }) => 
  Object.values(state.inventory.items).filter(item => 
    item.quantityOnHand <= item.reorderPoint && item.quantityOnHand > 0
  );

export const selectOutOfStockItems = (state: { inventory: InventoryState }) => 
  Object.values(state.inventory.items).filter(item => item.quantityOnHand === 0);

export const selectInventoryByLocation = (locationId: string) => 
  (state: { inventory: InventoryState }) => 
    Object.values(state.inventory.items).filter(item => item.locationId === locationId);

export const selectFilteredInventory = (state: { inventory: InventoryState }) => {
  const { items, filters } = state.inventory;
  let filteredItems = Object.values(items);
  
  if (filters.lowStock) {
    filteredItems = filteredItems.filter(item => 
      item.quantityOnHand <= item.reorderPoint && item.quantityOnHand > 0
    );
  }
  
  if (filters.outOfStock) {
    filteredItems = filteredItems.filter(item => item.quantityOnHand === 0);
  }
  
  if (filters.locationId) {
    filteredItems = filteredItems.filter(item => item.locationId === filters.locationId);
  }
  
  if (filters.searchQuery) {
    // This would need product name lookup - simplified for now
    filteredItems = filteredItems.filter(item => 
      item.id.toLowerCase().includes(filters.searchQuery.toLowerCase())
    );
  }
  
  return filteredItems;
};

// Export reducer
export default inventorySlice.reducer;