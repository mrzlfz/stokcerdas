/**
 * Products Navigator - Products Feature Stack Navigation
 * Mengelola navigasi untuk fitur product management
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Screens
import ProductListScreen from '@/screens/products/ProductListScreen';
import ProductDetailScreen from '@/screens/products/ProductDetailScreen';
import ProductCreateScreen from '@/screens/products/ProductCreateScreen';
import ProductEditScreen from '@/screens/products/ProductEditScreen';
import CategoryManagementScreen from '@/screens/products/CategoryManagementScreen';

// Types
import type { ProductsStackParamList } from '@/types';
import { UI_CONFIG } from '@/constants/config';

const Stack = createNativeStackNavigator<ProductsStackParamList>();

const ProductsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="ProductList"
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
        name="ProductList" 
        component={ProductListScreen}
        options={{
          title: 'Daftar Produk',
          headerLargeTitle: true,
        }}
      />
      
      <Stack.Screen 
        name="ProductDetail" 
        component={ProductDetailScreen}
        options={{
          title: 'Detail Produk',
          headerBackTitle: 'Kembali',
        }}
      />
      
      <Stack.Screen 
        name="ProductCreate" 
        component={ProductCreateScreen}
        options={{
          title: 'Tambah Produk',
          headerBackTitle: 'Batal',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="ProductEdit" 
        component={ProductEditScreen}
        options={{
          title: 'Edit Produk',
          headerBackTitle: 'Batal',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      
      <Stack.Screen 
        name="CategoryManagement" 
        component={CategoryManagementScreen}
        options={{
          title: 'Kelola Kategori',
          headerBackTitle: 'Kembali',
        }}
      />
    </Stack.Navigator>
  );
};

export default ProductsNavigator;