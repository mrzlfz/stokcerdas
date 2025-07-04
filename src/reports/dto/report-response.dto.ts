import { ApiProperty } from '@nestjs/swagger';

export class ReportMetaDto {
  @ApiProperty({ description: 'Total number of records' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt: string;

  @ApiProperty({ description: 'Report generation duration in milliseconds' })
  executionTime: number;

  @ApiProperty({ description: 'Report parameters used' })
  parameters: Record<string, any>;
}

export class InventoryValuationItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product SKU' })
  sku: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Location name' })
  locationName: string;

  @ApiProperty({ description: 'Quantity on hand' })
  quantityOnHand: number;

  @ApiProperty({ description: 'Quantity available for sale' })
  quantityAvailable: number;

  @ApiProperty({ description: 'Average cost per unit' })
  averageCost: number;

  @ApiProperty({ description: 'Current selling price' })
  sellingPrice: number;

  @ApiProperty({ description: 'Total inventory value (cost)' })
  totalCostValue: number;

  @ApiProperty({ description: 'Total inventory value (selling)' })
  totalSellingValue: number;

  @ApiProperty({ description: 'Potential profit' })
  potentialProfit: number;

  @ApiProperty({ description: 'Last movement date' })
  lastMovementAt?: string;

  @ApiProperty({ description: 'Days since last movement' })
  daysSinceLastMovement?: number;
}

export class InventoryValuationResponseDto {
  @ApiProperty({ type: [InventoryValuationItemDto] })
  data: InventoryValuationItemDto[];

  @ApiProperty({ type: ReportMetaDto })
  meta: ReportMetaDto;

  @ApiProperty({ description: 'Summary totals' })
  summary: {
    totalItems: number;
    totalCostValue: number;
    totalSellingValue: number;
    totalPotentialProfit: number;
    averageDaysSinceMovement: number;
  };
}

export class StockMovementItemDto {
  @ApiProperty({ description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ description: 'Transaction date' })
  transactionDate: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product SKU' })
  sku: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Location name' })
  locationName: string;

  @ApiProperty({ description: 'Transaction type' })
  transactionType: string;

  @ApiProperty({ description: 'Quantity moved' })
  quantity: number;

  @ApiProperty({ description: 'Quantity before transaction' })
  quantityBefore: number;

  @ApiProperty({ description: 'Quantity after transaction' })
  quantityAfter: number;

  @ApiProperty({ description: 'Unit cost' })
  unitCost?: number;

  @ApiProperty({ description: 'Total cost of transaction' })
  totalCost?: number;

  @ApiProperty({ description: 'Transaction reason' })
  reason?: string;

  @ApiProperty({ description: 'Reference number' })
  referenceNumber?: string;

  @ApiProperty({ description: 'User who performed transaction' })
  createdBy: string;
}

export class StockMovementResponseDto {
  @ApiProperty({ type: [StockMovementItemDto] })
  data: StockMovementItemDto[];

  @ApiProperty({ type: ReportMetaDto })
  meta: ReportMetaDto;

  @ApiProperty({ description: 'Summary by movement type' })
  summary: {
    totalMovements: number;
    receipts: { count: number; totalQuantity: number; totalValue: number };
    issues: { count: number; totalQuantity: number; totalValue: number };
    transfers: { count: number; totalQuantity: number };
    adjustments: { count: number; totalQuantity: number };
  };
}

export class LowStockItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product SKU' })
  sku: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Location ID' })
  locationId: string;

  @ApiProperty({ description: 'Location name' })
  locationName: string;

  @ApiProperty({ description: 'Current available quantity' })
  quantityAvailable: number;

  @ApiProperty({ description: 'Reorder point' })
  reorderPoint: number;

  @ApiProperty({ description: 'Reorder quantity' })
  reorderQuantity: number;

  @ApiProperty({ description: 'Maximum stock level' })
  maxStock?: number;

  @ApiProperty({ description: 'Average daily sales' })
  averageDailySales?: number;

  @ApiProperty({ description: 'Days of stock remaining' })
  daysOfStockRemaining?: number;

  @ApiProperty({ description: 'Stock status' })
  stockStatus: 'out_of_stock' | 'critical' | 'low' | 'reorder_needed';

  @ApiProperty({ description: 'Suggested reorder quantity' })
  suggestedReorderQuantity: number;

  @ApiProperty({ description: 'Last sale date' })
  lastSaleDate?: string;

  @ApiProperty({ description: 'Days since last sale' })
  daysSinceLastSale?: number;
}

export class LowStockResponseDto {
  @ApiProperty({ type: [LowStockItemDto] })
  data: LowStockItemDto[];

  @ApiProperty({ type: ReportMetaDto })
  meta: ReportMetaDto;

  @ApiProperty({ description: 'Summary by stock status' })
  summary: {
    totalItems: number;
    outOfStock: number;
    critical: number;
    low: number;
    reorderNeeded: number;
    totalReorderValue: number;
  };
}

export class ProductPerformanceItemDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product SKU' })
  sku: string;

  @ApiProperty({ description: 'Product name' })
  productName: string;

  @ApiProperty({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Total quantity sold' })
  totalQuantitySold: number;

  @ApiProperty({ description: 'Total sales value' })
  totalSalesValue: number;

  @ApiProperty({ description: 'Total quantity purchased/received' })
  totalQuantityReceived: number;

  @ApiProperty({ description: 'Total purchase cost' })
  totalPurchaseCost: number;

  @ApiProperty({ description: 'Gross profit' })
  grossProfit: number;

  @ApiProperty({ description: 'Gross profit margin percentage' })
  grossProfitMargin: number;

  @ApiProperty({ description: 'Number of transactions' })
  transactionCount: number;

  @ApiProperty({ description: 'Current stock level' })
  currentStockLevel: number;

  @ApiProperty({ description: 'Inventory turnover ratio' })
  inventoryTurnover: number;

  @ApiProperty({ description: 'Days in inventory' })
  daysInInventory: number;

  @ApiProperty({ description: 'First sale date' })
  firstSaleDate?: string;

  @ApiProperty({ description: 'Last sale date' })
  lastSaleDate?: string;

  @ApiProperty({ description: 'Average sale price' })
  averageSalePrice: number;

  @ApiProperty({ description: 'Average sale quantity per transaction' })
  averageSaleQuantity: number;

  @ApiProperty({ description: 'Performance ranking' })
  performanceRank?: number;

  @ApiProperty({ description: 'Performance category' })
  performanceCategory: 'high' | 'medium' | 'low' | 'slow_moving';
}

export class ProductPerformanceResponseDto {
  @ApiProperty({ type: [ProductPerformanceItemDto] })
  data: ProductPerformanceItemDto[];

  @ApiProperty({ type: ReportMetaDto })
  meta: ReportMetaDto;

  @ApiProperty({ description: 'Performance summary' })
  summary: {
    totalProducts: number;
    highPerformers: number;
    mediumPerformers: number;
    lowPerformers: number;
    slowMoving: number;
    totalSalesValue: number;
    totalGrossProfit: number;
    averageGrossProfitMargin: number;
    averageInventoryTurnover: number;
  };
}
