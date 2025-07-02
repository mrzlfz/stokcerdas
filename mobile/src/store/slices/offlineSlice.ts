/**
 * Offline Slice - Offline Queue Management
 * Mengelola action queue untuk offline support dan sync
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OfflineState, OfflineAction } from '@/types';
import { SYNC_CONFIG } from '@/constants/config';

const initialState: OfflineState = {
  queue: [],
  maxSize: SYNC_CONFIG.MAX_OFFLINE_ACTIONS,
  retryAttempts: SYNC_CONFIG.SYNC_RETRY_ATTEMPTS,
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    // Add action to offline queue
    addOfflineAction: (state, action: PayloadAction<Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>>) => {
      // Check if queue is at max capacity
      if (state.queue.length >= state.maxSize) {
        // Remove oldest action
        state.queue.shift();
      }

      const offlineAction: OfflineAction = {
        ...action.payload,
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      state.queue.push(offlineAction);
    },

    // Remove action from queue
    removeOfflineAction: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(item => item.id !== action.payload);
    },

    // Update action retry count
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const actionIndex = state.queue.findIndex(item => item.id === action.payload);
      if (actionIndex !== -1) {
        state.queue[actionIndex].retryCount += 1;
      }
    },

    // Remove actions that exceeded max retry attempts
    removeFailedActions: (state) => {
      state.queue = state.queue.filter(action => action.retryCount < action.maxRetries);
    },

    // Clear all offline actions
    clearOfflineQueue: (state) => {
      state.queue = [];
    },

    // Update max queue size
    setMaxQueueSize: (state, action: PayloadAction<number>) => {
      state.maxSize = action.payload;
    },

    // Update retry attempts
    setRetryAttempts: (state, action: PayloadAction<number>) => {
      state.retryAttempts = action.payload;
    },

    // Bulk remove actions by IDs
    removeBulkActions: (state, action: PayloadAction<string[]>) => {
      state.queue = state.queue.filter(item => !action.payload.includes(item.id));
    },

    // Update action in queue
    updateOfflineAction: (state, action: PayloadAction<{
      id: string;
      updates: Partial<OfflineAction>;
    }>) => {
      const actionIndex = state.queue.findIndex(item => item.id === action.payload.id);
      if (actionIndex !== -1) {
        state.queue[actionIndex] = { ...state.queue[actionIndex], ...action.payload.updates };
      }
    },

    // Reorder queue (move failed actions to end)
    reorderQueue: (state) => {
      const successActions = state.queue.filter(action => action.retryCount === 0);
      const retryActions = state.queue.filter(action => action.retryCount > 0);
      state.queue = [...successActions, ...retryActions];
    },

    // Reset offline state
    resetOfflineState: () => initialState,

    // Prioritize action (move to front of queue)
    prioritizeAction: (state, action: PayloadAction<string>) => {
      const actionIndex = state.queue.findIndex(item => item.id === action.payload);
      if (actionIndex !== -1) {
        const [prioritizedAction] = state.queue.splice(actionIndex, 1);
        state.queue.unshift(prioritizedAction);
      }
    },

    // Get actions by endpoint
    getActionsByEndpoint: (state, action: PayloadAction<string>) => {
      return state.queue.filter(item => item.endpoint === action.payload);
    },

    // Get actions by type
    getActionsByType: (state, action: PayloadAction<string>) => {
      return state.queue.filter(item => item.type === action.payload);
    },
  },
});

export const {
  addOfflineAction,
  removeOfflineAction,
  incrementRetryCount,
  removeFailedActions,
  clearOfflineQueue,
  setMaxQueueSize,
  setRetryAttempts,
  removeBulkActions,
  updateOfflineAction,
  reorderQueue,
  resetOfflineState,
  prioritizeAction,
  getActionsByEndpoint,
  getActionsByType,
} = offlineSlice.actions;

export default offlineSlice.reducer;

// Selectors
export const selectOffline = (state: { offline: OfflineState }) => state.offline;
export const selectOfflineQueue = (state: { offline: OfflineState }) => state.offline.queue;
export const selectOfflineQueueLength = (state: { offline: OfflineState }) => state.offline.queue.length;
export const selectMaxQueueSize = (state: { offline: OfflineState }) => state.offline.maxSize;
export const selectRetryAttempts = (state: { offline: OfflineState }) => state.offline.retryAttempts;

// Check if queue is full
export const selectIsOfflineQueueFull = (state: { offline: OfflineState }) =>
  state.offline.queue.length >= state.offline.maxSize;

// Check if queue is empty
export const selectIsOfflineQueueEmpty = (state: { offline: OfflineState }) =>
  state.offline.queue.length === 0;

// Get pending actions count
export const selectPendingActionsCount = (state: { offline: OfflineState }) =>
  state.offline.queue.filter(action => action.retryCount === 0).length;

// Get failed actions count
export const selectFailedActionsCount = (state: { offline: OfflineState }) =>
  state.offline.queue.filter(action => action.retryCount > 0).length;

// Get actions by tenant
export const selectOfflineActionsByTenant = (tenantId: string) => 
  (state: { offline: OfflineState }) =>
    state.offline.queue.filter(action => action.tenantId === tenantId);

// Get actions by user
export const selectOfflineActionsByUser = (userId: string) =>
  (state: { offline: OfflineState }) =>
    state.offline.queue.filter(action => action.userId === userId);

// Get actions by method
export const selectOfflineActionsByMethod = (method: string) =>
  (state: { offline: OfflineState }) =>
    state.offline.queue.filter(action => action.method === method);

// Get next action to process
export const selectNextOfflineAction = (state: { offline: OfflineState }) =>
  state.offline.queue.find(action => action.retryCount < action.maxRetries);

// Get queue statistics
export const selectOfflineQueueStats = (state: { offline: OfflineState }) => {
  const { queue } = state.offline;
  const pending = queue.filter(action => action.retryCount === 0).length;
  const retrying = queue.filter(action => action.retryCount > 0 && action.retryCount < action.maxRetries).length;
  const failed = queue.filter(action => action.retryCount >= action.maxRetries).length;
  
  return {
    total: queue.length,
    pending,
    retrying,
    failed,
    percentageFull: (queue.length / state.offline.maxSize) * 100,
  };
};