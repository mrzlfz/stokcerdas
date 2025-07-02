/**
 * Scanner Navigator - Barcode Scanner Stack Navigation
 * Mengelola navigasi untuk fitur barcode scanning
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Screens
import BarcodeScannerScreen from '@/screens/scanner/BarcodeScannerScreen';
import ManualEntryScreen from '@/screens/scanner/ManualEntryScreen';
import ScanResultScreen from '@/screens/scanner/ScanResultScreen';
import BatchScanListScreen from '@/screens/scanner/BatchScanListScreen';

// Types
import type { ScannerStackParamList } from '@/types';

const Stack = createNativeStackNavigator<ScannerStackParamList>();

const ScannerNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="BarcodeScanner"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#000000',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade',
        gestureEnabled: Platform.OS === 'ios',
        presentation: 'fullScreenModal',
      }}
    >
      <Stack.Screen 
        name="BarcodeScanner" 
        component={BarcodeScannerScreen}
        options={{
          title: 'Scan Barcode',
          headerShown: false, // Camera takes full screen
          gestureEnabled: false, // Prevent accidental swipe while scanning
        }}
      />
      
      <Stack.Screen 
        name="ManualEntry" 
        component={ManualEntryScreen}
        options={{
          title: 'Input Manual',
          headerBackTitle: 'Scanner',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="ScanResult" 
        component={ScanResultScreen}
        options={{
          title: 'Hasil Scan',
          headerBackTitle: 'Scanner',
          gestureEnabled: false, // Prevent going back during processing
        }}
      />
      
      <Stack.Screen 
        name="BatchScanList" 
        component={BatchScanListScreen}
        options={{
          title: 'Batch Scan',
          headerBackTitle: 'Scanner',
        }}
      />
    </Stack.Navigator>
  );
};

export default ScannerNavigator;