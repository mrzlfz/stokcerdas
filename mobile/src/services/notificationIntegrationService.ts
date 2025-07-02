/**
 * Notification Integration Service
 * Menghubungkan socket service dengan notification system untuk real-time alerts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration, Platform } from 'react-native';
import Toast from 'react-native-toast-message';

// Services
import socketService from './socketService';
import pushNotificationService from './pushNotificationService';
import deviceTokenService from './deviceTokenService';
import notificationNavigationService from './notificationNavigationService';
import alertConfigurationService from './alertConfigurationService';

// Config & Types
import { STORAGE_KEYS, NOTIFICATION_CONFIG } from '@/constants/config';
import type { AppNotification, NotificationType } from '@/types';

interface AlertConfig {
  title: string;
  message: string;
  type: NotificationType;
  priority: 'high' | 'normal' | 'low';
  actionable: boolean;
  sound?: boolean;
  vibration?: boolean;
  persistInCenter?: boolean;
}

interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  categories: { [key: string]: boolean };
}

class NotificationIntegrationService {
  private isInitialized: boolean = false;
  private notificationPreferences: NotificationPreferences | null = null;
  private pendingNotifications: AppNotification[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the integration service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Notification Integration Service...');

      // Load user preferences
      await this.loadNotificationPreferences();

      // Setup socket event listeners
      this.setupSocketListeners();

      // Setup push notification listeners
      this.setupPushNotificationListeners();

      // Initialize device token service
      await this.initializeDeviceTokenService();

      // Initialize alert configuration service
      await this.initializeAlertConfigurationService();

      // Process any pending notifications
      await this.processPendingNotifications();

      this.isInitialized = true;
      console.log('Notification Integration Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Notification Integration Service:', error);
    }
  }

  /**
   * Load notification preferences from storage
   */
  private async loadNotificationPreferences(): Promise<void> {
    try {
      const storedPreferences = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      
      if (storedPreferences) {
        this.notificationPreferences = JSON.parse(storedPreferences);
      } else {
        // Use default preferences
        this.notificationPreferences = {
          enabled: true,
          sound: NOTIFICATION_CONFIG.SOUND_ENABLED,
          vibration: NOTIFICATION_CONFIG.VIBRATION_ENABLED,
          categories: {
            low_stock: true,
            expired: true,
            expiring_soon: true,
            stock_movement: true,
            system: true,
          },
        };
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      // Fallback to defaults
      this.notificationPreferences = {
        enabled: true,
        sound: true,
        vibration: true,
        categories: {
          low_stock: true,
          expired: true,
          expiring_soon: true,
          stock_movement: true,
          system: true,
        },
      };
    }
  }

  /**
   * Setup socket service event listeners
   */
  private setupSocketListeners(): void {
    // Inventory alerts
    socketService.on('inventory:low_stock', (data) => {
      this.handleLowStockAlert(data);
    });

    socketService.on('inventory:stock_movement', (data) => {
      this.handleStockMovementAlert(data);
    });

    socketService.on('inventory:updated', (data) => {
      this.handleInventoryUpdateAlert(data);
    });

    // General alerts
    socketService.on('alert:notification', (data) => {
      this.handleGeneralAlert(data);
    });

    // System events
    socketService.on('system:maintenance', (data) => {
      this.handleSystemMaintenanceAlert(data);
    });

    // Connection events
    socketService.on('socket:connected', () => {
      this.showInAppNotification({
        title: 'Terhubung',
        message: 'Koneksi real-time aktif',
        type: 'success',
        priority: 'low',
        actionable: false,
        persistInCenter: false,
      });
    });

    socketService.on('socket:disconnected', () => {
      this.showInAppNotification({
        title: 'Terputus',
        message: 'Koneksi real-time terputus',
        type: 'warning',
        priority: 'normal',
        actionable: false,
        persistInCenter: false,
      });
    });

    console.log('Socket service listeners setup for notifications');
  }

  /**
   * Initialize device token service
   */
  private async initializeDeviceTokenService(): Promise<void> => {
    try {
      // Initialize device token service
      await deviceTokenService.initialize();

      // Register device with server
      await deviceTokenService.registerDeviceWithServer();

      // Subscribe to default topics based on user preferences
      if (this.notificationPreferences?.enabled && this.notificationPreferences.categories) {
        await deviceTokenService.subscribeToDefaultTopics(this.notificationPreferences.categories);
      }

      console.log('Device token service initialized and configured');
    } catch (error) {
      console.error('Error initializing device token service:', error);
    }
  }

  /**
   * Initialize alert configuration service
   */
  private async initializeAlertConfigurationService(): Promise<void> => {
    try {
      // Initialize alert configuration service
      await alertConfigurationService.initialize();

      console.log('Alert configuration service initialized and configured');
    } catch (error) {
      console.error('Error initializing alert configuration service:', error);
    }
  }

  /**
   * Setup push notification service listeners
   */
  private setupPushNotificationListeners(): void {
    // Listen for push notifications received
    pushNotificationService.on('notification:received', (data) => {
      this.handlePushNotificationReceived(data);
    });

    // Listen for notification opened
    pushNotificationService.on('notification:opened', (data) => {
      this.handlePushNotificationOpened(data);
    });

    // Listen for token refresh
    pushNotificationService.on('token:refreshed', (data) => {
      console.log('FCM token refreshed:', data.token.substring(0, 20) + '...');
    });

    console.log('Push notification service listeners setup');
  }

  /**
   * Handle low stock alert from socket
   */
  private handleLowStockAlert(data: any): void {
    if (!this.shouldShowNotification('low_stock')) return;

    // Check if alert should be triggered based on configuration
    const matchingRules = alertConfigurationService.getMatchingAlertRules({
      ...data,
      type: 'low_stock',
    });

    if (matchingRules.length === 0) {
      console.log('No matching alert rules for low stock data:', data);
      return;
    }

    // Use the highest priority rule
    const rule = matchingRules.reduce((highest, current) => 
      current.priority === 'high' ? current : highest
    );

    const config: AlertConfig = {
      title: rule.name || 'Stok Rendah',
      message: `${data.productName || 'Produk'} tersisa ${data.currentStock} unit di ${data.locationName || 'lokasi'}`,
      type: 'low_stock',
      priority: rule.priority as any,
      actionable: true,
      sound: rule.priority === 'high',
      vibration: rule.priority === 'high',
      persistInCenter: true,
    };

    const notification: AppNotification = {
      id: `low_stock_${data.itemId || Date.now()}`,
      title: config.title,
      message: config.message,
      type: config.type,
      category: 'inventory',
      timestamp: new Date().toISOString(),
      read: false,
      actionable: config.actionable,
      data: {
        productId: data.productId,
        locationId: data.locationId,
        currentStock: data.quantityOnHand,
        reorderPoint: data.reorderPoint,
        alertType: 'low_stock',
        ruleId: rule.id,
      },
    };

    this.processNotification(notification, config);
  }

  /**
   * Handle stock movement alert
   */
  private handleStockMovementAlert(data: any): void {
    if (!this.shouldShowNotification('stock_movement')) return;

    const config: AlertConfig = {
      title: 'Pergerakan Stok',
      message: `${data.type === 'increase' ? 'Penambahan' : 'Pengurangan'} stok ${data.productName || 'produk'}`,
      type: 'info',
      priority: 'normal',
      actionable: true,
      sound: false,
      vibration: false,
      persistInCenter: true,
    };

    const notification: AppNotification = {
      id: `stock_movement_${data.transactionId || Date.now()}`,
      title: config.title,
      message: config.message,
      type: config.type,
      category: 'inventory',
      timestamp: new Date().toISOString(),
      read: false,
      actionable: config.actionable,
      data: {
        transactionId: data.transactionId,
        productId: data.productId,
        locationId: data.locationId,
        quantityChange: data.quantityChange,
        transactionType: data.type,
      },
    };

    this.processNotification(notification, config);
  }

  /**
   * Handle inventory update alert
   */
  private handleInventoryUpdateAlert(data: any): void {
    // Only show as toast, don't persist in notification center
    const config: AlertConfig = {
      title: 'Inventori Diperbarui',
      message: `Stok ${data.productName || 'produk'} diperbarui`,
      type: 'success',
      priority: 'low',
      actionable: false,
      sound: false,
      vibration: false,
      persistInCenter: false,
    };

    this.showInAppNotification(config);
  }

  /**
   * Handle general alert from socket
   */
  private handleGeneralAlert(data: any): void {
    const category = data.category || 'system';
    if (!this.shouldShowNotification(category)) return;

    const config: AlertConfig = {
      title: data.title || 'Notifikasi',
      message: data.message || data.body || '',
      type: data.type || 'info',
      priority: data.priority || 'normal',
      actionable: data.actionable || false,
      sound: data.priority === 'high',
      vibration: data.priority === 'high',
      persistInCenter: true,
    };

    const notification: AppNotification = {
      id: data.id || `alert_${Date.now()}`,
      title: config.title,
      message: config.message,
      type: config.type,
      category: category,
      timestamp: new Date().toISOString(),
      read: false,
      actionable: config.actionable,
      data: data.data || {},
    };

    this.processNotification(notification, config);
  }

  /**
   * Handle system maintenance alert
   */
  private handleSystemMaintenanceAlert(data: any): void {
    if (!this.shouldShowNotification('system')) return;

    const config: AlertConfig = {
      title: 'Maintenance Sistem',
      message: data.message || 'Sistem akan mengalami maintenance',
      type: 'warning',
      priority: 'high',
      actionable: false,
      sound: true,
      vibration: true,
      persistInCenter: true,
    };

    const notification: AppNotification = {
      id: `maintenance_${Date.now()}`,
      title: config.title,
      message: config.message,
      type: config.type,
      category: 'system',
      timestamp: new Date().toISOString(),
      read: false,
      actionable: config.actionable,
      data: {
        maintenanceStart: data.maintenanceStart,
        duration: data.duration,
        affectedServices: data.affectedServices,
      },
    };

    this.processNotification(notification, config);
  }

  /**
   * Handle push notification received in foreground
   */
  private handlePushNotificationReceived(data: any): void {
    const notification: AppNotification = {
      id: data.id || Date.now().toString(),
      title: data.title,
      message: data.message || data.body,
      type: data.type || 'info',
      category: data.category || 'general',
      timestamp: new Date().toISOString(),
      read: false,
      actionable: data.actionable || false,
      data: data.data || {},
    };

    const config: AlertConfig = {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: data.priority || 'normal',
      actionable: notification.actionable,
      sound: true,
      vibration: true,
      persistInCenter: true,
    };

    this.processNotification(notification, config);
  }

  /**
   * Handle push notification opened
   */
  private async handlePushNotificationOpened(data: any): Promise<void> {
    console.log('Push notification opened:', data);
    
    try {
      // Handle navigation using notification navigation service
      if (data.deepLink) {
        await notificationNavigationService.handleDeepLink(data.deepLink);
      } else if (data.type || data.category) {
        await notificationNavigationService.navigateFromNotificationType(
          data.type || 'info',
          data.category || 'general',
          data.data || data
        );
      } else if (data.screen) {
        // Direct navigation data
        await notificationNavigationService.handleNotificationNavigation({
          id: data.id || Date.now().toString(),
          title: data.title || 'Notifikasi',
          message: data.message || data.body || '',
          type: data.type || 'info',
          category: data.category || 'general',
          timestamp: new Date().toISOString(),
          read: false,
          actionable: true,
          data: {
            screen: data.screen,
            params: data.params,
            ...data.data,
          },
        });
      } else {
        // Fallback to notification center
        notificationNavigationService.navigateToNotificationCenter();
      }
    } catch (error) {
      console.error('Error handling push notification navigation:', error);
      // Fallback to notification center on error
      notificationNavigationService.navigateToNotificationCenter();
    }
  }

  /**
   * Process notification with given configuration
   */
  private processNotification(notification: AppNotification, config: AlertConfig): void {
    // Check quiet time settings
    if (alertConfigurationService.isQuietTime() && config.priority !== 'high') {
      console.log('Skipping notification due to quiet time:', notification.title);
      // Still store in notification center but don't show toast or play sounds
      if (config.persistInCenter) {
        this.storeNotificationInCenter(notification);
      }
      return;
    }

    // Show in-app notification (toast)
    this.showInAppNotification(config);

    // Play sound and vibration if enabled
    this.playNotificationEffects(config);

    // Store in notification center if persistent
    if (config.persistInCenter) {
      this.storeNotificationInCenter(notification);
    }
  }

  /**
   * Show in-app notification (toast)
   */
  private showInAppNotification(config: AlertConfig): void {
    const toastType = this.mapNotificationTypeToToast(config.type);
    
    Toast.show({
      type: toastType,
      text1: config.title,
      text2: config.message,
      position: 'top',
      visibilityTime: config.priority === 'high' ? 6000 : 4000,
      autoHide: true,
      topOffset: Platform.OS === 'ios' ? 60 : 40,
    });
  }

  /**
   * Play notification effects (sound and vibration)
   */
  private playNotificationEffects(config: AlertConfig): void {
    const prefs = this.notificationPreferences;
    if (!prefs || !prefs.enabled) return;

    // Vibration
    if (config.vibration && prefs.vibration) {
      const pattern = config.priority === 'high' 
        ? [100, 50, 100, 50, 100] // High priority pattern
        : [100]; // Normal pattern
      
      Vibration.vibrate(pattern);
    }

    // Sound is handled by the system for push notifications
    // For in-app sounds, we could play custom sounds here
  }

  /**
   * Store notification in notification center
   */
  private async storeNotificationInCenter(notification: AppNotification): Promise<void> {
    try {
      const storedNotifications = await AsyncStorage.getItem('stored_notifications');
      const notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
      
      // Add new notification to the beginning
      notifications.unshift(notification);
      
      // Keep only the last 100 notifications
      if (notifications.length > 100) {
        notifications.splice(100);
      }
      
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error storing notification in center:', error);
    }
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(category: string): boolean {
    const prefs = this.notificationPreferences;
    if (!prefs || !prefs.enabled) return false;
    
    return prefs.categories[category] !== false;
  }

  /**
   * Map notification type to toast type
   */
  private mapNotificationTypeToToast(type: NotificationType): 'success' | 'error' | 'info' {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
      case 'expired':
        return 'error';
      case 'warning':
      case 'low_stock':
      case 'expiring_soon':
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Process pending notifications
   */
  private async processPendingNotifications(): Promise<void> {
    try {
      if (this.pendingNotifications.length > 0) {
        console.log(`Processing ${this.pendingNotifications.length} pending notifications`);
        
        for (const notification of this.pendingNotifications) {
          const config: AlertConfig = {
            title: notification.title,
            message: notification.message,
            type: notification.type,
            priority: 'normal',
            actionable: notification.actionable,
            sound: false, // Don't play sound for pending notifications
            vibration: false,
            persistInCenter: true,
          };
          
          await this.storeNotificationInCenter(notification);
        }
        
        this.pendingNotifications = [];
      }
    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      this.notificationPreferences = preferences;
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify(preferences));
      
      // Update topic subscriptions based on new preferences
      if (preferences.enabled && deviceTokenService.isServiceInitialized()) {
        await deviceTokenService.updateTopicSubscriptions(preferences.categories);
      } else if (!preferences.enabled) {
        // Unsubscribe from all topics if notifications are disabled
        const subscribedTopics = deviceTokenService.getSubscribedTopics();
        for (const topic of subscribedTopics) {
          await deviceTokenService.unsubscribeFromTopic(topic);
        }
      }
      
      console.log('Notification preferences updated and topic subscriptions synchronized');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  }

  /**
   * Get stored notifications from center
   */
  async getStoredNotifications(): Promise<AppNotification[]> {
    try {
      const storedNotifications = await AsyncStorage.getItem('stored_notifications');
      return storedNotifications ? JSON.parse(storedNotifications) : [];
    } catch (error) {
      console.error('Error getting stored notifications:', error);
      return [];
    }
  }

  /**
   * Clear all stored notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem('stored_notifications');
      console.log('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const storedNotifications = await AsyncStorage.getItem('stored_notifications');
      if (!storedNotifications) return;
      
      const notifications: AppNotification[] = JSON.parse(storedNotifications);
      const updatedNotifications = notifications.map(notification =>
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      );
      
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getStoredNotifications();
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    // Remove socket listeners
    socketService.off('inventory:low_stock', () => {});
    socketService.off('inventory:stock_movement', () => {});
    socketService.off('inventory:updated', () => {});
    socketService.off('alert:notification', () => {});
    socketService.off('system:maintenance', () => {});
    
    // Remove push notification listeners
    pushNotificationService.off('notification:received', () => {});
    pushNotificationService.off('notification:opened', () => {});
    
    // Cleanup device token service
    if (deviceTokenService.isServiceInitialized()) {
      deviceTokenService.deactivateDevice();
    }
    
    this.isInitialized = false;
    console.log('Notification Integration Service cleaned up');
  }
}

// Create singleton instance
const notificationIntegrationService = new NotificationIntegrationService();

export default notificationIntegrationService;