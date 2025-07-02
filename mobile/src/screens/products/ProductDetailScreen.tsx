/**
 * Product Detail Screen Component
 * Detail produk dengan inventory info dan quick actions
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Components
import Button from '@/components/common/Button';

// API Hooks
import { 
  useGetProductQuery,
  useGetInventoryItemsQuery,
  useGetProductVariantsQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { Product, InventoryItem, ProductVariant } from '@/types';

type ProductDetailRouteParams = {
  ProductDetail: {
    productId: string;
  };
};

type ProductDetailRouteProp = RouteProp<ProductDetailRouteParams, 'ProductDetail'>;

const { width } = Dimensions.get('window');

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, children }) => (
  <View style={styles.infoCard}>
    <Text style={styles.infoCardTitle}>{title}</Text>
    {children}
  </View>
);

interface InventoryItemRowProps {
  item: InventoryItem;
  onPress: () => void;
}

const InventoryItemRow: React.FC<InventoryItemRowProps> = ({ item, onPress }) => {
  const getStockStatusColor = () => {
    if (item.quantityOnHand === 0) return '#F44336'; // Red for out of stock
    if (item.quantityOnHand <= (item.reorderPoint || 10)) return '#FF9800'; // Orange for low stock
    return UI_CONFIG.SUCCESS_COLOR; // Green for good stock
  };

  const getStockStatusText = () => {
    if (item.quantityOnHand === 0) return 'Stok Habis';
    if (item.quantityOnHand <= (item.reorderPoint || 10)) return 'Stok Rendah';
    return 'Stok Baik';
  };

  return (
    <TouchableOpacity style={styles.inventoryRow} onPress={onPress}>
      <View style={styles.inventoryInfo}>
        <Text style={styles.locationName}>{item.location?.name || 'Unknown Location'}</Text>
        <Text style={styles.locationCode}>{item.location?.code}</Text>
      </View>
      
      <View style={styles.inventoryQuantity}>
        <Text style={styles.quantityValue}>{item.quantityOnHand}</Text>
        <Text style={styles.quantityLabel}>unit</Text>
      </View>
      
      <View style={[styles.stockStatus, { backgroundColor: getStockStatusColor() }]}>
        <Text style={styles.stockStatusText}>{getStockStatusText()}</Text>
      </View>
      
      <Icon name="chevron-right" size={20} color={UI_CONFIG.TEXT_SECONDARY} />
    </TouchableOpacity>
  );
};

const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ProductDetailRouteProp>();
  const { productId } = route.params;
  
  const [refreshing, setRefreshing] = useState(false);

  // API Queries
  const {
    data: productData,
    isLoading: isLoadingProduct,
    error: productError,
    refetch: refetchProduct,
  } = useGetProductQuery(productId);

  const {
    data: inventoryData,
    isLoading: isLoadingInventory,
    refetch: refetchInventory,
  } = useGetInventoryItemsQuery({ productId });

  const {
    data: variantsData,
    isLoading: isLoadingVariants,
    refetch: refetchVariants,
  } = useGetProductVariantsQuery(productId);

  const product = productData?.data;
  const inventoryItems = inventoryData?.data?.items || [];
  const variants = variantsData?.data || [];

  const isLoading = isLoadingProduct || isLoadingInventory || isLoadingVariants;

  // Handlers
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProduct(),
        refetchInventory(),
        refetchVariants(),
      ]);
    } catch (error) {
      Alert.alert('Error', 'Gagal memperbarui data. Silakan coba lagi.');
    } finally {
      setRefreshing(false);
    }
  }, [refetchProduct, refetchInventory, refetchVariants]);

  const handleEditProduct = useCallback(() => {
    navigation.navigate('ProductEdit', { productId } as never);
  }, [navigation, productId]);

  const handleStockAdjustment = useCallback(() => {
    navigation.navigate('InventoryStack', {
      screen: 'StockAdjustment',
      params: { productId },
    } as never);
  }, [navigation, productId]);

  const handleTransferStock = useCallback(() => {
    navigation.navigate('InventoryStack', {
      screen: 'StockTransfer',
      params: { productId },
    } as never);
  }, [navigation, productId]);

  const handleScanBarcode = useCallback(() => {
    navigation.navigate('ScannerStack', {
      screen: 'BarcodeScanner',
      params: { mode: 'product_verify', productId },
    } as never);
  }, [navigation, productId]);

  const handleShareProduct = useCallback(async () => {
    if (!product) return;
    
    try {
      await Share.share({
        message: `${product.name}\nSKU: ${product.sku}\nHarga: ${formatCurrency(product.price || 0)}`,
        title: 'StokCerdas - Detail Produk',
      });
    } catch (error) {
      console.error('Error sharing product:', error);
    }
  }, [product]);

  const handleInventoryItemPress = useCallback((item: InventoryItem) => {
    navigation.navigate('InventoryStack', {
      screen: 'InventoryDetail',
      params: { 
        productId: item.productId, 
        locationId: item.locationId 
      },
    } as never);
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

  const getTotalValue = () => {
    const totalStock = getTotalStock();
    return totalStock * (product?.costPrice || product?.price || 0);
  };

  if (productError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={64} color="#F44336" />
          <Text style={styles.errorTitle}>Produk Tidak Ditemukan</Text>
          <Text style={styles.errorDescription}>
            Produk yang Anda cari tidak ditemukan atau sudah dihapus.
          </Text>
          <Button
            title="Kembali"
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Memuat detail produk...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Product Header */}
        <View style={styles.header}>
          <View style={styles.imageContainer}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.placeholderImage]}>
                <Icon name="inventory" size={64} color={UI_CONFIG.TEXT_SECONDARY} />
              </View>
            )}
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShareProduct}>
              <Icon name="share" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleEditProduct}>
              <Icon name="edit" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productSku}>SKU: {product.sku}</Text>
          
          {product.category && (
            <Text style={styles.productCategory}>{product.category.name}</Text>
          )}
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{formatCurrency(product.price || 0)}</Text>
            {product.costPrice && (
              <Text style={styles.costPrice}>
                Cost: {formatCurrency(product.costPrice)}
              </Text>
            )}
          </View>

          {product.description && (
            <Text style={styles.description}>{product.description}</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="Stock Adjustment"
            onPress={handleStockAdjustment}
            leftIcon="tune"
            variant="primary"
            style={styles.actionBtn}
          />
          <Button
            title="Transfer Stock"
            onPress={handleTransferStock}
            leftIcon="swap-horiz"
            variant="outline"
            style={styles.actionBtn}
          />
        </View>

        {/* Stock Overview */}
        <InfoCard title="Overview Stok">
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{getTotalStock()}</Text>
              <Text style={styles.overviewLabel}>Total Unit</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{formatCurrency(getTotalValue())}</Text>
              <Text style={styles.overviewLabel}>Total Nilai</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{inventoryItems.length}</Text>
              <Text style={styles.overviewLabel}>Lokasi</Text>
            </View>
          </View>
        </InfoCard>

        {/* Barcode Info */}
        {product.barcode && (
          <InfoCard title="Barcode">
            <View style={styles.barcodeInfo}>
              <Text style={styles.barcodeValue}>{product.barcode}</Text>
              <TouchableOpacity style={styles.barcodeAction} onPress={handleScanBarcode}>
                <Icon name="qr-code-scanner" size={20} color={UI_CONFIG.PRIMARY_COLOR} />
                <Text style={styles.barcodeActionText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </InfoCard>
        )}

        {/* Inventory by Location */}
        {inventoryItems.length > 0 && (
          <InfoCard title="Stok per Lokasi">
            {inventoryItems.map((item) => (
              <InventoryItemRow
                key={`${item.productId}-${item.locationId}`}
                item={item}
                onPress={() => handleInventoryItemPress(item)}
              />
            ))}
          </InfoCard>
        )}

        {/* Product Details */}
        <InfoCard title="Detail Produk">
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: product.isActive ? UI_CONFIG.SUCCESS_COLOR : '#9E9E9E' }
            ]}>
              <Text style={styles.statusText}>
                {product.isActive ? 'Aktif' : 'Tidak Aktif'}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Dibuat</Text>
            <Text style={styles.detailValue}>
              {new Date(product.createdAt).toLocaleDateString('id-ID')}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Diperbarui</Text>
            <Text style={styles.detailValue}>
              {new Date(product.updatedAt).toLocaleDateString('id-ID')}
            </Text>
          </View>
        </InfoCard>

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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  imageContainer: {
    flex: 1,
  },
  productImage: {
    width: width - 100,
    height: 200,
    borderRadius: 12,
  },
  placeholderImage: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 8,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 8,
  },
  productSku: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: UI_CONFIG.PRIMARY_COLOR,
  },
  costPrice: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  description: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 24,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overviewItem: {
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.PRIMARY_COLOR,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  barcodeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barcodeValue: {
    fontSize: 18,
    fontFamily: 'monospace',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  barcodeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  barcodeActionText: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    fontWeight: '500',
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  inventoryInfo: {
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
  inventoryQuantity: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  quantityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  quantityLabel: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  stockStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  stockStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_PRIMARY,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacing: {
    height: 24,
  },
});

export default ProductDetailScreen;