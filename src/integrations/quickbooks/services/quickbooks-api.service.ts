import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseApiService, ApiConfig, ApiRequest, ApiResponse } from '../../common/services/base-api.service';
import { HttpService } from '@nestjs/axios';
import { AccountingAccount } from '../../entities/accounting-account.entity';

export interface QuickBooksCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  realmId: string;
  environment: 'sandbox' | 'production';
  expiresAt?: Date;
}

export interface QuickBooksApiRequest extends Omit<ApiRequest, 'headers'> {
  requiresAuth?: boolean;
  acceptType?: 'application/json' | 'application/pdf';
  minorVersion?: string;
}

export interface QuickBooksItem {
  Id?: string;
  Name: string;
  Description?: string;
  Type: 'Inventory' | 'NonInventory' | 'Service';
  UnitPrice?: number;
  QtyOnHand?: number;
  IncomeAccountRef?: {
    value: string;
    name?: string;
  };
  ExpenseAccountRef?: {
    value: string;
    name?: string;
  };
  AssetAccountRef?: {
    value: string;
    name?: string;
  };
  Taxable?: boolean;
  SalesTaxCodeRef?: {
    value: string;
    name?: string;
  };
  PurchaseTaxCodeRef?: {
    value: string;
    name?: string;
  };
  Active?: boolean;
  Sku?: string;
  ManPartNum?: string;
  UOM?: string; // Unit of Measure
  TrackQtyOnHand?: boolean;
  InvStartDate?: string;
  BuildPoint?: number;
  ReorderPoint?: number;
  AbatementRate?: number;
  ReverseChargeRate?: number;
}

export interface QuickBooksInvoice {
  Id?: string;
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line: Array<{
    Id?: string;
    LineNum?: number;
    Amount: number;
    DetailType: 'SalesItemLineDetail' | 'DiscountLineDetail' | 'TaxLineDetail';
    SalesItemLineDetail?: {
      ItemRef?: {
        value: string;
        name?: string;
      };
      Qty?: number;
      UnitPrice?: number;
      TaxCodeRef?: {
        value: string;
        name?: string;
      };
    };
    DiscountLineDetail?: {
      PercentBased?: boolean;
      DiscountPercent?: number;
      DiscountAccountRef?: {
        value: string;
        name?: string;
      };
    };
  }>;
  TxnDate?: string;
  DueDate?: string;
  DocNumber?: string;
  PrivateNote?: string;
  CustomerMemo?: {
    value: string;
  };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  ShipAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  SalesTermRef?: {
    value: string;
    name?: string;
  };
  TotalAmt?: number;
  ApplyTaxAfterDiscount?: boolean;
  PrintStatus?: 'NotSet' | 'NeedToPrint' | 'PrintComplete';
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent';
  Balance?: number;
  Deposit?: number;
  TrackingNum?: string;
  ClassRef?: {
    value: string;
    name?: string;
  };
  DepartmentRef?: {
    value: string;
    name?: string;
  };
}

export interface QuickBooksCustomer {
  Id?: string;
  Name: string;
  CompanyName?: string;
  DisplayName?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  PrimaryEmailAddr?: {
    Address?: string;
  };
  WebAddr?: {
    URI?: string;
  };
  DefaultTaxCodeRef?: {
    value: string;
    name?: string;
  };
  Taxable?: boolean;
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  ShipAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  PaymentMethodRef?: {
    value: string;
    name?: string;
  };
  SalesTermRef?: {
    value: string;
    name?: string;
  };
  PreferredDeliveryMethod?: 'Print' | 'Email' | 'None';
  ResaleNum?: string;
  CurrencyRef?: {
    value: string;
    name?: string;
  };
}

@Injectable()
export class QuickBooksApiService extends BaseApiService {
  private readonly logger = new Logger(QuickBooksApiService.name);
  
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get QuickBooks API configuration
   */
  private getApiConfig(credentials: QuickBooksCredentials): ApiConfig {
    const baseUrl = credentials.environment === 'sandbox' 
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

    return {
      baseUrl,
      apiVersion: 'v1/company',
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 500, // QuickBooks allows 500 API calls per minute
        burstLimit: 100,
      },
      authentication: {
        type: 'bearer',
        credentials: {
          accessToken: credentials.accessToken,
        },
      },
    };
  }

  /**
   * Make authenticated request to QuickBooks API
   */
  async makeQuickBooksRequest<T = any>(
    credentials: QuickBooksCredentials,
    request: QuickBooksApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);
    
    // Prepare the endpoint with realmId
    const endpoint = `${credentials.realmId}${request.endpoint}`;

    const qbRequest: ApiRequest = {
      ...request,
      endpoint,
      headers: {
        'Accept': request.acceptType || 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'StokCerdas/1.0',
        ...request.headers,
      },
    };

    // Add minor version if specified
    if (request.minorVersion) {
      qbRequest.params = {
        ...qbRequest.params,
        minorversion: request.minorVersion,
      };
    }

    return this.makeRequest<T>(config, qbRequest, tenantId, channelId);
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: QuickBooksCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      const request: QuickBooksApiRequest = {
        method: 'GET',
        endpoint: '/companyinfo/1',
        requiresAuth: true,
      };

      return await this.makeQuickBooksRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`QuickBooks connection test failed: ${error.message}`);
      return {
        success: false,
        error: {
          code: 'CONNECTION_TEST_FAILED',
          message: error.message,
        },
        metadata: {
          requestId: 'test_connection',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string,
    scope: string = 'com.intuit.quickbooks.accounting',
  ): string {
    const baseUrl = 'https://appcenter.intuit.com/connect/oauth2';
    
    const params = new URLSearchParams({
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      state,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(
    clientId: string,
    clientSecret: string,
    authCode: string,
    redirectUri: string,
    tenantId: string,
  ): Promise<ApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    realmId: string;
  }>> {
    const config: ApiConfig = {
      baseUrl: 'https://oauth.platform.intuit.com',
      apiVersion: 'oauth2/v1',
      timeout: 30000,
    };

    const request: ApiRequest = {
      method: 'POST',
      endpoint: '/tokens/bearer',
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    };

    return this.makeRequest(config, request, tenantId, 'quickbooks_auth');
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    credentials: QuickBooksCredentials,
    tenantId: string,
  ): Promise<ApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>> {
    const config: ApiConfig = {
      baseUrl: 'https://oauth.platform.intuit.com',
      apiVersion: 'oauth2/v1',
      timeout: 30000,
    };

    const request: ApiRequest = {
      method: 'POST',
      endpoint: '/tokens/bearer',
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
      },
    };

    return this.makeRequest(config, request, tenantId, 'quickbooks_auth');
  }

  /**
   * Get company information
   */
  async getCompanyInfo(
    credentials: QuickBooksCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    CompanyInfo: {
      Id: string;
      Name: string;
      CompanyName: string;
      LegalName: string;
      Country: string;
      FiscalYearStartMonth: string;
      SupportedLanguages: string;
      DefaultCurrency: {
        value: string;
        name: string;
      };
    };
  }>> {
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: '/companyinfo/1',
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Create or update item
   */
  async createItem(
    credentials: QuickBooksCredentials,
    item: QuickBooksItem,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ Item: QuickBooksItem }>> {
    const request: QuickBooksApiRequest = {
      method: 'POST',
      endpoint: '/items',
      data: {
        Item: item,
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Update item
   */
  async updateItem(
    credentials: QuickBooksCredentials,
    item: QuickBooksItem,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ Item: QuickBooksItem }>> {
    const request: QuickBooksApiRequest = {
      method: 'POST',
      endpoint: '/items',
      data: {
        Item: item,
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get item by ID
   */
  async getItem(
    credentials: QuickBooksCredentials,
    itemId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ Item: QuickBooksItem }>> {
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: `/items/${itemId}`,
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Query items
   */
  async queryItems(
    credentials: QuickBooksCredentials,
    query?: string,
    tenantId?: string,
    channelId?: string,
  ): Promise<ApiResponse<{ QueryResponse: { Item: QuickBooksItem[] } }>> {
    const sqlQuery = query || "SELECT * FROM Item WHERE Active = true";
    
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: '/query',
      params: {
        query: sqlQuery,
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Create invoice
   */
  async createInvoice(
    credentials: QuickBooksCredentials,
    invoice: QuickBooksInvoice,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ Invoice: QuickBooksInvoice }>> {
    const request: QuickBooksApiRequest = {
      method: 'POST',
      endpoint: '/invoices',
      data: {
        Invoice: invoice,
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get invoice PDF
   */
  async getInvoicePdf(
    credentials: QuickBooksCredentials,
    invoiceId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<Buffer>> {
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: `/invoices/${invoiceId}/pdf`,
      acceptType: 'application/pdf',
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Create customer
   */
  async createCustomer(
    credentials: QuickBooksCredentials,
    customer: QuickBooksCustomer,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ Customer: QuickBooksCustomer }>> {
    const request: QuickBooksApiRequest = {
      method: 'POST',
      endpoint: '/customers',
      data: {
        Customer: customer,
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Query customers
   */
  async queryCustomers(
    credentials: QuickBooksCredentials,
    query?: string,
    tenantId?: string,
    channelId?: string,
  ): Promise<ApiResponse<{ QueryResponse: { Customer: QuickBooksCustomer[] } }>> {
    const sqlQuery = query || "SELECT * FROM Customer WHERE Active = true";
    
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: '/query',
      params: {
        query: sqlQuery,
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get chart of accounts
   */
  async getAccounts(
    credentials: QuickBooksCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: '/query',
      params: {
        query: "SELECT * FROM Account WHERE Active = true",
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get tax codes
   */
  async getTaxCodes(
    credentials: QuickBooksCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    const request: QuickBooksApiRequest = {
      method: 'GET',
      endpoint: '/query',
      params: {
        query: "SELECT * FROM TaxCode WHERE Active = true",
      },
      requiresAuth: true,
    };

    return this.makeQuickBooksRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Handle QuickBooks API errors
   */
  handleQuickBooksError(error: any): { code: string; message: string; retryable: boolean } {
    const errorCode = error.Fault?.Error?.[0]?.code || error.code;
    const errorMessage = error.Fault?.Error?.[0]?.Detail || error.message || 'Unknown QuickBooks API error';

    // Map common QuickBooks error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      '401': { message: 'Unauthorized - invalid or expired token', retryable: false },
      '403': { message: 'Forbidden - insufficient permissions', retryable: false },
      '429': { message: 'Rate limit exceeded', retryable: true },
      '500': { message: 'Internal server error', retryable: true },
      '503': { message: 'Service temporarily unavailable', retryable: true },
      '3200': { message: 'Invalid request - bad syntax', retryable: false },
      '3210': { message: 'Object not found', retryable: false },
      '6000': { message: 'Object validation failed', retryable: false },
      '6010': { message: 'Business validation error', retryable: false },
    };

    const mappedError = errorMap[errorCode];
    
    return {
      code: errorCode || 'QUICKBOOKS_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }
}