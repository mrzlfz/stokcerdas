// Script untuk membuat placeholder screens
const fs = require('fs');
const path = require('path');

const screens = [
  // Products screens
  { path: 'products/ProductsScreen.tsx', title: 'Products', subtitle: 'Halaman product management akan diimplementasikan di sini' },
  { path: 'products/ProductListScreen.tsx', title: 'Product List', subtitle: 'Daftar produk akan ditampilkan di sini' },
  { path: 'products/ProductDetailScreen.tsx', title: 'Product Detail', subtitle: 'Detail produk akan ditampilkan di sini' },
  { path: 'products/ProductCreateScreen.tsx', title: 'Create Product', subtitle: 'Form tambah produk akan diimplementasikan di sini' },
  { path: 'products/ProductEditScreen.tsx', title: 'Edit Product', subtitle: 'Form edit produk akan diimplementasikan di sini' },
  { path: 'products/CategoryManagementScreen.tsx', title: 'Category Management', subtitle: 'Manajemen kategori produk akan diimplementasikan di sini' },
  
  // Inventory screens
  { path: 'inventory/InventoryListScreen.tsx', title: 'Inventory List', subtitle: 'Daftar inventory akan ditampilkan di sini' },
  { path: 'inventory/InventoryDetailScreen.tsx', title: 'Inventory Detail', subtitle: 'Detail inventory akan ditampilkan di sini' },
  { path: 'inventory/StockAdjustmentScreen.tsx', title: 'Stock Adjustment', subtitle: 'Form penyesuaian stok akan diimplementasikan di sini' },
  { path: 'inventory/StockTransferScreen.tsx', title: 'Stock Transfer', subtitle: 'Form transfer stok akan diimplementasikan di sini' },
  { path: 'inventory/LocationManagementScreen.tsx', title: 'Location Management', subtitle: 'Manajemen lokasi akan diimplementasikan di sini' },
  
  // Reports screens
  { path: 'reports/ReportsScreen.tsx', title: 'Reports', subtitle: 'Halaman laporan akan diimplementasikan di sini' },
  { path: 'reports/ReportDashboardScreen.tsx', title: 'Report Dashboard', subtitle: 'Dashboard laporan akan diimplementasikan di sini' },
  { path: 'reports/InventoryReportScreen.tsx', title: 'Inventory Report', subtitle: 'Laporan inventory akan diimplementasikan di sini' },
  { path: 'reports/StockMovementReportScreen.tsx', title: 'Stock Movement Report', subtitle: 'Laporan pergerakan stok akan diimplementasikan di sini' },
  { path: 'reports/LowStockReportScreen.tsx', title: 'Low Stock Report', subtitle: 'Laporan stok rendah akan diimplementasikan di sini' },
  
  // Profile screens
  { path: 'profile/ProfileScreen.tsx', title: 'Profile', subtitle: 'Halaman profil user akan diimplementasikan di sini' },
  
  // Scanner screens
  { path: 'scanner/BarcodeScannerScreen.tsx', title: 'Barcode Scanner', subtitle: 'Scanner barcode akan diimplementasikan di sini' },
  { path: 'scanner/ManualEntryScreen.tsx', title: 'Manual Entry', subtitle: 'Input manual akan diimplementasikan di sini' },
  { path: 'scanner/ScanResultScreen.tsx', title: 'Scan Result', subtitle: 'Hasil scan akan ditampilkan di sini' },
  
  // Settings screens
  { path: 'settings/SettingsScreen.tsx', title: 'Settings', subtitle: 'Pengaturan aplikasi akan diimplementasikan di sini' },
  { path: 'settings/AccountSettingsScreen.tsx', title: 'Account Settings', subtitle: 'Pengaturan akun akan diimplementasikan di sini' },
  { path: 'settings/NotificationSettingsScreen.tsx', title: 'Notification Settings', subtitle: 'Pengaturan notifikasi akan diimplementasikan di sini' },
  { path: 'settings/SecuritySettingsScreen.tsx', title: 'Security Settings', subtitle: 'Pengaturan keamanan akan diimplementasikan di sini' },
  { path: 'settings/AboutScreen.tsx', title: 'About', subtitle: 'Tentang aplikasi akan diimplementasikan di sini' },
];

const createScreenTemplate = (title, subtitle) => `/**
 * ${title} Screen Component
 * Placeholder untuk ${title.toLowerCase()}
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI_CONFIG } from '@/constants/config';

const ${title.replace(/\s+/g, '')}Screen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>${title}</Text>
        <Text style={styles.subtitle}>
          ${subtitle}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
  },
});

export default ${title.replace(/\s+/g, '')}Screen;`;

// Create screens
screens.forEach(screen => {
  const screenPath = path.join(__dirname, '..', 'screens', screen.path);
  const screenDir = path.dirname(screenPath);
  
  // Ensure directory exists
  if (!fs.existsSync(screenDir)) {
    fs.mkdirSync(screenDir, { recursive: true });
  }
  
  // Create screen file
  const content = createScreenTemplate(screen.title, screen.subtitle);
  fs.writeFileSync(screenPath, content);
  
  console.log(`Created: ${screen.path}`);
});

console.log('All placeholder screens created successfully!');