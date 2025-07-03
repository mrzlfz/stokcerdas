import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_CHECK = 'skipTenantCheck';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check if tenant check should be skipped (for health endpoints, auth, etc.)
    const skipTenantCheck = this.reflector.get<boolean>(
      SKIP_TENANT_CHECK,
      context.getHandler(),
    ) || this.reflector.get<boolean>(
      SKIP_TENANT_CHECK,
      context.getClass(),
    );

    if (skipTenantCheck) {
      return next.handle();
    }

    // Extract tenant ID from headers
    const tenantId = request.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new BadRequestException({
        code: 'TENANT_ID_REQUIRED',
        message: 'Tenant ID is required in x-tenant-id header',
      });
    }

    // Validate tenant ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new BadRequestException({
        code: 'INVALID_TENANT_ID',
        message: 'Tenant ID must be a valid UUID',
      });
    }

    // If user is authenticated, verify they belong to this tenant
    const user = (request as any).user;
    if (user && user.tenantId && user.tenantId !== tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_MISMATCH',
        message: 'User does not belong to the specified tenant',
      });
    }

    // Store tenant ID in request for later use
    (request as any).tenantId = tenantId;

    return next.handle();
  }
}