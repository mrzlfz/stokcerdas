/**
 * Manual Entry Screen Component
 * Fallback input manual untuk barcode/SKU ketika scanning tidak berhasil
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  useGetProductByBarcodeQuery,
  useGetProductBySkuQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { ScannerStackParamList } from '@/types';

type ManualEntryRouteProp = RouteProp<ScannerStackParamList, 'ManualEntry'>;

interface ManualEntryFormData {
  input: string;
  searchType: 'barcode' | 'sku';
}

// Validation schema
const entrySchema = yup.object({
  input: yup
    .string()
    .required('Barcode atau SKU wajib diisi')
    .min(1, 'Minimal 1 karakter')
    .max(50, 'Maksimal 50 karakter'),
  searchType: yup.string().oneOf(['barcode', 'sku']).required(),
});

const ManualEntryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ManualEntryRouteProp>();
  const { mode } = route.params || {};
  
  const [searchType, setSearchType] = useState<'barcode' | 'sku'>('barcode');
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  
  const inputRef = useRef<any>(null);
  
  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<ManualEntryFormData>({
    resolver: yupResolver(entrySchema),
    mode: 'onChange',
    defaultValues: {
      input: '',
      searchType: 'barcode',
    },
  });
  
  const watchedInput = watch('input');
  
  // API Queries - conditionally triggered
  const {
    data: productByBarcode,
    isLoading: loadingBarcode,
    error: barcodeError,
  } = useGetProductByBarcodeQuery(searchValue, {
    skip: !searchValue || searchType !== 'barcode',
  });
  
  const {
    data: productBySku,
    isLoading: loadingSku,
    error: skuError,
  } = useGetProductBySkuQuery(searchValue, {
    skip: !searchValue || searchType !== 'sku',
  });
  
  const isLoading = loadingBarcode || loadingSku;
  
  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle search type change
  const handleSearchTypeChange = useCallback((type: 'barcode' | 'sku') => {
    setSearchType(type);
    setValue('searchType', type);
    setValue('input', '');
    setSearchValue('');
    inputRef.current?.focus();
  }, [setValue]);
  
  // Handle form submission
  const onSubmit = useCallback(async (data: ManualEntryFormData) => {
    const input = data.input.trim();
    if (!input) return;
    
    setIsSearching(true);
    setSearchValue(input);
    
    try {
      // Navigate to result screen with manual input
      navigation.navigate('ScanResult', {
        barcode: input,
        mode,
        isManualEntry: true,
        searchType: data.searchType,
      } as never);
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan saat memproses input');
    } finally {
      setIsSearching(false);
    }
  }, [navigation, mode]);
  
  // Handle quick suggestions
  const quickSuggestions = [
    { type: 'barcode', value: '1234567890123', label: 'Sample Barcode' },
    { type: 'sku', value: 'SKU-001', label: 'Format SKU Contoh' },
    { type: 'barcode', value: '9781234567897', label: 'ISBN Barcode' },
  ];
  
  const handleSuggestionPress = useCallback((suggestion: any) => {
    setSearchType(suggestion.type);
    setValue('searchType', suggestion.type);
    setValue('input', suggestion.value);
    inputRef.current?.focus();
  }, [setValue]);
  
  // Handle scan camera
  const handleScanCamera = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  
  // Get placeholder text
  const getPlaceholder = () => {
    switch (searchType) {
      case 'barcode':
        return 'Masukkan barcode (contoh: 1234567890123)';
      case 'sku':
        return 'Masukkan SKU produk (contoh: SKU-001)';
      default:
        return 'Masukkan kode produk';
    }
  };
  
  // Get helper text
  const getHelperText = () => {
    switch (searchType) {
      case 'barcode':
        return 'Barcode biasanya terdiri dari 8-15 digit angka';
      case 'sku':
        return 'SKU adalah kode unik produk dari sistem inventory';
      default:
        return '';
    }
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
            <Text style={styles.title}>Input Manual</Text>
            <Text style={styles.subtitle}>
              Masukkan barcode atau SKU produk secara manual
            </Text>
          </View>
          
          {/* Search Type Selector */}
          <View style={styles.selectorContainer}>
            <Text style={styles.selectorTitle}>Tipe Pencarian</Text>
            <View style={styles.selectorRow}>
              <TouchableOpacity
                style={[
                  styles.selectorOption,
                  searchType === 'barcode' && styles.selectorOptionActive,
                ]}
                onPress={() => handleSearchTypeChange('barcode')}
                activeOpacity={0.7}
              >
                <Icon
                  name="qr-code"
                  size={20}
                  color={searchType === 'barcode' ? '#FFFFFF' : UI_CONFIG.PRIMARY_COLOR}
                />
                <Text
                  style={[
                    styles.selectorOptionText,
                    searchType === 'barcode' && styles.selectorOptionTextActive,
                  ]}
                >
                  Barcode
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.selectorOption,
                  searchType === 'sku' && styles.selectorOptionActive,
                ]}
                onPress={() => handleSearchTypeChange('sku')}
                activeOpacity={0.7}
              >
                <Icon
                  name="inventory"
                  size={20}
                  color={searchType === 'sku' ? '#FFFFFF' : UI_CONFIG.PRIMARY_COLOR}
                />
                <Text
                  style={[
                    styles.selectorOptionText,
                    searchType === 'sku' && styles.selectorOptionTextActive,
                  ]}
                >
                  SKU
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Input Form */}
          <View style={styles.form}>
            <Controller
              control={control}
              name="input"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  ref={inputRef}
                  placeholder={getPlaceholder()}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.input?.message}
                  leftIcon={searchType === 'barcode' ? 'qr-code' : 'inventory'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  style={styles.input}
                />
              )}
            />
            
            {!errors.input && (
              <Text style={styles.helperText}>{getHelperText()}</Text>
            )}
          </View>
          
          {/* Quick Suggestions */}
          {!watchedInput && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Contoh Format</Text>
              {quickSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSuggestionPress(suggestion)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={suggestion.type === 'barcode' ? 'qr-code' : 'inventory'}
                    size={16}
                    color={UI_CONFIG.TEXT_SECONDARY}
                  />
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionValue}>{suggestion.value}</Text>
                    <Text style={styles.suggestionLabel}>{suggestion.label}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={UI_CONFIG.TEXT_SECONDARY} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Cari Produk"
              onPress={handleSubmit(onSubmit)}
              loading={isSearching || isLoading}
              disabled={!isValid || isSearching || isLoading}
              leftIcon="search"
              style={styles.searchButton}
            />
            
            <Button
              title="Kembali ke Scanner"
              onPress={handleScanCamera}
              variant="outline"
              leftIcon="camera-alt"
              style={styles.cameraButton}
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
  selectorContainer: {
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
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 12,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  selectorOptionActive: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
  },
  selectorOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_CONFIG.PRIMARY_COLOR,
  },
  selectorOptionTextActive: {
    color: '#FFFFFF',
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
  input: {
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginTop: 4,
    fontStyle: 'italic',
  },
  suggestionsContainer: {
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
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    marginBottom: 8,
    gap: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  suggestionLabel: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  actions: {
    paddingHorizontal: 16,
    gap: 12,
  },
  searchButton: {
    marginBottom: 8,
  },
  cameraButton: {
    marginBottom: 8,
  },
  bottomSpacing: {
    height: 24,
  },
});

export default ManualEntryScreen;