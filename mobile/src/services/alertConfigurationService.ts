/**
 * Alert Configuration Service
 * Mengelola konfigurasi dan pemicu untuk berbagai jenis alert
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Config & Types
import { STORAGE_KEYS, NOTIFICATION_CONFIG } from '@/constants/config';
import type { NotificationType } from '@/types';

export interface AlertRule {
  id: string;
  type: AlertType;
  name: string;
  description: string;
  isEnabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  priority: 'high' | 'medium' | 'low';
  frequency: AlertFrequency;
  createdAt: string;
  updatedAt: string;
}

export type AlertType = 
  | 'low_stock'
  | 'out_of_stock'
  | 'expiring_soon'
  | 'expired'
  | 'overstock'
  | 'negative_stock'
  | 'price_change'
  | 'system_error'
  | 'maintenance'
  | 'backup_failed'
  | 'sync_failed';

export interface AlertCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
  value: any;
}

export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'sms';
  enabled: boolean;
  configuration: any;
}

export type AlertFrequency = 
  | 'immediate'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'once';

export interface AlertConfiguration {
  rules: AlertRule[];
  globalSettings: {
    enabledAlerts: boolean;
    quietHours: {
      enabled: boolean;
      startTime: string; // HH:mm format
      endTime: string;   // HH:mm format
    };
    maxAlertsPerDay: number;
    alertCooldown: number; // minutes
  };
}

class AlertConfigurationService {
  private configuration: AlertConfiguration | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize alert configuration service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Alert Configuration Service...');

      // Load configuration from storage
      await this.loadConfiguration();

      // Create default rules if none exist
      if (!this.configuration || this.configuration.rules.length === 0) {
        await this.createDefaultRules();
      }

      this.isInitialized = true;
      console.log('Alert Configuration Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Alert Configuration Service:', error);
    }
  }

  /**
   * Load configuration from storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const storedConfig = await AsyncStorage.getItem('alert_configuration');
      
      if (storedConfig) {
        this.configuration = JSON.parse(storedConfig);
      } else {
        // Initialize with default configuration
        this.configuration = {
          rules: [],
          globalSettings: {
            enabledAlerts: true,
            quietHours: {
              enabled: false,
              startTime: '22:00',
              endTime: '08:00',
            },
            maxAlertsPerDay: 50,
            alertCooldown: 15, // 15 minutes
          },
        };
      }
    } catch (error) {
      console.error('Error loading alert configuration:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private async saveConfiguration(): Promise<void> {
    try {
      if (this.configuration) {
        await AsyncStorage.setItem('alert_configuration', JSON.stringify(this.configuration));
      }
    } catch (error) {
      console.error('Error saving alert configuration:', error);
    }
  }

  /**
   * Create default alert rules
   */
  private async createDefaultRules(): Promise<void> {
    const defaultRules: AlertRule[] = [
      {
        id: 'low_stock_default',
        type: 'low_stock',
        name: 'Stok Rendah',
        description: 'Alert ketika stok produk mencapai titik reorder',
        isEnabled: true,
        conditions: [
          {
            field: 'quantityOnHand',
            operator: 'lte',
            value: 'reorderPoint',
          },
          {
            field: 'quantityOnHand',
            operator: 'gt',
            value: 0,
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'high',
              sound: true,
              vibration: true,
            },
          },
        ],
        priority: 'high',
        frequency: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'out_of_stock_default',
        type: 'out_of_stock',
        name: 'Stok Habis',
        description: 'Alert ketika stok produk habis',
        isEnabled: true,
        conditions: [
          {
            field: 'quantityOnHand',
            operator: 'eq',
            value: 0,
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'high',
              sound: true,
              vibration: true,
            },
          },
        ],
        priority: 'high',
        frequency: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'expiring_soon_default',
        type: 'expiring_soon',
        name: 'Akan Kadaluwarsa',
        description: 'Alert untuk produk yang akan kadaluwarsa dalam 7 hari',
        isEnabled: true,
        conditions: [
          {
            field: 'expiryDate',
            operator: 'lte',
            value: 'now+7days',
          },
          {
            field: 'expiryDate',
            operator: 'gt',
            value: 'now',
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'medium',
              sound: false,
              vibration: false,
            },
          },
        ],
        priority: 'medium',
        frequency: 'daily',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'expired_default',
        type: 'expired',
        name: 'Produk Kadaluwarsa',
        description: 'Alert untuk produk yang sudah kadaluwarsa',
        isEnabled: true,
        conditions: [
          {
            field: 'expiryDate',
            operator: 'lt',
            value: 'now',
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'high',
              sound: true,
              vibration: true,
            },
          },
        ],
        priority: 'high',
        frequency: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'overstock_default',
        type: 'overstock',
        name: 'Overstock',
        description: 'Alert ketika stok melebihi batas maksimum',
        isEnabled: false, // Disabled by default
        conditions: [
          {
            field: 'quantityOnHand',
            operator: 'gt',
            value: 'maxStockLevel',
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'low',
              sound: false,
              vibration: false,
            },
          },
        ],
        priority: 'low',
        frequency: 'daily',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'negative_stock_default',
        type: 'negative_stock',
        name: 'Stok Negatif',
        description: 'Alert ketika stok menjadi negatif (error kondisi)',
        isEnabled: true,
        conditions: [
          {
            field: 'quantityOnHand',
            operator: 'lt',
            value: 0,
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'high',
              sound: true,
              vibration: true,
            },
          },
        ],
        priority: 'high',
        frequency: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'system_error_default',
        type: 'system_error',
        name: 'Error Sistem',
        description: 'Alert untuk error sistem kritis',
        isEnabled: true,
        conditions: [
          {
            field: 'errorLevel',
            operator: 'in',
            value: ['error', 'critical'],
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'high',
              sound: true,
              vibration: true,
            },
          },
        ],
        priority: 'high',
        frequency: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'maintenance_default',
        type: 'maintenance',
        name: 'Maintenance Sistem',
        description: 'Alert untuk jadwal maintenance sistem',
        isEnabled: true,
        conditions: [
          {
            field: 'maintenanceType',
            operator: 'in',
            value: ['scheduled', 'emergency'],
          },
        ],
        actions: [
          {
            type: 'notification',
            enabled: true,
            configuration: {
              priority: 'medium',
              sound: false,
              vibration: false,
            },
          },
        ],
        priority: 'medium',
        frequency: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    if (this.configuration) {
      this.configuration.rules = defaultRules;
      await this.saveConfiguration();
    }

    console.log(`Created ${defaultRules.length} default alert rules`);
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.configuration?.rules || [];
  }

  /**
   * Get alert rule by ID
   */
  getAlertRule(id: string): AlertRule | null {
    return this.configuration?.rules.find(rule => rule.id === id) || null;
  }

  /**
   * Get alert rules by type
   */
  getAlertRulesByType(type: AlertType): AlertRule[] {
    return this.configuration?.rules.filter(rule => rule.type === type) || [];
  }

  /**
   * Get enabled alert rules
   */
  getEnabledAlertRules(): AlertRule[] {
    return this.configuration?.rules.filter(rule => rule.isEnabled) || [];
  }

  /**
   * Add new alert rule
   */
  async addAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const newRule: AlertRule = {
      ...rule,
      id: `custom_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.configuration) {
      this.configuration.rules.push(newRule);
      await this.saveConfiguration();
    }

    return newRule.id;
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<boolean> {
    if (!this.configuration) return false;

    const ruleIndex = this.configuration.rules.findIndex(rule => rule.id === id);
    
    if (ruleIndex === -1) return false;

    this.configuration.rules[ruleIndex] = {
      ...this.configuration.rules[ruleIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveConfiguration();
    return true;
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(id: string): Promise<boolean> {
    if (!this.configuration) return false;

    const ruleIndex = this.configuration.rules.findIndex(rule => rule.id === id);
    
    if (ruleIndex === -1) return false;

    this.configuration.rules.splice(ruleIndex, 1);
    await this.saveConfiguration();
    return true;
  }

  /**
   * Enable/disable alert rule
   */
  async toggleAlertRule(id: string, enabled: boolean): Promise<boolean> {
    return this.updateAlertRule(id, { isEnabled: enabled });
  }

  /**
   * Get global settings
   */
  getGlobalSettings() {
    return this.configuration?.globalSettings || null;
  }

  /**
   * Update global settings
   */
  async updateGlobalSettings(settings: Partial<AlertConfiguration['globalSettings']>): Promise<void> {
    if (this.configuration) {
      this.configuration.globalSettings = {
        ...this.configuration.globalSettings,
        ...settings,
      };
      await this.saveConfiguration();
    }
  }

  /**
   * Check if alerts should be quiet now
   */
  isQuietTime(): boolean {
    if (!this.configuration?.globalSettings.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { startTime, endTime } = this.configuration.globalSettings.quietHours;
    
    // Handle cases where quiet hours span midnight
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Check if alert rule matches given data
   */
  evaluateAlertRule(rule: AlertRule, data: any): boolean {
    if (!rule.isEnabled) return false;

    // Check all conditions must be met (AND logic)
    return rule.conditions.every(condition => {
      const fieldValue = this.getFieldValue(data, condition.field);
      const conditionValue = this.resolveValue(condition.value, data);
      
      return this.evaluateCondition(fieldValue, condition.operator, conditionValue);
    });
  }

  /**
   * Get field value from data object
   */
  private getFieldValue(data: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], data);
  }

  /**
   * Resolve dynamic values like 'now', 'now+7days', etc.
   */
  private resolveValue(value: any, data: any): any {
    if (typeof value !== 'string') return value;

    const now = new Date();

    switch (value) {
      case 'now':
        return now.toISOString();
      
      case 'reorderPoint':
        return data.reorderPoint || 10;
      
      case 'maxStockLevel':
        return data.maxStockLevel || 1000;
      
      default:
        // Handle relative dates like 'now+7days'
        if (value.startsWith('now+') || value.startsWith('now-')) {
          const match = value.match(/^now([+-])(\d+)(days?|hours?|minutes?)$/);
          if (match) {
            const [, operator, amount, unit] = match;
            const multiplier = operator === '+' ? 1 : -1;
            const duration = parseInt(amount) * multiplier;
            
            const date = new Date(now);
            
            switch (unit) {
              case 'day':
              case 'days':
                date.setDate(date.getDate() + duration);
                break;
              case 'hour':
              case 'hours':
                date.setHours(date.getHours() + duration);
                break;
              case 'minute':
              case 'minutes':
                date.setMinutes(date.getMinutes() + duration);
                break;
            }
            
            return date.toISOString();
          }
        }
        
        return value;
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(fieldValue: any, operator: AlertCondition['operator'], conditionValue: any): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === conditionValue;
      case 'ne':
        return fieldValue !== conditionValue;
      case 'gt':
        return fieldValue > conditionValue;
      case 'gte':
        return fieldValue >= conditionValue;
      case 'lt':
        return fieldValue < conditionValue;
      case 'lte':
        return fieldValue <= conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'nin':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(conditionValue);
      default:
        return false;
    }
  }

  /**
   * Get matching alert rules for given data
   */
  getMatchingAlertRules(data: any): AlertRule[] {
    if (!this.configuration) return [];

    return this.configuration.rules.filter(rule => 
      this.evaluateAlertRule(rule, data)
    );
  }

  /**
   * Get alert types configuration
   */
  getAlertTypesConfig(): Record<AlertType, { name: string; description: string; icon: string; defaultPriority: string }> {
    return {
      low_stock: {
        name: 'Stok Rendah',
        description: 'Notifikasi ketika stok mendekati titik reorder',
        icon: 'warning',
        defaultPriority: 'high',
      },
      out_of_stock: {
        name: 'Stok Habis',
        description: 'Notifikasi ketika stok habis',
        icon: 'error',
        defaultPriority: 'high',
      },
      expiring_soon: {
        name: 'Akan Kadaluwarsa',
        description: 'Notifikasi untuk produk yang akan kadaluwarsa',
        icon: 'schedule',
        defaultPriority: 'medium',
      },
      expired: {
        name: 'Kadaluwarsa',
        description: 'Notifikasi untuk produk yang sudah kadaluwarsa',
        icon: 'error',
        defaultPriority: 'high',
      },
      overstock: {
        name: 'Overstock',
        description: 'Notifikasi ketika stok berlebihan',
        icon: 'trending-up',
        defaultPriority: 'low',
      },
      negative_stock: {
        name: 'Stok Negatif',
        description: 'Notifikasi ketika stok menjadi negatif',
        icon: 'error',
        defaultPriority: 'high',
      },
      price_change: {
        name: 'Perubahan Harga',
        description: 'Notifikasi ketika ada perubahan harga',
        icon: 'attach-money',
        defaultPriority: 'medium',
      },
      system_error: {
        name: 'Error Sistem',
        description: 'Notifikasi untuk error sistem',
        icon: 'error',
        defaultPriority: 'high',
      },
      maintenance: {
        name: 'Maintenance',
        description: 'Notifikasi untuk jadwal maintenance',
        icon: 'build',
        defaultPriority: 'medium',
      },
      backup_failed: {
        name: 'Backup Gagal',
        description: 'Notifikasi ketika backup gagal',
        icon: 'error',
        defaultPriority: 'high',
      },
      sync_failed: {
        name: 'Sinkronisasi Gagal',
        description: 'Notifikasi ketika sinkronisasi gagal',
        icon: 'sync-problem',
        defaultPriority: 'medium',
      },
    };
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults(): Promise<void> {
    await AsyncStorage.removeItem('alert_configuration');
    this.configuration = null;
    await this.initialize();
  }
}

// Create singleton instance
const alertConfigurationService = new AlertConfigurationService();

export default alertConfigurationService;