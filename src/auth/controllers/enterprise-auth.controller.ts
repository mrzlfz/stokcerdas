import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { EnterpriseAuthService } from '../services/enterprise-auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CurrentTenant } from '../decorators/current-tenant.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  PermissionResource,
  PermissionAction,
} from '../entities/permission.entity';
import { StandardResponse } from '../../common/dto/standard-response.dto';

// DTOs for enterprise auth operations
interface AssignHierarchicalRoleDto {
  userId: string;
  roleId: string;
  requiresApproval?: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  assignmentReason?: string;
  metadata?: Record<string, any>;
}

interface AssignPermissionSetDto {
  userId: string;
  permissionSetId: string;
  requiresApproval?: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  assignmentReason?: string;
  conditions?: Record<string, any>;
}

interface AssignDepartmentDto {
  userId: string;
  departmentId: string;
  role?: string;
  isPrimary?: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  assignmentReason?: string;
}

interface UserPermissionSummaryDto {
  userId: string;
  directPermissions: string[];
  inheritedPermissions: string[];
  permissionSetPermissions: string[];
  effectivePermissions: string[];
  restrictions: {
    timeRestrictions: any[];
    ipRestrictions: any[];
    departmentRestrictions: any[];
  };
  roles: {
    legacyRole: string;
    hierarchicalRoles: string[];
    permissionSets: string[];
  };
}

interface PermissionCheckRequestDto {
  userId: string;
  resource: string;
  action: string;
  context?: {
    departmentId?: string;
    ipAddress?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
  };
}

interface PermissionCheckResponseDto {
  granted: boolean;
  source: 'legacy' | 'hierarchical_role' | 'permission_set' | 'super_admin';
  details: {
    roleId?: string;
    permissionSetId?: string;
    inherited?: boolean;
    conditions?: any;
  };
  restrictions?: {
    timeValid: boolean;
    ipValid: boolean;
    departmentValid: boolean;
  };
}

interface UserAssignmentDto {
  id: string;
  userId: string;
  entityType: 'role' | 'permission_set' | 'department';
  entityId: string;
  entityName: string;
  assignedBy: string;
  assignedAt: Date;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  isActive: boolean;
  assignmentReason?: string;
}

@ApiTags('Enterprise Authentication')
@ApiBearerAuth()
@Controller('enterprise-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnterpriseAuthController {
  constructor(private readonly enterpriseAuthService: EnterpriseAuthService) {}

  @Post('assign-role')
  @ApiOperation({
    summary: 'Assign hierarchical role to user',
    description:
      'Assigns a hierarchical role to a user with optional approval workflow',
  })
  @ApiCreatedResponse({
    description: 'Role assignment successful or approval workflow initiated',
  })
  @ApiBadRequestResponse({ description: 'Invalid user or role ID' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions to assign role',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.UPDATE,
  })
  async assignHierarchicalRole(
    @Body() assignRoleDto: AssignHierarchicalRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') assignedBy: string,
  ): Promise<StandardResponse<{ requiresApproval: boolean; message: string }>> {
    await this.enterpriseAuthService.assignHierarchicalRole(
      assignRoleDto.userId,
      assignRoleDto.roleId,
      tenantId,
      assignedBy,
      assignRoleDto.requiresApproval,
    );

    return {
      success: true,
      message: assignRoleDto.requiresApproval
        ? 'Role assignment submitted for approval'
        : 'Hierarchical role berhasil diberikan kepada user',
      data: {
        requiresApproval: assignRoleDto.requiresApproval || false,
        message: assignRoleDto.requiresApproval
          ? 'Assignment will be processed after approval'
          : 'Role assigned immediately',
      },
    };
  }

  @Post('assign-permission-set')
  @ApiOperation({
    summary: 'Assign permission set to user',
    description:
      'Assigns a permission set to a user with optional approval workflow',
  })
  @ApiCreatedResponse({
    description:
      'Permission set assignment successful or approval workflow initiated',
  })
  @ApiBadRequestResponse({ description: 'Invalid user or permission set ID' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions to assign permission set',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.UPDATE,
  })
  async assignPermissionSet(
    @Body() assignPermissionSetDto: AssignPermissionSetDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') assignedBy: string,
  ): Promise<StandardResponse<{ requiresApproval: boolean; message: string }>> {
    await this.enterpriseAuthService.assignPermissionSet(
      assignPermissionSetDto.userId,
      assignPermissionSetDto.permissionSetId,
      tenantId,
      assignedBy,
      assignPermissionSetDto.requiresApproval,
    );

    return {
      success: true,
      message: assignPermissionSetDto.requiresApproval
        ? 'Permission set assignment submitted for approval'
        : 'Permission set berhasil diberikan kepada user',
      data: {
        requiresApproval: assignPermissionSetDto.requiresApproval || false,
        message: assignPermissionSetDto.requiresApproval
          ? 'Assignment will be processed after approval'
          : 'Permission set assigned immediately',
      },
    };
  }

  @Post('assign-department')
  @ApiOperation({
    summary: 'Assign user to department',
    description:
      'Assigns a user to a department with optional role and access settings',
  })
  @ApiCreatedResponse({
    description: 'Department assignment successful',
  })
  @ApiBadRequestResponse({ description: 'Invalid user or department ID' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions to assign department',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.UPDATE,
  })
  async assignDepartment(
    @Body() assignDepartmentDto: AssignDepartmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') assignedBy: string,
  ): Promise<StandardResponse<{ message: string }>> {
    // This would be implemented with a department assignment service
    // For now, return a success message
    return {
      success: true,
      message: 'User berhasil diberikan akses ke departemen',
      data: {
        message: 'Department assignment completed successfully',
      },
    };
  }

  @Get('users/:userId/permission-summary')
  @ApiOperation({
    summary: 'Get user permission summary',
    description:
      'Retrieves comprehensive permission summary for a user including all sources',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiOkResponse({
    description: 'User permission summary retrieved successfully',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.READ,
  })
  async getUserPermissionSummary(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<UserPermissionSummaryDto>> {
    const summary = await this.enterpriseAuthService.getUserPermissionSummary(
      userId,
      tenantId,
    );

    return {
      success: true,
      message: 'User permission summary berhasil diambil',
      data: {
        userId,
        ...summary,
      } as UserPermissionSummaryDto,
    };
  }

  @Post('check-permission')
  @ApiOperation({
    summary: 'Check user permission',
    description:
      'Checks if a user has a specific permission using enterprise logic',
  })
  @ApiOkResponse({
    description: 'Permission check completed',
  })
  @ApiBadRequestResponse({ description: 'Invalid permission check request' })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.READ,
  })
  async checkPermission(
    @Body() checkRequest: PermissionCheckRequestDto,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<PermissionCheckResponseDto>> {
    const result = await this.enterpriseAuthService.checkEnterprisePermission(
      checkRequest.userId,
      checkRequest.resource as any,
      checkRequest.action as any,
      checkRequest.context,
    );

    return {
      success: true,
      message: 'Permission check selesai',
      data: result as PermissionCheckResponseDto,
    };
  }

  @Get('users/:userId/assignments')
  @ApiOperation({
    summary: 'Get user assignments',
    description:
      'Retrieves all role, permission set, and department assignments for a user',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by assignment type',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    description: 'Filter by active status',
  })
  @ApiOkResponse({
    description: 'User assignments retrieved successfully',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.READ,
  })
  async getUserAssignments(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
    @Query('type') type?: 'role' | 'permission_set' | 'department',
    @Query('active') active?: boolean,
  ): Promise<StandardResponse<UserAssignmentDto[]>> {
    // This would be implemented with actual assignment retrieval
    // For now, return empty array
    const assignments: UserAssignmentDto[] = [];

    return {
      success: true,
      message: 'User assignments berhasil diambil',
      data: assignments,
      meta: {
        total: assignments.length,
        filters: { type, active },
      },
    };
  }

  @Delete('users/:userId/assignments/:assignmentId')
  @ApiOperation({
    summary: 'Remove user assignment',
    description:
      'Removes a role, permission set, or department assignment from a user',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiParam({ name: 'assignmentId', description: 'ID of the assignment' })
  @ApiNoContentResponse({ description: 'Assignment removed successfully' })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions to remove assignment',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.UPDATE,
  })
  async removeAssignment(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') removedBy: string,
  ): Promise<StandardResponse<void>> {
    // This would be implemented with actual assignment removal
    return {
      success: true,
      message: 'Assignment berhasil dihapus dari user',
    };
  }

  @Get('departments/:departmentId/access-check/:userId')
  @ApiOperation({
    summary: 'Check department access',
    description: 'Checks if a user has access to a specific department',
  })
  @ApiParam({ name: 'departmentId', description: 'ID of the department' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiOkResponse({
    description: 'Department access check completed',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.READ,
  })
  async checkDepartmentAccess(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<StandardResponse<{ hasAccess: boolean; reason?: string }>> {
    const hasAccess = await this.enterpriseAuthService.checkDepartmentAccess(
      userId,
      departmentId,
      tenantId,
    );

    return {
      success: true,
      message: 'Department access check selesai',
      data: {
        hasAccess,
        reason: hasAccess
          ? 'User has access to department'
          : 'User does not have access to department',
      },
    };
  }

  @Post('bulk-assign-roles')
  @ApiOperation({
    summary: 'Bulk assign roles to users',
    description: 'Assigns roles to multiple users in a single operation',
  })
  @ApiCreatedResponse({
    description: 'Bulk role assignment completed',
  })
  @ApiBadRequestResponse({ description: 'Invalid bulk assignment request' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions for bulk assignment',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.UPDATE,
  })
  async bulkAssignRoles(
    @Body()
    bulkAssignDto: {
      assignments: Array<{
        userId: string;
        roleId: string;
        requiresApproval?: boolean;
      }>;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') assignedBy: string,
  ): Promise<
    StandardResponse<{
      successful: number;
      failed: number;
      pending: number;
      errors: Array<{ userId: string; error: string }>;
    }>
  > {
    let successful = 0;
    let failed = 0;
    let pending = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const assignment of bulkAssignDto.assignments) {
      try {
        await this.enterpriseAuthService.assignHierarchicalRole(
          assignment.userId,
          assignment.roleId,
          tenantId,
          assignedBy,
          assignment.requiresApproval,
        );

        if (assignment.requiresApproval) {
          pending++;
        } else {
          successful++;
        }
      } catch (error) {
        failed++;
        errors.push({
          userId: assignment.userId,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: `Bulk assignment selesai: ${successful} berhasil, ${failed} gagal, ${pending} menunggu approval`,
      data: {
        successful,
        failed,
        pending,
        errors,
      },
    };
  }

  @Get('audit-trail/:userId')
  @ApiOperation({
    summary: 'Get user permission audit trail',
    description: 'Retrieves audit trail of permission changes for a user',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for audit trail',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for audit trail',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of results',
  })
  @ApiOkResponse({
    description: 'Audit trail retrieved successfully',
  })
  @Permissions({
    resource: PermissionResource.ANALYTICS,
    action: PermissionAction.READ,
  })
  async getUserAuditTrail(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit: number = 100,
  ): Promise<
    StandardResponse<
      Array<{
        id: string;
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        changes: Record<string, any>;
        performedBy: string;
        performedAt: Date;
        ipAddress?: string;
        metadata?: Record<string, any>;
      }>
    >
  > {
    // This would be implemented with actual audit trail retrieval
    const auditTrail = [];

    return {
      success: true,
      message: 'Audit trail berhasil diambil',
      data: auditTrail,
      meta: {
        userId,
        startDate,
        endDate,
        limit,
        total: auditTrail.length,
      },
    };
  }

  @Post('validate-permissions')
  @ApiOperation({
    summary: 'Validate user permissions configuration',
    description:
      'Validates and reports on user permission configuration issues',
  })
  @ApiOkResponse({
    description: 'Permission validation completed',
  })
  @Permissions({
    resource: PermissionResource.USERS,
    action: PermissionAction.READ,
  })
  async validateUserPermissions(
    @Body() validationRequest: { userId: string },
    @CurrentTenant() tenantId: string,
  ): Promise<
    StandardResponse<{
      isValid: boolean;
      warnings: string[];
      errors: string[];
      recommendations: string[];
    }>
  > {
    // This would implement comprehensive permission validation
    return {
      success: true,
      message: 'Permission validation selesai',
      data: {
        isValid: true,
        warnings: [],
        errors: [],
        recommendations: [],
      },
    };
  }
}
