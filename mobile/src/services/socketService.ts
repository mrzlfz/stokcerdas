/**
 * Socket Service
 * Manages WebSocket connection untuk real-time updates
 */

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '@/constants/config';

interface SocketEventData {
  type: string;
  payload: any;
  tenantId: string;
  timestamp: string;
}

interface InventoryUpdate {
  itemId: string;
  productId: string;
  locationId: string;
  quantityOnHand: number;
  quantityAvailable: number;
  lastMovementAt: string;
}

interface AlertNotification {
  id: string;
  type: 'low_stock' | 'expired' | 'expiring_soon' | 'stock_movement';
  title: string;
  message: string;
  data: any;
  timestamp: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second
  private maxReconnectDelay: number = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeEventListeners();
  }

  /**
   * Initialize socket connection
   */
  async connect(): Promise<void> {
    try {
      const [accessToken, tenantId] = await AsyncStorage.multiGet([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.TENANT_ID,
      ]);

      if (!accessToken[1] || !tenantId[1]) {
        console.warn('Cannot connect to socket: Missing auth credentials');
        return;
      }

      if (this.socket) {
        this.disconnect();
      }

      this.socket = io(API_CONFIG.WEBSOCKET_URL, {
        auth: {
          token: accessToken[1],
          tenantId: tenantId[1],
        },
        transports: ['websocket'],
        upgrade: true,
        autoConnect: true,
        reconnection: false, // We'll handle reconnection manually
        timeout: 20000,
      });

      this.setupSocketListeners();
      
      console.log('Socket connecting to:', API_CONFIG.WEBSOCKET_URL);
    } catch (error) {
      console.error('Failed to connect socket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    console.log('Socket disconnected');
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected with ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay
      
      // Join tenant room
      this.joinTenantRoom();
      
      // Emit connected event
      this.emit('socket:connected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      
      this.emit('socket:disconnected', { reason });
      
      // Auto-reconnect for certain reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      
      this.scheduleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      
      this.emit('socket:error', { error: error.message });
      this.scheduleReconnect();
    });

    // Inventory update events
    this.socket.on('inventory:updated', (data: InventoryUpdate) => {
      console.log('Inventory updated:', data);
      this.emit('inventory:updated', data);
    });

    this.socket.on('inventory:low_stock', (data: AlertNotification) => {
      console.log('Low stock alert:', data);
      this.emit('inventory:low_stock', data);
    });

    this.socket.on('inventory:stock_movement', (data: any) => {
      console.log('Stock movement:', data);
      this.emit('inventory:stock_movement', data);
    });

    // Alert events
    this.socket.on('alert:notification', (data: AlertNotification) => {
      console.log('Alert notification:', data);
      this.emit('alert:notification', data);
    });

    // System events
    this.socket.on('system:maintenance', (data: any) => {
      console.log('System maintenance:', data);
      this.emit('system:maintenance', data);
    });

    this.socket.on('auth:token_expired', () => {
      console.log('Token expired, reconnecting...');
      this.emit('auth:token_expired', {});
      // Token will be refreshed by auth middleware, then reconnect
      setTimeout(() => this.connect(), 2000);
    });
  }

  /**
   * Join tenant-specific room
   */
  private async joinTenantRoom(): Promise<void> {
    try {
      const tenantId = await AsyncStorage.getItem(STORAGE_KEYS.TENANT_ID);
      if (this.socket && tenantId) {
        this.socket.emit('join:tenant', { tenantId });
        console.log('Joined tenant room:', tenantId);
      }
    } catch (error) {
      console.error('Failed to join tenant room:', error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.emit('socket:max_reconnect_attempts', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Initialize event listener system
   */
  private initializeEventListeners(): void {
    this.listeners = new Map();
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in socket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Send data to server
   */
  emit(event: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot emit event: Socket not connected');
    }
  }

  /**
   * Get connection status
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  /**
   * Force reconnection
   */
  reconnect(): void {
    console.log('Force reconnecting socket...');
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;