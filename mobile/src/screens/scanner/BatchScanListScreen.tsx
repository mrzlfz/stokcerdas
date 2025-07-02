/**
 * Batch Scan List Screen Component
 * Menampilkan daftar hasil scan batch dan memungkinkan aksi bulk
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Components
import Button from '@/components/common/Button';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { ScannerStackParamList, Product } from '@/types';

type BatchScanListRouteProp = RouteProp<ScannerStackParamList, 'BatchScanList'>;

interface BatchScanItem {
  barcode: string;
  product?: Product;
  timestamp: string;
}

const BatchScanListScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<BatchScanListRouteProp>();
  const { scannedItems = [], mode } = route.params || {};
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Handlers
  const handleSelectItem = useCallback((barcode: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(barcode)) {
        newSet.delete(barcode);
      } else {
        newSet.add(barcode);
      }
      return newSet;
    });
  }, []);
  
  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === scannedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(scannedItems.map(item => item.barcode)));
    }
  }, [selectedItems.size, scannedItems]);
  
  const handleScanMore = useCallback(() => {
    navigation.navigate('BarcodeScanner', { 
      mode, 
      batchMode: true 
    } as never);
  }, [navigation, mode]);
  
  const handleProcessSelected = useCallback(() => {
    const selectedItemsData = scannedItems.filter(item => 
      selectedItems.has(item.barcode)
    );
    
    if (selectedItemsData.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal satu item untuk diproses');
      return;
    }
    
    Alert.alert(
      'Proses Batch',
      `Proses ${selectedItemsData.length} item yang dipilih?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Proses', 
          onPress: () => {
            // Handle batch processing here
            Alert.alert('Info', 'Fitur batch processing akan diimplementasikan');
          }
        },
      ]
    );
  }, [scannedItems, selectedItems]);
  
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  const renderItem = useCallback(({ item }: { item: BatchScanItem }) => {
    const isSelected = selectedItems.has(item.barcode);
    
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => handleSelectItem(item.barcode)}
        activeOpacity={0.7}
      >
        <View style={styles.itemCheckbox}>
          <Icon 
            name={isSelected ? 'check-box' : 'check-box-outline-blank'} 
            size={24} 
            color={isSelected ? UI_CONFIG.PRIMARY_COLOR : UI_CONFIG.TEXT_SECONDARY} 
          />
        </View>
        
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemBarcode}>{item.barcode}</Text>
            <Text style={styles.itemTime}>{formatTimestamp(item.timestamp)}</Text>
          </View>
          
          {item.product ? (
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.product.name}</Text>
              <Text style={styles.productSku}>SKU: {item.product.sku}</Text>
            </View>
          ) : (
            <Text style={styles.noProduct}>Produk tidak ditemukan</Text>
          )}
        </View>
        
        <Icon 
          name={item.product ? 'check-circle' : 'error'} 
          size={20} 
          color={item.product ? UI_CONFIG.SUCCESS_COLOR : '#F44336'} 
        />
      </TouchableOpacity>
    );
  }, [selectedItems, handleSelectItem]);
  
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Hasil Batch Scan</Text>
      <Text style={styles.subtitle}>
        {scannedItems.length} item di-scan, {scannedItems.filter(item => item.product).length} ditemukan
      </Text>
      
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={handleSelectAll}
        >
          <Icon 
            name={selectedItems.size === scannedItems.length ? 'deselect' : 'select-all'} 
            size={20} 
            color={UI_CONFIG.PRIMARY_COLOR} 
          />
          <Text style={styles.selectAllText}>
            {selectedItems.size === scannedItems.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="qr-code-scanner" size={64} color={UI_CONFIG.TEXT_SECONDARY} />
      <Text style={styles.emptyTitle}>Belum Ada Item</Text>
      <Text style={styles.emptyDescription}>
        Mulai scan barcode untuk menambahkan item ke batch list
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={scannedItems}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.barcode}-${item.timestamp}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          title="Scan Lagi"
          onPress={handleScanMore}
          variant="outline"
          leftIcon="qr-code-scanner"
          style={styles.scanButton}
        />
        
        <Button
          title={`Proses (${selectedItems.size})`}
          onPress={handleProcessSelected}
          disabled={selectedItems.size === 0}
          leftIcon="done-all"
          style={styles.processButton}
        />
      </View>
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
    padding: 20,
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
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    fontWeight: '600',
  },
  item: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
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
    gap: 12,
  },
  itemSelected: {
    borderWidth: 2,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
    backgroundColor: '#F0F8FF',
  },
  itemCheckbox: {
    // Checkbox area
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemBarcode: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    fontFamily: 'monospace',
  },
  itemTime: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  productInfo: {
    // Product info when found
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  productSku: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  noProduct: {
    fontSize: 14,
    color: '#F44336',
    fontStyle: 'italic',
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
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: UI_CONFIG.BORDER_COLOR,
  },
  scanButton: {
    flex: 1,
  },
  processButton: {
    flex: 2,
  },
});

export default BatchScanListScreen;