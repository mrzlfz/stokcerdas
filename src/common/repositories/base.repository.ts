import { Repository, SelectQueryBuilder, FindManyOptions, FindOneOptions } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

export class BaseRepository<T extends BaseEntity> extends Repository<T> {
  private tenantId: string;

  setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  // Override find methods to add tenant filter
  find(options?: FindManyOptions<T>): Promise<T[]> {
    return super.find(this.addTenantFilter(options));
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return super.findOne(this.addTenantFilter(options));
  }

  findOneBy(where: any): Promise<T | null> {
    return super.findOneBy(this.addTenantToWhere(where));
  }

  findBy(where: any): Promise<T[]> {
    return super.findBy(this.addTenantToWhere(where));
  }

  count(options?: FindManyOptions<T>): Promise<number> {
    return super.count(this.addTenantFilter(options));
  }

  // Override query builder to add tenant filter
  createQueryBuilder(alias?: string): SelectQueryBuilder<T> {
    const qb = super.createQueryBuilder(alias);
    if (this.tenantId && alias) {
      qb.andWhere(`${alias}.tenant_id = :tenantId`, { tenantId: this.tenantId });
    }
    return qb;
  }

  // Helper method to create a query builder with tenant filter
  createTenantQueryBuilder(alias: string, tenantId: string): SelectQueryBuilder<T> {
    return super.createQueryBuilder(alias)
      .andWhere(`${alias}.tenant_id = :tenantId`, { tenantId });
  }

  // Override save to add tenant ID
  async save<Entity extends T>(entity: Entity): Promise<Entity>;
  async save<Entity extends T>(entities: Entity[]): Promise<Entity[]>;
  async save<Entity extends T>(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      entityOrEntities.forEach(entity => {
        if (!entity.tenantId && this.tenantId) {
          entity.tenantId = this.tenantId;
        }
      });
    } else {
      if (!entityOrEntities.tenantId && this.tenantId) {
        entityOrEntities.tenantId = this.tenantId;
      }
    }
    return super.save(entityOrEntities as any);
  }

  private addTenantFilter(options?: FindManyOptions<T> | FindOneOptions<T>) {
    if (!this.tenantId) {
      return options;
    }

    return {
      ...options,
      where: this.addTenantToWhere(options?.where),
    };
  }

  private addTenantToWhere(where: any) {
    if (!this.tenantId) {
      return where;
    }

    if (Array.isArray(where)) {
      return where.map(w => ({ ...w, tenantId: this.tenantId }));
    } else if (where && typeof where === 'object') {
      return { ...where, tenantId: this.tenantId };
    } else {
      return { tenantId: this.tenantId };
    }
  }
}