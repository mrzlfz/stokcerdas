/**
 * Main App Component - StokCerdas Mobile
 * Root component aplikasi dengan Redux Provider dan navigation setup
 */

import React, { useEffect } from 'react';
import { StatusBar, Platform, LogBox } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { enableScreens } from 'react-native-screens';

// Store
import { store, persistor } from '@/store';

// Navigation
import AppNavigator from '@/navigation/AppNavigator';

// Components
import LoadingScreen from '@/screens/LoadingScreen';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Services
import '@/services/i18n'; // Initialize internationalization
import '@/services/socketService'; // Initialize WebSocket service
import PushNotificationService from '@/services/pushNotificationService';

// Utils
import { initializeApp } from '@/utils/appInitializer';

// Enable screens for better performance
enableScreens();

// Ignore specific warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'ViewPropTypes will be removed',
    'ColorPropType will be removed',
    'ReactNative.NativeModules.LottieAnimationView',
    'Animated.event now requires a second argument',
  ]);
}

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app services
    const initApp = async () => {
      try {
        await initializeApp();
        
        // Initialize push notifications
        if (Platform.OS !== 'web') {
          await PushNotificationService.initialize();
        }
      } catch (error) {
        console.error('App initialization error:', error);
      }
    };

    initApp();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={<LoadingScreen />} persistor={persistor}>
              {/* Status Bar Configuration */}
              <StatusBar
                barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
                backgroundColor={Platform.OS === 'android' ? '#2E7D32' : undefined}
                translucent={Platform.OS === 'android'}
              />
              
              {/* Main Navigation */}
              <AppNavigator />
              
              {/* Toast Messages */}
              <Toast />
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default App;