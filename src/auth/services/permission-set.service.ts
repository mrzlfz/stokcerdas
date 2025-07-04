import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  PermissionSet,
  PermissionSetType,
  PermissionSetStatus,
  PermissionSetScope,
} from '../entities/permission-set.entity';
import { Permission } from '../entities/permission.entity';

@Injectable()
export class PermissionSetService {
  constructor(
    @InjectRepository(PermissionSet)
    private permissionSetRepository: Repository<PermissionSet>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  // Create a new permission set
  async create(
    createPermissionSetDto: any,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const { permissionIds, inheritsFromId, ...permissionSetData } =
      createPermissionSetDto;

    // Check if code is unique within tenant
    const existingPermissionSet = await this.permissionSetRepository.findOne({
      where: {
        tenantId,
        code: permissionSetData.code,
        isDeleted: false,
      },
    });

    if (existingPermissionSet) {
      throw new BadRequestException('Kode permission set sudah ada');
    }

    // Get permissions if provided
    let permissions: Permission[] = [];
    if (permissionIds && permissionIds.length > 0) {
      permissions = await this.permissionRepository.find({
        where: {
          id: In(permissionIds),
        },
      });

      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('Beberapa permission tidak ditemukan');
      }
    }

    // Handle inheritance
    let inheritedPermissions: string[] = [];
    if (inheritsFromId) {
      const basePermissionSet = await this.findById(inheritsFromId, tenantId);
      inheritedPermissions = basePermissionSet.getPermissionKeys();
    }

    const permissionSet = this.permissionSetRepository.create({
      ...permissionSetData,
      tenantId,
      permissions,
      inheritedPermissions,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedPermissionSet = (await this.permissionSetRepository.save(
      permissionSet,
    )) as unknown as PermissionSet;

    // Record usage for template
    if (inheritsFromId) {
      await this.recordUsage(inheritsFromId);
    }

    return savedPermissionSet;
  }

  // Find permission set by ID
  async findById(id: string, tenantId: string): Promise<PermissionSet> {
    const permissionSet = await this.permissionSetRepository.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      relations: ['permissions'],
    });

    if (!permissionSet) {
      throw new NotFoundException('Permission set tidak ditemukan');
    }

    return permissionSet;
  }

  // Find all permission sets for a tenant
  async findAll(
    tenantId: string,
    includeInactive = false,
    scope?: PermissionSetScope,
  ): Promise<PermissionSet[]> {
    const queryBuilder = this.permissionSetRepository
      .createQueryBuilder('permissionSet')
      .leftJoinAndSelect('permissionSet.permissions', 'permissions')
      .where('permissionSet.tenantId = :tenantId', { tenantId })
      .andWhere('permissionSet.isDeleted = false');

    if (!includeInactive) {
      queryBuilder.andWhere('permissionSet.status = :status', {
        status: PermissionSetStatus.ACTIVE,
      });
    }

    if (scope) {
      queryBuilder.andWhere('permissionSet.scope = :scope', { scope });
    }

    queryBuilder
      .orderBy('permissionSet.priority', 'DESC')
      .addOrderBy('permissionSet.name', 'ASC');

    return queryBuilder.getMany();
  }

  // Get permission sets by type
  async findByType(
    type: PermissionSetType,
    tenantId: string,
  ): Promise<PermissionSet[]> {
    return this.permissionSetRepository.find({
      where: {
        tenantId,
        type,
        isDeleted: false,
        status: PermissionSetStatus.ACTIVE,
      },
      relations: ['permissions'],
      order: {
        priority: 'DESC',
        name: 'ASC',
      },
    });
  }

  // Get permission set templates
  async getTemplates(tenantId: string): Promise<PermissionSet[]> {
    return this.permissionSetRepository.find({
      where: {
        tenantId,
        isTemplate: true,
        isDeleted: false,
        status: PermissionSetStatus.ACTIVE,
      },
      relations: ['permissions'],
      order: {
        usageCount: 'DESC',
        priority: 'DESC',
        name: 'ASC',
      },
    });
  }

  // Get permission sets by category
  async findByCategory(
    category: string,
    tenantId: string,
    subcategory?: string,
  ): Promise<PermissionSet[]> {
    const queryBuilder = this.permissionSetRepository
      .createQueryBuilder('permissionSet')
      .leftJoinAndSelect('permissionSet.permissions', 'permissions')
      .where('permissionSet.tenantId = :tenantId', { tenantId })
      .andWhere('permissionSet.category = :category', { category })
      .andWhere('permissionSet.isDeleted = false')
      .andWhere('permissionSet.status = :status', {
        status: PermissionSetStatus.ACTIVE,
      });

    if (subcategory) {
      queryBuilder.andWhere('permissionSet.subcategory = :subcategory', {
        subcategory,
      });
    }

    queryBuilder
      .orderBy('permissionSet.priority', 'DESC')
      .addOrderBy('permissionSet.name', 'ASC');

    return queryBuilder.getMany();
  }

  // Search permission sets
  async search(
    query: string,
    tenantId: string,
    limit = 20,
  ): Promise<PermissionSet[]> {
    return this.permissionSetRepository
      .createQueryBuilder('permissionSet')
      .leftJoinAndSelect('permissionSet.permissions', 'permissions')
      .where('permissionSet.tenantId = :tenantId', { tenantId })
      .andWhere('permissionSet.isDeleted = false')
      .andWhere('permissionSet.status = :status', {
        status: PermissionSetStatus.ACTIVE,
      })
      .andWhere(
        '(permissionSet.name ILIKE :query OR permissionSet.code ILIKE :query OR permissionSet.description ILIKE :query)',
        {
          query: `%${query}%`,
        },
      )
      .orderBy('permissionSet.priority', 'DESC')
      .addOrderBy('permissionSet.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Update permission set
  async update(
    id: string,
    updatePermissionSetDto: any,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const permissionSet = await this.findById(id, tenantId);

    // Check if system-defined permission set is being modified
    if (!permissionSet.canBeModified) {
      throw new ForbiddenException(
        'Permission set sistem tidak dapat dimodifikasi',
      );
    }

    const { permissionIds, ...updateData } = updatePermissionSetDto;

    // Check if changing code to existing one
    if (updateData.code && updateData.code !== permissionSet.code) {
      const existingPermissionSet = await this.permissionSetRepository.findOne({
        where: {
          tenantId,
          code: updateData.code,
          isDeleted: false,
        },
      });

      if (existingPermissionSet && existingPermissionSet.id !== id) {
        throw new BadRequestException('Kode permission set sudah ada');
      }
    }

    // Update permissions if provided
    if (permissionIds !== undefined) {
      if (permissionIds.length > 0) {
        const permissions = await this.permissionRepository.find({
          where: {
            id: In(permissionIds),
          },
        });

        if (permissions.length !== permissionIds.length) {
          throw new BadRequestException('Beberapa permission tidak ditemukan');
        }

        permissionSet.permissions = permissions;
      } else {
        permissionSet.permissions = [];
      }
    }

    Object.assign(permissionSet, updateData);
    permissionSet.updatedBy = userId;

    // Update version if significant changes
    if (permissionIds !== undefined || updateData.conditions) {
      const versionParts = permissionSet.version.split('.');
      const majorVersion = parseInt(versionParts[0]);
      const minorVersion = parseInt(versionParts[1]);
      const patchVersion = parseInt(versionParts[2] || '0');

      permissionSet.version = `${majorVersion}.${minorVersion}.${
        patchVersion + 1
      }`;
    }

    return this.permissionSetRepository.save(permissionSet);
  }

  // Add permission to set
  async addPermission(
    id: string,
    permissionId: string,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const permissionSet = await this.findById(id, tenantId);

    if (!permissionSet.canBeModified) {
      throw new ForbiddenException(
        'Permission set sistem tidak dapat dimodifikasi',
      );
    }

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission tidak ditemukan');
    }

    permissionSet.addPermission(permission);
    permissionSet.updatedBy = userId;

    return this.permissionSetRepository.save(permissionSet);
  }

  // Remove permission from set
  async removePermission(
    id: string,
    permissionId: string,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const permissionSet = await this.findById(id, tenantId);

    if (!permissionSet.canBeModified) {
      throw new ForbiddenException(
        'Permission set sistem tidak dapat dimodifikasi',
      );
    }

    permissionSet.removePermission(permissionId);
    permissionSet.updatedBy = userId;

    return this.permissionSetRepository.save(permissionSet);
  }

  // Clone permission set
  async clone(
    sourceId: string,
    newCode: string,
    newName: string,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const sourcePermissionSet = await this.findById(sourceId, tenantId);

    // Check if new code is unique
    const existingPermissionSet = await this.permissionSetRepository.findOne({
      where: {
        tenantId,
        code: newCode,
        isDeleted: false,
      },
    });

    if (existingPermissionSet) {
      throw new BadRequestException('Kode permission set baru sudah ada');
    }

    const clonedData = sourcePermissionSet.clone(newCode, newName);
    const clonedPermissionSet = this.permissionSetRepository.create({
      ...clonedData,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedPermissionSet = await this.permissionSetRepository.save(
      clonedPermissionSet,
    );

    // Record usage for source
    await this.recordUsage(sourceId);

    return savedPermissionSet;
  }

  // Create template from permission set
  async createTemplate(
    sourceId: string,
    templateCode: string,
    templateName: string,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const sourcePermissionSet = await this.findById(sourceId, tenantId);

    const template = await this.clone(
      sourceId,
      templateCode,
      templateName,
      tenantId,
      userId,
    );
    template.type = PermissionSetType.TEMPLATE;
    template.isTemplate = true;
    template.isReusable = true;
    template.status = PermissionSetStatus.ACTIVE;

    return this.permissionSetRepository.save(template);
  }

  // Apply template to create permission set
  async applyTemplate(
    templateId: string,
    newCode: string,
    newName: string,
    tenantId: string,
    userId: string,
    customizations?: {
      addPermissions?: string[];
      removePermissions?: string[];
      conditions?: any;
    },
  ): Promise<PermissionSet> {
    const template = await this.findById(templateId, tenantId);

    if (!template.isTemplate) {
      throw new BadRequestException('Permission set ini bukan template');
    }

    // Clone the template
    const newPermissionSet = await this.clone(
      templateId,
      newCode,
      newName,
      tenantId,
      userId,
    );
    newPermissionSet.type = PermissionSetType.CUSTOM;
    newPermissionSet.isTemplate = false;

    // Apply customizations
    if (customizations) {
      if (customizations.addPermissions?.length) {
        const additionalPermissions = await this.permissionRepository.find({
          where: {
            id: In(customizations.addPermissions),
          },
        });

        additionalPermissions.forEach(permission => {
          newPermissionSet.addPermission(permission);
        });
      }

      if (customizations.removePermissions?.length) {
        customizations.removePermissions.forEach(permissionId => {
          newPermissionSet.removePermission(permissionId);
        });
      }

      if (customizations.conditions) {
        newPermissionSet.conditions = customizations.conditions;
      }
    }

    return this.permissionSetRepository.save(newPermissionSet);
  }

  // Change permission set status
  async changeStatus(
    id: string,
    status: PermissionSetStatus,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const permissionSet = await this.findById(id, tenantId);

    if (!permissionSet.canBeModified) {
      throw new ForbiddenException(
        'Permission set sistem tidak dapat dimodifikasi',
      );
    }

    permissionSet.status = status;
    permissionSet.updatedBy = userId;

    return this.permissionSetRepository.save(permissionSet);
  }

  // Soft delete permission set
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const permissionSet = await this.findById(id, tenantId);

    if (!permissionSet.canBeDeleted) {
      throw new BadRequestException('Permission set ini tidak dapat dihapus');
    }

    permissionSet.softDelete(userId);
    await this.permissionSetRepository.save(permissionSet);
  }

  // Restore soft deleted permission set
  async restore(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    const permissionSet = await this.permissionSetRepository.findOne({
      where: {
        id,
        tenantId,
        isDeleted: true,
      },
      relations: ['permissions'],
    });

    if (!permissionSet) {
      throw new NotFoundException(
        'Permission set yang dihapus tidak ditemukan',
      );
    }

    permissionSet.restore();
    permissionSet.updatedBy = userId;

    return this.permissionSetRepository.save(permissionSet);
  }

  // Get effective permissions for permission set
  async getEffectivePermissions(
    id: string,
    tenantId: string,
    context?: {
      departmentId?: string;
      userId?: string;
      ipAddress?: string;
      timestamp?: Date;
    },
  ): Promise<string[]> {
    const permissionSet = await this.findById(id, tenantId);

    // Check if permission set is valid for current context
    if (!permissionSet.isValidNow) {
      return [];
    }

    // Check time restrictions
    if (!permissionSet.isWithinAllowedHours()) {
      return [];
    }

    // Check IP restrictions
    if (context?.ipAddress && !permissionSet.isIpAllowed(context.ipAddress)) {
      return [];
    }

    // Get direct permissions
    const permissions = new Set<string>();
    permissionSet.getPermissionKeys().forEach(key => permissions.add(key));

    // Add inherited permissions
    if (permissionSet.inheritedPermissions) {
      permissionSet.inheritedPermissions.forEach(key => permissions.add(key));
    }

    // Apply overrides
    if (permissionSet.overriddenPermissions) {
      Object.entries(permissionSet.overriddenPermissions).forEach(
        ([key, action]) => {
          if (action === 'grant') {
            permissions.add(key);
          } else if (action === 'deny') {
            permissions.delete(key);
          }
        },
      );
    }

    return Array.from(permissions);
  }

  // Check if permission set has specific permission
  async hasPermission(
    id: string,
    permissionKey: string,
    tenantId: string,
    context?: any,
  ): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissions(
      id,
      tenantId,
      context,
    );
    return effectivePermissions.includes(permissionKey);
  }

  // Get permission set statistics
  async getPermissionSetStats(tenantId: string): Promise<any> {
    const permissionSets = await this.findAll(tenantId, true);

    const stats = {
      total: permissionSets.length,
      active: permissionSets.filter(
        ps => ps.status === PermissionSetStatus.ACTIVE,
      ).length,
      inactive: permissionSets.filter(
        ps => ps.status === PermissionSetStatus.INACTIVE,
      ).length,
      draft: permissionSets.filter(
        ps => ps.status === PermissionSetStatus.DRAFT,
      ).length,
      archived: permissionSets.filter(
        ps => ps.status === PermissionSetStatus.ARCHIVED,
      ).length,
      byType: {
        system: permissionSets.filter(
          ps => ps.type === PermissionSetType.SYSTEM,
        ).length,
        template: permissionSets.filter(
          ps => ps.type === PermissionSetType.TEMPLATE,
        ).length,
        custom: permissionSets.filter(
          ps => ps.type === PermissionSetType.CUSTOM,
        ).length,
        department: permissionSets.filter(
          ps => ps.type === PermissionSetType.DEPARTMENT,
        ).length,
        function: permissionSets.filter(
          ps => ps.type === PermissionSetType.FUNCTION,
        ).length,
        project: permissionSets.filter(
          ps => ps.type === PermissionSetType.PROJECT,
        ).length,
      },
      byScope: {
        global: permissionSets.filter(
          ps => ps.scope === PermissionSetScope.GLOBAL,
        ).length,
        tenant: permissionSets.filter(
          ps => ps.scope === PermissionSetScope.TENANT,
        ).length,
        department: permissionSets.filter(
          ps => ps.scope === PermissionSetScope.DEPARTMENT,
        ).length,
        team: permissionSets.filter(ps => ps.scope === PermissionSetScope.TEAM)
          .length,
        user: permissionSets.filter(ps => ps.scope === PermissionSetScope.USER)
          .length,
      },
      templates: permissionSets.filter(ps => ps.isTemplate).length,
      totalUsage: permissionSets.reduce((sum, ps) => sum + ps.usageCount, 0),
      averagePermissions:
        permissionSets.reduce((sum, ps) => sum + ps.permissionCount, 0) /
        permissionSets.length,
    };

    return stats;
  }

  // Get popular permission sets
  async getPopularPermissionSets(
    tenantId: string,
    limit = 10,
  ): Promise<PermissionSet[]> {
    return this.permissionSetRepository.find({
      where: {
        tenantId,
        isDeleted: false,
        status: PermissionSetStatus.ACTIVE,
      },
      relations: ['permissions'],
      order: {
        usageCount: 'DESC',
        priority: 'DESC',
      },
      take: limit,
    });
  }

  // Get recently used permission sets
  async getRecentlyUsedPermissionSets(
    tenantId: string,
    limit = 10,
  ): Promise<PermissionSet[]> {
    return this.permissionSetRepository.find({
      where: {
        tenantId,
        isDeleted: false,
        status: PermissionSetStatus.ACTIVE,
      },
      relations: ['permissions'],
      order: {
        lastUsedAt: 'DESC',
      },
      take: limit,
    });
  }

  // Compare permission sets
  async comparePermissionSets(
    id1: string,
    id2: string,
    tenantId: string,
  ): Promise<{
    common: string[];
    onlyInFirst: string[];
    onlyInSecond: string[];
    firstSet: PermissionSet;
    secondSet: PermissionSet;
  }> {
    const firstSet = await this.findById(id1, tenantId);
    const secondSet = await this.findById(id2, tenantId);

    const firstPermissions = new Set(firstSet.getPermissionKeys());
    const secondPermissions = new Set(secondSet.getPermissionKeys());

    const common = Array.from(firstPermissions).filter(p =>
      secondPermissions.has(p),
    );
    const onlyInFirst = Array.from(firstPermissions).filter(
      p => !secondPermissions.has(p),
    );
    const onlyInSecond = Array.from(secondPermissions).filter(
      p => !firstPermissions.has(p),
    );

    return {
      common,
      onlyInFirst,
      onlyInSecond,
      firstSet,
      secondSet,
    };
  }

  // Bulk operations
  async bulkUpdateStatus(
    permissionSetIds: string[],
    status: PermissionSetStatus,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.permissionSetRepository
      .createQueryBuilder()
      .update(PermissionSet)
      .set({
        status,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where('id IN (:...ids)', { ids: permissionSetIds })
      .andWhere('tenantId = :tenantId', { tenantId })
      .andWhere('isDeleted = false')
      .andWhere('isSystemDefined = false') // Prevent system permission set modifications
      .execute();
  }

  // Private helper methods
  private async recordUsage(id: string): Promise<void> {
    await this.permissionSetRepository
      .createQueryBuilder()
      .update(PermissionSet)
      .set({
        usageCount: () => 'usage_count + 1',
        lastUsedAt: new Date(),
      })
      .where('id = :id', { id })
      .execute();
  }

  // Import/Export functionality
  async exportPermissionSet(id: string, tenantId: string): Promise<any> {
    const permissionSet = await this.findById(id, tenantId);

    return {
      name: permissionSet.name,
      code: permissionSet.code,
      description: permissionSet.description,
      type: permissionSet.type,
      scope: permissionSet.scope,
      category: permissionSet.category,
      subcategory: permissionSet.subcategory,
      permissions: permissionSet.getPermissionKeys(),
      conditions: permissionSet.conditions,
      metadata: permissionSet.metadata,
      version: permissionSet.version,
      exportedAt: new Date().toISOString(),
    };
  }

  async importPermissionSet(
    importData: any,
    tenantId: string,
    userId: string,
  ): Promise<PermissionSet> {
    // Validate import data
    if (!importData.code || !importData.name) {
      throw new BadRequestException(
        'Data import tidak valid: code dan name diperlukan',
      );
    }

    // Check if code exists
    const existingPermissionSet = await this.permissionSetRepository.findOne({
      where: {
        tenantId,
        code: importData.code,
        isDeleted: false,
      },
    });

    if (existingPermissionSet) {
      throw new BadRequestException('Kode permission set sudah ada');
    }

    // Get permissions
    const permissions = await this.permissionRepository.find({
      where:
        importData.permissions?.map((key: string) => {
          const [resource, action] = key.split(':');
          return { resource, action };
        }) || [],
    });

    const permissionSet = this.permissionSetRepository.create({
      ...importData,
      tenantId,
      permissions,
      status: PermissionSetStatus.DRAFT, // Always import as draft
      isSystemDefined: false,
      usageCount: 0,
      lastUsedAt: null,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.permissionSetRepository.save(
      permissionSet,
    ) as unknown as PermissionSet;
  }
}
