/**
 * Internationalization Service
 * Setup untuk multi-language support (Bahasa Indonesia & English)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'react-native-localize';
import { STORAGE_KEYS, APP_CONFIG } from '@/constants/config';

// Language resources
const resources = {
  id: {
    translation: {
      // Auth
      login: 'Masuk',
      logout: 'Keluar',
      register: 'Daftar',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Lupa Password',
      rememberMe: 'Ingat Saya',
      
      // Navigation
      dashboard: 'Dashboard',
      inventory: 'Inventori',
      products: 'Produk',
      reports: 'Laporan',
      profile: 'Profil',
      
      // Common
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Hapus',
      edit: 'Edit',
      create: 'Buat',
      search: 'Cari',
      filter: 'Filter',
      loading: 'Memuat...',
      error: 'Terjadi kesalahan',
      success: 'Berhasil',
      
      // Inventory
      stock: 'Stok',
      quantity: 'Jumlah',
      location: 'Lokasi',
      adjustment: 'Penyesuaian',
      transfer: 'Transfer',
      lowStock: 'Stok Rendah',
      outOfStock: 'Stok Habis',
      
      // Products
      product: 'Produk',
      category: 'Kategori',
      sku: 'SKU',
      barcode: 'Barcode',
      price: 'Harga',
      
      // Time
      today: 'Hari ini',
      yesterday: 'Kemarin',
      thisWeek: 'Minggu ini',
      thisMonth: 'Bulan ini',
    },
  },
  en: {
    translation: {
      // Auth
      login: 'Login',
      logout: 'Logout',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password',
      rememberMe: 'Remember Me',
      
      // Navigation
      dashboard: 'Dashboard',
      inventory: 'Inventory',
      products: 'Products',
      reports: 'Reports',
      profile: 'Profile',
      
      // Common
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      error: 'An error occurred',
      success: 'Success',
      
      // Inventory
      stock: 'Stock',
      quantity: 'Quantity',
      location: 'Location',
      adjustment: 'Adjustment',
      transfer: 'Transfer',
      lowStock: 'Low Stock',
      outOfStock: 'Out of Stock',
      
      // Products
      product: 'Product',
      category: 'Category',
      sku: 'SKU',
      barcode: 'Barcode',
      price: 'Price',
      
      // Time
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
    },
  },
};

// Detect device language
const getDeviceLanguage = (): string => {
  const locales = getLocales();
  const deviceLanguage = locales[0]?.languageCode || 'id';
  
  // Check if device language is supported
  if (APP_CONFIG.SUPPORTED_LANGUAGES.includes(deviceLanguage)) {
    return deviceLanguage;
  }
  
  return APP_CONFIG.DEFAULT_LANGUAGE;
};

// Get stored language or device language
const getStoredLanguage = async (): Promise<string> => {
  try {
    const storedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    return storedLanguage || getDeviceLanguage();
  } catch (error) {
    console.warn('Failed to get stored language:', error);
    return getDeviceLanguage();
  }
};

// Initialize i18n
const initI18n = async () => {
  const language = await getStoredLanguage();
  
  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: APP_CONFIG.DEFAULT_LANGUAGE,
      
      // Interpolation options
      interpolation: {
        escapeValue: false, // React already escapes
      },
      
      // React options
      react: {
        useSuspense: false,
      },
      
      // Debug mode (only in development)
      debug: __DEV__,
    });
  
  console.log('i18n initialized with language:', language);
};

// Change language function
export const changeLanguage = async (language: string): Promise<void> => {
  try {
    await i18n.changeLanguage(language);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    console.log('Language changed to:', language);
  } catch (error) {
    console.error('Failed to change language:', error);
  }
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || APP_CONFIG.DEFAULT_LANGUAGE;
};

// Check if language is RTL
export const isRTL = (): boolean => {
  // Indonesian and English are LTR languages
  return false;
};

// Initialize on import
initI18n();

export default i18n;