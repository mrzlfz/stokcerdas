/**
 * Main Navigator - Bottom Tab Navigation
 * Navigasi utama aplikasi dengan bottom tabs untuk fitur utama
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Tab Screens
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import ProductsScreen from '@/screens/products/ProductsScreen';
import ReportsScreen from '@/screens/reports/ReportsScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';

// Stack Navigators
import InventoryNavigator from './InventoryNavigator';
import ProductsNavigator from './ProductsNavigator';
import ScannerNavigator from './ScannerNavigator';
import ReportsNavigator from './ReportsNavigator';
import SettingsNavigator from './SettingsNavigator';

// Additional Screens
import NotificationCenterScreen from '@/screens/notifications/NotificationCenterScreen';

// Types
import type { TabParamList, MainStackParamList } from '@/types';
import { UI_CONFIG } from '@/constants/config';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

// Tab Navigator Component
const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Inventory':
              iconName = 'inventory';
              break;
            case 'Products':
              iconName = 'category';
              break;
            case 'Reports':
              iconName = 'analytics';
              break;
            case 'Profile':
              iconName = 'person';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: UI_CONFIG.PRIMARY_COLOR,
        tabBarInactiveTintColor: UI_CONFIG.TEXT_SECONDARY,
        tabBarStyle: {
          backgroundColor: UI_CONFIG.SURFACE_COLOR,
          borderTopColor: UI_CONFIG.BORDER_COLOR,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 85 : 65,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
        }}
      />
      
      <Tab.Screen 
        name="Inventory" 
        component={InventoryScreen}
        options={{
          title: 'Inventori',
          tabBarLabel: 'Inventori',
        }}
      />
      
      <Tab.Screen 
        name="Products" 
        component={ProductsScreen}
        options={{
          title: 'Produk',
          tabBarLabel: 'Produk',
        }}
      />
      
      <Tab.Screen 
        name="Reports" 
        component={ReportsScreen}
        options={{
          title: 'Laporan',
          tabBarLabel: 'Laporan',
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
        }}
      />
    </Tab.Navigator>
  );
};

// Main Navigator Component
const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="TabNavigator"
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade',
        gestureEnabled: Platform.OS === 'ios',
      }}
    >
      {/* Main Tab Navigator */}
      <Stack.Screen 
        name="TabNavigator" 
        component={TabNavigator}
        options={{
          gestureEnabled: false, // Prevent going back to auth from main tabs
        }}
      />
      
      {/* Feature Stack Navigators */}
      <Stack.Screen 
        name="InventoryStack" 
        component={InventoryNavigator}
        options={{
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="ProductsStack" 
        component={ProductsNavigator}
        options={{
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="ScannerStack" 
        component={ScannerNavigator}
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false, // Camera screen should not be gestured away
        }}
      />
      
      <Stack.Screen 
        name="ReportsStack" 
        component={ReportsNavigator}
        options={{
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="SettingsStack" 
        component={SettingsNavigator}
        options={{
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen}
        options={{
          title: 'Notifikasi',
          headerShown: true,
          headerStyle: {
            backgroundColor: UI_CONFIG.PRIMARY_COLOR,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 18,
          },
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;