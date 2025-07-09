import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Get,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';

import {
  AuthService,
  LoginResponse,
  AuthTokens,
} from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantCheck } from '../../common/decorators/skip-tenant-check.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { User } from '../../users/entities/user.entity';

interface RequestWithUser extends Request {
  user: User;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email and password',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant ID for multi-tenant authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            tokenType: { type: 'string', example: 'Bearer' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: { type: 'string' },
            path: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: LoginResponse; meta: any }> {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID diperlukan');
    }

    const clientIp = req.ip || req.connection.remoteAddress;

    this.logger.log(
      `Login attempt for ${loginDto.email} from ${clientIp} (tenant: ${tenantId})`,
    );

    const result = await this.authService.login(loginDto, tenantId, clientIp);

    this.logger.log(
      `Login successful for ${loginDto.email} (${result.user.id})`,
    );

    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User registration',
    description: 'Register a new user account',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant ID for multi-tenant registration',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: { message: string }; meta: any }> {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID diperlukan');
    }

    this.logger.log(
      `Registration attempt for ${registerDto.email} (tenant: ${tenantId})`,
    );

    const user = await this.authService.register(registerDto, tenantId);

    this.logger.log(
      `Registration successful for ${registerDto.email} (${user.id})`,
    );

    return {
      success: true,
      data: {
        message:
          'Registrasi berhasil. Silakan periksa email untuk verifikasi akun.',
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generate new access token using refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: AuthTokens; meta: any }> {
    this.logger.log('Token refresh attempt');

    const tokens = await this.authService.refreshToken(refreshTokenDto);

    this.logger.log('Token refresh successful');

    return {
      success: true,
      data: tokens,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Get current authenticated user profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(
    @GetUser() user: User,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: Partial<User>; meta: any }> {
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        lastLoginAt: user.lastLoginAt,
        language: user.language,
        timezone: user.timezone,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Get('permissions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user permissions',
    description: 'Get current authenticated user permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  async getPermissions(
    @GetUser() user: User,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: { permissions: string[] }; meta: any }> {
    const permissions = await this.authService.getUserPermissions(user.id);

    return {
      success: true,
      data: {
        permissions,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User logout',
    description: 'Logout current user session',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
  })
  async logout(
    @GetUser() user: User,
    @Req() req: Request,
  ): Promise<{ success: boolean; data: { message: string }; meta: any }> {
    this.logger.log(`Logout for user ${user.email} (${user.id})`);

    // Note: In a production app, you might want to invalidate the JWT token
    // This could be done by maintaining a blacklist of tokens or using a shorter expiry

    return {
      success: true,
      data: {
        message: 'Logout berhasil',
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Public()
  @Post('activate-user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate user (Development/Testing)',
    description:
      'Manually activate a user for development and testing purposes',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant ID for user activation',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User activated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async activateUser(
    @Body() body: { email: string },
    @Req() req: Request,
  ): Promise<{
    success: boolean;
    data: { message: string; user?: any };
    meta: any;
  }> {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID diperlukan');
    }

    this.logger.log(
      `Manual user activation attempt for ${body.email} (tenant: ${tenantId})`,
    );

    const user = await this.authService.activateUser(body.email, tenantId);

    if (!user) {
      throw new BadRequestException('User tidak ditemukan atau sudah aktif');
    }

    this.logger.log(`User manually activated: ${user.email} (${user.id})`);

    return {
      success: true,
      data: {
        message: 'User berhasil diaktivasi untuk testing/development',
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          emailVerified: user.emailVerified,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }

  @Public()
  @Post('activate-all-pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate all pending users (Development/Testing)',
    description:
      'Bulk activate all pending users for development and testing purposes',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant ID for bulk activation',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Users activated successfully',
  })
  async activateAllPendingUsers(@Req() req: Request): Promise<{
    success: boolean;
    data: { message: string; activatedCount: number };
    meta: any;
  }> {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID diperlukan');
    }

    this.logger.log(`Bulk user activation attempt for tenant: ${tenantId}`);

    const activatedCount = await this.authService.activateAllPendingUsers(
      tenantId,
    );

    this.logger.log(
      `Bulk activation completed: ${activatedCount} users activated for tenant ${tenantId}`,
    );

    return {
      success: true,
      data: {
        message: `${activatedCount} user(s) berhasil diaktivasi untuk testing/development`,
        activatedCount,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    };
  }
}
