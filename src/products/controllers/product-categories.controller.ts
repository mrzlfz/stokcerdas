import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { ProductCategoriesService } from '../services/product-categories.service';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';
import { UpdateProductCategoryDto } from '../dto/update-product-category.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { PermissionAction, PermissionResource } from '../../auth/entities/permission.entity';

@ApiTags('Product Categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products/categories')
export class ProductCategoriesController {
  constructor(
    private readonly categoriesService: ProductCategoriesService,
  ) {}

  @Post()
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Buat kategori produk baru' })
  @ApiResponse({ status: 201, description: 'Kategori berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 409, description: 'Nama kategori sudah ada' })
  async create(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createCategoryDto: CreateProductCategoryDto,
  ) {
    const category = await this.categoriesService.create(tenantId, createCategoryDto, userId);
    
    return {
      success: true,
      message: 'Kategori berhasil dibuat',
      data: category,
    };
  }

  @Get()
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan daftar kategori produk' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Sertakan kategori tidak aktif', type: Boolean })
  @ApiResponse({ status: 200, description: 'Daftar kategori berhasil didapat' })
  async findAll(
    @Tenant() tenantId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const categories = await this.categoriesService.findAll(tenantId, includeInactive);
    
    return {
      success: true,
      message: 'Daftar kategori berhasil didapat',
      data: categories,
    };
  }

  @Get('tree')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan struktur tree kategori produk' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Sertakan kategori tidak aktif', type: Boolean })
  @ApiResponse({ status: 200, description: 'Tree kategori berhasil didapat' })
  async findTree(
    @Tenant() tenantId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const tree = await this.categoriesService.findTree(tenantId, includeInactive);
    
    return {
      success: true,
      message: 'Tree kategori berhasil didapat',
      data: tree,
    };
  }

  @Get('with-count')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan kategori dengan jumlah produk' })
  @ApiResponse({ status: 200, description: 'Kategori dengan jumlah produk berhasil didapat' })
  async findWithProductCount(@Tenant() tenantId: string) {
    const categories = await this.categoriesService.getCategoryWithProductCount(tenantId);
    
    return {
      success: true,
      message: 'Kategori dengan jumlah produk berhasil didapat',
      data: categories,
    };
  }

  @Get('search')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Cari kategori berdasarkan nama' })
  @ApiQuery({ name: 'name', required: true, description: 'Nama kategori yang dicari' })
  @ApiResponse({ status: 200, description: 'Hasil pencarian kategori' })
  async search(
    @Tenant() tenantId: string,
    @Query('name') name: string,
  ) {
    const categories = await this.categoriesService.findByName(tenantId, name);
    
    return {
      success: true,
      message: 'Hasil pencarian kategori',
      data: categories,
    };
  }

  @Get(':id')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan detail kategori produk' })
  @ApiParam({ name: 'id', description: 'ID kategori' })
  @ApiResponse({ status: 200, description: 'Detail kategori berhasil didapat' })
  @ApiResponse({ status: 404, description: 'Kategori tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const category = await this.categoriesService.findOne(tenantId, id);
    
    return {
      success: true,
      message: 'Detail kategori berhasil didapat',
      data: category,
    };
  }

  @Patch(':id')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update kategori produk' })
  @ApiParam({ name: 'id', description: 'ID kategori' })
  @ApiResponse({ status: 200, description: 'Kategori berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Kategori tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Nama kategori sudah ada' })
  async update(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateProductCategoryDto,
  ) {
    const category = await this.categoriesService.update(tenantId, id, updateCategoryDto, userId);
    
    return {
      success: true,
      message: 'Kategori berhasil diupdate',
      data: category,
    };
  }

  @Delete(':id')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.DELETE })
  @ApiOperation({ summary: 'Hapus kategori produk' })
  @ApiParam({ name: 'id', description: 'ID kategori' })
  @ApiResponse({ status: 200, description: 'Kategori berhasil dihapus' })
  @ApiResponse({ status: 400, description: 'Kategori masih memiliki produk atau sub-kategori' })
  @ApiResponse({ status: 404, description: 'Kategori tidak ditemukan' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.categoriesService.remove(tenantId, id);
    
    return {
      success: true,
      message: 'Kategori berhasil dihapus',
    };
  }

  @Patch('reorder')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Ubah urutan kategori' })
  @ApiResponse({ status: 200, description: 'Urutan kategori berhasil diubah' })
  async reorder(
    @Tenant() tenantId: string,
    @Body('categories') categories: Array<{ id: string; sortOrder: number }>,
  ) {
    await this.categoriesService.reorderCategories(tenantId, categories);
    
    return {
      success: true,
      message: 'Urutan kategori berhasil diubah',
    };
  }
}