/**
 * Scan Result Screen Component
 * Memproses hasil scan dan mengarahkan ke workflow yang sesuai
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Components
import Button from '@/components/common/Button';

// API Hooks
import {
  useGetProductByBarcodeQuery,
  useGetProductBySkuQuery,
  useGetInventoryItemsQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { ScannerStackParamList, Product, InventoryItem } from '@/types';

type ScanResultRouteProp = RouteProp<ScannerStackParamList, 'ScanResult'>;

const ScanResultScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ScanResultRouteProp>();
  const { 
    barcode, 
    mode, 
    locationId,
    isManualEntry = false,
    searchType = 'barcode',
  } = route.params || {};
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  // API Queries
  const {
    data: productByBarcode,
    isLoading: loadingBarcode,
    error: barcodeError,
  } = useGetProductByBarcodeQuery(barcode, {
    skip: !barcode || searchType !== 'barcode',
  });
  
  const {
    data: productBySku,
    isLoading: loadingSku,
    error: skuError,
  } = useGetProductBySkuQuery(barcode, {
    skip: !barcode || searchType !== 'sku',
  });
  
  const {
    data: inventoryData,
    isLoading: loadingInventory,
    refetch: refetchInventory,
  } = useGetInventoryItemsQuery(
    { productId: foundProduct?.id || '' },
    { skip: !foundProduct?.id }
  );
  
  const isLoading = loadingBarcode || loadingSku || loadingInventory;
  const searchError = barcodeError || skuError;
  
  // Process the scan result
  useEffect(() => {
    let product: Product | null = null;
    
    if (productByBarcode?.data) {
      product = productByBarcode.data;
    } else if (productBySku?.data) {
      product = productBySku.data;
    }
    
    if (product) {
      setFoundProduct(product);
      // Success vibration
      Vibration.vibrate([100, 50, 100]);
    } else if (!isLoading && (barcodeError || skuError)) {
      // Error vibration
      Vibration.vibrate([200, 100, 200, 100, 200]);
    }
    
    setIsProcessing(isLoading);
  }, [productByBarcode, productBySku, isLoading, barcodeError, skuError]);
  
  // Set inventory items when data is loaded
  useEffect(() => {
    if (inventoryData?.data?.items) {
      setInventoryItems(inventoryData.data.items);
    }
  }, [inventoryData]);
  
  // Navigation handlers based on mode
  const handleProductLookup = useCallback(() => {
    if (foundProduct) {
      navigation.navigate('ProductsStack', {
        screen: 'ProductDetail',
        params: { productId: foundProduct.id },
      } as never);
    }
  }, [navigation, foundProduct]);
  
  const handleStockAdjustment = useCallback(() => {
    if (foundProduct) {
      navigation.navigate('InventoryStack', {
        screen: 'StockAdjustment',
        params: { 
          productId: foundProduct.id,
          locationId: locationId,
        },
      } as never);
    }
  }, [navigation, foundProduct, locationId]);
  
  const handleStockTransfer = useCallback(() => {
    if (foundProduct) {
      navigation.navigate('InventoryStack', {
        screen: 'StockTransfer',
        params: { 
          productId: foundProduct.id,
        },
      } as never);
    }
  }, [navigation, foundProduct]);
  
  const handleScanAnother = useCallback(() => {
    navigation.navigate('BarcodeScanner', { mode } as never);
  }, [navigation, mode]);
  
  const handleManualEntry = useCallback(() => {
    navigation.navigate('ManualEntry', { mode } as never);
  }, [navigation, mode]);
  
  const handleCreateProduct = useCallback(() => {
    navigation.navigate('ProductsStack', {
      screen: 'ProductCreate',
      params: { prefillBarcode: barcode },
    } as never);
  }, [navigation, barcode]);
  
  const handleClose = useCallback(() => {
    navigation.navigate('TabNavigator' as never);
  }, [navigation]);
  
  // Utility functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };
  
  const getTotalStock = () => {
    return inventoryItems.reduce((total, item) => total + item.quantityOnHand, 0);
  };
  
  const getStockStatusColor = (quantity: number, reorderPoint: number = 10) => {
    if (quantity === 0) return '#F44336';
    if (quantity <= reorderPoint) return '#FF9800';
    return UI_CONFIG.SUCCESS_COLOR;
  };
  
  const getModeTitle = () => {
    switch (mode) {
      case 'product_lookup':
        return 'Detail Produk';
      case 'stock_adjustment':
        return 'Stock Adjustment';
      case 'stock_transfer':
        return 'Transfer Stock';
      default:
        return 'Hasil Scan';
    }
  };
  
  const getActionButton = () => {
    if (!foundProduct) return null;
    
    switch (mode) {
      case 'product_lookup':
        return (
          <Button
            title="Lihat Detail Produk"
            onPress={handleProductLookup}
            leftIcon="visibility"
            style={styles.actionButton}
          />
        );
      case 'stock_adjustment':
        return (
          <Button
            title="Lakukan Adjustment"
            onPress={handleStockAdjustment}
            leftIcon="tune"
            style={styles.actionButton}
          />
        );
      case 'stock_transfer':
        return (
          <Button
            title="Transfer Stock"
            onPress={handleStockTransfer}
            leftIcon="swap-horiz"
            style={styles.actionButton}
          />
        );
      default:
        return (
          <Button
            title="Lihat Detail"
            onPress={handleProductLookup}
            leftIcon="visibility"
            style={styles.actionButton}
          />
        );
    }
  };
  
  // Render loading state
  if (isProcessing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={UI_CONFIG.PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Mencari produk...</Text>
          <Text style={styles.scanCodeText}>
            {isManualEntry ? 'Input Manual' : 'Scan Code'}: {barcode}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render product found state
  if (foundProduct) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Icon name="close" size={24} color={UI_CONFIG.TEXT_SECONDARY} />
            </TouchableOpacity>
            <Text style={styles.title}>{getModeTitle()}</Text>
            <View style={styles.placeholder} />
          </View>
          
          {/* Success Indicator */}
          <View style={styles.successIndicator}>
            <Icon name="check-circle" size={48} color={UI_CONFIG.SUCCESS_COLOR} />
            <Text style={styles.successTitle}>Produk Ditemukan!</Text>
            <Text style={styles.scanInfo}>
              {isManualEntry ? 'Input Manual' : 'Hasil Scan'}: {barcode}
            </Text>
          </View>
          
          {/* Product Information */}
          <View style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.productImageContainer}>
                {foundProduct.imageUrl ? (
                  <Image 
                    source={{ uri: foundProduct.imageUrl }} 
                    style={styles.productImage}
                  />
                ) : (
                  <View style={[styles.productImage, styles.placeholderImage]}>
                    <Icon name="inventory" size={32} color={UI_CONFIG.TEXT_SECONDARY} />
                  </View>
                )}
              </View>
              
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{foundProduct.name}</Text>
                <Text style={styles.productSku}>SKU: {foundProduct.sku}</Text>
                {foundProduct.category && (
                  <Text style={styles.productCategory}>{foundProduct.category.name}</Text>
                )}
                <Text style={styles.productPrice}>
                  {formatCurrency(foundProduct.price || 0)}
                </Text>
              </View>
            </View>
            
            {/* Stock Information */}
            {inventoryItems.length > 0 && (
              <View style={styles.stockSection}>
                <Text style={styles.stockTitle}>Informasi Stok</Text>
                <View style={styles.stockSummary}>
                  <View style={styles.stockItem}>
                    <Text style={styles.stockLabel}>Total Stok</Text>
                    <Text style={styles.stockValue}>{getTotalStock()} unit</Text>
                  </View>
                  <View style={styles.stockItem}>
                    <Text style={styles.stockLabel}>Lokasi</Text>
                    <Text style={styles.stockValue}>{inventoryItems.length}</Text>
                  </View>
                </View>
                
                {/* Stock by Location */}
                <View style={styles.stockLocations}>
                  {inventoryItems.slice(0, 3).map((item, index) => (
                    <View key={index} style={styles.locationItem}>
                      <Text style={styles.locationName}>{item.location?.name}</Text>
                      <View style={styles.locationStock}>
                        <Text 
                          style={[
                            styles.locationQuantity,
                            { color: getStockStatusColor(item.quantityOnHand, item.reorderPoint || 10) }
                          ]}
                        >
                          {item.quantityOnHand}
                        </Text>
                        <Text style={styles.locationUnit}>unit</Text>
                      </View>
                    </View>
                  ))}
                  {inventoryItems.length > 3 && (
                    <Text style={styles.moreLocations}>
                      +{inventoryItems.length - 3} lokasi lainnya
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actions}>
            {getActionButton()}
            
            <View style={styles.secondaryActions}>
              <Button
                title="Scan Lagi"
                onPress={handleScanAnother}
                variant="outline"
                leftIcon="qr-code-scanner"
                style={styles.secondaryButton}
              />
              <Button
                title="Input Manual"
                onPress={handleManualEntry}
                variant="outline"
                leftIcon="keyboard"
                style={styles.secondaryButton}
              />
            </View>
          </View>
          
          {/* Bottom spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    );
  }
  
  // Render product not found state
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color={UI_CONFIG.TEXT_SECONDARY} />
          </TouchableOpacity>
          <Text style={styles.title}>Hasil Scan</Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* Not Found Indicator */}
        <View style={styles.notFoundContainer}>
          <Icon name="search-off" size={80} color="#F44336" />
          <Text style={styles.notFoundTitle}>Produk Tidak Ditemukan</Text>
          <Text style={styles.notFoundDescription}>
            Produk dengan {searchType === 'barcode' ? 'barcode' : 'SKU'} 
            "<Text style={styles.scanCode}>{barcode}</Text>" 
            tidak ditemukan dalam sistem.
          </Text>
          
          {searchError && (
            <View style={styles.errorContainer}>
              <Icon name="error" size={16} color="#F44336" />
              <Text style={styles.errorText}>
                Error: {(searchError as any)?.data?.message || 'Terjadi kesalahan saat mencari produk'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Suggestions */}
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Apa yang ingin Anda lakukan?</Text>
          
          <TouchableOpacity style={styles.suggestionItem} onPress={handleCreateProduct}>
            <Icon name="add-box" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionTitle}>Buat Produk Baru</Text>
              <Text style={styles.suggestionDescription}>
                Tambahkan produk baru dengan kode: {barcode}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={UI_CONFIG.TEXT_SECONDARY} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.suggestionItem} onPress={handleScanAnother}>
            <Icon name="qr-code-scanner" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionTitle}>Scan Produk Lain</Text>
              <Text style={styles.suggestionDescription}>
                Coba scan barcode produk yang berbeda
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={UI_CONFIG.TEXT_SECONDARY} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.suggestionItem} onPress={handleManualEntry}>
            <Icon name="keyboard" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
            <View style={styles.suggestionContent}>
              <Text style={styles.suggestionTitle}>Coba Input Manual</Text>
              <Text style={styles.suggestionDescription}>
                Masukkan barcode atau SKU secara manual
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={UI_CONFIG.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>
        
        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 18,
    color: UI_CONFIG.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  scanCodeText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    fontFamily: 'monospace',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  placeholder: {
    width: 40,
  },
  successIndicator: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginTop: 12,
    marginBottom: 4,
  },
  scanInfo: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    fontFamily: 'monospace',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
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
  productHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  productImageContainer: {
    marginRight: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 4,
  },
  productSku: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.PRIMARY_COLOR,
  },
  stockSection: {
    borderTopWidth: 1,
    borderTopColor: UI_CONFIG.BORDER_COLOR,
    paddingTop: 16,
  },
  stockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 12,
  },
  stockSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  stockItem: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  stockLocations: {
    gap: 8,
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  locationName: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_PRIMARY,
    fontWeight: '500',
  },
  locationStock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  locationQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationUnit: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  moreLocations: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actions: {
    paddingHorizontal: 16,
  },
  actionButton: {
    marginBottom: 16,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
  },
  notFoundContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 12,
  },
  notFoundDescription: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
  },
  scanCode: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    flex: 1,
  },
  suggestions: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
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
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
    gap: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  suggestionDescription: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 24,
  },
});

export default ScanResultScreen;