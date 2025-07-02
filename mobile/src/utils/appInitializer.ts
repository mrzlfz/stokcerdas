/**
 * App Initializer
 * Handles app initialization sequence dan setup
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { STORAGE_KEYS, APP_CONFIG } from '@/constants/config';

// Services
import socketService from '@/services/socketService';
import notificationIntegrationService from '@/services/notificationIntegrationService';
import '@/services/i18n'; // Initialize i18n

interface InitializationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Initialize app services and dependencies
 */
export const initializeApp = async (): Promise<InitializationResult> => {
  const result: InitializationResult = {
    success: true,
    errors: [],
    warnings: [],
  };

  console.log('🚀 Initializing StokCerdas Mobile App...');

  try {
    // 1. Check app version and migration needs
    await checkAppVersion(result);

    // 2. Initialize network monitoring
    await initializeNetworkMonitoring(result);

    // 3. Setup error tracking (placeholder)
    await setupErrorTracking(result);

    // 4. Initialize analytics (placeholder)
    await initializeAnalytics(result);

    // 5. Setup biometric authentication if available
    await setupBiometricAuth(result);

    // 6. Initialize offline queue processing
    await initializeOfflineQueue(result);

    // 7. Setup background tasks
    await setupBackgroundTasks(result);

    // 8. Initialize socket connection (if authenticated)
    await initializeSocket(result);

    // 9. Initialize notification integration service
    await initializeNotificationIntegration(result);

    // 10. Setup app state handlers
    setupAppStateHandlers();

    console.log('✅ App initialization completed', result);
    return result;
  } catch (error) {
    console.error('❌ App initialization failed:', error);
    result.success = false;
    result.errors.push(`Initialization failed: ${error}`);
    return result;
  }
};

/**
 * Check app version and handle migrations
 */
const checkAppVersion = async (result: InitializationResult): Promise<void> => {
  try {
    const storedVersion = await AsyncStorage.getItem('app_version');
    const currentVersion = APP_CONFIG.VERSION;

    if (!storedVersion) {
      // First time install
      await AsyncStorage.setItem('app_version', currentVersion);
      await AsyncStorage.setItem('first_install_date', new Date().toISOString());
      console.log('📱 First time app installation detected');
    } else if (storedVersion !== currentVersion) {
      // App update detected
      await handleAppUpdate(storedVersion, currentVersion);
      await AsyncStorage.setItem('app_version', currentVersion);
      console.log(`🔄 App updated from ${storedVersion} to ${currentVersion}`);
    }

    // Store build number for debugging
    await AsyncStorage.setItem('app_build', APP_CONFIG.BUILD_NUMBER);
  } catch (error) {
    result.warnings.push(`Version check failed: ${error}`);
  }
};

/**
 * Handle app update migrations
 */
const handleAppUpdate = async (oldVersion: string, newVersion: string): Promise<void> => {
  try {
    console.log(`🔄 Migrating from ${oldVersion} to ${newVersion}`);

    // Placeholder for version-specific migrations
    // Example:
    // if (compareVersions(oldVersion, '1.1.0') < 0) {
    //   await migrateToV1_1_0();
    // }

    // Clear cached data if needed
    const cacheToClear = ['api_cache', 'image_cache'];
    await AsyncStorage.multiRemove(cacheToClear);

    await AsyncStorage.setItem('last_update_date', new Date().toISOString());
  } catch (error) {
    console.error('Migration error:', error);
  }
};

/**
 * Initialize network monitoring
 */
const initializeNetworkMonitoring = async (result: InitializationResult): Promise<void> => {
  try {
    // Get initial network state
    const networkState = await NetInfo.fetch();
    console.log('🌐 Network state:', networkState);

    // Store initial state
    await AsyncStorage.setItem('network_state', JSON.stringify({
      isConnected: networkState.isConnected,
      type: networkState.type,
      timestamp: new Date().toISOString(),
    }));

    // Subscribe to network changes
    NetInfo.addEventListener(state => {
      console.log('📶 Network state changed:', state);
      handleNetworkStateChange(state);
    });
  } catch (error) {
    result.warnings.push(`Network monitoring setup failed: ${error}`);
  }
};

/**
 * Handle network state changes
 */
const handleNetworkStateChange = async (state: any): Promise<void> => {
  try {
    await AsyncStorage.setItem('network_state', JSON.stringify({
      isConnected: state.isConnected,
      type: state.type,
      timestamp: new Date().toISOString(),
    }));

    // Trigger sync when coming back online
    if (state.isConnected) {
      console.log('📡 Device back online, triggering sync...');
      // Trigger offline queue processing
      // store.dispatch(processOfflineQueue());
    } else {
      console.log('📵 Device went offline');
    }
  } catch (error) {
    console.error('Error handling network state change:', error);
  }
};

/**
 * Setup error tracking (placeholder for Crashlytics, Sentry, etc.)
 */
const setupErrorTracking = async (result: InitializationResult): Promise<void> => {
  try {
    // Placeholder for error tracking service
    // Example: Crashlytics, Sentry, Bugsnag
    
    console.log('📊 Error tracking setup (placeholder)');

    // Setup global error handler
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.error('Global error caught:', error);
      
      // Log to error tracking service
      // crashlytics().recordError(error);
      
      // Call original handler
      originalHandler(error, isFatal);
    });
  } catch (error) {
    result.warnings.push(`Error tracking setup failed: ${error}`);
  }
};

/**
 * Initialize analytics (placeholder)
 */
const initializeAnalytics = async (result: InitializationResult): Promise<void> => {
  try {
    // Placeholder for analytics service
    // Example: Firebase Analytics, Mixpanel, Amplitude
    
    console.log('📈 Analytics setup (placeholder)');

    // Set user properties
    const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (userId) {
      // analytics().setUserId(userId);
      // analytics().setUserProperty('platform', Platform.OS);
    }
  } catch (error) {
    result.warnings.push(`Analytics setup failed: ${error}`);
  }
};

/**
 * Setup biometric authentication
 */
const setupBiometricAuth = async (result: InitializationResult): Promise<void> => {
  try {
    // Placeholder for biometric authentication setup
    // This would typically check if biometric auth is available
    // and setup the necessary configurations
    
    console.log('🔐 Biometric auth setup (placeholder)');

    // Check if biometrics are available
    // const isBiometricAvailable = await ReactNativeBiometrics.isSensorAvailable();
    // await AsyncStorage.setItem('biometric_available', JSON.stringify(isBiometricAvailable));
  } catch (error) {
    result.warnings.push(`Biometric auth setup failed: ${error}`);
  }
};

/**
 * Initialize offline queue processing
 */
const initializeOfflineQueue = async (result: InitializationResult): Promise<void> => {
  try {
    console.log('📤 Offline queue initialized');

    // Get pending offline actions
    const offlineQueue = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (offlineQueue) {
      const queue = JSON.parse(offlineQueue);
      console.log(`📤 Found ${queue.length} pending offline actions`);
    }
  } catch (error) {
    result.warnings.push(`Offline queue initialization failed: ${error}`);
  }
};

/**
 * Setup background tasks
 */
const setupBackgroundTasks = async (result: InitializationResult): Promise<void> => {
  try {
    console.log('⏰ Background tasks setup (placeholder)');

    // Placeholder for background task setup
    // This would typically setup:
    // - Background sync
    // - Data refresh
    // - Notification processing
  } catch (error) {
    result.warnings.push(`Background tasks setup failed: ${error}`);
  }
};

/**
 * Initialize socket connection if user is authenticated
 */
const initializeSocket = async (result: InitializationResult): Promise<void> => {
  try {
    const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const tenantId = await AsyncStorage.getItem(STORAGE_KEYS.TENANT_ID);

    if (accessToken && tenantId) {
      console.log('🔌 Initializing socket connection...');
      await socketService.connect();
    } else {
      console.log('🔌 Socket not initialized (not authenticated)');
    }
  } catch (error) {
    result.warnings.push(`Socket initialization failed: ${error}`);
  }
};

/**
 * Initialize notification integration service
 */
const initializeNotificationIntegration = async (result: InitializationResult): Promise<void> => {
  try {
    console.log('🔔 Initializing notification integration service...');
    await notificationIntegrationService.initialize();
    console.log('✅ Notification integration service initialized');
  } catch (error) {
    result.warnings.push(`Notification integration initialization failed: ${error}`);
    console.error('❌ Notification integration initialization failed:', error);
  }
};

/**
 * Setup app state handlers
 */
const setupAppStateHandlers = (): void => {
  // This would typically setup handlers for:
  // - App foreground/background state changes
  // - Memory warnings
  // - Deep link handling
  
  console.log('📱 App state handlers setup (placeholder)');
};

/**
 * Clear app data (for logout or debugging)
 */
export const clearAppData = async (): Promise<void> => {
  try {
    console.log('🧹 Clearing app data...');

    // Disconnect socket
    socketService.disconnect();

    // Cleanup notification integration service
    notificationIntegrationService.cleanup();

    // Clear sensitive data
    const keysToRemove = [
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.TENANT_ID,
      STORAGE_KEYS.OFFLINE_QUEUE,
      'api_cache',
      'fcm_token',
    ];

    await AsyncStorage.multiRemove(keysToRemove);

    console.log('✅ App data cleared');
  } catch (error) {
    console.error('❌ Failed to clear app data:', error);
  }
};

/**
 * Reset app to initial state
 */
export const resetApp = async (): Promise<void> => {
  try {
    console.log('🔄 Resetting app...');

    // Clear all data
    await AsyncStorage.clear();

    // Re-initialize
    await initializeApp();

    console.log('✅ App reset completed');
  } catch (error) {
    console.error('❌ Failed to reset app:', error);
  }
};