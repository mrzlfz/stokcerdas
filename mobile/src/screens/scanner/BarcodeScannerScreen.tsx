/**
 * Barcode Scanner Screen Component
 * Implementasi lengkap barcode scanner dengan camera permission, multiple format support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  StatusBar,
  Platform,
  Dimensions,
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import {
  PERMISSIONS,
  RESULTS,
  request as requestPermission,
  check as checkPermission,
  openSettings,
} from 'react-native-permissions';
import Icon from 'react-native-vector-icons/MaterialIcons';

// API Hooks
import {
  useGetProductByBarcodeQuery,
  useGetProductBySkuQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { ScannerStackParamList } from '@/types';

type BarcodeScannerRouteProp = RouteProp<ScannerStackParamList, 'BarcodeScanner'>;

interface ScanResult {
  data: string;
  type: string;
  rawData?: string;
}

const { width, height } = Dimensions.get('window');

const BarcodeScannerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<BarcodeScannerRouteProp>();
  const { mode = 'product_lookup', locationId } = route.params || {};
  
  // State
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(true);
  
  // Refs
  const scannerRef = useRef<QRCodeScanner>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const appState = useRef(AppState.currentState);
  
  // API Queries - conditionally triggered when barcode is scanned
  const {
    data: productByBarcode,
    isLoading: loadingBarcode,
    error: barcodeError,
  } = useGetProductByBarcodeQuery(scannedData || '', {
    skip: !scannedData,
  });

  // Permission handling
  const getCameraPermission = useCallback(async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
        
      const result = await checkPermission(permission);
      
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
        return true;
      }
      
      if (result === RESULTS.DENIED) {
        const requestResult = await requestPermission(permission);
        const granted = requestResult === RESULTS.GRANTED;
        setHasPermission(granted);
        return granted;
      }
      
      if (result === RESULTS.BLOCKED || result === RESULTS.UNAVAILABLE) {
        setHasPermission(false);
        Alert.alert(
          'Izin Kamera Diperlukan',
          'Aplikasi memerlukan akses kamera untuk scan barcode. Silakan buka pengaturan dan aktifkan izin kamera.',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Buka Pengaturan', onPress: () => openSettings() },
          ]
        );
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  // Initialize scanner
  useEffect(() => {
    getCameraPermission();
    
    // Start scanning animation
    const startAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    
    startAnimation();
    
    return () => {
      setIsMounted(false);
    };
  }, [getCameraPermission]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        if (hasPermission && isScanning) {
          scannerRef.current?.reactivate();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [hasPermission, isScanning]);

  // Handle focus/blur events
  useFocusEffect(
    useCallback(() => {
      if (hasPermission) {
        setIsScanning(true);
        scannerRef.current?.reactivate();
      }
      
      return () => {
        setIsScanning(false);
        setTorchOn(false);
      };
    }, [hasPermission])
  );

  // Handle scan success
  const onSuccess = useCallback((e: any) => {
    if (!isScanning || !isMounted) return;
    
    const now = Date.now();
    if (now - lastScan < 1000) return; // Prevent duplicate scans within 1 second
    
    const scanData = e.data || e.rawData || '';
    if (!scanData.trim()) return;
    
    setLastScan(now);
    setIsScanning(false);
    setScannedData(scanData);
    
    // Provide haptic feedback
    Vibration.vibrate(100);
    
    console.log('Scanned:', scanData, 'Type:', e.type);
    
    // Navigate to result screen with scan data
    navigation.navigate('ScanResult', {
      barcode: scanData,
      mode,
      locationId,
    } as never);
  }, [isScanning, isMounted, lastScan, navigation, mode, locationId]);

  // Handle manual entry
  const handleManualEntry = useCallback(() => {
    navigation.navigate('ManualEntry', { mode } as never);
  }, [navigation, mode]);

  // Toggle torch
  const toggleTorch = useCallback(() => {
    setTorchOn(prev => !prev);
  }, []);

  // Reactivate scanner
  const reactivateScanner = useCallback(() => {
    if (hasPermission) {
      setIsScanning(true);
      setScannedData(null);
      scannerRef.current?.reactivate();
    }
  }, [hasPermission]);

  // Close scanner
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Get mode title
  const getModeTitle = () => {
    switch (mode) {
      case 'product_lookup':
        return 'Cari Produk';
      case 'stock_adjustment':
        return 'Stock Adjustment';
      case 'stock_transfer':
        return 'Transfer Stock';
      default:
        return 'Scan Barcode';
    }
  };

  // Get mode description
  const getModeDescription = () => {
    switch (mode) {
      case 'product_lookup':
        return 'Arahkan kamera ke barcode produk untuk mencari informasi';
      case 'stock_adjustment':
        return 'Scan barcode produk untuk melakukan penyesuaian stok';
      case 'stock_transfer':
        return 'Scan barcode produk untuk transfer antar lokasi';
      default:
        return 'Arahkan kamera ke barcode atau QR code';
    }
  };

  // Render permission denied state
  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.permissionContainer}>
          <Icon name="camera-alt" size={80} color="#FFFFFF" />
          <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
          <Text style={styles.permissionDescription}>
            Aplikasi memerlukan akses kamera untuk memindai barcode. 
            Silakan berikan izin untuk melanjutkan.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={getCameraPermission}>
            <Text style={styles.permissionButtonText}>Berikan Izin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={() => openSettings()}>
            <Text style={styles.settingsButtonText}>Buka Pengaturan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render loading state
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memeriksa izin kamera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main scanner interface
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Scanner */}
      <QRCodeScanner
        ref={scannerRef}
        onRead={onSuccess}
        flashMode={torchOn ? RNCamera.Constants.FlashMode.torch : RNCamera.Constants.FlashMode.off}
        reactivate={isScanning}
        reactivateTimeout={500}
        showMarker
        checkAndroid6Permissions
        cameraStyle={styles.camera}
        customMarker={
          <View style={styles.markerContainer}>
            {/* Scanning Line Animation */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-100, 100],
                      }),
                    },
                  ],
                },
              ]}
            />
            
            {/* Corner Markers */}
            <View style={styles.markerTopLeft} />
            <View style={styles.markerTopRight} />
            <View style={styles.markerBottomLeft} />
            <View style={styles.markerBottomRight} />
          </View>
        }
        cameraProps={{
          autoFocus: RNCamera.Constants.AutoFocus.on,
          captureAudio: false,
        }}
      />
      
      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top Section */}
        <View style={styles.topSection}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{getModeTitle()}</Text>
            <Text style={styles.description}>{getModeDescription()}</Text>
          </View>
          
          <TouchableOpacity style={styles.torchButton} onPress={toggleTorch}>
            <Icon 
              name={torchOn ? "flash-off" : "flash-on"} 
              size={24} 
              color={torchOn ? "#FFD700" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
            <Icon name="keyboard" size={20} color="#FFFFFF" />
            <Text style={styles.manualButtonText}>Input Manual</Text>
          </TouchableOpacity>
          
          {!isScanning && (
            <TouchableOpacity style={styles.retryButton} onPress={reactivateScanner}>
              <Icon name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Scan Lagi</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    height: height,
    width: width,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingBottom: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: 20,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  markerContainer: {
    position: 'relative',
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    width: 240,
    height: 2,
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    shadowColor: UI_CONFIG.PRIMARY_COLOR,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  markerTopLeft: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
  },
  markerTopRight: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
  },
  markerBottomLeft: {
    position: 'absolute',
    bottom: -5,
    left: -5,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
  },
  markerBottomRight: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

export default BarcodeScannerScreen;