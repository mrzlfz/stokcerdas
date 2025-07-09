/**
 * Notification Message Generator
 * 
 * Generates proper titles and messages for different notification types
 * with Indonesian localization support
 */

import { NotificationType } from '../types';

export interface NotificationContent {
  title: string;
  message: string;
}

export interface NotificationData {
  productName?: string;
  currentStock?: number;
  locationName?: string;
  orderNumber?: string;
  customerName?: string;
  amount?: number;
  expiryDate?: string;
  alertType?: string;
  count?: number;
  [key: string]: any;
}

export class NotificationMessageGenerator {
  
  /**
   * Generate notification content based on type and data
   */
  static generateContent(
    type: NotificationType,
    category: string,
    data?: NotificationData
  ): NotificationContent {
    
    switch (type) {
      case NotificationType.LOW_STOCK:
        return this.generateLowStockContent(data);
        
      case NotificationType.EXPIRED:
        return this.generateExpiredContent(data);
        
      case NotificationType.EXPIRING_SOON:
        return this.generateExpiringSoonContent(data);
        
      case NotificationType.SUCCESS:
        return this.generateSuccessContent(category, data);
        
      case NotificationType.WARNING:
        return this.generateWarningContent(category, data);
        
      case NotificationType.ERROR:
        return this.generateErrorContent(category, data);
        
      case NotificationType.INFO:
      default:
        return this.generateInfoContent(category, data);
    }
  }

  /**
   * Generate low stock notification content
   */
  private static generateLowStockContent(data?: NotificationData): NotificationContent {
    const productName = data?.productName || 'Produk';
    const currentStock = data?.currentStock || 0;
    const locationName = data?.locationName || 'lokasi';

    return {
      title: '⚠️ Stok Menipis',
      message: `${productName} di ${locationName} tinggal ${currentStock} unit. Segera lakukan restock!`
    };
  }

  /**
   * Generate expired product notification content
   */
  private static generateExpiredContent(data?: NotificationData): NotificationContent {
    const productName = data?.productName || 'Produk';
    const count = data?.count || 1;

    return {
      title: '🚨 Produk Kedaluwarsa',
      message: count > 1 
        ? `${count} produk telah kedaluwarsa. Segera cek dan tindak lanjuti.`
        : `${productName} telah kedaluwarsa. Segera tindak lanjuti.`
    };
  }

  /**
   * Generate expiring soon notification content
   */
  private static generateExpiringSoonContent(data?: NotificationData): NotificationContent {
    const productName = data?.productName || 'Produk';
    const expiryDate = data?.expiryDate || 'segera';
    const count = data?.count || 1;

    return {
      title: '⏰ Produk Akan Kedaluwarsa',
      message: count > 1
        ? `${count} produk akan kedaluwarsa ${expiryDate}. Segera ambil tindakan.`
        : `${productName} akan kedaluwarsa ${expiryDate}. Segera ambil tindakan.`
    };
  }

  /**
   * Generate success notification content
   */
  private static generateSuccessContent(category: string, data?: NotificationData): NotificationContent {
    switch (category.toLowerCase()) {
      case 'inventory':
        return {
          title: '✅ Inventory Berhasil',
          message: data?.message || 'Operasi inventory berhasil dilakukan.'
        };
        
      case 'order':
        const orderNumber = data?.orderNumber || '';
        return {
          title: '✅ Pesanan Berhasil',
          message: orderNumber 
            ? `Pesanan ${orderNumber} berhasil diproses.`
            : 'Pesanan berhasil diproses.'
        };
        
      case 'sync':
        return {
          title: '✅ Sinkronisasi Berhasil',
          message: 'Data berhasil disinkronkan dengan server.'
        };
        
      default:
        return {
          title: '✅ Berhasil',
          message: data?.message || 'Operasi berhasil dilakukan.'
        };
    }
  }

  /**
   * Generate warning notification content
   */
  private static generateWarningContent(category: string, data?: NotificationData): NotificationContent {
    switch (category.toLowerCase()) {
      case 'inventory':
        return {
          title: '⚠️ Peringatan Inventory',
          message: data?.message || 'Ada masalah dengan inventory yang perlu perhatian.'
        };
        
      case 'sync':
        return {
          title: '⚠️ Masalah Sinkronisasi',
          message: 'Beberapa data gagal disinkronkan. Coba lagi nanti.'
        };
        
      case 'connection':
        return {
          title: '⚠️ Masalah Koneksi',
          message: 'Koneksi internet tidak stabil. Beberapa fitur mungkin terbatas.'
        };
        
      default:
        return {
          title: '⚠️ Perhatian',
          message: data?.message || 'Ada sesuatu yang perlu perhatian Anda.'
        };
    }
  }

  /**
   * Generate error notification content
   */
  private static generateErrorContent(category: string, data?: NotificationData): NotificationContent {
    switch (category.toLowerCase()) {
      case 'inventory':
        return {
          title: '❌ Error Inventory',
          message: data?.message || 'Terjadi kesalahan saat memproses inventory.'
        };
        
      case 'order':
        return {
          title: '❌ Error Pesanan',
          message: data?.message || 'Terjadi kesalahan saat memproses pesanan.'
        };
        
      case 'sync':
        return {
          title: '❌ Gagal Sinkronisasi',
          message: 'Sinkronisasi data gagal. Periksa koneksi dan coba lagi.'
        };
        
      case 'auth':
        return {
          title: '❌ Error Autentikasi',
          message: 'Sesi Anda telah berakhir. Silakan login kembali.'
        };
        
      default:
        return {
          title: '❌ Terjadi Kesalahan',
          message: data?.message || 'Terjadi kesalahan yang tidak terduga.'
        };
    }
  }

  /**
   * Generate info notification content
   */
  private static generateInfoContent(category: string, data?: NotificationData): NotificationContent {
    switch (category.toLowerCase()) {
      case 'update':
        return {
          title: 'ℹ️ Update Tersedia',
          message: 'Ada pembaruan aplikasi yang tersedia. Silakan update untuk fitur terbaru.'
        };
        
      case 'maintenance':
        return {
          title: 'ℹ️ Maintenance',
          message: 'Sistem sedang dalam pemeliharaan. Beberapa fitur mungkin tidak tersedia.'
        };
        
      case 'tips':
        return {
          title: '💡 Tips StokCerdas',
          message: data?.message || 'Tahukah Anda? Gunakan fitur barcode scanner untuk input yang lebih cepat!'
        };
        
      default:
        return {
          title: 'ℹ️ Informasi',
          message: data?.message || 'Ada informasi penting untuk Anda.'
        };
    }
  }

  /**
   * Generate unique notification ID
   */
  static generateNotificationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `notif_${timestamp}_${random}`;
  }

  /**
   * Validate notification type
   */
  static isValidNotificationType(type: string): type is NotificationType {
    return Object.values(NotificationType).includes(type as NotificationType);
  }

  /**
   * Get localized datetime string
   */
  static getLocalizedTimestamp(): string {
    return new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}