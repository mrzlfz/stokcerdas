/**
 * Loading Screen Component
 * Tampilan loading dengan branding StokCerdas
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI_CONFIG, APP_CONFIG } from '@/constants/config';

const { width, height } = Dimensions.get('window');

interface LoadingScreenProps {
  message?: string;
  showAppName?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Memuat...', 
  showAppName = true 
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={UI_CONFIG.PRIMARY_COLOR}
        translucent={Platform.OS === 'android'}
      />
      
      <View style={styles.content}>
        {/* App Logo/Icon Area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>📦</Text>
          </View>
          
          {showAppName && (
            <Text style={styles.appName}>{APP_CONFIG.APP_NAME}</Text>
          )}
          
          <Text style={styles.tagline}>
            AI-Powered Inventory Intelligence
          </Text>
        </View>
        
        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size="large" 
            color={UI_CONFIG.ACCENT_COLOR}
            style={styles.spinner}
          />
          <Text style={styles.loadingText}>{message}</Text>
        </View>
        
        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            Versi {APP_CONFIG.VERSION}
          </Text>
          <Text style={styles.copyrightText}>
            © 2025 StokCerdas Team
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.1,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoText: {
    fontSize: 48,
    textAlign: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  versionContainer: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  versionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});

export default LoadingScreen;