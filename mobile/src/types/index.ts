/**
 * TypeScript Type Definitions untuk StokCerdas Mobile
 * Semua interface dan type definitions yang digunakan dalam aplikasi
 */

// === API Response Types ===
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    path: string;
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    path: string;
  };
}

// === Authentication Types ===
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  companyName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// === User Types ===
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  language: string;
  timezone: string;
  tenantId: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

// === Product Types ===
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: ProductCategory;
  sellingPrice: number;
  costPrice?: number;
  reorderPoint?: number;
  trackInventory: boolean;
  isActive: boolean;
  barcode?: string;
  imageUrl?: string;
  weight?: number;
  dimensions?: ProductDimensions;
  variants?: ProductVariant[];
  tags?: string[];
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: ProductCategory;
  children?: ProductCategory[];
  sortOrder: number;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  attributes: VariantAttribute[];
  sellingPrice?: number;
  costPrice?: number;
  barcode?: string;
  imageUrl?: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariantAttribute {
  name: string;
  value: string;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit: 'cm' | 'inch';
}

// === Inventory Types ===
export interface InventoryItem {
  id: string;
  productId: string;
  product?: Product;
  locationId: string;
  location?: InventoryLocation;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAllocated: number;
  quantityAvailable: number;
  averageCost: number;
  totalValue: number;
  reorderPoint?: number;
  maxStockLevel?: number;
  lotNumber?: string;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  manufacturingDate?: string;
  notes?: string;
  isActive: boolean;
  lastMovementAt?: string;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: LocationType;
  parentId?: string;
  parent?: InventoryLocation;
  children?: InventoryLocation[];
  address?: LocationAddress;
  latitude?: number;
  longitude?: number;
  totalArea?: number;
  usableArea?: number;
  status: LocationStatus;
  sortOrder: number;
  isActive: boolean;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export enum LocationType {
  WAREHOUSE = 'warehouse',
  STORE = 'store',
  VIRTUAL = 'virtual',
  STAGING = 'staging',
  DAMAGED = 'damaged',
  QUARANTINE = 'quarantine',
}

export enum LocationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

export interface LocationAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  type: TransactionType;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  unitCost?: number;
  totalCost?: number;
  reason: TransactionReason;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
  isReversed: boolean;
  reversedTransactionId?: string;
  tenantId: string;
  createdBy: string;
  createdAt: string;
}

export enum TransactionType {
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  SALE = 'sale',
  PURCHASE = 'purchase',
  RETURN = 'return',
  RESERVATION = 'reservation',
  ALLOCATION = 'allocation',
  PRODUCTION = 'production',
  DAMAGE = 'damage',
  LOSS = 'loss',
  FOUND = 'found',
}

export enum TransactionReason {
  STOCK_COUNT = 'stock_count',
  DAMAGED_GOODS = 'damaged_goods',
  EXPIRED_GOODS = 'expired_goods',
  THEFT = 'theft',
  LOSS = 'loss',
  FOUND = 'found',
  RETURN_TO_SUPPLIER = 'return_to_supplier',
  CUSTOMER_RETURN = 'customer_return',
  INTER_LOCATION_TRANSFER = 'inter_location_transfer',
  SALES_ORDER = 'sales_order',
  PURCHASE_ORDER = 'purchase_order',
  PRODUCTION = 'production',
  QUALITY_CONTROL = 'quality_control',
  OTHER = 'other',
}

// === Stock Adjustment Types ===
export interface StockAdjustmentRequest {
  productId: string;
  locationId: string;
  adjustmentType: AdjustmentType;
  quantity: number;
  reason: TransactionReason;
  notes?: string;
  unitCost?: number;
}

export enum AdjustmentType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  COUNT = 'count',
}

export interface BulkStockAdjustmentRequest {
  adjustments: StockAdjustmentRequest[];
}

// === Transfer Types ===
export interface InventoryTransferRequest {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason?: string;
  notes?: string;
}

// === Navigation Types ===
export type RootStackParamList = {
  AuthStack: undefined;
  MainStack: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };
};

export type MainStackParamList = {
  TabNavigator: undefined;
  InventoryStack: undefined;
  ProductsStack: undefined;
  ScannerStack: undefined;
  ReportsStack: undefined;
  SettingsStack: undefined;
  NotificationCenter: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Inventory: undefined;
  Products: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type InventoryStackParamList = {
  InventoryList: undefined;
  InventoryDetail: { itemId: string };
  StockAdjustment: { productId?: string; locationId?: string };
  StockTransfer: { productId?: string; fromLocationId?: string };
  LocationManagement: undefined;
};

export type ProductsStackParamList = {
  ProductList: undefined;
  ProductDetail: { productId: string };
  ProductCreate: { prefillBarcode?: string };
  ProductEdit: { productId: string };
  CategoryManagement: undefined;
};

export type ScannerStackParamList = {
  BarcodeScanner: { 
    mode?: 'product_lookup' | 'product_search' | 'product_verify' | 'stock_adjustment' | 'stock_transfer' | 'batch_scan';
    locationId?: string;
    productId?: string;
    batchMode?: boolean;
  };
  ManualEntry: { 
    mode?: string;
    batchMode?: boolean;
  };
  ScanResult: { 
    barcode: string; 
    product?: Product;
    mode?: string;
    locationId?: string;
    isManualEntry?: boolean;
    searchType?: 'barcode' | 'sku';
    batchMode?: boolean;
  };
  BatchScanList: {
    scannedItems: Array<{
      barcode: string;
      product?: Product;
      timestamp: string;
    }>;
    mode?: string;
  };
};

// === Redux Store Types ===
export interface RootState {
  auth: AuthState;
  inventory: InventoryState;
  products: ProductsState;
  sync: SyncState;
  offline: OfflineState;
  ui: UIState;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  tenantId: string | null;
  permissions: string[];
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;
  rememberMe: boolean;
}

export interface InventoryState {
  items: InventoryItem[];
  locations: InventoryLocation[];
  transactions: InventoryTransaction[];
  selectedLocation: string | null;
  filters: InventoryFilters;
  isLoading: boolean;
  error: string | null;
}

export interface ProductsState {
  items: Product[];
  categories: ProductCategory[];
  selectedCategory: string | null;
  filters: ProductFilters;
  isLoading: boolean;
  error: string | null;
}

export interface SyncState {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingActions: OfflineAction[];
  syncInProgress: boolean;
  syncError: string | null;
}

export interface OfflineState {
  queue: OfflineAction[];
  maxSize: number;
  retryAttempts: number;
}

export interface UIState {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationState;
  loading: LoadingState;
}

// === Filter Types ===
export interface InventoryFilters {
  search?: string;
  locationId?: string;
  categoryId?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  expiringSoon?: boolean;
  expired?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  trackInventory?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// === Offline Types ===
export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  tenantId: string;
  userId: string;
}

// === Notification Types ===
export interface NotificationState {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  badge: boolean;
  categories: {
    [key: string]: boolean;
  };
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  category: string;
  data?: any;
  timestamp: string;
  read: boolean;
  actionable: boolean;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  LOW_STOCK = 'low_stock',
  EXPIRED = 'expired',
  EXPIRING_SOON = 'expiring_soon',
}

// === Loading States ===
export interface LoadingState {
  global: boolean;
  auth: boolean;
  inventory: boolean;
  products: boolean;
  sync: boolean;
  upload: boolean;
}

// === Form Types ===
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  companyName?: string;
  acceptTerms: boolean;
}

export interface ProductFormData {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  sellingPrice: number;
  costPrice?: number;
  reorderPoint?: number;
  trackInventory: boolean;
  isActive: boolean;
  barcode?: string;
  weight?: number;
  dimensions?: ProductDimensions;
  tags?: string[];
}

export interface StockAdjustmentFormData {
  productId: string;
  locationId: string;
  adjustmentType: AdjustmentType;
  quantity: number;
  reason: TransactionReason;
  notes?: string;
  unitCost?: number;
}

// === Utility Types ===
export type OptionalExcept<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;
export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Partial<Pick<T, K>>;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;