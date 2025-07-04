import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, TreeRepository, Not } from 'typeorm';

import { ProductCategory } from '../entities/product-category.entity';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';
import { UpdateProductCategoryDto } from '../dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
  ) {}

  async create(
    tenantId: string,
    createCategoryDto: CreateProductCategoryDto,
    userId?: string,
  ): Promise<ProductCategory> {
    // Validasi nama kategori unik per tenant dan parent
    await this.validateNameUnique(
      tenantId,
      createCategoryDto.name,
      createCategoryDto.parentId,
    );

    // Validasi parent category jika ada
    if (createCategoryDto.parentId) {
      await this.validateParentCategory(tenantId, createCategoryDto.parentId);
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.categoryRepository.save(category);
  }

  async findAll(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<ProductCategory[]> {
    const whereCondition: any = { tenantId };

    if (!includeInactive) {
      whereCondition.isActive = true;
    }

    return this.categoryRepository.find({
      where: whereCondition,
      relations: ['parent', 'children', 'products'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findTree(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<ProductCategory[]> {
    const categories = await this.findAll(tenantId, includeInactive);

    // Build tree structure
    const categoryMap = new Map<string, ProductCategory>();
    const rootCategories: ProductCategory[] = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      // Create a proper category instance with all required methods
      const categoryWithChildren = Object.assign(
        new ProductCategory(),
        category,
        { children: [] },
      );
      categoryMap.set(category.id, categoryWithChildren);
    });

    // Second pass: build tree
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id);

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }

  async findOne(tenantId: string, id: string): Promise<ProductCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id, tenantId },
      relations: ['parent', 'children', 'products'],
    });

    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }

    return category;
  }

  async findByName(tenantId: string, name: string): Promise<ProductCategory[]> {
    return this.categoryRepository.find({
      where: {
        tenantId,
        name: Like(`%${name}%`),
        isActive: true,
      },
      relations: ['parent'],
      order: { name: 'ASC' },
    });
  }

  async update(
    tenantId: string,
    id: string,
    updateCategoryDto: UpdateProductCategoryDto,
    userId?: string,
  ): Promise<ProductCategory> {
    const category = await this.findOne(tenantId, id);

    // Validasi nama jika berubah
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const parentId =
        updateCategoryDto.parentId !== undefined
          ? updateCategoryDto.parentId
          : category.parentId;
      await this.validateNameUnique(
        tenantId,
        updateCategoryDto.name,
        parentId,
        id,
      );
    }

    // Validasi parent category jika berubah
    if (
      updateCategoryDto.parentId !== undefined &&
      updateCategoryDto.parentId !== category.parentId
    ) {
      if (updateCategoryDto.parentId) {
        await this.validateParentCategory(tenantId, updateCategoryDto.parentId);
        // Pastikan tidak membuat circular reference
        await this.validateCircularReference(id, updateCategoryDto.parentId);
      }
    }

    // Update timestamps
    updateCategoryDto.updatedBy = userId;

    await this.categoryRepository.update(id, updateCategoryDto);
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const category = await this.findOne(tenantId, id);

    // Check if category has products
    const productCount = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.products', 'product')
      .where('category.id = :id', { id })
      .andWhere('product.isDeleted = :isDeleted', { isDeleted: false })
      .getCount();

    if (productCount > 0) {
      throw new BadRequestException(
        'Tidak dapat menghapus kategori yang masih memiliki produk',
      );
    }

    // Check if category has children
    const childrenCount = await this.categoryRepository.count({
      where: { parentId: id, tenantId },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        'Tidak dapat menghapus kategori yang masih memiliki sub-kategori',
      );
    }

    await this.categoryRepository.delete(id);
  }

  async getCategoryWithProductCount(
    tenantId: string,
  ): Promise<Array<ProductCategory & { productCount: number }>> {
    const result = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin(
        'category.products',
        'product',
        'product.isDeleted = :isDeleted',
        { isDeleted: false },
      )
      .select([
        'category.id',
        'category.name',
        'category.description',
        'category.image',
        'category.parentId',
        'category.sortOrder',
        'category.isActive',
        'COUNT(product.id) as productCount',
      ])
      .where('category.tenantId = :tenantId', { tenantId })
      .groupBy('category.id')
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getRawMany();

    return result.map(item => ({
      id: item.category_id,
      name: item.category_name,
      description: item.category_description,
      image: item.category_image,
      parentId: item.category_parentId,
      sortOrder: item.category_sortOrder,
      isActive: item.category_isActive,
      productCount: parseInt(item.productCount) || 0,
    })) as Array<ProductCategory & { productCount: number }>;
  }

  async reorderCategories(
    tenantId: string,
    categoryOrders: Array<{ id: string; sortOrder: number }>,
  ): Promise<void> {
    const queryRunner =
      this.categoryRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const { id, sortOrder } of categoryOrders) {
        await queryRunner.manager.update(
          ProductCategory,
          { id, tenantId },
          { sortOrder },
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Private helper methods
  private async validateNameUnique(
    tenantId: string,
    name: string,
    parentId?: string,
    excludeId?: string,
  ): Promise<void> {
    const whereCondition: any = { tenantId, name };

    if (parentId) {
      whereCondition.parentId = parentId;
    } else {
      whereCondition.parentId = null;
    }

    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingCategory = await this.categoryRepository.findOne({
      where: whereCondition,
    });

    if (existingCategory) {
      const location = parentId
        ? 'dalam kategori parent yang sama'
        : 'di level root';
      throw new ConflictException(
        `Nama kategori "${name}" sudah ada ${location}`,
      );
    }
  }

  private async validateParentCategory(
    tenantId: string,
    parentId: string,
  ): Promise<void> {
    const parentCategory = await this.categoryRepository.findOne({
      where: { id: parentId, tenantId },
    });

    if (!parentCategory) {
      throw new NotFoundException('Kategori parent tidak ditemukan');
    }

    if (!parentCategory.isActive) {
      throw new BadRequestException('Kategori parent tidak aktif');
    }
  }

  private async validateCircularReference(
    categoryId: string,
    parentId: string,
  ): Promise<void> {
    if (categoryId === parentId) {
      throw new BadRequestException(
        'Kategori tidak dapat menjadi parent dari dirinya sendiri',
      );
    }

    // Check if parentId is a descendant of categoryId
    const isDescendant = await this.isDescendant(categoryId, parentId);
    if (isDescendant) {
      throw new BadRequestException(
        'Circular reference terdeteksi: kategori tidak dapat menjadi parent dari ancestor-nya',
      );
    }
  }

  private async isDescendant(
    ancestorId: string,
    categoryId: string,
  ): Promise<boolean> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      select: ['parentId'],
    });

    if (!category || !category.parentId) {
      return false;
    }

    if (category.parentId === ancestorId) {
      return true;
    }

    return this.isDescendant(ancestorId, category.parentId);
  }
}
