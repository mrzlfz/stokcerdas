/**
 * Stock Adjustment Screen Component
 * Form penyesuaian stok dengan real-time validation
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Components
import TextInput from '@/components/common/TextInput';
import Button from '@/components/common/Button';

// API Hooks
import { 
  useGetProductsQuery,
  useGetLocationsQuery,
  useGetInventoryItemQuery,
  useAdjustStockMutation,
  useGetProductByBarcodeQuery,
  useGetProductBySkuQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { Product, InventoryLocation, InventoryItem } from '@/types';

type StockAdjustmentRouteParams = {
  StockAdjustment: {
    productId?: string;
    locationId?: string;
  };
};

type StockAdjustmentRouteProp = RouteProp<StockAdjustmentRouteParams, 'StockAdjustment'>;

interface StockAdjustmentFormData {
  productId: string;
  locationId: string;
  quantityChange: number;
  reasonCode: string;
  notes?: string;
  costPrice?: number;
}

// Validation schema
const adjustmentSchema = yup.object({
  productId: yup.string().required('Produk wajib dipilih'),
  locationId: yup.string().required('Lokasi wajib dipilih'),
  quantityChange: yup
    .number()
    .typeError('Jumlah perubahan harus berupa angka')
    .notOneOf([0], 'Jumlah perubahan tidak boleh 0')
    .required('Jumlah perubahan wajib diisi'),
  reasonCode: yup.string().required('Alasan adjustment wajib dipilih'),
  notes: yup.string(),
  costPrice: yup.number().min(0, 'Harga beli tidak boleh negatif'),
});

// Reason codes for stock adjustment
const REASON_CODES = [
  { value: 'stock_count', label: 'Physical Count' },
  { value: 'damaged', label: 'Barang Rusak' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'theft', label: 'Kehilangan/Pencurian' },
  { value: 'found', label: 'Barang Ditemukan' },
  { value: 'supplier_return', label: 'Return ke Supplier' },
  { value: 'customer_return', label: 'Return dari Customer' },
  { value: 'system_error', label: 'Koreksi Sistem' },
  { value: 'other', label: 'Lainnya' },
];

interface ProductSelectorProps {
  selectedProduct: Product | null;
  onProductSelect: (product: Product) => void;
  onScanPress: () => void;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  selectedProduct,
  onProductSelect,
  onScanPress,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: productsData } = useGetProductsQuery(
    { search: searchQuery, limit: 10 },
    { skip: !showSearch || searchQuery.length < 2 }
  );

  const products = productsData?.data?.products || [];

  if (selectedProduct) {
    return (
      <View style={styles.selectedItem}>
        <View style={styles.selectedItemInfo}>
          <Text style={styles.selectedItemName}>{selectedProduct.name}</Text>
          <Text style={styles.selectedItemSku}>SKU: {selectedProduct.sku}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSearch(true)}>
          <Icon name="edit" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.selectorContainer}>
      <View style={styles.selectorHeader}>
        <TextInput
          placeholder="Cari produk atau scan barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setShowSearch(true)}
          leftIcon="search"
          rightIcon="qr-code-scanner"
          onRightIconPress={onScanPress}
          style={styles.searchInput}
        />
      </View>

      {showSearch && products.length > 0 && (
        <View style={styles.searchResults}>
          {products.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productItem}
              onPress={() => {
                onProductSelect(product);
                setShowSearch(false);
                setSearchQuery('');
              }}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productSku}>SKU: {product.sku}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={UI_CONFIG.TEXT_SECONDARY} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

interface LocationSelectorProps {
  selectedLocation: InventoryLocation | null;
  onLocationSelect: (location: InventoryLocation) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocation,
  onLocationSelect,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { data: locationsData } = useGetLocationsQuery({});
  const locations = locationsData?.data || [];

  if (selectedLocation) {
    return (
      <TouchableOpacity
        style={styles.selectedItem}
        onPress={() => setShowDropdown(true)}
      >
        <View style={styles.selectedItemInfo}>
          <Text style={styles.selectedItemName}>{selectedLocation.name}</Text>
          <Text style={styles.selectedItemSku}>Code: {selectedLocation.code}</Text>
        </View>
        <Icon name="arrow-drop-down" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.selectorContainer}>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setShowDropdown(true)}
      >
        <Text style={styles.selectorButtonText}>Pilih Lokasi</Text>
        <Icon name="arrow-drop-down" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
      </TouchableOpacity>

      {showDropdown && (
        <View style={styles.dropdown}>
          {locations.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={styles.dropdownItem}
              onPress={() => {
                onLocationSelect(location);
                setShowDropdown(false);
              }}
            >
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{location.name}</Text>
                <Text style={styles.locationCode}>Code: {location.code}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={UI_CONFIG.TEXT_SECONDARY} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const StockAdjustmentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<StockAdjustmentRouteProp>();
  const { productId: initialProductId, locationId: initialLocationId } = route.params || {};

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | null>(null);
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  // API mutations
  const [adjustStock, { isLoading: isAdjusting }] = useAdjustStockMutation();

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<StockAdjustmentFormData>({
    resolver: yupResolver(adjustmentSchema),
    mode: 'onChange',
    defaultValues: {
      quantityChange: 0,
      reasonCode: '',
      notes: '',
    },
  });

  const watchedQuantityChange = watch('quantityChange');

  // Get current inventory item when product and location are selected
  const { data: inventoryData } = useGetInventoryItemQuery(
    {
      productId: selectedProduct?.id || '',
      locationId: selectedLocation?.id || '',
    },
    {
      skip: !selectedProduct?.id || !selectedLocation?.id,
    }
  );

  // Update current stock when inventory data changes
  useEffect(() => {
    if (inventoryData?.data) {
      setCurrentStock(inventoryData.data.quantityOnHand);
    } else if (selectedProduct && selectedLocation) {
      // If no inventory item exists, current stock is 0
      setCurrentStock(0);
    }
  }, [inventoryData, selectedProduct, selectedLocation]);

  // Set form values when product/location are selected
  useEffect(() => {
    if (selectedProduct) {
      setValue('productId', selectedProduct.id);
    }
  }, [selectedProduct, setValue]);

  useEffect(() => {
    if (selectedLocation) {
      setValue('locationId', selectedLocation.id);
    }
  }, [selectedLocation, setValue]);

  // Handlers
  const handleScanBarcode = useCallback(() => {
    navigation.navigate('ScannerStack', {
      screen: 'BarcodeScanner',
      params: { mode: 'stock_adjustment' },
    } as never);
  }, [navigation]);

  const onSubmit = useCallback(async (data: StockAdjustmentFormData) => {
    if (!selectedProduct || !selectedLocation) {
      Alert.alert('Error', 'Produk dan lokasi harus dipilih');
      return;
    }

    try {
      const result = await adjustStock({
        productId: data.productId,
        locationId: data.locationId,
        quantityChange: data.quantityChange,
        reasonCode: data.reasonCode,
        notes: data.notes,
        costPrice: data.costPrice,
      }).unwrap();

      Alert.alert(
        'Berhasil',
        'Stock adjustment berhasil disimpan',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              reset();
              setSelectedProduct(null);
              setSelectedLocation(null);
              setCurrentStock(null);
              
              // Navigate back or to specific screen
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.data?.message || 'Gagal menyimpan stock adjustment'
      );
    }
  }, [selectedProduct, selectedLocation, adjustStock, reset, navigation]);

  const getNewStockLevel = () => {
    if (currentStock === null || !watchedQuantityChange) return null;
    return currentStock + watchedQuantityChange;
  };

  const getStockChangeColor = () => {
    if (!watchedQuantityChange) return UI_CONFIG.TEXT_SECONDARY;
    return watchedQuantityChange > 0 ? UI_CONFIG.SUCCESS_COLOR : '#F44336';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Stock Adjustment</Text>
            <Text style={styles.subtitle}>
              Lakukan penyesuaian stok untuk produk dan lokasi tertentu
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Product Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Produk *</Text>
              <ProductSelector
                selectedProduct={selectedProduct}
                onProductSelect={setSelectedProduct}
                onScanPress={handleScanBarcode}
              />
              {errors.productId && (
                <Text style={styles.errorText}>{errors.productId.message}</Text>
              )}
            </View>

            {/* Location Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Lokasi *</Text>
              <LocationSelector
                selectedLocation={selectedLocation}
                onLocationSelect={setSelectedLocation}
              />
              {errors.locationId && (
                <Text style={styles.errorText}>{errors.locationId.message}</Text>
              )}
            </View>

            {/* Current Stock Info */}
            {currentStock !== null && (
              <View style={styles.stockInfo}>
                <View style={styles.stockInfoRow}>
                  <Text style={styles.stockInfoLabel}>Stok Saat Ini:</Text>
                  <Text style={styles.stockInfoValue}>{currentStock} unit</Text>
                </View>
                
                {getNewStockLevel() !== null && (
                  <View style={styles.stockInfoRow}>
                    <Text style={styles.stockInfoLabel}>Stok Setelah Adjustment:</Text>
                    <Text style={[styles.stockInfoValue, { color: getStockChangeColor() }]}>
                      {getNewStockLevel()} unit
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Quantity Change */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Perubahan Jumlah *</Text>
              <Controller
                control={control}
                name="quantityChange"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    placeholder="Masukkan perubahan jumlah (+ untuk menambah, - untuk mengurangi)"
                    value={value?.toString() || ''}
                    onChangeText={(text) => {
                      const numValue = parseInt(text) || 0;
                      onChange(numValue);
                    }}
                    onBlur={onBlur}
                    error={errors.quantityChange?.message}
                    keyboardType="numeric"
                    leftIcon={watchedQuantityChange > 0 ? 'add' : 'remove'}
                  />
                )}
              />
            </View>

            {/* Reason Code */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Alasan Adjustment *</Text>
              <Controller
                control={control}
                name="reasonCode"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.reasonSelector}>
                    {REASON_CODES.map((reason) => (
                      <TouchableOpacity
                        key={reason.value}
                        style={[
                          styles.reasonOption,
                          value === reason.value && styles.reasonOptionSelected,
                        ]}
                        onPress={() => onChange(reason.value)}
                      >
                        <Text
                          style={[
                            styles.reasonOptionText,
                            value === reason.value && styles.reasonOptionTextSelected,
                          ]}
                        >
                          {reason.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
              {errors.reasonCode && (
                <Text style={styles.errorText}>{errors.reasonCode.message}</Text>
              )}
            </View>

            {/* Cost Price (Optional) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Harga Beli (Opsional)</Text>
              <Controller
                control={control}
                name="costPrice"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    placeholder="Masukkan harga beli per unit"
                    value={value?.toString() || ''}
                    onChangeText={(text) => {
                      const numValue = parseFloat(text) || undefined;
                      onChange(numValue);
                    }}
                    onBlur={onBlur}
                    error={errors.costPrice?.message}
                    keyboardType="numeric"
                    leftIcon="attach-money"
                  />
                )}
              />
            </View>

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Catatan</Text>
              <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    placeholder="Tambahkan catatan atau keterangan tambahan"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    multiline
                    numberOfLines={3}
                    leftIcon="note"
                  />
                )}
              />
            </View>

            {/* Submit Button */}
            <Button
              title="Simpan Adjustment"
              onPress={handleSubmit(onSubmit)}
              loading={isAdjusting}
              disabled={!isValid || isAdjusting}
              style={styles.submitButton}
            />
          </View>

          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 22,
  },
  form: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
  selectorContainer: {
    position: 'relative',
  },
  selectorHeader: {
    marginBottom: 8,
  },
  searchInput: {
    marginBottom: 0,
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: UI_CONFIG.BORDER_COLOR,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  selectorButtonText: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  selectedItemInfo: {
    flex: 1,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  selectedItemSku: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: UI_CONFIG.BORDER_COLOR,
    borderRadius: 8,
    maxHeight: 200,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: UI_CONFIG.BORDER_COLOR,
    borderRadius: 8,
    maxHeight: 200,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  productSku: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  locationCode: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  stockInfo: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  stockInfoLabel: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  stockInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  reasonSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: UI_CONFIG.BORDER_COLOR,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  reasonOptionSelected: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
  },
  reasonOptionText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  reasonOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 24,
  },
  bottomSpacing: {
    height: 24,
  },
});

export default StockAdjustmentScreen;