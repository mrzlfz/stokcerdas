/**
 * Dashboard Screen Component
 * Halaman utama dashboard dengan overview metrics, quick actions, dan recent activities
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Components
import Button from '@/components/common/Button';

// API Hooks
import { 
  useGetProductStatsQuery,
  useGetInventoryStatsQuery,
  useGetRealtimeStockLevelsQuery,
} from '@/store/api';

// Types & Config
import { UI_CONFIG } from '@/constants/config';
import { useAppSelector } from '@/store/hooks';

const { width } = Dimensions.get('window');

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: string;
  onPress?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = UI_CONFIG.PRIMARY_COLOR,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.metricCard, { borderLeftColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.metricHeader}>
      <Icon name={icon} size={24} color={color} />
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
  </TouchableOpacity>
);

interface QuickActionProps {
  title: string;
  icon: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  icon,
  onPress,
  variant = 'primary',
}) => (
  <TouchableOpacity
    style={[
      styles.quickAction,
      variant === 'secondary' && styles.quickActionSecondary,
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon
      name={icon}
      size={32}
      color={variant === 'primary' ? '#FFFFFF' : UI_CONFIG.PRIMARY_COLOR}
    />
    <Text
      style={[
        styles.quickActionText,
        variant === 'secondary' && styles.quickActionTextSecondary,
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const user = useAppSelector((state) => state.auth?.user);
  const [refreshing, setRefreshing] = useState(false);

  // API Queries
  const {
    data: productStats,
    isLoading: isLoadingProducts,
    refetch: refetchProducts,
  } = useGetProductStatsQuery();

  const {
    data: inventoryStats,
    isLoading: isLoadingInventory,
    refetch: refetchInventory,
  } = useGetInventoryStatsQuery();

  const {
    data: realtimeStock,
    isLoading: isLoadingRealtime,
    refetch: refetchRealtime,
  } = useGetRealtimeStockLevelsQuery({});

  const isLoading = isLoadingProducts || isLoadingInventory || isLoadingRealtime;

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProducts(),
        refetchInventory(),
        refetchRealtime(),
      ]);
    } catch (error) {
      Alert.alert('Error', 'Gagal memperbarui data. Silakan coba lagi.');
    } finally {
      setRefreshing(false);
    }
  }, [refetchProducts, refetchInventory, refetchRealtime]);

  // Navigation handlers
  const handleNavigateToProducts = () => {
    navigation.navigate('ProductsStack' as never);
  };

  const handleNavigateToInventory = () => {
    navigation.navigate('InventoryStack' as never);
  };

  const handleNavigateToReports = () => {
    navigation.navigate('ReportsStack' as never);
  };

  const handleNavigateToScanner = () => {
    navigation.navigate('ScannerStack' as never);
  };

  const handleNavigateToStockAdjustment = () => {
    navigation.navigate('InventoryStack', {
      screen: 'StockAdjustment',
    } as never);
  };

  const handleNavigateToLowStock = () => {
    navigation.navigate('ReportsStack', {
      screen: 'LowStockReport',
    } as never);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Format number
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>
                {user?.name || 'Pengguna'}
              </Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Icon name="notifications" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Metrics Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Total Produk"
              value={formatNumber(productStats?.data?.totalProducts || 0)}
              subtitle={`${productStats?.data?.activeProducts || 0} aktif`}
              icon="inventory"
              color={UI_CONFIG.PRIMARY_COLOR}
              onPress={handleNavigateToProducts}
            />
            
            <MetricCard
              title="Nilai Inventori"
              value={formatCurrency(inventoryStats?.data?.totalValue || 0)}
              subtitle={`${formatNumber(inventoryStats?.data?.totalItems || 0)} item`}
              icon="monetization-on"
              color={UI_CONFIG.ACCENT_COLOR}
              onPress={handleNavigateToInventory}
            />
            
            <MetricCard
              title="Stok Rendah"
              value={formatNumber(inventoryStats?.data?.lowStockItems || 0)}
              subtitle="Perlu perhatian"
              icon="warning"
              color="#FF9800"
              onPress={handleNavigateToLowStock}
            />
            
            <MetricCard
              title="Stok Habis"
              value={formatNumber(inventoryStats?.data?.outOfStockItems || 0)}
              subtitle="Segera restock"
              icon="error"
              color="#F44336"
              onPress={handleNavigateToReports}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              title="Scan Barcode"
              icon="qr-code-scanner"
              onPress={handleNavigateToScanner}
            />
            <QuickAction
              title="Adjustment"
              icon="tune"
              onPress={handleNavigateToStockAdjustment}
              variant="secondary"
            />
            <QuickAction
              title="Laporan"
              icon="assessment"
              onPress={handleNavigateToReports}
              variant="secondary"
            />
            <QuickAction
              title="Produk Baru"
              icon="add-box"
              onPress={() =>
                navigation.navigate('ProductsStack', {
                  screen: 'ProductCreate',
                } as never)
              }
              variant="secondary"
            />
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>
            <TouchableOpacity onPress={handleNavigateToReports}>
              <Text style={styles.seeAllText}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          
          {/* Mock recent activities - in real app this would come from API */}
          <View style={styles.activityCard}>
            <Icon name="add" size={20} color={UI_CONFIG.SUCCESS_COLOR} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Stock Adjustment</Text>
              <Text style={styles.activityDescription}>
                +50 unit Beras Premium - Gudang Utama
              </Text>
              <Text style={styles.activityTime}>2 jam yang lalu</Text>
            </View>
          </View>
          
          <View style={styles.activityCard}>
            <Icon name="swap-horiz" size={20} color={UI_CONFIG.PRIMARY_COLOR} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Transfer Stock</Text>
              <Text style={styles.activityDescription}>
                25 unit Minyak Goreng dari Gudang ke Toko A
              </Text>
              <Text style={styles.activityTime}>4 jam yang lalu</Text>
            </View>
          </View>
          
          <View style={styles.activityCard}>
            <Icon name="warning" size={20} color="#FF9800" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Alert Stok Rendah</Text>
              <Text style={styles.activityDescription}>
                Gula Pasir tersisa 5 unit di Toko B
              </Text>
              <Text style={styles.activityTime}>6 jam yang lalu</Text>
            </View>
          </View>
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
  header: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    fontWeight: '600',
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginLeft: 8,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    width: (width - 72) / 2,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: UI_CONFIG.PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  quickActionTextSecondary: {
    color: UI_CONFIG.PRIMARY_COLOR,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginBottom: 4,
    lineHeight: 20,
  },
  activityTime: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_LIGHT,
  },
  bottomSpacing: {
    height: 24,
  },
});

export default DashboardScreen;