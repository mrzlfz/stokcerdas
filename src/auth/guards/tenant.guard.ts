import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const SKIP_TENANT_CHECK_KEY = 'skipTenantCheck';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if tenant check should be skipped
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTenantCheck) {
      return true;
    }

    // Extract tenant ID from headers
    const tenantId = request.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      this.logger.warn('Missing tenant ID in request headers');
      throw new BadRequestException({
        code: 'TENANT_ID_REQUIRED',
        message: 'Tenant ID diperlukan dalam header x-tenant-id',
        details: 'Setiap permintaan API harus menyertakan tenant ID yang valid',
      });
    }

    // Validate tenant ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      this.logger.warn(`Invalid tenant ID format: ${tenantId}`);
      throw new BadRequestException({
        code: 'INVALID_TENANT_ID',
        message: 'Format Tenant ID tidak valid',
        details: 'Tenant ID harus berupa UUID yang valid',
      });
    }

    // If user is authenticated, verify they belong to this tenant
    const user = (request as any).user;
    if (user && user.tenantId && user.tenantId !== tenantId) {
      this.logger.warn(`Tenant mismatch for user ${user.id}: expected ${tenantId}, got ${user.tenantId}`);
      throw new UnauthorizedException({
        code: 'TENANT_MISMATCH',
        message: 'Akses ditolak untuk tenant ini',
        details: 'User tidak memiliki akses ke tenant yang diminta',
      });
    }

    // Store tenant ID in request for later use
    (request as any).tenantId = tenantId;

    this.logger.debug(`Tenant validation passed for tenant: ${tenantId}`);
    return true;
  }
}

// Decorator for skipping tenant checks
export const SkipTenantCheck = () => 
  Reflect.metadata(SKIP_TENANT_CHECK_KEY, true);