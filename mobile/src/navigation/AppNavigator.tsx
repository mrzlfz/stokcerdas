/**
 * App Navigator - Root Navigation Configuration
 * Mengatur navigasi utama aplikasi dengan authentication flow
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated, selectAuthLoading } from '@/store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';

// Navigation components
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import LoadingScreen from '@/screens/LoadingScreen';

// Services
import notificationNavigationService from '@/services/notificationNavigationService';

// Types
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  
  // Navigation reference for notification navigation service
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Check for stored authentication data on app start
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const [accessToken, refreshToken, userData, tenantId] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ACCESS_TOKEN,
          STORAGE_KEYS.REFRESH_TOKEN,
          STORAGE_KEYS.USER_DATA,
          STORAGE_KEYS.TENANT_ID,
        ]);

        if (accessToken[1] && refreshToken[1] && userData[1] && tenantId[1]) {
          const user = JSON.parse(userData[1]);
          
          // Restore authentication state
          dispatch({
            type: 'auth/loginSuccess',
            payload: {
              user,
              tokens: {
                accessToken: accessToken[1],
                refreshToken: refreshToken[1],
                expiresIn: 3600, // Default 1 hour
                tokenType: 'Bearer',
              },
              tenantId: tenantId[1],
              permissions: [], // Will be fetched after login
            },
          });

          // Fetch fresh permissions
          // This will be handled by the auth API automatically
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
        // Clear any corrupted data
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.ACCESS_TOKEN,
          STORAGE_KEYS.REFRESH_TOKEN,
          STORAGE_KEYS.USER_DATA,
          STORAGE_KEYS.TENANT_ID,
        ]);
      }
    };

    checkAuthState();
  }, [dispatch]);

  // Set navigation reference for notification navigation service
  useEffect(() => {
    if (navigationRef.current) {
      notificationNavigationService.setNavigationRef(navigationRef.current);
    }
  }, [navigationRef.current]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // Navigation is ready, set up notification navigation service
        if (navigationRef.current) {
          notificationNavigationService.setNavigationRef(navigationRef.current);
        }
      }}
    >
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false, // Disable swipe gestures for auth screens
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen 
            name="MainStack" 
            component={MainNavigator}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        ) : (
          <Stack.Screen 
            name="AuthStack" 
            component={AuthNavigator}
            options={{
              animationTypeForReplace: 'pop',
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;