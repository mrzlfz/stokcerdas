import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository } from 'typeorm';
import {
  Department,
  DepartmentType,
  DepartmentStatus,
} from '../entities/department.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private departmentRepository: TreeRepository<Department>,
  ) {}

  // Create a new department
  async create(
    createDepartmentDto: any,
    tenantId: string,
    userId: string,
  ): Promise<Department> {
    const { parentId, ...departmentData } = createDepartmentDto;

    // Check if code is unique within tenant
    const existingDepartment = await this.departmentRepository.findOne({
      where: {
        tenantId,
        code: departmentData.code,
        isDeleted: false,
      },
    });

    if (existingDepartment) {
      throw new BadRequestException('Kode departemen sudah ada');
    }

    const department = this.departmentRepository.create({
      ...departmentData,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    }) as unknown as Department;

    // Set parent if provided
    if (parentId) {
      const parent = (await this.findById(
        parentId,
        tenantId,
      )) as unknown as Department;
      department.parent = parent;
      department.level = parent.level + 1;
      department.path = parent.buildPath(parent.path);
    } else {
      department.level = 0;
      department.type = DepartmentType.ROOT;
    }

    const savedDepartment = await this.departmentRepository.save(department);

    // Update path after saving to get the ID
    savedDepartment.updatePath(savedDepartment.parent?.path);
    await this.departmentRepository.save(savedDepartment);

    return savedDepartment;
  }

  // Find department by ID
  async findById(id: string, tenantId: string): Promise<Department> {
    const department = await this.departmentRepository.findOne({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      relations: ['parent', 'children'],
    });

    if (!department) {
      throw new NotFoundException('Departemen tidak ditemukan');
    }

    return department;
  }

  // Find all departments for a tenant
  async findAll(
    tenantId: string,
    includeInactive = false,
  ): Promise<Department[]> {
    const queryBuilder = this.departmentRepository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.parent', 'parent')
      .leftJoinAndSelect('department.children', 'children')
      .where('department.tenantId = :tenantId', { tenantId })
      .andWhere('department.isDeleted = false');

    if (!includeInactive) {
      queryBuilder.andWhere('department.status = :status', {
        status: DepartmentStatus.ACTIVE,
      });
    }

    queryBuilder
      .orderBy('department.level', 'ASC')
      .addOrderBy('department.name', 'ASC');

    return queryBuilder.getMany();
  }

  // Get department tree structure
  async getDepartmentTree(tenantId: string): Promise<Department[]> {
    const roots = await this.departmentRepository.findRoots();
    const filteredRoots = roots.filter(
      root => root.tenantId === tenantId && !root.isDeleted,
    );

    const result = [];
    for (const root of filteredRoots) {
      const tree = await this.departmentRepository.findDescendantsTree(root);
      result.push(tree);
    }

    return result;
  }

  // Get department with all ancestors
  async getDepartmentWithAncestors(
    id: string,
    tenantId: string,
  ): Promise<Department> {
    const department = await this.findById(id, tenantId);
    return this.departmentRepository.findAncestorsTree(department);
  }

  // Get department with all descendants
  async getDepartmentWithDescendants(
    id: string,
    tenantId: string,
  ): Promise<Department> {
    const department = await this.findById(id, tenantId);
    return this.departmentRepository.findDescendantsTree(department);
  }

  // Get all child departments (flat list)
  async getChildDepartments(
    id: string,
    tenantId: string,
  ): Promise<Department[]> {
    const department = await this.findById(id, tenantId);
    return this.departmentRepository.findDescendants(department);
  }

  // Get all parent departments (flat list)
  async getParentDepartments(
    id: string,
    tenantId: string,
  ): Promise<Department[]> {
    const department = await this.findById(id, tenantId);
    return this.departmentRepository.findAncestors(department);
  }

  // Update department
  async update(
    id: string,
    updateDepartmentDto: any,
    tenantId: string,
    userId: string,
  ): Promise<Department> {
    const department = await this.findById(id, tenantId);
    const { parentId, ...updateData } = updateDepartmentDto;

    // Check if changing code to existing one
    if (updateData.code && updateData.code !== department.code) {
      const existingDepartment = await this.departmentRepository.findOne({
        where: {
          tenantId,
          code: updateData.code,
          isDeleted: false,
        },
      });

      if (existingDepartment && existingDepartment.id !== id) {
        throw new BadRequestException('Kode departemen sudah ada');
      }
    }

    // Update parent if changed
    if (parentId !== undefined) {
      if (parentId === null) {
        // Moving to root level
        department.parent = null;
        department.level = 0;
        department.type = DepartmentType.ROOT;
      } else {
        // Moving to new parent
        const newParent = await this.findById(parentId, tenantId);

        // Prevent circular references
        const descendants = await this.getChildDepartments(id, tenantId);
        if (descendants.some(desc => desc.id === parentId)) {
          throw new BadRequestException(
            'Tidak dapat memindahkan departemen ke anak departemennya sendiri',
          );
        }

        department.parent = newParent;
        department.level = newParent.level + 1;
      }
    }

    // Update other fields
    Object.assign(department, updateData);
    department.updatedBy = userId;

    const savedDepartment = await this.departmentRepository.save(department);

    // Update path and cascade to children
    savedDepartment.updatePath(savedDepartment.parent?.path);
    await this.departmentRepository.save(savedDepartment);

    // Update paths of all descendants
    await this.updateDescendantPaths(savedDepartment);

    return savedDepartment;
  }

  // Soft delete department
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const department = await this.findById(id, tenantId);

    // Check if department has active children
    const children = await this.getChildDepartments(id, tenantId);
    const activeChildren = children.filter(
      child => child.status === DepartmentStatus.ACTIVE && !child.isDeleted,
    );

    if (activeChildren.length > 0) {
      throw new BadRequestException(
        'Tidak dapat menghapus departemen yang memiliki sub-departemen aktif',
      );
    }

    // TODO: Check if department has active users
    // const activeUsers = await this.userService.findByDepartment(id);
    // if (activeUsers.length > 0) {
    //   throw new BadRequestException('Tidak dapat menghapus departemen yang memiliki pengguna aktif');
    // }

    department.softDelete(userId);
    await this.departmentRepository.save(department);
  }

  // Restore soft deleted department
  async restore(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Department> {
    const department = await this.departmentRepository.findOne({
      where: {
        id,
        tenantId,
        isDeleted: true,
      },
    });

    if (!department) {
      throw new NotFoundException('Departemen yang dihapus tidak ditemukan');
    }

    department.restore();
    department.updatedBy = userId;

    return this.departmentRepository.save(department);
  }

  // Change department status
  async changeStatus(
    id: string,
    status: DepartmentStatus,
    tenantId: string,
    userId: string,
  ): Promise<Department> {
    const department = await this.findById(id, tenantId);

    department.status = status;
    department.updatedBy = userId;

    return this.departmentRepository.save(department);
  }

  // Get departments by type
  async findByType(
    type: DepartmentType,
    tenantId: string,
  ): Promise<Department[]> {
    return this.departmentRepository.find({
      where: {
        tenantId,
        type,
        isDeleted: false,
        status: DepartmentStatus.ACTIVE,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  // Get departments by manager
  async findByManager(
    managerId: string,
    tenantId: string,
  ): Promise<Department[]> {
    return this.departmentRepository.find({
      where: {
        tenantId,
        managerId,
        isDeleted: false,
        status: DepartmentStatus.ACTIVE,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  // Search departments
  async search(
    query: string,
    tenantId: string,
    limit = 20,
  ): Promise<Department[]> {
    return this.departmentRepository
      .createQueryBuilder('department')
      .where('department.tenantId = :tenantId', { tenantId })
      .andWhere('department.isDeleted = false')
      .andWhere('department.status = :status', {
        status: DepartmentStatus.ACTIVE,
      })
      .andWhere(
        '(department.name ILIKE :query OR department.code ILIKE :query)',
        {
          query: `%${query}%`,
        },
      )
      .orderBy('department.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Check if user has access to department
  async checkDepartmentAccess(
    userId: string,
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    // TODO: Implement based on user roles and department hierarchy
    // For now, return true for same tenant
    const department = await this.departmentRepository.findOne({
      where: {
        id: departmentId,
        tenantId,
        isDeleted: false,
      },
    });

    return !!department;
  }

  // Get user's accessible departments
  async getUserAccessibleDepartments(
    userId: string,
    tenantId: string,
  ): Promise<Department[]> {
    // TODO: Implement based on user roles and permissions
    // For now, return all departments in tenant
    return this.findAll(tenantId);
  }

  // Check if department is ancestor of another department
  async isAncestor(
    ancestorId: string,
    descendantId: string,
    tenantId: string,
  ): Promise<boolean> {
    const ancestor = await this.findById(ancestorId, tenantId);
    const descendant = await this.findById(descendantId, tenantId);

    const ancestors = await this.departmentRepository.findAncestors(descendant);
    return ancestors.some(dept => dept.id === ancestorId);
  }

  // Check if department is descendant of another department
  async isDescendant(
    descendantId: string,
    ancestorId: string,
    tenantId: string,
  ): Promise<boolean> {
    return this.isAncestor(ancestorId, descendantId, tenantId);
  }

  // Get department statistics
  async getDepartmentStats(tenantId: string): Promise<any> {
    const departments = await this.findAll(tenantId, true);

    const stats = {
      total: departments.length,
      active: departments.filter(d => d.status === DepartmentStatus.ACTIVE)
        .length,
      inactive: departments.filter(d => d.status === DepartmentStatus.INACTIVE)
        .length,
      archived: departments.filter(d => d.status === DepartmentStatus.ARCHIVED)
        .length,
      byType: {
        root: departments.filter(d => d.type === DepartmentType.ROOT).length,
        division: departments.filter(d => d.type === DepartmentType.DIVISION)
          .length,
        department: departments.filter(
          d => d.type === DepartmentType.DEPARTMENT,
        ).length,
        team: departments.filter(d => d.type === DepartmentType.TEAM).length,
        group: departments.filter(d => d.type === DepartmentType.GROUP).length,
      },
      byLevel: departments.reduce((acc, dept) => {
        acc[dept.level] = (acc[dept.level] || 0) + 1;
        return acc;
      }, {} as Record<number, number>),
    };

    return stats;
  }

  // Move department to new parent
  async moveDepartment(
    departmentId: string,
    newParentId: string | null,
    tenantId: string,
    userId: string,
  ): Promise<Department> {
    return this.update(
      departmentId,
      { parentId: newParentId },
      tenantId,
      userId,
    );
  }

  // Bulk operations
  async bulkUpdateStatus(
    departmentIds: string[],
    status: DepartmentStatus,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.departmentRepository
      .createQueryBuilder()
      .update(Department)
      .set({
        status,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where('id IN (:...ids)', { ids: departmentIds })
      .andWhere('tenantId = :tenantId', { tenantId })
      .andWhere('isDeleted = false')
      .execute();
  }

  // Private helper methods
  private async updateDescendantPaths(department: Department): Promise<void> {
    const descendants = await this.departmentRepository.findDescendants(
      department,
    );

    for (const descendant of descendants) {
      if (descendant.id !== department.id) {
        // Find the path from root to this descendant
        const ancestors = await this.departmentRepository.findAncestors(
          descendant,
        );
        const sortedAncestors = ancestors
          .filter(a => a.id !== descendant.id)
          .sort((a, b) => a.level - b.level);

        const pathComponents = sortedAncestors.map(a => a.code);
        pathComponents.push(descendant.code);

        descendant.path = pathComponents.join('/');
        await this.departmentRepository.save(descendant);
      }
    }
  }

  // Department isolation helper methods
  async filterByDepartmentAccess<T extends { departmentId?: string }>(
    entities: T[],
    userId: string,
    tenantId: string,
  ): Promise<T[]> {
    const accessibleDepartments = await this.getUserAccessibleDepartments(
      userId,
      tenantId,
    );
    const accessibleDepartmentIds = new Set(
      accessibleDepartments.map(d => d.id),
    );

    return entities.filter(
      entity =>
        !entity.departmentId ||
        accessibleDepartmentIds.has(entity.departmentId),
    );
  }

  async enforceDepartmentAccess(
    departmentId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const hasAccess = await this.checkDepartmentAccess(
      userId,
      departmentId,
      tenantId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('Akses ke departemen ini tidak diizinkan');
    }
  }
}
