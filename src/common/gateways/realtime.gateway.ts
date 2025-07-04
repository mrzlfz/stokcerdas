import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';

import { InventoryUpdateEvent } from '../../inventory/services/inventory-realtime.service';

export interface AuthenticatedSocket extends Socket {
  tenantId?: string;
  userId?: string;
  userRoles?: string[];
}

export interface ClientSubscription {
  inventoryItems?: string[];
  locations?: string[];
  products?: string[];
  alertTypes?: string[];
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: 'realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private tenantRooms = new Map<string, Set<string>>(); // tenantId -> Set of socketIds
  private clientSubscriptions = new Map<string, ClientSubscription>(); // socketId -> subscriptions

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('🔗 Real-time WebSocket Gateway initialized');

    // Configure Socket.io adapter for Redis if in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Add Redis adapter for horizontal scaling
      this.logger.log(
        '📡 Production mode: Consider adding Redis adapter for scaling',
      );
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.warn(
          `❌ Client ${client.id} connected without authentication token`,
        );
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`❌ Client ${client.id} connected with invalid token`);
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect();
        return;
      }

      // Set client properties
      client.tenantId = payload.tenantId;
      client.userId = payload.sub;
      client.userRoles = payload.roles || [];

      // Add to tenant room
      const tenantRoom = `tenant:${client.tenantId}`;
      await client.join(tenantRoom);

      // Track connected clients
      this.connectedClients.set(client.id, client);

      // Track tenant rooms
      if (!this.tenantRooms.has(client.tenantId)) {
        this.tenantRooms.set(client.tenantId, new Set());
      }
      this.tenantRooms.get(client.tenantId)!.add(client.id);

      // Initialize client subscriptions
      this.clientSubscriptions.set(client.id, {
        inventoryItems: [],
        locations: [],
        products: [],
        alertTypes: ['low_stock', 'out_of_stock', 'expired', 'expiring_soon'],
      });

      this.logger.log(
        `✅ Client ${client.id} connected to tenant room: ${tenantRoom}`,
      );

      // Send connection success
      client.emit('connected', {
        message: 'Connected to StokCerdas real-time updates',
        tenantId: client.tenantId,
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });

      // Send current tenant stats
      await this.sendTenantStats(client);
    } catch (error) {
      this.logger.error(
        `❌ Error handling connection for client ${client.id}:`,
        error,
      );
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const tenantId = client.tenantId;

    if (tenantId) {
      // Remove from tenant room tracking
      const tenantClients = this.tenantRooms.get(tenantId);
      if (tenantClients) {
        tenantClients.delete(client.id);
        if (tenantClients.size === 0) {
          this.tenantRooms.delete(tenantId);
        }
      }
    }

    // Clean up client tracking
    this.connectedClients.delete(client.id);
    this.clientSubscriptions.delete(client.id);

    this.logger.log(
      `🔌 Client ${client.id} disconnected from tenant: ${tenantId}`,
    );
  }

  @SubscribeMessage('subscribe_inventory_items')
  async handleSubscribeInventoryItems(
    @MessageBody() data: { inventoryItemIds: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.tenantId) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    const subscription = this.clientSubscriptions.get(client.id);
    if (subscription) {
      subscription.inventoryItems = data.inventoryItemIds;
      this.logger.log(
        `📊 Client ${client.id} subscribed to ${data.inventoryItemIds.length} inventory items`,
      );

      client.emit('subscription_updated', {
        type: 'inventory_items',
        items: data.inventoryItemIds,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribe_locations')
  async handleSubscribeLocations(
    @MessageBody() data: { locationIds: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.tenantId) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    const subscription = this.clientSubscriptions.get(client.id);
    if (subscription) {
      subscription.locations = data.locationIds;
      this.logger.log(
        `📍 Client ${client.id} subscribed to ${data.locationIds.length} locations`,
      );

      client.emit('subscription_updated', {
        type: 'locations',
        items: data.locationIds,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('subscribe_alert_types')
  async handleSubscribeAlertTypes(
    @MessageBody() data: { alertTypes: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.tenantId) {
      client.emit('error', { message: 'Authentication required' });
      return;
    }

    const subscription = this.clientSubscriptions.get(client.id);
    if (subscription) {
      subscription.alertTypes = data.alertTypes;
      this.logger.log(
        `🚨 Client ${
          client.id
        } subscribed to alert types: ${data.alertTypes.join(', ')}`,
      );

      client.emit('subscription_updated', {
        type: 'alert_types',
        items: data.alertTypes,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_connection_status')
  handleConnectionStatus(@ConnectedSocket() client: AuthenticatedSocket) {
    const subscription = this.clientSubscriptions.get(client.id);

    client.emit('connection_status', {
      tenantId: client.tenantId,
      userId: client.userId,
      subscriptions: subscription,
      connectedAt: new Date().toISOString(),
      roomsJoined: Array.from(client.rooms),
    });
  }

  // Event Listeners for Broadcasting
  @OnEvent('inventory.updated')
  async handleInventoryUpdate(event: InventoryUpdateEvent) {
    const tenantRoom = `tenant:${event.tenantId}`;

    // Get all clients in the tenant room
    const tenantClients = this.tenantRooms.get(event.tenantId) || new Set();

    for (const clientId of tenantClients) {
      const client = this.connectedClients.get(clientId);
      const subscription = this.clientSubscriptions.get(clientId);

      if (client && subscription) {
        // Check if client is subscribed to this inventory item
        const inventoryItemId = event.data.id;
        const locationId = event.data.locationId;

        const shouldReceiveUpdate =
          !subscription.inventoryItems?.length || // No specific subscription
          subscription.inventoryItems.includes(inventoryItemId) ||
          (subscription.locations &&
            subscription.locations.includes(locationId));

        if (shouldReceiveUpdate) {
          client.emit('inventory_updated', {
            type: event.type,
            data: event.data,
            timestamp: event.timestamp,
          });
        }
      }
    }

    this.logger.debug(
      `📡 Broadcast inventory update to ${tenantClients.size} clients in tenant: ${event.tenantId}`,
    );
  }

  @OnEvent('inventory.alert')
  async handleInventoryAlert(event: InventoryUpdateEvent) {
    const tenantRoom = `tenant:${event.tenantId}`;
    const alert = event.data;

    // Get all clients in the tenant room
    const tenantClients = this.tenantRooms.get(event.tenantId) || new Set();

    for (const clientId of tenantClients) {
      const client = this.connectedClients.get(clientId);
      const subscription = this.clientSubscriptions.get(clientId);

      if (client && subscription) {
        // Check if client is subscribed to this alert type
        const shouldReceiveAlert =
          !subscription.alertTypes?.length || // No specific subscription
          subscription.alertTypes.includes(alert.type);

        if (shouldReceiveAlert) {
          client.emit('inventory_alert', {
            type: event.type,
            alert: alert,
            timestamp: event.timestamp,
          });
        }
      }
    }

    this.logger.log(
      `🚨 Broadcast ${alert.type} alert to ${tenantClients.size} clients in tenant: ${event.tenantId}`,
    );
  }

  @OnEvent('location.updated')
  async handleLocationUpdate(event: InventoryUpdateEvent) {
    const tenantRoom = `tenant:${event.tenantId}`;

    // Broadcast to all clients in tenant room (location updates are always relevant)
    this.server.to(tenantRoom).emit('location_updated', {
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
    });

    this.logger.debug(
      `📍 Broadcast location update to tenant: ${event.tenantId}`,
    );
  }

  // Utility Methods
  private extractTokenFromSocket(client: Socket): string | null {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      client.request.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }

  private async verifyToken(token: string): Promise<any | null> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.warn(`❌ Token verification failed:`, error.message);
      return null;
    }
  }

  private async sendTenantStats(client: AuthenticatedSocket) {
    try {
      // TODO: Get actual tenant stats from services
      const stats = {
        totalInventoryItems: 0,
        totalLocations: 0,
        activeAlerts: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
      };

      client.emit('tenant_stats', {
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `❌ Error sending tenant stats to client ${client.id}:`,
        error,
      );
    }
  }

  // Public methods for manual broadcasting
  async broadcastToTenant(tenantId: string, event: string, data: any) {
    const tenantRoom = `tenant:${tenantId}`;
    this.server.to(tenantRoom).emit(event, data);
    this.logger.debug(`📡 Manual broadcast '${event}' to tenant: ${tenantId}`);
  }

  async broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`📡 Manual broadcast '${event}' to all clients`);
  }

  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  getTenantClientCount(tenantId: string): number {
    return this.tenantRooms.get(tenantId)?.size || 0;
  }

  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      tenantsWithConnections: this.tenantRooms.size,
      averageConnectionsPerTenant:
        this.tenantRooms.size > 0
          ? Math.round(
              (this.connectedClients.size / this.tenantRooms.size) * 100,
            ) / 100
          : 0,
    };
  }
}
