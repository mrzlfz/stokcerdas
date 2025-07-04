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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { UserRole } from '../../../users/entities/user.entity';

import { ShopeeAuthService } from '../services/shopee-auth.service';
import { ShopeeProductService } from '../services/shopee-product.service';
import { ShopeeOrderService } from '../services/shopee-order.service';
import { ShopeeInventoryService } from '../services/shopee-inventory.service';

export class ShopeeAuthDto {
  channelId: string;
  partnerId: string;
  partnerKey: string;
  redirectUri: string;
  isSandbox?: boolean;
  state?: string;
}

export class ShopeeTokenExchangeDto {
  channelId: string;
  authCode: string;
  shopId: string;
  partnerId: string;
  partnerKey: string;
  isSandbox?: boolean;
}

export class ShopeeProductSyncDto {
  channelId: string;
  includeVariants?: boolean;
  includeImages?: boolean;
  includeInventory?: boolean;
  batchSize?: number;
}

export class ShopeeOrderSyncDto {
  channelId: string;
  orderStatus?: string[];
  timeFrom?: string;
  timeTo?: string;
  batchSize?: number;
  includeOrderItems?: boolean;
}

export class ShopeeInventorySyncDto {
  channelId: string;
  syncStock?: boolean;
  syncPrices?: boolean;
  batchSize?: number;
  locationId?: string;
}

export class ShopeeStockUpdateDto {
  channelId: string;
  updates: Array<{
    itemId: number;
    modelId?: number;
    stock: number;
    stockType?: number;
  }>;
}

export class ShopeePriceUpdateDto {
  channelId: string;
  updates: Array<{
    itemId: number;
    modelId?: number;
    originalPrice: number;
    currentPrice?: number;
  }>;
}

@ApiTags('Shopee Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('integrations/shopee')
export class ShopeeController {
  private readonly logger = new Logger(ShopeeController.name);

  constructor(
    private readonly authService: ShopeeAuthService,
    private readonly productService: ShopeeProductService,
    private readonly orderService: ShopeeOrderService,
    private readonly inventoryService: ShopeeInventoryService,
  ) {}

  // Authentication endpoints

  @Post('auth/url')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get Shopee authorization URL' })
  @ApiResponse({
    status: 201,
    description: 'Authorization URL generated successfully',
  })
  async getAuthorizationUrl(
    @CurrentUser() user: any,
    @Body() dto: ShopeeAuthDto,
  ) {
    try {
      const result = await this.authService.getAuthorizationUrl(
        user.tenantId,
        dto.channelId,
        {
          partnerId: dto.partnerId,
          partnerKey: dto.partnerKey,
          redirectUri: dto.redirectUri,
          isSandbox: dto.isSandbox,
        },
        dto.state,
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

  @Post('auth/token')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Exchange authorization code for access token' })
  @ApiResponse({ status: 201, description: 'Token exchange successful' })
  async exchangeToken(
    @CurrentUser() user: any,
    @Body() dto: ShopeeTokenExchangeDto,
  ) {
    try {
      const result = await this.authService.exchangeCodeForToken(
        user.tenantId,
        dto.channelId,
        dto.authCode,
        dto.shopId,
        {
          partnerId: dto.partnerId,
          partnerKey: dto.partnerKey,
          redirectUri: '', // Not needed for token exchange
          isSandbox: dto.isSandbox,
        },
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Token exchange failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('auth/refresh')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Refresh Shopee access token' })
  @ApiResponse({ status: 201, description: 'Token refresh successful' })
  async refreshToken(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.refreshAccessToken(
        user.tenantId,
        channelId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('auth/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get authentication status' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Authentication status retrieved' })
  async getAuthStatus(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.getAuthenticationStatus(
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

  @Post('auth/test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Test Shopee authentication' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 201, description: 'Authentication test completed' })
  async testAuthentication(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
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

  @Delete('auth/revoke')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Revoke Shopee authentication' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({
    status: 200,
    description: 'Authentication revoked successfully',
  })
  async revokeAuthentication(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
  ) {
    try {
      await this.authService.revokeAuthentication(user.tenantId, channelId);

      return {
        success: true,
        message: 'Authentication revoked successfully',
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

  // Product sync endpoints

  @Post('products/sync')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Sync products from Shopee' })
  @ApiResponse({ status: 201, description: 'Product sync started' })
  async syncProducts(
    @CurrentUser() user: any,
    @Body() dto: ShopeeProductSyncDto,
  ) {
    try {
      const result = await this.productService.syncProductsFromShopee(
        user.tenantId,
        dto.channelId,
        {
          includeVariants: dto.includeVariants,
          includeImages: dto.includeImages,
          includeInventory: dto.includeInventory,
          batchSize: dto.batchSize,
        },
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

  @Post('products/:productId/sync')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Sync single product to Shopee' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 201, description: 'Product synced successfully' })
  async syncSingleProduct(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.productService.syncProductToShopee(
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

  @Get('products/:itemId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Shopee product details' })
  @ApiParam({ name: 'itemId', description: 'Shopee Item ID' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Product details retrieved' })
  async getProductDetails(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.productService.getShopeeProductDetails(
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

  // Order sync endpoints

  @Post('orders/sync')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Sync orders from Shopee' })
  @ApiResponse({ status: 201, description: 'Order sync started' })
  async syncOrders(@CurrentUser() user: any, @Body() dto: ShopeeOrderSyncDto) {
    try {
      const options: any = {
        orderStatus: dto.orderStatus,
        batchSize: dto.batchSize,
        includeOrderItems: dto.includeOrderItems,
      };

      if (dto.timeFrom) {
        options.timeFrom = new Date(dto.timeFrom);
      }
      if (dto.timeTo) {
        options.timeTo = new Date(dto.timeTo);
      }

      const result = await this.orderService.syncOrdersFromShopee(
        user.tenantId,
        dto.channelId,
        options,
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

  @Get('orders/:orderSn')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Shopee order details' })
  @ApiParam({ name: 'orderSn', description: 'Shopee Order SN' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Order details retrieved' })
  async getOrderDetails(
    @CurrentUser() user: any,
    @Param('orderSn') orderSn: string,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.orderService.getShopeeOrderDetails(
        user.tenantId,
        channelId,
        orderSn,
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

  @Put('orders/:orderSn/ship')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Ship Shopee order' })
  @ApiParam({ name: 'orderSn', description: 'Shopee Order SN' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Order shipped successfully' })
  async shipOrder(
    @CurrentUser() user: any,
    @Param('orderSn') orderSn: string,
    @Query('channelId') channelId: string,
    @Body() params: { packageNumber?: string; [key: string]: any },
  ) {
    try {
      const result = await this.orderService.updateShopeeOrderStatus(
        user.tenantId,
        channelId,
        orderSn,
        'ship',
        params,
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

  @Put('orders/:orderSn/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel Shopee order' })
  @ApiParam({ name: 'orderSn', description: 'Shopee Order SN' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  async cancelOrder(
    @CurrentUser() user: any,
    @Param('orderSn') orderSn: string,
    @Query('channelId') channelId: string,
    @Body() params: { cancelReason?: string; itemList?: any[] },
  ) {
    try {
      const result = await this.orderService.updateShopeeOrderStatus(
        user.tenantId,
        channelId,
        orderSn,
        'cancel',
        params,
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

  // Inventory sync endpoints

  @Post('inventory/sync')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Sync inventory from Shopee' })
  @ApiResponse({ status: 201, description: 'Inventory sync started' })
  async syncInventory(
    @CurrentUser() user: any,
    @Body() dto: ShopeeInventorySyncDto,
  ) {
    try {
      const result = await this.inventoryService.syncInventoryFromShopee(
        user.tenantId,
        dto.channelId,
        {
          syncStock: dto.syncStock,
          syncPrices: dto.syncPrices,
          batchSize: dto.batchSize,
          locationId: dto.locationId,
        },
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

  @Put('inventory/stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update stock in Shopee' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  async updateStock(
    @CurrentUser() user: any,
    @Body() dto: ShopeeStockUpdateDto,
  ) {
    try {
      const result = await this.inventoryService.updateShopeeInventory(
        user.tenantId,
        dto.channelId,
        dto.updates,
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

  @Put('inventory/prices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update prices in Shopee' })
  @ApiResponse({ status: 200, description: 'Prices updated successfully' })
  async updatePrices(
    @CurrentUser() user: any,
    @Body() dto: ShopeePriceUpdateDto,
  ) {
    try {
      const result = await this.inventoryService.updateShopeePrices(
        user.tenantId,
        dto.channelId,
        dto.updates,
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

  @Get('inventory/stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get stock info from Shopee' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiQuery({
    name: 'itemIds',
    required: true,
    description: 'Comma-separated item IDs',
  })
  @ApiResponse({ status: 200, description: 'Stock info retrieved' })
  async getStock(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
    @Query('itemIds') itemIds: string,
  ) {
    try {
      const itemIdArray = itemIds.split(',').map(id => parseInt(id.trim()));

      const result = await this.inventoryService.getShopeeStock(
        user.tenantId,
        channelId,
        itemIdArray,
      );

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get stock info: ${error.message}`,
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
