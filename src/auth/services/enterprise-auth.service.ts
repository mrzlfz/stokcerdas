import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { Permission, PermissionResource, PermissionAction } from '../entities/permission.entity';
import { HierarchicalRole } from '../entities/hierarchical-role.entity';
import { Department } from '../entities/department.entity';
import { PermissionSet } from '../entities/permission-set.entity';
import { HierarchicalRoleService } from './hierarchical-role.service';
import { PermissionSetService } from './permission-set.service';
import { DepartmentService } from './department.service';
import { AuthService } from './auth.service';

export interface EnterprisePermissionContext {
  departmentId?: string;
  userId?: string;
  ipAddress?: string;
  timestamp?: Date;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface UserPermissionSummary {
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
    legacyRole: UserRole;
    hierarchicalRoles: string[];
    permissionSets: string[];
  };
}

export interface PermissionCheckResult {
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

@Injectable()
export class EnterpriseAuthService {
  private readonly logger = new Logger(EnterpriseAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(HierarchicalRole)
    private readonly hierarchicalRoleRepository: Repository<HierarchicalRole>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(PermissionSet)
    private readonly permissionSetRepository: Repository<PermissionSet>,
    private readonly hierarchicalRoleService: HierarchicalRoleService,
    private readonly permissionSetService: PermissionSetService,
    private readonly departmentService: DepartmentService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Check if user has specific permission with enterprise logic
   */
  async hasEnterprisePermission(
    userId: string,
    resource: PermissionResource,
    action: PermissionAction,
    context?: EnterprisePermissionContext,
  ): Promise<boolean> {
    const result = await this.checkEnterprisePermission(userId, resource, action, context);
    return result.granted;
  }

  /**
   * Detailed permission check with enterprise logic
   */
  async checkEnterprisePermission(
    userId: string,
    resource: PermissionResource,
    action: PermissionAction,
    context?: EnterprisePermissionContext,
  ): Promise<PermissionCheckResult> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId, isDeleted: false },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        return {
          granted: false,
          source: 'legacy',
          details: {},
        };
      }

      // Super admin check
      if (user.role === UserRole.SUPER_ADMIN) {
        return {
          granted: true,
          source: 'super_admin',
          details: {},
        };
      }

      const permissionKey = `${resource}:${action}`;

      // 1. Check hierarchical roles
      const hierarchicalResult = await this.checkHierarchicalRolePermissions(
        userId,
        user.tenantId,
        permissionKey,
        context,
      );
      if (hierarchicalResult.granted) {
        return hierarchicalResult;
      }

      // 2. Check permission sets
      const permissionSetResult = await this.checkPermissionSetPermissions(
        userId,
        user.tenantId,
        permissionKey,
        context,
      );
      if (permissionSetResult.granted) {
        return permissionSetResult;
      }

      // 3. Fallback to legacy role-based permissions
      const legacyGranted = await this.authService.hasPermission(userId, resource, action);
      return {
        granted: legacyGranted,
        source: 'legacy',
        details: { roleId: user.role },
      };

    } catch (error) {
      this.logger.error(`Error checking enterprise permission: ${error.message}`, error.stack);
      return {
        granted: false,
        source: 'legacy',
        details: { error: error.message },
      };
    }
  }

  /**
   * Get comprehensive user permission summary
   */
  async getUserPermissionSummary(
    userId: string,
    tenantId: string,
    context?: EnterprisePermissionContext,
  ): Promise<UserPermissionSummary> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId, tenantId, isDeleted: false },
      });

      if (!user) {
        throw new NotFoundException('User tidak ditemukan');
      }

      // Get legacy permissions
      const directPermissions = await this.authService.getUserPermissions(userId);

      // Get hierarchical role permissions
      const hierarchicalRoles = await this.getUserHierarchicalRoles(userId, tenantId);
      const inheritedPermissions = await this.getHierarchicalRolePermissions(hierarchicalRoles, context);

      // Get permission set permissions
      const permissionSets = await this.getUserPermissionSets(userId, tenantId);
      const permissionSetPermissions = await this.getPermissionSetPermissions(permissionSets, context);

      // Calculate effective permissions
      const allPermissions = new Set([
        ...directPermissions,
        ...inheritedPermissions,
        ...permissionSetPermissions,
      ]);

      // Get restrictions
      const restrictions = await this.getUserRestrictions(userId, tenantId, context);

      return {
        directPermissions,
        inheritedPermissions,
        permissionSetPermissions,
        effectivePermissions: Array.from(allPermissions),
        restrictions,
        roles: {
          legacyRole: user.role,
          hierarchicalRoles: hierarchicalRoles.map(r => r.name),
          permissionSets: permissionSets.map(ps => ps.name),
        },
      };

    } catch (error) {
      this.logger.error(`Error getting user permission summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign hierarchical role to user
   */
  async assignHierarchicalRole(
    userId: string,
    roleId: string,
    tenantId: string,
    assignedBy: string,
    requiresApproval = false,
  ): Promise<void> {
    try {
      // Validate user
      const user = await this.userRepository.findOne({
        where: { id: userId, tenantId, isDeleted: false },
      });

      if (!user) {
        throw new NotFoundException('User tidak ditemukan');
      }

      // Validate role
      const role = await this.hierarchicalRoleRepository.findOne({
        where: { id: roleId, tenantId, isDeleted: false },
      });

      if (!role) {
        throw new NotFoundException('Hierarchical role tidak ditemukan');
      }

      if (requiresApproval) {
        // Trigger approval workflow
        await this.triggerRoleAssignmentApproval(userId, roleId, tenantId, assignedBy);
      } else {
        // Direct assignment
        await this.performRoleAssignment(userId, roleId, tenantId, assignedBy);
      }

    } catch (error) {
      this.logger.error(`Error assigning hierarchical role: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign permission set to user
   */
  async assignPermissionSet(
    userId: string,
    permissionSetId: string,
    tenantId: string,
    assignedBy: string,
    requiresApproval = false,
  ): Promise<void> {
    try {
      // Validate user
      const user = await this.userRepository.findOne({
        where: { id: userId, tenantId, isDeleted: false },
      });

      if (!user) {
        throw new NotFoundException('User tidak ditemukan');
      }

      // Validate permission set
      const permissionSet = await this.permissionSetRepository.findOne({
        where: { id: permissionSetId, tenantId, isDeleted: false },
      });

      if (!permissionSet) {
        throw new NotFoundException('Permission set tidak ditemukan');
      }

      if (requiresApproval || permissionSet.requiresApproval) {
        // Trigger approval workflow
        await this.triggerPermissionSetAssignmentApproval(userId, permissionSetId, tenantId, assignedBy);
      } else {
        // Direct assignment
        await this.performPermissionSetAssignment(userId, permissionSetId, tenantId, assignedBy);
      }

    } catch (error) {
      this.logger.error(`Error assigning permission set: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check department access for user
   */
  async checkDepartmentAccess(
    userId: string,
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      // Get user's department assignments
      const userDepartments = await this.getUserDepartments(userId, tenantId);
      
      // Check direct access
      if (userDepartments.some(dept => dept.id === departmentId)) {
        return true;
      }

      // Check hierarchical access (parent-child relationships)
      const department = await this.departmentRepository.findOne({
        where: { id: departmentId, tenantId, isDeleted: false },
        relations: ['parent', 'children'],
      });

      if (!department) {
        return false;
      }

      // Check if user has access to parent departments
      for (const userDept of userDepartments) {
        if (await this.isDepartmentParentOf(userDept.id, departmentId, tenantId)) {
          return true;
        }
      }

      return false;

    } catch (error) {
      this.logger.error(`Error checking department access: ${error.message}`, error.stack);
      return false;
    }
  }

  // Private helper methods

  private async checkHierarchicalRolePermissions(
    userId: string,
    tenantId: string,
    permissionKey: string,
    context?: EnterprisePermissionContext,
  ): Promise<PermissionCheckResult> {
    try {
      const hierarchicalRoles = await this.getUserHierarchicalRoles(userId, tenantId);

      for (const role of hierarchicalRoles) {
        // Check role validity
        if (!role.isValidNow) continue;

        // Check context restrictions
        const restrictions = this.checkRoleRestrictions(role, context);
        if (!restrictions.timeValid || !restrictions.ipValid || !restrictions.departmentValid) {
          continue;
        }

        // Check direct permission
        if (role.hasDirectPermission(permissionKey)) {
          return {
            granted: true,
            source: 'hierarchical_role',
            details: { roleId: role.id, inherited: false },
            restrictions,
          };
        }

        // Check inherited permission
        if (role.inheritsPermissions && await this.checkInheritedPermission(role, permissionKey)) {
          return {
            granted: true,
            source: 'hierarchical_role',
            details: { roleId: role.id, inherited: true },
            restrictions,
          };
        }
      }

      return { granted: false, source: 'hierarchical_role', details: {} };

    } catch (error) {
      this.logger.error(`Error checking hierarchical role permissions: ${error.message}`);
      return { granted: false, source: 'hierarchical_role', details: { error: error.message } };
    }
  }

  private async checkPermissionSetPermissions(
    userId: string,
    tenantId: string,
    permissionKey: string,
    context?: EnterprisePermissionContext,
  ): Promise<PermissionCheckResult> {
    try {
      const permissionSets = await this.getUserPermissionSets(userId, tenantId);

      for (const permissionSet of permissionSets) {
        const effectivePermissions = await this.permissionSetService.getEffectivePermissions(
          permissionSet.id,
          tenantId,
          context,
        );

        if (effectivePermissions.includes(permissionKey)) {
          return {
            granted: true,
            source: 'permission_set',
            details: {
              permissionSetId: permissionSet.id,
              conditions: permissionSet.conditions,
            },
          };
        }
      }

      return { granted: false, source: 'permission_set', details: {} };

    } catch (error) {
      this.logger.error(`Error checking permission set permissions: ${error.message}`);
      return { granted: false, source: 'permission_set', details: { error: error.message } };
    }
  }

  private async getUserHierarchicalRoles(
    userId: string,
    tenantId: string,
  ): Promise<HierarchicalRole[]> {
    // In a real implementation, this would query user-role assignments
    // For now, return empty array as the assignment system isn't implemented yet
    return [];
  }

  private async getUserPermissionSets(
    userId: string,
    tenantId: string,
  ): Promise<PermissionSet[]> {
    // In a real implementation, this would query user-permission set assignments
    // For now, return empty array as the assignment system isn't implemented yet
    return [];
  }

  private async getUserDepartments(
    userId: string,
    tenantId: string,
  ): Promise<Department[]> {
    // In a real implementation, this would query user-department assignments
    // For now, return empty array as the assignment system isn't implemented yet
    return [];
  }

  private checkRoleRestrictions(
    role: HierarchicalRole,
    context?: EnterprisePermissionContext,
  ): { timeValid: boolean; ipValid: boolean; departmentValid: boolean } {
    return {
      timeValid: role.isWithinAllowedHours(),
      ipValid: !context?.ipAddress || role.isIpAllowed(context.ipAddress),
      departmentValid: true, // Simplified for now
    };
  }

  private async checkInheritedPermission(
    role: HierarchicalRole,
    permissionKey: string,
  ): Promise<boolean> {
    if (!role.parent || !role.inheritsPermissions) {
      return false;
    }

    // Check parent role recursively
    if (role.parent.hasDirectPermission(permissionKey)) {
      return true;
    }

    return this.checkInheritedPermission(role.parent, permissionKey);
  }

  private async getHierarchicalRolePermissions(
    roles: HierarchicalRole[],
    context?: EnterprisePermissionContext,
  ): Promise<string[]> {
    const permissions = new Set<string>();

    for (const role of roles) {
      if (role.isValidNow && role.isWithinAllowedHours()) {
        const rolePermissions = role.getEffectivePermissions();
        rolePermissions.forEach(perm => permissions.add(perm));
      }
    }

    return Array.from(permissions);
  }

  private async getPermissionSetPermissions(
    permissionSets: PermissionSet[],
    context?: EnterprisePermissionContext,
  ): Promise<string[]> {
    const permissions = new Set<string>();

    for (const permissionSet of permissionSets) {
      if (permissionSet.isValidNow && permissionSet.isWithinAllowedHours()) {
        const setPermissions = permissionSet.getPermissionKeys();
        setPermissions.forEach(perm => permissions.add(perm));
      }
    }

    return Array.from(permissions);
  }

  private async getUserRestrictions(
    userId: string,
    tenantId: string,
    context?: EnterprisePermissionContext,
  ): Promise<UserPermissionSummary['restrictions']> {
    return {
      timeRestrictions: [], // To be implemented
      ipRestrictions: [], // To be implemented
      departmentRestrictions: [], // To be implemented
    };
  }

  private async isDepartmentParentOf(
    parentDeptId: string,
    childDeptId: string,
    tenantId: string,
  ): Promise<boolean> {
    // Simplified implementation - in reality you'd traverse the department tree
    return false;
  }

  private async triggerRoleAssignmentApproval(
    userId: string,
    roleId: string,
    tenantId: string,
    requestedBy: string,
  ): Promise<void> {
    // This would trigger the approval workflow
    // Implementation depends on the approval chain system
    this.logger.log(`Role assignment approval triggered for user ${userId}, role ${roleId}`);
  }

  private async triggerPermissionSetAssignmentApproval(
    userId: string,
    permissionSetId: string,
    tenantId: string,
    requestedBy: string,
  ): Promise<void> {
    // This would trigger the approval workflow
    // Implementation depends on the approval chain system
    this.logger.log(`Permission set assignment approval triggered for user ${userId}, set ${permissionSetId}`);
  }

  private async performRoleAssignment(
    userId: string,
    roleId: string,
    tenantId: string,
    assignedBy: string,
  ): Promise<void> {
    // This would perform the actual role assignment
    // Implementation depends on user-role assignment entities
    this.logger.log(`Role assigned to user ${userId}: role ${roleId} by ${assignedBy}`);
  }

  private async performPermissionSetAssignment(
    userId: string,
    permissionSetId: string,
    tenantId: string,
    assignedBy: string,
  ): Promise<void> {
    // This would perform the actual permission set assignment
    // Implementation depends on user-permission set assignment entities
    this.logger.log(`Permission set assigned to user ${userId}: set ${permissionSetId} by ${assignedBy}`);
  }
}