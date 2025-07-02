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

import { ProductVariantsService } from '../services/product-variants.service';
import { BarcodeService } from '../services/barcode.service';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { PermissionAction, PermissionResource } from '../../auth/entities/permission.entity';

@ApiTags('Product Variants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products/variants')
export class ProductVariantsController {
  constructor(
    private readonly variantsService: ProductVariantsService,
    private readonly barcodeService: BarcodeService,
  ) {}

  @Post()
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.CREATE })
  @ApiOperation({ summary: 'Buat variant produk baru' })
  @ApiResponse({ status: 201, description: 'Variant berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 409, description: 'SKU atau kombinasi atribut sudah ada' })
  async create(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Body() createVariantDto: CreateProductVariantDto,
  ) {
    const variant = await this.variantsService.create(tenantId, createVariantDto, userId);
    
    return {
      success: true,
      message: 'Variant berhasil dibuat',
      data: variant,
    };
  }

  @Get()
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan daftar variant produk' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter berdasarkan ID produk' })
  @ApiResponse({ status: 200, description: 'Daftar variant berhasil didapat' })
  async findAll(
    @Tenant() tenantId: string,
    @Query('productId') productId?: string,
  ) {
    const variants = await this.variantsService.findAll(tenantId, productId);
    
    return {
      success: true,
      message: 'Daftar variant berhasil didapat',
      data: variants,
    };
  }

  @Get('search/sku/:sku')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Cari variant berdasarkan SKU' })
  @ApiParam({ name: 'sku', description: 'SKU variant' })
  @ApiResponse({ status: 200, description: 'Variant ditemukan' })
  @ApiResponse({ status: 404, description: 'Variant tidak ditemukan' })
  async findBySku(
    @Tenant() tenantId: string,
    @Param('sku') sku: string,
  ) {
    const variant = await this.variantsService.findBySku(tenantId, sku);
    
    return {
      success: true,
      message: 'Variant ditemukan',
      data: variant,
    };
  }

  @Get('search/barcode/:barcode')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Cari variant berdasarkan barcode' })
  @ApiParam({ name: 'barcode', description: 'Barcode variant' })
  @ApiResponse({ status: 200, description: 'Variant ditemukan' })
  @ApiResponse({ status: 404, description: 'Variant tidak ditemukan' })
  async findByBarcode(
    @Tenant() tenantId: string,
    @Param('barcode') barcode: string,
  ) {
    const variant = await this.variantsService.findByBarcode(tenantId, barcode);
    
    return {
      success: true,
      message: 'Variant ditemukan',
      data: variant,
    };
  }

  @Get('product/:productId')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan semua variant untuk produk tertentu' })
  @ApiParam({ name: 'productId', description: 'ID produk' })
  @ApiResponse({ status: 200, description: 'Daftar variant produk berhasil didapat' })
  async getVariantsByProduct(
    @Tenant() tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const variants = await this.variantsService.getVariantsByProduct(tenantId, productId);
    
    return {
      success: true,
      message: 'Daftar variant produk berhasil didapat',
      data: variants,
    };
  }

  @Get('product/:productId/matrix')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan matriks variant untuk produk' })
  @ApiParam({ name: 'productId', description: 'ID produk' })
  @ApiResponse({ status: 200, description: 'Matriks variant berhasil didapat' })
  async getVariantMatrix(
    @Tenant() tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const matrix = await this.variantsService.getVariantMatrix(tenantId, productId);
    
    return {
      success: true,
      message: 'Matriks variant berhasil didapat',
      data: matrix,
    };
  }

  @Get(':id')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.READ })
  @ApiOperation({ summary: 'Dapatkan detail variant produk' })
  @ApiParam({ name: 'id', description: 'ID variant' })
  @ApiResponse({ status: 200, description: 'Detail variant berhasil didapat' })
  @ApiResponse({ status: 404, description: 'Variant tidak ditemukan' })
  async findOne(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const variant = await this.variantsService.findOne(tenantId, id);
    
    return {
      success: true,
      message: 'Detail variant berhasil didapat',
      data: variant,
    };
  }

  @Patch(':id')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update variant produk' })
  @ApiParam({ name: 'id', description: 'ID variant' })
  @ApiResponse({ status: 200, description: 'Variant berhasil diupdate' })
  @ApiResponse({ status: 404, description: 'Variant tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'SKU atau kombinasi atribut sudah ada' })
  async update(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVariantDto: UpdateProductVariantDto,
  ) {
    const variant = await this.variantsService.update(tenantId, id, updateVariantDto, userId);
    
    return {
      success: true,
      message: 'Variant berhasil diupdate',
      data: variant,
    };
  }

  @Delete(':id')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.DELETE })
  @ApiOperation({ summary: 'Hapus variant produk (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID variant' })
  @ApiResponse({ status: 200, description: 'Variant berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Variant tidak ditemukan' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.variantsService.remove(tenantId, id);
    
    return {
      success: true,
      message: 'Variant berhasil dihapus',
    };
  }

  // Bulk Operations
  @Patch('product/:productId/bulk-update-prices')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Update harga semua variant untuk produk tertentu' })
  @ApiParam({ name: 'productId', description: 'ID produk' })
  @ApiResponse({ status: 200, description: 'Bulk update harga berhasil' })
  async bulkUpdatePrices(
    @Tenant() tenantId: string,
    @GetUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() priceUpdate: {
      costPrice?: number;
      sellingPrice?: number;
      adjustment?: number;
      adjustmentType?: 'amount' | 'percentage';
    },
  ) {
    const result = await this.variantsService.bulkUpdatePrices(tenantId, productId, priceUpdate, userId);
    
    return {
      success: true,
      message: `Bulk update selesai. ${result.updated} variant berhasil diupdate`,
      data: result,
    };
  }

  // Barcode Operations
  @Post(':id/barcode/generate')
  @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE })
  @ApiOperation({ summary: 'Generate barcode untuk variant' })
  @ApiParam({ name: 'id', description: 'ID variant' })
  @ApiResponse({ status: 200, description: 'Barcode berhasil digenerate' })
  async generateBarcode(
    @Tenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const barcode = await this.barcodeService.generateVariantBarcode(tenantId, id);
    
    return {
      success: true,
      message: 'Barcode berhasil digenerate',
      data: { barcode },
    };
  }
}