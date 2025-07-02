/**
 * Error Boundary Component
 * Menangani error yang tidak tertangkap dalam aplikasi
 */

import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { UI_CONFIG, APP_CONFIG } from '@/constants/config';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // You can also log the error to an error reporting service here
    // Example: Crashlytics.recordError(error);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRestart = () => {
    // In a real app, you might want to restart the app
    // For now, just reset the error state
    this.handleRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Icon
                name="error-outline"
                size={64}
                color={UI_CONFIG.ERROR_COLOR}
              />
            </View>

            {/* Error Title */}
            <Text style={styles.title}>Oops! Terjadi Kesalahan</Text>

            {/* Error Description */}
            <Text style={styles.description}>
              Aplikasi mengalami kesalahan yang tidak terduga. 
              Tim kami telah diberitahu tentang masalah ini.
            </Text>

            {/* Error Details (only in development) */}
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>
                  Detail Error (Development Mode):
                </Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.stackTrace}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={this.handleRetry}
                activeOpacity={0.7}
              >
                <Icon name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Coba Lagi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.restartButton}
                onPress={this.handleRestart}
                activeOpacity={0.7}
              >
                <Text style={styles.restartButtonText}>Restart Aplikasi</Text>
              </TouchableOpacity>
            </View>

            {/* App Info */}
            <View style={styles.appInfo}>
              <Text style={styles.appInfoText}>
                {APP_CONFIG.APP_NAME} v{APP_CONFIG.VERSION}
              </Text>
              <Text style={styles.appInfoText}>
                Build: {APP_CONFIG.BUILD_NUMBER}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  errorDetails: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    width: '100%',
    maxHeight: 200,
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: UI_CONFIG.ERROR_COLOR,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  stackTrace: {
    fontSize: 10,
    color: UI_CONFIG.TEXT_SECONDARY,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  restartButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  restartButtonText: {
    color: UI_CONFIG.PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
  },
  appInfoText: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 4,
  },
});

export default ErrorBoundary;