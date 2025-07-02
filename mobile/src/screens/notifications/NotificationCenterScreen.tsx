/**
 * Notification Center Screen Component
 * Menampilkan daftar notifikasi in-app dengan management features
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Redux
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  selectNotifications,
  selectUnreadCount,
  selectIsSelectionMode,
  selectSelectedNotifications,
  selectNotificationLoading,
  selectNotificationError,
  addNotification,
  markNotificationAsRead,
  markAllAsRead,
  markSelectedAsRead,
  removeNotification,
  removeSelectedNotifications,
  clearAllNotifications,
  toggleSelectionMode,
  toggleNotificationSelection,
  selectAllNotifications,
  clearSelection,
  setLoading,
  setRefreshing,
  clearError,
} from '@/store/slices/notificationSlice';

// API
import { useGetNotificationHistoryQuery } from '@/store/api/notificationApi';

// Components
import Button from '@/components/common/Button';

// Services
import pushNotificationService from '@/services/pushNotificationService';
import socketService from '@/services/socketService';
import notificationNavigationService from '@/services/notificationNavigationService';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import type { AppNotification, NotificationType } from '@/types';

interface NotificationCenterProps {}

const NotificationCenterScreen: React.FC<NotificationCenterProps> = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  
  // Redux state
  const notifications = useAppSelector(selectNotifications);
  const unreadCount = useAppSelector(selectUnreadCount);
  const isSelectionMode = useAppSelector(selectIsSelectionMode);
  const selectedNotifications = useAppSelector(selectSelectedNotifications);
  const isLoading = useAppSelector(selectNotificationLoading);
  const error = useAppSelector(selectNotificationError);
  
  // Local state for UI only
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  
  // RTK Query for fetching notification history
  const {
    data: notificationHistory,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    error: historyError,
  } = useGetNotificationHistoryQuery({
    page: 1,
    limit: 50,
  });

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
    setupNotificationListeners();
    
    // Animate entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    return () => {
      cleanupListeners();
    };
  }, []);

  /**
   * Load notifications from storage and API
   */
  const loadNotifications = async () => {
    try {
      dispatch(setLoading(true));
      
      // Clear any existing errors
      if (error) {
        dispatch(clearError());
      }
      
      // Refetch from API if available
      if (refetchHistory) {
        await refetchHistory();
      }
      
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  /**
   * Get stored notifications from AsyncStorage
   */
  const getStoredNotifications = async (): Promise<AppNotification[]> => {
    try {
      // This would typically fetch from your local database or storage
      // For now, return mock data
      return [
        {
          id: '1',
          title: 'Stok Rendah',
          message: 'Produk Beras Premium tersisa 5 unit di Gudang Utama',
          type: 'low_stock' as NotificationType,
          category: 'inventory',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          read: false,
          actionable: true,
          data: {
            productId: 'prod_123',
            locationId: 'loc_456',
            currentStock: 5,
            reorderPoint: 10,
          },
        },
        {
          id: '2',
          title: 'Produk Kadaluwarsa',
          message: 'Susu UHT akan kadaluwarsa dalam 3 hari',
          type: 'expiring_soon' as NotificationType,
          category: 'expiry',
          timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          read: false,
          actionable: true,
          data: {
            productId: 'prod_789',
            expiryDate: '2025-07-02',
            quantity: 24,
          },
        },
        {
          id: '3',
          title: 'Stock Adjustment',
          message: 'Stock adjustment berhasil untuk 15 produk',
          type: 'success' as NotificationType,
          category: 'inventory',
          timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
          read: true,
          actionable: false,
          data: {
            adjustmentId: 'adj_001',
            itemsAdjusted: 15,
          },
        },
        {
          id: '4',
          title: 'Sistem Maintenance',
          message: 'Maintenance terjadwal akan dimulai pukul 02:00 WIB',
          type: 'info' as NotificationType,
          category: 'system',
          timestamp: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
          read: true,
          actionable: false,
          data: {
            maintenanceStart: '2025-07-01T02:00:00Z',
            duration: '2 hours',
          },
        },
      ];
    } catch (error) {
      console.error('Error getting stored notifications:', error);
      return [];
    }
  };

  /**
   * Setup notification listeners for real-time updates
   */
  const setupNotificationListeners = () => {
    // Listen for new notifications from push service
    pushNotificationService.on('notification:received', handleNewNotification);
    
    // Listen for real-time alerts from socket service
    socketService.on('alert:notification', handleRealtimeAlert);
    socketService.on('inventory:low_stock', handleLowStockAlert);
  };

  /**
   * Cleanup event listeners
   */
  const cleanupListeners = () => {
    pushNotificationService.off('notification:received', handleNewNotification);
    socketService.off('alert:notification', handleRealtimeAlert);
    socketService.off('inventory:low_stock', handleLowStockAlert);
  };

  /**
   * Handle new notification received
   */
  const handleNewNotification = useCallback((notificationData: any) => {
    const newNotification: AppNotification = {
      id: notificationData.id || Date.now().toString(),
      title: notificationData.title,
      message: notificationData.message || notificationData.body,
      type: notificationData.type || 'info',
      category: notificationData.category || 'general',
      timestamp: new Date().toISOString(),
      read: false,
      actionable: notificationData.actionable || false,
      data: notificationData.data,
    };

    dispatch(addNotification(newNotification));
  }, [dispatch]);

  /**
   * Handle real-time alert from socket
   */
  const handleRealtimeAlert = useCallback((alertData: any) => {
    handleNewNotification({
      ...alertData,
      type: alertData.type || 'info',
      actionable: true,
    });
  }, [handleNewNotification]);

  /**
   * Handle low stock alert
   */
  const handleLowStockAlert = useCallback((alertData: any) => {
    handleNewNotification({
      ...alertData,
      type: 'low_stock',
      actionable: true,
    });
  }, [handleNewNotification]);

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  /**
   * Mark notification as read
   */
  const markAsRead = async (notificationId: string) => {
    dispatch(markNotificationAsRead(notificationId));
    
    // TODO: Also update on server via API when backend is ready
  };

  /**
   * Handle notification press
   */
  const handleNotificationPress = (notification: AppNotification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionable && notification.data) {
      handleNotificationAction(notification);
    }
  };

  /**
   * Handle notification action
   */
  const handleNotificationAction = async (notification: AppNotification) => {
    try {
      // Use notification navigation service for consistent navigation handling
      await notificationNavigationService.handleNotificationNavigation(notification);
    } catch (error) {
      console.error('Error handling notification action:', error);
    }
  };

  /**
   * Get notification icon and color
   */
  const getNotificationStyle = (notification: AppNotification) => {
    switch (notification.type) {
      case 'low_stock':
        return { icon: 'warning', color: UI_CONFIG.WARNING_COLOR };
      case 'expired':
        return { icon: 'error', color: UI_CONFIG.ERROR_COLOR };
      case 'expiring_soon':
        return { icon: 'schedule', color: '#FF9800' };
      case 'success':
        return { icon: 'check-circle', color: UI_CONFIG.SUCCESS_COLOR };
      case 'info':
        return { icon: 'info', color: UI_CONFIG.PRIMARY_COLOR };
      case 'error':
        return { icon: 'error', color: UI_CONFIG.ERROR_COLOR };
      default:
        return { icon: 'notifications', color: UI_CONFIG.TEXT_SECONDARY };
    }
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: diffDays > 365 ? 'numeric' : undefined,
    });
  };

  /**
   * Toggle selection mode
   */
  const handleToggleSelectionMode = () => {
    dispatch(toggleSelectionMode());
  };

  /**
   * Toggle item selection
   */
  const handleToggleItemSelection = (id: string) => {
    dispatch(toggleNotificationSelection(id));
  };

  /**
   * Mark selected as read
   */
  const handleMarkSelectedAsRead = async () => {
    const unreadSelected = selectedNotifications.filter(id => 
      notifications.find(n => n.id === id && !n.read)
    );

    if (unreadSelected.length === 0) {
      Alert.alert('Info', 'Semua notifikasi yang dipilih sudah dibaca');
      return;
    }

    dispatch(markSelectedAsRead());
  };

  /**
   * Delete selected notifications
   */
  const handleDeleteSelected = () => {
    Alert.alert(
      'Hapus Notifikasi',
      `Hapus ${selectedNotifications.length} notifikasi yang dipilih?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            dispatch(removeSelectedNotifications());
          },
        },
      ]
    );
  };

  /**
   * Clear all notifications
   */
  const handleClearAllNotifications = () => {
    Alert.alert(
      'Hapus Semua',
      'Hapus semua notifikasi? Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            dispatch(clearAllNotifications());
            pushNotificationService.clearAllNotifications();
          },
        },
      ]
    );
  };

  /**
   * Render notification item
   */
  const renderNotificationItem = ({ item }: { item: AppNotification }) => {
    const style = getNotificationStyle(item);
    const isSelected = selectedNotifications.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.unreadItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => {
          if (isSelectionMode) {
            handleToggleItemSelection(item.id);
          } else {
            handleNotificationPress(item);
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            handleToggleSelectionMode();
            handleToggleItemSelection(item.id);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.iconContainer}>
              <Icon
                name={style.icon}
                size={24}
                color={style.color}
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            
            <View style={styles.notificationText}>
              <Text style={[styles.title, !item.read && styles.unreadTitle]}>
                {item.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(item.timestamp)}
              </Text>
            </View>
            
            {isSelectionMode && (
              <View style={styles.selectionCheckbox}>
                <Icon
                  name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={isSelected ? UI_CONFIG.PRIMARY_COLOR : UI_CONFIG.TEXT_SECONDARY}
                />
              </View>
            )}
            
            {!isSelectionMode && item.actionable && (
              <Icon
                name="chevron-right"
                size={20}
                color={UI_CONFIG.TEXT_SECONDARY}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render header
   */
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <Text style={styles.headerText}>Notifikasi</Text>
        <Text style={styles.headerSubtext}>
          {unreadCount} belum dibaca
        </Text>
      </View>
      
      <View style={styles.headerActions}>
        {!isSelectionMode ? (
          <>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleToggleSelectionMode}
            >
              <Icon name="checklist" size={24} color={UI_CONFIG.PRIMARY_COLOR} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClearAllNotifications}
            >
              <Icon name="clear-all" size={24} color={UI_CONFIG.TEXT_SECONDARY} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleToggleSelectionMode}
          >
            <Icon name="close" size={24} color={UI_CONFIG.TEXT_SECONDARY} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  /**
   * Render selection actions
   */
  const renderSelectionActions = () => {
    if (!isSelectionMode) return null;

    return (
      <View style={styles.selectionActions}>
        <Button
          title={`Pilih Semua (${notifications.length})`}
          onPress={() => {
            if (selectedNotifications.length === notifications.length) {
              dispatch(clearSelection());
            } else {
              dispatch(selectAllNotifications());
            }
          }}
          variant="outline"
          style={styles.selectionButton}
        />
        
        <Button
          title="Tandai Dibaca"
          onPress={handleMarkSelectedAsRead}
          disabled={selectedNotifications.length === 0}
          style={styles.selectionButton}
        />
        
        <Button
          title="Hapus"
          onPress={handleDeleteSelected}
          disabled={selectedNotifications.length === 0}
          variant="outline"
          style={[styles.selectionButton, { borderColor: UI_CONFIG.ERROR_COLOR }]}
        />
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="notifications-none" size={80} color={UI_CONFIG.TEXT_SECONDARY} />
      <Text style={styles.emptyTitle}>Tidak Ada Notifikasi</Text>
      <Text style={styles.emptyDescription}>
        Notifikasi tentang stok, kadaluwarsa, dan sistem akan muncul di sini
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {renderHeader()}
        {renderSelectionActions()}
        
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[UI_CONFIG.PRIMARY_COLOR]}
              tintColor={UI_CONFIG.PRIMARY_COLOR}
            />
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerTitle: {
    flex: 1,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
  },
  headerSubtext: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
    gap: 8,
  },
  selectionButton: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  unreadItem: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 4,
    borderLeftColor: UI_CONFIG.PRIMARY_COLOR,
  },
  selectedItem: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
  },
  notificationContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
  },
  notificationText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  selectionCheckbox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default NotificationCenterScreen;