import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccurateApiService, AccurateCredentials } from './accurate-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { AccountingAccount } from '../../entities/accounting-account.entity';
import { Order } from '../../../orders/entities/order.entity';
import { Invoice } from '../../../invoices/entities/invoice.entity';
import { Product } from '../../../products/entities/product.entity';

export interface CurrencyConfiguration {
  baseCurrency: string; // IDR
  enabledCurrencies: string[]; // ['USD', 'EUR', 'SGD', 'MYR']
  autoUpdateRates: boolean;
  updateFrequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
  fallbackProvider: 'accurate' | 'bank_indonesia' | 'yahoo' | 'fixer';
  roundingRules: {
    [currency: string]: {
      decimalPlaces: number;
      roundingMethod: 'round' | 'floor' | 'ceil';
    };
  };
  revaluationSettings: {
    frequency: 'monthly' | 'quarterly' | 'annually';
    accounts: string[]; // Account IDs to revalue
    gainLossAccount: string; // Account for unrealized gains/losses
  };
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
  source: 'accurate' | 'bank_indonesia' | 'manual' | 'api';
  bidRate?: number;
  askRate?: number;
  midRate?: number;
}

export interface CurrencyConversion {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  convertedAmount: number;
  conversionDate: Date;
  source: string;
}

export interface MultiCurrencyTransaction {
  transactionId: string;
  baseCurrencyAmount: number;
  foreignCurrencyAmount: number;
  currency: string;
  exchangeRate: number;
  conversionDate: Date;
  realizationStatus: 'unrealized' | 'realized';
  gainLoss?: number;
  gainLossAccount?: string;
}

export interface CurrencyRevaluationResult {
  revaluationDate: Date;
  baseCurrency: string;
  accounts: Array<{
    accountId: string;
    accountName: string;
    currency: string;
    originalAmount: number;
    revaluedAmount: number;
    unrealizedGainLoss: number;
    exchangeRateUsed: number;
  }>;
  totalUnrealizedGainLoss: number;
  journalEntryPosted: boolean;
  journalEntryId?: string;
}

export interface CurrencyReport {
  reportDate: Date;
  baseCurrency: string;
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    unrealizedGainLoss: number;
    realizedGainLoss: number;
  };
  byCurrency: Array<{
    currency: string;
    currentRate: number;
    assets: number;
    liabilities: number;
    exposure: number;
    unrealizedGainLoss: number;
  }>;
  exchangeRates: ExchangeRate[];
  riskAnalysis: {
    highRiskCurrencies: string[];
    volatilityIndicators: Record<string, number>;
    hedgingRecommendations: string[];
  };
}

@Injectable()
export class AccurateMultiCurrencyService {
  private readonly logger = new Logger(AccurateMultiCurrencyService.name);
  private exchangeRateCache = new Map<string, ExchangeRate>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly accurateApiService: AccurateApiService,
    private readonly integrationLogService: IntegrationLogService,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Configure multi-currency settings
   */
  async configureCurrency(
    accountingAccountId: string,
    tenantId: string,
    config: CurrencyConfiguration,
  ): Promise<{ success: boolean; errors: string[] }> {
    try {
      this.logger.log(`Configuring multi-currency settings for tenant ${tenantId}`);

      // Validate configuration
      const validationErrors = this.validateCurrencyConfiguration(config);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors };
      }

      // Get accounting account
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      // Update currency configuration
      const updatedPlatformConfig = {
        ...accountingAccount.platformConfig,
        currencyConfig: config,
      };

      await this.accountingAccountRepository.update(accountingAccountId, {
        platformConfig: updatedPlatformConfig,
        updatedBy: 'multi_currency_service',
      });

      // Sync currencies with Accurate
      const credentials = this.getCredentials(accountingAccount);
      await this.syncCurrenciesWithAccurate(credentials, config, tenantId, accountingAccount.channelId!);

      // Initialize exchange rates for enabled currencies
      await this.initializeExchangeRates(config, credentials, tenantId, accountingAccount.channelId!);

      this.logger.log(`Successfully configured multi-currency settings for tenant ${tenantId}`);

      return { success: true, errors: [] };

    } catch (error) {
      this.logger.error(`Failed to configure currency settings: ${error.message}`);
      return { success: false, errors: [error.message] };
    }
  }

  /**
   * Get current exchange rate
   */
  async getExchangeRate(
    accountingAccountId: string,
    fromCurrency: string,
    toCurrency: string,
    tenantId: string,
    date?: Date,
  ): Promise<ExchangeRate> {
    try {
      const cacheKey = `${fromCurrency}_${toCurrency}_${date?.toISOString() || 'current'}`;
      
      // Check cache first
      const cached = this.exchangeRateCache.get(cacheKey);
      if (cached && Date.now() - cached.date.getTime() < this.CACHE_TTL) {
        return cached;
      }

      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const credentials = this.getCredentials(accountingAccount);
      
      // Get exchange rate from Accurate
      const response = await this.accurateApiService.getExchangeRates(
        credentials,
        tenantId,
        accountingAccount.channelId!,
        date?.toISOString().split('T')[0],
      );

      if (!response.success) {
        throw new Error(`Failed to fetch exchange rates: ${response.error?.message}`);
      }

      // Find the specific rate
      const rates = response.data || [];
      const rateData = rates.find((r: any) => 
        r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
      );

      if (!rateData) {
        // Try to get rate from fallback provider
        return this.getExchangeRateFromFallback(fromCurrency, toCurrency, date);
      }

      const exchangeRate: ExchangeRate = {
        fromCurrency,
        toCurrency,
        rate: rateData.rate,
        date: date || new Date(),
        source: 'accurate',
        bidRate: rateData.bidRate,
        askRate: rateData.askRate,
        midRate: rateData.midRate,
      };

      // Cache the rate
      this.exchangeRateCache.set(cacheKey, exchangeRate);

      return exchangeRate;

    } catch (error) {
      this.logger.error(`Failed to get exchange rate: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert amount between currencies
   */
  async convertCurrency(
    accountingAccountId: string,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    tenantId: string,
    date?: Date,
  ): Promise<CurrencyConversion> {
    try {
      if (fromCurrency === toCurrency) {
        return {
          amount,
          fromCurrency,
          toCurrency,
          exchangeRate: 1,
          convertedAmount: amount,
          conversionDate: date || new Date(),
          source: 'same_currency',
        };
      }

      const exchangeRate = await this.getExchangeRate(
        accountingAccountId,
        fromCurrency,
        toCurrency,
        tenantId,
        date,
      );

      const convertedAmount = this.applyRoundingRules(
        amount * exchangeRate.rate,
        toCurrency,
        accountingAccountId,
      );

      return {
        amount,
        fromCurrency,
        toCurrency,
        exchangeRate: exchangeRate.rate,
        convertedAmount,
        conversionDate: date || new Date(),
        source: exchangeRate.source,
      };

    } catch (error) {
      this.logger.error(`Currency conversion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create multi-currency invoice in Accurate
   */
  async createMultiCurrencyInvoice(
    accountingAccountId: string,
    invoiceId: string,
    tenantId: string,
    targetCurrency?: string,
  ): Promise<{
    accurateInvoiceId: number;
    originalAmount: number;
    convertedAmount: number;
    exchangeRate: number;
    currency: string;
  }> {
    try {
      this.logger.log(`Creating multi-currency invoice for ${invoiceId}`);

      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const invoice = await this.invoiceRepository.findOne({
        where: { id: invoiceId, tenantId, isDeleted: false },
        relations: ['items', 'items.product', 'customer'],
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const credentials = this.getCredentials(accountingAccount);
      const config = accountingAccount.platformConfig?.currencyConfig as CurrencyConfiguration;
      
      const baseCurrency = config?.baseCurrency || 'IDR';
      const invoiceCurrency = targetCurrency || invoice.currency || baseCurrency;

      // Convert amounts if needed
      let exchangeRate = 1;
      let convertedAmount = invoice.totalAmount;

      if (invoiceCurrency !== baseCurrency) {
        const conversion = await this.convertCurrency(
          accountingAccountId,
          invoice.totalAmount,
          baseCurrency,
          invoiceCurrency,
          tenantId,
        );
        exchangeRate = conversion.exchangeRate;
        convertedAmount = conversion.convertedAmount;
      }

      // Create Accurate invoice with currency
      const accurateInvoice = {
        customerId: await this.getAccurateCustomerId(invoice.customerId!, credentials, tenantId),
        transactionDate: invoice.invoiceDate.toISOString().split('T')[0],
        currencyCode: invoiceCurrency,
        exchangeRate: exchangeRate,
        totalAmount: convertedAmount,
        detailItem: invoice.items?.map(item => ({
          itemId: undefined, // Would need mapping
          itemName: item.product?.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice * exchangeRate,
          amount: item.quantity * item.unitPrice * exchangeRate,
        })) || [],
      };

      const response = await this.accurateApiService.createInvoice(
        credentials,
        accurateInvoice,
        tenantId,
        accountingAccount.channelId!,
      );

      if (!response.success) {
        throw new Error(`Failed to create Accurate invoice: ${response.error?.message}`);
      }

      // Update local invoice with foreign currency info
      await this.invoiceRepository.update(invoiceId, {
        currency: invoiceCurrency,
        exchangeRate: exchangeRate,
        externalInvoiceId: response.data?.id?.toString(),
        updatedBy: 'multi_currency_service',
      });

      this.logger.log(`Multi-currency invoice created: ${response.data?.id}`);

      return {
        accurateInvoiceId: response.data?.id!,
        originalAmount: invoice.totalAmount,
        convertedAmount,
        exchangeRate,
        currency: invoiceCurrency,
      };

    } catch (error) {
      this.logger.error(`Multi-currency invoice creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform currency revaluation
   */
  async performRevaluation(
    accountingAccountId: string,
    tenantId: string,
    revaluationDate?: Date,
  ): Promise<CurrencyRevaluationResult> {
    try {
      const effectiveDate = revaluationDate || new Date();
      this.logger.log(`Performing currency revaluation for ${effectiveDate.toISOString()}`);

      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const credentials = this.getCredentials(accountingAccount);
      const config = accountingAccount.platformConfig?.currencyConfig as CurrencyConfiguration;
      
      if (!config) {
        throw new Error('Multi-currency not configured');
      }

      const baseCurrency = config.baseCurrency;
      const accountsToRevalue = config.revaluationSettings.accounts;

      const result: CurrencyRevaluationResult = {
        revaluationDate: effectiveDate,
        baseCurrency,
        accounts: [],
        totalUnrealizedGainLoss: 0,
        journalEntryPosted: false,
      };

      // Get current exchange rates
      const exchangeRates = new Map<string, number>();
      for (const currency of config.enabledCurrencies) {
        if (currency !== baseCurrency) {
          const rate = await this.getExchangeRate(
            accountingAccountId,
            currency,
            baseCurrency,
            tenantId,
            effectiveDate,
          );
          exchangeRates.set(currency, rate.rate);
        }
      }

      // Revalue each account
      for (const accountId of accountsToRevalue) {
        const accountBalance = await this.getAccountBalance(
          credentials,
          accountId,
          tenantId,
          accountingAccount.channelId!,
        );

        if (accountBalance.currency !== baseCurrency) {
          const currentRate = exchangeRates.get(accountBalance.currency) || 1;
          const revaluedAmount = accountBalance.balance * currentRate;
          const originalAmount = accountBalance.balanceInBaseCurrency || accountBalance.balance;
          const unrealizedGainLoss = revaluedAmount - originalAmount;

          result.accounts.push({
            accountId,
            accountName: accountBalance.accountName,
            currency: accountBalance.currency,
            originalAmount,
            revaluedAmount,
            unrealizedGainLoss,
            exchangeRateUsed: currentRate,
          });

          result.totalUnrealizedGainLoss += unrealizedGainLoss;
        }
      }

      // Post journal entry for unrealized gains/losses
      if (Math.abs(result.totalUnrealizedGainLoss) > 0.01) {
        const journalEntryId = await this.postRevaluationJournalEntry(
          credentials,
          result,
          config,
          tenantId,
          accountingAccount.channelId!,
        );

        result.journalEntryPosted = true;
        result.journalEntryId = journalEntryId;
      }

      this.logger.log(`Currency revaluation completed: ${result.totalUnrealizedGainLoss} unrealized gain/loss`);

      return result;

    } catch (error) {
      this.logger.error(`Currency revaluation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate currency report
   */
  async generateCurrencyReport(
    accountingAccountId: string,
    tenantId: string,
    reportDate?: Date,
  ): Promise<CurrencyReport> {
    try {
      const effectiveDate = reportDate || new Date();
      this.logger.log(`Generating currency report for ${effectiveDate.toISOString()}`);

      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const config = accountingAccount.platformConfig?.currencyConfig as CurrencyConfiguration;
      if (!config) {
        throw new Error('Multi-currency not configured');
      }

      const baseCurrency = config.baseCurrency;
      const credentials = this.getCredentials(accountingAccount);

      // Get current exchange rates
      const exchangeRates: ExchangeRate[] = [];
      const byCurrency: CurrencyReport['byCurrency'] = [];

      for (const currency of config.enabledCurrencies) {
        if (currency !== baseCurrency) {
          const rate = await this.getExchangeRate(
            accountingAccountId,
            currency,
            baseCurrency,
            tenantId,
            effectiveDate,
          );
          exchangeRates.push(rate);

          // Get balances by currency
          const balances = await this.getBalancesByCurrency(
            credentials,
            currency,
            tenantId,
            accountingAccount.channelId!,
          );

          byCurrency.push({
            currency,
            currentRate: rate.rate,
            assets: balances.assets,
            liabilities: balances.liabilities,
            exposure: balances.assets - balances.liabilities,
            unrealizedGainLoss: balances.unrealizedGainLoss,
          });
        }
      }

      // Calculate totals
      const summary = {
        totalAssets: byCurrency.reduce((sum, curr) => sum + curr.assets, 0),
        totalLiabilities: byCurrency.reduce((sum, curr) => sum + curr.liabilities, 0),
        totalEquity: 0, // Would be calculated from accounting data
        unrealizedGainLoss: byCurrency.reduce((sum, curr) => sum + curr.unrealizedGainLoss, 0),
        realizedGainLoss: 0, // Would be calculated from historical transactions
      };

      summary.totalEquity = summary.totalAssets - summary.totalLiabilities;

      // Risk analysis
      const riskAnalysis = this.calculateCurrencyRisk(byCurrency, exchangeRates);

      const report: CurrencyReport = {
        reportDate: effectiveDate,
        baseCurrency,
        summary,
        byCurrency,
        exchangeRates,
        riskAnalysis,
      };

      this.logger.log(`Currency report generated with ${byCurrency.length} currencies`);

      return report;

    } catch (error) {
      this.logger.error(`Currency report generation failed: ${error.message}`);
      throw error;
    }
  }

  // Helper methods

  private validateCurrencyConfiguration(config: CurrencyConfiguration): string[] {
    const errors: string[] = [];

    if (!config.baseCurrency) {
      errors.push('Base currency is required');
    }

    if (!config.enabledCurrencies || config.enabledCurrencies.length === 0) {
      errors.push('At least one enabled currency is required');
    }

    if (config.enabledCurrencies && !config.enabledCurrencies.includes(config.baseCurrency)) {
      errors.push('Base currency must be included in enabled currencies');
    }

    return errors;
  }

  private getCredentials(accountingAccount: AccountingAccount): AccurateCredentials {
    return {
      clientId: accountingAccount.clientId!,
      clientSecret: accountingAccount.clientSecret!,
      accessToken: accountingAccount.accessToken!,
      sessionId: accountingAccount.platformConfig?.sessionId!,
      databaseId: accountingAccount.platformConfig?.databaseId!,
      serverUrl: accountingAccount.apiBaseUrl!,
      environment: 'production',
      expiresAt: accountingAccount.tokenExpiresAt,
    };
  }

  private async syncCurrenciesWithAccurate(
    credentials: AccurateCredentials,
    config: CurrencyConfiguration,
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    // Get currencies from Accurate
    const response = await this.accurateApiService.getCurrencies(
      credentials,
      tenantId,
      channelId,
    );

    if (!response.success) {
      throw new Error(`Failed to sync currencies: ${response.error?.message}`);
    }

    this.logger.log('Currencies synced with Accurate');
  }

  private async initializeExchangeRates(
    config: CurrencyConfiguration,
    credentials: AccurateCredentials,
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    // Initialize exchange rates for all enabled currencies
    for (const currency of config.enabledCurrencies) {
      if (currency !== config.baseCurrency) {
        try {
          await this.getExchangeRate(
            '', // accountingAccountId not needed here
            currency,
            config.baseCurrency,
            tenantId,
          );
        } catch (error) {
          this.logger.warn(`Failed to initialize rate for ${currency}: ${error.message}`);
        }
      }
    }
  }

  private async getExchangeRateFromFallback(
    fromCurrency: string,
    toCurrency: string,
    date?: Date,
  ): Promise<ExchangeRate> {
    // Implementation would depend on chosen fallback provider
    // For now, return a mock rate
    return {
      fromCurrency,
      toCurrency,
      rate: 1,
      date: date || new Date(),
      source: 'fallback',
    };
  }

  private applyRoundingRules(
    amount: number,
    currency: string,
    accountingAccountId: string,
  ): number {
    // Default rounding rules
    const defaultDecimalPlaces = currency === 'IDR' ? 0 : 2;
    return Math.round(amount * Math.pow(10, defaultDecimalPlaces)) / Math.pow(10, defaultDecimalPlaces);
  }

  private async getAccurateCustomerId(
    customerIdLocal: string,
    credentials: AccurateCredentials,
    tenantId: string,
  ): Promise<number> {
    // This would typically involve a mapping lookup
    return 1; // Placeholder
  }

  private async getAccountBalance(
    credentials: AccurateCredentials,
    accountId: string,
    tenantId: string,
    channelId: string,
  ): Promise<{
    balance: number;
    currency: string;
    accountName: string;
    balanceInBaseCurrency?: number;
  }> {
    // Mock implementation
    return {
      balance: 1000,
      currency: 'USD',
      accountName: 'Account Name',
      balanceInBaseCurrency: 15000000,
    };
  }

  private async getBalancesByCurrency(
    credentials: AccurateCredentials,
    currency: string,
    tenantId: string,
    channelId: string,
  ): Promise<{
    assets: number;
    liabilities: number;
    unrealizedGainLoss: number;
  }> {
    // Mock implementation
    return {
      assets: 100000,
      liabilities: 50000,
      unrealizedGainLoss: 5000,
    };
  }

  private async postRevaluationJournalEntry(
    credentials: AccurateCredentials,
    result: CurrencyRevaluationResult,
    config: CurrencyConfiguration,
    tenantId: string,
    channelId: string,
  ): Promise<string> {
    // Post journal entry for revaluation
    // This would create actual journal entries in Accurate
    return 'JE001'; // Mock journal entry ID
  }

  private calculateCurrencyRisk(
    byCurrency: CurrencyReport['byCurrency'],
    exchangeRates: ExchangeRate[],
  ): CurrencyReport['riskAnalysis'] {
    // Calculate volatility and risk metrics
    const highRiskCurrencies = byCurrency
      .filter(curr => Math.abs(curr.exposure) > 100000) // High exposure threshold
      .map(curr => curr.currency);

    const volatilityIndicators: Record<string, number> = {};
    // This would typically calculate historical volatility
    
    const hedgingRecommendations = highRiskCurrencies.map(currency =>
      `Consider hedging exposure to ${currency} due to high volatility`
    );

    return {
      highRiskCurrencies,
      volatilityIndicators,
      hedgingRecommendations,
    };
  }
}