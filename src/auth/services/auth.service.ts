import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { Permission, PermissionResource, PermissionAction } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  tenantId: string;
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for revocation
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    emailVerified: boolean;
    mfaEnabled: boolean;
    lastLoginAt: Date;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string, tenantId: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          email: email.toLowerCase(),
          tenantId,
          isDeleted: false,
        },
      });

      if (!user) {
        return null;
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException('Account is temporarily locked due to too many failed login attempts');
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is not active');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        await this.handleFailedLogin(user);
        return null;
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await this.resetLoginAttempts(user);
      }

      return user;
    } catch (error) {
      this.logger.error(`Error validating user: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Login user and return tokens
   */
  async login(loginDto: LoginDto, tenantId: string, ipAddress?: string): Promise<LoginResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password, tenantId);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.updateLastLogin(user, ipAddress);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  /**
   * Register new user
   */
  async register(registerDto: RegisterDto, tenantId: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: {
        email: registerDto.email.toLowerCase(),
        tenantId,
        isDeleted: false,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Create user
    const user = this.userRepository.create({
      tenantId,
      email: registerDto.email.toLowerCase(),
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phoneNumber: registerDto.phoneNumber,
      role: registerDto.role || UserRole.STAFF,
      status: UserStatus.PENDING,
      language: 'id',
      timezone: 'Asia/Jakarta',
      emailVerificationToken: randomBytes(32).toString('hex'),
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`New user registered: ${savedUser.email} (${savedUser.id})`);

    return savedUser;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('auth.jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
          isDeleted: false,
        },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      jti: randomBytes(16).toString('hex'),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('auth.jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<number>('auth.jwt.expiresInSeconds'),
      tokenType: 'Bearer',
    };
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, resource: PermissionResource, action: PermissionAction): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return false;
    }

    // Super admin has all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Check role-based permissions
    const rolePermission = await this.rolePermissionRepository
      .createQueryBuilder('rp')
      .innerJoin('rp.permission', 'p')
      .where('rp.role = :role', { role: user.role })
      .andWhere('p.resource = :resource', { resource })
      .andWhere('p.action = :action', { action })
      .andWhere('rp.isActive = true')
      .andWhere('p.isActive = true')
      .getOne();

    return !!rolePermission;
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isDeleted: false },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return [];
    }

    // Super admin has all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      const allPermissions = await this.permissionRepository.find({
        where: { isActive: true },
      });
      return allPermissions.map(p => p.key);
    }

    // Get role-based permissions
    const rolePermissions = await this.rolePermissionRepository
      .createQueryBuilder('rp')
      .innerJoin('rp.permission', 'p')
      .where('rp.role = :role', { role: user.role })
      .andWhere('rp.isActive = true')
      .andWhere('p.isActive = true')
      .select(['p.resource', 'p.action'])
      .getRawMany();

    return rolePermissions.map(rp => `${rp.p_resource}:${rp.p_action}`);
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(user: User): Promise<void> {
    user.loginAttempts += 1;

    // Lock account after 5 failed attempts
    if (user.loginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      this.logger.warn(`Account locked for user: ${user.email} (${user.id})`);
    }

    await this.userRepository.save(user);
  }

  /**
   * Reset login attempts
   */
  private async resetLoginAttempts(user: User): Promise<void> {
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepository.save(user);
  }

  /**
   * Update last login information
   */
  private async updateLastLogin(user: User, ipAddress?: string): Promise<void> {
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress || null;
    await this.userRepository.save(user);
  }

  /**
   * Initialize default permissions
   */
  async initializePermissions(): Promise<void> {
    const permissions = await this.getDefaultPermissions();
    
    for (const permissionData of permissions) {
      const existing = await this.permissionRepository.findOne({
        where: {
          resource: permissionData.resource,
          action: permissionData.action,
        },
      });

      if (!existing) {
        const permission = this.permissionRepository.create(permissionData);
        await this.permissionRepository.save(permission);
      }
    }

    // Initialize role permissions
    await this.initializeRolePermissions();
  }

  /**
   * Get default permissions configuration
   */
  private getDefaultPermissions() {
    const resources = Object.values(PermissionResource);
    const actions = Object.values(PermissionAction);
    const permissions = [];

    for (const resource of resources) {
      for (const action of actions) {
        // Skip system permissions for non-system resources
        if (action === PermissionAction.VIEW_ALL || action === PermissionAction.MANAGE_SYSTEM) {
          permissions.push({
            resource,
            action,
            name: `${resource.charAt(0).toUpperCase() + resource.slice(1)} ${action.replace('_', ' ')}`,
            description: `${action.replace('_', ' ').toUpperCase()} ${resource}`,
            isSystemPermission: true,
          });
        } else {
          permissions.push({
            resource,
            action,  
            name: `${resource.charAt(0).toUpperCase() + resource.slice(1)} ${action.replace('_', ' ')}`,
            description: `${action.replace('_', ' ').toUpperCase()} ${resource}`,
            isSystemPermission: false,
          });
        }
      }
    }

    return permissions;
  }

  /**
   * Initialize default role permissions
   */
  private async initializeRolePermissions(): Promise<void> {
    const rolePermissionsConfig = this.getDefaultRolePermissions();

    for (const config of rolePermissionsConfig) {
      const permission = await this.permissionRepository.findOne({
        where: {
          resource: config.resource,
          action: config.action,
        },
      });

      if (permission) {
        for (const role of config.roles) {
          const existing = await this.rolePermissionRepository.findOne({
            where: {
              role,
              permissionId: permission.id,
            },
          });

          if (!existing) {
            const rolePermission = this.rolePermissionRepository.create({
              role,
              permissionId: permission.id,
            });
            await this.rolePermissionRepository.save(rolePermission);
          }
        }
      }
    }
  }

  /**
   * Get default role permissions configuration
   */
  private getDefaultRolePermissions() {
    return [
      // SUPER_ADMIN: All permissions (handled separately)
      
      // ADMIN: Most permissions except system management
      { resource: PermissionResource.USERS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.USERS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.USERS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.USERS, action: PermissionAction.DELETE, roles: [UserRole.ADMIN] },
      
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.DELETE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.IMPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.EXPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      { resource: PermissionResource.INVENTORY, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.INVENTORY, action: PermissionAction.ADJUST, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.INVENTORY, action: PermissionAction.TRANSFER, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      { resource: PermissionResource.REPORTS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.REPORTS, action: PermissionAction.EXPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      { resource: PermissionResource.SETTINGS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN] },
    ];
  }
}