/**
 * Notification Slice - Redux State Management untuk Notifications
 * Mengelola state notifikasi, unread count, preferences, dan alert configurations
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AppNotification } from '@/types';

export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
  };
  categories: {
    [key: string]: boolean;
  };
}

export interface NotificationState {
  // Notification list
  notifications: AppNotification[];
  unreadCount: number;
  lastUpdated: string | null;
  
  // UI state
  isLoading: boolean;
  isRefreshing: boolean;
  isSelectionMode: boolean;
  selectedNotifications: string[];
  
  // Preferences
  preferences: NotificationPreferences;
  
  // Device token & service state
  deviceToken: string | null;
  isServiceInitialized: boolean;
  subscribedTopics: string[];
  
  // Error handling
  error: string | null;
  
  // Badge count
  badgeCount: number;
}

const initialState: NotificationState = {
  // Notification list
  notifications: [],
  unreadCount: 0,
  lastUpdated: null,
  
  // UI state
  isLoading: false,
  isRefreshing: false,
  isSelectionMode: false,
  selectedNotifications: [],
  
  // Preferences
  preferences: {
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
      inventory: true,
      alerts: true,
    },
  },
  
  // Device token & service state
  deviceToken: null,
  isServiceInitialized: false,
  subscribedTopics: [],
  
  // Error handling
  error: null,
  
  // Badge count
  badgeCount: 0,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Notification management actions
    addNotification: (state, action: PayloadAction<AppNotification>) => {
      // Add to beginning of array (newest first)
      state.notifications.unshift(action.payload);
      
      // Update unread count if notification is unread
      if (!action.payload.read) {
        state.unreadCount += 1;
        state.badgeCount += 1;
      }
      
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        const removedNotifications = state.notifications.splice(100);
        // Adjust unread count for removed notifications
        const removedUnread = removedNotifications.filter(n => !n.read).length;
        state.unreadCount = Math.max(0, state.unreadCount - removedUnread);
        state.badgeCount = Math.max(0, state.badgeCount - removedUnread);
      }
      
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    },
    
    setNotifications: (state, action: PayloadAction<AppNotification[]>) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.read).length;
      state.badgeCount = state.unreadCount;
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    },
    
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.badgeCount = Math.max(0, state.badgeCount - 1);
        state.lastUpdated = new Date().toISOString();
      }
    },
    
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
      state.unreadCount = 0;
      state.badgeCount = 0;
      state.lastUpdated = new Date().toISOString();
    },
    
    markSelectedAsRead: (state) => {
      state.selectedNotifications.forEach(id => {
        const notification = state.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.badgeCount = Math.max(0, state.badgeCount - 1);
        }
      });
      state.selectedNotifications = [];
      state.isSelectionMode = false;
      state.lastUpdated = new Date().toISOString();
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.badgeCount = Math.max(0, state.badgeCount - 1);
        }
        state.notifications.splice(index, 1);
        state.lastUpdated = new Date().toISOString();
      }
    },
    
    removeSelectedNotifications: (state) => {
      const removedUnreadCount = state.selectedNotifications.reduce((count, id) => {
        const notification = state.notifications.find(n => n.id === id);
        return count + (notification && !notification.read ? 1 : 0);
      }, 0);
      
      state.notifications = state.notifications.filter(
        n => !state.selectedNotifications.includes(n.id)
      );
      
      state.unreadCount = Math.max(0, state.unreadCount - removedUnreadCount);
      state.badgeCount = Math.max(0, state.badgeCount - removedUnreadCount);
      state.selectedNotifications = [];
      state.isSelectionMode = false;
      state.lastUpdated = new Date().toISOString();
    },
    
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.badgeCount = 0;
      state.selectedNotifications = [];
      state.isSelectionMode = false;
      state.lastUpdated = new Date().toISOString();
    },
    
    // Selection mode actions
    toggleSelectionMode: (state) => {
      state.isSelectionMode = !state.isSelectionMode;
      if (!state.isSelectionMode) {
        state.selectedNotifications = [];
      }
    },
    
    toggleNotificationSelection: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.selectedNotifications.indexOf(id);
      
      if (index === -1) {
        state.selectedNotifications.push(id);
      } else {
        state.selectedNotifications.splice(index, 1);
      }
    },
    
    selectAllNotifications: (state) => {
      state.selectedNotifications = state.notifications.map(n => n.id);
    },
    
    clearSelection: (state) => {
      state.selectedNotifications = [];
      state.isSelectionMode = false;
    },
    
    // Preferences actions
    updatePreferences: (state, action: PayloadAction<Partial<NotificationPreferences>>) => {
      state.preferences = {
        ...state.preferences,
        ...action.payload,
      };
    },
    
    updateCategoryPreference: (state, action: PayloadAction<{ category: string; enabled: boolean }>) => {
      state.preferences.categories[action.payload.category] = action.payload.enabled;
    },
    
    updateQuietHours: (state, action: PayloadAction<NotificationPreferences['quietHours']>) => {
      state.preferences.quietHours = action.payload;
    },
    
    // Device token & service actions
    setDeviceToken: (state, action: PayloadAction<string | null>) => {
      state.deviceToken = action.payload;
    },
    
    setServiceInitialized: (state, action: PayloadAction<boolean>) => {
      state.isServiceInitialized = action.payload;
    },
    
    addSubscribedTopic: (state, action: PayloadAction<string>) => {
      if (!state.subscribedTopics.includes(action.payload)) {
        state.subscribedTopics.push(action.payload);
      }
    },
    
    removeSubscribedTopic: (state, action: PayloadAction<string>) => {
      const index = state.subscribedTopics.indexOf(action.payload);
      if (index !== -1) {
        state.subscribedTopics.splice(index, 1);
      }
    },
    
    setSubscribedTopics: (state, action: PayloadAction<string[]>) => {
      state.subscribedTopics = action.payload;
    },
    
    // UI state actions
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setRefreshing: (state, action: PayloadAction<boolean>) => {
      state.isRefreshing = action.payload;
    },
    
    setBadgeCount: (state, action: PayloadAction<number>) => {
      state.badgeCount = Math.max(0, action.payload);
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset action
    resetNotificationState: () => {
      return initialState;
    },
  },
});

// Export actions
export const {
  // Notification management
  addNotification,
  setNotifications,
  markNotificationAsRead,
  markAllAsRead,
  markSelectedAsRead,
  removeNotification,
  removeSelectedNotifications,
  clearAllNotifications,
  
  // Selection mode
  toggleSelectionMode,
  toggleNotificationSelection,
  selectAllNotifications,
  clearSelection,
  
  // Preferences
  updatePreferences,
  updateCategoryPreference,
  updateQuietHours,
  
  // Device token & service
  setDeviceToken,
  setServiceInitialized,
  addSubscribedTopic,
  removeSubscribedTopic,
  setSubscribedTopics,
  
  // UI state
  setLoading,
  setRefreshing,
  setBadgeCount,
  
  // Error handling
  setError,
  clearError,
  
  // Reset
  resetNotificationState,
} = notificationSlice.actions;

// Selectors
export const selectNotifications = (state: { notifications: NotificationState }) => 
  state.notifications.notifications;

export const selectUnreadCount = (state: { notifications: NotificationState }) => 
  state.notifications.unreadCount;

export const selectNotificationPreferences = (state: { notifications: NotificationState }) => 
  state.notifications.preferences;

export const selectIsSelectionMode = (state: { notifications: NotificationState }) => 
  state.notifications.isSelectionMode;

export const selectSelectedNotifications = (state: { notifications: NotificationState }) => 
  state.notifications.selectedNotifications;

export const selectNotificationLoading = (state: { notifications: NotificationState }) => 
  state.notifications.isLoading;

export const selectNotificationError = (state: { notifications: NotificationState }) => 
  state.notifications.error;

export const selectDeviceToken = (state: { notifications: NotificationState }) => 
  state.notifications.deviceToken;

export const selectIsServiceInitialized = (state: { notifications: NotificationState }) => 
  state.notifications.isServiceInitialized;

export const selectSubscribedTopics = (state: { notifications: NotificationState }) => 
  state.notifications.subscribedTopics;

export const selectBadgeCount = (state: { notifications: NotificationState }) => 
  state.notifications.badgeCount;

// Complex selectors
export const selectUnreadNotifications = (state: { notifications: NotificationState }) => 
  state.notifications.notifications.filter(n => !n.read);

export const selectNotificationsByCategory = (category: string) => 
  (state: { notifications: NotificationState }) => 
    state.notifications.notifications.filter(n => n.category === category);

export const selectNotificationsByType = (type: string) => 
  (state: { notifications: NotificationState }) => 
    state.notifications.notifications.filter(n => n.type === type);

export const selectActionableNotifications = (state: { notifications: NotificationState }) => 
  state.notifications.notifications.filter(n => n.actionable);

// Export reducer
export default notificationSlice.reducer;