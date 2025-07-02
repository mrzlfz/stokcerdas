/**
 * App Configuration Constants
 * Konfigurasi aplikasi untuk StokCerdas Mobile
 */

export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api/v1' 
    : 'https://api.stokcerdas.com/api/v1',
  WEBSOCKET_URL: __DEV__ 
    ? 'ws://localhost:3000/realtime' 
    : 'wss://api.stokcerdas.com/realtime',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@stokcerdas_access_token',
  REFRESH_TOKEN: '@stokcerdas_refresh_token',
  USER_DATA: '@stokcerdas_user_data',
  TENANT_ID: '@stokcerdas_tenant_id',
  LANGUAGE: '@stokcerdas_language',
  OFFLINE_QUEUE: '@stokcerdas_offline_queue',
  SYNC_TIMESTAMP: '@stokcerdas_sync_timestamp',
  BIOMETRIC_ENABLED: '@stokcerdas_biometric',
  REMEMBER_ME: '@stokcerdas_remember_me',
  FCM_TOKEN: '@stokcerdas_fcm_token',
  NOTIFICATION_SETTINGS: '@stokcerdas_notification_settings',
};

export const APP_CONFIG = {
  APP_NAME: 'StokCerdas',
  VERSION: '1.0.0',
  BUILD_NUMBER: '1',
  BUNDLE_ID: 'com.stokcerdas.mobile',
  DEFAULT_LANGUAGE: 'id',
  SUPPORTED_LANGUAGES: ['id', 'en'],
  DEFAULT_TIMEZONE: 'Asia/Jakarta',
  CURRENCY: 'IDR',
  CURRENCY_SYMBOL: 'Rp',
};

export const SYNC_CONFIG = {
  AUTO_SYNC_INTERVAL: 30000, // 30 seconds
  OFFLINE_SYNC_BATCH_SIZE: 50,
  MAX_OFFLINE_ACTIONS: 1000,
  CONFLICT_RESOLUTION_STRATEGY: 'server_wins', // 'server_wins' | 'client_wins' | 'merge'
  SYNC_RETRY_ATTEMPTS: 3,
  SYNC_RETRY_DELAY: 2000, // 2 seconds
};

export const NOTIFICATION_CONFIG = {
  SOUND_ENABLED: true,
  VIBRATION_ENABLED: true,
  BADGE_ENABLED: true,
  LOW_STOCK_THRESHOLD: 5,
  ALERT_CATEGORIES: {
    LOW_STOCK: 'low_stock',
    EXPIRED: 'expired',
    EXPIRING_SOON: 'expiring_soon',
    STOCK_MOVEMENT: 'stock_movement',
    SYSTEM: 'system',
  },
};

export const SECURITY_CONFIG = {
  JWT_EXPIRY_BUFFER: 300000, // 5 minutes before expiry
  SESSION_TIMEOUT: 3600000, // 1 hour
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION: 900000, // 15 minutes
  BIOMETRIC_TIMEOUT: 30000, // 30 seconds
  REQUIRE_PIN_AFTER: 300000, // 5 minutes of inactivity
};

export const UI_CONFIG = {
  PRIMARY_COLOR: '#2E7D32', // Indonesian green
  ACCENT_COLOR: '#FF6F00', // Indonesian orange
  ERROR_COLOR: '#D32F2F',
  WARNING_COLOR: '#F57C00',
  SUCCESS_COLOR: '#388E3C',
  BACKGROUND_COLOR: '#FAFAFA',
  SURFACE_COLOR: '#FFFFFF',
  TEXT_PRIMARY: '#212121',
  TEXT_SECONDARY: '#757575',
  BORDER_COLOR: '#E0E0E0',
};

export const LOCALIZATION = {
  INDONESIAN: {
    CURRENCY_FORMAT: 'Rp #,###',
    DATE_FORMAT: 'DD/MM/YYYY',
    TIME_FORMAT: 'HH:mm',
    DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
    NUMBER_FORMAT: '#,###',
    DECIMAL_SEPARATOR: ',',
    THOUSAND_SEPARATOR: '.',
  },
  ENGLISH: {
    CURRENCY_FORMAT: 'Rp #,###',
    DATE_FORMAT: 'MM/DD/YYYY',
    TIME_FORMAT: 'hh:mm A',
    DATETIME_FORMAT: 'MM/DD/YYYY hh:mm A',
    NUMBER_FORMAT: '#,###',
    DECIMAL_SEPARATOR: '.',
    THOUSAND_SEPARATOR: ',',
  },
};

export const CAMERA_CONFIG = {
  BARCODE_FORMATS: [
    'code128',
    'code39',
    'code93',
    'codabar',
    'ean13',
    'ean8',
    'upc_a',
    'upc_e',
    'qr',
    'pdf417',
  ],
  CAMERA_QUALITY: 0.8,
  SCAN_TIMEOUT: 10000, // 10 seconds
  TORCH_MODE: 'off',
  VIBRATE_ON_SCAN: true,
  BEEP_ON_SCAN: true,
};

export const PERMISSIONS = {
  CAMERA: 'Camera',
  LOCATION: 'Location',
  STORAGE: 'Storage',
  NOTIFICATIONS: 'Notifications',
  BIOMETRIC: 'Biometric',
} as const;

export const ROUTES = {
  // Auth Stack
  AUTH_STACK: 'AuthStack',
  LOGIN: 'Login',
  REGISTER: 'Register',
  FORGOT_PASSWORD: 'ForgotPassword',
  VERIFY_EMAIL: 'VerifyEmail',
  
  // Main App Stack
  MAIN_STACK: 'MainStack',
  TAB_NAVIGATOR: 'TabNavigator',
  
  // Tab Screens
  DASHBOARD: 'Dashboard',
  INVENTORY: 'Inventory',
  PRODUCTS: 'Products',
  REPORTS: 'Reports',
  PROFILE: 'Profile',
  
  // Inventory Stack
  INVENTORY_STACK: 'InventoryStack',
  INVENTORY_LIST: 'InventoryList',
  INVENTORY_DETAIL: 'InventoryDetail',
  STOCK_ADJUSTMENT: 'StockAdjustment',
  STOCK_TRANSFER: 'StockTransfer',
  LOCATION_MANAGEMENT: 'LocationManagement',
  
  // Products Stack
  PRODUCTS_STACK: 'ProductsStack',
  PRODUCT_LIST: 'ProductList',
  PRODUCT_DETAIL: 'ProductDetail',
  PRODUCT_CREATE: 'ProductCreate',
  PRODUCT_EDIT: 'ProductEdit',
  CATEGORY_MANAGEMENT: 'CategoryManagement',
  
  // Scanner Stack
  SCANNER_STACK: 'ScannerStack',
  BARCODE_SCANNER: 'BarcodeScanner',
  MANUAL_ENTRY: 'ManualEntry',
  SCAN_RESULT: 'ScanResult',
  
  // Reports Stack
  REPORTS_STACK: 'ReportsStack',
  REPORT_DASHBOARD: 'ReportDashboard',
  INVENTORY_REPORT: 'InventoryReport',
  STOCK_MOVEMENT_REPORT: 'StockMovementReport',
  LOW_STOCK_REPORT: 'LowStockReport',
  
  // Settings Stack
  SETTINGS_STACK: 'SettingsStack',
  SETTINGS: 'Settings',
  ACCOUNT_SETTINGS: 'AccountSettings',
  NOTIFICATION_SETTINGS: 'NotificationSettings',
  SECURITY_SETTINGS: 'SecuritySettings',
  ABOUT: 'About',
} as const;