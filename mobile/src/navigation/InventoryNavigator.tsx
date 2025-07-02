/**
 * Inventory Navigator - Inventory Feature Stack Navigation
 * Mengelola navigasi untuk fitur inventory management
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Screens
import InventoryListScreen from '@/screens/inventory/InventoryListScreen';
import InventoryDetailScreen from '@/screens/inventory/InventoryDetailScreen';
import StockAdjustmentScreen from '@/screens/inventory/StockAdjustmentScreen';
import StockTransferScreen from '@/screens/inventory/StockTransferScreen';
import LocationManagementScreen from '@/screens/inventory/LocationManagementScreen';

// Types
import type { InventoryStackParamList } from '@/types';
import { UI_CONFIG } from '@/constants/config';

const Stack = createNativeStackNavigator<InventoryStackParamList>();

const InventoryNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="InventoryList"
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
        name="InventoryList" 
        component={InventoryListScreen}
        options={{
          title: 'Daftar Inventori',
          headerLargeTitle: true,
        }}
      />
      
      <Stack.Screen 
        name="InventoryDetail" 
        component={InventoryDetailScreen}
        options={{
          title: 'Detail Inventori',
          headerBackTitle: 'Kembali',
        }}
      />
      
      <Stack.Screen 
        name="StockAdjustment" 
        component={StockAdjustmentScreen}
        options={{
          title: 'Penyesuaian Stok',
          headerBackTitle: 'Batal',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="StockTransfer" 
        component={StockTransferScreen}
        options={{
          title: 'Transfer Stok',
          headerBackTitle: 'Batal',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="LocationManagement" 
        component={LocationManagementScreen}
        options={{
          title: 'Kelola Lokasi',
          headerBackTitle: 'Kembali',
        }}
      />
    </Stack.Navigator>
  );
};

export default InventoryNavigator;