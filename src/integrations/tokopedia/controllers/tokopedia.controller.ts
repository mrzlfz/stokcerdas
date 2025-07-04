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
  TokopediaAuthService,
  TokopediaAuthConfig,
} from '../services/tokopedia-auth.service';
import {
  TokopediaProductService,
  ProductSyncOptions,
} from '../services/tokopedia-product.service';
import {
  TokopediaOrderService,
  OrderSyncOptions,
  ShipmentRequest,
} from '../services/tokopedia-order.service';
import {
  TokopediaInventoryService,
  InventorySyncOptions,
  StockUpdateRequest,
  PriceUpdateRequest,
} from '../services/tokopedia-inventory.service';

// DTOs for API validation
export class TokopediaAuthConfigDto {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fsId?: string;
  shopId?: string;
  sandbox?: boolean;
  tiktokShopEnabled?: boolean;
  tiktokAppKey?: string;
  tiktokAppSecret?: string;
}

export class ProductSyncOptionsDto {
  offset?: number;
  limit?: number;
  filter?: 'all' | 'active' | 'inactive' | 'banned';
  search?: string;
  categoryId?: number;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sku?: string;
}

export class OrderSyncOptionsDto {
  offset?: number;
  limit?: number;
  status?: 'all' | 'new' | 'processed' | 'shipped' | 'delivered' | 'cancelled';
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
  productSkus?: string[];
  offset?: number;
  limit?: number;
}

export class StockUpdateDto {
  product_id: number;
  sku: string;
  stock: number;
  variant_id?: number;
}

export class PriceUpdateDto {
  product_id: number;
  sku: string;
  price: number;
  variant_id?: number;
  special_price?: number;
  special_price_start?: Date;
  special_price_end?: Date;
}

export class ShipmentRequestDto {
  order_item_ids: number[];
  shipping_service: string;
  tracking_number?: string;
  shipping_date?: Date;
  notes?: string;
}

export class OrderCancellationDto {
  order_item_ids: number[];
  cancel_reason: string;
}

@ApiTags('Tokopedia Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('integrations/tokopedia')
export class TokopediaController {
  private readonly logger = new Logger(TokopediaController.name);

  constructor(
    private readonly authService: TokopediaAuthService,
    private readonly productService: TokopediaProductService,
    private readonly orderService: TokopediaOrderService,
    private readonly inventoryService: TokopediaInventoryService,
  ) {}

  // Authentication endpoints

  @Get('auth/url/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get Tokopedia authorization URL' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
  })
  async getAuthorizationUrl(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() config: TokopediaAuthConfigDto,
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
        config: { $ref: '#/components/schemas/TokopediaAuthConfigDto' },
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
    @Body() body: { code: string; config: TokopediaAuthConfigDto },
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
          accessToken: tokenInfo.access_token,
          expiresIn: tokenInfo.expires_in,
          tokenType: tokenInfo.token_type,
          scope: tokenInfo.scope,
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
          accessToken: tokenInfo.access_token,
          expiresIn: tokenInfo.expires_in,
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

  @Post('auth/tiktok-migrate/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Migrate to TikTok Shop authentication' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tiktokAuthCode: { type: 'string' },
        config: { $ref: '#/components/schemas/TokopediaAuthConfigDto' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'TikTok Shop migration completed successfully',
  })
  async migrateTikTokShop(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() body: { tiktokAuthCode: string; config: TokopediaAuthConfigDto },
  ) {
    try {
      const result = await this.authService.migrateTikTokShopAuth(
        user.tenantId,
        channelId,
        body.tiktokAuthCode,
        body.config,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `TikTok Shop migration failed: ${error.message}`,
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

  // Product endpoints

  @Post('products/sync/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Sync products from Tokopedia' })
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
        syncOptions.categoryId = options.categoryId;
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

      const result = await this.productService.syncProductsFromTokopedia(
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
  @ApiOperation({ summary: 'Sync single product to Tokopedia' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 201, description: 'Product synced successfully' })
  async syncSingleProduct(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('productId') productId: string,
  ) {
    try {
      const result = await this.productService.syncProductToTokopedia(
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

  @Get('products/:channelId/:productId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Tokopedia product details' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'productId', description: 'Tokopedia Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved successfully',
  })
  async getProductDetails(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('productId') productId: string,
  ) {
    try {
      const result = await this.productService.getTokopediaProductDetails(
        user.tenantId,
        channelId,
        parseInt(productId),
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
  @ApiOperation({ summary: 'Sync orders from Tokopedia' })
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

      const result = await this.orderService.syncOrdersFromTokopedia(
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

  @Get('orders/:channelId/:orderId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Tokopedia order details' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'orderId', description: 'Tokopedia Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
  })
  async getOrderDetails(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Param('orderId') orderId: string,
  ) {
    try {
      const result = await this.orderService.getTokopediaOrderDetails(
        user.tenantId,
        channelId,
        parseInt(orderId),
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
  @ApiOperation({ summary: 'Ship Tokopedia order items' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Order shipped successfully' })
  async shipOrder(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() shipmentData: ShipmentRequestDto,
  ) {
    try {
      const result = await this.orderService.shipTokopediaOrder(
        user.tenantId,
        channelId,
        shipmentData,
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
  @ApiOperation({ summary: 'Cancel Tokopedia order items' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Order cancelled successfully' })
  async cancelOrder(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() cancellationData: OrderCancellationDto,
  ) {
    try {
      const result = await this.orderService.cancelTokopediaOrder(
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
  @ApiOperation({ summary: 'Sync inventory from Tokopedia' })
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

      const result = await this.inventoryService.syncInventoryFromTokopedia(
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
  @ApiOperation({ summary: 'Update stock in Tokopedia' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  async updateStock(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() updates: StockUpdateDto[],
  ) {
    try {
      const result = await this.inventoryService.updateTokopediaInventory(
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
  @ApiOperation({ summary: 'Update prices in Tokopedia' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Prices updated successfully' })
  async updatePrices(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Body() updates: PriceUpdateDto[],
  ) {
    try {
      const result = await this.inventoryService.updateTokopediaPrices(
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
  @ApiOperation({ summary: 'Get stock levels from Tokopedia' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiQuery({ name: 'skus', description: 'Comma-separated product SKUs' })
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
      const productSkus = skus.split(',').map(sku => sku.trim());

      const result = await this.inventoryService.getTokopediaStock(
        user.tenantId,
        channelId,
        productSkus,
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

  @Get('inventory/prices/:channelId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get price information from Tokopedia' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiQuery({ name: 'skus', description: 'Comma-separated product SKUs' })
  @ApiResponse({
    status: 200,
    description: 'Price information retrieved successfully',
  })
  async getPrices(
    @CurrentUser() user: any,
    @Param('channelId') channelId: string,
    @Query('skus') skus: string,
  ) {
    try {
      const productSkus = skus.split(',').map(sku => sku.trim());

      const result = await this.inventoryService.getTokopediaPrices(
        user.tenantId,
        channelId,
        productSkus,
      );

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get price information: ${error.message}`,
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
