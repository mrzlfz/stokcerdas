import {
  Injectable,
  NestMiddleware,
  Logger,
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Department } from '../entities/department.entity';
import { HierarchicalRole } from '../entities/hierarchical-role.entity';
import {
  PermissionSet,
  PermissionSetStatus,
} from '../entities/permission-set.entity';

export interface EnterpriseRequest extends Request {
  user?: User;
  tenantId?: string;
  departmentId?: string;
  departmentContext?: Department;
  userPermissionCache?: {
    hierarchicalRoles: HierarchicalRole[];
    permissionSets: PermissionSet[];
    departments: Department[];
    lastUpdated: Date;
  };
  auditContext?: {
    sessionId: string;
    requestId: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
  };
}

@Injectable()
export class EnterpriseContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EnterpriseContextMiddleware.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(HierarchicalRole)
    private readonly hierarchicalRoleRepository: Repository<HierarchicalRole>,
    @InjectRepository(PermissionSet)
    private readonly permissionSetRepository: Repository<PermissionSet>,
  ) {}

  async use(req: EnterpriseRequest, res: Response, next: NextFunction) {
    try {
      // 1. Extract and validate tenant context
      await this.extractTenantContext(req);

      // 2. Extract department context if provided
      await this.extractDepartmentContext(req);

      // 3. Setup audit context
      this.setupAuditContext(req);

      // 4. Pre-load user enterprise data if authenticated
      if (req.user) {
        await this.preloadUserEnterpriseData(req);
      }

      // 5. Setup security headers
      this.setupSecurityHeaders(req, res);

      next();
    } catch (error) {
      this.logger.error(
        `Enterprise context middleware error: ${error.message}`,
        error.stack,
      );
      next(error);
    }
  }

  private async extractTenantContext(req: EnterpriseRequest): Promise<void> {
    // Priority order: header > user.tenantId > subdomain > query
    let tenantId: string | undefined;

    // 1. Check X-Tenant-ID header
    tenantId = req.headers['x-tenant-id'] as string;

    // 2. Check user context (if authenticated)
    if (!tenantId && req.user?.tenantId) {
      tenantId = req.user.tenantId;
    }

    // 3. Check subdomain (for multi-tenant SaaS)
    if (!tenantId) {
      const host = req.headers.host || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        tenantId = subdomain;
      }
    }

    // 4. Check query parameter (fallback)
    if (!tenantId) {
      tenantId = req.query.tenantId as string;
    }

    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }

    req.tenantId = tenantId;
    this.logger.debug(`Tenant context set: ${tenantId}`);
  }

  private async extractDepartmentContext(
    req: EnterpriseRequest,
  ): Promise<void> {
    // Department context is optional but provides additional isolation
    const departmentId = req.headers['x-department-id'] as string;

    if (departmentId && req.tenantId) {
      try {
        const department = await this.departmentRepository.findOne({
          where: {
            id: departmentId,
            tenantId: req.tenantId,
            isDeleted: false,
            isActive: true,
          },
          relations: ['parent', 'children'],
        });

        if (department) {
          req.departmentId = departmentId;
          req.departmentContext = department;
          this.logger.debug(
            `Department context set: ${department.name} (${departmentId})`,
          );
        } else {
          this.logger.warn(`Invalid department ID provided: ${departmentId}`);
        }
      } catch (error) {
        this.logger.error(`Error loading department context: ${error.message}`);
      }
    }
  }

  private setupAuditContext(req: EnterpriseRequest): void {
    const sessionId =
      (req.headers['x-session-id'] as string) || this.generateSessionId();
    const requestId =
      (req.headers['x-request-id'] as string) || this.generateRequestId();
    const ipAddress = this.extractRealIpAddress(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    req.auditContext = {
      sessionId,
      requestId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };

    // Add to response headers for debugging
    req.res?.setHeader('X-Request-ID', requestId);
    req.res?.setHeader('X-Session-ID', sessionId);

    this.logger.debug(`Audit context set: ${requestId}`);
  }

  private async preloadUserEnterpriseData(
    req: EnterpriseRequest,
  ): Promise<void> {
    if (!req.user || !req.tenantId) {
      return;
    }

    try {
      // Check if we already have cached data that's still fresh (5 minutes)
      if (req.userPermissionCache?.lastUpdated) {
        const cacheAge =
          Date.now() - req.userPermissionCache.lastUpdated.getTime();
        if (cacheAge < 5 * 60 * 1000) {
          // 5 minutes
          return;
        }
      }

      // Load user's hierarchical roles
      const hierarchicalRoles = await this.getUserHierarchicalRoles(
        req.user.id,
        req.tenantId,
      );

      // Load user's permission sets
      const permissionSets = await this.getUserPermissionSets(
        req.user.id,
        req.tenantId,
      );

      // Load user's departments
      const departments = await this.getUserDepartments(
        req.user.id,
        req.tenantId,
      );

      // Cache the data
      req.userPermissionCache = {
        hierarchicalRoles,
        permissionSets,
        departments,
        lastUpdated: new Date(),
      };

      this.logger.debug(
        `User enterprise data preloaded: ${hierarchicalRoles.length} roles, ${permissionSets.length} permission sets, ${departments.length} departments`,
      );
    } catch (error) {
      this.logger.error(
        `Error preloading user enterprise data: ${error.message}`,
      );
    }
  }

  private setupSecurityHeaders(req: EnterpriseRequest, res: Response): void {
    // Add security headers for enterprise context
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Add enterprise-specific headers
    if (req.tenantId) {
      res.setHeader('X-Tenant-Context', req.tenantId);
    }

    if (req.departmentId) {
      res.setHeader('X-Department-Context', req.departmentId);
    }

    // Add CSP header with tenant-specific configurations
    const csp = this.buildContentSecurityPolicy(req);
    res.setHeader('Content-Security-Policy', csp);
  }

  private async getUserHierarchicalRoles(
    userId: string,
    tenantId: string,
  ): Promise<HierarchicalRole[]> {
    // In a real implementation, this would query user-role assignments
    // For now, return empty array as the assignment system isn't implemented yet
    try {
      return await this.hierarchicalRoleRepository.find({
        where: {
          tenantId,
          isDeleted: false,
          isActive: true,
        },
        relations: ['permissions', 'parent'],
        take: 50, // Limit for performance
      });
    } catch (error) {
      this.logger.error(
        `Error loading user hierarchical roles: ${error.message}`,
      );
      return [];
    }
  }

  private async getUserPermissionSets(
    userId: string,
    tenantId: string,
  ): Promise<PermissionSet[]> {
    // In a real implementation, this would query user-permission set assignments
    // For now, return empty array as the assignment system isn't implemented yet
    try {
      return await this.permissionSetRepository.find({
        where: {
          tenantId,
          isDeleted: false,
          status: PermissionSetStatus.ACTIVE,
        },
        relations: ['permissions'],
        take: 50, // Limit for performance
      });
    } catch (error) {
      this.logger.error(`Error loading user permission sets: ${error.message}`);
      return [];
    }
  }

  private async getUserDepartments(
    userId: string,
    tenantId: string,
  ): Promise<Department[]> {
    // In a real implementation, this would query user-department assignments
    // For now, return empty array as the assignment system isn't implemented yet
    try {
      return await this.departmentRepository.find({
        where: {
          tenantId,
          isDeleted: false,
          isActive: true,
        },
        relations: ['parent'],
        take: 20, // Limit for performance
      });
    } catch (error) {
      this.logger.error(`Error loading user departments: ${error.message}`);
      return [];
    }
  }

  private extractRealIpAddress(req: Request): string {
    // Extract real IP address considering proxies and load balancers
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const cloudflareIp = req.headers['cf-connecting-ip'] as string;

    if (cloudflareIp) {
      return cloudflareIp;
    }

    if (realIp) {
      return realIp;
    }

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return (
      req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'
    );
  }

  private buildContentSecurityPolicy(req: EnterpriseRequest): string {
    const basePolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ];

    // Add tenant-specific allowed domains if configured
    if (req.tenantId) {
      // This could be expanded to include tenant-specific CDN domains
      basePolicy.push(`worker-src 'self'`);
    }

    return basePolicy.join('; ');
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Enterprise Context Parameter Decorators

/**
 * Extract tenant ID from enterprise request context
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();

    if (!request.tenantId) {
      throw new BadRequestException('Tenant context not available in request');
    }

    return request.tenantId;
  },
);

/**
 * Extract department ID from enterprise request context
 */
export const DepartmentId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();
    return request.departmentId;
  },
);

/**
 * Extract department context from enterprise request
 */
export const DepartmentContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Department | undefined => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();
    return request.departmentContext;
  },
);

/**
 * Extract enterprise user from request context
 */
export const EnterpriseUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();

    if (!request.user) {
      throw new BadRequestException('User context not available in request');
    }

    return request.user;
  },
);

/**
 * Extract user permission cache from enterprise request
 */
export const UserPermissions = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();
    return request.userPermissionCache;
  },
);

/**
 * Extract enterprise session information (audit context)
 */
export const EnterpriseSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();
    return request.auditContext;
  },
);

/**
 * Extract full enterprise context from request
 */
export const EnterpriseContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Partial<EnterpriseRequest> => {
    const request = ctx.switchToHttp().getRequest<EnterpriseRequest>();

    return {
      user: request.user,
      tenantId: request.tenantId,
      departmentId: request.departmentId,
      departmentContext: request.departmentContext,
      userPermissionCache: request.userPermissionCache,
      auditContext: request.auditContext,
    };
  },
);

// Utility functions for controllers
export class EnterpriseContextUtils {
  static getTenantId(req: EnterpriseRequest): string {
    if (!req.tenantId) {
      throw new BadRequestException('Tenant context not available');
    }
    return req.tenantId;
  }

  static getDepartmentId(req: EnterpriseRequest): string | undefined {
    return req.departmentId;
  }

  static getDepartmentContext(req: EnterpriseRequest): Department | undefined {
    return req.departmentContext;
  }

  static getAuditContext(
    req: EnterpriseRequest,
  ): EnterpriseRequest['auditContext'] {
    return req.auditContext;
  }

  static getUserPermissionCache(
    req: EnterpriseRequest,
  ): EnterpriseRequest['userPermissionCache'] {
    return req.userPermissionCache;
  }

  static hasValidDepartmentContext(req: EnterpriseRequest): boolean {
    return !!(req.departmentId && req.departmentContext);
  }

  static isInDepartment(req: EnterpriseRequest, departmentId: string): boolean {
    return req.departmentId === departmentId;
  }

  static hasRoleInContext(req: EnterpriseRequest, roleName: string): boolean {
    return (
      req.userPermissionCache?.hierarchicalRoles.some(
        role => role.name === roleName,
      ) || false
    );
  }

  static hasPermissionSetInContext(
    req: EnterpriseRequest,
    permissionSetCode: string,
  ): boolean {
    return (
      req.userPermissionCache?.permissionSets.some(
        ps => ps.code === permissionSetCode,
      ) || false
    );
  }
}
