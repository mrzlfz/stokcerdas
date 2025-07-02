/**
 * Redux Store Configuration dengan Redux Toolkit
 * Menggunakan RTK Query untuk API calls dan caching
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupListeners } from '@reduxjs/toolkit/query';

// Import reducers
import authReducer from './slices/authSlice';
import inventoryReducer from './slices/inventorySlice';
import productsReducer from './slices/productsSlice';
import syncReducer from './slices/syncSlice';
import offlineReducer from './slices/offlineSlice';
import uiReducer from './slices/uiSlice';
import notificationReducer from './slices/notificationSlice';

// Import API services
import { authApi } from './api/authApi';
import { inventoryApi } from './api/inventoryApi';
import { productsApi } from './api/productsApi';
import { notificationApi } from './api/notificationApi';

// Import middleware
import { offlineMiddleware } from './middleware/offlineMiddleware';
import { syncMiddleware } from './middleware/syncMiddleware';
import { errorMiddleware } from './middleware/errorMiddleware';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'offline', 'ui', 'notifications'], // Only persist specific slices
  blacklist: ['inventory', 'products', 'sync'], // Don't persist real-time data
};

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  inventory: inventoryReducer,
  products: productsReducer,
  sync: syncReducer,
  offline: offlineReducer,
  ui: uiReducer,
  notifications: notificationReducer,
  
  // API reducers
  [authApi.reducerPath]: authApi.reducer,
  [inventoryApi.reducerPath]: inventoryApi.reducer,
  [productsApi.reducerPath]: productsApi.reducer,
  [notificationApi.reducerPath]: notificationApi.reducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['items.dates'],
      },
      immutableCheck: {
        ignoredPaths: ['items.dates'],
      },
    })
      .concat(authApi.middleware)
      .concat(inventoryApi.middleware)
      .concat(productsApi.middleware)
      .concat(notificationApi.middleware)
      .concat(offlineMiddleware)
      .concat(syncMiddleware)
      .concat(errorMiddleware),
  devTools: __DEV__,
});

// Setup RTK Query listeners for refetching
setupListeners(store.dispatch);

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export hooks for typed usage
export { useAppDispatch, useAppSelector } from './hooks';

// Export actions
export * from './slices/authSlice';
export * from './slices/inventorySlice';
export * from './slices/productsSlice';
export * from './slices/syncSlice';
export * from './slices/offlineSlice';
export * from './slices/uiSlice';
export * from './slices/notificationSlice';

// Export API endpoints
export * from './api/authApi';
export * from './api/inventoryApi';
export * from './api/productsApi';
export * from './api/notificationApi';

// Store utilities
export const resetStore = () => {
  persistor.purge();
  store.dispatch({ type: 'RESET_STORE' });
};

export const clearAuthData = () => {
  store.dispatch({ type: 'auth/logout' });
};

export default store;