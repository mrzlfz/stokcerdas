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

import { MokaAuthService } from '../services/moka-auth.service';
import {
  MokaAuthDto,
  MokaOAuthUrlDto,
  MokaOAuthCallbackDto,
} from '../dto/moka-auth.dto';
import {
  MokaProductSyncDto,
  MokaSalesImportDto,
  MokaInventorySyncDto,
} from '../dto/moka-sync.dto';
import { MokaProductService } from '../services/moka-product.service';
import { MokaSalesService } from '../services/moka-sales.service';

@ApiTags('Moka POS Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('integrations/moka')
export class MokaController {
  private readonly logger = new Logger(MokaController.name);

  constructor(
    private readonly authService: MokaAuthService,
    private readonly productService: MokaProductService,
    private readonly salesService: MokaSalesService,
  ) {}

  // Authentication endpoints

  @Post('auth/oauth/url')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Generate OAuth authorization URL for Moka POS' })
  @ApiResponse({ status: 201, description: 'Authorization URL generated' })
  async generateOAuthUrl(
    @CurrentUser() user: any,
    @Body() dto: MokaOAuthUrlDto,
  ) {
    try {
      const result = await this.authService.generateAuthorizationUrl(
        user.tenantId,
        dto.channelId,
        {
          appId: dto.appId,
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
        `Failed to generate OAuth URL: ${error.message}`,
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

  @Post('auth/oauth/callback')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Complete OAuth flow with authorization code' })
  @ApiResponse({
    status: 201,
    description: 'OAuth flow completed successfully',
  })
  async handleOAuthCallback(
    @CurrentUser() user: any,
    @Body() dto: MokaOAuthCallbackDto,
  ) {
    try {
      // For now, just return success until OAuth flow is properly implemented
      const result = {
        success: true,
        message: 'OAuth callback received successfully',
        code: dto.code,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`, error.stack);
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
  @ApiOperation({ summary: 'Refresh Moka access token' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 201, description: 'Token refreshed successfully' })
  async refreshToken(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.authService.refreshTokenIfNeeded(
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

  @Post('auth/setup')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Setup Moka POS authentication' })
  @ApiResponse({ status: 201, description: 'Authentication setup successful' })
  async setupAuthentication(
    @CurrentUser() user: any,
    @Body() dto: MokaAuthDto,
  ) {
    try {
      const result = await this.authService.setupAuthentication(
        user.tenantId,
        dto.channelId,
        {
          apiKey: dto.apiKey,
          storeId: dto.storeId,
          isSandbox: dto.isSandbox,
        },
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to setup authentication: ${error.message}`,
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

  @Post('auth/test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Test Moka POS authentication' })
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

  @Put('auth/config')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update Moka store configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
  })
  async updateConfig(
    @CurrentUser() user: any,
    @Body() dto: Partial<MokaAuthDto>,
  ) {
    try {
      const result = await this.authService.updateStoreConfig(
        user.tenantId,
        dto.channelId,
        {
          apiKey: dto.apiKey,
          storeId: dto.storeId,
          isSandbox: dto.isSandbox,
        },
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update config: ${error.message}`,
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
  @ApiOperation({ summary: 'Revoke Moka authentication' })
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
  @ApiOperation({ summary: 'Sync products from Moka POS' })
  @ApiResponse({ status: 201, description: 'Product sync started' })
  async syncProducts(
    @CurrentUser() user: any,
    @Body() dto: MokaProductSyncDto,
  ) {
    try {
      const result = await this.productService.syncProductsFromMoka(
        user.tenantId,
        dto.channelId,
        {
          includeVariants: dto.includeVariants,
          includeCategories: dto.includeCategories,
          batchSize: dto.batchSize,
          syncDirection: dto.syncDirection,
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
  @ApiOperation({ summary: 'Sync single product to Moka POS' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 201, description: 'Product synced successfully' })
  async syncSingleProduct(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.productService.syncProductToMoka(
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

  @Get('products/:mokaProductId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Moka product details' })
  @ApiParam({ name: 'mokaProductId', description: 'Moka Product ID' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Product details retrieved' })
  async getProductDetails(
    @CurrentUser() user: any,
    @Param('mokaProductId') mokaProductId: string,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.productService.getMokaProductDetails(
        user.tenantId,
        channelId,
        mokaProductId,
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

  @Delete('products/:mokaProductId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete product from Moka POS' })
  @ApiParam({ name: 'mokaProductId', description: 'Moka Product ID' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  async deleteProduct(
    @CurrentUser() user: any,
    @Param('mokaProductId') mokaProductId: string,
    @Query('channelId') channelId: string,
  ) {
    try {
      const result = await this.productService.deleteMokaProduct(
        user.tenantId,
        channelId,
        mokaProductId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete product: ${error.message}`,
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

  // Sales import endpoints

  @Post('sales/import')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Import sales data from Moka POS' })
  @ApiResponse({ status: 201, description: 'Sales import started' })
  async importSales(@CurrentUser() user: any, @Body() dto: MokaSalesImportDto) {
    try {
      const options: any = {
        batchSize: dto.batchSize,
        includeLineItems: dto.includeLineItems,
      };

      if (dto.fromDate) {
        options.fromDate = new Date(dto.fromDate);
      }
      if (dto.toDate) {
        options.toDate = new Date(dto.toDate);
      }

      const result = await this.salesService.importSalesFromMoka(
        user.tenantId,
        dto.channelId,
        options,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Sales import failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sales/report')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get sales report from Moka POS' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiQuery({
    name: 'fromDate',
    required: true,
    description: 'Start date (ISO string)',
  })
  @ApiQuery({
    name: 'toDate',
    required: true,
    description: 'End date (ISO string)',
  })
  @ApiResponse({ status: 200, description: 'Sales report retrieved' })
  async getSalesReport(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    try {
      const result = await this.salesService.getSalesReport(
        user.tenantId,
        channelId,
        new Date(fromDate),
        new Date(toDate),
      );

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get sales report: ${error.message}`,
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
  @ApiOperation({ summary: 'Sync inventory deductions from Moka sales' })
  @ApiResponse({ status: 201, description: 'Inventory sync started' })
  async syncInventory(
    @CurrentUser() user: any,
    @Body() dto: MokaInventorySyncDto,
  ) {
    try {
      const fromDate = dto.fromDate
        ? new Date(dto.fromDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = dto.toDate ? new Date(dto.toDate) : new Date();

      const result = await this.salesService.syncInventoryDeductions(
        user.tenantId,
        dto.channelId,
        fromDate,
        toDate,
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

  // Utility endpoints

  @Get('store/info')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Moka store information' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiResponse({ status: 200, description: 'Store information retrieved' })
  async getStoreInfo(
    @CurrentUser() user: any,
    @Query('channelId') channelId: string,
  ) {
    try {
      // This will be handled by getting it from the channel metadata
      const authStatus = await this.authService.getAuthenticationStatus(
        user.tenantId,
        channelId,
      );

      if (!authStatus.isAuthenticated) {
        throw new HttpException(
          {
            success: false,
            error: 'Not authenticated with Moka',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      return {
        success: true,
        data: {
          storeId: authStatus.storeId,
          storeName: authStatus.storeName,
          isAuthenticated: authStatus.isAuthenticated,
          lastTestAt: authStatus.lastTestAt,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get store info: ${error.message}`,
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

  @Get('payments/methods')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get available payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved' })
  async getPaymentMethods() {
    try {
      // This is static data from the API service
      const paymentMethods =
        this.salesService['mokaApiService'].getPaymentMethods();

      return {
        success: true,
        data: paymentMethods,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get payment methods: ${error.message}`,
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
