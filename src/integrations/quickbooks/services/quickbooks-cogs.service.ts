import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuickBooksApiService, QuickBooksCredentials } from './quickbooks-api.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { AccountingAccount } from '../../entities/accounting-account.entity';
import { Product } from '../../../products/entities/product.entity';
import { InventoryTransaction } from '../../../inventory/entities/inventory-transaction.entity';
import { Order } from '../../../orders/entities/order.entity';

export interface COGSEntry {
  transactionId: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  transactionDate: Date;
  transactionType: 'sale' | 'adjustment' | 'transfer' | 'return';
  orderId?: string;
  customerId?: string;
  locationId?: string;
  notes?: string;
}

export interface COGSJournalEntry {
  txnDate: string;
  privateNote: string;
  line: Array<{
    id?: string;
    description: string;
    amount: number;
    detailType: 'JournalEntryLineDetail';
    journalEntryLineDetail: {
      postingType: 'Debit' | 'Credit';
      accountRef: {
        value: string;
        name?: string;
      };
      entity?: {
        entityRef: {
          value: string;
          name?: string;
        };
        type: 'Customer' | 'Vendor' | 'Employee';
      };
      classRef?: {
        value: string;
        name?: string;
      };
      departmentRef?: {
        value: string;
        name?: string;
      };
    };
  }>;
}

export interface COGSConfiguration {
  cogsAccountId: string;
  inventoryAssetAccountId: string;
  defaultClassId?: string;
  defaultDepartmentId?: string;
  enableAutoPosting: boolean;
  postingFrequency: 'real_time' | 'daily' | 'weekly' | 'monthly';
  costingMethod: 'fifo' | 'lifo' | 'average' | 'specific';
  includeAdjustments: boolean;
  includeTransfers: boolean;
  includeReturns: boolean;
}

export interface COGSReport {
  periodStart: Date;
  periodEnd: Date;
  totalCOGS: number;
  entriesCount: number;
  byProduct: Array<{
    productId: string;
    productName: string;
    sku?: string;
    quantitySold: number;
    totalCost: number;
    averageCost: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    totalCost: number;
    percentage: number;
  }>;
  byLocation: Array<{
    locationId: string;
    locationName: string;
    totalCost: number;
    percentage: number;
  }>;
}

@Injectable()
export class QuickBooksCOGSService {
  private readonly logger = new Logger(QuickBooksCOGSService.name);

  constructor(
    private readonly quickBooksApiService: QuickBooksApiService,
    private readonly integrationLogService: IntegrationLogService,
    @InjectRepository(AccountingAccount)
    private readonly accountingAccountRepository: Repository<AccountingAccount>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Calculate and post COGS entries to QuickBooks
   */
  async calculateAndPostCOGS(
    accountingAccountId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
    config: COGSConfiguration,
  ): Promise<{
    success: boolean;
    entriesPosted: number;
    totalCOGS: number;
    errors: string[];
  }> {
    try {
      this.logger.log(`Calculating COGS for period ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get accounting account with credentials
      const accountingAccount = await this.accountingAccountRepository.findOne({
        where: { id: accountingAccountId, tenantId },
      });

      if (!accountingAccount) {
        throw new Error('Accounting account not found');
      }

      const credentials: QuickBooksCredentials = {
        clientId: accountingAccount.clientId!,
        clientSecret: accountingAccount.clientSecret!,
        accessToken: accountingAccount.accessToken!,
        refreshToken: accountingAccount.refreshToken!,
        realmId: accountingAccount.platformConfig?.realmId!,
        environment: accountingAccount.platformConfig?.environment || 'production',
        expiresAt: accountingAccount.tokenExpiresAt,
      };

      // Calculate COGS entries
      const cogsEntries = await this.calculateCOGSEntries(tenantId, startDate, endDate, config);
      
      this.logger.log(`Found ${cogsEntries.length} COGS entries to post`);

      // Group entries by date for journal entry posting
      const entriesByDate = this.groupEntriesByDate(cogsEntries);
      
      let entriesPosted = 0;
      let totalCOGS = 0;
      const errors: string[] = [];

      // Post journal entries to QuickBooks
      for (const [date, entries] of entriesByDate) {
        try {
          const journalEntry = this.createCOGSJournalEntry(entries, config, date);
          const dayTotal = entries.reduce((sum, entry) => sum + entry.totalCost, 0);
          
          const response = await this.quickBooksApiService.makeQuickBooksRequest(
            credentials,
            {
              method: 'POST',
              endpoint: '/journalentries',
              data: { JournalEntry: journalEntry },
              requiresAuth: true,
            },
            tenantId,
            accountingAccount.channelId!,
          );

          if (response.success) {
            entriesPosted += entries.length;
            totalCOGS += dayTotal;
            this.logger.debug(`Posted COGS journal entry for ${date}: $${dayTotal.toFixed(2)}`);
          } else {
            const error = `Failed to post COGS for ${date}: ${response.error?.message}`;
            errors.push(error);
            this.logger.error(error);
          }
        } catch (error) {
          const errorMsg = `Error posting COGS for ${date}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      this.logger.log(`COGS posting completed: ${entriesPosted} entries, total $${totalCOGS.toFixed(2)}`);

      return {
        success: errors.length === 0,
        entriesPosted,
        totalCOGS,
        errors,
      };

    } catch (error) {
      this.logger.error(`COGS calculation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate COGS entries from inventory transactions
   */
  async calculateCOGSEntries(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    config: COGSConfiguration,
  ): Promise<COGSEntry[]> {
    const queryBuilder = this.inventoryTransactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.product', 'product')
      .leftJoinAndSelect('transaction.location', 'location')
      .leftJoinAndSelect('transaction.order', 'order')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.transactionDate >= :startDate', { startDate })
      .andWhere('transaction.transactionDate <= :endDate', { endDate })
      .andWhere('transaction.isDeleted = :isDeleted', { isDeleted: false });

    // Filter by transaction types that affect COGS
    const cogsTransactionTypes = ['sale', 'order_fulfillment'];
    
    if (config.includeAdjustments) {
      cogsTransactionTypes.push('adjustment_out');
    }
    
    if (config.includeTransfers) {
      cogsTransactionTypes.push('transfer_out');
    }
    
    if (config.includeReturns) {
      cogsTransactionTypes.push('return_to_vendor');
    }

    queryBuilder.andWhere('transaction.type IN (:...types)', { types: cogsTransactionTypes });

    // Only negative quantity transactions (outbound) affect COGS
    queryBuilder.andWhere('transaction.quantity < 0');

    const transactions = await queryBuilder.getMany();

    const cogsEntries: COGSEntry[] = [];

    for (const transaction of transactions) {
      const unitCost = await this.calculateUnitCost(
        transaction.productId,
        transaction.transactionDate,
        config.costingMethod,
        tenantId,
      );

      const entry: COGSEntry = {
        transactionId: transaction.id,
        productId: transaction.productId,
        productName: transaction.product?.name || 'Unknown Product',
        sku: transaction.product?.sku,
        quantity: Math.abs(transaction.quantity), // Convert to positive for COGS
        unitCost,
        totalCost: Math.abs(transaction.quantity) * unitCost,
        transactionDate: transaction.transactionDate,
        transactionType: this.mapTransactionTypeToCOGSType(transaction.type),
        orderId: transaction.orderId,
        locationId: transaction.locationId,
        notes: transaction.notes,
      };

      // Get customer ID from order if available
      if (transaction.order?.customerId) {
        entry.customerId = transaction.order.customerId;
      }

      cogsEntries.push(entry);
    }

    return cogsEntries;
  }

  /**
   * Calculate unit cost based on costing method
   */
  private async calculateUnitCost(
    productId: string,
    asOfDate: Date,
    costingMethod: COGSConfiguration['costingMethod'],
    tenantId: string,
  ): Promise<number> {
    switch (costingMethod) {
      case 'average':
        return this.calculateAverageCost(productId, asOfDate, tenantId);
      case 'fifo':
        return this.calculateFIFOCost(productId, asOfDate, tenantId);
      case 'lifo':
        return this.calculateLIFOCost(productId, asOfDate, tenantId);
      case 'specific':
        return this.calculateSpecificCost(productId, asOfDate, tenantId);
      default:
        return this.calculateAverageCost(productId, asOfDate, tenantId);
    }
  }

  /**
   * Calculate average cost method
   */
  private async calculateAverageCost(
    productId: string,
    asOfDate: Date,
    tenantId: string,
  ): Promise<number> {
    const result = await this.inventoryTransactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.quantity * transaction.unitCost) / SUM(transaction.quantity)', 'averageCost')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.transactionDate <= :asOfDate', { asOfDate })
      .andWhere('transaction.quantity > 0') // Only inbound transactions for cost basis
      .andWhere('transaction.isDeleted = :isDeleted', { isDeleted: false })
      .getRawOne();

    return parseFloat(result?.averageCost) || 0;
  }

  /**
   * Calculate FIFO cost method
   */
  private async calculateFIFOCost(
    productId: string,
    asOfDate: Date,
    tenantId: string,
  ): Promise<number> {
    // Get the oldest available inventory
    const transaction = await this.inventoryTransactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.transactionDate <= :asOfDate', { asOfDate })
      .andWhere('transaction.quantity > 0') // Only inbound transactions
      .andWhere('transaction.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('transaction.transactionDate', 'ASC')
      .getOne();

    return transaction?.unitCost || 0;
  }

  /**
   * Calculate LIFO cost method
   */
  private async calculateLIFOCost(
    productId: string,
    asOfDate: Date,
    tenantId: string,
  ): Promise<number> {
    // Get the newest available inventory
    const transaction = await this.inventoryTransactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.tenantId = :tenantId', { tenantId })
      .andWhere('transaction.productId = :productId', { productId })
      .andWhere('transaction.transactionDate <= :asOfDate', { asOfDate })
      .andWhere('transaction.quantity > 0') // Only inbound transactions
      .andWhere('transaction.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('transaction.transactionDate', 'DESC')
      .getOne();

    return transaction?.unitCost || 0;
  }

  /**
   * Calculate specific identification cost method
   */
  private async calculateSpecificCost(
    productId: string,
    asOfDate: Date,
    tenantId: string,
  ): Promise<number> {
    // For specific identification, we'd need lot/serial number tracking
    // For now, fall back to average cost
    return this.calculateAverageCost(productId, asOfDate, tenantId);
  }

  /**
   * Group COGS entries by date for journal entry posting
   */
  private groupEntriesByDate(entries: COGSEntry[]): Map<string, COGSEntry[]> {
    const grouped = new Map<string, COGSEntry[]>();

    for (const entry of entries) {
      const dateKey = entry.transactionDate.toISOString().split('T')[0];
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      
      grouped.get(dateKey)!.push(entry);
    }

    return grouped;
  }

  /**
   * Create QuickBooks journal entry for COGS
   */
  private createCOGSJournalEntry(
    entries: COGSEntry[],
    config: COGSConfiguration,
    date: string,
  ): COGSJournalEntry {
    const totalCOGS = entries.reduce((sum, entry) => sum + entry.totalCost, 0);
    
    const journalEntry: COGSJournalEntry = {
      txnDate: date,
      privateNote: `COGS entry for ${entries.length} transactions on ${date}`,
      line: [
        // Debit COGS account
        {
          description: `Cost of Goods Sold - ${date}`,
          amount: totalCOGS,
          detailType: 'JournalEntryLineDetail',
          journalEntryLineDetail: {
            postingType: 'Debit',
            accountRef: {
              value: config.cogsAccountId,
            },
            classRef: config.defaultClassId ? {
              value: config.defaultClassId,
            } : undefined,
            departmentRef: config.defaultDepartmentId ? {
              value: config.defaultDepartmentId,
            } : undefined,
          },
        },
        // Credit Inventory Asset account
        {
          description: `Inventory reduction - ${date}`,
          amount: totalCOGS,
          detailType: 'JournalEntryLineDetail',
          journalEntryLineDetail: {
            postingType: 'Credit',
            accountRef: {
              value: config.inventoryAssetAccountId,
            },
            classRef: config.defaultClassId ? {
              value: config.defaultClassId,
            } : undefined,
            departmentRef: config.defaultDepartmentId ? {
              value: config.defaultDepartmentId,
            } : undefined,
          },
        },
      ],
    };

    return journalEntry;
  }

  /**
   * Map inventory transaction type to COGS type
   */
  private mapTransactionTypeToCOGSType(transactionType: string): COGSEntry['transactionType'] {
    const mapping: Record<string, COGSEntry['transactionType']> = {
      sale: 'sale',
      order_fulfillment: 'sale',
      adjustment_out: 'adjustment',
      transfer_out: 'transfer',
      return_to_vendor: 'return',
    };

    return mapping[transactionType] || 'sale';
  }

  /**
   * Generate COGS report
   */
  async generateCOGSReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    config: COGSConfiguration,
  ): Promise<COGSReport> {
    const entries = await this.calculateCOGSEntries(tenantId, startDate, endDate, config);
    
    const totalCOGS = entries.reduce((sum, entry) => sum + entry.totalCost, 0);
    
    // Group by product
    const byProduct = new Map<string, {
      productId: string;
      productName: string;
      sku?: string;
      quantitySold: number;
      totalCost: number;
    }>();

    for (const entry of entries) {
      const key = entry.productId;
      const existing = byProduct.get(key);
      
      if (existing) {
        existing.quantitySold += entry.quantity;
        existing.totalCost += entry.totalCost;
      } else {
        byProduct.set(key, {
          productId: entry.productId,
          productName: entry.productName,
          sku: entry.sku,
          quantitySold: entry.quantity,
          totalCost: entry.totalCost,
        });
      }
    }

    const byProductArray = Array.from(byProduct.values()).map(item => ({
      ...item,
      averageCost: item.quantitySold > 0 ? item.totalCost / item.quantitySold : 0,
    }));

    // For location grouping, we'd need location data
    const byLocation: COGSReport['byLocation'] = [];

    // For category grouping, we'd need to load product categories
    const byCategory: COGSReport['byCategory'] = [];

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalCOGS,
      entriesCount: entries.length,
      byProduct: byProductArray,
      byCategory,
      byLocation,
    };
  }

  /**
   * Verify COGS accuracy against QuickBooks
   */
  async verifyCOGSAccuracy(
    accountingAccountId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    localCOGS: number;
    quickBooksCOGS: number;
    variance: number;
    variancePercent: number;
    isAccurate: boolean;
  }> {
    // Calculate local COGS
    const config: COGSConfiguration = {
      cogsAccountId: '', // Not needed for local calculation
      inventoryAssetAccountId: '',
      enableAutoPosting: false,
      postingFrequency: 'daily',
      costingMethod: 'average',
      includeAdjustments: true,
      includeTransfers: true,
      includeReturns: true,
    };

    const entries = await this.calculateCOGSEntries(tenantId, startDate, endDate, config);
    const localCOGS = entries.reduce((sum, entry) => sum + entry.totalCost, 0);

    // Get QuickBooks COGS from P&L report
    const accountingAccount = await this.accountingAccountRepository.findOne({
      where: { id: accountingAccountId, tenantId },
    });

    if (!accountingAccount) {
      throw new Error('Accounting account not found');
    }

    const credentials: QuickBooksCredentials = {
      clientId: accountingAccount.clientId!,
      clientSecret: accountingAccount.clientSecret!,
      accessToken: accountingAccount.accessToken!,
      refreshToken: accountingAccount.refreshToken!,
      realmId: accountingAccount.platformConfig?.realmId!,
      environment: accountingAccount.platformConfig?.environment || 'production',
      expiresAt: accountingAccount.tokenExpiresAt,
    };

    // This would require implementing a P&L report API call
    // For now, we'll return a placeholder
    const quickBooksCOGS = 0; // TODO: Implement P&L report retrieval
    
    const variance = localCOGS - quickBooksCOGS;
    const variancePercent = quickBooksCOGS > 0 ? (variance / quickBooksCOGS) * 100 : 0;
    const isAccurate = Math.abs(variancePercent) <= 5; // 5% tolerance

    return {
      localCOGS,
      quickBooksCOGS,
      variance,
      variancePercent,
      isAccurate,
    };
  }
}