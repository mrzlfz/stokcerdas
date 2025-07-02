import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository, Repository } from 'typeorm';
import { HierarchicalRole, RoleType, RoleLevel, RoleStatus } from '../entities/hierarchical-role.entity';
import { RoleHierarchy, InheritanceType, HierarchyStatus } from '../entities/role-hierarchy.entity';
import { Permission } from '../entities/permission.entity';

@Injectable()
export class HierarchicalRoleService {
  constructor(
    @InjectRepository(HierarchicalRole)
    private roleRepository: TreeRepository<HierarchicalRole>,
    @InjectRepository(RoleHierarchy)
    private hierarchyRepository: Repository<RoleHierarchy>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  // Create a new hierarchical role
  async create(
    createRoleDto: any,
    tenantId: string,
    userId: string,
  ): Promise<HierarchicalRole> {
    const { parentId, ...roleData } = createRoleDto;

    // Check if code is unique within tenant
    const existingRole = await this.roleRepository.findOne({
      where: {
        tenantId,
        code: roleData.code,
        isDeleted: false,
      },
    });

    if (existingRole) {
      throw new BadRequestException('Kode role sudah ada');
    }

    const role = this.roleRepository.create({
      ...roleData,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    // Set parent if provided
    if (parentId) {
      const parent = await this.findById(parentId, tenantId);
      role.parent = parent;
      role.depth = parent.depth + 1;
    } else {
      role.depth = 0;
    }

    const savedRole = await this.roleRepository.save(role);

    // Update path after saving
    savedRole.updatePath(savedRole.parent?.path);
    await this.roleRepository.save(savedRole);

    return savedRole;
  }

  // Find role by ID
  async findById(id: string, tenantId: string): Promise<HierarchicalRole> {
    const role = await this.roleRepository.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      relations: ['parent', 'children'],
    });

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    return role;
  }

  // Find all roles for a tenant
  async findAll(tenantId: string, includeInactive = false): Promise<HierarchicalRole[]> {
    const queryBuilder = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.parent', 'parent')
      .leftJoinAndSelect('role.children', 'children')
      .where('role.tenantId = :tenantId', { tenantId })
      .andWhere('role.isDeleted = false');

    if (!includeInactive) {
      queryBuilder.andWhere('role.status = :status', { status: RoleStatus.ACTIVE });
    }

    queryBuilder.orderBy('role.depth', 'ASC')
      .addOrderBy('role.name', 'ASC');

    return queryBuilder.getMany();
  }

  // Get role tree structure
  async getRoleTree(tenantId: string): Promise<HierarchicalRole[]> {
    const roots = await this.roleRepository.findRoots();
    const filteredRoots = roots.filter(root => 
      root.tenantId === tenantId && !root.isDeleted
    );

    const result = [];
    for (const root of filteredRoots) {
      const tree = await this.roleRepository.findDescendantsTree(root);
      result.push(tree);
    }

    return result;
  }

  // Get role with all ancestors
  async getRoleWithAncestors(id: string, tenantId: string): Promise<HierarchicalRole> {
    const role = await this.findById(id, tenantId);
    return this.roleRepository.findAncestorsTree(role);
  }

  // Get role with all descendants
  async getRoleWithDescendants(id: string, tenantId: string): Promise<HierarchicalRole> {
    const role = await this.findById(id, tenantId);
    return this.roleRepository.findDescendantsTree(role);
  }

  // Update role
  async update(
    id: string,
    updateRoleDto: any,
    tenantId: string,
    userId: string,
  ): Promise<HierarchicalRole> {
    const role = await this.findById(id, tenantId);
    
    // Check if system role is being modified
    if (role.isSystemRole && !role.canBeDeleted) {
      throw new ForbiddenException('Role sistem tidak dapat dimodifikasi');
    }

    const { parentId, ...updateData } = updateRoleDto;

    // Check if changing code to existing one
    if (updateData.code && updateData.code !== role.code) {
      const existingRole = await this.roleRepository.findOne({
        where: {
          tenantId,
          code: updateData.code,
          isDeleted: false,
        },
      });

      if (existingRole && existingRole.id !== id) {
        throw new BadRequestException('Kode role sudah ada');
      }
    }

    // Update parent if changed
    if (parentId !== undefined) {
      if (parentId === null) {
        role.parent = null;
        role.depth = 0;
      } else {
        const newParent = await this.findById(parentId, tenantId);
        
        // Prevent circular references
        const descendants = await this.roleRepository.findDescendants(role);
        if (descendants.some(desc => desc.id === parentId)) {
          throw new BadRequestException('Tidak dapat memindahkan role ke anak rolenya sendiri');
        }

        role.parent = newParent;
        role.depth = newParent.depth + 1;
      }
    }

    Object.assign(role, updateData);
    role.updatedBy = userId;

    const savedRole = await this.roleRepository.save(role);

    // Update path and cascade to children
    savedRole.updatePath(savedRole.parent?.path);
    await this.roleRepository.save(savedRole);

    // Update paths of all descendants
    await this.updateDescendantPaths(savedRole);

    return savedRole;
  }

  // Soft delete role
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const role = await this.findById(id, tenantId);

    if (!role.canBeDeleted) {
      throw new BadRequestException('Role ini tidak dapat dihapus');
    }

    // Check if role has active children
    const children = await this.roleRepository.findDescendants(role);
    const activeChildren = children.filter(child => 
      child.status === RoleStatus.ACTIVE && !child.isDeleted
    );

    if (activeChildren.length > 0) {
      throw new BadRequestException('Tidak dapat menghapus role yang memiliki sub-role aktif');
    }

    // TODO: Check if role has active users
    // if (role.currentUsers > 0) {
    //   throw new BadRequestException('Tidak dapat menghapus role yang memiliki pengguna aktif');
    // }

    role.softDelete(userId);
    await this.roleRepository.save(role);
  }

  // Change role status
  async changeStatus(
    id: string,
    status: RoleStatus,
    tenantId: string,
    userId: string,
  ): Promise<HierarchicalRole> {
    const role = await this.findById(id, tenantId);
    
    role.status = status;
    role.updatedBy = userId;
    
    return this.roleRepository.save(role);
  }

  // Get roles by type
  async findByType(
    type: RoleType,
    tenantId: string,
  ): Promise<HierarchicalRole[]> {
    return this.roleRepository.find({
      where: {
        tenantId,
        type,
        isDeleted: false,
        status: RoleStatus.ACTIVE,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  // Get roles by level
  async findByLevel(
    level: RoleLevel,
    tenantId: string,
  ): Promise<HierarchicalRole[]> {
    return this.roleRepository.find({
      where: {
        tenantId,
        level,
        isDeleted: false,
        status: RoleStatus.ACTIVE,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  // Search roles
  async search(
    query: string,
    tenantId: string,
    limit = 20,
  ): Promise<HierarchicalRole[]> {
    return this.roleRepository
      .createQueryBuilder('role')
      .where('role.tenantId = :tenantId', { tenantId })
      .andWhere('role.isDeleted = false')
      .andWhere('role.status = :status', { status: RoleStatus.ACTIVE })
      .andWhere('(role.name ILIKE :query OR role.code ILIKE :query)', {
        query: `%${query}%`,
      })
      .orderBy('role.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Create role hierarchy relationship
  async createHierarchy(
    parentRoleId: string,
    childRoleId: string,
    inheritanceType: InheritanceType,
    tenantId: string,
    userId: string,
    options?: {
      includedPermissions?: string[];
      excludedPermissions?: string[];
      conditions?: any;
    },
  ): Promise<RoleHierarchy> {
    const parentRole = await this.findById(parentRoleId, tenantId);
    const childRole = await this.findById(childRoleId, tenantId);

    // Check if hierarchy already exists
    const existingHierarchy = await this.hierarchyRepository.findOne({
      where: {
        tenantId,
        parentRoleId,
        childRoleId,
        isDeleted: false,
      },
    });

    if (existingHierarchy) {
      throw new BadRequestException('Hierarki role sudah ada');
    }

    // Prevent circular references
    const isCircular = await this.wouldCreateCircularReference(parentRoleId, childRoleId, tenantId);
    if (isCircular) {
      throw new BadRequestException('Tidak dapat membuat referensi sirkular dalam hierarki role');
    }

    const hierarchy = this.hierarchyRepository.create({
      tenantId,
      parentRoleId,
      childRoleId,
      inheritanceType,
      depth: Math.abs(parentRole.depth - childRole.depth),
      path: `${parentRole.path || parentRole.code}/${childRole.code}`,
      includedPermissions: options?.includedPermissions,
      excludedPermissions: options?.excludedPermissions,
      conditions: options?.conditions,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.hierarchyRepository.save(hierarchy);
  }

  // Get role hierarchy relationships
  async getHierarchies(tenantId: string): Promise<RoleHierarchy[]> {
    return this.hierarchyRepository.find({
      where: {
        tenantId,
        isDeleted: false,
        status: HierarchyStatus.ACTIVE,
      },
      relations: ['parentRole', 'childRole'],
      order: {
        depth: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  // Get parent roles for a role
  async getParentRoles(roleId: string, tenantId: string): Promise<HierarchicalRole[]> {
    const hierarchies = await this.hierarchyRepository.find({
      where: {
        tenantId,
        childRoleId: roleId,
        isDeleted: false,
        status: HierarchyStatus.ACTIVE,
      },
      relations: ['parentRole'],
    });

    return hierarchies.map(h => h.parentRole);
  }

  // Get child roles for a role
  async getChildRoles(roleId: string, tenantId: string): Promise<HierarchicalRole[]> {
    const hierarchies = await this.hierarchyRepository.find({
      where: {
        tenantId,
        parentRoleId: roleId,
        isDeleted: false,
        status: HierarchyStatus.ACTIVE,
      },
      relations: ['childRole'],
    });

    return hierarchies.map(h => h.childRole);
  }

  // Get effective permissions for a role (including inherited)
  async getEffectivePermissions(
    roleId: string,
    tenantId: string,
    context?: {
      departmentId?: string;
      userId?: string;
      ipAddress?: string;
    },
  ): Promise<string[]> {
    const role = await this.findById(roleId, tenantId);
    const permissions = new Set<string>();

    // Get direct permissions for the role
    const directPermissions = await this.getRolePermissions(roleId, tenantId);
    directPermissions.forEach(p => permissions.add(p));

    // Get inherited permissions
    if (role.inheritsPermissions) {
      const inheritedPermissions = await this.getInheritedPermissions(roleId, tenantId, context);
      inheritedPermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  // Get direct permissions for a role
  async getRolePermissions(roleId: string, tenantId: string): Promise<string[]> {
    // TODO: Implement role-permission relationship
    // This would query the role_permissions table or similar
    return [];
  }

  // Get inherited permissions for a role
  async getInheritedPermissions(
    roleId: string,
    tenantId: string,
    context?: any,
  ): Promise<string[]> {
    const parentRoles = await this.getParentRoles(roleId, tenantId);
    const permissions = new Set<string>();

    for (const parentRole of parentRoles) {
      const hierarchy = await this.hierarchyRepository.findOne({
        where: {
          tenantId,
          parentRoleId: parentRole.id,
          childRoleId: roleId,
          isDeleted: false,
          status: HierarchyStatus.ACTIVE,
        },
      });

      if (!hierarchy || !hierarchy.isValidNow) continue;

      // Check context-based restrictions
      if (context && !this.checkContextRestrictions(hierarchy, context)) {
        continue;
      }

      // Get parent role permissions
      const parentPermissions = await this.getEffectivePermissions(parentRole.id, tenantId, context);

      for (const permission of parentPermissions) {
        // Check if permission should be inherited
        if (hierarchy.shouldInheritPermission(permission)) {
          const override = hierarchy.getPermissionOverride(permission);
          
          if (override === 'grant') {
            permissions.add(permission);
          } else if (override === 'deny') {
            permissions.delete(permission);
          } else {
            permissions.add(permission);
          }
        }
      }
    }

    return Array.from(permissions);
  }

  // Check if role can grant permission to another role
  async canGrantPermission(
    grantingRoleId: string,
    receivingRoleId: string,
    permissionKey: string,
    tenantId: string,
  ): Promise<boolean> {
    const grantingRole = await this.findById(grantingRoleId, tenantId);
    const receivingRole = await this.findById(receivingRoleId, tenantId);

    if (!grantingRole.grantsPermissions) return false;

    // Check if granting role can grant to receiving role
    if (!grantingRole.canGrantTo(receivingRole)) return false;

    // Check if granting role has the permission
    const grantingPermissions = await this.getEffectivePermissions(grantingRoleId, tenantId);
    if (!grantingPermissions.includes(permissionKey)) return false;

    return true;
  }

  // Clone a role
  async cloneRole(
    sourceRoleId: string,
    newCode: string,
    newName: string,
    tenantId: string,
    userId: string,
  ): Promise<HierarchicalRole> {
    const sourceRole = await this.findById(sourceRoleId, tenantId);

    // Check if new code is unique
    const existingRole = await this.roleRepository.findOne({
      where: {
        tenantId,
        code: newCode,
        isDeleted: false,
      },
    });

    if (existingRole) {
      throw new BadRequestException('Kode role baru sudah ada');
    }

    const clonedRole = this.roleRepository.create({
      ...sourceRole,
      id: undefined,
      code: newCode,
      name: newName,
      type: RoleType.CUSTOM,
      status: RoleStatus.ACTIVE,
      isSystemRole: false,
      currentUsers: 0,
      parent: null,
      depth: 0,
      path: null,
      createdBy: userId,
      updatedBy: userId,
      createdAt: undefined,
      updatedAt: undefined,
    });

    return this.roleRepository.save(clonedRole);
  }

  // Get role statistics
  async getRoleStats(tenantId: string): Promise<any> {
    const roles = await this.findAll(tenantId, true);
    
    const stats = {
      total: roles.length,
      active: roles.filter(r => r.status === RoleStatus.ACTIVE).length,
      inactive: roles.filter(r => r.status === RoleStatus.INACTIVE).length,
      deprecated: roles.filter(r => r.status === RoleStatus.DEPRECATED).length,
      byType: {
        system: roles.filter(r => r.type === RoleType.SYSTEM).length,
        organizational: roles.filter(r => r.type === RoleType.ORGANIZATIONAL).length,
        departmental: roles.filter(r => r.type === RoleType.DEPARTMENTAL).length,
        functional: roles.filter(r => r.type === RoleType.FUNCTIONAL).length,
        custom: roles.filter(r => r.type === RoleType.CUSTOM).length,
      },
      byLevel: {
        executive: roles.filter(r => r.level === RoleLevel.EXECUTIVE).length,
        senior: roles.filter(r => r.level === RoleLevel.SENIOR).length,
        middle: roles.filter(r => r.level === RoleLevel.MIDDLE).length,
        junior: roles.filter(r => r.level === RoleLevel.JUNIOR).length,
        staff: roles.filter(r => r.level === RoleLevel.STAFF).length,
        intern: roles.filter(r => r.level === RoleLevel.INTERN).length,
      },
      totalUsers: roles.reduce((sum, role) => sum + role.currentUsers, 0),
      inheritanceRelationships: await this.hierarchyRepository.count({
        where: { tenantId, isDeleted: false },
      }),
    };

    return stats;
  }

  // Private helper methods
  private async updateDescendantPaths(role: HierarchicalRole): Promise<void> {
    const descendants = await this.roleRepository.findDescendants(role);
    
    for (const descendant of descendants) {
      if (descendant.id !== role.id) {
        const ancestors = await this.roleRepository.findAncestors(descendant);
        const sortedAncestors = ancestors
          .filter(a => a.id !== descendant.id)
          .sort((a, b) => a.depth - b.depth);
        
        const pathComponents = sortedAncestors.map(a => a.code);
        pathComponents.push(descendant.code);
        
        descendant.path = pathComponents.join('/');
        await this.roleRepository.save(descendant);
      }
    }
  }

  private async wouldCreateCircularReference(
    parentRoleId: string,
    childRoleId: string,
    tenantId: string,
  ): Promise<boolean> {
    // Check if child role is already an ancestor of parent role
    const childRole = await this.findById(childRoleId, tenantId);
    const childDescendants = await this.roleRepository.findDescendants(childRole);
    
    return childDescendants.some(desc => desc.id === parentRoleId);
  }

  private checkContextRestrictions(hierarchy: RoleHierarchy, context: any): boolean {
    const restrictions = hierarchy.conditions;
    if (!restrictions) return true;

    // Check department restriction
    if (restrictions.departmentRestriction && context.departmentId) {
      if (!hierarchy.isValidForDepartment(context.departmentId)) {
        return false;
      }
    }

    // Check time restriction
    if (restrictions.timeRestriction) {
      if (!hierarchy.isValidForTime()) {
        return false;
      }
    }

    return true;
  }

  // Bulk operations
  async bulkUpdateStatus(
    roleIds: string[],
    status: RoleStatus,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.roleRepository
      .createQueryBuilder()
      .update(HierarchicalRole)
      .set({ 
        status,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where('id IN (:...ids)', { ids: roleIds })
      .andWhere('tenantId = :tenantId', { tenantId })
      .andWhere('isDeleted = false')
      .andWhere('isSystemRole = false') // Prevent system role modifications
      .execute();
  }
}