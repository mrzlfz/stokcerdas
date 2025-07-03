import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseApiService, ApiConfig, ApiRequest, ApiResponse } from '../../common/services/base-api.service';
import { HttpService } from '@nestjs/axios';
import { AccountingAccount } from '../../entities/accounting-account.entity';

export interface AccurateCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
  sessionId: string;
  databaseId: string;
  serverUrl: string;
  environment: 'production' | 'demo';
  expiresAt?: Date;
}

export interface AccurateApiRequest extends Omit<ApiRequest, 'headers'> {
  requiresAuth?: boolean;
  databaseId?: string;
}

export interface AccurateItem {
  id?: number;
  no?: string;
  name: string;
  alias?: string;
  unitPrice?: number;
  avgPrice?: number;
  unitPriceCurrency?: string;
  itemCategoryId?: number;
  itemCategoryName?: string;
  unitId?: number;
  unitName?: string;
  itemType?: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE';
  description?: string;
  active?: boolean;
  saleAccountId?: number;
  saleAccountName?: string;
  purchaseAccountId?: number;
  purchaseAccountName?: string;
  inventoryAccountId?: number;
  inventoryAccountName?: string;
  cogsAccountId?: number; // Cost of Goods Sold Account
  cogsAccountName?: string;
  saleTaxId?: number;
  saleTaxName?: string;
  purchaseTaxId?: number;
  purchaseTaxName?: string;
  depreciationAccountId?: number;
  accumulatedDepreciationAccountId?: number;
  fixedAssetAccountId?: number;
  enableBarcode?: boolean;
  barcode?: string;
  averageCost?: number;
  quantity?: number;
  warehouseQuantities?: Array<{
    warehouseId: number;
    warehouseName: string;
    quantity: number;
  }>;
  minimumStock?: number;
  maximumStock?: number;
  reorderPoint?: number;
  leadTime?: number;
  additionalField?: Record<string, any>;
}

export interface AccurateInvoice {
  id?: number;
  transactionNo?: string;
  customerId: number;
  customerName?: string;
  transactionDate: string;
  dueDate?: string;
  warehouseId?: number;
  warehouseName?: string;
  currencyId?: number;
  currencyCode?: string;
  exchangeRate?: number;
  description?: string;
  referenceNo?: string;
  inclusive?: boolean; // Include tax in price
  taxId?: number;
  taxName?: string;
  taxRate?: number;
  discountFormula?: string;
  totalDiscount?: number;
  totalAmount?: number;
  remainingAmount?: number;
  withholdingTaxFormula?: string;
  detailItem?: Array<{
    itemId?: number;
    itemName?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    amount?: number;
    unitId?: number;
    unitName?: string;
    warehouseId?: number;
    warehouseName?: string;
    itemType?: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE';
    taxId?: number;
    taxName?: string;
    departmentId?: number;
    projectId?: number;
  }>;
  branchId?: number;
  branchName?: string;
  departmentId?: number;
  departmentName?: string;
  projectId?: number;
  projectName?: string;
  customerAddress?: string;
  shipTo?: string;
  shipDate?: string;
  terms?: string;
  salesmanId?: number;
  salesmanName?: string;
  refNumber?: string;
  memo?: string;
  isPaid?: boolean;
  isPosted?: boolean;
  void?: boolean;
}

export interface AccurateCustomer {
  id?: number;
  no?: string;
  name: string;
  customerTypeName?: string;
  address?: string;
  city?: string;
  contact?: string;
  phone?: string;
  fax?: string;
  email?: string;
  npwp?: string; // Indonesian tax number
  receivableAccountId?: number;
  receivableAccountName?: string;
  salesAccountId?: number;
  salesAccountName?: string;
  termId?: number;
  termName?: string;
  creditLimit?: number;
  taxId?: number;
  taxName?: string;
  currencyId?: number;
  currencyCode?: string;
  salesmanId?: number;
  salesmanName?: string;
  billToAddress?: string;
  shipToAddress?: string;
  priceBookId?: number;
  priceBookName?: string;
  active?: boolean;
  paymentMethodId?: number;
  paymentMethodName?: string;
  merchantCategoryId?: number;
  merchantCategoryName?: string;
  branch?: string;
  businessField?: string;
  additionalField?: Record<string, any>;
}

export interface AccurateTaxRate {
  id?: number;
  name: string;
  rate: number;
  isActive?: boolean;
  taxType?: 'SALES' | 'PURCHASE' | 'BOTH';
  accountId?: number;
  accountName?: string;
  description?: string;
}

export interface AccurateAccount {
  id?: number;
  no?: string;
  name: string;
  accountType?: string;
  accountGroup?: string;
  description?: string;
  isActive?: boolean;
  isDetail?: boolean;
  currencyId?: number;
  currencyCode?: string;
  parentId?: number;
  parentName?: string;
  level?: number;
  isDebit?: boolean;
  openingBalance?: number;
  balance?: number;
}

@Injectable()
export class AccurateApiService extends BaseApiService {
  protected readonly logger = new Logger(AccurateApiService.name);
  
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get Accurate API configuration
   */
  private getApiConfig(credentials: AccurateCredentials): ApiConfig {
    const baseUrl = credentials.serverUrl || 'https://web.accurate.id';

    return {
      baseUrl,
      apiVersion: 'accurate/api',
      timeout: 60000, // Accurate API can be slower
      rateLimit: {
        requestsPerMinute: 300, // Conservative rate limit
        burstLimit: 50,
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
   * Make authenticated request to Accurate API
   */
  async makeAccurateRequest<T = any>(
    credentials: AccurateCredentials,
    request: AccurateApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);
    
    const accurateRequest: ApiRequest = {
      ...request,
      headers: {
        'X-Session-ID': credentials.sessionId,
        'X-Database-ID': request.databaseId || credentials.databaseId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'StokCerdas/1.0',
        // Custom headers handled by Accurate service
      },
    };

    return this.makeRequest<T>(config, accurateRequest, tenantId, channelId);
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      const request: AccurateApiRequest = {
        method: 'GET',
        endpoint: '/company/profile.do',
        requiresAuth: true,
      };

      return await this.makeAccurateRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`Accurate connection test failed: ${error.message}`);
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
   * Authenticate with username and password
   */
  async authenticate(
    serverUrl: string,
    username: string,
    password: string,
    databaseId: string,
    tenantId: string,
  ): Promise<ApiResponse<{
    session: string;
    name: string;
    email: string;
    databases: Array<{
      id: string;
      name: string;
      alias: string;
    }>;
  }>> {
    const config: ApiConfig = {
      baseUrl: serverUrl,
      apiVersion: 'accurate/api',
      timeout: 30000,
    };

    const request: ApiRequest = {
      method: 'POST',
      endpoint: '/login.do',
      data: {
        username,
        password,
        databaseId,
      },
    };

    return this.makeRequest(config, request, tenantId, 'accurate_auth');
  }

  /**
   * Get company profile
   */
  async getCompanyProfile(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    name: string;
    address: string;
    city: string;
    phone: string;
    npwp: string;
    currencySymbol: string;
    fiscalYear: string;
    companyType: string;
  }>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/company/profile.do',
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get items list
   */
  async getItems(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
    filters?: {
      skip?: number;
      take?: number;
      filter?: string;
      itemType?: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE';
    },
  ): Promise<ApiResponse<{
    sp: AccurateItem[];
    totalRows: number;
  }>> {
    const params: Record<string, any> = {};
    
    if (filters?.skip) params.skip = filters.skip;
    if (filters?.take) params.take = filters.take;
    if (filters?.filter) params.filter = filters.filter;
    if (filters?.itemType) params.itemType = filters.itemType;

    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/item/list.do',
      params,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Create item
   */
  async createItem(
    credentials: AccurateCredentials,
    item: AccurateItem,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ id: number }>> {
    const request: AccurateApiRequest = {
      method: 'POST',
      endpoint: '/item/save.do',
      data: item,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
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
    credentials: AccurateCredentials,
    item: AccurateItem,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ id: number }>> {
    const request: AccurateApiRequest = {
      method: 'POST',
      endpoint: '/item/save.do',
      data: item,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
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
    credentials: AccurateCredentials,
    itemId: number,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<AccurateItem>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/item/detail.do',
      params: { id: itemId },
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
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
    credentials: AccurateCredentials,
    invoice: AccurateInvoice,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ id: number }>> {
    const request: AccurateApiRequest = {
      method: 'POST',
      endpoint: '/sales-invoice/save.do',
      data: invoice,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(
    credentials: AccurateCredentials,
    invoiceId: number,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<AccurateInvoice>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/sales-invoice/detail.do',
      params: { id: invoiceId },
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get invoices list
   */
  async getInvoices(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
    filters?: {
      skip?: number;
      take?: number;
      filter?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<ApiResponse<{
    sp: AccurateInvoice[];
    totalRows: number;
  }>> {
    const params: Record<string, any> = {};
    
    if (filters?.skip) params.skip = filters.skip;
    if (filters?.take) params.take = filters.take;
    if (filters?.filter) params.filter = filters.filter;
    if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters?.dateTo) params.dateTo = filters.dateTo;

    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/sales-invoice/list.do',
      params,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
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
    credentials: AccurateCredentials,
    customer: AccurateCustomer,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ id: number }>> {
    const request: AccurateApiRequest = {
      method: 'POST',
      endpoint: '/customer/save.do',
      data: customer,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get customers list
   */
  async getCustomers(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
    filters?: {
      skip?: number;
      take?: number;
      filter?: string;
    },
  ): Promise<ApiResponse<{
    sp: AccurateCustomer[];
    totalRows: number;
  }>> {
    const params: Record<string, any> = {};
    
    if (filters?.skip) params.skip = filters.skip;
    if (filters?.take) params.take = filters.take;
    if (filters?.filter) params.filter = filters.filter;

    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/customer/list.do',
      params,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
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
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    sp: AccurateAccount[];
    totalRows: number;
  }>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/coa/list.do',
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get tax rates
   */
  async getTaxRates(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    sp: AccurateTaxRate[];
    totalRows: number;
  }>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/tax/list.do',
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get warehouses
   */
  async getWarehouses(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/warehouse/list.do',
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get currencies
   */
  async getCurrencies(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/currency/list.do',
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
    date?: string,
  ): Promise<ApiResponse<any>> {
    const params: Record<string, any> = {};
    if (date) params.date = date;

    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/currency/exchange-rate.do',
      params,
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Generate invoice PDF
   */
  async getInvoicePdf(
    credentials: AccurateCredentials,
    invoiceId: number,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<Buffer>> {
    const request: AccurateApiRequest = {
      method: 'GET',
      endpoint: '/sales-invoice/print.do',
      params: { 
        id: invoiceId,
        format: 'pdf'
      },
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Post invoice (confirm invoice)
   */
  async postInvoice(
    credentials: AccurateCredentials,
    invoiceId: number,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    const request: AccurateApiRequest = {
      method: 'POST',
      endpoint: '/sales-invoice/post.do',
      data: { id: invoiceId },
      requiresAuth: true,
    };

    return this.makeAccurateRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Validate Indonesian tax number (NPWP)
   */
  validateNPWP(npwp: string): boolean {
    // Remove any formatting
    const cleanNPWP = npwp.replace(/[^\d]/g, '');
    
    // NPWP should be 15 digits
    if (cleanNPWP.length !== 15) {
      return false;
    }
    
    // Basic validation algorithm for NPWP
    const digits = cleanNPWP.split('').map(Number);
    const multipliers = [2, 4, 8, 5, 0, 7, 6, 3, 9, 1, 2, 4, 8];
    
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += digits[i] * multipliers[i];
    }
    
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    
    return digits[13] === checkDigit;
  }

  /**
   * Handle Accurate API errors
   */
  handleAccurateError(error: any): { code: string; message: string; retryable: boolean } {
    const errorCode = error.errorCode || error.code;
    const errorMessage = error.errorMessage || error.message || 'Unknown Accurate API error';

    // Map common Accurate error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      '401': { message: 'Session expired or invalid credentials', retryable: false },
      '403': { message: 'Access denied - insufficient permissions', retryable: false },
      '404': { message: 'Resource not found', retryable: false },
      '429': { message: 'Rate limit exceeded', retryable: true },
      '500': { message: 'Internal server error', retryable: true },
      '503': { message: 'Service temporarily unavailable', retryable: true },
      'INVALID_SESSION': { message: 'Session invalid or expired', retryable: false },
      'DATABASE_NOT_FOUND': { message: 'Database not found or access denied', retryable: false },
      'DUPLICATE_DATA': { message: 'Duplicate data detected', retryable: false },
      'VALIDATION_ERROR': { message: 'Data validation failed', retryable: false },
      'INSUFFICIENT_BALANCE': { message: 'Insufficient account balance', retryable: false },
    };

    const mappedError = errorMap[errorCode];
    
    return {
      code: errorCode || 'ACCURATE_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }
}