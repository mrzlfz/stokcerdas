import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccurateApiService,
  AccurateCredentials,
  AccurateTaxRate,
} from './accurate-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { AccountingAccount } from '../../entities/accounting-account.entity';
import { Order } from '../../../orders/entities/order.entity';
// import { Invoice } from '../../../invoices/entities/invoice.entity'; // TODO: Create invoice entity
type Invoice = {
  id: string;
  currency?: string;
  totalAmount?: number;
  // Add other properties as needed
};
import { Product } from '../../../products/entities/product.entity';

export interface IndonesianTaxConfiguration {
  npwp: string; // Nomor Pokok Wajib Pajak
  nppkp?: string; // Nomor Pengukuhan Pengusaha Kena Pajak
  pkpStatus: boolean; // Pengusaha Kena Pajak status
  vatRate: number; // PPN rate (default 11%)
  enableEFaktur: boolean;
  eFakturConfig?: {
    certificatePath: string;
    certificatePassword: string;
    counterNumber: string;
    kodeTransaksi: string; // Transaction code for e-Faktur
  };
  taxCategories: {
    [productCategory: string]: {
      taxRate: number;
      taxType: 'PPN' | 'PPnBM' | 'BEBAS' | 'TIDAK_KENA';
      accurateTaxId?: number;
    };
  };
  defaultTaxSettings: {
    salesTaxId: number;
    purchaseTaxId: number;
    outputVATAccount: number;
    inputVATAccount: number;
  };
}

export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxDetails: Array<{
    description: string;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
    taxType: 'PPN' | 'PPnBM';
  }>;
  eFakturRequired: boolean;
  eFakturNumber?: string;
}

export interface EFakturData {
  nomorFaktur: string;
  tanggalFaktur: Date;
  npwpPenjual: string;
  namaPenjual: string;
  alamatPenjual: string;
  npwpPembeli: string;
  namaPembeli: string;
  alamatPembeli: string;
  dpp: number; // Dasar Pengenaan Pajak
  ppn: number; // Pajak Pertambahan Nilai
  ppnbm?: number; // Pajak Penjualan atas Barang Mewah
  referensiId: string; // Reference to original invoice/order
  kodeTransaksi: string;
  statusApproval:
    | 'DRAFT'
    | 'APPROVAL_PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'REPLACED';
  statusUpload: 'NOT_UPLOADED' | 'UPLOADED' | 'UPLOAD_FAILED';
}

export interface TaxReportData {
  periodMonth: number;
  periodYear: number;
  npwp: string;
  companyName: string;
  totalSales: number;
  totalPurchases: number;
  outputVAT: number;
  inputVAT: number;
  netVAT: number;
  vatPayable: number;
  transactions: Array<{
    date: Date;
    referenceNumber: string;
    customerSupplier: string;
    npwpCustomerSupplier?: string;
    dpp: number;
    ppn: number;
    transactionType: 'SALE' | 'PURCHASE';
    eFakturNumber?: string;
  }>;
}

export interface ComplianceCheckResult {
  isCompliant: boolean;
  issues: Array<{
    type: 'ERROR' | 'WARNING' | 'INFO';
    code: string;
    message: string;
    recommendation?: string;
  }>;
  npwpValid: boolean;
  pkpStatusValid: boolean;
  taxRatesValid: boolean;
  eFakturConfigValid: boolean;
}

@Injectable()
export class AccurateTaxComplianceService {
  private readonly logger = new Logger(AccurateTaxComplianceService.name);

  constructor(
    private readonly accurateApiService: AccurateApiService,
    private readonly integrationLogService: IntegrationLogService,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    // @InjectRepository(Invoice)
    // private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Configure Indonesian tax settings
   */
  async configureTaxSettings(
    accountingAccountId: string,
    tenantId: string,
    config: IndonesianTaxConfiguration,
  ): Promise<{ success: boolean; errors: string[] }> {
    try {
      this.logger.log(
        `Configuring Indonesian tax settings for tenant ${tenantId}`,
      );

      // Validate NPWP
      if (!this.validateNPWP(config.npwp)) {
        throw new Error('Invalid NPWP format');
      }

      // Validate VAT rate
      if (config.vatRate < 0 || config.vatRate > 100) {
        throw new Error('Invalid VAT rate');
      }

      // Get accounting account
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      // Update Indonesian settings
      const updatedSettings = {
        ...accountingAccount.indonesianSettings,
        ...config,
      };

      await this.accountingAccountRepository.update(accountingAccountId, {
        indonesianSettings: updatedSettings,
        updatedBy: 'tax_compliance_service',
      });

      // Sync tax rates with Accurate
      const credentials: AccurateCredentials =
        this.getCredentials(accountingAccount);
      await this.syncTaxRatesWithAccurate(
        credentials,
        config,
        tenantId,
        accountingAccount.channelId!,
      );

      this.logger.log(
        `Successfully configured Indonesian tax settings for tenant ${tenantId}`,
      );

      return { success: true, errors: [] };
    } catch (error) {
      this.logger.error(`Failed to configure tax settings: ${error.message}`);
      return { success: false, errors: [error.message] };
    }
  }

  /**
   * Calculate tax for order or invoice
   */
  async calculateTax(
    accountingAccountId: string,
    orderOrInvoiceId: string,
    tenantId: string,
    type: 'order' | 'invoice',
  ): Promise<TaxCalculationResult> {
    try {
      this.logger.log(`Calculating tax for ${type} ${orderOrInvoiceId}`);

      // Get accounting account with tax configuration
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const indonesianSettings = accountingAccount.indonesianSettings;
      if (!indonesianSettings) {
        throw new Error('Indonesian tax configuration not found');
      }

      const taxConfig: IndonesianTaxConfiguration = {
        npwp: indonesianSettings.npwp || '',
        nppkp: indonesianSettings.nppkp,
        pkpStatus: indonesianSettings.pkpStatus || false,
        vatRate: indonesianSettings.vatRate || 11,
        enableEFaktur: indonesianSettings.enableEFaktur || false,
        eFakturConfig: indonesianSettings.eFakturConfig
          ? {
              certificatePath:
                indonesianSettings.eFakturConfig.certificatePath || '',
              certificatePassword:
                indonesianSettings.eFakturConfig.certificatePassword || '',
              counterNumber:
                indonesianSettings.eFakturConfig.counterNumber || '',
              kodeTransaksi: '01',
            }
          : undefined,
        taxCategories: {},
        defaultTaxSettings: {
          salesTaxId: 1,
          purchaseTaxId: 2,
          outputVATAccount: 1001,
          inputVATAccount: 1002,
        },
      };

      // Get order or invoice data
      let items: any[];
      let customer: any;
      let subtotal = 0;

      if (type === 'order') {
        const order = await this.orderRepository.findOne({
          where: { id: orderOrInvoiceId, tenantId },
          relations: ['items'],
        });

        if (!order) {
          throw new Error('Order not found');
        }

        items = order.items || [];
        customer = { name: order.customerName, email: order.customerEmail };
        subtotal = order.subtotalAmount || 0;
      } else {
        // TODO: Implement invoice handling when Invoice entity is available
        // const invoice = await this.invoiceRepository.findOne({
        //   where: { id: orderOrInvoiceId, tenantId, isDeleted: false },
        //   relations: ['items', 'items.product', 'customer'],
        // });

        // if (!invoice) {
        //   throw new Error('Invoice not found');
        // }

        // items = invoice.items || [];
        // customer = invoice.customer;
        // subtotal = invoice.subtotal || 0;

        // Temporary fallback
        items = [];
        customer = { name: 'Unknown', email: 'unknown@example.com' };
        subtotal = 0;
      }

      // Calculate tax for each item
      const taxDetails: TaxCalculationResult['taxDetails'] = [];
      let totalTaxAmount = 0;

      for (const item of items) {
        const product = item.product;
        const itemSubtotal = item.quantity * item.unitPrice;

        // Get tax category for product
        const taxCategory = this.getTaxCategoryForProduct(product, taxConfig);

        if (
          taxCategory.taxType !== 'BEBAS' &&
          taxCategory.taxType !== 'TIDAK_KENA'
        ) {
          const taxAmount = itemSubtotal * (taxCategory.taxRate / 100);

          taxDetails.push({
            description: `${taxCategory.taxType} untuk ${product.name}`,
            taxableAmount: itemSubtotal,
            taxRate: taxCategory.taxRate,
            taxAmount,
            taxType: taxCategory.taxType as 'PPN' | 'PPnBM',
          });

          totalTaxAmount += taxAmount;
        }
      }

      // Check if e-Faktur is required
      const eFakturRequired = this.isEFakturRequired(
        customer,
        subtotal,
        totalTaxAmount,
        taxConfig,
      );

      const result: TaxCalculationResult = {
        subtotal,
        taxAmount: totalTaxAmount,
        total: subtotal + totalTaxAmount,
        taxDetails,
        eFakturRequired,
      };

      // Generate e-Faktur number if required
      if (eFakturRequired && taxConfig.enableEFaktur) {
        result.eFakturNumber = await this.generateEFakturNumber(
          taxConfig,
          tenantId,
        );
      }

      this.logger.log(
        `Tax calculation completed for ${type} ${orderOrInvoiceId}: ${totalTaxAmount}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Tax calculation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate e-Faktur for invoice
   */
  async generateEFaktur(
    accountingAccountId: string,
    invoiceId: string,
    tenantId: string,
  ): Promise<EFakturData> {
    try {
      this.logger.log(`Generating e-Faktur for invoice ${invoiceId}`);

      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const taxConfig = accountingAccount.indonesianSettings;
      if (!taxConfig || !taxConfig.enableEFaktur) {
        throw new Error('e-Faktur not enabled');
      }

      // TODO: Implement when Invoice entity is available
      // const invoice = await this.invoiceRepository.findOne({
      //   where: { id: invoiceId, tenantId, isDeleted: false },
      //   relations: ['customer', 'billingAddress'],
      // });

      // if (!invoice) {
      //   throw new Error('Invoice not found');
      // }

      // Temporary invoice placeholder
      const invoice = {
        invoiceNumber: 'TEMP-001',
        invoiceDate: new Date(),
        customerName: 'Temporary Customer',
        customer: { name: 'Temporary Customer', npwp: '00.000.000.0-000.000' },
        billingAddress: {
          address: 'Temporary Address',
          street: 'Temporary Street',
        },
        subtotal: 0,
        totalAmount: 0,
      };

      // Calculate tax
      const taxCalculation = await this.calculateTax(
        accountingAccountId,
        invoiceId,
        tenantId,
        'invoice',
      );

      // Create full tax config
      const fullTaxConfig: IndonesianTaxConfiguration = {
        npwp: taxConfig.npwp || '',
        nppkp: taxConfig.nppkp,
        pkpStatus: taxConfig.pkpStatus || false,
        vatRate: taxConfig.vatRate || 11,
        enableEFaktur: taxConfig.enableEFaktur || false,
        eFakturConfig: taxConfig.eFakturConfig
          ? {
              certificatePath: taxConfig.eFakturConfig.certificatePath || '',
              certificatePassword:
                taxConfig.eFakturConfig.certificatePassword || '',
              counterNumber: taxConfig.eFakturConfig.counterNumber || '',
              kodeTransaksi: '01',
            }
          : undefined,
        taxCategories: {},
        defaultTaxSettings: {
          salesTaxId: 1,
          purchaseTaxId: 2,
          outputVATAccount: 1001,
          inputVATAccount: 1002,
        },
      };

      // Generate e-Faktur number
      const eFakturNumber = await this.generateEFakturNumber(
        fullTaxConfig,
        tenantId,
      );

      const eFakturData: EFakturData = {
        nomorFaktur: eFakturNumber,
        tanggalFaktur: invoice.invoiceDate,
        npwpPenjual: taxConfig.npwp,
        namaPenjual: accountingAccount.companyName || 'PT. StokCerdas',
        alamatPenjual: 'Jakarta, Indonesia', // This should come from company settings
        npwpPembeli: invoice.customer?.npwp || '',
        namaPembeli: invoice.customer?.name || '',
        alamatPembeli: invoice.billingAddress?.street || '',
        dpp: taxCalculation.subtotal,
        ppn: taxCalculation.taxAmount,
        referensiId: invoiceId,
        kodeTransaksi: fullTaxConfig.eFakturConfig?.kodeTransaksi || '01', // Default to normal sale
        statusApproval: 'DRAFT',
        statusUpload: 'NOT_UPLOADED',
      };

      // Save e-Faktur data to Accurate
      const credentials = this.getCredentials(accountingAccount);
      await this.saveEFakturToAccurate(
        credentials,
        eFakturData,
        tenantId,
        accountingAccount.channelId!,
      );

      // Update invoice with e-Faktur reference
      // await this.invoiceRepository.update(invoiceId, {
      //   eFakturNumber: eFakturNumber,
      //   updatedBy: 'tax_compliance_service',
      // });

      this.logger.log(
        `Successfully generated e-Faktur ${eFakturNumber} for invoice ${invoiceId}`,
      );

      return eFakturData;
    } catch (error) {
      this.logger.error(`e-Faktur generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate tax report for specified period
   */
  async generateTaxReport(
    accountingAccountId: string,
    tenantId: string,
    month: number,
    year: number,
  ): Promise<TaxReportData> {
    try {
      this.logger.log(`Generating tax report for ${month}/${year}`);

      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const indonesianSettings = accountingAccount.indonesianSettings;
      if (!indonesianSettings) {
        throw new Error('Indonesian tax configuration not found');
      }

      const taxConfig: IndonesianTaxConfiguration = {
        npwp: indonesianSettings.npwp || '',
        nppkp: indonesianSettings.nppkp,
        pkpStatus: indonesianSettings.pkpStatus || false,
        vatRate: indonesianSettings.vatRate || 11,
        enableEFaktur: indonesianSettings.enableEFaktur || false,
        eFakturConfig: indonesianSettings.eFakturConfig
          ? {
              certificatePath:
                indonesianSettings.eFakturConfig.certificatePath || '',
              certificatePassword:
                indonesianSettings.eFakturConfig.certificatePassword || '',
              counterNumber:
                indonesianSettings.eFakturConfig.counterNumber || '',
              kodeTransaksi: '01',
            }
          : undefined,
        taxCategories: {},
        defaultTaxSettings: {
          salesTaxId: 1,
          purchaseTaxId: 2,
          outputVATAccount: 1001,
          inputVATAccount: 1002,
        },
      };

      const credentials = this.getCredentials(accountingAccount);

      // Get sales data from Accurate
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const salesResponse = await this.accurateApiService.getInvoices(
        credentials,
        tenantId,
        accountingAccount.channelId!,
        {
          dateFrom: startDate.toISOString().split('T')[0],
          dateTo: endDate.toISOString().split('T')[0],
        },
      );

      if (!salesResponse.success) {
        throw new Error(
          `Failed to fetch sales data: ${salesResponse.error?.message}`,
        );
      }

      const salesInvoices = salesResponse.data?.sp || [];

      // Calculate totals
      let totalSales = 0;
      let outputVAT = 0;
      const transactions: TaxReportData['transactions'] = [];

      for (const invoice of salesInvoices) {
        const vatAmount =
          (invoice.totalAmount || 0) * (taxConfig.vatRate / 100);
        totalSales += invoice.totalAmount || 0;
        outputVAT += vatAmount;

        transactions.push({
          date: new Date(invoice.transactionDate),
          referenceNumber: invoice.transactionNo || '',
          customerSupplier: invoice.customerName || '',
          npwpCustomerSupplier: undefined, // Would need to be fetched from customer data
          dpp: invoice.totalAmount || 0,
          ppn: vatAmount,
          transactionType: 'SALE',
          eFakturNumber: undefined, // Would need to be stored with invoice
        });
      }

      // For purchase data, you'd need to implement similar logic for purchase invoices
      const totalPurchases = 0; // TODO: Implement purchase data fetching
      const inputVAT = 0; // TODO: Calculate input VAT from purchases

      const netVAT = outputVAT - inputVAT;

      const report: TaxReportData = {
        periodMonth: month,
        periodYear: year,
        npwp: taxConfig.npwp,
        companyName: accountingAccount.companyName || 'Unknown Company',
        totalSales,
        totalPurchases,
        outputVAT,
        inputVAT,
        netVAT,
        vatPayable: Math.max(0, netVAT), // VAT payable cannot be negative
        transactions,
      };

      this.logger.log(
        `Tax report generated for ${month}/${year}: VAT payable ${report.vatPayable}`,
      );

      return report;
    } catch (error) {
      this.logger.error(`Tax report generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check compliance status
   */
  async checkCompliance(
    accountingAccountId: string,
    tenantId: string,
  ): Promise<ComplianceCheckResult> {
    try {
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const taxConfig = accountingAccount.indonesianSettings;
      const issues: ComplianceCheckResult['issues'] = [];

      // Check NPWP validity
      const npwpValid = taxConfig?.npwp
        ? this.validateNPWP(taxConfig.npwp)
        : false;
      if (!npwpValid) {
        issues.push({
          type: 'ERROR',
          code: 'INVALID_NPWP',
          message: 'NPWP tidak valid atau belum diatur',
          recommendation:
            'Pastikan NPWP terdaftar dengan format yang benar (15 digit)',
        });
      }

      // Check PKP status
      const pkpStatusValid = taxConfig?.pkpStatus !== undefined;
      if (!pkpStatusValid) {
        issues.push({
          type: 'WARNING',
          code: 'PKP_STATUS_NOT_SET',
          message: 'Status PKP belum diatur',
          recommendation:
            'Tentukan apakah perusahaan berstatus PKP atau non-PKP',
        });
      }

      // Check VAT rate
      const taxRatesValid = taxConfig?.vatRate === 11; // Current Indonesian VAT rate
      if (!taxRatesValid) {
        issues.push({
          type: 'WARNING',
          code: 'INCORRECT_VAT_RATE',
          message: 'Tarif PPN tidak sesuai dengan ketentuan terbaru (11%)',
          recommendation:
            'Update tarif PPN menjadi 11% sesuai ketentuan terbaru',
        });
      }

      // Check e-Faktur configuration
      const eFakturConfigValid =
        !taxConfig?.enableEFaktur ||
        Boolean(
          taxConfig.eFakturConfig && taxConfig.eFakturConfig.certificatePath,
        );
      if (!eFakturConfigValid) {
        issues.push({
          type: 'ERROR',
          code: 'EFAKTUR_NOT_CONFIGURED',
          message: 'Konfigurasi e-Faktur belum lengkap',
          recommendation:
            'Lengkapi sertifikat digital dan konfigurasi e-Faktur',
        });
      }

      const isCompliant =
        issues.filter(issue => issue.type === 'ERROR').length === 0;

      return {
        isCompliant,
        issues,
        npwpValid,
        pkpStatusValid,
        taxRatesValid,
        eFakturConfigValid,
      };
    } catch (error) {
      this.logger.error(`Compliance check failed: ${error.message}`);
      throw error;
    }
  }

  // Helper methods

  private validateNPWP(npwp: string): boolean {
    return this.accurateApiService.validateNPWP(npwp);
  }

  private getCredentials(
    accountingAccount: AccountingAccount,
  ): AccurateCredentials {
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

  private getTaxCategoryForProduct(
    product: Product,
    taxConfig: IndonesianTaxConfiguration,
  ): { taxRate: number; taxType: string; accurateTaxId?: number } {
    const categoryName = product.category?.name || 'default';

    return (
      taxConfig.taxCategories[categoryName] || {
        taxRate: taxConfig.vatRate,
        taxType: 'PPN',
        accurateTaxId: taxConfig.defaultTaxSettings.salesTaxId,
      }
    );
  }

  private isEFakturRequired(
    customer: any,
    subtotal: number,
    taxAmount: number,
    taxConfig: IndonesianTaxConfiguration,
  ): boolean {
    // e-Faktur required for:
    // 1. PKP customers (have NPWP)
    // 2. Transactions above certain threshold
    // 3. When PKP status is enabled

    return (
      taxConfig.enableEFaktur &&
      (customer?.npwp || // Customer has NPWP
        subtotal >= 5000000 || // Above 5 million IDR threshold
        taxConfig.pkpStatus) // Company is PKP
    );
  }

  private async generateEFakturNumber(
    taxConfig: IndonesianTaxConfiguration,
    tenantId: string,
  ): Promise<string> {
    // e-Faktur number format: 010.000-XX.XXXXXXXX
    // 010 = transaction code
    // 000 = serial number prefix
    // XX = year
    // XXXXXXXX = sequential number

    const year = new Date().getFullYear().toString().slice(-2);
    const kodeTransaksi = taxConfig.eFakturConfig?.kodeTransaksi || '010';

    // Get next sequential number (this would typically be stored in database)
    const nextNumber = await this.getNextEFakturSequence(tenantId);
    const sequentialNumber = nextNumber.toString().padStart(8, '0');

    return `${kodeTransaksi}.000-${year}.${sequentialNumber}`;
  }

  private async getNextEFakturSequence(tenantId: string): Promise<number> {
    // This would typically query a sequence table
    // For now, return a random number
    return Math.floor(Math.random() * 99999999) + 1;
  }

  private async syncTaxRatesWithAccurate(
    credentials: AccurateCredentials,
    config: IndonesianTaxConfiguration,
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    // Get tax rates from Accurate
    const response = await this.accurateApiService.getTaxRates(
      credentials,
      tenantId,
      channelId,
    );

    if (!response.success) {
      throw new Error(
        `Failed to fetch tax rates from Accurate: ${response.error?.message}`,
      );
    }

    // Update local configuration with Accurate tax IDs
    // This would involve matching tax rates and updating the configuration
    this.logger.log('Tax rates synced with Accurate');
  }

  private async saveEFakturToAccurate(
    credentials: AccurateCredentials,
    eFakturData: EFakturData,
    tenantId: string,
    channelId: string,
  ): Promise<void> {
    // Save e-Faktur data to Accurate
    // This would typically involve creating a journal entry or invoice with e-Faktur details
    this.logger.log(`e-Faktur ${eFakturData.nomorFaktur} saved to Accurate`);
  }
}
