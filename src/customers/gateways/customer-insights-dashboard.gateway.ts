import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CustomerInsightsDashboardService } from '../services/customer-insights-dashboard.service';
import {
  RealTimeCustomerMetrics,
  LiveCustomerActivity,
  DashboardAlert,
} from '../services/customer-insights-dashboard.service';

// =============================================
// ULTRATHINK: REAL-TIME DASHBOARD GATEWAY
// =============================================

export interface DashboardSubscription {
  tenantId: string;
  userId: string;
  subscriptions: {
    realTimeMetrics: boolean;
    liveActivity: boolean;
    alerts: boolean;
    segmentUpdates: boolean;
    indonesianInsights: boolean;
  };
  filters?: {
    customerSegments?: string[];
    regions?: string[];
    activityTypes?: string[];
  };
}

export interface ClientConnection {
  socket: Socket;
  tenantId: string;
  userId: string;
  subscription: DashboardSubscription;
  lastPing: Date;
  connectionTime: Date;
}

/**
 * ULTRATHINK: Customer Insights Dashboard WebSocket Gateway
 * Real-time dashboard updates with Indonesian business intelligence
 */
@WebSocketGateway({
  namespace: '/customer-insights-dashboard',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UseGuards(JwtAuthGuard)
export class CustomerInsightsDashboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CustomerInsightsDashboardGateway.name);
  private connectedClients: Map<string, ClientConnection> = new Map();
  private tenantRooms: Map<string, Set<string>> = new Map();
  private metricsUpdateInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly dashboardService: CustomerInsightsDashboardService,
  ) {}

  afterInit(server: Server) {
    this.logger.log(
      'Customer Insights Dashboard WebSocket Gateway initialized',
    );
    this.startMetricsUpdateLoop();
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting to connect: ${client.id}`);

      // Validate authentication and extract user info
      const authResult = await this.validateClientAuthentication(client);
      if (!authResult.isValid) {
        this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const { tenantId, userId } = authResult;

      // Create client connection record
      const connection: ClientConnection = {
        socket: client,
        tenantId,
        userId,
        subscription: {
          tenantId,
          userId,
          subscriptions: {
            realTimeMetrics: true,
            liveActivity: true,
            alerts: true,
            segmentUpdates: false,
            indonesianInsights: true,
          },
        },
        lastPing: new Date(),
        connectionTime: new Date(),
      };

      this.connectedClients.set(client.id, connection);

      // Add to tenant room
      const tenantRoom = `tenant_${tenantId}`;
      client.join(tenantRoom);

      if (!this.tenantRooms.has(tenantId)) {
        this.tenantRooms.set(tenantId, new Set());
      }
      this.tenantRooms.get(tenantId)!.add(client.id);

      // Register client with dashboard service
      this.dashboardService.addConnectedClient(
        `tenant_${tenantId}_${client.id}`,
        tenantId,
      );

      // Send initial dashboard data
      await this.sendInitialDashboardData(client, tenantId);

      // Send connection success
      client.emit('connected', {
        message: 'Successfully connected to Customer Insights Dashboard',
        tenantId,
        userId,
        serverTime: new Date(),
        features: {
          realTimeMetrics: true,
          liveActivity: true,
          indonesianInsights: true,
          alerts: true,
        },
      });

      this.logger.log(
        `Client connected successfully: ${client.id} (Tenant: ${tenantId}, User: ${userId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling connection: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const connection = this.connectedClients.get(client.id);
      if (connection) {
        const { tenantId, userId } = connection;

        // Remove from tenant room
        const tenantClients = this.tenantRooms.get(tenantId);
        if (tenantClients) {
          tenantClients.delete(client.id);
          if (tenantClients.size === 0) {
            this.tenantRooms.delete(tenantId);
          }
        }

        // Unregister from dashboard service
        this.dashboardService.removeConnectedClient(
          `tenant_${tenantId}_${client.id}`,
        );

        // Remove connection record
        this.connectedClients.delete(client.id);

        this.logger.log(
          `Client disconnected: ${client.id} (Tenant: ${tenantId}, User: ${userId})`,
        );
      } else {
        this.logger.log(`Unknown client disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling disconnect: ${error.message}`,
        error.stack,
      );
    }
  }

  // =============================================
  // ULTRATHINK: SUBSCRIPTION MANAGEMENT
  // =============================================

  @SubscribeMessage('subscribe_metrics')
  async handleSubscribeMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      subscriptions: DashboardSubscription['subscriptions'];
      filters?: any;
    },
  ) {
    try {
      const connection = this.connectedClients.get(client.id);
      if (!connection) {
        client.emit('error', { message: 'Connection not found' });
        return;
      }

      // Update subscription preferences
      connection.subscription.subscriptions = {
        ...connection.subscription.subscriptions,
        ...data.subscriptions,
      };

      if (data.filters) {
        connection.subscription.filters = data.filters;
      }

      this.connectedClients.set(client.id, connection);

      // Send immediate update if subscribed to real-time metrics
      if (data.subscriptions.realTimeMetrics) {
        const metrics = await this.dashboardService.getRealTimeMetrics(
          connection.tenantId,
        );
        client.emit('metrics_update', {
          type: 'real_time_metrics',
          data: metrics,
          timestamp: new Date(),
        });
      }

      client.emit('subscription_updated', {
        subscriptions: connection.subscription.subscriptions,
        filters: connection.subscription.filters,
      });

      this.logger.log(`Updated subscriptions for client: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error updating subscription: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Subscription update failed' });
    }
  }

  @SubscribeMessage('request_live_activity')
  async handleRequestLiveActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number; activityTypes?: string[] },
  ) {
    try {
      const connection = this.connectedClients.get(client.id);
      if (!connection) {
        client.emit('error', { message: 'Connection not found' });
        return;
      }

      const activities = await this.dashboardService.getLiveCustomerActivity(
        connection.tenantId,
        data.limit || 50,
      );

      // Filter by activity types if specified
      let filteredActivities = activities;
      if (data.activityTypes?.length) {
        filteredActivities = activities.filter(activity =>
          data.activityTypes!.includes(activity.activityType),
        );
      }

      client.emit('live_activity_update', {
        type: 'live_activity',
        data: filteredActivities,
        timestamp: new Date(),
        totalCount: activities.length,
        filteredCount: filteredActivities.length,
      });

      this.logger.log(`Sent live activity to client: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error sending live activity: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Live activity request failed' });
    }
  }

  @SubscribeMessage('request_segment_performance')
  async handleRequestSegmentPerformance(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { segments?: string[] },
  ) {
    try {
      const connection = this.connectedClients.get(client.id);
      if (!connection) {
        client.emit('error', { message: 'Connection not found' });
        return;
      }

      const segmentPerformance =
        await this.dashboardService.getCustomerSegmentPerformance(
          connection.tenantId,
        );

      // Filter by specific segments if requested
      let filteredSegments = segmentPerformance;
      if (data.segments?.length) {
        filteredSegments = segmentPerformance.filter(segment =>
          data.segments!.includes(segment.segmentName),
        );
      }

      client.emit('segment_performance_update', {
        type: 'segment_performance',
        data: filteredSegments,
        timestamp: new Date(),
      });

      this.logger.log(`Sent segment performance to client: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error sending segment performance: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Segment performance request failed' });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const connection = this.connectedClients.get(client.id);
    if (connection) {
      connection.lastPing = new Date();
      this.connectedClients.set(client.id, connection);
    }
    client.emit('pong', { timestamp: new Date() });
  }

  // =============================================
  // ULTRATHINK: EVENT HANDLERS
  // =============================================

  @OnEvent('dashboard.metrics.updated')
  async handleMetricsUpdated(payload: {
    tenantId: string;
    metrics: RealTimeCustomerMetrics;
    timestamp: Date;
  }) {
    try {
      const tenantRoom = `tenant_${payload.tenantId}`;

      // Get all clients subscribed to metrics for this tenant
      const subscribedClients = Array.from(
        this.connectedClients.values(),
      ).filter(
        connection =>
          connection.tenantId === payload.tenantId &&
          connection.subscription.subscriptions.realTimeMetrics,
      );

      if (subscribedClients.length > 0) {
        // Emit to tenant room
        this.server.to(tenantRoom).emit('metrics_update', {
          type: 'real_time_metrics',
          data: payload.metrics,
          timestamp: payload.timestamp,
        });

        // Send Indonesian insights if subscribed
        const indonesianInsightsClients = subscribedClients.filter(
          connection =>
            connection.subscription.subscriptions.indonesianInsights,
        );

        if (indonesianInsightsClients.length > 0) {
          const indonesianInsights = {
            culturalAdaptation:
              payload.metrics.indonesianMarketInsights.culturalAdaptationScore,
            regionalDistribution:
              payload.metrics.indonesianMarketInsights.regionalDistribution,
            paymentPreferences:
              payload.metrics.indonesianMarketInsights.paymentMethodPreferences,
            whatsappEngagement:
              payload.metrics.indonesianMarketInsights.whatsappEngagementRate,
            ramadanImpact:
              payload.metrics.indonesianMarketInsights.ramadanImpact,
          };

          indonesianInsightsClients.forEach(connection => {
            connection.socket.emit('indonesian_insights_update', {
              type: 'indonesian_insights',
              data: indonesianInsights,
              timestamp: payload.timestamp,
            });
          });
        }

        this.logger.log(
          `Broadcasted metrics update to ${subscribedClients.length} clients in tenant ${payload.tenantId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error broadcasting metrics update: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('dashboard.alert.created')
  async handleAlertCreated(payload: {
    alertId: string;
    severity: string;
    title: string;
    tenantId?: string;
  }) {
    try {
      // Broadcast to all connected clients or specific tenant
      if (payload.tenantId) {
        const tenantRoom = `tenant_${payload.tenantId}`;
        this.server.to(tenantRoom).emit('alert_created', {
          type: 'alert_created',
          data: payload,
          timestamp: new Date(),
        });
      } else {
        // Broadcast to all clients
        this.server.emit('alert_created', {
          type: 'alert_created',
          data: payload,
          timestamp: new Date(),
        });
      }

      this.logger.log(
        `Broadcasted alert created: ${payload.alertId} (${payload.severity})`,
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting alert: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('dashboard.alert.resolved')
  async handleAlertResolved(payload: {
    alertId: string;
    resolvedBy: string;
    resolvedAt: Date;
    tenantId?: string;
  }) {
    try {
      if (payload.tenantId) {
        const tenantRoom = `tenant_${payload.tenantId}`;
        this.server.to(tenantRoom).emit('alert_resolved', {
          type: 'alert_resolved',
          data: payload,
          timestamp: new Date(),
        });
      } else {
        this.server.emit('alert_resolved', {
          type: 'alert_resolved',
          data: payload,
          timestamp: new Date(),
        });
      }

      this.logger.log(`Broadcasted alert resolved: ${payload.alertId}`);
    } catch (error) {
      this.logger.error(
        `Error broadcasting alert resolution: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('customer.activity.created')
  async handleCustomerActivityCreated(payload: {
    tenantId: string;
    activity: LiveCustomerActivity;
  }) {
    try {
      const tenantRoom = `tenant_${payload.tenantId}`;

      // Get clients subscribed to live activity
      const subscribedClients = Array.from(
        this.connectedClients.values(),
      ).filter(
        connection =>
          connection.tenantId === payload.tenantId &&
          connection.subscription.subscriptions.liveActivity,
      );

      if (subscribedClients.length > 0) {
        // Check if activity matches any client filters
        subscribedClients.forEach(connection => {
          let shouldSend = true;

          if (connection.subscription.filters?.activityTypes?.length) {
            shouldSend = connection.subscription.filters.activityTypes.includes(
              payload.activity.activityType,
            );
          }

          if (shouldSend && connection.subscription.filters?.regions?.length) {
            shouldSend = connection.subscription.filters.regions.includes(
              payload.activity.indonesianContext?.region || 'Unknown',
            );
          }

          if (shouldSend) {
            connection.socket.emit('live_activity_created', {
              type: 'live_activity_created',
              data: payload.activity,
              timestamp: new Date(),
            });
          }
        });

        this.logger.log(
          `Broadcasted new activity to clients in tenant ${payload.tenantId}: ${payload.activity.activityType}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error broadcasting activity: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('customer.segment.performance.updated')
  async handleSegmentPerformanceUpdated(payload: {
    tenantId: string;
    segmentId: string;
    performance: any;
  }) {
    try {
      const tenantRoom = `tenant_${payload.tenantId}`;

      // Get clients subscribed to segment updates
      const subscribedClients = Array.from(
        this.connectedClients.values(),
      ).filter(
        connection =>
          connection.tenantId === payload.tenantId &&
          connection.subscription.subscriptions.segmentUpdates,
      );

      if (subscribedClients.length > 0) {
        this.server.to(tenantRoom).emit('segment_performance_updated', {
          type: 'segment_performance_updated',
          data: {
            segmentId: payload.segmentId,
            performance: payload.performance,
          },
          timestamp: new Date(),
        });

        this.logger.log(
          `Broadcasted segment performance update to clients in tenant ${payload.tenantId}: ${payload.segmentId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error broadcasting segment update: ${error.message}`,
        error.stack,
      );
    }
  }

  // =============================================
  // ULTRATHINK: UTILITY METHODS
  // =============================================

  private async validateClientAuthentication(client: Socket): Promise<{
    isValid: boolean;
    tenantId?: string;
    userId?: string;
  }> {
    try {
      // Extract token from connection handshake
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization;

      if (!token) {
        return { isValid: false };
      }

      // Mock authentication validation
      // In real implementation, validate JWT token and extract user info
      const mockAuth = this.extractMockAuthInfo(token);

      return {
        isValid: true,
        tenantId: mockAuth.tenantId,
        userId: mockAuth.userId,
      };
    } catch (error) {
      this.logger.error(`Authentication validation failed: ${error.message}`);
      return { isValid: false };
    }
  }

  private extractMockAuthInfo(token: string): {
    tenantId: string;
    userId: string;
  } {
    // Mock implementation - extract from token
    return {
      tenantId: 'tenant_001',
      userId: 'user_001',
    };
  }

  private async sendInitialDashboardData(client: Socket, tenantId: string) {
    try {
      // Send initial metrics
      const metrics = await this.dashboardService.getRealTimeMetrics(tenantId);
      client.emit('initial_metrics', {
        type: 'initial_metrics',
        data: metrics,
        timestamp: new Date(),
      });

      // Send recent activity
      const recentActivity =
        await this.dashboardService.getLiveCustomerActivity(tenantId, 20);
      client.emit('initial_activity', {
        type: 'initial_activity',
        data: recentActivity,
        timestamp: new Date(),
      });

      // Send active alerts
      const alerts = await this.dashboardService.getDashboardAlerts(tenantId);
      client.emit('initial_alerts', {
        type: 'initial_alerts',
        data: alerts,
        timestamp: new Date(),
      });

      this.logger.log(`Sent initial dashboard data to client: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error sending initial data: ${error.message}`,
        error.stack,
      );
      client.emit('error', {
        message: 'Failed to load initial dashboard data',
      });
    }
  }

  private startMetricsUpdateLoop() {
    // Update metrics every 30 seconds for all connected tenants
    this.metricsUpdateInterval = setInterval(async () => {
      try {
        const activeTenants = new Set(
          Array.from(this.connectedClients.values()).map(
            connection => connection.tenantId,
          ),
        );

        for (const tenantId of activeTenants) {
          // Trigger metrics refresh in dashboard service
          // The service will emit events that we handle above
          const tenantClients = Array.from(
            this.connectedClients.values(),
          ).filter(connection => connection.tenantId === tenantId);

          if (tenantClients.length > 0) {
            // Only update if there are connected clients
            await this.dashboardService.refreshRealTimeMetrics(tenantId);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error in metrics update loop: ${error.message}`,
          error.stack,
        );
      }
    }, 30000); // 30 seconds

    this.logger.log('Started metrics update loop (30 second interval)');
  }

  private stopMetricsUpdateLoop() {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
      this.logger.log('Stopped metrics update loop');
    }
  }

  // =============================================
  // ULTRATHINK: ADMIN METHODS
  // =============================================

  @SubscribeMessage('admin_get_connection_stats')
  async handleGetConnectionStats(@ConnectedSocket() client: Socket) {
    try {
      const connection = this.connectedClients.get(client.id);
      if (!connection) {
        client.emit('error', { message: 'Connection not found' });
        return;
      }

      // Only allow admin users to get connection stats
      const stats = {
        totalConnections: this.connectedClients.size,
        tenantConnections: Object.fromEntries(
          Array.from(this.tenantRooms.entries()).map(([tenantId, clients]) => [
            tenantId,
            clients.size,
          ]),
        ),
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };

      client.emit('connection_stats', {
        type: 'connection_stats',
        data: stats,
        timestamp: new Date(),
      });

      this.logger.log(`Sent connection stats to client: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error sending connection stats: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Failed to get connection stats' });
    }
  }

  @SubscribeMessage('admin_broadcast_message')
  async handleAdminBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string; targetTenants?: string[] },
  ) {
    try {
      const connection = this.connectedClients.get(client.id);
      if (!connection) {
        client.emit('error', { message: 'Connection not found' });
        return;
      }

      // Broadcast message
      if (data.targetTenants?.length) {
        // Send to specific tenants
        data.targetTenants.forEach(tenantId => {
          const tenantRoom = `tenant_${tenantId}`;
          this.server.to(tenantRoom).emit('admin_message', {
            type: 'admin_message',
            data: { message: data.message },
            timestamp: new Date(),
            sender: connection.userId,
          });
        });
      } else {
        // Broadcast to all
        this.server.emit('admin_message', {
          type: 'admin_message',
          data: { message: data.message },
          timestamp: new Date(),
          sender: connection.userId,
        });
      }

      this.logger.log(
        `Admin broadcast sent by ${connection.userId}: ${data.message}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending admin broadcast: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Failed to send broadcast' });
    }
  }

  // Cleanup on module destroy
  onModuleDestroy() {
    this.stopMetricsUpdateLoop();
    this.connectedClients.clear();
    this.tenantRooms.clear();
    this.logger.log('Customer Insights Dashboard Gateway destroyed');
  }
}
