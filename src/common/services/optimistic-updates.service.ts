import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RealtimeStateService } from './realtime-state.service';

export interface OptimisticUpdate {
  id: string;
  tenantId: string;
  userId: string;
  resourceType: 'inventory_item' | 'location' | 'product' | 'transaction';
  resourceId: string;
  operation: 'create' | 'update' | 'delete';
  localChanges: any;
  originalData: any;
  timestamp: number;
  version: number;
  status: 'pending' | 'confirmed' | 'failed' | 'conflict';
  retryCount: number;
  maxRetries: number;
}

export interface ConflictResolution {
  updateId: string;
  resolution: 'local_wins' | 'server_wins' | 'merge' | 'manual_required';
  resolvedData?: any;
  conflictDetails?: any;
}

@Injectable()
export class OptimisticUpdatesService {
  private readonly logger = new Logger(OptimisticUpdatesService.name);
  private pendingUpdates = new Map<string, OptimisticUpdate>(); // updateId -> update
  private userPendingUpdates = new Map<string, Set<string>>(); // userId -> Set of updateIds

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly stateService: RealtimeStateService,
  ) {
    // Cleanup expired updates every 5 minutes
    setInterval(() => this.cleanupExpiredUpdates(), 5 * 60 * 1000);
  }

  /**
   * Apply optimistic update - immediately show change in UI before server confirms
   */
  async applyOptimisticUpdate(update: Omit<OptimisticUpdate, 'id' | 'timestamp' | 'status' | 'retryCount'>): Promise<string> {
    const updateId = this.generateUpdateId();
    const timestamp = Date.now();
    
    const optimisticUpdate: OptimisticUpdate = {
      ...update,
      id: updateId,
      timestamp,
      status: 'pending',
      retryCount: 0,
      maxRetries: update.maxRetries || 3,
    };

    // Store the pending update
    this.pendingUpdates.set(updateId, optimisticUpdate);
    
    // Track user's pending updates
    const userKey = `${update.tenantId}:${update.userId}`;
    if (!this.userPendingUpdates.has(userKey)) {
      this.userPendingUpdates.set(userKey, new Set());
    }
    this.userPendingUpdates.get(userKey)!.add(updateId);

    // Emit optimistic update event for UI
    this.eventEmitter.emit('optimistic.update.applied', {
      updateId,
      tenantId: update.tenantId,
      userId: update.userId,
      resourceType: update.resourceType,
      resourceId: update.resourceId,
      operation: update.operation,
      changes: update.localChanges,
      timestamp,
    });

    this.logger.debug(`🔄 Applied optimistic update ${updateId} for ${update.resourceType}:${update.resourceId}`);
    
    return updateId;
  }

  /**
   * Confirm optimistic update - server has processed the change successfully
   */
  async confirmOptimisticUpdate(updateId: string, serverData?: any): Promise<void> {
    const update = this.pendingUpdates.get(updateId);
    if (!update) {
      this.logger.warn(`⚠️ Attempted to confirm non-existent update: ${updateId}`);
      return;
    }

    update.status = 'confirmed';

    // Emit confirmation event
    this.eventEmitter.emit('optimistic.update.confirmed', {
      updateId,
      tenantId: update.tenantId,
      userId: update.userId,
      resourceType: update.resourceType,
      resourceId: update.resourceId,
      operation: update.operation,
      serverData,
      timestamp: Date.now(),
    });

    // Clean up the update
    this.removePendingUpdate(updateId);

    this.logger.debug(`✅ Confirmed optimistic update ${updateId} for ${update.resourceType}:${update.resourceId}`);
  }

  /**
   * Reject optimistic update - server rejected the change, revert UI
   */
  async rejectOptimisticUpdate(updateId: string, reason: string, shouldRetry = false): Promise<void> {
    const update = this.pendingUpdates.get(updateId);
    if (!update) {
      this.logger.warn(`⚠️ Attempted to reject non-existent update: ${updateId}`);
      return;
    }

    if (shouldRetry && update.retryCount < update.maxRetries) {
      // Retry the update
      update.retryCount++;
      update.timestamp = Date.now(); // Reset timestamp for retry
      
      this.eventEmitter.emit('optimistic.update.retry', {
        updateId,
        tenantId: update.tenantId,
        userId: update.userId,
        resourceType: update.resourceType,
        resourceId: update.resourceId,
        retryCount: update.retryCount,
        maxRetries: update.maxRetries,
        reason,
      });

      this.logger.debug(`🔁 Retrying optimistic update ${updateId} (attempt ${update.retryCount}/${update.maxRetries})`);
      return;
    }

    update.status = 'failed';

    // Emit rejection event for UI to revert changes
    this.eventEmitter.emit('optimistic.update.rejected', {
      updateId,
      tenantId: update.tenantId,
      userId: update.userId,
      resourceType: update.resourceType,
      resourceId: update.resourceId,
      operation: update.operation,
      originalData: update.originalData,
      reason,
      timestamp: Date.now(),
    });

    // Clean up the update
    this.removePendingUpdate(updateId);

    this.logger.warn(`❌ Rejected optimistic update ${updateId} for ${update.resourceType}:${update.resourceId}: ${reason}`);
  }

  /**
   * Handle conflict between optimistic update and server state
   */
  async handleConflict(updateId: string, serverData: any): Promise<ConflictResolution> {
    const update = this.pendingUpdates.get(updateId);
    if (!update) {
      this.logger.warn(`⚠️ Attempted to handle conflict for non-existent update: ${updateId}`);
      return { updateId, resolution: 'server_wins' };
    }

    // Use state service for conflict resolution (only for supported resource types)
    let conflictResolution: ConflictResolution;
    
    if (['inventory_item', 'location', 'product'].includes(update.resourceType)) {
      const resolution = await this.stateService.resolveConflict(update.tenantId, {
        resourceType: update.resourceType as 'inventory_item' | 'location' | 'product',
        resourceId: update.resourceId,
        localVersion: update.version,
        serverVersion: serverData.version || update.version + 1,
        localChanges: update.localChanges,
        serverChanges: serverData,
      });
      
      conflictResolution = {
        updateId,
        resolution: resolution.resolution,
        resolvedData: resolution.resolvedData,
        conflictDetails: resolution.conflictDetails,
      };
    } else {
      // For unsupported resource types, default to server wins
      conflictResolution = {
        updateId,
        resolution: 'server_wins' as any,
        resolvedData: serverData,
        conflictDetails: `Resource type ${update.resourceType} not supported for conflict resolution`,
      };
    }

    update.status = 'conflict';

    // Emit conflict event
    this.eventEmitter.emit('optimistic.update.conflict', {
      updateId,
      tenantId: update.tenantId,
      userId: update.userId,
      resourceType: update.resourceType,
      resourceId: update.resourceId,
      conflictResolution,
      localChanges: update.localChanges,
      serverData,
      timestamp: Date.now(),
    });

    // Handle resolution
    switch (conflictResolution.resolution) {
      case 'local_wins':
        // Keep optimistic update, ignore server data
        await this.confirmOptimisticUpdate(updateId, update.localChanges);
        break;
        
      case 'server_wins':
        // Revert optimistic update, use server data
        await this.rejectOptimisticUpdate(updateId, 'Server has newer data');
        break;
        
      case 'merge':
        // Apply merged data
        await this.confirmOptimisticUpdate(updateId, conflictResolution.resolvedData);
        break;
        
      case 'manual_required':
        // Keep as conflict status, require user intervention
        this.logger.warn(`🤝 Manual conflict resolution required for update ${updateId}`);
        break;
    }

    this.logger.debug(`⚖️ Handled conflict for update ${updateId}: ${conflictResolution.resolution}`);
    
    return conflictResolution;
  }

  /**
   * Get pending updates for a user
   */
  getPendingUpdatesForUser(tenantId: string, userId: string): OptimisticUpdate[] {
    const userKey = `${tenantId}:${userId}`;
    const userUpdateIds = this.userPendingUpdates.get(userKey) || new Set();
    
    const updates: OptimisticUpdate[] = [];
    for (const updateId of userUpdateIds) {
      const update = this.pendingUpdates.get(updateId);
      if (update) {
        updates.push(update);
      }
    }
    
    return updates.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get pending updates for a specific resource
   */
  getPendingUpdatesForResource(resourceType: string, resourceId: string): OptimisticUpdate[] {
    const updates: OptimisticUpdate[] = [];
    
    for (const update of this.pendingUpdates.values()) {
      if (update.resourceType === resourceType && update.resourceId === resourceId) {
        updates.push(update);
      }
    }
    
    return updates.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Cancel pending optimistic update
   */
  async cancelOptimisticUpdate(updateId: string): Promise<void> {
    const update = this.pendingUpdates.get(updateId);
    if (!update) {
      return;
    }

    // Emit cancellation event
    this.eventEmitter.emit('optimistic.update.cancelled', {
      updateId,
      tenantId: update.tenantId,
      userId: update.userId,
      resourceType: update.resourceType,
      resourceId: update.resourceId,
      originalData: update.originalData,
      timestamp: Date.now(),
    });

    this.removePendingUpdate(updateId);
    this.logger.debug(`🚫 Cancelled optimistic update ${updateId}`);
  }

  /**
   * Get optimistic update statistics
   */
  getOptimisticUpdateStats(tenantId?: string): {
    totalPendingUpdates: number;
    pendingByType: Record<string, number>;
    pendingByUser: Record<string, number>;
    conflictCount: number;
    averageAge: number;
  } {
    const relevantUpdates = Array.from(this.pendingUpdates.values())
      .filter(update => !tenantId || update.tenantId === tenantId);

    const now = Date.now();
    const stats = {
      totalPendingUpdates: relevantUpdates.length,
      pendingByType: {} as Record<string, number>,
      pendingByUser: {} as Record<string, number>,
      conflictCount: 0,
      averageAge: 0,
    };

    if (relevantUpdates.length === 0) {
      return stats;
    }

    let totalAge = 0;
    
    for (const update of relevantUpdates) {
      // Count by type
      stats.pendingByType[update.resourceType] = (stats.pendingByType[update.resourceType] || 0) + 1;
      
      // Count by user
      const userKey = `${update.tenantId}:${update.userId}`;
      stats.pendingByUser[userKey] = (stats.pendingByUser[userKey] || 0) + 1;
      
      // Count conflicts
      if (update.status === 'conflict') {
        stats.conflictCount++;
      }
      
      // Calculate age
      totalAge += (now - update.timestamp);
    }

    stats.averageAge = totalAge / relevantUpdates.length;
    
    return stats;
  }

  // Private methods
  private generateUpdateId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private removePendingUpdate(updateId: string): void {
    const update = this.pendingUpdates.get(updateId);
    if (update) {
      const userKey = `${update.tenantId}:${update.userId}`;
      const userUpdates = this.userPendingUpdates.get(userKey);
      if (userUpdates) {
        userUpdates.delete(updateId);
        if (userUpdates.size === 0) {
          this.userPendingUpdates.delete(userKey);
        }
      }
      this.pendingUpdates.delete(updateId);
    }
  }

  private cleanupExpiredUpdates(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [updateId, update] of this.pendingUpdates.entries()) {
      if (now - update.timestamp > maxAge) {
        this.logger.warn(`🧹 Cleaning up expired optimistic update ${updateId} (age: ${Math.round((now - update.timestamp) / 1000)}s)`);
        
        // Emit expiration event
        this.eventEmitter.emit('optimistic.update.expired', {
          updateId,
          tenantId: update.tenantId,
          userId: update.userId,
          resourceType: update.resourceType,
          resourceId: update.resourceId,
          age: now - update.timestamp,
        });

        this.removePendingUpdate(updateId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${cleanedCount} expired optimistic updates`);
    }
  }

  /**
   * Force sync all pending updates for a user (useful on reconnection)
   */
  async forceSyncPendingUpdates(tenantId: string, userId: string): Promise<void> {
    const pendingUpdates = this.getPendingUpdatesForUser(tenantId, userId);
    
    if (pendingUpdates.length === 0) {
      return;
    }

    this.logger.log(`🔄 Force syncing ${pendingUpdates.length} pending updates for user ${userId} in tenant ${tenantId}`);

    // Emit force sync event
    this.eventEmitter.emit('optimistic.updates.force_sync', {
      tenantId,
      userId,
      pendingUpdates: pendingUpdates.map(update => ({
        updateId: update.id,
        resourceType: update.resourceType,
        resourceId: update.resourceId,
        operation: update.operation,
        changes: update.localChanges,
        timestamp: update.timestamp,
        status: update.status,
      })),
    });
  }
}