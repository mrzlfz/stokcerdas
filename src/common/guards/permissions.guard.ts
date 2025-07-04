import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { AuthService } from '../../auth/services/auth.service';
import {
  PermissionResource,
  PermissionAction,
} from '../../auth/entities/permission.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from '../../users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: User;
}

export interface RequiredPermission {
  resource: PermissionResource;
  action: PermissionAction;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
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

    if (!user) {
      this.logger.warn(
        'No user found in request - authentication required before authorization',
      );
      throw new ForbiddenException('Autentikasi diperlukan');
    }

    // Check each required permission
    for (const permission of requiredPermissions) {
      const hasPermission = await this.authService.hasPermission(
        user.id,
        permission.resource,
        permission.action,
      );

      if (!hasPermission) {
        const endpoint = `${request.method} ${request.url}`;
        this.logger.warn(
          `Permission denied for user ${user.email} (${user.role}) to ${endpoint}. Required: ${permission.resource}:${permission.action}`,
        );
        throw new ForbiddenException(
          `Anda tidak memiliki izin untuk ${permission.action} pada ${permission.resource}`,
        );
      }
    }

    return true;
  }
}
