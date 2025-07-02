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
  Request,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Role } from '../../../auth/entities/role.entity';
import { QuickBooksApiService, QuickBooksCredentials } from '../services/quickbooks-api.service';
import { QuickBooksItemSyncService, ItemSyncOptions } from '../services/quickbooks-item-sync.service';
import { QuickBooksCOGSService, COGSConfiguration } from '../services/quickbooks-cogs.service';
import { QuickBooksInvoiceService, InvoiceGenerationOptions } from '../services/quickbooks-invoice.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingAccount, AccountingPlatform } from '../../entities/accounting-account.entity';

@ApiTags('QuickBooks Integration')
@Controller('api/v1/integrations/quickbooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QuickBooksController {
  private readonly logger = new Logger(QuickBooksController.name);

  constructor(
    private readonly quickBooksApiService: QuickBooksApiService,
    private readonly quickBooksItemSyncService: QuickBooksItemSyncService,
    private readonly quickBooksCOGSService: QuickBooksCOGSService,
    private readonly quickBooksInvoiceService: QuickBooksInvoiceService,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
  ) {}

  @Get('auth/url')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get QuickBooks OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'Authorization URL generated successfully' })
  getAuthorizationUrl(
    @Query('redirect_uri') redirectUri: string,
    @Query('state') state: string,
    @Request() req: any,
  ) {
    try {
      const clientId = process.env.QUICKBOOKS_CLIENT_ID;
      if (!clientId) {
        throw new Error('QuickBooks client ID not configured');
      }

      const authUrl = this.quickBooksApiService.getAuthorizationUrl(
        clientId,
        redirectUri,
        state,
      );

      return {
        success: true,
        data: {
          authorizationUrl: authUrl,
          clientId,
          redirectUri,
          state,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to generate authorization URL: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'AUTHORIZATION_URL_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post('auth/token')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Exchange authorization code for access token' })
  @ApiResponse({ status: 200, description: 'Token exchanged successfully' })
  async exchangeToken(
    @Body() body: {
      authCode: string;
      redirectUri: string;
      realmId: string;
    },
    @Request() req: any,
  ) {
    try {
      const { authCode, redirectUri, realmId } = body;
      const tenantId = req.user.tenantId;

      const clientId = process.env.QUICKBOOKS_CLIENT_ID;
      const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('QuickBooks credentials not configured');
      }

      // Exchange code for token
      const tokenResponse = await this.quickBooksApiService.getAccessToken(
        clientId,
        clientSecret,
        authCode,
        redirectUri,
        tenantId,
      );

      if (!tokenResponse.success) {
        throw new Error(`Token exchange failed: ${tokenResponse.error?.message}`);
      }

      const tokenData = tokenResponse.data!;

      // Create or update accounting account
      const accountingAccount = await this.createOrUpdateAccount(
        tenantId,
        {
          clientId,
          clientSecret,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          realmId,
          environment: process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production' || 'production',
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
        req.user.id,
      );

      return {
        success: true,
        data: {
          accountId: accountingAccount.id,
          connected: true,
          companyInfo: await this.getCompanyInfo(accountingAccount.id, tenantId),
        },
      };
    } catch (error) {
      this.logger.error(`Token exchange failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/connection/test')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Test QuickBooks connection' })
  @ApiResponse({ status: 200, description: 'Connection tested successfully' })
  async testConnection(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const result = await this.quickBooksApiService.testConnection(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      return {
        success: result.success,
        data: {
          connected: result.success,
          companyInfo: result.success ? result.data : null,
          error: result.error,
        },
      };
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/company-info')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Get QuickBooks company information' })
  @ApiResponse({ status: 200, description: 'Company information retrieved successfully' })
  async getCompanyInfo(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.quickBooksApiService.getCompanyInfo(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to get company info: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data?.CompanyInfo,
      };
    } catch (error) {
      this.logger.error(`Failed to get company info: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'COMPANY_INFO_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/items/sync')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Sync products to QuickBooks items' })
  @ApiResponse({ status: 200, description: 'Items synced successfully' })
  async syncItemsToQuickBooks(
    @Param('accountId') accountId: string,
    @Body() options: ItemSyncOptions,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.quickBooksItemSyncService.syncToQuickBooks(
        accountId,
        tenantId,
        options,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Item sync failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'ITEM_SYNC_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/items/import')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Import items from QuickBooks' })
  @ApiResponse({ status: 200, description: 'Items imported successfully' })
  async importItemsFromQuickBooks(
    @Param('accountId') accountId: string,
    @Body() options: ItemSyncOptions,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.quickBooksItemSyncService.syncFromQuickBooks(
        accountId,
        tenantId,
        options,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Item import failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'ITEM_IMPORT_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/items/bidirectional-sync')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Perform bidirectional item sync' })
  @ApiResponse({ status: 200, description: 'Bidirectional sync completed successfully' })
  async bidirectionalItemSync(
    @Param('accountId') accountId: string,
    @Body() options: ItemSyncOptions,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.quickBooksItemSyncService.bidirectionalSync(
        accountId,
        tenantId,
        options,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Bidirectional sync failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'BIDIRECTIONAL_SYNC_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/cogs/calculate')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Calculate and post COGS to QuickBooks' })
  @ApiResponse({ status: 200, description: 'COGS calculated and posted successfully' })
  async calculateCOGS(
    @Param('accountId') accountId: string,
    @Body() body: {
      startDate: string;
      endDate: string;
      config: COGSConfiguration;
    },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { startDate, endDate, config } = body;

      const result = await this.quickBooksCOGSService.calculateAndPostCOGS(
        accountId,
        tenantId,
        new Date(startDate),
        new Date(endDate),
        config,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`COGS calculation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'COGS_CALCULATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/cogs/report')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Generate COGS report' })
  @ApiResponse({ status: 200, description: 'COGS report generated successfully' })
  async generateCOGSReport(
    @Param('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('costingMethod') costingMethod: COGSConfiguration['costingMethod'] = 'average',
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const config: COGSConfiguration = {
        cogsAccountId: '',
        inventoryAssetAccountId: '',
        enableAutoPosting: false,
        postingFrequency: 'daily',
        costingMethod,
        includeAdjustments: true,
        includeTransfers: true,
        includeReturns: true,
      };

      const report = await this.quickBooksCOGSService.generateCOGSReport(
        tenantId,
        new Date(startDate),
        new Date(endDate),
        config,
      );

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(`COGS report generation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'COGS_REPORT_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/invoices/generate')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Generate QuickBooks invoice from order' })
  @ApiResponse({ status: 200, description: 'Invoice generated successfully' })
  async generateInvoice(
    @Param('accountId') accountId: string,
    @Body() body: {
      orderId: string;
      options?: InvoiceGenerationOptions;
    },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { orderId, options = {} } = body;

      const result = await this.quickBooksInvoiceService.generateInvoiceFromOrder(
        accountId,
        orderId,
        tenantId,
        options,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Invoice generation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'INVOICE_GENERATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/invoices/batch-generate')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Generate QuickBooks invoices for multiple orders' })
  @ApiResponse({ status: 200, description: 'Batch invoice generation completed' })
  async generateInvoiceBatch(
    @Param('accountId') accountId: string,
    @Body() body: {
      orderIds: string[];
      options?: InvoiceGenerationOptions;
    },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { orderIds, options = {} } = body;

      const result = await this.quickBooksInvoiceService.generateInvoiceBatch(
        accountId,
        orderIds,
        tenantId,
        options,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Batch invoice generation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'BATCH_INVOICE_GENERATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/invoices/:invoiceId/status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Get QuickBooks invoice status' })
  @ApiResponse({ status: 200, description: 'Invoice status retrieved successfully' })
  async getInvoiceStatus(
    @Param('accountId') accountId: string,
    @Param('invoiceId') invoiceId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.quickBooksInvoiceService.syncInvoiceStatus(
        accountId,
        invoiceId,
        tenantId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get invoice status: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'INVOICE_STATUS_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/accounts')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Get QuickBooks chart of accounts' })
  @ApiResponse({ status: 200, description: 'Chart of accounts retrieved successfully' })
  async getAccounts(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.quickBooksApiService.getAccounts(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to get accounts: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data?.QueryResponse?.Account || [],
      };
    } catch (error) {
      this.logger.error(`Failed to get accounts: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'GET_ACCOUNTS_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/tax-codes')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Get QuickBooks tax codes' })
  @ApiResponse({ status: 200, description: 'Tax codes retrieved successfully' })
  async getTaxCodes(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.quickBooksApiService.getTaxCodes(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to get tax codes: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data?.QueryResponse?.TaxCode || [],
      };
    } catch (error) {
      this.logger.error(`Failed to get tax codes: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'GET_TAX_CODES_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Delete(':accountId/disconnect')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Disconnect QuickBooks account' })
  @ApiResponse({ status: 200, description: 'Account disconnected successfully' })
  async disconnectAccount(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      await this.accountingAccountRepository.update(
        { id: accountId, tenantId },
        {
          status: 'disconnected',
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          updatedBy: req.user.id,
        },
      );

      return {
        success: true,
        data: {
          message: 'QuickBooks account disconnected successfully',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to disconnect account: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'DISCONNECT_FAILED',
          message: error.message,
        },
      };
    }
  }

  // Helper methods

  private async getAccountingAccount(accountId: string, tenantId: string): Promise<AccountingAccount> {
    const account = await this.accountingAccountRepository.findOne({
      where: { id: accountId, tenantId, platform: AccountingPlatform.QUICKBOOKS },
    });

    if (!account) {
      throw new Error('QuickBooks account not found');
    }

    return account;
  }

  private getCredentials(accountingAccount: AccountingAccount): QuickBooksCredentials {
    return {
      clientId: accountingAccount.clientId!,
      clientSecret: accountingAccount.clientSecret!,
      accessToken: accountingAccount.accessToken!,
      refreshToken: accountingAccount.refreshToken!,
      realmId: accountingAccount.platformConfig?.realmId!,
      environment: accountingAccount.platformConfig?.environment || 'production',
      expiresAt: accountingAccount.tokenExpiresAt,
    };
  }

  private async createOrUpdateAccount(
    tenantId: string,
    credentials: QuickBooksCredentials,
    userId: string,
  ): Promise<AccountingAccount> {
    // Check if account already exists
    const existingAccount = await this.accountingAccountRepository.findOne({
      where: {
        tenantId,
        platform: AccountingPlatform.QUICKBOOKS,
        companyId: credentials.realmId,
      },
    });

    const accountData = {
      tenantId,
      platform: AccountingPlatform.QUICKBOOKS,
      status: 'connected' as const,
      companyId: credentials.realmId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      tokenExpiresAt: credentials.expiresAt,
      platformConfig: {
        realmId: credentials.realmId,
        environment: credentials.environment,
      },
      updatedBy: userId,
    };

    if (existingAccount) {
      await this.accountingAccountRepository.update(existingAccount.id, accountData);
      return { ...existingAccount, ...accountData };
    } else {
      const newAccount = this.accountingAccountRepository.create({
        ...accountData,
        createdBy: userId,
      });
      return this.accountingAccountRepository.save(newAccount);
    }
  }
}