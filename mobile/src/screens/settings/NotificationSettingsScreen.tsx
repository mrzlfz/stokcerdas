/**
 * Notification Settings Screen Component
 * Pengaturan notifikasi lengkap dengan kategori dan preferensi
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Components
import Button from '@/components/common/Button';

// Store
import {
  updateNotificationSettings,
  selectNotifications,
} from '@/store/slices/uiSlice';

// Services
import pushNotificationService from '@/services/pushNotificationService';

// Types & Config
import { UI_CONFIG, NOTIFICATION_CONFIG } from '@/constants/config';
import type { NotificationState } from '@/types';

interface NotificationCategoryItem {
  key: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

const NotificationSettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const notificationSettings = useSelector(selectNotifications);
  
  // Local state for settings
  const [settings, setSettings] = useState<NotificationState>(notificationSettings);
  const [permissionStatus, setPermissionStatus] = useState<{
    granted: boolean;
    canRequest: boolean;
    blocked: boolean;
  }>({ granted: false, canRequest: true, blocked: false });
  const [isLoading, setIsLoading] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  /**
   * Check current notification permission status
   */
  const checkNotificationPermission = async () => {
    try {
      const status = await pushNotificationService.checkNotificationPermission();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  };

  /**
   * Request notification permission
   */
  const requestNotificationPermission = async () => {
    try {
      setIsLoading(true);
      const granted = await pushNotificationService.requestNotificationPermission();
      
      if (granted) {
        setPermissionStatus({ granted: true, canRequest: false, blocked: false });
        // Enable notifications if permission granted
        handleSettingChange('enabled', true);
      } else {
        setPermissionStatus({ granted: false, canRequest: false, blocked: true });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      Alert.alert('Error', 'Gagal meminta izin notifikasi');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle setting change
   */
  const handleSettingChange = useCallback((key: keyof NotificationState, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /**
   * Handle category setting change
   */
  const handleCategoryChange = useCallback((category: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: enabled,
      },
    }));
  }, []);

  /**
   * Save settings
   */
  const saveSettings = async () => {
    try {
      setIsLoading(true);
      
      // Update Redux store
      dispatch(updateNotificationSettings(settings));
      
      // Update push notification service
      await pushNotificationService.updateNotificationSettings(settings);
      
      // Subscribe/unsubscribe from topics based on categories
      await updateTopicSubscriptions();
      
      Alert.alert('Berhasil', 'Pengaturan notifikasi telah disimpan');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'Gagal menyimpan pengaturan');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update topic subscriptions based on categories
   */
  const updateTopicSubscriptions = async () => {
    try {
      const topics = Object.keys(settings.categories);
      
      for (const topic of topics) {
        if (settings.categories[topic] && settings.enabled) {
          await pushNotificationService.subscribeToTopic(topic);
        } else {
          await pushNotificationService.unsubscribeFromTopic(topic);
        }
      }
    } catch (error) {
      console.error('Error updating topic subscriptions:', error);
    }
  };

  /**
   * Reset to default settings
   */
  const resetToDefaults = () => {
    Alert.alert(
      'Reset Pengaturan',
      'Kembalikan ke pengaturan default?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            setSettings({
              enabled: true,
              sound: true,
              vibration: true,
              badge: true,
              categories: {
                low_stock: true,
                expired: true,
                expiring_soon: true,
                stock_movement: true,
                system: true,
              },
            });
          },
        },
      ]
    );
  };

  /**
   * Get notification categories
   */
  const getNotificationCategories = (): NotificationCategoryItem[] => [
    {
      key: 'low_stock',
      title: 'Stok Rendah',
      description: 'Notifikasi ketika stok produk mendekati titik reorder',
      icon: 'warning',
      enabled: settings.categories.low_stock,
    },
    {
      key: 'expired',
      title: 'Produk Kadaluwarsa',
      description: 'Notifikasi untuk produk yang sudah kadaluwarsa',
      icon: 'error',
      enabled: settings.categories.expired,
    },
    {
      key: 'expiring_soon',
      title: 'Akan Kadaluwarsa',
      description: 'Notifikasi untuk produk yang akan kadaluwarsa',
      icon: 'schedule',
      enabled: settings.categories.expiring_soon,
    },
    {
      key: 'stock_movement',
      title: 'Pergerakan Stok',
      description: 'Notifikasi untuk transaksi dan perubahan stok',
      icon: 'swap-horiz',
      enabled: settings.categories.stock_movement,
    },
    {
      key: 'system',
      title: 'Sistem',
      description: 'Notifikasi sistem dan maintenance',
      icon: 'settings',
      enabled: settings.categories.system,
    },
  ];

  /**
   * Render permission section
   */
  const renderPermissionSection = () => {
    if (permissionStatus.granted) {
      return (
        <View style={styles.permissionGranted}>
          <Icon name="check-circle" size={24} color={UI_CONFIG.SUCCESS_COLOR} />
          <Text style={styles.permissionText}>Izin notifikasi aktif</Text>
        </View>
      );
    }

    if (permissionStatus.blocked) {
      return (
        <View style={styles.permissionBlocked}>
          <Icon name="block" size={24} color={UI_CONFIG.ERROR_COLOR} />
          <View style={styles.permissionContent}>
            <Text style={styles.permissionTitle}>Izin Notifikasi Diblokir</Text>
            <Text style={styles.permissionDescription}>
              Untuk menerima notifikasi, aktifkan izin di pengaturan aplikasi
            </Text>
            <Button
              title="Buka Pengaturan"
              onPress={() => pushNotificationService.requestNotificationPermission()}
              style={styles.permissionButton}
              variant="outline"
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.permissionPending}>
        <Icon name="notifications-off" size={24} color={UI_CONFIG.WARNING_COLOR} />
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>Izin Notifikasi Diperlukan</Text>
          <Text style={styles.permissionDescription}>
            Berikan izin untuk menerima notifikasi penting tentang inventori
          </Text>
          <Button
            title="Berikan Izin"
            onPress={requestNotificationPermission}
            loading={isLoading}
            style={styles.permissionButton}
          />
        </View>
      </View>
    );
  };

  /**
   * Render setting item
   */
  const renderSettingItem = (
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled: boolean = false
  ) => (
    <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, disabled && styles.settingTitleDisabled]}>
          {title}
        </Text>
        <Text style={[styles.settingDescription, disabled && styles.settingDescriptionDisabled]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ 
          false: UI_CONFIG.BORDER_COLOR, 
          true: `${UI_CONFIG.PRIMARY_COLOR}50` 
        }}
        thumbColor={value ? UI_CONFIG.PRIMARY_COLOR : '#FFFFFF'}
        ios_backgroundColor={UI_CONFIG.BORDER_COLOR}
      />
    </View>
  );

  /**
   * Render category item
   */
  const renderCategoryItem = (category: NotificationCategoryItem) => (
    <View key={category.key} style={[
      styles.categoryItem,
      (!settings.enabled || !permissionStatus.granted) && styles.categoryItemDisabled
    ]}>
      <View style={styles.categoryHeader}>
        <Icon 
          name={category.icon} 
          size={24} 
          color={category.enabled && settings.enabled ? UI_CONFIG.PRIMARY_COLOR : UI_CONFIG.TEXT_SECONDARY} 
        />
        <View style={styles.categoryContent}>
          <Text style={[
            styles.categoryTitle,
            (!settings.enabled || !permissionStatus.granted) && styles.categoryTitleDisabled
          ]}>
            {category.title}
          </Text>
          <Text style={[
            styles.categoryDescription,
            (!settings.enabled || !permissionStatus.granted) && styles.categoryDescriptionDisabled
          ]}>
            {category.description}
          </Text>
        </View>
        <Switch
          value={category.enabled}
          onValueChange={(value) => handleCategoryChange(category.key, value)}
          disabled={!settings.enabled || !permissionStatus.granted}
          trackColor={{ 
            false: UI_CONFIG.BORDER_COLOR, 
            true: `${UI_CONFIG.PRIMARY_COLOR}50` 
          }}
          thumbColor={category.enabled ? UI_CONFIG.PRIMARY_COLOR : '#FFFFFF'}
          ios_backgroundColor={UI_CONFIG.BORDER_COLOR}
        />
      </View>
    </View>
  );

  const isNotificationDisabled = !settings.enabled || !permissionStatus.granted;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Permission Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Izin</Text>
          {renderPermissionSection()}
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pengaturan Umum</Text>
          <View style={styles.settingsContainer}>
            {renderSettingItem(
              'Aktifkan Notifikasi',
              'Terima notifikasi push di perangkat ini',
              settings.enabled,
              (value) => handleSettingChange('enabled', value),
              !permissionStatus.granted
            )}
            
            {renderSettingItem(
              'Suara',
              'Putar suara saat menerima notifikasi',
              settings.sound,
              (value) => handleSettingChange('sound', value),
              isNotificationDisabled
            )}
            
            {renderSettingItem(
              'Getar',
              'Getarkan perangkat saat menerima notifikasi',
              settings.vibration,
              (value) => handleSettingChange('vibration', value),
              isNotificationDisabled
            )}
            
            {renderSettingItem(
              'Badge',
              'Tampilkan badge angka di ikon aplikasi',
              settings.badge,
              (value) => handleSettingChange('badge', value),
              isNotificationDisabled
            )}
          </View>
        </View>

        {/* Notification Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori Notifikasi</Text>
          <Text style={styles.sectionDescription}>
            Pilih jenis notifikasi yang ingin Anda terima
          </Text>
          <View style={styles.categoriesContainer}>
            {getNotificationCategories().map(renderCategoryItem)}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Simpan Pengaturan"
            onPress={saveSettings}
            loading={isLoading}
            style={styles.saveButton}
          />
          
          <Button
            title="Reset ke Default"
            onPress={resetToDefaults}
            variant="outline"
            style={styles.resetButton}
          />
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  sectionDescription: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 16,
    marginHorizontal: 20,
    lineHeight: 20,
  },
  
  // Permission styles
  permissionGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  permissionBlocked: {
    backgroundColor: '#FFEBEE',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  permissionPending: {
    backgroundColor: '#FFF3E0',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  permissionContent: {
    flex: 1,
  },
  permissionText: {
    fontSize: 16,
    color: UI_CONFIG.SUCCESS_COLOR,
    fontWeight: '600',
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionButton: {
    alignSelf: 'flex-start',
  },
  
  // Settings styles
  settingsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  settingTitleDisabled: {
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  settingDescription: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 18,
  },
  settingDescriptionDisabled: {
    color: '#C0C0C0',
  },
  
  // Categories styles
  categoriesContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
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
  categoryItem: {
    borderBottomWidth: 1,
    borderBottomColor: UI_CONFIG.BORDER_COLOR,
  },
  categoryItemDisabled: {
    opacity: 0.5,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 2,
  },
  categoryTitleDisabled: {
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  categoryDescription: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    lineHeight: 18,
  },
  categoryDescriptionDisabled: {
    color: '#C0C0C0',
  },
  
  // Actions styles
  actions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  saveButton: {
    marginBottom: 8,
  },
  resetButton: {
    borderColor: UI_CONFIG.TEXT_SECONDARY,
  },
  bottomSpacing: {
    height: 24,
  },
});

export default NotificationSettingsScreen;