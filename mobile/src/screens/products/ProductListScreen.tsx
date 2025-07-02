/**
 * Product List Screen Component
 * Daftar produk dengan search, filter, dan barcode integration
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDebouncedCallback } from 'use-debounce';

// Components
import TextInput from '@/components/common/TextInput';
import Button from '@/components/common/Button';

// API Hooks
import { 
  useGetProductsQuery,
  useGetCategoriesQuery,
  useGetProductByBarcodeQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { Product, ProductCategory } from '@/types';

interface ProductListItemProps {
  product: Product;
  onPress: () => void;
}

const ProductListItem: React.FC<ProductListItemProps> = ({ product, onPress }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = () => {
    if (!product.isActive) return '#9E9E9E';
    // In real app, you'd check stock levels here
    return UI_CONFIG.SUCCESS_COLOR;
  };

  const getStatusText = () => {
    if (!product.isActive) return 'Tidak Aktif';
    return 'Aktif';
  };

  return (
    <TouchableOpacity style={styles.productItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.productImageContainer}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Icon name="inventory" size={32} color={UI_CONFIG.TEXT_SECONDARY} />
          </View>
        )}
      </View>
      
      <View style={styles.productContent}>
        <View style={styles.productHeader}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>
        
        <Text style={styles.productSku}>SKU: {product.sku}</Text>
        
        {product.category && (
          <Text style={styles.productCategory}>{product.category.name}</Text>
        )}
        
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>
            {formatCurrency(product.price || 0)}
          </Text>
          
          {product.barcode && (
            <View style={styles.barcodeContainer}>
              <Icon name="qr-code" size={16} color={UI_CONFIG.TEXT_SECONDARY} />
              <Text style={styles.barcodeText}>{product.barcode}</Text>
            </View>
          )}
        </View>
      </View>
      
      <Icon name="chevron-right" size={24} color={UI_CONFIG.TEXT_SECONDARY} />
    </TouchableOpacity>
  );
};

const ProductListScreen: React.FC = () => {
  const navigation = useNavigation();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      setSearchQuery(query);
      setPage(1); // Reset to first page on search
    },
    300
  );

  // API Queries
  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useGetProductsQuery({
    page,
    limit: 20,
    search: searchQuery,
    categoryId: selectedCategory || undefined,
    sortBy,
    sortOrder,
  });

  const { data: categoriesData } = useGetCategoriesQuery({});

  // Computed values
  const products = productsData?.data?.products || [];
  const totalPages = productsData?.data?.totalPages || 1;
  const currentPage = productsData?.data?.currentPage || 1;
  const categories = categoriesData?.data || [];

  // Handlers
  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id } as never);
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      Alert.alert('Error', 'Gagal memperbarui data. Silakan coba lagi.');
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (currentPage < totalPages && !isLoading) {
      setPage(prev => prev + 1);
    }
  }, [currentPage, totalPages, isLoading]);

  const handleAddProduct = useCallback(() => {
    navigation.navigate('ProductCreate' as never);
  }, [navigation]);

  const handleScanBarcode = useCallback(() => {
    navigation.navigate('ScannerStack', {
      screen: 'BarcodeScanner',
      params: { mode: 'product_search' },
    } as never);
  }, [navigation]);

  const handleFilterChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setPage(1);
    setShowFilters(false);
  }, []);

  const handleSortChange = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  }, [sortBy, sortOrder]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductListItem
      product={item}
      onPress={() => handleProductPress(item)}
    />
  ), [handleProductPress]);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Cari produk, SKU, atau barcode..."
          onChangeText={debouncedSearch}
          leftIcon="search"
          rightIcon="qr-code-scanner"
          onRightIconPress={handleScanBarcode}
          style={styles.searchInput}
        />
      </View>

      {/* Filters and Sort */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Icon name="filter-list" size={20} color={UI_CONFIG.PRIMARY_COLOR} />
          <Text style={styles.filterButtonText}>Filter</Text>
          {selectedCategory && <View style={styles.filterIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => handleSortChange('name')}
        >
          <Icon name="sort" size={20} color={UI_CONFIG.PRIMARY_COLOR} />
          <Text style={styles.filterButtonText}>
            Nama {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => handleSortChange('price')}
        >
          <Icon name="attach-money" size={20} color={UI_CONFIG.PRIMARY_COLOR} />
          <Text style={styles.filterButtonText}>
            Harga {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filters */}
      {showFilters && (
        <View style={styles.categoryFilters}>
          <TouchableOpacity
            style={[
              styles.categoryFilter,
              selectedCategory === '' && styles.categoryFilterActive,
            ]}
            onPress={() => handleFilterChange('')}
          >
            <Text
              style={[
                styles.categoryFilterText,
                selectedCategory === '' && styles.categoryFilterTextActive,
              ]}
            >
              Semua
            </Text>
          </TouchableOpacity>
          
          {categories.map((category: ProductCategory) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryFilter,
                selectedCategory === category.id && styles.categoryFilterActive,
              ]}
              onPress={() => handleFilterChange(category.id)}
            >
              <Text
                style={[
                  styles.categoryFilterText,
                  selectedCategory === category.id && styles.categoryFilterTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results Info */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {productsData?.data?.total || 0} produk ditemukan
        </Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={UI_CONFIG.PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Memuat produk...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="inventory" size={64} color={UI_CONFIG.TEXT_SECONDARY} />
      <Text style={styles.emptyTitle}>Tidak ada produk</Text>
      <Text style={styles.emptyDescription}>
        {searchQuery
          ? 'Tidak ditemukan produk yang sesuai dengan pencarian Anda.'
          : 'Belum ada produk yang ditambahkan. Tambahkan produk pertama Anda!'}
      </Text>
      {!searchQuery && (
        <Button
          title="Tambah Produk"
          onPress={handleAddProduct}
          style={styles.addButton}
        />
      )}
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={64} color="#F44336" />
          <Text style={styles.errorTitle}>Terjadi Kesalahan</Text>
          <Text style={styles.errorDescription}>
            Gagal memuat daftar produk. Silakan coba lagi.
          </Text>
          <Button title="Coba Lagi" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddProduct}>
        <Icon name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  listContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    marginBottom: 0,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    fontWeight: '500',
  },
  filterIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
  },
  categoryFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryFilterActive: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
  },
  categoryFilterText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    fontWeight: '500',
  },
  categoryFilterTextActive: {
    color: '#FFFFFF',
  },
  resultsInfo: {
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    fontWeight: '500',
  },
  productItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    marginRight: 12,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productContent: {
    flex: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  productSku: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: UI_CONFIG.PRIMARY_COLOR,
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barcodeText: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
    fontFamily: 'monospace',
  },
  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  addButton: {
    minWidth: 160,
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: UI_CONFIG.PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ProductListScreen;