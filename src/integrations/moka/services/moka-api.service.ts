import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseApiService, ApiConfig, ApiRequest, ApiResponse } from '../../common/services/base-api.service';
import { HttpService } from '@nestjs/axios';

export interface MokaCredentials {
  appId: string;
  secretKey: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  redirectUri: string;
  isSandbox?: boolean;
}

export interface MokaApiRequest extends Omit<ApiRequest, 'headers'> {
  outletId?: string;
  requiresAuth?: boolean;
  requiresOAuth?: boolean;
}

export interface MokaProduct {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
  category_name?: string;
  description?: string;
  price: number;
  cost: number;
  stock_quantity: number;
  unit: string;
  barcode?: string;
  image_url?: string;
  is_active: boolean;
  track_stock: boolean;
  allow_out_of_stock: boolean;
  created_at: string;
  updated_at: string;
  variants?: MokaProductVariant[];
}

export interface MokaProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock_quantity: number;
  barcode?: string;
  is_active: boolean;
}

export interface MokaCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MokaSale {
  id: string;
  receipt_number: string;
  sale_date: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  net_amount: number;
  payment_method: string;
  status: 'completed' | 'cancelled' | 'pending';
  customer_id?: string;
  customer_name?: string;
  cashier_id: string;
  cashier_name: string;
  items: MokaSaleItem[];
  payments: MokaPayment[];
  created_at: string;
  updated_at: string;
}

export interface MokaSaleItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount_amount: number;
  tax_amount: number;
}

export interface MokaPayment {
  id: string;
  payment_method: string;
  amount: number;
  reference_number?: string;
  card_type?: string;
  bank_name?: string;
}

export interface MokaInventoryUpdate {
  product_id: string;
  variant_id?: string;
  stock_quantity: number;
  reason?: string;
  notes?: string;
}

@Injectable()
export class MokaApiService extends BaseApiService {
  private readonly logger = new Logger(MokaApiService.name);
  
  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  /**
   * Get Moka API configuration
   */
  private getApiConfig(credentials: MokaCredentials): ApiConfig {
    const baseUrl = credentials.isSandbox 
      ? 'https://api-sandbox.mokapos.com'
      : 'https://api.mokapos.com';

    return {
      baseUrl,
      apiVersion: '', // Moka doesn't use versioned URLs
      timeout: 30000,
      rateLimit: {
        requestsPerMinute: 1000, // Updated based on Moka limits
        burstLimit: 100,
      },
      authentication: {
        type: 'oauth',
        credentials: {
          appId: credentials.appId,
          secretKey: credentials.secretKey,
          accessToken: credentials.accessToken,
        },
      },
    };
  }

  /**
   * Make authenticated request to Moka API
   */
  async makeMokaRequest<T = any>(
    credentials: MokaCredentials,
    request: MokaApiRequest,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<T>> {
    const config = this.getApiConfig(credentials);

    // Check if access token is expired and refresh if needed
    if (request.requiresOAuth && this.isTokenExpired(credentials)) {
      await this.refreshAccessToken(credentials, tenantId, channelId);
    }

    const mokaRequest: ApiRequest = {
      ...request,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(request.requiresOAuth && credentials.accessToken 
          ? { 'Authorization': `Bearer ${credentials.accessToken}` }
          : {}),
        ...(request.outletId 
          ? { 'X-Outlet-ID': request.outletId }
          : {}),
        ...request.headers,
      },
    };

    return this.makeRequest<T>(config, mokaRequest, tenantId, channelId);
  }

  /**
   * Test API connection
   */
  async testConnection(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    try {
      // Use store info endpoint for connection test
      const request: MokaApiRequest = {
        method: 'GET',
        endpoint: '/stores/current',
        requiresOAuth: true,
      };

      return await this.makeMokaRequest(
        credentials,
        request,
        tenantId,
        channelId,
      );
    } catch (error) {
      this.logger.error(`Moka connection test failed: ${error.message}`);
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
   * Get store information
   */
  async getStoreInfo(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    timezone: string;
    currency: string;
    tax_rate: number;
    is_active: boolean;
  }>> {
    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: '/stores/current',
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get product list
   */
  async getProducts(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      category_id?: string;
      is_active?: boolean;
    } = {},
  ): Promise<ApiResponse<{
    data: MokaProduct[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }>> {
    const params: Record<string, any> = {
      page: options.page || 1,
      limit: options.limit || 50,
    };

    if (options.search) params.search = options.search;
    if (options.category_id) params.category_id = options.category_id;
    if (options.is_active !== undefined) params.is_active = options.is_active;

    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: '/products',
      params,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get single product
   */
  async getProduct(
    credentials: MokaCredentials,
    productId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<MokaProduct>> {
    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: `/products/${productId}`,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Create product
   */
  async createProduct(
    credentials: MokaCredentials,
    productData: Partial<MokaProduct>,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<MokaProduct>> {
    const request: MokaApiRequest = {
      method: 'POST',
      endpoint: '/products',
      data: productData,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Update product
   */
  async updateProduct(
    credentials: MokaCredentials,
    productId: string,
    productData: Partial<MokaProduct>,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<MokaProduct>> {
    const request: MokaApiRequest = {
      method: 'PUT',
      endpoint: `/products/${productId}`,
      data: productData,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Delete product
   */
  async deleteProduct(
    credentials: MokaCredentials,
    productId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    const request: MokaApiRequest = {
      method: 'DELETE',
      endpoint: `/products/${productId}`,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get categories
   */
  async getCategories(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<MokaCategory[]>> {
    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: '/categories',
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get sales/transactions
   */
  async getSales(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
    options: {
      page?: number;
      limit?: number;
      from_date?: string; // YYYY-MM-DD
      to_date?: string; // YYYY-MM-DD
      status?: string;
    } = {},
  ): Promise<ApiResponse<{
    data: MokaSale[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }>> {
    const params: Record<string, any> = {
      page: options.page || 1,
      limit: options.limit || 50,
    };

    if (options.from_date) params.from_date = options.from_date;
    if (options.to_date) params.to_date = options.to_date;
    if (options.status) params.status = options.status;

    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: '/sales',
      params,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get single sale
   */
  async getSale(
    credentials: MokaCredentials,
    saleId: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<MokaSale>> {
    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: `/sales/${saleId}`,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Update inventory/stock
   */
  async updateInventory(
    credentials: MokaCredentials,
    updates: MokaInventoryUpdate[],
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    const request: MokaApiRequest = {
      method: 'POST',
      endpoint: '/inventory/bulk-update',
      data: { updates },
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Get inventory movements
   */
  async getInventoryMovements(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
    options: {
      page?: number;
      limit?: number;
      from_date?: string;
      to_date?: string;
      product_id?: string;
    } = {},
  ): Promise<ApiResponse<{
    data: Array<{
      id: string;
      product_id: string;
      product_name: string;
      sku: string;
      movement_type: 'sale' | 'adjustment' | 'receiving';
      quantity_change: number;
      quantity_before: number;
      quantity_after: number;
      reason: string;
      notes?: string;
      created_at: string;
      created_by: string;
    }>;
    pagination: any;
  }>> {
    const params: Record<string, any> = {
      page: options.page || 1,
      limit: options.limit || 50,
    };

    if (options.from_date) params.from_date = options.from_date;
    if (options.to_date) params.to_date = options.to_date;
    if (options.product_id) params.product_id = options.product_id;

    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: '/inventory/movements',
      params,
      requiresOAuth: true,
    };

    return this.makeMokaRequest(
      credentials,
      request,
      tenantId,
      channelId,
    );
  }

  /**
   * Handle API errors specific to Moka
   */
  handleMokaError(error: any): { code: string; message: string; retryable: boolean } {
    const errorCode = error.error_code || error.code;
    const errorMessage = error.error_message || error.message || 'Unknown Moka API error';

    // Map common Moka error codes
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      'UNAUTHORIZED': { message: 'Invalid API key or authentication failed', retryable: false },
      'FORBIDDEN': { message: 'Access denied to this resource', retryable: false },
      'NOT_FOUND': { message: 'Resource not found', retryable: false },
      'VALIDATION_ERROR': { message: 'Invalid request data', retryable: false },
      'RATE_LIMIT_EXCEEDED': { message: 'Rate limit exceeded', retryable: true },
      'STORE_NOT_FOUND': { message: 'Store not found or inactive', retryable: false },
      'PRODUCT_NOT_FOUND': { message: 'Product not found', retryable: false },
      'INSUFFICIENT_STOCK': { message: 'Insufficient stock for operation', retryable: false },
      'DUPLICATE_SKU': { message: 'SKU already exists', retryable: false },
      'SERVER_ERROR': { message: 'Internal server error', retryable: true },
      'SERVICE_UNAVAILABLE': { message: 'Service temporarily unavailable', retryable: true },
    };

    const mappedError = errorMap[errorCode];
    
    return {
      code: errorCode || 'MOKA_API_ERROR',
      message: mappedError?.message || errorMessage,
      retryable: mappedError?.retryable ?? false,
    };
  }

  /**
   * Convert Moka product status to our standard status
   */
  mapMokaProductStatus(isActive: boolean): 'active' | 'inactive' {
    return isActive ? 'active' : 'inactive';
  }

  /**
   * Convert our product status to Moka format
   */
  mapToMokaProductStatus(status: string): boolean {
    return status === 'active';
  }

  /**
   * Format Indonesian currency (IDR)
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Validate Indonesian phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    // Indonesian phone numbers: +62xxx or 08xx or 628xx
    const indonesianPhoneRegex = /^(?:\+62|62|0)8[1-9][0-9]{6,9}$/;
    return indonesianPhoneRegex.test(phone.replace(/\s|-/g, ''));
  }

  /**
   * Format phone number for Moka API
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Convert to Indonesian format
    if (cleaned.startsWith('62')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+62${cleaned.substring(1)}`;
    } else {
      return `+62${cleaned}`;
    }
  }

  /**
   * Get Moka payment methods
   */
  getPaymentMethods(): Array<{
    code: string;
    name: string;
    type: 'cash' | 'card' | 'digital' | 'transfer';
    isActive: boolean;
  }> {
    return [
      { code: 'CASH', name: 'Cash', type: 'cash', isActive: true },
      { code: 'DEBIT_CARD', name: 'Debit Card', type: 'card', isActive: true },
      { code: 'CREDIT_CARD', name: 'Credit Card', type: 'card', isActive: true },
      { code: 'QRIS', name: 'QRIS', type: 'digital', isActive: true },
      { code: 'GOPAY', name: 'GoPay', type: 'digital', isActive: true },
      { code: 'OVO', name: 'OVO', type: 'digital', isActive: true },
      { code: 'DANA', name: 'DANA', type: 'digital', isActive: true },
      { code: 'SHOPEEPAY', name: 'ShopeePay', type: 'digital', isActive: true },
      { code: 'BANK_TRANSFER', name: 'Bank Transfer', type: 'transfer', isActive: true },
    ];
  }

  /**
   * Calculate Indonesian tax (PPN)
   */
  calculateTax(amount: number, taxRate: number = 0.11): number {
    return Math.round(amount * taxRate);
  }

  /**
   * Format date for Moka API (YYYY-MM-DD)
   */
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format datetime for Moka API (ISO 8601)
   */
  formatDateTime(date: Date): string {
    return date.toISOString();
  }

  /**
   * Parse Moka datetime to Date object
   */
  parseDateTime(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Check if access token is expired
   */
  private isTokenExpired(credentials: MokaCredentials): boolean {
    if (!credentials.expiresAt) {
      return true; // No expiry date means token should be refreshed
    }
    
    // Check if token expires in next 5 minutes (buffer time)
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    const expiryWithBuffer = new Date(credentials.expiresAt.getTime() - bufferTime);
    
    return new Date() > expiryWithBuffer;
  }

  /**
   * Generate OAuth 2.0 authorization URL for Moka
   */
  generateAuthorizationUrl(
    credentials: MokaCredentials,
    state?: string,
  ): string {
    const baseUrl = credentials.isSandbox 
      ? 'https://api-sandbox.mokapos.com'
      : 'https://api.mokapos.com';
    
    const params = new URLSearchParams({
      client_id: credentials.appId,
      redirect_uri: credentials.redirectUri,
      response_type: 'code',
      scope: 'read_products write_products read_sales read_inventory write_inventory',
    });
    
    if (state) {
      params.append('state', state);
    }
    
    return `${baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    credentials: MokaCredentials,
    authorizationCode: string,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>> {
    const config = this.getApiConfig(credentials);
    
    const request: ApiRequest = {
      method: 'POST',
      endpoint: '/oauth/token',
      data: {
        grant_type: 'authorization_code',
        client_id: credentials.appId,
        client_secret: credentials.secretKey,
        code: authorizationCode,
        redirect_uri: credentials.redirectUri,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    };

    return this.makeRequest<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    }>(config, request, tenantId, channelId);
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    const config = this.getApiConfig(credentials);
    
    const request: ApiRequest = {
      method: 'POST',
      endpoint: '/oauth/token',
      data: {
        grant_type: 'refresh_token',
        client_id: credentials.appId,
        client_secret: credentials.secretKey,
        refresh_token: credentials.refreshToken,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    };

    try {
      const response = await this.makeRequest<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
      }>(config, request, tenantId, channelId);

      if (response.success && response.data) {
        // Update credentials with new tokens
        credentials.accessToken = response.data.access_token;
        if (response.data.refresh_token) {
          credentials.refreshToken = response.data.refresh_token;
        }
        
        // Calculate expiry date
        const expiresIn = response.data.expires_in || 3600; // Default 1 hour
        credentials.expiresAt = new Date(Date.now() + (expiresIn * 1000));
        
        this.logger.log(`Successfully refreshed Moka access token for channel ${channelId}`);
      } else {
        throw new Error(`Token refresh failed: ${response.error?.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to refresh Moka access token: ${error.message}`);
      throw new Error('Token refresh failed - re-authentication required');
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<any>> {
    if (!credentials.accessToken) {
      return {
        success: true,
        data: { message: 'No token to revoke' },
        metadata: {
          requestId: 'revoke_token',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }

    const config = this.getApiConfig(credentials);
    
    const request: ApiRequest = {
      method: 'POST',
      endpoint: '/oauth/revoke',
      data: {
        token: credentials.accessToken,
        client_id: credentials.appId,
        client_secret: credentials.secretKey,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
    };

    return this.makeRequest<any>(config, request, tenantId, channelId);
  }

  /**
   * Validate current access token
   */
  async validateToken(
    credentials: MokaCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<ApiResponse<{
    valid: boolean;
    expires_at?: string;
    scopes?: string[];
  }>> {
    if (!credentials.accessToken) {
      return {
        success: false,
        error: {
          code: 'NO_ACCESS_TOKEN',
          message: 'No access token available',
        },
        metadata: {
          requestId: 'validate_token',
          timestamp: new Date(),
          duration: 0,
        },
      };
    }

    const request: MokaApiRequest = {
      method: 'GET',
      endpoint: '/oauth/token/info',
      requiresOAuth: true,
    };

    return this.makeMokaRequest<{
      valid: boolean;
      expires_at?: string;
      scopes?: string[];
    }>(credentials, request, tenantId, channelId);
  }
}