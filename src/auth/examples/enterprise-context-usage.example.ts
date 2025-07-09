/**
 * ENTERPRISE CONTEXT DECORATORS USAGE EXAMPLES
 *
 * This file demonstrates how to use the enterprise context decorators
 * in your controllers to access tenant, user, and department information
 */

import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

// Import the decorators
import {
  TenantId,
  DepartmentId,
  DepartmentContext,
  EnterpriseUser,
  UserPermissions,
  EnterpriseSession,
  EnterpriseContext,
} from '../middleware/enterprise-context.middleware';

// Import types
import { User } from '../../users/entities/user.entity';
import { Department } from '../entities/department.entity';

@ApiTags('Enterprise Context Examples')
@Controller('examples/enterprise-context')
export class EnterpriseContextExampleController {
  /**
   * Example 1: Extract tenant ID only
   * Old way: const tenantId = req.user.tenantId;
   * New way: Use @TenantId() decorator
   */
  @Get('tenant-info')
  @ApiOperation({ summary: 'Get tenant-specific information' })
  @ApiResponse({ status: 200, description: 'Returns tenant information' })
  async getTenantInfo(
    @TenantId() tenantId: string,
  ): Promise<{ tenantId: string; message: string }> {
    return {
      tenantId,
      message: `Data for tenant: ${tenantId}`,
    };
  }

  /**
   * Example 2: Extract user and tenant information
   * Demonstrates multiple decorators in one method
   */
  @Get('user-context')
  @ApiOperation({ summary: 'Get user context information' })
  async getUserContext(
    @EnterpriseUser() user: User,
    @TenantId() tenantId: string,
    @DepartmentId() departmentId?: string,
  ): Promise<{
    userId: string;
    email: string;
    fullName: string;
    tenantId: string;
    departmentId?: string;
  }> {
    return {
      userId: user.id,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      tenantId,
      departmentId,
    };
  }

  /**
   * Example 3: Extract department context
   * Useful for department-scoped operations
   */
  @Get('department-context')
  @ApiOperation({ summary: 'Get department context information' })
  async getDepartmentContext(
    @DepartmentContext() department: Department,
    @TenantId() tenantId: string,
  ): Promise<{
    departmentId?: string;
    departmentName?: string;
    tenantId: string;
  }> {
    return {
      departmentId: department?.id,
      departmentName: department?.name,
      tenantId,
    };
  }

  /**
   * Example 4: Extract user permissions
   * Useful for authorization checks
   */
  @Get('user-permissions')
  @ApiOperation({ summary: 'Get user permissions' })
  async getUserPermissions(
    @UserPermissions() permissions: any,
    @EnterpriseUser() user: User,
  ): Promise<{
    userId: string;
    hasPermissions: boolean;
    roleCount: number;
    permissionSetCount: number;
  }> {
    return {
      userId: user.id,
      hasPermissions: !!permissions,
      roleCount: permissions?.hierarchicalRoles?.length || 0,
      permissionSetCount: permissions?.permissionSets?.length || 0,
    };
  }

  /**
   * Example 5: Extract full enterprise context
   * When you need everything at once
   */
  @Get('full-context')
  @ApiOperation({ summary: 'Get full enterprise context' })
  async getFullContext(@EnterpriseContext() context: any): Promise<{
    hasUser: boolean;
    hasTenant: boolean;
    hasDepartment: boolean;
    hasPermissions: boolean;
    hasAuditContext: boolean;
  }> {
    return {
      hasUser: !!context.user,
      hasTenant: !!context.tenantId,
      hasDepartment: !!context.departmentContext,
      hasPermissions: !!context.userPermissionCache,
      hasAuditContext: !!context.auditContext,
    };
  }

  /**
   * Example 6: Using decorators in POST methods
   * Demonstrates usage in data modification operations
   */
  @Post('create-department-data')
  @ApiOperation({ summary: 'Create data scoped to department' })
  async createDepartmentData(
    @Body() data: { name: string; description: string },
    @TenantId() tenantId: string,
    @DepartmentId() departmentId: string,
    @EnterpriseUser() user: User,
  ): Promise<{
    success: boolean;
    data: any;
    context: {
      tenantId: string;
      departmentId: string;
      createdBy: string;
    };
  }> {
    // This is just an example - in real implementation,
    // you would save to database with proper scoping

    const result = {
      ...data,
      id: `dept_data_${Date.now()}`,
      tenantId,
      departmentId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: result,
      context: {
        tenantId,
        departmentId,
        createdBy: user.email,
      },
    };
  }

  /**
   * Example 7: Session-aware operations
   * Using enterprise audit context for tracking
   */
  @Get('session-info')
  @ApiOperation({ summary: 'Get enterprise session information' })
  async getSessionInfo(
    @EnterpriseSession() auditContext: any,
    @EnterpriseUser() user: User,
  ): Promise<{
    sessionId?: string;
    requestId?: string;
    userId: string;
    sessionValid: boolean;
    ipAddress?: string;
    userAgent?: string;
  }> {
    return {
      sessionId: auditContext?.sessionId,
      requestId: auditContext?.requestId,
      userId: user.id,
      sessionValid: !!auditContext,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
    };
  }
}

/**
 * MIGRATION GUIDE - OLD vs NEW
 *
 * OLD WAY (manual extraction from request):
 * ----------------------------------------
 * async someMethod(@Request() req: any): Promise<any> {
 *   const tenantId = req.user.tenantId;
 *   const user = req.user;
 *   const departmentId = req.departmentId;
 *   // ... rest of method
 * }
 *
 * NEW WAY (using decorators):
 * ---------------------------
 * async someMethod(
 *   @TenantId() tenantId: string,
 *   @EnterpriseUser() user: User,
 *   @DepartmentId() departmentId?: string
 * ): Promise<any> {
 *   // ... rest of method
 * }
 *
 * BENEFITS:
 * - Type safety
 * - Cleaner code
 * - Automatic validation
 * - Consistent error handling
 * - Better documentation
 */
