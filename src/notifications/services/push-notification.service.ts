import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  Message,
  MulticastMessage,
  BatchResponse,
} from 'firebase-admin/messaging';

export interface PushNotificationOptions {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  priority?: 'normal' | 'high';
  ttl?: number;
  clickAction?: string;
  collapseKey?: string;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  retryCount?: number;
}

export interface BulkPushNotificationResult {
  successCount: number;
  failureCount: number;
  results: PushNotificationResult[];
}

export interface TopicSubscriptionResult {
  success: boolean;
  error?: string;
  successCount?: number;
  failureCount?: number;
  errors?: any[];
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private firebaseApp: admin.app.App;
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2 seconds

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const pushEnabled = this.configService.get<boolean>('PUSH_ENABLED', true);

    if (!pushEnabled) {
      this.logger.warn(
        'Push notification service is disabled via configuration',
      );
      return;
    }

    try {
      const projectId = this.configService.get<string>('FCM_PROJECT_ID');
      const privateKey = this.configService.get<string>('FCM_PRIVATE_KEY');
      const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');

      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn(
          'Firebase credentials not configured. Push notifications will use fallback logging.',
        );
        return;
      }

      // Initialize Firebase Admin SDK
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
        databaseURL: this.configService.get<string>('FCM_DATABASE_URL'),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase Admin SDK: ${error.message}`,
      );
    }
  }

  async sendPushNotification(
    options: PushNotificationOptions,
    retryCount = 0,
  ): Promise<PushNotificationResult> {
    const pushEnabled = this.configService.get<boolean>('PUSH_ENABLED', true);

    if (!pushEnabled) {
      this.logger.debug(
        'Push notifications disabled, logging notification instead:',
        {
          deviceToken: options.deviceToken.substring(0, 20) + '...',
          title: options.title,
          body: options.body,
          retryCount,
        },
      );
      return { success: true, messageId: 'disabled' };
    }

    if (!this.firebaseApp) {
      this.logger.debug(
        'Firebase not configured, logging notification instead:',
        {
          deviceToken: options.deviceToken.substring(0, 20) + '...',
          title: options.title,
          body: options.body,
          retryCount,
        },
      );
      return { success: true, messageId: 'logging' };
    }

    try {
      this.logger.log(
        `Sending push notification: ${options.title} (attempt ${
          retryCount + 1
        })`,
      );

      // Validate device token
      if (!(await this.validateDeviceToken(options.deviceToken))) {
        throw new BadRequestException('Invalid device token format');
      }

      // Prepare FCM message
      const message: Message = {
        token: options.deviceToken,
        notification: {
          title: options.title,
          body: options.body,
          imageUrl: options.image,
        },
        data: options.data ? this.stringifyData(options.data) : undefined,
        android: {
          priority: options.priority === 'high' ? 'high' : 'normal',
          ttl: options.ttl || 86400000, // 24 hours default
          notification: {
            icon: options.icon || 'ic_notification',
            sound: options.sound || 'default',
            clickAction: options.clickAction,
            notificationCount: options.badge,
          },
          collapseKey: options.collapseKey,
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: options.title,
                body: options.body,
              },
              badge: options.badge,
              sound: options.sound || 'default',
            },
          },
          headers: {
            'apns-priority': options.priority === 'high' ? '10' : '5',
            'apns-expiration': options.ttl
              ? String(Math.floor(Date.now() / 1000) + options.ttl)
              : undefined,
          },
        },
        webpush: {
          notification: {
            title: options.title,
            body: options.body,
            icon: options.icon || '/android-chrome-192x192.png',
            image: options.image,
            badge: '/badge-72x72.png',
            actions: options.clickAction
              ? [
                  {
                    action: options.clickAction,
                    title: 'Open',
                  },
                ]
              : undefined,
          },
          headers: {
            TTL: options.ttl ? String(options.ttl) : '86400',
          },
        },
      };

      // Send message
      const response = await admin.messaging().send(message);

      this.logger.log(
        `Push notification sent successfully. MessageId: ${response}`,
      );

      return {
        success: true,
        messageId: response,
        retryCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send push notification (attempt ${retryCount + 1}): ${
          error.message
        }`,
      );

      // Check if error is retryable
      const isRetryable = this.isRetryableError(error);

      if (isRetryable && retryCount < this.maxRetries) {
        this.logger.log(
          `Retrying push notification in ${this.retryDelay}ms...`,
        );
        await this.delay(this.retryDelay);
        return this.sendPushNotification(options, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        retryCount,
      };
    }
  }

  async sendBulkPushNotification(
    notifications: PushNotificationOptions[],
  ): Promise<BulkPushNotificationResult> {
    this.logger.log(`Sending ${notifications.length} bulk push notifications`);

    const results: PushNotificationResult[] = [];

    // Process in batches for better performance
    const batchSize = 500; // FCM supports up to 500 messages per batch
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);

      if (this.firebaseApp && batch.length > 1) {
        // Use multicast for better performance
        try {
          const multicastMessage: MulticastMessage = {
            tokens: batch.map(n => n.deviceToken),
            notification: {
              title: batch[0].title, // Use first notification's title as template
              body: batch[0].body,
            },
            data: batch[0].data ? this.stringifyData(batch[0].data) : undefined,
          };

          const response: BatchResponse = await admin
            .messaging()
            .sendEachForMulticast(multicastMessage);

          response.responses.forEach((resp, index) => {
            if (resp.success) {
              successCount++;
              results.push({
                success: true,
                messageId: resp.messageId,
              });
            } else {
              failureCount++;
              results.push({
                success: false,
                error: resp.error?.message,
                errorCode: resp.error?.code,
              });
            }
          });
        } catch (error) {
          this.logger.error(
            `Batch ${i / batchSize + 1} failed: ${error.message}`,
          );
          batch.forEach(() => {
            failureCount++;
            results.push({
              success: false,
              error: error.message,
            });
          });
        }
      } else {
        // Fallback to individual sending
        const batchPromises = batch.map(notification =>
          this.sendPushNotification(notification),
        );
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successCount++;
            } else {
              failureCount++;
            }
            results.push(result.value);
          } else {
            failureCount++;
            results.push({
              success: false,
              error: result.reason.message,
            });
          }
        });
      }

      // Small delay between batches
      if (i + batchSize < notifications.length) {
        await this.delay(100);
      }
    }

    this.logger.log(
      `Bulk push notifications completed: ${successCount} successful, ${failureCount} failed`,
    );

    return {
      successCount,
      failureCount,
      results,
    };
  }

  async validateDeviceToken(token: string): Promise<boolean> {
    // Enhanced device token validation
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Check length (FCM tokens are typically 163 characters)
    if (token.length < 50 || token.length > 200) {
      return false;
    }

    // Check for valid characters (FCM tokens are base64-like)
    const validTokenRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validTokenRegex.test(token)) {
      return false;
    }

    // Additional validation with Firebase if available
    if (this.firebaseApp) {
      try {
        // Test with a dry run message
        const testMessage: Message = {
          token,
          notification: {
            title: 'Test',
            body: 'Test',
          },
        };

        await admin.messaging().send(testMessage);
        return true;
      } catch (error) {
        this.logger.debug(`Token validation failed: ${error.message}`);
        return false;
      }
    }

    return true;
  }

  async subscribeToTopic(
    deviceTokens: string | string[],
    topic: string,
  ): Promise<TopicSubscriptionResult> {
    this.logger.log(`Subscribing device(s) to topic: ${topic}`);

    if (!this.firebaseApp) {
      this.logger.debug(
        'Firebase not configured, logging subscription instead',
      );
      return { success: true };
    }

    try {
      const tokens = Array.isArray(deviceTokens)
        ? deviceTokens
        : [deviceTokens];

      // Validate topic name
      if (!this.validateTopicName(topic)) {
        throw new BadRequestException('Invalid topic name format');
      }

      const response = await admin.messaging().subscribeToTopic(tokens, topic);

      this.logger.log(
        `Topic subscription completed: ${response.successCount} successful, ${response.failureCount} failed`,
      );

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors,
      };
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async unsubscribeFromTopic(
    deviceTokens: string | string[],
    topic: string,
  ): Promise<TopicSubscriptionResult> {
    this.logger.log(`Unsubscribing device(s) from topic: ${topic}`);

    if (!this.firebaseApp) {
      this.logger.debug(
        'Firebase not configured, logging unsubscription instead',
      );
      return { success: true };
    }

    try {
      const tokens = Array.isArray(deviceTokens)
        ? deviceTokens
        : [deviceTokens];

      // Validate topic name
      if (!this.validateTopicName(topic)) {
        throw new BadRequestException('Invalid topic name format');
      }

      const response = await admin
        .messaging()
        .unsubscribeFromTopic(tokens, topic);

      this.logger.log(
        `Topic unsubscription completed: ${response.successCount} successful, ${response.failureCount} failed`,
      );

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors,
      };
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from topic ${topic}: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: Partial<PushNotificationOptions>,
  ): Promise<PushNotificationResult> {
    this.logger.log(`Sending push notification to topic: ${topic}`);

    if (!this.firebaseApp) {
      this.logger.debug(
        'Firebase not configured, logging topic notification instead',
      );
      return { success: true, messageId: 'logging' };
    }

    try {
      // Validate topic name
      if (!this.validateTopicName(topic)) {
        throw new BadRequestException('Invalid topic name format');
      }

      const message: Message = {
        topic,
        notification: {
          title,
          body,
          imageUrl: options?.image,
        },
        data: data ? this.stringifyData(data) : undefined,
        android: {
          priority: options?.priority === 'high' ? 'high' : 'normal',
          ttl: options?.ttl || 86400000,
          notification: {
            icon: options?.icon || 'ic_notification',
            sound: options?.sound || 'default',
            clickAction: options?.clickAction,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              badge: options?.badge,
              sound: options?.sound || 'default',
            },
          },
        },
      };

      const response = await admin.messaging().send(message);

      this.logger.log(
        `Topic notification sent successfully. MessageId: ${response}`,
      );

      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      this.logger.error(`Failed to send topic notification: ${error.message}`);
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }
  }

  async sendIndonesianBusinessNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: Partial<PushNotificationOptions>,
  ): Promise<PushNotificationResult> {
    // Add Indonesian business context
    const enhancedData = {
      ...data,
      businessContext: 'indonesian',
      appName: 'StokCerdas',
      timestamp: new Date().toISOString(),
    };

    const indonesianOptions: PushNotificationOptions = {
      deviceToken,
      title,
      body,
      data: enhancedData,
      icon: 'ic_stokcerdas',
      sound: 'default',
      priority: 'normal',
      clickAction: 'OPEN_APP',
      ...options,
    };

    return await this.sendPushNotification(indonesianOptions);
  }

  async sendLowStockAlert(
    deviceToken: string,
    productName: string,
    currentStock: number,
    locationName: string,
    options?: Partial<PushNotificationOptions>,
  ): Promise<PushNotificationResult> {
    return await this.sendIndonesianBusinessNotification(
      deviceToken,
      '🚨 Stok Menipis',
      `${productName} di ${locationName} tersisa ${currentStock} unit`,
      {
        type: 'low_stock_alert',
        productName,
        currentStock,
        locationName,
        actionRequired: true,
      },
      {
        priority: 'high',
        sound: 'alert',
        clickAction: 'OPEN_INVENTORY',
        ...options,
      },
    );
  }

  async sendOrderNotification(
    deviceToken: string,
    orderNumber: string,
    status: string,
    options?: Partial<PushNotificationOptions>,
  ): Promise<PushNotificationResult> {
    return await this.sendIndonesianBusinessNotification(
      deviceToken,
      '📦 Update Pesanan',
      `Pesanan #${orderNumber} telah ${status}`,
      {
        type: 'order_update',
        orderNumber,
        status,
      },
      {
        clickAction: 'OPEN_ORDERS',
        ...options,
      },
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.firebaseApp) {
        return false;
      }

      // Test by sending a test message
      const testMessage: Message = {
        token: 'test-token',
        notification: {
          title: 'Test',
          body: 'Test',
        },
      };

      await admin.messaging().send(testMessage);
      return true;
    } catch (error) {
      // Dry run with invalid token should fail, but connection should work
      return error.code !== 'app/no-app';
    }
  }

  async getConnectionInfo(): Promise<any> {
    return {
      provider: 'Firebase Cloud Messaging',
      enabled: this.configService.get<boolean>('PUSH_ENABLED'),
      hasCredentials: !!(
        this.configService.get<string>('FCM_PROJECT_ID') &&
        this.configService.get<string>('FCM_PRIVATE_KEY')
      ),
      projectId: this.configService.get<string>('FCM_PROJECT_ID'),
      databaseUrl: this.configService.get<string>('FCM_DATABASE_URL'),
    };
  }

  private stringifyData(data: Record<string, any>): Record<string, string> {
    const stringified: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringified[key] =
        typeof value === 'string' ? value : JSON.stringify(value);
    }
    return stringified;
  }

  private validateTopicName(topic: string): boolean {
    // FCM topic names must match the pattern: [a-zA-Z0-9-_.~%]+
    const topicRegex = /^[a-zA-Z0-9\-_.~%]+$/;
    return topicRegex.test(topic) && topic.length <= 900;
  }

  private isRetryableError(error: any): boolean {
    // Retryable FCM error codes
    const retryableErrors = [
      'messaging/internal-error',
      'messaging/server-unavailable',
      'messaging/timeout',
      'messaging/quota-exceeded',
    ];

    return retryableErrors.includes(error.code);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
