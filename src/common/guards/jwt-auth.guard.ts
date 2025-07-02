import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANT_CHECK_KEY } from '../decorators/skip-tenant-check.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if tenant check should be skipped
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();

    // Validate tenant ID if not skipped
    if (!skipTenantCheck) {
      const tenantId = request.headers['x-tenant-id'] as string;
      
      if (!tenantId) {
        this.logger.warn('Missing tenant ID in request headers');
        throw new UnauthorizedException('Tenant ID diperlukan');
      }

      // Validate tenant ID format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tenantId)) {
        this.logger.warn(`Invalid tenant ID format: ${tenantId}`);
        throw new UnauthorizedException('Format Tenant ID tidak valid');
      }
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest<Request>();
      const endpoint = `${request.method} ${request.url}`;
      
      this.logger.warn(`Authentication failed for ${endpoint}: ${err?.message || info?.message || 'Unknown error'}`);
      
      throw err || new UnauthorizedException('Token tidak valid');
    }

    return user;
  }
}