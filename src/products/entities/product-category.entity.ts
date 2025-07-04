import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Tree,
  TreeParent,
  TreeChildren,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import type { Product } from './product.entity';

@Entity('product_categories')
@Tree('closure-table')
@Index(['tenantId', 'name'])
@Index(['tenantId', 'parentId'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'sortOrder'])
export class ProductCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image?: string;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Tree relationships for nested categories
  @TreeParent()
  @ManyToOne(() => ProductCategory, category => category.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent?: ProductCategory;

  @TreeChildren()
  @OneToMany(() => ProductCategory, category => category.parent)
  children?: ProductCategory[];

  // Products in this category
  @OneToMany('Product', 'category')
  products?: Product[];

  // Virtual fields for convenience
  get isTopLevel(): boolean {
    return !this.parentId;
  }

  get hasChildren(): boolean {
    return (this.children?.length || 0) > 0;
  }

  get hasProducts(): boolean {
    return (this.products?.length || 0) > 0;
  }

  // Get category path (breadcrumb)
  getCategoryPath(separator: string = ' > '): string {
    if (!this.parent) {
      return this.name;
    }
    return `${this.parent.getCategoryPath(separator)}${separator}${this.name}`;
  }

  // Get all descendant categories (recursive)
  getDescendantIds(): string[] {
    const ids: string[] = [this.id];

    if (this.children) {
      this.children.forEach(child => {
        ids.push(...child.getDescendantIds());
      });
    }

    return ids;
  }

  // Check if category can be deleted
  canBeDeleted(): boolean {
    return !this.hasChildren && !this.hasProducts;
  }

  // Get display name with parent context
  getDisplayName(): string {
    if (this.parent) {
      return `${this.parent.name} > ${this.name}`;
    }
    return this.name;
  }

  // Sort categories by sortOrder and name
  static compare(a: ProductCategory, b: ProductCategory): number {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name, 'id-ID'); // Indonesian locale
  }
}

// DTO interfaces for API responses
export interface ProductCategoryTreeNode {
  id: string;
  name: string;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string;
  children?: ProductCategoryTreeNode[];
  productCount?: number;
  level: number;
}

export interface ProductCategoryBreadcrumb {
  id: string;
  name: string;
  level: number;
}
