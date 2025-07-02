/**
 * Sync Middleware - Handles notification synchronization across devices
 * Syncs notification state, preferences, and ensures consistency
 */

import { Middleware } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootState } from '../index';
import { 
  setNotifications, 
  updatePreferences, 
  setDeviceToken, 
  setSubscribedTopics,
  setError,
  addNotification 
} from '../slices/notificationSlice';

interface SyncConfig {
  syncInterval: number; // in milliseconds
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
}

interface SyncOperation {
  id: string;
  type: 'notification' | 'preferences' | 'topics' | 'device_token';
  data: any;
  timestamp: string;
  deviceId: string;
  userId?: string;
  tenantId?: string;
}

class NotificationSyncManager {
  private config: SyncConfig = {
    syncInterval: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
    batchSize: 50,
  };

  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private pendingOperations: SyncOperation[] = [];
  private readonly SYNC_KEY = 'notification_sync_data';
  private readonly LAST_SYNC_KEY = 'notification_last_sync';

  constructor() {
    this.loadSyncData();
  }

  /**
   * Start automatic sync
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);

    console.log('Notification sync started with interval:', this.config.syncInterval);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    console.log('Notification sync stopped');
  }

  /**
   * Load sync data from storage
   */
  private async loadSyncData(): Promise<void> {
    try {
      const [syncData, lastSync] = await AsyncStorage.multiGet([
        this.SYNC_KEY,
        this.LAST_SYNC_KEY,
      ]);

      if (syncData[1]) {
        this.pendingOperations = JSON.parse(syncData[1]);
      }

      if (lastSync[1]) {
        this.lastSyncTime = lastSync[1];
      }

      console.log(`Loaded ${this.pendingOperations.length} pending sync operations`);
    } catch (error) {
      console.error('Error loading sync data:', error);
    }
  }

  /**
   * Save sync data to storage
   */
  private async saveSyncData(): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [this.SYNC_KEY, JSON.stringify(this.pendingOperations)],
        [this.LAST_SYNC_KEY, this.lastSyncTime || new Date().toISOString()],
      ]);
    } catch (error) {
      console.error('Error saving sync data:', error);
    }
  }

  /**
   * Add operation to sync queue
   */
  async queueSyncOperation(operation: Omit<SyncOperation, 'id' | 'timestamp'>): Promise<void> {
    const syncOp: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.pendingOperations.push(syncOp);
    await this.saveSyncData();

    console.log('Queued sync operation:', syncOp.type);
  }

  /**
   * Perform synchronization
   */
  async performSync(force: boolean = false): Promise<boolean> {
    if (this.isSyncing && !force) {
      console.log('Sync already in progress, skipping');
      return false;
    }

    this.isSyncing = true;
    console.log('Starting notification synchronization...');

    try {
      // Sync pending operations first
      await this.processPendingOperations();

      // Fetch latest data from server
      await this.fetchLatestNotifications();
      await this.fetchLatestPreferences();
      await this.fetchLatestTopics();

      // Update last sync time
      this.lastSyncTime = new Date().toISOString();
      await this.saveSyncData();

      console.log('Notification synchronization completed successfully');
      return true;
    } catch (error) {
      console.error('Notification synchronization failed:', error);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process pending sync operations
   */
  private async processPendingOperations(): Promise<void> {
    if (this.pendingOperations.length === 0) {
      return;
    }

    console.log(`Processing ${this.pendingOperations.length} pending sync operations`);

    const batches = this.chunkArray(this.pendingOperations, this.config.batchSize);
    const failedOperations: SyncOperation[] = [];

    for (const batch of batches) {
      try {
        await this.processBatch(batch);
      } catch (error) {
        console.error('Failed to process sync batch:', error);
        failedOperations.push(...batch);
      }
    }

    // Keep failed operations for retry
    this.pendingOperations = failedOperations;
    await this.saveSyncData();
  }

  /**
   * Process a batch of sync operations
   */
  private async processBatch(operations: SyncOperation[]): Promise<void> {
    for (const operation of operations) {
      switch (operation.type) {
        case 'notification':
          await this.syncNotificationOperation(operation);
          break;
        case 'preferences':
          await this.syncPreferencesOperation(operation);
          break;
        case 'topics':
          await this.syncTopicsOperation(operation);
          break;
        case 'device_token':
          await this.syncDeviceTokenOperation(operation);
          break;
        default:
          console.warn('Unknown sync operation type:', operation.type);
      }
    }
  }

  /**
   * Sync notification operation
   */
  private async syncNotificationOperation(operation: SyncOperation): Promise<void> {
    // TODO: Implement actual API call
    console.log('Syncing notification operation:', operation.data);
    
    // Simulate API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 500);
    });
  }

  /**
   * Sync preferences operation
   */
  private async syncPreferencesOperation(operation: SyncOperation): Promise<void> {
    // TODO: Implement actual API call
    console.log('Syncing preferences operation:', operation.data);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 500);
    });
  }

  /**
   * Sync topics operation
   */
  private async syncTopicsOperation(operation: SyncOperation): Promise<void> {
    // TODO: Implement actual API call
    console.log('Syncing topics operation:', operation.data);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 500);
    });
  }

  /**
   * Sync device token operation
   */
  private async syncDeviceTokenOperation(operation: SyncOperation): Promise<void> {
    // TODO: Implement actual API call
    console.log('Syncing device token operation:', operation.data);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('Sync failed'));
        }
      }, 500);
    });
  }

  /**
   * Fetch latest notifications from server
   */
  private async fetchLatestNotifications(): Promise<void> {
    try {
      // TODO: Implement actual API call
      console.log('Fetching latest notifications from server...');
      
      // Simulate API response
      const mockNotifications = [
        {
          id: 'server_sync_1',
          title: 'Sync Notification',
          message: 'Notifikasi dari server setelah sync',
          type: 'info' as const,
          category: 'system',
          timestamp: new Date().toISOString(),
          read: false,
          actionable: false,
          data: { source: 'server_sync' },
        },
      ];

      // This would be dispatched via the middleware's store reference
      // store.dispatch(setNotifications(mockNotifications));
      
    } catch (error) {
      console.error('Error fetching latest notifications:', error);
    }
  }

  /**
   * Fetch latest preferences from server
   */
  private async fetchLatestPreferences(): Promise<void> {
    try {
      // TODO: Implement actual API call
      console.log('Fetching latest preferences from server...');
      
      // Simulate API response
      const mockPreferences = {
        enabled: true,
        sound: true,
        vibration: true,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
        },
        categories: {
          low_stock: true,
          expired: true,
          expiring_soon: true,
          stock_movement: true,
          system: true,
        },
      };

      // This would be dispatched via the middleware's store reference
      // store.dispatch(updatePreferences(mockPreferences));
      
    } catch (error) {
      console.error('Error fetching latest preferences:', error);
    }
  }

  /**
   * Fetch latest subscribed topics from server
   */
  private async fetchLatestTopics(): Promise<void> {
    try {
      // TODO: Implement actual API call
      console.log('Fetching latest topics from server...');
      
      // Simulate API response
      const mockTopics = ['low_stock', 'expired', 'system_alerts'];

      // This would be dispatched via the middleware's store reference
      // store.dispatch(setSubscribedTopics(mockTopics));
      
    } catch (error) {
      console.error('Error fetching latest topics:', error);
    }
  }

  /**
   * Utility function to chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingOperations: this.pendingOperations.length,
      autoSyncEnabled: this.syncTimer !== null,
    };
  }

  /**
   * Force immediate sync
   */
  async forcSync(): Promise<boolean> {
    return this.performSync(true);
  }

  /**
   * Clear all pending operations
   */
  async clearPendingOperations(): Promise<void> {
    this.pendingOperations = [];
    await this.saveSyncData();
    console.log('Cleared all pending sync operations');
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto sync with new interval if it's running
    if (this.syncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
    
    console.log('Sync configuration updated:', this.config);
  }
}

// Create singleton instance
const syncManager = new NotificationSyncManager();

/**
 * Sync middleware for handling notification synchronization
 */
export const syncMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // Actions that trigger sync operations
  const syncTriggerActions = [
    'notifications/markNotificationAsRead',
    'notifications/markAllAsRead',
    'notifications/removeNotification',
    'notifications/clearAllNotifications',
    'notifications/updatePreferences',
    'notifications/addSubscribedTopic',
    'notifications/removeSubscribedTopic',
    'notifications/setDeviceToken',
  ];

  // Queue sync operation if action requires it
  if (syncTriggerActions.includes(action.type)) {
    const state = store.getState();
    const userId = state.auth.user?.id;
    const tenantId = state.auth.tenantId;
    const deviceId = state.notifications?.deviceToken || 'unknown';

    // Determine sync operation type and data
    let syncType: SyncOperation['type'];
    let syncData: any;

    switch (action.type) {
      case 'notifications/markNotificationAsRead':
      case 'notifications/markAllAsRead':
      case 'notifications/removeNotification':
      case 'notifications/clearAllNotifications':
        syncType = 'notification';
        syncData = { action: action.type, payload: action.payload };
        break;
        
      case 'notifications/updatePreferences':
        syncType = 'preferences';
        syncData = action.payload;
        break;
        
      case 'notifications/addSubscribedTopic':
      case 'notifications/removeSubscribedTopic':
        syncType = 'topics';
        syncData = { action: action.type, topic: action.payload };
        break;
        
      case 'notifications/setDeviceToken':
        syncType = 'device_token';
        syncData = { token: action.payload };
        break;
        
      default:
        syncType = 'notification';
        syncData = { action: action.type, payload: action.payload };
    }

    // Queue the sync operation
    syncManager.queueSyncOperation({
      type: syncType,
      data: syncData,
      deviceId,
      userId,
      tenantId,
    });
  }

  // Handle sync control actions
  if (action.type === 'sync/start') {
    syncManager.startAutoSync();
  }

  if (action.type === 'sync/stop') {
    syncManager.stopAutoSync();
  }

  if (action.type === 'sync/force') {
    syncManager.forcSync().then(success => {
      if (success) {
        store.dispatch(addNotification({
          id: `sync_success_${Date.now()}`,
          title: 'Sinkronisasi Berhasil',
          message: 'Data notifikasi telah disinkronkan',
          type: 'success',
          category: 'system',
          timestamp: new Date().toISOString(),
          read: false,
          actionable: false,
          data: { sync: true },
        }));
      } else {
        store.dispatch(setError('Sinkronisasi gagal'));
      }
    });
  }

  if (action.type === 'sync/clear') {
    syncManager.clearPendingOperations();
  }

  if (action.type === 'sync/status') {
    console.log('Sync status:', syncManager.getSyncStatus());
  }

  // Handle auth state changes
  if (action.type === 'auth/loginSuccess') {
    // Start auto sync when user logs in
    setTimeout(() => syncManager.startAutoSync(), 2000);
  }

  if (action.type === 'auth/logout') {
    // Stop auto sync when user logs out
    syncManager.stopAutoSync();
  }

  return next(action);
};

// Export utilities
export { syncManager };
export default syncMiddleware;