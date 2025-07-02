/**
 * Error Middleware - Handles notification-related errors and recovery
 * Provides comprehensive error handling, logging, and user notifications
 */

import { Middleware } from '@reduxjs/toolkit';
import { isRejectedWithValue } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import type { RootState } from '../index';
import { addNotification, setError, clearError } from '../slices/notificationSlice';

interface ErrorLog {
  id: string;
  timestamp: string;
  action: string;
  error: string;
  errorCode?: string;
  userId?: string;
  tenantId?: string;
  deviceInfo?: any;
  stack?: string;
}

interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelay: number;
  fallbackAction?: string;
  userNotification?: {
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info';
  };
}

class NotificationErrorManager {
  private errorLog: ErrorLog[] = [];
  private retryCount: Map<string, number> = new Map();
  private readonly ERROR_LOG_KEY = 'notification_error_log';
  private readonly MAX_LOG_SIZE = 100;

  private errorStrategies: Record<string, ErrorRecoveryStrategy> = {
    // Notification API errors
    'notificationApi/registerDevice/rejected': {
      maxRetries: 3,
      retryDelay: 5000,
      userNotification: {
        title: 'Registrasi Gagal',
        message: 'Gagal mendaftarkan perangkat untuk notifikasi',
        type: 'error',
      },
    },
    'notificationApi/getNotificationHistory/rejected': {
      maxRetries: 2,
      retryDelay: 3000,
      userNotification: {
        title: 'Gagal Memuat Notifikasi',
        message: 'Tidak dapat memuat riwayat notifikasi',
        type: 'warning',
      },
    },
    'notificationApi/markNotificationsAsRead/rejected': {
      maxRetries: 3,
      retryDelay: 2000,
      fallbackAction: 'markAsReadOffline',
    },
    'notificationApi/syncNotificationPreferences/rejected': {
      maxRetries: 2,
      retryDelay: 5000,
      userNotification: {
        title: 'Sinkronisasi Gagal',
        message: 'Pengaturan notifikasi tidak dapat disinkronkan',
        type: 'warning',
      },
    },

    // FCM/Push notification errors
    'pushNotification/tokenRefresh/failed': {
      maxRetries: 3,
      retryDelay: 10000,
      userNotification: {
        title: 'Token Notifikasi Bermasalah',
        message: 'Notifikasi push mungkin tidak berfungsi normal',
        type: 'warning',
      },
    },
    'pushNotification/permission/denied': {
      maxRetries: 0,
      retryDelay: 0,
      userNotification: {
        title: 'Izin Notifikasi Ditolak',
        message: 'Aktifkan izin notifikasi di pengaturan untuk menerima alert',
        type: 'warning',
      },
    },

    // Socket/Real-time errors
    'socket/connection/failed': {
      maxRetries: 5,
      retryDelay: 3000,
      userNotification: {
        title: 'Koneksi Terputus',
        message: 'Notifikasi real-time tidak tersedia',
        type: 'info',
      },
    },

    // Storage errors
    'storage/notification/saveFailed': {
      maxRetries: 2,
      retryDelay: 1000,
      userNotification: {
        title: 'Penyimpanan Bermasalah',
        message: 'Beberapa notifikasi mungkin hilang',
        type: 'warning',
      },
    },

    // Generic fallbacks
    default: {
      maxRetries: 1,
      retryDelay: 5000,
      userNotification: {
        title: 'Terjadi Kesalahan',
        message: 'Sistem notifikasi mengalami gangguan',
        type: 'error',
      },
    },
  };

  constructor() {
    this.loadErrorLog();
  }

  /**
   * Load error log from storage
   */
  private async loadErrorLog(): Promise<void> {
    try {
      const errorLogData = await AsyncStorage.getItem(this.ERROR_LOG_KEY);
      if (errorLogData) {
        this.errorLog = JSON.parse(errorLogData);
        console.log(`Loaded ${this.errorLog.length} error log entries`);
      }
    } catch (error) {
      console.error('Error loading error log:', error);
    }
  }

  /**
   * Save error log to storage
   */
  private async saveErrorLog(): Promise<void> {
    try {
      // Keep only the most recent entries
      if (this.errorLog.length > this.MAX_LOG_SIZE) {
        this.errorLog = this.errorLog.slice(-this.MAX_LOG_SIZE);
      }
      
      await AsyncStorage.setItem(this.ERROR_LOG_KEY, JSON.stringify(this.errorLog));
    } catch (error) {
      console.error('Error saving error log:', error);
    }
  }

  /**
   * Log an error
   */
  async logError(
    action: string,
    error: Error | any,
    additionalInfo?: any
  ): Promise<void> {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      error: error.message || error.toString(),
      errorCode: error.code || error.status,
      stack: error.stack,
      ...additionalInfo,
    };

    this.errorLog.push(errorLog);
    await this.saveErrorLog();

    console.error('Notification error logged:', errorLog);
  }

  /**
   * Handle error with recovery strategy
   */
  async handleError(
    action: string,
    error: any,
    dispatch: any,
    state?: any
  ): Promise<boolean> {
    // Log the error
    await this.logError(action, error, {
      userId: state?.auth?.user?.id,
      tenantId: state?.auth?.tenantId,
    });

    // Get retry count for this action
    const retryKey = `${action}_${error.code || 'unknown'}`;
    const currentRetries = this.retryCount.get(retryKey) || 0;

    // Get error recovery strategy
    const strategy = this.errorStrategies[action] || this.errorStrategies.default;

    // Check if we should retry
    if (currentRetries < strategy.maxRetries) {
      this.retryCount.set(retryKey, currentRetries + 1);
      
      console.log(`Retrying action ${action} (attempt ${currentRetries + 1}/${strategy.maxRetries})`);
      
      // Schedule retry
      setTimeout(() => {
        this.executeRetry(action, dispatch, state);
      }, strategy.retryDelay);

      return true; // Indicates retry is scheduled
    }

    // Max retries reached, execute fallback or show error
    this.retryCount.delete(retryKey);

    if (strategy.fallbackAction) {
      console.log(`Executing fallback action: ${strategy.fallbackAction}`);
      dispatch({ type: strategy.fallbackAction, payload: error });
    }

    if (strategy.userNotification) {
      this.showUserNotification(strategy.userNotification, dispatch);
    }

    return false; // Indicates error handling is complete
  }

  /**
   * Execute retry for failed action
   */
  private executeRetry(action: string, dispatch: any, state: any): void {
    // This would need to be implemented based on the specific action
    // For now, we'll dispatch a retry action
    dispatch({
      type: `${action}/retry`,
      meta: { isRetry: true },
    });
  }

  /**
   * Show user notification for error
   */
  private showUserNotification(
    notification: ErrorRecoveryStrategy['userNotification'],
    dispatch: any
  ): void {
    if (!notification) return;

    // Show toast notification
    Toast.show({
      type: notification.type === 'error' ? 'error' : 
            notification.type === 'warning' ? 'info' : 'success',
      text1: notification.title,
      text2: notification.message,
      position: 'top',
      visibilityTime: notification.type === 'error' ? 6000 : 4000,
    });

    // Also add to notification center for important errors
    if (notification.type === 'error') {
      dispatch(addNotification({
        id: `error_notification_${Date.now()}`,
        title: notification.title,
        message: notification.message,
        type: 'error',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
        actionable: false,
        data: { isError: true },
      }));
    }
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    return (
      error.code === 'NETWORK_ERROR' ||
      error.message?.includes('Network') ||
      error.message?.includes('fetch') ||
      error.status === 0 ||
      !navigator.onLine
    );
  }

  /**
   * Check if error is authentication-related
   */
  private isAuthError(error: any): boolean {
    return (
      error.status === 401 ||
      error.status === 403 ||
      error.code === 'UNAUTHORIZED' ||
      error.message?.includes('unauthorized')
    );
  }

  /**
   * Clear error retry counts
   */
  clearRetryCounters(): void {
    this.retryCount.clear();
    console.log('Error retry counters cleared');
  }

  /**
   * Get error statistics
   */
  getErrorStats(): any {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(
      log => new Date(log.timestamp) > last24Hours
    );

    return {
      totalErrors: this.errorLog.length,
      recentErrors: recentErrors.length,
      retryCounters: Object.fromEntries(this.retryCount),
      errorsByAction: this.errorLog.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Clear error log
   */
  async clearErrorLog(): Promise<void> {
    this.errorLog = [];
    this.retryCount.clear();
    await AsyncStorage.removeItem(this.ERROR_LOG_KEY);
    console.log('Error log cleared');
  }
}

// Create singleton instance
const errorManager = new NotificationErrorManager();

/**
 * Error middleware for handling notification errors
 */
export const errorMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // Handle RTK Query rejected actions
  if (isRejectedWithValue(action)) {
    const errorAction = `${action.type}`;
    const error = action.payload;
    
    console.error('RTK Query error:', errorAction, error);
    
    // Handle the error with recovery strategy
    errorManager.handleError(
      errorAction,
      error,
      store.dispatch,
      store.getState()
    );
  }

  // Handle custom error actions
  if (action.type.endsWith('/error') || action.type.includes('error')) {
    const errorAction = action.type;
    const error = action.payload;
    
    console.error('Custom error action:', errorAction, error);
    
    // Handle the error
    errorManager.handleError(
      errorAction,
      error,
      store.dispatch,
      store.getState()
    );
  }

  // Handle notification-specific errors
  const notificationErrorActions = [
    'notifications/fcmTokenError',
    'notifications/permissionDenied',
    'notifications/socketConnectionError',
    'notifications/storageError',
    'notifications/syncError',
  ];

  if (notificationErrorActions.includes(action.type)) {
    const error = action.payload;
    
    // Set error in notification state
    store.dispatch(setError(error.message || error.toString()));
    
    // Handle with recovery strategy
    errorManager.handleError(
      action.type,
      error,
      store.dispatch,
      store.getState()
    );
  }

  // Handle network errors specifically
  if (action.type === 'offline/setConnected' && !action.payload) {
    // Network disconnected, show offline notification
    store.dispatch(addNotification({
      id: `offline_${Date.now()}`,
      title: 'Mode Offline',
      message: 'Koneksi internet terputus. Beberapa fitur mungkin terbatas.',
      type: 'warning',
      category: 'system',
      timestamp: new Date().toISOString(),
      read: false,
      actionable: false,
      data: { offline: true },
    }));
  }

  // Handle auth errors that affect notifications
  if (action.type === 'auth/logout' || action.type === 'auth/tokenExpired') {
    // Clear notification errors when user logs out
    store.dispatch(clearError());
    errorManager.clearRetryCounters();
  }

  // Error management actions
  if (action.type === 'error/clearRetryCounters') {
    errorManager.clearRetryCounters();
  }

  if (action.type === 'error/getStats') {
    console.log('Error stats:', errorManager.getErrorStats());
  }

  if (action.type === 'error/clearLog') {
    errorManager.clearErrorLog();
  }

  return next(action);
};

// Export utilities
export { errorManager };
export default errorMiddleware;