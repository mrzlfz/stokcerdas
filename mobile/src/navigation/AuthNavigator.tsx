/**
 * Auth Navigator - Authentication Flow Navigation
 * Menangani screen untuk login, register, dan forgot password
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Screens
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import VerifyEmailScreen from '@/screens/auth/VerifyEmailScreen';

// Types
import type { AuthStackParamList } from '@/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade',
        gestureEnabled: Platform.OS === 'ios',
        fullScreenGestureEnabled: Platform.OS === 'ios',
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          title: 'Masuk',
          gestureEnabled: false, // Prevent going back from login
        }}
      />
      
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{
          title: 'Daftar',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen}
        options={{
          title: 'Lupa Password',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="VerifyEmail" 
        component={VerifyEmailScreen}
        options={{
          title: 'Verifikasi Email',
          gestureEnabled: false, // Prevent going back during verification
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;