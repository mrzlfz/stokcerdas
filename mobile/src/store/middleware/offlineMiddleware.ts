/**
 * Offline Middleware - Handles offline notification queuing and sync
 * Queue notifications when offline and sync when connection is restored
 */

import { Middleware } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { RootState } from '../index';
import { addNotification, setError } from '../slices/notificationSlice';

interface QueuedNotification {
  id: string;
  action: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

class OfflineNotificationManager {
  private queue: QueuedNotification[] = [];
  private isOnline: boolean = true;
  private isProcessing: boolean = false;
  private readonly QUEUE_KEY = 'notification_offline_queue';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor() {
    this.initializeNetworkListener();
    this.loadQueueFromStorage();
  }

  /**
   * Initialize network state listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected === true;
      
      if (wasOffline && this.isOnline) {
        console.log('Network restored, processing offline notification queue');
        this.processQueue();
      }
    });
  }

  /**
   * Load queued notifications from storage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.QUEUE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
        console.log(`Loaded ${this.queue.length} notifications from offline queue`);
      }
    } catch (error) {
      console.error('Error loading offline notification queue:', error);
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving offline notification queue:', error);
    }
  }

  /**
   * Add action to offline queue
   */
  async queueAction(action: any): Promise<void> {
    const queuedNotification: QueuedNotification = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
    };

    this.queue.push(queuedNotification);
    await this.saveQueueToStorage();
    
    console.log('Action queued for offline processing:', action.type);
  }

  /**
   * Process queued notifications when online
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Processing ${this.queue.length} queued notifications`);

    const failedActions: QueuedNotification[] = [];

    for (const queuedItem of this.queue) {
      try {
        // Simulate API call or actual dispatch
        await this.processQueuedAction(queuedItem);
        console.log('Successfully processed queued action:', queuedItem.action.type);
      } catch (error) {
        console.error('Failed to process queued action:', error);
        
        queuedItem.retryCount++;
        if (queuedItem.retryCount < queuedItem.maxRetries) {
          failedActions.push(queuedItem);
        } else {
          console.error('Max retries reached for action:', queuedItem.action.type);
        }
      }
    }

    // Update queue with failed actions for retry
    this.queue = failedActions;
    await this.saveQueueToStorage();

    this.isProcessing = false;

    // Schedule retry for failed actions
    if (failedActions.length > 0) {
      setTimeout(() => this.processQueue(), this.RETRY_DELAY);
    }
  }

  /**
   * Process individual queued action
   */
  private async processQueuedAction(queuedItem: QueuedNotification): Promise<void> {
    const { action } = queuedItem;
    
    // Handle different types of notification actions
    switch (action.type) {
      case 'notifications/markNotificationAsRead':
        // Call API to mark as read
        await this.markNotificationAsReadAPI(action.payload);
        break;
        
      case 'notifications/removeNotification':
        // Call API to remove notification
        await this.removeNotificationAPI(action.payload);
        break;
        
      case 'notifications/updatePreferences':
        // Sync preferences with server
        await this.syncPreferencesAPI(action.payload);
        break;
        
      case 'notifications/addSubscribedTopic':
        // Subscribe to topic on server
        await this.subscribeToTopicAPI(action.payload);
        break;
        
      case 'notifications/removeSubscribedTopic':
        // Unsubscribe from topic on server
        await this.unsubscribeFromTopicAPI(action.payload);
        break;
        
      default:
        console.warn('Unknown queued action type:', action.type);
        break;
    }
  }

  /**
   * API call handlers (to be implemented when backend is ready)
   */
  private async markNotificationAsReadAPI(notificationId: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('API call: mark notification as read:', notificationId);
    
    // Simulate API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate success/failure
        if (Math.random() > 0.1) { // 90% success rate
          resolve();
        } else {
          reject(new Error('API call failed'));
        }
      }, 1000);
    });
  }

  private async removeNotificationAPI(notificationId: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('API call: remove notification:', notificationId);
    
    // Simulate API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('API call failed'));
        }
      }, 1000);
    });
  }

  private async syncPreferencesAPI(preferences: any): Promise<void> {
    // TODO: Implement actual API call
    console.log('API call: sync preferences:', preferences);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('API call failed'));
        }
      }, 1000);
    });
  }

  private async subscribeToTopicAPI(topic: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('API call: subscribe to topic:', topic);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('API call failed'));
        }
      }, 1000);
    });
  }

  private async unsubscribeFromTopicAPI(topic: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('API call: unsubscribe from topic:', topic);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('API call failed'));
        }
      }, 1000);
    });
  }

  /**
   * Clear the queue (for testing or reset)
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await AsyncStorage.removeItem(this.QUEUE_KEY);
    console.log('Offline notification queue cleared');
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
    };
  }
}

// Create singleton instance
const offlineManager = new OfflineNotificationManager();

/**
 * Offline middleware for handling notification actions when offline
 */
export const offlineMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // List of actions that should be queued when offline
  const queueableActions = [
    'notifications/markNotificationAsRead',
    'notifications/removeNotification',
    'notifications/updatePreferences',
    'notifications/addSubscribedTopic',
    'notifications/removeSubscribedTopic',
    'notifications/markAllAsRead',
    'notifications/clearAllNotifications',
  ];

  // Check if action should be queued when offline
  if (queueableActions.includes(action.type)) {
    const networkState = store.getState().offline?.isConnected ?? true;
    
    if (!networkState) {
      // Queue the action for later processing
      offlineManager.queueAction(action);
      
      // Still execute the action locally for optimistic UI
      const result = next(action);
      
      // Add a notification about offline mode
      store.dispatch(addNotification({
        id: `offline_notice_${Date.now()}`,
        title: 'Mode Offline',
        message: 'Perubahan akan disinkronkan saat koneksi tersedia',
        type: 'info',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
        actionable: false,
        data: { offline: true },
      }));
      
      return result;
    }
  }

  // Handle network status changes
  if (action.type === 'offline/setConnected') {
    const wasOffline = !store.getState().offline?.isConnected;
    const isNowOnline = action.payload;
    
    if (wasOffline && isNowOnline) {
      // Process queued notifications when coming back online
      setTimeout(() => offlineManager.processQueue(), 1000);
    }
  }

  // Handle queue management actions
  if (action.type === 'offline/clearQueue') {
    offlineManager.clearQueue();
  }

  if (action.type === 'offline/getQueueStatus') {
    console.log('Queue status:', offlineManager.getQueueStatus());
  }

  return next(action);
};

// Export utilities
export { offlineManager };
export default offlineMiddleware;