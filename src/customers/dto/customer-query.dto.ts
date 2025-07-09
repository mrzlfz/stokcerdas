import {
  IsOptional,
  IsEnum,
  IsArray,
  IsString,
  IsNumber,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomerStatus,
  CustomerType,
  LoyaltyTier,
  CustomerSegmentType,
} from '../entities/customer.entity';

export enum CustomerSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  FULL_NAME = 'fullName',
  EMAIL = 'email',
  PHONE = 'phone',
  CUSTOMER_NUMBER = 'customerNumber',
  LIFETIME_VALUE = 'lifetimeValue',
  TOTAL_ORDERS = 'totalOrders',
  TOTAL_SPENT = 'totalSpent',
  LAST_ORDER_DATE = 'lastOrderDate',
  FIRST_ORDER_DATE = 'firstOrderDate',
  AVERAGE_ORDER_VALUE = 'averageOrderValue',
  CHURN_PROBABILITY = 'churnProbability',
  RETENTION_SCORE = 'retentionScore',
  DAYS_SINCE_LAST_ORDER = 'daysSinceLastOrder',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class CustomerQueryDto {
  // Pagination
  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Sorting
  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: CustomerSortBy,
    default: CustomerSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CustomerSortBy)
  sortBy?: CustomerSortBy = CustomerSortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  // Text Search
  @ApiPropertyOptional({
    description:
      'Search term (searches in name, email, phone, customer number)',
    example: 'siti nurhaliza',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // Basic Filters
  @ApiPropertyOptional({
    description: 'Filter by customer status',
    enum: CustomerStatus,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(CustomerStatus, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  status?: CustomerStatus[];

  @ApiPropertyOptional({
    description: 'Filter by customer type',
    enum: CustomerType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(CustomerType, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  customerType?: CustomerType[];

  @ApiPropertyOptional({
    description: 'Filter by customer segment',
    enum: CustomerSegmentType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(CustomerSegmentType, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  segment?: CustomerSegmentType[];

  @ApiPropertyOptional({
    description: 'Filter by loyalty tier',
    enum: LoyaltyTier,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LoyaltyTier, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  loyaltyTier?: LoyaltyTier[];

  // Geographic Filters
  @ApiPropertyOptional({
    description: 'Filter by cities',
    type: [String],
    example: ['Jakarta', 'Surabaya', 'Bandung'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  cities?: string[];

  @ApiPropertyOptional({
    description: 'Filter by states/provinces',
    type: [String],
    example: ['DKI Jakarta', 'Jawa Timur', 'Jawa Barat'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  states?: string[];

  // Date Range Filters
  @ApiPropertyOptional({
    description: 'Created after date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Created before date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'First order after date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  firstOrderAfter?: string;

  @ApiPropertyOptional({
    description: 'First order before date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  firstOrderBefore?: string;

  @ApiPropertyOptional({
    description: 'Last order after date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  lastOrderAfter?: string;

  @ApiPropertyOptional({
    description: 'Last order before date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  lastOrderBefore?: string;

  // Numeric Range Filters
  @ApiPropertyOptional({
    description: 'Minimum lifetime value (IDR)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minLifetimeValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum lifetime value (IDR)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLifetimeValue?: number;

  @ApiPropertyOptional({
    description: 'Minimum total orders',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotalOrders?: number;

  @ApiPropertyOptional({
    description: 'Maximum total orders',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxTotalOrders?: number;

  @ApiPropertyOptional({
    description: 'Minimum average order value (IDR)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAverageOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Maximum average order value (IDR)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAverageOrderValue?: number;

  @ApiPropertyOptional({
    description: 'Minimum churn probability (%)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minChurnProbability?: number;

  @ApiPropertyOptional({
    description: 'Maximum churn probability (%)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxChurnProbability?: number;

  @ApiPropertyOptional({
    description: 'Minimum days since last order',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDaysSinceLastOrder?: number;

  @ApiPropertyOptional({
    description: 'Maximum days since last order',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDaysSinceLastOrder?: number;

  // Behavioral Filters
  @ApiPropertyOptional({
    description: 'Filter by email verification status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by phone verification status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPhoneVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Filter high-value customers only',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isHighValue?: boolean;

  @ApiPropertyOptional({
    description: 'Filter at-risk customers (high churn probability)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isAtRisk?: boolean;

  @ApiPropertyOptional({
    description: 'Filter customers with returns',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasReturns?: boolean;

  @ApiPropertyOptional({
    description: 'Filter customers with complaints',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasComplaints?: boolean;

  // Tag Filters
  @ApiPropertyOptional({
    description: 'Filter by customer tags',
    type: [String],
    example: ['vip', 'enterprise', 'loyal'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  tags?: string[];

  // Assignment Filters
  @ApiPropertyOptional({
    description: 'Filter by assigned sales representative',
  })
  @IsOptional()
  @IsString()
  assignedSalesRepId?: string;

  @ApiPropertyOptional({
    description: 'Filter by account manager',
  })
  @IsOptional()
  @IsString()
  accountManagerId?: string;

  // External System Filters
  @ApiPropertyOptional({
    description: 'Filter customers with Shopee integration',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasShopeeIntegration?: boolean;

  @ApiPropertyOptional({
    description: 'Filter customers with Tokopedia integration',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasTokopediaIntegration?: boolean;

  @ApiPropertyOptional({
    description: 'Filter customers with WhatsApp integration',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasWhatsappIntegration?: boolean;

  // Advanced Analytics Filters
  @ApiPropertyOptional({
    description: 'Filter by customer lifecycle stage',
    enum: ['new', 'growing', 'mature', 'declining', 'dormant'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  lifecycleStage?: string[];

  @ApiPropertyOptional({
    description: 'Include customer relationships in response',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeRelations?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include customer analytics summary',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeAnalytics?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include customer purchase behavior data',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeBehavior?: boolean = false;
}
