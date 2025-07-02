/**
 * Notification Navigation Service
 * Menangani navigation dan deep linking dari notifikasi
 */

import { CommonActions, NavigationContainerRef } from '@react-navigation/native';
import { Alert } from 'react-native';

// Types
import type { AppNotification } from '@/types';

interface NavigationData {
  screen: string;
  params?: any;
  stack?: string;
}

interface NotificationAction {
  type: 'navigate' | 'modal' | 'alert' | 'custom';
  navigation?: NavigationData;
  alert?: {
    title: string;
    message: string;
    buttons?: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }>;
  };
  customHandler?: (notification: AppNotification) => void;
}

class NotificationNavigationService {
  private navigationRef: NavigationContainerRef<any> | null = null;
  private pendingNotifications: AppNotification[] = [];

  /**
   * Set navigation reference
   */
  setNavigationRef(ref: NavigationContainerRef<any>): void {
    this.navigationRef = ref;
    
    // Process any pending notifications
    this.processPendingNotifications();
  }

  /**
   * Handle notification navigation
   */
  async handleNotificationNavigation(notification: AppNotification): Promise<void> {
    try {
      if (!this.navigationRef?.isReady()) {
        // Navigation not ready, queue for later
        this.pendingNotifications.push(notification);
        return;
      }

      const action = this.getNotificationAction(notification);
      
      if (!action) {
        console.log('No navigation action defined for notification type:', notification.type);
        return;
      }

      await this.executeNotificationAction(action, notification);
    } catch (error) {
      console.error('Error handling notification navigation:', error);
    }
  }

  /**
   * Get navigation action based on notification
   */
  private getNotificationAction(notification: AppNotification): NotificationAction | null {
    const { type, category, data } = notification;

    switch (type) {
      case 'low_stock':
        return {
          type: 'navigate',
          navigation: {
            stack: 'ProductsStack',
            screen: 'ProductDetail',
            params: { productId: data?.productId },
          },
        };

      case 'expired':
      case 'expiring_soon':
        return {
          type: 'navigate',
          navigation: {
            stack: 'InventoryStack',
            screen: 'InventoryList',
            params: { 
              filter: type === 'expired' ? 'expired' : 'expiring',
              productId: data?.productId,
            },
          },
        };

      case 'success':
        if (category === 'inventory' && data?.adjustmentId) {
          return {
            type: 'navigate',
            navigation: {
              stack: 'ReportsStack',
              screen: 'StockMovementReport',
              params: { adjustmentId: data.adjustmentId },
            },
          };
        }
        break;

      case 'info':
        if (category === 'inventory' && data?.transactionId) {
          return {
            type: 'navigate',
            navigation: {
              stack: 'ReportsStack',
              screen: 'StockMovementReport',
              params: { transactionId: data.transactionId },
            },
          };
        }
        break;

      case 'warning':
        if (category === 'system') {
          return {
            type: 'alert',
            alert: {
              title: notification.title,
              message: notification.message,
              buttons: [
                { text: 'OK', style: 'default' },
                {
                  text: 'Pengaturan',
                  style: 'default',
                  onPress: () => this.navigateToSettings(),
                },
              ],
            },
          };
        }
        break;

      case 'error':
        return {
          type: 'alert',
          alert: {
            title: notification.title,
            message: notification.message,
            buttons: [{ text: 'OK', style: 'default' }],
          },
        };

      default:
        // For unknown types, show notification center
        return {
          type: 'navigate',
          navigation: {
            screen: 'NotificationCenter',
          },
        };
    }

    return null;
  }

  /**
   * Execute notification action
   */
  private async executeNotificationAction(
    action: NotificationAction,
    notification: AppNotification
  ): Promise<void> {
    switch (action.type) {
      case 'navigate':
        if (action.navigation) {
          await this.navigateToScreen(action.navigation);
        }
        break;

      case 'modal':
        if (action.navigation) {
          await this.presentModal(action.navigation);
        }
        break;

      case 'alert':
        if (action.alert) {
          this.showAlert(action.alert);
        }
        break;

      case 'custom':
        if (action.customHandler) {
          action.customHandler(notification);
        }
        break;

      default:
        console.warn('Unknown notification action type:', action.type);
        break;
    }
  }

  /**
   * Navigate to screen
   */
  private async navigateToScreen(navigation: NavigationData): Promise<void> {
    if (!this.navigationRef) return;

    try {
      if (navigation.stack) {
        // Navigate to a screen within a stack
        this.navigationRef.dispatch(
          CommonActions.navigate({
            name: navigation.stack,
            params: {
              screen: navigation.screen,
              params: navigation.params,
            },
          })
        );
      } else {
        // Navigate to a direct screen
        this.navigationRef.dispatch(
          CommonActions.navigate({
            name: navigation.screen,
            params: navigation.params,
          })
        );
      }

      console.log('Navigated to:', navigation);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  /**
   * Present modal screen
   */
  private async presentModal(navigation: NavigationData): Promise<void> {
    if (!this.navigationRef) return;

    try {
      this.navigationRef.dispatch(
        CommonActions.navigate({
          name: navigation.screen,
          params: navigation.params,
        })
      );

      console.log('Presented modal:', navigation);
    } catch (error) {
      console.error('Modal presentation error:', error);
    }
  }

  /**
   * Show alert
   */
  private showAlert(alertConfig: NotificationAction['alert']): void {
    if (!alertConfig) return;

    Alert.alert(
      alertConfig.title,
      alertConfig.message,
      alertConfig.buttons
    );
  }

  /**
   * Navigate to settings
   */
  private navigateToSettings(): void {
    this.navigateToScreen({
      stack: 'SettingsStack',
      screen: 'Settings',
    });
  }

  /**
   * Process pending notifications
   */
  private async processPendingNotifications(): Promise<void> {
    if (this.pendingNotifications.length === 0) return;

    console.log(`Processing ${this.pendingNotifications.length} pending notifications`);

    const notifications = [...this.pendingNotifications];
    this.pendingNotifications = [];

    for (const notification of notifications) {
      await this.handleNotificationNavigation(notification);
    }
  }

  /**
   * Handle deep link from notification
   */
  async handleDeepLink(url: string): Promise<void> {
    try {
      const parsedUrl = this.parseDeepLink(url);
      
      if (parsedUrl) {
        await this.navigateToScreen({
          stack: parsedUrl.stack,
          screen: parsedUrl.screen,
          params: parsedUrl.params,
        });
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  }

  /**
   * Parse deep link URL
   */
  private parseDeepLink(url: string): NavigationData | null {
    try {
      // Example URL formats:
      // stokcerdas://product/123
      // stokcerdas://inventory/low-stock
      // stokcerdas://reports/stock-movement/456

      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);

      if (pathSegments.length === 0) {
        return { screen: 'TabNavigator' };
      }

      const [section, action, id] = pathSegments;

      switch (section) {
        case 'product':
          return {
            stack: 'ProductsStack',
            screen: action === 'create' ? 'ProductCreate' : 'ProductDetail',
            params: id ? { productId: id } : undefined,
          };

        case 'inventory':
          if (action === 'low-stock') {
            return {
              stack: 'InventoryStack',
              screen: 'InventoryList',
              params: { filter: 'low_stock' },
            };
          }
          if (action === 'adjustment') {
            return {
              stack: 'InventoryStack',
              screen: 'StockAdjustment',
              params: id ? { productId: id } : undefined,
            };
          }
          return {
            stack: 'InventoryStack',
            screen: 'InventoryList',
          };

        case 'reports':
          if (action === 'stock-movement') {
            return {
              stack: 'ReportsStack',
              screen: 'StockMovementReport',
              params: id ? { transactionId: id } : undefined,
            };
          }
          return {
            stack: 'ReportsStack',
            screen: 'ReportDashboard',
          };

        case 'settings':
          if (action === 'notifications') {
            return {
              stack: 'SettingsStack',
              screen: 'NotificationSettings',
            };
          }
          return {
            stack: 'SettingsStack',
            screen: 'Settings',
          };

        case 'notifications':
          return {
            screen: 'NotificationCenter',
          };

        case 'scanner':
          return {
            stack: 'ScannerStack',
            screen: 'BarcodeScanner',
            params: { mode: action || 'product_lookup' },
          };

        default:
          return { screen: 'TabNavigator' };
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
      return null;
    }
  }

  /**
   * Generate deep link URL
   */
  generateDeepLink(navigation: NavigationData): string {
    try {
      const baseUrl = 'stokcerdas://';
      
      if (!navigation.stack) {
        return `${baseUrl}${navigation.screen.toLowerCase()}`;
      }

      let path = '';
      
      switch (navigation.stack) {
        case 'ProductsStack':
          path = `product/${navigation.screen === 'ProductCreate' ? 'create' : ''}`;
          if (navigation.params?.productId) {
            path += `/${navigation.params.productId}`;
          }
          break;

        case 'InventoryStack':
          path = 'inventory/';
          if (navigation.screen === 'StockAdjustment') {
            path += 'adjustment';
            if (navigation.params?.productId) {
              path += `/${navigation.params.productId}`;
            }
          }
          break;

        case 'ReportsStack':
          path = 'reports/';
          if (navigation.screen === 'StockMovementReport') {
            path += 'stock-movement';
            if (navigation.params?.transactionId) {
              path += `/${navigation.params.transactionId}`;
            }
          }
          break;

        case 'SettingsStack':
          path = 'settings/';
          if (navigation.screen === 'NotificationSettings') {
            path += 'notifications';
          }
          break;

        case 'ScannerStack':
          path = 'scanner/';
          if (navigation.params?.mode) {
            path += navigation.params.mode;
          }
          break;

        default:
          path = navigation.screen.toLowerCase();
          break;
      }

      return `${baseUrl}${path}`;
    } catch (error) {
      console.error('Error generating deep link:', error);
      return 'stokcerdas://';
    }
  }

  /**
   * Navigate to notification center
   */
  navigateToNotificationCenter(): void {
    this.navigateToScreen({
      screen: 'NotificationCenter',
    });
  }

  /**
   * Navigate based on notification type
   */
  async navigateFromNotificationType(
    type: string,
    category: string,
    data?: any
  ): Promise<void> {
    const mockNotification: AppNotification = {
      id: Date.now().toString(),
      title: '',
      message: '',
      type: type as any,
      category,
      timestamp: new Date().toISOString(),
      read: false,
      actionable: true,
      data,
    };

    await this.handleNotificationNavigation(mockNotification);
  }

  /**
   * Check if navigation is ready
   */
  isNavigationReady(): boolean {
    return this.navigationRef?.isReady() === true;
  }

  /**
   * Reset navigation to root
   */
  resetToRoot(): void {
    if (this.navigationRef) {
      this.navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'TabNavigator' }],
        })
      );
    }
  }

  /**
   * Go back in navigation
   */
  goBack(): void {
    if (this.navigationRef?.canGoBack()) {
      this.navigationRef.goBack();
    }
  }

  /**
   * Get current route name
   */
  getCurrentRouteName(): string | undefined {
    return this.navigationRef?.getCurrentRoute()?.name;
  }
}

// Create singleton instance
const notificationNavigationService = new NotificationNavigationService();

export default notificationNavigationService;