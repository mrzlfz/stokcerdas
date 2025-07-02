/**
 * Push Notification Service
 * Handles push notifications dengan Firebase Cloud Messaging (FCM)
 */

import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import { STORAGE_KEYS, NOTIFICATION_CONFIG } from '@/constants/config';

// Firebase imports
import messaging from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';

interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  category?: string;
  priority?: 'high' | 'normal';
  sound?: string;
  badge?: number;
}

interface NotificationPermissionStatus {
  granted: boolean;
  canRequest: boolean;
  blocked: boolean;
}

class PushNotificationService {
  private isInitialized: boolean = false;
  private fcmToken: string | null = null;
  private notificationListeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeListeners();
  }

  /**
   * Initialize push notification service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Push Notification Service...');

      // Check if notifications are enabled in app settings
      const notificationSettings = await this.getNotificationSettings();
      if (!notificationSettings.enabled) {
        console.log('Notifications disabled in app settings');
        return;
      }

      // Request notification permissions
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        console.log('Notification permission not granted');
        return;
      }

      // Initialize Firebase Messaging (placeholder)
      await this.initializeFirebaseMessaging();

      // Get FCM token
      await this.getFCMToken();

      // Setup notification handlers
      this.setupNotificationHandlers();

      this.isInitialized = true;
      console.log('Push Notification Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Push Notification Service:', error);
    }
  }

  /**
   * Check notification permission status
   */
  async checkNotificationPermission(): Promise<NotificationPermissionStatus> {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.NOTIFICATIONS 
        : PERMISSIONS.ANDROID.POST_NOTIFICATIONS;

      const result = await check(permission);

      return {
        granted: result === RESULTS.GRANTED,
        canRequest: result === RESULTS.DENIED,
        blocked: result === RESULTS.BLOCKED,
      };
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return { granted: false, canRequest: true, blocked: false };
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      const permissionStatus = await this.checkNotificationPermission();

      if (permissionStatus.granted) {
        return true;
      }

      if (permissionStatus.blocked) {
        Alert.alert(
          'Izin Notifikasi Diperlukan',
          'Untuk menerima pemberitahuan penting tentang inventori, silakan aktifkan notifikasi di pengaturan aplikasi.',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      if (permissionStatus.canRequest) {
        const permission = Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.NOTIFICATIONS 
          : PERMISSIONS.ANDROID.POST_NOTIFICATIONS;

        const result = await request(permission);
        return result === RESULTS.GRANTED;
      }

      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Initialize Firebase Messaging
   */
  private async initializeFirebaseMessaging(): Promise<void> {
    try {
      // Check if Firebase app is already initialized
      if (!firebase.apps.length) {
        console.warn('Firebase app not initialized. Please check firebase configuration.');
        return;
      }

      // Check if Google Play Services is available (Android)
      if (Platform.OS === 'android') {
        const hasGooglePlayServices = await messaging().hasPermission();
        if (hasGooglePlayServices === messaging.AuthorizationStatus.DENIED) {
          console.warn('Google Play Services not available');
          return;
        }
      }

      // Register for remote notifications (iOS)
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
        const apnsToken = await messaging().getAPNSToken();
        if (apnsToken) {
          console.log('APNS Token:', apnsToken);
        } else {
          console.warn('Failed to get APNS token. Push notifications may not work on iOS.');
        }
      }
      
      console.log('Firebase Messaging initialized successfully');
    } catch (error) {
      console.error('Firebase Messaging initialization error:', error);
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken(): Promise<string | null> {
    try {
      // Get FCM token from Firebase
      const token = await messaging().getToken();
      this.fcmToken = token;
      
      // Store token locally
      await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, token);
      
      console.log('FCM Token received:', token.substring(0, 20) + '...');
      
      // Send token to server for storage
      this.sendTokenToServer(token);
      
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Send FCM token to server
   */
  private async sendTokenToServer(token: string): Promise<void> {
    try {
      const [accessToken, tenantId] = await AsyncStorage.multiGet([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.TENANT_ID,
      ]);

      if (!accessToken[1] || !tenantId[1]) {
        console.warn('Cannot send token to server: Missing auth credentials');
        return;
      }

      // This would typically be an API call to your backend
      // Example: await api.post('/user/fcm-token', { token, platform: Platform.OS });
      console.log('Token sent to server successfully');
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  /**
   * Setup notification handlers
   */
  private setupNotificationHandlers(): void {
    try {
      // Placeholder for notification handlers
      // This would typically set up:
      // 1. Foreground message handler
      // 2. Background message handler
      // 3. Notification open handler
      // 4. Token refresh handler

      console.log('Notification handlers setup (placeholder)');

      // Example handlers:
      this.setupForegroundHandler();
      this.setupBackgroundHandler();
      this.setupNotificationOpenHandler();
      this.setupTokenRefreshHandler();
    } catch (error) {
      console.error('Error setting up notification handlers:', error);
    }
  }

  /**
   * Setup foreground notification handler
   */
  private setupForegroundHandler(): void {
    messaging().onMessage(async remoteMessage => {
      console.log('Foreground notification received:', remoteMessage);
      this.handleForegroundNotification(remoteMessage);
    });

    console.log('Foreground notification handler setup');
  }

  /**
   * Setup background notification handler
   */
  private setupBackgroundHandler(): void {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Background notification received:', remoteMessage);
      this.handleBackgroundNotification(remoteMessage);
    });

    console.log('Background notification handler setup');
  }

  /**
   * Setup notification open handler
   */
  private setupNotificationOpenHandler(): void {
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Check if app was opened from a notification when it was quit
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from quit state by notification:', remoteMessage);
        this.handleNotificationOpen(remoteMessage);
      }
    });

    console.log('Notification open handler setup');
  }

  /**
   * Setup token refresh handler
   */
  private setupTokenRefreshHandler(): void {
    messaging().onTokenRefresh(token => {
      console.log('FCM token refreshed:', token.substring(0, 20) + '...');
      this.handleTokenRefresh(token);
    });

    console.log('Token refresh handler setup');
  }

  /**
   * Handle foreground notification
   */
  private handleForegroundNotification(remoteMessage: any): void {
    const notification: NotificationData = {
      id: remoteMessage.messageId || Date.now().toString(),
      title: remoteMessage.notification?.title || 'Notifikasi',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data,
      category: remoteMessage.data?.category,
    };

    // Show in-app notification
    this.showInAppNotification(notification);
    
    // Emit to listeners
    this.emit('notification:received', notification);
  }

  /**
   * Handle background notification
   */
  private handleBackgroundNotification(remoteMessage: any): void {
    console.log('Processing background notification:', remoteMessage);
    
    // Store notification for later processing
    this.storeNotification(remoteMessage);
  }

  /**
   * Handle notification open
   */
  private handleNotificationOpen(remoteMessage: any): void {
    console.log('User opened notification:', remoteMessage);
    
    const notificationData = remoteMessage.data;
    
    // Navigate based on notification data
    this.handleNotificationNavigation(notificationData);
    
    // Emit to listeners
    this.emit('notification:opened', notificationData);
  }

  /**
   * Handle token refresh
   */
  private async handleTokenRefresh(newToken: string): Promise<void> {
    this.fcmToken = newToken;
    await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, newToken);
    
    // Send new token to server
    this.sendTokenToServer(newToken);
    
    // Emit event for listeners
    this.emit('token:refreshed', { token: newToken });
  }

  /**
   * Show in-app notification
   */
  private showInAppNotification(notification: NotificationData): void {
    // This would typically show a toast or banner
    console.log('Showing in-app notification:', notification);
  }

  /**
   * Store notification for later processing
   */
  private async storeNotification(notification: any): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('stored_notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      
      notifications.push({
        ...notification,
        receivedAt: new Date().toISOString(),
      });
      
      // Keep only last 50 notifications
      if (notifications.length > 50) {
        notifications.splice(0, notifications.length - 50);
      }
      
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  /**
   * Handle notification navigation
   */
  private handleNotificationNavigation(data: any): void {
    const { type, screen, params } = data;
    
    // This would typically use navigation service to navigate
    console.log('Navigating based on notification:', { type, screen, params });
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<any> {
    try {
      const settings = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      return settings ? JSON.parse(settings) : NOTIFICATION_CONFIG;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return NOTIFICATION_CONFIG;
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
      console.log('Notification settings updated:', settings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  /**
   * Subscribe to topic
   */
  async subscribeToTopic(topic: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`Successfully subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`Successfully unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  }

  /**
   * Clear all notifications
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
   * Initialize event listener system
   */
  private initializeListeners(): void {
    this.notificationListeners = new Map();
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.notificationListeners.has(event)) {
      this.notificationListeners.set(event, new Set());
    }
    this.notificationListeners.get(event)?.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    this.notificationListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.notificationListeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in notification event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current FCM token
   */
  getCurrentToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

// Create singleton instance
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;