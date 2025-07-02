/**
 * Settings Navigator - Settings Feature Stack Navigation
 * Mengelola navigasi untuk pengaturan aplikasi dan akun
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Screens (akan dibuat nanti)
import SettingsScreen from '@/screens/settings/SettingsScreen';
import AccountSettingsScreen from '@/screens/settings/AccountSettingsScreen';
import NotificationSettingsScreen from '@/screens/settings/NotificationSettingsScreen';
import SecuritySettingsScreen from '@/screens/settings/SecuritySettingsScreen';
import AboutScreen from '@/screens/settings/AboutScreen';

// Types
import { UI_CONFIG } from '@/constants/config';

type SettingsStackParamList = {
  Settings: undefined;
  AccountSettings: undefined;
  NotificationSettings: undefined;
  SecuritySettings: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

const SettingsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: UI_CONFIG.PRIMARY_COLOR,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade',
        gestureEnabled: Platform.OS === 'ios',
      }}
    >
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Pengaturan',
          headerLargeTitle: true,
        }}
      />
      
      <Stack.Screen 
        name="AccountSettings" 
        component={AccountSettingsScreen}
        options={{
          title: 'Pengaturan Akun',
          headerBackTitle: 'Pengaturan',
        }}
      />
      
      <Stack.Screen 
        name="NotificationSettings" 
        component={NotificationSettingsScreen}
        options={{
          title: 'Pengaturan Notifikasi',
          headerBackTitle: 'Pengaturan',
        }}
      />
      
      <Stack.Screen 
        name="SecuritySettings" 
        component={SecuritySettingsScreen}
        options={{
          title: 'Pengaturan Keamanan',
          headerBackTitle: 'Pengaturan',
        }}
      />
      
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={{
          title: 'Tentang Aplikasi',
          headerBackTitle: 'Pengaturan',
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsNavigator;