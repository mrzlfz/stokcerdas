/**
 * Notification API - RTK Query endpoints untuk notification management
 * Handles device registration, notification history, preferences sync
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AppNotification, NotificationType } from '@/types';
import type { NotificationPreferences } from '../slices/notificationSlice';
import { API_CONFIG } from '@/constants/config';

// API Types
export interface DeviceRegistrationData {
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android';
  osVersion: string;
  appVersion: string;
  fcmToken: string;
  userId?: string;
  tenantId?: string;
}

export interface NotificationHistoryQuery {
  page?: number;
  limit?: number;
  category?: string;
  type?: NotificationType;
  read?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface NotificationHistoryResponse {
  notifications: AppNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TopicSubscriptionData {
  deviceToken: string;
  topics: string[];
  userId?: string;
  tenantId?: string;
}

export interface NotificationMarkAsReadData {
  notificationIds: string[];
  userId?: string;
  tenantId?: string;
}

export interface NotificationPreferencesSync {
  userId: string;
  tenantId?: string;
  preferences: NotificationPreferences;
  deviceId: string;
}

export interface PushNotificationSendData {
  title: string;
  message: string;
  type: NotificationType;
  category: string;
  targetUsers?: string[];
  targetTopics?: string[];
  data?: any;
  priority?: 'high' | 'normal' | 'low';
  scheduledAt?: string;
}

export interface NotificationStatsResponse {
  totalNotifications: number;
  unreadCount: number;
  categoryBreakdown: Record<string, number>;
  typeBreakdown: Record<NotificationType, number>;
  lastWeekCount: number;
  deliveryRate: number;
  openRate: number;
}

// RTK Query API definition
export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_CONFIG.BASE_URL}/api/v1/notifications`,
    prepareHeaders: (headers, { getState }) => {
      // Get auth token from state
      const token = (getState() as any).auth.tokens?.accessToken;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      
      // Get tenant ID from state
      const tenantId = (getState() as any).auth.tenantId;
      if (tenantId) {
        headers.set('x-tenant-id', tenantId);
      }
      
      headers.set('content-type', 'application/json');
      return headers;
    },
  }),
  tagTypes: [
    'Notifications', 
    'DeviceRegistration', 
    'TopicSubscriptions', 
    'NotificationPreferences',
    'NotificationStats'
  ],
  endpoints: (builder) => ({
    // Device management endpoints
    registerDevice: builder.mutation<{ success: boolean; deviceId: string }, DeviceRegistrationData>({
      query: (deviceData) => ({
        url: '/devices/register',
        method: 'POST',
        body: deviceData,
      }),
      invalidatesTags: ['DeviceRegistration'],
    }),
    
    updateDeviceToken: builder.mutation<{ success: boolean }, { deviceId: string; fcmToken: string }>({
      query: ({ deviceId, fcmToken }) => ({
        url: `/devices/${deviceId}/token`,
        method: 'PUT',
        body: { fcmToken },
      }),
      invalidatesTags: ['DeviceRegistration'],
    }),
    
    deactivateDevice: builder.mutation<{ success: boolean }, string>({
      query: (deviceId) => ({
        url: `/devices/${deviceId}/deactivate`,
        method: 'POST',
      }),
      invalidatesTags: ['DeviceRegistration'],
    }),
    
    // Topic subscription endpoints
    subscribeToTopics: builder.mutation<{ success: boolean }, TopicSubscriptionData>({
      query: (subscriptionData) => ({
        url: '/topics/subscribe',
        method: 'POST',
        body: subscriptionData,
      }),
      invalidatesTags: ['TopicSubscriptions'],
    }),
    
    unsubscribeFromTopics: builder.mutation<{ success: boolean }, TopicSubscriptionData>({
      query: (subscriptionData) => ({
        url: '/topics/unsubscribe',
        method: 'POST',
        body: subscriptionData,
      }),
      invalidatesTags: ['TopicSubscriptions'],
    }),
    
    getSubscribedTopics: builder.query<{ topics: string[] }, string>({
      query: (deviceToken) => `/topics/subscriptions/${deviceToken}`,
      providesTags: ['TopicSubscriptions'],
    }),
    
    // Notification history endpoints
    getNotificationHistory: builder.query<NotificationHistoryResponse, NotificationHistoryQuery>({
      query: (params = {}) => ({
        url: '/history',
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          ...params,
        },
      }),
      providesTags: ['Notifications'],
      // Keep cache for 5 minutes
      keepUnusedDataFor: 300,
    }),
    
    markNotificationsAsRead: builder.mutation<{ success: boolean; count: number }, NotificationMarkAsReadData>({
      query: (data) => ({
        url: '/mark-read',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Notifications', 'NotificationStats'],
      // Optimistic update
      async onQueryStarted(data, { dispatch, queryFulfilled }) {
        try {
          const patchResult = dispatch(
            notificationApi.util.updateQueryData('getNotificationHistory', {}, (draft) => {
              data.notificationIds.forEach(id => {
                const notification = draft.notifications.find(n => n.id === id);
                if (notification) {
                  notification.read = true;
                }
              });
            })
          );
          
          await queryFulfilled;
        } catch {
          // Revert optimistic update on error
          // patchResult.undo();
        }
      },
    }),
    
    deleteNotifications: builder.mutation<{ success: boolean; count: number }, { notificationIds: string[] }>({
      query: (data) => ({
        url: '/delete',
        method: 'DELETE',
        body: data,
      }),
      invalidatesTags: ['Notifications', 'NotificationStats'],
    }),
    
    // Notification preferences endpoints
    syncNotificationPreferences: builder.mutation<{ success: boolean }, NotificationPreferencesSync>({
      query: (data) => ({
        url: '/preferences/sync',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['NotificationPreferences'],
    }),
    
    getNotificationPreferences: builder.query<NotificationPreferences, { userId: string; deviceId: string }>({
      query: ({ userId, deviceId }) => `/preferences/${userId}/${deviceId}`,
      providesTags: ['NotificationPreferences'],
    }),
    
    // Push notification sending (for admin/system use)
    sendPushNotification: builder.mutation<{ success: boolean; messageId: string }, PushNotificationSendData>({
      query: (data) => ({
        url: '/send',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Notification analytics
    getNotificationStats: builder.query<NotificationStatsResponse, { userId?: string; period?: string }>({
      query: (params = {}) => ({
        url: '/stats',
        params,
      }),
      providesTags: ['NotificationStats'],
      keepUnusedDataFor: 60, // Cache for 1 minute
    }),
    
    // Test notification endpoint
    sendTestNotification: builder.mutation<{ success: boolean }, { deviceToken: string; type: NotificationType }>({
      query: (data) => ({
        url: '/test',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Clear all notifications
    clearAllNotifications: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/clear-all',
        method: 'DELETE',
      }),
      invalidatesTags: ['Notifications', 'NotificationStats'],
    }),
    
    // Email notification endpoints (when backend is ready)
    sendEmailNotification: builder.mutation<{ success: boolean; emailId: string }, {
      to: string[];
      subject: string;
      template: string;
      data: any;
      priority?: 'high' | 'normal' | 'low';
    }>({
      query: (data) => ({
        url: '/email/send',
        method: 'POST',
        body: data,
      }),
    }),
    
    // SMS notification endpoints (optional)
    sendSMSNotification: builder.mutation<{ success: boolean; smsId: string }, {
      to: string[];
      message: string;
      priority?: 'high' | 'normal' | 'low';
    }>({
      query: (data) => ({
        url: '/sms/send',
        method: 'POST',
        body: data,
      }),
    }),
  }),
});

// Export hooks for use in components
export const {
  // Device management hooks
  useRegisterDeviceMutation,
  useUpdateDeviceTokenMutation,
  useDeactivateDeviceMutation,
  
  // Topic subscription hooks
  useSubscribeToTopicsMutation,
  useUnsubscribeFromTopicsMutation,
  useGetSubscribedTopicsQuery,
  
  // Notification history hooks
  useGetNotificationHistoryQuery,
  useLazyGetNotificationHistoryQuery,
  useMarkNotificationsAsReadMutation,
  useDeleteNotificationsMutation,
  
  // Preferences hooks
  useSyncNotificationPreferencesMutation,
  useGetNotificationPreferencesQuery,
  useLazyGetNotificationPreferencesQuery,
  
  // Push notification hooks
  useSendPushNotificationMutation,
  useSendTestNotificationMutation,
  useClearAllNotificationsMutation,
  
  // Analytics hooks
  useGetNotificationStatsQuery,
  useLazyGetNotificationStatsQuery,
  
  // Email/SMS hooks
  useSendEmailNotificationMutation,
  useSendSMSNotificationMutation,
} = notificationApi;

// Export API endpoints for direct use
export const {
  endpoints,
  util: { resetApiState },
} = notificationApi;

// Utility functions
export const prefetchNotificationHistory = (store: any, params?: NotificationHistoryQuery) => {
  store.dispatch(notificationApi.util.prefetch('getNotificationHistory', params || {}, { force: false }));
};

export const invalidateNotificationCache = (store: any) => {
  store.dispatch(notificationApi.util.invalidateTags(['Notifications', 'NotificationStats']));
};

export default notificationApi;