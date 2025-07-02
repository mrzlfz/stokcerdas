/**
 * Reports Navigator - Reports Feature Stack Navigation
 * Mengelola navigasi untuk fitur reporting dan analytics
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Screens (akan dibuat nanti)
import ReportDashboardScreen from '@/screens/reports/ReportDashboardScreen';
import InventoryReportScreen from '@/screens/reports/InventoryReportScreen';
import StockMovementReportScreen from '@/screens/reports/StockMovementReportScreen';
import LowStockReportScreen from '@/screens/reports/LowStockReportScreen';

// Types
import { UI_CONFIG } from '@/constants/config';

type ReportsStackParamList = {
  ReportDashboard: undefined;
  InventoryReport: undefined;
  StockMovementReport: undefined;
  LowStockReport: undefined;
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

const ReportsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="ReportDashboard"
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
        name="ReportDashboard" 
        component={ReportDashboardScreen}
        options={{
          title: 'Dashboard Laporan',
          headerLargeTitle: true,
        }}
      />
      
      <Stack.Screen 
        name="InventoryReport" 
        component={InventoryReportScreen}
        options={{
          title: 'Laporan Inventori',
          headerBackTitle: 'Dashboard',
        }}
      />
      
      <Stack.Screen 
        name="StockMovementReport" 
        component={StockMovementReportScreen}
        options={{
          title: 'Laporan Pergerakan Stok',
          headerBackTitle: 'Dashboard',
        }}
      />
      
      <Stack.Screen 
        name="LowStockReport" 
        component={LowStockReportScreen}
        options={{
          title: 'Laporan Stok Rendah',
          headerBackTitle: 'Dashboard',
        }}
      />
    </Stack.Navigator>
  );
};

export default ReportsNavigator;