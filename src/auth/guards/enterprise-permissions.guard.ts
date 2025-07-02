import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PermissionResource, PermissionAction } from '../entities/permission.entity';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { User } from '../../users/entities/user.entity';
import { HierarchicalRole } from '../entities/hierarchical-role.entity';
import { Department } from '../entities/department.entity';
import { PermissionSet } from '../entities/permission-set.entity';
import { HierarchicalRoleService } from '../services/hierarchical-role.service';
import { PermissionSetService } from '../services/permission-set.service';
import { DepartmentService } from '../services/department.service';

interface AuthenticatedRequest extends Request {
  user: User;
  tenantId: string;
}

export interface RequiredPermission {
  resource: PermissionResource;
  action: PermissionAction;
  departmentScope?: boolean; // If true, check department-level permissions
  contextual?: boolean; // If true, consider context (IP, time, etc.)
}

export interface PermissionContext {
  departmentId?: string;
  ipAddress?: string;
  timestamp?: Date;
  resourceId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class EnterprisePermissionsGuard implements CanActivate {
  private readonly logger = new Logger(EnterprisePermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(HierarchicalRole)
    private readonly hierarchicalRoleRepository: Repository<HierarchicalRole>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(PermissionSet)
    private readonly permissionSetRepository: Repository<PermissionSet>,
    private readonly hierarchicalRoleService: HierarchicalRoleService,
    private readonly permissionSetService: PermissionSetService,
    private readonly departmentService: DepartmentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are specified, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const tenantId = request.tenantId || user?.tenantId;

    if (!user) {
      this.logger.warn('No user found in request - authentication required before authorization');
      throw new ForbiddenException('Autentikasi diperlukan');
    }

    if (!tenantId) {
      this.logger.warn('No tenant context found in request');
      throw new ForbiddenException('Konteks tenant diperlukan');
    }

    // Build permission context
    const permissionContext: PermissionContext = {
      departmentId: request.headers['x-department-id'] as string,
      ipAddress: request.ip || request.connection.remoteAddress,
      timestamp: new Date(),
      resourceId: request.params.id,
      metadata: {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
      },
    };

    // Check each required permission using enterprise logic
    for (const permission of requiredPermissions) {
      const hasPermission = await this.checkEnterprisePermission(
        user,
        permission,
        tenantId,
        permissionContext,
      );

      if (!hasPermission) {
        const endpoint = `${request.method} ${request.url}`;
        this.logger.warn(
          `Enterprise permission denied for user ${user.email} (${user.role}) to ${endpoint}. Required: ${permission.resource}:${permission.action}`,
        );
        throw new ForbiddenException(
          `Anda tidak memiliki izin untuk ${permission.action} pada ${permission.resource}`,
        );
      }
    }

    return true;
  }

  private async checkEnterprisePermission(
    user: User,
    permission: RequiredPermission,
    tenantId: string,
    context: PermissionContext,
  ): Promise<boolean> {
    try {
      // 1. Check super admin access
      if (user.role === 'SUPER_ADMIN') {
        return true;
      }

      // 2. Get user's hierarchical roles
      const userHierarchicalRoles = await this.getUserHierarchicalRoles(user.id, tenantId);

      // 3. Get user's permission sets
      const userPermissionSets = await this.getUserPermissionSets(user.id, tenantId);

      // 4. Check department isolation if required
      if (permission.departmentScope && context.departmentId) {
        const hasDepartmentAccess = await this.checkDepartmentAccess(
          user.id,
          context.departmentId,
          tenantId,
        );
        if (!hasDepartmentAccess) {
          return false;
        }
      }

      // 5. Check hierarchical role permissions
      for (const role of userHierarchicalRoles) {
        if (await this.checkHierarchicalRolePermission(role, permission, context)) {
          return true;
        }
      }

      // 6. Check permission set permissions
      for (const permissionSet of userPermissionSets) {
        if (await this.checkPermissionSetPermission(permissionSet, permission, context, tenantId)) {
          return true;
        }
      }

      // 7. Fallback to legacy role-based permissions
      return await this.checkLegacyRolePermission(user, permission);

    } catch (error) {
      this.logger.error(
        `Error checking enterprise permission for user ${user.id}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private async getUserHierarchicalRoles(
    userId: string,
    tenantId: string,
  ): Promise<HierarchicalRole[]> {
    try {
      // This would be expanded to get user's actual role assignments
      return await this.hierarchicalRoleRepository.find({
        where: {
          tenantId,
          isDeleted: false,
          isActive: true,
        },
        relations: ['permissions', 'parent', 'children'],
      });
    } catch (error) {
      this.logger.error(`Error getting user hierarchical roles: ${error.message}`);
      return [];
    }
  }

  private async getUserPermissionSets(
    userId: string,
    tenantId: string,
  ): Promise<PermissionSet[]> {
    try {
      // This would be expanded to get user's actual permission set assignments
      return await this.permissionSetRepository.find({
        where: {
          tenantId,
          isDeleted: false,
          status: 'ACTIVE',
        },
        relations: ['permissions'],
      });
    } catch (error) {
      this.logger.error(`Error getting user permission sets: ${error.message}`);
      return [];
    }
  }

  private async checkDepartmentAccess(
    userId: string,
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      // Check if user has access to the department
      const department = await this.departmentRepository.findOne({
        where: {
          id: departmentId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!department) {
        return false;
      }

      // Check if department allows access (simplified logic)
      // In a real implementation, you'd check user-department relationships
      return department.isActive;
    } catch (error) {
      this.logger.error(`Error checking department access: ${error.message}`);
      return false;
    }
  }

  private async checkHierarchicalRolePermission(
    role: HierarchicalRole,
    permission: RequiredPermission,
    context: PermissionContext,
  ): Promise<boolean> {
    try {
      // Check role validity
      if (!role.isValidNow) {
        return false;
      }

      // Check time restrictions
      if (!role.isWithinAllowedHours()) {
        return false;
      }

      // Check IP restrictions
      if (context.ipAddress && !role.isIpAllowed(context.ipAddress)) {
        return false;
      }

      // Check direct permissions
      const permissionKey = `${permission.resource}:${permission.action}`;
      if (role.hasDirectPermission(permissionKey)) {
        return true;
      }

      // Check inherited permissions from parent roles
      if (role.inheritsPermissions && role.parent) {
        return await this.checkHierarchicalRolePermission(role.parent, permission, context);
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking hierarchical role permission: ${error.message}`);
      return false;
    }
  }

  private async checkPermissionSetPermission(
    permissionSet: PermissionSet,
    permission: RequiredPermission,
    context: PermissionContext,
    tenantId: string,
  ): Promise<boolean> {
    try {
      // Get effective permissions considering context
      const effectivePermissions = await this.permissionSetService.getEffectivePermissions(
        permissionSet.id,
        tenantId,
        {
          departmentId: context.departmentId,
          userId: context.metadata?.userId,
          ipAddress: context.ipAddress,
          timestamp: context.timestamp,
        },
      );

      const permissionKey = `${permission.resource}:${permission.action}`;
      return effectivePermissions.includes(permissionKey);
    } catch (error) {
      this.logger.error(`Error checking permission set permission: ${error.message}`);
      return false;
    }
  }

  private async checkLegacyRolePermission(
    user: User,
    permission: RequiredPermission,
  ): Promise<boolean> {
    try {
      // Fallback to the original role-based permission checking
      // This maintains backward compatibility
      
      // For now, this is a simplified implementation
      // You would inject the original AuthService here for actual legacy checks
      
      const legacyPermissions: Record<string, string[]> = {
        ADMIN: [
          'users:create', 'users:read', 'users:update', 'users:delete',
          'products:create', 'products:read', 'products:update', 'products:delete',
          'inventory:read', 'inventory:adjust', 'inventory:transfer',
          'reports:read', 'reports:export',
          'settings:read', 'settings:update',
        ],
        MANAGER: [
          'users:read',
          'products:create', 'products:read', 'products:update',
          'inventory:read', 'inventory:adjust', 'inventory:transfer',
          'reports:read', 'reports:export',
          'settings:read',
        ],
        STAFF: [
          'products:read',
          'inventory:read',
        ],
      };

      const userPermissions = legacyPermissions[user.role] || [];
      const permissionKey = `${permission.resource}:${permission.action}`;
      
      return userPermissions.includes(permissionKey);
    } catch (error) {
      this.logger.error(`Error checking legacy role permission: ${error.message}`);
      return false;
    }
  }

  // Additional helper methods for enterprise features

  private async checkConditionalPermission(
    permission: RequiredPermission,
    conditions: any,
    context: PermissionContext,
  ): Promise<boolean> {
    try {
      if (!conditions) {
        return true;
      }

      // Time-based conditions
      if (conditions.timeRestriction) {
        const now = context.timestamp || new Date();
        
        if (conditions.timeRestriction.validFrom) {
          const validFrom = new Date(conditions.timeRestriction.validFrom);
          if (now < validFrom) {
            return false;
          }
        }

        if (conditions.timeRestriction.validUntil) {
          const validUntil = new Date(conditions.timeRestriction.validUntil);
          if (now > validUntil) {
            return false;
          }
        }

        if (conditions.timeRestriction.allowedHours) {
          const currentHour = now.getHours();
          const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
          const allowedHours = conditions.timeRestriction.allowedHours[dayOfWeek];
          
          if (allowedHours) {
            const startHour = parseInt(allowedHours.start.split(':')[0]);
            const endHour = parseInt(allowedHours.end.split(':')[0]);
            
            if (currentHour < startHour || currentHour > endHour) {
              return false;
            }
          }
        }
      }

      // IP-based conditions
      if (conditions.ipRestriction && context.ipAddress) {
        if (conditions.ipRestriction.blockedIps?.includes(context.ipAddress)) {
          return false;
        }

        if (conditions.ipRestriction.allowedIps?.length > 0) {
          const isAllowed = conditions.ipRestriction.allowedIps.some((allowedIp: string) => {
            // Simple IP matching - in production, you'd use proper CIDR matching
            return context.ipAddress?.startsWith(allowedIp.split('/')[0]);
          });
          if (!isAllowed) {
            return false;
          }
        }
      }

      // Resource-based conditions
      if (conditions.resourceRestriction) {
        if (conditions.resourceRestriction.allowedResources?.length > 0) {
          if (!conditions.resourceRestriction.allowedResources.includes(permission.resource)) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking conditional permission: ${error.message}`);
      return false;
    }
  }

  private async auditPermissionCheck(
    user: User,
    permission: RequiredPermission,
    context: PermissionContext,
    granted: boolean,
  ): Promise<void> {
    try {
      // Log permission checks for audit purposes
      const auditData = {
        userId: user.id,
        userEmail: user.email,
        permission: `${permission.resource}:${permission.action}`,
        granted,
        timestamp: new Date(),
        ipAddress: context.ipAddress,
        resourceId: context.resourceId,
        metadata: context.metadata,
      };

      this.logger.log(`Permission audit: ${JSON.stringify(auditData)}`);
      
      // In a real implementation, you might store this in a dedicated audit table
    } catch (error) {
      this.logger.error(`Error auditing permission check: ${error.message}`);
    }
  }
}