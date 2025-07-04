import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { UserRole } from '../../../users/entities/user.entity';

import {
  LazadaAuthService,
  LazadaAuthConfig,
} from '../services/lazada-auth.service';
import {
  LazadaProductService,
  ProductSyncOptions,
} from '../services/lazada-product.service';
import {
  LazadaOrderService,
  OrderSyncOptions,
} from '../services/lazada-order.service';
import {
  LazadaInventoryService,
  InventorySyncOptions,
  StockUpdateRequest,
  PriceUpdateRequest,
} from '../services/lazada-inventory.service';

// DTOs for API validation
export class LazadaAuthConfigDto {
  appKey: string;
  appSecret: string;
  region: 'MY' | 'SG' | 'TH' | 'ID' | 'PH' | 'VN';
  redirectUri: string;
  sandbox?: boolean;
}

export class ProductSyncOptionsDto {
  offset?: number;
  limit?: number;
  filter?: 'all' | 'live' | 'inactive' | 'deleted';
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sku?: string;
}

export class OrderSyncOptionsDto {
  offset?: number;
  limit?: number;
  status?: string;
  sortBy?: 'created_at' | 'updated_at';
  sortDirection?: 'ASC' | 'DESC';
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

export class InventorySyncOptionsDto {
  syncStock?: boolean;
  syncPrices?: boolean;
  sellerSkus?: string[];
  offset?: number;
  limit?: number;
}

export class StockUpdateDto {
  seller_sku: string;
  quantity: number;
}

export class PriceUpdateDto {
  seller_sku: string;
  price: number;
  special_price?: number;
  special_from_date?: string;
  special_to_date?: string;
}

export class OrderShipmentDto {
  order_item_ids: number[];
  delivery_type: 'dropship' | 'send_to_warehouse';
  tracking_number?: string;
  shipping_provider?: string;
}

export class OrderCancellationDto {
  order_item_ids: number[];
  cancel_reason: string;
}

@ApiTags('Lazada Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('integrations/lazada')
export class LazadaController {
  private readonly logger = new Logger(LazadaController.name);

  constructor(
    private readonly authService: LazadaAuthService,
    private readonly productService: LazadaProductService,
    private readonly orderService: LazadaOrderService,
    private readonly inventoryService: LazadaInventoryService,
  ) {}

  // Authentication endpoints

  @Get('auth/url/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get Lazada authorization URL' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
  })
  async getAuthorizationUrl(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() config: LazadaAuthConfigDto,
  ) {
    try {
      const result = await this.authService.getAuthorizationUrl(
        user.tenantId,
        channelId,
        config,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get authorization URL: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/token/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Exchange authorization code for access token' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        config: { $ref: '#/components/schemas/LazadaAuthConfigDto' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Access token obtained successfully',
  })
  async exchangeToken(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() body: { code: string; config: LazadaAuthConfigDto },
  ) {
    try {
      const tokenInfo = await this.authService.exchangeCodeForToken(
        user.tenantId,
        channelId,
        body.code,
        body.config,
      );

      return {
        success: true,
        data: {
          accessToken: tokenInfo.accessToken,
          expiresAt: tokenInfo.expiresAt,
          countryUserInfo: tokenInfo.countryUserInfo,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to exchange token: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/refresh/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Access token refreshed successfully',
  })
  async refreshToken(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const tokenInfo = await this.authService.refreshAccessToken(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: {
          accessToken: tokenInfo.accessToken,
          expiresAt: tokenInfo.expiresAt,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh token: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('auth/status/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get authentication status' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Authentication status retrieved successfully',
  })
  async getAuthStatus(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.testAuthentication(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get auth status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('auth/test/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Test authentication with current credentials' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Authentication tested successfully',
  })
  async testAuthentication(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.testAuthentication(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Authentication test failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('auth/revoke/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Revoke authentication' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Authentication revoked successfully',
  })
  async revokeAuthentication(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.revokeAuthentication(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to revoke authentication: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Product endpoints

  @Post('products/sync/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Sync products from Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Product sync initiated successfully',
  })
  async syncProducts(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() options?: ProductSyncOptionsDto,
  ) {
    try {
      const syncOptions: ProductSyncOptions = {};

      if (options) {
        syncOptions.offset = options.offset;
        syncOptions.limit = options.limit;
        syncOptions.filter = options.filter;
        syncOptions.search = options.search;
        syncOptions.sku = options.sku;

        if (options.createdAfter) {
          syncOptions.createdAfter = new Date(options.createdAfter);
        }
        if (options.createdBefore) {
          syncOptions.createdBefore = new Date(options.createdBefore);
        }
        if (options.updatedAfter) {
          syncOptions.updatedAfter = new Date(options.updatedAfter);
        }
        if (options.updatedBefore) {
          syncOptions.updatedBefore = new Date(options.updatedBefore);
        }
      }

      const result = await this.productService.syncProductsFromLazada(
        user.tenantId,
        channelId,
        syncOptions,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Product sync failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('products/sync/:channelId/:productId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Sync single product to Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 201, description: 'Product synced successfully' })
  async syncSingleProduct(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('productId') productId: string,
  ) {
    try {
      const result = await this.productService.syncProductToLazada(
        user.tenantId,
        channelId,
        productId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Single product sync failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('products/:channelId/:itemId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Lazada product details' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'itemId', description: 'Lazada Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved successfully',
  })
  async getProductDetails(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('itemId') itemId: string,
  ) {
    try {
      const result = await this.productService.getLazadaProductDetails(
        user.tenantId,
        channelId,
        parseInt(itemId),
      );

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get product details: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Order endpoints

  @Post('orders/sync/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Sync orders from Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Order sync initiated successfully',
  })
  async syncOrders(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() options?: OrderSyncOptionsDto,
  ) {
    try {
      const syncOptions: OrderSyncOptions = {};

      if (options) {
        syncOptions.offset = options.offset;
        syncOptions.limit = options.limit;
        syncOptions.status = options.status;
        syncOptions.sortBy = options.sortBy;
        syncOptions.sortDirection = options.sortDirection;

        if (options.createdAfter) {
          syncOptions.createdAfter = new Date(options.createdAfter);
        }
        if (options.createdBefore) {
          syncOptions.createdBefore = new Date(options.createdBefore);
        }
        if (options.updatedAfter) {
          syncOptions.updatedAfter = new Date(options.updatedAfter);
        }
        if (options.updatedBefore) {
          syncOptions.updatedBefore = new Date(options.updatedBefore);
        }
      }

      const result = await this.orderService.syncOrdersFromLazada(
        user.tenantId,
        channelId,
        syncOptions,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Order sync failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('orders/:channelId/:orderNumber')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Lazada order details' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'orderNumber', description: 'Lazada Order Number' })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
  })
  async getOrderDetails(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('orderNumber') orderNumber: string,
  ) {
    try {
      const result = await this.orderService.getLazadaOrderDetails(
        user.tenantId,
        channelId,
        orderNumber,
      );

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order details: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('orders/ship/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Ship Lazada order items' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Order shipped successfully' })
  async shipOrder(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() shipmentData: OrderShipmentDto,
  ) {
    try {
      const result = await this.orderService.shipLazadaOrder(
        user.tenantId,
        channelId,
        shipmentData.order_item_ids,
        shipmentData.delivery_type,
        shipmentData.tracking_number,
        shipmentData.shipping_provider,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to ship order: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('orders/cancel/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel Lazada order items' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Order cancelled successfully' })
  async cancelOrder(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() cancellationData: OrderCancellationDto,
  ) {
    try {
      const result = await this.orderService.cancelLazadaOrder(
        user.tenantId,
        channelId,
        cancellationData.order_item_ids,
        cancellationData.cancel_reason,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel order: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Inventory endpoints

  @Post('inventory/sync/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Sync inventory from Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 201,
    description: 'Inventory sync initiated successfully',
  })
  async syncInventory(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() options?: InventorySyncOptionsDto,
  ) {
    try {
      const syncOptions: InventorySyncOptions = options || {};

      const result = await this.inventoryService.syncInventoryFromLazada(
        user.tenantId,
        channelId,
        syncOptions,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Inventory sync failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('inventory/stock/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Update stock in Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  async updateStock(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() updates: StockUpdateDto[],
  ) {
    try {
      const result = await this.inventoryService.updateLazadaInventory(
        user.tenantId,
        channelId,
        updates,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Stock update failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('inventory/prices/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Update prices in Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Prices updated successfully' })
  async updatePrices(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() updates: PriceUpdateDto[],
  ) {
    try {
      const result = await this.inventoryService.updateLazadaPrices(
        user.tenantId,
        channelId,
        updates,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Price update failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('inventory/stock/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get stock levels from Lazada' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiQuery({ name: 'skus', description: 'Comma-separated seller SKUs' })
  @ApiResponse({
    status: 200,
    description: 'Stock levels retrieved successfully',
  })
  async getStock(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Query('skus') skus: string,
  ) {
    try {
      const sellerSkus = skus.split(',').map(sku => sku.trim());

      const result = await this.inventoryService.getLazadaStock(
        user.tenantId,
        channelId,
        sellerSkus,
      );

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get stock levels: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
