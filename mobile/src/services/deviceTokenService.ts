/**
 * Device Token Management Service
 * Mengelola FCM token registration, topic subscriptions, dan device management
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

// Services
import pushNotificationService from './pushNotificationService';

// Config & Types
import { STORAGE_KEYS, API_CONFIG } from '@/constants/config';

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  platformVersion: string;
  appVersion: string;
  buildNumber: string;
  fcmToken: string;
  isActive: boolean;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

interface TopicSubscription {
  topic: string;
  subscribed: boolean;
  subscribedAt?: string;
  unsubscribedAt?: string;
}

interface DeviceRegistrationData {
  deviceId: string;
  deviceName: string;
  platform: string;
  platformVersion: string;
  appVersion: string;
  buildNumber: string;
  fcmToken: string;
  userId?: string;
  tenantId?: string;
}

class DeviceTokenService {
  private isInitialized: boolean = false;
  private deviceInfo: DeviceInfo | null = null;
  private topicSubscriptions: Map<string, TopicSubscription> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize device token service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Device Token Service...');

      // Get device information
      await this.loadDeviceInfo();

      // Load topic subscriptions
      await this.loadTopicSubscriptions();

      // Setup FCM token listeners
      this.setupTokenListeners();

      this.isInitialized = true;
      console.log('Device Token Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Device Token Service:', error);
    }
  }

  /**
   * Load device information
   */
  private async loadDeviceInfo(): Promise<void> {
    try {
      // Get stored device info
      const storedDeviceInfo = await AsyncStorage.getItem('device_info');
      
      if (storedDeviceInfo) {
        this.deviceInfo = JSON.parse(storedDeviceInfo);
      }

      // Update device info with current data
      await this.updateDeviceInfo();
    } catch (error) {
      console.error('Error loading device info:', error);
    }
  }

  /**
   * Update device information
   */
  private async updateDeviceInfo(): Promise<void> {
    try {
      const deviceId = await DeviceInfo.getUniqueId();
      const deviceName = await DeviceInfo.getDeviceName();
      const platformVersion = await DeviceInfo.getSystemVersion();
      const appVersion = DeviceInfo.getVersion();
      const buildNumber = DeviceInfo.getBuildNumber();
      const fcmToken = pushNotificationService.getCurrentToken();

      const now = new Date().toISOString();

      this.deviceInfo = {
        deviceId,
        deviceName,
        platform: Platform.OS,
        platformVersion,
        appVersion,
        buildNumber,
        fcmToken: fcmToken || '',
        isActive: true,
        lastActiveAt: now,
        createdAt: this.deviceInfo?.createdAt || now,
        updatedAt: now,
      };

      // Store updated device info
      await AsyncStorage.setItem('device_info', JSON.stringify(this.deviceInfo));
      
      console.log('Device info updated:', {
        deviceId: deviceId.substring(0, 8) + '...',
        deviceName,
        platform: Platform.OS,
        appVersion,
      });
    } catch (error) {
      console.error('Error updating device info:', error);
    }
  }

  /**
   * Load topic subscriptions from storage
   */
  private async loadTopicSubscriptions(): Promise<void> {
    try {
      const storedSubscriptions = await AsyncStorage.getItem('topic_subscriptions');
      
      if (storedSubscriptions) {
        const subscriptions = JSON.parse(storedSubscriptions);
        this.topicSubscriptions = new Map(Object.entries(subscriptions));
      }
    } catch (error) {
      console.error('Error loading topic subscriptions:', error);
    }
  }

  /**
   * Save topic subscriptions to storage
   */
  private async saveTopicSubscriptions(): Promise<void> {
    try {
      const subscriptions = Object.fromEntries(this.topicSubscriptions);
      await AsyncStorage.setItem('topic_subscriptions', JSON.stringify(subscriptions));
    } catch (error) {
      console.error('Error saving topic subscriptions:', error);
    }
  }

  /**
   * Setup FCM token listeners
   */
  private setupTokenListeners(): void {
    // Listen for token refresh
    pushNotificationService.on('token:refreshed', (data) => {
      this.handleTokenRefresh(data.token);
    });
  }

  /**
   * Handle FCM token refresh
   */
  private async handleTokenRefresh(newToken: string): Promise<void> {
    try {
      console.log('Handling FCM token refresh...');

      // Update device info with new token
      if (this.deviceInfo) {
        this.deviceInfo.fcmToken = newToken;
        this.deviceInfo.updatedAt = new Date().toISOString();
        await AsyncStorage.setItem('device_info', JSON.stringify(this.deviceInfo));
      }

      // Re-register device with server
      await this.registerDeviceWithServer();

      // Re-subscribe to all active topics
      await this.resubscribeToTopics();

    } catch (error) {
      console.error('Error handling token refresh:', error);
    }
  }

  /**
   * Register device with server
   */
  async registerDeviceWithServer(): Promise<boolean> {
    try {
      if (!this.deviceInfo) {
        console.warn('Cannot register device: Device info not available');
        return false;
      }

      const [accessToken, tenantId, userId] = await AsyncStorage.multiGet([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.TENANT_ID,
        STORAGE_KEYS.USER_DATA,
      ]);

      if (!accessToken[1]) {
        console.warn('Cannot register device: Not authenticated');
        return false;
      }

      const userData = userId[1] ? JSON.parse(userId[1]) : null;
      
      const registrationData: DeviceRegistrationData = {
        deviceId: this.deviceInfo.deviceId,
        deviceName: this.deviceInfo.deviceName,
        platform: this.deviceInfo.platform,
        platformVersion: this.deviceInfo.platformVersion,
        appVersion: this.deviceInfo.appVersion,
        buildNumber: this.deviceInfo.buildNumber,
        fcmToken: this.deviceInfo.fcmToken,
        userId: userData?.id,
        tenantId: tenantId[1] || undefined,
      };

      // This would be an actual API call to your backend
      console.log('Registering device with server:', {
        deviceId: registrationData.deviceId.substring(0, 8) + '...',
        platform: registrationData.platform,
        appVersion: registrationData.appVersion,
        fcmToken: registrationData.fcmToken.substring(0, 20) + '...',
      });

      // Example API call:
      // const response = await fetch(`${API_CONFIG.BASE_URL}/devices/register`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${accessToken[1]}`,
      //   },
      //   body: JSON.stringify(registrationData),
      // });

      // if (!response.ok) {
      //   throw new Error(`Registration failed: ${response.status}`);
      // }

      // Store registration timestamp
      await AsyncStorage.setItem('device_registered_at', new Date().toISOString());
      
      console.log('Device registration successful');
      return true;
    } catch (error) {
      console.error('Error registering device with server:', error);
      return false;
    }
  }

  /**
   * Subscribe to notification topic
   */
  async subscribeToTopic(topic: string): Promise<boolean> {
    try {
      // Subscribe via FCM
      await pushNotificationService.subscribeToTopic(topic);

      // Update local subscription record
      const subscription: TopicSubscription = {
        topic,
        subscribed: true,
        subscribedAt: new Date().toISOString(),
      };

      this.topicSubscriptions.set(topic, subscription);
      await this.saveTopicSubscriptions();

      // Notify server about subscription
      await this.updateServerSubscription(topic, true);

      console.log(`Successfully subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from notification topic
   */
  async unsubscribeFromTopic(topic: string): Promise<boolean> {
    try {
      // Unsubscribe via FCM
      await pushNotificationService.unsubscribeFromTopic(topic);

      // Update local subscription record
      const subscription: TopicSubscription = {
        topic,
        subscribed: false,
        unsubscribedAt: new Date().toISOString(),
      };

      this.topicSubscriptions.set(topic, subscription);
      await this.saveTopicSubscriptions();

      // Notify server about unsubscription
      await this.updateServerSubscription(topic, false);

      console.log(`Successfully unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Update server subscription status
   */
  private async updateServerSubscription(topic: string, subscribed: boolean): Promise<void> {
    try {
      if (!this.deviceInfo) return;

      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!accessToken) return;

      // This would be an actual API call to your backend
      console.log(`Updating server subscription for topic ${topic}: ${subscribed ? 'subscribed' : 'unsubscribed'}`);

      // Example API call:
      // await fetch(`${API_CONFIG.BASE_URL}/devices/${this.deviceInfo.deviceId}/subscriptions`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${accessToken}`,
      //   },
      //   body: JSON.stringify({
      //     topic,
      //     subscribed,
      //     timestamp: new Date().toISOString(),
      //   }),
      // });

    } catch (error) {
      console.error('Error updating server subscription:', error);
    }
  }

  /**
   * Re-subscribe to all active topics (after token refresh)
   */
  private async resubscribeToTopics(): Promise<void> {
    try {
      const activeTopics = Array.from(this.topicSubscriptions.values())
        .filter(sub => sub.subscribed)
        .map(sub => sub.topic);

      console.log(`Re-subscribing to ${activeTopics.length} topics...`);

      for (const topic of activeTopics) {
        try {
          await pushNotificationService.subscribeToTopic(topic);
        } catch (error) {
          console.error(`Failed to re-subscribe to topic ${topic}:`, error);
        }
      }

      console.log('Re-subscription to topics completed');
    } catch (error) {
      console.error('Error re-subscribing to topics:', error);
    }
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Get topic subscriptions
   */
  getTopicSubscriptions(): Map<string, TopicSubscription> {
    return new Map(this.topicSubscriptions);
  }

  /**
   * Check if subscribed to topic
   */
  isSubscribedToTopic(topic: string): boolean {
    const subscription = this.topicSubscriptions.get(topic);
    return subscription?.subscribed === true;
  }

  /**
   * Get subscribed topics list
   */
  getSubscribedTopics(): string[] {
    return Array.from(this.topicSubscriptions.values())
      .filter(sub => sub.subscribed)
      .map(sub => sub.topic);
  }

  /**
   * Update device activity timestamp
   */
  async updateDeviceActivity(): Promise<void> {
    try {
      if (this.deviceInfo) {
        this.deviceInfo.lastActiveAt = new Date().toISOString();
        this.deviceInfo.updatedAt = new Date().toISOString();
        await AsyncStorage.setItem('device_info', JSON.stringify(this.deviceInfo));
      }
    } catch (error) {
      console.error('Error updating device activity:', error);
    }
  }

  /**
   * Deactivate device (for logout)
   */
  async deactivateDevice(): Promise<void> {
    try {
      if (this.deviceInfo) {
        this.deviceInfo.isActive = false;
        this.deviceInfo.updatedAt = new Date().toISOString();
        await AsyncStorage.setItem('device_info', JSON.stringify(this.deviceInfo));

        // Notify server about deactivation
        await this.notifyServerDeviceDeactivation();

        // Unsubscribe from all topics
        const subscribedTopics = this.getSubscribedTopics();
        for (const topic of subscribedTopics) {
          await this.unsubscribeFromTopic(topic);
        }
      }
    } catch (error) {
      console.error('Error deactivating device:', error);
    }
  }

  /**
   * Notify server about device deactivation
   */
  private async notifyServerDeviceDeactivation(): Promise<void> {
    try {
      if (!this.deviceInfo) return;

      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!accessToken) return;

      console.log('Notifying server about device deactivation');

      // Example API call:
      // await fetch(`${API_CONFIG.BASE_URL}/devices/${this.deviceInfo.deviceId}/deactivate`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${accessToken}`,
      //   },
      //   body: JSON.stringify({
      //     deactivatedAt: new Date().toISOString(),
      //   }),
      // });

    } catch (error) {
      console.error('Error notifying server about device deactivation:', error);
    }
  }

  /**
   * Clear all device data
   */
  async clearDeviceData(): Promise<void> {
    try {
      // Deactivate device first
      await this.deactivateDevice();

      // Clear local data
      await AsyncStorage.multiRemove([
        'device_info',
        'topic_subscriptions',
        'device_registered_at',
      ]);

      // Reset state
      this.deviceInfo = null;
      this.topicSubscriptions.clear();

      console.log('Device data cleared');
    } catch (error) {
      console.error('Error clearing device data:', error);
    }
  }

  /**
   * Subscribe to default topics based on user preferences
   */
  async subscribeToDefaultTopics(preferences: { [key: string]: boolean }): Promise<void> {
    try {
      const defaultTopics = Object.keys(preferences).filter(topic => preferences[topic]);
      
      console.log(`Subscribing to ${defaultTopics.length} default topics:`, defaultTopics);

      for (const topic of defaultTopics) {
        await this.subscribeToTopic(topic);
      }
    } catch (error) {
      console.error('Error subscribing to default topics:', error);
    }
  }

  /**
   * Update topic subscriptions based on preferences
   */
  async updateTopicSubscriptions(preferences: { [key: string]: boolean }): Promise<void> {
    try {
      console.log('Updating topic subscriptions based on preferences:', preferences);

      for (const [topic, shouldSubscribe] of Object.entries(preferences)) {
        const isCurrentlySubscribed = this.isSubscribedToTopic(topic);

        if (shouldSubscribe && !isCurrentlySubscribed) {
          await this.subscribeToTopic(topic);
        } else if (!shouldSubscribe && isCurrentlySubscribed) {
          await this.unsubscribeFromTopic(topic);
        }
      }
    } catch (error) {
      console.error('Error updating topic subscriptions:', error);
    }
  }

  /**
   * Get device registration status
   */
  async getRegistrationStatus(): Promise<{
    isRegistered: boolean;
    registeredAt: string | null;
    lastUpdated: string | null;
  }> {
    try {
      const registeredAt = await AsyncStorage.getItem('device_registered_at');
      
      return {
        isRegistered: !!registeredAt && !!this.deviceInfo?.fcmToken,
        registeredAt,
        lastUpdated: this.deviceInfo?.updatedAt || null,
      };
    } catch (error) {
      console.error('Error getting registration status:', error);
      return {
        isRegistered: false,
        registeredAt: null,
        lastUpdated: null,
      };
    }
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

// Create singleton instance
const deviceTokenService = new DeviceTokenService();

export default deviceTokenService;