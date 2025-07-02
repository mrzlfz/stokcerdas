/**
 * UI Slice - User Interface State Management
 * Mengelola theme, language, notifications, dan loading states
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState, NotificationState, LoadingState, AppNotification } from '@/types';

const initialState: UIState = {
  theme: 'auto',
  language: 'id',
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
    badge: true,
    categories: {
      low_stock: true,
      expired: true,
      expiring_soon: true,
      stock_movement: true,
      system: true,
    },
  },
  loading: {
    global: false,
    auth: false,
    inventory: false,
    products: false,
    sync: false,
    upload: false,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme actions
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload;
    },

    // Language actions
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },

    // Notification settings
    setNotificationEnabled: (state, action: PayloadAction<boolean>) => {
      state.notifications.enabled = action.payload;
    },
    setNotificationSound: (state, action: PayloadAction<boolean>) => {
      state.notifications.sound = action.payload;
    },
    setNotificationVibration: (state, action: PayloadAction<boolean>) => {
      state.notifications.vibration = action.payload;
    },
    setNotificationBadge: (state, action: PayloadAction<boolean>) => {
      state.notifications.badge = action.payload;
    },
    setNotificationCategory: (state, action: PayloadAction<{
      category: string;
      enabled: boolean;
    }>) => {
      state.notifications.categories[action.payload.category] = action.payload.enabled;
    },
    updateNotificationSettings: (state, action: PayloadAction<Partial<NotificationState>>) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },

    // Loading states
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.auth = action.payload;
    },
    setInventoryLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.inventory = action.payload;
    },
    setProductsLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.products = action.payload;
    },
    setSyncLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.sync = action.payload;
    },
    setUploadLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.upload = action.payload;
    },
    updateLoadingState: (state, action: PayloadAction<Partial<LoadingState>>) => {
      state.loading = { ...state.loading, ...action.payload };
    },

    // Reset all loading states
    resetLoading: (state) => {
      state.loading = {
        global: false,
        auth: false,
        inventory: false,
        products: false,
        sync: false,
        upload: false,
      };
    },

    // Bulk actions for better performance
    setBulkUIState: (state, action: PayloadAction<Partial<UIState>>) => {
      return { ...state, ...action.payload };
    },

    // Reset UI state
    resetUIState: () => initialState,
  },
});

export const {
  setTheme,
  setLanguage,
  setNotificationEnabled,
  setNotificationSound,
  setNotificationVibration,
  setNotificationBadge,
  setNotificationCategory,
  updateNotificationSettings,
  setGlobalLoading,
  setAuthLoading,
  setInventoryLoading,
  setProductsLoading,
  setSyncLoading,
  setUploadLoading,
  updateLoadingState,
  resetLoading,
  setBulkUIState,
  resetUIState,
} = uiSlice.actions;

export default uiSlice.reducer;

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui;
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectLanguage = (state: { ui: UIState }) => state.ui.language;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectLoading = (state: { ui: UIState }) => state.ui.loading;

// Specific loading selectors
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.loading.global;
export const selectAuthLoading = (state: { ui: UIState }) => state.ui.loading.auth;
export const selectInventoryLoading = (state: { ui: UIState }) => state.ui.loading.inventory;
export const selectProductsLoading = (state: { ui: UIState }) => state.ui.loading.products;
export const selectSyncLoading = (state: { ui: UIState }) => state.ui.loading.sync;
export const selectUploadLoading = (state: { ui: UIState }) => state.ui.loading.upload;

// Notification selectors
export const selectNotificationEnabled = (state: { ui: UIState }) => 
  state.ui.notifications.enabled;
export const selectNotificationSound = (state: { ui: UIState }) => 
  state.ui.notifications.sound;
export const selectNotificationVibration = (state: { ui: UIState }) => 
  state.ui.notifications.vibration;
export const selectNotificationBadge = (state: { ui: UIState }) => 
  state.ui.notifications.badge;
export const selectNotificationCategories = (state: { ui: UIState }) => 
  state.ui.notifications.categories;

// Category notification checker
export const selectIsNotificationCategoryEnabled = (category: string) => 
  (state: { ui: UIState }) => 
    state.ui.notifications.enabled && state.ui.notifications.categories[category];

// Any loading checker
export const selectIsAnyLoading = (state: { ui: UIState }) => 
  Object.values(state.ui.loading).some(loading => loading);

// Check if dark mode should be used
export const selectIsDarkMode = (state: { ui: UIState }) => {
  const { theme } = state.ui;
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  // For 'auto', we would need system theme detection
  // This would typically be handled in a component with useColorScheme
  return false;
};