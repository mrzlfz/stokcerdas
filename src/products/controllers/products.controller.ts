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

import { ProductsService } from '../services/products.service';
import { BarcodeService } from '../services/barcode.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import {
  BulkCreateProductDto,
  BulkUpdateProductDto,
  BulkDeleteProductDto,
} from '../dto/bulk-product.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import {
  PermissionAction,
  PermissionResource,
} from '../../auth/entities/permission.entity';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly barcodeService: BarcodeService,
  ) {}

  @Post()
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.CREATE,
  })
  @ApiOperation({ summary: 'Buat produk baru' })
  @ApiResponse({ status: 201, description: 'Produk berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 409, description: 'SKU atau barcode sudah ada' })
  async create(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    const product = await this.productsService.create(
      tenantId,
      createProductDto,
      userId,
    );

    return {
      success: true,
      message: 'Produk berhasil dibuat',
      data: product,
    };
  }

  @Get()
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.READ,
  })
  @ApiOperation({
    summary: 'Dapatkan daftar produk dengan filter dan pagination',
  })
  @ApiResponse({ status: 200, description: 'Daftar produk berhasil didapat' })
  async findAll(@Tenant() tenantId: string, @Query() query: ProductQueryDto) {
    const result = await this.productsService.findAll(tenantId, query);

    return {
      success: true,
      message: 'Daftar produk berhasil didapat',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('stats')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Dapatkan statistik produk' })
  @ApiResponse({
    status: 200,
    description: 'Statistik produk berhasil didapat',
  })
  async getStats(@Tenant() tenantId: string) {
    const stats = await this.productsService.getProductStats(tenantId);

    return {
      success: true,
      message: 'Statistik produk berhasil didapat',
      data: stats,
    };
  }

  @Get('search/sku/:sku')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Cari produk berdasarkan SKU' })
  @ApiParam({ name: 'sku', description: 'SKU produk' })
  @ApiResponse({ status: 200, description: 'Produk ditemukan' })
  @ApiResponse({ status: 404, description: 'Produk tidak ditemukan' })
  async findBySku(@Tenant() tenantId: string, @Param('sku') sku: string) {
    const product = await this.productsService.findBySku(tenantId, sku);

    return {
      success: true,
      message: 'Produk ditemukan',
      data: product,
    };
  }

  @Get('search/barcode/:barcode')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Cari produk berdasarkan barcode' })
  @ApiParam({ name: 'barcode', description: 'Barcode produk' })
  @ApiResponse({ status: 200, description: 'Produk ditemukan' })
  @ApiResponse({ status: 404, description: 'Produk tidak ditemukan' })
  async findByBarcode(
    @Tenant() tenantId: string,
    @Param('barcode') barcode: string,
  ) {
    const result = await this.barcodeService.findProductByBarcode(
      tenantId,
      barcode,
    );

    if (result.type === null) {
      return {
        success: false,
        message: 'Produk dengan barcode tersebut tidak ditemukan',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Produk ditemukan',
      data: {
        type: result.type,
        product: result.product,
        variant: result.variant,
      },
    };
  }

  @Get(':id')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Dapatkan detail produk' })
  @ApiParam({ name: 'id', description: 'ID produk' })
  @ApiResponse({ status: 200, description: 'Detail produk berhasil didapat' })
  @ApiResponse({ status: 404, description: 'Produk tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const product = await this.productsService.findOne(tenantId, id);

    return {
      success: true,
      message: 'Detail produk berhasil didapat',
      data: product,
    };
  }

  @Patch(':id')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Update produk' })
  @ApiParam({ name: 'id', description: 'ID produk' })
  @ApiResponse({ status: 200, description: 'Produk berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Produk tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'SKU atau barcode sudah ada' })
  async update(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(
      tenantId,
      id,
      updateProductDto,
      userId,
    );

    return {
      success: true,
      message: 'Produk berhasil diupdate',
      data: product,
    };
  }

  @Delete(':id')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.DELETE,
  })
  @ApiOperation({ summary: 'Hapus produk (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID produk' })
  @ApiQuery({
    name: 'hard',
    required: false,
    description: 'Hard delete (permanent)',
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: 'Produk berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Produk tidak ditemukan' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hardDelete?: boolean,
  ) {
    await this.productsService.remove(tenantId, id, hardDelete, userId);

    return {
      success: true,
      message: hardDelete
        ? 'Produk berhasil dihapus permanent'
        : 'Produk berhasil dihapus',
    };
  }

  // Bulk Operations
  @Post('bulk/create')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.CREATE,
  })
  @ApiOperation({ summary: 'Buat banyak produk sekaligus' })
  @ApiResponse({ status: 201, description: 'Bulk create berhasil' })
  async bulkCreate(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkCreateDto: BulkCreateProductDto,
  ) {
    const result = await this.productsService.bulkCreate(
      tenantId,
      bulkCreateDto,
      userId,
    );

    return {
      success: true,
      message: `Bulk create selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  @Patch('bulk/update')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Update banyak produk sekaligus' })
  @ApiResponse({ status: 200, description: 'Bulk update berhasil' })
  async bulkUpdate(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkUpdateDto: BulkUpdateProductDto,
  ) {
    const result = await this.productsService.bulkUpdate(
      tenantId,
      bulkUpdateDto,
      userId,
    );

    return {
      success: true,
      message: `Bulk update selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  @Delete('bulk/delete')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.DELETE,
  })
  @ApiOperation({ summary: 'Hapus banyak produk sekaligus' })
  @ApiResponse({ status: 200, description: 'Bulk delete berhasil' })
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() bulkDeleteDto: BulkDeleteProductDto,
  ) {
    const result = await this.productsService.bulkDelete(
      tenantId,
      bulkDeleteDto,
      userId,
    );

    return {
      success: true,
      message: `Bulk delete selesai. ${result.successful} berhasil, ${result.failed} gagal`,
      data: result,
    };
  }

  // Barcode Operations
  @Post(':id/barcode/generate')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({ summary: 'Generate barcode untuk produk' })
  @ApiParam({ name: 'id', description: 'ID produk' })
  @ApiResponse({ status: 200, description: 'Barcode berhasil digenerate' })
  async generateBarcode(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const barcode = await this.barcodeService.generateProductBarcode(
      tenantId,
      id,
    );

    return {
      success: true,
      message: 'Barcode berhasil digenerate',
      data: { barcode },
    };
  }

  @Post('barcode/validate')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.READ,
  })
  @ApiOperation({ summary: 'Validasi format barcode' })
  @ApiResponse({ status: 200, description: 'Validasi barcode selesai' })
  async validateBarcode(@Body('barcode') barcode: string) {
    const validation = this.barcodeService.validateBarcodeFormat(barcode);

    return {
      success: true,
      message: 'Validasi barcode selesai',
      data: validation,
    };
  }

  @Post('barcode/bulk-generate')
  @Permissions({
    resource: PermissionResource.PRODUCTS,
    action: PermissionAction.UPDATE,
  })
  @ApiOperation({
    summary: 'Generate barcode untuk semua produk yang belum punya',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maksimal produk yang diproses',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Bulk generate barcode selesai' })
  async bulkGenerateBarcode(
    @Tenant() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const result = await this.barcodeService.generateBulkBarcodes(
      tenantId,
      limit,
    );

    return {
      success: true,
      message: `Bulk generate selesai. ${
        result.productsUpdated + result.variantsUpdated
      } berhasil`,
      data: result,
    };
  }
}
