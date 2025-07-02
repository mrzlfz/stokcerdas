/**
 * Sync Slice - Redux State Management untuk Data Synchronization
 * Mengelola state sinkronisasi data, offline queue, dan conflict resolution
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'product' | 'inventory' | 'notification' | 'user';
  entityId: string;
  data: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
}

export interface SyncConflict {
  id: string;
  operationId: string;
  type: 'version_mismatch' | 'concurrent_edit' | 'deleted_locally' | 'deleted_remotely';
  localData: any;
  remoteData: any;
  timestamp: string;
  resolution?: 'local' | 'remote' | 'merge' | 'skip';
}

export interface SyncStats {
  totalOperations: number;
  pendingOperations: number;
  completedOperations: number;
  failedOperations: number;
  conflictsResolved: number;
  lastSuccessfulSync: string | null;
  averageSyncTime: number;
}

export interface SyncState {
  // Sync status
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  nextSyncTime: string | null;
  autoSyncEnabled: boolean;
  syncInterval: number; // in milliseconds
  
  // Operation queue
  pendingOperations: SyncOperation[];
  failedOperations: SyncOperation[];
  completedOperations: string[]; // Just IDs for memory efficiency
  
  // Conflicts
  conflicts: SyncConflict[];
  unresolvedConflicts: number;
  
  // Statistics
  stats: SyncStats;
  
  // Configuration
  config: {
    batchSize: number;
    retryDelay: number;
    maxRetries: number;
    conflictResolution: 'auto' | 'manual';
    priorityOrder: string[];
  };
  
  // Error tracking
  lastError: string | null;
  errorCount: number;
  
  // Entity-specific sync status
  entitySyncStatus: Record<string, {
    lastSync: string | null;
    isLoading: boolean;
    error: string | null;
  }>;
}

const initialState: SyncState = {
  // Sync status
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  nextSyncTime: null,
  autoSyncEnabled: true,
  syncInterval: 30000, // 30 seconds
  
  // Operation queue
  pendingOperations: [],
  failedOperations: [],
  completedOperations: [],
  
  // Conflicts
  conflicts: [],
  unresolvedConflicts: 0,
  
  // Statistics
  stats: {
    totalOperations: 0,
    pendingOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    conflictsResolved: 0,
    lastSuccessfulSync: null,
    averageSyncTime: 0,
  },
  
  // Configuration
  config: {
    batchSize: 10,
    retryDelay: 5000,
    maxRetries: 3,
    conflictResolution: 'manual',
    priorityOrder: ['high', 'medium', 'low'],
  },
  
  // Error tracking
  lastError: null,
  errorCount: 0,
  
  // Entity-specific sync status
  entitySyncStatus: {},
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    // Network status
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      const wasOffline = !state.isOnline;
      state.isOnline = action.payload;
      
      // If coming back online, schedule immediate sync
      if (wasOffline && action.payload && state.pendingOperations.length > 0) {
        state.nextSyncTime = new Date().toISOString();
      }
    },
    
    // Sync status
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
      
      if (action.payload) {
        // Sync started
        state.lastError = null;
      }
    },
    
    setAutoSync: (state, action: PayloadAction<boolean>) => {
      state.autoSyncEnabled = action.payload;
      
      if (action.payload && state.pendingOperations.length > 0) {
        // Schedule next sync
        state.nextSyncTime = new Date(Date.now() + state.syncInterval).toISOString();
      }
    },
    
    setSyncInterval: (state, action: PayloadAction<number>) => {
      state.syncInterval = action.payload;
    },
    
    // Sync operations
    addSyncOperation: (state, action: PayloadAction<Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>>) => {
      const operation: SyncOperation = {
        ...action.payload,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };
      
      state.pendingOperations.push(operation);
      state.stats.totalOperations++;
      state.stats.pendingOperations++;
      
      // Schedule sync if auto sync is enabled
      if (state.autoSyncEnabled && state.isOnline) {
        state.nextSyncTime = new Date(Date.now() + 1000).toISOString(); // 1 second delay
      }
    },
    
    updateSyncOperation: (state, action: PayloadAction<{
      id: string;
      updates: Partial<SyncOperation>;
    }>) => {
      const { id, updates } = action.payload;
      const operationIndex = state.pendingOperations.findIndex(op => op.id === id);
      
      if (operationIndex !== -1) {
        state.pendingOperations[operationIndex] = {
          ...state.pendingOperations[operationIndex],
          ...updates,
        };
      }
    },
    
    markOperationCompleted: (state, action: PayloadAction<string>) => {
      const operationId = action.payload;
      
      // Remove from pending
      state.pendingOperations = state.pendingOperations.filter(op => op.id !== operationId);
      
      // Add to completed (just ID)
      state.completedOperations.push(operationId);
      
      // Update stats
      state.stats.pendingOperations = state.pendingOperations.length;
      state.stats.completedOperations++;
      
      // Keep only last 50 completed operation IDs
      if (state.completedOperations.length > 50) {
        state.completedOperations = state.completedOperations.slice(-50);
      }
    },
    
    markOperationFailed: (state, action: PayloadAction<{
      id: string;
      error: string;
    }>) => {
      const { id, error } = action.payload;
      const operationIndex = state.pendingOperations.findIndex(op => op.id === id);
      
      if (operationIndex !== -1) {
        const operation = state.pendingOperations[operationIndex];
        operation.retryCount++;
        
        if (operation.retryCount >= operation.maxRetries) {
          // Move to failed operations
          state.failedOperations.push(operation);
          state.pendingOperations.splice(operationIndex, 1);
          
          // Update stats
          state.stats.failedOperations++;
          state.stats.pendingOperations = state.pendingOperations.length;
          
          state.lastError = error;
          state.errorCount++;
        }
      }
    },
    
    retryFailedOperation: (state, action: PayloadAction<string>) => {
      const operationId = action.payload;
      const operationIndex = state.failedOperations.findIndex(op => op.id === operationId);
      
      if (operationIndex !== -1) {
        const operation = state.failedOperations[operationIndex];
        operation.retryCount = 0; // Reset retry count
        
        // Move back to pending
        state.pendingOperations.push(operation);
        state.failedOperations.splice(operationIndex, 1);
        
        // Update stats
        state.stats.pendingOperations = state.pendingOperations.length;
        state.stats.failedOperations = state.failedOperations.length;
      }
    },
    
    clearFailedOperations: (state) => {
      state.failedOperations = [];
      state.stats.failedOperations = 0;
    },
    
    // Conflict management
    addSyncConflict: (state, action: PayloadAction<Omit<SyncConflict, 'id' | 'timestamp'>>) => {
      const conflict: SyncConflict = {
        ...action.payload,
        id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
      };
      
      state.conflicts.push(conflict);
      state.unresolvedConflicts++;
    },
    
    resolveSyncConflict: (state, action: PayloadAction<{
      id: string;
      resolution: SyncConflict['resolution'];
    }>) => {
      const { id, resolution } = action.payload;
      const conflictIndex = state.conflicts.findIndex(c => c.id === id);
      
      if (conflictIndex !== -1) {
        state.conflicts[conflictIndex].resolution = resolution;
        state.unresolvedConflicts = Math.max(0, state.unresolvedConflicts - 1);
        state.stats.conflictsResolved++;
      }
    },
    
    clearResolvedConflicts: (state) => {
      state.conflicts = state.conflicts.filter(c => !c.resolution);
    },
    
    // Sync completion
    updateSyncStats: (state, action: PayloadAction<{
      syncTime: number;
      successful: boolean;
    }>) => {
      const { syncTime, successful } = action.payload;
      
      state.lastSyncTime = new Date().toISOString();
      state.isSyncing = false;
      
      if (successful) {
        state.stats.lastSuccessfulSync = state.lastSyncTime;
        state.lastError = null;
        state.errorCount = 0;
        
        // Update average sync time
        const totalSyncs = state.stats.completedOperations + 1;
        state.stats.averageSyncTime = 
          (state.stats.averageSyncTime * (totalSyncs - 1) + syncTime) / totalSyncs;
      }
      
      // Schedule next sync if auto sync is enabled
      if (state.autoSyncEnabled && state.isOnline && state.pendingOperations.length > 0) {
        state.nextSyncTime = new Date(Date.now() + state.syncInterval).toISOString();
      } else {
        state.nextSyncTime = null;
      }
    },
    
    // Entity-specific sync status
    setEntitySyncStatus: (state, action: PayloadAction<{
      entity: string;
      status: Partial<SyncState['entitySyncStatus'][string]>;
    }>) => {
      const { entity, status } = action.payload;
      
      if (!state.entitySyncStatus[entity]) {
        state.entitySyncStatus[entity] = {
          lastSync: null,
          isLoading: false,
          error: null,
        };
      }
      
      state.entitySyncStatus[entity] = {
        ...state.entitySyncStatus[entity],
        ...status,
      };
    },
    
    // Configuration
    updateSyncConfig: (state, action: PayloadAction<Partial<SyncState['config']>>) => {
      state.config = { ...state.config, ...action.payload };
    },
    
    // Error handling
    setSyncError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
      if (action.payload) {
        state.errorCount++;
      }
    },
    
    clearSyncError: (state) => {
      state.lastError = null;
      state.errorCount = 0;
    },
    
    // Batch operations
    processBatchOperations: (state, action: PayloadAction<{
      completed: string[];
      failed: Array<{ id: string; error: string }>;
    }>) => {
      const { completed, failed } = action.payload;
      
      // Mark completed operations
      completed.forEach(id => {
        state.pendingOperations = state.pendingOperations.filter(op => op.id !== id);
        state.completedOperations.push(id);
      });
      
      // Handle failed operations
      failed.forEach(({ id, error }) => {
        const operationIndex = state.pendingOperations.findIndex(op => op.id === id);
        if (operationIndex !== -1) {
          const operation = state.pendingOperations[operationIndex];
          operation.retryCount++;
          
          if (operation.retryCount >= operation.maxRetries) {
            state.failedOperations.push(operation);
            state.pendingOperations.splice(operationIndex, 1);
          }
        }
      });
      
      // Update stats
      state.stats.pendingOperations = state.pendingOperations.length;
      state.stats.completedOperations += completed.length;
      state.stats.failedOperations = state.failedOperations.length;
    },
    
    // Priority management
    updateOperationPriority: (state, action: PayloadAction<{
      id: string;
      priority: SyncOperation['priority'];
    }>) => {
      const { id, priority } = action.payload;
      const operation = state.pendingOperations.find(op => op.id === id);
      
      if (operation) {
        operation.priority = priority;
        
        // Re-sort operations by priority
        state.pendingOperations.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
      }
    },
    
    // Reset
    resetSyncState: () => initialState,
    
    // Cleanup old data
    cleanupOldData: (state) => {
      const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      // Clean up old completed operations
      state.completedOperations = state.completedOperations.slice(-20); // Keep last 20
      
      // Clean up old resolved conflicts
      state.conflicts = state.conflicts.filter(
        c => !c.resolution || new Date(c.timestamp) > cutoffTime
      );
      
      // Clean up old failed operations (keep only recent ones)
      state.failedOperations = state.failedOperations.filter(
        op => new Date(op.timestamp) > cutoffTime
      );
    },
  },
});

// Export actions
export const {
  // Network status
  setOnlineStatus,
  
  // Sync status
  setSyncing,
  setAutoSync,
  setSyncInterval,
  
  // Sync operations
  addSyncOperation,
  updateSyncOperation,
  markOperationCompleted,
  markOperationFailed,
  retryFailedOperation,
  clearFailedOperations,
  
  // Conflict management
  addSyncConflict,
  resolveSyncConflict,
  clearResolvedConflicts,
  
  // Sync completion
  updateSyncStats,
  
  // Entity-specific sync status
  setEntitySyncStatus,
  
  // Configuration
  updateSyncConfig,
  
  // Error handling
  setSyncError,
  clearSyncError,
  
  // Batch operations
  processBatchOperations,
  
  // Priority management
  updateOperationPriority,
  
  // Reset
  resetSyncState,
  
  // Cleanup
  cleanupOldData,
} = syncSlice.actions;

// Selectors
export const selectSyncStatus = (state: { sync: SyncState }) => ({
  isOnline: state.sync.isOnline,
  isSyncing: state.sync.isSyncing,
  lastSyncTime: state.sync.lastSyncTime,
  autoSyncEnabled: state.sync.autoSyncEnabled,
});

export const selectPendingOperations = (state: { sync: SyncState }) => 
  state.sync.pendingOperations;

export const selectFailedOperations = (state: { sync: SyncState }) => 
  state.sync.failedOperations;

export const selectSyncConflicts = (state: { sync: SyncState }) => 
  state.sync.conflicts;

export const selectUnresolvedConflicts = (state: { sync: SyncState }) => 
  state.sync.unresolvedConflicts;

export const selectSyncStats = (state: { sync: SyncState }) => 
  state.sync.stats;

export const selectSyncError = (state: { sync: SyncState }) => 
  state.sync.lastError;

export const selectEntitySyncStatus = (entity: string) => 
  (state: { sync: SyncState }) => state.sync.entitySyncStatus[entity];

// Complex selectors
export const selectHighPriorityOperations = (state: { sync: SyncState }) => 
  state.sync.pendingOperations.filter(op => op.priority === 'high');

export const selectOperationsByEntity = (entity: SyncOperation['entity']) => 
  (state: { sync: SyncState }) => 
    state.sync.pendingOperations.filter(op => op.entity === entity);

export const selectCanSync = (state: { sync: SyncState }) => 
  state.sync.isOnline && 
  !state.sync.isSyncing && 
  state.sync.pendingOperations.length > 0;

// Export reducer
export default syncSlice.reducer;