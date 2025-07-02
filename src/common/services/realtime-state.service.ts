import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface ClientState {
  socketId: string;
  tenantId: string;
  userId: string;
  lastSeen: number;
  subscriptions: {
    inventoryItems: string[];
    locations: string[];
    products: string[];
    alertTypes: string[];
  };
}

export interface StateSnapshot {
  inventoryItems: any[];
  locations: any[];
  alerts: any[];
  lastUpdated: number;
}

@Injectable()
export class RealtimeStateService {
  private readonly logger = new Logger(RealtimeStateService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Save client state for reconnection recovery
   */
  async saveClientState(clientState: ClientState): Promise<void> {
    try {
      const key = `client_state:${clientState.tenantId}:${clientState.userId}`;
      
      // Store with 24 hour expiration (86400 seconds = 86400000 ms)
      await this.cacheManager.set(key, clientState, 86400000);
      
      this.logger.debug(`💾 Saved client state for user ${clientState.userId} in tenant ${clientState.tenantId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to save client state:`, error);
    }
  }

  /**
   * Restore client state after reconnection
   */
  async restoreClientState(tenantId: string, userId: string): Promise<ClientState | null> {
    try {
      const key = `client_state:${tenantId}:${userId}`;
      const clientState = await this.cacheManager.get<ClientState>(key);
      
      if (clientState) {
        this.logger.debug(`🔄 Restored client state for user ${userId} in tenant ${tenantId}`);
        return clientState;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`❌ Failed to restore client state:`, error);
      return null;
    }
  }

  /**
   * Store pending updates for offline clients
   */
  async storePendingUpdate(tenantId: string, userId: string, update: any): Promise<void> {
    try {
      const key = `pending_updates:${tenantId}:${userId}`;
      const updateWithTimestamp = {
        ...update,
        storedAt: Date.now(),
      };
      
      // Get existing updates
      const existingUpdates = await this.cacheManager.get<any[]>(key) || [];
      
      // Add new update and keep only latest 50 (simplified)
      existingUpdates.unshift(updateWithTimestamp);
      if (existingUpdates.length > 50) {
        existingUpdates.splice(50);
      }
      
      // Store with 24 hour expiration
      await this.cacheManager.set(key, existingUpdates, 86400000);
      
      this.logger.debug(`📦 Stored pending update for user ${userId} in tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to store pending update:`, error);
    }
  }

  /**
   * Get and clear pending updates for a client
   */
  async getPendingUpdates(tenantId: string, userId: string): Promise<any[]> {
    try {
      const key = `pending_updates:${tenantId}:${userId}`;
      const updates = await this.cacheManager.get<any[]>(key) || [];
      
      // Clear the pending updates
      await this.cacheManager.del(key);
      
      // Sort by timestamp (oldest first)
      updates.sort((a, b) => a.storedAt - b.storedAt);
      
      this.logger.debug(`📥 Retrieved ${updates.length} pending updates for user ${userId} in tenant ${tenantId}`);
      return updates;
    } catch (error) {
      this.logger.error(`❌ Failed to get pending updates:`, error);
      return [];
    }
  }

  /**
   * Save state snapshot for quick recovery
   */
  async saveStateSnapshot(tenantId: string, snapshot: StateSnapshot): Promise<void> {
    try {
      const key = `state_snapshot:${tenantId}`;
      
      // Store with 1 hour expiration
      await this.cacheManager.set(key, snapshot, 3600000);
      
      this.logger.debug(`📸 Saved state snapshot for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to save state snapshot:`, error);
    }
  }

  /**
   * Get state snapshot for quick recovery
   */
  async getStateSnapshot(tenantId: string): Promise<StateSnapshot | null> {
    try {
      const key = `state_snapshot:${tenantId}`;
      const snapshot = await this.cacheManager.get<StateSnapshot>(key);
      
      if (snapshot) {
        this.logger.debug(`📷 Retrieved state snapshot for tenant ${tenantId}`);
        return snapshot;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`❌ Failed to get state snapshot:`, error);
      return null;
    }
  }

  /**
   * Track client heartbeat
   */
  async updateClientHeartbeat(tenantId: string, userId: string, socketId: string): Promise<void> {
    try {
      const key = `heartbeat:${tenantId}:${userId}`;
      const heartbeat = {
        socketId,
        timestamp: Date.now(),
      };
      
      await this.cacheManager.set(key, heartbeat, 300000); // 5 minute expiration
      
      this.logger.debug(`💓 Updated heartbeat for user ${userId} in tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to update heartbeat:`, error);
    }
  }

  /**
   * Check if client is considered online
   */
  async isClientOnline(tenantId: string, userId: string): Promise<boolean> {
    try {
      const key = `heartbeat:${tenantId}:${userId}`;
      const heartbeat = await this.cacheManager.get<any>(key);
      
      if (heartbeat) {
        const age = Date.now() - heartbeat.timestamp;
        return age < 300000; // 5 minutes
      }
      
      return false;
    } catch (error) {
      this.logger.error(`❌ Failed to check client online status:`, error);
      return false;
    }
  }

  /**
   * Handle conflict resolution for optimistic updates
   */
  async resolveConflict(tenantId: string, conflictData: {
    resourceType: 'inventory_item' | 'location' | 'product';
    resourceId: string;
    localVersion: number;
    serverVersion: number;
    localChanges: any;
    serverChanges: any;
  }): Promise<{
    resolution: 'local_wins' | 'server_wins' | 'merge' | 'manual_required';
    resolvedData?: any;
    conflictDetails?: any;
  }> {
    try {
      const { resourceType, resourceId, localVersion, serverVersion, localChanges, serverChanges } = conflictData;
      
      // Store conflict for audit/debugging
      const conflictKey = `conflict:${tenantId}:${resourceType}:${resourceId}:${Date.now()}`;
      await this.cacheManager.set(conflictKey, conflictData, 86400000);
      
      // Simple conflict resolution strategy
      if (localVersion === serverVersion) {
        // No conflict - versions match
        return { resolution: 'local_wins', resolvedData: localChanges };
      }
      
      if (localVersion < serverVersion) {
        // Server has newer version - server wins
        return { 
          resolution: 'server_wins', 
          resolvedData: serverChanges,
          conflictDetails: {
            reason: 'Server has newer version',
            localVersion,
            serverVersion,
          }
        };
      }
      
      // Check if changes can be merged (simple field-level merge)
      if (this.canAutoMerge(localChanges, serverChanges)) {
        const merged = this.mergeChanges(localChanges, serverChanges);
        return { 
          resolution: 'merge', 
          resolvedData: merged,
          conflictDetails: {
            reason: 'Auto-merged non-conflicting fields',
            mergedFields: Object.keys(merged),
          }
        };
      }
      
      // Manual resolution required
      return { 
        resolution: 'manual_required',
        conflictDetails: {
          reason: 'Conflicting changes require manual resolution',
          localChanges,
          serverChanges,
          localVersion,
          serverVersion,
        }
      };
      
    } catch (error) {
      this.logger.error(`❌ Failed to resolve conflict:`, error);
      return { resolution: 'server_wins' }; // Fallback to server wins
    }
  }

  // Private helper methods
  private canAutoMerge(localChanges: any, serverChanges: any): boolean {
    // Check if there are overlapping fields that would conflict
    const localFields = Object.keys(localChanges);
    const serverFields = Object.keys(serverChanges);
    
    const overlappingFields = localFields.filter(field => serverFields.includes(field));
    
    // If no overlapping fields, we can merge
    if (overlappingFields.length === 0) {
      return true;
    }
    
    // Check if overlapping fields have the same values (no real conflict)
    return overlappingFields.every(field => 
      JSON.stringify(localChanges[field]) === JSON.stringify(serverChanges[field])
    );
  }

  private mergeChanges(localChanges: any, serverChanges: any): any {
    return {
      ...serverChanges, // Server changes first (base)
      ...localChanges,  // Local changes override (assuming they're newer user intent)
    };
  }
}