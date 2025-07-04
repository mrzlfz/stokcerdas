import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

@Injectable()
export abstract class BaseService<T extends BaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  async findAll(tenantId: string, options?: FindManyOptions<T>): Promise<T[]> {
    const where = this.addTenantFilter(tenantId, options?.where);
    return this.repository.find({ ...options, where });
  }

  async findOne(tenantId: string, id: string): Promise<T> {
    const entity = await this.repository.findOne({
      where: this.addTenantFilter(tenantId, { id } as any),
    });

    if (!entity) {
      throw new NotFoundException(`Entity with ID ${id} not found`);
    }

    return entity;
  }

  async findOneBy(tenantId: string, where: any): Promise<T> {
    const entity = await this.repository.findOne({
      where: this.addTenantFilter(tenantId, where),
    });

    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    return entity;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.repository.find({
      where: this.addTenantFilter(tenantId, { id: { $in: ids } } as any),
    });
  }

  async create(
    tenantId: string,
    data: Partial<T>,
    userId?: string,
  ): Promise<T> {
    const entity = this.repository.create({
      ...data,
      tenantId,
      createdBy: userId,
    } as any);

    return this.repository.save(entity) as unknown as Promise<T>;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<T>,
    userId?: string,
  ): Promise<T> {
    const entity = await this.findOne(tenantId, id);

    Object.assign(entity, {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    return this.repository.save(entity) as unknown as Promise<T>;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const entity = await this.findOne(tenantId, id);
    await this.repository.remove(entity);
  }

  async softDelete(
    tenantId: string,
    id: string,
    userId?: string,
  ): Promise<void> {
    const entity = await this.findOne(tenantId, id);

    if ('softDelete' in entity && typeof entity.softDelete === 'function') {
      (entity as any).softDelete(userId);
      await this.repository.save(entity);
    } else {
      throw new BadRequestException('Entity does not support soft delete');
    }
  }

  async count(tenantId: string, where?: any): Promise<number> {
    return this.repository.count({
      where: this.addTenantFilter(tenantId, where),
    });
  }

  async exists(tenantId: string, where: any): Promise<boolean> {
    const count = await this.repository.count({
      where: this.addTenantFilter(tenantId, where),
    });
    return count > 0;
  }

  protected addTenantFilter(tenantId: string, where: any = {}) {
    if (Array.isArray(where)) {
      return where.map(w => ({ ...w, tenantId }));
    }
    return { ...where, tenantId };
  }

  protected createQueryBuilder(alias: string, tenantId: string) {
    return this.repository
      .createQueryBuilder(alias)
      .where(`${alias}.tenant_id = :tenantId`, { tenantId });
  }
}
