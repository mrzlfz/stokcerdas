import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  PermissionResource,
  PermissionAction,
} from '../entities/permission.entity';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import {
  EnterpriseAuthService,
  EnterprisePermissionContext,
} from '../services/enterprise-auth.service';

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

@Injectable()
export class EnterprisePermissionsGuard implements CanActivate {
  private readonly logger = new Logger(EnterprisePermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly enterpriseAuthService: EnterpriseAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // If no permissions are specified, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const tenantId = request.tenantId || user?.tenantId;

    if (!user) {
      this.logger.warn(
        'No user found in request - authentication required before authorization',
      );
      throw new ForbiddenException('Autentikasi diperlukan');
    }

    if (!tenantId) {
      this.logger.warn('No tenant context found in request');
      throw new ForbiddenException('Konteks tenant diperlukan');
    }

    // Build permission context using EnterprisePermissionContext
    const permissionContext: EnterprisePermissionContext = {
      departmentId: request.headers['x-department-id'] as string,
      userId: user.id,
      ipAddress: request.ip || request.connection.remoteAddress,
      timestamp: new Date(),
      resourceId: request.params.id,
      metadata: {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
      },
    };

    // Check each required permission using enterprise auth service
    for (const permission of requiredPermissions) {
      try {
        const hasPermission =
          await this.enterpriseAuthService.hasEnterprisePermission(
            user.id,
            permission.resource,
            permission.action,
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
      } catch (error) {
        this.logger.error(
          `Error checking enterprise permission for user ${user.id}: ${error.message}`,
          error.stack,
        );
        throw new ForbiddenException('Gagal memeriksa izin enterprise');
      }
    }

    return true;
  }
}
