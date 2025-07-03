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
import { UserRole } from '../../../users/entities/user.entity';
// import { Role } from '../../../auth/entities/role.entity'; // TODO: Create role entity
import { AccurateApiService, AccurateCredentials } from '../services/accurate-api.service';
import { AccurateTaxComplianceService, IndonesianTaxConfiguration } from '../services/accurate-tax-compliance.service';
import { AccurateMultiCurrencyService, CurrencyConfiguration } from '../services/accurate-multi-currency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingAccount, AccountingPlatform, AccountingConnectionStatus } from '../../entities/accounting-account.entity';

@ApiTags('Accurate Online Integration')
@Controller('api/v1/integrations/accurate')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AccurateController {
  private readonly logger = new Logger(AccurateController.name);

  constructor(
    private readonly accurateApiService: AccurateApiService,
    private readonly accurateTaxComplianceService: AccurateTaxComplianceService,
    private readonly accurateMultiCurrencyService: AccurateMultiCurrencyService,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
  ) {}

  @Post('auth/authenticate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Authenticate with Accurate Online' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  async authenticate(
    @Body() body: {
      serverUrl: string;
      username: string;
      password: string;
      databaseId: string;
    },
    @Request() req: any,
  ) {
    try {
      const { serverUrl, username, password, databaseId } = body;
      const tenantId = req.user.tenantId;

      // Authenticate with Accurate
      const authResponse = await this.accurateApiService.authenticate(
        serverUrl,
        username,
        password,
        databaseId,
        tenantId,
      );

      if (!authResponse.success) {
        throw new Error(`Authentication failed: ${authResponse.error?.message}`);
      }

      const authData = authResponse.data!;

      // Create or update accounting account
      const accountingAccount = await this.createOrUpdateAccount(
        tenantId,
        {
          clientId: '', // Accurate doesn't use client ID
          clientSecret: '',
          accessToken: '', // Accurate uses session-based auth
          sessionId: authData.session,
          databaseId,
          serverUrl,
          environment: 'production',
        },
        req.user.id,
      );

      return {
        success: true,
        data: {
          accountId: accountingAccount.id,
          connected: true,
          session: authData.session,
          databases: authData.databases,
          companyInfo: await this.getCompanyProfile(accountingAccount.id, tenantId),
        },
      };
    } catch (error) {
      this.logger.error(`Accurate authentication failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/connection/test')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Test Accurate connection' })
  @ApiResponse({ status: 200, description: 'Connection tested successfully' })
  async testConnection(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const result = await this.accurateApiService.testConnection(
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

  @Get(':accountId/company-profile')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get Accurate company profile' })
  @ApiResponse({ status: 200, description: 'Company profile retrieved successfully' })
  async getCompanyProfile(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.getCompanyProfile(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to get company profile: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get company profile: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'COMPANY_PROFILE_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get items from Accurate' })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  async getItems(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('filter') filter?: string,
    @Query('itemType') itemType?: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE',
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.getItems(
        credentials,
        tenantId,
        accountingAccount.channelId!,
        { skip, take, filter, itemType },
      );

      if (!response.success) {
        throw new Error(`Failed to get items: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get items: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'GET_ITEMS_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/items')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create item in Accurate' })
  @ApiResponse({ status: 200, description: 'Item created successfully' })
  async createItem(
    @Param('accountId') accountId: string,
    @Body() item: any,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.createItem(
        credentials,
        item,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to create item: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to create item: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CREATE_ITEM_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/invoices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get invoices from Accurate' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  async getInvoices(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('filter') filter?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.getInvoices(
        credentials,
        tenantId,
        accountingAccount.channelId!,
        { skip, take, filter, dateFrom, dateTo },
      );

      if (!response.success) {
        throw new Error(`Failed to get invoices: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get invoices: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'GET_INVOICES_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/invoices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create invoice in Accurate' })
  @ApiResponse({ status: 200, description: 'Invoice created successfully' })
  async createInvoice(
    @Param('accountId') accountId: string,
    @Body() invoice: any,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.createInvoice(
        credentials,
        invoice,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to create invoice: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to create invoice: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CREATE_INVOICE_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/customers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get customers from Accurate' })
  @ApiResponse({ status: 200, description: 'Customers retrieved successfully' })
  async getCustomers(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('filter') filter?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.getCustomers(
        credentials,
        tenantId,
        accountingAccount.channelId!,
        { skip, take, filter },
      );

      if (!response.success) {
        throw new Error(`Failed to get customers: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get customers: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'GET_CUSTOMERS_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/accounts')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get chart of accounts from Accurate' })
  @ApiResponse({ status: 200, description: 'Chart of accounts retrieved successfully' })
  async getAccounts(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.getAccounts(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to get accounts: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
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

  @Get(':accountId/tax-rates')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get tax rates from Accurate' })
  @ApiResponse({ status: 200, description: 'Tax rates retrieved successfully' })
  async getTaxRates(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const accountingAccount = await this.getAccountingAccount(accountId, tenantId);
      const credentials = this.getCredentials(accountingAccount);

      const response = await this.accurateApiService.getTaxRates(
        credentials,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to get tax rates: ${response.error?.message}`);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get tax rates: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'GET_TAX_RATES_FAILED',
          message: error.message,
        },
      };
    }
  }

  // Tax Compliance Endpoints

  @Post(':accountId/tax/configure')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Configure Indonesian tax settings' })
  @ApiResponse({ status: 200, description: 'Tax settings configured successfully' })
  async configureTaxSettings(
    @Param('accountId') accountId: string,
    @Body() config: IndonesianTaxConfiguration,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.accurateTaxComplianceService.configureTaxSettings(
        accountId,
        tenantId,
        config,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Tax configuration failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'TAX_CONFIGURATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/tax/calculate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Calculate tax for order or invoice' })
  @ApiResponse({ status: 200, description: 'Tax calculated successfully' })
  async calculateTax(
    @Param('accountId') accountId: string,
    @Body() body: {
      orderOrInvoiceId: string;
      type: 'order' | 'invoice';
    },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { orderOrInvoiceId, type } = body;

      const result = await this.accurateTaxComplianceService.calculateTax(
        accountId,
        orderOrInvoiceId,
        tenantId,
        type,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Tax calculation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'TAX_CALCULATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/tax/efaktur/generate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Generate e-Faktur for invoice' })
  @ApiResponse({ status: 200, description: 'e-Faktur generated successfully' })
  async generateEFaktur(
    @Param('accountId') accountId: string,
    @Body() body: { invoiceId: string },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { invoiceId } = body;

      const result = await this.accurateTaxComplianceService.generateEFaktur(
        accountId,
        invoiceId,
        tenantId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`e-Faktur generation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'EFAKTUR_GENERATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/tax/report')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Generate tax report' })
  @ApiResponse({ status: 200, description: 'Tax report generated successfully' })
  async generateTaxReport(
    @Param('accountId') accountId: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const report = await this.accurateTaxComplianceService.generateTaxReport(
        accountId,
        tenantId,
        month,
        year,
      );

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(`Tax report generation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'TAX_REPORT_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/tax/compliance/check')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Check tax compliance status' })
  @ApiResponse({ status: 200, description: 'Compliance status checked successfully' })
  async checkCompliance(
    @Param('accountId') accountId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.accurateTaxComplianceService.checkCompliance(
        accountId,
        tenantId,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Compliance check failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'COMPLIANCE_CHECK_FAILED',
          message: error.message,
        },
      };
    }
  }

  // Multi-Currency Endpoints

  @Post(':accountId/currency/configure')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Configure multi-currency settings' })
  @ApiResponse({ status: 200, description: 'Currency settings configured successfully' })
  async configureCurrency(
    @Param('accountId') accountId: string,
    @Body() config: CurrencyConfiguration,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.accurateMultiCurrencyService.configureCurrency(
        accountId,
        tenantId,
        config,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Currency configuration failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CURRENCY_CONFIGURATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/currency/exchange-rate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get exchange rate between currencies' })
  @ApiResponse({ status: 200, description: 'Exchange rate retrieved successfully' })
  async getExchangeRate(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('fromCurrency') fromCurrency: string,
    @Query('toCurrency') toCurrency: string,
    @Query('date') date?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const result = await this.accurateMultiCurrencyService.getExchangeRate(
        accountId,
        fromCurrency,
        toCurrency,
        tenantId,
        date ? new Date(date) : undefined,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get exchange rate: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'EXCHANGE_RATE_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/currency/convert')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiResponse({ status: 200, description: 'Currency converted successfully' })
  async convertCurrency(
    @Param('accountId') accountId: string,
    @Body() body: {
      amount: number;
      fromCurrency: string;
      toCurrency: string;
      date?: string;
    },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { amount, fromCurrency, toCurrency, date } = body;

      const result = await this.accurateMultiCurrencyService.convertCurrency(
        accountId,
        amount,
        fromCurrency,
        toCurrency,
        tenantId,
        date ? new Date(date) : undefined,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Currency conversion failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CURRENCY_CONVERSION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Post(':accountId/currency/revaluation')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Perform currency revaluation' })
  @ApiResponse({ status: 200, description: 'Currency revaluation completed successfully' })
  async performRevaluation(
    @Param('accountId') accountId: string,
    @Body() body: { revaluationDate?: string },
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const { revaluationDate } = body;

      const result = await this.accurateMultiCurrencyService.performRevaluation(
        accountId,
        tenantId,
        revaluationDate ? new Date(revaluationDate) : undefined,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Currency revaluation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CURRENCY_REVALUATION_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Get(':accountId/currency/report')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Generate currency report' })
  @ApiResponse({ status: 200, description: 'Currency report generated successfully' })
  async generateCurrencyReport(
    @Request() req: any,
    @Param('accountId') accountId: string,
    @Query('reportDate') reportDate?: string,
  ) {
    try {
      const tenantId = req.user.tenantId;

      const report = await this.accurateMultiCurrencyService.generateCurrencyReport(
        accountId,
        tenantId,
        reportDate ? new Date(reportDate) : undefined,
      );

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(`Currency report generation failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CURRENCY_REPORT_FAILED',
          message: error.message,
        },
      };
    }
  }

  @Delete(':accountId/disconnect')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Disconnect Accurate account' })
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
          status: AccountingConnectionStatus.DISCONNECTED,
          accessToken: null,
          platformConfig: null,
          updatedBy: req.user.id,
        },
      );

      return {
        success: true,
        data: {
          message: 'Accurate account disconnected successfully',
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
      where: { id: accountId, tenantId, platform: AccountingPlatform.ACCURATE },
    });

    if (!account) {
      throw new Error('Accurate account not found');
    }

    return account;
  }

  private getCredentials(accountingAccount: AccountingAccount): AccurateCredentials {
    return {
      clientId: accountingAccount.clientId || '',
      clientSecret: accountingAccount.clientSecret || '',
      accessToken: accountingAccount.accessToken || '',
      sessionId: accountingAccount.platformConfig?.sessionId!,
      databaseId: accountingAccount.platformConfig?.databaseId!,
      serverUrl: accountingAccount.apiBaseUrl!,
      environment: 'production',
      expiresAt: accountingAccount.tokenExpiresAt,
    };
  }

  private async createOrUpdateAccount(
    tenantId: string,
    credentials: Partial<AccurateCredentials>,
    userId: string,
  ): Promise<AccountingAccount> {
    // Check if account already exists
    const existingAccount = await this.accountingAccountRepository.findOne({
      where: {
        tenantId,
        platform: AccountingPlatform.ACCURATE,
        platformConfig: {
          databaseId: credentials.databaseId,
        } as any,
      },
    });

    const accountData = {
      tenantId,
      platform: AccountingPlatform.ACCURATE,
      status: AccountingConnectionStatus.CONNECTED,
      apiBaseUrl: credentials.serverUrl,
      platformConfig: {
        sessionId: credentials.sessionId,
        databaseId: credentials.databaseId,
        serverUrl: credentials.serverUrl,
        environment: (credentials.environment === 'demo' ? 'sandbox' : 'production') as 'sandbox' | 'production',
      },
      updatedBy: userId,
    };

    if (existingAccount) {
      await this.accountingAccountRepository.update(existingAccount.id, accountData);
      return this.accountingAccountRepository.findOne({
        where: { id: existingAccount.id, tenantId },
      });
    } else {
      const newAccount = this.accountingAccountRepository.create({
        ...accountData,
        createdBy: userId,
      });
      return this.accountingAccountRepository.save(newAccount);
    }
  }
}